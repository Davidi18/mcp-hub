#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting MCP Hub..."
echo ""

# Show configured clients
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
    
    # Normalize company name for endpoint
    normalized_name=$(echo "$client_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    
    echo "  ✅ Client ${i}: ${client_name}"
    echo "     ├─ WordPress: ${!wp_url_var}"
    echo "     ├─ User: ${!wp_user_var}"
    echo "     └─ Endpoint: /${normalized_name}/mcp"
    
    # Start WordPress MCP for this client
    port=$((9100 + i))
    echo "     🔧 Starting WordPress MCP on port ${port}..."
    
    WP_API_URL="${!wp_url_var}" \
    WP_API_USERNAME="${!wp_user_var}" \
    WP_API_PASSWORD="${!wp_pass_var}" \
    npx @automattic/mcp-wordpress-remote server \
      --transport stdio 2>&1 | sed "s/^/     [WP-${client_name}] /" &
    
    # Save PID for cleanup
    eval "WP${i}_PID=$!"
    
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
  echo ""
  
  echo "🔧 Starting DataForSEO MCP (port 9092)..."
  DATAFORSEO_USERNAME="$DFS_USER" \
  DATAFORSEO_PASSWORD="$DFS_PASS" \
  mcp-proxy --port 9092 --host 0.0.0.0 --stateless \
      npx dataforseo-mcp-server &
  DFS_PROXY_PID=$!
  echo "   ✅ DataForSEO MCP started (PID: $DFS_PROXY_PID)"
  echo ""
else
  echo "📊 DataForSEO: Not configured ⚠️"
  echo "   Set DFS_USER and DFS_PASS to enable SEO tools"
  echo ""
fi

# Wait for services
echo "⏳ Waiting for upstream services..."
sleep 5
echo ""

# Start main aggregator (port 9090)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Starting Main Aggregator (port 9090)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Features:"
echo "   • Single endpoint: /mcp"
echo "   • Unified authentication"
echo "   • Rate Limiting"
echo "   • Smart Caching"
echo "   • Analytics Logging"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  
  # Kill WordPress MCPs
  for i in {1..15}; do
    pid_var="WP${i}_PID"
    if [ -n "${!pid_var:-}" ]; then
      kill ${!pid_var} 2>/dev/null || true
    fi
  done
  
  # Kill DataForSEO MCP
  if [ -n "${DFS_PROXY_PID:-}" ]; then
    kill $DFS_PROXY_PID 2>/dev/null || true
  fi
  
  exit 0
}

trap cleanup SIGTERM SIGINT

exec node /app/aggregator.js
