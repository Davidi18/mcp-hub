#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting MCP Hub v2.0..."
echo ""

# Environment check - show all configured clients
echo "📋 Environment Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLIENT_COUNT=0
for i in {1..15}; do
  wp_url_var="WP${i}_URL"
  wp_user_var="WP${i}_USER"
  client_name_var="CLIENT${i}_NAME"
  
  if [ -n "${!wp_url_var:-}" ]; then
    CLIENT_COUNT=$((CLIENT_COUNT + 1))
    client_name="${!client_name_var:-client${i}}"
    wp_user="${!wp_user_var:-not set}"
    
    # Normalize company name for endpoint
    normalized_name=$(echo "$client_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    
    echo "  ✅ Client ${i}: ${client_name}"
    echo "     ├─ WordPress: ${!wp_url_var}"
    echo "     ├─ User: ${wp_user}"
    echo "     └─ Endpoint: /${normalized_name}/mcp"
    echo ""
  fi
done

if [ $CLIENT_COUNT -eq 0 ]; then
  echo "  ⚠️  No WordPress clients configured!"
  echo "     Set WP1_URL, WP1_USER, WP1_APP_PASS to add a client."
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# DataForSEO check
if [ -n "${DFS_USER:-}" ]; then
  echo "📊 DataForSEO: Configured ✅"
  echo "   User: ${DFS_USER}"
else
  echo "📊 DataForSEO: Not configured ⚠️"
  echo "   Set DFS_USER and DFS_PASS to enable SEO tools"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start WordPress Dynamic Proxy on port 9091
echo "🔧 Starting WordPress Dynamic Proxy on port 9091..."
node /app/wp-dynamic-proxy.js &
WP_PROXY_PID=$!
echo "   ✅ WordPress Proxy started (PID: $WP_PROXY_PID)"
echo ""

# Start DataForSEO MCP on port 9092
if [ -n "${DFS_USER:-}" ]; then
  echo "🔧 Starting DataForSEO MCP on port 9092..."
  DATAFORSEO_USERNAME="$DFS_USER" \
  DATAFORSEO_PASSWORD="$DFS_PASS" \
  mcp-proxy --port 9092 --host 0.0.0.0 --stateless \
      npx dataforseo-mcp-server &
  DFS_PROXY_PID=$!
  echo "   ✅ DataForSEO MCP started (PID: $DFS_PROXY_PID)"
  echo ""
fi

# Wait for services to initialize
echo "⏳ Waiting for services to initialize..."
sleep 5
echo ""

# Start aggregator v2 on port 9090
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Starting MCP Hub Aggregator v2.0 on port 9090..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Use aggregator-v2.js if exists, otherwise fall back to aggregator.js
if [ -f /app/aggregator-v2.js ]; then
  exec node /app/aggregator-v2.js
else
  exec node /app/aggregator.js
fi
