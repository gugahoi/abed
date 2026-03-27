import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { registerMovieCommand } from '../../../src/slack/commands/movie';
import { getResults } from '../../../src/core/searchCache';
import { _resetDb, getDb } from '../../../src/db/index';
import { _setLoggerOutput } from '../../../src/logger';

function createMockApp() {
  const handlers: Record<string, Function> = {};
  return {
    command: (name: string, handler: Function) => {
      handlers[name] = handler;
    },
    getHandler: (name: string) => handlers[name],
  };
}

function createMockRadarrClient(searchResults: any[] = []) {
  return {
    searchMovies: mock(async (_query: string) => searchResults),
  };
}

function mockCommandPayload(text: string, userId = 'U_TEST') {
  return {
    command: {
      text,
      user_id: userId,
      command: '/movie',
    },
    ack: mock(async () => {}),
    respond: mock(async (_payload: any) => {}),
  };
}

const mockMovieResults = [
  {
    title: 'The Batman',
    year: 2022,
    tmdbId: 12345,
    titleSlug: 'the-batman',
    images: [],
  },
  {
    title: 'Batman Begins',
    year: 2005,
    tmdbId: 67890,
    titleSlug: 'batman-begins',
    images: [],
  },
];

const mockImdbMovie = {
  title: 'The Batman',
  year: 2022,
  tmdbId: 12345,
  imdbId: 'tt1877830',
  remotePoster: 'https://example.com/poster.jpg',
  overview: 'Bruce Wayne fights crime.',
  titleSlug: 'the-batman',
  images: [],
};

function createMockImdbClient() {
  return {
    chat: {
      postMessage: mock(async (_: any) => ({ ts: '111.222', ok: true })),
    },
    conversations: {
      join: mock(async (_: any) => ({ ok: true })),
    },
  };
}

describe('/movie command', () => {
  let app: ReturnType<typeof createMockApp>;
  let radarrClient: ReturnType<typeof createMockRadarrClient>;

  beforeEach(() => {
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    app = createMockApp();
    radarrClient = createMockRadarrClient(mockMovieResults);
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: 'C_APPROVAL' });
  });

  it('calls ack() immediately', async () => {
    const { command, ack, respond } = mockCommandPayload('batman');
    const handler = app.getHandler('/movie');
    await handler!({ command, ack, respond });
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('responds with error message when no query text', async () => {
    const { command, ack, respond } = mockCommandPayload('  ');
    const handler = app.getHandler('/movie');
    await handler!({ command, ack, respond });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Usage:') })
    );
    expect(radarrClient.searchMovies).not.toHaveBeenCalled();
  });

  it('searches Radarr with the query text', async () => {
    const { command, ack, respond } = mockCommandPayload('batman');
    const handler = app.getHandler('/movie');
    await handler!({ command, ack, respond });

    expect(radarrClient.searchMovies).toHaveBeenCalledWith('batman');
  });

  it('stores search results in cache keyed by userId', async () => {
    const { command, ack, respond } = mockCommandPayload('batman', 'U_TESTER');
    const handler = app.getHandler('/movie');
    await handler!({ command, ack, respond });

    const cached = getResults('U_TESTER');
    expect(cached).not.toBeNull();
    expect(cached![0]!.title).toBe('The Batman');
  });

  it('responds with blocks containing search results', async () => {
    const { command, ack, respond } = mockCommandPayload('batman');
    const handler = app.getHandler('/movie');
    await handler!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.blocks).toBeDefined();
    expect(lastCall.blocks.length).toBeGreaterThan(0);
  });

  it('responds with no-results message when Radarr returns empty', async () => {
    const emptyClient = createMockRadarrClient([]);
    registerMovieCommand(app as any, { radarrClient: emptyClient as any, approvalChannelId: 'C_APPROVAL' });

    const { command, ack, respond } = mockCommandPayload('xyznotamovie');
    const handler = app.getHandler('/movie');
    await handler!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.text).toContain('No results found');
  });

  it('responds with error message on Radarr failure', async () => {
    const failingClient = {
      searchMovies: mock(async () => { throw new Error('Connection refused'); }),
    };
    registerMovieCommand(app as any, { radarrClient: failingClient as any, approvalChannelId: 'C_APPROVAL' });

    const { command, ack, respond } = mockCommandPayload('batman');
    const handler = app.getHandler('/movie');
    await handler!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.text).toContain('Failed to search');
  });
});

describe('/movie command — IMDB detection', () => {
  let app: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
    app = createMockApp();
  });

  it('detects bare IMDB ID and calls searchMovies with imdb: prefix', async () => {
    const radarrClient = {
      searchMovies: mock(async (_: string) => [mockImdbMovie]),
      movieExists: mock(async (_: number) => false),
    };
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { command, ack, respond } = mockCommandPayload('tt1877830');
    await app.getHandler('/movie')!({ command, ack, respond, client: createMockImdbClient() });

    expect(radarrClient.searchMovies).toHaveBeenCalledWith('imdb:tt1877830');
  });

  it('detects full IMDB URL and extracts the ID correctly', async () => {
    const radarrClient = {
      searchMovies: mock(async (_: string) => [mockImdbMovie]),
      movieExists: mock(async (_: number) => false),
    };
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { command, ack, respond } = mockCommandPayload('https://www.imdb.com/title/tt1877830/');
    await app.getHandler('/movie')!({ command, ack, respond, client: createMockImdbClient() });

    expect(radarrClient.searchMovies).toHaveBeenCalledWith('imdb:tt1877830');
  });

  it('responds ephemerally when IMDB ID not found in Radarr', async () => {
    const radarrClient = {
      searchMovies: mock(async (_: string) => []),
      movieExists: mock(async (_: number) => false),
    };
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { command, ack, respond } = mockCommandPayload('tt9999999');
    await app.getHandler('/movie')!({ command, ack, respond, client: createMockImdbClient() });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('tt9999999') }),
    );
  });

  it('responds with already-in-library when IMDB movie exists in Radarr', async () => {
    const radarrClient = {
      searchMovies: mock(async (_: string) => [mockImdbMovie]),
      movieExists: mock(async (_: number) => true),
    };
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { command, ack, respond } = mockCommandPayload('tt1877830');
    await app.getHandler('/movie')!({ command, ack, respond, client: createMockImdbClient() });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('already in the library') }),
    );
  });

  it('responds with success message when IMDB movie is submitted for approval', async () => {
    const radarrClient = {
      searchMovies: mock(async (_: string) => [mockImdbMovie]),
      movieExists: mock(async (_: number) => false),
    };
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { command, ack, respond } = mockCommandPayload('tt1877830');
    await app.getHandler('/movie')!({ command, ack, respond, client: createMockImdbClient() });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('submitted for approval') }),
    );
  });

  it('plain title does NOT trigger IMDB path — uses normal search with cache', async () => {
    const radarrClient = {
      searchMovies: mock(async (_: string) => mockMovieResults),
      movieExists: mock(async (_: number) => false),
    };
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { command, ack, respond } = mockCommandPayload('The Batman', 'U_TITLE');
    await app.getHandler('/movie')!({ command, ack, respond, client: createMockImdbClient() });

    expect(radarrClient.searchMovies).toHaveBeenCalledWith('The Batman');
    const cached = getResults('U_TITLE');
    expect(cached).not.toBeNull();
  });
});
