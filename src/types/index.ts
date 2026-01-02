// Core types and interfaces for CUI backend
import Anthropic from '@anthropic-ai/sdk';

// Export SDK-specific types
export * from './sdk-types.js';

// ============= STRAPI MIGRATION TYPES =============
// Export new domain types for Strapi migration
export * from './agent.types.js';
export * from './strapi.types.js';
export * from './dto.types.js';
export * from './sse.types.js';
export * from './mcp-types.js';
export * from './flow-types.js';

/**
 * Tool usage metrics for conversation analysis
 *
 * Tracks code changes and file operations performed during a conversation.
 */
export interface ToolMetrics {
  /** Number of lines added to files */
  linesAdded: number;

  /** Number of lines removed from files */
  linesRemoved: number;

  /** Number of edit operations performed */
  editCount: number;

  /** Number of write operations performed */
  writeCount: number;
}

/**
 * Conversation summary with metadata and metrics
 *
 * Represents a high-level view of a Claude CLI conversation session
 * with aggregated statistics and current status.
 */
export interface ConversationSummary {
  /** Claude CLI's actual session ID (used for history files) */
  sessionId: string;

  /** Absolute path to the project directory */
  projectPath: string;

  /** Brief summary of the conversation content */
  summary: string;

  /** Complete session metadata from SessionInfoService */
  sessionInfo: SessionInfo;

  /** ISO timestamp when conversation was created */
  createdAt: string;

  /** ISO timestamp when conversation was last updated */
  updatedAt: string;

  /** Total number of messages in the conversation */
  messageCount: number;

  /** Total conversation duration in milliseconds */
  totalDuration: number;

  /** Claude model used for the conversation */
  model: string;

  /** Conversation status based on active streams */
  status: 'completed' | 'ongoing' | 'pending';

  /** CUI's internal streaming ID (only present when status is 'ongoing') */
  streamingId?: string;

  /** Optional tool usage metrics */
  toolMetrics?: ToolMetrics;
}

/**
 * Individual conversation message
 *
 * Represents a single message in a Claude CLI conversation,
 * including metadata about the message context and execution.
 */
export interface ConversationMessage {
  /** Unique identifier for this message */
  uuid: string;

  /** Message type (user input, assistant response, or system message) */
  type: 'user' | 'assistant' | 'system';

  /** Anthropic message content */
  message: Anthropic.Message | Anthropic.MessageParam;

  /** ISO timestamp when message was created */
  timestamp: string;

  /** Claude CLI's actual session ID */
  sessionId: string;

  /** UUID of parent message (for threaded conversations) */
  parentUuid?: string;

  /** Whether this message is part of a sidechain conversation */
  isSidechain?: boolean;

  /** Type of user interaction (e.g., 'external') */
  userType?: string;

  /** Working directory when the message was created */
  cwd?: string;

  /** Claude CLI version used for this message */
  version?: string;

  /** Message execution duration in milliseconds */
  durationMs?: number;
}

/**
 * Base stream message interface
 *
 * Common fields for all SSE stream messages from Claude CLI.
 */
export interface StreamMessage {
  /** Stream message type */
  type: 'system' | 'assistant' | 'user' | 'result';

  /** Claude CLI's session ID (in stream messages) */
  session_id: string;
}

/**
 * System initialization message
 *
 * Sent at the start of a conversation stream to provide
 * configuration details and available resources.
 */
export interface SystemInitMessage extends StreamMessage {
  type: 'system';
  subtype: 'init';

  /** Current working directory */
  cwd: string;

  /** Available tools for this session */
  tools: string[];

  /** MCP servers and their status */
  mcp_servers: { name: string; status: string; }[];

  /** Claude model being used */
  model: string;

  /** Permission mode for the session */
  permissionMode: string;

  /** Source of the API key (e.g., 'environment', 'config') */
  apiKeySource: string;
}

/**
 * Assistant stream message
 *
 * Contains Claude's response during a conversation stream.
 */
export interface AssistantStreamMessage extends StreamMessage {
  type: 'assistant';

  /** Complete Anthropic message from Claude */
  message: Anthropic.Message;

  /** Parent tool use ID if this is a tool result response */
  parent_tool_use_id?: string;
}

/**
 * User stream message
 *
 * Contains user input during a conversation stream.
 */
export interface UserStreamMessage extends StreamMessage {
  type: 'user';

  /** User message content */
  message: Anthropic.MessageParam;

  /** Parent tool use ID if this is a tool result */
  parent_tool_use_id?: string;
}

/**
 * Result stream message
 *
 * Final message in a conversation stream containing
 * execution results, metrics, and token usage.
 */
export interface ResultStreamMessage extends StreamMessage {
  type: 'result';

  /** Result type (success or error) */
  subtype: 'success' | 'error_max_turns' | 'error_during_execution';

  /** Whether the execution resulted in an error */
  is_error: boolean;

  /** Total execution duration in milliseconds */
  duration_ms: number;

  /** API call duration in milliseconds */
  duration_api_ms: number;

  /** Number of conversation turns */
  num_turns: number;

  /** Optional result message */
  result?: string;

  /** Token usage and API metrics */
  usage: {
    /** Number of input tokens */
    input_tokens: number;

    /** Input tokens used for cache creation */
    cache_creation_input_tokens: number;

    /** Input tokens read from cache */
    cache_read_input_tokens: number;

    /** Number of output tokens */
    output_tokens: number;

    /** Server-side tool usage */
    server_tool_use: {
      /** Number of web search requests */
      web_search_requests: number;
    };
  };
}

/**
 * Permission request for tool execution
 *
 * Represents a request for user approval before executing
 * a tool during conversation execution.
 */
export interface PermissionRequest {
  /** Unique request identifier */
  id: string;

  /** CUI's internal streaming identifier */
  streamingId: string;

  /** Name of the tool requesting permission */
  toolName: string;

  /** Input parameters for the tool */
  toolInput: Record<string, unknown>;

  /** ISO timestamp of the request */
  timestamp: string;

  /** Current status of the permission request */
  status: 'pending' | 'approved' | 'denied';

  /** Modified tool input (if user edited before approving) */
  modifiedInput?: Record<string, unknown>;

  /** Reason for denial (if denied) */
  denyReason?: string;
}

/**
 * Conversation configuration
 *
 * Configuration options for starting or resuming a Claude conversation.
 */
export interface ConversationConfig {
  /** Working directory for the conversation */
  workingDirectory: string;

  /** Initial user prompt to start the conversation */
  initialPrompt: string;

  /** Claude model to use (e.g., 'sonnet', 'opus') */
  model?: string;

  /** Tools that are explicitly allowed */
  allowedTools?: string[];

  /** Tools that are explicitly disallowed */
  disallowedTools?: string[];

  /** Custom system prompt for the agent */
  systemPrompt?: string;

  /** Path to Claude CLI executable */
  claudeExecutablePath?: string;

  /** Messages from previous session for resume context */
  previousMessages?: ConversationMessage[];

  /** Permission mode: "acceptEdits" | "bypassPermissions" | "default" | "plan" */
  permissionMode?: string;

  /** Skills array from Strapi (will be synced to filesystem) */
  skills?: any[];

  /** Extended thinking budget in tokens (default: 10000) */
  maxThinkingTokens?: number;
}

/**
 * Start conversation request
 *
 * Request body for initiating a new conversation with Claude CLI.
 */
export interface StartConversationRequest {
  /** Working directory for the conversation */
  workingDirectory: string;

  /** Initial user prompt */
  initialPrompt: string;

  /** Claude model to use */
  model?: string;

  /** Tools that are explicitly allowed */
  allowedTools?: string[];

  /** Tools that are explicitly disallowed */
  disallowedTools?: string[];

  /** Custom system prompt */
  systemPrompt?: string;

  /** Permission mode: "acceptEdits" | "bypassPermissions" | "default" | "plan" */
  permissionMode?: string;

  /** Optional: session ID to resume from */
  resumedSessionId?: string;
}

/**
 * Start conversation response
 *
 * Response containing stream connection details and
 * system initialization information.
 */
export interface StartConversationResponse {
  /** CUI's internal streaming identifier for managing streaming connections */
  streamingId: string;

  /** SSE stream URL for receiving conversation events */
  streamUrl: string;

  /** Claude CLI's session ID */
  sessionId: string;

  /** Current working directory */
  cwd: string;

  /** Available tools */
  tools: string[];

  /** MCP server list with status */
  mcpServers: { name: string; status: string; }[];

  /** Actual model being used */
  model: string;

  /** Permission handling mode */
  permissionMode: string;

  /** API key source */
  apiKeySource: string;
}

/**
 * Conversation list query parameters
 *
 * Filter and pagination options for retrieving conversation lists.
 */
export interface ConversationListQuery {
  /** Filter by project path */
  projectPath?: string;

  /** Maximum number of results */
  limit?: number;

  /** Number of results to skip */
  offset?: number;

  /** Field to sort by */
  sortBy?: 'created' | 'updated';

  /** Sort order */
  order?: 'asc' | 'desc';

  /** Filter by continuation status */
  hasContinuation?: boolean;

  /** Filter by archived status */
  archived?: boolean;

  /** Filter by pinned status */
  pinned?: boolean;
}

/**
 * Conversation details response
 *
 * Complete conversation data including messages and metadata.
 */
export interface ConversationDetailsResponse {
  /** All messages in the conversation */
  messages: ConversationMessage[];

  /** Conversation summary */
  summary: string;

  /** Project directory path */
  projectPath: string;

  /** Conversation metadata */
  metadata: {
    /** Total conversation duration in milliseconds */
    totalDuration: number;

    /** Claude model used */
    model: string;
  };

  /** Optional tool usage metrics */
  toolMetrics?: ToolMetrics;
}

/**
 * Permission decision request
 *
 * User's decision on a permission request for tool execution.
 */
export interface PermissionDecisionRequest {
  /** User action (approve or deny) */
  action: 'approve' | 'deny';

  /** Modified tool input (if user edited before approving) */
  modifiedInput?: Record<string, unknown>;

  /** Reason for denial (if denied) */
  denyReason?: string;
}

/**
 * Permission decision response
 *
 * Confirmation of permission decision processing.
 */
export interface PermissionDecisionResponse {
  /** Whether the decision was processed successfully */
  success: boolean;

  /** Optional message (e.g., error details) */
  message?: string;
}

/**
 * System status response
 *
 * Current system information and configuration.
 */
export interface SystemStatusResponse {
  /** Claude CLI version */
  claudeVersion: string;

  /** Path to Claude CLI executable */
  claudePath: string;

  /** Path to Claude CLI config directory */
  configPath: string;

  /** Number of currently active conversations */
  activeConversations: number;

  /** Unique machine identifier */
  machineId: string;
}

/**
 * Stream event union type
 *
 * All possible event types that can be received from a conversation stream.
 */
export type StreamEvent =
  /** Stream connection established */
  | { type: 'connected'; streaming_id: string; timestamp: string }
  /** Permission request for tool execution */
  | { type: 'permission_request'; data: PermissionRequest; streamingId: string; timestamp: string }
  /** Error occurred during streaming */
  | { type: 'error'; error: string; streamingId: string; timestamp: string }
  /** Stream connection closed */
  | { type: 'closed'; streamingId: string; timestamp: string }
  /** Session ID was updated (e.g., after resume) */
  | { type: 'session_id_update'; oldSessionId: string; newSessionId: string; streamingId: string; timestamp: string }
  /** System initialization message */
  | SystemInitMessage
  /** Assistant response message */
  | AssistantStreamMessage
  /** User input message */
  | UserStreamMessage
  /** Final result message */
  | ResultStreamMessage;

/**
 * Claude UI custom error class
 *
 * Enhanced error with error code and HTTP status code.
 */
export class CUIError extends Error {
  /**
   * Create a new CUIError
   *
   * @param code - Error code (e.g., 'CONVERSATION_NOT_FOUND')
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default: 500)
   */
  constructor(public code: string, message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'CUIError';
  }
}

/**
 * File system entry metadata
 *
 * Represents a file or directory in the file system.
 */
export interface FileSystemEntry {
  /** Entry name (file or directory name) */
  name: string;

  /** Entry type */
  type: 'file' | 'directory';

  /** File size in bytes (for files only) */
  size?: number;

  /** ISO timestamp of last modification */
  lastModified: string;
}

/**
 * File system list query parameters
 *
 * Options for listing directory contents.
 */
export interface FileSystemListQuery {
  /** Directory path to list */
  path: string;

  /** Whether to list subdirectories recursively */
  recursive?: boolean;

  /** Whether to respect .gitignore rules */
  respectGitignore?: boolean;
}

/**
 * File system list response
 *
 * Directory listing results.
 */
export interface FileSystemListResponse {
  /** Directory path that was listed */
  path: string;

  /** Array of file system entries */
  entries: FileSystemEntry[];

  /** Total number of entries */
  total: number;
}

/**
 * File system read query parameters
 *
 * Options for reading file contents.
 */
export interface FileSystemReadQuery {
  /** File path to read */
  path: string;
}

/**
 * File system read response
 *
 * File contents and metadata.
 */
export interface FileSystemReadResponse {
  /** File path that was read */
  path: string;

  /** File contents */
  content: string;

  /** File size in bytes */
  size: number;

  /** ISO timestamp of last modification */
  lastModified: string;

  /** File encoding (e.g., 'utf-8') */
  encoding: string;
}

/**
 * Session information stored in lowdb database
 *
 * Persistent metadata for Claude CLI conversation sessions.
 */
export interface SessionInfo {
  /** Custom name for the session, default: "" */
  custom_name: string;

  /** ISO 8601 timestamp when session info was created */
  created_at: string;

  /** ISO 8601 timestamp when session info was last updated */
  updated_at: string;

  /** Schema version for future migrations */
  version: number;

  /** Whether session is pinned, default: false */
  pinned: boolean;

  /** Whether session is archived, default: false */
  archived: boolean;

  /** ID of the continuation session if exists, default: "" */
  continuation_session_id: string;

  /** Git commit HEAD when session started, default: "" */
  initial_commit_head: string;

  /** Permission mode used for the session, default: "default" */
  permission_mode: string;
}

/**
 * Session rename request (deprecated)
 *
 * @deprecated Use SessionUpdateRequest instead
 */
export interface SessionRenameRequest {
  /** New custom name for the session */
  customName: string;
}

/**
 * Session rename response (deprecated)
 *
 * @deprecated Use SessionUpdateResponse instead
 */
export interface SessionRenameResponse {
  /** Whether the rename was successful */
  success: boolean;

  /** Session ID that was renamed */
  sessionId: string;

  /** New custom name */
  customName: string;
}

/**
 * Session update request
 *
 * Request body for updating session metadata.
 * All fields are optional - only provided fields will be updated.
 */
export interface SessionUpdateRequest {
  /** Optional: update custom name */
  customName?: string;

  /** Optional: update pinned status */
  pinned?: boolean;

  /** Optional: update archived status */
  archived?: boolean;

  /** Optional: update continuation session */
  continuationSessionId?: string;

  /** Optional: update initial commit head */
  initialCommitHead?: string;

  /** Optional: update permission mode */
  permissionMode?: string;
}

/**
 * Session update response
 *
 * Confirmation of session update with complete updated session info.
 */
export interface SessionUpdateResponse {
  /** Whether the update was successful */
  success: boolean;

  /** Session ID that was updated */
  sessionId: string;

  /** Returns the complete updated session info */
  updatedFields: SessionInfo;
}

/**
 * Notification configuration
 *
 * Defines a notification to be sent to the user.
 */
export interface Notification {
  /** Notification title */
  title: string;

  /** Notification message content */
  message: string;

  /** Notification priority level */
  priority: 'min' | 'low' | 'default' | 'high' | 'urgent';

  /** Tags for categorizing notifications */
  tags: string[];

  /** Associated session ID */
  sessionId: string;

  /** Associated streaming ID */
  streamingId: string;

  /** Associated permission request ID (if applicable) */
  permissionRequestId?: string;
}

/**
 * Working directory metadata
 *
 * Information about a directory where conversations have been conducted.
 */
export interface WorkingDirectory {
  /** Full absolute path (e.g., "/home/user/projects/myapp") */
  path: string;

  /** Smart suffix (e.g., "myapp" or "projects/myapp") */
  shortname: string;

  /** ISO timestamp of most recent conversation */
  lastDate: string;

  /** Total conversations in this directory */
  conversationCount: number;
}

/**
 * Working directories list response
 *
 * List of all directories with conversation history.
 */
export interface WorkingDirectoriesResponse {
  /** Array of working directories */
  directories: WorkingDirectory[];

  /** Total number of directories */
  totalCount: number;
}

/**
 * Command metadata
 *
 * Information about a Claude CLI command.
 */
export interface Command {
  /** Command name (without leading slash) */
  name: string;

  /** Command type (builtin or custom) */
  type: 'builtin' | 'custom';

  /** Optional command description */
  description?: string;
}

/**
 * Commands list response
 *
 * List of available Claude CLI commands.
 */
export interface CommandsResponse {
  /** Array of available commands */
  commands: Command[];
}

/**
 * Gemini API health check response
 *
 * Status information for the Gemini API integration.
 */
export interface GeminiHealthResponse {
  /** Health status */
  status: 'healthy' | 'unhealthy';

  /** Status message */
  message: string;

  /** Whether the API key is valid */
  apiKeyValid: boolean;
}

/**
 * Gemini transcribe request
 *
 * Request body for audio transcription.
 */
export interface GeminiTranscribeRequest {
  /** Base64 encoded audio data */
  audio: string;

  /** Audio MIME type (e.g., 'audio/wav', 'audio/mp3') */
  mimeType: string;
}

/**
 * Gemini transcribe response
 *
 * Transcribed text from audio input.
 */
export interface GeminiTranscribeResponse {
  /** Transcribed text */
  text: string;
}

/**
 * Gemini summarize request
 *
 * Request body for text summarization.
 */
export interface GeminiSummarizeRequest {
  /** Text to summarize */
  text: string;
}

/**
 * Gemini summarize response
 *
 * Summary with title and key points.
 */
export interface GeminiSummarizeResponse {
  /** Generated title for the content */
  title: string;

  /** Array of key points extracted from the text */
  keypoints: string[];
}

export * from './config.js';
export * from './router-config.js';
