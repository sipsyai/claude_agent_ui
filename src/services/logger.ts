import pino, { Logger as PinoLogger } from 'pino';
import { PassThrough } from 'stream';
import { LogFormatter } from './log-formatter.js';

/**
 * Context metadata attached to log entries for filtering and correlation.
 *
 * LogContext provides structured metadata fields that enrich log entries with
 * contextual information about the component, session, stream, or request being logged.
 * This enables powerful log filtering, aggregation, and distributed tracing capabilities.
 *
 * @example Basic component context
 * ```typescript
 * const logger = createLogger('MCPService');
 * logger.info('MCP server started', { serverName: 'filesystem' });
 * // Output: [INFO] [MCPService] MCP server started { serverName: 'filesystem' }
 * ```
 *
 * @example Session tracking
 * ```typescript
 * const logger = createLogger('ChatService', { sessionId: 'session-123' });
 * logger.debug('Processing message', { messageId: 'msg-456' });
 * // Output: [DEBUG] [ChatService] [session-123] Processing message { messageId: 'msg-456' }
 * ```
 *
 * @example Streaming context
 * ```typescript
 * const logger = createLogger('ClaudeSdkService', {
 *   sessionId: 'session-123',
 *   streamingId: 'stream-789'
 * });
 * logger.info('Streaming response chunk', { chunkSize: 512 });
 * // All streaming logs now tagged with streamingId for correlation
 * ```
 *
 * @example Request tracing
 * ```typescript
 * const logger = createLogger('ApiHandler', { requestId: req.id });
 * logger.info('API request received', { method: 'POST', path: '/chat/message' });
 * // Trace all logs for a specific request
 * ```
 *
 * @see {@link createLogger} for factory function creating loggers with context
 * @see {@link CUILogger.child} for creating child loggers with additional context
 */
export interface LogContext {
  /** Component name (e.g., 'ChatService', 'MCPService', 'ClaudeSdkService') */
  component?: string;
  /** Chat session identifier for correlating logs across a conversation */
  sessionId?: string;
  /** Stream identifier for tracking SDK streaming response logs */
  streamingId?: string;
  /** HTTP request identifier for distributed tracing */
  requestId?: string;
  /** Additional custom context fields for domain-specific metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Claude UI Logger - Ergonomic wrapper around Pino logger with intuitive parameter order.
 *
 * CUILogger wraps the Pino logger to provide a more developer-friendly API by accepting
 * parameters in a natural order: `logger.method(message, context)` instead of Pino's
 * `logger.method(context, message)`. This wrapper maintains full Pino performance while
 * improving code readability and reducing parameter order mistakes.
 *
 * ## Key Features
 *
 * - **Intuitive API**: Natural parameter order (message, then context)
 * - **Full Pino Integration**: Zero performance overhead, direct Pino delegation
 * - **Log Levels**: Supports debug, info, warn, error, fatal levels
 * - **Context Binding**: Create child loggers with persistent context metadata
 * - **Error Handling**: Automatic Error object serialization with stack traces
 * - **TypeScript Support**: Fully typed with generic context parameters
 *
 * ## Log Levels (from lowest to highest priority)
 *
 * 1. **debug**: Verbose diagnostic information for development and troubleshooting
 * 2. **info**: General informational messages about application operation
 * 3. **warn**: Warning messages for potentially harmful situations
 * 4. **error**: Error events that might still allow the app to continue running
 * 5. **fatal**: Critical errors causing application shutdown or severe failures
 *
 * Log level is controlled by the `LOG_LEVEL` environment variable (default: 'info').
 * Only messages at or above the configured level are output.
 *
 * ## Pino Integration
 *
 * CUILogger is a thin wrapper around Pino (https://getpino.io/), a fast JSON logger
 * for Node.js. Pino advantages:
 * - **Performance**: 5x faster than alternatives (minimal overhead)
 * - **JSON Output**: Structured logging for easy parsing and analysis
 * - **Stream-Based**: Outputs to streams (stdout, files, log aggregation services)
 * - **Child Loggers**: Context binding with zero duplication
 *
 * @example Basic logging with different levels
 * ```typescript
 * const logger = createLogger('MyComponent');
 *
 * logger.debug('Detailed debug information', { stepNumber: 1 });
 * logger.info('User logged in', { userId: '123' });
 * logger.warn('Deprecated API usage', { api: 'oldMethod' });
 * logger.error('Failed to save file', new Error('Disk full'), { filename: 'data.json' });
 * logger.fatal('Database connection lost', new Error('Connection timeout'));
 * ```
 *
 * @example Context binding with child loggers
 * ```typescript
 * const baseLogger = createLogger('ChatService');
 * const sessionLogger = baseLogger.child({ sessionId: 'session-123' });
 *
 * // All logs from sessionLogger automatically include sessionId
 * sessionLogger.info('Message received');
 * sessionLogger.info('Message processed', { messageId: 'msg-456' });
 *
 * // Create deeper nesting
 * const streamLogger = sessionLogger.child({ streamingId: 'stream-789' });
 * streamLogger.debug('Streaming chunk', { chunkSize: 512 });
 * // Output includes: component, sessionId, streamingId
 * ```
 *
 * @example Error logging with stack traces
 * ```typescript
 * const logger = createLogger('ApiHandler');
 *
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   // Error object automatically serialized with stack trace
 *   logger.error('Operation failed', error, { operation: 'riskyOperation' });
 * }
 * ```
 *
 * @example Using warn() method variants
 * ```typescript
 * const logger = createLogger('ValidationService');
 *
 * // Variant 1: Message only
 * logger.warn('Validation threshold exceeded');
 *
 * // Variant 2: Message with context
 * logger.warn('Validation threshold exceeded', { count: 150, threshold: 100 });
 *
 * // Variant 3: Message with Error
 * logger.warn('Network unstable', new Error('Timeout'));
 *
 * // Variant 4: Message with Error and context
 * logger.warn('Network unstable', new Error('Timeout'), { retryCount: 3 });
 * ```
 *
 * @example Integration with service classes
 * ```typescript
 * class MCPService {
 *   private logger = createLogger('MCPService');
 *
 *   async testServer(serverId: string) {
 *     this.logger.info('Testing MCP server', { serverId });
 *
 *     try {
 *       const result = await this.performTest(serverId);
 *       this.logger.info('Server test completed', { serverId, success: true });
 *       return result;
 *     } catch (error) {
 *       this.logger.error('Server test failed', error, { serverId });
 *       throw error;
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link createLogger} for factory function creating CUILogger instances
 * @see {@link LoggerService} for singleton logger service managing logger lifecycle
 * @see {@link LogContext} for context metadata structure
 * @see https://getpino.io/ for Pino documentation
 */
// Re-export CUILogger as Logger for backward compatibility
export type Logger = CUILogger;

export class CUILogger {
  /**
   * Creates a CUILogger instance wrapping a Pino logger.
   *
   * Note: Use {@link createLogger} factory function instead of direct instantiation.
   * The factory function creates loggers through LoggerService for proper configuration.
   *
   * @param pinoLogger - Pino logger instance to wrap
   * @private
   */
  constructor(private pinoLogger: PinoLogger) {}

  /**
   * Log a debug-level message with optional context metadata.
   *
   * Debug logs provide verbose diagnostic information for development and troubleshooting.
   * Use for detailed tracing of application flow, variable values, and internal state.
   * Debug logs are typically disabled in production (`LOG_LEVEL=info` or higher).
   *
   * @param message - Human-readable log message
   * @param context - Optional metadata object attached to the log entry
   *
   * @example Basic debug logging
   * ```typescript
   * const logger = createLogger('ChatService');
   * logger.debug('Processing user message');
   * ```
   *
   * @example Debug with context
   * ```typescript
   * logger.debug('Loading MCP server config', {
   *   serverId: 'mcp-123',
   *   configPath: '/path/to/config'
   * });
   * ```
   *
   * @example Debug with detailed state
   * ```typescript
   * logger.debug('State transition', {
   *   from: 'idle',
   *   to: 'processing',
   *   queueSize: 5,
   *   activeConnections: 3
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: string, context?: any): void {
    if (context !== undefined) {
      this.pinoLogger.debug(context, message);
    } else {
      this.pinoLogger.debug(message);
    }
  }

  /**
   * Log an info-level message with optional context metadata.
   *
   * Info logs record general informational messages about normal application operation.
   * Use for significant events like service startup, user actions, or operational milestones.
   * Info is the default log level for production environments.
   *
   * @param message - Human-readable log message
   * @param context - Optional metadata object attached to the log entry
   *
   * @example Basic info logging
   * ```typescript
   * const logger = createLogger('MCPService');
   * logger.info('MCP server started successfully');
   * ```
   *
   * @example Info with context
   * ```typescript
   * logger.info('User authenticated', {
   *   userId: '123',
   *   method: 'oauth',
   *   provider: 'github'
   * });
   * ```
   *
   * @example Info for operational events
   * ```typescript
   * logger.info('Chat session created', {
   *   sessionId: 'session-123',
   *   agentId: 'agent-456',
   *   timestamp: new Date().toISOString()
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(message: string, context?: any): void {
    if (context !== undefined) {
      this.pinoLogger.info(context, message);
    } else {
      this.pinoLogger.info(message);
    }
  }

  /**
   * Log a warning-level message with optional Error object and context metadata.
   *
   * Warning logs indicate potentially harmful situations that don't prevent operation
   * but may require attention. Use for deprecated features, fallback behavior, or
   * recoverable issues that might indicate underlying problems.
   *
   * Method supports multiple call signatures for flexible usage:
   * - `warn(message)` - Simple warning
   * - `warn(message, context)` - Warning with metadata
   * - `warn(message, error)` - Warning with Error object
   * - `warn(message, error, context)` - Warning with Error and metadata
   *
   * @param message - Human-readable log message
   * @param error - Optional Error object (auto-serialized with stack trace) or context object
   * @param context - Optional metadata object (if error parameter is an Error object)
   *
   * @example Simple warning
   * ```typescript
   * const logger = createLogger('ConfigService');
   * logger.warn('Using default configuration');
   * ```
   *
   * @example Warning with context
   * ```typescript
   * logger.warn('Cache miss, loading from database', {
   *   key: 'user:123',
   *   cacheTtl: 300
   * });
   * ```
   *
   * @example Warning with Error
   * ```typescript
   * try {
   *   await loadOptionalPlugin();
   * } catch (error) {
   *   logger.warn('Optional plugin failed to load', error);
   * }
   * ```
   *
   * @example Warning with Error and context
   * ```typescript
   * try {
   *   await connectToSecondaryDb();
   * } catch (error) {
   *   logger.warn('Secondary database unavailable, using primary only', error, {
   *     dbHost: 'db-secondary.example.com',
   *     fallbackEnabled: true
   *   });
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: string, error?: Error | unknown, context?: any): void {
    if (error instanceof Error) {
      const logData = { err: error, ...context };
      this.pinoLogger.warn(logData, message);
    } else if (error !== undefined && context !== undefined) {
      // error is actually context, context is extra data
      const logData = { ...error, ...context };
      this.pinoLogger.warn(logData, message);
    } else if (error !== undefined) {
      // error is context
      this.pinoLogger.warn(error, message);
    } else {
      this.pinoLogger.warn(message);
    }
  }

  /**
   * Log an error-level message with optional Error object and context metadata.
   *
   * Error logs record error events that might still allow the application to continue
   * running. Use for handled exceptions, failed operations, or error conditions that
   * don't require immediate shutdown. Error objects are automatically serialized with
   * full stack traces for debugging.
   *
   * Method supports multiple call signatures for flexible usage:
   * - `error(message)` - Simple error
   * - `error(message, context)` - Error with metadata
   * - `error(message, error)` - Error with Error object
   * - `error(message, error, context)` - Error with Error and metadata
   *
   * @param message - Human-readable log message
   * @param error - Optional Error object (auto-serialized with stack trace) or context object
   * @param context - Optional metadata object (if error parameter is an Error object)
   *
   * @example Simple error
   * ```typescript
   * const logger = createLogger('ApiHandler');
   * logger.error('Request validation failed');
   * ```
   *
   * @example Error with context
   * ```typescript
   * logger.error('Database query failed', {
   *   query: 'SELECT * FROM users',
   *   duration: 5000
   * });
   * ```
   *
   * @example Error with Error object
   * ```typescript
   * try {
   *   await processPayment();
   * } catch (error) {
   *   logger.error('Payment processing failed', error);
   *   throw error; // Re-throw for upstream handling
   * }
   * ```
   *
   * @example Error with Error and context
   * ```typescript
   * try {
   *   await sendNotification(userId, message);
   * } catch (error) {
   *   logger.error('Notification delivery failed', error, {
   *     userId,
   *     messageType: 'push',
   *     retryable: true
   *   });
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: string, error?: Error | unknown, context?: any): void {
    if (error instanceof Error) {
      const logData = { err: error, ...context };
      this.pinoLogger.error(logData, message);
    } else if (error !== undefined && context !== undefined) {
      // error is actually context, context is extra data
      const logData = { ...error, ...context };
      this.pinoLogger.error(logData, message);
    } else if (error !== undefined) {
      // error is context
      this.pinoLogger.error(error, message);
    } else {
      this.pinoLogger.error(message);
    }
  }

  /**
   * Log a fatal-level message with optional Error object and context metadata.
   *
   * Fatal logs record critical errors that cause application shutdown or severe failures
   * preventing normal operation. Use for unrecoverable errors like database connection
   * failures, corrupted critical data, or missing required configuration. Fatal logs
   * typically trigger alerts and immediate investigation.
   *
   * Method supports multiple call signatures for flexible usage:
   * - `fatal(message)` - Simple fatal error
   * - `fatal(message, context)` - Fatal error with metadata
   * - `fatal(message, error)` - Fatal error with Error object
   * - `fatal(message, error, context)` - Fatal error with Error and metadata
   *
   * @param message - Human-readable log message
   * @param error - Optional Error object (auto-serialized with stack trace) or context object
   * @param context - Optional metadata object (if error parameter is an Error object)
   *
   * @example Simple fatal error
   * ```typescript
   * const logger = createLogger('DatabaseService');
   * logger.fatal('Database connection pool exhausted');
   * process.exit(1);
   * ```
   *
   * @example Fatal error with context
   * ```typescript
   * logger.fatal('Configuration file corrupted', {
   *   configPath: '/etc/app/config.json',
   *   parseError: 'Unexpected token',
   *   canRecover: false
   * });
   * ```
   *
   * @example Fatal error with Error object
   * ```typescript
   * try {
   *   await initializeCriticalService();
   * } catch (error) {
   *   logger.fatal('Critical service initialization failed', error);
   *   process.exit(1);
   * }
   * ```
   *
   * @example Fatal error with Error and context
   * ```typescript
   * try {
   *   await connectToDatabase();
   * } catch (error) {
   *   logger.fatal('Database connection failed after all retries', error, {
   *     host: process.env.DB_HOST,
   *     retryCount: 5,
   *     lastAttempt: new Date().toISOString()
   *   });
   *   process.exit(1);
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fatal(message: string, error?: Error | unknown, context?: any): void {
    if (error instanceof Error) {
      const logData = { err: error, ...context };
      this.pinoLogger.fatal(logData, message);
    } else if (error !== undefined && context !== undefined) {
      // error is actually context, context is extra data
      const logData = { ...error, ...context };
      this.pinoLogger.fatal(logData, message);
    } else if (error !== undefined) {
      // error is context
      this.pinoLogger.fatal(error, message);
    } else {
      this.pinoLogger.fatal(message);
    }
  }

  /**
   * Create a child logger with persistent context metadata.
   *
   * Child loggers inherit the parent logger's configuration and automatically include
   * the provided context in all log entries. This enables context binding without
   * passing context to every log call. Child loggers are efficient (Pino uses
   * prototypal inheritance) and can be nested for hierarchical context.
   *
   * Common use cases:
   * - Binding component/class name to all logs within a service
   * - Tracking session/request ID across async operations
   * - Adding user context to authentication flows
   * - Correlating logs for distributed tracing
   *
   * @param context - Context metadata automatically included in all child logger logs
   * @returns New CUILogger instance with bound context
   *
   * @example Component-level context
   * ```typescript
   * const baseLogger = createLogger('ChatService');
   * const sessionLogger = baseLogger.child({ sessionId: 'session-123' });
   *
   * sessionLogger.info('Message received'); // Includes sessionId
   * sessionLogger.info('Message processed'); // Includes sessionId
   * ```
   *
   * @example Nested child loggers
   * ```typescript
   * const serviceLogger = createLogger('ClaudeSdkService');
   * const sessionLogger = serviceLogger.child({ sessionId: 'session-123' });
   * const streamLogger = sessionLogger.child({ streamingId: 'stream-789' });
   *
   * streamLogger.debug('Chunk received', { size: 512 });
   * // Output includes: component, sessionId, streamingId, size
   * ```
   *
   * @example Request tracing
   * ```typescript
   * async function handleRequest(req, res) {
   *   const logger = createLogger('ApiHandler').child({ requestId: req.id });
   *
   *   logger.info('Request started', { method: req.method, path: req.path });
   *
   *   try {
   *     const result = await processRequest(req, logger);
   *     logger.info('Request completed', { status: 200 });
   *     res.json(result);
   *   } catch (error) {
   *     logger.error('Request failed', error);
   *     res.status(500).json({ error: 'Internal server error' });
   *   }
   * }
   * ```
   *
   * @example User context binding
   * ```typescript
   * class AuthService {
   *   private logger = createLogger('AuthService');
   *
   *   async authenticate(userId: string) {
   *     const userLogger = this.logger.child({ userId });
   *
   *     userLogger.info('Authentication started');
   *     const token = await this.generateToken(userId);
   *     userLogger.info('Token generated', { tokenExpiry: token.expiresAt });
   *
   *     return token;
   *   }
   * }
   * ```
   *
   * @see {@link LogContext} for context metadata structure
   */
  // Support for creating child loggers
  child(context: LogContext): CUILogger {
    return new CUILogger(this.pinoLogger.child(context));
  }
}

/**
 * Centralized logger service using Pino for consistent logging across all CUI components.
 *
 * LoggerService is a singleton that manages the application's logging infrastructure,
 * providing a unified logging interface with support for multiple output streams,
 * structured logging, context binding, and real-time log streaming. The service
 * integrates Pino for high-performance logging with custom formatters for console
 * output and log stream buffering for real-time UI updates.
 *
 * ## Architecture
 *
 * - **Singleton Pattern**: Single shared instance ensures consistent configuration
 * - **Multi-Stream Output**: Logs to both console (formatted) and buffer (raw JSON)
 * - **Child Logger Caching**: Reuses child loggers for same context (performance optimization)
 * - **Lazy Loading**: Log stream buffer loaded on-demand to avoid circular dependencies
 * - **Environment-Driven**: Log level controlled by `LOG_LEVEL` environment variable
 *
 * ## Log Level Configuration
 *
 * Set the `LOG_LEVEL` environment variable to control logging verbosity:
 * - `debug`: All logs (verbose, for development)
 * - `info`: Informational and above (default, for production)
 * - `warn`: Warnings and above (quiet production)
 * - `error`: Errors and fatal only (minimal logging)
 * - `fatal`: Fatal errors only (critical failures)
 *
 * ## Multi-Stream Architecture
 *
 * LoggerService outputs logs to multiple destinations simultaneously:
 *
 * 1. **Console Stream** (via LogFormatter):
 *    - Human-readable colored output for development
 *    - Custom formatting with timestamps and context
 *    - Piped to process.stdout
 *
 * 2. **Intercept Stream** (via PassThrough):
 *    - Raw JSON logs for programmatic consumption
 *    - Forwarded to LogStreamBuffer for real-time UI streaming
 *    - Enables live log viewing in web interface
 *
 * ## Pino Integration Features
 *
 * - **ISO Timestamps**: Consistent timestamp format across all logs
 * - **Level Formatting**: Custom level formatter for readability
 * - **Error Serialization**: Automatic stack trace capture for Error objects
 * - **Child Logger Optimization**: Prototypal inheritance for zero-copy context binding
 * - **Test Mode Support**: Logging can be suppressed in test environment
 *
 * ## Environment Variables
 *
 * - `LOG_LEVEL`: Log level threshold (default: 'info')
 * - `NODE_ENV`: Environment mode ('test' disables logging unless LOG_LEVEL=debug)
 *
 * @example Basic usage via singleton
 * ```typescript
 * import { logger } from '@/services/logger';
 *
 * logger.info('Application started');
 * logger.debug('Debug information', { step: 1 });
 * logger.error('Error occurred', new Error('Something failed'));
 * ```
 *
 * @example Creating component logger with factory
 * ```typescript
 * import { createLogger } from '@/services/logger';
 *
 * const logger = createLogger('ChatService');
 * logger.info('Chat service initialized');
 * ```
 *
 * @example Using child loggers for context binding
 * ```typescript
 * const logger = LoggerService.getInstance();
 * const sessionLogger = logger.child({ sessionId: 'session-123' });
 *
 * sessionLogger.info('Message received');
 * sessionLogger.debug('Processing message', { messageId: 'msg-456' });
 * ```
 *
 * @example Direct method calls on singleton
 * ```typescript
 * const logger = LoggerService.getInstance();
 *
 * logger.debug('Debugging info', { component: 'MCPService' });
 * logger.info('Operation completed', { duration: 150 });
 * logger.warn('Deprecated method used', { method: 'oldApi' });
 * logger.error('Operation failed', new Error('Network timeout'), { retryCount: 3 });
 * logger.fatal('Critical failure', new Error('Database unavailable'));
 * ```
 *
 * @see {@link createLogger} for recommended factory function
 * @see {@link CUILogger} for logger wrapper API
 * @see {@link LogContext} for context metadata structure
 * @see {@link LogFormatter} for console output formatting
 * @see https://getpino.io/ for Pino documentation
 */
class LoggerService {
  /** Singleton instance of LoggerService */
  private static instance: LoggerService;
  /** Base Pino logger instance with multi-stream configuration */
  private baseLogger: PinoLogger;
  /** PassThrough stream for intercepting logs and forwarding to LogStreamBuffer */
  private logInterceptStream: PassThrough;
  /** Cache of child loggers keyed by serialized context (performance optimization) */
  private childLoggers: Map<string, PinoLogger> = new Map();

  private constructor() {
    // Get log level from environment variable, default to 'info'
    const logLevel = process.env.LOG_LEVEL || 'info';
    
    // Create a pass-through stream to intercept logs
    this.logInterceptStream = new PassThrough();
    
    // Forward logs to the log buffer (lazy loaded to avoid circular dependency)
    this.logInterceptStream.on('data', (chunk) => {
      const logLine = chunk.toString().trim();
      if (logLine) {
        // Lazy load to avoid circular dependency
        import('@/services/log-stream-buffer').then(({ logStreamBuffer }) => {
          logStreamBuffer.addLog(logLine);
        }).catch(() => {
          // Silently ignore if log buffer is not available
        });
      }
    });
    
    const formatter = new LogFormatter();
    formatter.pipe(process.stdout);
    
    // Create multi-stream configuration with formatter
    const streams = [
      { level: logLevel as pino.Level, stream: formatter },
      { level: logLevel as pino.Level, stream: this.logInterceptStream }
    ];
    
    this.baseLogger = pino({
      level: logLevel,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Enable in test environment if debug level, otherwise suppress
      enabled: process.env.NODE_ENV !== 'test' || logLevel === 'debug'
    }, pino.multistream(streams));
  }

  /**
   * Get the singleton LoggerService instance.
   *
   * Returns the shared LoggerService instance, creating it on first access.
   * The singleton pattern ensures consistent logging configuration across
   * the entire application.
   *
   * Note: Most code should use {@link createLogger} factory function instead
   * of accessing LoggerService directly.
   *
   * @returns The singleton LoggerService instance
   *
   * @example Getting singleton instance
   * ```typescript
   * const logger = LoggerService.getInstance();
   * logger.info('Using singleton instance directly');
   * ```
   *
   * @example Creating child logger from singleton
   * ```typescript
   * const logger = LoggerService.getInstance();
   * const componentLogger = logger.child({ component: 'MyService' });
   * componentLogger.info('Component initialized');
   * ```
   *
   * @see {@link createLogger} for recommended factory function
   */
  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Create a child logger with persistent context metadata.
   *
   * Creates a new CUILogger with bound context that's automatically included in
   * all log entries. Child loggers are cached for performance - identical context
   * objects reuse the same underlying Pino logger.
   *
   * Caching Strategy:
   * - Context is serialized to JSON and used as cache key
   * - Identical context objects return the same child logger
   * - Reduces memory overhead and improves performance
   *
   * @param context - Context metadata automatically included in all logs
   * @returns CUILogger instance with bound context
   *
   * @example Creating child logger with component context
   * ```typescript
   * const logger = LoggerService.getInstance();
   * const chatLogger = logger.child({ component: 'ChatService' });
   *
   * chatLogger.info('Service started');
   * chatLogger.debug('Processing message', { messageId: 'msg-123' });
   * ```
   *
   * @example Child logger caching
   * ```typescript
   * const logger = LoggerService.getInstance();
   *
   * const logger1 = logger.child({ component: 'MCPService' });
   * const logger2 = logger.child({ component: 'MCPService' });
   * // logger1 and logger2 share the same underlying Pino logger (cached)
   * ```
   *
   * @example Nested context
   * ```typescript
   * const logger = LoggerService.getInstance();
   * const serviceLogger = logger.child({ component: 'ClaudeSdkService' });
   * const sessionLogger = serviceLogger.child({ sessionId: 'session-123' });
   *
   * sessionLogger.info('Message processed');
   * // Output includes: component=ClaudeSdkService, sessionId=session-123
   * ```
   *
   * @see {@link createLogger} for factory function with component name
   * @see {@link CUILogger.child} for creating child loggers from CUILogger instances
   * @see {@link LogContext} for context metadata structure
   */
  child(context: LogContext): CUILogger {
    const contextKey = JSON.stringify(context);
    if (!this.childLoggers.has(contextKey)) {
      this.childLoggers.set(contextKey, this.baseLogger.child(context));
    }
    return new CUILogger(this.childLoggers.get(contextKey)!);
  }

  /**
   * Get the base CUILogger instance without context binding.
   *
   * Returns a CUILogger wrapping the base Pino logger. For most use cases,
   * prefer {@link createLogger} factory function or {@link child} method
   * to create loggers with component context.
   *
   * @returns CUILogger instance wrapping base Pino logger
   *
   * @example Getting base logger
   * ```typescript
   * const logger = LoggerService.getInstance().getLogger();
   * logger.info('Using base logger');
   * ```
   *
   * @example Prefer createLogger instead
   * ```typescript
   * // Better: Use createLogger for automatic component context
   * const logger = createLogger('MyComponent');
   * logger.info('Component initialized');
   * ```
   *
   * @see {@link createLogger} for recommended factory function
   * @see {@link child} for creating logger with context
   */
  getLogger(): CUILogger {
    return new CUILogger(this.baseLogger);
  }

  /**
   * Log a debug-level message directly on the singleton instance.
   *
   * Convenience method for debug logging without creating a logger instance.
   * For repeated logging within a component, prefer {@link createLogger} or
   * {@link child} to create a reusable logger with bound context.
   *
   * @param message - Human-readable log message
   * @param context - Optional context metadata attached to this log entry only
   *
   * @example Simple debug logging
   * ```typescript
   * LoggerService.getInstance().debug('Processing started');
   * ```
   *
   * @example Debug with context
   * ```typescript
   * LoggerService.getInstance().debug('Config loaded', {
   *   component: 'ConfigService',
   *   configPath: '/etc/app/config.json'
   * });
   * ```
   *
   * @see {@link CUILogger.debug} for CUILogger debug method documentation
   */
  debug(message: string, context?: LogContext): void {
    if (context) {
      this.baseLogger.child(context).debug(message);
    } else {
      this.baseLogger.debug(message);
    }
  }

  /**
   * Log an info-level message directly on the singleton instance.
   *
   * Convenience method for info logging without creating a logger instance.
   * For repeated logging within a component, prefer {@link createLogger} or
   * {@link child} to create a reusable logger with bound context.
   *
   * @param message - Human-readable log message
   * @param context - Optional context metadata attached to this log entry only
   *
   * @example Simple info logging
   * ```typescript
   * LoggerService.getInstance().info('Application started');
   * ```
   *
   * @example Info with context
   * ```typescript
   * LoggerService.getInstance().info('User logged in', {
   *   component: 'AuthService',
   *   userId: '123',
   *   method: 'oauth'
   * });
   * ```
   *
   * @see {@link CUILogger.info} for CUILogger info method documentation
   */
  info(message: string, context?: LogContext): void {
    if (context) {
      this.baseLogger.child(context).info(message);
    } else {
      this.baseLogger.info(message);
    }
  }

  /**
   * Log a warning-level message directly on the singleton instance.
   *
   * Convenience method for warning logging without creating a logger instance.
   * For repeated logging within a component, prefer {@link createLogger} or
   * {@link child} to create a reusable logger with bound context.
   *
   * @param message - Human-readable log message
   * @param context - Optional context metadata attached to this log entry only
   *
   * @example Simple warning
   * ```typescript
   * LoggerService.getInstance().warn('Cache miss, using database');
   * ```
   *
   * @example Warning with context
   * ```typescript
   * LoggerService.getInstance().warn('Deprecated API used', {
   *   component: 'ApiHandler',
   *   endpoint: '/api/v1/users',
   *   replacement: '/api/v2/users'
   * });
   * ```
   *
   * @see {@link CUILogger.warn} for CUILogger warn method documentation
   */
  warn(message: string, context?: LogContext): void {
    if (context) {
      this.baseLogger.child(context).warn(message);
    } else {
      this.baseLogger.warn(message);
    }
  }

  /**
   * Log an error-level message directly on the singleton instance.
   *
   * Convenience method for error logging without creating a logger instance.
   * For repeated logging within a component, prefer {@link createLogger} or
   * {@link child} to create a reusable logger with bound context.
   *
   * @param message - Human-readable log message
   * @param error - Optional Error object (auto-serialized with stack trace)
   * @param context - Optional context metadata attached to this log entry only
   *
   * @example Simple error
   * ```typescript
   * LoggerService.getInstance().error('Database query failed');
   * ```
   *
   * @example Error with Error object
   * ```typescript
   * try {
   *   await connectToDatabase();
   * } catch (error) {
   *   LoggerService.getInstance().error('Connection failed', error);
   * }
   * ```
   *
   * @example Error with Error and context
   * ```typescript
   * try {
   *   await processPayment(orderId);
   * } catch (error) {
   *   LoggerService.getInstance().error('Payment failed', error, {
   *     component: 'PaymentService',
   *     orderId,
   *     amount: 99.99
   *   });
   * }
   * ```
   *
   * @see {@link CUILogger.error} for CUILogger error method documentation
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const logData = error ? { err: error } : {};
    if (context) {
      this.baseLogger.child({ ...context, ...logData }).error(message);
    } else {
      this.baseLogger.error(logData, message);
    }
  }

  /**
   * Log a fatal-level message directly on the singleton instance.
   *
   * Convenience method for fatal error logging without creating a logger instance.
   * For repeated logging within a component, prefer {@link createLogger} or
   * {@link child} to create a reusable logger with bound context.
   *
   * @param message - Human-readable log message
   * @param error - Optional Error object (auto-serialized with stack trace)
   * @param context - Optional context metadata attached to this log entry only
   *
   * @example Simple fatal error
   * ```typescript
   * LoggerService.getInstance().fatal('Critical service unavailable');
   * process.exit(1);
   * ```
   *
   * @example Fatal error with Error object
   * ```typescript
   * try {
   *   await initializeDatabase();
   * } catch (error) {
   *   LoggerService.getInstance().fatal('Database initialization failed', error);
   *   process.exit(1);
   * }
   * ```
   *
   * @example Fatal error with Error and context
   * ```typescript
   * try {
   *   await loadCriticalConfig();
   * } catch (error) {
   *   LoggerService.getInstance().fatal('Configuration load failed', error, {
   *     component: 'ConfigService',
   *     configPath: process.env.CONFIG_PATH,
   *     canRecover: false
   *   });
   *   process.exit(1);
   * }
   * ```
   *
   * @see {@link CUILogger.fatal} for CUILogger fatal method documentation
   */
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const logData = error ? { err: error } : {};
    if (context) {
      this.baseLogger.child({ ...context, ...logData }).fatal(message);
    } else {
      this.baseLogger.fatal(logData, message);
    }
  }
}

/**
 * Singleton instance of LoggerService for global logging access.
 *
 * The exported `logger` instance provides direct access to the LoggerService
 * singleton for convenience logging. For component-specific logging, prefer
 * using {@link createLogger} factory function to create loggers with bound
 * component context.
 *
 * @example Using singleton logger instance
 * ```typescript
 * import { logger } from '@/services/logger';
 *
 * logger.info('Application started');
 * logger.debug('Environment', { NODE_ENV: process.env.NODE_ENV });
 * ```
 *
 * @see {@link createLogger} for recommended factory function with component context
 * @see {@link LoggerService} for LoggerService class documentation
 */
export const logger = LoggerService.getInstance();

/**
 * Factory function for creating component loggers with bound context.
 *
 * Creates a CUILogger instance with automatic component name binding and optional
 * additional context. This is the **recommended way** to create loggers in service
 * classes, controllers, and other components. The component name is automatically
 * included in all log entries for easy filtering and debugging.
 *
 * ## Why Use createLogger?
 *
 * - **Automatic Context**: Component name automatically included in all logs
 * - **Type Safety**: TypeScript ensures component name is provided
 * - **Consistent Pattern**: Standardized logging approach across codebase
 * - **Performance**: Child logger caching reduces overhead
 * - **Readability**: Clean, self-documenting code
 *
 * ## Best Practices
 *
 * 1. **One Logger Per Class**: Create logger in constructor or as class field
 * 2. **Component Naming**: Use class/module name as component (e.g., 'ChatService')
 * 3. **Additional Context**: Include persistent context like service ID or tenant ID
 * 4. **Child Loggers**: Create child loggers for request/session-specific context
 *
 * @param component - Component name automatically included in all log entries (e.g., 'ChatService', 'MCPService')
 * @param baseContext - Optional additional context metadata bound to the logger
 * @returns CUILogger instance with component name and additional context bound
 *
 * @example Basic component logger
 * ```typescript
 * import { createLogger } from '@/services/logger';
 *
 * class ChatService {
 *   private logger = createLogger('ChatService');
 *
 *   async sendMessage(message: string) {
 *     this.logger.info('Sending message', { messageLength: message.length });
 *     // ... implementation
 *   }
 * }
 * ```
 *
 * @example Logger with additional base context
 * ```typescript
 * class TenantService {
 *   private logger = createLogger('TenantService', { tenantId: this.tenantId });
 *
 *   processRequest(requestId: string) {
 *     // All logs automatically include component and tenantId
 *     this.logger.info('Processing request', { requestId });
 *   }
 * }
 * ```
 *
 * @example Creating child loggers for request tracking
 * ```typescript
 * class ApiHandler {
 *   private logger = createLogger('ApiHandler');
 *
 *   async handleRequest(req, res) {
 *     const requestLogger = this.logger.child({ requestId: req.id });
 *
 *     requestLogger.info('Request received', { method: req.method, path: req.path });
 *
 *     try {
 *       const result = await this.processRequest(req);
 *       requestLogger.info('Request completed', { status: 200 });
 *       res.json(result);
 *     } catch (error) {
 *       requestLogger.error('Request failed', error);
 *       res.status(500).json({ error: 'Internal server error' });
 *     }
 *   }
 * }
 * ```
 *
 * @example Module-level logger
 * ```typescript
 * // utils/helper.ts
 * import { createLogger } from '@/services/logger';
 *
 * const logger = createLogger('HelperUtils');
 *
 * export function processData(data: unknown) {
 *   logger.debug('Processing data', { dataType: typeof data });
 *   // ... implementation
 *   logger.info('Data processed successfully');
 * }
 * ```
 *
 * @example Logger with service-specific context
 * ```typescript
 * class MCPService {
 *   private logger = createLogger('MCPService', { version: '1.0.0' });
 *
 *   async testServer(serverId: string) {
 *     const serverLogger = this.logger.child({ serverId });
 *
 *     serverLogger.info('Testing MCP server');
 *     try {
 *       await this.performTest(serverId);
 *       serverLogger.info('Server test passed');
 *     } catch (error) {
 *       serverLogger.error('Server test failed', error);
 *       throw error;
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link CUILogger} for logger API documentation
 * @see {@link LogContext} for context metadata structure
 * @see {@link LoggerService.child} for child logger creation
 */
export function createLogger(component: string, baseContext?: LogContext): CUILogger {
  const context = { component, ...baseContext };
  return logger.child(context);
}