# PostgreSQL Monitoring Database Activity

**Source:** https://www.postgresql.org/docs/18/monitoring.html
**Downloaded:** 2025-10-31

---

# PostgreSQL 27: Monitoring Database Activity

## Overview

PostgreSQL's monitoring chapter addresses a fundamental question for database administrators: "What is the system doing right now?" The documentation provides comprehensive guidance on observing database performance and activity.

## Key Monitoring Tools

The chapter recommends leveraging both PostgreSQL-specific tools and standard Unix utilities:

- **Unix monitoring programs**: `ps`, `top`, `iostat`, and `vmstat` provide system-level insights
- **PostgreSQL query analysis**: The `EXPLAIN` command helps investigate poorly-performing queries
- **Cumulative statistics system**: PostgreSQL's primary monitoring framework

## Main Section Breakdown

### Section 27.1: Standard Unix Tools
Covers traditional operating system monitoring utilities for database performance assessment.

### Section 27.2: Cumulative Statistics System
The chapter's largest section, encompassing:

- **Statistics collection configuration** and viewing mechanisms
- **Key system views** including:
  - `pg_stat_activity` - current session information
  - `pg_stat_replication` - replication status
  - `pg_stat_database` - database-level statistics
  - `pg_stat_all_tables` and `pg_stat_all_indexes` - object performance metrics
  - `pg_stat_bgwriter`, `pg_stat_checkpointer` - background process statistics
  - `pg_statio_*` views - I/O performance data

### Sections 27.3-27.6
Additional monitoring capabilities including lock viewing, progress reporting for VACUUM, COPY, and other operations, dynamic tracing, and disk usage monitoring.
