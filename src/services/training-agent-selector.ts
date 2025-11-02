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
 * Priority:
 * 1. Skill's trainingAgentId (override)
 * 2. Global config trainingAgentId
 * 3. Local training-agent.md (fallback)
 *
 * @param skillId - Skill ID to train
 * @param projectPath - Project directory path
 * @returns Training agent to use
 * @throws Error if no training agent is found
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
