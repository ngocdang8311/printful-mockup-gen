import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import * as jobRepo from '../repositories/jobRepository.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const jobs = jobRepo.getAllJobs();
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:jobId/outputs', (req: Request, res: Response) => {
  try {
    const job = jobRepo.getJobById(Number(req.params.jobId));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!job.output_dir) return res.json({ files: [] });

    const outputPath = path.join(config.outputDir, job.output_dir);
    if (!fs.existsSync(outputPath)) return res.json({ files: [] });

    const files: Array<{ path: string; product: string; filename: string }> = [];

    // Read product subdirectories
    const entries = fs.readdirSync(outputPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const productDir = path.join(outputPath, entry.name);
        const images = fs.readdirSync(productDir).filter(f =>
          /\.(jpg|jpeg|png|webp)$/i.test(f)
        );
        for (const img of images) {
          files.push({
            path: `/output/${job.output_dir}/${entry.name}/${img}`,
            product: entry.name,
            filename: img,
          });
        }
      }
    }

    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
