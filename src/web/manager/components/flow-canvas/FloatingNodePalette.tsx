/**
 * Floating Node Palette Component for React Flow
 *
 * A compact, floating toolbar that provides access to draggable nodes for the
 * React Flow canvas. Appears as an overlay positioned absolutely on the canvas,
 * with expandable/collapsible behavior to minimize screen real estate usage.
 *
 * ## Features
 * - Compact floating toolbar design (doesn't reduce canvas area)
 * - Expandable/collapsible state with smooth animations
 * - Displays three node types: Input, Agent, Output
 * - HTML5 drag and drop support for adding nodes to canvas
 * - Positioned absolutely (top-left of canvas by default)
 * - Visual feedback during drag operation
 * - Theme-aware styling matching application design system
 * - Click-outside-to-close behavior when expanded
 *
 * ## Node Types
 * The palette provides three types of nodes:
 *
 * ### Input Node
 * - **Icon**: Input/Edit icon (blue theme)
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
 * FloatingNodePalette (absolute positioned)
 *   ├── Toggle Button (always visible)
 *   │     └── Plus icon or Nodes icon
 *   └── Dropdown Panel (conditionally rendered)
 *         ├── Header ("Add Node")
 *         └── Node List
 *               ├── DraggableNodeItem (Input)
 *               ├── DraggableNodeItem (Agent)
 *               └── DraggableNodeItem (Output)
 * ```
 *
 * ## Styling Behavior
 * - **Position**: Absolute, top-left of container (default)
 * - **Collapsed state**: Small circular button with icon
 * - **Expanded state**: Dropdown panel (280px width) showing all nodes
 * - **Animation**: Smooth slide-down/fade-in transition
 * - **Z-index**: High enough to appear above canvas elements
 * - **Drag state**: 50% opacity when node is being dragged
 * - **Hover state**: Enhanced shadow and subtle scale
 *
 * ## Accessibility
 * - Semantic HTML structure
 * - ARIA labels for toggle button and drag items
 * - Keyboard navigation support (Escape to close, Tab navigation)
 * - Focus states on interactive elements
 * - Screen reader friendly with descriptive text
 *
 * @example
 * // Basic usage in FlowCanvas
 * <div className="relative h-screen">
 *   <FloatingNodePalette />
 *   <ReactFlowProvider>
 *     <ReactFlow />
 *   </ReactFlowProvider>
 * </div>
 *
 * @example
 * // With custom position
 * <FloatingNodePalette position="top-right" />
 *
 * @example
 * // Initially expanded
 * <FloatingNodePalette defaultExpanded={true} />
 */

import React, { useState, useEffect, useRef } from 'react';
import { CpuChipIcon } from '../ui/Icons';

/**
 * Props for the FloatingNodePalette component
 */
export interface FloatingNodePaletteProps {
  /**
   * Optional additional CSS classes for the container
   */
  className?: string;
  /**
   * Position of the floating palette
   * @default "top-left"
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /**
   * Whether the palette is initially expanded
   * @default false
   */
  defaultExpanded?: boolean;
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
        width="20"
        height="20"
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
    icon: <CpuChipIcon width={20} height={20} />,
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
        width="20"
        height="20"
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
 * Position class mapping for the floating palette
 */
const POSITION_CLASSES = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

/**
 * FloatingNodePalette Component
 *
 * Renders a compact, floating toolbar that expands to show draggable node types.
 * Positioned absolutely within its container (typically the canvas area).
 */
export const FloatingNodePalette: React.FC<FloatingNodePaletteProps> = ({
  className = '',
  position = 'top-left',
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  /**
   * Handle drag start event
   * Sets the node type in the dataTransfer object for drop handling
   */
  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: 'input' | 'agent' | 'output'
  ) => {
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ nodeType })
    );
    event.dataTransfer.effectAllowed = 'move';
    setDraggedNode(nodeType);
  };

  /**
   * Handle drag end event
   * Clears the dragged node state
   */
  const handleDragEnd = () => {
    setDraggedNode(null);
  };

  /**
   * Handle click outside to close the palette
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        paletteRef.current &&
        !paletteRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  /**
   * Handle Escape key to close the palette
   */
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExpanded]);

  const positionClass = POSITION_CLASSES[position];

  return (
    <div
      ref={paletteRef}
      className={`absolute z-50 ${positionClass} ${className}`}
      role="toolbar"
      aria-label="Node palette"
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label={isExpanded ? 'Close node palette' : 'Open node palette'}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-600 dark:text-gray-400"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-600 dark:text-gray-400"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>

      {/* Dropdown Panel */}
      {isExpanded && (
        <div
          className="absolute top-14 left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          role="menu"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Add Node
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Drag to canvas
            </p>
          </div>

          {/* Node List */}
          <div className="p-2 space-y-1.5">
            {NODE_TYPES.map((nodeType) => (
              <div
                key={nodeType.type}
                draggable
                onDragStart={(e) => handleDragStart(e, nodeType.type)}
                onDragEnd={handleDragEnd}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border-2
                  ${nodeType.colorClasses.bg}
                  ${nodeType.colorClasses.border}
                  ${nodeType.colorClasses.hover}
                  transition-all duration-200 cursor-move
                  hover:shadow-md hover:scale-[1.02]
                  ${draggedNode === nodeType.type ? 'opacity-50' : 'opacity-100'}
                `}
                role="menuitem"
                aria-label={`Add ${nodeType.name} node`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Note: Keyboard-based node addition would require additional implementation
                    // For now, this provides keyboard focus support
                  }
                }}
              >
                {/* Icon */}
                <div
                  className={`flex-shrink-0 ${nodeType.colorClasses.text} mt-0.5`}
                >
                  {nodeType.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-sm font-medium ${nodeType.colorClasses.text}`}
                  >
                    {nodeType.name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {nodeType.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingNodePalette;
