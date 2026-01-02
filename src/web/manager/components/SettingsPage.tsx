/**
 * SettingsPage - Manager Settings Configuration
 *
 * A comprehensive settings page component for configuring Claude Manager preferences including
 * project directory and training agent selection. Provides form-based configuration with
 * real-time validation, API integration, and persistent state management.
 *
 * ## Features
 *
 * - **Project Directory Configuration**: Set or update the project directory path
 * - **Training Agent Selection**: Choose which agent to use for skill training
 * - **Local Fallback Mode**: Option to use local training-agent.md instead of database agent
 * - **Form Validation**: Real-time input validation with field-level error feedback
 * - **API Integration**: Automatic loading and saving of configuration via REST APIs
 * - **Loading States**: Loading indicators during data fetch and save operations
 * - **Success/Error Feedback**: User notifications via alert dialogs
 * - **Responsive Layout**: Mobile-friendly card-based layout with auto-resizing inputs
 *
 * ## Settings Form
 *
 * The page is organized into two main configuration sections using Card components:
 *
 * ### Project Directory Section
 * - **Input Field**: Text input for directory path (supports absolute paths or empty for CWD)
 * - **Current Directory Display**: Shows currently active directory below input
 * - **Placeholder**: Helpful example path format (e.g., /path/to/your/project)
 * - **Save Button**: Triggers `onDirectoryChange` callback with new directory path
 * - **Auto-population**: Pre-fills input with `directoryName` prop on mount
 *
 * ### Training Agent Configuration Section
 * - **Fallback Checkbox**: Toggle between local training-agent.md and database agent
 * - **Agent Dropdown**: Select from list of available agents (hidden when fallback enabled)
 * - **Agent List**: Loaded from Strapi via `/api/strapi/agents` on mount
 * - **Selection Preview**: Shows selected agent name or fallback message
 * - **Info Panel**: Blue info box explaining local fallback behavior when enabled
 * - **Save Button**: Saves training agent config via API (disabled during save or invalid state)
 *
 * ## Preference Handling
 *
 * Manages two types of preferences with different persistence mechanisms:
 *
 * ### Project Directory Preference
 * - **State**: Stored in `inputValue` state (synced with `directoryName` prop)
 * - **Change Handling**: Updates `inputValue` on every keystroke via `setInputValue`
 * - **Save Workflow**: Invokes `onDirectoryChange` callback → parent updates → prop change
 * - **Persistence**: Managed by parent component (typically localStorage in ManagerApp)
 * - **Validation**: Accepts any string value (empty string = current working directory)
 *
 * ### Training Agent Preference
 * - **State**: Stored in `selectedAgentId` and `useLocalFallback` states
 * - **Initial Load**: Fetched from `/api/manager/training-agent-config` via `loadData()`
 * - **Change Handling**: Updates local state immediately on user interaction
 * - **Save Workflow**: Sends PUT request to `/api/manager/training-agent-config` with agentId
 * - **Persistence**: Stored server-side (typically in JSON file or database)
 * - **Fallback Logic**: If `useLocalFallback` is true, agentId is set to null on save
 *
 * ## Save Behavior
 *
 * Two independent save operations with different workflows:
 *
 * ### Project Directory Save (handleSave)
 * 1. User clicks "Save Changes" button
 * 2. Invokes `onDirectoryChange(inputValue)` callback
 * 3. Parent component handles persistence (typically to localStorage)
 * 4. No loading state or API call (synchronous callback)
 * 5. No success/error feedback displayed
 *
 * ### Training Agent Save (handleTrainingAgentSave)
 * 1. User clicks "Save Training Agent" button (disabled if invalid state)
 * 2. Sets `saving` state to true (button shows "Saving..." text)
 * 3. Determines agentId: null if fallback enabled, selectedAgentId otherwise
 * 4. Sends PUT request to `/api/manager/training-agent-config` with JSON body
 * 5. On success: Shows alert "Training agent configuration saved successfully!"
 * 6. On error: Shows alert "Failed to save training agent configuration"
 * 7. Sets `saving` state to false (re-enables button)
 *
 * ### Save Button States
 * - **Project Directory**: Always enabled (no validation required)
 * - **Training Agent**: Disabled when `saving` or when `!useLocalFallback && !selectedAgentId`
 *
 * ## Form State Management
 *
 * Five key state variables manage form behavior:
 *
 * - **inputValue**: Directory path input value (string)
 * - **agents**: Array of available agents loaded from Strapi (Agent[])
 * - **selectedAgentId**: Currently selected agent ID (string)
 * - **useLocalFallback**: Whether to use local training-agent.md (boolean)
 * - **loading**: Loading state during initial data fetch (boolean)
 * - **saving**: Saving state during training agent save operation (boolean)
 *
 * State update triggers:
 * - `inputValue`: Updates on every keystroke in directory input
 * - `agents`: Loaded once on mount via useEffect
 * - `selectedAgentId`: Updates on dropdown selection change
 * - `useLocalFallback`: Updates on checkbox toggle
 * - `loading`: True during initial data fetch, false after completion
 * - `saving`: True during save API call, false after completion
 *
 * ## API Integration
 *
 * Three API endpoints used for configuration management:
 *
 * ### GET /api/manager/training-agent-config
 * - **Purpose**: Load current training agent configuration
 * - **Timing**: Called on component mount via useEffect
 * - **Response**: TrainingAgentConfig object { trainingAgentId, fallbackToLocal }
 * - **Success**: Updates `selectedAgentId` and `useLocalFallback` states
 * - **Error**: Logs to console, continues with default states (empty agent, fallback enabled)
 *
 * ### GET /api/strapi/agents
 * - **Purpose**: Load list of available agents from database
 * - **Timing**: Called on component mount via useEffect
 * - **Response**: { data: Agent[] } with agent objects containing id, name, description
 * - **Success**: Updates `agents` state for dropdown population
 * - **Error**: Logs to console, continues with empty agents array
 *
 * ### PUT /api/manager/training-agent-config
 * - **Purpose**: Save training agent configuration
 * - **Timing**: Called when user clicks "Save Training Agent" button
 * - **Request**: JSON body { agentId: string | null }
 * - **Success**: Shows success alert dialog
 * - **Error**: Shows error alert dialog, logs to console
 *
 * ## UI States
 *
 * Four distinct UI states affect the component appearance:
 *
 * ### Default State
 * - All form fields enabled and editable
 * - "Save Changes" button enabled for directory
 * - "Save Training Agent" button enabled if valid selection
 * - Agent dropdown visible when fallback disabled
 *
 * ### Loading State (initial data fetch)
 * - `loading === true` during API calls in useEffect
 * - Training Agent section shows: "Loading..." centered text
 * - Directory section remains functional (no dependency on API data)
 * - Lasts until both API calls complete (or fail)
 *
 * ### Saving State (training agent save)
 * - `saving === true` during PUT request
 * - "Save Training Agent" button shows "Saving..." text
 * - Button disabled to prevent duplicate requests
 * - All form fields remain editable
 *
 * ### Fallback Enabled State
 * - `useLocalFallback === true`
 * - Agent dropdown hidden (not rendered)
 * - Blue info panel displayed explaining local fallback behavior
 * - Save button enabled regardless of agent selection
 *
 * ## Styling Behavior
 *
 * Uses Tailwind CSS with dark theme support and responsive design:
 *
 * - **Page Container**: `max-w-4xl mx-auto` for centered content (max 896px width)
 * - **Animations**: `animate-fade-in` on page mount for smooth appearance
 * - **Typography**:
 *   * Title: `text-3xl sm:text-4xl font-bold` (responsive sizing)
 *   * Labels: `text-sm font-medium` for form field labels
 *   * Descriptions: `text-muted-foreground` for secondary text
 *   * Info Text: `text-xs text-muted-foreground` for hints below inputs
 * - **Spacing**:
 *   * Vertical: `space-y-4` for form field stacks
 *   * Card Gap: `mt-6` between Project Directory and Training Agent cards
 *   * Section Margin: `mb-8` below page description
 * - **Cards**: Card component with CardHeader, CardTitle, CardDescription, CardContent sections
 * - **Info Panel**: Blue background (`bg-blue-50 border-blue-200 text-blue-800`) with rounded corners
 * - **Inputs**: Full width (`w-full`) with Input and select components
 * - **Buttons**: Primary variant for save actions, disabled state with reduced opacity
 *
 * @example
 * // Basic usage in ManagerApp dashboard phase
 * function ManagerApp() {
 *   const [directory, setDirectory] = useState(() => {
 *     return localStorage.getItem('directory') || '';
 *   });
 *
 *   const handleDirectoryChange = (newDirectory: string) => {
 *     setDirectory(newDirectory);
 *     localStorage.setItem('directory', newDirectory);
 *   };
 *
 *   return (
 *     <Layout>
 *       <SettingsPage
 *         directoryName={directory}
 *         onDirectoryChange={handleDirectoryChange}
 *       />
 *     </Layout>
 *   );
 * }
 *
 * @example
 * // Understanding training agent workflow
 * // 1. User opens Settings page
 * // 2. Component loads current config from API:
 * //    GET /api/manager/training-agent-config
 * //    Response: { trainingAgentId: "123", fallbackToLocal: false }
 * // 3. Component loads available agents from Strapi:
 * //    GET /api/strapi/agents
 * //    Response: { data: [{ id: "123", name: "GPT Trainer", description: "..." }] }
 * // 4. User unchecks "Use local fallback" checkbox
 * // 5. Agent dropdown appears with agent list
 * // 6. User selects different agent from dropdown
 * // 7. User clicks "Save Training Agent" button
 * // 8. Component sends: PUT /api/manager/training-agent-config
 * //    Body: { agentId: "456" }
 * // 9. Success alert: "Training agent configuration saved successfully!"
 *
 * @example
 * // Understanding local fallback mode
 * function TrainingAgentBehavior() {
 *   // When useLocalFallback is true:
 *   // - Agent dropdown is hidden (not rendered)
 *   // - Blue info panel explains local behavior
 *   // - On save: agentId is set to null
 *   // - Training uses .claude/agents/training-agent.md file
 *
 *   // When useLocalFallback is false:
 *   // - Agent dropdown is visible
 *   // - User must select an agent to enable save button
 *   // - On save: agentId is set to selectedAgentId
 *   // - Training uses selected database agent
 *
 *   return (
 *     <SettingsPage
 *       directoryName="/my/project"
 *       onDirectoryChange={(dir) => console.log('New directory:', dir)}
 *     />
 *   );
 * }
 *
 * @example
 * // Directory path handling
 * // Empty path = current working directory
 * const emptyPath = ''; // Uses CWD
 * // Absolute path = specific project directory
 * const absolutePath = '/Users/name/projects/myapp';
 * // Relative path = relative to CWD
 * const relativePath = './myapp';
 * // Display: "Current: {directoryName || 'Current working directory'}"
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

/**
 * Props for the SettingsPage component.
 *
 * @property {string} [directoryName] - Optional current project directory path. Pre-fills the directory input field. If empty or undefined, displays "Current working directory" as fallback. Typically comes from localStorage in parent component.
 * @property {function} onDirectoryChange - Callback invoked when user saves directory changes. Receives new directory path as parameter. Parent should handle persistence (e.g., localStorage) and state updates.
 */
interface SettingsPageProps {
  directoryName?: string;
  onDirectoryChange: (directory: string) => void;
}

/**
 * Agent interface representing a training agent from Strapi database.
 *
 * @property {string} id - Unique agent identifier from Strapi
 * @property {string} name - Agent display name shown in dropdown
 * @property {string} [description] - Optional agent description appended in dropdown (format: "name - description")
 */
interface Agent {
  id: string;
  name: string;
  description?: string;
}

/**
 * Training agent configuration interface.
 *
 * @property {string | null} trainingAgentId - ID of selected training agent from Strapi, or null if using local fallback
 * @property {boolean} fallbackToLocal - Whether to use local training-agent.md file instead of database agent
 */
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

  /**
   * Handles saving the project directory preference.
   *
   * Invokes the onDirectoryChange callback with the current input value. Parent component
   * is responsible for persisting the directory path (typically to localStorage) and updating
   * its own state. No loading state or API call is involved - this is a synchronous callback.
   *
   * @internal
   */
  const handleSave = () => {
    onDirectoryChange(inputValue);
  };

  /**
   * Loads training agent configuration and available agents on component mount.
   *
   * Fetches data from two API endpoints in parallel:
   * 1. GET /api/manager/training-agent-config - Current training agent config
   * 2. GET /api/strapi/agents - List of available agents from database
   *
   * On success, updates selectedAgentId, useLocalFallback, and agents states.
   * On error, logs to console and continues with default states (empty agent, fallback enabled).
   * Sets loading state to true during fetch, false after completion.
   *
   * @internal
   */
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

  /**
   * Handles saving the training agent configuration.
   *
   * Determines the agent ID based on local fallback preference:
   * - If useLocalFallback is true: agentId = null (use local training-agent.md)
   * - If useLocalFallback is false: agentId = selectedAgentId (use database agent)
   *
   * Sends PUT request to /api/manager/training-agent-config with the determined agentId.
   * Shows success alert on successful save, error alert on failure.
   * Sets saving state to true during request, false after completion.
   * Button is disabled during save to prevent duplicate requests.
   *
   * @internal
   */
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

SettingsPage.displayName = 'SettingsPage';

export default SettingsPage;
