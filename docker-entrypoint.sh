#!/bin/sh
set -e

PUID=${PUID:-1001}
PGID=${PGID:-1001}

CURR_UID=$(id -u abed 2>/dev/null || echo "")
CURR_GID=$(id -g abed 2>/dev/null || echo "")

if [ "$CURR_UID" != "$PUID" ] || [ "$CURR_GID" != "$PGID" ]; then
    echo "Adjusting abed UID:GID to $PUID:$PGID"
    deluser abed 2>/dev/null || true
    delgroup abed 2>/dev/null || true

    EXISTING_UID_USER=$(getent passwd "$PUID" | cut -d: -f1 || true)
    if [ -n "$EXISTING_UID_USER" ] && [ "$EXISTING_UID_USER" != "abed" ]; then
        deluser "$EXISTING_UID_USER" 2>/dev/null || true
    fi

    EXISTING_GROUP=$(getent group "$PGID" | cut -d: -f1 || true)
    if [ -n "$EXISTING_GROUP" ]; then
        adduser -u "$PUID" -G "$EXISTING_GROUP" -S -D -H -h /app abed
    else
        addgroup -g "$PGID" -S abed
        adduser -u "$PUID" -G abed -S -D -H -h /app abed
    fi
fi

chown "$PUID:$PGID" /app/data

exec su-exec abed "$@"
