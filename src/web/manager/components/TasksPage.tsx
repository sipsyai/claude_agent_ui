import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../services/api';
import { Button } from './ui/Button';
import { PlayCircleIcon, XCircleIcon, ClockIcon, CopyIcon } from './ui/Icons';
import TaskExecutionModal from './TaskExecutionModal';

const TasksPage: React.FC = () => {
  const [allTasks, setAllTasks] = useState<api.Task[]>([]);
  const [filter, setFilter] = useState<api.TaskStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<api.Task | null>(null);
  const [executingTask, setExecutingTask] = useState<api.Task | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      // Always fetch all tasks and filter on frontend
      const data = await api.getTasks({});
      setAllTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from tasks
  const stats = useMemo(() => {
    return {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      running: allTasks.filter(t => t.status === 'running').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
    };
  }, [allTasks]);

  // Filter tasks based on selected filter
  const tasks = useMemo(() => {
    if (filter === 'all') return allTasks;
    return allTasks.filter(t => t.status === filter);
  }, [allTasks, filter]);

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      alert('Failed to delete task');
    }
  };

  const handleCloneTask = async (task: api.Task) => {
    try {
      await api.createTask({
        name: task.name,
        description: task.description,
        agentId: task.agentId,
        taskType: task.taskType,
        userPrompt: task.userPrompt,
        inputValues: task.inputValues,
        permissionMode: task.permissionMode,
        directory: task.directory,
      });
      loadTasks();
    } catch (error) {
      alert('Failed to clone task');
    }
  };

  const handleExecuteTask = (task: api.Task) => {
    setExecutingTask(task);
  };

  const getStatusColor = (status: api.TaskStatus) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
    }
  };

  const getStatusIcon = (status: api.TaskStatus) => {
    switch (status) {
      case 'pending': return '🟡';
      case 'running': return '🔵';
      case 'completed': return '🟢';
      case 'failed': return '🔴';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage and execute agent tasks</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ Create Task</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.running}</div>
            <div className="text-sm text-blue-600">Running</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
            <div className="text-sm text-green-600">Completed</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
            <div className="text-sm text-red-600">Failed</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'running', 'completed', 'failed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-card border border-border hover:bg-accent'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No tasks found. Create your first task!
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{getStatusIcon(task.status)}</span>
                    <h3 className="text-lg font-semibold">{task.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {task.agentName} • {formatTimeAgo(task.createdAt)}
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  )}
                  {task.duration && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="h-3 w-3" />
                      {(task.duration / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedTask(task)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCloneTask(task)}
                    title="Clone task"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                  {(task.status === 'pending' || task.status === 'failed') && (
                    <Button
                      size="sm"
                      onClick={() => handleExecuteTask(task)}
                    >
                      <PlayCircleIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    <XCircleIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadTasks();
          }}
        />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
      {executingTask && (
        <TaskExecutionModal
          task={executingTask}
          onClose={() => {
            setExecutingTask(null);
            loadTasks();
          }}
          onComplete={() => {
            // Don't close modal automatically - let user see results
            // Just reload tasks to update the list
            loadTasks();
          }}
        />
      )}
    </div>
  );
};

// Create Task Modal
const CreateTaskModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [taskType, setTaskType] = React.useState<'agent' | 'skill'>('agent');
  const [agents, setAgents] = React.useState<api.Agent[]>([]);
  const [skills, setSkills] = React.useState<api.Skill[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>('');
  const [selectedSkillId, setSelectedSkillId] = React.useState<string>('');
  const [taskName, setTaskName] = React.useState('');
  const [taskDescription, setTaskDescription] = React.useState('');
  const [inputValues, setInputValues] = React.useState<Record<string, any>>({});
  const [permissionMode, setPermissionMode] = React.useState<'default' | 'acceptEdits' | 'bypass' | 'plan'>('bypass');
  const [creating, setCreating] = React.useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedSkill = skills.find(s => s.id === selectedSkillId);
  const selectedEntity = taskType === 'agent' ? selectedAgent : selectedSkill;
  const hasInputFields = taskType === 'skill' && selectedSkill && selectedSkill.inputFields && selectedSkill.inputFields.length > 0;

  React.useEffect(() => {
    // Load agents and skills
    const dir = localStorage.getItem('cui-manager-directory') || undefined;

    api.getAgents(dir).then(data => {
      setAgents(data);
      if (data.length > 0 && taskType === 'agent') setSelectedAgentId(data[0].id);
    }).catch(console.error);

    api.getSkills(dir).then(data => {
      setSkills(data);
      if (data.length > 0 && taskType === 'skill') setSelectedSkillId(data[0].id);
    }).catch(console.error);
  }, []);

  // Update selected ID when task type changes
  React.useEffect(() => {
    if (taskType === 'agent' && agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    } else if (taskType === 'skill' && skills.length > 0 && !selectedSkillId) {
      setSelectedSkillId(skills[0].id);
    }
    setInputValues({});
  }, [taskType, agents, skills]);

  const handleCreate = async () => {
    const entityId = taskType === 'agent' ? selectedAgentId : selectedSkillId;

    if (!taskName.trim() || !entityId) {
      alert('Please fill in required fields');
      return;
    }

    // Build prompt from input values if fields exist
    let userPrompt = '';
    if (hasInputFields) {
      const requiredFields = selectedSkill!.inputFields!.filter((f: any) => f.required);
      const missingFields = requiredFields.filter((f: any) => !inputValues[f.name]);

      if (missingFields.length > 0) {
        alert(`Please fill in required fields: ${missingFields.map((f: any) => f.label).join(', ')}`);
        return;
      }

      const inputParts = selectedSkill!.inputFields!.map((field: any) => {
        const value = inputValues[field.name];
        if (value !== undefined && value !== '') {
          return `${field.label}: ${value}`;
        }
        return null;
      }).filter(Boolean);

      userPrompt = inputParts.join('\n');
    } else {
      userPrompt = inputValues['prompt'] || '';
    }

    if (!userPrompt.trim()) {
      alert('Please provide a prompt or fill in the input fields');
      return;
    }

    setCreating(true);
    try {
      const dir = localStorage.getItem('cui-manager-directory') || undefined;
      await api.createTask({
        name: taskName,
        description: taskDescription || undefined,
        agentId: entityId,
        taskType: taskType,
        userPrompt,
        inputValues: hasInputFields ? inputValues : undefined,
        permissionMode,
        directory: dir,
      });
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create Task</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Name *</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Analyze company website"
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              disabled={creating}
            />
          </div>

          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Additional details about this task"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              disabled={creating}
            />
          </div>

          {/* Task Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Type *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTaskType('agent')}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
                  taskType === 'agent'
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border hover:bg-accent'
                }`}
                disabled={creating}
              >
                Agent
              </button>
              <button
                type="button"
                onClick={() => setTaskType('skill')}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
                  taskType === 'skill'
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border hover:bg-accent'
                }`}
                disabled={creating}
              >
                Skill
              </button>
            </div>
          </div>

          {/* Agent or Skill Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {taskType === 'agent' ? 'Agent' : 'Skill'} *
            </label>
            {taskType === 'agent' ? (
              <>
                <select
                  value={selectedAgentId}
                  onChange={(e) => {
                    setSelectedAgentId(e.target.value);
                    setInputValues({});
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  disabled={creating}
                >
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                {selectedAgent && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedAgent.description}</p>
                )}
              </>
            ) : (
              <>
                <select
                  value={selectedSkillId}
                  onChange={(e) => {
                    setSelectedSkillId(e.target.value);
                    setInputValues({});
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  disabled={creating}
                >
                  {skills.map(skill => (
                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                  ))}
                </select>
                {selectedSkill && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedSkill.description}</p>
                )}
              </>
            )}
          </div>

          {/* Input Fields or Prompt */}
          {selectedEntity && (
            <div>
              {hasInputFields ? (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Skill Inputs:
                  </label>
                  {selectedSkill!.inputFields!.map((field: any) => (
                    <div key={field.name} className="mb-3">
                      <label className="block text-sm mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-muted-foreground mb-1">{field.description}</p>
                      )}
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'textarea' && (
                        <textarea
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'dropdown' && (
                        <select
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'checkbox' && (
                        <input
                          type="checkbox"
                          checked={inputValues[field.name] || false}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.checked })}
                          className="w-4 h-4"
                          disabled={creating}
                        />
                      )}
                      {field.type === 'multiselect' && (
                        <select
                          multiple
                          value={inputValues[field.name] || []}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, option => option.value);
                            setInputValues({ ...inputValues, [field.name]: selected });
                          }}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                          disabled={creating}
                          size={Math.min(field.options?.length || 5, 5)}
                        >
                          {field.options?.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {field.type === 'filepath' && (
                        <input
                          type="text"
                          value={inputValues[field.name] || ''}
                          onChange={(e) => setInputValues({ ...inputValues, [field.name]: e.target.value })}
                          placeholder={field.placeholder || '/path/to/file'}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm font-mono"
                          disabled={creating}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Prompt *</label>
                  <textarea
                    value={inputValues['prompt'] || ''}
                    onChange={(e) => setInputValues({ ...inputValues, prompt: e.target.value })}
                    placeholder={`What should the ${taskType === 'agent' ? 'agent' : 'skill'} do?`}
                    rows={4}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    disabled={creating}
                  />
                </div>
              )}
            </div>
          )}

          {/* Permission Mode */}
          <div>
            <label className="block text-sm font-medium mb-1">Permission Mode</label>
            <select
              value={permissionMode}
              onChange={(e) => setPermissionMode(e.target.value as any)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              disabled={creating}
            >
              <option value="default">Default (ask for permissions)</option>
              <option value="acceptEdits">Accept Edits</option>
              <option value="bypass">Bypass (no permissions)</option>
              <option value="plan">Plan Mode</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? 'Creating...' : 'Create Task'}
          </Button>
          <Button onClick={onClose} variant="secondary" disabled={creating}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

const TaskDetailModal: React.FC<{ task: api.Task; onClose: () => void }> = ({ task, onClose }) => {
  // Parse execution log to display messages
  interface ParsedMessage {
    id: string;
    type: 'status' | 'assistant' | 'tool_use' | 'error' | 'debug';
    content: string;
    timestamp: Date;
    toolName?: string;
    toolInput?: any;
    toolResult?: any;
    toolUseId?: string;
  }

  const parseExecutionLog = (): ParsedMessage[] => {
    if (!task.executionLog || task.executionLog.length === 0) return [];

    const messages: ParsedMessage[] = [];
    const toolUseMap = new Map<string, ParsedMessage>();

    task.executionLog.forEach((event: any, index: number) => {
      // Handle message events
      if (event.type === 'message' && event.content) {
        const eventContent = event.content;

        // Handle assistant messages
        if (eventContent.type === 'assistant' && eventContent.message) {
          const message = eventContent.message;
          if (message.content && Array.isArray(message.content)) {
            const blocks = message.content;

            // Process text blocks
            const textContent = blocks
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');

            if (textContent) {
              messages.push({
                id: `msg-${index}-text`,
                type: 'assistant',
                content: textContent,
                timestamp: new Date(),
              });
            }

            // Process tool_use blocks
            const toolUseBlocks = blocks.filter((block: any) => block.type === 'tool_use');
            toolUseBlocks.forEach((toolBlock: any) => {
              const toolMsg: ParsedMessage = {
                id: `tool-use-${toolBlock.id}`,
                type: 'tool_use',
                content: '',
                timestamp: new Date(),
                toolName: toolBlock.name,
                toolInput: toolBlock.input,
                toolUseId: toolBlock.id,
              };
              messages.push(toolMsg);
              toolUseMap.set(toolBlock.id, toolMsg);
            });
          }
        }

        // Handle user messages (tool results)
        if (eventContent.type === 'user' && eventContent.message) {
          const message = eventContent.message;
          if (message.content && Array.isArray(message.content)) {
            const toolResultBlocks = message.content.filter((block: any) => block.type === 'tool_result');
            toolResultBlocks.forEach((resultBlock: any) => {
              const toolUseId = resultBlock.tool_use_id;
              const toolResult = resultBlock.content;

              // Find corresponding tool_use message and update it
              const toolMsg = toolUseMap.get(toolUseId);
              if (toolMsg) {
                toolMsg.toolResult = toolResult;
              }
            });
          }
        }

        // Handle result
        if (eventContent.type === 'result') {
          const resultText = eventContent.is_error
            ? `❌ Task failed: ${eventContent.result}`
            : `✅ Task completed successfully`;

          messages.push({
            id: `result-${index}`,
            type: 'status',
            content: resultText,
            timestamp: new Date(),
          });

          if (!eventContent.is_error && eventContent.result) {
            messages.push({
              id: `result-content-${index}`,
              type: 'assistant',
              content: typeof eventContent.result === 'string' ? eventContent.result : JSON.stringify(eventContent.result, null, 2),
              timestamp: new Date(),
            });
          }
        }
      }
      // Handle status events
      else if (event.type === 'status') {
        messages.push({
          id: `status-${index}`,
          type: 'status',
          content: event.message || event.status,
          timestamp: new Date(),
        });
      }
      // Handle debug events
      else if (event.type === 'debug') {
        messages.push({
          id: `debug-${index}`,
          type: 'debug',
          content: event.message || JSON.stringify(event),
          timestamp: new Date(),
        });
      }
      // Handle error events
      else if (event.type === 'error') {
        messages.push({
          id: `error-${index}`,
          type: 'error',
          content: `❌ Error: ${event.error || event.message || JSON.stringify(event)}`,
          timestamp: new Date(),
        });
      }
      // Handle complete events
      else if (event.type === 'complete') {
        messages.push({
          id: `complete-${index}`,
          type: 'status',
          content: '✅ Agent execution completed',
          timestamp: new Date(),
        });
      }
    });

    return messages;
  };

  const messages = parseExecutionLog();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">{task.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{task.agentName}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                task.status === 'completed' ? 'bg-green-100 text-green-700' :
                task.status === 'failed' ? 'bg-red-100 text-red-700' :
                task.status === 'running' ? 'bg-blue-100 text-blue-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {task.status}
              </span>
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Task Info */}
        <div className="border-b border-border p-4 text-sm space-y-1">
          <div><span className="font-medium">Created:</span> {new Date(task.createdAt).toLocaleString()}</div>
          {task.startedAt && <div><span className="font-medium">Started:</span> {new Date(task.startedAt).toLocaleString()}</div>}
          {task.completedAt && <div><span className="font-medium">Completed:</span> {new Date(task.completedAt).toLocaleString()}</div>}
          {task.duration && <div><span className="font-medium">Duration:</span> {(task.duration / 1000).toFixed(1)}s</div>}
          <div><span className="font-medium">Permission Mode:</span> {task.permissionMode}</div>
        </div>

        {/* Execution Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No execution log available
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : message.type === 'debug'
                    ? 'bg-yellow-500/10 border border-yellow-500/20'
                    : message.type === 'status'
                    ? 'bg-blue-500/10 border border-blue-500/20'
                    : message.type === 'tool_use'
                    ? 'bg-purple-500/10 border border-purple-500/20'
                    : message.type === 'assistant'
                    ? 'bg-primary/10 border border-primary/20'
                    : 'bg-secondary'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {message.type === 'tool_use'
                      ? `🔧 ${message.toolName}`
                      : message.type}
                  </span>
                </div>

                {message.type === 'tool_use' ? (
                  <div className="text-sm space-y-2">
                    <div className="font-medium text-purple-400">Tool: {message.toolName}</div>

                    {/* Input Parameters */}
                    {message.toolInput && (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-muted-foreground hover:text-foreground">
                          📥 Input Parameters
                        </summary>
                        <pre className="mt-2 text-xs bg-black/20 p-2 rounded overflow-x-auto">
                          {JSON.stringify(message.toolInput, null, 2)}
                        </pre>
                      </details>
                    )}

                    {/* Output Result */}
                    {message.toolResult && (
                      <details
                        className="cursor-pointer"
                        open={typeof message.toolResult === 'string' && message.toolResult.length < 200}
                      >
                        <summary className="text-xs text-muted-foreground hover:text-foreground">
                          📤 Output Result
                        </summary>
                        <div className="mt-2 text-xs bg-black/20 p-2 rounded overflow-x-auto">
                          {typeof message.toolResult === 'string' ? (
                            <pre className="whitespace-pre-wrap">{message.toolResult}</pre>
                          ) : (
                            <pre>{JSON.stringify(message.toolResult, null, 2)}</pre>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex justify-end gap-2">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
