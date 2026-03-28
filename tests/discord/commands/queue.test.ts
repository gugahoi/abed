import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { executeQueueCommand } from '../../../src/discord/commands/queue';
import { _resetDb, getDb, createRequest, createTvRequest, updateRequestStatus } from '../../../src/db/index';

describe('/queue command (Discord)', () => {
  let mockInteraction: any;

  beforeEach(() => {
    _resetDb();
    getDb(':memory:');

    mockInteraction = {
      user: { id: 'U123' },
      options: {
        getString: mock().mockReturnValue(null),
      },
      deferReply: mock(),
      editReply: mock(),
    };
  });

  test('calls deferReply immediately', async () => {
    await executeQueueCommand(mockInteraction);
    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  });

  test('responds with empty state when no requests exist', async () => {
    await executeQueueCommand(mockInteraction);
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.embeds[0].data.description).toInclude('No requests found');
  });

  test('responds with queue embed showing all requests', async () => {
    createRequest({
      movie_title: 'Interstellar',
      tmdb_id: 157336,
      year: 2014,
      requester_slack_id: 'U123',
      platform: 'discord',
    });

    await executeQueueCommand(mockInteraction);
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.embeds[0].data.title).toInclude('Request Queue');
    expect(callArgs.embeds[0].data.fields.length).toBeGreaterThan(0);
  });

  test('responds with filtered queue when status option provided', async () => {
    mockInteraction.options.getString = mock().mockReturnValue('pending');

    createRequest({ movie_title: 'Pending Movie', tmdb_id: 1, year: 2020, requester_slack_id: 'U123', platform: 'discord' });
    const req2 = createRequest({ movie_title: 'Approved Movie', tmdb_id: 2, year: 2021, requester_slack_id: 'U123', platform: 'discord' });
    updateRequestStatus({ id: req2.id, status: 'approved', approver_slack_id: 'U_APP' });

    await executeQueueCommand(mockInteraction);
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    const fields = callArgs.embeds[0].data.fields;
    const fieldNames = fields.map((f: any) => f.name).join('\n');
    expect(fieldNames).toInclude('Pending Movie');
    expect(fieldNames).not.toInclude('Approved Movie');
  });

  test('includes requester mentions in embed fields', async () => {
    createRequest({
      movie_title: 'The Matrix',
      tmdb_id: 603,
      year: 1999,
      requester_slack_id: 'U_MENTION_ME',
      platform: 'discord',
    });

    await executeQueueCommand(mockInteraction);
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    const fieldValues = callArgs.embeds[0].data.fields.map((f: any) => f.value).join('\n');
    expect(fieldValues).toInclude('<@U_MENTION_ME>');
  });

  test('includes both movie and TV requests in embed', async () => {
    createRequest({ movie_title: 'Dune', tmdb_id: 1, year: 2021, requester_slack_id: 'U1', platform: 'discord' });
    createTvRequest({ show_title: 'The Wire', tvdb_id: 2, year: 2002, requester_slack_id: 'U2', platform: 'discord' });

    await executeQueueCommand(mockInteraction);
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    const fieldNames = callArgs.embeds[0].data.fields.map((f: any) => f.name).join('\n');
    expect(fieldNames).toInclude('Dune');
    expect(fieldNames).toInclude('The Wire');
  });
});
