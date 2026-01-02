import React, { useState, useEffect, useCallback } from 'react';
import type {
  Flow,
  FlowStatus,
  FlowCategory,
  FlowExecution,
  FlowExecutionStatus,
} from '../types';
import * as flowApi from '../services/flow-api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import {
  SearchIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
  CopyIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SpinnerIcon,
  PlusIcon,
  RefreshIcon,
  ArchiveIcon,
  EyeIcon,
} from './ui/Icons';
import FlowExecutionModal from './FlowExecutionModal';
import FlowTemplateSelector from './flow/FlowTemplateSelector';

interface FlowsPageProps {
  onViewFlow?: (flow: Flow) => void;
  onEditFlow?: (flow: Flow) => void;
  onCreateFlow?: () => void;
  onEditFlowById?: (flowId: string) => void;
}

type FilterMode = 'all' | 'active' | 'draft' | 'paused' | 'archived';
type CategoryFilter = 'all' | FlowCategory;

// Status badge component
const StatusBadge: React.FC<{ status: FlowStatus }> = ({ status }) => {
  const statusConfig: Record<FlowStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
    paused: { label: 'Paused', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    archived: { label: 'Archived', className: 'bg-red-100 text-red-700 border-red-200' },
  };

  const config = statusConfig[status];
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
};

// Category badge component
const CategoryBadge: React.FC<{ category: FlowCategory }> = ({ category }) => {
  const categoryConfig: Record<FlowCategory, { label: string; emoji: string }> = {
    'web-scraping': { label: 'Web Scraping', emoji: '🌐' },
    'data-processing': { label: 'Data Processing', emoji: '📊' },
    'api-integration': { label: 'API Integration', emoji: '🔌' },
    'file-manipulation': { label: 'File Manipulation', emoji: '📁' },
    automation: { label: 'Automation', emoji: '🤖' },
    custom: { label: 'Custom', emoji: '⚙️' },
  };

  const config = categoryConfig[category];
  return (
    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1">
      <span>{config.emoji}</span>
      {config.label}
    </span>
  );
};

// Execution status indicator
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

const FlowsPage: React.FC<FlowsPageProps> = ({ onViewFlow, onEditFlow, onCreateFlow, onEditFlowById }) => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<Map<string, FlowExecution[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterMode>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [executingFlows, setExecutingFlows] = useState<Set<string>>(new Set());
  const [deletingFlows, setDeletingFlows] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow Execution Modal state
  const [selectedFlowForExecution, setSelectedFlowForExecution] = useState<Flow | null>(null);

  // Template Selector Modal state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);

  // Load flows
  const loadFlows = useCallback(async () => {
    try {
      setError(null);
      const response = await flowApi.getFlows({
        status: statusFilter !== 'all' ? (statusFilter as FlowStatus) : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: searchTerm || undefined,
      });
      setFlows(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flows');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchTerm]);

  // Load recent executions for a flow
  const loadRecentExecutions = useCallback(async (flowId: string) => {
    try {
      const response = await flowApi.getFlowExecutions(flowId, { pageSize: 3 });
      setRecentExecutions(prev => new Map(prev).set(flowId, response.data));
    } catch (err) {
      // Silently fail for execution loading
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // Load executions when flows change
  useEffect(() => {
    flows.forEach(flow => {
      loadRecentExecutions(flow.id);
    });
  }, [flows, loadRecentExecutions]);

  // Auto-refresh with exponential backoff
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    let intervalId: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const POLLING_INTERVAL = 30000; // 30 seconds - normal polling interval when healthy
    const BASE_DELAY = 5000; // 5 seconds - base for exponential backoff
    const MAX_DELAY = 30000; // 30 seconds - max delay for exponential backoff

    const scheduleNextPoll = (delayMs: number) => {
      if (intervalId) clearTimeout(intervalId);
      intervalId = setTimeout(poll, delayMs);
    };

    const poll = async () => {
      try {
        await loadFlows();
        retryCount = 0; // Reset on success
        // Continue polling at normal interval after success
        scheduleNextPoll(POLLING_INTERVAL);
      } catch (error) {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          // Stop polling after max retries
          if (intervalId) clearTimeout(intervalId);
          return;
        }
        // Calculate exponential backoff delay for next attempt
        const nextDelay = Math.min(
          BASE_DELAY * Math.pow(2, retryCount - 1),
          MAX_DELAY
        );
        scheduleNextPoll(nextDelay);
      }
    };

    // Initial poll
    poll();

    // Cleanup function
    return () => {
      if (intervalId) clearTimeout(intervalId);
    };
  }, [autoRefreshEnabled, loadFlows]);

  // Handle flow execution - open modal
  const handleExecuteFlow = (flow: Flow) => {
    setSelectedFlowForExecution(flow);
  };

  // Handle execution modal close
  const handleExecutionModalClose = () => {
    setSelectedFlowForExecution(null);
  };

  // Handle execution complete
  const handleExecutionComplete = (execution: FlowExecution) => {
    // Refresh executions for this flow
    if (selectedFlowForExecution) {
      loadRecentExecutions(selectedFlowForExecution.id);
    }
  };

  // Handle flow deletion
  const handleDeleteFlow = async (flow: Flow) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${flow.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingFlows(prev => new Set(prev).add(flow.id));

    try {
      await flowApi.deleteFlow(flow.id);
      setFlows(prev => prev.filter(f => f.id !== flow.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete flow');
    } finally {
      setDeletingFlows(prev => {
        const next = new Set(prev);
        next.delete(flow.id);
        return next;
      });
    }
  };

  // Handle flow duplication
  const handleDuplicateFlow = async (flow: Flow) => {
    try {
      const response = await flowApi.duplicateFlow(flow.id, `${flow.name} (Copy)`);
      setFlows(prev => [response.flow, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate flow');
    }
  };

  // Handle flow activation/deactivation
  const handleToggleActive = async (flow: Flow) => {
    try {
      if (flow.isActive) {
        const response = await flowApi.deactivateFlow(flow.id);
        setFlows(prev => prev.map(f => f.id === flow.id ? response.flow : f));
      } else {
        const response = await flowApi.activateFlow(flow.id);
        setFlows(prev => prev.map(f => f.id === flow.id ? response.flow : f));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle flow status');
    }
  };

  // Handle template selection
  const handleTemplateSelect = async (templateId: string) => {
    setCreatingFromTemplate(true);
    try {
      const response = await flowApi.createFlowFromTemplate(templateId);
      setFlows(prev => [response.flow, ...prev]);
      setShowTemplateSelector(false);
      // Open the newly created flow for editing
      if (onEditFlowById) {
        onEditFlowById(response.flow.id);
      } else if (onEditFlow) {
        onEditFlow(response.flow);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create flow from template');
    } finally {
      setCreatingFromTemplate(false);
    }
  };

  // Handle creating flow from scratch
  const handleStartFromScratch = () => {
    setShowTemplateSelector(false);
    onCreateFlow?.();
  };

  // Open template selector when creating a new flow
  const handleCreateNewFlow = () => {
    setShowTemplateSelector(true);
  };

  // Filter flows
  const filteredFlows = flows.filter(flow => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        flow.name.toLowerCase().includes(term) ||
        (flow.description?.toLowerCase() || '').includes(term) ||
        flow.slug.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Count stats
  const activeCount = flows.filter(f => f.status === 'active').length;
  const draftCount = flows.filter(f => f.status === 'draft').length;
  const pausedCount = flows.filter(f => f.status === 'paused').length;
  const archivedCount = flows.filter(f => f.status === 'archived').length;

  const categoryOptions: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All Categories' },
    { value: 'web-scraping', label: 'Web Scraping' },
    { value: 'data-processing', label: 'Data Processing' },
    { value: 'api-integration', label: 'API Integration' },
    { value: 'file-manipulation', label: 'File Manipulation' },
    { value: 'automation', label: 'Automation' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Flows</h1>
          <p className="text-muted-foreground">
            Manage your workflow automations ({flows.length} total)
          </p>
        </div>
        <div className="absolute right-8 top-8 flex gap-2">
          <Button
            onClick={() => loadFlows()}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RefreshIcon className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleCreateNewFlow}
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Create New Flow
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search flows by name, description, or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterMode)}
              className="text-sm border border-border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Statuses ({flows.length})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="draft">Draft ({draftCount})</option>
              <option value="paused">Paused ({pausedCount})</option>
              <option value="archived">Archived ({archivedCount})</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="text-sm border border-border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {categoryOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-refresh Toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-muted-foreground">Auto-refresh (30s)</span>
          </label>

          {/* Results Count */}
          <div className="ml-auto text-sm text-muted-foreground">
            Showing {filteredFlows.length} of {flows.length} flows
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
          <span className="text-red-700">{error}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => loadFlows()}
            className="ml-4 flex items-center gap-2"
          >
            <RefreshIcon className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="h-8 w-8 text-primary" />
          <span className="ml-2 text-muted-foreground">Loading flows...</span>
        </div>
      )}

      {/* Flows Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFlows.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No flows match your search or filter criteria'
                : 'No flows found. Create your first flow to get started!'}
            </div>
          ) : (
            filteredFlows.map((flow) => {
              const isExecuting = executingFlows.has(flow.id);
              const isDeleting = deletingFlows.has(flow.id);
              const flowExecutions = recentExecutions.get(flow.id) || [];
              const nodeCount = flow.nodes?.length || 0;

              return (
                <Card
                  key={flow.id}
                  className={`flex flex-col hover:border-primary/80 transition-colors duration-300 ${
                    flow.isActive ? 'border-l-4 border-l-green-500' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle
                        className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => onViewFlow?.(flow)}
                      >
                        <span className="text-primary">⚡</span>
                        <span className="truncate">{flow.name}</span>
                      </CardTitle>
                      <StatusBadge status={flow.status} />
                    </div>
                    <CardDescription
                      className="line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => onViewFlow?.(flow)}
                    >
                      {flow.description || 'No description'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-grow space-y-3">
                    {/* Category and Version */}
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <CategoryBadge category={flow.category} />
                      <span className="text-xs text-muted-foreground">v{flow.version}</span>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-2 pb-3 border-b border-border">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{nodeCount} Nodes</span>
                      </div>
                      {flow.isActive ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-green-600 font-medium">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <XCircleIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-muted-foreground">Inactive</span>
                        </div>
                      )}
                    </div>

                    {/* Recent Executions */}
                    {flowExecutions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-2">
                          Recent Executions
                        </h4>
                        <div className="space-y-1">
                          {flowExecutions.slice(0, 3).map((exec) => (
                            <div
                              key={exec.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <ExecutionStatusIcon status={exec.status} />
                                <span className="text-muted-foreground capitalize">
                                  {exec.status}
                                </span>
                              </div>
                              <span className="text-muted-foreground">
                                {exec.executionTime ? `${exec.executionTime}ms` : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Slug */}
                    <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                      /{flow.slug}
                    </div>
                  </CardContent>

                  <CardFooter className="flex gap-2 pt-3 flex-wrap">
                    {/* View Button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onViewFlow?.(flow)}
                      className="flex items-center gap-1"
                      title="View flow details and execution history"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </Button>

                    {/* Execute Button */}
                    <Button
                      size="sm"
                      onClick={() => handleExecuteFlow(flow)}
                      disabled={isExecuting || !flow.isActive}
                      className="flex items-center gap-1"
                      title={!flow.isActive ? 'Flow must be active to execute' : 'Execute flow'}
                    >
                      {isExecuting ? (
                        <SpinnerIcon className="h-4 w-4" />
                      ) : (
                        <PlayIcon className="h-4 w-4" />
                      )}
                      Run
                    </Button>

                    {/* Edit Button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEditFlow?.(flow)}
                      className="flex items-center gap-1"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Edit
                    </Button>

                    {/* More Actions Dropdown */}
                    <div className="flex gap-1 ml-auto">
                      {/* Toggle Active */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleActive(flow)}
                        title={flow.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {flow.isActive ? (
                          <XCircleIcon className="h-4 w-4" />
                        ) : (
                          <CheckCircleIcon className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Duplicate */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDuplicateFlow(flow)}
                        title="Duplicate"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteFlow(flow)}
                        disabled={isDeleting}
                        title="Delete"
                      >
                        {isDeleting ? (
                          <SpinnerIcon className="h-4 w-4" />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Flow Execution Modal */}
      {selectedFlowForExecution && (
        <FlowExecutionModal
          flow={selectedFlowForExecution}
          isOpen={!!selectedFlowForExecution}
          onClose={handleExecutionModalClose}
          onExecutionComplete={handleExecutionComplete}
        />
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !creatingFromTemplate && setShowTemplateSelector(false)}
          />
          {/* Modal Content */}
          <div className="relative z-10 bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 mx-4">
            {creatingFromTemplate ? (
              <div className="flex flex-col items-center justify-center py-12">
                <SpinnerIcon className="h-8 w-8 text-primary mb-4" />
                <p className="text-muted-foreground">Creating flow from template...</p>
              </div>
            ) : (
              <FlowTemplateSelector
                onSelect={handleTemplateSelect}
                onStartFromScratch={handleStartFromScratch}
                onClose={() => setShowTemplateSelector(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowsPage;
