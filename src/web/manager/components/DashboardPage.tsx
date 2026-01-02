import React, { useState, useEffect, useCallback } from 'react';
import type {
  Flow,
  FlowExecution,
  FlowExecutionStatus,
  GlobalFlowStats,
} from '../types';
import * as flowApi from '../services/flow-api';
import { getAgents, getSkills } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import {
  SpinnerIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayCircleIcon,
  RefreshIcon,
  CpuChipIcon,
  PuzzlePieceIcon,
  ArrowRightIcon,
} from './ui/Icons';

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  const iconColorClasses = {
    blue: 'text-blue-500 bg-blue-100',
    green: 'text-green-500 bg-green-100',
    red: 'text-red-500 bg-red-100',
    yellow: 'text-yellow-500 bg-yellow-100',
    purple: 'text-purple-500 bg-purple-100',
  };

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-full ${iconColorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Execution status badge
const ExecutionStatusBadge: React.FC<{ status: FlowExecutionStatus }> = ({ status }) => {
  const config: Record<FlowExecutionStatus, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      icon: <ClockIcon className="h-3 w-3" />,
    },
    running: {
      label: 'Running',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: <SpinnerIcon className="h-3 w-3" />,
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircleIcon className="h-3 w-3" />,
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 border-red-200',
      icon: <XCircleIcon className="h-3 w-3" />,
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
      icon: <XCircleIcon className="h-3 w-3" />,
    },
  };

  const { label, className, icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${className}`}>
      {icon}
      {label}
    </span>
  );
};

// Format duration helper
function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Format relative time helper
function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

interface DashboardPageProps {
  onNavigateToFlows?: () => void;
  onNavigateToAgents?: () => void;
  onNavigateToSkills?: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToFlows,
  onNavigateToAgents,
  onNavigateToSkills,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalFlowStats | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<FlowExecution[]>([]);
  const [activeFlows, setActiveFlows] = useState<Flow[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [skillCount, setSkillCount] = useState(0);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const [statsResult, recentResult, flowsResult, agents, skills] = await Promise.all([
        flowApi.getGlobalFlowStats().catch(() => null),
        flowApi.getRecentExecutions(10).catch(() => ({ data: [], count: 0 })),
        flowApi.getFlows({ isActive: true, pageSize: 5 }).catch(() => ({ data: [], meta: { total: 0 } })),
        getAgents().catch(() => []),
        getSkills().catch(() => []),
      ]);

      setGlobalStats(statsResult);
      setRecentExecutions(recentResult.data);
      setActiveFlows(flowsResult.data);
      setAgentCount(agents.length);
      setSkillCount(skills.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your Claude Agent Manager
          </p>
        </div>
        <div className="absolute right-8 top-8">
          <Button
            onClick={loadDashboardData}
            variant="secondary"
            className="flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              <RefreshIcon className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !globalStats && (
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon className="h-8 w-8 text-primary" />
          <span className="ml-2 text-muted-foreground">Loading dashboard...</span>
        </div>
      )}

      {/* Stats Grid */}
      {globalStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Flows"
            value={globalStats.totalFlows}
            subtitle={`${globalStats.activeFlows} active`}
            icon={<PlayCircleIcon className="h-6 w-6" />}
            color="blue"
          />
          <StatCard
            title="Total Executions"
            value={globalStats.totalExecutions}
            subtitle={globalStats.runningExecutions > 0 ? `${globalStats.runningExecutions} running` : undefined}
            icon={<ClockIcon className="h-6 w-6" />}
            color="purple"
          />
          <StatCard
            title="Success Rate"
            value={`${(globalStats.successRate * 100).toFixed(1)}%`}
            subtitle={`${globalStats.successCount} successful`}
            icon={<CheckCircleIcon className="h-6 w-6" />}
            color="green"
          />
          <StatCard
            title="Failed"
            value={globalStats.failedCount}
            subtitle={globalStats.totalCost > 0 ? `$${globalStats.totalCost.toFixed(4)} total` : undefined}
            icon={<XCircleIcon className="h-6 w-6" />}
            color="red"
          />
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onNavigateToFlows}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                <PlayCircleIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Flows</p>
                <p className="text-xl font-semibold">{globalStats?.totalFlows || 0}</p>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onNavigateToAgents}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                <CpuChipIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-xl font-semibold">{agentCount}</p>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onNavigateToSkills}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                <PuzzlePieceIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Skills</p>
                <p className="text-xl font-semibold">{skillCount}</p>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Executions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Executions</CardTitle>
                <CardDescription>Latest flow execution activity</CardDescription>
              </div>
              {onNavigateToFlows && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onNavigateToFlows}
                >
                  View All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentExecutions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PlayCircleIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No executions yet</p>
                <p className="text-sm">Run a flow to see execution history</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {execution.flow?.name || `Flow ${execution.flowId}`}
                        </span>
                        <ExecutionStatusBadge status={execution.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{formatRelativeTime(execution.startedAt || execution.createdAt)}</span>
                        {execution.executionTime && (
                          <>
                            <span>•</span>
                            <span>{formatDuration(execution.executionTime)}</span>
                          </>
                        )}
                        {execution.triggeredBy && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{execution.triggeredBy}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {execution.tokensUsed > 0 && (
                      <div className="text-xs text-muted-foreground ml-2">
                        {execution.tokensUsed.toLocaleString()} tokens
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Flows */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Flows</CardTitle>
                <CardDescription>Flows ready to execute</CardDescription>
              </div>
              {onNavigateToFlows && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onNavigateToFlows}
                >
                  Manage
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {activeFlows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PlayCircleIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active flows</p>
                <p className="text-sm">Create and activate a flow to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeFlows.map((flow) => (
                  <div
                    key={flow.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors cursor-pointer"
                    onClick={onNavigateToFlows}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-primary">⚡</span>
                        <span className="font-medium truncate">{flow.name}</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span className="capitalize">{flow.category.replace('-', ' ')}</span>
                        <span>•</span>
                        <span>v{flow.version}</span>
                        {flow.nodes && (
                          <>
                            <span>•</span>
                            <span>{flow.nodes.length} nodes</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Token Usage Summary */}
      {globalStats && (globalStats.totalTokensUsed > 0 || globalStats.totalCost > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-muted-foreground">Total Tokens Used:</span>
                  <span className="ml-2 font-medium">{globalStats.totalTokensUsed.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <span className="ml-2 font-medium">${globalStats.totalCost.toFixed(4)}</span>
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                Auto-refresh every 60s
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
