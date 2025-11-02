import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import type { Agent } from '../../../types/agent.types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { XCircleIcon, CpuChipIcon, PuzzlePieceIcon, ServerIcon } from './ui/Icons';
import MCPToolsSelector from './MCPToolsSelector';
import SkillSelector from './SkillSelector';

interface AgentCreatorFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  directory?: string;
  editAgent?: Agent; // If provided, we're in edit mode
}

const AgentCreatorForm: React.FC<AgentCreatorFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  directory,
  editAgent,
}) => {
  const isEditMode = !!editAgent;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedMCPTools, setSelectedMCPTools] = useState<Record<string, string[]>>({});
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [model, setModel] = useState<'sonnet' | 'opus' | 'haiku' | ''>('');
  const [inputFields, setInputFields] = useState<api.InputField[]>([]);
  const [outputSchema, setOutputSchema] = useState('');
  const [availableTools, setAvailableTools] = useState<api.Tool[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Load available tools
      api.getTools()
        .then(setAvailableTools)
        .catch((err) => console.error('Failed to load tools:', err));

      // If editing, populate form with agent data
      if (editAgent) {
        setName(editAgent.name);
        setDescription(editAgent.description || '');
        setSystemPrompt(editAgent.systemPrompt || '');

        // Transform component-based structure to form state
        setSelectedTools(editAgent.toolConfig?.allowedTools || []);

        // Transform mcpConfig (component array) to Record<string, string[]>
        const mcpToolsRecord: Record<string, string[]> = {};
        if (editAgent.mcpConfig) {
          editAgent.mcpConfig.forEach((config) => {
            const serverName = typeof config.mcpServer === 'string' ? config.mcpServer : config.mcpServer.name;
            if (config.selectedTools) {
              mcpToolsRecord[serverName] = config.selectedTools.map((toolSel) =>
                typeof toolSel.mcpTool === 'string' ? toolSel.mcpTool : toolSel.mcpTool.name
              );
            }
          });
        }
        setSelectedMCPTools(mcpToolsRecord);

        // Transform skillSelection (component array) to string[]
        const skillIds = editAgent.skillSelection?.map((selection) =>
          typeof selection.skill === 'string' ? selection.skill : selection.skill.name
        ) || [];
        setSelectedSkills(skillIds);

        // Map ClaudeModel to form model type
        const modelValue = editAgent.modelConfig?.model || '';
        const mappedModel = modelValue.startsWith('sonnet') ? 'sonnet'
          : modelValue.startsWith('opus') ? 'opus'
          : modelValue.startsWith('haiku') ? 'haiku'
          : '';
        setModel(mappedModel);

        // Input fields and output schema are not in Strapi schema yet
        // TODO: Add these to Strapi schema if needed
        setInputFields([]);
        setOutputSchema('');
      } else {
        // Reset form for create mode
        setName('');
        setDescription('');
        setSystemPrompt('');
        setSelectedTools([]);
        setSelectedMCPTools({});
        setSelectedSkills([]);
        setModel('');
        setInputFields([]);
        setOutputSchema('');
      }
    }
  }, [isOpen, editAgent]);

  const handleToolToggle = (toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }

    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    if (!systemPrompt.trim()) {
      setError('System prompt is required');
      return;
    }

    setIsCreating(true);

    try {
      // Parse output schema if provided
      let parsedOutputSchema: string | object | undefined;

      if (outputSchema.trim()) {
        try {
          parsedOutputSchema = JSON.parse(outputSchema);
        } catch (e) {
          setError('Output schema must be valid JSON');
          setIsCreating(false);
          return;
        }
      }

      // Filter out empty input fields
      const validInputFields = inputFields.filter(f => f.name && f.type && f.label);

      let result;

      if (isEditMode && editAgent) {
        // Update existing agent
        result = await api.updateAgent(
          editAgent.id,
          {
            name: name.trim(),
            description: description.trim(),
            systemPrompt: systemPrompt.trim(),
            tools: selectedTools.length > 0 ? selectedTools : undefined,
            model: model || undefined,
            inputFields: validInputFields.length > 0 ? validInputFields : undefined,
            outputSchema: parsedOutputSchema,
            mcpTools: Object.keys(selectedMCPTools).length > 0 ? selectedMCPTools : undefined,
            skills: selectedSkills.length > 0 ? selectedSkills : undefined,
          },
          directory
        );
      } else {
        // Create new agent
        result = await api.createAgent(
          {
            name: name.trim(),
            description: description.trim(),
            systemPrompt: systemPrompt.trim(),
            tools: selectedTools.length > 0 ? selectedTools : undefined,
            model: model || undefined,
            inputFields: validInputFields.length > 0 ? validInputFields : undefined,
            outputSchema: parsedOutputSchema,
            mcpTools: Object.keys(selectedMCPTools).length > 0 ? selectedMCPTools : undefined,
            skills: selectedSkills.length > 0 ? selectedSkills : undefined,
          },
          directory
        );
      }

      setSuccess(result.message);

      // Reset form after 1 second
      setTimeout(() => {
        setName('');
        setDescription('');
        setSystemPrompt('');
        setSelectedTools([]);
        setSelectedMCPTools({});
        setSelectedSkills([]);
        setModel('');
        setError(null);
        setSuccess(null);
        onSuccess();
        onClose();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} agent`);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">{isEditMode ? 'Edit Agent' : 'Create New Agent'}</h2>
            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? 'Update agent configuration and behavior'
                : 'Define a custom agent with specific tools and behavior'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded p-3 text-sm text-green-500">
              {success}
            </div>
          )}

          {/* Agent Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Agent Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., SQL Optimizer, Code Reviewer"
              disabled={isCreating || isEditMode}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {isEditMode
                ? 'Agent name cannot be changed'
                : 'Will be converted to kebab-case (e.g., "SQL Optimizer" → "sql-optimizer")'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Use for SQL query optimization and database performance analysis"
              disabled={isCreating}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Describe WHEN to use this agent. Start with "Use for..." or "Use when..."
            </p>
          </div>

          {/* Claude Built-in Tools */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Claude Built-in Tools (Optional)
            </label>
            <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto">
              {availableTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading tools...</p>
              ) : (
                <div className="space-y-2">
                  {availableTools.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex items-start gap-2 cursor-pointer hover:bg-secondary/50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTools.includes(tool.name)}
                        onChange={() => handleToolToggle(tool.name)}
                        disabled={isCreating}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{tool.name}</div>
                        <div className="text-xs text-muted-foreground">{tool.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedTools.length > 0
                ? `Selected: ${selectedTools.join(', ')}`
                : 'Leave empty to allow all built-in tools'}
            </p>
          </div>

          {/* MCP Tools */}
          <div>
            <label className="block text-sm font-medium mb-2">
              MCP Server Tools (Optional)
            </label>
            <MCPToolsSelector
              selectedMCPTools={selectedMCPTools}
              onChange={setSelectedMCPTools}
              disabled={isCreating}
              directory={directory}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select specific tools from your MCP servers. Leave empty to allow all MCP tools.
            </p>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Skills (Optional)
            </label>
            <SkillSelector
              selectedSkills={selectedSkills}
              onChange={setSelectedSkills}
              disabled={isCreating}
              directory={directory}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select skills that this agent can use. Skills provide specialized capabilities and domain knowledge.
            </p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Model (Optional)
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              disabled={isCreating}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="">Default (inherit from main agent)</option>
              <option value="sonnet">Sonnet (balanced)</option>
              <option value="opus">Opus (highest quality)</option>
              <option value="haiku">Haiku (fast & efficient)</option>
            </select>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium mb-2">
              System Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={`You are an expert SQL optimizer.

Your responsibilities:
- Analyze SQL queries for performance issues
- Suggest index improvements
- Identify N+1 query problems
- Recommend query optimizations

When reviewing queries:
- Focus on execution plan efficiency
- Check for missing indexes
- Look for unnecessary JOINs
- Suggest caching strategies

Always provide:
1. Specific optimization recommendations
2. Expected performance improvement
3. Implementation steps`}
              disabled={isCreating}
              rows={12}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Define the agent's role, expertise, and behavior. Be specific and detailed.
            </p>
          </div>

          {/* Input Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                Input Fields (Optional)
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setInputFields([...inputFields, {
                    name: '',
                    type: 'text',
                    label: '',
                    required: false,
                  }]);
                }}
                disabled={isCreating}
              >
                + Add Field
              </Button>
            </div>

            {inputFields.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded">
                No input fields defined. Click "+ Add Field" to add fields that users will fill when executing this agent.
              </p>
            ) : (
              <div className="space-y-3 border border-border rounded p-3">
                {inputFields.map((field, index) => (
                  <div key={index} className="border border-border rounded p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Field Name *</label>
                        <Input
                          type="text"
                          value={field.name}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].name = e.target.value;
                            setInputFields(newFields);
                          }}
                          placeholder="url"
                          disabled={isCreating}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Label *</label>
                        <Input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].label = e.target.value;
                            setInputFields(newFields);
                          }}
                          placeholder="Website URL"
                          disabled={isCreating}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Type *</label>
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].type = e.target.value as any;
                            setInputFields(newFields);
                          }}
                          disabled={isCreating}
                          className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="number">Number</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Placeholder</label>
                        <Input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].placeholder = e.target.value;
                            setInputFields(newFields);
                          }}
                          placeholder="https://example.com"
                          disabled={isCreating}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {field.type === 'dropdown' && (
                      <div>
                        <label className="block text-xs font-medium mb-1">Options (comma-separated) *</label>
                        <Input
                          type="text"
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].options = e.target.value.split(',').map(o => o.trim()).filter(Boolean);
                            setInputFields(newFields);
                          }}
                          placeholder="Basic, Detailed, Comprehensive"
                          disabled={isCreating}
                          className="text-sm"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].required = e.target.checked;
                            setInputFields(newFields);
                          }}
                          disabled={isCreating}
                          className="w-3 h-3"
                        />
                        Required
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setInputFields(inputFields.filter((_, i) => i !== index));
                        }}
                        disabled={isCreating}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Define form fields that users will fill when executing this agent
            </p>
          </div>

          {/* Output Schema */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Output Schema (Optional)
            </label>
            <textarea
              value={outputSchema}
              onChange={(e) => setOutputSchema(e.target.value)}
              placeholder={`{
  "type": "object",
  "properties": {
    "summary": {
      "type": "string",
      "description": "Brief summary of findings"
    },
    "recommendations": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}`}
              disabled={isCreating}
              rows={8}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              JSON Schema defining the expected output format from this agent
            </p>
          </div>

          {/* Agent Configuration Preview */}
          {(selectedTools.length > 0 || Object.keys(selectedMCPTools).length > 0 || selectedSkills.length > 0) && (
            <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="text-primary">👁️</span>
                Agent Configuration Preview
              </h3>

              <div className="space-y-3">
                {/* Skills Preview */}
                {selectedSkills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <PuzzlePieceIcon className="h-3.5 w-3.5 text-green-600" />
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase">
                        Skills ({selectedSkills.length})
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedSkills.map((skill, idx) => (
                        <span key={idx} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Built-in Tools Preview */}
                {selectedTools.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CpuChipIcon className="h-3.5 w-3.5 text-blue-600" />
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase">
                        Claude Built-in Tools ({selectedTools.length})
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedTools.map((tool, idx) => (
                        <span key={idx} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* MCP Tools Preview */}
                {Object.keys(selectedMCPTools).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ServerIcon className="h-3.5 w-3.5 text-indigo-600" />
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase">
                        MCP Tools ({Object.values(selectedMCPTools).reduce((sum, tools) => sum + tools.length, 0)} from {Object.keys(selectedMCPTools).length} server{Object.keys(selectedMCPTools).length !== 1 ? 's' : ''})
                      </h4>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(selectedMCPTools).map(([serverId, tools]) => (
                        <div key={serverId}>
                          <div className="text-xs font-medium text-indigo-600 mb-0.5">{serverId}</div>
                          <div className="flex flex-wrap gap-1">
                            {tools.map((tool, idx) => (
                              <span key={idx} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isCreating || !name || !description || !systemPrompt}
          >
            {isCreating
              ? (isEditMode ? 'Updating...' : 'Creating...')
              : (isEditMode ? 'Update Agent' : 'Create Agent')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentCreatorForm;
