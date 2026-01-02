/**
 * MCPServersPage - Model Context Protocol Server Management
 *
 * A comprehensive page component for managing Model Context Protocol (MCP) servers in the Claude Manager UI.
 * Provides server listing, configuration, testing, tool synchronization, and import/export functionality.
 * MCP servers extend Claude's capabilities by exposing tools through a standardized protocol.
 *
 * ## Features
 *
 * - **Server Listing**: Grid-based display of all configured MCP servers with status and metadata
 * - **CRUD Operations**: Create, Read, Update, Delete MCP server configurations
 * - **Quick Add Mode**: CLI-style command parsing for rapid server setup
 * - **Server Testing**: Test MCP server connectivity and tool availability
 * - **Tool Synchronization**: Load and sync tools from MCP servers to Strapi backend
 * - **Bulk Operations**: Multi-select servers and bulk delete functionality
 * - **Import/Export**: Export/import .mcp.json configuration with merge or overwrite modes
 * - **Enable/Disable**: Toggle server enabled/disabled state without deletion
 * - **Toast Notifications**: User feedback for all operations (success/error messages)
 * - **Directory Integration**: Automatic server loading based on selected directory
 *
 * ## Server Listing
 *
 * Displays MCP servers in a responsive grid layout (1 column mobile, 2 columns tablet, 3 columns desktop).
 * Each server card shows:
 *
 * - **Header**: Server name, disabled badge (if disabled), tool count badge
 * - **Command Display**: Truncated command preview
 * - **Description**: Optional server description (line-clamp-2)
 * - **Tools Section**: Collapsible list of tools with format `mcp__{server}__{tool}` and descriptions
 * - **Selection Checkbox**: For bulk operations (positioned top-left)
 * - **Action Buttons** (5 icons):
 *   * Enable/Disable (CheckCircleIcon, green when disabled, gray when enabled)
 *   * Sync Tools (ServerIcon, blue, syncs tools to Strapi)
 *   * Test (PlayCircleIcon, green, tests server connectivity)
 *   * Edit (PencilIcon, secondary color)
 *   * Delete (TrashIcon, destructive color)
 *
 * ## CRUD Operations
 *
 * ### Create
 * Two creation modes available via "Add Server" button:
 *
 * 1. **Manual Mode** (Default):
 *    - Form-based input for all server configuration fields
 *    - Fields: Server Name, Command, Arguments (array), Environment Variables (key-value), Description
 *    - ArrayEditor for arguments, KeyValueEditor for environment variables
 *    - Validates and saves via `api.createMCPServer()`
 *
 * 2. **Quick Add Mode** (CLI Tab):
 *    - Paste CLI command: `<name> <command> [args...]`
 *    - Example: `chrome-devtools npx chrome-devtools-mcp@latest`
 *    - Parses command via `parseCLICommand()` and pre-fills form
 *    - Switches to Manual mode with populated fields for review
 *
 * ### Read
 * - Automatic loading on mount via `loadServers()`
 * - Reloads when `directory` prop changes
 * - Displays all servers from `.mcp.json` in project root
 * - Shows count in header ("MCP Servers (N)")
 *
 * ### Update (Edit)
 * - Click Edit button on any server card
 * - Opens modal with pre-populated form fields
 * - Extracts stdio config (command, args, env, disabled)
 * - Saves changes via `api.updateMCPServer()`
 *
 * ### Delete
 * - Single Delete: Click delete icon → confirmation dialog → `api.deleteMCPServer()`
 * - Bulk Delete: Select multiple servers → "Delete Selected" → confirmation → `api.bulkDeleteMCPServers()`
 *
 * ## Quick Add Mode
 *
 * CLI-style command parsing for rapid server configuration:
 *
 * ### Input Format
 * - Pattern: `<name> <command> [arg1] [arg2] ...`
 * - Example: `chrome-devtools npx chrome-devtools-mcp@latest`
 * - Splits on whitespace: first part = name, second = command, rest = args
 *
 * ### Parsing Workflow
 * 1. User enters CLI command in input field
 * 2. Clicks "Parse & Fill Form" button (or presses Enter)
 * 3. `parseCLICommand()` validates format (minimum 2 parts required)
 * 4. Creates formData object: `{ name, command, args, env: {}, disabled: false }`
 * 5. Switches to Manual mode with pre-populated fields
 * 6. User can review/modify before saving
 *
 * ### Validation
 * - Minimum 2 parts required (name + command)
 * - Shows error toast if format is invalid
 * - Empty args array if no arguments provided
 *
 * ## Server Testing
 *
 * Test MCP server connectivity and functionality:
 *
 * ### Test Workflow
 * 1. User clicks Test button on server card
 * 2. Test modal opens with server name display
 * 3. API call: `api.testMCPServer(serverId, directory)`
 * 4. Shows spinner during test execution
 * 5. Displays result with color-coded feedback:
 *    - Success: Green background, CheckCircleIcon
 *    - Failure: Red background, XCircleIcon, error message
 * 6. User closes modal
 *
 * ### Test Result Interface
 * - `success`: Boolean indicating test outcome
 * - `message`: Human-readable result message
 * - `error`: Optional error details on failure
 *
 * ## Tool Synchronization
 *
 * Load and sync tools from MCP servers to Strapi backend:
 *
 * ### Sync Workflow
 * 1. User clicks Sync Tools button (ServerIcon, blue)
 * 2. API call: `api.refreshMCPServerTools(serverId, directory)`
 * 3. Backend discovers tools from MCP server
 * 4. Creates/updates MCPTool records in Strapi
 * 5. Returns synced tools array and count
 * 6. Updates server card with new tool count and list
 * 7. Shows success toast: "Synced N tool(s) to Strapi"
 *
 * ### Tool Display
 * - Badge shows total tool count
 * - Collapsible section with arrow indicator (▶/▼)
 * - Each tool: `mcp__{serverName}__{toolName}` with description
 * - Displayed in monospace font with primary color
 *
 * ## Bulk Operations
 *
 * Multi-select functionality for batch server management:
 *
 * ### Selection Workflow
 * 1. User clicks "Select All" checkbox to select/deselect all servers
 * 2. Or clicks individual server checkboxes
 * 3. Selected servers tracked in Set (selectedServers state)
 * 4. Bulk Actions card appears when selectedServers.size > 0
 *
 * ### Bulk Actions Card
 * - Displays count: "N server(s) selected"
 * - Actions:
 *   * Clear Selection: Resets selectedServers to empty Set
 *   * Delete Selected: Opens bulk delete confirmation dialog
 *
 * ### Bulk Delete
 * 1. User clicks "Delete Selected" button
 * 2. Confirmation dialog shows count to delete
 * 3. On confirm: `api.bulkDeleteMCPServers(serverIds, directory)`
 * 4. Shows toast with result (success count, failure count)
 * 5. Reloads server list
 * 6. Clears selection
 *
 * ## Import/Export Configuration
 *
 * Export and import .mcp.json configuration files:
 *
 * ### Export Workflow
 * 1. User clicks "Export" button in header
 * 2. API call: `api.exportMCPConfig(directory)`
 * 3. Returns entire .mcp.json configuration
 * 4. Creates JSON blob and triggers browser download
 * 5. Downloads as "mcp-config-export.json"
 * 6. Shows success toast
 *
 * ### Import Workflow
 * 1. User clicks "Import" button → Import modal opens
 * 2. User selects import mode (dropdown):
 *    - Merge: Keep existing servers, add new ones (default)
 *    - Overwrite: Replace all existing servers
 * 3. User selects JSON file via file input
 * 4. FileReader reads file content
 * 5. JSON.parse() parses configuration
 * 6. API call: `api.importMCPConfig(config, mode, directory)`
 * 7. Backend processes import based on mode
 * 8. Reloads server list
 * 9. Shows success toast with mode
 * 10. Modal closes
 *
 * ### Import Modes
 * - **merge**: Adds new servers, updates existing by name, preserves others
 * - **overwrite**: Deletes all existing servers, replaces with imported config
 *
 * ## Enable/Disable Toggle
 *
 * Toggle server state without deletion:
 *
 * ### Toggle Workflow
 * 1. User clicks Enable/Disable button (CheckCircleIcon)
 * 2. Icon color: Green when disabled (to enable), Gray when enabled (to disable)
 * 3. API call: `api.toggleMCPServer(serverId, directory)`
 * 4. Backend updates server.disabled property in .mcp.json
 * 5. Returns result with success flag and message
 * 6. Shows toast with result message
 * 7. Reloads server list if successful
 * 8. Disabled servers display with opacity-60 and "Disabled" badge
 *
 * ## Toast Notifications
 *
 * User feedback for all operations:
 *
 * ### Toast Display
 * - Fixed position: top-right corner (top-4 right-4)
 * - Auto-dismiss: 5-second timeout (useEffect cleanup)
 * - Color-coded: Green background for success, Red for error
 * - Z-index: 50 for overlay visibility
 * - Shows operation result messages
 *
 * ### Toast Types
 * - **success**: Green background, white text, success messages
 * - **error**: Red background, white text, error messages
 *
 * ## State Management
 *
 * The component manages ten categories of state:
 *
 * 1. **Server List State** (`servers`, `loading`, `error`):
 *    - Fetched from API on mount and directory changes
 *    - Loading spinner during fetch
 *    - Error display with retry button
 *
 * 2. **Selection State** (`selectedServers`):
 *    - Set of server IDs for bulk operations
 *    - Updated via checkbox interactions
 *    - Cleared after bulk operations
 *
 * 3. **Modal State** (`isModalOpen`, `modalMode`, `selectedServer`):
 *    - Controls create/edit/view modal visibility
 *    - Mode: 'create' | 'edit' | 'view'
 *    - Tracks server being viewed/edited
 *
 * 4. **Quick Add State** (`quickAddMode`, `cliCommand`):
 *    - Toggle between Manual and Quick Add tabs
 *    - Stores CLI command string
 *
 * 5. **Form State** (`formData`):
 *    - Server configuration: name, command, args, env, disabled, description
 *    - Updated via form inputs
 *    - Reset on modal close
 *
 * 6. **Delete State** (`deleteConfirmOpen`, `serverToDelete`):
 *    - Single server delete confirmation
 *    - Tracks server pending deletion
 *
 * 7. **Bulk Delete State** (`bulkDeleteConfirmOpen`):
 *    - Bulk delete confirmation dialog
 *    - Uses selectedServers for server IDs
 *
 * 8. **Test State** (`testModalOpen`, `testResult`, `testing`):
 *    - Test modal visibility
 *    - Test execution status (loading)
 *    - Test result object (success, message, error)
 *
 * 9. **Import State** (`importModalOpen`, `importMode`, `importing`):
 *    - Import modal visibility
 *    - Import mode selection (merge/overwrite)
 *    - Import execution status (loading)
 *
 * 10. **Toast State** (`toast`):
 *     - Notification message and type
 *     - Auto-cleared after 5 seconds
 *
 * ## Directory Integration
 *
 * The component automatically loads servers based on the `directory` prop:
 *
 * 1. **Initial Load**: Fetches servers from API on mount
 * 2. **Directory Changes**: Reloads servers when directory prop changes (useEffect dependency)
 * 3. **API Integration**: Uses `api.getMCPServers(directory)` for data fetching
 * 4. **Error Handling**: Sets error state, displays error message with retry button
 * 5. **Loading States**: Shows spinner during fetch operations
 *
 * ## Styling Behavior
 *
 * The component uses Tailwind CSS classes for styling:
 *
 * - **Container**: `space-y-6` for vertical spacing between sections
 * - **Header**: `flex items-center justify-between` with title and action buttons
 * - **Grid Layout**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
 * - **Server Cards**: `hover:border-primary transition-colors` for interactive feedback
 * - **Disabled Servers**: `opacity-60` for visual indication
 * - **Selected Servers**: `border-primary bg-primary/5` for selection highlight
 * - **Badges**: Color-coded (gray for disabled, blue for tools)
 * - **Toast**: Fixed top-right with green/red backgrounds
 * - **Modal Tabs**: Active tab with primary background, inactive with secondary
 * - **Action Buttons**: Color-coded icons (green=test/enable, blue=sync, red=delete, gray=edit)
 * - **Empty State**: Centered layout with icon, heading, description, and CTA button
 * - **Loading State**: Centered spinner with primary color
 * - **Error State**: Centered error message with retry button
 *
 * @example
 * // Basic usage in ManagerApp dashboard phase
 * import MCPServersPage from './components/MCPServersPage';
 *
 * function ManagerApp() {
 *   const [activeView, setActiveView] = useState<DashboardView>('MCP Servers');
 *   const [directory, setDirectory] = useState('/path/to/project');
 *
 *   return (
 *     <Layout sidebarProps={{ activeView, onNavigate: setActiveView }}>
 *       {activeView === 'MCP Servers' && (
 *         <MCPServersPage directory={directory} />
 *       )}
 *     </Layout>
 *   );
 * }
 *
 * @example
 * // Understanding server creation workflow (Quick Add mode)
 * // 1. User clicks "Add Server" button
 * //    → handleCreate() opens modal in 'create' mode
 * // 2. User switches to "Quick Add (CLI)" tab
 * //    → setQuickAddMode(true)
 * // 3. User enters CLI command: "chrome-devtools npx chrome-devtools-mcp@latest"
 * //    → Updates cliCommand state
 * // 4. User presses Enter or clicks "Parse & Fill Form"
 * //    → parseCLICommand() parses: { name: "chrome-devtools", command: "npx", args: ["chrome-devtools-mcp@latest"] }
 * //    → setFormData() with parsed values
 * //    → setQuickAddMode(false) switches to Manual mode
 * // 5. User reviews pre-filled form, modifies if needed
 * // 6. User clicks "Create" button
 * //    → handleSave() calls api.createMCPServer()
 * //    → Shows success toast
 * //    → loadServers() refreshes list
 * //    → Modal closes
 *
 * @example
 * // Understanding server testing workflow
 * // 1. User clicks Test button (PlayCircleIcon) on server card
 * //    → handleTest(server) called
 * //    → setSelectedServer(server), setTestModalOpen(true), setTesting(true)
 * // 2. Test modal opens showing server name and spinner
 * //    → api.testMCPServer(serverId, directory) executes
 * // 3. Test completes (success or failure)
 * //    → setTestResult({ success, message, error })
 * //    → setTesting(false)
 * // 4. Result displays with color-coded background
 * //    → Success: Green with CheckCircleIcon
 * //    → Failure: Red with XCircleIcon and error details
 * // 5. User clicks "Close" button
 * //    → setTestModalOpen(false)
 *
 * @example
 * // Understanding tool synchronization workflow
 * // 1. User clicks Sync Tools button (ServerIcon, blue) on server card
 * //    → handleLoadTools(server) called
 * // 2. API discovers tools from MCP server
 * //    → api.refreshMCPServerTools(serverId, directory)
 * // 3. Backend creates/updates MCPTool records in Strapi
 * //    → Returns { success, tools, toolsCount }
 * // 4. Component updates server with synced tools
 * //    → setServers(prev => prev.map(...)) updates mcpTools array
 * // 5. Server card updates to show tool count badge and tool list
 * //    → Badge: "5 tools"
 * //    → Collapsible section with tool names and descriptions
 * // 6. Success toast displays
 * //    → "Synced 5 tool(s) to Strapi"
 *
 * @example
 * // Understanding bulk delete workflow
 * // 1. User selects multiple servers via checkboxes
 * //    → handleSelectServer() adds IDs to selectedServers Set
 * // 2. Bulk Actions card appears
 * //    → Shows count: "3 server(s) selected"
 * // 3. User clicks "Delete Selected" button
 * //    → handleBulkDelete() opens confirmation dialog
 * // 4. Confirmation dialog shows: "Delete 3 server(s)?"
 * // 5. User confirms deletion
 * //    → handleBulkDeleteConfirm() extracts server IDs from Set
 * //    → api.bulkDeleteMCPServers(serverIds, directory)
 * // 6. Backend processes deletions, returns result
 * //    → { message, deleted: 3, failed: 0 }
 * // 7. Shows toast with result
 * //    → "Successfully deleted 3 server(s)"
 * // 8. Reloads server list and clears selection
 * //    → loadServers(), setSelectedServers(new Set())
 */

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

/**
 * Props for the MCPServersPage component.
 *
 * @property {string} [directory] - Optional directory path for filtering MCP servers (e.g., "/path/to/project").
 *                                   When provided, loads servers from .mcp.json in that directory's root.
 *                                   All CRUD operations are scoped to this directory.
 */
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

  /**
   * Auto-dismiss toast notification after 5 seconds.
   *
   * Sets up a timeout to clear the toast state after 5000ms. Cleanup function
   * clears the timeout if the toast state changes or component unmounts.
   */
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  /**
   * Displays a toast notification with the specified message and type.
   *
   * Toast appears in the top-right corner with color-coded background (green for success,
   * red for error). Auto-dismisses after 5 seconds via useEffect hook.
   *
   * @internal
   * @param {string} message - The notification message to display
   * @param {'success' | 'error'} type - The notification type determining background color
   */
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  /**
   * Loads MCP servers from the API based on the current directory.
   *
   * Fetches servers from the backend API (.mcp.json in directory root) and updates the local state.
   * Shows loading spinner during fetch and handles errors with error message display.
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   */
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

  /**
   * Parses a CLI-style command string into server configuration object.
   *
   * Expected format: `<name> <command> [args...]`
   * Example: `chrome-devtools npx chrome-devtools-mcp@latest`
   *
   * Splits command on whitespace and extracts:
   * - First part: Server name
   * - Second part: Command executable
   * - Remaining parts: Command arguments (optional)
   *
   * @internal
   * @param {string} command - The CLI command string to parse
   * @returns {Object|null} Parsed configuration object or null if invalid format
   * @returns {string} return.name - Server name
   * @returns {string} return.command - Command executable
   * @returns {string[]} return.args - Command arguments array
   * @returns {Record<string, string>} return.env - Empty environment variables object
   * @returns {boolean} return.disabled - Disabled flag (always false)
   * @returns {string} return.description - Empty description string
   */
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

  /**
   * Handles Quick Add form submission by parsing CLI command and populating form fields.
   *
   * Validates CLI command format (minimum 2 parts: name and command), parses into
   * configuration object, and switches to Manual mode with pre-populated form.
   * Shows error toast if format is invalid.
   *
   * @internal
   */
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

  /**
   * Opens the create server modal with empty form fields.
   *
   * Resets all form state (formData, quickAddMode, cliCommand), sets modal mode to 'create',
   * and opens the modal dialog.
   *
   * @internal
   */
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

  /**
   * Opens the edit server modal with pre-populated form fields.
   *
   * Extracts server configuration from stdio config (command, args, env, disabled),
   * sets modal mode to 'edit', and opens the modal dialog with populated form.
   *
   * @internal
   * @param {api.MCPServer} server - The server to edit
   */
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

  /**
   * Opens the view server modal with read-only form fields.
   *
   * Similar to handleEdit but sets modal mode to 'view', which disables all form inputs.
   * Used for displaying server details without allowing edits.
   *
   * @internal
   * @param {api.MCPServer} server - The server to view
   */
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

  /**
   * Saves server configuration (create or update) via API.
   *
   * Converts formData to MCPStdioServerConfig and calls appropriate API method based on
   * modal mode ('create' or 'edit'). Shows success toast, reloads server list, and closes
   * modal on success. Shows error toast on failure.
   *
   * @internal
   * @async
   */
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

  /**
   * Opens the delete confirmation dialog for a single server.
   *
   * Sets serverToDelete state and opens the confirmation dialog. Actual deletion
   * occurs in handleDeleteConfirm after user confirmation.
   *
   * @internal
   * @param {api.MCPServer} server - The server to delete
   */
  const handleDeleteClick = (server: api.MCPServer) => {
    setServerToDelete(server);
    setDeleteConfirmOpen(true);
  };

  /**
   * Confirms and executes single server deletion.
   *
   * Deletes the server via API, shows success toast, reloads server list, and closes
   * the confirmation dialog. Shows error toast on failure.
   *
   * @internal
   * @async
   */
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

  /**
   * Tests MCP server connectivity and functionality.
   *
   * Opens test modal, shows spinner during test execution, and displays color-coded
   * result (green for success, red for failure with error details). Updates testResult
   * state with API response.
   *
   * @internal
   * @async
   * @param {api.MCPServer} server - The server to test
   */
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

  /**
   * Toggles MCP server enabled/disabled state.
   *
   * Calls API to toggle server.disabled property in .mcp.json. Shows toast with result
   * message and reloads server list on success. Disabled servers display with opacity-60.
   *
   * @internal
   * @async
   * @param {api.MCPServer} server - The server to toggle
   */
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

  /**
   * Loads and synchronizes tools from MCP server to Strapi backend.
   *
   * Calls API to discover tools from MCP server, creates/updates MCPTool records in Strapi,
   * and updates server card with synced tool list and count. Shows success toast with
   * tool count.
   *
   * @internal
   * @async
   * @param {api.MCPServer} server - The server to load tools from
   */
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

  /**
   * Exports MCP configuration to JSON file.
   *
   * Fetches entire .mcp.json configuration from API, creates JSON blob, and triggers
   * browser download as "mcp-config-export.json". Shows success toast on completion.
   *
   * @internal
   * @async
   */
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

  /**
   * Opens the import configuration modal.
   *
   * Sets importModalOpen to true, allowing user to select import mode (merge/overwrite)
   * and JSON file for import.
   *
   * @internal
   */
  const handleImport = () => {
    setImportModalOpen(true);
  };

  /**
   * Handles file selection for configuration import.
   *
   * Reads selected JSON file via FileReader, parses configuration, and calls API to
   * import with selected mode (merge or overwrite). Shows success toast with mode,
   * reloads server list, and closes modal. Shows error toast on parse or API failure.
   *
   * @internal
   * @param {React.ChangeEvent<HTMLInputElement>} event - File input change event
   */
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

  /**
   * Toggles selection of all servers.
   *
   * If all servers are selected, clears selection. Otherwise, selects all servers by
   * adding all server IDs to selectedServers Set.
   *
   * @internal
   */
  const handleSelectAll = () => {
    if (selectedServers.size === servers.length) {
      setSelectedServers(new Set());
    } else {
      setSelectedServers(new Set(servers.map(s => s.id)));
    }
  };

  /**
   * Toggles selection of a single server.
   *
   * If server is already selected, removes from Set. Otherwise, adds to Set.
   * Triggers Bulk Actions card to appear/disappear based on selection count.
   *
   * @internal
   * @param {api.MCPServer} server - The server to toggle selection for
   */
  const handleSelectServer = (server: api.MCPServer) => {
    const newSelected = new Set(selectedServers);
    if (newSelected.has(server.id)) {
      newSelected.delete(server.id);
    } else {
      newSelected.add(server.id);
    }
    setSelectedServers(newSelected);
  };

  /**
   * Opens the bulk delete confirmation dialog.
   *
   * Sets bulkDeleteConfirmOpen to true, showing confirmation for deleting all
   * selected servers.
   *
   * @internal
   */
  const handleBulkDelete = () => {
    setBulkDeleteConfirmOpen(true);
  };

  /**
   * Confirms and executes bulk server deletion.
   *
   * Filters servers by selectedServers Set, extracts server IDs, and calls API to
   * delete all selected servers. Shows toast with result (success count, failure count),
   * reloads server list, clears selection, and closes confirmation dialog.
   *
   * @internal
   * @async
   */
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

/**
 * ServerCard - MCP Server Display Card
 *
 * Individual server card component displaying MCP server information, tools, and action buttons.
 * Supports selection for bulk operations, collapsible tool list, and five action buttons
 * (enable/disable, sync tools, test, edit, delete).
 *
 * ## Features
 *
 * - **Server Display**: Name, command, description, status badges (disabled, tool count)
 * - **Selection**: Checkbox for bulk operations
 * - **Tools Display**: Collapsible section with tool list (format: `mcp__{server}__{tool}`)
 * - **Action Buttons**: 5 icon buttons with hover effects and tooltips
 * - **Status Indicators**: Disabled badge, tool count badge, opacity-60 when disabled
 * - **Interactive**: Click card to view details, click checkbox for selection
 *
 * ## Props
 *
 * @property {api.MCPServer} server - The MCP server object to display
 * @property {boolean} isSelected - Selection state for bulk operations (highlights card border)
 * @property {() => void} onSelect - Callback for checkbox selection toggle
 * @property {() => void} onView - Callback for card click to view server details
 * @property {() => void} onEdit - Callback for edit button click
 * @property {() => void} onDelete - Callback for delete button click
 * @property {() => void} onTest - Callback for test button click
 * @property {() => void} onToggle - Callback for enable/disable toggle button
 * @property {() => void} onLoadTools - Callback for sync tools button click
 */
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

/**
 * ServerCard component renders an individual MCP server card.
 *
 * Displays server information (name, command, description, tools) with interactive
 * elements (checkbox, action buttons, collapsible tool list). Card appearance changes
 * based on selection state (border highlight) and disabled state (opacity-60).
 *
 * @param {ServerCardProps} props - Component props
 * @returns {JSX.Element} Rendered server card
 */
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

ServerCard.displayName = 'ServerCard';
MCPServersPage.displayName = 'MCPServersPage';

export default MCPServersPage;
