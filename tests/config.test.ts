import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getConfig, _resetConfig } from '../src/config/index';

const ALL_REQUIRED_VARS = [
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',
  'SLACK_REQUEST_CHANNEL_ID',
  'SLACK_APPROVAL_CHANNEL_ID',
  'RADARR_URL',
  'RADARR_API_KEY',
  'APPROVER_SLACK_IDS',
  'RADARR_QUALITY_PROFILE_ID',
  'RADARR_ROOT_FOLDER_PATH',
];

function setAllVars(): void {
  process.env.SLACK_BOT_TOKEN = 'xoxb-test';
  process.env.SLACK_APP_TOKEN = 'xapp-test';
  process.env.SLACK_REQUEST_CHANNEL_ID = 'C123';
  process.env.SLACK_APPROVAL_CHANNEL_ID = 'C456';
  process.env.RADARR_URL = 'http://localhost:7878/';
  process.env.RADARR_API_KEY = 'abc123';
  process.env.APPROVER_SLACK_IDS = 'U123,U456';
  process.env.RADARR_QUALITY_PROFILE_ID = '1';
  process.env.RADARR_ROOT_FOLDER_PATH = '/movies';
}

describe('config', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ALL_REQUIRED_VARS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    _resetConfig();
  });

  afterEach(() => {
    for (const key of ALL_REQUIRED_VARS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    _resetConfig();
  });

  it('throws when all required vars are missing', () => {
    expect(() => getConfig()).toThrow('Missing required environment variables');
  });

  it('throws listing all missing var names when none set', () => {
    let error: Error | null = null;
    try {
      getConfig();
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    for (const key of ALL_REQUIRED_VARS) {
      expect(error!.message).toContain(key);
    }
  });

  it('throws listing only the specific missing var', () => {
    setAllVars();
    delete process.env.RADARR_API_KEY;

    expect(() => getConfig()).toThrow('RADARR_API_KEY');
  });

  it('returns parsed config when all vars are set', () => {
    setAllVars();

    const config = getConfig();
    expect(config.slack.botToken).toBe('xoxb-test');
    expect(config.slack.appToken).toBe('xapp-test');
    expect(config.slack.requestChannelId).toBe('C123');
    expect(config.slack.approvalChannelId).toBe('C456');
    expect(config.slack.approverSlackIds).toEqual(['U123', 'U456']);
    expect(config.radarr.url).toBe('http://localhost:7878');
    expect(config.radarr.apiKey).toBe('abc123');
    expect(config.radarr.qualityProfileId).toBe(1);
    expect(config.radarr.rootFolderPath).toBe('/movies');
  });

  it('strips trailing slash from RADARR_URL', () => {
    setAllVars();
    process.env.RADARR_URL = 'http://localhost:7878///';

    const config = getConfig();
    expect(config.radarr.url).toBe('http://localhost:7878');
  });

  it('parses APPROVER_SLACK_IDS into array, filtering empty entries', () => {
    setAllVars();
    process.env.APPROVER_SLACK_IDS = 'U111, U222 , U333';

    const config = getConfig();
    expect(config.slack.approverSlackIds).toEqual(['U111', 'U222', 'U333']);
  });

  it('throws on invalid (non-numeric) RADARR_QUALITY_PROFILE_ID', () => {
    setAllVars();
    process.env.RADARR_QUALITY_PROFILE_ID = 'not-a-number';

    expect(() => getConfig()).toThrow('RADARR_QUALITY_PROFILE_ID');
  });

  it('returns the same singleton on repeated calls', () => {
    setAllVars();

    const first = getConfig();
    const second = getConfig();
    expect(first).toBe(second);
  });

  it('loads fresh config after _resetConfig', () => {
    setAllVars();
    const first = getConfig();

    _resetConfig();
    process.env.RADARR_API_KEY = 'new-key';
    const second = getConfig();

    expect(first).not.toBe(second);
    expect(second.radarr.apiKey).toBe('new-key');
  });
});

describe('sonarr configuration', () => {
  const ALL_VARS = [
    'SLACK_BOT_TOKEN',
    'SLACK_APP_TOKEN',
    'SLACK_REQUEST_CHANNEL_ID',
    'SLACK_APPROVAL_CHANNEL_ID',
    'RADARR_URL',
    'RADARR_API_KEY',
    'APPROVER_SLACK_IDS',
    'RADARR_QUALITY_PROFILE_ID',
    'RADARR_ROOT_FOLDER_PATH',
    'SONARR_URL',
    'SONARR_API_KEY',
    'SONARR_QUALITY_PROFILE_ID',
    'SONARR_ROOT_FOLDER_PATH',
  ];

  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ALL_VARS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    _resetConfig();
  });

  afterEach(() => {
    for (const key of ALL_VARS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    _resetConfig();
  });

  it('sonarr is null when no SONARR vars are set', () => {
    setAllVars();

    const config = getConfig();
    expect(config.sonarr).toBeNull();
  });

  it('sonarr is parsed when all SONARR vars are set', () => {
    setAllVars();
    process.env.SONARR_URL = 'http://localhost:8989';
    process.env.SONARR_API_KEY = 'sonarr-key';
    process.env.SONARR_QUALITY_PROFILE_ID = '2';
    process.env.SONARR_ROOT_FOLDER_PATH = '/tv';

    const config = getConfig();
    expect(config.sonarr).not.toBeNull();
    expect(config.sonarr!.url).toBe('http://localhost:8989');
    expect(config.sonarr!.apiKey).toBe('sonarr-key');
    expect(config.sonarr!.qualityProfileId).toBe(2);
    expect(config.sonarr!.rootFolderPath).toBe('/tv');
  });

  it('throws when only some SONARR vars are set', () => {
    setAllVars();
    process.env.SONARR_URL = 'http://localhost:8989';

    expect(() => getConfig()).toThrow('Incomplete Sonarr configuration');
  });

  it('strips trailing slash from SONARR_URL', () => {
    setAllVars();
    process.env.SONARR_URL = 'http://localhost:8989///';
    process.env.SONARR_API_KEY = 'sonarr-key';
    process.env.SONARR_QUALITY_PROFILE_ID = '2';
    process.env.SONARR_ROOT_FOLDER_PATH = '/tv';

    const config = getConfig();
    expect(config.sonarr!.url).toBe('http://localhost:8989');
  });

  it('throws on invalid SONARR_QUALITY_PROFILE_ID', () => {
    setAllVars();
    process.env.SONARR_URL = 'http://localhost:8989';
    process.env.SONARR_API_KEY = 'sonarr-key';
    process.env.SONARR_QUALITY_PROFILE_ID = 'abc';
    process.env.SONARR_ROOT_FOLDER_PATH = '/tv';

    expect(() => getConfig()).toThrow('SONARR_QUALITY_PROFILE_ID');
  });
});
