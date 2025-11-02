/**
 * Hook for managing interactive agent creation with Claude Manager
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = '/api/manager';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface UseAgentCreatorOptions {
  directory?: string;
  onAgentCreated?: (agentName: string, filePath: string) => void;
  onError?: (error: Error) => void;
}

interface UseAgentCreatorReturn {
  messages: Message[];
  isProcessing: boolean;
  isCreating: boolean;
  createdAgentName: string | null;
  error: Error | null;
  startConversation: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  reset: () => void;
}

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

export function useAgentCreator(options: UseAgentCreatorOptions = {}): UseAgentCreatorReturn {
  const { directory, onAgentCreated, onError } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdAgentName, setCreatedAgentName] = useState<string | null>(null);
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

      const url = new URL(`${API_BASE}/agents/create-with-claude/message`, window.location.origin);

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
   * Start a new conversation with the agent creator
   */
  const startConversation = useCallback(async () => {
    // Send initial message to start conversation
    await sendMessageInternal("Let's create a new agent.", []);
  }, [sendMessageInternal]);

  /**
   * Public API: Send a message in the ongoing conversation
   */
  const sendMessage = useCallback(async (content: string) => {
    // Use messagesRef to get current messages without closure issues
    const currentMessages = messagesRef.current;
    await sendMessageInternal(content, currentMessages);
  }, [sendMessageInternal]);

  /**
   * Handle stream events
   */
  const handleStreamEvent = useCallback((data: any) => {
    // Debug logging
    console.log('[AgentCreator] Stream event:', data.type, data.messageType);

    if (data.type === 'message' && data.messageType === 'assistant') {
      // Extract text content from assistant message
      // SDK structure: message.message.content (not message.content)
      const content = data.content?.message?.content;
      console.log('[AgentCreator] Assistant message content:', content);

      if (content && Array.isArray(content)) {
        const textBlocks = content.filter((block: any) => block.type === 'text');
        if (textBlocks.length > 0) {
          const textContent = textBlocks.map((block: any) => block.text).join('\n');
          console.log('[AgentCreator] Extracted text:', textContent);

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
            console.log('[AgentCreator] Write tool detected:', filePath);

            // Check if writing to .claude/agents/
            const match = filePath.match(/\.claude[\/\\]agents[\/\\]([^\/\\]+)\.md/);
            if (match) {
              const agentName = match[1];
              console.log('[AgentCreator] Agent file created:', agentName);
              setCreatedAgentName(agentName);
              setIsCreating(false);

              if (onAgentCreated) {
                onAgentCreated(agentName, filePath);
              }
            }
          }
        }
      }
    } else if (data.type === 'message' && data.messageType === 'result') {
      // Final result message - query completed
      console.log('[AgentCreator] Query completed');
    } else if (data.type === 'status') {
      // Check if Claude is creating the agent
      if (data.status?.includes('Creating') || data.status?.includes('Writing')) {
        setIsCreating(true);
      }
    } else if (data.type === 'complete') {
      setIsProcessing(false);
    } else if (data.type === 'error') {
      const error = new Error(data.error || 'Agent creation failed');
      setError(error);
      if (onError) {
        onError(error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAgentCreated, onError]);

  /**
   * Reset the conversation state
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
    setCreatedAgentName(null);
    setError(null);
  }, []);

  return {
    messages,
    isProcessing,
    isCreating,
    createdAgentName,
    error,
    startConversation,
    sendMessage,
    reset,
  };
}
