import { queryAll, queryOne, runSql, getLastInsertRowId } from '../db/database.js';

export interface Job {
  id: number;
  preset_id: number;
  design_id: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  output_dir: string;
  created_at: string;
  updated_at: string;
}

export interface JobTask {
  id: number;
  job_id: number;
  preset_item_id: number;
  product_id: number;
  product_name: string;
  task_key: string;
  status: string;
  mockup_urls: string[];
  error: string;
  created_at: string;
  updated_at: string;
}

function parseTask(row: any): JobTask {
  return { ...row, mockup_urls: JSON.parse(row.mockup_urls || '[]') };
}

export function createJob(presetId: number, designId: number, totalTasks: number, outputDir: string): Job {
  runSql(`
    INSERT INTO jobs (preset_id, design_id, status, total_tasks, output_dir)
    VALUES (?, ?, 'pending', ?, ?)
  `, [presetId, designId, totalTasks, outputDir]);
  const id = getLastInsertRowId();
  return queryOne<Job>('SELECT * FROM jobs WHERE id = ?', [id])!;
}

export function getJobById(id: number): (Job & { tasks: JobTask[] }) | null {
  const job = queryOne<Job>('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) return null;
  const tasks = queryAll('SELECT * FROM job_tasks WHERE job_id = ? ORDER BY id', [id]);
  return { ...job, tasks: tasks.map(parseTask) };
}

export function getAllJobs(): Job[] {
  return queryAll<Job>('SELECT * FROM jobs ORDER BY created_at DESC');
}

export function updateJobStatus(id: number, status: string): void {
  runSql("UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
}

export function incrementJobCompleted(id: number): void {
  runSql("UPDATE jobs SET completed_tasks = completed_tasks + 1, updated_at = datetime('now') WHERE id = ?", [id]);
}

export function incrementJobFailed(id: number): void {
  runSql("UPDATE jobs SET failed_tasks = failed_tasks + 1, updated_at = datetime('now') WHERE id = ?", [id]);
}

export function createJobTask(
  jobId: number, presetItemId: number, productId: number, productName: string
): JobTask {
  runSql(`
    INSERT INTO job_tasks (job_id, preset_item_id, product_id, product_name, status)
    VALUES (?, ?, ?, ?, 'pending')
  `, [jobId, presetItemId, productId, productName]);
  const id = getLastInsertRowId();
  const row = queryOne('SELECT * FROM job_tasks WHERE id = ?', [id]);
  return parseTask(row);
}

export function updateJobTask(id: number, updates: Partial<Pick<JobTask, 'task_key' | 'status' | 'mockup_urls' | 'error'>>): void {
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: any[] = [];

  if (updates.task_key !== undefined) { sets.push('task_key = ?'); values.push(updates.task_key); }
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.mockup_urls !== undefined) { sets.push('mockup_urls = ?'); values.push(JSON.stringify(updates.mockup_urls)); }
  if (updates.error !== undefined) { sets.push('error = ?'); values.push(updates.error); }

  values.push(id);
  runSql(`UPDATE job_tasks SET ${sets.join(', ')} WHERE id = ?`, values);
}
