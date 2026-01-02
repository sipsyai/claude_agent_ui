import { EventEmitter } from 'events';
import { ToolMetrics, StreamEvent, AssistantStreamMessage } from '@/types/index.js';
import { createLogger, type Logger } from './logger.js';
import Anthropic from '@anthropic-ai/sdk';
import { diffLines } from 'diff';

/**
 * ToolMetricsService - Tracks tool usage metrics and code change statistics
 *
 * @description
 * The ToolMetricsService monitors tool usage patterns during Claude conversations and calculates
 * detailed metrics about code changes. It tracks file edits, writes, and line-level changes
 * (additions/removals) by listening to SDK message events and analyzing tool use blocks.
 * This service provides real-time metrics for active sessions and can calculate historical
 * metrics from past conversation messages.
 *
 * **Key Responsibilities:**
 * - Listen to Claude message events and extract tool usage data
 * - Calculate accurate line-level diffs using the 'diff' library
 * - Track Edit and MultiEdit tool usage with line change statistics
 * - Track Write tool usage and count lines added
 * - Maintain per-session metrics in memory
 * - Calculate metrics from historical conversation messages
 * - Provide metrics retrieval for sessions
 *
 * **Architecture:**
 * - **EventEmitter Pattern**: Extends EventEmitter for future event broadcasting
 * - **Per-Session Tracking**: Maintains Map<sessionId, ToolMetrics> for active sessions
 * - **Diff Algorithm**: Uses jsdiff library for accurate line-by-line change detection
 * - **Real-time Processing**: Processes tool use blocks as they arrive in message stream
 * - **Historical Analysis**: Can analyze past conversations via calculateMetricsFromMessages()
 *
 * **Metrics Data Structure:**
 * The service tracks four key metrics per session:
 * - `linesAdded`: Total lines added across all Edit/MultiEdit/Write operations
 * - `linesRemoved`: Total lines removed across all Edit/MultiEdit operations
 * - `editCount`: Number of Edit/MultiEdit operations performed
 * - `writeCount`: Number of Write operations performed
 *
 * **Tool Processing:**
 * - **Edit Tool**: Calculates line diff between old_string and new_string using jsdiff
 * - **MultiEdit Tool**: Processes each edit in the edits array and aggregates metrics
 * - **Write Tool**: Counts lines in the content string and increments linesAdded
 *
 * @example
 * ```typescript
 * // Initialize the service and listen to Claude messages
 * import { ToolMetricsService } from './ToolMetricsService';
 * import { ClaudeProcessManager } from './claude-process-manager';
 *
 * const metricsService = new ToolMetricsService();
 * const processManager = new ClaudeProcessManager(...);
 *
 * // Start listening to message events
 * metricsService.listenToClaudeMessages(processManager);
 *
 * // Later, retrieve metrics for a session
 * const sessionId = 'session_abc123';
 * const metrics = metricsService.getMetrics(sessionId);
 *
 * if (metrics) {
 *   console.log(`Lines added: ${metrics.linesAdded}`);
 *   console.log(`Lines removed: ${metrics.linesRemoved}`);
 *   console.log(`Edits: ${metrics.editCount}, Writes: ${metrics.writeCount}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Calculate metrics from historical conversation messages
 * import { ToolMetricsService } from './ToolMetricsService';
 * import type Anthropic from '@anthropic-ai/sdk';
 *
 * const metricsService = new ToolMetricsService();
 *
 * // Historical messages from conversation
 * const messages: Array<{ type: string; message?: Anthropic.Message }> = [
 *   { type: 'user', message: { role: 'user', content: 'Edit this file...' } },
 *   { type: 'assistant', message: { role: 'assistant', content: [...] } }
 * ];
 *
 * const metrics = metricsService.calculateMetricsFromMessages(messages);
 * console.log('Historical metrics:', metrics);
 * ```
 *
 * @see {@link ToolMetrics} - The metrics data structure
 * @see {@link https://github.com/kpdecker/jsdiff|jsdiff library} - Used for accurate line diffing
 */
export class ToolMetricsService extends EventEmitter {
  private metrics: Map<string, ToolMetrics> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = createLogger('ToolMetricsService');
  }

  /**
   * Start listening to Claude message events from a process manager
   *
   * @description
   * Registers an event listener for 'claude-message' events emitted by the ClaudeProcessManager
   * or ClaudeSdkService. When a message is received, it extracts tool usage data from assistant
   * messages and updates the metrics for the corresponding session.
   *
   * This method should be called once during service initialization to begin tracking metrics
   * for all conversations. The listener will remain active until the process manager is destroyed
   * or the service is torn down.
   *
   * **Event Payload Structure:**
   * ```typescript
   * {
   *   streamingId: string,  // Unique ID for the conversation stream
   *   message: StreamEvent  // SDK message event (user, assistant, result, etc.)
   * }
   * ```
   *
   * **Processing Flow:**
   * 1. Receives 'claude-message' event with streamingId and message
   * 2. Logs the event with message type and session ID for debugging
   * 3. Delegates to handleClaudeMessage() for processing
   * 4. If message is 'assistant' type, processes any tool_use blocks
   * 5. Updates metrics Map with calculated statistics
   *
   * @param {EventEmitter} processManager - The process manager that emits 'claude-message' events.
   *                                         Typically ClaudeProcessManager or ClaudeSdkService.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * import { ToolMetricsService } from './ToolMetricsService';
   * import { ClaudeSdkService } from './claude-sdk-service';
   *
   * const metricsService = new ToolMetricsService();
   * const claudeSdk = new ClaudeSdkService(...);
   *
   * // Start listening to all conversation events
   * metricsService.listenToClaudeMessages(claudeSdk);
   *
   * // Metrics will now be tracked automatically for all sessions
   * ```
   *
   * @see {@link handleClaudeMessage} - Internal handler for processing messages
   * @see {@link processToolUse} - Internal method for calculating tool metrics
   */
  listenToClaudeMessages(processManager: EventEmitter): void {
    processManager.on('claude-message', ({ streamingId, message }: { streamingId: string; message: StreamEvent }) => {
      this.logger.debug('Received claude-message in ToolMetricsService', {
        streamingId,
        messageType: message?.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionId: (message as any)?.session_id
      });
      this.handleClaudeMessage(streamingId, message);
    });
    this.logger.debug('Started listening to claude-message events');
  }

  /**
   * Retrieve tool usage metrics for a specific session
   *
   * @description
   * Returns the accumulated metrics for a given session ID, including lines added/removed,
   * edit count, and write count. Metrics are tracked in memory and updated in real-time
   * as tool use events are processed from the conversation stream.
   *
   * Returns `undefined` if no metrics have been recorded for the session yet. This can
   * happen if the session hasn't used any tracked tools (Edit, MultiEdit, Write) or if
   * the service hasn't received any messages for this session.
   *
   * **Metrics Object Structure:**
   * ```typescript
   * {
   *   linesAdded: number,    // Total lines added (Edit/MultiEdit/Write)
   *   linesRemoved: number,  // Total lines removed (Edit/MultiEdit)
   *   editCount: number,     // Number of Edit/MultiEdit operations
   *   writeCount: number     // Number of Write operations
   * }
   * ```
   *
   * @param {string} sessionId - The Claude session ID to retrieve metrics for.
   *                             This is the session_id from the SDK, not the streamingId.
   *
   * @returns {ToolMetrics | undefined} The metrics object for the session, or undefined
   *                                    if no metrics have been recorded yet.
   *
   * @example
   * ```typescript
   * import { metricsService } from './ToolMetricsService';
   *
   * // After a conversation has started
   * const sessionId = 'session_abc123';
   * const metrics = metricsService.getMetrics(sessionId);
   *
   * if (metrics) {
   *   console.log(`Session ${sessionId} metrics:`);
   *   console.log(`  Lines added: ${metrics.linesAdded}`);
   *   console.log(`  Lines removed: ${metrics.linesRemoved}`);
   *   console.log(`  Total edits: ${metrics.editCount}`);
   *   console.log(`  Total writes: ${metrics.writeCount}`);
   *
   *   // Calculate net change
   *   const netChange = metrics.linesAdded - metrics.linesRemoved;
   *   console.log(`  Net lines changed: ${netChange}`);
   * } else {
   *   console.log('No metrics available yet for this session');
   * }
   * ```
   *
   * @see {@link ToolMetrics} - The metrics data structure
   * @see {@link calculateMetricsFromMessages} - For calculating metrics from historical data
   */
  getMetrics(sessionId: string): ToolMetrics | undefined {
    const metrics = this.metrics.get(sessionId);
    return metrics;
  }


  /**
   * Handle Claude messages to extract tool use data
   */
  private handleClaudeMessage(streamingId: string, message: StreamEvent): void {
    // We're interested in assistant messages that contain tool use
    if (message.type === 'assistant') {
      const assistantMessage = message as AssistantStreamMessage;
      this.processAssistantMessage(streamingId, assistantMessage);
    }
  }

  /**
   * Process assistant messages to find tool use blocks
   */
  private processAssistantMessage(streamingId: string, message: AssistantStreamMessage): void {
    this.logger.debug('Processing assistant message', {
      streamingId,
      sessionId: message.session_id,
      hasMessage: !!message.message,
      hasContent: !!message.message?.content,
      contentType: Array.isArray(message.message?.content) ? 'array' : typeof message.message?.content
    });
    
    if (!message.message || !message.message.content) {
      return;
    }

    const content = message.message.content;
    
    // Content can be a string or an array of content blocks
    if (Array.isArray(content)) {
      this.logger.debug('Processing content blocks', {
        sessionId: message.session_id,
        blockCount: content.length,
        blockTypes: content.map(b => b.type)
      });
      
      content.forEach(block => {
        if (block.type === 'tool_use') {
          this.processToolUse(message.session_id, block);
        }
      });
    }
  }

  /**
   * Process a tool use block to calculate line diffs
   */
  private processToolUse(sessionId: string, toolUse: Anthropic.ToolUseBlock): void {
    const toolName = toolUse.name;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = toolUse.input as Record<string, any>;

    this.logger.debug('Processing tool use', {
      sessionId,
      toolName,
      toolId: toolUse.id,
      inputKeys: Object.keys(input || {})
    });

    // Get or create metrics for this session
    const metrics = this.metrics.get(sessionId) || {
      linesAdded: 0,
      linesRemoved: 0,
      editCount: 0,
      writeCount: 0
    };

    // Handle Edit and MultiEdit tools
    if (toolName === 'Edit' || toolName === 'MultiEdit') {
      if (toolName === 'Edit') {
        metrics.editCount++;
        this.calculateEditLineDiff(input, metrics);
      } else {
        // MultiEdit has an array of edits
        const edits = input.edits as Array<{ old_string?: string; new_string?: string }>;
        if (Array.isArray(edits)) {
          metrics.editCount += edits.length;
          edits.forEach(edit => this.calculateEditLineDiff(edit, metrics));
        }
      }
    }
    // Handle Write tool
    else if (toolName === 'Write') {
      metrics.writeCount++;
      const content = input.content as string;
      if (typeof content === 'string') {
        const lines = this.countLines(content);
        metrics.linesAdded += lines;
        this.logger.debug('Write tool processed', {
          sessionId,
          linesAdded: lines,
          contentLength: content.length
        });
      }
    }

    // Update metrics
    this.metrics.set(sessionId, metrics);
    this.logger.debug('Updated metrics', {
      sessionId,
      metrics
    });
  }

  /**
   * Calculate line diff for an edit operation using proper diff algorithm
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateEditLineDiff(input: Record<string, any>, metrics: ToolMetrics): void {
    const oldString = input.old_string as string;
    const newString = input.new_string as string;

    // Handle edge cases
    if (typeof oldString !== 'string' || typeof newString !== 'string') {
      return;
    }

    // Use jsdiff to get accurate line-by-line changes
    const changes = diffLines(oldString, newString, {
      ignoreWhitespace: false,
      newlineIsToken: false
    });

    let linesAdded = 0;
    let linesRemoved = 0;

    changes.forEach(change => {
      if (change.added) {
        linesAdded += change.count || 0;
      } else if (change.removed) {
        linesRemoved += change.count || 0;
      }
    });

    metrics.linesAdded += linesAdded;
    metrics.linesRemoved += linesRemoved;

  }

  /**
   * Count lines in a string
   */
  private countLines(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    
    // Split by newline and filter out empty trailing line if it exists
    const lines = text.split('\n');
    
    // If the text ends with a newline, we don't count that as an extra line
    if (lines[lines.length - 1] === '') {
      return lines.length - 1;
    }
    
    return lines.length;
  }

  /**
   * Calculate tool usage metrics from historical conversation messages
   *
   * @description
   * Analyzes an array of conversation messages and calculates cumulative tool usage metrics
   * without maintaining session state. This method is primarily used by ClaudeHistoryReader
   * to compute metrics for past conversations loaded from JSONL history files.
   *
   * Unlike real-time tracking via listenToClaudeMessages(), this method processes messages
   * synchronously and returns the final metrics object without storing it in the internal
   * metrics Map. This is ideal for one-time analysis of historical data.
   *
   * **Processing Logic:**
   * 1. Initializes empty metrics object (all counters at 0)
   * 2. Iterates through all messages in the array
   * 3. Filters for 'assistant' type messages with content
   * 4. Extracts tool_use blocks from message content
   * 5. Processes each tool use (Edit, MultiEdit, Write) and updates metrics
   * 6. Returns the final accumulated metrics
   *
   * **Supported Message Types:**
   * - Messages must have `type: 'assistant'` to be processed
   * - Message content must be an array of content blocks
   * - Tool use blocks with types: Edit, MultiEdit, Write are tracked
   *
   * **Metrics Calculation:**
   * - **Edit**: Line diff calculated via jsdiff, incrementing linesAdded/linesRemoved/editCount
   * - **MultiEdit**: Each edit in the edits array is processed independently
   * - **Write**: Lines counted in content string, incrementing linesAdded/writeCount
   *
   * @param {Array<{ type: string; message?: Anthropic.Message | Anthropic.MessageParam }>} messages
   *        Array of conversation messages to analyze. Each message should have:
   *        - `type`: Message type ('user', 'assistant', etc.)
   *        - `message`: Optional Anthropic Message object with content blocks
   *
   * @returns {ToolMetrics} The calculated metrics object with cumulative statistics:
   *                        - linesAdded: Total lines added
   *                        - linesRemoved: Total lines removed
   *                        - editCount: Total edit operations
   *                        - writeCount: Total write operations
   *
   * @example
   * ```typescript
   * import { ToolMetricsService } from './ToolMetricsService';
   * import { ClaudeHistoryReader } from './claude-history-reader';
   *
   * const metricsService = new ToolMetricsService();
   * const historyReader = new ClaudeHistoryReader();
   *
   * // Load historical conversation from JSONL file
   * const history = await historyReader.getConversationHistory('session_abc123');
   *
   * // Calculate metrics from the historical messages
   * const metrics = metricsService.calculateMetricsFromMessages(history.messages);
   *
   * console.log('Historical conversation metrics:');
   * console.log(`Total lines added: ${metrics.linesAdded}`);
   * console.log(`Total lines removed: ${metrics.linesRemoved}`);
   * console.log(`Edit operations: ${metrics.editCount}`);
   * console.log(`Write operations: ${metrics.writeCount}`);
   * ```
   *
   * @example
   * ```typescript
   * // Use with custom message array
   * import { ToolMetricsService } from './ToolMetricsService';
   *
   * const metricsService = new ToolMetricsService();
   *
   * const messages = [
   *   {
   *     type: 'assistant',
   *     message: {
   *       role: 'assistant',
   *       content: [
   *         {
   *           type: 'tool_use',
   *           name: 'Edit',
   *           input: {
   *             old_string: 'const x = 1;\n',
   *             new_string: 'const x = 2;\nconst y = 3;\n'
   *           }
   *         }
   *       ]
   *     }
   *   }
   * ];
   *
   * const metrics = metricsService.calculateMetricsFromMessages(messages);
   * // Result: { linesAdded: 2, linesRemoved: 1, editCount: 1, writeCount: 0 }
   * ```
   *
   * @see {@link ToolMetrics} - The metrics data structure
   * @see {@link getMetrics} - For retrieving real-time session metrics
   * @see {@link processToolUseForMetrics} - Internal method that processes each tool use
   */
  calculateMetricsFromMessages(messages: Array<{
    type: string;
    message?: Anthropic.Message | Anthropic.MessageParam
  }>): ToolMetrics {
    const metrics: ToolMetrics = {
      linesAdded: 0,
      linesRemoved: 0,
      editCount: 0,
      writeCount: 0
    };

    messages.forEach(msg => {
      if (msg.type === 'assistant' && msg.message) {
        const message = msg.message as Anthropic.Message;
        if (message.content && Array.isArray(message.content)) {
          message.content.forEach(block => {
            if (block.type === 'tool_use') {
              this.processToolUseForMetrics(block, metrics);
            }
          });
        }
      }
    });

    return metrics;
  }

  /**
   * Process tool use for direct metrics calculation (used for historical data)
   */
  private processToolUseForMetrics(toolUse: Anthropic.ToolUseBlock, metrics: ToolMetrics): void {
    const toolName = toolUse.name;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = toolUse.input as Record<string, any>;

    if (toolName === 'Edit' || toolName === 'MultiEdit') {
      if (toolName === 'Edit') {
        metrics.editCount++;
        this.calculateEditLineDiff(input, metrics);
      } else {
        const edits = input.edits as Array<{ old_string?: string; new_string?: string }>;
        if (Array.isArray(edits)) {
          metrics.editCount += edits.length;
          edits.forEach(edit => this.calculateEditLineDiff(edit, metrics));
        }
      }
    } else if (toolName === 'Write') {
      metrics.writeCount++;
      const content = input.content as string;
      if (typeof content === 'string') {
        metrics.linesAdded += this.countLines(content);
      }
    }
  }
}