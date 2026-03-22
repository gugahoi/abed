# App Logging — Decisions

## 2026-03-22 — Architecture decisions

### Logger implementation: plain console.* wrapper (not pino/winston)
**Decision**: Zero new dependencies. Single src/logger.ts file wrapping console.*
**Rationale**: Home NAS deployment, docker logs consumption, 2-dep project philosophy

### Log format: human-readable key=value (not JSON)
**Decision**: `TIMESTAMP [LEVEL] [prefix] message key="value" key=value`
**Rationale**: No log aggregation stack, consumed via docker logs -f, operator-friendly

### Logger placement: module-level singleton (not DI via deps)
**Decision**: Each file does `const log = createLogger('prefix')` at module level
**Rationale**: Avoids changing 5+ handler signatures, 5+ test files; logging is infrastructure not business logic

### LOG_LEVEL: read directly from process.env in logger.ts
**Decision**: Exception to "no process.env outside config" rule
**Rationale**: Logger must be available before config loads (to log config errors); chicken-and-egg problem

### Test suppression: _setLoggerOutput(noopSink)
**Decision**: Following existing _reset*() pattern
**Rationale**: Logger is stateful (has output sink); same pattern as _resetDb() and _resetConfig()
