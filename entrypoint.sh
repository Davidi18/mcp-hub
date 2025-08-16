#!/usr/bin/env bash
set -euo pipefail

# מייצר קובץ קונפיג ל-upstreams (פורט פנימי 9091)
envsubst < /app/upstreams.template.json > /app/upstreams.json

# מריץ את upstreams ברקע (WP לקוחות + DataForSEO)
mcp-proxy --config /app/upstreams.json &

# מריץ את האגרגטור (מאחד ל-URL אחד לכל לקוח, פורט 9090)
exec node /app/aggregator.js
