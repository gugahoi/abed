import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { handleSelectMovie, handleSelectTv } from '../../../src/discord/actions/select';
import { _resetDb, getDb, getRequestByTmdbId, getTvRequestByTvdbId } from '../../../src/db/index';
import { storeResults, storeTvResults } from '../../../src/core/searchCache';
import type { RadarrClient } from '../../../src/radarr/client';
import type { SonarrClient } from '../../../src/sonarr/client';

describe('Discord Select Actions', () => {
  let mockInteraction: any;
  let mockRadarrClient: any;
  let mockSonarrClient: any;
  let mockChannel: any;

  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
    
    mockChannel = {
      send: mock().mockResolvedValue({ id: 'msg-123' }),
    };

    mockInteraction = {
      user: { id: 'U123' },
      values: [],
      customId: '',
      deferUpdate: mock(),
      followUp: mock(),
      client: {
        channels: {
          fetch: mock().mockResolvedValue(mockChannel),
        },
      },
    };

    mockRadarrClient = {
      movieExists: mock().mockResolvedValue(false),
    };

    mockSonarrClient = {
      seriesExists: mock().mockResolvedValue(false),
    };
  });

  describe('handleSelectMovie', () => {
    beforeEach(() => {
      mockInteraction.customId = 'select_movie';
      mockInteraction.values = ['123'];
    });

    test('responds ephemerally when cache is expired/missing', async () => {
      await handleSelectMovie(mockInteraction, { radarrClient: mockRadarrClient, approvalChannelId: 'C123' });
      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0][0];
      expect(args.content).toInclude('Search results expired');
    });

    test('responds ephemerally when movie already in library', async () => {
      storeResults('discord_U123', [{ title: 'The Matrix', year: 1999, tmdbId: 123, titleSlug: 'the-matrix', images: [] }]);
      mockRadarrClient.movieExists.mockResolvedValue(true);
      
      await handleSelectMovie(mockInteraction, { radarrClient: mockRadarrClient, approvalChannelId: 'C123' });
      
      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0][0];
      expect(args.content).toInclude('already in the library');
    });

    test('posts approval message to channel and stores DB request on happy path', async () => {
      storeResults('discord_U123', [{ title: 'The Matrix', year: 1999, tmdbId: 123, titleSlug: 'the-matrix', images: [] }]);
      
      await handleSelectMovie(mockInteraction, { radarrClient: mockRadarrClient, approvalChannelId: 'C123' });
      
      expect(mockChannel.send).toHaveBeenCalled();
      
      const req = getRequestByTmdbId(123);
      expect(req).toBeDefined();
      expect(req?.movie_title).toBe('The Matrix');
      expect(req?.slack_message_ts).toBe('msg-123'); // Discord Message ID stored here
      expect(req?.platform).toBe('discord');
    });
  });

  describe('handleSelectTv', () => {
    beforeEach(() => {
      mockInteraction.customId = 'select_tv';
      mockInteraction.values = ['456'];
    });

    test('posts approval message to channel and stores DB TV request on happy path', async () => {
      storeTvResults('discord_U123', [{ title: 'Breaking Bad', year: 2008, tvdbId: 456, titleSlug: 'breaking-bad', seasons: [], images: [] }]);
      
      await handleSelectTv(mockInteraction, { sonarrClient: mockSonarrClient, approvalChannelId: 'C123' });
      
      expect(mockChannel.send).toHaveBeenCalled();
      
      const req = getTvRequestByTvdbId(456);
      expect(req).toBeDefined();
      expect(req?.show_title).toBe('Breaking Bad');
      expect(req?.slack_message_ts).toBe('msg-123');
      expect(req?.platform).toBe('discord');
    });
  });
});
