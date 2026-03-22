import { Database } from 'bun:sqlite';
import type { MovieRequest, CreateRequestInput, UpdateRequestStatusInput } from './types';

const DB_PATH = process.env.DB_PATH ?? './data/requests.db';

let _db: Database | null = null;

export function getDb(path?: string): Database {
  if (!_db) {
    _db = new Database(path ?? DB_PATH, { create: true });
    initSchema(_db);
  }
  return _db;
}

export function _resetDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_title TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      imdb_id TEXT,
      year INTEGER NOT NULL,
      poster_url TEXT,
      requester_slack_id TEXT NOT NULL,
      approver_slack_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      slack_message_ts TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_requests_tmdb_id ON requests(tmdb_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  `);
}

export function createRequest(input: CreateRequestInput): MovieRequest {
  const db = getDb();
  const stmt = db.prepare<MovieRequest, [string, number, string | null, number, string | null, string, string | null]>(`
    INSERT INTO requests (movie_title, tmdb_id, imdb_id, year, poster_url, requester_slack_id, slack_message_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  const result = stmt.get(
    input.movie_title,
    input.tmdb_id,
    input.imdb_id ?? null,
    input.year,
    input.poster_url ?? null,
    input.requester_slack_id,
    input.slack_message_ts ?? null,
  );
  if (!result) throw new Error('Failed to create request');
  return result;
}

export function getRequest(id: number): MovieRequest | null {
  const db = getDb();
  return db.prepare<MovieRequest, [number]>('SELECT * FROM requests WHERE id = ?').get(id) ?? null;
}

export function getRequestByTmdbId(tmdbId: number): MovieRequest | null {
  const db = getDb();
  return (
    db
      .prepare<MovieRequest, [number]>(
        'SELECT * FROM requests WHERE tmdb_id = ? ORDER BY id DESC LIMIT 1',
      )
      .get(tmdbId) ?? null
  );
}

export function updateRequestStatus(input: UpdateRequestStatusInput): MovieRequest {
  const db = getDb();
  const setClauses = ['status = ?', "updated_at = datetime('now')"];
  const values: (string | number | null)[] = [input.status];

  if (input.approver_slack_id !== undefined) {
    setClauses.push('approver_slack_id = ?');
    values.push(input.approver_slack_id);
  }
  if (input.slack_message_ts !== undefined) {
    setClauses.push('slack_message_ts = ?');
    values.push(input.slack_message_ts);
  }
  values.push(input.id);

  const sql = `UPDATE requests SET ${setClauses.join(', ')} WHERE id = ? RETURNING *`;
  const result = db.query<MovieRequest, (string | number | null)[]>(sql).get(...values);

  if (!result) throw new Error(`Request ${input.id} not found`);
  return result;
}
