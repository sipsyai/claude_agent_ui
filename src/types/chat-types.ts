/**
 * Chat-related type definitions
 */

/**
 * Chat session from Strapi
 *
 * Represents a persistent chat conversation with associated
 * skills, agent, and configuration.
 */
export interface ChatSession {
  /** Strapi numeric ID */
  id: number;

  /** Strapi document ID (UUID) */
  documentId: string;

  /** Session title */
  title: string;

  /** Session status */
  status: 'active' | 'archived';

  /** Claude SDK session ID for resuming (null if new) */
  sessionId: string | null;

  /** Associated skills */
  skills?: {
    id: number;
    documentId: string;
    name: string;
  }[];

  /** Associated agent with configuration */
  agent?: {
    id: number;
    documentId: string;
    name: string;
    systemPrompt: string;
    toolConfig?: {
      allowedTools?: string[];
      disallowedTools?: string[];
    };
    modelConfig?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    mcpConfig?: any[];
  };

  /** Optional custom system prompt override */
  customSystemPrompt?: string;

  /** Permission mode for tool execution */
  permissionMode: 'default' | 'bypass' | 'auto' | 'plan';

  /** Legacy field, now part of permissionMode */
  planMode?: boolean;

  /** ISO timestamp when created */
  createdAt: string;

  /** ISO timestamp when last updated */
  updatedAt: string;

  /** ISO timestamp when published (Strapi field) */
  publishedAt?: string;
}

/**
 * Chat message from Strapi
 *
 * Represents a single message in a chat session with
 * attachments, metadata, and token usage.
 */
export interface ChatMessage {
  /** Strapi numeric ID */
  id: number;

  /** Strapi document ID (UUID) */
  documentId: string;

  /** Message role */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** File attachments */
  attachments?: {
    id: number;
    documentId: string;
    name: string;
    url: string;
    mime: string;
    size: number;
  }[];

  /** Message metadata (tools, usage, cost) */
  metadata?: {
    /** Tool uses in this message */
    toolUses?: any[];

    /** Estimated cost in USD */
    cost?: number;

    /** Token usage */
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };

    /** Execution duration in milliseconds */
    duration?: number;
  };

  /** ISO timestamp for the message */
  timestamp: string;

  /** ISO timestamp when created */
  createdAt: string;

  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Chat attachment (client-side)
 *
 * File attachment before upload to Strapi.
 */
export interface ChatAttachment {
  /** File object */
  file: File;

  /** Object URL for preview */
  preview: string;

  /** Categorized file type */
  type: 'image' | 'pdf' | 'text';
}

/**
 * Create chat session request
 *
 * Request body for creating a new chat session.
 */
export interface CreateChatSessionRequest {
  /** Session title */
  title: string;

  /** Array of skill documentIds */
  skillIds: string[];

  /** Optional agent documentId */
  agentId?: string;

  /** Optional custom system prompt override */
  customSystemPrompt?: string;

  /** Permission mode for tool execution */
  permissionMode?: 'default' | 'bypass' | 'auto' | 'plan';
}

/**
 * Create chat session response
 *
 * Response containing the newly created session.
 */
export interface CreateChatSessionResponse {
  /** Created chat session */
  session: ChatSession;
}

/**
 * Send message request
 *
 * Request body for sending a message in a chat session.
 */
export interface SendMessageRequest {
  /** Session document ID */
  sessionId: string;

  /** Message text */
  message: string;

  /** File attachments (base64 encoded) */
  attachments?: {
    name: string;
    mimeType: string;
    data: string; // base64
  }[];

  /** Optional agent override for this message */
  agentId?: string;

  /** Optional skills override for this message */
  skillIds?: string[];

  /** Optional permission mode override */
  permissionMode?: 'default' | 'bypass' | 'auto' | 'plan';
}

// Streaming event types for real-time chat updates

/**
 * Event sent when assistant message starts streaming
 */
export interface AssistantMessageStartEvent {
  type: 'assistant_message_start';
  messageId: string;
  timestamp: string;
}

/**
 * Event sent for each text chunk during streaming
 */
export interface AssistantMessageDeltaEvent {
  type: 'assistant_message_delta';
  delta: string;
  messageId: string;
  timestamp: string;
}

/**
 * Event sent when assistant message is complete
 */
export interface AssistantMessageCompleteEvent {
  type: 'assistant_message_complete';
  messageId: string;
  content: string;
  timestamp: string;
  metadata?: {
    toolUses?: any[];
    cost?: number;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    duration?: number;
  };
}

/**
 * Raw SDK message event (for debugging and tool tracking)
 */
export interface SdkMessageEvent {
  type: 'sdk_message';
  data: any;
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: 'error';
  error: string;
  timestamp: string;
}

/**
 * Result event (final completion)
 */
export interface ResultEvent {
  type: 'result';
  result: any;
  timestamp: string;
}

/**
 * Stream ID event (sent at start to enable cancellation)
 */
export interface StreamIdEvent {
  type: 'stream_id';
  streamId: string;
  timestamp: string;
}

/**
 * Cancelled event (sent when stream is cancelled)
 */
export interface CancelledEvent {
  type: 'cancelled';
  streamId: string;
  timestamp: string;
  reason?: string;
}

/**
 * Union type of all possible stream events
 */
export type ChatStreamMessage =
  | StreamIdEvent
  | AssistantMessageStartEvent
  | AssistantMessageDeltaEvent
  | AssistantMessageCompleteEvent
  | SdkMessageEvent
  | ErrorEvent
  | ResultEvent
  | CancelledEvent;

/**
 * Get chat messages response
 *
 * Response containing messages and session details.
 */
export interface GetChatMessagesResponse {
  /** Array of chat messages */
  messages: ChatMessage[];

  /** Chat session details */
  session: ChatSession;
}

/**
 * Get chat sessions response
 *
 * Response containing list of chat sessions.
 */
export interface GetChatSessionsResponse {
  /** Array of chat sessions */
  sessions: ChatSession[];
}
