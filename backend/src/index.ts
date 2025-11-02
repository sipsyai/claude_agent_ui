export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Auto-configure permissions for mcp-tool content type
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    });

    if (publicRole) {
      const permissions = await strapi.query('plugin::users-permissions.permission').findMany({
        where: {
          role: publicRole.id,
        },
      });

      const mcpToolPermissions = permissions.filter(p => p.action?.startsWith('api::mcp-tool.'));

      // Enable all mcp-tool permissions for public role
      for (const permission of mcpToolPermissions) {
        await strapi.query('plugin::users-permissions.permission').update({
          where: { id: permission.id },
          data: { enabled: true },
        });
      }

      console.log('[Bootstrap] MCP Tool permissions enabled for public role');
    }
  },
};
