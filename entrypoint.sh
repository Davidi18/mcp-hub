#!/usr/bin/env bash
set -euo pipefail

echo "Starting MCP Hub..."

# WordPress client1 על פורט 9091
echo "Starting WordPress MCP client1..."
WP_API_URL="$WP1_URL" WP_API_USERNAME="$WP1_USER" WP_API_PASSWORD="$WP1_APP_PASS" \
  npx @automattic/mcp-wordpress-remote &

# DataForSEO על פורט 9092  
echo "Starting DataForSEO MCP..."
DATAFORSEO_USERNAME="$DFS_USER" DATAFORSEO_PASSWORD="$DFS_PASS" \
  npx dataforseo-mcp-server &

# חכה רגע שהשירותים יעלו
sleep 5

# Aggregator על פורט 9090
echo "Starting Aggregator..."
exec node /app/aggregator.js
