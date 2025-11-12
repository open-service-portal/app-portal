#!/bin/bash
# EntraID User Search Test Script
# Tests the EntraID user search functionality

set -e

echo "==================================="
echo "EntraID User Search Test"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:7007"
API_BASE="/api/app/entra-id/users"  # pluginId 'app' adds /api/app prefix

echo "Backend URL: ${BACKEND_URL}"
echo "API Base: ${API_BASE}"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
echo "GET ${BACKEND_URL}${API_BASE}/health"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}${API_BASE}/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Search without query parameter
echo -e "${YELLOW}Test 2: Search without query (should fail with 400)${NC}"
echo "GET ${BACKEND_URL}${API_BASE}/search"
SEARCH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}${API_BASE}/search")
HTTP_CODE=$(echo "$SEARCH_RESPONSE" | tail -1)
BODY=$(echo "$SEARCH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}✓ Correctly returned 400 for missing query${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Expected 400, got HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 3: Search with short query (less than 2 chars)
echo -e "${YELLOW}Test 3: Search with short query 'a' (should return empty)${NC}"
echo "GET ${BACKEND_URL}${API_BASE}/search?q=a"
SEARCH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}${API_BASE}/search?q=a")
HTTP_CODE=$(echo "$SEARCH_RESPONSE" | tail -1)
BODY=$(echo "$SEARCH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Search returned 200${NC}"
    echo "Response: $BODY"
    USER_COUNT=$(echo "$BODY" | jq '. | length' 2>/dev/null || echo "0")
    echo "Users found: $USER_COUNT"
else
    echo -e "${RED}✗ Search failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 4: Search with valid query
SEARCH_QUERY="pascal"
echo -e "${YELLOW}Test 4: Search with query '${SEARCH_QUERY}'${NC}"
echo "GET ${BACKEND_URL}${API_BASE}/search?q=${SEARCH_QUERY}"
SEARCH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}${API_BASE}/search?q=${SEARCH_QUERY}")
HTTP_CODE=$(echo "$SEARCH_RESPONSE" | tail -1)
BODY=$(echo "$SEARCH_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Search returned 200${NC}"

    # Pretty print if jq is available
    if command -v jq &> /dev/null; then
        echo ""
        echo "Response (formatted):"
        echo "$BODY" | jq '.'

        USER_COUNT=$(echo "$BODY" | jq '. | length')
        echo ""
        echo "Users found: $USER_COUNT"

        if [ "$USER_COUNT" -gt 0 ]; then
            echo ""
            echo "First user:"
            echo "$BODY" | jq '.[0]'
        fi
    else
        echo "Response: $BODY"
    fi
else
    echo -e "${RED}✗ Search failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 5: Check backend logs for EntraID module
echo -e "${YELLOW}Test 5: Check if EntraID module is initialized${NC}"
echo "Looking for 'EntraID' in backend logs..."

# Check if logs directory exists
if [ -d "logs" ]; then
    RECENT_LOG=$(ls -t logs/*.log 2>/dev/null | head -1)
    if [ -n "$RECENT_LOG" ]; then
        echo "Checking: $RECENT_LOG"
        if grep -q "EntraID" "$RECENT_LOG"; then
            echo -e "${GREEN}✓ EntraID logs found:${NC}"
            grep "EntraID" "$RECENT_LOG" | tail -5
        else
            echo -e "${RED}✗ No EntraID logs found${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ No log files found${NC}"
    fi
else
    echo -e "${YELLOW}⚠ logs/ directory not found${NC}"
fi
echo ""

echo "==================================="
echo "Test Complete"
echo "==================================="
