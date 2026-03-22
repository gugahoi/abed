# IMDB Link Support for /movie Command

## TL;DR

> **Quick Summary**: Add IMDB link/ID detection to the `/movie` Slack command so users can request movies by pasting an IMDB URL or bare ID (`tt1234567`), skipping the search dropdown and going directly to the approval flow.
> 
> **Deliverables**:
> - Shared `submitMovieForApproval()` helper extracted from `selectMovie.ts`
> - IMDB regex detection branch in `/movie` command handler
> - Updated command handler signature to accept deps object (for `approvalChannelId`)
> - Updated wiring in `src/slack/index.ts`
> - Unit + integration tests for IMDB flow
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 2 waves + final verification
> **Critical Path**: Task 1 (helper extraction) → Task 2 (IMDB detection) → Task 3 (tests) → Final Verification

---

## Context

### Original Request
Add support for allowing IMDB links through `/movie <imdb link>` which would request the given movie directly.

### Interview Summary
**Key Discussions**:
- **Skip dropdown**: When IMDB link/ID is provided and movie is found (single result), skip the dropdown and go directly to posting the approval request
- **Both formats**: Accept full IMDB URLs (`https://www.imdb.com/title/tt1234567/`) AND bare IDs (`tt1234567`)
- **Tests after**: Write tests after implementation, not TDD
- **Existing flow untouched**: Title-based search must continue working exactly as before

**Research Findings**:
- Radarr's existing `searchMovies()` supports IMDB lookup via `imdb:tt1234567` as the search term — returns `[{movie}]` or `[]`
- `RadarrSearchResult` already has `imdbId?: string` field
- DB already has `imdb_id` column; `selectMovie` already passes `movie.imdbId` to `createRequest()`
- Command handler needs `approvalChannelId` (currently only available in `selectMovie` deps)
- The `not_in_channel` retry logic in `selectMovie` must be shared with the IMDB path

### Metis Review
**Identified Gaps** (addressed):
- **Command handler signature change needed**: `registerMovieCommand(app, radarrClient)` → `registerMovieCommand(app, { radarrClient, approvalChannelId })` — required for IMDB auto-submit to post to approval channel
- **`not_in_channel` retry logic**: Must be included in shared helper extraction, not just the happy path
- **IMDB regex edge cases**: IDs can be 7 or 8 digits; URLs may have trailing paths/params — regex must handle all
- **Scope creep risk**: Helper extraction must be minimal — only the "movieExists → createRequest → postApproval → updateStatus" sequence

---

## Work Objectives

### Core Objective
Enable users to request movies via IMDB links or IDs, bypassing the search dropdown for an exact-match experience while preserving the existing title search flow.

### Concrete Deliverables
- `src/slack/helpers/submitForApproval.ts` — shared helper function
- Modified `src/slack/actions/selectMovie.ts` — refactored to use shared helper
- Modified `src/slack/commands/movie.ts` — IMDB detection + auto-submit branch + updated deps signature
- Modified `src/slack/index.ts` — updated `registerMovieCommand` call with deps object
- `tests/slack/helpers/submitForApproval.test.ts` — unit tests for shared helper
- `tests/slack/commands/movie.test.ts` — updated with IMDB test cases
- `tests/integration/flow.test.ts` — updated with IMDB integration flow

### Definition of Done
- [ ] `/movie tt1877830` → approval request posted, no dropdown shown
- [ ] `/movie https://www.imdb.com/title/tt1877830/` → same behavior as bare ID
- [ ] `/movie The Batman` → existing dropdown flow unchanged
- [ ] `bun test` → all tests pass (existing + new)
- [ ] `bun run typecheck` → zero type errors

### Must Have
- IMDB URL detection and bare ID detection in command handler
- Skip dropdown when IMDB match found (auto-submit to approval)
- Shared helper function for the submit-for-approval flow
- `movieExists` check before submitting (prevent duplicates)
- `not_in_channel` auto-join retry logic in shared helper
- Error message when IMDB ID not found in Radarr
- All existing tests passing (zero regressions)

### Must NOT Have (Guardrails)
- **NO** new `RadarrClient` methods — use existing `searchMovies()` with `"imdb:ttXXX"` term
- **NO** changes to `approveMovie.ts` or `rejectMovie.ts` — they are downstream and unaffected
- **NO** changes to `buildApprovalRequestMessage` signature — no IMDB links in approval messages (out of scope)
- **NO** generic "movie lookup service" abstraction wrapping RadarrClient
- **NO** URL validation library — regex only
- **NO** JSDoc comments (codebase has zero JSDoc)
- **NO** `index.ts` barrel export for helpers directory (per project convention)
- **NO** logging beyond `console.error` in catch blocks (matches convention)
- **NO** TMDB ID handling (`tmdb:12345`) — only IMDB IDs in scope
- **NO** new environment variables or `.env.example` changes
- **NO** modifications to the search cache behavior — IMDB path does not use cache

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: bun:test
- **Pattern**: Follow mock patterns from `tests/integration/flow.test.ts` — `mock()`, `globalThis.fetch` assignment

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend/Module**: Use Bash (`bun test`, `bun run typecheck`) — run tests, assert pass counts
- **Integration**: Use Bash (`bun test tests/integration/`) — full flow verification

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — extract + detect):
├── Task 1: Extract shared submitMovieForApproval helper [quick]
├── Task 2: Add IMDB detection + auto-submit to /movie command [unspecified-high]
   (depends on Task 1)

Wave 2 (After Wave 1 — tests):
├── Task 3: Add tests for IMDB flow [unspecified-high]
   (depends on Tasks 1 & 2)

Wave FINAL (After ALL tasks — verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1    | —         | 2, 3   |
| 2    | 1         | 3      |
| 3    | 1, 2      | Final  |
| F1-F4| 3         | —      |

### Agent Dispatch Summary

- **Wave 1**: 2 tasks — T1 → `quick`, T2 → `unspecified-high` (sequential, T2 depends on T1)
- **Wave 2**: 1 task — T3 → `unspecified-high`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Extract shared `submitMovieForApproval` helper from `selectMovie`

  **What to do**:
  - Create `src/slack/helpers/submitForApproval.ts` with a `submitMovieForApproval()` function
  - This function encapsulates the core flow currently inline in `selectMovie.ts`:
    1. `radarrClient.movieExists(movie.tmdbId)` — check if already in library
    2. `createRequest({ movie_title, tmdb_id, imdb_id, year, poster_url, requester_slack_id })` — DB insert
    3. `client.chat.postMessage({ channel: approvalChannelId, blocks: buildApprovalRequestMessage(...) })` — post approval
    4. Handle `not_in_channel` error: `client.conversations.join()` then retry post (copy pattern from `selectMovie.ts:72-88`)
    5. `updateRequestStatus({ id, status: 'pending', slack_message_ts })` — store Slack message timestamp
  - Function signature: `submitMovieForApproval(params: { movie: RadarrSearchResult, userId: string, client: WebClient, radarrClient: RadarrClient, approvalChannelId: string }): Promise<{ success: boolean, alreadyExists?: boolean, error?: string }>`
  - Return a result object (not throw) so callers can handle each case with appropriate ephemeral messages
  - Refactor `src/slack/actions/selectMovie.ts` to import and call `submitMovieForApproval()` instead of its inline implementation
  - Update the `selectMovie` handler to use the result object for its ephemeral responses (already exists → "movie already in library", success → "submitted for approval", error → generic error)

  **Must NOT do**:
  - Do NOT create an `index.ts` barrel in `src/slack/helpers/`
  - Do NOT add JSDoc comments
  - Do NOT change any behavior — this is a pure refactor, output must be identical
  - Do NOT touch `approveMovie.ts` or `rejectMovie.ts`
  - Do NOT change the `buildApprovalRequestMessage` signature or output

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure extraction refactor — move existing code into a new file and update imports. No new logic, no design decisions.
  - **Skills**: `[]`
    - No special skills needed — straightforward TypeScript refactoring

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (first task, sequential)
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL — Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/slack/actions/selectMovie.ts:40-100` — The inline implementation to extract. Contains: `movieExists` check (line ~48), `createRequest` call (line ~54), `client.chat.postMessage` (line ~62), `not_in_channel` catch + `conversations.join` retry (lines ~72-88), `updateRequestStatus` (line ~90), `clearResults` (line ~92). Extract everything from the `movieExists` check through `updateRequestStatus`. Leave `clearResults` in selectMovie (it's cache-specific).
  - `src/slack/actions/selectMovie.ts:7-10` — `SelectMovieDeps` type pattern. Follow this for the helper's parameter type — explicit typed object, not positional args.
  - `src/slack/actions/selectMovie.ts:101-108` — Error handling pattern. `catch (error) { console.error(...); respond({ text: "...", response_type: "ephemeral" })`. The helper should return an error result, and the caller (selectMovie) handles the ephemeral respond.

  **API/Type References** (contracts to implement against):
  - `src/radarr/types.ts:RadarrSearchResult` — The `movie` parameter type for the helper
  - `src/db/types.ts:CreateRequestInput` — Shape expected by `createRequest()`. Fields: `movie_title`, `tmdb_id`, `imdb_id`, `year`, `poster_url`, `requester_slack_id`
  - `src/db/index.ts:createRequest` — DB insert function to call
  - `src/db/index.ts:updateRequestStatus` — DB update function to call
  - `src/slack/messages/index.ts:buildApprovalRequestMessage` — Message builder to call. Accepts `{ title, year, overview?, posterUrl?, tmdbId }` and `requesterSlackId`

  **Test References** (testing patterns to follow):
  - `tests/slack/actions/selectMovie.test.ts` — Existing tests for selectMovie. After refactor, ALL these tests must still pass. Run `bun test tests/slack/actions/selectMovie.test.ts` to verify zero regressions.
  - `tests/integration/flow.test.ts` — Full flow test. Must still pass after refactor.

  **Acceptance Criteria**:

  - [ ] New file `src/slack/helpers/submitForApproval.ts` exists with `submitMovieForApproval` exported
  - [ ] `selectMovie.ts` imports and calls `submitMovieForApproval` instead of inline logic
  - [ ] `bun run typecheck` → zero errors
  - [ ] `bun test tests/slack/actions/selectMovie.test.ts` → all existing tests PASS
  - [ ] `bun test tests/integration/flow.test.ts` → PASS
  - [ ] `bun test` → ALL tests pass (zero regressions)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All existing tests pass after refactor (happy path)
    Tool: Bash
    Preconditions: Task 1 changes applied
    Steps:
      1. Run `bun run typecheck` — expect exit code 0, no errors
      2. Run `bun test` — expect all tests pass
      3. Run `bun test tests/slack/actions/selectMovie.test.ts` — expect all tests pass
      4. Run `bun test tests/integration/flow.test.ts` — expect PASS
    Expected Result: Zero regressions — all test suites pass, zero failures
    Failure Indicators: Any test failure or typecheck error
    Evidence: .sisyphus/evidence/task-1-existing-tests-pass.txt

  Scenario: Helper function has correct exports (structural check)
    Tool: Bash
    Preconditions: Task 1 changes applied
    Steps:
      1. Run `grep -n "export.*submitMovieForApproval" src/slack/helpers/submitForApproval.ts` — expect match
      2. Run `grep -n "submitMovieForApproval" src/slack/actions/selectMovie.ts` — expect import + call
      3. Run `grep -rn "index.ts" src/slack/helpers/` — expect NO match (no barrel export)
    Expected Result: Helper exported, imported by selectMovie, no barrel file
    Failure Indicators: Missing export, missing import, barrel file exists
    Evidence: .sisyphus/evidence/task-1-helper-exports.txt
  ```

  **Commit**: YES
  - Message: `refactor(slack): extract submitMovieForApproval helper from selectMovie action`
  - Files: `src/slack/helpers/submitForApproval.ts`, `src/slack/actions/selectMovie.ts`
  - Pre-commit: `bun run typecheck && bun test`

- [x] 2. Add IMDB detection and auto-submit to `/movie` command handler

  **What to do**:
  - Modify `src/slack/commands/movie.ts`:
    1. Update `registerMovieCommand` signature from `(app: App, radarrClient: RadarrClient)` to `(app: App, deps: MovieCommandDeps)` where `MovieCommandDeps = { radarrClient: RadarrClient; approvalChannelId: string }`
    2. Add IMDB detection regex at the top of the handler, after `const query = command.text.trim()`:
       ```
       const imdbMatch = query.match(/^(?:https?:\/\/(?:www\.)?imdb\.com\/title\/)?(tt\d{7,8})\/?.*$/i)
       ```
    3. If `imdbMatch`:
       - Extract `const imdbId = imdbMatch[1]` (the `ttXXXXXXX` capture group)
       - Call `const results = await deps.radarrClient.searchMovies(\`imdb:${imdbId}\`)`
       - If `results.length === 0`: respond ephemeral with message like `"Could not find a movie with IMDB ID ${imdbId}. Please check the link and try again."`
       - If `results[0]` exists: call `submitMovieForApproval({ movie: results[0], userId: command.user_id, client, radarrClient: deps.radarrClient, approvalChannelId: deps.approvalChannelId })`
       - Handle result: `alreadyExists` → ephemeral "already in library", `success` → ephemeral "submitted for approval", `error` → ephemeral generic error
       - Return early (don't fall through to title search)
    4. If no IMDB match: existing title search flow runs unchanged (using `deps.radarrClient` instead of `radarrClient`)
  - Modify `src/slack/index.ts`:
    - Update the `registerMovieCommand` call from `registerMovieCommand(app, radarrClient)` to `registerMovieCommand(app, { radarrClient, approvalChannelId: config.approvalChannelId })` (or however `approvalChannelId` is passed — check how `registerSelectMovieAction` receives it)
  - Import `submitMovieForApproval` from `../helpers/submitForApproval` in `movie.ts`

  **Must NOT do**:
  - Do NOT add a new method to `RadarrClient` — use existing `searchMovies()` with `"imdb:ttXXX"` term
  - Do NOT modify `buildApprovalRequestMessage` or add IMDB links to messages
  - Do NOT use the search cache for the IMDB path (no `storeResults`, no dropdown)
  - Do NOT add URL validation libraries
  - Do NOT handle TMDB IDs
  - Do NOT touch `approveMovie.ts`, `rejectMovie.ts`, or the approval/rejection flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding the command handler's Bolt API integration, modifying function signatures, updating wiring, and implementing branching logic with proper error handling. More than a trivial change.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (sequential after Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References** (CRITICAL — Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/slack/commands/movie.ts` — The full file. Current handler: parses `command.text.trim()`, calls `radarrClient.searchMovies(query)`, handles empty results, stores in cache, responds with dropdown. The IMDB branch inserts BEFORE the existing search logic.
  - `src/slack/actions/selectMovie.ts:7-10` — `SelectMovieDeps` type pattern. Copy this pattern for `MovieCommandDeps = { radarrClient: RadarrClient; approvalChannelId: string }`.
  - `src/slack/actions/selectMovie.ts:26-30` — How `respond` is used for ephemeral messages: `respond({ text: "...", response_type: "ephemeral" })`. Use same pattern in the IMDB branch.

  **API/Type References**:
  - `src/slack/helpers/submitForApproval.ts` — The shared helper created in Task 1. Import and call for the IMDB auto-submit path.
  - `src/slack/index.ts` — Registration file. Find where `registerMovieCommand` is called and update to pass deps object. Look at how `registerSelectMovieAction` is called nearby for the pattern of passing `approvalChannelId`.
  - `src/slack/searchCache.ts:storeResults` — Used in the existing title search path. Do NOT use in the IMDB path.

  **External References**:
  - Radarr API: `searchMovies("imdb:tt1234567")` calls `GET /api/v3/movie/lookup?term=imdb%3Att1234567` — returns `RadarrSearchResult[]` (single-element array or empty)

  **Acceptance Criteria**:

  - [ ] `src/slack/commands/movie.ts` has IMDB regex detection before existing search logic
  - [ ] `registerMovieCommand` accepts deps object with `radarrClient` and `approvalChannelId`
  - [ ] `src/slack/index.ts` updated to pass deps object
  - [ ] `bun run typecheck` → zero errors
  - [ ] `bun test` → all existing tests pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Typecheck and existing tests pass (regression check)
    Tool: Bash
    Preconditions: Tasks 1 & 2 changes applied
    Steps:
      1. Run `bun run typecheck` — expect exit code 0
      2. Run `bun test` — expect all existing tests pass
      3. Run `bun test tests/slack/commands/movie.test.ts` — expect all existing tests pass
    Expected Result: Zero regressions
    Failure Indicators: Type errors or test failures
    Evidence: .sisyphus/evidence/task-2-regression-check.txt

  Scenario: IMDB regex correctly parses various input formats (unit verification)
    Tool: Bash
    Preconditions: Task 2 changes applied
    Steps:
      1. Create a quick inline bun script that tests the regex against:
         - "tt1877830" → captures "tt1877830"
         - "https://www.imdb.com/title/tt1877830/" → captures "tt1877830"
         - "https://imdb.com/title/tt1877830" → captures "tt1877830"
         - "https://www.imdb.com/title/tt1877830/reviews" → captures "tt1877830"
         - "http://www.imdb.com/title/tt12345678/" → captures "tt12345678" (8-digit)
         - "The Batman" → no match (null)
         - "batman tt" → no match (null)
      2. Run the script with `bun -e '<script>'`
    Expected Result: All expected captures match, non-IMDB input returns null
    Failure Indicators: Wrong capture group or false positive on title search input
    Evidence: .sisyphus/evidence/task-2-regex-verification.txt
  ```

  **Commit**: YES
  - Message: `feat(slack): add IMDB ID/URL detection to /movie command with auto-submit`
  - Files: `src/slack/commands/movie.ts`, `src/slack/index.ts`
  - Pre-commit: `bun run typecheck && bun test`

- [x] 3. Add tests for IMDB detection and auto-submit flow

  **What to do**:
  - Add tests to `tests/slack/commands/movie.test.ts`:
    1. **IMDB bare ID — movie found**: `/movie tt1877830` → `searchMovies` called with `"imdb:tt1877830"` → `submitMovieForApproval` called → respond ephemeral "submitted for approval"
    2. **IMDB full URL — movie found**: `/movie https://www.imdb.com/title/tt1877830/` → same flow as bare ID
    3. **IMDB URL with trailing path**: `/movie https://www.imdb.com/title/tt1877830/reviews` → extracts `tt1877830` correctly
    4. **IMDB — movie not found**: `/movie tt9999999` → `searchMovies` returns `[]` → respond ephemeral "not found" → no `submitMovieForApproval` called
    5. **IMDB — movie already in library**: `/movie tt1877830` → `submitMovieForApproval` returns `{ success: false, alreadyExists: true }` → respond ephemeral "already in library"
    6. **Regular title — unchanged flow**: `/movie The Batman` → `searchMovies` called with `"The Batman"` (not `"imdb:..."`) → cache populated → dropdown returned
  - Add tests to `tests/slack/helpers/submitForApproval.test.ts` (new file):
    1. **Happy path**: movie not in library → createRequest → postMessage → updateStatus → returns `{ success: true }`
    2. **Already exists**: `movieExists` returns true → returns `{ success: false, alreadyExists: true }` → no createRequest called
    3. **Not-in-channel retry**: first `postMessage` throws `not_in_channel` → `conversations.join` called → retry `postMessage` succeeds
    4. **Generic error**: `postMessage` throws unknown error → returns `{ success: false, error: "..." }`
  - Update `tests/integration/flow.test.ts`:
    1. Add IMDB flow integration test: command with IMDB ID → approval posted → DB record has `imdb_id` set → approve flow works end-to-end
  - Follow existing test patterns: `mock()` from `bun:test`, `globalThis.fetch` assignment, `_resetDb()` + `_resetConfig()` in `beforeEach`

  **Must NOT do**:
  - Do NOT use jest or vitest — use `bun:test` only
  - Do NOT add snapshot tests
  - Do NOT test Radarr API directly (mock `searchMovies`)
  - Do NOT over-test — focus on the IMDB-specific paths and the shared helper

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple test files, needs to understand existing mock patterns, mock the shared helper in command tests, and write integration tests.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Tasks 1 & 2)
  - **Blocks**: Final Verification
  - **Blocked By**: Task 1, Task 2

  **References** (CRITICAL — Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `tests/slack/commands/movie.test.ts` — Existing command tests. Follow exact same patterns: how `app` is mocked, how `command` payload is constructed, how `respond` is asserted. Add IMDB tests in the same describe block.
  - `tests/slack/actions/selectMovie.test.ts` — selectMovie test patterns. Shows how `deps` objects are mocked, how `client.chat.postMessage` is mocked, how DB functions are verified.
  - `tests/integration/flow.test.ts:29-77` — Integration test setup: `createMockApp()`, `createMockClient()`, `createMockRadarrClient()`, `mockCommandPayload()`, `mockActionPayload()`. Follow this exact pattern for the IMDB integration test.
  - `tests/config.test.ts` — Shows `_resetConfig()` in `beforeEach` pattern.
  - `tests/db/index.test.ts` — Shows `_resetDb()` + in-memory SQLite pattern.

  **API/Type References**:
  - `src/slack/helpers/submitForApproval.ts` — The helper to test. Mock this in command handler tests; test directly in helper tests.
  - `src/db/index.ts:createRequest`, `src/db/index.ts:updateRequestStatus` — Mock these in helper unit tests.

  **Acceptance Criteria**:

  - [ ] `tests/slack/helpers/submitForApproval.test.ts` exists with ≥4 test cases
  - [ ] `tests/slack/commands/movie.test.ts` has ≥4 new IMDB test cases
  - [ ] `tests/integration/flow.test.ts` has ≥1 new IMDB integration test
  - [ ] `bun test` → ALL tests pass (existing + new, zero failures)
  - [ ] `bun run typecheck` → zero errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All tests pass including new IMDB tests (happy path)
    Tool: Bash
    Preconditions: All 3 tasks applied
    Steps:
      1. Run `bun test` — capture full output
      2. Count total tests, pass count, fail count
      3. Verify new test files appear in output:
         - "tests/slack/helpers/submitForApproval.test.ts"
         - "tests/slack/commands/movie.test.ts" (with new IMDB tests)
         - "tests/integration/flow.test.ts" (with new IMDB test)
    Expected Result: All tests pass, zero failures, new test files present in output
    Failure Indicators: Any test failure, missing test file, zero new tests added
    Evidence: .sisyphus/evidence/task-3-all-tests-pass.txt

  Scenario: Typecheck passes with test files (type safety)
    Tool: Bash
    Preconditions: All 3 tasks applied
    Steps:
      1. Run `bun run typecheck` — expect exit code 0
    Expected Result: Zero type errors across all source and test files
    Failure Indicators: Any type error
    Evidence: .sisyphus/evidence/task-3-typecheck.txt
  ```

  **Commit**: YES
  - Message: `test(slack): add tests for IMDB ID detection and auto-submit flow`
  - Files: `tests/slack/helpers/submitForApproval.test.ts`, `tests/slack/commands/movie.test.ts`, `tests/integration/flow.test.ts`
  - Pre-commit: `bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bun run typecheck` + `bun test`. Review all changed files for: `as any` beyond existing `(body as any).actions[0]` pattern, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| # | Message | Files | Pre-commit |
|---|---------|-------|------------|
| 1 | `refactor(slack): extract submitMovieForApproval helper from selectMovie action` | `src/slack/helpers/submitForApproval.ts`, `src/slack/actions/selectMovie.ts` | `bun run typecheck && bun test` |
| 2 | `feat(slack): add IMDB ID/URL detection to /movie command with auto-submit` | `src/slack/commands/movie.ts`, `src/slack/index.ts` | `bun run typecheck && bun test` |
| 3 | `test(slack): add tests for IMDB ID detection and auto-submit flow` | `tests/slack/helpers/submitForApproval.test.ts`, `tests/slack/commands/movie.test.ts`, `tests/integration/flow.test.ts` | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: zero errors
bun test           # Expected: all tests pass (existing + new)
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Existing `/movie <title>` flow unchanged
- [ ] IMDB URL and bare ID both work
- [ ] Movie-not-found error message works
- [ ] Already-in-library check works
