# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-21

## OVERVIEW

Slack bot for movie requests with approval workflow. Users `/movie <title>` → select from dropdown → approval posted to channel → approver Approve/Reject → Radarr adds movie. Built on `@slack/bolt` v4 (Socket Mode), Bun runtime, SQLite via `bun:sqlite`.

## STRUCTURE

```
movie-bot/
├── src/
│   ├── index.ts              # Entry point: config → Radarr healthcheck → DB init → Slack app start + graceful shutdown
│   ├── config/index.ts       # Env var parser — singleton with _resetConfig() for tests
│   ├── db/
│   │   ├── index.ts          # SQLite CRUD — singleton with _resetDb() for tests, in-memory via getDb(':memory:')
│   │   └── types.ts          # MovieRequest, CreateRequestInput, UpdateRequestStatusInput, RequestStatus
│   ├── radarr/
│   │   ├── client.ts         # RadarrClient class — fetch wrapper for /api/v3/*
│   │   └── types.ts          # RadarrSearchResult, RadarrMovie, AddMoviePayload, etc.
│   └── slack/
│       ├── index.ts          # createSlackApp() — wires all handlers to App instance
│       ├── searchCache.ts    # In-memory Map<userId, results> with 5min TTL
│       ├── commands/
│       │   └── movie.ts      # /movie command handler — search + cache + respond with dropdown
│       ├── actions/
│       │   ├── selectMovie.ts   # Dropdown selection → check exists → DB insert → post approval msg
│       │   ├── approveMovie.ts  # Approve button → auth check → re-search Radarr → addMovie → DM requester
│       │   └── rejectMovie.ts   # Reject button → auth check → update DB → update msg → DM requester
│       └── messages/
│           ├── index.ts      # Block Kit message builders (search results, approval, approved, rejected)
│           └── types.ts      # Slack Block Kit type subset (Block, TextObject, ButtonElement, etc.)
├── tests/                    # Mirrors src/ — bun:test with mock() helpers
│   ├── config.test.ts
│   ├── db/index.test.ts
│   ├── radarr/client.test.ts
│   ├── slack/
│   │   ├── messages.test.ts
│   │   ├── commands/movie.test.ts
│   │   └── actions/{selectMovie,approveMovie,rejectMovie}.test.ts
│   └── integration/flow.test.ts  # Full flow: command → select → approve/reject
├── data/                     # SQLite DB files (gitignored)
├── Dockerfile                # Multi-stage: oven/bun:1 builder → oven/bun:1-alpine runtime, non-root user
└── docker-compose.yml        # Single service on external "media" network, mounts ./data:/app/data
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new slash command | `src/slack/commands/` + register in `src/slack/index.ts` | Follow `/movie` pattern |
| Add new button action | `src/slack/actions/` + register in `src/slack/index.ts` | Follow approve/reject pattern |
| Change approval message UI | `src/slack/messages/index.ts` | Block Kit builders |
| Add new Slack Block Kit element | `src/slack/messages/types.ts` | Custom type subset, not @slack/types |
| Add Radarr API call | `src/radarr/client.ts` | Uses private `request<T>()` helper |
| Add DB column/table | `src/db/index.ts` (schema) + `src/db/types.ts` (types) | Schema in `initSchema()` |
| Add env var | `src/config/index.ts` + `.env.example` | Use `required()` helper, update Config type |
| Understand data flow | `tests/integration/flow.test.ts` | Shows full command → approval cycle |

## CONVENTIONS

- **Singleton + reset pattern**: Config and DB use module-level singletons (`_config`, `_db`) with exported `_reset*()` functions for test isolation. Always call reset in `beforeEach`.
- **Handler registration**: Each Slack handler is a `register*()` function taking `(app, deps)`. Dependencies are explicit objects, not global imports.
- **Dependency injection via deps object**: Action handlers receive typed deps (`RadarrClient`, channel IDs, approver IDs) — no direct env access outside `config/`.
- **`(body as any).actions[0]`**: Bolt v4 typing gaps — action payloads are cast. Don't try to fix this, it's intentional.
- **Search cache**: In-memory `Map` keyed by Slack user ID. 5min TTL. `storeResults` on search, `clearResults` after selection. Not persisted across restarts.
- **Tests use `mock()` from `bun:test`**: No jest, no vitest. Mock functions via `mock()`, mock fetch by assigning `globalThis.fetch`.
- **Tests use in-memory SQLite**: `getDb(':memory:')` in `beforeEach` after `_resetDb()`.
- **No barrel exports at action/command level**: Only `messages/` and `db/` have `index.ts` barrels. Import actions/commands directly.

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** access `process.env` outside `src/config/index.ts` (exception: `DB_PATH` in `src/db/index.ts`)
- **DO NOT** use `@slack/types` for Block Kit — use local `src/slack/messages/types.ts` subset
- **DO NOT** store full movie data in Slack action values — Slack has 150-char limit. Use `tmdbId` only, look up from cache.
- **DO NOT** add global `fetch` mocks — each test assigns `globalThis.fetch` locally
- **DO NOT** import RadarrClient directly in action handlers — receive via deps injection

## COMMANDS

```bash
bun run dev          # Dev mode with auto-reload (bun --watch src/index.ts)
bun run start        # Production: bun run src/index.ts
bun test             # All tests (bun:test)
bun run typecheck    # tsc --noEmit (strict mode, noUncheckedIndexedAccess)

# Docker
docker compose up -d              # Start on "media" network
docker compose logs -f movie-bot  # Tail logs
```

## NOTES

- **Socket Mode only** — no HTTP server, no public URL needed. Works behind NAT.
- **Radarr connection is non-blocking** — bot starts even if Radarr is down; API calls will fail at request time.
- **not_in_channel auto-join**: `selectMovie` catches `not_in_channel` error and auto-joins the approval channel before retrying.
- **Race condition guard**: approve/reject silently return if `request.status !== 'pending'` — prevents double-processing when two approvers click simultaneously.
- **`DB_PATH` default**: `./data/requests.db` locally, overridden to `/app/data/requests.db` via docker-compose env.
- **No migrations**: Schema uses `CREATE TABLE IF NOT EXISTS` — additive changes only. Destructive schema changes require manual DB handling.
- **tsconfig strict**: `strict: true` + `noUncheckedIndexedAccess: true` + `verbatimModuleSyntax: true`. All imports must use explicit `type` keyword for type-only imports.
