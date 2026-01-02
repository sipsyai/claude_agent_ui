/**
 * API service for Manager frontend
 *
 * Hybrid Architecture:
 * - CRUD operations -> Strapi API (proxied through Express at /api/strapi)
 * - Execution/Streaming -> Express API (/api/execute)
 *
 * Backend provides three route groups:
 * - /api/manager - Legacy file-system based routes
 * - /api/strapi - Strapi CRUD proxy routes
 * - /api/execute - SSE streaming execution routes
 */

import type { Agent as AgentType, Skill as SkillType, Agent, Skill } from '../../../types/agent.types';
import type { ModelConfiguration } from '../../../types/strapi-components.types';

// Express API base URL
// @ts-ignore - Vite env variables are available at runtime
const EXPRESS_API = import.meta.env?.VITE_EXPRESS_URL || 'http://localhost:3001/api';

// Strapi CRUD operations (proxied through Express)
const STRAPI_BASE = `${EXPRESS_API}/strapi`;

// Execution routes (SSE streaming)
const EXECUTE_BASE = `${EXPRESS_API}/execute`;

// Legacy manager endpoint (file-system based - deprecated)
const API_BASE = `${EXPRESS_API}/manager`;

/**
 * Get auth token from cookie
 */
function getAuthToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'cui-auth-token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Create fetch options with auth header
 */
function createFetchOptions(options: RequestInit = {}): RequestInit {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    ...options,
    headers,
  };
}

export interface ValidationResult {
  cli: { status: string; message: string };
  sdk: { status: string; message: string };
  folder: { status: string; message: string };
  agents: { status: string; message: string; count: number };
  commands: { status: string; message: string; count: number };
  skills: { status: string; message: string; count: number };
}

export interface SlashCommand {
  id: string;
  name: string;
  description?: string;
  path: string;
  relativePath: string;
  content: string;
  metadata?: {
    allowedTools?: string[];
    argumentHint?: string;
    model?: string;
    disableModelInvocation?: boolean;
  };
  category?: string;
}

export interface TrainingRecord {
  date: string;
  scoreBefore: number;
  scoreAfter: number;
  issuesFound: string[];
  correctionsMade: boolean;
  executionSuccess: boolean;
}

/**
 * Re-export Strapi-based type definitions
 * DEPRECATED: Direct imports from this file. Use imports from '../../../types/agent.types' instead.
 */
export type { Skill } from '../../../types/agent.types';

/**
 * Input field definition for agent and skill execution
 */
export interface InputField {
  name: string;
  type: 'text' | 'textarea' | 'dropdown' | 'multiselect' | 'checkbox' | 'number' | 'filepath';
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For dropdown and multiselect
  default?: any;
}

/**
 * Phase 3: Skill file upload definition
 */
export interface SkillFileUpload {
  fileId: string;
  fileType: 'REFERENCE' | 'EXAMPLES' | 'TROUBLESHOOTING' | 'CHANGELOG' | 'FAQ' | 'API_DOCS' | 'TUTORIAL' | 'CUSTOM';
  description?: string;
  displayOrder: number;
}

/**
 * Re-export Strapi-based type definitions
 * DEPRECATED: Direct imports from this file. Use imports from '../../../types/agent.types' instead.
 */
export type { Agent } from '../../../types/agent.types';

export interface ProjectAnalysis {
  commands: SlashCommand[];
  skills: Skill[];
  agents: Agent[];
  hasClaudeFolder: boolean;
}

/**
 * Validate project setup
 */
export async function validateProject(directoryPath: string): Promise<ValidationResult> {
  const response = await fetch(`${API_BASE}/validate`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directoryPath }),
  }));

  if (!response.ok) {
    throw new Error('Validation failed');
  }

  return response.json();
}

/**
 * Get agents
 * Now using Strapi API for CRUD operations
 */
export async function getAgents(directory?: string): Promise<AgentType[]> {
  // Use Strapi endpoint for data retrieval
  const url = new URL(`${STRAPI_BASE}/agents`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get agents');
  }

  const data = await response.json();
  return data.agents || data.data || data;
}

/**
 * Get slash commands
 */
export async function getCommands(directory?: string): Promise<SlashCommand[]> {
  const url = new URL(`${API_BASE}/commands`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get commands');
  }

  const data = await response.json();
  return data.commands;
}

/**
 * Get skills
 * Now using Strapi API for CRUD operations
 */
export async function getSkills(directory?: string, includeUsage = false): Promise<SkillType[]> {
  // Use Strapi endpoint for data retrieval
  const url = new URL(`${STRAPI_BASE}/skills`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }
  if (includeUsage) {
    url.searchParams.set('includeUsage', 'true');
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get skills');
  }

  const data = await response.json();
  return data.skills || data.data || data;
}

/**
 * Get usage information for all skills
 */
export async function getSkillsUsage(directory?: string): Promise<Array<{
  id: string;
  name: string;
  usedInAgents: string[];
  usageCount: number;
}>> {
  const url = new URL(`${STRAPI_BASE}/skills-usage`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get skills usage');
  }

  const data = await response.json();
  return data.skills;
}

/**
 * Analyze entire project
 */
export async function analyzeProject(directory?: string): Promise<ProjectAnalysis> {
  // Fetch all data from Strapi endpoints in parallel
  const [agents, commands, skills] = await Promise.all([
    getAgents(directory),
    getCommands(directory),  // Commands still use file-system
    getSkills(directory)
  ]);

  return {
    agents,
    commands,
    skills,
    hasClaudeFolder: true  // Always true when using Strapi
  };
}

/**
 * Get agent details
 * Now using Strapi API
 */
export async function getAgentDetails(id: string, directory?: string): Promise<AgentType> {
  const url = new URL(`${STRAPI_BASE}/agents/${id}`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get agent details');
  }

  const data = await response.json();
  return data.agent || data.data || data;
}

/**
 * Get command details
 */
export async function getCommandDetails(id: string, directory?: string): Promise<SlashCommand> {
  const url = new URL(`${API_BASE}/commands/${id}`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get command details');
  }

  const data = await response.json();
  return data.command;
}

/**
 * Get skill details
 * Now using Strapi API
 */
export async function getSkillDetails(id: string, directory?: string): Promise<SkillType> {
  const url = new URL(`${STRAPI_BASE}/skills/${id}`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get skill details');
  }

  const data = await response.json();
  return data.skill || data.data || data;
}

/**
 * Agent execution event types
 */
export interface AgentExecutionEvent {
  type: 'status' | 'message' | 'complete' | 'error' | 'debug';
  status?: string;
  message?: string;
  messageType?: string;
  content?: any;
  error?: string;
}

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
}

/**
 * Get available tools
 */
export async function getTools(): Promise<Tool[]> {
  const response = await fetch(`${API_BASE}/tools`, createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get tools');
  }

  const data = await response.json();
  return data.tools;
}

/**
 * Create agent request
 */
export interface CreateAgentRequest {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: 'sonnet' | 'opus' | 'haiku';
  inputFields?: InputField[];
  outputSchema?: string | object;
  mcpTools?: Record<string, string[]>; // { serverId: [toolName1, toolName2, ...] }
  skills?: string[]; // List of skill IDs this agent can use
}

/**
 * Create skill request
 */
export interface CreateSkillRequest {
  name: string;
  displayName: string;
  description: string;
  allowedTools?: string[];
  disallowedTools?: string[]; // Phase 2: Disallowed tools
  mcpTools?: Record<string, string[]>; // { serverId: [toolName1, toolName2, ...] }
  inputFields?: InputField[]; // Input parameters for skill execution
  skillmd: string;
  // Phase 1: New metadata fields
  category?: 'general-purpose' | 'code-analysis' | 'data-processing' | 'web-scraping' | 'file-manipulation' | 'api-integration' | 'browser-automation' | 'testing' | 'custom';
  isPublic?: boolean;
  version?: string;
  license?: string;
  // Phase 2: Model configuration
  modelConfig?: ModelConfiguration;
  // Phase 3: Additional files
  additionalFiles?: SkillFileUpload[];
}

/**
 * Update skill request
 */
export interface UpdateSkillRequest {
  description?: string;
  allowedTools?: string[];
  disallowedTools?: string[]; // Phase 2: Disallowed tools
  mcpTools?: Record<string, string[]>; // { serverId: [toolName1, toolName2, ...] }
  inputFields?: InputField[]; // Input parameters for skill execution
  skillmd?: string;
  // Phase 1: New metadata fields
  category?: 'general-purpose' | 'code-analysis' | 'data-processing' | 'web-scraping' | 'file-manipulation' | 'api-integration' | 'browser-automation' | 'testing' | 'custom';
  isPublic?: boolean;
  version?: string;
  license?: string;
  // Phase 2: Model configuration
  modelConfig?: ModelConfiguration;
  // Phase 3: Additional files
  additionalFiles?: SkillFileUpload[];
}

/**
 * Create skill response
 */
export interface CreateSkillResponse {
  success: boolean;
  skill?: Skill;
  path?: string;
  error?: string;
  message?: string;
}

/**
 * Create a new agent
 * Now using Strapi API
 */
export async function createAgent(
  agent: CreateAgentRequest,
  directory?: string
): Promise<{ success: boolean; agentId: string; filePath: string; message: string }> {
  const response = await fetch(`${STRAPI_BASE}/agents`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory, agent }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create agent');
  }

  return response.json();
}

/**
 * Update an existing agent
 * Now using Strapi API
 */
export async function updateAgent(
  id: string,
  agent: CreateAgentRequest,
  directory?: string
): Promise<{ success: boolean; agentId: string; filePath: string; message: string }> {
  const response = await fetch(`${STRAPI_BASE}/agents/${id}`, createFetchOptions({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory, agent }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update agent');
  }

  return response.json();
}

/**
 * Create a new skill
 * Now using Strapi API
 */
export async function createSkill(
  skill: CreateSkillRequest,
  directory?: string
): Promise<CreateSkillResponse> {
  const response = await fetch(`${STRAPI_BASE}/skills`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory, ...skill }),
  }));

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create skill');
  }

  return data;
}

/**
 * Update an existing skill
 * Now using Strapi API
 */
export async function updateSkill(
  id: string,
  skill: UpdateSkillRequest,
  directory?: string
): Promise<CreateSkillResponse> {
  const response = await fetch(`${STRAPI_BASE}/skills/${id}`, createFetchOptions({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory, ...skill }),
  }));

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update skill');
  }

  return data;
}

/**
 * Execute an agent with streaming response
 * Now using dedicated execution endpoint for SSE streaming
 */
export async function executeAgent(
  agentId: string,
  userPrompt: string,
  directory?: string,
  permissionMode?: 'default' | 'acceptEdits' | 'bypass' | 'plan',
  onEvent?: (event: AgentExecutionEvent) => void
): Promise<void> {
  // Use EXECUTE_BASE for SSE streaming operations
  const url = new URL(`${EXECUTE_BASE}/agent/${agentId}`, window.location.origin);

  const response = await fetch(url.toString(), createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory, userPrompt, permissionMode }),
  }));

  if (!response.ok) {
    throw new Error('Failed to execute agent');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Read SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (onEvent) {
              onEvent(data);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * ========================================
 * TASK MANAGEMENT API
 * ========================================
 */

const TASK_API_BASE = EXPRESS_API; // Use /api/tasks (supports both agents and skills)

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  name: string;
  description?: string;
  agentId: string; // Can be agent ID or skill ID
  agentName: string; // Can be agent name or skill name
  taskType?: 'agent' | 'skill'; // Type of task
  status: TaskStatus;
  userPrompt: string;
  inputValues?: Record<string, any>;
  permissionMode: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  result?: string;
  error?: string;
  executionLog?: any[];
  directory?: string;
}

export interface CreateTaskRequest {
  name: string;
  description?: string;
  agentId: string;
  taskType?: 'agent' | 'skill'; // Type of task (defaults to 'agent' for backward compatibility)
  userPrompt: string;
  inputValues?: Record<string, any>;
  permissionMode?: string;
  directory?: string;
}

/**
 * Get all tasks with optional filtering
 */
export async function getTasks(params?: {
  status?: TaskStatus;
  agentId?: string;
  limit?: number;
  offset?: number;
}): Promise<Task[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.agentId) queryParams.append('agentId', params.agentId);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const response = await fetch(`${TASK_API_BASE}/tasks?${queryParams}`, createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get tasks');
  }

  const data = await response.json();
  return data.data || data.tasks || data;
}

/**
 * Get task by ID
 */
export async function getTask(taskId: string): Promise<Task> {
  const response = await fetch(`${TASK_API_BASE}/tasks/${taskId}`, createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get task');
  }

  const data = await response.json();
  return data.task;
}

/**
 * Create a new task
 */
export async function createTask(request: CreateTaskRequest): Promise<Task> {
  const response = await fetch(`${TASK_API_BASE}/tasks`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create task');
  }

  const data = await response.json();
  return data.task;
}

/**
 * Execute a task with streaming response
 * Uses task.routes.ts endpoint for both local and Strapi tasks
 */
export async function executeTask(
  taskId: string,
  onEvent?: (event: any) => void
): Promise<void> {
  const url = `${TASK_API_BASE}/tasks/${taskId}/execute`;

  const response = await fetch(url, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }));

  if (!response.ok) {
    throw new Error('Failed to execute task');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Read SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (onEvent) {
              onEvent(data);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  const response = await fetch(`${TASK_API_BASE}/tasks/${taskId}`, createFetchOptions({
    method: 'DELETE',
  }));

  if (!response.ok) {
    throw new Error('Failed to delete task');
  }
}

/**
 * ========================================
 * MCP SERVERS API (SDK-aligned)
 * ========================================
 */

/**
 * Import MCP types from manager types
 */
import type {
  MCPServer as MCPServerType,
  MCPServerConfig,
  MCPStdioServerConfig,
  MCPSdkServerConfig,
  MCPSSEServerConfig,
  MCPHttpServerConfig,
  MCPTool
} from '../types';

/**
 * Re-export for convenience
 */
export type {
  MCPServerType as MCPServer,
  MCPServerConfig,
  MCPStdioServerConfig,
  MCPSdkServerConfig,
  MCPSSEServerConfig,
  MCPHttpServerConfig,
  MCPTool as MCPToolType
};

/**
 * Get all MCP servers from project config
 * Now using Strapi API
 */
export async function getMCPServers(directory?: string): Promise<MCPServerType[]> {
  const url = new URL(`${STRAPI_BASE}/mcp-servers`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get MCP servers');
  }

  const data = await response.json();
  return data.servers || data.data || data;
}

/**
 * Get MCP server details by ID
 * Now using Strapi API
 */
export async function getMCPServerDetails(
  id: string,
  directory?: string
): Promise<MCPServerType> {
  const url = new URL(`${STRAPI_BASE}/mcp-servers/${id}`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to get MCP server details');
  }

  const data = await response.json();
  return data.server || data.data || data;
}

/**
 * Create a new MCP server
 * Now using Strapi API
 */
export async function createMCPServer(
  name: string,
  config: MCPServerConfig,
  directory?: string
): Promise<{ success: boolean; server: MCPServerType; message: string }> {
  const response = await fetch(`${STRAPI_BASE}/mcp-servers`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, config, directory }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create MCP server');
  }

  return response.json();
}

/**
 * Update an existing MCP server
 * Now using Strapi API
 */
export async function updateMCPServer(
  id: string,
  config: MCPServerConfig,
  directory?: string
): Promise<{ success: boolean; server: MCPServerType; message: string }> {
  const response = await fetch(`${STRAPI_BASE}/mcp-servers/${id}`, createFetchOptions({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, directory }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update MCP server');
  }

  return response.json();
}

/**
 * Delete an MCP server
 */
export async function deleteMCPServer(
  id: string,
  directory?: string
): Promise<void> {
  const url = new URL(`${STRAPI_BASE}/mcp-servers/${id}`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions({
    method: 'DELETE',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete MCP server');
  }
}

/**
 * Test an MCP server
 */
export async function testMCPServer(
  id: string,
  directory?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const response = await fetch(`${STRAPI_BASE}/mcp-servers/${id}/test`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to test MCP server');
  }

  return response.json();
}

/**
 * Toggle MCP server enabled/disabled state
 */
export async function toggleMCPServer(
  id: string,
  directory?: string
): Promise<{ success: boolean; disabled: boolean; message: string }> {
  const response = await fetch(`${STRAPI_BASE}/mcp-servers/${id}/toggle`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to toggle MCP server');
  }

  return response.json();
}

/**
 * List tools provided by an MCP server
 */
export async function listMCPServerTools(
  id: string,
  directory?: string
): Promise<{ success: boolean; tools: MCPTool[]; error?: string }> {
  const url = new URL(`${STRAPI_BASE}/mcp-servers/${id}/tools`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions({
    method: 'GET',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list MCP server tools');
  }

  return response.json();
}

/**
 * Refresh and sync MCP server tools to Strapi
 * Fetches tools from MCP server and saves them as separate entities in Strapi
 */
export async function refreshMCPServerTools(
  id: string,
  directory?: string
): Promise<{ success: boolean; toolsCount: number; tools: MCPTool[]; error?: string }> {
  const url = new URL(`${STRAPI_BASE}/mcp-servers/${id}/refresh-tools`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to refresh MCP server tools');
  }

  return response.json();
}

/**
 * Export MCP configuration
 */
export async function exportMCPConfig(directory?: string): Promise<any> {
  const url = new URL(`${STRAPI_BASE}/mcp-servers/export`, window.location.origin);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    throw new Error('Failed to export MCP configuration');
  }

  return response.json();
}

/**
 * Import MCP configuration
 */
export async function importMCPConfig(
  config: any,
  mode: 'merge' | 'overwrite',
  directory?: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${STRAPI_BASE}/mcp-servers/import`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, mode, directory }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to import MCP configuration');
  }

  return response.json();
}

/**
 * Bulk delete MCP servers
 */
export async function bulkDeleteMCPServers(
  serverIds: string[],
  directory?: string
): Promise<{ success: boolean; successCount: number; failed: number; errors: string[]; message: string }> {
  const response = await fetch(`${STRAPI_BASE}/mcp-servers/bulk-delete`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverIds, directory }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to bulk delete MCP servers');
  }

  const data = await response.json();
  return {
    success: data.success,
    successCount: data.successCount,
    failed: data.failed,
    errors: data.errors || [],
    message: data.message,
  };
}

/**
 * Get training history for a skill
 */
export async function getSkillTrainingHistory(
  skillId: string,
  directory?: string
): Promise<TrainingRecord[]> {
  const params = new URLSearchParams();
  if (directory) {
    params.append('directory', directory);
  }

  const url = `${STRAPI_BASE}/skills/${skillId}/training-history?${params.toString()}`;
  const response = await fetch(url, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get training history');
  }

  const data = await response.json();
  return data.history || [];
}

/**
 * Upload a file to Strapi Media Library
 */
export async function uploadFile(file: File): Promise<{
  id: number;
  documentId: string;
  name: string;
  url: string;
  mime: string;
  size: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${STRAPI_BASE}/upload`, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload file');
  }

  return response.json();
}

/**
 * Delete a file from Strapi Media Library
 */
export async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(`${STRAPI_BASE}/upload/${fileId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete file');
  }
}
