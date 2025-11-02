#!/bin/bash

#######################################
# Task 01: Infrastructure Setup
# Verification Script
#######################################

set -e

echo "========================================="
echo "  Task 01: Infrastructure Setup"
echo "  Verification Script"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper function
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $1"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $1"
        ((FAILED++))
    fi
}

echo "1. Checking docker-compose.yml exists..."
test -f docker-compose.yml
check_step "docker-compose.yml file exists"

echo ""
echo "2. Validating docker-compose.yml syntax..."
docker-compose config > /dev/null 2>&1
check_step "docker-compose.yml syntax valid"

echo ""
echo "3. Checking .env file exists..."
test -f .env
check_step ".env file exists"

echo ""
echo "4. Checking required environment variables in .env..."
grep -q "POSTGRES_USER" .env && \
grep -q "POSTGRES_PASSWORD" .env && \
grep -q "POSTGRES_DB" .env
check_step "Required POSTGRES variables present in .env"

echo ""
echo "5. Checking PostgreSQL container running..."
docker-compose ps | grep -q "claude-postgres.*Up"
check_step "PostgreSQL container is running"

echo ""
echo "6. Checking PostgreSQL health status..."
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' claude-postgres 2>/dev/null || echo "unhealthy")
if [ "$HEALTH" = "healthy" ]; then
    echo -e "${GREEN}✅ PASS${NC}: PostgreSQL container is healthy"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: PostgreSQL container health check failed (Status: $HEALTH)"
    ((FAILED++))
fi

echo ""
echo "7. Testing PostgreSQL connection from container..."
docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1
check_step "PostgreSQL connection from container works"

echo ""
echo "8. Testing PostgreSQL connection from host..."
PGPASSWORD=$(grep POSTGRES_PASSWORD .env | cut -d '=' -f2) psql -h localhost -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1
check_step "PostgreSQL connection from host works"

echo ""
echo "9. Checking Docker network exists..."
docker network inspect claude_agent_ui_app-network > /dev/null 2>&1 || \
docker network inspect app-network > /dev/null 2>&1
check_step "Docker network created"

echo ""
echo "10. Checking Docker volume exists..."
docker volume inspect claude_agent_ui_postgres_data > /dev/null 2>&1 || \
docker volume inspect postgres_data > /dev/null 2>&1
check_step "Docker volume created"

echo ""
echo "11. Checking generate-secrets.sh exists and is executable..."
test -f scripts/generate-secrets.sh && test -x scripts/generate-secrets.sh
check_step "generate-secrets.sh exists and is executable"

echo ""
echo "12. Checking .gitignore includes .env..."
grep -q "^\.env$" .gitignore 2>/dev/null
check_step ".env in .gitignore"

echo ""
echo "========================================="
echo "  Verification Summary"
echo "========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Task 01 is complete.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run 'npm run build' to verify build works"
    echo "  2. Run 'npm start' to verify application starts"
    echo "  3. Move this folder to ../completed_tasks/"
    echo "  4. Proceed to Task 02: PostgreSQL Setup"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix the issues above.${NC}"
    echo ""
    exit 1
fi
