/**
 * MCP (Model Context Protocol) type definitions aligned with Claude Agent SDK
 * @see https://docs.anthropic.com/en/api/agent-sdk/mcp
 */

/**
 * MCP Server configuration for stdio transport (default)
 * External processes communicating via stdin/stdout
 */
export interface MCPStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean; // CUI extension for enable/disable functionality
}

/**
 * MCP Server configuration for SDK transport
 * In-process servers running within the application
 */
export interface MCPSdkServerConfig {
  type: 'sdk';
  name: string;
  instance: any; // McpServer from @anthropic-ai/claude-agent-sdk
  disabled?: boolean;
}

/**
 * MCP Server configuration for SSE (Server-Sent Events) transport
 * Remote servers with SSE communication
 */
export interface MCPSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/**
 * MCP Server configuration for HTTP transport
 * Remote servers with HTTP polling
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
 * MCP configuration file structure
 * Located at .mcp.json in project root
 */
export interface MCPConfig {
  mcpServers: {
    [serverName: string]: MCPServerConfig;
  };
}

/**
 * Type guard: Check if server config is stdio transport
 */
export function isStdioServer(
  config: MCPServerConfig
): config is MCPStdioServerConfig {
  return !config.type || config.type === 'stdio';
}

/**
 * Type guard: Check if server config is SDK transport
 */
export function isSdkServer(
  config: MCPServerConfig
): config is MCPSdkServerConfig {
  return config.type === 'sdk';
}

/**
 * Type guard: Check if server config is SSE transport
 */
export function isSSEServer(
  config: MCPServerConfig
): config is MCPSSEServerConfig {
  return config.type === 'sse';
}

/**
 * Type guard: Check if server config is HTTP transport
 */
export function isHttpServer(
  config: MCPServerConfig
): config is MCPHttpServerConfig {
  return config.type === 'http';
}
