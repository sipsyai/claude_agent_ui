/**
 * Execution Routes - SSE Streaming for Agent Execution
 *
 * Provides Server-Sent Events (SSE) streaming endpoints for real-time
 * agent execution feedback.
 */

import { Router, Request, Response } from 'express';
import { strapiClient } from '../services/strapi-client.js';
import { createLogger } from '../services/logger.js';
import { asyncHandler, AppError } from '../middleware/error-handler.js';
import { randomUUID } from 'crypto';
import { ClaudeSdkService } from '../services/claude-sdk-service.js';
import { ClaudeHistoryReader } from '../services/claude-history-reader.js';
import { ConversationStatusManager } from '../services/conversation-status-manager.js';
import type { ConversationConfig, StreamEvent, AssistantStreamMessage, ResultStreamMessage } from '../types/index.js';

// Import validation schemas
import {
  executeAgentSchema,
  executeAgentIdSchema,
  conversationIdSchema
} from '../validators/execution.validators.js';

export function createExecutionRoutes(): Router {
  const router = Router();
  const logger = createLogger('ExecutionRoutes');

  // ============= CLAUDE SDK SERVICE INITIALIZATION =============

  // Initialize required services for Claude SDK
  const historyReader = new ClaudeHistoryReader();
  const statusManager = new ConversationStatusManager();
  const claudeSdkService = new ClaudeSdkService(
    historyReader,
    statusManager
  );

  logger.info('Claude SDK Service initialized for agent execution');

  // ============= SSE HELPER CLASS =============

  class SSEStream {
    private keepAliveInterval: NodeJS.Timeout | null = null;

    constructor(private res: Response) {
      // Set SSE headers
      this.res.setHeader('Content-Type', 'text/event-stream');
      this.res.setHeader('Cache-Control', 'no-cache, no-transform');
      this.res.setHeader('Connection', 'keep-alive');
      this.res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection comment
      this.res.write(': SSE stream initialized\n\n');
      this.res.flushHeaders();
    }

    /**
     * Send a named SSE event with data
     */
    send(event: string, data: any): void {
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    /**
     * Send SSE data without event name
     */
    sendData(data: any): void {
      this.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    /**
     * Send SSE comment (for keep-alive)
     */
    sendComment(comment: string): void {
      this.res.write(`: ${comment}\n\n`);
    }

    /**
     * Close the SSE stream
     */
    close(): void {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
      this.res.end();
    }

    /**
     * Start keep-alive ping every 30 seconds
     */
    startKeepAlive(): void {
      this.keepAliveInterval = setInterval(() => {
        this.sendComment('keep-alive');
      }, 30000);
    }

    /**
     * Stop keep-alive ping
     */
    stopKeepAlive(): void {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
    }
  }

  // ============= AGENT EXECUTION ENDPOINT =============

  /**
   * POST /api/execute/agent/:id
   * Execute an agent with SSE streaming
   */
  router.post('/agent/:id', async (req: Request, res: Response) => {
    let stream: SSEStream | null = null;

    try {
      // 1. Validate request
      const { id } = executeAgentIdSchema.parse(req.params);
      const body = executeAgentSchema.parse(req.body);

      logger.info('Agent execution requested', { agentId: id, message: body.message });

      // 2. Fetch agent configuration from Strapi
      const agent = await strapiClient.getAgent(id);

      if (!agent) {
        throw new AppError(404, 'Agent not found');
      }

      if (!agent.enabled) {
        throw new AppError(403, 'Agent is disabled');
      }

      // 3. Initialize SSE stream
      stream = new SSEStream(res);
      stream.startKeepAlive();

      // 4. Handle client disconnect
      req.on('close', () => {
        logger.info(`Client disconnected from agent ${id}`);
        if (stream) {
          stream.stopKeepAlive();
          stream.close();
        }
      });

      // 5. Generate conversation ID if not provided
      const conversationId = body.conversationId || `conv_${Date.now()}_${randomUUID()}`;

      // 6. Send execution start event
      stream.sendData({
        type: 'status',
        status: `Starting agent: ${agent.name}`,
        message: `Starting agent: ${agent.name}`,
        agentId: id,
        conversationId,
        timestamp: new Date().toISOString()
      });

      // 7. Fetch related data (skills, MCP servers)
      // Extract IDs from component-based structure
      const skillIds = agent.skillSelection?.map(s => typeof s.skill === 'string' ? s.skill : s.skill.id) || [];
      const mcpServerIds = agent.mcpConfig?.map(m => typeof m.mcpServer === 'string' ? m.mcpServer : m.mcpServer.id) || [];

      const skills = skillIds.length > 0 ? await strapiClient.getSkillsByIds(skillIds) : [];
      const mcpServers = mcpServerIds.length > 0 ? await strapiClient.getMCPServersByIds(mcpServerIds) : [];

      logger.debug('Agent execution context', {
        agentId: id,
        skillsCount: skills.length,
        mcpServersCount: mcpServers.length
      });

      // ✅ Sync skills to filesystem before SDK execution
      if (skills.length > 0) {
        try {
          const { skillSyncService } = await import('../services/skill-sync-service.js');

          // No input values for direct agent execution (no parameter injection)
          await skillSyncService.syncAllSkills(skills);

          logger.info('[AgentExecution] Synced skills to filesystem', {
            agentId: id,
            skillCount: skills.length,
            skillNames: skills.map(s => s.name)
          });
        } catch (syncError: any) {
          logger.error('[AgentExecution] Failed to sync skills', {
            error: syncError?.message,
            agentId: id
          });
          // Continue execution - skills won't be available but agent still works
        }
      }

      // 8. Send agent configuration event
      stream.sendData({
        type: 'debug',
        message: 'Configuration loaded',
        agent: {
          name: agent.name,
          model: agent.modelConfig?.model,
          tools: agent.toolConfig?.allowedTools,
          disallowedTools: agent.toolConfig?.disallowedTools
        },
        skills: skills.map(s => ({ id: s.id, name: s.name })),
        mcpServers: mcpServers.map(m => ({ id: m.id, name: m.name, disabled: m.disabled }))
      });

      // 9. Execute agent with Claude SDK

      // Build system prompt (skills are now loaded from filesystem, not appended here)
      const systemPrompt = agent.systemPrompt || '';

      // Merge tools from agent and skills
      const { allowedTools, disallowedTools } = mergeSkillTools(agent.toolConfig?.allowedTools || [], agent.toolConfig?.disallowedTools || [], skills);

      // Load MCP config from .mcp.json
      const workingDirectory = process.cwd();
      const agentMcpConfig = await loadMcpConfig(workingDirectory);

      // Build conversation config
      const conversationConfig: ConversationConfig = {
        initialPrompt: body.message,
        systemPrompt,
        workingDirectory,
        model: agent.modelConfig?.model || 'claude-sonnet-4-5',
        allowedTools,
        disallowedTools,
        permissionMode: body.context?.permissionMode || 'default',
        skills: skills // ✅ Pass skills to SDK for MCP loading and configuration
      };

      logger.debug('Starting Claude SDK conversation', {
        agentId: id,
        conversationId,
        model: conversationConfig.model,
        toolsCount: allowedTools.length,
        disallowedToolsCount: disallowedTools.length,
        hasMcpConfig: !!agentMcpConfig
      });

      // Track execution metrics
      const startTime = Date.now();
      let tokensUsed = 0;
      let streamingId: string | null = null;

      try {
        // Prepare event handlers BEFORE starting conversation to avoid missing events
        let lastContent = '';
        let resolvePromise: (() => void) | null = null;
        let rejectPromise: ((error: Error) => void) | null = null;
        const executionLog: any[] = []; // Collect all events for potential future use

        // Handle SDK messages
        const messageHandler = ({ streamingId: sid, message }: { streamingId: string; message: StreamEvent }) => {
          if (!streamingId || sid !== streamingId) return;

          logger.info('SDK event received', { agentId: id, eventType: message.type });

          try {
            // Save event to execution log
            executionLog.push({ type: 'message', content: message, timestamp: new Date().toISOString() });

            // Forward ALL SDK events to frontend (including stream_event, system, user, etc.)
            if (stream) {
              logger.info('📤 Forwarding SDK message to frontend', { messageType: message.type });
              stream.sendData({ type: 'message', content: message });
            } else {
              logger.error('❌ Stream is null, cannot forward message');
            }

            if (message.type === 'assistant') {
              const assistantMsg = message as AssistantStreamMessage;

              // Extract text content from assistant message
              const textContent = assistantMsg.message.content
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text)
                .join('');

              // Send incremental text as tokens
              if (textContent && textContent !== lastContent) {
                const newContent = textContent.substring(lastContent.length);
                if (newContent && stream) {
                  // Token events removed - SDK messages already contain full content
                }
                lastContent = textContent;
              }
            } else if (message.type === 'result') {
              const resultMsg = message as ResultStreamMessage;

              // Calculate tokens
              tokensUsed = (resultMsg.usage?.input_tokens || 0) + (resultMsg.usage?.output_tokens || 0);

              logger.info('Agent execution completed via SDK', {
                agentId: id,
                conversationId,
                tokensUsed,
                duration: resultMsg.duration_ms
              });

              resolvePromise?.();
            }
          } catch (eventError) {
            logger.error('Error processing SDK event', { error: eventError, agentId: id });
          }
        };

        // Handle SDK errors
        const errorHandler = ({ streamingId: sid, error: errorMsg }: { streamingId: string; error: string }) => {
          if (!streamingId || sid !== streamingId) return;
          logger.error('SDK error', { agentId: id, error: errorMsg });
          rejectPromise?.(new Error(errorMsg));
        };

        // Handle SDK completion
        const closeHandler = ({ streamingId: sid }: { streamingId: string }) => {
          if (!streamingId || sid !== streamingId) return;
          logger.info('SDK conversation closed', { agentId: id, conversationId });
          resolvePromise?.();
        };

        // Handle client disconnect
        const disconnectHandler = async () => {
          logger.info(`Client disconnected, stopping conversation`, { agentId: id, streamingId });
          if (streamingId) {
            await claudeSdkService.stopConversation(streamingId);
          }
        };

        // Register event listeners BEFORE starting conversation
        claudeSdkService.on('claude-message', messageHandler);
        claudeSdkService.on('process-error', errorHandler);
        claudeSdkService.on('process-closed', closeHandler);
        req.on('close', disconnectHandler);

        // Start SDK conversation AFTER registering listeners
        const { streamingId: sid } = await claudeSdkService.startConversation(conversationConfig);
        streamingId = sid;

        logger.info('Claude SDK conversation started', { agentId: id, conversationId, streamingId });

        // Wait for completion
        await new Promise<void>((resolve, reject) => {
          resolvePromise = resolve;
          rejectPromise = reject;
        })
          .finally(() => {
            // Cleanup listeners after promise completes
            claudeSdkService.off('claude-message', messageHandler);
            claudeSdkService.off('process-error', errorHandler);
            claudeSdkService.off('process-closed', closeHandler);
            req.off('close', disconnectHandler);
          });

        // 10. Send completion event
        const executionTime = Date.now() - startTime;
        const cost = calculateCost(tokensUsed, conversationConfig.model || 'sonnet');

        stream.sendData({
          type: 'status',
          status: 'Agent execution completed successfully',
          message: 'Agent execution completed successfully',
          tokensUsed,
          executionTime,
          cost,
          conversationId,
          timestamp: new Date().toISOString()
        });

        logger.info('Agent execution completed', { agentId: id, conversationId, tokensUsed, executionTime });

        // 11. Close stream after successful completion
        stream.close();

      } catch (sdkError: any) {
        logger.error('Claude SDK execution error', { error: sdkError?.message, agentId: id });
        throw sdkError;
      } finally {
        // Cleanup SDK conversation (but don't close stream yet - let success/error handlers do that)
        if (streamingId) {
          await claudeSdkService.stopConversation(streamingId).catch(() => {});
        }
        stream.stopKeepAlive();
      }

    } catch (error: any) {
      logger.error('Agent execution error', { error: error?.message });

      // If headers already sent, send error via SSE
      if (res.headersSent && stream) {
        stream.sendData({
          type: 'error',
          message: error?.message || 'Unknown error',
          errorType: error?.constructor?.name || 'Error',
          timestamp: new Date().toISOString()
        });
        stream.stopKeepAlive();
        stream.close();
      } else {
        // Otherwise send JSON error
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        res.status(statusCode).json({
          error: error?.message || 'Unknown error',
          type: error?.constructor?.name || 'Error'
        });
      }
    }
  });

  // ============= TASK EXECUTION ENDPOINT =============

  /**
   * POST /api/execute/task/:id
   * Execute a task with SSE streaming
   */
  router.post('/task/:id', async (req: Request, res: Response) => {
    let stream: SSEStream | null = null;

    try {
      // 1. Validate task ID
      const taskId = req.params.id;
      logger.info('Task execution requested', { taskId });

      // 2. Fetch task from Strapi
      const task = await strapiClient.getTask(taskId);

      if (!task) {
        throw new AppError(404, 'Task not found');
      }

      // 3. Fetch associated agent
      const agent = await strapiClient.getAgent(task.agentId);

      if (!agent) {
        throw new AppError(404, 'Agent not found for task');
      }

      if (!agent.enabled) {
        throw new AppError(403, 'Agent is disabled');
      }

      // 4. Update task status to 'running'
      await strapiClient.updateTask(taskId, {
        status: 'running'
      });

      // 5. Initialize SSE stream
      stream = new SSEStream(res);
      stream.startKeepAlive();

      // 6. Handle client disconnect
      req.on('close', () => {
        logger.info(`Client disconnected from task ${taskId}`);
        if (stream) {
          stream.stopKeepAlive();
          stream.close();
        }
      });

      // 7. Send execution start event
      logger.info('📤 Sending start event to frontend', { taskId });
      stream.sendData({
        type: 'status',
        status: `Starting task: ${task.name}`,
        message: `Starting task: ${task.name}`,
        taskId,
        agentId: agent.id,
        timestamp: new Date().toISOString()
      });
      logger.info('✅ Start event sent', { taskId });

      // 8. Fetch related data (skills, MCP servers)
      // Extract IDs from component-based structure
      const skillIds = agent.skillSelection?.map(s => typeof s.skill === 'string' ? s.skill : s.skill.id) || [];
      const mcpServerIds = agent.mcpConfig?.map(m => typeof m.mcpServer === 'string' ? m.mcpServer : m.mcpServer.id) || [];

      const skills = skillIds.length > 0 ? await strapiClient.getSkillsByIds(skillIds) : [];
      const mcpServers = mcpServerIds.length > 0 ? await strapiClient.getMCPServersByIds(mcpServerIds) : [];

      logger.debug('Task execution context', {
        taskId,
        agentId: agent.id,
        skillsCount: skills.length,
        mcpServersCount: mcpServers.length
      });

      // ✅ Sync skills to filesystem before SDK execution (with parameter injection)
      if (skills.length > 0) {
        try {
          const { skillSyncService } = await import('../services/skill-sync-service.js');

          // Input values from task metadata for {{param}} template replacement
          const inputValues = task.metadata?.inputValues || {};

          await skillSyncService.syncAllSkills(skills, inputValues);

          logger.info('[TaskExecution] Synced skills to filesystem', {
            taskId,
            agentId: agent.id,
            skillCount: skills.length,
            skillNames: skills.map(s => s.name),
            hasInputValues: Object.keys(inputValues).length > 0
          });
        } catch (syncError: any) {
          logger.error('[TaskExecution] Failed to sync skills', {
            error: syncError?.message,
            taskId
          });
          // Continue execution - skills won't be available but task still runs
        }
      }

      // 9. Send configuration event
      stream.sendData({
        type: 'debug',
        message: 'Configuration loaded',
        task: {
          name: task.name,
          message: task.message
        },
        agent: {
          name: agent.name,
          model: agent.modelConfig?.model,
          tools: agent.toolConfig?.allowedTools,
          disallowedTools: agent.toolConfig?.disallowedTools
        },
        skills: skills.map(s => ({ id: s.id, name: s.name })),
        mcpServers: mcpServers.map(m => ({ id: m.id, name: m.name, disabled: m.disabled }))
      });

      // 10. Execute agent with Claude SDK

      // Build system prompt (skills are now loaded from filesystem, not appended here)
      const systemPrompt = agent.systemPrompt || '';

      // Merge tools from agent and skills
      const { allowedTools, disallowedTools } = mergeSkillTools(agent.toolConfig?.allowedTools || [], agent.toolConfig?.disallowedTools || [], skills);

      // Load MCP config from .mcp.json
      const workingDirectory = process.cwd(); // Could be configurable per agent
      const mcpConfig = await loadMcpConfig(workingDirectory);

      // Build conversation config
      const conversationConfig: ConversationConfig = {
        initialPrompt: task.message,
        systemPrompt,
        workingDirectory,
        model: agent.modelConfig?.model || 'claude-sonnet-4-5',
        allowedTools,
        disallowedTools,
        permissionMode: 'bypassPermissions', // Auto-approve for task execution
        skills: skills // ✅ Pass skills to SDK for MCP loading and configuration
      };

      logger.debug('Starting Claude SDK conversation', {
        taskId,
        model: conversationConfig.model,
        toolsCount: allowedTools.length,
        disallowedToolsCount: disallowedTools.length,
        hasMcpConfig: !!mcpConfig
      });

      // Track execution metrics
      const startTime = Date.now();
      let tokensUsed = 0;
      let executionResult: any = null;
      let streamingId: string | null = null;

      try {
        // Prepare event handlers BEFORE starting conversation to avoid missing events
        let lastContent = '';
        let resolvePromise: (() => void) | null = null;
        let rejectPromise: ((error: Error) => void) | null = null;
        const executionLog: any[] = []; // Collect all events for saving to database

        // Handle SDK messages
        const messageHandler = ({ streamingId: sid, message }: { streamingId: string; message: StreamEvent }) => {
          if (!streamingId || sid !== streamingId) {
            logger.warn('⚠️ Received message for different streamingId', { expected: streamingId, received: sid });
            return;
          }

          logger.info('✅ SDK event received', { taskId, streamingId, eventType: message.type });

          try {
            // Save event to execution log
            executionLog.push({ type: 'message', content: message, timestamp: new Date().toISOString() });

            // Forward ALL SDK events to frontend (including stream_event, system, user, etc.)
            if (stream) {
              logger.info('📤 Forwarding SDK message to frontend', { messageType: message.type });
              stream.sendData({ type: 'message', content: message });
            } else {
              logger.error('❌ Stream is null, cannot forward message');
            }

            if (message.type === 'assistant') {
              const assistantMsg = message as AssistantStreamMessage;

              // Extract text content from assistant message
              const textContent = assistantMsg.message.content
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text)
                .join('');

              // Send incremental text as tokens
              if (textContent && textContent !== lastContent) {
                const newContent = textContent.substring(lastContent.length);
                if (newContent && stream) {
                  // Token events removed - SDK messages already contain full content
                }
                lastContent = textContent;
              }
            } else if (message.type === 'result') {
              const resultMsg = message as ResultStreamMessage;

              // Calculate tokens and metrics
              tokensUsed = (resultMsg.usage?.input_tokens || 0) + (resultMsg.usage?.output_tokens || 0);
              executionResult = {
                message: resultMsg.result || 'Task completed',
                success: !resultMsg.is_error,
                metrics: {
                  duration_ms: resultMsg.duration_ms,
                  duration_api_ms: resultMsg.duration_api_ms,
                  num_turns: resultMsg.num_turns,
                  usage: resultMsg.usage
                }
              };

              logger.info('Task execution completed via SDK', {
                taskId,
                tokensUsed,
                duration: resultMsg.duration_ms
              });

              resolvePromise?.();
            }
          } catch (eventError) {
            logger.error('Error processing SDK event', { error: eventError, taskId });
          }
        };

        // Handle SDK errors
        const errorHandler = ({ streamingId: sid, error: errorMsg }: { streamingId: string; error: string }) => {
          if (sid !== streamingId) return;
          logger.error('SDK error', { taskId, error: errorMsg });
          rejectPromise?.(new Error(errorMsg));
        };

        // Handle SDK completion
        const closeHandler = ({ streamingId: sid }: { streamingId: string }) => {
          if (!streamingId || sid !== streamingId) return;
          logger.info('SDK conversation closed', { taskId });
          resolvePromise?.();
        };

        // Handle client disconnect
        const disconnectHandler = async () => {
          logger.info(`Client disconnected, stopping conversation`, { taskId, streamingId });
          if (streamingId) {
            await claudeSdkService.stopConversation(streamingId);
          }
        };

        // Register event listeners BEFORE starting conversation
        claudeSdkService.on('claude-message', messageHandler);
        claudeSdkService.on('process-error', errorHandler);
        claudeSdkService.on('process-closed', closeHandler);
        req.on('close', disconnectHandler);

        // Start SDK conversation AFTER registering listeners
        const { streamingId: sid } = await claudeSdkService.startConversation(conversationConfig);
        streamingId = sid;

        logger.info('Claude SDK conversation started', { taskId, streamingId });

        // Wait for completion
        await new Promise<void>((resolve, reject) => {
          resolvePromise = resolve;
          rejectPromise = reject;
        })
          .finally(() => {
            // Cleanup listeners after promise completes
            claudeSdkService.off('claude-message', messageHandler);
            claudeSdkService.off('process-error', errorHandler);
            claudeSdkService.off('process-closed', closeHandler);
            req.off('close', disconnectHandler);
          });

        // 11. Update task status to 'completed'
        const executionTime = Date.now() - startTime;
        const cost = calculateCost(tokensUsed, conversationConfig.model || 'sonnet');

        await strapiClient.updateTask(taskId, {
          status: 'completed',
          completedAt: new Date(),
          result: executionResult || { message: 'Completed', success: true },
          executionTime,
          tokensUsed,
          cost,
          executionLog: executionLog // Save all SDK events for later viewing
        });

        // 12. Send completion event
        stream.sendData({
          type: 'status',
          status: executionResult?.message || 'Task completed successfully',
          message: executionResult?.message || 'Task completed successfully',
          tokensUsed,
          executionTime,
          cost,
          timestamp: new Date().toISOString()
        });

        logger.info('Task execution completed', { taskId, tokensUsed, executionTime });

        // 14. Close stream after successful completion
        stream.close();

      } catch (sdkError: any) {
        logger.error('Claude SDK execution error', { error: sdkError?.message, taskId });
        throw sdkError;
      } finally {
        // 13. Cleanup SDK conversation (but don't close stream yet - let success/error handlers do that)
        if (streamingId) {
          await claudeSdkService.stopConversation(streamingId).catch(() => {});
        }
        stream.stopKeepAlive();
      }

    } catch (error: any) {
      logger.error('Task execution error', { error: error?.message });

      // Update task status to 'failed' if possible
      const taskId = req.params.id;
      if (taskId) {
        try {
          await strapiClient.updateTask(taskId, {
            status: 'failed',
            completedAt: new Date(),
            error: error?.message || 'Unknown error'
          });
        } catch (updateError) {
          logger.error('Failed to update task status', { updateError });
        }
      }

      // If headers already sent, send error via SSE
      if (res.headersSent && stream) {
        stream.sendData({
          type: 'error',
          message: error?.message || 'Unknown error',
          errorType: error?.constructor?.name || 'Error',
          timestamp: new Date().toISOString()
        });
        stream.stopKeepAlive();
        stream.close();
      } else {
        // Otherwise send JSON error
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        res.status(statusCode).json({
          error: error?.message || 'Unknown error',
          type: error?.constructor?.name || 'Error'
        });
      }
    }
  });

  // ============= CONVERSATION MANAGEMENT =============

  /**
   * GET /api/execute/conversation/:id
   * Get conversation history by ID
   */
  router.get('/conversation/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = conversationIdSchema.parse(req.params);

    logger.debug('Fetching conversation', { conversationId: id });

    // TODO: Implement conversation retrieval from cache/database
    // For now, return placeholder
    res.json({
      conversationId: id,
      messages: [],
      metadata: {
        createdAt: new Date().toISOString(),
        message: 'Conversation storage pending implementation'
      }
    });
  }));

  /**
   * DELETE /api/execute/conversation/:id
   * Clear conversation history
   */
  router.delete('/conversation/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = conversationIdSchema.parse(req.params);

    logger.info('Deleting conversation', { conversationId: id });

    // TODO: Implement conversation deletion from cache/database
    // For now, return success
    res.json({
      success: true,
      message: 'Conversation deletion pending implementation'
    });
  }));

  // ============= HELPER FUNCTIONS =============

  /**
   * Build system prompt
   * NOTE: Skills are now loaded from filesystem by SDK (settingSources: ['project'])
   * No need to manually append skills to system prompt
   */
  function buildSystemPrompt(agent: any): string {
    return agent.systemPrompt || '';
  }

  /**
   * Build tool list from agent and MCP servers
   */
  function buildToolList(agent: any, mcpServers: any[]): string[] {
    const tools = [...(agent.toolConfig?.allowedTools || [])];
    const disallowed = agent.toolConfig?.disallowedTools || [];

    // TODO: Add MCP server tools when MCP service is integrated
    // For now, just return agent tools

    // Filter out disallowed tools
    return tools.filter(tool => !disallowed.includes(tool));
  }

  /**
   * Calculate cost based on token usage and model
   * Pricing as of 2025 (approximate)
   */
  function calculateCost(tokens: number, model: string): number {
    // Pricing per 1M tokens (input + output averaged)
    const pricing: Record<string, number> = {
      'haiku': 0.40,           // $0.25 input, $1.25 output avg
      'sonnet': 3.00,          // $3 input, $15 output avg
      'sonnet-4': 3.00,
      'claude-sonnet-4-5': 3.00,
      'opus': 15.00,           // $15 input, $75 output avg
      'opus-4': 15.00
    };

    const pricePerMillion = pricing[model] || pricing['sonnet'];
    return (tokens / 1_000_000) * pricePerMillion;
  }

  /**
   * Load MCP configuration from .mcp.json file
   * Based on legacy task.routes.ts implementation
   */
  async function loadMcpConfig(projectPath: string): Promise<Record<string, any> | undefined> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const mcpConfigPath = path.join(projectPath, '.mcp.json');
      const content = await fs.readFile(mcpConfigPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.mcpServers && typeof config.mcpServers === 'object') {
        logger.debug('Loaded MCP config', {
          projectPath,
          serverCount: Object.keys(config.mcpServers).length
        });
        return config.mcpServers;
      }

      return undefined;
    } catch (error) {
      // .mcp.json not found or invalid - this is okay
      logger.debug('No MCP config found', { projectPath });
      return undefined;
    }
  }

  /**
   * Merge tools from skills into agent's tool list
   * Based on legacy implementation
   */
  function mergeSkillTools(
    agentAllowedTools: string[] | undefined,
    agentDisallowedTools: string[] | undefined,
    skills: any[]
  ): { allowedTools: string[]; disallowedTools: string[] } {
    let allowedTools = [...(agentAllowedTools || [])];
    let disallowedTools = [...(agentDisallowedTools || [])];

    const allBuiltInTools = [
      'WebFetch', 'WebSearch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'Task', 'TodoWrite', 'ExitPlanMode', 'NotebookEdit', 'BashOutput',
      'KillShell', 'AskUserQuestion', 'Skill', 'SlashCommand'
    ];

    // Merge tools from skills
    for (const skill of skills) {
      // Merge allowed tools from skill
      if (skill.toolConfig?.allowedTools && Array.isArray(skill.toolConfig?.allowedTools)) {
        allowedTools = [...new Set([...allowedTools, ...skill.toolConfig.allowedTools])];
      }

      // Merge disallowed tools from skill
      if (skill.toolConfig?.disallowedTools && Array.isArray(skill.toolConfig?.disallowedTools)) {
        disallowedTools = [...new Set([...disallowedTools, ...skill.toolConfig.disallowedTools])];
      }
    }

    // Enforce strict tool allowlist: block all tools not explicitly allowed
    // (only if there are allowed tools defined)
    if (allowedTools.length > 0) {
      const implicitlyDisallowed = allBuiltInTools.filter(tool => !allowedTools.includes(tool));
      disallowedTools = [...new Set([...disallowedTools, ...implicitlyDisallowed])];
      logger.debug('Enforcing strict tool allowlist', { allowedTools, disallowedTools });
    }

    return { allowedTools, disallowedTools };
  }

  /**
   * Inject parameters into skill content ({{param}} replacement)
   * Based on legacy implementation
   */
  function injectSkillParameters(content: string, parameters: Record<string, any>): string {
    let processed = content;

    if (Object.keys(parameters).length > 0) {
      Object.entries(parameters).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        processed = processed.replace(regex, String(value));
      });
    }

    return processed;
  }

  return router;
}
