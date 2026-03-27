type LogOutput = {
  debug: (msg: string) => void;
  info:  (msg: string) => void;
  warn:  (msg: string) => void;
  error: (msg: string) => void;
};

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let _currentOutput: LogOutput = {
  debug: (msg) => console.debug(msg),
  info:  (msg) => console.log(msg),
  warn:  (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
};

export function _setLoggerOutput(sink: LogOutput): void {
  _currentOutput = sink;
}

const MIN_SECRET_LENGTH = 4;
let _secrets: string[] = [];

export function _setSecrets(secrets: string[]): void {
  _secrets = secrets.filter(s => s.length >= MIN_SECRET_LENGTH);
}

export function _resetSecrets(): void {
  _secrets = [];
}

export function redactSecrets(input: string): string {
  let result = input;
  for (const secret of _secrets) {
    result = result.replaceAll(secret, '[REDACTED]');
  }
  return result;
}

function getCurrentLevel(): LogLevel {
  const raw = process.env['LOG_LEVEL'];
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

function formatContext(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return '';
  const raw = ' ' + Object.entries(ctx).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  return redactSecrets(raw);
}

export function createLogger(prefix: string) {
  function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[getCurrentLevel()]) return;
    const ts = new Date().toISOString();
    const line = `${ts} [${level.toUpperCase()}] [${prefix}] ${redactSecrets(message)}${formatContext(context)}`;
    if (level === 'debug') _currentOutput.debug(line);
    else if (level === 'info') _currentOutput.info(line);
    else if (level === 'warn') _currentOutput.warn(line);
    else _currentOutput.error(line);
  }
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
    info:  (msg: string, ctx?: Record<string, unknown>) => emit('info',  msg, ctx),
    warn:  (msg: string, ctx?: Record<string, unknown>) => emit('warn',  msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
  };
}
