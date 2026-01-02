#!/bin/bash

# Auto-Claude Spec 011: Frontend Testing Setup
# Generated: 2026-01-02
# Purpose: Initialize testing environment for React frontend

set -e

echo "=========================================="
echo "Frontend Testing Environment Setup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check prerequisites
echo -e "${BLUE}[CHECKING]${NC} Prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}[OK]${NC} Node.js $NODE_VERSION found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} npm is not installed"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}[OK]${NC} npm $NPM_VERSION found"

echo ""
echo -e "${BLUE}[SETUP]${NC} Creating test directories..."

# Create test directories if they don't exist
mkdir -p tests/components/ui
mkdir -p tests/hooks
mkdir -p tests/utils
mkdir -p tests/services
mkdir -p tests/mocks
mkdir -p src/test

echo -e "${GREEN}[OK]${NC} Test directories created"

echo ""
echo -e "${BLUE}[INFO]${NC} Installation Status:"
echo ""
echo "Current working directory: $(pwd)"
echo "Node.js version: $NODE_VERSION"
echo "npm version: $NPM_VERSION"
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${GREEN}[OK]${NC} node_modules directory exists"
else
    echo -e "${YELLOW}[WARNING]${NC} node_modules not found - run 'npm install' to install dependencies"
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Install dependencies:"
echo "   ${YELLOW}npm install${NC}"
echo ""
echo "2. Run tests:"
echo "   ${YELLOW}npm run test${NC}"
echo ""
echo "3. Run tests in watch mode:"
echo "   ${YELLOW}npm run test:watch${NC}"
echo ""
echo "4. View test UI:"
echo "   ${YELLOW}npm run test:ui${NC}"
echo ""
echo "5. Generate coverage report:"
echo "   ${YELLOW}npm run test:coverage${NC}"
echo ""
echo "=========================================="
echo "Testing Framework Info:"
echo "=========================================="
echo ""
echo "Framework: Vitest (modern test runner)"
echo "Testing Library: React Testing Library"
echo "DOM Implementation: jsdom"
echo "Matchers: @testing-library/jest-dom"
echo ""
echo "=========================================="
echo "Frontend Service Details:"
echo "=========================================="
echo ""
echo "Language: TypeScript 5.3.3"
echo "Framework: React 18.2.0"
echo "Build Tool: Vite 7.0.6"
echo "Port (dev): 3000"
echo "Port (prod): 3001"
echo "Entry Point: src/web/main.tsx"
echo ""
echo "=========================================="
echo "Test Organization:"
echo "=========================================="
echo ""
echo "- tests/components/     Component unit tests"
echo "- tests/hooks/          Custom hook tests"
echo "- tests/utils/          Utility function tests"
echo "- tests/services/       Service/API integration tests"
echo "- tests/mocks/          Mock factories and handlers"
echo "- src/test/setup.ts     Test setup file"
echo ""
echo "=========================================="
echo "Key Testing Patterns:"
echo "=========================================="
echo ""
echo "✓ Use semantic queries: getByRole, getByLabelText, getByText"
echo "✓ Use userEvent for interactions (not fireEvent)"
echo "✓ Use waitFor() for async operations"
echo "✓ Test component behavior, not implementation"
echo "✓ Test Radix UI with accessibility attributes"
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "For more information, see:"
echo "  - spec.md (detailed requirements)"
echo "  - implementation_plan.json (subtask breakdown)"
echo "  - context.json (technical context)"
echo ""
