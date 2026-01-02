/**
 * ChatLogService - Persistent filesystem logging for chat sessions
 *
 * @description
 * The ChatLogService manages structured JSON log files for chat sessions, providing detailed
 * audit trails, SDK event tracking, and cost/usage aggregation. It persists chat sessions to
 * `logs/chat/chat-{sessionDocId}.json` files, storing messages, SDK API calls, streaming events,
 * and metadata for analysis, debugging, and compliance.
 *
 * **Key Responsibilities:**
 * - Initialize structured JSON log files for new chat sessions
 * - Append chat messages (user, assistant, system) with timestamps and metadata
 * - Track SDK API calls with detailed request/response/event logging
 * - Aggregate cost and token usage across conversation lifecycle
 * - Update session metadata (status, SDK session ID, title)
 * - Provide log retrieval and listing capabilities
 * - Handle log deletion for session cleanup
 *
 * **Architecture:**
 * - **Filesystem Storage**: Logs stored in `logs/chat/` directory as JSON files
 * - **File Naming**: `chat-{sessionDocId}.json` (one file per session)
 * - **JSON Structure**: Structured logs with messages array, sdkCalls array, aggregated metrics
 * - **Append-Only**: Messages and events are appended, never modified (audit trail)
 * - **Graceful Degradation**: Log failures don't break chat functionality (logged as warnings)
 * - **Atomic Updates**: Read-modify-write pattern with full file rewrites (simple, consistent)
 * - **No Locking**: Single-process model assumes no concurrent writes to same log file
 *
 * **Log File Structure:**
 * ```json
 * {
 *   "sessionDocumentId": "strapi-doc-id",
 *   "title": "Session title",
 *   "status": "active" | "archived",
 *   "skills": [{ "id": 1, "documentId": "skill-doc-id", "name": "skill-name" }],
 *   "sdkSessionId": "sdk-session-uuid",
 *   "workingDirectory": "/path/to/project",
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "updatedAt": "2024-01-01T00:05:00.000Z",
 *   "messages": [...],
 *   "sdkCalls": [...],
 *   "totalCost": 0.0025,
 *   "totalMessages": 4,
 *   "totalInputTokens": 1500,
 *   "totalOutputTokens": 800,
 *   "totalCacheTokens": 500
 * }
 * ```
 *
 * **SDK Call Tracking:**
 * Each SDK API call is logged with:
 * - Request details (model, permissionMode, tools, prompt)
 * - Events array (streaming events from SDK)
 * - Final result (cost, usage, assistant message ID)
 * - Timestamp and unique call ID
 *
 * **Use Cases:**
 * - Debugging conversation flows and SDK interactions
 * - Cost tracking and budget monitoring
 * - Audit trails for compliance and security
 * - Analytics and usage pattern analysis
 * - Session recovery and replay
 * - Performance monitoring (token usage, latency)
 *
 * @example
 * ```typescript
 * // Initialize service and create log for new session
 * import { chatLogService } from './chat-log-service';
 *
 * // Initialize logs directory (called on app startup)
 * await chatLogService.init();
 *
 * // Create log file for new chat session
 * const session = {
 *   documentId: 'chat-abc123',
 *   title: 'Code Review Session',
 *   status: 'active',
 *   skills: [{ id: 1, documentId: 'skill-xyz', name: 'code-review' }],
 *   sessionId: 'sdk-session-uuid',
 *   createdAt: '2024-01-01T00:00:00.000Z',
 *   updatedAt: '2024-01-01T00:00:00.000Z'
 * };
 * await chatLogService.initChatLog(session, '/path/to/project');
 * // Creates logs/chat/chat-abc123.json
 * ```
 *
 * @example
 * ```typescript
 * // Add messages to chat log
 * import { chatLogService } from './chat-log-service';
 *
 * // Add user message
 * const userMessage = {
 *   id: 1,
 *   documentId: 'msg-user-1',
 *   role: 'user',
 *   content: 'Review this code',
 *   timestamp: '2024-01-01T00:01:00.000Z',
 *   attachments: [{ id: 1, name: 'code.ts', url: '...' }]
 * };
 * await chatLogService.addMessageToLog('chat-abc123', userMessage);
 *
 * // Add assistant message with cost metadata
 * const assistantMessage = {
 *   id: 2,
 *   documentId: 'msg-assistant-1',
 *   role: 'assistant',
 *   content: 'The code looks good...',
 *   timestamp: '2024-01-01T00:02:00.000Z',
 *   metadata: {
 *     cost: 0.0012,
 *     usage: { input_tokens: 500, output_tokens: 300 },
 *     toolUses: [{ name: 'Read', status: 'success' }]
 *   }
 * };
 * await chatLogService.addMessageToLog('chat-abc123', assistantMessage);
 * // Automatically aggregates cost and token usage
 * ```
 *
 * @example
 * ```typescript
 * // Track SDK API call lifecycle
 * import { chatLogService } from './chat-log-service';
 *
 * const callId = 'call-uuid-1';
 *
 * // 1. Start SDK call
 * await chatLogService.startSdkCall('chat-abc123', callId, 'msg-user-1', {
 *   options: {
 *     model: 'claude-sonnet-4',
 *     permissionMode: 'default',
 *     includePartialMessages: false,
 *     settingSources: ['.claude/'],
 *     cwd: '/project',
 *     allowedTools: ['Read', 'Write']
 *   },
 *   prompt: {
 *     type: 'generator',
 *     message: { role: 'user', content: 'Review code' }
 *   }
 * });
 *
 * // 2. Add streaming events as they occur
 * await chatLogService.addSdkEvent('chat-abc123', callId, {
 *   timestamp: '2024-01-01T00:01:05.000Z',
 *   type: 'assistant_message',
 *   category: 'assistant_message',
 *   details: { messageType: 'text', hasText: true, textLength: 150 },
 *   data: { message: { role: 'assistant', content: '...' } }
 * });
 *
 * // 3. Complete SDK call with final result
 * await chatLogService.completeSdkCall('chat-abc123', callId, 'msg-assistant-1', {
 *   cost: 0.0012,
 *   usage: { input_tokens: 500, output_tokens: 300 }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Update session metadata
 * import { chatLogService } from './chat-log-service';
 *
 * // Update SDK session ID when SDK assigns one
 * await chatLogService.updateSdkSessionId('chat-abc123', 'sdk-session-uuid');
 *
 * // Archive session (soft delete)
 * await chatLogService.updateSessionStatus('chat-abc123', 'archived');
 * ```
 *
 * @example
 * ```typescript
 * // Retrieve and list logs
 * import { chatLogService } from './chat-log-service';
 *
 * // Get specific log
 * const log = await chatLogService.getChatLog('chat-abc123');
 * console.log(`Total cost: $${log.totalCost}`);
 * console.log(`Messages: ${log.messages.length}`);
 * console.log(`SDK calls: ${log.sdkCalls.length}`);
 *
 * // List all logs (sorted by newest first)
 * const allLogs = await chatLogService.listChatLogs();
 * console.log(`Total sessions: ${allLogs.length}`);
 *
 * // Delete log permanently
 * await chatLogService.deleteChatLog('chat-abc123');
 * ```
 *
 * @see ChatService for chat session management and message streaming
 * @see ClaudeSdkService for SDK integration details
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger, type Logger } from './logger.js';
import type { ChatSession, ChatMessage } from '../types/chat-types.js';

export interface ChatLog {
  sessionDocumentId: string;
  title: string;
  status: 'active' | 'archived';
  skills: {
    id: number;
    documentId: string;
    name: string;
  }[];
  sdkSessionId: string | null;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatLogMessage[];
  sdkCalls: SdkCallLog[];
  totalCost: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
}

export interface ChatLogMessage {
  id: number;
  documentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: any[];
  metadata?: {
    cost?: number;
    usage?: any;
    toolUses?: any[];
  };
}

export interface SdkCallLog {
  callId: string;
  userMessageId: string;
  assistantMessageId?: string;
  timestamp: string;
  request: {
    options: {
      model: string;
      permissionMode: string;
      includePartialMessages: boolean;
      settingSources: string[];
      cwd: string;
      allowedTools: string[];
      resume?: string;
    };
    prompt: {
      type: string;
      message: {
        role: string;
        content: any;
      };
    };
  };
  events: SdkEventLog[];
  finalResult?: {
    cost?: number;
    usage?: any;
  };
}

export interface SdkEventLog {
  timestamp: string;
  type: string;
  subtype?: string;
  category?: string; // Event category: 'system', 'assistant_message', 'text_delta', 'result', etc.
  details?: {
    messageType?: string;
    subtype?: string;
    sessionId?: string;
    model?: string;
    tools?: string[] | any[];
    permissionMode?: string;
    hasText?: boolean;
    hasToolUse?: boolean;
    toolCount?: number;
    textLength?: number;
    isError?: boolean;
    numTurns?: number;
    totalCost?: number;
    duration?: number;
    [key: string]: any; // Allow additional dynamic properties
  };
  data: any;
}

export class ChatLogService {
  /** Logger instance for ChatLogService operations */
  private logger: Logger;

  /** Directory path for storing chat log files (logs/chat/) */
  private logsDir: string;

  constructor() {
    this.logger = createLogger('ChatLogService');
    this.logsDir = path.join(process.cwd(), 'logs', 'chat');
  }

  /**
   * Initialize logs directory
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      this.logger.info('Chat logs directory initialized', { path: this.logsDir });
    } catch (error) {
      this.logger.error('Failed to initialize chat logs directory', error);
      throw error;
    }
  }

  /**
   * Get log file path for session
   */
  private getLogPath(sessionDocId: string): string {
    return path.join(this.logsDir, `chat-${sessionDocId}.json`);
  }

  /**
   * Initialize chat log file for new session
   *
   * @description
   * Creates a new JSON log file for a chat session in the logs/chat/ directory.
   * The log file is initialized with session metadata, empty message/sdkCalls arrays,
   * and zero-initialized aggregate metrics. If a log file already exists for the session,
   * this method is idempotent and returns without error.
   *
   * **Workflow:**
   * 1. Generate log file path from session documentId
   * 2. Check if log file already exists (idempotent check)
   * 3. Create ChatLog object with session metadata
   * 4. Initialize empty arrays (messages, sdkCalls)
   * 5. Initialize zero aggregate metrics (totalCost, totalMessages, totalInputTokens, etc.)
   * 6. Write log file to filesystem as formatted JSON
   * 7. Log success/failure (failures are warnings, don't throw)
   *
   * **File Location:**
   * - Directory: `logs/chat/`
   * - Filename: `chat-{sessionDocId}.json`
   * - Full path: `logs/chat/chat-{sessionDocId}.json`
   *
   * **Error Handling:**
   * Log initialization failures are logged as warnings but don't throw errors.
   * This ensures chat functionality continues even if logging fails (graceful degradation).
   *
   * @param session - Chat session object from Strapi with documentId, title, status, skills
   * @param workingDirectory - Absolute path to project working directory for the session
   *
   * @returns Promise that resolves when log file is created or already exists
   *
   * @example
   * ```typescript
   * // Initialize log for new session
   * import { chatLogService } from './chat-log-service';
   *
   * const session = {
   *   documentId: 'chat-abc123',
   *   title: 'Bug Fix Session',
   *   status: 'active',
   *   skills: [
   *     { id: 1, documentId: 'skill-debugging', name: 'debugging' },
   *     { id: 2, documentId: 'skill-testing', name: 'testing' }
   *   ],
   *   sessionId: null, // SDK session ID assigned later
   *   createdAt: '2024-01-01T10:00:00.000Z',
   *   updatedAt: '2024-01-01T10:00:00.000Z'
   * };
   *
   * await chatLogService.initChatLog(session, '/home/user/project');
   * // Creates logs/chat/chat-abc123.json
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent behavior - safe to call multiple times
   * import { chatLogService } from './chat-log-service';
   *
   * const session = { documentId: 'chat-abc123', ... };
   *
   * await chatLogService.initChatLog(session, '/project');
   * await chatLogService.initChatLog(session, '/project'); // No error, returns immediately
   * ```
   *
   * @example
   * ```typescript
   * // Log file structure after initialization
   * // logs/chat/chat-abc123.json:
   * {
   *   "sessionDocumentId": "chat-abc123",
   *   "title": "Bug Fix Session",
   *   "status": "active",
   *   "skills": [
   *     { "id": 1, "documentId": "skill-debugging", "name": "debugging" }
   *   ],
   *   "sdkSessionId": null,
   *   "workingDirectory": "/home/user/project",
   *   "createdAt": "2024-01-01T10:00:00.000Z",
   *   "updatedAt": "2024-01-01T10:00:00.000Z",
   *   "messages": [],
   *   "sdkCalls": [],
   *   "totalCost": 0,
   *   "totalMessages": 0,
   *   "totalInputTokens": 0,
   *   "totalOutputTokens": 0,
   *   "totalCacheTokens": 0
   * }
   * ```
   *
   * @see addMessageToLog for appending messages to the log
   * @see startSdkCall for tracking SDK API calls
   * @see deleteChatLog for removing log files
   */
  async initChatLog(
    session: ChatSession,
    workingDirectory: string
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(session.documentId);

      // Check if log already exists
      try {
        await fs.access(logPath);
        this.logger.info('Chat log already exists', { sessionId: session.documentId });
        return;
      } catch {
        // File doesn't exist, create it
      }

      const chatLog: ChatLog = {
        sessionDocumentId: session.documentId,
        title: session.title,
        status: session.status,
        skills: session.skills || [],
        sdkSessionId: session.sessionId,
        workingDirectory,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: [],
        sdkCalls: [],
        totalCost: 0,
        totalMessages: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheTokens: 0,
      };

      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.info('Chat log initialized', {
        sessionId: session.documentId,
        path: logPath,
      });
    } catch (error) {
      this.logger.error('Failed to initialize chat log', error, {
        sessionId: session.documentId,
      });
      // Don't throw - log failure shouldn't break chat
    }
  }

  /**
   * Add message to chat log
   *
   * @description
   * Appends a chat message (user, assistant, or system) to the session's log file and updates
   * aggregate metrics. Messages are appended in chronological order to maintain conversation flow.
   * The method automatically aggregates cost and token usage from message metadata.
   *
   * **Workflow:**
   * 1. Read existing log file from filesystem
   * 2. Transform ChatMessage to ChatLogMessage format
   * 3. Append message to messages array
   * 4. Update totalMessages counter
   * 5. Aggregate cost from metadata.cost (if present)
   * 6. Aggregate token usage from metadata.usage (input_tokens, output_tokens, cache_*_tokens)
   * 7. Update updatedAt timestamp
   * 8. Write updated log back to filesystem
   *
   * **Aggregate Metrics Updated:**
   * - `totalMessages`: Incremented by 1
   * - `totalCost`: Sum of all message.metadata.cost values
   * - `totalInputTokens`: Sum of metadata.usage.input_tokens
   * - `totalOutputTokens`: Sum of metadata.usage.output_tokens
   * - `totalCacheTokens`: Sum of cache_creation_input_tokens + cache_read_input_tokens
   *
   * **Error Handling:**
   * - Returns silently if log file doesn't exist (session may not have been initialized)
   * - Logs errors as warnings but doesn't throw (graceful degradation)
   * - Chat functionality continues even if logging fails
   *
   * @param sessionDocId - Strapi document ID of the chat session
   * @param message - Chat message object with role, content, timestamp, attachments, metadata
   *
   * @returns Promise that resolves when message is appended to log
   *
   * @example
   * ```typescript
   * // Add user message
   * import { chatLogService } from './chat-log-service';
   *
   * const userMessage = {
   *   id: 1,
   *   documentId: 'msg-user-1',
   *   role: 'user',
   *   content: 'Please review this code',
   *   timestamp: '2024-01-01T10:05:00.000Z',
   *   attachments: []
   * };
   *
   * await chatLogService.addMessageToLog('chat-abc123', userMessage);
   * // totalMessages: 0 → 1
   * ```
   *
   * @example
   * ```typescript
   * // Add assistant message with cost and usage metadata
   * import { chatLogService } from './chat-log-service';
   *
   * const assistantMessage = {
   *   id: 2,
   *   documentId: 'msg-assistant-1',
   *   role: 'assistant',
   *   content: 'The code looks good. I suggest adding...',
   *   timestamp: '2024-01-01T10:06:30.000Z',
   *   metadata: {
   *     cost: 0.0025,
   *     usage: {
   *       input_tokens: 1500,
   *       output_tokens: 800,
   *       cache_creation_input_tokens: 200,
   *       cache_read_input_tokens: 300
   *     },
   *     toolUses: [
   *       { name: 'Read', status: 'success', path: 'src/auth.ts' }
   *     ]
   *   }
   * };
   *
   * await chatLogService.addMessageToLog('chat-abc123', assistantMessage);
   * // totalMessages: 1 → 2
   * // totalCost: 0 → 0.0025
   * // totalInputTokens: 0 → 1500
   * // totalOutputTokens: 0 → 800
   * // totalCacheTokens: 0 → 500 (200 + 300)
   * ```
   *
   * @example
   * ```typescript
   * // Add user message with attachments
   * import { chatLogService } from './chat-log-service';
   *
   * const userMessage = {
   *   id: 3,
   *   documentId: 'msg-user-2',
   *   role: 'user',
   *   content: 'Analyze this error screenshot',
   *   timestamp: '2024-01-01T10:10:00.000Z',
   *   attachments: [
   *     {
   *       id: 1,
   *       documentId: 'file-xyz',
   *       name: 'error.png',
   *       url: 'https://storage.example.com/error.png',
   *       size: 125000,
   *       mime: 'image/png'
   *     }
   *   ]
   * };
   *
   * await chatLogService.addMessageToLog('chat-abc123', userMessage);
   * // Attachments are preserved in log for audit trail
   * ```
   *
   * @example
   * ```typescript
   * // Add system message (internal events, errors, etc.)
   * import { chatLogService } from './chat-log-service';
   *
   * const systemMessage = {
   *   id: 4,
   *   documentId: 'msg-system-1',
   *   role: 'system',
   *   content: 'Stream cancelled by user',
   *   timestamp: '2024-01-01T10:15:00.000Z',
   *   metadata: {
   *     reason: 'user_cancelled',
   *     streamId: 'stream-uuid-1'
   *   }
   * };
   *
   * await chatLogService.addMessageToLog('chat-abc123', systemMessage);
   * ```
   *
   * @see initChatLog for initializing log files
   * @see startSdkCall for tracking SDK API calls
   * @see completeSdkCall for finalizing SDK call metadata
   */
  async addMessageToLog(
    sessionDocId: string,
    message: ChatMessage
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        // Log file doesn't exist, skip
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Add message
      const logMessage: ChatLogMessage = {
        id: message.id,
        documentId: message.documentId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        attachments: message.attachments,
        metadata: message.metadata,
      };

      chatLog.messages.push(logMessage);
      chatLog.totalMessages = chatLog.messages.length;
      chatLog.updatedAt = new Date().toISOString();

      // Update aggregates
      if (message.metadata?.cost) {
        chatLog.totalCost += message.metadata.cost;
      }
      if (message.metadata?.usage) {
        chatLog.totalInputTokens += message.metadata.usage.input_tokens || 0;
        chatLog.totalOutputTokens += message.metadata.usage.output_tokens || 0;
        chatLog.totalCacheTokens += message.metadata.usage.cache_creation_input_tokens || 0;
        chatLog.totalCacheTokens += message.metadata.usage.cache_read_input_tokens || 0;
      }

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('Message added to chat log', {
        sessionId: sessionDocId,
        messageId: message.documentId,
        role: message.role,
      });
    } catch (error) {
      this.logger.error('Failed to add message to chat log', error, {
        sessionId: sessionDocId,
        messageId: message.documentId,
      });
      // Don't throw - log failure shouldn't break chat
    }
  }

  /**
   * Update SDK session ID in log
   *
   * @description
   * Updates the SDK session ID in the chat log. The SDK assigns a unique session ID when
   * a conversation starts, which is used to resume conversations and maintain context across
   * multiple turns. This method records the SDK session ID for tracking and debugging purposes.
   *
   * **Workflow:**
   * 1. Read existing log file from filesystem
   * 2. Update sdkSessionId field
   * 3. Update updatedAt timestamp
   * 4. Write updated log back to filesystem
   *
   * **SDK Session ID:**
   * - Unique identifier assigned by Claude SDK for each conversation
   * - Used to resume conversations with `resume` option in SDK query
   * - Enables conversation continuity across server restarts
   * - Links chat sessions to SDK conversation history files
   *
   * **Error Handling:**
   * - Returns silently if log file doesn't exist
   * - Logs warnings but doesn't throw (graceful degradation)
   * - SDK functionality continues even if logging fails
   *
   * @param sessionDocId - Strapi document ID of the chat session
   * @param sdkSessionId - Unique session ID assigned by Claude SDK
   *
   * @returns Promise that resolves when SDK session ID is updated
   *
   * @example
   * ```typescript
   * // Update SDK session ID when SDK assigns one
   * import { chatLogService } from './chat-log-service';
   *
   * // SDK assigns session ID during first query
   * const sdkSessionId = 'sdk-session-abc-xyz-123';
   *
   * await chatLogService.updateSdkSessionId('chat-abc123', sdkSessionId);
   * ```
   *
   * @example
   * ```typescript
   * // Typical flow: Create session, send message, update SDK session ID
   * import { chatLogService } from './chat-log-service';
   * import { claudeSdkService } from './claude-sdk-service';
   *
   * // 1. Initialize chat log
   * const session = { documentId: 'chat-abc123', ... };
   * await chatLogService.initChatLog(session, '/project');
   *
   * // 2. Start conversation with SDK (SDK assigns session ID)
   * const config = { agentId: 'agent-1', model: 'claude-sonnet-4', ... };
   * const sessionId = await claudeSdkService.startConversation(config);
   *
   * // 3. Update log with SDK session ID
   * await chatLogService.updateSdkSessionId('chat-abc123', sessionId);
   * ```
   *
   * @example
   * ```typescript
   * // Resume conversation using SDK session ID from log
   * import { chatLogService } from './chat-log-service';
   * import { claudeSdkService } from './claude-sdk-service';
   *
   * // Retrieve SDK session ID from log
   * const log = await chatLogService.getChatLog('chat-abc123');
   * const sdkSessionId = log.sdkSessionId;
   *
   * if (sdkSessionId) {
   *   // Resume conversation with SDK
   *   const config = {
   *     agentId: 'agent-1',
   *     model: 'claude-sonnet-4',
   *     resume: sdkSessionId // Resume existing conversation
   *   };
   *   await claudeSdkService.startConversation(config);
   * }
   * ```
   *
   * @see initChatLog for initializing log files
   * @see ClaudeSdkService for SDK integration
   */
  async updateSdkSessionId(
    sessionDocId: string,
    sdkSessionId: string
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Update SDK session ID
      chatLog.sdkSessionId = sdkSessionId;
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK session ID updated in chat log', {
        sessionId: sessionDocId,
        sdkSessionId,
      });
    } catch (error) {
      this.logger.error('Failed to update SDK session ID', error, {
        sessionId: sessionDocId,
      });
    }
  }

  /**
   * Update session status in log
   *
   * @description
   * Updates the session status in the chat log. Status changes typically occur when a session
   * is archived (soft delete) or reactivated. This keeps the log file in sync with the session
   * status stored in Strapi, enabling consistent status tracking across the application.
   *
   * **Workflow:**
   * 1. Read existing log file from filesystem
   * 2. Update status field ('active' or 'archived')
   * 3. Update updatedAt timestamp
   * 4. Write updated log back to filesystem
   *
   * **Session Status:**
   * - `active`: Session is currently active and visible in chat list
   * - `archived`: Session is archived (soft deleted) and hidden from chat list
   *
   * **Use Cases:**
   * - Archive completed sessions to clean up UI
   * - Reactivate archived sessions for continued conversation
   * - Maintain consistent status between Strapi and log files
   * - Support soft delete patterns (archive instead of permanent delete)
   *
   * **Error Handling:**
   * - Returns silently if log file doesn't exist
   * - Logs warnings but doesn't throw (graceful degradation)
   * - Status changes continue even if logging fails
   *
   * @param sessionDocId - Strapi document ID of the chat session
   * @param status - New session status ('active' or 'archived')
   *
   * @returns Promise that resolves when session status is updated
   *
   * @example
   * ```typescript
   * // Archive session (soft delete)
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.updateSessionStatus('chat-abc123', 'archived');
   * // Session status changed from 'active' to 'archived'
   * ```
   *
   * @example
   * ```typescript
   * // Reactivate archived session
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.updateSessionStatus('chat-abc123', 'active');
   * // Session status changed from 'archived' to 'active'
   * ```
   *
   * @example
   * ```typescript
   * // Archive session workflow (Strapi + log file)
   * import { chatLogService } from './chat-log-service';
   * import { chatService } from './chat-service';
   *
   * // Archive session in Strapi
   * const updatedSession = await chatService.archiveChatSession('chat-abc123');
   *
   * // Update log file to match
   * await chatLogService.updateSessionStatus('chat-abc123', 'archived');
   *
   * console.log('Session archived:', updatedSession.status === 'archived');
   * ```
   *
   * @example
   * ```typescript
   * // List active vs archived sessions using log files
   * import { chatLogService } from './chat-log-service';
   *
   * const allLogs = await chatLogService.listChatLogs();
   *
   * const activeLogs = allLogs.filter(log => log.status === 'active');
   * const archivedLogs = allLogs.filter(log => log.status === 'archived');
   *
   * console.log(`Active sessions: ${activeLogs.length}`);
   * console.log(`Archived sessions: ${archivedLogs.length}`);
   * ```
   *
   * @see ChatService.archiveChatSession for archiving sessions in Strapi
   * @see initChatLog for initializing log files
   * @see deleteChatLog for permanent deletion
   */
  async updateSessionStatus(
    sessionDocId: string,
    status: 'active' | 'archived'
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Update status
      chatLog.status = status;
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('Session status updated in chat log', {
        sessionId: sessionDocId,
        status,
      });
    } catch (error) {
      this.logger.error('Failed to update session status', error, {
        sessionId: sessionDocId,
      });
    }
  }

  /**
   * Get chat log
   */
  async getChatLog(sessionDocId: string): Promise<ChatLog | null> {
    try {
      const logPath = this.getLogPath(sessionDocId);
      const content = await fs.readFile(logPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.warn('Failed to read chat log', error, {
        sessionId: sessionDocId,
      });
      return null;
    }
  }

  /**
   * Start SDK call logging
   *
   * @description
   * Begins tracking a new Claude SDK API call by creating a SdkCallLog entry in the chat log.
   * This captures the initial request details including model configuration, permissions, tools,
   * and prompt. As the SDK streams events, they are appended via addSdkEvent(). The call is
   * finalized with completeSdkCall() when the assistant response is complete.
   *
   * **Workflow:**
   * 1. Read existing log file from filesystem
   * 2. Create SdkCallLog object with request details
   * 3. Initialize empty events array
   * 4. Append to log's sdkCalls array
   * 5. Update updatedAt timestamp
   * 6. Write updated log back to filesystem
   *
   * **SDK Call Lifecycle:**
   * 1. `startSdkCall()` - Log initial request (model, options, prompt)
   * 2. `addSdkEvent()` - Append streaming events as they arrive
   * 3. `completeSdkCall()` - Finalize with assistant message ID and result metadata
   *
   * **Request Structure:**
   * - `options`: Model config (model name, permissionMode, cwd, tools, etc.)
   * - `prompt`: Prompt details (type: 'generator', message with role and content)
   *
   * **Error Handling:**
   * - Returns silently if log file doesn't exist
   * - Logs errors as warnings but doesn't throw (graceful degradation)
   * - SDK functionality continues even if logging fails
   *
   * @param sessionDocId - Strapi document ID of the chat session
   * @param callId - Unique identifier for this SDK call (UUID)
   * @param userMessageId - Document ID of the user message that triggered this call
   * @param request - SDK request details (options and prompt)
   *
   * @returns Promise that resolves when SDK call is logged
   *
   * @example
   * ```typescript
   * // Start logging SDK call
   * import { chatLogService } from './chat-log-service';
   * import { v4 as uuidv4 } from 'uuid';
   *
   * const callId = uuidv4(); // Generate unique call ID
   *
   * await chatLogService.startSdkCall('chat-abc123', callId, 'msg-user-1', {
   *   options: {
   *     model: 'claude-sonnet-4',
   *     permissionMode: 'default',
   *     includePartialMessages: false,
   *     settingSources: ['.claude/'],
   *     cwd: '/home/user/project',
   *     allowedTools: ['Read', 'Write', 'Bash']
   *   },
   *   prompt: {
   *     type: 'generator',
   *     message: {
   *       role: 'user',
   *       content: 'Review authentication code'
   *     }
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Start SDK call with MCP servers and custom tools
   * import { chatLogService } from './chat-log-service';
   *
   * const callId = 'call-uuid-2';
   *
   * await chatLogService.startSdkCall('chat-abc123', callId, 'msg-user-2', {
   *   options: {
   *     model: 'claude-sonnet-4',
   *     permissionMode: 'bypass',
   *     includePartialMessages: true,
   *     settingSources: ['.claude/', '.mcp.json'],
   *     cwd: '/project',
   *     allowedTools: ['*'], // All tools allowed
   *     resume: 'sdk-session-uuid' // Resume existing SDK session
   *   },
   *   prompt: {
   *     type: 'generator',
   *     message: {
   *       role: 'user',
   *       content: [
   *         { type: 'text', text: 'Analyze this image' },
   *         { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }
   *       ]
   *     }
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Complete SDK call lifecycle
   * import { chatLogService } from './chat-log-service';
   *
   * const callId = 'call-uuid-3';
   *
   * // 1. Start call
   * await chatLogService.startSdkCall('chat-abc123', callId, 'msg-user-3', {
   *   options: { model: 'claude-sonnet-4', ... },
   *   prompt: { type: 'generator', message: { ... } }
   * });
   *
   * // 2. Add streaming events (called by SDK integration)
   * await chatLogService.addSdkEvent('chat-abc123', callId, {
   *   timestamp: '2024-01-01T10:05:10.000Z',
   *   type: 'assistant_message',
   *   category: 'assistant_message',
   *   details: { messageType: 'text', hasText: true },
   *   data: { message: { role: 'assistant', content: '...' } }
   * });
   *
   * // 3. Complete call
   * await chatLogService.completeSdkCall('chat-abc123', callId, 'msg-assistant-3', {
   *   cost: 0.0025,
   *   usage: { input_tokens: 1500, output_tokens: 800 }
   * });
   * ```
   *
   * @see addSdkEvent for appending streaming events
   * @see completeSdkCall for finalizing SDK call
   * @see ClaudeSdkService for SDK integration
   */
  async startSdkCall(
    sessionDocId: string,
    callId: string,
    userMessageId: string,
    request: SdkCallLog['request']
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Add SDK call
      const sdkCall: SdkCallLog = {
        callId,
        userMessageId,
        timestamp: new Date().toISOString(),
        request,
        events: [],
      };

      chatLog.sdkCalls.push(sdkCall);
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK call started in log', {
        sessionId: sessionDocId,
        callId,
      });
    } catch (error) {
      this.logger.error('Failed to start SDK call log', error, {
        sessionId: sessionDocId,
        callId,
      });
    }
  }

  /**
   * Add SDK event to call log
   *
   * @description
   * Appends a streaming event from the Claude SDK to an active SDK call's events array.
   * SDK events include assistant messages, text deltas, tool uses, results, errors, and
   * system messages. Events are logged in chronological order to create a complete audit
   * trail of the SDK conversation flow.
   *
   * **Workflow:**
   * 1. Read existing log file from filesystem
   * 2. Find SdkCallLog by callId in sdkCalls array
   * 3. Append event to call's events array
   * 4. Update updatedAt timestamp
   * 5. Write updated log back to filesystem
   *
   * **Event Types:**
   * - `assistant_message`: Text/tool use responses from Claude
   * - `text_delta`: Streaming text chunks during generation
   * - `tool_use`: Tool execution requests (Read, Write, Bash, etc.)
   * - `result`: Final response with usage metrics
   * - `error`: SDK errors and failures
   * - `system`: System messages and status updates
   *
   * **Event Structure:**
   * - `timestamp`: ISO 8601 timestamp
   * - `type`: Event type (assistant_message, text_delta, etc.)
   * - `category`: Event category for grouping/filtering
   * - `details`: Structured metadata (messageType, tools, permissionMode, etc.)
   * - `data`: Raw event data from SDK
   *
   * **Error Handling:**
   * - Returns silently if log file or SDK call doesn't exist
   * - Logs warnings but doesn't throw (graceful degradation)
   * - SDK functionality continues even if logging fails
   *
   * @param sessionDocId - Strapi document ID of the chat session
   * @param callId - Unique identifier of the SDK call to append event to
   * @param event - SDK event log entry with timestamp, type, category, details, data
   *
   * @returns Promise that resolves when event is appended to log
   *
   * @example
   * ```typescript
   * // Log assistant message event
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.addSdkEvent('chat-abc123', 'call-uuid-1', {
   *   timestamp: '2024-01-01T10:05:10.000Z',
   *   type: 'assistant_message',
   *   category: 'assistant_message',
   *   details: {
   *     messageType: 'text',
   *     hasText: true,
   *     textLength: 250
   *   },
   *   data: {
   *     message: {
   *       role: 'assistant',
   *       content: 'The code looks good. I suggest...'
   *     }
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Log text delta event (streaming)
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.addSdkEvent('chat-abc123', 'call-uuid-1', {
   *   timestamp: '2024-01-01T10:05:11.500Z',
   *   type: 'text_delta',
   *   category: 'text_delta',
   *   details: {
   *     deltaLength: 15,
   *     accumulatedLength: 265
   *   },
   *   data: {
   *     delta: ' adding tests.'
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Log tool use event
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.addSdkEvent('chat-abc123', 'call-uuid-1', {
   *   timestamp: '2024-01-01T10:05:15.000Z',
   *   type: 'tool_use',
   *   category: 'assistant_message',
   *   details: {
   *     messageType: 'tool_use',
   *     hasToolUse: true,
   *     toolCount: 1,
   *     tools: ['Read']
   *   },
   *   data: {
   *     tool: {
   *       name: 'Read',
   *       input: { file_path: 'src/auth.ts' }
   *     }
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Log result event with usage metrics
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.addSdkEvent('chat-abc123', 'call-uuid-1', {
   *   timestamp: '2024-01-01T10:05:30.000Z',
   *   type: 'result',
   *   category: 'result',
   *   details: {
   *     numTurns: 3,
   *     totalCost: 0.0025,
   *     duration: 20000
   *   },
   *   data: {
   *     usage: {
   *       input_tokens: 1500,
   *       output_tokens: 800,
   *       cache_creation_input_tokens: 200,
   *       cache_read_input_tokens: 300
   *     }
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Log error event
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.addSdkEvent('chat-abc123', 'call-uuid-1', {
   *   timestamp: '2024-01-01T10:05:35.000Z',
   *   type: 'error',
   *   category: 'system',
   *   details: {
   *     isError: true,
   *     errorType: 'permission_denied'
   *   },
   *   data: {
   *     error: {
   *       message: 'Tool execution blocked by permission mode',
   *       code: 'PERMISSION_DENIED'
   *     }
   *   }
   * });
   * ```
   *
   * @see startSdkCall for initiating SDK call logging
   * @see completeSdkCall for finalizing SDK call
   * @see ClaudeSdkService for SDK integration details
   */
  async addSdkEvent(
    sessionDocId: string,
    callId: string,
    event: SdkEventLog
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Find SDK call
      const sdkCall = chatLog.sdkCalls.find(call => call.callId === callId);
      if (!sdkCall) {
        this.logger.warn('SDK call not found in log', { sessionId: sessionDocId, callId });
        return;
      }

      // Add event
      sdkCall.events.push(event);
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK event added to log', {
        sessionId: sessionDocId,
        callId,
        eventType: event.type,
      });
    } catch (error) {
      this.logger.error('Failed to add SDK event to log', error, {
        sessionId: sessionDocId,
        callId,
      });
    }
  }

  /**
   * Complete SDK call with final result
   *
   * @description
   * Finalizes an SDK call by recording the assistant message ID and final result metadata
   * (cost, token usage). This completes the SDK call lifecycle that started with startSdkCall()
   * and had events appended via addSdkEvent(). The final result provides aggregate metrics
   * for the entire conversation turn.
   *
   * **Workflow:**
   * 1. Read existing log file from filesystem
   * 2. Find SdkCallLog by callId in sdkCalls array
   * 3. Update assistantMessageId to link SDK call to assistant message
   * 4. Set finalResult with cost and usage metrics
   * 5. Update updatedAt timestamp
   * 6. Write updated log back to filesystem
   *
   * **SDK Call Lifecycle:**
   * 1. `startSdkCall()` - Initialize SDK call log with request details
   * 2. `addSdkEvent()` - Append streaming events (0+ events)
   * 3. `completeSdkCall()` - Finalize with assistant message ID and result metadata
   *
   * **Final Result Metadata:**
   * - `cost`: Total cost in USD for the conversation turn (calculated from usage)
   * - `usage`: Token usage breakdown (input_tokens, output_tokens, cache_*_tokens)
   *
   * **Error Handling:**
   * - Returns silently if log file or SDK call doesn't exist
   * - Logs warnings but doesn't throw (graceful degradation)
   * - SDK functionality continues even if logging fails
   *
   * @param sessionDocId - Strapi document ID of the chat session
   * @param callId - Unique identifier of the SDK call to complete
   * @param assistantMessageId - Document ID of the assistant message generated by this call
   * @param finalResult - Optional final result with cost and usage metrics
   *
   * @returns Promise that resolves when SDK call is completed
   *
   * @example
   * ```typescript
   * // Complete SDK call with full usage metrics
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.completeSdkCall(
   *   'chat-abc123',
   *   'call-uuid-1',
   *   'msg-assistant-1',
   *   {
   *     cost: 0.0025,
   *     usage: {
   *       input_tokens: 1500,
   *       output_tokens: 800,
   *       cache_creation_input_tokens: 200,
   *       cache_read_input_tokens: 300
   *     }
   *   }
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Complete SDK call without usage metrics (error case)
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.completeSdkCall(
   *   'chat-abc123',
   *   'call-uuid-2',
   *   'msg-assistant-2'
   *   // No finalResult - SDK call may have failed or been cancelled
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Complete SDK call lifecycle
   * import { chatLogService } from './chat-log-service';
   *
   * const callId = 'call-uuid-3';
   *
   * // 1. Start SDK call
   * await chatLogService.startSdkCall('chat-abc123', callId, 'msg-user-1', {
   *   options: {
   *     model: 'claude-sonnet-4',
   *     permissionMode: 'default',
   *     cwd: '/project'
   *   },
   *   prompt: {
   *     type: 'generator',
   *     message: { role: 'user', content: 'Hello' }
   *   }
   * });
   *
   * // 2. Add streaming events (simulated)
   * await chatLogService.addSdkEvent('chat-abc123', callId, {
   *   timestamp: '2024-01-01T10:05:10.000Z',
   *   type: 'assistant_message',
   *   category: 'assistant_message',
   *   details: { messageType: 'text', hasText: true },
   *   data: { message: { role: 'assistant', content: 'Hi there!' } }
   * });
   *
   * // 3. Complete SDK call
   * await chatLogService.completeSdkCall('chat-abc123', callId, 'msg-assistant-1', {
   *   cost: 0.0008,
   *   usage: { input_tokens: 100, output_tokens: 50 }
   * });
   *
   * // SDK call is now fully logged with request, events, and result
   * ```
   *
   * @example
   * ```typescript
   * // Retrieve completed SDK call from log
   * import { chatLogService } from './chat-log-service';
   *
   * const log = await chatLogService.getChatLog('chat-abc123');
   * const sdkCall = log.sdkCalls.find(call => call.callId === 'call-uuid-1');
   *
   * console.log('User message:', sdkCall.userMessageId);
   * console.log('Assistant message:', sdkCall.assistantMessageId);
   * console.log('Events:', sdkCall.events.length);
   * console.log('Cost:', sdkCall.finalResult?.cost);
   * console.log('Tokens:', sdkCall.finalResult?.usage);
   * ```
   *
   * @see startSdkCall for initiating SDK call logging
   * @see addSdkEvent for appending streaming events
   * @see getChatLog for retrieving complete log data
   */
  async completeSdkCall(
    sessionDocId: string,
    callId: string,
    assistantMessageId: string,
    finalResult?: { cost?: number; usage?: any }
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Find SDK call
      const sdkCall = chatLog.sdkCalls.find(call => call.callId === callId);
      if (!sdkCall) {
        this.logger.warn('SDK call not found in log', { sessionId: sessionDocId, callId });
        return;
      }

      // Update SDK call
      sdkCall.assistantMessageId = assistantMessageId;
      sdkCall.finalResult = finalResult;
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK call completed in log', {
        sessionId: sessionDocId,
        callId,
        assistantMessageId,
      });
    } catch (error) {
      this.logger.error('Failed to complete SDK call log', error, {
        sessionId: sessionDocId,
        callId,
      });
    }
  }

  /**
   * Delete chat log
   *
   * @description
   * Permanently deletes the chat log file from the filesystem. This is called when a chat
   * session is permanently deleted from Strapi. Unlike updateSessionStatus('archived') which
   * is a soft delete, this method performs a hard delete and is irreversible.
   *
   * **Workflow:**
   * 1. Generate log file path from session documentId
   * 2. Delete log file using fs.unlink()
   * 3. Log success or failure
   *
   * **Important Notes:**
   * - This is a PERMANENT deletion - the log file cannot be recovered
   * - Should be called when deleting session from Strapi to maintain consistency
   * - Prefer archiving (updateSessionStatus) over deletion for data retention
   * - Deletion failures are logged but don't throw errors (graceful degradation)
   *
   * **Data Loss Warning:**
   * Deleting a log file removes all:
   * - Chat messages and timestamps
   * - SDK call logs and events
   * - Cost and usage metrics
   * - Session metadata
   * - Audit trail for compliance
   *
   * **Error Handling:**
   * - Logs errors as warnings but doesn't throw
   * - Returns silently if log file doesn't exist (idempotent)
   * - Session deletion continues even if log deletion fails
   *
   * @param sessionDocId - Strapi document ID of the chat session
   *
   * @returns Promise that resolves when log file is deleted
   *
   * @example
   * ```typescript
   * // Delete chat log (permanent)
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.deleteChatLog('chat-abc123');
   * // Log file logs/chat/chat-abc123.json is permanently deleted
   * ```
   *
   * @example
   * ```typescript
   * // Delete session workflow (Strapi + log file)
   * import { chatLogService } from './chat-log-service';
   * import { chatService } from './chat-service';
   *
   * const sessionDocId = 'chat-abc123';
   *
   * // Delete session from Strapi
   * await chatService.deleteChatSession(sessionDocId);
   *
   * // Delete log file from filesystem
   * await chatLogService.deleteChatLog(sessionDocId);
   *
   * console.log('Session and log permanently deleted');
   * ```
   *
   * @example
   * ```typescript
   * // Archive vs Delete - prefer archiving for data retention
   * import { chatLogService } from './chat-log-service';
   *
   * // RECOMMENDED: Archive session (soft delete, reversible)
   * await chatLogService.updateSessionStatus('chat-abc123', 'archived');
   * // Log file still exists, can be retrieved later
   *
   * // NOT RECOMMENDED: Delete session (hard delete, irreversible)
   * await chatLogService.deleteChatLog('chat-abc123');
   * // Log file permanently deleted, cannot be recovered
   * ```
   *
   * @example
   * ```typescript
   * // Bulk delete old archived sessions (cleanup)
   * import { chatLogService } from './chat-log-service';
   *
   * const allLogs = await chatLogService.listChatLogs();
   * const cutoffDate = new Date('2024-01-01');
   *
   * // Find old archived sessions
   * const oldArchivedLogs = allLogs.filter(log =>
   *   log.status === 'archived' &&
   *   new Date(log.updatedAt) < cutoffDate
   * );
   *
   * // Delete old archived logs (permanent cleanup)
   * for (const log of oldArchivedLogs) {
   *   await chatLogService.deleteChatLog(log.sessionDocumentId);
   * }
   *
   * console.log(`Deleted ${oldArchivedLogs.length} old archived logs`);
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent deletion - safe to call multiple times
   * import { chatLogService } from './chat-log-service';
   *
   * await chatLogService.deleteChatLog('chat-abc123');
   * await chatLogService.deleteChatLog('chat-abc123'); // No error, returns silently
   * ```
   *
   * @see updateSessionStatus for soft delete (archiving)
   * @see ChatService.deleteChatSession for deleting sessions from Strapi
   * @see initChatLog for creating log files
   */
  async deleteChatLog(sessionDocId: string): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);
      await fs.unlink(logPath);

      this.logger.info('Chat log deleted', { sessionId: sessionDocId });
    } catch (error) {
      this.logger.error('Failed to delete chat log', error, {
        sessionId: sessionDocId,
      });
    }
  }

  /**
   * List all chat logs
   */
  async listChatLogs(): Promise<ChatLog[]> {
    try {
      const files = await fs.readdir(this.logsDir);
      const chatLogFiles = files.filter(f => f.startsWith('chat-') && f.endsWith('.json'));

      const logs: ChatLog[] = [];
      for (const file of chatLogFiles) {
        try {
          const content = await fs.readFile(path.join(this.logsDir, file), 'utf-8');
          logs.push(JSON.parse(content));
        } catch (error) {
          this.logger.warn('Failed to read chat log file', error, { file });
        }
      }

      return logs.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      this.logger.error('Failed to list chat logs', error);
      return [];
    }
  }
}

// Export singleton instance
export const chatLogService = new ChatLogService();
