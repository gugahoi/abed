import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { executeMovieCommand } from '../../../src/discord/commands/movie';
import type { RadarrClient } from '../../../src/radarr/client';

describe('/movie command (Discord)', () => {
  let mockInteraction: any;
  let mockRadarrClient: any;

  beforeEach(() => {
    mockInteraction = {
      user: { id: 'U123' },
      options: {
        getString: mock().mockReturnValue('The Matrix'),
      },
      deferReply: mock(),
      editReply: mock(),
    };

    mockRadarrClient = {
      searchMovies: mock(),
    };
  });

  test('calls deferReply immediately', async () => {
    mockRadarrClient.searchMovies.mockResolvedValue([]);
    await executeMovieCommand(mockInteraction, { radarrClient: mockRadarrClient as unknown as RadarrClient });
    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: 64 }); // Ephemeral
  });

  test('responds with no-results message when Radarr returns empty', async () => {
    mockRadarrClient.searchMovies.mockResolvedValue([]);
    await executeMovieCommand(mockInteraction, { radarrClient: mockRadarrClient as unknown as RadarrClient });
    
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.content).toInclude('No results found');
  });

  test('responds with search results when Radarr finds movies', async () => {
    mockRadarrClient.searchMovies.mockResolvedValue([
      { title: 'The Matrix', year: 1999, tmdbId: 603, remotePoster: 'url' },
    ]);
    
    await executeMovieCommand(mockInteraction, { radarrClient: mockRadarrClient as unknown as RadarrClient });
    
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArgs = mockInteraction.editReply.mock.calls[0][0];
    expect(callArgs.content).toInclude('Search results for');
    expect(callArgs.embeds).toBeDefined();
    expect(callArgs.components).toBeDefined();
  });
});
