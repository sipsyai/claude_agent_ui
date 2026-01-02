/**
 * Flow controller
 *
 * Enhanced controller for Flow CRUD operations with custom routes
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::flow.flow', ({ strapi }) => ({
  /**
   * Find flow by slug
   * GET /api/flows/by-slug/:slug
   */
  async findBySlug(ctx) {
    const { slug } = ctx.params;

    try {
      const flowService = strapi.service('api::flow.flow');
      const flow = await flowService.findBySlug(slug);

      if (!flow) {
        return ctx.notFound('Flow not found');
      }

      ctx.send({
        data: flow,
      });
    } catch (error: any) {
      strapi.log.error('Find by slug failed:', error);
      return ctx.badRequest('Find by slug failed', { error: error.message });
    }
  },

  /**
   * Get all active flows
   * GET /api/flows/active
   */
  async findActive(ctx) {
    try {
      const flowService = strapi.service('api::flow.flow');
      const flows = await flowService.findActive();

      ctx.send({
        data: flows,
      });
    } catch (error: any) {
      strapi.log.error('Find active flows failed:', error);
      return ctx.badRequest('Find active flows failed', { error: error.message });
    }
  },

  /**
   * Toggle flow active state
   * POST /api/flows/:id/toggle-active
   */
  async toggleActive(ctx) {
    const { id } = ctx.params;

    try {
      const flowService = strapi.service('api::flow.flow');
      const flow = await flowService.toggleActive(parseInt(id));

      ctx.send({
        data: flow,
        message: `Flow is now ${flow.isActive ? 'active' : 'inactive'}`,
      });
    } catch (error: any) {
      strapi.log.error('Toggle active failed:', error);
      return ctx.badRequest('Toggle active failed', { error: error.message });
    }
  },

  /**
   * Update flow status
   * PUT /api/flows/:id/status
   * Body: { status: "draft" | "active" | "paused" | "archived" }
   */
  async updateStatus(ctx) {
    const { id } = ctx.params;
    const { status } = ctx.request.body;

    if (!status) {
      return ctx.badRequest('Missing "status" in request body');
    }

    const validStatuses = ['draft', 'active', 'paused', 'archived'];
    if (!validStatuses.includes(status)) {
      return ctx.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const flowService = strapi.service('api::flow.flow');
      const flow = await flowService.updateStatus(parseInt(id), status);

      ctx.send({
        data: flow,
        message: `Flow status updated to "${status}"`,
      });
    } catch (error: any) {
      strapi.log.error('Update status failed:', error);
      return ctx.badRequest('Update status failed', { error: error.message });
    }
  },

  /**
   * Duplicate a flow
   * POST /api/flows/:id/duplicate
   * Body: { name?: string }
   */
  async duplicate(ctx) {
    const { id } = ctx.params;
    const { name } = ctx.request.body || {};

    try {
      const flowService = strapi.service('api::flow.flow');
      const duplicatedFlow = await flowService.duplicateFlow(parseInt(id), name);

      ctx.send({
        data: duplicatedFlow,
        message: 'Flow duplicated successfully',
      });
    } catch (error: any) {
      strapi.log.error('Duplicate flow failed:', error);
      return ctx.badRequest('Duplicate flow failed', { error: error.message });
    }
  },

  /**
   * Validate flow nodes
   * POST /api/flows/:id/validate
   */
  async validate(ctx) {
    const { id } = ctx.params;

    try {
      const flow: any = await strapi.entityService.findOne('api::flow.flow', parseInt(id));

      if (!flow) {
        return ctx.notFound('Flow not found');
      }

      const flowService = strapi.service('api::flow.flow');
      const validation = flowService.validateNodes(flow.nodes || []);

      ctx.send({
        valid: validation.valid,
        error: validation.error,
        nodeCount: (flow.nodes || []).length,
      });
    } catch (error: any) {
      strapi.log.error('Validate flow failed:', error);
      return ctx.badRequest('Validate flow failed', { error: error.message });
    }
  },

  /**
   * Get flow with full relations and execution stats
   * GET /api/flows/:id/details
   */
  async findDetails(ctx) {
    const { id } = ctx.params;

    try {
      const flowService = strapi.service('api::flow.flow');
      const executionService = strapi.service('api::flow-execution.flow-execution');

      const flow = await flowService.findWithFullRelations(parseInt(id));

      if (!flow) {
        return ctx.notFound('Flow not found');
      }

      // Get execution statistics
      let stats = null;
      try {
        stats = await executionService.getFlowStats(parseInt(id));
      } catch (e) {
        // Stats might fail if no executions yet
      }

      ctx.send({
        data: {
          ...flow,
          stats,
        },
      });
    } catch (error: any) {
      strapi.log.error('Find flow details failed:', error);
      return ctx.badRequest('Find flow details failed', { error: error.message });
    }
  },

  /**
   * Get flows by category
   * GET /api/flows/category/:category
   */
  async findByCategory(ctx) {
    const { category } = ctx.params;

    try {
      const flows = await strapi.entityService.findMany('api::flow.flow', {
        filters: {
          category: { $eq: category },
        },
        sort: { name: 'asc' },
      });

      ctx.send({
        data: flows,
      });
    } catch (error: any) {
      strapi.log.error('Find by category failed:', error);
      return ctx.badRequest('Find by category failed', { error: error.message });
    }
  },

  /**
   * Get recent flows
   * GET /api/flows/recent
   */
  async findRecent(ctx) {
    const limit = parseInt(ctx.query.limit as string) || 10;

    try {
      const flows = await strapi.entityService.findMany('api::flow.flow', {
        sort: { updatedAt: 'desc' },
        limit,
      });

      ctx.send({
        data: flows,
      });
    } catch (error: any) {
      strapi.log.error('Find recent flows failed:', error);
      return ctx.badRequest('Find recent flows failed', { error: error.message });
    }
  },

  /**
   * Activate a flow (set status to active and isActive to true)
   * POST /api/flows/:id/activate
   */
  async activate(ctx) {
    const { id } = ctx.params;

    try {
      const flow = await strapi.entityService.update('api::flow.flow', parseInt(id), {
        data: {
          status: 'active',
          isActive: true,
        },
      });

      ctx.send({
        data: flow,
        message: 'Flow activated successfully',
      });
    } catch (error: any) {
      strapi.log.error('Activate flow failed:', error);
      return ctx.badRequest('Activate flow failed', { error: error.message });
    }
  },

  /**
   * Deactivate a flow (set status to paused and isActive to false)
   * POST /api/flows/:id/deactivate
   */
  async deactivate(ctx) {
    const { id } = ctx.params;

    try {
      const flow = await strapi.entityService.update('api::flow.flow', parseInt(id), {
        data: {
          status: 'paused',
          isActive: false,
        },
      });

      ctx.send({
        data: flow,
        message: 'Flow deactivated successfully',
      });
    } catch (error: any) {
      strapi.log.error('Deactivate flow failed:', error);
      return ctx.badRequest('Deactivate flow failed', { error: error.message });
    }
  },

  /**
   * Archive a flow
   * POST /api/flows/:id/archive
   */
  async archive(ctx) {
    const { id } = ctx.params;

    try {
      const flow = await strapi.entityService.update('api::flow.flow', parseInt(id), {
        data: {
          status: 'archived',
          isActive: false,
        },
      });

      ctx.send({
        data: flow,
        message: 'Flow archived successfully',
      });
    } catch (error: any) {
      strapi.log.error('Archive flow failed:', error);
      return ctx.badRequest('Archive flow failed', { error: error.message });
    }
  },
}));
