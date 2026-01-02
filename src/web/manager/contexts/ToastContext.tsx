/**
 * Toast Context
 *
 * A React Context that manages global toast notification state for displaying
 * temporary messages, alerts, and feedback to users across the application.
 *
 * ## Features
 * - **Global Toast Management**: Centralized state for all toast notifications
 * - **Auto-Dismiss**: Configurable auto-dismiss duration per toast
 * - **Toast Variants**: Support for success, error, warning, and info toasts
 * - **Unique IDs**: Automatic ID generation for each toast
 * - **Toast Stacking**: Display multiple toasts simultaneously
 * - **Type Safety**: Fully typed context values with TypeScript interfaces
 *
 * ## Context Values
 * The context provides the following state and functions:
 *
 * ### Toast State
 * - `toasts`: Array of all active toast notifications
 *
 * ### Toast Operations
 * - `addToast`: Add a new toast notification
 * - `removeToast`: Remove a specific toast by ID
 * - `clearAllToasts`: Remove all active toasts
 *
 * ## Provider Usage
 * Wrap your application root or feature area with ToastProvider:
 *
 * ```tsx
 * import { ToastProvider } from './contexts/ToastContext';
 *
 * function App() {
 *   return (
 *     <ToastProvider>
 *       <YourApplication />
 *     </ToastProvider>
 *   );
 * }
 * ```
 *
 * ## Consumer Patterns
 * Use the `useToast` hook to access context values:
 *
 * ```tsx
 * import { useToast } from './contexts/ToastContext';
 *
 * function SaveButton() {
 *   const { addToast } = useToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       addToast({
 *         message: 'Data saved successfully!',
 *         variant: 'success'
 *       });
 *     } catch (error) {
 *       addToast({
 *         message: 'Failed to save data. Please try again.',
 *         variant: 'error',
 *         duration: 7000
 *       });
 *     }
 *   };
 *
 *   return <button onClick={handleSave}>Save</button>;
 * }
 * ```
 */

import * as React from 'react';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Toast, ToastContainer, ToastVariant } from '../components/ui/Toast';

/**
 * Toast item interface
 *
 * Represents a single toast notification in the global state
 */
export interface ToastItem {
  /**
   * Unique identifier for the toast
   */
  id: string;
  /**
   * The message text to display
   */
  message: string;
  /**
   * Visual variant and semantic meaning (success, error, warning, info)
   */
  variant: ToastVariant;
  /**
   * Auto-dismiss duration in milliseconds (default: 5000, 0 = no auto-dismiss)
   */
  duration?: number;
}

/**
 * Options for adding a new toast
 *
 * ID will be auto-generated, so it's excluded from the options
 */
export type AddToastOptions = Omit<ToastItem, 'id'>;

/**
 * Shape of the ToastContext value
 */
export interface ToastContextValue {
  /**
   * Array of all active toast notifications
   */
  toasts: ToastItem[];

  /**
   * Add a new toast notification
   *
   * @param options - Toast configuration (message, variant, optional duration)
   * @returns The unique ID of the created toast
   *
   * @example
   * const toastId = addToast({
   *   message: 'Flow saved successfully!',
   *   variant: 'success'
   * });
   *
   * @example
   * addToast({
   *   message: 'Failed to save flow',
   *   variant: 'error',
   *   duration: 7000
   * });
   */
  addToast: (options: AddToastOptions) => string;

  /**
   * Remove a specific toast by its ID
   *
   * @param id - The unique identifier of the toast to remove
   *
   * @example
   * removeToast('toast-123456789');
   */
  removeToast: (id: string) => void;

  /**
   * Remove all active toasts
   *
   * @example
   * clearAllToasts();
   */
  clearAllToasts: () => void;
}

/**
 * Props for the ToastProvider component
 */
export interface ToastProviderProps {
  /**
   * Child components that will have access to the toast context
   */
  children: ReactNode;
  /**
   * Maximum number of toasts to display simultaneously (default: 5)
   * Oldest toasts will be auto-removed when limit is reached
   */
  maxToasts?: number;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Generate a unique toast ID
 */
const generateToastId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `toast-${timestamp}-${random}`;
};

/**
 * ToastProvider - Context provider for global toast notifications
 *
 * This provider manages the state of all toast notifications in the application.
 * It automatically renders a ToastContainer with all active toasts and provides
 * functions to add, remove, and clear toasts through the context.
 *
 * ## Features
 * - Automatic toast ID generation
 * - Auto-dismiss functionality (configurable per toast)
 * - Maximum toast limit to prevent screen clutter
 * - Automatic removal of oldest toast when limit is exceeded
 * - Built-in ToastContainer rendering (no manual container needed)
 *
 * ## Props
 * - `children`: Components that will have access to toast context
 * - `maxToasts`: Maximum number of simultaneous toasts (default: 5)
 *
 * ## Usage
 * Wrap your application or feature area with this provider:
 *
 * ```tsx
 * <ToastProvider maxToasts={5}>
 *   <App />
 * </ToastProvider>
 * ```
 *
 * Then use the `useToast` hook in any child component:
 *
 * ```tsx
 * function MyComponent() {
 *   const { addToast } = useToast();
 *
 *   const showSuccess = () => {
 *     addToast({
 *       message: 'Operation completed!',
 *       variant: 'success'
 *     });
 *   };
 *
 *   return <button onClick={showSuccess}>Click me</button>;
 * }
 * ```
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  /**
   * Add a new toast notification
   *
   * Automatically generates a unique ID and adds the toast to the state.
   * If the maximum toast limit is reached, removes the oldest toast first.
   */
  const addToast = useCallback(
    (options: AddToastOptions): string => {
      const id = generateToastId();
      const newToast: ToastItem = {
        id,
        ...options,
      };

      setToasts((prevToasts) => {
        const updatedToasts = [...prevToasts, newToast];
        // If max limit exceeded, remove oldest toast (first in array)
        if (updatedToasts.length > maxToasts) {
          return updatedToasts.slice(1);
        }
        return updatedToasts;
      });

      return id;
    },
    [maxToasts]
  );

  /**
   * Remove a specific toast by ID
   *
   * Filters out the toast with the matching ID from the state.
   */
  const removeToast = useCallback((id: string): void => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Clear all active toasts
   *
   * Removes all toasts from the state at once.
   */
  const clearAllToasts = useCallback((): void => {
    setToasts([]);
  }, []);

  const contextValue: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Render ToastContainer with all active toasts */}
      {toasts.length > 0 && (
        <ToastContainer>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              message={toast.message}
              variant={toast.variant}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </ToastContainer>
      )}
    </ToastContext.Provider>
  );
};
ToastProvider.displayName = 'ToastProvider';

/**
 * useToast - Custom hook to access toast context
 *
 * This hook provides access to the toast context value, including the current
 * toasts array and functions to manage toasts. It must be used within a component
 * that is a child of ToastProvider.
 *
 * ## Returns
 * An object containing:
 * - `toasts`: Array of active toast notifications
 * - `addToast`: Function to add a new toast
 * - `removeToast`: Function to remove a toast by ID
 * - `clearAllToasts`: Function to remove all toasts
 *
 * ## Throws
 * Error if used outside of ToastProvider
 *
 * ## Usage
 *
 * ```tsx
 * import { useToast } from './contexts/ToastContext';
 *
 * function MyComponent() {
 *   const { addToast } = useToast();
 *
 *   const handleError = (error: Error) => {
 *     addToast({
 *       message: error.message,
 *       variant: 'error',
 *       duration: 7000
 *     });
 *   };
 *
 *   const handleSuccess = () => {
 *     addToast({
 *       message: 'Success!',
 *       variant: 'success'
 *     });
 *   };
 *
 *   const handleWarning = () => {
 *     addToast({
 *       message: 'Warning: This action cannot be undone',
 *       variant: 'warning',
 *       duration: 10000
 *     });
 *   };
 *
 *   const handleInfo = () => {
 *     addToast({
 *       message: 'New updates available',
 *       variant: 'info'
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleError}>Show Error</button>
 *       <button onClick={handleSuccess}>Show Success</button>
 *       <button onClick={handleWarning}>Show Warning</button>
 *       <button onClick={handleInfo}>Show Info</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * // Using in an async operation
 * const { addToast } = useToast();
 *
 * const saveFlow = async () => {
 *   try {
 *     await api.saveFlow(flowData);
 *     addToast({
 *       message: 'Flow saved successfully!',
 *       variant: 'success'
 *     });
 *   } catch (error) {
 *     addToast({
 *       message: `Failed to save: ${error.message}`,
 *       variant: 'error',
 *       duration: 0 // Don't auto-dismiss errors
 *     });
 *   }
 * };
 */
export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
