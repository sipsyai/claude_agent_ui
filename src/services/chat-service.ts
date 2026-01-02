/**
 * ChatService - Real-time chat service with Claude Agent SDK integration
 *
 * @description
 * The ChatService manages interactive chat sessions with Claude AI using the Agent SDK,
 * providing real-time streaming conversations with support for file attachments, MCP servers,
 * and agent configurations. It extends EventEmitter to broadcast conversation events and
 * implements advanced stream management with abort controller patterns for cancellable requests.
 *
 * **Key Responsibilities:**
 * - Create and manage chat sessions stored in Strapi CMS
 * - Stream real-time responses from Claude Agent SDK with AsyncGenerator pattern
 * - Handle file attachments (images, PDFs, text files) with base64 encoding
 * - Integrate with agents (system prompts, model config, tool config, MCP servers)
 * - Manage conversation lifecycle (create, resume, archive, delete)
 * - Track active streams with cancellation support via AbortController
 * - Persist messages and SDK events to chat log files
 * - Sync skills to filesystem before conversation starts
 * - Transform SDK messages to application's chat message format
 *
 * **Architecture:**
 * - **EventEmitter Pattern**: Extends EventEmitter to broadcast chat events to subscribers
 * - **Active Streams Management**: Maintains Map of active Query instances indexed by streamId
 * - **Abort Controller Pattern**: Each stream has an AbortController for graceful cancellation
 * - **AsyncGenerator Streaming**: sendMessage() yields events as they arrive (user_message_saved,
 *   stream_id, sdk_message, assistant_message_delta, assistant_message_saved, done, error, cancelled)
 * - **Message Persistence**: Saves user/assistant messages to Strapi and chat log files
 * - **Agent Integration**: Supports per-session or per-message agent overrides with full config
 * - **MCP Server Support**: Loads MCP servers from agent's mcpConfig and .mcp.json files
 * - **Permission Modes**: Supports default, bypass, auto (acceptEdits), and plan modes
 * - **File Handling**: Uploads attachments to Strapi, processes images/PDFs/text for SDK
 *
 * **EventEmitter Events:**
 * Currently, ChatService extends EventEmitter but does not emit custom events.
 * Instead, it uses AsyncGenerator pattern to stream events directly to the caller.
 * Future versions may add events like 'chat:session:created', 'chat:message:sent', etc.
 *
 * **Active Streams Management:**
 * The service maintains two synchronized Maps for stream lifecycle:
 * - `activeStreams`: Map<streamId, Query> - Active SDK query instances
 * - `activeAbortControllers`: Map<streamId, AbortController> - Controllers for cancellation
 *
 * When a message is sent:
 * 1. Generate unique streamId (UUID)
 * 2. Create AbortController and store in activeAbortControllers
 * 3. Create SDK Query instance with abortController option
 * 4. Store Query in activeStreams
 * 5. Yield stream_id event to client (enables cancellation)
 * 6. Stream SDK messages via AsyncGenerator
 * 7. Cleanup: Remove from both Maps when stream completes/errors/cancelled
 *
 * **Abort Controller Pattern:**
 * - Each stream gets a dedicated AbortController instance
 * - Client receives streamId immediately after message send starts
 * - Client can call cancelMessage(streamId) to abort the stream
 * - Cancellation triggers abortController.abort()
 * - SDK Query respects abort signal and stops processing
 * - Cleanup happens in finally block (removes from Maps)
 * - Yields 'cancelled' event with reason and timestamp
 *
 * **Message Flow:**
 * 1. Client calls sendMessage() with text and optional attachments
 * 2. Service fetches chat session from Strapi with agent/skills config
 * 3. Syncs skills to filesystem (creates .claude/skills/*.md files)
 * 4. Uploads attachments to Strapi and saves user message
 * 5. Yields 'user_message_saved' event
 * 6. Builds SDK options (model, systemPrompt, permissions, tools, mcpServers)
 * 7. Creates SDK Query with AsyncGenerator prompt and AbortController
 * 8. Yields 'stream_id' event (enables cancellation)
 * 9. Streams SDK messages and yields 'sdk_message' events
 * 10. Accumulates assistant text from content_block_delta events
 * 11. Yields 'assistant_message_delta' events for real-time UI updates
 * 12. Saves complete assistant message to Strapi and chat log
 * 13. Yields 'assistant_message_saved' event
 * 14. Yields 'done' event with cost/usage metadata
 *
 * @example
 * ```typescript
 * // Basic usage - create session and send message
 * import { chatService } from './chat-service';
 *
 * // Create a new chat session
 * const session = await chatService.createChatSession(
 *   'Code Review Chat',
 *   ['skill-doc-id-1', 'skill-doc-id-2'], // Skill documentIds
 *   'agent-doc-id', // Agent documentId
 *   undefined, // No custom system prompt
 *   '/path/to/project',
 *   'default' // Permission mode
 * );
 *
 * console.log(`Session created: ${session.documentId}`);
 * ```
 *
 * @example
 * ```typescript
 * // Send message and handle streaming responses
 * import { chatService } from './chat-service';
 *
 * const sessionDocId = 'chat-session-doc-id';
 * const message = 'Review the authentication code in src/auth.ts';
 * const attachments = []; // No attachments
 * const workingDir = '/path/to/project';
 *
 * // Stream responses using AsyncGenerator
 * for await (const event of chatService.sendMessage(
 *   sessionDocId,
 *   message,
 *   attachments,
 *   workingDir
 * )) {
 *   switch (event.type) {
 *     case 'user_message_saved':
 *       console.log('User message saved:', event.message);
 *       break;
 *     case 'stream_id':
 *       console.log('Stream ID:', event.streamId);
 *       // Store streamId for potential cancellation
 *       break;
 *     case 'assistant_message_delta':
 *       // Real-time text streaming
 *       process.stdout.write(event.delta);
 *       break;
 *     case 'assistant_message_saved':
 *       console.log('\nAssistant message saved:', event.message);
 *       break;
 *     case 'done':
 *       console.log('Conversation complete. Cost:', event.cost);
 *       break;
 *     case 'error':
 *       console.error('Error:', event.error);
 *       break;
 *     case 'cancelled':
 *       console.log('Stream cancelled:', event.reason);
 *       break;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Send message with file attachments
 * import { chatService } from './chat-service';
 * import fs from 'fs';
 *
 * const sessionDocId = 'chat-session-doc-id';
 * const message = 'Analyze this diagram and suggest improvements';
 * const imageBuffer = fs.readFileSync('./diagram.png');
 * const attachments = [{
 *   name: 'diagram.png',
 *   mimeType: 'image/png',
 *   data: imageBuffer.toString('base64')
 * }];
 *
 * for await (const event of chatService.sendMessage(
 *   sessionDocId,
 *   message,
 *   attachments,
 *   '/path/to/project'
 * )) {
 *   if (event.type === 'assistant_message_delta') {
 *     console.log(event.delta);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Cancel an active message stream
 * import { chatService } from './chat-service';
 *
 * let currentStreamId: string | null = null;
 *
 * // Start streaming in background
 * (async () => {
 *   for await (const event of chatService.sendMessage(
 *     sessionDocId,
 *     'This is a long running task...',
 *     [],
 *     workingDir
 *   )) {
 *     if (event.type === 'stream_id') {
 *       currentStreamId = event.streamId;
 *     }
 *     if (event.type === 'cancelled') {
 *       console.log('Stream was cancelled');
 *     }
 *   }
 * })();
 *
 * // Cancel after 5 seconds
 * setTimeout(() => {
 *   if (currentStreamId) {
 *     const cancelled = chatService.cancelMessage(currentStreamId);
 *     console.log('Cancellation requested:', cancelled);
 *   }
 * }, 5000);
 * ```
 *
 * @example
 * ```typescript
 * // Use plan mode for read-only analysis
 * import { chatService } from './chat-service';
 *
 * const session = await chatService.createChatSession(
 *   'Plan Mode Chat',
 *   [], // No skills
 *   'agent-doc-id',
 *   undefined,
 *   '/path/to/project',
 *   'plan' // Plan mode: read-only tools, requires user approval before changes
 * );
 *
 * for await (const event of chatService.sendMessage(
 *   session.documentId,
 *   'Create a plan to add a user authentication system',
 *   [],
 *   '/path/to/project',
 *   'plan' // Override permission mode for this message
 * )) {
 *   // Claude will analyze the codebase and present a detailed plan
 *   // without making any changes (Read, Grep, Glob tools only)
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Agent override - use different agent per message
 * import { chatService } from './chat-service';
 *
 * const session = await chatService.createChatSession(
 *   'Multi-Agent Chat',
 *   ['skill-1'],
 *   'default-agent-id',
 *   undefined,
 *   '/path/to/project'
 * );
 *
 * // First message uses default agent
 * for await (const event of chatService.sendMessage(
 *   session.documentId,
 *   'Write a test file',
 *   [],
 *   '/path/to/project'
 * )) { /* ... */ }
 *
 * // Second message overrides with specialized agent
 * for await (const event of chatService.sendMessage(
 *   session.documentId,
 *   'Review the code for security issues',
 *   [],
 *   '/path/to/project',
 *   undefined, // Use session permission mode
 *   'security-agent-id' // Override with security specialist agent
 * )) { /* ... */ }
 * ```
 *
 * @example
 * ```typescript
 * // Session management
 * import { chatService } from './chat-service';
 *
 * // Get all sessions
 * const sessions = await chatService.getAllChatSessions();
 * console.log(`Total sessions: ${sessions.length}`);
 *
 * // Get specific session
 * const session = await chatService.getChatSession('session-doc-id');
 * console.log(`Session title: ${session.title}`);
 *
 * // Get messages for session
 * const messages = await chatService.getChatMessages('session-doc-id');
 * console.log(`Message count: ${messages.length}`);
 *
 * // Archive old session
 * await chatService.archiveChatSession('old-session-doc-id');
 *
 * // Delete session permanently
 * await chatService.deleteChatSession('session-doc-id');
 * ```
 *
 * @example
 * ```typescript
 * // Monitor active streams
 * import { chatService } from './chat-service';
 *
 * // Get list of active stream IDs
 * const activeStreamIds = chatService.getActiveStreamIds();
 * console.log(`Active streams: ${activeStreamIds.length}`);
 *
 * // Cancel all active streams (e.g., on shutdown)
 * for (const streamId of activeStreamIds) {
 *   chatService.cancelMessage(streamId);
 * }
 * ```
 *
 * @see {@link https://docs.anthropic.com/en/api/agent-sdk|Claude Agent SDK Documentation}
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { query, type Query, type Options, type PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import axios from 'axios';
import type {
  ChatSession,
  ChatMessage,
  SendMessageRequest
} from '../types/chat-types.js';
import { strapiClient } from './strapi-client.js';
import { createLogger, type Logger } from './logger.js';
import { chatLogService } from './chat-log-service.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export class ChatService extends EventEmitter {
  /**
   * Logger instance for structured logging
   */
  private logger: Logger;

  /**
   * Active SDK query instances indexed by stream ID
   * Each Query represents an active conversation stream with Claude Agent SDK
   * Streams are added when sendMessage() creates a query, removed on completion/error/cancellation
   */
  private activeStreams: Map<string, Query> = new Map();

  /**
   * Active abort controllers indexed by stream ID
   * Each AbortController enables graceful cancellation of SDK queries
   * Client receives streamId and can call cancelMessage(streamId) to abort the stream
   * Controllers are created in sendMessage() and removed in finally block
   */
  private activeAbortControllers: Map<string, AbortController> = new Map();

  constructor() {
    super();
    this.logger = createLogger('ChatService');
  }

  /**
   * Helper method to make Strapi API calls
   */
  private async strapiRequest<T = any>(method: string, endpoint: string, data?: any, params?: any): Promise<T> {
    const config: any = {
      method,
      url: `${STRAPI_URL}/api${endpoint}`,
      headers: {
        'Authorization': STRAPI_API_TOKEN ? `Bearer ${STRAPI_API_TOKEN}` : '',
        'Content-Type': 'application/json',
      },
    };

    if (data) config.data = data;
    if (params) config.params = params;

    const response = await axios(config);
    return response.data;
  }

  /**
   * Create a new chat session
   * @param title - Session title
   * @param skillIds - Array of skill documentIds to include
   * @param agentId - Optional agent documentId for systemPrompt and configuration
   * @param customSystemPrompt - Optional custom system prompt override
   * @param workingDirectory - Working directory for SDK execution
   * @param permissionMode - Permission mode for SDK (default, bypass, auto, plan)
   * @returns Created chat session
   */
  async createChatSession(
    title: string,
    skillIds: string[],
    agentId: string | undefined,
    customSystemPrompt: string | undefined,
    workingDirectory: string,
    permissionMode?: 'default' | 'bypass' | 'auto' | 'plan'
  ): Promise<ChatSession> {
    try {
      this.logger.info('Creating new chat session', {
        title,
        skillIds,
        agentId,
        customSystemPrompt: customSystemPrompt ? 'provided' : 'none',
        workingDirectory,
        permissionMode: permissionMode || 'default'
      });

      // Create session in Strapi with populate to return full data
      // Note: "plan" is not in Strapi's permissionMode enum, so we use planMode boolean instead
      const effectiveMode = permissionMode || 'default';
      const isPlanMode = effectiveMode === 'plan';

      const data = await this.strapiRequest('POST', '/chat-sessions?populate[skills]=true&populate[agent][populate][toolConfig]=true&populate[agent][populate][modelConfig]=true', {
        data: {
          title,
          status: 'active',
          sessionId: null, // Will be set when first message is sent
          skills: { connect: skillIds.map(id => ({ documentId: id })) }, // Many-to-many relation (Strapi v5 format with documentId objects)
          agent: agentId || undefined, // Many-to-one relation (Strapi v5 format - direct documentId string, no connect)
          customSystemPrompt: customSystemPrompt, // Optional custom system prompt
          permissionMode: isPlanMode ? 'default' : effectiveMode, // "plan" is not in enum, use "default" instead
          planMode: isPlanMode, // Store plan mode as separate boolean field
        },
      });

      if (!data.data) {
        throw new Error('Failed to create chat session');
      }

      const session = this.transformChatSession(data.data);

      this.logger.info('Chat session created successfully', { sessionId: session.documentId });

      // Initialize chat log file
      await chatLogService.initChatLog(session, workingDirectory);

      return session;
    } catch (error) {
      this.logger.error('Failed to create chat session', error);
      throw error;
    }
  }

  /**
   * Get chat session by documentId with populated relations
   *
   * @description
   * Retrieves a single chat session from Strapi CMS with full population of related
   * entities including skills, agent configuration, model config, tool config, and
   * MCP server configurations. This method is used internally by sendMessage() to
   * load session configuration before starting a conversation.
   *
   * **Deep Population Strategy:**
   * The method uses Strapi v5's deep population syntax to eagerly load nested
   * relations in a single query, avoiding N+1 query problems. It populates:
   * - Skills with their toolConfig and mcpConfig
   * - Agent with toolConfig, modelConfig, and mcpConfig
   * - MCP server details and selected tools within mcpConfig
   * - Nested mcpTool details within selectedTools
   *
   * **Use Cases:**
   * - Load session configuration before sending messages
   * - Display session details in UI (title, agent, skills)
   * - Resume conversations with existing session context
   * - Inspect session configuration for debugging
   * - Validate session state before operations
   *
   * **Populated Relations:**
   * - `skills`: Array of Skill objects with toolConfig and mcpConfig
   * - `agent`: Agent object with systemPrompt, toolConfig, modelConfig, mcpConfig
   * - `agent.mcpConfig[]`: MCP server configurations with selected tools
   * - `agent.mcpConfig[].selectedTools[]`: Selected MCP tools for each server
   *
   * **Permission Mode Handling:**
   * The method transforms Strapi's permissionMode and planMode fields into a
   * unified permissionMode ('default' | 'bypass' | 'auto' | 'plan'). If planMode
   * is true, permissionMode is set to 'plan' for client compatibility.
   *
   * @param {string} sessionDocId - The documentId of the chat session to retrieve
   *
   * @returns {Promise<ChatSession>} The chat session with populated relations
   *
   * @throws {Error} If the session is not found or Strapi request fails
   *
   * @example
   * ```typescript
   * // Basic session retrieval
   * import { chatService } from './chat-service';
   *
   * const session = await chatService.getChatSession('session-doc-id-123');
   *
   * console.log(`Session: ${session.title}`);
   * console.log(`Agent: ${session.agent?.name}`);
   * console.log(`Skills: ${session.skills?.map(s => s.name).join(', ')}`);
   * // Output:
   * // Session: Code Review Chat
   * // Agent: Code Review Agent
   * // Skills: JavaScript Expert, Testing Helper
   * ```
   *
   * @example
   * ```typescript
   * // Inspect session configuration
   * import { chatService } from './chat-service';
   *
   * const session = await chatService.getChatSession('session-doc-id-123');
   *
   * console.log('Model:', session.agent?.modelConfig?.model);
   * console.log('Allowed tools:', session.agent?.toolConfig?.allowedTools);
   * console.log('Permission mode:', session.permissionMode);
   * console.log('MCP servers:', session.agent?.mcpConfig?.map(c => c.mcpServer?.name));
   * // Output:
   * // Model: claude-sonnet-4-5
   * // Allowed tools: ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Edit']
   * // Permission mode: default
   * // MCP servers: ['filesystem', 'database']
   * ```
   *
   * @example
   * ```typescript
   * // Check session status before sending message
   * import { chatService } from './chat-service';
   *
   * const session = await chatService.getChatSession('session-doc-id-123');
   *
   * if (session.status === 'archived') {
   *   console.log('Cannot send message to archived session');
   * } else {
   *   console.log('Session is active, ready to send message');
   *   // Proceed with sendMessage()
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Handle session not found error
   * import { chatService } from './chat-service';
   *
   * try {
   *   const session = await chatService.getChatSession('invalid-session-id');
   * } catch (error) {
   *   console.error('Session not found:', error);
   *   // Error: Chat session invalid-session-id not found
   *   // Handle error - redirect to session list or show error message
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Use in sendMessage workflow
   * import { chatService } from './chat-service';
   *
   * async function sendChatMessage(sessionDocId: string, text: string) {
   *   // Load session first to validate it exists
   *   const session = await chatService.getChatSession(sessionDocId);
   *
   *   console.log(`Sending to: ${session.title}`);
   *   console.log(`Using agent: ${session.agent?.name || 'none'}`);
   *
   *   // Stream message
   *   for await (const event of chatService.sendMessage(
   *     sessionDocId,
   *     text,
   *     [],
   *     '/path/to/project'
   *   )) {
   *     // Handle events...
   *   }
   * }
   * ```
   *
   * @see {@link getAllChatSessions} - Get all sessions
   * @see {@link createChatSession} - Create a new session
   * @see {@link sendMessage} - Uses this method to load session config
   */
  async getChatSession(sessionDocId: string): Promise<ChatSession> {
    try {
      const data = await this.strapiRequest('GET', `/chat-sessions/${sessionDocId}`, undefined, {
        populate: {
          skills: {
            populate: {
              toolConfig: true,
              mcpConfig: {
                populate: {
                  mcpServer: true,
                  selectedTools: {
                    populate: { mcpTool: true },
                  },
                },
              },
            },
          },
          agent: {
            populate: {
              toolConfig: true,
              modelConfig: true,
              mcpConfig: {
                populate: {
                  mcpServer: true,
                  selectedTools: {
                    populate: { mcpTool: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!data.data) {
        throw new Error(`Chat session ${sessionDocId} not found`);
      }

      return this.transformChatSession(data.data);
    } catch (error) {
      this.logger.error('Failed to get chat session', error, { sessionDocId });
      throw error;
    }
  }

  /**
   * Get all chat sessions sorted by creation date (newest first)
   *
   * @description
   * Retrieves all chat sessions from Strapi CMS with populated agent and skill
   * relations, sorted by creation date in descending order (newest first).
   * This method is used to display the session list in the UI and supports
   * session management operations.
   *
   * **Population Strategy:**
   * Unlike getChatSession(), this method uses lighter population to improve
   * query performance when fetching multiple sessions. It populates:
   * - Skills (basic info only - name, documentId)
   * - Agent with full config (toolConfig, modelConfig, mcpConfig)
   * - MCP server details within agent's mcpConfig
   *
   * **Sorting:**
   * Sessions are sorted by createdAt in descending order, ensuring the most
   * recent conversations appear first in the list. This matches typical chat
   * application UX patterns.
   *
   * **Use Cases:**
   * - Display session list in chat UI sidebar
   * - Browse conversation history
   * - Session management dashboard
   * - Search and filter sessions
   * - Export conversation data
   * - Analytics and reporting
   *
   * **Performance Considerations:**
   * For applications with many sessions (>100), consider implementing:
   * - Pagination with Strapi's pagination params
   * - Filtering by status (active vs archived)
   * - Search by title or content
   * - Virtual scrolling in UI
   *
   * **Session Status Values:**
   * - `active`: Currently active conversation
   * - `archived`: Archived for historical reference
   *
   * @returns {Promise<ChatSession[]>} Array of chat sessions sorted by newest first
   *
   * @throws {Error} If the Strapi request fails
   *
   * @example
   * ```typescript
   * // Basic usage - get all sessions
   * import { chatService } from './chat-service';
   *
   * const sessions = await chatService.getAllChatSessions();
   *
   * console.log(`Total sessions: ${sessions.length}`);
   * sessions.forEach(session => {
   *   console.log(`- ${session.title} (${session.status})`);
   * });
   * // Output:
   * // Total sessions: 5
   * // - Code Review Chat (active)
   * // - Bug Fix Session (active)
   * // - Documentation Update (archived)
   * // - API Integration (active)
   * // - Refactoring Project (archived)
   * ```
   *
   * @example
   * ```typescript
   * // Filter active sessions only
   * import { chatService } from './chat-service';
   *
   * const allSessions = await chatService.getAllChatSessions();
   * const activeSessions = allSessions.filter(s => s.status === 'active');
   *
   * console.log(`Active sessions: ${activeSessions.length}/${allSessions.length}`);
   * ```
   *
   * @example
   * ```typescript
   * // Display session list with agent info
   * import { chatService } from './chat-service';
   *
   * const sessions = await chatService.getAllChatSessions();
   *
   * sessions.forEach(session => {
   *   const agentName = session.agent?.name || 'No agent';
   *   const skillCount = session.skills?.length || 0;
   *   const date = new Date(session.createdAt).toLocaleDateString();
   *
   *   console.log(`${session.title}`);
   *   console.log(`  Agent: ${agentName}`);
   *   console.log(`  Skills: ${skillCount}`);
   *   console.log(`  Created: ${date}`);
   *   console.log('---');
   * });
   * // Output:
   * // Code Review Chat
   * //   Agent: Code Reviewer
   * //   Skills: 2
   * //   Created: 1/2/2026
   * // ---
   * // Bug Fix Session
   * //   Agent: Debugging Expert
   * //   Skills: 3
   * //   Created: 1/1/2026
   * // ---
   * ```
   *
   * @example
   * ```typescript
   * // Search sessions by title
   * import { chatService } from './chat-service';
   *
   * async function searchSessions(query: string) {
   *   const allSessions = await chatService.getAllChatSessions();
   *   const matches = allSessions.filter(session =>
   *     session.title.toLowerCase().includes(query.toLowerCase())
   *   );
   *
   *   console.log(`Found ${matches.length} sessions matching "${query}"`);
   *   return matches;
   * }
   *
   * const results = await searchSessions('code review');
   * // => Found 3 sessions matching "code review"
   * ```
   *
   * @example
   * ```typescript
   * // Group sessions by date
   * import { chatService } from './chat-service';
   *
   * const sessions = await chatService.getAllChatSessions();
   *
   * const today = new Date().toDateString();
   * const todaySessions = sessions.filter(s =>
   *   new Date(s.createdAt).toDateString() === today
   * );
   *
   * console.log(`Today's sessions: ${todaySessions.length}`);
   * ```
   *
   * @example
   * ```typescript
   * // Export session list for reporting
   * import { chatService } from './chat-service';
   * import fs from 'fs';
   *
   * const sessions = await chatService.getAllChatSessions();
   *
   * const report = sessions.map(s => ({
   *   title: s.title,
   *   status: s.status,
   *   agent: s.agent?.name || 'None',
   *   skills: s.skills?.map(sk => sk.name).join(', ') || 'None',
   *   created: s.createdAt,
   * }));
   *
   * fs.writeFileSync('sessions-report.json', JSON.stringify(report, null, 2));
   * console.log('Report exported');
   * ```
   *
   * @example
   * ```typescript
   * // Handle empty session list
   * import { chatService } from './chat-service';
   *
   * const sessions = await chatService.getAllChatSessions();
   *
   * if (sessions.length === 0) {
   *   console.log('No sessions found. Create your first chat!');
   * } else {
   *   console.log(`You have ${sessions.length} conversation(s)`);
   * }
   * ```
   *
   * @see {@link getChatSession} - Get a specific session
   * @see {@link createChatSession} - Create a new session
   * @see {@link archiveChatSession} - Archive a session
   * @see {@link deleteChatSession} - Delete a session permanently
   */
  async getAllChatSessions(): Promise<ChatSession[]> {
    try {
      const data = await this.strapiRequest('GET', '/chat-sessions', undefined, {
        sort: ['createdAt:desc'],
        populate: {
          skills: true,
          agent: {
            populate: {
              toolConfig: true,
              modelConfig: true,
              mcpConfig: {
                populate: {
                  mcpServer: true,
                  selectedTools: {
                    populate: { mcpTool: true },
                  },
                },
              },
            },
          },
        },
      });

      return data.data.map((item: any) => this.transformChatSession(item));
    } catch (error) {
      this.logger.error('Failed to get chat sessions', error);
      throw error;
    }
  }

  /**
   * Get all messages for a chat session sorted by timestamp
   *
   * @description
   * Retrieves all chat messages (user, assistant, system) for a specific chat
   * session from Strapi CMS, sorted by timestamp in ascending order (chronological).
   * This method is used to display the conversation history in the chat UI and
   * supports message replay and export functionality.
   *
   * **Message Loading Strategy:**
   * The method retrieves messages through the session's populated messages relation
   * rather than querying the chat-messages collection directly. This approach:
   * - Avoids Strapi v5 issues with filtering on relations
   * - Ensures consistent message ordering by timestamp
   * - Returns empty array if session doesn't exist (graceful degradation)
   * - Automatically filters messages for the specific session
   *
   * **Message Types:**
   * - `user`: Messages sent by the user (with optional attachments)
   * - `assistant`: Responses from Claude AI (with tool uses, cost, usage metadata)
   * - `system`: System notifications or status messages
   *
   * **Message Metadata:**
   * Each message may include metadata:
   * - User messages: Typically minimal or empty metadata
   * - Assistant messages: toolUses[], cost (USD), usage (token counts)
   * - System messages: Initialization or status information
   *
   * **Attachment Handling:**
   * Messages may have file attachments (images, PDFs, text files) referenced
   * by Strapi upload IDs. The attachment objects include name, URL, MIME type,
   * and file size for display and download.
   *
   * **Use Cases:**
   * - Display conversation history in chat UI
   * - Export chat transcript
   * - Search message content
   * - Calculate conversation cost (sum assistant message costs)
   * - Analyze tool usage patterns
   * - Replay conversations for debugging
   *
   * @param {string} sessionDocId - The documentId of the chat session
   *
   * @returns {Promise<ChatMessage[]>} Array of messages sorted by timestamp (oldest first)
   *
   * @throws {Error} If the Strapi request fails (but returns empty array if session not found)
   *
   * @example
   * ```typescript
   * // Basic usage - get all messages
   * import { chatService } from './chat-service';
   *
   * const messages = await chatService.getChatMessages('session-doc-id-123');
   *
   * console.log(`Total messages: ${messages.length}`);
   * messages.forEach(msg => {
   *   console.log(`[${msg.role}] ${msg.content.substring(0, 50)}...`);
   * });
   * // Output:
   * // Total messages: 6
   * // [user] Review the authentication code in src/auth.ts...
   * // [assistant] I'll analyze the authentication code. Let me...
   * // [user] Can you also check for security vulnerabilities?...
   * // [assistant] I found 3 security issues: ...
   * ```
   *
   * @example
   * ```typescript
   * // Display conversation with timestamps
   * import { chatService } from './chat-service';
   *
   * const messages = await chatService.getChatMessages('session-doc-id-123');
   *
   * messages.forEach(msg => {
   *   const time = new Date(msg.timestamp).toLocaleTimeString();
   *   const role = msg.role.toUpperCase();
   *   console.log(`[${time}] ${role}:`);
   *   console.log(msg.content);
   *   console.log('---');
   * });
   * // Output:
   * // [2:30:15 PM] USER:
   * // Review the code
   * // ---
   * // [2:30:22 PM] ASSISTANT:
   * // I'll review the code for you...
   * // ---
   * ```
   *
   * @example
   * ```typescript
   * // Calculate total conversation cost
   * import { chatService } from './chat-service';
   *
   * const messages = await chatService.getChatMessages('session-doc-id-123');
   *
   * const totalCost = messages
   *   .filter(msg => msg.role === 'assistant')
   *   .reduce((sum, msg) => sum + (msg.metadata?.cost || 0), 0);
   *
   * console.log(`Total cost: $${totalCost.toFixed(4)}`);
   * // => Total cost: $0.0125
   * ```
   *
   * @example
   * ```typescript
   * // Export conversation transcript
   * import { chatService } from './chat-service';
   * import fs from 'fs';
   *
   * const session = await chatService.getChatSession('session-doc-id-123');
   * const messages = await chatService.getChatMessages('session-doc-id-123');
   *
   * const transcript = {
   *   session: {
   *     title: session.title,
   *     agent: session.agent?.name,
   *     created: session.createdAt,
   *   },
   *   messages: messages.map(msg => ({
   *     timestamp: msg.timestamp,
   *     role: msg.role,
   *     content: msg.content,
   *     attachments: msg.attachments?.map(a => a.name),
   *     cost: msg.metadata?.cost,
   *   })),
   * };
   *
   * fs.writeFileSync('transcript.json', JSON.stringify(transcript, null, 2));
   * console.log('Transcript exported');
   * ```
   *
   * @example
   * ```typescript
   * // Analyze tool usage in conversation
   * import { chatService } from './chat-service';
   *
   * const messages = await chatService.getChatMessages('session-doc-id-123');
   *
   * const toolUses = messages
   *   .filter(msg => msg.role === 'assistant')
   *   .flatMap(msg => msg.metadata?.toolUses || []);
   *
   * const toolCounts = toolUses.reduce((acc, tool) => {
   *   acc[tool.name] = (acc[tool.name] || 0) + 1;
   *   return acc;
   * }, {} as Record<string, number>);
   *
   * console.log('Tool usage:');
   * Object.entries(toolCounts).forEach(([tool, count]) => {
   *   console.log(`  ${tool}: ${count}`);
   * });
   * // Output:
   * // Tool usage:
   * //   Read: 5
   * //   Grep: 2
   * //   Write: 3
   * //   Bash: 1
   * ```
   *
   * @example
   * ```typescript
   * // Get messages with attachments only
   * import { chatService } from './chat-service';
   *
   * const messages = await chatService.getChatMessages('session-doc-id-123');
   * const messagesWithAttachments = messages.filter(msg =>
   *   msg.attachments && msg.attachments.length > 0
   * );
   *
   * console.log(`Messages with attachments: ${messagesWithAttachments.length}`);
   * messagesWithAttachments.forEach(msg => {
   *   console.log(`- ${msg.role}: ${msg.attachments?.map(a => a.name).join(', ')}`);
   * });
   * // Output:
   * // Messages with attachments: 2
   * // - user: diagram.png
   * // - user: report.pdf, config.json
   * ```
   *
   * @example
   * ```typescript
   * // Handle empty message list
   * import { chatService } from './chat-service';
   *
   * const messages = await chatService.getChatMessages('session-doc-id-123');
   *
   * if (messages.length === 0) {
   *   console.log('No messages yet. Start the conversation!');
   * } else {
   *   console.log(`${messages.length} messages in conversation`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Handle session not found gracefully
   * import { chatService } from './chat-service';
   *
   * const messages = await chatService.getChatMessages('invalid-session-id');
   * // Returns empty array instead of throwing error
   * console.log(messages.length); // => 0
   * ```
   *
   * @see {@link getChatSession} - Get the parent session
   * @see {@link sendMessage} - Send a new message to the session
   * @see {@link saveChatMessage} - Internal method used to save messages
   */
  async getChatMessages(sessionDocId: string): Promise<ChatMessage[]> {
    try {
      // Get session with populated messages (avoid direct filter on relations)
      const sessionData = await this.strapiRequest('GET', `/chat-sessions/${sessionDocId}`, undefined, {
        populate: {
          messages: {
            sort: ['timestamp:asc'],
          },
        },
      });

      if (!sessionData.data) {
        this.logger.warn('Chat session not found', { sessionDocId });
        return []; // Return empty array if session doesn't exist
      }

      const messages = sessionData.data.messages || [];
      this.logger.info('Messages fetched successfully', { count: messages.length });

      return messages.map((item: any) => this.transformChatMessage(item));
    } catch (error) {
      this.logger.error('Failed to get chat messages', error, { sessionDocId });
      throw error;
    }
  }

  /**
   * Save a chat message to Strapi
   *
   * @description
   * Persists a chat message (user, assistant, or system) to the Strapi CMS database
   * with optional file attachments and metadata. This method is called internally by
   * sendMessage() to save both user messages (before streaming) and assistant messages
   * (after streaming completes).
   *
   * The saved message is associated with a chat session via the session documentId
   * and includes a timestamp for message ordering. Attachments are referenced by their
   * Strapi file upload IDs.
   *
   * **Key Features:**
   * - Saves message to Strapi chat-messages collection
   * - Associates message with chat session via session documentId
   * - Supports file attachments (images, PDFs, text files) via attachment IDs
   * - Stores arbitrary metadata (tool uses, cost, usage stats, etc.)
   * - Auto-generates ISO timestamp for message ordering
   * - Returns transformed ChatMessage with documentId for future reference
   *
   * **Message Metadata Usage:**
   * - User messages: Typically empty or minimal metadata
   * - Assistant messages: Includes toolUses[], cost (USD), usage (tokens)
   * - System messages: May include initialization or status information
   *
   * **Database Schema:**
   * The message is saved to Strapi with the following fields:
   * - session: documentId of the parent ChatSession
   * - role: 'user' | 'assistant' | 'system'
   * - content: Full message text content
   * - attachments: Array of Strapi file IDs (Many-to-many relation)
   * - metadata: JSON object with custom data (toolUses, cost, usage, etc.)
   * - timestamp: ISO 8601 timestamp for message ordering
   *
   * @param {string} sessionDocId - The documentId of the parent chat session
   * @param {'user' | 'assistant' | 'system'} role - Message sender role
   * @param {string} content - The message text content (may be empty for tool-only messages)
   * @param {number[]} [attachmentIds] - Optional array of Strapi file upload IDs
   * @param {any} [metadata] - Optional metadata object (toolUses, cost, usage, etc.)
   *
   * @returns {Promise<ChatMessage>} The saved message with documentId and timestamps
   *
   * @throws {Error} If the Strapi API request fails or returns invalid data
   *
   * @example
   * ```typescript
   * // Save user message with image attachment
   * const buffer = await fs.readFile('./diagram.png');
   * const uploaded = await strapiClient.uploadFile(buffer, 'diagram.png');
   *
   * const userMessage = await this.saveChatMessage(
   *   'session-doc-id-123',
   *   'user',
   *   'Can you analyze this diagram?',
   *   [uploaded.id], // Attachment IDs
   *   {} // No metadata
   * );
   *
   * console.log('Saved user message:', userMessage.documentId);
   * // => Saved user message: msg_xyz789
   * ```
   *
   * @example
   * ```typescript
   * // Save assistant message with tool uses and cost
   * const assistantMessage = await this.saveChatMessage(
   *   'session-doc-id-123',
   *   'assistant',
   *   'I analyzed the code and found 3 issues...',
   *   undefined, // No attachments
   *   {
   *     toolUses: [
   *       { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'src/auth.ts' } },
   *       { type: 'tool_use', id: 'toolu_2', name: 'Grep', input: { pattern: 'TODO' } }
   *     ],
   *     cost: 0.0025, // $0.0025 USD
   *     usage: {
   *       input_tokens: 1234,
   *       output_tokens: 567,
   *       cache_creation_input_tokens: 0,
   *       cache_read_input_tokens: 890
   *     }
   *   }
   * );
   *
   * console.log('Assistant message cost:', assistantMessage.metadata?.cost);
   * // => Assistant message cost: 0.0025
   * ```
   *
   * @example
   * ```typescript
   * // Save system message with initialization metadata
   * const systemMessage = await this.saveChatMessage(
   *   'session-doc-id-123',
   *   'system',
   *   'Session initialized with claude-sonnet-4-5',
   *   undefined,
   *   {
   *     sessionId: 'sdk_session_abc123',
   *     model: 'claude-sonnet-4-5',
   *     tools: ['Read', 'Write', 'Bash', 'Grep'],
   *     permissionMode: 'default'
   *   }
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Handle save errors gracefully
   * try {
   *   const message = await this.saveChatMessage(
   *     'invalid-session-id',
   *     'user',
   *     'Hello',
   *     undefined,
   *     {}
   *   );
   * } catch (error) {
   *   console.error('Failed to save message:', error);
   *   // Error: Chat session invalid-session-id not found
   * }
   * ```
   *
   * @private
   * @see {@link sendMessage} - Uses this method to save user and assistant messages
   * @see {@link ChatMessage} - The returned message type
   */
  private async saveChatMessage(
    sessionDocId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    attachmentIds?: number[],
    metadata?: any
  ): Promise<ChatMessage> {
    try {
      const data = await this.strapiRequest('POST', '/chat-messages', {
        data: {
          session: sessionDocId,
          role,
          content,
          attachments: attachmentIds,
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
        },
      });

      if (!data.data) {
        throw new Error('Failed to save chat message');
      }

      return this.transformChatMessage(data.data);
    } catch (error) {
      this.logger.error('Failed to save chat message', error);
      throw error;
    }
  }

  /**
   * Send a message and stream response from Claude Agent SDK
   *
   * @description
   * Core async generator method that sends a user message to Claude AI and streams
   * the assistant's response in real-time. This method orchestrates the complete
   * conversation lifecycle including message persistence, skill synchronization,
   * agent configuration, MCP server setup, SDK query execution, and streaming events.
   *
   * **AsyncGenerator Streaming Pattern:**
   * This method uses AsyncGenerator to yield events as they occur, enabling real-time
   * UI updates and responsive user experience. The frontend can consume events using
   * `for await (const event of chatService.sendMessage(...))` pattern.
   *
   * **Yielded Event Types:**
   * 1. **user_message_saved** - User message saved to Strapi (before streaming)
   * 2. **stream_id** - Unique stream ID for cancellation support
   * 3. **sdk_message** - Raw SDK message (system, assistant, result, stream_event)
   * 4. **assistant_message_start** - Assistant message streaming started
   * 5. **assistant_message_delta** - Real-time text delta from Claude
   * 6. **assistant_message_saved** - Complete assistant message saved to Strapi
   * 7. **done** - Conversation complete with cost and usage metadata
   * 8. **error** - Error occurred during streaming
   * 9. **cancelled** - Stream was cancelled by user
   *
   * **Message Flow:**
   * 1. Fetch chat session with agent and skill configurations
   * 2. Sync skills to filesystem (.claude/skills/*.md files)
   * 3. Upload attachments to Strapi and save user message
   * 4. Yield 'user_message_saved' event
   * 5. Build SDK options (model, systemPrompt, permissions, tools, mcpServers)
   * 6. Create SDK Query with AsyncGenerator prompt and AbortController
   * 7. Yield 'stream_id' event (enables cancellation via cancelMessage)
   * 8. Stream SDK messages and yield 'sdk_message' events
   * 9. Accumulate assistant text from content_block_delta stream events
   * 10. Yield 'assistant_message_delta' events for real-time UI updates
   * 11. Save complete assistant message to Strapi and chat log
   * 12. Yield 'assistant_message_saved' event
   * 13. Yield 'done' event with cost/usage metadata
   *
   * **Agent Override:**
   * Supports per-message agent override via the agentId parameter. This allows
   * using different agents within the same chat session (e.g., switching between
   * a coding agent and a security review agent).
   *
   * **Skill Override:**
   * Supports per-message skill override via the skillIds parameter. This allows
   * using different skill sets for different messages in the same session.
   *
   * **Permission Modes:**
   * - **default**: User approves tool usage (except safe read-only tools)
   * - **bypass**: Auto-approve all tools (bypassPermissions)
   * - **auto**: Auto-approve Write/Edit tools (acceptEdits mode)
   * - **plan**: Read-only mode with Glob/Read/Grep/Skill tools only
   *
   * **Plan Mode:**
   * When permissionMode is 'plan', the service restricts to read-only tools and
   * adds plan mode instructions to the system prompt. Claude analyzes the codebase
   * and presents a detailed implementation plan without making any changes.
   *
   * **File Attachment Support:**
   * - Images: Sent as base64-encoded image blocks (image/png, image/jpeg, etc.)
   * - PDFs: Sent as document blocks (application/pdf) - SDK processes page by page
   * - Text: Sent as inline text content with file name header
   *
   * **MCP Server Integration:**
   * Loads MCP servers from agent's mcpConfig (Strapi) and .mcp.json file (project root).
   * Only includes servers enabled in the agent's mcpConfig. Merges command/args from
   * .mcp.json with server selection from mcpConfig.
   *
   * **Stream Cancellation:**
   * Each stream has a unique streamId (UUID) yielded in the 'stream_id' event.
   * The client can call cancelMessage(streamId) to abort the stream gracefully.
   * The SDK Query respects the abort signal and stops processing immediately.
   *
   * @param {string} sessionDocId - The documentId of the chat session
   * @param {string} message - The user's message text
   * @param {SendMessageRequest['attachments']} attachments - Optional file attachments (images, PDFs, text files)
   * @param {string} workingDirectory - Working directory for SDK execution (project root)
   * @param {'default' | 'bypass' | 'auto' | 'plan'} [permissionMode] - Permission mode override (defaults to session mode)
   * @param {string} [agentId] - Optional agent override (defaults to session agent)
   * @param {string[]} [skillIds] - Optional skill override (defaults to session skills)
   *
   * @yields {Object} Stream events with different types:
   *   - `{ type: 'user_message_saved', message: ChatMessage }` - User message persisted
   *   - `{ type: 'stream_id', streamId: string, timestamp: string }` - Stream ID for cancellation
   *   - `{ type: 'sdk_message', data: SdkMessage }` - Raw SDK message (system, assistant, result, etc.)
   *   - `{ type: 'assistant_message_start', messageId: string, timestamp: string }` - Streaming started
   *   - `{ type: 'assistant_message_delta', delta: string, messageId: string, timestamp: string }` - Text delta
   *   - `{ type: 'assistant_message_saved', message: ChatMessage }` - Assistant message persisted
   *   - `{ type: 'done', cost: number, usage: object }` - Conversation complete
   *   - `{ type: 'error', error: string }` - Error occurred
   *   - `{ type: 'cancelled', streamId: string, timestamp: string, reason: string }` - Stream cancelled
   *
   * @returns {AsyncGenerator<any>} Async generator yielding stream events
   *
   * @throws {Error} If chat session is not found or SDK query fails
   *
   * @example
   * ```typescript
   * // Basic message streaming with event handling
   * import { chatService } from './chat-service';
   *
   * const sessionDocId = 'chat-session-doc-id';
   * const message = 'Review the authentication code in src/auth.ts';
   *
   * for await (const event of chatService.sendMessage(
   *   sessionDocId,
   *   message,
   *   [], // No attachments
   *   '/path/to/project'
   * )) {
   *   switch (event.type) {
   *     case 'user_message_saved':
   *       console.log('User message saved:', event.message.documentId);
   *       break;
   *     case 'stream_id':
   *       console.log('Stream ID:', event.streamId);
   *       // Store for potential cancellation
   *       currentStreamId = event.streamId;
   *       break;
   *     case 'assistant_message_delta':
   *       // Real-time streaming text
   *       process.stdout.write(event.delta);
   *       break;
   *     case 'assistant_message_saved':
   *       console.log('\nAssistant response saved');
   *       break;
   *     case 'done':
   *       console.log('Cost: $' + event.cost);
   *       break;
   *     case 'error':
   *       console.error('Error:', event.error);
   *       break;
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Send message with image attachment
   * import { chatService } from './chat-service';
   * import fs from 'fs';
   *
   * const imageBuffer = fs.readFileSync('./architecture-diagram.png');
   * const attachments = [{
   *   name: 'architecture-diagram.png',
   *   mimeType: 'image/png',
   *   data: imageBuffer.toString('base64')
   * }];
   *
   * for await (const event of chatService.sendMessage(
   *   'session-doc-id',
   *   'Analyze this architecture diagram and suggest improvements',
   *   attachments,
   *   '/path/to/project'
   * )) {
   *   if (event.type === 'assistant_message_delta') {
   *     updateUI(event.delta); // Real-time UI update
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Use plan mode for read-only analysis
   * import { chatService } from './chat-service';
   *
   * for await (const event of chatService.sendMessage(
   *   'session-doc-id',
   *   'Create a detailed plan to add user authentication',
   *   [],
   *   '/path/to/project',
   *   'plan' // Read-only mode - no file modifications
   * )) {
   *   if (event.type === 'assistant_message_delta') {
   *     console.log(event.delta); // Claude presents implementation plan
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Override agent per message
   * import { chatService } from './chat-service';
   *
   * // First message uses default agent
   * for await (const event of chatService.sendMessage(
   *   'session-doc-id',
   *   'Write a test file',
   *   [],
   *   '/path/to/project'
   * )) { /* ... */ }
   *
   * // Second message overrides with security specialist agent
   * for await (const event of chatService.sendMessage(
   *   'session-doc-id',
   *   'Review this code for security vulnerabilities',
   *   [],
   *   '/path/to/project',
   *   undefined, // Use session permission mode
   *   'security-agent-id' // Override with security agent
   * )) { /* ... */ }
   * ```
   *
   * @example
   * ```typescript
   * // Stream cancellation with AbortController
   * import { chatService } from './chat-service';
   *
   * let currentStreamId: string | null = null;
   *
   * // Start streaming
   * const streamPromise = (async () => {
   *   for await (const event of chatService.sendMessage(
   *     'session-doc-id',
   *     'This is a long running task...',
   *     [],
   *     '/path/to/project'
   *   )) {
   *     if (event.type === 'stream_id') {
   *       currentStreamId = event.streamId;
   *     }
   *     if (event.type === 'cancelled') {
   *       console.log('Stream cancelled:', event.reason);
   *     }
   *   }
   * })();
   *
   * // Cancel after 5 seconds
   * setTimeout(() => {
   *   if (currentStreamId) {
   *     chatService.cancelMessage(currentStreamId);
   *   }
   * }, 5000);
   * ```
   *
   * @example
   * ```typescript
   * // Collect SDK messages for debugging
   * import { chatService } from './chat-service';
   *
   * const sdkMessages: any[] = [];
   *
   * for await (const event of chatService.sendMessage(
   *   'session-doc-id',
   *   'Debug this error',
   *   [],
   *   '/path/to/project'
   * )) {
   *   if (event.type === 'sdk_message') {
   *     sdkMessages.push(event.data);
   *     console.log('SDK event:', event.data.type, event.data.subtype);
   *   }
   *   if (event.type === 'done') {
   *     console.log('Total SDK messages:', sdkMessages.length);
   *     fs.writeFileSync('sdk-debug.json', JSON.stringify(sdkMessages, null, 2));
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Override skills per message
   * import { chatService } from './chat-service';
   *
   * // Use different skill set for this specific message
   * for await (const event of chatService.sendMessage(
   *   'session-doc-id',
   *   'Generate API documentation',
   *   [],
   *   '/path/to/project',
   *   undefined, // Use session permission mode
   *   undefined, // Use session agent
   *   ['documentation-skill-id', 'api-skill-id'] // Override skills
   * )) {
   *   if (event.type === 'assistant_message_delta') {
   *     console.log(event.delta);
   *   }
   * }
   * ```
   *
   * @see {@link cancelMessage} - Cancel an active stream
   * @see {@link buildPromptGenerator} - Builds the AsyncGenerator prompt for SDK
   * @see {@link saveChatMessage} - Saves messages to Strapi
   * @see {@link https://docs.anthropic.com/en/api/agent-sdk|Claude Agent SDK Documentation}
   */
  async* sendMessage(
    sessionDocId: string,
    message: string,
    attachments: SendMessageRequest['attachments'],
    workingDirectory: string,
    permissionMode?: 'default' | 'bypass' | 'auto' | 'plan',
    agentId?: string,
    skillIds?: string[]
  ): AsyncGenerator<any> {
    try {
      this.logger.info('Sending chat message', { sessionDocId, messageLength: message.length, attachmentCount: attachments?.length || 0 });

      // Get chat session
      const session = await this.getChatSession(sessionDocId);

      // Determine effective skills: use provided skillIds or fallback to session skills
      const effectiveSkillIds = skillIds || session.skills?.map(skill => skill.documentId) || [];

      // Sync skills to filesystem
      if (effectiveSkillIds.length > 0) {
        try {
          const { skillSyncService } = await import('./skill-sync-service.js');

          // Fetch full skill details from Strapi
          const fullSkills = await strapiClient.getSkillsByIds(effectiveSkillIds);

          // Sync skills to filesystem
          await skillSyncService.syncAllSkills(fullSkills);

          this.logger.info('Synced skills to filesystem', {
            sessionId: sessionDocId,
            skillCount: fullSkills.length,
            skillNames: fullSkills.map(s => s.name),
            overridden: !!skillIds
          });
        } catch (syncError) {
          this.logger.error('Failed to sync skills for chat', syncError);
          // Continue execution - skills won't be available but chat still works
        }
      }

      // Save user message to Strapi
      let attachmentIds: number[] = [];
      if (attachments && attachments.length > 0) {
        // Upload attachments to Strapi
        for (const attachment of attachments) {
          const buffer = Buffer.from(attachment.data, 'base64');
          const uploaded = await strapiClient.uploadFile(buffer, attachment.name);
          attachmentIds.push(uploaded.id);
        }
      }

      const userMessage = await this.saveChatMessage(
        sessionDocId,
        'user',
        message,
        attachmentIds
      );

      yield {
        type: 'user_message_saved',
        message: userMessage,
      };

      // Add user message to log
      await chatLogService.addMessageToLog(sessionDocId, userMessage);

      // Auto-update title if it's "New Chat" (first message)
      if (session.title === 'New Chat') {
        try {
          // Generate title from first message (first 50 chars)
          const autoTitle = message.length > 50
            ? message.substring(0, 50) + '...'
            : message;

          await this.strapiRequest('PUT', `/chat-sessions/${sessionDocId}`, {
            data: { title: autoTitle },
          });

          this.logger.info('Auto-updated chat title', {
            sessionId: sessionDocId,
            newTitle: autoTitle
          });
        } catch (error) {
          this.logger.warn('Failed to auto-update chat title', error);
          // Don't fail the chat if title update fails
        }
      }

      // Build SDK options
      // Use provided modes or fallback to session modes
      const requestedMode = permissionMode ?? session.permissionMode ?? 'default';

      // Check if plan mode is requested
      const effectivePlanMode = requestedMode === 'plan' || session.planMode || false;

      // Map our permission mode to SDK's PermissionMode
      const mapPermissionMode = (mode: string): PermissionMode => {
        switch (mode) {
          case 'bypass': return 'bypassPermissions';
          case 'auto': return 'acceptEdits';
          case 'plan': return 'default'; // Plan mode uses default permission with planMode flag
          case 'default':
          default: return 'default';
        }
      };

      const effectivePermissionMode = mapPermissionMode(requestedMode);

      // Determine effective agent: use provided agentId or fallback to session agent
      let effectiveAgent = session.agent;
      if (agentId && agentId !== session.agent?.documentId) {
        try {
          // Fetch agent with full population
          const agentData = await strapiClient.getAgent(agentId);
          if (agentData) {
            effectiveAgent = {
              id: agentData.id ? Number(agentData.id) : 0,
              documentId: agentData.id, // Agent uses id as documentId
              name: agentData.name,
              systemPrompt: agentData.systemPrompt,
              toolConfig: agentData.toolConfig,
              modelConfig: agentData.modelConfig,
              mcpConfig: agentData.mcpConfig
            };
            this.logger.info('Using per-message agent override', {
              sessionId: sessionDocId,
              agentId: agentId,
              agentName: effectiveAgent?.name
            });
          }
        } catch (agentError) {
          this.logger.error('Failed to fetch agent override', agentError);
          // Fallback to session agent
        }
      }

      // Build systemPrompt from effective agent or customSystemPrompt
      let systemPrompt: string | undefined;
      if (effectiveAgent) {
        systemPrompt = effectiveAgent.systemPrompt;
        this.logger.info('Using agent system prompt', {
          sessionId: sessionDocId,
          agentId: effectiveAgent.documentId,
          agentName: effectiveAgent.name
        });
      } else if (session.customSystemPrompt) {
        systemPrompt = session.customSystemPrompt;
        this.logger.info('Using custom system prompt', { sessionId: sessionDocId });
      }

      // Get model from effective agent config or use default
      const modelName = effectiveAgent?.modelConfig?.model || 'claude-sonnet-4-5';

      // Get allowed tools from effective agent config or use defaults
      const allowedTools = effectiveAgent?.toolConfig?.allowedTools || [
        'Read', 'Write', 'Bash', 'Grep', 'Glob', 'Skill', 'Edit'
      ];

      // Get disallowed tools from effective agent config
      const disallowedTools = effectiveAgent?.toolConfig?.disallowedTools || [];
      // Build MCP servers from effective agent's mcpConfig
      let mcpServers: Record<string, any> | undefined;
      if (effectiveAgent?.mcpConfig && Array.isArray(effectiveAgent.mcpConfig) && effectiveAgent.mcpConfig.length > 0) {
        try {
          mcpServers = await this.buildMcpServersFromAgentConfig(effectiveAgent.mcpConfig, workingDirectory);
          this.logger.info('Built MCP servers from agent config', {
            sessionId: sessionDocId,
            serverCount: mcpServers ? Object.keys(mcpServers).length : 0
          });
        } catch (mcpError) {
          this.logger.warn('Failed to build MCP servers from agent config', { error: mcpError });
        }
      }

      const options: Options = {
        model: modelName,
        systemPrompt: systemPrompt,
        permissionMode: effectivePermissionMode,
        includePartialMessages: true,
        settingSources: ['project'], // Load skills from filesystem
        cwd: workingDirectory,
        allowedTools: allowedTools,
        disallowedTools: disallowedTools,
        mcpServers: mcpServers,

        // Tool permission callback - handles runtime permission checks
        canUseTool: async (toolName: string, input: any) => {
          // Log tool permission request
          await chatLogService.addSdkEvent(sessionDocId, sdkCallId, {
            timestamp: new Date().toISOString(),
            type: 'tool_permission_request',
            data: { toolName, input }
          });

          this.logger.info('Tool permission requested', { toolName, mode: effectivePermissionMode, sessionId: sessionDocId });

          // Auto-approve safe read-only tools
          const autoApprovedTools = ['Read', 'Glob', 'Grep', 'Skill'];
          if (autoApprovedTools.includes(toolName)) {
            this.logger.debug('Tool auto-approved (safe read-only)', { toolName });
            return { behavior: 'allow' as const, updatedInput: input };
          }

          // In bypassPermissions mode, allow all tools
          if (effectivePermissionMode === 'bypassPermissions') {
            this.logger.debug('Tool approved (bypass mode)', { toolName });
            return { behavior: 'allow' as const, updatedInput: input };
          }

          // In acceptEdits mode, auto-approve Write/Edit tools
          if (['Write', 'Edit'].includes(toolName) && effectivePermissionMode === 'acceptEdits') {
            this.logger.debug('Tool auto-approved (acceptEdits mode)', { toolName });
            return { behavior: 'allow' as const, updatedInput: input };
          }

          // For Bash commands in acceptEdits mode, check if safe filesystem operation
          if (toolName === 'Bash' && effectivePermissionMode === 'acceptEdits') {
            const command = typeof input === 'object' ? input.command : input;
            const safeCommands = ['mkdir', 'touch', 'mv', 'cp'];
            if (typeof command === 'string' && safeCommands.some(cmd => command.trim().startsWith(cmd))) {
              this.logger.debug('Bash command auto-approved (acceptEdits mode)', { command });
              return { behavior: 'allow' as const, updatedInput: input };
            }
          }

          // Default: allow but log (TODO: implement user prompt for sensitive tools)
          this.logger.info('Tool approved by default', { toolName, mode: effectivePermissionMode });
          return { behavior: 'allow' as const, updatedInput: input };
        },

        // Hooks for fine-grained control over tool execution (SDK-compliant format)
        hooks: {
          PreToolUse: [{
            hooks: [async (hookInput: any, toolUseID: string | undefined, hookOptions: { signal: AbortSignal }) => {
              const toolName = hookInput.tool_name;
              const input = hookInput.tool_input;
              this.logger.info('Tool execution starting', { toolName, toolUseID, sessionId: sessionDocId });
              await chatLogService.addSdkEvent(sessionDocId, sdkCallId, {
                timestamp: new Date().toISOString(),
                type: 'tool_use_start',
                data: { toolName, input, toolUseID }
              });
              return { continue: true };
            }]
          }],
          PostToolUse: [{
            hooks: [async (hookInput: any, toolUseID: string | undefined, hookOptions: { signal: AbortSignal }) => {
              const toolName = hookInput.tool_name;
              const result = hookInput.tool_response;
              const resultSize = result ? JSON.stringify(result).length : 0;
              this.logger.info('Tool execution completed', { toolName, resultSize, toolUseID, sessionId: sessionDocId });
              await chatLogService.addSdkEvent(sessionDocId, sdkCallId, {
                timestamp: new Date().toISOString(),
                type: 'tool_use_complete',
                data: { toolName, result, toolUseID }
              });
              return { continue: true };
            }]
          }]
        }
      };

      // Enable plan mode if requested (custom implementation since SDK doesn't support it yet)
      if (effectivePlanMode) {
        this.logger.info('Plan mode enabled - restricting to read-only tools and adding plan instructions');

        // Restrict to read-only tools only
        options.allowedTools = ['Read', 'Grep', 'Glob', 'Skill'];

        // Add plan mode instructions to system prompt
        const planModeInstructions = `

IMPORTANT: You are in PLAN MODE. Your task is to:
1. Analyze the codebase using read-only tools (Read, Grep, Glob, Skill)
2. Present a detailed, step-by-step implementation plan
3. DO NOT make any changes (no Write, Edit, or Bash commands)
4. After presenting the plan, ask the user for approval before proceeding

Your plan should include:
- Files that need to be modified
- New files that need to be created
- Specific changes required in each file
- Testing approach
- Potential risks or considerations`;

        options.systemPrompt = (options.systemPrompt || '') + planModeInstructions;
      }

      // Resume session if sessionId exists
      if (session.sessionId) {
        options.resume = session.sessionId;
      }

      // Build prompt generator for streaming input mode
      const promptGenerator = this.buildPromptGenerator(message, attachments);

      // Generate SDK call ID for logging
      const sdkCallId = uuidv4();

      // Log SDK call start (before creating query)
      const promptForLog = {
        type: 'user',
        message: {
          role: 'user',
          content: attachments && attachments.length > 0
            ? [{ type: 'text', text: message }, { type: 'attachments', count: attachments.length }]
            : message,
        },
      };

      await chatLogService.startSdkCall(sessionDocId, sdkCallId, userMessage.documentId, {
        options: {
          model: options.model || 'claude-sonnet-4-5',
          permissionMode: options.permissionMode || 'default',
          includePartialMessages: options.includePartialMessages || false,
          settingSources: options.settingSources || [],
          cwd: options.cwd || workingDirectory,
          allowedTools: options.allowedTools || [],
          resume: options.resume,
        },
        prompt: promptForLog,
      });

      // Save SDK payload to logs/chat folder (similar to task logging)
      try {
        const sdkPayload = {
          prompt: promptForLog,
          options: {
            model: options.model || 'claude-sonnet-4-5',
            systemPrompt: options.systemPrompt, // Agent's system prompt
            permissionMode: options.permissionMode || 'default',
            planMode: (options as any).planMode || false, // Plan mode flag
            includePartialMessages: options.includePartialMessages || false,
            settingSources: options.settingSources || [],
            cwd: options.cwd || workingDirectory,
            allowedTools: options.allowedTools || [],
            disallowedTools: options.disallowedTools || [], // Disallowed tools from agent config
            mcpServers: options.mcpServers, // MCP servers from agent config
            resume: options.resume,
          },
        };

        const logsDir = path.join(workingDirectory, 'logs', 'chat');
        await fs.mkdir(logsDir, { recursive: true });
        const payloadPath = path.join(logsDir, `${sessionDocId}-${sdkCallId}-sdk-payload.json`);
        await fs.writeFile(payloadPath, JSON.stringify(sdkPayload, null, 2), 'utf-8');
        this.logger.info('Chat SDK payload saved', { sessionDocId, sdkCallId, payloadPath });
      } catch (payloadError) {
        this.logger.warn('Failed to save chat SDK payload', { sessionDocId, sdkCallId, error: payloadError });
      }

      // Create AbortController for cancellation support
      const abortController = new AbortController();
      const streamId = uuidv4();

      // Store abort controller for cancel capability
      this.activeAbortControllers.set(streamId, abortController);

      // Add abortController to options
      const optionsWithAbort: Options = {
        ...options,
        abortController,
      };

      // Create query instance
      const queryInstance = query({
        prompt: promptGenerator,
        options: optionsWithAbort,
      });

      this.activeStreams.set(streamId, queryInstance);

      // Send stream ID to client immediately for cancel capability
      yield {
        type: 'stream_id',
        streamId,
        timestamp: new Date().toISOString(),
      };

      let assistantMessageContent = '';
      let sdkSessionId: string | null = null;
      let toolUses: any[] = [];
      let finalCost: number | undefined;
      let finalUsage: any | undefined;
      let assistantMessageId: string | null = null;
      let hasStreamingStarted = false;

      try {
        // Stream messages from SDK
        for await (const msg of queryInstance) {
          // Enhanced logging - similar to task execution logs
          const timestamp = new Date().toISOString();

          // Determine message category for better organization
          let eventCategory = 'sdk_event';
          let eventDetails: any = {
            messageType: msg.type,
            subtype: (msg as any).subtype,
          };

          // Categorize and extract details for different message types
          if (msg.type === 'system') {
            eventCategory = 'system';
            if (msg.subtype === 'init') {
              eventDetails.sessionId = msg.session_id;
              eventDetails.model = msg.model;
              eventDetails.tools = msg.tools;
              eventDetails.permissionMode = msg.permissionMode;
            }
          } else if (msg.type === 'assistant') {
            eventCategory = 'assistant_message';
            if (Array.isArray(msg.message.content)) {
              eventDetails.hasText = msg.message.content.some((b: any) => b.type === 'text');
              eventDetails.hasToolUse = msg.message.content.some((b: any) => b.type === 'tool_use');
              eventDetails.toolCount = msg.message.content.filter((b: any) => b.type === 'tool_use').length;

              // Extract tool use details
              const toolUseBlocks = msg.message.content.filter((b: any) => b.type === 'tool_use');
              if (toolUseBlocks.length > 0) {
                eventDetails.tools = toolUseBlocks.map((t: any) => ({
                  name: t.name,
                  id: t.id,
                }));
              }
            }
          } else if ('delta' in msg && (msg as any).delta?.type === 'text') {
            eventCategory = 'text_delta';
            eventDetails.textLength = (msg as any).delta.text?.length || 0;
          } else if (msg.type === 'result') {
            eventCategory = 'result';
            eventDetails.isError = msg.is_error;
            eventDetails.numTurns = msg.num_turns;
            eventDetails.totalCost = msg.total_cost_usd;
            eventDetails.duration = msg.duration_ms;
          }

          // Log SDK event with enhanced details
          await chatLogService.addSdkEvent(sessionDocId, sdkCallId, {
            timestamp,
            type: msg.type,
            subtype: (msg as any).subtype,
            category: eventCategory,
            details: eventDetails,
            data: msg,
          });

          // Log detailed info for debugging
          if (eventCategory === 'assistant_message' && eventDetails.hasToolUse) {
            this.logger.info('Tool use detected in assistant message', {
              sessionId: sessionDocId,
              callId: sdkCallId,
              tools: eventDetails.tools,
            });
          }

          // Yield message to client immediately
          yield {
            type: 'sdk_message',
            data: msg,
          };

          // Send assistant_message_start event on first text delta
          // Text deltas come as stream_event with type content_block_delta
          if (!hasStreamingStarted &&
              msg.type === 'stream_event' &&
              (msg as any).event?.type === 'content_block_delta' &&
              (msg as any).event?.delta?.type === 'text_delta') {
            hasStreamingStarted = true;
            assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            yield {
              type: 'assistant_message_start',
              messageId: assistantMessageId,
              timestamp: new Date().toISOString(),
            };
          }

          // Process different message types
          if (msg.type === 'system' && msg.subtype === 'init') {
            sdkSessionId = msg.session_id || null;

            // Update session with SDK session ID
            if (sdkSessionId && !session.sessionId) {
              await this.strapiRequest('PUT', `/chat-sessions/${sessionDocId}`, {
                data: { sessionId: sdkSessionId },
              });

              // Update SDK session ID in log
              await chatLogService.updateSdkSessionId(sessionDocId, sdkSessionId);
            }
          } else if (msg.type === 'assistant') {
            // Accumulate assistant message content
            if (Array.isArray(msg.message.content)) {
              for (const block of msg.message.content) {
                if (block.type === 'text') {
                  assistantMessageContent += block.text;
                } else if (block.type === 'tool_use') {
                  toolUses.push(block);
                }
              }
            }
          } else if (msg.type === 'stream_event' &&
                     (msg as any).event?.type === 'content_block_delta' &&
                     (msg as any).event?.delta?.type === 'text_delta') {
            // Real-time streaming text delta from stream_event
            const textDelta = (msg as any).event.delta.text;
            assistantMessageContent += textDelta;

            // Yield assistant_message_delta event for frontend
            if (assistantMessageId) {
              yield {
                type: 'assistant_message_delta',
                delta: textDelta,
                messageId: assistantMessageId,
                timestamp: new Date().toISOString(),
              };
            }
          } else if (msg.type === 'result') {
            // Final result with cost and usage
            finalCost = msg.total_cost_usd;
            finalUsage = msg.usage;
          }
        }

        // Save assistant message to Strapi
        if (assistantMessageContent || toolUses.length > 0) {
          const assistantMessage = await this.saveChatMessage(
            sessionDocId,
            'assistant',
            assistantMessageContent,
            undefined,
            {
              toolUses,
              cost: finalCost,
              usage: finalUsage,
            }
          );

          yield {
            type: 'assistant_message_saved',
            message: assistantMessage,
          };

          // Add assistant message to log
          await chatLogService.addMessageToLog(sessionDocId, assistantMessage);

          // Complete SDK call log
          await chatLogService.completeSdkCall(
            sessionDocId,
            sdkCallId,
            assistantMessage.documentId,
            {
              cost: finalCost,
              usage: finalUsage,
            }
          );
        }

        yield {
          type: 'done',
          cost: finalCost,
          usage: finalUsage,
        };

      } catch (streamError) {
        // Check if this was a cancellation (AbortController.abort())
        if (abortController.signal.aborted) {
          this.logger.info('Message stream was cancelled', { sessionDocId, streamId });

          // Don't save incomplete assistant message when cancelled

          yield {
            type: 'cancelled',
            streamId,
            timestamp: new Date().toISOString(),
            reason: 'User cancelled the request',
          };
        } else {
          // Real error - log and yield error event
          this.logger.error('Error during message streaming', streamError, { sessionDocId, streamId });
          yield {
            type: 'error',
            error: streamError instanceof Error ? streamError.message : String(streamError),
          };
        }
      } finally {
        // Cleanup: Remove from active streams and abort controllers
        this.activeStreams.delete(streamId);
        this.activeAbortControllers.delete(streamId);
      }

    } catch (error) {
      this.logger.error('Failed to send message', error, { sessionDocId });
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build async generator for streaming input mode to Claude Agent SDK
   *
   * @description
   * Creates an AsyncGenerator that yields a single user message with optional file
   * attachments to the Claude Agent SDK. This generator serves as the prompt input
   * for the SDK's query() function, which expects an AsyncGenerator to enable
   * streaming conversation patterns.
   *
   * The generator constructs a user message with content blocks based on the message
   * text and attachment types. It handles three types of attachments:
   * - **Images**: Sent as base64-encoded image blocks (PNG, JPEG, WebP, GIF)
   * - **PDFs**: Sent as document blocks - SDK extracts text and images page by page
   * - **Text files**: Included as inline text content with file name headers
   *
   * **AsyncGenerator Pattern:**
   * The SDK's query() function expects an AsyncGenerator<PromptMessage> as input
   * to enable streaming conversations where messages can be added dynamically.
   * This method creates a simple generator that yields a single user message
   * with all content blocks (text + attachments).
   *
   * **Content Block Structure:**
   * 1. **Text block**: `{ type: 'text', text: message }`
   * 2. **Image block**: `{ type: 'image', source: { type: 'base64', media_type, data } }`
   * 3. **Document block**: `{ type: 'document', source: { type: 'base64', media_type, data } }`
   * 4. **Text file block**: `{ type: 'text', text: '--- File: name ---\n...' }`
   *
   * **Supported Image Formats:**
   * - image/png, image/jpeg, image/jpg, image/webp, image/gif
   *
   * **Supported Document Formats:**
   * - application/pdf (SDK processes page by page, extracts text and images)
   *
   * **Text File Handling:**
   * Text files are decoded from base64 and included as inline text content
   * with file name headers for context. This allows Claude to reference the
   * file name when discussing the content.
   *
   * @param {string} message - The user's message text
   * @param {SendMessageRequest['attachments']} [attachments] - Optional file attachments
   *   Each attachment has: `{ name: string, mimeType: string, data: string (base64) }`
   *
   * @yields {Object} A single user message with content blocks:
   *   `{ type: 'user', message: { role: 'user', content: string | Array<ContentBlock> } }`
   *
   * @returns {AsyncGenerator<any>} Async generator yielding user message for SDK
   *
   * @example
   * ```typescript
   * // Simple text message
   * const generator = this.buildPromptGenerator('Hello Claude');
   *
   * for await (const msg of generator) {
   *   console.log(msg);
   * }
   * // Output:
   * // {
   * //   type: 'user',
   * //   message: {
   * //     role: 'user',
   * //     content: 'Hello Claude'
   * //   }
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Message with image attachment
   * import fs from 'fs';
   *
   * const imageBuffer = fs.readFileSync('./diagram.png');
   * const attachments = [{
   *   name: 'diagram.png',
   *   mimeType: 'image/png',
   *   data: imageBuffer.toString('base64')
   * }];
   *
   * const generator = this.buildPromptGenerator(
   *   'Analyze this diagram',
   *   attachments
   * );
   *
   * for await (const msg of generator) {
   *   console.log(msg);
   * }
   * // Output:
   * // {
   * //   type: 'user',
   * //   message: {
   * //     role: 'user',
   * //     content: [
   * //       { type: 'text', text: 'Analyze this diagram' },
   * //       {
   * //         type: 'image',
   * //         source: {
   * //           type: 'base64',
   * //           media_type: 'image/png',
   * //           data: 'iVBORw0KGgoAAAANS...'
   * //         }
   * //       }
   * //     ]
   * //   }
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Message with PDF document
   * import fs from 'fs';
   *
   * const pdfBuffer = fs.readFileSync('./report.pdf');
   * const attachments = [{
   *   name: 'report.pdf',
   *   mimeType: 'application/pdf',
   *   data: pdfBuffer.toString('base64')
   * }];
   *
   * const generator = this.buildPromptGenerator(
   *   'Summarize this report',
   *   attachments
   * );
   *
   * for await (const msg of generator) {
   *   console.log(msg.message.content[1].type);
   *   // => 'document'
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Message with text file
   * import fs from 'fs';
   *
   * const textBuffer = fs.readFileSync('./config.json');
   * const attachments = [{
   *   name: 'config.json',
   *   mimeType: 'text/plain',
   *   data: textBuffer.toString('base64')
   * }];
   *
   * const generator = this.buildPromptGenerator(
   *   'Review this configuration',
   *   attachments
   * );
   *
   * for await (const msg of generator) {
   *   console.log(msg.message.content[1].text);
   * }
   * // Output:
   * // --- File: config.json ---
   * // {
   * //   "port": 3000,
   * //   "host": "localhost"
   * // }
   * // --- End of file ---
   * ```
   *
   * @example
   * ```typescript
   * // Message with multiple attachments
   * const attachments = [
   *   { name: 'screenshot.png', mimeType: 'image/png', data: base64Image },
   *   { name: 'logs.txt', mimeType: 'text/plain', data: base64Text },
   *   { name: 'report.pdf', mimeType: 'application/pdf', data: base64Pdf }
   * ];
   *
   * const generator = this.buildPromptGenerator(
   *   'Debug this issue using these files',
   *   attachments
   * );
   *
   * for await (const msg of generator) {
   *   console.log('Content blocks:', msg.message.content.length);
   *   // => Content blocks: 4 (1 text + 1 image + 1 text file + 1 pdf)
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Use with SDK query() function
   * import { query } from '@anthropic-ai/claude-agent-sdk';
   *
   * const promptGenerator = this.buildPromptGenerator('Review the code');
   *
   * const queryInstance = query({
   *   prompt: promptGenerator,
   *   options: {
   *     model: 'claude-sonnet-4-5',
   *     systemPrompt: 'You are a code reviewer',
   *     cwd: '/path/to/project'
   *   }
   * });
   *
   * for await (const msg of queryInstance) {
   *   console.log('SDK message:', msg.type);
   * }
   * ```
   *
   * @private
   * @see {@link sendMessage} - Uses this generator to build SDK prompt
   * @see {@link https://docs.anthropic.com/en/api/agent-sdk|Claude Agent SDK Documentation}
   */
  private async* buildPromptGenerator(
    message: string,
    attachments?: SendMessageRequest['attachments']
  ): AsyncGenerator<any> {
    // Build content array
    const content: any[] = [{ type: 'text', text: message }];

    // Add attachments if present
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        const mimeType = attachment.mimeType;

        if (mimeType.startsWith('image/')) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: attachment.data,
            },
          });
        } else if (mimeType === 'application/pdf') {
          // PDF support - SDK will process page by page
          content.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: attachment.data,
            },
          });
        }
        // Text files can be included as text content
        else if (mimeType.startsWith('text/')) {
          const textContent = Buffer.from(attachment.data, 'base64').toString('utf-8');
          content.push({
            type: 'text',
            text: `\n\n--- File: ${attachment.name} ---\n${textContent}\n--- End of file ---\n`,
          });
        }
      }
    }

    // Yield user message
    yield {
      type: 'user',
      message: {
        role: 'user',
        content: content.length === 1 ? message : content,
      },
    };
  }

  /**
   * Permanently delete a chat session and all its messages
   *
   * @description
   * Permanently deletes a chat session from Strapi CMS along with all associated
   * messages and chat log files. This operation is irreversible and should be used
   * with caution. For non-destructive session management, consider using
   * archiveChatSession() instead.
   *
   * **Deletion Workflow:**
   * 1. Fetch all messages for the session via getChatMessages()
   * 2. Delete each message individually from Strapi chat-messages collection
   * 3. Delete the session from Strapi chat-sessions collection
   * 4. Delete the associated chat log file from filesystem
   * 5. Log successful deletion
   *
   * **Cascade Delete:**
   * The method manually implements cascade deletion for messages because Strapi
   * v5 doesn't automatically cascade delete related entities. This ensures no
   * orphaned message records remain in the database.
   *
   * **File Cleanup:**
   * The method calls chatLogService.deleteChatLog() to remove the filesystem
   * log file created during the session. This prevents accumulation of unused
   * log files and maintains filesystem hygiene.
   *
   * **Use Cases:**
   * - User requests permanent deletion of conversation
   * - Cleanup of test or temporary sessions
   * - GDPR/privacy compliance (data deletion requests)
   * - Freeing up database storage
   * - Removing sensitive conversation data
   *
   * **Alternatives:**
   * - **Archive**: Use archiveChatSession() for soft delete (preserves data)
   * - **Export first**: Export conversation before deletion for backup
   * - **Status filter**: Filter archived sessions in UI instead of deleting
   *
   * **Important Notes:**
   * - This operation is IRREVERSIBLE - all conversation data is permanently lost
   * - Attachments uploaded to Strapi are NOT automatically deleted (orphaned files)
   * - Consider implementing user confirmation dialog in UI before calling
   * - For production, consider implementing soft delete pattern instead
   *
   * @param {string} sessionDocId - The documentId of the chat session to delete
   *
   * @returns {Promise<void>} Resolves when deletion is complete
   *
   * @throws {Error} If the Strapi request fails or session/messages cannot be deleted
   *
   * @example
   * ```typescript
   * // Basic session deletion
   * import { chatService } from './chat-service';
   *
   * await chatService.deleteChatSession('session-doc-id-123');
   * console.log('Session deleted permanently');
   * ```
   *
   * @example
   * ```typescript
   * // Delete with user confirmation
   * import { chatService } from './chat-service';
   *
   * async function deleteWithConfirmation(sessionDocId: string) {
   *   const session = await chatService.getChatSession(sessionDocId);
   *
   *   const confirmed = confirm(
   *     `Permanently delete "${session.title}"? This cannot be undone.`
   *   );
   *
   *   if (confirmed) {
   *     await chatService.deleteChatSession(sessionDocId);
   *     console.log('Session deleted');
   *   } else {
   *     console.log('Deletion cancelled');
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Export before deletion (backup)
   * import { chatService } from './chat-service';
   * import fs from 'fs';
   *
   * async function exportAndDelete(sessionDocId: string) {
   *   // Export conversation first
   *   const session = await chatService.getChatSession(sessionDocId);
   *   const messages = await chatService.getChatMessages(sessionDocId);
   *
   *   const backup = {
   *     session,
   *     messages,
   *     exportedAt: new Date().toISOString(),
   *   };
   *
   *   fs.writeFileSync(
   *     `backup-${sessionDocId}.json`,
   *     JSON.stringify(backup, null, 2)
   *   );
   *
   *   // Now safe to delete
   *   await chatService.deleteChatSession(sessionDocId);
   *   console.log('Session backed up and deleted');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Bulk delete old sessions
   * import { chatService } from './chat-service';
   *
   * async function deleteOldSessions(daysOld: number) {
   *   const allSessions = await chatService.getAllChatSessions();
   *   const cutoffDate = new Date();
   *   cutoffDate.setDate(cutoffDate.getDate() - daysOld);
   *
   *   const oldSessions = allSessions.filter(session =>
   *     new Date(session.createdAt) < cutoffDate
   *   );
   *
   *   console.log(`Deleting ${oldSessions.length} sessions older than ${daysOld} days`);
   *
   *   for (const session of oldSessions) {
   *     await chatService.deleteChatSession(session.documentId);
   *     console.log(`Deleted: ${session.title}`);
   *   }
   * }
   *
   * await deleteOldSessions(90); // Delete sessions older than 90 days
   * ```
   *
   * @example
   * ```typescript
   * // Handle deletion errors gracefully
   * import { chatService } from './chat-service';
   *
   * async function safeDelete(sessionDocId: string) {
   *   try {
   *     await chatService.deleteChatSession(sessionDocId);
   *     return { success: true, message: 'Session deleted' };
   *   } catch (error) {
   *     console.error('Failed to delete session:', error);
   *     return {
   *       success: false,
   *       message: 'Deletion failed. Session may not exist.',
   *     };
   *   }
   * }
   *
   * const result = await safeDelete('session-doc-id-123');
   * console.log(result.message);
   * ```
   *
   * @example
   * ```typescript
   * // Delete test sessions (cleanup after tests)
   * import { chatService } from './chat-service';
   *
   * async function cleanupTestSessions() {
   *   const sessions = await chatService.getAllChatSessions();
   *   const testSessions = sessions.filter(s =>
   *     s.title.startsWith('[TEST]')
   *   );
   *
   *   console.log(`Cleaning up ${testSessions.length} test sessions`);
   *
   *   await Promise.all(
   *     testSessions.map(s => chatService.deleteChatSession(s.documentId))
   *   );
   *
   *   console.log('Test cleanup complete');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Archive instead of delete (safer alternative)
   * import { chatService } from './chat-service';
   *
   * async function archiveInsteadOfDelete(sessionDocId: string) {
   *   // Archive preserves data but hides from active list
   *   await chatService.archiveChatSession(sessionDocId);
   *   console.log('Session archived (data preserved)');
   *
   *   // Later, can still retrieve if needed
   *   const session = await chatService.getChatSession(sessionDocId);
   *   console.log('Status:', session.status); // => 'archived'
   * }
   * ```
   *
   * @see {@link archiveChatSession} - Soft delete alternative (preserves data)
   * @see {@link getAllChatSessions} - Get sessions for bulk operations
   * @see {@link getChatMessages} - Get messages before deletion
   */
  async deleteChatSession(sessionDocId: string): Promise<void> {
    try {
      // Delete all messages first
      const messages = await this.getChatMessages(sessionDocId);
      for (const message of messages) {
        await this.strapiRequest('DELETE', `/chat-messages/${message.documentId}`);
      }

      // Delete session
      await this.strapiRequest('DELETE', `/chat-sessions/${sessionDocId}`);

      // Delete chat log file
      await chatLogService.deleteChatLog(sessionDocId);

      this.logger.info('Chat session deleted', { sessionDocId });
    } catch (error) {
      this.logger.error('Failed to delete chat session', error, { sessionDocId });
      throw error;
    }
  }

  /**
   * Archive a chat session (soft delete)
   *
   * @description
   * Archives a chat session by updating its status to 'archived' in Strapi CMS
   * and the associated chat log file. This is a non-destructive operation that
   * preserves all conversation data while hiding the session from active lists.
   * Archived sessions can still be accessed, retrieved, and restored if needed.
   *
   * **Soft Delete Pattern:**
   * Archiving implements a soft delete pattern where data is marked as inactive
   * rather than permanently deleted. Benefits include:
   * - Data preservation for historical reference
   * - Ability to restore sessions if needed
   * - Safer alternative to permanent deletion
   * - Compliance with data retention policies
   * - Audit trail of past conversations
   *
   * **Update Workflow:**
   * 1. Update session status to 'archived' in Strapi via PUT request
   * 2. Update status in filesystem chat log via chatLogService
   * 3. Return updated session object with new status
   *
   * **Status Values:**
   * - `active`: Session is currently active and appears in default lists
   * - `archived`: Session is archived and hidden from default views
   *
   * **Use Cases:**
   * - Hide completed or old conversations from active list
   * - Clean up UI without losing conversation history
   * - Implement "delete" functionality with data preservation
   * - Organize conversations by status (active vs historical)
   * - Comply with data retention policies
   * - Support conversation search across all time
   *
   * **Restoration:**
   * To restore an archived session, update its status back to 'active' via
   * Strapi API or implement an unarchive method. The session and all messages
   * remain intact and can be resumed immediately.
   *
   * **UI Integration:**
   * - Show archived sessions in separate "Archived" view
   * - Filter archived sessions from main session list
   * - Display archive status badge in session UI
   * - Provide "Unarchive" action for archived sessions
   *
   * @param {string} sessionDocId - The documentId of the chat session to archive
   *
   * @returns {Promise<ChatSession>} The updated session with status='archived'
   *
   * @throws {Error} If the Strapi request fails or session is not found
   *
   * @example
   * ```typescript
   * // Basic session archiving
   * import { chatService } from './chat-service';
   *
   * const archivedSession = await chatService.archiveChatSession('session-doc-id-123');
   *
   * console.log(`Archived: ${archivedSession.title}`);
   * console.log(`Status: ${archivedSession.status}`);
   * // Output:
   * // Archived: Code Review Chat
   * // Status: archived
   * ```
   *
   * @example
   * ```typescript
   * // Archive with user confirmation
   * import { chatService } from './chat-service';
   *
   * async function archiveWithConfirmation(sessionDocId: string) {
   *   const session = await chatService.getChatSession(sessionDocId);
   *
   *   const confirmed = confirm(
   *     `Archive "${session.title}"? You can restore it later.`
   *   );
   *
   *   if (confirmed) {
   *     const archived = await chatService.archiveChatSession(sessionDocId);
   *     console.log('Session archived');
   *     return archived;
   *   } else {
   *     console.log('Archive cancelled');
   *     return session;
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Filter archived sessions from active list
   * import { chatService } from './chat-service';
   *
   * const allSessions = await chatService.getAllChatSessions();
   *
   * const activeSessions = allSessions.filter(s => s.status === 'active');
   * const archivedSessions = allSessions.filter(s => s.status === 'archived');
   *
   * console.log(`Active: ${activeSessions.length}`);
   * console.log(`Archived: ${archivedSessions.length}`);
   * // Output:
   * // Active: 5
   * // Archived: 12
   * ```
   *
   * @example
   * ```typescript
   * // Archive old sessions automatically
   * import { chatService } from './chat-service';
   *
   * async function archiveOldSessions(daysOld: number) {
   *   const allSessions = await chatService.getAllChatSessions();
   *   const cutoffDate = new Date();
   *   cutoffDate.setDate(cutoffDate.getDate() - daysOld);
   *
   *   const oldSessions = allSessions.filter(session =>
   *     session.status === 'active' &&
   *     new Date(session.createdAt) < cutoffDate
   *   );
   *
   *   console.log(`Archiving ${oldSessions.length} sessions older than ${daysOld} days`);
   *
   *   for (const session of oldSessions) {
   *     await chatService.archiveChatSession(session.documentId);
   *     console.log(`Archived: ${session.title}`);
   *   }
   * }
   *
   * await archiveOldSessions(30); // Archive sessions older than 30 days
   * ```
   *
   * @example
   * ```typescript
   * // Restore archived session (manual implementation)
   * import { chatService } from './chat-service';
   * import axios from 'axios';
   *
   * async function restoreSession(sessionDocId: string) {
   *   const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
   *   const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
   *
   *   await axios.put(
   *     `${STRAPI_URL}/api/chat-sessions/${sessionDocId}`,
   *     { data: { status: 'active' } },
   *     { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
   *   );
   *
   *   console.log('Session restored to active status');
   *   return await chatService.getChatSession(sessionDocId);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Bulk archive by filter criteria
   * import { chatService } from './chat-service';
   *
   * async function archiveByTitle(titlePattern: string) {
   *   const allSessions = await chatService.getAllChatSessions();
   *   const matchingSessions = allSessions.filter(s =>
   *     s.status === 'active' &&
   *     s.title.toLowerCase().includes(titlePattern.toLowerCase())
   *   );
   *
   *   console.log(`Archiving ${matchingSessions.length} sessions matching "${titlePattern}"`);
   *
   *   const results = await Promise.all(
   *     matchingSessions.map(s => chatService.archiveChatSession(s.documentId))
   *   );
   *
   *   console.log('Bulk archive complete');
   *   return results;
   * }
   *
   * await archiveByTitle('test'); // Archive all sessions with 'test' in title
   * ```
   *
   * @example
   * ```typescript
   * // Archive session after completion
   * import { chatService } from './chat-service';
   *
   * async function completeAndArchiveSession(sessionDocId: string) {
   *   // Send final message
   *   for await (const event of chatService.sendMessage(
   *     sessionDocId,
   *     'Thank you! This conversation is complete.',
   *     [],
   *     '/path/to/project'
   *   )) {
   *     if (event.type === 'done') {
   *       console.log('Final message sent, archiving session...');
   *     }
   *   }
   *
   *   // Archive the completed session
   *   const archived = await chatService.archiveChatSession(sessionDocId);
   *   console.log(`Session "${archived.title}" archived`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Show archived sessions in UI
   * import { chatService } from './chat-service';
   *
   * async function displayArchivedSessions() {
   *   const allSessions = await chatService.getAllChatSessions();
   *   const archived = allSessions.filter(s => s.status === 'archived');
   *
   *   console.log('=== Archived Sessions ===');
   *   archived.forEach(session => {
   *     const date = new Date(session.createdAt).toLocaleDateString();
   *     console.log(`- ${session.title} (${date})`);
   *   });
   *
   *   if (archived.length === 0) {
   *     console.log('No archived sessions');
   *   }
   * }
   * ```
   *
   * @see {@link deleteChatSession} - Permanent deletion alternative
   * @see {@link getAllChatSessions} - Get all sessions including archived
   * @see {@link getChatSession} - Retrieve archived session details
   */
  async archiveChatSession(sessionDocId: string): Promise<ChatSession> {
    try {
      const data = await this.strapiRequest('PUT', `/chat-sessions/${sessionDocId}`, {
        data: { status: 'archived' },
      });

      if (!data.data) {
        throw new Error('Failed to archive chat session');
      }

      // Update status in log
      await chatLogService.updateSessionStatus(sessionDocId, 'archived');

      return this.transformChatSession(data.data);
    } catch (error) {
      this.logger.error('Failed to archive chat session', error, { sessionDocId });
      throw error;
    }
  }

  /**
   * Cancel an active message stream
   *
   * @description
   * Gracefully cancels an active message stream using the AbortController pattern.
   * This method aborts the SDK query execution and triggers cleanup of active stream
   * resources. The cancelled stream yields a 'cancelled' event to notify the client.
   *
   * **Cancellation Flow:**
   * 1. Client receives 'stream_id' event from sendMessage()
   * 2. Client calls cancelMessage(streamId) to abort the stream
   * 3. Service calls abortController.abort() to signal cancellation
   * 4. SDK Query respects the abort signal and stops processing
   * 5. Service removes stream from activeStreams and activeAbortControllers Maps
   * 6. sendMessage() generator yields 'cancelled' event with reason and timestamp
   * 7. No incomplete assistant message is saved to Strapi (prevents partial data)
   *
   * **Use Cases:**
   * - User manually cancels a long-running request
   * - Timeout logic for requests exceeding a threshold
   * - User navigates away from chat UI
   * - Application shutdown cleanup
   * - Rate limiting or quota management
   * - User starts a new message (cancel previous)
   *
   * **AbortController Pattern:**
   * Each stream has a dedicated AbortController instance stored in the
   * activeAbortControllers Map. The abort signal is passed to the SDK Query
   * via the options.abortController parameter. When abort() is called,
   * the SDK immediately stops processing and throws an error that's caught
   * by sendMessage()'s try/catch block.
   *
   * **Cleanup Safety:**
   * The method performs cleanup even if the stream is already completed or
   * doesn't exist. This ensures no memory leaks or dangling references in
   * the activeStreams and activeAbortControllers Maps.
   *
   * **Partial Message Handling:**
   * When a stream is cancelled, any accumulated assistant text is NOT saved
   * to Strapi. This prevents partial, incomplete, or misleading responses
   * from being persisted in the chat history.
   *
   * @param {string} streamId - The unique stream ID returned in the 'stream_id' event
   *
   * @returns {boolean} `true` if stream was found and cancelled successfully,
   *   `false` if stream was not found (already completed or invalid ID)
   *
   * @example
   * ```typescript
   * // Basic cancellation flow
   * import { chatService } from './chat-service';
   *
   * let currentStreamId: string | null = null;
   *
   * // Start streaming in background
   * (async () => {
   *   for await (const event of chatService.sendMessage(
   *     'session-doc-id',
   *     'This is a long running task...',
   *     [],
   *     '/path/to/project'
   *   )) {
   *     if (event.type === 'stream_id') {
   *       currentStreamId = event.streamId;
   *       console.log('Stream started:', currentStreamId);
   *     }
   *     if (event.type === 'cancelled') {
   *       console.log('Stream cancelled:', event.reason);
   *     }
   *   }
   * })();
   *
   * // Cancel after 5 seconds
   * setTimeout(() => {
   *   if (currentStreamId) {
   *     const cancelled = chatService.cancelMessage(currentStreamId);
   *     console.log('Cancellation requested:', cancelled);
   *     // => Cancellation requested: true
   *   }
   * }, 5000);
   * ```
   *
   * @example
   * ```typescript
   * // Cancel on user action (button click)
   * import { chatService } from './chat-service';
   *
   * let activeStreamId: string | null = null;
   *
   * // UI button handler
   * function handleCancelClick() {
   *   if (activeStreamId) {
   *     const success = chatService.cancelMessage(activeStreamId);
   *     if (success) {
   *       showNotification('Request cancelled');
   *       activeStreamId = null;
   *     } else {
   *       showNotification('Request already completed');
   *     }
   *   }
   * }
   *
   * // Start streaming and enable cancel button
   * async function sendMessage(text: string) {
   *   for await (const event of chatService.sendMessage(
   *     sessionDocId,
   *     text,
   *     [],
   *     workingDir
   *   )) {
   *     if (event.type === 'stream_id') {
   *       activeStreamId = event.streamId;
   *       enableCancelButton(); // Enable UI cancel button
   *     }
   *     if (event.type === 'done' || event.type === 'cancelled') {
   *       activeStreamId = null;
   *       disableCancelButton(); // Disable UI cancel button
   *     }
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Timeout-based cancellation
   * import { chatService } from './chat-service';
   *
   * async function sendMessageWithTimeout(
   *   sessionDocId: string,
   *   message: string,
   *   timeoutMs: number = 60000
   * ) {
   *   let streamId: string | null = null;
   *   let timeoutHandle: NodeJS.Timeout | null = null;
   *
   *   try {
   *     for await (const event of chatService.sendMessage(
   *       sessionDocId,
   *       message,
   *       [],
   *       '/path/to/project'
   *     )) {
   *       if (event.type === 'stream_id') {
   *         streamId = event.streamId;
   *
   *         // Set timeout to cancel after timeoutMs
   *         timeoutHandle = setTimeout(() => {
   *           if (streamId) {
   *             console.log('Request timeout - cancelling stream');
   *             chatService.cancelMessage(streamId);
   *           }
   *         }, timeoutMs);
   *       }
   *
   *       if (event.type === 'done' || event.type === 'cancelled' || event.type === 'error') {
   *         // Clear timeout on completion
   *         if (timeoutHandle) {
   *           clearTimeout(timeoutHandle);
   *         }
   *       }
   *
   *       // Handle other events...
   *     }
   *   } catch (error) {
   *     if (timeoutHandle) {
   *       clearTimeout(timeoutHandle);
   *     }
   *     throw error;
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Cancel all active streams (e.g., on shutdown)
   * import { chatService } from './chat-service';
   *
   * function cancelAllActiveStreams() {
   *   const activeStreamIds = chatService.getActiveStreamIds();
   *   console.log(`Cancelling ${activeStreamIds.length} active streams`);
   *
   *   let cancelledCount = 0;
   *   for (const streamId of activeStreamIds) {
   *     const success = chatService.cancelMessage(streamId);
   *     if (success) {
   *       cancelledCount++;
   *     }
   *   }
   *
   *   console.log(`Successfully cancelled ${cancelledCount} streams`);
   * }
   *
   * // Call during application shutdown
   * process.on('SIGTERM', () => {
   *   cancelAllActiveStreams();
   *   process.exit(0);
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Cancel and start new message (replace current)
   * import { chatService } from './chat-service';
   *
   * let currentStreamId: string | null = null;
   *
   * async function sendNewMessage(sessionDocId: string, message: string) {
   *   // Cancel current stream if active
   *   if (currentStreamId) {
   *     const cancelled = chatService.cancelMessage(currentStreamId);
   *     if (cancelled) {
   *       console.log('Cancelled previous request');
   *     }
   *     currentStreamId = null;
   *   }
   *
   *   // Start new stream
   *   for await (const event of chatService.sendMessage(
   *     sessionDocId,
   *     message,
   *     [],
   *     '/path/to/project'
   *   )) {
   *     if (event.type === 'stream_id') {
   *       currentStreamId = event.streamId;
   *     }
   *     if (event.type === 'done' || event.type === 'cancelled' || event.type === 'error') {
   *       currentStreamId = null;
   *     }
   *     // Handle events...
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Check if stream was actually cancelled
   * import { chatService } from './chat-service';
   *
   * const streamId = 'stream-uuid-123';
   * const wasCancelled = chatService.cancelMessage(streamId);
   *
   * if (wasCancelled) {
   *   console.log('Stream cancelled successfully');
   * } else {
   *   console.log('Stream not found - may have already completed');
   * }
   * ```
   *
   * @see {@link sendMessage} - Yields 'stream_id' event for cancellation
   * @see {@link getActiveStreamIds} - Get list of active stream IDs
   */
  cancelMessage(streamId: string): boolean {
    this.logger.info('Cancelling message stream', { streamId });

    const abortController = this.activeAbortControllers.get(streamId);

    if (abortController) {
      // Abort the stream
      abortController.abort();

      // Cleanup
      this.activeAbortControllers.delete(streamId);
      this.activeStreams.delete(streamId);

      this.logger.info('Message stream cancelled successfully', { streamId });
      return true;
    }

    this.logger.warn('Stream not found or already completed', { streamId });
    return false;
  }

  /**
   * Get list of active stream IDs for monitoring and debugging
   *
   * @description
   * Returns an array of all currently active stream IDs from the activeStreams Map.
   * Each stream ID represents an ongoing message stream (sendMessage call) that is
   * actively processing SDK responses. This method is useful for monitoring active
   * conversations, debugging stream lifecycle issues, and implementing shutdown cleanup.
   *
   * **Active Stream Lifecycle:**
   * A stream is considered active from the moment it's added to activeStreams Map
   * (after creating SDK Query) until it's removed (completion, error, or cancellation).
   * The lifecycle stages are:
   * 1. Stream created - added to activeStreams Map with unique UUID
   * 2. Stream ID yielded - 'stream_id' event sent to client
   * 3. Stream processing - SDK messages streaming
   * 4. Stream cleanup - removed from activeStreams Map (done/error/cancelled)
   *
   * **Use Cases:**
   * - Monitor how many conversations are actively streaming
   * - Debug stream lifecycle issues and memory leaks
   * - Implement graceful shutdown (cancel all active streams)
   * - Display "active conversations" count in UI
   * - Rate limiting based on concurrent streams
   * - Health check endpoint for monitoring
   * - Prevent duplicate streams for same session
   *
   * **Monitoring Patterns:**
   * - Poll periodically to track active stream count
   * - Log stream count before/after operations
   * - Alert if stream count exceeds threshold
   * - Track average stream duration
   * - Detect stuck or orphaned streams
   *
   * **Cleanup Patterns:**
   * - Cancel all active streams on application shutdown
   * - Cancel streams for specific session when replacing with new message
   * - Timeout logic for streams exceeding duration threshold
   * - Emergency abort for runaway streams
   *
   * **Map Synchronization:**
   * This method reads from the activeStreams Map, which is synchronized with
   * activeAbortControllers Map. Both Maps are updated atomically in sendMessage()
   * to ensure consistency between stream IDs and abort controllers.
   *
   * @returns {string[]} Array of active stream IDs (UUIDs)
   *
   * @example
   * ```typescript
   * // Basic usage - get active stream count
   * import { chatService } from './chat-service';
   *
   * const activeStreamIds = chatService.getActiveStreamIds();
   * console.log(`Active streams: ${activeStreamIds.length}`);
   * // Output:
   * // Active streams: 3
   * ```
   *
   * @example
   * ```typescript
   * // Monitor active streams periodically
   * import { chatService } from './chat-service';
   *
   * setInterval(() => {
   *   const activeStreams = chatService.getActiveStreamIds();
   *   console.log(`[${new Date().toISOString()}] Active streams: ${activeStreams.length}`);
   *
   *   if (activeStreams.length > 10) {
   *     console.warn('High number of concurrent streams detected!');
   *   }
   * }, 5000); // Check every 5 seconds
   * ```
   *
   * @example
   * ```typescript
   * // Cancel all active streams (shutdown cleanup)
   * import { chatService } from './chat-service';
   *
   * async function shutdown() {
   *   const activeStreamIds = chatService.getActiveStreamIds();
   *
   *   if (activeStreamIds.length > 0) {
   *     console.log(`Cancelling ${activeStreamIds.length} active streams...`);
   *
   *     for (const streamId of activeStreamIds) {
   *       chatService.cancelMessage(streamId);
   *     }
   *
   *     console.log('All streams cancelled');
   *   }
   *
   *   process.exit(0);
   * }
   *
   * process.on('SIGTERM', shutdown);
   * process.on('SIGINT', shutdown);
   * ```
   *
   * @example
   * ```typescript
   * // Display active streams in admin UI
   * import { chatService } from './chat-service';
   *
   * async function getActiveStreamInfo() {
   *   const streamIds = chatService.getActiveStreamIds();
   *
   *   return {
   *     count: streamIds.length,
   *     streamIds: streamIds,
   *     timestamp: new Date().toISOString(),
   *   };
   * }
   *
   * const info = await getActiveStreamInfo();
   * console.log(JSON.stringify(info, null, 2));
   * // Output:
   * // {
   * //   "count": 2,
   * //   "streamIds": [
   * //     "550e8400-e29b-41d4-a716-446655440000",
   * //     "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
   * //   ],
   * //   "timestamp": "2026-01-02T12:00:00.000Z"
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Rate limiting based on active streams
   * import { chatService } from './chat-service';
   *
   * async function sendMessageWithRateLimit(
   *   sessionDocId: string,
   *   message: string,
   *   maxConcurrent: number = 5
   * ) {
   *   const activeStreams = chatService.getActiveStreamIds();
   *
   *   if (activeStreams.length >= maxConcurrent) {
   *     throw new Error(
   *       `Rate limit exceeded: ${activeStreams.length}/${maxConcurrent} streams active`
   *     );
   *   }
   *
   *   // Proceed with sending message
   *   for await (const event of chatService.sendMessage(
   *     sessionDocId,
   *     message,
   *     [],
   *     '/path/to/project'
   *   )) {
   *     // Handle events...
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Health check endpoint
   * import { chatService } from './chat-service';
   * import express from 'express';
   *
   * const app = express();
   *
   * app.get('/health', (req, res) => {
   *   const activeStreams = chatService.getActiveStreamIds();
   *
   *   res.json({
   *     status: 'healthy',
   *     activeStreams: activeStreams.length,
   *     timestamp: new Date().toISOString(),
   *   });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Prevent duplicate streams for same session
   * import { chatService } from './chat-service';
   *
   * const sessionStreamMap = new Map<string, string>(); // sessionDocId -> streamId
   *
   * async function sendMessageNoDuplicate(
   *   sessionDocId: string,
   *   message: string
   * ) {
   *   // Cancel existing stream for this session if active
   *   const existingStreamId = sessionStreamMap.get(sessionDocId);
   *   if (existingStreamId) {
   *     const activeStreamIds = chatService.getActiveStreamIds();
   *     if (activeStreamIds.includes(existingStreamId)) {
   *       console.log('Cancelling existing stream for session');
   *       chatService.cancelMessage(existingStreamId);
   *     }
   *   }
   *
   *   // Start new stream
   *   for await (const event of chatService.sendMessage(
   *     sessionDocId,
   *     message,
   *     [],
   *     '/path/to/project'
   *   )) {
   *     if (event.type === 'stream_id') {
   *       sessionStreamMap.set(sessionDocId, event.streamId);
   *     }
   *     if (event.type === 'done' || event.type === 'error' || event.type === 'cancelled') {
   *       sessionStreamMap.delete(sessionDocId);
   *     }
   *     // Handle other events...
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Detect stuck streams (timeout monitoring)
   * import { chatService } from './chat-service';
   *
   * const streamStartTimes = new Map<string, number>();
   * const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
   *
   * // Track stream start times
   * async function monitorStreams() {
   *   const activeStreamIds = chatService.getActiveStreamIds();
   *   const now = Date.now();
   *
   *   for (const streamId of activeStreamIds) {
   *     if (!streamStartTimes.has(streamId)) {
   *       streamStartTimes.set(streamId, now);
   *     } else {
   *       const elapsed = now - streamStartTimes.get(streamId)!;
   *       if (elapsed > TIMEOUT_MS) {
   *         console.warn(`Stream ${streamId} exceeded timeout (${elapsed}ms), cancelling`);
   *         chatService.cancelMessage(streamId);
   *         streamStartTimes.delete(streamId);
   *       }
   *     }
   *   }
   *
   *   // Cleanup finished streams
   *   for (const [streamId] of streamStartTimes) {
   *     if (!activeStreamIds.includes(streamId)) {
   *       streamStartTimes.delete(streamId);
   *     }
   *   }
   * }
   *
   * setInterval(monitorStreams, 10000); // Check every 10 seconds
   * ```
   *
   * @see {@link cancelMessage} - Cancel a specific stream by ID
   * @see {@link sendMessage} - Creates streams tracked by this method
   */
  getActiveStreamIds(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  /**
   * Transform Strapi chat session response
   */
  private transformChatSession(strapiData: any): ChatSession {
    const attrs = strapiData.attributes || strapiData;

    // Handle skills - Strapi v5 returns direct array, v4 returned nested data array
    let skills: any[] | undefined;
    if (attrs.skills?.data) {
      // Strapi v4 format
      skills = attrs.skills.data.map((s: any) => ({
        id: s.id,
        documentId: s.documentId,
        name: s.attributes?.name || s.name,
      }));
    } else if (Array.isArray(attrs.skills) && attrs.skills.length > 0) {
      // Strapi v5 format - direct array
      skills = attrs.skills.map((s: any) => ({
        id: s.id,
        documentId: s.documentId,
        name: s.name,
      }));
    }

    // Handle agent - Strapi v5 returns direct object, v4 returned nested data object
    let agent: any | undefined;
    if (attrs.agent?.data) {
      // Strapi v4 format
      agent = {
        id: attrs.agent.data.id,
        documentId: attrs.agent.data.documentId,
        name: attrs.agent.data.attributes?.name || attrs.agent.data.name,
        systemPrompt: attrs.agent.data.attributes?.systemPrompt || '',
        toolConfig: attrs.agent.data.attributes?.toolConfig,
        modelConfig: attrs.agent.data.attributes?.modelConfig,
        mcpConfig: attrs.agent.data.attributes?.mcpConfig,
      };
    } else if (attrs.agent?.id) {
      // Strapi v5 format - direct object
      agent = {
        id: attrs.agent.id,
        documentId: attrs.agent.documentId,
        name: attrs.agent.name,
        systemPrompt: attrs.agent.systemPrompt || '',
        toolConfig: attrs.agent.toolConfig,
        modelConfig: attrs.agent.modelConfig,
        mcpConfig: attrs.agent.mcpConfig,
      };
    }

    // Map planMode boolean back to permissionMode: "plan" for client
    const isPlanMode = attrs.planMode || false;
    const effectivePermissionMode = isPlanMode ? 'plan' : (attrs.permissionMode || 'default');

    return {
      id: strapiData.id,
      documentId: strapiData.documentId,
      title: attrs.title,
      status: attrs.status || 'active',
      sessionId: attrs.sessionId || null,
      skills,
      agent,
      customSystemPrompt: attrs.customSystemPrompt,
      permissionMode: effectivePermissionMode as 'default' | 'bypass' | 'auto' | 'plan',
      planMode: isPlanMode, // Keep for backwards compatibility
      createdAt: attrs.createdAt,
      updatedAt: attrs.updatedAt,
      publishedAt: attrs.publishedAt,
    };
  }

  /**
   * Transform Strapi chat message response
   */
  private transformChatMessage(strapiData: any): ChatMessage {
    const attrs = strapiData.attributes || strapiData;

    return {
      id: strapiData.id,
      documentId: strapiData.documentId,
      role: attrs.role,
      content: attrs.content,
      attachments: attrs.attachments?.data ? attrs.attachments.data.map((a: any) => ({
        id: a.id,
        documentId: a.documentId,
        name: a.attributes?.name || a.name,
        url: a.attributes?.url || a.url,
        mime: a.attributes?.mime || a.mime,
        size: a.attributes?.size || a.size,
      })) : undefined,
      metadata: attrs.metadata || {},
      timestamp: attrs.timestamp,
      createdAt: attrs.createdAt,
      updatedAt: attrs.updatedAt,
    };
  }

  /**
   * Build MCP servers configuration from agent's mcpConfig
   * Combines Strapi mcpConfig (which servers/tools to use) with .mcp.json (command/args)
   */
  private async buildMcpServersFromAgentConfig(
    mcpConfig: any[],
    workingDirectory: string
  ): Promise<Record<string, any> | undefined> {
    if (!mcpConfig || !Array.isArray(mcpConfig) || mcpConfig.length === 0) {
      this.logger.debug('No mcpConfig found in agent');
      return undefined;
    }

    // Load base MCP configuration from .mcp.json
    const baseMcpConfig = await this.loadMcpConfig(workingDirectory);

    if (!baseMcpConfig) {
      this.logger.warn('No .mcp.json found, cannot build MCP servers from agent config');
      return undefined;
    }

    const mcpServers: Record<string, any> = {};

    for (const config of mcpConfig) {
      // Extract server name from relation
      const serverName = typeof config.mcpServer === 'string'
        ? config.mcpServer
        : config.mcpServer?.name;

      if (!serverName) {
        this.logger.warn('MCP config entry missing server name', { config });
        continue;
      }

      // Get command/args from .mcp.json
      if (baseMcpConfig[serverName]) {
        mcpServers[serverName] = baseMcpConfig[serverName];
        this.logger.debug('Added MCP server from agent config', {
          serverName,
          selectedTools: config.selectedTools?.map((t: any) =>
            typeof t.mcpTool === 'string' ? t.mcpTool : t.mcpTool?.name
          ) || []
        });
      } else {
        this.logger.warn('MCP server not found in .mcp.json', { serverName });
      }
    }

    return Object.keys(mcpServers).length > 0 ? mcpServers : undefined;
  }

  /**
   * Load MCP configuration from .mcp.json
   */
  private async loadMcpConfig(workingDirectory: string): Promise<Record<string, any> | undefined> {
    try {
      const mcpConfigPath = path.join(workingDirectory, '.mcp.json');
      const content = await fs.readFile(mcpConfigPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.mcpServers && typeof config.mcpServers === 'object') {
        return config.mcpServers;
      }

      return undefined;
    } catch (error) {
      // .mcp.json not found or invalid - this is okay
      this.logger.debug('No MCP config found', { workingDirectory, error: (error as Error).message });
      return undefined;
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
