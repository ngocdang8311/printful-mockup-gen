import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../../.env');

const router = Router();

// Auth guard: require x-api-secret header
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = config.apiSecret;
  if (!secret) return next(); // no secret configured = open access (dev mode)
  const provided = req.headers['x-api-secret'];
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(requireAuth);

function parseEnvFile(): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function writeEnvFile(vars: Record<string, string>): void {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n');
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const env = parseEnvFile();
    res.json({
      printfulToken: env.PRINTFUL_TOKEN ? maskToken(env.PRINTFUL_TOKEN) : '',
      printfulTokenSet: !!env.PRINTFUL_TOKEN && env.PRINTFUL_TOKEN !== 'your_printful_api_token_here',
      printifyToken: env.PRINTIFY_TOKEN ? maskToken(env.PRINTIFY_TOKEN) : '',
      printifyTokenSet: !!env.PRINTIFY_TOKEN,
      printifyShopId: env.PRINTIFY_SHOP_ID || '',
      publicUrl: env.PUBLIC_URL || config.publicUrl,
      port: env.PORT || String(config.port),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const env = parseEnvFile();
    const { printfulToken, publicUrl, port } = req.body;

    if (printfulToken !== undefined && printfulToken !== '') {
      env.PRINTFUL_TOKEN = printfulToken;
      (config as any).printfulToken = printfulToken;
    }

    const { printifyToken, printifyShopId } = req.body;
    if (printifyToken !== undefined && printifyToken !== '') {
      env.PRINTIFY_TOKEN = printifyToken;
      (config as any).printifyToken = printifyToken;
    }
    if (printifyShopId !== undefined) {
      env.PRINTIFY_SHOP_ID = printifyShopId;
      (config as any).printifyShopId = printifyShopId;
    }

    if (publicUrl !== undefined) {
      env.PUBLIC_URL = publicUrl;
      (config as any).publicUrl = publicUrl;
    }
    if (port !== undefined) {
      env.PORT = String(port);
    }
    if (!env.NODE_ENV) env.NODE_ENV = 'development';

    writeEnvFile(env);

    res.json({
      success: true,
      message: 'Settings saved. Token and Public URL updated at runtime. Port change requires restart.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test Printful connection
router.get('/test-connection', async (_req: Request, res: Response) => {
  try {
    const { printfulClient } = await import('../services/printfulClient.js');
    const store = await printfulClient.getProducts();
    res.json({ success: true, productCount: store.length });
  } catch (err: any) {
    res.json({ success: false, error: err.response?.data?.error?.message || err.message });
  }
});

// Test Printify connection
router.get('/test-printify', async (_req: Request, res: Response) => {
  try {
    const { printifyClient } = await import('../services/printifyClient.js');
    const shops = await printifyClient.getShops();
    res.json({ success: true, shops });
  } catch (err: any) {
    res.json({ success: false, error: err.response?.data?.message || err.message });
  }
});

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

export default router;
