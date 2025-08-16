#!/usr/bin/env bash
set -euo pipefail

# בונה את הקונפיג מרובד ה-ENV של Coolify
envsubst < /app/config.template.json > /app/config.json

exec mcp-proxy --config /app/config.json
