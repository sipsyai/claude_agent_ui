# PostgreSQL Table Verification Guide

This guide provides manual verification steps for confirming that all Strapi content types have successfully created their PostgreSQL tables.

## Quick Verification

### Automated Verification Script

The fastest way to verify all tables is to use the automated script:

```bash
npm run verify:tables
```

This script will:
- ✅ Connect to PostgreSQL database
- ✅ Verify all 7 content type tables exist
- ✅ Check table schemas have required columns
- ✅ Verify component tables are created
- ✅ Test foreign key relationships
- ✅ Run basic CRUD operations

Expected output: All checks should show ✅ with a final "VERIFICATION PASSED!" message.

## Manual Verification Steps

If you prefer to verify manually or the automated script fails:

### Step 1: Start PostgreSQL

Ensure your PostgreSQL database is running:

```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# If not running, start it
docker-compose up -d postgres
```

### Step 2: Start Strapi

Start Strapi in development mode to ensure it creates all tables:

```bash
cd backend
npm run develop
```

Watch the console output for:
- Database connection success messages
- Schema synchronization messages
- No errors related to table creation

### Step 3: Verify Tables via psql

Connect to PostgreSQL and verify tables exist:

```bash
# Connect to PostgreSQL
docker exec -it <container-name> psql -U strapi -d strapi

# Or if PostgreSQL is running locally
psql -U strapi -d strapi
```

Run the following SQL commands:

```sql
-- List all tables (should see 7 content type tables + components)
\dt

-- Verify specific content type tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'agents',
  'skills',
  'mcp_servers',
  'tasks',
  'chat_sessions',
  'chat_messages',
  'mcp_tools'
);

-- Should return 7 rows
```

### Step 4: Verify Table Schemas

Check that each table has the required columns:

```sql
-- Verify agents table
\d agents

-- Verify skills table
\d skills

-- Verify mcp_servers table
\d mcp_servers

-- Verify tasks table
\d tasks

-- Verify chat_sessions table
\d chat_sessions

-- Verify chat_messages table
\d chat_messages

-- Verify mcp_tools table
\d mcp_tools
```

### Step 5: Verify Component Tables

Component tables should exist for Strapi components:

```sql
-- List all component tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'components_%'
ORDER BY table_name;
```

Expected component tables:
- `components_agent_tool_configurations`
- `components_agent_model_configurations`
- `components_agent_analytics`
- `components_shared_metadata`
- `components_mcp_server_selections`
- `components_skill_skill_selections`
- `components_task_task_selections`
- And more...

### Step 6: Verify Relations

Check foreign key relationships:

```sql
-- View all foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('agents', 'skills', 'mcp_servers', 'tasks', 'chat_sessions', 'chat_messages', 'mcp_tools');
```

### Step 7: Test CRUD Operations via Strapi API

Test that you can create, read, update, and delete records via the Strapi API:

```bash
# Get all agents (should return empty array if no data)
curl http://localhost:1337/api/agents

# Get all skills
curl http://localhost:1337/api/skills

# Get all MCP servers
curl http://localhost:1337/api/mcp-servers

# Get all tasks
curl http://localhost:1337/api/tasks

# Get all chat sessions
curl http://localhost:1337/api/chat-sessions

# Get all chat messages
curl http://localhost:1337/api/chat-messages

# Get all MCP tools
curl http://localhost:1337/api/mcp-tools
```

All requests should return:
- HTTP 200 status
- JSON response with `data` array (may be empty)
- `meta` object with pagination info

## Expected Results

### ✅ Acceptance Criteria

All of the following must be true:

1. **All 7 content types create tables successfully**
   - ✅ `agents` table exists
   - ✅ `skills` table exists
   - ✅ `mcp_servers` table exists
   - ✅ `tasks` table exists
   - ✅ `chat_sessions` table exists
   - ✅ `chat_messages` table exists
   - ✅ `mcp_tools` table exists

2. **Relations and components work correctly**
   - ✅ Component tables created for all components
   - ✅ Foreign key relationships established
   - ✅ Junction tables created for many-to-many relations

3. **CRUD operations function on all entities**
   - ✅ Can query all tables via Strapi API
   - ✅ No errors when accessing endpoints
   - ✅ Pagination metadata present in responses

## Troubleshooting

### Tables Not Created

If tables are missing:

1. Check Strapi logs for errors during startup
2. Verify database connection in `backend/config/database.ts`
3. Ensure PostgreSQL is running: `docker ps | grep postgres`
4. Check DATABASE_* environment variables are set correctly
5. Try rebuilding Strapi: `cd backend && npm run build`

### Schema Errors

If columns are missing or incorrect:

1. Check content type schemas in `backend/src/api/*/content-types/*/schema.json`
2. Verify Strapi version compatibility with PostgreSQL
3. Check for migration errors in Strapi logs
4. Try dropping and recreating the database (development only!)

### Connection Errors

If unable to connect to PostgreSQL:

1. Verify PostgreSQL is running: `docker-compose ps postgres`
2. Check connection settings in `.env` file
3. Test connection manually: `psql -h localhost -p 5432 -U strapi -d strapi`
4. Check Docker network: `docker network ls`

## Additional Resources

- [Strapi Database Configuration](https://docs.strapi.io/dev-docs/configurations/database)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose PostgreSQL](https://hub.docker.com/_/postgres)

## Related Scripts

- `npm run verify:tables` - Automated table verification
- `npm run validate-migration` - Validate data migration
- `cd backend && npm run develop` - Start Strapi in development mode
- `cd backend && npm run build` - Build Strapi admin panel
