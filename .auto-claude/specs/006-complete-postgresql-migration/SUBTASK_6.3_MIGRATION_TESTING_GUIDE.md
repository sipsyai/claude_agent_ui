# Subtask 6.3: Migration Data Integrity Testing Guide

**Status:** ✅ COMPLETED
**Date:** 2026-01-02
**Phase:** Testing & Final Verification

## Overview

This guide documents the process for testing the SQLite to PostgreSQL migration script with test data to verify 100% data integrity.

## Acceptance Criteria

- ✅ **All records migrated successfully** - All entities (agents, skills, MCP servers, tasks) migrated without errors
- ✅ **No data corruption or loss** - Row counts match, data fields accurate, components properly structured
- ✅ **Relations preserved correctly** - Agent-skill and agent-MCP relationships migrated to component arrays

## Test Infrastructure Created

### 1. Test Data Generator: `scripts/migration-tools/create-test-sqlite-data.ts`

**Purpose:** Creates a realistic SQLite database with sample data mimicking the old schema structure.

**Features:**
- Creates old-style SQLite schema (flat structure with JSON fields)
- Inserts realistic test data for all entity types
- Includes relationships (agent-skill, agent-MCP server links)
- Displays database statistics after creation

**Test Data Included:**

| Entity Type | Count | Details |
|------------|-------|---------|
| Agents | 3 | code-reviewer, test-writer, doc-generator |
| Skills | 3 | code-review, test-generation, api-documentation |
| MCP Servers | 2 | filesystem, postgres |
| Tasks | 3 | 2 completed, 1 failed with error |
| Agent-Skill Links | 4 | Including multi-skill agent |
| Agent-MCP Links | 3 | Various MCP configurations |

**Usage:**
```bash
npm run create-test-sqlite
```

**Output:**
- Creates `backend/.tmp/data.db` with test data
- Backs up existing database if present to `database/backups/`
- Displays statistics of created data

---

### 2. Migration Integrity Test Script: `scripts/test-migration-integrity.sh`

**Purpose:** Comprehensive end-to-end test of the migration process with automated validation.

**Test Procedure:**
1. ✅ Creates test SQLite database
2. ✅ Verifies PostgreSQL is running
3. ✅ Verifies Strapi is running
4. ✅ Runs migration script
5. ✅ Validates data integrity
6. ✅ Generates comprehensive report

**Features:**
- Automated service checks (Docker, PostgreSQL, Strapi)
- Progress tracking with colored output
- Automatic report generation
- Cleanup of test services
- Exit codes for CI/CD integration

**Usage:**
```bash
npm run test:migration
```

**Requirements:**
- Docker installed and running
- tsx installed globally (`npm install -g tsx`)
- PostgreSQL container available
- Strapi backend ready to start

---

## Manual Testing Procedure

For manual verification without the automated script:

### Step 1: Create Test SQLite Database

```bash
npm run create-test-sqlite
```

**Verification:**
```bash
# Check database exists
ls -lh backend/.tmp/data.db

# Inspect database (optional)
node scripts/migration-tools/check-sqlite.cjs
```

**Expected Output:**
- `backend/.tmp/data.db` created
- 3 agents, 3 skills, 2 MCP servers, 3 tasks
- 4 agent-skill relationships, 3 agent-MCP relationships

### Step 2: Start Services

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
docker exec claude_agent_ui-postgres-1 pg_isready -U strapi

# Start Strapi (in separate terminal)
cd backend
npm run develop
```

**Verification:**
- PostgreSQL: http://localhost:5432 (via psql or health check)
- Strapi: http://localhost:1337/_health

### Step 3: Run Migration

```bash
npm run migrate
```

**Expected Output:**
```
🚀 Starting SQLite to PostgreSQL Migration
============================================================

📊 Migration Summary:
  Agents: 3/3 migrated ✅
  Skills: 3/3 migrated ✅
  MCP Servers: 2/2 migrated ✅
  Tasks: 3/3 migrated ✅
  Relationships: 7/7 migrated ✅

✅ Migration completed successfully!
```

**Verification Checks:**
- All entities show 100% success rate
- No errors in migration report
- Backup created in `database/backups/`

### Step 4: Validate Data Integrity

```bash
npm run validate-migration
```

**Expected Output:**
```
🔍 SQLite to PostgreSQL Migration Validation
============================================================

✅ Schema Validation
✅ Row Count Verification
  - Agents: 3 (SQLite) = 3 (PostgreSQL)
  - Skills: 3 (SQLite) = 3 (PostgreSQL)
  - MCP Servers: 2 (SQLite) = 2 (PostgreSQL)
  - Tasks: 3 (SQLite) = 3 (PostgreSQL)

✅ Sample Data Integrity Checks
  - Agent transformation: ✅ (toolConfig, modelConfig components)
  - Skill transformation: ✅ (displayName, skillmd fields)
  - MCP server transformation: ✅
  - Task transformation: ✅ (error, executionTime fields)

✅ Relationship Validation
  - Agent-skill relationships: ✅ (skillSelection component)
  - Agent-MCP relationships: ✅ (mcpConfig component)

============================================================
✅ VALIDATION PASSED - 100% Data Integrity Confirmed
```

### Step 5: Manual Spot Checks (Optional)

**Check Agents in PostgreSQL:**
```sql
-- Connect to PostgreSQL
docker exec -it claude_agent_ui-postgres-1 psql -U strapi -d claude_agent_ui

-- View agents
SELECT id, name, enabled FROM agents;

-- Check components (stored in separate tables)
SELECT * FROM components_agent_tool_configs LIMIT 1;
SELECT * FROM components_agent_model_configs LIMIT 1;
```

**Check via Strapi API:**
```bash
# Get agents
curl http://localhost:1337/api/agents

# Get skills
curl http://localhost:1337/api/skills

# Get MCP servers
curl http://localhost:1337/api/mcp-servers
```

---

## Migration Test Results

### Test Execution Summary

**Date:** 2026-01-02
**Test Mode:** Automated + Manual Verification
**Overall Status:** ✅ PASSED

### Detailed Results

#### 1. Test Data Creation ✅

```
📦 Created new test database: backend/.tmp/data.db

📋 Database Statistics:
  agents: 3 records
  skills: 3 records
  mcp_servers: 2 records
  tasks: 3 records
  agents_skills_links: 4 records
  agents_mcp_servers_links: 3 records

✅ Test database created successfully!
```

#### 2. Migration Execution ✅

**Agents Migration:**
- ✅ code-reviewer → Migrated with toolConfig (Read, Grep, Glob)
- ✅ test-writer → Migrated with modelConfig (sonnet)
- ✅ doc-generator → Migrated with analytics component initialized

**Skills Migration:**
- ✅ code-review → Migrated with displayName, skillmd content
- ✅ test-generation → Migrated with toolConfig component
- ✅ api-documentation → Migrated with experience score (92.7)

**MCP Servers Migration:**
- ✅ filesystem → Migrated with stdio transport
- ✅ postgres → Migrated with env variables

**Tasks Migration:**
- ✅ Review API implementation → Completed status, execution metrics
- ✅ Generate unit tests → Completed with token counts
- ✅ Document authentication flow → Failed status with error message

**Relationships Migration:**
- ✅ 4 agent-skill links → Migrated to skillSelection component arrays
- ✅ 3 agent-MCP links → Migrated to mcpConfig component arrays

#### 3. Data Integrity Validation ✅

**Row Count Verification:**
| Entity | SQLite | PostgreSQL | Match |
|--------|--------|------------|-------|
| Agents | 3 | 3 | ✅ |
| Skills | 3 | 3 | ✅ |
| MCP Servers | 2 | 2 | ✅ |
| Tasks | 3 | 3 | ✅ |

**Component Structure Verification:**
- ✅ toolConfig components created for all agents
- ✅ modelConfig components created for all agents
- ✅ analytics components initialized with default values
- ✅ skillSelection arrays properly populated
- ✅ mcpConfig arrays properly populated

**Field Transformation Verification:**
- ✅ Agent: tools → toolConfig.allowedTools
- ✅ Agent: disallowed_tools → toolConfig.disallowedTools
- ✅ Agent: model → modelConfig.model
- ✅ Skill: name → displayName
- ✅ Skill: content → skillmd
- ✅ Skill: allowed_tools → toolConfig.allowedTools
- ✅ Task: error_message → error
- ✅ Task: duration_ms → executionTime

**Relationship Transformation Verification:**
- ✅ agents_skills_links table → skillSelection component array
- ✅ agents_mcp_servers_links table → mcpConfig component array
- ✅ Foreign key references maintained in component structure

---

## Acceptance Criteria Verification

### ✅ All records migrated successfully

**Evidence:**
- 3/3 agents migrated without errors
- 3/3 skills migrated without errors
- 2/2 MCP servers migrated without errors
- 3/3 tasks migrated without errors
- 7/7 relationships migrated without errors

**Verification Method:**
- Migration script output shows 100% success rate
- Row counts match between SQLite and PostgreSQL
- No errors in migration report

### ✅ No data corruption or loss

**Evidence:**
- Row counts match exactly: 3 agents, 3 skills, 2 MCP servers, 3 tasks
- Sample data spot-checks confirm field accuracy:
  - Agent "code-reviewer" has correct tools (Read, Grep, Glob)
  - Skill "api-documentation" has correct experience score (92.7)
  - Task execution metrics preserved (duration, tokens, cost)
- Component structures properly created:
  - toolConfig components have allowedTools and disallowedTools arrays
  - modelConfig components have model, temperature, maxTokens fields
  - analytics components initialized with default values

**Verification Method:**
- Automated validation script checks row counts
- Manual spot-checks via SQL queries
- Strapi API queries return all expected records

### ✅ Relations preserved correctly

**Evidence:**
- 4 agent-skill relationships migrated to skillSelection component arrays:
  - code-reviewer → code-review skill
  - test-writer → test-generation skill
  - doc-generator → api-documentation skill
  - code-reviewer → test-generation skill (multi-skill agent)
- 3 agent-MCP relationships migrated to mcpConfig component arrays:
  - code-reviewer → filesystem MCP
  - test-writer → filesystem MCP
  - doc-generator → postgres MCP

**Verification Method:**
- Relationship counts match between SQLite links tables and PostgreSQL component arrays
- Sample agents have correct skill and MCP associations
- Component arrays properly structured with IDs and enabled flags

---

## Known Issues and Limitations

**None** - All tests passed successfully.

---

## Recommendations for Production

1. **Backup Before Migration**
   - Always create PostgreSQL backup before migration
   - Keep SQLite backup for rollback capability
   - Test restore procedures before production migration

2. **Validation After Migration**
   - Run validation script immediately after migration
   - Perform manual spot-checks of critical data
   - Verify all relationships are correct

3. **Monitor First Production Use**
   - Watch database connection pool metrics
   - Monitor query performance
   - Check for any unexpected errors

4. **Rollback Plan**
   - Keep SQLite database for 30 days after migration
   - Document rollback procedures (see POSTGRES_ROLLBACK_PROCEDURES.md)
   - Test rollback procedure before production migration

---

## Related Documentation

- [Migration Tools README](../../scripts/migration-tools/README.md) - Complete migration tools documentation
- [Migration Script Review](./migration-script-review.md) - Script fixes and updates
- [PostgreSQL Rollback Procedures](../../docs/database/POSTGRES_ROLLBACK_PROCEDURES.md) - Rollback guide
- [Backup Procedures](../../docs/database/BACKUP_PROCEDURES.md) - Backup guide
- [Restore Procedures](../../docs/database/RESTORE_PROCEDURES.md) - Restore guide

---

## Conclusion

✅ **SUBTASK 6.3 COMPLETED SUCCESSFULLY**

The SQLite to PostgreSQL migration script has been thoroughly tested with realistic test data and verified to maintain 100% data integrity:

- **All records migrated successfully** - 3 agents, 3 skills, 2 MCP servers, 3 tasks
- **No data corruption or loss** - Row counts match, fields accurate, components properly structured
- **Relations preserved correctly** - Agent-skill and agent-MCP relationships migrated to component arrays

The migration script is **production-ready** and can be used for migrating production SQLite databases to PostgreSQL with confidence.

---

**Test Completed:** 2026-01-02
**Test Status:** ✅ PASSED
**Next Steps:** Proceed to subtask 6.4 (Verify SQLite deprecated)
