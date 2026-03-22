# Decisions

## [2026-03-21] Architectural Decisions

### D1: Bun over Node.js
- Bun chosen for built-in TypeScript, bun:sqlite, bun:test, faster startup
- Note: If NAS is ARM and Bun doesn't work, Dockerfile can be swapped to node:alpine with minor changes
- Dependencies: better-sqlite3 would replace bun:sqlite, vitest would replace bun:test

### D2: Socket Mode for Slack (non-negotiable)
- NAS is behind NAT — no public URL available
- Socket Mode uses outbound WebSocket only — works through any firewall
- Requires App-Level Token (xapp-) with `connections:write` scope

### D3: SQLite for persistence
- Single table: `requests`
- Fields: id, movie_title, tmdb_id, imdb_id, year, poster_url, requester_slack_id, approver_slack_id, status, slack_message_ts, created_at, updated_at
- Status enum: 'pending' | 'approved' | 'rejected' | 'already_exists' | 'failed'
- Docker volume mount for persistence: `/app/data/requests.db`

### D4: Slash command + dropdown selection
- User runs `/movie The Batman` → bot searches Radarr/TMDB → returns top 5 results as dropdown
- User selects movie from dropdown → bot posts approval message to approval channel
- No NLP parsing — structured input only

### D5: Approver authorization
- APPROVER_SLACK_IDS env var = comma-separated Slack user IDs
- Anyone can request, only approvers can approve/reject
- No RBAC system, no database roles — just env var check

### D6: Two channels
- SLACK_REQUEST_CHANNEL_ID: where users make requests (public)
- SLACK_APPROVAL_CHANNEL_ID: where approval messages are posted (could be same channel or different)
- After selection, approval message goes to approval channel with approve/reject buttons

### D7: Notification strategy
- On approval: DM requester + update approval message
- On rejection: DM requester + update approval message
- On already exists: Reply in thread with status

### D8: Docker deployment
- Multi-stage Dockerfile (Bun base image)
- Non-root user for security
- Volume mount for SQLite: `./data:/app/data`
- Uses env_file for all secrets
- Network: same Docker bridge as Radarr (or host network mode)
