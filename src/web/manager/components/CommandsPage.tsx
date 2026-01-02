/**
 * CommandsPage - Slash commands discovery and listing interface
 *
 * Page-level component for displaying discovered slash commands from the
 * .claude/commands/ directory. Provides read-only view of command metadata,
 * configuration, and file locations with responsive grid layout.
 *
 * ## Features
 *
 * - Slash command listing with grid layout (1/2/3 columns responsive)
 * - Command metadata display (name, description, category)
 * - Tool configuration preview (allowed tools with overflow indicator)
 * - Model configuration display (model override per command)
 * - Argument hints display (expected argument format)
 * - File path display (relative path from project root)
 * - Empty state handling (no commands found message)
 * - Hover effects on command cards (border color transition)
 * - View Details button (placeholder for future detail modal)
 * - Discovery count display (total commands found)
 *
 * ## Command Listing
 *
 * Commands are displayed in a responsive grid layout:
 * - **Mobile (< 768px)**: 1 column (grid-cols-1)
 * - **Tablet (>= 768px)**: 2 columns (md:grid-cols-2)
 * - **Desktop (>= 1024px)**: 3 columns (lg:grid-cols-3)
 * - **Gap**: 6 spacing units (gap-6, 24px)
 *
 * ### Grid Layout Structure:
 * ```
 * +-------------------+  +-------------------+  +-------------------+
 * | Command Card      |  | Command Card      |  | Command Card      |
 * | /command-name     |  | /command-name     |  | /command-name     |
 * | Description...    |  | Description...    |  | Description...    |
 * | Category: x       |  | Category: x       |  | Category: x       |
 * | Allowed Tools:... |  | Allowed Tools:... |  | Allowed Tools:... |
 * | Model: ...        |  | Model: ...        |  | Model: ...        |
 * | Arguments: ...    |  | Arguments: ...    |  | Arguments: ...    |
 * | [View Details]    |  | [View Details]    |  | [View Details]    |
 * +-------------------+  +-------------------+  +-------------------+
 * ```
 *
 * ## Command Cards
 *
 * Each command card displays comprehensive metadata:
 *
 * ### Card Header Section:
 * - **Command Name**: Text primary color "/" prefix + command name (text-primary)
 * - **Description**: Muted gray text, or "No description" if missing
 * - **Category**: Small text label with category value (text-xs, text-muted-foreground)
 *
 * ### Card Content Section:
 * - **Allowed Tools** (conditional, if metadata.allowedTools exists):
 *   - Label: "Allowed Tools:" (font-semibold, text-sm, text-muted-foreground)
 *   - Tool badges: bg-secondary, px-2, py-0.5, rounded, text-xs
 *   - Shows first 3 tools with "+N" overflow indicator for remaining tools
 *   - Example: "Read" "Write" "Bash" "+5"
 * - **Model** (conditional, if metadata.model exists):
 *   - Label: "Model:" (font-semibold, text-sm, text-muted-foreground)
 *   - Model badge: bg-secondary, px-2, py-0.5, rounded, text-xs
 *   - Example: "claude-3-5-sonnet-20241022"
 * - **Arguments** (conditional, if metadata.argumentHint exists):
 *   - Label: "Arguments:" (font-semibold, text-sm, text-muted-foreground)
 *   - Hint text: text-xs, text-muted-foreground
 *   - Example: "<file-path>"
 * - **File Path**: Relative path from project root (text-xs, text-muted-foreground, mt-2)
 *   - Example: ".claude/commands/review.md"
 *
 * ### Card Footer Section:
 * - **View Details Button**: Full-width button (w-full), small size (sm)
 *   - Currently placeholder for future detail modal implementation
 *   - Will show full command content, metadata, and execution options
 *
 * ## Empty State
 *
 * When no commands are found (commands.length === 0):
 * - Centered empty state message: "No slash commands found in .claude/commands/"
 * - Muted text color (text-muted-foreground)
 * - Vertical padding: py-12
 * - Spans full grid width: col-span-full
 *
 * ## Styling Behavior
 *
 * ### Page Layout:
 * - **Container**: Fade-in animation on mount (animate-fade-in)
 * - **Heading**: Large responsive text (text-3xl sm:text-4xl), bold, centered, mb-2
 * - **Subheading**: Muted text with discovery count, centered, mb-8
 *
 * ### Card Styling:
 * - **Base**: Flexbox column layout (flex flex-col) for consistent footer positioning
 * - **Hover**: Border color transition to primary/80 with 300ms duration
 * - **Content**: Flex-grow to push footer to bottom (flex-grow)
 * - **Colors**: Uses theme colors (bg-card, text-card-foreground, border-secondary)
 *
 * ### Badge Styling:
 * - **Background**: Secondary background color (bg-secondary)
 * - **Padding**: Horizontal 2 units, vertical 0.5 units (px-2 py-0.5)
 * - **Border Radius**: Rounded corners (rounded)
 * - **Text**: Extra small size (text-xs)
 *
 * @example
 * // Basic usage in ManagerApp dashboard phase
 * function ManagerApp() {
 *   const [commands, setCommands] = useState<SlashCommand[]>([]);
 *
 *   useEffect(() => {
 *     async function loadCommands() {
 *       const data = await fetchSlashCommands(directory);
 *       setCommands(data);
 *     }
 *     loadCommands();
 *   }, [directory]);
 *
 *   return (
 *     <Layout>
 *       <CommandsPage commands={commands} />
 *     </Layout>
 *   );
 * }
 *
 * @example
 * // Understanding command structure
 * const exampleCommand: SlashCommand = {
 *   id: "1",
 *   name: "review-pr",
 *   description: "Review a pull request and provide feedback",
 *   path: "/path/to/project/.claude/commands/review-pr.md",
 *   relativePath: ".claude/commands/review-pr.md",
 *   content: "Review the pull request...",
 *   metadata: {
 *     allowedTools: ["Read", "Grep", "WebFetch"],
 *     argumentHint: "<pr-number>",
 *     model: "claude-3-5-sonnet-20241022",
 *     disableModelInvocation: false
 *   },
 *   category: "code-review"
 * };
 * // This command will display:
 * // - Header: "/review-pr" with description
 * // - Category: "code-review"
 * // - Allowed Tools: "Read" "Grep" "WebFetch"
 * // - Model: "claude-3-5-sonnet-20241022"
 * // - Arguments: "<pr-number>"
 * // - Path: ".claude/commands/review-pr.md"
 *
 * @example
 * // Empty state handling
 * function CommandsView({ directory }: { directory: string }) {
 *   const [commands, setCommands] = useState<SlashCommand[]>([]);
 *
 *   useEffect(() => {
 *     async function loadCommands() {
 *       const data = await fetchSlashCommands(directory);
 *       setCommands(data); // May be empty array
 *     }
 *     loadCommands();
 *   }, [directory]);
 *
 *   // If no commands found, displays:
 *   // "No slash commands found in .claude/commands/"
 *   return <CommandsPage commands={commands} />;
 * }
 *
 * @example
 * // Understanding metadata display
 * // Commands with different metadata configurations:
 *
 * // Command with all metadata:
 * const fullMetadata: SlashCommand = {
 *   id: "1",
 *   name: "deploy",
 *   description: "Deploy application to production",
 *   path: "/path/.claude/commands/deploy.md",
 *   relativePath: ".claude/commands/deploy.md",
 *   content: "...",
 *   metadata: {
 *     allowedTools: ["Bash", "Read", "Write", "Grep", "WebFetch"],
 *     argumentHint: "<environment>",
 *     model: "claude-3-opus-20240229"
 *   },
 *   category: "deployment"
 * };
 * // Displays: All sections (tools, model, arguments, category)
 *
 * // Command with minimal metadata:
 * const minimalMetadata: SlashCommand = {
 *   id: "2",
 *   name: "help",
 *   description: "Show available commands",
 *   path: "/path/.claude/commands/help.md",
 *   relativePath: ".claude/commands/help.md",
 *   content: "..."
 * };
 * // Displays: Only name, description ("Show available commands"), and path
 * // No category, tools, model, or arguments sections shown
 */

import React from 'react';
import type { SlashCommand } from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

/**
 * Props for the CommandsPage component
 *
 * @property {SlashCommand[]} commands - Array of slash commands discovered from .claude/commands/
 *   - Each command includes name, description, path, metadata, and optional category
 *   - Metadata contains allowedTools, model, argumentHint, disableModelInvocation
 *   - Empty array triggers empty state display
 *   - Commands are displayed in a responsive grid layout
 */
interface CommandsPageProps {
  commands: SlashCommand[];
}

const CommandsPage: React.FC<CommandsPageProps> = ({ commands }) => {
  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-center">Slash Commands</h1>
      <p className="text-muted-foreground text-center mb-8">
        Discovered {commands.length} slash commands in .claude/commands/
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {commands.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No slash commands found in .claude/commands/
          </div>
        ) : (
          commands.map((command) => (
            <Card key={command.id} className="flex flex-col hover:border-primary/80 transition-colors duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-primary">/</span>
                  {command.name}
                </CardTitle>
                <CardDescription>
                  {command.description || 'No description'}
                </CardDescription>
                {command.category && (
                  <span className="text-xs text-muted-foreground">
                    Category: {command.category}
                  </span>
                )}
              </CardHeader>
              <CardContent className="flex-grow">
                {command.metadata?.allowedTools && Array.isArray(command.metadata.allowedTools) && command.metadata.allowedTools.length > 0 && (
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Allowed Tools:</h4>
                    <div className="flex flex-wrap gap-1">
                      {command.metadata.allowedTools.slice(0, 3).map((tool, idx) => (
                        <span key={idx} className="text-xs bg-secondary px-2 py-0.5 rounded">
                          {tool}
                        </span>
                      ))}
                      {command.metadata.allowedTools.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{command.metadata.allowedTools.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {command.metadata?.model && (
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Model:</h4>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                      {command.metadata.model}
                    </span>
                  </div>
                )}
                {command.metadata?.argumentHint && (
                  <div className="mb-2">
                    <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Arguments:</h4>
                    <span className="text-xs text-muted-foreground">
                      {command.metadata.argumentHint}
                    </span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {command.relativePath}
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" size="sm">
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

CommandsPage.displayName = 'CommandsPage';

export default CommandsPage;
