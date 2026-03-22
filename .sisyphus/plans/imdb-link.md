# Movie Bot — IMDB Link Support

## Overview

Allow users to type `/movie https://www.imdb.com/title/tt1234567/` (or any IMDB URL variant) and have the bot detect it, extract the IMDB ID, look up the movie via Radarr's API, and continue through the existing selection → approval → add flow without any changes to downstream handlers.

## Research Findings

### IMDB URL patterns to handle
- `https://www.imdb.com/title/tt1234567`
- `https://www.imdb.com/title/tt1234567/`
- `https://m.imdb.com/title/tt1234567/`
- `http://imdb.com/title/tt1234567`
- Bare IMDB ID: `tt1234567` (optional nice-to-have, same regex captures it)

Extraction regex: `/tt\d+/` — matches the IMDB ID anywhere in the string.

### Radarr API for IMDB lookup
Two confirmed approaches (from Radarr openapi.json + real-world usage in Tdarr tests):
1. **`GET /api/v3/movie/lookup?term=imdb:tt1234567`** — the standard lookup endpoint with `imdb:` prefix. Returns `RadarrSearchResult[]` (same shape as a title search). **Preferred** — same endpoint, same return type, zero new API surface.
2. `GET /api/v3/movie/lookup/imdb?imdbId=tt1234567` — dedicated endpoint (different return type, more complex integration).

**Decision**: Use approach 1 (`term=imdb:<id>`) — plugs directly into the existing `searchMovies(query)` call by passing `"imdb:tt1234567"` as the term. No new Radarr client method needed; no changes to downstream action handlers.

### Flow for IMDB link input
```
User: /movie https://www.imdb.com/title/tt1877830/
  │
  ▼ movie.ts: detectImdbId(query) → "tt1877830"
  │           searchMovies("imdb:tt1877830")
  ▼
Radarr returns [{ title: "The Batman", year: 2022, tmdbId: 12345, ... }]
  │
  ├─ 0 results → respond "No movie found for that IMDB link"
  │
  └─ 1+ results → storeResults + buildSearchResultsMessage (same as title search)
       ▼ (user picks from dropdown — or if exactly 1 result, could still show dropdown)
  Existing selectMovie → approveMovie → rejectMovie (UNCHANGED)
```

## Scope of Changes

| File | What changes |
|---|---|
| `src/slack/commands/movie.ts` | Detect IMDB URL/ID in query; extract ID; prefix with `imdb:` before calling `searchMovies`; update usage message |
| `tests/slack/commands/movie.test.ts` | Add tests for IMDB URL input: correct `imdb:tt…` query sent to Radarr, results cached, dropdown shown; invalid IMDB URL error; no-results path |

**No other files change.** The Radarr client, DB, message builders, and action handlers are untouched.

## TODOs

- [ ] **T1**: `src/slack/commands/movie.ts` — add `extractImdbId(text: string): string | null` helper (pure function, exported for testability) that matches `/tt\d+/i` against the input and returns the bare ID (e.g. `"tt1877830"`) or `null`. In the command handler: if `extractImdbId(query)` returns a non-null id, pass `"imdb:<id>"` as the search term to `radarrClient.searchMovies()`; update the usage hint to include the IMDB link example: `` `/movie <title>` or `/movie <imdb url>` ``.

- [ ] **T2**: `tests/slack/commands/movie.test.ts` — add test cases:
  1. Full IMDB URL (`https://www.imdb.com/title/tt1877830/`) → `searchMovies` called with `"imdb:tt1877830"`
  2. Mobile IMDB URL (`https://m.imdb.com/title/tt0111161`) → `searchMovies` called with `"imdb:tt0111161"`
  3. Bare IMDB ID (`tt0111161`) → `searchMovies` called with `"imdb:tt0111161"`
  4. No results from IMDB lookup → responds with no-results message (reuses existing no-results path)
  5. `extractImdbId` unit tests: valid URLs → correct ID; non-IMDB text → null; plain title → null

## Final Verification Wave

- [ ] **F1** (Code Review): `src/slack/commands/movie.ts` reviewed — `extractImdbId` is a pure exported function, regex is correct (`/tt\d+/i`), `imdb:` prefix only applied when IMDB ID detected, usage message updated, no regressions to title-search path, TypeScript strict mode zero errors.
- [ ] **F2** (Tests): `bun test` all green — all new IMDB test cases pass, all existing tests unaffected.
