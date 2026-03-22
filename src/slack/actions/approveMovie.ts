import type { App } from '@slack/bolt';
import type { RadarrClient } from '../../radarr/client';
import { buildApprovedMessage, ACTION_IDS } from '../messages/index';
import { getRequestByTmdbId, updateRequestStatus } from '../../db/index';
import { createLogger } from '../../logger';

const log = createLogger('approve');

type ApproveMovieDeps = {
  radarrClient: RadarrClient;
  approverSlackIds: string[];
  approvalChannelId: string;
  qualityProfileId: number;
  rootFolderPath: string;
};

export function registerApproveMovieAction(app: App, deps: ApproveMovieDeps): void {
  app.action(ACTION_IDS.APPROVE_MOVIE, async ({ body, ack, client, respond }) => {
    await ack();

    const action = (body as any).actions[0];
    const tmdbId = parseInt(action.value, 10);
    const approverId = body.user.id;

    if (!deps.approverSlackIds.includes(approverId)) {
      log.warn('Unauthorized approval attempt', { user: approverId, tmdbId });
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':no_entry: You are not authorized to approve movie requests.',
      });
      return;
    }

    try {
      const request = getRequestByTmdbId(tmdbId);
      if (!request) {
        await respond({
          response_type: 'ephemeral',
          replace_original: false,
          text: ':x: Could not find the movie request.',
        });
        return;
      }

      if (request.status !== 'pending') {
        log.warn('Request not pending', { tmdbId, status: request.status });
        return;
      }

      const searchResults = await deps.radarrClient.searchMovies(request.movie_title);
      const movieData = searchResults.find(m => m.tmdbId === tmdbId);
      if (!movieData) {
        await respond({
          response_type: 'ephemeral',
          replace_original: false,
          text: ':x: Could not find movie data in Radarr. It may have been removed.',
        });
        return;
      }

      await deps.radarrClient.addMovie(movieData, deps.qualityProfileId, deps.rootFolderPath);

      log.info('Radarr movie added', { tmdbId });

      updateRequestStatus({ id: request.id, status: 'approved', approver_slack_id: approverId });

      log.info('Movie approved', { approver: approverId, movie: `${request.movie_title} (${request.year})`, tmdbId });

      if (request.slack_message_ts) {
        await client.chat.update({
          channel: deps.approvalChannelId,
          ts: request.slack_message_ts,
          blocks: buildApprovedMessage(
            { title: request.movie_title, year: request.year },
            request.requester_slack_id,
            approverId,
          ),
          text: `Approved: ${request.movie_title}`,
        });
      }

      await client.chat.postMessage({
        channel: request.requester_slack_id,
        text: `:white_check_mark: Your request for *${request.movie_title} (${request.year})* has been approved by <@${approverId}>! Radarr is on it.`,
      });
    } catch (error) {
      log.error('Error in approveMovie action', { user: approverId, tmdbId, error: error instanceof Error ? error.message : String(error) });
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':x: Failed to approve the movie. Please try again.',
      });
    }
  });
}
