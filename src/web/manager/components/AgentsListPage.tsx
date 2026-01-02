/**
 * AgentsListPage - Project Structure Discovery View
 *
 * A tabbed page component that displays discovered slash commands and skills from the project's
 * `.claude/` directory. Provides a visual overview of available project resources with metadata
 * and tool configuration previews.
 *
 * ## Features
 *
 * - **Tabbed Interface**: Switch between slash commands and skills with visual tab navigation
 * - **Resource Listing**: Grid-based display with responsive columns (1/2/3 based on viewport)
 * - **Tool Configuration Preview**: Shows first 3 allowed tools with overflow indicator
 * - **Empty States**: User-friendly messages when no resources are discovered
 * - **Action Buttons**: View details functionality for each resource
 * - **Resource Counts**: Dynamic count badges in tab buttons
 *
 * ## Tabbed Interface
 *
 * The component provides two tabs with count indicators:
 *
 * - **Slash Commands Tab** (`activeTab === 'commands'`):
 *   - Displays all discovered slash commands from `.claude/commands/` directory
 *   - Button shows count: "Slash Commands (N)"
 *   - Primary variant when active, secondary when inactive
 *
 * - **Skills Tab** (`activeTab === 'skills'`):
 *   - Displays all discovered skills from `.claude/skills/` directory
 *   - Button shows count: "Skills (N)"
 *   - Primary variant when active, secondary when inactive
 *
 * Tab switching is instant with no loading state, as data is pre-loaded via props.
 *
 * ## Resource Listing
 *
 * Both tabs display resources in a responsive grid layout:
 *
 * - **Grid Layout**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
 *   - 1 column on mobile (< 768px)
 *   - 2 columns on tablet (768px - 1024px)
 *   - 3 columns on desktop (>= 1024px)
 *
 * ### Slash Command Cards
 *
 * Each command card displays:
 *
 * - **Header**:
 *   - Title: Command name with "/" prefix (e.g., "/review-pr")
 *   - Description: Command description or "No description" fallback
 *   - Category badge: Optional category label (if metadata.category exists)
 *
 * - **Content**:
 *   - Allowed Tools section (if metadata.allowedTools array has items):
 *     * First 3 tools as badges
 *     * Overflow indicator "+N" for remaining tools
 *   - Relative file path (e.g., ".claude/commands/review-pr.md")
 *
 * - **Footer**:
 *   - "View Details" button (sm size, full width)
 *
 * ### Skill Cards
 *
 * Each skill card displays:
 *
 * - **Header**:
 *   - Title: Skill name
 *   - Description: Skill description
 *
 * - **Content**:
 *   - Allowed Tools section (if toolConfig.allowedTools array has items):
 *     * First 3 tools as badges
 *     * Overflow indicator "+N" for remaining tools
 *
 * - **Footer**:
 *   - "View Details" button (sm size, full width)
 *
 * ## Tool Configuration Preview
 *
 * Both commands and skills can have allowed tools configured. The preview displays:
 *
 * 1. **Section Header**: "Allowed Tools:" (semibold, muted color)
 * 2. **Tool Badges**: First 3 tools with secondary background
 * 3. **Overflow Indicator**: "+N" text showing remaining tool count
 *
 * Example display with 5 tools: `[Read] [Edit] [Bash] +2`
 *
 * ## Empty States
 *
 * When no resources are found, displays centered empty state messages:
 *
 * - **Commands**: "No slash commands found in .claude/commands/"
 * - **Skills**: "No skills found in .claude/skills/"
 *
 * Empty states use `col-span-full` to center across all grid columns.
 *
 * ## Action Buttons
 *
 * Each resource card has a "View Details" button that:
 *
 * - Uses `sm` size for compact footer layout
 * - Spans full width of card footer (`w-full`)
 * - Currently does not invoke any action (placeholder for future functionality)
 *
 * ## Pagination
 *
 * The component does not implement pagination. All resources are displayed simultaneously in the grid.
 * For large resource counts, consider:
 *
 * - Adding pagination controls (10-20 items per page)
 * - Implementing search/filter functionality
 * - Adding virtualized scrolling for 100+ items
 *
 * ## Styling Behavior
 *
 * The component uses Tailwind CSS classes for styling:
 *
 * - **Container**: `animate-fade-in` for smooth page entrance
 * - **Header**: Responsive typography (`text-3xl sm:text-4xl`) with center alignment
 * - **Tab Navigation**: `flex justify-center gap-4` with button variants
 * - **Grid Layout**: Responsive columns with `gap-6` spacing
 * - **Cards**: Hover effect (`hover:border-primary/80`) with smooth color transition (`transition-colors duration-300`)
 * - **Tool Badges**: `text-xs bg-secondary px-2 py-0.5 rounded` for compact display
 * - **Empty State**: `text-muted-foreground py-12` for subtle, spacious messaging
 * - **Resource Counts**: Muted color with centered alignment
 *
 * @example
 * // Basic usage in ManagerApp setup phase (ValidationPage)
 * <AgentsListPage
 *   commands={discoveredCommands}
 *   skills={discoveredSkills}
 *   onSelectAgent={(agent) => console.log('Selected:', agent)}
 * />
 *
 * @example
 * // Understanding tab navigation
 * // 1. User sees "Slash Commands (3)" and "Skills (2)" tabs
 * // 2. User clicks "Skills (2)" tab
 * //    → setActiveTab('skills')
 * //    → Commands grid hidden, skills grid displayed
 * //    → Button variant changes (primary for active, secondary for inactive)
 * // 3. User clicks "Slash Commands (3)" tab
 * //    → setActiveTab('commands')
 * //    → Skills grid hidden, commands grid displayed
 *
 * @example
 * // Understanding empty states
 * // Scenario 1: No commands found
 * // <AgentsListPage commands={[]} skills={[{...}]} />
 * // → Commands tab shows: "No slash commands found in .claude/commands/"
 * // → Skills tab shows normal grid with 1 skill
 * //
 * // Scenario 2: No skills found
 * // <AgentsListPage commands={[{...}]} skills={[]} />
 * // → Commands tab shows normal grid with 1 command
 * // → Skills tab shows: "No skills found in .claude/skills/"
 *
 * @example
 * // Understanding tool configuration preview
 * // Command with 5 allowed tools:
 * // {
 * //   name: "review-pr",
 * //   metadata: {
 * //     allowedTools: ["Read", "Edit", "Bash", "Grep", "WebFetch"]
 * //   }
 * // }
 * //
 * // Card displays:
 * // - Section header: "Allowed Tools:"
 * // - Tool badges: [Read] [Edit] [Bash]
 * // - Overflow: "+2"
 */

import React, { useState } from 'react';
import type { Agent } from '../types';
import type { SlashCommand, Skill } from '../services/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

/**
 * Props for AgentsListPage component
 *
 * @interface AgentsListPageProps
 * @property {SlashCommand[]} commands - Array of discovered slash commands from `.claude/commands/` directory
 * @property {Skill[]} skills - Array of discovered skills from `.claude/skills/` directory
 * @property {(agent: Agent) => void} onSelectAgent - Callback invoked when "View Details" button is clicked (not currently connected)
 */
interface AgentsListPageProps {
  commands: SlashCommand[];
  skills: Skill[];
  onSelectAgent: (agent: Agent) => void;
}

const AgentsListPage: React.FC<AgentsListPageProps> = ({ commands, skills, onSelectAgent }) => {
  const [activeTab, setActiveTab] = useState<'commands' | 'skills'>('commands');

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-center">Project Structure</h1>
      <p className="text-muted-foreground text-center mb-8">
        Discovered {commands.length} slash commands and {skills.length} skills
      </p>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-8 gap-4">
        <Button
          variant={activeTab === 'commands' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('commands')}
        >
          Slash Commands ({commands.length})
        </Button>
        <Button
          variant={activeTab === 'skills' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('skills')}
        >
          Skills ({skills.length})
        </Button>
      </div>

      {/* Commands Tab */}
      {activeTab === 'commands' && (
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
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No skills found in .claude/skills/
            </div>
          ) : (
            skills.map((skill) => (
              <Card key={skill.id} className="flex flex-col hover:border-primary/80 transition-colors duration-300">
                <CardHeader>
                  <CardTitle>{skill.name}</CardTitle>
                  <CardDescription>{skill.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {skill.toolConfig?.allowedTools && Array.isArray(skill.toolConfig?.allowedTools) && skill.toolConfig?.allowedTools.length > 0 && (
                    <div className="mb-2">
                      <h4 className="font-semibold text-sm mb-1 text-muted-foreground">Allowed Tools:</h4>
                      <div className="flex flex-wrap gap-1">
                        {skill.toolConfig?.allowedTools.slice(0, 3).map((tool, idx) => (
                          <span key={idx} className="text-xs bg-secondary px-2 py-0.5 rounded">
                            {tool}
                          </span>
                        ))}
                        {skill.toolConfig?.allowedTools.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{skill.toolConfig?.allowedTools.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
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
      )}
    </div>
  );
};

AgentsListPage.displayName = 'AgentsListPage';

export default AgentsListPage;
   