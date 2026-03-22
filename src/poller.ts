import type { WebClient } from '@slack/web-api';
import type { RadarrClient } from './radarr/client';
import type { SonarrClient } from './sonarr/client';
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
  slackClient: WebClient;
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
    await pollTvDownloads(deps.slackClient, deps.sonarrClient);
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

      markDownloadNotified(request.id);

      await deps.slackClient.chat.postMessage({
        channel: request.requester_slack_id,
        text: `:popcorn: *${request.movie_title} (${request.year})* is ready to watch!`,
      });

      log.info('Download notification sent', { movie: `${request.movie_title} (${request.year})`, user: request.requester_slack_id });
    } catch (error) {
      log.error('Failed to check movie download status', {
        tmdbId: request.tmdb_id,
        title: request.movie_title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function pollTvDownloads(slackClient: WebClient, sonarrClient: SonarrClient): Promise<void> {
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

      markTvDownloadNotified(request.id);

      const episodeInfo = `${stats.episodeFileCount}/${stats.episodeCount} episodes`;
      await slackClient.chat.postMessage({
        channel: request.requester_slack_id,
        text: `:tv: *${request.show_title} (${request.year})* has started downloading! (${episodeInfo} available)`,
      });

      log.info('TV download notification sent', { show: `${request.show_title} (${request.year})`, user: request.requester_slack_id });
    } catch (error) {
      log.error('Failed to check TV show download status', {
        tvdbId: request.tvdb_id,
        title: request.show_title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
