/**
 * Health check routes
 * Provides endpoints for monitoring database connectivity and service health
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/_health',
      handler: 'health.index',
      config: {
        auth: false, // Public endpoint for health checks
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/_health/ready',
      handler: 'health.ready',
      config: {
        auth: false, // Public endpoint for readiness checks
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/_health/live',
      handler: 'health.live',
      config: {
        auth: false, // Public endpoint for liveness checks
        policies: [],
        middlewares: [],
      },
    },
  ],
};
