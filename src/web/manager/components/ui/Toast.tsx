/**
 * Toast Notification Component System
 *
 * A lightweight toast notification system for displaying temporary messages and alerts to users.
 * The Toast component provides non-intrusive feedback for actions, errors, warnings, and success
 * states without blocking the user interface or requiring explicit dismissal.
 *
 * ## Features
 * - Auto-dismiss after configurable timeout (default: 5 seconds)
 * - Manual close button for user control
 * - Multiple toast variants (success, error, warning, info)
 * - Smooth slide-up animation on appearance
 * - Positioned at top-right corner (non-blocking)
 * - Support for stacking multiple toasts
 * - Accessible with proper ARIA attributes
 * - Lightweight implementation with no external dependencies
 *
 * ## Component Structure
 * The toast notification system consists of two main parts:
 * ```
 * ToastContainer (fixed position wrapper)
 *   └── Toast (individual notification)
 *         ├── Icon (variant-specific icon)
 *         ├── Message (toast content)
 *         └── Close Button (XIcon)
 * ```
 *
 * ## Toast Variants
 * - **success**: Green styling with CheckCircleIcon - for successful operations
 * - **error**: Red styling with XCircleIcon - for errors and failures
 * - **warning**: Yellow/amber styling with ExclamationCircleIcon - for warnings
 * - **info**: Blue styling with InfoIcon - for informational messages
 *
 * ## Styling Behavior
 * - **ToastContainer**: Fixed position at top-right with z-50 for overlay stacking
 * - **Toast**: Slide-up animation, rounded corners, shadow, and variant-specific colors
 * - **Auto-dismiss**: Configurable timeout (default 5000ms)
 * - **Stacking**: Multiple toasts stack vertically with 8px gap
 *
 * @example
 * // Basic success toast
 * <Toast
 *   message="Flow saved successfully!"
 *   variant="success"
 *   onClose={() => console.log('Toast closed')}
 * />
 *
 * @example
 * // Error toast with custom auto-dismiss duration
 * <Toast
 *   message="Failed to save flow. Please try again."
 *   variant="error"
 *   onClose={handleClose}
 *   duration={7000}
 * />
 *
 * @example
 * // Warning toast without auto-dismiss
 * <Toast
 *   message="This action cannot be undone."
 *   variant="warning"
 *   onClose={handleClose}
 *   duration={0}
 * />
 *
 * @example
 * // Info toast with default settings
 * <Toast
 *   message="New updates available"
 *   variant="info"
 *   onClose={handleClose}
 * />
 *
 * @example
 * // Toast container with multiple toasts
 * <ToastContainer>
 *   <Toast message="First notification" variant="info" onClose={() => {}} />
 *   <Toast message="Second notification" variant="success" onClose={() => {}} />
 *   <Toast message="Third notification" variant="warning" onClose={() => {}} />
 * </ToastContainer>
 */

import React, { useEffect, useRef } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  InfoIcon,
  XIcon,
} from './Icons';

/**
 * Toast variant types
 *
 * Defines the available visual styles and semantic meanings for toast notifications:
 * - success: Operation completed successfully (green)
 * - error: Operation failed or error occurred (red)
 * - warning: Cautionary message or potential issue (yellow/amber)
 * - info: Informational message (blue)
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

/**
 * Props for the Toast component
 *
 * @property {string} message - The text content to display in the toast
 * @property {ToastVariant} variant - Visual style and semantic meaning of the toast
 * @property {function} onClose - Callback invoked when the toast is closed (auto or manual)
 * @property {number} [duration] - Auto-dismiss duration in milliseconds (default: 5000, 0 = no auto-dismiss)
 * @property {string} [id] - Optional unique identifier for the toast
 */
export interface ToastProps {
  message: string;
  variant: ToastVariant;
  onClose: () => void;
  duration?: number;
  id?: string;
}

/**
 * Toast - Individual notification component
 *
 * Renders a single toast notification with variant-specific styling, an icon, message text,
 * and a close button. Automatically dismisses after the specified duration unless duration
 * is set to 0.
 *
 * ## Props
 * - `message`: The notification text to display
 * - `variant`: Determines the color scheme and icon (success, error, warning, info)
 * - `onClose`: Function called when toast is dismissed (either manually or automatically)
 * - `duration`: Milliseconds before auto-dismiss (default: 5000, set to 0 to disable)
 * - `id`: Optional unique identifier for tracking/debugging
 *
 * ## Behavior
 * - Slides up smoothly on mount with `animate-slide-up` animation
 * - Auto-dismisses after `duration` milliseconds (default 5 seconds)
 * - Can be manually closed via X button
 * - Calls `onClose` callback when dismissed by any method
 * - Cleans up timer on unmount to prevent memory leaks
 *
 * ## Styling
 * - Flexbox layout with icon, message, and close button
 * - Variant-specific background and text colors
 * - Rounded corners (8px) and shadow for depth
 * - 16px padding with 12px gap between elements
 * - Minimum width of 320px, maximum width of 480px
 * - Semi-transparent backdrop for better contrast
 *
 * ## Accessibility
 * - Uses semantic role="alert" for screen readers
 * - Live region for dynamic content announcements
 * - Keyboard-accessible close button
 * - Clear visual distinction between variants
 *
 * @example
 * <Toast
 *   message="Changes saved successfully"
 *   variant="success"
 *   onClose={() => setToasts(prev => prev.filter(t => t.id !== toastId))}
 * />
 *
 * @example
 * // Toast that never auto-dismisses
 * <Toast
 *   message="Critical: Server connection lost"
 *   variant="error"
 *   onClose={handleErrorClose}
 *   duration={0}
 * />
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  variant,
  onClose,
  duration = 5000,
  id,
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        onClose();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, onClose]);

  const variantStyles: Record<
    ToastVariant,
    { container: string; icon: React.ReactElement }
  > = {
    success: {
      container: 'bg-green-900/90 border-green-700 text-green-50',
      icon: <CheckCircleIcon className="text-green-400" width={20} height={20} />,
    },
    error: {
      container: 'bg-red-900/90 border-red-700 text-red-50',
      icon: <XCircleIcon className="text-red-400" width={20} height={20} />,
    },
    warning: {
      container: 'bg-amber-900/90 border-amber-700 text-amber-50',
      icon: <ExclamationCircleIcon className="text-amber-400" width={20} height={20} />,
    },
    info: {
      container: 'bg-blue-900/90 border-blue-700 text-blue-50',
      icon: <InfoIcon className="text-blue-400" width={20} height={20} />,
    },
  };

  const { container, icon } = variantStyles[variant];

  return (
    <div
      role="alert"
      aria-live="polite"
      data-toast-id={id}
      className={`flex items-center gap-3 min-w-[320px] max-w-[480px] p-4 border rounded-lg shadow-lg animate-slide-up ${container}`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:opacity-75 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-white rounded"
        aria-label="Close notification"
      >
        <XIcon width={16} height={16} />
      </button>
    </div>
  );
};
Toast.displayName = 'Toast';

/**
 * Props for the ToastContainer component
 *
 * @property {React.ReactNode} children - Toast components to display
 * @property {string} [className] - Additional CSS classes for custom positioning
 */
interface ToastContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ToastContainer - Fixed container for toast notifications
 *
 * A fixed-position wrapper component that positions toast notifications at the top-right
 * corner of the viewport. Manages the layout and stacking of multiple toast notifications.
 *
 * ## Props
 * - `children`: Toast components to render (typically multiple Toast components)
 * - `className`: Optional additional CSS classes for custom positioning
 *
 * ## Styling
 * - `fixed top-4 right-4`: Positioned 16px from top-right corner
 * - `z-50`: High z-index to appear above most content
 * - `flex flex-col gap-2`: Vertical stack with 8px spacing
 * - `pointer-events-none`: Allows clicks to pass through container
 * - Individual toasts have `pointer-events-auto` to receive interactions
 *
 * ## Behavior
 * - Toasts stack vertically from top to bottom
 * - New toasts appear at the bottom of the stack
 * - Container doesn't interfere with page interactions (pointer-events-none)
 * - Each toast is independently interactive
 *
 * @example
 * // Basic usage with multiple toasts
 * <ToastContainer>
 *   {toasts.map(toast => (
 *     <Toast
 *       key={toast.id}
 *       id={toast.id}
 *       message={toast.message}
 *       variant={toast.variant}
 *       onClose={() => removeToast(toast.id)}
 *     />
 *   ))}
 * </ToastContainer>
 *
 * @example
 * // Custom positioning (bottom-right instead of top-right)
 * <ToastContainer className="top-auto bottom-4">
 *   {toasts.map(toast => (
 *     <Toast key={toast.id} {...toast} />
 *   ))}
 * </ToastContainer>
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none ${className}`}
    >
      <div className="flex flex-col gap-2 pointer-events-auto">{children}</div>
    </div>
  );
};
ToastContainer.displayName = 'ToastContainer';

export default Toast;
