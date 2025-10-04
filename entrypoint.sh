#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting MCP Hub..."
echo ""

# Show configured clients
echo "📋 WordPress Clients:"
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
    
    # Normalize company name for endpoint
    normalized_name=$(echo "$client_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    
    echo "  ✅ Client ${i}: ${client_name}"
    echo "     ├─ WordPress: ${!wp_url_var}"
    echo "     ├─ User: ${!wp_user_var}"
    echo "     └─ Endpoint: /${normalized_name}/mcp"
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

# Start WordPress Dynamic Proxy (port 9091)
echo "🔧 Starting WordPress Proxy (port 9091)..."
node /app/wp-dynamic-proxy.js &
WP_PROXY_PID=$!
echo "   ✅ Started (PID: $WP_PROXY_PID)"
echo ""

# Wait for services
echo "⏳ Waiting for WordPress proxy..."
sleep 5
echo ""

# Start main aggregator (port 9090)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Starting Main Aggregator (port 9090)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Features:"
echo "   • Single endpoint: /mcp"
echo "   • WordPress integration only"
echo "   • Rate Limiting"
echo "   • Smart Caching"
echo "   • Analytics Logging"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  if [ -n "${WP_PROXY_PID:-}" ]; then
    kill $WP_PROXY_PID 2>/dev/null || true
  fi
  exit 0
}

trap cleanup SIGTERM SIGINT

exec node /app/aggregator.js
