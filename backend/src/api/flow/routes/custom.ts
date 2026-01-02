/**
 * Custom flow routes for extended functionality
 *
 * These routes extend the default Strapi CRUD routes with
 * custom operations for managing flows.
 */

export default {
  routes: [
    // Find by slug
    {
      method: 'GET',
      path: '/flows/by-slug/:slug',
      handler: 'flow.findBySlug',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get active flows
    {
      method: 'GET',
      path: '/flows/active',
      handler: 'flow.findActive',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get recent flows
    {
      method: 'GET',
      path: '/flows/recent',
      handler: 'flow.findRecent',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get flows by category
    {
      method: 'GET',
      path: '/flows/category/:category',
      handler: 'flow.findByCategory',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get flow with details and stats
    {
      method: 'GET',
      path: '/flows/:id/details',
      handler: 'flow.findDetails',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Toggle active state
    {
      method: 'POST',
      path: '/flows/:id/toggle-active',
      handler: 'flow.toggleActive',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Update status
    {
      method: 'PUT',
      path: '/flows/:id/status',
      handler: 'flow.updateStatus',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Duplicate flow
    {
      method: 'POST',
      path: '/flows/:id/duplicate',
      handler: 'flow.duplicate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Validate flow nodes
    {
      method: 'POST',
      path: '/flows/:id/validate',
      handler: 'flow.validate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Activate flow
    {
      method: 'POST',
      path: '/flows/:id/activate',
      handler: 'flow.activate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Deactivate flow
    {
      method: 'POST',
      path: '/flows/:id/deactivate',
      handler: 'flow.deactivate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Archive flow
    {
      method: 'POST',
      path: '/flows/:id/archive',
      handler: 'flow.archive',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },

    // Get recent executions
    {
      method: 'GET',
      path: '/flows/executions/recent',
      handler: 'flow.findRecentExecutions',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
