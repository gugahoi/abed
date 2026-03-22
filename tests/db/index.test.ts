import { describe, it, expect, beforeEach } from 'bun:test';
import {
  getDb,
  _resetDb,
  createRequest,
  getRequest,
  getRequestByTmdbId,
  updateRequestStatus,
} from '../../src/db/index';

describe('database', () => {
  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
  });

  describe('createRequest', () => {
    it('creates a request with required fields', () => {
      const req = createRequest({
        movie_title: 'The Batman',
        tmdb_id: 12345,
        year: 2022,
        requester_slack_id: 'U123',
      });

      expect(req.id).toBeGreaterThan(0);
      expect(req.movie_title).toBe('The Batman');
      expect(req.tmdb_id).toBe(12345);
      expect(req.status).toBe('pending');
      expect(req.approver_slack_id).toBeNull();
    });

    it('creates a request with optional fields', () => {
      const req = createRequest({
        movie_title: 'Dune',
        tmdb_id: 438631,
        imdb_id: 'tt1160419',
        year: 2021,
        poster_url: 'https://example.com/poster.jpg',
        requester_slack_id: 'U456',
        slack_message_ts: '1234567890.123456',
      });

      expect(req.imdb_id).toBe('tt1160419');
      expect(req.poster_url).toBe('https://example.com/poster.jpg');
      expect(req.slack_message_ts).toBe('1234567890.123456');
    });
  });

  describe('getRequest', () => {
    it('returns null for non-existent id', () => {
      expect(getRequest(9999)).toBeNull();
    });

    it('returns the request by id', () => {
      const created = createRequest({
        movie_title: 'Inception',
        tmdb_id: 27205,
        year: 2010,
        requester_slack_id: 'U123',
      });
      const fetched = getRequest(created.id);
      expect(fetched?.movie_title).toBe('Inception');
    });
  });

  describe('getRequestByTmdbId', () => {
    it('returns null when no request exists for tmdbId', () => {
      expect(getRequestByTmdbId(99999)).toBeNull();
    });

    it('returns the most recent request for a tmdbId', () => {
      createRequest({ movie_title: 'Dune', tmdb_id: 438631, year: 2021, requester_slack_id: 'U1' });
      createRequest({ movie_title: 'Dune', tmdb_id: 438631, year: 2021, requester_slack_id: 'U2' });

      const result = getRequestByTmdbId(438631);
      expect(result).not.toBeNull();
      expect(result!.requester_slack_id).toBe('U2');
    });
  });

  describe('updateRequestStatus', () => {
    it('updates status to approved with approver_slack_id', () => {
      const req = createRequest({
        movie_title: 'The Batman',
        tmdb_id: 12345,
        year: 2022,
        requester_slack_id: 'U123',
      });

      const updated = updateRequestStatus({
        id: req.id,
        status: 'approved',
        approver_slack_id: 'U_APPROVER',
      });

      expect(updated.status).toBe('approved');
      expect(updated.approver_slack_id).toBe('U_APPROVER');
    });

    it('updates status to rejected', () => {
      const req = createRequest({
        movie_title: 'The Batman',
        tmdb_id: 12345,
        year: 2022,
        requester_slack_id: 'U123',
      });
      const updated = updateRequestStatus({ id: req.id, status: 'rejected' });
      expect(updated.status).toBe('rejected');
    });

    it('throws when request not found', () => {
      expect(() => updateRequestStatus({ id: 9999, status: 'approved' })).toThrow(
        'Request 9999 not found',
      );
    });

    it('updates slack_message_ts', () => {
      const req = createRequest({
        movie_title: 'The Batman',
        tmdb_id: 12345,
        year: 2022,
        requester_slack_id: 'U123',
      });
      const updated = updateRequestStatus({
        id: req.id,
        status: 'pending',
        slack_message_ts: '111.222',
      });
      expect(updated.slack_message_ts).toBe('111.222');
    });
  });
});
