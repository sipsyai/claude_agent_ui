import React, { useState, useEffect } from 'react';
import type { Skill } from '../../../types/agent.types';
import * as api from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ProgressBar } from './ui/ProgressBar';
import SkillCreationModal from './SkillCreationModal';
import SkillDetailsModal from './SkillDetailsModal';
import SkillCreatorChatPanel from './SkillCreatorChatPanel';
import SkillTrainingChatPanel from './SkillTrainingChatPanel';
import { CheckCircleIcon, SearchIcon, TrashIcon, XCircleIcon, ServerIcon, SparklesIcon } from './ui/Icons';

/**
 * SkillsPage - Comprehensive skill management interface
 *
 * Page-level component for managing skills with listing, creation, editing, training,
 * search/filter capabilities, and bulk operations. Provides both form-based and
 * chat-based creation workflows.
 *
 * ## Features
 *
 * - Skill listing with responsive grid layout (1/2/3 columns)
 * - Dual creation modes (form-based and AI-powered chat-based)
 * - Search and filter capabilities (name, description, usage patterns)
 * - Bulk operations (multi-select and bulk delete)
 * - Skill training workflow with interactive chat panel
 * - Auto-refresh with configurable interval (30 seconds)
 * - Usage analytics and experience score tracking
 *
 * ## Skill Listing
 *
 * Skills are displayed in a responsive grid with rich information cards showing:
 *
 * - **Header**: Skill name with emoji icon, usage count badge (if > 0)
 * - **Description**: Two-line truncated description with line-clamp-2
 * - **Experience Progress**: Visual progress bar showing skill experience score (0-100)
 * - **Quick Stats**:
 *   - Usage Status: CheckCircleIcon (green) if used, XCircleIcon (gray) if unused
 *   - Tools Count: Number of allowed tools configured for the skill
 * - **Agent Usage**: First 3 agents using this skill with overflow indicator (+N more)
 * - **Allowed Tools**: First 4 tools with overflow indicator (+N)
 * - **MCP Servers**: First 2 MCP server configurations with nested tool display
 * - **File Info**: Skill markdown filename (e.g., "skill-name.md")
 * - **Action Buttons**: View Details and Edit buttons in card footer
 * - **Click to Train**: Entire card is clickable to open training panel
 *
 * ## Creation Workflow
 *
 * Two creation modes are available:
 *
 * 1. **Form-Based Creation**: "Create New Skill" button opens SkillCreationModal
 *    - Manual configuration with form fields
 *    - Detailed tool configuration (allowed/disallowed tabs)
 *    - MCP server tool selection
 *    - Input fields builder with 7 field types
 *    - Advanced model configuration override
 *    - Additional files upload support
 *
 * 2. **Chat-Based Creation**: "Create with Claude Manager" button opens SkillCreatorChatPanel
 *    - AI-powered interactive skill creation
 *    - Natural language conversation workflow
 *    - SSE streaming integration
 *    - Automatic skill file generation and saving
 *    - Success/error state handling with visual feedback
 *
 * ## Search and Filtering
 *
 * Advanced search and filtering capabilities:
 *
 * - **Search**: Real-time search by skill name or description (case-insensitive, partial matching)
 *   - SearchIcon displayed in input field (left side)
 *   - Filters skills as user types
 *
 * - **Filter Modes**: Four filter options with dynamic counts:
 *   - `all`: Show all skills (default)
 *   - `used`: Skills used in at least one agent (executionCount > 0)
 *   - `unused`: Skills not used in any agent (executionCount === 0)
 *   - `high-usage`: Skills used in 3+ agents (executionCount >= 3)
 *   - Each option shows count in parentheses (e.g., "Used in Agents (5)")
 *
 * - **Results Count**: "Showing X of Y skills" display in filter bar
 *
 * ## Bulk Operations
 *
 * Multi-select functionality for bulk actions:
 *
 * - **Checkbox Selection**: Each filtered skill can be selected via checkbox
 * - **Select All**: Checkbox with indeterminate state support
 *   - Unchecked: No skills selected
 *   - Indeterminate: Some skills selected (someSelected state)
 *   - Checked: All filtered skills selected (allSelected state)
 *   - Toggle behavior: Select All ↔ Deselect All
 * - **Bulk Actions Bar**: Appears when skills are selected (blue background)
 *   - Shows selection count: "N skill(s) selected"
 *   - Clear Selection button (secondary variant)
 *   - Delete Selected button (red destructive variant)
 * - **Bulk Delete Workflow**:
 *   1. Select skills via checkboxes
 *   2. Click "Delete Selected" button
 *   3. Confirmation dialog appears
 *   4. Skills deleted via DELETE API calls (sequential Promise.all)
 *   5. Success: Refresh list and clear selection
 *   6. Error: Alert with error message, check console for details
 *
 * ## Skill Training
 *
 * Interactive skill training workflow:
 *
 * - **Training Trigger**: Click on any skill card to open SkillTrainingChatPanel
 * - **Training Panel**: Slide-in panel with chat interface
 *   - Auto-start training conversation
 *   - Status tracking (idle, analyzing, training, evaluating, updating, completed, error)
 *   - Score progression display (before → after with visual indicators)
 *   - Message flow with user and assistant messages
 *   - Progress bar showing training status
 * - **Training Completion**:
 *   - Refresh skills list to show updated experience scores
 *   - Invoke onRefresh callback for parent component
 *   - Close panel or retry on error
 *
 * ## Auto-Refresh
 *
 * Automatic data refresh capability:
 *
 * - **Toggle**: Checkbox to enable/disable auto-refresh (enabled by default)
 * - **Interval**: 30 seconds (30000ms)
 * - **Mechanism**: setInterval with cleanup on unmount or toggle off
 * - **API Call**: loadSkillsWithUsage() fetches fresh skill data with usage analytics
 * - **Use Case**: Keep skill list and usage statistics up-to-date without manual refresh
 *
 * ## Directory Integration
 *
 * Skills are filtered and loaded based on directory context:
 *
 * - **Directory Prop**: Optional directory path for filtering skills
 * - **API Integration**: getSkills(directory, true) with includeUsage flag
 * - **Auto-Reload**: useEffect dependency on directory triggers reload when directory changes
 * - **Scoped Operations**: All create/edit/delete/train operations use directory context
 *
 * ## Styling Behavior
 *
 * Tailwind CSS classes and responsive design:
 *
 * - **Animation**: animate-fade-in on page mount for smooth entry
 * - **Header**: Centered title with absolute-positioned action buttons (right-8 top-8)
 * - **Create Buttons**:
 *   - "Create New Skill": secondary variant, standard styling
 *   - "Create with Claude Manager": gradient background (purple-600 to blue-600), SparklesIcon
 * - **Grid Layout**: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 (responsive columns)
 * - **Skill Cards**:
 *   - hover:border-primary/80 transition-colors (300ms duration)
 *   - cursor-pointer for click-to-train interaction
 *   - group class for coordinated hover effects
 * - **Color-Coding**:
 *   - Used skills: Green badges (bg-green-50, text-green-700, border-green-200)
 *   - Unused skills: Gray icon (text-gray-600)
 *   - Tools: Blue badges (bg-blue-50, text-blue-700, border-blue-200)
 *   - MCP Servers: Indigo badges (bg-indigo-50, text-indigo-700, border-indigo-200)
 *   - Bulk Actions: Blue background (bg-blue-50, border-blue-200)
 *   - Delete Button: Red background (bg-red-600, hover:bg-red-700)
 *
 * @example
 * // Basic usage in ManagerApp dashboard phase
 * import ManagerApp from './ManagerApp';
 *
 * function App() {
 *   return <ManagerApp />;
 * }
 *
 * // Inside ManagerApp, when activeView === 'Skills':
 * <SkillsPage
 *   skills={skills}
 *   onRefresh={handleRefreshSkills}
 *   directory={directory}
 * />
 *
 * @example
 * // Skill creation workflow (form-based)
 * // 1. User clicks "Create New Skill" button
 * // 2. SkillCreationModal opens with empty form
 * // 3. User fills in:
 * //    - Core Configuration (name, description, category, version, license, isPublic)
 * //    - Tool Configuration (allowed/disallowed tools tabs)
 * //    - MCP Server Tools (hierarchical multi-select)
 * //    - Input Fields (dynamic field builder with 7 types)
 * //    - Advanced Settings (model override, temperature, maxTokens)
 * //    - Additional Files (upload up to 8 file types)
 * //    - Skill Instructions (markdown textarea)
 * // 4. Form validation runs (required fields, JSON schema, patterns)
 * // 5. Submit creates skill via POST /api/manager/skills
 * // 6. Success: Green banner, auto-close after 1.5s, refresh list
 * // 7. Error: Red banner with error message
 *
 * @example
 * // Skill creation workflow (chat-based)
 * // 1. User clicks "Create with Claude Manager" button (gradient purple-to-blue)
 * // 2. SkillCreatorChatPanel slides in from right
 * // 3. Auto-start conversation with initial prompt
 * // 4. User describes skill requirements in natural language
 * // 5. Assistant asks clarifying questions (tools, behavior, inputs)
 * // 6. SSE streaming displays real-time messages
 * // 7. Assistant creates skill file using Write tool
 * // 8. useSkillCreator detects creation (tool use parsing)
 * // 9. Panel state changes: chat → creating → success
 * // 10. Success message: "Skill created successfully!"
 * // 11. Skills list refreshes to show new skill
 * // 12. User can close panel or create another skill
 *
 * @example
 * // Search and filter workflow
 * // 1. User types "api" in search box
 * // 2. filteredSkills filters to skills matching "api" in name or description
 * // 3. Results count updates: "Showing 3 of 15 skills"
 * // 4. User changes filter from "All Skills (15)" to "Used in Agents (8)"
 * // 5. filteredSkills further filters to skills with executionCount > 0
 * // 6. Results count updates: "Showing 2 of 15 skills"
 * // 7. User clears search box
 * // 8. Results count updates: "Showing 8 of 15 skills"
 * // 9. User changes filter to "High Usage (3+) (5)"
 * // 10. Only skills with executionCount >= 3 are shown
 *
 * @example
 * // Bulk delete workflow
 * // 1. User clicks "Select All" checkbox
 * // 2. All filtered skills are selected (checkboxes checked)
 * // 3. selectedSkillIds Set populated with all filtered skill IDs
 * // 4. Bulk Actions Bar appears: "8 skill(s) selected"
 * // 5. User clicks "Delete Selected" button (red)
 * // 6. Confirmation dialog: "Are you sure you want to delete 8 skill(s)?"
 * // 7. User confirms
 * // 8. isDeleting state set to true, button shows "Deleting..."
 * // 9. Sequential DELETE API calls via Promise.all
 * // 10. Success: selectedSkillIds cleared, list refreshed, banner disappears
 * // 11. Error: Alert shown, console logs errors, isDeleting set to false
 */

/**
 * Props for SkillsPage component
 *
 * @property {Skill[]} skills - Array of Skill objects to display (initial skills from parent)
 * @property {() => void} [onRefresh] - Optional callback invoked after skill creation, edit, delete, or training completion
 * @property {string} [directory] - Optional directory path for filtering skills (e.g., "/path/to/project")
 */
interface SkillsPageProps {
  skills: Skill[];
  onRefresh?: () => void;
  directory?: string;
}

/**
 * Filter modes for skill listing
 *
 * @typedef {'all' | 'used' | 'unused' | 'high-usage'} FilterMode
 *
 * - `all`: Show all skills regardless of usage
 * - `used`: Show only skills used in at least one agent (executionCount > 0)
 * - `unused`: Show only skills not used in any agent (executionCount === 0)
 * - `high-usage`: Show only skills used in 3+ agents (executionCount >= 3)
 */
type FilterMode = 'all' | 'used' | 'unused' | 'high-usage';

const SkillsPage: React.FC<SkillsPageProps> = ({ skills: initialSkills, onRefresh, directory }) => {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [showCreatorChat, setShowCreatorChat] = useState(false);
  const [trainingSkill, setTrainingSkill] = useState<Skill | null>(null);
  const [showTrainingPanel, setShowTrainingPanel] = useState(false);

  /**
   * Load skills with usage analytics
   *
   * Fetches skills from the API with includeUsage flag to get execution counts
   * and experience scores. Updates local skills state with the fetched data.
   *
   * @internal
   */
  const loadSkillsWithUsage = async () => {
    try {
      const skillsWithUsage = await api.getSkills(directory, true);
      setSkills(skillsWithUsage);
    } catch (error) {
      console.error('Failed to load skills with usage:', error);
    }
  };

  // Initial load and when initialSkills change
  useEffect(() => {
    loadSkillsWithUsage();
  }, [initialSkills, directory]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      loadSkillsWithUsage();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, directory]);

  /**
   * Handle skill creation completion
   *
   * Callback invoked after a skill is successfully created (via form or chat).
   * Refreshes the skills list to show the new skill and invokes parent onRefresh callback.
   *
   * @internal
   */
  const handleSkillCreated = () => {
    loadSkillsWithUsage();
    if (onRefresh) {
      onRefresh();
    }
  };

  /**
   * Handle view details click
   *
   * Opens the SkillDetailsModal for the selected skill. Triggered by clicking
   * "View Details" button in skill card footer.
   *
   * @internal
   * @param {Skill} skill - Skill object to view details for
   */
  const handleViewDetails = (skill: Skill) => {
    setSelectedSkill(skill);
  };

  /**
   * Handle edit click
   *
   * Opens the SkillCreationModal in edit mode with pre-populated skill data.
   * Triggered by clicking "Edit" button in skill card footer.
   *
   * @internal
   * @param {Skill} skill - Skill object to edit
   */
  const handleEditClick = (skill: Skill) => {
    setEditingSkill(skill);
    setIsCreationModalOpen(true);
  };

  /**
   * Handle skill card click
   *
   * Opens the SkillTrainingChatPanel for the selected skill. Triggered by clicking
   * anywhere on the skill card (except action buttons which have stopPropagation).
   *
   * @internal
   * @param {Skill} skill - Skill object to train
   */
  const handleSkillClick = (skill: Skill) => {
    setTrainingSkill(skill);
    setShowTrainingPanel(true);
  };

  /**
   * Handle training completion
   *
   * Callback invoked after skill training completes successfully. Refreshes the
   * skills list to show updated experience scores and invokes parent onRefresh callback.
   *
   * @internal
   */
  const handleTrainingComplete = () => {
    // Refresh skills to show updated experience scores
    loadSkillsWithUsage();
    if (onRefresh) {
      onRefresh();
    }
  };

  /**
   * Toggle individual skill selection
   *
   * Adds or removes a skill ID from the selectedSkillIds Set. Used for bulk
   * delete operations. Creates a new Set to trigger React re-render.
   *
   * @internal
   * @param {string} skillId - Skill ID to toggle selection for
   */
  const toggleSkillSelection = (skillId: string) => {
    const newSet = new Set(selectedSkillIds);
    if (newSet.has(skillId)) {
      newSet.delete(skillId);
    } else {
      newSet.add(skillId);
    }
    setSelectedSkillIds(newSet);
  };

  /**
   * Toggle select all filtered skills
   *
   * If all filtered skills are selected, deselects all. Otherwise, selects all
   * filtered skills. Note: Only operates on currently filtered skills, not all skills.
   *
   * @internal
   */
  const toggleSelectAll = () => {
    if (selectedSkillIds.size === filteredSkills.length) {
      setSelectedSkillIds(new Set());
    } else {
      setSelectedSkillIds(new Set(filteredSkills.map(s => s.id)));
    }
  };

  /**
   * Handle bulk delete operation
   *
   * Deletes all selected skills after user confirmation. Shows confirmation dialog,
   * then deletes skills sequentially via DELETE API calls. On success, clears selection
   * and refreshes the list. On error, shows alert with error message.
   *
   * Workflow:
   * 1. Check if any skills are selected (return early if none)
   * 2. Show confirmation dialog with skill count
   * 3. If confirmed, set isDeleting to true (shows "Deleting..." in button)
   * 4. Map selected skill IDs to DELETE API calls
   * 5. Execute all DELETE calls in parallel with Promise.all
   * 6. On success: Clear selectedSkillIds, refresh list, invoke onRefresh
   * 7. On error: Show alert, log errors to console, keep selection intact
   * 8. Finally: Set isDeleting to false (restore button state)
   *
   * @internal
   */
  const handleBulkDelete = async () => {
    if (selectedSkillIds.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedSkillIds.size} skill(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      // Delete skills one by one (could be optimized with a bulk endpoint)
      const deletePromises = Array.from(selectedSkillIds).map(async (skillId) => {
        try {
          const response = await fetch(`/api/manager/skills/${skillId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directory }),
          });
          if (!response.ok) {
            throw new Error(`Failed to delete ${skillId}`);
          }
        } catch (error) {
          console.error(`Error deleting skill ${skillId}:`, error);
          throw error;
        }
      });

      await Promise.all(deletePromises);
      setSelectedSkillIds(new Set());
      loadSkillsWithUsage();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      alert(`Some skills could not be deleted. Check console for details.`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and search logic
  const filteredSkills = skills.filter((skill) => {
    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        skill.name.toLowerCase().includes(term) ||
        skill.description.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Usage filter
    const usageCount = skill.analytics?.executionCount || 0;
    switch (filterMode) {
      case 'used':
        return usageCount > 0;
      case 'unused':
        return usageCount === 0;
      case 'high-usage':
        return usageCount >= 3;
      case 'all':
      default:
        return true;
    }
  });

  const allSelected = filteredSkills.length > 0 && selectedSkillIds.size === filteredSkills.length;
  const someSelected = selectedSkillIds.size > 0 && !allSelected;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Skills</h1>
          <p className="text-muted-foreground">
            Discovered {skills.length} skills in .claude/skills/
          </p>
        </div>
        <div className="absolute right-8 top-8 flex gap-2">
          <Button
            onClick={() => setIsCreationModalOpen(true)}
            variant="secondary"
          >
            Create New Skill
          </Button>
          <Button
            onClick={() => setShowCreatorChat(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <SparklesIcon className="h-4 w-4" />
            Create with Claude Manager
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search skills by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Filter:</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className="text-sm border border-border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Skills ({skills.length})</option>
              <option value="used">Used in Agents ({skills.filter(s => (s.analytics?.executionCount || 0) > 0).length})</option>
              <option value="unused">Not Used ({skills.filter(s => (s.analytics?.executionCount || 0) === 0).length})</option>
              <option value="high-usage">High Usage (3+) ({skills.filter(s => (s.analytics?.executionCount || 0) >= 3).length})</option>
            </select>
          </div>

          {/* Auto-refresh Toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-muted-foreground">Auto-refresh (30s)</span>
          </label>

          {/* Results Count */}
          <div className="ml-auto text-sm text-muted-foreground">
            Showing {filteredSkills.length} of {skills.length} skills
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedSkillIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedSkillIds.size} skill(s) selected
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelectedSkillIds(new Set())}
              >
                Clear Selection
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete Selected'}
            </Button>
          </div>
        )}

        {/* Select All */}
        {filteredSkills.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someSelected;
                  }
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded"
              />
              <span className="text-muted-foreground">
                {allSelected ? 'Deselect All' : someSelected ? 'Select All' : 'Select All'}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Modals */}
      <SkillCreationModal
        isOpen={isCreationModalOpen}
        onClose={() => {
          setIsCreationModalOpen(false);
          setEditingSkill(null);
        }}
        onSkillCreated={handleSkillCreated}
        editSkill={editingSkill || undefined}
      />

      <SkillDetailsModal
        skill={selectedSkill}
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onEdit={(skill) => {
          setSelectedSkill(null);
          handleEditClick(skill);
        }}
      />

      <SkillCreatorChatPanel
        isOpen={showCreatorChat}
        onClose={() => setShowCreatorChat(false)}
        onSkillCreated={handleSkillCreated}
        directory={directory}
      />

      <SkillTrainingChatPanel
        isOpen={showTrainingPanel}
        onClose={() => {
          setShowTrainingPanel(false);
          setTrainingSkill(null);
        }}
        skill={trainingSkill}
        directory={directory}
        onTrainingComplete={handleTrainingComplete}
      />

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSkills.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12">
            {searchTerm || filterMode !== 'all'
              ? 'No skills match your search or filter criteria'
              : 'No skills found in .claude/skills/'}
          </div>
        ) : (
          filteredSkills.map((skill) => {
            const isSelected = selectedSkillIds.has(skill.id);
            const usageCount = skill.analytics?.executionCount || 0;

            return (
              <Card
                key={skill.id}
                className="flex flex-col hover:border-primary/80 transition-colors duration-300 group cursor-pointer"
                onClick={() => handleSkillClick(skill)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 flex-1">
                      <span className="text-primary">🧩</span>
                      <span className="truncate">{skill.name}</span>
                    </CardTitle>
                    {usageCount > 0 && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium flex-shrink-0">
                        {usageCount} use{usageCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">{skill.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-grow space-y-3">
                  {/* Experience Progress */}
                  <div className="pb-3 border-b border-border">
                    <ProgressBar
                      value={skill.experienceScore || 0}
                      showLabel={true}
                      size="sm"
                    />
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-2 pb-3 border-b border-border">
                    {/* Usage Status */}
                    {usageCount > 0 ? (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-muted-foreground">{usageCount} Agent{usageCount !== 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <XCircleIcon className="h-4 w-4 text-gray-600 flex-shrink-0" />
                        <span className="text-muted-foreground">Unused</span>
                      </div>
                    )}

                    {/* Tools Count */}
                    {skill.toolConfig?.allowedTools && skill.toolConfig.allowedTools.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-4 w-4 text-blue-600 flex-shrink-0">🔧</span>
                        <span className="text-muted-foreground">{skill.toolConfig.allowedTools.length} Tool{skill.toolConfig.allowedTools.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Used in Agents */}
                  {skill.agentSelection && skill.agentSelection.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">Used In Agents</h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {skill.agentSelection.slice(0, 3).map((selection, idx) => {
                          const agentName = typeof selection.agent === 'string' ? selection.agent : selection.agent.name;
                          return (
                            <span key={idx} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">
                              {agentName}
                            </span>
                          );
                        })}
                        {skill.agentSelection.length > 3 && (
                          <span className="text-xs text-green-600 px-2 py-0.5 font-medium">
                            +{skill.agentSelection.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Allowed Tools */}
                  {skill.toolConfig?.allowedTools && skill.toolConfig.allowedTools.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="h-3.5 w-3.5 text-blue-600">🔧</span>
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">Allowed Tools</h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {skill.toolConfig.allowedTools.slice(0, 4).map((tool, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                            {tool}
                          </span>
                        ))}
                        {skill.toolConfig.allowedTools.length > 4 && (
                          <span className="text-xs text-blue-600 px-2 py-0.5">
                            +{skill.toolConfig.allowedTools.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MCP Tools */}
                  {skill.mcpConfig && skill.mcpConfig.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ServerIcon className="h-3.5 w-3.5 text-indigo-600" />
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">MCP Servers</h4>
                      </div>
                      <div className="space-y-1.5">
                        {skill.mcpConfig.slice(0, 2).map((config, idx) => {
                          const serverName = typeof config.mcpServer === 'string' ? config.mcpServer : config.mcpServer.name;
                          const toolsCount = config.selectedTools?.length || 0;
                          return (
                            <div key={idx}>
                              <div className="text-xs font-medium text-indigo-600 mb-0.5">{serverName}</div>
                              {toolsCount > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {config.selectedTools!.slice(0, 3).map((toolSel, tidx) => {
                                    const toolName = typeof toolSel.mcpTool === 'string' ? toolSel.mcpTool : toolSel.mcpTool.name;
                                    return (
                                      <span key={tidx} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                                        {toolName}
                                      </span>
                                    );
                                  })}
                                  {toolsCount > 3 && (
                                    <span className="text-xs text-indigo-600 px-2 py-0.5">
                                      +{toolsCount - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {skill.mcpConfig.length > 2 && (
                          <div className="text-xs text-indigo-600 font-medium">
                            +{skill.mcpConfig.length - 2} more server(s)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Info */}
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    📄 {skill.id}.md
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2 pt-3">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(skill);
                    }}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(skill);
                    }}
                  >
                    Edit
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

SkillsPage.displayName = 'SkillsPage';

export default SkillsPage;
