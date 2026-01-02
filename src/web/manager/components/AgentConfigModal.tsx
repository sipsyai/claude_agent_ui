/**
 * @file AgentConfigModal.tsx
 * @description Modal component for configuring and running agents with dynamic form generation,
 * field validation, and execution status feedback.
 *
 * ## Features
 * - Dynamic form generation based on agent input schema
 * - Support for multiple input types (text, textarea, select, file, number)
 * - Real-time field validation with error messages
 * - Required field enforcement with visual indicators
 * - Agent execution with loading states
 * - Color-coded success/error result display
 * - Form state reset on close
 *
 * ## Agent Configuration Form
 * The component dynamically generates form fields based on the agent's `inputs` property:
 * - Each input field created from `AgentInput` schema
 * - Initial form state populated with `defaultValue` from schema
 * - Form fields rendered based on input `type` property
 * - Labels generated from input `description` property
 * - Required fields marked with red asterisk (*)
 *
 * ### Supported Input Types
 * 1. **text** (default): Single-line text input with placeholder
 * 2. **textarea**: Multi-line text input for longer content
 * 3. **select**: Dropdown with options from input schema
 * 4. **file**: File upload input
 * 5. **number**: Numeric input with type="number"
 *
 * ## Validation
 * The component implements client-side validation:
 * - **Required Field Validation**: Checks all fields marked as `required: true`
 * - **Inline Error Display**: Shows error message below invalid field with red border
 * - **Real-time Error Clearing**: Errors cleared as user types in field
 * - **Pre-submit Validation**: All required fields validated before execution
 * - **Validation Feedback**: Red border and error text for invalid fields
 *
 * Validation workflow:
 * 1. User clicks "Run Agent" button
 * 2. `handleRunAgent` checks all required fields
 * 3. If validation fails, errors set and execution prevented
 * 4. If validation passes, agent execution begins
 *
 * ## Save Behavior
 * The component handles agent execution (not just configuration save):
 * 1. User fills out form fields
 * 2. User clicks "Run Agent" button
 * 3. Form validated for required fields
 * 4. If valid, execution status set to 'loading'
 * 5. Agent execution simulated (2-second delay) - **TODO: Replace with actual API call**
 * 6. Execution result displayed with success/error status
 * 7. Result shown with color-coded message (green=success, red=error)
 *
 * ### Execution States
 * - **idle**: Initial state, no execution attempted
 * - **loading**: Agent execution in progress, button disabled with spinner
 * - **success**: Execution completed successfully, green checkmark displayed
 * - **error**: Execution failed, red X icon displayed
 *
 * ## Form State Management
 * The component maintains several state variables:
 * - **formState**: Object mapping input names to current values
 * - **errors**: Object mapping input names to validation error messages
 * - **executionStatus**: Current execution state (idle/loading/success/error)
 * - **executionResult**: Result message text to display to user
 *
 * State is reset when modal closes via `handleClose`:
 * - Form state reset to initial values (default values from schema)
 * - All errors cleared
 * - Execution status reset to 'idle'
 * - Execution result cleared
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS for styling:
 * - Dialog with max-width of 625px on small screens and up
 * - Form fields in grid layout with gap-4 spacing
 * - Scrollable form area with max-height 60vh
 * - Error borders: border-red-500 on invalid fields
 * - Success result: bg-green-900/50 with green-300 text
 * - Error result: bg-red-900/50 with red-300 text
 * - Required field indicator: red-400 asterisk
 * - Dialog footer with Cancel and Run Agent buttons
 *
 * @example
 * // Basic usage with agent execution
 * const [showConfig, setShowConfig] = useState(false);
 * const agent = {
 *   name: "Data Processor",
 *   description: "Process CSV files and generate reports",
 *   inputs: [
 *     { name: "file", type: "file", description: "CSV File", required: true },
 *     { name: "format", type: "select", description: "Output Format", options: ["JSON", "XML"], defaultValue: "JSON" }
 *   ]
 * };
 *
 * <AgentConfigModal
 *   agent={agent}
 *   isOpen={showConfig}
 *   onClose={() => setShowConfig(false)}
 * />
 *
 * @example
 * // Run agent from list with validation
 * const agents = [...]; // array of Agent objects
 * const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
 *
 * function AgentList() {
 *   return (
 *     <div>
 *       {agents.map(agent => (
 *         <button key={agent.id} onClick={() => setSelectedAgent(agent)}>
 *           Run {agent.name}
 *         </button>
 *       ))}
 *       {selectedAgent && (
 *         <AgentConfigModal
 *           agent={selectedAgent}
 *           isOpen={!!selectedAgent}
 *           onClose={() => setSelectedAgent(null)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 *
 * @example
 * // Understanding input field types and validation
 * const complexAgent = {
 *   name: "Content Generator",
 *   description: "Generate content based on parameters",
 *   inputs: [
 *     { name: "topic", type: "text", description: "Topic", required: true }, // Red asterisk, validated
 *     { name: "length", type: "number", description: "Word Count", defaultValue: 500 },
 *     { name: "tone", type: "select", description: "Tone", options: ["Formal", "Casual"], required: true },
 *     { name: "context", type: "textarea", description: "Additional Context" } // Optional, no validation
 *   ]
 * };
 * // Required fields (topic, tone) will show error if empty on submit
 * // Optional fields (length, context) will not be validated
 *
 * @example
 * // Handle execution success/error feedback
 * // Success: Green background with CheckCircleIcon and success message
 * // Error: Red background with XCircleIcon and error message
 * // Loading: Spinner icon on "Run Agent" button, button disabled
 * <AgentConfigModal agent={agent} isOpen={true} onClose={handleClose} />
 * // User will see:
 * // - Loading: "Run Agent" button with spinner, disabled state
 * // - Success: "✓ Agent 'Name' ran successfully. Output has been generated."
 * // - Error: "✗ Agent 'Name' failed to run. Please check the logs."
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Agent, AgentInput } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import { SpinnerIcon, CheckCircleIcon, XCircleIcon } from './ui/Icons';

/**
 * Props for the AgentConfigModal component
 */
interface AgentConfigModalProps {
  /** The agent to configure and execute */
  agent: Agent;
  /** Controls whether the modal is visible */
  isOpen: boolean;
  /** Callback invoked when modal should close */
  onClose: () => void;
}

/**
 * Type for tracking agent execution status
 * - idle: No execution in progress
 * - loading: Agent is currently executing
 * - success: Agent execution completed successfully
 * - error: Agent execution failed
 */
type ExecutionStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Modal component for configuring and running agents with dynamic form generation and validation
 */
const AgentConfigModal: React.FC<AgentConfigModalProps> = ({ agent, isOpen, onClose }) => {
  // Memoized initial form state from agent input schema
  const initialFormState = useMemo(() =>
    agent.inputs.reduce((acc, input) => {
      acc[input.name] = input.defaultValue ?? '';
      return acc;
    }, {} as Record<string, any>),
  [agent.inputs]);

  const [formState, setFormState] = useState<Record<string, any>>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const [executionResult, setExecutionResult] = useState<string>('');

  /**
   * Handles input field value changes and clears validation errors
   *
   * @internal
   * @param name - Name of the input field being changed
   * @param value - New value for the field (string for text/select/number, File for file inputs)
   *
   * Behavior:
   * 1. Updates formState with new value for the specified field
   * 2. If field has validation error, clears it immediately (real-time error clearing)
   * 3. Allows user to see error disappear as they correct the issue
   */
  const handleInputChange = (name: string, value: string | File) => {
    setFormState(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  /**
   * Renders appropriate input component based on input type from schema
   *
   * @internal
   * @param input - AgentInput schema object defining field properties
   * @returns React element for the input field with label and error display
   *
   * Supported input types:
   * - textarea: Multi-line text input using Textarea component
   * - select: Dropdown using Select component with options from schema
   * - file: File upload input using Input component with type="file"
   * - number: Numeric input using Input component with type="number"
   * - text (default): Single-line text input using Input component
   *
   * All inputs include:
   * - Label with description and required indicator (red asterisk)
   * - Error border (border-red-500) if validation error exists
   * - Error message below field in red text
   * - onChange handler calling handleInputChange
   */
  const renderInput = (input: AgentInput) => {
    const value = formState[input.name];
    const error = errors[input.name];

    const label = (
      <label htmlFor={input.name} className="block text-sm font-medium text-muted-foreground mb-1">
        {input.description}
        {input.required && <span className="text-red-400 ml-1">*</span>}
      </label>
    );

    switch (input.type) {
      case 'textarea':
        return (
          <div key={input.name}>
            {label}
            <Textarea
              id={input.name}
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              placeholder={`Enter ${input.name}...`}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'select':
        return (
          <div key={input.name}>
            {label}
            <Select
              id={input.name}
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              className={error ? 'border-red-500' : ''}
            >
              {input.options?.map(option => <option key={option} value={option}>{option}</option>)}
            </Select>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'file':
        return (
          <div key={input.name}>
            {label}
            <Input
              id={input.name}
              type="file"
              onChange={(e) => handleInputChange(input.name, e.target.files?.[0] || '')}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'number':
         return (
          <div key={input.name}>
            {label}
            <Input
              id={input.name}
              type="number"
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              placeholder={`Enter ${input.name}...`}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
      case 'text':
      default:
        return (
          <div key={input.name}>
            {label}
            <Input
              id={input.name}
              type="text"
              value={value}
              onChange={(e) => handleInputChange(input.name, e.target.value)}
              placeholder={`Enter ${input.name}...`}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
    }
  };

  /**
   * Validates form and executes the agent
   *
   * @internal
   *
   * Execution workflow:
   * 1. **Validation Phase**: Checks all required fields for values
   *    - Iterates through agent.inputs array
   *    - For each input marked as required, checks if formState has value
   *    - Builds newErrors object with error messages for empty required fields
   *    - If any errors found, sets errors state and exits early (no execution)
   * 2. **Execution Phase**: If validation passes
   *    - Sets executionStatus to 'loading' (disables button, shows spinner)
   *    - Clears any previous executionResult
   *    - Simulates API call with 2-second delay - **TODO: Replace with actual API call**
   *    - Randomly determines success (85% chance) or error (15% chance)
   * 3. **Result Phase**: Updates UI with execution result
   *    - Success: Sets executionStatus to 'success', shows green success message
   *    - Error: Sets executionStatus to 'error', shows red error message
   *
   * Dependencies: [agent, formState] - Re-creates callback if agent or form values change
   */
  const handleRunAgent = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    agent.inputs.forEach(input => {
      if (input.required && !formState[input.name]) {
        newErrors[input.name] = `${input.name} is required.`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setExecutionStatus('loading');
    setExecutionResult('');
    await new Promise(res => setTimeout(res, 2000)); // Simulate API call

    // Simulate success/error
    if (Math.random() > 0.15) {
      setExecutionStatus('success');
      setExecutionResult(`Agent "${agent.name}" ran successfully. Output has been generated.`);
    } else {
      setExecutionStatus('error');
      setExecutionResult(`Agent "${agent.name}" failed to run. Please check the logs.`);
    }
  }, [agent, formState]);

  /**
   * Resets form state and closes modal
   *
   * @internal
   *
   * Reset workflow:
   * 1. Resets formState to initialFormState (default values from schema)
   * 2. Clears all validation errors
   * 3. Resets executionStatus to 'idle'
   * 4. Clears executionResult message
   * 5. Calls onClose callback to notify parent component
   *
   * This ensures clean state when modal reopens - no stale data from previous session
   */
  const handleClose = () => {
    setFormState(initialFormState);
    setErrors({});
    setExecutionStatus('idle');
    setExecutionResult('');
    onClose();
  };

  /**
   * Renders execution result message with color-coded styling
   *
   * @internal
   * @returns React element for result display, or null if no result to show
   *
   * Result display by status:
   * - **idle**: Returns null (no result to display)
   * - **loading**: Returns null (spinner shown on button instead)
   * - **success**: Green background (bg-green-900/50) with CheckCircleIcon and success message
   * - **error**: Red background (bg-red-900/50) with XCircleIcon and error message
   *
   * Result styling:
   * - Flexbox layout with icon and message text
   * - Icon positioned at top with flex-shrink-0 to prevent squashing
   * - Rounded corners (rounded-md) and padding (p-4)
   * - Margin top (mt-4) to separate from form fields
   */
  const renderResult = () => {
    if (executionStatus === 'idle') return null;

    const baseClasses = "mt-4 p-4 rounded-md text-sm flex items-start space-x-3";
    
    if (executionStatus === 'success') {
      return (
        <div className={`${baseClasses} bg-green-900/50 text-green-300`}>
          <CheckCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p>{executionResult}</p>
        </div>
      );
    }

    if (executionStatus === 'error') {
      return (
        <div className={`${baseClasses} bg-red-900/50 text-red-300`}>
          <XCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p>{executionResult}</p>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{agent.name}</DialogTitle>
          <DialogDescription>{agent.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-3">
          {agent.inputs.map(renderInput)}
        </div>
        {renderResult()}
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleRunAgent} disabled={executionStatus === 'loading'}>
            {executionStatus === 'loading' && <SpinnerIcon className="h-4 w-4 mr-2" />}
            Run Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

AgentConfigModal.displayName = 'AgentConfigModal';

export default AgentConfigModal;
   