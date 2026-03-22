import { describe, it, expect, mock, beforeEach } from 'bun:test';

import { registerMovieCommand }       from '../../src/slack/commands/movie';
import { registerSelectMovieAction }  from '../../src/slack/actions/selectMovie';
import { registerApproveMovieAction } from '../../src/slack/actions/approveMovie';
import { registerRejectMovieAction }  from '../../src/slack/actions/rejectMovie';

import { storeResults, clearResults, getResults } from '../../src/slack/searchCache';
import { _resetDb, getDb, getRequestByTmdbId } from '../../src/db/index';
import { ACTION_IDS } from '../../src/slack/messages/index';
import type { RadarrSearchResult } from '../../src/radarr/types';

const APPROVAL_CHANNEL = 'C_APPROVAL';
const REQUESTER_ID     = 'U_REQUESTER';
const APPROVER_ID      = 'U_APPROVER';
const TMDB_ID          = 12345;

const mockMovie: RadarrSearchResult = {
  title:        'The Batman',
  year:         2022,
  tmdbId:       TMDB_ID,
  imdbId:       'tt1877830',
  remotePoster: 'https://example.com/poster.jpg',
  overview:     'Bruce Wayne fights crime.',
  titleSlug:    'the-batman',
  images:       [],
};

function createMockApp() {
  const handlers: Record<string, Function> = {};
  const commands: Record<string, Function> = {};
  return {
    action:     (id: string,  handler: Function) => { handlers[id]  = handler; },
    command:    (cmd: string, handler: Function) => { commands[cmd] = handler; },
    getHandler: (id: string)  => handlers[id],
    getCommand: (cmd: string) => commands[cmd],
  };
}

function createMockClient() {
  return {
    chat: {
      postMessage: mock(async (_: any) => ({ ts: '111.222', ok: true })),
      update:      mock(async (_: any) => ({ ok: true })),
    },
    conversations: {
      join: mock(async (_: any) => ({ ok: true })),
    },
  };
}

function createMockRadarrClient(movieExistsResult = false) {
  return {
    searchMovies: mock(async (_: string) => [mockMovie]),
    addMovie:     mock(async (_: any, __: number, ___: string) => ({
      id: 1, title: 'The Batman', year: 2022, tmdbId: TMDB_ID, monitored: true, status: 'released',
    })),
    movieExists:  mock(async (_: number) => movieExistsResult),
  };
}

function mockCommandPayload(text: string, userId = REQUESTER_ID) {
  return {
    command: { text, user_id: userId },
    ack:     mock(async () => {}),
    respond: mock(async (_: any) => {}),
  };
}

function mockActionPayload(actionId: string, value: string, userId = APPROVER_ID, client = createMockClient()) {
  const actions: any[] = actionId === ACTION_IDS.SELECT_MOVIE
    ? [{ action_id: actionId, selected_option: { value } }]
    : [{ action_id: actionId, value }];
  return {
    body:    { user: { id: userId }, actions },
    ack:     mock(async () => {}),
    respond: mock(async (_: any) => {}),
    client,
  };
}

const defaultApproveDeps = {
  approverSlackIds:  [APPROVER_ID],
  approvalChannelId: APPROVAL_CHANNEL,
  qualityProfileId:  1,
  rootFolderPath:    '/movies',
};

const defaultRejectDeps = {
  approverSlackIds:  [APPROVER_ID],
  approvalChannelId: APPROVAL_CHANNEL,
};

async function runSelectMovie(
  app: ReturnType<typeof createMockApp>,
  radarrClient: ReturnType<typeof createMockRadarrClient>,
  client = createMockClient(),
) {
  storeResults(REQUESTER_ID, [mockMovie]);
  registerSelectMovieAction(app as any, { radarrClient: radarrClient as any, approvalChannelId: APPROVAL_CHANNEL });
  const p = mockActionPayload(ACTION_IDS.SELECT_MOVIE, String(TMDB_ID), REQUESTER_ID, client);
  await app.getHandler(ACTION_IDS.SELECT_MOVIE)!({ body: p.body, ack: p.ack, respond: p.respond, client });
}

describe('End-to-end movie-request flow', () => {
  let app:          ReturnType<typeof createMockApp>;
  let radarrClient: ReturnType<typeof createMockRadarrClient>;

  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
    clearResults(REQUESTER_ID);
    app          = createMockApp();
    radarrClient = createMockRadarrClient(false);
  });

  it('Step 1: /movie command searches Radarr, caches results, responds with blocks', async () => {
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: APPROVAL_CHANNEL });
    const { command, ack, respond } = mockCommandPayload('The Batman', REQUESTER_ID);
    await app.getCommand('/movie')!({ command, ack, respond });

    expect(ack).toHaveBeenCalledTimes(1);
    expect(radarrClient.searchMovies).toHaveBeenCalledWith('The Batman');

    const cached = getResults(REQUESTER_ID);
    expect(cached).not.toBeNull();
    expect(cached?.[0]?.tmdbId).toBe(TMDB_ID);

    const respondCalls = (respond as ReturnType<typeof mock>).mock.calls;
    expect(respondCalls.length).toBeGreaterThanOrEqual(2);
    const lastRespondArg = (respondCalls[respondCalls.length - 1] ?? [])[0] as any;
    expect(lastRespondArg).toHaveProperty('blocks');
  });

  it('Step 2: selectMovie posts approval message and creates pending DB record', async () => {
    storeResults(REQUESTER_ID, [mockMovie]);
    registerSelectMovieAction(app as any, { radarrClient: radarrClient as any, approvalChannelId: APPROVAL_CHANNEL });

    const client = createMockClient();
    const { body, ack, respond } = mockActionPayload(ACTION_IDS.SELECT_MOVIE, String(TMDB_ID), REQUESTER_ID, client);
    await app.getHandler(ACTION_IDS.SELECT_MOVIE)!({ body, ack, respond, client });

    expect(ack).toHaveBeenCalledTimes(1);
    expect(radarrClient.movieExists).toHaveBeenCalledWith(TMDB_ID);
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: APPROVAL_CHANNEL }),
    );

    const dbRequest = getRequestByTmdbId(TMDB_ID);
    expect(dbRequest).not.toBeNull();
    expect(dbRequest!.movie_title).toBe('The Batman');
    expect(dbRequest!.requester_slack_id).toBe(REQUESTER_ID);
    expect(dbRequest!.slack_message_ts).toBe('111.222');
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('submitted for approval') }),
    );
  });

  it("Step 3 (approve): addMovie called, DB approved, requester DM'd", async () => {
    await runSelectMovie(app, radarrClient);
    registerApproveMovieAction(app as any, { ...defaultApproveDeps, radarrClient: radarrClient as any });

    const approveClient = createMockClient();
    const p = mockActionPayload(ACTION_IDS.APPROVE_MOVIE, String(TMDB_ID), APPROVER_ID, approveClient);
    await app.getHandler(ACTION_IDS.APPROVE_MOVIE)!({ body: p.body, ack: p.ack, respond: p.respond, client: approveClient });

    expect(radarrClient.addMovie).toHaveBeenCalledTimes(1);
    expect(radarrClient.addMovie).toHaveBeenCalledWith(
      expect.objectContaining({ tmdbId: TMDB_ID }),
      defaultApproveDeps.qualityProfileId,
      defaultApproveDeps.rootFolderPath,
    );

    const dbRequest = getRequestByTmdbId(TMDB_ID);
    expect(dbRequest!.status).toBe('approved');
    expect(dbRequest!.approver_slack_id).toBe(APPROVER_ID);
    expect(approveClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ channel: APPROVAL_CHANNEL, ts: '111.222' }),
    );
    expect(approveClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: REQUESTER_ID, text: expect.stringContaining('approved') }),
    );
  });

  it("Step 4 (reject): DB rejected, requester DM'd, addMovie NOT called", async () => {
    await runSelectMovie(app, radarrClient);
    registerRejectMovieAction(app as any, defaultRejectDeps);

    const rejectClient = createMockClient();
    const p = mockActionPayload(ACTION_IDS.REJECT_MOVIE, String(TMDB_ID), APPROVER_ID, rejectClient);
    await app.getHandler(ACTION_IDS.REJECT_MOVIE)!({ body: p.body, ack: p.ack, respond: p.respond, client: rejectClient });

    expect(radarrClient.addMovie).not.toHaveBeenCalled();

    const dbRequest = getRequestByTmdbId(TMDB_ID);
    expect(dbRequest!.status).toBe('rejected');
    expect(dbRequest!.approver_slack_id).toBe(APPROVER_ID);
    expect(rejectClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ channel: APPROVAL_CHANNEL, ts: '111.222' }),
    );
    expect(rejectClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: REQUESTER_ID, text: expect.stringContaining('rejected') }),
    );
  });

  it('Race-condition guard: second Approve after first calls addMovie only once', async () => {
    await runSelectMovie(app, radarrClient);
    registerApproveMovieAction(app as any, { ...defaultApproveDeps, radarrClient: radarrClient as any });

    const handler = app.getHandler(ACTION_IDS.APPROVE_MOVIE)!;

    const firstClient = createMockClient();
    const first = mockActionPayload(ACTION_IDS.APPROVE_MOVIE, String(TMDB_ID), APPROVER_ID, firstClient);
    await handler({ body: first.body, ack: first.ack, respond: first.respond, client: firstClient });

    const secondClient = createMockClient();
    const second = mockActionPayload(ACTION_IDS.APPROVE_MOVIE, String(TMDB_ID), APPROVER_ID, secondClient);
    await handler({ body: second.body, ack: second.ack, respond: second.respond, client: secondClient });

    expect(radarrClient.addMovie).toHaveBeenCalledTimes(1);
    expect(secondClient.chat.postMessage).not.toHaveBeenCalled();
  });
});

describe('IMDB movie-request flow', () => {
  let app:          ReturnType<typeof createMockApp>;
  let radarrClient: ReturnType<typeof createMockRadarrClient>;

  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
    clearResults(REQUESTER_ID);
    app          = createMockApp();
    radarrClient = createMockRadarrClient(false);
  });

  it('IMDB bare ID → approval posted, DB record has imdb_id set', async () => {
    radarrClient.searchMovies = mock(async (_: string) => [mockMovie]);
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: APPROVAL_CHANNEL });

    const client = createMockClient();
    const { command, ack, respond } = mockCommandPayload('tt1877830', REQUESTER_ID);
    await app.getCommand('/movie')!({ command, ack, respond, client });

    expect(radarrClient.searchMovies).toHaveBeenCalledWith('imdb:tt1877830');
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: APPROVAL_CHANNEL }),
    );
    const dbRecord = getRequestByTmdbId(TMDB_ID);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.imdb_id).toBe('tt1877830');
    expect(dbRecord!.requester_slack_id).toBe(REQUESTER_ID);
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('submitted for approval') }),
    );
  });

  it('IMDB flow → approve works end-to-end', async () => {
    radarrClient.searchMovies = mock(async (_: string) => [mockMovie]);
    registerMovieCommand(app as any, { radarrClient: radarrClient as any, approvalChannelId: APPROVAL_CHANNEL });
    registerApproveMovieAction(app as any, { ...defaultApproveDeps, radarrClient: radarrClient as any });

    const submitClient = createMockClient();
    const { command, ack, respond } = mockCommandPayload('tt1877830', REQUESTER_ID);
    await app.getCommand('/movie')!({ command, ack, respond, client: submitClient });

    const approveClient = createMockClient();
    const p = mockActionPayload(ACTION_IDS.APPROVE_MOVIE, String(TMDB_ID), APPROVER_ID, approveClient);
    await app.getHandler(ACTION_IDS.APPROVE_MOVIE)!({ body: p.body, ack: p.ack, respond: p.respond, client: approveClient });

    expect(radarrClient.addMovie).toHaveBeenCalledTimes(1);
    const dbRecord = getRequestByTmdbId(TMDB_ID);
    expect(dbRecord!.status).toBe('approved');
    expect(dbRecord!.imdb_id).toBe('tt1877830');
  });
});
