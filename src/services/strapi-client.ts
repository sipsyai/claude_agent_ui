/**
 * Claude Agent UI - Strapi Client Service
 *
 * This service provides a data access layer for interacting with the Strapi CMS API.
 * It handles HTTP communication, caching, and data transformation between Strapi's
 * response format and the application's domain models.
 *
 * Features:
 * - HTTP client with axios
 * - LRU cache with 5-minute TTL
 * - Request/response interceptors for logging
 * - Automatic data transformation
 * - Cache invalidation on mutations
 * - Error handling with detailed logging
 * - Support for populate, filters, sort, pagination
 * - Health check endpoint
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { LRUCache } from 'lru-cache';
import type {
  Agent,
  Skill,
  MCPServer,
  MCPTool,
  Task,
  StrapiAttributes,
  StrapiResponse,
  StrapiData,
  StrapiQueryParams,
  CreateAgentDTO,
  UpdateAgentDTO,
  CreateSkillDTO,
  UpdateSkillDTO,
  CreateMCPServerDTO,
  UpdateMCPServerDTO,
  CreateTaskDTO,
  UpdateTaskDTO,
} from '../types/index.js';
import type {
  Flow,
  FlowExecution,
  FlowExecutionStatus,
  FlowTriggerType,
  FlowStatus,
  FlowCategory,
  FlowStats,
  GlobalFlowStats,
  FlowNode,
  FlowInputSchema,
  FlowOutputSchema,
  FlowSchedule,
  NodeExecution,
  FlowExecutionLog,
} from '../types/flow-types.js';

// ============= HELPER FUNCTIONS =============

/**
 * Generate a URL-friendly slug from a string
 * @param text - Input text to slugify
 * @returns Slugified string (lowercase, hyphens, no special chars)
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

// ============= CONFIGURATION =============

/**
 * Strapi API base URL
 * @description Configure via STRAPI_URL environment variable
 * @default 'http://localhost:1337'
 * @example
 * // In .env file:
 * STRAPI_URL=https://cms.example.com
 */
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

/**
 * Strapi API authentication token
 * @description Configure via STRAPI_API_TOKEN environment variable.
 * Generate tokens in Strapi Admin Panel: Settings > API Tokens > Create new API Token
 * @required Required for all API requests
 * @example
 * // In .env file:
 * STRAPI_API_TOKEN=your_strapi_api_token_here
 */
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

/**
 * Cache Time-To-Live (TTL) in milliseconds
 * @description How long cache entries remain valid before automatic expiration.
 * Cache entries are refreshed on access (updateAgeOnGet: true)
 * @default 300000 (5 minutes)
 */
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Maximum number of cache entries
 * @description LRU cache evicts least recently used entries when limit is reached
 * @default 100
 */
const CACHE_MAX_SIZE = 100;

// ============= STRAPI CLIENT CLASS =============

/**
 * StrapiClient - Singleton service for Strapi API interactions
 *
 * @description
 * The StrapiClient provides a robust data access layer for the Strapi CMS API, handling
 * all HTTP communication, caching, and data transformation between Strapi's response format
 * and the application's domain models. It implements the singleton pattern to ensure a single
 * shared instance with consistent caching across the application.
 *
 * **Key Features:**
 * - HTTP client with axios and Bearer token authentication
 * - LRU cache with 5-minute TTL and automatic cache invalidation on mutations
 * - Request/response interceptors for logging and error handling
 * - Automatic data transformation between Strapi format and domain models
 * - Support for Strapi v5 features (populate, filters, sort, pagination, components)
 * - Health check endpoint for API availability monitoring
 * - CRUD operations for Agents, Skills, MCP Servers, MCP Tools, Tasks, Flows
 * - File upload/delete operations
 * - Cache management utilities
 *
 * **Environment Variables:**
 * - `STRAPI_URL`: Base URL for Strapi API (default: 'http://localhost:1337')
 * - `STRAPI_API_TOKEN`: Bearer token for API authentication (required)
 *
 * **Cache Configuration:**
 * - TTL: 5 minutes (300000ms) with refresh on access
 * - Max Size: 100 entries (LRU eviction)
 * - Automatic invalidation on mutations (create/update/delete)
 * - Manual cache management via clearCache() and getCacheStats()
 *
 * @example
 * // Basic usage - use the singleton instance
 * import { strapiClient } from './strapi-client';
 *
 * // Check API health
 * const isHealthy = await strapiClient.healthCheck();
 *
 * // Fetch all agents
 * const agents = await strapiClient.getAllAgents();
 *
 * @example
 * // Advanced filtering and population
 * import { strapiClient } from './strapi-client';
 *
 * // Get agents with custom filters and populated relations
 * const activeAgents = await strapiClient.getAllAgents({
 *   filters: { enabled: true },
 *   populate: ['mcpConfig', 'skillSelection', 'tasks'],
 *   sort: ['name:asc'],
 *   pagination: { page: 1, pageSize: 10 }
 * });
 *
 * // Get a single agent with all relations populated
 * const agent = await strapiClient.getAgent('agent-id');
 * console.log(agent.mcpConfig); // Populated component data
 *
 * @example
 * // CRUD operations
 * import { strapiClient } from './strapi-client';
 *
 * // Create a new agent
 * const newAgent = await strapiClient.createAgent({
 *   name: 'Code Assistant',
 *   description: 'Helps with coding tasks',
 *   systemPrompt: 'You are a helpful coding assistant.',
 *   enabled: true,
 *   modelConfig: {
 *     model: 'sonnet',
 *     temperature: 1.0,
 *     timeout: 300000
 *   }
 * });
 *
 * // Update the agent
 * const updatedAgent = await strapiClient.updateAgent(newAgent.id, {
 *   description: 'Updated description'
 * });
 *
 * // Delete the agent
 * await strapiClient.deleteAgent(newAgent.id);
 *
 * @example
 * // Cache management
 * import { strapiClient } from './strapi-client';
 *
 * // Get cache statistics
 * const stats = strapiClient.getCacheStats();
 * console.log(`Cache: ${stats.size}/${stats.max} entries, TTL: ${stats.ttl}ms`);
 *
 * // Clear all cache entries
 * strapiClient.clearCache();
 *
 * @example
 * // File upload workflow
 * import { strapiClient } from './strapi-client';
 * import fs from 'fs';
 *
 * // Upload a file
 * const fileBuffer = fs.readFileSync('./example.pdf');
 * const uploadedFile = await strapiClient.uploadFile(fileBuffer, 'example.pdf');
 * console.log(`File uploaded: ${uploadedFile.url}`);
 *
 * // Use the file in a skill's additionalFiles
 * const skill = await strapiClient.createSkill({
 *   name: 'example-skill',
 *   displayName: 'Example Skill',
 *   description: 'A skill with an additional file',
 *   skillmd: '# Skill content',
 *   additionalFiles: [
 *     { file: uploadedFile.documentId }
 *   ]
 * });
 *
 * // Delete the file when no longer needed
 * await strapiClient.deleteFile(uploadedFile.documentId);
 *
 * @see {@link https://docs.strapi.io/dev-docs/api/rest|Strapi REST API Documentation}
 * @see {@link https://github.com/isaacs/node-lru-cache|LRU Cache Documentation}
 */
export class StrapiClient {
  /** Axios HTTP client instance configured with base URL and authentication */
  private client: AxiosInstance;

  /** LRU cache for GET responses with 5-minute TTL and 100-entry limit */
  private cache: LRUCache<string, any>;

  constructor() {
    // Initialize axios client with base configuration
    this.client = axios.create({
      baseURL: `${STRAPI_URL}/api`,
      headers: {
        'Authorization': STRAPI_API_TOKEN ? `Bearer ${STRAPI_API_TOKEN}` : '',
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds
    });

    // Initialize LRU cache
    this.cache = new LRUCache({
      max: CACHE_MAX_SIZE,
      ttl: CACHE_TTL,
      updateAgeOnGet: true, // Refresh TTL on access
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config: any) => {
        console.log(`[Strapi] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: any) => {
        console.error('[Strapi] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: AxiosError) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  // ============= HEALTH CHECK =============

  /**
   * Check if Strapi API is accessible and responding
   *
   * @description
   * Performs a health check by making a request to the Strapi API root endpoint.
   * Use this method to verify API connectivity before performing operations, especially
   * during application startup or when debugging connection issues.
   *
   * **Use Cases:**
   * - Application startup validation
   * - Periodic monitoring of Strapi availability
   * - Pre-flight checks before critical operations
   * - Debugging connection issues (CORS, network, authentication)
   *
   * **What This Checks:**
   * - Network connectivity to Strapi server
   * - Strapi server is running and responding
   * - API token authentication is valid (if configured)
   * - No CORS issues (for browser environments)
   *
   * @returns {Promise<boolean>} `true` if Strapi API is accessible and healthy, `false` if check fails
   *
   * @example
   * // Basic health check
   * const isHealthy = await strapiClient.healthCheck();
   *
   * if (isHealthy) {
   *   console.log('Strapi API is healthy');
   * } else {
   *   console.error('Strapi API is unavailable');
   * }
   *
   * @example
   * // Application startup validation
   * async function initializeApp() {
   *   console.log('Checking Strapi connection...');
   *
   *   const isHealthy = await strapiClient.healthCheck();
   *
   *   if (!isHealthy) {
   *     console.error('ERROR: Cannot connect to Strapi API');
   *     console.error(`STRAPI_URL: ${process.env.STRAPI_URL || 'http://localhost:1337'}`);
   *     console.error('Please ensure Strapi is running and STRAPI_URL is correct');
   *     process.exit(1);
   *   }
   *
   *   console.log('Strapi connection successful');
   *   // Continue with app initialization
   * }
   *
   * @example
   * // Retry logic with health check
   * async function connectWithRetry(maxRetries = 3) {
   *   for (let i = 0; i < maxRetries; i++) {
   *     const isHealthy = await strapiClient.healthCheck();
   *
   *     if (isHealthy) {
   *       console.log('Connected to Strapi');
   *       return true;
   *     }
   *
   *     console.warn(`Connection attempt ${i + 1}/${maxRetries} failed`);
   *
   *     if (i < maxRetries - 1) {
   *       await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
   *     }
   *   }
   *
   *   console.error('Failed to connect to Strapi after retries');
   *   return false;
   * }
   *
   * @example
   * // Periodic health monitoring
   * setInterval(async () => {
   *   const isHealthy = await strapiClient.healthCheck();
   *
   *   if (!isHealthy) {
   *     console.error('[Monitor] Strapi API is down!');
   *     // Send alert, update status indicator, etc.
   *   }
   * }, 60000); // Check every minute
   *
   * @example
   * // Pre-flight check before critical operation
   * async function syncAllData() {
   *   // Check API health before starting sync
   *   if (!await strapiClient.healthCheck()) {
   *     throw new Error('Cannot sync: Strapi API is unavailable');
   *   }
   *
   *   // Proceed with sync
   *   const agents = await strapiClient.getAllAgents();
   *   const skills = await strapiClient.getAllSkills();
   *   // ... sync logic
   * }
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/');
      console.log('[Strapi] Health check passed');
      return true;
    } catch (error) {
      console.error('[Strapi] Health check failed:', error);
      return false;
    }
  }

  // ============= AGENTS =============

  /**
   * Get all agents with optional filtering, sorting, and pagination
   *
   * @description
   * Retrieves all agents from Strapi with support for advanced query features including
   * filtering, sorting, pagination, and relation population. Results are cached with 5-minute
   * TTL for improved performance on repeated queries.
   *
   * **Strapi v5 Component Support:**
   * Agents use component-based architecture. The following component fields are available:
   * - `toolConfig`: Tool configuration component (file_search, text_editor, computer_20241022, bash_20241022)
   * - `modelConfig`: Model configuration component (model, temperature, timeout, etc.)
   * - `analytics`: Analytics component (usage stats, performance metrics)
   * - `metadata`: Key-value metadata pairs
   * - `mcpConfig`: MCP server configuration components (array of mcpServer + selectedTools)
   * - `skillSelection`: Skill selection components (array of skill references)
   * - `tasks`: Task assignment components (array of task references)
   *
   * @param {Object} [options] - Query options for filtering, sorting, and pagination
   * @param {string[] | Record<string, any>} [options.populate] - Relations/components to populate (e.g., ['mcpConfig', 'skillSelection'])
   * @param {Record<string, any>} [options.filters] - Strapi v5 filters object (supports $eq, $ne, $in, $notIn, $lt, $lte, $gt, $gte, $contains, $notContains, $containsi, $notContainsi, $null, $notNull, $between, $startsWith, $endsWith, $or, $and, $not)
   * @param {string[]} [options.sort] - Sort order array (e.g., ['name:asc', 'createdAt:desc'])
   * @param {Object} [options.pagination] - Pagination configuration
   * @param {number} [options.pagination.page] - Page number (1-indexed)
   * @param {number} [options.pagination.pageSize] - Number of items per page
   *
   * @returns {Promise<Agent[]>} Array of Agent objects with populated component fields
   *
   * @example
   * // Basic usage - get all agents
   * const agents = await strapiClient.getAllAgents();
   * console.log(`Found ${agents.length} agents`);
   *
   * @example
   * // Filter enabled agents only
   * const enabledAgents = await strapiClient.getAllAgents({
   *   filters: { enabled: { $eq: true } }
   * });
   *
   * @example
   * // Advanced filtering with multiple conditions
   * const filteredAgents = await strapiClient.getAllAgents({
   *   filters: {
   *     $and: [
   *       { enabled: { $eq: true } },
   *       { name: { $containsi: 'assistant' } }, // Case-insensitive contains
   *       { createdAt: { $gte: '2024-01-01T00:00:00.000Z' } }
   *     ]
   *   },
   *   sort: ['name:asc'],
   *   pagination: { page: 1, pageSize: 10 }
   * });
   *
   * @example
   * // Populate component relations to access nested data
   * const agentsWithRelations = await strapiClient.getAllAgents({
   *   populate: ['mcpConfig', 'skillSelection', 'tasks'],
   *   filters: { enabled: true }
   * });
   *
   * // Access populated component data
   * agentsWithRelations.forEach(agent => {
   *   console.log(`Agent: ${agent.name}`);
   *   console.log(`MCP Servers: ${agent.mcpConfig?.length || 0}`);
   * });
   */
  async getAllAgents(options?: {
    populate?: string[] | Record<string, any>;
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Promise<Agent[]> {
    const cacheKey = `agents:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = this.buildQueryParams(options);
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/agents',
      { params }
    );

    const agents = data.data.map((item: StrapiAttributes<any>) => this.transformAgent(item));

    this.cache.set(cacheKey, agents);

    return agents;
  }

  /**
   * Get a single agent by ID with populated relations
   * Updated to populate component fields (Strapi 5)
   */
  async getAgent(id: string): Promise<Agent> {
    const cacheKey = `agent:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiData<any>>(
      `/agents/${id}`,
      {
        params: {
          // Populate component fields and nested relations
          populate: {
            toolConfig: true,
            modelConfig: true,
            analytics: true,
            metadata: true,
            mcpConfig: {
              populate: {
                mcpServer: true,
                selectedTools: {
                  populate: { mcpTool: true },
                },
              },
            },
            skillSelection: {
              populate: { skill: true },
            },
            tasks: {
              populate: { task: true },
            },
          },
        },
      }
    );

    if (!data.data) {
      throw new Error(`Agent with ID ${id} not found`);
    }

    const agent = this.transformAgent(data.data);
    this.cache.set(cacheKey, agent);

    return agent;
  }

  /**
   * Create a new agent
   */
  async createAgent(agentData: CreateAgentDTO): Promise<Agent> {
    const { data } = await this.client.post<StrapiData<any>>(
      '/agents',
      {
        data: this.prepareAgentData(agentData as any),
      }
    );

    if (!data.data) {
      throw new Error('Failed to create agent');
    }

    // Invalidate cache
    this.invalidateCache('agents');

    return this.transformAgent(data.data);
  }

  /**
   * Update an existing agent
   */
  async updateAgent(id: string, agentData: UpdateAgentDTO): Promise<Agent> {
    const { data } = await this.client.put<StrapiData<any>>(
      `/agents/${id}`,
      {
        data: this.prepareAgentData(agentData as any),
      }
    );

    if (!data.data) {
      throw new Error(`Failed to update agent with ID ${id}`);
    }

    // Invalidate cache
    this.invalidateCache('agents');
    this.cache.delete(`agent:${id}`);

    return this.transformAgent(data.data);
  }

  /**
   * Delete an agent
   */
  async deleteAgent(id: string): Promise<void> {
    await this.client.delete(`/agents/${id}`);

    // Invalidate cache
    this.invalidateCache('agents');
    this.cache.delete(`agent:${id}`);
  }

  // ============= SKILLS =============

  /**
   * Get all skills with optional filtering
   */
  async getAllSkills(options?: {
    populate?: string[];
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Promise<Skill[]> {
    const cacheKey = `skills:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Always populate component fields for skills
    const populateOptions = {
      ...options,
      populate: options?.populate || [
        'toolConfig',
        'modelConfig',
        'analytics',
        'mcpConfig.mcpServer',
        'mcpConfig.selectedTools.mcpTool',
        'agentSelection',
        'trainingHistory',
        'additionalFiles.file',  // Deep populate: component + file relation
        'inputFields'
      ],
      // Default pagination to fetch all skills (max 100)
      pagination: options?.pagination || { page: 1, pageSize: 100 }
    };

    const params = this.buildQueryParams(populateOptions);
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/skills',
      { params }
    );

    // DEBUG: Log raw Strapi response to check mcpConfig
    console.log('[DEBUG] getAllSkills - Raw Strapi response (first item):', JSON.stringify(data.data[0], null, 2));
    if (data.data[0]?.attributes) {
      console.log('[DEBUG] getAllSkills - First item attributes keys:', Object.keys(data.data[0].attributes));
      console.log('[DEBUG] getAllSkills - mcpConfig value:', (data.data[0].attributes as any).mcpConfig);
    }

    const skills = data.data.map((item: StrapiAttributes<any>) => this.transformSkill(item));
    this.cache.set(cacheKey, skills);

    return skills;
  }

  /**
   * Get a single skill by ID
   * Updated to populate component fields (Strapi 5)
   */
  async getSkill(id: string): Promise<Skill> {
    const cacheKey = `skill:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiData<any>>(
      `/skills/${id}`,
      {
        params: {
          // Populate component fields and nested relations
          populate: {
            trainingHistory: true,
            additionalFiles: {
              populate: { file: true }  // Populate file relation inside component
            },
            agentSelection: {
              populate: { agent: true },
            },
            toolConfig: true,
            modelConfig: true,
            analytics: true,
            mcpConfig: {
              populate: {
                mcpServer: true,
                selectedTools: {
                  populate: { mcpTool: true },
                },
              },
            },
            tasks: {
              populate: { task: true },
            },
            inputFields: true,
            trainingAgent: true,
          },
        },
      }
    );

    if (!data.data) {
      throw new Error(`Skill with ID ${id} not found`);
    }

    const skill = this.transformSkill(data.data);
    this.cache.set(cacheKey, skill);

    return skill;
  }

  /**
   * Get multiple skills by their IDs
   */
  async getSkillsByIds(ids: string[]): Promise<Skill[]> {
    if (ids.length === 0) return [];

    const filters = {
      documentId: { $in: ids },
    };

    return this.getAllSkills({ filters });
  }

  /**
   * Create a new skill
   */
  async createSkill(skillData: CreateSkillDTO): Promise<Skill> {
    const { data } = await this.client.post<StrapiData<any>>(
      '/skills',
      {
        data: this.prepareSkillData(skillData),
      }
    );

    if (!data.data) {
      throw new Error('Failed to create skill');
    }

    this.invalidateCache('skills');
    return this.transformSkill(data.data);
  }

  /**
   * Update an existing skill
   */
  async updateSkill(id: string, skillData: UpdateSkillDTO): Promise<Skill> {
    const { data } = await this.client.put<StrapiData<any>>(
      `/skills/${id}`,
      {
        data: this.prepareSkillData(skillData),
      }
    );

    if (!data.data) {
      throw new Error(`Failed to update skill with ID ${id}`);
    }

    this.invalidateCache('skills');
    this.cache.delete(`skill:${id}`);

    return this.transformSkill(data.data);
  }

  /**
   * Delete a skill
   */
  async deleteSkill(id: string): Promise<void> {
    await this.client.delete(`/skills/${id}`);
    this.invalidateCache('skills');
    this.cache.delete(`skill:${id}`);
  }

  // ============= MCP SERVERS =============

  /**
   * Get all MCP servers with optional filtering
   */
  async getAllMCPServers(options?: {
    filters?: Record<string, any>;
    populate?: boolean;
  }): Promise<MCPServer[]> {
    const cacheKey = `mcp-servers:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = this.buildQueryParams({
      ...options,
      populate: options?.populate ? ['mcpTools'] : undefined
    });
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/mcp-servers',
      { params }
    );

    const mcpServers = data.data.map((item: StrapiAttributes<any>) => this.transformMCPServer(item));
    this.cache.set(cacheKey, mcpServers);

    return mcpServers;
  }

  /**
   * Get a single MCP server by ID
   */
  async getMCPServer(id: string): Promise<MCPServer> {
    const cacheKey = `mcp-server:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiData<any>>(
      `/mcp-servers/${id}`,
      {
        params: { populate: '*' },
      }
    );

    if (!data.data) {
      throw new Error(`MCP Server with ID ${id} not found`);
    }

    const mcpServer = this.transformMCPServer(data.data);
    this.cache.set(cacheKey, mcpServer);

    return mcpServer;
  }

  /**
   * Get multiple MCP servers by their IDs
   */
  async getMCPServersByIds(ids: string[]): Promise<MCPServer[]> {
    if (ids.length === 0) return [];

    const filters = {
      documentId: { $in: ids },
    };

    return this.getAllMCPServers({ filters });
  }

  /**
   * Create a new MCP server
   */
  async createMCPServer(mcpData: CreateMCPServerDTO): Promise<MCPServer> {
    const { data } = await this.client.post<StrapiData<any>>(
      '/mcp-servers',
      {
        data: this.prepareMCPServerData(mcpData),
      }
    );

    if (!data.data) {
      throw new Error('Failed to create MCP server');
    }

    this.invalidateCache('mcp-servers');
    return this.transformMCPServer(data.data);
  }

  /**
   * Update an existing MCP server
   */
  async updateMCPServer(id: string, mcpData: UpdateMCPServerDTO): Promise<MCPServer> {
    const { data } = await this.client.put<StrapiData<any>>(
      `/mcp-servers/${id}`,
      {
        data: this.prepareMCPServerData(mcpData),
      }
    );

    if (!data.data) {
      throw new Error(`Failed to update MCP server with ID ${id}`);
    }

    this.invalidateCache('mcp-servers');
    this.cache.delete(`mcp-server:${id}`);

    return this.transformMCPServer(data.data);
  }

  /**
   * Delete an MCP server
   */
  async deleteMCPServer(id: string): Promise<void> {
    await this.client.delete(`/mcp-servers/${id}`);
    this.invalidateCache('mcp-servers');
    this.cache.delete(`mcp-server:${id}`);
  }

  /**
   * Update MCP server tools (DEPRECATED - use bulkSyncMCPTools instead)
   */
  async updateMCPServerTools(id: string, tools: any[]): Promise<MCPServer> {
    console.warn('updateMCPServerTools is deprecated, use bulkSyncMCPTools instead');
    return this.bulkSyncMCPTools([{ serverId: id, tools }]);
  }

  /**
   * Bulk sync MCP server tools
   */
  async bulkSyncMCPTools(configs: Array<{ serverId: string; tools: any[] }>): Promise<MCPServer[]> {
    const results: MCPServer[] = [];

    for (const config of configs) {
      const server = await this.getMCPServer(config.serverId);
      const { data } = await this.client.put<StrapiData<any>>(
        `/mcp-servers/${config.serverId}`,
        {
          data: {
            mcpTools: config.tools,
          },
        }
      );

      if (data.data) {
        results.push(this.transformMCPServer(data.data));
        this.invalidateCache('mcp-servers');
        this.cache.delete(`mcp-server:${config.serverId}`);
      }
    }

    return results;
  }

  // ============= MCP TOOLS =============

  /**
   * Get all MCP tools with optional filtering
   */
  async getAllMCPTools(options?: {
    filters?: Record<string, any>;
    populate?: boolean;
  }): Promise<MCPTool[]> {
    const cacheKey = `mcp-tools:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = this.buildQueryParams({
      ...options,
      populate: options?.populate ? ['mcpServer'] : undefined
    });
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/mcp-tools',
      { params }
    );

    const mcpTools = data.data.map((item: StrapiAttributes<any>) => this.transformMCPTool(item));
    this.cache.set(cacheKey, mcpTools);

    return mcpTools;
  }

  /**
   * Get a single MCP tool by ID
   */
  async getMCPTool(id: string): Promise<MCPTool> {
    const cacheKey = `mcp-tool:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiData<any>>(
      `/mcp-tools/${id}`,
      {
        params: { populate: '*' },
      }
    );

    if (!data.data) {
      throw new Error(`MCP Tool with ID ${id} not found`);
    }

    const mcpTool = this.transformMCPTool(data.data);
    this.cache.set(cacheKey, mcpTool);

    return mcpTool;
  }

  // ============= TASKS =============

  /**
   * Get all tasks with optional filtering
   */
  async getAllTasks(options?: {
    filters?: Record<string, any>;
    populate?: boolean;
  }): Promise<Task[]> {
    const cacheKey = `tasks:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = this.buildQueryParams({
      ...options,
      populate: options?.populate ? ['agent', 'skill'] : undefined
    });
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/tasks',
      { params }
    );

    const tasks = data.data.map((item: StrapiAttributes<any>) => this.transformTask(item));
    this.cache.set(cacheKey, tasks);

    return tasks;
  }

  /**
   * Get a single task by ID
   */
  async getTask(id: string): Promise<Task> {
    const cacheKey = `task:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiData<any>>(
      `/tasks/${id}`,
      {
        params: { populate: '*' },
      }
    );

    if (!data.data) {
      throw new Error(`Task with ID ${id} not found`);
    }

    const task = this.transformTask(data.data);
    this.cache.set(cacheKey, task);

    return task;
  }

  /**
   * Create a new task
   */
  async createTask(taskData: CreateTaskDTO): Promise<Task> {
    const { data } = await this.client.post<StrapiData<any>>(
      '/tasks',
      {
        data: this.prepareTaskData(taskData),
      }
    );

    if (!data.data) {
      throw new Error('Failed to create task');
    }

    this.invalidateCache('tasks');
    return this.transformTask(data.data);
  }

  /**
   * Update an existing task
   */
  async updateTask(id: string, taskData: UpdateTaskDTO): Promise<Task> {
    const { data } = await this.client.put<StrapiData<any>>(
      `/tasks/${id}`,
      {
        data: this.prepareTaskData(taskData),
      }
    );

    if (!data.data) {
      throw new Error(`Failed to update task with ID ${id}`);
    }

    this.invalidateCache('tasks');
    this.cache.delete(`task:${id}`);

    return this.transformTask(data.data);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/tasks/${id}`);
    this.invalidateCache('tasks');
    this.cache.delete(`task:${id}`);
  }

  // ============= FLOWS =============

  /**
   * Get all flows with optional filtering
   */
  async getAllFlows(options?: {
    filters?: Record<string, any>;
    populate?: boolean;
  }): Promise<Flow[]> {
    const cacheKey = `flows:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = this.buildQueryParams({
      ...options,
      populate: options?.populate ? '*' : undefined
    });
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/flows',
      { params }
    );

    const flows = data.data.map((item: StrapiAttributes<any>) => this.transformFlow(item));
    this.cache.set(cacheKey, flows);

    return flows;
  }

  /**
   * Get a single flow by ID
   */
  async getFlow(id: string): Promise<Flow> {
    const cacheKey = `flow:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiData<any>>(
      `/flows/${id}`,
      {
        params: { populate: '*' },
      }
    );

    if (!data.data) {
      throw new Error(`Flow with ID ${id} not found`);
    }

    const flow = this.transformFlow(data.data);
    this.cache.set(cacheKey, flow);

    return flow;
  }

  /**
   * Create a new flow
   */
  async createFlow(flowData: Partial<Flow>): Promise<Flow> {
    const { data } = await this.client.post<StrapiData<any>>(
      '/flows',
      {
        data: this.prepareFlowData(flowData),
      }
    );

    if (!data.data) {
      throw new Error('Failed to create flow');
    }

    this.invalidateCache('flows');
    return this.transformFlow(data.data);
  }

  /**
   * Update an existing flow
   */
  async updateFlow(id: string, flowData: Partial<Flow>): Promise<Flow> {
    const { data } = await this.client.put<StrapiData<any>>(
      `/flows/${id}`,
      {
        data: this.prepareFlowData(flowData),
      }
    );

    if (!data.data) {
      throw new Error(`Failed to update flow with ID ${id}`);
    }

    this.invalidateCache('flows');
    this.cache.delete(`flow:${id}`);

    return this.transformFlow(data.data);
  }

  /**
   * Delete a flow
   */
  async deleteFlow(id: string): Promise<void> {
    await this.client.delete(`/flows/${id}`);
    this.invalidateCache('flows');
    this.cache.delete(`flow:${id}`);
  }

  /**
   * Execute a flow
   */
  async executeFlow(id: string, inputs?: Record<string, any>): Promise<FlowExecution> {
    const { data } = await this.client.post<StrapiData<any>>(
      `/flows/${id}/execute`,
      {
        inputs: inputs || {},
      }
    );

    if (!data.data) {
      throw new Error('Failed to execute flow');
    }

    return this.transformFlowExecution(data.data);
  }

  /**
   * Get flow executions
   */
  async getFlowExecutions(flowId: string): Promise<FlowExecution[]> {
    const cacheKey = `flow-executions:${flowId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      `/flows/${flowId}/executions`,
      {
        params: { populate: '*' },
      }
    );

    const executions = data.data.map((item: StrapiAttributes<any>) => this.transformFlowExecution(item));
    this.cache.set(cacheKey, executions);

    return executions;
  }

  /**
   * Get a single flow execution
   */
  async getFlowExecution(flowId: string, executionId: string): Promise<FlowExecution> {
    const cacheKey = `flow-execution:${flowId}:${executionId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiData<any>>(
      `/flows/${flowId}/executions/${executionId}`,
      {
        params: { populate: '*' },
      }
    );

    if (!data.data) {
      throw new Error(`Flow execution with ID ${executionId} not found`);
    }

    const execution = this.transformFlowExecution(data.data);
    this.cache.set(cacheKey, execution);

    return execution;
  }

  // ============= FILE OPERATIONS =============

  /**
   * Upload a file to Strapi
   */
  async uploadFile(fileBuffer: Buffer, filename: string, alternativeText?: string): Promise<any> {
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('files', blob, filename);

    if (alternativeText) {
      formData.append('alternativeText', alternativeText);
    }

    const { data } = await this.client.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return Array.isArray(data) ? data[0] : data;
  }

  /**
   * Delete a file from Strapi
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.client.delete(`/upload/files/${fileId}`);
  }

  // ============= CACHE MANAGEMENT =============

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; max: number; ttl: number } {
    return {
      size: this.cache.size,
      max: CACHE_MAX_SIZE,
      ttl: CACHE_TTL,
    };
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Strapi] Cache cleared');
  }

  /**
   * Invalidate cache entries for a specific resource
   */
  private invalidateCache(resource: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(resource)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // ============= DATA TRANSFORMATION =============

  /**
   * Transform Strapi agent response to domain model
   */
  private transformAgent(item: StrapiAttributes<any>): Agent {
    const attributes = item.attributes || item;

    return {
      id: item.id || attributes.documentId,
      documentId: attributes.documentId,
      name: attributes.name,
      description: attributes.description,
      systemPrompt: attributes.systemPrompt,
      enabled: attributes.enabled ?? true,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
      publishedAt: attributes.publishedAt,
      toolConfig: attributes.toolConfig,
      modelConfig: attributes.modelConfig,
      analytics: attributes.analytics,
      metadata: attributes.metadata,
      mcpConfig: attributes.mcpConfig,
      skillSelection: attributes.skillSelection,
      tasks: attributes.tasks,
    };
  }

  /**
   * Transform Strapi skill response to domain model
   */
  private transformSkill(item: StrapiAttributes<any>): Skill {
    const attributes = item.attributes || item;

    return {
      id: item.id || attributes.documentId,
      documentId: attributes.documentId,
      name: attributes.name,
      displayName: attributes.displayName,
      description: attributes.description,
      skillmd: attributes.skillmd,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
      publishedAt: attributes.publishedAt,
      toolConfig: attributes.toolConfig,
      modelConfig: attributes.modelConfig,
      analytics: attributes.analytics,
      mcpConfig: attributes.mcpConfig,
      agentSelection: attributes.agentSelection,
      trainingHistory: attributes.trainingHistory,
      additionalFiles: attributes.additionalFiles,
      inputFields: attributes.inputFields,
      trainingAgent: attributes.trainingAgent,
      tasks: attributes.tasks,
    };
  }

  /**
   * Transform Strapi MCP server response to domain model
   */
  private transformMCPServer(item: StrapiAttributes<any>): MCPServer {
    const attributes = item.attributes || item;

    return {
      id: item.id || attributes.documentId,
      documentId: attributes.documentId,
      name: attributes.name,
      description: attributes.description,
      command: attributes.command,
      args: attributes.args,
      env: attributes.env,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
      publishedAt: attributes.publishedAt,
      mcpTools: attributes.mcpTools,
    };
  }

  /**
   * Transform Strapi MCP tool response to domain model
   */
  private transformMCPTool(item: StrapiAttributes<any>): MCPTool {
    const attributes = item.attributes || item;

    return {
      id: item.id || attributes.documentId,
      documentId: attributes.documentId,
      name: attributes.name,
      description: attributes.description,
      inputSchema: attributes.inputSchema,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
      publishedAt: attributes.publishedAt,
      mcpServer: attributes.mcpServer,
    };
  }

  /**
   * Transform Strapi task response to domain model
   */
  private transformTask(item: StrapiAttributes<any>): Task {
    const attributes = item.attributes || item;

    return {
      id: item.id || attributes.documentId,
      documentId: attributes.documentId,
      name: attributes.name,
      description: attributes.description,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
      publishedAt: attributes.publishedAt,
      agent: attributes.agent,
      skill: attributes.skill,
    };
  }

  /**
   * Transform Strapi flow response to domain model
   */
  private transformFlow(item: StrapiAttributes<any>): Flow {
    const attributes = item.attributes || item;

    return {
      id: item.id || attributes.documentId,
      documentId: attributes.documentId,
      name: attributes.name,
      description: attributes.description,
      status: attributes.status,
      category: attributes.category,
      nodes: attributes.nodes,
      edges: attributes.edges,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
      publishedAt: attributes.publishedAt,
    } as Flow;
  }

  /**
   * Transform Strapi flow execution response to domain model
   */
  private transformFlowExecution(item: StrapiAttributes<any>): FlowExecution {
    const attributes = item.attributes || item;

    return {
      id: item.id || attributes.documentId,
      documentId: attributes.documentId,
      status: attributes.status,
      inputs: attributes.inputs,
      outputs: attributes.outputs,
      logs: attributes.logs,
      createdAt: attributes.createdAt,
      updatedAt: attributes.updatedAt,
    } as FlowExecution;
  }

  // ============= DATA PREPARATION =============

  /**
   * Prepare agent data for API submission
   */
  private prepareAgentData(data: any): any {
    return {
      name: data.name,
      description: data.description,
      systemPrompt: data.systemPrompt,
      enabled: data.enabled ?? true,
      toolConfig: data.toolConfig,
      modelConfig: data.modelConfig,
      analytics: data.analytics,
      metadata: data.metadata,
      mcpConfig: data.mcpConfig,
      skillSelection: data.skillSelection,
      tasks: data.tasks,
    };
  }

  /**
   * Prepare skill data for API submission
   */
  private prepareSkillData(data: any): any {
    return {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      skillmd: data.skillmd,
      toolConfig: data.toolConfig,
      modelConfig: data.modelConfig,
      analytics: data.analytics,
      mcpConfig: data.mcpConfig,
      agentSelection: data.agentSelection,
      trainingHistory: data.trainingHistory,
      additionalFiles: data.additionalFiles,
      inputFields: data.inputFields,
      trainingAgent: data.trainingAgent,
      tasks: data.tasks,
    };
  }

  /**
   * Prepare MCP server data for API submission
   */
  private prepareMCPServerData(data: any): any {
    return {
      name: data.name,
      description: data.description,
      command: data.command,
      args: data.args,
      env: data.env,
      mcpTools: data.mcpTools,
    };
  }

  /**
   * Prepare task data for API submission
   */
  private prepareTaskData(data: any): any {
    return {
      name: data.name,
      description: data.description,
      agent: data.agent,
      skill: data.skill,
    };
  }

  /**
   * Prepare flow data for API submission
   */
  private prepareFlowData(data: any): any {
    return {
      name: data.name,
      description: data.description,
      status: data.status,
      category: data.category,
      nodes: data.nodes,
      edges: data.edges,
    };
  }

  // ============= QUERY BUILDING =============

  /**
   * Build Strapi query parameters from options
   */
  private buildQueryParams(options?: {
    populate?: string[] | Record<string, any>;
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Record<string, any> {
    const params: Record<string, any> = {};

    if (options?.populate) {
      params.populate = options.populate;
    }

    if (options?.filters) {
      params.filters = options.filters;
    }

    if (options?.sort) {
      params.sort = options.sort;
    }

    if (options?.pagination) {
      params.pagination = {
        page: options.pagination.page,
        pageSize: options.pagination.pageSize,
      };
    }

    return params;
  }

  // ============= ERROR HANDLING =============

  /**
   * Handle API errors with detailed logging
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      console.error(`[Strapi] ${status} Error:`, data?.error?.message || data?.message || JSON.stringify(data));
    } else if (error.request) {
      // Request made but no response
      console.error('[Strapi] No response from server:', error.message);
    } else {
      // Error in request setup
      console.error('[Strapi] Error:', error.message);
    }
  }
}

// ============= SINGLETON INSTANCE =============

/**
 * Global Strapi client singleton instance
 * Use this instance throughout the application for consistent API communication
 */
export const strapiClient = new StrapiClient();