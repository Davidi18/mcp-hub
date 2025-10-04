#!/bin/bash

# MCP Hub v2.0 Comprehensive Test Script
# Tests SSE support, MCP protocol, and all endpoints

set -e

# Configuration
BASE_URL="${MCP_BASE_URL:-https://mcp.strudel.marketing}"
AUTH_TOKEN="${PROXY_TOKEN:-}"
CLIENT_NAME="${CLIENT_NAME:-client3}"  # או שם חברה אמיתי

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_test() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}TEST: $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Build auth header
AUTH_HEADER=""
if [ -n "$AUTH_TOKEN" ]; then
  AUTH_HEADER="Authorization: $AUTH_TOKEN"
fi

echo -e "\n${GREEN}🚀 MCP Hub v2.0 Test Suite${NC}\n"
print_info "Testing endpoint: $BASE_URL/$CLIENT_NAME/mcp"
print_info "Authentication: ${AUTH_TOKEN:+Enabled}${AUTH_TOKEN:-Disabled}"
echo ""

# Test 1: Health Check
print_test "1. Health Check"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
echo "$HEALTH_RESPONSE" | jq .
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
  print_success "Health check passed"
else
  print_error "Health check failed"
fi
echo ""

# Test 2: Documentation Page
print_test "2. Documentation Endpoint"
DOC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$DOC_STATUS" = "200" ]; then
  print_success "Documentation page accessible"
else
  print_error "Documentation page failed (HTTP $DOC_STATUS)"
fi
echo ""

# Test 3: MCP Initialize (JSON)
print_test "3. MCP Initialize (JSON Response)"
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/$CLIENT_NAME/mcp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-01",
      "clientInfo": {
        "name": "test-script",
        "version": "1.0.0"
      }
    }
  }')

echo "$INIT_RESPONSE" | jq .
if echo "$INIT_RESPONSE" | jq -e '.result.serverInfo.name' > /dev/null; then
  print_success "MCP Initialize successful (JSON)"
  SERVER_NAME=$(echo "$INIT_RESPONSE" | jq -r '.result.serverInfo.name')
  print_info "Server: $SERVER_NAME"
else
  print_error "MCP Initialize failed"
fi
echo ""

# Test 4: MCP Initialize (SSE)
print_test "4. MCP Initialize (SSE Response)"
SSE_INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/$CLIENT_NAME/mcp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-01",
      "clientInfo": {"name": "test-sse", "version": "1.0.0"}
    }
  }')

echo "Raw SSE Response:"
echo "$SSE_INIT_RESPONSE"
echo ""

# Extract JSON from SSE
SSE_DATA=$(echo "$SSE_INIT_RESPONSE" | grep "^data: " | sed 's/^data: //')
if [ -n "$SSE_DATA" ]; then
  echo "Extracted JSON:"
  echo "$SSE_DATA" | jq .
  if echo "$SSE_DATA" | jq -e '.result.serverInfo' > /dev/null; then
    print_success "SSE streaming works correctly"
  else
    print_error "SSE response invalid"
  fi
else
  print_error "No SSE data received"
fi
echo ""

# Test 5: Tools List
print_test "5. Tools List"
TOOLS_RESPONSE=$(curl -s -X POST "$BASE_URL/$CLIENT_NAME/mcp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/list"
  }')

echo "$TOOLS_RESPONSE" | jq '.result._meta'
TOTAL_TOOLS=$(echo "$TOOLS_RESPONSE" | jq -r '.result._meta.totalTools // 0')
WP_TOOLS=$(echo "$TOOLS_RESPONSE" | jq -r '.result._meta.wpToolsCount // 0')
DFS_TOOLS=$(echo "$TOOLS_RESPONSE" | jq -r '.result._meta.dfsToolsCount // 0')

if [ "$TOTAL_TOOLS" -gt 0 ]; then
  print_success "Found $TOTAL_TOOLS tools"
  print_info "WordPress: $WP_TOOLS tools"
  print_info "DataForSEO: $DFS_TOOLS tools"
else
  print_error "No tools found"
fi
echo ""

# Test 6: Sample WordPress Tools
print_test "6. Sample WordPress Tools"
echo "$TOOLS_RESPONSE" | jq -r '.result.tools[] | select(.name | startswith("wp/")) | .name' | head -5
echo ""

# Test 7: Sample DataForSEO Tools  
print_test "7. Sample DataForSEO Tools"
echo "$TOOLS_RESPONSE" | jq -r '.result.tools[] | select(.name | startswith("dfs/")) | .name' | head -5
echo ""

# Test 8: Call WordPress Tool (get_site_info)
print_test "8. Call WordPress Tool: wp/get_site_info"
WP_CALL_RESPONSE=$(curl -s -X POST "$BASE_URL/$CLIENT_NAME/mcp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "tools/call",
    "params": {
      "name": "wp/get_site_info",
      "arguments": {}
    }
  }')

echo "$WP_CALL_RESPONSE" | jq .
if echo "$WP_CALL_RESPONSE" | jq -e '.result' > /dev/null; then
  print_success "WordPress tool call successful"
  SITE_NAME=$(echo "$WP_CALL_RESPONSE" | jq -r '.result.content[]?.text' | grep -o '"name":"[^"]*"' | head -1 || echo "")
  if [ -n "$SITE_NAME" ]; then
    print_info "Site: $SITE_NAME"
  fi
else
  print_error "WordPress tool call failed"
fi
echo ""

# Test 9: Call WordPress Tool (search posts)
print_test "9. Call WordPress Tool: wp/wp_posts_search"
SEARCH_RESPONSE=$(curl -s -X POST "$BASE_URL/$CLIENT_NAME/mcp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": "4",
    "method": "tools/call",
    "params": {
      "name": "wp/wp_posts_search",
      "arguments": {
        "search": "seo",
        "per_page": 3
      }
    }
  }')

echo "$SEARCH_RESPONSE" | jq '.result.content[]?.text' | head -20
if echo "$SEARCH_RESPONSE" | jq -e '.result' > /dev/null; then
  print_success "WordPress search successful"
else
  print_error "WordPress search failed"
fi
echo ""

# Test 10: Error Handling - Invalid Tool
print_test "10. Error Handling: Invalid Tool Name"
ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL/$CLIENT_NAME/mcp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "jsonrpc": "2.0",
    "id": "5",
    "method": "tools/call",
    "params": {
      "name": "wp/nonexistent_tool",
      "arguments": {}
    }
  }')

echo "$ERROR_RESPONSE" | jq .
if echo "$ERROR_RESPONSE" | jq -e '.error' > /dev/null; then
  print_success "Error handling works correctly"
else
  print_info "Unexpected response (may or may not be an error)"
fi
echo ""

# Test 11: Authentication Test (if enabled)
if [ -n "$AUTH_TOKEN" ]; then
  print_test "11. Authentication: Invalid Token"
  AUTH_FAIL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/$CLIENT_NAME/mcp" \
    -H "Content-Type: application/json" \
    -H "Authorization: invalid-token" \
    -d '{"jsonrpc":"2.0","id":"6","method":"tools/list"}')
  
  if [ "$AUTH_FAIL_RESPONSE" = "401" ]; then
    print_success "Authentication enforcement works (HTTP 401)"
  else
    print_error "Authentication not enforced properly (HTTP $AUTH_FAIL_RESPONSE)"
  fi
else
  print_test "11. Authentication"
  print_info "Authentication not configured (skipped)"
fi
echo ""

# Test 12: Invalid Endpoint
print_test "12. Invalid Client Endpoint"
INVALID_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/nonexistent-client/mcp" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"jsonrpc":"2.0","id":"7","method":"tools/list"}')

if [ "$INVALID_RESPONSE" = "404" ]; then
  print_success "Invalid endpoint properly rejected (HTTP 404)"
else
  print_error "Invalid endpoint not handled correctly (HTTP $INVALID_RESPONSE)"
fi
echo ""

# Summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 Test Summary${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
print_info "Endpoint: $BASE_URL/$CLIENT_NAME/mcp"
print_info "Total Tools: $TOTAL_TOOLS"
print_info "WordPress Tools: $WP_TOOLS"
print_info "DataForSEO Tools: $DFS_TOOLS"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

print_success "All tests completed!"
echo ""
echo "Next steps:"
echo "1. Test with n8n MCP Client Tool"
echo "2. Configure client names with CLIENT{N}_NAME env vars"
echo "3. Monitor logs: docker logs mcp-hub --follow"
echo ""
