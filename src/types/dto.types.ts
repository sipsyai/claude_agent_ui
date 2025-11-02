/**
 * Claude Agent UI - DTO (Data Transfer Object) Types
 *
 * This file contains DTO patterns for API requests and responses,
 * including utility types for creating, updating, and querying entities.
 */

import type { Agent, Skill, MCPServer, Task, ToolName, ClaudeModel, MCPTransport, SkillCategory, MCPRestartPolicy } from './agent.types';

/**
 * Generic utility type for creating entities (excludes auto-generated fields)
 */
export type CreateDTO<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Generic utility type for updating entities (all fields optional)
 */
export type UpdateDTO<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Generic utility type for partial updates (specific fields only)
 */
export type PatchDTO<T, K extends keyof T> = Pick<Partial<T>, K>;

/**
 * Response DTO that includes computed fields
 */
export type ResponseDTO<T, TComputed = {}> = T & TComputed;

/**
 * Filter operators for queries
 */
export type FilterOperators<T> = {
  $eq?: T;
  $ne?: T;
  $in?: T[];
  $nin?: T[];
  $lt?: T;
  $lte?: T;
  $gt?: T;
  $gte?: T;
  $contains?: T extends string ? T : never;
  $startsWith?: T extends string ? T : never;
  $endsWith?: T extends string ? T : never;
  $null?: boolean;
  $notNull?: boolean;
};

/**
 * Generic filter type for queries
 */
export type FilterDTO<T> = {
  [K in keyof T]?: T[K] | FilterOperators<T[K]>;
} & {
  $and?: FilterDTO<T>[];
  $or?: FilterDTO<T>[];
  $not?: FilterDTO<T>;
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
  fields?: string[];
}

// ============= AGENT DTOs =============

/**
 * DTO for creating a new agent
 */
export interface CreateAgentDTO {
  name: string;
  systemPrompt: string;
  description?: string;
  tools?: ToolName[];
  disallowedTools?: ToolName[];
  model?: ClaudeModel;
  enabled?: boolean;
  metadata?: Record<string, any>;
  mcpServers?: string[];
  skills?: string[];
}

/**
 * DTO for updating an existing agent
 */
export type UpdateAgentDTO = Partial<CreateAgentDTO>;

/**
 * DTO for partial agent updates
 */
export type PatchAgentDTO =
  | PatchDTO<Agent, 'name'>
  | PatchDTO<Agent, 'systemPrompt'>
  | PatchDTO<Agent, 'enabled'>
  | PatchDTO<Agent, 'toolConfig'>
  | PatchDTO<Agent, 'modelConfig'>;

/**
 * Agent response with computed fields
 */
export interface AgentResponseDTO extends Agent {
  /** Number of associated skills */
  skillCount?: number;

  /** Number of associated MCP servers */
  mcpServerCount?: number;

  /** Number of tasks executed */
  taskCount?: number;
}

/**
 * Agent list query parameters
 */
export interface AgentQueryDTO extends QueryDTO<Agent> {
  filters?: FilterDTO<Agent> & {
    search?: string; // Full-text search across name and description
  };
}

// ============= SKILL DTOs =============

/**
 * DTO for creating a new skill
 */
export interface CreateSkillDTO {
  name: string;
  displayName: string;
  description: string;
  skillmd: string;
  allowedTools?: ToolName[];
  experienceScore?: number;
  category?: SkillCategory;
  isPublic?: boolean;
  version?: string;
}

/**
 * DTO for updating an existing skill
 */
export type UpdateSkillDTO = Partial<CreateSkillDTO>;

/**
 * Skill response with computed fields
 */
export interface SkillResponseDTO extends Skill {
  /** Number of agents using this skill */
  agentCount?: number;
}

/**
 * Skill list query parameters
 */
export interface SkillQueryDTO extends QueryDTO<Skill> {
  filters?: FilterDTO<Skill> & {
    search?: string;
    category?: SkillCategory;
  };
}

// ============= MCP SERVER DTOs =============

/**
 * DTO for creating a new MCP server
 */
export interface CreateMCPServerDTO {
  name: string;
  command: string;
  description?: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  transport?: MCPTransport;
  healthCheckUrl?: string;
  startupTimeout?: number;
  restartPolicy?: MCPRestartPolicy;
}

/**
 * DTO for updating an existing MCP server
 */
export type UpdateMCPServerDTO = Partial<CreateMCPServerDTO>;

/**
 * MCP server response with computed fields
 */
export interface MCPServerResponseDTO extends MCPServer {
  /** Number of agents using this server */
  agentCount?: number;

  /** Runtime status information */
  runtimeStatus?: {
    isRunning: boolean;
    pid?: number;
    uptime?: number;
    lastError?: string;
  };
}

/**
 * MCP server list query parameters
 */
export interface MCPServerQueryDTO extends QueryDTO<MCPServer> {
  filters?: FilterDTO<MCPServer> & {
    search?: string;
    transport?: MCPTransport;
    disabled?: boolean;
    healthy?: boolean;
  };
}

// ============= TASK DTOs =============

/**
 * DTO for creating a new task
 */
export interface CreateTaskDTO {
  agentId: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * DTO for updating an existing task
 */
export interface UpdateTaskDTO {
  status?: Task['status'];
  result?: any;
  error?: string;
  completedAt?: Date;
  executionTime?: number;
  tokensUsed?: number;
  cost?: number;
  metadata?: Record<string, any>;
  executionLog?: any[]; // Array of SDK events for displaying in UI
}

/**
 * Task response with computed fields
 */
export interface TaskResponseDTO extends Task {
  /** Agent information */
  agentName?: string;
  agentModel?: ClaudeModel;
}

/**
 * Task list query parameters
 */
export interface TaskQueryDTO extends QueryDTO<Task> {
  filters?: FilterDTO<Task> & {
    agentId?: string;
    status?: Task['status'];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
}

// ============= EXECUTION DTOs =============

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
  cost: number;
}

// ============= MCP SERVER ACTIONS =============

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

// ============= VALIDATION DTOs =============

/**
 * Generic validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validator function type
 */
export type Validator<T> = (data: unknown) => ValidationResult<T>;

// ============= API RESPONSE WRAPPERS =============

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
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
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
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
}
