import axios from 'axios';
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';
import { printifyClient } from './printifyClient.js';
import * as printifyCatalog from './printifyCatalogService.js';
import { config } from '../config.js';
import { PresetItem } from '../repositories/presetRepository.js';

export interface PrintifyTaskSubmission {
  presetItem: PresetItem;
  designImageId: string; // Printify uploaded image ID
  designWidth: number;
  designHeight: number;
}

export interface PrintifyMockupResult {
  status: 'completed' | 'failed';
  mockups: Array<{
    src: string;
    variant_ids: number[];
    is_default: boolean;
  }>;
  error?: string;
}

/**
 * Upload a design file to Printify as base64
 */
export async function uploadDesignToPrintify(designFilePath: string, fileName: string): Promise<string> {
  const fullPath = path.join(config.uploadsDir, designFilePath);
  const buffer = fs.readFileSync(fullPath);
  const base64 = buffer.toString('base64');

  const result = await printifyClient.uploadImage(fileName, base64);
  console.log(`[Printify] Uploaded image: ${result.id} (${result.file_name})`);
  return result.id;
}

/**
 * Generate mockups by creating a temporary product, extracting mockup images, then deleting the product.
 */
export async function generateMockups(
  submission: PrintifyTaskSubmission
): Promise<PrintifyMockupResult> {
  const { presetItem, designImageId, designWidth, designHeight } = submission;
  const shopId = config.printifyShopId;

  if (!shopId) {
    return { status: 'failed', mockups: [], error: 'Printify shop ID not configured' };
  }

  const styleOpts = presetItem.mockup_style_options as any;
  const printProviderId = styleOpts?.print_provider_id;

  if (!printProviderId) {
    return { status: 'failed', mockups: [], error: 'No print provider configured for this item' };
  }

  // Get variant details to build print_areas
  const variants = await printifyCatalog.getBlueprintVariants(presetItem.product_id, printProviderId);

  // Find placeholders for our selected variants
  const selectedVariantIds = presetItem.variant_ids;
  const selectedVariants = (variants?.variants || variants || [])
    .filter((v: any) => selectedVariantIds.includes(v.id));

  if (selectedVariants.length === 0) {
    return { status: 'failed', mockups: [], error: 'No matching variants found' };
  }

  // Build placeholder images - only for selected placements
  const firstVariant = selectedVariants[0];
  const placeholders: any[] = [];
  const selectedPlacements = presetItem.placements || ['front'];

  if (firstVariant.placeholders) {
    for (const ph of firstVariant.placeholders) {
      if (!selectedPlacements.includes(ph.position)) continue;

      // Calculate scale to fit design within the print area
      let scale = 1;
      if (designWidth > 0 && designHeight > 0 && ph.width > 0 && ph.height > 0) {
        scale = Math.min(ph.width / designWidth, ph.height / designHeight);
        // Clamp scale to reasonable range
        scale = Math.min(scale, 1);
        scale = Math.max(scale, 0.1);
      }

      placeholders.push({
        position: ph.position,
        images: [{
          id: designImageId,
          x: 0.5,
          y: 0.5,
          scale,
          angle: 0,
        }],
      });
    }
  }

  // Fallback if no placeholders matched
  if (placeholders.length === 0) {
    placeholders.push({
      position: selectedPlacements[0] || 'front',
      images: [{
        id: designImageId,
        x: 0.5,
        y: 0.5,
        scale: 1,
        angle: 0,
      }],
    });
  }

  const productBody = {
    title: `_mockup_temp_${Date.now()}`,
    description: 'Temporary product for mockup generation',
    blueprint_id: presetItem.product_id,
    print_provider_id: printProviderId,
    variants: selectedVariants.map((v: any) => ({
      id: v.id,
      price: 100,
      is_enabled: true,
    })),
    print_areas: [{
      variant_ids: selectedVariantIds,
      placeholders,
    }],
  };

  let productId: string | null = null;

  try {
    // Create temporary product
    const product = await printifyClient.createProduct(shopId, productBody);
    productId = product.id;

    // Extract mockup images
    const mockups = (product.images || []).map((img: any) => ({
      src: img.src,
      variant_ids: img.variant_ids || [],
      is_default: img.is_default || false,
    }));

    console.log(`[Printify] Got ${mockups.length} mockups from product ${productId}`);

    // Delete the temporary product
    try {
      await printifyClient.deleteProduct(shopId, productId!);
    } catch (delErr: any) {
      console.warn(`[Printify] Failed to delete temp product ${productId}:`, delErr.message);
    }

    return { status: 'completed', mockups };
  } catch (err: any) {
    // Try to clean up if product was created
    if (productId) {
      try {
        await printifyClient.deleteProduct(shopId, productId);
      } catch { /* ignore */ }
    }

    const respData = err.response?.data;
    const status = err.response?.status;
    let errorMsg = err.message || 'Unknown error';
    if (respData) {
      if (typeof respData === 'string') {
        errorMsg = respData;
      } else if (respData.errors) {
        // Printify returns { errors: { field: ["message"] } }
        const msgs = Object.entries(respData.errors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ');
        errorMsg = msgs || JSON.stringify(respData);
      } else if (respData.message) {
        errorMsg = respData.message;
      } else if (Object.keys(respData).length > 0) {
        errorMsg = JSON.stringify(respData);
      }
    }
    if (status) errorMsg = `HTTP ${status}: ${errorMsg}`;
    console.error(`[Printify] Mockup generation failed:`, errorMsg);
    return {
      status: 'failed',
      mockups: [],
      error: errorMsg,
    };
  }
}

/**
 * Download mockup images to the output directory
 */
export async function downloadMockupImages(
  mockups: PrintifyMockupResult['mockups'],
  outputDir: string,
  productSlug: string,
): Promise<string[]> {
  const downloaded: string[] = [];
  const placementDir = path.join(outputDir, productSlug);
  fs.mkdirSync(placementDir, { recursive: true });

  for (let i = 0; i < mockups.length; i++) {
    const mockup = mockups[i];
    if (!mockup.src) continue;

    const ext = mockup.src.includes('.png') ? 'png' : 'jpg';
    const variantPart = mockup.variant_ids.slice(0, 2).join('-') || 'all';
    const filename = `mockup_${i + 1}_${variantPart}.${ext}`;
    const filepath = path.join(placementDir, filename);

    await downloadFile(mockup.src, filepath);
    downloaded.push(filepath);
  }

  return downloaded;
}

async function downloadFile(url: string, filepath: string): Promise<void> {
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 60000,
    headers: { 'User-Agent': 'PrintifyMockupTool/1.0' },
  });
  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
