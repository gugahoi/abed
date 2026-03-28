import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { executeTvCommand } from '../../../src/discord/commands/tv';
import type { SonarrClient } from '../../../src/sonarr/client';

describe('/tv command (Discord)', () => {
  let mockInteraction: any;
  let mockSonarrClient: any;

  beforeEach(() => {
    mockInteraction = {
      user: { id: 'U123' },
      options: {
        getString: mock().mockReturnValue('Breaking Bad'),
      },
      deferReply: mock(),
      editReply: mock(),
      reply: mock(),
    };

    mockSonarrClient = {
      searchSeries: mock(),
    };
  });

  test('responds with error if Sonarr is not configured', async () => {
    await executeTvCommand(mockInteraction, { sonarr: null });
    expect(mockInteraction.reply).toHaveBeenCalled();
    const callArgs = mockInteraction.reply.mock.calls[0][0];
    expect(callArgs.content).toInclude('not configured');
    expect(mockInteraction.deferReply).not.toHaveBeenCalled();
  });

  test('calls deferReply when Sonarr is configured', async () => {
    mockSonarrClient.searchSeries.mockResolvedValue([]);
    await executeTvCommand(mockInteraction, { sonarr: { sonarrClient: mockSonarrClient as unknown as SonarrClient } });
    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  });

  test('responds with no-results message when Sonarr returns empty', async () => {
    mockSonarrClient.searchSeries.mockResolvedValue([]);
    await executeTvCommand(mockInteraction, { sonarr: { sonarrClient: mockSonarrClient as unknown as SonarrClient } });
    
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.content).toInclude('No results found');
  });

  test('responds with search results when Sonarr finds shows', async () => {
    mockSonarrClient.searchSeries.mockResolvedValue([
      { title: 'Breaking Bad', year: 2008, tvdbId: 81189, seasons: [{ seasonNumber: 1 }], images: [], network: 'AMC' },
    ]);
    
    await executeTvCommand(mockInteraction, { sonarr: { sonarrClient: mockSonarrClient as unknown as SonarrClient } });
    
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.content).toInclude('Search results for');
    expect(callArgs.embeds).toBeDefined();
    expect(callArgs.components).toBeDefined();
  });
});
