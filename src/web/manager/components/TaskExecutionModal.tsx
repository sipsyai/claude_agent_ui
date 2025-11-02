import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';
import { Button } from './ui/Button';
import { XCircleIcon } from './ui/Icons';

interface TaskExecutionModalProps {
  task: api.Task;
  onClose: () => void;
  onComplete: () => void;
}

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

export default TaskExecutionModal;
