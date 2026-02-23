import { printfulClient } from './printfulClient.js';

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

export async function getProducts() {
  const cached = getCached<any[]>('products');
  if (cached) return cached;
  const products = await printfulClient.getProducts();
  setCache('products', products);
  return products;
}

export async function getProduct(productId: number) {
  const key = `product:${productId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;
  const product = await printfulClient.getProduct(productId);
  setCache(key, product);
  return product;
}

export async function getProductPrintfiles(productId: number) {
  const key = `printfiles:${productId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;
  const printfiles = await printfulClient.getProductPrintfiles(productId);
  setCache(key, printfiles);
  return printfiles;
}

export async function getProductTemplates(productId: number) {
  const key = `templates:${productId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;
  const templates = await printfulClient.getProductTemplates(productId);
  setCache(key, templates);
  return templates;
}
