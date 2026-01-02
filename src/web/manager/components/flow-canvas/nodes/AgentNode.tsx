/**
 * Agent Node Component for React Flow
 *
 * A custom React Flow node component that displays agent configuration
 * including assigned skills and prompt template preview. Shows a visual
 * representation of the agent with all its settings and capabilities.
 *
 * ## Features
 * - Displays selected agent name and details
 * - Shows assigned skills as compact badges
 * - Truncated prompt template preview
 * - Model override indicator when different from default
 * - Purple color theme for agent nodes
 * - Click to open configuration panel (handled by parent)
 * - Visual indicators for execution settings
 *
 * ## Component Structure
 * ```
 * AgentNode
 *   └── BaseNode (with purple theme)
 *       ├── Agent Info (name, description)
 *       ├── Model Override Indicator
 *       ├── Prompt Template Preview
 *       ├── Skills Badges
 *       └── Execution Settings Summary
 * ```
 *
 * ## Skills Display
 * - Shows skills as compact pill badges
 * - Displays skill name or displayName
 * - Visual count indicator if many skills assigned
 * - Scrollable if list exceeds max height
 *
 * ## Validation Status
 * - **Valid**: Green check if agent selected and prompt configured
 * - **Warning**: Yellow warning if no agent selected or prompt missing
 * - Shows configuration completeness
 *
 * @example
 * // Basic usage in React Flow
 * const nodeTypes = {
 *   agent: AgentNode,
 *   // ... other node types
 * };
 *
 * <ReactFlow nodeTypes={nodeTypes} nodes={nodes} edges={edges} />
 *
 * @example
 * // With configured agent
 * const agentNodeData: AgentNodeData = {
 *   nodeId: 'agent-1',
 *   type: 'agent',
 *   name: 'Data Processor',
 *   agentId: 'agent-123',
 *   promptTemplate: 'Process the input: {{input}}',
 *   skills: ['skill-1', 'skill-2'],
 *   modelOverride: 'claude-sonnet-4-20250514',
 *   timeout: 60000,
 *   retryOnError: true,
 *   maxRetries: 3,
 * };
 */

import React from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ReactFlowAgentNode, AgentNodeData } from '../../../types/react-flow.types';
import { BaseNode } from './BaseNode';
import {
  CpuChipIcon,
  PuzzlePieceIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  ClockIcon,
  RefreshIcon,
} from '../../ui/Icons';

/**
 * Props for the AgentNode component
 * Extends React Flow's NodeProps with AgentNodeData
 */
export type AgentNodeProps = NodeProps<ReactFlowAgentNode>;

/**
 * Props for individual skill badge display
 */
interface SkillBadgeProps {
  skillId: string;
  skillName?: string;
}

/**
 * Individual skill badge component
 * Displays a single skill as a compact pill badge
 */
const SkillBadge: React.FC<SkillBadgeProps> = ({ skillId, skillName }) => {
  const displayName = skillName || skillId;

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300"
      title={`Skill: ${displayName}`}
    >
      <PuzzlePieceIcon width={12} height={12} />
      <span className="text-[10px] font-medium truncate max-w-[80px]">
        {displayName}
      </span>
    </div>
  );
};

/**
 * Model override badge component
 * Shows when a model different from default is selected
 */
interface ModelOverrideBadgeProps {
  modelOverride: string;
}

const ModelOverrideBadge: React.FC<ModelOverrideBadgeProps> = ({ modelOverride }) => {
  // Extract a short model name for display
  const getModelDisplayName = (model: string): string => {
    if (model === 'default') return 'Default';
    if (model.includes('sonnet-4')) return 'Sonnet 4';
    if (model.includes('opus-4')) return 'Opus 4';
    if (model.includes('3-5-sonnet')) return '3.5 Sonnet';
    if (model.includes('3-5-haiku')) return '3.5 Haiku';
    return model.split('-')[0]; // Fallback to first part
  };

  if (modelOverride === 'default') {
    return null;
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30"
      title={`Model Override: ${modelOverride}`}
    >
      <SparklesIcon width={14} height={14} className="text-blue-400" />
      <span className="text-[10px] font-medium text-blue-300">
        {getModelDisplayName(modelOverride)}
      </span>
    </div>
  );
};

/**
 * Execution settings summary component
 * Shows timeout and retry configuration
 */
interface ExecutionSettingsProps {
  timeout: number;
  retryOnError: boolean;
  maxRetries: number;
}

const ExecutionSettings: React.FC<ExecutionSettingsProps> = ({
  timeout,
  retryOnError,
  maxRetries,
}) => {
  const timeoutSeconds = Math.round(timeout / 1000);

  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1" title={`Timeout: ${timeoutSeconds}s`}>
        <ClockIcon width={12} height={12} />
        <span>{timeoutSeconds}s</span>
      </div>
      {retryOnError && (
        <div className="flex items-center gap-1" title={`Max Retries: ${maxRetries}`}>
          <RefreshIcon width={12} height={12} />
          <span>×{maxRetries}</span>
        </div>
      )}
    </div>
  );
};

/**
 * AgentNode Component
 *
 * Renders an agent node in the React Flow canvas, displaying the agent
 * configuration including skills, prompt, and execution settings.
 */
export const AgentNode: React.FC<AgentNodeProps> = ({ data, selected, id }) => {
  const hasAgent = !!data.agentId;
  const hasPrompt = !!data.promptTemplate && data.promptTemplate.trim().length > 0;
  const skillCount = data.skills?.length || 0;

  // Determine validation status
  const isValid = hasAgent && hasPrompt;
  const validationIcon = isValid ? (
    <CheckCircleIcon width={16} height={16} className="text-green-500" />
  ) : (
    <ExclamationCircleIcon width={16} height={16} className="text-yellow-500" />
  );

  // Generate node title
  const nodeTitle = data.name || 'Agent';

  // Agent icon for the header
  const agentIcon = <CpuChipIcon width={20} height={20} />;

  // Truncate prompt template for preview
  const truncatePrompt = (prompt: string, maxLength: number = 120): string => {
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + '...';
  };

  return (
    <BaseNode
      icon={agentIcon}
      title={nodeTitle}
      selected={selected}
      nodeType="agent"
      status={data.metadata?.status as any}
      showDeleteButton={true}
      className="cursor-pointer"
    >
      <div className="space-y-3">
        {/* Agent Name and Validation Status */}
        <div className="flex items-center justify-between text-xs pb-2 border-b border-border/30">
          <div className="flex-1 min-w-0">
            {data.agent?.name ? (
              <div>
                <div className="font-medium text-purple-400 truncate">
                  {data.agent.name}
                </div>
                {data.agent.description && (
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {data.agent.description}
                  </div>
                )}
              </div>
            ) : data.agentId ? (
              <div className="text-muted-foreground truncate">
                Agent ID: {data.agentId}
              </div>
            ) : (
              <div className="text-muted-foreground italic">
                No agent selected
              </div>
            )}
          </div>
          <div title={isValid ? 'Valid configuration' : 'Configuration incomplete'}>
            {validationIcon}
          </div>
        </div>

        {/* Model Override Indicator */}
        {data.modelOverride && data.modelOverride !== 'default' && (
          <ModelOverrideBadge modelOverride={data.modelOverride} />
        )}

        {/* Prompt Template Preview */}
        {hasPrompt ? (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Prompt Template
            </div>
            <div className="px-2 py-1.5 rounded bg-secondary/30 border border-border/30">
              <p className="text-[11px] font-mono text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {truncatePrompt(data.promptTemplate)}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 px-2">
            <ExclamationCircleIcon
              width={20}
              height={20}
              className="mx-auto text-muted-foreground mb-1"
            />
            <p className="text-[10px] text-muted-foreground">
              No prompt template configured
            </p>
          </div>
        )}

        {/* Skills Section */}
        {skillCount > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Skills
              </div>
              <div className="text-[10px] text-muted-foreground">
                {skillCount} {skillCount === 1 ? 'skill' : 'skills'}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {data.skills.map((skillId) => (
                <SkillBadge key={skillId} skillId={skillId} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-2 px-2 bg-secondary/20 rounded border border-border/30">
            <p className="text-[10px] text-muted-foreground">
              No skills assigned
            </p>
          </div>
        )}

        {/* Execution Settings Summary */}
        <div className="pt-2 border-t border-border/30">
          <ExecutionSettings
            timeout={data.timeout}
            retryOnError={data.retryOnError}
            maxRetries={data.maxRetries}
          />
        </div>

        {/* Max Tokens Indicator */}
        {data.maxTokens && (
          <div className="text-[10px] text-muted-foreground">
            Max tokens: {data.maxTokens.toLocaleString()}
          </div>
        )}

        {/* Description (if provided) */}
        {data.description && (
          <div className="pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground italic line-clamp-2">
              {data.description}
            </p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

/**
 * Display name for React DevTools
 */
AgentNode.displayName = 'AgentNode';

export default AgentNode;
