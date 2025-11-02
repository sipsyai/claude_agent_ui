# PostgreSQL Database Analysis for Claude Agent UI Migration

**Project:** Claude Agent UI - SQLite to PostgreSQL Migration
**Target Database:** PostgreSQL 16/18
**Target Architecture:** Strapi + PostgreSQL + Express (Hybrid)
**Analysis Date:** 2025-01-20
**PostgreSQL Version:** 16+ (Production) / 18 (Latest Features)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Schema Design](#database-schema-design)
3. [Index Strategies](#index-strategies)
4. [Connection Pooling Configuration](#connection-pooling-configuration)
5. [Complete Migration Script](#complete-migration-script)
6. [Performance Optimization Strategies](#performance-optimization-strategies)
7. [Production Deployment Checklist](#production-deployment-checklist)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Disaster Recovery](#disaster-recovery)
10. [Security Hardening](#security-hardening)

---

## Executive Summary

### Migration Overview

This document provides a comprehensive PostgreSQL-focused analysis for migrating the Claude Agent UI from SQLite to PostgreSQL. The migration involves:

- **Source Database:** SQLite (file-based, limited concurrency)
- **Target Database:** PostgreSQL 16+ (client-server, MVCC, enterprise-grade)
- **Data Entities:** Agents, Skills, MCP Servers, Tasks, Relations
- **Key Requirements:** High concurrency, JSONB support, full-text search, replication capability

### Key PostgreSQL Advantages for This Project

| Feature | Benefit |
|---------|---------|
| **MVCC (Multi-Version Concurrency Control)** | Multiple concurrent reads/writes without blocking |
| **Native JSONB** | Efficient storage and querying of JSON data (tools, args, env) |
| **GIN Indexes** | Fast full-text search and JSONB queries |
| **Streaming Replication** | High availability and disaster recovery |
| **Connection Pooling** | Handle hundreds of concurrent Strapi/Express connections |
| **Advanced Indexes** | B-tree, GIN, GiST, BRIN for different query patterns |
| **Constraint System** | Data integrity with foreign keys, check constraints |
| **Transaction Isolation** | Proper ACID compliance with configurable isolation levels |

### Critical Success Factors

1. ✅ **Proper indexing strategy** for Agent/Skill/MCP lookups
2. ✅ **Connection pooling** configured for Strapi's connection patterns
3. ✅ **JSONB optimization** for tools, args, env fields
4. ✅ **Foreign key constraints** for referential integrity
5. ✅ **Backup strategy** with point-in-time recovery
6. ✅ **Monitoring setup** for query performance tracking

---

## Database Schema Design

### 1. Agents Table

```sql
-- ============================================
-- AGENTS TABLE
-- Core entity for Claude agents
-- ============================================

CREATE TABLE agents (
    -- Primary Key
    id SERIAL PRIMARY KEY,

    -- Core Fields
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    system_prompt TEXT NOT NULL,

    -- JSON Fields (use JSONB for indexing and query performance)
    tools JSONB DEFAULT '[]'::jsonb,
    disallowed_tools JSONB DEFAULT '[]'::jsonb,

    -- Enumerations
    model VARCHAR(20) NOT NULL DEFAULT 'sonnet'
        CHECK (model IN ('sonnet', 'opus', 'haiku', 'sonnet-4', 'opus-4')),

    -- Status
    enabled BOOLEAN DEFAULT true NOT NULL,

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Strapi Metadata
    published_at TIMESTAMP WITH TIME ZONE,
    locale VARCHAR(10)
);

-- Comments for documentation
COMMENT ON TABLE agents IS 'Claude agents with tools and skills configuration';
COMMENT ON COLUMN agents.tools IS 'Array of allowed tool names (JSONB for GIN indexing)';
COMMENT ON COLUMN agents.disallowed_tools IS 'Array of explicitly disallowed tool names';
COMMENT ON COLUMN agents.system_prompt IS 'System prompt that defines agent behavior';
COMMENT ON COLUMN agents.model IS 'Claude model to use (sonnet, opus, haiku, etc.)';

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2. Skills Table

```sql
-- ============================================
-- SKILLS TABLE
-- Reusable skill definitions for agents
-- ============================================

CREATE TABLE skills (
    -- Primary Key
    id SERIAL PRIMARY KEY,

    -- Core Fields
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    content TEXT NOT NULL,

    -- Configuration
    allowed_tools JSONB DEFAULT '[]'::jsonb,
    experience_score NUMERIC(5,2) DEFAULT 0.00 NOT NULL
        CHECK (experience_score >= 0 AND experience_score <= 100),

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Strapi Metadata
    published_at TIMESTAMP WITH TIME ZONE,
    locale VARCHAR(10)
);

-- Comments
COMMENT ON TABLE skills IS 'Reusable skills that can be assigned to agents';
COMMENT ON COLUMN skills.content IS 'Skill prompt content (markdown format)';
COMMENT ON COLUMN skills.experience_score IS 'Experience score from 0-100 based on training';
COMMENT ON COLUMN skills.allowed_tools IS 'Array of tools this skill can use';

-- Trigger
CREATE TRIGGER update_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 3. MCP Servers Table

```sql
-- ============================================
-- MCP SERVERS TABLE
-- Model Context Protocol server configurations
-- ============================================

CREATE TABLE mcp_servers (
    -- Primary Key
    id SERIAL PRIMARY KEY,

    -- Core Fields
    name VARCHAR(100) NOT NULL UNIQUE,
    command VARCHAR(500) NOT NULL,

    -- Configuration (JSONB for flexible structure)
    args JSONB DEFAULT '[]'::jsonb,
    env JSONB DEFAULT '{}'::jsonb,

    -- Status
    disabled BOOLEAN DEFAULT false NOT NULL,

    -- Transport Type
    transport VARCHAR(20) DEFAULT 'stdio' NOT NULL
        CHECK (transport IN ('stdio', 'sse', 'http')),

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Strapi Metadata
    published_at TIMESTAMP WITH TIME ZONE,
    locale VARCHAR(10)
);

-- Comments
COMMENT ON TABLE mcp_servers IS 'MCP server configurations for agent execution';
COMMENT ON COLUMN mcp_servers.command IS 'Executable command to start MCP server';
COMMENT ON COLUMN mcp_servers.args IS 'Command-line arguments (JSONB array)';
COMMENT ON COLUMN mcp_servers.env IS 'Environment variables (JSONB object)';
COMMENT ON COLUMN mcp_servers.transport IS 'Communication protocol (stdio, sse, http)';

-- Trigger
CREATE TRIGGER update_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 4. Junction Tables (Many-to-Many Relations)

```sql
-- ============================================
-- AGENTS <-> SKILLS (Many-to-Many)
-- ============================================

CREATE TABLE agents_skills_links (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    skill_order NUMERIC(10,2) DEFAULT 1.0,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Prevent duplicate links
    UNIQUE(agent_id, skill_id)
);

COMMENT ON TABLE agents_skills_links IS 'Junction table linking agents to skills';
COMMENT ON COLUMN agents_skills_links.skill_order IS 'Order of skill in agent (for UI sorting)';

-- ============================================
-- AGENTS <-> MCP SERVERS (Many-to-Many)
-- ============================================

CREATE TABLE agents_mcp_servers_links (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    mcp_server_id INTEGER NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    mcp_server_order NUMERIC(10,2) DEFAULT 1.0,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Prevent duplicate links
    UNIQUE(agent_id, mcp_server_id)
);

COMMENT ON TABLE agents_mcp_servers_links IS 'Junction table linking agents to MCP servers';
```

### 5. Tasks Table (Optional)

```sql
-- ============================================
-- TASKS TABLE
-- Agent execution tasks and history
-- ============================================

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,

    -- Relations
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,

    -- Task Data
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

    -- Results (JSONB for flexible structure)
    result JSONB,
    error_message TEXT,

    -- Metrics
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE tasks IS 'Agent execution task history';
COMMENT ON COLUMN tasks.result IS 'Task execution result (JSONB format)';
COMMENT ON COLUMN tasks.duration_ms IS 'Task execution duration in milliseconds';

-- Trigger
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 6. Users Table (Strapi Default)

```sql
-- ============================================
-- USERS TABLE
-- Strapi users for authentication and audit
-- ============================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(255) DEFAULT 'local',
    password VARCHAR(255),
    reset_password_token VARCHAR(255) UNIQUE,
    confirmation_token VARCHAR(255) UNIQUE,
    confirmed BOOLEAN DEFAULT false,
    blocked BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE users IS 'Strapi users for authentication and authorization';
```

### Data Type Rationale

| Field Type | PostgreSQL Type | Reason |
|------------|-----------------|--------|
| **ID** | `SERIAL` (auto-increment) | Strapi default, efficient indexing |
| **Name** | `VARCHAR(100)` | Fixed-length for indexing, UNIQUE constraint |
| **Text Content** | `TEXT` | Unlimited length for prompts/content |
| **JSON Arrays** | `JSONB` | Binary format, indexable with GIN |
| **Timestamps** | `TIMESTAMP WITH TIME ZONE` | Timezone-aware, UTC storage |
| **Decimals** | `NUMERIC(5,2)` | Exact precision for scores |
| **Booleans** | `BOOLEAN` | Native true/false (not 0/1) |
| **Enums** | `VARCHAR + CHECK` | Flexible, Strapi-compatible |

---

## Index Strategies

### Primary Indexes (B-tree)

```sql
-- ============================================
-- B-TREE INDEXES
-- For equality, range queries, and sorting
-- ============================================

-- AGENTS TABLE
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_enabled ON agents(enabled) WHERE enabled = true;
CREATE INDEX idx_agents_model ON agents(model);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);
CREATE INDEX idx_agents_updated_at ON agents(updated_at DESC);

-- SKILLS TABLE
CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_experience_score ON skills(experience_score DESC);
CREATE INDEX idx_skills_created_at ON skills(created_at DESC);

-- MCP SERVERS TABLE
CREATE INDEX idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX idx_mcp_servers_disabled ON mcp_servers(disabled) WHERE disabled = false;
CREATE INDEX idx_mcp_servers_transport ON mcp_servers(transport);

-- TASKS TABLE
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at DESC) WHERE completed_at IS NOT NULL;

-- JUNCTION TABLES
CREATE INDEX idx_agents_skills_agent_id ON agents_skills_links(agent_id);
CREATE INDEX idx_agents_skills_skill_id ON agents_skills_links(skill_id);
CREATE INDEX idx_agents_mcps_agent_id ON agents_mcp_servers_links(agent_id);
CREATE INDEX idx_agents_mcps_mcp_id ON agents_mcp_servers_links(mcp_server_id);
```

### JSONB Indexes (GIN)

```sql
-- ============================================
-- GIN INDEXES
-- For JSONB containment and array queries
-- ============================================

-- AGENTS - Tools indexing
-- Allows fast queries like: WHERE tools @> '["Read"]'
CREATE INDEX idx_agents_tools_gin ON agents USING GIN (tools);
CREATE INDEX idx_agents_disallowed_tools_gin ON agents USING GIN (disallowed_tools);

-- SKILLS - Allowed tools indexing
CREATE INDEX idx_skills_allowed_tools_gin ON skills USING GIN (allowed_tools);

-- MCP SERVERS - Args and env indexing
CREATE INDEX idx_mcp_servers_args_gin ON mcp_servers USING GIN (args);
CREATE INDEX idx_mcp_servers_env_gin ON mcp_servers USING GIN (env);

-- TASKS - Result indexing for searching task outputs
CREATE INDEX idx_tasks_result_gin ON tasks USING GIN (result);
```

### Full-Text Search Indexes (GIN)

```sql
-- ============================================
-- FULL-TEXT SEARCH INDEXES
-- For searching across text fields
-- ============================================

-- Add tsvector columns for full-text search
ALTER TABLE agents ADD COLUMN search_vector tsvector;
ALTER TABLE skills ADD COLUMN search_vector tsvector;

-- Create GIN indexes on tsvector columns
CREATE INDEX idx_agents_search_gin ON agents USING GIN (search_vector);
CREATE INDEX idx_skills_search_gin ON skills USING GIN (search_vector);

-- Trigger to automatically update search_vector
CREATE OR REPLACE FUNCTION agents_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.system_prompt, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_agents
    BEFORE INSERT OR UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION agents_search_vector_update();

CREATE OR REPLACE FUNCTION skills_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_skills
    BEFORE INSERT OR UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION skills_search_vector_update();
```

### Partial Indexes (Optimized for Common Queries)

```sql
-- ============================================
-- PARTIAL INDEXES
-- For frequently filtered subsets
-- ============================================

-- Only index enabled agents (most queries filter by enabled = true)
CREATE INDEX idx_agents_enabled_name ON agents(name) WHERE enabled = true;

-- Only index active (non-disabled) MCP servers
CREATE INDEX idx_mcp_servers_active ON mcp_servers(name) WHERE disabled = false;

-- Only index completed tasks (for analytics)
CREATE INDEX idx_tasks_completed ON tasks(completed_at DESC)
    WHERE status = 'completed' AND completed_at IS NOT NULL;

-- Only index failed tasks (for error tracking)
CREATE INDEX idx_tasks_failed ON tasks(created_at DESC)
    WHERE status = 'failed';
```

### Composite Indexes (Multi-Column)

```sql
-- ============================================
-- COMPOSITE INDEXES
-- For queries with multiple filter conditions
-- ============================================

-- Agent queries: enabled + model
CREATE INDEX idx_agents_enabled_model ON agents(enabled, model)
    WHERE enabled = true;

-- Task queries: agent + status + created_at
CREATE INDEX idx_tasks_agent_status_created ON tasks(agent_id, status, created_at DESC);

-- Junction table queries: bidirectional lookups
CREATE INDEX idx_agents_skills_composite ON agents_skills_links(agent_id, skill_order);
CREATE INDEX idx_agents_mcps_composite ON agents_mcp_servers_links(agent_id, mcp_server_order);
```

### Index Maintenance

```sql
-- ============================================
-- INDEX MAINTENANCE QUERIES
-- ============================================

-- Check index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Find unused indexes (candidates for removal)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexrelname NOT LIKE 'pg_toast_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild bloated indexes
REINDEX TABLE agents;
REINDEX TABLE skills;
REINDEX TABLE mcp_servers;
REINDEX TABLE tasks;

-- Analyze tables for query planner
ANALYZE agents;
ANALYZE skills;
ANALYZE mcp_servers;
ANALYZE tasks;
```

### Index Strategy Summary

| Query Pattern | Index Type | Example |
|--------------|------------|---------|
| **Exact match** | B-tree | `WHERE name = 'agent-1'` |
| **Range queries** | B-tree | `WHERE created_at > '2025-01-01'` |
| **Sorting** | B-tree | `ORDER BY created_at DESC` |
| **JSONB contains** | GIN | `WHERE tools @> '["Read"]'` |
| **JSONB exists** | GIN | `WHERE tools ? 'Read'` |
| **Array overlap** | GIN | `WHERE tools && ARRAY['Read', 'Write']` |
| **Full-text search** | GIN (tsvector) | `WHERE search_vector @@ to_tsquery('agent')` |
| **Filtered subsets** | Partial | `WHERE enabled = true` (with partial index) |
| **Multi-column** | Composite | `WHERE enabled = true AND model = 'sonnet'` |

---

## Connection Pooling Configuration

### Overview

PostgreSQL uses a **process-per-connection** model, which means each connection consumes significant resources (memory, file descriptors). For web applications like Strapi + Express, proper connection pooling is **critical**.

### Connection Pool Architecture

```
┌─────────────────────────────────────────────┐
│           Client Applications               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Strapi  │  │ Express  │  │ Frontend │  │
│  │  (1337)  │  │  (3001)  │  │  (5173)  │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
         │              │              │
         │ Pool         │ Pool         │ Direct
         │ (10 conn)    │ (5 conn)     │ (if needed)
         └──────┬───────┴──────┬───────┘
                │              │
                ▼              ▼
      ┌────────────────────────────────┐
      │   Connection Pool Manager      │
      │   (e.g., PgBouncer, Strapi)   │
      │                                │
      │   Active: 15 / Max: 100        │
      └────────────────────────────────┘
                     │
                     ▼
           ┌──────────────────┐
           │   PostgreSQL      │
           │   max_connections │
           │   = 100           │
           └──────────────────┘
```

### PostgreSQL Server Configuration

Edit `postgresql.conf`:

```ini
# ============================================
# CONNECTION SETTINGS
# ============================================

# Maximum number of concurrent connections
# Formula: (RAM in GB) * 10-20 connections
# Example: 8GB RAM = 80-160 connections
max_connections = 100

# Reserved connections for superuser (for maintenance)
superuser_reserved_connections = 3

# Listen on all interfaces (for Docker/remote access)
listen_addresses = '*'

# Port
port = 5432

# ============================================
# MEMORY SETTINGS
# ============================================

# Shared buffers: 25% of RAM (up to 8GB)
# Example: 8GB RAM = 2GB shared_buffers
shared_buffers = 2GB

# Effective cache size: 50-75% of RAM
# Tells planner how much memory is available for caching
effective_cache_size = 6GB

# Work memory: Per-operation memory (sort, hash joins)
# Formula: (RAM - shared_buffers) / (max_connections * 2-3)
# Example: (8GB - 2GB) / (100 * 3) = 20MB
work_mem = 20MB

# Maintenance work memory: For VACUUM, CREATE INDEX, ALTER TABLE
# Formula: RAM / 16 (up to 2GB)
maintenance_work_mem = 512MB

# ============================================
# WAL (Write-Ahead Log) SETTINGS
# ============================================

# WAL level: minimal, replica, or logical
# Use 'replica' for streaming replication
wal_level = replica

# Maximum WAL senders (for replication)
max_wal_senders = 10

# WAL keep segments (for replication lag tolerance)
wal_keep_size = 1GB

# Checkpoint settings (prevent I/O spikes)
checkpoint_timeout = 10min
checkpoint_completion_target = 0.9
max_wal_size = 2GB
min_wal_size = 1GB

# ============================================
# QUERY TUNING
# ============================================

# Enable parallel query execution
max_parallel_workers_per_gather = 2
max_parallel_workers = 4

# Random page cost (lower for SSD)
random_page_cost = 1.1  # Default: 4.0 (HDD)

# Effective I/O concurrency (for SSD)
effective_io_concurrency = 200  # Default: 1 (HDD)

# ============================================
# LOGGING (for monitoring)
# ============================================

# Log slow queries (for optimization)
log_min_duration_statement = 1000  # Log queries > 1 second

# Log connections/disconnections (for debugging)
log_connections = on
log_disconnections = on

# Log duration of each completed statement
log_duration = off  # Use log_min_duration_statement instead

# Log line prefix (timestamp, user, database, PID)
log_line_prefix = '%t [%p] %u@%d '

# ============================================
# AUTOVACUUM (maintenance)
# ============================================

# Enable autovacuum (should always be on)
autovacuum = on

# Autovacuum max workers
autovacuum_max_workers = 3

# Autovacuum naptime (time between runs)
autovacuum_naptime = 1min

# ============================================
# CLIENT CONNECTION DEFAULTS
# ============================================

# Statement timeout (prevent long-running queries)
statement_timeout = 30000  # 30 seconds

# Lock timeout (prevent long lock waits)
lock_timeout = 10000  # 10 seconds

# Idle in transaction timeout (prevent idle connections)
idle_in_transaction_session_timeout = 60000  # 60 seconds
```

### Strapi Connection Pool Configuration

Edit `config/database.ts` (or `config/database.js`):

```typescript
// config/database.ts
export default ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'localhost'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'claude_agent_ui'),
      user: env('DATABASE_USERNAME', 'postgres'),
      password: env('DATABASE_PASSWORD', 'password'),
      ssl: env.bool('DATABASE_SSL', false) && {
        rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
      },
    },
    pool: {
      min: env.int('DATABASE_POOL_MIN', 2),
      max: env.int('DATABASE_POOL_MAX', 10),
      acquireTimeoutMillis: env.int('DATABASE_POOL_ACQUIRE_TIMEOUT', 60000),
      createTimeoutMillis: env.int('DATABASE_POOL_CREATE_TIMEOUT', 30000),
      destroyTimeoutMillis: env.int('DATABASE_POOL_DESTROY_TIMEOUT', 5000),
      idleTimeoutMillis: env.int('DATABASE_POOL_IDLE_TIMEOUT', 30000),
      reapIntervalMillis: env.int('DATABASE_POOL_REAP_INTERVAL', 1000),
      createRetryIntervalMillis: env.int('DATABASE_POOL_CREATE_RETRY_INTERVAL', 200),
      propagateCreateError: false,
    },
    debug: env.bool('DATABASE_DEBUG', false),
  },
});
```

**Environment Variables** (`.env`):

```env
# Database Connection
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=claude_agent_ui
DATABASE_USERNAME=strapi_user
DATABASE_PASSWORD=secure_password
DATABASE_SSL=false

# Connection Pool Settings
DATABASE_POOL_MIN=2          # Minimum idle connections
DATABASE_POOL_MAX=10         # Maximum connections
DATABASE_POOL_ACQUIRE_TIMEOUT=60000   # 60 seconds
DATABASE_POOL_IDLE_TIMEOUT=30000      # 30 seconds
DATABASE_POOL_REAP_INTERVAL=1000      # Check every 1 second

# Debug
DATABASE_DEBUG=false
```

### Express Connection Pool Configuration

```typescript
// src/config/database.ts
import { Pool } from 'pg';

// Create connection pool
export const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'claude_agent_ui',
  user: process.env.DATABASE_USERNAME || 'express_user',
  password: process.env.DATABASE_PASSWORD || 'password',

  // Connection pool settings
  min: 2,                      // Minimum idle connections
  max: 5,                      // Maximum connections
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout for new connections
  maxUses: 7500,               // Close connections after 7500 queries

  // SSL settings
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,

  // Application name (for monitoring)
  application_name: 'claude-agent-express'
});

// Connection error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Health check query
pool.on('connect', (client) => {
  console.log('New PostgreSQL connection established');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing PostgreSQL pool');
  await pool.end();
  process.exit(0);
});

// Example usage in Express routes
export async function queryDatabase(query: string, params: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release(); // CRITICAL: Always release connection back to pool
  }
}
```

### PgBouncer (Optional - Advanced)

For high-traffic scenarios, use **PgBouncer** as an external connection pooler:

```ini
# /etc/pgbouncer/pgbouncer.ini

[databases]
claude_agent_ui = host=localhost port=5432 dbname=claude_agent_ui

[pgbouncer]
# Listen address
listen_addr = 0.0.0.0
listen_port = 6432

# Authentication
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction           # transaction | session | statement
max_client_conn = 1000           # Maximum client connections
default_pool_size = 20           # Connections per database
min_pool_size = 5                # Minimum idle connections
reserve_pool_size = 5            # Emergency reserve connections
reserve_pool_timeout = 3         # Seconds
max_db_connections = 100         # Total database connections

# Timeouts
server_idle_timeout = 600        # Close idle server connections (10 min)
server_lifetime = 3600           # Close connections after 1 hour
query_timeout = 30               # Kill queries after 30 seconds
client_idle_timeout = 0          # Don't timeout clients

# Log settings
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

**Connection string with PgBouncer:**

```typescript
// Instead of connecting directly to PostgreSQL (port 5432)
// Connect to PgBouncer (port 6432)
const connectionString = 'postgresql://user:password@localhost:6432/claude_agent_ui';
```

### Connection Pool Sizing Guidelines

| Application | Recommended Pool Size | Reasoning |
|-------------|----------------------|-----------|
| **Strapi** | 10-20 connections | Handles CRUD operations, admin panel |
| **Express** | 5-10 connections | Handles SSE streaming, custom logic |
| **Frontend** | 0 (via APIs) | Never connects directly to database |
| **Background Jobs** | 2-5 connections | For scheduled tasks, cleanup |
| **Total** | 17-35 connections | Well below max_connections = 100 |

**Formula:**

```
pool_size = (core_count * 2) + effective_spindle_count

For web apps:
pool_size = (CPU_cores * 2) + 5

Example (4-core CPU):
pool_size = (4 * 2) + 5 = 13 connections
```

### Monitoring Connection Pool

```sql
-- Check current connections
SELECT
    datname,
    usename,
    application_name,
    client_addr,
    state,
    COUNT(*) as connection_count
FROM pg_stat_activity
WHERE datname = 'claude_agent_ui'
GROUP BY datname, usename, application_name, client_addr, state;

-- Check connection pool usage
SELECT
    datname,
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active,
    COUNT(*) FILTER (WHERE state = 'idle') as idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
GROUP BY datname;

-- Find long-running queries (potential pool blockers)
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    NOW() - query_start as duration,
    query
FROM pg_stat_activity
WHERE state != 'idle'
    AND NOW() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Kill long-running query (if needed)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = <process_id>;
```

---

## Complete Migration Script

### Migration Architecture

```
┌─────────────────────────────────────────────┐
│   Step 1: Backup SQLite                     │
│   - Create timestamped backup               │
│   - Verify backup integrity                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Step 2: Extract SQLite Data               │
│   - Read all agents, skills, MCP servers    │
│   - Transform data structure                │
│   - Validate data integrity                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Step 3: Create PostgreSQL Schema          │
│   - Drop existing tables (if any)           │
│   - Create tables with constraints          │
│   - Create indexes                          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Step 4: Insert Data into PostgreSQL       │
│   - Insert agents (with ID mapping)         │
│   - Insert skills (with ID mapping)         │
│   - Insert MCP servers (with ID mapping)    │
│   - Insert junction table relations         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Step 5: Validate Migration                │
│   - Count records (SQLite vs PostgreSQL)    │
│   - Validate foreign keys                   │
│   - Check data integrity                    │
│   - Generate migration report               │
└─────────────────────────────────────────────┘
```

### Complete Migration Script (TypeScript)

```typescript
// scripts/migrate-sqlite-to-postgres.ts

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIGURATION
// ============================================

const SQLITE_DB_PATH = './data/claude_agent_ui.db';
const POSTGRES_CONFIG = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'claude_agent_ui',
  user: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
};

const BACKUP_DIR = './data/backups';
const MIGRATION_LOG_DIR = './logs/migration';

// ============================================
// TYPES
// ============================================

interface SQLiteAgent {
  id: number;
  name: string;
  description: string | null;
  system_prompt: string;
  tools: string;  // JSON string
  disallowed_tools: string;  // JSON string
  model: string;
  enabled: number;  // SQLite boolean (0/1)
  created_at: string;
  updated_at: string;
}

interface SQLiteSkill {
  id: number;
  name: string;
  description: string | null;
  content: string;
  allowed_tools: string;  // JSON string
  experience_score: number;
  created_at: string;
  updated_at: string;
}

interface SQLiteMCPServer {
  id: number;
  name: string;
  command: string;
  args: string;  // JSON string
  env: string;  // JSON string
  disabled: number;  // SQLite boolean (0/1)
  transport: string;
  created_at: string;
  updated_at: string;
}

interface MigrationStats {
  agents: { sqlite: number; postgres: number };
  skills: { sqlite: number; postgres: number };
  mcpServers: { sqlite: number; postgres: number };
  agentSkillLinks: number;
  agentMCPLinks: number;
  errors: string[];
  warnings: string[];
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================

async function migrate() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   SQLite → PostgreSQL Migration Script            ║');
  console.log('║   Claude Agent UI                                  ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const stats: MigrationStats = {
    agents: { sqlite: 0, postgres: 0 },
    skills: { sqlite: 0, postgres: 0 },
    mcpServers: { sqlite: 0, postgres: 0 },
    agentSkillLinks: 0,
    agentMCPLinks: 0,
    errors: [],
    warnings: [],
  };

  let sqliteDb: Database.Database | null = null;
  let pgPool: Pool | null = null;

  try {
    // Step 1: Backup SQLite
    console.log('📦 Step 1: Backing up SQLite database...');
    const backupPath = await backupSQLite();
    console.log(`✅ Backup created: ${backupPath}\n`);

    // Step 2: Connect to databases
    console.log('🔌 Step 2: Connecting to databases...');
    sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
    pgPool = new Pool(POSTGRES_CONFIG);
    await pgPool.query('SELECT NOW()');
    console.log('✅ Connected to SQLite and PostgreSQL\n');

    // Step 3: Extract SQLite data
    console.log('📤 Step 3: Extracting data from SQLite...');
    const sqliteData = extractSQLiteData(sqliteDb, stats);
    console.log(`✅ Extracted ${sqliteData.agents.length} agents, ${sqliteData.skills.length} skills, ${sqliteData.mcpServers.length} MCP servers\n`);

    // Step 4: Create PostgreSQL schema
    console.log('🏗️  Step 4: Creating PostgreSQL schema...');
    await createPostgreSQLSchema(pgPool);
    console.log('✅ Schema created successfully\n');

    // Step 5: Insert data into PostgreSQL
    console.log('📥 Step 5: Inserting data into PostgreSQL...');
    await insertDataIntoPostgreSQL(pgPool, sqliteData, stats);
    console.log('✅ Data inserted successfully\n');

    // Step 6: Validate migration
    console.log('✔️  Step 6: Validating migration...');
    await validateMigration(pgPool, stats);
    console.log('✅ Validation completed\n');

    // Step 7: Generate report
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    generateMigrationReport(stats, duration);

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    stats.errors.push(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    // Cleanup connections
    if (sqliteDb) sqliteDb.close();
    if (pgPool) await pgPool.end();
  }
}

// ============================================
// STEP 1: BACKUP SQLITE
// ============================================

async function backupSQLite(): Promise<string> {
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Create timestamped backup filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `claude_agent_ui_${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  // Copy SQLite database file
  fs.copyFileSync(SQLITE_DB_PATH, backupPath);

  // Verify backup
  const originalSize = fs.statSync(SQLITE_DB_PATH).size;
  const backupSize = fs.statSync(backupPath).size;

  if (originalSize !== backupSize) {
    throw new Error('Backup verification failed: file sizes do not match');
  }

  return backupPath;
}

// ============================================
// STEP 2: EXTRACT SQLITE DATA
// ============================================

interface SQLiteData {
  agents: SQLiteAgent[];
  skills: SQLiteSkill[];
  mcpServers: SQLiteMCPServer[];
  agentSkillLinks: Array<{ agent_id: number; skill_id: number }>;
  agentMCPLinks: Array<{ agent_id: number; mcp_server_id: number }>;
}

function extractSQLiteData(db: Database.Database, stats: MigrationStats): SQLiteData {
  try {
    // Extract agents
    const agents = db.prepare('SELECT * FROM agents').all() as SQLiteAgent[];
    stats.agents.sqlite = agents.length;

    // Extract skills
    const skills = db.prepare('SELECT * FROM skills').all() as SQLiteSkill[];
    stats.skills.sqlite = skills.length;

    // Extract MCP servers
    const mcpServers = db.prepare('SELECT * FROM mcp_servers').all() as SQLiteMCPServer[];
    stats.mcpServers.sqlite = mcpServers.length;

    // Extract junction tables (if they exist)
    let agentSkillLinks: Array<{ agent_id: number; skill_id: number }> = [];
    let agentMCPLinks: Array<{ agent_id: number; mcp_server_id: number }> = [];

    try {
      agentSkillLinks = db.prepare('SELECT agent_id, skill_id FROM agents_skills_links').all() as any[];
    } catch (e) {
      stats.warnings.push('agents_skills_links table not found, skipping');
    }

    try {
      agentMCPLinks = db.prepare('SELECT agent_id, mcp_server_id FROM agents_mcp_servers_links').all() as any[];
    } catch (e) {
      stats.warnings.push('agents_mcp_servers_links table not found, skipping');
    }

    return {
      agents,
      skills,
      mcpServers,
      agentSkillLinks,
      agentMCPLinks,
    };
  } catch (error) {
    throw new Error(`Failed to extract SQLite data: ${error}`);
  }
}

// ============================================
// STEP 3: CREATE POSTGRESQL SCHEMA
// ============================================

async function createPostgreSQLSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Drop existing tables (CASCADE removes dependent objects)
    await client.query(`
      DROP TABLE IF EXISTS agents_mcp_servers_links CASCADE;
      DROP TABLE IF EXISTS agents_skills_links CASCADE;
      DROP TABLE IF EXISTS tasks CASCADE;
      DROP TABLE IF EXISTS mcp_servers CASCADE;
      DROP TABLE IF EXISTS skills CASCADE;
      DROP TABLE IF EXISTS agents CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    `);

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create users table (Strapi default)
    await client.query(`
      CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE,
          email VARCHAR(255) UNIQUE NOT NULL,
          provider VARCHAR(255) DEFAULT 'local',
          password VARCHAR(255),
          reset_password_token VARCHAR(255) UNIQUE,
          confirmation_token VARCHAR(255) UNIQUE,
          confirmed BOOLEAN DEFAULT false,
          blocked BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    // Create agents table
    await client.query(`
      CREATE TABLE agents (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          system_prompt TEXT NOT NULL,
          tools JSONB DEFAULT '[]'::jsonb,
          disallowed_tools JSONB DEFAULT '[]'::jsonb,
          model VARCHAR(20) NOT NULL DEFAULT 'sonnet'
              CHECK (model IN ('sonnet', 'opus', 'haiku', 'sonnet-4', 'opus-4')),
          enabled BOOLEAN DEFAULT true NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          published_at TIMESTAMP WITH TIME ZONE,
          locale VARCHAR(10)
      );

      CREATE TRIGGER update_agents_updated_at
          BEFORE UPDATE ON agents
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create skills table
    await client.query(`
      CREATE TABLE skills (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          content TEXT NOT NULL,
          allowed_tools JSONB DEFAULT '[]'::jsonb,
          experience_score NUMERIC(5,2) DEFAULT 0.00 NOT NULL
              CHECK (experience_score >= 0 AND experience_score <= 100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          published_at TIMESTAMP WITH TIME ZONE,
          locale VARCHAR(10)
      );

      CREATE TRIGGER update_skills_updated_at
          BEFORE UPDATE ON skills
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create mcp_servers table
    await client.query(`
      CREATE TABLE mcp_servers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          command VARCHAR(500) NOT NULL,
          args JSONB DEFAULT '[]'::jsonb,
          env JSONB DEFAULT '{}'::jsonb,
          disabled BOOLEAN DEFAULT false NOT NULL,
          transport VARCHAR(20) DEFAULT 'stdio' NOT NULL
              CHECK (transport IN ('stdio', 'sse', 'http')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          published_at TIMESTAMP WITH TIME ZONE,
          locale VARCHAR(10)
      );

      CREATE TRIGGER update_mcp_servers_updated_at
          BEFORE UPDATE ON mcp_servers
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create junction tables
    await client.query(`
      CREATE TABLE agents_skills_links (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
          skill_order NUMERIC(10,2) DEFAULT 1.0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          UNIQUE(agent_id, skill_id)
      );

      CREATE TABLE agents_mcp_servers_links (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          mcp_server_id INTEGER NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
          mcp_server_order NUMERIC(10,2) DEFAULT 1.0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          UNIQUE(agent_id, mcp_server_id)
      );
    `);

    // Create tasks table
    await client.query(`
      CREATE TABLE tasks (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
          message TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' NOT NULL
              CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          result JSONB,
          error_message TEXT,
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          duration_ms INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TRIGGER update_tasks_updated_at
          BEFORE UPDATE ON tasks
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create indexes
    await client.query(`
      -- Agents indexes
      CREATE INDEX idx_agents_name ON agents(name);
      CREATE INDEX idx_agents_enabled ON agents(enabled) WHERE enabled = true;
      CREATE INDEX idx_agents_model ON agents(model);
      CREATE INDEX idx_agents_tools_gin ON agents USING GIN (tools);
      CREATE INDEX idx_agents_disallowed_tools_gin ON agents USING GIN (disallowed_tools);

      -- Skills indexes
      CREATE INDEX idx_skills_name ON skills(name);
      CREATE INDEX idx_skills_experience_score ON skills(experience_score DESC);
      CREATE INDEX idx_skills_allowed_tools_gin ON skills USING GIN (allowed_tools);

      -- MCP Servers indexes
      CREATE INDEX idx_mcp_servers_name ON mcp_servers(name);
      CREATE INDEX idx_mcp_servers_disabled ON mcp_servers(disabled) WHERE disabled = false;
      CREATE INDEX idx_mcp_servers_args_gin ON mcp_servers USING GIN (args);
      CREATE INDEX idx_mcp_servers_env_gin ON mcp_servers USING GIN (env);

      -- Junction table indexes
      CREATE INDEX idx_agents_skills_agent_id ON agents_skills_links(agent_id);
      CREATE INDEX idx_agents_skills_skill_id ON agents_skills_links(skill_id);
      CREATE INDEX idx_agents_mcps_agent_id ON agents_mcp_servers_links(agent_id);
      CREATE INDEX idx_agents_mcps_mcp_id ON agents_mcp_servers_links(mcp_server_id);

      -- Tasks indexes
      CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('   ✓ Schema and indexes created');

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to create PostgreSQL schema: ${error}`);
  } finally {
    client.release();
  }
}

// ============================================
// STEP 4: INSERT DATA INTO POSTGRESQL
// ============================================

async function insertDataIntoPostgreSQL(
  pool: Pool,
  data: SQLiteData,
  stats: MigrationStats
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert agents
    const agentIdMap = new Map<number, number>();
    for (const agent of data.agents) {
      const result = await client.query(
        `INSERT INTO agents (
          name, description, system_prompt, tools, disallowed_tools,
          model, enabled, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          agent.name,
          agent.description,
          agent.system_prompt,
          agent.tools ? JSON.parse(agent.tools) : [],
          agent.disallowed_tools ? JSON.parse(agent.disallowed_tools) : [],
          agent.model,
          agent.enabled === 1,
          agent.created_at,
          agent.updated_at,
        ]
      );
      agentIdMap.set(agent.id, result.rows[0].id);
      stats.agents.postgres++;
    }
    console.log(`   ✓ Inserted ${stats.agents.postgres} agents`);

    // Insert skills
    const skillIdMap = new Map<number, number>();
    for (const skill of data.skills) {
      const result = await client.query(
        `INSERT INTO skills (
          name, description, content, allowed_tools, experience_score,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          skill.name,
          skill.description,
          skill.content,
          skill.allowed_tools ? JSON.parse(skill.allowed_tools) : [],
          skill.experience_score,
          skill.created_at,
          skill.updated_at,
        ]
      );
      skillIdMap.set(skill.id, result.rows[0].id);
      stats.skills.postgres++;
    }
    console.log(`   ✓ Inserted ${stats.skills.postgres} skills`);

    // Insert MCP servers
    const mcpIdMap = new Map<number, number>();
    for (const mcp of data.mcpServers) {
      const result = await client.query(
        `INSERT INTO mcp_servers (
          name, command, args, env, disabled, transport,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          mcp.name,
          mcp.command,
          mcp.args ? JSON.parse(mcp.args) : [],
          mcp.env ? JSON.parse(mcp.env) : {},
          mcp.disabled === 1,
          mcp.transport,
          mcp.created_at,
          mcp.updated_at,
        ]
      );
      mcpIdMap.set(mcp.id, result.rows[0].id);
      stats.mcpServers.postgres++;
    }
    console.log(`   ✓ Inserted ${stats.mcpServers.postgres} MCP servers`);

    // Insert agent-skill links
    for (const link of data.agentSkillLinks) {
      const newAgentId = agentIdMap.get(link.agent_id);
      const newSkillId = skillIdMap.get(link.skill_id);

      if (newAgentId && newSkillId) {
        await client.query(
          `INSERT INTO agents_skills_links (agent_id, skill_id)
           VALUES ($1, $2)`,
          [newAgentId, newSkillId]
        );
        stats.agentSkillLinks++;
      } else {
        stats.warnings.push(
          `Skipped agent-skill link: agent ${link.agent_id} -> skill ${link.skill_id} (missing ID mapping)`
        );
      }
    }
    console.log(`   ✓ Inserted ${stats.agentSkillLinks} agent-skill links`);

    // Insert agent-MCP links
    for (const link of data.agentMCPLinks) {
      const newAgentId = agentIdMap.get(link.agent_id);
      const newMCPId = mcpIdMap.get(link.mcp_server_id);

      if (newAgentId && newMCPId) {
        await client.query(
          `INSERT INTO agents_mcp_servers_links (agent_id, mcp_server_id)
           VALUES ($1, $2)`,
          [newAgentId, newMCPId]
        );
        stats.agentMCPLinks++;
      } else {
        stats.warnings.push(
          `Skipped agent-MCP link: agent ${link.agent_id} -> MCP ${link.mcp_server_id} (missing ID mapping)`
        );
      }
    }
    console.log(`   ✓ Inserted ${stats.agentMCPLinks} agent-MCP links`);

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to insert data into PostgreSQL: ${error}`);
  } finally {
    client.release();
  }
}

// ============================================
// STEP 5: VALIDATE MIGRATION
// ============================================

async function validateMigration(pool: Pool, stats: MigrationStats): Promise<void> {
  const client = await pool.connect();

  try {
    // Count records
    const agentCount = await client.query('SELECT COUNT(*) FROM agents');
    const skillCount = await client.query('SELECT COUNT(*) FROM skills');
    const mcpCount = await client.query('SELECT COUNT(*) FROM mcp_servers');

    const pgAgents = parseInt(agentCount.rows[0].count);
    const pgSkills = parseInt(skillCount.rows[0].count);
    const pgMCPs = parseInt(mcpCount.rows[0].count);

    // Verify counts match
    if (pgAgents !== stats.agents.sqlite) {
      stats.errors.push(
        `Agent count mismatch: SQLite=${stats.agents.sqlite}, PostgreSQL=${pgAgents}`
      );
    }

    if (pgSkills !== stats.skills.sqlite) {
      stats.errors.push(
        `Skill count mismatch: SQLite=${stats.skills.sqlite}, PostgreSQL=${pgSkills}`
      );
    }

    if (pgMCPs !== stats.mcpServers.sqlite) {
      stats.errors.push(
        `MCP server count mismatch: SQLite=${stats.mcpServers.sqlite}, PostgreSQL=${pgMCPs}`
      );
    }

    // Check for orphaned relations
    const orphanedSkills = await client.query(`
      SELECT COUNT(*) FROM agents_skills_links asl
      LEFT JOIN agents a ON asl.agent_id = a.id
      LEFT JOIN skills s ON asl.skill_id = s.id
      WHERE a.id IS NULL OR s.id IS NULL
    `);

    const orphanedMCPs = await client.query(`
      SELECT COUNT(*) FROM agents_mcp_servers_links amsl
      LEFT JOIN agents a ON amsl.agent_id = a.id
      LEFT JOIN mcp_servers m ON amsl.mcp_server_id = m.id
      WHERE a.id IS NULL OR m.id IS NULL
    `);

    const orphanedSkillCount = parseInt(orphanedSkills.rows[0].count);
    const orphanedMCPCount = parseInt(orphanedMCPs.rows[0].count);

    if (orphanedSkillCount > 0) {
      stats.errors.push(`Found ${orphanedSkillCount} orphaned agent-skill links`);
    }

    if (orphanedMCPCount > 0) {
      stats.errors.push(`Found ${orphanedMCPCount} orphaned agent-MCP links`);
    }

    console.log('   ✓ Record counts validated');
    console.log('   ✓ Foreign key integrity verified');

  } finally {
    client.release();
  }
}

// ============================================
// STEP 6: GENERATE MIGRATION REPORT
// ============================================

function generateMigrationReport(stats: MigrationStats, duration: string): void {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║           MIGRATION REPORT                         ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('📊 Data Migration Summary:');
  console.log(`   Agents:       ${stats.agents.sqlite} → ${stats.agents.postgres}`);
  console.log(`   Skills:       ${stats.skills.sqlite} → ${stats.skills.postgres}`);
  console.log(`   MCP Servers:  ${stats.mcpServers.sqlite} → ${stats.mcpServers.postgres}`);
  console.log(`   Agent-Skill Links:  ${stats.agentSkillLinks}`);
  console.log(`   Agent-MCP Links:    ${stats.agentMCPLinks}`);

  if (stats.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${stats.warnings.length}):`);
    stats.warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
  }

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors (${stats.errors.length}):`);
    stats.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }

  console.log(`\n⏱️  Duration: ${duration} seconds`);

  if (stats.errors.length === 0) {
    console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY!\n');
  } else {
    console.log('\n❌ MIGRATION COMPLETED WITH ERRORS!\n');
  }

  // Write report to file
  const reportPath = path.join(MIGRATION_LOG_DIR, `migration-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  if (!fs.existsSync(MIGRATION_LOG_DIR)) {
    fs.mkdirSync(MIGRATION_LOG_DIR, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(`📄 Full report saved to: ${reportPath}\n`);
}

// ============================================
// RUN MIGRATION
// ============================================

migrate()
  .then(() => {
    console.log('Migration process completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
```

### Running the Migration Script

```bash
# Install dependencies
npm install better-sqlite3 pg dotenv

# Set environment variables
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
export DATABASE_NAME=claude_agent_ui
export DATABASE_USERNAME=postgres
export DATABASE_PASSWORD=your_secure_password

# Run migration
npx ts-node scripts/migrate-sqlite-to-postgres.ts

# Or with npm script
npm run migrate
```

### package.json Script

```json
{
  "scripts": {
    "migrate": "ts-node scripts/migrate-sqlite-to-postgres.ts",
    "migrate:dry-run": "ts-node scripts/migrate-sqlite-to-postgres.ts --dry-run",
    "migrate:rollback": "ts-node scripts/rollback-migration.ts"
  }
}
```

---

## Performance Optimization Strategies

### 1. Query Optimization

#### Use EXPLAIN ANALYZE

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT a.*, COUNT(s.id) as skill_count
FROM agents a
LEFT JOIN agents_skills_links asl ON a.id = asl.agent_id
LEFT JOIN skills s ON asl.skill_id = s.id
WHERE a.enabled = true
GROUP BY a.id
ORDER BY a.name;

-- Look for:
-- ✅ Index Scan (good)
-- ❌ Seq Scan (bad for large tables)
-- ✅ Execution time < 100ms
-- ❌ Execution time > 1000ms
```

#### Optimize Common Queries

```sql
-- BAD: Fetching all columns when only name is needed
SELECT * FROM agents WHERE enabled = true;

-- GOOD: Fetch only required columns
SELECT id, name FROM agents WHERE enabled = true;

-- BAD: N+1 query problem
SELECT * FROM agents;
-- Then for each agent:
SELECT * FROM skills WHERE id IN (SELECT skill_id FROM agents_skills_links WHERE agent_id = ?);

-- GOOD: Single query with JOIN
SELECT
  a.*,
  json_agg(json_build_object('id', s.id, 'name', s.name)) as skills
FROM agents a
LEFT JOIN agents_skills_links asl ON a.id = asl.agent_id
LEFT JOIN skills s ON asl.skill_id = s.id
WHERE a.enabled = true
GROUP BY a.id;
```

### 2. JSONB Query Optimization

```sql
-- BAD: Using -> (returns JSONB)
SELECT * FROM agents WHERE tools -> 'name' = '"Read"';

-- GOOD: Using ->> (returns text)
SELECT * FROM agents WHERE tools ->> 'name' = 'Read';

-- BAD: Containment without GIN index
SELECT * FROM agents WHERE tools @> '["Read"]';

-- GOOD: Containment with GIN index (ensure idx_agents_tools_gin exists)
SELECT * FROM agents WHERE tools @> '["Read"]';

-- Check if tool exists in array
SELECT * FROM agents WHERE tools ? 'Read';

-- Get array length
SELECT name, jsonb_array_length(tools) as tool_count
FROM agents;

-- Extract specific JSONB field
SELECT
  name,
  tools ->> 0 as first_tool,
  jsonb_array_elements_text(tools) as tool
FROM agents;
```

### 3. Bulk Insert Optimization

```sql
-- BAD: Individual inserts
INSERT INTO agents (name, description) VALUES ('agent-1', 'desc1');
INSERT INTO agents (name, description) VALUES ('agent-2', 'desc2');
-- ... (slow for large datasets)

-- GOOD: Bulk insert with multi-row VALUES
INSERT INTO agents (name, description) VALUES
  ('agent-1', 'desc1'),
  ('agent-2', 'desc2'),
  ('agent-3', 'desc3'),
  -- ... up to 1000 rows per statement
  ('agent-1000', 'desc1000');

-- BEST: Use COPY for very large datasets
COPY agents (name, description, system_prompt, tools, model)
FROM '/tmp/agents.csv'
WITH (FORMAT csv, HEADER true);
```

### 4. Connection Pool Tuning

```typescript
// Strapi database config
export default {
  connection: {
    client: 'postgres',
    connection: {
      // ... connection details
    },
    pool: {
      min: 2,
      max: 10,

      // CRITICAL: Set timeouts
      acquireTimeoutMillis: 60000,  // Wait up to 60s for connection
      createTimeoutMillis: 30000,   // Wait up to 30s to create connection
      idleTimeoutMillis: 30000,     // Close idle connections after 30s

      // Advanced: Connection validation
      afterCreate: (conn, done) => {
        // Run a test query to validate connection
        conn.query('SELECT 1', (err) => {
          done(err, conn);
        });
      },
    },
  },
};
```

### 5. Caching Strategy

```typescript
// In-memory cache for frequently accessed data
import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 600,  // 10 minutes default TTL
  checkperiod: 120,  // Check for expired keys every 2 minutes
});

// Cache agents list
export async function getAllAgents(): Promise<Agent[]> {
  const cacheKey = 'agents:all';

  // Check cache first
  const cached = cache.get<Agent[]>(cacheKey);
  if (cached) {
    console.log('Cache HIT: agents:all');
    return cached;
  }

  // Cache miss: fetch from database
  console.log('Cache MISS: agents:all');
  const agents = await strapi.entityService.findMany('api::agent.agent', {
    populate: ['skills', 'mcpServers'],
  });

  // Store in cache
  cache.set(cacheKey, agents, 600);  // 10 minutes

  return agents;
}

// Invalidate cache on update
export async function updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
  const agent = await strapi.entityService.update('api::agent.agent', id, { data });

  // Invalidate related caches
  cache.del('agents:all');
  cache.del(`agent:${id}`);

  return agent;
}
```

### 6. Database-Level Caching

```sql
-- Enable query result caching (PostgreSQL shared_buffers)
-- Already configured in postgresql.conf (shared_buffers = 2GB)

-- Use materialized views for expensive queries
CREATE MATERIALIZED VIEW agent_statistics AS
SELECT
  a.id,
  a.name,
  COUNT(DISTINCT asl.skill_id) as skill_count,
  COUNT(DISTINCT amsl.mcp_server_id) as mcp_count,
  COUNT(DISTINCT t.id) as task_count,
  AVG(t.duration_ms) as avg_task_duration
FROM agents a
LEFT JOIN agents_skills_links asl ON a.id = asl.agent_id
LEFT JOIN agents_mcp_servers_links amsl ON a.id = amsl.agent_id
LEFT JOIN tasks t ON a.id = t.agent_id AND t.status = 'completed'
GROUP BY a.id, a.name;

-- Create index on materialized view
CREATE INDEX idx_agent_stats_name ON agent_statistics(name);

-- Refresh materialized view (run periodically via cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY agent_statistics;

-- Query materialized view (fast!)
SELECT * FROM agent_statistics WHERE name = 'agent-1';
```

### 7. Vacuuming and Maintenance

```sql
-- Manual VACUUM (reclaim storage, update statistics)
VACUUM ANALYZE agents;
VACUUM ANALYZE skills;
VACUUM ANALYZE mcp_servers;
VACUUM ANALYZE tasks;

-- Full VACUUM (locks table, use during maintenance window)
VACUUM FULL agents;

-- Check for bloated tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Reindex bloated indexes
REINDEX INDEX CONCURRENTLY idx_agents_name;

-- Analyze tables (update query planner statistics)
ANALYZE agents;
```

### 8. Partitioning (For Large Tables)

```sql
-- If tasks table grows to millions of rows, partition by created_at
CREATE TABLE tasks_partitioned (
    id SERIAL,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL
) PARTITION BY RANGE (created_at);

-- Create partitions for each month
CREATE TABLE tasks_2025_01 PARTITION OF tasks_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE tasks_2025_02 PARTITION OF tasks_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Index each partition
CREATE INDEX idx_tasks_2025_01_agent_id ON tasks_2025_01(agent_id);
CREATE INDEX idx_tasks_2025_01_status ON tasks_2025_01(status);
```

### 9. Query Plan Analysis

```sql
-- Enable query logging for slow queries
-- In postgresql.conf:
-- log_min_duration_statement = 1000  # Log queries > 1 second

-- Analyze query plan
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT a.*, s.name as skill_name
FROM agents a
JOIN agents_skills_links asl ON a.id = asl.agent_id
JOIN skills s ON asl.skill_id = s.id
WHERE a.enabled = true AND a.model = 'sonnet';

-- Look for:
-- - Seq Scan (bad) → Add index
-- - Index Scan (good)
-- - Bitmap Heap Scan (good for multiple conditions)
-- - Hash Join (good for large datasets)
-- - Nested Loop (good for small datasets)
-- - Buffers: shared hit (good, from cache) vs shared read (bad, from disk)
```

### Performance Optimization Checklist

- [ ] All foreign key columns indexed
- [ ] GIN indexes on JSONB columns
- [ ] Partial indexes for filtered queries (WHERE enabled = true)
- [ ] Full-text search indexes (tsvector + GIN)
- [ ] Connection pool configured (min=2, max=10)
- [ ] Query result caching (Node cache + shared_buffers)
- [ ] Slow query logging enabled (log_min_duration_statement = 1000)
- [ ] Autovacuum enabled and tuned
- [ ] Materialized views for expensive aggregations
- [ ] EXPLAIN ANALYZE used to optimize slow queries
- [ ] Table partitioning for large tables (tasks)
- [ ] Connection pooler (PgBouncer) for high traffic

---

## Production Deployment Checklist

### Pre-Deployment

#### 1. Database Setup

- [ ] **PostgreSQL Installed** (version 16+ recommended)
- [ ] **Database Created** (`CREATE DATABASE claude_agent_ui;`)
- [ ] **User Created** with appropriate permissions
  ```sql
  CREATE USER strapi_user WITH PASSWORD 'secure_password';
  GRANT ALL PRIVILEGES ON DATABASE claude_agent_ui TO strapi_user;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO strapi_user;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO strapi_user;
  ```
- [ ] **Schema Created** (run migration script)
- [ ] **Indexes Created** (verify with `\di` in psql)
- [ ] **Constraints Verified** (foreign keys, check constraints)

#### 2. Configuration

- [ ] **postgresql.conf Tuned** (see configuration section)
  - [ ] max_connections = 100
  - [ ] shared_buffers = 25% RAM
  - [ ] effective_cache_size = 50-75% RAM
  - [ ] work_mem = appropriate for workload
  - [ ] wal_level = replica (for replication)
- [ ] **pg_hba.conf Configured** (authentication)
  ```
  host    claude_agent_ui    strapi_user    0.0.0.0/0    scram-sha-256
  ```
- [ ] **Firewall Rules** (allow port 5432 from application servers only)
- [ ] **SSL/TLS Enabled** (optional but recommended)
  ```ini
  ssl = on
  ssl_cert_file = '/path/to/server.crt'
  ssl_key_file = '/path/to/server.key'
  ```

#### 3. Security

- [ ] **Strong Passwords** (minimum 16 characters, random)
- [ ] **Principle of Least Privilege** (separate users for Strapi, Express, read-only)
  ```sql
  CREATE USER express_user WITH PASSWORD 'another_secure_password';
  GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO express_user;
  ```
- [ ] **Network Isolation** (database on private subnet, no public access)
- [ ] **Audit Logging Enabled**
  ```ini
  log_connections = on
  log_disconnections = on
  log_statement = 'mod'  # Log all DDL and DML
  ```
- [ ] **SSL Certificate Valid** (if using SSL)
- [ ] **Row-Level Security** (if needed for multi-tenancy)

#### 4. Backup Strategy

- [ ] **pg_dump Scheduled** (daily full backups)
  ```bash
  pg_dump -U postgres -h localhost claude_agent_ui > backup_$(date +%Y%m%d).sql
  ```
- [ ] **WAL Archiving Configured** (for point-in-time recovery)
  ```ini
  wal_level = replica
  archive_mode = on
  archive_command = 'cp %p /mnt/backup/wal_archive/%f'
  ```
- [ ] **Backup Tested** (restore to test environment and verify)
- [ ] **Off-site Backup** (S3, Azure Blob, Google Cloud Storage)
- [ ] **Retention Policy** (keep 30 days daily, 12 months monthly)

#### 5. Monitoring

- [ ] **pg_stat_statements Enabled**
  ```sql
  CREATE EXTENSION pg_stat_statements;
  ```
- [ ] **Monitoring Tool Installed** (Prometheus + Grafana, Datadog, New Relic)
- [ ] **Alerts Configured**
  - [ ] High connection count (> 80% max_connections)
  - [ ] Slow queries (> 5 seconds)
  - [ ] Replication lag (> 10 seconds)
  - [ ] Disk space low (< 20% free)
  - [ ] High memory usage (> 90%)
- [ ] **Log Aggregation** (ELK stack, Splunk, CloudWatch Logs)

### Deployment

#### 6. Initial Data Load

- [ ] **Migration Script Tested** (in staging environment)
- [ ] **SQLite Backup Created** (before migration)
- [ ] **Migration Executed** (run migrate-sqlite-to-postgres.ts)
- [ ] **Data Validated** (count records, check foreign keys)
- [ ] **Indexes Analyzed** (run ANALYZE after data load)

#### 7. Application Configuration

- [ ] **Strapi Connected** (test database connection)
  ```bash
  npm run strapi develop
  # Check console for "Database connected"
  ```
- [ ] **Express Connected** (test database connection)
  ```bash
  npm run dev
  # Check console for "PostgreSQL connected"
  ```
- [ ] **Environment Variables Set** (production .env)
  ```env
  DATABASE_HOST=postgres.prod.internal
  DATABASE_PORT=5432
  DATABASE_NAME=claude_agent_ui
  DATABASE_USERNAME=strapi_user
  DATABASE_PASSWORD=<from_secrets_manager>
  DATABASE_POOL_MIN=2
  DATABASE_POOL_MAX=10
  ```
- [ ] **Connection Pool Verified** (check `SELECT * FROM pg_stat_activity;`)

#### 8. Testing

- [ ] **Smoke Tests** (basic CRUD operations)
  - [ ] Create agent → Verify in database
  - [ ] Read agent → Returns correct data
  - [ ] Update agent → Changes reflected
  - [ ] Delete agent → Cascade deletes relations
- [ ] **Load Testing** (simulate production traffic)
  ```bash
  # Use Apache JMeter, k6, or artillery
  k6 run --vus 100 --duration 5m load-test.js
  ```
- [ ] **Stress Testing** (find breaking points)
- [ ] **Failover Testing** (if using replication)

### Post-Deployment

#### 9. Monitoring & Maintenance

- [ ] **Daily Monitoring** (check dashboard, review logs)
- [ ] **Weekly Vacuum** (run VACUUM ANALYZE on all tables)
  ```bash
  vacuumdb -U postgres -d claude_agent_ui -z
  ```
- [ ] **Monthly Index Rebuild** (reindex bloated indexes)
  ```sql
  REINDEX TABLE agents;
  ```
- [ ] **Quarterly Review** (query performance, index usage, schema changes)

#### 10. Disaster Recovery Testing

- [ ] **Restore from Backup** (test quarterly)
  ```bash
  psql -U postgres -d claude_agent_ui_test < backup_20250120.sql
  ```
- [ ] **Point-in-Time Recovery** (test if using WAL archiving)
- [ ] **Failover to Replica** (test if using streaming replication)
- [ ] **Recovery Time Objective (RTO)** documented (target: < 1 hour)
- [ ] **Recovery Point Objective (RPO)** documented (target: < 5 minutes)

### Production Checklist Summary

| Category | Critical Items | Status |
|----------|---------------|--------|
| **Database** | PostgreSQL 16+ installed, database created, schema deployed | ☐ |
| **Configuration** | postgresql.conf tuned, pg_hba.conf configured | ☐ |
| **Security** | Strong passwords, SSL enabled, audit logging | ☐ |
| **Backup** | pg_dump scheduled, WAL archiving, off-site backup | ☐ |
| **Monitoring** | pg_stat_statements, alerts, log aggregation | ☐ |
| **Data** | Migration completed, data validated, indexes analyzed | ☐ |
| **Application** | Strapi connected, Express connected, connection pool verified | ☐ |
| **Testing** | Smoke tests, load tests, stress tests | ☐ |
| **Maintenance** | Vacuum scheduled, monitoring dashboard, review process | ☐ |
| **DR** | Backup tested, failover tested, RTO/RPO documented | ☐ |

---

## Monitoring & Maintenance

### Key Metrics to Monitor

#### 1. Connection Metrics

```sql
-- Current connections by state
SELECT
    state,
    COUNT(*) as count
FROM pg_stat_activity
WHERE datname = 'claude_agent_ui'
GROUP BY state;

-- Connections by application
SELECT
    application_name,
    state,
    COUNT(*) as count
FROM pg_stat_activity
WHERE datname = 'claude_agent_ui'
GROUP BY application_name, state
ORDER BY count DESC;

-- Long-running queries
SELECT
    pid,
    usename,
    application_name,
    NOW() - query_start AS duration,
    state,
    query
FROM pg_stat_activity
WHERE state != 'idle'
    AND query_start < NOW() - INTERVAL '5 seconds'
ORDER BY duration DESC;
```

#### 2. Query Performance

```sql
-- Top 10 slowest queries (requires pg_stat_statements)
SELECT
    substring(query, 1, 100) as short_query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time,
    rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Top 10 most frequent queries
SELECT
    substring(query, 1, 100) as short_query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- Cache hit ratio (should be > 99%)
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
FROM pg_statio_user_tables;
```

#### 3. Index Usage

```sql
-- Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Unused indexes (candidates for removal)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### 4. Table Statistics

```sql
-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Table bloat (dead tuples)
SELECT
    schemaname,
    tablename,
    n_live_tup,
    n_dead_tup,
    n_dead_tup::float / NULLIF(n_live_tup, 0) AS dead_ratio,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;
```

#### 5. Replication Lag (if using replication)

```sql
-- On primary server
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    sync_state,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;

-- On replica server
SELECT
    NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
```

### Automated Monitoring Setup

#### Prometheus Exporter

```bash
# Install postgres_exporter
docker run -d \
  --name postgres-exporter \
  -p 9187:9187 \
  -e DATA_SOURCE_NAME="postgresql://postgres:password@localhost:5432/claude_agent_ui?sslmode=disable" \
  prometheuscommunity/postgres-exporter
```

#### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "PostgreSQL - Claude Agent UI",
    "panels": [
      {
        "title": "Connections",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"claude_agent_ui\"}"
          }
        ]
      },
      {
        "title": "Transactions per Second",
        "targets": [
          {
            "expr": "rate(pg_stat_database_xact_commit{datname=\"claude_agent_ui\"}[5m])"
          }
        ]
      },
      {
        "title": "Cache Hit Ratio",
        "targets": [
          {
            "expr": "pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read)"
          }
        ]
      }
    ]
  }
}
```

### Maintenance Scripts

#### Daily Vacuum Script

```bash
#!/bin/bash
# /usr/local/bin/daily-vacuum.sh

PGHOST=localhost
PGPORT=5432
PGDATABASE=claude_agent_ui
PGUSER=postgres

echo "Starting daily vacuum at $(date)"

# Vacuum analyze all tables
vacuumdb -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -z -v

# Check for bloated tables
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "
SELECT
  schemaname,
  tablename,
  n_dead_tup,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
"

echo "Daily vacuum completed at $(date)"
```

#### Weekly Index Rebuild Script

```bash
#!/bin/bash
# /usr/local/bin/weekly-reindex.sh

PGHOST=localhost
PGPORT=5432
PGDATABASE=claude_agent_ui
PGUSER=postgres

echo "Starting weekly reindex at $(date)"

# Reindex all tables (concurrently to avoid locks)
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "
REINDEX INDEX CONCURRENTLY idx_agents_name;
REINDEX INDEX CONCURRENTLY idx_agents_enabled;
REINDEX INDEX CONCURRENTLY idx_skills_name;
REINDEX INDEX CONCURRENTLY idx_mcp_servers_name;
REINDEX INDEX CONCURRENTLY idx_tasks_agent_id;
"

echo "Weekly reindex completed at $(date)"
```

#### Cron Schedule

```cron
# /etc/cron.d/postgresql-maintenance

# Daily vacuum at 2 AM
0 2 * * * postgres /usr/local/bin/daily-vacuum.sh >> /var/log/postgresql/vacuum.log 2>&1

# Weekly reindex on Sunday at 3 AM
0 3 * * 0 postgres /usr/local/bin/weekly-reindex.sh >> /var/log/postgresql/reindex.log 2>&1

# Daily backup at 1 AM
0 1 * * * postgres /usr/local/bin/daily-backup.sh >> /var/log/postgresql/backup.log 2>&1
```

---

## Disaster Recovery

### Backup Strategy

#### 1. Full Database Backup (pg_dump)

```bash
#!/bin/bash
# /usr/local/bin/daily-backup.sh

BACKUP_DIR=/mnt/backups/postgresql
PGHOST=localhost
PGPORT=5432
PGDATABASE=claude_agent_ui
PGUSER=postgres
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Full database dump
pg_dump -h $PGHOST -p $PGPORT -U $PGUSER -F c -b -v -f "$BACKUP_DIR/claude_agent_ui_$TIMESTAMP.backup" $PGDATABASE

# Compress backup
gzip "$BACKUP_DIR/claude_agent_ui_$TIMESTAMP.backup"

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/claude_agent_ui_$TIMESTAMP.backup.gz" s3://my-backup-bucket/postgresql/

# Delete backups older than retention period
find $BACKUP_DIR -name "*.backup.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: claude_agent_ui_$TIMESTAMP.backup.gz"
```

#### 2. Point-in-Time Recovery (PITR) Setup

```ini
# postgresql.conf

wal_level = replica
archive_mode = on
archive_command = 'test ! -f /mnt/backup/wal_archive/%f && cp %p /mnt/backup/wal_archive/%f'
archive_timeout = 300  # Force WAL switch every 5 minutes
```

**Take Base Backup:**

```bash
# Start backup
psql -U postgres -c "SELECT pg_start_backup('base_backup');"

# Copy data directory
rsync -av --exclude 'pg_wal' /var/lib/postgresql/16/main/ /mnt/backup/base_backup/

# Stop backup
psql -U postgres -c "SELECT pg_stop_backup();"
```

**Restore to Point-in-Time:**

```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Remove current data
sudo rm -rf /var/lib/postgresql/16/main/*

# Restore base backup
sudo rsync -av /mnt/backup/base_backup/ /var/lib/postgresql/16/main/

# Create recovery.conf (PostgreSQL 12+: recovery.signal)
sudo touch /var/lib/postgresql/16/main/recovery.signal

# Configure restore point
echo "restore_command = 'cp /mnt/backup/wal_archive/%f %p'" | sudo tee -a /var/lib/postgresql/16/main/postgresql.auto.conf
echo "recovery_target_time = '2025-01-20 14:30:00'" | sudo tee -a /var/lib/postgresql/16/main/postgresql.auto.conf

# Start PostgreSQL (will replay WAL logs)
sudo systemctl start postgresql
```

### Replication Setup

#### Primary Server Configuration

```ini
# postgresql.conf (primary)

# Replication settings
wal_level = replica
max_wal_senders = 10
wal_keep_size = 1GB
hot_standby = on

# Archive mode (for PITR)
archive_mode = on
archive_command = 'rsync -a %p standby-server:/mnt/backup/wal_archive/%f'
```

```
# pg_hba.conf (primary)

# Allow replication connections from replica
host    replication    replication_user    10.0.1.0/24    scram-sha-256
```

#### Replica Server Setup

```bash
# On replica server

# Stop PostgreSQL
sudo systemctl stop postgresql

# Remove data directory
sudo rm -rf /var/lib/postgresql/16/main/*

# Take base backup from primary
pg_basebackup -h primary-server -D /var/lib/postgresql/16/main -U replication_user -P -v -R -X stream -C -S replica_1

# Start PostgreSQL (will start as replica)
sudo systemctl start postgresql
```

#### Failover Procedure

```bash
# On replica server (promote to primary)

# Promote replica
pg_ctl promote -D /var/lib/postgresql/16/main

# Or via SQL
psql -c "SELECT pg_promote();"

# Update application to point to new primary
# Update DNS, load balancer, or connection string
```

---

## Security Hardening

### Authentication

```
# pg_hba.conf (production)

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections (for maintenance)
local   all             postgres                                peer

# Remote connections (require SSL)
hostssl claude_agent_ui strapi_user     10.0.1.0/24             scram-sha-256
hostssl claude_agent_ui express_user    10.0.1.0/24             scram-sha-256

# Replication (require SSL)
hostssl replication     replication_user 10.0.2.0/24            scram-sha-256

# Deny all other connections
host    all             all             0.0.0.0/0               reject
```

### SSL Configuration

```ini
# postgresql.conf

ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
ssl_ca_file = '/etc/postgresql/ssl/ca.crt'
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'
ssl_prefer_server_ciphers = on
ssl_min_protocol_version = 'TLSv1.2'
```

### Row-Level Security (RLS)

```sql
-- Enable RLS on agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own agents
CREATE POLICY user_agents ON agents
    FOR ALL
    USING (created_by_id = current_setting('app.user_id')::integer);

-- Set user context in application
SET app.user_id = 123;  -- User ID from JWT token

-- Now queries only return agents owned by user 123
SELECT * FROM agents;
```

### Audit Logging

```sql
-- Create audit table
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, new_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, old_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), current_user);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to agents table
CREATE TRIGGER agents_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- Apply to other tables
CREATE TRIGGER skills_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();
```

---

## Conclusion

This comprehensive PostgreSQL analysis provides a complete roadmap for migrating the Claude Agent UI from SQLite to PostgreSQL. Key takeaways:

### ✅ Benefits of Migration

1. **Scalability:** Handle thousands of concurrent connections with proper connection pooling
2. **Performance:** Advanced indexing (B-tree, GIN, GiST) for fast queries
3. **Reliability:** ACID compliance, streaming replication, point-in-time recovery
4. **Features:** Native JSONB, full-text search, advanced aggregations
5. **Production-Ready:** Monitoring, backup, disaster recovery, security hardening

### 🎯 Critical Success Factors

1. **Proper Indexing:** GIN indexes for JSONB, B-tree for foreign keys, partial indexes for filtered queries
2. **Connection Pooling:** Configured correctly for Strapi (10 connections) and Express (5 connections)
3. **Migration Script:** Complete, tested, and validated data migration
4. **Monitoring:** pg_stat_statements, Prometheus, Grafana dashboards
5. **Backup Strategy:** Daily pg_dump, WAL archiving, tested disaster recovery

### 📊 Expected Performance Improvements

| Metric | SQLite | PostgreSQL | Improvement |
|--------|--------|------------|-------------|
| **Concurrent Writes** | Limited (file lock) | 100+ connections | 10x+ |
| **Read Performance** | ~1000 reads/sec | ~10,000 reads/sec | 10x |
| **JSON Queries** | Slow (no index) | Fast (GIN index) | 100x |
| **Full-Text Search** | Basic FTS5 | Advanced GIN | 10x |
| **Replication** | Not supported | Built-in | ∞ |
| **Max Database Size** | ~281 TB | Unlimited | ∞ |

### 🚀 Next Steps

1. **Phase 1:** Set up PostgreSQL server and configure postgresql.conf
2. **Phase 2:** Run migration script and validate data integrity
3. **Phase 3:** Configure Strapi and Express connection pools
4. **Phase 4:** Deploy to staging and run load tests
5. **Phase 5:** Deploy to production with monitoring
6. **Phase 6:** Set up backup, replication, and disaster recovery

---

**Document Version:** 1.0
**Last Updated:** 2025-01-20
**Prepared By:** Claude PostgreSQL Expert
**Contact:** N/A (AI-generated documentation)

---

## Appendix: Quick Reference Commands

### Common PostgreSQL Commands

```bash
# Connect to database
psql -h localhost -U postgres -d claude_agent_ui

# List databases
\l

# List tables
\dt

# Describe table
\d agents

# List indexes
\di

# Show table sizes
\dt+

# Execute SQL file
psql -h localhost -U postgres -d claude_agent_ui -f migration.sql

# Backup database
pg_dump -U postgres claude_agent_ui > backup.sql

# Restore database
psql -U postgres claude_agent_ui < backup.sql

# Vacuum database
vacuumdb -U postgres -d claude_agent_ui -z

# Reindex database
reindexdb -U postgres -d claude_agent_ui
```

### Useful SQL Queries

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('claude_agent_ui'));

-- Check table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check current connections
SELECT * FROM pg_stat_activity WHERE datname = 'claude_agent_ui';

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'claude_agent_ui'
    AND state = 'idle'
    AND state_change < NOW() - INTERVAL '1 hour';

-- Check replication status
SELECT * FROM pg_stat_replication;

-- Check last vacuum time
SELECT
    schemaname,
    tablename,
    last_vacuum,
    last_autovacuum,
    vacuum_count,
    autovacuum_count
FROM pg_stat_user_tables;
```

---

**END OF DOCUMENT**
