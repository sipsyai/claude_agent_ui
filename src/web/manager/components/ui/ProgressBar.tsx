/**
 * ProgressBar Component
 *
 * A visual progress indicator with automatic color-coding based on experience levels.
 * Displays a progress bar with percentage value and an optional skill level label.
 * Built with smooth animations and multiple size variants.
 *
 * ## Features
 * - Automatic color-coding based on progress value (Beginner, Intermediate, Expert)
 * - Smooth width transitions with CSS animations (300ms ease-in-out)
 * - Value clamping to ensure valid range (0-100)
 * - Optional skill level label display
 * - Three size options: small, medium, and large
 * - Percentage display with rounded values
 * - Accessible with semantic HTML structure
 *
 * ## Color-Coding Behavior
 * The progress bar automatically changes color based on the value:
 * - **Beginner (0-30)**: Orange - bg-orange-500 / text-orange-600
 * - **Intermediate (31-60)**: Yellow - bg-yellow-500 / text-yellow-600
 * - **Expert (61-100)**: Green - bg-green-500 / text-green-600
 *
 * ## Animation Behavior
 * - Width changes are animated using CSS transitions: `transition-all duration-300 ease-in-out`
 * - The animation applies when the value prop changes
 * - Smooth easing provides a professional visual experience
 * - No animation on initial render, only on value updates
 *
 * ## Styling Options
 * The component uses Tailwind CSS with:
 * - **Base container**: Full width with optional custom className
 * - **Header row**: Flex layout with percentage and optional label
 * - **Progress track**: Gray background (bg-gray-200), rounded-full, size-based height
 * - **Progress fill**: Colored bar with rounded-full, animated width based on value
 * - **Size classes**:
 *   - `sm`: h-1.5 (6px height)
 *   - `md`: h-2 (8px height, default)
 *   - `lg`: h-3 (12px height)
 * - **Custom className**: Additional styles can be passed to the container
 *
 * @example
 * // Basic progress bar (default medium size, with label)
 * <ProgressBar value={75} />
 *
 * @example
 * // Beginner level (0-30)
 * <ProgressBar value={25} />
 *
 * @example
 * // Intermediate level (31-60)
 * <ProgressBar value={45} />
 *
 * @example
 * // Expert level (61-100)
 * <ProgressBar value={85} />
 *
 * @example
 * // Without experience level label
 * <ProgressBar value={60} showLabel={false} />
 *
 * @example
 * // Small size variant
 * <ProgressBar value={50} size="sm" />
 *
 * @example
 * // Large size variant
 * <ProgressBar value={90} size="lg" />
 *
 * @example
 * // With custom className for spacing
 * <ProgressBar value={40} className="mt-4 mb-2" />
 *
 * @example
 * // Edge cases - values are automatically clamped
 * <ProgressBar value={150} /> // Displays as 100%
 * <ProgressBar value={-10} />  // Displays as 0%
 */

import React from 'react';

/**
 * Props for the ProgressBar component
 */
interface ProgressBarProps {
  /**
   * The progress value to display, expressed as a percentage.
   * Valid range: 0-100. Values outside this range are automatically clamped.
   *
   * **Value determines both visual appearance and label:**
   * - 0-30: Beginner level (orange)
   * - 31-60: Intermediate level (yellow)
   * - 61-100: Expert level (green)
   *
   * The value is rounded when displayed and triggers smooth width animation
   * when changed.
   */
  value: number;

  /**
   * Optional CSS classes to apply to the container element.
   * Useful for adding custom spacing, width constraints, or other styling.
   *
   * @example
   * className="mt-4 mb-2 max-w-md"
   */
  className?: string;

  /**
   * Controls whether the skill level label is displayed.
   * When true, shows "Beginner", "Intermediate", or "Expert" based on value.
   * The label appears in the top-right with color matching the progress bar.
   *
   * @default true
   */
  showLabel?: boolean;

  /**
   * Size variant affecting the height of the progress bar.
   * - `sm`: Small - 6px height (h-1.5)
   * - `md`: Medium - 8px height (h-2, default)
   * - `lg`: Large - 12px height (h-3)
   *
   * Does not affect the header row with percentage and label.
   *
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  className = '',
  showLabel = true,
  size = 'md',
}) => {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(100, Math.max(0, value));

  // Determine color based on value
  const getColorClass = (val: number): string => {
    if (val >= 61) return 'bg-green-500'; // Expert (61-100)
    if (val >= 31) return 'bg-yellow-500'; // Intermediate (31-60)
    return 'bg-orange-500'; // Beginner (0-30)
  };

  // Determine label
  const getLabel = (val: number): string => {
    if (val >= 61) return 'Expert';
    if (val >= 31) return 'Intermediate';
    return 'Beginner';
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">
          Experience: {Math.round(clampedValue)}%
        </span>
        {showLabel && (
          <span className={`text-xs font-medium ${
            clampedValue >= 61
              ? 'text-green-600'
              : clampedValue >= 31
              ? 'text-yellow-600'
              : 'text-orange-600'
          }`}>
            {getLabel(clampedValue)}
          </span>
        )}
      </div>
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]} overflow-hidden`}>
        <div
          className={`${getColorClass(clampedValue)} ${sizeClasses[size]} rounded-full transition-all duration-300 ease-in-out`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
