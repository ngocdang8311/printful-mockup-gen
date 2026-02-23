import { Router, Request, Response } from 'express';
import * as queueService from '../services/queueService.js';
import * as jobRepo from '../repositories/jobRepository.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { presetId, designId } = req.body;
    if (!presetId || !designId) {
      return res.status(400).json({ error: 'presetId and designId are required' });
    }
    const job = await queueService.startGeneration(presetId, designId);
    res.status(201).json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:jobId', (req: Request, res: Response) => {
  try {
    const job = jobRepo.getJobById(Number(req.params.jobId));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSE endpoint for real-time progress
router.get('/:jobId/events', (req: Request, res: Response) => {
  const jobId = Number(req.params.jobId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send current state
  const job = jobRepo.getJobById(jobId);
  if (job) {
    send({ type: 'job_state', job });
  }

  const removeClient = queueService.addSSEClient(jobId, send);

  req.on('close', () => {
    removeClient();
  });
});

router.post('/:jobId/cancel', (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.jobId);
    queueService.cancelJob(jobId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
