import { getConfig } from './config/index';
import { RadarrClient } from './radarr/client';
import { SonarrClient } from './sonarr/client';
import { createSlackApp } from './slack/index';
import { getDb } from './db/index';
import { startPoller, stopPoller } from './poller';
import { createLogger } from './logger';

const log = createLogger('app');

async function main(): Promise<void> {
  let config;
  try {
    config = getConfig();
  } catch (error) {
    log.error(`❌ Configuration error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  const radarrClient = new RadarrClient(config.radarr.url, config.radarr.apiKey);

  log.info('🔍 Checking Radarr connection...');
  try {
    const profiles = await radarrClient.getQualityProfiles();
    log.info(`✅ Radarr connected. Quality profiles: ${profiles.map(p => `${p.name} (${p.id})`).join(', ')}`);
    const folders = await radarrClient.getRootFolders();
    log.info(`📁 Root folders: ${folders.map(f => f.path).join(', ')}`);
  } catch (error) {
    log.warn(`⚠️  Could not connect to Radarr: ${error instanceof Error ? error.message : error}`);
    log.warn('   Bot will start anyway. Radarr features will fail until connection is restored.');
  }

  let sonarrConfig: { sonarrClient: SonarrClient; qualityProfileId: number; rootFolderPath: string } | null = null;
  if (config.sonarr) {
    const sonarrClient = new SonarrClient(config.sonarr.url, config.sonarr.apiKey);

    log.info('🔍 Checking Sonarr connection...');
    try {
      const profiles = await sonarrClient.getQualityProfiles();
      log.info(`✅ Sonarr connected. Quality profiles: ${profiles.map(p => `${p.name} (${p.id})`).join(', ')}`);
      const folders = await sonarrClient.getRootFolders();
      log.info(`📁 Root folders: ${folders.map(f => f.path).join(', ')}`);
    } catch (error) {
      log.warn(`⚠️  Could not connect to Sonarr: ${error instanceof Error ? error.message : error}`);
      log.warn('   Bot will start anyway. Sonarr features will fail until connection is restored.');
    }

    sonarrConfig = {
      sonarrClient,
      qualityProfileId: config.sonarr.qualityProfileId,
      rootFolderPath: config.sonarr.rootFolderPath,
    };
  } else {
    log.info('ℹ️  Sonarr not configured. TV show requests will be disabled.');
  }

  log.info('🗄️  Initializing database...');
  getDb();
  log.info('✅ Database ready.');

  const app = createSlackApp({
    botToken: config.slack.botToken,
    appToken: config.slack.appToken,
    approvalChannelId: config.slack.approvalChannelId,
    approverSlackIds: config.slack.approverSlackIds,
    qualityProfileId: config.radarr.qualityProfileId,
    rootFolderPath: config.radarr.rootFolderPath,
    sonarr: sonarrConfig,
  }, radarrClient);

  await app.start();

  startPoller({
    slackClient: app.client,
    radarrClient,
    sonarrClient: sonarrConfig?.sonarrClient ?? null,
  });

  log.info('⚡️ Movie Bot is running!');
  log.info(`   Request channel: ${config.slack.requestChannelId}`);
  log.info(`   Approval channel: ${config.slack.approvalChannelId}`);
  log.info(`   Approvers: ${config.slack.approverSlackIds.join(', ')}`);
  log.info(`   Sonarr: ${config.sonarr ? 'enabled' : 'disabled'}`);

  const shutdown = async (signal: string): Promise<void> => {
    log.info(`\n${signal} received. Shutting down gracefully...`);
    stopPoller();
    await app.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
