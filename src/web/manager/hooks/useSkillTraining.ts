/**
 * Hook for managing skill training with Training Agent
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE = '/api/manager';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface TrainingStatus {
  status: 'idle' | 'starting' | 'analyzing' | 'training' | 'evaluating' | 'updating' | 'completed' | 'error';
  currentScore: number;
  newScore?: number;
  issuesFound?: string[];
}

interface UseSkillTrainingOptions {
  skillId: string;
  directory?: string;
  onTrainingComplete?: (oldScore: number, newScore: number) => void;
  onError?: (error: Error) => void;
}

interface UseSkillTrainingReturn {
  messages: Message[];
  trainingStatus: TrainingStatus;
  isProcessing: boolean;
  error: Error | null;
  startTraining: () => Promise<void>;
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
   */
  const sendMessage = useCallback(async (content: string) => {
    // Use messagesRef to get current messages without closure issues
    const currentMessages = messagesRef.current;
    await sendMessageInternal(content, currentMessages);
  }, [sendMessageInternal]);

  /**
   * Start training session (sends initial message)
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
