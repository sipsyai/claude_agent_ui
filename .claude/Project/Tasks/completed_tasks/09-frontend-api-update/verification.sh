#!/bin/bash

echo "================================================================"
echo "Task 09: Frontend API Client Update - Verification"
echo "================================================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

echo ""
echo "1. Checking environment variables..."
if grep -q "VITE_EXPRESS_URL" .env && grep -q "VITE_STRAPI_URL" .env; then
    echo -e "${GREEN}✓${NC} Environment variables configured"
else
    echo -e "${RED}✗${NC} Missing environment variables"
    FAILED=1
fi

echo ""
echo "2. Checking api.ts dual endpoint structure..."
if grep -q "STRAPI_BASE" src/web/manager/services/api.ts && grep -q "EXECUTE_BASE" src/web/manager/services/api.ts; then
    echo -e "${GREEN}✓${NC} Dual endpoint structure implemented"
else
    echo -e "${RED}✗${NC} Dual endpoint structure missing"
    FAILED=1
fi

echo ""
echo "3. Running TypeScript build..."
if npm run build:server > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server build successful"
else
    echo -e "${RED}✗${NC} Server build failed"
    FAILED=1
fi

echo ""
echo "4. Running frontend build..."
if npm run build:frontend > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend build successful"
else
    echo -e "${RED}✗${NC} Frontend build failed"
    FAILED=1
fi

echo ""
echo "================================================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Task 09 verification complete! All checks passed.${NC}"
    echo ""
    echo "Next steps:"
    echo "  - Task 08: Data Migration (if not done)"
    echo "  - Task 10: Docker Deployment Setup"
    echo "  - Test the UI with: npm run dev"
else
    echo -e "${RED}✗ Task 09 verification failed. Please fix the issues above.${NC}"
fi
echo "================================================================"
