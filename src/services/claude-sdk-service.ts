import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { query, type Query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type {
  ConversationConfig,
  CUIError,
  SystemInitMessage,
  AssistantStreamMessage,
  UserStreamMessage,
  ResultStreamMessage,
  StreamEvent,
  PermissionRequest,
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
} from '@/types/index.js';
import { createLogger, type Logger } from './logger.js';
import { ClaudeHistoryReader } from './claude-history-reader.js';
import { ConversationStatusManager } from './conversation-status-manager.js';
import { ToolMetricsService } from './ToolMetricsService.js';
import { SessionInfoService } from './session-info-service.js';
import { FileSystemService } from './file-system-service.js';
import { NotificationService } from './notification-service.js';
import { ClaudeRouterService } from './claude-router-service.js';
import { SdkHistoryWriter } from './sdk-history-writer.js';
import type Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';

/**
 * ClaudeSdkService - Core service for managing Claude conversations using the Agent SDK
 *
 * @description
 * Manages the lifecycle of Claude Agent SDK conversations, providing a high-level interface
 * for starting/stopping conversations, handling message streaming, and integrating with
 * MCP servers. This service replaces the legacy CLI-based approach with direct SDK integration,
 * enabling better control over conversation state, real-time event streaming, and seamless
 * integration with the application's architecture.
 *
 * Key responsibilities:
 * - Initialize and manage SDK query instances for active conversations
 * - Stream SDK messages and transform them to application's StreamEvent format
 * - Integrate with MCP servers from multiple sources (config files, Strapi, skills)
 * - Write conversation history to JSONL files via SdkHistoryWriter
 * - Track conversation status and emit real-time events to the frontend
 * - Handle session lifecycle, including resume functionality
 * - Manage permissions and tool access control
 *
 * Architecture:
 * - Uses EventEmitter to broadcast conversation events ('claude-message', 'process-closed', 'process-error')
 * - Maintains internal maps for queries, configs, and session IDs
 * - Integrates with ClaudeHistoryReader, ConversationStatusManager, and other services
 * - Supports multiple concurrent conversations with unique streamingId tracking
 *
 * @example
 * ```typescript
 * // Initialize the service with required dependencies
 * const historyReader = new ClaudeHistoryReader();
 * const statusTracker = new ConversationStatusManager();
 * const toolMetrics = new ToolMetricsService();
 * const sessionInfo = new SessionInfoService();
 * const fileSystem = new FileSystemService();
 *
 * const claudeSdk = new ClaudeSdkService(
 *   historyReader,
 *   statusTracker,
 *   toolMetrics,
 *   sessionInfo,
 *   fileSystem
 * );
 *
 * // Configure optional services
 * claudeSdk.setMcpConfigPath('/path/to/.mcp.json');
 * claudeSdk.setNotificationService(notificationService);
 *
 * // Start a new conversation
 * const config = {
 *   initialPrompt: 'Hello, Claude!',
 *   workingDirectory: '/path/to/project',
 *   model: 'claude-sonnet-4-5',
 *   permissionMode: 'default',
 *   allowedTools: ['Read', 'Write', 'Bash']
 * };
 *
 * const { streamingId, systemInit } = await claudeSdk.startConversation(config);
 *
 * // Listen for conversation events
 * claudeSdk.on('claude-message', ({ streamingId, message }) => {
 *   console.log('Received message:', message);
 * });
 *
 * claudeSdk.on('process-closed', ({ streamingId, code }) => {
 *   console.log('Conversation ended:', streamingId);
 * });
 *
 * // Stop conversation when done
 * await claudeSdk.stopConversation(streamingId);
 * ```
 *
 * @see {@link https://github.com/anthropics/anthropic-sdk-typescript|Anthropic SDK Documentation}
 */
export class ClaudeSdkService extends EventEmitter {
  /**
   * Active SDK query instances indexed by streaming ID
   * Each query represents an active conversation with the Claude Agent SDK
   */
  private queries: Map<string, Query> = new Map();

  /**
   * Conversation configurations indexed by streaming ID
   * Stores the initial config for each conversation (prompt, model, tools, etc.)
   */
  private conversationConfigs: Map<string, ConversationConfig> = new Map();

  /**
   * Maps streaming IDs to SDK session IDs
   * The streaming ID is generated internally, while session ID comes from the SDK
   */
  private sessionIds: Map<string, string> = new Map();

  /**
   * Logger instance for structured logging
   */
  private logger: Logger;

  /**
   * Service for reading Claude's conversation history from JSONL files
   */
  private historyReader: ClaudeHistoryReader;

  /**
   * Service for writing SDK messages to conversation history files
   */
  private historyWriter: SdkHistoryWriter;

  /**
   * Tracks active conversation sessions and manages optimistic UI state
   */
  private statusTracker: ConversationStatusManager;

  /**
   * Optional service for tracking tool usage metrics and analytics
   */
  private toolMetricsService?: ToolMetricsService;

  /**
   * Optional service for persisting session metadata to database
   */
  private sessionInfoService?: SessionInfoService;

  /**
   * Optional service providing abstraction over Node.js filesystem operations
   */
  private fileSystemService?: FileSystemService;

  /**
   * Optional service for sending in-app and push notifications
   */
  private notificationService?: NotificationService;

  /**
   * Optional service for routing Claude API requests (load balancing, failover)
   */
  private routerService?: ClaudeRouterService;

  /**
   * Path to MCP configuration file (.mcp.json)
   * When set, MCP servers are loaded from this file for SDK conversations
   */
  private mcpConfigPath?: string;

  /**
   * Pending permission requests awaiting user approval
   * Maps permission request ID to PermissionRequest object
   */
  private pendingPermissions: Map<string, PermissionRequest> = new Map();

  /**
   * Creates a new ClaudeSdkService instance
   *
   * @param historyReader - Service for reading Claude's JSONL conversation history
   * @param statusTracker - Service for tracking active conversation sessions
   * @param toolMetricsService - Optional service for tracking tool usage analytics
   * @param sessionInfoService - Optional service for persisting session metadata
   * @param fileSystemService - Optional service for filesystem operations
   *
   * @example
   * ```typescript
   * const service = new ClaudeSdkService(
   *   new ClaudeHistoryReader(),
   *   new ConversationStatusManager(),
   *   new ToolMetricsService(),
   *   new SessionInfoService(),
   *   new FileSystemService()
   * );
   * ```
   */
  constructor(
    historyReader: ClaudeHistoryReader,
    statusTracker: ConversationStatusManager,
    toolMetricsService?: ToolMetricsService,
    sessionInfoService?: SessionInfoService,
    fileSystemService?: FileSystemService
  ) {
    super();
    this.historyReader = historyReader;
    this.historyWriter = new SdkHistoryWriter();
    this.statusTracker = statusTracker;
    this.toolMetricsService = toolMetricsService;
    this.sessionInfoService = sessionInfoService;
    this.fileSystemService = fileSystemService;
    this.logger = createLogger('ClaudeSdkService');

    // Initialize history writer
    this.historyWriter.initialize().catch((error) => {
      this.logger.error('Failed to initialize history writer', error);
    });
  }

  /**
   * Set the Claude Router Service for load balancing and failover
   *
   * @description
   * Optionally configure a router service to handle request routing across multiple
   * Claude API endpoints. The router can implement load balancing, failover, and
   * rate limiting strategies.
   *
   * @param service - Optional ClaudeRouterService instance for API request routing
   *
   * @example
   * ```typescript
   * const router = new ClaudeRouterService();
   * router.registerRoute('primary', 'https://api.anthropic.com');
   * router.registerRoute('fallback', 'https://backup.anthropic.com');
   *
   * claudeSdk.setRouterService(router);
   * ```
   */
  setRouterService(service?: ClaudeRouterService): void {
    this.routerService = service;
  }

  /**
   * Set the path to MCP configuration file
   *
   * @description
   * Configure the path to a .mcp.json file containing MCP server configurations.
   * When set, MCP servers defined in this file will be loaded and made available
   * to SDK conversations. These servers have the lowest priority in the merge
   * strategy (file < Strapi agent < skill-specific MCP).
   *
   * @param configPath - Absolute path to .mcp.json configuration file
   *
   * @example
   * ```typescript
   * import path from 'path';
   * import os from 'os';
   *
   * const mcpPath = path.join(os.homedir(), '.config', 'claude', '.mcp.json');
   * claudeSdk.setMcpConfigPath(mcpPath);
   * ```
   */
  setMcpConfigPath(configPath: string): void {
    this.mcpConfigPath = configPath;
  }

  /**
   * Set the notification service for conversation events
   *
   * @description
   * Optionally configure a notification service to send in-app and push notifications
   * for conversation events such as new messages, errors, or conversation completion.
   * The service will be used to notify users when conversations require attention.
   *
   * @param service - Optional NotificationService instance for sending notifications
   *
   * @example
   * ```typescript
   * const notifications = new NotificationService();
   * claudeSdk.setNotificationService(notifications);
   *
   * // Notifications will be sent automatically for conversation events
   * claudeSdk.on('process-error', ({ streamingId, error }) => {
   *   // Notification service can handle this event
   * });
   * ```
   */
  setNotificationService(service?: NotificationService): void {
    this.notificationService = service;
  }

  /**
   * Start a new conversation using the Claude Agent SDK
   *
   * @description
   * Initializes a new SDK conversation with the provided configuration. This method:
   * - Creates a unique streaming ID for tracking the conversation
   * - Builds SDK options including MCP servers from multiple sources
   * - Initializes session info in the database
   * - Registers the conversation with the status tracker
   * - Starts processing SDK messages asynchronously
   * - Emits 'claude-message' events for real-time updates
   *
   * The conversation will continue until stopped via stopConversation() or until
   * the SDK query completes naturally.
   *
   * MCP Server Merge Priority (highest to lowest):
   * 1. Skill-specific MCP servers (from config.skills[].mcpConfig)
   * 2. Strapi agent-level MCP servers (from database)
   * 3. File-based MCP servers (from .mcp.json config file)
   *
   * @param config - Conversation configuration including prompt, model, tools, and optional resume session
   * @param config.initialPrompt - The user's initial message to start the conversation
   * @param config.workingDirectory - Working directory for the conversation (defaults to process.cwd())
   * @param config.model - Claude model to use (defaults to 'claude-sonnet-4-5')
   * @param config.permissionMode - Permission mode for tool execution ('default', 'auto', 'manual')
   * @param config.allowedTools - Array of allowed tool names (e.g., ['Read', 'Write', 'Bash'])
   * @param config.disallowedTools - Array of disallowed tool names
   * @param config.systemPrompt - Optional system prompt for the conversation
   * @param config.skills - Optional array of skills to enable for the conversation
   * @param config.previousMessages - Optional array of previous messages to resume from
   * @param config.resumedSessionId - Optional session ID to resume an existing conversation
   * @param config.maxThinkingTokens - Maximum tokens for extended thinking (defaults to 10000)
   *
   * @returns Promise resolving to an object containing:
   *   - streamingId: Unique identifier for this conversation instance
   *   - systemInit: System initialization message with session details
   *
   * @throws Error if SDK query creation fails or session initialization fails
   *
   * @example
   * ```typescript
   * // Start a basic conversation
   * const { streamingId, systemInit } = await claudeSdk.startConversation({
   *   initialPrompt: 'Hello, Claude! Can you help me write a function?',
   *   workingDirectory: '/path/to/project',
   *   model: 'claude-sonnet-4-5',
   *   permissionMode: 'default',
   *   allowedTools: ['Read', 'Write', 'Edit']
   * });
   *
   * console.log('Conversation started:', streamingId);
   * console.log('Session ID:', systemInit.session_id);
   *
   * // Listen for conversation events
   * claudeSdk.on('claude-message', ({ streamingId, message }) => {
   *   if (message.type === 'assistant') {
   *     console.log('Assistant:', message.message.content);
   *   }
   * });
   *
   * // Resume an existing conversation
   * const { streamingId: resumedId } = await claudeSdk.startConversation({
   *   initialPrompt: 'Continue from where we left off',
   *   resumedSessionId: previousSessionId,
   *   previousMessages: historyMessages,
   *   workingDirectory: '/path/to/project'
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Start conversation with skills and MCP servers
   * const { streamingId } = await claudeSdk.startConversation({
   *   initialPrompt: 'Help me analyze this codebase',
   *   workingDirectory: '/path/to/project',
   *   skills: [
   *     {
   *       name: 'code-analysis',
   *       mcpConfig: [
   *         { mcpServer: 'mcp-server-id-1' }
   *       ]
   *     }
   *   ],
   *   allowedTools: ['Read', 'Grep', 'Bash', 'Skill'],
   *   permissionMode: 'auto'
   * });
   * ```
   */
  async startConversation(
    config: ConversationConfig & { resumedSessionId?: string }
  ): Promise<{ streamingId: string; systemInit: SystemInitMessage }> {
    const isResume = !!config.resumedSessionId;
    const streamingId = uuidv4();

    this.logger.info('🚀 SDK MODE: Start conversation requested', {
      streamingId,
      hasInitialPrompt: !!config.initialPrompt,
      promptLength: config.initialPrompt?.length,
      workingDirectory: config.workingDirectory,
      model: config.model,
      isResume,
      resumedSessionId: config.resumedSessionId,
    });

    // Store config
    this.conversationConfigs.set(streamingId, config);

    try {
      // Generate a temporary session ID - will be replaced with SDK's actual session ID
      const sessionId = config.resumedSessionId || `sdk-${uuidv4()}`;
      this.sessionIds.set(streamingId, sessionId);

      // Initialize session info in database
      if (this.sessionInfoService) {
        await this.sessionInfoService.getSessionInfo(sessionId);

        // Update session info with permission mode if provided
        if (config.permissionMode) {
          await this.sessionInfoService.updateSessionInfo(sessionId, {
            permission_mode: config.permissionMode,
          });
        }
      }

      // Build SDK options from config
      const options = await this.buildSdkOptions(config);

      // Create the query with error handling
      let queryInstance: Query;
      try {
        queryInstance = query({
          prompt: config.initialPrompt,
          options,
        });
      } catch (error) {
        this.logger.error('❌ Failed to create SDK query', error, { streamingId, sessionId });
        throw new Error(`Failed to create SDK query: ${error instanceof Error ? error.message : String(error)}`);
      }

      this.queries.set(streamingId, queryInstance);

      // Start processing messages IMMEDIATELY (not in background)
      // This prevents EPIPE errors from being unhandled
      setImmediate(() => {
        this.processQueryMessages(streamingId, queryInstance).catch((error) => {
          this.logger.error('❌ Error processing query messages', error, { streamingId });
          this.emit('process-error', { streamingId, error: error instanceof Error ? error.message : String(error) });

          // Clean up on error
          this.queries.delete(streamingId);
          this.conversationConfigs.delete(streamingId);
          this.sessionIds.delete(streamingId);
          this.statusTracker.unregisterActiveSession(streamingId);
        });
      });

      // Register conversation with status tracker
      this.statusTracker.registerActiveSession(streamingId, sessionId, {
        initialPrompt: config.initialPrompt,
        workingDirectory: config.workingDirectory || process.cwd(),
        model: config.model,
        inheritedMessages: config.previousMessages,
      });

      // Create system init message
      const systemInit: SystemInitMessage = {
        type: 'system',
        subtype: 'init',
        session_id: sessionId,
        cwd: config.workingDirectory || process.cwd(),
        tools: config.allowedTools || [],
        mcp_servers: [], // Will be populated if MCP is configured
        model: config.model || 'claude-sonnet-4-5',
        permissionMode: config.permissionMode || 'default',
        apiKeySource: process.env.ANTHROPIC_API_KEY ? 'environment' : 'unknown',
      };

      this.logger.info('✅ SDK MODE: Conversation started successfully', {
        streamingId,
        sessionId,
      });

      return { streamingId, systemInit };
    } catch (error) {
      this.logger.error('❌ SDK MODE: Failed to start conversation', error, { streamingId });
      throw error;
    }
  }

  /**
   * Stop an active conversation and clean up resources
   *
   * @description
   * Gracefully stops a running SDK conversation by:
   * - Flushing any pending history writes to disk
   * - Unregistering the conversation from the status tracker
   * - Cleaning up internal query and config references
   * - Emitting a 'process-closed' event with exit code 0
   *
   * Note: SDK queries are async generators and cannot be forcefully terminated.
   * This method cleans up our internal tracking and ensures history is persisted,
   * but the SDK query may continue briefly before completing.
   *
   * @param streamingId - Unique identifier of the conversation to stop
   *
   * @returns Promise<boolean> - true if conversation was found and stopped, false if not found
   *
   * @example
   * ```typescript
   * // Start a conversation
   * const { streamingId } = await claudeSdk.startConversation({
   *   initialPrompt: 'Hello!',
   *   workingDirectory: '/path/to/project'
   * });
   *
   * // ... conversation runs ...
   *
   * // Stop the conversation when done
   * const stopped = await claudeSdk.stopConversation(streamingId);
   * if (stopped) {
   *   console.log('Conversation stopped successfully');
   * } else {
   *   console.log('Conversation not found');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Stop conversation on user cancellation
   * claudeSdk.on('claude-message', async ({ streamingId, message }) => {
   *   if (message.type === 'assistant') {
   *     // Process message...
   *   }
   * });
   *
   * // User clicks cancel button
   * cancelButton.addEventListener('click', async () => {
   *   await claudeSdk.stopConversation(currentStreamingId);
   * });
   * ```
   */
  async stopConversation(streamingId: string): Promise<boolean> {
    this.logger.debug('Stopping conversation', { streamingId });

    const query = this.queries.get(streamingId);
    if (!query) {
      this.logger.warn('No query found for conversation', { streamingId });
      return false;
    }

    try {
      // Flush history before stopping
      const sessionId = this.sessionIds.get(streamingId);
      if (sessionId) {
        await this.historyWriter.flush(sessionId);
      }

      // Unregister from status tracker
      this.statusTracker.unregisterActiveSession(streamingId);

      // SDK queries are async generators, we can't directly stop them
      // but we can clean up our references
      this.queries.delete(streamingId);
      this.conversationConfigs.delete(streamingId);
      this.sessionIds.delete(streamingId);

      this.emit('process-closed', { streamingId, code: 0 });
      this.logger.debug('Conversation stopped', { streamingId });

      return true;
    } catch (error) {
      this.logger.error('Error stopping conversation', error, { streamingId });
      return false;
    }
  }

  /**
   * Build SDK options from conversation config
   *
   * @description
   * Transforms a ConversationConfig into SDK-compatible Options object. This method:
   * - Sets model, permission mode, and working directory
   * - Enables partial message streaming for real-time updates
   * - Configures skills filesystem settings by loading .claude/skills/ directory
   * - Adds "Skill" tool to allowed tools for skill execution
   * - Loads MCP servers from multiple sources with priority merge strategy:
   *   1. File-based (.mcp.json) - lowest priority
   *   2. Strapi agent-level servers - medium priority
   *   3. Skill-specific servers - highest priority
   * - Configures extended thinking tokens for reasoning
   * - Sets up stderr capture for debugging subprocess issues
   *
   * The merge strategy ensures skill-specific MCP servers override agent-level
   * servers, which override file-based servers. This allows fine-grained control
   * over which tools are available for different conversation contexts.
   *
   * @param config - Conversation configuration with prompt, model, tools, and optional skills
   * @param config.model - Claude model name (defaults to 'claude-sonnet-4-5')
   * @param config.permissionMode - Tool execution permission mode ('default', 'auto', 'manual')
   * @param config.workingDirectory - Working directory for the conversation
   * @param config.systemPrompt - Optional system prompt to guide Claude's behavior
   * @param config.allowedTools - Array of allowed tool names (e.g., ['Read', 'Write'])
   * @param config.disallowedTools - Array of disallowed tool names
   * @param config.skills - Array of skills to enable with optional MCP configurations
   * @param config.maxThinkingTokens - Maximum tokens for extended thinking (defaults to 10000)
   *
   * @returns Promise resolving to SDK Options object with merged configuration
   *
   * @example
   * ```typescript
   * // Basic configuration
   * const options = await this.buildSdkOptions({
   *   initialPrompt: 'Hello',
   *   workingDirectory: '/path/to/project',
   *   model: 'claude-sonnet-4-5',
   *   permissionMode: 'default',
   *   allowedTools: ['Read', 'Write', 'Bash']
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Configuration with skills and MCP servers
   * const options = await this.buildSdkOptions({
   *   initialPrompt: 'Analyze codebase',
   *   workingDirectory: '/path/to/project',
   *   skills: [
   *     {
   *       name: 'code-analysis',
   *       mcpConfig: [{ mcpServer: 'mcp-server-id-1' }]
   *     }
   *   ],
   *   allowedTools: ['Read', 'Grep', 'Skill'],
   *   maxThinkingTokens: 15000
   * });
   * // Result includes MCP servers from skill-specific config
   * ```
   *
   * @private
   */
  private async buildSdkOptions(config: ConversationConfig): Promise<Options> {
    const options: Options = {
      model: config.model || 'claude-sonnet-4-5',
      permissionMode: (config.permissionMode as Options['permissionMode']) || 'default',
      includePartialMessages: true, // Enable streaming for real-time updates

      // ✅ NEW: Skills filesystem settings (REQUIRED for skills to work)
      settingSources: ['project'], // Loads .claude/skills/ directory

      // ✅ Working directory (required for settingSources)
      cwd: config.workingDirectory || process.cwd(),

      // ✅ Extended thinking configuration (required for thinking strategies)
      maxThinkingTokens: config.maxThinkingTokens || 10000,
    };

    // System prompt
    if (config.systemPrompt) {
      options.systemPrompt = config.systemPrompt;
    }

    // Allowed/disallowed tools - Add "Skill" tool for skill execution
    if (config.allowedTools) {
      // ✅ NEW: Add "Skill" tool to allowedTools (use Set to prevent duplicates)
      const toolsWithSkill = [...new Set([...config.allowedTools, 'Skill'])];
      options.allowedTools = toolsWithSkill;
    } else {
      // If no allowedTools specified, only add Skill tool
      options.allowedTools = ['Skill'];
    }

    if (config.disallowedTools) {
      options.disallowedTools = config.disallowedTools;
    }

    // MCP servers - load from multiple sources (merge strategy: file < agent < skill)
    try {
      const mcpServers: Record<string, any> = {};

      // Source 1: Load from .mcp.json if path is configured (lowest priority)
      if (this.mcpConfigPath) {
        const mcpConfig = await this.loadMcpConfig(this.mcpConfigPath);
        if (mcpConfig) {
          Object.assign(mcpServers, mcpConfig);
          this.logger.info('Loaded MCP servers from .mcp.json', {
            serverCount: Object.keys(mcpConfig).length
          });
        }
      }

      // Source 2: Load from Strapi agent-level servers (medium priority)
      const strapiServers = await this.loadMcpServersFromStrapi(config.workingDirectory);
      if (strapiServers) {
        // Strapi servers take precedence over .mcp.json
        Object.assign(mcpServers, strapiServers);
        this.logger.info('Loaded MCP servers from Strapi', {
          serverCount: Object.keys(strapiServers).length
        });
      }

      // ✅ NEW: Source 3: Load from Skill-specific MCP servers (highest priority)
      if (config.skills && config.skills.length > 0) {
        const skillMcpServers = await this.loadMcpServersFromSkills(config.skills);
        if (skillMcpServers) {
          // Skill MCP servers take highest precedence
          Object.assign(mcpServers, skillMcpServers);
          this.logger.info('Loaded MCP servers from Skills', {
            serverCount: Object.keys(skillMcpServers).length
          });
        }
      }

      if (Object.keys(mcpServers).length > 0) {
        options.mcpServers = mcpServers;
        this.logger.info('✅ Total MCP servers loaded for SDK', {
          serverCount: Object.keys(mcpServers).length,
          servers: Object.keys(mcpServers)
        });
      }
    } catch (error) {
      this.logger.warn('Failed to load MCP servers', { error });
    }

    // Capture Claude CLI stderr to diagnose subprocess issues
    options.stderr = (data: string) => {
      this.logger.error('🚨 Claude CLI stderr', { stderr: data });
    };

    // Add permission hooks
    // Note: SDK hooks API may differ - this is a placeholder implementation
    // TODO: Implement proper permission handling once SDK hook types are confirmed
    // options.hooks = {
    //   PreToolUse: async (event: any) => {
    //     this.logger.debug('PreToolUse hook', { tool: event.tool.name });
    //   },
    //   PostToolUse: async (event: any) => {
    //     this.logger.debug('PostToolUse hook', { tool: event.tool.name });
    //   },
    // };

    return options;
  }

  /**
   * Load MCP configuration from file
   *
   * @description
   * Reads and parses a .mcp.json configuration file, transforming it into SDK-compatible
   * MCP server format. The configuration file should contain an 'mcpServers' object
   * where each key is a server name and the value includes command, args, and env.
   *
   * This method handles stdio-based MCP servers (servers launched as child processes).
   * The transformation ensures compatibility with the Claude Agent SDK's expected
   * mcpServers format.
   *
   * File format:
   * ```json
   * {
   *   "mcpServers": {
   *     "server-name": {
   *       "command": "node",
   *       "args": ["path/to/server.js"],
   *       "env": { "API_KEY": "value" }
   *     }
   *   }
   * }
   * ```
   *
   * @param configPath - Absolute path to .mcp.json configuration file
   *
   * @returns Promise resolving to SDK-compatible mcpServers object, or undefined if file cannot be read/parsed
   *
   * @example
   * ```typescript
   * // Load MCP config from user's home directory
   * const mcpServers = await this.loadMcpConfig('/home/user/.config/claude/.mcp.json');
   * if (mcpServers) {
   *   console.log('Loaded servers:', Object.keys(mcpServers));
   *   // Output: ['filesystem', 'database', 'api-client']
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Handle missing or invalid config file
   * const mcpServers = await this.loadMcpConfig('/path/to/nonexistent.json');
   * // Returns undefined, error logged but not thrown
   * ```
   *
   * @private
   */
  private async loadMcpConfig(configPath: string): Promise<Options['mcpServers']> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      // Transform MCP config to SDK format
      // This is a simplified version - actual transformation depends on config structure
      const mcpServers: Record<string, any> = {};

      if (config.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers as Record<string, any>)) {
          if (serverConfig.command) {
            // stdio-based server
            mcpServers[name] = {
              type: 'stdio',
              command: serverConfig.command,
              args: serverConfig.args || [],
              env: serverConfig.env || {},
            };
          }
        }
      }

      return mcpServers as Options['mcpServers'];
    } catch (error) {
      this.logger.error('Failed to load MCP config', error, { configPath });
      return undefined;
    }
  }

  /**
   * Load MCP servers from Strapi database
   *
   * @description
   * Fetches all enabled MCP server configurations from the Strapi CMS database and
   * transforms them into SDK-compatible format. This method:
   * - Queries Strapi for MCP servers where disabled=false
   * - Filters out servers without a command (invalid configurations)
   * - Transforms each server to SDK format with type, command, args, and env
   * - Supports stdio transport type for child process-based servers
   *
   * This provides centralized MCP server management through the CMS, allowing
   * administrators to configure servers without modifying code or config files.
   * These servers have medium priority in the merge strategy (higher than file-based,
   * lower than skill-specific).
   *
   * @param workingDirectory - Optional working directory context (currently unused, reserved for future filtering)
   *
   * @returns Promise resolving to SDK-compatible mcpServers object, or undefined if no enabled servers found or on error
   *
   * @example
   * ```typescript
   * // Load agent-level MCP servers from Strapi
   * const strapiServers = await this.loadMcpServersFromStrapi('/path/to/project');
   * if (strapiServers) {
   *   console.log('Loaded Strapi servers:', Object.keys(strapiServers));
   *   // Output: ['github-api', 'slack-integration', 'database-tool']
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Gracefully handles Strapi connection failures
   * const servers = await this.loadMcpServersFromStrapi();
   * // Returns undefined if Strapi is unavailable, error logged as warning
   * ```
   *
   * @private
   */
  private async loadMcpServersFromStrapi(workingDirectory?: string): Promise<Options['mcpServers']> {
    try {
      const { strapiClient } = await import('./strapi-client.js');

      // Get all enabled MCP servers from Strapi
      const servers = await strapiClient.getAllMCPServers({
        filters: { disabled: false }
      });

      if (!servers || servers.length === 0) {
        return undefined;
      }

      // Transform to SDK format
      const mcpServers: Record<string, any> = {};

      for (const server of servers) {
        // Skip servers without command
        if (!server.command) {
          continue;
        }

        mcpServers[server.name] = {
          type: server.transport || 'stdio',
          command: server.command,
          args: server.args || [],
          env: server.env || {},
        };
      }

      this.logger.info('Loaded MCP servers from Strapi', {
        serverCount: Object.keys(mcpServers).length,
        servers: Object.keys(mcpServers)
      });

      return mcpServers as Options['mcpServers'];
    } catch (error) {
      this.logger.warn('Failed to load MCP servers from Strapi', { error });
      return undefined;
    }
  }

  /**
   * Load MCP servers from Skills' MCP configurations
   *
   * @description
   * Extracts and loads MCP servers specified in skills' mcpConfig arrays. This method:
   * - Iterates through each skill's mcpConfig array
   * - Extracts MCP server IDs (handles both string and object formats)
   * - Fetches full server details from Strapi database
   * - Filters out disabled servers and servers without commands
   * - Transforms servers to SDK-compatible format
   *
   * Skills can declare which MCP servers they require, enabling context-specific
   * tool access. For example, a 'database-analysis' skill might require a
   * 'postgres-mcp' server. These skill-specific servers have the highest priority
   * in the merge strategy, ensuring skills get exactly the tools they need.
   *
   * The mcpConfig format supports:
   * - Direct server ID: { mcpServer: "server-id" }
   * - Server object: { mcpServer: { id: "server-id" } }
   *
   * @param skills - Array of skills with optional mcpConfig arrays
   * @param skills[].name - Skill name for logging
   * @param skills[].mcpConfig - Array of MCP server selections
   * @param skills[].mcpConfig[].mcpServer - Server ID (string) or server object with id
   *
   * @returns Promise resolving to SDK-compatible mcpServers object, or undefined if no skill servers configured
   *
   * @example
   * ```typescript
   * // Load MCP servers from skills with mcpConfig
   * const skills = [
   *   {
   *     name: 'code-analysis',
   *     mcpConfig: [
   *       { mcpServer: 'github-mcp-id' },
   *       { mcpServer: { id: 'ast-parser-mcp-id' } }
   *     ]
   *   }
   * ];
   *
   * const skillServers = await this.loadMcpServersFromSkills(skills);
   * // Result: { 'github-api': {...}, 'ast-parser': {...} }
   * ```
   *
   * @example
   * ```typescript
   * // Handles skills without mcpConfig gracefully
   * const skills = [
   *   { name: 'simple-skill' } // No mcpConfig
   * ];
   *
   * const servers = await this.loadMcpServersFromSkills(skills);
   * // Returns undefined (no servers to load)
   * ```
   *
   * @example
   * ```typescript
   * // Continues processing if individual server fetch fails
   * const skills = [
   *   {
   *     name: 'mixed-skill',
   *     mcpConfig: [
   *       { mcpServer: 'valid-server-id' },
   *       { mcpServer: 'invalid-server-id' } // Fails to fetch
   *     ]
   *   }
   * ];
   *
   * const servers = await this.loadMcpServersFromSkills(skills);
   * // Returns servers that were successfully loaded, logs error for failed ones
   * ```
   *
   * @private
   */
  private async loadMcpServersFromSkills(skills: any[]): Promise<Options['mcpServers']> {
    try {
      const { strapiClient } = await import('./strapi-client.js');
      const mcpServers: Record<string, any> = {};

      for (const skill of skills) {
        // Skip skills without MCP config
        if (!skill.mcpConfig || !Array.isArray(skill.mcpConfig)) {
          continue;
        }

        // Process each MCP server selection in the skill
        for (const mcpSelection of skill.mcpConfig) {
          // Extract MCP server ID (can be string or object with id)
          const serverId = typeof mcpSelection.mcpServer === 'string'
            ? mcpSelection.mcpServer
            : mcpSelection.mcpServer?.id;

          if (!serverId) {
            continue;
          }

          try {
            // Fetch MCP server details from Strapi
            const server = await strapiClient.getMCPServer(serverId);

            // Skip disabled servers or servers without command
            if (server.disabled || !server.command) {
              continue;
            }

            // Transform to SDK format
            mcpServers[server.name] = {
              type: server.transport || 'stdio',
              command: server.command,
              args: server.args || [],
              env: server.env || {},
            };

            this.logger.info(`[ClaudeSDK] Loaded MCP server from skill: ${server.name}`, {
              skillName: skill.name,
              serverName: server.name
            });
          } catch (error) {
            this.logger.error(`[ClaudeSDK] Failed to load MCP server ${serverId}:`, error);
            // Continue with other servers even if one fails
          }
        }
      }

      return Object.keys(mcpServers).length > 0 ? (mcpServers as Options['mcpServers']) : undefined;
    } catch (error) {
      this.logger.warn('Failed to load MCP servers from skills', { error });
      return undefined;
    }
  }

  /**
   * Process messages from SDK query
   *
   * @description
   * Asynchronous generator that processes messages from an active SDK query instance.
   * This is the core message processing loop that:
   * - Iterates through SDK messages as they arrive
   * - Extracts and updates the SDK session ID from the first message
   * - Writes messages to conversation history files via SdkHistoryWriter
   * - Transforms SDK messages to application's StreamEvent format
   * - Emits 'claude-message' events for real-time frontend updates
   * - Handles conversation completion and cleanup
   * - Manages error recovery and resource cleanup
   *
   * The method runs asynchronously and should be started with setImmediate to prevent
   * EPIPE errors from being unhandled. It continues processing until the SDK query
   * completes or an error occurs.
   *
   * Session ID handling:
   * - New conversations: Extracts SDK's session ID from first message
   * - Resumed conversations: Uses existing session ID from config
   * - Emits session_id_update event when SDK session ID is obtained
   *
   * @param streamingId - Unique identifier for this conversation instance
   * @param queryInstance - Active SDK Query instance to process messages from
   *
   * @returns Promise<void> - Resolves when query completes or rejects on error
   *
   * @throws Error if session ID is not found or if message processing fails critically
   *
   * @fires claude-message - Emitted for each transformed SDK message
   * @fires process-closed - Emitted when query completes successfully (code: 0)
   * @fires process-error - Emitted when query fails or processing error occurs
   *
   * @example
   * ```typescript
   * // Start processing query messages asynchronously
   * const query = query({ prompt: 'Hello', options });
   * this.queries.set(streamingId, query);
   *
   * setImmediate(() => {
   *   this.processQueryMessages(streamingId, query).catch((error) => {
   *     this.logger.error('Query processing failed', error);
   *     this.emit('process-error', { streamingId, error: error.message });
   *   });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Listen for messages during processing
   * claudeSdk.on('claude-message', ({ streamingId, message }) => {
   *   if (message.type === 'assistant') {
   *     console.log('Assistant message:', message.message.content);
   *   } else if (message.type === 'result') {
   *     console.log('Tool result:', message.result);
   *   } else if (message.type === 'session_id_update') {
   *     console.log('Session ID updated:', message.newSessionId);
   *   }
   * });
   * ```
   *
   * @private
   */
  private async processQueryMessages(streamingId: string, queryInstance: Query): Promise<void> {
    try {
      let sessionId = this.sessionIds.get(streamingId);
      if (!sessionId) {
        throw new Error('Session ID not found');
      }

      this.logger.info('🔄 Starting to process SDK query messages', { streamingId, sessionId });

      const config = this.conversationConfigs.get(streamingId);
      const workingDirectory = config?.workingDirectory;
      const isResume = config?.previousMessages && config.previousMessages.length > 0;

      let messageCount = 0;
      for await (const message of queryInstance) {
        messageCount++;

        // Extract the SDK's actual session ID from the first message (only for new conversations)
        if (messageCount === 1 && message.session_id && !isResume) {
          const sdkSessionId = message.session_id;
          const oldSessionId = sessionId;
          this.logger.info('🔑 Extracted SDK session ID', { streamingId, sdkSessionId, oldSessionId });
          this.sessionIds.set(streamingId, sdkSessionId);
          sessionId = sdkSessionId; // Update local variable

          // Emit session ID update event to notify frontend
          this.emit('claude-message', {
            streamingId,
            message: {
              type: 'session_id_update',
              oldSessionId,
              newSessionId: sdkSessionId,
              streamingId,
              timestamp: new Date().toISOString()
            }
          });
          this.logger.info('📤 Emitted session ID update event', { streamingId, oldSessionId, newSessionId: sdkSessionId });
        }

        this.logger.info('📨 Received SDK message', {
          streamingId,
          sessionId,
          messageNumber: messageCount,
          type: message.type
        });

        // Write message to history
        try {
          if (message.type === 'assistant') {
            this.logger.info('📝 Writing assistant message to history', { streamingId, sessionId });
            await this.historyWriter.writeAssistantMessage(
              message as unknown as SDKAssistantMessage,
              workingDirectory
            );
            this.logger.info('✅ Assistant message written to history', { streamingId, sessionId });
          } else if (message.type === 'user' && !(message as any).isReplay) {
            this.logger.info('📝 Writing user message to history', { streamingId, sessionId });
            await this.historyWriter.writeUserMessage(
              message as unknown as SDKUserMessage,
              workingDirectory
            );
            this.logger.info('✅ User message written to history', { streamingId, sessionId });
          } else if (message.type === 'result') {
            this.logger.info('📝 Writing result message to history', { streamingId, sessionId });
            await this.historyWriter.writeResultMessage(
              message as unknown as SDKResultMessage,
              workingDirectory
            );
            this.logger.info('✅ Result message written to history', { streamingId, sessionId });
          }
        } catch (historyError) {
          this.logger.error('❌ Failed to write message to history', historyError, {
            streamingId,
            sessionId,
            messageType: message.type
          });
        }

        // Transform SDK message to StreamEvent
        // Type assertion needed due to slight differences between SDK types and our types
        const streamEvent = this.transformSdkMessage(message as unknown as SDKMessage, sessionId);

        if (streamEvent) {
          this.logger.info('✅ Transformed and emitting claude-message event', {
            streamingId,
            eventType: streamEvent.type
          });
          // Emit as claude-message event
          this.emit('claude-message', { streamingId, message: streamEvent });
          this.logger.info('📡 claude-message event emitted', { streamingId, eventType: streamEvent.type });
        } else {
          this.logger.warn('⏭️  Skipped message (no transform)', {
            streamingId,
            messageType: message.type
          });
        }
      }

      this.logger.info('✅ Query iteration complete', { streamingId, totalMessages: messageCount });

      // Query completed - flush history before closing
      await this.historyWriter.flush(sessionId);

      // Unregister from status tracker
      this.statusTracker.unregisterActiveSession(streamingId);

      this.logger.info('🏁 Query completed', { streamingId, sessionId });
      this.emit('process-closed', { streamingId, code: 0 });
    } catch (error) {
      this.logger.error('❌ Error in processQueryMessages', error, { streamingId });
      this.emit('process-error', { streamingId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get conversation config by session ID
   *
   * @description
   * Retrieves the conversation configuration for a given SDK session ID by looking up
   * the streaming ID associated with that session, then returning the stored config.
   * This reverse lookup is necessary because configs are stored by streaming ID
   * (our internal identifier) but often we only have the session ID (SDK's identifier)
   * when processing callbacks or writing history.
   *
   * @param sessionId - SDK session ID to look up configuration for
   *
   * @returns ConversationConfig if found, undefined if no config exists for this session
   *
   * @example
   * ```typescript
   * // Get config when processing history write
   * const config = this.getConfigBySessionId(sessionId);
   * if (config?.workingDirectory) {
   *   await this.historyWriter.writeMessage(message, config.workingDirectory);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Access conversation settings by session ID
   * const config = this.getConfigBySessionId(sessionId);
   * console.log('Model:', config?.model);
   * console.log('Permission mode:', config?.permissionMode);
   * ```
   *
   * @private
   */
  private getConfigBySessionId(sessionId: string): ConversationConfig | undefined {
    const streamingId = Array.from(this.sessionIds.entries()).find(
      ([_, sid]) => sid === sessionId
    )?.[0];
    return streamingId ? this.conversationConfigs.get(streamingId) : undefined;
  }

  /**
   * Transform SDK message to StreamEvent format
   *
   * @description
   * Routes SDK messages to appropriate transformation methods based on message type.
   * This is the main dispatcher that converts SDK's message format to the application's
   * StreamEvent format used throughout the CUI (Conversational User Interface).
   *
   * Supported message types:
   * - 'assistant': Assistant's text and tool use responses
   * - 'user': User messages (including tool results)
   * - 'result': Tool execution results with metrics
   * - 'stream_event': Partial messages during streaming
   *
   * The transformation ensures consistency across the application and adapts SDK's
   * format to match the existing CUI event structure that the frontend expects.
   *
   * @param sdkMessage - SDK message to transform (assistant, user, result, or stream_event)
   * @param sessionId - Session ID to include in transformed message
   *
   * @returns StreamEvent object in CUI format, or null if message type is unsupported
   *
   * @example
   * ```typescript
   * // Transform various SDK message types
   * for await (const sdkMessage of queryInstance) {
   *   const streamEvent = this.transformSdkMessage(sdkMessage, sessionId);
   *   if (streamEvent) {
   *     this.emit('claude-message', { streamingId, message: streamEvent });
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Handle different message types
   * const event = this.transformSdkMessage(sdkMessage, sessionId);
   * if (event?.type === 'assistant') {
   *   console.log('Assistant response:', event.message.content);
   * } else if (event?.type === 'result') {
   *   console.log('Tool result:', event.result);
   *   console.log('Token usage:', event.usage);
   * }
   * ```
   *
   * @private
   */
  private transformSdkMessage(sdkMessage: SDKMessage, sessionId: string): StreamEvent | null {
    try {
      switch (sdkMessage.type) {
        case 'assistant':
          return this.transformAssistantMessage(sdkMessage as SDKAssistantMessage, sessionId);

        case 'user':
          return this.transformUserMessage(sdkMessage as SDKUserMessage, sessionId);

        case 'result':
          return this.transformResultMessage(sdkMessage as SDKResultMessage, sessionId);

        case 'stream_event':
          return this.transformStreamEvent(sdkMessage as SDKPartialAssistantMessage, sessionId);

        default:
          this.logger.debug('Unhandled SDK message type', { type: (sdkMessage as any).type });
          return null;
      }
    } catch (error) {
      this.logger.error('Error transforming SDK message', error, {
        messageType: sdkMessage.type,
        sessionId,
      });
      return null;
    }
  }

  /**
   * Transform SDK assistant message
   *
   * @description
   * Converts SDK assistant messages to CUI's AssistantStreamMessage format. This method:
   * - Writes the message to conversation history asynchronously (non-blocking)
   * - Extracts the Anthropic message content (text, tool use, etc.)
   * - Preserves parent_tool_use_id for nested tool execution tracking
   * - Includes session ID for message correlation
   *
   * Assistant messages contain Claude's responses, which may include:
   * - Text content (explanations, answers, thoughts)
   * - Tool use requests (asking to execute tools)
   * - Multiple content blocks in a single message
   *
   * History writing is done asynchronously to avoid blocking the message stream.
   * Any history write errors are logged but don't interrupt message processing.
   *
   * @param sdkMessage - SDK assistant message with Anthropic message content
   * @param sdkMessage.message - Anthropic.Message with content blocks
   * @param sdkMessage.parent_tool_use_id - Optional parent tool use ID for nested execution
   * @param sessionId - Session ID to include in transformed message
   *
   * @returns AssistantStreamMessage in CUI format with message content and metadata
   *
   * @example
   * ```typescript
   * // Transform assistant message with text content
   * const assistantMsg: SDKAssistantMessage = {
   *   type: 'assistant',
   *   message: {
   *     id: 'msg_123',
   *     role: 'assistant',
   *     content: [{ type: 'text', text: 'Hello! How can I help you?' }],
   *     model: 'claude-sonnet-4-5',
   *     usage: { input_tokens: 10, output_tokens: 20 }
   *   }
   * };
   *
   * const streamEvent = this.transformAssistantMessage(assistantMsg, sessionId);
   * // Result: { type: 'assistant', session_id: '...', message: {...} }
   * ```
   *
   * @example
   * ```typescript
   * // Transform assistant message with tool use
   * const assistantMsg: SDKAssistantMessage = {
   *   type: 'assistant',
   *   message: {
   *     content: [
   *       { type: 'text', text: 'Let me read that file for you.' },
   *       {
   *         type: 'tool_use',
   *         id: 'tool_abc',
   *         name: 'Read',
   *         input: { file_path: '/path/to/file.txt' }
   *       }
   *     ],
   *     // ... other message fields
   *   }
   * };
   *
   * const streamEvent = this.transformAssistantMessage(assistantMsg, sessionId);
   * // Message includes both text and tool use request
   * ```
   *
   * @private
   */
  private transformAssistantMessage(
    sdkMessage: SDKAssistantMessage,
    sessionId: string
  ): AssistantStreamMessage {
    // Write to history asynchronously (don't block message processing)
    const config = this.getConfigBySessionId(sessionId);
    this.historyWriter.writeAssistantMessage(
      sdkMessage,
      config?.workingDirectory,
      'sdk-0.1.0'
    ).catch((error) => {
      this.logger.error('Failed to write assistant message to history', error, { sessionId });
    });

    return {
      type: 'assistant',
      session_id: sessionId,
      message: sdkMessage.message,
      parent_tool_use_id: sdkMessage.parent_tool_use_id || undefined,
    };
  }

  /**
   * Transform SDK user message
   *
   * @description
   * Converts SDK user messages to CUI's UserStreamMessage format. This method:
   * - Writes the message to conversation history asynchronously (non-blocking)
   * - Extracts the message content (typically tool results or user input)
   * - Preserves parent_tool_use_id for tracking which tool execution this responds to
   * - Includes session ID for message correlation
   *
   * User messages in SDK context typically represent:
   * - Tool execution results being returned to Claude
   * - User's follow-up input in the conversation
   * - Replayed messages from conversation history (not written to history again)
   *
   * The method checks for 'isReplay' flag to avoid duplicating messages in history
   * when resuming conversations from previous sessions.
   *
   * @param sdkMessage - SDK user message with content and optional tool result
   * @param sdkMessage.message - Message content (text or tool result)
   * @param sdkMessage.parent_tool_use_id - Optional parent tool use ID this message responds to
   * @param sdkMessage.isReplay - Optional flag indicating this is a replayed message
   * @param sessionId - Session ID to include in transformed message
   *
   * @returns UserStreamMessage in CUI format with message content and metadata
   *
   * @example
   * ```typescript
   * // Transform tool result user message
   * const userMsg: SDKUserMessage = {
   *   type: 'user',
   *   message: {
   *     role: 'user',
   *     content: [
   *       {
   *         type: 'tool_result',
   *         tool_use_id: 'tool_abc',
   *         content: 'File contents: Hello, world!'
   *       }
   *     ]
   *   },
   *   parent_tool_use_id: 'tool_abc'
   * };
   *
   * const streamEvent = this.transformUserMessage(userMsg, sessionId);
   * // Result: { type: 'user', session_id: '...', message: {...} }
   * ```
   *
   * @example
   * ```typescript
   * // Transform user input message
   * const userMsg: SDKUserMessage = {
   *   type: 'user',
   *   message: {
   *     role: 'user',
   *     content: 'Can you help me debug this code?'
   *   }
   * };
   *
   * const streamEvent = this.transformUserMessage(userMsg, sessionId);
   * // User's question is transformed to stream event
   * ```
   *
   * @private
   */
  private transformUserMessage(
    sdkMessage: SDKUserMessage,
    sessionId: string
  ): UserStreamMessage {
    // Write to history asynchronously
    const config = this.getConfigBySessionId(sessionId);
    this.historyWriter.writeUserMessage(
      sdkMessage,
      config?.workingDirectory,
      'sdk-0.1.0'
    ).catch((error) => {
      this.logger.error('Failed to write user message to history', error, { sessionId });
    });

    return {
      type: 'user',
      session_id: sessionId,
      message: sdkMessage.message,
      parent_tool_use_id: sdkMessage.parent_tool_use_id || undefined,
    };
  }

  /**
   * Transform SDK result message with proper metrics
   *
   * @description
   * Converts SDK result messages to CUI's ResultStreamMessage format with comprehensive
   * metrics. This method:
   * - Writes the result to conversation history asynchronously (non-blocking)
   * - Extracts subtype (e.g., 'success', 'error', 'cancelled')
   * - Preserves error state and result content
   * - Transforms usage metrics (token counts, cache usage)
   * - Includes timing metrics (duration, API duration)
   * - Tracks conversation turns
   *
   * Result messages represent the outcome of tool executions or API calls, providing
   * detailed metrics about resource usage, performance, and success/failure status.
   * These metrics are essential for monitoring conversation costs and performance.
   *
   * Token usage breakdown:
   * - input_tokens: Tokens sent in the request
   * - cache_creation_input_tokens: Tokens used to create cache entries
   * - cache_read_input_tokens: Tokens read from cache (cost savings)
   * - output_tokens: Tokens generated in the response
   *
   * @param sdkMessage - SDK result message with metrics and outcome
   * @param sdkMessage.subtype - Result subtype ('success', 'error', etc.)
   * @param sdkMessage.is_error - Whether this represents an error condition
   * @param sdkMessage.result - Result content or error details
   * @param sdkMessage.usage - Token usage statistics
   * @param sdkMessage.duration_ms - Total duration in milliseconds
   * @param sdkMessage.duration_api_ms - API call duration in milliseconds
   * @param sdkMessage.num_turns - Number of conversation turns
   * @param sessionId - Session ID to include in transformed message
   *
   * @returns ResultStreamMessage in CUI format with full metrics
   *
   * @example
   * ```typescript
   * // Transform successful result with metrics
   * const resultMsg: SDKResultMessage = {
   *   type: 'result',
   *   subtype: 'success',
   *   is_error: false,
   *   duration_ms: 1234,
   *   duration_api_ms: 890,
   *   num_turns: 3,
   *   result: { output: 'Task completed successfully' },
   *   usage: {
   *     input_tokens: 150,
   *     cache_creation_input_tokens: 0,
   *     cache_read_input_tokens: 50,
   *     output_tokens: 200
   *   }
   * };
   *
   * const streamEvent = this.transformResultMessage(resultMsg, sessionId);
   * console.log('Total tokens:', streamEvent.usage.input_tokens + streamEvent.usage.output_tokens);
   * console.log('Cache savings:', streamEvent.usage.cache_read_input_tokens);
   * ```
   *
   * @example
   * ```typescript
   * // Transform error result
   * const errorMsg: SDKResultMessage = {
   *   type: 'result',
   *   subtype: 'error',
   *   is_error: true,
   *   result: { error: 'File not found', code: 'ENOENT' },
   *   duration_ms: 50,
   *   duration_api_ms: 0,
   *   num_turns: 1,
   *   usage: { input_tokens: 10, output_tokens: 0 }
   * };
   *
   * const streamEvent = this.transformResultMessage(errorMsg, sessionId);
   * // is_error flag preserved for error handling
   * ```
   *
   * @private
   */
  private transformResultMessage(
    sdkMessage: SDKResultMessage,
    sessionId: string
  ): ResultStreamMessage {
    // Write to history asynchronously
    const config = this.getConfigBySessionId(sessionId);
    this.historyWriter.writeResultMessage(
      sdkMessage,
      config?.workingDirectory,
      'sdk-0.1.0'
    ).catch((error) => {
      this.logger.error('Failed to write result message to history', error, { sessionId });
    });

    return {
      type: 'result',
      session_id: sessionId,
      subtype: sdkMessage.subtype,
      is_error: sdkMessage.is_error,
      duration_ms: sdkMessage.duration_ms || 0,
      duration_api_ms: sdkMessage.duration_api_ms || 0,
      num_turns: sdkMessage.num_turns || 0,
      result: sdkMessage.result,
      usage: {
        input_tokens: sdkMessage.usage?.input_tokens || 0,
        cache_creation_input_tokens: sdkMessage.usage?.cache_creation_input_tokens || 0,
        cache_read_input_tokens: sdkMessage.usage?.cache_read_input_tokens || 0,
        output_tokens: sdkMessage.usage?.output_tokens || 0,
        server_tool_use: {
          web_search_requests: 0, // SDK doesn't provide this granularity
        },
      },
    };
  }

  /**
   * Transform SDK stream event for real-time updates
   *
   * @description
   * Converts SDK streaming events to user-friendly status messages during real-time
   * message generation. This method handles partial assistant messages and provides
   * progress feedback to the frontend without overwhelming it with raw stream data.
   *
   * Stream event types handled:
   * - message_start: Assistant begins thinking
   * - content_block_start: New content block (text or tool use)
   * - content_block_delta: Incremental content updates (skipped to reduce noise)
   * - content_block_stop: Content block completed (skipped)
   * - message_delta: Message metadata updates (stop reason, etc.)
   * - message_stop: Response generation complete
   *
   * The method filters out high-frequency events (text deltas, input_json_delta) to
   * avoid flooding the frontend with too many updates. Only meaningful status changes
   * are converted to synthetic assistant messages with status text.
   *
   * Status messages are synthetic - they don't represent actual assistant content but
   * provide user-friendly progress indicators like "🤖 Assistant is thinking..." or
   * "🔧 Using tool: Read".
   *
   * @param sdkMessage - SDK partial assistant message with streaming event
   * @param sdkMessage.event - The specific stream event (message_start, content_block_delta, etc.)
   * @param sdkMessage.event.type - Event type identifier
   * @param sdkMessage.event.content_block - Content block for block start events
   * @param sdkMessage.event.delta - Delta information for incremental updates
   * @param sdkMessage.parent_tool_use_id - Optional parent tool use ID for nested execution
   * @param sessionId - Session ID to include in synthetic message
   *
   * @returns StreamEvent with synthetic status message, or null for skipped events
   *
   * @example
   * ```typescript
   * // Transform message_start event
   * const streamEvent: SDKPartialAssistantMessage = {
   *   type: 'stream_event',
   *   event: { type: 'message_start' }
   * };
   *
   * const result = this.transformStreamEvent(streamEvent, sessionId);
   * // Result: { type: 'assistant', message: { content: [{ text: '🤖 Assistant is thinking...' }] } }
   * ```
   *
   * @example
   * ```typescript
   * // Transform tool use start
   * const streamEvent: SDKPartialAssistantMessage = {
   *   type: 'stream_event',
   *   event: {
   *     type: 'content_block_start',
   *     content_block: { type: 'tool_use', name: 'Read' }
   *   }
   * };
   *
   * const result = this.transformStreamEvent(streamEvent, sessionId);
   * // Result: { message: { content: [{ text: '🔧 Using tool: Read' }] } }
   * ```
   *
   * @example
   * ```typescript
   * // Text deltas are skipped to reduce noise
   * const streamEvent: SDKPartialAssistantMessage = {
   *   type: 'stream_event',
   *   event: {
   *     type: 'content_block_delta',
   *     delta: { type: 'text_delta', text: 'Hello' }
   *   }
   * };
   *
   * const result = this.transformStreamEvent(streamEvent, sessionId);
   * // Result: null (skipped to avoid too many updates)
   * ```
   *
   * @private
   */
  private transformStreamEvent(
    sdkMessage: SDKPartialAssistantMessage,
    sessionId: string
  ): StreamEvent | null {
    // Log streaming events for debugging
    this.logger.debug('SDK streaming event', {
      sessionId,
      eventType: sdkMessage.event.type,
      parentToolUseId: sdkMessage.parent_tool_use_id,
    });

    // Extract useful information from stream events for progress updates
    const event = sdkMessage.event;
    let statusMessage = '';

    // Handle different stream event types
    switch (event.type) {
      case 'message_start':
        statusMessage = '🤖 Assistant is thinking...';
        break;

      case 'content_block_start':
        if (event.content_block?.type === 'tool_use') {
          const toolName = (event.content_block as any).name || 'tool';
          statusMessage = `🔧 Using tool: ${toolName}`;
        } else if (event.content_block?.type === 'text') {
          statusMessage = '💬 Generating response...';
        }
        break;

      case 'content_block_delta':
        // For text deltas, we could accumulate text, but for now just show activity
        if (event.delta?.type === 'text_delta') {
          // Skip individual text deltas to avoid too many messages
          return null;
        } else if (event.delta?.type === 'input_json_delta') {
          // Tool input is being streamed
          return null;
        }
        break;

      case 'content_block_stop':
        // Content block finished
        return null;

      case 'message_delta':
        if (event.delta?.stop_reason) {
          statusMessage = `✅ Message complete (${event.delta.stop_reason})`;
        }
        break;

      case 'message_stop':
        statusMessage = '✅ Response complete';
        break;

      default:
        // Unknown event type, skip it
        return null;
    }

    // If we have a status message, create a synthetic assistant message
    if (statusMessage) {
      // Create a minimal Anthropic.Message structure for status updates
      const syntheticMessage: any = {
        id: `stream_${Date.now()}_${Math.random()}`,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: statusMessage
        }],
        model: 'claude-3-5-sonnet-20241022', // Default model
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };

      return {
        type: 'assistant',
        session_id: sessionId,
        message: syntheticMessage,
        parent_tool_use_id: sdkMessage.parent_tool_use_id || undefined,
      };
    }

    return null;
  }

  /**
   * Get the count of currently active conversations
   *
   * @description
   * Returns the number of SDK conversations currently running. This count includes
   * all conversations that have been started but not yet stopped or completed.
   * Useful for monitoring system load and enforcing concurrency limits.
   *
   * @returns Number of active conversations being managed by this service instance
   *
   * @example
   * ```typescript
   * // Check active conversation count before starting new one
   * const activeCount = claudeSdk.getActiveConversationsCount();
   * console.log(`Currently ${activeCount} conversations running`);
   *
   * if (activeCount < MAX_CONCURRENT_CONVERSATIONS) {
   *   await claudeSdk.startConversation(config);
   * } else {
   *   console.log('Maximum concurrent conversations reached');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Monitor conversation load
   * setInterval(() => {
   *   const count = claudeSdk.getActiveConversationsCount();
   *   console.log(`Active conversations: ${count}`);
   *
   *   if (count > 10) {
   *     console.warn('High conversation load detected');
   *   }
   * }, 5000);
   * ```
   */
  getActiveConversationsCount(): number {
    return this.queries.size;
  }

  /**
   * Check if a specific conversation is currently active
   *
   * @description
   * Determines whether a conversation with the given streaming ID is currently running.
   * A conversation is considered active from the time startConversation() returns until
   * either stopConversation() is called or the SDK query completes naturally.
   *
   * @param streamingId - Unique identifier of the conversation to check
   *
   * @returns true if the conversation is active, false otherwise
   *
   * @example
   * ```typescript
   * // Check if conversation is still running before sending a stop command
   * if (claudeSdk.isConversationActive(streamingId)) {
   *   await claudeSdk.stopConversation(streamingId);
   * } else {
   *   console.log('Conversation already completed');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Prevent duplicate conversation starts
   * let currentStreamingId: string | null = null;
   *
   * async function startNewConversation(prompt: string) {
   *   if (currentStreamingId && claudeSdk.isConversationActive(currentStreamingId)) {
   *     console.log('A conversation is already running');
   *     return;
   *   }
   *
   *   const { streamingId } = await claudeSdk.startConversation({
   *     initialPrompt: prompt,
   *     workingDirectory: process.cwd()
   *   });
   *
   *   currentStreamingId = streamingId;
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Track conversation lifecycle
   * const { streamingId } = await claudeSdk.startConversation(config);
   *
   * console.log('Active:', claudeSdk.isConversationActive(streamingId)); // true
   *
   * claudeSdk.on('process-closed', ({ streamingId: closedId }) => {
   *   if (closedId === streamingId) {
   *     console.log('Active:', claudeSdk.isConversationActive(streamingId)); // false
   *   }
   * });
   * ```
   */
  isConversationActive(streamingId: string): boolean {
    return this.queries.has(streamingId);
  }
}
