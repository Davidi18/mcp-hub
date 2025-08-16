#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting MCP Hub..."
echo "Environment check:"
echo "WP1_URL: ${WP1_URL:-'NOT_SET'}"
echo "DFS_USER: ${DFS_USER:-'NOT_SET'}"

# Start WordPress MCP on port 9091
if [ -n "${WP1_URL:-}" ]; then
    echo "📝 Starting WordPress MCP for client1..."
    WP_API_URL="$WP1_URL" \
    WP_API_USERNAME="$WP1_USER" \
    WP_API_PASSWORD="$WP1_APP_PASS" \
    mcp-proxy --port 9091 --host 0.0.0.0 --streamEndpoint /wp-client1/mcp \
        npx @automattic/mcp-wordpress-remote &
    echo "✅ WordPress MCP started on port 9091"
else
    echo "⚠️ WordPress not configured"
fi

# Start DataForSEO MCP on port 9092
if [ -n "${DFS_USER:-}" ]; then
    echo "📊 Starting DataForSEO MCP..."
    DATAFORSEO_USERNAME="$DFS_USER" \
    DATAFORSEO_PASSWORD="$DFS_PASS" \
    mcp-proxy --port 9092 --host 0.0.0.0 --streamEndpoint /dataforseo/mcp \
        npx dataforseo-mcp-server &
    echo "✅ DataForSEO MCP started on port 9092"
else
    echo "⚠️ DataForSEO not configured"
fi

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 10

# Update aggregator to use separate ports
export UPSTREAM_BASE="http://127.0.0.1"

# Start aggregator
echo "🎯 Starting Aggregator on port 9090..."
exec node /app/aggregator.js
