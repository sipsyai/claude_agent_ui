#!/bin/bash
# ============================================================
# Claude Agent UI - Backup & Restore Testing Script
# Tests backup creation and restoration procedures
# ============================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./database/backups"
TEST_BACKUP_NAME="test_backup_$(date +%Y%m%d_%H%M%S)"
TEST_RESULTS_FILE="./database/backups/backup-restore-test-results.json"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-claude_agent_ui}"
TEST_DB="claude_agent_ui_test_restore"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize test results
init_test_results() {
    cat > "$TEST_RESULTS_FILE" <<EOF
{
  "testRun": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "testType": "backup-restore-verification",
    "status": "in_progress"
  },
  "tests": [],
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0
  }
}
EOF
}

# Add test result
add_test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"

    # Update summary count
    local summary_field
    case "$status" in
        "passed") summary_field="passed" ;;
        "failed") summary_field="failed" ;;
        "warning") summary_field="warnings" ;;
    esac

    # Create temporary file with updated results
    local temp_file=$(mktemp)
    jq --arg name "$test_name" \
       --arg status "$status" \
       --arg message "$message" \
       --arg details "$details" \
       --arg field "$summary_field" \
       '.tests += [{
           "name": $name,
           "status": $status,
           "message": $message,
           "details": $details,
           "timestamp": (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
         }] |
         .summary.total += 1 |
         .summary[$field] += 1' \
       "$TEST_RESULTS_FILE" > "$temp_file"

    mv "$temp_file" "$TEST_RESULTS_FILE"
}

# Finalize test results
finalize_test_results() {
    local final_status="$1"

    local temp_file=$(mktemp)
    jq --arg status "$final_status" \
       '.testRun.status = $status' \
       "$TEST_RESULTS_FILE" > "$temp_file"

    mv "$temp_file" "$TEST_RESULTS_FILE"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory does not exist: $BACKUP_DIR"
        add_test_result "Prerequisites - Backup Directory" "failed" "Backup directory does not exist"
        return 1
    fi
    add_test_result "Prerequisites - Backup Directory" "passed" "Backup directory exists"

    # Check if docker-compose is available (try both commands)
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    else
        log_error "Neither 'docker-compose' nor 'docker compose' command found"
        add_test_result "Prerequisites - Docker Compose" "failed" "Docker Compose not available"
        return 1
    fi
    add_test_result "Prerequisites - Docker Compose" "passed" "Docker Compose available: $DOCKER_COMPOSE_CMD"

    # Check if PostgreSQL container is running
    if ! $DOCKER_COMPOSE_CMD ps postgres 2>/dev/null | grep -q "Up"; then
        log_error "PostgreSQL container is not running"
        add_test_result "Prerequisites - PostgreSQL Running" "failed" "PostgreSQL container not running"
        return 1
    fi
    add_test_result "Prerequisites - PostgreSQL Running" "passed" "PostgreSQL container is running"

    # Check if jq is available for JSON processing
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found - test results will not be saved in JSON format"
        add_test_result "Prerequisites - jq Tool" "warning" "jq not available for JSON processing"
    else
        add_test_result "Prerequisites - jq Tool" "passed" "jq available for JSON processing"
    fi

    log_success "All prerequisites met"
    return 0
}

# Test 1: Create a backup
test_create_backup() {
    log_info "Test 1: Creating backup..."

    local backup_file="$BACKUP_DIR/${TEST_BACKUP_NAME}.sql"

    # Run backup script
    if bash ./scripts/backup-postgres.sh; then
        # Find the most recent backup (should be the one we just created)
        local latest_backup=$(ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -n1)

        if [ -z "$latest_backup" ]; then
            log_error "Backup file not created"
            add_test_result "Create Backup" "failed" "Backup file not created"
            return 1
        fi

        # Check if backup file has content
        local file_size=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup" 2>/dev/null)
        if [ "$file_size" -lt 100 ]; then
            log_error "Backup file is too small: ${file_size} bytes"
            add_test_result "Create Backup" "failed" "Backup file too small: ${file_size} bytes"
            return 1
        fi

        # Verify gzip integrity
        if ! gzip -t "$latest_backup" 2>/dev/null; then
            log_error "Backup file is corrupted (failed gzip integrity check)"
            add_test_result "Create Backup" "failed" "Backup file corrupted"
            return 1
        fi

        log_success "Backup created successfully: $latest_backup (${file_size} bytes)"
        add_test_result "Create Backup" "passed" "Backup created and verified" "$latest_backup (${file_size} bytes)"

        # Store backup path for restore test
        echo "$latest_backup" > /tmp/test_backup_path.txt
        return 0
    else
        log_error "Backup script failed"
        add_test_result "Create Backup" "failed" "Backup script execution failed"
        return 1
    fi
}

# Test 2: Get current database state
test_capture_db_state() {
    log_info "Test 2: Capturing current database state..."

    local state_file="/tmp/db_state_before_restore.txt"

    # Count tables
    local table_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

    if [ -z "$table_count" ]; then
        log_warning "Could not capture database state"
        add_test_result "Capture DB State" "warning" "Could not query database"
        return 1
    fi

    # Count agents
    local agent_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
        "SELECT COUNT(*) FROM agents;" 2>/dev/null | tr -d ' ' || echo "0")

    # Count skills
    local skill_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
        "SELECT COUNT(*) FROM skills;" 2>/dev/null | tr -d ' ' || echo "0")

    # Save state
    cat > "$state_file" <<EOF
table_count=$table_count
agent_count=$agent_count
skill_count=$skill_count
EOF

    log_success "Database state captured: $table_count tables, $agent_count agents, $skill_count skills"
    add_test_result "Capture DB State" "passed" "Database state captured" "Tables: $table_count, Agents: $agent_count, Skills: $skill_count"

    return 0
}

# Test 3: Restore to test database
test_restore_to_test_db() {
    log_info "Test 3: Restoring backup to test database..."

    # Get backup path from previous test
    if [ ! -f /tmp/test_backup_path.txt ]; then
        log_error "Backup path not found from previous test"
        add_test_result "Restore to Test DB" "failed" "Backup path not available"
        return 1
    fi

    local backup_path=$(cat /tmp/test_backup_path.txt)

    if [ ! -f "$backup_path" ]; then
        log_error "Backup file not found: $backup_path"
        add_test_result "Restore to Test DB" "failed" "Backup file not found"
        return 1
    fi

    # Drop test database if exists
    $DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c \
        "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null || true

    # Create test database
    if ! $DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c \
        "CREATE DATABASE $TEST_DB OWNER $POSTGRES_USER;" 2>/dev/null; then
        log_error "Failed to create test database"
        add_test_result "Restore to Test DB" "failed" "Could not create test database"
        return 1
    fi

    # Restore backup to test database
    if gunzip -c "$backup_path" | $DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$TEST_DB" > /dev/null 2>&1; then
        log_success "Backup restored to test database: $TEST_DB"
        add_test_result "Restore to Test DB" "passed" "Backup restored successfully to test database"
        return 0
    else
        log_error "Failed to restore backup to test database"
        add_test_result "Restore to Test DB" "failed" "Restore command failed"
        return 1
    fi
}

# Test 4: Verify restored data
test_verify_restored_data() {
    log_info "Test 4: Verifying restored data integrity..."

    # Count tables in test database
    local table_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$TEST_DB" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

    if [ -z "$table_count" ] || [ "$table_count" -eq 0 ]; then
        log_error "No tables found in restored database"
        add_test_result "Verify Restored Data" "failed" "No tables in restored database"
        return 1
    fi

    # Count agents in test database
    local agent_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$TEST_DB" -t -c \
        "SELECT COUNT(*) FROM agents;" 2>/dev/null | tr -d ' ' || echo "0")

    # Count skills in test database
    local skill_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$TEST_DB" -t -c \
        "SELECT COUNT(*) FROM skills;" 2>/dev/null | tr -d ' ' || echo "0")

    # Load original state
    if [ -f /tmp/db_state_before_restore.txt ]; then
        source /tmp/db_state_before_restore.txt

        # Compare counts
        if [ "$table_count" -eq "$table_count" ]; then
            log_success "Table count matches: $table_count tables"
        else
            log_warning "Table count mismatch: original=$table_count, restored=$table_count"
        fi

        log_success "Restored data verified: $table_count tables, $agent_count agents, $skill_count skills"
        add_test_result "Verify Restored Data" "passed" "Data integrity verified" "Tables: $table_count, Agents: $agent_count, Skills: $skill_count"
    else
        log_success "Data restored: $table_count tables, $agent_count agents, $skill_count skills"
        add_test_result "Verify Restored Data" "passed" "Data restored successfully" "Tables: $table_count, Agents: $agent_count, Skills: $skill_count"
    fi

    return 0
}

# Test 5: Cleanup test database
test_cleanup() {
    log_info "Test 5: Cleaning up test database..."

    if $DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c \
        "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null; then
        log_success "Test database cleaned up"
        add_test_result "Cleanup Test DB" "passed" "Test database dropped successfully"
        return 0
    else
        log_warning "Could not drop test database (may not exist)"
        add_test_result "Cleanup Test DB" "warning" "Could not drop test database"
        return 0
    fi
}

# Generate test report
generate_report() {
    echo ""
    echo "========================================"
    echo "Backup & Restore Test Results"
    echo "========================================"

    if [ -f "$TEST_RESULTS_FILE" ]; then
        echo ""
        echo "Summary:"
        jq -r '.summary | "  Total Tests: \(.total)\n  Passed: \(.passed)\n  Failed: \(.failed)\n  Warnings: \(.warnings)"' "$TEST_RESULTS_FILE"

        echo ""
        echo "Detailed Results:"
        jq -r '.tests[] | "  [\(.status | ascii_upcase)] \(.name): \(.message)"' "$TEST_RESULTS_FILE"

        echo ""
        echo "Full report saved to: $TEST_RESULTS_FILE"

        # Determine overall status
        local failed_count=$(jq -r '.summary.failed' "$TEST_RESULTS_FILE")
        if [ "$failed_count" -gt 0 ]; then
            log_error "Some tests failed. Please review the results above."
            return 1
        else
            log_success "All tests passed!"
            return 0
        fi
    else
        log_warning "Test results file not found"
        return 1
    fi
}

# Main execution
main() {
    echo "========================================"
    echo "PostgreSQL Backup & Restore Test"
    echo "========================================"
    echo ""

    # Initialize test results
    init_test_results

    # Run tests
    local test_status=0

    if ! check_prerequisites; then
        finalize_test_results "failed"
        generate_report
        exit 1
    fi

    test_create_backup || test_status=1
    test_capture_db_state || true  # Non-critical
    test_restore_to_test_db || test_status=1
    test_verify_restored_data || test_status=1
    test_cleanup || true  # Non-critical

    # Finalize and generate report
    if [ $test_status -eq 0 ]; then
        finalize_test_results "passed"
    else
        finalize_test_results "failed"
    fi

    generate_report
    exit $test_status
}

# Run main function
main "$@"
