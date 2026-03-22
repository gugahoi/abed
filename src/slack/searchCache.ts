import type { RadarrSearchResult } from '../radarr/types';

type CacheEntry = {
  results: RadarrSearchResult[];
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

export function storeResults(userId: string, results: RadarrSearchResult[]): void {
  cache.set(userId, {
    results,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function getResults(userId: string): RadarrSearchResult[] | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(userId);
    return null;
  }
  return entry.results;
}

export function clearResults(userId: string): void {
  cache.delete(userId);
}
