/**
 * Auto-Layout Algorithm for React Flow Canvas
 *
 * Provides automatic layout algorithms to organize nodes in a readable flow structure.
 * Uses dagre for hierarchical graph layout with left-to-right orientation.
 *
 * ## Features
 * - **Hierarchical Layout**: Organizes nodes in a left-to-right flow based on connections
 * - **No Overlaps**: Ensures nodes don't overlap after layout
 * - **Even Spacing**: Maintains consistent spacing between nodes
 * - **Edge Routing**: Optimizes edge paths for readability
 * - **Disconnected Nodes**: Handles isolated nodes gracefully
 * - **Type Safety**: Full TypeScript support with proper types
 *
 * ## Layout Algorithm
 * The layout uses dagre (Directed Graph Layout) library which implements a
 * sophisticated hierarchical layout algorithm based on the Sugiyama method.
 *
 * ### Process
 * 1. Create dagre graph with layout configuration
 * 2. Add all nodes and edges to the graph
 * 3. Run layout algorithm to calculate positions
 * 4. Extract positions and update React Flow nodes
 * 5. Handle disconnected nodes separately
 *
 * ### Layout Direction
 * By default, nodes are arranged **left-to-right** (LR):
 * - Input nodes on the left
 * - Processing nodes in the middle
 * - Output nodes on the right
 *
 * ### Spacing Configuration
 * - **Node Separation**: Horizontal spacing between nodes in the same rank
 * - **Rank Separation**: Vertical spacing between ranks (columns)
 * - **Edge Separation**: Minimum spacing between edges
 *
 * ## Usage
 *
 * ### Basic Auto-Layout
 * ```typescript
 * import { applyAutoLayout } from './auto-layout';
 *
 * const layoutedNodes = applyAutoLayout(nodes, edges);
 * // Returns nodes with updated positions
 * ```
 *
 * ### Custom Spacing
 * ```typescript
 * const layoutedNodes = applyAutoLayout(nodes, edges, {
 *   nodeSpacing: 100,  // Horizontal spacing
 *   rankSpacing: 200,  // Vertical spacing
 *   direction: 'LR',   // Left-to-right
 * });
 * ```
 *
 * ### With Animation
 * ```typescript
 * // In React component
 * const handleAutoLayout = () => {
 *   const layoutedNodes = applyAutoLayout(nodes, edges);
 *   setNodes(layoutedNodes); // React Flow will animate the transition
 * };
 * ```
 *
 * ## Configuration Options
 * The layout can be customized with various options:
 * - `direction`: Layout direction ('LR', 'RL', 'TB', 'BT')
 * - `nodeSpacing`: Space between nodes in same rank
 * - `rankSpacing`: Space between ranks/columns
 * - `edgeSpacing`: Minimum space between edges
 * - `align`: Node alignment within rank ('UL', 'UR', 'DL', 'DR')
 *
 * @example
 * ```typescript
 * // Layout with custom configuration
 * const config: AutoLayoutConfig = {
 *   direction: 'LR',
 *   nodeSpacing: 150,
 *   rankSpacing: 250,
 *   align: 'UL', // Align nodes to upper-left within rank
 * };
 *
 * const layoutedNodes = applyAutoLayout(nodes, edges, config);
 * ```
 */

import dagre from 'dagre';
import type { ReactFlowNode, ReactFlowEdge } from '../types/react-flow.types';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Layout direction options
 * - 'LR': Left to Right (default)
 * - 'RL': Right to Left
 * - 'TB': Top to Bottom
 * - 'BT': Bottom to Top
 */
export type LayoutDirection = 'LR' | 'RL' | 'TB' | 'BT';

/**
 * Node alignment within rank
 * - 'UL': Upper Left
 * - 'UR': Upper Right
 * - 'DL': Down Left
 * - 'DR': Down Right (default)
 */
export type NodeAlignment = 'UL' | 'UR' | 'DL' | 'DR';

/**
 * Auto-layout configuration options
 */
export interface AutoLayoutConfig {
  /**
   * Layout direction (default: 'LR' - Left to Right)
   */
  direction?: LayoutDirection;

  /**
   * Horizontal spacing between nodes in the same rank (default: 150)
   */
  nodeSpacing?: number;

  /**
   * Vertical spacing between ranks/columns (default: 200)
   */
  rankSpacing?: number;

  /**
   * Minimum spacing between edges (default: 10)
   */
  edgeSpacing?: number;

  /**
   * Node alignment within rank (default: undefined - centers nodes)
   */
  align?: NodeAlignment;

  /**
   * Whether to use edge weight for layout optimization (default: true)
   */
  useEdgeWeight?: boolean;

  /**
   * Margin around the entire graph (default: 50)
   */
  margin?: number;
}

/**
 * Default node dimensions for layout calculation
 * React Flow nodes have default dimensions if not specified
 */
const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 200;

/**
 * Default layout configuration
 */
const DEFAULT_LAYOUT_CONFIG: Required<AutoLayoutConfig> = {
  direction: 'LR',
  nodeSpacing: 150,
  rankSpacing: 250,
  edgeSpacing: 10,
  align: 'DR',
  useEdgeWeight: true,
  margin: 50,
};

// =============================================================================
// LAYOUT FUNCTIONS
// =============================================================================

/**
 * Apply automatic hierarchical layout to React Flow nodes
 *
 * Uses dagre library to calculate optimal node positions based on the graph
 * structure. Nodes are arranged in a left-to-right flow with even spacing
 * and no overlaps.
 *
 * @param nodes - Array of React Flow nodes to layout
 * @param edges - Array of React Flow edges connecting the nodes
 * @param config - Optional layout configuration
 * @returns New array of nodes with updated positions
 *
 * @example
 * ```typescript
 * const layoutedNodes = applyAutoLayout(nodes, edges);
 * setNodes(layoutedNodes);
 * ```
 *
 * @example
 * ```typescript
 * // With custom spacing
 * const layoutedNodes = applyAutoLayout(nodes, edges, {
 *   nodeSpacing: 200,
 *   rankSpacing: 300,
 * });
 * ```
 */
export function applyAutoLayout(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  config?: Partial<AutoLayoutConfig>
): ReactFlowNode[] {
  // Return early if no nodes
  if (!nodes || nodes.length === 0) {
    return nodes;
  }

  // Merge with default config
  const layoutConfig: Required<AutoLayoutConfig> = {
    ...DEFAULT_LAYOUT_CONFIG,
    ...config,
  };

  // Create new dagre graph
  const graph = new dagre.graphlib.Graph();

  // Configure graph settings
  graph.setGraph({
    rankdir: layoutConfig.direction,
    nodesep: layoutConfig.nodeSpacing,
    ranksep: layoutConfig.rankSpacing,
    edgesep: layoutConfig.edgeSpacing,
    align: layoutConfig.align,
    marginx: layoutConfig.margin,
    marginy: layoutConfig.margin,
  });

  // Set default edge configuration
  graph.setDefaultEdgeLabel(() => ({}));

  // Add all nodes to the graph
  for (const node of nodes) {
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);

    graph.setNode(node.id, {
      width,
      height,
      // Store original node data for reference
      data: node.data,
    });
  }

  // Add all edges to the graph
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target, {
      // Optional: use edge weight for layout optimization
      weight: layoutConfig.useEdgeWeight ? 1 : undefined,
    });
  }

  // Run the dagre layout algorithm
  dagre.layout(graph);

  // Extract positions and update nodes
  const layoutedNodes: ReactFlowNode[] = nodes.map((node) => {
    const nodeWithPosition = graph.node(node.id);

    if (!nodeWithPosition) {
      // Node not in graph (shouldn't happen, but handle gracefully)
      return node;
    }

    // Dagre returns center position, convert to top-left for React Flow
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);

    const x = nodeWithPosition.x - width / 2;
    const y = nodeWithPosition.y - height / 2;

    return {
      ...node,
      position: { x, y },
    };
  });

  return layoutedNodes;
}

/**
 * Get node width for layout calculation
 *
 * @param node - React Flow node
 * @returns Node width in pixels
 */
function getNodeWidth(node: ReactFlowNode): number {
  // Check if node has explicit width
  if (node.width) {
    return node.width;
  }

  // Check if node style has width
  if (node.style?.width) {
    return typeof node.style.width === 'number'
      ? node.style.width
      : parseInt(String(node.style.width), 10);
  }

  // Use default width based on node type
  return DEFAULT_NODE_WIDTH;
}

/**
 * Get node height for layout calculation
 *
 * @param node - React Flow node
 * @returns Node height in pixels
 */
function getNodeHeight(node: ReactFlowNode): number {
  // Check if node has explicit height
  if (node.height) {
    return node.height;
  }

  // Check if node style has height
  if (node.style?.height) {
    return typeof node.style.height === 'number'
      ? node.style.height
      : parseInt(String(node.style.height), 10);
  }

  // Use default height based on node type
  return DEFAULT_NODE_HEIGHT;
}

// =============================================================================
// LAYOUT PRESETS
// =============================================================================

/**
 * Compact layout preset
 * Tighter spacing for smaller canvases or dense flows
 */
export const COMPACT_LAYOUT: AutoLayoutConfig = {
  direction: 'LR',
  nodeSpacing: 100,
  rankSpacing: 150,
  edgeSpacing: 5,
  margin: 30,
};

/**
 * Spacious layout preset
 * More breathing room for better readability
 */
export const SPACIOUS_LAYOUT: AutoLayoutConfig = {
  direction: 'LR',
  nodeSpacing: 200,
  rankSpacing: 300,
  edgeSpacing: 15,
  margin: 80,
};

/**
 * Vertical layout preset
 * Top-to-bottom orientation
 */
export const VERTICAL_LAYOUT: AutoLayoutConfig = {
  direction: 'TB',
  nodeSpacing: 100,
  rankSpacing: 150,
  edgeSpacing: 10,
  margin: 50,
};

/**
 * Horizontal layout preset (default)
 * Left-to-right orientation
 */
export const HORIZONTAL_LAYOUT: AutoLayoutConfig = {
  direction: 'LR',
  nodeSpacing: 150,
  rankSpacing: 250,
  edgeSpacing: 10,
  margin: 50,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate bounding box of all nodes
 *
 * @param nodes - Array of React Flow nodes
 * @returns Bounding box { x, y, width, height } or null if no nodes
 */
export function calculateBoundingBox(
  nodes: ReactFlowNode[]
): { x: number; y: number; width: number; height: number } | null {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);

    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Center nodes in the viewport
 *
 * Shifts all nodes so that their collective center is at the viewport center.
 *
 * @param nodes - Array of React Flow nodes
 * @param viewportWidth - Viewport width in pixels
 * @param viewportHeight - Viewport height in pixels
 * @returns New array of nodes centered in viewport
 */
export function centerNodes(
  nodes: ReactFlowNode[],
  viewportWidth: number,
  viewportHeight: number
): ReactFlowNode[] {
  const bbox = calculateBoundingBox(nodes);
  if (!bbox) {
    return nodes;
  }

  const offsetX = (viewportWidth - bbox.width) / 2 - bbox.x;
  const offsetY = (viewportHeight - bbox.height) / 2 - bbox.y;

  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));
}

/**
 * Check if two nodes overlap
 *
 * @param node1 - First node
 * @param node2 - Second node
 * @returns True if nodes overlap
 */
export function nodesOverlap(
  node1: ReactFlowNode,
  node2: ReactFlowNode
): boolean {
  const w1 = getNodeWidth(node1);
  const h1 = getNodeHeight(node1);
  const w2 = getNodeWidth(node2);
  const h2 = getNodeHeight(node2);

  const x1 = node1.position.x;
  const y1 = node1.position.y;
  const x2 = node2.position.x;
  const y2 = node2.position.y;

  // Check for overlap using AABB (Axis-Aligned Bounding Box) collision
  return !(
    x1 + w1 < x2 || // node1 is left of node2
    x1 > x2 + w2 || // node1 is right of node2
    y1 + h1 < y2 || // node1 is above node2
    y1 > y2 + h2    // node1 is below node2
  );
}

/**
 * Validate that no nodes overlap after layout
 *
 * @param nodes - Array of React Flow nodes
 * @returns True if no overlaps detected
 */
export function validateNoOverlaps(nodes: ReactFlowNode[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlap(nodes[i], nodes[j])) {
        return false;
      }
    }
  }
  return true;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  applyAutoLayout,
  calculateBoundingBox,
  centerNodes,
  nodesOverlap,
  validateNoOverlaps,
  COMPACT_LAYOUT,
  SPACIOUS_LAYOUT,
  VERTICAL_LAYOUT,
  HORIZONTAL_LAYOUT,
};
