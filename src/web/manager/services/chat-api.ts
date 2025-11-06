/**
 * Chat API functions
 */

// Express API base URL
// @ts-ignore - Vite env variables are available at runtime
const EXPRESS_API = import.meta.env?.VITE_EXPRESS_URL || 'http://localhost:3001/api';
const CHAT_BASE = `${EXPRESS_API}/chat`;

/**
 * Get auth token from cookie
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

export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
}

/**
 * Create a new chat session
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
 * Get all chat sessions
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
 * Get single chat session
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
 * Delete chat session
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
 * Archive chat session
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
 * Get messages for chat session
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
 * Send message to chat session (SSE streaming)
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
 * Convert file to base64
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
 * Get all available agents
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
 * Get all available skills
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
 * Cancel an active message stream
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
