/**
 * Switch Component
 *
 * A modern toggle/switch component that provides an iOS-style on/off control. Built on top
 * of a native checkbox input for full accessibility and keyboard support, styled with a
 * smooth animated slider that transitions between states.
 *
 * ## Features
 * - iOS-style toggle switch with smooth transitions
 * - Full keyboard navigation (Space/Enter to toggle)
 * - Screen reader accessible (uses native checkbox with proper labeling)
 * - Focus ring for keyboard navigation visibility
 * - Checked/unchecked state with visual feedback
 * - Dark mode support with automatic theme adaptation
 * - Animated slider movement when toggling
 * - Supports ref forwarding for direct input access
 *
 * ## Toggle Behavior
 * The switch responds to:
 * - **Click/Tap**: Toggle between on and off states
 * - **Keyboard**: Space or Enter key when focused
 * - **Programmatic**: Set via `checked` or `defaultChecked` props
 *
 * The component is a controlled or uncontrolled input:
 * - **Controlled**: Use `checked` prop with `onChange` handler
 * - **Uncontrolled**: Use `defaultChecked` with optional `onChange`
 *
 * ## Checked State
 * Visual changes when checked:
 * - Background color changes from gray to blue
 * - Slider (white circle) translates to the right
 * - Border color adapts for dark mode
 *
 * When unchecked:
 * - Background is light gray (or dark gray in dark mode)
 * - Slider positioned on the left side
 *
 * ## Accessibility
 * - Uses native `<input type="checkbox">` for semantic HTML
 * - Input is visually hidden (sr-only) but remains in DOM for screen readers
 * - Focus ring appears on keyboard navigation (peer-focus:ring)
 * - Can be labeled with standard `<label>` or aria-label attributes
 * - Supports all ARIA attributes via spread props
 * - Keyboard accessible with native checkbox behavior
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with peer modifier pattern:
 * - **Container**: Inline-flex label with cursor pointer
 * - **Hidden Input**: Screen reader only (sr-only), marked as peer for CSS targeting
 * - **Slider Track**: 44px × 24px rounded pill shape with background color
 * - **Slider Thumb**: Absolute positioned white circle (20px) that slides on toggle
 * - **Transitions**: Smooth animation for background color and slider position
 * - **Focus State**: Blue ring appears when input receives keyboard focus
 * - **Dark Mode**: Automatic theme adaptation for backgrounds and borders
 *
 * @example
 * // Basic controlled switch
 * const [isEnabled, setIsEnabled] = useState(false);
 *
 * <Switch
 *   checked={isEnabled}
 *   onChange={(e) => setIsEnabled(e.target.checked)}
 * />
 *
 * @example
 * // Uncontrolled switch with default value
 * <Switch defaultChecked={true} />
 *
 * @example
 * // Switch with label using wrapper
 * <div className="flex items-center space-x-2">
 *   <Switch
 *     id="notifications"
 *     checked={notificationsEnabled}
 *     onChange={(e) => setNotificationsEnabled(e.target.checked)}
 *   />
 *   <label htmlFor="notifications">
 *     Enable notifications
 *   </label>
 * </div>
 *
 * @example
 * // Disabled switch
 * <Switch disabled checked={true} />
 *
 * @example
 * // Switch with change handler
 * <Switch
 *   onChange={(e) => {
 *     console.log('Switch toggled:', e.target.checked);
 *     updateSetting(e.target.checked);
 *   }}
 * />
 *
 * @example
 * // Form integration with name attribute
 * <form>
 *   <Switch
 *     name="emailNotifications"
 *     defaultChecked={true}
 *   />
 *   <Switch
 *     name="pushNotifications"
 *     defaultChecked={false}
 *   />
 * </form>
 *
 * @example
 * // With custom className for additional styling
 * <Switch
 *   className="scale-125"
 *   checked={isActive}
 *   onChange={(e) => setIsActive(e.target.checked)}
 * />
 *
 * @example
 * // Using ref to programmatically control
 * const switchRef = useRef<HTMLInputElement>(null);
 *
 * const handleButtonClick = () => {
 *   if (switchRef.current) {
 *     switchRef.current.checked = !switchRef.current.checked;
 *   }
 * };
 *
 * <Switch ref={switchRef} />
 */

import React from 'react';

/**
 * Props for the Switch component
 *
 * Extends all standard HTML input (checkbox) attributes, allowing full access to native
 * checkbox functionality including checked, defaultChecked, onChange, disabled, name, value, etc.
 *
 * Common props:
 * - `checked`: Controlled checked state (boolean)
 * - `defaultChecked`: Uncontrolled initial checked state (boolean)
 * - `onChange`: Callback fired when switch is toggled (ChangeEvent<HTMLInputElement>)
 * - `disabled`: Whether the switch is disabled (boolean)
 * - `name`: Name for form submission (string)
 * - `id`: ID for linking with label elements (string)
 * - `className`: Additional CSS classes for the slider track (string)
 * - `required`: Whether the switch must be checked for form validation (boolean)
 * - `aria-label`: Accessible label when not using visual label (string)
 * - `aria-labelledby`: ID of element that labels this switch (string)
 * - `aria-describedby`: ID of element that describes this switch (string)
 */
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" value="" className="sr-only peer" ref={ref} {...props} />
        <div className={`
          w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700
          peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px]
          after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600
          ${className || ''}
        `}></div>
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
