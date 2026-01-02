# Migration Scripts Moved

> ℹ️ **Migration scripts have been reorganized**

All SQLite to PostgreSQL migration scripts have been moved to:

**`scripts/migration-tools/`**

Please see the comprehensive README there:

**[scripts/migration-tools/README.md](./migration-tools/README.md)**

---

## Quick Links

- **Main Migration Script:** [`migration-tools/migrate-sqlite-to-postgres.ts`](./migration-tools/migrate-sqlite-to-postgres.ts)
- **Validation Script:** [`migration-tools/validate-migration.ts`](./migration-tools/validate-migration.ts)
- **Rollback Script:** [`migration-tools/rollback-migration.ts`](./migration-tools/rollback-migration.ts)
- **Rollback Testing:** [`migration-tools/test-rollback-procedure.ts`](./migration-tools/test-rollback-procedure.ts)
- **SQLite Inspector:** [`migration-tools/check-sqlite.cjs`](./migration-tools/check-sqlite.cjs)

---

## Important Notes

⚠️ **These are ONE-TIME MIGRATION TOOLS** - SQLite is deprecated as of 2026-01-02

✅ **PostgreSQL is now the ONLY supported database** for Claude Agent UI

For full documentation, usage instructions, and troubleshooting, see:
**[scripts/migration-tools/README.md](./migration-tools/README.md)**
