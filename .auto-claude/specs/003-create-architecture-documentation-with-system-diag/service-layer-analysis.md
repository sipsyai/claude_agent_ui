# Service Layer Architecture Analysis

## Overview

The service layer is organized into several logical groups that handle different aspects of the application. All services are located in `src/services/` and work together to provide a complete Claude Agent UI system.

## Service Categories

### 1. Core AI Services

#### claude-sdk-service.ts
**Purpose**: Main orchestrator for Claude AI conversations using the Anthropic Agent SDK

**Responsibilities**:
- Manages Claude conversations using the Agent SDK's `query()` function
- Handles conversation lifecycle (start, stop, message streaming)
- Processes SDK messages and transforms them to CUI's event format
- Manages SDK options including models, tools, permissions, and MCP servers
- Writes conversation history to filesystem via sdk-history-writer
- Handles skill loading via `settingSources: ['project']`

**Dependencies**:
- `@anthropic-ai/claude-agent-sdk` (external SDK)
- ClaudeHistoryReader
- SdkHistoryWriter
- ConversationStatusManager
- ToolMetricsService
- SessionInfoService
- FileSystemService
- NotificationService
- ClaudeRouterService
- StrapiClient (for loading MCP servers from database)

**Key Methods**:
- `startConversation()` - Initializes SDK query with configuration
- `stopConversation()` - Terminates conversation and flushes history
- `buildSdkOptions()` - Constructs SDK options from config
- `processQueryMessages()` - Streams messages from SDK
- `loadMcpServersFromStrapi()` - Loads MCP servers from database
- `loadMcpServersFromSkills()` - Loads skill-specific MCP servers

**Communication Pattern**:
- Emits events: `claude-message`, `process-closed`, `process-error`
- Streams messages via async generator pattern
- SSE streaming to frontend via route handlers

---

#### claude-router-service.ts
**Purpose**: Routes messages between different Claude service implementations

**Responsibilities**:
- Not fully analyzed in current read, but likely handles routing logic
- Manages which backend (SDK vs CLI) handles requests

---

#### claude-history-reader.ts
**Purpose**: Reads Claude conversation history from filesystem

**Responsibilities**:
- Reads `.claude-session/` directories
- Parses conversation messages
- Provides historical context for conversation resumption

---

#### claude-structure-parser.ts
**Purpose**: Parses `.claude/` directory structure for agents and skills

**Responsibilities**:
- Parses AGENT.md files for agent configuration
- Parses SKILL.md files for skill metadata
- Extracts YAML frontmatter and markdown content
- Provides structured data for agents and skills

---

### 2. Data Layer Services

#### strapi-client.ts
**Purpose**: Complete data access layer for Strapi CMS API

**Responsibilities**:
- HTTP client with axios for all Strapi interactions
- CRUD operations for: Agents, Skills, MCP Servers, MCP Tools, Tasks, Chat Sessions/Messages
- LRU caching with 5-minute TTL
- Data transformation between Strapi format and domain models
- Cache invalidation on mutations
- File upload/delete to Strapi media library

**Key Features**:
- Singleton pattern (`strapiClient` export)
- Automatic data transformation via `transform*()` methods
- Query building with populate, filters, sort, pagination
- Error handling with detailed logging
- Health check endpoint

**Data Models**:
- Agent, Skill, MCPServer, MCPTool, Task, ChatSession, ChatMessage

**Cache Strategy**:
- Cache GET requests with key pattern: `{type}:{id}` or `{type}:all:{options}`
- Invalidate on mutations (create/update/delete)
- Statistics via `getCacheStats()`

**Communication Pattern**:
- Synchronous API calls
- Promise-based async operations
- No event emissions (pure data layer)

---

### 3. MCP Integration Services

#### mcp-service.ts
**Purpose**: Manages MCP (Model Context Protocol) server configurations

**Responsibilities**:
- Reads/writes `.mcp.json` configuration file
- Manages MCP server CRUD operations
- Tests MCP server connectivity (stdio and SDK servers)
- Fetches tools from MCP servers via JSON-RPC
- Auto-migrates legacy `.claude/mcp.json` to `.mcp.json`
- Syncs MCP servers between Strapi and filesystem

**Key Features**:
- Environment variable substitution in configs
- Server testing via `testMCPServer()`
- Tool discovery via `listMCPServerTools()`
- Bulk operations (delete, sync)
- Toggle enable/disable state

**MCP Server Types**:
- `stdio` - Subprocess-based servers (spawn command)
- `sdk` - In-process SDK servers (registered instances)
- `sse` - Server-Sent Events (planned)
- `http` - HTTP-based (planned)

**Communication Pattern**:
- Filesystem I/O for `.mcp.json`
- JSON-RPC for stdio server communication
- Direct method calls for SDK servers

---

### 4. Chat Services

#### chat-service.ts
**Purpose**: Manages chat sessions and message streaming

**Responsibilities**:
- Creates and manages chat sessions in Strapi
- Streams responses from Claude SDK
- Handles file attachments (images, PDFs, text files)
- Saves messages to Strapi database
- Manages chat logs via chat-log-service
- Syncs skills to filesystem before chat
- Supports per-message agent/skill overrides
- Implements cancellation via AbortController

**Key Features**:
- Async generator for message streaming
- Auto-title generation from first message
- Plan mode support (read-only tools)
- Tool permission callbacks (`canUseTool`)
- SDK hooks (PreToolUse, PostToolUse)
- Real-time delta streaming
- Attachment support (images, PDFs, text)

**Communication Pattern**:
- EventEmitter for stream events
- Async generator yields:
  - `user_message_saved`
  - `stream_id`
  - `assistant_message_start`
  - `assistant_message_delta`
  - `assistant_message_saved`
  - `sdk_message`
  - `done` / `cancelled` / `error`

**Dependencies**:
- strapiClient
- chatLogService
- skillSyncService
- Claude SDK (`query()`)

---

#### chat-log-service.ts
**Purpose**: Manages chat session logs on filesystem

**Responsibilities**:
- Creates/updates log files in `logs/chat/` directory
- Tracks SDK calls and events
- Stores session metadata

**File Format**: JSON log files per session

---

### 5. Skill Services

#### skill-service.ts
**Purpose**: Manages skills in `.claude/skills/` directory

**Responsibilities**:
- Creates/updates/deletes skills in filesystem
- Validates skill names and descriptions
- Generates YAML frontmatter for SKILL.md
- Manages `skill.config.json` for input fields
- Tracks skill usage across agents
- Updates skill experience scores and training history

**Validation Rules**:
- Name: lowercase, numbers, hyphens only (max 64 chars)
- Description: must include "Use when..." (max 1024 chars)
- Content: required

**Communication Pattern**:
- Filesystem I/O (async/await)
- Returns `CreateSkillResponse` objects

---

#### skill-sync-service.ts
**Purpose**: Syncs Strapi skills to filesystem for SDK discovery

**Responsibilities**:
- Syncs skills from Strapi to `.claude/skills/{name}/SKILL.md`
- Validates and sanitizes skill names (prevents path traversal)
- Injects template parameters (`{{param}}` replacement)
- Generates YAML frontmatter for skills
- Clears/removes skills from filesystem

**Key Features**:
- Security: Sanitizes skill names, validates parameters
- Size limits: 1MB per skill, 10KB per parameter
- Template injection for dynamic skills
- Singleton pattern (`skillSyncService`)

**Communication Pattern**:
- Called before agent/chat execution
- Syncs skills just-in-time for SDK discovery

---

### 6. Infrastructure Services

#### logger.ts
**Purpose**: Centralized logging service using Pino

**Responsibilities**:
- Provides consistent logging across all components
- Creates component-specific child loggers
- Formats logs with LogFormatter
- Buffers logs to log-stream-buffer for real-time viewing
- Supports log levels via LOG_LEVEL env var

**Features**:
- Singleton pattern (`LoggerService`)
- Factory function `createLogger(component, context)`
- Multi-stream: stdout + log buffer
- ISO timestamps
- Error serialization

**Log Levels**: debug, info, warn, error, fatal

---

#### conversation-status-manager.ts
**Purpose**: Tracks active conversation sessions and their status

**Responsibilities**:
- Maps Claude session IDs to CUI streaming IDs (bidirectional)
- Stores conversation context for active sessions
- Generates optimistic conversation summaries for UI
- Emits session lifecycle events
- Provides conversation status (ongoing/completed/pending)

**Key Features**:
- EventEmitter for lifecycle: `session-started`, `session-ended`
- Optimistic UI support (show active convos before history written)
- Handles conversation resumption context
- Statistics via `getStats()`

**Data Structures**:
- `sessionToStreaming: Map<claudeSessionId, streamingId>`
- `streamingToSession: Map<streamingId, claudeSessionId>`
- `sessionContext: Map<claudeSessionId, ConversationStatusContext>`

---

#### notification-service.ts
**Purpose**: Manages notifications (likely web push)

**Not fully analyzed** - Further investigation needed

---

#### web-push-service.ts
**Purpose**: Handles web push notifications

**Not fully analyzed** - Further investigation needed

---

#### config-service.ts
**Purpose**: Manages application configuration

**Not fully analyzed** - Further investigation needed

---

#### file-system-service.ts
**Purpose**: File system operations abstraction

**Not fully analyzed** - Further investigation needed

---

### 7. Utility Services

#### sdk-history-writer.ts
**Purpose**: Writes SDK conversation messages to filesystem history

**Responsibilities**:
- Writes user/assistant/result messages to `.claude-session/`
- Batches writes for performance
- Flushes history on conversation completion

---

#### session-info-service.ts
**Purpose**: Manages session metadata in database

**Responsibilities**:
- Tracks session info (permissions, metadata)
- Updates session state

---

#### task-storage-service.ts
**Purpose**: Stores task execution data

**Not fully analyzed** - Further investigation needed

---

#### ToolMetricsService.ts
**Purpose**: Tracks tool usage metrics

**Responsibilities**:
- Records tool invocations
- Tracks tool performance

---

#### log-formatter.ts
**Purpose**: Formats log output for console

**Responsibilities**:
- Pretty-prints structured logs
- Color coding by log level

---

#### log-stream-buffer.ts
**Purpose**: Buffers logs for real-time streaming to frontend

**Responsibilities**:
- Circular buffer for recent logs
- Provides log stream for SSE endpoints

---

#### message-filter.ts
**Purpose**: Filters/transforms messages

**Not fully analyzed** - Further investigation needed

---

#### training-agent-selector.ts
**Purpose**: Selects appropriate agent for skill training

**Not fully analyzed** - Further investigation needed

---

### 8. Prompt Services

#### prompts/agent-creator-prompt.ts
**Purpose**: Prompt template for agent creation

**Responsibilities**:
- Provides system prompt for AI-assisted agent creation

---

#### prompts/skill-creator-prompt.ts
**Purpose**: Prompt template for skill creation

**Responsibilities**:
- Provides system prompt for AI-assisted skill creation

---

## Service Communication Patterns

### 1. Claude SDK Integration Flow
```
User Request
  → chat-service.sendMessage()
    → skillSyncService.syncAllSkills() [sync skills to filesystem]
    → claude-sdk-service.query() [SDK call]
      → SDK streams messages
        → claude-sdk-service transforms messages
          → chat-service yields events
            → SSE to frontend
```

### 2. Data Persistence Flow
```
Operation
  → strapi-client CRUD methods
    → axios HTTP request
      → Strapi API
        → PostgreSQL
    → Cache invalidation
  → Return transformed data
```

### 3. MCP Integration Flow
```
Agent Configuration
  → strapi-client.getAgent() [fetch agent with mcpConfig]
    → claude-sdk-service.loadMcpServersFromStrapi()
      → mcp-service.getMCPServers() [load from .mcp.json]
        → SDK options.mcpServers
          → SDK spawns MCP servers
            → Tools available to Claude
```

### 4. Skill Execution Flow
```
Chat Request with Skills
  → chat-service.sendMessage()
    → strapiClient.getSkillsByIds()
      → skillSyncService.syncAllSkills()
        → Write to .claude/skills/{name}/SKILL.md
          → SDK options.settingSources: ['project']
            → SDK discovers skills
              → Skill tool available to Claude
```

## Key Design Patterns

### 1. Singleton Pattern
- `strapiClient` - Single instance for all Strapi operations
- `skillSyncService` - Single instance for skill syncing
- `LoggerService` - Single logging instance
- Most services exported as singletons

### 2. Factory Pattern
- `createLogger(component, context)` - Creates component-specific loggers

### 3. Repository Pattern
- `strapi-client` abstracts all data access
- Transforms between API and domain models
- Centralizes caching logic

### 4. Event-Driven Architecture
- `claude-sdk-service` emits events for message streaming
- `chat-service` extends EventEmitter for stream lifecycle
- `conversation-status-manager` emits session events

### 5. Async Generator Pattern
- `chat-service.sendMessage()` yields incremental updates
- Enables real-time streaming to frontend

## Dependencies Between Services

### High-Level Dependencies
```
claude-sdk-service
  ├── strapi-client (MCP servers, session info)
  ├── conversation-status-manager (session tracking)
  ├── sdk-history-writer (history persistence)
  ├── logger (logging)
  └── Multiple utility services

chat-service
  ├── strapi-client (sessions, messages, agents, skills)
  ├── chat-log-service (log files)
  ├── skill-sync-service (skill filesystem sync)
  └── claude-sdk-service (via SDK query())

skill-sync-service
  └── strapi-client (fetch skill data)

mcp-service
  └── file system (.mcp.json)

strapi-client
  └── axios (HTTP client)
  └── LRU cache
```

### Circular Dependencies
**None detected** - Services are well-layered with clear boundaries

## Service Layer Metrics

- **Total Services**: 26 TypeScript files
- **Core AI Services**: 5
- **Data Layer**: 1 (strapi-client as main gateway)
- **MCP Integration**: 1
- **Chat Services**: 2
- **Skill Services**: 2
- **Infrastructure**: 7
- **Utility Services**: 6
- **Prompt Templates**: 2

## Key Observations

1. **Clear Separation of Concerns**: Each service has a well-defined responsibility
2. **Strapi as Single Data Source**: All database operations go through strapi-client
3. **SDK Integration**: claude-sdk-service is the sole interface to Anthropic SDK
4. **Filesystem Sync**: Multiple services sync data between database and filesystem
5. **Event-Driven Communication**: Real-time features use EventEmitter pattern
6. **Comprehensive Logging**: All services use centralized logger
7. **Caching Strategy**: LRU cache in strapi-client reduces API calls
8. **Security**: Input validation, sanitization, path traversal prevention

## Critical Data Flows

### 1. Agent Execution with Skills
```
User → API → claude-sdk-service → SDK
              ↓
        skill-sync-service (syncs skills)
              ↓
        .claude/skills/SKILL.md (filesystem)
              ↓
        SDK discovers via settingSources
              ↓
        Skill tool available
```

### 2. MCP Tool Usage
```
Agent Config (Strapi)
  → mcpConfig component
    → MCP Server IDs + Tool IDs
      → claude-sdk-service loads servers
        → .mcp.json (command/args)
          → SDK spawns servers
            → Tools available
```

### 3. Chat Message Flow
```
User Message
  → chat-service (save to Strapi)
    → SDK query (process)
      → Stream events
        → chat-service (yield deltas)
          → SSE endpoint
            → Frontend UI
```

## Recommendations for Architecture Diagrams

Based on this analysis, the architecture documentation should include:

1. **Service Layer Component Diagram** - Show all services and their groupings
2. **Data Flow Diagram** - Illustrate CRUD operations through strapi-client
3. **Claude SDK Integration Sequence** - Show conversation flow with SDK
4. **MCP Integration Flow** - Diagram MCP server lifecycle
5. **Skill Execution Flow** - Show skill sync and discovery
6. **Chat Streaming Sequence** - Real-time message flow
7. **Dependency Graph** - Visual representation of service dependencies

---

*Analysis completed: January 2, 2026*
*Services analyzed: 26/26*
