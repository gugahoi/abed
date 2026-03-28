import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { registerQueueCommand } from '../../../src/slack/commands/queue';
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
      command: '/queue',
    },
    ack: mock(async () => {}),
    respond: mock(async (_payload: unknown) => {}),
  };
}

describe('/queue command', () => {
  let app: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    _resetDb();
    getDb(':memory:');
    app = createMockApp();
    registerQueueCommand(app as any);
  });

  it('calls ack() immediately', async () => {
    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/queue')!({ command, ack, respond });
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('responds with empty state when no requests exist', async () => {
    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.response_type).toBe('ephemeral');
    expect(lastCall.blocks).toBeDefined();
    expect(lastCall.blocks[0].text.text).toContain('No requests found');
  });

  it('responds with queue of all requests', async () => {
    createRequest({ movie_title: 'The Batman', tmdb_id: 12345, year: 2022, requester_slack_id: 'U_REQUESTER' });

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.blocks.length).toBeGreaterThan(1);
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('The Batman');
    expect(allText).toContain('2022');
  });

  it('responds with filtered queue when status provided', async () => {
    createRequest({ movie_title: 'Pending Movie', tmdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    const req2 = createRequest({ movie_title: 'Approved Movie', tmdb_id: 2, year: 2021, requester_slack_id: 'U2' });
    updateRequestStatus({ id: req2.id, status: 'approved', approver_slack_id: 'U_APP' });

    const { command, ack, respond } = mockCommandPayload('pending');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('Pending Movie');
    expect(allText).not.toContain('Approved Movie');
  });

  it('responds with error for invalid status filter', async () => {
    const { command, ack, respond } = mockCommandPayload('badstatus');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.text).toContain('badstatus');
    expect(lastCall.text).toContain('pending');
  });

  it('includes both movie and TV requests in results', async () => {
    createRequest({ movie_title: 'Dune', tmdb_id: 1, year: 2021, requester_slack_id: 'U1' });
    createTvRequest({ show_title: 'The Wire', tvdb_id: 2, year: 2002, requester_slack_id: 'U2' });

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('Dune');
    expect(allText).toContain('The Wire');
  });

  it('shows requester mentions in the output', async () => {
    createRequest({ movie_title: 'Inception', tmdb_id: 1, year: 2010, requester_slack_id: 'U_MENTION_ME' });

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    const allText = lastCall.blocks.map((b: any) => b.text?.text ?? '').join('\n');
    expect(allText).toContain('<@U_MENTION_ME>');
  });

  it('responds with ephemeral response_type', async () => {
    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall.response_type).toBe('ephemeral');
  });

  it('responds with error message on unexpected failure', async () => {
    _resetDb();

    const { command, ack, respond } = mockCommandPayload('');
    await app.getHandler('/queue')!({ command, ack, respond });

    const respondCalls = (respond as any).mock.calls;
    const lastCall = respondCalls[respondCalls.length - 1][0];
    expect(lastCall).toBeDefined();
  });
});
