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
   * Get all skills with optional filtering, sorting, and pagination
   *
   * @description
   * Retrieves all skills from Strapi with support for advanced query features including
   * filtering, sorting, pagination, and relation population. Skills automatically populate
   * component fields including trainingHistory, additionalFiles, and mcpConfig for comprehensive
   * skill data. Results are cached with 5-minute TTL for improved performance.
   *
   * **Strapi v5 Component Support:**
   * Skills use component-based architecture with the following component fields:
   * - `trainingHistory`: Array of training records with date, description, score delta, notes
   * - `additionalFiles`: Array of file attachments with file relation (PDFs, docs, images)
   * - `mcpConfig`: MCP server configuration components (array of mcpServer + selectedTools)
   * - `agentSelection`: Agent assignment components (array of agent references)
   * - `toolConfig`: Tool configuration component (file_search, text_editor, etc.)
   * - `modelConfig`: Model configuration component (model, temperature, timeout)
   * - `analytics`: Analytics component (usage stats, performance metrics)
   * - `inputFields`: Dynamic input fields for skill execution
   * - `tasks`: Task assignment components (array of task references)
   *
   * **Default Population:**
   * By default, this method auto-populates all component fields for complete skill data:
   * - `trainingHistory`, `additionalFiles.file`, `mcpConfig.mcpServer`, `mcpConfig.selectedTools.mcpTool`
   * - `agentSelection`, `toolConfig`, `modelConfig`, `analytics`, `inputFields`
   *
   * @param {Object} [options] - Query options for filtering, sorting, and pagination
   * @param {string[]} [options.populate] - Relations/components to populate (defaults to all skill components)
   * @param {Record<string, any>} [options.filters] - Strapi v5 filters object (supports $eq, $ne, $in, $containsi, $and, $or, etc.)
   * @param {string[]} [options.sort] - Sort order array (e.g., ['name:asc', 'experienceScore:desc'])
   * @param {Object} [options.pagination] - Pagination configuration (defaults to { page: 1, pageSize: 100 })
   * @param {number} [options.pagination.page] - Page number (1-indexed)
   * @param {number} [options.pagination.pageSize] - Number of items per page
   *
   * @returns {Promise<Skill[]>} Array of Skill objects with all component fields populated
   *
   * @example
   * // Basic usage - get all skills with auto-populated components
   * const skills = await strapiClient.getAllSkills();
   * console.log(`Found ${skills.length} skills`);
   *
   * // Access populated component data
   * skills.forEach(skill => {
   *   console.log(`Skill: ${skill.displayName}`);
   *   console.log(`Experience: ${skill.experienceScore}`);
   *   console.log(`Training records: ${skill.trainingHistory?.length || 0}`);
   *   console.log(`Additional files: ${skill.additionalFiles?.length || 0}`);
   *   console.log(`MCP servers: ${skill.mcpConfig?.length || 0}`);
   * });
   *
   * @example
   * // Filter public skills only
   * const publicSkills = await strapiClient.getAllSkills({
   *   filters: { isPublic: { $eq: true } }
   * });
   *
   * @example
   * // Filter by category with case-insensitive search
   * const codeSkills = await strapiClient.getAllSkills({
   *   filters: {
   *     category: { $eq: 'coding' }
   *   },
   *   sort: ['experienceScore:desc']
   * });
   *
   * @example
   * // Advanced filtering with multiple conditions
   * const expertSkills = await strapiClient.getAllSkills({
   *   filters: {
   *     $and: [
   *       { isPublic: { $eq: true } },
   *       { experienceScore: { $gte: 50 } },
   *       { category: { $in: ['coding', 'debugging', 'testing'] } }
   *     ]
   *   },
   *   sort: ['experienceScore:desc', 'updatedAt:desc'],
   *   pagination: { page: 1, pageSize: 20 }
   * });
   *
   * @example
   * // Search skills by name or description
   * const searchResults = await strapiClient.getAllSkills({
   *   filters: {
   *     $or: [
   *       { name: { $containsi: 'typescript' } },
   *       { displayName: { $containsi: 'typescript' } },
   *       { description: { $containsi: 'typescript' } }
   *     ]
   *   }
   * });
   *
   * @example
   * // Access trainingHistory component data
   * const skills = await strapiClient.getAllSkills();
   *
   * skills.forEach(skill => {
   *   console.log(`\nSkill: ${skill.displayName}`);
   *   console.log(`Total Experience: ${skill.experienceScore}`);
   *
   *   if (skill.trainingHistory && skill.trainingHistory.length > 0) {
   *     console.log('Training History:');
   *     skill.trainingHistory.forEach((record: any) => {
   *       console.log(`  - ${record.date}: ${record.description}`);
   *       console.log(`    Score change: +${record.scoreChange || 0}`);
   *       if (record.notes) console.log(`    Notes: ${record.notes}`);
   *     });
   *   }
   * });
   *
   * @example
   * // Access additionalFiles component data
   * const skills = await strapiClient.getAllSkills();
   *
   * skills.forEach(skill => {
   *   if (skill.additionalFiles && skill.additionalFiles.length > 0) {
   *     console.log(`\nSkill: ${skill.displayName}`);
   *     console.log('Additional Files:');
   *
   *     skill.additionalFiles.forEach((fileComponent: any) => {
   *       // fileComponent.file is populated via deep population
   *       const file = fileComponent.file;
   *       console.log(`  - ${file?.name || 'unnamed'}`);
   *       console.log(`    URL: ${file?.url}`);
   *       console.log(`    Size: ${file?.size} bytes`);
   *       console.log(`    Type: ${file?.mime}`);
   *       if (fileComponent.description) {
   *         console.log(`    Description: ${fileComponent.description}`);
   *       }
   *     });
   *   }
   * });
   *
   * @example
   * // Access mcpConfig component data
   * const skills = await strapiClient.getAllSkills();
   *
   * skills.forEach(skill => {
   *   if (skill.mcpConfig && skill.mcpConfig.length > 0) {
   *     console.log(`\nSkill: ${skill.displayName}`);
   *     console.log('MCP Configuration:');
   *
   *     skill.mcpConfig.forEach((config: any) => {
   *       // mcpServer and selectedTools are populated
   *       console.log(`  MCP Server: ${config.mcpServer?.name}`);
   *       console.log(`  Transport: ${config.mcpServer?.transport}`);
   *
   *       if (config.selectedTools && config.selectedTools.length > 0) {
   *         console.log('  Selected Tools:');
   *         config.selectedTools.forEach((toolSelection: any) => {
   *           const tool = toolSelection.mcpTool;
   *           console.log(`    - ${tool?.name}: ${tool?.description || 'No description'}`);
   *         });
   *       }
   *     });
   *   }
   * });
   *
   * @example
   * // Pagination - get second page of 20 skills
   * const page2 = await strapiClient.getAllSkills({
   *   pagination: { page: 2, pageSize: 20 },
   *   sort: ['updatedAt:desc']
   * });
   *
   * @see {@link getSkill} for retrieving a single skill with full component population
   * @see {@link getSkillsByIds} for retrieving multiple specific skills
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
   * Get a single skill by ID with all relations and components populated
   *
   * @description
   * Retrieves a single skill by its unique document ID with deep population of all
   * component fields and relations. This method automatically populates all nested data
   * including trainingHistory, additionalFiles with file relations, mcpConfig with
   * MCP server and tool selections, and agent selections.
   *
   * **Auto-populated Components:**
   * - `trainingHistory`: Array of training records tracking skill improvement over time
   * - `additionalFiles`: File attachments with populated file relation (documents, PDFs, images)
   * - `mcpConfig`: MCP server configurations with nested mcpServer and selectedTools.mcpTool relations
   * - `agentSelection`: Agent assignments with nested agent relations
   * - `toolConfig`: Tool configuration with enabled tools
   * - `modelConfig`: Model configuration (model, temperature, timeout)
   * - `analytics`: Usage analytics and performance metrics
   * - `inputFields`: Dynamic input field configurations for skill execution
   * - `tasks`: Task assignments with nested task relations
   * - `trainingAgent`: Direct relation to the agent used for training this skill
   *
   * **Strapi v5 Deep Population:**
   * This method uses deep population syntax to retrieve nested relations within components:
   * ```javascript
   * additionalFiles: {
   *   populate: { file: true }  // Populate file relation inside component
   * }
   * mcpConfig: {
   *   populate: {
   *     mcpServer: true,
   *     selectedTools: { populate: { mcpTool: true } }
   *   }
   * }
   * ```
   *
   * @param {string} id - Skill document ID (UUID format)
   *
   * @returns {Promise<Skill>} Skill object with all components and relations populated
   *
   * @throws {Error} If skill with the specified ID is not found
   *
   * @example
   * // Basic usage - get skill with all relations
   * const skill = await strapiClient.getSkill('skill-id');
   * console.log(skill.displayName);
   * console.log(skill.description);
   * console.log(skill.experienceScore);
   *
   * @example
   * // Access trainingHistory component
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * console.log(`\n${skill.displayName} Training History:`);
   * console.log(`Current Experience Score: ${skill.experienceScore}`);
   *
   * if (skill.trainingHistory && skill.trainingHistory.length > 0) {
   *   skill.trainingHistory.forEach((record: any) => {
   *     console.log(`\nDate: ${new Date(record.date).toLocaleDateString()}`);
   *     console.log(`Description: ${record.description}`);
   *     console.log(`Score Change: +${record.scoreChange || 0}`);
   *     console.log(`Agent: ${record.agentName || 'Unknown'}`);
   *     if (record.notes) {
   *       console.log(`Notes: ${record.notes}`);
   *     }
   *   });
   * } else {
   *   console.log('No training history yet');
   * }
   *
   * @example
   * // Access additionalFiles component with file relation
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * if (skill.additionalFiles && skill.additionalFiles.length > 0) {
   *   console.log(`\n${skill.displayName} Additional Files:`);
   *
   *   skill.additionalFiles.forEach((fileComponent: any, index: number) => {
   *     // fileComponent.file is populated via deep population
   *     const file = fileComponent.file;
   *
   *     console.log(`\nFile ${index + 1}:`);
   *     console.log(`  Name: ${file?.name || 'unnamed'}`);
   *     console.log(`  URL: ${file?.url}`);
   *     console.log(`  MIME: ${file?.mime}`);
   *     console.log(`  Size: ${(file?.size / 1024).toFixed(2)} KB`);
   *
   *     if (fileComponent.description) {
   *       console.log(`  Description: ${fileComponent.description}`);
   *     }
   *
   *     // Download or reference the file
   *     // const fileUrl = `${STRAPI_URL}${file?.url}`;
   *   });
   * }
   *
   * @example
   * // Access mcpConfig component with nested relations
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * if (skill.mcpConfig && skill.mcpConfig.length > 0) {
   *   console.log(`\n${skill.displayName} MCP Configuration:`);
   *
   *   skill.mcpConfig.forEach((config: any, index: number) => {
   *     const server = config.mcpServer;
   *     console.log(`\nMCP Server ${index + 1}:`);
   *     console.log(`  Name: ${server?.name}`);
   *     console.log(`  Transport: ${server?.transport}`);
   *     console.log(`  Command: ${server?.command}`);
   *
   *     if (config.selectedTools && config.selectedTools.length > 0) {
   *       console.log('  Selected Tools:');
   *       config.selectedTools.forEach((toolSelection: any) => {
   *         const tool = toolSelection.mcpTool;
   *         console.log(`    - ${tool?.name}`);
   *         console.log(`      ${tool?.description || 'No description'}`);
   *       });
   *     }
   *   });
   * }
   *
   * @example
   * // Access agent selection and training agent
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * // Check which agents use this skill
   * if (skill.agentSelection && skill.agentSelection.length > 0) {
   *   console.log(`\n${skill.displayName} is used by:`);
   *   skill.agentSelection.forEach((selection: any) => {
   *     const agent = selection.agent;
   *     console.log(`  - ${agent?.name} (${agent?.enabled ? 'enabled' : 'disabled'})`);
   *   });
   * }
   *
   * // Check training agent
   * if (skill.trainingAgent) {
   *   console.log(`\nTrained by: ${skill.trainingAgent}`);
   * }
   *
   * @example
   * // Access inputFields for dynamic skill execution
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * if (skill.inputFields && skill.inputFields.length > 0) {
   *   console.log(`\n${skill.displayName} Input Fields:`);
   *
   *   skill.inputFields.forEach((field: any) => {
   *     console.log(`\nField: ${field.name}`);
   *     console.log(`  Label: ${field.label}`);
   *     console.log(`  Type: ${field.type}`);
   *     console.log(`  Required: ${field.required ? 'Yes' : 'No'}`);
   *     if (field.defaultValue) {
   *       console.log(`  Default: ${field.defaultValue}`);
   *     }
   *     if (field.placeholder) {
   *       console.log(`  Placeholder: ${field.placeholder}`);
   *     }
   *   });
   * }
   *
   * @example
   * // Error handling for non-existent skill
   * try {
   *   const skill = await strapiClient.getSkill('non-existent-id');
   * } catch (error) {
   *   console.error('Skill not found:', error.message);
   *   // Error: Skill with ID non-existent-id not found
   * }
   *
   * @example
   * // Complete skill inspection workflow
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * console.log(`\n=== ${skill.displayName} ===`);
   * console.log(`Category: ${skill.category}`);
   * console.log(`Version: ${skill.version}`);
   * console.log(`Experience: ${skill.experienceScore}`);
   * console.log(`Public: ${skill.isPublic ? 'Yes' : 'No'}`);
   * console.log(`\nDescription:\n${skill.description}`);
   * console.log(`\nSkill Content:\n${skill.skillmd.substring(0, 200)}...`);
   *
   * // Check configuration
   * if (skill.modelConfig) {
   *   console.log(`\nModel Config: ${skill.modelConfig.model} @ ${skill.modelConfig.temperature}`);
   * }
   *
   * // Check analytics
   * if (skill.analytics) {
   *   console.log(`\nUsage: ${skill.analytics.usageCount || 0} times`);
   *   console.log(`Success Rate: ${skill.analytics.successRate || 0}%`);
   * }
   *
   * @see {@link getAllSkills} for querying multiple skills with filters
   * @see {@link updateSkill} for modifying skill data
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
   * Get multiple skills by their IDs with all components populated
   *
   * @description
   * Retrieves multiple skills by an array of document IDs. This is a convenience method
   * that uses `getAllSkills` with a filter for the specified IDs. All component fields
   * (trainingHistory, additionalFiles, mcpConfig, etc.) are automatically populated.
   *
   * **Use Cases:**
   * - Bulk fetch skills for an agent's skillSelection
   * - Load skills from a saved configuration or preset
   * - Retrieve related skills for comparison or grouping
   * - Hydrate skill references from other entities
   *
   * @param {string[]} ids - Array of skill document IDs (UUID format)
   *
   * @returns {Promise<Skill[]>} Array of Skill objects with all components populated
   * Returns empty array if no IDs provided or no skills found
   *
   * @example
   * // Basic usage - fetch multiple skills by IDs
   * const skillIds = ['skill-id-1', 'skill-id-2', 'skill-id-3'];
   * const skills = await strapiClient.getSkillsByIds(skillIds);
   *
   * console.log(`Fetched ${skills.length} skills`);
   * skills.forEach(skill => {
   *   console.log(`- ${skill.displayName} (${skill.category})`);
   * });
   *
   * @example
   * // Load skills from agent's skillSelection
   * const agent = await strapiClient.getAgent('agent-id');
   *
   * // Extract skill IDs from skillSelection components
   * const skillIds = agent.skillSelection?.map((selection: any) => selection.skill?.id || selection.skill).filter(Boolean) || [];
   *
   * // Fetch all skills at once
   * const skills = await strapiClient.getSkillsByIds(skillIds);
   *
   * console.log(`Agent "${agent.name}" has ${skills.length} skills:`);
   * skills.forEach(skill => {
   *   console.log(`  - ${skill.displayName}: ${skill.description}`);
   * });
   *
   * @example
   * // Handle empty array gracefully
   * const skills = await strapiClient.getSkillsByIds([]);
   * console.log(skills); // []
   *
   * @example
   * // Fetch skills and group by category
   * const skillIds = ['id1', 'id2', 'id3', 'id4'];
   * const skills = await strapiClient.getSkillsByIds(skillIds);
   *
   * const byCategory = skills.reduce((acc: any, skill) => {
   *   const category = skill.category || 'uncategorized';
   *   if (!acc[category]) acc[category] = [];
   *   acc[category].push(skill);
   *   return acc;
   * }, {});
   *
   * Object.entries(byCategory).forEach(([category, categorySkills]: [string, any]) => {
   *   console.log(`\n${category}:`);
   *   categorySkills.forEach((skill: any) => {
   *     console.log(`  - ${skill.displayName}`);
   *   });
   * });
   *
   * @example
   * // Check which skills have additional files
   * const skillIds = ['id1', 'id2', 'id3'];
   * const skills = await strapiClient.getSkillsByIds(skillIds);
   *
   * const skillsWithFiles = skills.filter(skill =>
   *   skill.additionalFiles && skill.additionalFiles.length > 0
   * );
   *
   * console.log(`${skillsWithFiles.length} skills have additional files:`);
   * skillsWithFiles.forEach(skill => {
   *   console.log(`  - ${skill.displayName}: ${skill.additionalFiles.length} files`);
   * });
   *
   * @example
   * // Calculate total experience across skills
   * const skillIds = ['id1', 'id2', 'id3'];
   * const skills = await strapiClient.getSkillsByIds(skillIds);
   *
   * const totalExperience = skills.reduce((sum, skill) => sum + (skill.experienceScore || 0), 0);
   * const avgExperience = skills.length > 0 ? totalExperience / skills.length : 0;
   *
   * console.log(`Total Experience: ${totalExperience}`);
   * console.log(`Average Experience: ${avgExperience.toFixed(1)}`);
   *
   * @see {@link getAllSkills} for advanced filtering options
   * @see {@link getSkill} for retrieving a single skill
   */
  async getSkillsByIds(ids: string[]): Promise<Skill[]> {
    if (ids.length === 0) return [];

    const filters = {
      documentId: { $in: ids },
    };

    return this.getAllSkills({ filters });
  }

  /**
   * Create a new skill with component-based configuration
   *
   * @description
   * Creates a new skill in Strapi with support for component-based architecture including
   * trainingHistory, additionalFiles, and mcpConfig. All component fields are supported
   * in Strapi v5 format.
   *
   * **Component Fields:**
   * - `trainingHistory`: Initialize training records (array of { date, description, scoreChange, notes })
   * - `additionalFiles`: Attach files (array of { file: uploadedFileId, description })
   * - `mcpConfig`: Configure MCP servers (array of { mcpServer: id, selectedTools: [...] })
   * - `agentSelection`: Assign agents (array of { agent: id })
   * - `toolConfig`: Configure enabled tools (file_search, text_editor, etc.)
   * - `modelConfig`: Configure model settings (model, temperature, timeout)
   * - `analytics`: Initialize analytics tracking
   * - `inputFields`: Define dynamic input fields (array of { name, label, type, required, defaultValue })
   * - `tasks`: Assign tasks (array of { task: id })
   * - `trainingAgent`: Reference to training agent (agent ID)
   *
   * **Cache Invalidation:**
   * Creating a skill invalidates all cached skill queries to ensure fresh data.
   *
   * @param {CreateSkillDTO} skillData - Skill data transfer object
   * @param {string} skillData.name - Skill identifier (slug-friendly, required)
   * @param {string} skillData.displayName - Human-readable name (required)
   * @param {string} skillData.description - Skill description (required)
   * @param {string} skillData.skillmd - Skill content in markdown format (required)
   * @param {number} [skillData.experienceScore=0] - Initial experience score
   * @param {string} [skillData.category='custom'] - Skill category
   * @param {boolean} [skillData.isPublic=true] - Whether the skill is publicly visible
   * @param {string} [skillData.version='1.0.0'] - Skill version
   * @param {string} [skillData.license] - License identifier
   * @param {Array} [skillData.trainingHistory] - Training history records
   * @param {Array} [skillData.additionalFiles] - File attachment components
   * @param {Array} [skillData.mcpConfig] - MCP server configuration components
   * @param {Array} [skillData.agentSelection] - Agent assignment components
   * @param {Object} [skillData.toolConfig] - Tool configuration
   * @param {Object} [skillData.modelConfig] - Model configuration
   * @param {Object} [skillData.analytics] - Analytics data
   * @param {Array} [skillData.inputFields] - Input field definitions
   * @param {Array} [skillData.tasks] - Task assignments
   * @param {string} [skillData.trainingAgent] - Training agent ID
   *
   * @returns {Promise<Skill>} Created skill with generated ID and auto-populated defaults
   *
   * @throws {Error} If skill creation fails (validation errors, network errors)
   *
   * @example
   * // Basic skill creation with minimal fields
   * const skill = await strapiClient.createSkill({
   *   name: 'typescript-expert',
   *   displayName: 'TypeScript Expert',
   *   description: 'Expert knowledge in TypeScript programming',
   *   skillmd: '# TypeScript Expert\n\nProvides expert TypeScript development assistance.',
   *   category: 'coding',
   *   experienceScore: 0
   * });
   *
   * console.log(skill.id);   // Auto-generated UUID
   * console.log(skill.version); // Default: '1.0.0'
   * console.log(skill.isPublic); // Default: true
   *
   * @example
   * // Create skill with trainingHistory component
   * const skill = await strapiClient.createSkill({
   *   name: 'debugging-expert',
   *   displayName: 'Debugging Expert',
   *   description: 'Expert in debugging complex issues',
   *   skillmd: '# Debugging Expert\n\nHelps identify and fix bugs.',
   *   category: 'debugging',
   *   experienceScore: 25,
   *   trainingHistory: [
   *     {
   *       date: new Date().toISOString(),
   *       description: 'Initial training on React debugging',
   *       scoreChange: 10,
   *       agentName: 'Training Agent',
   *       notes: 'Learned component lifecycle debugging'
   *     },
   *     {
   *       date: new Date().toISOString(),
   *       description: 'Advanced async debugging training',
   *       scoreChange: 15,
   *       agentName: 'Advanced Trainer',
   *       notes: 'Mastered Promise rejection handling'
   *     }
   *   ]
   * });
   *
   * console.log(`Skill created with ${skill.trainingHistory.length} training records`);
   *
   * @example
   * // Create skill with additionalFiles component
   * // First, upload files to Strapi Media Library
   * import fs from 'fs';
   *
   * const guideFile = fs.readFileSync('./typescript-guide.pdf');
   * const examplesFile = fs.readFileSync('./examples.zip');
   *
   * const uploadedGuide = await strapiClient.uploadFile(guideFile, 'typescript-guide.pdf');
   * const uploadedExamples = await strapiClient.uploadFile(examplesFile, 'examples.zip');
   *
   * // Create skill with file attachments
   * const skill = await strapiClient.createSkill({
   *   name: 'typescript-advanced',
   *   displayName: 'Advanced TypeScript',
   *   description: 'Advanced TypeScript patterns',
   *   skillmd: '# Advanced TypeScript\n\nRefer to attached guide and examples.',
   *   category: 'coding',
   *   additionalFiles: [
   *     {
   *       file: uploadedGuide.documentId,
   *       description: 'Comprehensive TypeScript guide'
   *     },
   *     {
   *       file: uploadedExamples.documentId,
   *       description: 'Code examples and templates'
   *     }
   *   ]
   * });
   *
   * console.log(`Skill created with ${skill.additionalFiles.length} attached files`);
   *
   * @example
   * // Create skill with mcpConfig component
   * // First, get MCP servers and tools from Strapi
   * const mcpServers = await strapiClient.getAllMCPServers();
   * const filesystemServer = mcpServers.find(s => s.name === 'filesystem');
   * const filesystemTools = await strapiClient.getMCPToolsByServerId(filesystemServer.id);
   *
   * const skill = await strapiClient.createSkill({
   *   name: 'file-operations',
   *   displayName: 'File Operations',
   *   description: 'Expert in file system operations',
   *   skillmd: '# File Operations\n\nUses filesystem MCP tools.',
   *   category: 'system',
   *   mcpConfig: [
   *     {
   *       mcpServer: filesystemServer.id,
   *       selectedTools: filesystemTools.slice(0, 5).map(tool => ({
   *         mcpTool: tool.id
   *       }))
   *     }
   *   ]
   * });
   *
   * console.log(`Skill created with ${skill.mcpConfig.length} MCP server config`);
   *
   * @example
   * // Create skill with inputFields component for dynamic execution
   * const skill = await strapiClient.createSkill({
   *   name: 'code-generator',
   *   displayName: 'Code Generator',
   *   description: 'Generates code based on user input',
   *   skillmd: '# Code Generator\n\nGenerates code from templates.',
   *   category: 'coding',
   *   inputFields: [
   *     {
   *       name: 'language',
   *       label: 'Programming Language',
   *       type: 'select',
   *       required: true,
   *       options: ['TypeScript', 'JavaScript', 'Python', 'Go'],
   *       defaultValue: 'TypeScript'
   *     },
   *     {
   *       name: 'framework',
   *       label: 'Framework',
   *       type: 'text',
   *       required: false,
   *       placeholder: 'e.g., React, Express, FastAPI'
   *     },
   *     {
   *       name: 'features',
   *       label: 'Features to Include',
   *       type: 'textarea',
   *       required: true,
   *       placeholder: 'Describe the features you want...'
   *     }
   *   ]
   * });
   *
   * console.log(`Skill created with ${skill.inputFields.length} input fields`);
   *
   * @example
   * // Create skill with custom model and tool configuration
   * const skill = await strapiClient.createSkill({
   *   name: 'data-analyst',
   *   displayName: 'Data Analyst',
   *   description: 'Analyzes data and generates insights',
   *   skillmd: '# Data Analyst\n\nPerforms data analysis tasks.',
   *   category: 'analytics',
   *   modelConfig: {
   *     model: 'opus',
   *     temperature: 0.3,
   *     max_tokens: 8192,
   *     timeout: 600000
   *   },
   *   toolConfig: {
   *     file_search: true,
   *     text_editor: false,
   *     bash_20241022: true,
   *     computer_20241022: false
   *   },
   *   analytics: {
   *     usageCount: 0,
   *     successRate: 100,
   *     avgExecutionTime: 0
   *   }
   * });
   *
   * @example
   * // Error handling for validation failures
   * try {
   *   const skill = await strapiClient.createSkill({
   *     name: '', // Invalid: empty name
   *     displayName: 'Test',
   *     description: 'Test skill',
   *     skillmd: '# Test'
   *   });
   * } catch (error) {
   *   console.error('Validation failed:', error.message);
   * }
   *
   * @see {@link updateSkill} for updating existing skills
   * @see {@link getSkill} for retrieving created skill with full details
   * @see {@link uploadFile} for uploading files before attaching to skills
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
   * Update an existing skill with partial data
   *
   * @description
   * Updates an existing skill in Strapi using partial update semantics. Only the fields
   * provided in the update DTO will be modified; omitted fields remain unchanged. This
   * method supports updating all component fields including trainingHistory, additionalFiles,
   * and mcpConfig in Strapi v5 format.
   *
   * **Partial Updates:**
   * You can update individual fields without affecting other fields:
   * - Update only `displayName` without changing `skillmd`
   * - Update only `experienceScore` without changing `trainingHistory`
   * - Update only specific components without affecting others
   *
   * **Component Field Updates:**
   * - `trainingHistory`: Replace training records (array replacement, not merge)
   * - `additionalFiles`: Replace file attachments (array replacement)
   * - `mcpConfig`: Replace MCP server configurations (array replacement)
   * - `agentSelection`: Replace agent assignments (array replacement)
   * - `toolConfig`: Update tool enablement settings
   * - `modelConfig`: Update model configuration
   * - `analytics`: Update analytics data
   * - `inputFields`: Replace input field definitions (array replacement)
   * - `tasks`: Replace task assignments (array replacement)
   * - `trainingAgent`: Update training agent reference
   *
   * **Important: Array Field Behavior**
   * Arrays are replaced, not merged. To add items, fetch current data first:
   * ```javascript
   * const skill = await strapiClient.getSkill('skill-id');
   * await strapiClient.updateSkill('skill-id', {
   *   trainingHistory: [...skill.trainingHistory, newRecord]
   * });
   * ```
   *
   * **Cache Invalidation:**
   * Updating a skill invalidates both the specific skill cache and all skill list caches.
   *
   * @param {string} id - Skill document ID to update
   * @param {UpdateSkillDTO} skillData - Partial skill data to update
   * @param {string} [skillData.name] - Update skill identifier
   * @param {string} [skillData.displayName] - Update display name
   * @param {string} [skillData.description] - Update description
   * @param {string} [skillData.skillmd] - Update skill content
   * @param {number} [skillData.experienceScore] - Update experience score
   * @param {string} [skillData.category] - Update category
   * @param {boolean} [skillData.isPublic] - Update visibility
   * @param {string} [skillData.version] - Update version
   * @param {string} [skillData.license] - Update license
   * @param {Array} [skillData.trainingHistory] - Replace training history
   * @param {Array} [skillData.additionalFiles] - Replace file attachments
   * @param {Array} [skillData.mcpConfig] - Replace MCP config
   * @param {Array} [skillData.agentSelection] - Replace agent assignments
   * @param {Object} [skillData.toolConfig] - Update tool config
   * @param {Object} [skillData.modelConfig] - Update model config
   * @param {Object} [skillData.analytics] - Update analytics
   * @param {Array} [skillData.inputFields] - Replace input fields
   * @param {Array} [skillData.tasks] - Replace task assignments
   * @param {string} [skillData.trainingAgent] - Update training agent
   *
   * @returns {Promise<Skill>} Updated skill with all components populated
   *
   * @throws {Error} If skill with specified ID is not found or update fails
   *
   * @example
   * // Basic update - change display name and description
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   displayName: 'TypeScript Pro',
   *   description: 'Professional TypeScript development expertise'
   * });
   *
   * @example
   * // Update experience score after training
   * const skill = await strapiClient.updateSkill('skill-id', {
   *   experienceScore: 75
   * });
   *
   * @example
   * // Add new training record (requires fetching current first)
   * const currentSkill = await strapiClient.getSkill('skill-id');
   *
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   experienceScore: currentSkill.experienceScore + 10,
   *   trainingHistory: [
   *     ...(currentSkill.trainingHistory || []),
   *     {
   *       date: new Date().toISOString(),
   *       description: 'Completed advanced debugging training',
   *       scoreChange: 10,
   *       agentName: 'Training Bot',
   *       notes: 'Improved error handling and async debugging'
   *     }
   *   ]
   * });
   *
   * console.log(`Skill now has ${updatedSkill.trainingHistory.length} training records`);
   * console.log(`New experience score: ${updatedSkill.experienceScore}`);
   *
   * @example
   * // Add additional file to existing skill
   * import fs from 'fs';
   *
   * // Upload new file first
   * const cheatsheetFile = fs.readFileSync('./cheatsheet.pdf');
   * const uploadedFile = await strapiClient.uploadFile(cheatsheetFile, 'cheatsheet.pdf');
   *
   * // Fetch current skill
   * const currentSkill = await strapiClient.getSkill('skill-id');
   *
   * // Add new file to existing files
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   additionalFiles: [
   *     ...(currentSkill.additionalFiles || []),
   *     {
   *       file: uploadedFile.documentId,
   *       description: 'Quick reference cheatsheet'
   *     }
   *   ]
   * });
   *
   * console.log(`Skill now has ${updatedSkill.additionalFiles.length} files`);
   *
   * @example
   * // Update MCP configuration
   * const mcpServers = await strapiClient.getAllMCPServers();
   * const githubServer = mcpServers.find(s => s.name === 'github');
   * const githubTools = await strapiClient.getMCPToolsByServerId(githubServer.id);
   *
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   mcpConfig: [
   *     {
   *       mcpServer: githubServer.id,
   *       selectedTools: githubTools.slice(0, 3).map(tool => ({
   *         mcpTool: tool.id
   *       }))
   *     }
   *   ]
   * });
   *
   * @example
   * // Update model and tool configuration
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   modelConfig: {
   *     model: 'sonnet',
   *     temperature: 0.8,
   *     max_tokens: 4096,
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
   * // Update skill visibility and version
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   isPublic: true,
   *   version: '2.0.0'
   * });
   *
   * @example
   * // Update skill content (skillmd)
   * const newContent = `
   * # Advanced TypeScript
   *
   * ## Updated Content
   * This skill now includes advanced patterns for:
   * - Type guards and discriminated unions
   * - Generic constraints and inference
   * - Conditional types and mapped types
   *
   * ## Examples
   * ...
   * `;
   *
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   skillmd: newContent,
   *   version: '2.1.0'
   * });
   *
   * @example
   * // Update analytics after skill execution
   * const currentSkill = await strapiClient.getSkill('skill-id');
   *
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   analytics: {
   *     usageCount: (currentSkill.analytics?.usageCount || 0) + 1,
   *     successRate: 95,
   *     avgExecutionTime: 2500,
   *     lastUsed: new Date().toISOString()
   *   }
   * });
   *
   * @example
   * // Bulk update - change multiple fields at once
   * const updatedSkill = await strapiClient.updateSkill('skill-id', {
   *   displayName: 'Expert TypeScript Developer',
   *   description: 'Master-level TypeScript expertise',
   *   category: 'coding',
   *   experienceScore: 100,
   *   version: '3.0.0',
   *   modelConfig: {
   *     model: 'opus',
   *     temperature: 0.5,
   *     timeout: 600000
   *   }
   * });
   *
   * @example
   * // Error handling for non-existent skill
   * try {
   *   const skill = await strapiClient.updateSkill('non-existent-id', {
   *     displayName: 'New Name'
   *   });
   * } catch (error) {
   *   console.error('Update failed:', error.message);
   *   // Error: Failed to update skill with ID non-existent-id
   * }
   *
   * @see {@link createSkill} for creating new skills
   * @see {@link getSkill} for retrieving current skill state before update
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
   * Delete a skill permanently from Strapi
   *
   * @description
   * Permanently deletes a skill from the Strapi database. This operation cannot be undone.
   * All associated component data (trainingHistory, additionalFiles references, mcpConfig,
   * agentSelection, etc.) is also deleted as they are part of the skill entity.
   *
   * **Important Considerations:**
   * - This is a permanent deletion - there is no soft delete or trash bin
   * - All component data is deleted with the skill
   * - File attachments in additionalFiles are NOT deleted from Media Library (only references)
   * - Related entities (Agents, MCP Servers, Tasks) are NOT deleted (only the associations)
   * - Agents using this skill will have broken references in their skillSelection
   * - Cache is automatically invalidated after deletion
   *
   * **Best Practices:**
   * - Consider setting `isPublic: false` instead of deleting to preserve history
   * - Verify the skill ID before deletion to prevent accidental deletions
   * - Check which agents use the skill before deletion (via agentSelection)
   * - Export skill data before deletion if you may need it later
   * - Clean up file attachments separately if no longer needed
   *
   * @param {string} id - Skill document ID to delete
   *
   * @returns {Promise<void>} Resolves when deletion is complete
   *
   * @throws {Error} If skill with specified ID is not found or deletion fails
   *
   * @example
   * // Basic deletion
   * await strapiClient.deleteSkill('skill-id-to-delete');
   * console.log('Skill deleted successfully');
   *
   * @example
   * // Safe deletion with confirmation and dependency check
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * console.log(`About to delete skill: ${skill.displayName}`);
   * console.log(`Category: ${skill.category}`);
   * console.log(`Experience: ${skill.experienceScore}`);
   *
   * // Check which agents use this skill
   * if (skill.agentSelection && skill.agentSelection.length > 0) {
   *   console.warn(`Warning: This skill is used by ${skill.agentSelection.length} agents:`);
   *   skill.agentSelection.forEach((selection: any) => {
   *     console.log(`  - ${selection.agent?.name || 'Unknown agent'}`);
   *   });
   * }
   *
   * // In a real application, prompt user for confirmation here
   * const confirmed = true; // User confirmation
   *
   * if (confirmed) {
   *   await strapiClient.deleteSkill(skill.id);
   *   console.log('Skill deleted');
   * }
   *
   * @example
   * // Alternative: Hide instead of delete (preserves history)
   * // This is often preferred over permanent deletion
   * const skill = await strapiClient.updateSkill('skill-id', {
   *   isPublic: false
   * });
   * console.log('Skill hidden (not deleted)');
   *
   * @example
   * // Export skill data before deletion
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * // Save configuration to file or backup system
   * const backup = {
   *   name: skill.name,
   *   displayName: skill.displayName,
   *   description: skill.description,
   *   skillmd: skill.skillmd,
   *   category: skill.category,
   *   experienceScore: skill.experienceScore,
   *   version: skill.version,
   *   trainingHistory: skill.trainingHistory,
   *   additionalFiles: skill.additionalFiles,
   *   mcpConfig: skill.mcpConfig,
   *   modelConfig: skill.modelConfig,
   *   toolConfig: skill.toolConfig,
   *   inputFields: skill.inputFields,
   *   exportedAt: new Date().toISOString()
   * };
   *
   * // fs.writeFileSync(`./backups/skill-${skill.id}.json`, JSON.stringify(backup, null, 2));
   *
   * // Now safe to delete
   * await strapiClient.deleteSkill(skill.id);
   *
   * @example
   * // Clean up attached files before deleting skill
   * const skill = await strapiClient.getSkill('skill-id');
   *
   * // Delete file attachments from Media Library
   * if (skill.additionalFiles && skill.additionalFiles.length > 0) {
   *   for (const fileComponent of skill.additionalFiles) {
   *     const file = fileComponent.file;
   *     if (file?.documentId) {
   *       await strapiClient.deleteFile(file.documentId);
   *       console.log(`Deleted file: ${file.name}`);
   *     }
   *   }
   * }
   *
   * // Now delete the skill
   * await strapiClient.deleteSkill(skill.id);
   * console.log('Skill and all attached files deleted');
   *
   * @example
   * // Error handling for non-existent skill
   * try {
   *   await strapiClient.deleteSkill('non-existent-id');
   * } catch (error) {
   *   console.error('Deletion failed:', error.message);
   *   // Handle error (skill not found, network error, etc.)
   * }
   *
   * @example
   * // Batch deletion with dependency checks (use with caution!)
   * const skillsToDelete = await strapiClient.getAllSkills({
   *   filters: {
   *     $and: [
   *       { isPublic: false },
   *       { experienceScore: { $lt: 10 } },
   *       { updatedAt: { $lt: '2024-01-01' } }
   *     ]
   *   }
   * });
   *
   * console.log(`Found ${skillsToDelete.length} skills to delete`);
   *
   * for (const skill of skillsToDelete) {
   *   // Check if skill is used by any agents
   *   const isUsed = skill.agentSelection && skill.agentSelection.length > 0;
   *
   *   if (!isUsed) {
   *     console.log(`Deleting ${skill.displayName}...`);
   *     await strapiClient.deleteSkill(skill.id);
   *   } else {
   *     console.log(`Skipping ${skill.displayName} (in use by agents)`);
   *   }
   * }
   *
   * console.log('Batch deletion complete');
   *
   * @see {@link updateSkill} for hiding skills without deletion
   * @see {@link getSkill} for retrieving skill details before deletion
   * @see {@link deleteFile} for cleaning up attached files
   */
  async deleteSkill(id: string): Promise<void> {
    await this.client.delete(`/skills/${id}`);
    this.invalidateCache('skills');
    this.cache.delete(`skill:${id}`);
  }

  // ============= MCP SERVERS =============

  /**
   * Get all MCP servers with optional filtering
   *
   * @description
   * Retrieves all MCP (Model Context Protocol) servers from Strapi database with
   * optional filtering and population of related tools. Supports Strapi v5 filter
   * operators for advanced querying.
   *
   * **Filter Operators:**
   * - `$eq`: Equal to
   * - `$ne`: Not equal to
   * - `$in`: In array
   * - `$notIn`: Not in array
   * - `$containsi`: Case-insensitive contains
   * - `$and`, `$or`: Logical operators
   *
   * **Population:**
   * Set `populate: true` to include related `mcpTools` in the response.
   *
   * **Cache Behavior:**
   * Results are cached using options as cache key. Cache is invalidated on any
   * MCP server create/update/delete operation.
   *
   * @param {Object} [options] - Query options
   * @param {Object} [options.filters] - Strapi v5 filters object
   * @param {boolean} [options.populate] - If true, populates mcpTools relation
   * @returns {Promise<MCPServer[]>} Array of MCP servers
   *
   * @example
   * // Get all MCP servers
   * const allServers = await strapiClient.getAllMCPServers();
   * console.log(allServers.length); // e.g., 5
   *
   * @example
   * // Get only enabled MCP servers
   * const enabledServers = await strapiClient.getAllMCPServers({
   *   filters: { enabled: { $eq: true } }
   * });
   *
   * @example
   * // Get MCP servers with specific transport type
   * const stdioServers = await strapiClient.getAllMCPServers({
   *   filters: { transportType: { $eq: 'stdio' } }
   * });
   *
   * @example
   * // Get MCP servers with tools populated
   * const serversWithTools = await strapiClient.getAllMCPServers({
   *   populate: true
   * });
   * serversWithTools.forEach(server => {
   *   console.log(`${server.name}: ${server.mcpTools?.length || 0} tools`);
   * });
   *
   * @example
   * // Filter by server name (case-insensitive)
   * const filesystemServers = await strapiClient.getAllMCPServers({
   *   filters: { name: { $containsi: 'filesystem' } }
   * });
   *
   * @example
   * // Get multiple servers by transport type
   * const sdkOrStdioServers = await strapiClient.getAllMCPServers({
   *   filters: {
   *     transportType: { $in: ['stdio', 'sdk'] }
   *   },
   *   populate: true
   * });
   *
   * @see {@link getMCPServer} for retrieving a single MCP server by ID
   * @see {@link createMCPServer} for creating new MCP servers
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
   *
   * @description
   * Retrieves a single MCP server by its document ID with all relations populated.
   * Automatically populates the `mcpTools` relation to include all tools associated
   * with this server.
   *
   * **Cache Behavior:**
   * Individual servers are cached by ID. Cache is invalidated when the server is
   * updated or deleted.
   *
   * **Error Handling:**
   * Throws an error if the server with the specified ID is not found.
   *
   * @param {string} id - MCP server document ID
   * @returns {Promise<MCPServer>} MCP server with populated tools
   * @throws {Error} If MCP server with ID not found
   *
   * @example
   * // Get MCP server by ID
   * const server = await strapiClient.getMCPServer('abc123xyz');
   * console.log(server.name);          // e.g., 'filesystem'
   * console.log(server.transportType); // e.g., 'stdio'
   * console.log(server.mcpTools?.length); // e.g., 15
   *
   * @example
   * // Inspect server configuration
   * const server = await strapiClient.getMCPServer('abc123xyz');
   * if (server.transportType === 'stdio') {
   *   console.log('Command:', server.command);
   *   console.log('Args:', server.args);
   *   console.log('Env:', server.env);
   * }
   *
   * @example
   * // Access populated tools
   * const server = await strapiClient.getMCPServer('abc123xyz');
   * const enabledTools = server.mcpTools?.filter(tool => tool.enabled) || [];
   * console.log(`${enabledTools.length} enabled tools`);
   *
   * @example
   * // Error handling for not found
   * try {
   *   const server = await strapiClient.getMCPServer('invalid-id');
   * } catch (error) {
   *   console.error('Server not found:', error.message);
   *   // Error: MCP Server with ID invalid-id not found
   * }
   *
   * @see {@link getAllMCPServers} for retrieving multiple MCP servers
   * @see {@link updateMCPServer} for updating server configuration
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
   *
   * @description
   * Creates a new MCP (Model Context Protocol) server in Strapi database. Supports both
   * stdio (external process) and SDK (in-process) transport types. After creation, the
   * server can be configured with tools via `bulkSyncMCPTools`.
   *
   * **Transport Types:**
   * - `stdio`: External process communication via stdin/stdout (requires command, args, env)
   * - `sdk`: In-process SDK server (requires no additional config)
   *
   * **Cache Invalidation:**
   * Creating a server invalidates all MCP server list caches.
   *
   * @param {CreateMCPServerDTO} mcpData - MCP server data to create
   * @param {string} mcpData.name - Server name (e.g., 'filesystem', 'github')
   * @param {string} [mcpData.description] - Optional server description
   * @param {'stdio' | 'sdk'} mcpData.transportType - Transport type
   * @param {string} [mcpData.command] - Command to execute (stdio only)
   * @param {string[]} [mcpData.args] - Command arguments (stdio only)
   * @param {Record<string, string>} [mcpData.env] - Environment variables (stdio only)
   * @param {boolean} [mcpData.enabled] - Enable/disable server (default: true)
   * @returns {Promise<MCPServer>} Created MCP server
   * @throws {Error} If creation fails
   *
   * @example
   * // Create stdio MCP server
   * const server = await strapiClient.createMCPServer({
   *   name: 'filesystem',
   *   description: 'Local filesystem access',
   *   transportType: 'stdio',
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/me/projects'],
   *   enabled: true
   * });
   * console.log(server.id); // Auto-generated UUID
   *
   * @example
   * // Create stdio server with environment variables
   * const githubServer = await strapiClient.createMCPServer({
   *   name: 'github',
   *   description: 'GitHub repository access',
   *   transportType: 'stdio',
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-github'],
   *   env: {
   *     GITHUB_TOKEN: process.env.GITHUB_TOKEN || ''
   *   },
   *   enabled: true
   * });
   *
   * @example
   * // Create SDK MCP server (in-process)
   * const sdkServer = await strapiClient.createMCPServer({
   *   name: 'custom-sdk-server',
   *   description: 'Custom in-process MCP server',
   *   transportType: 'sdk',
   *   enabled: true
   * });
   *
   * @example
   * // Create disabled server for later activation
   * const server = await strapiClient.createMCPServer({
   *   name: 'puppeteer',
   *   description: 'Browser automation (disabled by default)',
   *   transportType: 'stdio',
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-puppeteer'],
   *   enabled: false // Disabled until needed
   * });
   *
   * @example
   * // Create server then sync tools
   * const server = await strapiClient.createMCPServer({
   *   name: 'filesystem',
   *   transportType: 'stdio',
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
   * });
   *
   * // Fetch and sync tools from the server
   * const fetchedTools = [
   *   { name: 'read_file', description: 'Read file contents' },
   *   { name: 'write_file', description: 'Write file contents' }
   * ];
   * await strapiClient.bulkSyncMCPTools(server.id, fetchedTools);
   *
   * @see {@link updateMCPServer} for updating server configuration
   * @see {@link bulkSyncMCPTools} for syncing server tools
   * @see {@link deleteMCPServer} for deleting servers
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
   *
   * @description
   * Updates an existing MCP server using partial update semantics. Only the fields
   * provided in the update DTO will be modified; omitted fields remain unchanged.
   *
   * **Partial Updates:**
   * You can update individual fields without affecting other fields:
   * - Update only `enabled` without changing `command` or `args`
   * - Update only `description` without changing configuration
   * - Update environment variables without changing command
   *
   * **Cache Invalidation:**
   * Updating invalidates both the specific server cache and all server list caches.
   *
   * @param {string} id - MCP server document ID
   * @param {UpdateMCPServerDTO} mcpData - Partial server data to update
   * @param {string} [mcpData.name] - Update server name
   * @param {string} [mcpData.description] - Update description
   * @param {boolean} [mcpData.enabled] - Update enabled status
   * @param {string} [mcpData.command] - Update command (stdio only)
   * @param {string[]} [mcpData.args] - Update arguments (stdio only)
   * @param {Record<string, string>} [mcpData.env] - Update environment variables (stdio only)
   * @returns {Promise<MCPServer>} Updated MCP server
   * @throws {Error} If update fails or server not found
   *
   * @example
   * // Enable/disable MCP server
   * const server = await strapiClient.updateMCPServer('abc123', {
   *   enabled: false // Temporarily disable
   * });
   * console.log(server.enabled); // false
   *
   * @example
   * // Update server description
   * const server = await strapiClient.updateMCPServer('abc123', {
   *   description: 'Updated description with more details'
   * });
   *
   * @example
   * // Update command arguments
   * const server = await strapiClient.updateMCPServer('abc123', {
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path']
   * });
   *
   * @example
   * // Update environment variables
   * const server = await strapiClient.updateMCPServer('abc123', {
   *   env: {
   *     GITHUB_TOKEN: process.env.NEW_GITHUB_TOKEN || '',
   *     DEBUG: 'true'
   *   }
   * });
   *
   * @example
   * // Update multiple fields
   * const server = await strapiClient.updateMCPServer('abc123', {
   *   name: 'filesystem-v2',
   *   description: 'Updated filesystem server',
   *   enabled: true,
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
   * });
   *
   * @example
   * // Error handling
   * try {
   *   await strapiClient.updateMCPServer('invalid-id', { enabled: false });
   * } catch (error) {
   *   console.error('Update failed:', error.message);
   * }
   *
   * @see {@link getMCPServer} for retrieving updated server
   * @see {@link createMCPServer} for creating servers
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
   *
   * @description
   * Permanently deletes an MCP server from Strapi database. This operation also
   * cascades to delete all associated MCP tools. Use with caution as this operation
   * cannot be undone.
   *
   * **Cascade Deletion:**
   * Deleting a server automatically deletes all associated `mcpTools` records.
   *
   * **Cache Invalidation:**
   * Deletion invalidates both the specific server cache and all server list caches.
   *
   * **Best Practices:**
   * - Consider disabling (`enabled: false`) instead of deleting if you might need to restore
   * - Check for agent/skill dependencies before deletion
   * - Back up server configuration if needed
   *
   * @param {string} id - MCP server document ID to delete
   * @returns {Promise<void>} Promise that resolves when deletion is complete
   * @throws {Error} If deletion fails or server not found
   *
   * @example
   * // Delete MCP server
   * await strapiClient.deleteMCPServer('abc123');
   * console.log('Server deleted');
   *
   * @example
   * // Safe deletion with confirmation
   * const serverId = 'abc123';
   * const server = await strapiClient.getMCPServer(serverId);
   * console.log(`About to delete: ${server.name}`);
   * console.log(`This will delete ${server.mcpTools?.length || 0} tools`);
   *
   * // Confirm deletion
   * await strapiClient.deleteMCPServer(serverId);
   *
   * @example
   * // Check for agent dependencies before deletion
   * const serverId = 'abc123';
   * const agents = await strapiClient.getAllAgents({
   *   populate: true,
   *   filters: {
   *     mcpConfig: {
   *       mcpServer: { documentId: serverId }
   *     }
   *   }
   * });
   *
   * if (agents.length > 0) {
   *   console.warn(`Server is used by ${agents.length} agents. Cannot delete.`);
   * } else {
   *   await strapiClient.deleteMCPServer(serverId);
   * }
   *
   * @example
   * // Error handling
   * try {
   *   await strapiClient.deleteMCPServer('invalid-id');
   * } catch (error) {
   *   console.error('Deletion failed:', error.message);
   * }
   *
   * @example
   * // Alternative: Disable instead of delete
   * // If you might want to restore the server later
   * const server = await strapiClient.updateMCPServer('abc123', {
   *   enabled: false
   * });
   * console.log('Server disabled (can be re-enabled later)');
   *
   * @see {@link updateMCPServer} for disabling servers (non-destructive alternative)
   * @see {@link createMCPServer} for recreating deleted servers
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
   *
   * @description
   * Retrieves all MCP tools associated with a specific MCP server. Tools represent
   * the capabilities exposed by an MCP server and can be individually enabled/disabled
   * in agent configurations.
   *
   * **Use Cases:**
   * - List all tools for a server
   * - Filter enabled/disabled tools
   * - Display tools in UI for agent configuration
   * - Validate tool availability before assignment
   *
   * **Tool Properties:**
   * - `name`: Tool identifier (e.g., 'read_file', 'write_file')
   * - `description`: Human-readable description
   * - `inputSchema`: JSON Schema for tool parameters
   * - `enabled`: Tool availability status
   *
   * @param {string} serverId - MCP server document ID
   * @returns {Promise<MCPTool[]>} Array of MCP tools for the server
   *
   * @example
   * // Get all tools for a server
   * const tools = await strapiClient.getMCPToolsByServerId('abc123');
   * console.log(`Found ${tools.length} tools`);
   * tools.forEach(tool => {
   *   console.log(`- ${tool.name}: ${tool.description}`);
   * });
   *
   * @example
   * // Filter enabled tools only
   * const allTools = await strapiClient.getMCPToolsByServerId('abc123');
   * const enabledTools = allTools.filter(tool => tool.enabled !== false);
   * console.log(`${enabledTools.length} enabled tools`);
   *
   * @example
   * // Get tools for agent configuration
   * const mcpServers = await strapiClient.getAllMCPServers();
   * const filesystemServer = mcpServers.find(s => s.name === 'filesystem');
   *
   * if (filesystemServer) {
   *   const tools = await strapiClient.getMCPToolsByServerId(filesystemServer.id);
   *   console.log('Available filesystem tools:');
   *   tools.forEach(tool => {
   *     console.log(`  ${tool.name}: ${tool.description}`);
   *   });
   * }
   *
   * @example
   * // Inspect tool input schemas
   * const tools = await strapiClient.getMCPToolsByServerId('abc123');
   * const readFileTool = tools.find(t => t.name === 'read_file');
   *
   * if (readFileTool?.inputSchema) {
   *   console.log('Input schema:', JSON.stringify(readFileTool.inputSchema, null, 2));
   *   // {
   *   //   "type": "object",
   *   //   "properties": {
   *   //     "path": { "type": "string", "description": "File path to read" }
   *   //   },
   *   //   "required": ["path"]
   *   // }
   * }
   *
   * @example
   * // Build tool selection for agent
   * const tools = await strapiClient.getMCPToolsByServerId('abc123');
   * const selectedToolIds = tools
   *   .filter(t => ['read_file', 'write_file', 'list_directory'].includes(t.name))
   *   .map(t => ({ mcpTool: t.id }));
   *
   * // Use in agent mcpConfig
   * await strapiClient.createAgent({
   *   name: 'File Assistant',
   *   systemPrompt: 'You help with file operations.',
   *   mcpConfig: [
   *     {
   *       mcpServer: 'abc123',
   *       selectedTools: selectedToolIds
   *     }
   *   ]
   * });
   *
   * @see {@link bulkSyncMCPTools} for syncing tools from MCP server
   * @see {@link createMCPTool} for manually creating tools
   * @see {@link updateMCPTool} for updating tool metadata
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
   *
   * @description
   * Creates a new MCP tool associated with a specific MCP server. Tools are typically
   * created via `bulkSyncMCPTools` after fetching from the MCP server, but this method
   * allows manual tool creation for custom scenarios.
   *
   * **Tool Schema:**
   * The `inputSchema` follows JSON Schema specification to define tool parameters.
   *
   * **Common Use Cases:**
   * - Manual tool creation for testing
   * - Custom tool definitions not from MCP server
   * - Placeholder tools before server sync
   *
   * @param {string} serverId - MCP server document ID to associate with
   * @param {Object} toolData - Tool data
   * @param {string} toolData.name - Unique tool name (e.g., 'read_file')
   * @param {string} [toolData.description] - Human-readable description
   * @param {Object} [toolData.inputSchema] - JSON Schema for tool parameters
   * @returns {Promise<MCPTool>} Created MCP tool
   * @throws {Error} If creation fails
   *
   * @example
   * // Create basic tool
   * const tool = await strapiClient.createMCPTool('abc123', {
   *   name: 'read_file',
   *   description: 'Read contents of a file'
   * });
   * console.log(tool.id); // Auto-generated UUID
   *
   * @example
   * // Create tool with input schema
   * const tool = await strapiClient.createMCPTool('abc123', {
   *   name: 'write_file',
   *   description: 'Write contents to a file',
   *   inputSchema: {
   *     type: 'object',
   *     properties: {
   *       path: {
   *         type: 'string',
   *         description: 'File path to write'
   *       },
   *       content: {
   *         type: 'string',
   *         description: 'Content to write'
   *       }
   *     },
   *     required: ['path', 'content']
   *   }
   * });
   *
   * @example
   * // Create multiple tools
   * const serverId = 'abc123';
   * const tools = [
   *   { name: 'read_file', description: 'Read file' },
   *   { name: 'write_file', description: 'Write file' },
   *   { name: 'delete_file', description: 'Delete file' }
   * ];
   *
   * for (const toolData of tools) {
   *   await strapiClient.createMCPTool(serverId, toolData);
   * }
   *
   * @example
   * // Create tool with complex schema
   * const tool = await strapiClient.createMCPTool('abc123', {
   *   name: 'search_files',
   *   description: 'Search for files matching criteria',
   *   inputSchema: {
   *     type: 'object',
   *     properties: {
   *       pattern: { type: 'string', description: 'Search pattern (glob)' },
   *       path: { type: 'string', description: 'Directory to search' },
   *       maxResults: { type: 'number', description: 'Max results to return', default: 100 }
   *     },
   *     required: ['pattern']
   *   }
   * });
   *
   * @see {@link bulkSyncMCPTools} for automated tool creation from MCP server
   * @see {@link updateMCPTool} for updating tool metadata
   * @see {@link deleteMCPTool} for removing tools
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
   *
   * @description
   * Updates an existing MCP tool using partial update semantics. Typically used
   * by `bulkSyncMCPTools` to keep tools synchronized with MCP server metadata,
   * but can also be used for manual updates.
   *
   * **Partial Updates:**
   * Only the fields provided will be updated; omitted fields remain unchanged.
   *
   * **Common Updates:**
   * - Update description for better clarity
   * - Update inputSchema when tool parameters change
   * - Update name if tool is renamed (rare)
   *
   * @param {string} toolId - MCP tool document ID
   * @param {Object} toolData - Partial tool data to update
   * @param {string} [toolData.name] - Update tool name
   * @param {string} [toolData.description] - Update description
   * @param {Object} [toolData.inputSchema] - Update input schema
   * @returns {Promise<MCPTool>} Updated MCP tool
   * @throws {Error} If update fails or tool not found
   *
   * @example
   * // Update tool description
   * const tool = await strapiClient.updateMCPTool('tool123', {
   *   description: 'Read file contents with improved error handling'
   * });
   *
   * @example
   * // Update tool input schema
   * const tool = await strapiClient.updateMCPTool('tool123', {
   *   inputSchema: {
   *     type: 'object',
   *     properties: {
   *       path: {
   *         type: 'string',
   *         description: 'Absolute or relative file path'
   *       },
   *       encoding: {
   *         type: 'string',
   *         description: 'File encoding',
   *         default: 'utf-8',
   *         enum: ['utf-8', 'ascii', 'base64']
   *       }
   *     },
   *     required: ['path']
   *   }
   * });
   *
   * @example
   * // Update multiple fields
   * const tool = await strapiClient.updateMCPTool('tool123', {
   *   name: 'read_file_v2',
   *   description: 'Read file with encoding support',
   *   inputSchema: {
   *     type: 'object',
   *     properties: {
   *       path: { type: 'string' },
   *       encoding: { type: 'string', default: 'utf-8' }
   *     },
   *     required: ['path']
   *   }
   * });
   *
   * @example
   * // Update tools after server upgrade
   * const tools = await strapiClient.getMCPToolsByServerId('abc123');
   * const readTool = tools.find(t => t.name === 'read_file');
   *
   * if (readTool) {
   *   await strapiClient.updateMCPTool(readTool.id, {
   *     description: 'Updated after server v2.0 upgrade',
   *     inputSchema: newSchemaFromServer
   *   });
   * }
   *
   * @see {@link getMCPToolsByServerId} for retrieving tools to update
   * @see {@link bulkSyncMCPTools} for automated tool updates
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
   *
   * @description
   * Permanently deletes an MCP tool from Strapi database. This operation is typically
   * performed by `bulkSyncMCPTools` when a tool no longer exists on the MCP server,
   * but can also be used for manual cleanup.
   *
   * **Warning:**
   * Deleting a tool may affect agent configurations that reference this tool.
   * The tool will be removed from any agent's `mcpConfig.selectedTools` arrays.
   *
   * **Use Cases:**
   * - Remove obsolete tools after server update
   * - Clean up manually created test tools
   * - Sync tool deletion from MCP server
   *
   * @param {string} toolId - MCP tool document ID to delete
   * @returns {Promise<void>} Promise that resolves when deletion is complete
   * @throws {Error} If deletion fails or tool not found
   *
   * @example
   * // Delete a single tool
   * await strapiClient.deleteMCPTool('tool123');
   * console.log('Tool deleted');
   *
   * @example
   * // Delete obsolete tools
   * const tools = await strapiClient.getMCPToolsByServerId('abc123');
   * const obsoleteTools = tools.filter(t => t.name.includes('_deprecated'));
   *
   * for (const tool of obsoleteTools) {
   *   await strapiClient.deleteMCPTool(tool.id);
   *   console.log(`Deleted obsolete tool: ${tool.name}`);
   * }
   *
   * @example
   * // Delete all tools for a server before re-sync
   * const serverId = 'abc123';
   * const tools = await strapiClient.getMCPToolsByServerId(serverId);
   *
   * // Delete all existing tools
   * await Promise.all(tools.map(t => strapiClient.deleteMCPTool(t.id)));
   *
   * // Now sync fresh tools
   * await strapiClient.bulkSyncMCPTools(serverId, fetchedToolsFromServer);
   *
   * @example
   * // Safe deletion with error handling
   * try {
   *   await strapiClient.deleteMCPTool('tool123');
   *   console.log('Tool deleted successfully');
   * } catch (error) {
   *   console.error('Failed to delete tool:', error.message);
   * }
   *
   * @see {@link bulkSyncMCPTools} for automated tool deletion during sync
   * @see {@link getMCPToolsByServerId} for retrieving tools to delete
   */
  async deleteMCPTool(toolId: string): Promise<void> {
    await this.client.delete(`/mcp-tools/${toolId}`);
  }

  /**
   * Bulk sync MCP tools for a server
   *
   * @description
   * Synchronizes MCP tools in Strapi database with tools fetched from an MCP server.
   * This method performs intelligent 3-way sync:
   * - **Create**: Adds new tools that don't exist in database
   * - **Update**: Updates existing tools if description or inputSchema changed
   * - **Delete**: Removes tools from database that no longer exist on server
   *
   * **Sync Algorithm:**
   * 1. Fetch existing tools from database
   * 2. Compare with fetched tools by name (name is the unique identifier)
   * 3. Delete tools not in fetched list
   * 4. Update tools with changed metadata (description, inputSchema)
   * 5. Create tools that don't exist in database
   * 6. Update server's `toolsFetchedAt` timestamp
   *
   * **Use Cases:**
   * - Initial tool discovery after creating MCP server
   * - Periodic sync to update tool metadata
   * - Tool refresh after server upgrade
   *
   * **Cache Invalidation:**
   * Invalidates MCP server caches after sync completes.
   *
   * @param {string} serverId - MCP server document ID
   * @param {Array} fetchedTools - Tools fetched from MCP server
   * @param {string} fetchedTools[].name - Tool name (unique identifier)
   * @param {string} [fetchedTools[].description] - Tool description
   * @param {Object} [fetchedTools[].inputSchema] - Tool input schema (JSON Schema)
   * @returns {Promise<MCPServer>} Updated MCP server with tools populated
   *
   * @example
   * // Basic tool sync after server creation
   * const server = await strapiClient.createMCPServer({
   *   name: 'filesystem',
   *   transportType: 'stdio',
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
   * });
   *
   * // Fetch tools from MCP server (pseudo-code)
   * const fetchedTools = [
   *   { name: 'read_file', description: 'Read file contents' },
   *   { name: 'write_file', description: 'Write file contents' },
   *   { name: 'list_directory', description: 'List directory contents' }
   * ];
   *
   * // Sync tools to database
   * const updatedServer = await strapiClient.bulkSyncMCPTools(server.id, fetchedTools);
   * console.log(`Synced ${updatedServer.mcpTools?.length} tools`);
   *
   * @example
   * // Sync with detailed tool schemas
   * const fetchedTools = [
   *   {
   *     name: 'read_file',
   *     description: 'Read contents of a file',
   *     inputSchema: {
   *       type: 'object',
   *       properties: {
   *         path: { type: 'string', description: 'File path to read' }
   *       },
   *       required: ['path']
   *     }
   *   },
   *   {
   *     name: 'write_file',
   *     description: 'Write contents to a file',
   *     inputSchema: {
   *       type: 'object',
   *       properties: {
   *         path: { type: 'string', description: 'File path to write' },
   *         content: { type: 'string', description: 'Content to write' }
   *       },
   *       required: ['path', 'content']
   *     }
   *   }
   * ];
   *
   * await strapiClient.bulkSyncMCPTools('abc123', fetchedTools);
   *
   * @example
   * // Sync workflow with MCPService integration
   * import { mcpService } from './mcp-service';
   *
   * // Get MCP server from database
   * const server = await strapiClient.getMCPServer('abc123');
   *
   * // Fetch tools from MCP server
   * const fetchedTools = await mcpService.listMCPServerTools(server.id);
   *
   * // Sync to database
   * const updatedServer = await strapiClient.bulkSyncMCPTools(server.id, fetchedTools);
   * console.log(`Sync complete. ${updatedServer.mcpTools?.length} tools available.`);
   *
   * @example
   * // Periodic sync to keep tools up-to-date
   * async function syncAllMCPServers() {
   *   const servers = await strapiClient.getAllMCPServers({
   *     filters: { enabled: { $eq: true } }
   *   });
   *
   *   for (const server of servers) {
   *     console.log(`Syncing tools for ${server.name}...`);
   *     const fetchedTools = await mcpService.listMCPServerTools(server.id);
   *     await strapiClient.bulkSyncMCPTools(server.id, fetchedTools);
   *     console.log(`✓ ${server.name} synced`);
   *   }
   * }
   *
   * @example
   * // Handle sync errors gracefully
   * try {
   *   const fetchedTools = await mcpService.listMCPServerTools('abc123');
   *   const server = await strapiClient.bulkSyncMCPTools('abc123', fetchedTools);
   *   console.log(`Synced ${server.mcpTools?.length} tools successfully`);
   * } catch (error) {
   *   console.error('Tool sync failed:', error.message);
   *   // Server tools remain unchanged
   * }
   *
   * @example
   * // Sync removes obsolete tools
   * // Before sync: database has ['read_file', 'write_file', 'delete_file']
   * // After MCP server upgrade: server only has ['read_file', 'write_file']
   *
   * const fetchedTools = [
   *   { name: 'read_file', description: 'Read file' },
   *   { name: 'write_file', description: 'Write file' }
   *   // 'delete_file' is missing - will be deleted from database
   * ];
   *
   * await strapiClient.bulkSyncMCPTools('abc123', fetchedTools);
   * // Database now has only ['read_file', 'write_file']
   * // 'delete_file' was automatically deleted
   *
   * @example
   * // Check what changed during sync
   * const beforeTools = await strapiClient.getMCPToolsByServerId('abc123');
   * console.log(`Before sync: ${beforeTools.length} tools`);
   *
   * const fetchedTools = await mcpService.listMCPServerTools('abc123');
   * await strapiClient.bulkSyncMCPTools('abc123', fetchedTools);
   *
   * const afterTools = await strapiClient.getMCPToolsByServerId('abc123');
   * console.log(`After sync: ${afterTools.length} tools`);
   *
   * const added = afterTools.filter(t => !beforeTools.find(b => b.name === t.name));
   * const removed = beforeTools.filter(t => !afterTools.find(a => a.name === t.name));
   * console.log(`Added: ${added.map(t => t.name).join(', ')}`);
   * console.log(`Removed: ${removed.map(t => t.name).join(', ')}`);
   *
   * @see {@link getMCPToolsByServerId} for retrieving synced tools
   * @see {@link createMCPTool} for manual tool creation
   * @see {@link updateMCPTool} for manual tool updates
   * @see {@link deleteMCPTool} for manual tool deletion
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
   *
   * @description
   * Uploads a file to Strapi's Media Library. The uploaded file is stored in Strapi's
   * configured storage provider (local filesystem, S3, Cloudinary, etc.) and can be
   * referenced in other content types via file relations. Common use cases include
   * uploading skill attachments, agent documentation, or training materials.
   *
   * **Supported File Types:**
   * - Images: .jpg, .jpeg, .png, .gif, .svg, .webp
   * - Documents: .pdf, .doc, .docx, .txt, .md
   * - Archives: .zip, .tar, .gz
   * - Code: .js, .ts, .py, .java, .cpp, etc.
   * - Any other file type (MIME type auto-detected)
   *
   * **File Size Limits:**
   * - Default Strapi limit: 200MB (configurable in Strapi)
   * - Large files may require adjusting Strapi's `strapi::body` middleware configuration
   *
   * @param {Buffer | Blob} file - File to upload (Buffer for Node.js, Blob for browsers)
   * @param {string} filename - Original filename with extension (e.g., 'document.pdf')
   *
   * @returns {Promise<Object>} Strapi media object with file metadata
   * @returns {number} returns.id - Numeric file ID (legacy)
   * @returns {string} returns.documentId - UUID document ID (Strapi v5)
   * @returns {string} returns.name - Stored filename
   * @returns {string} returns.url - Public URL to access the file
   * @returns {string} returns.mime - MIME type (e.g., 'application/pdf', 'image/png')
   * @returns {number} returns.size - File size in bytes
   *
   * @throws {Error} If file upload fails
   *
   * @example
   * // Upload a text file from Buffer
   * import fs from 'fs/promises';
   *
   * const fileBuffer = await fs.readFile('./example.txt');
   * const uploadedFile = await strapiClient.uploadFile(fileBuffer, 'example.txt');
   *
   * console.log('File uploaded:', uploadedFile.url);
   * console.log('File ID:', uploadedFile.documentId);
   *
   * @example
   * // Upload an image and attach to a skill
   * const imageBuffer = await fs.readFile('./diagram.png');
   * const uploadedImage = await strapiClient.uploadFile(imageBuffer, 'diagram.png');
   *
   * // Create skill with image attachment
   * const skill = await strapiClient.createSkill({
   *   name: 'image-processing',
   *   displayName: 'Image Processing',
   *   description: 'Process and analyze images',
   *   additionalFiles: [
   *     {
   *       name: 'Architecture Diagram',
   *       description: 'System architecture',
   *       file: uploadedImage.documentId // Reference uploaded file
   *     }
   *   ]
   * });
   *
   * @example
   * // Upload PDF documentation
   * const pdfBuffer = await fs.readFile('./user-guide.pdf');
   * const uploadedPdf = await strapiClient.uploadFile(pdfBuffer, 'user-guide.pdf');
   *
   * console.log(`PDF uploaded: ${uploadedPdf.name}`);
   * console.log(`Size: ${(uploadedPdf.size / 1024).toFixed(2)} KB`);
   * console.log(`MIME: ${uploadedPdf.mime}`);
   * console.log(`URL: ${uploadedPdf.url}`);
   *
   * @example
   * // Upload multiple files sequentially
   * const files = ['file1.txt', 'file2.txt', 'file3.txt'];
   * const uploadedFiles = [];
   *
   * for (const filename of files) {
   *   const buffer = await fs.readFile(`./uploads/${filename}`);
   *   const uploaded = await strapiClient.uploadFile(buffer, filename);
   *   uploadedFiles.push(uploaded);
   *   console.log(`Uploaded: ${filename} -> ${uploaded.documentId}`);
   * }
   *
   * @example
   * // Error handling for file upload
   * try {
   *   const buffer = await fs.readFile('./large-file.zip');
   *   const uploaded = await strapiClient.uploadFile(buffer, 'large-file.zip');
   *   console.log('Upload successful');
   * } catch (error) {
   *   console.error('Upload failed:', error.message);
   *   // Handle error (file too large, invalid type, network error, etc.)
   * }
   *
   * @example
   * // Upload file and use URL directly
   * const logoBuffer = await fs.readFile('./logo.png');
   * const uploadedLogo = await strapiClient.uploadFile(logoBuffer, 'logo.png');
   *
   * // Use the URL in your application
   * const fullUrl = `${process.env.STRAPI_URL}${uploadedLogo.url}`;
   * console.log(`Logo available at: ${fullUrl}`);
   *
   * @see {@link deleteFile} - Delete uploaded files
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
   *
   * @description
   * Permanently deletes a file from Strapi's Media Library and its configured storage
   * provider. This operation cannot be undone. Ensure the file is not referenced by any
   * content types before deletion, as this will break file relations.
   *
   * **Important Notes:**
   * - File is permanently deleted from storage (local/S3/Cloudinary/etc.)
   * - Any content referencing this file will have broken file relations
   * - Strapi does not prevent deletion of files in use
   * - Consider verifying file references before deletion
   *
   * @param {string} fileId - File document ID (UUID format from Strapi v5) or numeric ID (legacy)
   *
   * @returns {Promise<void>}
   *
   * @throws {Error} If file deletion fails or file not found
   *
   * @example
   * // Basic file deletion
   * await strapiClient.deleteFile('file-uuid-123');
   * console.log('File deleted successfully');
   *
   * @example
   * // Delete file after uploading a replacement
   * const oldFileId = 'old-file-uuid';
   *
   * // Upload new version
   * const newBuffer = await fs.readFile('./updated-document.pdf');
   * const newFile = await strapiClient.uploadFile(newBuffer, 'updated-document.pdf');
   *
   * // Update skill to reference new file
   * await strapiClient.updateSkill('skill-uuid', {
   *   additionalFiles: [
   *     { name: 'Documentation', file: newFile.documentId }
   *   ]
   * });
   *
   * // Now safe to delete old file
   * await strapiClient.deleteFile(oldFileId);
   *
   * @example
   * // Error handling for file deletion
   * try {
   *   await strapiClient.deleteFile('file-uuid-123');
   *   console.log('File deleted');
   * } catch (error) {
   *   console.error('Failed to delete file:', error.message);
   *   // Handle error (file not found, permission denied, etc.)
   * }
   *
   * @example
   * // Delete multiple files (cleanup unused attachments)
   * const fileIdsToDelete = [
   *   'file-uuid-1',
   *   'file-uuid-2',
   *   'file-uuid-3'
   * ];
   *
   * for (const fileId of fileIdsToDelete) {
   *   try {
   *     await strapiClient.deleteFile(fileId);
   *     console.log(`Deleted: ${fileId}`);
   *   } catch (error) {
   *     console.error(`Failed to delete ${fileId}:`, error.message);
   *   }
   * }
   *
   * @example
   * // Safe deletion workflow - verify no references first
   * // Note: This is a conceptual example - actual implementation depends on your data model
   * const fileId = 'file-uuid-123';
   *
   * // Check if any skills reference this file
   * const skills = await strapiClient.getAllSkills();
   * const isReferenced = skills.some(skill =>
   *   skill.additionalFiles?.some(f => f.file === fileId)
   * );
   *
   * if (!isReferenced) {
   *   await strapiClient.deleteFile(fileId);
   *   console.log('File safely deleted (no references found)');
   * } else {
   *   console.warn('File is still referenced - cannot delete');
   * }
   *
   * @see {@link uploadFile} - Upload files to Media Library
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.client.delete(`/upload/files/${fileId}`);
  }

  // ============= TASKS =============

  /**
   * Get all tasks with optional filtering, sorting, and pagination
   *
   * @description
   * Retrieves all tasks from Strapi with support for filtering by status, assigned agent,
   * priority, and other fields. Tasks represent work items, automation jobs, or scheduled
   * operations assigned to agents. Results are cached with 5-minute TTL for improved performance.
   *
   * **Common Task Fields:**
   * - `title`: Task title/name
   * - `description`: Task description
   * - `status`: Task status (pending, in_progress, completed, failed, etc.)
   * - `priority`: Priority level (low, medium, high, urgent)
   * - `dueDate`: Optional due date
   * - `agent`: Assigned agent (relation)
   * - `result`: Task execution result/output
   * - `metadata`: Custom task metadata
   *
   * @param {Object} [options] - Query options for filtering, sorting, and pagination
   * @param {Record<string, any>} [options.filters] - Strapi v5 filters object (supports $eq, $ne, $in, $containsi, $and, $or, etc.)
   * @param {string[]} [options.sort] - Sort order array (e.g., ['dueDate:asc', 'priority:desc'])
   * @param {Object} [options.pagination] - Pagination configuration
   * @param {number} [options.pagination.page] - Page number (1-indexed)
   * @param {number} [options.pagination.pageSize] - Number of items per page
   *
   * @returns {Promise<Task[]>} Array of Task objects
   *
   * @example
   * // Basic usage - get all tasks
   * const tasks = await strapiClient.getAllTasks();
   * console.log(`Found ${tasks.length} tasks`);
   *
   * @example
   * // Filter by status - get pending tasks only
   * const pendingTasks = await strapiClient.getAllTasks({
   *   filters: { status: { $eq: 'pending' } }
   * });
   *
   * @example
   * // Filter by multiple statuses using $in operator
   * const activeTasks = await strapiClient.getAllTasks({
   *   filters: {
   *     status: { $in: ['pending', 'in_progress'] }
   *   }
   * });
   *
   * @example
   * // Filter by assigned agent
   * const agentTasks = await strapiClient.getAllTasks({
   *   filters: {
   *     agent: { documentId: { $eq: 'agent-uuid-123' } }
   *   }
   * });
   *
   * @example
   * // Sort by priority and due date
   * const sortedTasks = await strapiClient.getAllTasks({
   *   sort: ['priority:desc', 'dueDate:asc'],
   *   filters: { status: { $ne: 'completed' } }
   * });
   *
   * @example
   * // Pagination - get first page of high-priority tasks
   * const highPriorityTasks = await strapiClient.getAllTasks({
   *   filters: { priority: { $eq: 'high' } },
   *   pagination: { page: 1, pageSize: 20 },
   *   sort: ['createdAt:desc']
   * });
   *
   * @example
   * // Search tasks by title (case-insensitive)
   * const searchResults = await strapiClient.getAllTasks({
   *   filters: {
   *     title: { $containsi: 'backup' }
   *   }
   * });
   *
   * @example
   * // Get overdue tasks (dueDate in the past and not completed)
   * const overdueTasks = await strapiClient.getAllTasks({
   *   filters: {
   *     $and: [
   *       { dueDate: { $lt: new Date().toISOString() } },
   *       { status: { $ne: 'completed' } }
   *     ]
   *   }
   * });
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
   * Get a single task by ID with populated agent relation
   *
   * @description
   * Retrieves a single task by its unique document ID with the assigned agent relation
   * automatically populated. Use this method to get detailed task information including
   * the full agent configuration.
   *
   * **Auto-populated Relations:**
   * - `agent`: Assigned agent with full configuration
   *
   * @param {string} id - Task document ID (UUID format)
   *
   * @returns {Promise<Task>} Task object with populated agent relation
   *
   * @throws {Error} If task with the specified ID is not found
   *
   * @example
   * // Basic usage - get task by ID
   * const task = await strapiClient.getTask('task-uuid-123');
   * console.log(`Task: ${task.title}`);
   * console.log(`Status: ${task.status}`);
   * console.log(`Assigned to: ${task.agent?.name}`);
   *
   * @example
   * // Get task and check status
   * try {
   *   const task = await strapiClient.getTask('task-uuid-123');
   *
   *   if (task.status === 'completed') {
   *     console.log('Task completed successfully');
   *     console.log('Result:', task.result);
   *   } else if (task.status === 'failed') {
   *     console.error('Task failed:', task.result);
   *   }
   * } catch (error) {
   *   console.error('Task not found');
   * }
   *
   * @example
   * // Get task and display detailed information
   * const task = await strapiClient.getTask('task-uuid-123');
   *
   * console.log('Task Details:');
   * console.log(`  Title: ${task.title}`);
   * console.log(`  Status: ${task.status}`);
   * console.log(`  Priority: ${task.priority}`);
   * console.log(`  Due: ${task.dueDate || 'No due date'}`);
   * console.log(`  Agent: ${task.agent?.name || 'Unassigned'}`);
   * console.log(`  Created: ${task.createdAt}`);
   * console.log(`  Updated: ${task.updatedAt}`);
   *
   * @example
   * // Error handling for non-existent task
   * try {
   *   const task = await strapiClient.getTask('invalid-id');
   * } catch (error) {
   *   console.error('Failed to retrieve task:', error.message);
   *   // Handle error (show error message to user, etc.)
   * }
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
   *
   * @description
   * Creates a new task in Strapi. Tasks can be assigned to agents for execution and can
   * include metadata, priority levels, and due dates. The task status defaults to 'pending'
   * if not specified.
   *
   * **Cache Behavior:**
   * - Invalidates all task list caches to ensure fresh data on next fetch
   * - New task is not immediately cached (cached on first retrieval)
   *
   * @param {CreateTaskDTO} taskData - Task data to create
   * @param {string} taskData.title - Task title/name (required)
   * @param {string} [taskData.description] - Task description
   * @param {string} [taskData.status] - Task status (pending, in_progress, completed, failed, etc.)
   * @param {string} [taskData.priority] - Priority level (low, medium, high, urgent)
   * @param {string} [taskData.dueDate] - Due date (ISO 8601 format)
   * @param {string} [taskData.agent] - Assigned agent ID (UUID)
   * @param {any} [taskData.metadata] - Custom task metadata
   *
   * @returns {Promise<Task>} Created task object
   *
   * @throws {Error} If task creation fails
   *
   * @example
   * // Basic task creation
   * const task = await strapiClient.createTask({
   *   title: 'Process customer data',
   *   description: 'Extract and validate customer information from CSV',
   *   status: 'pending'
   * });
   * console.log(`Created task: ${task.id}`);
   *
   * @example
   * // Create task with agent assignment
   * const task = await strapiClient.createTask({
   *   title: 'Generate monthly report',
   *   description: 'Compile sales metrics and generate PDF report',
   *   status: 'pending',
   *   priority: 'high',
   *   agent: 'agent-uuid-123' // Assign to specific agent
   * });
   *
   * @example
   * // Create task with due date and priority
   * const tomorrow = new Date();
   * tomorrow.setDate(tomorrow.getDate() + 1);
   *
   * const task = await strapiClient.createTask({
   *   title: 'Backup database',
   *   description: 'Perform full database backup to S3',
   *   status: 'pending',
   *   priority: 'urgent',
   *   dueDate: tomorrow.toISOString(),
   *   agent: 'backup-agent-uuid'
   * });
   *
   * @example
   * // Create task with custom metadata
   * const task = await strapiClient.createTask({
   *   title: 'Send email notifications',
   *   description: 'Send weekly digest emails to subscribers',
   *   status: 'pending',
   *   priority: 'medium',
   *   metadata: {
   *     emailCount: 1500,
   *     template: 'weekly-digest',
   *     sendTime: '2024-01-15T09:00:00Z'
   *   }
   * });
   *
   * @example
   * // Create task and immediately start execution
   * const task = await strapiClient.createTask({
   *   title: 'Index search documents',
   *   description: 'Update Elasticsearch index with new documents',
   *   status: 'in_progress', // Start immediately
   *   priority: 'high',
   *   agent: 'indexer-agent-uuid'
   * });
   *
   * // Poll task status
   * const checkStatus = async () => {
   *   const updated = await strapiClient.getTask(task.id);
   *   console.log(`Status: ${updated.status}`);
   * };
   *
   * @example
   * // Error handling for task creation
   * try {
   *   const task = await strapiClient.createTask({
   *     title: 'Important task',
   *     description: 'Critical operation',
   *     agent: 'invalid-agent-id' // Invalid agent reference
   *   });
   * } catch (error) {
   *   console.error('Failed to create task:', error.message);
   *   // Handle error (show validation message, retry, etc.)
   * }
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
   *
   * @description
   * Updates an existing task with partial data. Only provided fields are updated; omitted
   * fields remain unchanged. Common use cases include updating task status, adding results,
   * changing priority, or reassigning to a different agent.
   *
   * **Partial Update Semantics:**
   * - Only fields present in `taskData` are updated
   * - Omitted fields retain their current values
   * - Pass `null` explicitly to clear a field value
   *
   * **Cache Behavior:**
   * - Invalidates all task list caches
   * - Invalidates the specific task cache entry
   * - Updated task is returned but not immediately re-cached
   *
   * @param {string} id - Task document ID to update
   * @param {UpdateTaskDTO} taskData - Partial task data to update
   * @param {string} [taskData.title] - Update task title
   * @param {string} [taskData.description] - Update task description
   * @param {string} [taskData.status] - Update task status
   * @param {string} [taskData.priority] - Update priority level
   * @param {string} [taskData.dueDate] - Update due date
   * @param {string} [taskData.agent] - Reassign to different agent
   * @param {any} [taskData.result] - Set task execution result
   * @param {any} [taskData.metadata] - Update task metadata
   *
   * @returns {Promise<Task>} Updated task object
   *
   * @throws {Error} If task update fails or task not found
   *
   * @example
   * // Update task status
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   status: 'completed'
   * });
   * console.log(`Task status updated to: ${task.status}`);
   *
   * @example
   * // Update task status and add result
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   status: 'completed',
   *   result: {
   *     processedRecords: 1500,
   *     duration: '5.2s',
   *     success: true
   *   }
   * });
   *
   * @example
   * // Mark task as failed with error information
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   status: 'failed',
   *   result: {
   *     error: 'Database connection timeout',
   *     retryCount: 3,
   *     lastAttempt: new Date().toISOString()
   *   }
   * });
   *
   * @example
   * // Change task priority
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   priority: 'urgent'
   * });
   *
   * @example
   * // Reassign task to different agent
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   agent: 'new-agent-uuid',
   *   status: 'pending' // Reset status when reassigning
   * });
   *
   * @example
   * // Update multiple fields at once
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   status: 'in_progress',
   *   priority: 'high',
   *   metadata: {
   *     startedAt: new Date().toISOString(),
   *     assignedWorker: 'worker-3'
   *   }
   * });
   *
   * @example
   * // Extend due date
   * const nextWeek = new Date();
   * nextWeek.setDate(nextWeek.getDate() + 7);
   *
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   dueDate: nextWeek.toISOString()
   * });
   *
   * @example
   * // Error handling for task update
   * try {
   *   const task = await strapiClient.updateTask('task-uuid-123', {
   *     status: 'completed',
   *     result: { success: true }
   *   });
   * } catch (error) {
   *   console.error('Failed to update task:', error.message);
   *   // Handle error (task not found, validation error, etc.)
   * }
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
   *
   * @description
   * Permanently deletes a task from Strapi. This operation cannot be undone. Consider
   * updating the task status to 'cancelled' or 'archived' instead if you need to preserve
   * task history.
   *
   * **Cache Behavior:**
   * - Invalidates all task list caches
   * - Removes the specific task cache entry
   *
   * **Best Practices:**
   * - Verify task can be safely deleted before calling (no critical dependencies)
   * - Consider soft-delete approach (status = 'deleted') for audit trail
   * - Ensure task is not currently being executed by an agent
   *
   * @param {string} id - Task document ID to delete
   *
   * @returns {Promise<void>}
   *
   * @throws {Error} If task deletion fails or task not found
   *
   * @example
   * // Basic task deletion
   * await strapiClient.deleteTask('task-uuid-123');
   * console.log('Task deleted successfully');
   *
   * @example
   * // Delete task with confirmation check
   * const task = await strapiClient.getTask('task-uuid-123');
   *
   * if (task.status === 'completed' || task.status === 'cancelled') {
   *   await strapiClient.deleteTask(task.id);
   *   console.log('Task deleted successfully');
   * } else {
   *   console.warn('Cannot delete active task');
   * }
   *
   * @example
   * // Error handling for task deletion
   * try {
   *   await strapiClient.deleteTask('task-uuid-123');
   *   console.log('Task deleted');
   * } catch (error) {
   *   console.error('Failed to delete task:', error.message);
   *   // Handle error (task not found, permission denied, etc.)
   * }
   *
   * @example
   * // Soft delete alternative - preserve task history
   * // Instead of permanently deleting, update status to 'deleted'
   * const task = await strapiClient.updateTask('task-uuid-123', {
   *   status: 'deleted',
   *   metadata: {
   *     deletedAt: new Date().toISOString(),
   *     deletedBy: 'user-123'
   *   }
   * });
   * // Task is hidden from normal queries but preserved in database
   *
   * @example
   * // Bulk delete completed tasks older than 30 days
   * const thirtyDaysAgo = new Date();
   * thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
   *
   * const oldTasks = await strapiClient.getAllTasks({
   *   filters: {
   *     $and: [
   *       { status: { $eq: 'completed' } },
   *       { updatedAt: { $lt: thirtyDaysAgo.toISOString() } }
   *     ]
   *   }
   * });
   *
   * for (const task of oldTasks) {
   *   await strapiClient.deleteTask(task.id);
   * }
   * console.log(`Deleted ${oldTasks.length} old tasks`);
   */
  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/tasks/${id}`);
    this.invalidateCache('tasks');
    this.cache.delete(`task:${id}`);
  }

  // ============= TRANSFORMERS =============
  // Transform Strapi response format to domain models

  /**
   * Extract attributes from Strapi response
   *
   * @description Handles both nested (attributes) and flat response formats from Strapi.
   * Strapi v5 typically returns data in nested format with `attributes` property, but some
   * configurations or API endpoints may return flat data directly.
   *
   * This method provides a unified interface for accessing response data regardless of format:
   * - Nested format: `{ documentId: '...', attributes: { name: '...', ... } }`
   * - Flat format: `{ documentId: '...', name: '...', ... }`
   *
   * @param strapiData - Raw Strapi response data (nested or flat)
   * @returns Extracted attributes object containing all entity fields
   *
   * @example
   * // Nested format (Strapi v5 default)
   * const nestedData = {
   *   documentId: 'agent-123',
   *   attributes: {
   *     name: 'Research Agent',
   *     systemPrompt: 'You are a research assistant',
   *     enabled: true,
   *     createdAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const attrs = this.extractAttributes(nestedData);
   * // Returns: { name: 'Research Agent', systemPrompt: '...', enabled: true, createdAt: '...' }
   *
   * @example
   * // Flat format (some Strapi configurations)
   * const flatData = {
   *   documentId: 'agent-123',
   *   name: 'Research Agent',
   *   systemPrompt: 'You are a research assistant',
   *   enabled: true,
   *   createdAt: '2024-01-01T00:00:00.000Z'
   * };
   * const attrs = this.extractAttributes(flatData);
   * // Returns: { documentId: '...', name: 'Research Agent', systemPrompt: '...', enabled: true, createdAt: '...' }
   *
   * @see transformAgent
   * @see transformSkill
   * @see transformMCPServer
   * @see transformMCPTool
   * @see transformTask
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
   *
   * @description Converts Strapi v5 API response format to the application's Agent domain model.
   * Handles component-based structure including toolConfig, modelConfig, analytics, metadata,
   * mcpConfig (component with nested MCP server and tool relations), skillSelection, and tasks.
   *
   * **Strapi Response Format:**
   * ```typescript
   * {
   *   documentId: 'agent-uuid',
   *   attributes: {
   *     name: string,
   *     slug: string,
   *     description: string,
   *     systemPrompt: string,
   *     enabled: boolean,
   *     toolConfig: { allowedTools: string[], ... },
   *     modelConfig: { model: string, temperature: number, ... },
   *     analytics: { tokenUsage: number, ... },
   *     metadata: [{ key: string, value: string }],
   *     mcpConfig: [{ mcpServer: { data: {...} }, selectedTools: [...] }],
   *     skillSelection: [{ skill: { data: {...} }, ... }],
   *     tasks: [{ data: {...} }],
   *     createdAt: string,
   *     updatedAt: string
   *   }
   * }
   * ```
   *
   * **Domain Model Format:**
   * ```typescript
   * {
   *   id: string,
   *   name: string,
   *   slug: string,
   *   description: string,
   *   systemPrompt: string,
   *   enabled: boolean,
   *   toolConfig?: {...},
   *   modelConfig: {...},
   *   analytics?: {...},
   *   metadata?: [...],
   *   mcpConfig: [...],
   *   skillSelection: [...],
   *   tasks: [...],
   *   createdAt: Date,
   *   updatedAt: Date
   * }
   * ```
   *
   * @param strapiData - Raw Strapi response data with nested attributes
   * @returns Transformed Agent object ready for application use
   *
   * @example
   * // Transform basic agent
   * const strapiResponse = {
   *   documentId: 'agent-123',
   *   attributes: {
   *     name: 'Research Agent',
   *     slug: 'research-agent',
   *     description: 'Agent for research tasks',
   *     systemPrompt: 'You are a research assistant',
   *     enabled: true,
   *     modelConfig: {
   *       model: 'sonnet',
   *       temperature: 1.0,
   *       timeout: 300000
   *     },
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const agent = this.transformAgent(strapiResponse);
   * // Returns: {
   * //   id: 'agent-123',
   * //   name: 'Research Agent',
   * //   slug: 'research-agent',
   * //   description: 'Agent for research tasks',
   * //   systemPrompt: 'You are a research assistant',
   * //   enabled: true,
   * //   modelConfig: { model: 'sonnet', temperature: 1.0, timeout: 300000 },
   * //   mcpConfig: [],
   * //   skillSelection: [],
   * //   tasks: [],
   * //   createdAt: Date object,
   * //   updatedAt: Date object
   * // }
   *
   * @example
   * // Transform agent with component fields
   * const strapiResponse = {
   *   documentId: 'agent-456',
   *   attributes: {
   *     name: 'Code Agent',
   *     slug: 'code-agent',
   *     description: 'Agent for code generation',
   *     systemPrompt: 'You are a coding assistant',
   *     enabled: true,
   *     toolConfig: {
   *       allowedTools: ['bash', 'read', 'write'],
   *       maxToolCalls: 50
   *     },
   *     modelConfig: {
   *       model: 'opus',
   *       temperature: 0.7,
   *       timeout: 600000
   *     },
   *     analytics: {
   *       totalConversations: 42,
   *       tokenUsage: 150000
   *     },
   *     metadata: [
   *       { key: 'version', value: '2.0' },
   *       { key: 'author', value: 'team' }
   *     ],
   *     mcpConfig: [
   *       {
   *         mcpServer: {
   *           data: {
   *             documentId: 'mcp-server-1',
   *             attributes: { name: 'filesystem' }
   *           }
   *         },
   *         selectedTools: [
   *           { mcpTool: { data: { documentId: 'tool-1' } } }
   *         ]
   *       }
   *     ],
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const agent = this.transformAgent(strapiResponse);
   * // Returns agent with all component fields populated
   *
   * @see prepareAgentData - Reverse transformation for API requests
   * @see getAllAgents
   * @see getAgent
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
   *
   * @description Converts Strapi v5 API response format to the application's Skill domain model.
   * Handles component-based structure including trainingHistory (training records), additionalFiles
   * (file attachments with file relation), agentSelection, toolConfig, modelConfig, analytics,
   * mcpConfig, tasks, and inputFields (dynamic form fields).
   *
   * **Strapi Response Format:**
   * ```typescript
   * {
   *   documentId: 'skill-uuid',
   *   attributes: {
   *     name: string,
   *     displayName: string,
   *     description: string,
   *     skillmd: string,
   *     skillConfig?: { systemPromptPrefix: string, ... },
   *     experienceScore: number,
   *     category: string,
   *     isPublic: boolean,
   *     version: string,
   *     license?: string,
   *     trainingHistory: [{ timestamp: string, agentId: string, ... }],
   *     additionalFiles: [{ file: { data: {...} }, description: string }],
   *     agentSelection: [{ agent: { data: {...} }, ... }],
   *     toolConfig?: {...},
   *     modelConfig?: {...},
   *     analytics?: {...},
   *     mcpConfig: [...],
   *     tasks: [...],
   *     inputFields: [{ name: string, type: string, ... }],
   *     trainingAgent?: { data: { documentId: string } } | string,
   *     createdAt: string,
   *     updatedAt: string
   *   }
   * }
   * ```
   *
   * **Domain Model Format:**
   * ```typescript
   * {
   *   id: string,
   *   name: string,
   *   displayName: string,
   *   description: string,
   *   skillmd: string,
   *   skillConfig?: {...},
   *   experienceScore: number,
   *   category: string,
   *   isPublic: boolean,
   *   version: string,
   *   license?: string,
   *   trainingHistory: [...],
   *   additionalFiles: [...],
   *   agentSelection: [...],
   *   toolConfig?: {...},
   *   modelConfig?: {...},
   *   analytics?: {...},
   *   mcpConfig: [...],
   *   tasks: [...],
   *   inputFields: [...],
   *   trainingAgent?: string,
   *   createdAt: Date,
   *   updatedAt: Date
   * }
   * ```
   *
   * @param strapiData - Raw Strapi response data with nested attributes
   * @returns Transformed Skill object ready for application use
   *
   * @example
   * // Transform basic skill
   * const strapiResponse = {
   *   documentId: 'skill-123',
   *   attributes: {
   *     name: 'git-workflow',
   *     displayName: 'Git Workflow',
   *     description: 'Manage git operations',
   *     skillmd: '# Git Workflow\n\nManage git operations...',
   *     experienceScore: 85,
   *     category: 'development',
   *     isPublic: true,
   *     version: '1.0.0',
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const skill = this.transformSkill(strapiResponse);
   * // Returns: {
   * //   id: 'skill-123',
   * //   name: 'git-workflow',
   * //   displayName: 'Git Workflow',
   * //   description: 'Manage git operations',
   * //   skillmd: '# Git Workflow\n\nManage git operations...',
   * //   experienceScore: 85,
   * //   category: 'development',
   * //   isPublic: true,
   * //   version: '1.0.0',
   * //   trainingHistory: [],
   * //   additionalFiles: [],
   * //   ...
   * //   createdAt: Date object,
   * //   updatedAt: Date object
   * // }
   *
   * @example
   * // Transform skill with component fields
   * const strapiResponse = {
   *   documentId: 'skill-456',
   *   attributes: {
   *     name: 'api-testing',
   *     displayName: 'API Testing',
   *     description: 'Test REST APIs',
   *     skillmd: '# API Testing\n\nTest REST APIs...',
   *     skillConfig: {
   *       systemPromptPrefix: 'You are an API testing expert'
   *     },
   *     experienceScore: 92,
   *     category: 'testing',
   *     isPublic: true,
   *     version: '2.0.0',
   *     license: 'MIT',
   *     trainingHistory: [
   *       {
   *         timestamp: '2024-01-15T10:30:00.000Z',
   *         agentId: 'agent-1',
   *         feedback: 'positive',
   *         experienceGained: 5
   *       }
   *     ],
   *     additionalFiles: [
   *       {
   *         file: {
   *           data: {
   *             documentId: 'file-1',
   *             attributes: { name: 'examples.json', url: '/uploads/...' }
   *           }
   *         },
   *         description: 'API test examples'
   *       }
   *     ],
   *     inputFields: [
   *       { name: 'apiUrl', type: 'text', label: 'API URL', required: true },
   *       { name: 'method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] }
   *     ],
   *     trainingAgent: {
   *       data: { documentId: 'agent-123' }
   *     },
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-15T10:30:00.000Z'
   *   }
   * };
   * const skill = this.transformSkill(strapiResponse);
   * // Returns skill with all component fields populated
   * // trainingAgent is normalized to 'agent-123'
   *
   * @see prepareSkillData - Reverse transformation for API requests
   * @see getAllSkills
   * @see getSkill
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
   *
   * @description Converts Strapi v5 API response format to the application's MCPServer domain model.
   * Handles both stdio and SDK transport types, builds config object for frontend compatibility,
   * and recursively transforms nested mcpTools relation when populated.
   *
   * **Key Transformations:**
   * - Creates `config` object with transport-specific fields for frontend use
   * - Handles nested `mcpTools` relation (can be array or `{ data: [...] }` format)
   * - Recursively transforms each tool using `transformMCPTool()`
   * - Converts ISO date strings to Date objects
   * - Normalizes disabled/enabled state
   *
   * **Strapi Response Format:**
   * ```typescript
   * {
   *   documentId: 'mcp-server-uuid',
   *   attributes: {
   *     name: string,
   *     command: string,
   *     description: string,
   *     args: string[],
   *     env: Record<string, string>,
   *     disabled: boolean,
   *     transport: 'stdio' | 'sse',
   *     healthCheckUrl?: string,
   *     isHealthy: boolean,
   *     lastHealthCheck?: string,
   *     startupTimeout: number,
   *     restartPolicy: string,
   *     toolsFetchedAt?: string,
   *     mcpTools?: { data: [...] } | [...],
   *     createdAt: string,
   *     updatedAt: string
   *   }
   * }
   * ```
   *
   * **Domain Model Format:**
   * ```typescript
   * {
   *   id: string,
   *   name: string,
   *   config: {
   *     type: 'stdio' | 'sse',
   *     command: string,
   *     args: string[],
   *     env: Record<string, string>,
   *     disabled: boolean
   *   },
   *   command: string,
   *   description: string,
   *   args: string[],
   *   env: Record<string, string>,
   *   disabled: boolean,
   *   transport: 'stdio' | 'sse',
   *   healthCheckUrl?: string,
   *   isHealthy: boolean,
   *   lastHealthCheck?: Date,
   *   startupTimeout: number,
   *   restartPolicy: string,
   *   toolsFetchedAt?: Date,
   *   mcpTools?: MCPTool[],
   *   createdAt: Date,
   *   updatedAt: Date
   * }
   * ```
   *
   * @param strapiData - Raw Strapi response data with nested attributes
   * @returns Transformed MCPServer object ready for application use
   *
   * @example
   * // Transform stdio MCP server
   * const strapiResponse = {
   *   documentId: 'mcp-server-123',
   *   attributes: {
   *     name: 'filesystem',
   *     command: 'npx',
   *     description: 'File system MCP server',
   *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *     env: { DEBUG: '1' },
   *     disabled: false,
   *     transport: 'stdio',
   *     isHealthy: true,
   *     startupTimeout: 30000,
   *     restartPolicy: 'on-failure',
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const mcpServer = this.transformMCPServer(strapiResponse);
   * // Returns: {
   * //   id: 'mcp-server-123',
   * //   name: 'filesystem',
   * //   config: {
   * //     type: 'stdio',
   * //     command: 'npx',
   * //     args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   * //     env: { DEBUG: '1' },
   * //     disabled: false
   * //   },
   * //   command: 'npx',
   * //   description: 'File system MCP server',
   * //   ...
   * //   createdAt: Date object,
   * //   updatedAt: Date object
   * // }
   *
   * @example
   * // Transform MCP server with populated tools (nested data format)
   * const strapiResponse = {
   *   documentId: 'mcp-server-456',
   *   attributes: {
   *     name: 'github',
   *     command: 'npx',
   *     description: 'GitHub MCP server',
   *     args: ['-y', '@modelcontextprotocol/server-github'],
   *     env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
   *     disabled: false,
   *     transport: 'stdio',
   *     isHealthy: true,
   *     toolsFetchedAt: '2024-01-15T10:30:00.000Z',
   *     mcpTools: {
   *       data: [
   *         {
   *           documentId: 'tool-1',
   *           attributes: {
   *             name: 'create_issue',
   *             description: 'Create GitHub issue',
   *             inputSchema: { type: 'object', properties: {...} }
   *           }
   *         },
   *         {
   *           documentId: 'tool-2',
   *           attributes: {
   *             name: 'list_repos',
   *             description: 'List repositories'
   *           }
   *         }
   *       ]
   *     },
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-15T10:30:00.000Z'
   *   }
   * };
   * const mcpServer = this.transformMCPServer(strapiResponse);
   * // Returns MCP server with mcpTools array populated with 2 transformed tools
   * // Each tool is transformed via transformMCPTool()
   *
   * @example
   * // Transform MCP server with populated tools (flat array format)
   * const strapiResponse = {
   *   documentId: 'mcp-server-789',
   *   attributes: {
   *     name: 'slack',
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-slack'],
   *     transport: 'stdio',
   *     mcpTools: [  // Flat array (some Strapi configurations)
   *       {
   *         documentId: 'tool-3',
   *         attributes: { name: 'send_message', description: 'Send Slack message' }
   *       }
   *     ],
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const mcpServer = this.transformMCPServer(strapiResponse);
   * // Handles flat array format - mcpTools array populated with 1 transformed tool
   *
   * @see transformMCPTool - Used to transform nested tools
   * @see prepareMCPServerData - Reverse transformation for API requests
   * @see getAllMCPServers
   * @see getMCPServer
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
   *
   * @description Converts Strapi v5 API response format to the application's MCPTool domain model.
   * Handles tool metadata including name, description, JSON schema for input validation, and
   * parent MCP server relation. Used both directly and as a helper for transformMCPServer.
   *
   * **Key Transformations:**
   * - Normalizes `mcpServer` relation (handles both nested and flat formats)
   * - Preserves `inputSchema` as-is (JSON Schema object for tool parameter validation)
   * - Converts ISO date strings to Date objects
   * - Sets undefined for optional fields instead of null
   *
   * **Strapi Response Format:**
   * ```typescript
   * {
   *   documentId: 'mcp-tool-uuid',
   *   attributes: {
   *     name: string,
   *     description?: string,
   *     inputSchema?: object,  // JSON Schema
   *     mcpServer?: { documentId: string } | { data: { documentId: string } },
   *     createdAt: string,
   *     updatedAt: string
   *   }
   * }
   * ```
   *
   * **Domain Model Format:**
   * ```typescript
   * {
   *   id: string,
   *   name: string,
   *   description?: string,
   *   inputSchema?: object,  // JSON Schema for parameter validation
   *   mcpServer?: string,    // MCP server documentId
   *   createdAt: Date,
   *   updatedAt: Date
   * }
   * ```
   *
   * @param strapiData - Raw Strapi response data with nested attributes
   * @returns Transformed MCPTool object ready for application use
   *
   * @example
   * // Transform basic MCP tool (no schema)
   * const strapiResponse = {
   *   documentId: 'tool-123',
   *   attributes: {
   *     name: 'list_files',
   *     description: 'List files in a directory',
   *     mcpServer: {
   *       documentId: 'mcp-server-1'
   *     },
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const tool = this.transformMCPTool(strapiResponse);
   * // Returns: {
   * //   id: 'tool-123',
   * //   name: 'list_files',
   * //   description: 'List files in a directory',
   * //   inputSchema: undefined,
   * //   mcpServer: 'mcp-server-1',
   * //   createdAt: Date object,
   * //   updatedAt: Date object
   * // }
   *
   * @example
   * // Transform MCP tool with JSON Schema
   * const strapiResponse = {
   *   documentId: 'tool-456',
   *   attributes: {
   *     name: 'create_issue',
   *     description: 'Create GitHub issue',
   *     inputSchema: {
   *       type: 'object',
   *       properties: {
   *         title: { type: 'string', description: 'Issue title' },
   *         body: { type: 'string', description: 'Issue body' },
   *         labels: { type: 'array', items: { type: 'string' } }
   *       },
   *       required: ['title', 'body']
   *     },
   *     mcpServer: {
   *       data: {  // Nested data format
   *         documentId: 'mcp-server-github'
   *       }
   *     },
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-15T10:30:00.000Z'
   *   }
   * };
   * const tool = this.transformMCPTool(strapiResponse);
   * // Returns tool with inputSchema preserved as JSON Schema object
   * // mcpServer is normalized to 'mcp-server-github'
   *
   * @example
   * // Transform MCP tool without server relation
   * const strapiResponse = {
   *   documentId: 'tool-789',
   *   attributes: {
   *     name: 'send_message',
   *     description: 'Send Slack message',
   *     inputSchema: {
   *       type: 'object',
   *       properties: {
   *         channel: { type: 'string' },
   *         text: { type: 'string' }
   *       }
   *     },
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const tool = this.transformMCPTool(strapiResponse);
   * // Returns tool with mcpServer: undefined (orphaned tool)
   *
   * @see transformMCPServer - Uses this method to transform nested tools
   * @see createMCPTool
   * @see getMCPToolsByServerId
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
   *
   * @description Converts Strapi v5 API response format to the application's Task domain model.
   * Handles task metadata, execution state, agent relation, and extracts name/description from
   * metadata object. Supports both running and completed task states.
   *
   * **Key Transformations:**
   * - Normalizes `agent` relation to `agentId` and `agentName`
   * - Extracts `name` from metadata.name (fallback to message or 'Unnamed Task')
   * - Extracts `description` from metadata.description
   * - Converts ISO date strings to Date objects (startedAt, completedAt)
   * - Preserves execution metrics (executionTime, tokensUsed, cost)
   * - Includes executionLog array for viewing task progress
   *
   * **Strapi Response Format:**
   * ```typescript
   * {
   *   documentId: 'task-uuid',
   *   attributes: {
   *     agent?: { documentId: string, name: string } | { data: {...} },
   *     agentId?: string,
   *     message: string,
   *     status: 'pending' | 'running' | 'completed' | 'failed',
   *     result?: string,
   *     error?: string,
   *     startedAt?: string,
   *     completedAt?: string,
   *     executionTime?: number,
   *     tokensUsed?: number,
   *     cost?: number,
   *     metadata?: { name?: string, description?: string, ... },
   *     executionLog?: Array<{ timestamp: string, message: string }>,
   *     createdAt: string,
   *     updatedAt: string
   *   }
   * }
   * ```
   *
   * **Domain Model Format:**
   * ```typescript
   * {
   *   id: string,
   *   agentId?: string,
   *   agentName?: string,
   *   name: string,
   *   description?: string,
   *   message: string,
   *   status: 'pending' | 'running' | 'completed' | 'failed',
   *   result?: string,
   *   error?: string,
   *   startedAt?: Date,
   *   completedAt?: Date,
   *   executionTime?: number,
   *   tokensUsed?: number,
   *   cost?: number,
   *   metadata: object,
   *   executionLog: Array<object>,
   *   createdAt: Date,
   *   updatedAt: Date
   * }
   * ```
   *
   * @param strapiData - Raw Strapi response data with nested attributes
   * @returns Transformed Task object ready for application use
   *
   * @example
   * // Transform pending task
   * const strapiResponse = {
   *   documentId: 'task-123',
   *   attributes: {
   *     agent: {
   *       documentId: 'agent-1',
   *       name: 'Research Agent'
   *     },
   *     message: 'Research latest AI trends',
   *     status: 'pending',
   *     metadata: {
   *       name: 'AI Trends Research',
   *       description: 'Gather info on latest AI developments',
   *       priority: 'high'
   *     },
   *     createdAt: '2024-01-01T00:00:00.000Z',
   *     updatedAt: '2024-01-01T00:00:00.000Z'
   *   }
   * };
   * const task = this.transformTask(strapiResponse);
   * // Returns: {
   * //   id: 'task-123',
   * //   agentId: 'agent-1',
   * //   agentName: 'Research Agent',
   * //   name: 'AI Trends Research',
   * //   description: 'Gather info on latest AI developments',
   * //   message: 'Research latest AI trends',
   * //   status: 'pending',
   * //   metadata: { name: '...', description: '...', priority: 'high' },
   * //   executionLog: [],
   * //   createdAt: Date object,
   * //   updatedAt: Date object
   * // }
   *
   * @example
   * // Transform completed task with metrics
   * const strapiResponse = {
   *   documentId: 'task-456',
   *   attributes: {
   *     agent: {
   *       data: {
   *         documentId: 'agent-2',
   *         attributes: { name: 'Code Agent' }
   *       }
   *     },
   *     message: 'Generate unit tests',
   *     status: 'completed',
   *     result: 'Successfully generated 15 unit tests',
   *     startedAt: '2024-01-15T10:00:00.000Z',
   *     completedAt: '2024-01-15T10:05:30.000Z',
   *     executionTime: 330000,  // milliseconds
   *     tokensUsed: 12500,
   *     cost: 0.025,
   *     metadata: {
   *       name: 'Unit Test Generation',
   *       description: 'Generate comprehensive unit tests for user service'
   *     },
   *     executionLog: [
   *       { timestamp: '2024-01-15T10:00:00.000Z', message: 'Task started' },
   *       { timestamp: '2024-01-15T10:02:00.000Z', message: 'Analyzing code structure' },
   *       { timestamp: '2024-01-15T10:05:30.000Z', message: 'Tests generated' }
   *     ],
   *     createdAt: '2024-01-15T09:55:00.000Z',
   *     updatedAt: '2024-01-15T10:05:30.000Z'
   *   }
   * };
   * const task = this.transformTask(strapiResponse);
   * // Returns completed task with execution metrics and log
   * // executionTime: 330000ms (5.5 minutes), cost: $0.025
   *
   * @example
   * // Transform failed task with error
   * const strapiResponse = {
   *   documentId: 'task-789',
   *   attributes: {
   *     agentId: 'agent-3',  // Direct ID (no populated relation)
   *     message: 'Deploy to production',
   *     status: 'failed',
   *     error: 'Deployment failed: Invalid credentials',
   *     startedAt: '2024-01-20T14:00:00.000Z',
   *     completedAt: '2024-01-20T14:01:15.000Z',
   *     executionTime: 75000,
   *     metadata: {},  // No name in metadata
   *     createdAt: '2024-01-20T13:55:00.000Z',
   *     updatedAt: '2024-01-20T14:01:15.000Z'
   *   }
   * };
   * const task = this.transformTask(strapiResponse);
   * // Returns: {
   * //   ...
   * //   agentId: 'agent-3',
   * //   agentName: undefined,  // Relation not populated
   * //   name: 'Deploy to production',  // Fallback to message
   * //   description: undefined,
   * //   status: 'failed',
   * //   error: 'Deployment failed: Invalid credentials',
   * //   ...
   * // }
   *
   * @see prepareTaskData - Reverse transformation for API requests
   * @see getAllTasks
   * @see getTask
   * @see createTask
   * @see updateTask
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
   *
   * @description Prepares Agent domain model for Strapi v5 API requests (create/update operations).
   * Reverse transformation of transformAgent - converts application format to Strapi's expected format.
   * Automatically generates URL-friendly slug from name if provided.
   *
   * **Key Transformations:**
   * - Auto-generates `slug` from `name` using generateSlug() helper
   * - Only includes fields that are provided (partial updates supported)
   * - Component fields (toolConfig, modelConfig, analytics, metadata) passed through as-is
   * - Component-based relations (mcpConfig, skillSelection, tasks) passed through as-is
   * - Omits undefined fields to support partial updates
   *
   * **Input (Domain Model):**
   * ```typescript
   * {
   *   name?: string,
   *   description?: string,
   *   systemPrompt?: string,
   *   enabled?: boolean,
   *   toolConfig?: { allowedTools: string[], ... },
   *   modelConfig?: { model: string, temperature: number, ... },
   *   analytics?: { tokenUsage: number, ... },
   *   metadata?: [{ key: string, value: string }],
   *   mcpConfig?: [...],
   *   skillSelection?: [...],
   *   tasks?: [...]
   * }
   * ```
   *
   * **Output (Strapi Format):**
   * ```typescript
   * {
   *   name?: string,
   *   slug?: string,  // Auto-generated from name
   *   description?: string,
   *   systemPrompt?: string,
   *   enabled?: boolean,
   *   toolConfig?: {...},
   *   modelConfig?: {...},
   *   analytics?: {...},
   *   metadata?: [...],
   *   mcpConfig?: [...],
   *   skillSelection?: [...],
   *   tasks?: [...]
   * }
   * ```
   *
   * @param agent - Partial Agent object (supports partial updates)
   * @returns Strapi-formatted data object ready for POST/PUT requests
   *
   * @example
   * // Prepare basic agent for creation
   * const agentData = {
   *   name: 'Research Agent',
   *   description: 'Agent for research tasks',
   *   systemPrompt: 'You are a research assistant',
   *   enabled: true
   * };
   * const strapiData = this.prepareAgentData(agentData);
   * // Returns: {
   * //   name: 'Research Agent',
   * //   slug: 'research-agent',  // Auto-generated
   * //   description: 'Agent for research tasks',
   * //   systemPrompt: 'You are a research assistant',
   * //   enabled: true
   * // }
   *
   * @example
   * // Prepare agent with component fields
   * const agentData = {
   *   name: 'Code Agent',
   *   description: 'Agent for code generation',
   *   systemPrompt: 'You are a coding assistant',
   *   enabled: true,
   *   toolConfig: {
   *     allowedTools: ['bash', 'read', 'write'],
   *     maxToolCalls: 50
   *   },
   *   modelConfig: {
   *     model: 'opus',
   *     temperature: 0.7,
   *     timeout: 600000
   *   },
   *   metadata: [
   *     { key: 'version', value: '2.0' },
   *     { key: 'author', value: 'team' }
   *   ],
   *   mcpConfig: [
   *     {
   *       mcpServer: 'mcp-server-1',
   *       selectedTools: [
   *         { mcpTool: 'tool-1' }
   *       ]
   *     }
   *   ]
   * };
   * const strapiData = this.prepareAgentData(agentData);
   * // Returns Strapi-formatted data with all component fields
   * // Component fields passed through as-is for Strapi v5
   *
   * @example
   * // Prepare partial update (only update description and enabled status)
   * const updateData = {
   *   description: 'Updated description',
   *   enabled: false
   * };
   * const strapiData = this.prepareAgentData(updateData);
   * // Returns: {
   * //   description: 'Updated description',
   * //   enabled: false
   * // }
   * // Only includes provided fields - supports partial updates
   * // No slug generated since name not provided
   *
   * @see transformAgent - Reverse transformation from Strapi to domain model
   * @see createAgent
   * @see updateAgent
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
   *
   * @description Prepares Skill domain model for Strapi v5 API requests (create/update operations).
   * Reverse transformation of transformSkill - converts application format to Strapi's expected format.
   * Supports partial updates by only including provided fields.
   *
   * **Key Transformations:**
   * - Only includes fields that are provided (partial updates supported)
   * - Component fields (trainingHistory, additionalFiles, toolConfig, etc.) passed through as-is
   * - Direct relation (trainingAgent) passed through as agent documentId
   * - Omits undefined fields to support partial updates
   *
   * **Input (Domain Model):**
   * ```typescript
   * {
   *   name?: string,
   *   displayName?: string,
   *   description?: string,
   *   skillmd?: string,
   *   experienceScore?: number,
   *   category?: string,
   *   isPublic?: boolean,
   *   version?: string,
   *   license?: string,
   *   trainingHistory?: [...],
   *   additionalFiles?: [...],
   *   agentSelection?: [...],
   *   toolConfig?: {...},
   *   modelConfig?: {...},
   *   analytics?: {...},
   *   mcpConfig?: [...],
   *   tasks?: [...],
   *   inputFields?: [...],
   *   trainingAgent?: string
   * }
   * ```
   *
   * **Output (Strapi Format):**
   * ```typescript
   * {
   *   name?: string,
   *   displayName?: string,
   *   description?: string,
   *   skillmd?: string,
   *   experienceScore?: number,
   *   category?: string,
   *   isPublic?: boolean,
   *   version?: string,
   *   license?: string,
   *   trainingHistory?: [...],
   *   additionalFiles?: [...],
   *   agentSelection?: [...],
   *   toolConfig?: {...},
   *   modelConfig?: {...},
   *   analytics?: {...},
   *   mcpConfig?: [...],
   *   tasks?: [...],
   *   inputFields?: [...],
   *   trainingAgent?: string
   * }
   * ```
   *
   * @param skill - Partial Skill object (supports partial updates)
   * @returns Strapi-formatted data object ready for POST/PUT requests
   *
   * @example
   * // Prepare basic skill for creation
   * const skillData = {
   *   name: 'git-workflow',
   *   displayName: 'Git Workflow',
   *   description: 'Manage git operations',
   *   skillmd: '# Git Workflow\n\nManage git operations...',
   *   category: 'development',
   *   isPublic: true,
   *   version: '1.0.0'
   * };
   * const strapiData = this.prepareSkillData(skillData);
   * // Returns Strapi-formatted data with all basic fields
   *
   * @example
   * // Prepare skill with component fields
   * const skillData = {
   *   name: 'api-testing',
   *   displayName: 'API Testing',
   *   description: 'Test REST APIs',
   *   skillmd: '# API Testing\n\nTest REST APIs...',
   *   category: 'testing',
   *   isPublic: true,
   *   version: '2.0.0',
   *   license: 'MIT',
   *   trainingHistory: [
   *     {
   *       timestamp: '2024-01-15T10:30:00.000Z',
   *       agentId: 'agent-1',
   *       feedback: 'positive',
   *       experienceGained: 5
   *     }
   *   ],
   *   additionalFiles: [
   *     {
   *       file: 'file-1',  // File documentId
   *       description: 'API test examples'
   *     }
   *   ],
   *   inputFields: [
   *     { name: 'apiUrl', type: 'text', label: 'API URL', required: true },
   *     { name: 'method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] }
   *   ],
   *   trainingAgent: 'agent-123'
   * };
   * const strapiData = this.prepareSkillData(skillData);
   * // Returns Strapi-formatted data with all component fields
   * // Component fields passed through as-is for Strapi v5
   *
   * @example
   * // Prepare partial update (only update experience score and training history)
   * const updateData = {
   *   experienceScore: 95,
   *   trainingHistory: [
   *     ...existingHistory,
   *     { timestamp: new Date().toISOString(), agentId: 'agent-1', feedback: 'positive', experienceGained: 3 }
   *   ]
   * };
   * const strapiData = this.prepareSkillData(updateData);
   * // Returns: {
   * //   experienceScore: 95,
   * //   trainingHistory: [...]
   * // }
   * // Only includes provided fields - supports partial updates
   *
   * @see transformSkill - Reverse transformation from Strapi to domain model
   * @see createSkill
   * @see updateSkill
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
   *
   * @description Prepares MCPServer domain model for Strapi v5 API requests (create/update operations).
   * Reverse transformation of transformMCPServer - converts application format to Strapi's expected format.
   * Only includes core MCP server configuration fields (no nested tools).
   *
   * **Key Transformations:**
   * - Only includes fields that are provided (partial updates supported)
   * - Omits `config` object (frontend-specific, not stored in Strapi)
   * - Omits `mcpTools` relation (managed separately via createMCPTool/bulkSyncMCPTools)
   * - Omits computed fields (isHealthy, lastHealthCheck, toolsFetchedAt)
   * - Preserves transport type, command, args, env for stdio/SDK servers
   *
   * **Input (Domain Model):**
   * ```typescript
   * {
   *   name?: string,
   *   command?: string,
   *   description?: string,
   *   args?: string[],
   *   env?: Record<string, string>,
   *   disabled?: boolean,
   *   transport?: 'stdio' | 'sse',
   *   healthCheckUrl?: string,
   *   startupTimeout?: number,
   *   restartPolicy?: string
   * }
   * ```
   *
   * **Output (Strapi Format):**
   * ```typescript
   * {
   *   name?: string,
   *   command?: string,
   *   description?: string,
   *   args?: string[],
   *   env?: Record<string, string>,
   *   disabled?: boolean,
   *   transport?: 'stdio' | 'sse',
   *   healthCheckUrl?: string,
   *   startupTimeout?: number,
   *   restartPolicy?: string
   * }
   * ```
   *
   * @param mcp - Partial MCPServer object (supports partial updates)
   * @returns Strapi-formatted data object ready for POST/PUT requests
   *
   * @example
   * // Prepare stdio MCP server for creation
   * const mcpServerData = {
   *   name: 'filesystem',
   *   command: 'npx',
   *   description: 'File system MCP server',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *   env: { DEBUG: '1' },
   *   disabled: false,
   *   transport: 'stdio',
   *   startupTimeout: 30000,
   *   restartPolicy: 'on-failure'
   * };
   * const strapiData = this.prepareMCPServerData(mcpServerData);
   * // Returns Strapi-formatted data with all fields
   *
   * @example
   * // Prepare MCP server with environment variables
   * const mcpServerData = {
   *   name: 'github',
   *   command: 'npx',
   *   description: 'GitHub MCP server',
   *   args: ['-y', '@modelcontextprotocol/server-github'],
   *   env: {
   *     GITHUB_TOKEN: '${GITHUB_TOKEN}',  // Environment variable substitution
   *     GITHUB_REPO: 'owner/repo'
   *   },
   *   transport: 'stdio'
   * };
   * const strapiData = this.prepareMCPServerData(mcpServerData);
   * // Returns Strapi-formatted data
   * // Environment variables will be substituted at runtime by MCPService
   *
   * @example
   * // Prepare partial update (only update disabled status and description)
   * const updateData = {
   *   disabled: true,
   *   description: 'Temporarily disabled for maintenance'
   * };
   * const strapiData = this.prepareMCPServerData(updateData);
   * // Returns: {
   * //   disabled: true,
   * //   description: 'Temporarily disabled for maintenance'
   * // }
   * // Only includes provided fields - supports partial updates
   *
   * @see transformMCPServer - Reverse transformation from Strapi to domain model
   * @see createMCPServer
   * @see updateMCPServer
   * @see bulkSyncMCPTools - Used to sync nested tools separately
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
   *
   * @description Prepares Task domain model for Strapi v5 API requests (create/update operations).
   * Reverse transformation of transformTask - converts application format to Strapi's expected format.
   * Handles Date-to-ISO string conversion and agentId-to-agent relation mapping.
   *
   * **Key Transformations:**
   * - Maps `agentId` (domain model) to `agent` (Strapi relation field)
   * - Converts Date objects to ISO 8601 strings (startedAt, completedAt)
   * - Passes through ISO strings unchanged if already strings
   * - Preserves execution metrics (executionTime, tokensUsed, cost)
   * - Includes metadata and executionLog for task tracking
   *
   * **Input (Domain Model):**
   * ```typescript
   * {
   *   agentId?: string,
   *   message?: string,
   *   status?: 'pending' | 'running' | 'completed' | 'failed',
   *   result?: string,
   *   error?: string,
   *   startedAt?: Date | string,
   *   completedAt?: Date | string,
   *   executionTime?: number,
   *   tokensUsed?: number,
   *   cost?: number,
   *   metadata?: object,
   *   executionLog?: Array<object>
   * }
   * ```
   *
   * **Output (Strapi Format):**
   * ```typescript
   * {
   *   agent?: string,  // Relation field (documentId)
   *   message?: string,
   *   status?: 'pending' | 'running' | 'completed' | 'failed',
   *   result?: string,
   *   error?: string,
   *   startedAt?: string,  // ISO 8601 string
   *   completedAt?: string,  // ISO 8601 string
   *   executionTime?: number,
   *   tokensUsed?: number,
   *   cost?: number,
   *   metadata?: object,
   *   executionLog?: Array<object>
   * }
   * ```
   *
   * @param task - Partial Task object (supports partial updates)
   * @returns Strapi-formatted data object ready for POST/PUT requests
   *
   * @example
   * // Prepare new task for creation
   * const taskData = {
   *   agentId: 'agent-123',
   *   message: 'Research latest AI trends',
   *   status: 'pending',
   *   metadata: {
   *     name: 'AI Trends Research',
   *     description: 'Gather info on latest AI developments',
   *     priority: 'high'
   *   }
   * };
   * const strapiData = this.prepareTaskData(taskData);
   * // Returns: {
   * //   agent: 'agent-123',  // Mapped from agentId
   * //   message: 'Research latest AI trends',
   * //   status: 'pending',
   * //   metadata: { name: '...', description: '...', priority: 'high' }
   * // }
   *
   * @example
   * // Prepare task status update with Date objects
   * const updateData = {
   *   status: 'completed',
   *   result: 'Successfully generated 15 unit tests',
   *   startedAt: new Date('2024-01-15T10:00:00.000Z'),
   *   completedAt: new Date('2024-01-15T10:05:30.000Z'),
   *   executionTime: 330000,  // 5.5 minutes in milliseconds
   *   tokensUsed: 12500,
   *   cost: 0.025
   * };
   * const strapiData = this.prepareTaskData(updateData);
   * // Returns: {
   * //   status: 'completed',
   * //   result: 'Successfully generated 15 unit tests',
   * //   startedAt: '2024-01-15T10:00:00.000Z',  // Date converted to ISO string
   * //   completedAt: '2024-01-15T10:05:30.000Z',  // Date converted to ISO string
   * //   executionTime: 330000,
   * //   tokensUsed: 12500,
   * //   cost: 0.025
   * // }
   *
   * @example
   * // Prepare task with execution log
   * const updateData = {
   *   status: 'running',
   *   startedAt: new Date(),
   *   executionLog: [
   *     { timestamp: new Date().toISOString(), message: 'Task started' },
   *     { timestamp: new Date().toISOString(), message: 'Analyzing code structure' }
   *   ]
   * };
   * const strapiData = this.prepareTaskData(updateData);
   * // Returns task data with executionLog for real-time progress tracking
   *
   * @example
   * // Prepare failed task update
   * const updateData = {
   *   status: 'failed',
   *   error: 'Deployment failed: Invalid credentials',
   *   completedAt: new Date(),
   *   executionTime: 75000
   * };
   * const strapiData = this.prepareTaskData(updateData);
   * // Returns: {
   * //   status: 'failed',
   * //   error: 'Deployment failed: Invalid credentials',
   * //   completedAt: '2024-01-20T14:01:15.000Z',
   * //   executionTime: 75000
   * // }
   *
   * @see transformTask - Reverse transformation from Strapi to domain model
   * @see createTask
   * @see updateTask
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
   *
   * @description
   * Clears all entries from the LRU cache, forcing fresh API requests on next data access.
   * Use this method when you need to ensure data freshness after external changes to Strapi
   * data (e.g., manual edits in Strapi Admin Panel, bulk imports, database migrations).
   *
   * **Cache Configuration:**
   * - TTL: 5 minutes (300,000ms)
   * - Max Size: 100 entries
   * - Eviction: LRU (Least Recently Used)
   *
   * **When to Clear Cache:**
   * - After bulk data operations outside this client
   * - When debugging stale data issues
   * - After importing/migrating data to Strapi
   * - Manual refresh triggered by user action
   * - Testing scenarios requiring fresh data
   *
   * **Note:**
   * - Cache is automatically invalidated on mutations (create/update/delete)
   * - Individual cache entries auto-expire after 5 minutes
   * - Clearing cache forces all subsequent requests to hit the API
   *
   * @returns {void}
   *
   * @example
   * // Basic cache clear
   * strapiClient.clearCache();
   * console.log('Cache cleared - next requests will fetch fresh data');
   *
   * @example
   * // Clear cache after external data modification
   * // (e.g., after manual edits in Strapi Admin Panel)
   * async function refreshData() {
   *   strapiClient.clearCache();
   *
   *   // Subsequent requests fetch fresh data from API
   *   const agents = await strapiClient.getAllAgents();
   *   const skills = await strapiClient.getAllSkills();
   *
   *   console.log('Data refreshed from Strapi');
   * }
   *
   * @example
   * // User-triggered refresh in UI
   * app.post('/api/refresh', (req, res) => {
   *   strapiClient.clearCache();
   *   res.json({ message: 'Cache cleared successfully' });
   * });
   *
   * @example
   * // Clear cache before testing
   * describe('Strapi Client Tests', () => {
   *   beforeEach(() => {
   *     // Ensure tests start with clean cache
   *     strapiClient.clearCache();
   *   });
   *
   *   it('should fetch fresh data from API', async () => {
   *     const agents = await strapiClient.getAllAgents();
   *     expect(agents).toBeDefined();
   *   });
   * });
   *
   * @example
   * // Periodic cache refresh for long-running processes
   * setInterval(() => {
   *   strapiClient.clearCache();
   *   console.log('[Cache] Periodic cache cleared');
   * }, 1000 * 60 * 15); // Clear every 15 minutes
   *
   * @example
   * // Clear cache after bulk import
   * async function importAgents(agentsData) {
   *   // Bulk import agents via direct API calls
   *   for (const agentData of agentsData) {
   *     await strapiClient.createAgent(agentData);
   *   }
   *
   *   // Clear cache to ensure fresh data
   *   strapiClient.clearCache();
   *
   *   console.log('Import complete, cache cleared');
   * }
   *
   * @see {@link getCacheStats} - Get cache statistics
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[Strapi] Cleared ${size} cache entries`);
  }

  /**
   * Get current cache statistics
   *
   * @description
   * Returns current cache statistics including the number of entries, maximum capacity,
   * and TTL configuration. Use this for monitoring cache utilization, debugging performance
   * issues, or implementing cache health dashboards.
   *
   * **Returned Statistics:**
   * - `size`: Current number of cached entries
   * - `max`: Maximum cache capacity (100 entries)
   * - `ttl`: Time-to-live in milliseconds (300,000ms = 5 minutes)
   *
   * **Cache Behavior:**
   * - When `size` reaches `max`, least recently used entries are evicted
   * - Each entry expires after `ttl` milliseconds
   * - TTL is refreshed on cache hits (updateAgeOnGet: true)
   *
   * @returns {Object} Cache statistics object
   * @returns {number} returns.size - Current number of entries in cache
   * @returns {number} returns.max - Maximum cache capacity
   * @returns {number} returns.ttl - Time-to-live in milliseconds
   *
   * @example
   * // Basic usage - get cache stats
   * const stats = strapiClient.getCacheStats();
   *
   * console.log('Cache Statistics:');
   * console.log(`  Entries: ${stats.size}/${stats.max}`);
   * console.log(`  TTL: ${stats.ttl / 1000}s`);
   *
   * @example
   * // Check cache utilization
   * const stats = strapiClient.getCacheStats();
   * const utilizationPercent = (stats.size / stats.max) * 100;
   *
   * console.log(`Cache utilization: ${utilizationPercent.toFixed(1)}%`);
   *
   * if (utilizationPercent > 80) {
   *   console.warn('Cache is nearly full - consider increasing max size');
   * }
   *
   * @example
   * // Display cache stats in monitoring dashboard
   * app.get('/api/cache/stats', (req, res) => {
   *   const stats = strapiClient.getCacheStats();
   *
   *   res.json({
   *     cache: {
   *       size: stats.size,
   *       max: stats.max,
   *       utilization: `${((stats.size / stats.max) * 100).toFixed(1)}%`,
   *       ttl: `${stats.ttl / 1000}s`,
   *       ttlMinutes: stats.ttl / 60000
   *     }
   *   });
   * });
   *
   * @example
   * // Monitor cache growth over time
   * const monitorCache = () => {
   *   const stats = strapiClient.getCacheStats();
   *   const timestamp = new Date().toISOString();
   *
   *   console.log(`[${timestamp}] Cache: ${stats.size}/${stats.max} entries`);
   * };
   *
   * // Log stats every 30 seconds
   * setInterval(monitorCache, 30000);
   *
   * @example
   * // Warn if cache is empty (potential configuration issue)
   * const stats = strapiClient.getCacheStats();
   *
   * if (stats.size === 0) {
   *   console.warn('Cache is empty - no data has been cached yet');
   *   console.warn('This is normal on startup but unusual during operation');
   * }
   *
   * @example
   * // Debug cache effectiveness
   * async function debugCacheEffectiveness() {
   *   // Clear cache and get initial stats
   *   strapiClient.clearCache();
   *   let stats = strapiClient.getCacheStats();
   *   console.log(`Initial cache size: ${stats.size}`);
   *
   *   // Make some API calls
   *   await strapiClient.getAllAgents();
   *   await strapiClient.getAllSkills();
   *   await strapiClient.getAllMCPServers();
   *
   *   // Check cache growth
   *   stats = strapiClient.getCacheStats();
   *   console.log(`Cache size after API calls: ${stats.size}`);
   *   console.log(`Cache is working: ${stats.size > 0 ? 'YES' : 'NO'}`);
   * }
   *
   * @example
   * // Format stats for logging
   * const stats = strapiClient.getCacheStats();
   *
   * const formatted = {
   *   entries: `${stats.size}/${stats.max}`,
   *   utilizationPercent: ((stats.size / stats.max) * 100).toFixed(1),
   *   ttlSeconds: stats.ttl / 1000,
   *   ttlMinutes: stats.ttl / 60000,
   *   expiryTime: new Date(Date.now() + stats.ttl).toISOString()
   * };
   *
   * console.log('Cache Stats:', formatted);
   *
   * @see {@link clearCache} - Clear all cache entries
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
