/**
 * Node Registry and Factory
 *
 * This file serves as the central registry for all custom React Flow node components.
 * It provides:
 * - Node component exports for use throughout the application
 * - A nodeTypes registry for React Flow initialization
 * - Factory functions for creating new nodes with default configurations
 * - Node ID generation utilities
 * - Default node data templates
 *
 * ## Usage
 *
 * ### Importing Node Components
 * ```tsx
 * import { InputNode, AgentNode, OutputNode } from './nodes';
 * ```
 *
 * ### Using the nodeTypes Registry
 * ```tsx
 * import { nodeTypes } from './nodes';
 *
 * <ReactFlow nodeTypes={nodeTypes} nodes={nodes} edges={edges} />
 * ```
 *
 * ### Creating New Nodes
 * ```tsx
 * import { createNode } from './nodes';
 *
 * const newInputNode = createNode({
 *   type: 'input',
 *   position: { x: 100, y: 100 },
 *   name: 'User Input'
 * });
 * ```
 *
 * ### Generating Node IDs
 * ```tsx
 * import { generateNodeId } from './nodes';
 *
 * const nodeId = generateNodeId('input'); // e.g., "input_abc123"
 * ```
 */

import InputNode from './InputNode';
import AgentNode from './AgentNode';
import OutputNode from './OutputNode';

import type {
  ReactFlowNode,
  ReactFlowInputNode,
  ReactFlowAgentNode,
  ReactFlowOutputNode,
  InputNodeData,
  AgentNodeData,
  OutputNodeData,
  NodeTypesRegistry,
} from '../../../types/react-flow.types';
import type { FlowNodeType } from '../../../types';

// =============================================================================
// COMPONENT EXPORTS
// =============================================================================

/**
 * Export all node components for use in other parts of the application
 */
export { default as InputNode } from './InputNode';
export { default as AgentNode } from './AgentNode';
export { default as OutputNode } from './OutputNode';
export { default as BaseNode } from './BaseNode';

// =============================================================================
// NODE TYPES REGISTRY
// =============================================================================

/**
 * React Flow nodeTypes registry
 *
 * This registry maps node type strings to their corresponding React components.
 * Pass this to React Flow's `nodeTypes` prop to register custom nodes.
 *
 * @example
 * ```tsx
 * import { nodeTypes } from './nodes';
 *
 * function FlowCanvas() {
 *   return (
 *     <ReactFlow
 *       nodeTypes={nodeTypes}
 *       nodes={nodes}
 *       edges={edges}
 *     />
 *   );
 * }
 * ```
 */
export const nodeTypes: NodeTypesRegistry = {
  input: InputNode,
  agent: AgentNode,
  output: OutputNode,
};

// =============================================================================
// NODE ID GENERATION
// =============================================================================

/**
 * Generates a unique ID for a new node
 *
 * Creates a unique identifier using the node type as a prefix followed by
 * a random string. This ensures node IDs are both readable and unique.
 *
 * @param type - The type of node ('input', 'agent', or 'output')
 * @returns A unique node ID in the format `{type}_{randomId}`
 *
 * @example
 * ```ts
 * generateNodeId('input');  // => "input_abc123def456"
 * generateNodeId('agent');  // => "agent_xyz789uvw321"
 * generateNodeId('output'); // => "output_qrs456tuv789"
 * ```
 */
export function generateNodeId(type: FlowNodeType): string {
  const randomId = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `${type}_${randomId}${timestamp}`;
}

// =============================================================================
// DEFAULT NODE CONFIGURATIONS
// =============================================================================

/**
 * Default configuration for Input nodes
 *
 * Provides a base template for creating new input nodes with sensible defaults.
 */
const DEFAULT_INPUT_NODE_DATA = {
  type: 'input' as const,
  description: '',
  inputFields: [] as any[],
  validationRules: {} as Record<string, any>,
};

/**
 * Default configuration for Agent nodes
 *
 * Provides a base template for creating new agent nodes with sensible defaults.
 */
const DEFAULT_AGENT_NODE_DATA = {
  type: 'agent' as const,
  description: '',
  agentId: '',
  promptTemplate: '',
  skills: [] as string[],
  modelOverride: 'default' as const,
  maxTokens: undefined as number | undefined,
  timeout: 60000, // 60 seconds
  retryOnError: false,
  maxRetries: 3,
};

/**
 * Default configuration for Output nodes
 *
 * Provides a base template for creating new output nodes with sensible defaults.
 */
const DEFAULT_OUTPUT_NODE_DATA = {
  type: 'output' as const,
  description: '',
  outputType: 'response' as const,
  format: 'json' as const,
  saveToFile: false,
  filePath: undefined as string | undefined,
  fileName: undefined as string | undefined,
  includeMetadata: false,
  includeTimestamp: false,
  transformTemplate: undefined as string | undefined,
  webhookUrl: undefined as string | undefined,
  webhookHeaders: undefined as Record<string, string> | undefined,
};

// =============================================================================
// NODE FACTORY FUNCTION
// =============================================================================

/**
 * Configuration for creating a new node
 */
export interface CreateNodeConfig {
  /** The type of node to create */
  type: FlowNodeType;
  /** Position on the canvas where the node should be placed */
  position: { x: number; y: number };
  /** Optional custom name for the node (defaults to type-based name) */
  name?: string;
  /** Optional description for the node */
  description?: string;
  /** Optional partial data to override defaults */
  data?: Partial<InputNodeData | AgentNodeData | OutputNodeData>;
}

/**
 * Creates a new React Flow node with default configuration
 *
 * This factory function creates properly configured nodes with unique IDs,
 * default data, and the specified position. It handles all node types and
 * applies sensible defaults based on the type.
 *
 * @param config - Configuration object for the new node
 * @returns A complete React Flow node ready to be added to the canvas
 *
 * @example
 * ```ts
 * // Create an input node
 * const inputNode = createNode({
 *   type: 'input',
 *   position: { x: 100, y: 100 },
 *   name: 'User Input'
 * });
 *
 * // Create an agent node with custom data
 * const agentNode = createNode({
 *   type: 'agent',
 *   position: { x: 400, y: 100 },
 *   name: 'Data Processor',
 *   data: {
 *     agentId: 'agent_123',
 *     promptTemplate: 'Process the following data: {{input}}'
 *   }
 * });
 *
 * // Create an output node
 * const outputNode = createNode({
 *   type: 'output',
 *   position: { x: 700, y: 100 },
 *   name: 'Final Output'
 * });
 * ```
 */
export function createNode(config: CreateNodeConfig): ReactFlowNode {
  const { type, position, name, description, data } = config;

  const nodeId = generateNodeId(type);
  const nodeName = name || `${type.charAt(0).toUpperCase() + type.slice(1)} Node`;

  // Base properties common to all nodes
  const baseNode = {
    id: nodeId,
    type,
    position,
    dragHandle: '.node-drag-handle', // Optional: specify drag handle class
  };

  // Create type-specific node data
  switch (type) {
    case 'input': {
      const inputData: InputNodeData = {
        type: 'input',
        nodeId,
        name: nodeName,
        description: description || '',
        inputFields: DEFAULT_INPUT_NODE_DATA.inputFields,
        validationRules: DEFAULT_INPUT_NODE_DATA.validationRules,
        ...(data as Partial<InputNodeData>),
      };

      const inputNode: ReactFlowInputNode = {
        ...baseNode,
        type: 'input',
        data: inputData,
      };

      return inputNode;
    }

    case 'agent': {
      const agentData: AgentNodeData = {
        type: 'agent',
        nodeId,
        name: nodeName,
        description: description || '',
        agentId: DEFAULT_AGENT_NODE_DATA.agentId,
        promptTemplate: DEFAULT_AGENT_NODE_DATA.promptTemplate,
        skills: DEFAULT_AGENT_NODE_DATA.skills,
        modelOverride: DEFAULT_AGENT_NODE_DATA.modelOverride,
        timeout: DEFAULT_AGENT_NODE_DATA.timeout,
        retryOnError: DEFAULT_AGENT_NODE_DATA.retryOnError,
        maxRetries: DEFAULT_AGENT_NODE_DATA.maxRetries,
        ...(data as Partial<AgentNodeData>),
      };

      const agentNode: ReactFlowAgentNode = {
        ...baseNode,
        type: 'agent',
        data: agentData,
      };

      return agentNode;
    }

    case 'output': {
      const outputData: OutputNodeData = {
        type: 'output',
        nodeId,
        name: nodeName,
        description: description || '',
        outputType: DEFAULT_OUTPUT_NODE_DATA.outputType,
        format: DEFAULT_OUTPUT_NODE_DATA.format,
        saveToFile: DEFAULT_OUTPUT_NODE_DATA.saveToFile,
        includeMetadata: DEFAULT_OUTPUT_NODE_DATA.includeMetadata,
        includeTimestamp: DEFAULT_OUTPUT_NODE_DATA.includeTimestamp,
        ...(data as Partial<OutputNodeData>),
      };

      const outputNode: ReactFlowOutputNode = {
        ...baseNode,
        type: 'output',
        data: outputData,
      };

      return outputNode;
    }

    default: {
      // TypeScript should ensure this never happens, but handle it gracefully
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown node type: ${exhaustiveCheck}`);
    }
  }
}

// =============================================================================
// NODE TEMPLATES
// =============================================================================

/**
 * Pre-configured node templates for common use cases
 *
 * These templates provide quick starting points for common node configurations.
 */
export const nodeTemplates = {
  /**
   * Basic text input node
   */
  textInput: (position: { x: number; y: number }): ReactFlowInputNode =>
    createNode({
      type: 'input',
      position,
      name: 'Text Input',
      data: {
        inputFields: [
          {
            name: 'text',
            label: 'Text',
            type: 'text',
            required: true,
            defaultValue: '',
            description: 'Enter text here',
          },
        ],
      },
    }) as ReactFlowInputNode,

  /**
   * File upload input node
   */
  fileInput: (position: { x: number; y: number }): ReactFlowInputNode =>
    createNode({
      type: 'input',
      position,
      name: 'File Input',
      data: {
        inputFields: [
          {
            name: 'file',
            label: 'File Upload',
            type: 'file',
            required: true,
            description: 'Upload a file',
          },
        ],
      },
    }) as ReactFlowInputNode,

  /**
   * Basic agent node
   */
  basicAgent: (position: { x: number; y: number }): ReactFlowAgentNode =>
    createNode({
      type: 'agent',
      position,
      name: 'Processing Agent',
      data: {
        promptTemplate: 'Process the following input: {{input}}',
      },
    }) as ReactFlowAgentNode,

  /**
   * JSON output node
   */
  jsonOutput: (position: { x: number; y: number }): ReactFlowOutputNode =>
    createNode({
      type: 'output',
      position,
      name: 'JSON Output',
      data: {
        outputType: 'response',
        format: 'json',
        includeMetadata: true,
        includeTimestamp: true,
      },
    }) as ReactFlowOutputNode,

  /**
   * File output node
   */
  fileOutput: (position: { x: number; y: number }): ReactFlowOutputNode =>
    createNode({
      type: 'output',
      position,
      name: 'File Output',
      data: {
        outputType: 'file',
        format: 'text',
        saveToFile: true,
        fileName: 'output.txt',
      },
    }) as ReactFlowOutputNode,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Gets the default data for a specific node type
 *
 * @param type - The node type to get defaults for
 * @returns Default data configuration for the specified node type
 */
export function getDefaultNodeData(
  type: 'input'
): Omit<InputNodeData, 'nodeId' | 'name'>;
export function getDefaultNodeData(
  type: 'agent'
): Omit<AgentNodeData, 'nodeId' | 'name'>;
export function getDefaultNodeData(
  type: 'output'
): Omit<OutputNodeData, 'nodeId' | 'name'>;
export function getDefaultNodeData(
  type: FlowNodeType
): Omit<InputNodeData | AgentNodeData | OutputNodeData, 'nodeId' | 'name'> {
  switch (type) {
    case 'input':
      return DEFAULT_INPUT_NODE_DATA;
    case 'agent':
      return DEFAULT_AGENT_NODE_DATA;
    case 'output':
      return DEFAULT_OUTPUT_NODE_DATA;
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown node type: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Validates that a node has all required fields
 *
 * @param node - The node to validate
 * @returns True if the node has all required fields
 */
export function isValidNode(node: ReactFlowNode): boolean {
  if (!node.id || !node.type || !node.data) {
    return false;
  }

  const data = node.data;

  switch (node.type) {
    case 'input':
      return (
        'nodeId' in data &&
        'name' in data &&
        'type' in data &&
        'inputFields' in data
      );
    case 'agent':
      return (
        'nodeId' in data &&
        'name' in data &&
        'type' in data &&
        'agentId' in data &&
        'promptTemplate' in data
      );
    case 'output':
      return (
        'nodeId' in data &&
        'name' in data &&
        'type' in data &&
        'outputType' in data &&
        'format' in data
      );
    default:
      return false;
  }
}
