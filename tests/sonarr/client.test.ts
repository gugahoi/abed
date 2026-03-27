import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { SonarrClient } from '../../src/sonarr/client';
import { _setLoggerOutput, _setSecrets, _resetSecrets } from '../../src/logger';

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
    _resetSecrets();
    delete process.env['LOG_LEVEL'];
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
    const responseData = { id: 1, title: 'Breaking Bad', year: 2008, tvdbId: 81189, monitored: true, status: 'ended' };
    globalThis.fetch = asFetch(mock(async (_url: string | URL | Request, opts?: RequestInit) => {
      capturedBody = JSON.parse(opts?.body as string);
      return {
        ok: true,
        status: 201,
        json: () => Promise.resolve(responseData),
        text: () => Promise.resolve(JSON.stringify(responseData)),
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

describe('SonarrClient debug logging', () => {
  let client: SonarrClient;
  const captured: string[] = [];
  const mockSink = {
    debug: mock((msg: string) => { captured.push(msg); }),
    info:  mock((msg: string) => { captured.push(msg); }),
    warn:  mock((msg: string) => { captured.push(msg); }),
    error: mock((msg: string) => { captured.push(msg); }),
  };

  beforeEach(() => {
    captured.length = 0;
    mockSink.debug.mockClear();
    mockSink.info.mockClear();
    mockSink.warn.mockClear();
    mockSink.error.mockClear();
    _resetSecrets();
    process.env['LOG_LEVEL'] = 'debug';
    _setLoggerOutput(mockSink);
    client = new SonarrClient(BASE_URL, API_KEY);
  });

  afterEach(() => {
    delete process.env['LOG_LEVEL'];
    _resetSecrets();
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
  });

  it('logs HTTP request and response at debug level', async () => {
    globalThis.fetch = mockFetch([{ id: 1, title: 'Test', year: 2024, tvdbId: 1, titleSlug: 'test', seasons: [], images: [] }]);

    await client.searchSeries('test');

    const requestLog = captured.find(m => m.includes('HTTP request'));
    const responseLog = captured.find(m => m.includes('HTTP response'));
    expect(requestLog).toBeDefined();
    expect(requestLog).toContain('method="GET"');
    expect(requestLog).toContain('path="/series/lookup"');
    expect(responseLog).toBeDefined();
    expect(responseLog).toContain('status=200');
    expect(responseLog).toContain('elapsed=');
  });

  it('does not log at debug level when LOG_LEVEL=info', async () => {
    process.env['LOG_LEVEL'] = 'info';
    globalThis.fetch = mockFetch([]);

    await client.searchSeries('test');

    expect(mockSink.debug).not.toHaveBeenCalled();
  });

  it('redacts secrets in response body preview', async () => {
    _setSecrets([API_KEY]);
    globalThis.fetch = mockFetch({ secret: API_KEY });

    await client.getQualityProfiles();

    const responseLog = captured.find(m => m.includes('HTTP response'));
    expect(responseLog).toBeDefined();
    expect(responseLog).not.toContain(API_KEY);
    expect(responseLog).toContain('[REDACTED]');
  });

  it('truncates long response bodies', async () => {
    const longData = { data: 'x'.repeat(600) };
    globalThis.fetch = mockFetch(longData);

    await client.getQualityProfiles();

    const responseLog = captured.find(m => m.includes('HTTP response'));
    expect(responseLog).toBeDefined();
    expect(responseLog).toContain('...(truncated)');
  });

  it('includes elapsed time in error logs', async () => {
    globalThis.fetch = mockFetch({ message: 'Not Found' }, 404);

    await expect(client.searchSeries('test')).rejects.toThrow('Sonarr API error 404');

    const errorLog = captured.find(m => m.includes('Sonarr API error'));
    expect(errorLog).toBeDefined();
    expect(errorLog).toContain('elapsed=');
  });
});
