# API Routes & Data Flow Analysis

## Overview

The Express backend exposes 6 major API route groups that handle everything from CRUD operations to real-time streaming. All routes are registered in `src/server.ts` under the `/api` prefix.

## Route Registration Structure

```typescript
// From src/server.ts (line 212-224)
'/api/manager'   → manager.routes.ts (filesystem-based CRUD - legacy)
'/api/strapi'    → manager.routes.strapi.ts (Strapi CRUD - primary)
'/api/execute'   → execution.routes.ts (SSE streaming for agent execution)
'/api/tasks'     → task.routes.ts (task queue management)
'/api/chat'      → chat.routes.ts (SSE streaming for chat sessions)
'/health'        → Built-in health check
'/api/agents'    → Quick Strapi proxy endpoint
'/api/skills'    → Quick Strapi proxy endpoint
```

---

## 1. Chat Routes (`/api/chat`)

**File**: `src/routes/chat.routes.ts`
**Purpose**: Manages chat sessions with real-time SSE streaming
**Key Dependencies**: chat-service, strapi-client

### Endpoints

#### `POST /api/chat/sessions`
**Purpose**: Create new chat session
**Request Body**:
```typescript
{
  title: string,
  skillIds: string[],
  agentId?: string,
  customSystemPrompt?: string,
  workingDirectory?: string,
  permissionMode?: string
}
```
**Response**: `{ session: ChatSession }`
**Flow**:
1. Extract working directory from query/cookies/cwd
2. Call `chatService.createChatSession()`
3. Session saved to Strapi
4. Return session object

---

#### `GET /api/chat/sessions`
**Purpose**: List all chat sessions
**Response**: `{ sessions: ChatSession[] }`
**Flow**: `chatService.getAllChatSessions()` → Strapi query

---

#### `GET /api/chat/sessions/:id`
**Purpose**: Get single chat session by ID
**Response**: `{ session: ChatSession }`
**Flow**: `chatService.getChatSession(id)` → Strapi

---

#### `DELETE /api/chat/sessions/:id`
**Purpose**: Delete chat session
**Response**: `{ success: true }`
**Flow**: `chatService.deleteChatSession(id)` → Strapi

---

#### `POST /api/chat/sessions/:id/archive`
**Purpose**: Archive chat session
**Response**: `{ session: ChatSession }`
**Flow**: `chatService.archiveChatSession(id)` → Strapi

---

#### `GET /api/chat/sessions/:id/messages`
**Purpose**: Get all messages in session
**Response**: `{ messages: ChatMessage[] }`
**Flow**: `chatService.getChatMessages(id)` → Strapi

---

#### `POST /api/chat/sessions/:id/messages` ⭐ **SSE STREAMING**
**Purpose**: Send message and stream response from Claude
**Request Body**:
```typescript
{
  message: string,
  attachments?: Array<{filename, mimeType, data}>,
  agentId?: string,
  skillIds?: string[],
  permissionMode?: string,
  workingDirectory?: string
}
```
**Response**: Server-Sent Events (SSE)
**Headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**SSE Event Flow**:
```
data: {"type": "user_message_saved", ...}
data: {"type": "stream_id", streamId: "..."}
data: {"type": "assistant_message_start", ...}
data: {"type": "assistant_message_delta", delta: "..."}
data: {"type": "sdk_message", content: {...}}
data: {"type": "assistant_message_saved", ...}
data: {"type": "done"}
```

**Detailed Flow**:
1. Set SSE headers
2. Get working directory from query/cookies
3. Call `chatService.sendMessage()` (async generator)
4. For each event yielded:
   - Write to response stream: `res.write(\`data: ${JSON.stringify(event)}\\n\\n\`)`
   - Check if client disconnected (`res.writableEnded`)
5. On completion/error: `res.end()`

**Data Flow**:
```
Frontend POST
  → chat.routes.ts
    → chatService.sendMessage()
      → strapiClient.getChatSession()
      → skillSyncService.syncAllSkills() [sync skills to filesystem]
      → claude-sdk-service.query() [SDK streaming]
        → SDK processes message
          → Yields events (user, assistant, tool_use, result)
            → chatService transforms & yields
              → SSE stream to frontend
      → strapiClient.createChatMessage() [save messages]
```

---

#### `POST /api/chat/sessions/:sessionId/messages/:streamId/cancel`
**Purpose**: Cancel active message stream
**Response**: `{ success: true, message: "..." }`
**Flow**: `chatService.cancelMessage(streamId)` → AbortController.abort()

---

#### `POST /api/chat/attachments`
**Purpose**: Upload file attachment (base64)
**Request Body**:
```typescript
{
  file: string, // base64
  filename: string,
  mimeType?: string
}
```
**Response**: `{ filename, mimeType, data, size }`
**Flow**: Validates and returns base64 data

---

## 2. Execution Routes (`/api/execute`)

**File**: `src/routes/execution.routes.ts`
**Purpose**: SSE streaming for agent and task execution
**Key Dependencies**: claude-sdk-service, strapi-client, skill-sync-service

### Endpoints

#### `POST /api/execute/agent/:id` ⭐ **SSE STREAMING**
**Purpose**: Execute agent with real-time streaming
**Request Body**:
```typescript
{
  message: string,
  conversationId?: string,
  context?: {
    permissionMode?: string
  }
}
```
**Response**: Server-Sent Events (SSE)

**SSE Helper Class**:
```typescript
class SSEStream {
  send(event: string, data: any)
  sendData(data: any)
  sendComment(comment: string) // keep-alive
  startKeepAlive() // ping every 30s
  close()
}
```

**Detailed Execution Flow**:
1. **Validation** - Parse & validate request
2. **Fetch Agent** - `strapiClient.getAgent(id)`
3. **Initialize SSE** - Set headers, create SSEStream, start keep-alive
4. **Generate Conversation ID** - If not provided
5. **Send Start Event**:
   ```json
   {
     "type": "status",
     "status": "Starting agent: {name}",
     "agentId": "...",
     "conversationId": "...",
     "timestamp": "..."
   }
   ```
6. **Fetch Related Data**:
   - Extract skill IDs from `agent.skillSelection`
   - Extract MCP server IDs from `agent.mcpConfig`
   - Fetch skills: `strapiClient.getSkillsByIds()`
   - Fetch MCP servers: `strapiClient.getMCPServersByIds()`
7. **Sync Skills to Filesystem**:
   ```typescript
   skillSyncService.syncAllSkills(skills)
   // Writes to .claude/skills/{name}/SKILL.md
   ```
8. **Send Debug Event** - Agent configuration loaded
9. **Build Conversation Config**:
   ```typescript
   {
     initialPrompt: message,
     systemPrompt: agent.systemPrompt,
     workingDirectory: process.cwd(),
     model: agent.modelConfig?.model || 'claude-sonnet-4-5',
     allowedTools: [...],
     disallowedTools: [...],
     permissionMode: 'default',
     skills: skills // for MCP loading
   }
   ```
10. **Register Event Handlers**:
    - `claude-message` - Forward SDK events to frontend
    - `process-error` - Handle SDK errors
    - `process-closed` - Handle completion
    - `close` (req) - Handle client disconnect
11. **Start SDK Conversation**:
    ```typescript
    claudeSdkService.startConversation(conversationConfig)
    ```
12. **Stream Messages**:
    ```
    SDK emits → claude-message event
      → messageHandler forwards to frontend
        → stream.sendData({ type: 'message', content: sdkMessage })
    ```
13. **Handle Completion**:
    - Calculate tokens, cost, execution time
    - Send completion event
    - Cleanup listeners
    - Close stream

**Event Types Forwarded**:
- `system` - System messages
- `user` - User messages
- `assistant` - Assistant responses (with text content)
- `tool_use` - Tool invocations
- `tool_result` - Tool results
- `result` - Final result with usage metrics

**SSE Event Format**:
```json
{
  "type": "message",
  "content": {
    "type": "assistant",
    "message": {
      "content": [
        {"type": "text", "text": "..."}
      ]
    }
  }
}
```

**Error Handling**:
- If headers sent: Send error event via SSE
- If headers not sent: Send JSON error response

---

#### `POST /api/execute/task/:id` ⭐ **SSE STREAMING**
**Purpose**: Execute task with agent (auto-approved permissions)
**Request Body**: None (task config in database)
**Response**: Server-Sent Events (SSE)

**Flow**:
1. Fetch task from Strapi
2. Fetch associated agent
3. Update task status to 'running'
4. Initialize SSE stream
5. Fetch skills & MCP servers
6. Sync skills to filesystem (with parameter injection from task.metadata.inputValues)
7. Build conversation config (permissionMode: 'bypassPermissions')
8. Start SDK conversation
9. Stream messages
10. Update task status to 'completed' with execution log
11. Send completion event

**Differences from Agent Execution**:
- Auto-approves permissions (`bypassPermissions`)
- Saves full execution log to task record
- Updates task status in database
- Supports input value injection for skills

---

#### `GET /api/execute/conversation/:id`
**Purpose**: Get conversation history (placeholder)
**Response**: `{ conversationId, messages: [], metadata }`
**Status**: Pending implementation

---

#### `DELETE /api/execute/conversation/:id`
**Purpose**: Clear conversation history (placeholder)
**Response**: `{ success: true }`
**Status**: Pending implementation

---

## 3. Strapi Manager Routes (`/api/strapi`)

**File**: `src/routes/manager.routes.strapi.ts`
**Purpose**: CRUD operations for all entities via Strapi
**Key Dependencies**: strapi-client, mcp-service

### Agents

#### `GET /api/strapi/agents`
**Query Params**:
```typescript
{
  enabled?: boolean,
  search?: string,
  sort?: string,
  page?: number,
  pageSize?: number
}
```
**Response**: `{ data: Agent[], meta: { page, pageSize, total } }`
**Flow**: `strapiClient.getAllAgents()` with filters, pagination

---

#### `GET /api/strapi/agents/:id`
**Response**: `{ ...agent }`
**Flow**: `strapiClient.getAgent(id)`

---

#### `POST /api/strapi/agents`
**Request Body**:
```typescript
{
  agent: {
    name: string,
    description: string,
    systemPrompt: string,
    enabled?: boolean,
    model?: string,
    skills?: string[], // skill names
    tools?: string[], // allowed tools
    disallowedTools?: string[],
    mcpTools?: Record<serverId, toolNames[]>,
    metadata?: Record<string, any>
  }
}
```
**Response**: `{ success: true, agentId, filePath, message }`

**Transformation Flow**:
1. Transform skill names → skill IDs (query Strapi)
2. Transform model → modelConfig component
3. Transform metadata → component array
4. Transform tools → toolConfig component
5. Transform mcpTools → mcpConfig component (with tool ID lookups)
6. Call `strapiClient.createAgent()`

---

#### `PUT /api/strapi/agents/:id`
**Request Body**: Same as POST (partial updates)
**Response**: `{ success: true, agentId, filePath, message }`
**Flow**: Same transformation logic, then `strapiClient.updateAgent()`

---

#### `DELETE /api/strapi/agents/:id`
**Response**: 204 No Content
**Flow**: `strapiClient.deleteAgent(id)`

---

### Skills

#### `GET /api/strapi/skills`
**Query Params**: `{ search?: string, page, pageSize }`
**Response**: `{ data: Skill[], meta }`
**Flow**: `strapiClient.getAllSkills()`

---

#### `GET /api/strapi/skills/:id`
**Response**: `{ ...skill }`
**Flow**: `strapiClient.getSkill(id)`

---

#### `POST /api/strapi/skills`
**Request Body**:
```typescript
{
  name: string,
  displayName: string,
  description: string,
  skillmd: string, // Markdown content
  category?: string,
  version?: string,
  allowedTools?: string[],
  disallowedTools?: string[],
  mcpTools?: Record<serverId, toolNames[]>,
  inputFields?: InputField[],
  modelConfig?: {...},
  additionalFiles?: FileReference[]
}
```
**Response**: `{ success: true, skill, message }`

**Transformation**:
- `allowedTools`/`disallowedTools` → `toolConfig` component
- `mcpTools` → `mcpConfig` component
- `inputFields` → component array
- `modelConfig` → component
- `additionalFiles` → component array with file IDs

---

#### `PUT /api/strapi/skills/:id`
**Request Body**: Same as POST (partial)
**Response**: `{ success: true, skill, message }`

---

#### `DELETE /api/strapi/skills/:id`
**Response**: 204 No Content

---

#### `POST /api/strapi/skills/:id/train/message` ⭐ **SSE STREAMING**
**Purpose**: Interactive skill training (Strapi-based)
**Request Body**:
```typescript
{
  directory?: string,
  conversationHistory: Array<{role, content}>
}
```
**Response**: Server-Sent Events

**Flow**:
1. Get skill from Strapi
2. Get training agent from filesystem (`.claude/agents/training-agent.md`)
3. Build conversational prompt with history
4. Execute training agent with SDK `query()`
5. Stream responses as SSE events

---

### MCP Servers

#### `GET /api/strapi/mcp-servers`
**Query Params**: `{ disabled?: boolean, transport?: string, search?: string }`
**Response**: `{ data: MCPServer[], meta }`
**Flow**: `strapiClient.getAllMCPServers({ populate: true })`

---

#### `GET /api/strapi/mcp-servers/:id`
**Response**: `{ ...mcpServer }`
**Flow**: `strapiClient.getMCPServer(id)`

---

#### `POST /api/strapi/mcp-servers`
**Request Body**:
```typescript
{
  name: string,
  config: {
    command: string,
    args?: string[],
    env?: Record<string, string>,
    disabled?: boolean,
    type: 'stdio' | 'sdk' | 'sse'
  },
  directory?: string
}
```
**Response**: `{ ...mcpServer }`

**Flow**:
1. Transform `config.type` → `transport`
2. Create in Strapi
3. **Auto-fetch tools** (non-blocking):
   - `mcpService.listMCPServerTools()`
   - `strapiClient.bulkSyncMCPTools()`
4. **Sync to .mcp.json** (non-blocking)

---

#### `PUT /api/strapi/mcp-servers/:id`
**Request Body**: `{ config: {...} }`
**Response**: `{ ...mcpServer }`

---

#### `DELETE /api/strapi/mcp-servers/:id`
**Response**: 204 No Content

---

#### `GET /api/strapi/mcp-servers/:id/tools`
**Query Params**: `{ directory?: string }`
**Response**: `{ success, tools, error? }`

**Flow**:
1. Get MCP server from Strapi
2. Call `mcpService.listMCPServerTools(serverName, projectPath)`
3. Return tools list

---

#### `POST /api/strapi/mcp-servers/:id/refresh-tools`
**Request Body**: `{ directory?: string }`
**Response**: `{ success, toolsCount, tools }`

**Flow**:
1. Get MCP server
2. Fetch tools via `mcpService.listMCPServerTools()`
3. **Sync to Strapi**: `strapiClient.bulkSyncMCPTools(id, tools)`
4. Return updated tools

**Tool Sync Logic**:
- Creates new MCPTool records
- Updates existing tools
- Deletes removed tools
- Maintains relation to MCP server

---

### Tasks

#### `GET /api/strapi/tasks`
**Query Params**: `{ status?, agentId?, search?, sort?, page, pageSize }`
**Response**: `{ data: Task[], meta }`

---

#### `GET /api/strapi/tasks/:id`
**Response**: `{ ...task }`

---

#### `POST /api/strapi/tasks`
**Request Body**:
```typescript
{
  name: string,
  description: string,
  agentId: string,
  userPrompt: string,
  taskType?: string,
  permissionMode?: string,
  inputValues?: Record<string, any>,
  directory?: string
}
```
**Response**: `{ ...task }`

**Transformation**:
```typescript
{
  agentId,
  message: userPrompt,
  metadata: {
    name, description, taskType, permissionMode,
    inputValues, directory, ...rest
  }
}
```

---

#### `PUT /api/strapi/tasks/:id`
**Request Body**: Partial task updates
**Response**: `{ ...task }`

---

#### `DELETE /api/strapi/tasks/:id`
**Response**: 204 No Content

---

### File Upload

#### `POST /api/strapi/upload`
**Content-Type**: `multipart/form-data`
**Request Body**: Form with `file` field
**Response**: `{ documentId, name, url, ... }`

**Flow**:
1. Multer middleware processes upload
2. `strapiClient.uploadFile(buffer, filename)`
3. File saved to Strapi media library

---

#### `DELETE /api/strapi/upload/:fileId`
**Response**: 204 No Content
**Flow**: `strapiClient.deleteFile(fileId)`

---

#### `GET /api/strapi/health`
**Response**: `{ status: 'healthy', message, timestamp }`
**Flow**: `strapiClient.healthCheck()`

---

## 4. Manager Routes (Legacy - Filesystem)

**File**: `src/routes/manager.routes.ts`
**Purpose**: Filesystem-based CRUD (legacy, being phased out)
**Key Dependencies**: claude-structure-parser, mcp-service, skill-service

### Key Endpoints

#### `POST /api/manager/validate`
**Purpose**: Validate Claude setup
**Response**: `{ cli, sdk, folder, agents, commands, skills }`

---

#### `GET /api/manager/agents`
**Purpose**: List agents from filesystem
**Response**: `{ agents: Agent[] }`
**Flow**: `parser.parseAgents(projectPath)`

---

#### `GET /api/manager/skills`
**Purpose**: List skills from filesystem
**Query**: `{ includeUsage?: 'true' }`
**Response**: `{ skills: Skill[] }`
**Flow**: `parser.parseSkills()` or `getSkillsWithUsageInfo()`

---

#### `POST /api/manager/agents/:id/execute` ⭐ **SSE STREAMING**
**Purpose**: Execute filesystem-based agent
**Request Body**:
```typescript
{
  directory?: string,
  userPrompt: string,
  permissionMode?: string
}
```
**Response**: Server-Sent Events

**Flow**:
1. Parse agent from filesystem
2. Set SSE headers
3. Build system prompt (merge skills if configured)
4. Load MCP config from `.mcp.json`
5. Execute with SDK `query()`
6. Stream messages

---

#### `POST /api/manager/skills/:id/execute` ⭐ **SSE STREAMING**
**Purpose**: Execute filesystem-based skill
**Request Body**:
```typescript
{
  directory?: string,
  userPrompt: string,
  parameters?: Record<string, any>,
  permissionMode?: string
}
```
**Response**: Server-Sent Events

**Flow**:
1. Parse skill from filesystem
2. Validate parameters against `inputFields`
3. Inject parameters into skill content (`{{param}}` replacement)
4. Execute with SDK
5. Stream results

---

#### `POST /api/manager/skills/:id/train` ⭐ **SSE STREAMING**
**Purpose**: Train skill with training agent
**Response**: Server-Sent Events

**Flow**:
1. Get skill from filesystem
2. Select training agent (`selectTrainingAgent()`)
3. Build training prompt
4. Execute training agent
5. Stream training session

---

#### `POST /api/manager/skills/:id/train/message` ⭐ **SSE STREAMING**
**Purpose**: Interactive skill training conversation
**Request Body**: `{ conversationHistory }`
**Response**: Server-Sent Events

**Flow**:
1. Get skill (filesystem or Strapi fallback)
2. Get training agent
3. Build prompt with conversation history
4. Execute training agent
5. Stream responses

---

#### `POST /api/manager/agents/create-with-claude/message` ⭐ **SSE STREAMING**
**Purpose**: AI-assisted agent creation
**Request Body**: `{ conversationHistory }`
**Response**: Server-Sent Events

**Flow**:
1. Load agent creator system prompt
2. Execute with SDK
3. Stream conversation

---

#### `POST /api/manager/skills/create-with-claude/message` ⭐ **SSE STREAMING**
**Purpose**: AI-assisted skill creation
**Request Body**: `{ conversationHistory }`
**Response**: Server-Sent Events

**Flow**:
1. Load skill creator system prompt
2. Execute with SDK
3. Stream conversation

---

## 5. Task Routes (`/api/tasks`)

**File**: `src/routes/task.routes.ts`
**Purpose**: Task queue management and execution
**Key Dependencies**: task-storage-service, claude-structure-parser, strapi-client

### Endpoints

#### `GET /api/tasks`
**Query Params**: `{ status?, agentId?, limit?, offset? }`
**Response**: `{ tasks: Task[] }`
**Flow**: `taskStorage.getTasks()`

---

#### `GET /api/tasks/stats`
**Response**: `{ total, pending, running, completed, failed }`
**Flow**: `taskStorage.getStats()`

---

#### `GET /api/tasks/:id`
**Response**: `{ task: Task }`
**Flow**: `taskStorage.getTask(id)`

---

#### `POST /api/tasks`
**Request Body**:
```typescript
{
  name: string,
  agentId: string,
  userPrompt: string,
  taskType?: 'agent' | 'skill',
  directory?: string,
  inputValues?: Record<string, any>
}
```
**Response**: `{ task: Task }`

**Flow**:
1. Validate required fields
2. Determine task type (agent or skill)
3. If skill: Parse specific skill only (isolation)
4. If agent: Parse agent
5. Create task: `taskStorage.createTask()`

---

#### `POST /api/tasks/:id/execute` ⭐ **SSE STREAMING**
**Purpose**: Execute queued task
**Response**: Server-Sent Events

**Flow for Skill Tasks**:
1. Get task from storage
2. Update status to 'running'
3. **Fetch skill from Strapi** (primary source)
4. **Sync skill to filesystem**: `skillSyncService.syncSkillToFilesystem()`
5. Parse synced skill to get content
6. Inject parameters from `task.inputValues`
7. Build system prompt with skill config
8. Parse tools from `toolConfig` component
9. Build MCP servers from skill's `mcpConfig`
10. Execute with SDK:
    ```typescript
    query({
      prompt: task.userPrompt,
      options: {
        systemPrompt, // skill.config + skillmd with params
        model: 'claude-sonnet-4-5',
        settingSources: ['project'], // Enable skill discovery
        allowedTools, disallowedTools,
        mcpServers,
        permissionMode
      }
    })
    ```
11. Stream messages as SSE
12. Update task status to 'completed'

**Flow for Agent Tasks**:
1. Get agent from filesystem
2. Merge skills if configured
3. Build system prompt
4. Build MCP servers
5. Execute with SDK
6. Stream messages
7. Update task status

**Skill Isolation**:
- Only the selected skill is loaded (not all skills)
- Skill execution metadata added to task:
  ```typescript
  {
    selectedSkillId, selectedSkillName,
    source: 'strapi',
    isolationLevel: 'full',
    systemPromptSource: 'skill.content',
    otherSkillsAccessible: false
  }
  ```

---

#### `DELETE /api/tasks/:id`
**Response**: `{ success: true, message }`
**Flow**: `taskStorage.deleteTask(id)`

---

## 6. Hello Routes (`/api/hello`)

**File**: `src/routes/hello.routes.ts`
**Purpose**: Simple health check endpoint

#### `GET /api/hello`
**Response**: `{ message: 'Hello World' }`

---

## SSE Streaming Pattern Analysis

### Common SSE Flow Across All Streaming Endpoints

```
1. Client initiates request
   ↓
2. Server sets SSE headers:
   Content-Type: text/event-stream
   Cache-Control: no-cache
   Connection: keep-alive
   X-Accel-Buffering: no
   ↓
3. Server sends initial status event
   ↓
4. Server starts SDK conversation
   ↓
5. SDK emits events (user, assistant, tool_use, result)
   ↓
6. Server transforms & forwards events
   res.write(`data: ${JSON.stringify(event)}\n\n`)
   ↓
7. Client receives real-time updates
   ↓
8. On completion/error:
   - Send final event
   - res.end()
```

### SSE Event Types by Endpoint

#### Chat Messages (`/api/chat/sessions/:id/messages`)
```
- user_message_saved
- stream_id
- assistant_message_start
- assistant_message_delta (incremental text)
- sdk_message (full SDK events)
- assistant_message_saved
- done / cancelled / error
```

#### Agent Execution (`/api/execute/agent/:id`)
```
- status (starting, progress, completion)
- debug (configuration loaded)
- message (SDK events: user, assistant, tool_use, etc.)
- error
```

#### Task Execution (`/api/tasks/:id/execute`)
```
- status (starting, running, completed)
- message (SDK events)
- debug (stderr output)
- error
- done
```

#### Training Sessions (`/api/manager/skills/:id/train/message`)
```
- status (processing)
- message (training agent messages)
- complete
- error
```

### Keep-Alive Mechanism

**Execution Routes** use SSEStream class:
```typescript
startKeepAlive() {
  this.keepAliveInterval = setInterval(() => {
    this.sendComment('keep-alive'); // : keep-alive\n\n
  }, 30000); // Every 30 seconds
}
```

**Purpose**: Prevents proxy/CDN timeouts during long-running executions

---

## Request Flow Diagrams

### 1. Chat Message Flow (SSE)

```
Frontend
  │
  │ POST /api/chat/sessions/:id/messages
  │ Body: { message, attachments, skillIds }
  │
  ▼
chat.routes.ts
  │
  │ 1. Set SSE headers
  │ 2. Get working directory
  │
  ▼
chatService.sendMessage()
  │
  ├─→ strapiClient.getChatSession(id)
  │     └─→ Strapi API → PostgreSQL
  │
  ├─→ strapiClient.getAgent(agentId)
  │     └─→ Strapi API → PostgreSQL
  │
  ├─→ strapiClient.getSkillsByIds(skillIds)
  │     └─→ Strapi API → PostgreSQL
  │
  ├─→ skillSyncService.syncAllSkills(skills)
  │     └─→ Write to .claude/skills/{name}/SKILL.md
  │
  ├─→ claude-sdk-service.query()
  │     │
  │     ├─→ Claude SDK (subprocess)
  │     │     │
  │     │     ├─→ Discovers skills via settingSources: ['project']
  │     │     ├─→ Connects to MCP servers
  │     │     └─→ Streams messages
  │     │
  │     └─→ Yields events:
  │           - user
  │           - assistant (with content)
  │           - tool_use
  │           - tool_result
  │           - result
  │
  ├─→ Transform events
  │
  └─→ chatService yields to route:
        - user_message_saved
        - stream_id
        - assistant_message_delta
        - sdk_message
        - done

chat.routes.ts
  │
  │ For each event:
  │   res.write(`data: ${JSON.stringify(event)}\n\n`)
  │
  ▼
Frontend EventSource
  │
  │ onmessage: Parse event
  │ Update UI in real-time
```

---

### 2. Agent Execution Flow (SSE)

```
Frontend
  │
  │ POST /api/execute/agent/:id
  │ Body: { message, conversationId }
  │
  ▼
execution.routes.ts
  │
  │ 1. Validate params
  │ 2. Initialize SSEStream
  │ 3. Start keep-alive (30s)
  │
  ├─→ strapiClient.getAgent(id)
  │     └─→ Strapi API → PostgreSQL
  │
  ├─→ Extract skill IDs from agent.skillSelection
  ├─→ Extract MCP server IDs from agent.mcpConfig
  │
  ├─→ strapiClient.getSkillsByIds()
  │     └─→ Strapi API → PostgreSQL
  │
  ├─→ strapiClient.getMCPServersByIds()
  │     └─→ Strapi API → PostgreSQL
  │
  ├─→ skillSyncService.syncAllSkills(skills)
  │     └─→ Write to .claude/skills/*/SKILL.md
  │
  ├─→ Build ConversationConfig:
  │     - systemPrompt
  │     - allowedTools (from agent + skills)
  │     - disallowedTools
  │     - mcpServers
  │     - model
  │     - permissionMode
  │     - skills (for MCP loading)
  │
  ├─→ Register event handlers:
  │     - 'claude-message' → forward to frontend
  │     - 'process-error' → error handling
  │     - 'process-closed' → completion
  │     - 'close' (client disconnect) → cleanup
  │
  ├─→ claudeSdkService.startConversation(config)
  │     │
  │     └─→ Claude SDK spawns process
  │           │
  │           ├─→ Loads skills from .claude/skills/
  │           ├─→ Connects to MCP servers
  │           └─→ Processes message
  │
  ├─→ SDK emits 'claude-message' events
  │     │
  │     └─→ messageHandler receives event
  │           │
  │           ├─→ Save to executionLog
  │           └─→ stream.sendData({ type: 'message', content })
  │
  ├─→ On 'result' event:
  │     ├─→ Calculate tokens & cost
  │     └─→ Send completion event
  │
  └─→ Cleanup:
        ├─→ claudeSdkService.stopConversation()
        ├─→ Remove event listeners
        └─→ stream.close()

Frontend EventSource
  │
  │ Receives events:
  │   - status: "Starting agent..."
  │   - debug: "Configuration loaded"
  │   - message: SDK events
  │   - status: "Completed"
```

---

### 3. Task Execution Flow (Skill)

```
Frontend
  │
  │ POST /api/tasks/:id/execute
  │
  ▼
task.routes.ts
  │
  ├─→ taskStorage.getTask(id)
  │     └─→ SQLite (local file)
  │
  ├─→ taskStorage.updateTaskStatus('running')
  │
  ├─→ Set SSE headers
  │
  ├─→ SKILL EXECUTION PATH:
  │     │
  │     ├─→ strapiClient.getSkill(task.agentId)
  │     │     │
  │     │     └─→ Strapi API → PostgreSQL
  │     │           Returns: {
  │     │             id, name, skillmd, toolConfig, mcpConfig
  │     │           }
  │     │
  │     ├─→ skillSyncService.syncSkillToFilesystem(skill, inputValues)
  │     │     │
  │     │     └─→ Write to .claude/skills/{name}/SKILL.md
  │     │           with parameter injection
  │     │
  │     ├─→ parser.parseSpecificSkill(skillName)
  │     │     │
  │     │     └─→ Read synced file, parse YAML + markdown
  │     │
  │     ├─→ Merge Strapi metadata with parsed content:
  │     │     skill = { ...strapiSkill, content: parsedSkill.content }
  │     │
  │     ├─→ Inject parameters into content:
  │     │     Replace {{param}} with task.inputValues[param]
  │     │
  │     ├─→ Build system prompt:
  │     │     skillConfig (header)
  │     │     + Parameter list
  │     │     + skillmd content (processed)
  │     │
  │     ├─→ Parse allowedTools from skill.toolConfig
  │     ├─→ Parse disallowedTools from skill.toolConfig
  │     │
  │     ├─→ Build MCP servers from skill.mcpConfig:
  │     │     │
  │     │     ├─→ For each mcpConfig entry:
  │     │     │     - Get server name
  │     │     │     - Load command/args from .mcp.json
  │     │     │     - Extract selected tools
  │     │     │
  │     │     └─→ Return: { serverName: { command, args, env } }
  │     │
  │     ├─→ query({
  │     │     prompt: task.userPrompt,
  │     │     options: {
  │     │       systemPrompt, // skill.config + skillmd
  │     │       model: 'claude-sonnet-4-5',
  │     │       cwd: projectPath,
  │     │       settingSources: ['project'], // ✅ Enable skills
  │     │       allowedTools,
  │     │       disallowedTools,
  │     │       mcpServers,
  │     │       permissionMode
  │     │     }
  │     │   })
  │     │
  │     ├─→ Stream messages:
  │     │     For each SDK message:
  │     │       - Save to executionLog
  │     │       - res.write(`data: ${JSON.stringify(event)}\n\n`)
  │     │
  │     ├─→ On completion:
  │     │     └─→ taskStorage.updateTaskStatus('completed', {
  │     │           executionLog
  │     │         })
  │     │
  │     └─→ res.end()
  │
  └─→ On error:
        └─→ taskStorage.updateTaskStatus('failed', { error })
```

**Key Isolation Features**:
1. Only ONE skill loaded (not all skills)
2. Skill fetched from Strapi (single source of truth)
3. Synced to filesystem for SDK discovery
4. Metadata preserved from Strapi (toolConfig, mcpConfig)
5. Parameters injected before execution
6. Execution metadata added to task

---

### 4. Strapi CRUD Flow (Agent Creation)

```
Frontend
  │
  │ POST /api/strapi/agents
  │ Body: { agent: { name, systemPrompt, skills, mcpTools, ... } }
  │
  ▼
manager.routes.strapi.ts
  │
  ├─→ 1. Transform skill names to IDs:
  │     │
  │     ├─→ strapiClient.getAllSkills()
  │     │     └─→ Strapi API → PostgreSQL
  │     │
  │     └─→ Map skill names → skill documentIds
  │
  ├─→ 2. Transform fields to components:
  │     │
  │     ├─→ model → modelConfig component
  │     ├─→ metadata → metadata components array
  │     ├─→ tools → toolConfig component
  │     │
  │     └─→ mcpTools → mcpConfig component:
  │           │
  │           ├─→ For each server:
  │           │     │
  │           │     ├─→ strapiClient.getAllMCPServers({ populate: true })
  │           │     │     └─→ Strapi API → PostgreSQL
  │           │     │
  │           │     ├─→ Find server by ID
  │           │     ├─→ Map tool names → tool IDs
  │           │     │
  │           │     └─→ Build: {
  │           │           mcpServer: serverId,
  │           │           selectedTools: [{ mcpTool: toolId }, ...]
  │           │         }
  │           │
  │           └─→ Result: [{ mcpServer, selectedTools }, ...]
  │
  ├─→ 3. strapiClient.createAgent(transformedData)
  │     │
  │     └─→ POST /api/agents
  │           │
  │           └─→ Strapi API
  │                 │
  │                 ├─→ Validate schema
  │                 ├─→ Create agent record
  │                 ├─→ Create component records
  │                 ├─→ Link relations
  │                 │
  │                 └─→ PostgreSQL
  │
  └─→ 4. Response: { success: true, agentId, filePath }
```

---

### 5. MCP Tool Discovery & Sync Flow

```
Frontend
  │
  │ POST /api/strapi/mcp-servers/:id/refresh-tools
  │ Body: { directory }
  │
  ▼
manager.routes.strapi.ts
  │
  ├─→ strapiClient.getMCPServer(id)
  │     │
  │     └─→ Strapi API → PostgreSQL
  │           Returns: { id, name, command, args, transport }
  │
  ├─→ mcpService.listMCPServerTools(serverName, projectPath)
  │     │
  │     ├─→ Load .mcp.json config
  │     │
  │     ├─→ Spawn MCP server process (stdio):
  │     │     spawn(command, args, { cwd, env, stdio })
  │     │
  │     ├─→ Send JSON-RPC request:
  │     │     {
  │     │       "jsonrpc": "2.0",
  │     │       "id": 1,
  │     │       "method": "tools/list"
  │     │     }
  │     │
  │     ├─→ Receive JSON-RPC response:
  │     │     {
  │     │       "result": {
  │     │         "tools": [
  │     │           {
  │     │             "name": "read_file",
  │     │             "description": "Read file contents",
  │     │             "inputSchema": { ... }
  │     │           },
  │     │           ...
  │     │         ]
  │     │       }
  │     │     }
  │     │
  │     ├─→ Parse tools
  │     │
  │     └─→ Kill subprocess
  │
  ├─→ strapiClient.bulkSyncMCPTools(serverId, tools)
  │     │
  │     ├─→ 1. Fetch existing tools:
  │     │     GET /api/mcp-tools?filters[mcpServer][documentId]=$eq:{serverId}
  │     │
  │     ├─→ 2. Compare new vs existing:
  │     │     - Tools to create (new)
  │     │     - Tools to update (changed)
  │     │     - Tools to delete (removed)
  │     │
  │     ├─→ 3. Create new tools:
  │     │     For each new tool:
  │     │       POST /api/mcp-tools
  │     │         {
  │     │           name, description, inputSchema,
  │     │           mcpServer: serverId
  │     │         }
  │     │
  │     ├─→ 4. Update changed tools:
  │     │     For each changed tool:
  │     │       PUT /api/mcp-tools/{toolId}
  │     │         { description, inputSchema }
  │     │
  │     ├─→ 5. Delete removed tools:
  │     │     For each removed tool:
  │     │       DELETE /api/mcp-tools/{toolId}
  │     │
  │     └─→ 6. Return updated server with tools:
  │           strapiClient.getMCPServer(serverId)
  │
  └─→ Response: { success: true, toolsCount, tools }
```

---

## Key Data Flow Patterns

### 1. Strapi as Primary Data Source

```
Frontend → Express Routes → strapiClient → Strapi API → PostgreSQL
```

**All CRUD operations** flow through this pattern:
- Agents, Skills, MCP Servers, Tasks, Chat Sessions
- Single source of truth
- LRU caching for performance

---

### 2. Filesystem Sync for SDK Discovery

```
Strapi (database)
  ↓
skillSyncService.syncSkillToFilesystem()
  ↓
.claude/skills/{name}/SKILL.md
  ↓
Claude SDK (settingSources: ['project'])
  ↓
Skill tool available to Claude
```

**Why?**: Claude SDK discovers skills from filesystem, not database

---

### 3. MCP Server Dual Source

```
Strapi (metadata: name, disabled, tools)
  +
.mcp.json (runtime: command, args, env)
  ↓
Claude SDK spawns servers
```

**Separation**:
- Strapi: Which servers/tools to use (user config)
- .mcp.json: How to run servers (technical config)

---

### 4. SSE Event Broadcasting

```
Claude SDK (subprocess)
  ↓ emits events
claude-sdk-service (transforms)
  ↓ EventEmitter
Route handler (forwards)
  ↓ res.write()
Frontend EventSource (receives)
```

**Event types**:
- system, user, assistant, tool_use, tool_result, result

---

## API Security & Validation

### Request Validation

**Zod Schemas** used in execution and strapi routes:
- `executeAgentSchema` - Validates agent execution requests
- `createAgentSchema` - Validates agent creation
- `updateAgentSchema` - Validates agent updates
- `createSkillSchema` - Validates skill creation
- `createMCPServerSchema` - Validates MCP server creation

**Validation Points**:
- Required fields
- Type checking
- String length limits
- Array validation
- Enum validation (status, transport, etc.)

---

### Error Handling

**Middleware**: `errorHandler` (last in chain)
```typescript
app.use(errorHandler); // Catches all unhandled errors
```

**Error Response Format**:
```json
{
  "error": "Error message",
  "message": "Detailed message",
  "type": "ErrorType"
}
```

**SSE Error Handling**:
```typescript
if (res.headersSent) {
  // Headers already sent, send error event
  res.write(`data: ${JSON.stringify({ type: 'error', error: ... })}\n\n`);
} else {
  // Headers not sent, send JSON error
  res.status(500).json({ error: ... });
}
```

---

### Input Sanitization

**Skill Name Sanitization**:
```typescript
// In skill-sync-service
const sanitizedName = skillName
  .replace(/[^a-z0-9-_]/gi, '-')
  .toLowerCase();

// Prevent path traversal
if (sanitizedName.includes('..') || sanitizedName.includes('/')) {
  throw new Error('Invalid skill name');
}
```

**Parameter Validation**:
```typescript
// Size limits
if (paramValue.length > 10240) { // 10KB
  throw new Error('Parameter too large');
}

if (totalSize > 1048576) { // 1MB total
  throw new Error('Total parameter size exceeds limit');
}
```

---

## Performance Optimizations

### 1. LRU Caching (strapiClient)

```typescript
// Cache configuration
const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5 // 5 minutes
});

// Cache keys
cache.set(`agent:${id}`, agent);
cache.set(`skill:all:${hash(options)}`, skills);

// Invalidation on mutations
createAgent() → cache.delete('agent:all:*')
updateAgent(id) → cache.delete(`agent:${id}`)
```

**Hit rate**: Significantly reduces Strapi API calls

---

### 2. Non-Blocking Operations

**MCP Server Creation**:
```typescript
// Create server
const server = await strapiClient.createMCPServer(...);

// Auto-fetch tools (non-blocking)
mcpService.listMCPServerTools(...)
  .then(result => strapiClient.bulkSyncMCPTools(...))
  .catch(error => logger.warn(...));

// Sync to .mcp.json (non-blocking)
mcpService.syncToMcpJson(...)
  .catch(error => logger.warn(...));

// Return immediately
res.json(server);
```

**Benefit**: Fast response, background syncing

---

### 3. SSE Keep-Alive

```typescript
// Prevents proxy timeouts
setInterval(() => {
  res.write(': keep-alive\n\n');
}, 30000);
```

**Why**: Long-running agent executions can exceed proxy timeouts

---

## Summary

### Total Endpoints

- **Chat Routes**: 9 endpoints (2 SSE)
- **Execution Routes**: 4 endpoints (2 SSE)
- **Strapi Manager**: 29 endpoints (1 SSE)
- **Legacy Manager**: 20+ endpoints (6 SSE)
- **Task Routes**: 6 endpoints (1 SSE)
- **Hello Routes**: 1 endpoint

**Total SSE Streaming Endpoints**: 12

---

### Key Architectural Decisions

1. **Strapi as Single Data Source** - All persistent data flows through strapiClient
2. **Filesystem Sync for SDK** - Skills synced to `.claude/skills/` for discovery
3. **Component-Based Data Model** - Strapi 5 uses dynamic zones for flexible configs
4. **SSE for Real-Time** - All agent/chat execution uses Server-Sent Events
5. **Event-Driven Communication** - SDK events forwarded to frontend
6. **Skill Isolation** - Tasks execute single skill, not all skills
7. **MCP Dual Source** - Metadata in Strapi, runtime in .mcp.json
8. **Just-In-Time Syncing** - Skills synced before execution, not stored permanently

---

*Analysis completed: January 2, 2026*
*Routes analyzed: 6 files, 68+ endpoints*
