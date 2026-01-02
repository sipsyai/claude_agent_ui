/**
 * Training Agent Selector Service
 *
 * Selects the appropriate training agent based on:
 * 1. Skill-specific override (if set)
 * 2. Global config setting (if set)
 * 3. Fallback to local training-agent.md
 */

import { createLogger } from './logger.js';
import { ClaudeStructureParser } from './claude-structure-parser.js';
import { strapiClient } from './strapi-client.js';
import { ConfigService } from './config-service.js';

const logger = createLogger('TrainingAgentSelector');

/**
 * Training Agent Configuration
 *
 * @description
 * Represents a training agent configuration that can be used to train skills in the system.
 * Training agents define the system prompt, tool permissions, model configuration, and MCP
 * server integrations used during skill training sessions.
 *
 * Training agents can be sourced from:
 * - Strapi database (skill-specific or global config)
 * - Local filesystem (.claude/agents/training-agent.md)
 *
 * @interface TrainingAgent
 *
 * @property {string} id - Unique identifier for the training agent
 * @property {string} name - Human-readable name of the training agent
 * @property {string} [description] - Optional description explaining the agent's purpose and behavior
 * @property {string} content - The system prompt/instructions that define the agent's behavior
 * @property {Object} [metadata] - Optional metadata for tool and model configuration
 * @property {string[]} [metadata.tools] - List of allowed tool names (legacy field)
 * @property {string[]} [metadata.allowedTools] - List of allowed tool names for the agent
 * @property {string} [metadata.model] - Claude model to use (e.g., 'claude-sonnet-4-5')
 * @property {Record<string, string[]>} [metadata.mcpTools] - MCP server tools configuration
 *   where keys are MCP server names and values are arrays of allowed tool names
 *
 * @example
 * ```typescript
 * const agent: TrainingAgent = {
 *   id: 'training-agent',
 *   name: 'Skill Training Agent',
 *   description: 'Agent for training new skills',
 *   content: 'You are a training agent...',
 *   metadata: {
 *     allowedTools: ['Read', 'Write', 'Bash'],
 *     model: 'claude-sonnet-4-5',
 *     mcpTools: {
 *       'github': ['search_repositories', 'get_file_contents'],
 *       'filesystem': ['read_file', 'write_file']
 *     }
 *   }
 * };
 * ```
 */
export interface TrainingAgent {
  id: string;
  name: string;
  description?: string;
  content: string;
  metadata?: {
    tools?: string[];
    allowedTools?: string[];
    model?: string;
    mcpTools?: Record<string, string[]>;
  };
}

/**
 * Select the appropriate training agent for a skill
 *
 * @description
 * Selects and retrieves the training agent configuration to use for training a specific skill.
 * This function implements a three-tier selection strategy with well-defined priority rules,
 * ensuring that skill-specific overrides take precedence over global configurations, with a
 * safe fallback to local filesystem-based agents.
 *
 * **Selection Priority (Highest to Lowest):**
 * 1. **Skill-specific override**: If the skill has a `trainingAgent` relation in Strapi, use that agent
 * 2. **Global config setting**: If ConfigService has a `trainingAgentId` configured, use that agent
 * 3. **Local fallback**: Use the local `training-agent.md` file from `.claude/agents/` directory
 *
 * **Selection Criteria:**
 * - **Skill Override**: Provides maximum flexibility for skills with specialized training requirements
 *   - Checked first by fetching the skill from Strapi via strapiClient.getSkill()
 *   - Reads skill.trainingAgent relation (can be ID string or populated Agent object)
 *   - If found, fetches the full agent configuration from Strapi
 *
 * - **Global Config**: Enables project-wide consistency for training agent selection
 *   - Checked second by reading ConfigService.getInstance().getConfig().trainingAgentId
 *   - Allows setting a default training agent in application settings
 *   - Useful when most skills should use the same training configuration
 *
 * - **Local Fallback**: Ensures the system always has a training agent available
 *   - Checked last as a safety mechanism when no database configuration exists
 *   - Parses `.claude/agents/training-agent.md` using ClaudeStructureParser
 *   - Required for offline/local-first workflows or when Strapi is unavailable
 *
 * **Agent Transformation:**
 * When loading from Strapi, the function transforms the database schema to TrainingAgent format:
 * - Maps agent.systemPrompt → content
 * - Extracts agent.toolConfig.allowedTools → metadata.allowedTools
 * - Extracts agent.modelConfig.model → metadata.model
 * - Transforms agent.mcpConfig to Record<serverName, toolNames[]> → metadata.mcpTools
 *   - Handles both string IDs and populated relations for mcpServer and mcpTool
 *   - Groups selected tools by their parent MCP server name
 *
 * **Error Handling:**
 * - Gracefully handles failures when fetching from Strapi (logs warnings, continues to next tier)
 * - Throws Error if all three selection methods fail to find a valid training agent
 * - Error message guides users to configure an agent in Settings or create training-agent.md
 *
 * @param {string} skillId - The documentId of the skill being trained
 * @param {string} projectPath - Absolute path to the project directory where .claude/agents/ resides
 *
 * @returns {Promise<TrainingAgent>} The selected training agent configuration with all metadata
 *
 * @throws {Error} If no training agent can be found through any of the three selection methods.
 *   The error message instructs users to configure an agent in Settings or ensure
 *   training-agent.md exists in .claude/agents/
 *
 * @example
 * ```typescript
 * // Basic usage - select training agent for a skill
 * import { selectTrainingAgent } from './training-agent-selector';
 *
 * const agent = await selectTrainingAgent(
 *   'skill-abc123',
 *   '/path/to/project'
 * );
 *
 * console.log(`Using training agent: ${agent.name}`);
 * console.log(`System prompt length: ${agent.content.length}`);
 * console.log(`Allowed tools: ${agent.metadata?.allowedTools?.join(', ')}`);
 * ```
 *
 * @example
 * ```typescript
 * // With skill-specific override
 * // Assume skill 'advanced-skill' has trainingAgent set to 'expert-trainer' in Strapi
 * const agent = await selectTrainingAgent('advanced-skill', '/path/to/project');
 * // Returns the 'expert-trainer' agent (priority 1)
 *
 * // With global config
 * // Assume no skill override, but ConfigService has trainingAgentId = 'default-trainer'
 * const agent = await selectTrainingAgent('basic-skill', '/path/to/project');
 * // Returns the 'default-trainer' agent (priority 2)
 *
 * // With local fallback
 * // Assume no skill override and no global config
 * const agent = await selectTrainingAgent('local-skill', '/path/to/project');
 * // Returns agent parsed from .claude/agents/training-agent.md (priority 3)
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * import { selectTrainingAgent } from './training-agent-selector';
 *
 * try {
 *   const agent = await selectTrainingAgent('skill-123', '/path/to/project');
 *   // Use agent for training...
 * } catch (error) {
 *   console.error('Failed to select training agent:', error.message);
 *   // Prompt user to configure agent in Settings or create training-agent.md
 * }
 * ```
 */
export async function selectTrainingAgent(
  skillId: string,
  projectPath: string
): Promise<TrainingAgent> {
  logger.info('Selecting training agent', { skillId, projectPath });

  // Step 1: Check skill-specific override
  try {
    const skill = await strapiClient.getSkill(skillId);

    // trainingAgent is a Strapi relation - can be string (ID) or populated Agent
    const trainingAgentId = skill?.trainingAgent
      ? (typeof skill.trainingAgent === 'string' ? skill.trainingAgent : skill.trainingAgent.id)
      : null;

    if (trainingAgentId) {
      logger.info('Skill has training agent override', {
        skillId,
        trainingAgentId
      });

      const agent = await strapiClient.getAgent(trainingAgentId);

      if (agent) {
        logger.info('Using skill-specific training agent', {
          agentId: agent.id,
          agentName: agent.name
        });

        // Transform mcpConfig to Record<string, string[]> format
        const mcpTools: Record<string, string[]> = {};
        if (agent.mcpConfig) {
          agent.mcpConfig.forEach((config) => {
            const serverName = typeof config.mcpServer === 'string' ? config.mcpServer : config.mcpServer.name;
            if (config.selectedTools) {
              mcpTools[serverName] = config.selectedTools.map((toolSel) =>
                typeof toolSel.mcpTool === 'string' ? toolSel.mcpTool : toolSel.mcpTool.name
              );
            }
          });
        }

        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          content: agent.systemPrompt,
          metadata: {
            tools: agent.toolConfig?.allowedTools,
            allowedTools: agent.toolConfig?.allowedTools,
            model: agent.modelConfig?.model,
            mcpTools
          }
        };
      }

      logger.warn('Skill training agent not found in database', {
        trainingAgentId
      });
    }
  } catch (error) {
    logger.warn('Failed to fetch skill or skill training agent', {
      skillId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Step 2: Check global config
  try {
    const configService = ConfigService.getInstance();
    const config = configService.getConfig();

    if (config.trainingAgentId) {
      logger.info('Using global training agent from config', {
        trainingAgentId: config.trainingAgentId
      });

      const agent = await strapiClient.getAgent(config.trainingAgentId);

      if (agent) {
        logger.info('Global training agent found', {
          agentId: agent.id,
          agentName: agent.name
        });

        // Transform mcpConfig to Record<string, string[]> format
        const mcpTools: Record<string, string[]> = {};
        if (agent.mcpConfig) {
          agent.mcpConfig.forEach((config) => {
            const serverName = typeof config.mcpServer === 'string' ? config.mcpServer : config.mcpServer.name;
            if (config.selectedTools) {
              mcpTools[serverName] = config.selectedTools.map((toolSel) =>
                typeof toolSel.mcpTool === 'string' ? toolSel.mcpTool : toolSel.mcpTool.name
              );
            }
          });
        }

        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          content: agent.systemPrompt,
          metadata: {
            tools: agent.toolConfig?.allowedTools,
            allowedTools: agent.toolConfig?.allowedTools,
            model: agent.modelConfig?.model,
            mcpTools
          }
        };
      }

      logger.warn('Global training agent not found in database', {
        trainingAgentId: config.trainingAgentId
      });
    }
  } catch (error) {
    logger.warn('Failed to fetch global training agent from config', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Step 3: Fallback to local training-agent.md
  logger.info('Falling back to local training-agent.md');

  const parser = new ClaudeStructureParser();
  const agents = await parser.parseAgents(projectPath);
  const localAgent = agents.find(a => a.id === 'training-agent');

  if (!localAgent) {
    throw new Error(
      'No training agent found. Please configure one in Settings or ensure training-agent.md exists in .claude/agents/'
    );
  }

  logger.info('Using local training agent fallback', {
    agentId: localAgent.id,
    agentName: localAgent.name
  });

  return {
    id: localAgent.id,
    name: localAgent.name,
    description: localAgent.description,
    content: localAgent.content,
    metadata: localAgent.metadata
  };
}
