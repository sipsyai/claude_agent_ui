#!/bin/bash
# Test health check endpoints
# This script tests all health check endpoints to verify database connectivity

set -e

echo "=============================================="
echo "Health Check Endpoints Test"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STRAPI_URL="${STRAPI_URL:-http://localhost:1337}"
EXPRESS_URL="${EXPRESS_URL:-http://localhost:3001}"

# Function to test an endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"

  echo -n "Testing $name... "

  # Make request and capture status code and response
  response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo "000")
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$status_code" = "$expected_status" ] || [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
    echo "  Response: $(echo "$body" | jq -c '.' 2>/dev/null || echo "$body")"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $status_code, expected $expected_status)"
    echo "  Response: $(echo "$body" | jq -c '.' 2>/dev/null || echo "$body")"
    return 1
  fi
}

echo "================================================"
echo "1. Testing Strapi Health Endpoints"
echo "================================================"
echo ""

# Test Strapi primary health check
test_endpoint "Strapi Health Check" "$STRAPI_URL/_health" "200"
echo ""

# Test Strapi readiness check
test_endpoint "Strapi Readiness" "$STRAPI_URL/_health/ready" "200"
echo ""

# Test Strapi liveness check
test_endpoint "Strapi Liveness" "$STRAPI_URL/_health/live" "200"
echo ""

echo "================================================"
echo "2. Testing Express Health Endpoints"
echo "================================================"
echo ""

# Test Express health check
test_endpoint "Express Health Check" "$EXPRESS_URL/health" "200"
echo ""

echo "================================================"
echo "3. Health Check Summary"
echo "================================================"
echo ""

# Get detailed health info from Strapi
echo "Strapi Health Details:"
curl -s "$STRAPI_URL/_health" | jq '.' 2>/dev/null || echo "Failed to get Strapi health details"
echo ""

# Get detailed health info from Express
echo "Express Health Details:"
curl -s "$EXPRESS_URL/health" | jq '.' 2>/dev/null || echo "Failed to get Express health details"
echo ""

echo "================================================"
echo "4. Connection Pool Statistics"
echo "================================================"
echo ""

# Extract pool statistics
echo "Database Connection Pool:"
curl -s "$STRAPI_URL/_health" | jq '.pool' 2>/dev/null || echo "Failed to get pool statistics"
echo ""

echo "Database Status:"
curl -s "$STRAPI_URL/_health" | jq '.database' 2>/dev/null || echo "Failed to get database status"
echo ""

echo "================================================"
echo "Test Complete!"
echo "================================================"
echo ""
echo "All health check endpoints are configured correctly."
echo ""
echo "Docker Health Check Commands:"
echo "  docker ps                          # View container health status"
echo "  docker inspect claude-strapi | jq '.[0].State.Health'  # Detailed Strapi health"
echo "  docker inspect claude-express | jq '.[0].State.Health' # Detailed Express health"
echo ""
