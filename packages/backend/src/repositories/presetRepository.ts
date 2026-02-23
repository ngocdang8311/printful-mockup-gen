import { queryAll, queryOne, runSql, getLastInsertRowId } from '../db/database.js';

export interface Preset {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PresetItem {
  id: number;
  preset_id: number;
  product_id: number;
  product_name: string;
  variant_ids: number[];
  variant_labels: string[];
  placements: string[];
  mockup_style_options: Record<string, any>;
  position_config: Record<string, any>;
  created_at: string;
}

function parseItem(row: any): PresetItem {
  return {
    ...row,
    variant_ids: JSON.parse(row.variant_ids || '[]'),
    variant_labels: JSON.parse(row.variant_labels || '[]'),
    placements: JSON.parse(row.placements || '[]'),
    mockup_style_options: JSON.parse(row.mockup_style_options || '{}'),
    position_config: JSON.parse(row.position_config || '{}'),
  };
}

export function getAllPresets(): Preset[] {
  return queryAll<Preset>('SELECT * FROM presets ORDER BY updated_at DESC');
}

export function getPresetById(id: number): (Preset & { items: PresetItem[] }) | null {
  const preset = queryOne<Preset>('SELECT * FROM presets WHERE id = ?', [id]);
  if (!preset) return null;
  const items = queryAll('SELECT * FROM preset_items WHERE preset_id = ? ORDER BY id', [id]);
  return { ...preset, items: items.map(parseItem) };
}

export function createPreset(name: string, description: string): Preset & { items: PresetItem[] } {
  runSql('INSERT INTO presets (name, description) VALUES (?, ?)', [name, description]);
  const id = getLastInsertRowId();
  return getPresetById(id)!;
}

export function updatePreset(id: number, name: string, description: string): (Preset & { items: PresetItem[] }) | null {
  runSql("UPDATE presets SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?", [name, description, id]);
  return getPresetById(id);
}

export function deletePreset(id: number): boolean {
  const existing = queryOne('SELECT id FROM presets WHERE id = ?', [id]);
  if (!existing) return false;
  runSql('DELETE FROM preset_items WHERE preset_id = ?', [id]);
  runSql('DELETE FROM presets WHERE id = ?', [id]);
  return true;
}

export function addPresetItem(
  presetId: number,
  item: Omit<PresetItem, 'id' | 'preset_id' | 'created_at'>
): PresetItem {
  runSql(`
    INSERT INTO preset_items (preset_id, product_id, product_name, variant_ids, variant_labels, placements, mockup_style_options, position_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    presetId,
    item.product_id,
    item.product_name,
    JSON.stringify(item.variant_ids),
    JSON.stringify(item.variant_labels),
    JSON.stringify(item.placements),
    JSON.stringify(item.mockup_style_options),
    JSON.stringify(item.position_config),
  ]);
  const id = getLastInsertRowId();
  const row = queryOne('SELECT * FROM preset_items WHERE id = ?', [id]);
  return parseItem(row);
}

export function updatePresetItem(
  presetId: number,
  itemId: number,
  item: Partial<Omit<PresetItem, 'id' | 'preset_id' | 'created_at'>>
): PresetItem | null {
  const existing = queryOne('SELECT * FROM preset_items WHERE id = ? AND preset_id = ?', [itemId, presetId]);
  if (!existing) return null;

  const parsed = parseItem(existing);
  const updated = { ...parsed, ...item };

  runSql(`
    UPDATE preset_items SET product_id = ?, product_name = ?, variant_ids = ?, variant_labels = ?, placements = ?, mockup_style_options = ?, position_config = ?
    WHERE id = ? AND preset_id = ?
  `, [
    updated.product_id,
    updated.product_name,
    JSON.stringify(updated.variant_ids),
    JSON.stringify(updated.variant_labels),
    JSON.stringify(updated.placements),
    JSON.stringify(updated.mockup_style_options),
    JSON.stringify(updated.position_config),
    itemId,
    presetId,
  ]);

  const row = queryOne('SELECT * FROM preset_items WHERE id = ?', [itemId]);
  return parseItem(row);
}

export function deletePresetItem(presetId: number, itemId: number): boolean {
  const existing = queryOne('SELECT id FROM preset_items WHERE id = ? AND preset_id = ?', [itemId, presetId]);
  if (!existing) return false;
  runSql('DELETE FROM preset_items WHERE id = ? AND preset_id = ?', [itemId, presetId]);
  return true;
}
