/**
 * Input Node Component for React Flow
 *
 * A custom React Flow node component that displays input field configuration
 * with interactive editing capabilities. Shows a visual representation of all
 * configured input fields with their types, required status, and validation state.
 *
 * ## Features
 * - Displays all configured input fields with icons
 * - Shows field types (text, number, file, etc.) with appropriate icons
 * - Marks required fields with asterisk
 * - Visual validation status indicator
 * - Blue color theme for input nodes
 * - Click to open configuration panel (handled by parent)
 * - Compact, readable field list with truncation for long labels
 *
 * ## Component Structure
 * ```
 * InputNode
 *   └── BaseNode (with blue theme)
 *       ├── Field List
 *       │   ├── Field Item (icon, label, required indicator)
 *       │   ├── Field Item
 *       │   └── ...
 *       └── Empty State (if no fields configured)
 * ```
 *
 * ## Field Type Icons
 * - **text**: AlphabeticalIcon (Type indicator)
 * - **textarea**: MessageSquareIcon (Multi-line text)
 * - **number**: HashIcon (Numeric input)
 * - **url**: GlobeIcon (Web URLs)
 * - **email**: MailIcon (Email addresses)
 * - **file**: PaperclipIcon (File uploads)
 * - **select**: ChevronDownIcon (Dropdown selection)
 * - **multiselect**: SlidersHorizontalIcon (Multiple selections)
 * - **checkbox**: CheckCircleIcon (Boolean toggle)
 * - **date**: ClockIcon (Date selection)
 * - **datetime**: ClockIcon (Date and time)
 *
 * ## Validation Status
 * - **Valid**: Green check icon if at least one field is configured
 * - **Invalid**: Warning icon if no fields configured
 * - Shows field count in header subtitle
 *
 * @example
 * // Basic usage in React Flow
 * const nodeTypes = {
 *   input: InputNode,
 *   // ... other node types
 * };
 *
 * <ReactFlow nodeTypes={nodeTypes} nodes={nodes} edges={edges} />
 *
 * @example
 * // With configured input fields
 * const inputNodeData: InputNodeData = {
 *   nodeId: 'input-1',
 *   type: 'input',
 *   name: 'User Registration',
 *   inputFields: [
 *     { name: 'username', type: 'text', label: 'Username', required: true },
 *     { name: 'email', type: 'email', label: 'Email Address', required: true },
 *     { name: 'age', type: 'number', label: 'Age', required: false },
 *   ],
 * };
 */

import React from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ReactFlowInputNode, InputNodeData } from '../../../types/react-flow.types';
import type { FlowInputField, InputFieldType } from '../../../types';
import { BaseNode } from './BaseNode';
import {
  PaperclipIcon,
  GlobeIcon,
  ChevronDownIcon,
  SlidersHorizontalIcon,
  CheckCircleIcon,
  ClockIcon,
  MessageSquareIcon,
  ExclamationCircleIcon,
} from '../../ui/Icons';

/**
 * Icon mapping for different input field types
 * Each field type gets a distinct icon for visual recognition
 */
const FIELD_TYPE_ICONS: Record<InputFieldType, React.ReactNode> = {
  text: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  textarea: <MessageSquareIcon width={16} height={16} />,
  number: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  url: <GlobeIcon width={16} height={16} />,
  email: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  file: <PaperclipIcon width={16} height={16} />,
  select: <ChevronDownIcon width={16} height={16} />,
  multiselect: <SlidersHorizontalIcon width={16} height={16} />,
  checkbox: <CheckCircleIcon width={16} height={16} />,
  date: <ClockIcon width={16} height={16} />,
  datetime: <ClockIcon width={16} height={16} />,
};

/**
 * Props for the InputNode component
 * Extends React Flow's NodeProps with InputNodeData
 */
export type InputNodeProps = NodeProps<ReactFlowInputNode>;

/**
 * Props for individual field item display
 */
interface FieldItemProps {
  field: FlowInputField;
}

/**
 * Individual field item component
 * Displays a single input field with its icon, label, and required indicator
 */
const FieldItem: React.FC<FieldItemProps> = ({ field }) => {
  const icon = FIELD_TYPE_ICONS[field.type];

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/30 hover:bg-secondary/50 transition-colors"
      title={`${field.label}${field.required ? ' (required)' : ''} - ${field.type}`}
    >
      {/* Field Type Icon */}
      <div className="flex-shrink-0 text-blue-500">
        {icon}
      </div>

      {/* Field Label */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate block">
          {field.label}
          {field.required && (
            <span className="text-red-500 ml-1" title="Required field">
              *
            </span>
          )}
        </span>
        {field.description && (
          <span className="text-[10px] text-muted-foreground truncate block">
            {field.description}
          </span>
        )}
      </div>

      {/* Field Type Badge */}
      <div className="flex-shrink-0">
        <span className="text-[10px] text-muted-foreground uppercase">
          {field.type}
        </span>
      </div>
    </div>
  );
};

/**
 * InputNode Component
 *
 * Renders an input node in the React Flow canvas, displaying all configured
 * input fields with visual indicators for type and required status.
 */
export const InputNode: React.FC<InputNodeProps> = ({ data, selected, id }) => {
  const hasFields = data.inputFields && data.inputFields.length > 0;
  const fieldCount = data.inputFields?.length || 0;
  const requiredFieldCount = data.inputFields?.filter((f) => f.required).length || 0;

  // Determine validation status
  const isValid = hasFields;
  const validationIcon = isValid ? (
    <CheckCircleIcon width={16} height={16} className="text-green-500" />
  ) : (
    <ExclamationCircleIcon width={16} height={16} className="text-yellow-500" />
  );

  // Generate node title with field count
  const nodeTitle = data.name || 'Input';

  // Input icon for the header
  const inputIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );

  return (
    <BaseNode
      icon={inputIcon}
      title={nodeTitle}
      selected={selected}
      nodeType="input"
      status={data.metadata?.status as any}
      showDeleteButton={true}
      className="cursor-pointer"
    >
      <div className="space-y-2">
        {/* Field Count and Validation Status */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/30">
          <span>
            {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
            {requiredFieldCount > 0 && (
              <span className="ml-1">
                ({requiredFieldCount} required)
              </span>
            )}
          </span>
          <div title={isValid ? 'Valid configuration' : 'No fields configured'}>
            {validationIcon}
          </div>
        </div>

        {/* Input Fields List */}
        {hasFields ? (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.inputFields.map((field, index) => (
              <FieldItem key={`${field.name}-${index}`} field={field} />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-6 px-2">
            <ExclamationCircleIcon
              width={24}
              height={24}
              className="mx-auto text-muted-foreground mb-2"
            />
            <p className="text-xs text-muted-foreground">
              No fields configured
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Click to add input fields
            </p>
          </div>
        )}

        {/* Description (if provided) */}
        {data.description && (
          <div className="pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground italic line-clamp-2">
              {data.description}
            </p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

/**
 * Display name for React DevTools
 */
InputNode.displayName = 'InputNode';

export default InputNode;
