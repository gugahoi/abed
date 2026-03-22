import { App } from '@slack/bolt';
import type { RadarrClient } from '../radarr/client';
import { registerMovieCommand } from './commands/movie';
import { registerSelectMovieAction } from './actions/selectMovie';
import { registerApproveMovieAction } from './actions/approveMovie';
import { registerRejectMovieAction } from './actions/rejectMovie';

export function createSlackApp(config: {
  botToken: string;
  appToken: string;
  approvalChannelId: string;
  approverSlackIds: string[];
  qualityProfileId: number;
  rootFolderPath: string;
}, radarrClient: RadarrClient): App {
  const app = new App({
    token: config.botToken,
    appToken: config.appToken,
    socketMode: true,
  });

  registerMovieCommand(app, { radarrClient, approvalChannelId: config.approvalChannelId });
  registerSelectMovieAction(app, { radarrClient, approvalChannelId: config.approvalChannelId });
  registerApproveMovieAction(app, {
    radarrClient,
    approverSlackIds: config.approverSlackIds,
    approvalChannelId: config.approvalChannelId,
    qualityProfileId: config.qualityProfileId,
    rootFolderPath: config.rootFolderPath,
  });
  registerRejectMovieAction(app, {
    approverSlackIds: config.approverSlackIds,
    approvalChannelId: config.approvalChannelId,
  });

  return app;
}
