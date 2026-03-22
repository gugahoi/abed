#!/bin/sh
set -e

PUID=${PUID:-1001}
PGID=${PGID:-1001}

CURR_UID=$(id -u moviebot 2>/dev/null || echo "")
CURR_GID=$(id -g moviebot 2>/dev/null || echo "")

if [ "$CURR_UID" != "$PUID" ] || [ "$CURR_GID" != "$PGID" ]; then
    echo "Adjusting moviebot UID:GID to $PUID:$PGID"
    deluser moviebot 2>/dev/null || true
    delgroup moviebot 2>/dev/null || true

    EXISTING_UID_USER=$(getent passwd "$PUID" | cut -d: -f1 || true)
    if [ -n "$EXISTING_UID_USER" ] && [ "$EXISTING_UID_USER" != "moviebot" ]; then
        deluser "$EXISTING_UID_USER" 2>/dev/null || true
    fi

    EXISTING_GROUP=$(getent group "$PGID" | cut -d: -f1 || true)
    if [ -n "$EXISTING_GROUP" ]; then
        adduser -u "$PUID" -G "$EXISTING_GROUP" -S -D -H -h /app moviebot
    else
        addgroup -g "$PGID" -S moviebot
        adduser -u "$PUID" -G moviebot -S -D -H -h /app moviebot
    fi
fi

chown "$PUID:$PGID" /app/data

exec su-exec moviebot "$@"
