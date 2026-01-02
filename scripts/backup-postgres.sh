#!/bin/bash
# ============================================================
# Claude Agent UI - PostgreSQL Backup Script
# Creates timestamped backup of PostgreSQL database
# ============================================================

set -e

# Load environment variables
if [ -f .env ]; then
    source .env
fi

BACKUP_DIR="./database/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

echo "📦 Creating PostgreSQL backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if PostgreSQL container is running
if docker-compose ps postgres | grep -q "Up"; then
    # Create backup
    docker-compose exec -T postgres pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-claude_agent_ui} > "$BACKUP_FILE"

    # Compress backup
    gzip "$BACKUP_FILE"

    echo "✅ Backup created: ${BACKUP_FILE}.gz"

    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +8 | xargs -r rm
    echo "📂 Kept last 7 backups"
else
    echo "⚠️  PostgreSQL container not running, skipping backup"
fi
