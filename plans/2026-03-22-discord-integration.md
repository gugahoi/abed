# Plan: Discord Integration
Date: 2026-03-22

This document tracks the progress of adding Discord support to `abed` while maintaining the existing Slack functionality and project conventions.

## Phase 1: Environment & Configuration
- [x] **Install Dependencies**: Add `discord.js` for interacting with the Discord API.
- [x] **Update Environment Variables**: Add Discord-specific variables to `.env.example`, `src/config/index.ts`, and `unraid/abed.xml`:
  - `DISCORD_BOT_TOKEN`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_GUILD_ID` (Useful for instant slash command registration)
  - `DISCORD_REQUEST_CHANNEL_ID`
  - `DISCORD_APPROVAL_CHANNEL_ID`
  - `APPROVER_DISCORD_IDS`
- [x] **App Initialization**: Update `src/index.ts` to conditionally start the Slack app, the Discord app, or both, depending on which tokens are provided in the environment.

## Phase 2: Database & State Updates
- [x] **Database Schema**: Add a new column to the requests table (e.g., `platform TEXT DEFAULT 'slack'`) in `src/db/index.ts` to differentiate where the request originated. This ensures DMs and updates are routed to the correct platform.
- [x] **Search Cache Refactor**: Move or generalize `src/slack/searchCache.ts` to `src/core/searchCache.ts` so both Slack and Discord can use the same in-memory Map (keying by `platform_userId` instead of just `userId`).

## Phase 3: Core Logic Abstraction
Currently, the business logic is tightly coupled to Slack action handlers. We need to extract this into platform-agnostic service functions (e.g., in a new `src/core/` directory).
- [ ] **Search Logic**: Abstract the Radarr/Sonarr search.
- [ ] **Selection Logic**: Abstract checking for duplicates, inserting the DB record, and formatting the movie/tv data.
- [ ] **Approval Logic**: Abstract the Radarr/Sonarr API add calls and DB status updates. (Both `src/slack/...` and `src/discord/...` will call these shared core functions).

## Phase 4: Discord Implementation (`src/discord/`)
Create a parallel folder structure to Slack:
- [ ] **Setup & Registration (`index.ts`)**: Initialize the `discord.js` Client. Register Discord Application Commands (Slash Commands) on startup.
- [ ] **Commands (`commands/`)**:
  - `/movie` & `/tv`: Call the core search logic, return a Discord Embed with a `StringSelectMenuBuilder` (dropdown) for the 25 results.
  - `/myrequests`: Query the DB by Discord user ID and return an ephemeral Embed.
- [ ] **Messages (`messages/`)**: Create builders for Discord Embeds and Message Components (Approve/Reject `ButtonBuilder`s).
- [ ] **Actions/Interactions (`actions/`)**:
  - **Select Menu Handler**: Receive the dropdown selection, create the DB entry, and post the Embed with Approve/Reject buttons to the Discord approval channel.
  - **Button Handlers**: Check if the clicking user is in `APPROVER_DISCORD_IDS`. If yes, call the core approval logic, update the approval message embed, and DM the requesting user.

## Phase 5: Testing & Documentation
- [ ] **Unit Tests**: Create `tests/discord/` mirroring the structure. Use `mock()` from `bun:test` to mock `discord.js` client interactions.
- [ ] **Documentation**: Update `README.md` with a new "Discord App Setup" section (OAuth2 URL generation, bot token scopes: `Send Messages`, `Use Slash Commands`, `Embed Links`).
