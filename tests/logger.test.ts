import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { createLogger, _setLoggerOutput, redactSecrets, _setSecrets, _resetSecrets } from '../src/logger';

describe('logger', () => {
  const captured: string[] = [];
  const mockSink = {
    debug: mock((msg: string) => { captured.push(msg); }),
    info:  mock((msg: string) => { captured.push(msg); }),
    warn:  mock((msg: string) => { captured.push(msg); }),
    error: mock((msg: string) => { captured.push(msg); }),
  };

  beforeEach(() => {
    captured.length = 0;
    mockSink.debug.mockClear();
    mockSink.info.mockClear();
    mockSink.warn.mockClear();
    mockSink.error.mockClear();
    _setLoggerOutput(mockSink);
    _resetSecrets();
    delete process.env['LOG_LEVEL'];
  });

  afterEach(() => {
    delete process.env['LOG_LEVEL'];
    _resetSecrets();
    _setLoggerOutput({
      debug: () => {},
      info:  () => {},
      warn:  () => {},
      error: () => {},
    });
  });

  it('default level is info — debug suppressed, info passes', () => {
    delete process.env['LOG_LEVEL'];
    const log = createLogger('test');
    log.debug('should not appear');
    log.info('should appear');
    expect(mockSink.debug).not.toHaveBeenCalled();
    expect(mockSink.info).toHaveBeenCalledTimes(1);
  });

  it('LOG_LEVEL=debug allows debug messages', () => {
    process.env['LOG_LEVEL'] = 'debug';
    const log = createLogger('test');
    log.debug('debug message');
    expect(mockSink.debug).toHaveBeenCalledTimes(1);
  });

  it('LOG_LEVEL=warn suppresses info, allows warn', () => {
    process.env['LOG_LEVEL'] = 'warn';
    const log = createLogger('test');
    log.info('should be suppressed');
    log.warn('should appear');
    expect(mockSink.info).not.toHaveBeenCalled();
    expect(mockSink.warn).toHaveBeenCalledTimes(1);
  });

  it('LOG_LEVEL=error suppresses warn, allows error', () => {
    process.env['LOG_LEVEL'] = 'error';
    const log = createLogger('test');
    log.warn('should be suppressed');
    log.error('should appear');
    expect(mockSink.warn).not.toHaveBeenCalled();
    expect(mockSink.error).toHaveBeenCalledTimes(1);
  });

  it('output contains the prefix', () => {
    const log = createLogger('my-prefix');
    log.info('hello');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[my-prefix]');
  });

  it('output contains the level in uppercase', () => {
    const log = createLogger('test');
    log.warn('hello');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[WARN]');
  });

  it('output contains the message', () => {
    const log = createLogger('test');
    log.info('hello world');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('hello world');
  });

  it('context key=value pairs are appended to the output', () => {
    const log = createLogger('test');
    log.info('msg', { user: 'U123', count: 5 });
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('user="U123"');
    expect(captured[0]).toContain('count=5');
  });

  it('_setLoggerOutput suppresses to no-op — no console methods called', () => {
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    const log = createLogger('test');
    log.debug('x');
    log.info('x');
    log.warn('x');
    log.error('x');
    expect(mockSink.debug).not.toHaveBeenCalled();
    expect(mockSink.info).not.toHaveBeenCalled();
    expect(mockSink.warn).not.toHaveBeenCalled();
    expect(mockSink.error).not.toHaveBeenCalled();
  });
});

describe('redactSecrets', () => {
  beforeEach(() => {
    _resetSecrets();
  });

  afterEach(() => {
    _resetSecrets();
  });

  it('redacts a single registered secret', () => {
    _setSecrets(['my-api-key-123']);
    expect(redactSecrets('key=my-api-key-123')).toBe('key=[REDACTED]');
  });

  it('redacts multiple secrets', () => {
    _setSecrets(['secret-one', 'secret-two', 'secret-three']);
    const input = 'a=secret-one b=secret-two c=secret-three';
    expect(redactSecrets(input)).toBe('a=[REDACTED] b=[REDACTED] c=[REDACTED]');
  });

  it('redacts a secret appearing multiple times', () => {
    _setSecrets(['my-api-key']);
    expect(redactSecrets('first=my-api-key second=my-api-key')).toBe('first=[REDACTED] second=[REDACTED]');
  });

  it('ignores secrets shorter than 4 characters', () => {
    _setSecrets(['abc']);
    expect(redactSecrets('value=abc')).toBe('value=abc');
  });

  it('returns input unchanged when no secrets registered', () => {
    expect(redactSecrets('anything here')).toBe('anything here');
  });

  it('does not modify input when secret is not present', () => {
    _setSecrets(['not-in-string']);
    expect(redactSecrets('some other text')).toBe('some other text');
  });

  it('_resetSecrets clears all secrets', () => {
    _setSecrets(['my-secret']);
    _resetSecrets();
    expect(redactSecrets('my-secret')).toBe('my-secret');
  });
});

describe('logger auto-redaction', () => {
  const captured: string[] = [];
  const mockSink = {
    debug: mock((msg: string) => { captured.push(msg); }),
    info:  mock((msg: string) => { captured.push(msg); }),
    warn:  mock((msg: string) => { captured.push(msg); }),
    error: mock((msg: string) => { captured.push(msg); }),
  };

  beforeEach(() => {
    captured.length = 0;
    mockSink.debug.mockClear();
    mockSink.info.mockClear();
    _setLoggerOutput(mockSink);
    _resetSecrets();
    delete process.env['LOG_LEVEL'];
  });

  afterEach(() => {
    delete process.env['LOG_LEVEL'];
    _resetSecrets();
    _setLoggerOutput({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
  });

  it('redacts secrets in context values', () => {
    _setSecrets(['super-secret-key']);
    const log = createLogger('test');
    log.info('request', { apiKey: 'super-secret-key' });
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[REDACTED]');
    expect(captured[0]).not.toContain('super-secret-key');
  });

  it('redacts secrets in the message itself', () => {
    _setSecrets(['super-secret-key']);
    const log = createLogger('test');
    log.info('token is super-secret-key here');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[REDACTED]');
    expect(captured[0]).not.toContain('super-secret-key');
  });

  it('redacts secrets at debug level', () => {
    process.env['LOG_LEVEL'] = 'debug';
    _setSecrets(['debug-secret']);
    const log = createLogger('test');
    log.debug('value=debug-secret', { key: 'debug-secret' });
    expect(captured.length).toBe(1);
    expect(captured[0]).not.toContain('debug-secret');
  });
});
