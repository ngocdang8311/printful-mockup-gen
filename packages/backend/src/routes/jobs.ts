import { Router, Request, Response } from 'express';
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

export default router;
