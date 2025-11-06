/**
 * Custom assistant-ui runtime adapter for Claude Agent SDK
 * Uses ExternalStoreAdapter to connect assistant-ui to our existing SSE streaming API
 * WITHOUT changing the backend Claude Agent SDK implementation
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  useExternalStoreRuntime,
  type ThreadMessage,
  type AppendMessage,
} from '@assistant-ui/react';
import * as chatApi from '../services/chat-api';
import { SDKEventParser, type ToolUseData, type SystemMessageData } from '../utils/sdk-event-parser';

interface UseAssistantRuntimeProps {
  sessionId: string | null;
  initialMessages: chatApi.ChatMessage[];
  onMessagesUpdate: (messages: chatApi.ChatMessage[]) => void;
  permissionMode: 'default' | 'bypass' | 'auto' | 'plan';
  agentId?: string;
  skillIds?: string[];
  // SDK event handlers
  onToolUseUpdate?: (toolUses: Map<string, ToolUseData>) => void;
  onSystemMessage?: (message: SystemMessageData) => void;
}

/**
 * Custom hook to create an assistant-ui runtime that works with our existing API
 */
export function useAssistantRuntime({
  sessionId,
  initialMessages,
  onMessagesUpdate,
  permissionMode,
  agentId,
  skillIds,
  onToolUseUpdate,
  onSystemMessage,
}: UseAssistantRuntimeProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // SDK event tracking
  const [toolUses, setToolUses] = useState<Map<string, ToolUseData>>(new Map());
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  // Stream cancellation tracking
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);

  // Convert our ChatMessage to assistant-ui ThreadMessage format
  const convertToThreadMessage = useCallback((msg: chatApi.ChatMessage): ThreadMessage => {
    const baseMessage = {
      id: msg.documentId,
      createdAt: new Date(msg.timestamp),
      status: { type: 'complete' as const, reason: 'stop' as const },
      content: [
        {
          type: 'text' as const,
          text: msg.content,
        },
      ],
      metadata: {
        custom: msg.metadata || {},
      },
    };

    if (msg.role === 'user') {
      return {
        ...baseMessage,
        role: 'user' as const,
        attachments: [],
      } as unknown as ThreadMessage;
    } else if (msg.role === 'assistant') {
      return {
        ...baseMessage,
        role: 'assistant' as const,
      } as unknown as ThreadMessage;
    } else {
      return {
        ...baseMessage,
        role: 'system' as const,
        content: [{ type: 'text' as const, text: msg.content }],
      } as unknown as ThreadMessage;
    }
  }, []);

  // Sync initial messages from props
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages.map(convertToThreadMessage));
    } else {
      setMessages([]);
    }
  }, [initialMessages, convertToThreadMessage]);

  // Get directory from cookies
  const getDirectory = useCallback(() => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'selectedDirectory') {
        return decodeURIComponent(value);
      }
    }
    return undefined;
  }, []);

  // Throttling for delta updates (50ms)
  // Accumulates rapid deltas and updates UI in batches for better performance
  const throttledUpdate = useMemo(() => {
    let timeout: NodeJS.Timeout | null = null;
    let pendingUpdate: (() => void) | null = null;

    return (updateFn: () => void) => {
      pendingUpdate = updateFn;

      if (!timeout) {
        timeout = setTimeout(() => {
          if (pendingUpdate) {
            pendingUpdate();
          }
          timeout = null;
          pendingUpdate = null;
        }, 50); // 50ms throttle - balances responsiveness with performance
      }
    };
  }, []);

  // Handle new message sending
  const handleNewMessage = useCallback(
    async (message: AppendMessage) => {
      if (!sessionId) return;

      setIsRunning(true);

      try {
        const directory = getDirectory();
        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') return;

        const messageText = textContent.text;

        // Create optimistic user message
        const optimisticUserMessage: ThreadMessage = {
          id: `temp-${Date.now()}`,
          role: 'user' as const,
          content: [{ type: 'text' as const, text: messageText }],
          attachments: [],
          createdAt: new Date(),
          status: { type: 'complete' as const, reason: 'stop' as const },
          metadata: {
            custom: {},
          },
        } as unknown as ThreadMessage;

        setMessages((prev) => [...prev, optimisticUserMessage]);

        // Send message via SSE
        const eventSource = chatApi.sendChatMessage(
          sessionId,
          messageText,
          [], // attachments - to be implemented later
          directory,
          permissionMode,
          agentId,
          skillIds
        );

        let assistantMessageContent = '';
        let assistantMessageId = '';

        eventSource.addEventListener('message', async (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'stream_id') {
              // Capture stream ID for cancellation
              setCurrentStreamId(data.streamId);
              console.log('Stream started with ID:', data.streamId);
            } else if (data.type === 'user_message_saved') {
              // Replace optimistic user message with real one
              const realUserMessage = convertToThreadMessage(data.message);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === optimisticUserMessage.id ? realUserMessage : msg
                )
              );
            } else if (data.type === 'assistant_message_start') {
              // Start assistant message
              assistantMessageId = `temp-assistant-${Date.now()}`;
              assistantMessageContent = '';
            } else if (data.type === 'assistant_message_delta') {
              // Stream assistant message content
              assistantMessageContent += data.delta || '';

              // Use throttling to batch rapid updates for better performance
              throttledUpdate(() => {
                const streamingMessage: ThreadMessage = {
                  id: assistantMessageId,
                  role: 'assistant' as const,
                  content: [{ type: 'text' as const, text: assistantMessageContent }],
                  createdAt: new Date(),
                  status: { type: 'running' as const },
                  metadata: {
                    custom: {},
                  },
                } as unknown as ThreadMessage;

                setMessages((prev) => {
                  const withoutStreaming = prev.filter((m) => m.id !== assistantMessageId);
                  return [...withoutStreaming, streamingMessage];
                });
              });
            } else if (data.type === 'assistant_message_saved') {
              // Replace streaming message with final saved message
              const realAssistantMessage = convertToThreadMessage(data.message);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? realAssistantMessage : msg
                )
              );
              // Get current messages from Strapi to ensure sync
              const currentMessages = await chatApi.getChatMessages(sessionId);
              onMessagesUpdate(currentMessages);
            } else if (data.type === 'sdk_message') {
              // Handle SDK messages (tool uses, tool results, system messages)
              const sdkMsg = data.data;

              // Set current message ID for tracking
              if (assistantMessageId) {
                setCurrentMessageId(assistantMessageId);
              }

              // Process assistant messages for tool_use blocks
              if (sdkMsg.type === 'assistant' && SDKEventParser.hasToolUses(sdkMsg)) {
                const newToolUses = SDKEventParser.extractToolUses(sdkMsg, assistantMessageId);

                setToolUses((prev) => {
                  const updated = new Map(prev);
                  newToolUses.forEach((toolUse) => {
                    updated.set(toolUse.id, toolUse);
                  });
                  return updated;
                });

                // Notify parent component
                if (onToolUseUpdate) {
                  setToolUses((currentToolUses) => {
                    onToolUseUpdate(currentToolUses);
                    return currentToolUses;
                  });
                }
              }

              // Process user messages for tool_result blocks
              else if (sdkMsg.type === 'user' && SDKEventParser.hasToolResults(sdkMsg)) {
                const results = SDKEventParser.extractToolResults(sdkMsg);

                setToolUses((prev) => {
                  const updated = new Map(prev);
                  results.forEach((result, toolUseId) => {
                    const toolUse = updated.get(toolUseId);
                    if (toolUse) {
                      updated.set(
                        toolUseId,
                        SDKEventParser.updateToolUseWithResult(toolUse, result)
                      );
                    }
                  });
                  return updated;
                });

                // Notify parent component
                if (onToolUseUpdate) {
                  setToolUses((currentToolUses) => {
                    onToolUseUpdate(currentToolUses);
                    return currentToolUses;
                  });
                }
              }

              // Process system messages
              else if (sdkMsg.type === 'system') {
                const systemMsg = SDKEventParser.parseSystemMessage(sdkMsg, assistantMessageId);

                // Notify parent component
                if (onSystemMessage) {
                  onSystemMessage(systemMsg);
                }
              }
            } else if (data.type === 'cancelled') {
              console.log('Stream cancelled:', data.streamId);
              setIsRunning(false);
              setCurrentStreamId(null);
              // Reload all messages to ensure sync
              const currentMessages = await chatApi.getChatMessages(sessionId);
              onMessagesUpdate(currentMessages);
            } else if (data.type === 'done') {
              console.log('Streaming complete');
              setIsRunning(false);
              setCurrentStreamId(null);
              // Reload all messages to ensure sync
              const currentMessages = await chatApi.getChatMessages(sessionId);
              onMessagesUpdate(currentMessages);
            } else if (data.type === 'error') {
              console.error('Chat error:', data.error);
              // Only show alert for real errors, not for cancellations
              if (!data.error?.includes('abort')) {
                alert(`Chat error: ${data.error}`);
              }
              setIsRunning(false);
              setCurrentStreamId(null);
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e);
          }
        });

        eventSource.addEventListener('error', (event: Event) => {
          console.error('SSE error:', event);
          setIsRunning(false);
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        alert('Failed to send message');
        setIsRunning(false);
      }
    },
    [sessionId, getDirectory, convertToThreadMessage, initialMessages, onMessagesUpdate, permissionMode, agentId, skillIds, onToolUseUpdate, onSystemMessage]
  );

  // Handle cancel
  const handleCancel = useCallback(async () => {
    if (!sessionId || !currentStreamId) {
      // Silently ignore if no active stream (already cancelled or completed)
      return;
    }

    try {
      console.log('Cancelling stream:', currentStreamId);
      await chatApi.cancelMessage(sessionId, currentStreamId);
      // The 'cancelled' event handler will clean up state
    } catch (error) {
      console.error('Failed to cancel message:', error);
      // Fallback: clean up state manually
      setIsRunning(false);
      setCurrentStreamId(null);
    }
  }, [sessionId, currentStreamId]);

  // Wrapper for setMessages to match ExternalStoreAdapter signature
  const handleSetMessages = useCallback((newMessages: readonly ThreadMessage[]) => {
    setMessages([...newMessages]);
  }, []);

  // Create external store adapter
  const adapter = useMemo(
    () => ({
      isRunning,
      messages,
      setMessages: handleSetMessages,
      onNew: handleNewMessage,
      onCancel: handleCancel,
    }),
    [isRunning, messages, handleSetMessages, handleNewMessage, handleCancel]
  );

  // Create runtime using useExternalStoreRuntime
  const runtime = useExternalStoreRuntime(adapter);

  return runtime;
}
