/**
 * MessageBubble Components
 *
 * A collection of message bubble components for rendering chat messages from different
 * roles (user, assistant, system). Each component provides role-specific styling,
 * content rendering, and integration with the assistant-ui framework.
 *
 * ## Features
 * - Role-based message rendering (user, assistant, system)
 * - Markdown content support for assistant messages
 * - Streaming indicators for real-time message updates
 * - SDK event display (tool uses, system messages)
 * - View mode switching (simple vs detailed)
 * - Collapsible sections for tool executions and system events
 * - Avatar and label display for each role
 * - Responsive width constraints (max-w-[80%] for user/assistant, max-w-[60%] for system)
 *
 * ## Message Display
 * The components render different message types:
 *
 * **UserMessage:**
 * - Right-aligned messages with blue background (bg-blue-600)
 * - White text color for high contrast
 * - "You" label with gray text
 * - Pre-wrapped text with word breaking
 * - Max width 80% of container
 *
 * **AssistantMessage:**
 * - Left-aligned messages with dark background (bg-gray-800)
 * - Gray border and shadow for depth
 * - Avatar with gradient background (blue-500 to blue-700)
 * - "Assistant" label with gray text
 * - Markdown content rendering with prose styling
 * - Streaming indicator with animated dots during message generation
 * - Max width 80% of container
 *
 * **SystemMessage:**
 * - Center-aligned messages with pill-shaped design
 * - Dark gray background (bg-gray-800) with border
 * - Small text size (text-xs)
 * - Max width 60% of container
 * - Used for informational messages and status updates
 *
 * ## Role-Based Styling
 * Each message type has distinct visual characteristics:
 *
 * **User Messages:**
 * - Alignment: `justify-end` (right-aligned)
 * - Background: `bg-blue-600` (solid blue)
 * - Text color: `text-white`
 * - Border radius: `rounded-2xl` (highly rounded corners)
 * - Padding: `px-4 py-3`
 * - Label position: Right-aligned above bubble
 *
 * **Assistant Messages:**
 * - Alignment: `justify-start` (left-aligned)
 * - Background: `bg-gray-800` with `border-gray-700` border
 * - Text color: `text-gray-200` (light gray for readability)
 * - Border radius: `rounded-2xl`
 * - Padding: `px-4 py-3`
 * - Avatar: Circular gradient with "A" initial
 * - Label position: Left-aligned with avatar
 *
 * **System Messages:**
 * - Alignment: `justify-center` (center-aligned)
 * - Background: `bg-gray-800` with `border-gray-700` border
 * - Text color: `text-gray-300`
 * - Border radius: `rounded-full` (pill shape)
 * - Padding: `px-4 py-2`
 * - No avatar or label, just content
 *
 * ## Content Rendering
 * Content is rendered using `MessagePrimitive.Content` from assistant-ui:
 *
 * **User and System Messages:**
 * - Plain text rendering with pre-wrap whitespace handling
 * - Word breaking for long words
 * - No markdown processing (displays as-is)
 *
 * **Assistant Messages:**
 * - Uses `MessagePrimitive.Content` which supports markdown
 * - Styled with Tailwind Typography prose classes
 * - Code blocks rendered via CodeBlock component
 * - Links, lists, and formatting preserved
 * - Text color set to gray-200 for dark theme
 *
 * ## View Modes
 * The AssistantMessage component supports two view modes from ChatDisplayContext:
 *
 * **Simple Mode:**
 * - Shows main message content only
 * - Displays compact tool usage indicator (e.g., "🔧 2 tools used")
 * - Hides detailed tool executions and system messages
 * - Minimal visual clutter for cleaner interface
 *
 * **Detailed Mode:**
 * - Shows main message content
 * - Expandable sections for tool executions (🔧 Tool Executions)
 * - Expandable sections for system events (⚙️ System Events)
 * - Each section collapsible with arrow indicators
 * - Full tool input/output displayed via ToolUseDisplay
 * - System messages displayed via SystemMessageDisplay
 *
 * ## SDK Event Integration
 * The AssistantMessage integrates with ChatDisplayContext for SDK events:
 *
 * **Tool Uses:**
 * - Retrieved from `toolUses` map in ChatDisplayContext
 * - Currently shows ALL tool uses (not filtered by message)
 * - Each tool use includes: name, input, result, status
 * - Loading state shown for pending tool executions
 * - Displayed in collapsible "Tool Executions" section
 *
 * **System Messages:**
 * - Retrieved from `systemMessages` array in ChatDisplayContext
 * - Includes system events like file operations, permissions, etc.
 * - Each message has: type, subtype, content, timestamp
 * - Displayed in collapsible "System Events" section
 *
 * **Streaming State:**
 * - Detected via `message.status.type === 'running'` from useMessage hook
 * - Shows animated indicator with three bouncing dots
 * - Label displays "Streaming..." with blue accent color
 * - Automatically hides when streaming completes
 *
 * ## Styling Behavior
 * The components use Tailwind CSS with dark theme colors:
 *
 * **Layout:**
 * - Messages wrapped in `MessagePrimitive.Root` for assistant-ui integration
 * - Flex containers with role-based justification (start, end, center)
 * - Max-width constraints prevent overly wide messages
 * - Margin bottom (mb-4 or mb-6) for vertical spacing
 *
 * **Typography:**
 * - Text sizes: `text-sm` for content, `text-xs` for labels and metadata
 * - Font weights: `font-medium` for labels, `font-bold` for avatars
 * - Line height: `leading-relaxed` for comfortable reading
 *
 * **Colors:**
 * - User bubbles: Blue accent (bg-blue-600, text-white)
 * - Assistant bubbles: Dark gray (bg-gray-800, text-gray-200, border-gray-700)
 * - System bubbles: Medium gray (bg-gray-800, text-gray-300)
 * - Streaming indicator: Blue with transparency (bg-blue-500/20, text-blue-400)
 * - Collapsible sections: Hover state (hover:bg-gray-800/50)
 *
 * **Interactive Elements:**
 * - Collapsible sections with `<details>` elements
 * - Arrow indicators rotate on expand (group-open:rotate-90)
 * - Hover effects on summary elements
 * - Cursor pointer for clickable areas
 *
 * @example
 * // UserMessage - Right-aligned user bubble
 * import { UserMessage } from './MessageBubble';
 *
 * function ChatView() {
 *   return (
 *     <div className="space-y-4">
 *       <UserMessage />
 *     </div>
 *   );
 * }
 *
 * @example
 * // AssistantMessage - Left-aligned with streaming indicator
 * import { AssistantMessage } from './MessageBubble';
 * import { ChatDisplayProvider } from '../contexts/ChatDisplayContext';
 *
 * function AssistantChat() {
 *   return (
 *     <ChatDisplayProvider>
 *       <div className="space-y-4">
 *         <AssistantMessage />
 *       </div>
 *     </ChatDisplayProvider>
 *   );
 * }
 *
 * @example
 * // SystemMessage - Centered informational message
 * import { SystemMessage } from './MessageBubble';
 *
 * function SystemNotification() {
 *   return (
 *     <div className="space-y-2">
 *       <SystemMessage />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Complete chat with all message types and view mode toggle
 * import { UserMessage, AssistantMessage, SystemMessage } from './MessageBubble';
 * import { ChatDisplayProvider, useChatDisplay } from '../contexts/ChatDisplayContext';
 *
 * function ChatInterface() {
 *   const { viewMode, setViewMode } = useChatDisplay();
 *
 *   return (
 *     <ChatDisplayProvider>
 *       <div>
 *         <button onClick={() => setViewMode(viewMode === 'simple' ? 'detailed' : 'simple')}>
 *           {viewMode === 'simple' ? 'Show Details' : 'Hide Details'}
 *         </button>
 *
 *         <div className="space-y-4">
 *           <SystemMessage />
 *           <UserMessage />
 *           <AssistantMessage />
 *         </div>
 *       </div>
 *     </ChatDisplayProvider>
 *   );
 * }
 *
 * @example
 * // AssistantMessage with tool uses and system messages
 * import { AssistantMessage } from './MessageBubble';
 * import { ChatDisplayProvider } from '../contexts/ChatDisplayContext';
 *
 * function ToolExecutionChat() {
 *   // Assume ChatDisplayContext has tool uses and system messages
 *   // These will be displayed in the detailed view mode
 *   return (
 *     <ChatDisplayProvider>
 *       <div>
 *         <AssistantMessage />
 *       </div>
 *     </ChatDisplayProvider>
 *   );
 * }
 */
import React, { useState } from 'react';
import { MessagePrimitive, useMessage } from '@assistant-ui/react';
import ReactMarkdown from 'react-markdown';
import CodeBlock from './CodeBlock';
import { useChatDisplay } from '../contexts/ChatDisplayContext';
import ToolUseDisplay from './chat/ToolUseDisplay';
import SystemMessageDisplay from './chat/SystemMessageDisplay';

/**
 * Props for MessageBubble component.
 *
 * @interface MessageBubbleProps
 * @property {('user' | 'assistant' | 'system')} role - The role of the message sender, determines styling and layout
 */
interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
}

/**
 * UserMessage Component
 *
 * Renders a right-aligned user message bubble with blue background and white text.
 * Displays the message content with "You" label.
 *
 * ## Features
 * - Right-aligned flex layout (justify-end)
 * - Blue background (bg-blue-600) with white text
 * - Rounded corners (rounded-2xl)
 * - Pre-wrapped text with word breaking
 * - Max width 80% of container
 * - "You" label in gray text above bubble
 *
 * ## Integration
 * Must be used within an assistant-ui context (e.g., ThreadRoot or ComposerPrimitive.Root).
 * Message content is provided by `MessagePrimitive.Content` which automatically
 * renders the message text from the assistant-ui thread context.
 *
 * @example
 * // Basic usage in a message thread
 * import { UserMessage } from './MessageBubble';
 * import { Thread } from '@assistant-ui/react';
 *
 * function MessageThread() {
 *   return (
 *     <Thread.Root>
 *       <Thread.Messages>
 *         {(message) => message.role === 'user' && <UserMessage />}
 *       </Thread.Messages>
 *     </Thread.Root>
 *   );
 * }
 */
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

/**
 * AssistantMessage Component
 *
 * Renders a left-aligned assistant message bubble with markdown support, streaming
 * indicator, and SDK event display (tool uses, system messages). Supports simple
 * and detailed view modes for displaying additional context.
 *
 * ## Features
 * - Left-aligned flex layout (justify-start)
 * - Dark gray background (bg-gray-800) with border and shadow
 * - Avatar with blue gradient and "A" initial
 * - Markdown content rendering with prose styling
 * - Streaming indicator with animated dots
 * - Tool use display (collapsible in detailed mode, compact in simple mode)
 * - System message display (collapsible in detailed mode)
 * - View mode switching (simple vs detailed)
 * - Max width 80% of container
 *
 * ## State Management
 * - Uses `useMessage()` hook to access message status and detect streaming
 * - Uses `useChatDisplay()` hook to access view mode and SDK events
 * - Internal `showDetails` state for controlling collapsible sections
 *
 * ## View Modes
 * **Simple Mode:**
 * - Displays message content
 * - Shows compact tool indicator (e.g., "🔧 2 tools used") if tools were used
 * - Hides detailed tool executions and system messages
 *
 * **Detailed Mode:**
 * - Displays message content
 * - Shows collapsible "🔧 Tool Executions" section with full tool details
 * - Shows collapsible "⚙️ System Events" section with system messages
 * - Each section can be expanded/collapsed independently
 *
 * ## Streaming Behavior
 * When `message.status.type === 'running'`:
 * - Displays "Streaming..." label with animated dots
 * - Three dots animate with staggered timing (0ms, 150ms, 300ms delays)
 * - Blue accent color (bg-blue-500/20, text-blue-400)
 * - Automatically hides when streaming completes
 *
 * ## SDK Event Display
 * **Tool Uses:**
 * - Retrieved from ChatDisplayContext toolUses map
 * - Currently displays ALL tool uses (not filtered by message ID)
 * - Each tool shows: name, input, result, loading state
 * - Rendered via ToolUseDisplay component
 *
 * **System Messages:**
 * - Retrieved from ChatDisplayContext systemMessages array
 * - Includes events like file operations, permissions, etc.
 * - Each message shows: type, content, timestamp
 * - Rendered via SystemMessageDisplay component
 *
 * ## Integration
 * Must be used within:
 * 1. Assistant-ui context (e.g., ThreadRoot) for message content
 * 2. ChatDisplayProvider for view mode and SDK events
 *
 * @example
 * // Basic usage in a message thread with ChatDisplayProvider
 * import { AssistantMessage } from './MessageBubble';
 * import { Thread } from '@assistant-ui/react';
 * import { ChatDisplayProvider } from '../contexts/ChatDisplayContext';
 *
 * function MessageThread() {
 *   return (
 *     <ChatDisplayProvider>
 *       <Thread.Root>
 *         <Thread.Messages>
 *           {(message) => message.role === 'assistant' && <AssistantMessage />}
 *         </Thread.Messages>
 *       </Thread.Root>
 *     </ChatDisplayProvider>
 *   );
 * }
 *
 * @example
 * // With view mode toggle
 * import { AssistantMessage } from './MessageBubble';
 * import { ChatDisplayProvider, useChatDisplay } from '../contexts/ChatDisplayContext';
 *
 * function ChatWithToggle() {
 *   const { viewMode, setViewMode } = useChatDisplay();
 *
 *   return (
 *     <div>
 *       <button onClick={() => setViewMode(viewMode === 'simple' ? 'detailed' : 'simple')}>
 *         Toggle View Mode
 *       </button>
 *       <AssistantMessage />
 *     </div>
 *   );
 * }
 */
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

/**
 * SystemMessage Component
 *
 * Renders a center-aligned system message with pill-shaped design. Used for
 * informational messages, status updates, and system notifications.
 *
 * ## Features
 * - Center-aligned flex layout (justify-center)
 * - Dark gray background (bg-gray-800) with border
 * - Pill-shaped design (rounded-full)
 * - Small text size (text-xs)
 * - Max width 60% of container (narrower than user/assistant messages)
 * - No avatar or label, just content
 *
 * ## Styling
 * - Background: `bg-gray-800` with `border-gray-700` border
 * - Text color: `text-gray-300` for medium contrast
 * - Padding: `px-4 py-2` (compact vertical padding)
 * - Border radius: `rounded-full` for pill shape
 * - Shadow: `shadow-sm` for subtle depth
 *
 * ## Use Cases
 * - Session start/end notifications
 * - Status updates (e.g., "Agent connected", "Processing...")
 * - Informational messages (e.g., "No messages yet")
 * - System events (e.g., "Directory changed to /home/user")
 *
 * ## Integration
 * Must be used within an assistant-ui context (e.g., ThreadRoot or ComposerPrimitive.Root).
 * Message content is provided by `MessagePrimitive.Content` which automatically
 * renders the message text from the assistant-ui thread context.
 *
 * @example
 * // Basic usage in a message thread
 * import { SystemMessage } from './MessageBubble';
 * import { Thread } from '@assistant-ui/react';
 *
 * function MessageThread() {
 *   return (
 *     <Thread.Root>
 *       <Thread.Messages>
 *         {(message) => message.role === 'system' && <SystemMessage />}
 *       </Thread.Messages>
 *     </Thread.Root>
 *   );
 * }
 *
 * @example
 * // Session start notification
 * function SessionNotification() {
 *   return (
 *     <div>
 *       <SystemMessage />
 *     </div>
 *   );
 * }
 */
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

// Display names for better debugging experience
UserMessage.displayName = 'UserMessage';
AssistantMessage.displayName = 'AssistantMessage';
SystemMessage.displayName = 'SystemMessage';
