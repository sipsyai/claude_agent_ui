import { Transform } from 'stream';

/**
 * Pino log object structure from JSON output.
 *
 * Represents the JSON format emitted by Pino logger before transformation to
 * human-readable console output. Pino emits newline-delimited JSON (NDJSON) where
 * each log entry is a single-line JSON object with standardized fields.
 *
 * @example Basic info log
 * ```json
 * {
 *   "level": 30,
 *   "time": 1704196800000,
 *   "msg": "Server started",
 *   "component": "ApiServer",
 *   "pid": 12345,
 *   "hostname": "localhost"
 * }
 * ```
 *
 * @example Error log with stack trace
 * ```json
 * {
 *   "level": 50,
 *   "time": "2024-01-02T12:00:00.000Z",
 *   "msg": "Database connection failed",
 *   "component": "DatabaseService",
 *   "err": {
 *     "message": "Connection timeout",
 *     "stack": "Error: Connection timeout\n    at Database.connect (db.ts:45:15)"
 *   }
 * }
 * ```
 *
 * @example Context-rich log with custom fields
 * ```json
 * {
 *   "level": 20,
 *   "time": 1704196800000,
 *   "msg": "Message processed",
 *   "component": "ChatService",
 *   "sessionId": "session-123",
 *   "streamingId": "stream-789",
 *   "messageId": "msg-456",
 *   "duration": 1234
 * }
 * ```
 *
 * @see {@link formatLog} for transformation to console format
 * @see {@link LogFormatter} for stream-based transformation
 */
interface LogObject {
  /** Pino log level (10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal) */
  level: number;
  /** Timestamp as Unix epoch milliseconds or ISO 8601 string */
  time: number | string;
  /** Main log message text */
  msg: string;
  /** Component name (e.g., 'ChatService', 'MCPService') for log categorization */
  component?: string;
  /** HTTP request identifier for distributed tracing */
  requestId?: string;
  /** Chat session identifier for correlating conversation logs */
  sessionId?: string;
  /** Stream identifier for tracking SDK streaming response logs */
  streamingId?: string;
  /** Error object with message and stack trace (Pino's error serialization) */
  err?: {
    message?: string;
    stack?: string;
  };
  /** Alternative error field name (some loggers use 'error' instead of 'err') */
  error?: {
    message?: string;
    stack?: string;
  };
  /** Additional custom context fields (e.g., messageId, duration, userId) */
  [key: string]: unknown;
}

/** ANSI escape code to reset all formatting (color and style) */
const RESET = '\x1b[0m';
/** ANSI escape code for gray/dim text color (used for timestamps and context) */
const GRAY = '\x1b[90m';
/** ANSI escape code for bold text style (used for component names) */
const BOLD = '\x1b[1m';
/** ANSI escape code for blue text color (used for component names) */
const BLUE = '\x1b[34m';

/**
 * Transform stream that converts Pino JSON logs to human-readable colored console output.
 *
 * LogFormatter is a Node.js Transform stream (object mode) that sits between Pino's JSON
 * output and the console. It parses newline-delimited JSON (NDJSON) log entries and formats
 * them with ANSI colors, timestamps, component names, and context fields for improved
 * readability during development and debugging.
 *
 * ## Stream Transformation Flow
 *
 * 1. **Input**: NDJSON from Pino logger (one JSON object per line)
 * 2. **Parse**: JSON.parse() each log line into LogObject
 * 3. **Format**: Transform to colored console output via formatLog()
 * 4. **Output**: Human-readable formatted string with newline
 * 5. **Error Handling**: Pass through unparseable chunks as-is (graceful degradation)
 *
 * ## Color Formatting
 *
 * LogFormatter applies ANSI color codes for visual hierarchy:
 * - **Timestamps**: Gray (dim) for low visual weight
 * - **Component Names**: Bold Blue in brackets for quick scanning
 * - **Messages**: Default terminal color (usually white/black)
 * - **Context Fields**: Gray (dim) for supplementary information
 * - **Stack Traces**: Default color with preserved indentation
 *
 * ## Output Modes
 *
 * LogFormatter supports two output modes via configuration:
 *
 * ### Object Mode (writableObjectMode: true)
 * - **Input**: JavaScript objects or Buffers from Pino
 * - **Processing**: Parses JSON strings to objects
 * - **Use Case**: Standard console output in development
 *
 * ### Graceful Degradation
 * - **Fallback**: Unparseable chunks passed through unchanged
 * - **Use Case**: Mixed output streams or malformed JSON
 * - **Example**: Non-JSON console.log() outputs mixed with Pino logs
 *
 * ## Architecture
 *
 * LogFormatter extends Node.js Transform stream:
 * - **Writable Side**: Accepts JSON log objects from Pino (object mode)
 * - **Readable Side**: Emits formatted strings to console/stdout
 * - **Transform Function**: Inline in constructor for performance
 * - **Error Handling**: Try-catch with graceful fallback (no stream errors)
 *
 * @example Basic usage with Pino logger (single stream)
 * ```typescript
 * import pino from 'pino';
 * import { LogFormatter } from './log-formatter.js';
 *
 * const logger = pino({
 *   level: 'info'
 * }, new LogFormatter());
 *
 * logger.info('Server started', { port: 3000 });
 * // Output: 02:30:45 PM [ApiServer] Server started port=3000
 * ```
 *
 * @example Multi-stream setup with LoggerService (production pattern)
 * ```typescript
 * import pino from 'pino';
 * import { PassThrough } from 'stream';
 * import { LogFormatter } from './log-formatter.js';
 *
 * // Console stream with formatting
 * const consoleStream = new LogFormatter();
 * consoleStream.pipe(process.stdout);
 *
 * // Additional raw JSON stream for log aggregation
 * const rawStream = new PassThrough();
 * rawStream.pipe(logFileStream);
 *
 * const logger = pino({
 *   level: 'info'
 * }, pino.multistream([
 *   { stream: consoleStream },
 *   { stream: rawStream }
 * ]));
 * ```
 *
 * @example Output format demonstration
 * ```typescript
 * const logger = createLogger('ChatService', { sessionId: 'session-123' });
 *
 * // Basic log
 * logger.info('Message received');
 * // Output: 02:30:45 PM [ChatService] Message received sessionId="session-123"
 *
 * // Log with context
 * logger.debug('Processing message', { messageId: 'msg-456', duration: 1234 });
 * // Output: 02:30:46 PM [ChatService] Processing message sessionId="session-123" messageId="msg-456" duration=1234
 *
 * // Error log with stack trace
 * logger.error('Database query failed', new Error('Connection timeout'));
 * // Output:
 * // 02:30:47 PM [ChatService] Database query failed sessionId="session-123" err="Connection timeout"
 * // Error: Connection timeout
 * //     at Database.query (db.ts:45:15)
 * //     at ChatService.saveMessage (chat-service.ts:123:30)
 * ```
 *
 * @example Graceful degradation with non-JSON input
 * ```typescript
 * const formatter = new LogFormatter();
 * formatter.pipe(process.stdout);
 *
 * // Valid JSON - formatted
 * formatter.write('{"level":30,"time":1704196800000,"msg":"Test"}\n');
 * // Output: 02:30:45 PM Test
 *
 * // Invalid JSON - passed through as-is
 * formatter.write('Plain text console.log output\n');
 * // Output: Plain text console.log output
 * ```
 *
 * @example Integration with LoggerService (actual usage)
 * ```typescript
 * // LoggerService uses LogFormatter for console output
 * export class LoggerService {
 *   private static instance: LoggerService | null = null;
 *   private logger: PinoLogger;
 *   private consoleStream: LogFormatter;
 *   private bufferStream: LogStreamBuffer;
 *
 *   private constructor() {
 *     // Multi-stream setup
 *     this.consoleStream = new LogFormatter();
 *     this.consoleStream.pipe(process.stdout);
 *
 *     this.bufferStream = LogStreamBuffer.getInstance();
 *
 *     this.logger = pino({
 *       level: process.env.LOG_LEVEL || 'info',
 *     }, pino.multistream([
 *       { stream: this.consoleStream },
 *       { stream: this.bufferStream }
 *     ]));
 *   }
 * }
 *
 * // Usage produces formatted console output
 * const logger = createLogger('MyComponent');
 * logger.info('Hello World');
 * // Console: 02:30:45 PM [MyComponent] Hello World
 * ```
 *
 * @example Timestamp formatting (12-hour with AM/PM)
 * ```typescript
 * // Different times of day
 * logger.info('Morning');   // 09:15:30 AM
 * logger.info('Afternoon'); // 02:30:45 PM
 * logger.info('Evening');   // 08:45:00 PM
 * logger.info('Midnight');  // 12:00:00 AM
 * logger.info('Noon');      // 12:00:00 PM
 * ```
 *
 * @example Context field formatting (type-aware)
 * ```typescript
 * logger.info('Context demo', {
 *   string: 'value',           // string="value"
 *   number: 123,               // number=123
 *   boolean: true,             // boolean=true
 *   object: { nested: 'data' }, // object={"nested":"data"}
 *   array: [1, 2, 3]           // array=[1,2,3]
 * });
 * // Output: 02:30:45 PM Context demo string="value" number=123 boolean=true object={"nested":"data"} array=[1,2,3]
 * ```
 *
 * @see {@link formatLog} for formatting logic implementation
 * @see {@link LogObject} for input JSON structure
 * @see {@link LoggerService} for production multi-stream setup
 * @see {@link LogStreamBuffer} for real-time UI log streaming
 */
export class LogFormatter extends Transform {
  constructor() {
    super({
      writableObjectMode: true,
      transform(chunk: unknown, _encoding: string, callback: (error?: Error | null, data?: unknown) => void) {
        try {
          const logLine = String(chunk).trim();
          if (!logLine) {
            callback();
            return;
          }

          const log: LogObject = JSON.parse(logLine);
          const formatted = formatLog(log);
          callback(null, formatted + '\n');
        } catch (_err) {
          // If we can't parse it, pass it through as-is
          callback(null, chunk);
        }
      }
    });
  }
}

/**
 * Formats a Pino log object into human-readable colored console output.
 *
 * Transforms structured JSON log entries from Pino into visually organized console output
 * with ANSI color codes. The formatter applies a consistent layout: timestamp (gray),
 * component name (bold blue), message (default color), and context fields (gray).
 *
 * ## Formatting Rules
 *
 * 1. **Timestamp**: Converted to 12-hour format with AM/PM (e.g., "02:30:45 PM")
 * 2. **Component**: Displayed in bold blue brackets (e.g., "[ChatService]")
 * 3. **Message**: Main log message text in default terminal color
 * 4. **Context Fields**: Key-value pairs in gray, type-aware formatting
 * 5. **Error Stack Traces**: Appended on new lines with preserved indentation
 *
 * ## Context Field Formatting (Type-Aware)
 *
 * - **Strings**: Quoted with double quotes (e.g., `sessionId="session-123"`)
 * - **Numbers**: Unquoted (e.g., `duration=1234`)
 * - **Booleans**: Unquoted (e.g., `success=true`)
 * - **Objects/Arrays**: JSON.stringify() (e.g., `config={"retry":3}`)
 * - **Errors**: Error message extracted (e.g., `err="Connection timeout"`)
 *
 * ## Excluded Fields (Pino Internals)
 *
 * The following Pino metadata fields are filtered out from context output:
 * - `level`: Log level (already implicit in output)
 * - `time`: Timestamp (formatted separately)
 * - `msg`: Main message (displayed separately)
 * - `component`: Component name (displayed in brackets)
 * - `pid`: Process ID (internal Pino metadata)
 * - `hostname`: Hostname (internal Pino metadata)
 * - `v`: Pino version (internal Pino metadata)
 *
 * All other fields are treated as custom context and included in the output.
 *
 * @param log - Pino log object (parsed JSON from NDJSON stream)
 * @returns Formatted string with ANSI color codes and newline appended by caller
 *
 * @example Basic info log
 * ```typescript
 * const log = {
 *   level: 30,
 *   time: 1704196800000,
 *   msg: 'Server started',
 *   component: 'ApiServer',
 *   port: 3000
 * };
 * const formatted = formatLog(log);
 * // Output: "02:30:45 PM [ApiServer] Server started port=3000"
 * ```
 *
 * @example Log with multiple context fields
 * ```typescript
 * const log = {
 *   level: 20,
 *   time: '2024-01-02T14:30:45.123Z',
 *   msg: 'Message processed',
 *   component: 'ChatService',
 *   sessionId: 'session-123',
 *   messageId: 'msg-456',
 *   duration: 1234,
 *   success: true
 * };
 * const formatted = formatLog(log);
 * // Output: "02:30:45 PM [ChatService] Message processed sessionId="session-123" messageId="msg-456" duration=1234 success=true"
 * ```
 *
 * @example Error log with stack trace
 * ```typescript
 * const log = {
 *   level: 50,
 *   time: 1704196800000,
 *   msg: 'Database query failed',
 *   component: 'DatabaseService',
 *   err: {
 *     message: 'Connection timeout',
 *     stack: 'Error: Connection timeout\n    at Database.query (db.ts:45:15)\n    at ChatService.saveMessage (chat-service.ts:123:30)'
 *   },
 *   query: 'SELECT * FROM messages'
 * };
 * const formatted = formatLog(log);
 * // Output:
 * // "02:30:45 PM [DatabaseService] Database query failed query="SELECT * FROM messages" err="Connection timeout"
 * // Error: Connection timeout
 * //     at Database.query (db.ts:45:15)
 * //     at ChatService.saveMessage (chat-service.ts:123:30)"
 * ```
 *
 * @example Log without component
 * ```typescript
 * const log = {
 *   level: 30,
 *   time: 1704196800000,
 *   msg: 'Generic message',
 *   userId: 'user-789'
 * };
 * const formatted = formatLog(log);
 * // Output: "02:30:45 PM Generic message userId="user-789""
 * // (No component brackets)
 * ```
 *
 * @example Context field type handling
 * ```typescript
 * const log = {
 *   level: 30,
 *   time: 1704196800000,
 *   msg: 'Type demo',
 *   stringValue: 'hello',
 *   numberValue: 42,
 *   booleanValue: false,
 *   objectValue: { nested: 'data' },
 *   arrayValue: [1, 2, 3],
 *   nullValue: null,
 *   undefinedValue: undefined
 * };
 * const formatted = formatLog(log);
 * // Output: "02:30:45 PM Type demo stringValue="hello" numberValue=42 booleanValue=false objectValue={"nested":"data"} arrayValue=[1,2,3]"
 * // Note: null and undefined values are excluded from context output
 * ```
 *
 * @example Timestamp format conversion
 * ```typescript
 * // Unix epoch milliseconds
 * const log1 = { level: 30, time: 1704196800000, msg: 'Test' };
 * formatLog(log1); // "02:30:00 PM Test" (depends on timezone)
 *
 * // ISO 8601 string
 * const log2 = { level: 30, time: '2024-01-02T14:30:45.123Z', msg: 'Test' };
 * formatLog(log2); // "02:30:45 PM Test" (converted to local time)
 *
 * // 12-hour format examples
 * // 00:00:00 -> 12:00:00 AM (midnight)
 * // 01:30:45 -> 01:30:45 AM
 * // 12:00:00 -> 12:00:00 PM (noon)
 * // 13:30:45 -> 01:30:45 PM
 * // 23:59:59 -> 11:59:59 PM
 * ```
 *
 * @example Alternative error field name
 * ```typescript
 * const log = {
 *   level: 50,
 *   time: 1704196800000,
 *   msg: 'Error occurred',
 *   error: {  // Some loggers use 'error' instead of 'err'
 *     message: 'Validation failed',
 *     stack: 'Error: Validation failed\n    at validate (validator.ts:10:5)'
 *   }
 * };
 * const formatted = formatLog(log);
 * // Output: "02:30:00 PM Error occurred error="Validation failed"
 * // Error: Validation failed
 * //     at validate (validator.ts:10:5)"
 * ```
 *
 * @example Pino internal fields filtered out
 * ```typescript
 * const log = {
 *   level: 30,
 *   time: 1704196800000,
 *   msg: 'Test message',
 *   component: 'TestService',
 *   pid: 12345,           // Filtered out
 *   hostname: 'localhost', // Filtered out
 *   v: 1,                 // Filtered out
 *   customField: 'value'  // Included
 * };
 * const formatted = formatLog(log);
 * // Output: "02:30:00 PM [TestService] Test message customField="value""
 * // Only customField is included in context (pid, hostname, v excluded)
 * ```
 *
 * @see {@link LogObject} for input structure
 * @see {@link LogFormatter} for stream integration
 */
function formatLog(log: LogObject): string {
  // Format timestamp in 12-hour format with AM/PM
  const time = new Date(typeof log.time === 'string' ? log.time : log.time);
  const hours = time.getHours();
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
  const timestamp = `${displayHours}:${minutes}:${seconds} ${ampm}`;

  // Build the formatted message
  let formatted = `${GRAY}${timestamp}${RESET}`;

  // Add component in bold blue brackets if present
  if (log.component) {
    formatted += ` ${BOLD}${BLUE}[${log.component}]${RESET}`;
  }

  // Add the main message
  formatted += ` ${log.msg}`;

  // Add context fields (filter out only pino internals)
  const excludedFields = ['level', 'time', 'msg', 'component', 'pid', 'hostname', 'v'];
  const contextFields = Object.keys(log)
    .filter(key => !excludedFields.includes(key) && log[key] !== undefined && log[key] !== null);

  if (contextFields.length > 0) {
    const contextPairs = contextFields.map(key => {
      const value = log[key];
      
      // Special handling for error objects
      if ((key === 'err' || key === 'error') && typeof value === 'object' && value !== null && 'message' in value) {
        return `${key}="${(value as { message: string }).message}"`;
      }
      
      // Format based on value type
      if (typeof value === 'string') {
        return `${key}="${value}"`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        return `${key}=${value}`;
      } else {
        // For objects and arrays, use JSON.stringify
        return `${key}=${JSON.stringify(value)}`;
      }
    });
    
    formatted += ` ${GRAY}${contextPairs.join(' ')}${RESET}`;
  }

  // Handle error stack traces
  if (log.err && typeof log.err === 'object' && 'stack' in log.err && log.err.stack) {
    formatted += `\n${log.err.stack}`;
  }

  return formatted;
}