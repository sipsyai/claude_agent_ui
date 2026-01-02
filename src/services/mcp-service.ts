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
 * Internal MCP Server type for .mcp.json configuration handling
 *
 * @description
 * Represents an MCP server configuration as stored in and retrieved from the
 * .mcp.json file. This interface extends the basic MCPServerConfig with additional
 * metadata needed for runtime server management.
 *
 * The interface maintains backward compatibility with legacy .claude/mcp.json files
 * while supporting the SDK-aligned .mcp.json format at the project root.
 *
 * @property {string} id - Unique identifier for the MCP server (typically the server name)
 * @property {string} name - Human-readable name of the MCP server
 * @property {'stdio' | 'sdk' | 'sse' | 'http'} type - Transport type for MCP communication
 *   - 'stdio': Standard I/O transport (spawns external process)
 *   - 'sdk': In-process SDK server (registered JavaScript/TypeScript instance)
 *   - 'sse': Server-Sent Events transport (not yet implemented)
 *   - 'http': HTTP transport (not yet implemented)
 * @property {MCPServerConfig} config - Complete server configuration including command, args, env
 * @property {boolean} [disabled] - Whether the server is disabled (excluded from active use)
 *
 * @example
 * ```typescript
 * const server: MCPServerInternal = {
 *   id: 'filesystem',
 *   name: 'filesystem',
 *   type: 'stdio',
 *   config: {
 *     command: 'npx',
 *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
 *     env: { DEBUG: 'true' }
 *   },
 *   disabled: false
 * };
 * ```
 *
 * @see {@link https://docs.anthropic.com/en/api/agent-sdk/mcp | Anthropic MCP Documentation}
 */
interface MCPServerInternal {
  id: string;
  name: string;
  type: 'stdio' | 'sdk' | 'sse' | 'http';
  config: MCPServerConfig;
  disabled?: boolean;
}

/**
 * MCPService - Service for managing Model Context Protocol (MCP) server configurations
 *
 * @description
 * Manages MCP server configurations in SDK-aligned format, providing CRUD operations,
 * configuration file management, server testing, and bidirectional synchronization.
 * This service bridges the gap between the application's MCP server management needs
 * and Anthropic's Claude Agent SDK MCP integration requirements.
 *
 * Key responsibilities:
 * - Read/write .mcp.json configuration files at project root (SDK-aligned location)
 * - Auto-migrate legacy .claude/mcp.json configs to new .mcp.json format
 * - Manage MCP server lifecycle (add, update, delete, toggle enabled/disabled)
 * - Test MCP server connectivity and tool availability
 * - Support both stdio (external process) and SDK (in-process) transport types
 * - Register and manage in-process SDK MCP server instances
 * - Fetch available tools from MCP servers via JSON-RPC protocol
 * - Handle environment variable substitution in server configurations
 * - Provide bidirectional sync with Strapi database (syncToMcpJson/syncFromMcpJson)
 * - Support bulk operations (bulk delete, import/export configs)
 *
 * Configuration Format:
 * The service manages .mcp.json files in the format expected by Claude Agent SDK:
 * ```json
 * {
 *   "mcpServers": {
 *     "server-name": {
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
 *       "env": { "DEBUG": "true" },
 *       "disabled": false
 *     }
 *   }
 * }
 * ```
 *
 * Transport Types:
 * - stdio: Spawns external MCP server process, communicates via JSON-RPC over stdin/stdout
 * - sdk: Manages in-process JavaScript/TypeScript MCP server instances
 * - sse/http: Reserved for future implementation
 *
 * Architecture:
 * - Uses internal Map to track registered SDK server instances
 * - Automatically migrates legacy configs from .claude/mcp.json to .mcp.json
 * - Applies environment variable substitution (${ENV_VAR} syntax) on config read
 * - Integrates with Claude Agent SDK's MCP server configuration format
 * - Provides both file-based and programmatic server management
 *
 * @example
 * ```typescript
 * // Initialize the service
 * const mcpService = new MCPService();
 *
 * // Add a new stdio MCP server
 * const filesystemServer = await mcpService.addMCPServer(
 *   'filesystem',
 *   {
 *     command: 'npx',
 *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
 *     env: { DEBUG: 'true' }
 *   },
 *   '/path/to/project'
 * );
 *
 * // Test server connectivity
 * const testResult = await mcpService.testMCPServer('filesystem', '/path/to/project');
 * console.log(testResult.success ? 'Server OK' : testResult.error);
 *
 * // List available tools
 * const toolsResult = await mcpService.listMCPServerTools('filesystem', '/path/to/project');
 * console.log('Available tools:', toolsResult.tools);
 *
 * // Register an in-process SDK server
 * import { MyMCPServer } from './my-mcp-server.js';
 * const sdkServer = new MyMCPServer();
 * mcpService.registerSdkServer('my-sdk-server', sdkServer);
 *
 * // Add SDK server to config
 * await mcpService.addMCPServer(
 *   'my-sdk-server',
 *   { type: 'sdk', name: 'my-sdk-server' },
 *   '/path/to/project'
 * );
 *
 * // Toggle server enabled/disabled
 * const toggleResult = await mcpService.toggleMCPServer('filesystem', '/path/to/project');
 * console.log(`Server now ${toggleResult.disabled ? 'disabled' : 'enabled'}`);
 *
 * // Get all configured servers
 * const servers = await mcpService.getMCPServers('/path/to/project');
 * console.log(`Found ${servers.length} MCP servers`);
 *
 * // Sync servers to .mcp.json (from Strapi format)
 * await mcpService.syncToMcpJson([
 *   {
 *     name: 'github',
 *     command: 'npx',
 *     args: ['-y', '@modelcontextprotocol/server-github'],
 *     env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' }
 *   }
 * ], '/path/to/project');
 *
 * // Export configuration for backup
 * const config = await mcpService.exportMCPConfig('/path/to/project');
 * await fs.writeFile('backup.json', JSON.stringify(config, null, 2));
 * ```
 *
 * @see {@link https://docs.anthropic.com/en/api/agent-sdk/mcp | Anthropic MCP Documentation}
 * @see {@link https://modelcontextprotocol.io | Model Context Protocol Specification}
 */
export class MCPService {
  /** Logger instance for debugging and operational logging */
  private logger: Logger;

  /** Registry of in-process SDK MCP server instances, keyed by server name */
  private sdkServers: Map<string, any> = new Map();

  constructor() {
    this.logger = createLogger('MCPService');
  }

  /**
   * Get project MCP config path (.mcp.json at project root)
   *
   * @description
   * Returns the absolute path to the .mcp.json configuration file at the project root.
   * This location is SDK-aligned with Anthropic's Claude Agent SDK expectations, which
   * looks for MCP server configurations at the project root rather than in .claude/ subdirectory.
   *
   * The .mcp.json file is the canonical location for MCP server configurations that are
   * automatically loaded by the Claude Agent SDK. This service reads/writes this file to
   * manage server configurations programmatically.
   *
   * @param projectPath - Absolute path to the project directory
   *
   * @returns Absolute path to the .mcp.json file (e.g., '/path/to/project/.mcp.json')
   *
   * @example
   * ```typescript
   * const configPath = this.getMCPConfigPath('/Users/dev/my-project');
   * // Returns: '/Users/dev/my-project/.mcp.json'
   * ```
   *
   * @private
   */
  private getMCPConfigPath(projectPath: string): string {
    return path.join(projectPath, '.mcp.json');
  }

  /**
   * Check for legacy config locations and auto-migrate if found
   *
   * @description
   * Automatically detects and migrates legacy MCP configurations from the old
   * .claude/mcp.json location to the new SDK-aligned .mcp.json location at project root.
   *
   * This method implements a smart migration strategy:
   * 1. If no legacy config exists: No action taken
   * 2. If legacy config is empty: Delete legacy file
   * 3. If only legacy config exists: Move to new location
   * 4. If both exist: Merge configs (new config takes precedence), then delete legacy
   *
   * The migration is automatic and transparent to users. After migration, the legacy
   * .claude/mcp.json file is deleted to avoid confusion. All migrations are logged
   * with server counts for audit purposes.
   *
   * This ensures backward compatibility for projects using the old config location
   * while transitioning to the SDK-aligned format expected by Claude Agent SDK.
   *
   * @param projectPath - Absolute path to the project directory to check for legacy configs
   *
   * @returns Promise that resolves when migration is complete (or skipped if no legacy config)
   *
   * @example
   * ```typescript
   * // Before migration:
   * // .claude/mcp.json exists with { "mcpServers": { "filesystem": {...} } }
   * // .mcp.json doesn't exist
   *
   * await this.checkAndMigrateLegacyConfigs('/path/to/project');
   *
   * // After migration:
   * // .claude/mcp.json is deleted
   * // .mcp.json now contains { "mcpServers": { "filesystem": {...} } }
   * ```
   *
   * @example
   * ```typescript
   * // Merge scenario - both configs exist
   * // .claude/mcp.json: { "mcpServers": { "old-server": {...}, "shared": { version: 1 } } }
   * // .mcp.json: { "mcpServers": { "new-server": {...}, "shared": { version: 2 } } }
   *
   * await this.checkAndMigrateLegacyConfigs('/path/to/project');
   *
   * // Result in .mcp.json:
   * // { "mcpServers": { "old-server": {...}, "new-server": {...}, "shared": { version: 2 } } }
   * // Note: new config's "shared" server overwrites legacy version
   * ```
   *
   * @private
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
   *
   * @description
   * Reads and parses an MCP configuration file (.mcp.json), applying environment
   * variable substitution to all string values. This enables secure configuration
   * management by allowing sensitive values (like API keys) to be stored in
   * environment variables rather than committed to version control.
   *
   * The method performs the following steps:
   * 1. Check if config file exists (returns null if not found)
   * 2. Read file contents as UTF-8 text
   * 3. Parse JSON into MCPConfig object
   * 4. Apply environment variable substitution using ${VAR_NAME} syntax
   * 5. Return the fully-resolved configuration
   *
   * Environment variable substitution supports the format:
   * - ${VAR_NAME} - Replaced with process.env.VAR_NAME value
   * - If environment variable is not set, the literal string is preserved
   *
   * Errors during read/parse are logged and null is returned, allowing the
   * application to gracefully handle missing or invalid configurations.
   *
   * @param configPath - Absolute path to the MCP configuration file to read
   *
   * @returns Promise resolving to parsed MCPConfig with env vars substituted,
   *          or null if file doesn't exist or parsing fails
   *
   * @example
   * ```typescript
   * // Config file at /project/.mcp.json:
   * // {
   * //   "mcpServers": {
   * //     "github": {
   * //       "command": "npx",
   * //       "args": ["-y", "@modelcontextprotocol/server-github"],
   * //       "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
   * //     }
   * //   }
   * // }
   *
   * // With environment variable: GITHUB_TOKEN=ghp_abc123
   * const config = await this.readMCPConfig('/project/.mcp.json');
   *
   * // Result:
   * // {
   * //   mcpServers: {
   * //     github: {
   * //       command: "npx",
   * //       args: ["-y", "@modelcontextprotocol/server-github"],
   * //       env: { GITHUB_TOKEN: "ghp_abc123" }  // <- Substituted!
   * //     }
   * //   }
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // File doesn't exist
   * const config = await this.readMCPConfig('/nonexistent/.mcp.json');
   * console.log(config); // null
   * ```
   *
   * @private
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
   *
   * @description
   * Writes an MCPConfig object to disk as a formatted JSON file. This method ensures
   * the configuration is persisted in a human-readable format with proper indentation
   * (2 spaces) and UTF-8 encoding.
   *
   * The method performs the following operations:
   * 1. Ensure parent directory exists (creates recursively if needed)
   * 2. Serialize config object to formatted JSON (2-space indentation)
   * 3. Write to file with UTF-8 encoding
   * 4. Log success with file path
   *
   * If the write operation fails (e.g., due to permission issues), the error is
   * logged and re-thrown to allow the caller to handle it appropriately.
   *
   * This method does NOT perform environment variable substitution in reverse -
   * it writes the config exactly as provided. Callers are responsible for ensuring
   * sensitive values use ${VAR_NAME} placeholders if desired.
   *
   * @param configPath - Absolute path to the MCP configuration file to write
   * @param config - MCPConfig object to serialize and write to disk
   *
   * @returns Promise that resolves when the file is successfully written
   *
   * @throws Error if directory creation fails or file write operation fails
   *
   * @example
   * ```typescript
   * const config: MCPConfig = {
   *   mcpServers: {
   *     filesystem: {
   *       command: 'npx',
   *       args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *       env: { DEBUG: 'true' }
   *     }
   *   }
   * };
   *
   * await this.writeMCPConfig('/project/.mcp.json', config);
   *
   * // File written to /project/.mcp.json:
   * // {
   * //   "mcpServers": {
   * //     "filesystem": {
   * //       "command": "npx",
   * //       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
   * //       "env": { "DEBUG": "true" }
   * //     }
   * //   }
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Writing to nested directory (auto-creates parent dirs)
   * const config: MCPConfig = { mcpServers: {} };
   * await this.writeMCPConfig('/project/configs/mcp/.mcp.json', config);
   * // Creates /project/configs/mcp/ directory if it doesn't exist
   * ```
   *
   * @private
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
   *
   * @description
   * Transforms the raw MCPConfig object (from .mcp.json file) into a normalized array
   * of MCPServerInternal objects. This method flattens the key-value structure of
   * mcpServers into a consistent array format that's easier to work with programmatically.
   *
   * The transformation process:
   * 1. Extracts server name from object keys
   * 2. Determines transport type (stdio, sdk, sse, http) from config or defaults to 'stdio'
   * 3. Creates MCPServerInternal objects with normalized structure
   * 4. Preserves all original config properties (command, args, env, disabled)
   * 5. Uses server name as both 'id' and 'name' for consistency
   *
   * This method safely handles null or empty configs by returning an empty array,
   * making it safe to use in all contexts without null checks.
   *
   * The resulting MCPServerInternal[] array is the internal representation used
   * throughout the service for server management operations.
   *
   * @param config - MCPConfig object read from file, or null if file doesn't exist
   *
   * @returns Array of MCPServerInternal objects with normalized structure.
   *          Returns empty array if config is null or has no servers.
   *
   * @example
   * ```typescript
   * const config: MCPConfig = {
   *   mcpServers: {
   *     filesystem: {
   *       command: 'npx',
   *       args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *       env: { DEBUG: 'true' }
   *     },
   *     github: {
   *       command: 'npx',
   *       args: ['-y', '@modelcontextprotocol/server-github'],
   *       env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
   *       disabled: true
   *     },
   *     customSdk: {
   *       type: 'sdk',
   *       name: 'customSdk'
   *     }
   *   }
   * };
   *
   * const servers = this.configToServers(config);
   *
   * // Result:
   * // [
   * //   {
   * //     id: 'filesystem',
   * //     name: 'filesystem',
   * //     type: 'stdio',  // <- Inferred from missing 'type' field
   * //     config: { command: 'npx', args: [...], env: {...} },
   * //     disabled: undefined
   * //   },
   * //   {
   * //     id: 'github',
   * //     name: 'github',
   * //     type: 'stdio',
   * //     config: { command: 'npx', args: [...], env: {...}, disabled: true },
   * //     disabled: true
   * //   },
   * //   {
   * //     id: 'customSdk',
   * //     name: 'customSdk',
   * //     type: 'sdk',  // <- Explicit type from config
   * //     config: { type: 'sdk', name: 'customSdk' },
   * //     disabled: undefined
   * //   }
   * // ]
   * ```
   *
   * @example
   * ```typescript
   * // Handling null/empty configs
   * const servers1 = this.configToServers(null);
   * console.log(servers1); // []
   *
   * const servers2 = this.configToServers({ mcpServers: {} });
   * console.log(servers2); // []
   * ```
   *
   * @private
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
   * Register an in-process SDK MCP server instance
   *
   * @description
   * Registers a JavaScript/TypeScript MCP server instance for in-process execution.
   * SDK servers run directly within the Node.js process, avoiding the overhead of
   * spawning external processes and providing faster tool execution.
   *
   * This method stores the server instance in an internal registry (Map) keyed by
   * server name. Once registered, the SDK server can be:
   * - Added to .mcp.json configuration with type 'sdk'
   * - Tested for validity using testMCPServer()
   * - Queried for available tools using listMCPServerTools()
   * - Used by Claude Agent SDK for in-process tool execution
   *
   * The server instance must implement the MCP server interface, specifically:
   * - listTools(): Promise<Tool[]> - Returns array of available tools
   * - Additional methods as required by MCP protocol
   *
   * Registration is a prerequisite for SDK server functionality. Attempting to use
   * an SDK server before registration will result in "server not registered" errors
   * when testing or listing tools.
   *
   * @param name - Unique identifier for the SDK server (must match config name)
   * @param instance - MCP server instance implementing listTools() and other MCP methods
   *
   * @example
   * ```typescript
   * import { MyCustomMCPServer } from './my-mcp-server.js';
   *
   * const mcpService = new MCPService();
   *
   * // Create and register SDK server instance
   * const myServer = new MyCustomMCPServer({
   *   config: { apiKey: process.env.API_KEY }
   * });
   *
   * mcpService.registerSdkServer('my-custom-server', myServer);
   *
   * // Now add to configuration
   * await mcpService.addMCPServer(
   *   'my-custom-server',
   *   { type: 'sdk', name: 'my-custom-server' },
   *   '/path/to/project'
   * );
   *
   * // Test the registered server
   * const result = await mcpService.testMCPServer('my-custom-server', '/path/to/project');
   * console.log(result.success); // true
   * ```
   *
   * @example
   * ```typescript
   * // Multiple SDK servers
   * const weatherServer = new WeatherMCPServer();
   * const databaseServer = new DatabaseMCPServer();
   *
   * mcpService.registerSdkServer('weather', weatherServer);
   * mcpService.registerSdkServer('database', databaseServer);
   *
   * // Both servers now available for in-process execution
   * ```
   */
  registerSdkServer(name: string, instance: any): void {
    this.sdkServers.set(name, instance);
    this.logger.info('SDK MCP server registered', { name });
  }

  /**
   * Unregister an in-process SDK MCP server instance
   *
   * @description
   * Removes a previously registered SDK MCP server instance from the internal registry.
   * This effectively disables in-process execution for the specified server.
   *
   * After unregistration:
   * - The server instance is removed from the internal Map
   * - Testing the server will return "SDK server not registered" error
   * - Attempting to list tools will fail with "server not registered" error
   * - The server config may still exist in .mcp.json but won't function
   *
   * This method is useful for:
   * - Hot-reloading server implementations during development
   * - Cleaning up resources before application shutdown
   * - Temporarily disabling SDK servers without modifying .mcp.json
   * - Replacing server instances with updated versions
   *
   * Note: This method only affects the in-process registry. To completely remove
   * the server, you should also call deleteMCPServer() to remove it from .mcp.json.
   *
   * @param name - Name of the SDK server to unregister (must match registration name)
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   * const myServer = new MyMCPServer();
   *
   * // Register server
   * mcpService.registerSdkServer('my-server', myServer);
   *
   * // Later, unregister it
   * mcpService.unregisterSdkServer('my-server');
   *
   * // Server is no longer available for in-process execution
   * const result = await mcpService.testMCPServer('my-server', '/path/to/project');
   * console.log(result.success); // false
   * console.log(result.error); // "SDK server "my-server" instance not found..."
   * ```
   *
   * @example
   * ```typescript
   * // Hot-reload pattern: replace server instance with updated version
   * mcpService.unregisterSdkServer('my-server');
   *
   * // Load updated server code
   * const updatedServer = new MyMCPServerV2();
   * mcpService.registerSdkServer('my-server', updatedServer);
   * ```
   */
  unregisterSdkServer(name: string): void {
    this.sdkServers.delete(name);
    this.logger.info('SDK MCP server unregistered', { name });
  }

  /**
   * Get all MCP servers from project configuration
   *
   * @description
   * Retrieves all MCP servers configured in the project's .mcp.json file, returning
   * them as an array of normalized MCPServerInternal objects. This is the primary
   * method for listing all available MCP servers in a project.
   *
   * The method performs the following operations:
   * 1. Auto-detect and migrate legacy .claude/mcp.json configs to .mcp.json (if found)
   * 2. Read .mcp.json from project root with environment variable substitution
   * 3. Transform raw config into normalized MCPServerInternal[] array
   * 4. Return all servers (both enabled and disabled)
   *
   * The returned servers include both stdio (external process) and SDK (in-process)
   * transport types. Each server object contains:
   * - id and name (typically the same, derived from config key)
   * - type (stdio, sdk, sse, http)
   * - config (complete server configuration)
   * - disabled flag (if true, server won't be loaded by Claude SDK)
   *
   * If no .mcp.json file exists or the file is empty, an empty array is returned.
   * This method never throws errors - file read failures are logged and result in
   * an empty array return.
   *
   * @param projectPath - Absolute path to project directory containing .mcp.json.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to array of MCPServerInternal objects.
   *          Returns empty array if no config exists or config is invalid.
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Get all servers in current project
   * const servers = await mcpService.getMCPServers();
   * console.log(`Found ${servers.length} MCP servers`);
   *
   * servers.forEach(server => {
   *   console.log(`- ${server.name} (${server.type})${server.disabled ? ' [disabled]' : ''}`);
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Get servers for specific project
   * const servers = await mcpService.getMCPServers('/Users/dev/my-project');
   *
   * // Filter enabled stdio servers
   * const enabledStdioServers = servers.filter(s =>
   *   s.type === 'stdio' && !s.disabled
   * );
   *
   * // Check if specific server exists
   * const hasFilesystem = servers.some(s => s.name === 'filesystem');
   * ```
   *
   * @example
   * ```typescript
   * // List all servers with their tools
   * const servers = await mcpService.getMCPServers();
   *
   * for (const server of servers) {
   *   if (!server.disabled) {
   *     const toolsResult = await mcpService.listMCPServerTools(server.id);
   *     console.log(`${server.name}: ${toolsResult.tools.length} tools`);
   *   }
   * }
   * ```
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
   * Get a specific MCP server by its unique identifier
   *
   * @description
   * Retrieves a single MCP server configuration by ID from the project's .mcp.json file.
   * This is a convenience method that wraps getMCPServers() and filters by ID.
   *
   * The method:
   * 1. Calls getMCPServers() to load all servers (including legacy migration)
   * 2. Searches for a server with matching ID (case-sensitive exact match)
   * 3. Returns the server if found, or null if not found
   * 4. Logs a warning if server is not found
   *
   * The ID corresponds to the server name as defined in .mcp.json. For example,
   * if .mcp.json contains { "mcpServers": { "filesystem": {...} } }, the ID is "filesystem".
   *
   * Returns null (rather than throwing) for missing servers, allowing callers to
   * gracefully handle non-existent servers without try/catch blocks.
   *
   * @param id - Unique identifier of the MCP server (must match config key exactly)
   * @param projectPath - Absolute path to project directory containing .mcp.json.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to MCPServerInternal if found, or null if server
   *          with specified ID doesn't exist in configuration.
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Get specific server
   * const server = await mcpService.getMCPServerById('filesystem');
   *
   * if (server) {
   *   console.log(`Found ${server.name}`);
   *   console.log(`Type: ${server.type}`);
   *   console.log(`Disabled: ${server.disabled || false}`);
   *
   *   if (isStdioServer(server.config)) {
   *     console.log(`Command: ${server.config.command}`);
   *     console.log(`Args: ${server.config.args?.join(' ')}`);
   *   }
   * } else {
   *   console.log('Server not found');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Check if server exists before testing
   * const server = await mcpService.getMCPServerById('github', '/path/to/project');
   *
   * if (!server) {
   *   console.error('GitHub MCP server not configured');
   *   return;
   * }
   *
   * // Server exists, safe to test
   * const testResult = await mcpService.testMCPServer('github', '/path/to/project');
   * ```
   *
   * @example
   * ```typescript
   * // Update server if exists, add if not
   * const existingServer = await mcpService.getMCPServerById('custom-server');
   *
   * if (existingServer) {
   *   await mcpService.updateMCPServer('custom-server', newConfig);
   * } else {
   *   await mcpService.addMCPServer('custom-server', newConfig);
   * }
   * ```
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
   * Add a new MCP server to project configuration
   *
   * @description
   * Creates a new MCP server entry in the project's .mcp.json configuration file.
   * This method adds the server to the persistent configuration, making it available
   * for use by the Claude Agent SDK.
   *
   * The method performs the following operations:
   * 1. Read existing .mcp.json (or create new config if file doesn't exist)
   * 2. Validate that server name doesn't already exist (throws if duplicate)
   * 3. Add new server configuration to mcpServers object
   * 4. Write updated config back to .mcp.json
   * 5. Return normalized MCPServerInternal object representing the new server
   *
   * Server Configuration Types:
   * - Stdio server: Requires command, optional args and env
   *   ```typescript
   *   {
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *     env: { DEBUG: 'true' }
   *   }
   *   ```
   *
   * - SDK server: Requires type 'sdk' and name (instance must be registered first)
   *   ```typescript
   *   { type: 'sdk', name: 'my-sdk-server' }
   *   ```
   *
   * The server is added in enabled state by default. To add a disabled server,
   * include `disabled: true` in the serverConfig.
   *
   * @param name - Unique name for the MCP server (becomes the config key in .mcp.json)
   * @param serverConfig - Complete server configuration including transport details
   * @param projectPath - Absolute path to project directory.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to MCPServerInternal object representing the newly added server
   *
   * @throws Error if server with the same name already exists in configuration
   * @throws Error if .mcp.json write operation fails (e.g., permission issues)
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Add a stdio MCP server
   * const filesystemServer = await mcpService.addMCPServer(
   *   'filesystem',
   *   {
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *     env: { DEBUG: 'true' }
   *   },
   *   '/path/to/project'
   * );
   *
   * console.log(`Added ${filesystemServer.name} (${filesystemServer.type})`);
   * ```
   *
   * @example
   * ```typescript
   * // Add SDK server (must register instance first)
   * const myServer = new MyCustomMCPServer();
   * mcpService.registerSdkServer('custom-sdk', myServer);
   *
   * const sdkServer = await mcpService.addMCPServer(
   *   'custom-sdk',
   *   { type: 'sdk', name: 'custom-sdk' }
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Add server with environment variables
   * const githubServer = await mcpService.addMCPServer(
   *   'github',
   *   {
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-github'],
   *     env: {
   *       GITHUB_TOKEN: '${GITHUB_TOKEN}',  // Will be substituted from env
   *       GITHUB_ORG: 'my-org'
   *     }
   *   }
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Add disabled server (won't be loaded by SDK until enabled)
   * const disabledServer = await mcpService.addMCPServer(
   *   'experimental-server',
   *   {
   *     command: 'node',
   *     args: ['./experimental-mcp-server.js'],
   *     disabled: true
   *   }
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Error handling for duplicate names
   * try {
   *   await mcpService.addMCPServer('filesystem', { command: 'test' });
   * } catch (error) {
   *   console.error('Server already exists:', error.message);
   *   // Error: MCP server "filesystem" already exists
   * }
   * ```
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
   * Update an existing MCP server configuration
   *
   * @description
   * Modifies the configuration of an existing MCP server in the project's .mcp.json file.
   * This method performs a complete replacement of the server's configuration with the
   * new serverConfig provided.
   *
   * The method performs the following operations:
   * 1. Read existing .mcp.json configuration
   * 2. Validate that server with specified ID exists (throws if not found)
   * 3. Replace server configuration with new serverConfig (complete replacement, not merge)
   * 4. Write updated config back to .mcp.json
   * 5. Return normalized MCPServerInternal object with updated configuration
   *
   * Important: This is a full replacement operation. Any properties in the old
   * configuration that are not included in the new serverConfig will be lost.
   * If you need to modify specific properties while preserving others, retrieve
   * the existing config first, modify it, then pass the merged result.
   *
   * The update affects the persistent configuration and will take effect the next
   * time Claude Agent SDK loads MCP servers. Active server connections are not
   * automatically restarted - the application may need to restart for changes to
   * take effect.
   *
   * @param id - Unique identifier of the MCP server to update (must exist in config)
   * @param serverConfig - New complete server configuration (replaces existing config)
   * @param projectPath - Absolute path to project directory.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to MCPServerInternal object with updated configuration
   *
   * @throws Error if server with specified ID is not found in configuration
   * @throws Error if .mcp.json write operation fails (e.g., permission issues)
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Update server's command and args
   * const updatedServer = await mcpService.updateMCPServer(
   *   'filesystem',
   *   {
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
   *     env: { DEBUG: 'true', LOG_LEVEL: 'info' }
   *   },
   *   '/path/to/project'
   * );
   *
   * console.log('Server updated:', updatedServer.name);
   * ```
   *
   * @example
   * ```typescript
   * // Disable a server by updating its config
   * await mcpService.updateMCPServer(
   *   'github',
   *   {
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-github'],
   *     disabled: true  // Server will not be loaded
   *   }
   * );
   * ```
   *
   * @example
   * ```typescript
   * // Safe update: merge with existing config to preserve properties
   * const existingServer = await mcpService.getMCPServerById('filesystem');
   *
   * if (existingServer && isStdioServer(existingServer.config)) {
   *   // Merge new args with existing config
   *   const updatedConfig = {
   *     ...existingServer.config,
   *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/new/path']
   *   };
   *
   *   await mcpService.updateMCPServer('filesystem', updatedConfig);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Update environment variables
   * const githubServer = await mcpService.getMCPServerById('github');
   *
   * if (githubServer && isStdioServer(githubServer.config)) {
   *   await mcpService.updateMCPServer('github', {
   *     ...githubServer.config,
   *     env: {
   *       ...githubServer.config.env,
   *       GITHUB_TOKEN: '${NEW_GITHUB_TOKEN}',  // Update token reference
   *       GITHUB_API_URL: 'https://api.github.com'
   *     }
   *   });
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling for non-existent server
   * try {
   *   await mcpService.updateMCPServer('nonexistent', { command: 'test' });
   * } catch (error) {
   *   console.error('Cannot update:', error.message);
   *   // Error: MCP server "nonexistent" not found
   * }
   * ```
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
   * Delete an MCP server from project configuration
   *
   * @description
   * Permanently removes an MCP server entry from the project's .mcp.json configuration file.
   * This method deletes the server from persistent storage, making it unavailable for
   * future use by the Claude Agent SDK.
   *
   * The method performs the following operations:
   * 1. Read existing .mcp.json configuration
   * 2. Validate that server with specified ID exists (throws if not found)
   * 3. Remove server entry from mcpServers object using JavaScript delete operator
   * 4. Write updated config back to .mcp.json
   * 5. Log successful deletion
   *
   * Important Considerations:
   * - This is a permanent deletion - the server configuration cannot be recovered
   *   unless you have a backup of .mcp.json
   * - Active server connections are not automatically terminated - the application
   *   may need to restart for changes to take effect
   * - For SDK servers, this only removes the config entry - the registered instance
   *   remains in memory until unregisterSdkServer() is called
   * - Consider using toggleMCPServer() to disable instead of delete if you may
   *   need to re-enable the server later
   *
   * The deletion affects only the .mcp.json configuration. For SDK servers, you
   * should also call unregisterSdkServer() to clean up the in-memory instance.
   *
   * @param id - Unique identifier of the MCP server to delete (must exist in config)
   * @param projectPath - Absolute path to project directory.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise that resolves when server is successfully deleted
   *
   * @throws Error if server with specified ID is not found in configuration
   * @throws Error if .mcp.json write operation fails (e.g., permission issues)
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Delete a server
   * await mcpService.deleteMCPServer('filesystem', '/path/to/project');
   * console.log('Filesystem server deleted');
   * ```
   *
   * @example
   * ```typescript
   * // Check if server exists before deleting
   * const server = await mcpService.getMCPServerById('old-server');
   *
   * if (server) {
   *   await mcpService.deleteMCPServer('old-server');
   *   console.log('Old server removed');
   * } else {
   *   console.log('Server not found, nothing to delete');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Delete SDK server: remove both registration and config
   * mcpService.unregisterSdkServer('my-sdk-server');  // Remove instance
   * await mcpService.deleteMCPServer('my-sdk-server'); // Remove config
   * console.log('SDK server fully removed');
   * ```
   *
   * @example
   * ```typescript
   * // Error handling for non-existent server
   * try {
   *   await mcpService.deleteMCPServer('nonexistent');
   * } catch (error) {
   *   console.error('Cannot delete:', error.message);
   *   // Error: MCP server "nonexistent" not found
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Conditional delete: remove if disabled
   * const servers = await mcpService.getMCPServers();
   *
   * for (const server of servers) {
   *   if (server.disabled) {
   *     await mcpService.deleteMCPServer(server.id);
   *     console.log(`Deleted disabled server: ${server.name}`);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Safe deletion with backup
   * const mcpService = new MCPService();
   *
   * // Backup config before deleting
   * const config = await mcpService.exportMCPConfig('/path/to/project');
   * await fs.writeFile('mcp-backup.json', JSON.stringify(config, null, 2));
   *
   * // Now safe to delete
   * await mcpService.deleteMCPServer('experimental-server');
   * ```
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
   * Test MCP server connectivity and validity
   *
   * @description
   * Validates that an MCP server is properly configured and can be successfully
   * initialized. This method performs a comprehensive test of the server based on
   * its transport type, ensuring the server is ready for use by the Claude Agent SDK.
   *
   * The testing process:
   * 1. Retrieves server configuration from .mcp.json by ID
   * 2. Determines transport type (stdio or SDK)
   * 3. Delegates to type-specific test method:
   *    - Stdio servers: Spawns process, verifies it starts successfully
   *    - SDK servers: Checks instance is registered and implements required methods
   * 4. Returns detailed test result with success/failure status and error details
   *
   * Testing Behavior by Transport Type:
   *
   * **Stdio Servers:**
   * - Spawns the external process using configured command and args
   * - Waits for successful spawn event (up to 10 seconds)
   * - Kills process after 1 second if spawn succeeds
   * - Returns success if process spawns without errors
   * - Returns failure if process fails to spawn, times out, or exits with error
   *
   * **SDK Servers:**
   * - Checks if server instance is registered in internal registry
   * - Validates instance implements required listTools() method
   * - Returns success if instance exists and is valid
   * - Returns failure if instance not registered or missing required methods
   *
   * This method is safe to call repeatedly and does not affect server state.
   * It's designed for configuration validation and troubleshooting.
   *
   * @param id - Unique identifier of the MCP server to test (must exist in .mcp.json)
   * @param projectPath - Absolute path to project directory.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to test result object:
   *          - success: boolean indicating if test passed
   *          - message: Human-readable test result description
   *          - error: Optional error message if test failed
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Test a stdio server
   * const result = await mcpService.testMCPServer('filesystem', '/path/to/project');
   *
   * if (result.success) {
   *   console.log('✓', result.message);
   *   // Output: "✓ MCP server started successfully"
   * } else {
   *   console.error('✗', result.message, ':', result.error);
   *   // Output: "✗ Failed to start : Command 'npx' not found"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Test SDK server (requires prior registration)
   * const myServer = new MyMCPServer();
   * mcpService.registerSdkServer('my-server', myServer);
   *
   * await mcpService.addMCPServer(
   *   'my-server',
   *   { type: 'sdk', name: 'my-server' }
   * );
   *
   * const result = await mcpService.testMCPServer('my-server');
   * console.log(result.message);
   * // Output: "SDK server is registered and valid"
   * ```
   *
   * @example
   * ```typescript
   * // Test all configured servers
   * const servers = await mcpService.getMCPServers();
   *
   * for (const server of servers) {
   *   const result = await mcpService.testMCPServer(server.id);
   *   console.log(`${server.name}: ${result.success ? '✓' : '✗'} ${result.message}`);
   * }
   *
   * // Output:
   * // filesystem: ✓ MCP server started successfully
   * // github: ✗ Failed to start : GITHUB_TOKEN not set
   * // custom-sdk: ✓ SDK server is registered and valid
   * ```
   *
   * @example
   * ```typescript
   * // Handle test failures gracefully
   * const result = await mcpService.testMCPServer('experimental-server');
   *
   * if (!result.success) {
   *   if (result.error?.includes('not found')) {
   *     console.log('Server not configured - add it first');
   *   } else if (result.error?.includes('timeout')) {
   *     console.log('Server timed out - check command and args');
   *   } else if (result.error?.includes('not registered')) {
   *     console.log('SDK server needs registration');
   *   } else {
   *     console.log('Unknown error:', result.error);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Test before using in production
   * async function enableServerIfValid(serverId: string) {
   *   const testResult = await mcpService.testMCPServer(serverId);
   *
   *   if (testResult.success) {
   *     // Server is valid, ensure it's enabled
   *     const server = await mcpService.getMCPServerById(serverId);
   *     if (server?.disabled) {
   *       await mcpService.toggleMCPServer(serverId);
   *       console.log(`${serverId} enabled and ready to use`);
   *     }
   *   } else {
   *     console.error(`Cannot enable ${serverId}:`, testResult.error);
   *   }
   * }
   * ```
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
   * Test stdio MCP server by spawning external process
   *
   * @description
   * Validates a stdio-based MCP server by spawning its external process and verifying
   * it starts successfully. This method performs a shallow connectivity test without
   * attempting full MCP protocol initialization.
   *
   * The testing process:
   * 1. Validates config is a stdio server configuration
   * 2. Spawns external process using configured command, args, and env
   * 3. Monitors process events with 10-second timeout:
   *    - 'spawn': Process started successfully → wait 1s, then kill and return success
   *    - 'error': Process failed to spawn → return failure with error message
   *    - 'exit': Process exited → success if code 0/null, failure otherwise
   *    - timeout: No response after 10s → kill process and return timeout error
   * 4. Cleans up spawned process in all cases
   *
   * This is a "smoke test" to verify the server can be launched, not a full functional test.
   * It does NOT test MCP protocol compliance or tool availability - use listMCPServerTools()
   * for comprehensive validation.
   *
   * The method uses Promise-based async handling with proper cleanup to ensure spawned
   * processes are always terminated, preventing orphaned child processes.
   *
   * @param config - MCP server configuration (must be stdio type with command property)
   *
   * @returns Promise resolving to test result object:
   *          - success: true if process spawned successfully, false otherwise
   *          - message: Human-readable description of test result
   *          - error: Optional error details if test failed
   *
   * @example
   * ```typescript
   * const config: MCPStdioServerConfig = {
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *   env: { DEBUG: 'true' }
   * };
   *
   * const result = await this.testStdioServer(config);
   *
   * // Success case:
   * // { success: true, message: 'MCP server started successfully' }
   *
   * // Failure case:
   * // { success: false, message: 'Failed to start', error: 'Command not found' }
   * ```
   *
   * @example
   * ```typescript
   * // Timeout scenario (server takes too long to start)
   * const slowConfig: MCPStdioServerConfig = {
   *   command: 'slow-mcp-server',
   *   args: ['--delay', '20000']
   * };
   *
   * const result = await this.testStdioServer(slowConfig);
   * // { success: false, message: 'Test timeout', error: 'MCP server did not respond within 10 seconds' }
   * ```
   *
   * @example
   * ```typescript
   * // Invalid config handling
   * const sdkConfig = { type: 'sdk', name: 'my-server' } as MCPServerConfig;
   *
   * const result = await this.testStdioServer(sdkConfig);
   * // { success: false, message: 'Invalid server config', error: 'Not a stdio server' }
   * ```
   *
   * @example
   * ```typescript
   * // Environment variable issues
   * const githubConfig: MCPStdioServerConfig = {
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-github'],
   *   env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' }  // Not set in environment
   * };
   *
   * const result = await this.testStdioServer(githubConfig);
   * // May succeed at spawn but fail during actual use when token is required
   * ```
   *
   * @private
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
   * Test SDK MCP server instance validity
   *
   * @description
   * Validates an in-process SDK MCP server by checking that the instance is properly
   * registered and implements the required MCP server interface. This is a synchronous
   * validation (no process spawning) that verifies the server is ready for in-process use.
   *
   * The validation process:
   * 1. Validates config is an SDK server configuration
   * 2. Checks if server instance exists in internal registry (sdkServers Map)
   * 3. Validates instance implements required listTools() method
   * 4. Returns success if all checks pass
   *
   * This test does NOT invoke listTools() or any other server methods - it only
   * verifies the interface is implemented. For functional testing of tool availability,
   * use listMCPServerTools() which actually calls the server's methods.
   *
   * SDK servers must be registered using registerSdkServer() before they can be tested.
   * Attempting to test an unregistered SDK server will return a failure with instructions
   * to register the instance first.
   *
   * @param config - MCP server configuration (must be SDK type with name property)
   *
   * @returns Promise resolving to test result object:
   *          - success: true if instance registered and valid, false otherwise
   *          - message: Human-readable description of test result
   *          - error: Optional error details if validation failed
   *
   * @example
   * ```typescript
   * // Successful SDK server test
   * const myServer = new MyMCPServer();
   * mcpService.registerSdkServer('my-server', myServer);
   *
   * const config = { type: 'sdk', name: 'my-server' } as MCPServerConfig;
   * const result = await this.testSdkServer(config);
   *
   * // { success: true, message: 'SDK server is registered and valid' }
   * ```
   *
   * @example
   * ```typescript
   * // Unregistered SDK server
   * const config = { type: 'sdk', name: 'unregistered-server' } as MCPServerConfig;
   * const result = await this.testSdkServer(config);
   *
   * // {
   * //   success: false,
   * //   message: 'SDK server not registered',
   * //   error: 'SDK server "unregistered-server" instance not found. Use registerSdkServer() first.'
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Invalid SDK server (missing required methods)
   * const invalidServer = { someMethod: () => {} };
   * mcpService.registerSdkServer('invalid', invalidServer);
   *
   * const config = { type: 'sdk', name: 'invalid' } as MCPServerConfig;
   * const result = await this.testSdkServer(config);
   *
   * // {
   * //   success: false,
   * //   message: 'Invalid SDK server',
   * //   error: 'SDK server instance must implement listTools() method'
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Wrong config type
   * const stdioConfig: MCPStdioServerConfig = {
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
   * };
   *
   * const result = await this.testSdkServer(stdioConfig);
   * // { success: false, message: 'Invalid server config', error: 'Not an SDK server' }
   * ```
   *
   * @example
   * ```typescript
   * // Complete SDK server registration and testing flow
   * import { MyMCPServer } from './my-mcp-server.js';
   *
   * const server = new MyMCPServer({ apiKey: process.env.API_KEY });
   * mcpService.registerSdkServer('my-server', server);
   *
   * const config = { type: 'sdk', name: 'my-server' } as MCPServerConfig;
   * const testResult = await this.testSdkServer(config);
   *
   * if (testResult.success) {
   *   console.log('SDK server is valid and ready for use');
   *   // Now safe to add to .mcp.json
   *   await mcpService.addMCPServer('my-server', config);
   * } else {
   *   console.error('SDK server validation failed:', testResult.error);
   * }
   * ```
   *
   * @private
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
   * Delete multiple MCP servers in a single operation
   *
   * @description
   * Removes multiple MCP servers from the project's .mcp.json configuration file in
   * one operation. This method provides efficient batch deletion with detailed error
   * reporting for each server that fails to delete.
   *
   * The deletion process:
   * 1. Iterates through the array of server IDs
   * 2. For each ID, calls deleteMCPServer() which:
   *    - Reads current .mcp.json
   *    - Removes the server entry
   *    - Writes updated config back to disk
   * 3. Tracks success/failure for each deletion
   * 4. Collects error messages for failed deletions
   * 5. Returns summary with success count, failed count, and error details
   *
   * Important Considerations:
   * - Each deletion is independent - if one fails, others continue
   * - Deletions are NOT atomic - partial completion is possible
   * - The method reads/writes .mcp.json once per server (not optimized for large batches)
   * - Failed deletions include the server ID and error message in errors array
   * - Server IDs that don't exist will result in "not found" errors
   *
   * Performance Notes:
   * - For deleting many servers (10+), consider manual implementation that reads once,
   *   modifies, and writes once for better performance
   * - Current implementation prioritizes error reporting over performance
   *
   * Use Cases:
   * - Cleaning up obsolete MCP servers
   * - Removing all disabled servers at once
   * - Clearing test/development servers from configuration
   * - Implementing "delete selected" functionality in UI
   *
   * @param serverIds - Array of server IDs (names) to delete from configuration
   * @param projectPath - Absolute path to project directory containing .mcp.json.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to result object:
   *          - success: Number of servers successfully deleted
   *          - failed: Number of servers that failed to delete
   *          - errors: Array of error messages in format "serverId: error message"
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Delete multiple servers
   * const result = await mcpService.bulkDeleteMCPServers(
   *   ['old-server-1', 'old-server-2', 'test-server'],
   *   '/path/to/project'
   * );
   *
   * console.log(`Deleted ${result.success} servers`);
   * console.log(`Failed to delete ${result.failed} servers`);
   *
   * if (result.errors.length > 0) {
   *   console.log('Errors:');
   *   result.errors.forEach(error => console.log(`  - ${error}`));
   * }
   *
   * // Output:
   * // Deleted 2 servers
   * // Failed to delete 1 servers
   * // Errors:
   * //   - test-server: MCP server "test-server" not found
   * ```
   *
   * @example
   * ```typescript
   * // Delete all disabled servers
   * const servers = await mcpService.getMCPServers();
   * const disabledIds = servers
   *   .filter(s => s.disabled)
   *   .map(s => s.id);
   *
   * if (disabledIds.length > 0) {
   *   const result = await mcpService.bulkDeleteMCPServers(disabledIds);
   *   console.log(`Removed ${result.success} disabled servers`);
   * } else {
   *   console.log('No disabled servers to remove');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Delete with error handling and retry
   * const idsToDelete = ['server-1', 'server-2', 'server-3'];
   * let result = await mcpService.bulkDeleteMCPServers(idsToDelete);
   *
   * // Retry failed deletions once
   * if (result.failed > 0) {
   *   console.log(`Retrying ${result.failed} failed deletions...`);
   *
   *   // Extract IDs that failed
   *   const failedIds = result.errors
   *     .map(err => err.split(':')[0])
   *     .filter(id => id !== 'undefined');
   *
   *   const retryResult = await mcpService.bulkDeleteMCPServers(failedIds);
   *   console.log(`Retry: ${retryResult.success} succeeded, ${retryResult.failed} still failed`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Delete servers by pattern (all servers starting with 'test-')
   * const servers = await mcpService.getMCPServers();
   * const testServerIds = servers
   *   .filter(s => s.name.startsWith('test-'))
   *   .map(s => s.id);
   *
   * const result = await mcpService.bulkDeleteMCPServers(testServerIds);
   * console.log(`Removed ${result.success} test servers`);
   * ```
   *
   * @example
   * ```typescript
   * // Handle complete success vs partial failure
   * const result = await mcpService.bulkDeleteMCPServers(['server-1', 'server-2']);
   *
   * if (result.failed === 0) {
   *   console.log('✓ All servers deleted successfully');
   * } else if (result.success === 0) {
   *   console.error('✗ All deletions failed');
   *   result.errors.forEach(err => console.error(`  ${err}`));
   * } else {
   *   console.warn(`⚠ Partial success: ${result.success} deleted, ${result.failed} failed`);
   *   result.errors.forEach(err => console.error(`  ${err}`));
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Empty array handling
   * const result = await mcpService.bulkDeleteMCPServers([]);
   * console.log(result);
   * // { success: 0, failed: 0, errors: [] }
   * ```
   *
   * @example
   * ```typescript
   * // UI integration: delete selected servers from checkbox list
   * async function handleDeleteSelected(selectedIds: string[]) {
   *   if (selectedIds.length === 0) {
   *     alert('No servers selected');
   *     return;
   *   }
   *
   *   const confirmed = confirm(`Delete ${selectedIds.length} servers?`);
   *   if (!confirmed) return;
   *
   *   const result = await mcpService.bulkDeleteMCPServers(selectedIds);
   *
   *   if (result.failed === 0) {
   *     alert(`Successfully deleted ${result.success} servers`);
   *   } else {
   *     alert(
   *       `Deleted ${result.success} servers\n` +
   *       `Failed to delete ${result.failed} servers:\n` +
   *       result.errors.join('\n')
   *     );
   *   }
   *
   *   // Refresh server list
   *   await refreshServerList();
   * }
   * ```
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
   * Toggle MCP server between enabled and disabled states
   *
   * @description
   * Flips the disabled flag of an MCP server in the project's .mcp.json configuration.
   * This provides a non-destructive way to temporarily disable servers without deleting
   * their configuration, allowing easy re-enabling later.
   *
   * The toggle operation:
   * 1. Reads current .mcp.json configuration
   * 2. Validates server exists in configuration
   * 3. Reads current disabled state (defaults to false if not set)
   * 4. Inverts the disabled flag (!currentState)
   * 5. Writes updated config back to .mcp.json
   * 6. Returns new state with success indicator
   *
   * State Transitions:
   * - enabled (disabled: false or undefined) → disabled (disabled: true)
   * - disabled (disabled: true) → enabled (disabled: false)
   *
   * Disabled Server Behavior:
   * - Disabled servers are excluded from .mcp.json when synced via syncToMcpJson()
   * - Claude Agent SDK will not load disabled servers
   * - Server configuration is preserved in .mcp.json (can be re-enabled anytime)
   * - Disabled state is stored as 'disabled: true' in config
   *
   * This method is preferable to deleteMCPServer() when you:
   * - Want to temporarily disable a server for testing/debugging
   * - Need to disable a problematic server without losing its configuration
   * - Want to keep server config for future re-enabling
   * - Are implementing UI with enable/disable checkboxes
   *
   * @param id - Unique identifier of the MCP server to toggle (must exist in config)
   * @param projectPath - Absolute path to project directory containing .mcp.json.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to result object:
   *          - success: boolean indicating if toggle operation succeeded
   *          - disabled: boolean representing the NEW state (true if now disabled, false if now enabled)
   *          - message: Human-readable description of the result
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Toggle a server's state
   * const result = await mcpService.toggleMCPServer('filesystem', '/path/to/project');
   *
   * if (result.success) {
   *   console.log(`Server is now ${result.disabled ? 'disabled' : 'enabled'}`);
   *   console.log(result.message);
   * } else {
   *   console.error('Toggle failed:', result.message);
   * }
   *
   * // Output:
   * // Server is now disabled
   * // MCP server disabled successfully
   * ```
   *
   * @example
   * ```typescript
   * // Toggle multiple times (enable → disable → enable)
   * let result = await mcpService.toggleMCPServer('github');
   * console.log(`First toggle: ${result.disabled ? 'disabled' : 'enabled'}`);
   * // Output: First toggle: disabled
   *
   * result = await mcpService.toggleMCPServer('github');
   * console.log(`Second toggle: ${result.disabled ? 'disabled' : 'enabled'}`);
   * // Output: Second toggle: enabled
   * ```
   *
   * @example
   * ```typescript
   * // Conditional toggling based on current state
   * const server = await mcpService.getMCPServerById('filesystem');
   *
   * if (server?.disabled) {
   *   console.log('Server is currently disabled, enabling it...');
   *   await mcpService.toggleMCPServer('filesystem');
   * } else {
   *   console.log('Server is already enabled');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Handle non-existent server
   * const result = await mcpService.toggleMCPServer('nonexistent');
   *
   * if (!result.success) {
   *   console.error(result.message);
   *   // Output: MCP server not found
   * }
   * ```
   *
   * @example
   * ```typescript
   * // UI integration: checkbox toggle handler
   * async function handleServerToggle(serverId: string, checkbox: HTMLInputElement) {
   *   const result = await mcpService.toggleMCPServer(serverId);
   *
   *   if (result.success) {
   *     // Update checkbox to match new state
   *     checkbox.checked = !result.disabled;
   *
   *     // Show notification
   *     showNotification(
   *       `Server ${result.disabled ? 'disabled' : 'enabled'} successfully`,
   *       'success'
   *     );
   *   } else {
   *     // Revert checkbox on failure
   *     checkbox.checked = !checkbox.checked;
   *     showNotification(`Failed to toggle server: ${result.message}`, 'error');
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Disable all servers except one
   * const servers = await mcpService.getMCPServers();
   * const keepEnabled = 'filesystem';
   *
   * for (const server of servers) {
   *   if (server.id !== keepEnabled && !server.disabled) {
   *     const result = await mcpService.toggleMCPServer(server.id);
   *     console.log(`Disabled ${server.name}: ${result.success}`);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Enable all disabled servers
   * const servers = await mcpService.getMCPServers();
   * const disabledServers = servers.filter(s => s.disabled);
   *
   * console.log(`Enabling ${disabledServers.length} disabled servers...`);
   *
   * for (const server of disabledServers) {
   *   const result = await mcpService.toggleMCPServer(server.id);
   *   if (result.success) {
   *     console.log(`✓ Enabled ${server.name}`);
   *   } else {
   *     console.error(`✗ Failed to enable ${server.name}: ${result.message}`);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Toggle with confirmation dialog
   * async function toggleServerWithConfirmation(serverId: string) {
   *   const server = await mcpService.getMCPServerById(serverId);
   *   if (!server) {
   *     alert('Server not found');
   *     return;
   *   }
   *
   *   const action = server.disabled ? 'enable' : 'disable';
   *   const confirmed = confirm(`Are you sure you want to ${action} ${server.name}?`);
   *
   *   if (!confirmed) return;
   *
   *   const result = await mcpService.toggleMCPServer(serverId);
   *
   *   if (result.success) {
   *     alert(`Successfully ${action}d ${server.name}`);
   *   } else {
   *     alert(`Failed to ${action} server: ${result.message}`);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Batch toggle pattern (enable/disable multiple servers)
   * async function setServersEnabled(serverIds: string[], enabled: boolean) {
   *   const results = [];
   *
   *   for (const id of serverIds) {
   *     const server = await mcpService.getMCPServerById(id);
   *     if (!server) continue;
   *
   *     // Only toggle if current state doesn't match desired state
   *     const shouldToggle = server.disabled === enabled;
   *
   *     if (shouldToggle) {
   *       const result = await mcpService.toggleMCPServer(id);
   *       results.push({ id, success: result.success });
   *     }
   *   }
   *
   *   return results;
   * }
   *
   * // Usage
   * await setServersEnabled(['server-1', 'server-2'], true);  // Enable servers
   * await setServersEnabled(['server-3', 'server-4'], false); // Disable servers
   * ```
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
   * List all tools provided by an MCP server
   *
   * @description
   * Retrieves the complete list of tools available from an MCP server by querying the
   * server using the appropriate transport protocol. This method performs a full server
   * interaction, returning actual tool metadata including names, descriptions, and input schemas.
   *
   * The retrieval process:
   * 1. Retrieves server configuration from .mcp.json by ID
   * 2. Determines transport type (stdio or SDK)
   * 3. Delegates to transport-specific tool fetching method:
   *    - Stdio servers: Spawns process, performs MCP protocol handshake, sends tools/list request
   *    - SDK servers: Calls listTools() method on registered instance
   * 4. Normalizes tool metadata into consistent MCPTool[] format
   * 5. Returns tools array with success status
   *
   * Tool Fetching by Transport Type:
   *
   * **Stdio Servers:**
   * - Spawns external process via JSON-RPC over stdin/stdout
   * - Sends MCP protocol 'initialize' request (required handshake)
   * - Sends 'tools/list' request after successful initialization
   * - Parses JSON-RPC responses to extract tool metadata
   * - Times out after 15 seconds if no response
   * - Cleans up spawned process when complete
   *
   * **SDK Servers:**
   * - Retrieves registered server instance from internal registry
   * - Directly calls instance.listTools() method
   * - No process spawning or protocol handshake required
   * - Faster than stdio servers due to in-process execution
   *
   * Each returned MCPTool contains:
   * - name: Unique identifier for the tool
   * - description: Human-readable explanation of tool functionality
   * - inputSchema: JSON Schema defining expected input parameters
   *
   * This method is useful for:
   * - Discovering what tools an MCP server provides
   * - Validating server is functional and responding correctly
   * - Building UI for tool selection or documentation
   * - Syncing tool metadata to Strapi database
   *
   * @param id - Unique identifier of the MCP server (must exist in .mcp.json)
   * @param projectPath - Absolute path to project directory.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to result object:
   *          - success: boolean indicating if tools were retrieved successfully
   *          - tools: Array of MCPTool objects with name, description, inputSchema
   *          - error: Optional error message if retrieval failed
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // List tools from a stdio server
   * const result = await mcpService.listMCPServerTools('filesystem', '/path/to/project');
   *
   * if (result.success) {
   *   console.log(`Found ${result.tools.length} tools:`);
   *   result.tools.forEach(tool => {
   *     console.log(`- ${tool.name}: ${tool.description}`);
   *   });
   * } else {
   *   console.error('Failed to list tools:', result.error);
   * }
   *
   * // Output:
   * // Found 3 tools:
   * // - read_file: Read the complete contents of a file from the file system
   * // - write_file: Create a new file or completely overwrite an existing file
   * // - list_directory: Get a detailed listing of all files and directories
   * ```
   *
   * @example
   * ```typescript
   * // List tools from SDK server
   * const myServer = new MyMCPServer();
   * mcpService.registerSdkServer('my-server', myServer);
   * await mcpService.addMCPServer('my-server', { type: 'sdk', name: 'my-server' });
   *
   * const result = await mcpService.listMCPServerTools('my-server');
   *
   * console.log('SDK server tools:', result.tools);
   * // Output: SDK server tools: [{ name: 'custom_tool', description: '...', inputSchema: {...} }]
   * ```
   *
   * @example
   * ```typescript
   * // Examine tool input schemas
   * const result = await mcpService.listMCPServerTools('filesystem');
   *
   * if (result.success) {
   *   result.tools.forEach(tool => {
   *     console.log(`\n${tool.name}:`);
   *     console.log('Parameters:', JSON.stringify(tool.inputSchema, null, 2));
   *   });
   * }
   *
   * // Output:
   * // read_file:
   * // Parameters: {
   * //   "type": "object",
   * //   "properties": {
   * //     "path": { "type": "string", "description": "Path to file" }
   * //   },
   * //   "required": ["path"]
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // List tools for all configured servers
   * const servers = await mcpService.getMCPServers();
   *
   * for (const server of servers) {
   *   if (!server.disabled) {
   *     const result = await mcpService.listMCPServerTools(server.id);
   *     console.log(`${server.name}: ${result.success ? result.tools.length : 'ERROR'} tools`);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Handle errors gracefully
   * const result = await mcpService.listMCPServerTools('github');
   *
   * if (!result.success) {
   *   if (result.error?.includes('not found')) {
   *     console.log('Server not configured');
   *   } else if (result.error?.includes('Timeout')) {
   *     console.log('Server timed out - check connectivity');
   *   } else if (result.error?.includes('not registered')) {
   *     console.log('SDK server needs registration first');
   *   } else {
   *     console.log('Unknown error:', result.error);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Sync tools to Strapi database
   * const result = await mcpService.listMCPServerTools('filesystem');
   *
   * if (result.success && result.tools.length > 0) {
   *   // Sync to database using Strapi client
   *   await strapiClient.bulkSyncMCPTools(serverId, result.tools);
   *   console.log(`Synced ${result.tools.length} tools to database`);
   * }
   * ```
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
   * Fetch tools from stdio MCP server via JSON-RPC protocol
   *
   * @description
   * Retrieves tool metadata from an external stdio-based MCP server by spawning the
   * process and performing a complete MCP protocol handshake followed by a tools/list
   * request. This method implements the full MCP JSON-RPC communication flow.
   *
   * The MCP protocol communication sequence:
   * 1. Spawns external process with configured command, args, and env
   * 2. Sends 'initialize' JSON-RPC request (MCP protocol handshake requirement)
   *    - Includes protocol version, capabilities, and client info
   *    - Waits for successful initialization response (id: 1)
   * 3. After initialization, sends 'tools/list' JSON-RPC request (id: 2)
   * 4. Parses 'tools/list' response to extract tool metadata array
   * 5. Normalizes tools into MCPTool[] format with name, description, inputSchema
   * 6. Terminates spawned process and cleans up resources
   * 7. Times out after 15 seconds if server doesn't respond
   *
   * JSON-RPC Communication Format:
   * - Requests and responses are newline-delimited JSON
   * - Each request includes: jsonrpc, id, method, params
   * - Responses include: jsonrpc, id, result/error
   * - Communication happens over stdin (write) and stdout (read)
   *
   * The method handles:
   * - Line-by-line JSON parsing from stdout stream
   * - Non-JSON output (skipped/ignored)
   * - Process spawn errors
   * - Timeout scenarios
   * - Early process termination
   * - Proper cleanup in all cases
   *
   * Returns empty array instead of throwing on most errors to allow graceful
   * handling of servers with no tools or communication issues.
   *
   * @param config - MCP stdio server configuration (must have command property)
   *
   * @returns Promise resolving to array of MCPTool objects with name, description,
   *          and inputSchema. Returns empty array if:
   *          - Server has no tools
   *          - Communication fails
   *          - Process exits before sending tools
   *          - Invalid config type
   *
   * @throws Error if config is not a stdio server configuration
   * @throws Error if process spawn fails immediately
   * @throws Error if timeout occurs (15 seconds)
   *
   * @example
   * ```typescript
   * const config: MCPStdioServerConfig = {
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *   env: { DEBUG: 'true' }
   * };
   *
   * const tools = await this.fetchToolsFromStdioServer(config);
   *
   * console.log('Available tools:');
   * tools.forEach(tool => {
   *   console.log(`- ${tool.name}: ${tool.description}`);
   *   console.log(`  Schema:`, JSON.stringify(tool.inputSchema, null, 2));
   * });
   *
   * // Output:
   * // Available tools:
   * // - read_file: Read the complete contents of a file
   * //   Schema: { type: "object", properties: { path: {...} }, required: ["path"] }
   * // - write_file: Create a new file or overwrite existing
   * //   Schema: { type: "object", properties: { path: {...}, content: {...} } }
   * ```
   *
   * @example
   * ```typescript
   * // Handle servers with no tools (returns empty array)
   * const config: MCPStdioServerConfig = {
   *   command: 'node',
   *   args: ['./empty-mcp-server.js']
   * };
   *
   * const tools = await this.fetchToolsFromStdioServer(config);
   * console.log(`Tool count: ${tools.length}`); // 0
   * ```
   *
   * @example
   * ```typescript
   * // Timeout handling (15 second limit)
   * const slowConfig: MCPStdioServerConfig = {
   *   command: 'slow-mcp-server',
   *   args: ['--delay', '30000']  // 30 second delay
   * };
   *
   * try {
   *   const tools = await this.fetchToolsFromStdioServer(slowConfig);
   * } catch (error) {
   *   console.error('Error:', error.message);
   *   // Error: Timeout fetching tools from MCP server
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Invalid config type handling
   * const sdkConfig = { type: 'sdk', name: 'my-server' } as MCPServerConfig;
   *
   * try {
   *   const tools = await this.fetchToolsFromStdioServer(sdkConfig);
   * } catch (error) {
   *   console.error('Error:', error.message);
   *   // Error: Not a stdio server
   * }
   * ```
   *
   * @example
   * ```typescript
   * // MCP protocol flow visualization
   * // Client (this method)          Server Process
   * //    |                               |
   * //    |-- initialize request -------->|
   * //    |  (id: 1, protocol version)    |
   * //    |                               |
   * //    |<-- initialize response -------|
   * //    |  (id: 1, capabilities)        |
   * //    |                               |
   * //    |-- tools/list request -------->|
   * //    |  (id: 2)                      |
   * //    |                               |
   * //    |<-- tools/list response -------|
   * //    |  (id: 2, tools: [...])        |
   * //    |                               |
   * //    |-- SIGTERM (cleanup) --------->|
   * //    |                               X
   * ```
   *
   * @private
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
   * Fetch tools from in-process SDK MCP server
   *
   * @description
   * Retrieves tool metadata from an in-process SDK MCP server instance by directly
   * calling its listTools() method. This is significantly faster than stdio servers
   * as it avoids process spawning and JSON-RPC protocol overhead.
   *
   * The retrieval process:
   * 1. Validates config is an SDK server configuration
   * 2. Retrieves server instance from internal registry (sdkServers Map)
   * 3. Validates instance implements required listTools() method
   * 4. Calls instance.listTools() to get tool metadata
   * 5. Normalizes tool objects into consistent MCPTool[] format
   * 6. Returns tools array
   *
   * SDK Server Requirements:
   * - Must be registered via registerSdkServer() before calling this method
   * - Must implement listTools() method that returns Promise<Tool[]>
   * - Each tool must have: name, description, inputSchema properties
   *
   * This method is synchronous (no I/O or process spawning) and executes in-process,
   * making it ideal for:
   * - High-frequency tool queries
   * - Low-latency requirements
   * - Custom TypeScript/JavaScript MCP servers
   * - Development and testing scenarios
   *
   * Error Handling:
   * - Throws if config is not SDK type
   * - Throws if server instance not registered
   * - Throws if instance doesn't implement listTools()
   * - Re-throws any errors from instance.listTools() call
   *
   * @param config - MCP SDK server configuration (must have type 'sdk' and name property)
   *
   * @returns Promise resolving to array of MCPTool objects with name, description,
   *          and inputSchema properties
   *
   * @throws Error if config is not an SDK server configuration
   * @throws Error if server instance not registered (need to call registerSdkServer first)
   * @throws Error if server instance doesn't implement listTools() method
   * @throws Error propagated from instance.listTools() if that method fails
   *
   * @example
   * ```typescript
   * // Basic SDK server tool fetching
   * const myServer = new MyMCPServer();
   * mcpService.registerSdkServer('my-server', myServer);
   *
   * const config = { type: 'sdk', name: 'my-server' } as MCPServerConfig;
   * const tools = await this.fetchToolsFromSdkServer(config);
   *
   * console.log(`Found ${tools.length} tools`);
   * tools.forEach(tool => {
   *   console.log(`- ${tool.name}: ${tool.description}`);
   * });
   *
   * // Output:
   * // Found 2 tools
   * // - search: Search through documents
   * // - summarize: Generate summaries
   * ```
   *
   * @example
   * ```typescript
   * // Error: Unregistered server
   * const config = { type: 'sdk', name: 'unregistered' } as MCPServerConfig;
   *
   * try {
   *   const tools = await this.fetchToolsFromSdkServer(config);
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: SDK server "unregistered" not registered
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error: Invalid interface (missing listTools)
   * const invalidServer = { someMethod: () => {} };
   * mcpService.registerSdkServer('invalid', invalidServer);
   *
   * const config = { type: 'sdk', name: 'invalid' } as MCPServerConfig;
   *
   * try {
   *   const tools = await this.fetchToolsFromSdkServer(config);
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: SDK server does not implement listTools() method
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error: Wrong config type
   * const stdioConfig: MCPStdioServerConfig = {
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
   * };
   *
   * try {
   *   const tools = await this.fetchToolsFromSdkServer(stdioConfig);
   * } catch (error) {
   *   console.error(error.message);
   *   // Output: Not an SDK server
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Complete workflow: register, fetch, and use tools
   * import { MyCustomMCPServer } from './my-mcp-server.js';
   *
   * // 1. Create and register server instance
   * const server = new MyCustomMCPServer({ apiKey: process.env.API_KEY });
   * mcpService.registerSdkServer('custom', server);
   *
   * // 2. Fetch tools
   * const config = { type: 'sdk', name: 'custom' } as MCPServerConfig;
   * const tools = await this.fetchToolsFromSdkServer(config);
   *
   * // 3. Use tool metadata
   * console.log('Available tools:');
   * for (const tool of tools) {
   *   console.log(`\n${tool.name}`);
   *   console.log(`Description: ${tool.description}`);
   *   console.log(`Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}`);
   * }
   * ```
   *
   * @private
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
   * Sync MCP servers to .mcp.json configuration file
   *
   * @description
   * Converts MCP server data from Strapi database format to SDK-aligned .mcp.json format
   * and writes it to disk. This enables bidirectional synchronization between the Strapi
   * CMS and the project's MCP configuration file used by Claude Agent SDK.
   *
   * This method is typically called when:
   * - Syncing MCP servers from Strapi database to local project
   * - Exporting server configurations for use by Claude SDK
   * - Updating .mcp.json after bulk edits in Strapi UI
   * - Migrating server configurations across environments
   *
   * Conversion Process:
   * 1. Accepts servers in Strapi format (flat structure with transport field)
   * 2. Filters out disabled servers (disabled servers excluded from .mcp.json)
   * 3. Transforms each server to SDK format:
   *    - Creates key-value structure (server name as key)
   *    - Removes Strapi-specific fields (disabled, transport if stdio)
   *    - Preserves command, args, env for stdio servers
   *    - Adds type field for non-stdio transports (sdk, sse, http)
   * 4. Writes complete MCPConfig to .mcp.json at project root
   * 5. Overwrites existing file completely (not a merge)
   *
   * Format Transformation:
   * ```
   * Input (Strapi format):
   * [
   *   { name: "filesystem", command: "npx", args: [...], env: {...}, disabled: false, transport: "stdio" }
   * ]
   *
   * Output (.mcp.json SDK format):
   * {
   *   "mcpServers": {
   *     "filesystem": {
   *       "command": "npx",
   *       "args": [...],
   *       "env": {...}
   *     }
   *   }
   * }
   * ```
   *
   * Important Notes:
   * - Disabled servers are completely excluded from .mcp.json (SDK only loads enabled servers)
   * - This is a full replacement operation (existing .mcp.json content is overwritten)
   * - For stdio transport, the 'type' field is omitted (stdio is default)
   * - For other transports (sdk, sse, http), the 'type' field is included
   * - Environment variables in env field should use ${VAR_NAME} syntax for substitution
   *
   * @param servers - Array of MCP server objects in Strapi format with name, command,
   *                  args, env, disabled, and transport fields
   * @param projectPath - Absolute path to project directory where .mcp.json will be written.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise that resolves when .mcp.json file is successfully written
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Sync servers from Strapi to .mcp.json
   * const strapiServers = [
   *   {
   *     name: 'filesystem',
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *     env: { DEBUG: 'true' },
   *     disabled: false,
   *     transport: 'stdio'
   *   },
   *   {
   *     name: 'github',
   *     command: 'npx',
   *     args: ['-y', '@modelcontextprotocol/server-github'],
   *     env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
   *     disabled: true,  // This server will be excluded
   *     transport: 'stdio'
   *   }
   * ];
   *
   * await mcpService.syncToMcpJson(strapiServers, '/path/to/project');
   *
   * // Result: .mcp.json contains only the 'filesystem' server (github excluded as disabled)
   * ```
   *
   * @example
   * ```typescript
   * // Sync from Strapi database
   * const strapiClient = new StrapiClient();
   * const dbServers = await strapiClient.getAllMCPServers();
   *
   * // Transform Strapi response to sync format
   * const serversToSync = dbServers.map(server => ({
   *   name: server.name,
   *   command: server.command,
   *   args: server.args,
   *   env: server.env,
   *   disabled: !server.enabled,  // Strapi uses 'enabled', sync expects 'disabled'
   *   transport: server.transport || 'stdio'
   * }));
   *
   * await mcpService.syncToMcpJson(serversToSync);
   * console.log('Synced MCP servers from Strapi to .mcp.json');
   * ```
   *
   * @example
   * ```typescript
   * // Sync SDK server (includes type field)
   * const sdkServers = [
   *   {
   *     name: 'my-sdk-server',
   *     command: '',  // Not used for SDK servers
   *     transport: 'sdk'
   *   }
   * ];
   *
   * await mcpService.syncToMcpJson(sdkServers);
   *
   * // Result in .mcp.json:
   * // {
   * //   "mcpServers": {
   * //     "my-sdk-server": {
   * //       "type": "sdk",
   * //       "command": "",
   * //       "args": [],
   * //       "env": {}
   * //     }
   * //   }
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Complete bidirectional sync workflow
   * const mcpService = new MCPService();
   * const strapiClient = new StrapiClient();
   *
   * // 1. Fetch from Strapi
   * const dbServers = await strapiClient.getAllMCPServers();
   *
   * // 2. Convert to sync format
   * const serversToSync = dbServers
   *   .filter(s => s.enabled)  // Only sync enabled servers
   *   .map(s => ({
   *     name: s.name,
   *     command: s.command,
   *     args: s.args,
   *     env: s.env,
   *     disabled: false,
   *     transport: s.transport || 'stdio'
   *   }));
   *
   * // 3. Sync to .mcp.json
   * await mcpService.syncToMcpJson(serversToSync);
   *
   * console.log(`Synced ${serversToSync.length} servers to .mcp.json`);
   * ```
   *
   * @example
   * ```typescript
   * // Empty sync (clears all servers from .mcp.json)
   * await mcpService.syncToMcpJson([]);
   *
   * // Result: .mcp.json contains { "mcpServers": {} }
   * ```
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
   * Sync MCP servers from .mcp.json configuration file to Strapi format
   *
   * @description
   * Reads the project's .mcp.json file and converts server configurations from SDK format
   * to Strapi database format. This enables bidirectional synchronization by allowing
   * changes made directly to .mcp.json to be imported back into the Strapi CMS.
   *
   * This method is typically called when:
   * - Importing MCP servers from .mcp.json into Strapi database
   * - Syncing manual changes made to .mcp.json back to CMS
   * - Bootstrapping Strapi database from existing project configuration
   * - Detecting and reconciling configuration drift between file and database
   *
   * Conversion Process:
   * 1. Reads .mcp.json from project root with environment variable substitution
   * 2. Extracts mcpServers object (key-value pairs)
   * 3. Transforms each server to Strapi format:
   *    - Extracts server name from object key
   *    - Normalizes command, args, env fields
   *    - Extracts disabled flag (defaults to false if not set)
   *    - Determines transport type from 'type' field (defaults to 'stdio')
   * 4. Returns array of server objects ready for Strapi database insertion
   * 5. Currently only processes stdio servers (SDK servers filtered out)
   *
   * Format Transformation:
   * ```
   * Input (.mcp.json SDK format):
   * {
   *   "mcpServers": {
   *     "filesystem": {
   *       "command": "npx",
   *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
   *       "env": { "DEBUG": "true" },
   *       "disabled": false
   *     }
   *   }
   * }
   *
   * Output (Strapi format):
   * [
   *   {
   *     name: "filesystem",
   *     command: "npx",
   *     args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
   *     env: { DEBUG: "true" },
   *     disabled: false,
   *     transport: "stdio"
   *   }
   * ]
   * ```
   *
   * Important Notes:
   * - Only stdio servers are currently processed (SDK servers skipped in transformation)
   * - Environment variables are already substituted during config read
   * - Returns empty array if .mcp.json doesn't exist or has no servers
   * - Disabled servers are included in output (Strapi stores all servers, enabled and disabled)
   * - The 'disabled' field defaults to false if not present in config
   * - The 'transport' field defaults to 'stdio' if not explicitly set
   *
   * @param projectPath - Absolute path to project directory containing .mcp.json.
   *                      Defaults to process.cwd() if not provided.
   *
   * @returns Promise resolving to array of server objects in Strapi format:
   *          - name: Server identifier (from config key)
   *          - command: Executable command for stdio servers
   *          - args: Array of command arguments
   *          - env: Environment variables object
   *          - disabled: Whether server is disabled
   *          - transport: Transport type ('stdio', 'sdk', etc.)
   *          Returns empty array if no .mcp.json exists or no stdio servers found.
   *
   * @example
   * ```typescript
   * const mcpService = new MCPService();
   *
   * // Read servers from .mcp.json
   * const servers = await mcpService.syncFromMcpJson('/path/to/project');
   *
   * console.log(`Found ${servers.length} servers in .mcp.json:`);
   * servers.forEach(server => {
   *   console.log(`- ${server.name} (${server.transport})${server.disabled ? ' [disabled]' : ''}`);
   * });
   *
   * // Output:
   * // Found 2 servers in .mcp.json:
   * // - filesystem (stdio)
   * // - github (stdio) [disabled]
   * ```
   *
   * @example
   * ```typescript
   * // Sync from .mcp.json to Strapi database
   * const mcpService = new MCPService();
   * const strapiClient = new StrapiClient();
   *
   * // 1. Read from .mcp.json
   * const serversFromFile = await mcpService.syncFromMcpJson();
   *
   * // 2. Upsert each server to Strapi
   * for (const server of serversFromFile) {
   *   const existing = await strapiClient.findMCPServerByName(server.name);
   *
   *   if (existing) {
   *     await strapiClient.updateMCPServer(existing.id, {
   *       command: server.command,
   *       args: server.args,
   *       env: server.env,
   *       enabled: !server.disabled,
   *       transport: server.transport
   *     });
   *   } else {
   *     await strapiClient.createMCPServer({
   *       name: server.name,
   *       command: server.command,
   *       args: server.args,
   *       env: server.env,
   *       enabled: !server.disabled,
   *       transport: server.transport
   *     });
   *   }
   * }
   *
   * console.log(`Synced ${serversFromFile.length} servers to Strapi`);
   * ```
   *
   * @example
   * ```typescript
   * // Detect configuration drift
   * const serversFromFile = await mcpService.syncFromMcpJson();
   * const serversFromDB = await strapiClient.getAllMCPServers();
   *
   * const fileNames = new Set(serversFromFile.map(s => s.name));
   * const dbNames = new Set(serversFromDB.map(s => s.name));
   *
   * // Find servers only in file
   * const onlyInFile = serversFromFile.filter(s => !dbNames.has(s.name));
   * console.log('Only in .mcp.json:', onlyInFile.map(s => s.name));
   *
   * // Find servers only in database
   * const onlyInDB = serversFromDB.filter(s => !fileNames.has(s.name));
   * console.log('Only in Strapi:', onlyInDB.map(s => s.name));
   * ```
   *
   * @example
   * ```typescript
   * // Handle missing .mcp.json
   * const servers = await mcpService.syncFromMcpJson('/nonexistent/path');
   * console.log(servers); // []
   * console.log(`Found ${servers.length} servers`); // Found 0 servers
   * ```
   *
   * @example
   * ```typescript
   * // Complete bidirectional sync: file → Strapi → file
   * const mcpService = new MCPService();
   * const strapiClient = new StrapiClient();
   *
   * // 1. Import from .mcp.json to Strapi
   * const importedServers = await mcpService.syncFromMcpJson();
   * for (const server of importedServers) {
   *   await strapiClient.upsertMCPServer(server);
   * }
   * console.log(`Imported ${importedServers.length} servers to Strapi`);
   *
   * // 2. Make changes in Strapi UI...
   * // (user edits servers via Strapi CMS)
   *
   * // 3. Export from Strapi back to .mcp.json
   * const dbServers = await strapiClient.getAllMCPServers();
   * const serversToExport = dbServers.map(s => ({
   *   name: s.name,
   *   command: s.command,
   *   args: s.args,
   *   env: s.env,
   *   disabled: !s.enabled,
   *   transport: s.transport || 'stdio'
   * }));
   * await mcpService.syncToMcpJson(serversToExport);
   * console.log(`Exported ${serversToExport.length} servers to .mcp.json`);
   * ```
   *
   * @example
   * ```typescript
   * // Filter and transform before syncing to Strapi
   * const servers = await mcpService.syncFromMcpJson();
   *
   * // Only sync enabled servers
   * const enabledServers = servers.filter(s => !s.disabled);
   *
   * // Transform to Strapi create format
   * const strapiData = enabledServers.map(s => ({
   *   name: s.name,
   *   command: s.command,
   *   args: s.args,
   *   env: s.env,
   *   enabled: true,
   *   transport: s.transport,
   *   description: `Imported from .mcp.json`
   * }));
   *
   * // Bulk create in Strapi
   * await Promise.all(strapiData.map(data => strapiClient.createMCPServer(data)));
   * ```
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
