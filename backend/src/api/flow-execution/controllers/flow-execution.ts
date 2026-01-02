/**
 * Flow Execution controller
 *
 * Enhanced controller for FlowExecution CRUD operations with custom routes
 * for managing flow execution history, tracking, and lifecycle operations.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::flow-execution.flow-execution', ({ strapi }) => ({
  /**
   * Get executions for a specific flow
   * GET /api/flow-executions/flow/:flowId
   */
  async findByFlowId(ctx) {
    const { flowId } = ctx.params;
    const limit = parseInt(ctx.query.limit as string) || 10;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const executions = await executionService.findByFlowId(parseInt(flowId), limit);

      ctx.send({
        data: executions,
      });
    } catch (error: any) {
      strapi.log.error('Find by flow ID failed:', error);
      return ctx.badRequest('Find by flow ID failed', { error: error.message });
    }
  },

  /**
   * Get all running executions
   * GET /api/flow-executions/running
   */
  async findRunning(ctx) {
    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const executions = await executionService.findRunning();

      ctx.send({
        data: executions,
      });
    } catch (error: any) {
      strapi.log.error('Find running executions failed:', error);
      return ctx.badRequest('Find running executions failed', { error: error.message });
    }
  },

  /**
   * Get recent executions across all flows
   * GET /api/flow-executions/recent
   */
  async findRecent(ctx) {
    const limit = parseInt(ctx.query.limit as string) || 20;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const executions = await executionService.findRecent(limit);

      ctx.send({
        data: executions,
      });
    } catch (error: any) {
      strapi.log.error('Find recent executions failed:', error);
      return ctx.badRequest('Find recent executions failed', { error: error.message });
    }
  },

  /**
   * Get executions by status
   * GET /api/flow-executions/status/:status
   */
  async findByStatus(ctx) {
    const { status } = ctx.params;
    const limit = parseInt(ctx.query.limit as string) || 20;

    const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return ctx.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const executions = await executionService.findByStatus(status, limit);

      ctx.send({
        data: executions,
      });
    } catch (error: any) {
      strapi.log.error('Find by status failed:', error);
      return ctx.badRequest('Find by status failed', { error: error.message });
    }
  },

  /**
   * Get execution with full details
   * GET /api/flow-executions/:id/details
   */
  async findDetails(ctx) {
    const { id } = ctx.params;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const execution = await executionService.findWithFlow(parseInt(id));

      if (!execution) {
        return ctx.notFound('Execution not found');
      }

      ctx.send({
        data: execution,
      });
    } catch (error: any) {
      strapi.log.error('Find execution details failed:', error);
      return ctx.badRequest('Find execution details failed', { error: error.message });
    }
  },

  /**
   * Get execution statistics for a flow
   * GET /api/flow-executions/stats/:flowId
   */
  async getStats(ctx) {
    const { flowId } = ctx.params;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const stats = await executionService.getFlowStats(parseInt(flowId));

      ctx.send({
        data: stats,
      });
    } catch (error: any) {
      strapi.log.error('Get flow stats failed:', error);
      return ctx.badRequest('Get flow stats failed', { error: error.message });
    }
  },

  /**
   * Get global execution statistics
   * GET /api/flow-executions/stats
   */
  async getGlobalStats(ctx) {
    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const stats = await executionService.getGlobalStats();

      ctx.send({
        data: stats,
      });
    } catch (error: any) {
      strapi.log.error('Get global stats failed:', error);
      return ctx.badRequest('Get global stats failed', { error: error.message });
    }
  },

  /**
   * Start a new flow execution
   * POST /api/flow-executions/start
   * Body: { flowId, input, triggeredBy?, triggerData? }
   */
  async start(ctx) {
    const { flowId, input, triggeredBy, triggerData } = ctx.request.body;

    if (!flowId) {
      return ctx.badRequest('Missing "flowId" in request body');
    }

    try {
      // Verify flow exists
      const flow = await strapi.entityService.findOne('api::flow.flow', parseInt(flowId));
      if (!flow) {
        return ctx.notFound('Flow not found');
      }

      const executionService = strapi.service('api::flow-execution.flow-execution');
      const execution = await executionService.startExecution(
        parseInt(flowId),
        input || {},
        triggeredBy || 'manual',
        triggerData
      );

      ctx.send({
        data: execution,
        message: 'Flow execution started',
      });
    } catch (error: any) {
      strapi.log.error('Start execution failed:', error);
      return ctx.badRequest('Start execution failed', { error: error.message });
    }
  },

  /**
   * Add a log entry to an execution
   * POST /api/flow-executions/:id/log
   * Body: { level, message, nodeId? }
   */
  async addLog(ctx) {
    const { id } = ctx.params;
    const { level, message, nodeId } = ctx.request.body;

    if (!level || !message) {
      return ctx.badRequest('Missing "level" or "message" in request body');
    }

    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(level)) {
      return ctx.badRequest(`Invalid level. Must be one of: ${validLevels.join(', ')}`);
    }

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const execution = await executionService.addLog(parseInt(id), level, message, nodeId);

      ctx.send({
        data: execution,
        message: 'Log entry added',
      });
    } catch (error: any) {
      strapi.log.error('Add log failed:', error);
      return ctx.badRequest('Add log failed', { error: error.message });
    }
  },

  /**
   * Update node execution state
   * PUT /api/flow-executions/:id/node/:nodeId
   * Body: { status, input?, output?, error?, startedAt?, completedAt? }
   */
  async updateNode(ctx) {
    const { id, nodeId } = ctx.params;
    const nodeState = ctx.request.body;

    if (!nodeState || Object.keys(nodeState).length === 0) {
      return ctx.badRequest('Node state is required in request body');
    }

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const execution = await executionService.updateNodeExecution(
        parseInt(id),
        nodeId,
        nodeState
      );

      ctx.send({
        data: execution,
        message: 'Node execution updated',
      });
    } catch (error: any) {
      strapi.log.error('Update node execution failed:', error);
      return ctx.badRequest('Update node execution failed', { error: error.message });
    }
  },

  /**
   * Complete an execution
   * POST /api/flow-executions/:id/complete
   * Body: { output, tokensUsed?, cost? }
   */
  async complete(ctx) {
    const { id } = ctx.params;
    const { output, tokensUsed, cost } = ctx.request.body;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const execution = await executionService.completeExecution(
        parseInt(id),
        output || {},
        tokensUsed || 0,
        cost || 0
      );

      ctx.send({
        data: execution,
        message: 'Execution completed successfully',
      });
    } catch (error: any) {
      strapi.log.error('Complete execution failed:', error);
      return ctx.badRequest('Complete execution failed', { error: error.message });
    }
  },

  /**
   * Fail an execution
   * POST /api/flow-executions/:id/fail
   * Body: { error, errorDetails? }
   */
  async fail(ctx) {
    const { id } = ctx.params;
    const { error, errorDetails } = ctx.request.body;

    if (!error) {
      return ctx.badRequest('Missing "error" in request body');
    }

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const execution = await executionService.failExecution(parseInt(id), error, errorDetails);

      ctx.send({
        data: execution,
        message: 'Execution marked as failed',
      });
    } catch (error: any) {
      strapi.log.error('Fail execution failed:', error);
      return ctx.badRequest('Fail execution failed', { error: (error as Error).message });
    }
  },

  /**
   * Cancel a running execution
   * POST /api/flow-executions/:id/cancel
   */
  async cancel(ctx) {
    const { id } = ctx.params;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const execution = await executionService.cancelExecution(parseInt(id));

      ctx.send({
        data: execution,
        message: 'Execution cancelled',
      });
    } catch (error: any) {
      strapi.log.error('Cancel execution failed:', error);
      return ctx.badRequest('Cancel execution failed', { error: error.message });
    }
  },

  /**
   * Retry a failed execution
   * POST /api/flow-executions/:id/retry
   */
  async retry(ctx) {
    const { id } = ctx.params;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const newExecution = await executionService.retryExecution(parseInt(id));

      ctx.send({
        data: newExecution,
        message: 'Execution retry started',
      });
    } catch (error: any) {
      strapi.log.error('Retry execution failed:', error);
      return ctx.badRequest('Retry execution failed', { error: error.message });
    }
  },

  /**
   * Get execution logs
   * GET /api/flow-executions/:id/logs
   */
  async getLogs(ctx) {
    const { id } = ctx.params;

    try {
      const execution: any = await strapi.entityService.findOne(
        'api::flow-execution.flow-execution',
        parseInt(id)
      );

      if (!execution) {
        return ctx.notFound('Execution not found');
      }

      ctx.send({
        data: execution.logs || [],
      });
    } catch (error: any) {
      strapi.log.error('Get logs failed:', error);
      return ctx.badRequest('Get logs failed', { error: error.message });
    }
  },

  /**
   * Clean up old executions
   * DELETE /api/flow-executions/cleanup
   * Query: { olderThanDays?: number, status?: string }
   */
  async cleanup(ctx) {
    const olderThanDays = parseInt(ctx.query.olderThanDays as string) || 30;
    const status = ctx.query.status as string;

    try {
      const executionService = strapi.service('api::flow-execution.flow-execution');
      const deletedCount = await executionService.cleanupOld(olderThanDays, status);

      ctx.send({
        data: { deletedCount },
        message: `Cleaned up ${deletedCount} old executions`,
      });
    } catch (error: any) {
      strapi.log.error('Cleanup failed:', error);
      return ctx.badRequest('Cleanup failed', { error: error.message });
    }
  },
}));
