import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import { ServerIcon, ChevronDownIcon, ChevronRightIcon, InfoIcon, RefreshIcon } from './ui/Icons';

interface MCPToolsSelectorProps {
  selectedMCPTools: Record<string, string[]>;
  onChange: (mcpTools: Record<string, string[]>) => void;
  disabled?: boolean;
  directory?: string;
}

const MCPToolsSelector: React.FC<MCPToolsSelectorProps> = ({
  selectedMCPTools,
  onChange,
  disabled = false,
  directory,
}) => {
  const [mcpServers, setMCPServers] = useState<api.MCPServer[]>([]);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingServers, setRefreshingServers] = useState<Set<string>>(new Set());
  const [selectedToolDetail, setSelectedToolDetail] = useState<{
    server: api.MCPServer;
    tool: api.MCPToolType;
  } | null>(null);

  useEffect(() => {
    loadMCPServers();
  }, [directory]);

  const loadMCPServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const servers = await api.getMCPServers(directory);

      // Only include servers that have tools
      const serversWithTools = servers.filter(s => s.mcpTools && s.mcpTools.length > 0);
      setMCPServers(serversWithTools);

      // Auto-expand servers that have selected tools
      const autoExpand = new Set<string>();
      serversWithTools.forEach(server => {
        if (selectedMCPTools[server.id] && selectedMCPTools[server.id].length > 0) {
          autoExpand.add(server.id);
        }
      });
      setExpandedServers(autoExpand);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  };

  const toggleServer = (serverId: string) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };

  const toggleTool = (serverId: string, toolName: string) => {
    const currentTools = selectedMCPTools[serverId] || [];
    let newTools: string[];

    if (currentTools.includes(toolName)) {
      // Remove tool
      newTools = currentTools.filter(t => t !== toolName);
    } else {
      // Add tool
      newTools = [...currentTools, toolName];
    }

    // Update the entire mcpTools object
    const newMCPTools = { ...selectedMCPTools };
    if (newTools.length === 0) {
      delete newMCPTools[serverId];
    } else {
      newMCPTools[serverId] = newTools;
    }

    onChange(newMCPTools);
  };

  const toggleAllToolsForServer = (serverId: string) => {
    const server = mcpServers.find(s => s.id === serverId);
    if (!server || !server.mcpTools) return;

    const currentTools = selectedMCPTools[serverId] || [];
    const allToolNames = server.mcpTools.map((t: api.MCPToolType) => t.name);

    let newMCPTools = { ...selectedMCPTools };

    if (currentTools.length === allToolNames.length) {
      // All selected, deselect all
      delete newMCPTools[serverId];
    } else {
      // Not all selected, select all
      newMCPTools[serverId] = allToolNames;
    }

    onChange(newMCPTools);
  };

  const refreshServerTools = async (serverId: string) => {
    setRefreshingServers(prev => new Set(prev).add(serverId));

    try {
      const result = await api.listMCPServerTools(serverId, directory);

      if (result.success) {
        // Update server tools in state
        setMCPServers(prev =>
          prev.map(s =>
            s.id === serverId ? { ...s, mcpTools: result.tools } : s
          )
        );
      }
    } catch (err) {
      console.error('Failed to refresh tools:', err);
    } finally {
      setRefreshingServers(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading MCP servers...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (mcpServers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded">
        No MCP servers with tools found. Add MCP servers in the MCP Servers section to see their tools here.
      </div>
    );
  }

  const getTotalSelectedTools = () => {
    return Object.values(selectedMCPTools).reduce((sum, tools) => sum + tools.length, 0);
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        {getTotalSelectedTools() > 0
          ? `${getTotalSelectedTools()} MCP tool(s) selected across ${Object.keys(selectedMCPTools).length} server(s)`
          : 'No MCP tools selected'}
      </div>

      {/* MCP Servers List */}
      <div className="border border-border rounded-md max-h-80 overflow-y-auto">
        {mcpServers.map((server) => {
          const isExpanded = expandedServers.has(server.id);
          const serverTools = server.mcpTools || [];
          const selectedTools = selectedMCPTools[server.id] || [];
          const allSelected = selectedTools.length === serverTools.length;
          const someSelected = selectedTools.length > 0 && !allSelected;

          return (
            <div key={server.id} className="border-b border-border last:border-b-0">
              {/* Server Header */}
              <div className="flex items-center gap-2 p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <button
                  type="button"
                  onClick={() => toggleServer(server.id)}
                  disabled={disabled}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </button>

                <ServerIcon className="h-4 w-4 text-primary flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{server.name}</span>
                    {server.disabled && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                        Disabled
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      ({serverTools.length} tool{serverTools.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                {/* Select All Checkbox for Server */}
                <label
                  className="flex items-center gap-2 text-xs cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={() => toggleAllToolsForServer(server.id)}
                    disabled={disabled}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-muted-foreground">
                    {allSelected ? 'All' : someSelected ? `${selectedTools.length}` : 'None'}
                  </span>
                </label>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshServerTools(server.id);
                  }}
                  disabled={disabled || refreshingServers.has(server.id)}
                  className="flex-shrink-0 p-1 text-muted-foreground hover:text-primary rounded disabled:opacity-50"
                  title="Refresh tools"
                >
                  <RefreshIcon className={`h-4 w-4 ${refreshingServers.has(server.id) ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Tools List */}
              {isExpanded && (
                <div className="p-2 space-y-1 bg-background">
                  {serverTools.map((tool: api.MCPToolType) => {
                    const isSelected = selectedTools.includes(tool.name);

                    return (
                      <div
                        key={tool.name}
                        className="flex items-start gap-2 p-2 rounded hover:bg-secondary/50 transition-colors"
                      >
                        <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTool(server.id, tool.name)}
                            disabled={disabled}
                            className="mt-1 w-4 h-4 rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs text-primary break-all">
                              mcp__{server.name}__{tool.name}
                            </div>
                            {tool.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {tool.description}
                              </div>
                            )}
                          </div>
                        </label>

                        {/* Info button */}
                        <button
                          type="button"
                          onClick={() => setSelectedToolDetail({ server, tool })}
                          className="flex-shrink-0 text-muted-foreground hover:text-primary p-1"
                          title="View details"
                        >
                          <InfoIcon className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tool Detail Modal */}
      {selectedToolDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedToolDetail(null)}
        >
          <div
            className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold font-mono">
                mcp__{selectedToolDetail.server.name}__{selectedToolDetail.tool.name}
              </h3>
              {selectedToolDetail.tool.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedToolDetail.tool.description}
                </p>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {/* Server Info */}
                <div>
                  <h4 className="text-sm font-medium mb-1">MCP Server</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedToolDetail.server.name}
                  </p>
                </div>

                {/* Tool Name */}
                <div>
                  <h4 className="text-sm font-medium mb-1">Tool Name</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedToolDetail.tool.name}
                  </p>
                </div>

                {/* Input Schema */}
                {selectedToolDetail.tool.inputSchema && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Input Schema</h4>
                    <pre className="text-xs bg-secondary/50 p-3 rounded border border-border overflow-x-auto max-h-60">
                      {JSON.stringify(selectedToolDetail.tool.inputSchema, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedToolDetail(null)}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPToolsSelector;
