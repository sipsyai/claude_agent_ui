import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../services/api';
import { Button } from './ui/Button';
import { PlayCircleIcon, XCircleIcon, ClockIcon, CopyIcon } from './ui/Icons';
import TaskExecutionModal from './TaskExecutionModal';

/**
 * TasksPage - Comprehensive task management interface
 *
 * Page-level component for managing agent and skill execution tasks with listing,
 * creation, execution, monitoring, and history tracking. Displays task statistics,
 * status filtering, and detailed execution logs.
 *
 * ## Features
 *
 * - Task listing with status filtering (all, pending, running, completed, failed)
 * - Statistics dashboard with real-time task counts by status
 * - Task creation with agent/skill selection and dynamic input forms
 * - Task execution with SSE streaming via TaskExecutionModal
 * - Task detail viewing with parsed execution logs
 * - Clone and delete operations
 * - Time-ago formatting for relative timestamps
 *
 * ## Task Listing
 *
 * Tasks are displayed in a vertical list with rich information cards showing:
 *
 * - **Status Indicator**: Color-coded emoji icon (🟡 pending, 🔵 running, 🟢 completed, 🔴 failed)
 * - **Task Name**: Large semibold heading with inline status badge
 * - **Status Badge**: Color-coded pill with status text (yellow/blue/green/red backgrounds)
 * - **Metadata**: Agent name and creation time with relative timestamp (e.g., "5m ago", "2h ago")
 * - **Description**: Optional task description in muted text
 * - **Duration**: Execution duration in seconds with ClockIcon (displayed after completion)
 * - **Action Buttons**:
 *   - View: Opens TaskDetailModal with execution log
 *   - Clone: Creates duplicate task with same configuration
 *   - Execute: Runs pending/failed tasks via TaskExecutionModal (PlayCircleIcon)
 *   - Delete: Removes task with confirmation dialog (XCircleIcon)
 *
 * ## Statistics Dashboard
 *
 * Real-time task statistics displayed in a 5-column grid:
 *
 * - **Total**: All tasks count (gray card with border)
 * - **Pending**: Tasks waiting to run (yellow card, yellow-50 background)
 * - **Running**: Currently executing tasks (blue card, blue-50 background)
 * - **Completed**: Successfully finished tasks (green card, green-50 background)
 * - **Failed**: Tasks that encountered errors (red card, red-50 background)
 *
 * Statistics are computed using useMemo hook, filtering allTasks array by status.
 *
 * ## Task Creation
 *
 * "Create Task" button opens CreateTaskModal with comprehensive form:
 *
 * ### Form Fields:
 * 1. **Task Name** (required): Descriptive name for the task
 * 2. **Description** (optional): Additional details about task purpose
 * 3. **Task Type** (required): Toggle between "Agent" and "Skill"
 * 4. **Entity Selection** (required): Dropdown to select agent or skill
 *    - Shows entity description below dropdown
 *    - Resets input values when selection changes
 * 5. **Input Configuration**:
 *    - **Skills with input fields**: Dynamic form based on skill.inputFields schema
 *      - Supports 7 field types: text, textarea, dropdown, number, checkbox, multiselect, filepath
 *      - Required field validation with red asterisk indicator
 *      - Field descriptions displayed below labels
 *      - Builds userPrompt from field values (e.g., "Label: value")
 *    - **Skills without input fields / Agents**: Single "Prompt" textarea
 *      - Multi-line text input for task instructions
 *      - Becomes userPrompt directly
 * 6. **Permission Mode**: Dropdown with 4 options
 *    - default: Ask for permissions during execution
 *    - acceptEdits: Automatically accept edit operations
 *    - bypass: No permission prompts (fully automated)
 *    - plan: Plan mode for review before execution
 *
 * ### Creation Workflow:
 * 1. User clicks "+ Create Task" button
 * 2. CreateTaskModal opens with form
 * 3. User selects task type (agent/skill)
 * 4. Agents and skills loaded from API with directory context
 * 5. User selects entity from dropdown (auto-selects first item)
 * 6. Form fields rendered based on entity type and input schema
 * 7. User fills in required fields (validated on submit)
 * 8. User clicks "Create Task" button
 * 9. API call to createTask endpoint
 * 10. Success: Modal closes, task list refreshes
 * 11. Error: Alert with error message, modal remains open
 *
 * ## Task Execution
 *
 * Tasks can be executed directly from the task list:
 *
 * - **Execute Button**: Displayed for pending and failed tasks (PlayCircleIcon)
 * - **Execution Modal**: TaskExecutionModal opens on click
 *   - Automatic execution on mount
 *   - SSE streaming for real-time progress updates
 *   - Message display (assistant, user, tool use, status, error)
 *   - Auto-scroll to latest messages
 *   - Completion callback refreshes task list
 * - **Status Updates**: Task status changes from pending → running → completed/failed
 * - **Execution Log**: All events stored in task.executionLog array
 *
 * ## Task Detail Viewing
 *
 * "View" button opens TaskDetailModal with detailed information:
 *
 * ### Header Section:
 * - Task name (bold heading)
 * - Agent name and status badge
 * - Task description (if provided)
 * - Close button (XCircleIcon)
 *
 * ### Task Info Section:
 * - Created: Timestamp when task was created
 * - Started: Timestamp when execution began (if started)
 * - Completed: Timestamp when execution finished (if completed)
 * - Duration: Total execution time in seconds
 * - Permission Mode: The permission mode used for execution
 *
 * ### Execution Log Section:
 * Parsed execution log with color-coded message types:
 *
 * - **Assistant Messages** (bg-primary/10): Text content from Claude
 * - **Tool Use Messages** (bg-purple-500/10): Tool execution details
 *   - Tool name with 🔧 icon
 *   - Collapsible input parameters (📥 Input Parameters)
 *   - Collapsible output result (📤 Output Result)
 *   - Auto-expand for short results (< 200 chars)
 * - **Status Messages** (bg-blue-500/10): Progress updates and completion
 * - **Error Messages** (bg-red-500/10): Error details and stack traces
 * - **Debug Messages** (bg-yellow-500/10): Debug information
 *
 * Empty state: "No execution log available" displayed for tasks without logs.
 *
 * ## Status Filtering
 *
 * Filter buttons above task list:
 *
 * - **all**: Show all tasks (default filter)
 * - **pending**: Tasks waiting to run
 * - **running**: Currently executing tasks
 * - **completed**: Successfully finished tasks
 * - **failed**: Tasks that encountered errors
 *
 * Active filter has bg-primary background with white text.
 * Inactive filters have bg-card background with border, hover:bg-accent on hover.
 *
 * Tasks filtered using useMemo hook for optimal performance.
 *
 * ## Clone Operation
 *
 * Clone button (CopyIcon) creates duplicate task:
 *
 * 1. User clicks clone button on task card
 * 2. API call to createTask with copied task properties:
 *    - name, description, agentId, taskType, userPrompt, inputValues, permissionMode, directory
 * 3. Success: Task list refreshes to show new task
 * 4. Error: Alert with "Failed to clone task" message
 *
 * Cloned task inherits all configuration but gets new ID and timestamps.
 *
 * ## Delete Operation
 *
 * Delete button (XCircleIcon) removes task:
 *
 * 1. User clicks delete button on task card
 * 2. Confirmation dialog: "Are you sure you want to delete this task?"
 * 3. User confirms deletion
 * 4. API call to deleteTask endpoint
 * 5. Success: Task list refreshes to remove deleted task
 * 6. Error: Alert with "Failed to delete task" message
 * 7. User cancels: No action taken, dialog closes
 *
 * ## Directory Integration
 *
 * Tasks are loaded globally (no directory filtering on API level):
 *
 * - **API Integration**: getTasks({}) fetches all tasks
 * - **Directory Context**: Directory from localStorage used for create operations
 * - **Scoped Creation**: New tasks created with directory context for proper isolation
 *
 * ## Styling Behavior
 *
 * Tailwind CSS classes and responsive design:
 *
 * - **Animation**: animate-fade-in on page mount for smooth entry
 * - **Header**: Flex layout with title on left, "Create Task" button on right
 * - **Stats Grid**: 5 equal columns with color-coded cards (grid-cols-5)
 * - **Filter Buttons**: Flex gap-2 with rounded-lg buttons, active state with bg-primary
 * - **Task Cards**: Vertical spacing (space-y-3) with bg-card, border, rounded-lg
 * - **Status Colors**:
 *   - pending: text-yellow-600 bg-yellow-100
 *   - running: text-blue-600 bg-blue-100
 *   - completed: text-green-600 bg-green-100
 *   - failed: text-red-600 bg-red-100
 * - **Empty State**: Centered text with py-8 padding, text-muted-foreground
 * - **Loading State**: Centered "Loading tasks..." with muted text
 *
 * @example
 * // Basic usage in ManagerApp dashboard phase
 * import TasksPage from './components/TasksPage';
 *
 * function ManagerApp() {
 *   const [activeView, setActiveView] = useState('dashboard');
 *
 *   return (
 *     <Layout>
 *       {activeView === 'tasks' && <TasksPage />}
 *     </Layout>
 *   );
 * }
 *
 * @example
 * // Understanding task creation workflow (agent-based)
 * // 1. User clicks "+ Create Task" button
 * // 2. CreateTaskModal opens
 * // 3. User selects "Agent" task type
 * // 4. User selects agent from dropdown (e.g., "Code Reviewer")
 * // 5. User enters task name: "Review authentication code"
 * // 6. User enters prompt: "Review the authentication implementation for security issues"
 * // 7. User selects permission mode: "default"
 * // 8. User clicks "Create Task"
 * // 9. Task created with status "pending"
 * // 10. Task appears in task list with yellow pending indicator
 *
 * @example
 * // Understanding task creation workflow (skill-based with input fields)
 * // 1. User clicks "+ Create Task" button
 * // 2. CreateTaskModal opens
 * // 3. User selects "Skill" task type
 * // 4. User selects skill from dropdown (e.g., "API Integration")
 * // 5. Skill has input fields: endpoint (text), method (dropdown), payload (textarea)
 * // 6. User enters task name: "Create user endpoint"
 * // 7. User fills input fields:
 * //    - endpoint: "/api/users"
 * //    - method: "POST"
 * //    - payload: '{"name": "John", "email": "john@example.com"}'
 * // 8. User selects permission mode: "bypass"
 * // 9. User clicks "Create Task"
 * // 10. userPrompt built from fields: "Endpoint: /api/users\nMethod: POST\nPayload: {...}"
 * // 11. Task created and appears in list
 *
 * @example
 * // Understanding task execution and detail viewing
 * // 1. User finds pending task in list: "Review authentication code"
 * // 2. User clicks Play button (PlayCircleIcon)
 * // 3. TaskExecutionModal opens and starts execution automatically
 * // 4. SSE stream shows real-time progress:
 * //    - Status: "Starting agent execution..."
 * //    - Assistant: "I'll review your authentication code..."
 * //    - Tool use: Read file "auth.ts"
 * //    - Tool result: File contents displayed
 * //    - Assistant: "I found these security issues..."
 * // 5. Execution completes, task status changes to "completed"
 * // 6. User closes execution modal
 * // 7. Task list refreshes, task now shows green completed indicator
 * // 8. User clicks "View" button on completed task
 * // 9. TaskDetailModal opens with full execution log
 * // 10. User reviews all messages, tool uses, and results
 * // 11. User closes detail modal
 */
const TasksPage: React.FC = () => {
  const [allTasks, setAllTasks] = useState<api.Task[]>([]);
  const [filter, setFilter] = useState<api.TaskStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<api.Task | null>(null);
  const [executingTask, setExecutingTask] = useState<api.Task | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  /**
   * Load all tasks from API
   *
   * Fetches all tasks without directory filtering (global task list).
   * Updates allTasks state with fetched data and manages loading state.
   *
   * @internal
   */
  const loadTasks = async () => {
    try {
      setLoading(true);
      // Always fetch all tasks and filter on frontend
      const data = await api.getTasks({});
      setAllTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate task statistics by status
   *
   * Computes real-time statistics from allTasks array:
   * - total: Total number of tasks
   * - pending: Count of tasks with status 'pending'
   * - running: Count of tasks with status 'running'
   * - completed: Count of tasks with status 'completed'
   * - failed: Count of tasks with status 'failed'
   *
   * Uses useMemo hook for optimal performance, recalculating only when allTasks changes.
   *
   * @internal
   */
  const stats = useMemo(() => {
    return {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      running: allTasks.filter(t => t.status === 'running').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
    };
  }, [allTasks]);

  /**
   * Filter tasks based on selected filter
   *
   * Filters allTasks array by status:
   * - 'all': Returns all tasks (no filtering)
   * - 'pending'|'running'|'completed'|'failed': Returns tasks with matching status
   *
   * Uses useMemo hook for optimal performance, recalculating only when allTasks or filter changes.
   *
   * @internal
   */
  const tasks = useMemo(() => {
    if (filter === 'all') return allTasks;
    return allTasks.filter(t => t.status === filter);
  }, [allTasks, filter]);

  /**
   * Delete a task with confirmation
   *
   * Workflow:
   * 1. Show confirmation dialog
   * 2. If confirmed, call DELETE /tasks/:taskId API endpoint
   * 3. Success: Refresh task list
   * 4. Error: Show alert with error message
   * 5. If not confirmed: No action taken
   *
   * @param taskId - ID of the task to delete
   * @internal
   */
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      alert('Failed to delete task');
    }
  };

  /**
   * Clone a task with same configuration
   *
   * Creates a new task with copied properties from the original task:
   * - name, description, agentId, taskType, userPrompt, inputValues, permissionMode, directory
   * - New task gets new ID and timestamps
   * - Status starts as 'pending'
   *
   * Workflow:
   * 1. Call POST /tasks API endpoint with copied task properties
   * 2. Success: Refresh task list to show new task
   * 3. Error: Show alert with "Failed to clone task" message
   *
   * @param task - Task object to clone
   * @internal
   */
  const handleCloneTask = async (task: api.Task) => {
    try {
      await api.createTask({
        name: task.name,
        description: task.description,
        agentId: task.agentId,
        taskType: task.taskType,
        userPrompt: task.userPrompt,
        inputValues: task.inputValues,
        permissionMode: task.permissionMode,
        directory: task.directory,
      });
      loadTasks();
    } catch (error) {
      alert('Failed to clone task');
    }
  };

  /**
   * Execute a task via TaskExecutionModal
   *
   * Opens TaskExecutionModal with selected task.
   * Modal will automatically start execution on mount.
   *
   * @param task - Task object to execute
   * @internal
   */
  const handleExecuteTask = (task: api.Task) => {
    setExecutingTask(task);
  };

  /**
   * Get color classes for task status badge
   *
   * Returns Tailwind CSS classes for status badge background and text color:
   * - pending: Yellow (text-yellow-600 bg-yellow-100)
   * - running: Blue (text-blue-600 bg-blue-100)
   * - completed: Green (text-green-600 bg-green-100)
   * - failed: Red (text-red-600 bg-red-100)
   *
   * @param status - Task status
   * @returns CSS class string for status badge styling
   * @internal
   */
  const getStatusColor = (status: api.TaskStatus) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
    }
  };

  /**
   * Get emoji icon for task status
   *
   * Returns color-coded emoji icon:
   * - pending: 🟡 (yellow circle)
   * - running: 🔵 (blue circle)
   * - completed: 🟢 (green circle)
   * - failed: 🔴 (red circle)
   *
   * @param status - Task status
   * @returns Emoji icon string
   * @internal
   */
  const getStatusIcon = (status: api.TaskStatus) => {
    switch (status) {
      case 'pending': return '🟡';
      case 'running': return '🔵';
      case 'completed': return '🟢';
      case 'failed': return '🔴';
    }
  };

  /**
   * Format timestamp as relative time ago
   *
   * Converts ISO timestamp to human-readable relative time:
   * - < 1 minute: "just now"
   * - < 1 hour: "Nm ago" (e.g., "5m ago")
   * - < 24 hours: "Nh ago" (e.g., "2h ago")
   * - >= 24 hours: "Nd ago" (e.g., "3d ago")
   *
   * @param timestamp - ISO timestamp string
   * @returns Relative time string
   * @internal
   */
  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage and execute agent tasks</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ Create Task</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.running}</div>
            <div className="text-sm text-blue-600">Running</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
            <div className="text-sm text-green-600">Completed</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
            <div className="text-sm text-red-600">Failed</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'running', 'completed', 'failed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-card border border-border hover:bg-accent'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No tasks found. Create your first task!
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{getStatusIcon(task.status)}</span>
                    <h3 className="text-lg font-semibold">{task.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {task.agentName} • {formatTimeAgo(task.createdAt)}
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  )}
                  {task.duration && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="h-3 w-3" />
                      {(task.duration / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedTask(task)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCloneTask(task)}
                    title="Clone task"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                  {(task.status === 'pending' || task.status === 'failed') && (
                    <Button
                      size="sm"
                      onClick={() => handleExecuteTask(task)}
                    >
                      <PlayCircleIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    <XCircleIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadTasks();
          }}
        />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
      {executingTask && (
        <TaskExecutionModal
          task={executingTask}
          onClose={() => {
            setExecutingTask(null);
            loadTasks();
          }}
          onComplete={() => {
            // Don't close modal automatically - let user see results
            // Just reload tasks to update the list
            loadTasks();
          }}
        />
      )}
    </div>
  );
};

TasksPage.displayName = 'TasksPage';

/**
 * CreateTaskModal - Task creation modal with dynamic form
 *
 * Modal component for creating new agent or skill execution tasks with comprehensive
 * form fields including task type selection, entity (agent/skill) selection, dynamic
 * input fields based on entity schema, and permission mode configuration.
 *
 * ## Features
 *
 * - Task type selection (Agent or Skill)
 * - Entity selection with dropdown (agents or skills)
 * - Dynamic input form based on entity configuration
 * - Skill input fields support (7 field types)
 * - Permission mode selection
 * - Form validation with required field checking
 * - Directory-aware entity loading
 * - Auto-selection of first entity
 * - Input value reset on entity change
 *
 * ## Form Sections
 *
 * ### 1. Task Name (Required)
 * - Text input for descriptive task name
 * - Placeholder: "e.g., Analyze company website"
 * - Validation: Required, must not be empty
 *
 * ### 2. Description (Optional)
 * - Textarea for additional task details
 * - Placeholder: "Additional details about this task"
 * - 2 rows height
 * - Optional field, can be left empty
 *
 * ### 3. Task Type (Required)
 * - Toggle buttons: "Agent" or "Skill"
 * - Default: "Agent"
 * - Active button: bg-primary with white text
 * - Inactive button: bg-card with border
 * - Resets inputValues when changed
 *
 * ### 4. Entity Selection (Required)
 * - **Agent Mode**: Dropdown of available agents with descriptions
 * - **Skill Mode**: Dropdown of available skills with descriptions
 * - Shows entity description below dropdown (muted text)
 * - Auto-selects first entity on load
 * - Resets inputValues when selection changes
 *
 * ### 5. Input Configuration (Dynamic)
 *
 * Two rendering modes based on entity configuration:
 *
 * #### A. Skills with Input Fields (skill.inputFields exists and length > 0)
 * Renders dynamic form based on skill.inputFields schema with support for 7 field types:
 *
 * - **text**: Single-line text input (type="text")
 * - **textarea**: Multi-line text input (3 rows)
 * - **dropdown**: Single-selection dropdown with options
 * - **number**: Numeric input (type="number")
 * - **checkbox**: Boolean checkbox (w-4 h-4)
 * - **multiselect**: Multiple-selection dropdown (HTML multiple select)
 * - **filepath**: File path input with monospace font (font-mono)
 *
 * Each field displays:
 * - Label with red asterisk (*) if required
 * - Description text below label (if field.description exists)
 * - Appropriate input control based on field.type
 * - Placeholder text (if field.placeholder exists)
 *
 * Validation:
 * - Required fields checked on submit
 * - Alert displays missing required field labels
 * - userPrompt built from field values: "Label: value\nLabel2: value2..."
 *
 * #### B. Skills without Input Fields OR Agents
 * Renders single "Prompt" textarea:
 * - Label: "Prompt *" (required indicator)
 * - 4 rows height
 * - Placeholder: "What should the {agent|skill} do?"
 * - Validation: Required, must not be empty
 * - userPrompt set directly from textarea value
 *
 * ### 6. Permission Mode (Required)
 * - Dropdown with 4 options:
 *   - **default**: Ask for permissions during execution
 *   - **acceptEdits**: Automatically accept edit operations
 *   - **bypass**: No permission prompts (fully automated)
 *   - **plan**: Plan mode for review before execution
 * - Default: "bypass"
 * - Used during task execution to control permission handling
 *
 * ## Creation Workflow
 *
 * 1. Modal opens via onClose/onSuccess props
 * 2. Load agents and skills from API with directory context
 * 3. Auto-select first agent (if taskType === 'agent')
 * 4. User selects task type (agent or skill)
 * 5. User selects entity from dropdown
 * 6. Form fields rendered dynamically based on entity configuration
 * 7. User fills in required fields (task name, inputs/prompt, permission mode)
 * 8. User clicks "Create Task" button
 * 9. Validation:
 *    - Check task name is not empty
 *    - Check entity is selected
 *    - Check required skill input fields are filled
 *    - Check prompt/userPrompt is not empty
 * 10. API call to POST /tasks endpoint
 * 11. Success: onSuccess callback invoked, modal closes, task list refreshes
 * 12. Error: Alert with error message, modal remains open, creating state reset
 *
 * ## Directory Integration
 *
 * - Directory retrieved from localStorage ('cui-manager-directory')
 * - Used for loading agents and skills: api.getAgents(dir), api.getSkills(dir)
 * - Passed to createTask API call for proper task scoping
 *
 * ## Styling Behavior
 *
 * Tailwind CSS classes:
 * - **Modal Overlay**: fixed inset-0 bg-black bg-opacity-50 z-50 (centered flex)
 * - **Modal Container**: bg-card rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-auto
 * - **Header**: Flex layout with title (text-xl font-bold) and close button
 * - **Form Fields**: space-y-4 with consistent spacing
 * - **Labels**: text-sm font-medium mb-1 with red asterisk for required fields
 * - **Inputs**: w-full px-3 py-2 border border-border rounded-md bg-background
 * - **Buttons**: Flex gap-2 with "Create Task" (flex-1) and "Cancel" (secondary)
 * - **Disabled State**: All inputs and buttons disabled when creating === true
 *
 * @example
 * // Basic usage with task creation
 * const [showCreateModal, setShowCreateModal] = useState(false);
 *
 * // Task list refresh function
 * const loadTasks = async () => {
 *   const data = await api.getTasks({});
 *   setAllTasks(data);
 * };
 *
 * return (
 *   <>
 *     <Button onClick={() => setShowCreateModal(true)}>+ Create Task</Button>
 *     {showCreateModal && (
 *       <CreateTaskModal
 *         onClose={() => setShowCreateModal(false)}
 *         onSuccess={() => {
 *           setShowCreateModal(false);
 *           loadTasks();
 *         }}
 *       />
 *     )}
 *   </>
 * );
 *
 * @example
 * // Understanding agent task creation workflow
 * // 1. User clicks "+ Create Task" button
 * // 2. CreateTaskModal opens with "Agent" task type selected
 * // 3. Agents loaded from API: ["Code Reviewer", "Documentation Writer", "Bug Fixer"]
 * // 4. First agent "Code Reviewer" auto-selected
 * // 5. User enters task name: "Review authentication code"
 * // 6. User enters description: "Focus on security vulnerabilities"
 * // 7. User enters prompt: "Review auth.ts for security issues and best practices"
 * // 8. User selects permission mode: "default"
 * // 9. User clicks "Create Task"
 * // 10. Validation passes (name, agent, prompt all filled)
 * // 11. API call: POST /tasks with { name, description, agentId, taskType: 'agent', userPrompt, permissionMode, directory }
 * // 12. Success: onSuccess called, modal closes, task appears in list
 *
 * @example
 * // Understanding skill task creation with input fields
 * // 1. User clicks "+ Create Task" button
 * // 2. CreateTaskModal opens
 * // 3. User clicks "Skill" task type button
 * // 4. Skills loaded from API: ["API Integration", "Database Query", "File Parser"]
 * // 5. User selects "API Integration" skill
 * // 6. Skill has input fields:
 * //    - endpoint (text, required): API endpoint URL
 * //    - method (dropdown, required): GET, POST, PUT, DELETE
 * //    - headers (textarea, optional): HTTP headers
 * //    - payload (textarea, optional): Request body
 * // 7. User enters task name: "Create user endpoint"
 * // 8. User fills input fields:
 * //    - endpoint: "/api/users"
 * //    - method: "POST"
 * //    - payload: '{"name": "John", "email": "john@example.com"}'
 * // 9. User selects permission mode: "bypass"
 * // 10. User clicks "Create Task"
 * // 11. Validation: Check required fields (endpoint, method)
 * // 12. Build userPrompt: "Endpoint: /api/users\nMethod: POST\nPayload: {...}"
 * // 13. API call: POST /tasks with inputValues and userPrompt
 * // 14. Success: Task created and appears in list
 */
const CreateTaskModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [taskType, setTaskType] = React.useState<'agent' | 'skill'>('agent');
  const [agents, setAgents] = React.useState<api.Agent[]>([]);
  const [skills, setSkills] = React.useState<api.Skill[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>('');
  const [selectedSkillId, setSelectedSkillId] = React.useState<string>('');
  const [taskName, setTaskName] = React.useState('');
  const [taskDescription, setTaskDescription] = React.useState('');
  const [inputValues, setInputValues] = React.useState<Record<string, any>>({});
  const [permissionMode, setPermissionMode] = React.useState<'default' | 'acceptEdits' | 'bypass' | 'plan'>('bypass');
  const [creating, setCreating] = React.useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedSkill = skills.find(s => s.id === selectedSkillId);
  const selectedEntity = taskType === 'agent' ? selectedAgent : selectedSkill;
  const hasInputFields = taskType === 'skill' && selectedSkill && selectedSkill.inputFields && selectedSkill.inputFields.length > 0;

  React.useEffect(() => {
    // Load agents and skills
    const dir = localStorage.getItem('cui-manager-directory') || undefined;

    api.getAgents(dir).then(data => {
      setAgents(data);
      if (data.length > 0 && taskType === 'agent') setSelectedAgentId(data[0].id);
    }).catch(console.error);

    api.getSkills(dir).then(data => {
      setSkills(data);
      if (data.length > 0 && taskType === 'skill') setSelectedSkillId(data[0].id);
    }).catch(console.error);
  }, []);

  // Update selected ID when task type changes
  React.useEffect(() => {
    if (taskType === 'agent' && agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    } else if (taskType === 'skill' && skills.length > 0 && !selectedSkillId) {
      setSelectedSkillId(skills[0].id);
    }
    setInputValues({});
  }, [taskType, agents, skills]);

  /**
   * Handle task creation with validation
   *
   * Validates form fields and creates new task via API:
   *
   * ### Validation Steps:
   * 1. Check task name is not empty
   * 2. Check entity (agent or skill) is selected
   * 3. For skills with input fields:
   *    - Check all required fields are filled
   *    - Alert with missing field labels if validation fails
   *    - Build userPrompt from field values: "Label: value\nLabel2: value2..."
   * 4. For skills without input fields or agents:
   *    - Check prompt is not empty
   *    - Use prompt directly as userPrompt
   * 5. Check userPrompt is not empty (final validation)
   *
   * ### Creation Workflow:
   * 1. Set creating state to true (disables form)
   * 2. Get directory from localStorage
   * 3. Call POST /tasks API endpoint with:
   *    - name, description, agentId, taskType, userPrompt, permissionMode, directory
   *    - inputValues (only for skills with input fields)
   * 4. Success: Call onSuccess callback (closes modal, refreshes list)
   * 5. Error: Alert with error message, reset creating state
   * 6. Finally: Reset creating state to false
   *
   * @internal
   */
  const handleCreate = async () => {
    const entityId = taskType === 'agent' ? selectedAgentId : selectedSkillId;

    if (!taskName.trim() || !entityId) {
      alert('Please fill in required fields');
      return;
    }

    // Build prompt from input values if fields exist
    let userPrompt = '';
    if (hasInputFields) {
      const requiredFields = selectedSkill!.inputFields!.filter((f: any) => f.required);
      const missingFields = requiredFields.filter((f: any) => !inputValues[f.name]);

      if (missingFields.length > 0) {
        alert(`Please fill in required fields: ${missingFields.map((f: any) => f.label).join(', ')}`);
        return;
      }

      const inputParts = selectedSkill!.inputFields!.map((field: any) => {
        const value = inputValues[field.name];
        if (value !== undefined && value !== '') {
          return `${field.label}: ${value}`;
        }
        return null;
      }).filter(Boolean);

      userPrompt = inputParts.join('\n');
    } else {
      userPrompt = inputValues['prompt'] || '';
    }

    if (!userPrompt.trim()) {
      alert('Please provide a prompt or fill in the input fields');
      return;
    }

    setCreating(true);
    try {
      const dir = localStorage.getItem('cui-manager-directory') || undefined;
      await api.createTask({
        name: taskName,
        description: taskDescription || undefined,
        agentId: entityId,
        taskType: taskType,
        userPrompt,
        inputValues: hasInputFields ? inputValues : undefined,
        permissionMode,
        directory: dir,
      });
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create Task</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Name *</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Analyze company website"
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              disabled={creating}
            />
          </div>

          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Additional details about this task"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              disabled={creating}
            />
          </div>

          {/* Task Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Type *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTaskType('agent')}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
                  taskType === 'agent'
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border hover:bg-accent'
                }`}
                disabled={creating}
              >
                Agent
              </button>
              <button
                type="button"
                onClick={() => setTaskType('skill')}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
                  taskType === 'skill'
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border hover:bg-accent'
                }`}
                disabled={creating}
              >
                Skill
              </button>
            </div>
          </div>

          {/* Agent or Skill Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {taskType === 'agent' ? 'Agent' : 'Skill'} *
            </label>
            {taskType === 'agent' ? (
              <>
                <select
                  value={selectedAgentId}
                  onChange={(e) => {
                    setSelectedAgentId(e.target.value);
                    setInputValues({});
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  disabled={creating}
                >
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                {selectedAgent && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedAgent.description}</p>
                )}
              </>
            ) : (
              <>
                <select
                  value={selectedSkillId}
                  onChange={(e) => {
                    setSelectedSkillId(e.target.value);
                    setInputValues({});
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  disabled={creating}
                >
                  {skills.map(skill => (
                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                  ))}
                </select>
                {selectedSkill && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedSkill.description}</p>
                )}
              </>
            )}
          </div>

          {/* Input Fields or Prompt */}
          {selectedEntity && (
            <div>
              {hasInputFields ? (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Skill Inputs:
                  </label>
                  {selectedSkill!.inputFields!.map((field: any) => (
                    <div key={field.name} className="mb-3">
                      <label className="block text-sm mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-muted-foreground mb-1">{field.description}</p>
                      )}
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'textarea' && (
                        <textarea
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'dropdown' && (
                        <select
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'checkbox' && (
                        <input
                          type="checkbox"
                          checked={inputValues[field.name] || false}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.checked })}
                          className="w-4 h-4"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'multiselect' && (
                        <select
                          multiple
                          value={inputValues[field.name] || []}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, option => option.value);
                            setInputValues({ ...inputValues, [field.name]: selected });
                          }}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                          size={Math.min(field.options?.length || 5, 5)}
                        >
                          {field.options?.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {field.type === 'filepath' && (
                        <input
                          type="text"
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder || '/path/to/file'}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm font-mono"
                          disabled={creating}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Prompt *</label>
                  <textarea
                    value={inputValues['prompt'] || ''}
                    onChange={(e) => setInputValues({ ...inputValues, prompt: e.target.value })}
                    placeholder={`What should the ${taskType === 'agent' ? 'agent' : 'skill'} do?`}
                    rows={4}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    disabled={creating}
                  />
                </div>
              )}
            </div>
          )}

          {/* Permission Mode */}
          <div>
            <label className="block text-sm font-medium mb-1">Permission Mode</label>
            <select
              value={permissionMode}
              onChange={(e) => setPermissionMode(e.target.value as any)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              disabled={creating}
            >
              <option value="default">Default (ask for permissions)</option>
              <option value="acceptEdits">Accept Edits</option>
              <option value="bypass">Bypass (no permissions)</option>
              <option value="plan">Plan Mode</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? 'Creating...' : 'Create Task'}
          </Button>
          <Button onClick={onClose} variant="secondary" disabled={creating}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

CreateTaskModal.displayName = 'CreateTaskModal';

/**
 * TaskDetailModal - Task execution history viewer
 *
 * Modal component for viewing detailed task information and execution logs with
 * parsed messages, tool use visualization, and color-coded message types. Displays
 * task metadata, execution timeline, and comprehensive execution log with collapsible
 * tool input/output sections.
 *
 * ## Features
 *
 * - Task metadata display (name, agent, status, timestamps, duration)
 * - Parsed execution log with 5 message types
 * - Tool use visualization with collapsible input/output
 * - Color-coded message backgrounds
 * - Auto-expand for short tool results (< 200 chars)
 * - Empty state for tasks without execution logs
 * - Full-width modal with scrollable content
 *
 * ## Modal Layout
 *
 * Three main sections in vertical layout:
 *
 * ### 1. Header Section
 * - Task name (text-xl font-bold)
 * - Agent name and status badge (inline, color-coded)
 * - Task description (if provided, text-sm muted)
 * - Close button (XCircleIcon, top-right)
 *
 * ### 2. Task Info Section
 * Displays task metadata in compact list format:
 * - **Created**: Timestamp when task was created (toLocaleString)
 * - **Started**: Timestamp when execution began (if task.startedAt exists)
 * - **Completed**: Timestamp when execution finished (if task.completedAt exists)
 * - **Duration**: Total execution time in seconds (if task.duration exists)
 * - **Permission Mode**: The permission mode used for execution
 *
 * ### 3. Execution Log Section
 * Scrollable area with parsed execution log messages:
 * - flex-1 overflow-y-auto for scrolling
 * - space-y-3 for vertical message spacing
 * - Empty state: "No execution log available" (centered, muted)
 *
 * ## Message Types
 *
 * Five color-coded message types with distinct styling:
 *
 * ### 1. Assistant Messages (bg-primary/10)
 * - Text content from Claude
 * - Displays message.content as plain text
 * - whitespace-pre-wrap for formatting
 * - Source: assistant messages with text blocks
 *
 * ### 2. Tool Use Messages (bg-purple-500/10)
 * - Tool execution details with 🔧 icon
 * - Tool name displayed in header (text-purple-400)
 * - Collapsible sections:
 *   - **📥 Input Parameters**: JSON formatted tool input
 *   - **📤 Output Result**: Plain text or JSON formatted result
 * - Auto-expand behavior:
 *   - Short results (< 200 chars): Auto-expanded
 *   - Long results (>= 200 chars): Collapsed by default
 * - Source: assistant messages with tool_use blocks
 *
 * ### 3. Status Messages (bg-blue-500/10)
 * - Progress updates and completion messages
 * - Displays status text with checkmark/info icons
 * - Examples: "✅ Agent execution completed", "✅ Task completed successfully"
 * - Source: status events, complete events, result events (success)
 *
 * ### 4. Error Messages (bg-red-500/10)
 * - Error details and stack traces
 * - Displays error with ❌ prefix
 * - Examples: "❌ Error: ...", "❌ Task failed: ..."
 * - Source: error events, result events (is_error: true)
 *
 * ### 5. Debug Messages (bg-yellow-500/10)
 * - Debug information and internal events
 * - Displays debug content or stringified event
 * - Source: debug events
 *
 * ## Execution Log Parsing
 *
 * The parseExecutionLog function processes task.executionLog array:
 *
 * ### Parsing Logic:
 * 1. Initialize empty messages array and toolUseMap
 * 2. Iterate through execution log events
 * 3. For each event, determine event type and extract relevant data:
 *
 * #### Assistant Message Events (type: 'message', content.type: 'assistant')
 * - Extract text blocks: Filter content blocks where type === 'text', join text fields
 * - Extract tool_use blocks: Filter content blocks where type === 'tool_use'
 * - Create tool use messages with toolName, toolInput, toolUseId
 * - Store in toolUseMap for matching with results
 *
 * #### User Message Events (type: 'message', content.type: 'user')
 * - Extract tool_result blocks: Filter content blocks where type === 'tool_result'
 * - Match with tool_use messages via tool_use_id
 * - Update corresponding tool message with toolResult
 *
 * #### Result Events (content.type: 'result')
 * - is_error === true: Create error message with "❌ Task failed: {result}"
 * - is_error === false: Create status message "✅ Task completed successfully"
 * - If result has content: Create additional assistant message with result data
 *
 * #### Status Events (type: 'status')
 * - Extract status message or status field
 * - Create status message
 *
 * #### Debug Events (type: 'debug')
 * - Extract debug message or stringify event
 * - Create debug message
 *
 * #### Error Events (type: 'error')
 * - Extract error or message field
 * - Create error message with ❌ prefix
 *
 * #### Complete Events (type: 'complete')
 * - Create status message: "✅ Agent execution completed"
 *
 * ## Tool Use Visualization
 *
 * Tool use messages have special collapsible rendering:
 *
 * ### Header:
 * - Tool name with 🔧 icon (uppercase, font-semibold)
 * - Purple color theme (text-purple-400)
 *
 * ### Input Parameters Section:
 * - `<details>` element with cursor-pointer
 * - Summary: "📥 Input Parameters" (text-xs, muted, hover:text-foreground)
 * - Content: JSON.stringify(toolInput, null, 2) in <pre> with monospace font
 * - Background: bg-black/20 with rounded corners and padding
 *
 * ### Output Result Section:
 * - `<details>` element with cursor-pointer
 * - Summary: "📤 Output Result" (text-xs, muted, hover:text-foreground)
 * - Auto-expand logic: `open={typeof toolResult === 'string' && toolResult.length < 200}`
 * - Content rendering:
 *   - String results: Plain text with whitespace-pre-wrap
 *   - Object results: JSON.stringify(toolResult, null, 2)
 * - Background: bg-black/20 with rounded corners and padding
 *
 * ## Styling Behavior
 *
 * Tailwind CSS classes:
 * - **Modal Overlay**: fixed inset-0 bg-black bg-opacity-50 z-50 (centered flex)
 * - **Modal Container**: bg-card rounded-lg shadow-xl max-w-5xl h-[85vh] flex flex-col
 * - **Header**: border-b p-4 with title, status badge, close button
 * - **Task Info**: border-b p-4 with text-sm spacing
 * - **Execution Log**: flex-1 overflow-y-auto p-4 space-y-3
 * - **Message Cards**: p-3 rounded-lg with color-coded backgrounds and borders
 * - **Status Badge Colors**:
 *   - completed: bg-green-100 text-green-700
 *   - failed: bg-red-100 text-red-700
 *   - running: bg-blue-100 text-blue-700
 *   - pending: bg-yellow-100 text-yellow-700
 * - **Footer**: border-t p-4 with Close button (flex justify-end)
 *
 * @example
 * // Basic usage with task detail viewing
 * const [selectedTask, setSelectedTask] = useState<api.Task | null>(null);
 *
 * return (
 *   <>
 *     <Button onClick={() => setSelectedTask(task)}>View Details</Button>
 *     {selectedTask && (
 *       <TaskDetailModal
 *         task={selectedTask}
 *         onClose={() => setSelectedTask(null)}
 *       />
 *     )}
 *   </>
 * );
 *
 * @example
 * // Understanding execution log display
 * // Given a completed task with execution log:
 * // task.executionLog = [
 * //   { type: 'status', message: 'Starting agent execution...' },
 * //   { type: 'message', content: { type: 'assistant', message: { content: [
 * //     { type: 'text', text: "I'll review your code..." },
 * //     { type: 'tool_use', id: 'tool_1', name: 'read_file', input: { file_path: 'auth.ts' } }
 * //   ]}}},
 * //   { type: 'message', content: { type: 'user', message: { content: [
 * //     { type: 'tool_result', tool_use_id: 'tool_1', content: '// file contents...' }
 * //   ]}}},
 * //   { type: 'message', content: { type: 'assistant', message: { content: [
 * //     { type: 'text', text: "I found these security issues..." }
 * //   ]}}},
 * //   { type: 'complete' }
 * // ]
 * //
 * // Parsed messages will display:
 * // 1. Status message: "Starting agent execution..." (blue background)
 * // 2. Assistant message: "I'll review your code..." (primary background)
 * // 3. Tool use message: "🔧 read_file" (purple background)
 * //    - Collapsible input: { file_path: 'auth.ts' }
 * //    - Collapsible output: '// file contents...' (auto-expanded if < 200 chars)
 * // 4. Assistant message: "I found these security issues..." (primary background)
 * // 5. Status message: "✅ Agent execution completed" (blue background)
 *
 * @example
 * // Understanding task info display
 * // Given a task:
 * // task = {
 * //   name: 'Review authentication code',
 * //   agentName: 'Code Reviewer',
 * //   status: 'completed',
 * //   description: 'Focus on security vulnerabilities',
 * //   createdAt: '2024-01-15T10:30:00Z',
 * //   startedAt: '2024-01-15T10:31:00Z',
 * //   completedAt: '2024-01-15T10:33:30Z',
 * //   duration: 150000, // 150 seconds
 * //   permissionMode: 'default'
 * // }
 * //
 * // Task info section displays:
 * // Created: 1/15/2024, 10:30:00 AM
 * // Started: 1/15/2024, 10:31:00 AM
 * // Completed: 1/15/2024, 10:33:30 AM
 * // Duration: 150.0s
 * // Permission Mode: default
 */
const TaskDetailModal: React.FC<{ task: api.Task; onClose: () => void }> = ({ task, onClose }) => {
  /**
   * Parsed message structure for execution log display
   *
   * @internal
   */
  interface ParsedMessage {
    id: string;
    type: 'status' | 'assistant' | 'tool_use' | 'error' | 'debug';
    content: string;
    timestamp: Date;
    toolName?: string;
    toolInput?: any;
    toolResult?: any;
    toolUseId?: string;
  }

  /**
   * Parse execution log into displayable messages
   *
   * Processes task.executionLog array and extracts messages for display:
   * - Assistant messages (text blocks)
   * - Tool use messages (tool_use blocks with input/output matching)
   * - Status messages (progress updates, completion)
   * - Error messages (execution errors, failed results)
   * - Debug messages (debug events)
   *
   * Uses toolUseMap to match tool_use blocks with tool_result blocks via toolUseId.
   *
   * @returns Array of ParsedMessage objects for rendering
   * @internal
   */
  const parseExecutionLog = (): ParsedMessage[] => {
    if (!task.executionLog || task.executionLog.length === 0) return [];

    const messages: ParsedMessage[] = [];
    const toolUseMap = new Map<string, ParsedMessage>();

    task.executionLog.forEach((event: any, index: number) => {
      // Handle message events
      if (event.type === 'message' && event.content) {
        const eventContent = event.content;

        // Handle assistant messages
        if (eventContent.type === 'assistant' && eventContent.message) {
          const message = eventContent.message;
          if (message.content && Array.isArray(message.content)) {
            const blocks = message.content;

            // Process text blocks
            const textContent = blocks
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');

            if (textContent) {
              messages.push({
                id: `msg-${index}-text`,
                type: 'assistant',
                content: textContent,
                timestamp: new Date(),
              });
            }

            // Process tool_use blocks
            const toolUseBlocks = blocks.filter((block: any) => block.type === 'tool_use');
            toolUseBlocks.forEach((toolBlock: any) => {
              const toolMsg: ParsedMessage = {
                id: `tool-use-${toolBlock.id}`,
                type: 'tool_use',
                content: '',
                timestamp: new Date(),
                toolName: toolBlock.name,
                toolInput: toolBlock.input,
                toolUseId: toolBlock.id,
              };
              messages.push(toolMsg);
              toolUseMap.set(toolBlock.id, toolMsg);
            });
          }
        }

        // Handle user messages (tool results)
        if (eventContent.type === 'user' && eventContent.message) {
          const message = eventContent.message;
          if (message.content && Array.isArray(message.content)) {
            const toolResultBlocks = message.content.filter((block: any) => block.type === 'tool_result');
            toolResultBlocks.forEach((resultBlock: any) => {
              const toolUseId = resultBlock.tool_use_id;
              const toolResult = resultBlock.content;

              // Find corresponding tool_use message and update it
              const toolMsg = toolUseMap.get(toolUseId);
              if (toolMsg) {
                toolMsg.toolResult = toolResult;
              }
            });
          }
        }

        // Handle result
        if (eventContent.type === 'result') {
          const resultText = eventContent.is_error
            ? `❌ Task failed: ${eventContent.result}`
            : `✅ Task completed successfully`;

          messages.push({
            id: `result-${index}`,
            type: 'status',
            content: resultText,
            timestamp: new Date(),
          });

          if (!eventContent.is_error && eventContent.result) {
            messages.push({
              id: `result-content-${index}`,
              type: 'assistant',
              content: typeof eventContent.result === 'string' ? eventContent.result : JSON.stringify(eventContent.result, null, 2),
              timestamp: new Date(),
            });
          }
        }
      }
      // Handle status events
      else if (event.type === 'status') {
        messages.push({
          id: `status-${index}`,
          type: 'status',
          content: event.message || event.status,
          timestamp: new Date(),
        });
      }
      // Handle debug events
      else if (event.type === 'debug') {
        messages.push({
          id: `debug-${index}`,
          type: 'debug',
          content: event.message || JSON.stringify(event),
          timestamp: new Date(),
        });
      }
      // Handle error events
      else if (event.type === 'error') {
        messages.push({
          id: `error-${index}`,
          type: 'error',
          content: `❌ Error: ${event.error || event.message || JSON.stringify(event)}`,
          timestamp: new Date(),
        });
      }
      // Handle complete events
      else if (event.type === 'complete') {
        messages.push({
          id: `complete-${index}`,
          type: 'status',
          content: '✅ Agent execution completed',
          timestamp: new Date(),
        });
      }
    });

    return messages;
  };

  const messages = parseExecutionLog();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">{task.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{task.agentName}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                task.status === 'completed' ? 'bg-green-100 text-green-700' :
                task.status === 'failed' ? 'bg-red-100 text-red-700' :
                task.status === 'running' ? 'bg-blue-100 text-blue-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {task.status}
              </span>
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Task Info */}
        <div className="border-b border-border p-4 text-sm space-y-1">
          <div><span className="font-medium">Created:</span> {new Date(task.createdAt).toLocaleString()}</div>
          {task.startedAt && <div><span className="font-medium">Started:</span> {new Date(task.startedAt).toLocaleString()}</div>}
          {task.completedAt && <div><span className="font-medium">Completed:</span> {new Date(task.completedAt).toLocaleString()}</div>}
          {task.duration && <div><span className="font-medium">Duration:</span> {(task.duration / 1000).toFixed(1)}s</div>}
          <div><span className="font-medium">Permission Mode:</span> {task.permissionMode}</div>
        </div>

        {/* Execution Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No execution log available
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : message.type === 'debug'
                    ? 'bg-yellow-500/10 border border-yellow-500/20'
                    : message.type === 'status'
                    ? 'bg-blue-500/10 border border-blue-500/20'
                    : message.type === 'tool_use'
                    ? 'bg-purple-500/10 border border-purple-500/20'
                    : message.type === 'assistant'
                    ? 'bg-primary/10 border border-primary/20'
                    : 'bg-secondary'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {message.type === 'tool_use'
                      ? `🔧 ${message.toolName}`
                      : message.type}
                  </span>
                </div>

                {message.type === 'tool_use' ? (
                  <div className="text-sm space-y-2">
                    <div className="font-medium text-purple-400">Tool: {message.toolName}</div>

                    {/* Input Parameters */}
                    {message.toolInput && (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-muted-foreground hover:text-foreground">
                          📥 Input Parameters
                        </summary>
                        <pre className="mt-2 text-xs bg-black/20 p-2 rounded overflow-x-auto">
                          {JSON.stringify(message.toolInput, null, 2)}
                        </pre>
                      </details>
                    )}

                    {/* Output Result */}
                    {message.toolResult && (
                      <details
                        className="cursor-pointer"
                        open={typeof message.toolResult === 'string' && message.toolResult.length < 200}
                      >
                        <summary className="text-xs text-muted-foreground hover:text-foreground">
                          📤 Output Result
                        </summary>
                        <div className="mt-2 text-xs bg-black/20 p-2 rounded overflow-x-auto">
                          {typeof message.toolResult === 'string' ? (
                            <pre className="whitespace-pre-wrap">{message.toolResult}</pre>
                          ) : (
                            <pre>{JSON.stringify(message.toolResult, null, 2)}</pre>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex justify-end gap-2">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

TaskDetailModal.displayName = 'TaskDetailModal';

export default TasksPage;
