/**
 * Custom flow-execution routes for extended functionality
 *
 * These routes extend the default Strapi CRUD routes with
 * custom operations for managing flow execution history,
 * lifecycle operations, and monitoring.
 */

export default {
  routes: [
    // Get running executions
    {
      method: 'GET',
      path: '/flow-executions/running',
      handler: 'flow-execution.findRunning',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get recent executions
    {
      method: 'GET',
      path: '/flow-executions/recent',
      handler: 'flow-execution.findRecent',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get global execution statistics
    {
      method: 'GET',
      path: '/flow-executions/stats',
      handler: 'flow-execution.getGlobalStats',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get executions by status
    {
      method: 'GET',
      path: '/flow-executions/status/:status',
      handler: 'flow-execution.findByStatus',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get executions for a specific flow
    {
      method: 'GET',
      path: '/flow-executions/flow/:flowId',
      handler: 'flow-execution.findByFlowId',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get execution statistics for a flow
    {
      method: 'GET',
      path: '/flow-executions/stats/:flowId',
      handler: 'flow-execution.getStats',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get execution with full details
    {
      method: 'GET',
      path: '/flow-executions/:id/details',
      handler: 'flow-execution.findDetails',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get execution logs
    {
      method: 'GET',
      path: '/flow-executions/:id/logs',
      handler: 'flow-execution.getLogs',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Start a new flow execution
    {
      method: 'POST',
      path: '/flow-executions/start',
      handler: 'flow-execution.start',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Add a log entry to an execution
    {
      method: 'POST',
      path: '/flow-executions/:id/log',
      handler: 'flow-execution.addLog',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Update node execution state
    {
      method: 'PUT',
      path: '/flow-executions/:id/node/:nodeId',
      handler: 'flow-execution.updateNode',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Complete an execution
    {
      method: 'POST',
      path: '/flow-executions/:id/complete',
      handler: 'flow-execution.complete',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Fail an execution
    {
      method: 'POST',
      path: '/flow-executions/:id/fail',
      handler: 'flow-execution.fail',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Cancel a running execution
    {
      method: 'POST',
      path: '/flow-executions/:id/cancel',
      handler: 'flow-execution.cancel',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Retry a failed execution
    {
      method: 'POST',
      path: '/flow-executions/:id/retry',
      handler: 'flow-execution.retry',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Clean up old executions
    {
      method: 'DELETE',
      path: '/flow-executions/cleanup',
      handler: 'flow-execution.cleanup',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
