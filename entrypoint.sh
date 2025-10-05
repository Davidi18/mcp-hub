#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting MCP Hub (WordPress)..."
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
    echo "     └─ ID: ${normalized_name}"
    
    # Start WordPress MCP for this client on port 9100+i
    port=$((9100 + i))
    echo "     🔧 Starting WordPress MCP on port ${port}..."
    
    # Run mcp-wordpress-remote through mcp-proxy (fixed command)
    WP_API_URL="${!wp_url_var}" \
    WP_API_USERNAME="${!wp_user_var}" \
    WP_API_PASSWORD="${!wp_pass_var}" \
    mcp-proxy \
      --port $port \
      --host 0.0.0.0 \
      mcp-wordpress-remote 2>&1 | sed "s/^/     [WP-${client_name}] /" &
    
    echo "     ✅ Started on :${port}"
    echo ""
  fi
done

if [ $CLIENT_COUNT -eq 0 ]; then
  echo "  ⚠️  No WordPress clients configured!"
  echo "     Set WP1_URL, WP1_USER, WP1_APP_PASS to add a client."
  echo ""
  exit 1
else
  echo "  📊 Total clients: $CLIENT_COUNT"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for WordPress MCPs to initialize
echo "⏳ Waiting for WordPress MCPs to initialize..."
sleep 10
echo ""

# Start main aggregator (port 9090)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Starting Main Aggregator (port 9090)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Features:"
echo "   • Single endpoint: /mcp"
echo "   • WordPress integration"
echo "   • Rate Limiting"
echo "   • Smart Caching"
echo "   • Analytics"
echo ""

exec node /app/aggregator.js
