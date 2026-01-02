import React, { useState, useEffect, useRef } from 'react';
import type {
  Flow,
  FlowInputField,
  FlowExecution,
  FlowExecutionStatus,
  InputNode,
  isInputNode,
} from '../types';
import * as flowApi from '../services/flow-api';
import type { FlowExecutionEvent } from '../services/flow-api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import {
  XCircleIcon,
  PlayCircleIcon,
  CheckCircleIcon,
  SpinnerIcon,
  ClockIcon,
} from './ui/Icons';

interface FlowExecutionModalProps {
  flow: Flow;
  isOpen: boolean;
  onClose: () => void;
  onExecutionComplete?: (execution: FlowExecution) => void;
}

interface ExecutionMessage {
  id: string;
  type: 'status' | 'info' | 'node_started' | 'node_completed' | 'node_failed' | 'result' | 'error' | 'log';
  content: string;
  timestamp: Date;
  nodeId?: string;
  nodeType?: string;
  data?: Record<string, any>;
}

/**
 * Get input fields from flow's input node
 */
function getInputFields(flow: Flow): FlowInputField[] {
  const inputNode = flow.nodes?.find((node) => node.type === 'input') as InputNode | undefined;
  return inputNode?.inputFields || [];
}

/**
 * Modal for executing a flow with dynamic input form and real-time execution status
 */
const FlowExecutionModal: React.FC<FlowExecutionModalProps> = ({
  flow,
  isOpen,
  onClose,
  onExecutionComplete,
}) => {
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<ExecutionMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<FlowExecutionStatus | 'idle'>('idle');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [executionResult, setExecutionResult] = useState<Record<string, any> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const inputFields = getInputFields(flow);

  // Initialize default values
  useEffect(() => {
    const defaults: Record<string, any> = {};
    inputFields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      } else if (field.type === 'checkbox') {
        defaults[field.name] = false;
      } else if (field.type === 'multiselect') {
        defaults[field.name] = [];
      }
    });
    setInputValues(defaults);
  }, [flow.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setExecutionStatus('idle');
      setExecutionResult(null);
      setValidationErrors({});
    }
  }, [isOpen]);

  // Validate inputs
  const validateInputs = (): boolean => {
    const errors: Record<string, string> = {};

    inputFields.forEach((field) => {
      const value = inputValues[field.name];

      // Check required
      if (field.required) {
        if (value === undefined || value === null || value === '') {
          errors[field.name] = `${field.label} is required`;
          return;
        }
      }

      // Skip further validation if empty and not required
      if (value === undefined || value === null || value === '') {
        return;
      }

      // Type-specific validation
      switch (field.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors[field.name] = 'Invalid email format';
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            errors[field.name] = 'Invalid URL format';
          }
          break;
        case 'number':
          const num = parseFloat(value);
          if (isNaN(num)) {
            errors[field.name] = 'Must be a valid number';
          } else {
            if (field.min !== undefined && num < field.min) {
              errors[field.name] = `Must be at least ${field.min}`;
            }
            if (field.max !== undefined && num > field.max) {
              errors[field.name] = `Must be at most ${field.max}`;
            }
          }
          break;
        case 'text':
        case 'textarea':
          if (field.min !== undefined && value.length < field.min) {
            errors[field.name] = `Must be at least ${field.min} characters`;
          }
          if (field.max !== undefined && value.length > field.max) {
            errors[field.name] = `Must be at most ${field.max} characters`;
          }
          break;
      }

      // Pattern validation
      if (field.pattern && typeof value === 'string') {
        try {
          const regex = new RegExp(field.pattern);
          if (!regex.test(value)) {
            errors[field.name] = `Invalid format`;
          }
        } catch {
          // Invalid regex pattern, skip validation
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle input change
  const handleInputChange = (name: string, value: any) => {
    setInputValues((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Handle execution
  const handleExecute = async () => {
    if (!validateInputs()) {
      return;
    }

    setIsExecuting(true);
    setMessages([]);
    setExecutionStatus('pending');
    setExecutionResult(null);

    // Add initial status message
    addMessage('status', `Starting flow: ${flow.name}`);

    try {
      await flowApi.executeFlow(
        flow.id,
        { input: inputValues },
        (event: FlowExecutionEvent) => {
          handleExecutionEvent(event);
        }
      );
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Execution failed');
      setExecutionStatus('failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Add message helper
  const addMessage = (
    type: ExecutionMessage['type'],
    content: string,
    extra?: Partial<ExecutionMessage>
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp: new Date(),
        ...extra,
      },
    ]);
  };

  // Handle SSE execution events
  const handleExecutionEvent = (event: FlowExecutionEvent) => {
    const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();

    switch (event.type) {
      case 'status':
        setExecutionStatus(event.status as FlowExecutionStatus || 'running');
        addMessage('status', event.message || `Status: ${event.status}`, {
          timestamp,
          data: event.data,
        });
        break;

      case 'node_started':
        addMessage('node_started', `Started: ${event.nodeId || 'node'}`, {
          timestamp,
          nodeId: event.nodeId,
          nodeType: event.nodeType,
        });
        break;

      case 'node_completed':
        addMessage('node_completed', `Completed: ${event.nodeId || 'node'}`, {
          timestamp,
          nodeId: event.nodeId,
          nodeType: event.nodeType,
          data: event.data,
        });
        break;

      case 'node_failed':
        addMessage('node_failed', `Failed: ${event.nodeId || 'node'} - ${event.error || 'Unknown error'}`, {
          timestamp,
          nodeId: event.nodeId,
          nodeType: event.nodeType,
          data: event.data,
        });
        break;

      case 'log':
        addMessage('log', event.message || 'Log', {
          timestamp,
          data: event.data,
        });
        break;

      case 'result':
        setExecutionStatus(event.result?.status || 'completed');
        setExecutionResult(event.result?.output || null);

        if (event.result?.success) {
          addMessage('result', 'Flow execution completed successfully', {
            timestamp,
            data: {
              executionTime: event.result.executionTime,
              tokensUsed: event.result.tokensUsed,
              cost: event.result.cost,
            },
          });
        } else {
          addMessage('error', event.result?.error || 'Execution failed', {
            timestamp,
          });
        }

        if (onExecutionComplete && event.result) {
          onExecutionComplete({
            id: event.result.executionId,
            flowId: flow.id,
            status: event.result.status,
            output: event.result.output,
            executionTime: event.result.executionTime,
            tokensUsed: event.result.tokensUsed || 0,
            cost: event.result.cost || 0,
            triggeredBy: 'manual',
            logs: [],
            nodeExecutions: (event.result.nodeExecutions || []) as import('../types').NodeExecution[],
            retryCount: 0,
          });
        }
        break;

      case 'error':
        setExecutionStatus('failed');
        addMessage('error', event.error || event.message || 'Unknown error', {
          timestamp,
        });
        break;

      default:
        // Handle unknown event types
        if (event.message) {
          addMessage('info', event.message, { timestamp, data: event.data });
        }
    }
  };

  // Render input field based on type
  const renderInputField = (field: FlowInputField) => {
    const value = inputValues[field.name] ?? '';
    const error = validationErrors[field.name];

    const commonProps = {
      id: field.name,
      disabled: isExecuting,
      className: error ? 'border-red-500' : '',
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={`min-h-[100px] ${error ? 'border-red-500' : ''}`}
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
          >
            <option value="">Select {field.label}...</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        );

      case 'multiselect':
        return (
          <div className="space-y-1">
            {(field.options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(value || []).includes(opt)}
                  onChange={(e) => {
                    const current = value || [];
                    const next = e.target.checked
                      ? [...current, opt]
                      : current.filter((v: string) => v !== opt);
                    handleInputChange(field.name, next);
                  }}
                  disabled={isExecuting}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleInputChange(field.name, e.target.checked)}
              disabled={isExecuting}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">{field.description || field.label}</span>
          </label>
        );

      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
          />
        );

      case 'date':
        return (
          <Input
            {...commonProps}
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
          />
        );

      case 'datetime':
        return (
          <Input
            {...commonProps}
            type="datetime-local"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
          />
        );

      case 'email':
        return (
          <Input
            {...commonProps}
            type="email"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder || 'email@example.com'}
          />
        );

      case 'url':
        return (
          <Input
            {...commonProps}
            type="url"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder || 'https://example.com'}
          />
        );

      case 'file':
        return (
          <Input
            {...commonProps}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // For now, just store the file name
                // In a real implementation, you'd upload the file
                handleInputChange(field.name, file.name);
              }
            }}
          />
        );

      case 'text':
      default:
        return (
          <Input
            {...commonProps}
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (executionStatus) {
      case 'running':
      case 'pending':
        return <SpinnerIcon className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get message styles
  const getMessageStyles = (type: ExecutionMessage['type']): string => {
    switch (type) {
      case 'error':
        return 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300';
      case 'node_failed':
        return 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400';
      case 'result':
        return 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300';
      case 'node_completed':
        return 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400';
      case 'node_started':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400';
      case 'status':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'log':
        return 'bg-gray-500/10 border-gray-500/20';
      default:
        return 'bg-secondary border-border';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-primary">⚡</span>
                Run Flow: {flow.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {flow.description || 'Execute this workflow with custom inputs'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {executionStatus !== 'idle' && (
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm font-medium capitalize">{executionStatus}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              disabled={isExecuting}
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content - Split into input form and execution log */}
        <div className="flex-1 overflow-hidden flex">
          {/* Input Form Panel */}
          <div className="w-1/2 border-r border-border p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
              Input Parameters
            </h3>

            {inputFields.length === 0 ? (
              <div className="text-center py-8 bg-secondary/30 rounded-lg text-muted-foreground">
                <p>This flow has no input parameters.</p>
                <p className="text-sm mt-2">Click "Run Flow" to execute directly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inputFields.map((field) => (
                  <div key={field.name}>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium mb-1"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.description && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {field.description}
                      </p>
                    )}
                    {renderInputField(field)}
                    {validationErrors[field.name] && (
                      <p className="text-xs text-red-500 mt-1">
                        {validationErrors[field.name]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Execute Button */}
            <div className="mt-6 pt-4 border-t border-border">
              <Button
                onClick={handleExecute}
                disabled={isExecuting || !flow.isActive}
                className="w-full flex items-center justify-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <SpinnerIcon className="h-5 w-5" />
                    Running...
                  </>
                ) : (
                  <>
                    <PlayCircleIcon className="h-5 w-5" />
                    Run Flow
                  </>
                )}
              </Button>
              {!flow.isActive && (
                <p className="text-xs text-yellow-600 mt-2 text-center">
                  This flow is not active. Activate it first to execute.
                </p>
              )}
            </div>
          </div>

          {/* Execution Log Panel */}
          <div className="w-1/2 p-4 overflow-y-auto bg-secondary/20">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
              Execution Log
            </h3>

            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClockIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Execution log will appear here</p>
                <p className="text-sm mt-1">Fill in the inputs and click "Run Flow"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg border ${getMessageStyles(message.type)}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {message.type.replace('_', ' ')}
                        {message.nodeId && (
                          <span className="ml-2 text-muted-foreground font-normal">
                            ({message.nodeId})
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm">{message.content}</div>
                    {message.data && Object.keys(message.data).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-2 text-xs bg-black/10 p-2 rounded overflow-x-auto">
                          {JSON.stringify(message.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Result Display */}
            {executionResult && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                  Execution Result
                </h4>
                <pre className="text-sm bg-black/10 p-3 rounded overflow-x-auto">
                  {typeof executionResult === 'string'
                    ? executionResult
                    : JSON.stringify(executionResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
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

export default FlowExecutionModal;
