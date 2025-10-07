#!/bin/sh
set -eu

echo "🚀 Starting MCP Hub (WordPress)..."
echo ""

# Show configured clients
echo "📋 WordPress Clients:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLIENT_COUNT=0

for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  # Use eval to get variable values (sh-compatible)
  eval wp_url=\$WP${i}_URL
  eval wp_user=\$WP${i}_USER
  eval wp_pass=\$WP${i}_APP_PASS
  eval client_name=\$CLIENT${i}_NAME
  
  # Set default client name if not provided
  [ -z "$client_name" ] && client_name="client${i}"
  
  if [ -n "$wp_url" ] && [ -n "$wp_user" ] && [ -n "$wp_pass" ]; then
    CLIENT_COUNT=$((CLIENT_COUNT + 1))
    
    # Normalize company name for endpoint
    normalized_name=$(echo "$client_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    
    echo "  ✅ Client ${i}: ${client_name}"
    echo "     ├─ WordPress: ${wp_url}"
    echo "     ├─ User: ${wp_user}"
    echo "     └─ ID: ${normalized_name}"
    
    # Start WordPress MCP for this client on port 9100+i
    port=$((9100 + i))
    echo "     🔧 Starting WordPress MCP on port ${port}..."
    
    # Run our custom WordPress MCP server (direct REST API)
    WP_API_URL="$wp_url" \
    WP_API_USERNAME="$wp_user" \
    WP_API_PASSWORD="$wp_pass" \
    PORT=$port \
    node /app/wordpress-mcp-server.js 2>&1 | sed "s/^/     [WP-${client_name}] /" &
    
    echo "     ✅ Started on :${port}"
    echo ""
    
    # Small delay to prevent race conditions
    sleep 1
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
