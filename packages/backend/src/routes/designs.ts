import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config.js';
import * as designRepo from '../repositories/designRepository.js';
import * as designService from '../services/designService.js';

const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = crypto.randomBytes(8).toString('hex');
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const designs = designRepo.getAllDesigns();
    const withUrls = designs.map(d => ({
      ...d,
      url: designService.getDesignPublicUrl(d),
    }));
    res.json(withUrls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const design = await designService.processUploadedDesign(req.file);
    res.status(201).json({
      ...design,
      url: designService.getDesignPublicUrl(design),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const design = designRepo.getDesignById(Number(req.params.id));
    if (!design) return res.status(404).json({ error: 'Design not found' });
    designService.deleteDesignFile(design);
    designRepo.deleteDesign(design.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/check-url', async (req: Request, res: Response) => {
  try {
    const design = designRepo.getDesignById(Number(req.params.id));
    if (!design) return res.status(404).json({ error: 'Design not found' });
    const url = designService.getDesignPublicUrl(design);
    try {
      const response = await axios.head(url, { timeout: 5000 });
      res.json({ url, accessible: response.status === 200 });
    } catch {
      res.json({ url, accessible: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
