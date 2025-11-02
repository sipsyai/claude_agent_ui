/**
 * Task Request Validation Schemas
 *
 * Zod validation schemas for Task CRUD operations
 */

import { z } from 'zod';

/**
 * Task status enum
 */
export const TaskStatusEnum = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

/**
 * Create Task validation schema
 * Based on CreateTaskDTO which only requires agentId, message, and metadata
 */
export const createTaskSchema = z.object({
  agentId: z.string()
    .min(1, 'Agent ID is required'),

  message: z.string()
    .min(1, 'Message is required'),

  metadata: z.record(z.any())
    .optional()
});

/**
 * Update Task validation schema
 * Based on UpdateTaskDTO which has specific updatable fields
 */
export const updateTaskSchema = z.object({
  status: TaskStatusEnum.optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  completedAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  executionTime: z.number().optional(),
  tokensUsed: z.number().optional(),
  cost: z.number().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * Task query parameters schema
 */
export const taskQuerySchema = z.object({
  status: TaskStatusEnum
    .optional(),

  agentId: z.string()
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
    .default('20')
    .transform(val => parseInt(val, 10))
    .refine(val => val <= 100, 'Page size cannot exceed 100')
});

/**
 * Task ID parameter validation
 */
export const taskIdSchema = z.object({
  id: z.string()
    .min(1, 'Task ID is required')
});

// Export types
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type TaskIdParam = z.infer<typeof taskIdSchema>;
