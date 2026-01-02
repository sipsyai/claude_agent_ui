/**
 * Claude Agent UI - Flow Execution Service
 *
 * This service orchestrates the execution of flows (workflows).
 * It manages node execution in sequence, tracks state, handles errors,
 * and provides real-time updates via SSE.
 *
 * Key responsibilities:
 * - Start, stop, and cancel flow executions
 * - Execute nodes in sequence following the flow graph
 * - Manage execution context and state
 * - Handle errors with retry support
 * - Emit SSE updates for real-time monitoring
 * - Track token usage and costs
 *
 * @see src/types/flow-types.ts for type definitions
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, type Logger } from './logger.js';
import { strapiClient } from './strapi-client.js';
import type {
  Flow,
  FlowNode,
  FlowExecution,
  FlowExecutionContext,
  FlowExecutionResult,
  FlowExecutionStatus,
  FlowExecutionUpdate,
  FlowExecutionUpdateType,
  FlowTriggerType,
  NodeExecution,
  NodeExecutionResult,
  NodeExecutionStatus,
  LogLevel,
  FlowExecutionLog,
  StartFlowExecutionRequest,
  AgentNode,
} from '../types/flow-types.js';
import {
  isInputNode,
  isAgentNode,
  isOutputNode,
} from '../types/flow-types.js';

// ============= CONFIGURATION =============

const DEFAULT_NODE_TIMEOUT = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ============= NODE HANDLER INTERFACE =============

/**
 * Interface for node handlers
 * Each node type (input, agent, output) implements this interface
 */
export interface NodeHandler {
  execute(node: FlowNode, context: FlowExecutionContext): Promise<NodeExecutionResult>;
}

// ============= FLOW EXECUTION SERVICE =============

/**
 * FlowExecutionService - Singleton service for executing flows
 *
 * Manages the lifecycle of flow executions:
 * - Starting new executions
 * - Tracking running executions
 * - Cancelling executions
 * - Emitting real-time updates
 */
export class FlowExecutionService extends EventEmitter {
  private logger: Logger;
  private activeExecutions: Map<string, FlowExecutionContext> = new Map();
  private nodeHandlers: Map<string, NodeHandler> = new Map();

  constructor() {
    super();
    this.logger = createLogger('FlowExecutionService');
  }

  /**
   * Register a node handler for a specific node type
   */
  registerNodeHandler(nodeType: string, handler: NodeHandler): void {
    this.nodeHandlers.set(nodeType, handler);
    this.logger.info('Node handler registered', { nodeType });
  }

  /**
   * Start a new flow execution
   * @param request - Flow execution request with flowId and input
   * @returns Flow execution result (or execution ID for async)
   */
  async startExecution(request: StartFlowExecutionRequest): Promise<FlowExecutionResult> {
    const executionId = uuidv4();
    const startTime = new Date();

    this.logger.info('Starting flow execution', {
      executionId,
      flowId: request.flowId,
      triggeredBy: request.triggeredBy || 'manual',
    });

    try {
      // 1. Fetch the flow definition
      const flow = await this.fetchFlow(request.flowId);

      if (!flow) {
        throw new Error(`Flow with ID ${request.flowId} not found`);
      }

      if (!flow.isActive) {
        throw new Error(`Flow ${flow.name} is not active`);
      }

      // 2. Create execution record in Strapi
      const execution = await this.createExecutionRecord({
        executionId,
        flowId: request.flowId,
        input: request.input,
        triggeredBy: request.triggeredBy || 'manual',
        triggerData: request.triggerData,
      });

      // 3. Create execution context
      const context = this.createExecutionContext(execution, flow, request.input);

      // 4. Store context for active execution tracking
      this.activeExecutions.set(executionId, context);

      // 5. Emit execution started event
      this.emitUpdate(context, 'execution_started');

      // 6. Execute the flow
      try {
        const result = await this.executeFlow(context);

        // 7. Complete execution
        await this.completeExecution(context, result);

        return result;
      } catch (error) {
        // 8. Handle execution failure
        await this.failExecution(context, error as Error);

        return {
          executionId,
          success: false,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          errorDetails: error instanceof Error ? { stack: error.stack } : undefined,
          executionTime: Date.now() - startTime.getTime(),
          tokensUsed: context.execution.tokensUsed,
          cost: context.execution.cost,
          nodeExecutions: context.execution.nodeExecutions,
        };
      } finally {
        // 9. Cleanup
        this.activeExecutions.delete(executionId);
      }
    } catch (error) {
      this.logger.error('Failed to start flow execution', error as Error, {
        executionId,
        flowId: request.flowId,
      });

      return {
        executionId,
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime.getTime(),
        tokensUsed: 0,
        cost: 0,
        nodeExecutions: [],
      };
    }
  }

  /**
   * Cancel a running flow execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);

    if (!context) {
      this.logger.warn('Execution not found or already completed', { executionId });
      return false;
    }

    this.logger.info('Cancelling flow execution', { executionId });

    // Set cancellation flag
    context.isCancelled = true;

    // Update execution status
    context.execution.status = 'cancelled';
    context.execution.completedAt = new Date();
    context.execution.executionTime = Date.now() - (context.execution.startedAt?.getTime() || Date.now());

    // Update in Strapi
    await this.updateExecutionInStrapi(context.execution);

    // Emit cancellation event
    this.emitUpdate(context, 'execution_cancelled');

    // Remove from active executions
    this.activeExecutions.delete(executionId);

    return true;
  }

  /**
   * Get status of a running execution
   */
  getExecutionStatus(executionId: string): FlowExecution | null {
    const context = this.activeExecutions.get(executionId);
    return context?.execution || null;
  }

  /**
   * Get all active execution IDs
   */
  getActiveExecutionIds(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  // ============= PRIVATE: FLOW EXECUTION LOGIC =============

  /**
   * Execute the flow by traversing nodes in sequence
   */
  private async executeFlow(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const { flow, execution } = context;
    const startTime = context.startTime;

    // Find the entry node (first input node or first node if no input)
    let currentNode = this.findEntryNode(flow);

    if (!currentNode) {
      throw new Error('No entry node found in flow');
    }

    context.log('info', `Starting flow execution: ${flow.name}`, undefined, {
      nodeCount: flow.nodes.length,
    });

    // Execute nodes in sequence
    while (currentNode && !context.isCancelled) {
      const nodeResult = await this.executeNode(currentNode, context);

      if (!nodeResult.success) {
        // Node failed - check if we should retry
        const shouldRetry = await this.shouldRetryNode(currentNode, context);

        if (shouldRetry) {
          context.log('warn', `Retrying node: ${currentNode.name}`, currentNode.nodeId);
          continue;
        }

        // No retry - fail the execution
        throw new Error(nodeResult.error || `Node ${currentNode.name} failed`);
      }

      // Merge node output into context data
      if (nodeResult.data) {
        context.data = { ...context.data, ...nodeResult.data };
      }

      // Update variables for template interpolation
      if (nodeResult.output) {
        context.variables[currentNode.nodeId] = nodeResult.output;
      }

      // Accumulate tokens and cost
      if (nodeResult.tokensUsed) {
        execution.tokensUsed += nodeResult.tokensUsed;
      }
      if (nodeResult.cost) {
        execution.cost += nodeResult.cost;
      }

      // Check if we should continue
      if (nodeResult.continueExecution === false) {
        context.log('info', 'Execution stopped by node', currentNode.nodeId);
        break;
      }

      // Move to next node
      currentNode = this.getNextNode(currentNode, flow);
    }

    // Check if cancelled
    if (context.isCancelled) {
      return {
        executionId: execution.id,
        success: false,
        status: 'cancelled',
        error: 'Execution was cancelled',
        executionTime: Date.now() - startTime.getTime(),
        tokensUsed: execution.tokensUsed,
        cost: execution.cost,
        nodeExecutions: execution.nodeExecutions,
      };
    }

    // Build final result
    const executionTime = Date.now() - startTime.getTime();

    return {
      executionId: execution.id,
      success: true,
      status: 'completed',
      output: context.data,
      executionTime,
      tokensUsed: execution.tokensUsed,
      cost: execution.cost,
      nodeExecutions: execution.nodeExecutions,
    };
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: FlowNode,
    context: FlowExecutionContext
  ): Promise<NodeExecutionResult> {
    const { execution } = context;
    const nodeStartTime = Date.now();

    // Create node execution record
    const nodeExecution: NodeExecution = {
      nodeId: node.nodeId,
      nodeType: node.type,
      status: 'running',
      startedAt: new Date(),
      retryCount: 0,
    };

    // Add to execution's node list
    execution.nodeExecutions.push(nodeExecution);
    execution.currentNodeId = node.nodeId;

    // Emit node started event
    this.emitUpdate(context, 'node_started', node.nodeId, node.type);

    context.log('info', `Executing node: ${node.name}`, node.nodeId, {
      nodeType: node.type,
    });

    try {
      // Get the appropriate handler for this node type
      const handler = this.nodeHandlers.get(node.type);

      if (!handler) {
        throw new Error(`No handler registered for node type: ${node.type}`);
      }

      // Execute the node with timeout
      const result = await this.executeWithTimeout(
        () => handler.execute(node, context),
        this.getNodeTimeout(node),
        `Node ${node.name} timed out`
      );

      // Update node execution record
      nodeExecution.status = result.success ? 'completed' : 'failed';
      nodeExecution.completedAt = new Date();
      nodeExecution.executionTime = Date.now() - nodeStartTime;
      nodeExecution.output = result.output;
      nodeExecution.tokensUsed = result.tokensUsed;
      nodeExecution.cost = result.cost;

      if (!result.success) {
        nodeExecution.error = result.error;
        nodeExecution.errorDetails = result.errorDetails;

        context.log('error', `Node failed: ${result.error}`, node.nodeId);
        this.emitUpdate(context, 'node_failed', node.nodeId, node.type, {
          error: result.error,
        });
      } else {
        context.log('info', `Node completed successfully`, node.nodeId, {
          executionTime: nodeExecution.executionTime,
        });
        this.emitUpdate(context, 'node_completed', node.nodeId, node.type, {
          output: result.output,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          executionTime: nodeExecution.executionTime,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update node execution record
      nodeExecution.status = 'failed';
      nodeExecution.completedAt = new Date();
      nodeExecution.executionTime = Date.now() - nodeStartTime;
      nodeExecution.error = errorMessage;
      nodeExecution.errorDetails = error instanceof Error ? { stack: error.stack } : undefined;

      context.log('error', `Node execution error: ${errorMessage}`, node.nodeId);
      this.emitUpdate(context, 'node_failed', node.nodeId, node.type, {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        errorDetails: error instanceof Error ? { stack: error.stack } : undefined,
      };
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get timeout for a node (in milliseconds)
   */
  private getNodeTimeout(node: FlowNode): number {
    // Agent nodes may have custom timeout
    if (isAgentNode(node) && node.timeout) {
      return node.timeout;
    }
    return DEFAULT_NODE_TIMEOUT;
  }

  /**
   * Check if a node should be retried after failure
   */
  private async shouldRetryNode(node: FlowNode, context: FlowExecutionContext): Promise<boolean> {
    // Only agent nodes support retry
    if (!isAgentNode(node) || !node.retryOnError) {
      return false;
    }

    // Find the node execution record
    const nodeExecution = context.execution.nodeExecutions.find(
      (ne) => ne.nodeId === node.nodeId && ne.status === 'failed'
    );

    if (!nodeExecution) {
      return false;
    }

    const retryCount = nodeExecution.retryCount || 0;

    if (retryCount >= (node.maxRetries || MAX_RETRY_ATTEMPTS)) {
      context.log('warn', `Max retries reached for node: ${node.name}`, node.nodeId);
      return false;
    }

    // Increment retry count
    nodeExecution.retryCount = retryCount + 1;
    nodeExecution.status = 'pending';

    // Wait before retry
    await this.delay(RETRY_DELAY_MS * (retryCount + 1));

    context.log('info', `Retrying node (attempt ${retryCount + 1})`, node.nodeId);

    return true;
  }

  /**
   * Find the entry node of the flow
   */
  private findEntryNode(flow: Flow): FlowNode | null {
    // First, try to find an input node
    const inputNode = flow.nodes.find((n) => isInputNode(n));
    if (inputNode) {
      return inputNode;
    }

    // Otherwise, return the first node
    return flow.nodes[0] || null;
  }

  /**
   * Get the next node in the flow sequence
   */
  private getNextNode(currentNode: FlowNode, flow: Flow): FlowNode | null {
    if (!currentNode.nextNodeId) {
      return null;
    }

    return flow.nodes.find((n) => n.nodeId === currentNode.nextNodeId) || null;
  }

  // ============= PRIVATE: STRAPI INTEGRATION =============

  /**
   * Fetch a flow definition from Strapi
   */
  private async fetchFlow(flowId: string): Promise<Flow | null> {
    try {
      const response = await strapiClient.getFlow(flowId);
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch flow', error as Error, { flowId });
      return null;
    }
  }

  /**
   * Create an execution record in Strapi
   */
  private async createExecutionRecord(params: {
    executionId: string;
    flowId: string;
    input: Record<string, any>;
    triggeredBy: FlowTriggerType;
    triggerData?: Record<string, any>;
  }): Promise<FlowExecution> {
    try {
      const response = await strapiClient.createFlowExecution({
        flowId: params.flowId,
        status: 'running',
        input: params.input,
        triggeredBy: params.triggeredBy,
        triggerData: params.triggerData,
        startedAt: new Date(),
        logs: [],
        nodeExecutions: [],
        tokensUsed: 0,
        cost: 0,
        retryCount: 0,
      });

      return {
        id: response.id || params.executionId,
        flowId: params.flowId,
        status: 'running',
        input: params.input,
        logs: [],
        nodeExecutions: [],
        tokensUsed: 0,
        cost: 0,
        triggeredBy: params.triggeredBy,
        triggerData: params.triggerData,
        retryCount: 0,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to create execution record', error as Error);
      // Return a local execution object if Strapi fails
      return {
        id: params.executionId,
        flowId: params.flowId,
        status: 'running',
        input: params.input,
        logs: [],
        nodeExecutions: [],
        tokensUsed: 0,
        cost: 0,
        triggeredBy: params.triggeredBy,
        triggerData: params.triggerData,
        retryCount: 0,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Update execution record in Strapi
   */
  private async updateExecutionInStrapi(execution: FlowExecution): Promise<void> {
    try {
      await strapiClient.updateFlowExecution(execution.id, {
        status: execution.status,
        output: execution.output,
        logs: execution.logs,
        error: execution.error,
        errorDetails: execution.errorDetails,
        completedAt: execution.completedAt,
        executionTime: execution.executionTime,
        nodeExecutions: execution.nodeExecutions,
        currentNodeId: execution.currentNodeId,
        tokensUsed: execution.tokensUsed,
        cost: execution.cost,
      });
    } catch (error) {
      this.logger.error('Failed to update execution in Strapi', error as Error, {
        executionId: execution.id,
      });
    }
  }

  /**
   * Complete a flow execution
   */
  private async completeExecution(
    context: FlowExecutionContext,
    result: FlowExecutionResult
  ): Promise<void> {
    const { execution } = context;

    execution.status = 'completed';
    execution.output = result.output;
    execution.completedAt = new Date();
    execution.executionTime = result.executionTime;

    await this.updateExecutionInStrapi(execution);

    context.log('info', 'Flow execution completed successfully', undefined, {
      executionTime: result.executionTime,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
    });

    this.emitUpdate(context, 'execution_completed', undefined, undefined, {
      output: result.output,
      executionTime: result.executionTime,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
    });
  }

  /**
   * Fail a flow execution
   */
  private async failExecution(context: FlowExecutionContext, error: Error): Promise<void> {
    const { execution } = context;

    execution.status = 'failed';
    execution.error = error.message;
    execution.errorDetails = { stack: error.stack };
    execution.completedAt = new Date();
    execution.executionTime = Date.now() - (execution.startedAt?.getTime() || Date.now());

    await this.updateExecutionInStrapi(execution);

    context.log('error', `Flow execution failed: ${error.message}`);

    this.emitUpdate(context, 'execution_failed', undefined, undefined, {
      error: error.message,
    });
  }

  // ============= PRIVATE: CONTEXT & HELPERS =============

  /**
   * Create execution context
   */
  private createExecutionContext(
    execution: FlowExecution,
    flow: Flow,
    input: Record<string, any>
  ): FlowExecutionContext {
    const context: FlowExecutionContext = {
      execution,
      flow,
      data: { ...input },
      input,
      variables: { input },
      startTime: new Date(),
      log: (level: LogLevel, message: string, nodeId?: string, data?: Record<string, any>) => {
        this.addLog(context, level, message, nodeId, data);
      },
      isCancelled: false,
      onUpdate: (update: FlowExecutionUpdate) => {
        this.emit('execution-update', update);
      },
    };

    return context;
  }

  /**
   * Add a log entry to the execution
   */
  private addLog(
    context: FlowExecutionContext,
    level: LogLevel,
    message: string,
    nodeId?: string,
    data?: Record<string, any>
  ): void {
    const logEntry: FlowExecutionLog = {
      timestamp: new Date(),
      level,
      message,
      nodeId,
      data,
    };

    context.execution.logs.push(logEntry);

    // Also emit as update for real-time monitoring
    if (context.onUpdate) {
      context.onUpdate({
        type: 'log',
        executionId: context.execution.id,
        timestamp: new Date(),
        nodeId,
        data: {
          log: logEntry,
        },
      });
    }

    // Log to server logger as well
    this.logger[level](message, {
      executionId: context.execution.id,
      nodeId,
      ...data,
    });
  }

  /**
   * Emit an execution update event
   */
  private emitUpdate(
    context: FlowExecutionContext,
    type: FlowExecutionUpdateType,
    nodeId?: string,
    nodeType?: string,
    data?: Record<string, any>
  ): void {
    const update: FlowExecutionUpdate = {
      type,
      executionId: context.execution.id,
      timestamp: new Date(),
      nodeId,
      nodeType: nodeType as any,
      data: {
        status: context.execution.status,
        ...data,
      },
    };

    // Call onUpdate callback if set
    if (context.onUpdate) {
      context.onUpdate(update);
    }

    // Also emit on EventEmitter for SSE
    this.emit('execution-update', update);
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============= SINGLETON EXPORT =============

/**
 * Singleton instance of FlowExecutionService
 * Use this throughout the application for flow execution
 */
export const flowExecutionService = new FlowExecutionService();
