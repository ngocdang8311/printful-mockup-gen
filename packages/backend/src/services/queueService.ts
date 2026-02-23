import PQueue from 'p-queue';
import path from 'path';
import fs from 'fs';
import slugify from 'slugify';
import { config } from '../config.js';
import * as presetRepo from '../repositories/presetRepository.js';
import * as designRepo from '../repositories/designRepository.js';
import * as jobRepo from '../repositories/jobRepository.js';
import * as mockupService from './mockupService.js';
import { getDesignPublicUrl } from './designService.js';

// SSE connections per job
const sseClients = new Map<number, Set<(data: any) => void>>();

export function addSSEClient(jobId: number, sendFn: (data: any) => void): () => void {
  if (!sseClients.has(jobId)) sseClients.set(jobId, new Set());
  sseClients.get(jobId)!.add(sendFn);
  return () => sseClients.get(jobId)?.delete(sendFn);
}

function emitProgress(jobId: number, data: any) {
  const clients = sseClients.get(jobId);
  if (clients) {
    for (const send of clients) {
      send(data);
    }
  }
}

const submissionQueue = new PQueue({ concurrency: 2 });
const downloadQueue = new PQueue({ concurrency: 5 });

export async function startGeneration(presetId: number, designId: number): Promise<jobRepo.Job> {
  const preset = presetRepo.getPresetById(presetId);
  if (!preset) throw new Error('Preset not found');
  if (preset.items.length === 0) throw new Error('Preset has no items');

  const design = designRepo.getDesignById(designId);
  if (!design) throw new Error('Design not found');

  const designUrl = getDesignPublicUrl(design);
  const presetSlug = slugify(preset.name, { lower: true, strict: true });
  const designSlug = slugify(design.name, { lower: true, strict: true });
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outputDirName = `${dateStr}_${presetSlug}_${designSlug}`;
  const outputDir = path.join(config.outputDir, outputDirName);
  fs.mkdirSync(outputDir, { recursive: true });

  const job = jobRepo.createJob(presetId, designId, preset.items.length, outputDirName);

  // Create task records
  const tasks: Array<{ dbTask: jobRepo.JobTask; presetItem: presetRepo.PresetItem }> = [];
  for (const item of preset.items) {
    const dbTask = jobRepo.createJobTask(job.id, item.id, item.product_id, item.product_name);
    tasks.push({ dbTask, presetItem: item });
  }

  // Start processing asynchronously
  jobRepo.updateJobStatus(job.id, 'processing');
  emitProgress(job.id, { type: 'job_started', jobId: job.id, totalTasks: tasks.length });

  processJob(job.id, tasks, designUrl, outputDir, design.width, design.height).catch(err => {
    console.error(`Job ${job.id} failed:`, err);
    jobRepo.updateJobStatus(job.id, 'failed');
    emitProgress(job.id, { type: 'job_failed', jobId: job.id, error: err.message });
  });

  return job;
}

async function processJob(
  jobId: number,
  tasks: Array<{ dbTask: jobRepo.JobTask; presetItem: presetRepo.PresetItem }>,
  designUrl: string,
  outputDir: string,
  designWidth: number,
  designHeight: number,
) {
  const promises = tasks.map(({ dbTask, presetItem }) =>
    submissionQueue.add(async () => {
      try {
        // Submit task
        jobRepo.updateJobTask(dbTask.id, { status: 'submitting' });
        emitProgress(jobId, {
          type: 'task_submitting',
          taskId: dbTask.id,
          productName: presetItem.product_name,
        });

        const { taskKey } = await mockupService.submitMockupTask({
          presetItem,
          designUrl,
          designWidth,
          designHeight,
        });

        jobRepo.updateJobTask(dbTask.id, { task_key: taskKey, status: 'polling' });
        emitProgress(jobId, {
          type: 'task_polling',
          taskId: dbTask.id,
          taskKey,
        });

        // Poll for result
        const result = await mockupService.pollForResult(taskKey);

        if (result.status === 'failed') {
          jobRepo.updateJobTask(dbTask.id, { status: 'failed', error: result.error || '' });
          jobRepo.incrementJobFailed(jobId);
          emitProgress(jobId, {
            type: 'task_failed',
            taskId: dbTask.id,
            error: result.error,
          });
          return;
        }

        // Download images
        jobRepo.updateJobTask(dbTask.id, { status: 'downloading' });
        emitProgress(jobId, { type: 'task_downloading', taskId: dbTask.id });

        const productSlug = slugify(presetItem.product_name || `product-${presetItem.product_id}`, {
          lower: true,
          strict: true,
        });

        const downloadedFiles = await downloadQueue.addAll(
          [async () => mockupService.downloadMockupImages(result.mockups, outputDir, productSlug)]
        );

        const mockupUrls = result.mockups.map(m => m.mockup_url).filter(Boolean);
        jobRepo.updateJobTask(dbTask.id, { status: 'completed', mockup_urls: mockupUrls });
        jobRepo.incrementJobCompleted(jobId);
        emitProgress(jobId, {
          type: 'task_completed',
          taskId: dbTask.id,
          mockupUrls,
          productName: presetItem.product_name,
        });
      } catch (err: any) {
        jobRepo.updateJobTask(dbTask.id, { status: 'failed', error: err.message });
        jobRepo.incrementJobFailed(jobId);
        emitProgress(jobId, {
          type: 'task_failed',
          taskId: dbTask.id,
          error: err.message,
        });
      }
    })
  );

  await Promise.all(promises);

  // Check final status
  const finalJob = jobRepo.getJobById(jobId);
  if (finalJob) {
    const allDone = finalJob.completed_tasks + finalJob.failed_tasks >= finalJob.total_tasks;
    if (allDone) {
      const finalStatus = finalJob.failed_tasks === finalJob.total_tasks ? 'failed' : 'completed';
      jobRepo.updateJobStatus(jobId, finalStatus);

      // Write summary
      const summaryPath = path.join(outputDir, '_summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify({
        jobId,
        status: finalStatus,
        totalTasks: finalJob.total_tasks,
        completedTasks: finalJob.completed_tasks,
        failedTasks: finalJob.failed_tasks,
        createdAt: finalJob.created_at,
      }, null, 2));

      emitProgress(jobId, {
        type: 'job_completed',
        jobId,
        status: finalStatus,
        completedTasks: finalJob.completed_tasks,
        failedTasks: finalJob.failed_tasks,
      });
    }
  }
}

// Cancel support
const cancelledJobs = new Set<number>();

export function cancelJob(jobId: number) {
  cancelledJobs.add(jobId);
  jobRepo.updateJobStatus(jobId, 'cancelled');
  emitProgress(jobId, { type: 'job_cancelled', jobId });
}

export function isJobCancelled(jobId: number) {
  return cancelledJobs.has(jobId);
}
