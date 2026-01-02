/**
 * ChatPage - Modern conversational chat interface with session management
 *
 * Page-level component for interactive AI chat with Claude Agent SDK integration,
 * session management, agent/skill selection, permission modes, and real-time SSE
 * streaming. Features dual-pane layout with session sidebar and chat area using
 * assistant-ui primitives for modern message display and composition.
 *
 * ## Features
 *
 * - Chat session management with create, select, archive, delete operations
 * - Real-time message streaming via SSE with Claude Agent SDK
 * - Agent and skill selection with per-conversation runtime overrides
 * - Permission mode switching (default, bypass, auto, plan)
 * - View mode toggle (simple, detailed) for message display
 * - File attachments support (images, PDFs, text files)
 * - Markdown rendering with syntax highlighting via MessageBubble components
 * - Auto-scroll behavior for new messages
 * - Session list with skill badges and relative timestamps
 * - Integration with assistant-ui framework (ThreadPrimitive, ComposerArea)
 * - ChatDisplayContext integration for SDK event tracking (tool uses, system messages)
 *
 * ## Chat Interface
 *
 * The interface uses a dual-pane layout:
 *
 * ### Left Sidebar - Chat Sessions (w-80, gray-800):
 * - **Header Section**: "Chats" title with "+ New Chat" button (blue-600)
 * - **Sessions List**: Vertical scrollable list with:
 *   - Session title truncated with ellipsis
 *   - Skill badges (max 2 visible + overflow count)
 *   - Relative timestamp (e.g., "5m ago", "2h ago", "3d ago")
 *   - Archive button (ArchiveIcon, hover:text-gray-200)
 *   - Delete button (TrashIcon, hover:text-red-400)
 *   - Active highlight: blue-500 left border, gray-700 background
 *   - Hover effect: gray-700 background transition
 * - **Empty State**: MessageSquareIcon with "No chat sessions yet" message
 *
 * ### Right Side - Chat Area (flex-1, gray-900):
 * - **Chat Header** (gray-800):
 *   - Session title (text-lg, semibold, white)
 *   - Agent/Skills selection area (clickable, hover:border-blue-500):
 *     * Agent display with model badge (purple-900/30 background)
 *     * Skills display with badge layout (blue-600 for selected, gray-600 for session defaults)
 *     * "Click to change" hint text (gray-500)
 *   - Mode Controls (right-aligned):
 *     * Permission mode selector (default/bypass/auto/plan)
 *     * View mode selector (simple/detailed)
 * - **Messages Area** (flex-1, overflow-hidden):
 *   - ThreadPrimitive.Viewport with auto-scroll
 *   - UserMessage, AssistantMessage, SystemMessage components
 *   - Empty state: MessageSquareIcon with "Start the conversation" message
 *   - Loading state: "Loading messages..." spinner
 * - **Composer Area**: ComposerArea component from assistant-ui
 *   - Auto-resize textarea (48px-200px)
 *   - File attachment support with preview
 *   - Send/Cancel button based on running state
 *   - Keyboard shortcuts (Enter to send, Shift+Enter for newline)
 *
 * ## Session Management
 *
 * ### Session Creation:
 * 1. User clicks "+ New Chat" button in sidebar header or empty state
 * 2. ChatSessionModal opens with skill/agent selection form
 * 3. User enters session name, selects skills (multi-select), optional agent
 * 4. API call to POST /api/chat-sessions with directory context
 * 5. New session added to sessions list at top
 * 6. New session becomes active automatically
 * 7. Modal closes, empty chat area displayed
 *
 * ### Session Selection:
 * 1. User clicks on session item in sidebar
 * 2. handleSelectSession sets activeSession state
 * 3. useEffect triggers loadMessages for session documentId
 * 4. Permission mode updated from session.permissionMode or session.planMode
 * 5. Runtime overrides initialized with session agent and skills
 * 6. ChatDisplayContext event data cleared via clearEventData
 * 7. Messages displayed in ThreadPrimitive.Viewport
 *
 * ### Session Archive:
 * 1. User clicks archive button (ArchiveIcon) on session item
 * 2. Event propagation stopped to prevent session selection
 * 3. API call to PATCH /api/chat-sessions/:id with status: "archived"
 * 4. Session removed from active sessions list
 * 5. If archived session was active, first remaining session selected
 * 6. If no remaining sessions, activeSession set to null (empty state displayed)
 *
 * ### Session Delete:
 * 1. User clicks delete button (TrashIcon) on session item
 * 2. Confirmation dialog: "Are you sure you want to delete this chat session?"
 * 3. If confirmed, API call to DELETE /api/chat-sessions/:id
 * 4. Session removed from sessions list
 * 5. If deleted session was active, first remaining session selected
 * 6. If no remaining sessions, activeSession set to null
 *
 * ## Agent and Skill Selection
 *
 * ### Runtime Override Mechanism:
 * - **Session Defaults**: Agent and skills from activeSession.agent and activeSession.skills
 * - **Runtime Overrides**: selectedAgentId and selectedSkillIds state (initially undefined)
 * - **Display Logic**:
 *   - If selectedAgentId is set, show override agent name and model
 *   - If selectedAgentId is undefined, show session default agent or "Session Default"
 *   - If selectedSkillIds is non-empty, show override skills with blue-600 badges
 *   - If selectedSkillIds is empty, show session skills with gray-600 badges or "No skills selected"
 * - **Runtime Integration**: selectedAgentId and selectedSkillIds passed to useAssistantRuntime
 *   as agentId and skillIds props for per-message override behavior
 *
 * ### Selection Modal Workflow:
 * 1. User clicks on agent/skills selection area in chat header (gray-750, hover:border-blue-500)
 * 2. Modal opens with agent dropdown and skills checkbox grid (max-h-[80vh], gray-800)
 * 3. **Agent Selection**: Dropdown with "Use Session Default" option + all available agents
 *    - Shows agent name and model in option text (e.g., "Agent Name [claude-3-5-sonnet-20241022]")
 *    - Selection updates selectedAgentId state (empty string = undefined for session default)
 * 4. **Skills Selection**: 2-column checkbox grid (max-h-60 overflow-y-auto)
 *    - Each skill: checkbox + label with skill.displayName or skill.name
 *    - Selected skills: blue-600 background with border-blue-500
 *    - Unselected skills: gray-700 background with hover:bg-gray-600
 *    - Multi-select with checkbox state management
 * 5. User clicks "Done" button to close modal
 * 6. Selection persists for entire conversation (not saved to session)
 * 7. Next message uses runtime overrides if set
 *
 * ## Message Handling
 *
 * Messages flow through assistant-ui runtime integration via useAssistantRuntime hook:
 *
 * ### Message Loading:
 * 1. loadMessages called on activeSession change (useEffect dependency)
 * 2. API call to GET /api/chat-sessions/:sessionId/messages
 * 3. Messages stored in messages state (ChatMessage[])
 * 4. Messages passed to useAssistantRuntime as initialMessages
 * 5. Runtime converts to ThreadMessage format for assistant-ui
 *
 * ### Message Sending:
 * 1. User types message in ComposerArea textarea
 * 2. User clicks Send button or presses Enter (handled by ComposerPrimitive)
 * 3. ComposerPrimitive triggers runtime.append with message content
 * 4. useAssistantRuntime handleNewMessage creates optimistic user message
 * 5. SSE stream initiated to /api/chat-sessions/:sessionId/messages
 * 6. Stream events processed (content_block_delta, tool_use, message_stop)
 * 7. handleMessagesUpdate callback invoked with updated messages array
 * 8. Messages state updated, triggering re-render of ThreadPrimitive.Messages
 * 9. Auto-scroll to messagesEndRef triggered by useEffect
 *
 * ### SDK Event Tracking:
 * - useAssistantRuntime hook extracts tool_use and system_message events from SSE stream
 * - onToolUseUpdate callback invokes setToolUses from ChatDisplayContext
 * - onSystemMessage callback appends to systemMessages array in ChatDisplayContext
 * - MessageBubble components query context for event data to display in detailed view mode
 *
 * ## Permission Modes
 *
 * Permission mode controls how the agent handles tool execution requests:
 *
 * - **default**: Agent asks for user permission before executing tools (default behavior)
 *   - User sees permission request messages in chat
 *   - User must approve each tool execution
 * - **bypass**: Agent executes tools without asking for permission (fully automated)
 *   - Tool executions happen silently
 *   - Useful for trusted automated workflows
 * - **auto**: Agent automatically accepts permission requests but shows them
 *   - Similar to bypass but with visibility
 *   - Good for monitoring automated executions
 * - **plan**: Plan mode - agent creates implementation plan before execution
 *   - Agent outlines steps before taking action
 *   - User can review and approve plan
 *
 * Permission mode is:
 * 1. Initialized from activeSession.planMode (legacy) or activeSession.permissionMode
 * 2. Stored in permissionMode state (default | bypass | auto | plan)
 * 3. User can change via Mode dropdown in chat header
 * 4. Passed to useAssistantRuntime as permissionMode prop
 * 5. Sent with each SSE request to backend
 *
 * ## View Modes
 *
 * View mode controls message display detail level via ChatDisplayContext:
 *
 * - **simple**: Compact message view
 *   - Tool uses shown as compact indicator badge
 *   - System messages hidden or minimized
 *   - Focus on conversational content
 * - **detailed**: Expanded message view with full SDK event data
 *   - Tool uses shown as collapsible sections with input/output
 *   - System messages displayed with full content
 *   - Useful for debugging and understanding agent behavior
 *
 * View mode is:
 * 1. Managed by ChatDisplayContext (viewMode state)
 * 2. Accessed via useChatDisplay hook
 * 3. User can toggle via View dropdown in chat header
 * 4. Passed to MessageBubble components for conditional rendering
 *
 * ## Auto-Scroll Behavior
 *
 * Automatic scrolling to latest message implemented with:
 *
 * 1. **messagesEndRef**: useRef<HTMLDivElement> positioned at end of message list
 * 2. **useEffect Hook**: Triggers on messages state change
 * 3. **Scroll Invocation**: messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
 * 4. **Timing**: Runs after every message update (user sends, assistant responds, streaming deltas)
 * 5. **Smooth Scrolling**: CSS smooth scrolling behavior for better UX
 *
 * ## Directory Integration
 *
 * Directory context is retrieved from cookies and used for API calls:
 *
 * - **getDirectory Function**: Parses document.cookie for 'selectedDirectory' key
 * - **Cookie Format**: selectedDirectory=URI_ENCODED_PATH
 * - **Usage**: Directory passed to:
 *   - getChatSessions (filters sessions by directory)
 *   - getAgents and getSkills (for runtime override options)
 *   - ChatSessionModal (for session creation with directory context)
 *
 * ## Styling Behavior
 *
 * Modern dark theme with gray tones and blue accents:
 *
 * - **Layout**: flex h-full with sidebar and main area
 * - **Sidebar**: gray-800 background with border-r border-gray-700
 * - **Chat Area**: gray-900 background for main content
 * - **Session Items**: gray-700 hover, blue-500 active border-l-4
 * - **Chat Header**: gray-800 with border-b border-gray-700
 * - **Agent/Skills Area**: gray-750 with hover:border-blue-500 transition
 * - **Selected Skills**: blue-600 badges with border-blue-500
 * - **Session Default Skills**: gray-600 badges with border-gray-500
 * - **Buttons**: blue-600/blue-700 for primary actions
 * - **Archive Button**: hover:text-gray-200, hover:bg-gray-600
 * - **Delete Button**: hover:text-red-400, hover:bg-red-900/30
 * - **Dropdown Controls**: gray-700 background with focus:ring-blue-500
 * - **Modal**: gray-800 background with backdrop-blur-sm overlay
 * - **Empty States**: gray-400/gray-600 text with large icons
 * - **Typography**: Inter font family, responsive text sizes
 *
 * @example
 * // Basic usage in ManagerApp dashboard phase
 * import ChatPage from './components/ChatPage';
 *
 * function ManagerApp() {
 *   const [activeView, setActiveView] = useState('chat');
 *
 *   return (
 *     <Layout>
 *       {activeView === 'chat' && <ChatPage />}
 *     </Layout>
 *   );
 * }
 *
 * @example
 * // Understanding session creation workflow
 * // 1. User clicks "+ New Chat" button
 * // 2. ChatSessionModal opens with form:
 * //    - Session name input
 * //    - Multi-select skill checkboxes with search filter
 * //    - Optional agent dropdown
 * // 3. User fills form and clicks "Create"
 * // 4. API call: POST /api/chat-sessions
 * //    Request body: { name, skills: [skillId1, skillId2], agent: agentId, directory }
 * // 5. handleChatCreated callback invoked with new session object
 * // 6. Session added to top of sessions list
 * // 7. Session becomes active automatically
 * // 8. Empty chat area displayed with composer ready for first message
 *
 * @example
 * // Understanding agent/skill runtime override workflow
 * // Initial state from session:
 * // - activeSession.agent = { documentId: "agent1", name: "Default Agent", modelConfig: { model: "claude-3-5-sonnet" } }
 * // - activeSession.skills = [{ documentId: "skill1", name: "Skill A" }]
 * // - selectedAgentId = undefined (use session default)
 * // - selectedSkillIds = [] (use session default)
 * //
 * // User clicks agent/skills area in header:
 * // 1. Modal opens with current selections:
 * //    - Agent dropdown shows "Use Session Default" (selected)
 * //    - Skills grid shows all available skills, none checked
 * // 2. User selects different agent from dropdown: "agent2"
 * //    - selectedAgentId = "agent2"
 * // 3. User checks two skills: "skill2", "skill3"
 * //    - selectedSkillIds = ["skill2", "skill3"]
 * // 4. User clicks "Done"
 * // 5. Header display updates:
 * //    - Agent: "Override Agent [claude-3-opus]" (purple model badge)
 * //    - Skills: "Skill B", "Skill C" (blue-600 badges indicating override)
 * // 6. Next message uses agent2 with skill2 and skill3 instead of session defaults
 * // 7. Runtime overrides persist for conversation but not saved to session
 *
 * @example
 * // Understanding message flow with SDK event tracking
 * // 1. User types "Create a Python script to calculate fibonacci"
 * // 2. User clicks Send button (or presses Enter)
 * // 3. ComposerArea -> ComposerPrimitive triggers runtime.append
 * // 4. useAssistantRuntime handleNewMessage:
 * //    - Creates optimistic user message
 * //    - Initiates SSE stream to /api/chat-sessions/:sessionId/messages
 * //    - Headers: { agentId: "agent2", skillIds: ["skill2", "skill3"], permissionMode: "auto" }
 * // 5. SSE events received and processed:
 * //    - content_block_start: Assistant message begins
 * //    - content_block_delta: { delta: { text: "I'll create a..." } } -> append to message content
 * //    - tool_use: { name: "Write", input: { file_path: "fib.py", content: "def fibonacci..." } }
 * //      * onToolUseUpdate callback -> setToolUses in ChatDisplayContext
 * //    - tool_result: { tool_use_id: "...", content: "File written successfully" }
 * //    - system_message: { type: "result", content: "Task completed" }
 * //      * onSystemMessage callback -> append to systemMessages in ChatDisplayContext
 * //    - message_stop: Stream ends
 * // 6. handleMessagesUpdate invoked with full messages array
 * // 7. Messages state updated
 * // 8. ThreadPrimitive.Messages re-renders with new assistant message
 * // 9. AssistantMessage component queries ChatDisplayContext for tool uses and system messages
 * // 10. If viewMode === "detailed", tool use displayed as collapsible ToolUseDisplay
 * // 11. Auto-scroll to messagesEndRef triggered by useEffect
 */

import React, { useState, useEffect, useRef } from 'react';
import * as chatApi from '../services/chat-api';
import { Button } from './ui/Button';
import { PlusIcon, MessageSquareIcon, ArchiveIcon, TrashIcon } from './ui/Icons';
import ChatSessionModal from './ChatSessionModal';

// assistant-ui imports
import { AssistantRuntimeProvider, ThreadPrimitive } from '@assistant-ui/react';
import { useAssistantRuntime } from '../hooks/useAssistantRuntime';

// Modern components
import { UserMessage, AssistantMessage, SystemMessage } from './MessageBubble';
import ComposerArea from './ComposerArea';

// Chat display context
import { ChatDisplayProvider, useChatDisplay } from '../contexts/ChatDisplayContext';

/**
 * ChatPageContent - Main chat interface component (internal)
 *
 * Internal component containing chat session list, message display, and composer.
 * Wrapped by ChatPage component with ChatDisplayProvider for SDK event context.
 *
 * @internal
 */
const ChatPageContent: React.FC = () => {
  const [sessions, setSessions] = useState<chatApi.ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<chatApi.ChatSession | null>(null);
  const [messages, setMessages] = useState<chatApi.ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  // Mode state (initialized from active session)
  const [permissionMode, setPermissionMode] = useState<'default' | 'bypass' | 'auto' | 'plan'>('default');
  // Available agents and skills for runtime selection
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  // Runtime selection (per-message overrides)
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  // Modal state for runtime selection
  const [showAgentSkillModal, setShowAgentSkillModal] = useState(false);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use chat display context
  const { viewMode, setViewMode, setToolUses, setSystemMessages, clearEventData } = useChatDisplay();

  /**
   * Retrieves selected directory from browser cookies
   *
   * Parses document.cookie string to find 'selectedDirectory' value for directory context.
   * Used for filtering sessions, agents, and skills by directory in API calls.
   *
   * @internal
   * @returns Directory path string or undefined if not set
   */
  const getDirectory = () => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'selectedDirectory') {
        return decodeURIComponent(value);
      }
    }
    return undefined;
  };

  // Load initial data on component mount
  useEffect(() => {
    loadSessions();
    loadAvailableAgentsAndSkills();
  }, []);

  // Handle active session changes
  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.documentId);
      // Update permission mode from session (plan mode is now part of permission mode)
      const sessionMode = activeSession.planMode ? 'plan' : (activeSession.permissionMode || 'default');
      setPermissionMode(sessionMode as 'default' | 'bypass' | 'auto' | 'plan');
      // Initialize runtime overrides with session defaults when switching sessions
      setSelectedAgentId(activeSession.agent?.documentId);
      setSelectedSkillIds(activeSession.skills?.map(s => s.documentId) || []);
    }
  }, [activeSession]);

  /**
   * Loads all active chat sessions from API
   *
   * Fetches sessions, filters to active status only (excludes archived), and auto-selects
   * first session if no session currently active. Displays alert on error.
   *
   * @internal
   */
  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await chatApi.getChatSessions();
      // Filter out archived sessions by default
      const activeSessions = data.filter(s => s.status === 'active');
      setSessions(activeSessions);

      // Auto-select first session if exists
      if (activeSessions.length > 0 && !activeSession) {
        setActiveSession(activeSessions[0]);
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      alert('Failed to load chat sessions');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Loads available agents and skills for runtime override selection
   *
   * Fetches all agents and skills from API in parallel for populating agent/skill
   * selection modal. Uses directory context from cookies. Silently handles errors
   * (modal will show empty lists).
   *
   * @internal
   */
  const loadAvailableAgentsAndSkills = async () => {
    try {
      const [agents, skills] = await Promise.all([
        chatApi.getAgents(),
        chatApi.getSkills(),
      ]);
      setAvailableAgents(agents);
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Failed to load agents/skills:', error);
    }
  };

  /**
   * Loads messages for a specific chat session
   *
   * Fetches message history for given session ID and updates messages state.
   * Shows loading state during fetch. Displays alert on error.
   *
   * @internal
   * @param sessionId - Chat session document ID
   */
  const loadMessages = async (sessionId: string) => {
    try {
      setMessagesLoading(true);
      const data = await chatApi.getChatMessages(sessionId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
      alert('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  /**
   * Opens new chat session creation modal
   *
   * Sets showNewChatModal to true, triggering ChatSessionModal render.
   *
   * @internal
   */
  const handleNewChat = () => {
    setShowNewChatModal(true);
  };

  /**
   * Handles successful chat session creation
   *
   * Adds new session to top of sessions list, makes it active, and closes modal.
   * Called by ChatSessionModal onChatCreated callback.
   *
   * @internal
   * @param session - Newly created chat session object
   */
  const handleChatCreated = (session: chatApi.ChatSession) => {
    setSessions(prev => [session, ...prev]);
    setActiveSession(session);
    setShowNewChatModal(false);
  };

  /**
   * Handles session selection from sidebar list
   *
   * Sets clicked session as active, triggering message load via useEffect.
   *
   * @internal
   * @param session - Chat session to activate
   */
  const handleSelectSession = (session: chatApi.ChatSession) => {
    setActiveSession(session);
  };

  /**
   * Deletes a chat session with confirmation
   *
   * Shows confirmation dialog, makes DELETE API call, removes from list, and
   * auto-selects first remaining session if deleted session was active.
   *
   * @internal
   * @param sessionId - Session document ID to delete
   */
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return;

    try {
      await chatApi.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.documentId !== sessionId));

      // If deleted session was active, select first available
      if (activeSession?.documentId === sessionId) {
        const remaining = sessions.filter(s => s.documentId !== sessionId);
        setActiveSession(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete chat session');
    }
  };

  /**
   * Archives a chat session (soft delete)
   *
   * Updates session status to "archived" via PATCH API call, removes from active list,
   * and auto-selects first remaining session if archived session was active.
   *
   * @internal
   * @param sessionId - Session document ID to archive
   */
  const handleArchiveSession = async (sessionId: string) => {
    try {
      await chatApi.archiveChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.documentId !== sessionId));

      // If archived session was active, select first available
      if (activeSession?.documentId === sessionId) {
        const remaining = sessions.filter(s => s.documentId !== sessionId);
        setActiveSession(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (error) {
      console.error('Failed to archive session:', error);
      alert('Failed to archive chat session');
    }
  };

  /**
   * Handles messages update from useAssistantRuntime
   *
   * Updates messages state with new array and refreshes sessions list to get
   * updated session titles (auto-generated from first message).
   *
   * @internal
   * @param newMessages - Updated messages array from runtime
   */
  const handleMessagesUpdate = (newMessages: chatApi.ChatMessage[]) => {
    setMessages(newMessages);
    // Refresh sessions to get updated title
    loadSessions();
  };

  /**
   * Formats timestamp as relative time string
   *
   * Converts ISO timestamp to human-readable relative time (e.g., "5m ago", "2h ago", "3d ago").
   * Used for session list timestamp display.
   *
   * @internal
   * @param timestamp - ISO timestamp string
   * @returns Formatted relative time string
   */
  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Clear SDK event data when switching sessions
  useEffect(() => {
    if (activeSession) {
      clearEventData();
    }
  }, [activeSession?.documentId]);

  // Create assistant-ui runtime using our custom hook
  const runtime = useAssistantRuntime({
    sessionId: activeSession?.documentId || null,
    initialMessages: messages,
    onMessagesUpdate: handleMessagesUpdate,
    permissionMode,
    agentId: selectedAgentId,
    skillIds: selectedSkillIds,
    onToolUseUpdate: setToolUses,
    onSystemMessage: (msg) => {
      setSystemMessages((prev) => [...prev, msg]);
    },
  });

  // Auto-scroll to bottom when messages change (streaming updates)
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500">Loading chat sessions...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left Sidebar - Chat Sessions */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 bg-gradient-to-b from-gray-800 to-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Chats</h2>
            <Button onClick={handleNewChat} variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-700">
              <PlusIcon className="w-4 h-4 mr-1" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <MessageSquareIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="font-medium">No chat sessions yet</p>
              <p className="text-sm mt-1">Click "New Chat" to start</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {sessions.map(session => (
                <div
                  key={session.documentId}
                  className={`p-4 cursor-pointer hover:bg-gray-700 transition-all ${
                    activeSession?.documentId === session.documentId
                      ? 'bg-gray-700 border-l-4 border-blue-500'
                      : 'border-l-4 border-transparent'
                  }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate text-sm">
                        {session.title}
                      </h3>
                      {session.skills && session.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {session.skills.slice(0, 2).map(skill => (
                            <span
                              key={skill.documentId}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-gray-200"
                            >
                              {skill.name}
                            </span>
                          ))}
                          {session.skills.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                              +{session.skills.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-1.5 text-xs text-gray-400">
                        {formatTimeAgo(session.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveSession(session.documentId);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded transition-colors"
                        title="Archive"
                      >
                        <ArchiveIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.documentId);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {activeSession && runtime ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-white">
                    {activeSession.title}
                  </h2>

                  {/* Clickable Agent/Skills Selection Area */}
                  <div
                    className="mt-2 p-3 bg-gray-750 rounded-lg border border-gray-600 hover:border-blue-500 cursor-pointer transition-all hover:bg-gray-700"
                    onClick={() => setShowAgentSkillModal(true)}
                  >
                    {/* Agent Display */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-400">Agent:</span>
                      <span className="text-sm text-gray-200 font-medium">
                        {selectedAgentId
                          ? availableAgents.find(a => a.documentId === selectedAgentId)?.name || 'Unknown'
                          : activeSession.agent?.name || 'Session Default'
                        }
                      </span>
                      {(selectedAgentId
                        ? availableAgents.find(a => a.documentId === selectedAgentId)?.modelConfig?.model
                        : activeSession.agent?.modelConfig?.model
                      ) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-700/50">
                          {selectedAgentId
                            ? availableAgents.find(a => a.documentId === selectedAgentId)?.modelConfig?.model
                            : activeSession.agent?.modelConfig?.model
                          }
                        </span>
                      )}
                    </div>

                    {/* Skills Display */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-gray-400 whitespace-nowrap mt-1">Skills:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSkillIds.length > 0 ? (
                          selectedSkillIds.map(skillId => {
                            const skill = availableSkills.find(s => s.documentId === skillId);
                            return skill ? (
                              <span
                                key={skillId}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white border border-blue-500"
                              >
                                {skill.displayName || skill.name}
                              </span>
                            ) : null;
                          })
                        ) : activeSession.skills && activeSession.skills.length > 0 ? (
                          activeSession.skills.map(skill => (
                            <span
                              key={skill.documentId}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-gray-200 border border-gray-500"
                            >
                              {skill.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">No skills selected</span>
                        )}
                      </div>
                    </div>

                    {/* Click hint */}
                    <div className="mt-2 text-xs text-gray-500 text-right">
                      Click to change agent/skills for this conversation
                    </div>
                  </div>
                </div>
                {/* Mode Controls */}
                <div className="flex items-center gap-3 ml-4">
                  {/* Permission/Mode Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-400">Mode:</label>
                    <select
                      value={permissionMode}
                      onChange={(e) => setPermissionMode(e.target.value as 'default' | 'bypass' | 'auto' | 'plan')}
                      className="text-xs bg-gray-700 border-gray-600 text-white rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="default">Default</option>
                      <option value="bypass">Bypass</option>
                      <option value="auto">Auto</option>
                      <option value="plan">Plan</option>
                    </select>
                  </div>
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2 border-l border-gray-600 pl-3">
                    <label className="text-xs font-medium text-gray-400">View:</label>
                    <select
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value as 'simple' | 'detailed')}
                      className="text-xs bg-gray-700 border-gray-600 text-white rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="simple">Simple</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area - Using assistant-ui with modern design */}
            <div className="flex-1 overflow-hidden">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">Loading messages...</div>
                </div>
              ) : (
                <AssistantRuntimeProvider runtime={runtime}>
                  <ThreadPrimitive.Root className="h-full flex flex-col">
                    <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-6">
                      {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center text-gray-400">
                            <MessageSquareIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Start the conversation</p>
                            <p className="text-sm mt-1">Type a message below to begin</p>
                          </div>
                        </div>
                      )}
                      <ThreadPrimitive.Messages
                        components={{
                          UserMessage,
                          AssistantMessage,
                          SystemMessage,
                        }}
                      />
                      {/* Auto-scroll anchor */}
                      <div ref={messagesEndRef} />
                    </ThreadPrimitive.Viewport>

                    {/* Composer Area */}
                    <ComposerArea />
                  </ThreadPrimitive.Root>
                </AssistantRuntimeProvider>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquareIcon className="w-20 h-20 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">
                No Chat Selected
              </h3>
              <p className="text-gray-400 mb-6 max-w-sm">
                Select a chat from the sidebar or create a new one to start chatting
              </p>
              <Button onClick={handleNewChat} variant="primary" className="bg-blue-600 hover:bg-blue-700">
                <PlusIcon className="w-5 h-5 mr-2" />
                New Chat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewChatModal && (
        <ChatSessionModal
          isOpen={showNewChatModal}
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={handleChatCreated}
        />
      )}

      {/* Agent/Skills Selection Modal */}
      {showAgentSkillModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-gray-700">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
              <h2 className="text-xl font-semibold text-white">Select Agent & Skills</h2>
              <p className="text-sm text-gray-400 mt-1">
                Choose an agent and skills for this conversation (overrides session defaults)
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent
                </label>
                <select
                  value={selectedAgentId || ''}
                  onChange={(e) => setSelectedAgentId(e.target.value || undefined)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Use Session Default</option>
                  {availableAgents.map(agent => (
                    <option key={agent.documentId} value={agent.documentId}>
                      {agent.name}
                      {agent.modelConfig?.model && ` [${agent.modelConfig.model}]`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Skills
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-gray-900 rounded-lg border border-gray-700">
                  {availableSkills.map(skill => (
                    <label
                      key={skill.documentId}
                      className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                        selectedSkillIds.includes(skill.documentId)
                          ? 'bg-blue-600 text-white border-2 border-blue-500'
                          : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkillIds.includes(skill.documentId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSkillIds([...selectedSkillIds, skill.documentId]);
                          } else {
                            setSelectedSkillIds(selectedSkillIds.filter(id => id !== skill.documentId));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">
                        {skill.displayName || skill.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex justify-end gap-3">
              <Button
                onClick={() => setShowAgentSkillModal(false)}
                variant="secondary"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ChatPageContent.displayName = 'ChatPageContent';

/**
 * ChatPage - Wrapper component with ChatDisplayProvider
 *
 * Wraps ChatPageContent with ChatDisplayProvider to provide SDK event context
 * (view mode, tool uses, system messages) to all child components.
 *
 * @example
 * // Basic usage in ManagerApp
 * import ChatPage from './components/ChatPage';
 *
 * function ManagerApp() {
 *   return (
 *     <Layout>
 *       <ChatPage />
 *     </Layout>
 *   );
 * }
 */
const ChatPage: React.FC = () => {
  return (
    <ChatDisplayProvider>
      <ChatPageContent />
    </ChatDisplayProvider>
  );
};

ChatPage.displayName = 'ChatPage';

export default ChatPage;
