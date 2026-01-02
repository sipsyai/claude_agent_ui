/**
 * @file SkillTrainingChatPanel.tsx
 * @description Interactive slide-in panel for training existing skills through a conversational interface
 * with the Training Agent. This component provides a chat-based workflow powered by the useSkillTraining
 * hook, guiding users through skill improvement with real-time feedback, status tracking, and score updates.
 *
 * ## Features
 * - **Interactive Training Interface**: Conversational workflow for skill training and improvement
 * - **SSE Streaming Integration**: Real-time message streaming via useSkillTraining hook
 * - **Status Tracking**: Visual indicators for training phases (analyzing, training, evaluating, updating)
 * - **Score Progression**: Real-time experience score tracking with before/after comparison
 * - **Multi-State UI**: Dynamic UI adapting to training status (idle, training, completed, error)
 * - **Auto-Scroll**: Automatic scrolling to latest messages
 * - **Keyboard Shortcuts**: Enter to send, Shift+Enter for new line
 * - **Slide-In Animation**: Smooth right-to-left panel animation
 * - **Overlay Backdrop**: Click-outside-to-close functionality
 * - **State Persistence**: Panel state management across training lifecycle
 * - **Error Recovery**: Reset and retry functionality on failure
 *
 * ## Training Workflow
 * The component orchestrates a comprehensive skill training workflow:
 *
 * ### Workflow Steps
 * 1. **Panel Opens**: User opens panel with existing skill, displays initial state
 * 2. **Idle State**: Shows "Ready to Train" screen with skill info and Start Training button
 * 3. **User Starts**: User clicks "Start Training" button (or auto-starts via conversation)
 * 4. **Analyzing Phase**: Training Agent analyzes skill implementation and test results
 * 5. **Training Phase**: Agent executes training iterations and improvements
 * 6. **Evaluating Phase**: Agent evaluates performance and calculates new score
 * 7. **Updating Phase**: Agent updates skill files with improvements
 * 8. **Completed State**: Shows success message with score improvement (e.g., 75% → 85%)
 * 9. **Callback Invoked**: onTrainingComplete callback triggers for parent refresh
 *
 * ### Auto-Start Behavior
 * - When panel opens (`isOpen: true`) with skill, displays idle state
 * - User clicks "Start Training" button to initiate training
 * - Calls `startTraining()` which sends "__START_TRAINING__" message
 * - Training Agent begins analysis within ~1-2 seconds via SSE streaming
 * - Status updates appear automatically as training progresses
 *
 * ## Message Flow
 * The component handles bidirectional message exchange with training status integration:
 *
 * ### User Messages
 * - User types in input field (only enabled during active training, not idle/completed/error)
 * - `handleSendMessage()` called with input value
 * - Input cleared immediately (optimistic UI)
 * - Message sent to backend via `sendMessage(content)`
 * - User message appears in chat with right-aligned blue background
 * - Timestamp displayed below message (HH:MM:SS format)
 *
 * ### Assistant Messages
 * - Received via SSE streaming from useSkillTraining hook
 * - Messages array updated in real-time as chunks arrive
 * - Assistant messages appear with left-aligned muted background
 * - Content rendered as markdown using ReactMarkdown
 * - Timestamp displayed below message (HH:MM:SS format)
 * - Auto-scroll triggers on each new message
 * - Messages parsed for training status keywords and score updates
 *
 * ### System Messages
 * - Generated for status changes (analyzing, training, evaluating, updating)
 * - Color-coded based on type:
 *   - Info (blue): Status updates
 *   - Success (green): Training completed
 *   - Warning (yellow): Warnings during training
 *   - Error (red): Training failures
 * - Centered with pill-shaped background
 *
 * ### Processing Indicator
 * - When `isProcessing: true` and training active, displays animated dots
 * - Three bouncing dots with staggered animation delays (0ms, 150ms, 300ms)
 * - Input field disabled during processing
 * - Send button disabled during processing
 *
 * ## Integration with useSkillTraining
 * The component deeply integrates with the useSkillTraining hook:
 *
 * ### Hook Setup
 * ```typescript
 * const {
 *   messages,        // Conversation history
 *   trainingStatus,  // Current training phase and scores
 *   isProcessing,    // True when waiting for response
 *   error,           // Error object if training fails
 *   startTraining,   // Initiates training session
 *   sendMessage,     // Sends user message
 *   reset            // Clears state for new session
 * } = useSkillTraining({ skillId, directory, onTrainingComplete, onError });
 * ```
 *
 * ### Hook Callbacks
 * - **onTrainingComplete**: Called when training finishes successfully
 *   - Receives oldScore and newScore parameters
 *   - Triggers parent `onTrainingComplete()` callback
 *   - Hook extracts scores from training status
 *
 * - **onError**: Called when training fails
 *   - Logs error to console
 *   - Shows error UI with reset button
 *
 * ### Training Status Tracking
 * - `trainingStatus.status`: Current phase (idle, starting, analyzing, training, evaluating, updating, completed, error)
 * - `trainingStatus.currentScore`: Current skill experience score (0-100)
 * - `trainingStatus.newScore`: Updated score after training completes (0-100)
 * - `trainingStatus.issuesFound`: Optional array of issues detected during analysis
 *
 * ### State Synchronization
 * - Hook automatically updates `trainingStatus` based on backend events
 * - Component renders different UI based on status:
 *   - `idle` → "Ready to Train" screen with Start button
 *   - `starting`, `analyzing`, `training`, `evaluating`, `updating` → Chat with status indicator
 *   - `completed` → Success message with score comparison
 *   - `error` → Error message with reset and retry buttons
 *
 * ## Panel States
 * The component adapts its UI based on training status:
 *
 * ### 1. Idle State (`trainingStatus.status === 'idle'`)
 * - **Display**: "Ready to Train" screen with skill info
 * - **Behavior**: Waiting for user to start training
 * - **UI Elements**:
 *   - Sparkles icon (64px, purple)
 *   - Heading: "Ready to Train"
 *   - Description: Training workflow explanation
 *   - Start Training button (large, with Play icon)
 *   - Skill description and current experience score in header
 * - **Footer**: Centered Start Training button
 *
 * ### 2. Active Training States (`starting`, `analyzing`, `training`, `evaluating`, `updating`)
 * - **Display**: Chat interface with status indicator
 * - **Behavior**: Active conversation with status updates
 * - **UI Elements**:
 *   - Messages area: Scrollable with auto-scroll
 *   - Processing indicator: Animated dots when isProcessing
 *   - Status label: "Initializing...", "Analyzing skill...", "Executing skill...", etc.
 *   - Status icon: Spinning circle (blue) for active phases
 *   - Input field: Enabled for user interaction
 *   - Send button: Enabled when input has content and not processing
 * - **Footer**: Input field with status indicator (blue spinner + status text)
 *
 * ### 3. Completed State (`trainingStatus.status === 'completed'`)
 * - **Display**: Success banner in footer
 * - **Trigger**: Hook detects training completion with new score
 * - **UI Elements**:
 *   - Green checkmark icon
 *   - Success text: "Training completed successfully!"
 *   - Score comparison: "75% → 85% (+10%)" in header
 *   - Close button
 * - **Styling**: Green color scheme (green-600)
 *
 * ### 4. Error State (`trainingStatus.status === 'error'`)
 * - **Display**: Error banner in footer
 * - **Trigger**: Hook encounters error during training
 * - **UI Elements**:
 *   - Red exclamation icon
 *   - Error message: Error text or "Training failed"
 *   - Reset button (secondary variant)
 *   - Close button (primary variant)
 * - **Styling**: Red color scheme (red-600)
 *
 * ## Status Indicators
 * The component provides rich visual feedback for training status:
 *
 * ### Status Labels
 * - **idle**: "Ready to train"
 * - **starting**: "Initializing..."
 * - **analyzing**: "Analyzing skill..."
 * - **training**: "Executing skill..."
 * - **evaluating**: "Evaluating results..."
 * - **updating**: "Updating skill..."
 * - **completed**: "Training completed!"
 * - **error**: "Training failed"
 *
 * ### Status Icons
 * - **idle**: Purple sparkles icon (SparklesIcon)
 * - **starting/analyzing/training/evaluating/updating**: Blue spinning circle
 * - **completed**: Green checkmark (CheckCircleIcon)
 * - **error**: Red exclamation mark (ExclamationCircleIcon)
 *
 * ### Progress Bar
 * - Displays current skill experience score (0-100)
 * - Color-coded based on score:
 *   - 0-33%: Red
 *   - 34-66%: Yellow
 *   - 67-100%: Green
 * - Shows percentage label
 * - Updates in real-time as newScore changes
 *
 * ### Score Updates
 * - When newScore !== currentScore, shows comparison:
 *   - "Score updated: 75% → 85%"
 *   - Green "(+10%)" for improvements
 * - Displayed below progress bar in skill info section
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
 * - System message added for status change
 * - Processing indicator appears/disappears
 *
 * ## Keyboard Shortcuts
 * The component supports keyboard shortcuts for efficient interaction:
 *
 * ### Enter Key
 * - **Action**: Send message
 * - **Condition**: Not holding Shift key, input has content, not processing
 * - **Handler**: `handleKeyPress(e)` → `e.preventDefault()` → `handleSendMessage()`
 * - **Note**: Prevents default form submission behavior
 *
 * ### Shift+Enter
 * - **Action**: Insert new line (not functional with single-line Input component)
 * - **Condition**: Holding Shift key
 * - **Behavior**: Default browser behavior would insert newline
 * - **Note**: Currently input is single-line, so this may not function as expected
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS for theming and layout:
 *
 * ### Panel Layout
 * - **Position**: Fixed right side, full height
 * - **Width**: Full width on mobile (`w-full`), 700px on desktop (`sm:w-[700px]`)
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
 * - **Icon**: Dynamic based on status (sparkles/spinner/checkmark/exclamation)
 * - **Title**: "Training: {skill.name}" (lg semibold)
 * - **Subtitle**: Dynamic status label (sm muted)
 * - **Close Button**: X icon with hover background
 *
 * ### Skill Info Section
 * - **Border**: Bottom border separator
 * - **Background**: bg-background
 * - **Padding**: 16px all sides
 * - **Elements**:
 *   - Skill description (sm muted)
 *   - ProgressBar with current/new score
 *   - Score comparison (when newScore available)
 *
 * ### Messages
 * - **User**: Right-aligned, blue background (`bg-primary`), white text
 * - **Assistant**: Left-aligned, muted background with markdown prose
 * - **System**: Color-coded pill shape based on message type (info/success/warning/error)
 * - **Width**: Max 85% of container width for readability
 * - **Padding**: 12px horizontal, 12px vertical
 * - **Timestamp**: Small text, 70% opacity, below content
 *
 * ### Footer
 * - **Border**: Top border separator
 * - **Padding**: 16px all sides
 * - **Background**: bg-background
 * - **Dynamic Content**:
 *   - Idle: Centered Start Training button
 *   - Active: Status indicator + input field + send button
 *   - Completed: Success message + close button
 *   - Error: Error message + reset/close buttons
 */

import React, { useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XCircleIcon, SparklesIcon, CheckCircleIcon, ExclamationCircleIcon, PlayIcon } from './ui/Icons';
import ReactMarkdown from 'react-markdown';
import { useSkillTraining } from '../hooks/useSkillTraining';
import { ProgressBar } from './ui/ProgressBar';

/**
 * Skill object representing the skill being trained
 */
interface Skill {
  /** Unique skill identifier (used for API calls) */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Skill description explaining its purpose */
  description: string;
  /** Current experience score (0-100), optional */
  experienceScore?: number;
}

/**
 * Props for the SkillTrainingChatPanel component.
 *
 * @property {boolean} isOpen - Controls panel visibility and slide-in animation.
 *   When true, panel slides in from right; when false, panel slides out.
 *   Panel renders null when false for performance.
 *
 * @property {() => void} onClose - Callback invoked when panel should close.
 *   Called when user clicks overlay, close button, or completion close button.
 *   Parent should set `isOpen: false` in response to this callback.
 *
 * @property {Skill | null} skill - The skill to train, or null if no skill selected.
 *   Must have id, name, description, and optionally experienceScore.
 *   Panel renders null when skill is null.
 *
 * @property {string} [directory] - Optional directory path for training context.
 *   Passed to useSkillTraining hook for directory-specific operations.
 *   Defaults to current working directory if not provided.
 *
 * @property {() => void} [onTrainingComplete] - Optional callback invoked when training completes successfully.
 *   Called after useSkillTraining hook detects completion with new score.
 *   Parent can use this to refresh skill list or update skill details.
 *   Called with no arguments (scores available via hook).
 *
 * @example
 * // Basic usage
 * <SkillTrainingChatPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   skill={selectedSkill}
 * />
 *
 * @example
 * // With training complete callback
 * <SkillTrainingChatPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   skill={selectedSkill}
 *   onTrainingComplete={() => {
 *     refetchSkills(); // Refresh skill list
 *     setIsOpen(false); // Close panel
 *   }}
 * />
 *
 * @example
 * // With custom directory
 * <SkillTrainingChatPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   skill={selectedSkill}
 *   directory="/projects/my-app"
 *   onTrainingComplete={() => console.log('Skill trained in /projects/my-app')}
 * />
 */
interface SkillTrainingChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  skill: Skill | null;
  directory?: string;
  onTrainingComplete?: () => void;
}

/**
 * Interactive slide-in panel component for training skills through conversation with the Training Agent.
 *
 * This component provides a chat-based interface for skill training, integrating with the
 * useSkillTraining hook for SSE streaming, status tracking, and score updates. The panel slides
 * in from the right side and guides users through a training workflow with real-time progress
 * indicators and visual feedback.
 *
 * The component manages multiple UI states based on training status (idle, active training,
 * completed, error) and handles message flow, auto-scrolling, keyboard shortcuts, and score
 * tracking.
 *
 * @param {SkillTrainingChatPanelProps} props - Component props
 * @returns {React.ReactElement | null} Rendered panel or null if not open or skill is null
 *
 * @example
 * // Basic usage with skill training
 * function SkillsPage() {
 *   const [isPanelOpen, setIsPanelOpen] = useState(false);
 *   const [selectedSkill, setSelectedSkill] = useState(null);
 *
 *   return (
 *     <>
 *       <button onClick={() => {
 *         setSelectedSkill(skill);
 *         setIsPanelOpen(true);
 *       }}>
 *         Train Skill
 *       </button>
 *
 *       <SkillTrainingChatPanel
 *         isOpen={isPanelOpen}
 *         onClose={() => setIsPanelOpen(false)}
 *         skill={selectedSkill}
 *       />
 *     </>
 *   );
 * }
 *
 * @example
 * // With training complete callback to refresh list
 * function SkillsPage() {
 *   const [skills, setSkills] = useState([]);
 *   const [isPanelOpen, setIsPanelOpen] = useState(false);
 *   const [selectedSkill, setSelectedSkill] = useState(null);
 *
 *   const fetchSkills = async () => {
 *     const response = await fetch('/api/manager/skills');
 *     const data = await response.json();
 *     setSkills(data);
 *   };
 *
 *   return (
 *     <SkillTrainingChatPanel
 *       isOpen={isPanelOpen}
 *       onClose={() => setIsPanelOpen(false)}
 *       skill={selectedSkill}
 *       onTrainingComplete={() => {
 *         fetchSkills(); // Refresh the skill list with updated scores
 *         setIsPanelOpen(false); // Close the panel
 *       }}
 *     />
 *   );
 * }
 *
 * @example
 * // With custom directory for project-specific training
 * function ProjectSettings({ projectPath }) {
 *   const [showTraining, setShowTraining] = useState(false);
 *   const [skill, setSkill] = useState(null);
 *
 *   return (
 *     <SkillTrainingChatPanel
 *       isOpen={showTraining}
 *       onClose={() => setShowTraining(false)}
 *       skill={skill}
 *       directory={projectPath}
 *       onTrainingComplete={() => {
 *         console.log('Skill trained in', projectPath);
 *         setShowTraining(false);
 *       }}
 *     />
 *   );
 * }
 *
 * @example
 * // Understanding the training flow
 * // 1. User clicks "Train" button for a skill
 * // 2. Panel opens (isOpen: true) with skill data
 * // 3. Panel displays "Ready to Train" screen with skill info and progress bar
 * // 4. User clicks "Start Training" button
 * // 5. Training Agent begins analysis (status: "analyzing")
 * // 6. Agent executes training iterations (status: "training")
 * // 7. Agent evaluates results (status: "evaluating")
 * // 8. Agent updates skill files (status: "updating")
 * // 9. Training completes, score updates (75% → 85%, +10%)
 * // 10. Panel shows success banner: "Training completed successfully!"
 * // 11. User clicks "Close" button
 * // 12. onTrainingComplete() callback fires (parent refreshes skill list)
 */
const SkillTrainingChatPanel: React.FC<SkillTrainingChatPanelProps> = ({
  isOpen,
  onClose,
  skill,
  directory,
  onTrainingComplete,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState('');

  const {
    messages,
    trainingStatus,
    isProcessing,
    error,
    startTraining,
    sendMessage,
    reset
  } = useSkillTraining({
    skillId: skill?.id || '',
    directory,
    onTrainingComplete: (oldScore, newScore) => {
      console.log('[Training] Completed:', { oldScore, newScore });
      if (onTrainingComplete) {
        onTrainingComplete();
      }
    },
    onError: (err) => {
      console.error('[Training] Error:', err);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Handles closing the panel and resetting state.
   *
   * Immediately calls onClose() to trigger parent state update and slide-out animation.
   * After 300ms (matching animation duration), resets all internal state including
   * conversation messages, training status, and input value.
   *
   * @internal
   *
   * Workflow:
   * 1. Invokes onClose() callback (parent sets isOpen: false)
   * 2. Panel slides out over 300ms (CSS transition)
   * 3. After 300ms timeout:
   *    - Calls reset() from useSkillTraining hook (clears messages, errors, status, etc.)
   *    - Clears inputValue
   * 4. Panel ready for next open with clean state
   */
  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      reset();
      setInputValue('');
    }, 300);
  };

  /**
   * Handles starting the training session.
   *
   * Calls the startTraining() function from useSkillTraining hook, which:
   * - Resets messages array to empty
   * - Sets trainingStatus to 'starting' with currentScore 0
   * - Sends "__START_TRAINING__" auto-start message to Training Agent
   * - Initiates SSE streaming for training workflow
   *
   * @internal
   */
  const handleStartTraining = () => {
    startTraining();
  };

  /**
   * Handles sending a user message to the training conversation.
   *
   * This function validates the input, clears the input field (optimistic UI),
   * and sends the message via the useSkillTraining hook's sendMessage function.
   * On error, logs to console (hook handles error state updates).
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   *
   * Workflow:
   * 1. Validates input (must have content and not be processing)
   * 2. Captures input value and clears input field immediately
   * 3. Calls sendMessage() from useSkillTraining hook
   * 4. Hook handles SSE streaming and message state updates
   * 5. On error, logs to console (hook sets error state)
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    const content = inputValue;
    setInputValue('');
    try {
      await sendMessage(content);
    } catch (error) {
      console.error('[Training] Failed to send message:', error);
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
   * - Shift+Enter: Allows default behavior (new line, not functional with Input component)
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen || !skill) return null;

  /**
   * Get human-readable label for current training status.
   *
   * Maps trainingStatus.status enum values to user-friendly display strings
   * with appropriate tense and detail level.
   *
   * @internal
   * @returns {string} Display label for current status
   */
  const getStatusLabel = () => {
    switch (trainingStatus.status) {
      case 'idle':
        return 'Ready to train';
      case 'starting':
        return 'Initializing...';
      case 'analyzing':
        return 'Analyzing skill...';
      case 'training':
        return 'Executing skill...';
      case 'evaluating':
        return 'Evaluating results...';
      case 'updating':
        return 'Updating skill...';
      case 'completed':
        return 'Training completed!';
      case 'error':
        return 'Training failed';
      default:
        return 'Training...';
    }
  };

  /**
   * Get icon component for current training status.
   *
   * Returns an appropriate icon component based on the current training status,
   * providing visual feedback for different phases and outcomes.
   *
   * @internal
   * @returns {React.ReactElement} Icon component with appropriate color and animation
   *
   * Icon Mapping:
   * - **completed**: Green checkmark (CheckCircleIcon, text-green-600)
   * - **error**: Red exclamation mark (ExclamationCircleIcon, text-red-600)
   * - **isProcessing (any active phase)**: Blue spinning circle (animate-spin)
   * - **idle/default**: Purple sparkles (SparklesIcon, text-purple-600)
   */
  const getStatusIcon = () => {
    if (trainingStatus.status === 'completed') {
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
    }
    if (trainingStatus.status === 'error') {
      return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
    }
    if (isProcessing) {
      return (
        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      );
    }
    return <SparklesIcon className="h-5 w-5 text-purple-600" />;
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[700px] bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h2 className="text-lg font-semibold text-foreground">Training: {skill.name}</h2>
              <p className="text-sm text-muted-foreground">{getStatusLabel()}</p>
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

        {/* Skill Info */}
        <div className="p-4 border-b border-border bg-background">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{skill.description}</p>
            </div>
            <ProgressBar
              value={trainingStatus.newScore !== undefined ? trainingStatus.newScore : skill.experienceScore || 0}
              showLabel={true}
              size="md"
            />
            {trainingStatus.newScore !== undefined && trainingStatus.newScore !== trainingStatus.currentScore && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Score updated:</span>
                <span className="font-medium text-foreground">
                  {trainingStatus.currentScore}% → {trainingStatus.newScore}%
                </span>
                <span className="text-green-600 font-medium">
                  (+{trainingStatus.newScore - trainingStatus.currentScore}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100vh-280px)]">
          {messages.length === 0 && trainingStatus.status === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <SparklesIcon className="h-16 w-16 text-purple-300" />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Train</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  The Training Agent will analyze this skill, execute it, evaluate the results, and update the documentation and experience score.
                </p>
              </div>
              <Button onClick={handleStartTraining} size="lg" className="gap-2">
                <PlayIcon className="h-5 w-5" />
                Start Training
              </Button>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-4'
                    : message.role === 'system'
                    ? `border ${
                        message.type === 'error'
                          ? 'border-red-200 bg-red-50 text-red-900'
                          : message.type === 'success'
                          ? 'border-green-200 bg-green-50 text-green-900'
                          : message.type === 'warning'
                          ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
                          : 'border-blue-200 bg-blue-50 text-blue-900'
                      }`
                    : 'bg-muted text-foreground mr-4'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {isProcessing && messages.length > 0 && trainingStatus.status !== 'completed' && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg p-3 max-w-[85%]">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-background">
          {trainingStatus.status === 'completed' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Training completed successfully!</span>
              </div>
              <Button onClick={handleClose}>Close</Button>
            </div>
          ) : trainingStatus.status === 'error' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <ExclamationCircleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {error?.message || 'Training failed'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => reset()}>
                  Reset
                </Button>
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          ) : trainingStatus.status === 'idle' ? (
            <div className="flex justify-center">
              <Button onClick={handleStartTraining} disabled={isProcessing} size="lg" className="gap-2">
                <PlayIcon className="h-5 w-5" />
                Start Training
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600">
                <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">{getStatusLabel()}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Respond to training agent..."
                  disabled={isProcessing}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isProcessing}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

SkillTrainingChatPanel.displayName = 'SkillTrainingChatPanel';

export default SkillTrainingChatPanel;
