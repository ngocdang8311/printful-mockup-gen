import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  printfulToken: process.env.PRINTFUL_TOKEN || '',
  printifyToken: process.env.PRINTIFY_TOKEN || '',
  printifyShopId: process.env.PRINTIFY_SHOP_ID || '',
  apiSecret: process.env.API_SECRET || '',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3001',
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../../data.db'),
  uploadsDir: process.env.UPLOADS_DIR || path.resolve(__dirname, '../../../uploads'),
  outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, '../../../output'),
};
