/**
 * Flow API Service for Manager Frontend
 *
 * Provides API client functions for flow operations:
 * - Flow CRUD operations (via Express/Strapi proxy)
 * - Flow execution management (via Express with SSE streaming)
 * - Flow execution history and monitoring
 *
 * @see src/routes/flow.routes.ts for backend endpoints
 * @see src/web/manager/types.ts for type definitions
 */

import type {
  Flow,
  FlowNode,
  FlowStatus,
  FlowCategory,
  FlowExecution,
  FlowExecutionStatus,
  FlowExecutionUpdate,
  FlowStats,
  GlobalFlowStats,
  FlowTriggerType,
  FlowCreateInput,
  FlowUpdateInput,
} from '../types';

// Express API base URL
// @ts-ignore - Vite env variables are available at runtime
const EXPRESS_API = import.meta.env?.VITE_EXPRESS_URL || 'http://localhost:3001/api';
const FLOWS_BASE = `${EXPRESS_API}/flows`;

// =============================================================================
// AUTH HELPERS (consistent with other API services)
// =============================================================================

/**
 * Get auth token from cookie
 */
function getAuthToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'cui-auth-token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Create fetch options with auth header
 */
function createFetchOptions(options: RequestInit = {}): RequestInit {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    ...options,
    headers,
  };
}

// =============================================================================
// FLOW CRUD OPERATIONS
// =============================================================================

/**
 * Flow query parameters for listing flows
 */
export interface FlowQueryParams {
  status?: FlowStatus;
  category?: FlowCategory;
  isActive?: boolean;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Flow list response with pagination metadata
 */
export interface FlowListResponse {
  data: Flow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/**
 * Get all flows with optional filtering and pagination
 */
export async function getFlows(params?: FlowQueryParams): Promise<FlowListResponse> {
  const url = new URL(FLOWS_BASE, window.location.origin);

  if (params) {
    if (params.status) url.searchParams.set('status', params.status);
    if (params.category) url.searchParams.set('category', params.category);
    if (params.isActive !== undefined) url.searchParams.set('isActive', String(params.isActive));
    if (params.search) url.searchParams.set('search', params.search);
    if (params.sort) url.searchParams.set('sort', params.sort);
    if (params.page) url.searchParams.set('page', String(params.page));
    if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get flows');
  }

  return response.json();
}

/**
 * Get a single flow by ID
 */
export async function getFlow(id: string): Promise<Flow> {
  const response = await fetch(`${FLOWS_BASE}/${id}`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get flow');
  }

  return response.json();
}

/**
 * Create flow response
 */
export interface CreateFlowResponse {
  success: boolean;
  flow: Flow;
  message: string;
}

/**
 * Create a new flow
 */
export async function createFlow(flow: FlowCreateInput): Promise<CreateFlowResponse> {
  const response = await fetch(FLOWS_BASE, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create flow');
  }

  return response.json();
}

/**
 * Update flow response
 */
export interface UpdateFlowResponse {
  success: boolean;
  flow: Flow;
  message: string;
}

/**
 * Update an existing flow
 */
export async function updateFlow(id: string, updates: FlowUpdateInput): Promise<UpdateFlowResponse> {
  const response = await fetch(`${FLOWS_BASE}/${id}`, createFetchOptions({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update flow');
  }

  return response.json();
}

/**
 * Delete a flow
 */
export async function deleteFlow(id: string): Promise<void> {
  const response = await fetch(`${FLOWS_BASE}/${id}`, createFetchOptions({
    method: 'DELETE',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete flow');
  }
}

// =============================================================================
// FLOW STATUS MANAGEMENT
// =============================================================================

/**
 * Activate a flow (sets isActive to true and status to 'active')
 */
export async function activateFlow(id: string): Promise<UpdateFlowResponse> {
  const response = await fetch(`${FLOWS_BASE}/${id}/activate`, createFetchOptions({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to activate flow');
  }

  return response.json();
}

/**
 * Deactivate a flow (sets isActive to false and status to 'paused')
 */
export async function deactivateFlow(id: string): Promise<UpdateFlowResponse> {
  const response = await fetch(`${FLOWS_BASE}/${id}/deactivate`, createFetchOptions({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to deactivate flow');
  }

  return response.json();
}

/**
 * Duplicate a flow
 */
export async function duplicateFlow(id: string, newName?: string): Promise<CreateFlowResponse> {
  const response = await fetch(`${FLOWS_BASE}/${id}/duplicate`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to duplicate flow');
  }

  return response.json();
}

// =============================================================================
// FLOW EXECUTION
// =============================================================================

/**
 * SSE event data from flow execution
 */
export interface FlowExecutionEvent {
  type: 'status' | 'result' | 'error' | string;
  status?: string;
  message?: string;
  flowId?: string;
  flowName?: string;
  executionId?: string;
  nodeId?: string;
  nodeType?: string;
  timestamp?: string;
  data?: Record<string, any>;
  result?: {
    executionId: string;
    success: boolean;
    status: FlowExecutionStatus;
    output?: Record<string, any>;
    error?: string;
    executionTime?: number;
    tokensUsed?: number;
    cost?: number;
    nodeExecutions?: Record<string, any>[];
  };
  error?: string;
}

/**
 * Start flow execution request
 */
export interface StartFlowExecutionRequest {
  input: Record<string, any>;
  triggeredBy?: FlowTriggerType;
  triggerData?: Record<string, any>;
}

/**
 * Execute a flow with SSE streaming for real-time updates
 *
 * @param flowId - The flow ID to execute
 * @param request - Execution request with input data
 * @param onEvent - Callback for SSE events
 * @returns Promise that resolves when execution completes or rejects on error
 */
export async function executeFlow(
  flowId: string,
  request: StartFlowExecutionRequest,
  onEvent?: (event: FlowExecutionEvent) => void
): Promise<void> {
  const response = await fetch(`${FLOWS_BASE}/${flowId}/execute`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to execute flow');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Read SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Skip comments (keep-alive)
        if (line.startsWith(':')) continue;

        // Parse event lines
        if (line.startsWith('event: ')) {
          // Event name line - we'll capture data on the next data: line
          continue;
        }

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (onEvent) {
              onEvent(data);
            }

            // Check for terminal states
            if (data.type === 'error') {
              throw new Error(data.error || data.message || 'Flow execution failed');
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              // Ignore JSON parse errors for malformed data
            } else {
              throw e;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create an EventSource-like object for monitoring flow execution
 *
 * This is useful when you need to attach event listeners for specific event types
 */
export function createFlowExecutionStream(
  flowId: string,
  request: StartFlowExecutionRequest
): EventSource & { close: () => void } {
  const eventTarget = new EventTarget();

  // Create abort controller for cancellation
  const abortController = new AbortController();

  const eventSource = Object.assign(eventTarget, {
    close: () => {
      abortController.abort();
    },
    readyState: 0,
    url: `${FLOWS_BASE}/${flowId}/execute`,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
  }) as EventSource & { close: () => void };

  fetch(`${FLOWS_BASE}/${flowId}/execute`, createFetchOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: abortController.signal,
  }))
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json();
        const errorEvent = new MessageEvent('error', {
          data: JSON.stringify({ type: 'error', error: error.error || 'Failed to execute flow' }),
        });
        eventSource.dispatchEvent(errorEvent);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim()) {
              const messageEvent = new MessageEvent('message', { data });
              eventSource.dispatchEvent(messageEvent);
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        const errorEvent = new MessageEvent('error', {
          data: JSON.stringify({ type: 'error', error: error.message }),
        });
        eventSource.dispatchEvent(errorEvent);
      }
    });

  return eventSource;
}

// =============================================================================
// FLOW EXECUTION HISTORY & MONITORING
// =============================================================================

/**
 * Execution query parameters
 */
export interface ExecutionQueryParams {
  status?: FlowExecutionStatus;
  triggeredBy?: FlowTriggerType;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Execution list response
 */
export interface ExecutionListResponse {
  data: FlowExecution[];
  meta: {
    flowId?: string;
    flowName?: string;
    page: number;
    pageSize: number;
    total: number;
  };
}

/**
 * Get all executions for a specific flow
 */
export async function getFlowExecutions(
  flowId: string,
  params?: ExecutionQueryParams
): Promise<ExecutionListResponse> {
  const url = new URL(`${FLOWS_BASE}/${flowId}/executions`, window.location.origin);

  if (params) {
    if (params.status) url.searchParams.set('status', params.status);
    if (params.triggeredBy) url.searchParams.set('triggeredBy', params.triggeredBy);
    if (params.sort) url.searchParams.set('sort', params.sort);
    if (params.page) url.searchParams.set('page', String(params.page));
    if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  }

  const response = await fetch(url.toString(), createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get flow executions');
  }

  return response.json();
}

/**
 * Get running executions response
 */
export interface RunningExecutionsResponse {
  active: string[];
  executions: FlowExecution[];
  count: number;
}

/**
 * Get all currently running executions
 */
export async function getRunningExecutions(): Promise<RunningExecutionsResponse> {
  const response = await fetch(`${FLOWS_BASE}/executions/running`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get running executions');
  }

  return response.json();
}

/**
 * Get a single execution by ID
 */
export async function getExecution(executionId: string): Promise<FlowExecution & { isActive?: boolean }> {
  const response = await fetch(`${FLOWS_BASE}/executions/${executionId}`, createFetchOptions());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get execution');
  }

  return response.json();
}

/**
 * Cancel a running execution
 */
export async function cancelExecution(executionId: string): Promise<{
  success: boolean;
  message: string;
  executionId: string;
}> {
  const response = await fetch(`${FLOWS_BASE}/executions/${executionId}/cancel`, createFetchOptions({
    method: 'POST',
  }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel execution');
  }

  return response.json();
}

/**
 * Create an SSE stream for monitoring a specific execution
 *
 * @param executionId - The execution ID to monitor
 * @param onEvent - Callback for execution updates
 * @returns Cleanup function to close the stream
 */
export function monitorExecution(
  executionId: string,
  onEvent: (event: FlowExecutionUpdate | FlowExecutionEvent) => void
): () => void {
  const abortController = new AbortController();

  fetch(`${FLOWS_BASE}/executions/${executionId}/stream`, createFetchOptions({
    signal: abortController.signal,
  }))
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to monitor execution');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith(':')) continue; // Skip comments

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              onEvent(data);
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onEvent({
          type: 'error',
          error: error.message,
          timestamp: new Date().toISOString(),
        } as FlowExecutionEvent);
      }
    });

  // Return cleanup function
  return () => {
    abortController.abort();
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export type {
  Flow,
  FlowNode,
  FlowStatus,
  FlowCategory,
  FlowExecution,
  FlowExecutionStatus,
  FlowExecutionUpdate,
  FlowStats,
  GlobalFlowStats,
  FlowTriggerType,
  FlowCreateInput,
  FlowUpdateInput,
};
