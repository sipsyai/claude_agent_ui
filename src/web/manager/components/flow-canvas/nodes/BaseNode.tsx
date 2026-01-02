/**
 * Base Node Component for React Flow
 *
 * A reusable base node component that provides consistent styling, interaction states,
 * and common functionality for all custom node types in the React Flow canvas.
 *
 * ## Features
 * - Consistent card-based styling with theme-aware colors
 * - Source and target handles for node connections
 * - Selection highlight with colored border
 * - Hover state with subtle visual feedback
 * - Node header with icon, title, and optional status indicator
 * - Delete button that appears on selection
 * - Flexible content area for node-specific rendering
 * - Accessible keyboard navigation and focus states
 *
 * ## Component Structure
 * ```
 * BaseNode (container with handles)
 *   ├── Target Handle (top) - for incoming connections
 *   ├── Node Card
 *   │   ├── Header (icon, title, status, delete button)
 *   │   └── Content (children - node-specific content)
 *   └── Source Handle (bottom) - for outgoing connections
 * ```
 *
 * ## Styling Behavior
 * - **Default**: Card with border, subtle shadow, theme background
 * - **Hover**: Slightly enhanced shadow for depth
 * - **Selected**: Colored border (blue/purple/green based on node type)
 * - **Handles**: Circular connection points with hover states
 * - **Delete Button**: Only visible when node is selected
 *
 * ## Node Type Colors
 * - Input nodes: Blue theme (border-blue-500)
 * - Agent nodes: Purple theme (border-purple-500)
 * - Output nodes: Green theme (border-green-500)
 *
 * @example
 * // Basic usage in a custom node
 * const InputNode: React.FC<NodeProps<ReactFlowInputNode>> = ({ data, selected }) => (
 *   <BaseNode
 *     icon={<DownloadIcon />}
 *     title={data.name}
 *     selected={selected}
 *     nodeType="input"
 *     onDelete={() => console.log('Delete node')}
 *   >
 *     <div className="space-y-2">
 *       {data.inputFields.map(field => (
 *         <div key={field.name}>{field.label}</div>
 *       ))}
 *     </div>
 *   </BaseNode>
 * );
 *
 * @example
 * // With status indicator
 * <BaseNode
 *   icon={<CpuChipIcon />}
 *   title="Processing Agent"
 *   status="running"
 *   selected={selected}
 *   nodeType="agent"
 * >
 *   <div>Agent content...</div>
 * </BaseNode>
 *
 * @example
 * // Without delete button
 * <BaseNode
 *   icon={<ServerIcon />}
 *   title="Output Node"
 *   selected={selected}
 *   nodeType="output"
 *   showDeleteButton={false}
 * >
 *   <div>Output configuration...</div>
 * </BaseNode>
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { XIcon } from '../../ui/Icons';

/**
 * Props for the BaseNode component
 */
export interface BaseNodeProps {
  /**
   * Icon to display in the node header
   * Should be a React element (typically an icon component)
   */
  icon: React.ReactNode;

  /**
   * Title/name of the node displayed in the header
   */
  title: string;

  /**
   * Optional status indicator (running, idle, error, success)
   * Displays a colored dot next to the title
   */
  status?: 'idle' | 'running' | 'success' | 'error';

  /**
   * Whether the node is currently selected
   * Controls border color and delete button visibility
   */
  selected: boolean;

  /**
   * Type of node for color theming
   * - input: Blue theme
   * - agent: Purple theme
   * - output: Green theme
   */
  nodeType: 'input' | 'agent' | 'output';

  /**
   * Node content to render below the header
   * This is where node-specific UI should be placed
   */
  children: React.ReactNode;

  /**
   * Optional callback when delete button is clicked
   * If not provided, delete button won't be shown
   */
  onDelete?: () => void;

  /**
   * Whether to show the delete button when selected
   * @default true
   */
  showDeleteButton?: boolean;

  /**
   * Whether to show the target handle (for incoming connections)
   * @default true
   */
  showTargetHandle?: boolean;

  /**
   * Whether to show the source handle (for outgoing connections)
   * @default true
   */
  showSourceHandle?: boolean;

  /**
   * Optional additional CSS classes for the container
   */
  className?: string;

  /**
   * Optional width override (default: 280px)
   */
  width?: number;

  /**
   * Optional minimum height (default: auto)
   */
  minHeight?: number;
}

/**
 * BaseNode Component
 *
 * Provides the foundation for all custom node types in the React Flow canvas.
 * Handles common functionality like connections, selection states, and visual styling.
 */
export const BaseNode: React.FC<BaseNodeProps> = ({
  icon,
  title,
  status,
  selected,
  nodeType,
  children,
  onDelete,
  showDeleteButton = true,
  showTargetHandle = true,
  showSourceHandle = true,
  className = '',
  width = 280,
  minHeight,
}) => {
  // Color theme mapping for different node types
  const nodeTypeColors = {
    input: {
      border: 'border-blue-500',
      bg: 'bg-blue-500/10',
      iconText: 'text-blue-500',
      handle: 'bg-blue-500',
    },
    agent: {
      border: 'border-purple-500',
      bg: 'bg-purple-500/10',
      iconText: 'text-purple-500',
      handle: 'bg-purple-500',
    },
    output: {
      border: 'border-green-500',
      bg: 'bg-green-500/10',
      iconText: 'text-green-500',
      handle: 'bg-green-500',
    },
  };

  // Status indicator colors
  const statusColors = {
    idle: 'bg-gray-400',
    running: 'bg-blue-500 animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  const colors = nodeTypeColors[nodeType];

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: `${width}px`,
        minHeight: minHeight ? `${minHeight}px` : undefined,
      }}
    >
      {/* Target Handle - Incoming Connections */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          className={`!w-3 !h-3 !border-2 !border-background ${colors.handle} transition-all hover:!w-4 hover:!h-4`}
          style={{ top: -6 }}
        />
      )}

      {/* Node Card */}
      <div
        className={`
          rounded-lg border-2 bg-card text-card-foreground shadow-sm
          transition-all duration-200
          ${selected ? colors.border : 'border-border'}
          ${selected ? 'shadow-md' : 'hover:shadow-md'}
        `}
      >
        {/* Node Header */}
        <div
          className={`
            flex items-center gap-2 p-3 rounded-t-md border-b border-border/50
            ${colors.bg}
          `}
        >
          {/* Icon */}
          <div className={`flex-shrink-0 ${colors.iconText}`}>
            {icon}
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" title={title}>
              {title}
            </h3>
          </div>

          {/* Status Indicator */}
          {status && (
            <div
              className={`w-2 h-2 rounded-full ${statusColors[status]}`}
              title={`Status: ${status}`}
            />
          )}

          {/* Delete Button (only when selected) */}
          {selected && showDeleteButton && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="
                flex-shrink-0 p-1 rounded hover:bg-destructive/20
                text-muted-foreground hover:text-destructive
                transition-colors
              "
              title="Delete node"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Node Content */}
        <div className="p-3">
          {children}
        </div>
      </div>

      {/* Source Handle - Outgoing Connections */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className={`!w-3 !h-3 !border-2 !border-background ${colors.handle} transition-all hover:!w-4 hover:!h-4`}
          style={{ bottom: -6 }}
        />
      )}
    </div>
  );
};

/**
 * BaseNodeHeader - Reusable header component for custom nodes
 *
 * This is a standalone header component that can be used independently
 * if you need more control over the node structure.
 */
export interface BaseNodeHeaderProps {
  icon: React.ReactNode;
  title: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  nodeType: 'input' | 'agent' | 'output';
  selected: boolean;
  onDelete?: () => void;
  showDeleteButton?: boolean;
}

export const BaseNodeHeader: React.FC<BaseNodeHeaderProps> = ({
  icon,
  title,
  status,
  nodeType,
  selected,
  onDelete,
  showDeleteButton = true,
}) => {
  const nodeTypeColors = {
    input: {
      bg: 'bg-blue-500/10',
      iconText: 'text-blue-500',
    },
    agent: {
      bg: 'bg-purple-500/10',
      iconText: 'text-purple-500',
    },
    output: {
      bg: 'bg-green-500/10',
      iconText: 'text-green-500',
    },
  };

  const statusColors = {
    idle: 'bg-gray-400',
    running: 'bg-blue-500 animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  const colors = nodeTypeColors[nodeType];

  return (
    <div
      className={`
        flex items-center gap-2 p-3 rounded-t-md border-b border-border/50
        ${colors.bg}
      `}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${colors.iconText}`}>
        {icon}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate" title={title}>
          {title}
        </h3>
      </div>

      {/* Status Indicator */}
      {status && (
        <div
          className={`w-2 h-2 rounded-full ${statusColors[status]}`}
          title={`Status: ${status}`}
        />
      )}

      {/* Delete Button (only when selected) */}
      {selected && showDeleteButton && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="
            flex-shrink-0 p-1 rounded hover:bg-destructive/20
            text-muted-foreground hover:text-destructive
            transition-colors
          "
          title="Delete node"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default BaseNode;
