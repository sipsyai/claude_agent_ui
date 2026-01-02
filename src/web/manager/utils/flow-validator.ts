/**
 * Flow Validation Utility
 *
 * Validates React Flow canvases to ensure flows have proper structure
 * before they can be saved and executed. Checks for required node types,
 * proper connections, and node configuration completeness.
 *
 * ## Validation Rules
 * - At least one input node (data entry point)
 * - At least one output node (data exit point)
 * - All nodes must be connected (no orphaned nodes)
 * - Input nodes must have at least one output connection
 * - Output nodes must have at least one input connection
 * - Agent nodes must be properly configured
 *
 * ## Usage
 * ```typescript
 * const result = validateFlow(nodes, edges);
 * if (!result.isValid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */

import type {
  ReactFlowNode,
  ReactFlowEdge,
  FlowValidationResult,
  NodeValidationError,
} from '../types/react-flow.types';
import {
  isReactFlowInputNode,
  isReactFlowAgentNode,
  isReactFlowOutputNode,
} from '../types/react-flow.types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Extended validation error with severity
 */
export interface ExtendedValidationError extends NodeValidationError {
  severity: ValidationSeverity;
  code: string;
}

/**
 * Extended validation result with warnings
 */
export interface ExtendedFlowValidationResult {
  isValid: boolean;
  errors: ExtendedValidationError[];
  warnings: ExtendedValidationError[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Validation error codes for categorization
 */
export const ValidationErrorCode = {
  NO_INPUT_NODE: 'NO_INPUT_NODE',
  NO_OUTPUT_NODE: 'NO_OUTPUT_NODE',
  ORPHANED_NODE: 'ORPHANED_NODE',
  INPUT_NO_CONNECTIONS: 'INPUT_NO_CONNECTIONS',
  OUTPUT_NO_CONNECTIONS: 'OUTPUT_NO_CONNECTIONS',
  AGENT_NO_PROMPT: 'AGENT_NO_PROMPT',
  AGENT_NO_AGENT_ID: 'AGENT_NO_AGENT_ID',
  INPUT_NO_FIELDS: 'INPUT_NO_FIELDS',
  OUTPUT_INVALID_CONFIG: 'OUTPUT_INVALID_CONFIG',
  MULTIPLE_INPUTS: 'MULTIPLE_INPUTS',
  MULTIPLE_OUTPUTS: 'MULTIPLE_OUTPUTS',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  DISCONNECTED_SUBGRAPH: 'DISCONNECTED_SUBGRAPH',
} as const;

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a flow for structural integrity and completeness
 *
 * Performs comprehensive validation including:
 * - Required node types (input, output)
 * - Node connectivity (no orphans)
 * - Node configuration completeness
 * - Circular dependency detection
 *
 * @param nodes - Array of React Flow nodes
 * @param edges - Array of React Flow edges
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const { isValid, errors, warnings } = validateFlow(nodes, edges);
 *
 * if (!isValid) {
 *   errors.forEach(error => {
 *     console.error(`${error.code}: ${error.message} (node: ${error.nodeId})`);
 *   });
 * }
 *
 * if (warnings.length > 0) {
 *   warnings.forEach(warning => {
 *     console.warn(`${warning.code}: ${warning.message}`);
 *   });
 * }
 * ```
 */
export function validateFlow(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): ExtendedFlowValidationResult {
  const errors: ExtendedValidationError[] = [];
  const warnings: ExtendedValidationError[] = [];

  // Empty canvas check
  if (nodes.length === 0) {
    errors.push({
      nodeId: '',
      message: 'Flow must have at least one node',
      severity: 'error',
      code: ValidationErrorCode.NO_INPUT_NODE,
    });
    return {
      isValid: false,
      errors,
      warnings,
      hasErrors: true,
      hasWarnings: false,
    };
  }

  // Run all validation checks
  validateRequiredNodeTypes(nodes, errors, warnings);
  validateNodeConnectivity(nodes, edges, errors, warnings);
  validateNodeConfiguration(nodes, errors, warnings);
  validateCircularDependencies(nodes, edges, errors, warnings);

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return {
    isValid: !hasErrors,
    errors,
    warnings,
    hasErrors,
    hasWarnings,
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate that flow has required node types (input and output)
 */
function validateRequiredNodeTypes(
  nodes: ReactFlowNode[],
  errors: ExtendedValidationError[],
  warnings: ExtendedValidationError[]
): void {
  const inputNodes = nodes.filter(isReactFlowInputNode);
  const outputNodes = nodes.filter(isReactFlowOutputNode);

  // Must have at least one input node
  if (inputNodes.length === 0) {
    errors.push({
      nodeId: '',
      message: 'Flow must have at least one Input node (data entry point)',
      severity: 'error',
      code: ValidationErrorCode.NO_INPUT_NODE,
    });
  }

  // Must have at least one output node
  if (outputNodes.length === 0) {
    errors.push({
      nodeId: '',
      message: 'Flow must have at least one Output node (data exit point)',
      severity: 'error',
      code: ValidationErrorCode.NO_OUTPUT_NODE,
    });
  }

  // Warning if multiple input nodes (might be intentional for complex flows)
  if (inputNodes.length > 1) {
    warnings.push({
      nodeId: '',
      message: `Flow has ${inputNodes.length} Input nodes. This may cause ambiguity in flow execution.`,
      severity: 'warning',
      code: ValidationErrorCode.MULTIPLE_INPUTS,
    });
  }

  // Warning if multiple output nodes (might be intentional)
  if (outputNodes.length > 1) {
    warnings.push({
      nodeId: '',
      message: `Flow has ${outputNodes.length} Output nodes. Only the first reachable output will be used.`,
      severity: 'warning',
      code: ValidationErrorCode.MULTIPLE_OUTPUTS,
    });
  }
}

/**
 * Validate that all nodes are properly connected (no orphaned nodes)
 */
function validateNodeConnectivity(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  errors: ExtendedValidationError[],
  warnings: ExtendedValidationError[]
): void {
  if (nodes.length === 0) return;

  // Build adjacency maps
  const outgoingEdges = new Map<string, string[]>();
  const incomingEdges = new Map<string, string[]>();

  for (const edge of edges) {
    // Outgoing edges
    const outgoing = outgoingEdges.get(edge.source) || [];
    outgoing.push(edge.target);
    outgoingEdges.set(edge.source, outgoing);

    // Incoming edges
    const incoming = incomingEdges.get(edge.target) || [];
    incoming.push(edge.source);
    incomingEdges.set(edge.target, incoming);
  }

  // Check each node for connectivity
  for (const node of nodes) {
    const hasIncoming = incomingEdges.has(node.id);
    const hasOutgoing = outgoingEdges.has(node.id);

    // Input nodes must have at least one outgoing connection
    if (isReactFlowInputNode(node) && !hasOutgoing) {
      errors.push({
        nodeId: node.id,
        message: `Input node "${node.data.name}" has no outgoing connections`,
        severity: 'error',
        code: ValidationErrorCode.INPUT_NO_CONNECTIONS,
      });
    }

    // Output nodes must have at least one incoming connection
    if (isReactFlowOutputNode(node) && !hasIncoming) {
      errors.push({
        nodeId: node.id,
        message: `Output node "${node.data.name}" has no incoming connections`,
        severity: 'error',
        code: ValidationErrorCode.OUTPUT_NO_CONNECTIONS,
      });
    }

    // Agent nodes should have both incoming and outgoing connections
    if (isReactFlowAgentNode(node)) {
      if (!hasIncoming) {
        warnings.push({
          nodeId: node.id,
          message: `Agent node "${node.data.name}" has no incoming connections (unreachable)`,
          severity: 'warning',
          code: ValidationErrorCode.ORPHANED_NODE,
        });
      }
      if (!hasOutgoing) {
        warnings.push({
          nodeId: node.id,
          message: `Agent node "${node.data.name}" has no outgoing connections (results will be lost)`,
          severity: 'warning',
          code: ValidationErrorCode.ORPHANED_NODE,
        });
      }
    }
  }

  // Check for disconnected subgraphs
  if (nodes.length > 1 && edges.length > 0) {
    const connectedNodes = findConnectedNodes(nodes, edges);
    if (connectedNodes.size < nodes.length) {
      const disconnectedNodes = nodes.filter((n) => !connectedNodes.has(n.id));
      for (const node of disconnectedNodes) {
        warnings.push({
          nodeId: node.id,
          message: `Node "${node.data.name}" is not connected to the main flow`,
          severity: 'warning',
          code: ValidationErrorCode.DISCONNECTED_SUBGRAPH,
        });
      }
    }
  }
}

/**
 * Validate individual node configurations
 */
function validateNodeConfiguration(
  nodes: ReactFlowNode[],
  errors: ExtendedValidationError[],
  warnings: ExtendedValidationError[]
): void {
  for (const node of nodes) {
    // Validate Input nodes
    if (isReactFlowInputNode(node)) {
      const { inputFields } = node.data;
      if (!inputFields || inputFields.length === 0) {
        warnings.push({
          nodeId: node.id,
          field: 'inputFields',
          message: `Input node "${node.data.name}" has no input fields configured`,
          severity: 'warning',
          code: ValidationErrorCode.INPUT_NO_FIELDS,
        });
      }
    }

    // Validate Agent nodes
    if (isReactFlowAgentNode(node)) {
      const { agentId, promptTemplate } = node.data;

      if (!agentId || agentId.trim() === '') {
        errors.push({
          nodeId: node.id,
          field: 'agentId',
          message: `Agent node "${node.data.name}" has no agent selected`,
          severity: 'error',
          code: ValidationErrorCode.AGENT_NO_AGENT_ID,
        });
      }

      if (!promptTemplate || promptTemplate.trim() === '') {
        errors.push({
          nodeId: node.id,
          field: 'promptTemplate',
          message: `Agent node "${node.data.name}" has no prompt template`,
          severity: 'error',
          code: ValidationErrorCode.AGENT_NO_PROMPT,
        });
      }
    }

    // Validate Output nodes
    if (isReactFlowOutputNode(node)) {
      const { outputType, format, saveToFile, filePath } = node.data;

      if (!outputType) {
        errors.push({
          nodeId: node.id,
          field: 'outputType',
          message: `Output node "${node.data.name}" has no output type configured`,
          severity: 'error',
          code: ValidationErrorCode.OUTPUT_INVALID_CONFIG,
        });
      }

      if (!format) {
        errors.push({
          nodeId: node.id,
          field: 'format',
          message: `Output node "${node.data.name}" has no output format configured`,
          severity: 'error',
          code: ValidationErrorCode.OUTPUT_INVALID_CONFIG,
        });
      }

      // If saveToFile is enabled, filePath must be set
      if (saveToFile && (!filePath || filePath.trim() === '')) {
        errors.push({
          nodeId: node.id,
          field: 'filePath',
          message: `Output node "${node.data.name}" has saveToFile enabled but no file path`,
          severity: 'error',
          code: ValidationErrorCode.OUTPUT_INVALID_CONFIG,
        });
      }
    }
  }
}

/**
 * Detect circular dependencies in the flow
 */
function validateCircularDependencies(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  errors: ExtendedValidationError[],
  _warnings: ExtendedValidationError[]
): void {
  if (nodes.length === 0 || edges.length === 0) return;

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }

  // Use DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleNodes: string[] = [];

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      cycleNodes.push(nodeId);
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) {
        cycleNodes.push(nodeId);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Check for cycles starting from each node
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) {
        // Get node names for better error message
        const cycleNodeNames = cycleNodes
          .map((id) => {
            const node = nodes.find((n) => n.id === id);
            return node ? node.data.name : id;
          })
          .reverse()
          .join(' → ');

        errors.push({
          nodeId: cycleNodes[0] || '',
          message: `Circular dependency detected: ${cycleNodeNames}`,
          severity: 'error',
          code: ValidationErrorCode.CIRCULAR_REFERENCE,
        });
        break; // Only report first cycle found
      }
    }
  }
}

/**
 * Find all nodes connected to the main flow (starting from input nodes)
 */
function findConnectedNodes(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): Set<string> {
  const inputNodes = nodes.filter(isReactFlowInputNode);
  if (inputNodes.length === 0) {
    return new Set();
  }

  // Build adjacency list (bidirectional for this check)
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    // Forward direction
    const outgoing = adjacency.get(edge.source) || [];
    outgoing.push(edge.target);
    adjacency.set(edge.source, outgoing);

    // Backward direction
    const incoming = adjacency.get(edge.target) || [];
    incoming.push(edge.source);
    adjacency.set(edge.target, incoming);
  }

  // BFS from all input nodes
  const connected = new Set<string>();
  const queue: string[] = inputNodes.map((n) => n.id);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (connected.has(nodeId)) continue;

    connected.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!connected.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return connected;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a specific node has validation errors
 *
 * @param nodeId - The node ID to check
 * @param validationResult - The validation result to check against
 * @returns True if the node has errors
 */
export function nodeHasErrors(
  nodeId: string,
  validationResult: ExtendedFlowValidationResult
): boolean {
  return validationResult.errors.some((error) => error.nodeId === nodeId);
}

/**
 * Check if a specific node has validation warnings
 *
 * @param nodeId - The node ID to check
 * @param validationResult - The validation result to check against
 * @returns True if the node has warnings
 */
export function nodeHasWarnings(
  nodeId: string,
  validationResult: ExtendedFlowValidationResult
): boolean {
  return validationResult.warnings.some((warning) => warning.nodeId === nodeId);
}

/**
 * Get all validation messages for a specific node
 *
 * @param nodeId - The node ID to get messages for
 * @param validationResult - The validation result to check
 * @returns Array of validation messages
 */
export function getNodeValidationMessages(
  nodeId: string,
  validationResult: ExtendedFlowValidationResult
): string[] {
  const messages: string[] = [];

  validationResult.errors
    .filter((error) => error.nodeId === nodeId)
    .forEach((error) => messages.push(error.message));

  validationResult.warnings
    .filter((warning) => warning.nodeId === nodeId)
    .forEach((warning) => messages.push(warning.message));

  return messages;
}

/**
 * Format validation errors for display
 *
 * @param validationResult - The validation result to format
 * @returns Formatted error message string
 */
export function formatValidationErrors(
  validationResult: ExtendedFlowValidationResult
): string {
  const lines: string[] = [];

  if (validationResult.errors.length > 0) {
    lines.push('Errors:');
    validationResult.errors.forEach((error, index) => {
      lines.push(`  ${index + 1}. ${error.message}`);
    });
  }

  if (validationResult.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Warnings:');
    validationResult.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning.message}`);
    });
  }

  return lines.join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  validateFlow,
  nodeHasErrors,
  nodeHasWarnings,
  getNodeValidationMessages,
  formatValidationErrors,
  ValidationErrorCode,
};
