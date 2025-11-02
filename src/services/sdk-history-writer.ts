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
 * Service for writing SDK conversation messages to history files
 * Maintains compatibility with Claude CLI history format (JSONL)
 */
export class SdkHistoryWriter {
  private logger: Logger;
  private historyDir: string;
  private writeBuffers: Map<string, ConversationMessage[]> = new Map();

  constructor(historyDir?: string) {
    this.logger = createLogger('SdkHistoryWriter');
    this.historyDir = historyDir || path.join(homedir(), '.claude', 'history');
  }

  /**
   * Initialize the history directory if it doesn't exist
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
   * Result messages are stored as system messages for tracking
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
