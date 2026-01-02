/**
 * Claude Agent UI - Flow Node Handlers
 *
 * This module exports all flow node handlers and provides utilities
 * for registering them with the FlowExecutionService.
 *
 * Node Types:
 * - InputNode: Validates and processes flow input data
 * - AgentNode: Executes Claude agents with configured skills
 * - OutputNode: Formats and delivers flow output
 *
 * Usage:
 * ```typescript
 * import { registerAllNodeHandlers } from './flow-nodes';
 * import { flowExecutionService } from './flow-execution-service';
 *
 * // Register all handlers at app startup
 * registerAllNodeHandlers(flowExecutionService);
 * ```
 *
 * @see src/types/flow-types.ts for node type definitions
 * @see src/services/flow-execution-service.ts for the execution engine
 */

// Export individual handlers
export { InputNodeHandler, inputNodeHandler } from './input-node-handler.js';
export { AgentNodeHandler, agentNodeHandler } from './agent-node-handler.js';
export { OutputNodeHandler, outputNodeHandler } from './output-node-handler.js';

// Import types and singleton instances
import { inputNodeHandler } from './input-node-handler.js';
import { agentNodeHandler } from './agent-node-handler.js';
import { outputNodeHandler } from './output-node-handler.js';
import type { FlowExecutionService, NodeHandler } from '../flow-execution-service.js';

/**
 * Map of node type to handler instance
 */
export const nodeHandlers: Record<string, NodeHandler> = {
  input: inputNodeHandler,
  agent: agentNodeHandler,
  output: outputNodeHandler,
};

/**
 * Register all node handlers with a FlowExecutionService instance
 *
 * This should be called during application startup to ensure
 * all node types can be executed by the flow engine.
 *
 * @param service - The FlowExecutionService instance to register handlers with
 */
export function registerAllNodeHandlers(service: FlowExecutionService): void {
  service.registerNodeHandler('input', inputNodeHandler);
  service.registerNodeHandler('agent', agentNodeHandler);
  service.registerNodeHandler('output', outputNodeHandler);
}

/**
 * Register a single node handler
 *
 * Useful for adding custom node handlers without registering all defaults.
 *
 * @param service - The FlowExecutionService instance
 * @param nodeType - The node type string (e.g., 'input', 'agent', 'output')
 * @param handler - The handler instance implementing NodeHandler interface
 */
export function registerNodeHandler(
  service: FlowExecutionService,
  nodeType: string,
  handler: NodeHandler
): void {
  service.registerNodeHandler(nodeType, handler);
}

/**
 * Get a handler for a specific node type
 *
 * @param nodeType - The node type to get handler for
 * @returns The handler instance or undefined if not found
 */
export function getNodeHandler(nodeType: string): NodeHandler | undefined {
  return nodeHandlers[nodeType];
}

/**
 * Check if a handler exists for a node type
 *
 * @param nodeType - The node type to check
 * @returns True if a handler exists for the node type
 */
export function hasNodeHandler(nodeType: string): boolean {
  return nodeType in nodeHandlers;
}

/**
 * Get all registered node type names
 *
 * @returns Array of registered node type names
 */
export function getRegisteredNodeTypes(): string[] {
  return Object.keys(nodeHandlers);
}
