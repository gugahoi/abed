# App Logging — Learnings

## 2026-03-22 — Pre-planning (Metis analysis)

### Project conventions relevant to this plan
- `verbatimModuleSyntax: true` — all type-only imports must use `import type { ... }`
- Bun resolves `.js` extensions in imports — check existing imports in each file to match extension convention
- `noUncheckedIndexedAccess: true` — indexing a Record<string, unknown> or object by a key variable may require explicit assertion or type narrowing
- Logger _output[level] indexing may need type assertion: `_output[level as LogLevel](line)` — verify during Task 1

### Test isolation pattern (follow this exactly)
The project uses module-level singletons with `_reset*()` functions for test isolation:
- `src/config/index.ts`: exports `_resetConfig()`
- `src/db/index.ts`: exports `_resetDb()`
- Logger should export `_setLoggerOutput(sink)` following the same pattern
- Tests call these in `beforeEach` to ensure isolation

### Import extension convention
- Check `src/slack/commands/movie.ts` imports for the extension pattern used (`.js` vs no extension)
- Project may use `.js` in TypeScript source imports (common Bun/ESM pattern)
- Match whatever convention exists in the file being modified

### What NOT to do (AI failure points from Metis)
1. NO pino/winston/bunyan — zero new dependencies
2. NO src/logger/ directory — single file only
3. NO logger in deps objects — module-level createLogger() only
4. NO JSDoc comments anywhere
5. NO correlation IDs
6. NO JSON format
7. NO changes to handler signatures

## 2026-03-22 — Task 1: Logger module created

- Import extension convention observed: No extension used in imports (e.g., `'../src/logger'` not `'../src/logger.js'`). Test files at `tests/` root import from `../src/`, not `../../src/`. The nested test at `tests/slack/actions/` uses `'../../../src/...'`. Initial import path was wrong (`../../src/logger`) — correct is `../src/logger` from `tests/logger.test.ts`.
- TypeScript strict mode gotchas: `noUncheckedIndexedAccess` would have flagged `_currentOutput[level]` dynamic indexing. Used explicit if/else branches (`if (level === 'debug') ...`) to avoid this — zero errors with `tsc --noEmit`.
- Test patterns used: `mock()` from `bun:test` for sink methods. `mockSink.debug.mockClear()` in `beforeEach` to reset call counts. `captured.length = 0` to clear the shared array. `afterEach` restores a no-op sink to prevent test cross-contamination. `process.env['LOG_LEVEL']` set/deleted per-test with cleanup in `afterEach`. All 9 tests pass in 18ms.

## 2026-03-22 — Task 2: Add logging to /movie command

### Implementation Details
- **Import placement**: Added `import { createLogger } from '../../logger';` after other imports (line 6). No `.js` extension per convention.
- **Module-level logger**: `const log = createLogger('movie-cmd');` placed after `IMDB_REGEX` constant (line 15), outside the handler function.
- **Log call locations**:
  1. **Line 22** (after `const query = command.text.trim()`): `log.info('/movie command', { user: command.user_id, query })` — fires for all command invocations
  2. **Line 35** (after `const imdbId = imdbMatch[1] as string;` in IMDB path): `log.info('IMDB link detected', { user: command.user_id, imdbId })`
  3. **Line 40** (in IMDB no-results check): `log.warn('IMDB movie not found', { user: command.user_id, imdbId })`
  4. **Line 74** (IMDB catch block): Replaced `console.error(...)` with `log.error('Error in /movie command (IMDB path)', { user: command.user_id, error: error instanceof Error ? error.message : String(error) })`
  5. **Line 92** (in search no-results check): `log.warn('No results', { user: command.user_id, query })`
  6. **Line 102** (after `storeResults(...)`): `log.info('Search complete', { user: command.user_id, query, results: results.length })`
  7. **Line 110** (search catch block): Replaced `console.error(...)` with `log.error('Error in /movie command', { user: command.user_id, error: error instanceof Error ? error.message : String(error) })`
- **Zero console calls**: grep confirmed no `console.*` calls remain in the file
- **Error handling**: Used `error instanceof Error ? error.message : String(error)` per task spec — handles both Error and non-Error exceptions
- **Test output**: Logger calls are visible in test output (grep shows 13 movie.test.ts log lines emitted during test run). Existing tests all pass without modification. No test isolation issues — tests don't mock the logger, which is expected.
- **Verification results**:
   - `bun run typecheck`: ✅ zero errors
   - `bun test tests/slack/commands/movie.test.ts`: ✅ 13 pass
   - `bun test`: ✅ 91 pass (full suite)

## 2026-03-22 — Task 3: Add error logging to Radarr API client

### Implementation Details
- **Import placement**: Added `import { createLogger } from '../logger';` as first import (line 1). No `.js` extension per convention.
- **Module-level logger**: `const log = createLogger('radarr');` placed after imports (line 4), outside the class definition.
- **Log call location**: In `request<T>()` private method, inside the `if (!response.ok)` block (line 19-24):
  - Extract method: `const method = options?.method ?? 'GET';` — handles undefined case for `RequestInit.method`
  - Extract safe path: `const safePath = path.split('?')[0] ?? path;` — splits on `?` to strip query params (avoids logging apikey if it was in URL), handles `noUncheckedIndexedAccess` with `?? path` fallback
  - Log call: `log.error('Radarr API error', { method, path: safePath, status: response.status });` — fires before throw, never logs response body or API key
  - Error throw unchanged: `throw new Error(...)` still includes body for testing
- **No console calls**: Zero `console.*` calls remain in file (there were none before)
- **Sensitive data protection**: API key is in header, not URL. Query params (if any existed) are stripped by `safePath`. Response body not logged.
- **Test output**: ERROR log visible in test output when `request` fails (verified: "2026-03-22T01:24:12.309Z [ERROR] [radarr] Radarr API error method="GET" path="/movie/lookup" status=404")
- **Verification results**:
   - `bun run typecheck`: ✅ zero errors
   - `bun test tests/radarr/client.test.ts`: ✅ 8 pass
   - `bun test`: ✅ 91 pass (full suite)


