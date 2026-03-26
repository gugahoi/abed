import { describe, expect, test } from 'bun:test';
import {
  buildSearchResultsEmbed,
  buildApprovalRequestEmbed,
  buildApprovedEmbed,
  buildRejectedEmbed,
  buildTvSearchResultsEmbed,
  buildTvApprovalRequestEmbed,
  buildTvApprovedEmbed,
  buildTvRejectedEmbed,
  buildMyRequestsEmbed,
} from '../../src/discord/messages/index';

import type { RadarrSearchResult } from '../../src/radarr/types';
import type { SonarrSearchResult } from '../../src/sonarr/types';
import type { MovieRequest, TvRequest } from '../../src/db/types';

describe('Discord Message Builders', () => {
  describe('Movie Messages', () => {
    test('buildSearchResultsEmbed > returns no-results message when empty array', () => {
      const msg = buildSearchResultsEmbed([]);
      expect(msg.embeds.length).toBe(1);
      expect(msg.embeds[0].data.description).toInclude('No results found');
      expect(msg.components.length).toBe(0);
    });

    test('buildSearchResultsEmbed > returns embed + select menu for search results', () => {
      const results: RadarrSearchResult[] = [{ title: 'The Matrix', year: 1999, tmdbId: 123, titleSlug: 'the-matrix', images: [] }];
      const msg = buildSearchResultsEmbed(results);
      
      expect(msg.embeds.length).toBe(1);
      expect(msg.embeds[0].data.title).toBe('Movie Search Results');
      
      expect(msg.components.length).toBe(1);
      const row = msg.components[0].toJSON();
      expect(row.components[0].type).toBe(3); // StringSelect
      expect(row.components[0].custom_id).toBe('select_movie');
      // @ts-ignore
      expect(row.components[0].options[0].value).toBe('123');
    });

    test('buildApprovalRequestEmbed > includes title, year, requester, and buttons', () => {
      const movie: RadarrSearchResult = { title: 'The Matrix', year: 1999, tmdbId: 123, remotePoster: 'http://img.com/a.jpg', overview: 'A great movie.', titleSlug: 'the-matrix', images: [] };
      const msg = buildApprovalRequestEmbed(movie, 'U123');
      
      const embed = msg.embeds[0].data;
      expect(embed.title).toBe('Movie Request: The Matrix (1999)');
      expect(embed.description).toInclude('<@U123>');
      expect(embed.thumbnail?.url).toBe('http://img.com/a.jpg');
      expect(embed.fields?.[0].value).toBe('123'); // TMDB ID
      
      const row = msg.components[0].toJSON();
      expect(row.components.length).toBe(2);
      expect(row.components[0].type).toBe(2); // Button
      expect(row.components[0].custom_id).toBe('approve_movie_123');
      expect(row.components[1].custom_id).toBe('reject_movie_123');
    });

    test('buildApprovedEmbed > formats correctly', () => {
      const req: MovieRequest = { id: 1, movie_title: 'The Matrix', year: 1999, tmdb_id: 123, requester_slack_id: 'U123', status: 'approved', created_at: '', updated_at: '', poster_url: null, imdb_id: null, approver_slack_id: null, slack_message_ts: null, downloaded_notified: 0, platform: 'discord' };
      const msg = buildApprovedEmbed(req, 'A123');
      const embed = msg.embeds[0].data;
      
      expect(embed.title).toBe('Movie Request: The Matrix (1999)');
      expect(embed.fields?.[1].value).toInclude('Approved by <@A123>');
    });

    test('buildRejectedEmbed > formats correctly', () => {
      const req: MovieRequest = { id: 1, movie_title: 'The Matrix', year: 1999, tmdb_id: 123, requester_slack_id: 'U123', status: 'rejected', created_at: '', updated_at: '', poster_url: null, imdb_id: null, approver_slack_id: null, slack_message_ts: null, downloaded_notified: 0, platform: 'discord' };
      const msg = buildRejectedEmbed(req, 'A123');
      const embed = msg.embeds[0].data;
      
      expect(embed.title).toBe('Movie Request: The Matrix (1999)');
      expect(embed.fields?.[1].value).toInclude('Rejected by <@A123>');
    });
  });

  describe('TV Messages', () => {
    test('buildTvSearchResultsEmbed > returns no-results message when empty array', () => {
      const msg = buildTvSearchResultsEmbed([]);
      expect(msg.embeds[0].data.description).toInclude('No results found');
    });

    test('buildTvSearchResultsEmbed > returns embed + select menu for search results', () => {
      const results: SonarrSearchResult[] = [{ title: 'Breaking Bad', year: 2008, tvdbId: 456, titleSlug: 'bb', seasons: [], images: [] }];
      const msg = buildTvSearchResultsEmbed(results);
      
      const row = msg.components[0].toJSON();
      expect(row.components[0].custom_id).toBe('select_tv');
      // @ts-ignore
      expect(row.components[0].options[0].value).toBe('456');
    });

    test('buildTvApprovalRequestEmbed > includes buttons', () => {
      const show: SonarrSearchResult = { title: 'Breaking Bad', year: 2008, tvdbId: 456, titleSlug: 'bb', seasons: [], images: [] };
      const msg = buildTvApprovalRequestEmbed(show, 'U123');
      
      const row = msg.components[0].toJSON();
      expect(row.components[0].custom_id).toBe('approve_tv_456');
      expect(row.components[1].custom_id).toBe('reject_tv_456');
    });

    test('buildTvApprovedEmbed > formats correctly', () => {
      const req: TvRequest = { id: 1, show_title: 'Breaking Bad', year: 2008, tvdb_id: 456, requester_slack_id: 'U123', status: 'approved', created_at: '', updated_at: '', poster_url: null, approver_slack_id: null, slack_message_ts: null, downloaded_notified: 0, platform: 'discord' };
      const msg = buildTvApprovedEmbed(req, 'A123');
      expect(msg.embeds[0].data.fields?.[1].value).toInclude('Approved by <@A123>');
    });

    test('buildTvRejectedEmbed > formats correctly', () => {
      const req: TvRequest = { id: 1, show_title: 'Breaking Bad', year: 2008, tvdb_id: 456, requester_slack_id: 'U123', status: 'rejected', created_at: '', updated_at: '', poster_url: null, approver_slack_id: null, slack_message_ts: null, downloaded_notified: 0, platform: 'discord' };
      const msg = buildTvRejectedEmbed(req, 'A123');
      expect(msg.embeds[0].data.fields?.[1].value).toInclude('Rejected by <@A123>');
    });
  });

  describe('My Requests Message', () => {
    test('buildMyRequestsEmbed > returns empty state', () => {
      const msg = buildMyRequestsEmbed([]);
      expect(msg.embeds[0].data.description).toInclude('no requests matching');
    });

    test('buildMyRequestsEmbed > formats list of mixed requests', () => {
      const reqs: (MovieRequest | TvRequest)[] = [
        { id: 1, movie_title: 'The Matrix', year: 1999, tmdb_id: 123, requester_slack_id: 'U123', status: 'pending', created_at: '2023-01-01', updated_at: '', poster_url: null, imdb_id: null, approver_slack_id: null, slack_message_ts: null, downloaded_notified: 0, platform: 'discord' },
        { id: 2, show_title: 'Breaking Bad', year: 2008, tvdb_id: 456, requester_slack_id: 'U123', status: 'approved', created_at: '2023-01-02', updated_at: '', poster_url: null, approver_slack_id: null, slack_message_ts: null, downloaded_notified: 0, platform: 'discord' },
      ];
      
      const msg = buildMyRequestsEmbed(reqs);
      const embed = msg.embeds[0].data;
      
      expect(embed.title).toBe('Your Requests (2)');
      expect(embed.fields?.length).toBe(2);
      expect(embed.fields?.[0].name).toInclude('🎬 The Matrix (1999)');
      expect(embed.fields?.[0].value).toInclude('⏳ pending');
      expect(embed.fields?.[1].name).toInclude('📺 Breaking Bad (2008)');
      expect(embed.fields?.[1].value).toInclude('✅ approved');
    });
  });
});
