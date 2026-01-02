import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type {
  ConversationMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
} from '@/types/index.js';
import { createLogger, type Logger } from './logger.js';

/**
 * SdkHistoryWriter - Write SDK conversation messages to JSONL history files
 *
 * @description
 * The SdkHistoryWriter service writes SDK conversation messages to persistent JSONL history files,
 * maintaining compatibility with the Claude CLI history format. It stores messages in
 * `~/.claude/history/{sessionId}.jsonl` files, enabling conversation persistence, resumption,
 * and audit trails across SDK sessions.
 *
 * **Key Responsibilities:**
 * - Write user, assistant, and system messages to JSONL history files
 * - Transform SDK message formats to ConversationMessage format
 * - Initialize history directory structure (~/.claude/history/)
 * - Append messages to session-specific JSONL files
 * - Flush buffered messages for graceful shutdown
 * - Track message metadata (timestamps, cost, usage, sidechains)
 * - Provide history existence and message count utilities
 *
 * **Architecture:**
 * - **File Format**: JSONL (JSON Lines) - one JSON object per line, newline-delimited
 * - **File Location**: `~/.claude/history/{sessionId}.jsonl` (one file per SDK session)
 * - **Message Types**: user, assistant, system (for conversation results/metadata)
 * - **Append-Only**: Messages are appended, never modified (audit trail)
 * - **Graceful Degradation**: Write failures don't break conversation flow (logged as errors)
 * - **No Buffering**: Messages written immediately (flush available for shutdown cleanup)
 * - **Sidechain Support**: Tracks parent tool use IDs for nested conversations (agent sidechains)
 *
 * **JSONL File Structure:**
 * Each line is a ConversationMessage JSON object:
 * ```jsonl
 * {"uuid":"msg-123","type":"user","message":{"role":"user","content":[{"type":"text","text":"Hello"}]},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"session-abc","cwd":"/project","version":"1.0.0"}
 * {"uuid":"msg-456","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi there!"}]},"timestamp":"2024-01-01T00:00:05.000Z","sessionId":"session-abc","cwd":"/project","version":"1.0.0"}
 * {"uuid":"msg-789","type":"system","message":{"role":"assistant","content":[{"type":"text","text":"Conversation completed: success"}]},"timestamp":"2024-01-01T00:00:10.000Z","sessionId":"session-abc","durationMs":5000,"cwd":"/project","version":"1.0.0"}
 * ```
 *
 * **Message Types:**
 * - **user**: User messages with text/image/document content blocks
 * - **assistant**: Assistant responses with text/tool use content blocks
 * - **system**: Conversation metadata (completion, errors, results)
 *
 * **Sidechain Messages:**
 * Messages with `parentUuid` and `isSidechain: true` represent nested conversations
 * triggered by tool uses (e.g., Task tool launching autonomous agents).
 *
 * **Use Cases:**
 * - Conversation persistence across SDK restarts
 * - Resume conversations with existing context
 * - Audit trails for compliance and debugging
 * - Cost tracking and usage analytics
 * - Conversation export and replay
 * - Integration with Claude CLI history reader
 *
 * @example
 * ```typescript
 * // Initialize writer and create history directory
 * import { SdkHistoryWriter } from './sdk-history-writer';
 *
 * const writer = new SdkHistoryWriter();
 * await writer.initialize();
 * // Creates ~/.claude/history/ directory if not exists
 * ```
 *
 * @example
 * ```typescript
 * // Write user message to history
 * import { SdkHistoryWriter } from './sdk-history-writer';
 * import type { SDKUserMessage } from '@/types';
 *
 * const writer = new SdkHistoryWriter();
 * await writer.initialize();
 *
 * const userMessage: SDKUserMessage = {
 *   uuid: 'msg-user-123',
 *   session_id: 'session-abc',
 *   message: {
 *     role: 'user',
 *     content: [{ type: 'text', text: 'Review this code' }]
 *   }
 * };
 *
 * await writer.writeUserMessage(userMessage, '/project', '1.0.0');
 * // Appends to ~/.claude/history/session-abc.jsonl
 * ```
 *
 * @example
 * ```typescript
 * // Write assistant message with tool uses to history
 * import { SdkHistoryWriter } from './sdk-history-writer';
 * import type { SDKAssistantMessage } from '@/types';
 *
 * const writer = new SdkHistoryWriter();
 * await writer.initialize();
 *
 * const assistantMessage: SDKAssistantMessage = {
 *   uuid: 'msg-assistant-456',
 *   session_id: 'session-abc',
 *   message: {
 *     role: 'assistant',
 *     content: [
 *       { type: 'text', text: 'Let me read that file.' },
 *       { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'code.ts' } }
 *     ]
 *   }
 * };
 *
 * await writer.writeAssistantMessage(assistantMessage, '/project', '1.0.0');
 * // Appends assistant message to ~/.claude/history/session-abc.jsonl
 * ```
 *
 * @example
 * ```typescript
 * // Write sidechain message (nested conversation from Task tool)
 * import { SdkHistoryWriter } from './sdk-history-writer';
 * import type { SDKAssistantMessage } from '@/types';
 *
 * const writer = new SdkHistoryWriter();
 * await writer.initialize();
 *
 * // Main conversation assistant message triggers Task tool
 * const mainMessage: SDKAssistantMessage = {
 *   uuid: 'msg-main-1',
 *   session_id: 'session-abc',
 *   message: {
 *     role: 'assistant',
 *     content: [
 *       { type: 'tool_use', id: 'task-tool-1', name: 'Task', input: { prompt: 'Debug auth bug' } }
 *     ]
 *   }
 * };
 * await writer.writeAssistantMessage(mainMessage);
 *
 * // Sidechain message from Task agent (nested conversation)
 * const sidechainMessage: SDKAssistantMessage = {
 *   uuid: 'msg-sidechain-1',
 *   session_id: 'session-abc',
 *   parent_tool_use_id: 'task-tool-1', // Links to parent tool use
 *   message: {
 *     role: 'assistant',
 *     content: [{ type: 'text', text: 'Found the auth bug in login.ts' }]
 *   }
 * };
 * await writer.writeAssistantMessage(sidechainMessage);
 * // Written with isSidechain: true, parentUuid: 'task-tool-1'
 * ```
 *
 * @example
 * ```typescript
 * // Write conversation result message
 * import { SdkHistoryWriter } from './sdk-history-writer';
 * import type { SDKResultMessage } from '@/types';
 *
 * const writer = new SdkHistoryWriter();
 * await writer.initialize();
 *
 * const resultMessage: SDKResultMessage = {
 *   uuid: 'result-123',
 *   session_id: 'session-abc',
 *   subtype: 'completed',
 *   result: 'success',
 *   duration_ms: 5000
 * };
 *
 * await writer.writeResultMessage(resultMessage, '/project', '1.0.0');
 * // Writes system message tracking conversation completion
 * ```
 *
 * @example
 * ```typescript
 * // Flush buffered messages on shutdown
 * import { SdkHistoryWriter } from './sdk-history-writer';
 *
 * const writer = new SdkHistoryWriter();
 * await writer.initialize();
 *
 * // ... write messages during conversation ...
 *
 * // Graceful shutdown: flush any buffered messages
 * await writer.flush('session-abc');
 * // Ensures all messages written to disk before process exit
 * ```
 *
 * @example
 * ```typescript
 * // Check history existence and message count
 * import { SdkHistoryWriter } from './sdk-history-writer';
 *
 * const writer = new SdkHistoryWriter();
 * await writer.initialize();
 *
 * // Check if session has history file
 * const exists = await writer.historyExists('session-abc');
 * console.log(`History exists: ${exists}`);
 *
 * // Get message count for session
 * const count = await writer.getMessageCount('session-abc');
 * console.log(`Message count: ${count}`);
 * // Returns 0 if file doesn't exist (graceful degradation)
 * ```
 */
export class SdkHistoryWriter {
  /** Logger instance for debugging history write operations */
  private logger: Logger;

  /** Directory path where history JSONL files are stored (default: ~/.claude/history) */
  private historyDir: string;

  /** Write buffers for batching messages per session (currently unused, reserved for future optimization) */
  private writeBuffers: Map<string, ConversationMessage[]> = new Map();

  constructor(historyDir?: string) {
    this.logger = createLogger('SdkHistoryWriter');
    this.historyDir = historyDir || path.join(homedir(), '.claude', 'history');
  }

  /**
   * Initialize the history directory if it doesn't exist
   *
   * @description
   * Creates the history directory structure (~/.claude/history/) if it doesn't already exist.
   * This method is idempotent and safe to call multiple times. It should be called before
   * writing any messages to ensure the directory exists.
   *
   * **Workflow:**
   * 1. Attempt to create history directory with { recursive: true }
   * 2. Log success with directory path
   * 3. If creation fails, log error and rethrow
   *
   * **Directory Creation:**
   * - Uses fs.mkdir with { recursive: true } (creates parent directories if needed)
   * - Idempotent: no error if directory already exists
   * - Default location: ~/.claude/history/ (unless custom historyDir provided to constructor)
   *
   * @returns {Promise<void>} Resolves when directory is created or already exists
   *
   * @throws {Error} If directory creation fails due to permissions or filesystem errors
   *
   * @example
   * ```typescript
   * // Initialize on service startup
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   * // Creates ~/.claude/history/ directory
   * console.log('History directory ready');
   * ```
   *
   * @example
   * ```typescript
   * // Initialize with custom directory
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter('/custom/path/history');
   * await writer.initialize();
   * // Creates /custom/path/history/ directory
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent initialization (safe to call multiple times)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize(); // Creates directory
   * await writer.initialize(); // No-op, directory already exists
   * await writer.initialize(); // Still safe
   * ```
   *
   * @example
   * ```typescript
   * // Handle initialization errors
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter('/root/protected/history');
   *
   * try {
   *   await writer.initialize();
   * } catch (error) {
   *   console.error('Failed to create history directory:', error);
   *   // Handle permission error or use fallback directory
   * }
   * ```
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
      this.logger.info('History directory initialized', { path: this.historyDir });
    } catch (error) {
      this.logger.error('Failed to initialize history directory', error, {
        path: this.historyDir,
      });
      throw error;
    }
  }

  /**
   * Write an assistant message to history
   *
   * @description
   * Transforms an SDK assistant message to ConversationMessage format and appends it to the
   * session's JSONL history file. Assistant messages contain Claude's responses, including
   * text content and tool use blocks.
   *
   * **Workflow:**
   * 1. Transform SDKAssistantMessage to ConversationMessage format
   * 2. Add timestamp, sessionId, cwd, version metadata
   * 3. Detect sidechain messages (parent_tool_use_id present)
   * 4. Append message to ~/.claude/history/{sessionId}.jsonl
   *
   * **Message Transformation:**
   * - Preserves message.role and message.content from SDK format
   * - Adds uuid, type: 'assistant', timestamp, sessionId
   * - Sets parentUuid and isSidechain if parent_tool_use_id present
   * - Includes cwd and version metadata for environment tracking
   *
   * **Sidechain Messages:**
   * Messages with parent_tool_use_id represent nested conversations triggered by tools
   * (e.g., Task tool launching autonomous agents). These are marked with isSidechain: true
   * and parentUuid for conversation tree reconstruction.
   *
   * **Error Handling:**
   * Write failures are logged but don't throw errors (graceful degradation).
   * Conversation flow continues even if history write fails.
   *
   * @param {SDKAssistantMessage} sdkMessage - The SDK assistant message to write
   * @param {string} [cwd] - Optional working directory for context tracking
   * @param {string} [version] - Optional SDK version for compatibility tracking
   *
   * @returns {Promise<void>} Resolves when message is written to history file
   *
   * @example
   * ```typescript
   * // Write basic assistant text response
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKAssistantMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const assistantMessage: SDKAssistantMessage = {
   *   uuid: 'msg-assistant-123',
   *   session_id: 'session-abc',
   *   message: {
   *     role: 'assistant',
   *     content: [
   *       { type: 'text', text: 'The code looks good!' }
   *     ]
   *   }
   * };
   *
   * await writer.writeAssistantMessage(assistantMessage, '/project', '1.0.0');
   * // Appends to ~/.claude/history/session-abc.jsonl
   * ```
   *
   * @example
   * ```typescript
   * // Write assistant message with tool uses
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKAssistantMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const assistantMessage: SDKAssistantMessage = {
   *   uuid: 'msg-assistant-456',
   *   session_id: 'session-abc',
   *   message: {
   *     role: 'assistant',
   *     content: [
   *       { type: 'text', text: 'Let me read that file and analyze it.' },
   *       { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'code.ts' } },
   *       { type: 'tool_use', id: 'tool-2', name: 'Grep', input: { pattern: 'TODO', path: 'src/' } }
   *     ]
   *   }
   * };
   *
   * await writer.writeAssistantMessage(assistantMessage, '/project', '1.0.0');
   * // Writes assistant message with 2 tool use blocks
   * ```
   *
   * @example
   * ```typescript
   * // Write sidechain message (nested conversation from Task tool)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKAssistantMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * // Main conversation assistant triggers Task tool
   * const mainMessage: SDKAssistantMessage = {
   *   uuid: 'msg-main-1',
   *   session_id: 'session-abc',
   *   message: {
   *     role: 'assistant',
   *     content: [
   *       { type: 'tool_use', id: 'task-123', name: 'Task', input: { prompt: 'Debug auth' } }
   *     ]
   *   }
   * };
   * await writer.writeAssistantMessage(mainMessage);
   *
   * // Task agent response (sidechain)
   * const sidechainMessage: SDKAssistantMessage = {
   *   uuid: 'msg-sidechain-1',
   *   session_id: 'session-abc',
   *   parent_tool_use_id: 'task-123', // Links to parent tool
   *   message: {
   *     role: 'assistant',
   *     content: [{ type: 'text', text: 'Found auth bug in login.ts line 42' }]
   *   }
   * };
   * await writer.writeAssistantMessage(sidechainMessage);
   * // Written with isSidechain: true, parentUuid: 'task-123'
   * ```
   *
   * @example
   * ```typescript
   * // Write without optional metadata
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKAssistantMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const assistantMessage: SDKAssistantMessage = {
   *   uuid: 'msg-assistant-789',
   *   session_id: 'session-xyz',
   *   message: {
   *     role: 'assistant',
   *     content: [{ type: 'text', text: 'Hello!' }]
   *   }
   * };
   *
   * await writer.writeAssistantMessage(assistantMessage);
   * // Writes without cwd/version metadata (optional fields omitted)
   * ```
   */
  async writeAssistantMessage(
    sdkMessage: SDKAssistantMessage,
    cwd?: string,
    version?: string
  ): Promise<void> {
    const historyMessage: ConversationMessage = {
      uuid: sdkMessage.uuid,
      type: 'assistant',
      message: sdkMessage.message,
      timestamp: new Date().toISOString(),
      sessionId: sdkMessage.session_id,
      parentUuid: sdkMessage.parent_tool_use_id || undefined,
      isSidechain: !!sdkMessage.parent_tool_use_id,
      cwd,
      version,
    };

    await this.appendToHistory(sdkMessage.session_id, historyMessage);
  }

  /**
   * Write a user message to history
   *
   * @description
   * Transforms an SDK user message to ConversationMessage format and appends it to the
   * session's JSONL history file. User messages contain user input, including text,
   * images, documents, and other content blocks.
   *
   * **Workflow:**
   * 1. Transform SDKUserMessage to ConversationMessage format
   * 2. Generate uuid if not provided (fallback: `user-{timestamp}`)
   * 3. Add timestamp, sessionId, cwd, version, userType metadata
   * 4. Detect sidechain messages (parent_tool_use_id present)
   * 5. Append message to ~/.claude/history/{sessionId}.jsonl
   *
   * **Message Transformation:**
   * - Preserves message.role and message.content from SDK format
   * - Adds uuid (or generates fallback), type: 'user', timestamp, sessionId
   * - Sets userType: 'external' (distinguishes from internal/system messages)
   * - Sets parentUuid and isSidechain if parent_tool_use_id present
   * - Includes cwd and version metadata for environment tracking
   *
   * **UUID Handling:**
   * SDK user messages may not have a uuid (optional field). This method generates a
   * fallback uuid using `user-{Date.now()}` to ensure all messages have unique identifiers
   * for conversation tracking.
   *
   * **Sidechain Messages:**
   * User messages with parent_tool_use_id represent user input within nested conversations
   * (e.g., user responding to Task agent prompt). These are marked with isSidechain: true.
   *
   * **Error Handling:**
   * Write failures are logged but don't throw errors (graceful degradation).
   * Conversation flow continues even if history write fails.
   *
   * @param {SDKUserMessage} sdkMessage - The SDK user message to write
   * @param {string} [cwd] - Optional working directory for context tracking
   * @param {string} [version] - Optional SDK version for compatibility tracking
   *
   * @returns {Promise<void>} Resolves when message is written to history file
   *
   * @example
   * ```typescript
   * // Write basic user text message
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKUserMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const userMessage: SDKUserMessage = {
   *   uuid: 'msg-user-123',
   *   session_id: 'session-abc',
   *   message: {
   *     role: 'user',
   *     content: [
   *       { type: 'text', text: 'Review this code for bugs' }
   *     ]
   *   }
   * };
   *
   * await writer.writeUserMessage(userMessage, '/project', '1.0.0');
   * // Appends to ~/.claude/history/session-abc.jsonl
   * ```
   *
   * @example
   * ```typescript
   * // Write user message with image attachment
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKUserMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const userMessage: SDKUserMessage = {
   *   uuid: 'msg-user-456',
   *   session_id: 'session-abc',
   *   message: {
   *     role: 'user',
   *     content: [
   *       { type: 'text', text: 'What is in this screenshot?' },
   *       {
   *         type: 'image',
   *         source: {
   *           type: 'base64',
   *           media_type: 'image/png',
   *           data: 'iVBORw0KGgoAAAANSUhEUgA...'
   *         }
   *       }
   *     ]
   *   }
   * };
   *
   * await writer.writeUserMessage(userMessage, '/project', '1.0.0');
   * // Writes user message with image attachment
   * ```
   *
   * @example
   * ```typescript
   * // Write user message without uuid (auto-generated)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKUserMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const userMessage: SDKUserMessage = {
   *   // uuid omitted (optional field)
   *   session_id: 'session-abc',
   *   message: {
   *     role: 'user',
   *     content: [{ type: 'text', text: 'Hello' }]
   *   }
   * };
   *
   * await writer.writeUserMessage(userMessage);
   * // Generates uuid: 'user-1704067200000' (timestamp-based fallback)
   * ```
   *
   * @example
   * ```typescript
   * // Write user message with document (PDF)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKUserMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const userMessage: SDKUserMessage = {
   *   uuid: 'msg-user-789',
   *   session_id: 'session-abc',
   *   message: {
   *     role: 'user',
   *     content: [
   *       { type: 'text', text: 'Summarize this document' },
   *       {
   *         type: 'document',
   *         source: {
   *           type: 'base64',
   *           media_type: 'application/pdf',
   *           data: 'JVBERi0xLjQKJeLjz9MK...'
   *         }
   *       }
   *     ]
   *   }
   * };
   *
   * await writer.writeUserMessage(userMessage, '/project', '1.0.0');
   * // Writes user message with PDF document
   * ```
   *
   * @example
   * ```typescript
   * // Write sidechain user message (nested conversation input)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKUserMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const sidechainUserMessage: SDKUserMessage = {
   *   uuid: 'msg-sidechain-user-1',
   *   session_id: 'session-abc',
   *   parent_tool_use_id: 'task-123', // Links to parent Task tool
   *   message: {
   *     role: 'user',
   *     content: [{ type: 'text', text: 'Check auth.ts file' }]
   *   }
   * };
   *
   * await writer.writeUserMessage(sidechainUserMessage);
   * // Written with isSidechain: true, parentUuid: 'task-123'
   * ```
   */
  async writeUserMessage(
    sdkMessage: SDKUserMessage,
    cwd?: string,
    version?: string
  ): Promise<void> {
    const historyMessage: ConversationMessage = {
      uuid: sdkMessage.uuid || `user-${Date.now()}`,
      type: 'user',
      message: sdkMessage.message,
      timestamp: new Date().toISOString(),
      sessionId: sdkMessage.session_id,
      parentUuid: sdkMessage.parent_tool_use_id || undefined,
      isSidechain: !!sdkMessage.parent_tool_use_id,
      userType: 'external',
      cwd,
      version,
    };

    await this.appendToHistory(sdkMessage.session_id, historyMessage);
  }

  /**
   * Write a result message metadata to history
   *
   * @description
   * Transforms an SDK result message to a ConversationMessage system message and appends it
   * to the session's JSONL history file. Result messages track conversation lifecycle events
   * (completion, errors, cancellation) with duration and outcome metadata.
   *
   * **Workflow:**
   * 1. Transform SDKResultMessage to ConversationMessage with type: 'system'
   * 2. Create text content summarizing result (subtype + result)
   * 3. Add timestamp, sessionId, durationMs, cwd, version metadata
   * 4. Append system message to ~/.claude/history/{sessionId}.jsonl
   *
   * **Message Transformation:**
   * - Type: 'system' (not user/assistant, metadata message)
   * - Message: assistant role with text describing result
   * - Content: "Conversation {subtype}: {result}" (e.g., "Conversation completed: success")
   * - Includes durationMs for performance tracking
   * - Preserves uuid, sessionId, timestamp for correlation
   *
   * **Result Types (subtype field):**
   * - `completed`: Conversation finished successfully
   * - `error`: Conversation failed with error
   * - `cancelled`: Conversation cancelled by user or system
   *
   * **Use Cases:**
   * - Track conversation lifecycle events (start, completion, errors)
   * - Measure conversation duration for performance analysis
   * - Audit trail for conversation outcomes
   * - Filter system metadata messages from user/assistant messages
   * - Debug conversation failures and cancellations
   *
   * **Error Handling:**
   * Write failures are logged but don't throw errors (graceful degradation).
   * Conversation flow continues even if history write fails.
   *
   * @param {SDKResultMessage} sdkMessage - The SDK result message to write
   * @param {string} [cwd] - Optional working directory for context tracking
   * @param {string} [version] - Optional SDK version for compatibility tracking
   *
   * @returns {Promise<void>} Resolves when message is written to history file
   *
   * @example
   * ```typescript
   * // Write successful conversation completion result
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKResultMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const resultMessage: SDKResultMessage = {
   *   uuid: 'result-123',
   *   session_id: 'session-abc',
   *   subtype: 'completed',
   *   result: 'success',
   *   duration_ms: 5000
   * };
   *
   * await writer.writeResultMessage(resultMessage, '/project', '1.0.0');
   * // Writes system message: "Conversation completed: success" with durationMs: 5000
   * // Appends to ~/.claude/history/session-abc.jsonl
   * ```
   *
   * @example
   * ```typescript
   * // Write conversation error result
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKResultMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const errorResult: SDKResultMessage = {
   *   uuid: 'result-456',
   *   session_id: 'session-abc',
   *   subtype: 'error',
   *   result: 'API rate limit exceeded',
   *   duration_ms: 1200
   * };
   *
   * await writer.writeResultMessage(errorResult, '/project', '1.0.0');
   * // Writes system message: "Conversation error: API rate limit exceeded"
   * // Useful for debugging conversation failures
   * ```
   *
   * @example
   * ```typescript
   * // Write conversation cancellation result
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKResultMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const cancelledResult: SDKResultMessage = {
   *   uuid: 'result-789',
   *   session_id: 'session-abc',
   *   subtype: 'cancelled',
   *   result: 'User cancelled conversation',
   *   duration_ms: 3500
   * };
   *
   * await writer.writeResultMessage(cancelledResult, '/project', '1.0.0');
   * // Writes system message: "Conversation cancelled: User cancelled conversation"
   * ```
   *
   * @example
   * ```typescript
   * // Write result without optional result field
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import type { SDKResultMessage } from '@/types';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * const resultMessage: SDKResultMessage = {
   *   uuid: 'result-101',
   *   session_id: 'session-xyz',
   *   subtype: 'completed',
   *   // result omitted (optional field)
   *   duration_ms: 2000
   * };
   *
   * await writer.writeResultMessage(resultMessage);
   * // Writes system message: "Conversation completed: completed"
   * // Falls back to subtype when result not provided
   * ```
   *
   * @example
   * ```typescript
   * // Filter system result messages from conversation history
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import * as fs from 'fs/promises';
   *
   * const writer = new SdkHistoryWriter();
   *
   * // Read history file
   * const historyFile = '~/.claude/history/session-abc.jsonl';
   * const content = await fs.readFile(historyFile, 'utf-8');
   * const messages = content.trim().split('\n').map(line => JSON.parse(line));
   *
   * // Filter out system messages to get user/assistant conversation
   * const conversation = messages.filter(msg => msg.type !== 'system');
   * console.log(`Conversation messages: ${conversation.length}`);
   *
   * // Get result messages for analytics
   * const results = messages.filter(msg => msg.type === 'system');
   * console.log(`Result messages: ${results.length}`);
   * console.log(`Average duration: ${results.reduce((sum, r) => sum + (r.durationMs || 0), 0) / results.length}ms`);
   * ```
   */
  async writeResultMessage(
    sdkMessage: SDKResultMessage,
    cwd?: string,
    version?: string
  ): Promise<void> {
    // Create a system message to track the conversation result
    const historyMessage: ConversationMessage = {
      uuid: sdkMessage.uuid,
      type: 'system',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Conversation ${sdkMessage.subtype}: ${sdkMessage.result || 'completed'}`,
          },
        ],
      },
      timestamp: new Date().toISOString(),
      sessionId: sdkMessage.session_id,
      durationMs: sdkMessage.duration_ms,
      cwd,
      version,
    };

    await this.appendToHistory(sdkMessage.session_id, historyMessage);
  }

  /**
   * Append a message to the session's history file
   */
  private async appendToHistory(
    sessionId: string,
    message: ConversationMessage
  ): Promise<void> {
    try {
      const historyFile = this.getHistoryFilePath(sessionId);
      this.logger.info('📁 Appending to history file', { sessionId, historyFile, messageType: message.type });

      const jsonLine = JSON.stringify(message) + '\n';
      this.logger.info('📄 JSON line prepared', { sessionId, jsonLength: jsonLine.length });

      await fs.appendFile(historyFile, jsonLine, 'utf-8');
      this.logger.info('✅ File write completed', { sessionId, historyFile });

      this.logger.debug('Message written to history', {
        sessionId,
        messageType: message.type,
        uuid: message.uuid,
      });
    } catch (error) {
      this.logger.error('❌ Failed to write message to history', error, {
        sessionId,
        messageUuid: message.uuid,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - history writing should not break the conversation
    }
  }

  /**
   * Get the history file path for a session
   */
  private getHistoryFilePath(sessionId: string): string {
    return path.join(this.historyDir, `${sessionId}.jsonl`);
  }

  /**
   * Flush any buffered messages for a session
   *
   * @description
   * Writes any buffered messages for the specified session to the history file and clears
   * the buffer. This method is intended for graceful shutdown scenarios to ensure all
   * pending messages are persisted before the process exits.
   *
   * **Current Implementation Note:**
   * The current implementation uses immediate writes (messages appended directly in
   * writeUserMessage, writeAssistantMessage, writeResultMessage), so flush typically
   * has nothing to do. The writeBuffers map is reserved for future optimization if
   * batching is needed for performance.
   *
   * **Workflow:**
   * 1. Check if buffer exists for sessionId
   * 2. Return early if buffer is empty (no-op)
   * 3. Convert buffered messages to JSONL format (one JSON per line)
   * 4. Append all buffered messages to history file in single write
   * 5. Clear buffer for sessionId
   * 6. Log flush completion
   *
   * **Use Cases:**
   * - Graceful shutdown: flush pending messages before process exit
   * - Manual flush after batch operations (future optimization)
   * - Testing: ensure all messages written before assertions
   * - Periodic flush for long-running sessions (future optimization)
   *
   * **Error Handling:**
   * Flush failures are logged but don't throw errors (graceful degradation).
   * This ensures shutdown can proceed even if flush fails.
   *
   * @param {string} sessionId - The SDK session ID to flush messages for
   *
   * @returns {Promise<void>} Resolves when buffered messages are flushed (or buffer is empty)
   *
   * @example
   * ```typescript
   * // Graceful shutdown: flush all sessions
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * // ... write messages during conversation ...
   *
   * // Shutdown handler
   * process.on('SIGTERM', async () => {
   *   console.log('Shutting down gracefully...');
   *   await writer.flush('session-abc');
   *   await writer.flush('session-xyz');
   *   process.exit(0);
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Flush after batch message writes (future optimization scenario)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * // Hypothetical batched writes (not currently implemented)
   * // await writer.writeUserMessage(msg1, { buffered: true });
   * // await writer.writeAssistantMessage(msg2, { buffered: true });
   * // await writer.writeAssistantMessage(msg3, { buffered: true });
   *
   * // Flush batch to disk
   * await writer.flush('session-abc');
   * // All 3 messages written in single file append
   * ```
   *
   * @example
   * ```typescript
   * // Testing: ensure messages written before assertions
   * import { SdkHistoryWriter } from './sdk-history-writer';
   * import * as fs from 'fs/promises';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * // Write messages
   * await writer.writeUserMessage(userMsg, '/project', '1.0.0');
   * await writer.writeAssistantMessage(assistantMsg, '/project', '1.0.0');
   *
   * // Flush to ensure writes complete
   * await writer.flush('session-abc');
   *
   * // Now safe to assert file contents
   * const content = await fs.readFile('~/.claude/history/session-abc.jsonl', 'utf-8');
   * const messages = content.trim().split('\n').map(line => JSON.parse(line));
   * expect(messages.length).toBe(2);
   * ```
   *
   * @example
   * ```typescript
   * // Idempotent flush (safe to call multiple times)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * await writer.flush('session-abc'); // No-op if buffer empty
   * await writer.flush('session-abc'); // Still safe
   * await writer.flush('session-abc'); // Idempotent
   * ```
   *
   * @example
   * ```typescript
   * // Periodic flush for long-running sessions (future optimization)
   * import { SdkHistoryWriter } from './sdk-history-writer';
   *
   * const writer = new SdkHistoryWriter();
   * await writer.initialize();
   *
   * // Flush every 60 seconds
   * setInterval(async () => {
   *   const activeSessions = ['session-abc', 'session-xyz', 'session-123'];
   *   for (const sessionId of activeSessions) {
   *     await writer.flush(sessionId);
   *   }
   *   console.log('Periodic flush completed');
   * }, 60000);
   * ```
   */
  async flush(sessionId: string): Promise<void> {
    const buffer = this.writeBuffers.get(sessionId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    try {
      const historyFile = this.getHistoryFilePath(sessionId);
      const content = buffer.map((msg) => JSON.stringify(msg)).join('\n') + '\n';

      await fs.appendFile(historyFile, content, 'utf-8');

      this.writeBuffers.delete(sessionId);

      this.logger.debug('Flushed message buffer to history', {
        sessionId,
        messageCount: buffer.length,
      });
    } catch (error) {
      this.logger.error('Failed to flush message buffer', error, { sessionId });
    }
  }

  /**
   * Check if a history file exists for a session
   */
  async historyExists(sessionId: string): Promise<boolean> {
    try {
      const historyFile = this.getHistoryFilePath(sessionId);
      await fs.access(historyFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the message count for a session
   */
  async getMessageCount(sessionId: string): Promise<number> {
    try {
      const historyFile = this.getHistoryFilePath(sessionId);
      const content = await fs.readFile(historyFile, 'utf-8');
      const lines = content.trim().split('\n').filter((line) => line.trim());
      return lines.length;
    } catch {
      return 0;
    }
  }
}
