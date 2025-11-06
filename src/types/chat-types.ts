/**
 * Chat-related type definitions
 */

export interface ChatSession {
  id: number;
  documentId: string;
  title: string;
  status: 'active' | 'archived';
  sessionId: string | null; // Claude SDK session ID for resuming
  skills?: {
    id: number;
    documentId: string;
    name: string;
  }[];
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
  customSystemPrompt?: string;
  permissionMode: 'default' | 'bypass' | 'auto' | 'plan';
  planMode?: boolean; // Legacy field, now part of permissionMode
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ChatMessage {
  id: number;
  documentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: {
    id: number;
    documentId: string;
    name: string;
    url: string;
    mime: string;
    size: number;
  }[];
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
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'text';
}

export interface CreateChatSessionRequest {
  title: string;
  skillIds: string[]; // Array of skill documentIds
  agentId?: string; // Optional agent documentId
  customSystemPrompt?: string; // Optional custom system prompt override
  permissionMode?: 'default' | 'bypass' | 'auto' | 'plan';
}

export interface CreateChatSessionResponse {
  session: ChatSession;
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
  attachments?: {
    name: string;
    mimeType: string;
    data: string; // base64
  }[];
  agentId?: string; // Optional agent override for this message
  skillIds?: string[]; // Optional skills override for this message
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

export interface GetChatMessagesResponse {
  messages: ChatMessage[];
  session: ChatSession;
}

export interface GetChatSessionsResponse {
  sessions: ChatSession[];
}
