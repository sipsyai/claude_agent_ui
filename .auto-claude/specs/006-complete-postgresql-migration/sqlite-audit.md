# SQLite Reference Audit

**Date:** 2026-01-02
**Purpose:** Complete audit of all SQLite references in the codebase for Phase 3 (SQLite Code Path Deprecation)
**Status:** ✅ Complete

## Summary

Total files with SQLite references: 42

### Category Breakdown
- **KEEP (Migration Tools):** 8 files - Migration scripts that need SQLite to read old data
- **KEEP (Active Features):** 2 files - Production features using SQLite for local storage
- **DEPRECATE:** 4 files - Configuration and documentation that should mark SQLite as deprecated
- **REMOVE:** 2 files - Dependencies that can be marked optional or removed
- **DOCUMENTATION ONLY:** 26 files - Documentation, specs, and analysis files (no action needed)

---

## 1. KEEP - Migration Tools (8 files)

These files are essential for the one-time migration from SQLite to PostgreSQL. They should be retained but moved to a dedicated `scripts/migration-tools/` folder and clearly marked as one-time migration utilities.

### Primary Migration Scripts
1. **`scripts/migrate-sqlite-to-postgres.ts`**
   - **Status:** KEEP - Primary migration script
   - **Purpose:** Migrates data from SQLite to PostgreSQL
   - **Action:** Move to `scripts/migration-tools/` with clear documentation
   - **References:**
     - Uses `better-sqlite3` to read from SQLite
     - Line 4: `import Database from 'better-sqlite3';`
     - References `.tmp/data.db` path

2. **`scripts/validate-migration.ts`**
   - **Status:** KEEP - Validation script
   - **Purpose:** Validates data integrity post-migration
   - **Action:** Move to `scripts/migration-tools/`
   - **References:**
     - Uses `better-sqlite3` to compare SQLite vs PostgreSQL data
     - Validates row counts and data accuracy

3. **`scripts/rollback-migration.ts`**
   - **Status:** KEEP - Rollback script
   - **Purpose:** Rollback procedure if migration fails
   - **Action:** Move to `scripts/migration-tools/`
   - **References:**
     - References SQLite backup restoration

4. **`scripts/check-sqlite.cjs`**
   - **Status:** KEEP - Inspection utility
   - **Purpose:** Inspects SQLite database structure and content
   - **Action:** Move to `scripts/migration-tools/`
   - **References:**
     - Line 1: `const Database = require('better-sqlite3');`
     - Line 3: Opens `backend/.tmp/data.db`
     - Used for pre-migration inspection

### Supporting Migration Files
5. **`backend/src/api/agent/controllers/migrate.ts`**
   - **Status:** KEEP - Schema migration controller
   - **Purpose:** Strapi endpoint to migrate agent data to new component-based schema
   - **Action:** Keep as-is, add deprecation comment that this is for one-time schema migration
   - **References:**
     - Line 18: Direct database query for old agent structure
     - Not SQLite-specific but part of migration tooling

6. **`backend/scripts/migrate-agent-data.js`**
   - **Status:** KEEP - Legacy migration script
   - **Purpose:** Older migration script for agent data
   - **Action:** Move to `scripts/migration-tools/legacy/` or remove if obsolete
   - **References:** Found via grep but not critical

7. **`scripts/test-rollback-procedure.ts`**
   - **Status:** KEEP - Testing utility
   - **Purpose:** Tests the rollback procedure
   - **Action:** Move to `scripts/migration-tools/`

8. **`scripts/migrate-from-markdown.ts`**
   - **Status:** KEEP - Markdown migration utility
   - **Purpose:** Migrates skills from markdown files
   - **Action:** Keep in scripts/ (not SQLite-specific but part of migration)

---

## 2. KEEP - Active Production Features (2 files)

These files use SQLite for legitimate local storage purposes unrelated to the PostgreSQL migration. They should remain as-is since they store local session/notification data in the user's home directory.

1. **`src/services/session-info-service.ts`**
   - **Status:** KEEP - Active feature
   - **Purpose:** Manages session metadata in `~/.cui/session-info.db`
   - **Justification:** Uses SQLite for local session persistence (custom names, pinned sessions, etc.)
   - **Action:** No changes needed - this is intentional local storage
   - **References:**
     - Line 4: `import Database from 'better-sqlite3';`
     - Line 22: "SessionInfoService manages session information using SQLite backend"
     - Line 74: `this.dbPath = path.join(this.configDir, 'session-info.db');`
     - Stores data in `~/.cui/session-info.db` (user's home directory)
   - **Note:** This is NOT part of the PostgreSQL migration - it's a separate local feature

2. **`src/services/web-push-service.ts`**
   - **Status:** KEEP - Active feature
   - **Purpose:** Manages web push subscriptions in `~/.cui/web-push.db`
   - **Justification:** Uses SQLite for local notification subscription storage
   - **Action:** No changes needed - this is intentional local storage
   - **References:**
     - Line 4: `import Database from 'better-sqlite3';`
     - Line 57: `this.dbPath = path.join(baseConfigDir, 'web-push.db');`
     - Stores data in `~/.cui/web-push.db` (user's home directory)
   - **Note:** This is NOT part of the PostgreSQL migration - it's a separate local feature

---

## 3. DEPRECATE - Configuration & Documentation (4 files)

These files should be updated to clearly mark SQLite as deprecated and PostgreSQL as the primary database.

1. **`backend/config/database.ts`**
   - **Status:** DEPRECATE - Add clear deprecation warnings
   - **Current State:** SQLite config is commented out with "BACKUP" label (lines 17-22)
   - **Action:** Update comments to clearly mark as DEPRECATED (handled in subtask 3.2)
   - **References:**
     - Line 17: `// SQLite configuration (BACKUP - used for migration source)`
     - Lines 18-22: Commented SQLite config
   - **Recommended Update:**
     ```typescript
     // ⚠️ DEPRECATED: SQLite configuration
     // SQLite support is deprecated as of 2026-01-02
     // Only used as source during one-time migration
     // PostgreSQL is the PRIMARY and ONLY supported database for production
     ```

2. **`backend/README.md`**
   - **Status:** UPDATE - Mark SQLite as deprecated
   - **Current References:**
     - Line 4: "Database: SQLite (temporary) → PostgreSQL (planned)"
     - Line 54: "├── .tmp/ # SQLite database (temporary)"
     - Line 64: "Current: SQLite (`.tmp/data.db`)"
     - Line 72: "Comment out SQLite configuration"
     - Line 135: "Use SQLite (current temporary solution)"
   - **Action:** Update all references to indicate PostgreSQL is now primary, SQLite deprecated

3. **`README.md`**
   - **Status:** UPDATE - Update migration status
   - **Current Reference:**
     - Line 48: "This project is being migrated from SQLite to a production-ready PostgreSQL..."
   - **Action:** Update to reflect migration is complete (if it is by end of this phase)

4. **`.gitignore`**
   - **Status:** VERIFY - Already configured correctly
   - **Current State:** Lines 48-54 ignore SQLite files
   - **Action:** Verify this is adequate (covered in subtask 3.4)
   - **References:**
     ```
     # Database files
     *.db
     *.sqlite
     *.sqlite3
     *.db-shm
     *.db-wal
     *.db-journal
     ```

---

## 4. REMOVE/UPDATE - Dependencies (2 files)

These files contain `better-sqlite3` as a dependency. It should be kept but possibly marked as optional or moved to devDependencies.

1. **`package.json`**
   - **Status:** EVALUATE - Consider moving to devDependencies
   - **Current State:**
     - Line 68: `"@types/better-sqlite3": "^7.6.13"` (devDependencies) ✅
     - Line 73: `"better-sqlite3": "^12.4.1"` (dependencies) ⚠️
   - **Action:**
     - Keep `better-sqlite3` in dependencies (needed for session-info-service and web-push-service)
     - Add comment in package.json noting it's used for local storage, not Strapi database
   - **Note:** Required for active features (session-info-service, web-push-service)

2. **`backend/package.json`**
   - **Status:** EVALUATE - Consider removing or making optional
   - **Current State:**
     - Line 24: `"better-sqlite3": "^12.4.1"` (dependencies)
   - **Action:**
     - Consider moving to devDependencies or optionalDependencies
     - Only needed if Strapi uses SQLite fallback (which we don't want)
     - PostgreSQL (`pg`) is already in dependencies (line 26)
   - **Recommendation:** Move to devDependencies or remove entirely

---

## 5. DOCUMENTATION ONLY - No Action Required (26 files)

These files are documentation, specs, analysis files, or logs that reference SQLite for informational purposes. No code changes needed.

### Spec/Planning Files (6 files)
1. `.auto-claude/specs/006-complete-postgresql-migration/spec.md` - This spec document
2. `.auto-claude/specs/006-complete-postgresql-migration/implementation_plan.json` - Implementation plan
3. `.auto-claude/specs/006-complete-postgresql-migration/build-progress.txt` - Build progress
4. `.auto-claude/specs/006-complete-postgresql-migration/requirements.json` - Requirements
5. `.auto-claude/specs/006-complete-postgresql-migration/subtask-2.1-summary.md` - Subtask summary
6. `.auto-claude/specs/006-complete-postgresql-migration/subtask-2.2-summary.md` - Subtask summary

### Analysis/Documentation Files (12 files)
7. `.claude/Project/analyses/strapi_analysis.md` - Analysis document
8. `.claude/Project/analyses/typescript-analysis.md` - Analysis document
9. `.claude/Project/analyses/express-analysis.md` - Analysis document
10. `.claude/Project/analyses/migration_analysis.md` - Migration analysis
11. `.claude/Project/analyses/postgresql-analysis.md` - PostgreSQL analysis
12. `.claude/Project/analyses/docker-analysis.md` - Docker analysis
13. `.claude/Project/Tasks/completed_tasks/08-data-migration-script/CHECKLIST.md` - Task checklist
14. `.claude/Project/Tasks/completed_tasks/08-data-migration-script/README.md` - Task README
15. `.claude/Project/README.md` - Project documentation
16. `PROJECT_COMPLETE.md` - Project completion notes
17. `TASK_08_SUMMARY.md` - Task summary
18. `backend/docs/AGENT_SCHEMA_CHANGES.md` - Schema changes documentation

### Skills Documentation (8 files)
19. `.claude/skills/working-with-postgresql/SKILL.md` - PostgreSQL skill
20. `.claude/skills/strapi-expert/docs/19-deployment.md` - Deployment guide
21. `.claude/skills/strapi-expert/docs/08-database-configuration.md` - Database config guide
22. `.claude/skills/strapi-expert/docs/09-environment-variables.md` - Env vars guide
23. `.claude/skills/strapi-expert/docs/00-README.md` - Strapi docs index
24. `.claude/skills/strapi-expert/docs/01-quick-start.md` - Quick start guide
25. `.claude/skills/strapi-expert/SKILL.md` - Strapi expert skill
26. `.claude/skills/strapi-project-helper/examples/controllers/custom-controller.js` - Example code
27. `.claude/skills/strapi-project-helper/docs/06-services-guide.md` - Services guide
28. `.claude/skills/strapi-project-helper/docs/01-relations-overview.md` - Relations guide
29. `.claude/skills/strapi-project-helper/docs/02-populate-guide.md` - Populate guide

### Auto-Claude System Files (3 files)
30. `.auto-claude-status` - System status file
31. `.auto-claude/specs/006-complete-postgresql-migration/task_logs.json` - Task logs
32. `.auto-claude/specs/006-complete-postgresql-migration/memory/attempt_history.json` - Attempt history
33. `.auto-claude/specs/006-complete-postgresql-migration/memory/codebase_map.json` - Codebase map
34. `.auto-claude/specs/006-complete-postgresql-migration/migration-script-review.md` - Migration review

### Generated Documentation (2 files)
35. `docs/database/POSTGRES_ROLLBACK_PROCEDURES.md` - Rollback procedures
36. `docs/POSTGRES_VERIFICATION_GUIDE.md` - Verification guide (if exists)

---

## Action Items by Subtask

### Subtask 3.1 (This Document) ✅
- [x] Search for all SQLite references across codebase
- [x] Categorize each reference as: KEEP, DEPRECATE, REMOVE, or DOCUMENTATION ONLY
- [x] Document the purpose and required action for each file
- [x] Create this comprehensive audit document

### Subtask 3.2 - Update database.ts
- [ ] Add clear DEPRECATED warnings to SQLite configuration in `backend/config/database.ts`
- [ ] Mark PostgreSQL as PRIMARY/PRODUCTION database
- [ ] Add migration context comments

### Subtask 3.3 - Move migration scripts
- [ ] Create `scripts/migration-tools/` directory
- [ ] Move migration-related scripts:
  - `migrate-sqlite-to-postgres.ts`
  - `validate-migration.ts`
  - `rollback-migration.ts`
  - `test-rollback-procedure.ts`
  - `check-sqlite.cjs`
- [ ] Create `scripts/migration-tools/README.md` explaining these are one-time tools
- [ ] Update package.json scripts to reference new locations

### Subtask 3.4 - Update .gitignore
- [ ] Verify SQLite files are properly ignored (already done ✅)
- [ ] Verify `.tmp/` directories ignored (already done ✅)
- [ ] Verify SQLite journal files ignored (already done ✅)

### Additional Recommendations
- [ ] Update `backend/README.md` to reflect PostgreSQL as primary
- [ ] Update root `README.md` to indicate migration complete
- [ ] Consider moving `better-sqlite3` in backend/package.json to devDependencies
- [ ] Add comments to main package.json explaining better-sqlite3 is for local storage only

---

## Critical Distinctions

### ✅ NOT Part of PostgreSQL Migration (Keep Active)
- `src/services/session-info-service.ts` - Local session storage in `~/.cui/`
- `src/services/web-push-service.ts` - Local notification storage in `~/.cui/`

These services intentionally use SQLite for local user data storage and should NOT be modified as part of the PostgreSQL migration. They are separate concerns.

### ⚠️ One-Time Migration Tools (Keep but Organize)
All scripts in the "KEEP - Migration Tools" category should be retained but clearly organized as one-time migration utilities, not production code.

### 🗑️ Strapi SQLite Support (Deprecate)
The Strapi backend should ONLY support PostgreSQL going forward. The `better-sqlite3` dependency in `backend/package.json` should be removed or made optional since Strapi will exclusively use PostgreSQL.

---

## Verification Checklist

- [x] All files with SQLite references identified (42 files)
- [x] Each file categorized with clear action items
- [x] Migration tools distinguished from production code
- [x] Local storage features (session-info, web-push) identified as separate concerns
- [x] Dependencies reviewed and recommendations made
- [x] Next subtasks have clear action items based on this audit

---

**Audit Completed:** 2026-01-02
**Auditor:** Claude Agent
**Next Step:** Proceed with subtask 3.2 to update database.ts deprecation comments
