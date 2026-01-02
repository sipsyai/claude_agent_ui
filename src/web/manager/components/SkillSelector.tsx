/**
 * @file SkillSelector.tsx
 * @description Multi-select skill picker component with search, filtering, and inline detail preview.
 * This component provides an interactive interface for selecting multiple skills from a searchable list,
 * with visual indicators for usage statistics and tool configuration, plus a modal for viewing full details.
 *
 * ## Features
 * - **Multi-Select Interface**: Checkbox-based selection allowing multiple skills to be selected simultaneously
 * - **Search and Filter**: Real-time search filtering by skill name or description text
 * - **Select All / Deselect All**: Bulk selection toggle for all filtered skills with single click
 * - **Usage Statistics**: Visual badges showing how many agents use each skill (executionCount)
 * - **Tool Configuration Display**: Preview of allowed tools (up to 3 visible) with overflow indicator
 * - **Skill Detail Modal**: Click info icon to view comprehensive skill details including usage, tools, instructions, location
 * - **Loading/Error/Empty States**: Graceful handling of API states with appropriate feedback messages
 * - **Directory-Aware**: Reloads skills when directory changes (via useEffect dependency)
 * - **Disabled Mode**: Can be disabled to show read-only view of selections
 * - **Controlled Component**: Fully controlled via selectedSkills and onChange props
 *
 * ## Skill Selection
 * The component provides multi-select functionality with visual feedback:
 *
 * ### Selection Mechanism
 * - **Checkbox Input**: Each skill has a checkbox for individual selection toggle
 * - **Label Wrapper**: Entire skill item is clickable via label wrapping checkbox
 * - **Visual Feedback**: Selected items show checked checkbox, hover shows bg-secondary/50
 * - **Immutable Updates**: Creates new array on selection change (doesn't mutate selectedSkills)
 * - **Name-Based Matching**: Uses skill.name string for selection tracking (not ID)
 * - **Accessibility**: Full keyboard navigation support via native checkbox elements
 *
 * ### Selection Workflow
 * 1. User clicks checkbox or skill item label
 * 2. `toggleSkill(skillName)` called
 * 3. New array created: add if not selected, remove if already selected
 * 4. `onChange(newSkills)` invoked with updated array
 * 5. Parent component updates state
 * 6. Component re-renders with new selectedSkills prop
 *
 * ## Multi-Select Behavior
 * Supports both individual and bulk selection operations:
 *
 * ### Individual Selection
 * - **Toggle**: Click skill checkbox to add/remove from selection
 * - **Add**: Appends skill name to selectedSkills array (`[...selectedSkills, skillName]`)
 * - **Remove**: Filters out skill name from array (`selectedSkills.filter(name => name !== skillName)`)
 * - **Idempotent**: Safe to click multiple times (toggle behavior)
 *
 * ### Select All / Deselect All
 * - **Location**: Top-right corner above skill list
 * - **Condition**: Only visible when filteredSkills.length > 0
 * - **Behavior**:
 *   - If all filtered skills selected: **Deselect All** → `onChange([])`
 *   - If some/none selected: **Select All** → `onChange(filteredSkills.map(s => s.name))`
 * - **Label**: Dynamically changes between "Select All" and "Deselect All"
 * - **Scope**: Only affects currently visible/filtered skills, not all skills
 * - **Visual State**: Checkbox shows checked when all filtered skills selected
 *
 * ### Selection Summary
 * - **Display**: Bottom-left corner shows count: "X skill(s) selected" or "No skills selected"
 * - **Count**: Based on selectedSkills.length (total selected, not just filtered)
 * - **Real-Time**: Updates immediately as selections change
 *
 * ## Filtering
 * Real-time search filtering for finding skills quickly:
 *
 * ### Search Mechanism
 * - **Input Field**: Top of component, placeholder "Search skills by name or description..."
 * - **Real-Time**: Filters as user types, no submit button required
 * - **Case-Insensitive**: Converts both search term and skill text to lowercase
 * - **Multi-Field**: Searches both skill.name AND skill.description
 * - **Includes Match**: Uses `.includes()` for partial matching (not exact match)
 * - **Trim Handling**: Empty/whitespace-only search returns all skills
 *
 * ### Filter Workflow
 * 1. User types in search input
 * 2. `setSearchTerm(value)` updates state
 * 3. Component re-renders
 * 4. `filterSkills(skills)` applied during render
 * 5. Filtered list displayed
 * 6. Select All scope updates to filtered set
 *
 * ### Empty Search Results
 * - **Display**: "No skills match your search" message in skill list area
 * - **Centered**: text-center alignment
 * - **Styling**: Muted text color (text-muted-foreground)
 * - **Select All**: Hidden when no results
 *
 * ## Skill Display
 * Each skill item shows comprehensive information with visual indicators:
 *
 * ### Skill Item Layout
 * - **Container**: Flex row with gap-2, hover background (bg-secondary/50)
 * - **Checkbox**: Left-aligned, 4x4 size with mt-1 for visual alignment
 * - **Content Area**: Flex-1 with min-w-0 for text truncation
 * - **Info Button**: Right-aligned, flex-shrink-0, shows InfoIcon
 *
 * ### Skill Item Content
 * - **Name**: font-medium text-sm with break-all for long names
 * - **Description**: text-xs muted with line-clamp-2 (truncates to 2 lines)
 * - **Usage Badge**: Blue badge showing "Used in X agent(s)" when executionCount > 0
 * - **Tools Preview**: Gray badges for allowed tools (max 3 visible + overflow indicator)
 * - **Badge Conditions**:
 *   - Usage badge: Only if `skill.analytics?.executionCount > 0`
 *   - Tools badge: Only if `skill.toolConfig?.allowedTools.length > 0`
 *
 * ### Badge Styling
 * - **Usage Badge**: bg-blue-100 text-blue-700 with rounded corners
 * - **Tool Badge**: bg-gray-100 text-gray-700 with rounded corners
 * - **Overflow Indicator**: "+X more" in muted text when tools.length > 3
 * - **Spacing**: mt-1 above badges, gap-1 between tool badges
 *
 * ## Skill Detail Modal
 * Clicking the info icon opens a modal with comprehensive skill information:
 *
 * ### Modal Trigger
 * - **Button**: InfoIcon button on right side of each skill item
 * - **Action**: Sets `selectedSkillDetail` state to clicked skill
 * - **Non-Selection**: Clicking info does NOT select/deselect the skill
 * - **Title Attribute**: "View details" tooltip on hover
 *
 * ### Modal Content Sections
 * 1. **Header**:
 *    - Skill name (text-lg font-semibold)
 *    - Description (text-sm muted, mt-1)
 * 2. **Usage Info**:
 *    - Execution count: "Used in X agent(s)"
 *    - Agent list: If agentSelection array exists, shows agent names joined
 * 3. **Allowed Tools**:
 *    - All tools displayed as badges (no 3-tool limit like list view)
 *    - Flex wrap layout with gap-1
 * 4. **Instructions**:
 *    - Pre-formatted skill.skillmd content
 *    - Monospace font (font-mono)
 *    - Max height with scroll (max-h-60)
 * 5. **Location**:
 *    - File path: `{skillName}.md`
 *    - Monospace display (font-mono)
 *
 * ### Modal Behavior
 * - **Background**: Semi-transparent black overlay (bg-black/50)
 * - **Close Methods**: Click backdrop, click Close button
 * - **Z-Index**: z-50 for layering above other content
 * - **Event Propagation**: `stopPropagation()` on modal content prevents backdrop close
 * - **Scrollable**: overflow-y-auto on content section, max-h-[80vh]
 * - **Responsive**: max-w-2xl with padding for mobile
 *
 * ## Directory Integration
 * Component reloads skills when directory changes:
 *
 * ### Directory Handling
 * - **useEffect Dependency**: `[directory]` triggers reload on directory change
 * - **API Call**: `api.getSkills(directory, true)` passes directory to backend
 * - **Loading State**: Shows "Loading skills..." during fetch
 * - **Error Handling**: Displays error message if API call fails
 * - **Graceful Degradation**: Shows empty state if no skills found
 *
 * ## Styling Behavior
 * Uses Tailwind CSS classes for consistent theme-aware styling:
 * - **Container**: space-y-3 vertical spacing between sections
 * - **Search Input**: w-full px-3 py-2, focus ring (ring-primary/50)
 * - **Summary Bar**: flex items-center justify-between with text-xs
 * - **Skills List**: border rounded-md with max-h-96 overflow-y-auto
 * - **Skill Item**: p-2 rounded hover:bg-secondary/50 transition-colors
 * - **Disabled State**: opacity-50 on inputs and checkboxes when disabled
 * - **Empty State**: border-dashed with p-3 padding
 *
 * @example
 * // Basic usage with skill selection
 * import SkillSelector from './SkillSelector';
 *
 * function MyComponent() {
 *   const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
 *
 *   return (
 *     <div>
 *       <label className="block mb-2">Select Skills:</label>
 *       <SkillSelector
 *         selectedSkills={selectedSkills}
 *         onChange={setSelectedSkills}
 *       />
 *       <p>Selected: {selectedSkills.join(', ')}</p>
 *     </div>
 *   );
 * }
 *
 * @example
 * // With custom directory for project-specific skills
 * import SkillSelector from './SkillSelector';
 *
 * function AgentForm() {
 *   const [skills, setSkills] = useState<string[]>(['skill-analyzer', 'code-reviewer']);
 *   const directory = '/path/to/project';
 *
 *   const handleSkillChange = (newSkills: string[]) => {
 *     console.log('Skills changed:', newSkills);
 *     setSkills(newSkills);
 *   };
 *
 *   return (
 *     <SkillSelector
 *       selectedSkills={skills}
 *       onChange={handleSkillChange}
 *       directory={directory}
 *     />
 *   );
 * }
 *
 * @example
 * // Disabled mode for read-only view
 * import SkillSelector from './SkillSelector';
 *
 * function SkillViewer({ skills }: { skills: string[] }) {
 *   return (
 *     <div>
 *       <h3>Current Skills (Read-Only)</h3>
 *       <SkillSelector
 *         selectedSkills={skills}
 *         onChange={() => {}} // No-op since disabled
 *         disabled={true}
 *       />
 *     </div>
 *   );
 * }
 *
 * @example
 * // Understanding skill selection workflow
 * import SkillSelector from './SkillSelector';
 *
 * function InteractiveExample() {
 *   const [skills, setSkills] = useState<string[]>([]);
 *
 *   const handleChange = (newSkills: string[]) => {
 *     // Workflow:
 *     // 1. User clicks "data-processor" checkbox
 *     // 2. toggleSkill('data-processor') called
 *     // 3. If not in array: [...skills, 'data-processor']
 *     //    If in array: skills.filter(s => s !== 'data-processor')
 *     // 4. onChange invoked with new array
 *     // 5. State updated here
 *     // 6. Component re-renders with updated selections
 *     console.log('Changed from', skills, 'to', newSkills);
 *     setSkills(newSkills);
 *   };
 *
 *   // User interaction flow:
 *   // 1. Search "analyzer" → filters list to matching skills
 *   // 2. Click "Select All" → all filtered skills selected
 *   // 3. Click info icon → modal opens with skill details
 *   // 4. Click "code-reviewer" → toggles selection
 *   // 5. Clear search → all skills visible, selections preserved
 *   return (
 *     <div>
 *       <SkillSelector selectedSkills={skills} onChange={handleChange} />
 *     </div>
 *   );
 * }
 */

import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import { InfoIcon } from './ui/Icons';

/**
 * Props for the SkillSelector component
 *
 * @interface SkillSelectorProps
 * @property {string[]} selectedSkills - Array of selected skill names (controlled state)
 * @property {(skills: string[]) => void} onChange - Callback invoked when selection changes with new skill name array
 * @property {boolean} [disabled=false] - If true, disables all inputs and shows read-only view
 * @property {string} [directory] - Optional directory path to filter skills, triggers reload when changed
 */
interface SkillSelectorProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
  directory?: string;
}

const SkillSelector: React.FC<SkillSelectorProps> = ({
  selectedSkills,
  onChange,
  disabled = false,
  directory,
}) => {
  const [skills, setSkills] = useState<api.Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<api.Skill | null>(null);

  useEffect(() => {
    loadSkills();
  }, [directory]);

  /**
   * Loads skills from the API based on the current directory.
   * Sets loading state during fetch, handles errors, and updates skills state on success.
   *
   * @internal
   * @async
   * @function loadSkills
   * @returns {Promise<void>}
   *
   * @description
   * Workflow:
   * 1. Set loading=true and clear any previous errors
   * 2. Call api.getSkills(directory, true) to fetch all skills
   * 3. Update skills state with fetched data
   * 4. If error occurs, set error message from Error object or generic message
   * 5. Set loading=false in finally block regardless of success/failure
   *
   * Error Handling:
   * - Catches all errors (network, API, parsing)
   * - Extracts message from Error instances
   * - Falls back to generic "Failed to load skills" for non-Error throws
   * - Error displayed to user via error state rendering
   */
  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const allSkills = await api.getSkills(directory, true);
      setSkills(allSkills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggles a skill's selection state (add if not selected, remove if selected).
   * Creates a new array and invokes onChange callback with updated selection.
   *
   * @internal
   * @function toggleSkill
   * @param {string} skillName - The name of the skill to toggle
   * @returns {void}
   *
   * @description
   * Toggle Logic:
   * - If skillName is in selectedSkills: Remove it (filter out)
   * - If skillName is NOT in selectedSkills: Add it (spread and append)
   * - Creates new array (immutable update pattern)
   * - Invokes onChange(newSkills) to notify parent
   *
   * Example:
   * - selectedSkills = ['skill-a', 'skill-b']
   * - toggleSkill('skill-c') → onChange(['skill-a', 'skill-b', 'skill-c'])
   * - toggleSkill('skill-b') → onChange(['skill-a'])
   */
  const toggleSkill = (skillName: string) => {
    let newSkills: string[];
    if (selectedSkills.includes(skillName)) {
      newSkills = selectedSkills.filter(name => name !== skillName);
    } else {
      newSkills = [...selectedSkills, skillName];
    }
    onChange(newSkills);
  };

  /**
   * Toggles selection of all currently visible/filtered skills.
   * If all filtered skills are selected, deselects all. Otherwise, selects all filtered skills.
   *
   * @internal
   * @function toggleSelectAll
   * @returns {void}
   *
   * @description
   * Select All Logic:
   * - Check if all filtered skills are currently selected
   * - Condition: selectedSkills.length === filteredSkills.length AND filteredSkills.length > 0
   * - If all selected: Deselect All → onChange([])
   * - If some/none selected: Select All → onChange(filteredSkills.map(s => s.name))
   *
   * Scope:
   * - Only affects currently visible/filtered skills
   * - If search is active, only filtered skills are selected
   * - Does NOT affect skills filtered out by search
   *
   * Example:
   * - All skills: ['skill-a', 'skill-b', 'skill-c']
   * - Search "b" → filteredSkills = ['skill-b']
   * - toggleSelectAll() → onChange(['skill-b'])
   * - toggleSelectAll() again → onChange([])
   */
  const toggleSelectAll = () => {
    if (selectedSkills.length === filteredSkills.length && filteredSkills.length > 0) {
      onChange([]);
    } else {
      onChange(filteredSkills.map(s => s.name));
    }
  };

  /**
   * Filters skills array based on current search term.
   * Returns skills matching search term in name or description (case-insensitive).
   *
   * @internal
   * @function filterSkills
   * @param {api.Skill[]} skillsList - Array of all skills to filter
   * @returns {api.Skill[]} Filtered array of skills matching search term
   *
   * @description
   * Filter Logic:
   * - If searchTerm is empty/whitespace: Return all skills unchanged
   * - Convert search term to lowercase for case-insensitive matching
   * - Check if term is included in skill.name (lowercase)
   * - OR check if term is included in skill.description (lowercase)
   * - Return filtered array with matching skills only
   *
   * Search Behavior:
   * - Partial matching (uses .includes(), not exact match)
   * - Case-insensitive (converts to lowercase)
   * - Multi-field (searches name AND description)
   * - Trim handling (whitespace-only search returns all)
   *
   * Example:
   * - skillsList = [{name: 'Code-Analyzer', description: 'Analyzes code'}, {name: 'Data-Processor', description: 'Processes data'}]
   * - searchTerm = 'code' → Returns [{name: 'Code-Analyzer', ...}]
   * - searchTerm = 'data' → Returns [{name: 'Data-Processor', ...}]
   * - searchTerm = 'anal' → Returns [{name: 'Code-Analyzer', ...}] (partial match in description)
   */
  const filterSkills = (skillsList: api.Skill[]): api.Skill[] => {
    if (!searchTerm.trim()) return skillsList;

    const term = searchTerm.toLowerCase();
    return skillsList.filter(skill =>
      skill.name.toLowerCase().includes(term) ||
      skill.description.toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading skills...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded">
        No skills found. Create skills in the Skills section to see them here.
      </div>
    );
  }

  const filteredSkills = filterSkills(skills);
  const allSelected = filteredSkills.length > 0 && selectedSkills.length === filteredSkills.length;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Search skills by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
      </div>

      {/* Summary and Select All */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {selectedSkills.length > 0
            ? `${selectedSkills.length} skill(s) selected`
            : 'No skills selected'}
        </div>
        {filteredSkills.length > 0 && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={disabled}
              className="w-4 h-4 rounded"
            />
            <span className="text-muted-foreground">
              {allSelected ? 'Deselect All' : 'Select All'}
            </span>
          </label>
        )}
      </div>

      {/* Skills List */}
      <div className="border border-border rounded-md max-h-96 overflow-y-auto">
        {filteredSkills.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No skills match your search
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSkills.map((skill) => {
              const isSelected = selectedSkills.includes(skill.name);

              return (
                <div
                  key={skill.id}
                  className="flex items-start gap-2 p-2 rounded hover:bg-secondary/50 transition-colors"
                >
                  <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSkill(skill.name)}
                      disabled={disabled}
                      className="mt-1 w-4 h-4 rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground break-all">
                        {skill.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {skill.description}
                      </div>

                      {/* Usage badge */}
                      {skill.analytics?.executionCount !== undefined && skill.analytics?.executionCount > 0 && (
                        <div className="mt-1">
                          <span className="inline-block text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            Used in {skill.analytics?.executionCount} agent{skill.analytics?.executionCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      {/* Tools badge */}
                      {skill.toolConfig?.allowedTools && skill.toolConfig?.allowedTools.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {skill.toolConfig?.allowedTools.slice(0, 3).map(tool => (
                            <span key={tool} className="inline-block text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
                              {tool}
                            </span>
                          ))}
                          {skill.toolConfig?.allowedTools.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{skill.toolConfig?.allowedTools.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Info button */}
                  <button
                    type="button"
                    onClick={() => setSelectedSkillDetail(skill)}
                    className="flex-shrink-0 text-muted-foreground hover:text-primary p-1"
                    title="View details"
                  >
                    <InfoIcon className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkillDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSkillDetail(null)}
        >
          <div
            className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold">{selectedSkillDetail.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{selectedSkillDetail.description}</p>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {/* Usage Info */}
                {selectedSkillDetail.analytics?.executionCount !== undefined && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Usage</h4>
                    <p className="text-sm text-muted-foreground">
                      Used in {selectedSkillDetail.analytics?.executionCount || 0} agent(s)
                      {selectedSkillDetail.agentSelection && selectedSkillDetail.agentSelection.length > 0 && (
                        <>: {selectedSkillDetail.agentSelection.join(', ')}</>
                      )}
                    </p>
                  </div>
                )}

                {/* Allowed Tools */}
                {selectedSkillDetail.toolConfig?.allowedTools && selectedSkillDetail.toolConfig?.allowedTools.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Allowed Tools</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedSkillDetail.toolConfig?.allowedTools.map(tool => (
                        <span key={tool} className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Preview */}
                <div>
                  <h4 className="text-sm font-medium mb-1">Instructions</h4>
                  <pre className="text-xs bg-secondary/50 p-3 rounded border border-border overflow-x-auto max-h-60">
                    {selectedSkillDetail.skillmd}
                  </pre>
                </div>

                {/* File Path */}
                <div>
                  <h4 className="text-sm font-medium mb-1">Location</h4>
                  <p className="text-xs font-mono text-muted-foreground">{selectedSkillDetail.name + ".md"}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedSkillDetail(null)}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

SkillSelector.displayName = 'SkillSelector';

export default SkillSelector;
