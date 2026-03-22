import type { App } from '@slack/bolt';
import type { SonarrClient } from '../../sonarr/client';
import { buildTvApprovedMessage, ACTION_IDS } from '../messages/index';
import { getTvRequestByTvdbId, updateTvRequestStatus } from '../../db/index';
import { createLogger } from '../../logger';

const log = createLogger('approve-tv');

type ApproveTvDeps = {
  sonarrClient: SonarrClient;
  approverSlackIds: string[];
  approvalChannelId: string;
  qualityProfileId: number;
  rootFolderPath: string;
};

export function registerApproveTvAction(app: App, deps: ApproveTvDeps): void {
  app.action(ACTION_IDS.APPROVE_TV, async ({ body, ack, client, respond }) => {
    await ack();

    const action = (body as any).actions[0];
    const tvdbId = parseInt(action.value, 10);
    const approverId = body.user.id;

    if (!deps.approverSlackIds.includes(approverId)) {
      log.warn('Unauthorized approval attempt', { user: approverId, tvdbId });
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':no_entry: You are not authorized to approve TV show requests.',
      });
      return;
    }

    try {
      const request = getTvRequestByTvdbId(tvdbId);
      if (!request) {
        await respond({
          response_type: 'ephemeral',
          replace_original: false,
          text: ':x: Could not find the TV show request.',
        });
        return;
      }

      if (request.status !== 'pending') {
        log.warn('Request not pending', { tvdbId, status: request.status });
        return;
      }

      const searchResults = await deps.sonarrClient.searchSeries(request.show_title);
      const showData = searchResults.find(s => s.tvdbId === tvdbId);
      if (!showData) {
        await respond({
          response_type: 'ephemeral',
          replace_original: false,
          text: ':x: Could not find TV show data in Sonarr. It may have been removed.',
        });
        return;
      }

      await deps.sonarrClient.addSeries(showData, deps.qualityProfileId, deps.rootFolderPath);

      log.info('Sonarr series added', { tvdbId });

      updateTvRequestStatus({ id: request.id, status: 'approved', approver_slack_id: approverId });

      log.info('TV show approved', { approver: approverId, show: `${request.show_title} (${request.year})`, tvdbId });

      if (request.slack_message_ts) {
        await client.chat.update({
          channel: deps.approvalChannelId,
          ts: request.slack_message_ts,
          blocks: buildTvApprovedMessage(
            { title: request.show_title, year: request.year },
            request.requester_slack_id,
            approverId,
          ),
          text: `Approved: ${request.show_title}`,
        });
      }

      await client.chat.postMessage({
        channel: request.requester_slack_id,
        text: `:white_check_mark: Your request for *${request.show_title} (${request.year})* has been approved by <@${approverId}>! Sonarr is on it.`,
      });
    } catch (error) {
      log.error('Error in approveTv action', { user: approverId, tvdbId, error: error instanceof Error ? error.message : String(error) });
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':x: Failed to approve the TV show. Please try again.',
      });
    }
  });
}
