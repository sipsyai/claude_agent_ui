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
 * Upload a file to Strapi Media Library
 */
export async function uploadFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${STRAPI_BASE}/upload`, createFetchOptions({
    method: 'POST',
    body: formData,
  }));

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
  const response = await fetch(`${STRAPI_BASE}/upload/${fileId}`, createFetchOptions({
    method: 'DELETE',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete file');
  }
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