import { describe, it, expect, beforeEach } from 'bun:test';
import {
  getDb,
  _resetDb,
  createRequest,
  getRequest,
  getRequestByTmdbId,
  updateRequestStatus,
  createTvRequest,
  getTvRequest,
  getTvRequestByTvdbId,
  updateTvRequestStatus,
  getRequestsByUserId,
  getTvRequestsByUserId,
  getAllRequests,
  getAllTvRequests,
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

describe('database — tv_requests', () => {
  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
  });

  it('createTvRequest returns a TvRequest with correct fields', () => {
    const req = createTvRequest({
      show_title: 'Breaking Bad',
      tvdb_id: 81189,
      year: 2008,
      requester_slack_id: 'U123',
    });

    expect(req.id).toBeGreaterThan(0);
    expect(req.show_title).toBe('Breaking Bad');
    expect(req.tvdb_id).toBe(81189);
    expect(req.year).toBe(2008);
    expect(req.status).toBe('pending');
    expect(req.approver_slack_id).toBeNull();
    expect(req.poster_url).toBeNull();
    expect(req.slack_message_ts).toBeNull();
  });

  it('getTvRequest returns request by id', () => {
    const created = createTvRequest({
      show_title: 'Breaking Bad',
      tvdb_id: 81189,
      year: 2008,
      requester_slack_id: 'U123',
    });
    const fetched = getTvRequest(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.show_title).toBe('Breaking Bad');
  });

  it('getTvRequest returns null for nonexistent id', () => {
    expect(getTvRequest(9999)).toBeNull();
  });

  it('getTvRequestByTvdbId returns latest request for tvdb_id', () => {
    createTvRequest({ show_title: 'Breaking Bad', tvdb_id: 81189, year: 2008, requester_slack_id: 'U1' });
    createTvRequest({ show_title: 'Breaking Bad', tvdb_id: 81189, year: 2008, requester_slack_id: 'U2' });

    const result = getTvRequestByTvdbId(81189);
    expect(result).not.toBeNull();
    expect(result!.requester_slack_id).toBe('U2');
  });

  it('updateTvRequestStatus updates status and approver', () => {
    const req = createTvRequest({
      show_title: 'Breaking Bad',
      tvdb_id: 81189,
      year: 2008,
      requester_slack_id: 'U123',
    });

    const updated = updateTvRequestStatus({
      id: req.id,
      status: 'approved',
      approver_slack_id: 'U_APPROVER',
    });

    expect(updated.status).toBe('approved');
    expect(updated.approver_slack_id).toBe('U_APPROVER');
  });

  it('updateTvRequestStatus throws for nonexistent id', () => {
    expect(() => updateTvRequestStatus({ id: 9999, status: 'approved' })).toThrow(
      'TV request 9999 not found',
    );
  });
});

describe('getRequestsByUserId', () => {
  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
  });

  it('returns empty array for unknown user', () => {
    expect(getRequestsByUserId('U_NOBODY')).toEqual([]);
  });

  it('returns only the requesting users requests', () => {
    createRequest({ movie_title: 'Dune', tmdb_id: 1, year: 2021, requester_slack_id: 'U1' });
    createRequest({ movie_title: 'Tenet', tmdb_id: 2, year: 2020, requester_slack_id: 'U2' });

    const results = getRequestsByUserId('U1');
    expect(results).toHaveLength(1);
    expect(results[0]!.movie_title).toBe('Dune');
  });

  it('returns requests ordered by created_at DESC', async () => {
    const req1 = createRequest({ movie_title: 'Movie A', tmdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    await new Promise(resolve => setTimeout(resolve, 10));
    const req2 = createRequest({ movie_title: 'Movie B', tmdb_id: 2, year: 2021, requester_slack_id: 'U1' });

    const results = getRequestsByUserId('U1');
    expect(results).toHaveLength(2);
    const newerReq = req2.created_at > req1.created_at ? req2 : req1;
    const olderReq = req2.created_at > req1.created_at ? req1 : req2;
    expect(results[0]!.id).toBe(newerReq.id);
    expect(results[1]!.id).toBe(olderReq.id);
  });

  it('filters by status when provided', () => {
    createRequest({ movie_title: 'Pending Movie', tmdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    const req2 = createRequest({ movie_title: 'Approved Movie', tmdb_id: 2, year: 2021, requester_slack_id: 'U1' });
    updateRequestStatus({ id: req2.id, status: 'approved', approver_slack_id: 'U_APP' });

    const pending = getRequestsByUserId('U1', 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.movie_title).toBe('Pending Movie');

    const approved = getRequestsByUserId('U1', 'approved');
    expect(approved).toHaveLength(1);
    expect(approved[0]!.movie_title).toBe('Approved Movie');
  });

  it('limits results to 15', () => {
    for (let i = 0; i < 20; i++) {
      createRequest({ movie_title: `Movie ${i}`, tmdb_id: i, year: 2020, requester_slack_id: 'U1' });
    }
    const results = getRequestsByUserId('U1');
    expect(results).toHaveLength(15);
  });
});

describe('getTvRequestsByUserId', () => {
  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
  });

  it('returns empty array for unknown user', () => {
    expect(getTvRequestsByUserId('U_NOBODY')).toEqual([]);
  });

  it('returns only the requesting users requests', () => {
    createTvRequest({ show_title: 'Breaking Bad', tvdb_id: 1, year: 2008, requester_slack_id: 'U1' });
    createTvRequest({ show_title: 'The Wire', tvdb_id: 2, year: 2002, requester_slack_id: 'U2' });

    const results = getTvRequestsByUserId('U1');
    expect(results).toHaveLength(1);
    expect(results[0]!.show_title).toBe('Breaking Bad');
  });

  it('returns requests ordered by created_at DESC', async () => {
    const req1 = createTvRequest({ show_title: 'Show A', tvdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    await new Promise(resolve => setTimeout(resolve, 10));
    const req2 = createTvRequest({ show_title: 'Show B', tvdb_id: 2, year: 2021, requester_slack_id: 'U1' });

    const results = getTvRequestsByUserId('U1');
    expect(results).toHaveLength(2);
    const newerReq = req2.created_at > req1.created_at ? req2 : req1;
    const olderReq = req2.created_at > req1.created_at ? req1 : req2;
    expect(results[0]!.id).toBe(newerReq.id);
    expect(results[1]!.id).toBe(olderReq.id);
  });

  it('filters by status when provided', () => {
    createTvRequest({ show_title: 'Pending Show', tvdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    const req2 = createTvRequest({ show_title: 'Approved Show', tvdb_id: 2, year: 2021, requester_slack_id: 'U1' });
    updateTvRequestStatus({ id: req2.id, status: 'approved', approver_slack_id: 'U_APP' });

    const pending = getTvRequestsByUserId('U1', 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.show_title).toBe('Pending Show');
  });

  it('limits results to 15', () => {
    for (let i = 0; i < 20; i++) {
      createTvRequest({ show_title: `Show ${i}`, tvdb_id: i, year: 2020, requester_slack_id: 'U1' });
    }
    const results = getTvRequestsByUserId('U1');
    expect(results).toHaveLength(15);
  });
});

describe('getAllRequests', () => {
  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
  });

  it('returns empty array when no requests exist', () => {
    expect(getAllRequests()).toEqual([]);
  });

  it('returns all movie requests ordered by created_at DESC', () => {
    createRequest({ movie_title: 'Movie A', tmdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    createRequest({ movie_title: 'Movie B', tmdb_id: 2, year: 2021, requester_slack_id: 'U2' });

    const results = getAllRequests();
    expect(results).toHaveLength(2);
    const titles = results.map(r => r.movie_title);
    expect(titles).toContain('Movie A');
    expect(titles).toContain('Movie B');
  });

  it('returns only pending requests when status filter is pending', () => {
    createRequest({ movie_title: 'Pending Movie', tmdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    const req2 = createRequest({ movie_title: 'Approved Movie', tmdb_id: 2, year: 2021, requester_slack_id: 'U2' });
    updateRequestStatus({ id: req2.id, status: 'approved', approver_slack_id: 'U_APP' });

    const results = getAllRequests('pending');
    expect(results).toHaveLength(1);
    expect(results[0]!.movie_title).toBe('Pending Movie');
  });

  it('limits results to 25', () => {
    for (let i = 0; i < 30; i++) {
      createRequest({ movie_title: `Movie ${i}`, tmdb_id: i, year: 2020, requester_slack_id: 'U1' });
    }
    const results = getAllRequests();
    expect(results).toHaveLength(25);
  });
});

describe('getAllTvRequests', () => {
  beforeEach(() => {
    _resetDb();
    getDb(':memory:');
  });

  it('returns empty array when no TV requests exist', () => {
    expect(getAllTvRequests()).toEqual([]);
  });

  it('returns all TV requests ordered by created_at DESC', () => {
    createTvRequest({ show_title: 'Show A', tvdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    createTvRequest({ show_title: 'Show B', tvdb_id: 2, year: 2021, requester_slack_id: 'U2' });

    const results = getAllTvRequests();
    expect(results).toHaveLength(2);
    const titles = results.map(r => r.show_title);
    expect(titles).toContain('Show A');
    expect(titles).toContain('Show B');
  });

  it('returns only approved TV requests when status filter is approved', () => {
    createTvRequest({ show_title: 'Pending Show', tvdb_id: 1, year: 2020, requester_slack_id: 'U1' });
    const req2 = createTvRequest({ show_title: 'Approved Show', tvdb_id: 2, year: 2021, requester_slack_id: 'U2' });
    updateTvRequestStatus({ id: req2.id, status: 'approved', approver_slack_id: 'U_APP' });

    const results = getAllTvRequests('approved');
    expect(results).toHaveLength(1);
    expect(results[0]!.show_title).toBe('Approved Show');
  });

  it('limits results to 25', () => {
    for (let i = 0; i < 30; i++) {
      createTvRequest({ show_title: `Show ${i}`, tvdb_id: i, year: 2020, requester_slack_id: 'U1' });
    }
    const results = getAllTvRequests();
    expect(results).toHaveLength(25);
  });
});
