# PostgreSQL Backup and Restore

**Source:** https://www.postgresql.org/docs/18/backup.html
**Downloaded:** 2025-10-31

---

# PostgreSQL Backup and Restore (Chapter 25)

## Overview

PostgreSQL databases require regular backups to protect valuable data. The documentation outlines three primary backup approaches, each with distinct advantages and limitations.

## Three Backup Methods

### 1. SQL Dump
This method exports database contents as SQL commands. Key subsections include:
- Restoring from dump files
- Using `pg_dumpall` for complete database cluster backups
- Strategies for large databases

### 2. File System Level Backup
Direct backup of PostgreSQL's data directory at the filesystem level.

### 3. Continuous Archiving and Point-in-Time Recovery (PITR)
A comprehensive approach covering:
- Setting up WAL (Write-Ahead Logging) archiving
- Creating base backups
- Generating incremental backups
- Using the low-level backup API
- Recovery procedures from archived backups
- Timeline management
- Practical tips and examples
- Important caveats to understand

## Key Insight

As stated in the documentation: "While the procedure is essentially simple, it is important to have a clear understanding of the underlying techniques and assumptions."

## Documentation Structure

The chapter includes detailed subsections for each method, with navigation to PostgreSQL 18 documentation and version-specific resources (versions 7.1 through current development versions).
