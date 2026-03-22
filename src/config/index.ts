export type Config = {
  slack: {
    botToken: string;
    appToken: string;
    requestChannelId: string;
    approvalChannelId: string;
    approverSlackIds: string[];
  };
  radarr: {
    url: string;
    apiKey: string;
    qualityProfileId: number;
    rootFolderPath: string;
  };
};

function loadConfig(): Config {
  const missing: string[] = [];

  function required(key: string): string {
    const val = process.env[key];
    if (!val) missing.push(key);
    return val ?? '';
  }

  const slackBotToken = required('SLACK_BOT_TOKEN');
  const slackAppToken = required('SLACK_APP_TOKEN');
  const slackRequestChannelId = required('SLACK_REQUEST_CHANNEL_ID');
  const slackApprovalChannelId = required('SLACK_APPROVAL_CHANNEL_ID');
  const radarrUrlRaw = required('RADARR_URL');
  const radarrApiKey = required('RADARR_API_KEY');
  const approverSlackIdsRaw = required('APPROVER_SLACK_IDS');
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

  return {
    slack: {
      botToken: slackBotToken,
      appToken: slackAppToken,
      requestChannelId: slackRequestChannelId,
      approvalChannelId: slackApprovalChannelId,
      approverSlackIds: approverSlackIdsRaw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    },
    radarr: {
      url: radarrUrlRaw.replace(/\/+$/, ''),
      apiKey: radarrApiKey,
      qualityProfileId: radarrQualityProfileId,
      rootFolderPath: radarrRootFolderPath,
    },
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
