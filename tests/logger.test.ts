import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { createLogger, _setLoggerOutput } from '../src/logger';

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
    delete process.env['LOG_LEVEL'];
  });

  afterEach(() => {
    delete process.env['LOG_LEVEL'];
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
