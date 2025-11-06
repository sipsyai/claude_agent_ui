/**
 * Chat Log Service - Manages chat session logs in filesystem
 *
 * This service handles:
 * - Creating log files for chat sessions
 * - Updating logs with new messages
 * - Tracking session metadata
 * - Cost and usage aggregation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger, type Logger } from './logger.js';
import type { ChatSession, ChatMessage } from '../types/chat-types.js';

export interface ChatLog {
  sessionDocumentId: string;
  title: string;
  status: 'active' | 'archived';
  skills: {
    id: number;
    documentId: string;
    name: string;
  }[];
  sdkSessionId: string | null;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatLogMessage[];
  sdkCalls: SdkCallLog[];
  totalCost: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
}

export interface ChatLogMessage {
  id: number;
  documentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: any[];
  metadata?: {
    cost?: number;
    usage?: any;
    toolUses?: any[];
  };
}

export interface SdkCallLog {
  callId: string;
  userMessageId: string;
  assistantMessageId?: string;
  timestamp: string;
  request: {
    options: {
      model: string;
      permissionMode: string;
      includePartialMessages: boolean;
      settingSources: string[];
      cwd: string;
      allowedTools: string[];
      resume?: string;
    };
    prompt: {
      type: string;
      message: {
        role: string;
        content: any;
      };
    };
  };
  events: SdkEventLog[];
  finalResult?: {
    cost?: number;
    usage?: any;
  };
}

export interface SdkEventLog {
  timestamp: string;
  type: string;
  subtype?: string;
  category?: string; // Event category: 'system', 'assistant_message', 'text_delta', 'result', etc.
  details?: {
    messageType?: string;
    subtype?: string;
    sessionId?: string;
    model?: string;
    tools?: string[] | any[];
    permissionMode?: string;
    hasText?: boolean;
    hasToolUse?: boolean;
    toolCount?: number;
    textLength?: number;
    isError?: boolean;
    numTurns?: number;
    totalCost?: number;
    duration?: number;
    [key: string]: any; // Allow additional dynamic properties
  };
  data: any;
}

export class ChatLogService {
  private logger: Logger;
  private logsDir: string;

  constructor() {
    this.logger = createLogger('ChatLogService');
    this.logsDir = path.join(process.cwd(), 'logs', 'chat');
  }

  /**
   * Initialize logs directory
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      this.logger.info('Chat logs directory initialized', { path: this.logsDir });
    } catch (error) {
      this.logger.error('Failed to initialize chat logs directory', error);
      throw error;
    }
  }

  /**
   * Get log file path for session
   */
  private getLogPath(sessionDocId: string): string {
    return path.join(this.logsDir, `chat-${sessionDocId}.json`);
  }

  /**
   * Initialize chat log file for new session
   */
  async initChatLog(
    session: ChatSession,
    workingDirectory: string
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(session.documentId);

      // Check if log already exists
      try {
        await fs.access(logPath);
        this.logger.info('Chat log already exists', { sessionId: session.documentId });
        return;
      } catch {
        // File doesn't exist, create it
      }

      const chatLog: ChatLog = {
        sessionDocumentId: session.documentId,
        title: session.title,
        status: session.status,
        skills: session.skills || [],
        sdkSessionId: session.sessionId,
        workingDirectory,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: [],
        sdkCalls: [],
        totalCost: 0,
        totalMessages: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheTokens: 0,
      };

      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.info('Chat log initialized', {
        sessionId: session.documentId,
        path: logPath,
      });
    } catch (error) {
      this.logger.error('Failed to initialize chat log', error, {
        sessionId: session.documentId,
      });
      // Don't throw - log failure shouldn't break chat
    }
  }

  /**
   * Add message to chat log
   */
  async addMessageToLog(
    sessionDocId: string,
    message: ChatMessage
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        // Log file doesn't exist, skip
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Add message
      const logMessage: ChatLogMessage = {
        id: message.id,
        documentId: message.documentId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        attachments: message.attachments,
        metadata: message.metadata,
      };

      chatLog.messages.push(logMessage);
      chatLog.totalMessages = chatLog.messages.length;
      chatLog.updatedAt = new Date().toISOString();

      // Update aggregates
      if (message.metadata?.cost) {
        chatLog.totalCost += message.metadata.cost;
      }
      if (message.metadata?.usage) {
        chatLog.totalInputTokens += message.metadata.usage.input_tokens || 0;
        chatLog.totalOutputTokens += message.metadata.usage.output_tokens || 0;
        chatLog.totalCacheTokens += message.metadata.usage.cache_creation_input_tokens || 0;
        chatLog.totalCacheTokens += message.metadata.usage.cache_read_input_tokens || 0;
      }

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('Message added to chat log', {
        sessionId: sessionDocId,
        messageId: message.documentId,
        role: message.role,
      });
    } catch (error) {
      this.logger.error('Failed to add message to chat log', error, {
        sessionId: sessionDocId,
        messageId: message.documentId,
      });
      // Don't throw - log failure shouldn't break chat
    }
  }

  /**
   * Update SDK session ID in log
   */
  async updateSdkSessionId(
    sessionDocId: string,
    sdkSessionId: string
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Update SDK session ID
      chatLog.sdkSessionId = sdkSessionId;
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK session ID updated in chat log', {
        sessionId: sessionDocId,
        sdkSessionId,
      });
    } catch (error) {
      this.logger.error('Failed to update SDK session ID', error, {
        sessionId: sessionDocId,
      });
    }
  }

  /**
   * Update session status in log
   */
  async updateSessionStatus(
    sessionDocId: string,
    status: 'active' | 'archived'
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Update status
      chatLog.status = status;
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('Session status updated in chat log', {
        sessionId: sessionDocId,
        status,
      });
    } catch (error) {
      this.logger.error('Failed to update session status', error, {
        sessionId: sessionDocId,
      });
    }
  }

  /**
   * Get chat log
   */
  async getChatLog(sessionDocId: string): Promise<ChatLog | null> {
    try {
      const logPath = this.getLogPath(sessionDocId);
      const content = await fs.readFile(logPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.warn('Failed to read chat log', error, {
        sessionId: sessionDocId,
      });
      return null;
    }
  }

  /**
   * Start SDK call logging
   */
  async startSdkCall(
    sessionDocId: string,
    callId: string,
    userMessageId: string,
    request: SdkCallLog['request']
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Add SDK call
      const sdkCall: SdkCallLog = {
        callId,
        userMessageId,
        timestamp: new Date().toISOString(),
        request,
        events: [],
      };

      chatLog.sdkCalls.push(sdkCall);
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK call started in log', {
        sessionId: sessionDocId,
        callId,
      });
    } catch (error) {
      this.logger.error('Failed to start SDK call log', error, {
        sessionId: sessionDocId,
        callId,
      });
    }
  }

  /**
   * Add SDK event to call log
   */
  async addSdkEvent(
    sessionDocId: string,
    callId: string,
    event: SdkEventLog
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Find SDK call
      const sdkCall = chatLog.sdkCalls.find(call => call.callId === callId);
      if (!sdkCall) {
        this.logger.warn('SDK call not found in log', { sessionId: sessionDocId, callId });
        return;
      }

      // Add event
      sdkCall.events.push(event);
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK event added to log', {
        sessionId: sessionDocId,
        callId,
        eventType: event.type,
      });
    } catch (error) {
      this.logger.error('Failed to add SDK event to log', error, {
        sessionId: sessionDocId,
        callId,
      });
    }
  }

  /**
   * Complete SDK call with final result
   */
  async completeSdkCall(
    sessionDocId: string,
    callId: string,
    assistantMessageId: string,
    finalResult?: { cost?: number; usage?: any }
  ): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);

      // Read existing log
      let chatLog: ChatLog;
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        chatLog = JSON.parse(content);
      } catch {
        this.logger.warn('Chat log file not found', { sessionId: sessionDocId });
        return;
      }

      // Find SDK call
      const sdkCall = chatLog.sdkCalls.find(call => call.callId === callId);
      if (!sdkCall) {
        this.logger.warn('SDK call not found in log', { sessionId: sessionDocId, callId });
        return;
      }

      // Update SDK call
      sdkCall.assistantMessageId = assistantMessageId;
      sdkCall.finalResult = finalResult;
      chatLog.updatedAt = new Date().toISOString();

      // Write back to file
      await fs.writeFile(logPath, JSON.stringify(chatLog, null, 2), 'utf-8');

      this.logger.debug('SDK call completed in log', {
        sessionId: sessionDocId,
        callId,
        assistantMessageId,
      });
    } catch (error) {
      this.logger.error('Failed to complete SDK call log', error, {
        sessionId: sessionDocId,
        callId,
      });
    }
  }

  /**
   * Delete chat log
   */
  async deleteChatLog(sessionDocId: string): Promise<void> {
    try {
      const logPath = this.getLogPath(sessionDocId);
      await fs.unlink(logPath);

      this.logger.info('Chat log deleted', { sessionId: sessionDocId });
    } catch (error) {
      this.logger.error('Failed to delete chat log', error, {
        sessionId: sessionDocId,
      });
    }
  }

  /**
   * List all chat logs
   */
  async listChatLogs(): Promise<ChatLog[]> {
    try {
      const files = await fs.readdir(this.logsDir);
      const chatLogFiles = files.filter(f => f.startsWith('chat-') && f.endsWith('.json'));

      const logs: ChatLog[] = [];
      for (const file of chatLogFiles) {
        try {
          const content = await fs.readFile(path.join(this.logsDir, file), 'utf-8');
          logs.push(JSON.parse(content));
        } catch (error) {
          this.logger.warn('Failed to read chat log file', error, { file });
        }
      }

      return logs.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      this.logger.error('Failed to list chat logs', error);
      return [];
    }
  }
}

// Export singleton instance
export const chatLogService = new ChatLogService();
