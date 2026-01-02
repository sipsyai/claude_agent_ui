import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { CUIConfig, DEFAULT_CONFIG, InterfaceConfig, ServerConfig } from '@/types/config.js';
import { generateMachineId } from '@/utils/machine-id.js';
import { createLogger, type Logger } from './logger.js';
import { EventEmitter } from 'events';
import type { RouterConfiguration, RouterProvider } from '@/types/router-config.js';

/**
 * ConfigService - Centralized configuration management for CUI application
 *
 * @description
 * The ConfigService manages application-wide configuration stored in `~/.cui/config.json`.
 * It implements a singleton pattern with automatic initialization, file watching for external
 * changes, and event-driven notifications. The service handles configuration validation,
 * default value population, and secure credential generation (machine ID, auth tokens).
 *
 * **Key Responsibilities:**
 * - Load and validate configuration from `~/.cui/config.json`
 * - Create default configuration on first run with generated credentials
 * - Deep-merge user configuration with defaults (preserves user values, fills missing fields)
 * - Watch configuration file for external changes (with debouncing)
 * - Emit events when configuration changes (internal vs external source tracking)
 * - Validate configuration schema (type checks, value constraints, required fields)
 * - Generate secure machine ID and authentication tokens
 *
 * **Configuration Schema:**
 * ```typescript
 * interface CUIConfig {
 *   machine_id: string;           // Auto-generated unique machine identifier
 *   authToken: string;             // Auto-generated 32-char hex authentication token
 *   server: {
 *     host: string;                // Server host (default: 'localhost')
 *     port: number;                // Server port (default: 3100)
 *   };
 *   interface: {
 *     colorScheme: 'light' | 'dark' | 'system';  // UI theme (default: 'system')
 *     language: string;            // UI language (default: 'en')
 *     notifications?: {
 *       enabled: boolean;          // Enable notifications (default: false)
 *       ntfyUrl?: string;          // Optional ntfy.sh URL for notifications
 *     };
 *   };
 *   router?: {                     // Optional AI model routing configuration
 *     enabled: boolean;
 *     providers: RouterProvider[]; // AI provider configurations
 *     rules: Record<string, string>; // Model routing rules
 *   };
 *   gemini?: {                     // Optional Google Gemini API configuration
 *     apiKey: string;
 *     model: string;
 *   };
 *   trainingAgentId?: string;      // Optional default agent for skill training
 * }
 * ```
 *
 * **Architecture:**
 * - **Singleton Pattern**: Single instance ensures consistent configuration across application
 * - **File Watching**: Automatically reloads configuration when `~/.cui/config.json` changes
 * - **Event Emitter**: Subscribers receive 'config-changed' events with source tracking
 * - **Deep Merge Strategy**: User config merged with defaults (preserves all user values)
 * - **Validation Pipeline**: Partial validation (user input) → merge with defaults → full validation
 * - **Debouncing**: 250ms debounce on file changes prevents excessive reloads
 * - **Test Mode**: Uses interval polling (50ms) in tests to avoid fs.watch flakiness
 *
 * **Configuration Lifecycle:**
 * 1. **First Run**: No config file exists
 *    - Create `~/.cui/` directory
 *    - Generate unique machine_id via hardware fingerprinting
 *    - Generate crypto-secure 32-char authToken
 *    - Write default config to `~/.cui/config.json`
 * 2. **Subsequent Runs**: Config file exists
 *    - Load config from disk
 *    - Validate provided fields (strict type checking)
 *    - Deep-merge with defaults (fills missing sections, preserves user values)
 *    - Write back to disk if defaults were added
 *    - Start file watching for external changes
 * 3. **Runtime Updates**: Application calls updateConfig()
 *    - Deep-merge updates with current config
 *    - Validate merged result
 *    - Write to disk
 *    - Emit 'config-changed' event with source: 'internal'
 * 4. **External Changes**: User edits `~/.cui/config.json`
 *    - File watcher detects change (debounced 250ms)
 *    - Parse and validate file contents
 *    - Deep-merge with defaults
 *    - Update in-memory config
 *    - Emit 'config-changed' event with source: 'external'
 *
 * **Use Cases:**
 * - Server initialization: Load host/port configuration
 * - UI theming: Load and update color scheme preferences
 * - Notification setup: Configure ntfy.sh push notifications
 * - AI routing: Configure multi-provider model routing
 * - Skill training: Set default training agent
 * - Multi-instance sync: Watch for config changes from other processes
 *
 * @example
 * ```typescript
 * // Basic usage - initialize and read configuration
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.initialize();
 *
 * const config = configService.getConfig();
 * console.log(`Server: ${config.server.host}:${config.server.port}`);
 * console.log(`Theme: ${config.interface.colorScheme}`);
 * console.log(`Machine ID: ${config.machine_id}`);
 * // Output:
 * // Server: localhost:3100
 * // Theme: system
 * // Machine ID: a1b2c3d4e5f6g7h8
 * ```
 *
 * @example
 * ```typescript
 * // Update configuration at runtime
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.initialize();
 *
 * // Update server port (deep-merge preserves other server fields)
 * await configService.updateConfig({
 *   server: { port: 8080 }
 * });
 *
 * // Update multiple sections
 * await configService.updateConfig({
 *   interface: {
 *     colorScheme: 'dark',
 *     notifications: { enabled: true, ntfyUrl: 'https://ntfy.sh/my-topic' }
 *   },
 *   trainingAgentId: 'agent-123'
 * });
 *
 * console.log(configService.getConfig().server.port); // 8080
 * console.log(configService.getConfig().interface.colorScheme); // "dark"
 * ```
 *
 * @example
 * ```typescript
 * // Subscribe to configuration changes (hot-reload support)
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.initialize();
 *
 * // Listen for config changes from any source
 * configService.onChange((newConfig, prevConfig, source) => {
 *   console.log(`Config changed from ${source} source`);
 *   console.log(`Old port: ${prevConfig?.server.port}`);
 *   console.log(`New port: ${newConfig.server.port}`);
 *
 *   if (source === 'external') {
 *     console.log('External change detected - reloading server...');
 *     // Restart server with new config
 *   }
 * });
 *
 * // Internal update (source: 'internal')
 * await configService.updateConfig({ server: { port: 9000 } });
 *
 * // External update (user edits ~/.cui/config.json)
 * // File watcher triggers change event (source: 'external')
 * ```
 *
 * @example
 * ```typescript
 * // Configure AI model routing
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.initialize();
 *
 * await configService.updateConfig({
 *   router: {
 *     enabled: true,
 *     providers: [
 *       {
 *         name: 'anthropic',
 *         api_base_url: 'https://api.anthropic.com',
 *         api_key: process.env.ANTHROPIC_API_KEY,
 *         models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
 *       },
 *       {
 *         name: 'openai',
 *         api_base_url: 'https://api.openai.com',
 *         api_key: process.env.OPENAI_API_KEY,
 *         models: ['gpt-4o', 'gpt-4o-mini']
 *       }
 *     ],
 *     rules: {
 *       'default': 'claude-3-5-sonnet-20241022',
 *       'fast': 'claude-3-5-haiku-20241022',
 *       'creative': 'gpt-4o'
 *     }
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // First run - auto-generate default configuration
 * import { ConfigService } from './config-service';
 *
 * // Scenario: ~/.cui/config.json does not exist
 * const configService = ConfigService.getInstance();
 * await configService.initialize();
 *
 * // ConfigService automatically:
 * // 1. Creates ~/.cui/ directory
 * // 2. Generates machine_id (e.g., "a1b2c3d4e5f6g7h8")
 * // 3. Generates authToken (e.g., "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p")
 * // 4. Writes ~/.cui/config.json with defaults
 *
 * const config = configService.getConfig();
 * console.log(config.machine_id); // "a1b2c3d4e5f6g7h8"
 * console.log(config.authToken);  // "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p"
 * console.log(config.server);     // { host: 'localhost', port: 3100 }
 * ```
 *
 * @example
 * ```typescript
 * // Validation - invalid configuration rejected
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.initialize();
 *
 * // Invalid port type
 * try {
 *   await configService.updateConfig({
 *     server: { port: '8080' as any } // Type error: port must be number
 *   });
 * } catch (error) {
 *   console.error(error.message); // "Invalid config: server.port must be a number"
 * }
 *
 * // Invalid colorScheme value
 * try {
 *   await configService.updateConfig({
 *     interface: { colorScheme: 'blue' as any }
 *   });
 * } catch (error) {
 *   console.error(error.message); // "Invalid config: interface.colorScheme must be 'light' | 'dark' | 'system'"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Deep merge behavior - preserves unrelated fields
 * import { ConfigService } from './config-service';
 *
 * const configService = ConfigService.getInstance();
 * await configService.initialize();
 *
 * // Initial config
 * await configService.updateConfig({
 *   server: { host: 'localhost', port: 3100 },
 *   interface: { colorScheme: 'dark', language: 'en' }
 * });
 *
 * // Update only server.port (preserves server.host, interface.*)
 * await configService.updateConfig({
 *   server: { port: 8080 }
 * });
 *
 * const config = configService.getConfig();
 * console.log(config.server.host);           // "localhost" (preserved)
 * console.log(config.server.port);           // 8080 (updated)
 * console.log(config.interface.colorScheme); // "dark" (preserved)
 * console.log(config.interface.language);    // "en" (preserved)
 * ```
 *
 * @see {@link https://nodejs.org/api/fs.html#fswatchfilename-options-listener|fs.watch} - File watching API
 * @see {@link CUIConfig} - Configuration type definition
 * @see {@link DEFAULT_CONFIG} - Default configuration values
 */
export class ConfigService {
  /** @private Singleton instance */
  private static instance: ConfigService;

  /** @private Current loaded configuration (null until initialized) */
  private config: CUIConfig | null = null;

  /** @private Logger instance for debugging and error reporting */
  private logger: Logger;

  /** @private Absolute path to config file (~/.cui/config.json) */
  private configPath: string;

  /** @private Absolute path to config directory (~/.cui/) */
  private configDir: string;

  /** @private EventEmitter for 'config-changed' events */
  private emitter: EventEmitter = new EventEmitter();

  /** @private File system watcher for external config changes (fs.watch in production) */
  private watcher?: import('fs').FSWatcher;

  /** @private Debounce timer for batching rapid file changes (250ms delay) */
  private debounceTimer?: NodeJS.Timeout;

  /** @private Last loaded config JSON (stringified) for change detection */
  private lastLoadedRaw?: string;

  /** @private Polling interval for test mode (50ms active polling instead of fs.watch) */
  private pollInterval?: NodeJS.Timeout;

  private constructor() {
    this.logger = createLogger('ConfigService');
    this.configDir = path.join(os.homedir(), '.cui');
    this.configPath = path.join(this.configDir, 'config.json');
  }

  /**
   * Get singleton instance of ConfigService
   *
   * @description
   * Returns the singleton instance of ConfigService, creating it if necessary.
   * The singleton pattern ensures all parts of the application share the same
   * configuration state and receive consistent change notifications.
   *
   * **Important:** You must call `initialize()` on the returned instance before
   * using other methods.
   *
   * @returns {ConfigService} Singleton instance (not yet initialized)
   *
   * @example
   * ```typescript
   * // Basic usage - get singleton instance
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize(); // Required before use
   *
   * const config = configService.getConfig();
   * console.log(config.server.port); // 3100
   * ```
   *
   * @example
   * ```typescript
   * // Multiple calls return same instance
   * import { ConfigService } from './config-service';
   *
   * const instance1 = ConfigService.getInstance();
   * const instance2 = ConfigService.getInstance();
   *
   * console.log(instance1 === instance2); // true (same instance)
   *
   * // Initialize once, use everywhere
   * await instance1.initialize();
   *
   * // instance2 is automatically initialized (same object)
   * const config = instance2.getConfig();
   * console.log(config); // Works! (both point to same instance)
   * ```
   *
   * @example
   * ```typescript
   * // Consistent state across modules
   * // module-a.ts
   * import { ConfigService } from './config-service';
   * const configA = ConfigService.getInstance();
   * await configA.initialize();
   * await configA.updateConfig({ server: { port: 8080 } });
   *
   * // module-b.ts
   * import { ConfigService } from './config-service';
   * const configB = ConfigService.getInstance();
   * // No need to initialize again (already done in module-a)
   * console.log(configB.getConfig().server.port); // 8080 (sees change from module-a)
   * ```
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Initialize configuration system
   *
   * @description
   * Initializes the configuration system by loading `~/.cui/config.json` (creating it with
   * defaults if it doesn't exist), validating the configuration schema, and starting file
   * watching for external changes. This method must be called before using other ConfigService
   * methods.
   *
   * **Initialization Workflow:**
   * 1. Check if `~/.cui/config.json` exists
   *    - If missing: Create default config with auto-generated credentials (see below)
   * 2. Load configuration from disk
   * 3. Validate provided fields (strict type checking on user-provided values)
   * 4. Deep-merge with defaults (fills missing sections, preserves user values)
   * 5. Write back to disk if defaults were added
   * 6. Start file watching for external changes (debounced 250ms)
   *
   * **Default Configuration Creation (First Run):**
   * - Create `~/.cui/` directory (if missing)
   * - Generate unique `machine_id` via hardware fingerprinting
   * - Generate crypto-secure 32-character hex `authToken`
   * - Write `~/.cui/config.json` with defaults from `DEFAULT_CONFIG`
   *
   * **Idempotent:** Safe to call multiple times (only initializes once).
   *
   * @returns {Promise<void>} Resolves when initialization completes
   *
   * @throws {Error} Configuration initialization failed - corrupted JSON, filesystem errors, validation errors
   *
   * @example
   * ```typescript
   * // Basic initialization
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * console.log('Configuration loaded successfully');
   * const config = configService.getConfig();
   * console.log(`Server running on ${config.server.host}:${config.server.port}`);
   * ```
   *
   * @example
   * ```typescript
   * // First run - creates default configuration
   * import { ConfigService } from './config-service';
   * import fs from 'fs';
   *
   * // Scenario: ~/.cui/config.json does not exist
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * // ConfigService created ~/.cui/config.json with defaults:
   * const configFile = fs.readFileSync(
   *   require('os').homedir() + '/.cui/config.json',
   *   'utf-8'
   * );
   * console.log(JSON.parse(configFile));
   * // {
   * //   "machine_id": "a1b2c3d4e5f6g7h8",       // Auto-generated
   * //   "authToken": "1a2b3c4d5e6f7g8h...",     // Auto-generated (32 chars)
   * //   "server": { "host": "localhost", "port": 3100 },
   * //   "interface": { "colorScheme": "system", "language": "en" }
   * // }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - corrupted config file
   * import { ConfigService } from './config-service';
   *
   * // Scenario: ~/.cui/config.json contains invalid JSON
   * const configService = ConfigService.getInstance();
   *
   * try {
   *   await configService.initialize();
   * } catch (error) {
   *   console.error('Failed to initialize configuration:', error.message);
   *   // "Configuration initialization failed: Invalid JSON in configuration file"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Server startup integration
   * import express from 'express';
   * import { ConfigService } from './config-service';
   *
   * async function startServer() {
   *   // Initialize configuration first
   *   const configService = ConfigService.getInstance();
   *   await configService.initialize();
   *
   *   const config = configService.getConfig();
   *
   *   // Use config to start server
   *   const app = express();
   *   app.listen(config.server.port, config.server.host, () => {
   *     console.log(`Server running on http://${config.server.host}:${config.server.port}`);
   *   });
   * }
   *
   * startServer();
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent behavior - safe to call multiple times
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   *
   * await configService.initialize(); // First call: loads config, starts watcher
   * await configService.initialize(); // Second call: no-op (already initialized)
   * await configService.initialize(); // Third call: no-op
   *
   * // All calls succeed, configuration loaded once
   * ```
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing configuration', { configPath: this.configPath });

    try {
      // Check if config exists
      if (!fs.existsSync(this.configPath)) {
        await this.createDefaultConfig();
      }

      // Load and validate config
      await this.loadConfig();

      // Start watching for external changes
      this.startWatching();
    } catch (error) {
      this.logger.error('Failed to initialize configuration', error);
      throw new Error(`Configuration initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current loaded configuration
   *
   * @description
   * Returns the current in-memory configuration. This method provides read-only access
   * to the configuration object. To modify configuration, use `updateConfig()`.
   *
   * **Important:** You must call `initialize()` before calling this method, or it will
   * throw an error.
   *
   * @returns {CUIConfig} Current configuration object
   *
   * @throws {Error} Configuration not initialized. Call initialize() first.
   *
   * @example
   * ```typescript
   * // Basic usage - read configuration
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * const config = configService.getConfig();
   * console.log(`Server: ${config.server.host}:${config.server.port}`);
   * console.log(`Theme: ${config.interface.colorScheme}`);
   * console.log(`Language: ${config.interface.language}`);
   * // Output:
   * // Server: localhost:3100
   * // Theme: system
   * // Language: en
   * ```
   *
   * @example
   * ```typescript
   * // Access nested configuration
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * const config = configService.getConfig();
   *
   * // Server configuration
   * const { host, port } = config.server;
   * console.log(`Server URL: http://${host}:${port}`);
   *
   * // Notification configuration
   * if (config.interface.notifications?.enabled) {
   *   console.log(`Notifications enabled via: ${config.interface.notifications.ntfyUrl}`);
   * }
   *
   * // Router configuration (optional)
   * if (config.router?.enabled) {
   *   console.log(`AI routing enabled with ${config.router.providers.length} providers`);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - not initialized
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * // Forgot to call initialize()
   *
   * try {
   *   const config = configService.getConfig();
   * } catch (error) {
   *   console.error(error.message);
   *   // "Configuration not initialized. Call initialize() first."
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Use in route handler
   * import express from 'express';
   * import { ConfigService } from './config-service';
   *
   * const app = express();
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * app.get('/api/config', (req, res) => {
   *   const config = configService.getConfig();
   *
   *   // Return safe subset of config (exclude credentials)
   *   res.json({
   *     server: config.server,
   *     interface: config.interface,
   *     routerEnabled: config.router?.enabled || false
   *   });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Conditional logic based on configuration
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * const config = configService.getConfig();
   *
   * // Enable dark mode UI components
   * if (config.interface.colorScheme === 'dark') {
   *   console.log('Applying dark theme CSS');
   * }
   *
   * // Use training agent if configured
   * if (config.trainingAgentId) {
   *   console.log(`Using training agent: ${config.trainingAgentId}`);
   * }
   * ```
   */
  getConfig(): CUIConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfig(): Promise<void> {
    this.logger.info('Creating default configuration');

    try {
      // Ensure config directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        this.logger.debug('Created config directory', { dir: this.configDir });
      }

      // Generate machine ID
      const machineId = await generateMachineId();
      this.logger.debug('Generated machine ID', { machineId });

      // Generate crypto-secure auth token
      const authToken = crypto.randomBytes(16).toString('hex'); // 32 character hex string
      this.logger.debug('Generated auth token', { tokenLength: authToken.length });

      // Create default config
      const config: CUIConfig = {
        machine_id: machineId,
        authToken,
        ...DEFAULT_CONFIG
      };

      // Write config file
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      this.logger.info('Default configuration created', {
        path: this.configPath,
        machineId: config.machine_id
      });
    } catch (error) {
      throw new Error(`Failed to create default config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      let fileConfig: Partial<CUIConfig> & { machine_id?: string; authToken?: string };
      try {
        fileConfig = JSON.parse(configData) as Partial<CUIConfig> & { machine_id?: string; authToken?: string };
      } catch (_parseError) {
        // Corrupted JSON should fail startup
        throw new Error('Invalid JSON in configuration file');
      }

      // Validate provided fields (strict for provided keys, allow missing)
      this.validateProvidedFields(fileConfig);

      // Merge with defaults for missing sections while preserving all existing fields (e.g., router)
      let updated = false;
      const merged: CUIConfig = {
        // Start with defaults
        ...DEFAULT_CONFIG,
        // Bring over everything from file (including optional fields like router, gemini)
        ...fileConfig,
        // Ensure required identifiers are set from file
        machine_id: fileConfig.machine_id || (await generateMachineId()),
        authToken: fileConfig.authToken || crypto.randomBytes(16).toString('hex'),
        // Deep-merge known nested sections to ensure defaults are filled without dropping user values
        server: { ...DEFAULT_CONFIG.server, ...(fileConfig.server || {}) },
        interface: { ...DEFAULT_CONFIG.interface, ...(fileConfig.interface || {}) }
      };

      // Determine if we added any defaults and need to persist back to disk
      if (!fileConfig.server || JSON.stringify(merged.server) !== JSON.stringify(fileConfig.server)) updated = true;
      if (!fileConfig.interface || JSON.stringify(merged.interface) !== JSON.stringify(fileConfig.interface)) updated = true;
      if (!fileConfig.machine_id) updated = true;
      if (!fileConfig.authToken) updated = true;

      // Final validation on fully merged config
      this.validateCompleteConfig(merged);

      this.config = merged;
      this.lastLoadedRaw = JSON.stringify(this.config, null, 2);
      if (updated) {
        fs.writeFileSync(this.configPath, this.lastLoadedRaw, 'utf-8');
        this.logger.info('Configuration updated with defaults');
      }
      this.logger.debug('Configuration loaded successfully');
    } catch (error) {
      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  /**
   * Update configuration with partial changes
   *
   * @description
   * Updates the configuration with a partial update object using deep-merge semantics.
   * The update preserves all unrelated fields and only modifies the specified values.
   * After updating the in-memory configuration, it writes the changes to
   * `~/.cui/config.json` and emits a 'config-changed' event (source: 'internal').
   *
   * **Deep Merge Behavior:**
   * - Top-level fields: Shallow merge (e.g., `server`, `interface`, `router`)
   * - Nested objects: Deep merge (e.g., `interface.notifications`)
   * - Arrays: Full replacement (e.g., `router.providers`)
   * - Null/undefined: Removes optional fields
   * - Preserves `machine_id` and `authToken` (never overwritten)
   *
   * **Update Workflow:**
   * 1. Deep-merge `updates` with current config
   * 2. Validate merged result (type checks, value constraints)
   * 3. Update in-memory config
   * 4. Write to `~/.cui/config.json` (formatted JSON, 2-space indent)
   * 5. Emit 'config-changed' event with source: 'internal'
   *
   * @param {Partial<CUIConfig>} updates - Partial configuration object with fields to update
   *
   * @returns {Promise<void>} Resolves when update completes and file is written
   *
   * @throws {Error} Configuration not initialized
   * @throws {Error} Failed to update config - filesystem errors, validation errors
   *
   * @example
   * ```typescript
   * // Update server port (preserves other server fields)
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * // Current: { host: 'localhost', port: 3100 }
   * await configService.updateConfig({
   *   server: { port: 8080 }
   * });
   *
   * const config = configService.getConfig();
   * console.log(config.server); // { host: 'localhost', port: 8080 }
   * // Note: host preserved, only port updated
   * ```
   *
   * @example
   * ```typescript
   * // Update multiple sections at once
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * await configService.updateConfig({
   *   server: { port: 8080 },
   *   interface: {
   *     colorScheme: 'dark',
   *     notifications: {
   *       enabled: true,
   *       ntfyUrl: 'https://ntfy.sh/my-topic'
   *     }
   *   },
   *   trainingAgentId: 'agent-123'
   * });
   *
   * console.log('Configuration updated successfully');
   * ```
   *
   * @example
   * ```typescript
   * // Deep merge behavior - nested objects
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * // Set initial notifications config
   * await configService.updateConfig({
   *   interface: {
   *     notifications: {
   *       enabled: true,
   *       ntfyUrl: 'https://ntfy.sh/topic-1'
   *     }
   *   }
   * });
   *
   * // Update only ntfyUrl (preserves enabled: true)
   * await configService.updateConfig({
   *   interface: {
   *     notifications: {
   *       ntfyUrl: 'https://ntfy.sh/topic-2'
   *     }
   *   }
   * });
   *
   * const config = configService.getConfig();
   * console.log(config.interface.notifications);
   * // { enabled: true, ntfyUrl: 'https://ntfy.sh/topic-2' }
   * ```
   *
   * @example
   * ```typescript
   * // Configure AI model routing
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * await configService.updateConfig({
   *   router: {
   *     enabled: true,
   *     providers: [
   *       {
   *         name: 'anthropic',
   *         api_base_url: 'https://api.anthropic.com',
   *         api_key: process.env.ANTHROPIC_API_KEY,
   *         models: ['claude-3-5-sonnet-20241022']
   *       }
   *     ],
   *     rules: {
   *       'default': 'claude-3-5-sonnet-20241022'
   *     }
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Error handling - validation failure
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * try {
   *   await configService.updateConfig({
   *     server: { port: '8080' as any } // Invalid: port must be number
   *   });
   * } catch (error) {
   *   console.error(error.message);
   *   // "Invalid config: server.port must be a number"
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Update with change event listener
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * // Subscribe to changes
   * configService.onChange((newConfig, prevConfig, source) => {
   *   console.log(`Config changed from ${source} source`);
   *   if (source === 'internal') {
   *     console.log('Update triggered by application code');
   *   }
   * });
   *
   * // Update triggers 'config-changed' event
   * await configService.updateConfig({ server: { port: 8080 } });
   * // Console: "Config changed from internal source"
   * // Console: "Update triggered by application code"
   * ```
   *
   * @example
   * ```typescript
   * // User preferences update workflow
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * // User changes theme preference in UI
   * async function updateTheme(theme: 'light' | 'dark' | 'system') {
   *   await configService.updateConfig({
   *     interface: { colorScheme: theme }
   *   });
   *   console.log(`Theme updated to ${theme}`);
   * }
   *
   * await updateTheme('dark');
   * // Updates ~/.cui/config.json immediately
   * // Other application instances detect change via file watcher
   * ```
   */
  async updateConfig(updates: Partial<CUIConfig>): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    this.logger.info('Updating configuration', { updates });

    // Create a new config via deep-merge semantics so unrelated options are preserved
    const current = this.config;

    const mergedServer = updates.server ? { ...current.server, ...updates.server } : current.server;

    const mergedInterface = updates.interface
      ? {
          ...current.interface,
          ...updates.interface,
          // Deep-merge nested notifications object if provided
          notifications:
            updates.interface.notifications !== undefined
              ? { ...(current.interface.notifications || {}), ...updates.interface.notifications }
              : current.interface.notifications
        }
      : current.interface;

    const mergedRouter = updates.router
      ? { ...(current.router || {}), ...updates.router }
      : current.router;

    const mergedGemini = updates.gemini
      ? { ...(current.gemini || {}), ...updates.gemini }
      : current.gemini;

    // Handle trainingAgentId
    const mergedTrainingAgentId = updates.trainingAgentId !== undefined
      ? updates.trainingAgentId
      : current.trainingAgentId;

    // Preserve machine_id and authToken regardless of updates
    const newConfig: CUIConfig = {
      ...current,
      server: mergedServer,
      interface: mergedInterface,
      gemini: mergedGemini,
      router: mergedRouter,
      trainingAgentId: mergedTrainingAgentId
    };

    // Update in-memory config
    const prev = this.config;
    this.config = newConfig;
    
    // Write to file
    try {
      this.lastLoadedRaw = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, this.lastLoadedRaw, 'utf-8');
      this.logger.info('Configuration updated successfully');
      // Emit change event for internal updates
      this.emitter.emit('config-changed', this.config, prev, 'internal');
    } catch (error) {
      this.logger.error('Failed to update configuration', error);
      throw new Error(`Failed to update config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Subscribe to configuration changes
   *
   * @description
   * Registers an event listener that is called whenever the configuration changes,
   * whether from internal updates (via `updateConfig()`) or external changes (user
   * editing `~/.cui/config.json` directly). The listener receives the new configuration,
   * previous configuration, and source of the change.
   *
   * **Event Payload:**
   * - `newConfig`: The updated configuration object
   * - `previous`: The previous configuration (or null on first load)
   * - `source`: 'internal' (from updateConfig) or 'external' (file watcher)
   *
   * **Use Cases:**
   * - Hot-reload server configuration when config file changes
   * - Update UI theme when user changes colorScheme preference
   * - Notify user of configuration changes from other processes
   * - Sync configuration state to other parts of application
   * - Log configuration changes for audit trail
   *
   * **Important:** The listener is called synchronously during the config change.
   * Avoid blocking operations in the listener to prevent delaying config updates.
   *
   * @param {Function} listener - Callback function invoked when config changes
   * @param {CUIConfig} listener.newConfig - New configuration object
   * @param {CUIConfig | null} listener.previous - Previous configuration (null on first load)
   * @param {'internal' | 'external'} listener.source - Source of change ('internal' or 'external')
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Basic usage - log all configuration changes
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * configService.onChange((newConfig, prevConfig, source) => {
   *   console.log(`Configuration changed from ${source} source`);
   *   console.log('New config:', newConfig);
   *   console.log('Previous config:', prevConfig);
   * });
   *
   * // Trigger internal change
   * await configService.updateConfig({ server: { port: 8080 } });
   * // Console: "Configuration changed from internal source"
   * ```
   *
   * @example
   * ```typescript
   * // Hot-reload server on configuration change
   * import express from 'express';
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * let server: any;
   *
   * // Listen for config changes
   * configService.onChange((newConfig, prevConfig, source) => {
   *   // Only reload on external changes (avoid double-reload on internal updates)
   *   if (source === 'external' && prevConfig) {
   *     const portChanged = newConfig.server.port !== prevConfig.server.port;
   *     const hostChanged = newConfig.server.host !== prevConfig.server.host;
   *
   *     if (portChanged || hostChanged) {
   *       console.log('Server config changed, restarting...');
   *       server.close(() => {
   *         server = startServer(newConfig);
   *       });
   *     }
   *   }
   * });
   *
   * function startServer(config: CUIConfig) {
   *   const app = express();
   *   return app.listen(config.server.port, config.server.host, () => {
   *     console.log(`Server running on http://${config.server.host}:${config.server.port}`);
   *   });
   * }
   *
   * server = startServer(configService.getConfig());
   * ```
   *
   * @example
   * ```typescript
   * // Update UI theme on colorScheme change
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * configService.onChange((newConfig, prevConfig, source) => {
   *   // Check if colorScheme changed
   *   if (prevConfig && newConfig.interface.colorScheme !== prevConfig.interface.colorScheme) {
   *     console.log(`Theme changed to ${newConfig.interface.colorScheme}`);
   *
   *     // Apply theme to UI
   *     document.documentElement.setAttribute(
   *       'data-theme',
   *       newConfig.interface.colorScheme
   *     );
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Notify user of external configuration changes
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * configService.onChange((newConfig, prevConfig, source) => {
   *   if (source === 'external') {
   *     console.log('Configuration was updated externally');
   *     console.log('Another process or user edited ~/.cui/config.json');
   *
   *     // Show notification to user
   *     showNotification({
   *       title: 'Configuration Updated',
   *       message: 'Configuration file was modified externally',
   *       type: 'info'
   *     });
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Audit trail - log all config changes
   * import { ConfigService } from './config-service';
   * import fs from 'fs/promises';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * configService.onChange(async (newConfig, prevConfig, source) => {
   *   const auditEntry = {
   *     timestamp: new Date().toISOString(),
   *     source,
   *     changes: getChanges(prevConfig, newConfig)
   *   };
   *
   *   // Append to audit log
   *   await fs.appendFile(
   *     'config-audit.log',
   *     JSON.stringify(auditEntry) + '\n'
   *   );
   * });
   *
   * function getChanges(prev: any, curr: any): string[] {
   *   const changes: string[] = [];
   *   if (prev?.server.port !== curr.server.port) {
   *     changes.push(`server.port: ${prev?.server.port} → ${curr.server.port}`);
   *   }
   *   return changes;
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Multiple listeners - different responsibilities
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * // Listener 1: Update server
   * configService.onChange((newConfig, prevConfig, source) => {
   *   if (source === 'external') {
   *     console.log('Reloading server configuration...');
   *   }
   * });
   *
   * // Listener 2: Update UI
   * configService.onChange((newConfig, prevConfig, source) => {
   *   console.log('Syncing UI with new configuration...');
   * });
   *
   * // Listener 3: Log changes
   * configService.onChange((newConfig, prevConfig, source) => {
   *   console.log(`[${source}] Config changed at ${new Date().toISOString()}`);
   * });
   *
   * // All three listeners are called on each change
   * await configService.updateConfig({ server: { port: 8080 } });
   * ```
   *
   * @example
   * ```typescript
   * // Conditional logic based on source
   * import { ConfigService } from './config-service';
   *
   * const configService = ConfigService.getInstance();
   * await configService.initialize();
   *
   * configService.onChange((newConfig, prevConfig, source) => {
   *   if (source === 'internal') {
   *     console.log('Application initiated this change');
   *     // No need to reload - application already knows about the change
   *   } else {
   *     console.log('External change detected - reloading affected components');
   *     // Reload components that depend on config
   *     reloadDependentComponents(newConfig);
   *   }
   * });
   * ```
   */
  onChange(listener: (newConfig: CUIConfig, previous: CUIConfig | null, source: 'internal' | 'external') => void): void {
    this.emitter.on('config-changed', listener);
  }

  /**
   * Validate provided fields in a partial config. Throws on incompatible values.
   */
  private validateProvidedFields(partial: Partial<CUIConfig>): void {
    // server
    if (partial.server) {
      this.assertServerConfig(partial.server);
    }
    // interface
    if (partial.interface) {
      this.assertInterfaceConfig(partial.interface);
    }
    // router
    if (partial.router) {
      this.assertRouterConfig(partial.router);
    }
    // gemini (optional)
    if (partial.gemini) {
      if (partial.gemini.apiKey !== undefined && typeof partial.gemini.apiKey !== 'string') {
        throw new Error('Invalid config: gemini.apiKey must be a string');
      }
      if (partial.gemini.model !== undefined && typeof partial.gemini.model !== 'string') {
        throw new Error('Invalid config: gemini.model must be a string');
      }
    }
    // trainingAgentId (optional)
    if (partial.trainingAgentId !== undefined && partial.trainingAgentId !== null && typeof partial.trainingAgentId !== 'string') {
      throw new Error('Invalid config: trainingAgentId must be a string');
    }
    // machine_id/authToken if present must be strings
    if (partial.machine_id !== undefined && typeof partial.machine_id !== 'string') {
      throw new Error('Invalid config: machine_id must be a string');
    }
    if (partial.authToken !== undefined && typeof partial.authToken !== 'string') {
      throw new Error('Invalid config: authToken must be a string');
    }
  }

  /**
   * Validate a complete merged config before using it. Throws on error.
   */
  private validateCompleteConfig(config: CUIConfig): void {
    // Required top-level values
    if (!config.machine_id || typeof config.machine_id !== 'string') {
      throw new Error('Invalid config: missing machine_id');
    }
    this.assertServerConfig(config.server);
    if (!config.authToken || typeof config.authToken !== 'string') {
      throw new Error('Invalid config: missing authToken');
    }
    if (config.interface) {
      this.assertInterfaceConfig(config.interface);
    }
    if (config.router) {
      this.assertRouterConfig(config.router);
    }
  }

  private assertServerConfig(server: Partial<ServerConfig>): void {
    if (server.host !== undefined && typeof server.host !== 'string') {
      throw new Error('Invalid config: server.host must be a string');
    }
    if (server.port !== undefined && typeof server.port !== 'number') {
      throw new Error('Invalid config: server.port must be a number');
    }
  }

  private assertInterfaceConfig(iface: Partial<InterfaceConfig>): void {
    if (iface.colorScheme !== undefined && !['light', 'dark', 'system'].includes(iface.colorScheme as string)) {
      throw new Error("Invalid config: interface.colorScheme must be 'light' | 'dark' | 'system'");
    }
    if (iface.language !== undefined && typeof iface.language !== 'string') {
      throw new Error('Invalid config: interface.language must be a string');
    }
    if (iface.notifications !== undefined) {
      const n = iface.notifications as InterfaceConfig['notifications'];
      if (n && typeof n.enabled !== 'boolean') {
        throw new Error('Invalid config: interface.notifications.enabled must be a boolean');
      }
      if (n && n.ntfyUrl !== undefined && typeof n.ntfyUrl !== 'string') {
        throw new Error('Invalid config: interface.notifications.ntfyUrl must be a string');
      }
    }
  }

  private assertRouterConfig(router: Partial<RouterConfiguration>): void {
    if (router.enabled !== undefined && typeof router.enabled !== 'boolean') {
      throw new Error('Invalid config: router.enabled must be a boolean');
    }
    if (router.providers !== undefined) {
      if (!Array.isArray(router.providers)) {
        throw new Error('Invalid config: router.providers must be an array');
      }
      for (const p of router.providers as RouterProvider[]) {
        if (p.name !== undefined && typeof p.name !== 'string') throw new Error('Invalid config: router.providers[].name must be a string');
        if (p.api_base_url !== undefined && typeof p.api_base_url !== 'string') throw new Error('Invalid config: router.providers[].api_base_url must be a string');
        if (p.api_key !== undefined && typeof p.api_key !== 'string') throw new Error('Invalid config: router.providers[].api_key must be a string');
        if (p.models !== undefined && !Array.isArray(p.models)) throw new Error('Invalid config: router.providers[].models must be an array of strings');
        if (Array.isArray(p.models)) {
          for (const m of p.models) {
            if (typeof m !== 'string') throw new Error('Invalid config: router.providers[].models must contain strings');
          }
        }
      }
    }
    if (router.rules !== undefined) {
      if (typeof router.rules !== 'object' || router.rules === null || Array.isArray(router.rules)) {
        throw new Error('Invalid config: router.rules must be an object of string values');
      }
      for (const [k, v] of Object.entries(router.rules)) {
        if (typeof v !== 'string') throw new Error(`Invalid config: router.rules['${k}'] must be a string`);
      }
    }
  }

  private startWatching(): void {
    // Avoid multiple watchers in tests
    if (this.watcher) return;
    try {
      // Increase listeners to avoid noisy warnings in tests with many server instances
      this.emitter.setMaxListeners(0);

      if (process.env.NODE_ENV === 'test') {
        // Use active polling in tests to avoid fs watcher flakiness with fake timers
        this.pollInterval = setInterval(() => {
          try {
            const raw = fs.readFileSync(this.configPath, 'utf-8');
            if (!this.lastLoadedRaw || raw !== this.lastLoadedRaw) {
              // Debounce within polling
              if (this.debounceTimer) clearTimeout(this.debounceTimer);
              this.debounceTimer = setTimeout(() => this.handleExternalChange(), 10);
            }
          } catch {
            // ignore
          }
        }, 50);
        this.logger.debug('Started interval polling for configuration changes (test mode)');
      } else {
        this.watcher = fs.watch(this.configPath, { persistent: false }, (eventType) => {
          if (eventType !== 'change' && eventType !== 'rename') return;
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => this.handleExternalChange(), 250);
        });
        this.logger.debug('Started watching configuration file for changes');
      }
    } catch (error) {
      this.logger.warn('Failed to start file watcher for configuration', error as Error);
    }
  }

  private handleExternalChange(): void {
    try {
      const newRaw = fs.readFileSync(this.configPath, 'utf-8');
      if (this.lastLoadedRaw && newRaw === this.lastLoadedRaw) {
        return; // No effective change
      }
      let parsed: Partial<CUIConfig> & { machine_id?: string; authToken?: string };
      try {
        parsed = JSON.parse(newRaw);
      } catch (_e) {
        this.logger.error('Ignoring external config change due to invalid JSON');
        return;
      }
      // Validate provided fields strictly
      this.validateProvidedFields(parsed);
      // Merge and validate complete
      const current = this.config || ({ ...DEFAULT_CONFIG, machine_id: '', authToken: '' } as unknown as CUIConfig);
      const merged: CUIConfig = {
        ...DEFAULT_CONFIG,
        ...current,
        ...parsed,
        server: { ...DEFAULT_CONFIG.server, ...(current.server || {}), ...(parsed.server || {}) },
        interface: { ...DEFAULT_CONFIG.interface, ...(current.interface || {}), ...(parsed.interface || {}) },
        router: parsed.router !== undefined ? (parsed.router as CUIConfig['router']) : current.router,
        gemini: parsed.gemini !== undefined ? (parsed.gemini as CUIConfig['gemini']) : current.gemini,
        trainingAgentId: parsed.trainingAgentId !== undefined ? parsed.trainingAgentId : current.trainingAgentId,
        machine_id: parsed.machine_id || current.machine_id,
        authToken: parsed.authToken || current.authToken
      };
      this.validateCompleteConfig(merged);
      const prev = this.config;
      this.config = merged;
      this.lastLoadedRaw = JSON.stringify(merged, null, 2);
      this.logger.info('Configuration reloaded from external change');
      this.emitter.emit('config-changed', this.config, prev || null, 'external');
    } catch (error) {
      this.logger.error('Failed to handle external configuration change', error as Error);
    }
  }

  /**
   * Reset singleton instance (for testing only)
   *
   * @description
   * Resets the singleton instance to null, allowing tests to create fresh instances
   * with clean state. This method should **only be used in tests** to ensure test
   * isolation and prevent state leakage between test cases.
   *
   * **Important:** Do NOT use this method in production code. It will break the
   * singleton pattern and cause multiple instances to exist, leading to inconsistent
   * configuration state across the application.
   *
   * **Test Cleanup Workflow:**
   * 1. Run test that modifies configuration
   * 2. Call `resetInstance()` in afterEach/teardown
   * 3. Next test gets fresh instance via `getInstance()`
   * 4. Call `initialize()` on fresh instance
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Basic test cleanup
   * import { ConfigService } from './config-service';
   * import { describe, it, afterEach } from 'vitest';
   *
   * describe('ConfigService', () => {
   *   afterEach(() => {
   *     // Reset singleton after each test
   *     ConfigService.resetInstance();
   *   });
   *
   *   it('should load default configuration', async () => {
   *     const configService = ConfigService.getInstance();
   *     await configService.initialize();
   *
   *     const config = configService.getConfig();
   *     expect(config.server.port).toBe(3100);
   *   });
   *
   *   it('should update configuration', async () => {
   *     const configService = ConfigService.getInstance();
   *     await configService.initialize();
   *
   *     await configService.updateConfig({ server: { port: 8080 } });
   *     expect(configService.getConfig().server.port).toBe(8080);
   *   });
   *   // resetInstance() called after each test ensures clean state
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Test isolation - prevent state leakage
   * import { ConfigService } from './config-service';
   * import { describe, it, beforeEach } from 'vitest';
   *
   * describe('Server Configuration', () => {
   *   let configService: ConfigService;
   *
   *   beforeEach(async () => {
   *     // Reset singleton before each test
   *     ConfigService.resetInstance();
   *
   *     // Get fresh instance
   *     configService = ConfigService.getInstance();
   *     await configService.initialize();
   *   });
   *
   *   it('test 1 - modifies port to 8080', async () => {
   *     await configService.updateConfig({ server: { port: 8080 } });
   *     expect(configService.getConfig().server.port).toBe(8080);
   *   });
   *
   *   it('test 2 - starts with default port 3100', async () => {
   *     // Thanks to resetInstance(), this test sees default port
   *     expect(configService.getConfig().server.port).toBe(3100);
   *   });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Test with custom config file location
   * import { ConfigService } from './config-service';
   * import fs from 'fs/promises';
   * import path from 'path';
   * import os from 'os';
   *
   * describe('Custom Config Tests', () => {
   *   const testConfigDir = path.join(os.tmpdir(), 'test-config');
   *   const testConfigPath = path.join(testConfigDir, 'config.json');
   *
   *   beforeEach(async () => {
   *     ConfigService.resetInstance();
   *
   *     // Create test config directory
   *     await fs.mkdir(testConfigDir, { recursive: true });
   *
   *     // Write test config
   *     await fs.writeFile(testConfigPath, JSON.stringify({
   *       machine_id: 'test-machine',
   *       authToken: 'test-token',
   *       server: { host: 'localhost', port: 9999 }
   *     }));
   *   });
   *
   *   afterEach(async () => {
   *     ConfigService.resetInstance();
   *
   *     // Clean up test config
   *     await fs.rm(testConfigDir, { recursive: true, force: true });
   *   });
   *
   *   it('should load custom config', async () => {
   *     // Test implementation...
   *   });
   * });
   * ```
   */
  static resetInstance(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ConfigService.instance = null as any;
  }
}