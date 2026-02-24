import { Router, Request, Response } from 'express';
import * as presetRepo from '../repositories/presetRepository.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const presets = presetRepo.getAllPresets();
    res.json(presets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description = '', provider = 'printful' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const preset = presetRepo.createPreset(name, description, provider);
    res.status(201).json(preset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const preset = presetRepo.getPresetById(Number(req.params.id));
    if (!preset) return res.status(404).json({ error: 'Preset not found' });
    res.json(preset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const preset = presetRepo.updatePreset(Number(req.params.id), name, description);
    if (!preset) return res.status(404).json({ error: 'Preset not found' });
    res.json(preset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = presetRepo.deletePreset(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Preset not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/clone', (req: Request, res: Response) => {
  try {
    const cloned = presetRepo.clonePreset(Number(req.params.id));
    if (!cloned) return res.status(404).json({ error: 'Preset not found' });
    res.status(201).json(cloned);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Preset items
router.post('/:id/items', (req: Request, res: Response) => {
  try {
    const presetId = Number(req.params.id);
    const preset = presetRepo.getPresetById(presetId);
    if (!preset) return res.status(404).json({ error: 'Preset not found' });

    const item = presetRepo.addPresetItem(presetId, {
      product_id: req.body.product_id,
      product_name: req.body.product_name || '',
      variant_ids: req.body.variant_ids || [],
      variant_labels: req.body.variant_labels || [],
      placements: req.body.placements || ['front'],
      mockup_style_options: req.body.mockup_style_options || {},
      position_config: req.body.position_config || {},
    });
    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/items/:itemId', (req: Request, res: Response) => {
  try {
    const item = presetRepo.updatePresetItem(
      Number(req.params.id),
      Number(req.params.itemId),
      req.body,
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/items/:itemId', (req: Request, res: Response) => {
  try {
    const deleted = presetRepo.deletePresetItem(
      Number(req.params.id),
      Number(req.params.itemId),
    );
    if (!deleted) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
