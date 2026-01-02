/**
 * ChatSessionModal Component
 *
 * A comprehensive modal dialog for creating new chat sessions with skills and agents.
 * Provides a form interface for configuring chat title, selecting multiple skills,
 * and optionally binding an agent. Features real-time search filtering, loading states,
 * and validation for skill selection.
 *
 * ## Features
 * - Optional title input with default fallback ("New Chat")
 * - Multi-select skill picker with checkbox interface
 * - Real-time search/filter for skills (searches name, displayName, description)
 * - Optional agent selection with model display
 * - Loading states for skills and agents
 * - Validation prompt when creating session without skills
 * - Cookie-based directory integration
 * - Modal behavior using Dialog component (escape to close, click outside to close)
 *
 * ## Session Management
 * The component manages chat session creation through a multi-step workflow:
 *
 * **Initialization** (useEffect on mount):
 * 1. Loads available skills from API via `getSkills(directory)`
 * 2. Loads available agents from API via `getAgents(directory)`
 * 3. Displays loading states while fetching data
 * 4. Handles errors gracefully (shows alert for skills, silent for agents)
 *
 * **User Interaction**:
 * - User enters optional title (defaults to "New Chat" if empty)
 * - User searches and selects skills via checkbox list
 * - User optionally selects an agent from dropdown
 * - User clicks "Create Chat" button
 *
 * **Session Creation** (`handleCreate`):
 * 1. Validates skill selection (prompts confirmation if none selected)
 * 2. Calls `createChatSession(title, skillIds, directory, permissionMode, agentId)`
 * 3. Invokes `onChatCreated(session)` callback with created session
 * 4. Parent component typically closes modal and navigates to new chat
 *
 * **State Management**:
 * - `title`: Chat session title (string, optional)
 * - `selectedSkillIds`: Array of selected skill IDs (string[])
 * - `selectedAgentId`: Selected agent ID or null (string | null)
 * - `availableSkills`: All skills fetched from API (Skill[])
 * - `availableAgents`: All agents fetched from API (Agent[])
 * - `loading`: Creation in progress (boolean)
 * - `skillsLoading`, `agentsLoading`: Data fetching states (boolean)
 * - `searchTerm`: Skill filter text (string)
 *
 * ## Modal Behavior
 * The component uses the Dialog component for modal presentation:
 *
 * **Opening/Closing**:
 * - Controlled via `isOpen` prop (boolean)
 * - Close triggered by `onClose` callback
 * - Close methods: Cancel button, Escape key, click outside dialog
 * - Modal prevents interaction with content behind it
 *
 * **Layout**:
 * - Max width: 4xl (56rem / 896px)
 * - Max height: 90vh with scrollable content area
 * - Dark theme: gray-800 background, gray-700 borders
 * - Flexbox layout with sticky header and footer
 * - Scrollable middle section (flex-1 overflow-y-auto)
 *
 * **Dialog Structure**:
 * - Header: "New Chat Session" title (sticky top)
 * - Content: Title input, Skills section, Agent section (scrollable)
 * - Footer: Cancel and Create Chat buttons (sticky bottom)
 *
 * ## Skill Selection Display
 * Skills are displayed in a searchable, scrollable list with rich metadata:
 *
 * **Search/Filter** (`filteredSkills`):
 * - Real-time filtering as user types in search input
 * - Searches across: skill.name, skill.displayName, skill.description
 * - Case-insensitive matching using `.toLowerCase()`
 * - Updates immediately on search term change
 *
 * **List Display**:
 * - Scrollable container (max-height: 200px)
 * - Dark theme: gray-900 background, gray-700 dividers
 * - Loading state: "Loading skills..." centered message
 * - Empty state: "No skills found" when filter returns no results
 *
 * **Skill Items** (for each skill):
 * - Checkbox for multi-select (checked state from selectedSkillIds array)
 * - Display name or fallback to name
 * - Category badge (blue pill) if skill.category exists
 * - Description text (gray, truncated to 1 line)
 * - Hover effect: gray-800 background
 * - Entire label is clickable for better UX
 *
 * **Selection Feedback**:
 * - Selected count displayed below list: "✓ N skill(s) selected"
 * - Only shown when at least one skill is selected
 * - Blue text color (text-blue-400) for visual prominence
 *
 * **Agent Selection**:
 * - Dropdown select with "None (Default Claude)" as first option
 * - Agent list shows name and model (if available): "agent-name [model]"
 * - Description shown below select when agent is chosen
 * - Loading state with disabled select during fetch
 *
 * ## Directory Integration
 * The component retrieves the current working directory from browser cookies:
 * - Cookie name: `selectedDirectory`
 * - Read via `getDirectory()` helper function
 * - Passed to all API calls (getSkills, getAgents, createChatSession)
 * - Ensures session is created in the correct project context
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with dark theme:
 * - **Dialog**: max-w-4xl, max-h-90vh, gray-800 background, gray-700 borders
 * - **Inputs**: gray-700 background, gray-600 border, blue-500 focus ring
 * - **Skill list**: gray-900 background, gray-700 dividers and borders
 * - **Skill items**: gray-800 hover, white text for names, gray-400 for descriptions
 * - **Checkboxes**: blue-600 checked color, gray-700 background
 * - **Category badges**: blue-600 background, white text, rounded-full
 * - **Buttons**: Blue primary (Create), Gray secondary (Cancel)
 * - **Loading states**: Disabled opacity-50, cursor-not-allowed
 *
 * @example
 * // Basic usage - creating a new chat session
 * import ChatSessionModal from './ChatSessionModal';
 *
 * function ChatPage() {
 *   const [showModal, setShowModal] = useState(false);
 *
 *   const handleChatCreated = (session) => {
 *     console.log('New chat created:', session);
 *     setShowModal(false);
 *     // Navigate to the new chat or update chat list
 *   };
 *
 *   return (
 *     <>
 *       <Button onClick={() => setShowModal(true)}>New Chat</Button>
 *       <ChatSessionModal
 *         isOpen={showModal}
 *         onClose={() => setShowModal(false)}
 *         onChatCreated={handleChatCreated}
 *       />
 *     </>
 *   );
 * }
 *
 * @example
 * // With navigation to new chat after creation
 * import { useNavigate } from 'react-router-dom';
 *
 * function ChatInterface() {
 *   const [isModalOpen, setIsModalOpen] = useState(false);
 *   const navigate = useNavigate();
 *
 *   const handleNewChat = (session) => {
 *     setIsModalOpen(false);
 *     // Navigate to new chat session
 *     navigate(`/chat/${session.id}`);
 *   };
 *
 *   return (
 *     <ChatSessionModal
 *       isOpen={isModalOpen}
 *       onClose={() => setIsModalOpen(false)}
 *       onChatCreated={handleNewChat}
 *     />
 *   );
 * }
 *
 * @example
 * // Updating chat list after creation
 * function ChatDashboard() {
 *   const [sessions, setSessions] = useState([]);
 *   const [showCreateModal, setShowCreateModal] = useState(false);
 *
 *   const handleChatCreated = (newSession) => {
 *     // Add new session to list
 *     setSessions(prev => [newSession, ...prev]);
 *     setShowCreateModal(false);
 *   };
 *
 *   return (
 *     <>
 *       <div>
 *         {sessions.map(session => (
 *           <div key={session.id}>{session.title}</div>
 *         ))}
 *       </div>
 *       <ChatSessionModal
 *         isOpen={showCreateModal}
 *         onClose={() => setShowCreateModal(false)}
 *         onChatCreated={handleChatCreated}
 *       />
 *     </>
 *   );
 * }
 *
 * @example
 * // Understanding skill selection workflow
 * // 1. Modal opens with all skills loaded
 * // 2. User searches: "data" -> filters to data-related skills
 * // 3. User checks: "data-analysis" and "data-visualization"
 * // 4. Selected count shows: "✓ 2 skills selected"
 * // 5. User clicks Create Chat
 * // 6. Chat session created with those 2 skills bound
 * // 7. onChatCreated callback fired with new session
 */
import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import * as chatApi from '../services/chat-api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XIcon } from './ui/Icons';

/**
 * Props for the ChatSessionModal component
 *
 * @property {boolean} isOpen - Controls modal visibility (true = shown, false = hidden)
 * @property {() => void} onClose - Callback invoked when modal should close (Cancel button, Escape key, click outside)
 * @property {(session: ChatSession) => void} onChatCreated - Callback invoked when chat session is successfully created with the new session object
 */
interface ChatSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (session: chatApi.ChatSession) => void;
}

const ChatSessionModal: React.FC<ChatSessionModalProps> = ({ isOpen, onClose, onChatCreated }) => {
  const [title, setTitle] = useState('');
  const [availableSkills, setAvailableSkills] = useState<api.Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [availableAgents, setAvailableAgents] = useState<api.Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Retrieves the current working directory from browser cookies.
   *
   * Parses the `selectedDirectory` cookie to determine which directory context
   * the user is currently working in. This directory is passed to all API calls
   * to ensure chat sessions, skills, and agents are scoped to the correct project.
   *
   * @internal
   * @returns {string | undefined} The decoded directory path, or undefined if cookie not found
   *
   * @example
   * const directory = getDirectory();
   * // Returns: "/Users/username/projects/my-app" or undefined
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

  useEffect(() => {
    loadSkills();
    loadAgents();
  }, []);

  /**
   * Loads available skills from the API.
   *
   * Fetches all skills for the current directory and updates the `availableSkills` state.
   * Sets loading state during fetch and handles errors by displaying an alert to the user.
   * This function is called automatically on component mount via useEffect.
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   *
   * **Workflow**:
   * 1. Sets `skillsLoading` to true
   * 2. Retrieves current directory from cookies
   * 3. Calls `getSkills(directory)` API
   * 4. Updates `availableSkills` state with fetched data
   * 5. Shows alert on error
   * 6. Sets `skillsLoading` to false in finally block
   */
  const loadSkills = async () => {
    try {
      setSkillsLoading(true);
      const directory = getDirectory();
      const skills = await api.getSkills(directory);
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Failed to load skills:', error);
      alert('Failed to load skills');
    } finally {
      setSkillsLoading(false);
    }
  };

  /**
   * Loads available agents from the API.
   *
   * Fetches all agents for the current directory and updates the `availableAgents` state.
   * Sets loading state during fetch and handles errors silently (since agents are optional).
   * This function is called automatically on component mount via useEffect.
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   *
   * **Workflow**:
   * 1. Sets `agentsLoading` to true
   * 2. Retrieves current directory from cookies
   * 3. Calls `getAgents(directory)` API
   * 4. Updates `availableAgents` state with fetched data
   * 5. Logs error to console but doesn't show alert (agents are optional)
   * 6. Sets `agentsLoading` to false in finally block
   */
  const loadAgents = async () => {
    try {
      setAgentsLoading(true);
      const directory = getDirectory();
      const agents = await api.getAgents(directory);
      setAvailableAgents(agents);
    } catch (error) {
      console.error('Failed to load agents:', error);
      // Don't show alert - agents are optional
    } finally {
      setAgentsLoading(false);
    }
  };

  /**
   * Toggles the selection state of a skill.
   *
   * Adds the skill ID to `selectedSkillIds` if not present, or removes it if already selected.
   * This implements the checkbox toggle behavior for multi-select skill picker.
   *
   * @internal
   * @param {string} skillId - The unique identifier of the skill to toggle
   *
   * **Behavior**:
   * - If `skillId` is in `selectedSkillIds`: removes it (unchecks checkbox)
   * - If `skillId` is not in `selectedSkillIds`: adds it (checks checkbox)
   * - State update is immutable (creates new array, never mutates)
   *
   * @example
   * // User clicks checkbox for skill "skill-123"
   * handleToggleSkill('skill-123');
   * // If was selected: selectedSkillIds = [...others] (removed)
   * // If wasn't selected: selectedSkillIds = [...others, 'skill-123'] (added)
   */
  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  /**
   * Creates a new chat session with the configured settings.
   *
   * Validates the form (prompts user if no skills selected), calls the createChatSession API,
   * and invokes the `onChatCreated` callback with the new session. Sets loading state during
   * creation and handles errors with user feedback.
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   *
   * **Validation**:
   * - Checks if `selectedSkillIds` is empty
   * - If empty, shows browser confirm dialog: "No skills selected. Continue anyway?"
   * - User can cancel to go back and select skills, or continue without skills
   *
   * **Creation Workflow**:
   * 1. Sets `loading` to true (disables Create button)
   * 2. Retrieves current directory from cookies
   * 3. Applies default title "New Chat" if user didn't enter a title
   * 4. Calls `createChatSession(title, skillIds, directory, permissionMode, agentId, systemPrompt)`
   * 5. Invokes `onChatCreated(session)` callback with created session object
   * 6. Parent component typically closes modal and navigates to new chat
   * 7. Shows alert on error
   * 8. Sets `loading` to false in finally block
   *
   * **Parameters passed to API**:
   * - `title`: User-entered title or "New Chat" default
   * - `selectedSkillIds`: Array of skill IDs to bind to session
   * - `directory`: Current working directory from cookies
   * - `permissionMode`: Always 'default' (hardcoded)
   * - `selectedAgentId`: Agent ID if selected, undefined otherwise
   * - `systemPrompt`: Always undefined (not yet implemented in UI)
   */
  const handleCreate = async () => {
    if (selectedSkillIds.length === 0) {
      if (!confirm('No skills selected. Continue anyway?')) {
        return;
      }
    }

    try {
      setLoading(true);
      const directory = getDirectory();
      // Use "New Chat" as default title if empty
      const finalTitle = title.trim() || 'New Chat';
      const session = await chatApi.createChatSession(
        finalTitle,
        selectedSkillIds,
        directory,
        'default', // Default permission mode
        selectedAgentId || undefined, // Agent ID (optional)
        undefined // Custom system prompt (not implemented in UI yet)
      );
      onChatCreated(session);
    } catch (error) {
      console.error('Failed to create chat session:', error);
      alert('Failed to create chat session');
    } finally {
      setLoading(false);
    }
  };

  // Filter skills based on search term
  const filteredSkills = availableSkills.filter(skill =>
    skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-gray-800 border-gray-700 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-bold">New Chat Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">
            Chat Title <span className="text-xs text-gray-400 font-normal">(optional - defaults to "New Chat")</span>
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave empty for auto-generated title..."
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 text-base"
          />
        </div>

        {/* Skills Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">
            Select Skills <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>

          {/* Search Input */}
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search skills..."
            className="mb-2 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 text-base"
          />

          {/* Skills List */}
          <div className="border border-gray-700 rounded-lg max-h-[200px] overflow-y-auto bg-gray-900">
            {skillsLoading ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                Loading skills...
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No skills found
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {filteredSkills.map(skill => (
                  <label
                    key={skill.id}
                    className="flex items-start gap-2.5 p-2.5 hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.includes(skill.id)}
                      onChange={() => handleToggleSkill(skill.id)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-white truncate">
                          {skill.displayName || skill.name}
                        </p>
                        {skill.category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white flex-shrink-0">
                            {skill.category}
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-xs text-gray-400 line-clamp-1 break-words">
                          {skill.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedSkillIds.length > 0 && (
            <div className="mt-2 text-sm font-medium text-blue-400">
              ✓ {selectedSkillIds.length} skill{selectedSkillIds.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Agent Selection */}
        <div>
          <label htmlFor="agent-select" className="block text-sm font-semibold text-gray-200 mb-2">
            Select Agent <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>

          <select
            id="agent-select"
            value={selectedAgentId || ''}
            onChange={(e) => setSelectedAgentId(e.target.value || null)}
            disabled={agentsLoading}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            <option value="">None (Default Claude)</option>
            {availableAgents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name}{agent.modelConfig?.model ? ` [${agent.modelConfig.model}]` : ''}
              </option>
            ))}
          </select>

          {selectedAgentId && (
            <div className="mt-2 text-xs text-gray-400">
              {availableAgents.find(a => a.id === selectedAgentId)?.description}
            </div>
          )}
        </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700 mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="secondary" className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600 text-base px-5 py-2.5">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="primary"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 text-base px-5 py-2.5"
          >
            {loading ? 'Creating...' : 'Create Chat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

ChatSessionModal.displayName = 'ChatSessionModal';

export default ChatSessionModal;
