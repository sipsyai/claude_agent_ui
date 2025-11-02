import React, { useState, useEffect } from 'react';
import type { Agent } from '../../../types/agent.types';
import * as api from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import AgentExecutionModal from './AgentExecutionModal';
import AgentCreatorForm from './AgentCreatorForm';
import AgentCreatorChatPanel from './AgentCreatorChatPanel';
import { CpuChipIcon, PuzzlePieceIcon, ServerIcon, ClipboardListIcon, SparklesIcon } from './ui/Icons';

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

  // Load agents from Strapi
  const loadAgents = async () => {
    try {
      const fetchedAgents = await api.getAgents(directory);
      setAgents(fetchedAgents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  // Load agents when component mounts or initialAgents/directory changes
  useEffect(() => {
    loadAgents();
  }, [initialAgents, directory]);

  const handleAgentCreated = () => {
    setShowCreatorForm(false);
    setEditingAgent(null);
    loadAgents(); // Reload agents list
    if (onAgentCreated) {
      onAgentCreated();
    }
  };

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
                          const serverName = typeof config.mcpServer === 'string' ? config.mcpServer : config.mcpServer.name;
                          const toolsCount = config.selectedTools?.length || 0;
                          return (
                            <div key={idx}>
                              <div className="text-xs font-medium text-indigo-600 mb-0.5">{serverName}</div>
                              {toolsCount > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {config.selectedTools!.slice(0, 3).map((toolSel, tidx) => {
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

export default AgentsPage;
