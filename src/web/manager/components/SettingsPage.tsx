import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface SettingsPageProps {
  directoryName?: string;
  onDirectoryChange: (directory: string) => void;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
}

interface TrainingAgentConfig {
  trainingAgentId: string | null;
  fallbackToLocal: boolean;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ directoryName, onDirectoryChange }) => {
  const [inputValue, setInputValue] = useState(directoryName || '');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [useLocalFallback, setUseLocalFallback] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    onDirectoryChange(inputValue);
  };

  // Load training agent config and agents
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch training agent config
        const configRes = await fetch('/api/manager/training-agent-config');
        if (configRes.ok) {
          const config: TrainingAgentConfig = await configRes.json();
          setSelectedAgentId(config.trainingAgentId || '');
          setUseLocalFallback(config.fallbackToLocal);
        }

        // Fetch all agents from Strapi
        const agentsRes = await fetch('/api/strapi/agents');
        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgents(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load training agent config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleTrainingAgentSave = async () => {
    setSaving(true);
    try {
      const agentId = useLocalFallback ? null : (selectedAgentId || null);

      const res = await fetch('/api/manager/training-agent-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });

      if (!res.ok) {
        throw new Error('Failed to update training agent config');
      }

      alert('Training agent configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save training agent config:', error);
      alert('Failed to save training agent configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Configure your manager settings.</p>

      <Card>
        <CardHeader>
          <CardTitle>Project Directory</CardTitle>
          <CardDescription>
            Specify the directory containing your .claude folder. Leave empty to use the current working directory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Directory Path</label>
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g., /path/to/your/project or leave empty for current directory"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Current: {directoryName || 'Current working directory'}
              </p>
            </div>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Training Agent Configuration Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Training Agent Configuration</CardTitle>
          <CardDescription>
            Select which agent to use for skill training. This agent will be used when training skills to evaluate and improve them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="use-local-fallback"
                  checked={useLocalFallback}
                  onChange={(e) => setUseLocalFallback(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="use-local-fallback" className="text-sm font-medium cursor-pointer">
                  Use local training-agent.md (fallback)
                </label>
              </div>

              {!useLocalFallback && (
                <div>
                  <label className="block text-sm font-medium mb-2">Select Training Agent</label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an agent...</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} {agent.description ? `- ${agent.description}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedAgentId
                      ? `Selected: ${agents.find((a) => a.id === selectedAgentId)?.name || 'Unknown'}`
                      : 'No agent selected. Will fallback to local training-agent.md'}
                  </p>
                </div>
              )}

              <div className="pt-2">
                <Button onClick={handleTrainingAgentSave} disabled={saving || (!useLocalFallback && !selectedAgentId)}>
                  {saving ? 'Saving...' : 'Save Training Agent'}
                </Button>
              </div>

              {useLocalFallback && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  <p className="font-medium">Using Local Fallback</p>
                  <p className="mt-1">
                    Skills will be trained using the training-agent.md file from .claude/agents/ directory.
                    To use a database agent, uncheck the fallback option and select an agent.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
