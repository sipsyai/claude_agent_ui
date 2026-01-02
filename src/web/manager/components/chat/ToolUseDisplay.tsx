/**
 * ToolUseDisplay Component
 *
 * Displays tool execution details with expandable input/output sections, including
 * tool name, input parameters, output results, and loading states. Provides a visual
 * representation of tool invocations during agent/assistant conversations with copy-to-clipboard
 * functionality and auto-expand behavior for short results.
 *
 * ## Features
 * - Tool name display with emoji icon mapping
 * - Expandable input parameters section with JSON formatting
 * - Expandable output results section with auto-expand for short results
 * - Loading state indicators (spinner and "Running..." text)
 * - Copy-to-clipboard functionality for both input and output
 * - Dark theme styling with Tailwind CSS
 * - Collapsible sections using HTML `<details>` elements
 * - Responsive max-height with scroll for long outputs
 *
 * ## Tool Use Visualization
 * Tool executions are displayed in a bordered card with three main sections:
 *
 * **Header:**
 * - Tool name with emoji icon (e.g., 📖 Read, ✍️ Write, 💻 Bash)
 * - Purple-colored tool name text (text-purple-400)
 * - Loading spinner and "Running..." text when isLoading is true
 * - Horizontal layout with space-between alignment
 *
 * **Input Parameters Section (📥):**
 * - Collapsible `<details>` element (collapsed by default)
 * - Arrow indicator (▶) rotates 90° when expanded
 * - JSON-formatted input display with 2-space indentation
 * - Copy button positioned absolutely in top-right
 * - Black background (bg-black/40) with gray border
 * - Horizontal scroll for wide content
 *
 * **Output Result Section (📤):**
 * - Collapsible `<details>` element (auto-expands for results < 200 chars)
 * - Arrow indicator (▶) rotates 90° when expanded
 * - Green checkmark (✓) when result is available and not loading
 * - Smart rendering: plain text for strings, JSON for objects
 * - Copy button for result content
 * - Max height 96 (max-h-96 = 384px) with vertical scroll
 * - Black background (bg-black/40) with gray border
 *
 * ## Input/Output Display
 * Input and output are rendered with smart formatting:
 *
 * **Input Parameters:**
 * - Always JSON stringified with 2-space indentation
 * - Displayed in `<pre>` element with monospace font
 * - Horizontal scroll (overflow-x-auto) for wide content
 * - Right padding (pr-16) to prevent overlap with copy button
 * - Border and background for visual separation
 *
 * **Output Results:**
 * - String results: Displayed as-is with whitespace preserved (pre-wrap) and word breaking
 * - Object results: JSON stringified with 2-space indentation
 * - Max height constraint (max-h-96) with vertical scroll for long outputs
 * - White-space handling: pre-wrap for strings, pre for JSON
 * - Break words for long strings to prevent horizontal overflow
 *
 * ## Collapsible Sections
 * Both input and output use HTML `<details>` elements for collapsibility:
 *
 * **Collapse Behavior:**
 * - Input section: Collapsed by default (open={false})
 * - Output section: Auto-expands for results shorter than 200 characters
 * - Arrow indicator (▶) in summary element
 * - Arrow rotates 90° when expanded via group-open:rotate-90
 * - Smooth transition animation on rotation
 *
 * **Interaction:**
 * - Click summary to toggle collapse/expand
 * - Cursor changes to pointer on hover
 * - Summary text color changes on hover (text-gray-400 → text-gray-200)
 * - User cannot select summary text (select-none)
 * - Group modifier for coordinating arrow rotation with open state
 *
 * ## Auto-Expand Behavior
 * The output section automatically expands for short results:
 *
 * - Threshold: 200 characters
 * - Logic: `typeof toolResult === 'string' && toolResult.length < 200`
 * - Applied via `open={shouldAutoExpand}` prop on details element
 * - Prevents unnecessary clicks for short, easily readable results
 * - Long results (≥ 200 chars) remain collapsed by default
 * - User can still collapse auto-expanded sections manually
 *
 * ## Icon Mapping
 * Each tool has a distinctive emoji icon for quick visual identification:
 *
 * - **Read** (📖): File reading operations
 * - **Write** (✍️): File writing operations
 * - **Edit** (✏️): File editing operations
 * - **Bash** (💻): Shell command execution
 * - **Glob** (🔍): File pattern matching
 * - **Grep** (🔎): Content search operations
 * - **Skill** (🎯): Skill execution
 * - **WebFetch** (🌐): Web content fetching
 * - **WebSearch** (🔍): Web search operations
 * - **Task** (📋): Task execution
 * - **Default** (🔧): Unknown or unrecognized tools
 *
 * ## Loading States
 * The component displays loading feedback in two scenarios:
 *
 * **Running State (isLoading=true, no result):**
 * - Animated spinner in header (rotating circle SVG)
 * - "Running..." text next to spinner
 * - Small text size (text-xs) in gray (text-gray-400)
 * - Pulsing placeholder below output section
 * - "Waiting for result..." message with pulsing icon
 *
 * **Completed with Result (isLoading=false, has result):**
 * - Green checkmark (✓) in output section summary
 * - No spinner or "Running..." text
 * - Output section available for expansion
 *
 * ## Copy Functionality
 * Both input and output sections have copy-to-clipboard buttons:
 *
 * **Button Features:**
 * - Positioned absolutely in top-right corner of content area
 * - Icon: 📋 Copy
 * - Background: bg-gray-700 with hover effect (hover:bg-gray-600)
 * - Small text size (text-xs) with gray text (text-gray-300)
 * - Rounded corners with padding (px-2 py-1)
 * - Tooltip on hover: "Copy to clipboard"
 * - Smooth transition on hover
 *
 * **Copy Behavior:**
 * - Input: Copies JSON.stringify(toolInput, null, 2)
 * - Output (string): Copies raw string content
 * - Output (object): Copies JSON.stringify(toolResult, null, 2)
 * - Uses Clipboard API (navigator.clipboard.writeText)
 * - Requires HTTPS or localhost for security
 * - Silent operation (no toast notification currently)
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS for dark theme styling:
 *
 * **Container:**
 * - Background: bg-gray-800/50 (semi-transparent dark gray)
 * - Border: border-gray-700 (medium gray)
 * - Border radius: rounded-lg
 * - Padding: p-3 (12px)
 * - Spacing: space-y-2 (vertical gap between sections)
 * - Text size: text-sm (14px base)
 *
 * **Tool Header:**
 * - Flex layout with space-between
 * - Tool name: font-medium, text-purple-400
 * - Icon and name in flex row with gap-2
 * - Loading indicator: text-xs, text-gray-400
 *
 * **Collapsible Sections:**
 * - Summary text: text-xs, text-gray-400, hover:text-gray-200
 * - Arrow: inline-block with rotation transition
 * - Content background: bg-black/40 with border-gray-700
 * - Padding: p-3 for content, pr-16 for input (copy button space)
 * - Overflow: overflow-x-auto (horizontal), overflow-y-auto (vertical for output)
 * - Max height: max-h-96 for output section only
 *
 * **Copy Buttons:**
 * - Position: absolute, top-2, right-2
 * - Background: bg-gray-700, hover:bg-gray-600
 * - Text: text-xs, text-gray-300
 * - Transitions: transition-colors
 *
 * @example
 * // Basic usage with file read tool
 * <ToolUseDisplay
 *   toolName="Read"
 *   toolInput={{ file_path: "/home/user/document.txt", offset: 0, limit: 100 }}
 *   toolResult="File contents here..."
 * />
 *
 * @example
 * // Tool execution in progress (loading state)
 * <ToolUseDisplay
 *   toolName="Bash"
 *   toolInput={{ command: "npm install", timeout: 30000 }}
 *   isLoading={true}
 * />
 *
 * @example
 * // Completed tool with object result
 * <ToolUseDisplay
 *   toolName="WebFetch"
 *   toolInput={{ url: "https://api.example.com/data", prompt: "Get the data" }}
 *   toolResult={{
 *     status: 200,
 *     data: { message: "Success", count: 42 }
 *   }}
 * />
 *
 * @example
 * // Tool with error result (shows in output section)
 * <ToolUseDisplay
 *   toolName="Write"
 *   toolInput={{ file_path: "/etc/config.txt", content: "test" }}
 *   toolResult={{
 *     error: "Permission denied",
 *     code: "EACCES"
 *   }}
 * />
 *
 * @example
 * // Long result that won't auto-expand (>= 200 chars)
 * <ToolUseDisplay
 *   toolName="Grep"
 *   toolInput={{ pattern: "import", path: "./src", output_mode: "content" }}
 *   toolResult={`
 *     src/app.ts:1: import express from 'express';
 *     src/app.ts:2: import { Router } from 'express';
 *     src/config.ts:1: import dotenv from 'dotenv';
 *     ... (many more lines)
 *   `}
 * />
 *
 * @example
 * // Short result that auto-expands (< 200 chars)
 * <ToolUseDisplay
 *   toolName="Bash"
 *   toolInput={{ command: "pwd" }}
 *   toolResult="/home/user/projects/my-app"
 * />
 */

import React, { useState } from 'react';

/**
 * Props for the ToolUseDisplay component.
 *
 * @property {string} toolName - Name of the tool that was executed (e.g., "Read", "Write", "Bash"). Determines the icon displayed.
 * @property {any} toolInput - Input parameters passed to the tool. Can be any object or primitive. Displayed as JSON in the Input Parameters section.
 * @property {any} [toolResult] - Output result from the tool execution. Can be string or object. If string < 200 chars, auto-expands. Optional.
 * @property {boolean} [isLoading=false] - Whether the tool is currently executing. Shows spinner and "Running..." text when true.
 * @property {string} [className] - Optional CSS classes to apply to the root container element for custom styling.
 */
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
  // Auto-expand short results (< 200 chars)
  const shouldAutoExpand = typeof toolResult === 'string' && toolResult.length < 200;

  /**
   * Maps tool names to emoji icons for visual identification.
   *
   * Returns a distinctive emoji for each recognized tool type. Falls back to
   * a generic wrench icon (🔧) for unknown or unrecognized tools.
   *
   * Supported tools: Read, Write, Edit, Bash, Glob, Grep, Skill, WebFetch, WebSearch, Task
   *
   * @internal
   * @param {string} name - The tool name to get an icon for
   * @returns {string} Emoji icon representing the tool (e.g., "📖" for Read, "💻" for Bash)
   */
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

  /**
   * Copies text to the system clipboard using the Clipboard API.
   *
   * Uses the modern Clipboard API (navigator.clipboard.writeText) for copying
   * content. Requires HTTPS or localhost for security. Currently operates silently
   * without user feedback (toast notification could be added).
   *
   * @internal
   * @param {string} text - The text to copy to clipboard (input JSON or output result)
   */
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

ToolUseDisplay.displayName = 'ToolUseDisplay';

export default ToolUseDisplay;
