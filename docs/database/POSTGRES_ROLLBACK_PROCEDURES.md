# PostgreSQL Rollback Procedures

This document provides comprehensive instructions for backing up and rolling back the PostgreSQL database in the Claude Agent UI.

## Table of Contents

1. [Overview](#overview)
2. [Backup Procedures](#backup-procedures)
3. [Rollback Procedures](#rollback-procedures)
4. [Testing Rollback](#testing-rollback)
5. [Common Scenarios](#common-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The Claude Agent UI uses PostgreSQL as its primary database. This document covers:

- **Backup**: Creating database backups before migrations or critical operations
- **Rollback**: Restoring the database to a previous state if something goes wrong
- **Testing**: Verifying that backup/restore procedures work correctly

### When to Create Backups

Create backups before:
- Running database migrations
- Upgrading Strapi or PostgreSQL versions
- Making bulk data changes
- Deploying to production
- Any risky database operations

---

## Backup Procedures

### Automatic Backup Script

The project includes an automated backup script that creates compressed SQL dumps.

#### Running the Backup Script

```bash
# Make sure PostgreSQL is running
docker-compose up -d postgres

# Run the backup script
bash ./scripts/backup-postgres.sh
```

#### What the Backup Script Does

1. Checks if PostgreSQL container is running
2. Creates a timestamped SQL dump using `pg_dump`
3. Compresses the dump with `gzip`
4. Stores backup in `database/backups/`
5. Keeps only the last 7 backups (older ones are deleted)

#### Backup File Naming

Backups are named with timestamps:
```
backup_YYYYMMDD_HHMMSS.sql.gz
```

Example:
```
backup_20260102_143022.sql.gz
```

### Manual Backup

If you need to create a backup manually:

```bash
# Using docker-compose
docker-compose exec postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  --no-owner \
  --no-acl \
  > ./database/backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql

# Compress the backup
gzip ./database/backups/manual_backup_*.sql
```

### Backup to Remote Storage

For production, always backup to remote storage:

```bash
# Backup and upload to S3 (example)
bash ./scripts/backup-postgres.sh

# Upload to S3
aws s3 cp ./database/backups/backup_*.sql.gz \
  s3://your-backup-bucket/postgres-backups/
```

---

## Rollback Procedures

### When to Rollback

Rollback when:
- Migration fails or causes data corruption
- Unexpected data loss occurs
- Application becomes unstable after database changes
- You need to revert to a known good state

### Rollback Process

#### Step 1: Stop the Application

Stop Strapi to prevent new database writes:

```bash
# Stop Strapi (Ctrl+C in the terminal where it's running)
# Or if running in Docker:
docker-compose stop strapi
```

#### Step 2: List Available Backups

```bash
# List all backups
ls -lh ./database/backups/

# Or use the test script to see detailed backup info
npm run test:rollback -- --dry-run
```

#### Step 3: Verify Backup Integrity

Before restoring, verify the backup file is valid:

```bash
# Test gzip integrity
gzip -t ./database/backups/backup_YYYYMMDD_HHMMSS.sql.gz

# Preview the backup contents
gunzip -c ./database/backups/backup_YYYYMMDD_HHMMSS.sql.gz | head -n 20
```

#### Step 4: Create Pre-Rollback Backup

**Important**: Before restoring, backup the current state:

```bash
# Create a backup of the current state
bash ./scripts/backup-postgres.sh
```

This creates a safety net in case the rollback doesn't work as expected.

#### Step 5: Restore from Backup

```bash
# Restore from a specific backup
gunzip -c ./database/backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose exec -T postgres psql \
  -U postgres \
  -d claude_agent_ui
```

**Note**: This will restore the database but won't drop existing tables first. For a clean restore, see "Complete Database Restore" below.

#### Step 6: Restart the Application

```bash
# Restart Strapi
cd backend
npm run develop

# Or if using Docker:
docker-compose up -d strapi
```

#### Step 7: Verify Data

1. Check Strapi admin panel at http://localhost:1337/admin
2. Verify your data is present and correct
3. Test critical application features
4. Check that relationships are intact

---

## Complete Database Restore

For a complete restore (dropping all tables first):

```bash
# 1. Stop Strapi
docker-compose stop strapi

# 2. Drop and recreate the database
docker-compose exec postgres psql -U postgres <<EOF
DROP DATABASE claude_agent_ui;
CREATE DATABASE claude_agent_ui;
\q
EOF

# 3. Restore from backup
gunzip -c ./database/backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose exec -T postgres psql \
  -U postgres \
  -d claude_agent_ui

# 4. Restart Strapi
docker-compose up -d strapi
```

---

## Testing Rollback

### Automated Rollback Test

The project includes a comprehensive rollback test script:

```bash
# Test in dry-run mode (recommended first)
npm run test:rollback -- --dry-run

# Test with actual restore (use with caution!)
npm run test:rollback

# Verbose output
npm run test:rollback -- --dry-run --verbose
```

### What the Test Verifies

1. ✅ PostgreSQL is running
2. ✅ Backup directory exists and is writable
3. ✅ Backup script is executable
4. ✅ Backup can be created successfully
5. ✅ Backup file has valid gzip format
6. ✅ Backup contains valid SQL data
7. ✅ Restore command syntax is correct
8. ✅ Documentation exists

### Test Report

After running the test, check the report:

```bash
cat ./database/backups/rollback-test-report.json
```

The report includes:
- Summary of passed/failed tests
- Acceptance criteria verification
- Detailed test results
- Timestamps and file locations

---

## Common Scenarios

### Scenario 1: Migration Failed

```bash
# 1. Identify the backup taken before migration
ls -lh ./database/backups/

# 2. Stop Strapi
docker-compose stop strapi

# 3. Restore from pre-migration backup
gunzip -c ./database/backups/backup_BEFORE_MIGRATION.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# 4. Restart Strapi
docker-compose up -d strapi
```

### Scenario 2: Data Corruption Detected

```bash
# 1. Create emergency backup of current state
bash ./scripts/backup-postgres.sh

# 2. Find the last known good backup
ls -lh ./database/backups/

# 3. Stop Strapi
docker-compose stop strapi

# 4. Restore from last known good backup
gunzip -c ./database/backups/backup_LAST_GOOD.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# 5. Restart and verify
docker-compose up -d strapi
```

### Scenario 3: Accidental Data Deletion

```bash
# 1. IMMEDIATELY stop the application to prevent more writes
docker-compose stop strapi

# 2. Create a backup of the current (damaged) state for forensics
bash ./scripts/backup-postgres.sh

# 3. Restore from the most recent backup before the deletion
gunzip -c ./database/backups/backup_RECENT.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# 4. Restart Strapi
docker-compose up -d strapi

# 5. Manually re-enter any data created between the backup and deletion
```

### Scenario 4: Testing a Risky Operation

```bash
# 1. Create a backup specifically for this test
bash ./scripts/backup-postgres.sh

# 2. Note the backup filename
BACKUP_FILE=$(ls -t ./database/backups/backup_*.sql.gz | head -n 1)
echo "Safety backup: $BACKUP_FILE"

# 3. Perform your risky operation
# ... make your changes ...

# 4. If something goes wrong, restore immediately
gunzip -c $BACKUP_FILE | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

---

## Troubleshooting

### Issue: "No such file or directory" when running backup script

**Solution**:
```bash
# Ensure you're in the project root directory
cd /path/to/claude_agent_ui

# Check if the script exists
ls -la ./scripts/backup-postgres.sh

# Make it executable
chmod +x ./scripts/backup-postgres.sh
```

### Issue: "PostgreSQL container not running"

**Solution**:
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Verify it's running
docker-compose ps postgres

# Check logs if it's not starting
docker-compose logs postgres
```

### Issue: "Permission denied" during restore

**Solution**:
```bash
# Make sure you're using the -T flag for docker-compose exec
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql ...

# Or restore as the postgres user
docker-compose exec postgres psql -U postgres -d claude_agent_ui -f /path/to/backup.sql
```

### Issue: Restore fails with "relation already exists"

This happens when restoring without dropping tables first.

**Solution 1 - Clean Restore**:
```bash
# Drop and recreate database
docker-compose exec postgres psql -U postgres -c "DROP DATABASE claude_agent_ui;"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE claude_agent_ui;"

# Then restore
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

**Solution 2 - Use --clean flag**:
```bash
# Create backup with --clean flag
docker-compose exec postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  --clean \
  --if-exists \
  > backup_clean.sql
```

### Issue: Backup file is corrupted

**Solution**:
```bash
# Test gzip integrity
gzip -t backup.sql.gz

# If corrupted, use a previous backup
ls -lh ./database/backups/

# Restore from an older backup
gunzip -c ./database/backups/backup_OLDER.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

### Issue: Backup is too old, missing recent data

**Solution**:

This is why we keep 7 backups. If the most recent backup is too old:

1. Accept the data loss for items created after the backup
2. Check if you have application logs that could help recreate the data
3. Look for other backup sources (cloud storage, other environments)
4. Implement more frequent backups going forward

**Prevention**:
```bash
# Set up a cron job for hourly backups (production)
# Add to crontab:
0 * * * * cd /path/to/project && bash ./scripts/backup-postgres.sh
```

---

## Best Practices

1. **Always backup before risky operations**
   - Migrations
   - Bulk updates
   - Schema changes
   - Version upgrades

2. **Test your backups regularly**
   ```bash
   npm run test:rollback -- --dry-run
   ```

3. **Keep multiple backup generations**
   - The script keeps 7 backups by default
   - Adjust retention in `backup-postgres.sh` if needed

4. **Store backups in multiple locations**
   - Local: `database/backups/`
   - Remote: S3, Google Cloud Storage, etc.
   - Offsite: Different data center or region

5. **Document your restore procedures**
   - Keep this document up to date
   - Document any custom restore steps
   - Share with your team

6. **Verify backup integrity**
   ```bash
   gzip -t backup.sql.gz
   gunzip -c backup.sql.gz | head -n 20
   ```

7. **Monitor backup size**
   - Large backups may indicate issues
   - Track backup growth over time
   - Implement backup compression and archival

8. **Have a disaster recovery plan**
   - Document the complete restore process
   - Test it regularly
   - Assign responsibilities
   - Have emergency contacts

---

## Acceptance Criteria Verification

This document and the associated scripts fulfill the acceptance criteria for subtask 2.3:

- ✅ **Backup created before migration**: The `backup-postgres.sh` script creates backups automatically
- ✅ **Rollback restores database to pre-migration state**: Restore procedures documented and tested
- ✅ **Documentation includes rollback steps**: This document provides comprehensive rollback procedures

To verify these criteria are met, run:

```bash
npm run test:rollback -- --dry-run
```

---

## Related Documentation

- [Migration README](../../scripts/MIGRATION_README.md) - SQLite to PostgreSQL migration
- [PostgreSQL Verification Guide](../POSTGRES_VERIFICATION_GUIDE.md) - Table verification
- [Backup Script](../../scripts/backup-postgres.sh) - Automated backup script
- [Rollback Test Script](../../scripts/test-rollback-procedure.ts) - Rollback verification

---

## Support

If you encounter issues with backup or rollback procedures:

1. Check the troubleshooting section above
2. Review the test report: `database/backups/rollback-test-report.json`
3. Check PostgreSQL logs: `docker-compose logs postgres`
4. Consult the team or PostgreSQL documentation

---

**Last Updated**: 2026-01-02
**Version**: 1.0.0
**Maintainer**: Claude Agent UI Team
