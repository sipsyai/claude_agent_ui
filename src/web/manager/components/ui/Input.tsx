/**
 * Input Component
 *
 * A flexible form input component that extends native HTML input functionality with
 * consistent styling, accessibility features, and support for all standard input types.
 * Built with modern UI patterns and full keyboard navigation support.
 *
 * ## Features
 * - Supports all HTML input types (text, email, password, number, file, etc.)
 * - Full width by default with customizable sizing via className
 * - Consistent height (40px) for alignment with other form elements
 * - Enhanced focus states with visible ring for accessibility
 * - Special styling for file inputs (transparent background, custom file button)
 * - Placeholder text with muted styling
 * - Disabled state with appropriate cursor and reduced opacity
 * - Supports ref forwarding for direct DOM access
 * - Inherits all native input attributes (value, onChange, onBlur, etc.)
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with carefully composed styles:
 * - **Base styles**: Flexbox layout, standard height (40px), full width, rounded borders
 * - **Border & Background**: Subtle border with semantic color, themed background
 * - **Text**: Small text size (14px) with proper padding for readability
 * - **Focus state**: Visible ring with offset for WCAG accessibility compliance
 * - **File input**: Custom styling for file upload button (borderless, themed)
 * - **Placeholder**: Muted text color for clear visual hierarchy
 * - **Disabled state**: Not-allowed cursor and 50% opacity
 * - **Custom className**: Additional styles can be passed via className prop
 *
 * When disabled, the input automatically:
 * - Changes cursor to 'not-allowed'
 * - Reduces opacity to 50%
 * - Prevents user interaction (native HTML behavior)
 *
 * ## Common Usage Patterns
 * The Input component is typically used in forms with controlled or uncontrolled state:
 * - Controlled: Pass value and onChange props for React state management
 * - Uncontrolled: Use ref to access value directly via DOM
 * - Validation: Combine with HTML5 validation (required, pattern, min, max)
 * - File uploads: Automatically styles file input button
 *
 * @example
 * // Basic text input with controlled state
 * const [name, setName] = useState('');
 * <Input
 *   type="text"
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 *   placeholder="Enter your name"
 * />
 *
 * @example
 * // Email input with validation
 * <Input
 *   type="email"
 *   placeholder="email@example.com"
 *   required
 * />
 *
 * @example
 * // Password input
 * <Input
 *   type="password"
 *   placeholder="Enter password"
 *   minLength={8}
 * />
 *
 * @example
 * // Number input with min/max constraints
 * <Input
 *   type="number"
 *   min={0}
 *   max={100}
 *   defaultValue={50}
 * />
 *
 * @example
 * // File upload input
 * <Input
 *   type="file"
 *   accept="image/*"
 *   onChange={(e) => handleFileUpload(e.target.files)}
 * />
 *
 * @example
 * // Disabled input
 * <Input
 *   type="text"
 *   value="Read-only value"
 *   disabled
 * />
 *
 * @example
 * // With custom className for custom width
 * <Input
 *   type="text"
 *   className="max-w-xs"
 *   placeholder="Custom width"
 * />
 *
 * @example
 * // Using ref for uncontrolled input
 * const inputRef = useRef<HTMLInputElement>(null);
 * <Input
 *   ref={inputRef}
 *   type="text"
 *   defaultValue="Initial value"
 * />
 */

import React from 'react';

/**
 * Props for the Input component
 *
 * Extends all standard HTML input attributes, providing full access to native
 * input functionality including:
 * - `value` and `onChange`: For controlled components
 * - `defaultValue`: For uncontrolled components
 * - `type`: Input type (text, email, password, number, file, etc.)
 * - `placeholder`: Placeholder text
 * - `disabled`: Disable the input
 * - `required`, `pattern`, `min`, `max`, `minLength`, `maxLength`: HTML5 validation
 * - `onFocus`, `onBlur`, `onKeyDown`, etc.: Event handlers
 * - All other standard HTML input attributes
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
   