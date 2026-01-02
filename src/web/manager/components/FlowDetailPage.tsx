import React, { useState, useEffect, useCallback } from 'react';
import type {
  Flow,
  FlowExecution,
  FlowExecutionStatus,
  FlowNode,
  FlowExecutionLog,
  NodeExecution,
  FlowTriggerType,
  FlowNodeType,
} from '../types';
import * as flowApi from '../services/flow-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import {
  ArrowLeftIcon,
  PlayIcon,
  PencilIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  SpinnerIcon,
  RefreshIcon,
  CpuChipIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from './ui/Icons';
import FlowExecutionModal from './FlowExecutionModal';

interface FlowDetailPageProps {
  flowId: string;
  onBack: () => void;
  onEdit: (flow: Flow) => void;
}

type TabId = 'overview' | 'executions';

// Status badge component
const StatusBadge: React.FC<{ status: FlowExecutionStatus }> = ({ status }) => {
  const statusConfig: Record<FlowExecutionStatus, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    running: { label: 'Running', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700 border-green-200' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  };

  const config = statusConfig[status];
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
};

// Trigger type badge
const TriggerBadge: React.FC<{ trigger: FlowTriggerType }> = ({ trigger }) => {
  const triggerConfig: Record<FlowTriggerType, { label: string; className: string }> = {
    manual: { label: 'Manual', className: 'bg-purple-100 text-purple-700' },
    schedule: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700' },
    webhook: { label: 'Webhook', className: 'bg-green-100 text-green-700' },
    api: { label: 'API', className: 'bg-orange-100 text-orange-700' },
  };

  const config = triggerConfig[trigger];
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${config.className}`}>
      {config.label}
    </span>
  );
};

// Execution status icon
const ExecutionStatusIcon: React.FC<{ status: FlowExecutionStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <SpinnerIcon className="h-4 w-4 text-blue-600" />;
    case 'completed':
      return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
    case 'failed':
      return <XCircleIcon className="h-4 w-4 text-red-600" />;
    case 'cancelled':
      return <XCircleIcon className="h-4 w-4 text-gray-600" />;
    case 'pending':
    default:
      return <ClockIcon className="h-4 w-4 text-yellow-600" />;
  }
};

// Format duration in human readable format
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
};

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString();
};

// Log level badge
const LogLevelBadge: React.FC<{ level: FlowExecutionLog['level'] }> = ({ level }) => {
  const config = {
    debug: 'bg-gray-100 text-gray-600',
    info: 'bg-blue-100 text-blue-700',
    warn: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-mono ${config[level]}`}>
      {level}
    </span>
  );
};

// Node type icon
const NodeTypeIcon: React.FC<{ type: FlowNodeType }> = ({ type }) => {
  switch (type) {
    case 'input':
      return <PlayIcon className="h-4 w-4 text-blue-600" />;
    case 'agent':
      return <CpuChipIcon className="h-4 w-4 text-purple-600" />;
    case 'output':
      return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
    default:
      return <ClockIcon className="h-4 w-4 text-gray-600" />;
  }
};

// Execution detail row component
const ExecutionRow: React.FC<{
  execution: FlowExecution;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ execution, isExpanded, onToggle }) => {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <ExecutionStatusIcon status={execution.status} />
          <div>
            <div className="font-medium text-sm">
              Execution #{execution.id.slice(-8)}
            </div>
            <div className="text-xs text-muted-foreground">
              {execution.startedAt ? formatDate(execution.startedAt) : 'Not started'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <TriggerBadge trigger={execution.triggeredBy} />
          <StatusBadge status={execution.status} />
          {execution.executionTime !== undefined && (
            <span className="text-sm text-muted-foreground">
              {formatDuration(execution.executionTime)}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border p-4 bg-secondary/20 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-background p-3 rounded-lg border border-border">
              <div className="text-xs text-muted-foreground uppercase">Duration</div>
              <div className="font-semibold">
                {execution.executionTime !== undefined
                  ? formatDuration(execution.executionTime)
                  : '-'}
              </div>
            </div>
            <div className="bg-background p-3 rounded-lg border border-border">
              <div className="text-xs text-muted-foreground uppercase">Tokens</div>
              <div className="font-semibold">{execution.tokensUsed || 0}</div>
            </div>
            <div className="bg-background p-3 rounded-lg border border-border">
              <div className="text-xs text-muted-foreground uppercase">Cost</div>
              <div className="font-semibold">
                ${(execution.cost || 0).toFixed(4)}
              </div>
            </div>
            <div className="bg-background p-3 rounded-lg border border-border">
              <div className="text-xs text-muted-foreground uppercase">Retries</div>
              <div className="font-semibold">{execution.retryCount || 0}</div>
            </div>
          </div>

          {/* Input */}
          {execution.input && Object.keys(execution.input).length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Input</h5>
              <pre className="text-xs bg-background p-3 rounded border border-border overflow-x-auto">
                {JSON.stringify(execution.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Node Executions */}
          {execution.nodeExecutions && execution.nodeExecutions.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Node Executions</h5>
              <div className="space-y-2">
                {execution.nodeExecutions.map((nodeExec, idx) => (
                  <div
                    key={`${nodeExec.nodeId}-${idx}`}
                    className="flex items-center justify-between bg-background p-3 rounded border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <NodeTypeIcon type={nodeExec.nodeType} />
                      <span className="text-sm font-medium">{nodeExec.nodeId}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        ({nodeExec.nodeType})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {nodeExec.executionTime !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(nodeExec.executionTime)}
                        </span>
                      )}
                      {nodeExec.tokensUsed !== undefined && nodeExec.tokensUsed > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {nodeExec.tokensUsed} tokens
                        </span>
                      )}
                      <StatusBadge status={nodeExec.status as FlowExecutionStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {execution.logs && execution.logs.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Execution Logs</h5>
              <div className="bg-background rounded border border-border max-h-64 overflow-y-auto">
                {execution.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 border-b border-border last:border-b-0 text-xs font-mono"
                  >
                    <span className="text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <LogLevelBadge level={log.level} />
                    {log.nodeId && (
                      <span className="text-blue-600 whitespace-nowrap">[{log.nodeId}]</span>
                    )}
                    <span className="flex-1">{log.message}</span>
                    {log.data && Object.keys(log.data).length > 0 && (
                      <details className="ml-2">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          data
                        </summary>
                        <pre className="mt-1 p-2 bg-secondary/50 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output */}
          {execution.output && Object.keys(execution.output).length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Output</h5>
              <pre className="text-xs bg-background p-3 rounded border border-border overflow-x-auto">
                {typeof execution.output === 'string'
                  ? execution.output
                  : JSON.stringify(execution.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {execution.error && (
            <div>
              <h5 className="text-sm font-medium mb-2 text-red-600">Error</h5>
              <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
                {execution.error}
                {execution.errorDetails && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-red-500">Details</summary>
                    <pre className="mt-2 text-xs overflow-x-auto">
                      {JSON.stringify(execution.errorDetails, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FlowDetailPage: React.FC<FlowDetailPageProps> = ({ flowId, onBack, onEdit }) => {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [executions, setExecutions] = useState<FlowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [executionsPage, setExecutionsPage] = useState(1);
  const [executionsTotal, setExecutionsTotal] = useState(0);
  const PAGE_SIZE = 10;

  // Load flow details
  const loadFlow = useCallback(async () => {
    try {
      setError(null);
      const flowData = await flowApi.getFlow(flowId);
      setFlow(flowData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flow');
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  // Load executions
  const loadExecutions = useCallback(async (page: number = 1) => {
    try {
      setExecutionsLoading(true);
      const response = await flowApi.getFlowExecutions(flowId, {
        page,
        pageSize: PAGE_SIZE,
        sort: '-createdAt',
      });
      setExecutions(response.data);
      setExecutionsTotal(response.meta.total);
      setExecutionsPage(page);
    } catch (err) {
      // Silently fail for executions
    } finally {
      setExecutionsLoading(false);
    }
  }, [flowId]);

  // Initial load
  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  // Load executions when tab changes to executions
  useEffect(() => {
    if (activeTab === 'executions') {
      loadExecutions();
    }
  }, [activeTab, loadExecutions]);

  // Toggle execution expansion
  const toggleExecution = (executionId: string) => {
    setExpandedExecutions(prev => {
      const next = new Set(prev);
      if (next.has(executionId)) {
        next.delete(executionId);
      } else {
        next.add(executionId);
      }
      return next;
    });
  };

  // Handle execution complete
  const handleExecutionComplete = () => {
    loadExecutions();
  };

  // Calculate execution stats
  const calculateStats = () => {
    if (executions.length === 0) {
      return {
        total: executionsTotal,
        completed: 0,
        failed: 0,
        avgDuration: 0,
      };
    }

    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const durations = executions
      .filter(e => e.executionTime !== undefined)
      .map(e => e.executionTime as number);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return { total: executionsTotal, completed, failed, avgDuration };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SpinnerIcon className="h-8 w-8 text-primary" />
        <span className="ml-2 text-muted-foreground">Loading flow...</span>
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="text-center py-12">
        <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Flow</h2>
        <p className="text-muted-foreground mb-4">{error || 'Flow not found'}</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  const stats = calculateStats();
  const totalPages = Math.ceil(executionsTotal / PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-primary">⚡</span>
              {flow.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              /{flow.slug} • v{flow.version}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onEdit(flow)}
            className="flex items-center gap-2"
          >
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
          <Button
            onClick={() => setExecutionModalOpen(true)}
            disabled={!flow.isActive}
            className="flex items-center gap-2"
          >
            <PlayIcon className="h-4 w-4" />
            Run Flow
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('executions')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'executions'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClockIcon className="h-4 w-4" />
            Execution History
            {executionsTotal > 0 && (
              <span className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full">
                {executionsTotal}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Flow Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Flow Information</CardTitle>
              <CardDescription>{flow.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase">Status</div>
                <div className="font-semibold capitalize">{flow.status}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Category</div>
                <div className="font-semibold capitalize">{flow.category.replace('-', ' ')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Active</div>
                <div className="font-semibold">{flow.isActive ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Nodes</div>
                <div className="font-semibold">{flow.nodes?.length || 0}</div>
              </div>
            </CardContent>
          </Card>

          {/* Nodes Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflow Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {flow.nodes?.map((node, idx) => (
                  <div
                    key={node.nodeId}
                    className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {idx + 1}
                    </div>
                    <NodeTypeIcon type={node.type} />
                    <div className="flex-1">
                      <div className="font-medium">{node.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {node.type} node
                        {node.description && ` • ${node.description}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Triggers */}
          {(flow.schedule?.isEnabled || flow.webhookEnabled) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Schedule & Triggers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {flow.schedule?.isEnabled && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-medium text-blue-800">Scheduled Execution</div>
                    <div className="text-sm text-blue-600">
                      {flow.schedule.scheduleType === 'cron' && (
                        <>Cron: {flow.schedule.cronExpression}</>
                      )}
                      {flow.schedule.scheduleType === 'interval' && (
                        <>Every {flow.schedule.intervalValue} {flow.schedule.intervalUnit}</>
                      )}
                      {flow.schedule.scheduleType === 'once' && (
                        <>Once at {flow.schedule.startDate}</>
                      )}
                    </div>
                  </div>
                )}
                {flow.webhookEnabled && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="font-medium text-green-800">Webhook Trigger</div>
                    <div className="text-sm text-green-600">
                      POST /api/webhooks/flows/{flow.slug}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'executions' && (
        <div className="space-y-6">
          {/* Execution Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Executions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">Completed (page)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-muted-foreground">Failed (page)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : '-'}
                </div>
                <div className="text-sm text-muted-foreground">Avg Duration (page)</div>
              </CardContent>
            </Card>
          </div>

          {/* Refresh Button */}
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => loadExecutions(executionsPage)}
              disabled={executionsLoading}
              className="flex items-center gap-2"
            >
              <RefreshIcon className={`h-4 w-4 ${executionsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Executions List */}
          {executionsLoading && executions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <SpinnerIcon className="h-8 w-8 text-primary" />
              <span className="ml-2 text-muted-foreground">Loading executions...</span>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12 bg-secondary/30 rounded-lg">
              <ClockIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Executions Yet</h3>
              <p className="text-muted-foreground mb-4">
                This flow hasn't been executed yet. Run the flow to see execution history.
              </p>
              <Button
                onClick={() => setExecutionModalOpen(true)}
                disabled={!flow.isActive}
              >
                Run Flow
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {executions.map(execution => (
                <ExecutionRow
                  key={execution.id}
                  execution={execution}
                  isExpanded={expandedExecutions.has(execution.id)}
                  onToggle={() => toggleExecution(execution.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadExecutions(executionsPage - 1)}
                disabled={executionsPage <= 1 || executionsLoading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {executionsPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadExecutions(executionsPage + 1)}
                disabled={executionsPage >= totalPages || executionsLoading}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Flow Execution Modal */}
      {executionModalOpen && (
        <FlowExecutionModal
          flow={flow}
          isOpen={executionModalOpen}
          onClose={() => setExecutionModalOpen(false)}
          onExecutionComplete={handleExecutionComplete}
        />
      )}
    </div>
  );
};

export default FlowDetailPage;
