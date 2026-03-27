import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { registerSelectTvAction } from '../../../src/slack/actions/selectTv';
import { storeTvResults, clearTvResults } from '../../../src/core/searchCache';
import { _resetDb, getDb, getTvRequestByTvdbId } from '../../../src/db/index';
import { ACTION_IDS } from '../../../src/slack/messages/index';
import { _setLoggerOutput } from '../../../src/logger';

function createMockApp() {
  const handlers: Record<string, Function> = {};
  return {
    action: (id: string, handler: Function) => { handlers[id] = handler; },
    getHandler: (id: string) => handlers[id],
  };
}

function mockActionPayload(tvdbIdStr: string, userId = 'U_TEST') {
  return {
    body: {
      user: { id: userId },
      actions: [{ action_id: ACTION_IDS.SELECT_TV, selected_option: { value: tvdbIdStr } }],
    },
    ack: mock(async () => {}),
    respond: mock(async (_: any) => {}),
    client: {
      chat: {
        postMessage: mock(async (_: any) => ({ ts: '111.222', ok: true })),
        update: mock(async (_: any) => ({ ok: true })),
      },
      conversations: {
        join: mock(async (_: any) => ({ ok: true })),
      },
    },
  };
}

const mockShow = {
  title: 'Breaking Bad',
  year: 2008,
  tvdbId: 81189,
  titleSlug: 'breaking-bad',
  overview: 'A high school chemistry teacher diagnosed with lung cancer.',
  network: 'AMC',
  seasons: [
    { seasonNumber: 0, monitored: false },
    { seasonNumber: 1, monitored: true },
    { seasonNumber: 2, monitored: true },
  ],
  images: [
    { coverType: 'poster', remoteUrl: 'https://example.com/poster.jpg' },
  ],
};

function createMockSonarrClient(exists = false) {
  return {
    seriesExists: mock(async (_: number) => exists),
    searchSeries: mock(async (_: string) => [mockShow]),
    addSeries: mock(async (_: any, __: number, ___: string) => ({
      id: 1, title: 'Breaking Bad', year: 2008, tvdbId: 81189, monitored: true, status: 'ended',
    })),
  };
}

describe('selectTv action', () => {
  let app: ReturnType<typeof createMockApp>;
  let sonarrClient: ReturnType<typeof createMockSonarrClient>;

  beforeEach(() => {
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    _resetDb();
    getDb(':memory:');
    app = createMockApp();
    sonarrClient = createMockSonarrClient(false);
    clearTvResults('U_TEST');
    clearTvResults('U_CACHED');
  });

  it('calls ack() immediately', async () => {
    storeTvResults('U_TEST', [mockShow]);
    registerSelectTvAction(app as any, { sonarrClient: sonarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { body, ack, respond, client } = mockActionPayload('81189');
    await app.getHandler(ACTION_IDS.SELECT_TV)!({ body, ack, respond, client });
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('responds ephemerally when cache is expired/missing', async () => {
    registerSelectTvAction(app as any, { sonarrClient: sonarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { body, ack, respond, client } = mockActionPayload('81189');
    await app.getHandler(ACTION_IDS.SELECT_TV)!({ body, ack, respond, client });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('expired') })
    );
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('responds ephemerally when show already in library', async () => {
    const existingClient = createMockSonarrClient(true);
    storeTvResults('U_TEST', [mockShow]);
    registerSelectTvAction(app as any, { sonarrClient: existingClient as any, approvalChannelId: 'C_APPROVAL' });
    const { body, ack, respond, client } = mockActionPayload('81189');
    await app.getHandler(ACTION_IDS.SELECT_TV)!({ body, ack, respond, client });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('already in the library') })
    );
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('posts approval message to approval channel on happy path', async () => {
    storeTvResults('U_TEST', [mockShow]);
    registerSelectTvAction(app as any, { sonarrClient: sonarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { body, ack, respond, client } = mockActionPayload('81189');
    await app.getHandler(ACTION_IDS.SELECT_TV)!({ body, ack, respond, client });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C_APPROVAL' })
    );
  });

  it('stores DB request and message ts on happy path', async () => {
    storeTvResults('U_TEST', [mockShow]);
    registerSelectTvAction(app as any, { sonarrClient: sonarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { body, ack, respond, client } = mockActionPayload('81189');
    await app.getHandler(ACTION_IDS.SELECT_TV)!({ body, ack, respond, client });

    const dbRequest = getTvRequestByTvdbId(81189);
    expect(dbRequest).not.toBeNull();
    expect(dbRequest!.show_title).toBe('Breaking Bad');
    expect(dbRequest!.slack_message_ts).toBe('111.222');
  });

  it('clears TV search cache after successful request', async () => {
    storeTvResults('U_TEST', [mockShow]);
    registerSelectTvAction(app as any, { sonarrClient: sonarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { body, ack, respond, client } = mockActionPayload('81189');
    await app.getHandler(ACTION_IDS.SELECT_TV)!({ body, ack, respond, client });

    const { getTvResults } = await import('../../../src/core/searchCache');
    expect(getTvResults('U_TEST')).toBeNull();
  });

  it('responds with confirmation after successful request', async () => {
    storeTvResults('U_TEST', [mockShow]);
    registerSelectTvAction(app as any, { sonarrClient: sonarrClient as any, approvalChannelId: 'C_APPROVAL' });
    const { body, ack, respond, client } = mockActionPayload('81189');
    await app.getHandler(ACTION_IDS.SELECT_TV)!({ body, ack, respond, client });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('submitted for approval') })
    );
  });
});
