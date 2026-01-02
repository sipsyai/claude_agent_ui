/**
 * Button Component
 *
 * A versatile button component with multiple variants and sizes, built with accessibility
 * and modern UI patterns in mind. Extends native HTML button attributes for full flexibility.
 *
 * ## Features
 * - Three visual variants: primary, secondary, and destructive
 * - Three size options: small, medium, and large
 * - Full keyboard navigation and focus management
 * - Automatic disabled state styling (reduced opacity, no pointer events)
 * - Smooth color transitions on hover
 * - Focus-visible ring for accessibility
 * - Supports ref forwarding for direct DOM access
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with a composition of:
 * - **Base styles**: Flexbox layout, rounded corners, font styling, focus rings, transition effects
 * - **Variant styles**: Background and text colors with hover states
 * - **Size styles**: Height and padding variations
 * - **Custom className**: Additional styles can be passed via className prop
 *
 * When disabled, the button automatically:
 * - Reduces opacity to 50%
 * - Disables pointer events
 * - Maintains variant styling for visual consistency
 *
 * @example
 * // Primary button (default)
 * <Button onClick={() => console.log('Clicked')}>
 *   Click Me
 * </Button>
 *
 * @example
 * // Secondary variant with custom size
 * <Button variant="secondary" size="lg">
 *   Large Secondary Button
 * </Button>
 *
 * @example
 * // Destructive action button
 * <Button variant="destructive" onClick={handleDelete}>
 *   Delete Item
 * </Button>
 *
 * @example
 * // Disabled state
 * <Button disabled>
 *   Disabled Button
 * </Button>
 *
 * @example
 * // With custom className for additional styling
 * <Button className="w-full" variant="primary">
 *   Full Width Button
 * </Button>
 */

import React from 'react';

/**
 * Props for the Button component
 *
 * Extends all standard HTML button attributes, allowing full access to native
 * button functionality (onClick, disabled, type, etc.)
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant of the button
   * - `primary`: Main action button with primary brand color (default)
   * - `secondary`: Secondary actions with muted styling
   * - `destructive`: Dangerous actions (delete, remove) with red/warning colors
   *
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'destructive';

  /**
   * Size of the button affecting height and padding
   * - `sm`: Small - height 36px (h-9), compact padding
   * - `md`: Medium - height 40px (h-10), standard padding (default)
   * - `lg`: Large - height 44px (h-11), generous padding
   *
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variantClasses = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    };

    const sizeClasses = {
      sm: 'h-9 rounded-md px-3',
      md: 'h-10 px-4 py-2',
      lg: 'h-11 rounded-md px-8 text-base',
    };

    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''}`;

    return <button className={classes} ref={ref} {...props} />;
  }
);

Button.displayName = 'Button';
