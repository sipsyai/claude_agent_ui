/**
 * Claude Agent UI - Strapi Component Types
 *
 * This file contains TypeScript interfaces for all Strapi components used in the backend.
 * These components are reusable structures that can be embedded in content types.
 *
 * @see backend/src/components/* for Strapi component definitions
 */

import type { ClaudeModel, ToolName, MCPServer, MCPTool, Agent, Skill, Task } from './agent.types';

/**
 * Tool Configuration Component
 * @component agent.tool-configuration
 *
 * Defines which tools an agent or skill can use, with permission overrides.
 */
export interface ToolConfiguration {
  /** Array of allowed tool names */
  allowedTools: ToolName[];

  /** Array of explicitly disallowed tool names */
  disallowedTools: ToolName[];

  /** Tool-specific permissions and restrictions */
  toolPermissions: Record<string, any>;

  /** Whether to inherit tool configuration from parent */
  inheritFromParent: boolean;
}

/**
 * Model Configuration Component
 * @component agent.model-configuration
 *
 * AI model settings and parameters for agents and skills.
 */
export interface ModelConfiguration {
  /** Claude model to use */
  model: ClaudeModel;

  /** Sampling temperature (0.0-1.0) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Stop sequences to halt generation */
  stopSequences?: string[];

  /** Top-p sampling parameter (0.0-1.0) */
  topP?: number;

  /** Top-k sampling parameter */
  topK?: number;
}

/**
 * Analytics Component
 * @component agent.analytics
 *
 * Execution metrics and statistics for agents and skills.
 */
export interface Analytics {
  /** Total number of executions */
  executionCount: number;

  /** Last execution timestamp */
  lastExecutedAt?: Date;

  /** Average execution time in milliseconds */
  averageExecutionTime: number;

  /** Total execution time in milliseconds (biginteger) */
  totalExecutionTime: string;

  /** Number of successful executions */
  successCount: number;

  /** Number of failed executions */
  failureCount: number;

  /** Success rate percentage (0-100) */
  successRate: number;

  /** When analytics were last calculated */
  lastCalculatedAt?: Date;
}

/**
 * MCP Server Selection Component
 * @component mcp.server-selection
 *
 * Selects an MCP server with optional configuration overrides.
 * Used in agents and skills to reference MCP servers.
 */
export interface MCPServerSelection {
  /** Component ID */
  id: number;

  /** Selected MCP server (can be populated object or ID string) */
  mcpServer: MCPServer | string;

  /** Whether this server is enabled */
  enabled: boolean;

  /** Override server command arguments (null = use defaults) */
  customArgs?: string[] | null;

  /** Override server environment variables (null = use defaults) */
  customEnv?: Record<string, string> | null;

  /** Override server startup timeout (null = use default) */
  customStartupTimeout?: number;

  /** Selected tools from this server */
  selectedTools?: MCPToolSelection[];

  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * MCP Tool Selection Component
 * @component mcp.tool-selection
 *
 * Selects specific tools from an MCP server with custom permissions.
 */
export interface MCPToolSelection {
  /** Component ID */
  id: number;

  /** Selected MCP tool (can be populated object or ID string) */
  mcpTool: MCPTool | string;

  /** Whether this tool is enabled */
  enabled: boolean;

  /** Tool-specific permissions and restrictions */
  permissions: Record<string, any>;

  /** Custom configuration overrides for this tool */
  customConfig: Record<string, any>;
}

/**
 * Skill Selection Component
 * @component skill.skill-selection
 *
 * Selects a skill with enabled flag and metadata.
 * Used in agents to reference skills.
 */
export interface SkillSelection {
  /** Component ID */
  id: number;

  /** Selected skill (can be populated object or ID string) */
  skill: Skill | string;

  /** Whether this skill is enabled */
  enabled: boolean;

  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Training Session Component
 * @component skill.training-session
 *
 * Records a training session with scores, issues, and improvements.
 */
export interface TrainingSession {
  /** Component ID */
  id: number;

  /** When the training session occurred */
  timestamp: Date;

  /** Training performance score (0-100) */
  score?: number;

  /** Type of training session */
  trainingType: 'automatic' | 'manual' | 'feedback' | 'evaluation';

  /** Issues identified during training */
  issues: any[];

  /** Improvements made during training */
  improvements: any[];

  /** Additional notes about the training session */
  notes?: string;

  /** Who or what performed the training (agent ID, user ID, etc.) */
  trainedBy?: string;

  /** Whether the training session was successful */
  success: boolean;
}

/**
 * Skill File Component
 * @component skill.skill-file
 *
 * Additional documentation files for skills (REFERENCE.md, EXAMPLES.md, etc.).
 */
export interface SkillFile {
  /** Component ID */
  id: number;

  /** Uploaded file (Strapi media object) */
  file: any;

  /** Type/purpose of the documentation file */
  fileType:
    | 'REFERENCE'
    | 'EXAMPLES'
    | 'TROUBLESHOOTING'
    | 'CHANGELOG'
    | 'FAQ'
    | 'API_DOCS'
    | 'TUTORIAL'
    | 'CUSTOM';

  /** Brief description of what this file contains */
  description?: string;

  /** Order for displaying files in UI (0 = first) */
  displayOrder: number;
}

/**
 * Task Selection Component
 * @component task.task-selection
 *
 * Selects a task with enabled flag and metadata.
 * Used in agents and skills to reference tasks.
 */
export interface TaskSelection {
  /** Component ID */
  id: number;

  /** Selected task (can be populated object or ID string) */
  task: Task | string;

  /** Whether this task is enabled */
  enabled: boolean;

  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Agent Selection Component
 * @component agent.agent-selection
 *
 * Selects an agent with enabled flag and metadata.
 * Used in skills to reference agents that use them.
 */
export interface AgentSelection {
  /** Component ID */
  id: number;

  /** Selected agent (can be populated object or ID string) */
  agent: Agent | string;

  /** Whether this agent is enabled */
  enabled: boolean;

  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Metadata Entry Component
 * @component shared.metadata
 *
 * Key-value metadata pairs for flexible data storage.
 */
export interface MetadataEntry {
  /** Component ID */
  id: number;

  /** Metadata key (unique identifier) */
  key: string;

  /** Metadata value */
  value?: string;

  /** Type of the value */
  type: 'string' | 'number' | 'boolean' | 'json' | 'date';

  /** Description of what this metadata represents */
  description?: string;
}

/**
 * Input Field Component
 * @component skill.input-field
 *
 * Dynamic form field definition for skill execution.
 * Allows skills to define custom input fields that users fill when executing the skill.
 */
export interface InputFieldComponent {
  /** Component ID */
  id: number;

  /** Field name (used as identifier) */
  name: string;

  /** Input field type */
  type: 'text' | 'textarea' | 'dropdown' | 'multiselect' | 'checkbox' | 'number' | 'filepath';

  /** Display label for the field */
  label: string;

  /** Help text or description for the field */
  description?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Whether this field is required */
  required: boolean;

  /** Options array for dropdown/multiselect types */
  options?: string[];

  /** Default value for the field */
  default?: any;
}
