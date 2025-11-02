/**
 * Agent MCP Migration Controller
 *
 * Migrates MCP Server relations to embedded mcpConfig component
 *
 * Usage:
 * POST http://localhost:1337/api/agents/migrate-mcp
 */

export default {
  async migrateMcp(ctx) {
    try {
      // Get all agents with MCP server relations
      const agents: any = await strapi.entityService.findMany('api::agent.agent', {
        populate: {
          mcpServers: {
            populate: {
              mcpTools: true,
            },
          },
          mcpConfig: true,
        },
      });

      if (!agents || agents.length === 0) {
        return ctx.send({
          success: true,
          message: 'No agents to migrate',
          migrated: 0,
        });
      }

      const results = {
        total: agents.length,
        migrated: 0,
        skipped: 0,
        errors: [],
      };

      for (const agent of agents) {
        try {
          // Skip if already has mcpConfig
          if (agent.mcpConfig && agent.mcpConfig.length > 0) {
            results.skipped++;
            continue;
          }

          // Skip if no MCP servers
          if (!agent.mcpServers || agent.mcpServers.length === 0) {
            results.skipped++;
            continue;
          }

          // Convert MCP server relations to mcpConfig components
          const mcpConfig = agent.mcpServers.map((server: any) => {
            // Convert tools to tool configs
            const tools = (server.mcpTools || []).map((tool: any) => ({
              name: tool.name,
              description: tool.description || '',
              inputSchema: tool.inputSchema || {},
              enabled: true,
              permissions: {},
            }));

            return {
              name: server.name,
              description: server.description || '',
              command: server.command,
              args: server.args || [],
              env: server.env || {},
              disabled: server.disabled || false,
              transport: server.transport || 'stdio',
              healthCheckUrl: server.healthCheckUrl || '',
              startupTimeout: server.startupTimeout || 30000,
              restartPolicy: server.restartPolicy || 'on-failure',
              tools,
              metadata: {
                isHealthy: server.isHealthy,
                lastHealthCheck: server.lastHealthCheck,
                toolsFetchedAt: server.toolsFetchedAt,
              },
            };
          });

          // Update agent with mcpConfig
          await strapi.entityService.update('api::agent.agent', agent.id, {
            data: {
              mcpConfig,
            },
          });

          results.migrated++;
        } catch (error: any) {
          results.errors.push({
            agent: agent.name || agent.id,
            error: error.message,
          });
        }
      }

      return ctx.send({
        success: true,
        message: 'MCP migration completed',
        results,
      });
    } catch (error: any) {
      strapi.log.error('MCP migration failed:', error);
      return ctx.badRequest('MCP migration failed', { error: error.message });
    }
  },
};
