/**
 * @file LandingPage.tsx
 * @description Project directory selection page in the Claude Agent Manager setup workflow.
 * Allows users to specify the path to their Claude Agent project directory for validation and configuration.
 * This is the second step in the setup process, following the HomePage welcome screen.
 *
 * ## Features
 * - **Directory Path Input**: Text input with monospace font for entering full directory paths
 * - **Auto-Population**: Automatically loads directory from localStorage if previously selected
 * - **Real-Time Validation**: Updates directory selection state as user types
 * - **Example Guidance**: Shows example directory path format with inline code styling
 * - **Navigation Controls**: Next button (disabled until valid directory) and Back button
 * - **Responsive Layout**: Mobile-first centered column layout with breakpoints
 * - **Animated Entry**: Fade-in animation on component mount
 * - **Visual Feedback**: Disabled state on Next button until directory is entered
 *
 * ## Layout Structure
 * The LandingPage uses a centered column layout with four main sections:
 *
 * ### 1. Hero Section
 * - **Title**: "Select Your Project" with responsive typography (3xl mobile, 4xl tablet, 5xl desktop)
 * - **Font Weight**: Bold (700) with tight tracking for emphasis
 * - **Color**: text-foreground for high contrast
 * - **Spacing**: Centered alignment with items-center
 *
 * ### 2. Description Section
 * - **Content**: Explanation of directory selection purpose and automatic scanning behavior
 * - **Typography**: lg (18px) text size for readability
 * - **Color**: text-muted-foreground for subtle contrast
 * - **Max Width**: 2xl (42rem) for optimal reading line length
 * - **Spacing**: mt-4 (16px) gap from title
 *
 * ### 3. Form Section
 * - **Label**: "Project Directory Path" with left-aligned text-sm font-medium
 * - **Input**: Input component with monospace font for path display
 * - **Placeholder**: Windows-style path example (C:/Users/...)
 * - **Example Text**: Inline code block showing actual project path format
 * - **Spacing**: mt-10 (40px) gap from description, space-y-4 for internal gaps
 * - **Width**: max-w-2xl (42rem) for comfortable form width
 *
 * ### 4. Navigation Section
 * - **Next Button**: Large primary button with ArrowRightIcon, disabled until directorySelected is true
 * - **Info Text**: Explanation about .claude folder lookup (mt-6, text-sm)
 * - **Back Button**: Secondary small button with ArrowLeftIcon (mt-8)
 * - **Responsive Buttons**: Column layout on mobile, row layout on tablet+ (sm:flex-row)
 *
 * ## Directory Selection
 * The component handles directory selection through a controlled input pattern:
 *
 * ### Input Handling
 * 1. **User types in input field** - handlePathChange is invoked
 * 2. **Input value updates local state** - setPathInput updates pathInput
 * 3. **Value is trimmed** - Whitespace is removed before processing
 * 4. **Callback is invoked** - onDirectoryChange is called with trimmed path if non-empty
 * 5. **Parent component updates state** - ManagerApp validates and sets directorySelected flag
 * 6. **Next button enables** - Button becomes clickable when directorySelected is true
 *
 * ### Path Validation
 * - **Trimming**: All paths are trimmed before processing to remove accidental whitespace
 * - **Non-Empty Check**: Only non-empty trimmed strings trigger onDirectoryChange callback
 * - **Real-Time Updates**: Directory change callback fires on every keystroke (after trimming)
 * - **Parent Validation**: Actual validation logic is handled by parent component (ManagerApp)
 *
 * ## Auto-Population
 * The component automatically loads the directory from localStorage on mount:
 *
 * ### useEffect Hook
 * - **Trigger**: Runs when directoryName prop changes
 * - **Condition**: Only fires if directoryName is truthy and non-empty after trimming
 * - **Behavior**: Calls onDirectoryChange with the directoryName value
 * - **Purpose**: Restores previously selected directory from ManagerApp's localStorage
 * - **Dependencies**: [directoryName] (react-hooks/exhaustive-deps warning disabled for onDirectoryChange)
 *
 * ### Flow
 * 1. **ManagerApp loads** - Reads directory from localStorage
 * 2. **LandingPage mounts** - Receives directoryName prop from localStorage
 * 3. **useEffect fires** - Automatically calls onDirectoryChange(directoryName)
 * 4. **ManagerApp validates** - Sets directorySelected flag based on validation
 * 5. **Input pre-populates** - pathInput state is initialized with directoryName
 * 6. **Next button enables** - User can proceed immediately if directory is valid
 *
 * ## Navigation Flow
 * The LandingPage is the second step in the setup workflow:
 *
 * 1. **User lands on LandingPage** (setupStep='landing' in ManagerApp)
 * 2. **User enters directory path** or sees pre-populated path from localStorage
 * 3. **User clicks "Next"** button (only enabled if directorySelected is true)
 * 4. **onNext callback** invoked by LandingPage
 * 5. **ManagerApp transitions** to validation page (setupStep='validation')
 * 6. **ValidationPage displays** and begins project validation
 *
 * Alternatively:
 * 1. **User clicks "Back to Home"** button
 * 2. **onBack callback** invoked by LandingPage
 * 3. **ManagerApp transitions** to home page (setupStep='home')
 * 4. **HomePage displays** welcome screen
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS classes for styling:
 *
 * - **Container**: flex flex-col items-center text-center max-w-3xl mx-auto
 * - **Animation**: animate-fade-in class for smooth entrance (defined in global CSS)
 * - **Responsive Typography**: text-3xl sm:text-4xl lg:text-5xl for title scaling
 * - **Form Layout**: space-y-4 for consistent vertical spacing between form elements
 * - **Input Styling**: font-mono for monospace path display, text-sm for compact text
 * - **Button Layout**: flex-col sm:flex-row gap-4 for responsive button arrangement
 * - **Button Sizing**: lg for Next button (prominent CTA), sm for Back button (secondary action)
 * - **Disabled State**: Next button opacity and cursor changes when disabled
 * - **Code Elements**: bg-muted px-1 py-0.5 rounded-sm font-mono for inline code blocks
 * - **Color Scheme**: Uses theme colors (foreground, muted-foreground, primary) for consistency
 * - **Icon Size**: h-5 w-5 (20px) for Next icon, h-4 w-4 (16px) for Back icon
 *
 * @example
 * // Basic usage in ManagerApp setup phase
 * import LandingPage from './components/LandingPage';
 *
 * function ManagerApp() {
 *   const [setupStep, setSetupStep] = useState<SetupStep>('landing');
 *   const [directory, setDirectory] = useState<string>('');
 *   const [directorySelected, setDirectorySelected] = useState<boolean>(false);
 *
 *   const handleDirectoryChange = (path: string) => {
 *     setDirectory(path);
 *     setDirectorySelected(!!path); // Simple validation
 *   };
 *
 *   const handleNext = () => {
 *     setSetupStep('validation');
 *   };
 *
 *   const handleBack = () => {
 *     setSetupStep('home');
 *   };
 *
 *   if (setupStep === 'landing') {
 *     return (
 *       <LandingPage
 *         onDirectoryChange={handleDirectoryChange}
 *         onNext={handleNext}
 *         directorySelected={directorySelected}
 *         directoryName={directory}
 *         onBack={handleBack}
 *       />
 *     );
 *   }
 *
 *   // ... render other setup steps
 * }
 *
 * @example
 * // Understanding the directory selection workflow
 * // Step-by-step flow when user enters a directory path:
 *
 * // 1. User types in input field
 * <Input
 *   value="C:/Users/Ali/Documents/Projects/my-project"
 *   onChange={handlePathChange}
 * />
 *
 * // 2. handlePathChange fires
 * const handlePathChange = (e) => {
 *   const value = e.target.value;                    // Get input value
 *   setPathInput(value);                             // Update local state
 *   if (value.trim()) {                              // Check if non-empty after trim
 *     onDirectoryChange(value.trim());               // Notify parent with trimmed path
 *   }
 * };
 *
 * // 3. Parent component (ManagerApp) receives callback
 * const handleDirectoryChange = (path: string) => {
 *   setDirectory(path);                              // Store directory path
 *   // Validate path (e.g., check if .claude folder exists)
 *   const isValid = validateDirectory(path);
 *   setDirectorySelected(isValid);                   // Enable/disable Next button
 * };
 *
 * // 4. Next button state updates
 * <Button
 *   onClick={onNext}
 *   disabled={!directorySelected}                    // Enabled only if valid
 * />
 *
 * @example
 * // Auto-population from localStorage
 * import LandingPage from './components/LandingPage';
 *
 * function ManagerApp() {
 *   const [directory, setDirectory] = useState<string>('');
 *
 *   useEffect(() => {
 *     // Load directory from localStorage on app mount
 *     const savedDirectory = localStorage.getItem('selectedDirectory');
 *     if (savedDirectory) {
 *       setDirectory(savedDirectory);
 *     }
 *   }, []);
 *
 *   const handleDirectoryChange = (path: string) => {
 *     setDirectory(path);
 *     localStorage.setItem('selectedDirectory', path);
 *   };
 *
 *   return (
 *     <LandingPage
 *       onDirectoryChange={handleDirectoryChange}
 *       directoryName={directory}  // Pre-populated from localStorage
 *       // ... other props
 *     />
 *   );
 *
 *   // LandingPage's useEffect will automatically call onDirectoryChange
 *   // with the pre-populated directory, triggering validation
 * }
 *
 * @example
 * // Complete navigation flow
 * // Understanding the setup workflow progression:
 *
 * // Step 1: User on HomePage, clicks "Get Started"
 * <HomePage onGetStarted={() => setSetupStep('landing')} />
 *
 * // Step 2: User on LandingPage, enters directory path
 * <LandingPage
 *   onDirectoryChange={handleDirectoryChange}
 *   onNext={() => setSetupStep('validation')}         // Forward navigation
 *   onBack={() => setSetupStep('home')}               // Backward navigation
 *   directorySelected={directorySelected}
 *   directoryName={directory}
 * />
 *
 * // Step 3: User clicks "Next" (if directory is valid)
 * // - onNext callback fires
 * // - setupStep changes to 'validation'
 * // - ValidationPage displays and runs validation
 *
 * // Alternative: User clicks "Back to Home"
 * // - onBack callback fires
 * // - setupStep changes to 'home'
 * // - HomePage displays welcome screen
 */

import React, { useRef, ChangeEvent, useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FolderIcon, ArrowRightIcon, ArrowLeftIcon } from './ui/Icons';

/**
 * Props for the LandingPage component
 *
 * @interface LandingPageProps
 * @property {(path: string) => void} onDirectoryChange - Callback function invoked when user enters or modifies the directory path.
 *                                                         Receives the trimmed directory path string. Called on every keystroke
 *                                                         (after trimming) and automatically on mount if directoryName is provided.
 *                                                         Parent component should validate the path and update directorySelected flag.
 * @property {() => void} onNext - Callback function invoked when user clicks the "Next" button.
 *                                  Should transition to the validation page (setupStep='validation') in ManagerApp.
 *                                  Button is only enabled when directorySelected is true.
 * @property {boolean} directorySelected - Flag indicating whether the entered directory path is valid and selected.
 *                                          Controls the disabled state of the "Next" button. Should be set by parent
 *                                          component based on validation logic (e.g., checking if .claude folder exists).
 * @property {string} [directoryName] - Optional pre-populated directory path, typically loaded from localStorage.
 *                                       When provided, the input field is pre-filled with this value and the
 *                                       useEffect hook automatically calls onDirectoryChange to trigger validation.
 * @property {() => void} onBack - Callback function invoked when user clicks the "Back to Home" button.
 *                                  Should transition back to the home page (setupStep='home') in ManagerApp.
 */
interface LandingPageProps {
  onDirectoryChange: (path: string) => void;
  onNext: () => void;
  directorySelected: boolean;
  directoryName?: string;
  onBack: () => void;
}

/**
 * LandingPage component - Project directory selection for Claude Agent Manager
 *
 * Displays a directory selection interface where users specify their Claude Agent project path.
 * Handles input validation, localStorage restoration, and navigation between setup steps.
 *
 * @param {LandingPageProps} props - Component props
 * @returns {JSX.Element} Rendered LandingPage component
 */
const LandingPage: React.FC<LandingPageProps> = ({ onDirectoryChange, onNext, directorySelected, directoryName, onBack }) => {
  const [pathInput, setPathInput] = useState(directoryName || '');

  // Automatically trigger onDirectoryChange if directoryName is pre-populated from localStorage
  useEffect(() => {
    if (directoryName && directoryName.trim()) {
      onDirectoryChange(directoryName.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryName]);

  /**
   * Handles changes to the directory path input field
   *
   * Updates local state with the input value and notifies parent component
   * via onDirectoryChange callback if the trimmed value is non-empty.
   *
   * Workflow:
   * 1. Extract value from input change event
   * 2. Update pathInput state with raw value (including whitespace)
   * 3. Trim value to remove leading/trailing whitespace
   * 4. If trimmed value is non-empty, invoke onDirectoryChange callback
   * 5. Parent component validates path and updates directorySelected flag
   *
   * @internal
   * @param {ChangeEvent<HTMLInputElement>} e - Input change event from directory path field
   * @returns {void}
   */
  const handlePathChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPathInput(value);
    if (value.trim()) {
      onDirectoryChange(value.trim());
    }
  };

  return (
    <div className="flex flex-col items-center text-center max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
        Select Your Project
      </h2>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Enter the full path to your project directory. The tool will automatically scan for Claude Agent configurations.
      </p>

      <div className="mt-10 w-full max-w-2xl space-y-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="path-input" className="text-sm font-medium text-left">
            Project Directory Path
          </label>
          <Input
            id="path-input"
            type="text"
            placeholder="C:/Users/YourName/Documents/Projects/your-project"
            value={pathInput}
            onChange={handlePathChange}
            className="text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground text-left">
            Example: <code className="bg-muted px-1 py-0.5 rounded-sm">C:/Users/Ali/Documents/Projects/claude-agent-sdk-typescript</code>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <Button onClick={onNext} disabled={!directorySelected} size="lg" className="w-full sm:w-auto flex-grow">
            Next
            <ArrowRightIcon className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        We'll look for a <code className="bg-muted px-1 py-0.5 rounded-sm font-mono text-xs">.claude</code> folder inside this directory.
      </p>

      <div className="mt-8">
        <Button onClick={onBack} variant="secondary" size="sm">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

LandingPage.displayName = 'LandingPage';

export default LandingPage;
