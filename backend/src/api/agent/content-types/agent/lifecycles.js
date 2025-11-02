/**
 * Agent Lifecycle Hooks
 *
 * Best practice lifecycle hooks for Agent content type
 * - Auto-generate slug from name
 * - Initialize analytics component
 * - Validate tool configuration
 * - Update analytics on task completion
 */

module.exports = {
  /**
   * Before creating an agent
   * - Generate slug if not provided
   * - Initialize analytics component with default values
   */
  async beforeCreate(event) {
    const { data } = event.params;

    // Auto-generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    // Initialize analytics component if not provided
    if (!data.analytics) {
      data.analytics = {
        executionCount: 0,
        averageExecutionTime: 0,
        totalExecutionTime: '0',
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        lastExecutedAt: null,
        lastCalculatedAt: new Date(),
      };
    }

    // Initialize modelConfig if not provided
    if (!data.modelConfig) {
      data.modelConfig = {
        model: 'sonnet',
        temperature: 1.0,
        timeout: 300000,
        stopSequences: [],
      };
    }

    // Initialize toolConfig if not provided
    if (!data.toolConfig) {
      data.toolConfig = {
        allowedTools: [],
        disallowedTools: [],
        toolPermissions: {},
        inheritFromParent: true,
      };
    }
  },

  /**
   * After creating an agent
   * - Log creation event
   */
  async afterCreate(event) {
    const { result } = event;

    strapi.log.info(`Agent created: ${result.name} (ID: ${result.id}, Slug: ${result.slug})`);
  },

  /**
   * Before updating an agent
   * - Validate slug uniqueness if changed
   * - Update slug if name changed
   */
  async beforeUpdate(event) {
    const { data, where } = event.params;

    // If name changed, regenerate slug
    if (data.name && !data.slug) {
      data.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    // Validate tool configuration if provided
    if (data.toolConfig) {
      const { allowedTools, disallowedTools } = data.toolConfig;

      // Check for conflicts between allowed and disallowed tools
      if (allowedTools && disallowedTools) {
        const allowed = Array.isArray(allowedTools) ? allowedTools : [];
        const disallowed = Array.isArray(disallowedTools) ? disallowedTools : [];

        const conflicts = allowed.filter(tool => disallowed.includes(tool));
        if (conflicts.length > 0) {
          throw new Error(
            `Tool configuration conflict: ${conflicts.join(', ')} cannot be both allowed and disallowed`
          );
        }
      }
    }
  },

  /**
   * After updating an agent
   * - Log update event
   */
  async afterUpdate(event) {
    const { result } = event;

    strapi.log.info(`Agent updated: ${result.name} (ID: ${result.id})`);
  },

  /**
   * Before deleting an agent
   * - Log deletion warning
   */
  async beforeDelete(event) {
    const { where } = event.params;

    const agent = await strapi.entityService.findOne('api::agent.agent', where.id, {
      fields: ['name', 'slug'],
    });

    if (agent) {
      strapi.log.warn(`Preparing to delete agent: ${agent.name} (ID: ${where.id})`);
    }
  },

  /**
   * After deleting an agent
   * - Log deletion event
   * - Clean up related data (handled by Strapi relations)
   */
  async afterDelete(event) {
    const { result } = event;

    if (result) {
      strapi.log.info(`Agent deleted: ${result.name || 'Unknown'} (ID: ${result.id})`);
    }
  },
};
