/**
 * Agent Migration Controller
 *
 * Endpoint to migrate existing agent data to new component-based schema
 *
 * Usage:
 * POST http://localhost:1337/api/agents/migrate
 *
 * IMPORTANT: This should be run once after deploying new schema
 */

export default {
  async migrate(ctx) {
    try {
      const db = strapi.db.connection;

      // Get all agents with raw query to access old structure
      const oldAgents = await db('agents').select('*');

      if (!oldAgents || oldAgents.length === 0) {
        return ctx.send({
          success: true,
          message: 'No agents to migrate',
          migrated: 0,
        });
      }

      const results = {
        total: oldAgents.length,
        migrated: 0,
        skipped: 0,
        errors: [],
      };

      for (const oldAgent of oldAgents) {
        try {
          // Check if already migrated (has slug)
          if (oldAgent.slug) {
            results.skipped++;
            continue;
          }

          // Generate slug
          const slug = oldAgent.name
            ?.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim() || `agent-${oldAgent.id}`;

          // Convert old metadata JSON to array
          let metadataArray: any[] = [];
          if (oldAgent.metadata && typeof oldAgent.metadata === 'string') {
            try {
              const parsed = JSON.parse(oldAgent.metadata);
              metadataArray = Object.entries(parsed).map(([key, value]: any) => ({
                key,
                value: String(value),
                type: typeof value === 'number' ? 'number' : 'string',
              }));
            } catch (e) {
              // Skip if metadata parsing fails
            }
          }

          // Update with entity service
          await strapi.entityService.update('api::agent.agent', oldAgent.id, {
            data: {
              slug,
              toolConfig: {
                allowedTools: oldAgent.tools || [],
                disallowedTools: oldAgent.disallowed_tools || [],
                toolPermissions: {},
                inheritFromParent: true,
              },
              modelConfig: {
                model: oldAgent.model || 'sonnet',
                temperature: 1.0,
                timeout: 300000,
                stopSequences: [],
              },
              analytics: {
                executionCount: oldAgent.execution_count || 0,
                lastExecutedAt: oldAgent.last_executed_at || null,
                averageExecutionTime: parseInt(oldAgent.average_execution_time || 0),
                totalExecutionTime: '0',
                successCount: 0,
                failureCount: 0,
                successRate: 0,
                lastCalculatedAt: new Date(),
              },
              metadata: metadataArray,
            },
          });

          results.migrated++;
        } catch (error: any) {
          results.errors.push({
            agent: oldAgent.name || oldAgent.id,
            error: error.message,
          });
        }
      }

      return ctx.send({
        success: true,
        message: 'Migration completed',
        results,
      });
    } catch (error: any) {
      strapi.log.error('Migration failed:', error);
      return ctx.badRequest('Migration failed', { error: error.message });
    }
  },
};
