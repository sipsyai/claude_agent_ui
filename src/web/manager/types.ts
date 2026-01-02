export type AgentInputType = 'text' | 'textarea' | 'select' | 'file' | 'number';

export interface AgentInput {
  name: string;
  description: string;
  type: AgentInputType;
  required: boolean;
  defaultValue?: any;
  options?: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  inputs: AgentInput[];
}

export enum ManagerView {
    Dashboard = 'dashboard',
    Chat = 'chat',
    Agents = 'agents',
    Commands = 'commands',
    Skills = 'skills',
    MCPServers = 'mcp-servers',
    Tasks = 'tasks',
    Flows = 'flows',
    Settings = 'settings',
}

/**
 * MCP Server configuration for stdio transport
 */
export interface MCPStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

/**
 * MCP Server configuration for SDK transport
 */
export interface MCPSdkServerConfig {
  type: 'sdk';
  name: string;
  instance?: any;
  disabled?: boolean;
}

/**
 * MCP Server configuration for SSE transport
 */
export interface MCPSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/**
 * MCP Server configuration for HTTP transport
 */
export interface MCPHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/**
 * Union type for all MCP server configurations
 */
export type MCPServerConfig =
  | MCPStdioServerConfig
  | MCPSdkServerConfig
  | MCPSSEServerConfig
  | MCPHttpServerConfig;

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
 * MCP Server representation with metadata
 */
export interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'sdk' | 'sse' | 'http';
  config: MCPServerConfig;
  disabled?: boolean;
  mcpTools?: MCPTool[];
  toolsFetchedAt?: Date | string;
  command?: string;
  description?: string;
}

/**
 * Validation step for project setup
 */
export interface ValidationStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

// =============================================================================
// FLOW TYPES
// =============================================================================

/**
 * Flow lifecycle status
 */
export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived';

/**
 * Flow category for organization
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
 * Node type discriminator
 */
export type FlowNodeType = 'input' | 'agent' | 'output';

/**
 * Schedule type for flow scheduling
 */
export type FlowScheduleType = 'once' | 'cron' | 'interval';

/**
 * Interval unit for interval-based scheduling
 */
export type FlowIntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks';

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
  name: string;
  type: InputFieldType;
  label: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: any;
  options?: string[];
  pattern?: string;
  min?: number;
  max?: number;
}

/**
 * UI position coordinates for node rendering
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Base interface for all flow nodes
 */
export interface FlowNodeBase {
  nodeId: string;
  type: FlowNodeType;
  name: string;
  description?: string;
  position: NodePosition;
  nextNodeId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input node for defining flow inputs
 */
export interface InputNode extends FlowNodeBase {
  type: 'input';
  inputFields: FlowInputField[];
  validationRules?: Record<string, any>;
}

/**
 * Agent node for executing an agent with configured skills
 */
export interface AgentNode extends FlowNodeBase {
  type: 'agent';
  agentId: string;
  agent?: Agent;
  promptTemplate: string;
  skills: string[];
  modelOverride: 'default' | string;
  maxTokens?: number;
  timeout: number;
  retryOnError: boolean;
  maxRetries: number;
}

/**
 * Output node for defining how results are delivered
 */
export interface OutputNode extends FlowNodeBase {
  type: 'output';
  outputType: FlowOutputType;
  format: FlowOutputFormat;
  saveToFile: boolean;
  filePath?: string;
  fileName?: string;
  includeMetadata: boolean;
  includeTimestamp: boolean;
  transformTemplate?: string;
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
}

/**
 * Union type for all flow node types
 */
export type FlowNode = InputNode | AgentNode | OutputNode;

/**
 * Input schema definition for flow validation
 */
export interface FlowInputSchema {
  properties: Record<string, {
    type: string;
    description?: string;
    default?: any;
    enum?: any[];
  }>;
  required?: string[];
}

/**
 * Output schema definition for flow results
 */
export interface FlowOutputSchema {
  properties: Record<string, {
    type: string;
    description?: string;
  }>;
}

/**
 * Schedule configuration for automated flow execution
 */
export interface FlowSchedule {
  /** Whether the schedule is currently active */
  isEnabled: boolean;
  /** Type of schedule */
  scheduleType: FlowScheduleType;
  /** Cron expression for cron-based scheduling (e.g., '0 9 * * 1-5' for weekdays at 9am) */
  cronExpression?: string;
  /** Interval value for interval-based scheduling */
  intervalValue: number;
  /** Unit for interval-based scheduling */
  intervalUnit: FlowIntervalUnit;
  /** When the schedule becomes active */
  startDate?: string;
  /** When the schedule expires */
  endDate?: string;
  /** Timezone for the schedule (e.g., 'America/New_York', 'Europe/Istanbul') */
  timezone: string;
  /** Calculated next run time (managed by scheduler service) */
  nextRunAt?: string;
  /** Last time the flow was executed by this schedule */
  lastRunAt?: string;
  /** Number of times this schedule has triggered an execution */
  runCount: number;
  /** Maximum number of runs (optional, unlimited if not set) */
  maxRuns?: number;
  /** Default input values to use when the schedule triggers */
  defaultInput: Record<string, any>;
  /** Whether to retry if the scheduled execution fails */
  retryOnFailure: boolean;
  /** Maximum number of retry attempts on failure */
  maxRetries: number;
  /** Delay in minutes between retry attempts */
  retryDelayMinutes: number;
}

/**
 * Core Flow interface representing a workflow definition
 */
export interface Flow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  nodes: FlowNode[];
  status: FlowStatus;
  inputSchema: FlowInputSchema;
  outputSchema: FlowOutputSchema;
  isActive: boolean;
  version: string;
  category: FlowCategory;
  metadata?: Record<string, any>;
  /** Schedule configuration for automated execution */
  schedule?: FlowSchedule;
  /** Whether webhook triggering is enabled for this flow */
  webhookEnabled: boolean;
  /** Secret token for authenticating webhook requests */
  webhookSecret?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Log level for execution logs
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Execution log entry
 */
export interface FlowExecutionLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  nodeId?: string;
  data?: Record<string, any>;
}

/**
 * Status of individual node execution
 */
export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Error category for classification
 */
export type ErrorCategory = 'transient' | 'permanent' | 'unknown';

/**
 * Detailed error information with classification
 */
export interface FlowError {
  message: string;
  code?: string;
  statusCode?: number;
  category: ErrorCategory;
  isRetryable: boolean;
  timestamp: string;
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  delayMs: number;
  error?: string;
  success: boolean;
}

/**
 * Retry state tracking for a node
 */
export interface NodeRetryState {
  retryCount: number;
  maxRetries: number;
  attempts: RetryAttempt[];
  lastError?: FlowError;
  isWaitingForRetry: boolean;
  nextRetryAt?: string;
  totalRetryTime: number;
}

/**
 * Tracks execution state of a single node
 */
export interface NodeExecution {
  nodeId: string;
  nodeType: FlowNodeType;
  status: NodeExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  executionTime?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  errorDetails?: Record<string, any>;
  flowError?: FlowError;
  tokensUsed?: number;
  cost?: number;
  retryCount?: number;
  retryState?: NodeRetryState;
  wasSkipped?: boolean;
  defaultValueUsed?: any;
}

/**
 * Flow execution record tracking a single run of a flow
 */
export interface FlowExecution {
  id: string;
  flowId: string;
  flow?: Flow;
  status: FlowExecutionStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  logs: FlowExecutionLog[];
  error?: string;
  errorDetails?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  executionTime?: number;
  nodeExecutions: NodeExecution[];
  currentNodeId?: string;
  tokensUsed: number;
  cost: number;
  triggeredBy: FlowTriggerType;
  triggerData?: Record<string, any>;
  retryCount: number;
  parentExecutionId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * SSE update type for real-time execution monitoring
 */
export type FlowExecutionUpdateType =
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_cancelled'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'node_retrying'
  | 'log';

/**
 * SSE update event for real-time execution monitoring
 */
export interface FlowExecutionUpdate {
  type: FlowExecutionUpdateType;
  executionId: string;
  timestamp: string;
  nodeId?: string;
  nodeType?: FlowNodeType;
  data?: {
    status?: FlowExecutionStatus | NodeExecutionStatus;
    output?: Record<string, any>;
    error?: string;
    errorCategory?: ErrorCategory;
    log?: FlowExecutionLog;
    tokensUsed?: number;
    cost?: number;
    executionTime?: number;
    /** Retry-specific data */
    retryCount?: number;
    maxRetries?: number;
    nextRetryIn?: number;
    retryReason?: string;
    isRetryable?: boolean;
  };
}

/**
 * Request to start a flow execution
 */
export interface StartFlowExecutionRequest {
  flowId: string;
  input: Record<string, any>;
  triggeredBy?: FlowTriggerType;
  triggerData?: Record<string, any>;
  waitForCompletion?: boolean;
}

/**
 * Statistics for a single flow
 */
export interface FlowStats {
  flowId: string;
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  successRate: number;
  averageExecutionTime: number;
  totalTokensUsed: number;
  totalCost: number;
  lastExecutedAt?: string;
}

/**
 * Global statistics across all flows
 */
export interface GlobalFlowStats {
  totalFlows: number;
  activeFlows: number;
  totalExecutions: number;
  runningExecutions: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  totalTokensUsed: number;
  totalCost: number;
}

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

/**
 * Partial flow for creation operations
 */
export type FlowCreateInput = Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Partial flow for update operations
 */
export type FlowUpdateInput = Partial<Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>>;
