/**
 * Connection Validation Utility
 *
 * Validates connections between React Flow nodes to prevent invalid connections
 * such as output-to-output, input-to-input, and cycles. This provides real-time
 * validation as users create connections on the canvas.
 *
 * ## Validation Rules
 * - Connections must go from source handle to target handle (React Flow enforces this)
 * - Cannot connect a node to itself (self-loops)
 * - Cannot create duplicate connections between the same nodes
 * - Cannot create cycles in the flow graph
 * - Validates handle types (source must connect to target)
 *
 * ## Usage with React Flow
 * ```typescript
 * import { createIsValidConnection } from './utils/connection-validator';
 *
 * function FlowCanvas() {
 *   const { nodes, edges } = useFlowCanvas();
 *   const isValidConnection = createIsValidConnection(nodes, edges);
 *
 *   return (
 *     <ReactFlow
 *       nodes={nodes}
 *       edges={edges}
 *       isValidConnection={isValidConnection}
 *     />
 *   );
 * }
 * ```
 *
 * ## React Flow Handle Types
 * React Flow automatically prevents:
 * - Connecting source-to-source (output-to-output)
 * - Connecting target-to-target (input-to-input)
 * - Connecting to the wrong handle type
 *
 * This utility adds additional business logic validation on top of React Flow's built-in validation.
 */

import type { Connection, Node } from '@xyflow/react';
import type { ReactFlowNode, ReactFlowEdge } from '../types/react-flow.types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of connection validation
 */
export interface ConnectionValidationResult {
  /** Whether the connection is valid */
  isValid: boolean;
  /** Reason why the connection is invalid (if applicable) */
  reason?: string;
  /** Error code for categorization */
  code?: string;
}

/**
 * Connection validation error codes
 */
export const ConnectionErrorCode = {
  /** Cannot connect a node to itself */
  SELF_CONNECTION: 'SELF_CONNECTION',
  /** Duplicate connection already exists */
  DUPLICATE_CONNECTION: 'DUPLICATE_CONNECTION',
  /** Connection would create a cycle */
  CREATES_CYCLE: 'CREATES_CYCLE',
  /** Missing required connection data */
  MISSING_DATA: 'MISSING_DATA',
  /** Source or target node not found */
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
} as const;

// =============================================================================
// CYCLE DETECTION
// =============================================================================

/**
 * Build adjacency list from edges for cycle detection
 *
 * @param edges - Array of React Flow edges
 * @returns Adjacency list mapping node IDs to their children
 *
 * @example
 * ```typescript
 * const edges = [
 *   { source: 'A', target: 'B' },
 *   { source: 'B', target: 'C' },
 * ];
 * const adjacencyList = buildAdjacencyList(edges);
 * // { 'A': ['B'], 'B': ['C'], 'C': [] }
 * ```
 */
function buildAdjacencyList(edges: ReactFlowEdge[]): Map<string, string[]> {
  const adjacencyList = new Map<string, string[]>();

  edges.forEach((edge) => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push(edge.target);
  });

  return adjacencyList;
}

/**
 * Detect if adding a connection would create a cycle using DFS
 *
 * A cycle exists if we can reach the source node starting from the target node
 * by following the directed edges. This implements a depth-first search (DFS)
 * to detect cycles.
 *
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param edges - Current edges in the graph
 * @returns True if adding the connection would create a cycle
 *
 * @example
 * ```typescript
 * const edges = [
 *   { source: 'A', target: 'B' },
 *   { source: 'B', target: 'C' },
 * ];
 *
 * // This would create a cycle: A -> B -> C -> A
 * wouldCreateCycle('C', 'A', edges); // true
 *
 * // This would not create a cycle: A -> B -> C -> D
 * wouldCreateCycle('C', 'D', edges); // false
 * ```
 */
function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: ReactFlowEdge[]
): boolean {
  // Build adjacency list with the potential new edge
  const adjacencyList = buildAdjacencyList([
    ...edges,
    { id: 'temp', source: sourceId, target: targetId } as ReactFlowEdge,
  ]);

  // DFS to detect cycles starting from the source node
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  /**
   * Recursive DFS helper function
   * @param nodeId - Current node being visited
   * @returns True if a cycle is detected
   */
  function dfs(nodeId: string): boolean {
    // Mark node as visited and add to recursion stack
    visited.add(nodeId);
    recursionStack.add(nodeId);

    // Visit all children
    const children = adjacencyList.get(nodeId) || [];
    for (const childId of children) {
      // If child is not visited, recursively check for cycles
      if (!visited.has(childId)) {
        if (dfs(childId)) {
          return true; // Cycle detected
        }
      }
      // If child is in recursion stack, we found a cycle
      else if (recursionStack.has(childId)) {
        return true; // Cycle detected
      }
    }

    // Remove from recursion stack before backtracking
    recursionStack.delete(nodeId);
    return false;
  }

  // Start DFS from the source node
  return dfs(sourceId);
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a connection already exists between two nodes
 *
 * @param connection - Connection to check
 * @param edges - Existing edges
 * @returns True if a connection already exists
 */
function isDuplicateConnection(
  connection: Connection,
  edges: ReactFlowEdge[]
): boolean {
  return edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (edge.sourceHandle || null) === (connection.sourceHandle || null) &&
      (edge.targetHandle || null) === (connection.targetHandle || null)
  );
}

/**
 * Validate a connection attempt
 *
 * Performs comprehensive validation of a connection including:
 * - Self-connection check
 * - Duplicate connection check
 * - Cycle detection
 * - Node existence check
 *
 * @param connection - Connection to validate
 * @param nodes - Current nodes in the canvas
 * @param edges - Current edges in the canvas
 * @returns Validation result with error details if invalid
 *
 * @example
 * ```typescript
 * const result = validateConnection(
 *   { source: 'node-1', target: 'node-2' },
 *   nodes,
 *   edges
 * );
 *
 * if (!result.isValid) {
 *   console.error(`Invalid connection: ${result.reason}`);
 * }
 * ```
 */
export function validateConnection(
  connection: Connection,
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): ConnectionValidationResult {
  // Check for required data
  if (!connection.source || !connection.target) {
    return {
      isValid: false,
      reason: 'Connection must have both source and target',
      code: ConnectionErrorCode.MISSING_DATA,
    };
  }

  // Check if nodes exist
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return {
      isValid: false,
      reason: 'Source or target node not found',
      code: ConnectionErrorCode.NODE_NOT_FOUND,
    };
  }

  // Prevent self-connections (node connecting to itself)
  if (connection.source === connection.target) {
    return {
      isValid: false,
      reason: 'Cannot connect a node to itself',
      code: ConnectionErrorCode.SELF_CONNECTION,
    };
  }

  // Prevent duplicate connections
  if (isDuplicateConnection(connection, edges)) {
    return {
      isValid: false,
      reason: 'Connection already exists between these nodes',
      code: ConnectionErrorCode.DUPLICATE_CONNECTION,
    };
  }

  // Prevent cycles in the flow graph
  if (wouldCreateCycle(connection.source, connection.target, edges)) {
    return {
      isValid: false,
      reason: 'Cannot create cyclic connections in the flow',
      code: ConnectionErrorCode.CREATES_CYCLE,
    };
  }

  // Connection is valid
  return {
    isValid: true,
  };
}

/**
 * Create an isValidConnection function for React Flow
 *
 * This factory function creates a validation function that can be passed
 * directly to React Flow's `isValidConnection` prop. The returned function
 * captures the current nodes and edges in its closure.
 *
 * @param nodes - Current nodes in the canvas
 * @param edges - Current edges in the canvas
 * @returns A function that validates connections for React Flow
 *
 * @example
 * ```typescript
 * function FlowCanvas() {
 *   const { nodes, edges } = useFlowCanvas();
 *   const isValidConnection = createIsValidConnection(nodes, edges);
 *
 *   return (
 *     <ReactFlow
 *       nodes={nodes}
 *       edges={edges}
 *       isValidConnection={isValidConnection}
 *       onConnect={handleConnect}
 *     />
 *   );
 * }
 * ```
 *
 * @remarks
 * React Flow's built-in validation already prevents:
 * - Source-to-source connections (output-to-output)
 * - Target-to-target connections (input-to-input)
 * - Invalid handle type connections
 *
 * This function adds additional business logic validation:
 * - Self-connections (node to itself)
 * - Duplicate connections
 * - Cycle detection
 */
export function createIsValidConnection(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): (connection: Connection | ReactFlowEdge) => boolean {
  return (connection: Connection | ReactFlowEdge) => {
    // Convert ReactFlowEdge to Connection format if needed
    const conn: Connection = 'id' in connection
      ? {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? null,
        }
      : connection;

    const result = validateConnection(conn, nodes, edges);
    return result.isValid;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a human-readable error message for a connection validation error
 *
 * @param code - Error code from ConnectionErrorCode
 * @returns User-friendly error message
 */
export function getConnectionErrorMessage(code: string): string {
  switch (code) {
    case ConnectionErrorCode.SELF_CONNECTION:
      return 'A node cannot connect to itself';
    case ConnectionErrorCode.DUPLICATE_CONNECTION:
      return 'This connection already exists';
    case ConnectionErrorCode.CREATES_CYCLE:
      return 'This connection would create a cycle in the flow';
    case ConnectionErrorCode.MISSING_DATA:
      return 'Invalid connection data';
    case ConnectionErrorCode.NODE_NOT_FOUND:
      return 'Source or target node not found';
    default:
      return 'Invalid connection';
  }
}

/**
 * Check if a node has any outgoing connections
 *
 * @param nodeId - Node ID to check
 * @param edges - Current edges
 * @returns True if the node has outgoing connections
 */
export function hasOutgoingConnections(nodeId: string, edges: ReactFlowEdge[]): boolean {
  return edges.some((edge) => edge.source === nodeId);
}

/**
 * Check if a node has any incoming connections
 *
 * @param nodeId - Node ID to check
 * @param edges - Current edges
 * @returns True if the node has incoming connections
 */
export function hasIncomingConnections(nodeId: string, edges: ReactFlowEdge[]): boolean {
  return edges.some((edge) => edge.target === nodeId);
}

/**
 * Get all nodes that are connected to a given node (both incoming and outgoing)
 *
 * @param nodeId - Node ID to find connections for
 * @param edges - Current edges
 * @returns Array of connected node IDs
 */
export function getConnectedNodeIds(nodeId: string, edges: ReactFlowEdge[]): string[] {
  const connectedIds = new Set<string>();

  edges.forEach((edge) => {
    if (edge.source === nodeId) {
      connectedIds.add(edge.target);
    }
    if (edge.target === nodeId) {
      connectedIds.add(edge.source);
    }
  });

  return Array.from(connectedIds);
}

/**
 * Find all paths between two nodes using BFS
 *
 * This is useful for debugging and understanding flow structure.
 *
 * @param startId - Starting node ID
 * @param endId - Ending node ID
 * @param edges - Current edges
 * @returns Array of paths (each path is an array of node IDs)
 *
 * @example
 * ```typescript
 * const paths = findPathsBetweenNodes('A', 'D', edges);
 * // [[A, B, D], [A, C, D]]
 * ```
 */
export function findPathsBetweenNodes(
  startId: string,
  endId: string,
  edges: ReactFlowEdge[]
): string[][] {
  const adjacencyList = buildAdjacencyList(edges);
  const paths: string[][] = [];

  /**
   * Recursive DFS to find all paths
   */
  function dfs(currentId: string, path: string[], visited: Set<string>) {
    // Add current node to path
    path.push(currentId);
    visited.add(currentId);

    // If we reached the end, save this path
    if (currentId === endId) {
      paths.push([...path]);
    } else {
      // Continue exploring
      const children = adjacencyList.get(currentId) || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          dfs(childId, path, visited);
        }
      }
    }

    // Backtrack
    path.pop();
    visited.delete(currentId);
  }

  dfs(startId, [], new Set());
  return paths;
}

/**
 * Check if there's a path from source to target
 *
 * This is useful for verifying connectivity in the flow.
 *
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param edges - Current edges
 * @returns True if a path exists from source to target
 */
export function hasPath(
  sourceId: string,
  targetId: string,
  edges: ReactFlowEdge[]
): boolean {
  const adjacencyList = buildAdjacencyList(edges);
  const visited = new Set<string>();

  /**
   * BFS to find path
   */
  function bfs(): boolean {
    const queue: string[] = [sourceId];
    visited.add(sourceId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === targetId) {
        return true;
      }

      const children = adjacencyList.get(currentId) || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push(childId);
        }
      }
    }

    return false;
  }

  return bfs();
}
