import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { ArrayEditor } from './ui/ArrayEditor';
import { KeyValueEditor } from './ui/KeyValueEditor';
import {
  ServerIcon, PlusIcon, PencilIcon, TrashIcon, GlobeIcon, FolderIcon,
  PlayCircleIcon, CheckCircleIcon, XCircleIcon, SpinnerIcon
} from './ui/Icons';

interface MCPServersPageProps {
  directory?: string;
}

const MCPServersPage: React.FC<MCPServersPageProps> = ({ directory }) => {
  const [servers, setServers] = useState<api.MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection for bulk operations
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [selectedServer, setSelectedServer] = useState<api.MCPServer | null>(null);

  // Quick Add mode
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [cliCommand, setCliCommand] = useState('');

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    disabled?: boolean;
    description?: string;
  }>({
    name: '',
    command: '',
    args: [],
    env: {},
    disabled: false,
    description: '',
  });

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<api.MCPServer | null>(null);

  // Bulk delete confirmation
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Test modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [importing, setImporting] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadServers();
  }, [directory]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMCPServers(directory);
      setServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  };

  const parseCLICommand = (command: string) => {
    // Format: <name> <command> [args...]
    // Example: chrome-devtools npx chrome-devtools-mcp@latest
    const parts = command.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const [name, cmd, ...args] = parts;
    return {
      name,
      command: cmd,
      args: args,
      env: {},
      disabled: false,
      description: '',
    };
  };

  const handleQuickAdd = () => {
    const parsed = parseCLICommand(cliCommand);
    if (!parsed || !parsed.name || !parsed.command) {
      showToast('Invalid format. Use: <name> <command> [args...]', 'error');
      return;
    }
    setFormData({
      name: parsed.name,
      command: parsed.command,
      args: parsed.args || [],
      env: parsed.env || {},
      disabled: parsed.disabled || false,
      description: parsed.description || '',
    });
    setQuickAddMode(false);
  };

  const handleCreate = () => {
    setModalMode('create');
    setQuickAddMode(false);
    setCliCommand('');
    setFormData({
      name: '',
      command: '',
      args: [],
      env: {},
      disabled: false,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (server: api.MCPServer) => {
    setModalMode('edit');
    setSelectedServer(server);

    // Extract config based on transport type
    const config = server.config as api.MCPStdioServerConfig;
    setFormData({
      name: server.name,
      command: config.command || '',
      args: config.args || [],
      env: config.env || {},
      disabled: server.disabled || false,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleView = (server: api.MCPServer) => {
    setModalMode('view');
    setSelectedServer(server);

    // Extract config based on transport type
    const config = server.config as api.MCPStdioServerConfig;
    setFormData({
      name: server.name,
      command: config.command || '',
      args: config.args || [],
      env: config.env || {},
      disabled: server.disabled || false,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      // Convert formData to MCPServerConfig
      const config: api.MCPStdioServerConfig = {
        type: 'stdio',
        command: formData.command,
        args: formData.args,
        env: formData.env,
        disabled: formData.disabled,
      };

      if (modalMode === 'create') {
        await api.createMCPServer(formData.name, config, directory);
        showToast('MCP server created successfully', 'success');
      } else if (modalMode === 'edit' && selectedServer) {
        await api.updateMCPServer(selectedServer.id, config, directory);
        showToast('MCP server updated successfully', 'success');
      }

      await loadServers();
      setIsModalOpen(false);
      setSelectedServer(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save MCP server', 'error');
    }
  };

  const handleDeleteClick = (server: api.MCPServer) => {
    setServerToDelete(server);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!serverToDelete) return;

    try {
      await api.deleteMCPServer(serverToDelete.id, directory);
      showToast('MCP server deleted successfully', 'success');
      await loadServers();
      setDeleteConfirmOpen(false);
      setServerToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete MCP server', 'error');
    }
  };

  const handleTest = async (server: api.MCPServer) => {
    setSelectedServer(server);
    setTesting(true);
    setTestResult(null);
    setTestModalOpen(true);

    try {
      const result = await api.testMCPServer(server.id, directory);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Test failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (server: api.MCPServer) => {
    try {
      const result = await api.toggleMCPServer(server.id, directory);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        await loadServers();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle MCP server', 'error');
    }
  };

  const handleLoadTools = async (server: api.MCPServer) => {
    try {
      const result = await api.refreshMCPServerTools(server.id, directory);
      if (result.success) {
        // Update the server with synced tools from Strapi
        setServers(prev => prev.map(s =>
          s.id === server.id
            ? { ...s, mcpTools: result.tools }
            : s
        ));
        showToast(`Synced ${result.toolsCount} tool(s) to Strapi`, 'success');
      } else {
        showToast(result.error || 'Failed to sync tools', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to sync tools', 'error');
    }
  };

  const handleExport = async () => {
    try {
      const config = await api.exportMCPConfig(directory);
      const dataStr = JSON.stringify(config, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mcp-config-export.json';
      link.click();
      URL.revokeObjectURL(url);
      showToast('Configuration exported successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export configuration', 'error');
    }
  };

  const handleImport = () => {
    setImportModalOpen(true);
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setImporting(true);
        const content = e.target?.result as string;
        const config = JSON.parse(content);

        await api.importMCPConfig(config, importMode, directory);
        showToast(`Configuration imported successfully (${importMode})`, 'success');
        await loadServers();
        setImportModalOpen(false);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to import configuration', 'error');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleSelectAll = () => {
    if (selectedServers.size === servers.length) {
      setSelectedServers(new Set());
    } else {
      setSelectedServers(new Set(servers.map(s => s.id)));
    }
  };

  const handleSelectServer = (server: api.MCPServer) => {
    const newSelected = new Set(selectedServers);
    if (newSelected.has(server.id)) {
      newSelected.delete(server.id);
    } else {
      newSelected.add(server.id);
    }
    setSelectedServers(newSelected);
  };

  const handleBulkDelete = () => {
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    const serversToDelete = servers.filter(s => selectedServers.has(s.id));
    const serverIds = serversToDelete.map(s => s.id);

    try {
      const result = await api.bulkDeleteMCPServers(serverIds, directory);
      showToast(result.message, result.failed > 0 ? 'error' : 'success');
      await loadServers();
      setSelectedServers(new Set());
      setBulkDeleteConfirmOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to bulk delete servers', 'error');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerIcon className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={loadServers}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MCP Servers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Model Context Protocol servers from .mcp.json in your project root
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport}>
            Export
          </Button>
          <Button variant="secondary" onClick={handleImport}>
            Import
          </Button>
          <Button onClick={handleCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedServers.size > 0 && (
        <Card className="p-4 bg-secondary/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedServers.size} server(s) selected
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedServers(new Set())}>
                Clear Selection
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Selection Controls */}
      {servers.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedServers.size === servers.length}
            onChange={handleSelectAll}
            className="rounded"
          />
          <label className="text-sm">Select All</label>
        </div>
      )}

      {/* All MCP Servers */}
      {servers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">MCP Servers</h3>
            <span className="text-sm text-muted-foreground">({servers.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                isSelected={selectedServers.has(server.id)}
                onSelect={() => handleSelectServer(server)}
                onView={() => handleView(server)}
                onEdit={() => handleEdit(server)}
                onDelete={() => handleDeleteClick(server)}
                onTest={() => handleTest(server)}
                onToggle={() => handleToggle(server)}
                onLoadTools={() => handleLoadTools(server)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {servers.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <ServerIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No MCP Servers Found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              You haven't configured any MCP servers yet. Add a server to extend Claude's capabilities.
            </p>
            <Button onClick={handleCreate}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Your First Server
            </Button>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {modalMode === 'create' ? 'Add MCP Server' : modalMode === 'edit' ? 'Edit MCP Server' : 'MCP Server Details'}
              </DialogTitle>
            </DialogHeader>
        <div className="space-y-4">
          {/* Quick Add Toggle (only for create mode) */}
          {modalMode === 'create' && (
            <div className="flex items-center gap-2 pb-2 border-b">
              <button
                onClick={() => setQuickAddMode(false)}
                className={`px-3 py-1.5 text-sm rounded ${
                  !quickAddMode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setQuickAddMode(true)}
                className={`px-3 py-1.5 text-sm rounded ${
                  quickAddMode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Quick Add (CLI)
              </button>
            </div>
          )}

          {/* Quick Add Mode */}
          {modalMode === 'create' && quickAddMode && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Enter a Claude CLI command to quickly add a server:
                </p>
                <code className="block text-xs bg-secondary p-2 rounded mb-3">
                  Format: &lt;name&gt; &lt;command&gt; [args...]
                  <br />
                  Example: chrome-devtools npx chrome-devtools-mcp@latest
                </code>
                <Input
                  value={cliCommand}
                  onChange={(e) => setCliCommand(e.target.value)}
                  placeholder="chrome-devtools npx chrome-devtools-mcp@latest"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleQuickAdd();
                    }
                  }}
                />
              </div>
              <Button onClick={handleQuickAdd} className="w-full">
                Parse & Fill Form
              </Button>
            </div>
          )}

          {/* Manual Mode / Edit Mode / View Mode */}
          {(!quickAddMode || modalMode !== 'create') && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Server Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="my-mcp-server"
                  disabled={modalMode === 'view'}
                />
              </div>

          <div>
            <label className="block text-sm font-medium mb-2">Command</label>
            <Input
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              placeholder="node"
              disabled={modalMode === 'view'}
            />
          </div>

          <ArrayEditor
            label="Arguments"
            value={formData.args}
            onChange={(args) => setFormData({ ...formData, args })}
            placeholder="/path/to/server.js"
            disabled={modalMode === 'view'}
          />

          <KeyValueEditor
            label="Environment Variables"
            value={formData.env || {}}
            onChange={(env) => setFormData({ ...formData, env })}
            disabled={modalMode === 'view'}
          />

          <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                  disabled={modalMode === 'view'}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                  {modalMode === 'view' ? 'Close' : 'Cancel'}
                </Button>
                {modalMode !== 'view' && (
                  <Button onClick={handleSave}>
                    {modalMode === 'create' ? 'Create' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmOpen && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete MCP Server</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete <strong>{serverToDelete?.name}</strong>?
                This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteConfirm}>
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Delete Confirmation */}
      {bulkDeleteConfirmOpen && (
        <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Multiple Servers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete {selectedServers.size} server(s)?
                This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setBulkDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleBulkDeleteConfirm}>
                  Delete All
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Test Modal */}
      {testModalOpen && (
        <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test MCP Server</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ServerIcon className="h-5 w-5" />
                <span className="font-medium">{selectedServer?.name}</span>
              </div>

              {testing && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SpinnerIcon className="h-5 w-5" />
                  <span>Testing MCP server...</span>
                </div>
              )}

              {!testing && testResult && (
                <div className={`p-4 rounded-md ${
                  testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <XCircleIcon className="h-5 w-5" />
                    )}
                    <span className="font-medium">{testResult.message}</span>
                  </div>
                  {testResult.error && (
                    <p className="text-sm mt-2">{testResult.error}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setTestModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import MCP Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Import Mode</label>
                <Select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as 'merge' | 'overwrite')}
                  disabled={importing}
                >
                  <option value="merge">Merge (keep existing servers)</option>
                  <option value="overwrite">Overwrite (replace all)</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select File</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  disabled={importing}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90"
                />
              </div>

              {importing && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SpinnerIcon className="h-5 w-5" />
                  <span>Importing configuration...</span>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setImportModalOpen(false)} disabled={importing}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Server Card Component
interface ServerCardProps {
  server: api.MCPServer;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggle: () => void;
  onLoadTools: () => void;
}

const ServerCard: React.FC<ServerCardProps> = ({
  server,
  isSelected,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onTest,
  onToggle,
  onLoadTools,
}) => {
  const [showTools, setShowTools] = React.useState(false);

  return (
    <Card className={`p-4 hover:border-primary cursor-pointer transition-colors ${
      isSelected ? 'border-primary bg-primary/5' : ''
    } ${server.disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 rounded"
        />
        <div className="flex-1 min-w-0" onClick={onView}>
          <div className="flex items-start gap-2">
            <ServerIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold truncate">{server.name}</h4>
                {server.disabled && (
                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">Disabled</span>
                )}
                {server.mcpTools && server.mcpTools.length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                    {server.mcpTools.length} {server.mcpTools.length === 1 ? 'tool' : 'tools'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {server.command}
              </p>
              {server.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {server.description}
                </p>
              )}
              {server.mcpTools && server.mcpTools.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowTools(!showTools); }}
                    className="text-xs text-primary hover:underline"
                  >
                    {showTools ? '▼' : '▶'} {server.mcpTools.length} tool(s)
                  </button>
                  {showTools && (
                    <div className="mt-1 pl-4 space-y-1">
                      {server.mcpTools.map((tool: api.MCPToolType) => (
                        <div key={tool.id} className="text-xs">
                          <span className="font-mono text-primary">mcp__{server.name}__{tool.name}</span>
                          {tool.description && (
                            <span className="text-muted-foreground ml-2">- {tool.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-1 mt-3 pt-3 border-t">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`flex-1 p-1 rounded text-xs ${
            server.disabled
              ? 'hover:bg-green-100 text-green-600'
              : 'hover:bg-gray-200 text-gray-600'
          }`}
          title={server.disabled ? 'Enable' : 'Disable'}
        >
          <CheckCircleIcon className="h-4 w-4 mx-auto" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onLoadTools(); }}
          className="flex-1 p-1 hover:bg-blue-100 text-blue-600 rounded text-xs"
          title="Sync Tools to Strapi"
        >
          <ServerIcon className="h-4 w-4 mx-auto" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onTest(); }}
          className="flex-1 p-1 hover:bg-green-100 text-green-600 rounded text-xs"
          title="Test"
        >
          <PlayCircleIcon className="h-4 w-4 mx-auto" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex-1 p-1 hover:bg-secondary rounded text-xs"
          title="Edit"
        >
          <PencilIcon className="h-4 w-4 mx-auto" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-1 p-1 hover:bg-destructive/10 text-destructive rounded text-xs"
          title="Delete"
        >
          <TrashIcon className="h-4 w-4 mx-auto" />
        </button>
      </div>
    </Card>
  );
};

export default MCPServersPage;
