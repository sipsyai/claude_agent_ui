/**
 * Chat Display Context
 * Manages view mode and SDK event data for chat display
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ToolUseData, SystemMessageData, SDKEvent } from '../utils/sdk-event-parser';

export type ViewMode = 'simple' | 'detailed';

export interface ChatDisplayContextValue {
  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // SDK event data
  toolUses: Map<string, ToolUseData>;
  setToolUses: React.Dispatch<React.SetStateAction<Map<string, ToolUseData>>>;

  systemMessages: SystemMessageData[];
  setSystemMessages: React.Dispatch<React.SetStateAction<SystemMessageData[]>>;

  sdkEvents: SDKEvent[];
  setSdkEvents: React.Dispatch<React.SetStateAction<SDKEvent[]>>;

  // Helper functions
  getToolUsesForMessage: (messageId: string) => ToolUseData[];
  getSystemMessagesForMessage: (messageId: string) => SystemMessageData[];
  clearEventData: () => void;
}

const ChatDisplayContext = createContext<ChatDisplayContextValue | undefined>(undefined);

export interface ChatDisplayProviderProps {
  children: ReactNode;
}

export const ChatDisplayProvider: React.FC<ChatDisplayProviderProps> = ({ children }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [toolUses, setToolUses] = useState<Map<string, ToolUseData>>(new Map());
  const [systemMessages, setSystemMessages] = useState<SystemMessageData[]>([]);
  const [sdkEvents, setSdkEvents] = useState<SDKEvent[]>([]);

  /**
   * Get tool uses associated with a specific message
   */
  const getToolUsesForMessage = (messageId: string): ToolUseData[] => {
    const result: ToolUseData[] = [];

    for (const [, toolUse] of toolUses) {
      if (toolUse.parentMessageId === messageId) {
        result.push(toolUse);
      }
    }

    // Sort by timestamp
    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  /**
   * Get system messages associated with a specific message
   */
  const getSystemMessagesForMessage = (messageId: string): SystemMessageData[] => {
    return systemMessages
      .filter(msg => msg.parentMessageId === messageId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  /**
   * Clear all event data (e.g., when switching sessions)
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
 * Hook to use chat display context
 */
export const useChatDisplay = (): ChatDisplayContextValue => {
  const context = useContext(ChatDisplayContext);

  if (!context) {
    throw new Error('useChatDisplay must be used within ChatDisplayProvider');
  }

  return context;
};

export default ChatDisplayContext;
