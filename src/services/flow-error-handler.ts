/**
 * Claude Agent UI - Flow Error Handler
 *
 * This module provides comprehensive error handling utilities for flow execution:
 * - Error classification (transient vs permanent)
 * - Exponential backoff with jitter for retries
 * - Retry state management
 * - Error recovery action determination
 *
 * @see src/types/flow-types.ts for error-related type definitions
 */

import type {
  ErrorCategory,
  ErrorRecoveryAction,
  FlowError,
  RetryAttempt,
  NodeRetryState,
  RetryConfig,
  FlowNode,
  AgentNode,
} from '../types/flow-types.js';
import { isAgentNode } from '../types/flow-types.js';

// =============================================================================
// DEFAULT RETRY CONFIGURATION
// =============================================================================

/**
 * Default retry configuration values
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true,
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  useJitter: true,
  retryOnCategories: ['transient', 'unknown'],
};

// =============================================================================
// ERROR PATTERNS FOR CLASSIFICATION
// =============================================================================

/**
 * Patterns that indicate transient errors (should retry)
 */
const TRANSIENT_ERROR_PATTERNS: Array<{ pattern: RegExp; code?: string }> = [
  // Network errors
  { pattern: /ECONNRESET/i, code: 'ECONNRESET' },
  { pattern: /ECONNREFUSED/i, code: 'ECONNREFUSED' },
  { pattern: /ETIMEDOUT/i, code: 'ETIMEDOUT' },
  { pattern: /ENOTFOUND/i, code: 'ENOTFOUND' },
  { pattern: /socket hang up/i },
  { pattern: /network error/i },
  { pattern: /connection.*reset/i },
  { pattern: /connection.*refused/i },
  { pattern: /timeout/i, code: 'TIMEOUT' },

  // Rate limiting
  { pattern: /rate limit/i, code: 'RATE_LIMITED' },
  { pattern: /too many requests/i, code: 'TOO_MANY_REQUESTS' },
  { pattern: /429/i, code: 'HTTP_429' },
  { pattern: /quota exceeded/i, code: 'QUOTA_EXCEEDED' },

  // Service availability
  { pattern: /service unavailable/i, code: 'SERVICE_UNAVAILABLE' },
  { pattern: /503/i, code: 'HTTP_503' },
  { pattern: /502/i, code: 'HTTP_502' },
  { pattern: /504/i, code: 'HTTP_504' },
  { pattern: /temporarily unavailable/i },
  { pattern: /server error/i, code: 'SERVER_ERROR' },
  { pattern: /500/i, code: 'HTTP_500' },

  // Overloaded
  { pattern: /overloaded/i, code: 'OVERLOADED' },
  { pattern: /capacity/i },
  { pattern: /busy/i, code: 'BUSY' },

  // API-specific transient errors
  { pattern: /anthropic.*error/i },
  { pattern: /claude.*error/i },
  { pattern: /api.*error/i },
];

/**
 * Patterns that indicate permanent errors (should NOT retry)
 */
const PERMANENT_ERROR_PATTERNS: Array<{ pattern: RegExp; code?: string }> = [
  // Authentication/Authorization
  { pattern: /unauthorized/i, code: 'UNAUTHORIZED' },
  { pattern: /401/i, code: 'HTTP_401' },
  { pattern: /403/i, code: 'HTTP_403' },
  { pattern: /forbidden/i, code: 'FORBIDDEN' },
  { pattern: /invalid.*key/i, code: 'INVALID_API_KEY' },
  { pattern: /authentication/i, code: 'AUTH_ERROR' },
  { pattern: /invalid.*token/i, code: 'INVALID_TOKEN' },

  // Not found
  { pattern: /not found/i, code: 'NOT_FOUND' },
  { pattern: /404/i, code: 'HTTP_404' },
  { pattern: /does not exist/i },

  // Validation
  { pattern: /validation.*fail/i, code: 'VALIDATION_ERROR' },
  { pattern: /invalid.*input/i, code: 'INVALID_INPUT' },
  { pattern: /invalid.*parameter/i, code: 'INVALID_PARAMETER' },
  { pattern: /required.*field/i, code: 'MISSING_FIELD' },
  { pattern: /schema.*error/i },
  { pattern: /400/i, code: 'HTTP_400' },

  // Configuration
  { pattern: /configuration.*error/i, code: 'CONFIG_ERROR' },
  { pattern: /no handler.*registered/i, code: 'NO_HANDLER' },
  { pattern: /flow.*not.*active/i, code: 'FLOW_INACTIVE' },
  { pattern: /agent.*not found/i, code: 'AGENT_NOT_FOUND' },

  // Content errors
  { pattern: /content.*policy/i, code: 'CONTENT_POLICY' },
  { pattern: /safety/i, code: 'SAFETY_ERROR' },
];

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

/**
 * Classify an error to determine how it should be handled
 *
 * @param error - The error to classify
 * @param statusCode - Optional HTTP status code
 * @returns Classified error with category and suggested action
 */
export function classifyError(
  error: Error | string,
  statusCode?: number
): FlowError {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Check for permanent errors first (more specific)
  for (const { pattern, code } of PERMANENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return createFlowError(errorMessage, {
        category: 'permanent',
        code,
        statusCode,
        stack: errorStack,
        isRetryable: false,
        suggestedAction: 'fail',
      });
    }
  }

  // Check for transient errors
  for (const { pattern, code } of TRANSIENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return createFlowError(errorMessage, {
        category: 'transient',
        code,
        statusCode,
        stack: errorStack,
        isRetryable: true,
        suggestedAction: 'retry',
      });
    }
  }

  // Check HTTP status codes if provided
  if (statusCode) {
    if (statusCode >= 500 || statusCode === 429) {
      return createFlowError(errorMessage, {
        category: 'transient',
        code: `HTTP_${statusCode}`,
        statusCode,
        stack: errorStack,
        isRetryable: true,
        suggestedAction: 'retry',
      });
    }
    if (statusCode >= 400 && statusCode < 500) {
      return createFlowError(errorMessage, {
        category: 'permanent',
        code: `HTTP_${statusCode}`,
        statusCode,
        stack: errorStack,
        isRetryable: false,
        suggestedAction: 'fail',
      });
    }
  }

  // Unknown errors - treat as potentially transient
  return createFlowError(errorMessage, {
    category: 'unknown',
    stack: errorStack,
    isRetryable: true,
    suggestedAction: 'retry',
  });
}

/**
 * Create a FlowError object with all required fields
 */
function createFlowError(
  message: string,
  options: {
    category: ErrorCategory;
    code?: string;
    statusCode?: number;
    stack?: string;
    isRetryable: boolean;
    suggestedAction: ErrorRecoveryAction;
    context?: Record<string, any>;
  }
): FlowError {
  return {
    message,
    code: options.code,
    statusCode: options.statusCode,
    category: options.category,
    suggestedAction: options.suggestedAction,
    isRetryable: options.isRetryable,
    stack: options.stack,
    context: options.context,
    timestamp: new Date(),
  };
}

// =============================================================================
// EXPONENTIAL BACKOFF
// =============================================================================

/**
 * Calculate the delay before the next retry attempt using exponential backoff
 *
 * @param attemptNumber - Current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Calculate exponential delay: initialDelay * (multiplier ^ (attempt - 1))
  const exponentialDelay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter if enabled (random variance of +/- 25%)
  if (config.useJitter) {
    const jitterRange = cappedDelay * 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  return Math.round(cappedDelay);
}

// =============================================================================
// RETRY STATE MANAGEMENT
// =============================================================================

/**
 * Create initial retry state for a node
 *
 * @param maxRetries - Maximum number of retries allowed
 * @returns Initial retry state
 */
export function createRetryState(maxRetries: number): NodeRetryState {
  return {
    retryCount: 0,
    maxRetries,
    attempts: [],
    isWaitingForRetry: false,
    totalRetryTime: 0,
  };
}

/**
 * Record a retry attempt in the retry state
 *
 * @param state - Current retry state
 * @param success - Whether the attempt succeeded
 * @param delayMs - Delay before this attempt
 * @param error - Error message if failed
 * @returns Updated retry state
 */
export function recordRetryAttempt(
  state: NodeRetryState,
  success: boolean,
  delayMs: number,
  error?: string
): NodeRetryState {
  const attempt: RetryAttempt = {
    attemptNumber: state.retryCount + 1,
    startedAt: new Date(),
    completedAt: new Date(),
    delayMs,
    success,
    error,
  };

  return {
    ...state,
    retryCount: state.retryCount + 1,
    attempts: [...state.attempts, attempt],
    totalRetryTime: state.totalRetryTime + delayMs,
    isWaitingForRetry: false,
    nextRetryAt: undefined,
  };
}

/**
 * Mark retry state as waiting for next retry
 *
 * @param state - Current retry state
 * @param nextRetryAt - When the next retry will be attempted
 * @param lastError - Error that triggered the retry
 * @returns Updated retry state
 */
export function markWaitingForRetry(
  state: NodeRetryState,
  nextRetryAt: Date,
  lastError: FlowError
): NodeRetryState {
  return {
    ...state,
    isWaitingForRetry: true,
    nextRetryAt,
    lastError,
  };
}

// =============================================================================
// RETRY DECISION LOGIC
// =============================================================================

/**
 * Determine if a node should be retried based on the error and configuration
 *
 * @param node - The failed node
 * @param error - The classified error
 * @param retryState - Current retry state
 * @param config - Retry configuration (optional, uses node config or defaults)
 * @returns Whether the node should be retried
 */
export function shouldRetry(
  node: FlowNode,
  error: FlowError,
  retryState: NodeRetryState,
  config?: RetryConfig
): boolean {
  // Get retry configuration from node or use provided/default
  const retryConfig = config || getNodeRetryConfig(node);

  // Check if retries are enabled
  if (!retryConfig.enabled) {
    return false;
  }

  // Check if we've exceeded max retries
  if (retryState.retryCount >= retryConfig.maxRetries) {
    return false;
  }

  // Check if error category is in the retry list
  if (
    retryConfig.retryOnCategories &&
    !retryConfig.retryOnCategories.includes(error.category)
  ) {
    return false;
  }

  // Check if specific error code is in the retry list (if configured)
  if (
    retryConfig.retryOnCodes &&
    error.code &&
    !retryConfig.retryOnCodes.includes(error.code)
  ) {
    return false;
  }

  // Check if error is retryable
  return error.isRetryable;
}

/**
 * Get retry configuration from a node
 *
 * @param node - The flow node
 * @returns Retry configuration
 */
export function getNodeRetryConfig(node: FlowNode): RetryConfig {
  // Only agent nodes have retry configuration
  if (isAgentNode(node)) {
    const agentNode = node as AgentNode;
    return {
      ...DEFAULT_RETRY_CONFIG,
      enabled: agentNode.retryOnError ?? DEFAULT_RETRY_CONFIG.enabled,
      maxRetries: agentNode.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
    };
  }

  // Other node types use default configuration but with retries disabled
  return {
    ...DEFAULT_RETRY_CONFIG,
    enabled: false,
    maxRetries: 0,
  };
}

/**
 * Determine the recovery action for a failed node
 *
 * @param node - The failed node
 * @param error - The classified error
 * @param retryState - Current retry state
 * @returns The recovery action to take
 */
export function determineRecoveryAction(
  node: FlowNode,
  error: FlowError,
  retryState: NodeRetryState
): ErrorRecoveryAction {
  // If we can still retry, do so
  const retryConfig = getNodeRetryConfig(node);
  if (shouldRetry(node, error, retryState, retryConfig)) {
    return 'retry';
  }

  // Check if node has a default value configured (in metadata)
  if (node.metadata?.defaultOnError !== undefined) {
    return 'use_default';
  }

  // Check if node is marked as optional/skippable
  if (node.metadata?.optional === true || node.metadata?.skipOnError === true) {
    return 'skip';
  }

  // Default to failing the execution
  return 'fail';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format a delay time for human-readable display
 *
 * @param ms - Delay in milliseconds
 * @returns Human-readable string (e.g., "2.5s", "30s", "1m 30s")
 */
export function formatDelay(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Create a human-readable error summary
 *
 * @param error - The flow error
 * @param retryState - Optional retry state
 * @returns Human-readable error summary
 */
export function formatErrorSummary(
  error: FlowError,
  retryState?: NodeRetryState
): string {
  let summary = `[${error.category.toUpperCase()}] ${error.message}`;

  if (error.code) {
    summary = `[${error.code}] ${summary}`;
  }

  if (retryState && retryState.retryCount > 0) {
    summary += ` (after ${retryState.retryCount} retry attempt${retryState.retryCount > 1 ? 's' : ''})`;
  }

  return summary;
}

/**
 * Check if an error is likely a timeout error
 *
 * @param error - The error to check
 * @returns Whether the error is a timeout
 */
export function isTimeoutError(error: Error | string): boolean {
  const message = error instanceof Error ? error.message : error;
  return /timeout|timed out|etimedout/i.test(message);
}

/**
 * Check if an error is likely a rate limit error
 *
 * @param error - The error to check
 * @returns Whether the error is a rate limit
 */
export function isRateLimitError(error: Error | string): boolean {
  const message = error instanceof Error ? error.message : error;
  return /rate.?limit|too many requests|429|quota/i.test(message);
}

/**
 * Extract HTTP status code from an error if present
 *
 * @param error - The error to check
 * @returns HTTP status code or undefined
 */
export function extractStatusCode(error: Error | string): number | undefined {
  const message = error instanceof Error ? error.message : error;

  // Check for status code in error message
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch) {
    return parseInt(statusMatch[1], 10);
  }

  // Check for status property on error object
  if (error instanceof Error) {
    const errWithStatus = error as Error & { status?: number; statusCode?: number };
    return errWithStatus.status || errWithStatus.statusCode;
  }

  return undefined;
}
