/**
 * Claude Agent UI - Agent Node Handler
 *
 * Handles agent nodes in flow execution.
 * Responsibilities:
 * - Fetch agent configuration from Strapi
 * - Execute agent using shared FlowSdkService
 * - Handle prompt template interpolation
 * - Sync skills to filesystem before execution
 * - Track token usage and costs
 * - Support retry logic for errors
 *
 * Integration with ClaudeSdkService:
 * This handler uses the FlowSdkService which wraps ClaudeSdkService
 * to provide a shared, reusable SDK instance for all flow executions.
 * This approach avoids creating new SDK instances for each agent node,
 * improving performance and resource management.
 *
 * @see src/types/flow-types.ts for AgentNode type definition
 * @see src/services/flow-sdk-service.ts for SDK integration
 * @see src/services/claude-sdk-service.ts for underlying SDK
 */

import { createLogger, type Logger } from '../logger.js';
import { strapiClient } from '../strapi-client.js';
import { flowSdkService, type AgentExecutionConfig } from '../flow-sdk-service.js';
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

      // 2. Load and sync skills for this execution
      const skills = await this.loadAndSyncSkills(agentNode.skills, context.input, agentNode.nodeId, context);

      // 3. Interpolate prompt template with context variables
      const interpolatedPrompt = this.interpolateTemplate(
        agentNode.promptTemplate,
        context.variables,
        context.data
      );

      context.log('debug', 'Prompt interpolated', node.nodeId, {
        promptLength: interpolatedPrompt.length,
      });

      // 4. Determine model to use (node override > agent default)
      const model = agentNode.modelOverride !== 'default'
        ? agentNode.modelOverride
        : agent.modelConfig?.model || DEFAULT_MODEL;

      // 5. Build tool configuration
      const { allowedTools, disallowedTools } = this.mergeToolConfig(agent, skills);

      // 6. Determine working directory
      // Priority: flow metadata > node metadata > default (process.cwd())
      const workingDirectory = this.getWorkingDirectory(agentNode, context);

      // 7. Execute the agent using shared FlowSdkService
      const executionResult = await this.executeAgent({
        agent,
        prompt: interpolatedPrompt,
        model,
        skills,
        allowedTools,
        disallowedTools,
        timeout: agentNode.timeout,
        context,
        nodeId: agentNode.nodeId,
        workingDirectory,
      });

      // 8. Calculate cost
      const tokenCosts = TOKEN_COSTS[model] || TOKEN_COSTS[DEFAULT_MODEL];
      const cost = (
        (executionResult.inputTokens * tokenCosts.input) +
        (executionResult.outputTokens * tokenCosts.output)
      ) / 1000; // Convert to dollars

      context.log('info', 'Agent execution completed', node.nodeId, {
        tokensUsed: executionResult.totalTokens,
        cost: cost.toFixed(6),
        durationMs: executionResult.durationMs,
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
   * Load and sync skills to filesystem for SDK to discover
   * This ensures skills are available before agent execution
   */
  private async loadAndSyncSkills(
    skillIds: string[],
    inputValues: Record<string, any>,
    nodeId: string,
    context: FlowExecutionContext
  ): Promise<any[]> {
    if (!skillIds || skillIds.length === 0) {
      return [];
    }

    try {
      // Fetch skills from Strapi
      const skills = await Promise.all(
        skillIds.map(async (skillId) => {
          try {
            return await strapiClient.getSkill(skillId);
          } catch {
            this.logger.warn('Failed to load skill', { skillId });
            return null;
          }
        })
      );

      const validSkills = skills.filter((s): s is NonNullable<typeof s> => s !== null);

      if (validSkills.length === 0) {
        return [];
      }

      // Sync skills to filesystem
      try {
        const { skillSyncService } = await import('../skill-sync-service.js');
        await skillSyncService.syncAllSkills(validSkills, inputValues);

        context.log('debug', `Synced ${validSkills.length} skills to filesystem`, nodeId, {
          skillNames: validSkills.map(s => s?.name || 'unknown'),
        });
      } catch (syncError) {
        this.logger.warn('Failed to sync skills to filesystem', { error: syncError });
        context.log('warn', 'Skill sync failed, continuing without filesystem skills', nodeId);
        // Continue execution - skills may still work through MCP config
      }

      return validSkills;
    } catch (error) {
      this.logger.warn('Failed to load skills', { error, skillIds });
      return [];
    }
  }

  /**
   * Get the working directory for agent execution
   * Priority: node metadata > flow metadata > default (process.cwd())
   */
  private getWorkingDirectory(node: AgentNode, context: FlowExecutionContext): string {
    // Check node metadata for working directory
    if (node.metadata?.workingDirectory) {
      return node.metadata.workingDirectory as string;
    }

    // Check flow metadata for working directory
    if (context.flow.metadata?.workingDirectory) {
      return context.flow.metadata.workingDirectory as string;
    }

    // Default to process.cwd()
    return process.cwd();
  }

  /**
   * Merge tool configuration from agent and skills
   * Skills can add to allowed tools and disallowed tools
   *
   * Returns string arrays for flexibility since the SDK accepts string tool names
   * even though the Agent type uses a stricter ToolName union type
   */
  private mergeToolConfig(agent: Agent, skills: any[]): {
    allowedTools: string[];
    disallowedTools: string[];
  } {
    // Start with agent's tool configuration (convert from ToolName[] to string[])
    const agentAllowed = agent.toolConfig?.allowedTools || [];
    const agentDisallowed = agent.toolConfig?.disallowedTools || [];
    let allowedTools: string[] = agentAllowed.map(t => String(t));
    let disallowedTools: string[] = agentDisallowed.map(t => String(t));

    const allBuiltInTools: string[] = [
      'WebFetch', 'WebSearch', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'Task', 'TodoWrite', 'NotebookEdit', 'BashOutput',
      'KillShell', 'AskUserQuestion', 'Skill', 'SlashCommand'
    ];

    // Merge tools from skills
    for (const skill of skills) {
      if (skill?.toolConfig?.allowedTools && Array.isArray(skill.toolConfig.allowedTools)) {
        const skillAllowedTools = skill.toolConfig.allowedTools.map((t: any) => String(t));
        allowedTools = Array.from(new Set([...allowedTools, ...skillAllowedTools]));
      }

      if (skill?.toolConfig?.disallowedTools && Array.isArray(skill.toolConfig.disallowedTools)) {
        const skillDisallowedTools = skill.toolConfig.disallowedTools.map((t: any) => String(t));
        disallowedTools = Array.from(new Set([...disallowedTools, ...skillDisallowedTools]));
      }
    }

    // Enforce strict tool allowlist: block all tools not explicitly allowed
    if (allowedTools.length > 0) {
      const implicitlyDisallowed = allBuiltInTools.filter(tool => !allowedTools.includes(tool));
      disallowedTools = Array.from(new Set([...disallowedTools, ...implicitlyDisallowed]));
    }

    return { allowedTools, disallowedTools };
  }

  /**
   * Execute the agent using shared FlowSdkService
   * This leverages the singleton SDK service for efficient resource usage
   * and properly integrates with ClaudeSdkService via FlowSdkService
   */
  private async executeAgent(params: {
    agent: Agent;
    prompt: string;
    model: string;
    skills: any[];
    allowedTools: string[];
    disallowedTools: string[];
    timeout: number;
    context: FlowExecutionContext;
    nodeId: string;
    workingDirectory: string;
  }): Promise<{
    result: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
  }> {
    const { agent, prompt, model, skills, allowedTools, disallowedTools, timeout, context, nodeId, workingDirectory } = params;

    context.log('debug', 'Starting agent execution via FlowSdkService', nodeId, {
      model,
      skillCount: skills.length,
      allowedToolsCount: allowedTools.length,
      timeout,
      workingDirectory,
    });

    // Build execution config for FlowSdkService
    // This config is passed to ClaudeSdkService for agent execution
    const executionConfig: AgentExecutionConfig = {
      prompt,
      systemPrompt: agent.systemPrompt,
      model,
      workingDirectory,
      allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
      disallowedTools: disallowedTools.length > 0 ? disallowedTools : undefined,
      permissionMode: 'acceptEdits', // Auto-accept for flow execution
      skills,
      timeout,
    };

    try {
      // Execute using shared SDK service
      const result = await flowSdkService.executeAgent(executionConfig);

      if (!result.success) {
        throw new Error(result.error || 'Agent execution failed');
      }

      return {
        result: result.result,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        durationMs: result.durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      context.log('error', `Agent execution failed: ${errorMessage}`, nodeId);
      throw error;
    }
  }
}

/**
 * Singleton instance for registration
 */
export const agentNodeHandler = new AgentNodeHandler();
