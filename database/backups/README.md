# PostgreSQL Backups

This directory is used to store PostgreSQL database backups.

## Backup Location

This directory is mounted to `/backups` inside the PostgreSQL Docker container, making it easy to create and restore backups.

## Creating a Backup

### From inside the container:
```bash
docker exec claude-postgres pg_dump -U postgres -d claude_agent_ui > /backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

### From the host:
```bash
docker exec claude-postgres pg_dump -U postgres -d claude_agent_ui > database/backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

## Restoring from Backup

```bash
docker exec -i claude-postgres psql -U postgres -d claude_agent_ui < database/backups/backup-YYYYMMDD-HHMMSS.sql
```

## Automated Backups

See `scripts/backup-postgres-cron.sh` for automated backup configuration.

## Best Practices

- Keep at least 7 daily backups
- Test restore procedure monthly
- Store critical backups off-site
- Verify backup integrity regularly

## .gitignore

Backup files (*.sql, *.dump) are ignored by git to prevent committing large database dumps to version control.
