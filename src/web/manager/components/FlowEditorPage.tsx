import React, { useState, useEffect, useCallback } from 'react';
import type {
  Flow,
  FlowNode,
  FlowStatus,
  FlowCategory,
  FlowNodeType,
  InputNode,
  AgentNode,
  OutputNode,
  FlowSchedule,
} from '../types';
import * as flowApi from '../services/flow-api';
import * as api from '../services/api';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  SpinnerIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlayIcon,
  CpuChipIcon,
  ClockIcon,
  GlobeIcon,
} from './ui/Icons';
import InputNodeConfig from './flow/InputNodeConfig';
import AgentNodeConfig from './flow/AgentNodeConfig';
import OutputNodeConfig from './flow/OutputNodeConfig';
import FlowScheduleConfig, { createDefaultSchedule } from './flow/FlowScheduleConfig';

// Props interface
interface FlowEditorPageProps {
  flowId?: string; // If provided, editing; if not, creating
  onClose: () => void;
  onSave?: (flow: Flow) => void;
}

// Node type options
const NODE_TYPES: { value: FlowNodeType; label: string; icon: React.FC<any>; description: string }[] = [
  { value: 'input', label: 'Input', icon: PlayIcon, description: 'Define input fields for the flow' },
  { value: 'agent', label: 'Agent', icon: CpuChipIcon, description: 'Execute an AI agent with skills' },
  { value: 'output', label: 'Output', icon: CheckCircleIcon, description: 'Format and deliver results' },
];

// Category options
const CATEGORY_OPTIONS: { value: FlowCategory; label: string; emoji: string }[] = [
  { value: 'web-scraping', label: 'Web Scraping', emoji: '🌐' },
  { value: 'data-processing', label: 'Data Processing', emoji: '📊' },
  { value: 'api-integration', label: 'API Integration', emoji: '🔌' },
  { value: 'file-manipulation', label: 'File Manipulation', emoji: '📁' },
  { value: 'automation', label: 'Automation', emoji: '🤖' },
  { value: 'custom', label: 'Custom', emoji: '⚙️' },
];

// Status options
const STATUS_OPTIONS: { value: FlowStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];


// Generate unique ID
const generateId = () => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Default node creators
const createDefaultInputNode = (): InputNode => ({
  nodeId: generateId(),
  type: 'input',
  name: 'Input',
  description: 'Flow input configuration',
  position: { x: 0, y: 0 },
  inputFields: [],
  validationRules: {},
});

const createDefaultAgentNode = (): AgentNode => ({
  nodeId: generateId(),
  type: 'agent',
  name: 'Agent',
  description: 'Execute AI agent',
  position: { x: 0, y: 100 },
  agentId: '',
  promptTemplate: 'Process the following input:\n\n{{input}}',
  skills: [],
  modelOverride: 'default',
  timeout: 60000,
  retryOnError: true,
  maxRetries: 3,
});

const createDefaultOutputNode = (): OutputNode => ({
  nodeId: generateId(),
  type: 'output',
  name: 'Output',
  description: 'Flow output configuration',
  position: { x: 0, y: 200 },
  outputType: 'response',
  format: 'markdown',
  saveToFile: false,
  includeMetadata: false,
  includeTimestamp: true,
});

// Generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
};

const FlowEditorPage: React.FC<FlowEditorPageProps> = ({ flowId, onClose, onSave }) => {
  // Flow state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FlowCategory>('custom');
  const [status, setStatus] = useState<FlowStatus>('draft');
  const [isActive, setIsActive] = useState(false);
  const [version, setVersion] = useState('1.0.0');

  // Nodes state (linear: input -> agent -> output)
  const [inputNode, setInputNode] = useState<InputNode>(createDefaultInputNode());
  const [agentNodes, setAgentNodes] = useState<AgentNode[]>([createDefaultAgentNode()]);
  const [outputNode, setOutputNode] = useState<OutputNode>(createDefaultOutputNode());

  // Schedule and Webhook state
  const [schedule, setSchedule] = useState<FlowSchedule | undefined>(undefined);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['metadata', 'input', 'agents', 'output', 'triggers'])
  );

  // Available agents and skills for selection
  const [availableAgents, setAvailableAgents] = useState<api.Agent[]>([]);
  const [availableSkills, setAvailableSkills] = useState<api.Skill[]>([]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!flowId) {
      setSlug(generateSlug(name));
    }
  }, [name, flowId]);

  // Load existing flow if editing
  useEffect(() => {
    if (flowId) {
      loadFlow();
    }
  }, [flowId]);

  // Load available agents and skills
  useEffect(() => {
    loadAgentsAndSkills();
  }, []);

  const loadFlow = async () => {
    if (!flowId) return;

    setLoading(true);
    setError(null);

    try {
      const flow = await flowApi.getFlow(flowId);

      setName(flow.name);
      setSlug(flow.slug);
      setDescription(flow.description || '');
      setCategory(flow.category);
      setStatus(flow.status);
      setIsActive(flow.isActive);
      setVersion(flow.version);

      // Parse nodes
      if (flow.nodes && flow.nodes.length > 0) {
        const inputNodes = flow.nodes.filter((n): n is InputNode => n.type === 'input');
        const agentNodesFiltered = flow.nodes.filter((n): n is AgentNode => n.type === 'agent');
        const outputNodes = flow.nodes.filter((n): n is OutputNode => n.type === 'output');

        if (inputNodes.length > 0) setInputNode(inputNodes[0]);
        if (agentNodesFiltered.length > 0) setAgentNodes(agentNodesFiltered);
        if (outputNodes.length > 0) setOutputNode(outputNodes[0]);
      }

      // Load schedule and webhook settings
      if (flow.schedule) {
        setSchedule(flow.schedule);
      }
      setWebhookEnabled(flow.webhookEnabled || false);
      setWebhookSecret(flow.webhookSecret || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flow');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentsAndSkills = async () => {
    try {
      const [agents, skills] = await Promise.all([
        api.getAgents(),
        api.getSkills(),
      ]);
      setAvailableAgents(agents);
      setAvailableSkills(skills);
    } catch (err) {
      // Silently fail - not critical for editing
    }
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Build flow nodes array
  const buildNodes = (): FlowNode[] => {
    const nodes: FlowNode[] = [];

    // Input node first
    const inputWithNext = {
      ...inputNode,
      nextNodeId: agentNodes.length > 0 ? agentNodes[0].nodeId : outputNode.nodeId,
    };
    nodes.push(inputWithNext);

    // Agent nodes in sequence
    agentNodes.forEach((agent, index) => {
      const nextId = index < agentNodes.length - 1
        ? agentNodes[index + 1].nodeId
        : outputNode.nodeId;
      nodes.push({ ...agent, nextNodeId: nextId });
    });

    // Output node last
    nodes.push({ ...outputNode, nextNodeId: null });

    return nodes;
  };

  // Save flow
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Flow name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const nodes = buildNodes();

      // Build input schema from input node fields
      const inputSchema = {
        properties: inputNode.inputFields.reduce((acc, field) => {
          acc[field.name] = {
            type: field.type === 'number' ? 'number' : 'string',
            description: field.description,
          };
          return acc;
        }, {} as Record<string, { type: string; description?: string }>),
        required: inputNode.inputFields.filter(f => f.required).map(f => f.name),
      };

      // Build output schema (simple for now)
      const outputSchema = {
        properties: {
          result: { type: 'string', description: 'Flow execution result' },
        },
      };

      const flowData = {
        name: name.trim(),
        slug: slug.trim() || generateSlug(name),
        description: description.trim(),
        category,
        status,
        isActive,
        version,
        nodes,
        inputSchema,
        outputSchema,
        schedule,
        webhookEnabled,
        webhookSecret: webhookSecret || undefined,
      };

      let savedFlow: Flow;

      if (flowId) {
        // Update existing flow
        const response = await flowApi.updateFlow(flowId, flowData);
        savedFlow = response.flow;
      } else {
        // Create new flow
        const response = await flowApi.createFlow(flowData as any);
        savedFlow = response.flow;
      }

      onSave?.(savedFlow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  // Add new agent node
  const addAgentNode = () => {
    const newAgent = createDefaultAgentNode();
    newAgent.name = `Agent ${agentNodes.length + 1}`;
    setAgentNodes(prev => [...prev, newAgent]);
  };

  // Update agent node
  const updateAgentNode = (index: number, updates: Partial<AgentNode>) => {
    setAgentNodes(prev => prev.map((agent, i) =>
      i === index ? { ...agent, ...updates } : agent
    ));
  };

  // Remove agent node
  const removeAgentNode = (index: number) => {
    if (agentNodes.length > 1) {
      setAgentNodes(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Section header component
  const SectionHeader: React.FC<{
    id: string;
    title: string;
    description?: string;
    icon?: React.ReactNode;
  }> = ({ id, title, description, icon }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors rounded-lg"
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-primary">{icon}</span>}
        <div className="text-left">
          <h3 className="font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {expandedSections.has(id) ? (
        <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
      ) : (
        <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SpinnerIcon className="h-8 w-8 text-primary" />
        <span className="ml-2 text-muted-foreground">Loading flow...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onClose} className="flex items-center gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {flowId ? 'Edit Flow' : 'Create New Flow'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure your workflow step by step
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                Save Flow
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Flow Editor Sections */}
      <div className="space-y-4">
        {/* Metadata Section */}
        <Card>
          <SectionHeader
            id="metadata"
            title="Flow Metadata"
            description="Basic information about your flow"
            icon="📋"
          />
          {expandedSections.has('metadata') && (
            <CardContent className="space-y-4 border-t">
              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Workflow"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Slug</label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="my-workflow"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this flow does..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Category, Status, Version */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <Select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FlowCategory)}
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.emoji} {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FlowStatus)}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Version</label>
                  <Input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Flow is active and can be executed
                </label>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Flow Steps Visual */}
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
            1. Input
          </span>
          <ArrowRightIcon className="h-4 w-4" />
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
            2. Agent(s)
          </span>
          <ArrowRightIcon className="h-4 w-4" />
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
            3. Output
          </span>
        </div>

        {/* Input Node Section */}
        <Card className="border-l-4 border-l-blue-500">
          <SectionHeader
            id="input"
            title="Input Configuration"
            description="Define the inputs your flow accepts"
            icon={<PlayIcon className="h-5 w-5" />}
          />
          {expandedSections.has('input') && (
            <CardContent className="border-t">
              <InputNodeConfig
                node={inputNode}
                onChange={(updates) => setInputNode(prev => ({ ...prev, ...updates }))}
              />
            </CardContent>
          )}
        </Card>

        {/* Agent Nodes Section */}
        <Card className="border-l-4 border-l-purple-500">
          <SectionHeader
            id="agents"
            title="Agent Configuration"
            description="Configure AI agents to process your data"
            icon={<CpuChipIcon className="h-5 w-5" />}
          />
          {expandedSections.has('agents') && (
            <CardContent className="space-y-4 border-t">
              {agentNodes.map((agent, index) => (
                <AgentNodeConfig
                  key={agent.nodeId}
                  node={agent}
                  index={index}
                  onChange={(updates) => updateAgentNode(index, updates)}
                  onRemove={() => removeAgentNode(index)}
                  canRemove={agentNodes.length > 1}
                  availableAgents={availableAgents}
                  availableSkills={availableSkills}
                />
              ))}

              {/* Add Agent Button */}
              <Button
                type="button"
                variant="secondary"
                onClick={addAgentNode}
                className="w-full flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Another Agent Step
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Output Node Section */}
        <Card className="border-l-4 border-l-green-500">
          <SectionHeader
            id="output"
            title="Output Configuration"
            description="Define how results are delivered"
            icon={<CheckCircleIcon className="h-5 w-5" />}
          />
          {expandedSections.has('output') && (
            <CardContent className="border-t">
              <OutputNodeConfig
                node={outputNode}
                onChange={(updates) => setOutputNode(prev => ({ ...prev, ...updates }))}
              />
            </CardContent>
          )}
        </Card>

        {/* Schedule & Triggers Section */}
        <Card className="border-l-4 border-l-orange-500">
          <SectionHeader
            id="triggers"
            title="Schedule & Triggers"
            description="Configure automated execution and webhook triggers"
            icon={<ClockIcon className="h-5 w-5" />}
          />
          {expandedSections.has('triggers') && (
            <CardContent className="space-y-6 border-t">
              {/* Schedule Configuration */}
              <FlowScheduleConfig
                schedule={schedule}
                onChange={setSchedule}
              />

              {/* Webhook Configuration */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg mb-4">
                  <div>
                    <label className="block font-medium flex items-center gap-2">
                      <GlobeIcon className="h-4 w-4" />
                      Enable Webhook Trigger
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Allow this flow to be triggered via HTTP POST request
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webhookEnabled}
                      onChange={(e) => setWebhookEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {webhookEnabled && (
                  <div className="space-y-4 pl-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Webhook Secret
                        <span className="text-muted-foreground font-normal ml-1">- Optional but recommended</span>
                      </label>
                      <Input
                        type="password"
                        value={webhookSecret}
                        onChange={(e) => setWebhookSecret(e.target.value)}
                        placeholder="Enter a secret token for authentication"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Include this secret in the X-Webhook-Secret header when calling the webhook
                      </p>
                    </div>

                    {flowId && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="font-medium text-sm text-blue-800 mb-2">Webhook URL</h5>
                        <code className="block text-sm bg-white p-2 rounded border border-blue-100 break-all">
                          POST /api/webhooks/flows/{slug || flowId}
                        </code>
                        <p className="text-xs text-blue-600 mt-2">
                          Send a POST request with JSON body containing your input data
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? (
            <>
              <SpinnerIcon className="h-4 w-4" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-4 w-4" />
              {flowId ? 'Update Flow' : 'Create Flow'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default FlowEditorPage;
