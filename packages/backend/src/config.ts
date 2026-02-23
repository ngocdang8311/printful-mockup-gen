import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  printfulToken: process.env.PRINTFUL_TOKEN || '',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3001',
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: path.resolve(__dirname, '../../../data.db'),
  uploadsDir: path.resolve(__dirname, '../../../uploads'),
  outputDir: path.resolve(__dirname, '../../../output'),
};
