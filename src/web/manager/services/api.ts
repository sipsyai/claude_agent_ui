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
 * Retrieves the authentication token from browser cookies.
 *
 * Looks for the 'cui-auth-token' cookie and returns its decoded value.
 * This token is used to authenticate API requests to the backend.
 *
 * @returns The decoded auth token string if found, null otherwise
 *
 * @example
 * const token = getAuthToken();
 * if (token) {
 *   // Use token for authenticated requests
 * }
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
 * Creates fetch options with authentication header.
 *
 * Merges provided options with an Authorization header containing the Bearer token
 * from the authentication cookie. Used internally for all authenticated API requests.
 *
 * @param options - Optional fetch configuration to merge with auth headers
 * @returns RequestInit object with auth header added
 *
 * @example
 * const options = createFetchOptions({
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' })
 * });
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
 * Validates project setup including CLI, SDK, folder structure, and resources.
 *
 * Checks if the project has the correct setup for Claude Code agents, including:
 * - CLI installation and version
 * - SDK installation
 * - .claude folder structure
 * - Available agents, commands, and skills
 *
 * @param directoryPath - Absolute path to the project directory to validate
 * @returns Promise resolving to validation results with status for each component
 * @throws Error if validation request fails
 *
 * @example
 * const result = await validateProject('/path/to/project');
 * if (result.cli.status === 'success') {
 *   console.log('CLI is properly installed');
 * }
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
 * Retrieves all agents from the Strapi database.
 *
 * Fetches agent configurations from the Strapi API, optionally filtered by directory.
 * Each agent contains system prompts, tool configurations, and model settings.
 *
 * @param directory - Optional project directory path to filter agents
 * @returns Promise resolving to array of agent objects
 * @throws Error if the API request fails
 *
 * @example
 * const agents = await getAgents();
 * agents.forEach(agent => console.log(agent.name));
 *
 * @example
 * // Get agents for specific directory
 * const projectAgents = await getAgents('/path/to/project');
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
 * Retrieves all slash commands from the file system.
 *
 * Fetches command configurations from .claude/commands directory. Commands are
 * markdown files that define custom prompts and workflows for Claude Code.
 *
 * @param directory - Optional project directory path to search for commands
 * @returns Promise resolving to array of slash command objects
 * @throws Error if the API request fails
 *
 * @example
 * const commands = await getCommands('/path/to/project');
 * commands.forEach(cmd => console.log(`/${cmd.name}`));
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
 * Retrieves all skills from the Strapi database.
 *
 * Fetches skill configurations from the Strapi API. Skills are reusable capabilities
 * that agents can invoke. Optionally includes usage information showing which agents
 * use each skill.
 *
 * @param directory - Optional project directory path to filter skills
 * @param includeUsage - Whether to include usage statistics (which agents use this skill)
 * @returns Promise resolving to array of skill objects
 * @throws Error if the API request fails
 *
 * @example
 * const skills = await getSkills();
 * skills.forEach(skill => console.log(skill.name));
 *
 * @example
 * // Get skills with usage information
 * const skillsWithUsage = await getSkills('/path/to/project', true);
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
 * Retrieves usage statistics for all skills.
 *
 * Returns information about which agents use each skill and how many times
 * it's referenced across the project. Useful for understanding skill adoption
 * and identifying unused skills.
 *
 * @param directory - Optional project directory path to analyze
 * @returns Promise resolving to array of usage statistics per skill
 * @throws Error if the API request fails
 *
 * @example
 * const usage = await getSkillsUsage();
 * usage.forEach(skill => {
 *   console.log(`${skill.name}: used ${skill.usageCount} times`);
 *   console.log(`Used by: ${skill.usedInAgents.join(', ')}`);
 * });
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
 * Analyzes entire project structure and resources.
 *
 * Performs a comprehensive analysis of the project by fetching all agents, commands,
 * and skills in parallel. Returns a complete snapshot of available resources.
 *
 * @param directory - Optional project directory path to analyze
 * @returns Promise resolving to project analysis with all resources
 * @throws Error if any API request fails
 *
 * @example
 * const analysis = await analyzeProject('/path/to/project');
 * console.log(`Found ${analysis.agents.length} agents`);
 * console.log(`Found ${analysis.skills.length} skills`);
 * console.log(`Found ${analysis.commands.length} commands`);
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
 * Retrieves detailed information for a specific agent.
 *
 * Fetches complete agent configuration including system prompt, tool configuration,
 * model settings, input fields, and skill associations.
 *
 * @param id - Agent document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to agent details
 * @throws Error if agent not found or request fails
 *
 * @example
 * const agent = await getAgentDetails('agent-123');
 * console.log(agent.systemPrompt);
 * console.log(agent.toolConfig);
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
 * Retrieves detailed information for a specific slash command.
 *
 * Fetches the full command configuration including metadata, content,
 * and allowed tools from the file system.
 *
 * @param id - Command identifier (filename without extension)
 * @param directory - Optional project directory path
 * @returns Promise resolving to command details
 * @throws Error if command not found or request fails
 *
 * @example
 * const command = await getCommandDetails('code-review');
 * console.log(command.content);
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
 * Retrieves detailed information for a specific skill.
 *
 * Fetches complete skill configuration including skill.md content, tool permissions,
 * input fields, model configuration, and additional files.
 *
 * @param id - Skill document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to skill details
 * @throws Error if skill not found or request fails
 *
 * @example
 * const skill = await getSkillDetails('skill-456');
 * console.log(skill.skillmd);
 * console.log(skill.allowedTools);
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
 * Retrieves all available Claude Code tools.
 *
 * Fetches the list of built-in tools that can be assigned to agents and skills.
 * Tools include capabilities like Bash, Read, Write, Edit, Grep, etc.
 *
 * @returns Promise resolving to array of available tools
 * @throws Error if the API request fails
 *
 * @example
 * const tools = await getTools();
 * tools.forEach(tool => console.log(`${tool.name}: ${tool.description}`));
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
  disallowedTools?: string[]; // Tools that are explicitly disallowed for this agent
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
 * Creates a new agent in Strapi and syncs to file system.
 *
 * Creates an agent with the specified configuration, saves it to Strapi database,
 * and generates the corresponding agent.json file in the .claude/agents directory.
 *
 * @param agent - Agent configuration including name, description, systemPrompt, tools, etc.
 * @param directory - Optional project directory path where agent file will be created
 * @returns Promise resolving to creation result with agent ID and file path
 * @throws Error if creation fails or validation errors occur
 *
 * @example
 * const result = await createAgent({
 *   name: 'code-reviewer',
 *   description: 'Reviews code for best practices',
 *   systemPrompt: 'You are a code review expert...',
 *   tools: ['Read', 'Grep'],
 *   model: 'sonnet'
 * });
 * console.log(`Agent created at ${result.filePath}`);
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
 * Updates an existing agent in Strapi and syncs to file system.
 *
 * Updates the agent configuration in Strapi database and regenerates the
 * agent.json file in the .claude/agents directory with the new settings.
 *
 * @param id - Agent document ID (Strapi documentId)
 * @param agent - Updated agent configuration
 * @param directory - Optional project directory path
 * @returns Promise resolving to update result with agent ID and file path
 * @throws Error if update fails or agent not found
 *
 * @example
 * const result = await updateAgent('agent-123', {
 *   name: 'code-reviewer',
 *   description: 'Reviews code with updated guidelines',
 *   systemPrompt: 'New system prompt...',
 *   tools: ['Read', 'Grep', 'Edit']
 * });
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
 * Creates a new skill in Strapi and syncs to file system.
 *
 * Creates a skill with the specified configuration, saves it to Strapi database,
 * and generates the skill.md file in the .claude/skills directory. Skills can
 * include tool permissions, input fields, model configurations, and additional files.
 *
 * @param skill - Skill configuration including name, description, skillmd content, tools, etc.
 * @param directory - Optional project directory path where skill file will be created
 * @returns Promise resolving to creation result with skill object and file path
 * @throws Error if creation fails or validation errors occur
 *
 * @example
 * const result = await createSkill({
 *   name: 'web-scraper',
 *   displayName: 'Web Scraper',
 *   description: 'Scrapes content from websites',
 *   skillmd: '# Web Scraper\n\nInstructions...',
 *   allowedTools: ['WebFetch', 'Grep'],
 *   category: 'web-scraping'
 * });
 * console.log(`Skill created at ${result.path}`);
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
 * Updates an existing skill in Strapi and syncs to file system.
 *
 * Updates the skill configuration in Strapi database and regenerates the
 * skill.md file in the .claude/skills directory with the new settings.
 *
 * @param id - Skill document ID (Strapi documentId)
 * @param skill - Updated skill configuration (partial update supported)
 * @param directory - Optional project directory path
 * @returns Promise resolving to update result with skill object and file path
 * @throws Error if update fails or skill not found
 *
 * @example
 * const result = await updateSkill('skill-456', {
 *   description: 'Updated description',
 *   skillmd: '# Updated content...',
 *   allowedTools: ['WebFetch', 'Grep', 'Read']
 * });
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
 * Executes an agent with streaming Server-Sent Events (SSE) response.
 *
 * Starts agent execution and streams events in real-time including status updates,
 * messages, tool usage, and completion. Uses SSE for low-latency streaming of
 * execution progress.
 *
 * @param agentId - Agent document ID (Strapi documentId)
 * @param userPrompt - User's input prompt/task for the agent
 * @param directory - Optional working directory for agent execution
 * @param permissionMode - Permission handling mode ('default', 'acceptEdits', 'bypass', 'plan')
 * @param onEvent - Callback function invoked for each SSE event
 * @returns Promise that resolves when stream completes
 * @throws Error if execution fails to start or no response body
 *
 * @example
 * await executeAgent(
 *   'agent-123',
 *   'Review the authentication code',
 *   '/path/to/project',
 *   'default',
 *   (event) => {
 *     if (event.type === 'message') {
 *       console.log(event.content);
 *     } else if (event.type === 'complete') {
 *       console.log('Execution complete');
 *     }
 *   }
 * );
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
 * Retrieves all tasks with optional filtering.
 *
 * Fetches task history from the database with support for filtering by status,
 * agent ID, and pagination. Tasks represent agent or skill execution requests.
 *
 * @param params - Optional filtering and pagination parameters
 * @param params.status - Filter by task status ('pending', 'running', 'completed', 'failed')
 * @param params.agentId - Filter by agent or skill document ID
 * @param params.limit - Maximum number of tasks to return
 * @param params.offset - Number of tasks to skip (for pagination)
 * @returns Promise resolving to array of task objects
 * @throws Error if the API request fails
 *
 * @example
 * // Get all completed tasks
 * const completedTasks = await getTasks({ status: 'completed', limit: 10 });
 *
 * @example
 * // Get tasks for specific agent
 * const agentTasks = await getTasks({ agentId: 'agent-123' });
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
 * Retrieves a specific task by ID.
 *
 * Fetches complete task details including status, execution log, results,
 * and error information if applicable.
 *
 * @param taskId - Task ID (UUID)
 * @returns Promise resolving to task object with full details
 * @throws Error if task not found or request fails
 *
 * @example
 * const task = await getTask('task-uuid-123');
 * console.log(`Status: ${task.status}`);
 * if (task.error) console.error(task.error);
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
 * Creates a new task for agent or skill execution.
 *
 * Creates a task record in the database with the specified configuration.
 * The task can be executed later using executeTask(). Supports both agent
 * and skill tasks with optional input values.
 *
 * @param request - Task creation request with name, description, agent/skill ID, etc.
 * @returns Promise resolving to created task object
 * @throws Error if creation fails or validation errors occur
 *
 * @example
 * const task = await createTask({
 *   name: 'Code Review Task',
 *   description: 'Review authentication module',
 *   agentId: 'agent-123',
 *   taskType: 'agent',
 *   userPrompt: 'Review the auth code for security issues',
 *   permissionMode: 'default',
 *   directory: '/path/to/project'
 * });
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
 * Executes a task with streaming Server-Sent Events (SSE) response.
 *
 * Starts task execution and streams events in real-time. Works for both agent
 * and skill tasks. The task must already exist (created via createTask).
 *
 * @param taskId - Task ID (UUID)
 * @param onEvent - Callback function invoked for each SSE event
 * @returns Promise that resolves when stream completes
 * @throws Error if execution fails to start or task not found
 *
 * @example
 * await executeTask('task-uuid-123', (event) => {
 *   if (event.type === 'status') {
 *     console.log(`Status: ${event.status}`);
 *   } else if (event.type === 'message') {
 *     console.log(event.content);
 *   } else if (event.type === 'complete') {
 *     console.log('Task complete');
 *   }
 * });
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
 * Deletes a task from the database.
 *
 * Permanently removes the task and all associated execution logs.
 * This action cannot be undone.
 *
 * @param taskId - Task ID (UUID) to delete
 * @returns Promise that resolves when deletion completes
 * @throws Error if deletion fails or task not found
 *
 * @example
 * await deleteTask('task-uuid-123');
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
 * Retrieves all MCP (Model Context Protocol) servers from Strapi.
 *
 * Fetches configured MCP servers that provide additional tools and capabilities
 * to agents and skills. Supports stdio, SSE, HTTP, and SDK-based servers.
 *
 * @param directory - Optional project directory path to filter servers
 * @returns Promise resolving to array of MCP server configurations
 * @throws Error if the API request fails
 *
 * @example
 * const servers = await getMCPServers();
 * servers.forEach(server => {
 *   console.log(`${server.name}: ${server.config.type}`);
 * });
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
 * Retrieves detailed information for a specific MCP server.
 *
 * Fetches complete server configuration including connection details,
 * environment variables, and associated tools.
 *
 * @param id - MCP server document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to MCP server details
 * @throws Error if server not found or request fails
 *
 * @example
 * const server = await getMCPServerDetails('server-123');
 * console.log(server.config);
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
 * Creates a new MCP server in Strapi and project configuration.
 *
 * Creates an MCP server with the specified configuration, saves it to Strapi,
 * and updates the claude_desktop_config.json file in the project.
 *
 * @param name - Unique name for the MCP server
 * @param config - Server configuration (type, command, args, env, etc.)
 * @param directory - Optional project directory path
 * @returns Promise resolving to creation result with server object
 * @throws Error if creation fails or validation errors occur
 *
 * @example
 * const result = await createMCPServer('filesystem', {
 *   type: 'stdio',
 *   command: 'node',
 *   args: ['/path/to/mcp-server.js'],
 *   env: { NODE_ENV: 'production' }
 * });
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
 * Updates an existing MCP server in Strapi and project configuration.
 *
 * Updates the server configuration in Strapi and regenerates the
 * claude_desktop_config.json file with the new settings.
 *
 * @param id - MCP server document ID (Strapi documentId)
 * @param config - Updated server configuration
 * @param directory - Optional project directory path
 * @returns Promise resolving to update result with server object
 * @throws Error if update fails or server not found
 *
 * @example
 * const result = await updateMCPServer('server-123', {
 *   type: 'stdio',
 *   command: 'node',
 *   args: ['/updated/path.js']
 * });
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
 * Deletes an MCP server from Strapi and project configuration.
 *
 * Removes the server from Strapi database and updates the
 * claude_desktop_config.json file to remove the server entry.
 *
 * @param id - MCP server document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise that resolves when deletion completes
 * @throws Error if deletion fails or server not found
 *
 * @example
 * await deleteMCPServer('server-123');
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
 * Tests an MCP server connection.
 *
 * Attempts to connect to the MCP server and verify it's working correctly.
 * Returns success status and any error messages if connection fails.
 *
 * @param id - MCP server document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to test result with success status and message
 * @throws Error if test request fails
 *
 * @example
 * const result = await testMCPServer('server-123');
 * if (result.success) {
 *   console.log('Server is working');
 * } else {
 *   console.error(result.error);
 * }
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
 * Toggles an MCP server's enabled/disabled state.
 *
 * Switches the server between enabled and disabled states. Disabled servers
 * are not available for use by agents and skills.
 *
 * @param id - MCP server document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to new disabled state and message
 * @throws Error if toggle fails or server not found
 *
 * @example
 * const result = await toggleMCPServer('server-123');
 * console.log(`Server is now ${result.disabled ? 'disabled' : 'enabled'}`);
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
 * Lists all tools provided by an MCP server.
 *
 * Retrieves the list of tools/capabilities exposed by the MCP server.
 * Each tool includes name, description, and input schema.
 *
 * @param id - MCP server document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to tool list with success status
 * @throws Error if request fails
 *
 * @example
 * const result = await listMCPServerTools('server-123');
 * if (result.success) {
 *   result.tools.forEach(tool => console.log(tool.name));
 * }
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
 * Refreshes and syncs MCP server tools to Strapi.
 *
 * Fetches the latest tools from the MCP server and saves them as separate
 * entities in Strapi. This allows tools to be tracked and referenced by agents.
 *
 * @param id - MCP server document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to refresh result with tool count and list
 * @throws Error if refresh fails
 *
 * @example
 * const result = await refreshMCPServerTools('server-123');
 * console.log(`Refreshed ${result.toolsCount} tools`);
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
 * Exports MCP server configuration.
 *
 * Generates a JSON configuration containing all MCP servers in the format
 * compatible with claude_desktop_config.json.
 *
 * @param directory - Optional project directory path
 * @returns Promise resolving to MCP configuration object
 * @throws Error if export fails
 *
 * @example
 * const config = await exportMCPConfig();
 * console.log(JSON.stringify(config, null, 2));
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
 * Imports MCP server configuration.
 *
 * Imports MCP servers from a configuration object in claude_desktop_config.json format.
 * Supports merge mode (adds to existing servers) or overwrite mode (replaces all servers).
 *
 * @param config - MCP configuration object to import
 * @param mode - Import mode: 'merge' adds to existing, 'overwrite' replaces all
 * @param directory - Optional project directory path
 * @returns Promise resolving to import result with success status
 * @throws Error if import fails or validation errors occur
 *
 * @example
 * const result = await importMCPConfig(configObj, 'merge');
 * console.log(result.message);
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
 * Deletes multiple MCP servers in a single operation.
 *
 * Removes multiple servers from Strapi and updates the project configuration.
 * Returns detailed results including success count and any errors.
 *
 * @param serverIds - Array of MCP server document IDs to delete
 * @param directory - Optional project directory path
 * @returns Promise resolving to bulk delete result with counts and errors
 * @throws Error if the bulk delete request fails
 *
 * @example
 * const result = await bulkDeleteMCPServers(['server-1', 'server-2']);
 * console.log(`Deleted ${result.successCount} servers`);
 * if (result.failed > 0) {
 *   console.error(`Failed to delete ${result.failed} servers`);
 *   result.errors.forEach(err => console.error(err));
 * }
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
 * Retrieves training history for a skill.
 *
 * Fetches historical training records showing how the skill has been improved
 * over time, including scores before/after training and issues found.
 *
 * @param skillId - Skill document ID (Strapi documentId)
 * @param directory - Optional project directory path
 * @returns Promise resolving to array of training records
 * @throws Error if request fails or skill not found
 *
 * @example
 * const history = await getSkillTrainingHistory('skill-456');
 * history.forEach(record => {
 *   console.log(`${record.date}: ${record.scoreBefore} -> ${record.scoreAfter}`);
 * });
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
 * Uploads a file to Strapi Media Library.
 *
 * Uploads a file for use as a skill attachment or other media. Returns the
 * file metadata including URL for later reference.
 *
 * @param file - File object to upload
 * @returns Promise resolving to uploaded file metadata
 * @throws Error if upload fails
 *
 * @example
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 * const uploadedFile = await uploadFile(file);
 * console.log(`File uploaded: ${uploadedFile.url}`);
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
 * Deletes a file from Strapi Media Library.
 *
 * Permanently removes a file from the media library. This action cannot be undone.
 *
 * @param fileId - File document ID (Strapi documentId)
 * @returns Promise that resolves when deletion completes
 * @throws Error if deletion fails or file not found
 *
 * @example
 * await deleteFile('file-doc-id-123');
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
