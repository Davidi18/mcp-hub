#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting MCP Hub..."

# Environment check - show all configured clients
echo "📋 Environment check:"
for i in {1..15}; do
  wp_url_var="WP${i}_URL"
  client_name_var="CLIENT${i}_NAME"
  
  if [ -n "${!wp_url_var:-}" ]; then
    client_name="${!client_name_var:-client${i}}"
    echo "  ✅ Client ${i} (${client_name}): ${!wp_url_var}"
  fi
done

echo "DFS_USER: ${DFS_USER:-'NOT_SET'}"

# Start WordPress Dynamic Proxy on port 9091
echo "📝 Starting WordPress Dynamic Proxy..."
node /app/wp-dynamic-proxy.js &
WP_PROXY_PID=$!
echo "✅ WordPress Dynamic Proxy started (PID: $WP_PROXY_PID)"

# Start DataForSEO MCP on port 9092
if [ -n "${DFS_USER:-}" ]; then
  echo "📊 Starting DataForSEO MCP..."
  DATAFORSEO_USERNAME="$DFS_USER" \
  DATAFORSEO_PASSWORD="$DFS_PASS" \
  mcp-proxy --port 9092 --host 0.0.0.0 --stateless \
      npx dataforseo-mcp-server &
  DFS_PROXY_PID=$!
  echo "✅ DataForSEO MCP started (PID: $DFS_PROXY_PID)"
else
  echo "⚠️ DataForSEO not configured"
fi

# Wait for services to initialize
echo "⏳ Waiting for services to initialize..."
sleep 5

# Start aggregator on port 9090
echo "🎯 Starting Aggregator on port 9090..."
exec node /app/aggregator.js
