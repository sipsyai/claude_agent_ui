---
name: working-with-postgresql
description: Comprehensive PostgreSQL 18 documentation covering database configuration, connection pooling, indexing strategies, query optimization, backup/restore procedures, high availability, replication, monitoring, and production deployment. Use when working with PostgreSQL databases, configuring connections, optimizing queries, creating indexes, setting up replication, migrating from SQLite, or troubleshooting performance issues.
---

# PostgreSQL 18 Expert

Comprehensive PostgreSQL documentation for database setup, configuration, optimization, and production deployment.

## What This Skill Covers

- **Installation & Setup**: Source installation, configuration, initial setup
- **Configuration**: Server parameters, connections, authentication, security
- **Data Management**: Data types, schema design, constraints
- **Performance**: Indexing strategies, query optimization, EXPLAIN analysis
- **Reliability**: Backup/restore, replication, high availability, disaster recovery
- **Monitoring**: Performance statistics, pg_stat views, troubleshooting
- **Concurrency**: MVCC, transaction isolation, locking mechanisms

## Quick Reference

### Common Tasks

**Installing PostgreSQL**
→ See [docs/02-installation-source.md](docs/02-installation-source.md)

**Configuring Server (postgresql.conf)**
→ See [docs/03-server-configuration.md](docs/03-server-configuration.md)

**Creating Indexes**
→ See [docs/04-indexes.md](docs/04-indexes.md)

**Backup & Restore (pg_dump)**
→ See [docs/05-backup-restore.md](docs/05-backup-restore.md)

**Query Optimization (EXPLAIN)**
→ See [docs/06-performance-tips.md](docs/06-performance-tips.md)

**Setting Up Replication**
→ See [docs/07-high-availability-replication.md](docs/07-high-availability-replication.md)

**Monitoring Performance**
→ See [docs/08-monitoring.md](docs/08-monitoring.md)

**Configuring Authentication (pg_hba.conf)**
→ See [docs/11-authentication.md](docs/11-authentication.md)

**Understanding Data Types**
→ See [docs/09-data-types.md](docs/09-data-types.md)

**Transaction Isolation & MVCC**
→ See [docs/10-concurrency-mvcc.md](docs/10-concurrency-mvcc.md)

---

## Documentation Index

### 🚀 Getting Started

**Initial Setup**
- [Tutorial & Getting Started](docs/01-tutorial-getting-started.md) - PostgreSQL basics, first database
- [Installation from Source](docs/02-installation-source.md) - Build and install PostgreSQL
- [Data Types](docs/09-data-types.md) - Numeric, text, date/time, JSON, arrays

**Configuration Basics**
- [Server Configuration](docs/03-server-configuration.md) - postgresql.conf parameters, tuning
- [Client Authentication](docs/11-authentication.md) - pg_hba.conf, authentication methods

---

### ⚡ Performance & Optimization

**Query Performance**
- [Indexes](docs/04-indexes.md) - B-tree, GIN, GiST, BRIN index types and strategies
- [Performance Tips](docs/06-performance-tips.md) - EXPLAIN, query planning, bulk loading
- [Concurrency Control & MVCC](docs/10-concurrency-mvcc.md) - Transaction isolation, locking

**Monitoring**
- [Monitoring Database Activity](docs/08-monitoring.md) - pg_stat views, statistics, troubleshooting

---

### 🔐 High Availability & Backup

**Data Protection**
- [Backup and Restore](docs/05-backup-restore.md) - pg_dump, PITR, continuous archiving
- [High Availability & Replication](docs/07-high-availability-replication.md) - Streaming replication, failover

---

## How to Use This Skill

### Finding Information

1. **Start with Quick Reference** above for common tasks
2. **Browse by topic** using the Documentation Index
3. **Search specific topics**:
   ```bash
   grep -r "connection pooling" docs/
   grep -r "CREATE INDEX" docs/
   ```

### Migration Context (SQLite → PostgreSQL)

For the Claude Agent UI migration project, follow this order:

1. **Phase 1: Installation** → Read docs 01-02
2. **Phase 2: Configuration** → Read docs 03, 11
3. **Phase 3: Schema Design** → Read docs 09, 04
4. **Phase 4: Optimization** → Read docs 06, 10
5. **Phase 5: Production Setup** → Read docs 05, 07, 08

### Example Workflows

**Setting up PostgreSQL for Strapi:**
1. Read [Installation](docs/02-installation-source.md) for setup
2. Read [Server Configuration](docs/03-server-configuration.md) for connection settings
3. Read [Authentication](docs/11-authentication.md) for pg_hba.conf
4. Read [Data Types](docs/09-data-types.md) for schema planning

**Optimizing database performance:**
1. Read [Performance Tips](docs/06-performance-tips.md) for EXPLAIN usage
2. Read [Indexes](docs/04-indexes.md) for index strategies
3. Read [Monitoring](docs/08-monitoring.md) for performance statistics
4. Read [Concurrency](docs/10-concurrency-mvcc.md) for lock troubleshooting

**Setting up production environment:**
1. Read [Server Configuration](docs/03-server-configuration.md) for production parameters
2. Read [Backup & Restore](docs/05-backup-restore.md) for backup strategy
3. Read [High Availability](docs/07-high-availability-replication.md) for replication
4. Read [Monitoring](docs/08-monitoring.md) for alerting setup

---

## PostgreSQL vs SQLite

### Key Differences for Migration

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Type | File-based | Client-server |
| Concurrency | Limited (write locks) | Excellent (MVCC) |
| Data Types | Dynamic typing | Strong typing |
| Indexes | B-tree only | 6 types (B-tree, GIN, GiST, BRIN, Hash, SP-GiST) |
| JSON | Basic support | Native jsonb with indexing |
| Full-Text Search | Basic FTS5 | Advanced with GIN indexes |
| Replication | None | Built-in streaming replication |
| Connection Pooling | N/A (file access) | Essential (see docs 03) |
| Max Database Size | ~281 TB | Unlimited |
| Production Use | Small apps | Enterprise-scale |

### Migration Considerations

**Connection Pooling:**
Unlike SQLite's direct file access, PostgreSQL uses connections. Configure `max_connections` and pool settings in [Server Configuration](docs/03-server-configuration.md).

**Data Types:**
SQLite's dynamic typing differs from PostgreSQL's strict types. Review [Data Types](docs/09-data-types.md) for proper type mapping.

**Indexes:**
PostgreSQL offers more index types than SQLite. See [Indexes](docs/04-indexes.md) for optimization opportunities.

**Transactions:**
PostgreSQL's MVCC provides better concurrency than SQLite's file locking. See [Concurrency Control](docs/10-concurrency-mvcc.md).

---

## Configuration Examples

### Basic postgresql.conf Settings

```ini
# Connection Settings
listen_addresses = '*'              # Listen on all interfaces
port = 5432                          # Default port
max_connections = 100                # Adjust based on load

# Memory Settings
shared_buffers = 256MB               # 25% of RAM (recommended starting point)
effective_cache_size = 1GB           # 50-75% of RAM
work_mem = 4MB                       # Per-operation memory
maintenance_work_mem = 64MB          # For VACUUM, CREATE INDEX

# WAL Settings
wal_level = replica                  # For replication
max_wal_senders = 10                 # For streaming replication

# Checkpoint Settings
checkpoint_completion_target = 0.9   # Spread out checkpoint I/O
```

### Basic pg_hba.conf

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             all                                     peer

# IPv4 local connections
host    all             all             127.0.0.1/32            scram-sha-256

# IPv4 remote connections (for Strapi)
host    all             all             0.0.0.0/0               scram-sha-256

# IPv6 local connections
host    all             all             ::1/128                 scram-sha-256
```

### Connection String Examples

```bash
# Basic connection
postgresql://username:password@localhost:5432/database_name

# With SSL
postgresql://username:password@localhost:5432/database_name?sslmode=require

# Connection pooling (recommended for Strapi)
postgresql://username:password@localhost:5432/database_name?pool_size=10
```

---

## Index Strategy Guide

### When to Use Each Index Type

**B-tree** (default):
- Equality and range queries
- Sorting operations
- Most common use case

**GIN** (Generalized Inverted Index):
- Full-text search
- JSONB data
- Array containment queries

**GiST** (Generalized Search Tree):
- Geometric data
- Range types
- Custom data types

**BRIN** (Block Range Index):
- Very large tables (>100GB)
- Naturally ordered data (e.g., timestamps)
- Low maintenance overhead

**Hash**:
- Simple equality only
- Rarely used (B-tree usually better)

---

## Production Checklist

### Before Going Live

- [ ] Configure connection pooling (docs 03)
- [ ] Set up authentication (docs 11)
- [ ] Create indexes on frequently queried columns (docs 04)
- [ ] Configure backup strategy (docs 05)
- [ ] Set up replication if needed (docs 07)
- [ ] Configure monitoring (docs 08)
- [ ] Tune memory settings (docs 03)
- [ ] Test disaster recovery procedures (docs 05)
- [ ] Review security settings (docs 11)
- [ ] Set up log rotation (docs 03, section 19.8)

---

## Troubleshooting Guide

### Common Issues

**Slow Queries**
→ [Performance Tips](docs/06-performance-tips.md) - Use EXPLAIN ANALYZE

**Connection Errors**
→ [Server Configuration](docs/03-server-configuration.md) - Check max_connections, pg_hba.conf

**Lock Contention**
→ [Concurrency Control](docs/10-concurrency-mvcc.md) - Review transaction isolation

**Replication Lag**
→ [High Availability](docs/07-high-availability-replication.md) - Check WAL settings

**High Memory Usage**
→ [Server Configuration](docs/03-server-configuration.md) - Tune shared_buffers, work_mem

---

## Additional Resources

For the latest documentation, visit:
**https://www.postgresql.org/docs/18/**

All documentation in this skill is based on **PostgreSQL 18**.

---

## Tips

- **Version Awareness**: This skill covers PostgreSQL 18 (latest)
- **Check Prerequisites**: Requires disk space, proper OS settings
- **Test First**: Always test configuration changes in development
- **Monitor Performance**: Use pg_stat views regularly
- **Backup Regularly**: Automate backups before production
- **Use Connection Pooling**: Essential for web applications like Strapi
