-- ============================================================
-- Claude Agent UI - PostgreSQL Database Schema
-- ============================================================
-- Task 02: PostgreSQL Schema & Configuration
-- Version: 1.0
-- PostgreSQL Version: 16+
-- ============================================================

-- Drop existing tables (CASCADE removes dependent objects)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS agents_mcp_servers_links CASCADE;
DROP TABLE IF EXISTS agents_skills_links CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS mcp_servers CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS agents_search_vector_update() CASCADE;
DROP FUNCTION IF EXISTS skills_search_vector_update() CASCADE;
DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE;

-- ============================================================
-- USERS TABLE (Strapi Default)
-- ============================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    -- Core Fields
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(255) DEFAULT 'local',
    password VARCHAR(255),

    -- Password Reset
    reset_password_token VARCHAR(255) UNIQUE,
    confirmation_token VARCHAR(255) UNIQUE,

    -- Status
    confirmed BOOLEAN DEFAULT false,
    blocked BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE users IS 'Strapi users for authentication and authorization';
COMMENT ON COLUMN users.provider IS 'Authentication provider (local, google, github, etc.)';
COMMENT ON COLUMN users.confirmed IS 'Email confirmation status';
COMMENT ON COLUMN users.blocked IS 'Account blocked status';

-- ============================================================
-- AGENTS TABLE
-- ============================================================

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

    -- Full-Text Search
    search_vector tsvector,

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Strapi Metadata
    published_at TIMESTAMP WITH TIME ZONE,
    locale VARCHAR(10)
);

COMMENT ON TABLE agents IS 'Claude agents with tools and skills configuration';
COMMENT ON COLUMN agents.tools IS 'Array of allowed tool names (JSONB for GIN indexing)';
COMMENT ON COLUMN agents.disallowed_tools IS 'Array of explicitly disallowed tool names';
COMMENT ON COLUMN agents.system_prompt IS 'System prompt that defines agent behavior';
COMMENT ON COLUMN agents.model IS 'Claude model to use (sonnet, opus, haiku, etc.)';
COMMENT ON COLUMN agents.search_vector IS 'Full-text search vector (auto-updated by trigger)';

-- ============================================================
-- SKILLS TABLE
-- ============================================================

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

    -- Full-Text Search
    search_vector tsvector,

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Strapi Metadata
    published_at TIMESTAMP WITH TIME ZONE,
    locale VARCHAR(10)
);

COMMENT ON TABLE skills IS 'Reusable skills that can be assigned to agents';
COMMENT ON COLUMN skills.content IS 'Skill prompt content (markdown format)';
COMMENT ON COLUMN skills.experience_score IS 'Experience score from 0-100 based on training';
COMMENT ON COLUMN skills.allowed_tools IS 'Array of tools this skill can use';
COMMENT ON COLUMN skills.search_vector IS 'Full-text search vector (auto-updated by trigger)';

-- ============================================================
-- MCP SERVERS TABLE
-- ============================================================

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

COMMENT ON TABLE mcp_servers IS 'MCP server configurations for agent execution';
COMMENT ON COLUMN mcp_servers.command IS 'Executable command to start MCP server';
COMMENT ON COLUMN mcp_servers.args IS 'Command-line arguments (JSONB array)';
COMMENT ON COLUMN mcp_servers.env IS 'Environment variables (JSONB object)';
COMMENT ON COLUMN mcp_servers.transport IS 'Communication protocol (stdio, sse, http)';

-- ============================================================
-- TASKS TABLE
-- ============================================================

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
COMMENT ON COLUMN tasks.status IS 'Task status (pending, running, completed, failed, cancelled)';

-- ============================================================
-- JUNCTION TABLES (Many-to-Many Relations)
-- ============================================================

-- AGENTS <-> SKILLS (Many-to-Many)
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

-- AGENTS <-> MCP SERVERS (Many-to-Many)
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

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE audit_log IS 'Audit trail for all data modifications';
COMMENT ON COLUMN audit_log.operation IS 'SQL operation (INSERT, UPDATE, DELETE)';

-- ============================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically update updated_at column on row updates';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function: Update search vector for agents
CREATE OR REPLACE FUNCTION agents_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.system_prompt, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION agents_search_vector_update() IS 'Automatically update search_vector for full-text search on agents';

CREATE TRIGGER tsvector_update_agents
    BEFORE INSERT OR UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION agents_search_vector_update();

-- Function: Update search vector for skills
CREATE OR REPLACE FUNCTION skills_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION skills_search_vector_update() IS 'Automatically update search_vector for full-text search on skills';

CREATE TRIGGER tsvector_update_skills
    BEFORE INSERT OR UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION skills_search_vector_update();

-- Function: Audit trigger
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

COMMENT ON FUNCTION audit_trigger_func() IS 'Track all INSERT, UPDATE, DELETE operations for audit trail';

-- Apply audit triggers (optional - uncomment to enable)
-- CREATE TRIGGER agents_audit_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON agents
--     FOR EACH ROW
--     EXECUTE FUNCTION audit_trigger_func();

-- CREATE TRIGGER skills_audit_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON skills
--     FOR EACH ROW
--     EXECUTE FUNCTION audit_trigger_func();

-- CREATE TRIGGER mcp_servers_audit_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON mcp_servers
--     FOR EACH ROW
--     EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- SCHEMA VERIFICATION
-- ============================================================

-- List all tables
\dt

-- List all functions
\df

-- List all triggers
SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================

\echo '✅ Database schema created successfully!'
\echo ''
\echo 'Tables created:'
\echo '  - users (Strapi authentication)'
\echo '  - agents (Claude agents)'
\echo '  - skills (Reusable skills)'
\echo '  - mcp_servers (MCP server configurations)'
\echo '  - tasks (Task execution history)'
\echo '  - agents_skills_links (Agent-Skill relations)'
\echo '  - agents_mcp_servers_links (Agent-MCP relations)'
\echo '  - audit_log (Audit trail)'
\echo ''
\echo 'Next steps:'
\echo '  1. Run indexes.sql to create all indexes'
\echo '  2. Run seed-data.sql to insert test data'
\echo '  3. Configure postgresql.conf for production'
\echo '  4. Configure pg_hba.conf for authentication'
