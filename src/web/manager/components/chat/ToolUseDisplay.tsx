/**
 * ToolUseDisplay Component
 * Displays tool execution details with expandable input/output sections
 * Based on TaskExecutionModal's tool display logic
 */

import React, { useState } from 'react';

export interface ToolUseDisplayProps {
  toolName: string;
  toolInput: any;
  toolResult?: any;
  isLoading?: boolean;
  className?: string;
}

const ToolUseDisplay: React.FC<ToolUseDisplayProps> = ({
  toolName,
  toolInput,
  toolResult,
  isLoading = false,
  className = '',
}) => {
  // Auto-expand short results
  const shouldAutoExpand = typeof toolResult === 'string' && toolResult.length < 200;

  // Tool icon mapping
  const getToolIcon = (name: string): string => {
    const iconMap: Record<string, string> = {
      Read: '📖',
      Write: '✍️',
      Edit: '✏️',
      Bash: '💻',
      Glob: '🔍',
      Grep: '🔎',
      Skill: '🎯',
      WebFetch: '🌐',
      WebSearch: '🔍',
      Task: '📋',
    };
    return iconMap[name] || '🔧';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  return (
    <div className={`text-sm space-y-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700 ${className}`}>
      {/* Tool Name Header */}
      <div className="flex items-center justify-between">
        <div className="font-medium text-purple-400 flex items-center gap-2">
          <span>{getToolIcon(toolName)}</span>
          <span>{toolName}</span>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Running...</span>
          </div>
        )}
      </div>

      {/* Input Parameters */}
      {toolInput && (
        <details className="cursor-pointer group">
          <summary className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-2 select-none">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            <span>📥 Input Parameters</span>
          </summary>
          <div className="mt-2 relative">
            <button
              onClick={() => copyToClipboard(JSON.stringify(toolInput, null, 2))}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
              title="Copy to clipboard"
            >
              📋 Copy
            </button>
            <pre className="text-xs bg-black/40 p-3 pr-16 rounded overflow-x-auto border border-gray-700">
              {JSON.stringify(toolInput, null, 2)}
            </pre>
          </div>
        </details>
      )}

      {/* Output Result */}
      {toolResult !== undefined && toolResult !== null && (
        <details className="cursor-pointer group" open={shouldAutoExpand}>
          <summary className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-2 select-none">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            <span>📤 Output Result</span>
            {!isLoading && (
              <span className="text-green-400 text-xs ml-2">✓</span>
            )}
          </summary>
          <div className="mt-2 relative">
            <button
              onClick={() =>
                copyToClipboard(
                  typeof toolResult === 'string'
                    ? toolResult
                    : JSON.stringify(toolResult, null, 2)
                )
              }
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
              title="Copy to clipboard"
            >
              📋 Copy
            </button>
            <div className="text-xs bg-black/40 p-3 pr-16 rounded overflow-x-auto border border-gray-700 max-h-96 overflow-y-auto">
              {typeof toolResult === 'string' ? (
                <pre className="whitespace-pre-wrap break-words">{toolResult}</pre>
              ) : (
                <pre>{JSON.stringify(toolResult, null, 2)}</pre>
              )}
            </div>
          </div>
        </details>
      )}

      {/* Loading State */}
      {isLoading && !toolResult && (
        <div className="text-xs text-gray-400 italic flex items-center gap-2 py-2">
          <svg className="animate-pulse h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0110 10h-2a8 8 0 00-8-8V2z" opacity="0.75" />
          </svg>
          <span>Waiting for result...</span>
        </div>
      )}
    </div>
  );
};

export default ToolUseDisplay;
