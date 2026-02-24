import { printifyClient } from './printifyClient.js';

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

export async function getBlueprints() {
  const cached = getCached<any[]>('printify:blueprints');
  if (cached) return cached;
  const blueprints = await printifyClient.getBlueprints();
  setCache('printify:blueprints', blueprints);
  return blueprints;
}

export async function getBlueprint(blueprintId: number) {
  const key = `printify:blueprint:${blueprintId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;
  const blueprint = await printifyClient.getBlueprint(blueprintId);
  setCache(key, blueprint);
  return blueprint;
}

export async function getBlueprintProviders(blueprintId: number) {
  const key = `printify:providers:${blueprintId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;
  const providers = await printifyClient.getBlueprintProviders(blueprintId);
  setCache(key, providers);
  return providers;
}

export async function getBlueprintVariants(blueprintId: number, providerId: number) {
  const key = `printify:variants:${blueprintId}:${providerId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;
  const variants = await printifyClient.getBlueprintVariants(blueprintId, providerId);
  setCache(key, variants);
  return variants;
}
