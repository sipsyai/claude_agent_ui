/**
 * Claude Agent UI - SSE (Server-Sent Events) Types
 *
 * This file contains type definitions for SSE streaming events
 * used in real-time agent execution.
 */

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
  HEARTBEAT = 'heartbeat',
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
    model: string;
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
    delta?: string;
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
    toolName: string;
    result: any;
    error?: string;
    executionTime?: number;
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
    step?: string;
    totalSteps?: number;
    currentStep?: number;
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
    details?: Record<string, any>;
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
    cost: number;
    toolsUsed: string[];
  };
}

/**
 * Heartbeat event (keep connection alive)
 */
export interface SSEHeartbeatEvent extends SSEBaseEvent {
  type: SSEEventType.HEARTBEAT;
  data: {
    uptime: number;
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
  | SSECompleteEvent
  | SSEHeartbeatEvent;

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
  onHeartbeat?: (event: SSEHeartbeatEvent) => void;
}

/**
 * SSE client configuration
 */
export interface SSEClientConfig {
  url: string;
  callbacks: SSECallbacks;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * SSE connection state
 */
export enum SSEConnectionState {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSED = 'closed',
  ERROR = 'error',
}

/**
 * SSE connection info
 */
export interface SSEConnectionInfo {
  state: SSEConnectionState;
  url: string;
  connected: boolean;
  reconnectAttempts: number;
  lastError?: string;
  startTime?: number;
  lastEventTime?: number;
}

/**
 * SSE message format (raw)
 */
export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * SSE event parser result
 */
export type SSEParseResult<T = SSEEvent> =
  | { success: true; event: T }
  | { success: false; error: string; raw: string };

/**
 * SSE event parser function
 */
export type SSEEventParser = (message: SSEMessage) => SSEParseResult;

/**
 * SSE error handler
 */
export type SSEErrorHandler = (error: Error, connectionInfo: SSEConnectionInfo) => void;

/**
 * SSE reconnect strategy
 */
export type SSEReconnectStrategy = (
  attempt: number,
  connectionInfo: SSEConnectionInfo
) => number | false;

/**
 * Express SSE response helper
 */
export interface SSEResponse extends Response {
  /**
   * Write an SSE event to the stream
   */
  writeSSE: (event: SSEEvent) => void;

  /**
   * Write raw SSE data
   */
  writeSSEData: (data: string, eventType?: string, id?: string) => void;

  /**
   * Close the SSE connection
   */
  closeSSE: () => void;

  /**
   * Check if connection is still open
   */
  isSSEOpen: () => boolean;
}

/**
 * SSE middleware options
 */
export interface SSEMiddlewareOptions {
  /**
   * Enable heartbeat to keep connection alive
   */
  heartbeat?: boolean;

  /**
   * Heartbeat interval in milliseconds
   */
  heartbeatInterval?: number;

  /**
   * Maximum connection duration in milliseconds
   */
  maxConnectionDuration?: number;

  /**
   * CORS headers
   */
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
}

/**
 * SSE client interface
 */
export interface SSEClient {
  /**
   * Connect to SSE endpoint
   */
  connect(): Promise<void>;

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void;

  /**
   * Get current connection state
   */
  getConnectionInfo(): SSEConnectionInfo;

  /**
   * Send a message (if bidirectional)
   */
  send?(data: any): void;
}

/**
 * Factory function for creating SSE clients
 */
export type SSEClientFactory = (config: SSEClientConfig) => SSEClient;
