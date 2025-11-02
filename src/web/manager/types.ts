export type AgentInputType = 'text' | 'textarea' | 'select' | 'file' | 'number';

export interface AgentInput {
  name: string;
  description: string;
  type: AgentInputType;
  required: boolean;
  defaultValue?: any;
  options?: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  inputs: AgentInput[];
}

export enum ManagerView {
  Dashboard = 'dashboard',
  Agents = 'agents',
  Commands = 'commands',
  Skills = 'skills',
  MCPServers = 'mcp-servers',
  Tasks = 'tasks',
  Settings = 'settings',
}

/**
 * MCP Server configuration for stdio transport
 */
export interface MCPStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

/**
 * MCP Server configuration for SDK transport
 */
export interface MCPSdkServerConfig {
  type: 'sdk';
  name: string;
  instance?: any;
  disabled?: boolean;
}

/**
 * MCP Server configuration for SSE transport
 */
export interface MCPSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/**
 * MCP Server configuration for HTTP transport
 */
export interface MCPHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/**
 * Union type for all MCP server configurations
 */
export type MCPServerConfig =
  | MCPStdioServerConfig
  | MCPSdkServerConfig
  | MCPSSEServerConfig
  | MCPHttpServerConfig;

/**
 * MCP Tool definition (Strapi entity)
 */
export interface MCPTool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  mcpServer?: string; // Server ID
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * MCP Server representation with metadata
 */
export interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'sdk' | 'sse' | 'http';
  config: MCPServerConfig;
  disabled?: boolean;
  mcpTools?: MCPTool[];
  toolsFetchedAt?: Date | string;
  command?: string;
  description?: string;
}

/**
 * Validation step for project setup
 */
export interface ValidationStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}
