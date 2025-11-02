import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createLogger, type Logger } from './logger.js';
import {
  type MCPConfig,
  type MCPServerConfig,
  type MCPStdioServerConfig,
  isStdioServer,
  isSdkServer,
} from '../types/mcp-types.js';
import { type MCPServer, type MCPTool } from '../types/agent.types.js';
import {
  substituteEnvVarsInObject,
  hasEnvVarPattern,
} from '../utils/env-substitution.js';

/**
 * Internal MCP Server type for .mcp.json handling
 * Includes config property for backward compatibility
 */
interface MCPServerInternal {
  id: string;
  name: string;
  type: 'stdio' | 'sdk' | 'sse' | 'http';
  config: MCPServerConfig;
  disabled?: boolean;
}

/**
 * Service for managing MCP server configurations (SDK-aligned)
 * @see https://docs.anthropic.com/en/api/agent-sdk/mcp
 */
export class MCPService {
  private logger: Logger;
  private sdkServers: Map<string, any> = new Map();

  constructor() {
    this.logger = createLogger('MCPService');
  }

  /**
   * Get project MCP config path (.mcp.json at project root)
   * SDK-aligned location
   */
  private getMCPConfigPath(projectPath: string): string {
    return path.join(projectPath, '.mcp.json');
  }

  /**
   * Check for legacy config locations and auto-migrate if found
   */
  private async checkAndMigrateLegacyConfigs(projectPath: string): Promise<void> {
    const legacyPath = path.join(projectPath, '.claude', 'mcp.json');

    if (!existsSync(legacyPath)) {
      return; // No legacy config, nothing to do
    }

    try {
      // Read legacy config
      const legacyConfig = await this.readMCPConfig(legacyPath);
      if (!legacyConfig || !legacyConfig.mcpServers || Object.keys(legacyConfig.mcpServers).length === 0) {
        // Empty legacy config, just delete it
        await fs.unlink(legacyPath);
        this.logger.info('Removed empty legacy MCP config', { legacyPath });
        return;
      }

      // Get current config path
      const newConfigPath = this.getMCPConfigPath(projectPath);

      // Read existing new config
      let newConfig = await this.readMCPConfig(newConfigPath);

      if (!newConfig) {
        // No new config exists, just move the legacy one
        await this.writeMCPConfig(newConfigPath, legacyConfig);
        await fs.unlink(legacyPath);
        this.logger.info(
          '✓ Migrated legacy MCP config to .mcp.json',
          {
            from: legacyPath,
            to: newConfigPath,
            serverCount: Object.keys(legacyConfig.mcpServers).length
          }
        );
      } else {
        // Both configs exist, merge them (new config takes precedence)
        const mergedServers = {
          ...legacyConfig.mcpServers,
          ...newConfig.mcpServers, // New config overwrites legacy
        };

        const mergedConfig: MCPConfig = {
          mcpServers: mergedServers,
        };

        await this.writeMCPConfig(newConfigPath, mergedConfig);
        await fs.unlink(legacyPath);
        this.logger.info(
          '✓ Merged and migrated legacy MCP config to .mcp.json',
          {
            from: legacyPath,
            to: newConfigPath,
            totalServers: Object.keys(mergedServers).length
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to migrate legacy MCP config. Please manually move .claude/mcp.json to .mcp.json',
        { legacyPath, error }
      );
    }
  }

  /**
   * Read MCP config from file with env var substitution
   */
  private async readMCPConfig(configPath: string): Promise<MCPConfig | null> {
    try {
      if (!existsSync(configPath)) {
        return null;
      }

      const content = await fs.readFile(configPath, 'utf-8');
      let config = JSON.parse(content) as MCPConfig;

      // Apply environment variable substitution
      config = substituteEnvVarsInObject(config);

      return config;
    } catch (error) {
      this.logger.error('Failed to read MCP config', { path: configPath, error });
      return null;
    }
  }

  /**
   * Write MCP config to file
   */
  private async writeMCPConfig(configPath: string, config: MCPConfig): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(configPath);
      await fs.mkdir(dir, { recursive: true });

      // Write config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      this.logger.info('MCP config written', { path: configPath });
    } catch (error) {
      this.logger.error('Failed to write MCP config', { path: configPath, error });
      throw error;
    }
  }

  /**
   * Convert MCP config entries to MCPServer objects
   */
  private configToServers(config: MCPConfig | null): MCPServerInternal[] {
    if (!config || !config.mcpServers) {
      return [];
    }

    return Object.entries(config.mcpServers).map(([name, serverConfig]) => {
      // Determine transport type
      const type = serverConfig.type || 'stdio';

      return {
        id: name,
        name,
        type,
        config: serverConfig,
        disabled: serverConfig.disabled,
      };
    });
  }

  /**
   * Register an SDK MCP server (in-process)
   */
  registerSdkServer(name: string, instance: any): void {
    this.sdkServers.set(name, instance);
    this.logger.info('SDK MCP server registered', { name });
  }

  /**
   * Unregister an SDK MCP server
   */
  unregisterSdkServer(name: string): void {
    this.sdkServers.delete(name);
    this.logger.info('SDK MCP server unregistered', { name });
  }

  /**
   * Get all MCP servers from project config
   */
  async getMCPServers(projectPath?: string): Promise<MCPServerInternal[]> {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    // Auto-migrate legacy configs if found
    await this.checkAndMigrateLegacyConfigs(projectPath);

    const configPath = this.getMCPConfigPath(projectPath);
    const config = await this.readMCPConfig(configPath);
    const servers = this.configToServers(config);

    this.logger.debug('Retrieved MCP servers', {
      total: servers.length,
      configPath,
    });

    return servers;
  }

  /**
   * Get a specific MCP server by ID
   */
  async getMCPServerById(id: string, projectPath?: string): Promise<MCPServerInternal | null> {
    const servers = await this.getMCPServers(projectPath);
    const server = servers.find(s => s.id === id);

    if (!server) {
      this.logger.warn('MCP server not found', { id });
      return null;
    }

    return server;
  }

  /**
   * Add a new MCP server
   */
  async addMCPServer(
    name: string,
    serverConfig: MCPServerConfig,
    projectPath?: string
  ): Promise<MCPServerInternal> {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    const configPath = this.getMCPConfigPath(projectPath);

    // Read existing config
    let config = await this.readMCPConfig(configPath);
    if (!config) {
      config = { mcpServers: {} };
    }

    // Check if server already exists
    if (config.mcpServers[name]) {
      throw new Error(`MCP server "${name}" already exists`);
    }

    // Add new server
    config.mcpServers[name] = serverConfig;

    // Write config
    await this.writeMCPConfig(configPath, config);

    this.logger.info('MCP server added', { name });

    const type = serverConfig.type || 'stdio';
    return {
      id: name,
      name,
      type,
      config: serverConfig,
      disabled: serverConfig.disabled,
    };
  }

  /**
   * Update an existing MCP server
   */
  async updateMCPServer(
    id: string,
    serverConfig: MCPServerConfig,
    projectPath?: string
  ): Promise<MCPServerInternal> {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    const configPath = this.getMCPConfigPath(projectPath);

    // Read existing config
    const config = await this.readMCPConfig(configPath);
    if (!config || !config.mcpServers[id]) {
      throw new Error(`MCP server "${id}" not found`);
    }

    // Update server
    config.mcpServers[id] = serverConfig;

    // Write config
    await this.writeMCPConfig(configPath, config);

    this.logger.info('MCP server updated', { id });

    const type = serverConfig.type || 'stdio';
    return {
      id,
      name: id,
      type,
      config: serverConfig,
      disabled: serverConfig.disabled,
    };
  }

  /**
   * Delete an MCP server
   */
  async deleteMCPServer(id: string, projectPath?: string): Promise<void> {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    const configPath = this.getMCPConfigPath(projectPath);

    // Read existing config
    const config = await this.readMCPConfig(configPath);
    if (!config || !config.mcpServers[id]) {
      throw new Error(`MCP server "${id}" not found`);
    }

    // Delete server
    delete config.mcpServers[id];

    // Write config
    await this.writeMCPConfig(configPath, config);

    this.logger.info('MCP server deleted', { id });
  }

  /**
   * Test an MCP server
   */
  async testMCPServer(id: string, projectPath?: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const server = await this.getMCPServerById(id, projectPath);
      if (!server) {
        return {
          success: false,
          message: 'Server not found',
          error: 'MCP server not found',
        };
      }

      // Test based on transport type
      if (isStdioServer(server.config)) {
        return await this.testStdioServer(server.config);
      } else if (isSdkServer(server.config)) {
        return await this.testSdkServer(server.config);
      } else {
        return {
          success: false,
          message: 'Unsupported transport type',
          error: `Transport type "${server.config.type}" not yet implemented`,
        };
      }
    } catch (error) {
      this.logger.error('Failed to test MCP server', { id, error });
      return {
        success: false,
        message: 'Test failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test stdio MCP server
   */
  private async testStdioServer(config: MCPServerConfig): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    if (!isStdioServer(config)) {
      return {
        success: false,
        message: 'Invalid server config',
        error: 'Not a stdio server',
      };
    }

    return new Promise((resolve) => {
      const timeout = 10000; // 10 seconds
      let resolved = false;

      const child = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve({
            success: false,
            message: 'Test timeout',
            error: 'MCP server did not respond within 10 seconds',
          });
        }
      }, timeout);

      child.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          child.kill();
          resolve({
            success: false,
            message: 'Failed to start',
            error: error.message,
          });
        }
      });

      child.on('spawn', () => {
        // Successfully spawned, kill it after a brief moment
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            child.kill();
            resolve({
              success: true,
              message: 'MCP server started successfully',
            });
          }
        }, 1000);
      });

      child.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          if (code === 0 || code === null) {
            resolve({
              success: true,
              message: 'MCP server started and exited cleanly',
            });
          } else {
            resolve({
              success: false,
              message: 'MCP server exited with error',
              error: `Exit code: ${code}`,
            });
          }
        }
      });
    });
  }

  /**
   * Test SDK MCP server
   */
  private async testSdkServer(config: MCPServerConfig): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    if (!isSdkServer(config)) {
      return {
        success: false,
        message: 'Invalid server config',
        error: 'Not an SDK server',
      };
    }

    const instance = this.sdkServers.get(config.name);
    if (!instance) {
      return {
        success: false,
        message: 'SDK server not registered',
        error: `SDK server "${config.name}" instance not found. Use registerSdkServer() first.`,
      };
    }

    // Check if instance has required methods
    if (typeof instance.listTools !== 'function') {
      return {
        success: false,
        message: 'Invalid SDK server',
        error: 'SDK server instance must implement listTools() method',
      };
    }

    return {
      success: true,
      message: 'SDK server is registered and valid',
    };
  }

  /**
   * Export MCP configuration
   */
  async exportMCPConfig(projectPath?: string): Promise<MCPConfig | null> {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    const configPath = this.getMCPConfigPath(projectPath);
    return await this.readMCPConfig(configPath);
  }

  /**
   * Import MCP configuration
   */
  async importMCPConfig(
    config: MCPConfig,
    mode: 'merge' | 'overwrite',
    projectPath?: string
  ): Promise<void> {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    const configPath = this.getMCPConfigPath(projectPath);

    if (mode === 'overwrite') {
      // Direct overwrite
      await this.writeMCPConfig(configPath, config);
      this.logger.info('MCP config imported (overwrite)');
    } else {
      // Merge with existing
      const existingConfig = await this.readMCPConfig(configPath);
      const mergedConfig: MCPConfig = {
        mcpServers: {
          ...(existingConfig?.mcpServers || {}),
          ...config.mcpServers,
        },
      };

      await this.writeMCPConfig(configPath, mergedConfig);
      this.logger.info('MCP config imported (merge)');
    }
  }

  /**
   * Bulk delete MCP servers
   */
  async bulkDeleteMCPServers(
    serverIds: string[],
    projectPath?: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of serverIds) {
      try {
        await this.deleteMCPServer(id, projectPath);
        success++;
      } catch (error) {
        failed++;
        errors.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.info('Bulk delete completed', { success, failed });

    return { success, failed, errors };
  }

  /**
   * Toggle MCP server enabled/disabled state
   */
  async toggleMCPServer(id: string, projectPath?: string): Promise<{
    success: boolean;
    disabled: boolean;
    message: string;
  }> {
    try {
      if (!projectPath) {
        projectPath = process.cwd();
      }

      const configPath = this.getMCPConfigPath(projectPath);
      const config = await this.readMCPConfig(configPath);

      if (!config || !config.mcpServers || !config.mcpServers[id]) {
        return {
          success: false,
          disabled: false,
          message: 'MCP server not found',
        };
      }

      // Toggle disabled state
      const currentState = config.mcpServers[id].disabled || false;
      config.mcpServers[id].disabled = !currentState;

      await this.writeMCPConfig(configPath, config);

      const newState = config.mcpServers[id].disabled || false;
      this.logger.info('MCP server toggled', { id, disabled: newState });

      return {
        success: true,
        disabled: newState,
        message: `MCP server ${newState ? 'disabled' : 'enabled'} successfully`,
      };
    } catch (error) {
      this.logger.error('Failed to toggle MCP server', { id, error });
      return {
        success: false,
        disabled: false,
        message: error instanceof Error ? error.message : 'Failed to toggle server',
      };
    }
  }

  /**
   * List tools provided by an MCP server
   */
  async listMCPServerTools(id: string, projectPath?: string): Promise<{
    success: boolean;
    tools: MCPTool[];
    error?: string;
  }> {
    try {
      const server = await this.getMCPServerById(id, projectPath);
      if (!server) {
        return {
          success: false,
          tools: [],
          error: 'MCP server not found',
        };
      }

      // Fetch tools based on transport type
      let tools: MCPTool[] = [];

      if (isStdioServer(server.config)) {
        tools = await this.fetchToolsFromStdioServer(server.config);
      } else if (isSdkServer(server.config)) {
        tools = await this.fetchToolsFromSdkServer(server.config);
      } else {
        return {
          success: false,
          tools: [],
          error: `Transport type "${server.config.type}" not yet implemented`,
        };
      }

      this.logger.info('Listed MCP server tools', { id, toolCount: tools.length });

      return {
        success: true,
        tools,
      };
    } catch (error) {
      this.logger.error('Failed to list MCP server tools', { id, error });
      return {
        success: false,
        tools: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch tools from stdio MCP server via JSON-RPC
   */
  private async fetchToolsFromStdioServer(config: MCPServerConfig): Promise<MCPTool[]> {
    if (!isStdioServer(config)) {
      throw new Error('Not a stdio server');
    }

    return new Promise((resolve, reject) => {
      const timeout = 15000; // 15 seconds
      let resolved = false;
      const tools: MCPTool[] = [];
      let initialized = false;

      const child = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          reject(new Error('Timeout fetching tools from MCP server'));
        }
      }, timeout);

      let stdout = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();

        // Try to parse each line as it comes
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const response = JSON.parse(line);

            // Check if this is initialize response
            if (!initialized && response.result && response.id === 1) {
              initialized = true;
              // Send tools/list request after initialization
              const toolsRequest = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
              };
              child.stdin?.write(JSON.stringify(toolsRequest) + '\n');
            }

            // Check if this is tools/list response
            if (response.result && response.id === 2 && Array.isArray(response.result.tools)) {
              tools.push(...response.result.tools.map((tool: any) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              })));

              // Success! Clean up and resolve
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                child.kill();
                resolve(tools);
              }
            }
          } catch (e) {
            // Skip non-JSON lines or parsing errors
          }
        }
      });

      child.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      child.on('spawn', () => {
        // Send initialize request first (MCP protocol requirement)
        const initRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'cui-manager',
              version: '1.0.0',
            },
          },
        };
        child.stdin?.write(JSON.stringify(initRequest) + '\n');
      });

      child.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);

          // If we got tools, resolve with them
          if (tools.length > 0) {
            resolve(tools);
          } else {
            resolve([]); // Return empty array instead of rejecting
          }
        }
      });
    });
  }

  /**
   * Fetch tools from SDK MCP server
   */
  private async fetchToolsFromSdkServer(config: MCPServerConfig): Promise<MCPTool[]> {
    if (!isSdkServer(config)) {
      throw new Error('Not an SDK server');
    }

    const instance = this.sdkServers.get(config.name);
    if (!instance) {
      throw new Error(`SDK server "${config.name}" not registered`);
    }

    if (typeof instance.listTools !== 'function') {
      throw new Error('SDK server does not implement listTools() method');
    }

    try {
      const tools = await instance.listTools();
      return tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    } catch (error) {
      this.logger.error('Failed to list tools from SDK server', { name: config.name, error });
      throw error;
    }
  }

  /**
   * Sync MCP servers to .mcp.json file
   * Converts Strapi format to SDK format
   */
  async syncToMcpJson(
    servers: Array<{
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
      disabled?: boolean;
      transport?: string;
    }>,
    projectPath?: string
  ): Promise<void> {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    const configPath = this.getMCPConfigPath(projectPath);

    // Build MCP config object
    const mcpServers: Record<string, MCPServerConfig> = {};

    for (const server of servers) {
      // Skip disabled servers (they won't be in .mcp.json)
      if (server.disabled) {
        continue;
      }

      // Convert to MCP config format
      const serverConfig: MCPStdioServerConfig = {
        command: server.command,
        args: server.args || [],
        env: server.env || {},
      };

      // Add type if not stdio
      if (server.transport && server.transport !== 'stdio') {
        (serverConfig as any).type = server.transport;
      }

      mcpServers[server.name] = serverConfig;
    }

    const config: MCPConfig = { mcpServers };

    // Write to .mcp.json
    await this.writeMCPConfig(configPath, config);

    this.logger.info('Synced MCP servers to .mcp.json', {
      serverCount: Object.keys(mcpServers).length,
      configPath,
    });
  }

  /**
   * Sync MCP servers from .mcp.json file
   * Returns servers in format suitable for Strapi
   */
  async syncFromMcpJson(projectPath?: string): Promise<
    Array<{
      name: string;
      command: string;
      args: string[];
      env: Record<string, string>;
      disabled: boolean;
      transport: string;
    }>
  > {
    if (!projectPath) {
      projectPath = process.cwd();
    }

    const configPath = this.getMCPConfigPath(projectPath);
    const config = await this.readMCPConfig(configPath);

    if (!config || !config.mcpServers) {
      return [];
    }

    const servers = [];

    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      // Only handle stdio servers for now
      if (isStdioServer(serverConfig)) {
        servers.push({
          name,
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          disabled: serverConfig.disabled || false,
          transport: serverConfig.type || 'stdio',
        });
      }
    }

    this.logger.info('Synced MCP servers from .mcp.json', {
      serverCount: servers.length,
      configPath,
    });

    return servers;
  }
}
