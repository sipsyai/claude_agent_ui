import React from 'react';
import type { AgentNode } from '../../types';
import type { Agent, Skill } from '../../../../types/agent.types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { CpuChipIcon, PuzzlePieceIcon, TrashIcon } from '../ui/Icons';

// Model override options
const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: 'Use Agent Default' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
];

export interface AgentNodeConfigProps {
  node: AgentNode;
  index: number;
  onChange: (updates: Partial<AgentNode>) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  availableAgents: Agent[];
  availableSkills: Skill[];
  className?: string;
}

/**
 * Configuration panel for Agent nodes in the flow editor.
 * Allows users to select an agent, configure prompt template, skills, and execution settings.
 */
const AgentNodeConfig: React.FC<AgentNodeConfigProps> = ({
  node,
  index,
  onChange,
  onRemove,
  canRemove = true,
  availableAgents,
  availableSkills,
  className = '',
}) => {
  // Get selected agent details
  const selectedAgent = availableAgents.find((a) => a.id === node.agentId);

  // Toggle skill selection
  const toggleSkill = (skillId: string, checked: boolean) => {
    const newSkills = checked
      ? [...node.skills, skillId]
      : node.skills.filter((s) => s !== skillId);
    onChange({ skills: newSkills });
  };

  return (
    <div className={`p-4 bg-secondary/30 rounded-lg space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <CpuChipIcon className="h-4 w-4 text-purple-600" />
          {node.name || `Agent ${index + 1}`}
        </h4>
        {canRemove && onRemove && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onRemove}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Node Name and Agent Selection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Node Name</label>
          <Input
            value={node.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Agent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Select Agent</label>
          <Select
            value={node.agentId}
            onChange={(e) => onChange({ agentId: e.target.value })}
          >
            <option value="">-- Select an Agent --</option>
            {availableAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Node Description */}
      <div>
        <label className="block text-xs font-medium mb-1">Description</label>
        <Input
          value={node.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What this agent step does"
        />
      </div>

      {/* Agent Info (if selected) */}
      {selectedAgent && (
        <div className="p-3 bg-purple-50 rounded-md text-sm">
          <p className="font-medium text-purple-900">{selectedAgent.name}</p>
          {selectedAgent.description && (
            <p className="text-purple-700 mt-1">{selectedAgent.description}</p>
          )}
        </div>
      )}

      {/* Prompt Template */}
      <div>
        <label className="block text-xs font-medium mb-1">
          Prompt Template
          <span className="text-muted-foreground font-normal ml-1">
            - Use &#123;&#123;input&#125;&#125; for input data, &#123;&#123;previousResult&#125;&#125; for chained agents
          </span>
        </label>
        <Textarea
          value={node.promptTemplate}
          onChange={(e) => onChange({ promptTemplate: e.target.value })}
          placeholder="Process the following input:&#10;&#10;{{input}}"
          className="min-h-[120px] font-mono text-sm"
        />
      </div>

      {/* Model Override */}
      <div>
        <label className="block text-xs font-medium mb-1">Model Override</label>
        <Select
          value={node.modelOverride}
          onChange={(e) => onChange({ modelOverride: e.target.value })}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Skills Selection */}
      <div>
        <label className="block text-xs font-medium mb-1">Skills to Use</label>
        {availableSkills.length === 0 ? (
          <div className="text-muted-foreground text-sm py-2">
            No skills available. Create skills in the Skills section.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableSkills.map((skill) => (
              <label
                key={skill.id}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                  node.skills.includes(skill.id)
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-secondary border border-border hover:bg-secondary/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={node.skills.includes(skill.id)}
                  onChange={(e) => toggleSkill(skill.id, e.target.checked)}
                  className="hidden"
                />
                <PuzzlePieceIcon className="h-3 w-3" />
                {skill.displayName || skill.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Execution Settings */}
      <div className="pt-3 border-t border-border/50">
        <h5 className="text-xs font-medium mb-3 text-muted-foreground uppercase tracking-wide">
          Execution Settings
        </h5>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Timeout (ms)
            </label>
            <Input
              type="number"
              value={node.timeout}
              onChange={(e) =>
                onChange({ timeout: parseInt(e.target.value) || 60000 })
              }
              min={1000}
              max={600000}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Max Retries
            </label>
            <Input
              type="number"
              value={node.maxRetries}
              onChange={(e) =>
                onChange({ maxRetries: parseInt(e.target.value) || 0 })
              }
              min={0}
              max={10}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={node.retryOnError}
                onChange={(e) => onChange({ retryOnError: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              Retry on Error
            </label>
          </div>
        </div>
      </div>

      {/* Max Tokens (optional) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">
            Max Tokens (optional)
          </label>
          <Input
            type="number"
            value={node.maxTokens || ''}
            onChange={(e) =>
              onChange({
                maxTokens: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
            placeholder="Leave empty for default"
            min={1}
            max={100000}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentNodeConfig;
