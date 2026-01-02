# MCP Protocol Integration Analysis
**Subtask 1.4 - Research & Analysis Phase**
**Created:** 2026-01-02

## Executive Summary

This document provides a comprehensive analysis of how Model Context Protocol (MCP) servers are configured, discovered, and integrated within the Claude Agent UI system. The MCP integration enables Claude agents to access external tools and capabilities through a standardized protocol.

---

## Table of Contents

1. [MCP Configuration System](#1-mcp-configuration-system)
2. [MCP Server Discovery](#2-mcp-server-discovery)
3. [MCP Tool Discovery](#3-mcp-tool-discovery)
4. [Integration with Claude SDK](#4-integration-with-claude-sdk)
5. [Data Model & Storage](#5-data-model--storage)
6. [API Layer](#6-api-layer)
7. [Frontend Management](#7-frontend-management)
8. [Complete Integration Flow](#8-complete-integration-flow)
9. [Key Insights](#9-key-insights)

---

## 1. MCP Configuration System

### 1.1 Configuration File Location

**Primary Configuration:**
- **Location:** `.mcp.json` at project root (SDK-aligned)
- **Format:** JSON with `mcpServers` object
- **Legacy Support:** Auto-migrates from `.claude/mcp.json` if found

**Configuration Structure:**
```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",           // Optional: stdio (default), sdk, sse, http
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/path/to/directory"
      },
      "disabled": false          // Optional: enable/disable server
    }
  }
}
```

### 1.2 Environment Variable Substitution

**File:** `src/services/mcp-service.ts`

The MCP configuration supports environment variable substitution:
- Patterns like `${ENV_VAR}` or `$ENV_VAR` are automatically replaced
- Applied during config loading via `substituteEnvVarsInObject()`
- Enables secure credential management without hardcoding

### 1.3 Transport Types

**Supported Transport Protocols:**

1. **stdio (default)** - External processes via stdin/stdout
   - Most common transport type
   - Used for CLI-based MCP servers (npx packages)
   - Communication via JSON-RPC over stdio

2. **sdk** - In-process SDK servers
   - Runs within the application
   - Registered via `mcpService.registerSdkServer()`
   - Direct JavaScript/TypeScript function calls

3. **sse** - Server-Sent Events
   - Remote servers with HTTP SSE
   - URL-based connection
   - Headers for authentication

4. **http** - HTTP polling
   - Remote servers with HTTP requests
   - URL-based connection
   - Headers for authentication

---

## 2. MCP Server Discovery

### 2.1 Discovery Sources (Priority Order)

**Three-tier discovery strategy** implemented in `claude-sdk-service.ts`:

```
Priority: Skill-specific > Agent-level > Project-level
```

**Source 1: Project-level (.mcp.json)** - Lowest Priority
- File: `.mcp.json` at project root
- Loaded via: `mcpService.getMCPServers(projectPath)`
- Scope: Available to all agents in the project

**Source 2: Agent-level (Strapi)** - Medium Priority
- Stored in: Strapi database (`mcp_servers` table)
- Loaded via: `loadMcpServersFromStrapi()`
- Scope: Agent-specific MCP servers
- Filters: Only enabled servers (`disabled: false`)

**Source 3: Skill-level (Strapi)** - Highest Priority
- Stored in: Skill's `mcpConfig` component array
- Loaded via: `loadMcpServersFromSkills()`
- Scope: Skill-specific MCP requirements
- Filters: Only enabled servers from selected skills

### 2.2 Discovery Service Implementation

**File:** `src/services/mcp-service.ts`

**Key Methods:**

```typescript
class MCPService {
  // Get all MCP servers from .mcp.json
  async getMCPServers(projectPath?: string): Promise<MCPServerInternal[]>

  // Get specific server by ID
  async getMCPServerById(id: string, projectPath?: string): Promise<MCPServerInternal | null>

  // Check and migrate legacy configs
  private async checkAndMigrateLegacyConfigs(projectPath: string): Promise<void>

  // Read MCP config with env var substitution
  private async readMCPConfig(configPath: string): Promise<MCPConfig | null>

  // Convert config entries to server objects
  private configToServers(config: MCPConfig | null): MCPServerInternal[]
}
```

### 2.3 Strapi-based Discovery

**File:** `src/services/strapi-client.ts`

**Key Methods:**

```typescript
// Get all MCP servers with filtering
async getAllMCPServers(params?: QueryParams<MCPServer>): Promise<MCPServer[]>

// Get specific MCP server by ID
async getMCPServer(id: string): Promise<MCPServer>

// Get multiple servers by IDs
async getMCPServersByIds(ids: string[]): Promise<MCPServer[]>
```

**Discovery Flow:**
1. Query Strapi API: `GET /api/mcp-servers`
2. Apply filters (e.g., `disabled: false`)
3. Transform Strapi format to SDK format
4. Cache results for performance

---

## 3. MCP Tool Discovery

### 3.1 Tool Discovery Protocol

MCP servers expose tools via the **JSON-RPC protocol**:

**Protocol Sequence:**
1. Initialize connection
2. Send `initialize` request
3. Wait for initialization response
4. Send `tools/list` request
5. Receive tools array with schemas

### 3.2 Tool Discovery Implementation

**File:** `src/services/mcp-service.ts`

**For stdio Servers:**

```typescript
private async fetchToolsFromStdioServer(config: MCPServerConfig): Promise<MCPTool[]> {
  // 1. Spawn MCP server process
  const child = spawn(config.command, config.args || [], {
    env: { ...process.env, ...config.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  // 2. Send initialize request (MCP protocol requirement)
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'cui-manager',
        version: '1.0.0'
      }
    }
  };

  // 3. After initialization, send tools/list request
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };

  // 4. Parse tools from response
  // Returns: { name, description, inputSchema }[]
}
```

**For SDK Servers:**

```typescript
private async fetchToolsFromSdkServer(config: MCPServerConfig): Promise<MCPTool[]> {
  const instance = this.sdkServers.get(config.name);

  // Direct method call to SDK server instance
  const tools = await instance.listTools();

  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
}
```

### 3.3 Tool Storage & Sync

**Strapi Database Storage:**

Tools are persisted in the `mcp_tools` table with relationship to `mcp_servers`:

```typescript
// Bulk sync tools for a server
async bulkSyncMCPTools(serverId: string, fetchedTools: Array<{
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}>): Promise<MCPServer>
```

**Sync Strategy:**
1. Fetch current tools from MCP server (via JSON-RPC)
2. Get existing tools from Strapi database
3. Compare tools by name
4. Create new tools
5. Update modified tools
6. Delete removed tools
7. Update `toolsFetchedAt` timestamp

---

## 4. Integration with Claude SDK

### 4.1 SDK Options Configuration

**File:** `src/services/claude-sdk-service.ts`

**Method:** `private async buildSdkOptions(config: ConversationConfig): Promise<Options>`

**MCP Integration Flow:**

```typescript
// 1. Initialize empty MCP servers object
const mcpServers: Record<string, any> = {};

// 2. Load from .mcp.json (lowest priority)
if (this.mcpConfigPath) {
  const mcpConfig = await this.loadMcpConfig(this.mcpConfigPath);
  if (mcpConfig) {
    Object.assign(mcpServers, mcpConfig);
  }
}

// 3. Load from Strapi agent-level servers (medium priority)
const strapiServers = await this.loadMcpServersFromStrapi(config.workingDirectory);
if (strapiServers) {
  Object.assign(mcpServers, strapiServers); // Overwrites .mcp.json
}

// 4. Load from Skill-specific MCP servers (highest priority)
if (config.skills && config.skills.length > 0) {
  const skillMcpServers = await this.loadMcpServersFromSkills(config.skills);
  if (skillMcpServers) {
    Object.assign(mcpServers, skillMcpServers); // Overwrites agent-level
  }
}

// 5. Add to SDK options
if (Object.keys(mcpServers).length > 0) {
  options.mcpServers = mcpServers;
}
```

### 4.2 SDK Format Transformation

**From Strapi Format:**
```json
{
  "name": "filesystem",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem"],
  "env": { "ALLOWED_PATHS": "/path" },
  "disabled": false,
  "transport": "stdio"
}
```

**To SDK Format:**
```json
{
  "filesystem": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem"],
    "env": { "ALLOWED_PATHS": "/path" }
  }
}
```

### 4.3 Tool Naming Convention

**MCP Tool Naming in SDK:**

Format: `mcp__<server-name>__<tool-name>`

Example:
- Server: `filesystem`
- Tool: `read_file`
- SDK Tool Name: `mcp__filesystem__read_file`

This allows agents to:
1. Identify which MCP server provides the tool
2. Filter tools using `allowedTools` or `disallowedTools`
3. Track tool usage and permissions

---

## 5. Data Model & Storage

### 5.1 Strapi Content Types

**MCP Server Schema**

**File:** `backend/src/api/mcp-server/content-types/mcp-server/schema.json`

```json
{
  "collectionName": "mcp_servers",
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true,
      "minLength": 1,
      "maxLength": 100
    },
    "description": {
      "type": "text",
      "maxLength": 500
    },
    "command": {
      "type": "string",
      "required": true,
      "minLength": 1
    },
    "args": {
      "type": "json"
    },
    "env": {
      "type": "json"
    },
    "disabled": {
      "type": "boolean",
      "default": false
    },
    "transport": {
      "type": "enumeration",
      "enum": ["stdio", "sse", "http"],
      "default": "stdio",
      "required": true
    },
    "healthCheckUrl": {
      "type": "string",
      "regex": "^https?://"
    },
    "isHealthy": {
      "type": "boolean",
      "default": true
    },
    "lastHealthCheck": {
      "type": "datetime"
    },
    "startupTimeout": {
      "type": "integer",
      "default": 30000,
      "min": 1000,
      "max": 300000
    },
    "restartPolicy": {
      "type": "enumeration",
      "enum": ["always", "on-failure", "never"],
      "default": "on-failure"
    },
    "toolsFetchedAt": {
      "type": "datetime"
    },
    "mcpTools": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::mcp-tool.mcp-tool",
      "mappedBy": "mcpServer"
    }
  }
}
```

**MCP Tool Schema**

**File:** `backend/src/api/mcp-tool/content-types/mcp-tool/schema.json`

```json
{
  "collectionName": "mcp_tools",
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "minLength": 1,
      "maxLength": 200
    },
    "description": {
      "type": "text",
      "maxLength": 1000
    },
    "inputSchema": {
      "type": "json",
      "default": {}
    },
    "mcpServer": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::mcp-server.mcp-server",
      "inversedBy": "mcpTools"
    }
  }
}
```

### 5.2 TypeScript Type Definitions

**File:** `src/types/mcp-types.ts`

**Transport Types:**
```typescript
export interface MCPStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface MCPSdkServerConfig {
  type: 'sdk';
  name: string;
  instance: any; // McpServer from @anthropic-ai/claude-agent-sdk
  disabled?: boolean;
}

export interface MCPSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

export interface MCPHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

export type MCPServerConfig =
  | MCPStdioServerConfig
  | MCPSdkServerConfig
  | MCPSSEServerConfig
  | MCPHttpServerConfig;
```

**File:** `src/types/agent.types.ts`

**Entity Types:**
```typescript
export interface MCPTool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  mcpServer?: string; // Server ID
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  disabled: boolean;
  transport: MCPTransport; // 'stdio' | 'sse' | 'http'
  healthCheckUrl?: string;
  isHealthy: boolean;
  lastHealthCheck?: Date;
  startupTimeout: number;
  restartPolicy: MCPRestartPolicy; // 'always' | 'on-failure' | 'never'
  mcpTools?: MCPTool[];
  toolsFetchedAt?: Date | string;
  agents?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

### 5.3 Strapi Components for Skill Integration

**File:** `src/types/strapi-components.types.ts`

```typescript
export interface MCPServerSelection {
  id?: number;
  __component: 'mcp.mcp-server-selection';
  mcpServer: string | { id: string; name: string }; // Relation to MCP Server
}

export interface MCPToolSelection {
  id?: number;
  __component: 'mcp.mcp-tool-selection';
  mcpTool: string | { id: string; name: string }; // Relation to MCP Tool
}
```

**Skills can specify:**
- Which MCP servers they need (via `mcpConfig` array)
- Which specific tools they want to use (via `tools` array with MCP tool selections)

---

## 6. API Layer

### 6.1 Express API Routes (File-based)

**File:** `src/routes/manager.routes.ts`

**Endpoints:**

```typescript
// List all MCP servers from .mcp.json
GET    /api/manager/mcp-servers

// Get specific MCP server
GET    /api/manager/mcp-servers/:id

// Create new MCP server
POST   /api/manager/mcp-servers

// Update MCP server
PUT    /api/manager/mcp-servers/:id

// Delete MCP server
DELETE /api/manager/mcp-servers/:id

// Test MCP server connection
POST   /api/manager/mcp-servers/:id/test

// Toggle server enabled/disabled
POST   /api/manager/mcp-servers/:id/toggle

// List tools from MCP server
GET    /api/manager/mcp-servers/:id/tools

// Export MCP config
GET    /api/manager/mcp-servers/export

// Import MCP config
POST   /api/manager/mcp-servers/import

// Bulk delete servers
POST   /api/manager/mcp-servers/bulk-delete
```

**Implementation Details:**
- Uses `MCPService` for .mcp.json operations
- Direct file system manipulation
- No database persistence
- Suitable for development/testing

### 6.2 Strapi API Routes (Database-based)

**File:** `src/routes/manager.routes.strapi.ts`

**Endpoints:**

```typescript
// List all MCP servers from Strapi
GET    /api/strapi/mcp-servers

// Get specific MCP server
GET    /api/strapi/mcp-servers/:id

// Create new MCP server
POST   /api/strapi/mcp-servers

// Update MCP server
PUT    /api/strapi/mcp-servers/:id

// Delete MCP server
DELETE /api/strapi/mcp-servers/:id

// Get tools for MCP server
GET    /api/strapi/mcp-servers/:id/tools

// Refresh tools from MCP server
POST   /api/strapi/mcp-servers/:id/refresh-tools
```

**Implementation Details:**
- Uses `strapiClient` for database operations
- Persistent storage in PostgreSQL
- Supports tool discovery and caching
- Production-ready with validation

### 6.3 Strapi CMS Routes (Auto-generated)

**Files:**
- `backend/src/api/mcp-server/routes/mcp-server.ts`
- `backend/src/api/mcp-tool/routes/mcp-tool.ts`

**Auto-generated CRUD endpoints:**
```
GET    /api/mcp-servers         (findAll)
GET    /api/mcp-servers/:id     (findOne)
POST   /api/mcp-servers         (create)
PUT    /api/mcp-servers/:id     (update)
DELETE /api/mcp-servers/:id     (delete)

GET    /api/mcp-tools           (findAll)
GET    /api/mcp-tools/:id       (findOne)
POST   /api/mcp-tools           (create)
PUT    /api/mcp-tools/:id       (update)
DELETE /api/mcp-tools/:id       (delete)
```

---

## 7. Frontend Management

### 7.1 MCP Servers Management Page

**File:** `src/web/manager/components/MCPServersPage.tsx`

**Features:**

1. **Server List View**
   - Display all MCP servers
   - Show server status (enabled/disabled)
   - Bulk selection for operations

2. **CRUD Operations**
   - Create new MCP server
   - Edit existing server
   - Delete server (with confirmation)
   - Bulk delete servers

3. **Server Testing**
   - Test server connectivity
   - Validate configuration
   - Display test results

4. **Tool Management**
   - View tools provided by server
   - Refresh tools from server
   - Tool schema inspection

5. **Import/Export**
   - Export MCP config to JSON
   - Import MCP config (merge/overwrite modes)
   - Sync with .mcp.json file

6. **Quick Add Mode**
   - Parse CLI command format
   - Auto-extract command, args, env
   - Simplified server creation

### 7.2 MCP Tools Selector Component

**File:** `src/web/manager/components/MCPToolsSelector.tsx`

**Features:**

1. **Tool Selection**
   - Browse tools by MCP server
   - Multi-select tools
   - Search/filter tools

2. **Tool Schema Display**
   - Show tool description
   - Display input schema
   - Parameter documentation

3. **Integration Points**
   - Used in Agent creation form
   - Used in Skill creation form
   - Allows fine-grained tool permissions

### 7.3 API Service Layer

**File:** `src/web/manager/services/api.ts`

**MCP-related API Methods:**

```typescript
// MCP Server operations
export async function getMCPServers(directory?: string): Promise<MCPServer[]>
export async function getMCPServer(id: string): Promise<MCPServer>
export async function createMCPServer(data: CreateMCPServerDTO): Promise<MCPServer>
export async function updateMCPServer(id: string, data: UpdateMCPServerDTO): Promise<MCPServer>
export async function deleteMCPServer(id: string): Promise<void>
export async function testMCPServer(id: string): Promise<TestMCPServerResponse>
export async function toggleMCPServer(id: string): Promise<{ disabled: boolean }>
export async function getMCPServerTools(serverId: string): Promise<MCPTool[]>
export async function refreshMCPServerTools(serverId: string): Promise<MCPServer>
```

---

## 8. Complete Integration Flow

### 8.1 MCP Server Configuration Flow

```
┌─────────────────┐
│ User configures │
│   MCP server    │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Where? │
    └───┬────┘
        │
        ├──────────────────────────────────────────┐
        │                                          │
        ▼                                          ▼
┌──────────────────┐                    ┌──────────────────┐
│   File-based     │                    │  Database-based  │
│  (.mcp.json)     │                    │     (Strapi)     │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         │  MCPService                           │  strapiClient
         │  .addMCPServer()                      │  .createMCPServer()
         │                                       │
         ▼                                       ▼
┌──────────────────┐                    ┌──────────────────┐
│ Write to         │                    │  POST to         │
│ .mcp.json        │                    │  /api/mcp-servers│
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         │                                       ▼
         │                              ┌──────────────────┐
         │                              │ Strapi validates │
         │                              │  & persists to   │
         │                              │   PostgreSQL     │
         │                              └────────┬─────────┘
         │                                       │
         └───────────────┬───────────────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Server available │
                │   for agents     │
                └─────────────────┘
```

### 8.2 MCP Tool Discovery Flow

```
┌──────────────────┐
│ User clicks      │
│ "Refresh Tools"  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Frontend calls   │
│ refreshTools API │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Backend:                             │
│ mcpService.listMCPServerTools(id)    │
└────────┬─────────────────────────────┘
         │
         ▼
    ┌────────┐
    │ stdio? │
    └───┬────┘
        │
        ├───────────────────────────────────┐
        │ Yes                               │ No (SDK)
        ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│ Spawn process    │              │ Call instance    │
│ with command/args│              │ .listTools()     │
└────────┬─────────┘              └────────┬─────────┘
         │                                 │
         ▼                                 │
┌──────────────────┐                       │
│ Send JSON-RPC    │                       │
│ initialize       │                       │
└────────┬─────────┘                       │
         │                                 │
         ▼                                 │
┌──────────────────┐                       │
│ Wait for init    │                       │
│ response         │                       │
└────────┬─────────┘                       │
         │                                 │
         ▼                                 │
┌──────────────────┐                       │
│ Send JSON-RPC    │                       │
│ tools/list       │                       │
└────────┬─────────┘                       │
         │                                 │
         ▼                                 │
┌──────────────────┐                       │
│ Parse tools      │                       │
│ response         │                       │
└────────┬─────────┘                       │
         │                                 │
         └──────────────┬──────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │ Tools array returned   │
           │ [{name, description,   │
           │   inputSchema}]        │
           └────────┬───────────────┘
                    │
                    ▼
           ┌────────────────────────┐
           │ strapiClient.          │
           │ bulkSyncMCPTools()     │
           └────────┬───────────────┘
                    │
                    ▼
           ┌────────────────────────┐
           │ Compare with existing  │
           │ tools in database      │
           └────────┬───────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
         ▼          ▼          ▼
    ┌────────┐ ┌───────┐ ┌────────┐
    │ Create │ │Update │ │ Delete │
    │  new   │ │changed│ │removed │
    │ tools  │ │ tools │ │ tools  │
    └───┬────┘ └───┬───┘ └────┬───┘
        │          │          │
        └──────────┼──────────┘
                   │
                   ▼
          ┌────────────────┐
          │ Update server  │
          │ toolsFetchedAt │
          └────────┬───────┘
                   │
                   ▼
          ┌────────────────┐
          │ Return updated │
          │     server     │
          └────────────────┘
```

### 8.3 Agent Execution with MCP Tools Flow

```
┌──────────────────┐
│ User starts      │
│ agent execution  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ claudeSdkService │
│ .executeAgent()  │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────┐
│ buildSdkOptions()              │
│ - Load project MCP servers     │
│ - Load agent MCP servers       │
│ - Load skill MCP servers       │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Merge servers (priority):      │
│ Skill > Agent > Project        │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Transform to SDK format:       │
│ {                              │
│   "server-name": {             │
│     type: "stdio",             │
│     command: "...",            │
│     args: [...],               │
│     env: {...}                 │
│   }                            │
│ }                              │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Pass to Claude SDK:            │
│ query({                        │
│   prompt: "...",               │
│   options: {                   │
│     mcpServers: {...}          │
│   }                            │
│ })                             │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Claude SDK:                    │
│ - Spawns MCP server processes  │
│ - Sends initialize requests    │
│ - Discovers available tools    │
│ - Registers tools with agent   │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Agent execution:               │
│ - Claude decides which tools   │
│ - Calls MCP tools via SDK      │
│ - Tools named as:              │
│   mcp__<server>__<tool>        │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ SDK manages MCP communication: │
│ - Sends tool_use JSON-RPC      │
│ - Receives tool results        │
│ - Passes results to Claude     │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Stream results to frontend     │
│ via SSE                        │
└────────────────────────────────┘
```

### 8.4 Skill-specific MCP Server Flow

```
┌──────────────────┐
│ User creates     │
│ new skill        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Skill form shows │
│ MCP selector     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ User selects     │
│ required MCP     │
│ servers          │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────┐
│ Saved as mcpConfig array:      │
│ [                              │
│   {                            │
│     __component:               │
│       "mcp.mcp-server-sel...", │
│     mcpServer: "server-id"     │
│   }                            │
│ ]                              │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ When skill is used in agent:   │
│                                │
│ loadMcpServersFromSkills()     │
│ - Iterates skill.mcpConfig     │
│ - Fetches each server from DB  │
│ - Transforms to SDK format     │
│ - Highest priority (overrides) │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Agent executes with            │
│ skill-specific MCP servers     │
└────────────────────────────────┘
```

---

## 9. Key Insights

### 9.1 Architectural Patterns

1. **Three-tier Configuration Strategy**
   - Project-level: Shared across all agents
   - Agent-level: Agent-specific tooling
   - Skill-level: Skill-specific requirements
   - Priority ensures proper isolation

2. **Dual Storage System**
   - File-based (.mcp.json): Development, SDK alignment
   - Database-based (Strapi): Production, UI management
   - Both systems interoperate seamlessly

3. **Lazy Tool Discovery**
   - Tools discovered on-demand
   - Cached in database for performance
   - Refreshable when MCP server updates

4. **SDK-aligned Protocol**
   - Follows @anthropic-ai/claude-agent-sdk conventions
   - Compatible with Claude Code and other SDK consumers
   - Standard .mcp.json location

### 9.2 Critical Components

**Configuration Layer:**
- `MCPService` - File-based config management
- `strapiClient` - Database operations
- Environment variable substitution

**Discovery Layer:**
- JSON-RPC protocol implementation
- Multi-source server loading
- Tool schema parsing

**Integration Layer:**
- `claudeSdkService.buildSdkOptions()` - Merges all sources
- Format transformation (Strapi → SDK)
- Tool naming convention

**Storage Layer:**
- PostgreSQL (via Strapi)
- Relationships: Server 1:N Tools
- Components: MCPServerSelection, MCPToolSelection

**UI Layer:**
- MCPServersPage - Server management
- MCPToolsSelector - Tool selection
- Test/toggle/refresh operations

### 9.3 Communication Flows

1. **MCP Server → Application**
   - stdio: JSON-RPC over stdin/stdout
   - SDK: Direct function calls
   - SSE/HTTP: Network protocols

2. **Application → Claude SDK**
   - Pass mcpServers in options
   - SDK manages lifecycle
   - Tools auto-registered

3. **Frontend → Backend**
   - REST API for CRUD operations
   - SSE for real-time updates
   - File sync operations

### 9.4 Tool Discovery Lifecycle

```
Configure → Discover → Store → Use → Refresh
   ↑                                      ↓
   └──────────────────────────────────────┘
```

1. **Configure:** Add MCP server via UI or .mcp.json
2. **Discover:** Fetch tools via JSON-RPC protocol
3. **Store:** Cache tools in Strapi database
4. **Use:** Agent accesses tools during execution
5. **Refresh:** Update tools when server changes

### 9.5 Security Considerations

1. **Environment Variables**
   - Substitution allows secure credential management
   - Never hardcode API keys in .mcp.json
   - Use ${API_KEY} pattern

2. **Disabled Servers**
   - Can disable without deleting
   - Filtered out during discovery
   - Prevents accidental tool access

3. **Health Checks**
   - Monitor server status
   - Track last health check
   - isHealthy flag

4. **Tool Permissions**
   - allowedTools/disallowedTools in SDK options
   - Fine-grained control per agent
   - Skill-specific tool isolation

### 9.6 Performance Optimizations

1. **Caching Strategy**
   - Tools cached in database (toolsFetchedAt)
   - Strapi client-side caching
   - Invalidation on updates

2. **Lazy Loading**
   - Servers spawned only when needed
   - Tools discovered on first use
   - Connection pooling for remote servers

3. **Bulk Operations**
   - Bulk delete servers
   - Bulk sync tools
   - Batch API requests

### 9.7 Error Handling

1. **Server Test Endpoint**
   - Validates configuration before use
   - Tests spawn/connection
   - Returns detailed error messages

2. **Graceful Degradation**
   - Failed server doesn't block agent
   - Logs errors for debugging
   - Continues with available servers

3. **Timeout Management**
   - configurable startupTimeout
   - 10s test timeout
   - 15s tool discovery timeout

---

## Summary

The MCP protocol integration in Claude Agent UI provides a robust, multi-layered system for extending agent capabilities:

- **Flexible Configuration:** File-based + database-based
- **Multi-source Discovery:** Project, agent, and skill-level servers
- **Standard Protocol:** JSON-RPC 2.0 over multiple transports
- **Persistent Storage:** Tools cached in PostgreSQL via Strapi
- **UI Management:** Full CRUD, testing, and monitoring
- **SDK Integration:** Seamless Claude SDK compatibility
- **Security:** Environment variable substitution, enable/disable, health checks
- **Performance:** Caching, lazy loading, bulk operations

This architecture enables dynamic tool ecosystems while maintaining simplicity for developers and security for production deployments.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-02
**Author:** Claude Agent (auto-claude)
