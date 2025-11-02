/**
 * MCP Server Request Validation Schemas
 *
 * Zod validation schemas for MCP Server CRUD operations
 */

import { z } from 'zod';

/**
 * Transport type enum
 */
export const TransportEnum = z.enum(['stdio', 'sse']);

/**
 * Create MCP Server validation schema
 */
export const createMCPServerSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),

  command: z.string()
    .min(1, 'Command is required'),

  args: z.array(z.string())
    .optional()
    .default([]),

  env: z.record(z.string())
    .optional()
    .default({}),

  disabled: z.boolean()
    .optional()
    .default(false),

  transport: TransportEnum
    .optional()
    .default('stdio')
});

/**
 * Update MCP Server validation schema
 * All fields are optional for partial updates
 */
export const updateMCPServerSchema = createMCPServerSchema.partial();

/**
 * MCP Server query parameters schema
 */
export const mcpServerQuerySchema = z.object({
  disabled: z.enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),

  transport: TransportEnum
    .optional(),

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
    .default('50')
    .transform(val => parseInt(val, 10))
    .refine(val => val <= 100, 'Page size cannot exceed 100')
});

/**
 * MCP Server ID parameter validation
 */
export const mcpServerIdSchema = z.object({
  id: z.string()
    .min(1, 'MCP Server ID is required')
});

// Export types
export type CreateMCPServerInput = z.infer<typeof createMCPServerSchema>;
export type UpdateMCPServerInput = z.infer<typeof updateMCPServerSchema>;
export type MCPServerQuery = z.infer<typeof mcpServerQuerySchema>;
export type MCPServerIdParam = z.infer<typeof mcpServerIdSchema>;
