import type { App } from '@slack/bolt';
import { buildRejectedMessage, ACTION_IDS } from '../messages/index';
import { getRequestByTmdbId, updateRequestStatus } from '../../db/index';
import { createLogger } from '../../logger';

const log = createLogger('reject');

type RejectMovieDeps = {
  approverSlackIds: string[];
  approvalChannelId: string;
};

export function registerRejectMovieAction(app: App, deps: RejectMovieDeps): void {
  app.action(ACTION_IDS.REJECT_MOVIE, async ({ body, ack, client, respond }) => {
    await ack();

    const action = (body as any).actions[0];
    const tmdbId = parseInt(action.value, 10);
    const approverId = body.user.id;

    if (!deps.approverSlackIds.includes(approverId)) {
      log.warn('Unauthorized rejection attempt', { user: approverId, tmdbId });
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':no_entry: You are not authorized to reject movie requests.',
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

      updateRequestStatus({ id: request.id, status: 'rejected', approver_slack_id: approverId });

      log.info('Movie rejected', { approver: approverId, movie: `${request.movie_title} (${request.year})`, tmdbId });

      if (request.slack_message_ts) {
        await client.chat.update({
          channel: deps.approvalChannelId,
          ts: request.slack_message_ts,
          blocks: buildRejectedMessage(
            { title: request.movie_title, year: request.year },
            request.requester_slack_id,
            approverId,
          ),
          text: `Rejected: ${request.movie_title}`,
        });
      }

      await client.chat.postMessage({
        channel: request.requester_slack_id,
        text: `:x: Your request for *${request.movie_title} (${request.year})* has been rejected by <@${approverId}>.`,
      });
    } catch (error) {
      log.error('Error in rejectMovie action', { user: approverId, tmdbId, error: error instanceof Error ? error.message : String(error) });
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':x: Failed to reject the movie. Please try again.',
      });
    }
  });
}
