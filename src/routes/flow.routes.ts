/**
 * Flow Routes - REST API for Flow Management and Execution
 *
 * Provides endpoints for:
 * - Flow CRUD operations (proxied to Strapi)
 * - Flow execution (start, stop, monitor)
 * - Server-Sent Events (SSE) streaming for real-time execution updates
 *
 * @see src/services/flow-execution-service.ts for execution logic
 * @see src/types/flow-types.ts for type definitions
 */

import { Router, Request, Response } from 'express';
import { strapiClient } from '../services/strapi-client.js';
import { flowExecutionService } from '../services/flow-execution-service.js';
import { createLogger } from '../services/logger.js';
import { asyncHandler, AppError } from '../middleware/error-handler.js';
import type { FlowExecutionUpdate } from '../types/flow-types.js';
import {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  createFlowFromTemplate,
} from '../services/flow-templates.js';

// Import validation schemas
import {
  flowIdSchema,
  executionIdSchema,
  flowQuerySchema,
  createFlowSchema,
  updateFlowSchema,
  startFlowExecutionSchema,
  executionQuerySchema,
} from '../validators/flow.validators.js';

// ============= SSE HELPER CLASS =============

/**
 * SSE Stream helper for flow execution updates
 */
class FlowSSEStream {
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(private res: Response) {
    // Set SSE headers
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection comment
    this.res.write(': SSE stream initialized\n\n');
    this.res.flushHeaders();
  }

  /**
   * Send a named SSE event with data
   */
  send(event: string, data: any): void {
    if (this.isClosed) return;
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Send SSE data without event name
   */
  sendData(data: any): void {
    if (this.isClosed) return;
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Send SSE comment (for keep-alive)
   */
  sendComment(comment: string): void {
    if (this.isClosed) return;
    this.res.write(`: ${comment}\n\n`);
  }

  /**
   * Close the SSE stream
   */
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    this.res.end();
  }

  /**
   * Check if stream is closed
   */
  isStreamClosed(): boolean {
    return this.isClosed;
  }

  /**
   * Start keep-alive ping every 30 seconds
   */
  startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      this.sendComment('keep-alive');
    }, 30000);
  }

  /**
   * Stop keep-alive ping
   */
  stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

// ============= ROUTE FACTORY =============

export function createFlowRoutes(): Router {
  const router = Router();
  const logger = createLogger('FlowRoutes');

  // ============= FLOW CRUD OPERATIONS =============

  /**
   * GET /api/flows
   * List all flows with optional filtering, sorting, and pagination
   */
  router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const query = flowQuerySchema.parse(req.query);

    logger.debug('Fetching flows', { query });

    const filters: any = {};

    if (query.status) {
      filters.status = query.status;
    }

    if (query.category) {
      filters.category = query.category;
    }

    if (query.isActive !== undefined) {
      filters.isActive = query.isActive;
    }

    if (query.search) {
      filters.$or = [
        { name: { $containsi: query.search } },
        { description: { $containsi: query.search } }
      ];
    }

    const flows = await strapiClient.getAllFlows({
      filters,
      sort: [query.sort],
      pagination: {
        page: query.page,
        pageSize: query.pageSize
      }
    });

    res.json({
      data: flows,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: flows.length
      }
    });
  }));

  // ============= FLOW TEMPLATES (must come before :id routes) =============

  /**
   * GET /api/flows/templates
   * Get all available flow templates
   */
  router.get('/templates', asyncHandler(async (_req: Request, res: Response) => {
    logger.debug('Fetching flow templates');

    const templates = getAllTemplates();

    res.json({
      data: templates.map(t => ({
        templateId: t.templateId,
        name: t.name,
        description: t.description,
        category: t.category,
        icon: t.icon,
        tags: t.tags,
      })),
      count: templates.length
    });
  }));

  /**
   * GET /api/flows/templates/search
   * Search templates by query (must come before /templates/:templateId)
   */
  router.get('/templates/search', asyncHandler(async (req: Request, res: Response) => {
    const query = (req.query.q as string) || '';

    logger.debug('Searching flow templates', { query });

    const templates = searchTemplates(query);

    res.json({
      data: templates.map(t => ({
        templateId: t.templateId,
        name: t.name,
        description: t.description,
        category: t.category,
        icon: t.icon,
        tags: t.tags,
      })),
      count: templates.length
    });
  }));

  /**
   * GET /api/flows/templates/category/:category
   * Get templates by category
   */
  router.get('/templates/category/:category', asyncHandler(async (req: Request, res: Response) => {
    const category = req.params.category as any;

    logger.debug('Fetching flow templates by category', { category });

    const templates = getTemplatesByCategory(category);

    res.json({
      data: templates.map(t => ({
        templateId: t.templateId,
        name: t.name,
        description: t.description,
        category: t.category,
        icon: t.icon,
        tags: t.tags,
      })),
      count: templates.length
    });
  }));

  /**
   * GET /api/flows/templates/:templateId
   * Get a specific template by ID
   */
  router.get('/templates/:templateId', asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = req.params;

    logger.debug('Fetching flow template', { templateId });

    const template = getTemplateById(templateId);

    if (!template) {
      throw new AppError(404, 'Template not found');
    }

    res.json({
      templateId: template.templateId,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      tags: template.tags,
      flowData: template.flowData,
    });
  }));

  /**
   * POST /api/flows/templates/:templateId/create
   * Create a new flow from a template
   */
  router.post('/templates/:templateId/create', asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = req.params;
    const { name: customName } = req.body;

    logger.info('Creating flow from template', { templateId, customName });

    const flowData = createFlowFromTemplate(templateId);

    if (!flowData) {
      throw new AppError(404, 'Template not found');
    }

    // Apply custom name if provided
    if (customName) {
      flowData.name = customName;
      flowData.slug = customName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50) + '-' + Date.now();
    }

    // Create the flow in Strapi
    const flow = await strapiClient.createFlow(flowData);

    res.status(201).json({
      success: true,
      flow,
      message: `Flow "${flow.name}" created from template "${templateId}"`
    });
  }));

  // ============= FLOW CRUD BY ID =============

  /**
   * GET /api/flows/:id
   * Get a single flow by ID
   */
  router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = flowIdSchema.parse(req.params);

    logger.debug('Fetching flow', { id });

    const flow = await strapiClient.getFlow(id);

    if (!flow) {
      throw new AppError(404, 'Flow not found');
    }

    res.json(flow);
  }));

  /**
   * POST /api/flows
   * Create a new flow
   */
  router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const validated = createFlowSchema.parse(req.body);

    logger.info('Creating flow', { name: validated.name });

    const flow = await strapiClient.createFlow(validated);

    res.status(201).json({
      success: true,
      flow,
      message: `Flow "${flow.name}" created successfully`
    });
  }));

  /**
   * PUT /api/flows/:id
   * Update an existing flow
   */
  router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = flowIdSchema.parse(req.params);
    const validated = updateFlowSchema.parse(req.body);

    logger.info('Updating flow', { id, updates: Object.keys(validated) });

    const flow = await strapiClient.updateFlow(id, validated);

    res.json({
      success: true,
      flow,
      message: `Flow "${flow.name}" updated successfully`
    });
  }));

  /**
   * DELETE /api/flows/:id
   * Delete a flow
   */
  router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = flowIdSchema.parse(req.params);

    logger.info('Deleting flow', { id });

    await strapiClient.deleteFlow(id);

    res.status(204).send();
  }));

  // ============= FLOW EXECUTION ENDPOINTS =============

  /**
   * POST /api/flows/:id/execute
   * Start a flow execution with SSE streaming for real-time updates
   */
  router.post('/:id/execute', async (req: Request, res: Response) => {
    let stream: FlowSSEStream | null = null;

    try {
      const { id: flowId } = flowIdSchema.parse(req.params);
      const body = startFlowExecutionSchema.parse(req.body);

      logger.info('Flow execution requested', { flowId, triggeredBy: body.triggeredBy });

      // 1. Verify flow exists and is active
      const flow = await strapiClient.getFlow(flowId);

      if (!flow) {
        throw new AppError(404, 'Flow not found');
      }

      if (!flow.isActive) {
        throw new AppError(403, 'Flow is not active. Please activate it before execution.');
      }

      // 2. Initialize SSE stream
      stream = new FlowSSEStream(res);
      stream.startKeepAlive();

      // 3. Send initial status
      stream.sendData({
        type: 'status',
        status: 'starting',
        message: `Starting flow: ${flow.name}`,
        flowId,
        flowName: flow.name,
        timestamp: new Date().toISOString()
      });

      // 4. Handle client disconnect
      req.on('close', async () => {
        logger.info('Client disconnected from flow execution', { flowId });

        // If we have an active execution, we could cancel it here
        // For now, just cleanup the stream
        if (stream) {
          stream.stopKeepAlive();
          stream.close();
        }
      });

      // 5. Set up execution update listener
      const updateHandler = (update: FlowExecutionUpdate) => {
        if (stream && !stream.isStreamClosed()) {
          logger.debug('Sending execution update', { type: update.type, executionId: update.executionId });

          stream.send(update.type, {
            executionId: update.executionId,
            type: update.type,
            nodeId: update.nodeId,
            nodeType: update.nodeType,
            timestamp: update.timestamp,
            data: update.data
          });

          // Close stream on terminal states
          if (['execution_completed', 'execution_failed', 'execution_cancelled'].includes(update.type)) {
            setTimeout(() => {
              if (stream) {
                stream.stopKeepAlive();
                stream.close();
              }
            }, 100); // Small delay to ensure message is sent
          }
        }
      };

      // Register the update handler
      flowExecutionService.on('execution-update', updateHandler);

      // 6. Start the flow execution
      try {
        const result = await flowExecutionService.startExecution({
          flowId,
          input: body.input,
          triggeredBy: body.triggeredBy,
          triggerData: body.triggerData,
        });

        logger.info('Flow execution completed', {
          flowId,
          executionId: result.executionId,
          success: result.success,
          executionTime: result.executionTime
        });

        // Send final result
        if (stream && !stream.isStreamClosed()) {
          stream.sendData({
            type: 'result',
            result: {
              executionId: result.executionId,
              success: result.success,
              status: result.status,
              output: result.output,
              error: result.error,
              executionTime: result.executionTime,
              tokensUsed: result.tokensUsed,
              cost: result.cost,
              nodeExecutions: result.nodeExecutions
            },
            timestamp: new Date().toISOString()
          });
        }

      } catch (execError) {
        logger.error('Flow execution error', execError as Error, { flowId });

        if (stream && !stream.isStreamClosed()) {
          stream.sendData({
            type: 'error',
            error: execError instanceof Error ? execError.message : String(execError),
            timestamp: new Date().toISOString()
          });
        }
      } finally {
        // Cleanup
        flowExecutionService.off('execution-update', updateHandler);

        if (stream) {
          stream.stopKeepAlive();
          if (!stream.isStreamClosed()) {
            stream.close();
          }
        }
      }

    } catch (error: any) {
      logger.error('Flow execution request error', error);

      // If headers already sent, send error via SSE
      if (res.headersSent && stream) {
        stream.sendData({
          type: 'error',
          message: error?.message || 'Unknown error',
          errorType: error?.constructor?.name || 'Error',
          timestamp: new Date().toISOString()
        });
        stream.stopKeepAlive();
        stream.close();
      } else {
        // Otherwise send JSON error
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        res.status(statusCode).json({
          error: error?.message || 'Unknown error',
          type: error?.constructor?.name || 'Error'
        });
      }
    }
  });

  /**
   * GET /api/flows/executions/running
   * Get all currently running executions
   * NOTE: This route must come BEFORE /executions/:id to avoid path conflict
   */
  router.get('/executions/running', asyncHandler(async (req: Request, res: Response) => {
    logger.debug('Fetching running executions');

    // Get running execution IDs from the service (in-memory)
    const activeIds = flowExecutionService.getActiveExecutionIds();

    // Also fetch from Strapi for persistent record
    const strapiRunning = await strapiClient.getRunningFlowExecutions();

    res.json({
      active: activeIds,
      executions: strapiRunning,
      count: strapiRunning.length
    });
  }));

  /**
   * GET /api/flows/executions/recent
   * Get recent flow executions across all flows
   * NOTE: This route must come BEFORE /executions/:id to avoid path conflict
   */
  router.get('/executions/recent', asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    logger.debug('Fetching recent executions', { limit });

    const executions = await strapiClient.getRecentFlowExecutions(limit);

    res.json({
      data: executions,
      count: executions.length
    });
  }));

  /**
   * GET /api/flows/executions/:id
   * Get a single execution by ID
   */
  router.get('/executions/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = executionIdSchema.parse(req.params);

    logger.debug('Fetching execution', { id });

    // First check if it's an active execution (in-memory)
    const activeExecution = flowExecutionService.getExecutionStatus(id);

    if (activeExecution) {
      res.json({
        ...activeExecution,
        isActive: true
      });
      return;
    }

    // Otherwise fetch from Strapi
    const execution = await strapiClient.getFlowExecution(id);

    if (!execution) {
      throw new AppError(404, 'Execution not found');
    }

    res.json({
      ...execution,
      isActive: false
    });
  }));

  /**
   * POST /api/flows/executions/:id/cancel
   * Cancel a running execution
   */
  router.post('/executions/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
    const { id } = executionIdSchema.parse(req.params);

    logger.info('Cancelling execution', { id });

    const cancelled = await flowExecutionService.cancelExecution(id);

    if (!cancelled) {
      throw new AppError(404, 'Execution not found or already completed');
    }

    res.json({
      success: true,
      message: 'Execution cancelled successfully',
      executionId: id
    });
  }));

  /**
   * GET /api/flows/executions/:id/stream
   * SSE stream for monitoring a specific execution
   */
  router.get('/executions/:id/stream', async (req: Request, res: Response) => {
    const { id } = executionIdSchema.parse(req.params);

    const stream = new FlowSSEStream(res);
    stream.startKeepAlive();

    logger.info('SSE stream started for execution', { executionId: id });

    // Check if execution exists
    const activeExecution = flowExecutionService.getExecutionStatus(id);
    const strapiExecution = activeExecution ? null : await strapiClient.getFlowExecution(id);

    if (!activeExecution && !strapiExecution) {
      stream.sendData({
        type: 'error',
        error: 'Execution not found',
        timestamp: new Date().toISOString()
      });
      stream.close();
      return;
    }

    // If execution is already completed, send final status and close
    if (strapiExecution && ['completed', 'failed', 'cancelled'].includes(strapiExecution.status)) {
      stream.sendData({
        type: 'status',
        status: strapiExecution.status,
        execution: strapiExecution,
        timestamp: new Date().toISOString()
      });
      stream.close();
      return;
    }

    // Set up listener for updates
    const updateHandler = (update: FlowExecutionUpdate) => {
      if (update.executionId === id) {
        stream.send(update.type, {
          executionId: update.executionId,
          type: update.type,
          nodeId: update.nodeId,
          nodeType: update.nodeType,
          timestamp: update.timestamp,
          data: update.data
        });

        // Close stream on terminal states
        if (['execution_completed', 'execution_failed', 'execution_cancelled'].includes(update.type)) {
          setTimeout(() => {
            stream.stopKeepAlive();
            stream.close();
          }, 100);
        }
      }
    };

    flowExecutionService.on('execution-update', updateHandler);

    // Send current status
    if (activeExecution) {
      stream.sendData({
        type: 'status',
        status: activeExecution.status,
        currentNodeId: activeExecution.currentNodeId,
        timestamp: new Date().toISOString()
      });
    }

    // Handle client disconnect
    req.on('close', () => {
      logger.info('Client disconnected from execution stream', { executionId: id });
      flowExecutionService.off('execution-update', updateHandler);
      stream.stopKeepAlive();
      stream.close();
    });
  });

  /**
   * GET /api/flows/:id/executions
   * Get all executions for a specific flow
   */
  router.get('/:id/executions', asyncHandler(async (req: Request, res: Response) => {
    const { id: flowId } = flowIdSchema.parse(req.params);
    const query = executionQuerySchema.parse(req.query);

    logger.debug('Fetching executions for flow', { flowId, query });

    // Verify flow exists
    const flow = await strapiClient.getFlow(flowId);

    if (!flow) {
      throw new AppError(404, 'Flow not found');
    }

    const filters: any = {
      flow: { documentId: flowId }
    };

    if (query.status) {
      filters.status = query.status;
    }

    if (query.triggeredBy) {
      filters.triggeredBy = query.triggeredBy;
    }

    const executions = await strapiClient.getAllFlowExecutions({
      filters,
      sort: [query.sort],
      pagination: {
        page: query.page,
        pageSize: query.pageSize
      }
    });

    res.json({
      data: executions,
      meta: {
        flowId,
        flowName: flow.name,
        page: query.page,
        pageSize: query.pageSize,
        total: executions.length
      }
    });
  }));

  // ============= FLOW STATISTICS =============

  /**
   * GET /api/flows/stats/global
   * Get global flow execution statistics
   */
  router.get('/stats/global', asyncHandler(async (req: Request, res: Response) => {
    logger.debug('Fetching global flow statistics');

    const stats = await strapiClient.getGlobalFlowStats();

    res.json(stats);
  }));

  /**
   * GET /api/flows/stats/:id
   * Get statistics for a specific flow
   */
  router.get('/stats/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = flowIdSchema.parse(req.params);

    logger.debug('Fetching flow statistics', { flowId: id });

    // Verify flow exists
    const flow = await strapiClient.getFlow(id);

    if (!flow) {
      throw new AppError(404, 'Flow not found');
    }

    const stats = await strapiClient.getFlowStats(id);

    res.json({
      ...stats,
      flowName: flow.name
    });
  }));

  // ============= FLOW STATUS MANAGEMENT =============

  /**
   * POST /api/flows/:id/activate
   * Activate a flow (set isActive to true)
   */
  router.post('/:id/activate', asyncHandler(async (req: Request, res: Response) => {
    const { id } = flowIdSchema.parse(req.params);

    logger.info('Activating flow', { id });

    const flow = await strapiClient.updateFlow(id, {
      isActive: true,
      status: 'active'
    });

    res.json({
      success: true,
      flow,
      message: `Flow "${flow.name}" activated successfully`
    });
  }));

  /**
   * POST /api/flows/:id/deactivate
   * Deactivate a flow (set isActive to false)
   */
  router.post('/:id/deactivate', asyncHandler(async (req: Request, res: Response) => {
    const { id } = flowIdSchema.parse(req.params);

    logger.info('Deactivating flow', { id });

    const flow = await strapiClient.updateFlow(id, {
      isActive: false,
      status: 'paused'
    });

    res.json({
      success: true,
      flow,
      message: `Flow "${flow.name}" deactivated successfully`
    });
  }));

  /**
   * POST /api/flows/:id/duplicate
   * Duplicate a flow
   */
  router.post('/:id/duplicate', asyncHandler(async (req: Request, res: Response) => {
    const { id } = flowIdSchema.parse(req.params);
    const { name } = req.body;

    logger.info('Duplicating flow', { id, newName: name });

    // Fetch original flow
    const original = await strapiClient.getFlow(id);

    if (!original) {
      throw new AppError(404, 'Flow not found');
    }

    // Create duplicate
    const duplicate = await strapiClient.createFlow({
      name: name || `${original.name} (Copy)`,
      description: original.description,
      nodes: original.nodes,
      inputSchema: original.inputSchema,
      outputSchema: original.outputSchema,
      isActive: false,
      status: 'draft',
      version: '1.0.0',
      category: original.category,
      metadata: original.metadata
    });

    res.status(201).json({
      success: true,
      flow: duplicate,
      message: `Flow duplicated successfully as "${duplicate.name}"`
    });
  }));

  return router;
}

// ============= DEFAULT EXPORT =============

export default createFlowRoutes;
