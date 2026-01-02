# PostgreSQL Backup Procedures

This document provides comprehensive instructions for backing up the PostgreSQL database in the Claude Agent UI.

## Table of Contents

1. [Overview](#overview)
2. [Manual Backup Procedures](#manual-backup-procedures)
3. [Automated Backup Script](#automated-backup-script)
4. [Docker Backup Methods](#docker-backup-methods)
5. [Automated Scheduling](#automated-scheduling)
6. [Backup Retention Policy](#backup-retention-policy)
7. [Backup Types](#backup-types)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Claude Agent UI uses PostgreSQL as its primary database. Regular backups are critical for:

- **Data Protection**: Prevent data loss from hardware failures, bugs, or human error
- **Disaster Recovery**: Restore operations quickly after incidents
- **Migration Safety**: Create restore points before risky operations
- **Compliance**: Meet data retention and audit requirements

### When to Create Backups

Create backups before:
- Running database migrations
- Upgrading Strapi or PostgreSQL versions
- Making bulk data changes or deletions
- Deploying to production
- Testing risky database operations
- Any critical system maintenance

**Best Practice**: Automate daily backups and create manual backups before any risky operation.

---

## Manual Backup Procedures

### Standard pg_dump Backup

The most common backup method using PostgreSQL's `pg_dump` utility:

```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Create a timestamped backup
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  --no-owner \
  --no-acl \
  > ./database/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Compress the backup to save space
gzip ./database/backups/backup_*.sql
```

### Backup with Clean/Drop Statements

Creates a backup that drops existing objects before recreating them:

```bash
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  > ./database/backups/backup_clean_$(date +%Y%m%d_%H%M%S).sql
```

**When to use**: For backups intended for complete database restoration.

### Schema-Only Backup

Creates a backup of database structure without data:

```bash
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  --schema-only \
  --no-owner \
  --no-acl \
  > ./database/backups/schema_$(date +%Y%m%d_%H%M%S).sql
```

**When to use**: For schema migrations, documentation, or testing.

### Data-Only Backup

Creates a backup of data without schema:

```bash
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  --data-only \
  --no-owner \
  --no-acl \
  > ./database/backups/data_$(date +%Y%m%d_%H%M%S).sql
```

**When to use**: For data migrations or seeding test environments.

### Custom Format Backup

Creates a compressed, custom-format backup (recommended for large databases):

```bash
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  --format=custom \
  --compress=9 \
  --file=/backups/backup_$(date +%Y%m%d_%H%M%S).dump
```

**Advantages**:
- Better compression than gzip
- Faster restore
- Selective restore of specific tables
- Parallel restore support

**Note**: Restore with `pg_restore` instead of `psql`.

---

## Automated Backup Script

The project includes an automated backup script for convenient, consistent backups.

### Running the Backup Script

```bash
# Make sure PostgreSQL is running
docker-compose up -d postgres

# Run the backup script
bash ./scripts/backup-postgres.sh
```

### What the Backup Script Does

1. ✅ Checks if PostgreSQL container is running
2. ✅ Creates a timestamped SQL dump using `pg_dump`
3. ✅ Compresses the dump with `gzip` to save disk space
4. ✅ Stores backup in `database/backups/` directory
5. ✅ Automatically prunes old backups (keeps last 7)
6. ✅ Provides clear success/failure messages

### Backup File Naming Convention

Backups are named with timestamps for easy identification:

```
backup_YYYYMMDD_HHMMSS.sql.gz
```

**Examples**:
```
backup_20260102_143022.sql.gz  # January 2, 2026 at 2:30:22 PM
backup_20260102_020000.sql.gz  # January 2, 2026 at 2:00:00 AM (cron backup)
```

### Script Configuration

The script uses environment variables from `.env`:

```bash
# Database connection settings
POSTGRES_USER=postgres           # Default: postgres
POSTGRES_DB=claude_agent_ui      # Default: claude_agent_ui
POSTGRES_PASSWORD=your_password  # Required

# Backup settings
BACKUP_DIR=./database/backups    # Backup location
BACKUP_RETENTION=7               # Keep last 7 backups
```

### Customizing the Backup Script

Edit `scripts/backup-postgres.sh` to customize behavior:

```bash
# Change retention (keep last 30 backups instead of 7)
ls -t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +31 | xargs -r rm

# Add email notifications on failure
if ! docker-compose exec -T postgres pg_dump ...; then
    echo "Backup failed!" | mail -s "Backup Failed" admin@example.com
fi

# Upload to remote storage after backup
aws s3 cp "${BACKUP_FILE}.gz" s3://your-bucket/postgres-backups/
```

---

## Docker Backup Methods

### Method 1: Using docker exec (Recommended)

Direct backup from the Docker container:

```bash
# From host machine
docker exec -t claude-postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  > ./database/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Method 2: Using docker-compose exec

Backup using docker-compose:

```bash
# Using docker-compose
docker-compose exec -T postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  > ./database/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

**Note**: The `-T` flag disables pseudo-TTY allocation (required for piping output).

### Method 3: Inside Container Backup

Create backup inside the container:

```bash
# Execute command inside container
docker-compose exec postgres bash -c \
  "pg_dump -U postgres claude_agent_ui > /backups/backup_$(date +%Y%m%d_%H%M%S).sql"

# Compress the backup
docker-compose exec postgres gzip /backups/backup_*.sql
```

**Advantage**: Backup stays within Docker volume (accessible at `./database/backups/`).

### Method 4: Volume Backup

Backup the entire PostgreSQL data directory:

```bash
# Stop PostgreSQL to ensure consistency
docker-compose stop postgres

# Create volume backup
docker run --rm \
  -v claude_agent_ui_postgres_data:/data \
  -v $(pwd)/database/backups:/backup \
  alpine tar czf /backup/postgres_volume_$(date +%Y%m%d_%H%M%S).tar.gz /data

# Restart PostgreSQL
docker-compose up -d postgres
```

**When to use**: Complete disaster recovery, including PostgreSQL configuration files.

---

## Automated Scheduling

### Production Cron Setup

For production environments, set up automated daily backups using cron.

#### Step 1: Create Cron-Compatible Script

The project includes a production-ready cron script (to be created in subtask 5.3):

```bash
scripts/backup-postgres-cron.sh
```

#### Step 2: Install Cron Job

Add to your crontab:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2:00 AM
0 2 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh >> ./logs/backup-cron.log 2>&1

# Or hourly backups for critical systems
0 * * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh >> ./logs/backup-cron.log 2>&1
```

**Important**: Use absolute paths in cron jobs.

#### Step 3: Verify Cron Setup

```bash
# List cron jobs
crontab -l

# Check cron logs
tail -f ./logs/backup-cron.log

# Manually test the cron script
bash ./scripts/backup-postgres-cron.sh
```

### Cron Schedule Examples

```bash
# Daily at 2:00 AM
0 2 * * * /path/to/backup-script.sh

# Every 6 hours
0 */6 * * * /path/to/backup-script.sh

# Hourly during business hours (9 AM - 5 PM, Mon-Fri)
0 9-17 * * 1-5 /path/to/backup-script.sh

# Weekly on Sunday at midnight
0 0 * * 0 /path/to/backup-script.sh

# Monthly on the 1st at 3:00 AM
0 3 1 * * /path/to/backup-script.sh
```

### Docker Compose Scheduled Backups

Alternative: Use a backup service in docker-compose:

```yaml
# Add to docker-compose.yml
backup-cron:
  image: postgres:16-alpine
  container_name: claude-backup-cron
  depends_on:
    - postgres
  volumes:
    - ./database/backups:/backups
    - ./scripts:/scripts:ro
  environment:
    POSTGRES_HOST: postgres
    POSTGRES_DB: ${POSTGRES_DB}
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  command: |
    sh -c "
      echo '0 2 * * * /scripts/backup-postgres-cron.sh' | crontab -
      crond -f
    "
```

### Kubernetes CronJob (for K8s deployments)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:16-alpine
            env:
            - name: POSTGRES_HOST
              value: "postgres-service"
            - name: POSTGRES_DB
              value: "claude_agent_ui"
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h $POSTGRES_HOST -U postgres -d $POSTGRES_DB | \
              gzip > /backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
            volumeMounts:
            - name: backups
              mountPath: /backups
          volumes:
          - name: backups
            persistentVolumeClaim:
              claimName: postgres-backups-pvc
          restartPolicy: OnFailure
```

---

## Backup Retention Policy

### Default Retention

The automated backup script keeps **7 backups** (approximately one week of daily backups):

```bash
# In scripts/backup-postgres.sh
ls -t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +8 | xargs -r rm
```

### Customizing Retention

Edit the backup script to adjust retention:

```bash
# Keep last 30 backups (approximately one month)
ls -t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +31 | xargs -r rm

# Keep last 90 backups (approximately 3 months)
ls -t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +91 | xargs -r rm
```

### Grandfather-Father-Son (GFS) Strategy

For production, implement a multi-tier retention strategy:

```bash
#!/bin/bash
# GFS Backup Strategy Example

BACKUP_DIR="./database/backups"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
MONTHLY_DIR="$BACKUP_DIR/monthly"

# Create daily backup
bash ./scripts/backup-postgres.sh

# Copy to daily directory (keep 7 days)
cp "$BACKUP_DIR"/backup_*.sql.gz "$DAILY_DIR/"
find "$DAILY_DIR" -name "backup_*.sql.gz" -mtime +7 -delete

# If Sunday, copy to weekly (keep 4 weeks)
if [ $(date +%u) -eq 7 ]; then
  cp "$BACKUP_DIR"/backup_*.sql.gz "$WEEKLY_DIR/"
  find "$WEEKLY_DIR" -name "backup_*.sql.gz" -mtime +28 -delete
fi

# If 1st of month, copy to monthly (keep 12 months)
if [ $(date +%d) -eq 01 ]; then
  cp "$BACKUP_DIR"/backup_*.sql.gz "$MONTHLY_DIR/"
  find "$MONTHLY_DIR" -name "backup_*.sql.gz" -mtime +365 -delete
fi
```

**Retention Tiers**:
- **Daily**: Keep 7 days
- **Weekly**: Keep 4 weeks
- **Monthly**: Keep 12 months

### Cloud Storage Retention

For cloud backups, use lifecycle policies:

**AWS S3 Example**:
```json
{
  "Rules": [
    {
      "Id": "postgres-backup-lifecycle",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

---

## Backup Types

### Full Backup (Default)

Complete backup of all database objects and data:

```bash
# Using backup script (recommended)
bash ./scripts/backup-postgres.sh

# Manual full backup
docker-compose exec -T postgres pg_dump -U postgres claude_agent_ui \
  > ./database/backups/full_backup_$(date +%Y%m%d_%H%M%S).sql
```

**When to use**: Default for all regular backups.

### Incremental Backup (WAL Archiving)

PostgreSQL supports continuous archiving via Write-Ahead Logs (WAL):

#### Enable WAL Archiving

Add to `docker-compose.yml`:

```yaml
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

#### Create Base Backup

```bash
# Create base backup
docker-compose exec -T postgres pg_basebackup \
  -U postgres \
  -D /backups/base/$(date +%Y%m%d_%H%M%S) \
  -Ft \
  -z \
  -P

# WAL files are continuously archived to database/backups/wal/
```

**Advantages**:
- Point-in-time recovery (PITR)
- Minimal backup overhead
- Continuous protection

**Disadvantages**:
- More complex setup
- Requires more storage
- More complex restore process

### Differential Backup

Backup only data changed since last full backup:

```bash
# Not natively supported by pg_dump
# Typically implemented via WAL archiving or logical replication
```

### Logical vs Physical Backups

#### Logical Backup (pg_dump)

```bash
# Exports SQL statements to recreate database
docker-compose exec -T postgres pg_dump -U postgres claude_agent_ui \
  > backup.sql
```

**Advantages**:
- Portable across PostgreSQL versions
- Human-readable SQL
- Selective restore
- Small size for databases with indexes

**Disadvantages**:
- Slower for large databases
- Requires schema recreation

#### Physical Backup (pg_basebackup)

```bash
# Copies PostgreSQL data directory
docker-compose exec -T postgres pg_basebackup \
  -U postgres \
  -D /backups/physical \
  -Ft -z -P
```

**Advantages**:
- Faster for large databases
- Exact binary copy
- Suitable for PITR

**Disadvantages**:
- Version-specific (must match PostgreSQL version)
- Not human-readable
- All-or-nothing restore

---

## Best Practices

### 1. Backup Before Risky Operations

**Always** create a backup before:

```bash
# Before migrations
bash ./scripts/backup-postgres.sh
npm run migrate:sqlite-to-postgres

# Before bulk updates
bash ./scripts/backup-postgres.sh
# ... perform bulk update ...

# Before upgrades
bash ./scripts/backup-postgres.sh
docker-compose pull postgres
docker-compose up -d postgres
```

### 2. Verify Backup Integrity

Test backups regularly to ensure they're valid:

```bash
# Test gzip integrity
gzip -t ./database/backups/backup_*.sql.gz

# Preview backup contents
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | head -n 50

# Check backup size (should be reasonable)
ls -lh ./database/backups/

# Test restore in dry-run mode
npm run test:rollback -- --dry-run
```

### 3. Store Backups in Multiple Locations

**3-2-1 Backup Rule**:
- **3** copies of your data
- **2** different media types
- **1** copy off-site

```bash
# Local backup
bash ./scripts/backup-postgres.sh

# Upload to cloud storage
aws s3 cp ./database/backups/backup_*.sql.gz \
  s3://your-bucket/postgres-backups/

# Optional: Copy to external drive
rsync -avz ./database/backups/ /mnt/external/postgres-backups/
```

### 4. Encrypt Sensitive Backups

Encrypt backups containing sensitive data:

```bash
# Encrypt backup with GPG
gpg --symmetric --cipher-algo AES256 \
  ./database/backups/backup_20260102_143022.sql.gz

# Decrypt when needed
gpg --decrypt backup_20260102_143022.sql.gz.gpg | \
  gunzip | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

### 5. Monitor Backup Success/Failure

Set up monitoring and alerting:

```bash
# Add to backup script
if [ $? -eq 0 ]; then
  echo "✅ Backup successful" | mail -s "Backup Success" admin@example.com
else
  echo "❌ Backup failed!" | mail -s "BACKUP FAILED" admin@example.com
fi

# Log to monitoring system
curl -X POST https://monitoring.example.com/api/backup-status \
  -d '{"status":"success","timestamp":"'$(date -Iseconds)'"}'
```

### 6. Document Your Backup Strategy

Maintain documentation:

```markdown
# Backup Strategy - Claude Agent UI

## Schedule
- Daily: 2:00 AM UTC (automated via cron)
- Manual: Before migrations and deployments

## Retention
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months

## Storage Locations
- Primary: ./database/backups/ (local)
- Secondary: s3://prod-backups/postgres/ (AWS S3)
- Tertiary: /mnt/backup-nas/ (NAS)

## Responsible Parties
- Primary: DevOps Team (devops@example.com)
- Backup: Database Team (dba@example.com)
- Emergency: On-call rotation

## Recovery Time Objective (RTO): 1 hour
## Recovery Point Objective (RPO): 24 hours
```

### 7. Test Restore Procedures Regularly

```bash
# Monthly: Test restore in dry-run mode
npm run test:rollback -- --dry-run

# Quarterly: Perform actual restore test in staging
# 1. Create test backup
# 2. Restore to staging environment
# 3. Verify data integrity
# 4. Document any issues

# Annually: Full disaster recovery drill
# 1. Simulate complete data loss
# 2. Restore from off-site backup
# 3. Verify full application functionality
# 4. Measure time to recovery
```

### 8. Set Proper File Permissions

```bash
# Secure backup files
chmod 600 ./database/backups/*.sql.gz
chmod 700 ./database/backups/

# Secure backup scripts
chmod 700 ./scripts/backup-postgres*.sh
```

### 9. Monitor Backup Size

```bash
# Track backup size over time
du -sh ./database/backups/

# Alert if backup size changes dramatically
CURRENT_SIZE=$(du -s ./database/backups/ | awk '{print $1}')
if [ $CURRENT_SIZE -gt $EXPECTED_SIZE_THRESHOLD ]; then
  echo "⚠️  Backup size unusually large: $CURRENT_SIZE"
fi
```

### 10. Use Compression

```bash
# Always compress backups to save space
gzip backup.sql                  # Standard compression
gzip -9 backup.sql              # Maximum compression (slower)
pigz backup.sql                 # Parallel gzip (faster)
```

---

## Troubleshooting

### Issue: "PostgreSQL container not running"

**Symptoms**:
```
⚠️  PostgreSQL container not running, skipping backup
```

**Solution**:
```bash
# Check container status
docker-compose ps postgres

# Start PostgreSQL
docker-compose up -d postgres

# Verify it's healthy
docker-compose ps postgres | grep "healthy"

# Check logs if not starting
docker-compose logs postgres
```

### Issue: "Permission denied" creating backup

**Symptoms**:
```
bash: ./database/backups/backup.sql: Permission denied
```

**Solution**:
```bash
# Fix directory permissions
chmod 755 ./database/backups

# Or create with sudo then fix ownership
sudo docker-compose exec -T postgres pg_dump ... > backup.sql
sudo chown $USER:$USER backup.sql
```

### Issue: Backup file is empty or very small

**Symptoms**:
```bash
ls -lh ./database/backups/
# backup_20260102_143022.sql.gz   245B  # Too small!
```

**Solution**:
```bash
# Check if database has data
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt"

# Check pg_dump errors
docker-compose exec postgres pg_dump -U postgres claude_agent_ui \
  2>&1 | tee backup.log

# Verify PostgreSQL is not in recovery mode
docker-compose exec postgres psql -U postgres -c "SELECT pg_is_in_recovery();"
```

### Issue: Backup script fails with "command not found"

**Symptoms**:
```
./scripts/backup-postgres.sh: line 24: docker-compose: command not found
```

**Solution**:
```bash
# Install docker-compose
sudo apt-get install docker-compose

# Or use docker compose (v2)
# Edit script to use "docker compose" instead of "docker-compose"

# Verify installation
docker-compose --version
```

### Issue: Out of disk space during backup

**Symptoms**:
```
gzip: write error: No space left on device
```

**Solution**:
```bash
# Check disk space
df -h

# Clean old backups manually
rm ./database/backups/backup_2025*.sql.gz

# Move backups to larger volume
mv ./database/backups/*.sql.gz /mnt/large-volume/backups/

# Reduce retention period (edit backup script)
# Keep only 3 backups instead of 7
```

### Issue: Backup takes too long

**Symptoms**:
```
# Backup running for > 10 minutes on small database
```

**Solution**:
```bash
# Use custom format with compression
docker-compose exec postgres pg_dump \
  -U postgres -d claude_agent_ui \
  --format=custom --compress=9 \
  --file=/backups/backup.dump

# Use parallel dump for large databases (PostgreSQL 9.3+)
docker-compose exec postgres pg_dump \
  -U postgres -d claude_agent_ui \
  --format=directory \
  --jobs=4 \
  --file=/backups/backup_dir

# Check for long-running queries blocking pg_dump
docker-compose exec postgres psql -U postgres -c \
  "SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';"
```

### Issue: Backup fails with "too many connections"

**Symptoms**:
```
pg_dump: error: connection to server failed: FATAL: remaining connection slots are reserved
```

**Solution**:
```bash
# Increase max_connections in PostgreSQL
# Add to docker-compose.yml:
postgres:
  command: postgres -c max_connections=200

# Or close idle connections before backup
docker-compose exec postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"
```

### Issue: Cron job doesn't run

**Symptoms**:
```
# No new backups appearing in directory
```

**Solution**:
```bash
# Check cron is running
systemctl status cron

# Check cron logs
grep CRON /var/log/syslog

# Verify crontab syntax
crontab -l

# Test cron job manually
bash /absolute/path/to/backup-postgres.sh

# Ensure cron has correct PATH
# Add to crontab:
PATH=/usr/local/bin:/usr/bin:/bin

# Check cron execution logs
tail -f ./logs/backup-cron.log
```

### Issue: Backup file corrupted

**Symptoms**:
```bash
gzip -t backup.sql.gz
# gzip: backup.sql.gz: invalid compressed data--crc error
```

**Solution**:
```bash
# Try to recover partial data
gzip -dc backup.sql.gz > recovered.sql

# Use a previous backup
ls -lt ./database/backups/
gunzip -c ./database/backups/backup_OLDER.sql.gz | head -n 10

# Implement backup verification in script
# Add after backup creation:
if ! gzip -t "$BACKUP_FILE.gz"; then
  echo "❌ Backup corrupted, retrying..."
  rm "$BACKUP_FILE.gz"
  # ... retry backup ...
fi
```

---

## Related Documentation

- 📖 [PostgreSQL Restore Procedures](./RESTORE_PROCEDURES.md) - Restore and recovery procedures
- 📖 [PostgreSQL Rollback Procedures](./POSTGRES_ROLLBACK_PROCEDURES.md) - Migration rollback
- 📖 [Health Check Endpoints](./HEALTH_CHECK_ENDPOINTS.md) - Database health monitoring
- 📖 [Connection Pool Verification](./CONNECTION_POOL_VERIFICATION.md) - Pool configuration

---

## Acceptance Criteria

This document fulfills the acceptance criteria for subtask 5.1:

- ✅ **Manual backup procedure documented**: See [Manual Backup Procedures](#manual-backup-procedures)
- ✅ **Automated backup script explained**: See [Automated Backup Script](#automated-backup-script)
- ✅ **Backup retention policy defined**: See [Backup Retention Policy](#backup-retention-policy)

---

## Quick Reference

### Most Common Commands

```bash
# Create backup (recommended)
bash ./scripts/backup-postgres.sh

# Manual backup
docker-compose exec -T postgres pg_dump -U postgres claude_agent_ui \
  > ./database/backups/backup_$(date +%Y%m%d_%H%M%S).sql && \
  gzip ./database/backups/backup_*.sql

# List backups
ls -lh ./database/backups/

# Test backup integrity
gzip -t ./database/backups/backup_*.sql.gz

# Test rollback procedures
npm run test:rollback -- --dry-run

# View backup contents
gunzip -c ./database/backups/backup_20260102_143022.sql.gz | less
```

---

## Support

If you encounter issues with backup procedures:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the backup script: `scripts/backup-postgres.sh`
3. Run the rollback test: `npm run test:rollback -- --dry-run`
4. Check PostgreSQL logs: `docker-compose logs postgres`
5. Verify PostgreSQL is healthy: `docker-compose ps postgres`
6. Consult the [PostgreSQL backup documentation](https://www.postgresql.org/docs/current/backup.html)

For restore procedures, see [RESTORE_PROCEDURES.md](./RESTORE_PROCEDURES.md).

---

**Last Updated**: 2026-01-02
**Version**: 1.0.0
**Maintainer**: Claude Agent UI Team
