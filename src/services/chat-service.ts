/**
 * Chat Service - Manages chat sessions and messages
 *
 * This service handles:
 * - Creating and managing chat sessions
 * - Sending messages with file attachments
 * - Streaming responses from Claude Agent SDK
 * - Storing messages in Strapi
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
  private logger: Logger;
  private activeStreams: Map<string, Query> = new Map();
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
   * Get chat session by documentId
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
   * Get all chat sessions
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
   * Get messages for a chat session
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
   * Send a message and stream response
   * This is an async generator that yields chat messages as they arrive
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
   * Build async generator for streaming input mode
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
   * Delete a chat session
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
   * Archive a chat session
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
   * @param streamId - The unique stream ID returned in stream_id event
   * @returns true if stream was cancelled, false if stream not found
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
   * Get list of active stream IDs
   * Useful for debugging or monitoring active conversations
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
