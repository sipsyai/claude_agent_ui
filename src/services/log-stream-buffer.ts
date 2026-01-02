import { EventEmitter } from 'events';

/**
 * Circular buffer for real-time log streaming with EventEmitter integration.
 *
 * LogStreamBuffer extends Node.js EventEmitter to provide a memory-efficient circular buffer
 * for storing recent log entries while emitting log events for real-time streaming to connected
 * clients. It automatically maintains a fixed-size buffer using LRU (Least Recently Used)
 * eviction when the buffer reaches capacity.
 *
 * ## Architecture
 *
 * **EventEmitter Pattern**: Emits 'log' events when new log entries are added, enabling
 * real-time log streaming to WebSocket clients, UI components, or monitoring systems.
 *
 * **Circular Buffer Management**: Maintains a fixed-size buffer of recent log entries.
 * When buffer reaches maxBufferSize, oldest entries are automatically evicted (FIFO).
 * Default capacity is 1000 log entries.
 *
 * **Memory Safety**: Prevents unbounded memory growth by enforcing strict buffer size limits.
 * Suitable for long-running processes where logs accumulate indefinitely.
 *
 * ## Events
 *
 * - `'log'` - Emitted when a new log entry is added via addLog()
 *   - Event payload: `(logLine: string)` - The new log line text
 *
 * ## Use Cases
 *
 * - Real-time log streaming to browser UI (WebSocket integration)
 * - Recent log history retrieval for debugging (last N entries)
 * - Multi-stream Pino logger output (console + buffer)
 * - Log aggregation for monitoring dashboards
 * - Tail-like functionality for viewing recent application logs
 *
 * @example Basic usage with event listeners
 * ```typescript
 * import { logStreamBuffer } from './log-stream-buffer';
 *
 * // Subscribe to real-time log events
 * logStreamBuffer.on('log', (logLine: string) => {
 *   console.log('New log:', logLine);
 *   // Send to WebSocket clients, UI, etc.
 * });
 *
 * // Add logs (usually via Pino stream)
 * logStreamBuffer.addLog('[2024-01-02 12:00:00] INFO  [ChatService] Message sent');
 * logStreamBuffer.addLog('[2024-01-02 12:00:01] DEBUG [MCPService] Tool called');
 *
 * // Retrieve recent logs
 * const recentLogs = logStreamBuffer.getRecentLogs(10);
 * console.log('Last 10 logs:', recentLogs);
 * ```
 *
 * @example WebSocket streaming integration
 * ```typescript
 * import WebSocket from 'ws';
 * import { logStreamBuffer } from './log-stream-buffer';
 *
 * const wss = new WebSocket.Server({ port: 8080 });
 *
 * wss.on('connection', (ws) => {
 *   // Send recent logs on connection
 *   const recentLogs = logStreamBuffer.getRecentLogs(50);
 *   ws.send(JSON.stringify({ type: 'history', logs: recentLogs }));
 *
 *   // Stream new logs in real-time
 *   const logHandler = (logLine: string) => {
 *     ws.send(JSON.stringify({ type: 'log', data: logLine }));
 *   };
 *   logStreamBuffer.on('log', logHandler);
 *
 *   // Cleanup on disconnect
 *   ws.on('close', () => {
 *     logStreamBuffer.off('log', logHandler);
 *   });
 * });
 * ```
 *
 * @example Pino multi-stream integration
 * ```typescript
 * import pino from 'pino';
 * import { logStreamBuffer } from './log-stream-buffer';
 * import { LogFormatter } from './log-formatter';
 *
 * const logger = pino(
 *   { level: 'info' },
 *   pino.multistream([
 *     // Console output with formatting
 *     { stream: new LogFormatter() },
 *     // Buffer for real-time streaming (receives raw formatted logs)
 *     {
 *       stream: {
 *         write: (chunk: string) => {
 *           logStreamBuffer.addLog(chunk.trim());
 *         }
 *       }
 *     }
 *   ])
 * );
 * ```
 *
 * @example Custom buffer size configuration
 * ```typescript
 * import { LogStreamBuffer } from './log-stream-buffer';
 *
 * // Create buffer with custom capacity for high-volume logs
 * const highVolumeBuffer = new LogStreamBuffer(5000);
 *
 * // Create buffer with smaller capacity for memory-constrained environments
 * const lowMemoryBuffer = new LogStreamBuffer(100);
 * ```
 *
 * @example Retrieving recent logs with limit variations
 * ```typescript
 * import { logStreamBuffer } from './log-stream-buffer';
 *
 * // Get all logs in buffer
 * const allLogs = logStreamBuffer.getRecentLogs();
 *
 * // Get last 50 logs
 * const last50 = logStreamBuffer.getRecentLogs(50);
 *
 * // Get zero logs (empty array)
 * const empty = logStreamBuffer.getRecentLogs(0);
 *
 * // Clear buffer
 * logStreamBuffer.clear();
 * ```
 *
 * @see {@link addLog} for adding log entries
 * @see {@link getRecentLogs} for retrieving log history
 * @see {@link clear} for clearing the buffer
 * @see {@link https://nodejs.org/api/events.html#class-eventemitter} for EventEmitter documentation
 */
export class LogStreamBuffer extends EventEmitter {
  /** In-memory circular buffer storing recent log entries (FIFO eviction when full) */
  private buffer: string[] = [];
  /** Maximum number of log entries to retain in buffer (default: 1000) */
  private maxBufferSize: number;

  /**
   * Creates a new LogStreamBuffer instance with configurable buffer size.
   *
   * Initializes the EventEmitter and sets the maximum buffer capacity. When the buffer
   * reaches maxBufferSize, oldest entries are automatically evicted using FIFO strategy.
   *
   * @param maxBufferSize - Maximum number of log entries to retain (default: 1000)
   *
   * @example Default buffer size (1000 entries)
   * ```typescript
   * import { LogStreamBuffer } from './log-stream-buffer';
   *
   * const buffer = new LogStreamBuffer();
   * // Buffer will hold up to 1000 log entries
   * ```
   *
   * @example Custom buffer size for high-volume logs
   * ```typescript
   * // Larger buffer for applications with heavy logging
   * const highVolumeBuffer = new LogStreamBuffer(5000);
   *
   * for (let i = 0; i < 10000; i++) {
   *   highVolumeBuffer.addLog(`Log entry ${i}`);
   * }
   *
   * const recent = highVolumeBuffer.getRecentLogs();
   * console.log(recent.length); // 5000 (oldest 5000 entries evicted)
   * ```
   *
   * @example Small buffer for memory-constrained environments
   * ```typescript
   * // Smaller buffer for embedded systems or containers
   * const lowMemoryBuffer = new LogStreamBuffer(100);
   * ```
   */
  constructor(maxBufferSize: number = 1000) {
    super();
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Add a log entry to the buffer and emit 'log' event for real-time streaming.
   *
   * Appends the log line to the internal circular buffer. If the buffer size exceeds
   * maxBufferSize, the oldest entry is automatically evicted (FIFO). After adding to
   * the buffer, emits a 'log' event with the new log line for real-time subscribers.
   *
   * ## Buffer Management Workflow
   *
   * 1. Append log line to buffer array (push)
   * 2. Check if buffer.length > maxBufferSize
   * 3. If overflow, remove oldest entry (shift)
   * 4. Emit 'log' event with new log line to all listeners
   *
   * ## Event Emission
   *
   * Event name: `'log'`
   * Event payload: `(logLine: string)` - The new log line text
   *
   * @param logLine - The log line text to add (typically formatted log output)
   *
   * @example Basic usage
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * logStreamBuffer.addLog('[2024-01-02 12:00:00] INFO  [ChatService] Message sent');
   * logStreamBuffer.addLog('[2024-01-02 12:00:01] DEBUG [MCPService] Tool called');
   * ```
   *
   * @example Real-time streaming with event listeners
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * // Subscribe to log events
   * logStreamBuffer.on('log', (logLine: string) => {
   *   console.log('New log received:', logLine);
   * });
   *
   * // Add logs (emits 'log' event for each)
   * logStreamBuffer.addLog('[2024-01-02 12:00:00] INFO  Server started');
   * // Output: New log received: [2024-01-02 12:00:00] INFO  Server started
   *
   * logStreamBuffer.addLog('[2024-01-02 12:00:01] DEBUG Config loaded');
   * // Output: New log received: [2024-01-02 12:00:01] DEBUG Config loaded
   * ```
   *
   * @example WebSocket streaming to multiple clients
   * ```typescript
   * import WebSocket from 'ws';
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * const clients = new Set<WebSocket>();
   *
   * // Broadcast logs to all connected WebSocket clients
   * logStreamBuffer.on('log', (logLine: string) => {
   *   const payload = JSON.stringify({ type: 'log', data: logLine });
   *   clients.forEach(client => {
   *     if (client.readyState === WebSocket.OPEN) {
   *       client.send(payload);
   *     }
   *   });
   * });
   *
   * // Add logs (broadcasts to all clients)
   * logStreamBuffer.addLog('[2024-01-02 12:00:00] INFO  [API] Request received');
   * ```
   *
   * @example Pino stream integration
   * ```typescript
   * import pino from 'pino';
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * // Create Pino logger that writes to logStreamBuffer
   * const logger = pino({
   *   level: 'info',
   *   stream: {
   *     write: (chunk: string) => {
   *       logStreamBuffer.addLog(chunk.trim());
   *     }
   *   }
   * });
   *
   * logger.info('Server started');
   * // Log is added to buffer and emitted to subscribers
   * ```
   *
   * @example Buffer overflow behavior
   * ```typescript
   * import { LogStreamBuffer } from './log-stream-buffer';
   *
   * const buffer = new LogStreamBuffer(3); // Small buffer for demo
   *
   * buffer.addLog('Log 1');
   * buffer.addLog('Log 2');
   * buffer.addLog('Log 3');
   * console.log(buffer.getRecentLogs()); // ['Log 1', 'Log 2', 'Log 3']
   *
   * buffer.addLog('Log 4'); // Evicts 'Log 1'
   * console.log(buffer.getRecentLogs()); // ['Log 2', 'Log 3', 'Log 4']
   *
   * buffer.addLog('Log 5'); // Evicts 'Log 2'
   * console.log(buffer.getRecentLogs()); // ['Log 3', 'Log 4', 'Log 5']
   * ```
   *
   * @example Multiple event listeners
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * // Listener 1: Console output
   * logStreamBuffer.on('log', (log) => {
   *   console.log('Console:', log);
   * });
   *
   * // Listener 2: File writing
   * logStreamBuffer.on('log', (log) => {
   *   fs.appendFileSync('/var/log/app.log', log + '\n');
   * });
   *
   * // Listener 3: Metrics collection
   * logStreamBuffer.on('log', (log) => {
   *   if (log.includes('ERROR')) {
   *     errorCount++;
   *   }
   * });
   *
   * // All listeners receive the event
   * logStreamBuffer.addLog('[2024-01-02 12:00:00] ERROR Database connection failed');
   * ```
   *
   * @see {@link getRecentLogs} for retrieving buffered logs
   * @see {@link clear} for clearing the buffer
   */
  public addLog(logLine: string): void {
    // Add to buffer
    this.buffer.push(logLine);

    // Maintain buffer size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Emit for real-time streaming
    this.emit('log', logLine);
  }

  /**
   * Retrieve recent log entries from the buffer with optional limit.
   *
   * Returns an array of recent log entries from the circular buffer. By default, returns
   * all buffered logs. When a limit is specified, returns the most recent N entries.
   * Returns a shallow copy of the internal buffer to prevent external modifications.
   *
   * ## Return Behavior
   *
   * - `limit` undefined/null: Returns all logs in buffer (shallow copy)
   * - `limit` = 0: Returns empty array `[]`
   * - `limit` < buffer.length: Returns last N entries (most recent)
   * - `limit` >= buffer.length: Returns all logs in buffer (same as undefined)
   *
   * ## Performance
   *
   * - Always returns a shallow copy of the buffer (prevents external mutation)
   * - Uses `Array.slice(-limit)` for efficient tail extraction
   * - O(N) time complexity where N is the limit or buffer size
   *
   * @param limit - Optional maximum number of recent log entries to return (default: all logs)
   * @returns Array of log line strings (most recent logs when limit specified)
   *
   * @example Get all logs in buffer
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * logStreamBuffer.addLog('Log 1');
   * logStreamBuffer.addLog('Log 2');
   * logStreamBuffer.addLog('Log 3');
   *
   * const allLogs = logStreamBuffer.getRecentLogs();
   * console.log(allLogs); // ['Log 1', 'Log 2', 'Log 3']
   * ```
   *
   * @example Get last N logs
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * for (let i = 1; i <= 100; i++) {
   *   logStreamBuffer.addLog(`Log ${i}`);
   * }
   *
   * const last10 = logStreamBuffer.getRecentLogs(10);
   * console.log(last10); // ['Log 91', 'Log 92', ..., 'Log 100']
   *
   * const last5 = logStreamBuffer.getRecentLogs(5);
   * console.log(last5); // ['Log 96', 'Log 97', 'Log 98', 'Log 99', 'Log 100']
   * ```
   *
   * @example WebSocket - send recent logs on connection
   * ```typescript
   * import WebSocket from 'ws';
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * const wss = new WebSocket.Server({ port: 8080 });
   *
   * wss.on('connection', (ws) => {
   *   // Send last 50 logs to new client for context
   *   const recentLogs = logStreamBuffer.getRecentLogs(50);
   *   ws.send(JSON.stringify({
   *     type: 'history',
   *     logs: recentLogs
   *   }));
   *
   *   // Then stream new logs in real-time
   *   const logHandler = (logLine: string) => {
   *     ws.send(JSON.stringify({ type: 'log', data: logLine }));
   *   };
   *   logStreamBuffer.on('log', logHandler);
   *
   *   ws.on('close', () => {
   *     logStreamBuffer.off('log', logHandler);
   *   });
   * });
   * ```
   *
   * @example API endpoint - paginated log retrieval
   * ```typescript
   * import express from 'express';
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * const app = express();
   *
   * app.get('/api/logs', (req, res) => {
   *   const limit = parseInt(req.query.limit as string) || 100;
   *   const logs = logStreamBuffer.getRecentLogs(limit);
   *
   *   res.json({
   *     logs,
   *     count: logs.length,
   *     timestamp: new Date().toISOString()
   *   });
   * });
   * ```
   *
   * @example Edge case - limit zero
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * logStreamBuffer.addLog('Log 1');
   * logStreamBuffer.addLog('Log 2');
   *
   * const noLogs = logStreamBuffer.getRecentLogs(0);
   * console.log(noLogs); // []
   * ```
   *
   * @example Edge case - limit larger than buffer
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * logStreamBuffer.addLog('Log 1');
   * logStreamBuffer.addLog('Log 2');
   * logStreamBuffer.addLog('Log 3');
   *
   * const allLogs = logStreamBuffer.getRecentLogs(1000);
   * console.log(allLogs); // ['Log 1', 'Log 2', 'Log 3'] (all available logs)
   * console.log(allLogs.length); // 3 (not 1000)
   * ```
   *
   * @example Shallow copy behavior
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * logStreamBuffer.addLog('Log 1');
   * logStreamBuffer.addLog('Log 2');
   *
   * const logs = logStreamBuffer.getRecentLogs();
   * logs.push('Fake log'); // Does NOT affect internal buffer
   *
   * const actualLogs = logStreamBuffer.getRecentLogs();
   * console.log(actualLogs); // ['Log 1', 'Log 2'] (no 'Fake log')
   * ```
   *
   * @example Debugging - display recent errors
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * // Get last 100 logs and filter for errors
   * const recentLogs = logStreamBuffer.getRecentLogs(100);
   * const errorLogs = recentLogs.filter(log => log.includes('ERROR'));
   *
   * console.log(`Found ${errorLogs.length} errors in last 100 logs:`);
   * errorLogs.forEach(log => console.log(log));
   * ```
   *
   * @see {@link addLog} for adding log entries
   * @see {@link clear} for clearing the buffer
   */
  public getRecentLogs(limit?: number): string[] {
    // Handle zero limit explicitly
    if (limit === 0) {
      return [];
    }

    // Handle undefined/null limit or limit larger than buffer
    if (limit === undefined || limit === null || limit >= this.buffer.length) {
      return [...this.buffer];
    }

    return this.buffer.slice(-limit);
  }

  /**
   * Clear all log entries from the buffer.
   *
   * Resets the internal buffer to an empty array, removing all stored log entries.
   * Does NOT emit any events. Use this for cleanup, testing, or when log history
   * is no longer needed.
   *
   * ## Important Notes
   *
   * - Does NOT emit 'clear' or any other event (silent operation)
   * - Does NOT affect active event listeners (listeners remain subscribed)
   * - Does NOT prevent new logs from being added immediately after clearing
   * - Safe to call even when buffer is already empty (no-op)
   *
   * ## Use Cases
   *
   * - Testing: Reset buffer state between tests
   * - Memory management: Free memory after exporting logs
   * - User-triggered action: "Clear log history" button in UI
   * - Rotation: Clear buffer after writing logs to persistent storage
   *
   * @example Basic clearing
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * logStreamBuffer.addLog('Log 1');
   * logStreamBuffer.addLog('Log 2');
   * logStreamBuffer.addLog('Log 3');
   *
   * console.log(logStreamBuffer.getRecentLogs().length); // 3
   *
   * logStreamBuffer.clear();
   *
   * console.log(logStreamBuffer.getRecentLogs().length); // 0
   * ```
   *
   * @example Testing - reset state between tests
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * describe('LogStreamBuffer', () => {
   *   beforeEach(() => {
   *     // Clear buffer before each test
   *     logStreamBuffer.clear();
   *   });
   *
   *   it('should add logs', () => {
   *     logStreamBuffer.addLog('Test log');
   *     expect(logStreamBuffer.getRecentLogs()).toHaveLength(1);
   *   });
   *
   *   it('should retrieve logs', () => {
   *     logStreamBuffer.addLog('Test log 1');
   *     logStreamBuffer.addLog('Test log 2');
   *     expect(logStreamBuffer.getRecentLogs()).toHaveLength(2);
   *   });
   * });
   * ```
   *
   * @example Export and clear workflow
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   * import fs from 'fs';
   *
   * // Export logs to file
   * const logs = logStreamBuffer.getRecentLogs();
   * fs.writeFileSync('/var/log/app-export.log', logs.join('\n'));
   *
   * // Clear buffer to free memory
   * logStreamBuffer.clear();
   *
   * console.log('Exported and cleared', logs.length, 'logs');
   * ```
   *
   * @example User-triggered clear action
   * ```typescript
   * import express from 'express';
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * const app = express();
   *
   * app.post('/api/logs/clear', (req, res) => {
   *   const beforeCount = logStreamBuffer.getRecentLogs().length;
   *   logStreamBuffer.clear();
   *
   *   res.json({
   *     message: 'Logs cleared successfully',
   *     clearedCount: beforeCount,
   *     timestamp: new Date().toISOString()
   *   });
   * });
   * ```
   *
   * @example Log rotation strategy
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   * import fs from 'fs';
   *
   * // Rotate logs every hour
   * setInterval(() => {
   *   const logs = logStreamBuffer.getRecentLogs();
   *
   *   if (logs.length > 0) {
   *     // Write to persistent storage
   *     const timestamp = new Date().toISOString().replace(/:/g, '-');
   *     fs.appendFileSync(`/var/log/app-${timestamp}.log`, logs.join('\n') + '\n');
   *
   *     // Clear buffer after writing
   *     logStreamBuffer.clear();
   *     console.log(`Rotated ${logs.length} logs to persistent storage`);
   *   }
   * }, 60 * 60 * 1000); // Every hour
   * ```
   *
   * @example Event listeners remain active after clear
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * // Add event listener
   * logStreamBuffer.on('log', (logLine) => {
   *   console.log('New log:', logLine);
   * });
   *
   * // Add and clear logs
   * logStreamBuffer.addLog('Log 1'); // Output: New log: Log 1
   * logStreamBuffer.clear();
   *
   * // Listener still active after clear
   * logStreamBuffer.addLog('Log 2'); // Output: New log: Log 2
   * ```
   *
   * @example Safe to call on empty buffer
   * ```typescript
   * import { logStreamBuffer } from './log-stream-buffer';
   *
   * logStreamBuffer.clear(); // No error
   * logStreamBuffer.clear(); // No error (idempotent)
   *
   * console.log(logStreamBuffer.getRecentLogs().length); // 0
   * ```
   *
   * @see {@link addLog} for adding log entries
   * @see {@link getRecentLogs} for retrieving log history
   */
  public clear(): void {
    this.buffer = [];
  }
}

/**
 * Singleton instance of LogStreamBuffer for application-wide log streaming.
 *
 * This is the default exported instance used throughout the application for real-time
 * log buffering and streaming. It uses the default buffer size of 1000 entries.
 *
 * ## Usage
 *
 * Import and use this singleton instance instead of creating new instances to ensure
 * all parts of the application share the same log buffer and event emitter.
 *
 * @example Using the singleton instance
 * ```typescript
 * import { logStreamBuffer } from './log-stream-buffer';
 *
 * // Subscribe to real-time log events
 * logStreamBuffer.on('log', (logLine) => {
 *   console.log('Log:', logLine);
 * });
 *
 * // Add logs (from any part of the application)
 * logStreamBuffer.addLog('[2024-01-02 12:00:00] INFO  Server started');
 *
 * // Retrieve recent logs
 * const recentLogs = logStreamBuffer.getRecentLogs(50);
 * ```
 *
 * @see {@link LogStreamBuffer} for class documentation
 */
export const logStreamBuffer = new LogStreamBuffer();