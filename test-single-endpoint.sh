#!/usr/bin/env bash
# Test script for single endpoint MCP Hub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${MCP_URL:-http://localhost:9090}"
CLIENT_ID="${CLIENT_ID:-strudel}"
TOKEN="${PROXY_TOKEN:-}"

echo -e "${BLUE}🧪 Testing MCP Hub - Single Endpoint${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Base URL: $BASE_URL"
echo "Client ID: $CLIENT_ID"
echo ""

# Helper function to make requests
function test_request() {
  local name=$1
  local method=$2
  local client_mode=$3
  local endpoint=$4
  local body=$5
  
  echo -e "${YELLOW}Testing: $name${NC}"
  
  # Build headers based on client mode
  local headers="-H 'Content-Type: application/json'"
  if [ "$client_mode" == "header" ]; then
    headers="$headers -H 'X-Client-ID: $CLIENT_ID'"
  fi
  if [ -n "$TOKEN" ]; then
    headers="$headers -H 'Authorization: Bearer $TOKEN'"
  fi
  
  # Build URL
  local url="$BASE_URL$endpoint"
  if [ "$client_mode" == "query" ]; then
    url="$url?client=$CLIENT_ID"
  fi
  
  # Make request
  local cmd="curl -s -X $method $headers '$url'"
  if [ -n "$body" ]; then
    cmd="$cmd -d '$body'"
  fi
  
  echo "  Command: $cmd"
  local response=$(eval $cmd)
  
  # Check response
  if echo "$response" | jq . >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Valid JSON response${NC}"
    echo "$response" | jq -C . | head -n 20
  else
    echo -e "  ${RED}✗ Invalid response${NC}"
    echo "$response"
  fi
  echo ""
}

# Test 1: Health check
echo -e "${BLUE}━━━ Test 1: Health Check ━━━${NC}"
test_request "Health check" "GET" "none" "/health" ""

# Test 2: Documentation
echo -e "${BLUE}━━━ Test 2: Documentation ━━━${NC}"
response=$(curl -s "$BASE_URL/")
if echo "$response" | grep -q "MCP Hub"; then
  echo -e "${GREEN}✓ Documentation page loaded${NC}"
else
  echo -e "${RED}✗ Documentation page failed${NC}"
fi
echo ""

# Test 3: Initialize with header
echo -e "${BLUE}━━━ Test 3: Initialize (X-Client-ID header) ━━━${NC}"
test_request "Initialize with header" "POST" "header" "/mcp" \
  '{"jsonrpc":"2.0","method":"initialize","id":"1"}'

# Test 4: Initialize with query parameter
echo -e "${BLUE}━━━ Test 4: Initialize (query parameter) ━━━${NC}"
test_request "Initialize with query" "POST" "query" "/mcp" \
  '{"jsonrpc":"2.0","method":"initialize","id":"1"}'

# Test 5: Tools list
echo -e "${BLUE}━━━ Test 5: Tools List ━━━${NC}"
test_request "Tools list" "POST" "header" "/mcp" \
  '{"jsonrpc":"2.0","method":"tools/list","id":"1"}'

# Test 6: Missing client ID
echo -e "${BLUE}━━━ Test 6: Missing Client ID (should fail) ━━━${NC}"
echo "Testing: Missing client ID"
response=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":"1"}')

if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Correctly rejected missing client${NC}"
  echo "$response" | jq -C .
else
  echo -e "${RED}✗ Should have rejected missing client${NC}"
  echo "$response"
fi
echo ""

# Test 7: Invalid client ID
echo -e "${BLUE}━━━ Test 7: Invalid Client ID (should fail) ━━━${NC}"
echo "Testing: Invalid client ID"
response=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: invalid-client-99999" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":"1"}')

if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Correctly rejected invalid client${NC}"
  echo "$response" | jq -C .
else
  echo -e "${RED}✗ Should have rejected invalid client${NC}"
  echo "$response"
fi
echo ""

# Test 8: List clients (if auth is set)
if [ -n "$TOKEN" ]; then
  echo -e "${BLUE}━━━ Test 8: List Clients (authenticated) ━━━${NC}"
  test_request "List clients" "GET" "none" "/clients" ""
  
  echo -e "${BLUE}━━━ Test 9: Stats (authenticated) ━━━${NC}"
  test_request "Stats" "GET" "none" "/stats?client=$CLIENT_ID" ""
fi

# Test 10: Cache headers
echo -e "${BLUE}━━━ Test 10: Cache Headers ━━━${NC}"
echo "Making first request (should be MISS)..."
response1=$(curl -s -i -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $CLIENT_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"dfs/google_trends","arguments":{"keyword":"test"}},"id":"1"}')

cache1=$(echo "$response1" | grep -i "X-Cache:" | awk '{print $2}' | tr -d '\r')
echo "Cache status: $cache1"

if [ "$cache1" == "MISS" ]; then
  echo -e "${GREEN}✓ First request correctly marked as MISS${NC}"
else
  echo -e "${YELLOW}⚠ Expected MISS, got: $cache1${NC}"
fi

echo ""
echo "Making second request (should be HIT)..."
sleep 1
response2=$(curl -s -i -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: $CLIENT_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"dfs/google_trends","arguments":{"keyword":"test"}},"id":"1"}')

cache2=$(echo "$response2" | grep -i "X-Cache:" | awk '{print $2}' | tr -d '\r')
echo "Cache status: $cache2"

if [ "$cache2" == "HIT" ]; then
  echo -e "${GREEN}✓ Second request correctly marked as HIT${NC}"
else
  echo -e "${YELLOW}⚠ Expected HIT, got: $cache2${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Testing complete!${NC}"
echo ""
echo "To test with different client:"
echo "  CLIENT_ID=caio $0"
echo ""
echo "To test production:"
echo "  MCP_URL=https://mcp.strudel.marketing $0"
