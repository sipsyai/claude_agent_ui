/**
 * SDK Event Parser Utility
 * Parses SDK messages and extracts tool uses, tool results, and system messages
 */

export interface ToolUseData {
  id: string;
  name: string;
  input: any;
  result: any | null;
  status: 'pending' | 'completed' | 'error';
  timestamp: Date;
  parentMessageId?: string;
}

export interface SystemMessageData {
  type: string;
  subtype?: string;
  content: any;
  timestamp: Date;
  parentMessageId?: string;
}

export interface SDKEvent {
  type: string;
  subtype?: string;
  data: any;
  timestamp: Date;
  parentMessageId?: string;
}

export class SDKEventParser {
  /**
   * Extract tool use blocks from assistant message
   */
  static extractToolUses(
    assistantMessage: any,
    parentMessageId?: string
  ): ToolUseData[] {
    const toolUses: ToolUseData[] = [];

    if (!assistantMessage?.message?.content) {
      return toolUses;
    }

    const content = Array.isArray(assistantMessage.message.content)
      ? assistantMessage.message.content
      : [assistantMessage.message.content];

    for (const block of content) {
      if (block.type === 'tool_use') {
        toolUses.push({
          id: block.id,
          name: block.name,
          input: block.input,
          result: null,
          status: 'pending',
          timestamp: new Date(),
          parentMessageId,
        });
      }
    }

    return toolUses;
  }

  /**
   * Extract tool results from user message
   */
  static extractToolResults(userMessage: any): Map<string, any> {
    const results = new Map<string, any>();

    if (!userMessage?.message?.content) {
      return results;
    }

    const content = Array.isArray(userMessage.message.content)
      ? userMessage.message.content
      : [userMessage.message.content];

    for (const block of content) {
      if (block.type === 'tool_result') {
        results.set(block.tool_use_id, block.content);
      }
    }

    return results;
  }

  /**
   * Extract text content from assistant message
   */
  static extractTextContent(assistantMessage: any): string {
    if (!assistantMessage?.message?.content) {
      return '';
    }

    const content = Array.isArray(assistantMessage.message.content)
      ? assistantMessage.message.content
      : [assistantMessage.message.content];

    const textBlocks = content.filter((block: any) => block.type === 'text');

    return textBlocks.map((block: any) => block.text).join('');
  }

  /**
   * Parse system message
   */
  static parseSystemMessage(
    systemMessage: any,
    parentMessageId?: string
  ): SystemMessageData {
    return {
      type: systemMessage.type,
      subtype: systemMessage.subtype,
      content: systemMessage,
      timestamp: new Date(),
      parentMessageId,
    };
  }

  /**
   * Check if SDK message contains tool uses
   */
  static hasToolUses(sdkMessage: any): boolean {
    if (sdkMessage.type !== 'assistant' || !sdkMessage.message?.content) {
      return false;
    }

    const content = Array.isArray(sdkMessage.message.content)
      ? sdkMessage.message.content
      : [sdkMessage.message.content];

    return content.some((block: any) => block.type === 'tool_use');
  }

  /**
   * Check if SDK message contains tool results
   */
  static hasToolResults(sdkMessage: any): boolean {
    if (sdkMessage.type !== 'user' || !sdkMessage.message?.content) {
      return false;
    }

    const content = Array.isArray(sdkMessage.message.content)
      ? sdkMessage.message.content
      : [sdkMessage.message.content];

    return content.some((block: any) => block.type === 'tool_result');
  }

  /**
   * Match tool result with tool use
   */
  static matchToolResult(
    toolUse: ToolUseData,
    toolResults: Map<string, any>
  ): ToolUseData | null {
    const result = toolResults.get(toolUse.id);

    if (result !== undefined) {
      return {
        ...toolUse,
        result,
        status: 'completed',
      };
    }

    return null;
  }

  /**
   * Update tool use with result
   */
  static updateToolUseWithResult(
    toolUse: ToolUseData,
    result: any,
    isError: boolean = false
  ): ToolUseData {
    return {
      ...toolUse,
      result,
      status: isError ? 'error' : 'completed',
    };
  }

  /**
   * Group tool uses by parent message
   */
  static groupToolUsesByMessage(
    toolUses: ToolUseData[]
  ): Map<string, ToolUseData[]> {
    const grouped = new Map<string, ToolUseData[]>();

    for (const toolUse of toolUses) {
      const messageId = toolUse.parentMessageId || 'unknown';
      const existing = grouped.get(messageId) || [];
      grouped.set(messageId, [...existing, toolUse]);
    }

    return grouped;
  }

  /**
   * Format SDK event for logging
   */
  static formatSDKEvent(sdkMessage: any, parentMessageId?: string): SDKEvent {
    return {
      type: sdkMessage.type,
      subtype: sdkMessage.subtype,
      data: sdkMessage,
      timestamp: new Date(),
      parentMessageId,
    };
  }

  /**
   * Get event summary for display
   */
  static getEventSummary(sdkMessage: any): string {
    switch (sdkMessage.type) {
      case 'assistant':
        if (SDKEventParser.hasToolUses(sdkMessage)) {
          const toolUses = SDKEventParser.extractToolUses(sdkMessage);
          return `Assistant: ${toolUses.length} tool(s) used`;
        }
        return 'Assistant: Message';

      case 'user':
        if (SDKEventParser.hasToolResults(sdkMessage)) {
          return 'User: Tool results';
        }
        return 'User: Message';

      case 'system':
        return `System: ${sdkMessage.subtype || 'Message'}`;

      case 'result':
        return `Result: ${sdkMessage.is_error ? 'Error' : 'Success'}`;

      default:
        return `Event: ${sdkMessage.type}`;
    }
  }

  /**
   * Check if event should be displayed in simple mode
   */
  static isVisibleInSimpleMode(sdkMessage: any): boolean {
    // Only show critical events in simple mode
    return (
      sdkMessage.type === 'result' ||
      (sdkMessage.type === 'system' && sdkMessage.subtype === 'error')
    );
  }
}

export default SDKEventParser;
