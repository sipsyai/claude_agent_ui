#!/bin/bash
# ============================================================
# Claude Agent UI - PostgreSQL Cron Backup Script
# Production-ready backup script for automated cron execution
# ============================================================
#
# USAGE:
#   bash ./scripts/backup-postgres-cron.sh
#
# CRON SETUP:
#   # Daily backup at 2:00 AM
#   0 2 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
#
# CONFIGURATION:
#   Set via environment variables in .env or directly in cron:
#   - BACKUP_RETENTION=7                    # Keep last N backups (default: 7)
#   - BACKUP_NOTIFY_EMAIL=admin@example.com # Email for notifications (optional)
#   - BACKUP_LOG_RETENTION=30               # Keep last N log files (default: 30)
#   - BACKUP_MIN_SIZE_KB=10                 # Minimum valid backup size in KB (default: 10)
#
# EXIT CODES:
#   0 - Success
#   1 - PostgreSQL container not running
#   2 - Backup creation failed
#   3 - Backup compression failed
#   4 - Backup verification failed
#   5 - Prerequisite check failed
# ============================================================

set -euo pipefail

# ============================================================
# Configuration
# ============================================================

# Get script directory (absolute path for cron compatibility)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project directory (important for docker-compose)
cd "$PROJECT_DIR"

# Load environment variables if .env exists
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/database/backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"
BACKUP_MIN_SIZE_KB="${BACKUP_MIN_SIZE_KB:-10}"
BACKUP_LOG_RETENTION="${BACKUP_LOG_RETENTION:-30}"

# Log configuration
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
LOG_FILE="$LOG_DIR/backup-cron.log"

# Notification configuration (optional)
BACKUP_NOTIFY_EMAIL="${BACKUP_NOTIFY_EMAIL:-}"
BACKUP_NOTIFY_WEBHOOK="${BACKUP_NOTIFY_WEBHOOK:-}"

# Database configuration
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-claude_agent_ui}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"

# Timestamp for this backup run
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

# ============================================================
# Logging Functions
# ============================================================

# Initialize logging
init_logging() {
    mkdir -p "$LOG_DIR"

    # Rotate old logs (keep last N log files)
    if [ -f "$LOG_FILE" ]; then
        # Archive current log with timestamp
        mv "$LOG_FILE" "$LOG_DIR/backup-cron_$(date +%Y%m%d_%H%M%S).log"

        # Prune old log files
        ls -t "$LOG_DIR"/backup-cron_*.log 2>/dev/null | tail -n +$((BACKUP_LOG_RETENTION + 1)) | xargs -r rm
    fi

    # Create new log file
    touch "$LOG_FILE"
}

# Log message with timestamp
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    log "WARN" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_success() {
    log "SUCCESS" "$@"
}

# ============================================================
# Notification Functions
# ============================================================

# Send notification (email and/or webhook)
send_notification() {
    local status="$1"  # SUCCESS or FAILURE
    local message="$2"
    local details="${3:-}"

    local subject="PostgreSQL Backup $status - $(hostname)"
    local body="$message"

    if [ -n "$details" ]; then
        body="$body

Details:
$details"
    fi

    # Add log excerpt to body
    if [ -f "$LOG_FILE" ]; then
        body="$body

Recent Log:
$(tail -n 20 "$LOG_FILE")"
    fi

    # Send email notification if configured
    if [ -n "$BACKUP_NOTIFY_EMAIL" ]; then
        if command -v mail >/dev/null 2>&1; then
            echo "$body" | mail -s "$subject" "$BACKUP_NOTIFY_EMAIL" 2>>"$LOG_FILE" || {
                log_warn "Failed to send email notification to $BACKUP_NOTIFY_EMAIL"
            }
        elif command -v sendmail >/dev/null 2>&1; then
            echo -e "Subject: $subject\n\n$body" | sendmail "$BACKUP_NOTIFY_EMAIL" 2>>"$LOG_FILE" || {
                log_warn "Failed to send email notification to $BACKUP_NOTIFY_EMAIL"
            }
        else
            log_warn "mail/sendmail not available, skipping email notification"
        fi
    fi

    # Send webhook notification if configured
    if [ -n "$BACKUP_NOTIFY_WEBHOOK" ]; then
        if command -v curl >/dev/null 2>&1; then
            local payload=$(cat <<EOF
{
  "status": "$status",
  "message": "$message",
  "hostname": "$(hostname)",
  "timestamp": "$(date -Iseconds)",
  "backup_file": "$BACKUP_FILE_GZ"
}
EOF
)
            curl -X POST "$BACKUP_NOTIFY_WEBHOOK" \
                -H "Content-Type: application/json" \
                -d "$payload" \
                --max-time 10 \
                --silent \
                --show-error \
                2>>"$LOG_FILE" || {
                log_warn "Failed to send webhook notification to $BACKUP_NOTIFY_WEBHOOK"
            }
        else
            log_warn "curl not available, skipping webhook notification"
        fi
    fi
}

# ============================================================
# Prerequisite Checks
# ============================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1 && ! command -v docker >/dev/null 2>&1; then
        log_error "docker-compose or docker not found in PATH"
        log_error "Please install Docker and Docker Compose"
        return 5
    fi

    # Check if backup directory exists, create if not
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR" || {
            log_error "Failed to create backup directory: $BACKUP_DIR"
            return 5
        }
    fi

    # Check if backup directory is writable
    if [ ! -w "$BACKUP_DIR" ]; then
        log_error "Backup directory is not writable: $BACKUP_DIR"
        return 5
    fi

    # Check available disk space (warn if < 1GB)
    local available_space=$(df -k "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    local space_gb=$((available_space / 1024 / 1024))
    if [ "$available_space" -lt 1048576 ]; then  # 1GB in KB
        log_warn "Low disk space: ${space_gb}GB available in $BACKUP_DIR"
    else
        log_info "Disk space available: ${space_gb}GB"
    fi

    log_info "Prerequisites check passed"
    return 0
}

# ============================================================
# Backup Functions
# ============================================================

check_postgres_running() {
    log_info "Checking if PostgreSQL container is running..."

    # Try docker-compose first
    if command -v docker-compose >/dev/null 2>&1; then
        if docker-compose ps "$POSTGRES_CONTAINER" 2>>"$LOG_FILE" | grep -q "Up"; then
            log_info "PostgreSQL container is running (docker-compose)"
            return 0
        fi
    fi

    # Try docker compose (v2)
    if command -v docker >/dev/null 2>&1; then
        if docker compose ps "$POSTGRES_CONTAINER" 2>>"$LOG_FILE" | grep -q "Up"; then
            log_info "PostgreSQL container is running (docker compose)"
            return 0
        fi

        # Try docker ps as fallback
        if docker ps --filter "name=$POSTGRES_CONTAINER" --filter "status=running" | grep -q "$POSTGRES_CONTAINER"; then
            log_info "PostgreSQL container is running (docker ps)"
            return 0
        fi
    fi

    log_error "PostgreSQL container '$POSTGRES_CONTAINER' is not running"
    return 1
}

create_backup() {
    log_info "Creating PostgreSQL backup..."
    log_info "Database: $POSTGRES_DB"
    log_info "User: $POSTGRES_USER"
    log_info "Backup file: $BACKUP_FILE"

    # Create backup using pg_dump
    local dump_cmd="pg_dump -U $POSTGRES_USER -d $POSTGRES_DB --no-owner --no-acl"

    # Try docker-compose first
    if command -v docker-compose >/dev/null 2>&1; then
        if docker-compose exec -T "$POSTGRES_CONTAINER" $dump_cmd > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
            log_info "Backup created successfully using docker-compose"
            return 0
        fi
    fi

    # Try docker compose (v2)
    if command -v docker >/dev/null 2>&1; then
        if docker compose exec -T "$POSTGRES_CONTAINER" $dump_cmd > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
            log_info "Backup created successfully using docker compose"
            return 0
        fi

        # Try docker exec as fallback
        if docker exec -i "$POSTGRES_CONTAINER" $dump_cmd > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
            log_info "Backup created successfully using docker exec"
            return 0
        fi
    fi

    log_error "Failed to create backup using any docker method"
    return 2
}

compress_backup() {
    log_info "Compressing backup..."

    if gzip "$BACKUP_FILE" 2>>"$LOG_FILE"; then
        log_info "Backup compressed successfully: $BACKUP_FILE_GZ"
        return 0
    else
        log_error "Failed to compress backup"
        return 3
    fi
}

verify_backup() {
    log_info "Verifying backup integrity..."

    # Check if backup file exists
    if [ ! -f "$BACKUP_FILE_GZ" ]; then
        log_error "Backup file not found: $BACKUP_FILE_GZ"
        return 4
    fi

    # Check backup file size
    local backup_size_kb=$(du -k "$BACKUP_FILE_GZ" | cut -f1)
    log_info "Backup size: ${backup_size_kb}KB"

    if [ "$backup_size_kb" -lt "$BACKUP_MIN_SIZE_KB" ]; then
        log_error "Backup file is too small (${backup_size_kb}KB < ${BACKUP_MIN_SIZE_KB}KB)"
        log_error "This likely indicates a backup failure"
        return 4
    fi

    # Verify gzip integrity
    if ! gzip -t "$BACKUP_FILE_GZ" 2>>"$LOG_FILE"; then
        log_error "Backup file is corrupted (gzip integrity check failed)"
        return 4
    fi

    log_success "Backup verification passed (${backup_size_kb}KB)"
    return 0
}

prune_old_backups() {
    log_info "Pruning old backups (keeping last $BACKUP_RETENTION)..."

    # Count current backups
    local backup_count=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
    log_info "Current backup count: $backup_count"

    if [ "$backup_count" -le "$BACKUP_RETENTION" ]; then
        log_info "No backups to prune (count: $backup_count, retention: $BACKUP_RETENTION)"
        return 0
    fi

    # Delete old backups
    local deleted_count=0
    ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -n +$((BACKUP_RETENTION + 1)) | while read -r old_backup; do
        log_info "Deleting old backup: $(basename "$old_backup")"
        rm "$old_backup" || log_warn "Failed to delete: $old_backup"
        deleted_count=$((deleted_count + 1))
    done

    log_info "Pruned $deleted_count old backup(s)"
    return 0
}

# ============================================================
# Main Execution
# ============================================================

main() {
    local exit_code=0

    # Initialize logging
    init_logging

    log_info "========================================="
    log_info "PostgreSQL Backup Started"
    log_info "========================================="
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    log_info "Hostname: $(hostname)"
    log_info "Project directory: $PROJECT_DIR"
    log_info "Backup directory: $BACKUP_DIR"
    log_info "Retention: $BACKUP_RETENTION backups"

    # Check prerequisites
    if ! check_prerequisites; then
        exit_code=$?
        log_error "Prerequisite check failed"
        send_notification "FAILURE" "Backup failed: Prerequisite check failed" "Exit code: $exit_code"
        return $exit_code
    fi

    # Check if PostgreSQL is running
    if ! check_postgres_running; then
        exit_code=1
        log_warn "PostgreSQL container not running, skipping backup"
        # Don't send notification for this - container might be intentionally stopped
        return $exit_code
    fi

    # Create backup
    if ! create_backup; then
        exit_code=2
        log_error "Backup creation failed"
        send_notification "FAILURE" "Backup creation failed" "Exit code: $exit_code"

        # Clean up partial backup file
        [ -f "$BACKUP_FILE" ] && rm "$BACKUP_FILE"

        return $exit_code
    fi

    # Compress backup
    if ! compress_backup; then
        exit_code=3
        log_error "Backup compression failed"
        send_notification "FAILURE" "Backup compression failed" "Exit code: $exit_code"

        # Clean up uncompressed backup file
        [ -f "$BACKUP_FILE" ] && rm "$BACKUP_FILE"

        return $exit_code
    fi

    # Verify backup
    if ! verify_backup; then
        exit_code=4
        log_error "Backup verification failed"
        send_notification "FAILURE" "Backup verification failed" "Exit code: $exit_code"

        # Keep the failed backup for investigation
        log_warn "Failed backup kept for investigation: $BACKUP_FILE_GZ"

        return $exit_code
    fi

    # Prune old backups
    prune_old_backups

    # Success!
    log_success "========================================="
    log_success "Backup completed successfully!"
    log_success "========================================="
    log_success "Backup file: $BACKUP_FILE_GZ"
    log_success "Backup size: $(du -h "$BACKUP_FILE_GZ" | cut -f1)"

    # List current backups
    log_info "Current backups:"
    ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -n "$BACKUP_RETENTION" | while read -r line; do
        log_info "  $line"
    done

    # Send success notification (only if configured)
    if [ -n "$BACKUP_NOTIFY_EMAIL" ] || [ -n "$BACKUP_NOTIFY_WEBHOOK" ]; then
        send_notification "SUCCESS" "Backup completed successfully" "Backup file: $BACKUP_FILE_GZ
Size: $(du -h "$BACKUP_FILE_GZ" | cut -f1)"
    fi

    return 0
}

# ============================================================
# Execute Main
# ============================================================

# Run main function and capture exit code
main
exit_code=$?

# Exit with captured code
exit $exit_code
