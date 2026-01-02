/**
 * Claude Agent UI - Flow System Initialization
 *
 * Initializes the flow execution system by registering node handlers,
 * configuring the flow SDK service, and starting the scheduler.
 *
 * This module should be called during server startup to ensure
 * all flow components are properly initialized before use.
 *
 * @see src/services/flow-execution-service.ts for the execution engine
 * @see src/services/flow-nodes/index.ts for node handlers
 * @see src/services/flow-sdk-service.ts for SDK integration
 * @see src/services/flow-scheduler-service.ts for scheduled execution
 */

import { createLogger, type Logger } from './logger.js';
import { flowExecutionService } from './flow-execution-service.js';
import { registerAllNodeHandlers } from './flow-nodes/index.js';
import { flowSdkService } from './flow-sdk-service.js';
import { flowSchedulerService } from './flow-scheduler-service.js';

const logger: Logger = createLogger('FlowInit');

/**
 * Flow system initialization state
 */
let isInitialized = false;

/**
 * Initialize the flow execution system
 *
 * This function:
 * 1. Registers all node handlers with the FlowExecutionService
 * 2. Verifies the FlowSdkService is ready
 * 3. Sets up any required event listeners
 * 4. Starts the flow scheduler service
 *
 * @param options - Optional configuration
 * @returns Promise<boolean> - true if initialization succeeded
 */
export async function initializeFlowSystem(options?: {
  workingDirectory?: string;
  enableScheduler?: boolean;
}): Promise<boolean> {
  if (isInitialized) {
    logger.debug('Flow system already initialized');
    return true;
  }

  try {
    logger.info('Initializing flow execution system...');

    // 1. Register all node handlers with FlowExecutionService
    // This enables the execution service to handle input, agent, and output nodes
    registerAllNodeHandlers(flowExecutionService);
    logger.info('Node handlers registered successfully', {
      handlers: ['input', 'agent', 'output'],
    });

    // 2. Configure FlowSdkService with working directory if provided
    if (options?.workingDirectory) {
      flowSdkService.setDefaultWorkingDirectory(options.workingDirectory);
      logger.info('Set flow working directory', {
        workingDirectory: options.workingDirectory,
      });
    }

    // 3. Verify FlowSdkService is ready
    if (!flowSdkService.isReady()) {
      throw new Error('FlowSdkService is not ready');
    }
    logger.debug('FlowSdkService is ready for flow execution');

    // 4. Set up execution update event listener for logging
    flowExecutionService.on('execution-update', (update) => {
      logger.debug('Flow execution update', {
        type: update.type,
        executionId: update.executionId,
        nodeId: update.nodeId,
      });
    });

    // 5. Start the flow scheduler service (enabled by default)
    const enableScheduler = options?.enableScheduler !== false;
    if (enableScheduler) {
      flowSchedulerService.start();
      logger.info('Flow scheduler service started');

      // Set up scheduler event listeners for logging
      flowSchedulerService.on('flow-executing', (data) => {
        logger.info('Scheduler executing flow', {
          flowId: data.flowId,
          flowName: data.flowName,
          scheduleType: data.scheduleType,
        });
      });

      flowSchedulerService.on('flow-executed', (data) => {
        logger.info('Scheduler flow execution completed', {
          flowId: data.flowId,
          executionId: data.executionId,
          success: data.success,
        });
      });

      flowSchedulerService.on('flow-failed', (data) => {
        logger.error('Scheduler flow execution failed', {
          flowId: data.flowId,
          error: data.error,
        });
      });
    } else {
      logger.info('Flow scheduler service disabled by configuration');
    }

    isInitialized = true;
    logger.info('Flow execution system initialized successfully');

    return true;
  } catch (error) {
    logger.error('Failed to initialize flow system', error as Error);
    return false;
  }
}

/**
 * Check if the flow system is initialized
 */
export function isFlowSystemInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the flow execution service instance
 * Throws if system is not initialized
 */
export function getFlowExecutionService() {
  if (!isInitialized) {
    throw new Error('Flow system not initialized. Call initializeFlowSystem() first.');
  }
  return flowExecutionService;
}

/**
 * Get the flow SDK service instance
 * Throws if system is not initialized
 */
export function getFlowSdkService() {
  if (!isInitialized) {
    throw new Error('Flow system not initialized. Call initializeFlowSystem() first.');
  }
  return flowSdkService;
}

/**
 * Get the flow scheduler service instance
 * Throws if system is not initialized
 */
export function getFlowSchedulerService() {
  if (!isInitialized) {
    throw new Error('Flow system not initialized. Call initializeFlowSystem() first.');
  }
  return flowSchedulerService;
}

/**
 * Stop the flow scheduler service
 * Useful for graceful shutdown
 */
export function stopFlowScheduler(): void {
  if (flowSchedulerService.isSchedulerRunning()) {
    flowSchedulerService.stop();
    logger.info('Flow scheduler service stopped');
  }
}
