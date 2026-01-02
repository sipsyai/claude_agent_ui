# PostgreSQL Backups

This directory stores PostgreSQL database backups for the Claude Agent UI.

## Backup Location

This directory is mounted to `/backups` inside the PostgreSQL Docker container, making it easy to create and restore backups.

## Creating a Backup

### Recommended: Use the Backup Script

```bash
# Run the automated backup script
bash ./scripts/backup-postgres.sh
```

This script:
- Checks if PostgreSQL is running
- Creates timestamped SQL dump with `pg_dump`
- Compresses with gzip (saves space)
- Stores in `database/backups/`
- Keeps only last 7 backups

### Manual Backup Methods

#### From inside the container:
```bash
docker exec claude-postgres pg_dump -U postgres -d claude_agent_ui > /backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

#### From the host:
```bash
docker exec claude-postgres pg_dump -U postgres -d claude_agent_ui > database/backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

#### Using docker-compose:
```bash
docker-compose exec -T postgres pg_dump -U postgres claude_agent_ui > database/backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

## Backup File Format

Backups created by the automated script are named with timestamps:

```
backup_YYYYMMDD_HHMMSS.sql.gz
```

Example:
```
backup_20260102_143022.sql.gz
```

## Restoring from Backup

### Restore from Compressed Backup

```bash
# Stop Strapi first
docker-compose stop strapi

# Restore from gzipped backup
gunzip -c database/backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui

# Restart Strapi
docker-compose up -d strapi
```

### Restore from Uncompressed Backup

```bash
docker exec -i claude-postgres psql -U postgres -d claude_agent_ui < database/backups/backup-YYYYMMDD-HHMMSS.sql
```

### Complete Database Restore

For a clean restore (drops existing tables):

```bash
# Drop and recreate database
docker-compose exec postgres psql -U postgres <<EOF
DROP DATABASE claude_agent_ui;
CREATE DATABASE claude_agent_ui;
\q
EOF

# Restore from backup
gunzip -c database/backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose exec -T postgres psql -U postgres -d claude_agent_ui
```

## Testing Rollback Procedures

**Important**: Always test your rollback procedures before you need them!

```bash
# Test rollback in dry-run mode (safe)
npm run test:rollback -- --dry-run

# View detailed test results
npm run test:rollback -- --dry-run --verbose

# Actual restore test (use with caution!)
npm run test:rollback
```

The test verifies:
- ✅ PostgreSQL is running
- ✅ Backup directory is accessible
- ✅ Backup can be created
- ✅ Backup file is valid
- ✅ Restore procedure works
- ✅ Documentation is complete

## Automated Backups

### Development

Run backups before risky operations:
```bash
bash ./scripts/backup-postgres.sh
```

### Production

Set up automated daily backups using cron:

```bash
# Add to crontab (daily at 2 AM)
0 2 * * * cd /path/to/project && bash ./scripts/backup-postgres.sh
```

See `scripts/backup-postgres-cron.sh` for production-ready backup configuration.

## Retention Policy

The automated backup script keeps the **last 7 backups** and automatically deletes older ones.

To keep more backups, edit `scripts/backup-postgres.sh`:
```bash
# Change from 7 to desired number
ls -t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +8 | xargs -r rm
```

## Best Practices

### Before Critical Operations

Create a backup before:
- Running database migrations
- Upgrading PostgreSQL or Strapi
- Making bulk data changes
- Deploying to production
- Testing risky operations

### Regular Testing

- Test restore procedure monthly: `npm run test:rollback -- --dry-run`
- Verify backup integrity weekly
- Practice full disaster recovery quarterly

### Production Security

- Store critical backups off-site (S3, Google Cloud Storage, etc.)
- Encrypt backups containing sensitive data
- Set up monitoring for backup failures
- Document recovery procedures
- Assign backup/restore responsibilities

### Remote Storage

Upload backups to cloud storage:

```bash
# Example: AWS S3
aws s3 sync ./database/backups/ s3://your-bucket/postgres-backups/

# Example: Google Cloud Storage
gsutil -m rsync -r ./database/backups/ gs://your-bucket/postgres-backups/
```

## Documentation

For comprehensive rollback procedures and troubleshooting:

📖 [PostgreSQL Rollback Procedures](../../docs/database/POSTGRES_ROLLBACK_PROCEDURES.md)

This includes:
- Detailed rollback procedures
- Common scenarios and solutions
- Troubleshooting guide
- Disaster recovery steps

## Security

**Important Security Notes:**

⚠️ Backups may contain sensitive data:
- User credentials
- API tokens
- Private agent configurations
- Chat history

**Security Measures:**
- Never commit backups to version control
- Encrypt backups in production
- Set proper file permissions (600)
- Store backups securely
- Implement access controls
- Audit backup access logs

## .gitignore

Backup files are ignored by git to prevent committing large database dumps:
- `*.sql` - Uncompressed SQL dumps
- `*.sql.gz` - Compressed SQL dumps
- `*.dump` - PostgreSQL custom format dumps
- `rollback-test-report.json` - Test reports

## Support

If you encounter backup or restore issues:

1. Check [PostgreSQL Rollback Procedures](../../docs/database/POSTGRES_ROLLBACK_PROCEDURES.md)
2. Run the rollback test: `npm run test:rollback -- --dry-run`
3. Review PostgreSQL logs: `docker-compose logs postgres`
4. Check backup file integrity: `gzip -t backup_*.sql.gz`

---

**Last Updated**: 2026-01-02
