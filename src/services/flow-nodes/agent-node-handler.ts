/**
 * Claude Agent UI - Agent Node Handler
 *
 * Handles agent nodes in flow execution.
 * Responsibilities:
 * - Fetch agent configuration from Strapi
 * - Execute agent using Claude SDK Service
 * - Handle prompt template interpolation
 * - Track token usage and costs
 * - Support retry logic for errors
 *
 * @see src/types/flow-types.ts for AgentNode type definition
 * @see src/services/claude-sdk-service.ts for agent execution
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, type Logger } from '../logger.js';
import { strapiClient } from '../strapi-client.js';
import type { NodeHandler } from '../flow-execution-service.js';
import type {
  FlowNode,
  FlowExecutionContext,
  NodeExecutionResult,
  AgentNode,
} from '../../types/flow-types.js';
import { isAgentNode } from '../../types/flow-types.js';
import type { Agent } from '../../types/agent.types.js';

// Token cost per model (approximate, for cost estimation)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
  'claude-opus-4': { input: 0.015, output: 0.075 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
};

// Default model if not specified
const DEFAULT_MODEL = 'claude-sonnet-4-5';

/**
 * AgentNodeHandler - Executes agents within flow context
 *
 * This handler integrates with the ClaudeSdkService to execute
 * agents with proper configuration, prompt interpolation, and
 * result handling.
 */
export class AgentNodeHandler implements NodeHandler {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('AgentNodeHandler');
  }

  /**
   * Execute the agent node
   * @param node - The agent node to execute
   * @param context - The flow execution context
   * @returns Node execution result with agent output
   */
  async execute(node: FlowNode, context: FlowExecutionContext): Promise<NodeExecutionResult> {
    // Type guard to ensure we have an AgentNode
    if (!isAgentNode(node)) {
      return {
        success: false,
        error: `Expected agent node, got ${node.type}`,
      };
    }

    const agentNode = node as AgentNode;

    this.logger.info('Executing agent node', {
      nodeId: agentNode.nodeId,
      nodeName: agentNode.name,
      agentId: agentNode.agentId,
    });

    try {
      // 1. Fetch agent configuration
      const agent = await this.fetchAgent(agentNode.agentId);

      if (!agent) {
        return {
          success: false,
          error: `Agent with ID ${agentNode.agentId} not found`,
        };
      }

      context.log('info', `Loaded agent: ${agent.name}`, node.nodeId, {
        agentName: agent.name,
        agentModel: agent.modelConfig?.model,
      });

      // 2. Interpolate prompt template with context variables
      const interpolatedPrompt = this.interpolateTemplate(
        agentNode.promptTemplate,
        context.variables,
        context.data
      );

      context.log('debug', 'Prompt interpolated', node.nodeId, {
        promptLength: interpolatedPrompt.length,
      });

      // 3. Determine model to use (node override > agent default)
      const model = agentNode.modelOverride !== 'default'
        ? agentNode.modelOverride
        : agent.modelConfig?.model || DEFAULT_MODEL;

      // 4. Execute the agent
      const executionResult = await this.executeAgent({
        agent,
        prompt: interpolatedPrompt,
        model,
        skills: agentNode.skills,
        maxTokens: agentNode.maxTokens,
        timeout: agentNode.timeout,
        context,
        nodeId: agentNode.nodeId,
      });

      // 5. Calculate cost
      const tokenCosts = TOKEN_COSTS[model] || TOKEN_COSTS[DEFAULT_MODEL];
      const cost = (
        (executionResult.inputTokens * tokenCosts.input) +
        (executionResult.outputTokens * tokenCosts.output)
      ) / 1000; // Convert to dollars

      context.log('info', 'Agent execution completed', node.nodeId, {
        tokensUsed: executionResult.totalTokens,
        cost: cost.toFixed(6),
      });

      return {
        success: true,
        output: {
          result: executionResult.result,
          agentName: agent.name,
          model,
          completedAt: new Date().toISOString(),
        },
        data: {
          agentResult: executionResult.result,
          [agentNode.nodeId]: executionResult.result,
        },
        tokensUsed: executionResult.totalTokens,
        cost,
        continueExecution: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Agent node execution failed', error as Error, {
        nodeId: agentNode.nodeId,
        agentId: agentNode.agentId,
      });

      return {
        success: false,
        error: errorMessage,
        errorDetails: error instanceof Error ? { stack: error.stack } : undefined,
      };
    }
  }

  /**
   * Fetch agent configuration from Strapi
   */
  private async fetchAgent(agentId: string): Promise<Agent | null> {
    try {
      const agent = await strapiClient.getAgent(agentId);
      return agent;
    } catch (error) {
      this.logger.error('Failed to fetch agent', error as Error, { agentId });
      return null;
    }
  }

  /**
   * Interpolate template variables in the prompt
   * Supports {{variableName}} and {{nodeId.property}} syntax
   */
  private interpolateTemplate(
    template: string,
    variables: Record<string, any>,
    data: Record<string, any>
  ): string {
    if (!template) return '';

    // Merge variables and data for interpolation
    const allVariables = {
      ...data,
      ...variables,
    };

    // Replace {{variableName}} patterns
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();

      // Support nested property access (e.g., input.url, node1.result)
      const parts = trimmedPath.split('.');
      let value: any = allVariables;

      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // Variable not found, return original placeholder
          return match;
        }
      }

      // Convert value to string for template
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });
  }

  /**
   * Execute the agent using Claude SDK
   * This is a simplified execution that creates a conversation and waits for result
   */
  private async executeAgent(params: {
    agent: Agent;
    prompt: string;
    model: string;
    skills: string[];
    maxTokens?: number;
    timeout: number;
    context: FlowExecutionContext;
    nodeId: string;
  }): Promise<{
    result: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }> {
    const { agent, prompt, model, skills, maxTokens, timeout, context, nodeId } = params;

    // Import ClaudeSdkService dynamically to avoid circular dependencies
    const { ClaudeSdkService } = await import('../claude-sdk-service.js');
    const { ClaudeHistoryReader } = await import('../claude-history-reader.js');
    const { ConversationStatusManager } = await import('../conversation-status-manager.js');

    // Create a temporary SDK service instance for this execution
    const historyReader = new ClaudeHistoryReader();
    const statusManager = new ConversationStatusManager();
    const sdkService = new ClaudeSdkService(historyReader, statusManager);

    return new Promise(async (resolve, reject) => {
      const executionTimeout = setTimeout(() => {
        reject(new Error(`Agent execution timed out after ${timeout}ms`));
      }, timeout);

      try {
        let result = '';
        let inputTokens = 0;
        let outputTokens = 0;

        // Set up event listeners
        const messageHandler = (event: { streamingId: string; message: any }) => {
          const msg = event.message;

          // Handle assistant messages (collect text content)
          if (msg.type === 'assistant' && msg.message?.content) {
            for (const block of msg.message.content) {
              if (block.type === 'text') {
                result += block.text;
              }
            }
          }

          // Handle result messages (get token usage)
          if (msg.type === 'result') {
            inputTokens = msg.usage?.input_tokens || 0;
            outputTokens = msg.usage?.output_tokens || 0;
          }
        };

        const closeHandler = (event: { streamingId: string; code: number }) => {
          clearTimeout(executionTimeout);
          sdkService.removeListener('claude-message', messageHandler);
          sdkService.removeListener('process-closed', closeHandler);
          sdkService.removeListener('process-error', errorHandler);

          // Stop the conversation
          sdkService.stopConversation(event.streamingId).catch(() => {});

          resolve({
            result,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
          });
        };

        const errorHandler = (event: { streamingId: string; error: string }) => {
          clearTimeout(executionTimeout);
          sdkService.removeListener('claude-message', messageHandler);
          sdkService.removeListener('process-closed', closeHandler);
          sdkService.removeListener('process-error', errorHandler);

          reject(new Error(`Agent execution error: ${event.error}`));
        };

        sdkService.on('claude-message', messageHandler);
        sdkService.on('process-closed', closeHandler);
        sdkService.on('process-error', errorHandler);

        // Build conversation config
        const conversationConfig = {
          initialPrompt: prompt,
          model: model as any,
          systemPrompt: agent.systemPrompt,
          workingDirectory: process.cwd(),
          permissionMode: 'acceptEdits' as const, // Auto-accept for flow execution
          allowedTools: agent.toolConfig?.allowedTools || undefined,
          disallowedTools: agent.toolConfig?.disallowedTools || undefined,
          skills: await this.loadSkillsForAgent(skills),
        };

        // Start the conversation
        const { streamingId } = await sdkService.startConversation(conversationConfig);

        context.log('debug', 'Agent conversation started', nodeId, { streamingId });

      } catch (error) {
        clearTimeout(executionTimeout);
        reject(error);
      }
    });
  }

  /**
   * Load skill configurations for the agent
   */
  private async loadSkillsForAgent(skillIds: string[]): Promise<any[]> {
    if (!skillIds || skillIds.length === 0) {
      return [];
    }

    try {
      const skills = await Promise.all(
        skillIds.map(async (skillId) => {
          try {
            const skill = await strapiClient.getSkill(skillId);
            return skill;
          } catch {
            return null;
          }
        })
      );

      return skills.filter(Boolean);
    } catch (error) {
      this.logger.warn('Failed to load skills for agent', { error, skillIds });
      return [];
    }
  }
}

/**
 * Singleton instance for registration
 */
export const agentNodeHandler = new AgentNodeHandler();
