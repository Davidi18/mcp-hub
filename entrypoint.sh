#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting MCP Hub v2.0..."
echo ""

# Environment check - show all configured clients
echo "📋 Client Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLIENT_COUNT=0
for i in {1..15}; do
  wp_url_var="WP${i}_URL"
  wp_user_var="WP${i}_USER"
  wp_pass_var="WP${i}_APP_PASS"
  client_name_var="CLIENT${i}_NAME"
  
  if [ -n "${!wp_url_var:-}" ] && [ -n "${!wp_user_var:-}" ] && [ -n "${!wp_pass_var:-}" ]; then
    CLIENT_COUNT=$((CLIENT_COUNT + 1))
    client_name="${!client_name_var:-client${i}}"
    wp_user="${!wp_user_var}"
    
    # Normalize company name for endpoint
    normalized_name=$(echo "$client_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    
    echo "  ✅ Client ${i}: ${client_name}"
    echo "     ├─ WordPress: ${!wp_url_var}"
    echo "     ├─ User: ${wp_user}"
    echo "     └─ Endpoints:"
    echo "        • JSON-RPC: /${normalized_name}/mcp"
    echo "        • SSE: /sse?client=${normalized_name}"
    echo "        • SSE (alt): /${normalized_name}/sse"
    echo ""
  fi
done

if [ $CLIENT_COUNT -eq 0 ]; then
  echo "  ⚠️  No WordPress clients configured!"
  echo "     Set WP1_URL, WP1_USER, WP1_APP_PASS to add a client."
  echo ""
else
  echo "  📊 Total clients: $CLIENT_COUNT"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# DataForSEO check
if [ -n "${DFS_USER:-}" ] && [ -n "${DFS_PASS:-}" ]; then
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
echo "🔧 Starting WordPress Dynamic Proxy (port 9091)..."
node /app/wp-dynamic-proxy.js &
WP_PROXY_PID=$!
echo "   ✅ WordPress Proxy started (PID: $WP_PROXY_PID)"
echo ""

# Start DataForSEO MCP on port 9092
if [ -n "${DFS_USER:-}" ] && [ -n "${DFS_PASS:-}" ]; then
  echo "🔧 Starting DataForSEO MCP (port 9092)..."
  DATAFORSEO_USERNAME="$DFS_USER" \
  DATAFORSEO_PASSWORD="$DFS_PASS" \
  mcp-proxy --port 9092 --host 0.0.0.0 --stateless \
      npx dataforseo-mcp-server &
  DFS_PROXY_PID=$!
  echo "   ✅ DataForSEO MCP started (PID: $DFS_PROXY_PID)"
  echo ""
fi

# Wait for services to initialize
echo "⏳ Waiting for upstream services..."
sleep 5
echo ""

# Start SSE Transport on port 9093
echo "🔌 Starting Dynamic SSE Transport (port 9093)..."
node /app/sse-transport.js &
SSE_TRANSPORT_PID=$!
echo "   ✅ SSE Transport started (PID: $SSE_TRANSPORT_PID)"
echo "   📍 Universal endpoint: /sse?client=<name>"
echo ""

# Start main aggregator on port 9090
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Starting Main Aggregator (port 9090)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ MCP Hub v2.0 with:"
echo "   • Rate Limiting"
echo "   • Smart Caching"
echo "   • Analytics Logging"
echo "   • Dynamic SSE Transport"
echo ""

# Run aggregator-v3.js
exec node /app/aggregator-v3.js
