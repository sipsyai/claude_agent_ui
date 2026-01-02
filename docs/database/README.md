# PostgreSQL Database Documentation

This directory contains comprehensive documentation for PostgreSQL configuration, connection pooling, backup/restore procedures, and testing infrastructure.

## Table of Contents

- [Connection Pooling](#connection-pooling)
- [Health Checks](#health-checks)
- [Backup & Restore](#backup--restore)
- [Testing & Verification](#testing--verification)
- [Quick Reference](#quick-reference)

---

## Connection Pooling

### Configuration & Verification

**CONNECTION_POOL_VERIFICATION.md** (10KB)
- Detailed analysis of pool configuration against industry best practices
- Verification of all pool parameters (min, max, timeouts)
- Resource utilization and performance characteristics
- Production readiness checklist
- Scaling recommendations

**Key Topics:**
- Pool size configuration (min: 2, max: 10)
- 4-layer connection leak prevention
- Timeout settings verification
- Environment variable configuration
- Comparison with industry standards

**Related Files:**
- `backend/config/database.ts` - Pool configuration code
- `.env.example` - Environment variable documentation
- `scripts/test-connection-pooling.sh` - Connection pooling tests

---

## Health Checks

### Endpoint Documentation

**HEALTH_CHECK_ENDPOINTS.md** (10KB)
- Complete reference for all health check endpoints
- Pool metrics explanation and interpretation
- Docker health check integration
- Monitoring and alerting examples
- Troubleshooting guide

**Available Endpoints:**
- `GET /_health` - Primary health check with pool metrics
- `GET /_health/ready` - Readiness probe
- `GET /_health/live` - Liveness probe
- `GET /health` (Express) - Multi-layer health check

**HEALTH_CHECK_VERIFICATION.md** (8KB)
- Implementation verification for subtask 4.2
- Health check testing procedures
- Acceptance criteria verification
- Quality checklist

**Related Files:**
- `backend/src/api/health/controllers/health.ts` - Health check implementation
- `scripts/test-health-endpoints.sh` - Health endpoint tests

---

## Backup & Restore

### Backup Procedures

**BACKUP_PROCEDURES.md** (25KB)
- Manual backup procedures with pg_dump
- Automated backup script documentation
- Docker backup methods
- Backup scheduling (cron, Docker Compose, Kubernetes)
- Backup retention policies (GFS strategy)
- Best practices and troubleshooting

**CRON_BACKUP_SETUP.md** (17KB)
- Production cron backup configuration
- Email and webhook notifications
- Monitoring and verification
- Troubleshooting common issues
- Security best practices

**Related Files:**
- `scripts/backup-postgres.sh` - Manual backup script
- `scripts/backup-postgres-cron.sh` - Production cron backup
- `database/backups/` - Backup storage directory

### Restore Procedures

**RESTORE_PROCEDURES.md** (38KB)
- Full database restore procedures
- Point-in-time recovery (PITR) with WAL archiving
- Partial restore (table-level, schema-only)
- Disaster recovery scenarios (5 scenarios)
- Production deployment patterns (blue-green, hot standby)
- Automated verification and testing

**Related Files:**
- `scripts/restore-postgres.sh` - Restore helper script
- `scripts/verify-restore.sh` - Restore verification

### Backup & Restore Testing

**BACKUP_RESTORE_TESTING.md** (21KB)
- Automated testing procedures
- Manual testing guide
- 6 different test scenarios
- Verification checklist
- Troubleshooting guide

**MANUAL_BACKUP_RESTORE_TEST.md** (9KB)
- Step-by-step manual testing procedure
- Expected output examples
- Verification checklist
- Quick reference commands

**Related Files:**
- `scripts/test-backup-restore.sh` - Automated backup/restore tests
- `database/backups/BACKUP_RESTORE_TEST_EXECUTION.md` - Test results

---

## Testing & Verification

### E2E Entity Testing

**E2E_ENTITY_TESTING.md** (11KB)
- End-to-end testing for all 7 content types
- API testing procedures (create, query, verify)
- Relation testing (6 relation types)
- Component structure validation
- CI/CD integration

**E2E_TEST_VERIFICATION.md** (12KB)
- Test execution results
- Coverage analysis
- Acceptance criteria verification
- Troubleshooting guide

**Related Files:**
- `scripts/test-e2e-entities.ts` - TypeScript test script
- `scripts/test-e2e-entities.sh` - Shell wrapper

---

## Quick Reference

### Connection Pooling

```bash
# View pool metrics in real-time
curl http://localhost:1337/_health | jq '.pool'

# Test connection pooling
npm run test:pool-connections

# Monitor pool continuously
watch -n 1 'curl -s http://localhost:1337/_health | jq .pool'
```

### Health Checks

```bash
# Test all health endpoints
npm run test:health

# Check Docker health status
docker ps | grep claude-strapi
docker inspect claude-strapi | jq '.[0].State.Health'
```

### Backup & Restore

```bash
# Create manual backup
bash ./scripts/backup-postgres.sh

# Test backup and restore
npm run test:backup-restore

# Restore from backup
bash ./scripts/restore-postgres.sh database/backups/backup_20260102_120000.sql.gz
```

### E2E Testing

```bash
# Test all entity types
npm run test:e2e-entities

# Verify PostgreSQL tables
npm run verify:tables
```

---

## File Organization

```
docs/database/
├── README.md (this file)
│
├── Connection Pooling
│   ├── CONNECTION_POOL_VERIFICATION.md
│   └── (see also: backend/config/database.ts)
│
├── Health Checks
│   ├── HEALTH_CHECK_ENDPOINTS.md
│   ├── HEALTH_CHECK_VERIFICATION.md
│   └── (see also: backend/src/api/health/)
│
├── Backup & Restore
│   ├── BACKUP_PROCEDURES.md
│   ├── RESTORE_PROCEDURES.md
│   ├── CRON_BACKUP_SETUP.md
│   ├── BACKUP_RESTORE_TESTING.md
│   └── MANUAL_BACKUP_RESTORE_TEST.md
│
├── Testing
│   ├── E2E_ENTITY_TESTING.md
│   └── E2E_TEST_VERIFICATION.md
│
└── Rollback
    └── POSTGRES_ROLLBACK_PROCEDURES.md
```

---

## Environment Variables

All PostgreSQL and connection pooling settings are configurable via environment variables. See `.env.example` for complete documentation.

**Key Variables:**
```bash
# Database Connection
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=claude_agent_ui
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password

# Connection Pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_ACQUIRE_TIMEOUT=60000
DATABASE_IDLE_TIMEOUT=30000
DATABASE_DEBUG=false

# See .env.example for all 9 pool configuration variables
```

---

## Related Documentation

### Project Root
- `README.md` - Project overview and setup
- `.env.example` - Environment variable reference

### Backend
- `backend/config/database.ts` - Database configuration
- `backend/src/api/health/` - Health check API
- `backend/README.md` - Backend documentation

### Migration Tools
- `scripts/migration-tools/README.md` - SQLite to PostgreSQL migration
- `docs/POSTGRES_VERIFICATION_GUIDE.md` - Table verification guide

---

## Support

For issues or questions:
1. Check the relevant documentation above
2. Review troubleshooting sections in each guide
3. Check health endpoints: `http://localhost:1337/_health`
4. Review Docker logs: `docker logs claude-strapi`
5. Consult PostgreSQL logs: `docker logs claude-postgres`

---

**Last Updated:** 2026-01-02
**PostgreSQL Migration:** Completed
**Documentation Version:** 1.0
