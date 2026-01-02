/**
 * @file SkillDetailsModal.tsx
 * @description Modal dialog for viewing comprehensive skill information in read-only mode with optional editing.
 * This component displays skill metadata, tool configuration, and instructions with a clean, organized layout
 * that makes it easy to understand a skill's capabilities and configuration at a glance.
 *
 * ## Features
 * - **Read-Only Display**: View skill details without modification
 * - **Metadata Section**: ID, name, category display
 * - **Tool Configuration**: Visual display of allowed tools with badges
 * - **Instructions Display**: Formatted view of skill instructions (skill.md content)
 * - **Optional Edit Mode**: Conditionally rendered Edit button when onEdit callback provided
 * - **Responsive Layout**: Adapts to different screen sizes (sm:max-w-[800px])
 * - **Scrollable Content**: Handles long instructions with overflow-y-auto (max-h-[80vh])
 * - **Clean Styling**: Organized sections with clear headings and spacing
 * - **Action Buttons**: Edit (optional) and Close buttons in footer
 *
 * ## Skill Details Display
 * The modal presents skill information in three main sections:
 *
 * ### Metadata Section
 * - **ID**: Skill's unique identifier (numeric or string)
 * - **Name**: Skill name in monospace font with break-all for long names
 * - **Category**: Skill category (defaults to 'general' if not specified)
 * - **Grid Layout**: 3-column grid with labels (1 col) and values (2 cols)
 * - **Typography**: Labels use muted foreground color, font-medium weight
 *
 * ### Allowed Tools Section
 * - **Conditional Display**: Only shown when `toolConfig.allowedTools` array exists and has items
 * - **Badge Layout**: Flex wrap layout with gap-2 spacing
 * - **Tool Badges**: Secondary background with rounded corners, medium font weight
 * - **Visual Feedback**: Each tool displayed as individual badge for easy scanning
 *
 * ### Instructions Section
 * - **Header**: "Instructions" heading with semibold font
 * - **Content Display**: Pre-formatted text in monospace font
 * - **Background**: Muted background with padding and rounded corners
 * - **Overflow Handling**: overflow-x-auto for wide content
 * - **Whitespace**: whitespace-pre-wrap preserves formatting
 * - **Source**: Displays skill.skillmd content (skill.md file content from backend)
 *
 * ## Edit Mode
 * The component supports optional edit functionality:
 *
 * ### Edit Button Behavior
 * - **Conditional Rendering**: Button only appears when `onEdit` prop is provided
 * - **Button Action**: Calls `onEdit(skill)` callback passing the current skill object
 * - **Parent Responsibility**: Parent component handles opening edit modal/form
 * - **Button Variant**: Secondary variant for non-primary action
 * - **Typical Flow**:
 *   1. User clicks Edit button
 *   2. onEdit(skill) callback invoked
 *   3. Parent component opens SkillCreationModal in edit mode
 *   4. Details modal remains open or closes (controlled by parent)
 *
 * ## Action Buttons
 * Footer contains action buttons aligned to the right:
 *
 * ### Button Layout
 * - **Container**: flex with justify-end and gap-2 spacing
 * - **Border**: Top border separates footer from content
 * - **Padding**: pt-4 for vertical spacing
 * - **Order**: Edit button (if present), then Close button
 *
 * ### Edit Button (Optional)
 * - **Variant**: Secondary (gray background)
 * - **Label**: "Edit"
 * - **Action**: Invokes `onEdit(skill)` callback
 * - **Conditional**: Only rendered when `onEdit` prop provided
 *
 * ### Close Button (Always Present)
 * - **Variant**: Secondary (gray background)
 * - **Label**: "Close"
 * - **Action**: Invokes `onClose()` callback
 * - **Behavior**: Closes modal without changes
 *
 * ## Modal Behavior
 * The component provides controlled modal interactions:
 *
 * ### Opening/Closing
 * - **Controlled**: Modal state managed by parent via `isOpen` prop
 * - **Dialog Integration**: Uses Dialog component from ui/Dialog.tsx
 * - **Backdrop Close**: Clicking outside modal triggers `onClose()` via `onOpenChange` handler
 * - **ESC Key**: Dialog component handles ESC key to close (built-in)
 * - **Null Guard**: Returns null if skill is null, prevents rendering empty modal
 *
 * ### Layout Structure
 * - **Max Width**: sm:max-w-[800px] for readable content width
 * - **Max Height**: max-h-[80vh] prevents modal from exceeding viewport
 * - **Scrollable**: overflow-y-auto enables scrolling for long content
 * - **Sections**: Header (title, description) → Content (metadata, tools, instructions) → Footer (actions)
 *
 * ## Styling Behavior
 * Uses Tailwind CSS classes for consistent theme-aware styling:
 * - **Section Spacing**: space-y-6 between main sections, py-4 padding
 * - **Headings**: text-lg font-semibold for section titles, mb-3 bottom margin
 * - **Metadata Grid**: grid-cols-3 layout with gap-2
 * - **Tool Badges**: px-3 py-1 padding, bg-secondary background, rounded-md corners
 * - **Instructions**: bg-muted background, p-4 padding, text-xs monospace
 * - **Footer**: border-t top border, flex with justify-end
 * - **Color Scheme**: Uses theme colors (muted-foreground, secondary, foreground)
 *
 * @example Basic Usage - View Skill Details
 * ```tsx
 * function SkillsPage() {
 *   const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
 *   const [detailsOpen, setDetailsOpen] = useState(false);
 *
 *   const handleViewDetails = (skill: Skill) => {
 *     setSelectedSkill(skill);
 *     setDetailsOpen(true);
 *   };
 *
 *   return (
 *     <>
 *       <SkillList onViewDetails={handleViewDetails} />
 *       <SkillDetailsModal
 *         skill={selectedSkill}
 *         isOpen={detailsOpen}
 *         onClose={() => setDetailsOpen(false)}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @example With Edit Functionality
 * ```tsx
 * function SkillsPage() {
 *   const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
 *   const [detailsOpen, setDetailsOpen] = useState(false);
 *   const [editOpen, setEditOpen] = useState(false);
 *
 *   const handleEdit = (skill: Skill) => {
 *     setSelectedSkill(skill);
 *     setDetailsOpen(false); // Close details modal
 *     setEditOpen(true);     // Open edit modal
 *   };
 *
 *   return (
 *     <>
 *       <SkillDetailsModal
 *         skill={selectedSkill}
 *         isOpen={detailsOpen}
 *         onClose={() => setDetailsOpen(false)}
 *         onEdit={handleEdit}
 *       />
 *       <SkillCreationModal
 *         isOpen={editOpen}
 *         onClose={() => setEditOpen(false)}
 *         editSkill={selectedSkill}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @example Understanding Displayed Information
 * ```tsx
 * // Example skill object structure displayed in modal:
 * const exampleSkill: Skill = {
 *   id: 123,
 *   name: "code-analyzer",
 *   description: "Analyzes code quality and suggests improvements",
 *   category: "code-analysis",
 *   skillmd: "# Code Analyzer\n\nThis skill analyzes code...",
 *   toolConfig: {
 *     allowedTools: ["Read", "Grep", "Bash"]
 *   }
 * };
 *
 * // Modal displays:
 * // - Metadata: ID=123, Name=code-analyzer, Category=code-analysis
 * // - Allowed Tools: [Read] [Grep] [Bash] badges
 * // - Instructions: Full skillmd content in pre-formatted view
 * ```
 *
 * @example Read-Only Skill Viewer (No Edit)
 * ```tsx
 * function PublicSkillsGallery() {
 *   const [viewSkill, setViewSkill] = useState<Skill | null>(null);
 *
 *   // No onEdit prop = read-only mode, Edit button won't appear
 *   return (
 *     <SkillDetailsModal
 *       skill={viewSkill}
 *       isOpen={!!viewSkill}
 *       onClose={() => setViewSkill(null)}
 *       // onEdit omitted - read-only mode
 *     />
 *   );
 * }
 * ```
 */

import React from 'react';
import type { Skill } from '../../../types/agent.types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Button } from './ui/Button';

/**
 * Props for the SkillDetailsModal component.
 *
 * @property {Skill | null} skill - The skill object to display, or null when no skill selected
 * @property {boolean} isOpen - Controls modal visibility (true = open, false = closed)
 * @property {() => void} onClose - Callback invoked when modal should close (backdrop click, Close button, ESC key)
 * @property {(skill: Skill) => void} [onEdit] - Optional callback invoked when Edit button clicked, receives skill object
 *
 * @example
 * ```tsx
 * <SkillDetailsModal
 *   skill={selectedSkill}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onEdit={(skill) => openEditModal(skill)}
 * />
 * ```
 */
interface SkillDetailsModalProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (skill: Skill) => void;
}

/**
 * SkillDetailsModal Component
 *
 * A read-only modal dialog for viewing comprehensive skill information including metadata,
 * tool configuration, and instructions. Optionally supports editing via callback.
 *
 * @component
 * @param {SkillDetailsModalProps} props - Component props
 * @returns {JSX.Element | null} Rendered modal or null if no skill selected
 */
const SkillDetailsModal: React.FC<SkillDetailsModalProps> = ({ skill, isOpen, onClose, onEdit }) => {
  if (!skill) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{skill.name}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Metadata Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Metadata</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="font-medium text-muted-foreground">ID:</span>
                <span className="col-span-2">{skill.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Name:</span>
                <span className="col-span-2 font-mono text-xs break-all">{skill.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Category:</span>
                <span className="col-span-2">{skill.category || 'general'}</span>
              </div>
            </div>
          </div>

          {/* Allowed Tools Section */}
          {skill.toolConfig?.allowedTools && skill.toolConfig.allowedTools.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Allowed Tools</h3>
              <div className="flex flex-wrap gap-2">
                {skill.toolConfig.allowedTools.map((tool, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm font-medium"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Content Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Instructions</h3>
            <div className="bg-muted p-4 rounded-md overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">{skill.skillmd}</pre>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {onEdit && (
            <Button variant="secondary" onClick={() => onEdit(skill)}>
              Edit
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

SkillDetailsModal.displayName = 'SkillDetailsModal';

export default SkillDetailsModal;
