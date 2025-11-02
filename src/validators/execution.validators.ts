/**
 * Execution Request Validation Schemas
 *
 * Zod validation schemas for Agent execution operations
 */

import { z } from 'zod';

/**
 * Execute Agent validation schema
 */
export const executeAgentSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(10000, 'Message must be less than 10,000 characters'),

  conversationId: z.string()
    .optional(),

  context: z.record(z.any())
    .optional()
    .default({}),

  maxTokens: z.number()
    .min(1, 'Max tokens must be at least 1')
    .max(8192, 'Max tokens cannot exceed 8192')
    .optional()
    .default(4096),

  temperature: z.number()
    .min(0, 'Temperature must be between 0 and 1')
    .max(1, 'Temperature must be between 0 and 1')
    .optional()
    .default(0.7),

  stream: z.boolean()
    .optional()
    .default(true)
});

/**
 * Agent ID parameter validation
 */
export const executeAgentIdSchema = z.object({
  id: z.string()
    .min(1, 'Agent ID is required')
});

/**
 * Conversation ID parameter validation
 */
export const conversationIdSchema = z.object({
  id: z.string()
    .min(1, 'Conversation ID is required')
});

// Export types
export type ExecuteAgentInput = z.infer<typeof executeAgentSchema>;
export type ExecuteAgentIdParam = z.infer<typeof executeAgentIdSchema>;
export type ConversationIdParam = z.infer<typeof conversationIdSchema>;
