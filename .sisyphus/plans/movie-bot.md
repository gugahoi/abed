# Movie Bot — Slack + Radarr Integration

## Overview

A Slack bot that monitors a channel for movie requests. Users request movies via a slash command or message prefix. Requests are triaged by approved users who can approve or reject via interactive Slack buttons. Approved movies are automatically added to Radarr (running on NAS). Deployed as a Docker container on the NAS alongside Radarr.

## Tech Stack

- **Runtime**: Bun (TypeScript, strict mode)
- **Slack**: @slack/bolt v4 with Socket Mode (no public URL needed)
- **HTTP**: Built-in fetch (no axios)
- **Database**: SQLite via `bun:sqlite` for request tracking
- **Testing**: `bun:test`
- **Deployment**: Docker + docker-compose.yml on NAS

## Architecture

```
Slack Channel
    ↓ /movie <title> or !movie <title>
Slack Bot (Socket Mode)
    ↓ Radarr /movie/lookup → present search results
    ↓ User selects movie
    ↓ Post approval message to #movies-approval channel (or same channel)
Approvers (configured Slack user IDs)
    ↓ Click "Approve" button
Radarr API
    ↓ POST /api/v3/movie
NAS Radarr → download movie
    ↓
Notify requester via DM
```

## Project Structure

```
movie-bot/
├── src/
│   ├── config/         # env loading, validation
│   ├── radarr/         # Radarr API client
│   ├── db/             # SQLite schema + CRUD
│   ├── slack/          # Bolt app, handlers
│   │   ├── commands/   # slash command handlers
│   │   ├── actions/    # button action handlers
│   │   └── messages/   # Block Kit message builders
│   └── index.ts        # entry point
├── tests/
│   ├── radarr/
│   ├── db/
│   └── slack/
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## TODOs

- [x] **T1**: Scaffold project — `bun init`, tsconfig.json, .gitignore, package.json with @slack/bolt dependency, directory structure (`src/config`, `src/radarr`, `src/db`, `src/slack/commands`, `src/slack/actions`, `src/slack/messages`, `tests/`)
- [x] **T2**: Configuration module — `src/config/index.ts` that loads + validates all env vars (SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_REQUEST_CHANNEL_ID, SLACK_APPROVAL_CHANNEL_ID, RADARR_URL, RADARR_API_KEY, APPROVER_SLACK_IDS, RADARR_QUALITY_PROFILE_ID, RADARR_ROOT_FOLDER_PATH). Create `.env.example`. Test: config throws on missing required vars.
- [x] **T3**: Radarr API client — `src/radarr/client.ts` with typed methods: `searchMovies(query)`, `addMovie(movie, qualityProfileId, rootFolderPath)`, `movieExists(tmdbId)`, `getQualityProfiles()`, `getRootFolders()`. Use built-in fetch with `X-Api-Key` header. Test with mocked fetch responses.
- [x] **T4**: Database layer — `src/db/index.ts` with SQLite schema (requests table: id, movie_title, tmdb_id, imdb_id, year, poster_url, requester_slack_id, approver_slack_id, status, slack_message_ts, created_at, updated_at). CRUD: `createRequest`, `getRequest`, `updateRequestStatus`, `getRequestByTmdbId`. Test with in-memory SQLite.
- [x] **T5**: Block Kit message builders — `src/slack/messages/index.ts` with functions: `buildSearchResultsMessage(movies[])` (static_select dropdown), `buildApprovalRequestMessage(movie, requester)` (approve/reject buttons), `buildApprovedMessage(movie)`, `buildRejectedMessage(movie, reason?)`. Test: verify block structure matches Slack Block Kit schema.
- [x] **T6**: Slack app bootstrap + `/movie` command handler — `src/slack/index.ts` (Bolt app + Socket Mode), `src/slack/commands/movie.ts` (handles `/movie <title>`: validate input → search Radarr → post search results with dropdown). Test: mock Slack event simulation.
- [x] **T7**: Movie selection + approval flow — `src/slack/actions/selectMovie.ts` (user selects from search results → post approval message to approval channel), `src/slack/actions/approveMovie.ts` (approver clicks approve → check permissions → add to Radarr → update DB → notify requester), `src/slack/actions/rejectMovie.ts` (approver clicks reject → update DB → notify requester). Test: mock action payloads.
- [x] **T8**: Entry point + startup checks — `src/index.ts` (import app, run startup checks: verify Radarr connection, verify Slack connection, log quality profiles and root folders), graceful shutdown on SIGTERM/SIGINT.
- [x] **T9**: Docker deployment — `Dockerfile` (multi-stage, Bun base image, non-root user), `docker-compose.yml` (bot service with env_file, volumes for SQLite, network bridge to reach Radarr), `.env.example` complete with all vars. Verify: `docker build .` exits 0, `docker compose config` validates.
- [x] **T10**: End-to-end integration test — `tests/integration/flow.test.ts` simulates full flow: request → search results → movie selection → approval message → approve action → Radarr add called with correct payload → DB updated → requester notified. Uses mocked Radarr HTTP server and mock Slack client.

## Final Verification Wave

- [x] **F1** (Code Review): All source files reviewed for correctness, no TODOs/stubs/hardcoded values, proper error handling, follows module structure. TypeScript strict mode — zero type errors.
- [x] **F2** (Test Coverage): All unit tests pass (`bun test`). Radarr client tested with mocked HTTP. DB tested with in-memory SQLite. Slack handlers tested with mocked event/action payloads. Coverage ≥ 80% on `src/`.
- [x] **F3** (Docker): `docker build .` exits 0. `docker compose config` exits 0. Container starts and logs "Connected to Slack" when env vars are valid (can be verified with mock tokens in test env).
- [x] **F4** (Documentation): README.md covers setup, env vars, Slack app configuration steps, Radarr setup, Docker deployment on NAS, and troubleshooting common issues.
