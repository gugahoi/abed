import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { handleMovieCarouselNav, handleTvCarouselNav, handleMovieCarouselRequest, handleTvCarouselRequest } from '../../../src/discord/actions/navigate';
import { _resetDb, getDb, getRequestByTmdbId, getTvRequestByTvdbId } from '../../../src/db/index';
import { storeResults, clearResults, storeTvResults, clearTvResults } from '../../../src/core/searchCache';
import { _setLoggerOutput } from '../../../src/logger';

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('Discord Navigate Actions', () => {
  let mockChannel: any;
  let mockInteraction: any;
  let mockRadarrClient: any;
  let mockSonarrClient: any;

  beforeEach(() => {
    _setLoggerOutput(silentLogger);
    _resetDb();
    getDb(':memory:');
    clearResults('discord_U123');
    clearTvResults('discord_U123');

    mockChannel = {
      send: mock().mockResolvedValue({ id: 'msg-456' }),
    };

    mockInteraction = {
      user: { id: 'U123' },
      customId: '',
      deferUpdate: mock().mockResolvedValue(undefined),
      update: mock().mockResolvedValue(undefined),
      followUp: mock().mockResolvedValue(undefined),
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

  describe('handleMovieCarouselNav', () => {
    test('cache expired → deferUpdate then followUp with expired message', async () => {
      mockInteraction.customId = 'movie_next_0';

      await handleMovieCarouselNav(mockInteraction);

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('expired');
      expect(mockInteraction.update).not.toHaveBeenCalled();
    });

    test('next from index 0 → calls update with page 1 data', async () => {
      storeResults('discord_U123', [
        { title: 'Movie A', year: 2020, tmdbId: 1, titleSlug: 'movie-a', images: [] },
        { title: 'Movie B', year: 2021, tmdbId: 2, titleSlug: 'movie-b', images: [] },
      ]);
      mockInteraction.customId = 'movie_next_0';

      await handleMovieCarouselNav(mockInteraction);

      expect(mockInteraction.update).toHaveBeenCalled();
      expect(mockInteraction.deferUpdate).not.toHaveBeenCalled();
      const updateArgs = mockInteraction.update.mock.calls[0]![0];
      expect(updateArgs.embeds).toBeDefined();
      expect(updateArgs.components).toBeDefined();
    });

    test('prev from index 3 → calls update with page 2 data', async () => {
      storeResults('discord_U123', [
        { title: 'Movie A', year: 2020, tmdbId: 1, titleSlug: 'movie-a', images: [] },
        { title: 'Movie B', year: 2021, tmdbId: 2, titleSlug: 'movie-b', images: [] },
        { title: 'Movie C', year: 2022, tmdbId: 3, titleSlug: 'movie-c', images: [] },
        { title: 'Movie D', year: 2023, tmdbId: 4, titleSlug: 'movie-d', images: [] },
      ]);
      mockInteraction.customId = 'movie_prev_3';

      await handleMovieCarouselNav(mockInteraction);

      expect(mockInteraction.update).toHaveBeenCalled();
      expect(mockInteraction.deferUpdate).not.toHaveBeenCalled();
    });

    test('out-of-bounds prev (index 0) → silently deferUpdate and return', async () => {
      storeResults('discord_U123', [
        { title: 'Movie A', year: 2020, tmdbId: 1, titleSlug: 'movie-a', images: [] },
      ]);
      mockInteraction.customId = 'movie_prev_0';

      await handleMovieCarouselNav(mockInteraction);

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.update).not.toHaveBeenCalled();
      expect(mockInteraction.followUp).not.toHaveBeenCalled();
    });

    test('out-of-bounds next (last index) → silently deferUpdate and return', async () => {
      storeResults('discord_U123', [
        { title: 'Movie A', year: 2020, tmdbId: 1, titleSlug: 'movie-a', images: [] },
        { title: 'Movie B', year: 2021, tmdbId: 2, titleSlug: 'movie-b', images: [] },
      ]);
      mockInteraction.customId = 'movie_next_1';

      await handleMovieCarouselNav(mockInteraction);

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.update).not.toHaveBeenCalled();
      expect(mockInteraction.followUp).not.toHaveBeenCalled();
    });
  });

  describe('handleTvCarouselNav', () => {
    test('cache expired → deferUpdate then followUp with expired message', async () => {
      mockInteraction.customId = 'tv_next_0';

      await handleTvCarouselNav(mockInteraction);

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('expired');
      expect(mockInteraction.update).not.toHaveBeenCalled();
    });

    test('next from index 0 → calls update with page 1 data', async () => {
      storeTvResults('discord_U123', [
        { title: 'Show A', year: 2020, tvdbId: 10, titleSlug: 'show-a', seasons: [], images: [] },
        { title: 'Show B', year: 2021, tvdbId: 11, titleSlug: 'show-b', seasons: [], images: [] },
      ]);
      mockInteraction.customId = 'tv_next_0';

      await handleTvCarouselNav(mockInteraction);

      expect(mockInteraction.update).toHaveBeenCalled();
      expect(mockInteraction.deferUpdate).not.toHaveBeenCalled();
      const updateArgs = mockInteraction.update.mock.calls[0]![0];
      expect(updateArgs.embeds).toBeDefined();
      expect(updateArgs.components).toBeDefined();
    });

    test('out-of-bounds (prev from 0) → silently deferUpdate and return', async () => {
      storeTvResults('discord_U123', [
        { title: 'Show A', year: 2020, tvdbId: 10, titleSlug: 'show-a', seasons: [], images: [] },
      ]);
      mockInteraction.customId = 'tv_prev_0';

      await handleTvCarouselNav(mockInteraction);

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.update).not.toHaveBeenCalled();
      expect(mockInteraction.followUp).not.toHaveBeenCalled();
    });
  });

  describe('handleMovieCarouselRequest', () => {
    test('cache expired → deferUpdate then followUp with expired message', async () => {
      mockInteraction.customId = 'movie_request_0';

      await handleMovieCarouselRequest(mockInteraction, {
        radarrClient: mockRadarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('expired');
    });

    test('movie already in library → ephemeral "already in library" message', async () => {
      storeResults('discord_U123', [
        { title: 'The Matrix', year: 1999, tmdbId: 123, titleSlug: 'the-matrix', images: [] },
      ]);
      mockRadarrClient.movieExists.mockResolvedValue(true);
      mockInteraction.customId = 'movie_request_0';

      await handleMovieCarouselRequest(mockInteraction, {
        radarrClient: mockRadarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('already in the library');
    });

    test('happy path → posts approval embed to channel, creates DB record with correct fields, clears cache', async () => {
      storeResults('discord_U123', [
        { title: 'Inception', year: 2010, tmdbId: 999, titleSlug: 'inception', images: [] },
      ]);
      mockInteraction.customId = 'movie_request_0';

      await handleMovieCarouselRequest(mockInteraction, {
        radarrClient: mockRadarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockChannel.send).toHaveBeenCalled();

      const req = getRequestByTmdbId(999);
      expect(req).toBeDefined();
      expect(req?.movie_title).toBe('Inception');
      expect(req?.tmdb_id).toBe(999);
      expect(req?.slack_message_ts).toBe('msg-456');
      expect(req?.requester_slack_id).toBe('U123');
      expect(req?.platform).toBe('discord');

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('submitted for approval');
    });

    test('API error → ephemeral error message', async () => {
      storeResults('discord_U123', [
        { title: 'Inception', year: 2010, tmdbId: 999, titleSlug: 'inception', images: [] },
      ]);
      mockRadarrClient.movieExists.mockRejectedValue(new Error('Radarr down'));
      mockInteraction.customId = 'movie_request_0';

      await handleMovieCarouselRequest(mockInteraction, {
        radarrClient: mockRadarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('Something went wrong');
    });

    test('index out of range → deferUpdate then ephemeral error', async () => {
      storeResults('discord_U123', [
        { title: 'Inception', year: 2010, tmdbId: 999, titleSlug: 'inception', images: [] },
      ]);
      mockInteraction.customId = 'movie_request_5';

      await handleMovieCarouselRequest(mockInteraction, {
        radarrClient: mockRadarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('Could not find');
    });
  });

  describe('handleTvCarouselRequest', () => {
    test('no sonarrClient → deferUpdate and return immediately', async () => {
      mockInteraction.customId = 'tv_request_0';

      await handleTvCarouselRequest(mockInteraction, {
        sonarrClient: null,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.followUp).not.toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    test('cache expired → deferUpdate then followUp with expired message', async () => {
      mockInteraction.customId = 'tv_request_0';

      await handleTvCarouselRequest(mockInteraction, {
        sonarrClient: mockSonarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('expired');
    });

    test('happy path → posts approval, creates DB record, clears cache', async () => {
      storeTvResults('discord_U123', [
        { title: 'Breaking Bad', year: 2008, tvdbId: 456, titleSlug: 'breaking-bad', seasons: [], images: [] },
      ]);
      mockInteraction.customId = 'tv_request_0';

      await handleTvCarouselRequest(mockInteraction, {
        sonarrClient: mockSonarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockChannel.send).toHaveBeenCalled();

      const req = getTvRequestByTvdbId(456);
      expect(req).toBeDefined();
      expect(req?.show_title).toBe('Breaking Bad');
      expect(req?.tvdb_id).toBe(456);
      expect(req?.slack_message_ts).toBe('msg-456');
      expect(req?.requester_slack_id).toBe('U123');
      expect(req?.platform).toBe('discord');

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('submitted for approval');
    });

    test('show already in library → ephemeral "already in library" message', async () => {
      storeTvResults('discord_U123', [
        { title: 'Breaking Bad', year: 2008, tvdbId: 456, titleSlug: 'breaking-bad', seasons: [], images: [] },
      ]);
      mockSonarrClient.seriesExists.mockResolvedValue(true);
      mockInteraction.customId = 'tv_request_0';

      await handleTvCarouselRequest(mockInteraction, {
        sonarrClient: mockSonarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('already in the library');
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    test('API error → ephemeral error message', async () => {
      storeTvResults('discord_U123', [
        { title: 'Breaking Bad', year: 2008, tvdbId: 456, titleSlug: 'breaking-bad', seasons: [], images: [] },
      ]);
      mockSonarrClient.seriesExists.mockRejectedValue(new Error('Sonarr down'));
      mockInteraction.customId = 'tv_request_0';

      await handleTvCarouselRequest(mockInteraction, {
        sonarrClient: mockSonarrClient,
        approvalChannelId: 'CH123',
      });

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const args = mockInteraction.followUp.mock.calls[0]![0];
      expect(args.content).toInclude('Something went wrong');
    });
  });
});
