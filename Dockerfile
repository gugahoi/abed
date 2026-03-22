# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./

# Runtime stage
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/gugahoi/movie-bot"
LABEL org.opencontainers.image.description="Slack bot for movie/TV requests with Radarr/Sonarr approval workflow"
LABEL org.opencontainers.image.licenses="MIT"

RUN apk add --no-cache su-exec && \
    addgroup -g 1001 -S moviebot && \
    adduser -u 1001 -G moviebot -S -D -H -h /app moviebot && \
    mkdir -p /app/data && chown moviebot:moviebot /app/data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "bun run" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "src/index.ts"]
