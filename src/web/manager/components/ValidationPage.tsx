/**
 * ValidationPage - Project Setup Validation Display
 *
 * A status display component that visualizes the validation process for project setup requirements.
 * Shows real-time progress of multiple validation steps with icons, error messages, and retry
 * functionality. Provides clear visual feedback for success, failure, and in-progress states.
 *
 * ## Features
 *
 * - **Step-by-Step Validation**: Displays multiple validation steps with individual status tracking
 * - **Real-Time Status Updates**: Shows loading, success, error states for each validation step
 * - **Visual Status Icons**: Color-coded icons (blue=loading, green=success, red=error, gray=pending)
 * - **Error Message Display**: Shows detailed error messages below failed validation steps
 * - **Success Feedback**: Displays success message when all validations pass
 * - **Retry Functionality**: Provides retry button when validation fails
 * - **Responsive Layout**: Centered card layout with max-width constraint for readability
 * - **Smooth Animations**: Fade-in animation on page load for polished appearance
 *
 * ## Validation Interface
 *
 * The component receives an array of validation steps, each with the following properties:
 *
 * ### ValidationStep Structure
 * - **id**: Unique identifier for the validation step (string)
 * - **label**: Human-readable description displayed to user (e.g., "Checking .claude directory")
 * - **status**: Current validation state - one of:
 *   * `'pending'`: Step has not started yet (gray circle icon)
 *   * `'loading'`: Validation in progress (blue spinner icon)
 *   * `'success'`: Validation passed (green checkmark icon)
 *   * `'error'`: Validation failed (red X icon)
 * - **error**: Optional error message string displayed when status is 'error'
 *
 * ### Validation Flow
 * 1. Parent component initializes steps array with 'pending' status
 * 2. Parent triggers validation process, updating steps to 'loading' status
 * 3. Each step completes and updates to 'success' or 'error' status
 * 4. Component automatically detects completion state (all success or any error)
 * 5. Displays appropriate footer message and retry button if needed
 *
 * ### Status Detection Logic
 * - **All Successful**: When every step has status === 'success'
 * - **Has Error**: When at least one step has status === 'error'
 * - **In Progress**: When some steps are 'loading' (no special footer shown)
 *
 * ## Result Display
 *
 * The component renders different UI states based on validation results:
 *
 * ### Success State (allSuccessful === true)
 * - **Trigger**: All steps have status === 'success'
 * - **Display**: Green checkmark icon + "Validation successful! Loading agents..." message
 * - **Footer**: Success message centered with green text
 * - **Next Action**: Parent typically transitions to next phase (e.g., loading agents)
 * - **No Retry Button**: User cannot retry successful validation
 *
 * ### Error State (hasError === true)
 * - **Trigger**: At least one step has status === 'error'
 * - **Display**: Red error message + "Retry Validation" button
 * - **Footer**: Error message and retry button in vertical stack
 * - **Error Details**: Each failed step shows error message below its label in red text
 * - **Retry Behavior**: Clicking "Retry Validation" invokes onRetry callback
 *
 * ### In-Progress State (neither all successful nor has error)
 * - **Trigger**: Some steps are 'loading' or 'pending', none are 'error'
 * - **Display**: Steps list with spinner icons for loading steps
 * - **Footer**: Empty - no message or button displayed
 * - **User Action**: None - user waits for validation to complete
 *
 * ### Step Visual Feedback
 * - **Pending**: Gray hollow circle, muted gray text (not yet started)
 * - **Loading**: Blue spinning icon, normal text (validation running)
 * - **Success**: Green checkmark icon, normal text (validation passed)
 * - **Error**: Red X icon, normal text + red error message below (validation failed)
 *
 * ## Error Handling
 *
 * The component provides comprehensive error display and recovery mechanisms:
 *
 * ### Error Message Display
 * - **Location**: Error messages appear below the step label, indented with left padding
 * - **Styling**: Small red text (text-sm text-red-400) for visibility
 * - **Conditional**: Only rendered when step.status === 'error' AND step.error is defined
 * - **Content**: Displays step.error string verbatim (e.g., ".claude directory not found")
 * - **Multiline**: Error messages can span multiple lines, wrapping naturally
 *
 * ### Error Examples
 * ```
 * Step: "Checking .claude directory"
 * Error: ".claude directory not found at /Users/name/project"
 *
 * Step: "Validating API connection"
 * Error: "Failed to connect to API server at http://localhost:3000"
 * ```
 *
 * ### Retry Functionality
 * - **Trigger**: "Retry Validation" button appears when hasError === true
 * - **Callback**: Clicking button invokes onRetry() prop function
 * - **Parent Responsibility**: Parent component handles retry logic:
 *   1. Reset all step statuses to 'pending'
 *   2. Clear error messages
 *   3. Re-run validation process
 * - **No Local State**: Component does not manage retry state - purely presentational
 * - **Button Behavior**: Standard primary button, no loading state (parent controls)
 *
 * ### Error Recovery Workflow
 * 1. User sees failed validation step with red X icon and error message
 * 2. User clicks "Retry Validation" button in footer
 * 3. onRetry() callback invoked in parent component
 * 4. Parent resets steps array: steps.map(s => ({ ...s, status: 'pending', error: undefined }))
 * 5. Parent re-triggers validation process
 * 6. Component re-renders with updated steps, showing loading spinners
 *
 * ## Styling Behavior
 *
 * Uses Tailwind CSS with consistent spacing and responsive design:
 *
 * - **Page Container**: `max-w-2xl mx-auto` for centered content (max 672px width)
 * - **Animations**: `animate-fade-in` on page mount for smooth appearance
 * - **Card Layout**: Single Card component with Header, Content, Footer sections
 * - **Typography**:
 *   * Title: `text-2xl text-center` for validation page heading
 *   * Step Labels: Default text size, muted when status is 'pending'
 *   * Error Messages: `text-sm text-red-400` for error feedback
 *   * Success Message: `text-green-400 font-medium` for success state
 * - **Spacing**:
 *   * Steps List: `space-y-4` for vertical spacing between steps
 *   * Step Items: `p-3` padding within each step container
 *   * Icon Spacing: `space-x-4` between icon and label
 *   * Footer Gap: `gap-4` between error message and retry button
 * - **Step Items**:
 *   * Background: `bg-secondary` for subtle container background
 *   * Borders: `rounded-lg` for smooth corners
 *   * Layout: Flexbox column for label and error message stacking
 * - **Icons**: Fixed size `h-6 w-6` for all status icons
 * - **Responsive**: Works on mobile and desktop with flex layouts
 *
 * @example
 * // Basic usage in ManagerApp initialization phase
 * function ManagerApp() {
 *   const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([
 *     { id: 'claude-dir', label: 'Checking .claude directory', status: 'pending' },
 *     { id: 'config', label: 'Validating configuration', status: 'pending' },
 *     { id: 'api', label: 'Testing API connection', status: 'pending' }
 *   ]);
 *
 *   const runValidation = async () => {
 *     // Validate .claude directory
 *     setValidationSteps(prev => prev.map(s =>
 *       s.id === 'claude-dir' ? { ...s, status: 'loading' } : s
 *     ));
 *     const dirExists = await checkClaudeDirectory();
 *     setValidationSteps(prev => prev.map(s =>
 *       s.id === 'claude-dir'
 *         ? { ...s, status: dirExists ? 'success' : 'error', error: dirExists ? undefined : '.claude directory not found' }
 *         : s
 *     ));
 *
 *     // Continue with other validations...
 *   };
 *
 *   const handleRetry = () => {
 *     setValidationSteps(prev => prev.map(s => ({ ...s, status: 'pending', error: undefined })));
 *     runValidation();
 *   };
 *
 *   return <ValidationPage steps={validationSteps} onRetry={handleRetry} />;
 * }
 *
 * @example
 * // Understanding validation lifecycle
 * // Initial State:
 * // [
 * //   { id: '1', label: 'Check directory', status: 'pending' },
 * //   { id: '2', label: 'Check config', status: 'pending' }
 * // ]
 * // → Displays two gray circles, no footer
 *
 * // During Validation:
 * // [
 * //   { id: '1', label: 'Check directory', status: 'success' },
 * //   { id: '2', label: 'Check config', status: 'loading' }
 * // ]
 * // → Green checkmark for step 1, blue spinner for step 2, no footer
 *
 * // All Success:
 * // [
 * //   { id: '1', label: 'Check directory', status: 'success' },
 * //   { id: '2', label: 'Check config', status: 'success' }
 * // ]
 * // → Two green checkmarks, success message in footer
 *
 * // Validation Error:
 * // [
 * //   { id: '1', label: 'Check directory', status: 'success' },
 * //   { id: '2', label: 'Check config', status: 'error', error: 'Invalid config.json format' }
 * // ]
 * // → Green checkmark for step 1, red X + error message for step 2, retry button in footer
 *
 * @example
 * // Error handling with retry workflow
 * function ValidationContainer() {
 *   const [steps, setSteps] = useState([
 *     { id: 'api', label: 'Testing API connection', status: 'pending' as const }
 *   ]);
 *
 *   const validateAPI = async () => {
 *     setSteps([{ id: 'api', label: 'Testing API connection', status: 'loading' }]);
 *     try {
 *       await fetch('/api/health');
 *       setSteps([{ id: 'api', label: 'Testing API connection', status: 'success' }]);
 *     } catch (error) {
 *       setSteps([{
 *         id: 'api',
 *         label: 'Testing API connection',
 *         status: 'error',
 *         error: 'Failed to connect to API server. Please check if the server is running.'
 *       }]);
 *     }
 *   };
 *
 *   const handleRetry = () => {
 *     setSteps([{ id: 'api', label: 'Testing API connection', status: 'pending' }]);
 *     validateAPI();
 *   };
 *
 *   return <ValidationPage steps={steps} onRetry={handleRetry} />;
 * }
 *
 * @example
 * // Multiple validation steps with sequential execution
 * async function runSequentialValidation(setSteps: (updater: (prev: ValidationStep[]) => ValidationStep[]) => void) {
 *   const updateStep = (id: string, status: ValidationStep['status'], error?: string) => {
 *     setSteps(prev => prev.map(s => s.id === id ? { ...s, status, error } : s));
 *   };
 *
 *   // Step 1: Check directory
 *   updateStep('dir', 'loading');
 *   const dirExists = await checkDirectory();
 *   updateStep('dir', dirExists ? 'success' : 'error', dirExists ? undefined : 'Directory not found');
 *   if (!dirExists) return; // Stop on error
 *
 *   // Step 2: Check config
 *   updateStep('config', 'loading');
 *   const configValid = await validateConfig();
 *   updateStep('config', configValid ? 'success' : 'error', configValid ? undefined : 'Invalid configuration');
 *   if (!configValid) return; // Stop on error
 *
 *   // Step 3: Test API
 *   updateStep('api', 'loading');
 *   const apiConnected = await testAPI();
 *   updateStep('api', apiConnected ? 'success' : 'error', apiConnected ? undefined : 'API connection failed');
 * }
 */
import React from 'react';
import type { ValidationStep } from '../types';
import { CheckCircleIcon, XCircleIcon, SpinnerIcon } from './ui/Icons';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/Card';
import { Button } from './ui/Button';

/**
 * Props for the ValidationPage component.
 *
 * @property {ValidationStep[]} steps - Array of validation steps to display. Each step represents a validation task with id, label, status, and optional error message. Status can be 'pending' (not started), 'loading' (in progress), 'success' (passed), or 'error' (failed). Parent component is responsible for updating step statuses as validation progresses.
 * @property {function} onRetry - Callback invoked when user clicks "Retry Validation" button. Should reset all steps to 'pending' status, clear error messages, and re-run the validation process. Only displayed when at least one step has status === 'error'.
 */
interface ValidationPageProps {
  steps: ValidationStep[];
  onRetry: () => void;
}

/**
 * Returns the appropriate icon component based on validation step status.
 *
 * Maps each status to a colored icon:
 * - 'loading': Blue spinning icon (SpinnerIcon) indicating validation in progress
 * - 'success': Green checkmark icon (CheckCircleIcon) indicating validation passed
 * - 'error': Red X icon (XCircleIcon) indicating validation failed
 * - 'pending' (default): Gray hollow circle indicating step not yet started
 *
 * All icons are fixed size (h-6 w-6) for visual consistency. Color scheme follows
 * standard semantic colors: blue=active, green=success, red=error, gray=neutral.
 *
 * @param {ValidationStep['status']} status - Current status of the validation step
 * @returns {JSX.Element} Icon component representing the status
 *
 * @internal
 */
const getStatusIcon = (status: ValidationStep['status']) => {
  switch (status) {
    case 'loading':
      return <SpinnerIcon className="h-6 w-6 text-blue-400" />;
    case 'success':
      return <CheckCircleIcon className="h-6 w-6 text-green-400" />;
    case 'error':
      return <XCircleIcon className="h-6 w-6 text-red-400" />;
    default:
      return <div className="h-6 w-6 rounded-full border-2 border-muted-foreground" />;
  }
};

const ValidationPage: React.FC<ValidationPageProps> = ({ steps, onRetry }) => {
  const allSuccessful = steps.every(step => step.status === 'success');
  const hasError = steps.some(step => step.status === 'error');

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-fade-in">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Validating Project Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {steps.map((step) => (
              <li key={step.id} className="flex flex-col p-3 bg-secondary rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>{getStatusIcon(step.status)}</div>
                  <span className={`flex-1 ${step.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                    {step.label}
                  </span>
                </div>
                {step.status === 'error' && step.error && (
                  <p className="mt-2 text-sm text-red-400 pl-10">{step.error}</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex-col pt-4">
          {allSuccessful && (
            <div className="text-center text-green-400 font-medium flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 mr-2"/>
              Validation successful! Loading agents...
            </div>
          )}
          {hasError && (
              <div className="text-center flex flex-col items-center gap-4">
                <p className="text-red-400">Validation failed. Please resolve the issues and try again.</p>
                <Button onClick={onRetry}>Retry Validation</Button>
              </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

ValidationPage.displayName = 'ValidationPage';

export default ValidationPage;
