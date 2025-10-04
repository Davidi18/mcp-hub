#!/bin/bash

# SSE Transport Test Script
# Tests the n8n SSE endpoint

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:9093}"
CLIENT="${CLIENT:-client1}"
TOKEN="${TOKEN:-}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   MCP Hub - SSE Transport Test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Testing endpoint: ${BASE_URL}/${CLIENT}/sse"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
response=$(curl -s "${BASE_URL}/health")
if echo "$response" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$response" | jq '.'
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "$response"
fi
echo ""

# Test 2: Initialize without auth (should fail if token required)
echo -e "${YELLOW}Test 2: Authentication Test${NC}"
response=$(curl -s -X POST "${BASE_URL}/${CLIENT}/sse" \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    -d '{
        "jsonrpc": "2.0",
        "id": "1",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0.0"}
        }
    }')

if [ -n "$TOKEN" ]; then
    if echo "$response" | grep -q "Unauthorized"; then
        echo -e "${GREEN}✓ Authentication required (as expected)${NC}"
    else
        echo -e "${YELLOW}⚠ No auth required (TOKEN not set)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping auth test (TOKEN not set)${NC}"
fi
echo ""

# Test 3: Initialize with auth
echo -e "${YELLOW}Test 3: Initialize (MCP Protocol)${NC}"
if [ -n "$TOKEN" ]; then
    AUTH_HEADER="-H \"Authorization: $TOKEN\""
else
    AUTH_HEADER=""
fi

response=$(curl -s -X POST "${BASE_URL}/${CLIENT}/sse" \
    $AUTH_HEADER \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    -d '{
        "jsonrpc": "2.0",
        "id": "1",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0.0"}
        }
    }')

# Extract JSON from SSE format
json_response=$(echo "$response" | grep "^data: " | sed 's/^data: //')

if echo "$json_response" | jq -e '.result.protocolVersion' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Initialize successful${NC}"
    echo "$json_response" | jq '.result'
else
    echo -e "${RED}✗ Initialize failed${NC}"
    echo "$response"
fi
echo ""

# Test 4: List Tools
echo -e "${YELLOW}Test 4: List Tools${NC}"
response=$(curl -s -X POST "${BASE_URL}/${CLIENT}/sse" \
    $AUTH_HEADER \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    -d '{
        "jsonrpc": "2.0",
        "id": "2",
        "method": "tools/list"
    }')

json_response=$(echo "$response" | grep "^data: " | sed 's/^data: //')

if echo "$json_response" | jq -e '.result.tools' > /dev/null 2>&1; then
    tool_count=$(echo "$json_response" | jq '.result.tools | length')
    wp_count=$(echo "$json_response" | jq '[.result.tools[] | select(.name | startswith("wp/"))] | length')
    dfs_count=$(echo "$json_response" | jq '[.result.tools[] | select(.name | startswith("dfs/"))] | length')
    
    echo -e "${GREEN}✓ Tools list retrieved${NC}"
    echo "  Total tools: $tool_count"
    echo "  WordPress tools: $wp_count"
    echo "  DataForSEO tools: $dfs_count"
    
    echo ""
    echo "Sample WordPress tools:"
    echo "$json_response" | jq -r '.result.tools[] | select(.name | startswith("wp/")) | "  - \(.name)" ' | head -5
    
    echo ""
    echo "Sample DataForSEO tools:"
    echo "$json_response" | jq -r '.result.tools[] | select(.name | startswith("dfs/")) | "  - \(.name)" ' | head -5
else
    echo -e "${RED}✗ Tools list failed${NC}"
    echo "$response"
fi
echo ""

# Test 5: SSE Format Check
echo -e "${YELLOW}Test 5: SSE Format Validation${NC}"
if echo "$response" | grep -q "^data: {"; then
    echo -e "${GREEN}✓ Response is in SSE format${NC}"
else
    echo -e "${RED}✗ Response is not in SSE format${NC}"
    echo "Response should start with 'data: {...}'"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint tested: ${BASE_URL}/${CLIENT}/sse"
echo ""
echo "Next steps:"
echo "1. Configure this endpoint in n8n"
echo "2. Use transport type: SSE"
if [ -n "$TOKEN" ]; then
    echo "3. Add Authorization header with token"
fi
echo ""
echo "For n8n configuration, see: QUICKSTART-N8N.md"
echo ""
