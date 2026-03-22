# movie-bot

A Slack bot that lets users request movies directly from Slack. Users run `/movie <title>`, the bot searches Radarr and presents a dropdown of results. Once a user selects a movie, an approval request is posted to a dedicated channel with Approve/Reject buttons. When an approver clicks Approve, the movie is automatically added to Radarr and the requester gets a DM confirmation. Built with [@slack/bolt](https://github.com/slackapi/bolt-js) v4 using Socket Mode — no public URL needed, works behind NAT/firewall on a NAS. Runs on Bun, stores request history in SQLite, and deploys via Docker.

---

## Features

- `/movie <title>` slash command that searches Radarr and returns an interactive dropdown of up to 25 results
- Approval workflow with a dedicated channel and Approve/Reject buttons
- Permission-based approvals — only users listed in `APPROVER_SLACK_IDS` can approve requests
- Duplicate detection — skips adding a movie if it already exists in the Radarr library
- Persistent request tracking via SQLite
- Docker-deployable alongside Radarr on a NAS
- Socket Mode — works behind NAT with no public URL or reverse proxy required

---

## Architecture

```
User → /movie <title>
         │
         ▼
  Bot searches Radarr API
         │
         ▼
  Dropdown of results sent ephemerally to user
         │
         ▼ (user selects a movie)
  Approval message posted to #approval-channel
  with [Approve] and [Reject] buttons
         │
         ├──► Approver clicks Approve
         │         │
         │         ▼
         │    Radarr adds movie
         │    Approval message updated → "Approved"
         │    Requester receives DM ✅
         │
         └──► Approver clicks Reject
                   │
                   ▼
              Approval message updated → "Rejected"
              Requester receives DM ❌
```

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)
- A Slack workspace where you have admin access to create apps
- A running [Radarr](https://radarr.video/) instance (on a NAS or elsewhere on the network)

---

## Slack App Setup

### 1. Create the App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App → From Scratch**
2. Name it `movie-bot` and select your workspace
3. Click **Create App**

### 2. Enable Socket Mode

1. In the left sidebar, go to **Settings → Socket Mode**
2. Toggle **Enable Socket Mode** to ON
3. Click **Generate an app-level token** with the scope `connections:write`
4. Name it anything (e.g. `socket-token`) and click **Generate**
5. Copy the token — it starts with `xapp-`. Save it as `SLACK_APP_TOKEN`

### 3. Add Bot Token Scopes

1. Go to **OAuth & Permissions** in the left sidebar
2. Under **Bot Token Scopes**, add the following scopes:
   - `chat:write`
   - `commands`
   - `im:write`

### 4. Create the Slash Command

1. Go to **Slash Commands → Create New Command**
2. Fill in:
   - **Command**: `/movie`
   - **Request URL**: any URL (e.g. `https://example.com`) — Socket Mode ignores it
   - **Short Description**: `Request a movie`
3. Click **Save**

### 5. Enable Interactivity

1. Go to **Interactivity & Shortcuts**
2. Toggle **Interactivity** to ON
3. Set the **Request URL** to any URL (e.g. `https://example.com`) — Socket Mode ignores it
4. Click **Save Changes**

### 6. Install to Workspace

1. Go to **OAuth & Permissions → Install to Workspace**
2. Click **Allow**
3. Copy the **Bot User OAuth Token** — it starts with `xoxb-`. Save it as `SLACK_BOT_TOKEN`

### 7. Get Channel IDs

Right-click any channel in Slack → **View channel details** → scroll down to copy the **Channel ID** (starts with `C`). You'll need this for `SLACK_REQUEST_CHANNEL_ID` and `SLACK_APPROVAL_CHANNEL_ID`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in each value:

```bash
cp .env.example .env
```

| Variable | Required | Description | Example |
|---|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | Bot User OAuth Token | `xoxb-...` |
| `SLACK_APP_TOKEN` | Yes | App-Level Token (Socket Mode) | `xapp-...` |
| `SLACK_REQUEST_CHANNEL_ID` | Yes | Channel where users make requests | `C0123456789` |
| `SLACK_APPROVAL_CHANNEL_ID` | Yes | Channel where approval messages appear | `C9876543210` |
| `RADARR_URL` | Yes | Radarr base URL | `http://192.168.1.100:7878` |
| `RADARR_API_KEY` | Yes | Radarr API key | `abc123...` |
| `APPROVER_SLACK_IDS` | Yes | Comma-separated Slack user IDs allowed to approve | `U123ABC,U456DEF` |
| `RADARR_QUALITY_PROFILE_ID` | Yes | Numeric ID of the Radarr quality profile to use | `4` |
| `RADARR_ROOT_FOLDER_PATH` | Yes | Root folder path configured in Radarr | `/movies` |
| `DB_PATH` | No | SQLite DB file path (default: `./data/requests.db`) | `/app/data/requests.db` |

---

## Radarr Setup

### Get Your API Key

In Radarr, go to **Settings → General → Security → API Key** and copy it.

### Get Your Quality Profile ID

Visit the following URL in a browser (replace with your Radarr URL and API key):

```
http://<radarr-url>/api/v3/qualityProfile?apikey=<your-api-key>
```

This returns a JSON array of quality profiles. Find the profile you want and note its `id` field. Use that as `RADARR_QUALITY_PROFILE_ID`.

### Get Your Root Folder Path

```
http://<radarr-url>/api/v3/rootFolder?apikey=<your-api-key>
```

Note the `path` field of your desired root folder (e.g. `/movies`). Use that as `RADARR_ROOT_FOLDER_PATH`.

### Find Approver Slack User IDs

In Slack, click on a user's profile → click the **⋮** (More) menu → **Copy member ID**. The ID starts with `U`. Add one or more (comma-separated) to `APPROVER_SLACK_IDS`.

---

## Docker Deployment on NAS

```bash
# 1. Clone the repo
git clone <repo-url>
cd movie-bot

# 2. Create your .env file
cp .env.example .env
# Edit .env with your actual values

# 3. Create the Docker network (if it doesn't exist)
docker network create media

# 4. Start the bot
docker compose up -d

# 5. Check logs
docker compose logs -f movie-bot
```

> **Note on networking:** The `docker-compose.yml` attaches the bot to a `media` external Docker network. This is the same network Radarr should be running on, allowing the bot to reach Radarr by container name (e.g. `http://radarr:7878`). If Radarr is **not** on the same Docker network, set `RADARR_URL` to the host machine's LAN IP address instead (e.g. `http://192.168.1.100:7878`). Do **not** use `localhost` — inside a container, `localhost` refers to the container itself.

> **Data persistence:** The `./data` directory on the host is mounted to `/app/data` inside the container. This is where SQLite stores the requests database. Make sure `./data` exists and is writable on the host before starting.

---

## Local Development

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Copy and fill in env vars
cp .env.example .env

# Run in development mode (auto-reload on file changes)
bun run dev

# Run tests
bun test

# Type check
bun run typecheck
```

---

## How It Works

1. **User types `/movie The Batman`** in any channel
2. **Bot searches Radarr** and responds ephemerally (visible only to the user) with a dropdown of up to 25 matching results
3. **User selects a movie** from the dropdown
4. **Bot posts an approval request** to the `SLACK_APPROVAL_CHANNEL_ID` channel, including movie details and **Approve** / **Reject** buttons
5. **An approver** (a user whose Slack ID is listed in `APPROVER_SLACK_IDS`) clicks **Approve**
6. **Bot calls the Radarr API** to add the movie using the configured quality profile and root folder path
7. **Approval message is updated** to show "Approved ✅" and the requester receives a DM confirming the movie was added
8. **If Reject is clicked instead:** the approval message is updated to show "Rejected ❌" and the requester receives a DM informing them

> **Duplicate detection:** Before adding a movie to Radarr, the bot checks whether it's already in the library. If it is, it skips the API call and notifies accordingly.

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Bot doesn't respond to `/movie` | Wrong `SLACK_BOT_TOKEN` or Socket Mode not enabled | Verify the token starts with `xoxb-`. Check that Socket Mode is ON in the Slack app settings under **Settings → Socket Mode** |
| "You are not authorized to approve" | User's Slack ID is not in `APPROVER_SLACK_IDS` | Get the user's Slack member ID (click their profile → ⋮ → Copy member ID) and add it to `APPROVER_SLACK_IDS` in `.env` |
| Movie not added to Radarr after approval | Wrong `RADARR_URL`, `RADARR_API_KEY`, or `RADARR_QUALITY_PROFILE_ID` | Test the API key: `curl "<radarr-url>/api/v3/system/status?apikey=<key>"`. Verify the quality profile ID exists at `/api/v3/qualityProfile` |
| Container can't reach Radarr | Using `localhost` for `RADARR_URL` | Use the host machine's LAN IP (e.g. `http://192.168.1.100:7878`), not `localhost` — containers don't share the host's localhost |
| Approval buttons do nothing | Interactivity not enabled in Slack app | Go to **Interactivity & Shortcuts** in the Slack app settings and make sure Interactivity is toggled ON (any request URL works with Socket Mode) |
| SQLite errors or data not persisting between restarts | Volume not mounted or `./data` directory not writable | Ensure the `./data:/app/data` volume binding is in `docker-compose.yml` and that `./data` exists and is writable on the host |
