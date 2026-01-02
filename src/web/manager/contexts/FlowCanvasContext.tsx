/**
 * Flow Canvas Context
 *
 * A React Context that manages the state and operations for the React Flow canvas,
 * including nodes, edges, selection state, and undo/redo history.
 *
 * ## Features
 * - **Node Management**: Add, update, remove, and retrieve nodes with type safety
 * - **Edge Management**: Add, update, remove, and retrieve edges with validation
 * - **Selection State**: Track selected nodes and edges for UI operations
 * - **Undo/Redo History**: Full undo/redo support with history stack management
 * - **Auto-Save**: Debounced auto-save functionality to persist changes
 * - **Type Safety**: Fully typed context values with TypeScript interfaces
 *
 * ## Context Values
 * The context provides the following state and functions:
 *
 * ### Canvas State
 * - `nodes`: Array of all React Flow nodes on the canvas
 * - `edges`: Array of all React Flow edges connecting nodes
 * - `selectedNodeIds`: Array of currently selected node IDs
 * - `selectedEdgeIds`: Array of currently selected edge IDs
 *
 * ### Node Operations
 * - `addNode`: Add a new node to the canvas
 * - `updateNode`: Update an existing node's data or position
 * - `removeNode`: Remove a node and its connected edges
 * - `removeNodes`: Remove multiple nodes at once
 * - `getNodeById`: Retrieve a specific node by ID
 *
 * ### Edge Operations
 * - `addEdge`: Add a new edge between nodes
 * - `updateEdge`: Update an existing edge's data
 * - `removeEdge`: Remove a specific edge
 * - `removeEdges`: Remove multiple edges at once
 * - `getEdgeById`: Retrieve a specific edge by ID
 *
 * ### Selection Operations
 * - `selectNode`: Select a node (single or multi-select)
 * - `selectEdge`: Select an edge (single or multi-select)
 * - `clearSelection`: Clear all selections
 * - `setSelectedNodes`: Set selected node IDs directly
 * - `setSelectedEdges`: Set selected edge IDs directly
 *
 * ### History Operations
 * - `undo`: Undo the last change
 * - `redo`: Redo the last undone change
 * - `canUndo`: Boolean indicating if undo is available
 * - `canRedo`: Boolean indicating if redo is available
 *
 * ### Canvas Operations
 * - `resetCanvas`: Clear all nodes, edges, and selections
 * - `loadCanvas`: Load nodes and edges from external data
 * - `applyAutoLayout`: Apply automatic layout algorithm to organize nodes
 * - `onCanvasChange`: Callback fired when canvas state changes (for auto-save)
 *
 * ## Provider Usage
 * Wrap your flow canvas components with FlowCanvasProvider:
 *
 * ```tsx
 * import { FlowCanvasProvider } from './contexts/FlowCanvasContext';
 *
 * function FlowEditor() {
 *   const handleSave = (nodes, edges) => {
 *     // Save to backend
 *   };
 *
 *   return (
 *     <FlowCanvasProvider onCanvasChange={handleSave} autoSaveDelay={2000}>
 *       <FlowCanvas />
 *       <NodePalette />
 *       <CanvasToolbar />
 *     </FlowCanvasProvider>
 *   );
 * }
 * ```
 *
 * ## Consumer Patterns
 * Use the `useFlowCanvas` hook to access context values:
 *
 * ```tsx
 * import { useFlowCanvas } from './contexts/FlowCanvasContext';
 *
 * function NodePalette() {
 *   const { addNode } = useFlowCanvas();
 *
 *   const handleDrop = (type, position) => {
 *     addNode({
 *       type,
 *       position,
 *       name: `New ${type} node`
 *     });
 *   };
 *
 *   return <div onDrop={handleDrop}>...</div>;
 * }
 * ```
 */

import * as React from 'react';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import type {
  ReactFlowNode,
  ReactFlowEdge,
  CreateNodeConfig,
} from '../types/react-flow.types';
import type { FlowNodeType } from '../types';
import { applyAutoLayout, type AutoLayoutConfig } from '../utils/auto-layout';

/**
 * History entry for undo/redo functionality
 */
interface HistoryEntry {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  timestamp: number;
}

/**
 * Shape of the FlowCanvasContext value
 */
export interface FlowCanvasContextValue {
  // Canvas State
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // Node Operations
  addNode: (config: CreateNodeConfig) => ReactFlowNode;
  updateNode: (nodeId: string, updates: Partial<ReactFlowNode>) => void;
  removeNode: (nodeId: string) => void;
  removeNodes: (nodeIds: string[]) => void;
  getNodeById: (nodeId: string) => ReactFlowNode | undefined;

  // Edge Operations
  addEdge: (edge: Omit<ReactFlowEdge, 'id'>) => ReactFlowEdge;
  updateEdge: (edgeId: string, updates: Partial<ReactFlowEdge>) => void;
  removeEdge: (edgeId: string) => void;
  removeEdges: (edgeIds: string[]) => void;
  getEdgeById: (edgeId: string) => ReactFlowEdge | undefined;

  // Selection Operations
  selectNode: (nodeId: string, multiSelect?: boolean) => void;
  selectEdge: (edgeId: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  setSelectedEdges: (edgeIds: string[]) => void;

  // History Operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Canvas Operations
  resetCanvas: () => void;
  loadCanvas: (nodes: ReactFlowNode[], edges: ReactFlowEdge[]) => void;
  applyAutoLayout: (config?: Partial<AutoLayoutConfig>) => void;
}

/**
 * Props for the FlowCanvasProvider component
 */
export interface FlowCanvasProviderProps {
  children: ReactNode;
  /**
   * Callback fired when canvas state changes (debounced for auto-save)
   */
  onCanvasChange?: (nodes: ReactFlowNode[], edges: ReactFlowEdge[]) => void;
  /**
   * Delay in milliseconds for auto-save debouncing (default: 1000ms)
   */
  autoSaveDelay?: number;
  /**
   * Initial nodes to load on mount
   */
  initialNodes?: ReactFlowNode[];
  /**
   * Initial edges to load on mount
   */
  initialEdges?: ReactFlowEdge[];
}

const FlowCanvasContext = createContext<FlowCanvasContextValue | undefined>(undefined);

/**
 * Generate a unique node ID
 */
const generateNodeId = (type: FlowNodeType): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${type}_${timestamp}_${random}`;
};

/**
 * Generate a unique edge ID
 */
const generateEdgeId = (source: string, target: string): string => {
  const random = Math.random().toString(36).substring(2, 9);
  return `edge_${source}_${target}_${random}`;
};

/**
 * Create default node data based on node type
 */
const createDefaultNodeData = (type: FlowNodeType, name?: string): any => {
  const timestamp = Date.now();
  const nodeId = `node_${timestamp}`;

  const baseData = {
    nodeId,
    name: name || `${type.charAt(0).toUpperCase()}${type.slice(1)} Node`,
  };

  switch (type) {
    case 'input':
      return {
        ...baseData,
        type: 'input' as const,
        inputFields: [],
      };
    case 'agent':
      return {
        ...baseData,
        type: 'agent' as const,
        agentId: '',
        promptTemplate: '',
        skills: [],
        modelOverride: 'default',
        timeout: 30000,
        retryOnError: true,
        maxRetries: 3,
      };
    case 'output':
      return {
        ...baseData,
        type: 'output' as const,
        outputType: 'response' as const,
        format: 'json' as const,
        saveToFile: false,
        includeMetadata: false,
        includeTimestamp: true,
      };
    default:
      return baseData;
  }
};

/**
 * FlowCanvasProvider Component
 *
 * Provider component that manages and exposes flow canvas state to child components.
 */
export const FlowCanvasProvider: React.FC<FlowCanvasProviderProps> = ({
  children,
  onCanvasChange,
  autoSaveDelay = 1000,
  initialNodes = [],
  initialEdges = [],
}) => {
  // Canvas state
  const [nodes, setNodes] = useState<ReactFlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<ReactFlowEdge[]>(initialEdges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  // History state for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([
    { nodes: initialNodes, edges: initialEdges, timestamp: Date.now() },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Refs for auto-save debouncing
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUndoRedoOperation = useRef<boolean>(false);

  /**
   * Save current state to history (for undo/redo)
   */
  const saveToHistory = useCallback((newNodes: ReactFlowNode[], newEdges: ReactFlowEdge[]) => {
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      return;
    }

    setHistory(prev => {
      // Remove any future history if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new entry
      newHistory.push({
        nodes: newNodes,
        edges: newEdges,
        timestamp: Date.now(),
      });
      // Limit history to last 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(prev => prev + 1);
      }
      return newHistory;
    });
  }, [historyIndex]);

  /**
   * Debounced auto-save effect
   */
  useEffect(() => {
    if (!onCanvasChange) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for debounced save
    autoSaveTimerRef.current = setTimeout(() => {
      onCanvasChange(nodes, edges);
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [nodes, edges, onCanvasChange, autoSaveDelay]);

  // =============================================================================
  // NODE OPERATIONS
  // =============================================================================

  const addNode = useCallback((config: CreateNodeConfig): ReactFlowNode => {
    const nodeId = generateNodeId(config.type);
    const data = createDefaultNodeData(config.type, config.name);

    if (config.description) {
      data.description = config.description;
    }

    const newNode = {
      id: nodeId,
      type: config.type,
      position: config.position,
      data,
    } as ReactFlowNode;

    setNodes(prev => {
      const updated = [...prev, newNode] as ReactFlowNode[];
      saveToHistory(updated, edges);
      return updated;
    });

    return newNode;
  }, [edges, saveToHistory]);

  const updateNode = useCallback((nodeId: string, updates: Partial<ReactFlowNode>) => {
    setNodes(prev => {
      const updated = prev.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      ) as ReactFlowNode[];
      saveToHistory(updated, edges);
      return updated;
    });
  }, [edges, saveToHistory]);

  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const updated = prev.filter(node => node.id !== nodeId);
      // Also remove connected edges
      const updatedEdges = edges.filter(
        edge => edge.source !== nodeId && edge.target !== nodeId
      );
      setEdges(updatedEdges);
      saveToHistory(updated, updatedEdges);
      return updated;
    });
  }, [edges, saveToHistory]);

  const removeNodes = useCallback((nodeIds: string[]) => {
    const nodeIdSet = new Set(nodeIds);
    setNodes(prev => {
      const updated = prev.filter(node => !nodeIdSet.has(node.id));
      // Also remove connected edges
      const updatedEdges = edges.filter(
        edge => !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target)
      );
      setEdges(updatedEdges);
      saveToHistory(updated, updatedEdges);
      return updated;
    });
  }, [edges, saveToHistory]);

  const getNodeById = useCallback((nodeId: string): ReactFlowNode | undefined => {
    return nodes.find(node => node.id === nodeId);
  }, [nodes]);

  // =============================================================================
  // EDGE OPERATIONS
  // =============================================================================

  const addEdge = useCallback((edge: Omit<ReactFlowEdge, 'id'>): ReactFlowEdge => {
    const edgeId = generateEdgeId(edge.source, edge.target);
    const newEdge: ReactFlowEdge = {
      ...edge,
      id: edgeId,
    };

    setEdges(prev => {
      const updated = [...prev, newEdge];
      saveToHistory(nodes, updated);
      return updated;
    });

    return newEdge;
  }, [nodes, saveToHistory]);

  const updateEdge = useCallback((edgeId: string, updates: Partial<ReactFlowEdge>) => {
    setEdges(prev => {
      const updated = prev.map(edge =>
        edge.id === edgeId ? { ...edge, ...updates } : edge
      );
      saveToHistory(nodes, updated);
      return updated;
    });
  }, [nodes, saveToHistory]);

  const removeEdge = useCallback((edgeId: string) => {
    setEdges(prev => {
      const updated = prev.filter(edge => edge.id !== edgeId);
      saveToHistory(nodes, updated);
      return updated;
    });
  }, [nodes, saveToHistory]);

  const removeEdges = useCallback((edgeIds: string[]) => {
    const edgeIdSet = new Set(edgeIds);
    setEdges(prev => {
      const updated = prev.filter(edge => !edgeIdSet.has(edge.id));
      saveToHistory(nodes, updated);
      return updated;
    });
  }, [nodes, saveToHistory]);

  const getEdgeById = useCallback((edgeId: string): ReactFlowEdge | undefined => {
    return edges.find(edge => edge.id === edgeId);
  }, [edges]);

  // =============================================================================
  // SELECTION OPERATIONS
  // =============================================================================

  const selectNode = useCallback((nodeId: string, multiSelect = false) => {
    setSelectedNodeIds(prev => {
      if (multiSelect) {
        return prev.includes(nodeId)
          ? prev.filter(id => id !== nodeId)
          : [...prev, nodeId];
      }
      return [nodeId];
    });
    if (!multiSelect) {
      setSelectedEdgeIds([]);
    }
  }, []);

  const selectEdge = useCallback((edgeId: string, multiSelect = false) => {
    setSelectedEdgeIds(prev => {
      if (multiSelect) {
        return prev.includes(edgeId)
          ? prev.filter(id => id !== edgeId)
          : [...prev, edgeId];
      }
      return [edgeId];
    });
    if (!multiSelect) {
      setSelectedNodeIds([]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, []);

  // =============================================================================
  // HISTORY OPERATIONS (UNDO/REDO)
  // =============================================================================

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoOperation.current = true;
      const newIndex = historyIndex - 1;
      const entry = history[newIndex];
      setNodes(entry.nodes);
      setEdges(entry.edges);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoOperation.current = true;
      const newIndex = historyIndex + 1;
      const entry = history[newIndex];
      setNodes(entry.nodes);
      setEdges(entry.edges);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // =============================================================================
  // CANVAS OPERATIONS
  // =============================================================================

  const resetCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setHistory([{ nodes: [], edges: [], timestamp: Date.now() }]);
    setHistoryIndex(0);
  }, []);

  const loadCanvas = useCallback((newNodes: ReactFlowNode[], newEdges: ReactFlowEdge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setHistory([{ nodes: newNodes, edges: newEdges, timestamp: Date.now() }]);
    setHistoryIndex(0);
  }, []);

  /**
   * Apply automatic layout algorithm to organize nodes
   *
   * Uses dagre library to calculate optimal positions for all nodes based on
   * their connections. The layout arranges nodes in a left-to-right flow with
   * even spacing and no overlaps.
   *
   * @param config - Optional layout configuration (spacing, direction, etc.)
   *
   * @example
   * ```tsx
   * // Apply default layout
   * applyAutoLayout();
   *
   * // Apply compact layout
   * applyAutoLayout({ nodeSpacing: 100, rankSpacing: 150 });
   * ```
   */
  const applyAutoLayoutFn = useCallback((config?: Partial<AutoLayoutConfig>) => {
    const layoutedNodes = applyAutoLayout(nodes, edges, config);
    setNodes(layoutedNodes);
    saveToHistory(layoutedNodes, edges);
  }, [nodes, edges, saveToHistory]);

  // Context value
  const value: FlowCanvasContextValue = {
    // Canvas State
    nodes,
    edges,
    selectedNodeIds,
    selectedEdgeIds,

    // Node Operations
    addNode,
    updateNode,
    removeNode,
    removeNodes,
    getNodeById,

    // Edge Operations
    addEdge,
    updateEdge,
    removeEdge,
    removeEdges,
    getEdgeById,

    // Selection Operations
    selectNode,
    selectEdge,
    clearSelection,
    setSelectedNodes: setSelectedNodeIds,
    setSelectedEdges: setSelectedEdgeIds,

    // History Operations
    undo,
    redo,
    canUndo,
    canRedo,

    // Canvas Operations
    resetCanvas,
    loadCanvas,
    applyAutoLayout: applyAutoLayoutFn,
  };

  return <FlowCanvasContext.Provider value={value}>{children}</FlowCanvasContext.Provider>;
};

/**
 * useFlowCanvas Hook
 *
 * Custom React hook to access the FlowCanvasContext values in child components.
 *
 * @throws {Error} If used outside of FlowCanvasProvider
 * @returns {FlowCanvasContextValue} The flow canvas context values
 *
 * @example
 * function CanvasToolbar() {
 *   const { undo, redo, canUndo, canRedo } = useFlowCanvas();
 *
 *   return (
 *     <div>
 *       <button onClick={undo} disabled={!canUndo}>Undo</button>
 *       <button onClick={redo} disabled={!canRedo}>Redo</button>
 *     </div>
 *   );
 * }
 *
 * @example
 * function NodeList() {
 *   const { nodes, removeNode } = useFlowCanvas();
 *
 *   return (
 *     <ul>
 *       {nodes.map(node => (
 *         <li key={node.id}>
 *           {node.data.name}
 *           <button onClick={() => removeNode(node.id)}>Delete</button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 */
export const useFlowCanvas = (): FlowCanvasContextValue => {
  const context = useContext(FlowCanvasContext);

  if (!context) {
    throw new Error('useFlowCanvas must be used within FlowCanvasProvider');
  }

  return context;
};

export default FlowCanvasContext;
