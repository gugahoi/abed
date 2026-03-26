import type { RadarrSearchResult } from '../radarr/types';
import type { SonarrSearchResult } from '../sonarr/types';

type MovieCacheEntry = {
  results: RadarrSearchResult[];
  expiresAt: number;
};

type TvCacheEntry = {
  results: SonarrSearchResult[];
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const movieCache = new Map<string, MovieCacheEntry>();
const tvCache = new Map<string, TvCacheEntry>();

export function storeResults(userId: string, results: RadarrSearchResult[]): void {
  movieCache.set(userId, {
    results,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function getResults(userId: string): RadarrSearchResult[] | null {
  const entry = movieCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    movieCache.delete(userId);
    return null;
  }
  return entry.results;
}

export function clearResults(userId: string): void {
  movieCache.delete(userId);
}

// TV cache

export function storeTvResults(userId: string, results: SonarrSearchResult[]): void {
  tvCache.set(userId, {
    results,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function getTvResults(userId: string): SonarrSearchResult[] | null {
  const entry = tvCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tvCache.delete(userId);
    return null;
  }
  return entry.results;
}

export function clearTvResults(userId: string): void {
  tvCache.delete(userId);
}
