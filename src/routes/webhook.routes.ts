/**
 * Webhook Routes - REST API for Triggering Flows via HTTP Webhooks
 *
 * Provides endpoints for:
 * - Triggering flows via external HTTP requests
 * - Webhook authentication via secret token
 * - Synchronous and asynchronous execution modes
 *
 * @see src/services/flow-execution-service.ts for execution logic
 * @see src/types/flow-types.ts for type definitions
 */

import { Router, Request, Response } from 'express';
import { strapiClient } from '../services/strapi-client.js';
import { flowExecutionService } from '../services/flow-execution-service.js';
import { createLogger } from '../services/logger.js';
import { asyncHandler, AppError } from '../middleware/error-handler.js';
import { z } from 'zod';
import type { Flow, FlowExecutionResult } from '../types/flow-types.js';

// ============= VALIDATION SCHEMAS =============

/**
 * Webhook flow identifier parameter validation
 * Accepts either a documentId (UUID) or a slug
 */
const webhookIdentifierSchema = z.object({
  identifier: z.string()
    .min(1, 'Flow identifier is required')
});

/**
 * Webhook request body validation
 */
const webhookBodySchema = z.object({
  // Input data for the flow
  input: z.record(z.any())
    .optional()
    .default({}),

  // Whether to wait for flow completion before responding
  // Default: false (async mode - returns execution ID immediately)
  waitForCompletion: z.boolean()
    .optional()
    .default(false),

  // Optional timeout in milliseconds for waitForCompletion mode
  // Default: 60000 (60 seconds)
  timeout: z.number()
    .min(1000)
    .max(300000) // Max 5 minutes
    .optional()
    .default(60000),

  // Additional metadata to store with the execution
  metadata: z.record(z.any())
    .optional()
});

// ============= HELPER FUNCTIONS =============

/**
 * Find a flow by ID or slug
 */
async function findFlowByIdentifier(identifier: string): Promise<Flow | null> {
  // First try to find by ID
  try {
    const flow = await strapiClient.getFlow(identifier);
    if (flow) return flow;
  } catch {
    // Not found by ID, try slug
  }

  // Try to find by slug
  const flow = await strapiClient.getFlowBySlug(identifier);
  return flow;
}

/**
 * Validate webhook secret from request headers
 */
function validateWebhookSecret(req: Request, flow: Flow): boolean {
  if (!flow.webhookSecret) {
    // No secret configured, allow all requests
    return true;
  }

  // Check X-Webhook-Secret header
  const secretHeader = req.header('X-Webhook-Secret');
  if (secretHeader === flow.webhookSecret) {
    return true;
  }

  // Check Authorization header (Bearer token format)
  const authHeader = req.header('Authorization');
  if (authHeader) {
    const [type, token] = authHeader.split(' ');
    if (type?.toLowerCase() === 'bearer' && token === flow.webhookSecret) {
      return true;
    }
  }

  return false;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.header('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// ============= ROUTE FACTORY =============

export function createWebhookRoutes(): Router {
  const router = Router();
  const logger = createLogger('WebhookRoutes');

  // ============= WEBHOOK TRIGGER ENDPOINT =============

  /**
   * POST /api/webhooks/flows/:identifier
   * Trigger a flow execution via webhook
   *
   * The identifier can be either a flow ID or a slug
   *
   * Headers:
   * - X-Webhook-Secret: Secret token for authentication (optional, depends on flow config)
   * - Authorization: Bearer <secret> (alternative to X-Webhook-Secret)
   *
   * Body:
   * - input: Object - Input data for the flow (optional)
   * - waitForCompletion: boolean - Wait for execution to complete (default: false)
   * - timeout: number - Timeout in ms for waitForCompletion (default: 60000)
   * - metadata: Object - Additional metadata (optional)
   *
   * Response (async mode - waitForCompletion: false):
   * {
   *   success: true,
   *   executionId: "...",
   *   message: "Flow execution started",
   *   statusUrl: "/api/flows/executions/:id"
   * }
   *
   * Response (sync mode - waitForCompletion: true):
   * {
   *   success: true/false,
   *   executionId: "...",
   *   status: "completed" | "failed" | "cancelled",
   *   output: { ... },
   *   error: "..." (if failed),
   *   executionTime: 1234
   * }
   */
  router.post('/flows/:identifier', asyncHandler(async (req: Request, res: Response) => {
    const { identifier } = webhookIdentifierSchema.parse(req.params);
    const body = webhookBodySchema.parse(req.body);

    const clientIp = getClientIp(req);
    const userAgent = req.header('User-Agent') || 'unknown';

    logger.info('Webhook trigger received', {
      identifier,
      clientIp,
      userAgent,
      hasInput: Object.keys(body.input).length > 0,
      waitForCompletion: body.waitForCompletion
    });

    // 1. Find the flow
    const flow = await findFlowByIdentifier(identifier);

    if (!flow) {
      logger.warn('Webhook: Flow not found', { identifier, clientIp });
      throw new AppError(404, 'Flow not found');
    }

    // 2. Check if webhook is enabled for this flow
    if (!flow.webhookEnabled) {
      logger.warn('Webhook: Webhook not enabled for flow', {
        flowId: flow.id,
        flowName: flow.name,
        clientIp
      });
      throw new AppError(403, 'Webhook is not enabled for this flow');
    }

    // 3. Check if flow is active
    if (!flow.isActive) {
      logger.warn('Webhook: Flow is not active', {
        flowId: flow.id,
        flowName: flow.name,
        clientIp
      });
      throw new AppError(403, 'Flow is not active. Please activate it before triggering via webhook.');
    }

    // 4. Validate webhook secret
    if (!validateWebhookSecret(req, flow)) {
      logger.warn('Webhook: Invalid secret', {
        flowId: flow.id,
        flowName: flow.name,
        clientIp,
        hasSecretHeader: !!req.header('X-Webhook-Secret'),
        hasAuthHeader: !!req.header('Authorization')
      });
      throw new AppError(401, 'Invalid webhook secret');
    }

    // 5. Prepare trigger data
    const triggerData = {
      source: 'webhook',
      clientIp,
      userAgent,
      timestamp: new Date().toISOString(),
      headers: {
        'content-type': req.header('Content-Type'),
        'x-request-id': req.header('X-Request-Id'),
      },
      metadata: body.metadata
    };

    logger.info('Webhook: Starting flow execution', {
      flowId: flow.id,
      flowName: flow.name,
      clientIp,
      waitForCompletion: body.waitForCompletion
    });

    // 6. Start the flow execution
    if (body.waitForCompletion) {
      // Synchronous mode - wait for completion
      try {
        const result = await Promise.race([
          flowExecutionService.startExecution({
            flowId: flow.id,
            input: body.input,
            triggeredBy: 'webhook',
            triggerData
          }),
          new Promise<FlowExecutionResult>((_, reject) => {
            setTimeout(() => reject(new Error('Webhook timeout')), body.timeout);
          })
        ]);

        logger.info('Webhook: Flow execution completed', {
          flowId: flow.id,
          executionId: result.executionId,
          success: result.success,
          executionTime: result.executionTime,
          clientIp
        });

        res.json({
          success: result.success,
          executionId: result.executionId,
          status: result.status,
          output: result.output,
          error: result.error,
          executionTime: result.executionTime,
          tokensUsed: result.tokensUsed,
          cost: result.cost
        });

      } catch (error) {
        if (error instanceof Error && error.message === 'Webhook timeout') {
          logger.warn('Webhook: Execution timeout', {
            flowId: flow.id,
            timeout: body.timeout,
            clientIp
          });
          throw new AppError(504, `Flow execution timed out after ${body.timeout}ms`);
        }
        throw error;
      }

    } else {
      // Asynchronous mode - return immediately
      // Start execution in background
      flowExecutionService.startExecution({
        flowId: flow.id,
        input: body.input,
        triggeredBy: 'webhook',
        triggerData
      }).then(result => {
        logger.info('Webhook: Background execution completed', {
          flowId: flow.id,
          executionId: result.executionId,
          success: result.success,
          clientIp
        });
      }).catch(error => {
        logger.error('Webhook: Background execution failed', error as Error, {
          flowId: flow.id,
          clientIp
        });
      });

      // Generate execution ID for tracking
      // Note: The actual execution ID will be created by flowExecutionService
      // We return a placeholder message
      res.status(202).json({
        success: true,
        message: `Flow "${flow.name}" execution started`,
        flowId: flow.id,
        flowName: flow.name,
        triggeredAt: new Date().toISOString(),
        statusUrl: `/api/flows/${flow.id}/executions`
      });
    }
  }));

  // ============= WEBHOOK INFO ENDPOINT =============

  /**
   * GET /api/webhooks/flows/:identifier/info
   * Get webhook configuration info for a flow
   *
   * Useful for debugging and verifying webhook setup
   */
  router.get('/flows/:identifier/info', asyncHandler(async (req: Request, res: Response) => {
    const { identifier } = webhookIdentifierSchema.parse(req.params);

    logger.debug('Webhook info requested', { identifier });

    const flow = await findFlowByIdentifier(identifier);

    if (!flow) {
      throw new AppError(404, 'Flow not found');
    }

    // Return webhook configuration (without exposing the secret)
    res.json({
      flowId: flow.id,
      flowName: flow.name,
      flowSlug: flow.slug,
      webhookEnabled: flow.webhookEnabled,
      hasWebhookSecret: !!flow.webhookSecret,
      isActive: flow.isActive,
      status: flow.status,
      category: flow.category,
      webhookUrl: `/api/webhooks/flows/${flow.slug}`,
      alternativeUrl: `/api/webhooks/flows/${flow.id}`,
      inputSchema: flow.inputSchema,
      usage: {
        method: 'POST',
        contentType: 'application/json',
        headers: flow.webhookSecret ? {
          'X-Webhook-Secret': '<your-secret>',
          'OR Authorization': 'Bearer <your-secret>'
        } : {},
        body: {
          input: '{ "fieldName": "value" }',
          waitForCompletion: 'boolean (optional, default: false)',
          timeout: 'number (optional, default: 60000ms)',
          metadata: '{ ... } (optional)'
        }
      }
    });
  }));

  // ============= WEBHOOK TEST ENDPOINT =============

  /**
   * POST /api/webhooks/flows/:identifier/test
   * Test webhook configuration without executing the flow
   *
   * Returns authentication status and input validation results
   */
  router.post('/flows/:identifier/test', asyncHandler(async (req: Request, res: Response) => {
    const { identifier } = webhookIdentifierSchema.parse(req.params);
    const body = webhookBodySchema.parse(req.body);

    const clientIp = getClientIp(req);

    logger.info('Webhook test requested', { identifier, clientIp });

    const flow = await findFlowByIdentifier(identifier);

    if (!flow) {
      throw new AppError(404, 'Flow not found');
    }

    // Test results
    const results = {
      flowFound: true,
      flowId: flow.id,
      flowName: flow.name,
      webhookEnabled: flow.webhookEnabled,
      flowActive: flow.isActive,
      authenticationValid: validateWebhookSecret(req, flow),
      secretRequired: !!flow.webhookSecret,
      inputProvided: Object.keys(body.input).length > 0,
      inputFields: Object.keys(body.input),
      expectedInputFields: flow.inputSchema?.properties ? Object.keys(flow.inputSchema.properties) : [],
      requiredInputFields: flow.inputSchema?.required || [],
      timestamp: new Date().toISOString(),
      clientIp
    };

    // Determine overall test status
    const canExecute = results.webhookEnabled &&
                       results.flowActive &&
                       results.authenticationValid;

    res.json({
      success: canExecute,
      message: canExecute
        ? 'Webhook test passed! The flow can be triggered.'
        : 'Webhook test failed. Check the results for details.',
      results,
      issues: [
        !results.webhookEnabled && 'Webhook is not enabled for this flow',
        !results.flowActive && 'Flow is not active',
        !results.authenticationValid && results.secretRequired && 'Invalid or missing webhook secret'
      ].filter(Boolean)
    });
  }));

  // ============= LIST WEBHOOK-ENABLED FLOWS =============

  /**
   * GET /api/webhooks/flows
   * List all flows that have webhooks enabled
   */
  router.get('/flows', asyncHandler(async (req: Request, res: Response) => {
    logger.debug('Listing webhook-enabled flows');

    // Get all active flows with webhooks enabled
    const allFlows = await strapiClient.getAllFlows({
      filters: {
        webhookEnabled: true
      }
    });

    const webhookFlows = allFlows.map(flow => ({
      id: flow.id,
      name: flow.name,
      slug: flow.slug,
      description: flow.description,
      category: flow.category,
      isActive: flow.isActive,
      status: flow.status,
      hasSecret: !!flow.webhookSecret,
      webhookUrl: `/api/webhooks/flows/${flow.slug}`
    }));

    res.json({
      count: webhookFlows.length,
      flows: webhookFlows
    });
  }));

  return router;
}

// ============= DEFAULT EXPORT =============

export default createWebhookRoutes;
