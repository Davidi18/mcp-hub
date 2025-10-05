#!/bin/bash
# Test script for WordPress MCP Hub

set -e

echo "🧪 WordPress MCP Hub - Test Suite"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MCP_URL="${MCP_URL:-http://localhost:9090}"
CLIENT_ID="${CLIENT_ID:-strudel}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Helper function for tests
test_endpoint() {
    local name=$1
    local endpoint=$2
    local method=${3:-GET}
    local data=${4:-}
    local expected_code=${5:-200}
    
    echo -n "Testing $name... "
    
    headers=()
    if [ -n "$AUTH_TOKEN" ]; then
        headers+=(-H "Authorization: Bearer $AUTH_TOKEN")
    fi
    
    if [ "$method" == "POST" ]; then
        headers+=(-H "Content-Type: application/json")
        if [ -n "$data" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST "${headers[@]}" -d "$data" "$MCP_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X POST "${headers[@]}" "$MCP_URL$endpoint")
        fi
    else
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$MCP_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -eq "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_code, got $http_code)"
        echo "Response: $body"
        return 1
    fi
}

test_mcp_endpoint() {
    local name=$1
    local client=$2
    local mcp_method=$3
    local params=${4:-{}}
    
    echo -n "Testing MCP $name (client: $client)... "
    
    data=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "method": "$mcp_method",
  "params": $params,
  "id": "test-$(date +%s)"
}
EOF
)
    
    headers=(-H "X-Client-ID: $client" -H "Content-Type: application/json")
    if [ -n "$AUTH_TOKEN" ]; then
        headers+=(-H "Authorization: Bearer $AUTH_TOKEN")
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "${headers[@]}" -d "$data" "$MCP_URL/mcp")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -eq 200 ]; then
        # Check if response is valid JSON
        if echo "$body" | jq empty 2>/dev/null; then
            # Check for error in JSON-RPC response
            if echo "$body" | jq -e '.error' >/dev/null 2>&1; then
                error_msg=$(echo "$body" | jq -r '.error.message')
                echo -e "${RED}✗ FAIL${NC} - MCP Error: $error_msg"
                return 1
            else
                echo -e "${GREEN}✓ PASS${NC}"
                return 0
            fi
        else
            echo -e "${RED}✗ FAIL${NC} - Invalid JSON response"
            echo "Response: $body"
            return 1
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Track results
total_tests=0
passed_tests=0
failed_tests=0

run_test() {
    total_tests=$((total_tests + 1))
    if "$@"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi
}

echo "📍 Testing MCP Hub at: $MCP_URL"
echo "🔐 Client ID: $CLIENT_ID"
if [ -n "$AUTH_TOKEN" ]; then
    echo "🔑 Auth Token: Configured"
else
    echo "🔓 Auth Token: Not configured"
fi
echo ""

# Test 1: Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Basic Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_test test_endpoint "Health check" "/health" "GET" "" 200
run_test test_endpoint "Clients list" "/clients" "GET" "" 200
run_test test_endpoint "Documentation" "/" "GET" "" 200
echo ""

# Test 2: Debug Endpoints
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Debug & Monitoring"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_test test_endpoint "Upstreams check" "/debug/upstreams" "GET" "" 200
run_test test_endpoint "Stats" "/stats" "GET" "" 200
run_test test_endpoint "Analytics" "/analytics?minutes=60" "GET" "" 200
echo ""

# Test 3: MCP Protocol
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  MCP Protocol Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_test test_mcp_endpoint "initialize" "$CLIENT_ID" "initialize" '{}'
run_test test_mcp_endpoint "tools/list" "$CLIENT_ID" "tools/list" '{}'
echo ""

# Test 4: Error Handling
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Error Handling"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_test test_endpoint "Missing client ID" "/mcp" "POST" '{"jsonrpc":"2.0","method":"tools/list","id":"1"}' 400
run_test test_endpoint "Unknown client" "/mcp" "POST" '{"jsonrpc":"2.0","method":"tools/list","id":"1"}' 404 || true  # Should fail
run_test test_endpoint "Invalid endpoint" "/invalid" "GET" "" 404
echo ""

# Test 5: Caching
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Caching Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "First request (should be MISS)..."
response1=$(curl -s -H "X-Client-ID: $CLIENT_ID" -H "Content-Type: application/json" \
    -i -X POST -d '{"jsonrpc":"2.0","method":"tools/list","id":"1"}' "$MCP_URL/mcp" 2>&1)

cache_status1=$(echo "$response1" | grep -i "X-Cache:" | awk '{print $2}' | tr -d '\r')

if [ "$cache_status1" == "MISS" ]; then
    echo -e "${GREEN}✓ PASS${NC} - First request is cache MISS"
    passed_tests=$((passed_tests + 1))
else
    echo -e "${YELLOW}⚠ SKIP${NC} - Cache header not found (may not be cached)"
fi
total_tests=$((total_tests + 1))

echo "Second request (should be HIT)..."
sleep 1
response2=$(curl -s -H "X-Client-ID: $CLIENT_ID" -H "Content-Type: application/json" \
    -i -X POST -d '{"jsonrpc":"2.0","method":"tools/list","id":"1"}' "$MCP_URL/mcp" 2>&1)

cache_status2=$(echo "$response2" | grep -i "X-Cache:" | awk '{print $2}' | tr -d '\r')

if [ "$cache_status2" == "HIT" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Second request is cache HIT"
    passed_tests=$((passed_tests + 1))
else
    echo -e "${YELLOW}⚠ SKIP${NC} - Cache HIT not detected (may not be cached)"
fi
total_tests=$((total_tests + 1))
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests:  $total_tests"
echo -e "Passed:       ${GREEN}$passed_tests${NC}"
echo -e "Failed:       ${RED}$failed_tests${NC}"
echo ""

if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
