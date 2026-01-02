/**
 * @file AgentCreatorChatPanel.tsx
 * @description Interactive slide-in panel for creating agents through a conversational interface
 * with Claude Manager. This component provides a chat-based workflow powered by the useAgentCreator
 * hook, guiding users through agent creation with real-time feedback and state management.
 *
 * ## Features
 * - **Interactive Chat Interface**: Conversational workflow for agent creation
 * - **SSE Streaming Integration**: Real-time message streaming via useAgentCreator hook
 * - **Multi-State UI**: Four distinct states (chat, creating, success, error)
 * - **Auto-Scroll**: Automatic scrolling to latest messages
 * - **Keyboard Shortcuts**: Enter to send, Shift+Enter for new line
 * - **Auto-Focus**: Input field auto-focuses when panel opens
 * - **Slide-In Animation**: Smooth right-to-left panel animation
 * - **Overlay Backdrop**: Click-outside-to-close functionality
 * - **State Persistence**: Panel state management across conversation lifecycle
 * - **Error Recovery**: Try again functionality on failure
 *
 * ## Chat-Based Agent Creation
 * The component orchestrates a conversational agent creation workflow:
 *
 * ### Workflow Steps
 * 1. **Panel Opens**: User opens panel, auto-starts conversation with Claude
 * 2. **Initial Greeting**: Claude introduces itself and asks what agent to create
 * 3. **User Describes**: User explains what the agent should do
 * 4. **Claude Clarifies**: Claude asks follow-up questions about requirements
 * 5. **User Responds**: User provides additional details
 * 6. **Creation Phase**: Claude writes the agent file using Write tool
 * 7. **Success Display**: Panel shows success message with agent file path
 * 8. **Callback Invoked**: onAgentCreated callback triggers for parent refresh
 *
 * ### Auto-Start Behavior
 * - When panel opens (`isOpen: true`), automatically calls `startConversation()`
 * - Only starts if `messages.length === 0` (no existing conversation)
 * - Initial message from Claude appears within ~1-2 seconds via SSE streaming
 * - Input field auto-focuses after 300ms animation delay
 *
 * ## Message Flow
 * The component handles bidirectional message exchange:
 *
 * ### User Messages
 * - User types in input field and presses Enter or clicks Send button
 * - `handleSendMessage()` called with input value
 * - Input cleared immediately (optimistic UI)
 * - Message sent to backend via `sendMessage(content)`
 * - User message appears in chat with right-aligned blue background
 * - Timestamp displayed below message (HH:MM format)
 *
 * ### Assistant Messages
 * - Received via SSE streaming from useAgentCreator hook
 * - Messages array updated in real-time as chunks arrive
 * - Assistant messages appear with left-aligned muted background
 * - Content rendered as markdown using ReactMarkdown
 * - Timestamp displayed below message (HH:MM format)
 * - Auto-scroll triggers on each new message
 *
 * ### Processing Indicator
 * - When `isProcessing: true`, displays animated "Claude is thinking..." message
 * - Three bouncing dots with staggered animation delays (0ms, 150ms, 300ms)
 * - Input field disabled during processing
 * - Send button disabled during processing
 *
 * ## Integration with useAgentCreator
 * The component deeply integrates with the useAgentCreator hook:
 *
 * ### Hook Setup
 * ```typescript
 * const {
 *   messages,        // Conversation history
 *   isProcessing,    // True when waiting for response
 *   isCreating,      // True when writing agent file
 *   createdAgentName,// Name of created agent
 *   error,           // Error object if creation fails
 *   startConversation, // Initiates conversation
 *   sendMessage,     // Sends user message
 *   reset            // Clears state for new session
 * } = useAgentCreator({ directory, onAgentCreated, onError });
 * ```
 *
 * ### Hook Callbacks
 * - **onAgentCreated**: Called when Write tool creates agent file
 *   - Sets `panelState` to 'success'
 *   - Triggers parent `onAgentCreated()` callback
 *   - Hook extracts agent name from file path `.claude/agents/{name}.md`
 *
 * - **onError**: Called when creation fails
 *   - Sets `panelState` to 'error'
 *   - Logs error to console
 *   - Shows error UI with retry button
 *
 * ### State Synchronization
 * - `useEffect` monitors `isCreating`, `createdAgentName`, `error` from hook
 * - Updates local `panelState` based on hook state changes:
 *   - `isCreating === true` → panelState: 'creating'
 *   - `createdAgentName !== null` → panelState: 'success'
 *   - `error !== null` → panelState: 'error'
 *   - Otherwise → panelState: 'chat'
 *
 * ## Panel States
 * The component has four distinct UI states:
 *
 * ### 1. Chat State (`panelState === 'chat'`)
 * - **Display**: Message list with scrollable history + input area
 * - **Behavior**: Active conversation with send/receive messages
 * - **UI Elements**:
 *   - Messages area: Scrollable with auto-scroll
 *   - Processing indicator: Visible when `isProcessing === true`
 *   - Input field: Enabled, focused, with placeholder
 *   - Send button: Enabled when input has content and not processing
 *   - Keyboard hint: "Press Enter to send, Shift+Enter for new line"
 *
 * ### 2. Creating State (`panelState === 'creating'`)
 * - **Display**: Centered loading spinner with status text
 * - **Trigger**: Hook detects "Creating" or "Writing" in status events
 * - **UI Elements**:
 *   - Spinning purple border circle (4px thick, 64px diameter)
 *   - Heading: "Creating Your Agent"
 *   - Subtext: "Claude is writing the agent file..."
 * - **Duration**: Until Write tool completes or errors
 *
 * ### 3. Success State (`panelState === 'success'`)
 * - **Display**: Centered success message with agent details
 * - **Trigger**: Hook extracts `createdAgentName` from Write tool file path
 * - **UI Elements**:
 *   - Green checkmark icon (80px size)
 *   - Heading: "Agent Created Successfully!" (green text)
 *   - Info box: Agent file path (`.claude/agents/{name}.md`)
 *   - Subtext: "Your new agent is ready to use..."
 *   - Close button: "Close & View Agent"
 * - **Styling**: Green color scheme (green-600, green-50, green-200)
 *
 * ### 4. Error State (`panelState === 'error'`)
 * - **Display**: Centered error message with retry option
 * - **Trigger**: Hook encounters error during creation or streaming
 * - **UI Elements**:
 *   - Red exclamation icon (80px size)
 *   - Heading: "Something Went Wrong" (red text)
 *   - Error message: "Failed to create the agent..."
 *   - Two buttons:
 *     - "Close" (secondary variant)
 *     - "Try Again" (primary, calls `startConversation()`)
 * - **Styling**: Red color scheme (red-600)
 *
 * ## Auto-Scroll Behavior
 * The component implements smooth auto-scrolling to keep latest messages visible:
 *
 * ### Implementation
 * - `messagesEndRef` positioned at bottom of message list
 * - `useEffect` watches `messages` array for changes
 * - When messages update, calls `scrollIntoView({ behavior: 'smooth' })`
 * - Scrolls to bottom of chat area within ~300ms smooth animation
 *
 * ### Scroll Triggers
 * - New assistant message arrives via SSE
 * - User sends message (optimistically added to array)
 * - Processing indicator appears/disappears
 * - Panel state changes (e.g., chat → creating)
 *
 * ## Keyboard Shortcuts
 * The component supports keyboard shortcuts for efficient interaction:
 *
 * ### Enter Key
 * - **Action**: Send message
 * - **Condition**: Not holding Shift key
 * - **Handler**: `handleKeyPress(e)` → `e.preventDefault()` → `handleSendMessage()`
 * - **Note**: Prevents default form submission behavior
 *
 * ### Shift+Enter
 * - **Action**: Insert new line
 * - **Condition**: Holding Shift key
 * - **Behavior**: Default browser behavior (newline in input)
 * - **Note**: Currently input is single-line, so this may not function as expected
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS for theming and layout:
 *
 * ### Panel Layout
 * - **Position**: Fixed right side, full height
 * - **Width**: Full width on mobile (`w-full`), 600px on desktop (`sm:w-[600px]`)
 * - **Z-Index**: 50 (above overlay at z-40)
 * - **Animation**: `translate-x-full` (hidden) → `translate-x-0` (visible)
 * - **Duration**: 300ms ease-in-out transition
 *
 * ### Overlay
 * - **Background**: `bg-black/20` (20% opacity black)
 * - **Z-Index**: 40 (below panel)
 * - **Interaction**: Clickable to close panel
 * - **Transition**: 300ms opacity fade
 *
 * ### Header
 * - **Gradient**: Purple to blue gradient background (`from-purple-50 to-blue-50`)
 * - **Icon**: Purple sparkles icon (24px)
 * - **Title**: "Create with Claude Manager" (lg semibold)
 * - **Subtitle**: "Interactive agent creation assistant" (sm muted)
 * - **Close Button**: X icon with hover background
 *
 * ### Messages
 * - **User**: Right-aligned, blue background (`bg-primary`), white text
 * - **Assistant**: Left-aligned, muted background with border
 * - **Width**: Max 85% of container width for readability
 * - **Padding**: 16px horizontal, 12px vertical
 * - **Timestamp**: Small text, 70% opacity, below content
 *
 * ### Input Area
 * - **Border**: Top border separator
 * - **Padding**: 16px all sides
 * - **Layout**: Flexbox row with gap-2
 * - **Input**: Flex-1 (takes remaining space)
 * - **Button**: Fixed width (px-6 padding)
 * - **Hint**: Small muted text below input
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XCircleIcon, SparklesIcon, CheckCircleIcon, ExclamationCircleIcon } from './ui/Icons';
import ReactMarkdown from 'react-markdown';
import { useAgentCreator } from '../hooks/useAgentCreator';

/**
 * Props for the AgentCreatorChatPanel component.
 *
 * @property {boolean} isOpen - Controls panel visibility and slide-in animation.
 *   When true, panel slides in from right; when false, panel slides out.
 *   Also triggers auto-start conversation when transitioning to true.
 *
 * @property {() => void} onClose - Callback invoked when panel should close.
 *   Called when user clicks overlay, close button, or "Close & View Agent" button.
 *   Parent should set `isOpen: false` in response to this callback.
 *
 * @property {() => void} [onAgentCreated] - Optional callback invoked when agent is successfully created.
 *   Called after useAgentCreator hook detects Write tool usage.
 *   Parent can use this to refresh agent list or navigate to agent details.
 *   Called with no arguments (agent name available via hook).
 *
 * @property {string} [directory] - Optional directory path for agent creation context.
 *   Passed to useAgentCreator hook for directory-specific operations.
 *   Defaults to current working directory if not provided.
 *
 * @example
 * // Basic usage
 * <AgentCreatorChatPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 *
 * @example
 * // With agent created callback
 * <AgentCreatorChatPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onAgentCreated={() => {
 *     refetchAgents(); // Refresh agent list
 *     setIsOpen(false); // Close panel
 *   }}
 * />
 *
 * @example
 * // With custom directory
 * <AgentCreatorChatPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   directory="/projects/my-app"
 *   onAgentCreated={() => console.log('Agent created in /projects/my-app')}
 * />
 */
interface AgentCreatorChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentCreated?: () => void;
  directory?: string;
}

/**
 * Panel state type representing the current UI mode.
 *
 * @typedef {'chat' | 'creating' | 'success' | 'error'} PanelState
 *
 * - `'chat'` - Active conversation mode with message history and input
 * - `'creating'` - Loading state when agent file is being written
 * - `'success'` - Success screen showing created agent details
 * - `'error'` - Error screen with retry option
 */
type PanelState = 'chat' | 'creating' | 'success' | 'error';

/**
 * Interactive slide-in panel component for creating agents through conversation with Claude Manager.
 *
 * This component provides a chat-based interface for agent creation, integrating with the
 * useAgentCreator hook for SSE streaming and state management. The panel slides in from the
 * right side and guides users through a conversational workflow to create new agents.
 *
 * The component manages four distinct states (chat, creating, success, error) and handles
 * message flow, auto-scrolling, keyboard shortcuts, and input focus management.
 *
 * @param {AgentCreatorChatPanelProps} props - Component props
 * @returns {React.ReactElement | null} Rendered panel or null if not open
 *
 * @example
 * // Basic usage with state management
 * function AgentsPage() {
 *   const [isPanelOpen, setIsPanelOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <Button onClick={() => setIsPanelOpen(true)}>
 *         Create Agent with Claude
 *       </Button>
 *
 *       <AgentCreatorChatPanel
 *         isOpen={isPanelOpen}
 *         onClose={() => setIsPanelOpen(false)}
 *       />
 *     </>
 *   );
 * }
 *
 * @example
 * // With agent created callback to refresh list
 * function AgentsPage() {
 *   const [agents, setAgents] = useState([]);
 *   const [isPanelOpen, setIsPanelOpen] = useState(false);
 *
 *   const fetchAgents = async () => {
 *     const response = await fetch('/api/manager/agents');
 *     const data = await response.json();
 *     setAgents(data);
 *   };
 *
 *   return (
 *     <AgentCreatorChatPanel
 *       isOpen={isPanelOpen}
 *       onClose={() => setIsPanelOpen(false)}
 *       onAgentCreated={() => {
 *         fetchAgents(); // Refresh the agent list
 *         setIsPanelOpen(false); // Close the panel
 *       }}
 *     />
 *   );
 * }
 *
 * @example
 * // With custom directory for project-specific agents
 * function ProjectSettings({ projectPath }) {
 *   const [showCreator, setShowCreator] = useState(false);
 *
 *   return (
 *     <AgentCreatorChatPanel
 *       isOpen={showCreator}
 *       onClose={() => setShowCreator(false)}
 *       directory={projectPath}
 *       onAgentCreated={() => {
 *         console.log('Agent created in', projectPath);
 *         setShowCreator(false);
 *       }}
 *     />
 *   );
 * }
 *
 * @example
 * // Understanding the conversation flow
 * // 1. User clicks "Create Agent with Claude" button
 * // 2. Panel opens (isOpen: true)
 * // 3. Auto-starts conversation (startConversation())
 * // 4. Claude: "Hi! I can help you create an agent. What should it do?"
 * // 5. User: "I need an agent to optimize SQL queries"
 * // 6. Claude: "Great! What database are you using? PostgreSQL, MySQL, etc?"
 * // 7. User: "PostgreSQL"
 * // 8. Claude: "Perfect! I'll create a SQL optimization agent for PostgreSQL..."
 * // 9. Panel state changes to 'creating' (spinner shows)
 * // 10. Claude uses Write tool to create .claude/agents/sql-optimizer.md
 * // 11. Panel state changes to 'success' (checkmark shows)
 * // 12. User clicks "Close & View Agent"
 * // 13. onAgentCreated() callback fires (parent refreshes agent list)
 */
const AgentCreatorChatPanel: React.FC<AgentCreatorChatPanelProps> = ({
  isOpen,
  onClose,
  onAgentCreated,
  directory,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [panelState, setPanelState] = useState<PanelState>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use the agent creator hook
  const {
    messages,
    isProcessing,
    isCreating,
    createdAgentName,
    error,
    startConversation,
    sendMessage,
    reset
  } = useAgentCreator({
    directory,
    onAgentCreated: (agentName) => {
      setPanelState('success');
      if (onAgentCreated) {
        onAgentCreated();
      }
    },
    onError: (err) => {
      setPanelState('error');
      console.error('Agent creation error:', err);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && panelState === 'chat') {
      // Delay to ensure panel animation completes
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, panelState]);

  // Start conversation when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, messages.length]);

  // Update panel state based on creation status
  useEffect(() => {
    if (isCreating) {
      setPanelState('creating');
    } else if (createdAgentName) {
      setPanelState('success');
    } else if (error) {
      setPanelState('error');
    } else if (messages.length > 0) {
      setPanelState('chat');
    }
  }, [isCreating, createdAgentName, error, messages.length]);

  /**
   * Handles sending a user message to the conversation.
   *
   * This function validates the input, clears the input field (optimistic UI),
   * and sends the message via the useAgentCreator hook's sendMessage function.
   * On error, sets panel state to 'error' to show error UI.
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   *
   * Workflow:
   * 1. Validates input (must have content and not be processing)
   * 2. Captures input value and clears input field immediately
   * 3. Calls sendMessage() from useAgentCreator hook
   * 4. Hook handles SSE streaming and message state updates
   * 5. On error, logs to console and shows error UI
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const content = inputValue;
    setInputValue('');

    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
      setPanelState('error');
    }
  };

  /**
   * Handles keyboard shortcuts in the input field.
   *
   * Supports Enter to send and Shift+Enter for new line (though input is currently
   * single-line, so Shift+Enter behavior may not be functional).
   *
   * @internal
   * @param {React.KeyboardEvent<HTMLInputElement>} e - Keyboard event from input field
   *
   * Keyboard Actions:
   * - Enter (without Shift): Prevents default, sends message
   * - Shift+Enter: Allows default behavior (new line)
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * Handles closing the panel and resetting state.
   *
   * Immediately calls onClose() to trigger parent state update and slide-out animation.
   * After 300ms (matching animation duration), resets all internal state including
   * conversation messages, panel state, and input value.
   *
   * @internal
   *
   * Workflow:
   * 1. Invokes onClose() callback (parent sets isOpen: false)
   * 2. Panel slides out over 300ms (CSS transition)
   * 3. After 300ms timeout:
   *    - Calls reset() from useAgentCreator hook (clears messages, errors, etc.)
   *    - Resets panelState to 'chat'
   *    - Clears inputValue
   * 4. Panel ready for next open with clean state
   */
  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      reset();
      setPanelState('chat');
      setInputValue('');
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[600px] bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create with Claude Manager</h2>
              <p className="text-sm text-muted-foreground">Interactive agent creation assistant</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-background/50"
            aria-label="Close panel"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-col h-[calc(100%-73px)]">
          {panelState === 'chat' && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground border border-border'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                      <div
                        className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground border border-border rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Claude is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-border p-4 bg-background">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your response..."
                    disabled={isProcessing}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isProcessing}
                    className="px-6"
                  >
                    Send
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}

          {panelState === 'creating' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <h3 className="text-xl font-semibold">Creating Your Agent</h3>
                <p className="text-muted-foreground">
                  Claude is writing the agent file...
                </p>
              </div>
            </div>
          )}

          {panelState === 'success' && createdAgentName && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center space-y-4">
                <CheckCircleIcon className="w-20 h-20 text-green-600 mx-auto" />
                <h3 className="text-2xl font-bold text-green-600">Agent Created Successfully!</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    Agent File: .claude/agents/{createdAgentName}.md
                  </p>
                  <p className="text-xs text-green-700">
                    Your new agent is ready to use and will automatically activate when needed.
                  </p>
                </div>
                <Button onClick={handleClose} className="mt-4">
                  Close & View Agent
                </Button>
              </div>
            </div>
          )}

          {panelState === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center space-y-4">
                <ExclamationCircleIcon className="w-20 h-20 text-red-600 mx-auto" />
                <h3 className="text-2xl font-bold text-red-600">Something Went Wrong</h3>
                <p className="text-muted-foreground max-w-md">
                  Failed to create the agent. Please try again or create the agent manually.
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="secondary" onClick={handleClose}>
                    Close
                  </Button>
                  <Button onClick={startConversation}>
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

AgentCreatorChatPanel.displayName = 'AgentCreatorChatPanel';

export default AgentCreatorChatPanel;
