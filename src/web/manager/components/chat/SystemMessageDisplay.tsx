/**
 * SystemMessageDisplay Component
 * Displays SDK system messages (init, result, etc.) in a collapsible format
 */

import React from 'react';

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
  // Get icon and color based on message type
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

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add toast notification
    });
  };

  // Format content for display
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

export default SystemMessageDisplay;
