# Manual Backup & Restore Test Procedure

This is a simplified, step-by-step guide for manually testing backup and restore procedures. Follow these steps to verify the procedures work.

## Prerequisites

Before you begin, ensure:
- [ ] Docker and Docker Compose are installed
- [ ] PostgreSQL container is running (`docker-compose up -d postgres`)
- [ ] You have terminal access
- [ ] At least 1GB free disk space

## Step-by-Step Test Procedure

### Step 1: Create a Backup

```bash
# Navigate to project directory
cd /path/to/claude_agent_ui

# Run the backup script
bash ./scripts/backup-postgres.sh
```

**Expected Output**:
```
📦 Creating PostgreSQL backup...
✅ Backup created: ./database/backups/backup_20260102_143022.sql.gz
📂 Kept last 7 backups
```

**Verification**:
```bash
# List backups
ls -lh ./database/backups/

# Check the most recent backup
LATEST_BACKUP=$(ls -t ./database/backups/backup_*.sql.gz | head -n1)
echo "Latest backup: $LATEST_BACKUP"

# Verify gzip integrity
gzip -t "$LATEST_BACKUP" && echo "✅ Backup file is valid" || echo "❌ Backup file is corrupted"
```

---

### Step 2: Capture Current Database State

```bash
# Count tables in current database
echo "=== Current Database State ==="
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Count agents
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT COUNT(*) as agent_count FROM agents;"

# Count skills
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT COUNT(*) as skill_count FROM skills;"
```

**Record these numbers** - you'll compare them after restore:
- Table count: _______
- Agent count: _______
- Skill count: _______

---

### Step 3: Create Test Database

```bash
# Create a test database for restoration
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui_test_restore OWNER postgres;"

# Verify test database was created
docker-compose exec postgres psql -U postgres -c \
  "SELECT datname FROM pg_database WHERE datname = 'claude_agent_ui_test_restore';"
```

**Expected Output**:
```
        datname
-----------------------------
 claude_agent_ui_test_restore
(1 row)
```

---

### Step 4: Restore Backup to Test Database

```bash
# Get the latest backup file
LATEST_BACKUP=$(ls -t ./database/backups/backup_*.sql.gz | head -n1)
echo "Restoring from: $LATEST_BACKUP"

# Restore the backup
gunzip -c "$LATEST_BACKUP" | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui_test_restore

echo "✅ Restore command completed"
```

**Expected Output** (last few lines):
```
ALTER TABLE
ALTER TABLE
ALTER TABLE
```

**Note**: You'll see many SET, CREATE TABLE, and ALTER TABLE statements - this is normal.

---

### Step 5: Verify Restored Data

```bash
# Count tables in restored database
echo "=== Restored Database State ==="
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test_restore -c \
  "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Count agents in restored database
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test_restore -c \
  "SELECT COUNT(*) as agent_count FROM agents;"

# Count skills in restored database
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test_restore -c \
  "SELECT COUNT(*) as skill_count FROM skills;"
```

**Compare with numbers from Step 2**:
- Table count matches: ☐ Yes ☐ No
- Agent count matches: ☐ Yes ☐ No
- Skill count matches: ☐ Yes ☐ No

---

### Step 6: Verify Data Integrity

```bash
# Check sample data from agents table
echo "=== Sample Agents (Restored Database) ==="
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test_restore -c \
  "SELECT id, name, created_at FROM agents LIMIT 3;"

# Verify table structure
echo "=== Table List (Restored Database) ==="
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test_restore -c \
  "SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;"

# Check for foreign key constraints
echo "=== Foreign Key Constraints ==="
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test_restore -c \
  "SELECT conname, conrelid::regclass as table_name
   FROM pg_constraint
   WHERE contype = 'f'
   LIMIT 5;"
```

**Verification Checklist**:
- [ ] Sample data looks correct (no NULL values where unexpected)
- [ ] All expected tables exist (agents, skills, mcp_servers, tasks, etc.)
- [ ] Foreign key constraints exist
- [ ] No error messages during queries

---

### Step 7: Cleanup Test Database

```bash
# Drop the test database
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE claude_agent_ui_test_restore;"

# Verify it was dropped
docker-compose exec postgres psql -U postgres -c \
  "SELECT datname FROM pg_database WHERE datname = 'claude_agent_ui_test_restore';"
```

**Expected Output**:
```
 datname
---------
(0 rows)
```

---

## Test Results

### Summary

Complete this summary after running all steps:

**Date**: ______________

**Tester**: ______________

**Results**:

| Test Step | Status | Notes |
|-----------|--------|-------|
| 1. Create Backup | ☐ Pass ☐ Fail | |
| 2. Capture DB State | ☐ Pass ☐ Fail | |
| 3. Create Test DB | ☐ Pass ☐ Fail | |
| 4. Restore Backup | ☐ Pass ☐ Fail | |
| 5. Verify Counts Match | ☐ Pass ☐ Fail | |
| 6. Verify Data Integrity | ☐ Pass ☐ Fail | |
| 7. Cleanup | ☐ Pass ☐ Fail | |

**Overall Result**: ☐ PASSED ☐ FAILED

**Issues Encountered**:
```
(Describe any issues here)
```

**Recommendations**:
```
(Any recommendations for improvement)
```

---

## Troubleshooting

### Issue: "PostgreSQL container not running"

**Solution**:
```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Wait for it to be ready
docker-compose exec postgres pg_isready -U postgres
```

### Issue: "Permission denied"

**Solution**:
```bash
# Make scripts executable
chmod +x ./scripts/backup-postgres.sh
chmod +x ./scripts/test-backup-restore.sh

# Check backup directory permissions
ls -la ./database/backups
```

### Issue: "Database already exists" when creating test DB

**Solution**:
```bash
# Drop existing test database first
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE IF EXISTS claude_agent_ui_test_restore;"

# Then recreate it
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui_test_restore OWNER postgres;"
```

### Issue: "No such file or directory" for backup

**Solution**:
```bash
# Create backups directory
mkdir -p ./database/backups

# Verify it exists
ls -la ./database/backups

# Run backup again
bash ./scripts/backup-postgres.sh
```

### Issue: Counts don't match after restore

**Possible Causes**:
- Database was modified between backup and verification
- Wrong backup file restored
- Backup was corrupted

**Solution**:
```bash
# Create a fresh backup
bash ./scripts/backup-postgres.sh

# Immediately test with the fresh backup
LATEST_BACKUP=$(ls -t ./database/backups/backup_*.sql.gz | head -n1)

# Continue with restore steps using this fresh backup
```

---

## Quick Reference Commands

### Create Backup
```bash
bash ./scripts/backup-postgres.sh
```

### List Backups
```bash
ls -lht ./database/backups/backup_*.sql.gz
```

### Check Backup Integrity
```bash
gzip -t ./database/backups/backup_TIMESTAMP.sql.gz
```

### Create Test Database
```bash
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui_test_restore OWNER postgres;"
```

### Restore to Test Database
```bash
gunzip -c ./database/backups/backup_TIMESTAMP.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui_test_restore
```

### Drop Test Database
```bash
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE claude_agent_ui_test_restore;"
```

---

## Acceptance Criteria

This manual test procedure verifies subtask 5.4 acceptance criteria:

✅ **Successfully restore from pg_dump backup**
- Steps 1, 3, 4 verify backup creation and restoration

✅ **Verify data integrity after restore**
- Steps 5, 6 verify data integrity and completeness

✅ **Document any issues encountered**
- Test Results section captures all issues and recommendations

---

## Related Documentation

- [Automated Test Script](../../scripts/test-backup-restore.sh) - Automated version of this test
- [Backup Procedures](./BACKUP_PROCEDURES.md) - Full backup documentation
- [Restore Procedures](./RESTORE_PROCEDURES.md) - Full restore documentation
- [Backup/Restore Testing Guide](./BACKUP_RESTORE_TESTING.md) - Comprehensive testing guide

---

*Document Version: 1.0*
*Last Updated: 2026-01-02*
*For: Subtask 5.4 - Test restore from backup*
