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
 * Manages Claude conversations using the Agent SDK
 * Replaces CLI-based approach with direct SDK integration
 */
export class ClaudeSdkService extends EventEmitter {
  private queries: Map<string, Query> = new Map();
  private conversationConfigs: Map<string, ConversationConfig> = new Map();
  private sessionIds: Map<string, string> = new Map(); // streamingId -> sessionId
  private logger: Logger;
  private historyReader: ClaudeHistoryReader;
  private historyWriter: SdkHistoryWriter;
  private statusTracker: ConversationStatusManager;
  private toolMetricsService?: ToolMetricsService;
  private sessionInfoService?: SessionInfoService;
  private fileSystemService?: FileSystemService;
  private notificationService?: NotificationService;
  private routerService?: ClaudeRouterService;
  private mcpConfigPath?: string;
  private pendingPermissions: Map<string, PermissionRequest> = new Map();

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

  setRouterService(service?: ClaudeRouterService): void {
    this.routerService = service;
  }

  setMcpConfigPath(configPath: string): void {
    this.mcpConfigPath = configPath;
  }

  setNotificationService(service?: NotificationService): void {
    this.notificationService = service;
  }

  /**
   * Start a new conversation using the SDK
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
   * Stop a conversation
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
   * Only returns enabled servers
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
   * Skills can specify which MCP servers they need via mcpConfig
   * @param skills - Array of skills with mcpConfig
   * @returns MCP servers in SDK format
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
   */
  private getConfigBySessionId(sessionId: string): ConversationConfig | undefined {
    const streamingId = Array.from(this.sessionIds.entries()).find(
      ([_, sid]) => sid === sessionId
    )?.[0];
    return streamingId ? this.conversationConfigs.get(streamingId) : undefined;
  }

  /**
   * Transform SDK message to StreamEvent format
   * Maps SDK message structure to CUI's StreamEvent format
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
   * Handles partial assistant messages during streaming
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
   * Get active conversations count
   */
  getActiveConversationsCount(): number {
    return this.queries.size;
  }

  /**
   * Check if a conversation is active
   */
  isConversationActive(streamingId: string): boolean {
    return this.queries.has(streamingId);
  }
}
