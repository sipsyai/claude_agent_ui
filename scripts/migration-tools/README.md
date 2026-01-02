# SQLite to PostgreSQL Migration Tools

> ⚠️ **ONE-TIME MIGRATION TOOLS - DEPRECATED FOR PRODUCTION USE**
>
> These scripts were used for the one-time migration from SQLite to PostgreSQL completed on **2026-01-02**.
>
> **PostgreSQL is now the ONLY supported database** for Claude Agent UI. SQLite support has been deprecated.
>
> These tools are preserved for:
> - Historical reference
> - Emergency data recovery
> - Development/testing environments that need to migrate legacy data
>
> **DO NOT use these scripts in production unless you are migrating from a legacy SQLite installation.**

---

## 📋 Overview

This directory contains the complete toolset for migrating Claude Agent UI database from SQLite to PostgreSQL. The migration was successfully completed on 2026-01-02 as part of the transition to a production-ready PostgreSQL setup.

### Migration Status: ✅ COMPLETED

The PostgreSQL migration is complete. All Strapi content types now use PostgreSQL exclusively:
- ✅ Agents
- ✅ Skills
- ✅ MCP Servers
- ✅ Tasks
- ✅ Chat Sessions
- ✅ Chat Messages
- ✅ MCP Tools

## 🔧 Tools Included

### 1. `migrate-sqlite-to-postgres.ts` - Main Migration Script

**Purpose:** One-time migration of all data from SQLite to PostgreSQL via Strapi API

**Features:**
- Automatic SQLite database backup before migration
- Batch processing for large datasets
- Progress tracking with visual progress bars
- Comprehensive error handling and logging
- Detailed migration report generation
- Validation-only mode (dry run)

**Usage:**
```bash
# From project root
npm run migrate                  # Full migration with backup
npm run migrate:validate         # Validation only (no changes)
npm run migrate:skip-backup      # Skip backup (NOT recommended)
```

**Output Files:**
- Backup: `database/backups/data-TIMESTAMP.db`
- Report: `database/backups/migration-report-TIMESTAMP.json`

---

### 2. `validate-migration.ts` - Post-Migration Validation

**Purpose:** Verify data integrity after migration by comparing SQLite and PostgreSQL data

**Features:**
- Database schema validation
- Record count comparison (SQLite vs PostgreSQL)
- Sample data integrity checks (spot-checking)
- Relationship validation
- Comprehensive validation reporting

**Usage:**
```bash
npm run validate-migration
```

**Validation Checks:**
- ✅ All required PostgreSQL tables exist
- ✅ Record counts match between databases
- ✅ Sample records have correct data types and values
- ✅ Relations are properly established
- ✅ Required fields are populated

---

### 3. `rollback-migration.ts` - SQLite Rollback Tool

**Purpose:** Restore SQLite database from backup if migration issues occur

> ⚠️ **Note:** This script is for rolling back to SQLite, not PostgreSQL. For PostgreSQL rollback, see [`database/backups/README.md`](../../database/backups/README.md)

**Features:**
- Interactive backup file selection
- Safety confirmation prompts
- Automatic Strapi configuration update
- Current database backup before rollback

**Usage:**
```bash
# Interactive mode
npm run rollback-migration

# Specify backup file
npm run rollback-migration -- data-2025-10-31T12-30-00.db
```

---

### 4. `test-rollback-procedure.ts` - PostgreSQL Rollback Testing

**Purpose:** Verify PostgreSQL backup and restore procedures work correctly

**Features:**
- Comprehensive rollback procedure testing
- Backup creation verification
- Backup integrity validation
- Restore command testing
- Dry-run mode for safe testing

**Usage:**
```bash
# Test in dry-run mode (recommended)
npm run test:rollback -- --dry-run

# Test with actual restore (use with caution!)
npm run test:rollback

# Verbose output
npm run test:rollback -- --dry-run --verbose
```

**What It Tests:**
- ✅ PostgreSQL container is running
- ✅ Backup directory exists and is writable
- ✅ Backup script is executable
- ✅ Backup creation succeeds
- ✅ Backup file has valid format (gzip)
- ✅ Backup contains valid SQL data
- ✅ Restore command syntax is correct
- ✅ Documentation exists

---

### 5. `check-sqlite.cjs` - SQLite Database Inspector

**Purpose:** Inspect SQLite database structure and content before migration

**Features:**
- Display database schema
- Show table row counts
- List all tables and columns
- Useful for pre-migration analysis

**Usage:**
```bash
node scripts/migration-tools/check-sqlite.cjs
```

**Output:**
```
SQLite Database: backend/.tmp/data.db
Tables:
  - agents (5 rows)
  - skills (3 rows)
  - mcp_servers (2 rows)
  ...
```

---

## 📊 Migration Process Flow

```
┌─────────────────┐
│  Start          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backup SQLite  │  ← Creates timestamped backup
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Extract Data   │  ← Read from SQLite
│  - Agents       │
│  - Skills       │
│  - MCP Servers  │
│  - Tasks        │
│  - Chat Data    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Transform Data  │  ← Convert to PostgreSQL/Strapi format
│  - Components   │     (modelConfig, toolConfig, etc.)
│  - Relations    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Migrate to PG   │  ← Insert via Strapi API
│  via Strapi API │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Migrate         │  ← Link agents to skills/MCPs
│ Relations       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate Data   │  ← Check integrity
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Report │  ← Save JSON report
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Complete       │
└─────────────────┘
```

## 🚀 Quick Start Guide

### Prerequisites

1. **Strapi running with PostgreSQL:**
   ```bash
   cd backend
   npm run develop
   ```

2. **PostgreSQL accessible:**
   - Host: 127.0.0.1
   - Port: 5433
   - Database: claude_agent_ui

3. **Strapi API accessible:**
   - URL: http://localhost:1337

### Running the Migration

```bash
# 1. Test migration (dry run - no changes)
npm run migrate:validate

# 2. Review output and ensure validation passes

# 3. Run actual migration (creates backup automatically)
npm run migrate

# 4. Validate migration succeeded
npm run validate-migration

# 5. Review migration report
cat database/backups/migration-report-*.json
```

## 🛡️ Safety & Best Practices

### ✅ DO

1. **Always run validation first:**
   ```bash
   npm run migrate:validate
   ```

2. **Verify backups exist:**
   ```bash
   ls -lh database/backups/
   ```

3. **Run post-migration validation:**
   ```bash
   npm run validate-migration
   ```

4. **Review migration reports:**
   ```bash
   cat database/backups/migration-report-*.json
   ```

5. **Test PostgreSQL rollback procedure:**
   ```bash
   npm run test:rollback -- --dry-run
   ```

### ❌ DON'T

1. **Never skip backups in production**
2. **Don't run migration on production without testing**
3. **Don't delete backup files immediately**
4. **Don't modify scripts without understanding the schema**

## 📈 Migration Report

After migration, a detailed JSON report is generated with statistics:

```json
{
  "timestamp": "2026-01-02T12:30:00.000Z",
  "status": "success",
  "duration_ms": 15000,
  "agents": {
    "total": 5,
    "success": 5,
    "failed": 0,
    "skipped": 0
  },
  "skills": {
    "total": 3,
    "success": 3,
    "failed": 0,
    "skipped": 0
  },
  "mcpServers": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "skipped": 0
  },
  "tasks": {
    "total": 10,
    "success": 10,
    "failed": 0,
    "skipped": 0
  },
  "relations": {
    "agentsSkills": 7,
    "agentsMcpServers": 4
  },
  "errors": []
}
```

## ❌ Troubleshooting

### Common Issues

#### 1. "SQLite database not found"

```bash
# Check if database exists
ls -la backend/.tmp/data.db

# Ensure Strapi has run at least once with SQLite
cd backend && npm run develop
```

#### 2. "Cannot connect to Strapi API"

```bash
# Ensure Strapi is running
cd backend && npm run develop

# Test API connection
curl http://localhost:1337/api/agents
```

#### 3. "PostgreSQL connection failed"

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Verify connection
psql -h 127.0.0.1 -p 5433 -U postgres -d claude_agent_ui -c "SELECT 1"
```

#### 4. "Duplicate key error"

This means PostgreSQL already has data. To start fresh:

```bash
# WARNING: This deletes all PostgreSQL data
docker-compose down -v
docker-compose up -d postgres

# Wait for PostgreSQL to start, then restart Strapi
cd backend && npm run develop
```

#### 5. "Migration partially completed"

```bash
# Check what succeeded
npm run validate-migration

# Review migration report
cat database/backups/migration-report-*.json

# If needed, restore PostgreSQL from backup
# See: database/backups/README.md
```

## 🔗 Related Documentation

- [PostgreSQL Rollback Procedures](../../docs/database/POSTGRES_ROLLBACK_PROCEDURES.md) - PostgreSQL backup/restore
- [PostgreSQL Verification Guide](../../docs/POSTGRES_VERIFICATION_GUIDE.md) - Table verification
- [Database Backup README](../../database/backups/README.md) - PostgreSQL backup instructions
- [Migration Analysis](../../.auto-claude/specs/006-complete-postgresql-migration/migration-script-review.md)

## 📝 Technical Details

### Schema Mapping

The migration handles the transition from SQLite's flat schema to PostgreSQL's component-based schema:

**Agents:**
- `tools` → `toolConfig` component (name, enabled, description)
- `model` → `modelConfig` component (provider, name, temperature, etc.)
- Direct foreign keys → `skillSelection` and `mcpConfig` component arrays

**Skills:**
- `content` → `skillmd`
- Added `displayName` field
- Updated relation structure

**Tasks:**
- `errorMessage` → `error`
- `durationMs` → `executionTime`
- Updated timestamp handling

### Dependencies

These scripts require:
- `better-sqlite3` - SQLite database access
- `pg` - PostgreSQL client (via Strapi)
- `axios` - HTTP requests to Strapi API
- `tsx` - TypeScript execution

## ⚠️ Important Notes

### SQLite Deprecation

As of 2026-01-02, SQLite is **DEPRECATED** for Strapi database storage:

- ✅ **PostgreSQL**: ONLY supported database for production
- ⚠️ **SQLite**: Only for legacy data migration
- ℹ️ **Local Storage**: SQLite still used for session info (`~/.cui/session-info.db`) and web push (`~/.cui/web-push.db`) - these are SEPARATE features

### When to Use These Tools

**Use these tools if:**
- ✅ Migrating from legacy SQLite installation
- ✅ Recovering data from old SQLite backups
- ✅ Development/testing data migration

**DO NOT use if:**
- ❌ Setting up a new installation (use PostgreSQL from start)
- ❌ Already on PostgreSQL
- ❌ In production (unless migrating legacy data)

### Backup Retention

Migration backups should be retained for:
- **30 days minimum** after migration
- **Indefinitely** if disk space permits
- Archive to external storage for long-term retention

## 📞 Support

If you encounter issues during migration:

1. ✅ Check error messages in console output
2. ✅ Review migration report JSON file
3. ✅ Run validation to identify specific problems
4. ✅ Check troubleshooting section above
5. ✅ Review Strapi and PostgreSQL logs
6. ✅ Consult related documentation

---

**Migration Completed:** 2026-01-02
**PostgreSQL Status:** ✅ Active (ONLY supported database)
**SQLite Status:** ⚠️ Deprecated (legacy migration only)
**Tools Status:** 📦 Archived (one-time use)

**Next Steps:**
- For PostgreSQL backups: See `database/backups/README.md`
- For PostgreSQL verification: Run `npm run verify:tables`
- For rollback procedures: See `docs/database/POSTGRES_ROLLBACK_PROCEDURES.md`
