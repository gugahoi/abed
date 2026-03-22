
## Task 3: IMDB test suite (2026-03-22)

### Test file conventions
- `tests/slack/helpers/` directory created for helper unit tests (didn't exist before)
- `createMockClient` function signature: `postMessageImpl?: (_: any) => Promise<any>` (must accept arg, not `() => Promise<any>`)
- `flow.test.ts` `createMockClient` needed `conversations.join` added since `submitMovieForApproval` type requires it — even on happy path with no error thrown, TypeScript enforces it

### IMDB path behavior (verified by tests)
- Bare `tt\d{7,8}` → `searchMovies('imdb:<id>')`
- Full IMDB URL → extracts ID → same `searchMovies('imdb:<id>')` call
- Empty results → ephemeral respond with the IMDB ID in the message
- `movieExists: true` → ephemeral "already in the library" (via `submitMovieForApproval`)
- Happy path → ephemeral "submitted for approval"
- Plain title → normal search path, results cached (no IMDB branch)

### Test counts
- Before: 70 tests
- After: 82 tests (+12: 4 helper unit, 6 command IMDB, 2 integration IMDB)
