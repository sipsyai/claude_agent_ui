-- ============================================================
-- Claude Agent UI - Seed Data (Development/Testing)
-- ============================================================
-- Task 02: PostgreSQL Schema & Configuration
-- Version: 1.0
-- Purpose: Insert test data for development and testing
-- ============================================================

\echo 'Inserting seed data for Claude Agent UI...'
\echo ''

-- ============================================================
-- USERS
-- ============================================================

\echo '👤 Creating test users...'

INSERT INTO users (username, email, provider, password, confirmed, blocked) VALUES
('admin', 'admin@claudeagent.local', 'local', '$2a$10$dummyhashedpassword', true, false),
('developer', 'developer@claudeagent.local', 'local', '$2a$10$dummyhashedpassword', true, false),
('tester', 'tester@claudeagent.local', 'local', '$2a$10$dummyhashedpassword', true, false);

\echo '✅ Created 3 test users'
\echo ''

-- ============================================================
-- SKILLS
-- ============================================================

\echo '🎯 Creating test skills...'

INSERT INTO skills (name, description, content, allowed_tools, experience_score, created_by_id) VALUES
(
    'code-review',
    'Expert code review and analysis skill',
    '# Code Review Skill

You are an expert code reviewer. Analyze code for:
- Code quality and maintainability
- Security vulnerabilities
- Performance issues
- Best practices compliance

Provide detailed feedback with specific recommendations.',
    '["Read", "Grep", "Glob"]'::jsonb,
    85.50,
    1
),
(
    'web-scraping',
    'Web scraping and data extraction',
    '# Web Scraping Skill

You are an expert web scraper. Extract data from websites using:
- WebFetch for fetching web content
- HTML parsing and data extraction
- Data transformation and cleaning

Follow robots.txt and rate limiting best practices.',
    '["WebFetch", "Write", "Read"]'::jsonb,
    72.30,
    1
),
(
    'database-design',
    'Database schema design and optimization',
    '# Database Design Skill

You are a database architect. Design and optimize:
- Database schemas (PostgreSQL, MySQL)
- Index strategies
- Query optimization
- Data modeling

Focus on performance, scalability, and maintainability.',
    '["Read", "Write", "Bash"]'::jsonb,
    90.00,
    1
),
(
    'api-testing',
    'REST API testing and validation',
    '# API Testing Skill

You are an API testing expert. Test and validate:
- REST API endpoints
- Request/response validation
- Authentication and authorization
- Error handling

Use appropriate tools and report findings.',
    '["Bash", "Read", "Write"]'::jsonb,
    78.25,
    2
);

\echo '✅ Created 4 test skills'
\echo ''

-- ============================================================
-- MCP SERVERS
-- ============================================================

\echo '🔌 Creating test MCP servers...'

INSERT INTO mcp_servers (name, command, args, env, disabled, transport, created_by_id) VALUES
(
    'filesystem',
    'npx',
    '["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]'::jsonb,
    '{}'::jsonb,
    false,
    'stdio',
    1
),
(
    'git-server',
    'npx',
    '["-y", "@modelcontextprotocol/server-git"]'::jsonb,
    '{}'::jsonb,
    false,
    'stdio',
    1
),
(
    'postgres-server',
    'node',
    '["/path/to/postgres-mcp-server.js"]'::jsonb,
    '{"DATABASE_URL": "postgresql://localhost:5432/claude_agent_ui"}'::jsonb,
    false,
    'stdio',
    1
),
(
    'github-api',
    'npx',
    '["-y", "@modelcontextprotocol/server-github"]'::jsonb,
    '{"GITHUB_TOKEN": "your_token_here"}'::jsonb,
    true,
    'sse',
    2
);

\echo '✅ Created 4 test MCP servers'
\echo ''

-- ============================================================
-- AGENTS
-- ============================================================

\echo '🤖 Creating test agents...'

INSERT INTO agents (name, description, system_prompt, tools, disallowed_tools, model, enabled, created_by_id) VALUES
(
    'code-reviewer',
    'Expert code reviewer and analyzer',
    'You are an expert code reviewer with deep knowledge of software engineering best practices. Review code for quality, security, performance, and maintainability. Provide constructive feedback with specific examples and recommendations.',
    '["Read", "Grep", "Glob", "Edit"]'::jsonb,
    '["Bash"]'::jsonb,
    'sonnet',
    true,
    1
),
(
    'web-scraper',
    'Intelligent web scraping agent',
    'You are a web scraping expert. Extract structured data from websites while respecting robots.txt and rate limits. Transform and clean the extracted data for downstream use.',
    '["WebFetch", "Read", "Write", "Bash"]'::jsonb,
    '[]'::jsonb,
    'sonnet',
    true,
    1
),
(
    'database-architect',
    'Database design and optimization specialist',
    'You are a database architect specializing in PostgreSQL. Design optimal schemas, create efficient indexes, and optimize queries for performance. Consider scalability, maintainability, and data integrity in all recommendations.',
    '["Read", "Write", "Bash", "Grep"]'::jsonb,
    '[]'::jsonb,
    'opus',
    true,
    1
),
(
    'api-tester',
    'REST API testing and validation agent',
    'You are an API testing specialist. Test REST APIs thoroughly, validate responses, check authentication, and identify edge cases. Document findings clearly and suggest improvements.',
    '["Bash", "Read", "Write", "WebFetch"]'::jsonb,
    '[]'::jsonb,
    'haiku',
    true,
    2
),
(
    'general-assistant',
    'General-purpose AI assistant',
    'You are a helpful AI assistant. Answer questions, help with tasks, and provide guidance across a wide range of topics. Be clear, concise, and accurate in your responses.',
    '["Read", "Write", "Bash", "WebFetch", "Grep", "Glob"]'::jsonb,
    '[]'::jsonb,
    'sonnet',
    true,
    1
),
(
    'dev-agent-disabled',
    'Disabled development agent',
    'This is a disabled test agent for testing UI functionality.',
    '[]'::jsonb,
    '[]'::jsonb,
    'haiku',
    false,
    3
);

\echo '✅ Created 6 test agents'
\echo ''

-- ============================================================
-- JUNCTION TABLES - AGENTS <-> SKILLS
-- ============================================================

\echo '🔗 Linking agents to skills...'

INSERT INTO agents_skills_links (agent_id, skill_id, skill_order) VALUES
-- code-reviewer agent uses code-review skill
(1, 1, 1.0),
-- web-scraper agent uses web-scraping skill
(2, 2, 1.0),
-- database-architect agent uses database-design skill
(3, 3, 1.0),
(3, 1, 2.0), -- also uses code-review for reviewing database code
-- api-tester agent uses api-testing skill
(4, 4, 1.0),
-- general-assistant uses multiple skills
(5, 1, 1.0),
(5, 2, 2.0),
(5, 4, 3.0);

\echo '✅ Created 8 agent-skill links'
\echo ''

-- ============================================================
-- JUNCTION TABLES - AGENTS <-> MCP SERVERS
-- ============================================================

\echo '🔗 Linking agents to MCP servers...'

INSERT INTO agents_mcp_servers_links (agent_id, mcp_server_id, mcp_server_order) VALUES
-- code-reviewer uses filesystem and git
(1, 1, 1.0),
(1, 2, 2.0),
-- web-scraper uses filesystem
(2, 1, 1.0),
-- database-architect uses filesystem and postgres
(3, 1, 1.0),
(3, 3, 2.0),
-- api-tester uses filesystem
(4, 1, 1.0),
-- general-assistant uses all available servers
(5, 1, 1.0),
(5, 2, 2.0),
(5, 3, 3.0);

\echo '✅ Created 9 agent-MCP server links'
\echo ''

-- ============================================================
-- TASKS (Sample execution history)
-- ============================================================

\echo '📋 Creating sample task history...'

INSERT INTO tasks (agent_id, message, status, result, started_at, completed_at, duration_ms, created_by_id) VALUES
(
    1,
    'Review the authentication module for security issues',
    'completed',
    '{"findings": ["XSS vulnerability in login form", "Missing CSRF token"], "severity": "high"}'::jsonb,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour 55 minutes',
    300000,
    1
),
(
    2,
    'Scrape product prices from example.com',
    'completed',
    '{"products": 42, "total_price": 1234.56, "timestamp": "2025-10-31T10:00:00Z"}'::jsonb,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '58 minutes',
    120000,
    1
),
(
    3,
    'Design schema for e-commerce platform',
    'completed',
    '{"tables": ["products", "orders", "customers", "inventory"], "indexes": 12}'::jsonb,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '2 hours 30 minutes',
    1800000,
    1
),
(
    4,
    'Test user registration API endpoint',
    'completed',
    '{"tests_passed": 8, "tests_failed": 2, "coverage": "80%"}'::jsonb,
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '25 minutes',
    300000,
    2
),
(
    5,
    'Analyze codebase and provide recommendations',
    'running',
    NULL,
    NOW() - INTERVAL '5 minutes',
    NULL,
    NULL,
    1
),
(
    1,
    'Review failed deployment script',
    'failed',
    NULL,
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '8 minutes',
    120000,
    1
),
(
    2,
    'Monitor price changes on competitor website',
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    1
);

\echo '✅ Created 7 sample tasks'
\echo ''

-- ============================================================
-- DATA VERIFICATION
-- ============================================================

\echo '🔍 Verifying seed data...'
\echo ''

-- Count records
SELECT
    'users' as table_name,
    COUNT(*) as record_count
FROM users
UNION ALL
SELECT 'agents', COUNT(*) FROM agents
UNION ALL
SELECT 'skills', COUNT(*) FROM skills
UNION ALL
SELECT 'mcp_servers', COUNT(*) FROM mcp_servers
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'agents_skills_links', COUNT(*) FROM agents_skills_links
UNION ALL
SELECT 'agents_mcp_servers_links', COUNT(*) FROM agents_mcp_servers_links
ORDER BY table_name;

\echo ''
\echo '✅ Seed data inserted successfully!'
\echo ''
\echo 'Summary:'
\echo '  👤 Users: 3'
\echo '  🤖 Agents: 6 (5 enabled, 1 disabled)'
\echo '  🎯 Skills: 4'
\echo '  🔌 MCP Servers: 4 (3 enabled, 1 disabled)'
\echo '  📋 Tasks: 7 (3 completed, 1 running, 1 failed, 2 pending)'
\echo '  🔗 Agent-Skill Links: 8'
\echo '  🔗 Agent-MCP Links: 9'
\echo ''
\echo 'Test Accounts:'
\echo '  - admin@claudeagent.local (Admin user)'
\echo '  - developer@claudeagent.local (Developer user)'
\echo '  - tester@claudeagent.local (Tester user)'
\echo ''
\echo 'Note: Passwords are dummy hashed values for testing only.'
\echo '      Update them in production using Strapi admin panel.'
\echo ''
