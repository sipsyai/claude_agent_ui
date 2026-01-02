#!/bin/bash
# ============================================================
# Flow System Integration Tests
# Tests flow creation and execution end-to-end
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
EXPRESS_URL="${EXPRESS_URL:-http://localhost:3001}"
API_BASE="$EXPRESS_URL/api"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Flow System Integration Tests${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Test counter
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ $1${NC}"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}❌ $1${NC}"
    FAILED=$((FAILED + 1))
}

info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# ============================================================
# Test 1: API Health Check
# ============================================================
echo ""
echo -e "${BLUE}--- Test 1: API Health Check ---${NC}"

if curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" | grep -q "200\|404"; then
    pass "Express API is reachable"
else
    fail "Express API is not reachable"
    echo "Please start the server with: npm run dev"
    exit 1
fi

# ============================================================
# Test 2: Flow List Endpoint
# ============================================================
echo ""
echo -e "${BLUE}--- Test 2: Flow List Endpoint ---${NC}"

FLOW_LIST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/flows" 2>/dev/null || echo "000")
if [ "$FLOW_LIST_RESPONSE" = "200" ]; then
    pass "GET /api/flows returns 200"
else
    fail "GET /api/flows returned $FLOW_LIST_RESPONSE (expected 200)"
fi

# ============================================================
# Test 3: Flow Templates Endpoint
# ============================================================
echo ""
echo -e "${BLUE}--- Test 3: Flow Templates Endpoint ---${NC}"

TEMPLATES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/flows/templates" 2>/dev/null || echo "000")
if [ "$TEMPLATES_RESPONSE" = "200" ]; then
    pass "GET /api/flows/templates returns 200"
else
    fail "GET /api/flows/templates returned $TEMPLATES_RESPONSE (expected 200)"
fi

# ============================================================
# Test 4: Flow Creation (if Strapi is available)
# ============================================================
echo ""
echo -e "${BLUE}--- Test 4: Flow Creation ---${NC}"

FLOW_DATA='{
  "name": "Test Flow",
  "slug": "test-flow-integration",
  "description": "Integration test flow",
  "status": "draft",
  "category": "automation",
  "isActive": false,
  "nodes": [
    {
      "nodeId": "input-1",
      "type": "input",
      "name": "Input",
      "description": "Test input",
      "inputFields": [
        {
          "name": "testInput",
          "type": "text",
          "label": "Test Input",
          "required": true
        }
      ],
      "nextNodeId": "output-1"
    },
    {
      "nodeId": "output-1",
      "type": "output",
      "name": "Output",
      "description": "Test output",
      "outputType": "response",
      "format": "json"
    }
  ]
}'

CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/flows" \
    -H "Content-Type: application/json" \
    -d "$FLOW_DATA" 2>/dev/null)

if echo "$CREATE_RESPONSE" | grep -q '"id"'; then
    FLOW_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    pass "Flow created successfully (ID: $FLOW_ID)"

    # ============================================================
    # Test 5: Get Created Flow
    # ============================================================
    echo ""
    echo -e "${BLUE}--- Test 5: Get Created Flow ---${NC}"

    GET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/flows/$FLOW_ID" 2>/dev/null || echo "000")
    if [ "$GET_RESPONSE" = "200" ]; then
        pass "GET /api/flows/$FLOW_ID returns 200"
    else
        fail "GET /api/flows/$FLOW_ID returned $GET_RESPONSE (expected 200)"
    fi

    # ============================================================
    # Test 6: Delete Test Flow (cleanup)
    # ============================================================
    echo ""
    echo -e "${BLUE}--- Test 6: Cleanup Test Flow ---${NC}"

    DELETE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_BASE/flows/$FLOW_ID" 2>/dev/null || echo "000")
    if [ "$DELETE_RESPONSE" = "200" ] || [ "$DELETE_RESPONSE" = "204" ]; then
        pass "Flow deleted successfully"
    else
        fail "DELETE /api/flows/$FLOW_ID returned $DELETE_RESPONSE"
    fi
else
    info "Flow creation requires Strapi backend (skipping dependent tests)"
fi

# ============================================================
# Test 7: Running Executions Endpoint
# ============================================================
echo ""
echo -e "${BLUE}--- Test 7: Running Executions Endpoint ---${NC}"

RUNNING_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/flows/executions/running" 2>/dev/null || echo "000")
if [ "$RUNNING_RESPONSE" = "200" ]; then
    pass "GET /api/flows/executions/running returns 200"
else
    fail "GET /api/flows/executions/running returned $RUNNING_RESPONSE (expected 200)"
fi

# ============================================================
# Test 8: Webhook Routes Check
# ============================================================
echo ""
echo -e "${BLUE}--- Test 8: Webhook Routes Check ---${NC}"

WEBHOOK_LIST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/webhooks/flows" 2>/dev/null || echo "000")
if [ "$WEBHOOK_LIST_RESPONSE" = "200" ]; then
    pass "GET /api/webhooks/flows returns 200"
else
    fail "GET /api/webhooks/flows returned $WEBHOOK_LIST_RESPONSE (expected 200)"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
TOTAL=$((PASSED + FAILED))
echo -e "Total:  $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some tests failed. Check that all services are running.${NC}"
    exit 1
fi
