/**
 * Skill Request Validation Schemas
 *
 * Zod validation schemas for Skill CRUD operations
 */

import { z } from 'zod';

/**
 * Create Skill validation schema
 */
export const createSkillSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),

  displayName: z.string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters'),

  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),

  skillmd: z.string()
    .min(50, 'Skill instructions must be at least 50 characters'),

  allowedTools: z.array(z.string() as z.ZodType<any>)
    .optional(),

  mcpTools: z.record(z.string(), z.array(z.string()))
    .optional(),

  experienceScore: z.number()
    .min(0, 'Experience score cannot be negative')
    .max(100, 'Experience score cannot exceed 100')
    .optional()
    .default(0),

  // Phase 1: New metadata fields
  category: z.enum([
    'general-purpose',
    'code-analysis',
    'data-processing',
    'web-scraping',
    'file-manipulation',
    'api-integration',
    'browser-automation',
    'testing',
    'custom'
  ])
    .optional()
    .default('custom'),

  isPublic: z.boolean()
    .optional()
    .default(true),

  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)')
    .optional()
    .default('1.0.0'),

  license: z.string()
    .max(100, 'License must be less than 100 characters')
    .optional(),

  // Input fields component
  inputFields: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'textarea', 'dropdown', 'multiselect', 'checkbox', 'number', 'filepath']),
    label: z.string(),
    description: z.string().nullish(),
    placeholder: z.string().nullish(),
    required: z.boolean().optional().default(false),
    options: z.array(z.string()).nullish(),
    default: z.any().nullish(),
  }))
    .optional(),

  // Phase 2: Model configuration
  modelConfig: z.object({
    model: z.enum(['haiku', 'sonnet', 'sonnet-4', 'opus', 'opus-4']),
    temperature: z.number()
      .min(0.0, 'Temperature must be at least 0.0')
      .max(1.0, 'Temperature cannot exceed 1.0')
      .optional(),
    maxTokens: z.number()
      .min(1, 'Max tokens must be at least 1')
      .max(200000, 'Max tokens cannot exceed 200000')
      .optional(),
    timeout: z.number()
      .min(1000, 'Timeout must be at least 1000ms')
      .optional(),
    stopSequences: z.array(z.string()).optional(),
    topP: z.number()
      .min(0.0, 'Top P must be at least 0.0')
      .max(1.0, 'Top P cannot exceed 1.0')
      .optional(),
    topK: z.number()
      .min(0, 'Top K must be at least 0')
      .optional(),
  })
    .optional(),

  // Phase 2: Disallowed tools
  disallowedTools: z.array(z.string() as z.ZodType<any>)
    .optional(),

  // Phase 3: Additional files
  additionalFiles: z.array(z.object({
    fileId: z.string()
      .min(1, 'File ID is required'),
    fileType: z.enum([
      'REFERENCE',
      'EXAMPLES',
      'TROUBLESHOOTING',
      'CHANGELOG',
      'FAQ',
      'API_DOCS',
      'TUTORIAL',
      'CUSTOM'
    ]),
    description: z.string()
      .max(500, 'Description must be less than 500 characters')
      .optional(),
    displayOrder: z.number()
      .min(0, 'Display order cannot be negative')
  }))
    .optional()
});

/**
 * Update Skill validation schema
 * All fields are optional for partial updates
 */
export const updateSkillSchema = createSkillSchema.partial();

/**
 * Skill query parameters schema
 */
export const skillQuerySchema = z.object({
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
 * Skill ID parameter validation
 */
export const skillIdSchema = z.object({
  id: z.string()
    .min(1, 'Skill ID is required')
});

// Export types
export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
export type SkillQuery = z.infer<typeof skillQuerySchema>;
export type SkillIdParam = z.infer<typeof skillIdSchema>;
