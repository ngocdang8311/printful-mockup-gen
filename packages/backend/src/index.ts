import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, runMigrations } from './db/database.js';
import catalogRouter from './routes/catalog.js';
import presetsRouter from './routes/presets.js';
import designsRouter from './routes/designs.js';
import generationRouter from './routes/generation.js';
import jobsRouter from './routes/jobs.js';
import settingsRouter from './routes/settings.js';
import printifyCatalogRouter from './routes/printifyCatalog.js';

async function main() {
  // Ensure directories exist
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.mkdirSync(config.outputDir, { recursive: true });

  // Initialize database
  await initDb();
  runMigrations();

  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve uploaded files
  app.use('/uploads', express.static(config.uploadsDir));

  // Serve output files
  app.use('/output', express.static(config.outputDir));

  // Routes
  app.use('/api/catalog', catalogRouter);
  app.use('/api/presets', presetsRouter);
  app.use('/api/designs', designsRouter);
  app.use('/api/generate', generationRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/printify', printifyCatalogRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', publicUrl: config.publicUrl });
  });

  // Serve frontend
  if (config.nodeEnv === 'production') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontendDir = process.env.FRONTEND_DIR || path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDir));
    // SPA fallback: non-API routes → index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.redirect('http://localhost:5173');
    });
  }

  app.listen(config.port, () => {
    console.log(`Backend running on http://localhost:${config.port}`);
    console.log(`Public URL: ${config.publicUrl}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
