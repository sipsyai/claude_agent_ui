/**
 * React Flow Type Definitions
 *
 * This file contains TypeScript type definitions for React Flow nodes, edges,
 * and custom node data structures that integrate with existing Flow types.
 */

import type { Node, Edge, NodeProps } from '@xyflow/react';
import type {
  InputNode,
  AgentNode,
  OutputNode,
  FlowNodeType,
  FlowInputField,
  FlowOutputType,
  FlowOutputFormat,
  Agent,
} from '../types';

// =============================================================================
// CUSTOM NODE DATA TYPES
// =============================================================================

/**
 * Base data structure for all React Flow custom nodes
 */
export interface BaseNodeData {
  /** Original node ID from the Flow system */
  nodeId: string;
  /** Node name/title displayed in the canvas */
  name: string;
  /** Optional node description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Index signature for compatibility with React Flow */
  [key: string]: unknown;
}

/**
 * Data structure for Input nodes in React Flow
 */
export interface InputNodeData extends BaseNodeData {
  type: 'input';
  /** Configured input fields for this node */
  inputFields: FlowInputField[];
  /** Optional validation rules */
  validationRules?: Record<string, any>;
}

/**
 * Data structure for Agent nodes in React Flow
 */
export interface AgentNodeData extends BaseNodeData {
  type: 'agent';
  /** Selected agent ID */
  agentId: string;
  /** Optional agent details (populated for display) */
  agent?: Agent;
  /** Prompt template for the agent */
  promptTemplate: string;
  /** Array of skill IDs assigned to this agent */
  skills: string[];
  /** Model override (default or specific model name) */
  modelOverride: 'default' | string;
  /** Maximum tokens for the agent response */
  maxTokens?: number;
  /** Execution timeout in milliseconds */
  timeout: number;
  /** Whether to retry on error */
  retryOnError: boolean;
  /** Maximum number of retries */
  maxRetries: number;
}

/**
 * Data structure for Output nodes in React Flow
 */
export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  /** How the output will be delivered */
  outputType: FlowOutputType;
  /** Format of the output */
  format: FlowOutputFormat;
  /** Whether to save output to file */
  saveToFile: boolean;
  /** File path if saveToFile is true */
  filePath?: string;
  /** File name if saveToFile is true */
  fileName?: string;
  /** Whether to include metadata in output */
  includeMetadata: boolean;
  /** Whether to include timestamp in output */
  includeTimestamp: boolean;
  /** Optional transformation template */
  transformTemplate?: string;
  /** Webhook URL if outputType is 'webhook' */
  webhookUrl?: string;
  /** Webhook headers if outputType is 'webhook' */
  webhookHeaders?: Record<string, string>;
}

/**
 * Union type for all custom node data types
 */
export type CustomNodeData = InputNodeData | AgentNodeData | OutputNodeData;

// =============================================================================
// REACT FLOW NODE TYPES
// =============================================================================

/**
 * React Flow Node type for Input nodes
 */
export type ReactFlowInputNode = Node<InputNodeData, 'input'>;

/**
 * React Flow Node type for Agent nodes
 */
export type ReactFlowAgentNode = Node<AgentNodeData, 'agent'>;

/**
 * React Flow Node type for Output nodes
 */
export type ReactFlowOutputNode = Node<OutputNodeData, 'output'>;

/**
 * Union type for all React Flow custom nodes
 * This is compatible with existing Flow node types
 */
export type ReactFlowNode = ReactFlowInputNode | ReactFlowAgentNode | ReactFlowOutputNode;

// =============================================================================
// REACT FLOW EDGE TYPES
// =============================================================================

/**
 * Custom data for React Flow edges
 */
export interface EdgeData {
  /** Label to display on the edge (optional) */
  label?: string;
  /** Whether this edge represents a data transfer */
  isDataTransfer?: boolean;
  /** Additional metadata for the edge */
  metadata?: Record<string, any>;
  /** Index signature for compatibility with React Flow */
  [key: string]: unknown;
}

/**
 * React Flow Edge type with custom data
 */
export type ReactFlowEdge = Edge<EdgeData>;

// =============================================================================
// NODE PROPS TYPES
// =============================================================================

/**
 * Props for Input node component
 */
export type InputNodeProps = NodeProps<ReactFlowInputNode>;

/**
 * Props for Agent node component
 */
export type AgentNodeProps = NodeProps<ReactFlowAgentNode>;

/**
 * Props for Output node component
 */
export type OutputNodeProps = NodeProps<ReactFlowOutputNode>;

/**
 * Union type for all custom node props
 */
export type CustomNodeProps = InputNodeProps | AgentNodeProps | OutputNodeProps;

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Type for node types registry (used in React Flow nodeTypes prop)
 */
export interface NodeTypesRegistry {
  input: React.ComponentType<InputNodeProps>;
  agent: React.ComponentType<AgentNodeProps>;
  output: React.ComponentType<OutputNodeProps>;
}

/**
 * Type for edge types registry (used in React Flow edgeTypes prop)
 */
export interface EdgeTypesRegistry {
  [key: string]: React.ComponentType<any>;
}

/**
 * Configuration for creating a new node
 */
export interface CreateNodeConfig {
  type: FlowNodeType;
  position: { x: number; y: number };
  name?: string;
  description?: string;
}

/**
 * Result of converting a Flow to React Flow format
 */
export interface FlowToReactFlowResult {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

/**
 * Validation error for a node
 */
export interface NodeValidationError {
  nodeId: string;
  field?: string;
  message: string;
}

/**
 * Validation result for the entire flow
 */
export interface FlowValidationResult {
  isValid: boolean;
  errors: NodeValidationError[];
  warnings?: NodeValidationError[];
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a node is an InputNode
 */
export function isReactFlowInputNode(node: ReactFlowNode): node is ReactFlowInputNode {
  return node.type === 'input';
}

/**
 * Type guard to check if a node is an AgentNode
 */
export function isReactFlowAgentNode(node: ReactFlowNode): node is ReactFlowAgentNode {
  return node.type === 'agent';
}

/**
 * Type guard to check if a node is an OutputNode
 */
export function isReactFlowOutputNode(node: ReactFlowNode): node is ReactFlowOutputNode {
  return node.type === 'output';
}

/**
 * Type guard to check if node data is InputNodeData
 */
export function isInputNodeData(data: CustomNodeData): data is InputNodeData {
  return data.type === 'input';
}

/**
 * Type guard to check if node data is AgentNodeData
 */
export function isAgentNodeData(data: CustomNodeData): data is AgentNodeData {
  return data.type === 'agent';
}

/**
 * Type guard to check if node data is OutputNodeData
 */
export function isOutputNodeData(data: CustomNodeData): data is OutputNodeData {
  return data.type === 'output';
}
