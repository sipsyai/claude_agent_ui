/**
 * Claude Agent UI - Flow SDK Service
 *
 * Provides a shared ClaudeSdkService factory for flow execution.
 * This avoids creating new SDK instances for each agent node execution,
 * improving performance and resource usage.
 *
 * Features:
 * - Singleton SDK service instance for all flow executions
 * - Proper initialization with required dependencies
 * - Event-based communication for real-time updates
 * - Clean integration with skill sync and MCP loading
 * - MCP server configuration support
 *
 * Integration with ClaudeSdkService:
 * This service properly configures ClaudeSdkService with:
 * - MCP config path for skill/server discovery
 * - Working directory for project context
 * - Required dependencies (history reader, status manager)
 *
 * @see src/services/claude-sdk-service.ts for SDK implementation
 * @see src/services/flow-nodes/agent-node-handler.ts for usage
 */

import * as path from 'path';
import { ClaudeSdkService } from './claude-sdk-service.js';
import { ClaudeHistoryReader } from './claude-history-reader.js';
import { ConversationStatusManager } from './conversation-status-manager.js';
import { createLogger, type Logger } from './logger.js';
import type { ConversationConfig, StreamEvent, AssistantStreamMessage, ResultStreamMessage } from '../types/index.js';

// ============= TYPES =============

/**
 * Result from SDK execution
 */
export interface SdkExecutionResult {
  result: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Configuration for agent execution via SDK
 */
export interface AgentExecutionConfig {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  workingDirectory?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  skills?: any[];
  timeout?: number;
}

// ============= FLOW SDK SERVICE =============

/**
 * FlowSdkService - Shared SDK service for flow execution
 *
 * Provides a reusable ClaudeSdkService instance optimized for
 * executing agents within flows. Handles event-based communication
 * and proper resource cleanup.
 */
export class FlowSdkService {
  private static instance: FlowSdkService;
  private sdkService: ClaudeSdkService;
  private logger: Logger;
  private isInitialized: boolean = false;
  private defaultWorkingDirectory: string;

  private constructor() {
    this.logger = createLogger('FlowSdkService');
    this.defaultWorkingDirectory = process.cwd();

    // Initialize SDK service with required dependencies
    const historyReader = new ClaudeHistoryReader();
    const statusManager = new ConversationStatusManager();
    this.sdkService = new ClaudeSdkService(historyReader, statusManager);

    // Configure ClaudeSdkService with MCP config path
    // This enables skill/MCP server discovery for flow executions
    this.configureSdkService();

    this.isInitialized = true;
    this.logger.info('FlowSdkService initialized for flow execution', {
      workingDirectory: this.defaultWorkingDirectory,
    });
  }

  /**
   * Configure the underlying SDK service with required settings
   * This ensures proper MCP server and skill discovery
   */
  private configureSdkService(): void {
    // Set MCP config path for server discovery
    // Check common locations: .mcp.json, ~/.claude/mcp.json
    const mcpPaths = [
      path.join(this.defaultWorkingDirectory, '.mcp.json'),
      path.join(process.env.HOME || '', '.claude', 'mcp.json'),
    ];

    for (const mcpPath of mcpPaths) {
      try {
        // Just set the first available path - SDK will handle file existence
        this.sdkService.setMcpConfigPath(mcpPath);
        this.logger.debug('Set MCP config path', { mcpPath });
        break;
      } catch (error) {
        this.logger.debug('MCP config path not available', { mcpPath });
      }
    }
  }

  /**
   * Set the default working directory for flow executions
   * @param directory - The working directory path
   */
  setDefaultWorkingDirectory(directory: string): void {
    this.defaultWorkingDirectory = directory;
    this.logger.info('Updated default working directory', { directory });
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): FlowSdkService {
    if (!FlowSdkService.instance) {
      FlowSdkService.instance = new FlowSdkService();
    }
    return FlowSdkService.instance;
  }

  /**
   * Get the underlying SDK service (for advanced use cases)
   */
  getSdkService(): ClaudeSdkService {
    return this.sdkService;
  }

  /**
   * Execute an agent and wait for completion
   * This is a blocking call that returns when the agent finishes
   *
   * @param config - Agent execution configuration
   * @returns Promise with execution result
   */
  async executeAgent(config: AgentExecutionConfig): Promise<SdkExecutionResult> {
    const startTime = Date.now();

    this.logger.info('Starting agent execution', {
      model: config.model,
      hasSystemPrompt: !!config.systemPrompt,
      skillCount: config.skills?.length || 0,
      timeout: config.timeout,
    });

    return new Promise(async (resolve, reject) => {
      // Set up timeout
      const timeoutMs = config.timeout || 300000; // Default 5 minutes
      const executionTimeout = setTimeout(() => {
        reject(new Error(`Agent execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      let streamingId: string | null = null;
      let result = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let isResolved = false;

      const cleanup = () => {
        clearTimeout(executionTimeout);
        if (streamingId) {
          this.sdkService.stopConversation(streamingId).catch(() => {});
        }
      };

      const resolveOnce = (data: SdkExecutionResult) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(data);
        }
      };

      const rejectOnce = (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(error);
        }
      };

      try {
        // Event handlers
        const messageHandler = (event: { streamingId: string; message: StreamEvent }) => {
          if (!streamingId || event.streamingId !== streamingId) return;

          const msg = event.message;

          // Handle assistant messages - extract text content
          if (msg.type === 'assistant') {
            const assistantMsg = msg as AssistantStreamMessage;
            if (assistantMsg.message?.content) {
              for (const block of assistantMsg.message.content) {
                if (block.type === 'text' && block.text) {
                  // Accumulate text content
                  result = assistantMsg.message.content
                    .filter((b: any) => b.type === 'text')
                    .map((b: any) => b.text)
                    .join('');
                }
              }
            }
          }

          // Handle result messages - get final metrics
          if (msg.type === 'result') {
            const resultMsg = msg as ResultStreamMessage;
            inputTokens = resultMsg.usage?.input_tokens || 0;
            outputTokens = resultMsg.usage?.output_tokens || 0;

            // Don't resolve here - wait for close event
          }
        };

        const closeHandler = (event: { streamingId: string; code: number }) => {
          if (!streamingId || event.streamingId !== streamingId) return;

          this.logger.info('Agent execution completed', {
            streamingId,
            tokensUsed: inputTokens + outputTokens,
            durationMs: Date.now() - startTime,
          });

          // Remove listeners
          this.sdkService.off('claude-message', messageHandler);
          this.sdkService.off('process-closed', closeHandler);
          this.sdkService.off('process-error', errorHandler);

          resolveOnce({
            result,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            durationMs: Date.now() - startTime,
            success: true,
          });
        };

        const errorHandler = (event: { streamingId: string; error: string }) => {
          if (!streamingId || event.streamingId !== streamingId) return;

          this.logger.error('Agent execution error', { error: event.error });

          // Remove listeners
          this.sdkService.off('claude-message', messageHandler);
          this.sdkService.off('process-closed', closeHandler);
          this.sdkService.off('process-error', errorHandler);

          rejectOnce(new Error(event.error));
        };

        // Register event listeners BEFORE starting conversation
        this.sdkService.on('claude-message', messageHandler);
        this.sdkService.on('process-closed', closeHandler);
        this.sdkService.on('process-error', errorHandler);

        // Build conversation config
        // Use provided working directory or fall back to default
        const workingDir = config.workingDirectory || this.defaultWorkingDirectory;

        const conversationConfig: ConversationConfig = {
          initialPrompt: config.prompt,
          systemPrompt: config.systemPrompt,
          workingDirectory: workingDir,
          model: (config.model as any) || 'claude-sonnet-4-5',
          allowedTools: config.allowedTools,
          disallowedTools: config.disallowedTools,
          permissionMode: config.permissionMode || 'acceptEdits',
          skills: config.skills,
        };

        this.logger.debug('Built conversation config for flow execution', {
          model: conversationConfig.model,
          workingDirectory: workingDir,
          hasSystemPrompt: !!config.systemPrompt,
          skillCount: config.skills?.length || 0,
          permissionMode: conversationConfig.permissionMode,
        });

        // Start the conversation
        const { streamingId: sid } = await this.sdkService.startConversation(conversationConfig);
        streamingId = sid;

        this.logger.debug('SDK conversation started', { streamingId });

      } catch (error) {
        clearTimeout(executionTimeout);
        rejectOnce(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Check if the SDK service is ready for use
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the number of active conversations
   */
  getActiveConversationsCount(): number {
    return this.sdkService.getActiveConversationsCount();
  }
}

// ============= EXPORTS =============

/**
 * Get the shared FlowSdkService instance
 */
export function getFlowSdkService(): FlowSdkService {
  return FlowSdkService.getInstance();
}

/**
 * Singleton instance for direct import
 */
export const flowSdkService = FlowSdkService.getInstance();
