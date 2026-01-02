/**
 * AgentsPage - Agent Management Dashboard
 *
 * A comprehensive page component for managing agents in the Claude Manager UI. Provides agent listing,
 * creation, editing, execution, and configuration preview functionality.
 *
 * ## Features
 *
 * - **Agent Listing**: Grid-based display of all available agents with metadata and statistics
 * - **CRUD Operations**: Create (form or chat), Read (listing), Update (edit), Execute (run agent)
 * - **Agent Creation Modes**: Dual creation interface (form-based or chat-based with AI assistant)
 * - **Agent Execution**: Modal-based agent execution with real-time message streaming
 * - **Configuration Preview**: Visual display of agent skills, tools, MCP servers, and input fields
 * - **Directory Integration**: Automatic agent loading based on selected directory
 * - **Real-time Updates**: Automatic agent list refresh after create/edit operations
 *
 * ## Agent Listing
 *
 * Displays agents in a responsive grid layout (1 column mobile, 2 columns tablet, 3 columns desktop).
 * Each agent card shows:
 *
 * - **Header**: Agent name (with robot emoji), description (2-line clamp), model badge (if configured)
 * - **Statistics**: Counts for skills, Claude tools, MCP tools, and input fields
 * - **Skills Section**: First 3 skills with overflow indicator ("+N more")
 * - **Claude Tools Section**: First 4 allowed tools with overflow indicator
 * - **MCP Servers Section**: First 2 servers with their tools (first 3 per server)
 * - **File Info**: Agent file name (e.g., "my-agent.md")
 * - **Actions**: "Run Agent" button (primary) and "Edit" button (secondary)
 *
 * ## CRUD Operations
 *
 * ### Create
 * Two creation modes available via header buttons:
 *
 * 1. **Chat-based Creation** (Primary button with gradient):
 *    - Opens AgentCreatorChatPanel with AI assistant
 *    - Conversational workflow with SSE streaming
 *    - Auto-generates agent file on completion
 *
 * 2. **Form-based Creation** (Secondary button):
 *    - Opens AgentCreatorForm with comprehensive configuration fields
 *    - Manual configuration of all agent settings
 *    - Validates and saves agent file
 *
 * ### Read
 * - Automatic loading on mount via `loadAgents()`
 * - Reloads when `directory` or `initialAgents` props change
 * - Displays all agents from `.claude/agents/` directory
 * - Shows count in header ("Discovered N agents")
 *
 * ### Update (Edit)
 * - Click "Edit" button on any agent card
 * - Opens AgentCreatorForm with pre-populated fields
 * - Saves changes and reloads agent list
 *
 * ### Execute
 * - Click "Run Agent" button on any agent card
 * - Opens AgentExecutionModal with real-time message streaming
 * - Supports permission modes and tool execution tracking
 *
 * ## Directory Integration
 *
 * The component automatically loads agents based on the `directory` prop:
 *
 * 1. **Initial Load**: Fetches agents from API on mount
 * 2. **Directory Changes**: Reloads agents when directory prop changes
 * 3. **API Integration**: Uses `api.getAgents(directory)` for data fetching
 * 4. **Error Handling**: Logs errors to console, maintains current state on failure
 *
 * ## State Management
 *
 * The component manages five categories of state:
 *
 * 1. **Agent List State** (`agents`):
 *    - Initialized from `initialAgents` prop
 *    - Updated via `loadAgents()` API calls
 *    - Displayed in responsive grid layout
 *
 * 2. **Execution State** (`selectedAgent`):
 *    - Tracks agent selected for execution
 *    - Controls AgentExecutionModal visibility
 *    - Reset to null on modal close
 *
 * 3. **Creator Form State** (`showCreatorForm`, `editingAgent`):
 *    - Controls AgentCreatorForm modal visibility
 *    - Tracks agent being edited (null for create mode)
 *    - Reset on form close or successful submission
 *
 * 4. **Creator Chat State** (`showCreatorChat`):
 *    - Controls AgentCreatorChatPanel visibility
 *    - Slide-in panel for AI-assisted creation
 *    - Reset to false on panel close
 *
 * 5. **Loading State**: Implicit via API calls (no explicit loading spinner)
 *
 * ## Styling Behavior
 *
 * The component uses Tailwind CSS classes for styling:
 *
 * - **Container**: `animate-fade-in` for smooth page entrance
 * - **Header**: `flex items-center justify-between mb-6` with centered title
 * - **Title**: Responsive typography (`text-3xl sm:text-4xl font-bold`)
 * - **Grid Layout**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
 * - **Cards**: `hover:border-primary/80 transition-colors duration-300` for interactive feedback
 * - **Badges**: Color-coded by type (green=skills, blue=tools, indigo=MCP, purple=model)
 * - **Empty State**: Centered text with muted color and padding
 * - **Buttons**: Gradient for primary action (chat creation), secondary for form creation
 *
 * @example
 * // Basic usage in ManagerApp dashboard phase
 * <AgentsPage
 *   agents={agents}
 *   directory="/path/to/project"
 *   onAgentCreated={handleAgentsReload}
 * />
 *
 * @example
 * // Understanding agent creation workflow
 * // 1. User clicks "Create with Claude Manager" button
 * //    → setShowCreatorChat(true)
 * //    → AgentCreatorChatPanel opens with AI assistant
 * //    → User describes agent via chat
 * //    → AI generates agent file
 * //    → handleAgentCreated() called
 * //    → loadAgents() refreshes list
 * //    → onAgentCreated() callback invoked (if provided)
 * //
 * // 2. User clicks "Create New Agent" button
 * //    → setEditingAgent(null), setShowCreatorForm(true)
 * //    → AgentCreatorForm opens in create mode
 * //    → User fills form fields
 * //    → Form validates and saves
 * //    → handleAgentCreated() called
 * //    → loadAgents() refreshes list
 * //    → onAgentCreated() callback invoked (if provided)
 *
 * @example
 * // Understanding agent edit workflow
 * // 1. User clicks "Edit" button on agent card
 * //    → handleEditClick(agent) called
 * //    → setEditingAgent(agent), setShowCreatorForm(true)
 * //    → AgentCreatorForm opens with pre-populated fields
 * //    → User modifies fields
 * //    → Form validates and saves
 * //    → handleAgentCreated() called
 * //    → editingAgent reset to null
 * //    → loadAgents() refreshes list
 *
 * @example
 * // Understanding agent execution workflow
 * // 1. User clicks "Run Agent" button on agent card
 * //    → setSelectedAgent(agent)
 * //    → AgentExecutionModal opens
 * //    → User selects permission mode
 * //    → Agent executes with SSE streaming
 * //    → Real-time messages displayed
 * //    → User clicks close
 * //    → setSelectedAgent(null)
 */

import React, { useState, useEffect } from 'react';
import type { Agent } from '../../../types/agent.types';
import * as api from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import AgentExecutionModal from './AgentExecutionModal';
import AgentCreatorForm from './AgentCreatorForm';
import AgentCreatorChatPanel from './AgentCreatorChatPanel';
import { CpuChipIcon, PuzzlePieceIcon, ServerIcon, ClipboardListIcon, SparklesIcon } from './ui/Icons';

/**
 * Props for the AgentsPage component.
 *
 * @property {Agent[]} agents - Initial array of agents to display (will be overridden by API fetch)
 * @property {string} [directory] - Optional directory path for filtering agents (e.g., "/path/to/project")
 * @property {() => void} [onAgentCreated] - Optional callback invoked after successful agent creation or edit
 */
interface AgentsPageProps {
  agents: Agent[];
  directory?: string;
  onAgentCreated?: () => void;
}

const AgentsPage: React.FC<AgentsPageProps> = ({ agents: initialAgents, directory, onAgentCreated }) => {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreatorForm, setShowCreatorForm] = useState(false);
  const [showCreatorChat, setShowCreatorChat] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  /**
   * Loads agents from the API based on the current directory.
   *
   * Fetches agents from the backend API and updates the local state. If the API call fails,
   * the error is logged to console and the current agent list is maintained.
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   */
  const loadAgents = async () => {
    try {
      const fetchedAgents = await api.getAgents(directory);
      setAgents(fetchedAgents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  /**
   * Effect hook that loads agents when the component mounts or when dependencies change.
   *
   * Triggers agent reload in the following scenarios:
   * - Component mounts (initial load)
   * - `directory` prop changes (user selects different directory)
   * - `initialAgents` prop changes (parent component updates agents)
   *
   * @internal
   */
  useEffect(() => {
    loadAgents();
  }, [initialAgents, directory]);

  /**
   * Handles successful agent creation or edit.
   *
   * This callback is invoked by AgentCreatorForm and AgentCreatorChatPanel after a successful
   * agent creation or edit operation. It performs the following actions:
   * 1. Closes the creator form modal
   * 2. Resets the editing agent state to null
   * 3. Reloads the agents list from the API
   * 4. Invokes the parent's onAgentCreated callback (if provided)
   *
   * @internal
   * @returns {void}
   */
  const handleAgentCreated = () => {
    setShowCreatorForm(false);
    setEditingAgent(null);
    loadAgents(); // Reload agents list
    if (onAgentCreated) {
      onAgentCreated();
    }
  };

  /**
   * Handles click on the "Edit" button for an agent card.
   *
   * Sets the agent to be edited and opens the AgentCreatorForm in edit mode.
   * The form will be pre-populated with the agent's current configuration.
   *
   * @internal
   * @param {Agent} agent - The agent to edit
   * @returns {void}
   */
  const handleEditClick = (agent: Agent) => {
    setEditingAgent(agent);
    setShowCreatorForm(true);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Agents</h1>
          <p className="text-muted-foreground">
            Discovered {agents.length} agents in .claude/agents/
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreatorChat(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <SparklesIcon className="h-4 w-4" />
            Create with Claude Manager
          </Button>
          <Button
            onClick={() => {
              setEditingAgent(null);
              setShowCreatorForm(true);
            }}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Create New Agent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No agents found in .claude/agents/
          </div>
        ) : (
          agents.map((agent) => {
            // Calculate counts from Strapi component-based structure
            const toolsCount = agent.toolConfig?.allowedTools?.length || 0;
            const mcpServersCount = agent.mcpConfig?.length || 0;
            const mcpToolsCount = agent.mcpConfig?.reduce((sum, config) =>
              sum + (config.selectedTools?.length || 0), 0) || 0;
            const skillsCount = agent.skillSelection?.length || 0;
            const inputFieldsCount = 0; // inputFields not yet in Strapi schema

            return (
              <Card key={agent.id} className="flex flex-col hover:border-primary/80 transition-colors duration-300 group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 flex-1">
                      <span className="text-primary">🤖</span>
                      <span className="truncate">{agent.name}</span>
                    </CardTitle>
                    {agent.modelConfig?.model && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium flex-shrink-0">
                        {agent.modelConfig.model}
                      </span>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-grow space-y-3">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-2 pb-3 border-b border-border">
                    {/* Skills Count */}
                    {skillsCount > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <PuzzlePieceIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-muted-foreground">{skillsCount} Skill{skillsCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* Tools Count */}
                    {toolsCount > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <CpuChipIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-muted-foreground">{toolsCount} Tool{toolsCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* MCP Tools Count */}
                    {mcpToolsCount > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <ServerIcon className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                        <span className="text-muted-foreground">{mcpToolsCount} MCP Tool{mcpToolsCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* Input Fields Count */}
                    {inputFieldsCount > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <ClipboardListIcon className="h-4 w-4 text-orange-600 flex-shrink-0" />
                        <span className="text-muted-foreground">{inputFieldsCount} Input{inputFieldsCount > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills Section */}
                  {agent.skillSelection && agent.skillSelection.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <PuzzlePieceIcon className="h-3.5 w-3.5 text-green-600" />
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">Skills</h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {agent.skillSelection.slice(0, 3).map((selection, idx) => {
                          const skillName = typeof selection.skill === 'string' ? selection.skill : selection.skill.name;
                          return (
                            <span key={idx} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">
                              {skillName}
                            </span>
                          );
                        })}
                        {agent.skillSelection.length > 3 && (
                          <span className="text-xs text-green-600 px-2 py-0.5 font-medium">
                            +{agent.skillSelection.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Claude Tools */}
                  {agent.toolConfig?.allowedTools && Array.isArray(agent.toolConfig.allowedTools) && agent.toolConfig.allowedTools.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CpuChipIcon className="h-3.5 w-3.5 text-blue-600" />
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">Claude Tools</h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {agent.toolConfig.allowedTools.slice(0, 4).map((tool, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                            {tool}
                          </span>
                        ))}
                        {agent.toolConfig.allowedTools.length > 4 && (
                          <span className="text-xs text-blue-600 px-2 py-0.5">
                            +{agent.toolConfig.allowedTools.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MCP Tools */}
                  {agent.mcpConfig && agent.mcpConfig.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ServerIcon className="h-3.5 w-3.5 text-indigo-600" />
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">MCP Servers</h4>
                      </div>
                      <div className="space-y-1.5">
                        {agent.mcpConfig.slice(0, 2).map((config, idx) => {
                          if (!config.mcpServer) return null;
                          const serverName = typeof config.mcpServer === 'string' ? config.mcpServer : config.mcpServer.name;
                          const toolsCount = config.selectedTools?.length || 0;
                          return (
                            <div key={idx}>
                              <div className="text-xs font-medium text-indigo-600 mb-0.5">{serverName}</div>
                              {toolsCount > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {config.selectedTools!.slice(0, 3).map((toolSel, tidx) => {
                                    if (!toolSel.mcpTool) return null;
                                    const toolName = typeof toolSel.mcpTool === 'string' ? toolSel.mcpTool : toolSel.mcpTool.name;
                                    return (
                                      <span key={tidx} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                                        {toolName}
                                      </span>
                                    );
                                  })}
                                  {toolsCount > 3 && (
                                    <span className="text-xs text-indigo-600 px-2 py-0.5">
                                      +{toolsCount - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {agent.mcpConfig.length > 2 && (
                          <div className="text-xs text-indigo-600 font-medium">
                            +{agent.mcpConfig.length - 2} more server(s)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Info */}
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    📄 {agent.id}.md
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2 pt-3">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    Run Agent
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEditClick(agent)}
                  >
                    Edit
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {/* Agent Execution Modal */}
      {selectedAgent && (
        <AgentExecutionModal
          agent={selectedAgent}
          isOpen={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          directory={directory}
        />
      )}

      {/* Agent Creator/Editor Form */}
      <AgentCreatorForm
        isOpen={showCreatorForm}
        onClose={() => {
          setShowCreatorForm(false);
          setEditingAgent(null);
        }}
        onSuccess={handleAgentCreated}
        directory={directory}
        editAgent={editingAgent || undefined}
      />

      {/* Agent Creator Chat Panel */}
      <AgentCreatorChatPanel
        isOpen={showCreatorChat}
        onClose={() => setShowCreatorChat(false)}
        onAgentCreated={handleAgentCreated}
        directory={directory}
      />
    </div>
  );
};

AgentsPage.displayName = 'AgentsPage';

export default AgentsPage;
