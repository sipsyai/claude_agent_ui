-- ============================================================
-- Claude Agent UI - PostgreSQL Index Strategies
-- ============================================================
-- Task 02: PostgreSQL Schema & Configuration
-- Version: 1.0
-- PostgreSQL Version: 16+
-- ============================================================
--
-- Index Types:
--   - B-tree: Default, for equality and range queries
--   - GIN: For JSONB containment and array operations
--   - Partial: For frequently filtered subsets
--   - Composite: For multi-column queries
--
-- ============================================================

\echo 'Creating indexes for Claude Agent UI...'
\echo ''

-- ============================================================
-- B-TREE INDEXES
-- For equality, range queries, and sorting
-- ============================================================

\echo '📊 Creating B-tree indexes...'

-- USERS TABLE
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_confirmed ON users(confirmed) WHERE confirmed = true;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- AGENTS TABLE
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_enabled ON agents(enabled) WHERE enabled = true;
CREATE INDEX idx_agents_model ON agents(model);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);
CREATE INDEX idx_agents_updated_at ON agents(updated_at DESC);
CREATE INDEX idx_agents_created_by_id ON agents(created_by_id);
CREATE INDEX idx_agents_published_at ON agents(published_at DESC);

-- SKILLS TABLE
CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_experience_score ON skills(experience_score DESC);
CREATE INDEX idx_skills_created_at ON skills(created_at DESC);
CREATE INDEX idx_skills_updated_at ON skills(updated_at DESC);
CREATE INDEX idx_skills_created_by_id ON skills(created_by_id);

-- MCP SERVERS TABLE
CREATE INDEX idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX idx_mcp_servers_disabled ON mcp_servers(disabled) WHERE disabled = false;
CREATE INDEX idx_mcp_servers_transport ON mcp_servers(transport);
CREATE INDEX idx_mcp_servers_created_at ON mcp_servers(created_at DESC);

-- TASKS TABLE
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_tasks_started_at ON tasks(started_at DESC) WHERE started_at IS NOT NULL;

-- JUNCTION TABLES
CREATE INDEX idx_agents_skills_agent_id ON agents_skills_links(agent_id);
CREATE INDEX idx_agents_skills_skill_id ON agents_skills_links(skill_id);
CREATE INDEX idx_agents_mcps_agent_id ON agents_mcp_servers_links(agent_id);
CREATE INDEX idx_agents_mcps_mcp_id ON agents_mcp_servers_links(mcp_server_id);

\echo '✅ B-tree indexes created'
\echo ''

-- ============================================================
-- GIN INDEXES
-- For JSONB containment and array queries
-- ============================================================

\echo '📦 Creating GIN indexes for JSONB columns...'

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

\echo '✅ GIN indexes for JSONB created'
\echo ''

-- ============================================================
-- FULL-TEXT SEARCH INDEXES (GIN)
-- For searching across text fields
-- ============================================================

\echo '🔍 Creating full-text search indexes...'

-- Create GIN indexes on tsvector columns (already created by schema)
CREATE INDEX idx_agents_search_gin ON agents USING GIN (search_vector);
CREATE INDEX idx_skills_search_gin ON skills USING GIN (search_vector);

\echo '✅ Full-text search indexes created'
\echo ''

-- ============================================================
-- PARTIAL INDEXES
-- For frequently filtered subsets
-- ============================================================

\echo '🎯 Creating partial indexes...'

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

-- Only index running tasks (for monitoring)
CREATE INDEX idx_tasks_running ON tasks(started_at DESC)
    WHERE status = 'running';

\echo '✅ Partial indexes created'
\echo ''

-- ============================================================
-- COMPOSITE INDEXES
-- For queries with multiple filter conditions
-- ============================================================

\echo '🔗 Creating composite indexes...'

-- Agent queries: enabled + model
CREATE INDEX idx_agents_enabled_model ON agents(enabled, model)
    WHERE enabled = true;

-- Task queries: agent + status + created_at
CREATE INDEX idx_tasks_agent_status_created ON tasks(agent_id, status, created_at DESC);

-- Junction table queries: bidirectional lookups
CREATE INDEX idx_agents_skills_composite ON agents_skills_links(agent_id, skill_order);
CREATE INDEX idx_agents_mcps_composite ON agents_mcp_servers_links(agent_id, mcp_server_order);

-- User audit tracking
CREATE INDEX idx_agents_created_by_created_at ON agents(created_by_id, created_at DESC);
CREATE INDEX idx_skills_created_by_created_at ON skills(created_by_id, created_at DESC);

\echo '✅ Composite indexes created'
\echo ''

-- ============================================================
-- INDEX STATISTICS AND VERIFICATION
-- ============================================================

\echo '📈 Index statistics:'
\echo ''

-- Show all indexes with their sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY tablename, indexname;

\echo ''
\echo '✅ All indexes created successfully!'
\echo ''
\echo 'Index Strategy Summary:'
\echo '  📊 B-tree indexes: For primary key lookups, sorting, and range queries'
\echo '  📦 GIN indexes: For JSONB containment queries (@>, ?, &&)'
\echo '  🔍 Full-text search: For semantic search across agents and skills'
\echo '  🎯 Partial indexes: For frequently filtered subsets (enabled, active)'
\echo '  🔗 Composite indexes: For multi-column queries'
\echo ''
\echo 'Query Examples:'
\echo '  - Find agents with Read tool:'
\echo '    SELECT * FROM agents WHERE tools @> ''["Read"]'';'
\echo ''
\echo '  - Full-text search for "web scraping":'
\echo '    SELECT * FROM agents WHERE search_vector @@ to_tsquery(''web & scraping'');'
\echo ''
\echo '  - Find enabled agents using sonnet model:'
\echo '    SELECT * FROM agents WHERE enabled = true AND model = ''sonnet'';'
\echo ''
\echo 'Maintenance Commands:'
\echo '  - Analyze all tables: ANALYZE;'
\echo '  - Check index usage: SELECT * FROM pg_stat_user_indexes;'
\echo '  - Find unused indexes: SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;'
\echo '  - Rebuild indexes: REINDEX TABLE agents;'
\echo ''

-- Analyze all tables to update statistics
ANALYZE users;
ANALYZE agents;
ANALYZE skills;
ANALYZE mcp_servers;
ANALYZE tasks;
ANALYZE agents_skills_links;
ANALYZE agents_mcp_servers_links;
ANALYZE audit_log;

\echo '✅ Table statistics updated (ANALYZE completed)'
