/**
 * Textarea Component
 *
 * A flexible multi-line text input component that extends native HTML textarea functionality with
 * consistent styling, accessibility features, and support for all standard textarea attributes.
 * Designed for longer text input with automatic height management and modern UI patterns.
 *
 * ## Features
 * - Full width by default with customizable sizing via className
 * - Minimum height of 120px with automatic expansion based on content
 * - Enhanced focus states with visible ring for accessibility
 * - Background with semantic color theming
 * - Flexbox layout for proper content alignment
 * - Disabled state with appropriate cursor and reduced opacity
 * - Supports ref forwarding for direct DOM access
 * - Inherits all native textarea attributes (value, onChange, placeholder, rows, cols, etc.)
 * - Responsive to user input with native browser resize controls
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with carefully composed styles:
 * - **Base styles**: Flexbox layout, minimum height (120px), full width, rounded borders
 * - **Border & Background**: Subtle border with semantic color, themed background
 * - **Text**: Small text size (14px) with proper padding for readability
 * - **Focus state**: Visible ring with offset for WCAG accessibility compliance (focus-visible)
 * - **Placeholder**: Muted text color for empty state guidance
 * - **Disabled state**: Not-allowed cursor and 50% opacity
 * - **Resize**: Native browser resize controls enabled by default
 * - **Custom className**: Additional styles can be passed via className prop
 *
 * When disabled, the textarea automatically:
 * - Changes cursor to 'not-allowed'
 * - Reduces opacity to 50%
 * - Prevents user interaction (native HTML behavior)
 *
 * ## Common Usage Patterns
 * The Textarea component is typically used in forms for multi-line text input:
 * - Controlled: Pass value and onChange props for React state management
 * - Uncontrolled: Use ref to access value directly via DOM or defaultValue
 * - Validation: Combine with HTML5 validation (required, minLength, maxLength)
 * - Auto-sizing: Control height with rows attribute or CSS
 * - Character limits: Use maxLength for enforcement and show character count
 *
 * @example
 * // Basic controlled textarea
 * const [description, setDescription] = useState('');
 * <Textarea
 *   placeholder="Enter description..."
 *   value={description}
 *   onChange={(e) => setDescription(e.target.value)}
 * />
 *
 * @example
 * // Textarea with character limit
 * const [bio, setBio] = useState('');
 * const MAX_CHARS = 500;
 * <>
 *   <Textarea
 *     placeholder="Tell us about yourself..."
 *     value={bio}
 *     onChange={(e) => setBio(e.target.value)}
 *     maxLength={MAX_CHARS}
 *   />
 *   <p className="text-sm text-muted-foreground mt-1">
 *     {bio.length}/{MAX_CHARS} characters
 *   </p>
 * </>
 *
 * @example
 * // Textarea with validation
 * <Textarea
 *   placeholder="Enter your comment (minimum 10 characters)..."
 *   required
 *   minLength={10}
 *   maxLength={1000}
 * />
 *
 * @example
 * // Textarea with custom height via rows
 * <Textarea
 *   placeholder="Enter notes..."
 *   rows={8}
 * />
 *
 * @example
 * // Disabled textarea
 * <Textarea
 *   value="This content cannot be edited"
 *   disabled
 * />
 *
 * @example
 * // Textarea with custom styling
 * <Textarea
 *   placeholder="Custom styled textarea..."
 *   className="min-h-[200px] resize-none font-mono"
 * />
 *
 * @example
 * // Using ref for uncontrolled textarea
 * const textareaRef = useRef<HTMLTextAreaElement>(null);
 * const handleSubmit = () => {
 *   console.log(textareaRef.current?.value);
 * };
 * <Textarea
 *   ref={textareaRef}
 *   defaultValue="Initial content"
 *   placeholder="Type here..."
 * />
 *
 * @example
 * // Textarea for code input with monospace font
 * const [code, setCode] = useState('');
 * <Textarea
 *   placeholder="Enter JSON configuration..."
 *   value={code}
 *   onChange={(e) => setCode(e.target.value)}
 *   className="font-mono text-xs"
 *   rows={12}
 *   spellCheck={false}
 * />
 *
 * @example
 * // Form integration with label and error message
 * const [content, setContent] = useState('');
 * const [error, setError] = useState('');
 * <>
 *   <label htmlFor="content" className="block text-sm font-medium mb-2">
 *     Content
 *   </label>
 *   <Textarea
 *     id="content"
 *     value={content}
 *     onChange={(e) => setContent(e.target.value)}
 *     placeholder="Enter content..."
 *     required
 *   />
 *   {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
 * </>
 */

import React from 'react';

/**
 * Props for the Textarea component
 *
 * Extends all standard HTML textarea attributes, providing full access to native
 * textarea functionality including:
 * - `value` and `onChange`: For controlled components
 * - `defaultValue`: For uncontrolled components
 * - `placeholder`: Hint text shown when empty
 * - `rows`: Number of visible text lines (affects initial height)
 * - `cols`: Width in average character widths
 * - `disabled`: Disable the textarea
 * - `readOnly`: Make textarea read-only but focusable
 * - `required`: HTML5 validation requiring content
 * - `minLength`, `maxLength`: Character count validation
 * - `wrap`: Text wrapping behavior ('soft', 'hard', 'off')
 * - `autoComplete`: Autocomplete behavior
 * - `autoFocus`: Automatically focus on mount
 * - `spellCheck`: Enable/disable spell checking
 * - `onFocus`, `onBlur`, `onChange`, `onKeyDown`, etc.: Event handlers
 * - All other standard HTML textarea attributes
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={`flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
   