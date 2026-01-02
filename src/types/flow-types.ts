/**
 * Claude Agent UI - Flow Domain Types
 *
 * This file contains all flow-related domain entity types for the workflow system.
 * Flows orchestrate agents and skills into reusable, schedulable processes.
 *
 * @see backend/src/api/flow/content-types/flow/schema.json for Strapi schema
 * @see backend/src/api/flow-execution/content-types/flow-execution/schema.json
 * @see backend/src/components/flow/* for node component definitions
 */

import type { Agent, ClaudeModel } from './agent.types';

// =============================================================================
// FLOW STATUS & CATEGORY ENUMS
// =============================================================================

/**
 * Flow lifecycle status
 */
export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived';

/**
 * Flow category for organization and filtering
 */
export type FlowCategory =
  | 'web-scraping'
  | 'data-processing'
  | 'api-integration'
  | 'file-manipulation'
  | 'automation'
  | 'custom';

/**
 * Flow execution status
 */
export type FlowExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * How the flow execution was triggered
 */
export type FlowTriggerType = 'manual' | 'schedule' | 'webhook' | 'api';

/**
 * Output delivery type
 */
export type FlowOutputType = 'response' | 'file' | 'database' | 'webhook' | 'email';

/**
 * Output format type
 */
export type FlowOutputFormat = 'json' | 'markdown' | 'text' | 'html' | 'csv' | 'zip';

/**
 * Model override options for agent nodes
 */
export type FlowModelOverride = 'default' | ClaudeModel;

/**
 * Node type discriminator
 */
export type FlowNodeType = 'input' | 'agent' | 'output';

// =============================================================================
// INPUT FIELD TYPES
// =============================================================================

/**
 * Input field type for flow input nodes
 */
export type InputFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'url'
  | 'email'
  | 'file'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'date'
  | 'datetime';

/**
 * Input field definition for flow input nodes
 */
export interface FlowInputField {
  /** Unique field name (used as identifier) */
  name: string;

  /** Field type */
  type: InputFieldType;

  /** Display label */
  label: string;

  /** Whether the field is required */
  required: boolean;

  /** Help text or description */
  description?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Default value */
  defaultValue?: any;

  /** Options for select/multiselect types */
  options?: string[];

  /** Validation pattern (regex) */
  pattern?: string;

  /** Minimum value (for number) or length (for text) */
  min?: number;

  /** Maximum value (for number) or length (for text) */
  max?: number;
}

// =============================================================================
// NODE POSITION
// =============================================================================

/**
 * UI position coordinates for node rendering
 */
export interface NodePosition {
  x: number;
  y: number;
}

// =============================================================================
// BASE NODE INTERFACE
// =============================================================================

/**
 * Base interface for all flow nodes
 */
export interface FlowNodeBase {
  /** Unique identifier for this node within the flow */
  nodeId: string;

  /** Node type discriminator */
  type: FlowNodeType;

  /** Display name for this node */
  name: string;

  /** Description of what this node does */
  description?: string;

  /** UI position coordinates */
  position: NodePosition;

  /** ID of the next node in the flow sequence (null for terminal nodes) */
  nextNodeId?: string | null;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

// =============================================================================
// INPUT NODE
// =============================================================================

/**
 * Input node for defining flow inputs
 */
export interface InputNode extends FlowNodeBase {
  type: 'input';

  /** Array of input field definitions */
  inputFields: FlowInputField[];

  /** Custom validation rules */
  validationRules?: Record<string, any>;
}

// =============================================================================
// AGENT NODE
// =============================================================================

/**
 * Agent node for executing an agent with configured skills
 */
export interface AgentNode extends FlowNodeBase {
  type: 'agent';

  /** Agent ID to execute */
  agentId: string;

  /** Populated agent object (when fetched with relations) */
  agent?: Agent;

  /** Prompt template with variable interpolation support ({{variableName}}) */
  promptTemplate: string;

  /** Array of skill IDs to enable for this agent execution */
  skills: string[];

  /** Override the agent's default model */
  modelOverride: FlowModelOverride;

  /** Maximum tokens for the agent response */
  maxTokens?: number;

  /** Timeout in milliseconds for agent execution */
  timeout: number;

  /** Whether to retry on error */
  retryOnError: boolean;

  /** Maximum number of retries on error */
  maxRetries: number;
}

// =============================================================================
// OUTPUT NODE
// =============================================================================

/**
 * Output node for defining how results are delivered
 */
export interface OutputNode extends FlowNodeBase {
  type: 'output';

  /** How to deliver the output */
  outputType: FlowOutputType;

  /** Output format for the result */
  format: FlowOutputFormat;

  /** Whether to save output to a file */
  saveToFile: boolean;

  /** File path template for saving output (supports {{variableName}}) */
  filePath?: string;

  /** File name template for saving output */
  fileName?: string;

  /** Whether to include execution metadata in output */
  includeMetadata: boolean;

  /** Whether to include timestamp in output */
  includeTimestamp: boolean;

  /** Optional template for transforming the final output */
  transformTemplate?: string;

  /** Webhook URL for outputType=webhook */
  webhookUrl?: string;

  /** Headers to send with webhook request */
  webhookHeaders?: Record<string, string>;
}

// =============================================================================
// FLOW NODE UNION TYPE
// =============================================================================

/**
 * Union type for all flow node types
 */
export type FlowNode = InputNode | AgentNode | OutputNode;

// =============================================================================
// FLOW DEFINITION
// =============================================================================

/**
 * Input schema definition for flow validation
 */
export interface FlowInputSchema {
  /** JSON Schema properties */
  properties: Record<string, {
    type: string;
    description?: string;
    default?: any;
    enum?: any[];
  }>;

  /** Required field names */
  required?: string[];
}

/**
 * Output schema definition for flow results
 */
export interface FlowOutputSchema {
  /** JSON Schema properties */
  properties: Record<string, {
    type: string;
    description?: string;
  }>;
}

/**
 * Core Flow interface representing a workflow definition
 */
export interface Flow {
  /** Unique identifier (documentId from Strapi) */
  id: string;

  /** Human-readable flow name (unique) */
  name: string;

  /** URL-friendly slug (auto-generated from name) */
  slug: string;

  /** Description of what this flow does */
  description?: string;

  /** Array of flow nodes defining the workflow */
  nodes: FlowNode[];

  /** Flow lifecycle status */
  status: FlowStatus;

  /** Schema defining expected input fields */
  inputSchema: FlowInputSchema;

  /** Schema defining expected output structure */
  outputSchema: FlowOutputSchema;

  /** Whether the flow is currently active and executable */
  isActive: boolean;

  /** Semantic version (format: x.y.z) */
  version: string;

  /** Flow category for organization */
  category: FlowCategory;

  /** Additional metadata */
  metadata?: Record<string, any>;

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

// =============================================================================
// FLOW EXECUTION LOG
// =============================================================================

/**
 * Log level for execution logs
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Execution log entry
 */
export interface FlowExecutionLog {
  /** Timestamp of the log entry */
  timestamp: Date;

  /** Log level */
  level: LogLevel;

  /** Log message */
  message: string;

  /** Node ID that generated this log (optional) */
  nodeId?: string;

  /** Additional context data */
  data?: Record<string, any>;
}

// =============================================================================
// NODE EXECUTION STATE
// =============================================================================

/**
 * Status of individual node execution
 */
export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Tracks execution state of a single node
 */
export interface NodeExecution {
  /** Node ID */
  nodeId: string;

  /** Node type */
  nodeType: FlowNodeType;

  /** Current status */
  status: NodeExecutionStatus;

  /** When node execution started */
  startedAt?: Date;

  /** When node execution completed */
  completedAt?: Date;

  /** Execution time in milliseconds */
  executionTime?: number;

  /** Input data for this node */
  input?: Record<string, any>;

  /** Output data from this node */
  output?: Record<string, any>;

  /** Error message if failed */
  error?: string;

  /** Error details if failed */
  errorDetails?: Record<string, any>;

  /** Tokens used (for agent nodes) */
  tokensUsed?: number;

  /** Cost (for agent nodes) */
  cost?: number;

  /** Retry count */
  retryCount?: number;
}

// =============================================================================
// FLOW EXECUTION
// =============================================================================

/**
 * Flow execution record tracking a single run of a flow
 */
export interface FlowExecution {
  /** Unique identifier (documentId from Strapi) */
  id: string;

  /** Flow ID that was executed */
  flowId: string;

  /** Populated flow object (when fetched with relations) */
  flow?: Flow;

  /** Current execution status */
  status: FlowExecutionStatus;

  /** Input data provided to start the execution */
  input?: Record<string, any>;

  /** Final output data from the execution */
  output?: Record<string, any>;

  /** Array of log entries */
  logs: FlowExecutionLog[];

  /** Error message if failed */
  error?: string;

  /** Detailed error information */
  errorDetails?: Record<string, any>;

  /** When execution started */
  startedAt?: Date;

  /** When execution completed (success or failure) */
  completedAt?: Date;

  /** Total execution time in milliseconds */
  executionTime?: number;

  /** Array tracking each node's execution state */
  nodeExecutions: NodeExecution[];

  /** ID of the currently executing node */
  currentNodeId?: string;

  /** Total tokens consumed during execution */
  tokensUsed: number;

  /** Estimated cost of the execution */
  cost: number;

  /** How the execution was triggered */
  triggeredBy: FlowTriggerType;

  /** Additional trigger context (webhook payload, schedule info, etc.) */
  triggerData?: Record<string, any>;

  /** Number of retry attempts made */
  retryCount: number;

  /** Reference to parent execution if this is a retry */
  parentExecutionId?: string;

  /** Additional metadata */
  metadata?: Record<string, any>;

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Runtime context passed through node execution chain
 */
export interface FlowExecutionContext {
  /** Current execution record */
  execution: FlowExecution;

  /** Flow definition being executed */
  flow: Flow;

  /** Accumulated data from all previous nodes */
  data: Record<string, any>;

  /** Original input data */
  input: Record<string, any>;

  /** Variable registry for template interpolation */
  variables: Record<string, any>;

  /** Execution start timestamp */
  startTime: Date;

  /** Logger function for adding execution logs */
  log: (level: LogLevel, message: string, nodeId?: string, data?: Record<string, any>) => void;

  /** Flag to signal execution cancellation */
  isCancelled: boolean;

  /** Callback for SSE updates */
  onUpdate?: (update: FlowExecutionUpdate) => void;
}

// =============================================================================
// EXECUTION RESULT
// =============================================================================

/**
 * Result returned by individual node handlers
 */
export interface NodeExecutionResult {
  /** Whether the node execution was successful */
  success: boolean;

  /** Output data from the node */
  output?: Record<string, any>;

  /** Error message if failed */
  error?: string;

  /** Error details if failed */
  errorDetails?: Record<string, any>;

  /** Updated data to merge into context */
  data?: Record<string, any>;

  /** Tokens used (for agent nodes) */
  tokensUsed?: number;

  /** Cost (for agent nodes) */
  cost?: number;

  /** Whether to continue to next node (default: true) */
  continueExecution?: boolean;
}

/**
 * Final result of a complete flow execution
 */
export interface FlowExecutionResult {
  /** Execution ID */
  executionId: string;

  /** Whether the execution was successful */
  success: boolean;

  /** Final status */
  status: FlowExecutionStatus;

  /** Final output data */
  output?: Record<string, any>;

  /** Error message if failed */
  error?: string;

  /** Error details if failed */
  errorDetails?: Record<string, any>;

  /** Total execution time in milliseconds */
  executionTime: number;

  /** Total tokens consumed */
  tokensUsed: number;

  /** Total cost */
  cost: number;

  /** Node execution summaries */
  nodeExecutions: NodeExecution[];
}

// =============================================================================
// SSE UPDATE EVENTS
// =============================================================================

/**
 * Update type for SSE streaming
 */
export type FlowExecutionUpdateType =
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_cancelled'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'log';

/**
 * SSE update event for real-time execution monitoring
 */
export interface FlowExecutionUpdate {
  /** Update type */
  type: FlowExecutionUpdateType;

  /** Execution ID */
  executionId: string;

  /** Timestamp */
  timestamp: Date;

  /** Node ID (for node-specific updates) */
  nodeId?: string;

  /** Node type (for node-specific updates) */
  nodeType?: FlowNodeType;

  /** Update data */
  data?: {
    status?: FlowExecutionStatus | NodeExecutionStatus;
    output?: Record<string, any>;
    error?: string;
    log?: FlowExecutionLog;
    tokensUsed?: number;
    cost?: number;
    executionTime?: number;
  };
}

// =============================================================================
// FLOW EXECUTION REQUEST
// =============================================================================

/**
 * Request to start a flow execution
 */
export interface StartFlowExecutionRequest {
  /** Flow ID to execute */
  flowId: string;

  /** Input data matching flow's input schema */
  input: Record<string, any>;

  /** How the execution was triggered (default: 'manual') */
  triggeredBy?: FlowTriggerType;

  /** Additional trigger data */
  triggerData?: Record<string, any>;

  /** Whether to wait for completion (default: false for SSE streaming) */
  waitForCompletion?: boolean;
}

/**
 * Response from starting a flow execution
 */
export interface StartFlowExecutionResponse {
  /** Execution ID */
  executionId: string;

  /** SSE stream URL for real-time updates */
  streamUrl?: string;

  /** Execution status */
  status: FlowExecutionStatus;

  /** Execution result (only if waitForCompletion=true) */
  result?: FlowExecutionResult;
}

// =============================================================================
// FLOW STATISTICS
// =============================================================================

/**
 * Statistics for a single flow
 */
export interface FlowStats {
  /** Flow ID */
  flowId: string;

  /** Total number of executions */
  totalExecutions: number;

  /** Number of successful executions */
  successCount: number;

  /** Number of failed executions */
  failedCount: number;

  /** Number of cancelled executions */
  cancelledCount: number;

  /** Success rate percentage (0-100) */
  successRate: number;

  /** Average execution time in milliseconds */
  averageExecutionTime: number;

  /** Total tokens used across all executions */
  totalTokensUsed: number;

  /** Total cost across all executions */
  totalCost: number;

  /** Last execution timestamp */
  lastExecutedAt?: Date;
}

/**
 * Global statistics across all flows
 */
export interface GlobalFlowStats {
  /** Total number of flows */
  totalFlows: number;

  /** Number of active flows */
  activeFlows: number;

  /** Total executions across all flows */
  totalExecutions: number;

  /** Currently running executions */
  runningExecutions: number;

  /** Total success count */
  successCount: number;

  /** Total failure count */
  failedCount: number;

  /** Overall success rate */
  successRate: number;

  /** Total tokens used */
  totalTokensUsed: number;

  /** Total cost */
  totalCost: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a node is an InputNode
 */
export function isInputNode(node: FlowNode): node is InputNode {
  return node.type === 'input';
}

/**
 * Type guard to check if a node is an AgentNode
 */
export function isAgentNode(node: FlowNode): node is AgentNode {
  return node.type === 'agent';
}

/**
 * Type guard to check if a node is an OutputNode
 */
export function isOutputNode(node: FlowNode): node is OutputNode {
  return node.type === 'output';
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Partial flow for creation/update operations
 */
export type FlowCreateInput = Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Partial flow for update operations
 */
export type FlowUpdateInput = Partial<Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Flow with populated agent relations in nodes
 */
export interface FlowWithRelations extends Flow {
  nodes: (InputNode | (AgentNode & { agent: Agent }) | OutputNode)[];
}
