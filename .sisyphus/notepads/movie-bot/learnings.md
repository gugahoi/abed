# Learnings

## [2026-03-21] Session: ses_2f004fe86ffeuB3cuB2ntQfvwP — Initial Analysis

### Tech Stack Decisions
- **Runtime**: Bun (TypeScript built-in, fast startup, bun:sqlite, bun:test)
- **Slack**: @slack/bolt v4 with Socket Mode — CRITICAL: no public URL needed for NAS
- **HTTP**: Built-in fetch with X-Api-Key header for Radarr
- **Database**: SQLite via bun:sqlite — single `requests` table

### Radarr API Key Facts
- Base URL: `http://<host>:7878/api/v3/<endpoint>`
- Auth header: `X-Api-Key`
- Search movies: `GET /movie/lookup?term=<query>`
- Add movie: `POST /movie` (requires qualityProfileId, rootFolderPath, tmdbId, monitored, minimumAvailability)
- Check exists: `GET /movie` then filter by tmdbId, OR use `GET /movie/{id}` 
- Quality profiles: `GET /qualityProfile`
- Root folders: `GET /rootFolder`
- MUST fetch quality profiles and root folders from API at startup — never hardcode IDs

### Slack Bot Critical Patterns
- Socket Mode requires TWO tokens: Bot Token (xoxb-) + App-Level Token (xapp-)
- ALWAYS call `await ack()` IMMEDIATELY in action handlers — before any async work (3-second Slack timeout)
- Block Kit: use `static_select` for movie selection, `actions` block for approve/reject buttons
- Bolt's `app.command('/movie', ...)` for slash commands
- Bolt's `app.action('action_id', ...)` for button clicks

### Architecture Rules
- Slash command: `/movie <title>` → search → present results → user picks → approval message → approver acts
- Approvers = list of Slack user IDs from env var (APPROVER_SLACK_IDS=U123,U456)
- No NLP, no free-text parsing — structured input only
- Check Radarr for duplicates by tmdbId before adding

## T1: Scaffold (2026-03-21)
- Bun was not installed on the machine — had to run `curl -fsSL https://bun.sh/install | bash` first
- Bun binary path after install: `~/.bun/bin/bun` (not on PATH in non-interactive shell)
- `bun install` created `bun.lock` (not `bun.lockb` — newer format in bun v1.3.11)
- `@slack/bolt@4.6.0` resolved from `^4.0.0`, `@types/bun@1.3.11`
- 124 packages installed in ~3s

## T2: Config Module (2026-03-21)

### Config Singleton Pattern
- Use `let _config: Config | null = null` with lazy init via `getConfig()`
- Export `_resetConfig()` for test isolation — resets singleton between tests
- `loadConfig()` is private (not exported) — only `getConfig()` is the public API

### Env Var Validation Pattern
- Collect ALL missing vars first, then throw ONE error listing them all
- `required(key)` helper: pushes to `missing[]` if absent, returns `''` as placeholder
- Check `missing.length > 0` AFTER all `required()` calls — gives full error list in one throw
- NaN check for parsed numbers after the missing-vars guard to avoid redundant errors

### Env Var Mutation in Bun Tests
- `process.env` is mutable in Bun — `delete process.env.KEY` and `process.env.KEY = 'val'` work natively
- Save/restore pattern: snapshot `savedEnv` in `beforeEach`, restore in `afterEach`
- `_resetConfig()` must be called in both `beforeEach` AND `afterEach` for full isolation
- `process.env = { ...originalEnv }` does NOT work in Bun (can't reassign process.env) — use per-key delete/restore

### bun run typecheck
- `tsc` not on PATH in non-interactive shell — use `bunx tsc --noEmit` directly
- `bun run typecheck` calls the script from package.json which expects `tsc` on PATH
- Both produce exit 0 when types are clean

## T4: Database Layer (2026-03-21)

### bun:sqlite Dynamic Query Pattern
- `db.query<ReturnType, ParamsType[]>(sql).get(...values)` — use spread `...values` for dynamic param arrays
- Passing the array directly as `.get(values)` fails TypeScript: expected `string | number | null`, got array
- The `ParamsType[]` generic on `query()` maps to `Statement<R, ParamsType[]>` → `.get(...params: ParamsType[])` (rest params)
- Spread pattern: `const values: (string | number | null)[] = [...]; stmt.get(...values)`

### SQLite Ordering with Second-Precision Timestamps
- `datetime('now')` has 1-second resolution — rows inserted in the same second get identical `created_at`
- Use `ORDER BY id DESC` (not `created_at DESC`) to reliably get the most recently inserted row
- AUTOINCREMENT IDs are monotonically increasing — safe as insertion-order proxy

### Test Isolation with Singleton DB
- `_resetDb()` closes + nulls the singleton; next `getDb(':memory:')` creates a fresh in-memory DB
- Call `_resetDb()` in `beforeEach`, then immediately `getDb(':memory:')` to initialize schema before tests run
- In-memory DBs are ephemeral — isolation is free (no cleanup of data between tests needed)

### TypeScript install for typecheck
- `typescript` is not included in `@types/bun` — must add it explicitly: `bun add -d typescript`
- `bun run typecheck` calls `tsc --noEmit` from `package.json` script

## T3: Radarr API Client (2026-03-21)

### Mock fetch in bun:test
- `globalThis.fetch = fn as unknown as typeof fetch` — must use double cast (`as unknown as typeof fetch`)
- Casting `Mock<...>` directly `as typeof fetch` fails: `Property 'preconnect' is missing in type 'Mock<...>'`
- Pattern: create `function asFetch(fn: unknown): typeof fetch { return fn as unknown as typeof fetch; }`
- Wrap `mock(...)` in `asFetch()` for type-safe mock assignment

### Radarr Client Implementation
- `RadarrSearchResult` carries `titleSlug` and `images[]` — needed for `POST /movie` payload
- `AddMoviePayload = RadarrSearchResult & { qualityProfileId, rootFolderPath, monitored, minimumAvailability, addOptions }`
- Spread the full search result into the add payload — Radarr requires all lookup fields back
- `movieExists(tmdbId)`: GET `/movie` returns full library, filter by `tmdbId` field
- Error handling: check `response.ok`, read `response.text()` for the error body

## [2026-03-21] Bolt v4 Action Handler Patterns

### Action registration
- `app.action(ACTION_IDS.X, async ({ body, ack, client, respond }) => { ... })`
- `await ack()` MUST be the very first line — Slack's 3-second timeout window
- `body.user.id` = the Slack user who clicked
- For static_select: `body.actions[0].selected_option.value` (the string value)
- For buttons: `body.actions[0].value` (the string value)
- All tmdbIds come in as strings — parse with `parseInt(value, 10)`

### Mock app pattern for action handler tests
```typescript
function createMockApp() {
  const handlers: Record<string, Function> = {};
  return {
    action: (id: string, handler: Function) => { handlers[id] = handler; },
    getHandler: (id: string) => handlers[id],
  };
}
// Note: getHandler returns Function | undefined — use ! operator or noUncheckedIndexedAccess
// app.getHandler(ACTION_IDS.X)!({ body, ack, respond, client })
```

### In-memory DB for tests
- Always call `_resetDb()` then `getDb(':memory:')` in `beforeEach`
- Without this, bun:sqlite tries to open `./data/requests.db` which may not exist

### DM pattern
- `client.chat.postMessage({ channel: userId, text: '...' })` — Slack opens DM automatically when channel = user ID

### Race condition guard
- Check `request.status !== 'pending'` before processing approve/reject
- If already handled, just `return` silently (already acked)

### Re-search for addMovie
- `addMovie` needs full `RadarrSearchResult` (titleSlug, images fields required by Radarr API)
- Must call `radarrClient.searchMovies(title)` to get full object, then find by tmdbId
