/**
 * Skill MCP Migration Controller
 *
 * Migrates MCP Server relations to embedded mcpConfig component
 *
 * Usage:
 * POST http://localhost:1337/api/skills/migrate-mcp
 */

export default {
  async migrateMcp(ctx) {
    try {
      // Get all skills with MCP server relations
      const skills: any = await strapi.entityService.findMany('api::skill.skill', {
        populate: {
          mcpServers: {
            populate: {
              mcpTools: true,
            },
          },
          mcpTools: true,
          mcpConfig: true,
        },
      });

      if (!skills || skills.length === 0) {
        return ctx.send({
          success: true,
          message: 'No skills to migrate',
          migrated: 0,
        });
      }

      const results = {
        total: skills.length,
        migrated: 0,
        skipped: 0,
        errors: [],
      };

      for (const skill of skills) {
        try {
          // Skip if already has mcpConfig
          if (skill.mcpConfig && skill.mcpConfig.length > 0) {
            results.skipped++;
            continue;
          }

          // Skip if no MCP servers
          if (!skill.mcpServers || skill.mcpServers.length === 0) {
            results.skipped++;
            continue;
          }

          // Convert MCP server relations to mcpConfig components
          const mcpConfig = skill.mcpServers.map((server: any) => {
            // Get all tools from server
            let tools = (server.mcpTools || []).map((tool: any) => ({
              name: tool.name,
              description: tool.description || '',
              inputSchema: tool.inputSchema || {},
              enabled: true,
              permissions: {},
            }));

            // Also include tools from skill.mcpTools that belong to this server
            if (skill.mcpTools && skill.mcpTools.length > 0) {
              const serverTools = skill.mcpTools
                .filter((tool: any) => tool.mcpServer?.id === server.id)
                .map((tool: any) => ({
                  name: tool.name,
                  description: tool.description || '',
                  inputSchema: tool.inputSchema || {},
                  enabled: true,
                  permissions: {},
                }));

              // Merge unique tools
              const toolNames = new Set(tools.map(t => t.name));
              serverTools.forEach(tool => {
                if (!toolNames.has(tool.name)) {
                  tools.push(tool);
                }
              });
            }

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

          // Update skill with mcpConfig
          await strapi.entityService.update('api::skill.skill', skill.id, {
            data: {
              mcpConfig,
            },
          });

          results.migrated++;
        } catch (error: any) {
          results.errors.push({
            skill: skill.name || skill.id,
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
