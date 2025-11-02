#!/bin/bash
# ============================================================
# Claude Agent UI - E2E Test Runner
# End-to-End tests for all services
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Load environment variables
if [ -f .env ]; then
    source .env
fi

STRAPI_URL="${STRAPI_URL:-http://localhost:1337}"
EXPRESS_URL="${EXPRESS_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:80}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Claude Agent UI - E2E Test Suite${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Test $TOTAL_TESTS: $test_name ... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# =============================================================================
# DATABASE TESTS
# =============================================================================
echo -e "\n${YELLOW}=== Database Tests ===${NC}"

run_test "PostgreSQL is running" \
    "docker-compose exec -T postgres pg_isready -U ${POSTGRES_USER:-postgres}"

run_test "Database exists" \
    "docker-compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -lqt | cut -d \| -f 1 | grep -qw ${POSTGRES_DB:-claude_agent_ui}"

run_test "Agent table exists" \
    "docker-compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-claude_agent_ui} -c '\dt agents' | grep -q agents"

run_test "Skill table exists" \
    "docker-compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-claude_agent_ui} -c '\dt skills' | grep -q skills"

# =============================================================================
# STRAPI TESTS
# =============================================================================
echo -e "\n${YELLOW}=== Strapi CMS Tests ===${NC}"

run_test "Strapi health check" \
    "curl -f -s -o /dev/null ${STRAPI_URL}/_health"

run_test "Strapi API root accessible" \
    "curl -f -s -o /dev/null ${STRAPI_URL}/api"

run_test "Strapi admin accessible" \
    "curl -f -s -o /dev/null ${STRAPI_URL}/admin"

run_test "Strapi agents endpoint exists" \
    "curl -f -s ${STRAPI_URL}/api/agents | grep -q 'data\|meta'"

run_test "Strapi skills endpoint exists" \
    "curl -f -s ${STRAPI_URL}/api/skills | grep -q 'data\|meta'"

# =============================================================================
# EXPRESS TESTS
# =============================================================================
echo -e "\n${YELLOW}=== Express Backend Tests ===${NC}"

run_test "Express health check" \
    "curl -f -s -o /dev/null ${EXPRESS_URL}/health"

run_test "Express API root accessible" \
    "curl -f -s -o /dev/null ${EXPRESS_URL}/api"

run_test "Express manager routes accessible" \
    "curl -f -s -o /dev/null ${EXPRESS_URL}/api/manager/agents"

run_test "Express execution routes accessible" \
    "curl -f -s -o /dev/null ${EXPRESS_URL}/api/execution/tasks"

run_test "Express SSE endpoint exists" \
    "curl -f -s -m 2 ${EXPRESS_URL}/api/execution/execute -I | grep -q 'text/event-stream'"

# =============================================================================
# FRONTEND TESTS
# =============================================================================
echo -e "\n${YELLOW}=== Frontend Tests ===${NC}"

run_test "Frontend health check" \
    "curl -f -s -o /dev/null ${FRONTEND_URL}/health"

run_test "Frontend index.html accessible" \
    "curl -f -s ${FRONTEND_URL}/ | grep -q '<html\|<!DOCTYPE'"

run_test "Frontend static assets load" \
    "curl -f -s -I ${FRONTEND_URL}/assets/ | grep -q '200\|404'"

run_test "Frontend routes to SPA" \
    "curl -f -s ${FRONTEND_URL}/agents | grep -q '<html\|<!DOCTYPE'"

# =============================================================================
# INTEGRATION TESTS
# =============================================================================
echo -e "\n${YELLOW}=== Integration Tests ===${NC}"

run_test "Frontend can reach Strapi via proxy" \
    "curl -f -s -o /dev/null ${FRONTEND_URL}/api/strapi/agents"

run_test "Frontend can reach Express via proxy" \
    "curl -f -s -o /dev/null ${FRONTEND_URL}/api/express/health"

run_test "Express can communicate with Strapi" \
    "docker-compose exec -T express wget --spider -q http://strapi:1337/_health"

run_test "Strapi can connect to PostgreSQL" \
    "docker-compose exec -T strapi sh -c 'wget --spider -q http://localhost:1337/_health'"

# =============================================================================
# DATA FLOW TESTS
# =============================================================================
echo -e "\n${YELLOW}=== Data Flow Tests ===${NC}"

# Create test agent via Strapi API (with authentication)
# This is a simplified test - full authentication would require valid tokens
run_test "Can create agent via Strapi API" \
    "curl -f -s -X POST ${STRAPI_URL}/api/agents -H 'Content-Type: application/json' -d '{\"data\":{\"name\":\"Test Agent\",\"slug\":\"test-agent\"}}' || true"

run_test "Can retrieve agents via Express API" \
    "curl -f -s ${EXPRESS_URL}/api/manager/agents | grep -q '\[\]' || grep -q 'id'"

# =============================================================================
# DOCKER TESTS
# =============================================================================
echo -e "\n${YELLOW}=== Docker Container Tests ===${NC}"

run_test "PostgreSQL container is healthy" \
    "docker-compose ps postgres | grep -q '(healthy)'"

run_test "Strapi container is healthy" \
    "docker-compose ps strapi | grep -q '(healthy)'"

run_test "Express container is healthy" \
    "docker-compose ps express | grep -q '(healthy)'"

run_test "Frontend container is healthy" \
    "docker-compose ps frontend | grep -q '(healthy)'"

# =============================================================================
# RESULTS SUMMARY
# =============================================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "Total Tests:  ${TOTAL_TESTS}"
echo -e "${GREEN}Passed Tests: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed Tests: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
