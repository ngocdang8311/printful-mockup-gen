import { Router, Request, Response } from 'express';
import * as catalogService from '../services/catalogService.js';

const router = Router();

router.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await catalogService.getProducts();
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await catalogService.getProduct(Number(req.params.id));
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products/:id/printfiles', async (req: Request, res: Response) => {
  try {
    const printfiles = await catalogService.getProductPrintfiles(Number(req.params.id));
    res.json(printfiles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products/:id/templates', async (req: Request, res: Response) => {
  try {
    const templates = await catalogService.getProductTemplates(Number(req.params.id));
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products/:id/placements', async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const [printfiles, templates] = await Promise.all([
      catalogService.getProductPrintfiles(productId),
      catalogService.getProductTemplates(productId),
    ]);
    res.json({
      placements: printfiles?.available_placements || {},
      conflicting: templates?.conflicting_placements || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
