import axios from 'axios';
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';
import { printfulClient, CreateTaskRequest } from './printfulClient.js';
import * as catalogService from './catalogService.js';
import { PresetItem } from '../repositories/presetRepository.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface TaskSubmission {
  presetItem: PresetItem;
  designUrl: string;
  designWidth: number;
  designHeight: number;
}

export interface TaskResult {
  taskKey: string;
  status: 'completed' | 'failed';
  mockups: Array<{
    placement: string;
    variant_ids: number[];
    mockup_url: string;
    extra: Array<{ url: string; title: string }>;
  }>;
  error?: string;
}

async function getPositionForPlacement(
  productId: number,
  variantId: number,
  placement: string,
  designWidth: number,
  designHeight: number,
): Promise<any | null> {
  const printfiles = await catalogService.getProductPrintfiles(productId);
  const templates = await catalogService.getProductTemplates(productId);

  // variant_printfiles is an array of { variant_id, placements: { front: printfile_id, ... } }
  const vpfList: any[] = Object.values(printfiles?.variant_printfiles || {});
  const vpf = vpfList.find((v: any) => v.variant_id === variantId);
  if (!vpf) return null;

  const printfileId = vpf.placements?.[placement];
  if (!printfileId) return null;

  // Find template matching this printfile_id
  const templateList: any[] = templates?.templates || [];
  const tmpl = templateList.find((t: any) => t.printfile_id === printfileId);
  if (!tmpl || !tmpl.print_area_width) return null;

  const areaW = tmpl.print_area_width;
  const areaH = tmpl.print_area_height;

  // Fit design into print area while maintaining aspect ratio
  let fitW: number, fitH: number;
  if (designWidth > 0 && designHeight > 0) {
    const designRatio = designWidth / designHeight;
    const areaRatio = areaW / areaH;
    if (designRatio > areaRatio) {
      // Design is wider → fit by width
      fitW = areaW;
      fitH = Math.round(areaW / designRatio);
    } else {
      // Design is taller → fit by height
      fitH = areaH;
      fitW = Math.round(areaH * designRatio);
    }
  } else {
    fitW = areaW;
    fitH = areaH;
  }

  // Center within print area
  const top = tmpl.print_area_top + Math.round((areaH - fitH) / 2);
  const left = tmpl.print_area_left + Math.round((areaW - fitW) / 2);

  return {
    area_width: areaW,
    area_height: areaH,
    width: fitW,
    height: fitH,
    top,
    left,
  };
}

export async function submitMockupTask(
  submission: TaskSubmission
): Promise<{ taskKey: string }> {
  const { presetItem, designUrl, designWidth, designHeight } = submission;

  // Use first variant to determine position
  const firstVariantId = presetItem.variant_ids[0];

  const files = [];
  for (const placement of presetItem.placements) {
    const userPos = (presetItem.position_config as any)?.[placement];
    const autoPos = userPos || await getPositionForPlacement(presetItem.product_id, firstVariantId, placement, designWidth, designHeight);

    const file: any = {
      placement,
      image_url: designUrl,
    };
    if (autoPos) {
      file.position = autoPos;
    }
    files.push(file);
  }

  const body: CreateTaskRequest = {
    variant_ids: presetItem.variant_ids,
    format: 'jpg',
    files,
  };

  const styleOpts = presetItem.mockup_style_options as any;
  if (styleOpts?.option_groups?.length) {
    body.option_groups = styleOpts.option_groups;
  }
  if (styleOpts?.options?.length) {
    body.options = styleOpts.options;
  }

  const result = await printfulClient.createMockupTask(presetItem.product_id, body);
  return { taskKey: result.task_key };
}

export async function pollForResult(
  taskKey: string,
  maxAttempts = 30
): Promise<TaskResult> {
  let delay = 2000;
  const maxDelay = 15000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(delay);
    const result = await printfulClient.getMockupTaskResult(taskKey);

    if (result.status === 'completed') {
      return {
        taskKey,
        status: 'completed',
        mockups: result.mockups || [],
      };
    }

    if (result.status === 'failed') {
      return {
        taskKey,
        status: 'failed',
        mockups: [],
        error: result.error || 'Mockup generation failed',
      };
    }

    delay = Math.min(delay * 1.5, maxDelay);
  }

  return {
    taskKey,
    status: 'failed',
    mockups: [],
    error: 'Polling timeout exceeded',
  };
}

export async function downloadMockupImages(
  mockups: TaskResult['mockups'],
  outputDir: string,
  productSlug: string,
): Promise<string[]> {
  const downloaded: string[] = [];

  for (const mockup of mockups) {
    const placement = mockup.placement || 'default';
    const placementDir = path.join(outputDir, productSlug, placement);
    fs.mkdirSync(placementDir, { recursive: true });

    const mainUrl = mockup.mockup_url;
    if (mainUrl) {
      const filename = `mockup_${mockup.variant_ids?.join('-') || 'all'}.jpg`;
      const filepath = path.join(placementDir, filename);
      await downloadFile(mainUrl, filepath);
      downloaded.push(filepath);
    }

    for (const extra of mockup.extra || []) {
      const extraSlug = slugify(extra.title || 'extra', { lower: true, strict: true });
      const filename = `${extraSlug}_${mockup.variant_ids?.join('-') || 'all'}.jpg`;
      const filepath = path.join(placementDir, filename);
      await downloadFile(extra.url, filepath);
      downloaded.push(filepath);
    }
  }

  return downloaded;
}

async function downloadFile(url: string, filepath: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'stream', timeout: 60000 });
  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
