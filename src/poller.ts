import type { WebClient } from '@slack/web-api';
import type { Client as DiscordClient } from 'discord.js';
import type { RadarrClient } from './radarr/client';
import type { SonarrClient } from './sonarr/client';
import type { MovieRequest, TvRequest } from './db/types';
import {
  getApprovedUnnotifiedRequests,
  getApprovedUnnotifiedTvRequests,
  markDownloadNotified,
  markTvDownloadNotified,
} from './db/index';
import { createLogger } from './logger';

const log = createLogger('poller');

const DEFAULT_POLL_INTERVAL_MS = 15 * 60 * 1000;

export type PollerDeps = {
  slackClient?: WebClient | null;
  discordClient?: DiscordClient | null;
  radarrClient: RadarrClient;
  sonarrClient: SonarrClient | null;
  pollIntervalMs?: number;
};

let _timer: ReturnType<typeof setInterval> | null = null;

export function startPoller(deps: PollerDeps): void {
  if (_timer) {
    log.warn('Poller already running, skipping duplicate start');
    return;
  }

  const intervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  log.info('Download status poller started', { intervalMs });

  _timer = setInterval(() => {
    pollDownloads(deps).catch((error) => {
      log.error('Poller tick failed', { error: error instanceof Error ? error.message : String(error) });
    });
  }, intervalMs);
}

export function stopPoller(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    log.info('Download status poller stopped');
  }
}

export function _resetPoller(): void {
  stopPoller();
}

async function pollDownloads(deps: PollerDeps): Promise<void> {
  await pollMovieDownloads(deps);
  if (deps.sonarrClient) {
    await pollTvDownloads(deps);
  }
}

async function sendNotification(
  deps: PollerDeps,
  request: MovieRequest | TvRequest,
  message: string,
): Promise<boolean> {
  const platform = request.platform;

  if (platform === 'discord') {
    if (!deps.discordClient) {
      log.warn('Discord client not available, skipping notification', { user: request.requester_slack_id, platform });
      return false;
    }
    try {
      const user = await deps.discordClient.users.fetch(request.requester_slack_id);
      await user.send(message);
      return true;
    } catch (error) {
      log.warn('Failed to DM requester on Discord', {
        user: request.requester_slack_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  if (!deps.slackClient) {
    log.warn('Slack client not available, skipping notification', { user: request.requester_slack_id, platform });
    return false;
  }
  try {
    await deps.slackClient.chat.postMessage({
      channel: request.requester_slack_id,
      text: message,
    });
    return true;
  } catch (error) {
    log.warn('Failed to DM requester on Slack', {
      user: request.requester_slack_id,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function pollMovieDownloads(deps: PollerDeps): Promise<void> {
  const requests = getApprovedUnnotifiedRequests();
  if (requests.length === 0) return;

  log.debug('Checking movie downloads', { count: requests.length });

  for (const request of requests) {
    try {
      const movie = await deps.radarrClient.getMovieByTmdbId(request.tmdb_id);
      if (!movie) {
        log.warn('Movie not found in Radarr', { tmdbId: request.tmdb_id, title: request.movie_title });
        continue;
      }

      if (!movie.hasFile) continue;

      const message = request.platform === 'discord'
        ? `🍿 **${request.movie_title} (${request.year})** is ready to watch!`
        : `:popcorn: *${request.movie_title} (${request.year})* is ready to watch!`;

      const sent = await sendNotification(deps, request, message);
      if (sent) {
        markDownloadNotified(request.id);
        log.info('Download notification sent', {
          movie: `${request.movie_title} (${request.year})`,
          user: request.requester_slack_id,
          platform: request.platform,
        });
      }
    } catch (error) {
      log.error('Failed to check movie download status', {
        tmdbId: request.tmdb_id,
        title: request.movie_title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function pollTvDownloads(deps: PollerDeps): Promise<void> {
  const sonarrClient = deps.sonarrClient!;
  const requests = getApprovedUnnotifiedTvRequests();
  if (requests.length === 0) return;

  log.debug('Checking TV show downloads', { count: requests.length });

  for (const request of requests) {
    try {
      const series = await sonarrClient.getSeriesByTvdbId(request.tvdb_id);
      if (!series) {
        log.warn('Series not found in Sonarr', { tvdbId: request.tvdb_id, title: request.show_title });
        continue;
      }

      const stats = series.statistics;
      if (!stats || stats.episodeFileCount === 0) continue;

      const episodeInfo = `${stats.episodeFileCount}/${stats.episodeCount} episodes`;
      const message = request.platform === 'discord'
        ? `📺 **${request.show_title} (${request.year})** has started downloading! (${episodeInfo} available)`
        : `:tv: *${request.show_title} (${request.year})* has started downloading! (${episodeInfo} available)`;

      const sent = await sendNotification(deps, request, message);
      if (sent) {
        markTvDownloadNotified(request.id);
        log.info('TV download notification sent', {
          show: `${request.show_title} (${request.year})`,
          user: request.requester_slack_id,
          platform: request.platform,
        });
      }
    } catch (error) {
      log.error('Failed to check TV show download status', {
        tvdbId: request.tvdb_id,
        title: request.show_title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
