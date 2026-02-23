import { queryAll, queryOne, runSql, getLastInsertRowId } from '../db/database.js';

export interface Design {
  id: number;
  name: string;
  filename: string;
  filepath: string;
  width: number;
  height: number;
  file_size: number;
  created_at: string;
}

export function getAllDesigns(): Design[] {
  return queryAll<Design>('SELECT * FROM designs ORDER BY created_at DESC');
}

export function getDesignById(id: number): Design | null {
  return queryOne<Design>('SELECT * FROM designs WHERE id = ?', [id]);
}

export function createDesign(design: Omit<Design, 'id' | 'created_at'>): Design {
  runSql(`
    INSERT INTO designs (name, filename, filepath, width, height, file_size)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [design.name, design.filename, design.filepath, design.width, design.height, design.file_size]);
  const id = getLastInsertRowId();
  return getDesignById(id)!;
}

export function deleteDesign(id: number): boolean {
  const existing = queryOne('SELECT id FROM designs WHERE id = ?', [id]);
  if (!existing) return false;
  runSql('DELETE FROM designs WHERE id = ?', [id]);
  return true;
}
