/**
 * @file MCPToolsSelector.tsx
 * @description Multi-select MCP tool picker component with server grouping, tool filtering, and refresh functionality.
 * This component provides an interface for selecting MCP tools from configured MCP servers, organized by server
 * with expandable sections, individual and bulk selection, and real-time tool list refresh capability.
 *
 * ## Features
 * - **Server Grouping**: Tools organized by MCP server with collapsible server sections
 * - **Multi-Select Interface**: Checkbox-based selection for individual tools and bulk "Select All" per server
 * - **Server Expansion/Collapse**: Click chevron icon to expand/collapse server tool lists
 * - **Auto-Expand**: Automatically expands servers that have selected tools on load
 * - **Tool Refresh**: Refresh individual server tool lists with spinning indicator during refresh
 * - **Tool Detail Modal**: View comprehensive tool details including input schema and server info
 * - **Selection Summary**: Real-time display of total selected tools across all servers
 * - **Loading/Error/Empty States**: Graceful handling of API states with appropriate feedback
 * - **Directory-Aware**: Reloads servers when directory changes (via useEffect dependency)
 * - **Disabled Mode**: Can be disabled to show read-only view of selections
 * - **Controlled Component**: Fully controlled via selectedMCPTools and onChange props
 * - **Indeterminate State**: Server checkboxes show indeterminate state when some (but not all) tools selected
 *
 * ## MCP Tool Selection
 * The component provides hierarchical multi-select functionality organized by MCP server:
 *
 * ### Selection Data Structure
 * - **Format**: `Record<string, string[]>` where key is serverId and value is array of tool names
 * - **Example**: `{ "server-1": ["tool-a", "tool-b"], "server-2": ["tool-x"] }`
 * - **Empty Server**: Server with no tools selected is removed from object (not empty array)
 * - **Tool Name Format**: Display shows `mcp__{serverName}__{toolName}` but stored as just `toolName`
 *
 * ### Individual Tool Selection
 * - **Checkbox Input**: Each tool has a checkbox for selection toggle
 * - **Label Wrapper**: Entire tool row is clickable via label wrapping checkbox
 * - **Visual Feedback**: Hover shows bg-secondary/50, selected shows checked checkbox
 * - **Toggle Behavior**: Click to add if not selected, remove if already selected
 * - **Immutable Updates**: Creates new selectedMCPTools object (doesn't mutate)
 *
 * ### Individual Tool Workflow
 * 1. User clicks tool checkbox
 * 2. `toggleTool(serverId, toolName)` called
 * 3. Current tools for server retrieved from selectedMCPTools[serverId]
 * 4. New array created: add tool if not present, remove if already present
 * 5. New selectedMCPTools object created with updated tools
 * 6. If no tools remain for server, server key deleted from object
 * 7. `onChange(newMCPTools)` invoked with updated object
 * 8. Parent component updates state
 * 9. Component re-renders with new selectedMCPTools prop
 *
 * ## Server Integration
 * Tools are organized by MCP server with server-level controls:
 *
 * ### Server Display
 * - **Header Section**: Collapsible header showing server name, status, tool count, controls
 * - **Server Icon**: Primary-colored ServerIcon (4x4) on left
 * - **Server Name**: Font-medium text-sm, truncated if too long (truncate class)
 * - **Disabled Badge**: Gray badge shown if server.disabled is true
 * - **Tool Count**: Displays `(X tool[s])` in muted text
 * - **Expand/Collapse**: Chevron icon (down when expanded, right when collapsed)
 * - **Background**: Secondary/30 with hover to secondary/50 transition
 *
 * ### Server Loading
 * - **API Call**: `api.getMCPServers(directory)` fetches all servers
 * - **Filtering**: Only includes servers with `mcpTools.length > 0`
 * - **Empty Servers**: Servers without tools are excluded from display
 * - **Loading State**: Shows "Loading MCP servers..." message during initial load
 * - **Error State**: Shows red error message if API call fails
 * - **Empty State**: Shows dashed border message if no servers with tools found
 *
 * ### Auto-Expand Behavior
 * - **Trigger**: On initial load after fetching servers
 * - **Logic**: Auto-expand servers that have selectedMCPTools[serverId].length > 0
 * - **State**: `expandedServers` Set contains server IDs that should be expanded
 * - **Purpose**: Show selected tools immediately without manual expansion
 *
 * ## Multi-Select Behavior
 * Supports both individual tool selection and bulk server-level selection:
 *
 * ### Select All for Server
 * - **Location**: Server header, right side after tool count
 * - **Checkbox**: Shows checked when all tools selected, indeterminate when some selected, unchecked when none
 * - **Indeterminate State**: Uses `input.indeterminate = someSelected` for visual feedback
 * - **Label Text**:
 *   - "All" when all tools selected
 *   - Number (e.g., "3") when some tools selected
 *   - "None" when no tools selected
 * - **Toggle Behavior**:
 *   - If all selected: Deselect all → delete server key from selectedMCPTools
 *   - If some/none selected: Select all → set selectedMCPTools[serverId] to all tool names
 * - **Event Propagation**: `stopPropagation()` prevents server expand/collapse when clicking checkbox
 *
 * ### Selection States
 * - **All Selected**: `selectedTools.length === serverTools.length`
 * - **Some Selected**: `selectedTools.length > 0 && !allSelected`
 * - **None Selected**: `selectedTools.length === 0`
 *
 * ### Selection Summary
 * - **Location**: Top of component, above server list
 * - **Format**: "X MCP tool(s) selected across Y server(s)" or "No MCP tools selected"
 * - **Count Calculation**: Sum of all tool array lengths across all servers in selectedMCPTools
 * - **Server Count**: Number of keys in selectedMCPTools object
 * - **Real-Time**: Updates immediately as selections change
 *
 * ## Server Expansion/Collapse
 * Each server section can be expanded to show tools or collapsed to save space:
 *
 * ### Expansion Mechanism
 * - **Toggle Button**: Chevron icon button on left side of server header
 * - **Icon State**: ChevronDownIcon when expanded, ChevronRightIcon when collapsed
 * - **Click Area**: Entire server header is clickable to toggle expansion
 * - **State Management**: `expandedServers` Set contains IDs of expanded servers
 * - **Toggle Logic**: Add to Set if not present, remove if already present
 * - **Disabled State**: Expansion disabled when component disabled prop is true
 *
 * ### Tools List Display
 * - **Conditional Rendering**: Tool list only rendered when `isExpanded` is true
 * - **Background**: bg-background to differentiate from server header (bg-secondary/30)
 * - **Spacing**: p-2 padding with space-y-1 between tool items
 * - **Tool Layout**: Each tool in rounded container with hover effect
 *
 * ## Tool Refresh Functionality
 * Individual server tool lists can be refreshed to get latest tools from MCP server:
 *
 * ### Refresh Button
 * - **Location**: Server header, rightmost position
 * - **Icon**: RefreshIcon (4x4) with spinning animation during refresh
 * - **Animation**: `animate-spin` class applied when server is in refreshingServers Set
 * - **Disabled**: Disabled when component disabled or server is currently refreshing
 * - **Title**: "Refresh tools" tooltip on hover
 * - **Event Propagation**: `stopPropagation()` prevents server expand/collapse when clicking refresh
 *
 * ### Refresh Workflow
 * 1. User clicks refresh button for a server
 * 2. `refreshServerTools(serverId)` called
 * 3. Server ID added to `refreshingServers` Set (triggers spinning animation)
 * 4. `api.listMCPServerTools(serverId, directory)` API call made
 * 5. If successful, server's mcpTools updated in state with new tools
 * 6. Server ID removed from `refreshingServers` Set (stops spinning)
 * 7. Component re-renders with updated tool list
 *
 * ### Refresh States
 * - **Idle**: RefreshIcon static, button enabled
 * - **Refreshing**: RefreshIcon spinning (`animate-spin`), button disabled
 * - **Error**: Error logged to console, button re-enabled (silent failure)
 * - **Success**: Tool list updates, button re-enabled
 *
 * ## Tool Detail Modal
 * Clicking the info icon on a tool opens a modal with comprehensive details:
 *
 * ### Modal Trigger
 * - **Button**: InfoIcon button on right side of each tool item
 * - **Action**: Sets `selectedToolDetail` state to `{ server, tool }`
 * - **Non-Selection**: Clicking info does NOT select/deselect the tool
 * - **Title Attribute**: "View details" tooltip on hover
 *
 * ### Modal Content Sections
 * 1. **Header**:
 *    - Tool name in monospace: `mcp__{serverName}__{toolName}` (text-lg font-semibold font-mono)
 *    - Description (text-sm muted, mt-1) if available
 * 2. **MCP Server**:
 *    - Label: "MCP Server"
 *    - Value: Server name in monospace (font-mono)
 * 3. **Tool Name**:
 *    - Label: "Tool Name"
 *    - Value: Tool name in monospace (font-mono)
 * 4. **Input Schema**:
 *    - Label: "Input Schema"
 *    - Value: JSON.stringify with 2-space indentation in pre block
 *    - Styling: bg-secondary/50 with border, max-h-60 with scroll
 *    - Conditional: Only shown if tool.inputSchema exists
 *
 * ### Modal Behavior
 * - **Background**: Semi-transparent black overlay (bg-black/50)
 * - **Close Methods**: Click backdrop, click Close button in footer
 * - **Z-Index**: z-50 for layering above other content
 * - **Event Propagation**: `stopPropagation()` on modal content prevents backdrop close on modal click
 * - **Scrollable**: overflow-y-auto on content section, max-h-[80vh] on modal
 * - **Responsive**: max-w-2xl with p-4 padding for mobile
 * - **Layout**: Flex column with header, scrollable content, footer
 *
 * ## Directory Integration
 * Component reloads MCP servers when directory changes:
 *
 * ### Directory Handling
 * - **useEffect Dependency**: `[directory]` triggers reload on directory change
 * - **API Integration**: `directory` parameter passed to all API calls
 * - **Reload Behavior**: Complete re-fetch of servers and re-calculation of auto-expand
 * - **State Reset**: Loading state set to true, error cleared before reload
 *
 * ## Styling Behavior
 * Component uses Tailwind CSS with dark theme support:
 *
 * ### Container Styling
 * - **Outer Container**: space-y-3 for vertical spacing between sections
 * - **Server List Container**: border with rounded-md, max-h-80 with overflow-y-auto
 * - **Server Items**: border-b between servers, last:border-b-0 for last item
 *
 * ### Color Scheme
 * - **Server Header**: bg-secondary/30 with hover to bg-secondary/50
 * - **Tool List**: bg-background for contrast with server header
 * - **Primary Elements**: ServerIcon and selected tool names in text-primary
 * - **Muted Elements**: Tool counts, labels, descriptions in text-muted-foreground
 * - **Disabled Badge**: bg-gray-200 text-gray-600
 * - **Hover States**: hover:text-primary on refresh button, hover:bg-secondary/50 on tool items
 *
 * ### Typography
 * - **Server Name**: font-medium text-sm
 * - **Tool Display Name**: font-mono text-xs text-primary (break-all for long names)
 * - **Tool Description**: text-xs text-muted-foreground with line-clamp-2
 * - **Summary**: text-xs text-muted-foreground
 *
 * @example
 * // Basic usage with MCP tool selection
 * function AgentForm() {
 *   const [mcpTools, setMcpTools] = useState<Record<string, string[]>>({});
 *
 *   return (
 *     <div>
 *       <label>Select MCP Tools</label>
 *       <MCPToolsSelector
 *         selectedMCPTools={mcpTools}
 *         onChange={setMcpTools}
 *       />
 *     </div>
 *   );
 * }
 *
 * @example
 * // With custom directory and initial selection
 * function ProjectAgentForm() {
 *   const [mcpTools, setMcpTools] = useState({
 *     "filesystem-server": ["read_file", "write_file"],
 *     "database-server": ["query", "execute"]
 *   });
 *
 *   return (
 *     <MCPToolsSelector
 *       selectedMCPTools={mcpTools}
 *       onChange={setMcpTools}
 *       directory="/path/to/project"
 *     />
 *   );
 * }
 *
 * @example
 * // Disabled mode for read-only view
 * function ViewAgentTools({ agent }) {
 *   return (
 *     <div>
 *       <h3>Agent MCP Tools</h3>
 *       <MCPToolsSelector
 *         selectedMCPTools={agent.mcpTools || {}}
 *         onChange={() => {}} // No-op in read-only mode
 *         disabled={true}
 *       />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Understanding tool selection workflow
 * // Initial state:
 * // selectedMCPTools = { "server-1": ["tool-a"] }
 * //
 * // User clicks "tool-b" checkbox from "server-1":
 * // 1. toggleTool("server-1", "tool-b") called
 * // 2. currentTools = ["tool-a"]
 * // 3. newTools = ["tool-a", "tool-b"] (tool-b added)
 * // 4. onChange({ "server-1": ["tool-a", "tool-b"] })
 * //
 * // User clicks "Select All" for "server-2" with tools ["x", "y", "z"]:
 * // 1. toggleAllToolsForServer("server-2") called
 * // 2. allToolNames = ["x", "y", "z"]
 * // 3. onChange({ "server-1": ["tool-a", "tool-b"], "server-2": ["x", "y", "z"] })
 * //
 * // User unchecks "tool-a" from "server-1":
 * // 1. toggleTool("server-1", "tool-a") called
 * // 2. currentTools = ["tool-a", "tool-b"]
 * // 3. newTools = ["tool-b"] (tool-a removed)
 * // 4. onChange({ "server-1": ["tool-b"], "server-2": ["x", "y", "z"] })
 * //
 * // User clicks "Select All" for "server-1" when all already selected:
 * // 1. toggleAllToolsForServer("server-1") called
 * // 2. All selected, so deselect all
 * // 3. onChange({ "server-2": ["x", "y", "z"] }) // server-1 key deleted
 */

import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import { ServerIcon, ChevronDownIcon, ChevronRightIcon, InfoIcon, RefreshIcon } from './ui/Icons';

/**
 * Props for the MCPToolsSelector component.
 *
 * @interface MCPToolsSelectorProps
 * @property {Record<string, string[]>} selectedMCPTools - Object mapping server IDs to arrays of selected tool names.
 *   Example: `{ "server-1": ["tool-a", "tool-b"], "server-2": ["tool-x"] }`.
 *   Empty servers (no tools selected) are removed from object, not stored as empty arrays.
 * @property {function} onChange - Callback invoked when tool selection changes. Receives updated selectedMCPTools object.
 *   Called when user toggles individual tool, selects/deselects all tools for a server.
 * @property {boolean} [disabled=false] - If true, disables all interaction (checkboxes, expand/collapse, refresh).
 *   Used for read-only display of tool selections.
 * @property {string} [directory] - Optional directory path for loading directory-specific MCP servers.
 *   When changed, triggers reload of servers via useEffect dependency.
 */
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

  /**
   * Loads MCP servers from API and filters to only servers with tools.
   * Auto-expands servers that have selected tools.
   *
   * @internal
   * @async
   * @function loadMCPServers
   * @returns {Promise<void>}
   *
   * @description
   * Fetches all MCP servers from the API, filters to only include servers with at least one tool,
   * and auto-expands servers that have tools currently selected in selectedMCPTools.
   *
   * Workflow:
   * 1. Set loading state to true, clear any errors
   * 2. Call api.getMCPServers(directory) to fetch servers
   * 3. Filter to only servers where mcpTools.length > 0
   * 4. Calculate auto-expand set: servers with selectedMCPTools[serverId].length > 0
   * 5. Update mcpServers state with filtered servers
   * 6. Update expandedServers state with auto-expand set
   * 7. Set loading to false
   * 8. If error occurs, set error message and loading to false
   *
   * @throws {Error} API fetch error (caught and stored in error state)
   */
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

  /**
   * Toggles the expansion state of a server's tool list.
   *
   * @internal
   * @function toggleServer
   * @param {string} serverId - The ID of the server to expand/collapse
   * @returns {void}
   *
   * @description
   * Adds or removes server ID from expandedServers Set to show/hide the server's tool list.
   * If server is currently expanded, it will be collapsed. If collapsed, it will be expanded.
   *
   * Workflow:
   * 1. Create new Set from current expandedServers
   * 2. Check if serverId is in the Set
   * 3. If present: remove from Set (collapse)
   * 4. If not present: add to Set (expand)
   * 5. Update expandedServers state with new Set
   * 6. Component re-renders, tool list shown/hidden based on updated state
   */
  const toggleServer = (serverId: string) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };

  /**
   * Toggles selection state of an individual tool.
   *
   * @internal
   * @function toggleTool
   * @param {string} serverId - The ID of the MCP server the tool belongs to
   * @param {string} toolName - The name of the tool to toggle
   * @returns {void}
   *
   * @description
   * Adds or removes a tool from the selected tools for a specific server.
   * If all tools for a server are deselected, the server key is removed from selectedMCPTools object.
   *
   * Workflow:
   * 1. Get current tools array for server from selectedMCPTools[serverId] (default to [])
   * 2. Check if toolName is in current tools array
   * 3. If present: filter out toolName (deselect)
   * 4. If not present: append toolName (select)
   * 5. Create new selectedMCPTools object (immutable update)
   * 6. If newTools is empty array: delete server key from object
   * 7. If newTools has items: set selectedMCPTools[serverId] = newTools
   * 8. Call onChange with new object
   * 9. Parent updates state, component re-renders with new selection
   */
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

  /**
   * Toggles selection of all tools for a server (Select All / Deselect All).
   *
   * @internal
   * @function toggleAllToolsForServer
   * @param {string} serverId - The ID of the server whose tools should be toggled
   * @returns {void}
   *
   * @description
   * If all tools are currently selected, deselects all (removes server key).
   * If some or no tools are selected, selects all tools for the server.
   *
   * Workflow:
   * 1. Find server object in mcpServers by serverId
   * 2. Return early if server not found or has no tools
   * 3. Get current selected tools for server (default to [])
   * 4. Get all tool names from server.mcpTools
   * 5. Check if all tools are selected: currentTools.length === allToolNames.length
   * 6. If all selected: delete server key from selectedMCPTools (deselect all)
   * 7. If not all selected: set selectedMCPTools[serverId] = allToolNames (select all)
   * 8. Call onChange with updated object
   * 9. Parent updates state, component re-renders with new selection
   * 10. Checkbox shows updated state (checked/unchecked/indeterminate)
   */
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

  /**
   * Refreshes the tool list for a specific MCP server.
   *
   * @internal
   * @async
   * @function refreshServerTools
   * @param {string} serverId - The ID of the server to refresh
   * @returns {Promise<void>}
   *
   * @description
   * Calls the API to fetch the latest tool list from the MCP server and updates the local state.
   * Shows spinning animation during refresh. Errors are logged but don't block UI (silent failure).
   *
   * Workflow:
   * 1. Add serverId to refreshingServers Set (triggers spinning animation on refresh icon)
   * 2. Call api.listMCPServerTools(serverId, directory) to fetch latest tools
   * 3. If result.success is true:
   *    - Update mcpServers state, replacing tools for this server
   *    - Keep all other server data unchanged
   * 4. If error occurs: log to console (silent failure, user can retry)
   * 5. Remove serverId from refreshingServers Set (stop spinning animation)
   * 6. Component re-renders with updated tool list
   *
   * Note: Tool selections are preserved during refresh. Only tool list is updated.
   *
   * @throws {Error} API call error (caught, logged, and ignored - button re-enabled for retry)
   */
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

  /**
   * Calculates the total number of selected tools across all servers.
   *
   * @internal
   * @function getTotalSelectedTools
   * @returns {number} Total count of selected tools
   *
   * @description
   * Sums the lengths of all tool arrays in selectedMCPTools object.
   * Used for displaying selection summary at top of component.
   *
   * Example:
   * - selectedMCPTools = { "server-1": ["a", "b"], "server-2": ["x"] }
   * - Returns: 3 (2 + 1)
   */
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

MCPToolsSelector.displayName = 'MCPToolsSelector';

export default MCPToolsSelector;
