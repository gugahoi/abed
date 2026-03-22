# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Runtime stage
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 moviebot && \
    adduser --system --uid 1001 --ingroup moviebot moviebot

# Create data directory for SQLite
RUN mkdir -p /app/data && chown moviebot:moviebot /app/data

# Copy from builder
COPY --from=builder --chown=moviebot:moviebot /app/node_modules ./node_modules
COPY --from=builder --chown=moviebot:moviebot /app/src ./src
COPY --from=builder --chown=moviebot:moviebot /app/package.json ./package.json
COPY --from=builder --chown=moviebot:moviebot /app/tsconfig.json ./tsconfig.json

USER moviebot

# Health: check process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "bun run" || exit 1

CMD ["bun", "run", "src/index.ts"]
