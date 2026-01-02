# PostgreSQL Backup & Restore Testing Guide

This document provides comprehensive instructions for testing backup and restore procedures to ensure they work correctly in production scenarios.

## Table of Contents

1. [Overview](#overview)
2. [Automated Testing](#automated-testing)
3. [Manual Testing Procedures](#manual-testing-procedures)
4. [Test Scenarios](#test-scenarios)
5. [Verification Checklist](#verification-checklist)
6. [Troubleshooting Test Failures](#troubleshooting-test-failures)
7. [Acceptance Criteria](#acceptance-criteria)

---

## Overview

Regular testing of backup and restore procedures is critical to ensure:

- **Backup Integrity**: Backups are created successfully and are not corrupted
- **Restore Functionality**: Backups can be restored without errors
- **Data Integrity**: Restored data matches the original data
- **Process Validation**: Documented procedures actually work
- **Confidence**: Team is prepared for disaster recovery scenarios

### When to Test

Test backup and restore procedures:

- **After initial setup**: Verify procedures work from the start
- **After configuration changes**: Any changes to backup/restore scripts or database config
- **Quarterly**: Regular disaster recovery drills
- **Before major releases**: Ensure you can roll back if needed
- **After infrastructure changes**: Docker, database, or storage changes

**Best Practice**: Test quarterly as part of disaster recovery drills and document any issues found.

---

## Automated Testing

### Quick Start

Run the automated backup and restore test script:

```bash
# Run automated test suite
bash ./scripts/test-backup-restore.sh
```

### What the Automated Test Does

The script performs the following tests:

1. **Prerequisites Check**
   - Verifies backup directory exists
   - Confirms Docker Compose is available
   - Checks PostgreSQL container is running
   - Validates jq tool is available for JSON processing

2. **Backup Creation Test**
   - Runs the backup script
   - Verifies backup file is created
   - Checks file size is reasonable (> 100 bytes)
   - Validates gzip integrity

3. **Database State Capture**
   - Counts tables in current database
   - Counts records in key tables (agents, skills)
   - Saves state for comparison

4. **Restore to Test Database**
   - Creates a separate test database (`claude_agent_ui_test_restore`)
   - Restores backup to test database
   - Verifies restore completes without errors

5. **Data Integrity Verification**
   - Counts tables in restored database
   - Counts records in restored tables
   - Compares with original database state

6. **Cleanup**
   - Drops test database
   - Cleans up temporary files

### Understanding Test Results

The test generates a JSON report at `./database/backups/backup-restore-test-results.json`:

```json
{
  "testRun": {
    "timestamp": "2026-01-02T14:30:22Z",
    "testType": "backup-restore-verification",
    "status": "passed"
  },
  "tests": [
    {
      "name": "Prerequisites - Backup Directory",
      "status": "passed",
      "message": "Backup directory exists",
      "timestamp": "2026-01-02T14:30:22Z"
    },
    {
      "name": "Create Backup",
      "status": "passed",
      "message": "Backup created and verified",
      "details": "./database/backups/backup_20260102_143022.sql.gz (25678 bytes)",
      "timestamp": "2026-01-02T14:30:25Z"
    }
  ],
  "summary": {
    "total": 8,
    "passed": 7,
    "failed": 0,
    "warnings": 1
  }
}
```

**Interpreting Results**:

- **Status "passed"**: All critical tests passed, backup/restore works
- **Status "failed"**: One or more tests failed, investigate immediately
- **Warnings**: Non-critical issues noted, review but not blocking

### Test Output Example

```
========================================
PostgreSQL Backup & Restore Test
========================================

[INFO] Checking prerequisites...
[SUCCESS] All prerequisites met

[INFO] Test 1: Creating backup...
📦 Creating PostgreSQL backup...
✅ Backup created: ./database/backups/backup_20260102_143022.sql.gz
📂 Kept last 7 backups
[SUCCESS] Backup created successfully: ./database/backups/backup_20260102_143022.sql.gz (25678 bytes)

[INFO] Test 2: Capturing current database state...
[SUCCESS] Database state captured: 25 tables, 5 agents, 12 skills

[INFO] Test 3: Restoring backup to test database...
[SUCCESS] Backup restored to test database: claude_agent_ui_test_restore

[INFO] Test 4: Verifying restored data integrity...
[SUCCESS] Restored data verified: 25 tables, 5 agents, 12 skills

[INFO] Test 5: Cleaning up test database...
[SUCCESS] Test database cleaned up

========================================
Backup & Restore Test Results
========================================

Summary:
  Total Tests: 8
  Passed: 8
  Failed: 0
  Warnings: 0

[SUCCESS] All tests passed!
```

---

## Manual Testing Procedures

If you prefer to test manually or the automated script is not available, follow these steps:

### Prerequisites

Ensure you have:
- PostgreSQL container running
- Docker Compose installed
- Backup and restore scripts available
- At least 1GB free disk space

### Step 1: Create a Test Backup

```bash
# Ensure PostgreSQL is running
docker-compose ps postgres

# Create a backup
bash ./scripts/backup-postgres.sh

# Verify backup was created
ls -lh ./database/backups/backup_*.sql.gz

# Check the most recent backup
LATEST_BACKUP=$(ls -t ./database/backups/backup_*.sql.gz | head -n1)
echo "Latest backup: $LATEST_BACKUP"

# Verify gzip integrity
gzip -t "$LATEST_BACKUP"
echo "✅ Backup file integrity verified"

# Check backup size
BACKUP_SIZE=$(stat -f%z "$LATEST_BACKUP" 2>/dev/null || stat -c%s "$LATEST_BACKUP")
echo "Backup size: $BACKUP_SIZE bytes"

# Should be at least a few KB for a database with schema
if [ "$BACKUP_SIZE" -lt 1000 ]; then
    echo "⚠️ WARNING: Backup seems very small"
else
    echo "✅ Backup size looks reasonable"
fi
```

**Expected Result**: Backup file created successfully, passes integrity check, has reasonable size.

### Step 2: Capture Current Database State

```bash
# Count tables
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Count agents
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT COUNT(*) as agent_count FROM agents;"

# Count skills
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT COUNT(*) as skill_count FROM skills;"

# Sample agent data
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT id, name FROM agents LIMIT 3;"
```

**Expected Result**: Note the counts and sample data for comparison after restore.

### Step 3: Create Test Database and Restore

```bash
# Set variables
LATEST_BACKUP=$(ls -t ./database/backups/backup_*.sql.gz | head -n1)
TEST_DB="claude_agent_ui_test_restore"

# Drop test database if it exists (from previous test)
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE IF EXISTS $TEST_DB;"

# Create test database
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE $TEST_DB OWNER postgres;"

# Restore backup to test database
gunzip -c "$LATEST_BACKUP" | \
  docker-compose exec -T postgres psql -U postgres -d "$TEST_DB"

echo "✅ Restore completed"
```

**Expected Result**: Restore completes without errors. You should see output like:

```
SET
SET
SET
SET
SET
...
CREATE TABLE
CREATE TABLE
...
ALTER TABLE
ALTER TABLE
...
```

### Step 4: Verify Restored Data

```bash
# Count tables in restored database
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Count agents in restored database
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT COUNT(*) as agent_count FROM agents;"

# Count skills in restored database
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT COUNT(*) as skill_count FROM skills;"

# Sample agent data from restored database
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT id, name FROM agents LIMIT 3;"

# Verify schema exists
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

**Expected Result**:
- Table count matches original database
- Record counts match original database
- Sample data matches original database
- All expected tables exist

### Step 5: Test Data Integrity

```bash
# Check for foreign key constraints
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT conname, conrelid::regclass as table_name
   FROM pg_constraint
   WHERE contype = 'f'
   ORDER BY conrelid::regclass::text;"

# Check for indexes
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;"

# Verify no data corruption
docker-compose exec postgres psql -U postgres -d "$TEST_DB" -c \
  "SELECT * FROM agents LIMIT 5;"
```

**Expected Result**: All constraints and indexes exist, no data corruption detected.

### Step 6: Cleanup Test Database

```bash
# Drop test database
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE $TEST_DB;"

echo "✅ Test cleanup complete"
```

---

## Test Scenarios

### Scenario 1: Basic Backup and Restore

**Purpose**: Verify basic backup/restore functionality works.

**Steps**:
1. Create backup using `backup-postgres.sh`
2. Restore to test database
3. Verify data integrity

**Success Criteria**:
- Backup created without errors
- Restore completes without errors
- Data integrity verified

### Scenario 2: Large Database Backup

**Purpose**: Test backup/restore with larger datasets.

**Prerequisites**: Database with at least 100 records across multiple tables.

**Steps**:
1. Populate database with test data
2. Create backup
3. Verify backup completes in reasonable time (< 5 minutes for typical dev data)
4. Check backup file size is appropriate

**Success Criteria**:
- Large backup completes successfully
- Backup time is reasonable
- File size is proportional to data

### Scenario 3: Restore to Different Database

**Purpose**: Verify backup can be restored to a fresh database instance.

**Steps**:
1. Create backup from `claude_agent_ui` database
2. Create new database with different name
3. Restore backup to new database
4. Verify schema and data are identical

**Success Criteria**:
- Restore works on fresh database
- All tables, constraints, and indexes created
- All data present and accessible

### Scenario 4: Compressed Backup Handling

**Purpose**: Verify compressed backups work correctly.

**Steps**:
1. Create backup (automatically compressed by script)
2. Verify gzip integrity: `gzip -t backup_file.sql.gz`
3. Decompress and check SQL content: `gunzip -c backup_file.sql.gz | head -n 50`
4. Restore from compressed backup

**Success Criteria**:
- Backup compressed successfully
- Compression integrity verified
- Restore from compressed backup works

### Scenario 5: Disaster Recovery Simulation

**Purpose**: Simulate complete data loss and recovery.

**Steps**:
1. Create backup of production-like data
2. Document current data state (counts, samples)
3. Drop all tables from test database (simulate disaster)
4. Restore from backup
5. Verify all data recovered

**Success Criteria**:
- Complete database dropped and recreated
- All data restored from backup
- Application works with restored database

### Scenario 6: Point-in-Time Recovery (PITR)

**Purpose**: Test restore to specific point in time.

**Prerequisites**: WAL archiving configured (see RESTORE_PROCEDURES.md).

**Steps**:
1. Create base backup
2. Make changes to database (add/modify/delete data)
3. Note specific timestamp
4. Restore to point before changes
5. Verify changes are not present

**Success Criteria**:
- PITR restore successful
- Database state matches requested time
- Later changes not present

---

## Verification Checklist

Use this checklist when testing backup and restore procedures:

### Backup Verification

- [ ] Backup script runs without errors
- [ ] Backup file created with timestamp naming: `backup_YYYYMMDD_HHMMSS.sql.gz`
- [ ] Backup file size is reasonable (not empty, not suspiciously large)
- [ ] Backup file passes gzip integrity check: `gzip -t backup_file.sql.gz`
- [ ] Backup file contains SQL content (check with `gunzip -c file.sql.gz | head`)
- [ ] Backup retention policy working (old backups pruned)
- [ ] Backup stored in correct directory: `./database/backups/`
- [ ] Backup file permissions are appropriate (readable by user)

### Restore Verification

- [ ] Restore script/procedure documented
- [ ] Test database created successfully
- [ ] Backup restores without errors
- [ ] All tables present in restored database
- [ ] Table counts match original database
- [ ] Record counts match original database
- [ ] Sample data matches original database
- [ ] Foreign key constraints exist
- [ ] Indexes exist and are functional
- [ ] No data corruption detected
- [ ] Application can connect to restored database
- [ ] CRUD operations work on restored database

### Documentation Verification

- [ ] BACKUP_PROCEDURES.md complete and accurate
- [ ] RESTORE_PROCEDURES.md complete and accurate
- [ ] BACKUP_RESTORE_TESTING.md (this document) complete
- [ ] Troubleshooting sections cover common issues
- [ ] Examples are accurate and tested
- [ ] Scripts referenced in documentation exist
- [ ] Command examples work as documented

### Automation Verification

- [ ] `test-backup-restore.sh` script exists and is executable
- [ ] Automated test runs successfully
- [ ] Test results JSON file generated
- [ ] All automated tests pass
- [ ] npm script `test:backup-restore` works (if added)

---

## Troubleshooting Test Failures

### Issue: Backup File Not Created

**Symptoms**: Backup script runs but no file appears in `./database/backups/`

**Possible Causes**:
- PostgreSQL container not running
- Backup directory doesn't exist
- Permission issues

**Solutions**:
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Create backup directory if missing
mkdir -p ./database/backups

# Check permissions
ls -la ./database/backups

# Check disk space
df -h
```

### Issue: Backup File Too Small

**Symptoms**: Backup created but file size is < 1KB

**Possible Causes**:
- Database has no data
- pg_dump failed silently
- Wrong database name

**Solutions**:
```bash
# Check if database has data
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"

# Run backup manually with error output
docker-compose exec -T postgres pg_dump -U postgres claude_agent_ui \
  > ./database/backups/manual_test_backup.sql

# Check for errors in Docker logs
docker-compose logs postgres | tail -n 50
```

### Issue: Restore Fails with "database does not exist"

**Symptoms**: Restore command fails because target database doesn't exist

**Solutions**:
```bash
# Create database before restore
docker-compose exec postgres psql -U postgres -c \
  "CREATE DATABASE claude_agent_ui_test_restore OWNER postgres;"

# Then retry restore
gunzip -c ./database/backups/backup_*.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui_test_restore
```

### Issue: Restore Fails with Permission Errors

**Symptoms**: `ERROR: permission denied for table` during restore

**Solutions**:
```bash
# Ensure database owner is correct
docker-compose exec postgres psql -U postgres -c \
  "ALTER DATABASE claude_agent_ui_test_restore OWNER TO postgres;"

# Use --no-owner and --no-acl in backup
docker-compose exec -T postgres pg_dump \
  -U postgres claude_agent_ui \
  --no-owner --no-acl \
  > ./database/backups/backup_no_owner.sql
```

### Issue: Data Mismatch After Restore

**Symptoms**: Restored data doesn't match original

**Possible Causes**:
- Backup was from different time/state
- Data changed between backup and comparison
- Wrong backup file restored

**Solutions**:
```bash
# Check backup timestamp
ls -lh ./database/backups/

# Verify backup SQL content
gunzip -c ./database/backups/backup_*.sql.gz | grep -A 5 "INSERT INTO agents"

# Create fresh backup and immediate restore test
bash ./scripts/backup-postgres.sh && bash ./scripts/test-backup-restore.sh
```

### Issue: Automated Test Script Fails

**Symptoms**: `test-backup-restore.sh` exits with errors

**Solutions**:
```bash
# Check script has execute permissions
chmod +x ./scripts/test-backup-restore.sh

# Check all prerequisites
which docker-compose
which jq

# Run with verbose output (if script supports it)
bash -x ./scripts/test-backup-restore.sh

# Check test results for specific failure
cat ./database/backups/backup-restore-test-results.json | jq '.tests[] | select(.status == "failed")'
```

### Issue: Test Database Not Cleaned Up

**Symptoms**: Test database remains after test

**Solutions**:
```bash
# Manually drop test database
docker-compose exec postgres psql -U postgres -c \
  "DROP DATABASE IF EXISTS claude_agent_ui_test_restore;"

# Check for orphaned databases
docker-compose exec postgres psql -U postgres -c \
  "SELECT datname FROM pg_database WHERE datname LIKE '%test%';"
```

---

## Acceptance Criteria

For subtask 5.4 (Test restore from backup), the following acceptance criteria must be met:

### ✅ Successfully Restore from pg_dump Backup

**Required**:
- Create a backup using the standard backup procedure
- Restore backup to a test database
- Restore completes without errors
- No data corruption in restored database

**Verification**:
```bash
# Run automated test
bash ./scripts/test-backup-restore.sh

# Check test results
cat ./database/backups/backup-restore-test-results.json | jq '.tests[] | select(.name | contains("Restore"))'
```

**Success**: Test shows "status": "passed" for restore tests.

### ✅ Verify Data Integrity After Restore

**Required**:
- Table counts match between original and restored database
- Record counts match for all entities
- Sample data matches original data
- Constraints and indexes present
- No data corruption

**Verification**:
```bash
# Run automated test (includes integrity checks)
bash ./scripts/test-backup-restore.sh

# Manual verification
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c \
  "SELECT 'agents' as table_name, COUNT(*) as count FROM agents
   UNION ALL
   SELECT 'skills', COUNT(*) FROM skills
   UNION ALL
   SELECT 'mcp_servers', COUNT(*) FROM mcp_servers;"

# Compare with test database
docker-compose exec postgres psql -U postgres -d claude_agent_ui_test_restore -c \
  "SELECT 'agents' as table_name, COUNT(*) as count FROM agents
   UNION ALL
   SELECT 'skills', COUNT(*) FROM skills
   UNION ALL
   SELECT 'mcp_servers', COUNT(*) FROM mcp_servers;"
```

**Success**: All counts match, no corruption detected.

### ✅ Document Any Issues Encountered

**Required**:
- All test failures documented
- Workarounds or solutions provided
- Issues added to troubleshooting section
- Test results saved for review

**Verification**:
- Check `./database/backups/backup-restore-test-results.json` exists
- Review this document's troubleshooting section
- Ensure all encountered issues have documented solutions

**Success**: All issues documented with solutions, test results available.

---

## Related Documentation

- [Backup Procedures](./BACKUP_PROCEDURES.md) - Comprehensive backup guide
- [Restore Procedures](./RESTORE_PROCEDURES.md) - Comprehensive restore guide
- [Rollback Procedures](./POSTGRES_ROLLBACK_PROCEDURES.md) - Migration rollback guide
- [Cron Backup Setup](./CRON_BACKUP_SETUP.md) - Automated backup configuration

---

## Summary

Regular testing of backup and restore procedures ensures:

1. **Backup scripts work correctly** and create valid backups
2. **Restore procedures are accurate** and can recover data
3. **Documentation is correct** and procedures are verified
4. **Team is prepared** for disaster recovery
5. **Data integrity is maintained** through the backup/restore cycle

**Recommendation**: Run the automated test script quarterly and after any infrastructure changes. Document any failures and update procedures as needed.

---

*Document Version: 1.0*
*Last Updated: 2026-01-02*
*Subtask: 5.4 - Test restore from backup*
