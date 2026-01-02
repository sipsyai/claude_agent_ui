/**
 * flow service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::flow.flow', ({ strapi }) => ({
  /**
   * Find flow with all relations populated
   */
  async findWithFullRelations(id: number) {
    return await strapi.entityService.findOne('api::flow.flow', id, {
      populate: '*',
    });
  },

  /**
   * Find flow by slug
   */
  async findBySlug(slug: string) {
    const flows = await strapi.entityService.findMany('api::flow.flow', {
      filters: {
        slug: { $eq: slug },
      },
    });

    return flows[0] || null;
  },

  /**
   * Get active flows only
   */
  async findActive(filters = {}) {
    return await strapi.entityService.findMany('api::flow.flow', {
      filters: {
        isActive: true,
        status: 'active',
        ...filters,
      },
    });
  },

  /**
   * Update flow status
   */
  async updateStatus(id: number, status: string) {
    return await strapi.entityService.update('api::flow.flow', id, {
      data: { status },
    });
  },

  /**
   * Toggle flow active state
   */
  async toggleActive(id: number) {
    const flow: any = await strapi.entityService.findOne('api::flow.flow', id);

    if (!flow) {
      throw new Error(`Flow with ID ${id} not found`);
    }

    return await strapi.entityService.update('api::flow.flow', id, {
      data: { isActive: !flow.isActive },
    });
  },

  /**
   * Validate flow nodes structure
   */
  validateNodes(nodes: any[]) {
    if (!Array.isArray(nodes)) {
      return { valid: false, error: 'Nodes must be an array' };
    }

    for (const node of nodes) {
      if (!node.id || !node.type) {
        return { valid: false, error: 'Each node must have an id and type' };
      }

      const validTypes = ['input', 'agent', 'output', 'condition', 'transform'];
      if (!validTypes.includes(node.type)) {
        return {
          valid: false,
          error: `Invalid node type: ${node.type}. Must be one of: ${validTypes.join(', ')}`
        };
      }
    }

    return { valid: true };
  },
}));
