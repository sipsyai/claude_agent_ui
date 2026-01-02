#!/bin/bash

###############################################################################
# E2E Entity Test Runner
###############################################################################
#
# This script tests the PostgreSQL migration by creating test data for all
# entity types via the Strapi API and verifying correct storage/retrieval.
#
# Usage:
#   ./scripts/test-e2e-entities.sh
#   npm run test:e2e-entities
#
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STRAPI_URL="${STRAPI_API_URL:-http://localhost:1337/api}"
STRAPI_BASE_URL=$(echo "$STRAPI_URL" | sed 's|/api$||')
HEALTH_ENDPOINT="${STRAPI_BASE_URL}/_health"
MAX_RETRIES=30
RETRY_DELAY=2

###############################################################################
# Functions
###############################################################################

log_info() {
  echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
  echo -e "${GREEN}✅${NC} $1"
}

log_error() {
  echo -e "${RED}❌${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠️ ${NC} $1"
}

# Check if Strapi is running
check_strapi() {
  log_info "Checking if Strapi is running at ${STRAPI_BASE_URL}..."

  local retries=0
  while [ $retries -lt $MAX_RETRIES ]; do
    if curl -f -s -o /dev/null "${HEALTH_ENDPOINT}" 2>/dev/null || \
       curl -f -s -o /dev/null "${STRAPI_BASE_URL}/api" 2>/dev/null; then
      log_success "Strapi is running"
      return 0
    fi

    retries=$((retries + 1))
    if [ $retries -lt $MAX_RETRIES ]; then
      log_warning "Strapi not ready, retrying in ${RETRY_DELAY}s... (${retries}/${MAX_RETRIES})"
      sleep $RETRY_DELAY
    fi
  done

  log_error "Strapi is not running at ${STRAPI_BASE_URL}"
  log_info "Please start Strapi with: docker-compose up -d strapi"
  log_info "Or: cd backend && npm run develop"
  return 1
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check for curl
  if ! command -v curl &> /dev/null; then
    log_error "curl is not installed. Please install curl."
    return 1
  fi

  # Check for tsx (TypeScript execution)
  if ! command -v tsx &> /dev/null; then
    log_warning "tsx not found globally, trying local installation..."
    if [ ! -f "./node_modules/.bin/tsx" ]; then
      log_error "tsx is not installed. Please run: npm install"
      return 1
    fi
  fi

  log_success "Prerequisites check passed"
  return 0
}

# Create test results directory
prepare_test_environment() {
  log_info "Preparing test environment..."

  mkdir -p ./test-results

  log_success "Test environment ready"
}

# Run the TypeScript test script
run_tests() {
  log_info "Running E2E entity tests..."
  echo ""

  # Check if tsx is available globally or locally
  if command -v tsx &> /dev/null; then
    tsx ./scripts/test-e2e-entities.ts
  else
    ./node_modules/.bin/tsx ./scripts/test-e2e-entities.ts
  fi
}

# Cleanup function
cleanup() {
  log_info "Test execution completed"
}

###############################################################################
# Main
###############################################################################

main() {
  echo ""
  echo "================================================="
  echo "E2E Entity Test Runner"
  echo "================================================="
  echo ""

  # Check prerequisites
  if ! check_prerequisites; then
    exit 1
  fi

  # Check if Strapi is running
  if ! check_strapi; then
    exit 1
  fi

  # Prepare test environment
  prepare_test_environment

  # Run tests
  if run_tests; then
    log_success "All tests passed!"
    cleanup
    exit 0
  else
    log_error "Some tests failed"
    cleanup
    exit 1
  fi
}

# Run main function
main "$@"
