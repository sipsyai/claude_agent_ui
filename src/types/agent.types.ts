/**
 * Claude Agent UI - Core Domain Types
 *
 * This file contains all core domain entity types for the application.
 */

import type {
  ToolConfiguration,
  ModelConfiguration,
  Analytics,
  MCPServerSelection,
  SkillSelection,
  TaskSelection,
  MetadataEntry,
  AgentSelection,
  TrainingSession,
  SkillFile,
  InputFieldComponent,
} from './strapi-components.types';

/**
 * Claude model options available for agents
 */
export type ClaudeModel =
  | 'haiku'
  | 'sonnet'
  | 'sonnet-4'
  | 'opus'
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
  | 'KillShell'
  | 'AskUserQuestion';

/**
 * Core Agent interface representing a Claude agent configuration
 */
export interface Agent {
  /** Unique identifier (documentId from Strapi) */
  id: string;

  /** Human-readable agent name (unique) */
  name: string;

  /** URL-friendly slug (auto-generated from name) */
  slug: string;

  /** Optional description of agent's purpose */
  description?: string;

  /** System prompt that defines agent behavior */
  systemPrompt: string;

  /** Whether the agent is currently enabled */
  enabled: boolean;

  /** Tool configuration (allowed/disallowed tools and permissions) */
  toolConfig?: ToolConfiguration;

  /** Model configuration (model, temperature, maxTokens, etc.) */
  modelConfig: ModelConfiguration;

  /** Execution analytics and statistics */
  analytics?: Analytics;

  /** Key-value metadata pairs */
  metadata?: MetadataEntry[];

  /** MCP server selections with configuration overrides */
  mcpConfig?: MCPServerSelection[];

  /** Skill selections with enabled flags */
  skillSelection?: SkillSelection[];

  /** Task selections */
  tasks?: TaskSelection[];

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Agent with populated relations (used when fetching with relations)
 *
 * Note: Relations are now handled via component selections (mcpConfig, skillSelection, tasks)
 * which can contain either IDs or populated objects.
 */
export interface AgentWithRelations extends Agent {
  // Relations are already handled via component selections
  // mcpConfig contains populated MCPServer objects
  // skillSelection contains populated Skill objects
  // tasks contains populated Task objects
}

/**
 * Skill category enumeration
 */
export type SkillCategory =
  | 'general-purpose'
  | 'code-analysis'
  | 'data-processing'
  | 'web-scraping'
  | 'file-manipulation'
  | 'api-integration'
  | 'browser-automation'
  | 'testing'
  | 'custom';

/**
 * Skill interface representing a reusable agent capability
 */
export interface Skill {
  /** Unique identifier (documentId from Strapi) */
  id: string;

  /** Unique skill name (kebab-case, uid field) */
  name: string;

  /** Display name for UI */
  displayName: string;

  /** Description of what the skill does */
  description: string;

  /** Skill markdown content with instructions */
  skillmd: string;

  /** Configuration text added at top of system prompt, above skillmd */
  skillConfig?: string;

  /** Experience score (0-100) for skill effectiveness */
  experienceScore: number;

  /** Skill category */
  category: SkillCategory;

  /** Whether the skill is publicly available */
  isPublic: boolean;

  /** Semantic version of the skill (format: x.y.z) */
  version: string;

  /** License information (e.g., MIT, Apache-2.0) */
  license?: string;

  /** Training history records */
  trainingHistory?: TrainingSession[];

  /** Additional documentation files (REFERENCE.md, EXAMPLES.md, etc.) */
  additionalFiles?: SkillFile[];

  /** Agent selections that use this skill */
  agentSelection?: AgentSelection[];

  /** Tool configuration (allowed/disallowed tools and permissions) */
  toolConfig?: ToolConfiguration;

  /** Model configuration (model, temperature, maxTokens, etc.) */
  modelConfig?: ModelConfiguration;

  /** Execution analytics and statistics */
  analytics?: Analytics;

  /** MCP server selections with configuration overrides */
  mcpConfig?: MCPServerSelection[];

  /** Task selections */
  tasks?: TaskSelection[];

  /** Dynamic input fields for skill execution */
  inputFields?: InputFieldComponent[];

  /** Training agent reference (oneToMany relation) */
  trainingAgent?: Agent | string;

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Skill with populated agent relations
 *
 * Note: Relations are now handled via component selections (agentSelection)
 * which can contain either IDs or populated objects.
 */
export interface SkillWithRelations extends Skill {
  // Relations are already handled via component selections
  // agentSelection contains populated Agent objects
}

/**
 * MCP transport protocol type
 */
export type MCPTransport = 'stdio' | 'sse' | 'http';

/**
 * MCP restart policy
 */
export type MCPRestartPolicy = 'always' | 'on-failure' | 'never';

/**
 * MCP Tool definition (Strapi entity)
 */
export interface MCPTool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  mcpServer?: string; // Server ID
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * MCP Server configuration
 */
export interface MCPServer {
  /** Unique identifier (documentId from Strapi) */
  id: string;

  /** Unique server name */
  name: string;

  /** Optional description */
  description?: string;

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

  /** Health check configuration */
  healthCheckUrl?: string;
  isHealthy: boolean;
  lastHealthCheck?: Date;

  /** Lifecycle configuration */
  startupTimeout: number;
  restartPolicy: MCPRestartPolicy;

  /** MCP Tools provided by this server (relational field) */
  mcpTools?: MCPTool[];
  toolsFetchedAt?: Date | string;

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

/**
 * Task status enumeration
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Task type enumeration
 * - 'skill': Single skill execution (forced) - user pre-selects specific skill
 * - 'agent': Multi-skill agent (autonomous) - Claude chooses best skill
 */
export type TaskType = 'skill' | 'agent';

/**
 * Execution mode enumeration
 * - 'forced': Execute ONLY the pre-selected skill (no other skills visible)
 * - 'autonomous': Claude scans available skills and chooses the best one
 */
export type ExecutionMode = 'forced' | 'autonomous';

/**
 * Skill execution metadata for forced execution mode
 */
export interface SkillExecutionMetadata {
  /** Selected skill ID */
  selectedSkillId: string;

  /** Selected skill name */
  selectedSkillName: string;

  /** Source of skill (strapi, filesystem, etc.) */
  source: string;

  /** Isolation level */
  isolationLevel: 'full' | 'partial' | 'none';

  /** System prompt source */
  systemPromptSource: 'skill.content' | 'agent.systemPrompt';

  /** Whether other skills are accessible */
  otherSkillsAccessible: boolean;
}

/**
 * Task interface for tracking agent executions
 */
export interface Task {
  /** Unique identifier (documentId from Strapi) */
  id: string;

  /** Agent ID that executed this task */
  agentId: string;

  /** Agent name (populated from relation) */
  agentName?: string;

  /** Task name */
  name?: string;

  /** Task description */
  description?: string;

  /** User input/prompt */
  message: string;

  /** Task type (skill or agent) */
  taskType?: TaskType;

  /** Execution mode (forced or autonomous) */
  executionMode?: ExecutionMode;

  /** Current task status */
  status: TaskStatus;

  /** Execution result */
  result?: any;

  /** Error message if failed */
  error?: string;

  /** Execution timing */
  startedAt?: Date;
  completedAt?: Date;
  executionTime?: number;

  /** Usage metrics */
  tokensUsed: number;
  cost: number;

  /** Additional metadata (tool calls, etc.) */
  metadata?: Record<string, any>;

  /** Execution log (SDK events for debugging/viewing) */
  executionLog?: any[];

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Task with populated agent relation
 */
export interface TaskWithAgent extends Omit<Task, 'agentId'> {
  agent: Agent;
}
