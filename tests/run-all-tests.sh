#!/bin/bash
# ============================================================
# Claude Agent UI - Master Test Runner
# Runs all test suites: E2E, Performance, and Security
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="./tests/results"
mkdir -p "$LOG_DIR"

MASTER_LOG="$LOG_DIR/test_run_${TIMESTAMP}.log"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Claude Agent UI - Complete Test Suite${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Test Run ID: ${TIMESTAMP}"
echo "Master Log: ${MASTER_LOG}"
echo ""

# Initialize master log
{
    echo "============================================================"
    echo "Claude Agent UI - Complete Test Suite"
    echo "============================================================"
    echo "Date: $(date)"
    echo "Test Run ID: ${TIMESTAMP}"
    echo ""
} > "$MASTER_LOG"

# Track results
E2E_RESULT=0
PERF_RESULT=0
SEC_RESULT=0

# =============================================================================
# PRE-TEST CHECKS
# =============================================================================
echo -e "${YELLOW}=== Pre-Test Checks ===${NC}"
{
    echo "============================================================"
    echo "PRE-TEST CHECKS"
    echo "============================================================"
    echo ""
} >> "$MASTER_LOG"

echo "Checking Docker containers..."
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Docker containers are running${NC}"
    {
        echo "✅ Docker containers are running"
        docker-compose ps
        echo ""
    } >> "$MASTER_LOG"
else
    echo -e "${RED}✗ Docker containers are not running${NC}"
    echo "Please start the containers with: docker-compose up -d"
    exit 1
fi

# =============================================================================
# E2E TESTS
# =============================================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Running E2E Tests${NC}"
echo -e "${BLUE}============================================================${NC}"
{
    echo "============================================================"
    echo "E2E TEST RESULTS"
    echo "============================================================"
    echo ""
} >> "$MASTER_LOG"

if bash ./tests/e2e/test-runner.sh 2>&1 | tee -a "$MASTER_LOG"; then
    E2E_RESULT=0
    echo -e "${GREEN}✅ E2E Tests: PASSED${NC}"
else
    E2E_RESULT=1
    echo -e "${RED}❌ E2E Tests: FAILED${NC}"
fi

# =============================================================================
# PERFORMANCE TESTS
# =============================================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Running Performance Benchmarks${NC}"
echo -e "${BLUE}============================================================${NC}"
{
    echo ""
    echo "============================================================"
    echo "PERFORMANCE BENCHMARK RESULTS"
    echo "============================================================"
    echo ""
} >> "$MASTER_LOG"

if bash ./tests/performance/benchmark.sh 2>&1 | tee -a "$MASTER_LOG"; then
    PERF_RESULT=0
    echo -e "${GREEN}✅ Performance Benchmarks: PASSED${NC}"
else
    PERF_RESULT=1
    echo -e "${YELLOW}⚠️  Performance Benchmarks: COMPLETED WITH WARNINGS${NC}"
fi

# =============================================================================
# SECURITY AUDIT
# =============================================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Running Security Audit${NC}"
echo -e "${BLUE}============================================================${NC}"
{
    echo ""
    echo "============================================================"
    echo "SECURITY AUDIT RESULTS"
    echo "============================================================"
    echo ""
} >> "$MASTER_LOG"

if bash ./tests/security/security-audit.sh 2>&1 | tee -a "$MASTER_LOG"; then
    SEC_RESULT=0
    echo -e "${GREEN}✅ Security Audit: PASSED${NC}"
else
    SEC_RESULT=1
    echo -e "${RED}❌ Security Audit: FAILED${NC}"
fi

# =============================================================================
# FINAL SUMMARY
# =============================================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Test Suite Summary${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

{
    echo ""
    echo "============================================================"
    echo "FINAL SUMMARY"
    echo "============================================================"
    echo ""
} >> "$MASTER_LOG"

# Display results
if [ $E2E_RESULT -eq 0 ]; then
    echo -e "E2E Tests:           ${GREEN}✅ PASSED${NC}"
    echo "E2E Tests:           ✅ PASSED" >> "$MASTER_LOG"
else
    echo -e "E2E Tests:           ${RED}❌ FAILED${NC}"
    echo "E2E Tests:           ❌ FAILED" >> "$MASTER_LOG"
fi

if [ $PERF_RESULT -eq 0 ]; then
    echo -e "Performance Tests:   ${GREEN}✅ PASSED${NC}"
    echo "Performance Tests:   ✅ PASSED" >> "$MASTER_LOG"
else
    echo -e "Performance Tests:   ${YELLOW}⚠️  WARNINGS${NC}"
    echo "Performance Tests:   ⚠️  WARNINGS" >> "$MASTER_LOG"
fi

if [ $SEC_RESULT -eq 0 ]; then
    echo -e "Security Audit:      ${GREEN}✅ PASSED${NC}"
    echo "Security Audit:      ✅ PASSED" >> "$MASTER_LOG"
else
    echo -e "Security Audit:      ${RED}❌ FAILED${NC}"
    echo "Security Audit:      ❌ FAILED" >> "$MASTER_LOG"
fi

echo ""
echo "Master log: $MASTER_LOG"

{
    echo ""
    echo "Test completed at: $(date)"
    echo ""
} >> "$MASTER_LOG"

# Determine exit code
TOTAL_FAILURES=$((E2E_RESULT + SEC_RESULT))

if [ $TOTAL_FAILURES -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. Please review the logs.${NC}"
    echo ""
    exit 1
fi
