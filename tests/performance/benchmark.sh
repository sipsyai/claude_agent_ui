#!/bin/bash
# ============================================================
# Claude Agent UI - Performance Benchmark Suite
# Load testing and performance metrics for all services
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DURATION=60  # seconds
CONCURRENT_USERS=10
REQUESTS_PER_SECOND=5

# Load environment
if [ -f .env ]; then
    source .env
fi

STRAPI_URL="${STRAPI_URL:-http://localhost:1337}"
EXPRESS_URL="${EXPRESS_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:80}"

OUTPUT_DIR="./tests/performance/results"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/benchmark_${TIMESTAMP}.txt"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Claude Agent UI - Performance Benchmark${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Duration: ${DURATION}s"
echo "Concurrent Users: ${CONCURRENT_USERS}"
echo "Target RPS: ${REQUESTS_PER_SECOND}"
echo "Report: ${REPORT_FILE}"
echo ""

# Start report
{
    echo "============================================================"
    echo "Claude Agent UI - Performance Benchmark Report"
    echo "============================================================"
    echo "Date: $(date)"
    echo "Duration: ${DURATION}s"
    echo "Concurrent Users: ${CONCURRENT_USERS}"
    echo ""
} > "$REPORT_FILE"

# =============================================================================
# BASELINE SYSTEM METRICS
# =============================================================================
echo -e "${YELLOW}=== Collecting Baseline Metrics ===${NC}"

{
    echo "============================================================"
    echo "BASELINE SYSTEM METRICS"
    echo "============================================================"
    echo ""
    echo "Docker Container Stats (Before Load):"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""
} >> "$REPORT_FILE"

# =============================================================================
# STRAPI API BENCHMARK
# =============================================================================
echo -e "${YELLOW}=== Benchmarking Strapi API ===${NC}"

echo "Testing Strapi /api/agents endpoint..."
ab -n 1000 -c $CONCURRENT_USERS -g "$OUTPUT_DIR/strapi_agents_${TIMESTAMP}.tsv" \
   "${STRAPI_URL}/api/agents" > "$OUTPUT_DIR/strapi_agents_${TIMESTAMP}_raw.txt" 2>&1 || true

{
    echo "============================================================"
    echo "STRAPI API BENCHMARK - /api/agents"
    echo "============================================================"
    echo ""
    grep -E "Requests per second|Time per request|Transfer rate|Failed requests" \
        "$OUTPUT_DIR/strapi_agents_${TIMESTAMP}_raw.txt" || echo "Benchmark data not available"
    echo ""
} >> "$REPORT_FILE"

echo "Testing Strapi /api/skills endpoint..."
ab -n 1000 -c $CONCURRENT_USERS -g "$OUTPUT_DIR/strapi_skills_${TIMESTAMP}.tsv" \
   "${STRAPI_URL}/api/skills" > "$OUTPUT_DIR/strapi_skills_${TIMESTAMP}_raw.txt" 2>&1 || true

{
    echo "============================================================"
    echo "STRAPI API BENCHMARK - /api/skills"
    echo "============================================================"
    echo ""
    grep -E "Requests per second|Time per request|Transfer rate|Failed requests" \
        "$OUTPUT_DIR/strapi_skills_${TIMESTAMP}_raw.txt" || echo "Benchmark data not available"
    echo ""
} >> "$REPORT_FILE"

# =============================================================================
# EXPRESS API BENCHMARK
# =============================================================================
echo -e "${YELLOW}=== Benchmarking Express API ===${NC}"

echo "Testing Express /health endpoint..."
ab -n 1000 -c $CONCURRENT_USERS -g "$OUTPUT_DIR/express_health_${TIMESTAMP}.tsv" \
   "${EXPRESS_URL}/health" > "$OUTPUT_DIR/express_health_${TIMESTAMP}_raw.txt" 2>&1 || true

{
    echo "============================================================"
    echo "EXPRESS API BENCHMARK - /health"
    echo "============================================================"
    echo ""
    grep -E "Requests per second|Time per request|Transfer rate|Failed requests" \
        "$OUTPUT_DIR/express_health_${TIMESTAMP}_raw.txt" || echo "Benchmark data not available"
    echo ""
} >> "$REPORT_FILE"

echo "Testing Express /api/manager/agents endpoint..."
ab -n 1000 -c $CONCURRENT_USERS -g "$OUTPUT_DIR/express_agents_${TIMESTAMP}.tsv" \
   "${EXPRESS_URL}/api/manager/agents" > "$OUTPUT_DIR/express_agents_${TIMESTAMP}_raw.txt" 2>&1 || true

{
    echo "============================================================"
    echo "EXPRESS API BENCHMARK - /api/manager/agents"
    echo "============================================================"
    echo ""
    grep -E "Requests per second|Time per request|Transfer rate|Failed requests" \
        "$OUTPUT_DIR/express_agents_${TIMESTAMP}_raw.txt" || echo "Benchmark data not available"
    echo ""
} >> "$REPORT_FILE"

# =============================================================================
# FRONTEND BENCHMARK
# =============================================================================
echo -e "${YELLOW}=== Benchmarking Frontend ===${NC}"

echo "Testing Frontend / endpoint..."
ab -n 500 -c $CONCURRENT_USERS -g "$OUTPUT_DIR/frontend_index_${TIMESTAMP}.tsv" \
   "${FRONTEND_URL}/" > "$OUTPUT_DIR/frontend_index_${TIMESTAMP}_raw.txt" 2>&1 || true

{
    echo "============================================================"
    echo "FRONTEND BENCHMARK - / (index.html)"
    echo "============================================================"
    echo ""
    grep -E "Requests per second|Time per request|Transfer rate|Failed requests" \
        "$OUTPUT_DIR/frontend_index_${TIMESTAMP}_raw.txt" || echo "Benchmark data not available"
    echo ""
} >> "$REPORT_FILE"

# =============================================================================
# UNDER LOAD SYSTEM METRICS
# =============================================================================
echo -e "${YELLOW}=== Collecting Under-Load Metrics ===${NC}"

# Run concurrent load for 30 seconds while collecting metrics
{
    ab -n 1000 -c 20 "${EXPRESS_URL}/api/manager/agents" > /dev/null 2>&1 &
    ab -n 1000 -c 20 "${STRAPI_URL}/api/agents" > /dev/null 2>&1 &
    sleep 5

    echo "============================================================"
    echo "SYSTEM METRICS UNDER LOAD"
    echo "============================================================"
    echo ""
    echo "Docker Container Stats (Under Load):"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""

    wait
} >> "$REPORT_FILE"

# =============================================================================
# DATABASE PERFORMANCE
# =============================================================================
echo -e "${YELLOW}=== Benchmarking Database ===${NC}"

{
    echo "============================================================"
    echo "DATABASE PERFORMANCE"
    echo "============================================================"
    echo ""
    echo "PostgreSQL Connection Count:"
    docker-compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-claude_agent_ui} \
        -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB:-claude_agent_ui}';" 2>&1 || echo "N/A"
    echo ""

    echo "PostgreSQL Cache Hit Ratio:"
    docker-compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-claude_agent_ui} \
        -c "SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio FROM pg_statio_user_tables;" 2>&1 || echo "N/A"
    echo ""

    echo "Table Sizes:"
    docker-compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-claude_agent_ui} \
        -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;" 2>&1 || echo "N/A"
    echo ""
} >> "$REPORT_FILE"

# =============================================================================
# RESPONSE TIME ANALYSIS
# =============================================================================
echo -e "${YELLOW}=== Response Time Analysis ===${NC}"

{
    echo "============================================================"
    echo "RESPONSE TIME PERCENTILES"
    echo "============================================================"
    echo ""

    # Calculate percentiles for Strapi
    if [ -f "$OUTPUT_DIR/strapi_agents_${TIMESTAMP}.tsv" ]; then
        echo "Strapi /api/agents:"
        awk '{print $5}' "$OUTPUT_DIR/strapi_agents_${TIMESTAMP}.tsv" | \
            sort -n | \
            awk '{a[NR]=$1} END {
                print "  p50: " a[int(NR*0.50)] "ms"
                print "  p95: " a[int(NR*0.95)] "ms"
                print "  p99: " a[int(NR*0.99)] "ms"
            }'
        echo ""
    fi

    # Calculate percentiles for Express
    if [ -f "$OUTPUT_DIR/express_agents_${TIMESTAMP}.tsv" ]; then
        echo "Express /api/manager/agents:"
        awk '{print $5}' "$OUTPUT_DIR/express_agents_${TIMESTAMP}.tsv" | \
            sort -n | \
            awk '{a[NR]=$1} END {
                print "  p50: " a[int(NR*0.50)] "ms"
                print "  p95: " a[int(NR*0.95)] "ms"
                print "  p99: " a[int(NR*0.99)] "ms"
            }'
        echo ""
    fi
} >> "$REPORT_FILE"

# =============================================================================
# FINAL SYSTEM STATE
# =============================================================================
echo -e "${YELLOW}=== Collecting Final Metrics ===${NC}"

{
    echo "============================================================"
    echo "FINAL SYSTEM STATE"
    echo "============================================================"
    echo ""
    echo "Docker Container Stats (After Load):"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""

    echo "Container Health:"
    docker-compose ps
    echo ""
} >> "$REPORT_FILE"

# =============================================================================
# PERFORMANCE SUMMARY
# =============================================================================
{
    echo "============================================================"
    echo "PERFORMANCE SUMMARY"
    echo "============================================================"
    echo ""
    echo "Test completed successfully!"
    echo "All raw data saved to: $OUTPUT_DIR"
    echo ""
    echo "Key Findings:"
    echo "- Review response time percentiles above"
    echo "- Check failed requests count in each benchmark"
    echo "- Monitor resource usage under load"
    echo "- Verify all containers remain healthy"
    echo ""
} >> "$REPORT_FILE"

# Display report
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}Benchmark Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Full report saved to: $REPORT_FILE"
echo ""
echo "Summary:"
cat "$REPORT_FILE"

echo ""
echo -e "${BLUE}Benchmark files created:${NC}"
ls -lh "$OUTPUT_DIR"/*${TIMESTAMP}* 2>/dev/null || echo "No files created"
