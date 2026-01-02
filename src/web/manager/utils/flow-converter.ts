/**
 * Flow Data Converter Utility
 *
 * Converts between the existing Flow format (linear nodes with nextNodeId)
 * and React Flow format (nodes and edges arrays).
 *
 * This utility is critical for backward compatibility with existing flows
 * and enables the visual flow editor to work with the existing backend API.
 */

import type {
  Flow,
  FlowNode,
  InputNode,
  AgentNode,
  OutputNode,
  FlowNodeType,
} from '../types';
import type {
  ReactFlowNode,
  ReactFlowEdge,
  ReactFlowInputNode,
  ReactFlowAgentNode,
  ReactFlowOutputNode,
  InputNodeData,
  AgentNodeData,
  OutputNodeData,
  FlowToReactFlowResult,
} from '../types/react-flow.types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default spacing between nodes in the React Flow canvas
 */
const DEFAULT_NODE_SPACING_X = 300;
const DEFAULT_NODE_SPACING_Y = 150;

/**
 * Default starting position for the first node
 */
const DEFAULT_START_X = 100;
const DEFAULT_START_Y = 100;

// =============================================================================
// FLOW → REACT FLOW CONVERSION
// =============================================================================

/**
 * Convert existing Flow format to React Flow format
 *
 * This function transforms a Flow object with linear nodes (connected via nextNodeId)
 * into React Flow's node and edge arrays format.
 *
 * @param flow - The Flow object to convert
 * @returns Object containing React Flow nodes and edges arrays
 *
 * @example
 * ```typescript
 * const flow: Flow = {
 *   id: '1',
 *   name: 'My Flow',
 *   nodes: [inputNode, agentNode, outputNode],
 *   // ... other flow properties
 * };
 *
 * const { nodes, edges } = flowToReactFlow(flow);
 * // nodes: [ReactFlowInputNode, ReactFlowAgentNode, ReactFlowOutputNode]
 * // edges: [Edge connecting input→agent, Edge connecting agent→output]
 * ```
 */
export function flowToReactFlow(flow: Flow): FlowToReactFlowResult {
  const nodes: ReactFlowNode[] = [];
  const edges: ReactFlowEdge[] = [];

  // Convert each Flow node to React Flow node
  for (const flowNode of flow.nodes) {
    const reactFlowNode = convertFlowNodeToReactFlowNode(flowNode);
    nodes.push(reactFlowNode);

    // Create edge if this node has a next node
    if (flowNode.nextNodeId) {
      const edge: ReactFlowEdge = {
        id: `edge-${flowNode.nodeId}-${flowNode.nextNodeId}`,
        source: flowNode.nodeId,
        target: flowNode.nextNodeId,
        type: 'custom',
        data: {
          isDataTransfer: true,
          label: undefined,
        },
      };
      edges.push(edge);
    }
  }

  return { nodes, edges };
}

/**
 * Convert a single Flow node to React Flow node
 *
 * @param flowNode - The Flow node to convert
 * @returns React Flow node with appropriate type and data
 */
function convertFlowNodeToReactFlowNode(flowNode: FlowNode): ReactFlowNode {
  switch (flowNode.type) {
    case 'input':
      return convertInputNodeToReactFlow(flowNode);
    case 'agent':
      return convertAgentNodeToReactFlow(flowNode);
    case 'output':
      return convertOutputNodeToReactFlow(flowNode);
    default:
      throw new Error(`Unknown node type: ${(flowNode as any).type}`);
  }
}

/**
 * Convert Input node to React Flow format
 */
function convertInputNodeToReactFlow(node: InputNode): ReactFlowInputNode {
  const data: InputNodeData = {
    type: 'input',
    nodeId: node.nodeId,
    name: node.name,
    description: node.description,
    inputFields: node.inputFields,
    validationRules: node.validationRules,
    metadata: node.metadata,
  };

  return {
    id: node.nodeId,
    type: 'input',
    position: node.position,
    data,
  };
}

/**
 * Convert Agent node to React Flow format
 */
function convertAgentNodeToReactFlow(node: AgentNode): ReactFlowAgentNode {
  const data: AgentNodeData = {
    type: 'agent',
    nodeId: node.nodeId,
    name: node.name,
    description: node.description,
    agentId: node.agentId,
    agent: node.agent,
    promptTemplate: node.promptTemplate,
    skills: node.skills,
    modelOverride: node.modelOverride,
    maxTokens: node.maxTokens,
    timeout: node.timeout,
    retryOnError: node.retryOnError,
    maxRetries: node.maxRetries,
    metadata: node.metadata,
  };

  return {
    id: node.nodeId,
    type: 'agent',
    position: node.position,
    data,
  };
}

/**
 * Convert Output node to React Flow format
 */
function convertOutputNodeToReactFlow(node: OutputNode): ReactFlowOutputNode {
  const data: OutputNodeData = {
    type: 'output',
    nodeId: node.nodeId,
    name: node.name,
    description: node.description,
    outputType: node.outputType,
    format: node.format,
    saveToFile: node.saveToFile,
    filePath: node.filePath,
    fileName: node.fileName,
    includeMetadata: node.includeMetadata,
    includeTimestamp: node.includeTimestamp,
    transformTemplate: node.transformTemplate,
    webhookUrl: node.webhookUrl,
    webhookHeaders: node.webhookHeaders,
    metadata: node.metadata,
  };

  return {
    id: node.nodeId,
    type: 'output',
    position: node.position,
    data,
  };
}

// =============================================================================
// REACT FLOW → FLOW CONVERSION
// =============================================================================

/**
 * Convert React Flow format back to Flow format
 *
 * This function transforms React Flow nodes and edges back into the linear
 * Flow format with nextNodeId connections. This is essential for saving
 * visual flows to the backend.
 *
 * @param nodes - React Flow nodes array
 * @param edges - React Flow edges array
 * @returns Array of Flow nodes with nextNodeId properly set
 *
 * @example
 * ```typescript
 * const nodes: ReactFlowNode[] = [...];
 * const edges: ReactFlowEdge[] = [...];
 *
 * const flowNodes = reactFlowToFlow(nodes, edges);
 * // flowNodes: [InputNode, AgentNode, OutputNode] with nextNodeId set
 * ```
 */
export function reactFlowToFlow(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): FlowNode[] {
  const flowNodes: FlowNode[] = [];

  // Build a map of node connections from edges
  const nextNodeMap = buildNextNodeMap(edges);

  // Convert each React Flow node to Flow node
  for (const reactFlowNode of nodes) {
    const flowNode = convertReactFlowNodeToFlowNode(reactFlowNode, nextNodeMap);
    flowNodes.push(flowNode);
  }

  return flowNodes;
}

/**
 * Build a map of nodeId → nextNodeId from edges
 *
 * @param edges - React Flow edges array
 * @returns Map of source node ID to target node ID
 */
function buildNextNodeMap(edges: ReactFlowEdge[]): Map<string, string> {
  const nextNodeMap = new Map<string, string>();

  for (const edge of edges) {
    // For nodes with multiple outgoing edges, we'll use the first one
    // This maintains backward compatibility with the linear flow model
    if (!nextNodeMap.has(edge.source)) {
      nextNodeMap.set(edge.source, edge.target);
    }
  }

  return nextNodeMap;
}

/**
 * Convert a single React Flow node to Flow node
 *
 * @param reactFlowNode - The React Flow node to convert
 * @param nextNodeMap - Map of node ID to next node ID
 * @returns Flow node with nextNodeId set
 */
function convertReactFlowNodeToFlowNode(
  reactFlowNode: ReactFlowNode,
  nextNodeMap: Map<string, string>
): FlowNode {
  const nextNodeId = nextNodeMap.get(reactFlowNode.id) || null;

  switch (reactFlowNode.type) {
    case 'input':
      return convertReactFlowToInputNode(reactFlowNode, nextNodeId);
    case 'agent':
      return convertReactFlowToAgentNode(reactFlowNode, nextNodeId);
    case 'output':
      return convertReactFlowToOutputNode(reactFlowNode, nextNodeId);
    default:
      throw new Error(`Unknown node type: ${(reactFlowNode as any).type}`);
  }
}

/**
 * Convert React Flow Input node to Flow format
 */
function convertReactFlowToInputNode(
  node: ReactFlowInputNode,
  nextNodeId: string | null
): InputNode {
  const { data, position } = node;

  return {
    nodeId: data.nodeId,
    type: 'input',
    name: data.name,
    description: data.description,
    position,
    nextNodeId,
    inputFields: data.inputFields,
    validationRules: data.validationRules,
    metadata: data.metadata,
  };
}

/**
 * Convert React Flow Agent node to Flow format
 */
function convertReactFlowToAgentNode(
  node: ReactFlowAgentNode,
  nextNodeId: string | null
): AgentNode {
  const { data, position } = node;

  return {
    nodeId: data.nodeId,
    type: 'agent',
    name: data.name,
    description: data.description,
    position,
    nextNodeId,
    agentId: data.agentId,
    agent: data.agent,
    promptTemplate: data.promptTemplate,
    skills: data.skills,
    modelOverride: data.modelOverride,
    maxTokens: data.maxTokens,
    timeout: data.timeout,
    retryOnError: data.retryOnError,
    maxRetries: data.maxRetries,
    metadata: data.metadata,
  };
}

/**
 * Convert React Flow Output node to Flow format
 */
function convertReactFlowToOutputNode(
  node: ReactFlowOutputNode,
  nextNodeId: string | null
): OutputNode {
  const { data, position } = node;

  return {
    nodeId: data.nodeId,
    type: 'output',
    name: data.name,
    description: data.description,
    position,
    nextNodeId,
    outputType: data.outputType,
    format: data.format,
    saveToFile: data.saveToFile,
    filePath: data.filePath,
    fileName: data.fileName,
    includeMetadata: data.includeMetadata,
    includeTimestamp: data.includeTimestamp,
    transformTemplate: data.transformTemplate,
    webhookUrl: data.webhookUrl,
    webhookHeaders: data.webhookHeaders,
    metadata: data.metadata,
  };
}

// =============================================================================
// POSITION UTILITIES
// =============================================================================

/**
 * Auto-layout nodes in a horizontal flow
 *
 * This function automatically positions nodes in a left-to-right flow
 * based on their connections. Useful when loading flows that don't have
 * position data or when creating new flows.
 *
 * @param nodes - React Flow nodes array
 * @param edges - React Flow edges array
 * @returns New nodes array with updated positions
 *
 * @example
 * ```typescript
 * const nodes = autoLayoutNodes(nodes, edges);
 * // Nodes will be positioned in a horizontal flow from left to right
 * ```
 */
export function autoLayoutNodes(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): ReactFlowNode[] {
  // Build adjacency map to find node hierarchy
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();

  for (const edge of edges) {
    // Track incoming edges
    const incoming = incomingEdges.get(edge.target) || [];
    incoming.push(edge.source);
    incomingEdges.set(edge.target, incoming);

    // Track outgoing edges
    const outgoing = outgoingEdges.get(edge.source) || [];
    outgoing.push(edge.target);
    outgoingEdges.set(edge.source, outgoing);
  }

  // Find root nodes (nodes with no incoming edges)
  const rootNodes = nodes.filter((node) => !incomingEdges.has(node.id));

  // Position nodes level by level using BFS
  const positionedNodes = new Map<string, ReactFlowNode>();
  const queue: Array<{ nodeId: string; level: number; indexInLevel: number }> = [];

  // Initialize queue with root nodes
  rootNodes.forEach((node, index) => {
    queue.push({ nodeId: node.id, level: 0, indexInLevel: index });
  });

  // Track how many nodes are at each level for vertical spacing
  const nodesPerLevel = new Map<number, number>();

  // BFS to assign levels
  const visited = new Set<string>();
  while (queue.length > 0) {
    const { nodeId, level, indexInLevel } = queue.shift()!;

    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    // Find the original node
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      continue;
    }

    // Update nodes per level counter
    const currentCount = nodesPerLevel.get(level) || 0;
    nodesPerLevel.set(level, currentCount + 1);

    // Calculate position
    const x = DEFAULT_START_X + level * DEFAULT_NODE_SPACING_X;
    const y = DEFAULT_START_Y + indexInLevel * DEFAULT_NODE_SPACING_Y;

    // Create positioned node
    const positionedNode: ReactFlowNode = {
      ...node,
      position: { x, y },
    };
    positionedNodes.set(nodeId, positionedNode);

    // Add children to queue
    const children = outgoingEdges.get(nodeId) || [];
    children.forEach((childId, childIndex) => {
      if (!visited.has(childId)) {
        const levelNodeCount = nodesPerLevel.get(level + 1) || 0;
        queue.push({
          nodeId: childId,
          level: level + 1,
          indexInLevel: levelNodeCount,
        });
      }
    });
  }

  // Handle nodes that weren't visited (disconnected nodes)
  let disconnectedIndex = 0;
  for (const node of nodes) {
    if (!positionedNodes.has(node.id)) {
      const x = DEFAULT_START_X;
      const y = DEFAULT_START_Y + (rootNodes.length + disconnectedIndex) * DEFAULT_NODE_SPACING_Y;
      positionedNodes.set(node.id, {
        ...node,
        position: { x, y },
      });
      disconnectedIndex++;
    }
  }

  return Array.from(positionedNodes.values());
}

/**
 * Ensure all nodes have valid positions
 *
 * If any nodes are missing position data, this function assigns them
 * default positions to prevent rendering issues.
 *
 * @param nodes - React Flow nodes array
 * @returns Nodes array with all positions set
 */
export function ensureNodePositions(nodes: ReactFlowNode[]): ReactFlowNode[] {
  return nodes.map((node, index) => {
    if (!node.position || (node.position.x === 0 && node.position.y === 0)) {
      return {
        ...node,
        position: {
          x: DEFAULT_START_X,
          y: DEFAULT_START_Y + index * DEFAULT_NODE_SPACING_Y,
        },
      };
    }
    return node;
  });
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate that a Flow can be converted to React Flow format
 *
 * @param flow - The Flow to validate
 * @returns Object with isValid flag and array of error messages
 */
export function validateFlowForConversion(flow: Flow): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if flow has nodes
  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push('Flow must have at least one node');
  }

  // Check for duplicate node IDs
  const nodeIds = new Set<string>();
  for (const node of flow.nodes) {
    if (nodeIds.has(node.nodeId)) {
      errors.push(`Duplicate node ID found: ${node.nodeId}`);
    }
    nodeIds.add(node.nodeId);
  }

  // Check for invalid nextNodeId references
  for (const node of flow.nodes) {
    if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
      errors.push(
        `Node ${node.nodeId} references invalid nextNodeId: ${node.nextNodeId}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that React Flow nodes and edges can be converted to Flow format
 *
 * @param nodes - React Flow nodes array
 * @param edges - React Flow edges array
 * @returns Object with isValid flag and array of error messages
 */
export function validateReactFlowForConversion(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if there are nodes
  if (!nodes || nodes.length === 0) {
    errors.push('Must have at least one node');
  }

  // Check for duplicate node IDs
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID found: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  // Check for invalid edge references
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references invalid source: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references invalid target: ${edge.target}`);
    }
  }

  // Check for required data fields
  for (const node of nodes) {
    if (!node.data) {
      errors.push(`Node ${node.id} is missing data`);
      continue;
    }

    if (!node.data.nodeId) {
      errors.push(`Node ${node.id} is missing data.nodeId`);
    }

    if (!node.data.name) {
      errors.push(`Node ${node.id} is missing data.name`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  flowToReactFlow,
  reactFlowToFlow,
  autoLayoutNodes,
  ensureNodePositions,
  validateFlowForConversion,
  validateReactFlowForConversion,
};
