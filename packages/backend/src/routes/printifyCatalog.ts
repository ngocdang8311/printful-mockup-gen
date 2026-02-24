import { Router, Request, Response } from 'express';
import * as printifyCatalog from '../services/printifyCatalogService.js';
import { printifyClient } from '../services/printifyClient.js';
import { config } from '../config.js';

const router = Router();

// List shops
router.get('/shops', async (_req: Request, res: Response) => {
  try {
    if (!config.printifyToken) {
      return res.status(400).json({ error: 'Printify token not configured' });
    }
    const shops = await printifyClient.getShops();
    res.json(shops);
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// List blueprints
router.get('/blueprints', async (_req: Request, res: Response) => {
  try {
    const blueprints = await printifyCatalog.getBlueprints();
    res.json(blueprints);
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Get single blueprint
router.get('/blueprints/:id', async (req: Request, res: Response) => {
  try {
    const blueprint = await printifyCatalog.getBlueprint(Number(req.params.id));
    res.json(blueprint);
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Get print providers for a blueprint
router.get('/blueprints/:id/providers', async (req: Request, res: Response) => {
  try {
    const providers = await printifyCatalog.getBlueprintProviders(Number(req.params.id));
    res.json(providers);
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Get variants for a blueprint + provider
router.get('/blueprints/:id/providers/:providerId/variants', async (req: Request, res: Response) => {
  try {
    const variants = await printifyCatalog.getBlueprintVariants(
      Number(req.params.id),
      Number(req.params.providerId),
    );
    res.json(variants);
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

export default router;
