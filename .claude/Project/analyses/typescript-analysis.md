# TypeScript Analysis - Claude Agent UI Migration

**Project:** Claude Agent UI - Strapi & PostgreSQL Migration
**Focus:** Complete TypeScript Type System Design
**Date:** 2025-01-31
**Version:** 1.0

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Domain Types](#core-domain-types)
3. [Strapi Response Types](#strapi-response-types)
4. [DTO Patterns with Utility Types](#dto-patterns-with-utility-types)
5. [Express API Types with SSE](#express-api-types-with-sse)
6. [tsconfig.json Configuration](#tsconfigjson-configuration)
7. [Frontend Type Safety Patterns](#frontend-type-safety-patterns)
8. [Type Guards & Validators](#type-guards--validators)
9. [Advanced Type Patterns](#advanced-type-patterns)
10. [Testing Types](#testing-types)

---

## Executive Summary

This document provides a complete TypeScript type system for the hybrid Strapi + Express + PostgreSQL architecture. The type system ensures:

- ✅ **End-to-end type safety** from database to frontend
- ✅ **Strapi response transformation** with proper generic types
- ✅ **DTO validation** using utility types and Zod
- ✅ **SSE streaming types** for real-time communication
- ✅ **Frontend-backend contract** with shared type definitions
- ✅ **Runtime validation** integrated with static types

---

## Core Domain Types

### 1. Agent Interface

```typescript
// types/agent.types.ts

/**
 * Claude model options available for agents
 */
export type ClaudeModel =
  | 'sonnet'
  | 'opus'
  | 'haiku'
  | 'sonnet-4'
  | 'opus-4';

/**
 * Available tools that agents can use
 */
export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebSearch'
  | 'WebFetch'
  | 'Task'
  | 'SlashCommand'
  | 'Skill'
  | 'NotebookEdit'
  | 'TodoWrite'
  | 'BashOutput'
  | 'KillShell';

/**
 * Core Agent interface representing a Claude agent configuration
 */
export interface Agent {
  /** Unique identifier (string for compatibility with both SQLite and PostgreSQL) */
  id: string;

  /** Human-readable agent name (unique) */
  name: string;

  /** Optional description of agent's purpose */
  description?: string;

  /** System prompt that defines agent behavior */
  systemPrompt: string;

  /** List of allowed tools for this agent */
  tools: ToolName[];

  /** List of explicitly disallowed tools */
  disallowedTools: ToolName[];

  /** Claude model to use for this agent */
  model: ClaudeModel;

  /** Whether the agent is currently enabled */
  enabled: boolean;

  /** Associated MCP server IDs */
  mcpServers: string[];

  /** Associated skill IDs */
  skills: string[];

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Agent with populated relations (used when fetching with relations)
 */
export interface AgentWithRelations extends Omit<Agent, 'mcpServers' | 'skills'> {
  mcpServers: MCPServer[];
  skills: Skill[];
}
```

### 2. Skill Interface

```typescript
// types/skill.types.ts

/**
 * Skill interface representing a reusable agent capability
 */
export interface Skill {
  /** Unique identifier */
  id: string;

  /** Unique skill name */
  name: string;

  /** Description of what the skill does */
  description?: string;

  /** Skill content (markdown with instructions) */
  content: string;

  /** Tools allowed when this skill is active */
  allowedTools: ToolName[];

  /** Experience score (0-1) for skill effectiveness */
  experienceScore: number;

  /** Agent IDs that use this skill */
  agents?: string[];

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Skill with populated agent relations
 */
export interface SkillWithRelations extends Omit<Skill, 'agents'> {
  agents: Agent[];
}
```

### 3. MCP Server Interface

```typescript
// types/mcp-server.types.ts

/**
 * MCP transport protocol type
 */
export type MCPTransport = 'stdio' | 'sse' | 'http';

/**
 * MCP Server configuration
 */
export interface MCPServer {
  /** Unique identifier */
  id: string;

  /** Unique server name */
  name: string;

  /** Command to execute MCP server */
  command: string;

  /** Command line arguments */
  args: string[];

  /** Environment variables for the server */
  env: Record<string, string>;

  /** Whether the server is disabled */
  disabled: boolean;

  /** Transport protocol used by the server */
  transport: MCPTransport;

  /** Agent IDs using this MCP server */
  agents?: string[];

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * MCP Server with populated agent relations
 */
export interface MCPServerWithRelations extends Omit<MCPServer, 'agents'> {
  agents: Agent[];
}

/**
 * MCP Server runtime status
 */
export interface MCPServerStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  uptime?: number;
  lastError?: string;
}
```

### 4. Task Interface

```typescript
// types/task.types.ts

/**
 * Task status enumeration
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Task interface for tracking agent executions
 */
export interface Task {
  /** Unique identifier */
  id: string;

  /** Agent ID that executed this task */
  agentId: string;

  /** User input/prompt */
  userMessage: string;

  /** Agent response */
  agentResponse?: string;

  /** Current task status */
  status: TaskStatus;

  /** Execution start time */
  startedAt: Date;

  /** Execution completion time */
  completedAt?: Date;

  /** Error message if failed */
  error?: string;

  /** Metadata (tool calls, tokens used, etc.) */
  metadata?: Record<string, any>;

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Task with populated agent relation
 */
export interface TaskWithAgent extends Task {
  agent: Agent;
}
```

---

## Strapi Response Types

### Generic Strapi Response Wrappers

```typescript
// types/strapi.types.ts

/**
 * Strapi metadata for individual entities
 */
export interface StrapiMeta {
  pagination?: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
}

/**
 * Strapi attributes wrapper
 */
export interface StrapiAttributes<T> {
  id: number;
  attributes: T & {
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
  };
}

/**
 * Strapi single entity response
 */
export interface StrapiData<T> {
  data: StrapiAttributes<T> | null;
  meta?: StrapiMeta;
}

/**
 * Strapi collection response
 */
export interface StrapiResponse<T> {
  data: StrapiAttributes<T>[];
  meta?: StrapiMeta;
}

/**
 * Strapi error response
 */
export interface StrapiError {
  status: number;
  name: string;
  message: string;
  details?: Record<string, any>;
}

export interface StrapiErrorResponse {
  data: null;
  error: StrapiError;
}

/**
 * Strapi relation data structure
 */
export interface StrapiRelation<T> {
  data: StrapiAttributes<T>[] | StrapiAttributes<T> | null;
}
```

### Strapi-Specific Entity Types

```typescript
// types/strapi-entities.types.ts

/**
 * Agent attributes as stored in Strapi
 */
export interface StrapiAgentAttributes {
  name: string;
  description?: string;
  systemPrompt: string;
  tools: ToolName[];
  disallowedTools: ToolName[];
  model: ClaudeModel;
  enabled: boolean;
  mcpServers?: StrapiRelation<StrapiMCPServerAttributes>;
  skills?: StrapiRelation<StrapiSkillAttributes>;
}

/**
 * Skill attributes as stored in Strapi
 */
export interface StrapiSkillAttributes {
  name: string;
  description?: string;
  content: string;
  allowedTools: ToolName[];
  experienceScore: number;
  agents?: StrapiRelation<StrapiAgentAttributes>;
}

/**
 * MCP Server attributes as stored in Strapi
 */
export interface StrapiMCPServerAttributes {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  disabled: boolean;
  transport: MCPTransport;
  agents?: StrapiRelation<StrapiAgentAttributes>;
}

/**
 * Task attributes as stored in Strapi
 */
export interface StrapiTaskAttributes {
  userMessage: string;
  agentResponse?: string;
  status: TaskStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
  agent?: StrapiRelation<StrapiAgentAttributes>;
}

// Type aliases for complete Strapi responses
export type StrapiAgentResponse = StrapiResponse<StrapiAgentAttributes>;
export type StrapiAgentData = StrapiData<StrapiAgentAttributes>;
export type StrapiSkillResponse = StrapiResponse<StrapiSkillAttributes>;
export type StrapiSkillData = StrapiData<StrapiSkillAttributes>;
export type StrapiMCPServerResponse = StrapiResponse<StrapiMCPServerAttributes>;
export type StrapiMCPServerData = StrapiData<StrapiMCPServerAttributes>;
export type StrapiTaskResponse = StrapiResponse<StrapiTaskAttributes>;
export type StrapiTaskData = StrapiData<StrapiTaskAttributes>;
```

### Transformation Utilities

```typescript
// types/strapi-transformers.types.ts

/**
 * Type for transformation functions from Strapi to domain models
 */
export type StrapiTransformer<TStrapiAttr, TDomain> = (
  data: StrapiAttributes<TStrapiAttr>
) => TDomain;

/**
 * Type for transformation functions from domain to Strapi
 */
export type DomainTransformer<TDomain, TStrapiAttr> = (
  data: Partial<TDomain>
) => Partial<TStrapiAttr>;

/**
 * Bidirectional transformer interface
 */
export interface BidirectionalTransformer<TStrapiAttr, TDomain> {
  toStrapi: DomainTransformer<TDomain, TStrapiAttr>;
  fromStrapi: StrapiTransformer<TStrapiAttr, TDomain>;
}
```

---

## DTO Patterns with Utility Types

### Base DTO Types

```typescript
// types/dto.types.ts

/**
 * Creates a DTO type for creating entities (all fields optional except required ones)
 */
export type CreateDTO<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Creates a DTO type for updating entities (all fields optional)
 */
export type UpdateDTO<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Creates a DTO type for partial updates (specific fields only)
 */
export type PatchDTO<T, K extends keyof T> = Pick<Partial<T>, K>;

/**
 * Response DTO that includes computed fields
 */
export type ResponseDTO<T, TComputed = {}> = T & TComputed;

/**
 * Filter DTO for list queries
 */
export type FilterDTO<T> = {
  [K in keyof T]?: T[K] | T[K][] | { $eq?: T[K]; $ne?: T[K]; $in?: T[K][]; $nin?: T[K][] };
};

/**
 * Pagination parameters
 */
export interface PaginationDTO {
  page?: number;
  pageSize?: number;
  sort?: string[];
}

/**
 * Query parameters combining filters and pagination
 */
export interface QueryDTO<T> {
  filters?: FilterDTO<T>;
  pagination?: PaginationDTO;
  populate?: string[];
}
```

### Entity-Specific DTOs

```typescript
// types/agent.dto.ts

/**
 * DTO for creating a new agent
 */
export interface CreateAgentDTO extends CreateDTO<Agent> {
  name: string;
  systemPrompt: string;
  tools?: ToolName[];
  disallowedTools?: ToolName[];
  model?: ClaudeModel;
  enabled?: boolean;
  description?: string;
  mcpServers?: string[];
  skills?: string[];
}

/**
 * DTO for updating an existing agent
 */
export type UpdateAgentDTO = UpdateDTO<Agent>;

/**
 * DTO for partial agent updates
 */
export type PatchAgentDTO =
  | PatchDTO<Agent, 'name'>
  | PatchDTO<Agent, 'systemPrompt'>
  | PatchDTO<Agent, 'enabled'>
  | PatchDTO<Agent, 'tools'>
  | PatchDTO<Agent, 'model'>;

/**
 * Agent response with computed fields
 */
export interface AgentResponseDTO extends ResponseDTO<Agent, {
  /** Number of associated skills */
  skillCount: number;

  /** Number of associated MCP servers */
  mcpServerCount: number;

  /** Number of tasks executed */
  taskCount: number;

  /** Last execution timestamp */
  lastExecutedAt?: Date;
}> {}

/**
 * Agent list query parameters
 */
export interface AgentQueryDTO extends QueryDTO<Agent> {
  filters?: FilterDTO<Agent> & {
    search?: string; // Full-text search across name and description
  };
}

// Skill DTOs
export interface CreateSkillDTO extends CreateDTO<Skill> {
  name: string;
  content: string;
  description?: string;
  allowedTools?: ToolName[];
  experienceScore?: number;
}

export type UpdateSkillDTO = UpdateDTO<Skill>;

// MCP Server DTOs
export interface CreateMCPServerDTO extends CreateDTO<MCPServer> {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  transport?: MCPTransport;
}

export type UpdateMCPServerDTO = UpdateDTO<MCPServer>;

// Task DTOs
export interface CreateTaskDTO extends CreateDTO<Task> {
  agentId: string;
  userMessage: string;
  metadata?: Record<string, any>;
}

export type UpdateTaskDTO = UpdateDTO<Task>;
```

### Validation DTOs with Zod

```typescript
// types/validation.types.ts
import { z } from 'zod';
import type { CreateAgentDTO, UpdateAgentDTO } from './agent.dto';

/**
 * Zod schema for Agent creation
 */
export const CreateAgentSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Name can only contain letters, numbers, hyphens, and underscores'),

  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),

  systemPrompt: z.string()
    .min(10, 'System prompt must be at least 10 characters')
    .max(10000, 'System prompt must be less than 10000 characters'),

  tools: z.array(z.enum([
    'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
    'WebSearch', 'WebFetch', 'Task', 'SlashCommand',
    'Skill', 'NotebookEdit', 'TodoWrite', 'BashOutput', 'KillShell'
  ])).optional(),

  disallowedTools: z.array(z.enum([
    'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
    'WebSearch', 'WebFetch', 'Task', 'SlashCommand',
    'Skill', 'NotebookEdit', 'TodoWrite', 'BashOutput', 'KillShell'
  ])).optional(),

  model: z.enum(['sonnet', 'opus', 'haiku', 'sonnet-4', 'opus-4'])
    .default('sonnet'),

  enabled: z.boolean()
    .default(true),

  mcpServers: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
});

/**
 * Zod schema for Agent update
 */
export const UpdateAgentSchema = CreateAgentSchema.partial();

/**
 * Inferred types from Zod schemas (ensures DTO and schema match)
 */
export type ValidatedCreateAgentDTO = z.infer<typeof CreateAgentSchema>;
export type ValidatedUpdateAgentDTO = z.infer<typeof UpdateAgentSchema>;

// Compile-time check that Zod schema matches DTO
type _AssertCreateAgentDTO = ValidatedCreateAgentDTO extends CreateAgentDTO ? true : never;
type _AssertUpdateAgentDTO = ValidatedUpdateAgentDTO extends UpdateAgentDTO ? true : never;

/**
 * Generic validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError<T> };

/**
 * Validator function type
 */
export type Validator<T> = (data: unknown) => ValidationResult<T>;
```

---

## Express API Types with SSE

### HTTP Request/Response Types

```typescript
// types/express.types.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId?: string;
    [key: string]: any;
  };
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string; // Only in development
}

/**
 * Typed Express request with body
 */
export interface TypedRequest<TBody = any, TParams = any, TQuery = any>
  extends Request<TParams, any, TBody, TQuery> {}

/**
 * Typed Express response
 */
export interface TypedResponse<T = any> extends Response {
  json: (body: ApiResponse<T>) => this;
}

/**
 * Async request handler type
 */
export type AsyncRequestHandler<TBody = any, TParams = any, TQuery = any, TResponse = any> = (
  req: TypedRequest<TBody, TParams, TQuery>,
  res: TypedResponse<TResponse>,
  next: NextFunction
) => Promise<void>;

/**
 * Middleware type
 */
export type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;
```

### SSE Streaming Types

```typescript
// types/sse.types.ts

/**
 * SSE event types for agent execution
 */
export enum SSEEventType {
  START = 'start',
  TOKEN = 'token',
  TOOL_USE = 'tool_use',
  TOOL_RESULT = 'tool_result',
  THINKING = 'thinking',
  ERROR = 'error',
  COMPLETE = 'complete',
  PROGRESS = 'progress',
}

/**
 * Base SSE event structure
 */
export interface SSEBaseEvent {
  type: SSEEventType;
  timestamp: string;
}

/**
 * Start event (execution begins)
 */
export interface SSEStartEvent extends SSEBaseEvent {
  type: SSEEventType.START;
  data: {
    agentId: string;
    agentName: string;
    taskId: string;
  };
}

/**
 * Token event (streaming text)
 */
export interface SSETokenEvent extends SSEBaseEvent {
  type: SSEEventType.TOKEN;
  data: {
    content: string;
    index: number;
  };
}

/**
 * Tool use event
 */
export interface SSEToolUseEvent extends SSEBaseEvent {
  type: SSEEventType.TOOL_USE;
  data: {
    toolName: string;
    toolInput: Record<string, any>;
    toolUseId: string;
  };
}

/**
 * Tool result event
 */
export interface SSEToolResultEvent extends SSEBaseEvent {
  type: SSEEventType.TOOL_RESULT;
  data: {
    toolUseId: string;
    result: any;
    error?: string;
  };
}

/**
 * Thinking event (internal reasoning)
 */
export interface SSEThinkingEvent extends SSEBaseEvent {
  type: SSEEventType.THINKING;
  data: {
    content: string;
  };
}

/**
 * Progress event
 */
export interface SSEProgressEvent extends SSEBaseEvent {
  type: SSEEventType.PROGRESS;
  data: {
    percentage: number;
    message: string;
  };
}

/**
 * Error event
 */
export interface SSEErrorEvent extends SSEBaseEvent {
  type: SSEEventType.ERROR;
  data: {
    error: string;
    code?: string;
    recoverable: boolean;
  };
}

/**
 * Complete event (execution finished)
 */
export interface SSECompleteEvent extends SSEBaseEvent {
  type: SSEEventType.COMPLETE;
  data: {
    result: string;
    tokensUsed: number;
    executionTime: number;
  };
}

/**
 * Union type of all SSE events
 */
export type SSEEvent =
  | SSEStartEvent
  | SSETokenEvent
  | SSEToolUseEvent
  | SSEToolResultEvent
  | SSEThinkingEvent
  | SSEProgressEvent
  | SSEErrorEvent
  | SSECompleteEvent;

/**
 * SSE event handler callbacks
 */
export interface SSECallbacks {
  onStart?: (event: SSEStartEvent) => void;
  onToken?: (event: SSETokenEvent) => void;
  onToolUse?: (event: SSEToolUseEvent) => void;
  onToolResult?: (event: SSEToolResultEvent) => void;
  onThinking?: (event: SSEThinkingEvent) => void;
  onProgress?: (event: SSEProgressEvent) => void;
  onError?: (event: SSEErrorEvent) => void;
  onComplete?: (event: SSECompleteEvent) => void;
}

/**
 * SSE Response helper type
 */
export interface SSEResponse extends Response {
  writeSSE: (event: SSEEvent) => void;
}
```

### Route-Specific Types

```typescript
// types/routes.types.ts

/**
 * Agent execution request body
 */
export interface ExecuteAgentRequest {
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
  streaming?: boolean;
}

/**
 * Agent execution response (non-streaming)
 */
export interface ExecuteAgentResponse {
  taskId: string;
  result: string;
  tokensUsed: number;
  executionTime: number;
  toolsUsed: string[];
}

/**
 * MCP Server test request
 */
export interface TestMCPServerRequest {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * MCP Server test response
 */
export interface TestMCPServerResponse {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}

/**
 * MCP Server toggle request
 */
export interface ToggleMCPServerRequest {
  disabled: boolean;
}

/**
 * Route handlers with proper typing
 */
export type AgentRouteHandlers = {
  list: AsyncRequestHandler<void, void, AgentQueryDTO, Agent[]>;
  get: AsyncRequestHandler<void, { id: string }, void, Agent>;
  create: AsyncRequestHandler<CreateAgentDTO, void, void, Agent>;
  update: AsyncRequestHandler<UpdateAgentDTO, { id: string }, void, Agent>;
  delete: AsyncRequestHandler<void, { id: string }, void, void>;
  execute: AsyncRequestHandler<ExecuteAgentRequest, { id: string }, void, never>; // SSE - no JSON response
};
```

---

## tsconfig.json Configuration

### Strapi Backend Configuration

```jsonc
// backend/tsconfig.json
{
  "compilerOptions": {
    // Module resolution
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,

    // Strict type checking
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": false,
    "importHelpers": true,

    // Type resolution
    "resolveJsonModule": true,
    "types": ["node"],
    "typeRoots": ["./node_modules/@types", "./src/types"],

    // Path mapping for clean imports
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@types/*": ["src/types/*"],
      "@api/*": ["src/api/*"],
      "@services/*": ["src/api/*/services"],
      "@controllers/*": ["src/api/*/controllers"]
    },

    // Interop
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    // Experimental
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "src/**/*",
    ".strapi/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build",
    ".cache",
    ".tmp"
  ]
}
```

### Express Backend Configuration

```jsonc
// tsconfig.json (Express backend)
{
  "compilerOptions": {
    // Module resolution
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,

    // Strict type checking
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",

    // Type resolution
    "resolveJsonModule": true,
    "types": ["node"],
    "typeRoots": ["./node_modules/@types", "./src/types"],

    // Path mapping
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@types/*": ["src/types/*"],
      "@services/*": ["src/services/*"],
      "@routes/*": ["src/routes/*"],
      "@middleware/*": ["src/middleware/*"],
      "@utils/*": ["src/utils/*"]
    },

    // Interop
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.spec.ts",
    "**/*.test.ts"
  ],
  "ts-node": {
    "require": ["tsconfig-paths/register"],
    "transpileOnly": true,
    "files": true
  }
}
```

### Frontend Configuration

```jsonc
// frontend/tsconfig.json
{
  "compilerOptions": {
    // Module resolution
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",

    // Strict type checking
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "isolatedModules": true,
    "allowJs": false,
    "checkJs": false,

    // Type resolution
    "resolveJsonModule": true,
    "types": ["vite/client", "node"],
    "typeRoots": ["./node_modules/@types", "./src/types"],

    // Path mapping (must match vite.config.ts)
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@types/*": ["src/types/*"],
      "@components/*": ["src/components/*"],
      "@services/*": ["src/services/*"],
      "@hooks/*": ["src/hooks/*"],
      "@utils/*": ["src/utils/*"],
      "@store/*": ["src/store/*"]
    },

    // Interop
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,

    // Vite-specific
    "useDefineForClassFields": true,
    "allowImportingTsExtensions": false
  },
  "include": [
    "src/**/*",
    "src/**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build"
  ],
  "references": [
    { "path": "./tsconfig.node.json" }
  ]
}
```

### Shared Types Configuration

```jsonc
// shared-types/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "./dist",
    "rootDir": "./src",

    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Frontend Type Safety Patterns

### API Client with Full Type Safety

```typescript
// frontend/src/services/api-client.ts
import type {
  Agent,
  AgentWithRelations,
  CreateAgentDTO,
  UpdateAgentDTO,
  AgentQueryDTO,
  Skill,
  MCPServer,
  Task,
  StrapiResponse,
  StrapiData,
  StrapiAgentAttributes,
  ApiResponse,
} from '@types';

/**
 * Base API client configuration
 */
interface ApiClientConfig {
  strapiUrl: string;
  expressUrl: string;
  strapiToken?: string;
  timeout?: number;
}

/**
 * Fetch options with typed headers
 */
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * API client class with complete type safety
 */
export class ApiClient {
  private readonly config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetch<T>(
    url: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new ApiError(
          response.status,
          response.statusText,
          await response.json().catch(() => ({}))
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw this.handleError(error);
    }
  }

  /**
   * Strapi-specific fetch with auth token
   */
  private async fetchStrapi<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const headers: Record<string, string> = {};

    if (this.config.strapiToken) {
      headers['Authorization'] = `Bearer ${this.config.strapiToken}`;
    }

    return this.fetch<T>(`${this.config.strapiUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  }

  /**
   * Express-specific fetch
   */
  private async fetchExpress<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.fetch<ApiResponse<T>>(`${this.config.expressUrl}${endpoint}`, options);
  }

  // ===================== AGENTS =====================

  /**
   * List all agents with optional filtering
   */
  async listAgents(query?: AgentQueryDTO): Promise<Agent[]> {
    const params = new URLSearchParams();

    if (query?.populate) {
      params.append('populate', query.populate.join(','));
    }

    if (query?.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        params.append(`filters[${key}]`, String(value));
      });
    }

    const response = await this.fetchStrapi<StrapiResponse<StrapiAgentAttributes>>(
      `/agents?${params.toString()}`
    );

    return response.data.map(this.transformAgent);
  }

  /**
   * Get a single agent by ID
   */
  async getAgent(id: string, populate?: string[]): Promise<AgentWithRelations> {
    const params = new URLSearchParams();

    if (populate) {
      params.append('populate', populate.join(','));
    }

    const response = await this.fetchStrapi<StrapiData<StrapiAgentAttributes>>(
      `/agents/${id}?${params.toString()}`
    );

    if (!response.data) {
      throw new ApiError(404, 'Agent not found');
    }

    return this.transformAgent(response.data) as AgentWithRelations;
  }

  /**
   * Create a new agent
   */
  async createAgent(data: CreateAgentDTO): Promise<Agent> {
    const response = await this.fetchStrapi<StrapiData<StrapiAgentAttributes>>(
      '/agents',
      {
        method: 'POST',
        body: JSON.stringify({ data }),
      }
    );

    if (!response.data) {
      throw new ApiError(500, 'Failed to create agent');
    }

    return this.transformAgent(response.data);
  }

  /**
   * Update an existing agent
   */
  async updateAgent(id: string, data: UpdateAgentDTO): Promise<Agent> {
    const response = await this.fetchStrapi<StrapiData<StrapiAgentAttributes>>(
      `/agents/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ data }),
      }
    );

    if (!response.data) {
      throw new ApiError(500, 'Failed to update agent');
    }

    return this.transformAgent(response.data);
  }

  /**
   * Delete an agent
   */
  async deleteAgent(id: string): Promise<void> {
    await this.fetchStrapi(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Execute an agent (SSE streaming)
   */
  async executeAgent(
    id: string,
    message: string,
    callbacks: SSECallbacks
  ): Promise<void> {
    const response = await fetch(`${this.config.expressUrl}/execute/agent/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to execute agent');
    }

    if (!response.body) {
      throw new ApiError(500, 'No response body');
    }

    return this.handleSSEStream(response.body, callbacks);
  }

  // ===================== TRANSFORMERS =====================

  /**
   * Transform Strapi agent data to domain model
   */
  private transformAgent(data: StrapiAttributes<StrapiAgentAttributes>): Agent {
    const { id, attributes } = data;

    return {
      id: String(id),
      name: attributes.name,
      description: attributes.description,
      systemPrompt: attributes.systemPrompt,
      tools: attributes.tools,
      disallowedTools: attributes.disallowedTools,
      model: attributes.model,
      enabled: attributes.enabled,
      mcpServers: this.extractRelationIds(attributes.mcpServers),
      skills: this.extractRelationIds(attributes.skills),
      createdAt: new Date(attributes.createdAt),
      updatedAt: new Date(attributes.updatedAt),
    };
  }

  /**
   * Extract IDs from Strapi relations
   */
  private extractRelationIds<T>(
    relation: StrapiRelation<T> | undefined
  ): string[] {
    if (!relation?.data) return [];

    if (Array.isArray(relation.data)) {
      return relation.data.map(item => String(item.id));
    }

    return [String(relation.data.id)];
  }

  /**
   * Handle SSE stream
   */
  private async handleSSEStream(
    body: ReadableStream<Uint8Array>,
    callbacks: SSECallbacks
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            const event: SSEEvent = JSON.parse(data);

            this.handleSSEEvent(event, callbacks);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Handle individual SSE events
   */
  private handleSSEEvent(event: SSEEvent, callbacks: SSECallbacks): void {
    switch (event.type) {
      case SSEEventType.START:
        callbacks.onStart?.(event);
        break;
      case SSEEventType.TOKEN:
        callbacks.onToken?.(event);
        break;
      case SSEEventType.TOOL_USE:
        callbacks.onToolUse?.(event);
        break;
      case SSEEventType.TOOL_RESULT:
        callbacks.onToolResult?.(event);
        break;
      case SSEEventType.THINKING:
        callbacks.onThinking?.(event);
        break;
      case SSEEventType.PROGRESS:
        callbacks.onProgress?.(event);
        break;
      case SSEEventType.ERROR:
        callbacks.onError?.(event);
        break;
      case SSEEventType.COMPLETE:
        callbacks.onComplete?.(event);
        break;
    }
  }

  /**
   * Error handler
   */
  private handleError(error: unknown): Error {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new ApiError(408, 'Request timeout');
      }
      return new ApiError(500, error.message);
    }

    return new ApiError(500, 'Unknown error');
  }
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Create API client instance
 */
export const apiClient = new ApiClient({
  strapiUrl: import.meta.env.VITE_STRAPI_URL || 'http://localhost:1337/api',
  expressUrl: import.meta.env.VITE_EXPRESS_URL || 'http://localhost:3001/api',
  strapiToken: import.meta.env.VITE_STRAPI_TOKEN,
});
```

### React Hooks with Type Safety

```typescript
// frontend/src/hooks/useAgent.ts
import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@services/api-client';
import type { Agent, AgentWithRelations, CreateAgentDTO, UpdateAgentDTO } from '@types';

/**
 * Hook return type for agent operations
 */
interface UseAgentReturn {
  agent: AgentWithRelations | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
  update: (data: UpdateAgentDTO) => Promise<void>;
  delete: () => Promise<void>;
}

/**
 * Hook for managing a single agent
 */
export function useAgent(id: string): UseAgentReturn {
  const [agent, setAgent] = useState<AgentWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getAgent(id, ['skills', 'mcpServers']);
      setAgent(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(500, 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const updateAgent = useCallback(async (data: UpdateAgentDTO) => {
    try {
      setLoading(true);
      setError(null);
      const updated = await apiClient.updateAgent(id, data);
      setAgent(prev => prev ? { ...prev, ...updated } : null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(500, 'Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [id]);

  const deleteAgent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.deleteAgent(id);
      setAgent(null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(500, 'Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  return {
    agent,
    loading,
    error,
    refetch: fetchAgent,
    update: updateAgent,
    delete: deleteAgent,
  };
}

/**
 * Hook return type for agent list
 */
interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
  create: (data: CreateAgentDTO) => Promise<Agent>;
}

/**
 * Hook for managing agent list
 */
export function useAgents(): UseAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.listAgents();
      setAgents(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(500, 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (data: CreateAgentDTO): Promise<Agent> => {
    try {
      setLoading(true);
      setError(null);
      const newAgent = await apiClient.createAgent(data);
      setAgents(prev => [...prev, newAgent]);
      return newAgent;
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(500, 'Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    loading,
    error,
    refetch: fetchAgents,
    create: createAgent,
  };
}
```

### React Component Type Safety

```typescript
// frontend/src/components/AgentCard.tsx
import React from 'react';
import type { Agent, AgentWithRelations } from '@types';

/**
 * Component props with discriminated union for optional relations
 */
type AgentCardProps =
  | {
      agent: Agent;
      showRelations?: false;
      onEdit?: (agent: Agent) => void;
      onDelete?: (id: string) => void;
      onExecute?: (id: string) => void;
    }
  | {
      agent: AgentWithRelations;
      showRelations: true;
      onEdit?: (agent: AgentWithRelations) => void;
      onDelete?: (id: string) => void;
      onExecute?: (id: string) => void;
    };

/**
 * Type-safe agent card component
 */
export const AgentCard: React.FC<AgentCardProps> = (props) => {
  const { agent, showRelations, onEdit, onDelete, onExecute } = props;

  const handleEdit = () => {
    onEdit?.(agent);
  };

  const handleDelete = () => {
    onDelete?.(agent.id);
  };

  const handleExecute = () => {
    onExecute?.(agent.id);
  };

  return (
    <div className="agent-card">
      <h3>{agent.name}</h3>
      <p>{agent.description}</p>
      <div className="agent-meta">
        <span>Model: {agent.model}</span>
        <span>Tools: {agent.tools.length}</span>
        {showRelations && (
          <>
            <span>Skills: {agent.skills.length}</span>
            <span>MCP Servers: {agent.mcpServers.length}</span>
          </>
        )}
      </div>
      <div className="agent-actions">
        <button onClick={handleEdit}>Edit</button>
        <button onClick={handleDelete}>Delete</button>
        <button onClick={handleExecute}>Execute</button>
      </div>
    </div>
  );
};
```

---

## Type Guards & Validators

### Runtime Type Guards

```typescript
// types/type-guards.ts

/**
 * Type guard for checking if value is Agent
 */
export function isAgent(value: unknown): value is Agent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'systemPrompt' in value &&
    'tools' in value &&
    Array.isArray((value as Agent).tools)
  );
}

/**
 * Type guard for SSE events
 */
export function isSSEEvent(value: unknown): value is SSEEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'timestamp' in value &&
    'data' in value
  );
}

/**
 * Type guard for specific SSE event types
 */
export function isSSETokenEvent(event: SSEEvent): event is SSETokenEvent {
  return event.type === SSEEventType.TOKEN;
}

export function isSSECompleteEvent(event: SSEEvent): event is SSECompleteEvent {
  return event.type === SSEEventType.COMPLETE;
}

/**
 * Type guard for API errors
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Assertion function for non-null values
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is not defined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Type guard with exhaustiveness checking
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
```

### Zod Validators

```typescript
// services/validators.ts
import { z } from 'zod';
import type { CreateAgentDTO, ValidationResult } from '@types';
import { CreateAgentSchema } from '@types/validation.types';

/**
 * Generic validator factory
 */
export function createValidator<T>(schema: z.ZodSchema<T>): Validator<T> {
  return (data: unknown): ValidationResult<T> => {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return { success: false, errors: result.error };
  };
}

/**
 * Pre-built validators
 */
export const validateCreateAgent = createValidator(CreateAgentSchema);
export const validateUpdateAgent = createValidator(UpdateAgentSchema);

/**
 * Middleware-compatible validator
 */
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>
): Middleware {
  return async (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.flatten(),
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
```

---

## Advanced Type Patterns

### Conditional Types

```typescript
// types/advanced.types.ts

/**
 * Extract relation type from entity
 */
type WithRelations<T, R extends keyof T> = Omit<T, R> & {
  [K in R]: T[K] extends string[]
    ? Array<Extract<Agent | Skill | MCPServer, { id: string }>>
    : never;
};

/**
 * Make specific fields required
 */
type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific fields optional
 */
type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Deep partial type
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep readonly type
 */
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extract promise type
 */
type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Function return type extractor
 */
type ReturnTypeAsync<T extends (...args: any) => any> = Awaited<ReturnType<T>>;
```

### Branded Types

```typescript
// types/branded.types.ts

/**
 * Brand type for nominal typing
 */
type Brand<T, TBrand> = T & { __brand: TBrand };

/**
 * Branded string types for IDs
 */
export type AgentId = Brand<string, 'AgentId'>;
export type SkillId = Brand<string, 'SkillId'>;
export type MCPServerId = Brand<string, 'MCPServerId'>;
export type TaskId = Brand<string, 'TaskId'>;

/**
 * Create branded ID
 */
export function createAgentId(id: string): AgentId {
  return id as AgentId;
}

export function createSkillId(id: string): SkillId {
  return id as SkillId;
}

/**
 * Type-safe ID usage prevents mixing different ID types
 */
function getAgent(id: AgentId): Promise<Agent> {
  // Implementation
  return Promise.resolve({} as Agent);
}

// This works:
const agentId = createAgentId('123');
getAgent(agentId);

// This would cause a compile error:
// const skillId = createSkillId('456');
// getAgent(skillId); // ERROR: Type 'SkillId' is not assignable to type 'AgentId'
```

---

## Testing Types

### Test Utilities

```typescript
// tests/test-utils.types.ts

/**
 * Mock type generator
 */
export type MockType<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? jest.Mock<R, A>
    : T[K];
};

/**
 * Factory function type for test data
 */
export type Factory<T> = (overrides?: Partial<T>) => T;

/**
 * Create mock agent factory
 */
export const createMockAgent: Factory<Agent> = (overrides = {}) => ({
  id: '1',
  name: 'test-agent',
  description: 'Test agent description',
  systemPrompt: 'You are a test agent',
  tools: ['Read', 'Write'],
  disallowedTools: [],
  model: 'sonnet',
  enabled: true,
  mcpServers: [],
  skills: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Type-safe mock API client
 */
export const createMockApiClient = (): MockType<ApiClient> => ({
  listAgents: jest.fn(),
  getAgent: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  executeAgent: jest.fn(),
  // ... other methods
} as any);
```

---

## Conclusion

This comprehensive TypeScript type system provides:

✅ **Complete type coverage** from database to UI
✅ **Strapi integration** with proper response transformation
✅ **DTO patterns** using advanced utility types
✅ **SSE streaming** with full type safety
✅ **Runtime validation** with Zod integration
✅ **Frontend safety** with React hooks and components
✅ **Testing support** with factory functions and mocks

The type system ensures compile-time safety while maintaining runtime validation, making the hybrid architecture robust and maintainable.

---

**Author:** Claude Agent
**Version:** 1.0
**Last Updated:** 2025-01-31
