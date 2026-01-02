/**
 * Flow Preview Component
 *
 * A preview mode modal that shows how data flows through nodes with sample input.
 * This component allows users to visualize and step through the flow execution
 * without actually running the flow on the backend.
 *
 * ## Features
 * - **Sample Input Modal**: Enter sample data to simulate flow execution
 * - **Visual Animation**: See data flow through nodes with animated edges
 * - **Step-by-Step Execution**: Manually step through each node's processing
 * - **Output Preview**: View expected output at each node in the flow
 * - **Execution Controls**: Play, pause, step forward, and reset simulation
 * - **Node Highlighting**: Visual feedback showing which node is currently active
 *
 * ## Component Structure
 * ```
 * FlowPreview (Modal)
 *   ├── Input Form (for sample data)
 *   ├── Canvas Overlay (shows current state)
 *   ├── Controls Panel (play/pause/step/reset)
 *   └── Output Display (shows node outputs)
 * ```
 *
 * ## Preview States
 * - **idle**: No preview running
 * - **ready**: Input entered, ready to start
 * - **running**: Auto-play mode, progressing through nodes
 * - **paused**: Paused mid-execution
 * - **stepping**: Manual step-by-step mode
 * - **completed**: Preview finished
 *
 * ## Usage
 * ```tsx
 * import FlowPreview from '@/components/flow-canvas/FlowPreview';
 *
 * function FlowEditor() {
 *   const [showPreview, setShowPreview] = useState(false);
 *
 *   return (
 *     <>
 *       <button onClick={() => setShowPreview(true)}>Preview</button>
 *       <FlowPreview
 *         isOpen={showPreview}
 *         onClose={() => setShowPreview(false)}
 *       />
 *     </>
 *   );
 * }
 * ```
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFlowCanvas } from '../../contexts/FlowCanvasContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import {
  XCircleIcon,
  PlayCircleIcon,
  RefreshIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  SpinnerIcon,
} from '../ui/Icons';

/**
 * Pause Circle Icon Component
 * Custom icon for pause action (not available in Icons.tsx)
 */
const PauseCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="10" x2="10" y1="15" y2="9" />
    <line x1="14" x2="14" y1="15" y2="9" />
  </svg>
);
import type { ReactFlowNode, ReactFlowEdge } from '../../types/react-flow.types';
import type { FlowInputField } from '../../types';

/**
 * Preview execution state
 */
type PreviewState = 'idle' | 'ready' | 'running' | 'paused' | 'stepping' | 'completed';

/**
 * Node execution result during preview
 */
interface NodeExecutionResult {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  input: any;
  output: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: Date;
  error?: string;
}

/**
 * Props for FlowPreview component
 */
export interface FlowPreviewProps {
  /**
   * Whether the preview modal is open
   */
  isOpen: boolean;
  /**
   * Callback fired when modal should close
   */
  onClose: () => void;
  /**
   * Callback fired when preview execution state changes
   * Useful for updating edge animations in the main canvas
   */
  onPreviewStateChange?: (activeNodeId: string | null, activeEdgeIds: string[]) => void;
}

/**
 * FlowPreview Component
 *
 * Preview mode for visualizing data flow through nodes with sample input
 */
export const FlowPreview: React.FC<FlowPreviewProps> = ({
  isOpen,
  onClose,
  onPreviewStateChange,
}) => {
  // Get nodes and edges from context
  const { nodes, edges } = useFlowCanvas();

  // Preview state
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [executionResults, setExecutionResults] = useState<NodeExecutionResult[]>([]);
  const [sampleInput, setSampleInput] = useState<Record<string, any>>({});
  const [executionOrder, setExecutionOrder] = useState<ReactFlowNode[]>([]);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(1500); // ms between steps
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate execution order using topological sort (BFS)
   * Returns nodes in the order they should be executed
   */
  const calculateExecutionOrder = useCallback((): ReactFlowNode[] => {
    if (nodes.length === 0) return [];

    // Build adjacency list
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize
    nodes.forEach((node) => {
      adjacencyList.set(node.id, []);
      inDegree.set(node.id, 0);
    });

    // Build graph
    edges.forEach((edge) => {
      adjacencyList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Find starting nodes (input nodes with no incoming edges)
    const queue: string[] = [];
    nodes.forEach((node) => {
      if (inDegree.get(node.id) === 0) {
        queue.push(node.id);
      }
    });

    // Topological sort
    const order: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      order.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      neighbors.forEach((neighborId) => {
        const newDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) {
          queue.push(neighborId);
        }
      });
    }

    // Convert IDs to nodes
    return order
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is ReactFlowNode => n !== undefined);
  }, [nodes, edges]);

  /**
   * Extract input fields from input nodes
   */
  const getInputFields = useCallback((): FlowInputField[] => {
    const inputNodes = nodes.filter((node) => node.type === 'input');
    const fields: FlowInputField[] = [];

    inputNodes.forEach((node) => {
      const nodeData = node.data as any;
      if (nodeData.inputFields && Array.isArray(nodeData.inputFields)) {
        fields.push(...nodeData.inputFields);
      }
    });

    return fields;
  }, [nodes]);

  /**
   * Initialize sample input with defaults
   */
  useEffect(() => {
    if (!isOpen) return;

    const fields = getInputFields();
    const defaults: Record<string, any> = {};

    fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      } else if (field.type === 'checkbox') {
        defaults[field.name] = false;
      } else if (field.type === 'number') {
        defaults[field.name] = '';
      } else {
        defaults[field.name] = '';
      }
    });

    setSampleInput(defaults);
  }, [isOpen, getInputFields]);

  /**
   * Reset preview state
   */
  const resetPreview = useCallback(() => {
    setPreviewState('idle');
    setCurrentNodeIndex(0);
    setExecutionResults([]);
    setExecutionOrder([]);
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    onPreviewStateChange?.(null, []);
  }, [onPreviewStateChange]);

  /**
   * Start preview execution
   */
  const startPreview = useCallback(() => {
    const order = calculateExecutionOrder();
    if (order.length === 0) {
      return;
    }

    setExecutionOrder(order);
    setCurrentNodeIndex(0);
    setExecutionResults([]);
    setPreviewState('ready');

    // Auto-start first step
    setTimeout(() => {
      executeCurrentStep(order, 0, {});
    }, 100);
  }, [calculateExecutionOrder]);

  /**
   * Simulate node execution and return mock output
   */
  const simulateNodeExecution = useCallback(
    (node: ReactFlowNode, input: any): { output: any; error?: string } => {
      try {
        const nodeData = node.data as any;

        switch (node.type) {
          case 'input':
            // Input nodes just pass through the sample input
            return { output: input };

          case 'agent':
            // Agent nodes simulate AI processing
            const prompt = nodeData.promptTemplate || 'No prompt configured';
            const mockResponse = `[Simulated AI Response]\n\nPrompt: ${prompt.substring(0, 100)}...\n\nInput data: ${JSON.stringify(input).substring(0, 100)}...\n\nThis is a simulated response for preview purposes.`;
            return { output: mockResponse };

          case 'output':
            // Output nodes format the data
            const format = nodeData.format || 'text';
            let formattedOutput = input;

            if (format === 'json') {
              formattedOutput = JSON.stringify(input, null, 2);
            } else if (format === 'markdown') {
              formattedOutput = `# Output\n\n${typeof input === 'string' ? input : JSON.stringify(input, null, 2)}`;
            }

            return { output: formattedOutput };

          default:
            return { output: input };
        }
      } catch (error) {
        return {
          output: null,
          error: error instanceof Error ? error.message : 'Execution failed',
        };
      }
    },
    []
  );

  /**
   * Execute a single step in the preview
   */
  const executeCurrentStep = useCallback(
    (order: ReactFlowNode[], stepIndex: number, previousOutput: any) => {
      if (stepIndex >= order.length) {
        setPreviewState('completed');
        onPreviewStateChange?.(null, []);
        return;
      }

      const currentNode = order[stepIndex];

      // Mark current node as running
      setExecutionResults((prev) => [
        ...prev,
        {
          nodeId: currentNode.id,
          nodeName: currentNode.data.name || `Node ${stepIndex + 1}`,
          nodeType: currentNode.type || 'unknown',
          input: previousOutput,
          output: null,
          status: 'running',
          timestamp: new Date(),
        },
      ]);

      // Highlight current node and incoming edges
      const incomingEdges = edges.filter((e) => e.target === currentNode.id);
      onPreviewStateChange?.(currentNode.id, incomingEdges.map((e) => e.id));

      // Simulate execution delay
      setTimeout(() => {
        const result = simulateNodeExecution(currentNode, previousOutput);

        // Update result
        setExecutionResults((prev) =>
          prev.map((r, i) =>
            i === prev.length - 1
              ? {
                  ...r,
                  output: result.output,
                  status: result.error ? 'error' : 'completed',
                  error: result.error,
                }
              : r
          )
        );

        // Move to next step if in auto-play mode
        if (previewState === 'running') {
          autoPlayTimerRef.current = setTimeout(() => {
            setCurrentNodeIndex(stepIndex + 1);
            executeCurrentStep(order, stepIndex + 1, result.output);
          }, autoPlaySpeed);
        } else {
          // In stepping mode, just move index
          setCurrentNodeIndex(stepIndex + 1);
        }
      }, 800); // Execution simulation delay
    },
    [edges, simulateNodeExecution, onPreviewStateChange, previewState, autoPlaySpeed]
  );

  /**
   * Start auto-play mode
   */
  const handlePlay = useCallback(() => {
    if (previewState === 'idle') {
      startPreview();
    }
    setPreviewState('running');

    // Continue from current position
    if (currentNodeIndex < executionOrder.length) {
      const lastResult = executionResults[executionResults.length - 1];
      executeCurrentStep(executionOrder, currentNodeIndex, lastResult?.output || sampleInput);
    }
  }, [previewState, currentNodeIndex, executionOrder, executionResults, sampleInput, startPreview, executeCurrentStep]);

  /**
   * Pause auto-play
   */
  const handlePause = useCallback(() => {
    setPreviewState('paused');
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  /**
   * Execute next step manually
   */
  const handleStepForward = useCallback(() => {
    if (previewState === 'idle') {
      startPreview();
      setPreviewState('stepping');
      return;
    }

    setPreviewState('stepping');
    if (currentNodeIndex < executionOrder.length) {
      const lastResult = executionResults[executionResults.length - 1];
      executeCurrentStep(executionOrder, currentNodeIndex, lastResult?.output || sampleInput);
    }
  }, [previewState, currentNodeIndex, executionOrder, executionResults, sampleInput, startPreview, executeCurrentStep]);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    resetPreview();
    onClose();
  }, [resetPreview, onClose]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, []);

  /**
   * Render input field
   */
  const renderInputField = (field: FlowInputField) => {
    const value = sampleInput[field.name] ?? '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) =>
              setSampleInput((prev) => ({ ...prev, [field.name]: e.target.value }))
            }
            placeholder={field.placeholder}
            className="min-h-[80px]"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) =>
              setSampleInput((prev) => ({ ...prev, [field.name]: e.target.value }))
            }
            placeholder={field.placeholder}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) =>
                setSampleInput((prev) => ({ ...prev, [field.name]: e.target.checked }))
              }
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">{field.description || field.label}</span>
          </label>
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) =>
              setSampleInput((prev) => ({ ...prev, [field.name]: e.target.value }))
            }
            placeholder={field.placeholder}
          />
        );
    }
  };

  if (!isOpen) return null;

  const inputFields = getInputFields();
  const hasStarted = previewState !== 'idle';
  const isPlaying = previewState === 'running';
  const isPaused = previewState === 'paused' || previewState === 'stepping';
  const isCompleted = previewState === 'completed';
  const canStep = !isPlaying && currentNodeIndex < executionOrder.length && !isCompleted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
              <span className="text-2xl">👁️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold">Flow Preview</h2>
              <p className="text-sm text-muted-foreground">
                Visualize how data flows through your workflow
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Input & Controls */}
          <div className="w-1/3 border-r border-border flex flex-col">
            {/* Sample Input Section */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Sample Input Data
              </h3>

              {inputFields.length === 0 ? (
                <div className="text-center py-8 bg-secondary/30 rounded-lg text-muted-foreground">
                  <p className="text-sm">No input parameters defined</p>
                  <p className="text-xs mt-2">This flow doesn't require input</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inputFields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {field.description}
                        </p>
                      )}
                      {renderInputField(field)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Controls Section */}
            <div className="border-t border-border p-4 bg-secondary/20">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Preview Controls
              </h3>

              <div className="flex items-center gap-2 mb-3">
                {!hasStarted || isPaused ? (
                  <Button
                    onClick={handlePlay}
                    className="flex-1 flex items-center justify-center gap-2"
                    disabled={isCompleted}
                  >
                    <PlayCircleIcon className="h-5 w-5" />
                    {hasStarted ? 'Resume' : 'Play'}
                  </Button>
                ) : (
                  <Button
                    onClick={handlePause}
                    variant="secondary"
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <PauseCircleIcon className="h-5 w-5" />
                    Pause
                  </Button>
                )}

                <Button
                  onClick={handleStepForward}
                  variant="secondary"
                  className="flex-1 flex items-center justify-center gap-2"
                  disabled={!canStep}
                  title="Step Forward (execute one node)"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                  Step
                </Button>

                <Button
                  onClick={resetPreview}
                  variant="secondary"
                  className="flex items-center justify-center gap-2 px-3"
                  title="Reset Preview"
                >
                  <RefreshIcon className="h-5 w-5" />
                </Button>
              </div>

              {/* Progress */}
              <div className="text-xs text-muted-foreground text-center mb-2">
                {hasStarted ? (
                  <>
                    Step {Math.min(currentNodeIndex + 1, executionOrder.length)} of{' '}
                    {executionOrder.length}
                  </>
                ) : (
                  <>Ready to preview {nodes.length} nodes</>
                )}
              </div>

              {/* Progress Bar */}
              {hasStarted && (
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{
                      width: `${(currentNodeIndex / executionOrder.length) * 100}%`,
                    }}
                  />
                </div>
              )}

              {/* Status */}
              {isCompleted && (
                <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 inline-block mr-2" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Preview completed
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Execution Results */}
          <div className="flex-1 p-4 overflow-y-auto bg-secondary/10">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
              Execution Flow
            </h3>

            {executionResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <SpinnerIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Execution results will appear here</p>
                <p className="text-sm mt-1">Click "Play" or "Step" to start</p>
              </div>
            ) : (
              <div className="space-y-3">
                {executionResults.map((result, index) => (
                  <div
                    key={result.nodeId}
                    className={`
                      p-4 rounded-lg border transition-all duration-300
                      ${
                        result.status === 'running'
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : result.status === 'completed'
                          ? 'bg-green-500/10 border-green-500/20'
                          : result.status === 'error'
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-secondary border-border'
                      }
                    `}
                  >
                    {/* Node Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`
                          w-2 h-2 rounded-full
                          ${
                            result.status === 'running'
                              ? 'bg-blue-500 animate-pulse'
                              : result.status === 'completed'
                              ? 'bg-green-500'
                              : result.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-gray-500'
                          }
                        `}
                        />
                        <span className="font-semibold text-sm">
                          {index + 1}. {result.nodeName}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                          {result.nodeType}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Node Output */}
                    {result.status === 'completed' && result.output && (
                      <details className="mt-2" open={index === executionResults.length - 1}>
                        <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground mb-2">
                          View Output
                        </summary>
                        <pre className="text-xs bg-black/20 dark:bg-white/5 p-3 rounded overflow-x-auto max-h-40">
                          {typeof result.output === 'string'
                            ? result.output
                            : JSON.stringify(result.output, null, 2)}
                        </pre>
                      </details>
                    )}

                    {/* Error Display */}
                    {result.error && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                        <span className="font-semibold">Error:</span> {result.error}
                      </div>
                    )}

                    {/* Running State */}
                    {result.status === 'running' && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                        <SpinnerIcon className="h-4 w-4" />
                        <span>Processing...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            💡 Tip: Use step mode to examine each node's output in detail
          </p>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Display name for React DevTools
 */
FlowPreview.displayName = 'FlowPreview';

export default FlowPreview;
