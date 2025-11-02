/**
 * agent service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::agent.agent', ({ strapi }) => ({
  /**
   * Find agent with all relations populated
   * Best practice: Optimize populate to avoid over-fetching
   */
  async findWithFullRelations(id: number) {
    return await strapi.entityService.findOne('api::agent.agent', id, {
      populate: {
        toolConfig: true,
        modelConfig: true,
        analytics: true,
        metadata: true,
        mcpConfig: {
          populate: {
            mcpServer: true,
            selectedTools: {
              populate: {
                mcpTool: true,
              },
            },
          },
        },
        skills: {
          populate: {
            mcpConfig: {
              populate: {
                mcpServer: true,
                selectedTools: {
                  populate: {
                    mcpTool: true,
                  },
                },
              },
            },
          },
        },
        tasks: {
          populate: {
            task: true,
          },
        },
      },
    });
  },

  /**
   * Calculate and update analytics from tasks
   * Best practice: Aggregate data from relations instead of storing duplicates
   */
  async calculateAnalytics(agentId: number) {
    // Get all tasks and filter by agent component
    // Note: Component filtering is limited in Strapi, so we fetch and filter manually
    const allTasks = await strapi.entityService.findMany('api::task.task', {
      fields: ['status', 'executionTime', 'completedAt'],
      populate: {
        agents: {
          populate: {
            agent: {
              fields: ['id'],
            },
          },
        },
      } as any, // Type assertion needed until types are regenerated
    });

    // Filter tasks that have this agent in their agents component
    const tasks = allTasks.filter((task: any) =>
      task.agents?.some((agentComp: any) => agentComp.agent?.id === agentId)
    );

    // Calculate metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    const failedTasks = tasks.filter((t: any) => t.status === 'failed');
    const successCount = completedTasks.length;
    const failureCount = failedTasks.length;
    const successRate = totalTasks > 0 ? (successCount / totalTasks) * 100 : 0;

    // Calculate execution times
    const executedTasks = tasks.filter((t: any) => t.executionTime !== null && t.executionTime !== undefined);
    const totalExecutionTime = executedTasks.reduce((sum: number, t: any) => sum + (t.executionTime || 0), 0);
    const averageExecutionTime = executedTasks.length > 0 ? Math.round(totalExecutionTime / executedTasks.length) : 0;

    // Find last execution
    const lastExecutedTask = tasks
      .filter((t: any) => t.completedAt)
      .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];

    const lastExecutedAt = lastExecutedTask ? lastExecutedTask.completedAt : null;

    // Update agent analytics
    const agent = await strapi.entityService.findOne('api::agent.agent', agentId, {
      populate: ['analytics'],
    });

    const updatedAgent = await strapi.entityService.update('api::agent.agent', agentId, {
      data: {
        analytics: {
          executionCount: totalTasks,
          successCount,
          failureCount,
          successRate: parseFloat(successRate.toFixed(2)),
          totalExecutionTime: totalExecutionTime.toString(),
          averageExecutionTime,
          lastExecutedAt,
          lastCalculatedAt: new Date(),
        },
      },
    });

    return updatedAgent;
  },

  /**
   * Increment execution count
   * Best practice: Atomic increment to avoid race conditions
   */
  async incrementExecutionCount(agentId: number) {
    const agent: any = await strapi.entityService.findOne('api::agent.agent', agentId, {
      populate: ['analytics'],
    });

    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    const currentCount = agent.analytics?.executionCount || 0;

    return await strapi.entityService.update('api::agent.agent', agentId, {
      data: {
        analytics: {
          ...agent.analytics,
          executionCount: currentCount + 1,
        },
      },
    });
  },

  /**
   * Update last executed timestamp
   * Best practice: Track activity for analytics
   */
  async updateLastExecuted(agentId: number) {
    const agent: any = await strapi.entityService.findOne('api::agent.agent', agentId, {
      populate: ['analytics'],
    });

    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    return await strapi.entityService.update('api::agent.agent', agentId, {
      data: {
        analytics: {
          ...agent.analytics,
          lastExecutedAt: new Date(),
        },
      },
    });
  },

  /**
   * Validate tool configuration
   * Best practice: Centralized validation logic
   */
  validateToolConfig(toolConfig: any) {
    if (!toolConfig) {
      return { valid: true };
    }

    const { allowedTools, disallowedTools } = toolConfig;

    // Validate array types
    if (allowedTools && !Array.isArray(allowedTools)) {
      return {
        valid: false,
        error: 'allowedTools must be an array',
      };
    }

    if (disallowedTools && !Array.isArray(disallowedTools)) {
      return {
        valid: false,
        error: 'disallowedTools must be an array',
      };
    }

    // Check for conflicts
    if (allowedTools && disallowedTools) {
      const conflicts = allowedTools.filter((tool: string) => disallowedTools.includes(tool));
      if (conflicts.length > 0) {
        return {
          valid: false,
          error: `Tools cannot be both allowed and disallowed: ${conflicts.join(', ')}`,
        };
      }
    }

    return { valid: true };
  },

  /**
   * Find agents by slug
   * Best practice: Use slug for SEO-friendly URLs
   */
  async findBySlug(slug: string) {
    const agents = await strapi.entityService.findMany('api::agent.agent', {
      filters: {
        slug: { $eq: slug },
      },
      populate: {
        toolConfig: true,
        modelConfig: true,
        analytics: true,
        metadata: true,
      },
    });

    return agents[0] || null;
  },

  /**
   * Get enabled agents only
   * Best practice: Filter active resources
   */
  async findEnabled(filters = {}) {
    return await strapi.entityService.findMany('api::agent.agent', {
      filters: {
        enabled: true,
        ...filters,
      },
      populate: {
        modelConfig: true,
        analytics: true,
      },
    });
  },
}));
