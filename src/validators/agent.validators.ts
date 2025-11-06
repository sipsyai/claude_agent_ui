/**
 * Agent Request Validation Schemas
 *
 * Zod validation schemas for Agent CRUD operations
 */

import { z } from 'zod';

/**
 * Model options
 */
export const ModelEnum = z.enum(['sonnet', 'opus', 'haiku', 'sonnet-4', 'opus-4']);

/**
 * Create Agent validation schema
 */
export const createAgentSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),

  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .default(''),

  systemPrompt: z.string()
    .min(10, 'System prompt must be at least 10 characters'),

  tools: z.array(z.string() as z.ZodType<any>)
    .optional(),

  disallowedTools: z.array(z.string() as z.ZodType<any>)
    .optional(),

  model: ModelEnum
    .optional()
    .default('sonnet'),

  enabled: z.boolean()
    .optional()
    .default(true),

  metadata: z.record(z.any())
    .optional()
    .default({}),

  mcpTools: z.record(z.string(), z.array(z.string()))
    .optional(),

  mcpServers: z.array(z.string())
    .optional()
    .default([]),

  skills: z.array(z.string())
    .optional()
    .default([])
});

/**
 * Update Agent validation schema
 * All fields are optional for partial updates
 */
export const updateAgentSchema = createAgentSchema.partial();

/**
 * Agent query parameters schema
 */
export const agentQuerySchema = z.object({
  enabled: z.enum(['true', 'false'])
    .optional()
    .transform(val => val === undefined ? undefined : val === 'true'),

  search: z.string()
    .optional(),

  sort: z.string()
    .optional()
    .default('createdAt:desc'),

  page: z.string()
    .optional()
    .default('1')
    .transform(val => parseInt(val, 10)),

  pageSize: z.string()
    .optional()
    .default('20')
    .transform(val => parseInt(val, 10))
    .refine(val => val <= 100, 'Page size cannot exceed 100')
});

/**
 * Agent ID parameter validation
 */
export const agentIdSchema = z.object({
  id: z.string()
    .min(1, 'Agent ID is required')
});

// Export types
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type AgentQuery = z.infer<typeof agentQuerySchema>;
export type AgentIdParam = z.infer<typeof agentIdSchema>;
