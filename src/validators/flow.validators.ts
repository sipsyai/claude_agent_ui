/**
 * Flow Request Validation Schemas
 *
 * Zod validation schemas for Flow and Flow Execution operations
 */

import { z } from 'zod';

// ============= FLOW SCHEMAS =============

/**
 * Flow ID parameter validation
 */
export const flowIdSchema = z.object({
  id: z.string()
    .min(1, 'Flow ID is required')
});

/**
 * Execution ID parameter validation
 */
export const executionIdSchema = z.object({
  id: z.string()
    .min(1, 'Execution ID is required')
});

/**
 * Flow query parameters validation
 */
export const flowQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).max(100).optional().default(25),
  search: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  category: z.enum(['web-scraping', 'data-processing', 'api-integration', 'file-manipulation', 'automation', 'custom']).optional(),
  isActive: z.coerce.boolean().optional(),
  sort: z.string().optional().default('updatedAt:desc')
});

/**
 * Create flow validation schema
 */
export const createFlowSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),

  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),

  nodes: z.array(z.any())
    .optional()
    .default([]),

  status: z.enum(['draft', 'active', 'paused', 'archived'])
    .optional()
    .default('draft'),

  inputSchema: z.object({
    properties: z.record(z.any()).optional().default({}),
    required: z.array(z.string()).optional().default([])
  }).optional().default({ properties: {}, required: [] }),

  outputSchema: z.object({
    properties: z.record(z.any()).optional().default({})
  }).optional().default({ properties: {} }),

  isActive: z.boolean()
    .optional()
    .default(false),

  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)')
    .optional()
    .default('1.0.0'),

  category: z.enum(['web-scraping', 'data-processing', 'api-integration', 'file-manipulation', 'automation', 'custom'])
    .optional()
    .default('custom'),

  metadata: z.record(z.any())
    .optional()
});

/**
 * Update flow validation schema
 */
export const updateFlowSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),

  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),

  nodes: z.array(z.any())
    .optional(),

  status: z.enum(['draft', 'active', 'paused', 'archived'])
    .optional(),

  inputSchema: z.object({
    properties: z.record(z.any()),
    required: z.array(z.string()).optional()
  }).optional(),

  outputSchema: z.object({
    properties: z.record(z.any())
  }).optional(),

  isActive: z.boolean()
    .optional(),

  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)')
    .optional(),

  category: z.enum(['web-scraping', 'data-processing', 'api-integration', 'file-manipulation', 'automation', 'custom'])
    .optional(),

  metadata: z.record(z.any())
    .optional()
});

// ============= FLOW EXECUTION SCHEMAS =============

/**
 * Start flow execution validation schema
 */
export const startFlowExecutionSchema = z.object({
  input: z.record(z.any())
    .optional()
    .default({}),

  triggeredBy: z.enum(['manual', 'schedule', 'webhook', 'api'])
    .optional()
    .default('manual'),

  triggerData: z.record(z.any())
    .optional(),

  waitForCompletion: z.boolean()
    .optional()
    .default(false)
});

/**
 * Flow execution query parameters validation
 */
export const executionQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).max(100).optional().default(25),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  triggeredBy: z.enum(['manual', 'schedule', 'webhook', 'api']).optional(),
  sort: z.string().optional().default('createdAt:desc')
});

// ============= TYPE EXPORTS =============

export type FlowIdParam = z.infer<typeof flowIdSchema>;
export type ExecutionIdParam = z.infer<typeof executionIdSchema>;
export type FlowQueryParams = z.infer<typeof flowQuerySchema>;
export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type StartFlowExecutionInput = z.infer<typeof startFlowExecutionSchema>;
export type ExecutionQueryParams = z.infer<typeof executionQuerySchema>;
