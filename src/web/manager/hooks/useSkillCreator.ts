/**
 * useSkillCreator Hook
 *
 * A custom React hook for managing interactive skill creation with Claude Manager through
 * a conversational interface. This hook orchestrates the complete skill creation workflow
 * including SSE streaming, message handling, and state management.
 *
 * ## Features
 * - **Conversational Skill Creation**: Interactive chat-based workflow for creating new skills
 * - **SSE Streaming**: Real-time message streaming from Claude API using Server-Sent Events
 * - **State Management**: Comprehensive tracking of conversation, processing, creation, and error states
 * - **Tool Use Detection**: Automatically detects when Claude writes skill files via Write tool
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
 * - Each message includes id, role, content, and timestamp
 * - Messages are updated in real-time as SSE events arrive
 *
 * ### Processing State
 * - `isProcessing`: True when waiting for/receiving assistant response
 * - Indicates active network request and stream reading
 * - Automatically set to false when stream completes or errors
 *
 * ### Creation State
 * - `isCreating`: True when Claude is actively writing the skill file
 * - Set when status events indicate "Creating" or "Writing"
 * - Set to false when Write tool completes
 *
 * ### Result State
 * - `createdSkillName`: Name of successfully created skill (extracted from file path)
 * - Extracted from Write tool's file_path matching pattern `.claude/skills/{name}/SKILL.md`
 * - Used to trigger onSkillCreated callback
 *
 * ### Error State
 * - `error`: Error object if any operation fails
 * - Triggers onError callback when set
 * - Can be cleared with reset()
 *
 * ## SSE Streaming Handling
 * The hook implements a robust SSE streaming mechanism:
 *
 * ### Stream Lifecycle
 * 1. **Initiate**: POST to `/api/manager/skills/create-with-claude/message`
 * 2. **Read**: Obtain ReadableStream reader and decode chunks
 * 3. **Parse**: Split by newlines, extract `data: ` prefixed JSON
 * 4. **Handle**: Process each event type (message, status, complete, error)
 * 5. **Cleanup**: Release reader lock when stream completes or errors
 *
 * ### Event Types
 * - **message (assistant)**: Extract text blocks and tool uses from content array
 * - **message (result)**: Final query completion indicator
 * - **status**: Check for "Creating"/"Writing" keywords to update isCreating
 * - **complete**: Mark processing as finished
 * - **error**: Set error state and invoke error callback
 *
 * ### Tool Use Detection
 * When an assistant message contains tool_use blocks:
 * - Filters content array for `type: 'tool_use'` blocks
 * - Checks if `name === 'Write'` (file write operation)
 * - Extracts `file_path` from tool input
 * - Matches against `.claude/skills/{name}/SKILL.md` pattern
 * - Extracts skill name and triggers onSkillCreated callback
 *
 * ### Stream Cancellation
 * - Reader reference stored in `streamReaderRef` for cleanup
 * - Automatically cancelled on component unmount or reset()
 * - Prevents memory leaks and dangling streams
 *
 * ## Lifecycle
 * The typical usage flow:
 *
 * 1. **Initialize**: Call useSkillCreator() with options
 * 2. **Start**: Call startConversation() to begin with initial message
 * 3. **Converse**: User calls sendMessage() with responses to Claude's questions
 * 4. **Stream**: Hook processes SSE events, updates messages state
 * 5. **Detect**: Hook detects Write tool usage, sets createdSkillName
 * 6. **Callback**: onSkillCreated() invoked with skill name and file path
 * 7. **Reset** (optional): Call reset() to clear state and start over
 *
 * ## Authentication
 * The hook automatically handles authentication:
 * - Reads `cui-auth-token` cookie from document.cookie
 * - Adds `Authorization: Bearer {token}` header to all requests
 * - Token extraction and header injection via helper functions
 *
 * @example
 * // Basic usage with skill creation detection
 * function SkillCreatorPanel() {
 *   const {
 *     messages,
 *     isProcessing,
 *     isCreating,
 *     createdSkillName,
 *     error,
 *     startConversation,
 *     sendMessage,
 *     reset
 *   } = useSkillCreator({
 *     directory: '/path/to/project',
 *     onSkillCreated: (name, path) => {
 *       console.log(`Skill "${name}" created at ${path}`);
 *       // Navigate to skill details page or refresh skill list
 *     },
 *     onError: (err) => {
 *       console.error('Skill creation failed:', err);
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       {!messages.length && (
 *         <button onClick={startConversation} disabled={isProcessing}>
 *           Start Creating Skill
 *         </button>
 *       )}
 *       {messages.map(msg => (
 *         <div key={msg.id}>{msg.role}: {msg.content}</div>
 *       ))}
 *       {isCreating && <p>Claude is writing your skill file...</p>}
 *       {createdSkillName && <p>Successfully created skill: {createdSkillName}</p>}
 *       {error && <p className="error">{error.message}</p>}
 *     </div>
 *   );
 * }
 *
 * @example
 * // With custom directory and callbacks
 * const { startConversation, sendMessage } = useSkillCreator({
 *   directory: process.env.PROJECT_ROOT,
 *   onSkillCreated: (skillName, filePath) => {
 *     toast.success(`Created ${skillName}`);
 *     router.push(`/skills/${skillName}`);
 *   },
 *   onError: (error) => {
 *     toast.error(`Failed: ${error.message}`);
 *   }
 * });
 *
 * @example
 * // Handling user input and sending messages
 * function ChatInterface() {
 *   const [input, setInput] = useState('');
 *   const { messages, isProcessing, sendMessage } = useSkillCreator();
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     if (!input.trim() || isProcessing) return;
 *
 *     await sendMessage(input);
 *     setInput('');
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
 *       <input
 *         value={input}
 *         onChange={(e) => setInput(e.target.value)}
 *         disabled={isProcessing}
 *         placeholder={isProcessing ? 'Waiting for response...' : 'Type your message...'}
 *       />
 *       <button type="submit" disabled={isProcessing || !input.trim()}>Send</button>
 *     </form>
 *   );
 * }
 *
 * @example
 * // Reset conversation after skill creation
 * function SkillCreator() {
 *   const { createdSkillName, reset, startConversation } = useSkillCreator({
 *     onSkillCreated: (name) => {
 *       setTimeout(() => {
 *         if (confirm(`Skill "${name}" created! Create another?`)) {
 *           reset();
 *           startConversation();
 *         }
 *       }, 1000);
 *     }
 *   });
 *
 *   // ... render UI
 * }
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = '/api/manager';

/**
 * Message object representing a single message in the conversation
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
}

/**
 * Configuration options for useSkillCreator hook
 */
interface UseSkillCreatorOptions {
  /**
   * Project directory path where skill should be created
   * Passed to the API to determine where to write `.claude/skills/{name}/SKILL.md`
   *
   * @example '/path/to/my/project'
   */
  directory?: string;

  /**
   * Callback invoked when skill file is successfully created
   *
   * @param skillName - Name of created skill (extracted from directory name)
   * @param filePath - Full path to created skill file
   *
   * @example
   * onSkillCreated: (name, path) => {
   *   console.log(`Skill ${name} created at ${path}`);
   *   refreshSkillList();
   * }
   */
  onSkillCreated?: (skillName: string, filePath: string) => void;

  /**
   * Callback invoked when any error occurs during skill creation
   *
   * @param error - Error object with message and stack trace
   *
   * @example
   * onError: (err) => {
   *   toast.error(`Failed to create skill: ${err.message}`);
   * }
   */
  onError?: (error: Error) => void;
}

/**
 * Return value interface for useSkillCreator hook
 */
interface UseSkillCreatorReturn {
  /**
   * Array of conversation messages in chronological order
   * Includes user messages (sent via sendMessage), assistant messages (from Claude),
   * and system messages (from API)
   */
  messages: Message[];

  /**
   * True when waiting for assistant response or processing stream
   * Use to disable input, show loading indicators, or prevent duplicate sends
   */
  isProcessing: boolean;

  /**
   * True when Claude is actively writing the skill file
   * Set when status events contain "Creating" or "Writing" keywords
   * Useful for showing specific "Creating skill..." UI feedback
   */
  isCreating: boolean;

  /**
   * Name of successfully created skill, or null if not yet created
   * Extracted from Write tool's file_path (.claude/skills/{name}/SKILL.md)
   * Set when skill file is written, triggers onSkillCreated callback
   */
  createdSkillName: string | null;

  /**
   * Error object if any operation failed, or null if no errors
   * Set when network requests fail, stream parsing fails, or API returns error
   * Triggers onError callback when set
   */
  error: Error | null;

  /**
   * Start a new conversation with the skill creator
   * Sends initial message "Let's create a new skill." to begin workflow
   *
   * @returns Promise that resolves when initial message is sent and stream processed
   *
   * @example
   * <button onClick={startConversation} disabled={isProcessing}>
   *   Start Creating Skill
   * </button>
   */
  startConversation: () => Promise<void>;

  /**
   * Send a user message in the ongoing conversation
   * Appends message to conversation history and streams Claude's response
   *
   * @param content - User message text content
   * @returns Promise that resolves when message is sent and stream processed
   *
   * @example
   * await sendMessage('Create a skill for data validation');
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
   * Reset all conversation state and cancel any active streams
   * Clears messages, errors, creation status, and cancels ongoing SSE stream
   * Use when starting over or when component unmounts
   *
   * @example
   * // Reset after successful creation
   * if (createdSkillName) {
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

export function useSkillCreator(options: UseSkillCreatorOptions = {}): UseSkillCreatorReturn {
  const { directory, onSkillCreated, onError } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdSkillName, setCreatedSkillName] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Track the current conversation stream
  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * Send a message in the ongoing conversation
   *
   * Internal implementation that handles the full message send workflow including
   * adding user message to state, building conversation history, sending POST request,
   * and processing the SSE response stream.
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

      const url = new URL(`${API_BASE}/skills/create-with-claude/message`, window.location.origin);

      const response = await fetch(url.toString(), createFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory,
          conversationHistory
        }),
      }));

      if (!response.ok) {
        throw new Error('Failed to send message');
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
                console.error('Failed to parse SSE data:', e);
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
      if (onError) {
        onError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [directory, onError]);

  /**
   * Start a new conversation with the skill creator
   *
   * Initiates the skill creation workflow by sending the initial message
   * "Let's create a new skill." with an empty conversation history.
   *
   * @returns Promise that resolves when initial message is sent and stream processed
   */
  const startConversation = useCallback(async () => {
    // Send initial message to start conversation
    await sendMessageInternal("Let's create a new skill.", []);
  }, [sendMessageInternal]);

  /**
   * Public API: Send a message in the ongoing conversation
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
   * Handle stream events
   *
   * Processes SSE events from the skill creation stream. Handles multiple event types:
   * - **message (assistant)**: Extracts text blocks and detects Write tool usage
   * - **message (result)**: Marks query as completed
   * - **status**: Updates isCreating flag when "Creating" or "Writing" detected
   * - **complete**: Marks processing as finished
   * - **error**: Sets error state and invokes error callback
   *
   * When Write tool is detected for `.claude/skills/{name}/SKILL.md`, extracts skill name
   * and invokes onSkillCreated callback.
   *
   * @param data - Parsed SSE event data object
   *
   * @internal
   */
  const handleStreamEvent = useCallback((data: any) => {
    // Debug logging
    console.log('[SkillCreator] Stream event:', data.type, data.messageType);

    if (data.type === 'message' && data.messageType === 'assistant') {
      // Extract text content from assistant message
      // SDK structure: message.message.content (not message.content)
      const content = data.content?.message?.content;
      console.log('[SkillCreator] Assistant message content:', content);

      if (content && Array.isArray(content)) {
        const textBlocks = content.filter((block: any) => block.type === 'text');
        if (textBlocks.length > 0) {
          const textContent = textBlocks.map((block: any) => block.text).join('\n');
          console.log('[SkillCreator] Extracted text:', textContent);

          const assistantMessage: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: textContent,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        // Check for Write tool usage in assistant message
        const toolUseBlocks = content.filter((block: any) => block.type === 'tool_use');
        for (const block of toolUseBlocks) {
          if (block.name === 'Write') {
            const filePath = block.input?.file_path || '';
            console.log('[SkillCreator] Write tool detected:', filePath);

            // Check if writing to .claude/skills/{name}/SKILL.md
            const match = filePath.match(/\.claude[\/\\]skills[\/\\]([^\/\\]+)[\/\\]SKILL\.md/);
            if (match) {
              const skillName = match[1];
              console.log('[SkillCreator] Skill file created:', skillName);
              setCreatedSkillName(skillName);
              setIsCreating(false);

              if (onSkillCreated) {
                onSkillCreated(skillName, filePath);
              }
            }
          }
        }
      }
    } else if (data.type === 'message' && data.messageType === 'result') {
      // Final result message - query completed
      console.log('[SkillCreator] Query completed');
    } else if (data.type === 'status') {
      // Check if Claude is creating the skill
      if (data.status?.includes('Creating') || data.status?.includes('Writing')) {
        setIsCreating(true);
      }
    } else if (data.type === 'complete') {
      setIsProcessing(false);
    } else if (data.type === 'error') {
      const error = new Error(data.error || 'Skill creation failed');
      setError(error);
      if (onError) {
        onError(error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSkillCreated, onError]);

  /**
   * Reset the conversation state
   *
   * Cancels any ongoing SSE stream, clears all conversation state including messages,
   * processing flags, creation status, created skill name, and errors. Safe to call
   * at any time, even if no conversation is active.
   *
   * @returns void
   */
  const reset = useCallback(() => {
    // Cancel any ongoing stream
    if (streamReaderRef.current) {
      streamReaderRef.current.cancel();
      streamReaderRef.current = null;
    }

    conversationIdRef.current = null;
    setMessages([]);
    setIsProcessing(false);
    setIsCreating(false);
    setCreatedSkillName(null);
    setError(null);
  }, []);

  return {
    messages,
    isProcessing,
    isCreating,
    createdSkillName,
    error,
    startConversation,
    sendMessage,
    reset,
  };
}
