import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { SonarrClient } from '../../src/sonarr/client';
import { _setLoggerOutput } from '../../src/logger';

const BASE_URL = 'http://localhost:8989';
const API_KEY = 'test-api-key';

function asFetch(fn: unknown): typeof fetch {
  return fn as unknown as typeof fetch;
}

function mockFetch(data: unknown, status = 200) {
  return asFetch(mock(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    } as Response)
  ));
}

describe('SonarrClient', () => {
  let client: SonarrClient;

  beforeEach(() => {
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    client = new SonarrClient(BASE_URL, API_KEY);
  });

  it('searchSeries - calls correct URL and returns results', async () => {
    const mockResults = [{ title: 'Breaking Bad', year: 2008, tvdbId: 81189, titleSlug: 'breaking-bad', seasons: [], images: [] }];
    globalThis.fetch = mockFetch(mockResults);

    const results = await client.searchSeries('breaking bad');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Breaking Bad');
  });

  it('searchSeries - sends correct API key header', async () => {
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = asFetch(mock(async (_url: string | URL | Request, opts?: RequestInit) => {
      capturedHeaders = new Headers(opts?.headers);
      return { ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') } as Response;
    }));

    await client.searchSeries('test');
    expect(capturedHeaders?.get('X-Api-Key')).toBe(API_KEY);
  });

  it('addSeries - sends POST with correct payload', async () => {
    let capturedBody: unknown;
    globalThis.fetch = asFetch(mock(async (_url: string | URL | Request, opts?: RequestInit) => {
      capturedBody = JSON.parse(opts?.body as string);
      return {
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 1, title: 'Breaking Bad', year: 2008, tvdbId: 81189, monitored: true, status: 'ended' }),
        text: () => Promise.resolve(''),
      } as Response;
    }));

    const series = { title: 'Breaking Bad', year: 2008, tvdbId: 81189, titleSlug: 'breaking-bad', seasons: [], images: [] };
    const result = await client.addSeries(series, 1, '/tv');

    expect((capturedBody as Record<string, unknown>).monitored).toBe(true);
    expect((capturedBody as Record<string, unknown>).qualityProfileId).toBe(1);
    expect((capturedBody as Record<string, unknown>).rootFolderPath).toBe('/tv');
    expect((capturedBody as Record<string, unknown>).seasonFolder).toBe(true);
    expect(((capturedBody as Record<string, unknown>).addOptions as Record<string, unknown>).monitor).toBe('all');
    expect(((capturedBody as Record<string, unknown>).addOptions as Record<string, unknown>).searchForMissingEpisodes).toBe(true);
    expect(result.id).toBe(1);
  });

  it('seriesExists - returns true when series found', async () => {
    const series = [{ id: 1, title: 'Breaking Bad', year: 2008, tvdbId: 81189, monitored: true, status: 'ended' }];
    globalThis.fetch = mockFetch(series);

    const exists = await client.seriesExists(81189);
    expect(exists).toBe(true);
  });

  it('seriesExists - returns false when empty array returned', async () => {
    globalThis.fetch = mockFetch([]);

    const exists = await client.seriesExists(99999);
    expect(exists).toBe(false);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mockFetch({ message: 'Not Found' }, 404);

    await expect(client.searchSeries('test')).rejects.toThrow('Sonarr API error 404');
  });

  it('getQualityProfiles - returns profiles', async () => {
    const profiles = [{ id: 1, name: 'Any' }, { id: 2, name: 'HD-1080p' }];
    globalThis.fetch = mockFetch(profiles);

    const result = await client.getQualityProfiles();
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Any');
  });

  it('getRootFolders - returns folders', async () => {
    const folders = [{ id: 1, path: '/tv', freeSpace: 100000 }];
    globalThis.fetch = mockFetch(folders);

    const result = await client.getRootFolders();
    expect(result[0]!.path).toBe('/tv');
  });
});
