/**
 * Node Palette Component for React Flow
 *
 * A draggable node palette/sidebar that allows users to drag new nodes onto the
 * React Flow canvas. Displays available node types (Input, Agent, Output) with
 * icons, names, and descriptions, organized in collapsible categories.
 *
 * ## Features
 * - Displays three node types: Input, Agent, Output
 * - Each node type shows icon, name, and description
 * - HTML5 drag and drop support for adding nodes to canvas
 * - Visual feedback during drag operation
 * - Collapsible sections for each node category
 * - Compact, fixed-width sidebar design (280px)
 * - Theme-aware styling matching application design system
 * - Smooth hover states and transitions
 *
 * ## Node Types
 * The palette provides three types of nodes:
 *
 * ### Input Node
 * - **Icon**: Input/Download icon (blue theme)
 * - **Purpose**: Collect and validate user input data
 * - **Use cases**: Forms, file uploads, API requests, user prompts
 * - **Color**: Blue (`text-blue-500`, `bg-blue-500/10`)
 *
 * ### Agent Node
 * - **Icon**: CPU Chip icon (purple theme)
 * - **Purpose**: Execute AI agent with configured skills and prompt
 * - **Use cases**: Data processing, content generation, decision making
 * - **Color**: Purple (`text-purple-500`, `bg-purple-500/10`)
 *
 * ### Output Node
 * - **Icon**: Server/Output icon (green theme)
 * - **Purpose**: Format and deliver the flow result
 * - **Use cases**: API responses, file generation, webhooks, emails
 * - **Color**: Green (`text-green-500`, `bg-green-500/10`)
 *
 * ## Drag and Drop Behavior
 * The component uses HTML5 drag and drop API:
 *
 * 1. **onDragStart**: Sets node type data in dataTransfer
 * 2. **onDragEnd**: Clears visual drag state
 * 3. **Visual feedback**: Reduced opacity during drag, cursor changes
 * 4. **Drop handling**: Parent component (FlowCanvas) handles drop events
 *
 * The dragged data includes:
 * - `application/reactflow`: Node type identifier for React Flow
 * - Format: JSON string with `{ nodeType: 'input' | 'agent' | 'output' }`
 *
 * ## Component Structure
 * ```
 * NodePalette (sidebar)
 *   ├── Header
 *   │     ├── Title "Node Palette"
 *   │     └── Subtitle "Drag to add"
 *   └── Categories
 *         ├── Input Nodes Section
 *         │     └── DraggableNodeItem (Input)
 *         ├── Processing Section
 *         │     └── DraggableNodeItem (Agent)
 *         └── Output Nodes Section
 *               └── DraggableNodeItem (Output)
 * ```
 *
 * ## Styling Behavior
 * - **Container**: Fixed width (280px), full height, scrollable
 * - **Background**: Theme background with border-r separator
 * - **Header**: Sticky at top with padding and border
 * - **Node items**: Card-based with hover states and color-coded themes
 * - **Drag state**: 50% opacity when being dragged
 * - **Hover state**: Enhanced shadow and subtle scale
 *
 * ## Accessibility
 * - Semantic HTML structure
 * - ARIA labels for drag items
 * - Keyboard navigation support (arrow keys)
 * - Focus states on interactive elements
 * - Screen reader friendly with descriptive text
 *
 * @example
 * // Basic usage in FlowCanvas
 * <div className="flex h-screen">
 *   <NodePalette />
 *   <ReactFlowProvider>
 *     <ReactFlow />
 *   </ReactFlowProvider>
 * </div>
 *
 * @example
 * // With custom styling
 * <NodePalette className="border-l-4 border-primary" />
 *
 * @example
 * // Integrating drop handling in parent component
 * const onDrop = (event: React.DragEvent) => {
 *   const type = event.dataTransfer.getData('application/reactflow');
 *   const nodeData = JSON.parse(type);
 *   // Create node at drop position
 *   createNode(nodeData.nodeType, position);
 * };
 */

import React, { useState } from 'react';
import { CpuChipIcon, ChevronDownIcon, ChevronRightIcon } from '../ui/Icons';

/**
 * Props for the NodePalette component
 */
export interface NodePaletteProps {
  /**
   * Optional additional CSS classes for the container
   */
  className?: string;
}

/**
 * Configuration for a draggable node type
 */
interface NodeTypeConfig {
  /** Unique identifier for the node type */
  type: 'input' | 'agent' | 'output';
  /** Display name shown in the palette */
  name: string;
  /** Brief description of the node's purpose */
  description: string;
  /** Icon component to display */
  icon: React.ReactNode;
  /** Color theme for the node type */
  colorClasses: {
    text: string;
    bg: string;
    border: string;
    hover: string;
  };
}

/**
 * Configuration for all available node types
 */
const NODE_TYPES: NodeTypeConfig[] = [
  {
    type: 'input',
    name: 'Input',
    description: 'Collect and validate user input data',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    colorClasses: {
      text: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      hover: 'hover:border-blue-500/50',
    },
  },
  {
    type: 'agent',
    name: 'Agent',
    description: 'Execute AI agent with skills and prompt',
    icon: <CpuChipIcon width={24} height={24} />,
    colorClasses: {
      text: 'text-purple-500',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      hover: 'hover:border-purple-500/50',
    },
  },
  {
    type: 'output',
    name: 'Output',
    description: 'Format and deliver the flow result',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
        <line x1="6" x2="6.01" y1="6" y2="6" />
        <line x1="6" x2="6.01" y1="18" y2="18" />
      </svg>
    ),
    colorClasses: {
      text: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      hover: 'hover:border-green-500/50',
    },
  },
];

/**
 * Props for the DraggableNodeItem component
 */
interface DraggableNodeItemProps {
  nodeType: NodeTypeConfig;
}

/**
 * DraggableNodeItem Component
 *
 * Renders a single draggable node item in the palette.
 * Handles drag and drop interactions for adding nodes to the canvas.
 */
const DraggableNodeItem: React.FC<DraggableNodeItemProps> = ({ nodeType }) => {
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Handle drag start event
   * Sets the node type data in the dataTransfer for the drop handler
   */
  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);

    // Set the node type data for React Flow
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ nodeType: nodeType.type })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  /**
   * Handle drag end event
   * Clears the dragging state
   */
  const onDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        cursor-grab active:cursor-grabbing
        rounded-lg border-2 p-3
        transition-all duration-200
        ${nodeType.colorClasses.border}
        ${nodeType.colorClasses.hover}
        ${nodeType.colorClasses.bg}
        hover:shadow-md
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}
      `}
      role="button"
      tabIndex={0}
      aria-label={`Drag to add ${nodeType.name} node`}
      title={`Drag to add ${nodeType.name} node to canvas`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${nodeType.colorClasses.text}`}>
          {nodeType.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1">{nodeType.name}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {nodeType.description}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Props for the CollapsibleSection component
 */
interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * CollapsibleSection Component
 *
 * A collapsible section wrapper for grouping related node types.
 * Provides expand/collapse functionality with smooth transitions.
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultExpanded = true,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-2">
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          flex items-center gap-2 w-full px-2 py-1.5
          text-xs font-semibold uppercase tracking-wide
          text-muted-foreground hover:text-foreground
          transition-colors
        "
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title} section`}
      >
        {/* Expand/Collapse Icon */}
        {isExpanded ? (
          <ChevronDownIcon width={14} height={14} />
        ) : (
          <ChevronRightIcon width={14} height={14} />
        )}
        {title}
      </button>

      {/* Section Content */}
      {isExpanded && <div className="space-y-2">{children}</div>}
    </div>
  );
};

/**
 * NodePalette Component
 *
 * Main component that renders the draggable node palette sidebar.
 * Displays all available node types organized by category.
 */
export const NodePalette: React.FC<NodePaletteProps> = ({ className = '' }) => {
  // Organize nodes by category
  const inputNodes = NODE_TYPES.filter((n) => n.type === 'input');
  const agentNodes = NODE_TYPES.filter((n) => n.type === 'agent');
  const outputNodes = NODE_TYPES.filter((n) => n.type === 'output');

  return (
    <div
      className={`
        w-[280px] h-full
        bg-background border-r border-border
        flex flex-col
        ${className}
      `}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <h2 className="font-semibold text-lg">Node Palette</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drag nodes onto the canvas
        </p>
      </div>

      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Input Nodes Section */}
        <CollapsibleSection title="Input Nodes" defaultExpanded={true}>
          {inputNodes.map((nodeType) => (
            <DraggableNodeItem key={nodeType.type} nodeType={nodeType} />
          ))}
        </CollapsibleSection>

        {/* Processing Nodes Section */}
        <CollapsibleSection title="Processing" defaultExpanded={true}>
          {agentNodes.map((nodeType) => (
            <DraggableNodeItem key={nodeType.type} nodeType={nodeType} />
          ))}
        </CollapsibleSection>

        {/* Output Nodes Section */}
        <CollapsibleSection title="Output Nodes" defaultExpanded={true}>
          {outputNodes.map((nodeType) => (
            <DraggableNodeItem key={nodeType.type} nodeType={nodeType} />
          ))}
        </CollapsibleSection>
      </div>

      {/* Footer with tips */}
      <div className="border-t border-border px-4 py-3 bg-secondary/30">
        <div className="flex items-start gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 text-muted-foreground mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Drag a node from the palette onto the canvas to add it to your flow.
            Connect nodes to define the workflow.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Display name for React DevTools
 */
NodePalette.displayName = 'NodePalette';

export default NodePalette;
