import React, { useState, useRef, useEffect } from 'react';
import type { Agent } from '../services/api';
import * as api from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XCircleIcon, PlayCircleIcon } from './ui/Icons';
import DynamicField from './DynamicField';

interface AgentExecutionModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
  directory?: string;
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

const AgentExecutionModal: React.FC<AgentExecutionModalProps> = ({
  agent,
  isOpen,
  onClose,
  directory,
}) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypass' | 'plan'>('bypass');
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasInputFields = false; // TODO: inputFields not yet in Strapi schema

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleExecute = async () => {
    // Build prompt from input values if fields exist
    let finalPrompt = userPrompt;

    // TODO: inputFields feature not yet in Strapi schema
    /* if (hasInputFields) {
      // Check required fields
      const requiredFields = agent.metadata!.inputFields!.filter((f: any) => f.required);
      const missingFields = requiredFields.filter((f: any) => !inputValues[f.name]);

      if (missingFields.length > 0) {
        alert(`Please fill in required fields: ${missingFields.map((f: any) => f.label).join(', ')}`);
        return;
      }

      // Build structured prompt from input values
      const inputParts = agent.metadata!.inputFields!.map((field: any) => {
        const value = inputValues[field.name];
        if (value !== undefined && value !== '') {
          return `${field.label}: ${value}`;
        }
        return null;
      }).filter(Boolean);

      finalPrompt = inputParts.join('\n');
    } */

    if (!finalPrompt.trim() || isExecuting) return;

    setIsExecuting(true);
    setMessages([]);

    try {
      await api.executeAgent(
        agent.id,
        finalPrompt,
        directory,
        permissionMode,
        (event) => {
          // Handle assistant messages (contains tool_use blocks)
          if (event.type === 'message' && event.messageType === 'assistant') {
            const message = event.content?.message;
            if (message?.content && Array.isArray(message.content)) {
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
          if (event.type === 'message' && event.messageType === 'user') {
            const message = event.content?.message;
            if (message?.content && Array.isArray(message.content)) {
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

          // Handle other event types
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            type: event.type as any,
            content: '',
            timestamp: new Date(),
          };

          if (event.type === 'status') {
            newMessage.content = event.message || event.status || '';
          } else if (event.type === 'debug') {
            newMessage.content = event.message || '';
          } else if (event.type === 'message' && event.messageType === 'system') {
            newMessage.type = 'status';
            newMessage.content = JSON.stringify(event.content, null, 2);
          } else if (event.type === 'complete') {
            newMessage.type = 'status';
            newMessage.content = '✅ Agent execution completed';
          } else if (event.type === 'error') {
            newMessage.content = event.error || 'Unknown error';
          } else {
            // Fallback for unknown types
            newMessage.content = JSON.stringify(event, null, 2);
          }

          setMessages((prev) => [...prev, newMessage]);
        }
      );
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          type: 'error',
          content: error instanceof Error ? error.message : 'Failed to execute agent',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">Execute Agent: {agent.name}</h2>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Prompt Input */}
        <div className="p-4 border-b border-border">
          {/* Permission Mode Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Permission Mode:
            </label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="bypass"
                  checked={permissionMode === 'bypass'}
                  onChange={(e) => setPermissionMode(e.target.value as any)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Bypass (Auto-approve all) ⚡</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="acceptEdits"
                  checked={permissionMode === 'acceptEdits'}
                  onChange={(e) => setPermissionMode(e.target.value as any)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Accept Edits (Auto file changes)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="plan"
                  checked={permissionMode === 'plan'}
                  onChange={(e) => setPermissionMode(e.target.value as any)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Plan (Strategy only)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="default"
                  checked={permissionMode === 'default'}
                  onChange={(e) => setPermissionMode(e.target.value as any)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Default (Ask each)</span>
              </label>
            </div>
          </div>

          {/* TODO: inputFields feature not yet in Strapi schema */}
          {hasInputFields ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Dynamic input fields coming soon...
              </p>
              <Button
                onClick={handleExecute}
                disabled={isExecuting}
                className="flex items-center gap-2 w-full mt-2"
              >
                <PlayCircleIcon className="h-5 w-5" />
                {isExecuting ? 'Running...' : 'Execute'}
              </Button>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium mb-2">
                Enter your prompt for the agent:
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="What should the agent do?"
                  disabled={isExecuting}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isExecuting) {
                      handleExecute();
                    }
                  }}
                />
                <Button
                  onClick={handleExecute}
                  disabled={!userPrompt.trim() || isExecuting}
                  className="flex items-center gap-2"
                >
                  <PlayCircleIcon className="h-5 w-5" />
                  {isExecuting ? 'Running...' : 'Execute'}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !isExecuting && (
            <div className="text-center text-muted-foreground py-12">
              Enter a prompt and click Execute to run the agent
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
              <div className="animate-pulse">Starting agent execution...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentExecutionModal;
