/**
 * @file ManagerApp.tsx
 * @description Main application component that manages routing, setup workflow, and dashboard navigation.
 * This is the root component of the Claude Agent Manager UI, handling the complete application lifecycle
 * from initial setup through project validation to the main dashboard interface.
 *
 * ## Features
 * - **Two-Phase Workflow**: Setup phase for project initialization, dashboard phase for management
 * - **Multi-Step Setup**: Home → Landing (directory selection) → Validation → Dashboard
 * - **Routing Configuration**: Client-side routing between 8 different dashboard views
 * - **Directory Management**: Persistent directory selection via localStorage with change capability
 * - **Project Validation**: Automated validation of Claude Code CLI, SDK, and project structure
 * - **Resource Discovery**: Automatic parsing and loading of agents, commands, and skills
 * - **State Management**: Centralized state for view navigation, directory, and discovered resources
 * - **Error Handling**: Comprehensive error handling with retry capability for validation failures
 *
 * ## Application Lifecycle
 * The app follows a sequential lifecycle from initialization through to active management:
 *
 * ### 1. Initialization (Mount)
 * - **Load Saved Directory**: Check localStorage for 'claude-agent-manager-dir' key
 * - **Restore State**: If directory found, populate directoryName state
 * - **Default View**: Start in 'setup' view with 'home' step
 * - **No Auto-Navigation**: User must explicitly start the workflow
 *
 * ### 2. Setup Phase (view='setup')
 * The setup phase consists of three steps:
 *
 * #### Step 1: Home (setupStep='home')
 * - **Display**: HomePage component with welcome message and "Get Started" button
 * - **User Action**: Click "Get Started" to proceed
 * - **Transition**: `handleGetStarted()` → setupStep='landing'
 *
 * #### Step 2: Landing (setupStep='landing')
 * - **Display**: LandingPage component with directory selection interface
 * - **Directory Selection**: User enters directory path (text input)
 * - **State Updates**: `handleDirectoryChange(path)` saves to state and localStorage
 * - **Validation**: Next button enabled only when directoryHandle is set
 * - **User Actions**:
 *   - Back button → return to home step, clear directory
 *   - Next button → proceed to validation step
 * - **Transition**: `handleNextFromLanding()` → setupStep='validating'
 *
 * #### Step 3: Validating (setupStep='validating')
 * - **Display**: ValidationPage component showing 6 validation steps with status
 * - **Automatic Execution**: `startValidation()` called automatically on mount
 * - **Validation Steps**:
 *   1. CLI check: Verify Claude Code CLI exists
 *   2. SDK check: Verify Claude SDK installation
 *   3. Folder check: Look for .claude folder in directory
 *   4. Agents parsing: Parse and validate agent configurations
 *   5. Commands parsing: Parse slash commands
 *   6. Skills parsing: Parse skill definitions
 * - **API Calls**:
 *   - `api.validateProject(directory)` → validation results
 *   - `api.analyzeProject(directory)` → discovered resources (if all validation passes)
 * - **Success Path**: All steps pass → load resources → transition to dashboard
 * - **Failure Path**: Any step fails → show error message with retry button
 * - **Transition**: All success → view='dashboard', managerView=Dashboard
 *
 * ### 3. Dashboard Phase (view='dashboard')
 * Once validation succeeds, the app enters the main dashboard interface:
 *
 * - **Layout**: Full Layout component with Sidebar navigation
 * - **Active View**: Controlled by managerView state (ManagerView enum)
 * - **Navigation**: Sidebar onNavigate callback updates managerView
 * - **Page Rendering**: `renderDashboardContent()` renders page based on managerView
 * - **Directory Display**: Sidebar shows selected directory with "Change Directory" button
 * - **Change Directory**: Returns to setup phase (landing step) with directory preserved
 *
 * ## Routing Configuration
 * Client-side routing is managed through the ManagerView enum and state-based rendering:
 *
 * ### View Routes (ManagerView enum)
 * 1. **Dashboard** (ManagerView.Dashboard)
 *    - Component: DashboardPage
 *    - Purpose: Overview metrics and quick actions
 *    - Container: Full layout with container
 *
 * 2. **Chat** (ManagerView.Chat)
 *    - Component: ChatPage
 *    - Purpose: Interactive chat sessions with agents and skills
 *    - Container: Full layout WITHOUT container (noContainer=true for full-width)
 *
 * 3. **Agents** (ManagerView.Agents)
 *    - Component: AgentsPage
 *    - Purpose: Agent listing, creation, editing, execution
 *    - Props: agents array, directory, onAgentCreated callback
 *    - Container: Full layout with container
 *
 * 4. **Commands** (ManagerView.Commands)
 *    - Component: CommandsPage
 *    - Purpose: Slash command listing and execution
 *    - Props: commands array
 *    - Container: Full layout with container
 *
 * 5. **Skills** (ManagerView.Skills)
 *    - Component: SkillsPage
 *    - Purpose: Skill management, creation, training
 *    - Props: skills array, onRefresh callback
 *    - Container: Full layout with container
 *
 * 6. **MCPServers** (ManagerView.MCPServers)
 *    - Component: MCPServersPage
 *    - Purpose: MCP server configuration and tool management
 *    - Props: directory
 *    - Container: Full layout with container
 *
 * 7. **Tasks** (ManagerView.Tasks)
 *    - Component: TasksPage
 *    - Purpose: Task execution history and status
 *    - Container: Full layout with container
 *
 * 8. **Flows** (ManagerView.Flows)
 *    - Component: FlowsPage, FlowEditorVisual, FlowDetailPage
 *    - Purpose: Flow creation, editing, and viewing with visual drag-and-drop editor
 *    - Container: Full layout with container
 *
 * 9. **Settings** (ManagerView.Settings)
 *    - Component: SettingsPage
 *    - Purpose: Application settings and preferences
 *    - Props: directoryName, onDirectoryChange callback
 *    - Container: Full layout with container
 *
 * ### Route Switching
 * - **Trigger**: Sidebar navigation item click
 * - **Handler**: `setManagerView(newView)` called by sidebar onNavigate
 * - **Re-Render**: App re-renders, renderDashboardContent() returns new page component
 * - **Layout Persistence**: Layout and Sidebar remain mounted, only main content changes
 * - **No Page Reload**: Pure client-side routing with React state
 *
 * ## Directory Management
 * Directory selection is central to the app, enabling project-specific resource management:
 *
 * ### Directory Selection Flow
 * 1. **User Input**: Enter path in LandingPage text input
 * 2. **Handle Change**: `handleDirectoryChange(path)` invoked
 * 3. **State Updates**:
 *    - `setDirectoryName(path)` → updates UI with selected path
 *    - `setDirectoryHandle({})` → marks directory as selected (enables Next button)
 *    - `localStorage.setItem('claude-agent-manager-dir', path)` → persists selection
 * 4. **Propagation**: Directory passed as prop to all resource-dependent components
 *
 * ### Directory Persistence
 * - **Storage Key**: 'claude-agent-manager-dir'
 * - **Storage Type**: localStorage (persists across sessions)
 * - **Load Timing**: useEffect on mount (runs once)
 * - **Restoration**: If found, populates directoryName state
 * - **Clear Trigger**: "Back to Home" button in LandingPage
 *
 * ### Directory Usage
 * Directory is passed to components that need project context:
 * - **API Calls**: validateProject(directory), analyzeProject(directory), getAgents(directory), getSkills(directory)
 * - **Component Props**: AgentsPage, MCPServersPage, SettingsPage, AgentCreatorChatPanel, SkillCreatorChatPanel
 * - **Sidebar Display**: Shows current directory name with truncation
 *
 * ### Change Directory Flow
 * 1. **Trigger**: Click "Change Directory" button in Sidebar
 * 2. **Handler**: `handleChangeDirectory()` called
 * 3. **State Changes**:
 *    - `setView('setup')` → return to setup phase
 *    - `setSetupStep('landing')` → go directly to directory selection
 *    - `setDirectoryHandle(null)` → clear selection flag
 *    - Keep directoryName → user sees last selection in input
 * 4. **User Flow**: User can enter new path → re-validate → return to dashboard
 *
 * ## State Management
 * The app manages multiple categories of state for coordinating the complex workflow:
 *
 * ### View Navigation State
 * - **view**: 'setup' | 'dashboard' - Top-level phase toggle
 * - **setupStep**: 'home' | 'landing' | 'validating' - Setup sub-steps
 * - **managerView**: ManagerView enum - Dashboard page routing
 *
 * ### Directory State
 * - **directoryHandle**: object | null - Selection flag for enabling Next button
 * - **directoryName**: string | undefined - Selected directory path for display and API calls
 *
 * ### Validation State
 * - **validationSteps**: ValidationStep[] - Array of 6 validation steps with status/error
 * - Each step: `{ id, label, status: 'pending'|'loading'|'success'|'error', error? }`
 *
 * ### Resource Discovery State
 * - **discoveredAgents**: api.Agent[] - Parsed agents from .claude/agents/
 * - **discoveredCommands**: api.SlashCommand[] - Parsed commands from .claude/commands/
 * - **discoveredSkills**: api.Skill[] - Parsed skills from .claude/skills/
 * - **isLoading**: boolean - Loading flag for initial data fetch
 *
 * ### Modal State
 * - **selectedAgent**: Agent | null - Agent for AgentConfigModal (currently unused in main flow)
 *
 * ### Flow State
 * - **editingFlowId**: string | null - ID of flow being edited
 * - **isCreatingFlow**: boolean - Flag for creating new flow
 * - **viewingFlowId**: string | null - ID of flow being viewed
 *
 * ### State Updates
 * State is updated through handler functions:
 * - **Navigation**: `setView()`, `setSetupStep()`, `setManagerView()`
 * - **Directory**: `handleDirectoryChange()`, `handleChangeDirectory()`
 * - **Validation**: `startValidation()` with step-by-step updates
 * - **Resources**: `handleAgentCreated()`, `handleSkillCreated()` for refreshing lists
 * - **Flows**: `handleViewFlow()`, `handleEditFlow()`, `handleCreateFlow()` for flow management
 *
 * ## Theme Handling
 * The application uses a consistent dark theme throughout:
 *
 * ### Setup Phase Styling
 * - **Container**: `min-h-screen flex flex-col items-center justify-center p-4`
 * - **Centering**: Full viewport height with centered content
 * - **Padding**: p-4 for mobile-friendly spacing
 * - **Background**: Inherits from global styles (dark theme)
 *
 * ### Dashboard Phase Styling
 * - **Layout Component**: Provides consistent structure with Sidebar
 * - **Theme**: Dark theme with Tailwind CSS variables (bg-background, text-foreground, etc.)
 * - **Container Mode**: Most pages use container, Chat uses full-width (noContainer=true)
 * - **Responsive**: Layout handles mobile/tablet/desktop breakpoints
 *
 * ### Color Scheme
 * - **Primary**: Blue accent for active states and primary actions
 * - **Secondary**: Gray variants for secondary UI elements
 * - **Background**: Dark gray (bg-background)
 * - **Foreground**: Light gray text (text-foreground)
 * - **Muted**: Dimmed text for less important content (text-muted-foreground)
 * - **Error**: Red for validation failures and errors
 * - **Success**: Green for successful validation steps
 *
 * ## Error Handling
 * The app provides comprehensive error handling with user feedback:
 *
 * ### Validation Errors
 * - **Catch Block**: `try/catch` around validation API calls
 * - **Error Display**: Updates all validation steps to 'error' status
 * - **Error Message**: "Failed to connect to API" shown in ValidationPage
 * - **Retry Button**: User can click retry to re-run `startValidation()`
 * - **Console Logging**: Errors logged to console for debugging
 *
 * ### Resource Reload Errors
 * - **Agent Reload**: `handleAgentCreated()` catches and logs errors
 * - **Skill Reload**: `handleSkillCreated()` catches and logs errors
 * - **Silent Failure**: Errors don't block UI, only logged to console
 * - **User Impact**: Resource lists may be stale if reload fails
 *
 * ### API Error Handling
 * - **Connection Failures**: Generic "Failed to connect to API" message
 * - **Validation Step Failures**: Individual step errors shown with specific messages
 * - **No Network Retry**: User must manually retry validation
 *
 * @example
 * // Basic usage - render as root app component
 * import ManagerApp from './ManagerApp';
 *
 * function Root() {
 *   return <ManagerApp />;
 * }
 *
 * @example
 * // Understanding the setup flow
 * // 1. User lands on HomePage
 * // 2. Clicks "Get Started" → LandingPage appears
 * // 3. Enters directory path "/Users/alice/my-project"
 * // 4. Clicks "Next" → ValidationPage appears
 * // 5. Validation runs automatically:
 * //    - CLI check ✓
 * //    - SDK check ✓
 * //    - Folder check ✓
 * //    - Parse agents ✓ (found 3 agents)
 * //    - Parse commands ✓ (found 5 commands)
 * //    - Parse skills ✓ (found 2 skills)
 * // 6. All pass → Dashboard loads with discovered resources
 * // 7. Sidebar shows "/Users/alice/my-project" with navigation menu
 *
 * @example
 * // Understanding dashboard navigation
 * // User clicks "Agents" in Sidebar
 * // → setManagerView(ManagerView.Agents) called
 * // → App re-renders
 * // → renderDashboardContent() returns <AgentsPage agents={discoveredAgents} ... />
 * // → Layout persists, main content swaps to AgentsPage
 * // → User sees list of 3 discovered agents
 *
 * @example
 * // Understanding directory change flow
 * // User in Dashboard, clicks "Change Directory" in Sidebar
 * // → handleChangeDirectory() called
 * // → setView('setup'), setSetupStep('landing')
 * // → App re-renders to LandingPage with last directory shown
 * // → User enters new path "/Users/alice/other-project"
 * // → Clicks "Next" → validation runs for new directory
 * // → Dashboard loads with new project's resources
 */

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
import FlowEditorVisual from './components/FlowEditorVisual';
import FlowDetailPage from './components/FlowDetailPage';
import SettingsPage from './components/SettingsPage';
import * as api from './services/api';
import ChatPage from './components/ChatPage';

/**
 * Setup step type for the three-step onboarding workflow.
 *
 * @typedef {'home' | 'landing' | 'validating'} SetupStep
 * - **home**: Welcome screen with "Get Started" button
 * - **landing**: Directory selection interface
 * - **validating**: Project validation with progress indicators
 */
type SetupStep = 'home' | 'landing' | 'validating';

/**
 * Main application component for Claude Agent Manager.
 *
 * Manages the complete application lifecycle including:
 * - Initial setup and directory selection
 * - Project validation and resource discovery
 * - Dashboard routing and navigation
 * - State management for all discovered resources
 *
 * This is a stateful component with no props, managing all state internally.
 * State is organized into logical categories: view navigation, directory management,
 * validation progress, discovered resources, and modals.
 *
 * @component
 * @returns {React.ReactElement} The complete application interface
 */
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

  // Flow state
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);
  const [viewingFlowId, setViewingFlowId] = useState<string | null>(null);

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
  const handleViewFlow = (flow: Flow) => {
    setViewingFlowId(flow.id);
    setEditingFlowId(null);
    setIsCreatingFlow(false);
  };

  const handleEditFlow = (flow: Flow) => {
    setEditingFlowId(flow.id);
    setIsCreatingFlow(false);
    setViewingFlowId(null);
  };

  const handleCreateFlow = () => {
    setEditingFlowId(null);
    setIsCreatingFlow(true);
    setViewingFlowId(null);
  };

  const handleCloseFlowEditor = () => {
    setEditingFlowId(null);
    setIsCreatingFlow(false);
  };

  const handleCloseFlowDetail = () => {
    setViewingFlowId(null);
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
    // Handle flow detail view
    if (managerView === ManagerView.Flows && viewingFlowId) {
      return (
        <FlowDetailPage
          flowId={viewingFlowId}
          onBack={handleCloseFlowDetail}
          onEdit={handleEditFlow}
        />
      );
    }

    // Handle flow editor view
    if (managerView === ManagerView.Flows && (isCreatingFlow || editingFlowId)) {
      return (
        <FlowEditorVisual
          flowId={editingFlowId || undefined}
          onClose={handleCloseFlowEditor}
          onSave={handleFlowSaved}
        />
      );
    }

    switch(managerView) {
      case ManagerView.Dashboard:
        return (
          <DashboardPage
            onNavigateToFlows={() => setManagerView(ManagerView.Flows)}
            onNavigateToAgents={() => setManagerView(ManagerView.Agents)}
            onNavigateToSkills={() => setManagerView(ManagerView.Skills)}
          />
        );
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
            onViewFlow={handleViewFlow}
            onEditFlow={handleEditFlow}
            onCreateFlow={handleCreateFlow}
          />
        );
      case ManagerView.Settings:
        return <SettingsPage directoryName={directoryName} onDirectoryChange={handleDirectoryChange} />;
      default:
        return (
          <DashboardPage
            onNavigateToFlows={() => setManagerView(ManagerView.Flows)}
            onNavigateToAgents={() => setManagerView(ManagerView.Agents)}
            onNavigateToSkills={() => setManagerView(ManagerView.Skills)}
          />
        );
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