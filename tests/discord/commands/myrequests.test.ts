import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { executeMyRequestsCommand } from '../../../src/discord/commands/myrequests';
import { _resetDb, getDb, createRequest, createTvRequest } from '../../../src/db/index';

describe('/myrequests command (Discord)', () => {
  let mockInteraction: any;

  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
    
    mockInteraction = {
      user: { id: 'U123' },
      options: {
        getString: mock().mockReturnValue(null), // no status filter by default
      },
      deferReply: mock(),
      editReply: mock(),
    };
  });

  test('calls deferReply immediately', async () => {
    await executeMyRequestsCommand(mockInteraction);
    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  });

  test('responds with no-requests message when user has no requests', async () => {
    await executeMyRequestsCommand(mockInteraction);
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.embeds[0].data.description).toInclude('no requests');
  });

  test('shows mixed movie and TV requests together', async () => {
    createRequest({
      movie_title: 'The Matrix',
      tmdb_id: 123,
      year: 1999,
      requester_slack_id: 'U123',
      platform: 'discord',
    });
    
    createTvRequest({
      show_title: 'Breaking Bad',
      tvdb_id: 456,
      year: 2008,
      requester_slack_id: 'U123',
      platform: 'discord',
    });
    
    await executeMyRequestsCommand(mockInteraction);
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.embeds[0].data.title).toInclude('Your Requests (2)');
    expect(callArgs.embeds[0].data.fields.length).toBe(2);
  });
});
