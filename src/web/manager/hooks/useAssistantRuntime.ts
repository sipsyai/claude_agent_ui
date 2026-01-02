/**
 * useAssistantRuntime Hook
 *
 * A custom React hook that creates an assistant-ui runtime adapter for Claude Agent SDK.
 * This hook bridges assistant-ui's ExternalStoreAdapter with the existing SSE streaming API,
 * enabling rich chat UI features without modifying the backend Claude Agent SDK implementation.
 *
 * ## Features
 * - **Assistant-UI Integration**: Seamless connection between assistant-ui and Claude Agent SDK
 * - **SSE Streaming**: Real-time message streaming with Server-Sent Events
 * - **Message Format Conversion**: Automatic bidirectional conversion between ChatMessage and ThreadMessage
 * - **SDK Event Tracking**: Comprehensive tracking of tool uses, tool results, and system messages
 * - **Performance Optimization**: Throttled updates (50ms) for rapid message deltas
 * - **Stream Cancellation**: User-initiated cancellation with proper cleanup
 * - **Directory Integration**: Automatic directory selection from cookies
 * - **Permission Modes**: Support for default, bypass, auto, and plan permission modes
 * - **Agent & Skill Binding**: Optional agent and skill association for messages
 *
 * ## Runtime State
 * The hook manages the following runtime state:
 *
 * ### Message State
 * - `messages`: Array of ThreadMessage objects compatible with assistant-ui
 * - Synchronized with initialMessages prop from parent component
 * - Automatically converted from ChatMessage to ThreadMessage format
 * - Updated in real-time as SSE events stream in
 * - Includes optimistic updates for user messages
 *
 * ### Running State
 * - `isRunning`: True when actively processing a message (sending or streaming response)
 * - Set to true when user sends message
 * - Set to false when stream completes, is cancelled, or encounters error
 * - Used by assistant-ui to show loading indicators and disable input
 *
 * ### SDK Event State
 * - `toolUses`: Map of tool use ID to ToolUseData (tool invocations and their results)
 * - `currentMessageId`: ID of message currently being processed
 * - Updated as SDK events arrive via SSE stream
 * - Propagated to parent via onToolUseUpdate and onSystemMessage callbacks
 *
 * ### Stream Control State
 * - `currentStreamId`: ID of active SSE stream for cancellation
 * - Set when stream_id event received
 * - Cleared when stream completes or is cancelled
 * - Used by handleCancel to abort active streams
 *
 * ## Message Handling
 * The hook implements comprehensive message handling:
 *
 * ### Message Flow
 * 1. **User Input**: User types message in assistant-ui composer
 * 2. **Optimistic Update**: Add temporary user message to UI immediately
 * 3. **API Request**: Send message via SSE to backend
 * 4. **Stream ID**: Receive stream_id for cancellation support
 * 5. **User Saved**: Replace optimistic message with real persisted message
 * 6. **Assistant Start**: Begin streaming assistant response
 * 7. **Assistant Delta**: Stream response content in chunks (throttled updates)
 * 8. **SDK Events**: Process tool_use, tool_result, and system messages
 * 9. **Assistant Saved**: Replace streaming message with final persisted message
 * 10. **Done**: Mark stream complete, sync messages from backend
 *
 * ### Message Format Conversion
 * Converts ChatMessage (backend format) to ThreadMessage (assistant-ui format):
 * - Maps role (user/assistant/system) to assistant-ui types
 * - Converts content to content array with type-tagged blocks
 * - Adds status (complete/running) based on streaming state
 * - Preserves metadata in custom field
 * - Generates proper timestamps and IDs
 *
 * ### Optimistic Updates
 * - User messages shown immediately before backend confirmation
 * - Temporary IDs (`temp-{timestamp}`) replaced with real document IDs
 * - Streaming assistant messages shown with "running" status
 * - Final messages replace streaming versions when persisted
 *
 * ### Throttled Updates
 * Performance optimization for rapid message deltas:
 * - Accumulates rapid delta events (50ms window)
 * - Batches UI updates to prevent excessive re-renders
 * - Balances responsiveness (feels real-time) with performance
 * - Only applies to delta events, not final saved messages
 *
 * ## Integration with Assistant UI
 * The hook creates an ExternalStoreAdapter for assistant-ui:
 *
 * ### Adapter Interface
 * - `messages`: Current thread messages (readonly)
 * - `setMessages`: Update messages (not typically used with SSE streaming)
 * - `isRunning`: Processing state flag
 * - `onNew`: Handler for new user messages
 * - `onCancel`: Handler for stream cancellation
 *
 * ### Assistant-UI Components
 * Compatible with all assistant-ui components:
 * - `<Thread>`: Main conversation view
 * - `<ThreadMessages>`: Message list rendering
 * - `<Composer>`: Message input with send button
 * - `<AssistantMessage>`: Assistant message display
 * - `<UserMessage>`: User message display
 * - Custom components via assistant-ui primitives
 *
 * ### Event Propagation
 * SDK events are extracted and propagated to parent:
 * - Tool uses: Passed to onToolUseUpdate callback
 * - System messages: Passed to onSystemMessage callback
 * - Parent can display these in custom UI (e.g., ToolUseDisplay component)
 *
 * ## SSE Event Handling
 * The hook processes multiple SSE event types:
 *
 * ### Event Types
 * - **stream_id**: Capture stream ID for cancellation
 * - **user_message_saved**: Replace optimistic user message with persisted version
 * - **assistant_message_start**: Begin streaming assistant response
 * - **assistant_message_delta**: Append content chunks to streaming message
 * - **assistant_message_saved**: Replace streaming message with persisted version
 * - **sdk_message**: Process SDK events (tool_use, tool_result, system)
 * - **cancelled**: Handle stream cancellation, reload messages
 * - **done**: Mark completion, reload messages from backend
 * - **error**: Handle errors, show alert (except for expected abort errors)
 *
 * ### SDK Message Processing
 * - **assistant messages**: Extract tool_use blocks, create ToolUseData entries
 * - **user messages**: Extract tool_result blocks, update ToolUseData with results
 * - **system messages**: Parse and propagate to onSystemMessage callback
 *
 * ### Stream Cancellation
 * User can cancel active streams:
 * - Click stop button in assistant-ui composer
 * - Calls handleCancel which invokes chatApi.cancelMessage
 * - Backend aborts SSE stream and Claude Agent SDK request
 * - Cancelled event triggers message reload for consistency
 * - Silently ignores if no active stream (already complete/cancelled)
 *
 * ## Directory Integration
 * The hook integrates with directory selection:
 * - Reads `selectedDirectory` cookie from browser
 * - Passes directory to chatApi.sendChatMessage
 * - Backend uses directory for file operations (Read, Write, Bash, etc.)
 * - Cookie updated by Layout component's directory selector
 *
 * ## Permission Modes
 * Supports four permission modes for tool execution:
 * - **default**: Prompt user for permission before each tool use
 * - **bypass**: Skip permission prompts, execute all tools automatically
 * - **auto**: Auto-approve safe tools, prompt for dangerous tools
 * - **plan**: Agent plans before execution, user approves plan
 *
 * ## Lifecycle
 * The typical usage flow:
 *
 * 1. **Initialize**: Parent component creates chat session, loads initial messages
 * 2. **Mount**: useAssistantRuntime called with sessionId and initialMessages
 * 3. **Sync**: Hook converts initialMessages to ThreadMessage format
 * 4. **Render**: assistant-ui components render thread with messages
 * 5. **User Input**: User types message, clicks send
 * 6. **Send**: handleNewMessage sends message via SSE
 * 7. **Stream**: Hook processes SSE events, updates messages state
 * 8. **SDK Events**: Tool uses and system messages extracted and propagated
 * 9. **Complete**: Stream finishes, messages synced from backend
 * 10. **Repeat**: User sends more messages, cycle continues
 * 11. **Cancel** (optional): User clicks stop, stream cancelled
 * 12. **Unmount**: Component cleanup (event listeners removed automatically)
 *
 * @example
 * // Basic usage with chat session
 * function ChatInterface({ sessionId }: { sessionId: string }) {
 *   const [messages, setMessages] = useState<ChatMessage[]>([]);
 *
 *   // Load messages on mount
 *   useEffect(() => {
 *     if (sessionId) {
 *       chatApi.getChatMessages(sessionId).then(setMessages);
 *     }
 *   }, [sessionId]);
 *
 *   // Create runtime
 *   const runtime = useAssistantRuntime({
 *     sessionId,
 *     initialMessages: messages,
 *     onMessagesUpdate: setMessages,
 *     permissionMode: 'default',
 *   });
 *
 *   return (
 *     <AssistantRuntimeProvider runtime={runtime}>
 *       <Thread />
 *     </AssistantRuntimeProvider>
 *   );
 * }
 *
 * @example
 * // With agent and skill binding
 * const runtime = useAssistantRuntime({
 *   sessionId: 'session-123',
 *   initialMessages: messages,
 *   onMessagesUpdate: setMessages,
 *   permissionMode: 'auto',
 *   agentId: 'agent-456',
 *   skillIds: ['skill-1', 'skill-2'],
 * });
 *
 * @example
 * // With SDK event tracking for tool use display
 * function ChatWithToolDisplay({ sessionId }: { sessionId: string }) {
 *   const [messages, setMessages] = useState<ChatMessage[]>([]);
 *   const [toolUses, setToolUses] = useState<Map<string, ToolUseData>>(new Map());
 *
 *   const runtime = useAssistantRuntime({
 *     sessionId,
 *     initialMessages: messages,
 *     onMessagesUpdate: setMessages,
 *     permissionMode: 'default',
 *     onToolUseUpdate: (updates) => {
 *       setToolUses(new Map(updates));
 *     },
 *     onSystemMessage: (msg) => {
 *       console.log('System message:', msg.text);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <AssistantRuntimeProvider runtime={runtime}>
 *         <Thread />
 *       </AssistantRuntimeProvider>
 *       <ToolUseDisplay toolUses={toolUses} />
 *     </div>
 *   );
 * }
 *
 * @example
 * // With permission mode switching
 * function ChatWithModes({ sessionId }: { sessionId: string }) {
 *   const [messages, setMessages] = useState<ChatMessage[]>([]);
 *   const [mode, setMode] = useState<'default' | 'bypass' | 'auto' | 'plan'>('default');
 *
 *   const runtime = useAssistantRuntime({
 *     sessionId,
 *     initialMessages: messages,
 *     onMessagesUpdate: setMessages,
 *     permissionMode: mode,
 *   });
 *
 *   return (
 *     <div>
 *       <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
 *         <option value="default">Default</option>
 *         <option value="bypass">Bypass</option>
 *         <option value="auto">Auto</option>
 *         <option value="plan">Plan</option>
 *       </select>
 *       <AssistantRuntimeProvider runtime={runtime}>
 *         <Thread />
 *       </AssistantRuntimeProvider>
 *     </div>
 *   );
 * }
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  useExternalStoreRuntime,
  type ThreadMessage,
  type AppendMessage,
} from '@assistant-ui/react';
import * as chatApi from '../services/chat-api';
import { SDKEventParser, type ToolUseData, type SystemMessageData } from '../utils/sdk-event-parser';

/**
 * Configuration props for useAssistantRuntime hook
 */
interface UseAssistantRuntimeProps {
  /**
   * Chat session ID for the conversation
   * Used to associate messages with specific session in backend
   * Set to null when no session is active (disables message sending)
   *
   * @example 'session-abc123'
   */
  sessionId: string | null;

  /**
   * Initial messages to populate the conversation thread
   * Array of ChatMessage objects from backend
   * Automatically converted to ThreadMessage format for assistant-ui
   * Updated via onMessagesUpdate when new messages arrive
   *
   * @example
   * const [messages, setMessages] = useState<ChatMessage[]>([]);
   * useEffect(() => {
   *   chatApi.getChatMessages(sessionId).then(setMessages);
   * }, [sessionId]);
   */
  initialMessages: chatApi.ChatMessage[];

  /**
   * Callback invoked when messages are updated
   * Called after assistant message is saved or stream completes
   * Should update parent component's message state to keep in sync
   *
   * @param messages - Updated array of ChatMessage objects from backend
   *
   * @example
   * onMessagesUpdate: (messages) => {
   *   setMessages(messages);
   *   localStorage.setItem('lastMessages', JSON.stringify(messages));
   * }
   */
  onMessagesUpdate: (messages: chatApi.ChatMessage[]) => void;

  /**
   * Permission mode for tool execution
   * Controls how tool use permissions are handled:
   * - **default**: Prompt user for permission before each tool use
   * - **bypass**: Skip permission prompts, execute all tools automatically
   * - **auto**: Auto-approve safe tools, prompt for dangerous tools
   * - **plan**: Agent plans before execution, user approves plan
   *
   * @default 'default'
   */
  permissionMode: 'default' | 'bypass' | 'auto' | 'plan';

  /**
   * Optional agent ID to associate with messages
   * Links conversation to specific agent for tracking and configuration
   * Agent's system prompt and settings applied to conversation
   *
   * @example 'agent-coding-assistant'
   */
  agentId?: string;

  /**
   * Optional array of skill IDs to enable for the agent
   * Skills provide additional capabilities (e.g., web search, code execution)
   * Only skills listed here are available during conversation
   *
   * @example ['skill-web-search', 'skill-code-runner']
   */
  skillIds?: string[];

  /**
   * Callback invoked when tool uses are detected or updated
   * Receives Map of tool use ID to ToolUseData with invocation and result
   * Updated in real-time as SDK events arrive
   * Use to display tool use information in custom UI components
   *
   * @param toolUses - Map of tool use ID to ToolUseData
   *
   * @example
   * onToolUseUpdate: (toolUses) => {
   *   console.log(`${toolUses.size} tools used in this conversation`);
   *   setToolUseDisplay(Array.from(toolUses.values()));
   * }
   */
  onToolUseUpdate?: (toolUses: Map<string, ToolUseData>) => void;

  /**
   * Callback invoked when system messages are received
   * System messages provide status updates, warnings, and system-level information
   * Use to display system messages in custom UI or log for debugging
   *
   * @param message - SystemMessageData with text and associated message ID
   *
   * @example
   * onSystemMessage: (msg) => {
   *   console.log(`[SYSTEM] ${msg.text}`);
   *   toast.info(msg.text);
   * }
   */
  onSystemMessage?: (message: SystemMessageData) => void;
}

/**
 * Create an assistant-ui runtime adapter for Claude Agent SDK
 *
 * This hook bridges the gap between assistant-ui (UI framework) and Claude Agent SDK (backend API),
 * enabling rich chat experiences with minimal code. It handles all the complexity of message
 * conversion, SSE streaming, SDK event parsing, and state synchronization.
 *
 * @param props - Configuration object with session, messages, callbacks, and settings
 * @returns AssistantRuntime compatible with assistant-ui components
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

  /**
   * Convert ChatMessage (backend format) to ThreadMessage (assistant-ui format)
   *
   * Transforms messages from the backend's ChatMessage format to assistant-ui's
   * ThreadMessage format. Handles role mapping, content array conversion, and
   * metadata preservation.
   *
   * @param msg - ChatMessage from backend
   * @returns ThreadMessage compatible with assistant-ui
   *
   * @internal
   */
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

  /**
   * Get selected directory from browser cookies
   *
   * Reads the `selectedDirectory` cookie set by Layout component's directory selector.
   * This directory is passed to the backend for file operations (Read, Write, Bash, etc.).
   *
   * @returns Directory path string, or undefined if cookie not found
   *
   * @internal
   */
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

  /**
   * Throttle rapid updates for better performance
   *
   * Creates a throttled update function that accumulates rapid delta events (50ms window)
   * and batches UI updates to prevent excessive re-renders. This balances responsiveness
   * (feels real-time to user) with performance (reduces React render cycles).
   *
   * When assistant_message_delta events arrive rapidly (e.g., 10-20 times per second),
   * this mechanism ensures we only update the UI every 50ms rather than on every delta.
   *
   * @returns Throttled update function that accepts update callback
   *
   * @internal
   */
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

  /**
   * Handle new message submission from user
   *
   * Called by assistant-ui when user sends a message. Implements the full message
   * send workflow including optimistic updates, SSE streaming, and event processing.
   *
   * Workflow:
   * 1. Create optimistic user message with temp ID
   * 2. Send message to backend via SSE
   * 3. Process SSE events (stream_id, user_message_saved, assistant messages, SDK events)
   * 4. Update UI in real-time as events arrive
   * 5. Sync final messages from backend when complete
   *
   * @param message - AppendMessage from assistant-ui composer
   * @returns Promise that resolves when stream completes
   *
   * @internal
   */
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

  /**
   * Handle stream cancellation request
   *
   * Called by assistant-ui when user clicks stop button. Sends cancellation request
   * to backend which aborts the SSE stream and Claude Agent SDK request. The 'cancelled'
   * event handler will clean up state and reload messages.
   *
   * Silently ignores if no active stream (already cancelled or completed).
   *
   * @returns Promise that resolves when cancellation is complete
   *
   * @internal
   */
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

  /**
   * Wrapper for setMessages to match ExternalStoreAdapter signature
   *
   * Converts readonly array to mutable array for state update. Required by
   * useExternalStoreRuntime's adapter interface.
   *
   * @param newMessages - Readonly array of ThreadMessage objects
   * @returns void
   *
   * @internal
   */
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
