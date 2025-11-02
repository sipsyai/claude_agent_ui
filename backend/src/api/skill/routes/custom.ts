/**
 * Custom skill routes
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/skills/migrate-mcp',
      handler: 'migrate-mcp.migrateMcp',
      config: {
        auth: false, // Public endpoint for migration
        policies: [],
        middlewares: [],
      },
    },
  ],
};
