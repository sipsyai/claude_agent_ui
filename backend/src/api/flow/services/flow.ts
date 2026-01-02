/**
 * Flow service
 *
 * Service layer for Flow operations with helper methods for
 * common operations and business logic.
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
      sort: { name: 'asc' },
    });
  },

  /**
   * Update flow status
   */
  async updateStatus(id: number, status: 'draft' | 'active' | 'paused' | 'archived') {
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

    if (nodes.length === 0) {
      return { valid: true, warning: 'Flow has no nodes defined' };
    }

    const nodeIds = new Set<string>();
    const errors: string[] = [];

    for (const node of nodes) {
      // Check required fields
      if (!node.id || !node.type) {
        errors.push('Each node must have an id and type');
        continue;
      }

      // Check for duplicate IDs
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);

      // Validate node type
      const validTypes = ['input', 'agent', 'output', 'condition', 'transform'];
      if (!validTypes.includes(node.type)) {
        errors.push(
          `Invalid node type: ${node.type}. Must be one of: ${validTypes.join(', ')}`
        );
      }

      // Type-specific validation
      switch (node.type) {
        case 'input':
          if (!node.config?.inputFields || !Array.isArray(node.config.inputFields)) {
            errors.push(`Input node ${node.id} should have inputFields array`);
          }
          break;
        case 'agent':
          if (!node.config?.agentId) {
            errors.push(`Agent node ${node.id} must reference an agent`);
          }
          break;
        case 'output':
          if (!node.config?.outputType) {
            errors.push(`Output node ${node.id} should specify outputType`);
          }
          break;
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Validate flow structure
    const hasInput = nodes.some((n) => n.type === 'input');
    const hasOutput = nodes.some((n) => n.type === 'output');

    const warnings: string[] = [];
    if (!hasInput) {
      warnings.push('Flow should have at least one input node');
    }
    if (!hasOutput) {
      warnings.push('Flow should have at least one output node');
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  /**
   * Duplicate a flow with a new name
   */
  async duplicateFlow(id: number, newName?: string) {
    const originalFlow: any = await strapi.entityService.findOne('api::flow.flow', id);

    if (!originalFlow) {
      throw new Error(`Flow with ID ${id} not found`);
    }

    // Generate new name and slug
    const timestamp = Date.now();
    const name = newName || `${originalFlow.name} (Copy)`;
    const slug = this.generateSlug(name, timestamp);

    // Create duplicate with reset fields
    const duplicateData = {
      name,
      slug,
      description: originalFlow.description,
      nodes: originalFlow.nodes || [],
      status: 'draft' as const,
      inputSchema: originalFlow.inputSchema || {},
      outputSchema: originalFlow.outputSchema || {},
      isActive: false,
      version: '1.0.0',
      category: originalFlow.category,
      metadata: {
        ...(originalFlow.metadata || {}),
        duplicatedFrom: id,
        duplicatedAt: new Date().toISOString(),
      },
    };

    return await strapi.entityService.create('api::flow.flow', {
      data: duplicateData,
    });
  },

  /**
   * Generate a unique slug from a name
   */
  generateSlug(name: string, uniqueSuffix?: number): string {
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    if (uniqueSuffix) {
      slug = `${slug}-${uniqueSuffix}`;
    }

    return slug;
  },

  /**
   * Get flow summary for listing
   */
  async getFlowSummaries() {
    const flows = await strapi.entityService.findMany('api::flow.flow', {
      sort: { updatedAt: 'desc' },
    }) as any[];

    return flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      slug: flow.slug,
      description: flow.description,
      status: flow.status,
      isActive: flow.isActive,
      category: flow.category,
      version: flow.version,
      nodeCount: (flow.nodes || []).length,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    }));
  },

  /**
   * Update flow version
   */
  async bumpVersion(id: number, versionType: 'major' | 'minor' | 'patch' = 'patch') {
    const flow: any = await strapi.entityService.findOne('api::flow.flow', id);

    if (!flow) {
      throw new Error(`Flow with ID ${id} not found`);
    }

    const currentVersion = flow.version || '1.0.0';
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    let newVersion: string;
    switch (versionType) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }

    return await strapi.entityService.update('api::flow.flow', id, {
      data: { version: newVersion },
    });
  },

  /**
   * Search flows by name or description
   */
  async search(query: string) {
    return await strapi.entityService.findMany('api::flow.flow', {
      filters: {
        $or: [
          { name: { $containsi: query } },
          { description: { $containsi: query } },
        ],
      },
      sort: { name: 'asc' },
    });
  },

  /**
   * Get flows that can be executed (active and has nodes)
   */
  async getExecutableFlows() {
    const flows = await strapi.entityService.findMany('api::flow.flow', {
      filters: {
        isActive: true,
        status: 'active',
      },
    }) as any[];

    return flows.filter((flow) => {
      const nodes = flow.nodes || [];
      return nodes.length > 0;
    });
  },

  /**
   * Export flow to JSON format
   */
  async exportFlow(id: number) {
    const flow: any = await strapi.entityService.findOne('api::flow.flow', id);

    if (!flow) {
      throw new Error(`Flow with ID ${id} not found`);
    }

    return {
      name: flow.name,
      description: flow.description,
      nodes: flow.nodes,
      inputSchema: flow.inputSchema,
      outputSchema: flow.outputSchema,
      version: flow.version,
      category: flow.category,
      metadata: flow.metadata,
      exportedAt: new Date().toISOString(),
    };
  },

  /**
   * Import flow from JSON format
   */
  async importFlow(data: any) {
    // Validate required fields
    if (!data.name) {
      throw new Error('Flow name is required');
    }

    // Generate unique slug
    const slug = this.generateSlug(data.name, Date.now());

    return await strapi.entityService.create('api::flow.flow', {
      data: {
        name: data.name,
        slug,
        description: data.description || '',
        nodes: data.nodes || [],
        status: 'draft',
        inputSchema: data.inputSchema || {},
        outputSchema: data.outputSchema || {},
        isActive: false,
        version: data.version || '1.0.0',
        category: data.category || 'custom',
        metadata: {
          ...(data.metadata || {}),
          importedAt: new Date().toISOString(),
        },
      },
    });
  },
}));
