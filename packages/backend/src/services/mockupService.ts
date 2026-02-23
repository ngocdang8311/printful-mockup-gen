import axios from 'axios';
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';
import { printfulClient, CreateTaskRequest } from './printfulClient.js';
import * as catalogService from './catalogService.js';
import { PresetItem } from '../repositories/presetRepository.js';
import { config } from '../config.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface TaskSubmission {
  presetItem: PresetItem;
  designUrl: string;
}

export interface TaskResult {
  taskKey: string;
  status: 'completed' | 'failed';
  mockups: Array<{
    placement: string;
    variant_ids: number[];
    mockup_url: string;
    extra: Array<{ url: string; title: string }>;
  }>;
  error?: string;
}

export async function submitMockupTask(
  submission: TaskSubmission
): Promise<{ taskKey: string }> {
  const { presetItem, designUrl } = submission;

  const files = presetItem.placements.map(placement => {
    const posConfig = (presetItem.position_config as any)?.[placement];
    return {
      placement,
      image_url: designUrl,
      ...(posConfig ? { position: posConfig } : {}),
    };
  });

  const body: CreateTaskRequest = {
    variant_ids: presetItem.variant_ids,
    format: 'jpg',
    files,
  };

  // Add mockup style options if present
  const styleOpts = presetItem.mockup_style_options as any;
  if (styleOpts?.option_groups?.length) {
    body.option_groups = styleOpts.option_groups;
  }
  if (styleOpts?.options?.length) {
    body.options = styleOpts.options;
  }

  const result = await printfulClient.createMockupTask(presetItem.product_id, body);
  return { taskKey: result.task_key };
}

export async function pollForResult(
  taskKey: string,
  maxAttempts = 30
): Promise<TaskResult> {
  let delay = 2000;
  const maxDelay = 15000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(delay);
    const result = await printfulClient.getMockupTaskResult(taskKey);

    if (result.status === 'completed') {
      return {
        taskKey,
        status: 'completed',
        mockups: result.mockups || [],
      };
    }

    if (result.status === 'failed') {
      return {
        taskKey,
        status: 'failed',
        mockups: [],
        error: result.error || 'Mockup generation failed',
      };
    }

    // Exponential backoff
    delay = Math.min(delay * 1.5, maxDelay);
  }

  return {
    taskKey,
    status: 'failed',
    mockups: [],
    error: 'Polling timeout exceeded',
  };
}

export async function downloadMockupImages(
  mockups: TaskResult['mockups'],
  outputDir: string,
  productSlug: string,
): Promise<string[]> {
  const downloaded: string[] = [];

  for (const mockup of mockups) {
    const placement = mockup.placement || 'default';
    const placementDir = path.join(outputDir, productSlug, placement);
    fs.mkdirSync(placementDir, { recursive: true });

    // Download main mockup
    const mainUrl = mockup.mockup_url;
    if (mainUrl) {
      const filename = `mockup_${mockup.variant_ids?.join('-') || 'all'}.jpg`;
      const filepath = path.join(placementDir, filename);
      await downloadFile(mainUrl, filepath);
      downloaded.push(filepath);
    }

    // Download extras
    for (const extra of mockup.extra || []) {
      const extraSlug = slugify(extra.title || 'extra', { lower: true, strict: true });
      const filename = `${extraSlug}_${mockup.variant_ids?.join('-') || 'all'}.jpg`;
      const filepath = path.join(placementDir, filename);
      await downloadFile(extra.url, filepath);
      downloaded.push(filepath);
    }
  }

  return downloaded;
}

async function downloadFile(url: string, filepath: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'stream', timeout: 60000 });
  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
