/**
 * @file TaskExecutionModal.tsx
 * @description Modal component for executing tasks with real-time SSE streaming and comprehensive
 * message handling including tool use visualization and progress tracking.
 *
 * ## Features
 * - Automatic task execution on mount
 * - Real-time SSE event streaming with message updates
 * - Tool use tracking with input parameters and results
 * - Execution progress tracking with status updates
 * - Auto-scrolling message list
 * - Loading and execution states
 * - Error handling with user-friendly messages
 * - Completion callback for parent component updates
 *
 * ## Task Execution Flow
 * The component follows this execution lifecycle:
 * 1. Modal opens with task details
 * 2. `executeTask` automatically triggered on mount via useEffect
 * 3. SSE stream initiated via `api.executeTask` with event callback
 * 4. Events processed in real-time and messages updated incrementally
 * 5. Tool use blocks tracked separately with unique IDs
 * 6. Tool results matched back to tool use messages via `toolUseId`
 * 7. Execution completes with success or error status
 * 8. `onComplete` callback invoked to notify parent component
 * 9. User can close modal via Close button (disabled during execution)
 *
 * ## Progress Tracking
 * The component maintains execution progress through:
 * - **isExecuting**: Boolean state indicating whether task is currently running
 * - **executionStatus**: String state showing current status (e.g., "Starting...", "Completed", "Failed")
 * - Status updates appear in header badge with color-coded background
 * - Status messages added to message list for detailed progress visibility
 *
 * ## Message Handling
 * The component processes multiple message types from SSE events:
 *
 * ### Assistant Messages
 * - Content blocks parsed from `message.content` array
 * - Text blocks displayed as assistant messages with primary styling
 * - Tool use blocks create separate tool_use messages
 * - Each tool use tracked with unique ID for result matching
 *
 * ### User Messages
 * - Tool result blocks parsed from `message.content` array
 * - Results matched back to tool use messages via `toolUseId`
 * - Updates existing tool_use message with `toolResult` property
 *
 * ### Result Messages
 * - Final execution result from task completion
 * - Success: "✅ Task completed successfully" with green indicator
 * - Failure: "❌ Task failed: {error}" with red indicator
 * - Result data displayed as assistant message (JSON or string)
 * - Sets `isExecuting` to false and updates `executionStatus`
 * - Triggers `onComplete` callback
 *
 * ### Status Messages
 * - General status updates from task execution
 * - Displayed with blue background/border
 * - Updates both message list and header status badge
 *
 * ### Error Messages
 * - Error events displayed with red styling
 * - Catches both streaming errors and execution failures
 * - Sets `isExecuting` to false and `executionStatus` to "Failed"
 * - Triggers `onComplete` callback even on error
 *
 * ### Debug Messages
 * - Debug information with yellow styling
 * - Filtered to show only important messages (e.g., STDIN-related)
 * - Useful for troubleshooting task behavior
 *
 * ### Tool Use Messages
 * - Special message type for tool executions
 * - Displays tool name with 🔧 emoji icon
 * - Collapsible sections for input parameters (📥) and output results (📤)
 * - Auto-expand short results (<200 chars)
 * - Loading state ("Waiting for result...") while waiting for tool results
 * - Purple background/border for visual distinction
 *
 * ## Result Display
 * When task execution completes successfully:
 * - Success status message added to message list
 * - Result data displayed as assistant message
 * - Handles both string and object results (JSON stringified with formatting)
 * - Header status badge updates to "Completed" with appropriate color
 * - Close button becomes enabled
 *
 * ## UI States
 *
 * ### Empty State (Initial Load)
 * - Shown briefly when execution starting but no messages yet
 * - "Task execution starting..." message
 *
 * ### Loading State
 * - Shown when `isExecuting === true` and no messages yet
 * - Animated pulse with "Starting task execution..." message
 *
 * ### Executing State
 * - Close button disabled to prevent premature closure
 * - Close button shows "Running..." text
 * - Messages appear in real-time as events arrive
 * - Status badge shows current execution status
 *
 * ### Completed State
 * - Close button re-enabled and shows "Close" text
 * - Status badge shows "Completed" or "Failed"
 * - Messages remain visible for review
 * - User can close modal
 *
 * ## Styling Behavior
 * - Modal overlay with dark semi-transparent backdrop (bg-black/50)
 * - Centered modal dialog with max width 4xl and max height 90vh
 * - Three-section layout: header (with task name, agent, status), messages (scrollable), footer
 * - Message styling varies by type:
 *   - Error: red background/border (bg-red-500/10, border-red-500/20)
 *   - Debug: yellow background/border (bg-yellow-500/10, border-yellow-500/20)
 *   - Status: blue background/border (bg-blue-500/10, border-blue-500/20)
 *   - Tool use: purple background/border (bg-purple-500/10, border-purple-500/20)
 *   - Assistant: primary background/border (bg-primary/10, border-primary/20)
 *   - Default: secondary background (bg-secondary)
 * - Auto-scroll to bottom on new messages with smooth behavior
 * - Tool use sections with collapsible details elements
 * - Status badge in header with blue background (bg-blue-100, dark:bg-blue-900)
 *
 * @example
 * ```tsx
 * // Basic usage with task execution
 * const [selectedTask, setSelectedTask] = useState<Task | null>(null);
 * const [isModalOpen, setIsModalOpen] = useState(false);
 *
 * const handleTaskComplete = () => {
 *   // Refresh task list or update UI
 *   fetchTasks();
 * };
 *
 * <TaskExecutionModal
 *   task={selectedTask}
 *   onClose={() => setIsModalOpen(false)}
 *   onComplete={handleTaskComplete}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Execute task from list with automatic cleanup
 * const handleExecuteTask = (task: Task) => {
 *   setSelectedTask(task);
 *   setModalOpen(true);
 * };
 *
 * <TaskExecutionModal
 *   task={selectedTask}
 *   onClose={() => {
 *     setModalOpen(false);
 *     setSelectedTask(null);
 *   }}
 *   onComplete={() => {
 *     // Optionally close modal on completion
 *     // setModalOpen(false);
 *     // Or keep it open for user to review results
 *     refreshTaskList();
 *   }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Understanding tool use message flow
 * // 1. Assistant message arrives with tool_use block:
 * //    { type: 'tool_use', toolName: 'read_file', toolInput: { path: 'config.json' } }
 * //
 * // 2. Message displayed with "Waiting for result..." loading state
 * //
 * // 3. User message arrives with tool_result block:
 * //    { tool_use_id: 'toolu_123', content: '{"key": "value"}' }
 * //
 * // 4. Existing tool_use message updated with toolResult property
 * //    Message now shows both input and output in collapsible sections
 * ```
 *
 * @example
 * ```tsx
 * // Navigate to task details after completion
 * const navigate = useNavigate();
 *
 * <TaskExecutionModal
 *   task={selectedTask}
 *   onClose={() => setModalOpen(false)}
 *   onComplete={() => {
 *     // Navigate to task details page to view full results
 *     navigate(`/tasks/${selectedTask.id}`);
 *   }}
 * />
 * ```
 */
import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';
import { Button } from './ui/Button';
import { XCircleIcon } from './ui/Icons';

/**
 * Props for the TaskExecutionModal component.
 *
 * @property {api.Task} task - The task object to execute, containing id, name, and agentName
 * @property {() => void} onClose - Callback invoked when user clicks close button (disabled during execution)
 * @property {() => void} onComplete - Callback invoked when task execution completes (success or failure)
 */
interface TaskExecutionModalProps {
  task: api.Task;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Message object representing a single message in the execution stream.
 *
 * @property {string} id - Unique identifier for the message
 * @property {'status' | 'assistant' | 'user' | 'result' | 'error' | 'debug' | 'tool_use'} type - Message type determines styling and display
 * @property {string} content - Text content of the message
 * @property {Date} timestamp - Timestamp when message was created
 * @property {string} [toolName] - Name of the tool (only for tool_use messages)
 * @property {any} [toolInput] - Input parameters for the tool (only for tool_use messages)
 * @property {any} [toolResult] - Result from tool execution, added when result arrives (only for tool_use messages)
 * @property {string} [toolUseId] - Unique ID for matching tool use with its result (only for tool_use messages)
 */
interface Message {
  id: string;
  type: 'status' | 'assistant' | 'user' | 'result' | 'error' | 'debug' | 'tool_use';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolInput?: any;
  toolResult?: any; // Added to tool_use messages when result arrives
  toolUseId?: string;
}

/**
 * TaskExecutionModal component for executing tasks with real-time progress tracking.
 *
 * Automatically executes the task on mount and streams execution events via SSE.
 * Messages are processed in real-time and displayed in a scrollable list with
 * color-coded styling based on message type.
 *
 * @param {TaskExecutionModalProps} props - Component props
 * @returns {JSX.Element} Modal with task execution interface
 */
const TaskExecutionModal: React.FC<TaskExecutionModalProps> = ({ task, onClose, onComplete }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isExecuting, setIsExecuting] = useState(true);
  const [executionStatus, setExecutionStatus] = useState<string>('Starting...');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const executionStartedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (executionStartedRef.current) return;
    executionStartedRef.current = true;

    // Start execution
    executeTask();
  }, []);

  /**
   * Executes the task via SSE streaming API and processes events in real-time.
   *
   * This function handles the complete task execution workflow:
   * 1. Clears existing messages and resets state
   * 2. Calls `api.executeTask` with task ID and event callback
   * 3. Processes SSE events as they arrive:
   *    - **message events**: Parse content blocks from assistant/user messages
   *      - Assistant messages: Extract text blocks and tool_use blocks
   *      - User messages: Extract tool_result blocks and match to tool uses
   *      - Result messages: Display final result and update status
   *    - **status events**: Update execution status and add status messages
   *    - **debug events**: Add filtered debug messages (STDIN-related only)
   *    - **error events**: Display error messages and mark execution as failed
   * 4. Updates message state incrementally for real-time display
   * 5. Matches tool results back to tool use messages via `toolUseId`
   * 6. Sets final execution status and invokes `onComplete` callback
   * 7. Catches and displays any errors during execution
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   */
  const executeTask = async () => {
    setIsExecuting(true);
    setMessages([]);

    try {
      await api.executeTask(task.id, (event) => {
        // Handle assistant messages (contains tool_use blocks)
        if (event.type === 'message' && event.content) {
          const eventContent = event.content;

          // Handle assistant messages
          if (eventContent.type === 'assistant' && eventContent.message) {
            const message = eventContent.message;
            if (message.content && Array.isArray(message.content)) {
              const blocks = message.content;

              // Process text blocks for assistant message
              const textContent = blocks
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text)
                .join('\n');

              if (textContent) {
                setMessages((prev) => [...prev, {
                  id: `${Date.now()}-${Math.random()}`,
                  type: 'assistant',
                  content: textContent,
                  timestamp: new Date(),
                }]);
              }

              // Process tool_use blocks separately
              const toolUseBlocks = blocks.filter((block: any) => block.type === 'tool_use');
              toolUseBlocks.forEach((toolBlock: any) => {
                setMessages((prev) => [...prev, {
                  id: `tool-use-${toolBlock.id}`,
                  type: 'tool_use',
                  content: '',
                  timestamp: new Date(),
                  toolName: toolBlock.name,
                  toolInput: toolBlock.input,
                  toolUseId: toolBlock.id,
                }]);
              });
            }
            return;
          }

          // Handle user messages (contains tool_result blocks)
          if (eventContent.type === 'user' && eventContent.message) {
            const message = eventContent.message;
            if (message.content && Array.isArray(message.content)) {
              const blocks = message.content;

              // Process tool_result blocks
              const toolResultBlocks = blocks.filter((block: any) => block.type === 'tool_result');
              toolResultBlocks.forEach((resultBlock: any) => {
                const toolUseId = resultBlock.tool_use_id;
                const toolResult = resultBlock.content;

                // Find and update the corresponding tool_use message
                setMessages((prev) => prev.map(msg =>
                  msg.toolUseId === toolUseId
                    ? { ...msg, toolResult }
                    : msg
                ));
              });
            }
            return;
          }

          // Handle result
          if (eventContent.type === 'result') {
            const resultText = eventContent.is_error
              ? `❌ Task failed: ${eventContent.result}`
              : `✅ Task completed successfully`;

            setMessages((prev) => [...prev, {
              id: `${Date.now()}-${Math.random()}`,
              type: 'status',
              content: resultText,
              timestamp: new Date(),
            }]);

            if (!eventContent.is_error && eventContent.result) {
              setMessages((prev) => [...prev, {
                id: `${Date.now()}-${Math.random()}`,
                type: 'assistant',
                content: typeof eventContent.result === 'string' ? eventContent.result : JSON.stringify(eventContent.result, null, 2),
                timestamp: new Date(),
              }]);
            }

            setIsExecuting(false);
            setExecutionStatus(eventContent.is_error ? 'Failed' : 'Completed');
            onComplete();
            return;
          }
        }

        // Handle other event types
        if (event.type === 'status') {
          setExecutionStatus(event.message || event.status);
          setMessages((prev) => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            type: 'status',
            content: event.message || event.status,
            timestamp: new Date(),
          }]);
        } else if (event.type === 'debug') {
          // Only show important debug messages
          if (event.message && event.message.includes('STDIN')) {
            setMessages((prev) => [...prev, {
              id: `${Date.now()}-${Math.random()}`,
              type: 'debug',
              content: event.message,
              timestamp: new Date(),
            }]);
          }
        } else if (event.type === 'error') {
          setMessages((prev) => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            type: 'error',
            content: `❌ Error: ${event.error}`,
            timestamp: new Date(),
          }]);
          setIsExecuting(false);
          setExecutionStatus('Failed');
          onComplete();
        }
      });
    } catch (error: any) {
      setMessages((prev) => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        type: 'error',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date(),
      }]);
      setIsExecuting(false);
      setExecutionStatus('Failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">Execute Task: {task.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{task.agentName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {executionStatus}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            disabled={isExecuting}
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !isExecuting && (
            <div className="text-center text-muted-foreground py-12">
              Task execution starting...
            </div>
          )}

          {messages.map((message) => (
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
                <span className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
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

                  {/* Output Result - only show if available */}
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

                  {/* Show loading state if no result yet */}
                  {!message.toolResult && (
                    <div className="text-xs text-muted-foreground italic">
                      Waiting for result...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              )}
            </div>
          ))}

          {isExecuting && messages.length === 0 && (
            <div className="text-center text-muted-foreground py-6">
              <div className="animate-pulse">Starting task execution...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isExecuting}>
            {isExecuting ? 'Running...' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  );
};

TaskExecutionModal.displayName = 'TaskExecutionModal';

export default TaskExecutionModal;
