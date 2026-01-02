/**
 * @file SkillCreationModal.tsx
 * @description Modal dialog for creating and editing agent skills through a comprehensive form interface.
 * This component provides a multi-section configuration form with validation, tool selection, input field
 * builder, advanced settings, and file upload capabilities for extending Claude's capabilities.
 *
 * ## Features
 * - **Dual-Mode Operation**: Create new skills or edit existing ones
 * - **Comprehensive Form**: 10+ configuration sections (core, tools, MCP, inputs, advanced, files, instructions)
 * - **Multi-Level Validation**: Required fields, pattern matching, length constraints, semantic versioning
 * - **Tool Configuration**: Tab-based allowed/disallowed tool selection
 * - **MCP Integration**: Select specific MCP server tools
 * - **Input Field Builder**: Dynamic form field creation with 7 field types
 * - **Advanced Settings**: Collapsible model configuration override (model, temperature, maxTokens, timeout)
 * - **File Upload**: Additional files for reference documentation, examples, troubleshooting guides
 * - **Analytics Display**: Read-only execution stats in edit mode
 * - **Training History**: Read-only training session records in edit mode
 * - **Auto-Close**: Modal auto-closes 2 seconds after successful creation/update
 * - **Form Reset**: Complete state reset on close
 * - **Color-Coded Feedback**: Green success, red error messages with icons
 *
 * ## Skill Creation Workflow
 * The component supports two distinct operational modes:
 *
 * ### Create Mode Workflow
 * 1. **Modal Opens**: User clicks "Create New Skill" button
 * 2. **Empty Form Loads**: All fields initialize to default values
 * 3. **User Fills Form**: Enters skill name, description, instructions, selects tools
 * 4. **Validation**: Client-side validation on submit (required fields, patterns, lengths)
 * 5. **API Call**: POST request to `/skills/create` with form data
 * 6. **File Creation**: Backend creates `.claude/skills/{name}/skill.md` file
 * 7. **Data Transform**: Form state → Strapi API payload format
 * 8. **Success Feedback**: Green banner with file path, auto-close after 2s
 * 9. **Callback Invoked**: `onSkillCreated()` triggers parent refresh
 * 10. **Modal Closes**: Form state reset, modal closes
 *
 * ### Edit Mode Workflow
 * 1. **Modal Opens**: User clicks "Edit" on existing skill
 * 2. **Pre-Population**: `useEffect` loads existing skill data into form fields
 * 3. **Data Transform**: Strapi API format → Form state (complex transformations for MCP tools, files)
 * 4. **User Edits**: Modifies description, tools, instructions (name field disabled)
 * 5. **Validation**: Client-side validation on submit (excludes name validation)
 * 6. **API Call**: PUT request to `/skills/{id}` with updated data
 * 7. **File Update**: Backend updates existing skill.md file
 * 8. **Success Feedback**: Green banner with "updated successfully", auto-close after 2s
 * 9. **Callback Invoked**: `onSkillCreated()` triggers parent refresh
 * 10. **Modal Closes**: Form state reset, modal closes
 *
 * ### Data Transformation (Edit Mode)
 * Complex transformations when loading edit data:
 * - **MCP Tools**: `mcpConfig` array → `Record<serverId, toolNames[]>` (uses documentId as key)
 * - **Additional Files**: API file objects → `SkillFileUpload[]` (extracts fileId from number/string/object)
 * - **Tool Config**: `toolConfig.allowedTools` array → `selectedTools` state
 * - **Model Config**: `modelConfig` object → `modelConfig` state with enabled flag
 *
 * ## Form Handling
 * The component manages complex form state across multiple configuration sections:
 *
 * ### Form State Management
 * - **Core State**: `formState` object with 7 properties (name, description, skillmd, category, isPublic, version, license)
 * - **Tool State**: `selectedTools`, `disallowedTools` arrays
 * - **MCP State**: `selectedMCPTools` Record<serverId, toolNames[]>
 * - **Input Fields State**: `inputFields` array with dynamic field definitions
 * - **Model Config State**: `modelConfigEnabled` boolean, `modelConfig` object
 * - **File State**: `additionalFiles` array, `fileUploadLoading` boolean
 * - **Validation State**: `errors` object with field-level error messages
 * - **Creation State**: `creationStatus` ('idle' | 'loading' | 'success' | 'error')
 * - **Result State**: `creationResult` string for success/error messages
 *
 * ### Input Change Handler
 * ```typescript
 * handleInputChange(field, value)
 * ```
 * - Updates specific field in `formState`
 * - Clears error for that field (real-time error clearing)
 * - Provides immediate user feedback
 *
 * ### Form Validation
 * Multi-level validation with specific rules:
 * - **Name** (create mode only): Required, lowercase letters/numbers/hyphens only, max 64 chars
 * - **Description**: Required, max 1024 chars
 * - **Skill Instructions**: Required, min 50 chars
 * - **Version**: Required, semantic versioning format (e.g., "1.0.0")
 * - **License**: Optional, max 100 chars if provided
 * - Returns boolean, sets `errors` object with field-specific messages
 *
 * ## Modal Behavior
 * The component provides controlled modal interactions:
 *
 * ### Opening/Closing
 * - Controlled by parent via `isOpen` prop
 * - Dialog `onOpenChange` handler calls `handleClose()` when backdrop clicked
 * - Manual close via Cancel button or X button (from Dialog component)
 * - Auto-close after 2 seconds on success (setTimeout in handleSubmit)
 * - Close disabled when `creationStatus === 'loading'` (prevents accidental close during save)
 *
 * ### Form Reset on Close
 * `handleClose()` resets all state to defaults:
 * - Core form fields → empty strings, defaults
 * - Tool selections → empty arrays
 * - MCP tools → empty object
 * - Input fields → empty array
 * - Errors → empty object
 * - Creation status → 'idle'
 * - Model config → disabled, defaults
 * - Advanced settings → collapsed
 * - Active tab → 'allowed'
 * - Additional files → empty array
 *
 * ### Layout Structure
 * - **Header**: Title (Create New Skill / Edit Skill), description
 * - **Content**: Scrollable form area (max-h-[60vh]) with 10+ configuration sections
 * - **Result Banner**: Color-coded feedback (green success / red error) with icons
 * - **Footer**: Cancel button, Submit button (Create Skill / Update Skill)
 *
 * ## Form Fields
 * The modal contains 10+ configuration sections:
 *
 * ### 1. Core Configuration
 * - **Skill Name** (required, disabled in edit mode): Lowercase letters, numbers, hyphens, max 64 chars
 * - **Description** (required): Multi-line description, max 1024 chars, textarea with 3 rows
 * - **Category** (required): Dropdown with 9 categories (custom, general-purpose, code-analysis, data-processing, etc.)
 * - **Version** (required): Semantic versioning (e.g., "1.0.0"), validated with regex `/^\d+\.\d+\.\d+$/`
 * - **License** (optional): Text input, max 100 chars (MIT, Apache-2.0, GPL-3.0, etc.)
 * - **Is Public** (required): Checkbox toggle for availability to all agents
 *
 * ### 2. Tool Configuration (Tab System)
 * - **Allowed Tools Tab**: Multi-select checkboxes for tools the skill can use
 *   - Empty selection = allow all tools
 *   - Specific selection = restrict to selected tools
 *   - Counter badge shows selected count
 * - **Disallowed Tools Tab**: Multi-select checkboxes for explicitly blocked tools
 *   - Empty selection = allow all tools
 *   - Specific selection = block selected tools
 *   - Counter badge shows disallowed count
 * - **Tool List**: Scrollable area (max-h-48) with tool name and description
 * - **Toggle Handler**: `handleToolToggle(toolName)` adds/removes from selectedTools
 *
 * ### 3. MCP Server Tools
 * - **MCPToolsSelector Component**: Separate component for MCP tool selection
 * - **State**: `selectedMCPTools` Record<serverId, toolNames[]>
 * - **Description**: "Select specific MCP tools this skill can use. Leave empty to allow all MCP tools."
 *
 * ### 4. Input Fields Builder
 * - **Dynamic Field Creation**: "+ Add Field" button appends new InputField to array
 * - **Field Configuration**: Each field has:
 *   - Name (required): Field identifier for template variables
 *   - Label (required): Display label in forms
 *   - Type (required): Dropdown with 7 types (text, textarea, dropdown, multiselect, checkbox, number, filepath)
 *   - Placeholder (optional): Input placeholder text
 *   - Options (required for dropdown/multiselect): Comma-separated list
 *   - Description (optional): Help text for field
 *   - Required (optional): Checkbox for required validation
 * - **Remove Button**: Deletes field from array
 * - **Template Variables**: Instructions use `{{field_name}}` syntax for field values
 * - **Empty State**: Dashed border with "No input fields defined" message
 *
 * ### 5. Advanced Settings (Collapsible)
 * - **Collapsible Section**: Arrow icon (▶ / ▼) indicates expand/collapse state
 * - **Model Configuration Override**: Checkbox to enable custom model settings
 *   - **Model Dropdown**: haiku, sonnet, sonnet-4, opus, opus-4
 *   - **Temperature Slider**: 0.00 - 1.00 range with 0.01 step, real-time value display
 *   - **Max Tokens**: Number input, 1-200000 range, optional
 *   - **Timeout**: Number input, minimum 1000ms, optional
 * - **Default State**: Collapsed on open, expanded state persists until form reset
 *
 * ### 6. Analytics Display (Edit Mode Only)
 * - **Read-Only Section**: Shows execution statistics
 * - **Metrics Grid**: 2x2 grid with 4 metrics:
 *   - Executions: Total execution count
 *   - Success Rate: Percentage with 1 decimal place
 *   - Avg Time: Average execution time in milliseconds
 *   - Last Executed: Date string (toLocaleDateString) or "Never"
 * - **Styling**: Gray background (bg-secondary/10) with border
 *
 * ### 7. Training History Display (Edit Mode Only)
 * - **Read-Only Section**: Shows past training sessions
 * - **Session List**: Scrollable area (max-h-48) with session cards
 * - **Session Card**: Each session shows:
 *   - Training Type: Session type label
 *   - Success Badge: Green (✓ Success) or Red (✗ Failed)
 *   - Score: Training score out of 100 (if available)
 *   - Notes: Session notes (if available)
 *   - Timestamp: Date and time of session
 * - **Border Indicator**: Left border (border-primary) on each card
 *
 * ### 8. Additional Files
 * - **File Upload Button**: "+ Upload File" triggers hidden file input
 * - **Accepted Types**: .md, .pdf, .txt, .json files
 * - **Upload Workflow**:
 *   1. User clicks "Upload File"
 *   2. File input dialog opens
 *   3. User selects file
 *   4. `uploadFile()` API call with FormData
 *   5. Loading state shows "Uploading..."
 *   6. File added to `additionalFiles` array with fileId
 *   7. Button returns to "Upload File"
 * - **File Configuration**: Each file has:
 *   - File Type dropdown (8 types: REFERENCE, EXAMPLES, TROUBLESHOOTING, CHANGELOG, FAQ, API_DOCS, TUTORIAL, CUSTOM)
 *   - Description textarea (optional)
 *   - Remove button (destructive variant)
 *   - File ID display (for debugging)
 * - **Display Order**: Auto-incremented based on array index
 * - **Empty State**: Dashed border with "No files uploaded yet" message
 *
 * ### 9. Skill Instructions
 * - **Markdown Textarea**: Large textarea (10 rows) for skill instructions
 * - **Monospace Font**: font-mono class for code-like appearance
 * - **Validation**: Required, minimum 50 characters
 * - **Placeholder**: Multi-line example with markdown structure
 * - **Template Variables**: Supports `{{field_name}}` for input field values
 * - **Format**: Encourages markdown with headings, lists, examples
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS for styling:
 *
 * ### Dialog Styling
 * - **Max Width**: sm:max-w-[700px] for spacious layout
 * - **Content Area**: max-h-[60vh] with overflow-y-auto for scrolling
 * - **Padding**: p-4 for content area, pr-3 for scrollbar spacing
 * - **Grid Layout**: grid gap-4 for vertical spacing between sections
 *
 * ### Form Controls
 * - **Labels**: text-sm font-medium text-muted-foreground
 * - **Required Indicator**: text-red-400 asterisk (*)
 * - **Help Text**: text-xs text-muted-foreground below inputs
 * - **Error Messages**: text-red-500 text-xs with red border on input
 * - **Disabled State**: Disabled cursor and opacity for loading state
 *
 * ### Tab System
 * - **Tab Headers**: flex border-b for tab bar
 * - **Active Tab**: border-primary text-primary with bottom border-b-2
 * - **Inactive Tab**: border-transparent text-muted-foreground with hover:text-foreground
 * - **Tab Content**: border border-border rounded-md p-3 for content area
 *
 * ### Result Banner
 * - **Success**: bg-green-900/50 text-green-300 with CheckCircleIcon
 * - **Error**: bg-red-900/50 text-red-300 with XCircleIcon
 * - **Layout**: flex items-start space-x-3 for icon and text alignment
 *
 * ### Collapsible Sections
 * - **Header Button**: w-full flex items-center justify-between hover:bg-secondary/50
 * - **Collapsed Indicator**: ▶ (right arrow)
 * - **Expanded Indicator**: ▼ (down arrow)
 * - **Content**: Border-t separator when expanded
 *
 * @interface SkillCreationModalProps
 * @property {boolean} isOpen - Controls modal visibility
 * @property {() => void} onClose - Callback when modal closes (via backdrop, cancel button, or auto-close)
 * @property {() => void} onSkillCreated - Callback after successful skill creation/update, used to refresh parent skill list
 * @property {Skill} [editSkill] - Optional skill object for edit mode. If provided, modal enters edit mode with pre-populated fields
 *
 * @example
 * // Basic usage - Create new skill
 * function SkillsPage() {
 *   const [isModalOpen, setIsModalOpen] = useState(false);
 *
 *   const handleSkillCreated = () => {
 *     // Refresh skills list
 *     loadSkills();
 *   };
 *
 *   return (
 *     <>
 *       <Button onClick={() => setIsModalOpen(true)}>Create Skill</Button>
 *       <SkillCreationModal
 *         isOpen={isModalOpen}
 *         onClose={() => setIsModalOpen(false)}
 *         onSkillCreated={handleSkillCreated}
 *       />
 *     </>
 *   );
 * }
 *
 * @example
 * // Edit existing skill
 * function SkillList({ skills }: { skills: Skill[] }) {
 *   const [editingSkill, setEditingSkill] = useState<Skill | undefined>();
 *
 *   return (
 *     <>
 *       {skills.map(skill => (
 *         <div key={skill.id}>
 *           <h3>{skill.name}</h3>
 *           <Button onClick={() => setEditingSkill(skill)}>Edit</Button>
 *         </div>
 *       ))}
 *       <SkillCreationModal
 *         isOpen={!!editingSkill}
 *         onClose={() => setEditingSkill(undefined)}
 *         onSkillCreated={() => {
 *           setEditingSkill(undefined);
 *           loadSkills();
 *         }}
 *         editSkill={editingSkill}
 *       />
 *     </>
 *   );
 * }
 *
 * @example
 * // Understanding input fields builder
 * // When user creates input fields like:
 * // - name: "target_path", type: "text", label: "Target Path", required: true
 * // - name: "format", type: "dropdown", options: ["json", "csv"], required: false
 * //
 * // The skill.md can use template variables:
 * // "Process the file at {{target_path}} and convert to {{format}} format"
 * //
 * // When skill is executed, user sees form with:
 * // - Text input labeled "Target Path" (required)
 * // - Dropdown labeled "Format" with json/csv options (optional)
 * //
 * // Submitted values replace template variables in instructions
 *
 * @example
 * // Understanding tool configuration workflow
 * // Skill creator wants to restrict skill to specific tools:
 * //
 * // 1. User clicks "Allowed Tools" tab
 * // 2. Selects "Read", "Write", "Grep" from available tools
 * // 3. Badge shows "Allowed Tools (3)"
 * // 4. Help text shows: "Selected: Read, Write, Grep"
 * // 5. When skill executes, only these 3 tools are available
 * //
 * // Alternatively, user can block specific tools:
 * // 1. User clicks "Disallowed Tools" tab
 * // 2. Selects "Bash", "WebFetch" to block
 * // 3. Badge shows "Disallowed Tools (2)"
 * // 4. Help text shows: "Disallowed: Bash, WebFetch"
 * // 5. When skill executes, all tools EXCEPT these 2 are available
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { SpinnerIcon, CheckCircleIcon, XCircleIcon } from './ui/Icons';
import { createSkill, updateSkill, getTools, uploadFile, deleteFile, type Tool, type InputField, type SkillFileUpload } from '../services/api';
import type { Skill } from '../../../types/agent.types';
import MCPToolsSelector from './MCPToolsSelector';

interface SkillCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillCreated: () => void;
  editSkill?: Skill; // Optional: If provided, modal will be in edit mode
}

/**
 * Creation status type for tracking form submission state
 * @typedef {'idle' | 'loading' | 'success' | 'error'} CreationStatus
 */
type CreationStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Form state interface containing all skill configuration fields
 * @interface FormState
 * @property {string} name - Skill identifier (lowercase, hyphens, max 64 chars) - immutable in edit mode
 * @property {string} description - Skill description for discovery (max 1024 chars)
 * @property {string} skillmd - Markdown instructions for skill execution (min 50 chars)
 * @property {string} category - Skill category for organization
 * @property {boolean} isPublic - Whether skill is available to all agents
 * @property {string} version - Semantic version (e.g., "1.0.0")
 * @property {string} license - Optional license type (e.g., "MIT", max 100 chars)
 */
interface FormState {
  name: string;
  description: string;
  skillmd: string;
  category: 'general-purpose' | 'code-analysis' | 'data-processing' | 'web-scraping' | 'file-manipulation' | 'api-integration' | 'browser-automation' | 'testing' | 'custom';
  isPublic: boolean;
  version: string;
  license: string;
}

const SkillCreationModal: React.FC<SkillCreationModalProps> = ({ isOpen, onClose, onSkillCreated, editSkill }) => {
  const isEditMode = !!editSkill;

  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    skillmd: '',
    category: 'custom',
    isPublic: true,
    version: '1.0.0',
    license: ''
  });
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]); // Phase 2
  const [selectedMCPTools, setSelectedMCPTools] = useState<Record<string, string[]>>({});
  const [inputFields, setInputFields] = useState<InputField[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creationStatus, setCreationStatus] = useState<CreationStatus>('idle');
  const [creationResult, setCreationResult] = useState<string>('');

  // Phase 2: Model configuration state
  const [modelConfigEnabled, setModelConfigEnabled] = useState(false);
  const [modelConfig, setModelConfig] = useState({
    model: 'sonnet' as 'haiku' | 'sonnet' | 'sonnet-4' | 'opus' | 'opus-4',
    temperature: 1.0,
    maxTokens: undefined as number | undefined,
    timeout: undefined as number | undefined,
  });

  // Phase 2: UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeToolTab, setActiveToolTab] = useState<'allowed' | 'disallowed'>('allowed');

  // Phase 3: Additional files state
  const [additionalFiles, setAdditionalFiles] = useState<SkillFileUpload[]>([]);
  const [fileUploadLoading, setFileUploadLoading] = useState(false);

  // Load available tools when modal opens
  useEffect(() => {
    if (isOpen) {
      getTools()
        .then(setAvailableTools)
        .catch((err) => console.error('Failed to load tools:', err));
    }
  }, [isOpen]);

  // Populate form when editing an existing skill
  useEffect(() => {
    if (isEditMode && editSkill) {
      console.log('Edit Skill Data:', {
        name: editSkill.name,
        toolConfig: editSkill.toolConfig,
        allowedTools: editSkill.toolConfig?.allowedTools,
        mcpConfig: editSkill.mcpConfig
      });

      setFormState({
        name: editSkill.name,
        description: editSkill.description,
        skillmd: editSkill.skillmd,
        category: editSkill.category || 'custom',
        isPublic: editSkill.isPublic !== undefined ? editSkill.isPublic : true,
        version: editSkill.version || '1.0.0',
        license: editSkill.license || ''
      });

      // Transform component-based structure to form state
      setSelectedTools(editSkill.toolConfig?.allowedTools || []);
      setDisallowedTools(editSkill.toolConfig?.disallowedTools || []); // Phase 2

      // Phase 2: Load model configuration
      if (editSkill.modelConfig) {
        setModelConfigEnabled(true);
        setModelConfig({
          model: editSkill.modelConfig.model || 'sonnet',
          temperature: editSkill.modelConfig.temperature !== undefined ? editSkill.modelConfig.temperature : 1.0,
          maxTokens: editSkill.modelConfig.maxTokens,
          timeout: editSkill.modelConfig.timeout,
        });
      }

      // Transform mcpConfig (component array) to Record<serverId, toolNames[]>
      const mcpToolsRecord: Record<string, string[]> = {};
      if (editSkill.mcpConfig) {
        editSkill.mcpConfig.forEach((config) => {
          // Use documentId as serverId (frontend uses documentId everywhere)
          // Strapi returns raw response with both id (integer) and documentId (string)
          const serverId = typeof config.mcpServer === 'string'
            ? config.mcpServer
            : ((config.mcpServer as any).documentId || String(config.mcpServer.id));
          if (config.selectedTools) {
            mcpToolsRecord[serverId] = config.selectedTools.map((toolSel) =>
              typeof toolSel.mcpTool === 'string' ? toolSel.mcpTool : toolSel.mcpTool.name
            );
          }
        });
      }
      setSelectedMCPTools(mcpToolsRecord);

      // Load input fields
      setInputFields(editSkill.inputFields || []);

      // Phase 3: Load additional files
      if (editSkill.additionalFiles && editSkill.additionalFiles.length > 0) {
        console.log('[DEBUG] Loading additionalFiles from edit mode:', editSkill.additionalFiles);

        setAdditionalFiles(editSkill.additionalFiles.map(f => {
          // Extract fileId - could be number, string, or object
          let fileId = '';
          if (typeof f.file === 'number') {
            fileId = f.file.toString();
          } else if (typeof f.file === 'string') {
            fileId = f.file;
          } else if (f.file && typeof f.file === 'object') {
            fileId = f.file.id ? f.file.id.toString() : '';
          }

          console.log('[DEBUG] Mapped file:', { originalFile: f.file, extractedFileId: fileId });

          return {
            fileId,
            fileType: f.fileType,
            description: f.description || '',
            displayOrder: f.displayOrder
          };
        }));
      }
    }
  }, [isEditMode, editSkill]);

  /**
   * Handles input field changes for form state
   * @internal
   * @param field - Form field name to update
   * @param value - New value for the field
   *
   * Updates the specified field in formState and clears any associated error
   * for real-time error feedback. Provides immediate user feedback when
   * correcting validation errors.
   */
  const handleInputChange = (field: keyof FormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * Toggles tool selection in allowed tools list
   * @internal
   * @param toolName - Name of the tool to toggle
   *
   * Adds or removes tool from selectedTools array. If tool is already selected,
   * removes it; otherwise adds it to the selection.
   */
  const handleToolToggle = (toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  };

  /**
   * Validates all form fields before submission
   * @internal
   * @returns {boolean} True if all validations pass, false otherwise
   *
   * Performs comprehensive validation:
   * - Name (create mode): required, lowercase/numbers/hyphens only, max 64 chars
   * - Description: required, max 1024 chars
   * - Skill Instructions: required, min 50 chars
   * - Version: required, semantic versioning format (e.g., "1.0.0")
   * - License: optional, max 100 chars if provided
   *
   * Sets errors object with field-specific messages for any validation failures.
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation (only in create mode)
    if (!isEditMode) {
      if (!formState.name.trim()) {
        newErrors.name = 'Skill name is required.';
      } else if (!/^[a-z0-9-]+$/.test(formState.name)) {
        newErrors.name = 'Name must contain only lowercase letters, numbers, and hyphens.';
      } else if (formState.name.length > 64) {
        newErrors.name = 'Name must be 64 characters or less.';
      }
    }

    // Description validation
    if (!formState.description.trim()) {
      newErrors.description = 'Description is required.';
    } else if (formState.description.length > 1024) {
      newErrors.description = 'Description must be 1024 characters or less.';
    }

    // Skill instructions validation
    if (!formState.skillmd.trim()) {
      newErrors.skillmd = 'Skill instructions are required.';
    } else if (formState.skillmd.length < 50) {
      newErrors.skillmd = 'Skill instructions must be at least 50 characters.';
    }

    // Version validation
    if (!formState.version.trim()) {
      newErrors.version = 'Version is required.';
    } else if (!/^\d+\.\d+\.\d+$/.test(formState.version)) {
      newErrors.version = 'Version must follow semantic versioning (e.g., 1.0.0).';
    }

    // License validation (optional, but if provided check length)
    if (formState.license && formState.license.length > 100) {
      newErrors.license = 'License must be less than 100 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles form submission for creating or updating a skill
   * @internal
   *
   * Workflow:
   * 1. Validates form fields using validateForm()
   * 2. Sets loading state and clears previous results
   * 3. Builds API payload based on mode (create vs edit)
   * 4. Calls createSkill() or updateSkill() API
   * 5. Handles success: sets success state, shows message, auto-closes after 2s
   * 6. Handles error: sets error state, shows error message
   * 7. Invokes onSkillCreated callback on success
   *
   * Create Mode:
   * - Generates displayName from name (e.g., "test-skill" → "Test Skill")
   * - Includes all form fields in payload
   * - Creates new skill file at .claude/skills/{name}/skill.md
   *
   * Edit Mode:
   * - Excludes name from payload (immutable)
   * - Updates existing skill file
   * - Preserves existing skill.id for API call
   *
   * Data Transformations:
   * - Empty arrays/objects excluded from payload (undefined)
   * - Model config included only if enabled
   * - Additional files included only if non-empty
   * - MCP tools transformed to API format
   */
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setCreationStatus('loading');
    setCreationResult('');

    try {
      let data;

      if (isEditMode && editSkill) {
        // DEBUG: Log additionalFiles state before update
        console.log('[DEBUG] additionalFiles state before update:', {
          length: additionalFiles.length,
          files: additionalFiles,
          willSend: additionalFiles.length > 0
        });

        // Update existing skill
        const updatePayload = {
          description: formState.description,
          allowedTools: selectedTools.length > 0 ? selectedTools : undefined,
          disallowedTools: disallowedTools.length > 0 ? disallowedTools : undefined, // Phase 2
          mcpTools: Object.keys(selectedMCPTools).length > 0 ? selectedMCPTools : undefined,
          inputFields: inputFields.length > 0 ? inputFields : undefined,
          skillmd: formState.skillmd,
          category: formState.category,
          isPublic: formState.isPublic,
          version: formState.version,
          license: formState.license || undefined,
          // Phase 2: Model configuration
          modelConfig: modelConfigEnabled ? modelConfig : undefined,
          // Phase 3: Additional files
          additionalFiles: additionalFiles.length > 0 ? additionalFiles : undefined,
        };

        console.log('[DEBUG] Update payload:', {
          hasAdditionalFiles: 'additionalFiles' in updatePayload,
          additionalFiles: updatePayload.additionalFiles
        });

        data = await updateSkill(editSkill.id, updatePayload);
      } else {
        // Create new skill
        // Generate displayName from name (e.g., "test-skill" -> "Test Skill")
        const displayName = formState.name
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        data = await createSkill({
          name: formState.name,
          displayName: displayName,
          description: formState.description,
          allowedTools: selectedTools.length > 0 ? selectedTools : undefined,
          disallowedTools: disallowedTools.length > 0 ? disallowedTools : undefined, // Phase 2
          mcpTools: Object.keys(selectedMCPTools).length > 0 ? selectedMCPTools : undefined,
          inputFields: inputFields.length > 0 ? inputFields : undefined,
          skillmd: formState.skillmd,
          category: formState.category,
          isPublic: formState.isPublic,
          version: formState.version,
          license: formState.license || undefined,
          // Phase 2: Model configuration
          modelConfig: modelConfigEnabled ? modelConfig : undefined,
          // Phase 3: Additional files
          additionalFiles: additionalFiles.length > 0 ? additionalFiles : undefined,
        });
      }

      if (data.success) {
        setCreationStatus('success');
        const action = isEditMode ? 'updated' : 'created';
        setCreationResult(`Skill "${formState.name}" ${action} successfully at ${data.path}`);
        onSkillCreated();

        // Close modal after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setCreationStatus('error');
        const action = isEditMode ? 'update' : 'create';
        setCreationResult(data.error || `Failed to ${action} skill. Please try again.`);
      }
    } catch (error) {
      setCreationStatus('error');
      setCreationResult(error instanceof Error ? error.message : 'Network error. Please check your connection and try again.');
      console.error('Skill operation error:', error);
    }
  }, [isEditMode, editSkill, formState, selectedTools, disallowedTools, selectedMCPTools, inputFields, modelConfigEnabled, modelConfig, additionalFiles, onSkillCreated]);

  /**
   * Handles modal close and resets all form state
   * @internal
   *
   * Resets all state to initial values:
   * - Core form fields (name, description, skillmd, category, isPublic, version, license)
   * - Tool selections (selectedTools, disallowedTools)
   * - MCP tools (selectedMCPTools)
   * - Input fields (inputFields)
   * - Validation errors (errors)
   * - Creation status and result
   * - Model configuration (modelConfigEnabled, modelConfig)
   * - UI state (showAdvanced, activeToolTab)
   * - File uploads (additionalFiles, fileUploadLoading)
   *
   * Called when:
   * - User clicks Cancel button
   * - User clicks backdrop (Dialog onOpenChange)
   * - Auto-close timeout after success (2s)
   * - User clicks X button in dialog header
   */
  const handleClose = () => {
    setFormState({
      name: '',
      description: '',
      skillmd: '',
      category: 'custom',
      isPublic: true,
      version: '1.0.0',
      license: ''
    });
    setSelectedTools([]);
    setDisallowedTools([]); // Phase 2
    setSelectedMCPTools({});
    setInputFields([]);
    setErrors({});
    setCreationStatus('idle');
    setCreationResult('');
    // Phase 2: Reset model config
    setModelConfigEnabled(false);
    setModelConfig({
      model: 'sonnet',
      temperature: 1.0,
      maxTokens: undefined,
      timeout: undefined,
    });
    setShowAdvanced(false);
    setActiveToolTab('allowed');
    // Phase 3: Reset additional files
    setAdditionalFiles([]);
    setFileUploadLoading(false);
    onClose();
  };

  /**
   * Renders color-coded result banner based on creation status
   * @internal
   * @returns {JSX.Element | null} Result banner element or null if idle
   *
   * Status-based rendering:
   * - idle: Returns null (no banner)
   * - loading: Not rendered (spinner shows in submit button instead)
   * - success: Green banner with CheckCircleIcon and success message
   * - error: Red banner with XCircleIcon and error message
   *
   * Banner styling:
   * - Success: bg-green-900/50 text-green-300
   * - Error: bg-red-900/50 text-red-300
   * - Layout: flex items-start space-x-3 for icon-text alignment
   */
  const renderResult = () => {
    if (creationStatus === 'idle') return null;

    const baseClasses = "mt-4 p-4 rounded-md text-sm flex items-start space-x-3";

    if (creationStatus === 'success') {
      return (
        <div className={`${baseClasses} bg-green-900/50 text-green-300`}>
          <CheckCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p>{creationResult}</p>
        </div>
      );
    }

    if (creationStatus === 'error') {
      return (
        <div className={`${baseClasses} bg-red-900/50 text-red-300`}>
          <XCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p>{creationResult}</p>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Skill' : 'Create New Skill'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the skill details. The skill name cannot be changed.'
              : 'Create a new Agent Skill that extends Claude\'s capabilities. Skills are automatically discovered and used when relevant.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-3">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">
              Skill Name <span className="text-red-400">*</span>
            </label>
            <Input
              id="name"
              type="text"
              value={formState.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="pdf-processor, git-commit-helper, excel-analyzer..."
              className={errors.name ? 'border-red-500' : ''}
              disabled={isEditMode}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {isEditMode
                ? 'Skill name cannot be changed (used as directory name and ID)'
                : 'Use lowercase letters, numbers, and hyphens only (max 64 characters)'}
            </p>
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <Textarea
              id="description"
              value={formState.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder='Extract text and tables from PDFs. Use when working with PDF files or document extraction.'
              rows={3}
              className={errors.description ? 'border-red-500' : ''}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Describe what the skill does and when to use it (max 1024 characters)
            </p>
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Category Field */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-muted-foreground mb-1">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              id="category"
              value={formState.category}
              onChange={(e) => handleInputChange('category', e.target.value as any)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              disabled={creationStatus === 'loading'}
            >
              <option value="custom">Custom</option>
              <option value="general-purpose">General Purpose</option>
              <option value="code-analysis">Code Analysis</option>
              <option value="data-processing">Data Processing</option>
              <option value="web-scraping">Web Scraping</option>
              <option value="file-manipulation">File Manipulation</option>
              <option value="api-integration">API Integration</option>
              <option value="browser-automation">Browser Automation</option>
              <option value="testing">Testing</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Select the category that best describes this skill's purpose
            </p>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          {/* Version and License Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Version Field */}
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-muted-foreground mb-1">
                Version <span className="text-red-400">*</span>
              </label>
              <Input
                id="version"
                type="text"
                value={formState.version}
                onChange={(e) => handleInputChange('version', e.target.value)}
                placeholder="1.0.0"
                className={errors.version ? 'border-red-500' : ''}
                disabled={creationStatus === 'loading'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Semantic versioning (e.g., 1.0.0)
              </p>
              {errors.version && <p className="text-red-500 text-xs mt-1">{errors.version}</p>}
            </div>

            {/* License Field */}
            <div>
              <label htmlFor="license" className="block text-sm font-medium text-muted-foreground mb-1">
                License <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <Input
                id="license"
                type="text"
                value={formState.license}
                onChange={(e) => handleInputChange('license', e.target.value)}
                placeholder="MIT, Apache-2.0, GPL-3.0..."
                className={errors.license ? 'border-red-500' : ''}
                disabled={creationStatus === 'loading'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                License type (max 100 characters)
              </p>
              {errors.license && <p className="text-red-500 text-xs mt-1">{errors.license}</p>}
            </div>
          </div>

          {/* Is Public Toggle */}
          <div className="flex items-center justify-between p-3 border border-border rounded-md bg-secondary/10">
            <div>
              <label htmlFor="isPublic" className="text-sm font-medium">
                Public Skill
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Make this skill available to all agents in the system
              </p>
            </div>
            <input
              id="isPublic"
              type="checkbox"
              checked={formState.isPublic}
              onChange={(e) => handleInputChange('isPublic', e.target.checked as any)}
              disabled={creationStatus === 'loading'}
              className="w-5 h-5"
            />
          </div>

          {/* Tool Configuration - Phase 2: Tab System */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Tool Configuration <span className="text-muted-foreground text-xs">(Optional)</span>
            </label>

            {/* Tab Headers */}
            <div className="flex border-b border-border mb-2">
              <button
                type="button"
                onClick={() => setActiveToolTab('allowed')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeToolTab === 'allowed'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Allowed Tools ({selectedTools.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveToolTab('disallowed')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeToolTab === 'disallowed'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Disallowed Tools ({disallowedTools.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto">
              {availableTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading tools...</p>
              ) : (
                <div className="space-y-2">
                  {activeToolTab === 'allowed' ? (
                    // Allowed Tools Tab
                    availableTools.map((tool) => (
                      <label
                        key={tool.name}
                        className="flex items-start gap-2 cursor-pointer hover:bg-secondary/50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(tool.name)}
                          onChange={() => handleToolToggle(tool.name)}
                          disabled={creationStatus === 'loading'}
                          className="mt-1 w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{tool.name}</div>
                          <div className="text-xs text-muted-foreground">{tool.description}</div>
                        </div>
                      </label>
                    ))
                  ) : (
                    // Disallowed Tools Tab
                    availableTools.map((tool) => (
                      <label
                        key={tool.name}
                        className="flex items-start gap-2 cursor-pointer hover:bg-secondary/50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={disallowedTools.includes(tool.name)}
                          onChange={() => {
                            if (disallowedTools.includes(tool.name)) {
                              setDisallowedTools(disallowedTools.filter(t => t !== tool.name));
                            } else {
                              setDisallowedTools([...disallowedTools, tool.name]);
                            }
                          }}
                          disabled={creationStatus === 'loading'}
                          className="mt-1 w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{tool.name}</div>
                          <div className="text-xs text-muted-foreground">{tool.description}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeToolTab === 'allowed'
                ? (selectedTools.length > 0
                    ? `Selected: ${selectedTools.join(', ')}`
                    : 'Leave empty to allow all tools. Select specific tools to restrict what the skill can use.')
                : (disallowedTools.length > 0
                    ? `Disallowed: ${disallowedTools.join(', ')}`
                    : 'Leave empty to allow all tools. Select specific tools to explicitly block.')
              }
            </p>
          </div>

          {/* MCP Server Tools */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              MCP Server Tools <span className="text-muted-foreground text-xs">(Optional)</span>
            </label>
            <MCPToolsSelector
              selectedMCPTools={selectedMCPTools}
              onChange={setSelectedMCPTools}
              disabled={creationStatus === 'loading'}
              directory={undefined}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select specific MCP tools this skill can use. Leave empty to allow all MCP tools.
            </p>
          </div>

          {/* Input Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Input Fields <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setInputFields([...inputFields, {
                    name: '',
                    type: 'text',
                    label: '',
                    required: false,
                  }]);
                }}
                disabled={creationStatus === 'loading'}
              >
                + Add Field
              </Button>
            </div>

            {inputFields.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded">
                No input fields defined. Click "+ Add Field" to add fields that users will fill when executing this skill.
              </p>
            ) : (
              <div className="space-y-3 border border-border rounded p-3">
                {inputFields.map((field, index) => (
                  <div key={index} className="border border-border rounded p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Field Name *</label>
                        <Input
                          type="text"
                          value={field.name}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].name = e.target.value;
                            setInputFields(newFields);
                          }}
                          placeholder="target_path"
                          disabled={creationStatus === 'loading'}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Label *</label>
                        <Input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].label = e.target.value;
                            setInputFields(newFields);
                          }}
                          placeholder="Target Path"
                          disabled={creationStatus === 'loading'}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Type *</label>
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].type = e.target.value as any;
                            setInputFields(newFields);
                          }}
                          disabled={creationStatus === 'loading'}
                          className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="multiselect">Multiselect</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="number">Number</option>
                          <option value="filepath">File Path</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Placeholder</label>
                        <Input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].placeholder = e.target.value;
                            setInputFields(newFields);
                          }}
                          placeholder="/path/to/file"
                          disabled={creationStatus === 'loading'}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {(field.type === 'dropdown' || field.type === 'multiselect') && (
                      <div>
                        <label className="block text-xs font-medium mb-1">Options (comma-separated) *</label>
                        <Input
                          type="text"
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].options = e.target.value.split(',').map(o => o.trim()).filter(Boolean);
                            setInputFields(newFields);
                          }}
                          placeholder="json, markdown, html"
                          disabled={creationStatus === 'loading'}
                          className="text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium mb-1">Description</label>
                      <Input
                        type="text"
                        value={field.description || ''}
                        onChange={(e) => {
                          const newFields = [...inputFields];
                          newFields[index].description = e.target.value;
                          setInputFields(newFields);
                        }}
                        placeholder="Additional help text for this field"
                        disabled={creationStatus === 'loading'}
                        className="text-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) => {
                            const newFields = [...inputFields];
                            newFields[index].required = e.target.checked;
                            setInputFields(newFields);
                          }}
                          disabled={creationStatus === 'loading'}
                          className="w-3 h-3"
                        />
                        Required
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setInputFields(inputFields.filter((_, i) => i !== index));
                        }}
                        disabled={creationStatus === 'loading'}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Define form fields that users will fill when executing this skill. Use template variables like {`{{field_name}}`} in your skill instructions.
            </p>
          </div>

          {/* Phase 2: Advanced Settings - Collapsible */}
          <div className="border border-border rounded-md">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 rounded-t-md transition-colors"
            >
              <span className="text-sm font-medium">⚙️ Advanced Settings</span>
              <span className="text-muted-foreground">{showAdvanced ? '▼' : '▶'}</span>
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 border-t border-border">
                {/* Model Configuration */}
                <div>
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={modelConfigEnabled}
                      onChange={(e) => setModelConfigEnabled(e.target.checked)}
                      disabled={creationStatus === 'loading'}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Override Model Configuration</span>
                  </label>

                  {modelConfigEnabled && (
                    <div className="ml-6 space-y-3 p-3 border border-border rounded bg-secondary/10">
                      {/* Model Selection */}
                      <div>
                        <label className="block text-xs font-medium mb-1">Model</label>
                        <select
                          value={modelConfig.model}
                          onChange={(e) => setModelConfig({ ...modelConfig, model: e.target.value as any })}
                          disabled={creationStatus === 'loading'}
                          className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background"
                        >
                          <option value="haiku">Claude Haiku 3.5</option>
                          <option value="sonnet">Claude Sonnet 4.5</option>
                          <option value="sonnet-4">Claude Sonnet 4</option>
                          <option value="opus">Claude Opus 4</option>
                          <option value="opus-4">Claude Opus 4 (Latest)</option>
                        </select>
                      </div>

                      {/* Temperature Slider */}
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Temperature: {modelConfig.temperature.toFixed(2)}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={modelConfig.temperature}
                          onChange={(e) => setModelConfig({ ...modelConfig, temperature: parseFloat(e.target.value) })}
                          disabled={creationStatus === 'loading'}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Lower = more focused and deterministic, Higher = more creative and random
                        </p>
                      </div>

                      {/* Max Tokens */}
                      <div>
                        <label className="block text-xs font-medium mb-1">Max Tokens (Optional)</label>
                        <Input
                          type="number"
                          value={modelConfig.maxTokens || ''}
                          onChange={(e) => setModelConfig({ ...modelConfig, maxTokens: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="Leave empty for default"
                          disabled={creationStatus === 'loading'}
                          className="text-sm"
                          min="1"
                          max="200000"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum number of tokens to generate (1-200000)
                        </p>
                      </div>

                      {/* Timeout */}
                      <div>
                        <label className="block text-xs font-medium mb-1">Timeout (ms, Optional)</label>
                        <Input
                          type="number"
                          value={modelConfig.timeout || ''}
                          onChange={(e) => setModelConfig({ ...modelConfig, timeout: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="Leave empty for default (300000ms)"
                          disabled={creationStatus === 'loading'}
                          className="text-sm"
                          min="1000"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Request timeout in milliseconds (minimum 1000ms)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Phase 3: Analytics Display (Read-only, Edit Mode Only) */}
          {isEditMode && editSkill?.analytics && (
            <div className="border border-border rounded-md p-4 bg-secondary/10">
              <h3 className="text-sm font-medium mb-3">📊 Analytics</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Executions:</span>
                  <span className="ml-2 font-medium">{editSkill.analytics.executionCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="ml-2 font-medium">{editSkill.analytics.successRate.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Time:</span>
                  <span className="ml-2 font-medium">{editSkill.analytics.averageExecutionTime}ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Executed:</span>
                  <span className="ml-2 font-medium">
                    {editSkill.analytics.lastExecutedAt
                      ? new Date(editSkill.analytics.lastExecutedAt).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Phase 3: Training History Display (Read-only, Edit Mode Only) */}
          {isEditMode && editSkill?.trainingHistory && editSkill.trainingHistory.length > 0 && (
            <div className="border border-border rounded-md p-4 bg-secondary/10">
              <h3 className="text-sm font-medium mb-3">🎓 Training History</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {editSkill.trainingHistory.map((session, idx) => (
                  <div key={session.id || idx} className="border-l-2 border-primary pl-3 py-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{session.trainingType}</span>
                      <span className={`px-2 py-0.5 rounded ${session.success ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}`}>
                        {session.success ? '✓ Success' : '✗ Failed'}
                      </span>
                    </div>
                    {session.score !== undefined && (
                      <div className="text-muted-foreground">Score: {session.score}/100</div>
                    )}
                    {session.notes && (
                      <div className="text-muted-foreground mt-1">{session.notes}</div>
                    )}
                    <div className="text-muted-foreground text-[10px] mt-1">
                      {new Date(session.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 4: Additional Files (Full File Upload) */}
          <div className="border border-border rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">📎 Additional Files</h3>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.md,.pdf,.txt,.json';
                  input.onchange = async (e: Event) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;

                    try {
                      setFileUploadLoading(true);
                      const uploadedFile = await uploadFile(file);

                      // Use callback to get accurate length
                      setAdditionalFiles(prev => {
                        const newFile = {
                          fileId: uploadedFile.id.toString(),
                          fileType: 'CUSTOM' as const,
                          description: '',
                          displayOrder: prev.length,
                        };

                        const updated = [...prev, newFile];
                        console.log('[DEBUG] File added to state:', {
                          uploadedFile,
                          newFile,
                          previousLength: prev.length,
                          updatedLength: updated.length,
                          updated
                        });
                        return updated;
                      });
                    } catch (error: any) {
                      console.error('File upload error:', error);
                      alert(`Failed to upload file: ${error.message}`);
                    } finally {
                      setFileUploadLoading(false);
                    }
                  };
                  input.click();
                }}
                disabled={creationStatus === 'loading' || fileUploadLoading}
                className="h-7 px-3 text-xs"
              >
                {fileUploadLoading ? 'Uploading...' : '+ Upload File'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Upload reference documentation, examples, troubleshooting guides, and other supporting files.
            </p>

            {additionalFiles.length > 0 ? (
              <div className="space-y-3">
                {additionalFiles.map((file, idx) => (
                  <div key={idx} className="border border-border rounded-md p-3 bg-secondary/10">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {/* File Type Dropdown */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          File Type *
                        </label>
                        <select
                          value={file.fileType}
                          onChange={(e) => {
                            setAdditionalFiles(prev => {
                              const newFiles = [...prev];
                              newFiles[idx].fileType = e.target.value as any;
                              return newFiles;
                            });
                          }}
                          disabled={creationStatus === 'loading'}
                          className="w-full px-2 py-1 text-xs border border-border rounded-md bg-background"
                        >
                          <option value="REFERENCE">Reference Documentation</option>
                          <option value="EXAMPLES">Usage Examples</option>
                          <option value="TROUBLESHOOTING">Troubleshooting Guide</option>
                          <option value="CHANGELOG">Changelog</option>
                          <option value="FAQ">FAQ</option>
                          <option value="API_DOCS">API Documentation</option>
                          <option value="TUTORIAL">Tutorial</option>
                          <option value="CUSTOM">Custom</option>
                        </select>
                      </div>

                      {/* Remove Button */}
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            try {
                              // Optionally delete from Strapi if already uploaded
                              // await deleteFile(file.fileId);
                              setAdditionalFiles(prev => prev.filter((_, i) => i !== idx));
                            } catch (error: any) {
                              console.error('File delete error:', error);
                            }
                          }}
                          disabled={creationStatus === 'loading'}
                          className="h-7 px-3 text-xs w-full"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Description Textarea */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Description (Optional)
                      </label>
                      <Textarea
                        value={file.description || ''}
                        onChange={(e) => {
                          setAdditionalFiles(prev => {
                            const newFiles = [...prev];
                            newFiles[idx].description = e.target.value;
                            return newFiles;
                          });
                        }}
                        placeholder="Brief description of this file..."
                        disabled={creationStatus === 'loading'}
                        className="text-xs h-16 resize-none"
                      />
                    </div>

                    {/* File ID Display (for debugging) */}
                    <div className="text-xs text-muted-foreground mt-2">
                      File ID: {file.fileId}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-border rounded-md">
                <p className="text-xs text-muted-foreground">No files uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Upload File" to add reference documentation
                </p>
              </div>
            )}
          </div>

          {/* Skill Instructions Field */}
          <div>
            <label htmlFor="skillmd" className="block text-sm font-medium text-muted-foreground mb-1">
              Skill Instructions <span className="text-red-400">*</span>
            </label>
            <Textarea
              id="skillmd"
              value={formState.skillmd}
              onChange={(e) => handleInputChange('skillmd', e.target.value)}
              placeholder={'# Skill Title\n\n## Instructions\n\n1. Step by step guidance on what Claude should do\n2. Provide detailed context and requirements\n3. Include specific examples and use cases\n\n## Examples\n\nProvide concrete examples and edge cases here...\n\n(Minimum 50 characters required)'}
              rows={10}
              className={`font-mono text-xs ${errors.skillmd ? 'border-red-500' : ''}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Write clear, step-by-step instructions in Markdown format (minimum 50 characters). Include examples and best practices.
            </p>
            {errors.skillmd && <p className="text-red-500 text-xs mt-1">{errors.skillmd}</p>}
          </div>
        </div>

        {renderResult()}

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={creationStatus === 'loading'}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={creationStatus === 'loading'}>
            {creationStatus === 'loading' && <SpinnerIcon className="h-4 w-4 mr-2" />}
            {isEditMode ? 'Update Skill' : 'Create Skill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

SkillCreationModal.displayName = 'SkillCreationModal';

export default SkillCreationModal;
