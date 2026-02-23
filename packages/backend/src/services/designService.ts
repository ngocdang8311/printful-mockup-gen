import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { config } from '../config.js';
import * as designRepo from '../repositories/designRepository.js';

export async function processUploadedDesign(file: Express.Multer.File): Promise<designRepo.Design> {
  let width = 0;
  let height = 0;

  try {
    const metadata = await sharp(file.path).metadata();
    width = metadata.width || 0;
    height = metadata.height || 0;
  } catch {
    // Not an image sharp can process, that's okay
  }

  const name = path.parse(file.originalname).name;
  const relativePath = path.relative(config.uploadsDir, file.path).replace(/\\/g, '/');

  return designRepo.createDesign({
    name,
    filename: file.filename,
    filepath: relativePath,
    width,
    height,
    file_size: file.size,
  });
}

export function getDesignPublicUrl(design: designRepo.Design): string {
  return `${config.publicUrl}/uploads/${design.filepath}`;
}

export function deleteDesignFile(design: designRepo.Design): void {
  const fullPath = path.join(config.uploadsDir, design.filepath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}
