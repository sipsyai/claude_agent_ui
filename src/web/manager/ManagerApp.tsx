import React, { useState, useEffect, useCallback } from 'react';
import HomePage from './components/HomePage';
import LandingPage from './components/LandingPage';
import ValidationPage from './components/ValidationPage';
import AgentConfigModal from './components/AgentConfigModal';
import type { Agent, ValidationStep, Flow } from './types';
import { ManagerView } from './types';
import Layout from './components/layout/Layout';
import DashboardPage from './components/DashboardPage';
import AgentsPage from './components/AgentsPage';
import CommandsPage from './components/CommandsPage';
import SkillsPage from './components/SkillsPage';
import MCPServersPage from './components/MCPServersPage';
import TasksPage from './components/TasksPage';
import FlowsPage from './components/FlowsPage';
import FlowEditorPage from './components/FlowEditorPage';
import SettingsPage from './components/SettingsPage';
import * as api from './services/api';
import ChatPage from './components/ChatPage';

type SetupStep = 'home' | 'landing' | 'validating';

const App: React.FC = () => {
  const [view, setView] = useState<'setup' | 'dashboard'>('setup');
  const [setupStep, setSetupStep] = useState<SetupStep>('home');

  const [directoryHandle, setDirectoryHandle] = useState<object | null>(null);
  const [directoryName, setDirectoryName] = useState<string | undefined>(undefined);

  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);
  const [discoveredAgents, setDiscoveredAgents] = useState<api.Agent[]>([]);
  const [discoveredCommands, setDiscoveredCommands] = useState<api.SlashCommand[]>([]);
  const [discoveredSkills, setDiscoveredSkills] = useState<api.Skill[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [managerView, setManagerView] = useState<ManagerView>(ManagerView.Dashboard);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Flow editor state
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);

  // Load saved directory from localStorage on mount
  useEffect(() => {
    const savedDirName = localStorage.getItem('claude-agent-manager-dir');
    if (savedDirName) {
      setDirectoryName(savedDirName);
    }
  }, []);

  const handleGetStarted = () => setSetupStep('landing');

  const handleDirectoryChange = (path: string) => {
    if (path) {
      setDirectoryName(path);
      setDirectoryHandle({});
      localStorage.setItem('claude-agent-manager-dir', path);
    }
  };

  const startValidation = useCallback(async () => {
    setSetupStep('validating');
    const steps: ValidationStep[] = [
      { id: 'cli', label: 'Checking for Claude Code CLI...', status: 'pending' },
      { id: 'sdk', label: 'Verifying Claude SDK installation...', status: 'pending' },
      { id: 'folder', label: 'Looking for .claude folder...', status: 'pending' },
      { id: 'agents', label: 'Parsing agents...', status: 'pending' },
      { id: 'commands', label: 'Parsing slash commands...', status: 'pending' },
      { id: 'skills', label: 'Parsing skills...', status: 'pending' },
    ];
    setValidationSteps(steps);

    try {
      // Call validation API
      await new Promise(resolve => setTimeout(resolve, 300));
      setValidationSteps(prev => prev.map(s => ({ ...s, status: 'loading' })));

      const result = await api.validateProject(directoryName || '');

      // Update each step based on results
      const updatedSteps = steps.map(step => {
        const resultKey = step.id as keyof typeof result;
        const stepResult = result[resultKey];

        if (!stepResult) {
          return { ...step, status: 'success' as const };
        }

        return {
          ...step,
          status: stepResult.status === 'success' ? 'success' as const : 'error' as const,
          label: stepResult.message || step.label,
          error: stepResult.status === 'error' ? stepResult.message : undefined,
        };
      });

      setValidationSteps(updatedSteps);

      // Check if all successful
      const allSuccess = updatedSteps.every(s => s.status === 'success');
      if (allSuccess) {
        // Load agents, commands, and skills
        await new Promise(resolve => setTimeout(resolve, 500));
        const analysis = await api.analyzeProject(directoryName);

        setDiscoveredAgents(analysis.agents);
        setDiscoveredCommands(analysis.commands);
        setDiscoveredSkills(analysis.skills);

        setView('dashboard');
        setManagerView(ManagerView.Dashboard);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationSteps(prev => prev.map(s => ({
        ...s,
        status: 'error' as const,
        error: 'Failed to connect to API'
      })));
    }
  }, [directoryName]);

  const handleChangeDirectory = () => {
    setView('setup');
    setSetupStep('landing');
    setDirectoryHandle(null);
    // Keep directoryName so user sees their last choice
  };

  const handleNextFromLanding = () => directoryHandle && startValidation();

  const handleBackToHome = () => {
    setSetupStep('home');
    setDirectoryHandle(null);
    setDirectoryName(undefined);
    localStorage.removeItem('claude-agent-manager-dir');
  };

  const handleAgentCreated = async () => {
    // Reload agents list
    if (directoryName) {
      try {
        const agents = await api.getAgents(directoryName);
        setDiscoveredAgents(agents);
      } catch (error) {
        console.error('Failed to reload agents:', error);
      }
    }
  };

  const handleSkillCreated = async () => {
    // Reload skills list
    if (directoryName) {
      try {
        const skills = await api.getSkills(directoryName);
        setDiscoveredSkills(skills);
      } catch (error) {
        // Failed to reload skills - silent failure for non-critical operation
      }
    }
  };

  // Flow handlers
  const handleEditFlow = (flow: Flow) => {
    setEditingFlowId(flow.id);
    setIsCreatingFlow(false);
  };

  const handleCreateFlow = () => {
    setEditingFlowId(null);
    setIsCreatingFlow(true);
  };

  const handleCloseFlowEditor = () => {
    setEditingFlowId(null);
    setIsCreatingFlow(false);
  };

  const handleFlowSaved = (_flow: Flow) => {
    // Flow was saved, close editor and refresh will happen automatically
    handleCloseFlowEditor();
  };

  const renderSetupContent = () => {
    switch (setupStep) {
      case 'home':
        return <HomePage onGetStarted={handleGetStarted} />;
      case 'landing':
        return (
          <LandingPage
            onDirectoryChange={handleDirectoryChange}
            onNext={handleNextFromLanding}
            directorySelected={!!directoryHandle}
            directoryName={directoryName}
            onBack={handleBackToHome}
          />
        );
      case 'validating':
        return <ValidationPage steps={validationSteps} onRetry={startValidation} />;
      default:
        return <HomePage onGetStarted={handleGetStarted} />;
    }
  };

  const renderDashboardContent = () => {
    // Handle flow editor view
    if (managerView === ManagerView.Flows && (isCreatingFlow || editingFlowId)) {
      return (
        <FlowEditorPage
          flowId={editingFlowId || undefined}
          onClose={handleCloseFlowEditor}
          onSave={handleFlowSaved}
        />
      );
    }

    switch(managerView) {
      case ManagerView.Dashboard:
        return <DashboardPage />;
      case ManagerView.Chat:
        return <ChatPage />;
      case ManagerView.Agents:
        return <AgentsPage agents={discoveredAgents} directory={directoryName} onAgentCreated={handleAgentCreated} />;
      case ManagerView.Commands:
        return <CommandsPage commands={discoveredCommands} />;
      case ManagerView.Skills:
        return <SkillsPage skills={discoveredSkills} onRefresh={handleSkillCreated} />;
      case ManagerView.MCPServers:
        return <MCPServersPage directory={directoryName} />;
      case ManagerView.Tasks:
        return <TasksPage />;
      case ManagerView.Flows:
        return (
          <FlowsPage
            onEditFlow={handleEditFlow}
            onCreateFlow={handleCreateFlow}
          />
        );
      case ManagerView.Settings:
        return <SettingsPage directoryName={directoryName} onDirectoryChange={handleDirectoryChange} />;
      default:
        return <DashboardPage />;
    }
  };

  if (view === 'setup') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        {renderSetupContent()}
      </main>
    );
  }

  return (
    <Layout
      sidebarProps={{
        activeView: managerView,
        onNavigate: setManagerView,
        directoryName: directoryName,
        onChangeDirectory: handleChangeDirectory,
      }}
      noContainer={managerView === ManagerView.Chat}
    >
      {renderDashboardContent()}
      {selectedAgent && (
        <AgentConfigModal
          agent={selectedAgent}
          isOpen={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </Layout>
  );
};

export default App;
