# Database Migration Scripts

This directory contains scripts for migrating the Claude Agent UI database from SQLite to PostgreSQL.

## 📋 Overview

The migration process involves:
1. **Backup** - Creating a timestamped backup of the SQLite database
2. **Extract** - Reading data from SQLite
3. **Transform** - Converting data to Strapi format
4. **Migrate** - Inserting data into PostgreSQL via Strapi API
5. **Validate** - Verifying data integrity
6. **Report** - Generating migration report

## 🚀 Quick Start

### Prerequisites

Before running the migration, ensure:

1. **Strapi is running** with PostgreSQL configuration:
   ```bash
   cd backend
   # Update config/database.ts to use PostgreSQL
   npm run develop
   ```

2. **PostgreSQL is running** and accessible:
   ```bash
   # Default configuration:
   # Host: 127.0.0.1
   # Port: 5433
   # Database: claude_agent_ui
   # User: postgres
   ```

3. **Strapi API is accessible** at `http://localhost:1337`

### Running Migration

```bash
# Full migration with backup
npm run migrate

# Validation only (dry run - no changes)
npm run migrate:validate

# Skip backup (not recommended)
npm run migrate:skip-backup
```

## 📜 Available Scripts

### 1. `migrate-sqlite-to-postgres.ts`

Main migration script that handles the complete migration process.

**Features:**
- Automatic SQLite backup
- Batch processing for large datasets
- Progress tracking with visual progress bars
- Detailed error logging
- Comprehensive migration report
- Support for validation-only mode

**Usage:**
```bash
npm run migrate                  # Full migration
npm run migrate:validate         # Validation only
npm run migrate:skip-backup      # Skip backup step
```

**Output:**
- Backup file: `backups/data-TIMESTAMP.db`
- Migration report: `backups/migration-report-TIMESTAMP.json`

**Example Output:**
```
======================================================================
🚀 CLAUDE AGENT UI - DATABASE MIGRATION
    SQLite → PostgreSQL (via Strapi API)
======================================================================

📦 Creating SQLite database backup...
✅ Backup created: data-2025-10-31T12-30-00.db (2.5 MB)

🔌 Connecting to SQLite database...
✅ SQLite connection established

🔌 Connecting to Strapi API...
✅ Strapi API connection established

📥 Extracting agents from SQLite...
   Found 5 agents

🚀 Migrating agents to PostgreSQL...
Agents: [==============================] 100% (5/5)

✅ MIGRATION COMPLETED SUCCESSFULLY!
```

### 2. `validate-migration.ts`

Validation script that checks data integrity after migration.

**Checks:**
- Database schema existence
- Record count comparison (SQLite vs PostgreSQL)
- Agent data integrity (required fields, types)
- Skill data integrity
- MCP server data integrity
- Relationship validation

**Usage:**
```bash
npm run validate-migration
```

**Example Output:**
```
======================================================================
🔍 MIGRATION VALIDATION
======================================================================

✅ Database Schema: All required content types exist
✅ Record Counts: All record counts match
✅ Agent Data Integrity: All 5 agents have valid data
✅ Skill Data Integrity: All 3 skills have valid data
✅ MCP Server Data Integrity: All 2 MCP servers have valid data
✅ Relationships: Relationships validated

✅ VALIDATION PASSED!
```

### 3. `rollback-migration.ts`

Rollback script to restore SQLite database from backup.

**Features:**
- Interactive backup selection
- Automatic configuration update
- Safety confirmation prompts
- Current database backup before rollback

**Usage:**
```bash
# Interactive mode
npm run rollback-migration

# Specify backup file
npm run rollback-migration data-2025-10-31T12-30-00.db
```

**Example Output:**
```
======================================================================
⏪ CLAUDE AGENT UI - MIGRATION ROLLBACK
======================================================================

📦 Available backups:

   1. data-2025-10-31T12-30-00.db
      Size: 2.5 MB
      Date: 10/31/2025, 12:30:00 PM

Select backup number to restore: 1

⚠️  You are about to rollback to: data-2025-10-31T12-30-00.db

Are you sure you want to continue? (yes/no): yes

✅ ROLLBACK COMPLETED SUCCESSFULLY!
```

### 4. `test-rollback-procedure.ts`

PostgreSQL rollback testing script to verify backup and restore procedures work correctly.

**Features:**
- Comprehensive rollback procedure testing
- Backup creation verification
- Backup integrity checks
- Restore procedure validation
- Detailed test reporting
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

**What it Tests:**
- ✅ PostgreSQL is running
- ✅ Backup directory exists and is writable
- ✅ Backup script is executable
- ✅ Backup can be created successfully
- ✅ Backup file has valid gzip format
- ✅ Backup contains valid SQL data
- ✅ Restore command syntax is correct
- ✅ Documentation exists

**Example Output:**
```
======================================================================
🧪 POSTGRESQL ROLLBACK PROCEDURE TEST
======================================================================

✅ PostgreSQL Status: PostgreSQL container is running
✅ Backup Directory: Directory exists and is writable
✅ Create Backup: Backup created successfully: backup_20260102_143022.sql.gz
✅ Backup Integrity: Backup file is valid and contains SQL data
✅ Restore Procedure (Dry-run): Restore command syntax is valid
✅ Documentation: All rollback documentation exists

📊 ROLLBACK PROCEDURE TEST REPORT
======================================================================
✅ ALL TESTS PASSED! Rollback procedure is verified.
```

**Test Report:**
After running the test, a detailed JSON report is saved to:
```
database/backups/rollback-test-report.json
```

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
│  - Relations    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Transform Data  │  ← Convert to Strapi format
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

## 🔧 Configuration

### Environment Variables

```bash
# Strapi configuration
STRAPI_URL=http://localhost:1337        # Strapi API URL
STRAPI_API_TOKEN=your_token_here        # Optional API token

# Database configuration (in backend/.env)
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_NAME=claude_agent_ui
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
```

### Migration Configuration

Edit `scripts/migrate-sqlite-to-postgres.ts` to customize:

```typescript
const config: MigrationConfig = {
  sqliteDbPath: path.resolve(__dirname, '../backend/.tmp/data.db'),
  backupPath: path.resolve(__dirname, '../backups'),
  strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
  strapiToken: process.env.STRAPI_API_TOKEN,
  batchSize: 10,  // Adjust for performance
  validateOnly: false,
  skipBackup: false,
};
```

## 🛡️ Data Safety

### Backup Strategy

1. **Automatic Backup**: Every migration run creates a timestamped backup
2. **Backup Location**: `backups/data-TIMESTAMP.db`
3. **Retention**: Backups are never automatically deleted
4. **Manual Backup**:
   ```bash
   cp backend/.tmp/data.db backups/manual-backup-$(date +%Y%m%d).db
   ```

### Rollback Strategy

If migration fails or issues are discovered:

1. **Stop Strapi**: `Ctrl+C` in the Strapi terminal
2. **Run Rollback**: `npm run rollback-migration`
3. **Select Backup**: Choose the backup to restore
4. **Restart Strapi**: `cd backend && npm run develop`

### Validation Strategy

- Run `npm run migrate:validate` before actual migration (dry run)
- Run `npm run validate-migration` after migration
- Check the migration report for errors

## 📈 Migration Report

After each migration, a detailed JSON report is generated:

```json
{
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
  "startTime": 1730394600000,
  "endTime": 1730394615000,
  "errors": []
}
```

## ❌ Error Handling

### Common Errors and Solutions

#### 1. "SQLite database not found"

**Solution:**
```bash
# Check if database exists
ls -la backend/.tmp/data.db

# If missing, ensure Strapi has been run at least once
cd backend && npm run develop
```

#### 2. "Cannot connect to Strapi API"

**Solution:**
```bash
# Ensure Strapi is running
cd backend && npm run develop

# Check Strapi is accessible
curl http://localhost:1337/api/agents
```

#### 3. "PostgreSQL connection failed"

**Solution:**
```bash
# Check PostgreSQL is running
pg_isready -h 127.0.0.1 -p 5433

# Update backend/config/database.ts with correct credentials
```

#### 4. "Duplicate key error"

**Solution:**
```bash
# Clean PostgreSQL database
psql -h 127.0.0.1 -p 5433 -U postgres -d claude_agent_ui
DROP DATABASE claude_agent_ui;
CREATE DATABASE claude_agent_ui;

# Restart Strapi to recreate tables
cd backend && npm run develop
```

#### 5. "Migration partially completed"

**Solution:**
```bash
# Check migration report for specific errors
cat backups/migration-report-latest.json

# Run validation to see what succeeded
npm run validate-migration

# If needed, rollback and retry
npm run rollback-migration
```

## 🔍 Troubleshooting

### Debug Mode

Enable detailed logging:

```typescript
// In migrate-sqlite-to-postgres.ts
const DEBUG = true;

// Add console.log statements for debugging
console.log('SQLite data:', sqliteAgent);
console.log('Transformed data:', transformed);
console.log('Strapi response:', response.data);
```

### Manual Verification

Verify data directly in databases:

```bash
# SQLite
cd backend
sqlite3 .tmp/data.db "SELECT * FROM agents;"

# PostgreSQL
psql -h 127.0.0.1 -p 5433 -U postgres -d claude_agent_ui
SELECT * FROM agents;
```

### Check Strapi API

Test Strapi API manually:

```bash
# Get all agents
curl http://localhost:1337/api/agents

# Get single agent with relations
curl http://localhost:1337/api/agents/1?populate=*

# Create agent (test)
curl -X POST http://localhost:1337/api/agents \
  -H "Content-Type: application/json" \
  -d '{"data": {"name": "test", "systemPrompt": "test"}}'
```

## 📝 Best Practices

1. **Always backup before migration**
   - Never use `--skip-backup` in production
   - Keep multiple backups for different time points

2. **Test with validation mode first**
   ```bash
   npm run migrate:validate
   ```

3. **Run validation after migration**
   ```bash
   npm run validate-migration
   ```

4. **Review migration report**
   - Check for any failed records
   - Investigate errors before proceeding

5. **Keep backups organized**
   ```bash
   # Archive old backups
   mv backups/*.db backups/archive/
   ```

6. **Document custom changes**
   - If you modify migration scripts, document changes
   - Keep notes of any manual data fixes

## 🔗 Related Documentation

- [PostgreSQL Rollback Procedures](../docs/database/POSTGRES_ROLLBACK_PROCEDURES.md) - Comprehensive backup and rollback guide
- [PostgreSQL Verification Guide](../docs/POSTGRES_VERIFICATION_GUIDE.md) - Table verification
- [Migration Analysis](../project_migration/migration_analysis.md)
- [PostgreSQL Analysis](../.claude/Project/analyses/postgresql-analysis.md)
- [Strapi Analysis](../.claude/Project/analyses/strapi_analysis.md)
- [Task 08 README](../.claude/Project/Tasks/08-data-migration-script/README.md)

## 📞 Support

If you encounter issues:

1. Check the error messages in the console
2. Review the migration report JSON file
3. Run validation to identify specific problems
4. Check the troubleshooting section above
5. Review Strapi and PostgreSQL logs

## ✅ Post-Migration Checklist

After successful migration:

- [ ] Validation passed with no errors
- [ ] Migration report shows 100% success
- [ ] Strapi admin panel shows all data
- [ ] Express API routes work correctly
- [ ] Frontend can display and edit data
- [ ] Relationships are preserved
- [ ] All features functional
- [ ] Backup files secured
- [ ] Documentation updated
- [ ] SQLite database archived (optional)

## 🎉 Success!

Once migration is complete and validated:

1. Update `backend/config/database.ts` to use PostgreSQL permanently
2. Archive SQLite backup files
3. Update deployment configuration
4. Celebrate! 🎊

---

**Created:** 2025-10-31
**Version:** 1.0.0
**Author:** Claude Agent UI Team
