/**
 * Custom skill routes for export and import functionality
 */

export default {
  routes: [
    // Export routes
    {
      method: 'GET',
      path: '/skills/:id/export',
      handler: 'skill.export',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/skills/:id/download',
      handler: 'skill.download',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/skills/:id/download-archive',
      handler: 'skill.downloadArchive',
      config: {
        policies: [],
        middlewares: []
      }
    },
    // Import routes
    {
      method: 'POST',
      path: '/skills/import',
      handler: 'skill.import',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/skills/import-file',
      handler: 'skill.importFile',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/skills/import-directory',
      handler: 'skill.importDirectory',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
