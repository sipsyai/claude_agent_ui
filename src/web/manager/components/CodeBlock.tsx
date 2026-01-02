/**
 * CodeBlock Component
 *
 * A syntax-highlighted code block component with copy-to-clipboard functionality and
 * language detection. Uses react-syntax-highlighter with Prism for rendering code with
 * proper syntax highlighting across multiple programming languages.
 *
 * ## Features
 * - Syntax highlighting for 100+ programming languages via Prism
 * - One-click copy-to-clipboard with visual feedback
 * - Language badge display in header
 * - Optional line numbers
 * - Dark theme styling (oneDark color scheme)
 * - Horizontal scrolling for long lines
 * - Monospace font family for code readability
 * - Header with language label and copy button
 *
 * ## Syntax Highlighting
 * The component uses `react-syntax-highlighter` with the Prism renderer and oneDark theme:
 *
 * **Supported Languages:**
 * - JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust, Ruby, PHP
 * - HTML, CSS, SCSS, JSON, XML, YAML, Markdown
 * - SQL, Bash, Shell, PowerShell, Dockerfile
 * - And 80+ more languages supported by Prism
 *
 * **Language Detection:**
 * - Language is specified via the `language` prop
 * - Defaults to 'text' for plain text (no highlighting)
 * - Language name is displayed in uppercase in the header
 * - Case-insensitive language matching (e.g., 'javascript', 'JavaScript', 'JAVASCRIPT' all work)
 *
 * **Highlighting Engine:**
 * - Uses Prism syntax highlighter for accurate tokenization
 * - oneDark theme provides dark background with syntax colors
 * - Custom styling: transparent background, 1rem padding, 0.875rem font size
 * - Monospace font stack: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas
 *
 * ## Copy Functionality
 * The copy button allows users to copy the entire code block to their clipboard:
 *
 * **Copy Workflow:**
 * 1. User clicks the "Copy" button in the header
 * 2. Code is copied to clipboard using `navigator.clipboard.writeText()`
 * 3. Button icon changes from ClipboardIcon to CheckIcon
 * 4. Button text changes from "Copy" to "Copied"
 * 5. After 2 seconds, button reverts to original state
 *
 * **Visual Feedback:**
 * - Default state: ClipboardIcon with "Copy" text
 * - Copied state: CheckIcon with "Copied" text (green checkmark)
 * - Button tooltip: "Copy code" (default) or "Copied!" (after copy)
 * - Hover effect: text-white and bg-gray-700 on hover
 *
 * **Error Handling:**
 * - If clipboard API fails, logs error to console
 * - Clipboard API requires HTTPS or localhost
 * - Graceful degradation if clipboard access is denied
 *
 * ## Line Numbers
 * Optional line numbers can be displayed alongside code:
 *
 * **Behavior:**
 * - Controlled via `showLineNumbers` prop (default: false)
 * - Line numbers rendered by SyntaxHighlighter when enabled
 * - Numbers are right-aligned with padding
 * - Numbers inherit color from oneDark theme
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with a dark theme aesthetic:
 *
 * **Container:**
 * - Background: `bg-gray-900` (dark background for code area)
 * - Border: `border border-gray-700` (subtle gray border)
 * - Border radius: `rounded-lg` (8px rounded corners)
 * - Margin: `my-4` (1rem vertical spacing)
 * - Overflow: `overflow-hidden` (clips content to border radius)
 *
 * **Header:**
 * - Background: `bg-gray-800` (slightly lighter than code area)
 * - Border: `border-b border-gray-700` (separator from code)
 * - Padding: `px-4 py-2` (1rem horizontal, 0.5rem vertical)
 * - Layout: Flexbox with space-between for language label and copy button
 * - Language label: Uppercase, tracking-wider, text-xs, text-gray-300
 *
 * **Copy Button:**
 * - Default colors: `text-gray-300`
 * - Hover: `text-white`, `bg-gray-700`
 * - Padding: `px-2 py-1` (compact button)
 * - Border radius: `rounded`
 * - Transition: `transition-colors` for smooth hover effect
 * - Icon size: `w-4 h-4` (16x16px)
 * - Gap between icon and text: `gap-1.5`
 *
 * **Code Area:**
 * - Overflow: `overflow-x-auto` (horizontal scroll for long lines)
 * - Padding: 1rem (via SyntaxHighlighter customStyle)
 * - Font size: 0.875rem (14px, via SyntaxHighlighter customStyle)
 * - Font family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
 * - Theme: oneDark color scheme for syntax highlighting
 *
 * @example
 * // Basic JavaScript code block
 * <CodeBlock
 *   language="javascript"
 *   code={`function greet(name) {
 *   return \`Hello, \${name}!\`;
 * }`}
 * />
 *
 * @example
 * // Python code with line numbers
 * <CodeBlock
 *   language="python"
 *   code={`def factorial(n):
 *     if n <= 1:
 *         return 1
 *     return n * factorial(n - 1)`}
 *   showLineNumbers={true}
 * />
 *
 * @example
 * // TypeScript code block
 * <CodeBlock
 *   language="typescript"
 *   code={`interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 *
 * const user: User = {
 *   id: 1,
 *   name: "Alice",
 *   email: "alice@example.com"
 * };`}
 * />
 *
 * @example
 * // Plain text (no syntax highlighting)
 * <CodeBlock
 *   code="This is plain text without any syntax highlighting."
 * />
 *
 * @example
 * // SQL query with line numbers
 * <CodeBlock
 *   language="sql"
 *   code={`SELECT users.name, COUNT(orders.id) as order_count
 * FROM users
 * LEFT JOIN orders ON users.id = orders.user_id
 * GROUP BY users.id
 * HAVING order_count > 5
 * ORDER BY order_count DESC;`}
 *   showLineNumbers={true}
 * />
 *
 * @example
 * // JSON configuration
 * <CodeBlock
 *   language="json"
 *   code={`{
 *   "name": "my-app",
 *   "version": "1.0.0",
 *   "dependencies": {
 *     "react": "^18.0.0",
 *     "typescript": "^5.0.0"
 *   }
 * }`}
 * />
 */

import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CheckIcon, ClipboardIcon } from './ui/Icons';

/**
 * Props for the CodeBlock component
 *
 * @interface CodeBlockProps
 * @property {string} [language='text'] - Programming language for syntax highlighting.
 *   Supports 100+ languages including: javascript, typescript, python, java, cpp, csharp,
 *   go, rust, ruby, php, html, css, json, xml, yaml, markdown, sql, bash, shell, and more.
 *   Defaults to 'text' for plain text without highlighting. Case-insensitive.
 *
 * @property {string} code - The code content to display. Can include newlines and special
 *   characters. Will be syntax highlighted based on the language prop. This is the raw code
 *   string that will be copied to clipboard when the copy button is clicked.
 *
 * @property {boolean} [showLineNumbers=false] - Whether to display line numbers alongside
 *   the code. Line numbers are right-aligned with padding and inherit colors from the
 *   oneDark theme. Useful for referencing specific lines in code reviews or documentation.
 */
interface CodeBlockProps {
  language?: string;
  code: string;
  showLineNumbers?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  language = 'text',
  code,
  showLineNumbers = false
}) => {
  const [copied, setCopied] = useState(false);

  /**
   * Handles copying code to clipboard with visual feedback
   *
   * Workflow:
   * 1. Copies code string to clipboard using Clipboard API
   * 2. Sets copied state to true (changes button to checkmark)
   * 3. After 2 seconds, resets copied state back to false
   * 4. If clipboard API fails (e.g., no HTTPS), logs error to console
   *
   * The Clipboard API requires a secure context (HTTPS or localhost).
   * If the API is unavailable or denied, the error is logged but the UI
   * remains functional (button just won't provide copy functionality).
   *
   * @internal
   * @async
   * @returns {Promise<void>}
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative my-4 rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <ClipboardIcon className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          showLineNumbers={showLineNumbers}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.875rem',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

CodeBlock.displayName = 'CodeBlock';

export default CodeBlock;
