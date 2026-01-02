# PostgreSQL Automated Backup Setup Guide

This guide explains how to set up automated daily backups using the production-ready `backup-postgres-cron.sh` script.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Script Features](#script-features)
4. [Configuration](#configuration)
5. [Cron Setup](#cron-setup)
6. [Notification Setup](#notification-setup)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The `backup-postgres-cron.sh` script is a production-ready, cron-compatible backup solution with:

- ✅ **Automated daily backups** with configurable retention
- ✅ **Comprehensive logging** with log rotation
- ✅ **Email/webhook notifications** for success/failure
- ✅ **Backup verification** with size and integrity checks
- ✅ **Graceful error handling** with meaningful exit codes
- ✅ **Absolute path support** for cron compatibility
- ✅ **Multiple Docker commands** (docker-compose, docker compose, docker exec)
- ✅ **Disk space monitoring** with low-space warnings

---

## Quick Start

### 1. Test the Script Manually

Before setting up cron, test the script manually:

```bash
# Navigate to project directory
cd /path/to/claude_agent_ui

# Ensure PostgreSQL is running
docker-compose up -d postgres

# Run the backup script
bash ./scripts/backup-postgres-cron.sh

# Check the log
tail -f ./logs/backup-cron.log
```

**Expected output**:
```
[2026-01-02 14:30:22] [INFO] =========================================
[2026-01-02 14:30:22] [INFO] PostgreSQL Backup Started
[2026-01-02 14:30:22] [INFO] =========================================
[2026-01-02 14:30:22] [INFO] Checking prerequisites...
[2026-01-02 14:30:22] [INFO] Prerequisites check passed
[2026-01-02 14:30:22] [INFO] Checking if PostgreSQL container is running...
[2026-01-02 14:30:22] [INFO] PostgreSQL container is running (docker-compose)
[2026-01-02 14:30:22] [INFO] Creating PostgreSQL backup...
[2026-01-02 14:30:24] [INFO] Backup created successfully using docker-compose
[2026-01-02 14:30:24] [INFO] Compressing backup...
[2026-01-02 14:30:24] [INFO] Backup compressed successfully
[2026-01-02 14:30:24] [INFO] Verifying backup integrity...
[2026-01-02 14:30:25] [SUCCESS] Backup verification passed (1234KB)
[2026-01-02 14:30:25] [SUCCESS] Backup completed successfully!
```

### 2. Verify Backup Created

```bash
# List backups
ls -lh ./database/backups/

# Should show:
# backup_20260102_143022.sql.gz
```

### 3. Set Up Cron Job

```bash
# Edit crontab
crontab -e

# Add daily backup at 2:00 AM
0 2 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
```

**Important**: Replace `/path/to/claude_agent_ui` with your actual project path.

---

## Script Features

### Comprehensive Logging

The script logs all operations to `logs/backup-cron.log` with:

- **Timestamped entries**: `[2026-01-02 14:30:22] [INFO] message`
- **Log levels**: INFO, WARN, ERROR, SUCCESS
- **Automatic log rotation**: Keeps last 30 log files (configurable)
- **Detailed error messages**: For troubleshooting

### Backup Verification

Multi-step verification ensures backup integrity:

1. **File existence check**: Verify backup file was created
2. **Size validation**: Check backup meets minimum size (default: 10KB)
3. **Gzip integrity check**: Verify compressed file is not corrupted
4. **Success reporting**: Log backup size and location

### Automatic Cleanup

The script automatically:

- **Prunes old backups**: Keeps last N backups (default: 7)
- **Rotates log files**: Keeps last N log files (default: 30)
- **Cleans up failed backups**: Removes partial/failed backup files

### Error Handling

Robust error handling with meaningful exit codes:

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | Backup completed successfully |
| 1 | PostgreSQL not running | Container is stopped (warning only) |
| 2 | Backup creation failed | Check PostgreSQL logs and permissions |
| 3 | Compression failed | Check disk space and gzip installation |
| 4 | Verification failed | Backup may be corrupted, kept for investigation |
| 5 | Prerequisites failed | Check Docker installation and directory permissions |

### Notifications

Optional email and webhook notifications for:

- **Backup failures**: Immediate alerts with error details
- **Backup success**: Confirmation with backup size and location
- **Log excerpts**: Recent log entries included in notifications

---

## Configuration

### Environment Variables

Configure the backup script using environment variables in `.env`:

```bash
# Backup Configuration
BACKUP_RETENTION=7                     # Keep last N backups (default: 7)
BACKUP_MIN_SIZE_KB=10                  # Minimum valid backup size in KB (default: 10)
BACKUP_LOG_RETENTION=30                # Keep last N log files (default: 30)

# Notification Configuration (optional)
BACKUP_NOTIFY_EMAIL=admin@example.com  # Email for notifications
BACKUP_NOTIFY_WEBHOOK=https://...      # Webhook URL for notifications

# Database Configuration (usually already set)
POSTGRES_USER=postgres                 # Database user
POSTGRES_DB=claude_agent_ui            # Database name
POSTGRES_CONTAINER=postgres            # Container name
```

### Cron Environment Variables

If you don't want to use `.env`, you can set variables directly in cron:

```bash
# Edit crontab
crontab -e

# Set variables before the backup command
BACKUP_RETENTION=14
BACKUP_NOTIFY_EMAIL=admin@example.com
0 2 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
```

---

## Cron Setup

### Daily Backup at 2:00 AM

Standard production setup:

```bash
# Edit crontab
crontab -e

# Add this line (replace /path/to/claude_agent_ui with your actual path)
0 2 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
```

### Alternative Schedules

```bash
# Every 6 hours
0 */6 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh

# Twice daily (2 AM and 2 PM)
0 2,14 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh

# Hourly during business hours (9 AM - 5 PM, Mon-Fri)
0 9-17 * * 1-5 cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh

# Weekly on Sunday at midnight
0 0 * * 0 cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh

# Monthly on the 1st at 3:00 AM
0 3 1 * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
```

### Cron with Email Notifications

```bash
# Set email and run daily at 2 AM
0 2 * * * BACKUP_NOTIFY_EMAIL=admin@example.com cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
```

### Verify Cron Setup

```bash
# List cron jobs
crontab -l

# Check cron service is running
systemctl status cron     # Ubuntu/Debian
systemctl status crond    # CentOS/RHEL

# Check cron logs
grep CRON /var/log/syslog  # Ubuntu/Debian
grep CRON /var/log/cron    # CentOS/RHEL

# Check backup logs
tail -f /path/to/claude_agent_ui/logs/backup-cron.log
```

---

## Notification Setup

### Email Notifications

#### Prerequisites

Install a mail transfer agent (MTA):

```bash
# Ubuntu/Debian
sudo apt-get install mailutils

# CentOS/RHEL
sudo yum install mailx

# macOS (uses built-in mail)
# No installation needed
```

#### Configuration

Set the email address in `.env`:

```bash
BACKUP_NOTIFY_EMAIL=admin@example.com
```

Or in crontab:

```bash
0 2 * * * BACKUP_NOTIFY_EMAIL=admin@example.com cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
```

#### Email Format

**Success Email**:
```
Subject: PostgreSQL Backup SUCCESS - your-hostname

Backup completed successfully

Details:
Backup file: /path/to/backup_20260102_020000.sql.gz
Size: 1.2M

Recent Log:
[2026-01-02 02:00:22] [INFO] PostgreSQL Backup Started
[2026-01-02 02:00:25] [SUCCESS] Backup completed successfully!
```

**Failure Email**:
```
Subject: PostgreSQL Backup FAILURE - your-hostname

Backup creation failed

Details:
Exit code: 2

Recent Log:
[2026-01-02 02:00:22] [INFO] PostgreSQL Backup Started
[2026-01-02 02:00:24] [ERROR] Backup creation failed
```

### Webhook Notifications

For integration with monitoring systems, Slack, Discord, etc.:

```bash
# In .env
BACKUP_NOTIFY_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Webhook Payload**:
```json
{
  "status": "SUCCESS",
  "message": "Backup completed successfully",
  "hostname": "your-hostname",
  "timestamp": "2026-01-02T02:00:25+00:00",
  "backup_file": "/path/to/backup_20260102_020000.sql.gz"
}
```

#### Slack Integration

1. Create a Slack incoming webhook
2. Set the webhook URL:
   ```bash
   BACKUP_NOTIFY_WEBHOOK=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
   ```

#### Discord Integration

1. Create a Discord webhook in your server settings
2. Append `/slack` to the webhook URL (for Slack-compatible format):
   ```bash
   BACKUP_NOTIFY_WEBHOOK=https://discord.com/api/webhooks/123456789/XXXXXXXXXXXXXXXXXXXX/slack
   ```

---

## Monitoring

### Check Last Backup

```bash
# View latest backup
ls -lth /path/to/claude_agent_ui/database/backups/ | head -n 5

# Check latest backup size
du -h /path/to/claude_agent_ui/database/backups/backup_*.sql.gz | tail -n 1

# View latest log
tail -n 50 /path/to/claude_agent_ui/logs/backup-cron.log
```

### Verify Backups Are Running

```bash
# Check if backups are being created (should see new files daily)
find /path/to/claude_agent_ui/database/backups/ -name "backup_*.sql.gz" -mtime -1

# Should return at least one file if backup ran in last 24 hours
```

### Monitor Backup Size Over Time

```bash
# Track backup size trends
ls -lh /path/to/claude_agent_ui/database/backups/ | awk '{print $5, $9}' | grep backup_

# Example output:
# 1.2M backup_20260101_020000.sql.gz
# 1.3M backup_20260102_020000.sql.gz
# 1.4M backup_20260103_020000.sql.gz
```

### Set Up Automated Monitoring

Create a monitoring script to check backup age:

```bash
#!/bin/bash
# Check if backups are recent (< 25 hours old)

BACKUP_DIR="/path/to/claude_agent_ui/database/backups"
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime -1 | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "⚠️  WARNING: No backups created in last 24 hours!"
    # Send alert email
    echo "No recent PostgreSQL backups found" | mail -s "BACKUP ALERT" admin@example.com
    exit 1
else
    echo "✅ Recent backup found: $(basename "$LATEST_BACKUP")"
    exit 0
fi
```

Add to crontab to run hourly:
```bash
0 * * * * bash /path/to/monitor-backups.sh
```

---

## Troubleshooting

### Issue: Cron Job Not Running

**Symptoms**: No new backups appearing, no log entries

**Diagnostic Steps**:

```bash
# 1. Check cron service is running
systemctl status cron

# 2. Check crontab is configured
crontab -l

# 3. Check cron logs for errors
grep CRON /var/log/syslog | tail -n 50

# 4. Test script manually
cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh

# 5. Check script permissions
ls -l /path/to/claude_agent_ui/scripts/backup-postgres-cron.sh
# Should show: -rwxr-xr-x (executable)
```

**Solutions**:

```bash
# Make script executable
chmod +x /path/to/claude_agent_ui/scripts/backup-postgres-cron.sh

# Use absolute paths in crontab
# WRONG: 0 2 * * * ./scripts/backup-postgres-cron.sh
# RIGHT: 0 2 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh

# Ensure cron has correct PATH
# Add to crontab:
PATH=/usr/local/bin:/usr/bin:/bin

# Restart cron service
sudo systemctl restart cron
```

### Issue: "PostgreSQL container not running"

**Log Entry**:
```
[2026-01-02 02:00:22] [WARN] PostgreSQL container not running, skipping backup
```

**Solution**:

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Verify container is running
docker-compose ps postgres

# Check if container name matches configuration
docker ps | grep postgres

# If container has different name, update .env:
POSTGRES_CONTAINER=your_actual_container_name
```

### Issue: "Permission denied" Error

**Log Entry**:
```
[2026-01-02 02:00:24] [ERROR] Backup directory is not writable
```

**Solution**:

```bash
# Fix backup directory permissions
chmod 755 /path/to/claude_agent_ui/database/backups

# Fix log directory permissions
chmod 755 /path/to/claude_agent_ui/logs

# Ensure cron user has access to project directory
ls -ld /path/to/claude_agent_ui
# Should show at least: drwxr-xr-x

# If running as different user, add user to docker group
sudo usermod -aG docker $USER
```

### Issue: Backup File Too Small

**Log Entry**:
```
[2026-01-02 02:00:25] [ERROR] Backup file is too small (5KB < 10KB)
```

**Diagnostic Steps**:

```bash
# Check if database has data
docker-compose exec postgres psql -U postgres -d claude_agent_ui -c "\dt"

# Check recent backup contents
gunzip -c /path/to/database/backups/backup_*.sql.gz | head -n 50

# Test manual backup
docker-compose exec -T postgres pg_dump -U postgres claude_agent_ui > test_backup.sql
cat test_backup.sql | wc -l
```

**Solutions**:

```bash
# If database is empty, this is expected
# Otherwise, check for PostgreSQL errors:
docker-compose logs postgres | tail -n 50

# Adjust minimum size threshold if needed (in .env):
BACKUP_MIN_SIZE_KB=5
```

### Issue: Email Notifications Not Working

**Symptoms**: No emails received

**Diagnostic Steps**:

```bash
# Check if mail is installed
which mail
which sendmail

# Test mail manually
echo "Test email" | mail -s "Test" your@email.com

# Check mail logs
tail -f /var/log/mail.log

# Check notification configuration
grep BACKUP_NOTIFY_EMAIL /path/to/claude_agent_ui/.env
```

**Solutions**:

```bash
# Install mail utilities
sudo apt-get install mailutils

# Configure mail relay (if needed)
# Edit /etc/postfix/main.cf for SMTP relay

# Use external SMTP (alternative)
# Install msmtp for external SMTP support
sudo apt-get install msmtp msmtp-mta
```

### Issue: Backup Verification Failed

**Log Entry**:
```
[2026-01-02 02:00:25] [ERROR] Backup file is corrupted (gzip integrity check failed)
```

**Diagnostic Steps**:

```bash
# Test gzip integrity manually
gzip -t /path/to/database/backups/backup_20260102_020000.sql.gz

# Check for disk errors
dmesg | grep -i error

# Check available disk space
df -h /path/to/claude_agent_ui/database/backups
```

**Solutions**:

```bash
# Free up disk space if needed
docker system prune -a

# Check disk health
sudo smartctl -a /dev/sda

# Retry backup manually
bash /path/to/claude_agent_ui/scripts/backup-postgres-cron.sh
```

---

## Best Practices

### 1. Test Before Production

Always test the backup script manually before setting up cron:

```bash
# Test backup creation
bash ./scripts/backup-postgres-cron.sh

# Test restore from backup (dry-run)
npm run test:rollback -- --dry-run

# Verify backup integrity
gzip -t ./database/backups/backup_*.sql.gz
```

### 2. Monitor Backup Success

Don't assume backups are working - verify:

- **Daily**: Check log file for success messages
- **Weekly**: Verify backup files exist and sizes are reasonable
- **Monthly**: Test restore procedure in staging environment
- **Quarterly**: Full disaster recovery drill

### 3. Multiple Backup Locations

Follow the **3-2-1 rule**:
- **3** copies of data
- **2** different storage types
- **1** off-site copy

```bash
# Add to cron script or separate job
# Upload to cloud storage after backup
aws s3 cp ./database/backups/backup_*.sql.gz s3://your-bucket/postgres-backups/

# Or use rsync to remote server
rsync -avz ./database/backups/ backup-server:/backups/postgres/
```

### 4. Security Considerations

```bash
# Secure backup directory
chmod 700 ./database/backups

# Secure backup files
chmod 600 ./database/backups/*.sql.gz

# Encrypt sensitive backups
gpg --symmetric --cipher-algo AES256 backup.sql.gz
```

### 5. Document Your Backup Strategy

Create a `BACKUP_STRATEGY.md` in your project documenting:
- Backup schedule
- Retention policy
- Notification recipients
- Recovery procedures
- Responsible parties
- RTO/RPO targets

---

## Related Documentation

- 📖 [Backup Procedures](./BACKUP_PROCEDURES.md) - Comprehensive backup documentation
- 📖 [Restore Procedures](./RESTORE_PROCEDURES.md) - Restore and recovery procedures
- 📖 [Rollback Procedures](./POSTGRES_ROLLBACK_PROCEDURES.md) - Migration rollback
- 📖 [Health Check Endpoints](./HEALTH_CHECK_ENDPOINTS.md) - Database health monitoring

---

## Quick Reference

### Test Script Manually

```bash
cd /path/to/claude_agent_ui
bash ./scripts/backup-postgres-cron.sh
tail -f ./logs/backup-cron.log
```

### Set Up Daily Cron Backup

```bash
crontab -e
# Add: 0 2 * * * cd /path/to/claude_agent_ui && bash ./scripts/backup-postgres-cron.sh
```

### Enable Email Notifications

```bash
# In .env
BACKUP_NOTIFY_EMAIL=admin@example.com
```

### Check Last Backup

```bash
ls -lth /path/to/claude_agent_ui/database/backups/ | head -5
tail -50 /path/to/claude_agent_ui/logs/backup-cron.log
```

---

**Last Updated**: 2026-01-02
**Version**: 1.0.0
**Maintainer**: Claude Agent UI Team
