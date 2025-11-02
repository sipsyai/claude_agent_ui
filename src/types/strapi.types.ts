/**
 * Claude Agent UI - Strapi Response Types
 *
 * This file contains type definitions for Strapi API responses,
 * transformers, and utilities for working with Strapi data structures.
 */

import type {
  Agent,
  Skill,
  MCPServer,
  Task,
  ToolName,
  ClaudeModel,
  MCPTransport,
  TaskStatus,
  SkillCategory,
  MCPRestartPolicy,
} from './agent.types';
import type {
  ToolConfiguration,
  ModelConfiguration,
  Analytics,
  MCPServerSelection,
  SkillSelection,
  TaskSelection,
  MetadataEntry,
  AgentSelection,
  TrainingSession,
  SkillFile,
} from './strapi-components.types';

/**
 * Strapi pagination metadata
 */
export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

/**
 * Strapi metadata wrapper
 */
export interface StrapiMeta {
  pagination?: StrapiPagination;
}

/**
 * Strapi entity attributes wrapper
 */
export interface StrapiAttributes<T> {
  id: number;
  documentId: string;
  attributes: T & {
    createdAt: string;
    updatedAt: string;
    publishedAt?: string | null;
  };
}

/**
 * Strapi single entity response
 */
export interface StrapiData<T> {
  data: StrapiAttributes<T> | null;
  meta?: StrapiMeta;
}

/**
 * Strapi collection response
 */
export interface StrapiResponse<T> {
  data: StrapiAttributes<T>[];
  meta?: StrapiMeta;
}

/**
 * Strapi error details
 */
export interface StrapiError {
  status: number;
  name: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Strapi error response
 */
export interface StrapiErrorResponse {
  data: null;
  error: StrapiError;
}

/**
 * Strapi relation data structure (can be single or multiple)
 */
export interface StrapiRelation<T> {
  data: StrapiAttributes<T>[] | StrapiAttributes<T> | null;
}

/**
 * Agent attributes as stored in Strapi
 *
 * Updated to match Strapi 5 component-based structure.
 */
export interface StrapiAgentAttributes {
  name: string;
  slug: string;
  description?: string | null;
  systemPrompt: string;
  enabled: boolean;

  // Component fields
  toolConfig?: ToolConfiguration;
  modelConfig: ModelConfiguration;
  analytics?: Analytics;
  metadata?: MetadataEntry[];

  // Component-based relations
  mcpConfig?: MCPServerSelection[];
  skillSelection?: SkillSelection[];
  tasks?: TaskSelection[];
}

/**
 * Skill attributes as stored in Strapi
 *
 * Updated to match Strapi 5 component-based structure.
 */
export interface StrapiSkillAttributes {
  name: string;
  displayName: string;
  description: string;
  skillmd: string; // Correct field name (NOT 'content')
  skillConfig?: string | null; // Configuration text added at top of system prompt
  experienceScore: number;
  category: SkillCategory;
  isPublic: boolean;
  version: string;
  license?: string | null;

  // Component fields
  trainingHistory?: TrainingSession[];
  additionalFiles?: SkillFile[];
  agentSelection?: AgentSelection[];
  toolConfig?: ToolConfiguration;
  modelConfig?: ModelConfiguration;
  analytics?: Analytics;
  mcpConfig?: MCPServerSelection[];
  tasks?: TaskSelection[];

  // Direct relation (not component-based)
  trainingAgent?: StrapiRelation<StrapiAgentAttributes>;
}

/**
 * MCP Server attributes as stored in Strapi
 */
export interface StrapiMCPServerAttributes {
  name: string;
  description?: string | null;
  command: string;
  args: string[];
  env: Record<string, string>;
  disabled: boolean;
  transport: MCPTransport;
  healthCheckUrl?: string | null;
  isHealthy: boolean;
  lastHealthCheck?: string | null;
  startupTimeout: number;
  restartPolicy: MCPRestartPolicy;
  agents?: StrapiRelation<StrapiAgentAttributes>;
}

/**
 * Task attributes as stored in Strapi
 */
export interface StrapiTaskAttributes {
  message: string;
  status: TaskStatus;
  result?: any;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  executionTime?: number | null;
  tokensUsed: number;
  cost: number;
  metadata?: Record<string, any>;
  agent?: StrapiRelation<StrapiAgentAttributes>;
}

// Type aliases for complete Strapi responses
export type StrapiAgentResponse = StrapiResponse<StrapiAgentAttributes>;
export type StrapiAgentData = StrapiData<StrapiAgentAttributes>;
export type StrapiSkillResponse = StrapiResponse<StrapiSkillAttributes>;
export type StrapiSkillData = StrapiData<StrapiSkillAttributes>;
export type StrapiMCPServerResponse = StrapiResponse<StrapiMCPServerAttributes>;
export type StrapiMCPServerData = StrapiData<StrapiMCPServerAttributes>;
export type StrapiTaskResponse = StrapiResponse<StrapiTaskAttributes>;
export type StrapiTaskData = StrapiData<StrapiTaskAttributes>;

/**
 * Type for transformation functions from Strapi to domain models
 */
export type StrapiTransformer<TStrapiAttr, TDomain> = (
  data: StrapiAttributes<TStrapiAttr>
) => TDomain;

/**
 * Type for transformation functions from domain to Strapi
 */
export type DomainTransformer<TDomain, TStrapiAttr> = (
  data: Partial<TDomain>
) => Partial<TStrapiAttr>;

/**
 * Bidirectional transformer interface
 */
export interface BidirectionalTransformer<TStrapiAttr, TDomain> {
  toStrapi: DomainTransformer<TDomain, TStrapiAttr>;
  fromStrapi: StrapiTransformer<TStrapiAttr, TDomain>;
}

/**
 * Helper type to extract relation IDs from Strapi relation
 */
export type ExtractRelationIds<T> = T extends StrapiRelation<any>
  ? string[]
  : never;

/**
 * Strapi query filters
 */
export interface StrapiFilters {
  [key: string]: any;
  $and?: StrapiFilters[];
  $or?: StrapiFilters[];
  $not?: StrapiFilters;
  $eq?: any;
  $ne?: any;
  $in?: any[];
  $notIn?: any[];
  $lt?: number | string;
  $lte?: number | string;
  $gt?: number | string;
  $gte?: number | string;
  $contains?: string;
  $notContains?: string;
  $containsi?: string;
  $notContainsi?: string;
  $startsWith?: string;
  $endsWith?: string;
  $null?: boolean;
  $notNull?: boolean;
}

/**
 * Strapi query sort options
 */
export type StrapiSort = string | string[];

/**
 * Strapi query populate options
 */
export type StrapiPopulate = string | string[] | Record<string, any>;

/**
 * Strapi query parameters
 */
export interface StrapiQueryParams {
  filters?: StrapiFilters;
  sort?: StrapiSort;
  populate?: StrapiPopulate;
  fields?: string[];
  pagination?: {
    page?: number;
    pageSize?: number;
    start?: number;
    limit?: number;
    withCount?: boolean;
  };
  publicationState?: 'live' | 'preview';
  locale?: string;
}

/**
 * Strapi create/update request body wrapper
 */
export interface StrapiRequestBody<T> {
  data: T;
}

/**
 * Utility type to make Strapi dates into JS Dates
 */
export type ParseDates<T> = {
  [K in keyof T]: T[K] extends string
    ? K extends `${string}At` | `${string}Date`
      ? Date
      : T[K]
    : T[K] extends object
    ? ParseDates<T[K]>
    : T[K];
};
