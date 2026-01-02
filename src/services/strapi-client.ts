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
 * - CRUD operations for Agents, Skills, MCP Servers, MCP Tools, Tasks
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
   * Check if Strapi API is accessible
   * @returns Promise<boolean> - true if healthy, false otherwise
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
   * @param {string[]} [options.populate] - Relations/components to populate (e.g., ['mcpConfig', 'skillSelection'])
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
   *   console.log(`Skills: ${agent.skillSelection?.length || 0}`);
   *   console.log(`Model: ${agent.modelConfig?.model}`);
   * });
   *
   * @example
   * // Search agents by name with case-insensitive matching
   * const searchResults = await strapiClient.getAllAgents({
   *   filters: {
   *     $or: [
   *       { name: { $containsi: 'code' } },
   *       { description: { $containsi: 'code' } }
   *     ]
   *   }
   * });
   *
   * @example
   * // Get agents with specific model configuration
   * const sonnetAgents = await strapiClient.getAllAgents({
   *   filters: {
   *     'modelConfig.model': { $eq: 'sonnet' }
   *   }
   * });
   *
   * @example
   * // Pagination - get second page of 20 agents
   * const page2 = await strapiClient.getAllAgents({
   *   pagination: { page: 2, pageSize: 20 },
   *   sort: ['updatedAt:desc'] // Most recently updated first
   * });
   */
  async getAllAgents(options?: {
    populate?: string[];
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
   * Get a single agent by ID with all relations and components populated
   *
   * @description
   * Retrieves a single agent by its unique document ID with deep population of all
   * component fields and relations. This method automatically populates all nested data
   * including MCP server configurations, skill selections, and task assignments.
   *
   * **Auto-populated Components:**
   * - `toolConfig`: Tool configuration with enabled tools
   * - `modelConfig`: Model configuration (model, temperature, timeout)
   * - `analytics`: Usage analytics and performance metrics
   * - `metadata`: Custom key-value metadata pairs
   * - `mcpConfig`: MCP server configurations with nested mcpServer and selectedTools.mcpTool relations
   * - `skillSelection`: Skill selections with nested skill relations
   * - `tasks`: Task assignments with nested task relations
   *
   * **Strapi v5 Deep Population:**
   * This method uses deep population syntax to retrieve nested relations within components:
   * ```javascript
   * mcpConfig: {
   *   populate: {
   *     mcpServer: true,           // Populate mcpServer relation
   *     selectedTools: {
   *       populate: { mcpTool: true }  // Populate mcpTool within selectedTools
   *     }
   *   }
   * }
   * ```
   *
   * @param {string} id - Agent document ID (UUID format)
   *
   * @returns {Promise<Agent>} Agent object with all components and relations populated
   *
   * @throws {Error} If agent with the specified ID is not found
   *
   * @example
   * // Basic usage - get agent with all relations
   * const agent = await strapiClient.getAgent('abc123-def456-ghi789');
   * console.log(agent.name);
   * console.log(agent.systemPrompt);
   * console.log(agent.modelConfig?.model); // 'sonnet' | 'haiku' | 'opus'
   *
   * @example
   * // Access MCP server configuration
   * const agent = await strapiClient.getAgent('agent-id');
   *
   * // mcpConfig is an array of components
   * agent.mcpConfig?.forEach(config => {
   *   console.log(`MCP Server: ${config.mcpServer?.name}`);
   *   console.log(`Transport: ${config.mcpServer?.transport}`);
   *
   *   // Access selected tools (nested population)
   *   config.selectedTools?.forEach(toolSelection => {
   *     console.log(`  Tool: ${toolSelection.mcpTool?.name}`);
   *     console.log(`  Description: ${toolSelection.mcpTool?.description}`);
   *   });
   * });
   *
   * @example
   * // Access skill selection
   * const agent = await strapiClient.getAgent('agent-id');
   *
   * // skillSelection is an array of components
   * agent.skillSelection?.forEach(selection => {
   *   const skill = selection.skill; // Populated skill relation
   *   console.log(`Skill: ${skill?.displayName}`);
   *   console.log(`Description: ${skill?.description}`);
   * });
   *
   * @example
   * // Access tool configuration component
   * const agent = await strapiClient.getAgent('agent-id');
   *
   * if (agent.toolConfig) {
   *   console.log('Enabled tools:');
   *   if (agent.toolConfig.file_search) console.log('  - File Search');
   *   if (agent.toolConfig.text_editor) console.log('  - Text Editor');
   *   if (agent.toolConfig.computer_20241022) console.log('  - Computer Use');
   *   if (agent.toolConfig.bash_20241022) console.log('  - Bash');
   * }
   *
   * @example
   * // Access model configuration component
   * const agent = await strapiClient.getAgent('agent-id');
   *
   * const config = agent.modelConfig;
   * console.log(`Model: ${config?.model || 'sonnet'}`);
   * console.log(`Temperature: ${config?.temperature || 1.0}`);
   * console.log(`Max tokens: ${config?.max_tokens || 4096}`);
   * console.log(`Timeout: ${config?.timeout || 300000}ms`);
   *
   * @example
   * // Error handling for non-existent agent
   * try {
   *   const agent = await strapiClient.getAgent('non-existent-id');
   * } catch (error) {
   *   console.error('Agent not found:', error.message);
   *   // Error: Agent with ID non-existent-id not found
   * }
   *
   * @example
   * // Check agent enabled status before use
   * const agent = await strapiClient.getAgent('agent-id');
   *
   * if (!agent.enabled) {
   *   console.warn(`Agent "${agent.name}" is disabled`);
   *   return;
   * }
   *
   * // Use agent for conversation...
   *
   * @see {@link getAllAgents} for querying multiple agents with filters
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
   * Create a new agent with component-based configuration
   *
   * @description
   * Creates a new agent in Strapi with support for component-based architecture.
   * The agent slug is automatically generated from the name. All component fields
   * (toolConfig, modelConfig, mcpConfig, etc.) are supported in Strapi v5 format.
   *
   * **Component Fields:**
   * - `toolConfig`: Configure enabled tools (file_search, text_editor, computer_20241022, bash_20241022)
   * - `modelConfig`: Configure model settings (model, temperature, max_tokens, timeout)
   * - `analytics`: Initialize analytics tracking
   * - `metadata`: Add custom key-value metadata pairs
   * - `mcpConfig`: Configure MCP servers (array of { mcpServer: id, selectedTools: [...] })
   * - `skillSelection`: Assign skills (array of { skill: id })
   * - `tasks`: Assign tasks (array of { task: id })
   *
   * **Cache Invalidation:**
   * Creating an agent invalidates all cached agent queries to ensure fresh data.
   *
   * @param {CreateAgentDTO} agentData - Agent data transfer object
   * @param {string} agentData.name - Agent name (required, used to generate slug)
   * @param {string} [agentData.description] - Agent description
   * @param {string} agentData.systemPrompt - System prompt for the agent (required)
   * @param {boolean} [agentData.enabled=true] - Whether the agent is enabled
   * @param {Object} [agentData.toolConfig] - Tool configuration component
   * @param {Object} [agentData.modelConfig] - Model configuration component
   * @param {Object} [agentData.analytics] - Analytics component
   * @param {Array} [agentData.metadata] - Metadata key-value pairs
   * @param {Array} [agentData.mcpConfig] - MCP server configuration components
   * @param {Array} [agentData.skillSelection] - Skill selection components
   * @param {Array} [agentData.tasks] - Task assignment components
   *
   * @returns {Promise<Agent>} Created agent with generated ID and auto-populated defaults
   *
   * @throws {Error} If agent creation fails (validation errors, network errors)
   *
   * @example
   * // Basic agent creation with minimal fields
   * const agent = await strapiClient.createAgent({
   *   name: 'Code Assistant',
   *   description: 'Helps with coding tasks',
   *   systemPrompt: 'You are a helpful coding assistant specialized in TypeScript and React.',
   *   enabled: true
   * });
   *
   * console.log(agent.id);   // Auto-generated UUID
   * console.log(agent.slug); // Auto-generated: 'code-assistant'
   * console.log(agent.modelConfig); // Default: { model: 'sonnet', temperature: 1.0, timeout: 300000 }
   *
   * @example
   * // Create agent with custom model configuration
   * const agent = await strapiClient.createAgent({
   *   name: 'Fast Assistant',
   *   systemPrompt: 'You are a quick assistant for simple tasks.',
   *   modelConfig: {
   *     model: 'haiku',
   *     temperature: 0.7,
   *     max_tokens: 2048,
   *     timeout: 60000
   *   }
   * });
   *
   * @example
   * // Create agent with specific tools enabled
   * const agent = await strapiClient.createAgent({
   *   name: 'File Manager',
   *   systemPrompt: 'You help users manage and search files.',
   *   toolConfig: {
   *     file_search: true,
   *     text_editor: true,
   *     bash_20241022: false,
   *     computer_20241022: false
   *   }
   * });
   *
   * @example
   * // Create agent with MCP server configuration
   * // First, ensure MCP servers exist in Strapi
   * const mcpServers = await strapiClient.getAllMCPServers();
   * const filesystemServer = mcpServers.find(s => s.name === 'filesystem');
   * const filesystemTools = await strapiClient.getMCPToolsByServerId(filesystemServer.id);
   *
   * const agent = await strapiClient.createAgent({
   *   name: 'File Assistant',
   *   systemPrompt: 'You help users with file operations.',
   *   mcpConfig: [
   *     {
   *       mcpServer: filesystemServer.id,
   *       selectedTools: filesystemTools.slice(0, 3).map(tool => ({
   *         mcpTool: tool.id
   *       }))
   *     }
   *   ]
   * });
   *
   * @example
   * // Create agent with skill selection
   * const skills = await strapiClient.getAllSkills();
   * const codingSkill = skills.find(s => s.name === 'typescript-expert');
   *
   * const agent = await strapiClient.createAgent({
   *   name: 'TypeScript Expert',
   *   systemPrompt: 'You are a TypeScript expert.',
   *   skillSelection: [
   *     { skill: codingSkill.id }
   *   ]
   * });
   *
   * @example
   * // Create agent with custom metadata
   * const agent = await strapiClient.createAgent({
   *   name: 'Research Assistant',
   *   systemPrompt: 'You help with research tasks.',
   *   metadata: [
   *     { key: 'department', value: 'Engineering' },
   *     { key: 'priority', value: 'high' },
   *     { key: 'version', value: '2.0' }
   *   ]
   * });
   *
   * @example
   * // Error handling for validation failures
   * try {
   *   const agent = await strapiClient.createAgent({
   *     name: '', // Invalid: empty name
   *     systemPrompt: 'Test prompt'
   *   });
   * } catch (error) {
   *   console.error('Validation failed:', error.message);
   * }
   *
   * @see {@link updateAgent} for updating existing agents
   * @see {@link getAgent} for retrieving created agent with full details
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
   * Update an existing agent with partial data
   *
   * @description
   * Updates an existing agent in Strapi using partial update semantics. Only the fields
   * provided in the update DTO will be modified; omitted fields remain unchanged. This
   * method supports updating all component fields and relations in Strapi v5 format.
   *
   * **Partial Updates:**
   * You can update individual fields without affecting other fields:
   * - Update only `name` without changing `systemPrompt`
   * - Update only `modelConfig` without changing `toolConfig`
   * - Update only specific tools within `mcpConfig` arrays
   *
   * **Component Field Updates:**
   * - `toolConfig`: Update tool enablement settings
   * - `modelConfig`: Update model configuration (temperature, timeout, etc.)
   * - `analytics`: Update analytics data
   * - `metadata`: Replace or append metadata pairs
   * - `mcpConfig`: Replace MCP server configurations (array replacement)
   * - `skillSelection`: Replace skill selections (array replacement)
   * - `tasks`: Replace task assignments (array replacement)
   *
   * **Cache Invalidation:**
   * Updating an agent invalidates both the specific agent cache and all agent list caches.
   *
   * @param {string} id - Agent document ID to update
   * @param {UpdateAgentDTO} agentData - Partial agent data to update
   * @param {string} [agentData.name] - Update agent name (updates slug automatically)
   * @param {string} [agentData.description] - Update description
   * @param {string} [agentData.systemPrompt] - Update system prompt
   * @param {boolean} [agentData.enabled] - Update enabled status
   * @param {Object} [agentData.toolConfig] - Update tool configuration
   * @param {Object} [agentData.modelConfig] - Update model configuration
   * @param {Object} [agentData.analytics] - Update analytics
   * @param {Array} [agentData.metadata] - Replace metadata (not merged)
   * @param {Array} [agentData.mcpConfig] - Replace MCP config (not merged)
   * @param {Array} [agentData.skillSelection] - Replace skill selection (not merged)
   * @param {Array} [agentData.tasks] - Replace task assignments (not merged)
   *
   * @returns {Promise<Agent>} Updated agent with all components populated
   *
   * @throws {Error} If agent with specified ID is not found or update fails
   *
   * @example
   * // Basic update - change agent name and description
   * const updatedAgent = await strapiClient.updateAgent('agent-id', {
   *   name: 'Updated Assistant',
   *   description: 'New description'
   * });
   *
   * // systemPrompt, enabled, and other fields remain unchanged
   *
   * @example
   * // Update only the system prompt
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   systemPrompt: 'You are an expert TypeScript developer with 10 years of experience.'
   * });
   *
   * @example
   * // Enable/disable an agent
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   enabled: false
   * });
   *
   * @example
   * // Update model configuration - change model and temperature
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   modelConfig: {
   *     model: 'opus',
   *     temperature: 0.5,
   *     max_tokens: 8192,
   *     timeout: 600000
   *   }
   * });
   *
   * @example
   * // Update tool configuration - enable specific tools
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   toolConfig: {
   *     file_search: true,
   *     text_editor: true,
   *     bash_20241022: true,
   *     computer_20241022: false
   *   }
   * });
   *
   * @example
   * // Update MCP configuration - replace all MCP servers
   * const mcpServers = await strapiClient.getAllMCPServers();
   * const githubServer = mcpServers.find(s => s.name === 'github');
   * const githubTools = await strapiClient.getMCPToolsByServerId(githubServer.id);
   *
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   mcpConfig: [
   *     {
   *       mcpServer: githubServer.id,
   *       selectedTools: githubTools.map(tool => ({ mcpTool: tool.id }))
   *     }
   *   ]
   * });
   *
   * @example
   * // Add more skills to an agent (requires fetching existing first)
   * const currentAgent = await strapiClient.getAgent('agent-id');
   * const newSkill = await strapiClient.getAllSkills({ filters: { name: 'debugging' } });
   *
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   skillSelection: [
   *     ...(currentAgent.skillSelection || []), // Keep existing skills
   *     { skill: newSkill[0].id } // Add new skill
   *   ]
   * });
   *
   * @example
   * // Update metadata - completely replace metadata array
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   metadata: [
   *     { key: 'environment', value: 'production' },
   *     { key: 'version', value: '3.0' },
   *     { key: 'last_updated', value: new Date().toISOString() }
   *   ]
   * });
   *
   * @example
   * // Bulk update - change multiple fields at once
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   name: 'Production Assistant',
   *   description: 'Production-ready AI assistant',
   *   enabled: true,
   *   modelConfig: {
   *     model: 'sonnet',
   *     temperature: 0.7,
   *     timeout: 300000
   *   },
   *   toolConfig: {
   *     file_search: true,
   *     text_editor: true,
   *     bash_20241022: false,
   *     computer_20241022: false
   *   }
   * });
   *
   * @example
   * // Error handling for non-existent agent
   * try {
   *   const agent = await strapiClient.updateAgent('non-existent-id', {
   *     name: 'New Name'
   *   });
   * } catch (error) {
   *   console.error('Update failed:', error.message);
   *   // Error: Failed to update agent with ID non-existent-id
   * }
   *
   * @see {@link createAgent} for creating new agents
   * @see {@link getAgent} for retrieving current agent state before update
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
   * Delete an agent permanently from Strapi
   *
   * @description
   * Permanently deletes an agent from the Strapi database. This operation cannot be undone.
   * All associated component data (toolConfig, modelConfig, mcpConfig, skillSelection, etc.)
   * is also deleted as they are part of the agent entity.
   *
   * **Important Considerations:**
   * - This is a permanent deletion - there is no soft delete or trash bin
   * - All component data is deleted with the agent
   * - Related entities (Skills, MCP Servers, Tasks) are NOT deleted (only the associations)
   * - Any active conversations using this agent may fail
   * - Cache is automatically invalidated after deletion
   *
   * **Best Practices:**
   * - Consider disabling the agent instead of deleting it to preserve history
   * - Verify the agent ID before deletion to prevent accidental deletions
   * - Check for active conversations or tasks before deletion
   * - Export agent configuration before deletion if you may need it later
   *
   * @param {string} id - Agent document ID to delete
   *
   * @returns {Promise<void>} Resolves when deletion is complete
   *
   * @throws {Error} If agent with specified ID is not found or deletion fails
   *
   * @example
   * // Basic deletion
   * await strapiClient.deleteAgent('agent-id-to-delete');
   * console.log('Agent deleted successfully');
   *
   * @example
   * // Safe deletion with confirmation
   * const agent = await strapiClient.getAgent('agent-id');
   * console.log(`About to delete agent: ${agent.name}`);
   * console.log(`Description: ${agent.description}`);
   *
   * // In a real application, prompt user for confirmation here
   * const confirmed = true; // User confirmation
   *
   * if (confirmed) {
   *   await strapiClient.deleteAgent(agent.id);
   *   console.log('Agent deleted');
   * }
   *
   * @example
   * // Alternative: Disable instead of delete (preserves history)
   * // This is often preferred over permanent deletion
   * const agent = await strapiClient.updateAgent('agent-id', {
   *   enabled: false
   * });
   * console.log('Agent disabled (not deleted)');
   *
   * @example
   * // Export agent configuration before deletion
   * const agent = await strapiClient.getAgent('agent-id');
   *
   * // Save configuration to file or backup system
   * const backup = {
   *   name: agent.name,
   *   description: agent.description,
   *   systemPrompt: agent.systemPrompt,
   *   modelConfig: agent.modelConfig,
   *   toolConfig: agent.toolConfig,
   *   mcpConfig: agent.mcpConfig,
   *   skillSelection: agent.skillSelection,
   *   exportedAt: new Date().toISOString()
   * };
   *
   * // fs.writeFileSync(`./backups/agent-${agent.id}.json`, JSON.stringify(backup, null, 2));
   *
   * // Now safe to delete
   * await strapiClient.deleteAgent(agent.id);
   *
   * @example
   * // Error handling for non-existent agent
   * try {
   *   await strapiClient.deleteAgent('non-existent-id');
   * } catch (error) {
   *   console.error('Deletion failed:', error.message);
   *   // Handle error (agent not found, network error, etc.)
   * }
   *
   * @example
   * // Batch deletion (use with caution!)
   * const agentsToDelete = await strapiClient.getAllAgents({
   *   filters: { enabled: false, updatedAt: { $lt: '2024-01-01' } }
   * });
   *
   * console.log(`Found ${agentsToDelete.length} agents to delete`);
   *
   * for (const agent of agentsToDelete) {
   *   console.log(`Deleting ${agent.name}...`);
   *   await strapiClient.deleteAgent(agent.id);
   * }
   *
   * console.log('Batch deletion complete');
   *
   * @see {@link updateAgent} for disabling agents without deletion
   * @see {@link getAgent} for retrieving agent details before deletion
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
    return this.bulkSyncMCPTools(id, tools);
  }

  // ============= MCP TOOLS =============

  /**
   * Get all tools for an MCP server
   */
  async getMCPToolsByServerId(serverId: string): Promise<MCPTool[]> {
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/mcp-tools',
      {
        params: {
          filters: { mcpServer: { documentId: serverId } },
        },
      }
    );

    return data.data.map((item: StrapiAttributes<any>) => this.transformMCPTool(item));
  }

  /**
   * Create a new MCP tool
   */
  async createMCPTool(serverId: string, toolData: {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }): Promise<MCPTool> {
    const { data } = await this.client.post<StrapiData<any>>(
      '/mcp-tools',
      {
        data: {
          ...toolData,
          mcpServer: serverId,
        },
      }
    );

    if (!data.data) {
      throw new Error('Failed to create MCP tool');
    }

    return this.transformMCPTool(data.data);
  }

  /**
   * Update an existing MCP tool
   */
  async updateMCPTool(toolId: string, toolData: {
    name?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }): Promise<MCPTool> {
    const { data } = await this.client.put<StrapiData<any>>(
      `/mcp-tools/${toolId}`,
      {
        data: toolData,
      }
    );

    if (!data.data) {
      throw new Error(`Failed to update MCP tool with ID ${toolId}`);
    }

    return this.transformMCPTool(data.data);
  }

  /**
   * Delete an MCP tool
   */
  async deleteMCPTool(toolId: string): Promise<void> {
    await this.client.delete(`/mcp-tools/${toolId}`);
  }

  /**
   * Bulk sync MCP tools for a server
   * Compares fetched tools with existing tools and performs create/update/delete operations
   */
  async bulkSyncMCPTools(serverId: string, fetchedTools: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>): Promise<MCPServer> {
    // Get existing tools for this server
    const existingTools = await this.getMCPToolsByServerId(serverId);

    // Create a map of existing tools by name
    const existingToolsMap = new Map(existingTools.map(t => [t.name, t]));

    // Create a set of fetched tool names
    const fetchedToolNames = new Set(fetchedTools.map(t => t.name));

    // Delete tools that no longer exist
    const toolsToDelete = existingTools.filter(t => !fetchedToolNames.has(t.name));
    await Promise.all(toolsToDelete.map(t => this.deleteMCPTool(t.id)));

    // Create or update tools
    for (const fetchedTool of fetchedTools) {
      const existingTool = existingToolsMap.get(fetchedTool.name);

      if (existingTool) {
        // Update if changed
        const hasChanged =
          existingTool.description !== fetchedTool.description ||
          JSON.stringify(existingTool.inputSchema) !== JSON.stringify(fetchedTool.inputSchema);

        if (hasChanged) {
          await this.updateMCPTool(existingTool.id, fetchedTool);
        }
      } else {
        // Create new tool
        await this.createMCPTool(serverId, fetchedTool);
      }
    }

    // Update toolsFetchedAt timestamp on the server
    await this.client.put(`/mcp-servers/${serverId}`, {
      data: {
        toolsFetchedAt: new Date().toISOString(),
      },
    });

    // Invalidate cache
    this.invalidateCache('mcp-servers');
    this.cache.delete(`mcp-server:${serverId}`);

    // Return updated server with tools
    return this.getMCPServer(serverId);
  }

  // ============= FILE UPLOAD =============

  /**
   * Upload a file to Strapi Media Library
   * @param file - File to upload (Buffer or Blob)
   * @param filename - Original filename
   * @returns Strapi media object with file ID and URL
   */
  async uploadFile(file: Buffer | Blob, filename: string): Promise<{
    id: number;
    documentId: string;
    name: string;
    url: string;
    mime: string;
    size: number;
  }> {
    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    formData.append('files', file, filename);

    const { data } = await this.client.post('/upload', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (!data || !data[0]) {
      throw new Error('Failed to upload file');
    }

    const uploadedFile = data[0];

    return {
      id: uploadedFile.id,
      documentId: uploadedFile.documentId,
      name: uploadedFile.name,
      url: uploadedFile.url,
      mime: uploadedFile.mime,
      size: uploadedFile.size,
    };
  }

  /**
   * Delete a file from Strapi Media Library
   * @param fileId - File ID to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.client.delete(`/upload/files/${fileId}`);
  }

  // ============= TASKS =============

  /**
   * Get all tasks with optional filtering
   */
  async getAllTasks(options?: {
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Promise<Task[]> {
    const cacheKey = `tasks:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = this.buildQueryParams(options);
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
        params: { populate: 'agent' },
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

  // ============= TRANSFORMERS =============
  // Transform Strapi response format to domain models

  /**
   * Helper to extract attributes from Strapi response
   * Handles both nested (attributes) and flat formats
   */
  private extractAttributes(strapiData: any): any {
    // If data has attributes property, use it (Strapi 5 default format)
    if (strapiData.attributes) {
      return strapiData.attributes;
    }

    // Otherwise, data is already flat (some Strapi configurations)
    return strapiData;
  }

  /**
   * Transform Strapi agent response to Agent domain model
   * Updated for component-based structure (Strapi 5)
   */
  private transformAgent(strapiData: StrapiAttributes<any>): Agent {
    const attrs = this.extractAttributes(strapiData);

    return {
      id: strapiData.documentId,
      name: attrs.name,
      slug: attrs.slug,
      description: attrs.description || '',
      systemPrompt: attrs.systemPrompt,
      enabled: attrs.enabled ?? true,

      // Component fields - pass through as-is
      toolConfig: attrs.toolConfig || undefined,
      modelConfig: attrs.modelConfig || {
        model: 'sonnet',
        temperature: 1.0,
        timeout: 300000,
      },
      analytics: attrs.analytics || undefined,
      metadata: attrs.metadata || [],

      // Component-based relations - pass through as-is
      mcpConfig: attrs.mcpConfig || [],
      skillSelection: attrs.skillSelection || [],
      tasks: attrs.tasks || [],

      createdAt: new Date(attrs.createdAt),
      updatedAt: new Date(attrs.updatedAt),
    };
  }

  /**
   * Transform Strapi skill response to Skill domain model
   * Updated for component-based structure (Strapi 5)
   */
  private transformSkill(strapiData: StrapiAttributes<any>): Skill {
    const attrs = this.extractAttributes(strapiData);

    return {
      id: strapiData.documentId,
      name: attrs.name,
      displayName: attrs.displayName,
      description: attrs.description,
      skillmd: attrs.skillmd, // Correct field name
      skillConfig: attrs.skillConfig || undefined, // Add skillConfig (replaces systemPromptPrefix)
      experienceScore: attrs.experienceScore || 0,
      category: attrs.category || 'custom',
      isPublic: attrs.isPublic ?? true,
      version: attrs.version || '1.0.0',
      license: attrs.license || undefined,

      // Component fields - pass through as-is
      trainingHistory: attrs.trainingHistory || [],
      additionalFiles: attrs.additionalFiles || [],
      agentSelection: attrs.agentSelection || [],
      toolConfig: attrs.toolConfig || undefined,
      modelConfig: attrs.modelConfig || undefined,
      analytics: attrs.analytics || undefined,
      mcpConfig: attrs.mcpConfig || [],
      tasks: attrs.tasks || [],
      inputFields: attrs.inputFields || [],

      // Direct relation
      trainingAgent: attrs.trainingAgent?.data?.documentId || attrs.trainingAgent,

      createdAt: new Date(attrs.createdAt),
      updatedAt: new Date(attrs.updatedAt),
    };
  }

  /**
   * Transform Strapi MCP server response to MCPServer domain model
   */
  private transformMCPServer(strapiData: StrapiAttributes<any>): MCPServer {
    const attrs = this.extractAttributes(strapiData);

    // Create config object based on transport type to match frontend expectations
    const config: any = {
      type: attrs.transport || 'stdio',
      command: attrs.command,
      args: attrs.args || [],
      env: attrs.env || {},
      disabled: attrs.disabled ?? false,
    };

    // Transform mcpTools if populated
    let mcpTools: MCPTool[] | undefined;
    if (attrs.mcpTools) {
      if (Array.isArray(attrs.mcpTools)) {
        mcpTools = attrs.mcpTools.map((tool: any) => this.transformMCPTool(tool));
      } else if (attrs.mcpTools.data && Array.isArray(attrs.mcpTools.data)) {
        mcpTools = attrs.mcpTools.data.map((tool: any) => this.transformMCPTool(tool));
      }
    }

    return {
      id: strapiData.documentId,
      name: attrs.name,
      config: config,
      command: attrs.command,
      description: attrs.description || '',
      args: attrs.args || [],
      env: attrs.env || {},
      disabled: attrs.disabled ?? false,
      transport: attrs.transport || 'stdio',
      healthCheckUrl: attrs.healthCheckUrl,
      isHealthy: attrs.isHealthy ?? true,
      lastHealthCheck: attrs.lastHealthCheck ? new Date(attrs.lastHealthCheck) : undefined,
      startupTimeout: attrs.startupTimeout || 30000,
      restartPolicy: attrs.restartPolicy || 'on-failure',
      toolsFetchedAt: attrs.toolsFetchedAt ? new Date(attrs.toolsFetchedAt) : undefined,
      mcpTools: mcpTools,
      createdAt: new Date(attrs.createdAt),
      updatedAt: new Date(attrs.updatedAt),
    } as MCPServer;
  }

  /**
   * Transform Strapi MCP tool response to MCPTool domain model
   */
  private transformMCPTool(strapiData: StrapiAttributes<any>): MCPTool {
    const attrs = this.extractAttributes(strapiData);

    return {
      id: strapiData.documentId,
      name: attrs.name,
      description: attrs.description || undefined,
      inputSchema: attrs.inputSchema || undefined,
      mcpServer: attrs.mcpServer?.documentId || attrs.mcpServer?.data?.documentId || undefined,
      createdAt: new Date(attrs.createdAt),
      updatedAt: new Date(attrs.updatedAt),
    };
  }

  /**
   * Transform Strapi task response to Task domain model
   */
  private transformTask(strapiData: StrapiAttributes<any>): Task {
    const attrs = this.extractAttributes(strapiData);
    const metadata = attrs.metadata || {};

    return {
      id: strapiData.documentId,
      agentId: attrs.agent?.documentId || attrs.agent?.data?.documentId || attrs.agentId,
      agentName: attrs.agent?.name || attrs.agent?.data?.name || undefined,
      name: metadata.name || attrs.message || 'Unnamed Task',
      description: metadata.description || undefined,
      message: attrs.message,
      status: attrs.status || 'pending',
      result: attrs.result,
      error: attrs.error,
      startedAt: attrs.startedAt ? new Date(attrs.startedAt) : undefined,
      completedAt: attrs.completedAt ? new Date(attrs.completedAt) : undefined,
      executionTime: attrs.executionTime,
      tokensUsed: attrs.tokensUsed,
      cost: attrs.cost,
      metadata: metadata,
      executionLog: attrs.executionLog || [], // Include execution log for viewing
      createdAt: new Date(attrs.createdAt),
      updatedAt: new Date(attrs.updatedAt),
    };
  }

  // ============= DATA PREPARERS =============
  // Prepare domain models for Strapi API

  /**
   * Prepare agent data for Strapi API
   * Updated for component-based structure (Strapi 5)
   */
  private prepareAgentData(agent: Partial<Agent>) {
    const data: any = {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      enabled: agent.enabled,
    };

    // Generate slug from name if name is provided
    // Strapi's auto-generation doesn't always work with programmatic API calls
    if (agent.name) {
      data.slug = generateSlug(agent.name);
    }

    // Component fields - pass through as-is
    if (agent.toolConfig) {
      data.toolConfig = agent.toolConfig;
    }

    if (agent.modelConfig) {
      data.modelConfig = agent.modelConfig;
    }

    if (agent.analytics) {
      data.analytics = agent.analytics;
    }

    if (agent.metadata) {
      data.metadata = agent.metadata;
    }

    // Component-based relations
    if (agent.mcpConfig) {
      data.mcpConfig = agent.mcpConfig;
    }

    if (agent.skillSelection) {
      data.skillSelection = agent.skillSelection;
    }

    if (agent.tasks) {
      data.tasks = agent.tasks;
    }

    return data;
  }

  /**
   * Prepare skill data for Strapi API
   * Updated for component-based structure (Strapi 5)
   */
  private prepareSkillData(skill: Partial<Skill>) {
    const data: any = {
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      skillmd: skill.skillmd, // Correct field name
      experienceScore: skill.experienceScore,
      category: skill.category,
      isPublic: skill.isPublic,
      version: skill.version,
      license: skill.license,
    };

    // Component fields
    if (skill.trainingHistory) {
      data.trainingHistory = skill.trainingHistory;
    }

    if (skill.additionalFiles) {
      data.additionalFiles = skill.additionalFiles;
    }

    if (skill.agentSelection) {
      data.agentSelection = skill.agentSelection;
    }

    if (skill.toolConfig) {
      data.toolConfig = skill.toolConfig;
    }

    if (skill.modelConfig) {
      data.modelConfig = skill.modelConfig;
    }

    if (skill.analytics) {
      data.analytics = skill.analytics;
    }

    if (skill.mcpConfig) {
      data.mcpConfig = skill.mcpConfig;
    }

    if (skill.tasks) {
      data.tasks = skill.tasks;
    }

    if (skill.inputFields) {
      data.inputFields = skill.inputFields;
    }

    // Direct relation
    if (skill.trainingAgent) {
      data.trainingAgent = skill.trainingAgent;
    }

    return data;
  }

  /**
   * Prepare MCP server data for Strapi API
   */
  private prepareMCPServerData(mcp: Partial<MCPServer>) {
    return {
      name: mcp.name,
      command: mcp.command,
      description: mcp.description,
      args: mcp.args,
      env: mcp.env,
      disabled: mcp.disabled,
      transport: mcp.transport,
      healthCheckUrl: mcp.healthCheckUrl,
      startupTimeout: mcp.startupTimeout,
      restartPolicy: mcp.restartPolicy,
    };
  }

  /**
   * Prepare task data for Strapi API
   */
  private prepareTaskData(task: Partial<Task>) {
    return {
      agent: task.agentId,  // Strapi expects 'agent' relation field
      message: task.message,
      status: task.status,
      result: task.result,
      error: task.error,
      startedAt: task.startedAt instanceof Date ? task.startedAt.toISOString() : task.startedAt,
      completedAt: task.completedAt instanceof Date ? task.completedAt.toISOString() : task.completedAt,
      executionTime: task.executionTime,
      tokensUsed: task.tokensUsed,
      cost: task.cost,
      metadata: task.metadata,
      executionLog: task.executionLog, // Include execution log for viewing
    };
  }

  // ============= QUERY BUILDERS =============

  /**
   * Build Strapi query parameters from options
   */
  private buildQueryParams(options?: {
    populate?: string[];
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Record<string, any> {
    const params: Record<string, any> = {};

    if (options?.populate) {
      // Strapi v5 requires array bracket notation: populate[0]=field1&populate[1]=field2
      // Pass array directly, axios will serialize it correctly
      params.populate = options.populate;
    }

    if (options?.filters) {
      params.filters = options.filters;
    }

    if (options?.sort) {
      params.sort = options.sort;
    }

    if (options?.pagination) {
      params.pagination = options.pagination;
    }

    return params;
  }

  // ============= CACHE MANAGEMENT =============

  /**
   * Invalidate all cache entries with a given prefix
   */
  private invalidateCache(prefix: string) {
    const keys = Array.from(this.cache.keys());
    let invalidatedCount = 0;

    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      console.log(`[Strapi] Invalidated ${invalidatedCount} cache entries with prefix "${prefix}"`);
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[Strapi] Cleared ${size} cache entries`);
  }

  /**
   * Get current cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      max: this.cache.max,
      ttl: this.cache.ttl,
    };
  }

  // ============= ERROR HANDLING =============

  /**
   * Handle axios errors with detailed logging
   */
  private handleError(error: AxiosError) {
    if (error.response) {
      // Server responded with error status
      console.error('[Strapi] Response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
      });
    } else if (error.request) {
      // Request made but no response
      console.error('[Strapi] No response received:', {
        message: error.message,
        url: error.config?.url,
      });
    } else {
      // Error in request setup
      console.error('[Strapi] Request setup error:', {
        message: error.message,
        url: error.config?.url,
      });
    }
  }
}

// ============= SINGLETON EXPORT =============

/**
 * Singleton instance of StrapiClient
 * Use this throughout the application for all Strapi interactions
 */
export const strapiClient = new StrapiClient();
