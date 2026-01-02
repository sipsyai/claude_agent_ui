import { EventEmitter } from 'events';
import { createLogger, type Logger } from './logger.js';
import { ConversationSummary, ConversationMessage, ConversationDetailsResponse } from '@/types/index.js';

/**
 * Context data stored for active conversations that have not yet been written to local directories
 *
 * @description
 * This interface defines the conversation context stored in-memory for active streaming sessions
 * that haven't been persisted to the Claude history directory yet. It enables optimistic UI updates
 * by providing conversation metadata immediately after a session starts, before SDK writes history files.
 *
 * @property {string} initialPrompt - The first user message that started this conversation
 * @property {string} workingDirectory - Absolute path to the project working directory
 * @property {string} model - Claude model used for this conversation (e.g., 'claude-sonnet-4')
 * @property {string} timestamp - ISO 8601 timestamp when the conversation was created
 * @property {ConversationMessage[]} [inheritedMessages] - Messages from previous session when resuming a conversation
 *
 * @example
 * ```typescript
 * // Basic context for new conversation
 * const context: ConversationStatusContext = {
 *   initialPrompt: 'Help me refactor this authentication code',
 *   workingDirectory: '/Users/dev/my-project',
 *   model: 'claude-sonnet-4',
 *   timestamp: '2024-01-15T10:30:00.000Z'
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Context for resumed conversation with inherited messages
 * const context: ConversationStatusContext = {
 *   initialPrompt: 'Continue working on the database migration',
 *   workingDirectory: '/Users/dev/my-project',
 *   model: 'claude-sonnet-4',
 *   timestamp: '2024-01-15T14:30:00.000Z',
 *   inheritedMessages: [
 *     {
 *       uuid: 'msg-1',
 *       type: 'user',
 *       message: { role: 'user', content: 'Create a database migration' },
 *       timestamp: '2024-01-15T10:00:00.000Z',
 *       sessionId: 'previous-session-id',
 *       cwd: '/Users/dev/my-project'
 *     },
 *     {
 *       uuid: 'msg-2',
 *       type: 'assistant',
 *       message: { role: 'assistant', content: 'I created the migration...' },
 *       timestamp: '2024-01-15T10:01:00.000Z',
 *       sessionId: 'previous-session-id',
 *       cwd: '/Users/dev/my-project'
 *     }
 *   ]
 * };
 * ```
 */
export interface ConversationStatusContext {
  initialPrompt: string;
  workingDirectory: string;
  model: string;
  timestamp: string;
  inheritedMessages?: ConversationMessage[]; // Messages from previous session when resuming
}

/**
 * ConversationStatusManager - Unified service for managing conversation status and active session tracking
 *
 * @description
 * The ConversationStatusManager is a critical service that bridges the gap between streaming conversations
 * and persisted conversation history. It tracks active streaming sessions in-memory and provides optimistic
 * UI updates before Claude SDK writes conversation files to disk. This enables immediate UI feedback and
 * seamless conversation list updates without polling the filesystem.
 *
 * **Key Responsibilities:**
 * - Track active streaming sessions with bidirectional Claude session ID ↔ streaming ID mapping
 * - Store conversation context (initial prompt, model, working directory) for active sessions
 * - Generate optimistic conversation summaries for sessions not yet in history files
 * - Provide conversation details for active sessions to support real-time UI updates
 * - Emit lifecycle events ('session-started', 'session-ended') for UI synchronization
 * - Manage session cleanup when conversations complete or are cancelled
 *
 * **Architecture:**
 * - **EventEmitter Pattern**: Extends Node.js EventEmitter to broadcast session lifecycle events
 * - **Bidirectional Mapping**: Maintains two synchronized Maps for Claude session ID ↔ streaming ID lookup
 * - **In-Memory Context Store**: Stores conversation metadata for active sessions not yet persisted to disk
 * - **Optimistic UI Support**: Generates conversation summaries/details before history files exist
 * - **Automatic Cleanup**: Removes mappings and context when sessions end or are cancelled
 *
 * **Session Lifecycle:**
 * The service manages a complete session lifecycle from start to finish:
 *
 * 1. **Session Started**: Client initiates conversation via ChatService.sendMessage()
 * 2. **Register Session**: ChatService calls registerActiveSession() when SDK emits session_id
 * 3. **Store Context**: Service stores initial prompt, model, working directory, timestamp
 * 4. **Emit Event**: Emits 'session-started' event with streamingId and claudeSessionId
 * 5. **Optimistic Updates**: UI immediately shows conversation in list (before history file exists)
 * 6. **Stream Messages**: Conversation proceeds with real-time message streaming
 * 7. **Session Ended**: Stream completes successfully, errors, or is cancelled
 * 8. **Unregister Session**: ChatService calls unregisterActiveSession() to cleanup
 * 9. **Emit Event**: Emits 'session-ended' event for UI to refresh from history files
 * 10. **Cleanup**: Removes all mappings and context from in-memory stores
 *
 * **Bidirectional Mapping Strategy:**
 * The service maintains two synchronized Maps to enable fast lookups in both directions:
 * - `sessionToStreaming`: Map<claudeSessionId, streamingId> - Lookup streaming ID by Claude session ID
 * - `streamingToSession`: Map<streamingId, claudeSessionId> - Lookup Claude session ID by streaming ID
 * - Both maps are updated atomically during registration/unregistration
 * - Old mappings are automatically cleaned up when sessions are re-registered
 *
 * **Optimistic UI Patterns:**
 * The service enables several optimistic UI patterns to improve perceived performance:
 *
 * 1. **Instant Conversation List**: Show new conversation in list immediately after user sends message
 * 2. **Real-Time Status**: Display 'ongoing' status badge for active streaming conversations
 * 3. **Inherited Message Preview**: Show previous conversation messages when resuming
 * 4. **Graceful Transition**: Auto-refresh from history files when session completes
 * 5. **Streaming Indicator**: Link conversation to active stream for real-time status updates
 *
 * **EventEmitter Events:**
 * The service emits two lifecycle events for UI synchronization:
 *
 * - **session-started**: Emitted when registerActiveSession() is called
 *   - Payload: { streamingId: string, claudeSessionId: string }
 *   - Use case: UI adds conversation to list with 'ongoing' status
 *
 * - **session-ended**: Emitted when unregisterActiveSession() is called
 *   - Payload: { streamingId: string, claudeSessionId: string }
 *   - Use case: UI refreshes conversation list from history files
 *
 * **Integration with ChatService:**
 * ChatService uses ConversationStatusManager to provide optimistic UI updates:
 * 1. ChatService.sendMessage() calls registerActiveSession() when SDK emits session_id
 * 2. Service stores conversation context (prompt, model, working directory)
 * 3. Conversation list endpoint queries getConversationsNotInHistory() for active sessions
 * 4. Conversation details endpoint queries getActiveConversationDetails() for ongoing chats
 * 5. ChatService calls unregisterActiveSession() in finally block when stream ends
 *
 * @example
 * ```typescript
 * // Basic usage - register and unregister session
 * import { ConversationStatusManager } from './conversation-status-manager';
 *
 * const statusManager = new ConversationStatusManager();
 *
 * // Listen for lifecycle events
 * statusManager.on('session-started', ({ streamingId, claudeSessionId }) => {
 *   console.log(`Session started: ${claudeSessionId} (stream: ${streamingId})`);
 *   // Update UI to show new conversation with 'ongoing' status
 * });
 *
 * statusManager.on('session-ended', ({ streamingId, claudeSessionId }) => {
 *   console.log(`Session ended: ${claudeSessionId} (stream: ${streamingId})`);
 *   // Refresh UI from history files
 * });
 *
 * // Register session when stream starts
 * const streamingId = 'stream-uuid-123';
 * const claudeSessionId = 'session-abc-456';
 * const context = {
 *   initialPrompt: 'Help me debug this code',
 *   workingDirectory: '/Users/dev/my-project',
 *   model: 'claude-sonnet-4'
 * };
 *
 * statusManager.registerActiveSession(streamingId, claudeSessionId, context);
 *
 * // Later, when stream completes...
 * statusManager.unregisterActiveSession(streamingId);
 * ```
 *
 * @example
 * ```typescript
 * // Optimistic UI pattern - conversation list with active sessions
 * import { ConversationStatusManager } from './conversation-status-manager';
 * import { claudeHistoryReader } from './claude-history-reader';
 *
 * const statusManager = new ConversationStatusManager();
 *
 * // Get conversation list (combines history files + active sessions)
 * async function getConversationList(): Promise<ConversationSummary[]> {
 *   // 1. Read persisted conversations from history files
 *   const historySummaries = await claudeHistoryReader.getConversationList('/Users/dev/my-project');
 *   const existingSessionIds = new Set(historySummaries.map(s => s.sessionId));
 *
 *   // 2. Get active sessions not yet in history
 *   const activeSummaries = statusManager.getConversationsNotInHistory(existingSessionIds);
 *
 *   // 3. Combine and sort by newest first
 *   const allSummaries = [...activeSummaries, ...historySummaries];
 *   allSummaries.sort((a, b) =>
 *     new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
 *   );
 *
 *   return allSummaries;
 *   // Active sessions show status='ongoing', streamingId populated
 *   // Completed sessions show status='completed', streamingId=undefined
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Optimistic UI pattern - conversation details with active session
 * import { ConversationStatusManager } from './conversation-status-manager';
 * import { claudeHistoryReader } from './claude-history-reader';
 *
 * const statusManager = new ConversationStatusManager();
 *
 * // Get conversation details (try active session first, fallback to history)
 * async function getConversationDetails(sessionId: string): Promise<ConversationDetailsResponse> {
 *   // 1. Check if session is active (optimistic path)
 *   const activeDetails = statusManager.getActiveConversationDetails(sessionId);
 *   if (activeDetails) {
 *     return activeDetails;
 *     // Returns initial user message + any inherited messages
 *     // Assistant response will stream in real-time via separate endpoint
 *   }
 *
 *   // 2. Fallback to reading from history files
 *   const historyDetails = await claudeHistoryReader.getConversationDetails(sessionId);
 *   return historyDetails;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Session lifecycle with inherited messages (resume conversation)
 * import { ConversationStatusManager } from './conversation-status-manager';
 *
 * const statusManager = new ConversationStatusManager();
 *
 * // User resumes a previous conversation
 * const previousMessages: ConversationMessage[] = [
 *   {
 *     uuid: 'msg-1',
 *     type: 'user',
 *     message: { role: 'user', content: 'Create an API endpoint for users' },
 *     timestamp: '2024-01-15T10:00:00.000Z',
 *     sessionId: 'old-session-id',
 *     cwd: '/Users/dev/my-project'
 *   },
 *   {
 *     uuid: 'msg-2',
 *     type: 'assistant',
 *     message: { role: 'assistant', content: 'I created the endpoint...' },
 *     timestamp: '2024-01-15T10:01:00.000Z',
 *     sessionId: 'old-session-id',
 *     cwd: '/Users/dev/my-project'
 *   }
 * ];
 *
 * // Register new session with inherited messages
 * statusManager.registerActiveSession(
 *   'stream-uuid-new',
 *   'session-new-id',
 *   {
 *     initialPrompt: 'Now add authentication to the endpoint',
 *     workingDirectory: '/Users/dev/my-project',
 *     model: 'claude-sonnet-4',
 *     inheritedMessages: previousMessages
 *   }
 * );
 *
 * // Get conversation details - includes both old and new messages
 * const details = statusManager.getActiveConversationDetails('session-new-id');
 * console.log(details?.messages.length); // 3 (2 inherited + 1 new user message)
 * ```
 *
 * @example
 * ```typescript
 * // Real-time UI synchronization with lifecycle events
 * import { ConversationStatusManager } from './conversation-status-manager';
 *
 * const statusManager = new ConversationStatusManager();
 *
 * // WebSocket handler for real-time UI updates
 * class ConversationListWebSocket {
 *   private clients: Set<WebSocket> = new Set();
 *
 *   constructor(statusManager: ConversationStatusManager) {
 *     // When session starts, notify all clients to add conversation
 *     statusManager.on('session-started', async ({ claudeSessionId }) => {
 *       const summary = statusManager.getConversationsNotInHistory(new Set())[0];
 *       this.broadcast({ type: 'conversation:added', summary });
 *     });
 *
 *     // When session ends, notify all clients to refresh from history
 *     statusManager.on('session-ended', async ({ claudeSessionId }) => {
 *       this.broadcast({ type: 'conversation:completed', sessionId: claudeSessionId });
 *     });
 *   }
 *
 *   broadcast(data: any) {
 *     this.clients.forEach(client => client.send(JSON.stringify(data)));
 *   }
 * }
 * ```
 *
 * @see {@link ConversationStatusContext} - Context data stored for active conversations
 * @see ChatService - Uses ConversationStatusManager for optimistic UI updates
 * @see ClaudeHistoryReader - Reads persisted conversations from history files
 */
export class ConversationStatusManager extends EventEmitter {
  // Maps Claude session ID -> CUI streaming ID
  private sessionToStreaming: Map<string, string> = new Map();
  // Maps CUI streaming ID -> Claude session ID (reverse lookup)
  private streamingToSession: Map<string, string> = new Map();
  // Maps Claude session ID -> conversation context for active sessions
  private sessionContext: Map<string, ConversationStatusContext> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = createLogger('ConversationStatusManager');
  }

  /**
   * Register a new active streaming session with optional conversation context
   *
   * @description
   * This method is called when ChatService receives the session_id from Claude SDK during message streaming.
   * It establishes bidirectional mapping between the internal streaming ID and Claude's session ID, stores
   * conversation context for optimistic UI updates, and emits a 'session-started' event for UI synchronization.
   *
   * **Workflow:**
   * 1. Clean up any existing mappings for the provided Claude session ID or streaming ID
   * 2. Create bidirectional mapping: claudeSessionId ↔ streamingId
   * 3. If conversation context provided, store it with auto-generated timestamp
   * 4. Emit 'session-started' event with { streamingId, claudeSessionId }
   * 5. Log registration details for debugging
   *
   * **When to Call:**
   * - ChatService.sendMessage() calls this when SDK emits the first 'session_id' event
   * - Should be called exactly once per conversation (re-registration overwrites existing mappings)
   * - Must be called before getConversationsNotInHistory() or getActiveConversationDetails()
   *
   * **Context Storage:**
   * The conversationContext parameter is optional but recommended for optimistic UI support:
   * - **Without context**: Only bidirectional mapping is stored (session tracking only)
   * - **With context**: Full conversation metadata stored (enables optimistic summaries/details)
   *
   * **Cleanup Strategy:**
   * If either the claudeSessionId or streamingId is already registered to a different ID,
   * the old mapping is automatically removed to prevent orphaned entries.
   *
   * @param {string} streamingId - Internal UUID for the streaming session (generated by ChatService)
   * @param {string} claudeSessionId - Claude SDK session ID (extracted from SDK stream)
   * @param {object} [conversationContext] - Optional conversation metadata for optimistic UI
   * @param {string} conversationContext.initialPrompt - First user message that started the conversation
   * @param {string} conversationContext.workingDirectory - Project working directory path
   * @param {string} [conversationContext.model] - Claude model name (defaults to 'default')
   * @param {ConversationMessage[]} [conversationContext.inheritedMessages] - Messages from previous session when resuming
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Basic registration - session tracking only (no optimistic UI)
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * const streamingId = 'stream-uuid-123';
   * const claudeSessionId = 'session-abc-456';
   *
   * conversationStatusManager.registerActiveSession(streamingId, claudeSessionId);
   * // Result: Bidirectional mapping created, no context stored
   * // Use case: Tracking active sessions without showing in conversation list
   * ```
   *
   * @example
   * ```typescript
   * // Full registration with context - enables optimistic UI
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * const streamingId = 'stream-uuid-123';
   * const claudeSessionId = 'session-abc-456';
   * const context = {
   *   initialPrompt: 'Help me refactor this authentication code',
   *   workingDirectory: '/Users/dev/my-project',
   *   model: 'claude-sonnet-4'
   * };
   *
   * conversationStatusManager.registerActiveSession(streamingId, claudeSessionId, context);
   * // Result: Mapping + context stored, conversation appears in list immediately
   * // Use case: Standard workflow for optimistic UI updates
   * ```
   *
   * @example
   * ```typescript
   * // ChatService integration - typical usage pattern
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * class ChatService {
   *   async *sendMessage(sessionDocId: string, message: string, ...) {
   *     const streamingId = uuidv4();
   *     let claudeSessionId: string | undefined;
   *
   *     try {
   *       // Save user message
   *       yield { type: 'user_message_saved', ... };
   *
   *       // Start SDK stream
   *       for await (const event of sdkQuery.stream()) {
   *         if (event.type === 'session_id') {
   *           claudeSessionId = event.sessionId;
   *
   *           // Register session with context for optimistic UI
   *           conversationStatusManager.registerActiveSession(
   *             streamingId,
   *             claudeSessionId,
   *             {
   *               initialPrompt: message,
   *               workingDirectory: chatSession.workingDirectory,
   *               model: chatSession.agent?.modelConfig?.model || 'claude-sonnet-4'
   *             }
   *           );
   *
   *           yield { type: 'stream_id', streamId: streamingId };
   *         }
   *         // ... handle other events
   *       }
   *     } finally {
   *       // Cleanup in unregisterActiveSession()
   *     }
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Resume conversation with inherited messages
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { claudeHistoryReader } from './claude-history-reader';
   *
   * async function resumeConversation(previousSessionId: string, newMessage: string) {
   *   // 1. Load previous conversation messages
   *   const previousDetails = await claudeHistoryReader.getConversationDetails(previousSessionId);
   *
   *   // 2. Start new streaming session
   *   const streamingId = 'stream-uuid-new';
   *   const claudeSessionId = 'session-new-id'; // From SDK
   *
   *   // 3. Register with inherited messages for context continuity
   *   conversationStatusManager.registerActiveSession(
   *     streamingId,
   *     claudeSessionId,
   *     {
   *       initialPrompt: newMessage,
   *       workingDirectory: previousDetails.projectPath,
   *       model: previousDetails.metadata.model,
   *       inheritedMessages: previousDetails.messages // Include previous conversation
   *     }
   *   );
   *
   *   // UI now shows all messages: [...previousDetails.messages, newUserMessage]
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Automatic cleanup of old mappings
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * // First registration
   * conversationStatusManager.registerActiveSession('stream-1', 'session-abc');
   *
   * // Re-register same Claude session with different stream ID
   * conversationStatusManager.registerActiveSession('stream-2', 'session-abc', context);
   * // Old mapping 'stream-1' -> 'session-abc' is automatically removed
   * // New mapping 'stream-2' -> 'session-abc' is created
   * // Prevents orphaned entries when sessions are reused
   * ```
   *
   * @example
   * ```typescript
   * // Listen for session-started events
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * conversationStatusManager.on('session-started', ({ streamingId, claudeSessionId }) => {
   *   console.log(`New conversation started: ${claudeSessionId}`);
   *   console.log(`Stream ID: ${streamingId}`);
   *
   *   // Update UI: Add conversation to list with 'ongoing' status
   *   addConversationToUI({
   *     sessionId: claudeSessionId,
   *     streamId: streamingId,
   *     status: 'ongoing'
   *   });
   * });
   *
   * conversationStatusManager.registerActiveSession('stream-123', 'session-abc', context);
   * // Triggers 'session-started' event
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - registration without context
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * conversationStatusManager.registerActiveSession('stream-123', 'session-abc');
   * // Only mapping is stored, no context
   *
   * const context = conversationStatusManager.getConversationContext('session-abc');
   * console.log(context); // undefined
   *
   * const summaries = conversationStatusManager.getConversationsNotInHistory(new Set());
   * console.log(summaries); // [] (empty - no context means no summary)
   *
   * // Best practice: Always provide context for optimistic UI support
   * ```
   *
   * @see {@link unregisterActiveSession} - Cleanup method called when session ends
   * @see {@link getConversationContext} - Retrieve stored context for a session
   * @see {@link getConversationsNotInHistory} - Get optimistic conversation summaries
   * @see {@link getActiveConversationDetails} - Get optimistic conversation details
   */
  registerActiveSession(streamingId: string, claudeSessionId: string, conversationContext?: { initialPrompt: string; workingDirectory: string; model?: string; inheritedMessages?: ConversationMessage[] }): void {
    this.logger.debug('Registering active session', { 
      streamingId, 
      claudeSessionId,
      hasConversationContext: !!conversationContext
    });

    // Remove any existing mapping for this Claude session
    const existingStreamingId = this.sessionToStreaming.get(claudeSessionId);
    if (existingStreamingId && existingStreamingId !== streamingId) {
      this.logger.debug('Removing existing mapping for Claude session', { 
        claudeSessionId, 
        oldStreamingId: existingStreamingId,
        newStreamingId: streamingId
      });
      this.streamingToSession.delete(existingStreamingId);
    }

    // Remove any existing mapping for this streaming ID
    const existingClaudeSessionId = this.streamingToSession.get(streamingId);
    if (existingClaudeSessionId && existingClaudeSessionId !== claudeSessionId) {
      this.logger.debug('Removing existing mapping for streaming ID', { 
        streamingId, 
        oldClaudeSessionId: existingClaudeSessionId,
        newClaudeSessionId: claudeSessionId
      });
      this.sessionToStreaming.delete(existingClaudeSessionId);
      this.sessionContext.delete(existingClaudeSessionId);
    }

    // Set the new mapping
    this.sessionToStreaming.set(claudeSessionId, streamingId);
    this.streamingToSession.set(streamingId, claudeSessionId);

    // If conversation context is provided, store it immediately
    if (conversationContext) {
      const context: ConversationStatusContext = {
        initialPrompt: conversationContext.initialPrompt,
        workingDirectory: conversationContext.workingDirectory,
        model: conversationContext.model || 'default',
        timestamp: new Date().toISOString(),
        inheritedMessages: conversationContext.inheritedMessages
      };
      this.sessionContext.set(claudeSessionId, context);
      
      this.logger.debug('Stored conversation status context', {
        claudeSessionId,
        hasInitialPrompt: !!context.initialPrompt,
        workingDirectory: context.workingDirectory,
        model: context.model,
        inheritedMessageCount: context.inheritedMessages?.length || 0
      });
    }

    this.logger.debug('Active session registered', { 
      streamingId, 
      claudeSessionId,
      totalActiveSessions: this.sessionToStreaming.size,
      hasConversationContext: !!conversationContext
    });

    this.emit('session-started', { streamingId, claudeSessionId });
  }

  /**
   * Unregister an active streaming session when it ends
   *
   * @description
   * This method is called when a streaming conversation completes, errors, or is cancelled.
   * It removes all in-memory state for the session (bidirectional mappings and context),
   * emits a 'session-ended' event for UI synchronization, and cleans up resources.
   *
   * **Workflow:**
   * 1. Look up claudeSessionId from streamingId (reverse mapping)
   * 2. If found, remove both bidirectional mappings (sessionToStreaming, streamingToSession)
   * 3. Remove conversation context from sessionContext map
   * 4. Emit 'session-ended' event with { streamingId, claudeSessionId }
   * 5. Log unregistration details for debugging
   * 6. If streamingId not found, log warning (idempotent - safe to call multiple times)
   *
   * **When to Call:**
   * - ChatService.sendMessage() calls this in the finally block when stream ends
   * - Should be called exactly once per conversation (but safe to call multiple times)
   * - Must be called after stream completes/errors/is cancelled to prevent memory leaks
   *
   * **UI Synchronization:**
   * After unregistration, the UI should:
   * 1. Listen for 'session-ended' event
   * 2. Refresh conversation list from history files (conversation now persisted to disk)
   * 3. Update conversation status from 'ongoing' to 'completed'
   * 4. Remove streaming indicator from UI
   *
   * **Memory Safety:**
   * This method is critical for preventing memory leaks. If not called, sessions remain
   * in memory indefinitely. Always call in a finally block to ensure cleanup happens
   * even if stream errors or is cancelled.
   *
   * **Idempotent Behavior:**
   * Safe to call multiple times with the same streamingId. If already unregistered,
   * logs a debug message and returns without error.
   *
   * @param {string} streamingId - Internal UUID for the streaming session (same as used in registerActiveSession)
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Basic usage - unregister when stream completes
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * const streamingId = 'stream-uuid-123';
   *
   * // When stream completes...
   * conversationStatusManager.unregisterActiveSession(streamingId);
   * // Result: All mappings and context removed, 'session-ended' event emitted
   * ```
   *
   * @example
   * ```typescript
   * // ChatService integration - typical usage pattern
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * class ChatService {
   *   async *sendMessage(sessionDocId: string, message: string, ...) {
   *     const streamingId = uuidv4();
   *     let claudeSessionId: string | undefined;
   *
   *     try {
   *       // Start SDK stream
   *       for await (const event of sdkQuery.stream()) {
   *         if (event.type === 'session_id') {
   *           claudeSessionId = event.sessionId;
   *           conversationStatusManager.registerActiveSession(
   *             streamingId,
   *             claudeSessionId,
   *             context
   *           );
   *         }
   *         // ... handle other events
   *       }
   *     } catch (error) {
   *       // Error handling...
   *       throw error;
   *     } finally {
   *       // CRITICAL: Always cleanup in finally block
   *       // Ensures cleanup happens even if stream errors or is cancelled
   *       conversationStatusManager.unregisterActiveSession(streamingId);
   *     }
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Listen for session-ended events
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * conversationStatusManager.on('session-ended', async ({ streamingId, claudeSessionId }) => {
   *   console.log(`Conversation ended: ${claudeSessionId}`);
   *   console.log(`Stream ID: ${streamingId}`);
   *
   *   // Update UI: Refresh conversation from history files
   *   const historyDetails = await claudeHistoryReader.getConversationDetails(claudeSessionId);
   *   updateConversationInUI({
   *     sessionId: claudeSessionId,
   *     status: 'completed',
   *     messages: historyDetails.messages
   *   });
   * });
   *
   * conversationStatusManager.unregisterActiveSession('stream-123');
   * // Triggers 'session-ended' event
   * ```
   *
   * @example
   * ```typescript
   * // Graceful transition from optimistic to persisted state
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { claudeHistoryReader } from './claude-history-reader';
   *
   * async function handleSessionEnded(streamingId: string) {
   *   const claudeSessionId = conversationStatusManager.getSessionId(streamingId);
   *   if (!claudeSessionId) return;
   *
   *   // Before unregister: conversation shown via optimistic context
   *   const optimisticDetails = conversationStatusManager.getActiveConversationDetails(claudeSessionId);
   *   console.log('Optimistic messages:', optimisticDetails?.messages.length);
   *
   *   // Unregister session (cleanup in-memory state)
   *   conversationStatusManager.unregisterActiveSession(streamingId);
   *
   *   // After unregister: conversation shown via history files
   *   const persistedDetails = await claudeHistoryReader.getConversationDetails(claudeSessionId);
   *   console.log('Persisted messages:', persistedDetails.messages.length);
   *
   *   // UI seamlessly transitions from optimistic to persisted state
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Memory leak prevention - always cleanup
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * // ❌ BAD: No cleanup if error occurs
   * async function sendMessageBad(message: string) {
   *   const streamingId = uuidv4();
   *   conversationStatusManager.registerActiveSession(streamingId, sessionId, context);
   *   await streamMessages(); // Throws error
   *   conversationStatusManager.unregisterActiveSession(streamingId); // Never called!
   *   // Memory leak: session remains in memory indefinitely
   * }
   *
   * // ✅ GOOD: Cleanup in finally block
   * async function sendMessageGood(message: string) {
   *   const streamingId = uuidv4();
   *   try {
   *     conversationStatusManager.registerActiveSession(streamingId, sessionId, context);
   *     await streamMessages();
   *   } finally {
   *     conversationStatusManager.unregisterActiveSession(streamingId);
   *     // Always called, even if error occurs
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent behavior - safe to call multiple times
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * const streamingId = 'stream-uuid-123';
   *
   * conversationStatusManager.registerActiveSession(streamingId, 'session-abc', context);
   * console.log(conversationStatusManager.isSessionActive('session-abc')); // true
   *
   * // First unregister - removes session
   * conversationStatusManager.unregisterActiveSession(streamingId);
   * console.log(conversationStatusManager.isSessionActive('session-abc')); // false
   *
   * // Second unregister - safe, logs debug message
   * conversationStatusManager.unregisterActiveSession(streamingId);
   * // Logs: 'Attempted to unregister unknown streaming session'
   * // No error thrown - idempotent behavior
   * ```
   *
   * @example
   * ```typescript
   * // Stream cancellation workflow
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { chatService } from './chat-service';
   *
   * let currentStreamId: string | null = null;
   *
   * // Listen for session-ended after cancellation
   * conversationStatusManager.on('session-ended', ({ streamingId, claudeSessionId }) => {
   *   if (streamingId === currentStreamId) {
   *     console.log('Cancelled stream cleaned up');
   *     updateUI({ status: 'cancelled', sessionId: claudeSessionId });
   *   }
   * });
   *
   * // Start streaming
   * (async () => {
   *   for await (const event of chatService.sendMessage(...)) {
   *     if (event.type === 'stream_id') {
   *       currentStreamId = event.streamId;
   *     }
   *     if (event.type === 'cancelled') {
   *       console.log('Stream was cancelled');
   *       // ChatService calls unregisterActiveSession in finally block
   *     }
   *   }
   * })();
   *
   * // Cancel after 5 seconds
   * setTimeout(() => {
   *   if (currentStreamId) {
   *     chatService.cancelMessage(currentStreamId);
   *     // Triggers unregisterActiveSession via ChatService finally block
   *   }
   * }, 5000);
   * ```
   *
   * @example
   * ```typescript
   * // Monitoring active session count
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * // Before cleanup
   * conversationStatusManager.registerActiveSession('stream-1', 'session-1', context1);
   * conversationStatusManager.registerActiveSession('stream-2', 'session-2', context2);
   * conversationStatusManager.registerActiveSession('stream-3', 'session-3', context3);
   * console.log(conversationStatusManager.getActiveSessionIds().length); // 3
   *
   * // Cleanup first session
   * conversationStatusManager.unregisterActiveSession('stream-1');
   * console.log(conversationStatusManager.getActiveSessionIds().length); // 2
   *
   * // Cleanup remaining sessions
   * conversationStatusManager.unregisterActiveSession('stream-2');
   * conversationStatusManager.unregisterActiveSession('stream-3');
   * console.log(conversationStatusManager.getActiveSessionIds().length); // 0
   *
   * // Use case: Monitor active conversation load, implement rate limiting
   * ```
   *
   * @see {@link registerActiveSession} - Registration method called when session starts
   * @see {@link getSessionId} - Look up Claude session ID by streaming ID
   * @see {@link isSessionActive} - Check if session is still active
   * @see {@link getActiveSessionIds} - Get all active session IDs
   */
  unregisterActiveSession(streamingId: string): void {
    const claudeSessionId = this.streamingToSession.get(streamingId);
    
    if (claudeSessionId) {
      this.logger.debug('Unregistering active session', { 
        streamingId, 
        claudeSessionId 
      });

      this.sessionToStreaming.delete(claudeSessionId);
      this.streamingToSession.delete(streamingId);
      this.sessionContext.delete(claudeSessionId);

      this.logger.info('Active session unregistered', { 
        streamingId, 
        claudeSessionId,
        totalActiveSessions: this.sessionToStreaming.size
      });

      this.emit('session-ended', { streamingId, claudeSessionId });
    } else {
      this.logger.debug('Attempted to unregister unknown streaming session', { streamingId });
    }
  }

  /**
   * Get conversation context for an active session
   */
  getConversationContext(claudeSessionId: string): ConversationStatusContext | undefined {
    const context = this.sessionContext.get(claudeSessionId);
    this.logger.debug('Getting conversation context', {
      claudeSessionId,
      hasContext: !!context
    });
    return context;
  }

  /**
   * Check if a Claude session ID is currently active (has ongoing stream)
   */
  isSessionActive(claudeSessionId: string): boolean {
    const isActive = this.sessionToStreaming.has(claudeSessionId);
    return isActive;
  }

  /**
   * Get the streaming ID for an active Claude session
   */
  getStreamingId(claudeSessionId: string): string | undefined {
    const streamingId = this.sessionToStreaming.get(claudeSessionId);
    this.logger.debug('Getting streaming ID for Claude session', { 
      claudeSessionId, 
      streamingId: streamingId || 'not found' 
    });
    return streamingId;
  }

  /**
   * Get the Claude session ID for an active streaming session
   */
  getSessionId(streamingId: string): string | undefined {
    const claudeSessionId = this.streamingToSession.get(streamingId);
    this.logger.debug('Getting Claude session ID for streaming ID', { 
      streamingId, 
      claudeSessionId: claudeSessionId || 'not found' 
    });
    return claudeSessionId;
  }

  /**
   * Get all active Claude session IDs
   */
  getActiveSessionIds(): string[] {
    const sessions = Array.from(this.sessionToStreaming.keys());
    this.logger.debug('Getting all active session IDs', { 
      count: sessions.length,
      sessions 
    });
    return sessions;
  }

  /**
   * Get all active streaming IDs
   */
  getActiveStreamingIds(): string[] {
    const streamingIds = Array.from(this.streamingToSession.keys());
    this.logger.debug('Getting all active streaming IDs', { 
      count: streamingIds.length,
      streamingIds 
    });
    return streamingIds;
  }

  /**
   * Get conversation status for a Claude session ID
   */
  getConversationStatus(claudeSessionId: string): 'completed' | 'ongoing' | 'pending' {
    const isActive = this.isSessionActive(claudeSessionId);
    const status = isActive ? 'ongoing' : 'completed';
    return status;
  }

  /**
   * Get conversations that haven't appeared in history yet
   *
   * @description
   * This method generates optimistic conversation summaries for active streaming sessions
   * that haven't been persisted to Claude's history files yet. It enables immediate UI
   * feedback by showing new conversations in the conversation list before the SDK writes
   * history files to disk.
   *
   * **Optimistic UI Pattern:**
   * 1. User sends a message via ChatService.sendMessage()
   * 2. ChatService registers session with registerActiveSession()
   * 3. UI calls getConversationList() which queries this method
   * 4. This method returns conversation summary with status='ongoing'
   * 5. UI immediately shows conversation in list (before history file exists)
   * 6. When stream completes, unregisterActiveSession() is called
   * 7. UI refreshes from history files (conversation now persisted)
   *
   * **How It Works:**
   * 1. Get all active Claude session IDs from sessionToStreaming map
   * 2. Filter out sessions that already exist in history files (via existingSessionIds set)
   * 3. For each remaining session, check if context is stored
   * 4. Generate ConversationSummary with status='ongoing' and streamingId populated
   * 5. Return array of summaries for conversations not yet in history
   *
   * **Use Cases:**
   * - Conversation list endpoint: Combine with history reader for complete list
   * - Real-time UI updates: Show active conversations immediately
   * - Status monitoring: Track which conversations are still streaming
   * - Admin dashboard: Monitor active conversation load
   *
   * @param {Set<string>} existingSessionIds - Set of session IDs already in history files (to avoid duplicates)
   *
   * @returns {ConversationSummary[]} Array of conversation summaries for active sessions not in history
   *
   * @example
   * ```typescript
   * // Conversation list endpoint - combine history + active sessions
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { claudeHistoryReader } from './claude-history-reader';
   *
   * async function getConversationList(workingDirectory: string): Promise<ConversationSummary[]> {
   *   // 1. Read persisted conversations from history files
   *   const historySummaries = await claudeHistoryReader.getConversationList(workingDirectory);
   *   const existingSessionIds = new Set(historySummaries.map(s => s.sessionId));
   *
   *   // 2. Get active sessions not yet in history
   *   const activeSummaries = conversationStatusManager.getConversationsNotInHistory(existingSessionIds);
   *
   *   // 3. Combine and sort by newest first
   *   const allSummaries = [...activeSummaries, ...historySummaries];
   *   allSummaries.sort((a, b) =>
   *     new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
   *   );
   *
   *   return allSummaries;
   *   // Active sessions: status='ongoing', streamingId populated
   *   // Completed sessions: status='completed', streamingId=undefined
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Real-time UI update - show conversation immediately
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * conversationStatusManager.on('session-started', ({ claudeSessionId }) => {
   *   // New conversation just started
   *   const activeSummaries = conversationStatusManager.getConversationsNotInHistory(new Set());
   *   const newConversation = activeSummaries.find(s => s.sessionId === claudeSessionId);
   *
   *   if (newConversation) {
   *     // Add to UI immediately (before history file exists)
   *     addConversationToList({
   *       sessionId: newConversation.sessionId,
   *       status: 'ongoing',
   *       streamingId: newConversation.streamingId,
   *       model: newConversation.model,
   *       createdAt: newConversation.createdAt
   *     });
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Filter active vs persisted conversations
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { claudeHistoryReader } from './claude-history-reader';
   *
   * async function getConversationsByStatus(workingDirectory: string) {
   *   const historySummaries = await claudeHistoryReader.getConversationList(workingDirectory);
   *   const existingSessionIds = new Set(historySummaries.map(s => s.sessionId));
   *
   *   // Active conversations (still streaming)
   *   const activeConversations = conversationStatusManager.getConversationsNotInHistory(existingSessionIds);
   *   console.log('Active:', activeConversations.map(c => c.sessionId));
   *
   *   // Persisted conversations (completed)
   *   const persistedConversations = historySummaries;
   *   console.log('Persisted:', persistedConversations.map(c => c.sessionId));
   *
   *   return { active: activeConversations, persisted: persistedConversations };
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Edge case - session registered without context
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * // Register session without context
   * conversationStatusManager.registerActiveSession('stream-1', 'session-1');
   *
   * // Query for conversations not in history
   * const summaries = conversationStatusManager.getConversationsNotInHistory(new Set());
   * console.log(summaries); // [] (empty - no context means no summary)
   *
   * // Register session with context
   * conversationStatusManager.registerActiveSession('stream-2', 'session-2', {
   *   initialPrompt: 'Help me debug this code',
   *   workingDirectory: '/Users/dev/my-project',
   *   model: 'claude-sonnet-4'
   * });
   *
   * const summaries2 = conversationStatusManager.getConversationsNotInHistory(new Set());
   * console.log(summaries2.length); // 1 (session-2 included)
   * ```
   *
   * @see {@link registerActiveSession} - Register session with context for optimistic UI
   * @see {@link getActiveConversationDetails} - Get conversation details for active session
   * @see {@link ConversationSummary} - Return type interface
   */
  getConversationsNotInHistory(existingSessionIds: Set<string>): ConversationSummary[] {
    const activeSessionIds = this.getActiveSessionIds();
    
    const conversationsNotInHistory = activeSessionIds
      .filter(sessionId => !existingSessionIds.has(sessionId))
      .map(sessionId => {
        const context = this.getConversationContext(sessionId);
        const streamingId = this.getStreamingId(sessionId);
        
        if (context && streamingId) {
          // Create conversation entry for active session
          const conversationSummary: ConversationSummary = {
            sessionId,
            projectPath: context.workingDirectory,
            summary: '', // No summary for active conversation
            sessionInfo: {
              custom_name: '', // No custom name yet
              created_at: context.timestamp,
              updated_at: context.timestamp,
              version: 4,
              pinned: false,
              archived: false,
              continuation_session_id: '',
              initial_commit_head: '',
              permission_mode: 'default'
            },
            createdAt: context.timestamp,
            updatedAt: context.timestamp,
            messageCount: 1, // At least the initial user message
            totalDuration: 0, // No duration yet
            model: context.model || 'unknown',
            status: 'ongoing' as const,
            streamingId
          };
          
          this.logger.debug('Created conversation summary for active session', {
            sessionId,
            streamingId,
            workingDirectory: context.workingDirectory,
            model: context.model
          });
          
          return conversationSummary;
        }
        
        return null;
      })
      .filter((conversation): conversation is ConversationSummary => conversation !== null);

    this.logger.debug('Generated conversations not in history', {
      activeSessionCount: activeSessionIds.length,
      existingSessionCount: existingSessionIds.size,
      conversationsNotInHistoryCount: conversationsNotInHistory.length
    });

    return conversationsNotInHistory;
  }

  /**
   * Get conversation details if session is active but not in history
   *
   * @description
   * This method generates optimistic conversation details for an active streaming session
   * that hasn't been persisted to Claude's history files yet. It enables immediate UI
   * feedback by showing the initial user message and any inherited messages before the
   * SDK writes the conversation to disk.
   *
   * **Optimistic UI Pattern:**
   * 1. User sends a message via ChatService.sendMessage()
   * 2. ChatService registers session with registerActiveSession() including context
   * 3. UI calls getConversationDetails(sessionId) which queries this method first
   * 4. This method returns conversation with initial user message (+ inherited messages if resuming)
   * 5. UI immediately shows conversation details (before history file exists)
   * 6. Assistant response streams in real-time via separate WebSocket/SSE endpoint
   * 7. When stream completes, unregisterActiveSession() is called
   * 8. UI refreshes from history files (conversation now persisted with complete messages)
   *
   * **How It Works:**
   * 1. Check if session is active via isSessionActive()
   * 2. Get conversation context via getConversationContext()
   * 3. If not active or no context, return null (fallback to history reader)
   * 4. Build messages array: inherited messages (if any) + initial user message
   * 5. Return ConversationDetailsResponse with status='ongoing' and partial messages
   *
   * **Use Cases:**
   * - Conversation details endpoint: Try optimistic path first, fallback to history
   * - Real-time UI updates: Show conversation immediately after user sends message
   * - Resume conversation: Show previous messages + new user message
   * - Status monitoring: Check if conversation is still streaming
   *
   * @param {string} sessionId - Claude session ID to get details for
   *
   * @returns {ConversationDetailsResponse | null} Conversation details if active, null if not active or no context stored
   *
   * @example
   * ```typescript
   * // Conversation details endpoint - optimistic path first, fallback to history
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { claudeHistoryReader } from './claude-history-reader';
   *
   * async function getConversationDetails(sessionId: string): Promise<ConversationDetailsResponse> {
   *   // 1. Try optimistic path (active session)
   *   const activeDetails = conversationStatusManager.getActiveConversationDetails(sessionId);
   *   if (activeDetails) {
   *     return activeDetails;
   *     // Returns initial user message + inherited messages
   *     // Assistant response will stream in real-time via separate endpoint
   *   }
   *
   *   // 2. Fallback to history files (completed session)
   *   const historyDetails = await claudeHistoryReader.getConversationDetails(sessionId);
   *   return historyDetails;
   *   // Returns complete conversation with all messages
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Real-time UI update - show conversation immediately
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * conversationStatusManager.on('session-started', ({ claudeSessionId }) => {
   *   // New conversation just started
   *   const details = conversationStatusManager.getActiveConversationDetails(claudeSessionId);
   *
   *   if (details) {
   *     // Display initial user message immediately
   *     displayConversation({
   *       sessionId: claudeSessionId,
   *       messages: details.messages, // [{ type: 'user', message: { content: '...' } }]
   *       status: 'ongoing',
   *       projectPath: details.projectPath
   *     });
   *
   *     // Assistant response will stream in via WebSocket
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Resume conversation - show previous messages + new user message
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { claudeHistoryReader } from './claude-history-reader';
   *
   * async function resumeConversation(previousSessionId: string, newMessage: string) {
   *   // 1. Load previous conversation messages
   *   const previousDetails = await claudeHistoryReader.getConversationDetails(previousSessionId);
   *
   *   // 2. Register new session with inherited messages
   *   conversationStatusManager.registerActiveSession(
   *     'stream-uuid-new',
   *     'session-new-id',
   *     {
   *       initialPrompt: newMessage,
   *       workingDirectory: previousDetails.projectPath,
   *       model: previousDetails.metadata.model,
   *       inheritedMessages: previousDetails.messages // Include previous conversation
   *     }
   *   );
   *
   *   // 3. Get active conversation details
   *   const activeDetails = conversationStatusManager.getActiveConversationDetails('session-new-id');
   *   console.log(activeDetails?.messages.length);
   *   // Includes: [...previousDetails.messages, newUserMessage]
   *   // UI shows complete conversation history + new user message
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Check if conversation is active vs completed
   * import { conversationStatusManager } from './conversation-status-manager';
   * import { claudeHistoryReader } from './claude-history-reader';
   *
   * async function getConversationWithStatus(sessionId: string) {
   *   const activeDetails = conversationStatusManager.getActiveConversationDetails(sessionId);
   *
   *   if (activeDetails) {
   *     // Conversation is still streaming
   *     return {
   *       ...activeDetails,
   *       status: 'ongoing',
   *       isStreaming: true,
   *       messages: activeDetails.messages // Partial (user message only)
   *     };
   *   }
   *
   *   // Conversation is completed
   *   const historyDetails = await claudeHistoryReader.getConversationDetails(sessionId);
   *   return {
   *     ...historyDetails,
   *     status: 'completed',
   *     isStreaming: false,
   *     messages: historyDetails.messages // Complete (all messages)
   *   };
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Edge case - session registered without context
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * // Register session without context
   * conversationStatusManager.registerActiveSession('stream-1', 'session-1');
   *
   * // Query for conversation details
   * const details = conversationStatusManager.getActiveConversationDetails('session-1');
   * console.log(details); // null (no context means no details)
   *
   * // Register session with context
   * conversationStatusManager.registerActiveSession('stream-2', 'session-2', {
   *   initialPrompt: 'Help me debug this code',
   *   workingDirectory: '/Users/dev/my-project',
   *   model: 'claude-sonnet-4'
   * });
   *
   * const details2 = conversationStatusManager.getActiveConversationDetails('session-2');
   * console.log(details2?.messages.length); // 1 (initial user message)
   * ```
   *
   * @example
   * ```typescript
   * // Message structure for active conversation
   * import { conversationStatusManager } from './conversation-status-manager';
   *
   * conversationStatusManager.registerActiveSession('stream-1', 'session-1', {
   *   initialPrompt: 'Help me refactor this code',
   *   workingDirectory: '/Users/dev/my-project',
   *   model: 'claude-sonnet-4'
   * });
   *
   * const details = conversationStatusManager.getActiveConversationDetails('session-1');
   * console.log(details);
   * // {
   * //   messages: [
   * //     {
   * //       uuid: 'active-session-1-user',
   * //       type: 'user',
   * //       message: { role: 'user', content: 'Help me refactor this code' },
   * //       timestamp: '2024-01-15T10:30:00.000Z',
   * //       sessionId: 'session-1',
   * //       cwd: '/Users/dev/my-project'
   * //     }
   * //   ],
   * //   summary: '', // No summary for active conversation
   * //   projectPath: '/Users/dev/my-project',
   * //   metadata: {
   * //     totalDuration: 0, // No duration yet
   * //     model: 'claude-sonnet-4'
   * //   }
   * // }
   * ```
   *
   * @see {@link registerActiveSession} - Register session with context for optimistic UI
   * @see {@link getConversationsNotInHistory} - Get optimistic conversation summaries
   * @see {@link ConversationDetailsResponse} - Return type interface
   */
  getActiveConversationDetails(sessionId: string): ConversationDetailsResponse | null {
    const isActive = this.isSessionActive(sessionId);
    const context = this.getConversationContext(sessionId);
    
    this.logger.debug('Checking for active conversation details', {
      sessionId,
      isActive,
      hasContext: !!context
    });
    
    if (!isActive || !context) {
      return null;
    }

    // Create messages array
    const messages: ConversationMessage[] = [];
    
    // Add inherited messages first (if any)
    if (context.inheritedMessages) {
      messages.push(...context.inheritedMessages);
    }
    
    // Add the current initial prompt message
    const activeMessage: ConversationMessage = {
      uuid: `active-${sessionId}-user`,
      type: 'user',
      message: {
        role: 'user',
        content: context.initialPrompt
      },
      timestamp: context.timestamp,
      sessionId: sessionId,
      cwd: context.workingDirectory
    };
    messages.push(activeMessage);
    
    const response: ConversationDetailsResponse = {
      messages,
      summary: '', // No summary for active conversation
      projectPath: context.workingDirectory,
      metadata: {
        totalDuration: 0,
        model: context.model || 'unknown'
      }
    };
    
    this.logger.debug('Created active conversation details', {
      sessionId,
      workingDirectory: context.workingDirectory,
      model: context.model,
      totalMessageCount: messages.length,
      inheritedMessageCount: context.inheritedMessages?.length || 0
    });
    
    return response;
  }

  /**
   * Clear all mappings (useful for testing)
   */
  clear(): void {
    this.logger.debug('Clearing all session mappings');
    this.sessionToStreaming.clear();
    this.streamingToSession.clear();
    this.sessionContext.clear();
  }

  /**
   * Get statistics about tracked sessions
   */
  getStats(): {
    activeSessionsCount: number;
    activeStreamingIdsCount: number;
    activeContextsCount: number;
    activeSessions: Array<{ claudeSessionId: string; streamingId: string }>;
  } {
    const activeSessions = Array.from(this.sessionToStreaming.entries()).map(
      ([claudeSessionId, streamingId]) => ({ claudeSessionId, streamingId })
    );

    return {
      activeSessionsCount: this.sessionToStreaming.size,
      activeStreamingIdsCount: this.streamingToSession.size,
      activeContextsCount: this.sessionContext.size,
      activeSessions
    };
  }
}