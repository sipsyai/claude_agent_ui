/**
 * Chat Display Context
 *
 * A React Context that manages the display state and SDK event data for the chat interface.
 * This context provides centralized state management for chat view modes (simple vs detailed)
 * and SDK-generated event data including tool uses, system messages, and raw SDK events.
 *
 * ## Features
 * - **View Mode Management**: Toggle between 'simple' and 'detailed' chat display modes
 * - **Tool Use Tracking**: Store and retrieve tool invocations associated with messages
 * - **System Message Storage**: Manage system-generated messages linked to parent messages
 * - **SDK Event Collection**: Track all SDK events for debugging and display purposes
 * - **Message Association**: Helper functions to query events by parent message ID
 * - **Session Management**: Clear all event data when switching chat sessions
 * - **Type-Safe API**: Fully typed context values with TypeScript interfaces
 *
 * ## Context Values
 * The context provides the following state and functions:
 *
 * ### View Mode State
 * - `viewMode`: Current display mode ('simple' shows basic messages, 'detailed' shows SDK events)
 * - `setViewMode`: Function to switch between view modes
 *
 * ### SDK Event Data State
 * - `toolUses`: Map of tool invocations indexed by tool use ID
 * - `setToolUses`: State setter for updating tool use data
 * - `systemMessages`: Array of system-generated messages
 * - `setSystemMessages`: State setter for updating system messages
 * - `sdkEvents`: Array of all SDK events in chronological order
 * - `setSdkEvents`: State setter for updating SDK events
 *
 * ### Helper Functions
 * - `getToolUsesForMessage`: Retrieve all tool uses for a specific message (sorted by timestamp)
 * - `getSystemMessagesForMessage`: Retrieve all system messages for a specific message (sorted by timestamp)
 * - `clearEventData`: Reset all event data (used when switching sessions or clearing chat)
 *
 * ## Provider Usage
 * Wrap your chat components with ChatDisplayProvider to provide context access:
 *
 * ```tsx
 * import { ChatDisplayProvider } from './contexts/ChatDisplayContext';
 *
 * function App() {
 *   return (
 *     <ChatDisplayProvider>
 *       <ChatPage />
 *     </ChatDisplayProvider>
 *   );
 * }
 * ```
 *
 * ## Consumer Patterns
 * Use the `useChatDisplay` hook to access context values in child components:
 *
 * ```tsx
 * import { useChatDisplay } from './contexts/ChatDisplayContext';
 *
 * function ChatMessage({ messageId }) {
 *   const { viewMode, getToolUsesForMessage } = useChatDisplay();
 *   const toolUses = getToolUsesForMessage(messageId);
 *
 *   return (
 *     <div>
 *       {viewMode === 'detailed' && toolUses.map(tool => (
 *         <ToolDisplay key={tool.id} data={tool} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * ## State Management
 * The context uses React useState hooks internally to manage:
 * - View mode preference (persists during session)
 * - Tool use Map for efficient lookups by ID
 * - System messages array sorted by timestamp
 * - SDK events array maintaining chronological order
 *
 * All state setters follow React's immutability patterns, ensuring predictable updates
 * and proper re-renders when data changes.
 *
 * @example
 * // Basic provider setup
 * <ChatDisplayProvider>
 *   <ChatInterface />
 * </ChatDisplayProvider>
 *
 * @example
 * // Switching view modes
 * function ViewModeToggle() {
 *   const { viewMode, setViewMode } = useChatDisplay();
 *
 *   return (
 *     <button onClick={() => setViewMode(viewMode === 'simple' ? 'detailed' : 'simple')}>
 *       {viewMode === 'simple' ? 'Show Details' : 'Hide Details'}
 *     </button>
 *   );
 * }
 *
 * @example
 * // Accessing tool uses for a message
 * function MessageWithTools({ messageId }) {
 *   const { getToolUsesForMessage } = useChatDisplay();
 *   const tools = getToolUsesForMessage(messageId);
 *
 *   return (
 *     <div>
 *       <MessageContent id={messageId} />
 *       {tools.length > 0 && (
 *         <div className="tools">
 *           {tools.map(tool => (
 *             <ToolUseDisplay key={tool.id} data={tool} />
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 *
 * @example
 * // Clearing event data when switching sessions
 * function SessionSwitcher({ sessionId }) {
 *   const { clearEventData } = useChatDisplay();
 *
 *   useEffect(() => {
 *     // Clear previous session's event data
 *     clearEventData();
 *   }, [sessionId, clearEventData]);
 *
 *   return <ChatSession id={sessionId} />;
 * }
 *
 * @example
 * // Adding tool use data from SDK events
 * function ChatEventHandler() {
 *   const { setToolUses } = useChatDisplay();
 *
 *   const handleSDKEvent = (event: SDKEvent) => {
 *     if (event.type === 'tool_use') {
 *       setToolUses(prev => {
 *         const next = new Map(prev);
 *         next.set(event.toolUse.id, event.toolUse);
 *         return next;
 *       });
 *     }
 *   };
 *
 *   return <EventListener onEvent={handleSDKEvent} />;
 * }
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ToolUseData, SystemMessageData, SDKEvent } from '../utils/sdk-event-parser';

/**
 * View mode for chat display
 * - `simple`: Shows only user and assistant messages (clean, minimal interface)
 * - `detailed`: Shows all SDK events, tool uses, and system messages (debugging/development mode)
 */
export type ViewMode = 'simple' | 'detailed';

/**
 * Shape of the ChatDisplayContext value
 *
 * This interface defines all state and functions available to consumers of the
 * ChatDisplayContext. Components can access these values by using the useChatDisplay hook.
 */
export interface ChatDisplayContextValue {
  /**
   * Current view mode for the chat interface
   *
   * Controls what level of detail is shown in the chat:
   * - `simple`: User/assistant messages only (default, clean UX)
   * - `detailed`: Shows SDK events, tool invocations, system messages
   */
  viewMode: ViewMode;

  /**
   * Function to change the view mode
   *
   * @param mode - The new view mode to set ('simple' or 'detailed')
   */
  setViewMode: (mode: ViewMode) => void;

  /**
   * Map of tool use data indexed by tool use ID
   *
   * Each tool use represents a function/tool invocation by the AI assistant.
   * The Map structure enables O(1) lookup by ID. Keys are tool use IDs,
   * values are ToolUseData objects containing input, output, and metadata.
   */
  toolUses: Map<string, ToolUseData>;

  /**
   * State setter for tool uses Map
   *
   * Use this to add, update, or remove tool use data. Follow React's
   * immutability pattern by creating a new Map instance:
   *
   * ```tsx
   * setToolUses(prev => {
   *   const next = new Map(prev);
   *   next.set(toolId, toolData);
   *   return next;
   * });
   * ```
   */
  setToolUses: React.Dispatch<React.SetStateAction<Map<string, ToolUseData>>>;

  /**
   * Array of system-generated messages
   *
   * System messages are generated by the SDK or backend, not by users or the assistant.
   * Examples include status updates, warnings, or internal state changes.
   * Each message has a parentMessageId linking it to the user/assistant message that triggered it.
   */
  systemMessages: SystemMessageData[];

  /**
   * State setter for system messages array
   *
   * Use this to add or update system messages. Follow React's immutability:
   *
   * ```tsx
   * setSystemMessages(prev => [...prev, newMessage]);
   * ```
   */
  setSystemMessages: React.Dispatch<React.SetStateAction<SystemMessageData[]>>;

  /**
   * Array of all SDK events in chronological order
   *
   * Raw SDK events include all event types emitted during chat interaction:
   * message chunks, tool uses, completions, errors, etc. Useful for debugging
   * and detailed event analysis.
   */
  sdkEvents: SDKEvent[];

  /**
   * State setter for SDK events array
   *
   * Use this to append new SDK events as they arrive:
   *
   * ```tsx
   * setSdkEvents(prev => [...prev, newEvent]);
   * ```
   */
  setSdkEvents: React.Dispatch<React.SetStateAction<SDKEvent[]>>;

  /**
   * Get all tool uses associated with a specific message
   *
   * Returns tool invocations that have the given messageId as their parent,
   * sorted by timestamp (earliest first). This is useful for displaying
   * tools that were called as part of processing a particular message.
   *
   * @param messageId - The ID of the parent message
   * @returns Array of ToolUseData sorted by timestamp (ascending)
   *
   * @example
   * const tools = getToolUsesForMessage('msg_123');
   * // Returns: [{ id: 'tool_1', name: 'search', ... }, { id: 'tool_2', name: 'calculate', ... }]
   */
  getToolUsesForMessage: (messageId: string) => ToolUseData[];

  /**
   * Get all system messages associated with a specific message
   *
   * Returns system messages that have the given messageId as their parent,
   * sorted by timestamp (earliest first). Useful for displaying system-generated
   * notifications or status updates related to a message.
   *
   * @param messageId - The ID of the parent message
   * @returns Array of SystemMessageData sorted by timestamp (ascending)
   *
   * @example
   * const sysMessages = getSystemMessagesForMessage('msg_123');
   * // Returns: [{ id: 'sys_1', content: 'Processing...', ... }, { id: 'sys_2', content: 'Complete', ... }]
   */
  getSystemMessagesForMessage: (messageId: string) => SystemMessageData[];

  /**
   * Clear all event data (tool uses, system messages, SDK events)
   *
   * Resets all event-related state to empty. Call this when:
   * - Switching to a different chat session
   * - Starting a new conversation
   * - Clearing the chat history
   * - Resetting the chat interface
   *
   * This ensures old event data doesn't leak into new sessions.
   *
   * @example
   * // Clear when switching sessions
   * useEffect(() => {
   *   clearEventData();
   * }, [sessionId]);
   */
  clearEventData: () => void;
}

const ChatDisplayContext = createContext<ChatDisplayContextValue | undefined>(undefined);

/**
 * Props for the ChatDisplayProvider component
 */
export interface ChatDisplayProviderProps {
  /**
   * Child components that will have access to the chat display context
   *
   * Any component rendered within this provider can access the context
   * values using the useChatDisplay hook.
   */
  children: ReactNode;
}

/**
 * ChatDisplayProvider Component
 *
 * Provider component that manages and exposes chat display state to child components.
 * Wrap your chat interface with this provider to enable access to view modes, SDK events,
 * tool uses, and system messages throughout the component tree.
 *
 * ## Internal State
 * The provider initializes and manages the following state:
 * - `viewMode`: Defaults to 'simple' (minimal view)
 * - `toolUses`: Empty Map for tool invocation tracking
 * - `systemMessages`: Empty array for system message collection
 * - `sdkEvents`: Empty array for SDK event logging
 *
 * ## Helper Functions
 * The provider implements three helper functions:
 * - `getToolUsesForMessage`: Filters and sorts tool uses by parent message ID
 * - `getSystemMessagesForMessage`: Filters and sorts system messages by parent message ID
 * - `clearEventData`: Resets all event-related state to empty
 *
 * ## Usage
 * Place this provider high in your component tree, typically at the app or page level:
 *
 * @example
 * // At the app level
 * function App() {
 *   return (
 *     <ChatDisplayProvider>
 *       <ChatPage />
 *       <SettingsPanel />
 *     </ChatDisplayProvider>
 *   );
 * }
 *
 * @example
 * // At the page level for isolated chat instances
 * function ChatPage() {
 *   return (
 *     <ChatDisplayProvider>
 *       <ChatHeader />
 *       <ChatMessageList />
 *       <ChatInput />
 *     </ChatDisplayProvider>
 *   );
 * }
 */
export const ChatDisplayProvider: React.FC<ChatDisplayProviderProps> = ({ children }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [toolUses, setToolUses] = useState<Map<string, ToolUseData>>(new Map());
  const [systemMessages, setSystemMessages] = useState<SystemMessageData[]>([]);
  const [sdkEvents, setSdkEvents] = useState<SDKEvent[]>([]);

  /**
   * Get tool uses associated with a specific message
   *
   * Iterates through all tool uses in the Map and returns those whose
   * parentMessageId matches the given messageId. Results are sorted by
   * timestamp in ascending order (earliest first).
   *
   * @param messageId - The ID of the parent message to query
   * @returns Array of ToolUseData objects sorted by timestamp (ascending)
   */
  const getToolUsesForMessage = (messageId: string): ToolUseData[] => {
    const result: ToolUseData[] = [];

    for (const [, toolUse] of toolUses) {
      if (toolUse.parentMessageId === messageId) {
        result.push(toolUse);
      }
    }

    // Sort by timestamp (earliest first)
    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  /**
   * Get system messages associated with a specific message
   *
   * Filters the systemMessages array to find all messages whose
   * parentMessageId matches the given messageId. Results are sorted by
   * timestamp in ascending order (earliest first).
   *
   * @param messageId - The ID of the parent message to query
   * @returns Array of SystemMessageData objects sorted by timestamp (ascending)
   */
  const getSystemMessagesForMessage = (messageId: string): SystemMessageData[] => {
    return systemMessages
      .filter(msg => msg.parentMessageId === messageId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  /**
   * Clear all event data (tool uses, system messages, SDK events)
   *
   * Resets all event-related state to their initial empty values:
   * - toolUses → new empty Map()
   * - systemMessages → empty array []
   * - sdkEvents → empty array []
   *
   * Call this function when switching chat sessions, clearing chat history,
   * or resetting the chat interface to prevent old data from persisting.
   */
  const clearEventData = () => {
    setToolUses(new Map());
    setSystemMessages([]);
    setSdkEvents([]);
  };

  const value: ChatDisplayContextValue = {
    viewMode,
    setViewMode,
    toolUses,
    setToolUses,
    systemMessages,
    setSystemMessages,
    sdkEvents,
    setSdkEvents,
    getToolUsesForMessage,
    getSystemMessagesForMessage,
    clearEventData,
  };

  return <ChatDisplayContext.Provider value={value}>{children}</ChatDisplayContext.Provider>;
};

/**
 * useChatDisplay Hook
 *
 * Custom React hook to access the ChatDisplayContext values in child components.
 * This hook provides access to all chat display state, setters, and helper functions
 * defined in the context.
 *
 * ## Return Value
 * Returns the complete ChatDisplayContextValue object containing:
 * - View mode state (viewMode, setViewMode)
 * - SDK event data state (toolUses, systemMessages, sdkEvents, and their setters)
 * - Helper functions (getToolUsesForMessage, getSystemMessagesForMessage, clearEventData)
 *
 * ## Error Handling
 * Throws an error if called outside of a ChatDisplayProvider. Always ensure this hook
 * is used within a component tree wrapped by ChatDisplayProvider.
 *
 * ## Usage
 * Call this hook at the top level of your component (following React Hooks rules):
 *
 * @throws {Error} If used outside of ChatDisplayProvider
 * @returns {ChatDisplayContextValue} The chat display context values
 *
 * @example
 * // Basic usage - accessing view mode
 * function ChatHeader() {
 *   const { viewMode, setViewMode } = useChatDisplay();
 *
 *   return (
 *     <header>
 *       <h1>Chat</h1>
 *       <button onClick={() => setViewMode(viewMode === 'simple' ? 'detailed' : 'simple')}>
 *         Toggle View: {viewMode}
 *       </button>
 *     </header>
 *   );
 * }
 *
 * @example
 * // Accessing tool uses for a message
 * function MessageBubble({ messageId, content }) {
 *   const { getToolUsesForMessage, viewMode } = useChatDisplay();
 *   const toolUses = getToolUsesForMessage(messageId);
 *
 *   return (
 *     <div className="message">
 *       <p>{content}</p>
 *       {viewMode === 'detailed' && toolUses.length > 0 && (
 *         <div className="tools">
 *           <h4>Tools Used:</h4>
 *           {toolUses.map(tool => (
 *             <ToolDisplay key={tool.id} data={tool} />
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 *
 * @example
 * // Using multiple context values
 * function ChatDebugPanel() {
 *   const {
 *     viewMode,
 *     setViewMode,
 *     toolUses,
 *     systemMessages,
 *     sdkEvents,
 *     clearEventData
 *   } = useChatDisplay();
 *
 *   return (
 *     <div className="debug-panel">
 *       <h2>Debug Information</h2>
 *       <p>View Mode: {viewMode}</p>
 *       <p>Tool Uses: {toolUses.size}</p>
 *       <p>System Messages: {systemMessages.length}</p>
 *       <p>SDK Events: {sdkEvents.length}</p>
 *       <button onClick={() => setViewMode('detailed')}>Show Details</button>
 *       <button onClick={clearEventData}>Clear All Events</button>
 *     </div>
 *   );
 * }
 *
 * @example
 * // Clearing events on session change
 * function ChatSession({ sessionId }) {
 *   const { clearEventData } = useChatDisplay();
 *
 *   useEffect(() => {
 *     // Clear old session's event data when session changes
 *     clearEventData();
 *   }, [sessionId, clearEventData]);
 *
 *   return <ChatMessages sessionId={sessionId} />;
 * }
 */
export const useChatDisplay = (): ChatDisplayContextValue => {
  const context = useContext(ChatDisplayContext);

  if (!context) {
    throw new Error('useChatDisplay must be used within ChatDisplayProvider');
  }

  return context;
};

export default ChatDisplayContext;
