import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { registerMyRequestsCommand } from '../../../src/slack/commands/myrequests';
import { _resetDb, getDb, createRequest, createTvRequest, updateRequestStatus } from '../../../src/db/index';
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

function mockCommandPayload(text: string, userId = 'U_TEST') {
  return {
    command: {
      text,
      user_id: userId,
      command: '/myrequests',
    },
    ack: mock(async () => {}),
    respond: mock(async (_payload: any) => {}),
  };
}

describe('/myrequests command', () => {
  let app: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    _resetDb();
    getDb(':memory:');
    app = createMockApp();
    registerMyRequestsCommand(app as any);
  });

  it('calls ack() immediately', async () => {
    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/myrequests')!({ command, ack, respond });
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('responds with no-requests message when user has no requests', async () => {
    const { command, ack, respond } = mockCommandPayload('', 'U_NOBODY');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.response_type).toBe('ephemeral');
    expect(lastCall.blocks).toBeDefined();
    expect(lastCall.blocks[0].text.text).toContain("haven't made any requests");
  });

  it('shows movie requests for the user', async () => {
    createRequest({ movie_title: 'The Batman', tmdb_id: 12345, year: 2022, requester_slack_id: 'U_TEST' });

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.blocks.length).toBeGreaterThan(1);
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('The Batman');
    expect(allText).toContain('2022');
  });

  it('shows TV requests for the user', async () => {
    createTvRequest({ show_title: 'Breaking Bad', tvdb_id: 81189, year: 2008, requester_slack_id: 'U_TEST' });

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('Breaking Bad');
    expect(allText).toContain(':tv:');
  });

  it('shows mixed movie and TV requests together', async () => {
    createRequest({ movie_title: 'Dune', tmdb_id: 1, year: 2021, requester_slack_id: 'U_TEST' });
    createTvRequest({ show_title: 'The Wire', tvdb_id: 2, year: 2002, requester_slack_id: 'U_TEST' });

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('Dune');
    expect(allText).toContain('The Wire');
  });

  it('does not show other users requests', async () => {
    createRequest({ movie_title: 'Dune', tmdb_id: 1, year: 2021, requester_slack_id: 'U_OTHER' });

    const { command, ack, respond } = mockCommandPayload('', 'U_TEST');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.blocks[0].text.text).toContain("haven't made any requests");
  });

  it('filters by status when valid status provided', async () => {
    createRequest({ movie_title: 'Pending Movie', tmdb_id: 1, year: 2020, requester_slack_id: 'U_TEST' });
    const req2 = createRequest({ movie_title: 'Approved Movie', tmdb_id: 2, year: 2021, requester_slack_id: 'U_TEST' });
    updateRequestStatus({ id: req2.id, status: 'approved', approver_slack_id: 'U_APP' });

    const { command, ack, respond } = mockCommandPayload('approved');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('Approved Movie');
    expect(allText).not.toContain('Pending Movie');
  });

  it('responds with error for invalid status filter', async () => {
    const { command, ack, respond } = mockCommandPayload('pnding');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.text).toContain('Unknown status');
    expect(lastCall.text).toContain('pnding');
    expect(lastCall.text).toContain('pending');
  });

  it('responds with ephemeral response_type', async () => {
    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.response_type).toBe('ephemeral');
  });

  it('responds with error message on unexpected failure', async () => {
    _resetDb();

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/myrequests')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall).toBeDefined();
  });
});
