/**
 * Select Component
 *
 * A flexible dropdown select component that extends native HTML select functionality with
 * consistent styling, accessibility features, and support for all standard select attributes.
 * Built with modern UI patterns and full keyboard navigation support.
 *
 * ## Features
 * - Full width by default with customizable sizing via className
 * - Consistent height (40px) for alignment with other form elements
 * - Enhanced focus states with visible ring for accessibility
 * - Transparent background allowing parent background to show through
 * - Flexbox layout for proper option alignment
 * - Disabled state with appropriate cursor and reduced opacity
 * - Supports ref forwarding for direct DOM access
 * - Inherits all native select attributes (value, onChange, onBlur, multiple, etc.)
 * - Native browser dropdown UI with custom styling for the select box
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with carefully composed styles:
 * - **Base styles**: Flexbox layout, standard height (40px), full width, rounded borders
 * - **Border & Background**: Subtle border with semantic color, transparent background
 * - **Text**: Small text size (14px) with proper padding for readability
 * - **Focus state**: Visible ring with offset for WCAG accessibility compliance
 * - **Placeholder**: Muted text color for empty or default option
 * - **Disabled state**: Not-allowed cursor and 50% opacity
 * - **Custom className**: Additional styles can be passed via className prop
 *
 * When disabled, the select automatically:
 * - Changes cursor to 'not-allowed'
 * - Reduces opacity to 50%
 * - Prevents user interaction (native HTML behavior)
 *
 * ## Common Usage Patterns
 * The Select component is typically used in forms with controlled or uncontrolled state:
 * - Controlled: Pass value and onChange props for React state management
 * - Uncontrolled: Use ref to access value directly via DOM or defaultValue
 * - Validation: Combine with HTML5 validation (required)
 * - Options: Render <option> elements as children
 * - Option groups: Use <optgroup> for categorized options
 *
 * @example
 * // Basic select with controlled state
 * const [country, setCountry] = useState('');
 * <Select
 *   value={country}
 *   onChange={(e) => setCountry(e.target.value)}
 * >
 *   <option value="">Select a country</option>
 *   <option value="us">United States</option>
 *   <option value="uk">United Kingdom</option>
 *   <option value="ca">Canada</option>
 * </Select>
 *
 * @example
 * // Select with required validation
 * <Select required>
 *   <option value="">Choose an option</option>
 *   <option value="option1">Option 1</option>
 *   <option value="option2">Option 2</option>
 * </Select>
 *
 * @example
 * // Select with option groups
 * <Select>
 *   <option value="">Select a fruit</option>
 *   <optgroup label="Citrus">
 *     <option value="orange">Orange</option>
 *     <option value="lemon">Lemon</option>
 *   </optgroup>
 *   <optgroup label="Berries">
 *     <option value="strawberry">Strawberry</option>
 *     <option value="blueberry">Blueberry</option>
 *   </optgroup>
 * </Select>
 *
 * @example
 * // Multi-select dropdown
 * const [selectedItems, setSelectedItems] = useState<string[]>([]);
 * <Select
 *   multiple
 *   value={selectedItems}
 *   onChange={(e) => {
 *     const options = Array.from(e.target.selectedOptions);
 *     setSelectedItems(options.map(opt => opt.value));
 *   }}
 * >
 *   <option value="item1">Item 1</option>
 *   <option value="item2">Item 2</option>
 *   <option value="item3">Item 3</option>
 * </Select>
 *
 * @example
 * // Disabled select
 * <Select disabled value="locked">
 *   <option value="locked">This option is locked</option>
 * </Select>
 *
 * @example
 * // With custom className for custom width
 * <Select className="max-w-xs">
 *   <option value="">Custom width select</option>
 *   <option value="1">Option 1</option>
 * </Select>
 *
 * @example
 * // Using ref for uncontrolled select
 * const selectRef = useRef<HTMLSelectElement>(null);
 * <Select ref={selectRef} defaultValue="default">
 *   <option value="default">Default Option</option>
 *   <option value="other">Other Option</option>
 * </Select>
 *
 * @example
 * // Dynamic options from data
 * const statuses = ['pending', 'active', 'completed'];
 * <Select>
 *   <option value="">Select status</option>
 *   {statuses.map(status => (
 *     <option key={status} value={status}>
 *       {status.charAt(0).toUpperCase() + status.slice(1)}
 *     </option>
 *   ))}
 * </Select>
 */

import React from 'react';

/**
 * Props for the Select component
 *
 * Extends all standard HTML select attributes, providing full access to native
 * select functionality including:
 * - `value` and `onChange`: For controlled components
 * - `defaultValue`: For uncontrolled components
 * - `multiple`: Enable multi-select mode
 * - `size`: Number of visible options (when multiple is true)
 * - `disabled`: Disable the select
 * - `required`: HTML5 validation requiring a selection
 * - `onFocus`, `onBlur`, `onChange`, etc.: Event handlers
 * - `children`: <option> or <optgroup> elements defining available choices
 * - All other standard HTML select attributes
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

export { Select };
