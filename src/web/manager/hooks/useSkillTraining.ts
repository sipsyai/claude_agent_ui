/**
 * useSkillTraining Hook
 *
 * A custom React hook for managing interactive skill training with the Training Agent through
 * a conversational interface. This hook orchestrates the complete training workflow including
 * SSE streaming, message handling, status tracking, and score updates.
 *
 * ## Features
 * - **Conversational Training Workflow**: Interactive chat-based training for existing skills
 * - **SSE Streaming**: Real-time message streaming from Claude API using Server-Sent Events
 * - **State Management**: Comprehensive tracking of conversation, processing, training status, and error states
 * - **Status Transitions**: Automatic detection of training phases (analyzing, training, evaluating, updating)
 * - **Score Tracking**: Monitors skill experience score changes from old to new values
 * - **Progress Detection**: Parses assistant messages for training progress indicators
 * - **Authentication**: Automatic token-based authentication with cookie management
 * - **Error Handling**: Robust error handling with optional error callbacks
 * - **Session Management**: Complete conversation lifecycle with reset functionality
 * - **Ref-based Updates**: Uses refs to avoid closure issues with async streaming
 *
 * ## State Management
 * The hook manages the following state:
 *
 * ### Message State
 * - `messages`: Array of conversation messages (user, assistant, system)
 * - Each message includes id, role, content, timestamp, and optional type (info, success, warning, error)
 * - Messages are updated in real-time as SSE events arrive
 * - System messages indicate training status changes
 *
 * ### Processing State
 * - `isProcessing`: True when waiting for/receiving assistant response
 * - Indicates active network request and stream reading
 * - Automatically set to false when stream completes or errors
 *
 * ### Training Status State
 * - `trainingStatus`: Object tracking current training phase and scores
 * - `status`: Current phase in training workflow (idle, starting, analyzing, training, evaluating, updating, completed, error)
 * - `currentScore`: Skill's current experience score (0-100)
 * - `newScore`: Updated experience score after training completes
 * - `issuesFound`: Array of issues detected during analysis (optional)
 *
 * ### Error State
 * - `error`: Error object if any operation fails
 * - Triggers onError callback when set
 * - Can be cleared with reset()
 *
 * ## Training Workflow
 * The training process follows these phases:
 *
 * 1. **idle**: Initial state before training starts
 * 2. **starting**: Training session initiated, sending initial request
 * 3. **analyzing**: Training Agent analyzing skill implementation and test results
 * 4. **training**: Agent executing training iterations and improvements
 * 5. **evaluating**: Agent evaluating skill performance and calculating new score
 * 6. **updating**: Agent updating skill files with improvements
 * 7. **completed**: Training finished, new score available
 * 8. **error**: Training failed with error message
 *
 * ## State Transitions
 * Status transitions are detected through multiple mechanisms:
 *
 * ### Explicit Status Events
 * - Backend sends `type: 'status'` events with status field
 * - Hook updates trainingStatus.status when received
 * - System messages added to conversation for each status change
 *
 * ### Content Parsing
 * - Assistant messages analyzed for keywords: "Analyzing", "Training", "Evaluating", "Updating"
 * - Status automatically updated based on detected keywords
 * - Provides fallback when explicit status events aren't sent
 *
 * ### Score Extraction
 * - Pattern matching on assistant messages: `Experience: {old}% → {new}%`
 * - Extracts old and new scores from content
 * - Updates trainingStatus.currentScore and newScore
 *
 * ## SSE Streaming Handling
 * The hook implements a robust SSE streaming mechanism:
 *
 * ### Stream Lifecycle
 * 1. **Initiate**: POST to `/api/manager/skills/{skillId}/train/message`
 * 2. **Read**: Obtain ReadableStream reader and decode chunks
 * 3. **Parse**: Split by newlines, extract `data: ` prefixed JSON
 * 4. **Handle**: Process each event type (message, status, complete, error)
 * 5. **Cleanup**: Release reader lock when stream completes or errors
 *
 * ### Event Types
 * - **message (assistant)**: Extract text blocks from content array, parse for training progress
 * - **message (result)**: Final query completion indicator
 * - **status**: Update training status and add system message
 * - **complete**: Mark processing as finished
 * - **error**: Set error state and invoke error callback
 *
 * ### Event Handling
 * - Status events include status string, currentScore, and optional message
 * - Assistant messages parsed for text content and training keywords
 * - Completion triggers onTrainingComplete callback with old and new scores
 *
 * ### Stream Cancellation
 * - Reader reference stored in `streamReaderRef` for cleanup
 * - Automatically cancelled on component unmount or reset()
 * - Prevents memory leaks and dangling streams
 *
 * ## Lifecycle
 * The typical usage flow:
 *
 * 1. **Initialize**: Call useSkillTraining() with skillId and options
 * 2. **Start**: Call startTraining() to begin with auto-start message
 * 3. **Monitor**: Watch trainingStatus for phase transitions
 * 4. **Stream**: Hook processes SSE events, updates messages and status
 * 5. **Converse** (optional): User can sendMessage() to interact with agent
 * 6. **Complete**: Hook detects completion, updates scores, invokes callback
 * 7. **Reset** (optional): Call reset() to clear state and start over
 *
 * ## Authentication
 * The hook automatically handles authentication:
 * - Reads `cui-auth-token` cookie from document.cookie
 * - Adds `Authorization: Bearer {token}` header to all requests
 * - Token extraction and header injection via helper functions
 *
 * @example
 * // Basic usage with training completion detection
 * function SkillTrainingPanel({ skillId }: { skillId: string }) {
 *   const {
 *     messages,
 *     trainingStatus,
 *     isProcessing,
 *     error,
 *     startTraining,
 *     sendMessage,
 *     reset
 *   } = useSkillTraining({
 *     skillId,
 *     directory: '/path/to/project',
 *     onTrainingComplete: (oldScore, newScore) => {
 *       console.log(`Training complete! ${oldScore}% → ${newScore}%`);
 *       toast.success(`Skill improved from ${oldScore}% to ${newScore}%`);
 *     },
 *     onError: (err) => {
 *       console.error('Training failed:', err);
 *       toast.error(err.message);
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       {trainingStatus.status === 'idle' && (
 *         <button onClick={startTraining} disabled={isProcessing}>
 *           Start Training
 *         </button>
 *       )}
 *       <div className="status">
 *         Status: {trainingStatus.status}
 *         {trainingStatus.currentScore > 0 && ` (${trainingStatus.currentScore}%)`}
 *       </div>
 *       {messages.map(msg => (
 *         <div key={msg.id} className={msg.type}>
 *           {msg.role}: {msg.content}
 *         </div>
 *       ))}
 *       {error && <p className="error">{error.message}</p>}
 *     </div>
 *   );
 * }
 *
 * @example
 * // With custom directory and score tracking
 * const { trainingStatus, startTraining } = useSkillTraining({
 *   skillId: 'my-skill',
 *   directory: process.env.PROJECT_ROOT,
 *   onTrainingComplete: (oldScore, newScore) => {
 *     const improvement = newScore - oldScore;
 *     if (improvement > 0) {
 *       toast.success(`Improved by ${improvement} points!`);
 *     } else if (improvement < 0) {
 *       toast.warning(`Score decreased by ${Math.abs(improvement)} points`);
 *     } else {
 *       toast.info('No score change');
 *     }
 *     refreshSkillList();
 *   },
 *   onError: (error) => {
 *     logger.error('Training error:', error);
 *     toast.error(`Training failed: ${error.message}`);
 *   }
 * });
 *
 * @example
 * // Handling user interaction during training
 * function InteractiveTrainingPanel() {
 *   const [input, setInput] = useState('');
 *   const { messages, isProcessing, trainingStatus, sendMessage } = useSkillTraining({
 *     skillId: 'data-validator'
 *   });
 *
 *   const handleSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault();
 *     if (!input.trim() || isProcessing) return;
 *
 *     await sendMessage(input);
 *     setInput('');
 *   };
 *
 *   return (
 *     <div>
 *       <h3>Training: {trainingStatus.status}</h3>
 *       {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
 *       <form onSubmit={handleSubmit}>
 *         <input
 *           value={input}
 *           onChange={(e) => setInput(e.target.value)}
 *           disabled={isProcessing}
 *           placeholder="Send message to training agent..."
 *         />
 *         <button type="submit" disabled={isProcessing || !input.trim()}>
 *           Send
 *         </button>
 *       </form>
 *     </div>
 *   );
 * }
 *
 * @example
 * // Reset after training completes
 * function TrainingWorkflow() {
 *   const { trainingStatus, reset, startTraining } = useSkillTraining({
 *     skillId: 'my-skill',
 *     onTrainingComplete: (oldScore, newScore) => {
 *       setTimeout(() => {
 *         if (confirm(`Training complete! ${oldScore}% → ${newScore}%. Train again?`)) {
 *           reset();
 *           startTraining();
 *         }
 *       }, 2000);
 *     }
 *   });
 *
 *   // ... render UI
 * }
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = '/api/manager';

/**
 * Message object representing a single message in the training conversation
 */
interface Message {
  /** Unique message identifier (format: `msg-{timestamp}-{role}`) */
  id: string;
  /** Message author role */
  role: 'user' | 'assistant' | 'system';
  /** Message text content */
  content: string;
  /** Message creation timestamp */
  timestamp: Date;
  /** Optional message type for system messages (info, success, warning, error) */
  type?: 'info' | 'success' | 'warning' | 'error';
}

/**
 * Training status object tracking the current training phase and scores
 */
interface TrainingStatus {
  /**
   * Current training phase
   * - `idle`: Not started
   * - `starting`: Initiating training session
   * - `analyzing`: Analyzing skill implementation and test results
   * - `training`: Executing training iterations
   * - `evaluating`: Evaluating performance and calculating score
   * - `updating`: Updating skill files with improvements
   * - `completed`: Training finished successfully
   * - `error`: Training failed
   */
  status: 'idle' | 'starting' | 'analyzing' | 'training' | 'evaluating' | 'updating' | 'completed' | 'error';

  /** Current skill experience score (0-100) */
  currentScore: number;

  /** New skill experience score after training (set when completed) */
  newScore?: number;

  /** Array of issues found during analysis (optional) */
  issuesFound?: string[];
}

/**
 * Configuration options for useSkillTraining hook
 */
interface UseSkillTrainingOptions {
  /**
   * ID of the skill to train
   * Used to construct API endpoint `/api/manager/skills/{skillId}/train/message`
   *
   * @example 'data-validator'
   * @example 'pdf-processor'
   */
  skillId: string;

  /**
   * Project directory path where skill is located
   * Passed to the API to determine where to find skill files
   *
   * @example '/path/to/my/project'
   */
  directory?: string;

  /**
   * Callback invoked when training completes successfully
   *
   * @param oldScore - Skill's experience score before training (0-100)
   * @param newScore - Skill's experience score after training (0-100)
   *
   * @example
   * onTrainingComplete: (oldScore, newScore) => {
   *   console.log(`Training improved skill from ${oldScore}% to ${newScore}%`);
   *   refreshSkillList();
   * }
   */
  onTrainingComplete?: (oldScore: number, newScore: number) => void;

  /**
   * Callback invoked when any error occurs during training
   *
   * @param error - Error object with message and stack trace
   *
   * @example
   * onError: (err) => {
   *   toast.error(`Training failed: ${err.message}`);
   * }
   */
  onError?: (error: Error) => void;
}

/**
 * Return value interface for useSkillTraining hook
 */
interface UseSkillTrainingReturn {
  /**
   * Array of conversation messages in chronological order
   * Includes user messages (sent via sendMessage), assistant messages (from Training Agent),
   * and system messages (status updates)
   */
  messages: Message[];

  /**
   * Current training status including phase and scores
   * - `status`: Current training phase (idle, starting, analyzing, training, evaluating, updating, completed, error)
   * - `currentScore`: Current skill experience score
   * - `newScore`: New score after training (only set when completed)
   * - `issuesFound`: Issues detected during analysis (optional)
   */
  trainingStatus: TrainingStatus;

  /**
   * True when waiting for assistant response or processing stream
   * Use to disable input, show loading indicators, or prevent duplicate sends
   */
  isProcessing: boolean;

  /**
   * Error object if any operation failed, or null if no errors
   * Set when network requests fail, stream parsing fails, or API returns error
   * Triggers onError callback when set
   */
  error: Error | null;

  /**
   * Start a new training session
   * Resets state and sends auto-start message "__START_TRAINING__" to begin workflow
   *
   * @returns Promise that resolves when initial message is sent and stream processed
   *
   * @example
   * <button onClick={startTraining} disabled={isProcessing}>
   *   Start Training
   * </button>
   */
  startTraining: () => Promise<void>;

  /**
   * Send a user message in the ongoing training conversation
   * Appends message to conversation history and streams Training Agent's response
   *
   * @param content - User message text content
   * @returns Promise that resolves when message is sent and stream processed
   *
   * @example
   * await sendMessage('Focus on improving error handling');
   *
   * @example
   * // With form submission
   * const handleSubmit = async (e) => {
   *   e.preventDefault();
   *   await sendMessage(userInput);
   *   setUserInput('');
   * };
   */
  sendMessage: (content: string) => Promise<void>;

  /**
   * Reset all training state and cancel any active streams
   * Clears messages, errors, training status, and cancels ongoing SSE stream
   * Use when starting over or when component unmounts
   *
   * @example
   * // Reset after training completes
   * if (trainingStatus.status === 'completed') {
   *   setTimeout(() => reset(), 2000);
   * }
   *
   * @example
   * // Cleanup on unmount
   * useEffect(() => {
   *   return () => reset();
   * }, [reset]);
   */
  reset: () => void;
}

/**
 * Get auth token from cookie
 *
 * Extracts the authentication token from the browser's cookies by looking for
 * the `cui-auth-token` cookie. This token is used for authenticating API requests.
 *
 * @returns The decoded auth token string, or null if not found
 *
 * @internal
 */
function getAuthToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'cui-auth-token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Create fetch options with auth header
 *
 * Enhances standard fetch options by automatically adding the Authorization header
 * with the bearer token from cookies. Merges with any existing headers provided.
 *
 * @param options - Standard fetch RequestInit options (method, headers, body, etc.)
 * @returns Enhanced RequestInit with Authorization header if token is available
 *
 * @internal
 */
function createFetchOptions(options: RequestInit = {}): RequestInit {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    ...options,
    headers,
  };
}

export function useSkillTraining(options: UseSkillTrainingOptions): UseSkillTrainingReturn {
  const { skillId, directory, onTrainingComplete, onError } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>({
    status: 'idle',
    currentScore: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the current stream
  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track conversation history
  const messagesRef = useRef<Message[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * Handle stream events from training endpoint
   *
   * Processes SSE events from the skill training stream. Handles multiple event types:
   * - **status**: Updates training status, adds system message, checks for completion
   * - **message (assistant)**: Extracts text blocks, parses for training keywords and score updates
   * - **message (result)**: Marks query as completed
   * - **complete**: Marks processing as finished
   * - **error**: Sets error state and invokes error callback
   *
   * Special handling for status events:
   * - Updates trainingStatus with status, currentScore from backend
   * - Adds system message with status text
   * - When status is 'completed', triggers onTrainingComplete callback with scores
   *
   * Special handling for assistant messages:
   * - Parses content for keywords: "Analyzing", "Training", "Evaluating", "Updating"
   * - Updates status based on detected keywords (fallback when explicit status not sent)
   * - Extracts score updates with pattern `Experience: {old}% → {new}%`
   * - Updates currentScore and newScore when pattern found
   *
   * @param data - Parsed SSE event data object
   *
   * @internal
   */
  const handleStreamEvent = useCallback((data: any) => {
    console.log('[SkillTraining] Stream event:', data);

    if (data.type === 'status') {
      // Update training status
      setTrainingStatus((prev) => ({
        ...prev,
        status: data.status,
        currentScore: data.currentScore !== undefined ? data.currentScore : prev.currentScore,
      }));

      // Add status message
      const statusMessage: Message = {
        id: `msg-${Date.now()}-status`,
        role: 'system',
        content: data.message || `Status: ${data.status}`,
        timestamp: new Date(),
        type: 'info',
      };
      setMessages((prev) => [...prev, statusMessage]);

      // Check if completed
      if (data.status === 'completed') {
        setIsProcessing(false);
        if (onTrainingComplete && data.newScore !== undefined) {
          onTrainingComplete(data.currentScore || 0, data.newScore);
        }
      }
    } else if (data.type === 'message' && data.messageType === 'assistant') {
      // Assistant message from SDK
      const content = data.content?.message?.content;

      if (content && Array.isArray(content)) {
        const textBlocks = content.filter((block: any) => block.type === 'text');
        if (textBlocks.length > 0) {
          const textContent = textBlocks.map((block: any) => block.text).join('\n');

          const assistantMessage: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: textContent,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // Parse content for training progress indicators
          if (textContent.includes('Analyzing') || textContent.includes('Analysis')) {
            setTrainingStatus((prev) => ({ ...prev, status: 'analyzing' }));
          } else if (textContent.includes('Executing') || textContent.includes('Training')) {
            setTrainingStatus((prev) => ({ ...prev, status: 'training' }));
          } else if (textContent.includes('Evaluating') || textContent.includes('Evaluation')) {
            setTrainingStatus((prev) => ({ ...prev, status: 'evaluating' }));
          } else if (textContent.includes('Updating') || textContent.includes('Update')) {
            setTrainingStatus((prev) => ({ ...prev, status: 'updating' }));
          }

          // Extract score updates from content
          const scoreMatch = textContent.match(/Experience:\s*(\d+)%\s*→\s*(\d+)%/);
          if (scoreMatch) {
            const oldScore = parseInt(scoreMatch[1], 10);
            const newScore = parseInt(scoreMatch[2], 10);
            setTrainingStatus((prev) => ({
              ...prev,
              currentScore: oldScore,
              newScore: newScore,
            }));
          }
        }
      }
    } else if (data.type === 'message' && data.messageType === 'result') {
      // Final result message
      console.log('[SkillTraining] Query completed');
      setIsProcessing(false);
    } else if (data.type === 'complete') {
      setIsProcessing(false);
    } else if (data.type === 'error') {
      // Error message
      const err = new Error(data.message || 'Training failed');
      setError(err);
      setTrainingStatus((prev) => ({ ...prev, status: 'error' }));
      setIsProcessing(false);

      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'system',
        content: data.message || 'Training failed',
        timestamp: new Date(),
        type: 'error',
      };
      setMessages((prev) => [...prev, errorMessage]);

      if (onError) {
        onError(err);
      }
    }
  }, [onTrainingComplete, onError]);

  /**
   * Send a message in the training conversation
   *
   * Internal implementation that handles the full message send workflow including
   * adding user message to state, building conversation history, sending POST request,
   * and processing the SSE response stream.
   *
   * Workflow:
   * 1. Sets isProcessing to true and clears any previous errors
   * 2. Creates user message object and adds to messages state
   * 3. Builds conversation history from current + new message
   * 4. POSTs to `/api/manager/skills/{skillId}/train/message` with history
   * 5. Reads SSE stream and processes events via handleStreamEvent
   * 6. Cleans up reader when stream completes
   * 7. Sets isProcessing to false
   *
   * @param content - User message text content
   * @param currentMessages - Current message array (passed to avoid closure issues)
   * @returns Promise that resolves when stream completes
   *
   * @internal
   */
  const sendMessageInternal = useCallback(async (content: string, currentMessages: Message[]) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Add user message immediately
      const userMessage: Message = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      // Build conversation history (current messages + new user message)
      const conversationHistory = [...currentMessages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      setMessages((prev) => [...prev, userMessage]);

      // NEW ENDPOINT: /train/message
      const url = new URL(`${API_BASE}/skills/${skillId}/train/message`, window.location.origin);

      const response = await fetch(url.toString(), createFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory,
          conversationHistory
        }),
      }));

      if (!response.ok) {
        throw new Error('Failed to send training message');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      streamReaderRef.current = reader;
      const decoder = new TextDecoder();

      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                handleStreamEvent(data);
              } catch (e) {
                console.error('[SkillTraining] Failed to parse SSE data:', e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        streamReaderRef.current = null;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsProcessing(false);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [skillId, directory, handleStreamEvent, onError]);

  /**
   * Public API: Send a message in the training conversation
   *
   * Uses messagesRef to get current messages without closure issues, then
   * delegates to sendMessageInternal for the actual send operation.
   *
   * @param content - User message text content
   * @returns Promise that resolves when message is sent and stream processed
   */
  const sendMessage = useCallback(async (content: string) => {
    // Use messagesRef to get current messages without closure issues
    const currentMessages = messagesRef.current;
    await sendMessageInternal(content, currentMessages);
  }, [sendMessageInternal]);

  /**
   * Start training session (sends initial message)
   *
   * Initiates the skill training workflow by:
   * 1. Clearing any previous messages
   * 2. Setting trainingStatus to 'starting' with currentScore 0
   * 3. Sending the auto-start message "__START_TRAINING__" to begin the workflow
   *
   * The Training Agent recognizes this special message and begins the training process
   * without requiring user input. The agent will analyze the skill, run tests, identify
   * improvements, and update skill files automatically.
   *
   * @returns Promise that resolves when initial message is sent and stream processed
   */
  const startTraining = useCallback(async () => {
    // Reset state
    setMessages([]);
    setTrainingStatus({
      status: 'starting',
      currentScore: 0,
    });

    // Send auto-start message
    await sendMessageInternal('__START_TRAINING__', []);
  }, [sendMessageInternal]);

  /**
   * Reset training state
   *
   * Cancels any ongoing SSE stream, clears all conversation state including messages,
   * processing flags, training status, and errors. Also aborts any pending fetch requests.
   * Safe to call at any time, even if no training session is active.
   *
   * @returns void
   */
  const reset = useCallback(() => {
    // Cancel ongoing stream
    if (streamReaderRef.current) {
      streamReaderRef.current.cancel();
      streamReaderRef.current = null;
    }

    // Abort fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setMessages([]);
    setTrainingStatus({
      status: 'idle',
      currentScore: 0,
    });
    setIsProcessing(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamReaderRef.current) {
        streamReaderRef.current.cancel();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    trainingStatus,
    isProcessing,
    error,
    startTraining,
    sendMessage,
    reset,
  };
}
