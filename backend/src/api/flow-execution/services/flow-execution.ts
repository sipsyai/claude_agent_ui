/**
 * Flow Execution service
 *
 * Service layer for FlowExecution operations with helper methods for
 * execution lifecycle management, tracking, and reporting.
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
   * Find recent executions across all flows
   */
  async findRecent(limit = 20) {
    return await strapi.entityService.findMany('api::flow-execution.flow-execution', {
      sort: { createdAt: 'desc' },
      limit,
      populate: ['flow'],
    });
  },

  /**
   * Find executions by status
   */
  async findByStatus(status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled', limit = 20) {
    return await strapi.entityService.findMany('api::flow-execution.flow-execution', {
      filters: {
        status: { $eq: status },
      },
      sort: { createdAt: 'desc' },
      limit,
      populate: ['flow'],
    });
  },

  /**
   * Start a new execution
   */
  async startExecution(flowId: number, input: any, triggeredBy: 'manual' | 'schedule' | 'webhook' | 'api' = 'manual', triggerData?: any) {
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
   * Retry a failed execution
   */
  async retryExecution(id: number) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id, {
      populate: ['flow'],
    });

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    if (execution.status !== 'failed' && execution.status !== 'cancelled') {
      throw new Error('Can only retry failed or cancelled executions');
    }

    if (!execution.flow) {
      throw new Error('Cannot retry execution: Flow not found');
    }

    const now = new Date().toISOString();
    const newRetryCount = (execution.retryCount || 0) + 1;

    // Create a new execution as a retry
    return await strapi.entityService.create('api::flow-execution.flow-execution', {
      data: {
        flow: execution.flow.id,
        status: 'running',
        input: execution.input,
        startedAt: now,
        triggeredBy: 'api',
        triggerData: {
          isRetry: true,
          originalExecutionId: id,
          retryNumber: newRetryCount,
        },
        retryCount: newRetryCount,
        parentExecutionId: id,
        logs: [{
          timestamp: now,
          level: 'info',
          message: `Retry #${newRetryCount} started (original execution: ${id})`,
        }],
        metadata: {
          ...(execution.metadata || {}),
          retryOf: id,
        },
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
    const cancelled = executions.filter(e => e.status === 'cancelled').length;
    const pending = executions.filter(e => e.status === 'pending').length;

    const completedExecutions = executions.filter(e => e.status === 'completed' && e.executionTime);
    const avgExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / completedExecutions.length
      : 0;

    const totalTokensUsed = executions.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    const totalCost = executions.reduce((sum, e) => {
      const cost = e.cost || 0;
      const costNumber = typeof cost === 'string' ? parseFloat(cost) : cost;
      return sum + (isNaN(costNumber) ? 0 : costNumber);
    }, 0);

    return {
      total,
      completed,
      failed,
      running,
      cancelled,
      pending,
      successRate: total > 0 ? (completed / total * 100).toFixed(1) : '0',
      failureRate: total > 0 ? (failed / total * 100).toFixed(1) : '0',
      avgExecutionTime: Math.round(avgExecutionTime),
      totalTokensUsed,
      totalCost: totalCost.toFixed(4),
      lastExecution: executions[0] || null,
    };
  },

  /**
   * Get global execution statistics across all flows
   */
  async getGlobalStats() {
    const executions = await strapi.entityService.findMany('api::flow-execution.flow-execution', {
      sort: { createdAt: 'desc' },
      populate: ['flow'],
    }) as any[];

    const total = executions.length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;
    const cancelled = executions.filter(e => e.status === 'cancelled').length;
    const pending = executions.filter(e => e.status === 'pending').length;

    const completedExecutions = executions.filter(e => e.status === 'completed' && e.executionTime);
    const avgExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / completedExecutions.length
      : 0;

    const totalTokensUsed = executions.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    const totalCost = executions.reduce((sum, e) => {
      const cost = e.cost || 0;
      const costNumber = typeof cost === 'string' ? parseFloat(cost) : cost;
      return sum + (isNaN(costNumber) ? 0 : costNumber);
    }, 0);

    // Count executions by trigger type
    const byTrigger = {
      manual: executions.filter(e => e.triggeredBy === 'manual').length,
      schedule: executions.filter(e => e.triggeredBy === 'schedule').length,
      webhook: executions.filter(e => e.triggeredBy === 'webhook').length,
      api: executions.filter(e => e.triggeredBy === 'api').length,
    };

    // Get unique flow count - handle both populated objects and foreign key IDs
    const uniqueFlowIds = new Set(executions
      .map(e => {
        if (!e.flow) return null;
        // If flow is an object with an id property, use that
        if (typeof e.flow === 'object' && e.flow.id) return e.flow.id;
        // If flow is just a number (the ID), use it directly
        if (typeof e.flow === 'number') return e.flow;
        return null;
      })
      .filter(Boolean));

    // Get today's executions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayExecutions = executions.filter(e => e.createdAt && new Date(e.createdAt) >= today);

    return {
      total,
      completed,
      failed,
      running,
      cancelled,
      pending,
      successRate: total > 0 ? (completed / total * 100).toFixed(1) : '0',
      failureRate: total > 0 ? (failed / total * 100).toFixed(1) : '0',
      avgExecutionTime: Math.round(avgExecutionTime),
      totalTokensUsed,
      totalCost: totalCost.toFixed(4),
      uniqueFlows: uniqueFlowIds.size,
      byTrigger,
      todayCount: todayExecutions.length,
      lastExecution: executions[0] || null,
    };
  },

  /**
   * Clean up old executions
   */
  async cleanupOld(olderThanDays: number = 30, status?: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const filters: any = {
      createdAt: { $lt: cutoffDate.toISOString() },
    };

    // Only clean up finished executions (not running or pending)
    if (status) {
      filters.status = { $eq: status };
    } else {
      filters.status = { $in: ['completed', 'failed', 'cancelled'] };
    }

    const executions = await strapi.entityService.findMany('api::flow-execution.flow-execution', {
      filters,
    }) as any[];

    // Delete each execution
    let deletedCount = 0;
    for (const execution of executions) {
      await strapi.entityService.delete('api::flow-execution.flow-execution', execution.id);
      deletedCount++;
    }

    return deletedCount;
  },

  /**
   * Get execution timeline (for visualization)
   */
  async getExecutionTimeline(id: number) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id);

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    const timeline = [];
    const logs = execution.logs || [];
    const nodeExecutions = execution.nodeExecutions || [];

    // Add start event
    if (execution.startedAt) {
      timeline.push({
        type: 'start',
        timestamp: execution.startedAt,
        message: 'Execution started',
      });
    }

    // Add log entries
    for (const log of logs) {
      timeline.push({
        type: 'log',
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        nodeId: log.nodeId,
      });
    }

    // Add node execution events
    for (const node of nodeExecutions) {
      if (node.startedAt) {
        timeline.push({
          type: 'node_start',
          timestamp: node.startedAt,
          nodeId: node.nodeId,
          message: `Node ${node.nodeId} started`,
        });
      }
      if (node.completedAt) {
        timeline.push({
          type: 'node_complete',
          timestamp: node.completedAt,
          nodeId: node.nodeId,
          status: node.status,
          message: `Node ${node.nodeId} ${node.status}`,
        });
      }
    }

    // Add completion event
    if (execution.completedAt) {
      timeline.push({
        type: 'complete',
        timestamp: execution.completedAt,
        status: execution.status,
        message: `Execution ${execution.status}`,
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return timeline;
  },

  /**
   * Get execution summary
   */
  async getExecutionSummary(id: number) {
    const execution: any = await strapi.entityService.findOne('api::flow-execution.flow-execution', id, {
      populate: ['flow'],
    });

    if (!execution) {
      throw new Error(`Execution with ID ${id} not found`);
    }

    const nodeExecutions = execution.nodeExecutions || [];
    const nodesCompleted = nodeExecutions.filter((n: any) => n.status === 'completed').length;
    const nodesFailed = nodeExecutions.filter((n: any) => n.status === 'failed').length;
    const totalNodes = nodeExecutions.length;

    return {
      id: execution.id,
      flowId: execution.flow?.id,
      flowName: execution.flow?.name,
      status: execution.status,
      triggeredBy: execution.triggeredBy,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      executionTime: execution.executionTime,
      tokensUsed: execution.tokensUsed,
      cost: execution.cost,
      progress: {
        totalNodes,
        nodesCompleted,
        nodesFailed,
        percentage: totalNodes > 0 ? Math.round((nodesCompleted / totalNodes) * 100) : 0,
      },
      hasError: !!execution.error,
      error: execution.error,
      retryCount: execution.retryCount,
      isRetry: !!execution.parentExecutionId,
    };
  },
}));
