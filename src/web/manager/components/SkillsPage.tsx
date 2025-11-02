import React, { useState, useEffect } from 'react';
import type { Skill } from '../../../types/agent.types';
import * as api from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ProgressBar } from './ui/ProgressBar';
import SkillCreationModal from './SkillCreationModal';
import SkillDetailsModal from './SkillDetailsModal';
import SkillCreatorChatPanel from './SkillCreatorChatPanel';
import SkillTrainingChatPanel from './SkillTrainingChatPanel';
import { CheckCircleIcon, SearchIcon, TrashIcon, XCircleIcon, ServerIcon, SparklesIcon } from './ui/Icons';

interface SkillsPageProps {
  skills: Skill[];
  onRefresh?: () => void;
  directory?: string;
}

type FilterMode = 'all' | 'used' | 'unused' | 'high-usage';

const SkillsPage: React.FC<SkillsPageProps> = ({ skills: initialSkills, onRefresh, directory }) => {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [showCreatorChat, setShowCreatorChat] = useState(false);
  const [trainingSkill, setTrainingSkill] = useState<Skill | null>(null);
  const [showTrainingPanel, setShowTrainingPanel] = useState(false);

  // Load skills with usage info
  const loadSkillsWithUsage = async () => {
    try {
      const skillsWithUsage = await api.getSkills(directory, true);
      setSkills(skillsWithUsage);
    } catch (error) {
      console.error('Failed to load skills with usage:', error);
    }
  };

  // Initial load and when initialSkills change
  useEffect(() => {
    loadSkillsWithUsage();
  }, [initialSkills, directory]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      loadSkillsWithUsage();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, directory]);

  const handleSkillCreated = () => {
    loadSkillsWithUsage();
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleViewDetails = (skill: Skill) => {
    setSelectedSkill(skill);
  };

  const handleEditClick = (skill: Skill) => {
    setEditingSkill(skill);
    setIsCreationModalOpen(true);
  };

  const handleSkillClick = (skill: Skill) => {
    setTrainingSkill(skill);
    setShowTrainingPanel(true);
  };

  const handleTrainingComplete = () => {
    // Refresh skills to show updated experience scores
    loadSkillsWithUsage();
    if (onRefresh) {
      onRefresh();
    }
  };

  const toggleSkillSelection = (skillId: string) => {
    const newSet = new Set(selectedSkillIds);
    if (newSet.has(skillId)) {
      newSet.delete(skillId);
    } else {
      newSet.add(skillId);
    }
    setSelectedSkillIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedSkillIds.size === filteredSkills.length) {
      setSelectedSkillIds(new Set());
    } else {
      setSelectedSkillIds(new Set(filteredSkills.map(s => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSkillIds.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedSkillIds.size} skill(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      // Delete skills one by one (could be optimized with a bulk endpoint)
      const deletePromises = Array.from(selectedSkillIds).map(async (skillId) => {
        try {
          const response = await fetch(`/api/manager/skills/${skillId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directory }),
          });
          if (!response.ok) {
            throw new Error(`Failed to delete ${skillId}`);
          }
        } catch (error) {
          console.error(`Error deleting skill ${skillId}:`, error);
          throw error;
        }
      });

      await Promise.all(deletePromises);
      setSelectedSkillIds(new Set());
      loadSkillsWithUsage();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      alert(`Some skills could not be deleted. Check console for details.`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and search logic
  const filteredSkills = skills.filter((skill) => {
    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        skill.name.toLowerCase().includes(term) ||
        skill.description.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Usage filter
    const usageCount = skill.analytics?.executionCount || 0;
    switch (filterMode) {
      case 'used':
        return usageCount > 0;
      case 'unused':
        return usageCount === 0;
      case 'high-usage':
        return usageCount >= 3;
      case 'all':
      default:
        return true;
    }
  });

  const allSelected = filteredSkills.length > 0 && selectedSkillIds.size === filteredSkills.length;
  const someSelected = selectedSkillIds.size > 0 && !allSelected;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Skills</h1>
          <p className="text-muted-foreground">
            Discovered {skills.length} skills in .claude/skills/
          </p>
        </div>
        <div className="absolute right-8 top-8 flex gap-2">
          <Button
            onClick={() => setIsCreationModalOpen(true)}
            variant="secondary"
          >
            Create New Skill
          </Button>
          <Button
            onClick={() => setShowCreatorChat(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <SparklesIcon className="h-4 w-4" />
            Create with Claude Manager
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
            placeholder="Search skills by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Filter:</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className="text-sm border border-border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Skills ({skills.length})</option>
              <option value="used">Used in Agents ({skills.filter(s => (s.analytics?.executionCount || 0) > 0).length})</option>
              <option value="unused">Not Used ({skills.filter(s => (s.analytics?.executionCount || 0) === 0).length})</option>
              <option value="high-usage">High Usage (3+) ({skills.filter(s => (s.analytics?.executionCount || 0) >= 3).length})</option>
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
            Showing {filteredSkills.length} of {skills.length} skills
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedSkillIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedSkillIds.size} skill(s) selected
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelectedSkillIds(new Set())}
              >
                Clear Selection
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete Selected'}
            </Button>
          </div>
        )}

        {/* Select All */}
        {filteredSkills.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someSelected;
                  }
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded"
              />
              <span className="text-muted-foreground">
                {allSelected ? 'Deselect All' : someSelected ? 'Select All' : 'Select All'}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Modals */}
      <SkillCreationModal
        isOpen={isCreationModalOpen}
        onClose={() => {
          setIsCreationModalOpen(false);
          setEditingSkill(null);
        }}
        onSkillCreated={handleSkillCreated}
        editSkill={editingSkill || undefined}
      />

      <SkillDetailsModal
        skill={selectedSkill}
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onEdit={(skill) => {
          setSelectedSkill(null);
          handleEditClick(skill);
        }}
      />

      <SkillCreatorChatPanel
        isOpen={showCreatorChat}
        onClose={() => setShowCreatorChat(false)}
        onSkillCreated={handleSkillCreated}
        directory={directory}
      />

      <SkillTrainingChatPanel
        isOpen={showTrainingPanel}
        onClose={() => {
          setShowTrainingPanel(false);
          setTrainingSkill(null);
        }}
        skill={trainingSkill}
        directory={directory}
        onTrainingComplete={handleTrainingComplete}
      />

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSkills.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12">
            {searchTerm || filterMode !== 'all'
              ? 'No skills match your search or filter criteria'
              : 'No skills found in .claude/skills/'}
          </div>
        ) : (
          filteredSkills.map((skill) => {
            const isSelected = selectedSkillIds.has(skill.id);
            const usageCount = skill.analytics?.executionCount || 0;

            return (
              <Card
                key={skill.id}
                className="flex flex-col hover:border-primary/80 transition-colors duration-300 group cursor-pointer"
                onClick={() => handleSkillClick(skill)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 flex-1">
                      <span className="text-primary">🧩</span>
                      <span className="truncate">{skill.name}</span>
                    </CardTitle>
                    {usageCount > 0 && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium flex-shrink-0">
                        {usageCount} use{usageCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">{skill.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-grow space-y-3">
                  {/* Experience Progress */}
                  <div className="pb-3 border-b border-border">
                    <ProgressBar
                      value={skill.experienceScore || 0}
                      showLabel={true}
                      size="sm"
                    />
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-2 pb-3 border-b border-border">
                    {/* Usage Status */}
                    {usageCount > 0 ? (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-muted-foreground">{usageCount} Agent{usageCount !== 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <XCircleIcon className="h-4 w-4 text-gray-600 flex-shrink-0" />
                        <span className="text-muted-foreground">Unused</span>
                      </div>
                    )}

                    {/* Tools Count */}
                    {skill.toolConfig?.allowedTools && skill.toolConfig.allowedTools.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-4 w-4 text-blue-600 flex-shrink-0">🔧</span>
                        <span className="text-muted-foreground">{skill.toolConfig.allowedTools.length} Tool{skill.toolConfig.allowedTools.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Used in Agents */}
                  {skill.agentSelection && skill.agentSelection.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">Used In Agents</h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {skill.agentSelection.slice(0, 3).map((selection, idx) => {
                          const agentName = typeof selection.agent === 'string' ? selection.agent : selection.agent.name;
                          return (
                            <span key={idx} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">
                              {agentName}
                            </span>
                          );
                        })}
                        {skill.agentSelection.length > 3 && (
                          <span className="text-xs text-green-600 px-2 py-0.5 font-medium">
                            +{skill.agentSelection.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Allowed Tools */}
                  {skill.toolConfig?.allowedTools && skill.toolConfig.allowedTools.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="h-3.5 w-3.5 text-blue-600">🔧</span>
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">Allowed Tools</h4>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {skill.toolConfig.allowedTools.slice(0, 4).map((tool, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                            {tool}
                          </span>
                        ))}
                        {skill.toolConfig.allowedTools.length > 4 && (
                          <span className="text-xs text-blue-600 px-2 py-0.5">
                            +{skill.toolConfig.allowedTools.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MCP Tools */}
                  {skill.mcpConfig && skill.mcpConfig.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ServerIcon className="h-3.5 w-3.5 text-indigo-600" />
                        <h4 className="font-semibold text-xs text-muted-foreground uppercase">MCP Servers</h4>
                      </div>
                      <div className="space-y-1.5">
                        {skill.mcpConfig.slice(0, 2).map((config, idx) => {
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
                        {skill.mcpConfig.length > 2 && (
                          <div className="text-xs text-indigo-600 font-medium">
                            +{skill.mcpConfig.length - 2} more server(s)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Info */}
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    📄 {skill.id}.md
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2 pt-3">
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(skill);
                    }}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(skill);
                    }}
                  >
                    Edit
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SkillsPage;
