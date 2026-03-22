# App Logging — Activity Visibility for movie-bot

## TL;DR

> **Quick Summary**: Add a lightweight structured logger to movie-bot so operators can see what users are doing in real time via `docker logs`. Currently only startup and error logs exist — no successful user actions are recorded.
>
> **Deliverables**:
> - `src/logger.ts` — lightweight logger module (~60 lines, zero dependencies)
> - `tests/logger.test.ts` — tests for level filtering, format, and test sink
> - `src/index.ts` migrated to use logger
> - `src/slack/commands/movie.ts` — INFO logs for command, search, IMDB detection
> - `src/slack/actions/selectMovie.ts` — INFO/WARN logs for selection, submission
> - `src/slack/actions/approveMovie.ts` — INFO/WARN logs for approvals
> - `src/slack/actions/rejectMovie.ts` — INFO/WARN logs for rejections
> - `src/slack/helpers/submitForApproval.ts` — INFO/WARN logs for approval posting
> - `src/radarr/client.ts` — ERROR logs for failed API calls
>
> **Estimated Effort**: Medium
> **Parallel Execution**: NO — Tasks are sequential (logger must exist before handlers use it)
> **Critical Path**: Task 1 (logger module) → Task 2 (migrate index.ts) → Task 3 (command handler) → Task 4 (action handlers) → Task 5 (radarr client) → Final Verification

---

## Context

### Original Request
"Add logging to the app so we can tell what is happening. At the moment logs are not very clear and I don't know what users are trying to do."

### Problem Statement
The bot has 13 `console.*` calls — all either at startup or in error `catch` blocks. Zero logging of successful user actions:
- No log when a user runs `/movie batman`
- No log when a movie is selected from the dropdown
- No log when an approval is posted, approved, or rejected
- No log of authorization failures
- No log of Radarr API errors (only thrown exceptions)

An operator watching `docker logs` sees startup messages and then silence — even as users actively request movies.

### Metis Review Key Findings
- **Hidden intent**: Operator needs activity breadcrumbs, not structured JSON or log aggregation
- **Right approach**: Single `src/logger.ts` wrapping `console.*` with level filtering — zero new deps
- **AI failure points to guard against**: Adding pino/winston, changing handler signatures, adding correlation IDs, creating `src/logger/` directory, adding JSDoc
- **Test concern**: New log calls will print noise during `bun test` — must implement `_setLoggerOutput(noopSink)` before migrating any handlers
- **Docker timestamps**: Docker adds its own timestamps, but logger should still emit timestamps for non-Docker contexts (dev mode)

---

## Work Objectives

### Core Objective
Enable operators to see real-time activity traces from `docker logs movie-bot` showing who requested what, what was approved/rejected, and any errors with context.

### Concrete Deliverables
- `src/logger.ts` — `createLogger(prefix)` → `{ debug, info, warn, error }`, level filtering via `LOG_LEVEL` env var, `_setLoggerOutput()` for tests
- `tests/logger.test.ts` — unit tests for the logger
- Modified `src/index.ts` — all console.* migrated to logger
- Modified `src/slack/commands/movie.ts` — INFO logs for command/search/IMDB paths
- Modified `src/slack/actions/selectMovie.ts` — INFO/WARN logs for selection and submission
- Modified `src/slack/actions/approveMovie.ts` — INFO/WARN logs for approve/unauthorized/race
- Modified `src/slack/actions/rejectMovie.ts` — INFO/WARN logs for reject/unauthorized/race
- Modified `src/slack/helpers/submitForApproval.ts` — INFO/WARN logs for approval posting and channel join
- Modified `src/radarr/client.ts` — ERROR logs on failed API calls

### Definition of Done
- [ ] `src/logger.ts` exists, exports `createLogger` and `_setLoggerOutput`
- [ ] `bun test tests/logger.test.ts` → all logger tests pass
- [ ] `grep -rn 'console\.' src/ --include='*.ts' | grep -v 'src/logger.ts'` → zero matches
- [ ] `bun run typecheck` → zero errors
- [ ] `bun test` → all tests pass (zero regressions)
- [ ] Sample log output format: `[INFO] [movie-cmd] /movie command user=U123 query="batman"`

### Must Have
- `createLogger(prefix: string)` returning `{ debug, info, warn, error }` — each takes `(message: string, context?: Record<string, unknown>)`
- Log format: `[LEVEL] [prefix] message key=value key=value` (human-readable, grep-friendly)
- `LOG_LEVEL` env var (debug|info|warn|error, default: info) read from `process.env.LOG_LEVEL` inside logger.ts
- `_setLoggerOutput(sink)` for test isolation — call with no-op sink in tests to suppress output
- Module-level logger creation in each file: `const log = createLogger('prefix')`
- All logging events from the specification table below
- Zero new npm/bun dependencies

### Must NOT Have (Guardrails)
- **NO** new npm/bun dependencies (no pino, no winston, no bunyan, no debug)
- **NO** `src/logger/` directory — single `src/logger.ts` file only
- **NO** JSDoc comments — project has zero JSDoc
- **NO** changes to handler function signatures or deps objects
- **NO** logging of API keys, tokens, or secrets
- **NO** correlation IDs or distributed tracing concepts
- **NO** JSON log format option — human-readable only
- **NO** performance timing/duration tracking
- **NO** log file output or log rotation
- **NO** `docker-compose.yml` or `Dockerfile` changes
- **NO** changes to the test mock patterns (keep existing tests unchanged)
- **NO** adding `logger` to the Config type in `src/config/index.ts`
- **NO** barrel export `src/logger/index.ts` (single file, no directory)
- **NO** modifications to approval message Block Kit builders

### What to Log (Exact Specification)

| Event | Level | Prefix | Message Format |
|-------|-------|--------|----------------|
| `/movie` command received | INFO | `movie-cmd` | `/movie command user=U123 query="batman"` |
| IMDB link detected | INFO | `movie-cmd` | `IMDB link detected user=U123 imdbId=tt0372784` |
| Search results returned | INFO | `movie-cmd` | `Search complete user=U123 query="batman" results=8` |
| No results found | WARN | `movie-cmd` | `No results user=U123 query="xyznonexistent"` |
| IMDB movie not found | WARN | `movie-cmd` | `IMDB movie not found user=U123 imdbId=tt9999999` |
| Error in /movie command | ERROR | `movie-cmd` | `Error in /movie command user=U123 error="message"` |
| Movie selected from dropdown | INFO | `select` | `Movie selected user=U123 movie="Batman Begins (2005)" tmdbId=272` |
| Cache miss on selection | WARN | `select` | `Cache miss user=U123 (results expired)` |
| Movie already exists in Radarr | INFO | `submit` | `Already in Radarr user=U123 movie="Batman Begins (2005)" tmdbId=272` |
| Approval posted to channel | INFO | `submit` | `Approval posted movie="Batman Begins (2005)" tmdbId=272 requestId=7` |
| Not-in-channel auto-join | WARN | `submit` | `Auto-joining approval channel channel=C123` |
| Error in submit helper | ERROR | `submit` | `Error submitting for approval user=U123 tmdbId=272 error="message"` |
| Error in selectMovie action | ERROR | `select` | `Error in selectMovie action user=U123 error="message"` |
| Approve action taken | INFO | `approve` | `Movie approved approver=U456 movie="Batman Begins (2005)" tmdbId=272` |
| Radarr movie added after approval | INFO | `approve` | `Radarr movie added tmdbId=272` |
| Unauthorized approval attempt | WARN | `approve` | `Unauthorized approval attempt user=U789 tmdbId=272` |
| Race condition (already approved/rejected) | WARN | `approve` | `Request not pending tmdbId=272 status=approved` |
| Error in approveMovie action | ERROR | `approve` | `Error in approveMovie action user=U456 tmdbId=272 error="message"` |
| Reject action taken | INFO | `reject` | `Movie rejected approver=U456 movie="Batman Begins (2005)" tmdbId=272` |
| Unauthorized reject attempt | WARN | `reject` | `Unauthorized rejection attempt user=U789 tmdbId=272` |
| Race condition (already approved/rejected) | WARN | `reject` | `Request not pending tmdbId=272 status=rejected` |
| Error in rejectMovie action | ERROR | `reject` | `Error in rejectMovie action user=U456 tmdbId=272 error="message"` |
| Radarr API error | ERROR | `radarr` | `Radarr API error method=GET path=/movie/lookup status=500` |

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Framework**: bun:test with mock()
- **Pattern**: Follow `_resetDb()` / `_resetConfig()` patterns from existing tests for `_setLoggerOutput()`

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.txt`.

- **Unit tests**: `bun test tests/logger.test.ts`
- **Regression tests**: `bun test` (full suite)
- **Console cleanliness**: `grep -rn 'console\.' src/ --include='*.ts' | grep -v 'src/logger.ts'`
- **Type safety**: `bun run typecheck`

---

## Execution Strategy

### Sequential Waves

```
Task 1: Create src/logger.ts + tests/logger.test.ts [unspecified-high]
  → Logger module and tests first

Task 2: Migrate src/index.ts to logger [quick]
  → Replace all console.* in entry point, depends on Task 1

Task 3: Add logging to src/slack/commands/movie.ts [quick]
  → INFO logs for command events, depends on Task 1

Task 4: Add logging to action handlers + submitForApproval [unspecified-high]
  → Covers selectMovie.ts, approveMovie.ts, rejectMovie.ts, submitForApproval.ts
  → Depends on Task 1

Task 5: Add error logging to src/radarr/client.ts [quick]
  → ERROR level only for failed API calls, depends on Task 1

Wave FINAL (After ALL tasks — verification):
├── F1: Plan Compliance Audit (oracle)
├── F2: Code Quality Review (unspecified-high)
├── F3: Real Manual QA (unspecified-high)
└── F4: Scope Fidelity Check (deep)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1    | —         | 2, 3, 4, 5 |
| 2    | 1         | Final  |
| 3    | 1         | Final  |
| 4    | 1         | Final  |
| 5    | 1         | Final  |
| F1-F4| 2,3,4,5   | —      |

---

## TODOs

- [x] 1. Create `src/logger.ts` logger module and `tests/logger.test.ts`

  **What to do**:
  - Create `src/logger.ts` (single file, no directory, ~60-80 lines max):
    ```typescript
    // Output sink type — injectable for tests
    type LogOutput = {
      debug: (msg: string) => void;
      info:  (msg: string) => void;
      warn:  (msg: string) => void;
      error: (msg: string) => void;
    };
    
    const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
    type LogLevel = keyof typeof LOG_LEVELS;
    
    // Module-level output sink — replaceable for tests
    let _output: LogOutput = {
      debug: console.debug,
      info:  console.log,
      warn:  console.warn,
      error: console.error,
    };
    
    export function _setLoggerOutput(sink: LogOutput): void { ... }
    
    function getLevel(): LogLevel { /* read process.env.LOG_LEVEL, default 'info' */ }
    
    function formatContext(ctx?: Record<string, unknown>): string {
      if (!ctx) return '';
      return ' ' + Object.entries(ctx).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
    }
    
    export function createLogger(prefix: string) {
      function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
        if (LOG_LEVELS[level] < LOG_LEVELS[getLevel()]) return;
        const ts = new Date().toISOString();
        const line = `${ts} [${level.toUpperCase()}] [${prefix}] ${message}${formatContext(context)}`;
        _output[level](line);
      }
      return {
        debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
        info:  (msg: string, ctx?: Record<string, unknown>) => log('info',  msg, ctx),
        warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn',  msg, ctx),
        error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
      };
    }
    ```
  - Note: `_output[level]` where `level` is `LogLevel` key — TypeScript's `noUncheckedIndexedAccess` may flag this. Use explicit mapping or index assertion as needed to keep strict mode clean.
  - Create `tests/logger.test.ts`:
    1. **Level filtering**: when `LOG_LEVEL=error`, calling `log.debug(...)` and `log.info(...)` should NOT call the output sink — verify via mock sink
    2. **Level filtering — warn**: when `LOG_LEVEL=warn`, debug and info are suppressed, warn and error pass through
    3. **Default level is info**: when `LOG_LEVEL` is unset, debug is suppressed, info/warn/error pass through
    4. **Format includes prefix**: output line contains `[prefix]`
    5. **Format includes level**: output line contains `[INFO]` / `[WARN]` / `[ERROR]`
    6. **Format includes message**: output line contains the message text
    7. **Context key=value pairs**: when context `{ user: 'U123' }` passed, output contains `user="U123"`
    8. **_setLoggerOutput suppresses**: when called with no-op sink, no console calls happen
    9. **Multiple loggers independent**: `createLogger('a')` and `createLogger('b')` use same sink but different prefixes
  - Use `mock()` from `bun:test` to create a mock sink. Use `_setLoggerOutput(mockSink)` in `beforeEach`.
  - Use `process.env.LOG_LEVEL = 'error'` / `delete process.env.LOG_LEVEL` to test level filtering.
  - Restore original sink in `afterEach` or use `beforeEach` to reset.

  **Must NOT do**:
  - Do NOT add any npm/bun dependency
  - Do NOT create `src/logger/` directory — single file `src/logger.ts` only
  - Do NOT add JSDoc comments
  - Do NOT export a default logger — always `createLogger(prefix)`
  - Do NOT read from `src/config/index.ts` — read `process.env.LOG_LEVEL` directly

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires careful TypeScript strict-mode compliance (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), test design following project's mock patterns, and getting the module architecture right.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Tasks 2, 3, 4, 5
  - **Blocked By**: Nothing (start immediately)

  **Acceptance Criteria**:

  - [ ] `src/logger.ts` exists, <100 lines
  - [ ] Exports: `createLogger`, `_setLoggerOutput`
  - [ ] `tests/logger.test.ts` exists with ≥9 test cases
  - [ ] `bun test tests/logger.test.ts` → all pass
  - [ ] `bun run typecheck` → zero errors
  - [ ] No new dependencies in `package.json`

  **QA Scenarios:**
  ```
  Scenario: Logger level filtering works
    Tool: Bash
    Steps:
      1. Run `bun test tests/logger.test.ts` — expect all pass
    Evidence: .sisyphus/evidence/task-1-logger-tests.txt

  Scenario: No new dependencies added
    Tool: Bash
    Steps:
      1. Run `cat package.json` — verify no new entries in dependencies or devDependencies
    Evidence: .sisyphus/evidence/task-1-no-deps.txt

  Scenario: TypeScript strict mode compliance
    Tool: Bash
    Steps:
      1. Run `bun run typecheck` — expect exit code 0
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES
  - Message: `feat: add lightweight logger module with level filtering and test support`
  - Files: `src/logger.ts`, `tests/logger.test.ts`
  - Pre-commit: `bun run typecheck && bun test tests/logger.test.ts`

- [x] 2. Migrate `src/index.ts` startup logs to logger

  **What to do**:
  - Add `import { createLogger } from './logger.js'` at top of `src/index.ts` (note: Bun uses `.js` extensions in imports per `verbatimModuleSyntax` convention — check existing imports in the file and match the pattern)
  - Create `const log = createLogger('app')` at module level
  - Replace ALL `console.log`, `console.warn`, `console.error` calls in `src/index.ts` with `log.info(...)`, `log.warn(...)`, `log.error(...)` respectively
  - Preserve the existing emoji-prefixed text content — just route through logger:
    - `console.log('🔍 Checking Radarr connection...')` → `log.info('🔍 Checking Radarr connection...')`
    - `console.log('✅ Radarr connected...')` → `log.info('✅ Radarr connected...')`
    - etc.
  - Do NOT change the messages themselves, only the function used to emit them

  **Must NOT do**:
  - Do NOT restructure the startup logic
  - Do NOT change any message text (preserve emojis and wording exactly)
  - Do NOT add new log messages beyond what replaces existing ones

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure mechanical replacement — swap `console.*` for `log.*` in one file.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES — Tasks 2, 3, 4, 5 can all run after Task 1 is complete. However, since these are short tasks, run sequentially.
  - **Blocked By**: Task 1

  **Acceptance Criteria**:

  - [ ] No `console.log/warn/error` calls remain in `src/index.ts`
  - [ ] `bun run typecheck` → zero errors
  - [ ] `bun test` → all tests pass (zero regressions)

  **QA Scenarios:**
  ```
  Scenario: No raw console.* in index.ts
    Tool: Bash
    Steps:
      1. Run `grep -n 'console\.' src/index.ts` — expect zero matches
    Evidence: .sisyphus/evidence/task-2-no-console.txt

  Scenario: Regression check
    Tool: Bash
    Steps:
      1. Run `bun run typecheck && bun test` — expect all pass
    Evidence: .sisyphus/evidence/task-2-regression.txt
  ```

  **Commit**: YES
  - Message: `refactor: migrate startup logs to logger module`
  - Files: `src/index.ts`
  - Pre-commit: `bun run typecheck && bun test`

- [x] 3. Add user action logging to `/movie` command handler

  **What to do**:
  - Modify `src/slack/commands/movie.ts`:
    - Add `import { createLogger } from '../logger.js'` (match existing import extension pattern)
    - Add `const log = createLogger('movie-cmd')` at module level (outside the handler function)
    - Add log calls per the specification table:

      **IMDB path** (inside the `if (imdbMatch)` branch):
      - At start: `log.info('/movie command (IMDB)', { user: command.user_id, imdbId })`
      - After `results.length === 0`: `log.warn('IMDB movie not found', { user: command.user_id, imdbId })`
      - After `results[0]` found + submitMovieForApproval called: `log.info('IMDB link detected', { user: command.user_id, imdbId })`

      **Search path** (existing title search):
      - Before `radarrClient.searchMovies(query)`: `log.info('/movie command', { user: command.user_id, query })`
      - After search returns, if `results.length === 0`: `log.warn('No results', { user: command.user_id, query })`
      - After search returns with results: `log.info('Search complete', { user: command.user_id, query, results: results.length })`

      **Catch blocks** — update both existing `console.error` calls to use logger and include context:
      - IMDB catch: `log.error('Error in /movie command (IMDB path)', { user: command.user_id, error: error instanceof Error ? error.message : String(error) })`
      - Search catch: `log.error('Error in /movie command', { user: command.user_id, error: error instanceof Error ? error.message : String(error) })`

  - Do NOT change the response logic, just add log calls alongside existing code

  **Must NOT do**:
  - Do NOT change the `registerMovieCommand` signature or deps object
  - Do NOT log the full error stack (just the message)
  - Do NOT log API keys or Slack tokens

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding log lines to an existing handler, following a well-specified table.
  - **Skills**: `[]`

  **Parallelization**:
  - **Blocked By**: Task 1

  **Acceptance Criteria**:

  - [ ] `const log = createLogger('movie-cmd')` at module level in `movie.ts`
  - [ ] No `console.error` calls remain in `src/slack/commands/movie.ts`
  - [ ] Log calls added for: command received, IMDB detection, search results, no-results, IMDB not found
  - [ ] `bun run typecheck` → zero errors
  - [ ] `bun test tests/slack/commands/movie.test.ts` → all pass

  **QA Scenarios:**
  ```
  Scenario: No raw console.* in movie.ts
    Tool: Bash
    Steps:
      1. Run `grep -n 'console\.' src/slack/commands/movie.ts` — expect zero matches
    Evidence: .sisyphus/evidence/task-3-no-console.txt

  Scenario: Regression check
    Tool: Bash
    Steps:
      1. Run `bun run typecheck && bun test tests/slack/commands/movie.test.ts` — expect all pass
    Evidence: .sisyphus/evidence/task-3-regression.txt
  ```

  **Commit**: YES
  - Message: `feat: add user action logging to /movie command`
  - Files: `src/slack/commands/movie.ts`
  - Pre-commit: `bun run typecheck && bun test`

- [x] 4. Add logging to action handlers and `submitForApproval` helper

  **What to do**:
  - Modify **`src/slack/actions/selectMovie.ts`**:
    - Add `import { createLogger } from '../logger.js'`
    - Add `const log = createLogger('select')` at module level
    - Log: movie selected (INFO with user, movie title/year, tmdbId)
    - Log: cache miss (WARN with user)
    - Replace `console.error` in catch with `log.error(...)` including user and error message context
    - **How to get user**: `body.user.id` — cast as needed (codebase uses `(body as any).actions[0]`)
    - **How to get movie title/year**: look up from cache results after finding by tmdbId

  - Modify **`src/slack/helpers/submitForApproval.ts`**:
    - Add `import { createLogger } from '../logger.js'` (adjust relative path — this file is in `src/slack/helpers/`, so path is `'../../logger.js'`)
    - Add `const log = createLogger('submit')` at module level
    - Log: already in Radarr (INFO with user, movie title/year, tmdbId)
    - Log: approval posted (INFO with movie title/year, tmdbId, requestId from `createRequest` return value)
    - Log: auto-joining channel (WARN with channelId)
    - Log: any error caught inside the function before returning `{ success: false, error }` (ERROR with user, tmdbId, error message)
    - Note: `submitMovieForApproval` already has a return-based error pattern — just add log calls at each return point

  - Modify **`src/slack/actions/approveMovie.ts`**:
    - Add `import { createLogger } from '../logger.js'`
    - Add `const log = createLogger('approve')` at module level
    - Log: unauthorized attempt (WARN with user, tmdbId)
    - Log: request not pending / race condition (WARN with tmdbId, current status)
    - Log: movie approved (INFO with approver userId, movie title/year, tmdbId)
    - Log: Radarr movie added (INFO with tmdbId)
    - Replace `console.error` in catch with `log.error(...)` including approver user and error message

  - Modify **`src/slack/actions/rejectMovie.ts`**:
    - Add `import { createLogger } from '../logger.js'`
    - Add `const log = createLogger('reject')` at module level
    - Log: unauthorized attempt (WARN with user, tmdbId)
    - Log: request not pending / race condition (WARN with tmdbId, current status)
    - Log: movie rejected (INFO with approver userId, movie title/year, tmdbId)
    - Replace `console.error` in catch with `log.error(...)` including approver user and error message

  - **IMPORTANT — Test isolation**: The test suite (`bun:test`) runs handler tests with mock objects. Log calls will print to stdout during tests. To suppress this, add `_setLoggerOutput` calls in `tests/slack/actions/` test files:
    - In EACH of `tests/slack/actions/selectMovie.test.ts`, `tests/slack/actions/approveMovie.test.ts`, `tests/slack/actions/rejectMovie.test.ts` — add import of `_setLoggerOutput` and a `beforeEach` call with a no-op sink
    - Same for `tests/slack/helpers/submitForApproval.test.ts`
    - This prevents log noise from polluting test output without changing test logic

  **Must NOT do**:
  - Do NOT change any handler's function signature or deps object type
  - Do NOT add logger to the deps injection pattern
  - Do NOT add logging inside the Bolt `app.action(...)` registration — only inside the handler body

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple files, requires understanding context available at each handler, correctly suppressing logs in tests, and handling the relative path for submitForApproval's logger import.
  - **Skills**: `[]`

  **Parallelization**:
  - **Blocked By**: Task 1

  **Acceptance Criteria**:

  - [ ] No `console.error` calls remain in `src/slack/actions/*.ts` or `src/slack/helpers/submitForApproval.ts`
  - [ ] `const log = createLogger(...)` at module level in each modified file
  - [ ] Test files for modified handlers import `_setLoggerOutput` and suppress logs in `beforeEach`
  - [ ] `bun run typecheck` → zero errors
  - [ ] `bun test` → all tests pass (zero regressions, no extra log noise)

  **QA Scenarios:**
  ```
  Scenario: No raw console.* in action handlers or submit helper
    Tool: Bash
    Steps:
      1. Run `grep -rn 'console\.' src/slack/ --include='*.ts'` — expect zero matches
    Evidence: .sisyphus/evidence/task-4-no-console.txt

  Scenario: All tests pass with no log noise
    Tool: Bash
    Steps:
      1. Run `bun test` — expect all pass, no unexpected log output lines in test output
    Evidence: .sisyphus/evidence/task-4-all-tests.txt

  Scenario: TypeScript strict mode
    Tool: Bash
    Steps:
      1. Run `bun run typecheck` — expect exit code 0
    Evidence: .sisyphus/evidence/task-4-typecheck.txt
  ```

  **Commit**: YES
  - Message: `feat: add action logging to select/approve/reject handlers and submit helper`
  - Files: `src/slack/actions/selectMovie.ts`, `src/slack/actions/approveMovie.ts`, `src/slack/actions/rejectMovie.ts`, `src/slack/helpers/submitForApproval.ts`, `tests/slack/actions/selectMovie.test.ts`, `tests/slack/actions/approveMovie.test.ts`, `tests/slack/actions/rejectMovie.test.ts`, `tests/slack/helpers/submitForApproval.test.ts`
  - Pre-commit: `bun run typecheck && bun test`

- [x] 5. Add error logging to `src/radarr/client.ts`

  **What to do**:
  - Modify `src/radarr/client.ts`:
    - Add `import { createLogger } from '../logger.js'`
    - Add `const log = createLogger('radarr')` at module level (outside the class)
    - Inside the `request<T>()` private method, where a non-OK HTTP response triggers throwing an Error, add a log call BEFORE throwing:
      ```typescript
      log.error('Radarr API error', { method, path, status: response.status });
      throw new Error(`Radarr API error: ${response.status} ${response.statusText}`);
      ```
    - The `method` and `path` should be available as parameters or locals — inspect the existing `request()` method signature to confirm. Use whatever context is available (method, path, status code).
    - Do NOT log request bodies, response bodies, or API keys
    - Do NOT add logging to successful API calls (success = DEBUG level at most — and since DEBUG is below INFO default, omit entirely)
  - The `RadarrClient` class is a private-`request()` wrapper — only that method needs the error log

  **Must NOT do**:
  - Do NOT log API keys (present in URL or headers — log only path without apikey query param if possible, otherwise just log method + status)
  - Do NOT log response body content
  - Do NOT add INFO logs to successful Radarr calls

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file change, adding one log call in an error path.
  - **Skills**: `[]`

  **Parallelization**:
  - **Blocked By**: Task 1

  **Acceptance Criteria**:

  - [ ] `const log = createLogger('radarr')` at module level in `client.ts`
  - [ ] ERROR log emitted before throwing on non-OK API response
  - [ ] API key NOT present in log output (verify the path logged doesn't include `apikey=` value)
  - [ ] `bun run typecheck` → zero errors
  - [ ] `bun test tests/radarr/client.test.ts` → all pass

  **QA Scenarios:**
  ```
  Scenario: No raw console.* in radarr client
    Tool: Bash
    Steps:
      1. Run `grep -n 'console\.' src/radarr/client.ts` — expect zero matches
    Evidence: .sisyphus/evidence/task-5-no-console.txt

  Scenario: Radarr client tests pass
    Tool: Bash
    Steps:
      1. Run `bun run typecheck && bun test tests/radarr/client.test.ts` — expect all pass
    Evidence: .sisyphus/evidence/task-5-radarr-tests.txt
  ```

  **Commit**: YES
  - Message: `feat: add error logging to Radarr API client`
  - Files: `src/radarr/client.ts`
  - Pre-commit: `bun run typecheck && bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check that `grep -rn 'console\.' src/ --include='*.ts' | grep -v 'src/logger.ts'` returns zero matches. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bun run typecheck` + `bun test`. Review all changed files for: raw `console.*` calls outside `src/logger.ts`, AI over-engineering (unnecessary abstractions, factories, transports), JSDoc comments, unused imports, imports of pino/winston/any logging library. Verify logger is <100 lines.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute EVERY QA scenario from EVERY task. Run verification commands. Verify log format is correct (parse a sample log line). Run full `bun test` and capture output showing zero failures. Verify `grep` for console.* returns zero outside logger.ts.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Console-clean [PASS/FAIL] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", check actual files created/modified. Verify 1:1 — no missing log points, no extra abstractions. Check "Must NOT do" compliance: no new dependencies, no logger directory, no handler signature changes, no JSDoc, no correlation IDs. Flag any unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| # | Message | Files | Pre-commit |
|---|---------|-------|------------|
| 1 | `feat: add lightweight logger module with level filtering and test support` | `src/logger.ts`, `tests/logger.test.ts` | `bun run typecheck && bun test tests/logger.test.ts` |
| 2 | `refactor: migrate startup logs to logger module` | `src/index.ts` | `bun run typecheck && bun test` |
| 3 | `feat: add user action logging to /movie command` | `src/slack/commands/movie.ts` | `bun run typecheck && bun test` |
| 4 | `feat: add action logging to select/approve/reject handlers and submit helper` | `src/slack/actions/*.ts`, `src/slack/helpers/submitForApproval.ts`, `tests/slack/actions/*.test.ts`, `tests/slack/helpers/submitForApproval.test.ts` | `bun run typecheck && bun test` |
| 5 | `feat: add error logging to Radarr API client` | `src/radarr/client.ts` | `bun run typecheck && bun test` |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck                                                        # Expected: zero errors
bun test                                                                 # Expected: all tests pass
grep -rn 'console\.' src/ --include='*.ts' | grep -v 'src/logger.ts'   # Expected: zero matches
```

### Expected Log Output (Sample)
```
2026-03-22T10:30:45.123Z [INFO] [app] 🔍 Checking Radarr connection...
2026-03-22T10:30:45.234Z [INFO] [app] ✅ Radarr connected. Quality profiles: HD-1080p (4)
2026-03-22T10:30:45.240Z [INFO] [app] ⚡ Movie Bot is running!
2026-03-22T10:31:12.001Z [INFO] [movie-cmd] /movie command user="U123ABC" query="batman begins"
2026-03-22T10:31:12.234Z [INFO] [movie-cmd] Search complete user="U123ABC" query="batman begins" results=6
2026-03-22T10:31:18.445Z [INFO] [select] Movie selected user="U123ABC" movie="Batman Begins (2005)" tmdbId=272
2026-03-22T10:31:18.501Z [INFO] [submit] Approval posted movie="Batman Begins (2005)" tmdbId=272 requestId=7
2026-03-22T10:32:05.102Z [INFO] [approve] Movie approved approver="U456DEF" movie="Batman Begins (2005)" tmdbId=272
2026-03-22T10:32:05.189Z [INFO] [approve] Radarr movie added tmdbId=272
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Zero `console.*` in `src/` outside `src/logger.ts`
- [ ] Log format is human-readable and grep-friendly
- [ ] Existing bot behavior completely unchanged (logging is additive only)
