import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { RadarrClient } from '../../src/radarr/client';
import { _setLoggerOutput } from '../../src/logger';

const BASE_URL = 'http://localhost:7878';
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

describe('RadarrClient', () => {
  let client: RadarrClient;

  beforeEach(() => {
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    client = new RadarrClient(BASE_URL, API_KEY);
  });

  it('searchMovies - calls correct URL and returns results', async () => {
    const mockResults = [{ title: 'The Batman', year: 2022, tmdbId: 12345, titleSlug: 'the-batman', images: [] }];
    globalThis.fetch = mockFetch(mockResults);

    const results = await client.searchMovies('batman');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('The Batman');
  });

  it('searchMovies - sends correct API key header', async () => {
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = asFetch(mock(async (_url: string | URL | Request, opts?: RequestInit) => {
      capturedHeaders = new Headers(opts?.headers);
      return { ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') } as Response;
    }));

    await client.searchMovies('test');
    expect(capturedHeaders?.get('X-Api-Key')).toBe(API_KEY);
  });

  it('addMovie - sends POST with correct payload', async () => {
    let capturedBody: unknown;
    globalThis.fetch = asFetch(mock(async (_url: string | URL | Request, opts?: RequestInit) => {
      capturedBody = JSON.parse(opts?.body as string);
      return {
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 1, title: 'The Batman', year: 2022, tmdbId: 12345, monitored: true, status: 'announced' }),
        text: () => Promise.resolve(''),
      } as Response;
    }));

    const movie = { title: 'The Batman', year: 2022, tmdbId: 12345, titleSlug: 'the-batman', images: [] };
    const result = await client.addMovie(movie, 1, '/movies');

    expect((capturedBody as Record<string, unknown>).monitored).toBe(true);
    expect((capturedBody as Record<string, unknown>).qualityProfileId).toBe(1);
    expect((capturedBody as Record<string, unknown>).rootFolderPath).toBe('/movies');
    expect((capturedBody as Record<string, unknown>).minimumAvailability).toBe('released');
    expect(result.id).toBe(1);
  });

  it('movieExists - returns true when movie in library', async () => {
    const movies = [{ id: 1, title: 'The Batman', year: 2022, tmdbId: 12345, monitored: true, status: 'downloaded' }];
    globalThis.fetch = mockFetch(movies);

    const exists = await client.movieExists(12345);
    expect(exists).toBe(true);
  });

  it('movieExists - returns false when movie not in library', async () => {
    globalThis.fetch = mockFetch([]);

    const exists = await client.movieExists(99999);
    expect(exists).toBe(false);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mockFetch({ message: 'Not Found' }, 404);

    await expect(client.searchMovies('test')).rejects.toThrow('Radarr API error 404');
  });

  it('getQualityProfiles - returns profiles', async () => {
    const profiles = [{ id: 1, name: 'Any' }, { id: 2, name: 'HD-1080p' }];
    globalThis.fetch = mockFetch(profiles);

    const result = await client.getQualityProfiles();
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Any');
  });

  it('getRootFolders - returns folders', async () => {
    const folders = [{ id: 1, path: '/movies', freeSpace: 100000 }];
    globalThis.fetch = mockFetch(folders);

    const result = await client.getRootFolders();
    expect(result[0]!.path).toBe('/movies');
  });
});
