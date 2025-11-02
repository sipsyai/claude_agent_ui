/**
 * Type definitions for Claude Agent SDK messages
 * Based on @anthropic-ai/claude-agent-sdk
 */

import type Anthropic from '@anthropic-ai/sdk';

/**
 * Assistant message from SDK
 * Contains the full Anthropic Message with assistant's response
 */
export interface SDKAssistantMessage {
  type: 'assistant';
  uuid: string;
  session_id: string;
  message: Anthropic.Message;
  parent_tool_use_id: string | null;
}

/**
 * User message from SDK
 * Represents user input in the conversation
 */
export interface SDKUserMessage {
  type: 'user';
  uuid?: string;
  session_id: string;
  message: Anthropic.MessageParam;
  parent_tool_use_id: string | null;
}

/**
 * Result message from SDK
 * Final outcome of the conversation with metrics
 */
export interface SDKResultMessage {
  type: 'result';
  subtype: 'success' | 'error_max_turns' | 'error_during_execution';
  uuid: string;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result?: string;
  total_cost_usd?: number;
  is_error: boolean;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  };
  permission_denials?: Array<unknown>;
}

/**
 * Partial assistant message for streaming
 * Emitted when includePartialMessages is enabled
 */
export interface SDKPartialAssistantMessage {
  type: 'stream_event';
  event: Anthropic.MessageStreamEvent;
  parent_tool_use_id: string | null;
  uuid: string;
  session_id: string;
}

/**
 * Union type for all SDK messages
 */
export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKPartialAssistantMessage;

/**
 * Permission decision for tool use
 */
export interface SDKPermissionDecision {
  approved: boolean;
  modifiedInput?: Record<string, unknown>;
  denyReason?: string;
}

/**
 * Tool use event for permission hooks
 */
export interface SDKToolUseEvent {
  tool: {
    name: string;
    input: Record<string, unknown>;
  };
  timestamp: string;
}
