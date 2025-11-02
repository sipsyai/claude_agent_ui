/**
 * Custom agent routes
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/agents/migrate',
      handler: 'migrate.migrate',
      config: {
        auth: false, // Public endpoint for migration
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/agents/migrate-mcp',
      handler: 'migrate-mcp.migrateMcp',
      config: {
        auth: false, // Public endpoint for migration
        policies: [],
        middlewares: [],
      },
    },
  ],
};
