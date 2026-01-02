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

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

// Cache configuration
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const CACHE_MAX_SIZE = 100;

// ============= STRAPI CLIENT CLASS =============

/**
 * StrapiClient - Singleton service for Strapi API interactions
 *
 * Provides CRUD operations for all content types with built-in caching,
 * data transformation, and error handling.
 */
export class StrapiClient {
  private client: AxiosInstance;
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

  // ============= FLOWS =============

  /**
   * Get all flows with optional filtering, sorting, and pagination
   * @param options - Query options for filtering, sorting, and pagination
   * @returns Array of Flow objects
   */
  async getAllFlows(options?: {
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Promise<Flow[]> {
    const cacheKey = `flows:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = this.buildQueryParams({
      ...options,
      populate: ['nodes'],
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
   * Get a single flow by ID with populated relations
   * @param id - Flow document ID
   * @returns Flow object
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
   * Get a flow by slug
   * @param slug - URL-friendly slug identifier
   * @returns Flow object or null if not found
   */
  async getFlowBySlug(slug: string): Promise<Flow | null> {
    const cacheKey = `flow:slug:${slug}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/flows',
      {
        params: {
          filters: { slug: { $eq: slug } },
          populate: '*',
        },
      }
    );

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const flow = this.transformFlow(data.data[0]);
    this.cache.set(cacheKey, flow);

    return flow;
  }

  /**
   * Get all active flows (isActive = true)
   * @returns Array of active Flow objects
   */
  async getActiveFlows(): Promise<Flow[]> {
    return this.getAllFlows({
      filters: { isActive: true },
      sort: ['name:asc'],
    });
  }

  /**
   * Get flows by category
   * @param category - Flow category
   * @returns Array of Flow objects in the specified category
   */
  async getFlowsByCategory(category: FlowCategory): Promise<Flow[]> {
    return this.getAllFlows({
      filters: { category },
      sort: ['name:asc'],
    });
  }

  /**
   * Get flows by status
   * @param status - Flow status
   * @returns Array of Flow objects with the specified status
   */
  async getFlowsByStatus(status: FlowStatus): Promise<Flow[]> {
    return this.getAllFlows({
      filters: { status },
      sort: ['updatedAt:desc'],
    });
  }

  /**
   * Create a new flow
   * @param flowData - Flow creation data
   * @returns Created Flow object
   */
  async createFlow(flowData: Partial<Flow>): Promise<Flow> {
    const preparedData = this.prepareFlowData(flowData);
    const { data } = await this.client.post<StrapiData<any>>(
      '/flows',
      { data: preparedData }
    );

    if (!data.data) {
      throw new Error('Failed to create flow');
    }

    this.invalidateCache('flows');
    return this.transformFlow(data.data);
  }

  /**
   * Update an existing flow
   * @param id - Flow document ID
   * @param flowData - Flow update data
   * @returns Updated Flow object
   */
  async updateFlow(id: string, flowData: Partial<Flow>): Promise<Flow> {
    const preparedData = this.prepareFlowData(flowData);
    const { data } = await this.client.put<StrapiData<any>>(
      `/flows/${id}`,
      { data: preparedData }
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
   * @param id - Flow document ID
   */
  async deleteFlow(id: string): Promise<void> {
    await this.client.delete(`/flows/${id}`);
    this.invalidateCache('flows');
    this.cache.delete(`flow:${id}`);
  }

  /**
   * Duplicate a flow with a new name
   * @param id - Source flow document ID
   * @param newName - Name for the duplicated flow
   * @returns Duplicated Flow object
   */
  async duplicateFlow(id: string, newName?: string): Promise<Flow> {
    const original = await this.getFlow(id);

    const duplicateData: Partial<Flow> = {
      name: newName || `${original.name} (Copy)`,
      description: original.description,
      nodes: original.nodes,
      inputSchema: original.inputSchema,
      outputSchema: original.outputSchema,
      isActive: false,
      status: 'draft' as FlowStatus,
      version: '1.0.0',
      category: original.category,
      metadata: original.metadata,
    };

    return this.createFlow(duplicateData);
  }

  /**
   * Transform Strapi flow response to Flow domain model
   */
  private transformFlow(strapiData: StrapiAttributes<any>): Flow {
    const attrs = this.extractAttributes(strapiData);

    return {
      id: strapiData.documentId,
      name: attrs.name,
      slug: attrs.slug,
      description: attrs.description,
      nodes: (attrs.nodes || []) as FlowNode[],
      status: (attrs.status || 'draft') as FlowStatus,
      inputSchema: (attrs.inputSchema || { properties: {}, required: [] }) as FlowInputSchema,
      outputSchema: (attrs.outputSchema || { properties: {} }) as FlowOutputSchema,
      isActive: attrs.isActive ?? false,
      version: attrs.version || '1.0.0',
      category: (attrs.category || 'custom') as FlowCategory,
      metadata: attrs.metadata,
      schedule: attrs.schedule || undefined,
      webhookEnabled: attrs.webhookEnabled ?? false,
      webhookSecret: attrs.webhookSecret,
      createdAt: new Date(attrs.createdAt),
      updatedAt: new Date(attrs.updatedAt),
    };
  }

  /**
   * Prepare flow data for Strapi API
   */
  private prepareFlowData(flow: Partial<Flow>): Record<string, any> {
    const data: Record<string, any> = {};

    if (flow.name !== undefined) {
      data.name = flow.name;
      // Generate slug from name
      data.slug = generateSlug(flow.name);
    }
    if (flow.description !== undefined) data.description = flow.description;
    if (flow.nodes !== undefined) data.nodes = flow.nodes;
    if (flow.status !== undefined) data.status = flow.status;
    if (flow.inputSchema !== undefined) data.inputSchema = flow.inputSchema;
    if (flow.outputSchema !== undefined) data.outputSchema = flow.outputSchema;
    if (flow.isActive !== undefined) data.isActive = flow.isActive;
    if (flow.version !== undefined) data.version = flow.version;
    if (flow.category !== undefined) data.category = flow.category;
    if (flow.metadata !== undefined) data.metadata = flow.metadata;
    if (flow.schedule !== undefined) data.schedule = flow.schedule;
    if (flow.webhookEnabled !== undefined) data.webhookEnabled = flow.webhookEnabled;
    if (flow.webhookSecret !== undefined) data.webhookSecret = flow.webhookSecret;

    return data;
  }

  // ============= FLOW EXECUTIONS =============

  /**
   * Get all flow executions with optional filtering, sorting, and pagination
   * @param options - Query options for filtering, sorting, and pagination
   * @returns Array of FlowExecution objects
   */
  async getAllFlowExecutions(options?: {
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Promise<FlowExecution[]> {
    const params = this.buildQueryParams({
      ...options,
      populate: ['flow'],
    });
    const { data } = await this.client.get<StrapiResponse<StrapiAttributes<any>[]>>(
      '/flow-executions',
      { params }
    );

    return data.data.map((item: StrapiAttributes<any>) => this.transformFlowExecution(item));
  }

  /**
   * Get a single flow execution by ID
   * @param id - Flow execution document ID
   * @returns FlowExecution object
   */
  async getFlowExecution(id: string): Promise<FlowExecution> {
    const { data } = await this.client.get<StrapiData<any>>(
      `/flow-executions/${id}`,
      {
        params: {
          populate: {
            flow: true,
          },
        },
      }
    );

    if (!data.data) {
      throw new Error(`Flow execution with ID ${id} not found`);
    }

    return this.transformFlowExecution(data.data);
  }

  /**
   * Create a new flow execution record
   * @param executionData - Flow execution creation data
   * @returns Created FlowExecution object
   */
  async createFlowExecution(executionData: {
    flowId: string;
    status: FlowExecutionStatus;
    input?: Record<string, any>;
    triggeredBy: FlowTriggerType;
    triggerData?: Record<string, any>;
    startedAt?: Date;
    logs?: FlowExecutionLog[];
    nodeExecutions?: NodeExecution[];
    tokensUsed?: number;
    cost?: number;
    retryCount?: number;
  }): Promise<FlowExecution> {
    const { data } = await this.client.post<StrapiData<any>>(
      '/flow-executions',
      {
        data: {
          flow: executionData.flowId,
          status: executionData.status,
          input: executionData.input,
          triggeredBy: executionData.triggeredBy,
          triggerData: executionData.triggerData,
          startedAt: executionData.startedAt?.toISOString(),
          logs: executionData.logs || [],
          nodeExecutions: executionData.nodeExecutions || [],
          tokensUsed: executionData.tokensUsed || 0,
          cost: executionData.cost || 0,
          retryCount: executionData.retryCount || 0,
        },
      }
    );

    if (!data.data) {
      throw new Error('Failed to create flow execution');
    }

    return this.transformFlowExecution(data.data);
  }

  /**
   * Update a flow execution record
   * @param id - Flow execution document ID
   * @param executionData - Flow execution update data
   * @returns Updated FlowExecution object
   */
  async updateFlowExecution(id: string, executionData: {
    status?: FlowExecutionStatus;
    output?: Record<string, any>;
    logs?: FlowExecutionLog[];
    error?: string;
    errorDetails?: Record<string, any>;
    completedAt?: Date;
    executionTime?: number;
    nodeExecutions?: NodeExecution[];
    currentNodeId?: string;
    tokensUsed?: number;
    cost?: number;
  }): Promise<FlowExecution> {
    const updateData: Record<string, any> = {};

    if (executionData.status !== undefined) updateData.status = executionData.status;
    if (executionData.output !== undefined) updateData.output = executionData.output;
    if (executionData.logs !== undefined) updateData.logs = executionData.logs;
    if (executionData.error !== undefined) updateData.error = executionData.error;
    if (executionData.errorDetails !== undefined) updateData.errorDetails = executionData.errorDetails;
    if (executionData.completedAt !== undefined) updateData.completedAt = executionData.completedAt.toISOString();
    if (executionData.executionTime !== undefined) updateData.executionTime = executionData.executionTime;
    if (executionData.nodeExecutions !== undefined) updateData.nodeExecutions = executionData.nodeExecutions;
    if (executionData.currentNodeId !== undefined) updateData.currentNodeId = executionData.currentNodeId;
    if (executionData.tokensUsed !== undefined) updateData.tokensUsed = executionData.tokensUsed;
    if (executionData.cost !== undefined) updateData.cost = executionData.cost;

    const { data } = await this.client.put<StrapiData<any>>(
      `/flow-executions/${id}`,
      { data: updateData }
    );

    if (!data.data) {
      throw new Error(`Failed to update flow execution with ID ${id}`);
    }

    return this.transformFlowExecution(data.data);
  }

  /**
   * Delete a flow execution record
   * @param id - Flow execution document ID
   */
  async deleteFlowExecution(id: string): Promise<void> {
    await this.client.delete(`/flow-executions/${id}`);
  }

  /**
   * Get flow executions by flow ID
   * @param flowId - Flow document ID
   * @param options - Optional sort and pagination
   * @returns Array of FlowExecution objects for the specified flow
   */
  async getFlowExecutionsByFlowId(flowId: string, options?: {
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Promise<FlowExecution[]> {
    return this.getAllFlowExecutions({
      ...options,
      filters: { flow: { documentId: flowId } },
    });
  }

  /**
   * Get running flow executions
   * @returns Array of FlowExecution objects with status 'running'
   */
  async getRunningFlowExecutions(): Promise<FlowExecution[]> {
    return this.getAllFlowExecutions({
      filters: { status: 'running' },
      sort: ['startedAt:desc'],
    });
  }

  /**
   * Get recent flow executions
   * @param limit - Maximum number of executions to return
   * @returns Array of recent FlowExecution objects
   */
  async getRecentFlowExecutions(limit: number = 10): Promise<FlowExecution[]> {
    return this.getAllFlowExecutions({
      sort: ['createdAt:desc'],
      pagination: { page: 1, pageSize: limit },
    });
  }

  /**
   * Get flow executions by status
   * @param status - Execution status to filter by
   * @returns Array of FlowExecution objects with the specified status
   */
  async getFlowExecutionsByStatus(status: FlowExecutionStatus): Promise<FlowExecution[]> {
    return this.getAllFlowExecutions({
      filters: { status },
      sort: ['createdAt:desc'],
    });
  }

  /**
   * Get statistics for a specific flow
   * @param flowId - Flow document ID
   * @returns FlowStats object with execution statistics
   */
  async getFlowStats(flowId: string): Promise<FlowStats> {
    const executions = await this.getFlowExecutionsByFlowId(flowId);

    const stats: FlowStats = {
      flowId,
      totalExecutions: executions.length,
      successCount: executions.filter(e => e.status === 'completed').length,
      failedCount: executions.filter(e => e.status === 'failed').length,
      cancelledCount: executions.filter(e => e.status === 'cancelled').length,
      successRate: 0,
      averageExecutionTime: 0,
      totalTokensUsed: 0,
      totalCost: 0,
    };

    // Calculate rates and totals
    if (stats.totalExecutions > 0) {
      stats.successRate = (stats.successCount / stats.totalExecutions) * 100;

      const completedExecutions = executions.filter(e => e.executionTime !== undefined);
      if (completedExecutions.length > 0) {
        stats.averageExecutionTime = completedExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / completedExecutions.length;
      }

      stats.totalTokensUsed = executions.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
      stats.totalCost = executions.reduce((sum, e) => sum + (e.cost || 0), 0);

      // Find last execution time
      const lastExecution = executions.find(e => e.startedAt);
      if (lastExecution?.startedAt) {
        stats.lastExecutedAt = lastExecution.startedAt;
      }
    }

    return stats;
  }

  /**
   * Get global statistics across all flows
   * @returns GlobalFlowStats object with aggregate statistics
   */
  async getGlobalFlowStats(): Promise<GlobalFlowStats> {
    const [flows, executions] = await Promise.all([
      this.getAllFlows(),
      this.getAllFlowExecutions({ sort: ['createdAt:desc'] }),
    ]);

    const stats: GlobalFlowStats = {
      totalFlows: flows.length,
      activeFlows: flows.filter(f => f.isActive).length,
      totalExecutions: executions.length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      successCount: executions.filter(e => e.status === 'completed').length,
      failedCount: executions.filter(e => e.status === 'failed').length,
      successRate: 0,
      totalTokensUsed: 0,
      totalCost: 0,
    };

    // Calculate success rate
    const completedOrFailed = stats.successCount + stats.failedCount;
    if (completedOrFailed > 0) {
      stats.successRate = (stats.successCount / completedOrFailed) * 100;
    }

    // Calculate totals
    stats.totalTokensUsed = executions.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    stats.totalCost = executions.reduce((sum, e) => sum + (e.cost || 0), 0);

    return stats;
  }

  /**
   * Clean up old flow executions
   * @param olderThanDays - Delete executions older than this many days
   * @returns Number of deleted executions
   */
  async cleanupOldFlowExecutions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const oldExecutions = await this.getAllFlowExecutions({
      filters: {
        createdAt: { $lt: cutoffDate.toISOString() },
        status: { $in: ['completed', 'failed', 'cancelled'] },
      },
    });

    // Delete each old execution
    await Promise.all(oldExecutions.map(e => this.deleteFlowExecution(e.id)));

    return oldExecutions.length;
  }

  /**
   * Transform Strapi flow execution response to FlowExecution domain model
   */
  private transformFlowExecution(strapiData: StrapiAttributes<any>): FlowExecution {
    const attrs = this.extractAttributes(strapiData);

    return {
      id: strapiData.documentId,
      flowId: attrs.flow?.documentId || attrs.flow,
      flow: attrs.flow?.documentId ? this.transformFlow(attrs.flow) : undefined,
      status: (attrs.status || 'pending') as FlowExecutionStatus,
      input: attrs.input,
      output: attrs.output,
      logs: (attrs.logs || []) as FlowExecutionLog[],
      error: attrs.error,
      errorDetails: attrs.errorDetails,
      startedAt: attrs.startedAt ? new Date(attrs.startedAt) : undefined,
      completedAt: attrs.completedAt ? new Date(attrs.completedAt) : undefined,
      executionTime: attrs.executionTime,
      nodeExecutions: (attrs.nodeExecutions || []) as NodeExecution[],
      currentNodeId: attrs.currentNodeId,
      tokensUsed: attrs.tokensUsed || 0,
      cost: attrs.cost || 0,
      triggeredBy: (attrs.triggeredBy || 'manual') as FlowTriggerType,
      triggerData: attrs.triggerData,
      retryCount: attrs.retryCount || 0,
      parentExecutionId: attrs.parentExecutionId,
      metadata: attrs.metadata,
      createdAt: new Date(attrs.createdAt),
      updatedAt: new Date(attrs.updatedAt),
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
