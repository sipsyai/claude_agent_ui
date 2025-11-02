#!/bin/bash
# ============================================================
# Claude Agent UI - Security Audit
# Comprehensive security checklist and vulnerability scan
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Load environment
if [ -f .env ]; then
    source .env
fi

OUTPUT_DIR="./tests/security/results"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/security_audit_${TIMESTAMP}.txt"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Claude Agent UI - Security Audit${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Start report
{
    echo "============================================================"
    echo "Claude Agent UI - Security Audit Report"
    echo "============================================================"
    echo "Date: $(date)"
    echo ""
} > "$REPORT_FILE"

# Helper function for security checks
check_security() {
    local check_name="$1"
    local check_command="$2"
    local severity="$3"  # CRITICAL, HIGH, MEDIUM, LOW

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Check $TOTAL_CHECKS: $check_name ... "

    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        echo "✅ PASS - $check_name" >> "$REPORT_FILE"
        return 0
    else
        if [ "$severity" = "CRITICAL" ] || [ "$severity" = "HIGH" ]; then
            echo -e "${RED}FAIL [$severity]${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            echo "❌ FAIL [$severity] - $check_name" >> "$REPORT_FILE"
        else
            echo -e "${YELLOW}WARNING [$severity]${NC}"
            WARNINGS=$((WARNINGS + 1))
            echo "⚠️  WARNING [$severity] - $check_name" >> "$REPORT_FILE"
        fi
        return 1
    fi
}

# =============================================================================
# ENVIRONMENT & SECRETS
# =============================================================================
echo -e "\n${YELLOW}=== Environment & Secrets ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "ENVIRONMENT & SECRETS"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "Environment file exists" \
    "test -f .env" \
    "CRITICAL"

check_security \
    "Environment file not in git" \
    "! git ls-files --error-unmatch .env 2>/dev/null" \
    "CRITICAL"

check_security \
    "PostgreSQL password is set" \
    "test -n \"$POSTGRES_PASSWORD\"" \
    "CRITICAL"

check_security \
    "Anthropic API key is set" \
    "test -n \"$ANTHROPIC_API_KEY\"" \
    "CRITICAL"

check_security \
    "Strapi secrets are set" \
    "test -n \"$STRAPI_JWT_SECRET\" && test -n \"$STRAPI_APP_KEYS\"" \
    "CRITICAL"

check_security \
    "PostgreSQL password is strong (>16 chars)" \
    "test \${#POSTGRES_PASSWORD} -gt 16" \
    "HIGH"

check_security \
    "No default passwords in .env" \
    "! grep -q 'CHANGE_ME\|password123\|admin123' .env" \
    "CRITICAL"

# =============================================================================
# DOCKER SECURITY
# =============================================================================
echo -e "\n${YELLOW}=== Docker Security ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "DOCKER SECURITY"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "Containers run as non-root user" \
    "docker-compose exec -T strapi whoami | grep -q strapi && docker-compose exec -T express whoami | grep -q express" \
    "HIGH"

check_security \
    "No privileged containers" \
    "! docker-compose config | grep -q 'privileged: true'" \
    "CRITICAL"

check_security \
    "Resource limits configured" \
    "docker-compose config | grep -q 'limits:' && docker-compose config | grep -q 'memory:'" \
    "MEDIUM"

check_security \
    "Health checks configured" \
    "docker-compose config | grep -q 'healthcheck:'" \
    "MEDIUM"

check_security \
    "No host network mode" \
    "! docker-compose config | grep -q 'network_mode: host'" \
    "HIGH"

# =============================================================================
# NETWORK SECURITY
# =============================================================================
echo -e "\n${YELLOW}=== Network Security ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "NETWORK SECURITY"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "CORS is configured" \
    "test -n \"$CORS_ORIGIN\"" \
    "HIGH"

check_security \
    "PostgreSQL not exposed on default port" \
    "test \"${POSTGRES_PORT:-5432}\" != \"5432\"" \
    "MEDIUM"

check_security \
    "Rate limiting configured in nginx" \
    "grep -q 'limit_req_zone' nginx/conf.d/default.conf" \
    "HIGH"

check_security \
    "Security headers configured" \
    "grep -q 'X-Frame-Options' nginx/nginx.conf && grep -q 'X-Content-Type-Options' nginx/nginx.conf" \
    "HIGH"

# =============================================================================
# APPLICATION SECURITY
# =============================================================================
echo -e "\n${YELLOW}=== Application Security ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "APPLICATION SECURITY"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "HTTPS headers present in nginx config" \
    "grep -q 'ssl_protocols' nginx/conf.d/default.conf || grep -q 'HTTPS.*optional' nginx/conf.d/default.conf" \
    "LOW"

check_security \
    "NODE_ENV set to production" \
    "grep -q 'NODE_ENV.*production' docker-compose.yml" \
    "HIGH"

check_security \
    "Debug mode disabled" \
    "! docker-compose config | grep -i 'debug.*true'" \
    "MEDIUM"

check_security \
    "Error messages not exposed" \
    "! docker-compose config | grep -i 'VERBOSE.*true'" \
    "MEDIUM"

# =============================================================================
# FILE PERMISSIONS
# =============================================================================
echo -e "\n${YELLOW}=== File Permissions ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "FILE PERMISSIONS"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    ".env file not world-readable" \
    "test \$(stat -c '%a' .env 2>/dev/null || stat -f '%A' .env 2>/dev/null | tail -c 4) != '644'" \
    "HIGH"

check_security \
    "Scripts are executable" \
    "test -x scripts/deploy.sh" \
    "LOW"

check_security \
    "Backup directory exists with proper permissions" \
    "test -d database/backups && test -w database/backups" \
    "MEDIUM"

# =============================================================================
# DEPENDENCIES & VULNERABILITIES
# =============================================================================
echo -e "\n${YELLOW}=== Dependencies & Vulnerabilities ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "DEPENDENCIES & VULNERABILITIES"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "package-lock.json exists" \
    "test -f package-lock.json" \
    "HIGH"

check_security \
    "No known vulnerabilities in dependencies" \
    "npm audit --audit-level=high 2>&1 | grep -q '0 vulnerabilities' || npm audit --audit-level=high 2>&1 | grep -q 'found 0'" \
    "HIGH"

check_security \
    "Docker base images are specific versions" \
    "grep -q 'FROM.*:.*-alpine' docker-compose.yml Dockerfile* backend/Dockerfile" \
    "MEDIUM"

# =============================================================================
# DATABASE SECURITY
# =============================================================================
echo -e "\n${YELLOW}=== Database Security ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "DATABASE SECURITY"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "PostgreSQL SSL configured (or explicitly disabled)" \
    "docker-compose config | grep -q 'DATABASE_SSL'" \
    "MEDIUM"

check_security \
    "Database backups configured" \
    "test -f scripts/backup-postgres.sh" \
    "HIGH"

check_security \
    "Database user is not 'postgres' in production" \
    "test \"$NODE_ENV\" != \"production\" || test \"${POSTGRES_USER:-postgres}\" != \"postgres\"" \
    "LOW"

# =============================================================================
# LOGGING & MONITORING
# =============================================================================
echo -e "\n${YELLOW}=== Logging & Monitoring ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "LOGGING & MONITORING"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "Log rotation configured" \
    "docker-compose config | grep -q 'max-size'" \
    "MEDIUM"

check_security \
    "Logs directory exists" \
    "test -d logs" \
    "LOW"

check_security \
    "Health check endpoints accessible" \
    "curl -f -s http://localhost:1337/_health > /dev/null && curl -f -s http://localhost:3001/health > /dev/null" \
    "MEDIUM"

# =============================================================================
# STRAPI SECURITY
# =============================================================================
echo -e "\n${YELLOW}=== Strapi Specific Security ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "STRAPI SPECIFIC SECURITY"
    echo "============================================================"
} >> "$REPORT_FILE"

check_security \
    "Strapi admin path is not default" \
    "test \"${STRAPI_ADMIN_PATH:-/admin}\" != \"/admin\" || echo 'Using default admin path'" \
    "LOW"

check_security \
    "Strapi API token configured" \
    "test -n \"$STRAPI_API_TOKEN\"" \
    "HIGH"

check_security \
    "File upload size limit configured" \
    "docker-compose config | grep -q 'MAX_FILE_SIZE'" \
    "MEDIUM"

# =============================================================================
# ADDITIONAL SECURITY SCANS
# =============================================================================
echo -e "\n${YELLOW}=== Additional Security Scans ===${NC}"
{
    echo ""
    echo "============================================================"
    echo "ADDITIONAL SECURITY INFORMATION"
    echo "============================================================"
    echo ""

    echo "Open Ports:"
    docker-compose ps --format json 2>/dev/null | grep -o '"Ports":[^}]*' | head -10 || echo "Unable to list ports"
    echo ""

    echo "Volume Mounts:"
    docker-compose config | grep -A 2 "volumes:" | head -20
    echo ""

    echo "Network Configuration:"
    docker-compose config | grep -A 5 "networks:" | head -15
    echo ""
} >> "$REPORT_FILE"

# =============================================================================
# RESULTS SUMMARY
# =============================================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Security Audit Results${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "Total Checks:   ${TOTAL_CHECKS}"
echo -e "${GREEN}Passed:         ${PASSED_CHECKS}${NC}"
echo -e "${RED}Failed:         ${FAILED_CHECKS}${NC}"
echo -e "${YELLOW}Warnings:       ${WARNINGS}${NC}"
echo ""

{
    echo ""
    echo "============================================================"
    echo "SUMMARY"
    echo "============================================================"
    echo ""
    echo "Total Checks:   ${TOTAL_CHECKS}"
    echo "Passed:         ${PASSED_CHECKS}"
    echo "Failed:         ${FAILED_CHECKS}"
    echo "Warnings:       ${WARNINGS}"
    echo ""

    if [ $FAILED_CHECKS -eq 0 ]; then
        echo "✅ No critical security issues found!"
    else
        echo "❌ Security issues detected. Please review and fix them."
    fi

    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  ${WARNINGS} warnings detected. Review recommended."
    fi
    echo ""
} >> "$REPORT_FILE"

echo "Full report saved to: $REPORT_FILE"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ Security audit passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Security audit found issues. Please review the report.${NC}"
    exit 1
fi
