# End-to-End Entity Testing

This document describes the E2E entity testing infrastructure for validating the PostgreSQL migration.

## Overview

The E2E entity test creates test data for all entity types via the Strapi API and verifies correct storage, retrieval, and relations. This is a critical validation step for the PostgreSQL migration.

## Entity Types Tested

The test validates all 7 Strapi content types:

1. **MCP Servers** (`mcp-servers`) - Model Context Protocol servers
2. **MCP Tools** (`mcp-tools`) - Tools provided by MCP servers
3. **Skills** (`skills`) - Claude Agent SDK skills
4. **Agents** (`agents`) - Claude AI agents with tools, skills, and MCP servers
5. **Tasks** (`tasks`) - Agent execution tasks and history
6. **Chat Sessions** (`chat-sessions`) - Chat sessions for Claude Agent UI
7. **Chat Messages** (`chat-messages`) - Individual messages within chat sessions

## Test Phases

The test runs in three phases, respecting entity dependencies:

### Phase 1: Independent Entities

Entities that don't depend on others:
- MCP Servers
- Skills
- Tasks

### Phase 2: Dependent Entities

Entities that reference Phase 1 entities:
- MCP Tools (references MCP Server)
- Agents (references Skills and MCP Servers)

### Phase 3: Chat Entities

Entities for chat functionality:
- Chat Sessions (references Agent and Skills)
- Chat Messages (references Chat Session)

## What Gets Tested

For each entity type, the test performs:

1. **Create**: POST request to create entity via Strapi API
2. **Retrieve**: GET request to fetch created entity
3. **Data Integrity**: Verify all fields match expected values
4. **Components**: Verify component structures (for entities with components)
5. **Relations**: Verify relations to other entities

## Running the Tests

### Prerequisites

1. **Strapi Backend Running**: The test requires Strapi to be running at `http://localhost:1337` (or `STRAPI_API_URL` environment variable)

   ```bash
   # Option 1: Docker Compose
   docker-compose up -d strapi postgres

   # Option 2: Development mode
   cd backend && npm run develop
   ```

2. **Node.js Dependencies**: Ensure all dependencies are installed

   ```bash
   npm install
   ```

### Running the Test

```bash
# Using npm script (recommended)
npm run test:e2e-entities

# Or directly
bash ./scripts/test-e2e-entities.sh

# Or with tsx
tsx ./scripts/test-e2e-entities.ts
```

### Environment Variables

- `STRAPI_API_URL` - Strapi API URL (default: `http://localhost:1337/api`)

Example:
```bash
STRAPI_API_URL=http://localhost:1337/api npm run test:e2e-entities
```

## Test Output

### Console Output

The test provides real-time progress updates:

```
=================================================
PostgreSQL E2E Entity Test
=================================================

Testing against: http://localhost:1337

Running tests in order (respecting dependencies)...

Phase 1: Independent entities
─────────────────────────────
✅ mcp-server - create: Created with ID 1
✅ mcp-server - retrieve: Data integrity verified
✅ skill - create: Created with ID 1
✅ skill - retrieve: Data integrity verified
✅ task - create: Created with ID 1
✅ task - retrieve: Data integrity verified

Phase 2: Dependent entities
─────────────────────────────
✅ mcp-tool - create: Created with ID 1
✅ mcp-tool - retrieve: Data integrity and relation verified
✅ agent - create: Created with ID 1
✅ agent - retrieve: Data integrity and components verified

Phase 3: Chat entities
─────────────────────────────
✅ chat-session - create: Created with ID 1
✅ chat-session - retrieve: Data integrity and relations verified
✅ chat-message - create: Created with ID 1
✅ chat-message - retrieve: Data integrity and relation verified

=================================================
Test Results Summary
=================================================

Total Tests: 14
Passed: 14 ✅
Failed: 0 ❌
Success Rate: 100.0%

Results by Entity:
─────────────────────────────
✅ mcp-server: 2/2 passed
✅ mcp-tool: 2/2 passed
✅ skill: 2/2 passed
✅ agent: 2/2 passed
✅ task: 2/2 passed
✅ chat-session: 2/2 passed
✅ chat-message: 2/2 passed

Created Entity IDs:
─────────────────────────────
MCP Server: 1
MCP Tool: 1
Skill: 1
Agent: 1
Task: 1
Chat Session: 1
Chat Message: 1

Detailed report saved to: ./test-results/e2e-entities-report.json

=================================================
```

### JSON Report

A detailed JSON report is saved to `./test-results/e2e-entities-report.json`:

```json
{
  "timestamp": "2026-01-02T...",
  "totalTests": 14,
  "passed": 14,
  "failed": 0,
  "results": [
    {
      "entity": "mcp-server",
      "operation": "create",
      "success": true,
      "message": "Created with ID 1",
      "data": {
        "id": 1
      }
    },
    {
      "entity": "mcp-server",
      "operation": "retrieve",
      "success": true,
      "message": "Data integrity verified",
      "data": {
        "name": "Test MCP Server E2E",
        "description": "Test MCP server for E2E validation",
        ...
      }
    },
    ...
  ]
}
```

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed or fatal error occurred

## Test Data Created

The test creates the following test data:

### MCP Server
- Name: "Test MCP Server E2E"
- Command: "node"
- Transport: "stdio"

### MCP Tool
- Name: "test_tool_e2e"
- Linked to MCP Server

### Skill
- Name: "test-skill-e2e"
- Display Name: "Test Skill E2E"
- Category: "custom"

### Agent
- Name: "Test Agent E2E"
- Model: "sonnet"
- Linked to Skill and MCP Server
- Has toolConfig, modelConfig, and analytics components

### Task
- Message: "Test task for E2E validation"
- Status: "completed"
- Execution metrics included

### Chat Session
- Title: "Test Chat Session E2E"
- Linked to Agent and Skill

### Chat Message
- Role: "user"
- Content: "This is a test message for E2E validation"
- Linked to Chat Session

## Validation Checks

### For All Entities

- ✅ Entity created successfully (receives ID)
- ✅ Entity can be retrieved by ID
- ✅ All required fields match expected values
- ✅ Data types are correct

### For Entities with Components

- ✅ `modelConfig` component present and valid (Agent)
- ✅ `toolConfig` component present and valid (Agent)
- ✅ `analytics` component present (Agent)
- ✅ Component arrays work (skillSelection, mcpConfig)

### For Entities with Relations

- ✅ MCP Tool → MCP Server relation
- ✅ Agent → Skills relation (via skillSelection component)
- ✅ Agent → MCP Servers relation (via mcpConfig component)
- ✅ Chat Session → Agent relation
- ✅ Chat Session → Skills relation (many-to-many)
- ✅ Chat Message → Chat Session relation

## Troubleshooting

### Test Fails: "Strapi is not running"

**Solution**: Start Strapi backend

```bash
# Docker Compose
docker-compose up -d strapi postgres

# Or development mode
cd backend && npm run develop
```

### Test Fails: "tsx is not installed"

**Solution**: Install dependencies

```bash
npm install
```

### Test Fails: Entity creation errors

**Possible causes**:
1. Database schema not up to date
2. Database connection issues
3. Missing required fields

**Solutions**:
```bash
# Verify database tables exist
npm run verify:tables

# Check database health
npm run test:health

# Restart services
docker-compose restart strapi postgres
```

### Test Creates Entities But Retrieval Fails

**Possible causes**:
1. API permissions issues
2. PostgreSQL query errors
3. Component/relation configuration issues

**Solutions**:
```bash
# Check Strapi logs
docker-compose logs strapi

# Check PostgreSQL logs
docker-compose logs postgres

# Verify database connectivity
npm run test:health
```

## Integration with CI/CD

This test can be integrated into CI/CD pipelines:

```yaml
# Example: GitHub Actions
- name: Run E2E Entity Tests
  run: |
    docker-compose up -d strapi postgres
    sleep 30  # Wait for services to be ready
    npm run test:e2e-entities
  env:
    STRAPI_API_URL: http://localhost:1337/api
```

## Cleanup

The test creates entities in the database. To clean up test data:

```sql
-- Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d claude_agent_ui

-- Delete test entities (be careful in production!)
DELETE FROM chat_messages WHERE content LIKE '%E2E validation%';
DELETE FROM chat_sessions WHERE title LIKE '%Test Chat Session E2E%';
DELETE FROM tasks WHERE message LIKE '%Test task for E2E validation%';
DELETE FROM agents WHERE name = 'Test Agent E2E';
DELETE FROM skills WHERE name = 'test-skill-e2e';
DELETE FROM mcp_tools WHERE name = 'test_tool_e2e';
DELETE FROM mcp_servers WHERE name = 'Test MCP Server E2E';
```

Or reset the entire database:

```bash
# WARNING: This will delete ALL data
docker-compose down -v
docker-compose up -d
```

## Best Practices

1. **Run Before Deployment**: Always run E2E tests before deploying to production
2. **Monitor Test Reports**: Review JSON reports for trends and issues
3. **Clean Test Data**: Regularly clean up test entities in non-production environments
4. **Version Control**: Keep test data structures in sync with schema changes
5. **Automated Testing**: Integrate into CI/CD for every deployment

## Related Documentation

- [PostgreSQL Verification Guide](../POSTGRES_VERIFICATION_GUIDE.md)
- [Health Check Endpoints](./HEALTH_CHECK_ENDPOINTS.md)
- [Backup Procedures](./BACKUP_PROCEDURES.md)
- [Restore Procedures](./RESTORE_PROCEDURES.md)

## Acceptance Criteria Verification

This test validates subtask 6.1 acceptance criteria:

✅ **Create agents, skills, MCP servers, tasks via API**
- All entity types successfully created via Strapi API
- API endpoints respond correctly
- Data persisted to PostgreSQL

✅ **Query and verify data integrity**
- All entities successfully retrieved by ID
- Field values match expected data
- Data types are correct
- No data corruption

✅ **Test relations between entities**
- MCP Tool → MCP Server relation verified
- Agent → Skills relation verified (component-based)
- Agent → MCP Servers relation verified (component-based)
- Chat Session → Agent relation verified
- Chat Session → Skills relation verified (many-to-many)
- Chat Message → Chat Session relation verified

## Summary

The E2E entity test provides comprehensive validation of the PostgreSQL migration by:
- Creating test data for all 7 entity types
- Verifying correct storage and retrieval
- Testing component structures
- Testing relations between entities
- Generating detailed reports

This ensures the PostgreSQL migration is production-ready and all CRUD operations work correctly.
