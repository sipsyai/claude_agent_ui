/**
 * Flow Canvas Component
 *
 * The main visual flow builder component that integrates React Flow with custom nodes,
 * drag-drop support, and connection handling. This component provides an interactive
 * canvas for creating and editing workflow diagrams similar to n8n and Langchain.
 *
 * ## Features
 * - **Custom Nodes**: Renders Input, Agent, and Output nodes with custom styling
 * - **Drag and Drop**: Supports dropping nodes from the NodePalette onto the canvas
 * - **Node Connections**: Animated edges with smooth bezier curves
 * - **Pan & Zoom**: Built-in controls for navigation
 * - **Minimap**: Overview navigation for large flows
 * - **Grid Background**: Alignment grid for visual organization
 * - **Selection Box**: Multi-select support with box selection
 * - **Keyboard Support**: Arrow keys for panning, delete for removing nodes
 * - **Context Integration**: Fully integrated with FlowCanvasContext
 *
 * ## Component Structure
 * ```
 * FlowCanvas
 *   ├── ReactFlowProvider (wraps React Flow instance)
 *   │   └── ReactFlow (main canvas)
 *   │       ├── Background (grid pattern)
 *   │       ├── Controls (zoom, pan controls)
 *   │       ├── MiniMap (navigation overview)
 *   │       └── Nodes (custom node components)
 *   └── Drop Zone (handles drag-drop from palette)
 * ```
 *
 * ## Drag and Drop Flow
 * 1. User drags a node from NodePalette
 * 2. Canvas detects dragOver event and prevents default
 * 3. User drops the node on canvas
 * 4. onDrop handler:
 *    - Reads node type from dataTransfer
 *    - Converts drop coordinates to canvas coordinates (screenToFlowPosition)
 *    - Creates new node via FlowCanvasContext.addNode
 * 5. Node appears on canvas at drop position
 *
 * ## Connection Flow
 * 1. User drags from a source handle to a target handle
 * 2. onConnect callback is triggered
 * 3. New edge is added via FlowCanvasContext.addEdge
 * 4. Edge appears with animated curve
 *
 * ## Selection Behavior
 * - **Single Select**: Click a node to select it
 * - **Multi Select**: Ctrl/Cmd + Click to add to selection
 * - **Box Select**: Click and drag on empty canvas
 * - **Clear Selection**: Click on empty canvas or press Escape
 *
 * ## Usage with FlowCanvasProvider
 * The FlowCanvas component must be wrapped in FlowCanvasProvider:
 *
 * @example
 * ```tsx
 * import { FlowCanvasProvider } from '@/contexts/FlowCanvasContext';
 * import FlowCanvas from '@/components/flow-canvas/FlowCanvas';
 * import NodePalette from '@/components/flow-canvas/NodePalette';
 *
 * function FlowEditor() {
 *   const handleCanvasChange = (nodes, edges) => {
 *     // Auto-save logic
 *     saveFlowToBackend(nodes, edges);
 *   };
 *
 *   return (
 *     <FlowCanvasProvider onCanvasChange={handleCanvasChange}>
 *       <div className="flex h-screen">
 *         <NodePalette />
 *         <FlowCanvas />
 *       </div>
 *     </FlowCanvasProvider>
 *   );
 * }
 * ```
 *
 * @example
 * // With initial data
 * ```tsx
 * <FlowCanvasProvider
 *   initialNodes={existingNodes}
 *   initialEdges={existingEdges}
 *   onCanvasChange={handleSave}
 * >
 *   <div className="flex h-screen">
 *     <NodePalette />
 *     <FlowCanvas />
 *   </div>
 * </FlowCanvasProvider>
 * ```
 */

import React, { useCallback, useRef, DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Connection,
  Edge,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  SelectionMode,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import { useFlowCanvas } from '../../contexts/FlowCanvasContext';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/react-flow.types';
import type { FlowNodeType } from '../../types';

/**
 * Props for the FlowCanvas component
 */
export interface FlowCanvasProps {
  /**
   * Optional CSS class name for the container
   */
  className?: string;
  /**
   * Whether to show the minimap (default: true)
   */
  showMinimap?: boolean;
  /**
   * Whether to show the controls (default: true)
   */
  showControls?: boolean;
  /**
   * Whether to show the grid background (default: true)
   */
  showBackground?: boolean;
  /**
   * Callback fired when a node is clicked
   */
  onNodeClick?: (nodeId: string, node: ReactFlowNode) => void;
  /**
   * Callback fired when the canvas is clicked (empty area)
   */
  onCanvasClick?: () => void;
}

/**
 * Inner component that has access to React Flow hooks
 * This must be inside ReactFlowProvider to use hooks like useReactFlow
 */
const FlowCanvasInner: React.FC<FlowCanvasProps> = ({
  className = '',
  showMinimap = true,
  showControls = true,
  showBackground = true,
  onNodeClick,
  onCanvasClick,
}) => {
  // Get context state and methods
  const {
    nodes,
    edges,
    addNode,
    addEdge,
    updateNode,
    removeNode,
    removeEdges,
    selectNode,
    clearSelection,
    selectedNodeIds,
  } = useFlowCanvas();

  // Get React Flow instance for coordinate conversion
  const { screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  /**
   * Handle drag over event
   * Required to enable dropping on the canvas
   */
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Handle drop event
   * Creates a new node at the drop position
   */
  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      // Get the node type from the drag data
      const nodeDataStr = event.dataTransfer.getData('application/reactflow');
      if (!nodeDataStr) return;

      try {
        const nodeData = JSON.parse(nodeDataStr);
        const nodeType = nodeData.nodeType as FlowNodeType;

        // Convert screen coordinates to flow coordinates
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Create a new node at the drop position
        addNode({
          type: nodeType,
          position,
          name: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
        });
      } catch (error) {
        // Silently fail if drag data is invalid
      }
    },
    [screenToFlowPosition, addNode]
  );

  /**
   * Handle new connections between nodes
   * Called when user connects two nodes via their handles
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Create edge with animated style
      addEdge({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'smoothstep', // Use smooth step edge for better visuals
        animated: true, // Animate the edge to show data flow
        style: {
          stroke: 'hsl(var(--primary))',
          strokeWidth: 2,
        },
      });
    },
    [addEdge]
  );

  /**
   * Handle node changes (position, selection, etc.)
   * This is called by React Flow when nodes are moved or updated
   */
  const onNodesChange: OnNodesChange<ReactFlowNode> = useCallback(
    (changes) => {
      // Apply changes to get updated nodes
      const updatedNodes = applyNodeChanges(changes, nodes);

      // Process each change to update our context
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          // Node was moved - update its position
          const node = nodes.find((n) => n.id === change.id);
          if (node) {
            updateNode(change.id, {
              position: change.position,
            });
          }
        } else if (change.type === 'remove') {
          // Node was removed (e.g., via delete key)
          removeNode(change.id);
        } else if (change.type === 'select') {
          // Node selection changed
          if (change.selected) {
            selectNode(change.id);
          }
        }
      });
    },
    [nodes, updateNode, removeNode, selectNode]
  );

  /**
   * Handle edge changes (selection, removal, etc.)
   * This is called by React Flow when edges are updated
   */
  const onEdgesChange: OnEdgesChange<ReactFlowEdge> = useCallback(
    (changes) => {
      // Apply changes to get updated edges
      const updatedEdges = applyEdgeChanges(changes, edges);

      // Process removals
      const removedIds = changes
        .filter((change) => change.type === 'remove')
        .map((change) => change.id);

      if (removedIds.length > 0) {
        removeEdges(removedIds);
      }
    },
    [edges, removeEdges]
  );

  /**
   * Handle node click
   * Selects the clicked node and fires callback
   */
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: ReactFlowNode) => {
      selectNode(node.id);
      onNodeClick?.(node.id, node);
    },
    [selectNode, onNodeClick]
  );

  /**
   * Handle pane click (empty canvas area)
   * Clears selection and fires callback
   */
  const handlePaneClick = useCallback(() => {
    clearSelection();
    onCanvasClick?.();
  }, [clearSelection, onCanvasClick]);

  /**
   * Update selected state on nodes based on context selection
   * React Flow uses the 'selected' property to highlight nodes
   */
  const nodesWithSelection = nodes.map((node) => ({
    ...node,
    selected: selectedNodeIds.includes(node.id),
  }));

  return (
    <div ref={reactFlowWrapper} className={`flex-1 h-full ${className}`}>
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes as any}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          animated: true,
          style: {
            stroke: 'hsl(var(--primary))',
            strokeWidth: 2,
          },
        }}
        // Enable selection box for multi-select
        selectionMode={SelectionMode.Partial}
        selectionOnDrag
        // Styling
        className="bg-background"
        style={{
          backgroundColor: 'hsl(var(--background))',
        }}
      >
        {/* Grid background for visual alignment */}
        {showBackground && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(var(--border))"
            style={{
              backgroundColor: 'hsl(var(--background))',
            }}
          />
        )}

        {/* Controls for zoom, pan, and fit view */}
        {showControls && <Controls showInteractive={false} />}

        {/* Minimap for navigation overview */}
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              // Color code minimap nodes by type
              switch (node.type) {
                case 'input':
                  return 'rgb(59, 130, 246)'; // blue-500
                case 'agent':
                  return 'rgb(168, 85, 247)'; // purple-500
                case 'output':
                  return 'rgb(34, 197, 94)'; // green-500
                default:
                  return 'rgb(100, 116, 139)'; // slate-500
              }
            }}
            maskColor="rgba(0, 0, 0, 0.2)"
            style={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
            }}
            pannable
            zoomable
          />
        )}

        {/* Info panel (optional) */}
        <Panel position="top-left" className="bg-background/80 backdrop-blur-sm px-3 py-2 rounded-md border border-border">
          <div className="text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">{nodes.length}</strong> nodes,{' '}
              <strong className="text-foreground">{edges.length}</strong> connections
            </p>
            {selectedNodeIds.length > 0 && (
              <p className="mt-1">
                <strong className="text-foreground">{selectedNodeIds.length}</strong> selected
              </p>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

/**
 * FlowCanvas Component
 *
 * Main component that wraps FlowCanvasInner with ReactFlowProvider.
 * This ensures React Flow hooks are available in the inner component.
 */
export const FlowCanvas: React.FC<FlowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

/**
 * Display name for React DevTools
 */
FlowCanvas.displayName = 'FlowCanvas';

export default FlowCanvas;
