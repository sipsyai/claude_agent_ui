/**
 * flow-execution service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::flow-execution.flow-execution', ({ strapi }) => ({
  /**
   * Find execution with flow relation populated
   */
  async findWithFlow(id: number) {
    return await strapi.entityService.findOne('api::flow-execution.flow-execution', id, {
      populate: ['flow'],
    });
  },

  /**
   * Find all executions for a specific flow
   */
  async findByFlowId(flowId: number, limit = 10) {
    return await strapi.entityService.findMany('api::flow-execution.flow-execution', {
      filters: {
        flow: { id: { $eq: flowId } },
      },
      sort: { createdAt: 'desc' },
      limit,
      populate: ['flow'],
    });
  },

  /**
   * Find running executions
   */
  async findRunning() {
    return await strapi.entityService.findMany('api::flow-execution.flow-execution', {
      filters: {
        status: 'running',
      },
      populate: ['flow'],
    });
  },

  /**
   * Start a new execution
   */
  async startExecution(flowId: number, input: any, triggeredBy: string = 'manual', triggerData?: any) {
    const now = new Date().toISOString();

    return await strapi.entityService.create('api::flow-execution.flow-execution', {
      data: {
        flow: flowId,
        status: 'running',
        input,
        startedAt: now,
        triggeredBy,
        triggerData,
        logs: [{
          timestamp: now,
          level: 'info',
          message: 'Flow execution started',
        }],
      },
    });
  },

  /**
   * Add a log entry to the execution
   */
  async addLog(id: number, level: string, message: string, nodeId?: string) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id);

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    const logs = execution.logs || [];
    logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      nodeId,
    });

    return await strapi.entityService.update('api::flow-execution.flow-execution', id, {
      data: { logs },
    });
  },

  /**
   * Update node execution state
   */
  async updateNodeExecution(id: number, nodeId: string, nodeState: any) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id);

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    const nodeExecutions = execution.nodeExecutions || [];
    const existingIndex = nodeExecutions.findIndex((n: any) => n.nodeId === nodeId);

    if (existingIndex >= 0) {
      nodeExecutions[existingIndex] = { ...nodeExecutions[existingIndex], ...nodeState };
    } else {
      nodeExecutions.push({ nodeId, ...nodeState });
    }

    return await strapi.entityService.update('api::flow-execution.flow-execution', id, {
      data: {
        nodeExecutions,
        currentNodeId: nodeState.status === 'running' ? nodeId : execution.currentNodeId,
      },
    });
  },

  /**
   * Complete an execution successfully
   */
  async completeExecution(id: number, output: any, tokensUsed: number = 0, cost: number = 0) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id);

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    const now = new Date();
    const startedAt = new Date(execution.startedAt);
    const executionTime = now.getTime() - startedAt.getTime();

    const logs = execution.logs || [];
    logs.push({
      timestamp: now.toISOString(),
      level: 'info',
      message: 'Flow execution completed successfully',
    });

    return await strapi.entityService.update('api::flow-execution.flow-execution', id, {
      data: {
        status: 'completed',
        output,
        completedAt: now.toISOString(),
        executionTime,
        tokensUsed: (execution.tokensUsed || 0) + tokensUsed,
        cost: (execution.cost || 0) + cost,
        currentNodeId: null,
        logs,
      },
    });
  },

  /**
   * Fail an execution
   */
  async failExecution(id: number, error: string, errorDetails?: any) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id);

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    const now = new Date();
    const startedAt = new Date(execution.startedAt);
    const executionTime = now.getTime() - startedAt.getTime();

    const logs = execution.logs || [];
    logs.push({
      timestamp: now.toISOString(),
      level: 'error',
      message: `Flow execution failed: ${error}`,
    });

    return await strapi.entityService.update('api::flow-execution.flow-execution', id, {
      data: {
        status: 'failed',
        error,
        errorDetails,
        completedAt: now.toISOString(),
        executionTime,
        currentNodeId: null,
        logs,
      },
    });
  },

  /**
   * Cancel an execution
   */
  async cancelExecution(id: number) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id);

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    if (execution.status !== 'running' && execution.status !== 'pending') {
      throw new Error('Can only cancel running or pending executions');
    }

    const now = new Date();
    const startedAt = new Date(execution.startedAt);
    const executionTime = now.getTime() - startedAt.getTime();

    const logs = execution.logs || [];
    logs.push({
      timestamp: now.toISOString(),
      level: 'warn',
      message: 'Flow execution cancelled by user',
    });

    return await strapi.entityService.update('api::flow-execution.flow-execution', id, {
      data: {
        status: 'cancelled',
        completedAt: now.toISOString(),
        executionTime,
        currentNodeId: null,
        logs,
      },
    });
  },

  /**
   * Get execution statistics for a flow
   */
  async getFlowStats(flowId: number) {
    const executions = await strapi.entityService.findMany('api::flow-execution.flow-execution', {
      filters: {
        flow: { id: { $eq: flowId } },
      },
      sort: { createdAt: 'desc' },
    }) as any[];

    const total = executions.length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;

    const completedExecutions = executions.filter(e => e.status === 'completed' && e.executionTime);
    const avgExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / completedExecutions.length
      : 0;

    const totalTokensUsed = executions.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    const totalCost = executions.reduce((sum, e) => sum + parseFloat(e.cost || 0), 0);

    return {
      total,
      completed,
      failed,
      running,
      successRate: total > 0 ? (completed / total * 100).toFixed(1) : '0',
      avgExecutionTime: Math.round(avgExecutionTime),
      totalTokensUsed,
      totalCost: totalCost.toFixed(4),
      lastExecution: executions[0] || null,
    };
  },
}));
