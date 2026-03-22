import { getConfig } from './config/index';
import { RadarrClient } from './radarr/client';
import { createSlackApp } from './slack/index';
import { getDb } from './db/index';
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
  }, radarrClient);

  await app.start();
  log.info('⚡️ Movie Bot is running!');
  log.info(`   Request channel: ${config.slack.requestChannelId}`);
  log.info(`   Approval channel: ${config.slack.approvalChannelId}`);
  log.info(`   Approvers: ${config.slack.approverSlackIds.join(', ')}`);

  const shutdown = async (signal: string): Promise<void> => {
    log.info(`\n${signal} received. Shutting down gracefully...`);
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
