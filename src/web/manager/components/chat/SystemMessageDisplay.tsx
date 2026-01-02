/**
 * SystemMessageDisplay Component
 *
 * Displays SDK system messages (init, result, error, stream events, permission requests/responses)
 * in a collapsible, color-coded format with copy-to-clipboard functionality. System messages
 * provide visibility into the conversation lifecycle and SDK events for debugging and monitoring.
 *
 * ## Features
 * - Collapsible message display with expandable details
 * - Type-based visual styling (icon, color, label)
 * - Timestamp display with 24-hour format
 * - Copy-to-clipboard functionality for message content
 * - Smart content formatting based on message type
 * - Raw JSON data viewer (nested collapsible section)
 * - Dark theme styling with Tailwind CSS
 *
 * ## System Message Rendering
 * Messages are displayed in a `<details>` element with a summary header and expandable content:
 *
 * **Summary Header:**
 * - Collapsible arrow indicator (▶, rotates 90° when open)
 * - Message type icon (emoji)
 * - Message type label (e.g., "Session Init", "Result")
 * - Timestamp in HH:MM:SS format (24-hour)
 * - Hover effect (bg-gray-800/50)
 * - Color-coded text based on message type
 *
 * **Expandable Content:**
 * - Formatted content display in code block with syntax highlighting
 * - Copy button (absolute positioned, top-right)
 * - Max height with scroll (max-h-64)
 * - Raw data viewer (nested details, max-h-48)
 *
 * ## Message Types
 * Each message type has a unique icon, color, and label:
 *
 * - **init** (⚙️, blue): Session initialization messages
 *   - Shows session ID, model, and available tools
 *   - Formatted as: `Session ID: ...\nModel: ...\nTools: ...`
 *
 * - **result** (✅, green): Result messages from tool executions or operations
 *   - Shows success/error status and result content
 *   - Formatted as: `Status: Success/Error\nResult: ...`
 *
 * - **error** (❌, red): Error messages from SDK or system
 *   - Displays error details and stack traces
 *   - Uses JSON stringification for complex error objects
 *
 * - **stream_event** (📡, purple): Streaming events during message generation
 *   - Shows real-time updates from SSE streams
 *   - Raw JSON display for event payload
 *
 * - **permission_request** (🔐, yellow): Permission requests requiring user approval
 *   - Shows what permission is being requested
 *   - Typically followed by permission_response
 *
 * - **permission_response** (✓, green): Permission granted/denied responses
 *   - Shows user's decision on permission request
 *   - Green color indicates approval
 *
 * - **default** (📌, gray): Unknown or generic system messages
 *   - Fallback for unrecognized message types
 *   - Uses generic "System Message" label
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS for dark theme styling:
 *
 * - Text size: `text-xs` (small, 12px) for compact display
 * - Summary hover: `hover:bg-gray-800/50` (subtle highlight on hover)
 * - Arrow rotation: `group-open:rotate-90` (90° rotation when expanded)
 * - Content background: `bg-black/40` (semi-transparent black)
 * - Border color: `border-gray-700` (medium gray)
 * - Code block: `overflow-x-auto` (horizontal scroll) and `overflow-y-auto` (vertical scroll)
 * - Copy button: `bg-gray-700 hover:bg-gray-600` (gray with hover effect)
 * - Color-coded text: Blue (init), Green (result, permission_response), Red (error), Purple (stream_event), Yellow (permission_request), Gray (default)
 *
 * ## Copy Functionality
 * Messages can be copied to clipboard via a button in the content section:
 *
 * - Button positioned absolutely in top-right corner
 * - Uses Clipboard API (navigator.clipboard.writeText)
 * - Copies formatted content (not raw JSON)
 * - Icon: 📋 Copy
 * - Hover effect for visual feedback
 * - Requires HTTPS or localhost for security
 *
 * ## Content Formatting
 * Content is formatted intelligently based on message type:
 *
 * **String Content:**
 * - Displayed as-is in pre-formatted text
 *
 * **Init Messages (content.session_id):**
 * - Extracts: session_id, model, tools array
 * - Formats as multi-line text with labels
 * - Tools array joined with commas
 *
 * **Result Messages (content.is_error):**
 * - Shows status (Success/Error) based on is_error flag
 * - Displays result content or "N/A"
 * - Formatted as multi-line text
 *
 * **Other Objects:**
 * - JSON stringified with 2-space indentation
 * - Pretty-printed for readability
 * - Syntax highlighting via pre element
 *
 * @example
 * // Basic usage with session init message
 * <SystemMessageDisplay
 *   messageType="init"
 *   content={{
 *     session_id: "abc123",
 *     model: "claude-3-5-sonnet",
 *     tools: ["read_file", "write_file", "execute_code"]
 *   }}
 *   timestamp={new Date()}
 * />
 *
 * @example
 * // Result message with success status
 * <SystemMessageDisplay
 *   messageType="result"
 *   content={{
 *     is_error: false,
 *     result: "File written successfully"
 *   }}
 *   timestamp={new Date()}
 * />
 *
 * @example
 * // Error message with stack trace
 * <SystemMessageDisplay
 *   messageType="error"
 *   content={{
 *     message: "File not found",
 *     stack: "Error: File not found\n  at readFile (...)"
 *   }}
 *   timestamp={new Date()}
 * />
 *
 * @example
 * // Permission request with custom className
 * <SystemMessageDisplay
 *   messageType="permission_request"
 *   content={{
 *     action: "write_file",
 *     path: "/home/user/document.txt"
 *   }}
 *   timestamp={new Date()}
 *   className="my-4"
 * />
 */

import React from 'react';

/**
 * Props for the SystemMessageDisplay component.
 *
 * @property {string} messageType - Type of system message (init, result, error, stream_event, permission_request, permission_response, or custom)
 * @property {any} content - Message content (string, object, or structured data). Format varies by messageType.
 * @property {Date} timestamp - Time when the message was created
 * @property {string} [className] - Optional CSS classes to apply to the root element
 */
export interface SystemMessageDisplayProps {
  messageType: string;
  content: any;
  timestamp: Date;
  className?: string;
}

const SystemMessageDisplay: React.FC<SystemMessageDisplayProps> = ({
  messageType,
  content,
  timestamp,
  className = '',
}) => {
  /**
   * Maps message type to visual styling configuration.
   *
   * Returns an object with icon (emoji), color (Tailwind class), and label (display name)
   * for the given message type. Falls back to default styling for unknown types.
   *
   * @internal
   * @param {string} type - The message type (init, result, error, stream_event, permission_request, permission_response)
   * @returns {{ icon: string; color: string; label: string }} Styling configuration object
   */
  const getMessageStyle = (
    type: string
  ): { icon: string; color: string; label: string } => {
    const styles: Record<string, { icon: string; color: string; label: string }> = {
      init: { icon: '⚙️', color: 'text-blue-400', label: 'Session Init' },
      result: { icon: '✅', color: 'text-green-400', label: 'Result' },
      error: { icon: '❌', color: 'text-red-400', label: 'Error' },
      stream_event: { icon: '📡', color: 'text-purple-400', label: 'Stream Event' },
      permission_request: { icon: '🔐', color: 'text-yellow-400', label: 'Permission Request' },
      permission_response: { icon: '✓', color: 'text-green-400', label: 'Permission Granted' },
    };

    return (
      styles[type] || { icon: '📌', color: 'text-gray-400', label: 'System Message' }
    );
  };

  const style = getMessageStyle(messageType);

  /**
   * Formats a Date object as a 24-hour time string (HH:MM:SS).
   *
   * Uses the browser's locale with forced 24-hour format for consistent display.
   *
   * @internal
   * @param {Date} date - The date/time to format
   * @returns {string} Formatted time string (e.g., "14:32:05")
   */
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  /**
   * Copies text to the system clipboard using the Clipboard API.
   *
   * Requires HTTPS or localhost for security. Silently handles errors.
   * Could be extended to show toast notification on success/failure.
   *
   * @internal
   * @param {string} text - The text to copy to clipboard
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add toast notification
    });
  };

  /**
   * Formats message content for display based on message type.
   *
   * Applies intelligent formatting rules:
   * - String content: returned as-is
   * - Init messages: extracts session_id, model, tools into multi-line format
   * - Result messages: formats is_error flag and result into status display
   * - Other objects: JSON stringified with 2-space indentation
   *
   * @internal
   * @returns {string} Formatted content string for display in pre element
   */
  const getDisplayContent = (): string => {
    if (typeof content === 'string') {
      return content;
    }

    // For init messages, show key info
    if (messageType === 'init' && content.session_id) {
      return `Session ID: ${content.session_id}\nModel: ${content.model || 'N/A'}\nTools: ${(content.tools || []).join(', ')}`;
    }

    // For result messages, show outcome
    if (messageType === 'result' && content.is_error !== undefined) {
      return `Status: ${content.is_error ? 'Error' : 'Success'}\nResult: ${content.result || 'N/A'}`;
    }

    // Default: stringify
    return JSON.stringify(content, null, 2);
  };

  return (
    <details className={`text-xs space-y-1 group ${className}`}>
      <summary className={`cursor-pointer select-none hover:bg-gray-800/50 p-2 rounded flex items-center gap-2 ${style.color}`}>
        <span className="group-open:rotate-90 transition-transform inline-block text-gray-500">
          ▶
        </span>
        <span>{style.icon}</span>
        <span className="font-medium">{style.label}</span>
        <span className="text-gray-500 ml-auto">{formatTimestamp(timestamp)}</span>
      </summary>

      <div className="ml-4 mt-2 space-y-2">
        {/* Content Display */}
        <div className="relative">
          <button
            onClick={() => copyToClipboard(getDisplayContent())}
            className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            title="Copy to clipboard"
          >
            📋 Copy
          </button>
          <pre className="text-xs bg-black/40 p-3 pr-16 rounded overflow-x-auto border border-gray-700 max-h-64 overflow-y-auto">
            {getDisplayContent()}
          </pre>
        </div>

        {/* Raw Data (collapsed by default) */}
        <details className="cursor-pointer">
          <summary className="text-xs text-gray-500 hover:text-gray-300 select-none">
            View Raw Data
          </summary>
          <pre className="mt-1 text-xs bg-black/40 p-2 rounded overflow-x-auto border border-gray-700 max-h-48 overflow-y-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        </details>
      </div>
    </details>
  );
};

SystemMessageDisplay.displayName = 'SystemMessageDisplay';

export default SystemMessageDisplay;
