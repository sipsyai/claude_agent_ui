# PostgreSQL Restore Procedures

This document provides comprehensive instructions for restoring the PostgreSQL database in the Claude Agent UI from backups.

## Table of Contents

1. [Overview](#overview)
2. [Full Restore Procedures](#full-restore-procedures)
3. [Point-in-Time Recovery (PITR)](#point-in-time-recovery-pitr)
4. [Partial Restore Procedures](#partial-restore-procedures)
5. [Disaster Recovery](#disaster-recovery)
6. [Restore Verification](#restore-verification)
7. [Restore from Different Backup Formats](#restore-from-different-backup-formats)
8. [Production Restore Scenarios](#production-restore-scenarios)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Database restoration is a critical operation that returns your system to a previous state from a backup. This document covers all restore scenarios from simple full restores to complex point-in-time recovery.

### When to Restore

Restore from backup when:
- **Data Loss**: Accidental deletion or corruption of critical data
- **Disaster Recovery**: Complete system failure or data center incident
- **Migration Issues**: Failed migration that requires rollback
- **Testing**: Creating a test environment from production data
- **Audit/Investigation**: Reviewing historical data state
- **Development**: Refreshing staging/development databases

### Restore Prerequisites

Before any restore operation:

```bash
# 1. Verify backup file exists and is not corrupted
ls -lh ./database/backups/
gzip -t ./database/backups/backup_*.sql.gz

# 2. Ensure sufficient disk space (2-3x backup file size)
df -h

# 3. Verify PostgreSQL container is running
docker-compose ps postgres

# 4. Create a current backup before destructive operations
bash ./scripts/backup-postgres.sh
```

**⚠️ WARNING**: Restore operations are destructive. Always verify you have the correct backup and a current backup before proceeding.

---

## Full Restore Procedures

### Full Restore from Compressed SQL Backup

The most common restore scenario - replace entire database with backup:

#### Step 1: Prepare for Restore

```bash
# Stop application services to prevent connections
docker-compose stop backend frontend

# Create a safety backup of current state (if database has data)
bash ./scripts/backup-postgres.sh

# Verify backup file integrity
gzip -t ./database/backups/backup_20260102_143022.sql.gz
```

#### Step 2: Drop Existing Database

```bash
# Terminate all connections to the database
docker-compose exec postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'claude_agent_ui' AND pid <> pg_backend_pid();"

# Drop the existing database
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE IF EXISTS claude_agent_ui;"

# Recreate empty database
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui OWNER postgres;"
```

#### Step 3: Restore from Backup

```bash
# Restore from compressed backup
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# If restore succeeds, you should see:
# SET
# SET
# CREATE TABLE
# ...
# COPY 42  (indicating 42 rows copied)
# ...
```

#### Step 4: Verify Restore

```bash
# Check table counts
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt"

# Verify data integrity
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT
    (SELECT COUNT(*) FROM agents) as agents,
    (SELECT COUNT(*) FROM skills) as skills,
    (SELECT COUNT(*) FROM mcp_servers) as mcp_servers,
    (SELECT COUNT(*) FROM tasks) as tasks;"

# Check database size
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT pg_size_pretty(pg_database_size('claude_agent_ui'));"
```

#### Step 5: Restart Services

```bash
# Start application services
docker-compose up -d backend frontend

# Verify application health
curl http://localhost:1337/_health
curl http://localhost:3001/health

# Check application logs
docker-compose logs -f backend
```

### Full Restore (One-Line Command)

For quick restores when you know what you're doing:

```bash
# ⚠️ DESTRUCTIVE - This will replace all data!
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# For clean restore (includes DROP statements)
gunzip -c ./database/backups/backup_clean_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

### Full Restore with Transaction Wrapper

Safer restore that can be rolled back on error:

```bash
# Restore within a transaction
(echo "BEGIN;" && \
 gunzip -c ./database/backups/backup_20260102_143022.sql.gz && \
 echo "COMMIT;") | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# If any error occurs, the transaction will rollback automatically
```

---

## Point-in-Time Recovery (PITR)

Point-in-Time Recovery allows restoring the database to any specific moment in time using base backups and Write-Ahead Logs (WAL).

### Prerequisites for PITR

WAL archiving must be enabled **before** the incident:

```yaml
# docker-compose.yml configuration
postgres:
  command: >
    postgres
    -c wal_level=replica
    -c archive_mode=on
    -c archive_command='test ! -f /backups/wal/%f && cp %p /backups/wal/%f'
    -c archive_timeout=60
  volumes:
    - ./database/backups/wal:/backups/wal
```

### PITR Restore Procedure

#### Step 1: Identify Target Time

Determine the exact time to recover to:

```bash
# Example: Restore to just before data was deleted
TARGET_TIME="2026-01-02 14:30:00"

# Or use transaction ID if known
# TARGET_XID="12345"
```

#### Step 2: Prepare Recovery Directory

```bash
# Stop PostgreSQL
docker-compose stop postgres

# Backup current data directory
docker run --rm \
  -v claude_agent_ui_postgres_data:/data \
  -v $(pwd)/database/backups:/backup \
  alpine tar czf /backup/pre_pitr_backup_$(date +%Y%m%d_%H%M%S).tar.gz /data

# Remove current data
docker volume rm claude_agent_ui_postgres_data
docker volume create claude_agent_ui_postgres_data
```

#### Step 3: Restore Base Backup

```bash
# Extract base backup to data directory
docker run --rm \
  -v claude_agent_ui_postgres_data:/data \
  -v $(pwd)/database/backups/base:/backups/base \
  postgres:16-alpine \
  bash -c "cd /data && tar xzf /backups/base/base_20260102_120000.tar.gz"
```

#### Step 4: Configure Recovery

```bash
# Create recovery configuration
cat > ./database/recovery.conf << EOF
restore_command = 'cp /backups/wal/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF

# Copy recovery config to data directory
docker run --rm \
  -v claude_agent_ui_postgres_data:/data \
  -v $(pwd)/database:/config \
  alpine cp /config/recovery.conf /data/postgresql.auto.conf
```

#### Step 5: Start PostgreSQL in Recovery Mode

```bash
# Start PostgreSQL - it will enter recovery mode
docker-compose up -d postgres

# Monitor recovery progress
docker-compose logs -f postgres | grep recovery

# Recovery complete when you see:
# "database system is ready to accept connections"
```

#### Step 6: Verify Recovered State

```bash
# Check recovery target was reached
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT pg_last_xact_replay_timestamp();"

# Verify data integrity at target time
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT COUNT(*) FROM agents;"

# Check for expected data
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT name, created_at FROM agents ORDER BY created_at DESC LIMIT 5;"
```

### PITR Using pg_basebackup

Alternative PITR method using physical backups:

```bash
# Create base backup with WAL
docker-compose exec postgres pg_basebackup \
  -U postgres \
  -D /backups/base/$(date +%Y%m%d_%H%M%S) \
  -Ft -z -Xs -P

# Restore follows same procedure as above
```

### PITR Recovery Targets

Different recovery target options:

```bash
# Recover to specific timestamp
recovery_target_time = '2026-01-02 14:30:00'

# Recover to transaction ID
recovery_target_xid = '12345'

# Recover to named restore point
recovery_target_name = 'before_migration'

# Recover to just before specific transaction
recovery_target_xid = '12345'
recovery_target_inclusive = 'false'

# Recover to latest available point
recovery_target = 'immediate'
```

---

## Partial Restore Procedures

### Restore Single Table

Restore only specific tables without affecting the rest of the database:

#### Method 1: Using pg_restore (Custom Format)

```bash
# List tables in custom format backup
docker-compose exec postgres pg_restore --list \
  /backups/backup_20260102_143022.dump | grep "TABLE DATA"

# Restore only the 'agents' table
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --table=agents \
  --data-only \
  /backups/backup_20260102_143022.dump
```

#### Method 2: Extract Table from SQL Backup

```bash
# Extract specific table from SQL backup
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  sed -n '/CREATE TABLE agents/,/CREATE TABLE [^a]/p' > agents_table.sql

# Truncate existing table (optional)
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "TRUNCATE TABLE agents CASCADE;"

# Restore extracted table
docker-compose exec -T postgres psql -U postgres -d claude_agent_ui < agents_table.sql
```

#### Method 3: Copy Table Data Only

```bash
# Extract COPY statements for specific table
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  grep -A 10000 "COPY public.agents" | \
  grep -B 1 -m 1 "\\\\." > agents_data.sql

# Clear existing data
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "TRUNCATE TABLE agents CASCADE;"

# Restore data
docker-compose exec -T postgres psql -U postgres -d claude_agent_ui < agents_data.sql
```

### Restore Specific Schema

```bash
# Restore only schema (no data)
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --schema-only \
  /backups/backup_20260102_143022.dump

# Restore schema for specific tables
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  grep -E "CREATE TABLE|CREATE INDEX|CREATE SEQUENCE" | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

### Restore Specific Rows

```bash
# Export specific rows to CSV
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "COPY (SELECT * FROM agents WHERE created_at < '2026-01-02') TO STDOUT WITH CSV HEADER" \
  > agents_subset.csv

# Import specific rows
docker-compose exec -T postgres psql -U postgres -d claude_agent_ui -c \
  "\COPY agents FROM STDIN WITH CSV HEADER" < agents_subset.csv
```

---

## Disaster Recovery

Complete disaster recovery scenarios and procedures.

### Scenario 1: Complete Data Center Loss

**Situation**: Primary data center is completely unavailable.

#### Recovery Steps

```bash
# 1. Provision new infrastructure
# - New servers/containers
# - Install Docker and docker-compose
# - Clone application repository

# 2. Retrieve backups from off-site location
aws s3 sync s3://your-bucket/postgres-backups/ ./database/backups/
# Or from backup service:
# rsync -avz backup-server:/backups/ ./database/backups/

# 3. Start PostgreSQL
docker-compose up -d postgres

# 4. Create database
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui OWNER postgres;"

# 5. Restore latest backup
LATEST_BACKUP=$(ls -t ./database/backups/backup_*.sql.gz | head -n1)
gunzip -c "$LATEST_BACKUP" | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# 6. Verify restore
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt"

# 7. Start application
docker-compose up -d

# 8. Verify application health
curl http://localhost:1337/_health
```

**Recovery Time Objective (RTO)**: 1-2 hours
**Recovery Point Objective (RPO)**: Last backup (24 hours with daily backups)

### Scenario 2: Database Corruption

**Situation**: Database files corrupted but infrastructure intact.

```bash
# 1. Identify corruption
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT * FROM agents LIMIT 1;"
# ERROR:  invalid page in block 42 of relation base/16384/16385

# 2. Create backup of corrupted database (for forensics)
bash ./scripts/backup-postgres.sh

# 3. Stop services
docker-compose stop backend frontend

# 4. Drop corrupted database
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE claude_agent_ui;"

# 5. Recreate database
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui OWNER postgres;"

# 6. Restore from last known good backup
gunzip -c ./database/backups/backup_GOOD.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# 7. Restart services
docker-compose up -d
```

### Scenario 3: Accidental Data Deletion

**Situation**: Critical data accidentally deleted but database intact.

#### Option A: Restore Deleted Table Only

```bash
# 1. Identify what was deleted
# Example: All skills were accidentally deleted

# 2. Extract skills table from backup
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  sed -n '/COPY public.skills/,/\\\./p' > skills_restore.sql

# 3. Restore skills table
docker-compose exec -T postgres psql -U postgres -d claude_agent_ui < skills_restore.sql
```

#### Option B: Full Database Restore (if recent backup available)

```bash
# If deletion just happened and you have a backup from before deletion
bash ./scripts/backup-postgres.sh  # Backup current state (optional)

# Restore from pre-deletion backup
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

#### Option C: Point-in-Time Recovery (if WAL enabled)

```bash
# Restore to 5 minutes before deletion
# See Point-in-Time Recovery section above
```

### Scenario 4: Failed Migration

**Situation**: Database migration failed, need to rollback.

```bash
# Use the migration rollback procedures
npm run test:rollback

# Or manually restore pre-migration backup
gunzip -c ./database/backups/backup_pre_migration.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# See POSTGRES_ROLLBACK_PROCEDURES.md for detailed migration rollback steps
```

### Scenario 5: Ransomware Attack

**Situation**: Database encrypted by ransomware.

```bash
# 1. Isolate the system
docker-compose down  # Stop all services
# Disconnect from network if needed

# 2. Provision clean infrastructure
# - New VM/container environment
# - Fresh OS installation
# - Latest security patches

# 3. Restore from off-site backup
# Use backups from BEFORE the attack
# Check backup dates carefully

# 4. Scan restored data for malware
# Run security scans before going live

# 5. Implement additional security measures
# - Update passwords
# - Enable encryption at rest
# - Implement backup encryption
# - Add intrusion detection
```

---

## Restore Verification

After any restore operation, verify data integrity and application functionality.

### Database Verification

```bash
# 1. Check all tables exist
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt"

# Expected output:
#  public | agents        | table | postgres
#  public | skills        | table | postgres
#  public | mcp_servers   | table | postgres
#  public | tasks         | table | postgres
#  ...

# 2. Verify row counts
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "
SELECT
  'agents' as table, COUNT(*) as rows FROM agents
UNION ALL
SELECT 'skills', COUNT(*) FROM skills
UNION ALL
SELECT 'mcp_servers', COUNT(*) FROM mcp_servers
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks;
"

# 3. Check database size
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT pg_size_pretty(pg_database_size('claude_agent_ui'));"

# 4. Verify indexes exist
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public';"

# 5. Check for errors in PostgreSQL logs
docker-compose logs postgres | grep -i error
```

### Application Verification

```bash
# 1. Health check endpoints
curl http://localhost:1337/_health
curl http://localhost:3001/health

# Expected: {"status":"ok", "database":{"connected":true}}

# 2. Test API endpoints
curl http://localhost:1337/api/agents
curl http://localhost:1337/api/skills
curl http://localhost:1337/api/mcp-servers

# 3. Test CRUD operations
# Create test agent
curl -X POST http://localhost:1337/api/agents \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"Test Agent","description":"Restore test"}}'

# Read test agent
curl http://localhost:1337/api/agents

# Delete test agent
curl -X DELETE http://localhost:1337/api/agents/1

# 4. Verify application logs
docker-compose logs backend | grep -i error
docker-compose logs frontend | grep -i error
```

### Data Integrity Verification

```bash
# 1. Run data integrity checks
npm run validate-migration  # If migration validation script exists

# 2. Check foreign key constraints
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f';
"

# 3. Verify sequences are correct
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "
SELECT schemaname, sequencename, last_value
FROM pg_sequences
WHERE schemaname = 'public';
"

# 4. Check for NULL values in required fields
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "
SELECT COUNT(*) FROM agents WHERE name IS NULL;
SELECT COUNT(*) FROM skills WHERE name IS NULL;
"
```

### Automated Verification Script

Create a verification script for consistent checks:

```bash
#!/bin/bash
# scripts/verify-restore.sh

echo "🔍 Verifying PostgreSQL Restore..."

# 1. Database connectivity
if ! docker-compose exec postgres psql -U postgres -d claude_agent_ui -c '\q' 2>/dev/null; then
  echo "❌ Cannot connect to database"
  exit 1
fi
echo "✅ Database connected"

# 2. Table existence
EXPECTED_TABLES=("agents" "skills" "mcp_servers" "tasks" "chat_sessions" "chat_messages" "mcp_tools")
for table in "${EXPECTED_TABLES[@]}"; do
  if ! docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt $table" | grep -q "$table"; then
    echo "❌ Table $table not found"
    exit 1
  fi
done
echo "✅ All tables exist"

# 3. Row count verification
ROW_COUNT=$(docker-compose exec postgres psql -U postgres -d claude_agent_ui -t -c "
  SELECT SUM(rows) FROM (
    SELECT COUNT(*) as rows FROM agents
    UNION ALL SELECT COUNT(*) FROM skills
    UNION ALL SELECT COUNT(*) FROM mcp_servers
  ) counts;
")
if [ "$ROW_COUNT" -lt 1 ]; then
  echo "⚠️  Warning: Database appears empty"
fi
echo "✅ Total rows: $ROW_COUNT"

# 4. Health check
if curl -sf http://localhost:1337/_health > /dev/null; then
  echo "✅ Application health check passed"
else
  echo "❌ Application health check failed"
  exit 1
fi

echo "✅ Restore verification completed successfully"
```

---

## Restore from Different Backup Formats

### Restore from SQL Format (Most Common)

```bash
# Plain SQL (uncompressed)
docker-compose exec -T postgres psql -U postgres -d claude_agent_ui < backup.sql

# Compressed SQL (gzip)
gunzip -c backup.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Compressed SQL (bzip2)
bunzip2 -c backup.sql.bz2 | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

### Restore from Custom Format

```bash
# Custom format (created with pg_dump -Fc)
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --clean \
  --if-exists \
  /backups/backup.dump

# Custom format with verbose output
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --verbose \
  /backups/backup.dump

# Custom format with parallel restore (faster)
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --jobs=4 \
  /backups/backup.dump
```

### Restore from Directory Format

```bash
# Directory format (created with pg_dump -Fd)
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --format=directory \
  /backups/backup_dir/

# Directory format with parallel restore
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --format=directory \
  --jobs=4 \
  /backups/backup_dir/
```

### Restore from Tar Format

```bash
# Tar format (created with pg_dump -Ft)
docker-compose exec postgres pg_restore \
  -U postgres \
  -d claude_agent_ui \
  --format=tar \
  /backups/backup.tar
```

### Restore from Volume Backup

```bash
# Stop PostgreSQL
docker-compose stop postgres

# Restore volume from tar.gz
docker run --rm \
  -v claude_agent_ui_postgres_data:/data \
  -v $(pwd)/database/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/postgres_volume_20260102_143022.tar.gz --strip-components=1"

# Start PostgreSQL
docker-compose up -d postgres

# Verify restoration
docker-compose logs postgres
```

---

## Production Restore Scenarios

### Blue-Green Deployment Restore

Restore to a parallel environment before switching traffic:

```bash
# 1. Create new PostgreSQL container (green)
docker run -d \
  --name claude-postgres-green \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=claude_agent_ui \
  -p 5433:5432 \
  postgres:16-alpine

# 2. Restore backup to green database
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker exec -i claude-postgres-green psql -U postgres -d claude_agent_ui

# 3. Verify green database
docker exec claude-postgres-green psql -U postgres -d claude_agent_ui -c "\dt"

# 4. Update application to point to green database
# Update DATABASE_HOST=claude-postgres-green in .env

# 5. Switch traffic to green
docker-compose restart backend

# 6. Verify application works with green database
curl http://localhost:1337/_health

# 7. If successful, decommission blue database
docker stop claude-postgres
docker rm claude-postgres

# 8. Rename green to primary
docker rename claude-postgres-green claude-postgres
```

### Hot Standby Restore

Restore to a standby database for testing before production:

```bash
# 1. Create standby database
docker-compose -f docker-compose.standby.yml up -d

# 2. Restore to standby
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker-compose -f docker-compose.standby.yml exec -T postgres \
  psql -U postgres -d claude_agent_ui

# 3. Test against standby
# Point test application to standby database

# 4. If tests pass, restore to production
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

### Incremental Restore Testing

Test restore without full replacement:

```bash
# 1. Create temporary test database
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui_test OWNER postgres;"

# 2. Restore to test database
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui_test

# 3. Verify test database
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test -c "\dt"

# 4. Compare with production
docker-compose exec postgres psql -U postgres -c "
SELECT
  'production' as env, COUNT(*) as agent_count
FROM claude_agent_ui.public.agents
UNION ALL
SELECT
  'test' as env, COUNT(*)
FROM claude_agent_ui_test.public.agents;
"

# 5. Drop test database when done
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE claude_agent_ui_test;"
```

---

## Best Practices

### 1. Test Restores Regularly

**Never assume backups work - verify them!**

```bash
# Monthly: Test restore in non-production environment
# 1. Create test database
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE restore_test OWNER postgres;"

# 2. Restore latest backup
LATEST_BACKUP=$(ls -t ./database/backups/backup_*.sql.gz | head -n1)
gunzip -c "$LATEST_BACKUP" | \
  docker-compose exec -T postgres psql -U postgres -d restore_test

# 3. Verify data integrity
docker-compose exec postgres psql -U postgres -d restore_test -c "\dt"

# 4. Clean up
docker-compose exec postgres psql -U postgres -c "DROP DATABASE restore_test;"

# Document results:
echo "$(date): Restore test successful from $LATEST_BACKUP" >> ./logs/restore-tests.log
```

### 2. Document Restore Times

Track how long restores take for RTO planning:

```bash
# Time your restore operations
time gunzip -c backup.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Document in restore log:
# Database size: 500 MB
# Restore time: 45 seconds
# Date: 2026-01-02
```

### 3. Maintain Restore Runbook

Create detailed runbooks for common scenarios:

```markdown
# Restore Runbook - Accidental Data Deletion

## Detection
- User reports missing data
- Monitoring alerts on row count drop

## Immediate Actions
1. Stop application writes: `docker-compose stop backend`
2. Create safety backup: `bash ./scripts/backup-postgres.sh`
3. Identify deletion time: Check application logs

## Restoration
1. Find pre-deletion backup: `ls -lt ./database/backups/`
2. Restore specific table: See "Partial Restore" section
3. Verify data: Check row counts
4. Restart application: `docker-compose up -d backend`

## Verification
- Confirm data is restored
- Test application functionality
- Monitor for issues

## Post-Incident
- Document in incident log
- Update monitoring thresholds
- Review deletion protection
```

### 4. Use Transactions for Safety

```bash
# Wrap restore in transaction for rollback capability
(echo "BEGIN;" && \
 gunzip -c backup.sql.gz && \
 echo "COMMIT;") | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# On error, changes will rollback automatically
```

### 5. Validate Before Production Restore

```bash
# Always restore to test database first
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE restore_validation OWNER postgres;"

gunzip -c backup.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d restore_validation

# Run validation queries
docker-compose exec postgres psql -U postgres -d restore_validation -c \
  "SELECT COUNT(*) FROM agents WHERE name IS NULL;"  # Should be 0

# If validation passes, restore to production
# If validation fails, investigate backup integrity
```

### 6. Maintain Chain of Custody

```bash
# Document who, what, when for audit trail
cat > ./logs/restore-log-$(date +%Y%m%d_%H%M%S).md << EOF
# Restore Operation Log

**Date**: $(date)
**Operator**: $USER
**Reason**: Production data corruption
**Backup File**: backup_20260102_143022.sql.gz
**Backup Date**: 2026-01-02 14:30:22
**Database**: claude_agent_ui
**Restore Method**: Full restore

## Steps Taken
1. Created safety backup
2. Verified backup integrity
3. Restored from backup
4. Verified data integrity
5. Restarted application

## Verification Results
- All tables present: ✅
- Row counts match: ✅
- Application health: ✅
- No errors in logs: ✅

## Sign-off
Restore completed successfully at $(date)
EOF
```

### 7. Automate Common Restore Tasks

```bash
# Create restore helper script
cat > ./scripts/restore-postgres.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  echo "Example: $0 ./database/backups/backup_20260102_143022.sql.gz"
  exit 1
fi

echo "🔄 Starting restore from $BACKUP_FILE"

# Verify backup exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Verify backup integrity
echo "🔍 Verifying backup integrity..."
gzip -t "$BACKUP_FILE"

# Create safety backup
echo "💾 Creating safety backup..."
bash ./scripts/backup-postgres.sh

# Stop services
echo "⏸️  Stopping services..."
docker-compose stop backend frontend

# Restore
echo "📥 Restoring database..."
gunzip -c "$BACKUP_FILE" | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Verify
echo "✅ Verifying restore..."
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt" > /dev/null

# Restart services
echo "▶️  Restarting services..."
docker-compose up -d

echo "✅ Restore completed successfully"
EOF

chmod +x ./scripts/restore-postgres.sh
```

### 8. Set Proper Permissions

```bash
# Restrict access to restore scripts
chmod 700 ./scripts/restore-postgres.sh

# Secure backup files
chmod 600 ./database/backups/*.sql.gz
```

### 9. Monitor Restore Progress

```bash
# For large databases, monitor restore progress
gunzip -c backup.sql.gz | pv | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Output: 450MiB 0:00:45 [10.0MiB/s] [==>  ] 45% ETA 0:00:55
```

### 10. Prepare for Worst-Case Scenarios

```bash
# Keep emergency restore instructions accessible
# - Print physical copy
# - Store in wiki/docs
# - Include in on-call runbook

# Test restore from off-site backups quarterly
aws s3 sync s3://your-bucket/postgres-backups/ ./test-restore/
# ... perform restore test ...
rm -rf ./test-restore/
```

---

## Troubleshooting

### Issue: "database already exists" Error

**Symptoms**:
```
ERROR:  database "claude_agent_ui" already exists
```

**Solution**:
```bash
# Option 1: Drop existing database first
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE claude_agent_ui;"

docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui OWNER postgres;"

# Option 2: Use backup with --clean flag
gunzip -c backup_clean.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

### Issue: "relation already exists" Error

**Symptoms**:
```
ERROR:  relation "agents" already exists
```

**Solution**:
```bash
# Use backup created with --clean flag
docker-compose exec -T postgres pg_dump \
  -U postgres claude_agent_ui \
  --clean --if-exists > backup_clean.sql

# Or drop schema before restore
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### Issue: Restore Hangs or Takes Too Long

**Symptoms**:
```
# Restore running for hours on small database
```

**Solution**:
```bash
# Check for blocking queries
docker-compose exec postgres psql -U postgres -c \
  "SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';"

# Kill blocking queries
docker-compose exec postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE datname = 'claude_agent_ui' AND state != 'idle';"

# Use custom format with parallel restore
docker-compose exec postgres pg_restore \
  -U postgres -d claude_agent_ui \
  --jobs=4 \
  /backups/backup.dump
```

### Issue: "out of memory" During Restore

**Symptoms**:
```
ERROR:  out of memory
DETAIL:  Failed on request of size 32
```

**Solution**:
```bash
# Increase PostgreSQL memory settings
docker-compose exec postgres psql -U postgres -c \
  "ALTER SYSTEM SET maintenance_work_mem = '1GB';"

docker-compose restart postgres

# Or restore in smaller chunks
gunzip -c backup.sql.gz | split -l 100000 - chunk_
for chunk in chunk_*; do
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui < $chunk
done
```

### Issue: Foreign Key Constraint Violations

**Symptoms**:
```
ERROR:  insert or update on table "tasks" violates foreign key constraint
```

**Solution**:
```bash
# Disable foreign key checks during restore
(echo "SET session_replication_role = 'replica';" && \
 gunzip -c backup.sql.gz && \
 echo "SET session_replication_role = 'origin';") | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Or restore with --disable-triggers
docker-compose exec postgres pg_restore \
  -U postgres -d claude_agent_ui \
  --disable-triggers \
  /backups/backup.dump
```

### Issue: Backup File Corrupted

**Symptoms**:
```bash
gzip -t backup.sql.gz
# gzip: backup.sql.gz: invalid compressed data--crc error
```

**Solution**:
```bash
# Try to recover partial data
gzip -dc backup.sql.gz > recovered.sql 2>/dev/null

# Use previous backup
ls -lt ./database/backups/
gunzip -c ./database/backups/backup_PREVIOUS.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Restore from off-site backup
aws s3 cp s3://your-bucket/postgres-backups/backup_20260102_143022.sql.gz ./
```

### Issue: Insufficient Disk Space

**Symptoms**:
```
ERROR:  could not write to file: No space left on device
```

**Solution**:
```bash
# Check disk space
df -h

# Clean old backups
rm ./database/backups/backup_2025*.sql.gz

# Clean Docker volumes
docker system prune -a --volumes

# Use pg_restore with --clean to avoid doubling space
docker-compose exec postgres pg_restore \
  -U postgres -d claude_agent_ui \
  --clean \
  /backups/backup.dump
```

### Issue: Character Encoding Mismatch

**Symptoms**:
```
ERROR:  character with byte sequence 0xe2 0x80 0x99 in encoding "UTF8" has no equivalent in encoding "LATIN1"
```

**Solution**:
```bash
# Set encoding during restore
PGOPTIONS='--client-encoding=UTF8' gunzip -c backup.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Or recreate database with correct encoding
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE claude_agent_ui;"

docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui OWNER postgres ENCODING 'UTF8';"
```

### Issue: Permission Denied Errors

**Symptoms**:
```
ERROR:  permission denied for table agents
```

**Solution**:
```bash
# Restore as superuser
gunzip -c backup.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Grant permissions after restore
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;"
```

### Issue: Sequence Values Out of Sync

**Symptoms**:
```
ERROR:  duplicate key value violates unique constraint "agents_pkey"
DETAIL:  Key (id)=(5) already exists.
```

**Solution**:
```bash
# Fix sequence values
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "
SELECT setval('agents_id_seq', (SELECT MAX(id) FROM agents));
SELECT setval('skills_id_seq', (SELECT MAX(id) FROM skills));
SELECT setval('mcp_servers_id_seq', (SELECT MAX(id) FROM mcp_servers));
SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));
"
```

### Issue: Restore Works But Application Fails

**Symptoms**:
```
Database restored successfully but application shows errors
```

**Solution**:
```bash
# Check Strapi schema matches database
npm run strapi schema:diff

# Rebuild Strapi
cd backend
npm run build

# Check migrations
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT * FROM strapi_migrations ORDER BY id DESC LIMIT 5;"

# Verify environment variables
docker-compose exec backend env | grep DATABASE

# Check application logs
docker-compose logs backend | tail -50
```

---

## Related Documentation

- 📖 [PostgreSQL Backup Procedures](./BACKUP_PROCEDURES.md) - Backup procedures and scheduling
- 📖 [Cron Backup Setup Guide](./CRON_BACKUP_SETUP.md) - Production automated backup setup
- 📖 [PostgreSQL Rollback Procedures](./POSTGRES_ROLLBACK_PROCEDURES.md) - Migration rollback procedures
- 📖 [Health Check Endpoints](./HEALTH_CHECK_ENDPOINTS.md) - Database health monitoring
- 📖 [Connection Pool Verification](./CONNECTION_POOL_VERIFICATION.md) - Pool configuration details

---

## Acceptance Criteria

This document fulfills the acceptance criteria for subtask 5.2:

- ✅ **Full restore procedure documented**: See [Full Restore Procedures](#full-restore-procedures)
- ✅ **Point-in-time recovery explained**: See [Point-in-Time Recovery (PITR)](#point-in-time-recovery-pitr)
- ✅ **Disaster recovery steps included**: See [Disaster Recovery](#disaster-recovery)

---

## Quick Reference

### Most Common Restore Commands

```bash
# Full restore from compressed backup
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Restore with clean/drop statements
gunzip -c ./database/backups/backup_clean_20260102_143022.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Restore single table
gunzip -c backup.sql.gz | \
  sed -n '/COPY public.agents/,/\\\./p' | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Verify restore
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt"

# Test backup integrity before restore
gzip -t ./database/backups/backup_*.sql.gz

# Create safety backup before restore
bash ./scripts/backup-postgres.sh
```

### Emergency Restore Checklist

```markdown
- [ ] Identify correct backup file
- [ ] Verify backup integrity (gzip -t)
- [ ] Create safety backup of current state
- [ ] Stop application services
- [ ] Terminate database connections
- [ ] Drop/recreate database (if needed)
- [ ] Restore from backup
- [ ] Verify table existence
- [ ] Check row counts
- [ ] Verify foreign keys
- [ ] Test application connectivity
- [ ] Restart services
- [ ] Run health checks
- [ ] Monitor application logs
- [ ] Document restore operation
```

---

## Support

If you encounter issues with restore procedures:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Verify backup integrity: `gzip -t backup.sql.gz`
3. Check PostgreSQL logs: `docker-compose logs postgres`
4. Verify disk space: `df -h`
5. Review backup file: `gunzip -c backup.sql.gz | head -50`
6. Consult the [PostgreSQL restore documentation](https://www.postgresql.org/docs/current/backup-dump.html#BACKUP-DUMP-RESTORE)

For backup procedures, see [BACKUP_PROCEDURES.md](./BACKUP_PROCEDURES.md).

For migration rollback, see [POSTGRES_ROLLBACK_PROCEDURES.md](./POSTGRES_ROLLBACK_PROCEDURES.md).

---

**Last Updated**: 2026-01-02
**Version**: 1.0.0
**Maintainer**: Claude Agent UI Team
