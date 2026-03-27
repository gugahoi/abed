export type Config = {
  slack: {
    botToken: string;
    appToken: string;
    requestChannelId: string;
    approvalChannelId: string;
    approverSlackIds: string[];
  } | null;
  discord: {
    botToken: string;
    clientId: string;
    guildId: string;
    requestChannelId: string;
    approvalChannelId: string;
    approverDiscordIds: string[];
  } | null;
  radarr: {
    url: string;
    apiKey: string;
    qualityProfileId: number;
    rootFolderPath: string;
  };
  sonarr: {
    url: string;
    apiKey: string;
    qualityProfileId: number;
    rootFolderPath: string;
  } | null;
};

function loadConfig(): Config {
  const missing: string[] = [];

  function required(key: string): string {
    const val = process.env[key];
    if (!val) missing.push(key);
    return val ?? '';
  }

  // Determine which platform is configured
  const hasSlack = !!(process.env['SLACK_BOT_TOKEN'] || process.env['SLACK_APP_TOKEN']);
  const hasDiscord = !!(process.env['DISCORD_BOT_TOKEN'] || process.env['DISCORD_CLIENT_ID']);

  if (!hasSlack && !hasDiscord) {
    throw new Error('Must configure either Slack or Discord credentials.');
  }

  let slack: Config['slack'] = null;
  if (hasSlack) {
    slack = {
      botToken: required('SLACK_BOT_TOKEN'),
      appToken: required('SLACK_APP_TOKEN'),
      requestChannelId: required('SLACK_REQUEST_CHANNEL_ID'),
      approvalChannelId: required('SLACK_APPROVAL_CHANNEL_ID'),
      approverSlackIds: required('APPROVER_SLACK_IDS')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    };
  }

  let discord: Config['discord'] = null;
  if (hasDiscord) {
    discord = {
      botToken: required('DISCORD_BOT_TOKEN'),
      clientId: required('DISCORD_CLIENT_ID'),
      guildId: required('DISCORD_GUILD_ID'),
      requestChannelId: required('DISCORD_REQUEST_CHANNEL_ID'),
      approvalChannelId: required('DISCORD_APPROVAL_CHANNEL_ID'),
      approverDiscordIds: required('APPROVER_DISCORD_IDS')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    };
  }

  const radarrUrlRaw = required('RADARR_URL');
  const radarrApiKey = required('RADARR_API_KEY');
  const radarrQualityProfileIdRaw = required('RADARR_QUALITY_PROFILE_ID');
  const radarrRootFolderPath = required('RADARR_ROOT_FOLDER_PATH');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const radarrQualityProfileId = parseInt(radarrQualityProfileIdRaw, 10);
  if (isNaN(radarrQualityProfileId)) {
    throw new Error(
      `Invalid value for RADARR_QUALITY_PROFILE_ID: "${radarrQualityProfileIdRaw}" is not a number`,
    );
  }

  const sonarrUrl = process.env['SONARR_URL'];
  const sonarrApiKey = process.env['SONARR_API_KEY'];
  const sonarrQualityProfileIdRaw = process.env['SONARR_QUALITY_PROFILE_ID'];
  const sonarrRootFolderPath = process.env['SONARR_ROOT_FOLDER_PATH'];

  const sonarrVars = [sonarrUrl, sonarrApiKey, sonarrQualityProfileIdRaw, sonarrRootFolderPath];
  const sonarrSetCount = sonarrVars.filter(v => v !== undefined && v !== '').length;

  let sonarr: Config['sonarr'] = null;

  if (sonarrSetCount === 4) {
    const sonarrQualityProfileId = parseInt(sonarrQualityProfileIdRaw!, 10);
    if (isNaN(sonarrQualityProfileId)) {
      throw new Error(`Invalid value for SONARR_QUALITY_PROFILE_ID: "${sonarrQualityProfileIdRaw}" is not a number`);
    }
    sonarr = {
      url: sonarrUrl!.replace(/\/+$/, ''),
      apiKey: sonarrApiKey!,
      qualityProfileId: sonarrQualityProfileId,
      rootFolderPath: sonarrRootFolderPath!,
    };
  } else if (sonarrSetCount > 0) {
    const sonarrMissing: string[] = [];
    if (!sonarrUrl) sonarrMissing.push('SONARR_URL');
    if (!sonarrApiKey) sonarrMissing.push('SONARR_API_KEY');
    if (!sonarrQualityProfileIdRaw) sonarrMissing.push('SONARR_QUALITY_PROFILE_ID');
    if (!sonarrRootFolderPath) sonarrMissing.push('SONARR_ROOT_FOLDER_PATH');
    throw new Error(`Incomplete Sonarr configuration. Missing: ${sonarrMissing.join(', ')}. Set all four SONARR_* variables or none.`);
  }

  return {
    slack,
    discord,
    radarr: {
      url: radarrUrlRaw.replace(/\/+$/, ''),
      apiKey: radarrApiKey,
      qualityProfileId: radarrQualityProfileId,
      rootFolderPath: radarrRootFolderPath,
    },
    sonarr,
  };
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

// For testing — allows resetting the singleton between tests
export function _resetConfig(): void {
  _config = null;
}
