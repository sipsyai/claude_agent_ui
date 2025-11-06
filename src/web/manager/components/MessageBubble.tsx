import React, { useState } from 'react';
import { MessagePrimitive, useMessage } from '@assistant-ui/react';
import ReactMarkdown from 'react-markdown';
import CodeBlock from './CodeBlock';
import { useChatDisplay } from '../contexts/ChatDisplayContext';
import ToolUseDisplay from './chat/ToolUseDisplay';
import SystemMessageDisplay from './chat/SystemMessageDisplay';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
}

// User Message Component
export const UserMessage: React.FC = () => {
  return (
    <MessagePrimitive.Root>
      <div className="mb-6 flex justify-end">
        <div className="max-w-[80%]">
          <div className="flex items-center justify-end gap-2 mb-1.5">
            <span className="text-xs font-medium text-gray-400">You</span>
          </div>
          <div className="rounded-2xl bg-blue-600 px-4 py-3 text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
            <MessagePrimitive.Content />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

// Assistant Message Component with Markdown Support and SDK Event Display
export const AssistantMessage: React.FC = () => {
  const message = useMessage();
  const { viewMode, toolUses, systemMessages } = useChatDisplay();
  const [showDetails, setShowDetails] = useState(false);

  // Check if message is currently streaming
  const isStreaming = message?.status?.type === 'running';

  // For now, show ALL tool uses (not filtered by message)
  // TODO: Implement proper message ID tracking from backend
  const allToolUses = Array.from(toolUses.values());
  const allSystemMessages = systemMessages;

  const hasToolUses = allToolUses.length > 0;
  const hasSystemMessages = allSystemMessages.length > 0;
  const hasDetails = hasToolUses || hasSystemMessages;

  return (
    <MessagePrimitive.Root>
      <div className="mb-6 flex justify-start">
        <div className="max-w-[80%] w-full">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <span className="text-xs font-bold text-white">A</span>
            </div>
            <span className="text-xs font-medium text-gray-400">Assistant</span>

            {/* Streaming Indicator */}
            {isStreaming && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/20 rounded-full text-xs text-blue-400 font-medium">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
                <span>Streaming...</span>
              </span>
            )}
          </div>

          {/* Main Message Content */}
          <div className="rounded-2xl bg-gray-800 border border-gray-700 px-4 py-3 shadow-sm">
            <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-200">
              <MessagePrimitive.Content />
            </div>

            {/* Debug Info - Remove after testing */}
            <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-500">
              View: {viewMode} | Tools: {allToolUses.length} | System: {allSystemMessages.length} | Status: {message?.status?.type}
            </div>
          </div>

          {/* Detailed View: Tool Executions and System Messages */}
          {viewMode === 'detailed' && hasDetails && (
            <div className="mt-3 space-y-2">
              {/* Tool Executions Section */}
              {hasToolUses && (
                <details
                  open={showDetails}
                  onToggle={(e: any) => setShowDetails(e.target.open)}
                  className="group"
                >
                  <summary className="cursor-pointer select-none px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center gap-2 text-xs font-medium text-gray-400">
                    <span className="group-open:rotate-90 transition-transform inline-block">
                      ▶
                    </span>
                    <span>🔧 Tool Executions ({allToolUses.length})</span>
                  </summary>
                  <div className="mt-2 space-y-2 ml-4">
                    {allToolUses.map((tool) => (
                      <ToolUseDisplay
                        key={tool.id}
                        toolName={tool.name}
                        toolInput={tool.input}
                        toolResult={tool.result}
                        isLoading={tool.status === 'pending'}
                      />
                    ))}
                  </div>
                </details>
              )}

              {/* System Messages Section */}
              {hasSystemMessages && (
                <details className="group">
                  <summary className="cursor-pointer select-none px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center gap-2 text-xs font-medium text-gray-400">
                    <span className="group-open:rotate-90 transition-transform inline-block">
                      ▶
                    </span>
                    <span>⚙️ System Events ({allSystemMessages.length})</span>
                  </summary>
                  <div className="mt-2 space-y-1 ml-4">
                    {allSystemMessages.map((event, idx) => (
                      <SystemMessageDisplay
                        key={idx}
                        messageType={event.subtype || event.type}
                        content={event.content}
                        timestamp={event.timestamp}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Simple View: Compact Indicator */}
          {viewMode === 'simple' && hasToolUses && (
            <div className="mt-2 px-3 py-1.5 text-xs text-gray-500 bg-gray-800/30 rounded-lg border border-gray-700/50 inline-block">
              🔧 {allToolUses.length} tool{allToolUses.length > 1 ? 's' : ''} used
            </div>
          )}
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

// System Message Component
export const SystemMessage: React.FC = () => {
  return (
    <MessagePrimitive.Root>
      <div className="mb-4 flex justify-center">
        <div className="max-w-[60%]">
          <div className="bg-gray-800 text-gray-300 text-xs px-4 py-2 rounded-full text-center shadow-sm border border-gray-700">
            <MessagePrimitive.Content />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};
