/**
 * Chat API service for Manager frontend
 *
 * Provides functions for managing chat sessions, sending messages,
 * and handling real-time streaming responses via Server-Sent Events (SSE).
 *
 * Chat sessions can be configured with:
 * - Agent-based chats (uses agent's system prompt and tools)
 * - Skill-based chats (custom system prompt with selected skills)
 * - Custom system prompts with permission modes
 */

// Express API base URL
// @ts-ignore - Vite env variables are available at runtime
const EXPRESS_API = import.meta.env?.VITE_EXPRESS_URL || 'http://localhost:3001/api';
const CHAT_BASE = `${EXPRESS_API}/chat`;

/**
 * Retrieves the authentication token from browser cookies.
 *
 * Looks for the 'cui-auth-token' cookie and returns its decoded value.
 * This token is used to authenticate API requests to the backend.
 *
 * @returns The decoded auth token string if found, null otherwise
 *
 * @example
 * const token = getAuthToken();
 * if (token) {
 *   // Use token for authenticated requests
 * }
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
 * Creates fetch options with authentication header.
 *
 * Merges provided options with an Authorization header containing the Bearer token
 * from the authentication cookie. Used internally for all authenticated API requests.
 *
 * @param options - Optional fetch configuration to merge with auth headers
 * @returns RequestInit object with auth header added
 *
 * @example
 * const options = createFetchOptions({
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' })
 * });
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

/**
 * Chat session configuration and state
 *
 * Represents a persistent chat session that can be either agent-based or skill-based.
 * Sessions maintain conversation history, configuration, and status.
 */
export interface ChatSession {
  id: number;
  documentId: string;
  title: string;
  status: 'active' | 'archived';
  sessionId: string | null;
  skills?: {
    id: number;
    documentId: string;
    name: string;
  }[];
  agent?: {
    id: number;
    documentId: string;
    name: string;
    systemPrompt: string;
    toolConfig?: {
      allowedTools?: string[];
    };
    modelConfig?: {
      model?: string;
    };
  };
  customSystemPrompt?: string;
  permissionMode: 'default' | 'bypass' | 'auto' | 'plan';
  planMode: boolean; // Legacy field for backwards compatibility
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

/**
 * Chat message with content, metadata, and attachments
 *
 * Represents a single message in a chat session from either the user or assistant.
 * Includes token usage, cost tracking, tool uses, and attached files.
 */
export interface ChatMessage {
  id: number;
  documentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: {
    id: number;
    documentId: string;
    name: string;
    url: string;
    mime: string;
    size: number;
  }[];
  metadata?: {
    toolUses?: any[];
    cost?: number;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    duration?: number;
  };
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * File attachment for chat messages
 *
 * Represents a file attached to a user message, with base64-encoded content.
 * Supports various file types including images, documents, and code files.
 */
export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
}

/**
 * Creates a new chat session with specified configuration.
 *
 * Creates a session that can be either agent-based (using a predefined agent) or
 * skill-based (using custom system prompt with selected skills). Sessions persist
 * conversation history and maintain state across multiple messages.
 *
 * @param title - Descriptive title for the chat session
 * @param skillIds - Array of skill document IDs to enable in this session
 * @param directory - Optional working directory for agent/skill execution
 * @param permissionMode - Permission handling mode ('default', 'bypass', 'auto', 'plan')
 * @param agentId - Optional agent document ID to use for this session
 * @param customSystemPrompt - Optional custom system prompt (overrides agent's prompt)
 * @returns Promise resolving to the created chat session
 * @throws Error if creation fails or validation errors occur
 *
 * @example
 * // Create skill-based chat session
 * const session = await createChatSession(
 *   'Debug Session',
 *   ['skill-1', 'skill-2'],
 *   '/path/to/project',
 *   'default'
 * );
 *
 * @example
 * // Create agent-based chat session
 * const session = await createChatSession(
 *   'Code Review',
 *   [],
 *   '/path/to/project',
 *   'default',
 *   'agent-123'
 * );
 */
export async function createChatSession(
  title: string,
  skillIds: string[],
  directory?: string,
  permissionMode?: 'default' | 'bypass' | 'auto' | 'plan',
  agentId?: string,
  customSystemPrompt?: string
): Promise<ChatSession> {
  const params = new URLSearchParams();
  if (directory) {
    params.append('workingDirectory', directory);
  }

  const response = await fetch(`${CHAT_BASE}/sessions?${params.toString()}`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      skillIds,
      agentId,
      customSystemPrompt,
      permissionMode: permissionMode || 'default'
    }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create chat session');
  }

  const data = await response.json();
  return data.session;
}

/**
 * Retrieves all chat sessions for the current user.
 *
 * Fetches all chat sessions including both active and archived sessions.
 * Sessions are ordered by creation date with newest first.
 *
 * @returns Promise resolving to array of chat session objects
 * @throws Error if the API request fails
 *
 * @example
 * const sessions = await getChatSessions();
 * const activeSessions = sessions.filter(s => s.status === 'active');
 * console.log(`You have ${activeSessions.length} active chats`);
 */
export async function getChatSessions(): Promise<ChatSession[]> {
  const response = await fetch(`${CHAT_BASE}/sessions`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get chat sessions');
  }

  const data = await response.json();
  return data.sessions;
}

/**
 * Retrieves a specific chat session by ID.
 *
 * Fetches complete session details including configuration, agent/skill
 * associations, and metadata.
 *
 * @param sessionId - Chat session document ID (Strapi documentId)
 * @returns Promise resolving to chat session object
 * @throws Error if session not found or request fails
 *
 * @example
 * const session = await getChatSession('session-123');
 * console.log(session.title);
 * console.log(`Permission mode: ${session.permissionMode}`);
 */
export async function getChatSession(sessionId: string): Promise<ChatSession> {
  const response = await fetch(`${CHAT_BASE}/sessions/${sessionId}`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get chat session');
  }

  const data = await response.json();
  return data.session;
}

/**
 * Deletes a chat session and all associated messages.
 *
 * Permanently removes the session and its entire conversation history from the database.
 * This action cannot be undone. Consider archiving instead if you want to preserve history.
 *
 * @param sessionId - Chat session document ID (Strapi documentId)
 * @returns Promise that resolves when deletion completes
 * @throws Error if deletion fails or session not found
 *
 * @example
 * await deleteChatSession('session-123');
 * console.log('Session deleted');
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`${CHAT_BASE}/sessions/${sessionId}`, createFetchOptions({
    method: 'DELETE',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete chat session');
  }
}

/**
 * Archives a chat session to hide it from the active list.
 *
 * Changes the session status to 'archived' while preserving all conversation history.
 * Archived sessions can still be accessed but won't appear in the default session list.
 *
 * @param sessionId - Chat session document ID (Strapi documentId)
 * @returns Promise resolving to the updated chat session
 * @throws Error if archiving fails or session not found
 *
 * @example
 * const archivedSession = await archiveChatSession('session-123');
 * console.log(archivedSession.status); // 'archived'
 */
export async function archiveChatSession(sessionId: string): Promise<ChatSession> {
  const response = await fetch(`${CHAT_BASE}/sessions/${sessionId}/archive`, createFetchOptions({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to archive chat session');
  }

  const data = await response.json();
  return data.session;
}

/**
 * Retrieves all messages for a specific chat session.
 *
 * Fetches the complete conversation history for the session, including user messages,
 * assistant responses, attachments, and metadata like token usage and costs.
 *
 * @param sessionId - Chat session document ID (Strapi documentId)
 * @returns Promise resolving to array of chat messages ordered by timestamp
 * @throws Error if request fails or session not found
 *
 * @example
 * const messages = await getChatMessages('session-123');
 * messages.forEach(msg => {
 *   console.log(`${msg.role}: ${msg.content.substring(0, 50)}...`);
 *   if (msg.metadata?.usage) {
 *     console.log(`Tokens: ${msg.metadata.usage.input_tokens + msg.metadata.usage.output_tokens}`);
 *   }
 * });
 */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${CHAT_BASE}/sessions/${sessionId}/messages`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get chat messages');
  }

  const data = await response.json();
  return data.messages;
}

/**
 * Sends a message to a chat session with streaming Server-Sent Events (SSE) response.
 *
 * Sends a user message and streams the assistant's response in real-time via SSE.
 * The response includes status updates, content chunks, tool usage, and completion events.
 * Returns an EventSource-like object for handling streaming events.
 *
 * @param sessionId - Chat session document ID (Strapi documentId)
 * @param message - User's message text content
 * @param attachments - Array of file attachments (images, documents, etc.)
 * @param directory - Optional working directory for agent/skill execution
 * @param permissionMode - Permission handling mode ('default', 'bypass', 'auto', 'plan')
 * @param agentId - Optional agent document ID (can be changed per message)
 * @param skillIds - Optional skill document IDs (can be changed per message)
 * @returns EventSource object for handling streaming events
 *
 * @example
 * const eventSource = sendChatMessage(
 *   'session-123',
 *   'Analyze this code',
 *   [],
 *   '/path/to/project'
 * );
 *
 * eventSource.addEventListener('message', (e) => {
 *   const data = JSON.parse(e.data);
 *   if (data.type === 'content') {
 *     console.log(data.content);
 *   } else if (data.type === 'complete') {
 *     console.log('Response complete');
 *     eventSource.close();
 *   }
 * });
 *
 * eventSource.addEventListener('error', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.error('Error:', data.error);
 * });
 */
export function sendChatMessage(
  sessionId: string,
  message: string,
  attachments: ChatAttachment[],
  directory?: string,
  permissionMode?: 'default' | 'bypass' | 'auto' | 'plan',
  agentId?: string,
  skillIds?: string[]
): EventSource {
  const params = new URLSearchParams();
  if (directory) {
    params.append('workingDirectory', directory);
  }

  const url = `${CHAT_BASE}/sessions/${sessionId}/messages?${params.toString()}`;

  // Create a custom EventSource-like object
  const eventTarget = new EventTarget();
  const eventSource = Object.assign(eventTarget, {
    close: () => {},
    readyState: 0,
    url: url,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
  }) as EventSource;

  fetch(url, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      attachments,
      agentId,
      skillIds,
      permissionMode
    }),
  }))
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json();
        const errorEvent = new MessageEvent('error', {
          data: JSON.stringify({ type: 'error', error: error.error || 'Failed to send message' }),
        });
        eventSource.dispatchEvent(errorEvent);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim()) {
              const messageEvent = new MessageEvent('message', { data });
              eventSource.dispatchEvent(messageEvent);
            }
          }
        }
      }
    })
    .catch((error) => {
      const errorEvent = new MessageEvent('error', {
        data: JSON.stringify({ type: 'error', error: error.message }),
      });
      eventSource.dispatchEvent(errorEvent);
    });

  return eventSource as EventSource;
}

/**
 * Converts a File object to base64-encoded string.
 *
 * Reads a file and returns its base64-encoded content without the data URI prefix.
 * Used to prepare files for attachment to chat messages.
 *
 * @param file - File object to convert
 * @returns Promise resolving to base64-encoded file content (without data URI prefix)
 * @throws Error if file reading fails
 *
 * @example
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 * const base64 = await fileToBase64(file);
 * const attachment = {
 *   name: file.name,
 *   mimeType: file.type,
 *   data: base64
 * };
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Retrieves all available agents for chat sessions.
 *
 * Fetches a simplified list of agents that can be used in chat sessions.
 * Returns basic agent information including ID, name, description, and model.
 *
 * @returns Promise resolving to array of agent objects with basic information
 * @throws Error if the API request fails
 *
 * @example
 * const agents = await getAgents();
 * agents.forEach(agent => {
 *   console.log(`${agent.name}: ${agent.description}`);
 *   console.log(`Model: ${agent.modelConfig?.model || 'default'}`);
 * });
 */
export async function getAgents(): Promise<{
  id: number;
  documentId: string;
  name: string;
  description?: string;
  modelConfig?: { model?: string };
}[]> {
  const response = await fetch(`${EXPRESS_API}/agents`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get agents');
  }

  const data = await response.json();
  return data.agents;
}

/**
 * Retrieves all available skills for chat sessions.
 *
 * Fetches a simplified list of skills that can be used in chat sessions.
 * Returns basic skill information including ID, name, display name, and description.
 *
 * @returns Promise resolving to array of skill objects with basic information
 * @throws Error if the API request fails
 *
 * @example
 * const skills = await getSkills();
 * skills.forEach(skill => {
 *   console.log(`${skill.displayName || skill.name}: ${skill.description}`);
 * });
 */
export async function getSkills(): Promise<{
  id: number;
  documentId: string;
  name: string;
  displayName?: string;
  description?: string;
}[]> {
  const response = await fetch(`${EXPRESS_API}/skills`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get skills');
  }

  const data = await response.json();
  return data.skills;
}

/**
 * Cancels an active streaming message response.
 *
 * Sends a cancellation request to stop an ongoing message stream. This is useful
 * when the user wants to interrupt a long-running response or when switching contexts.
 *
 * @param sessionId - Chat session document ID (Strapi documentId)
 * @param streamId - Unique identifier for the active stream to cancel
 * @returns Promise resolving to cancellation result with success status and message
 * @throws Error if cancellation fails or stream not found
 *
 * @example
 * const result = await cancelMessage('session-123', 'stream-456');
 * if (result.success) {
 *   console.log('Message cancelled:', result.message);
 * }
 */
export async function cancelMessage(
  sessionId: string,
  streamId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${CHAT_BASE}/sessions/${sessionId}/messages/${streamId}/cancel`,
    createFetchOptions({
      method: 'POST',
    })
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel message');
  }

  return response.json();
}
