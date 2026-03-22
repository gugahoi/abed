# Issues

## [2026-03-21] Known Gotchas to Watch For

### Issue 1: Slack action handler timing
- CRITICAL: Must call `await ack()` BEFORE any async work
- Slack has 3-second timeout on action handlers
- Failure to ack causes user to see "operation failed" even if work succeeded
- Pattern: ack() → process → update message

### Issue 2: Radarr movie lookup vs add payload
- `/movie/lookup?term=...` returns SearchMovie objects (different shape from Movie objects)
- When adding: must use the SearchMovie result directly with added fields (qualityProfileId, rootFolderPath, monitored, minimumAvailability)
- Do NOT try to reconstruct from scratch — pass through the lookup result

### Issue 3: Bun:sqlite in Docker
- Bun's Docker image is `oven/bun:1` or `oven/bun:alpine`
- bun:sqlite is built-in — no native compilation needed (unlike better-sqlite3)
- Data directory must exist before bot starts: add `RUN mkdir -p /app/data` to Dockerfile

### Issue 4: Approver check race condition
- Two approvers could click simultaneously
- Handle: check status in DB before processing — if already approved/rejected, just ack() and do nothing

### Issue 5: Movie selection state
- When user selects movie from dropdown, the original search results disappear
- State bridging: use Slack block's `value` field to encode movie metadata (TMDB ID + title + year) as JSON string
- Alternative: store pending selections in DB with short TTL

### Issue 6: Block Kit message update after action
- After approve/reject, update the original message to show status
- Use `client.chat.update({ channel, ts: message_ts, blocks: [...] })`
- Need to store message_ts in DB when approval message is first posted

### Issue 8: Docker Compose `version` field obsolete
- Compose v2+ ignores the top-level `version` field and warns about it
- Omit `version:` entirely from docker-compose.yml to avoid confusion
- `docker-compose config` exits 1 if `env_file` references a file that doesn't exist at config-parse time
- For validation with missing .env: temporarily copy .env.example → .env, validate, then delete it
- `bun.lock` (text format, Bun v1.x) — use `bun.lock*` glob in COPY to handle both bun.lock and bun.lockb

### Issue 7: Block Kit static_select option value length limit
- Slack `static_select` option `value` field is capped at 150 chars
- Full JSON-encoded movie data (title, year, tmdbId, imdbId, posterUrl, titleSlug, images, overview) can easily exceed 150 chars for movies with long titles/overviews
- Decision in this codebase: encode full metadata with long field names in `buildSearchResultsMessage` — action handlers must validate/truncate if the value exceeds the limit at runtime
- Safer alternative: encode only `tmdbId` as the value and look up movie data from DB in the select action handler
- Watch for: Slack silently rejects payloads with option values >150 chars; no client-side error — just the action never fires
