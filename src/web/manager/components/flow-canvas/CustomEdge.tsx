/**
 * Custom Edge Component for React Flow
 *
 * A custom edge component that provides smooth bezier curves, animated data flow
 * visualization, interactive delete functionality, and optional labels for connections
 * between nodes in the flow canvas.
 *
 * ## Features
 * - **Smooth Bezier Curve**: Elegant curved connections between nodes
 * - **Animated Data Flow**: Pulsing dots along the edge path to visualize data transfer
 * - **Delete Button**: Interactive button that appears on hover for easy edge removal
 * - **Optional Label**: Displays data transfer information when provided
 * - **Color Coding**: Visual feedback based on connection status (idle, active, error)
 * - **Hover States**: Enhanced visual feedback when interacting with edges
 * - **Accessible**: Keyboard navigation and screen reader support
 *
 * ## Component Structure
 * ```
 * CustomEdge
 *   ├── Path (smooth bezier curve)
 *   ├── Animated Dots (data flow visualization)
 *   ├── Label (optional, via EdgeLabelRenderer)
 *   └── Delete Button (appears on hover)
 * ```
 *
 * ## Animation Behavior
 * The data flow animation consists of multiple pulsing dots that travel along
 * the edge path:
 * - **3 dots** spaced evenly along the path
 * - **2 second** animation duration for smooth, visible movement
 * - **Offset timing** for staggered wave effect
 * - **Pulse effect** with opacity and scale changes
 *
 * ## Color Coding
 * - **Default (idle)**: Primary theme color (hsl(var(--primary)))
 * - **Active (data transferring)**: Bright cyan (#06b6d4)
 * - **Error**: Red for failed connections (#ef4444)
 * - **Selected**: Enhanced brightness and wider stroke
 *
 * ## Usage with React Flow
 * Register this component in the edgeTypes object:
 *
 * @example
 * ```tsx
 * import CustomEdge from '@/components/flow-canvas/CustomEdge';
 *
 * const edgeTypes = {
 *   custom: CustomEdge,
 * };
 *
 * function FlowCanvas() {
 *   return (
 *     <ReactFlow
 *       edgeTypes={edgeTypes}
 *       edges={[
 *         {
 *           id: 'e1-2',
 *           source: '1',
 *           target: '2',
 *           type: 'custom',
 *           data: { label: 'User data', status: 'active' }
 *         }
 *       ]}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * // With custom styling
 * ```tsx
 * {
 *   id: 'e1-2',
 *   source: '1',
 *   target: '2',
 *   type: 'custom',
 *   data: {
 *     label: 'Processing...',
 *     status: 'active',
 *     isDataTransfer: true
 *   },
 *   style: {
 *     strokeWidth: 3
 *   }
 * }
 * ```
 *
 * @example
 * // Error state
 * ```tsx
 * {
 *   id: 'e1-2',
 *   source: '1',
 *   target: '2',
 *   type: 'custom',
 *   data: {
 *     label: 'Connection failed',
 *     status: 'error'
 *   }
 * }
 * ```
 */

import React, { useState, useCallback } from 'react';
import {
  EdgeProps,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
} from '@xyflow/react';
import { XIcon } from '../ui/Icons';
import type { ReactFlowEdge } from '../../types/react-flow.types';

/**
 * Status types for edge connections
 */
export type EdgeStatus = 'idle' | 'active' | 'error';

/**
 * Extended edge data with status information
 */
export interface CustomEdgeData {
  /** Optional label to display on the edge */
  label?: string;
  /** Connection status affecting visual appearance */
  status?: EdgeStatus;
  /** Whether this edge represents a data transfer */
  isDataTransfer?: boolean;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Props for the CustomEdge component
 * Extends React Flow's EdgeProps with our custom data type
 */
export type CustomEdgeProps = EdgeProps<ReactFlowEdge>;

/**
 * CustomEdge Component
 *
 * Renders a custom edge with smooth bezier curve, animated data flow visualization,
 * and interactive delete button. Provides visual feedback for connection status
 * and data transfer activity.
 *
 * @param props - Edge properties from React Flow including source/target positions
 * @returns A custom edge element with animation and interactivity
 */
export const CustomEdge: React.FC<CustomEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  selected,
}) => {
  // State for hover interaction
  const [isHovered, setIsHovered] = useState(false);

  // Get React Flow instance for edge manipulation
  const { setEdges } = useReactFlow();

  // Extract custom data with defaults
  const edgeData = data as CustomEdgeData | undefined;
  const label = edgeData?.label;
  const status = edgeData?.status || 'idle';
  const isDataTransfer = edgeData?.isDataTransfer ?? true;

  /**
   * Calculate the bezier path between source and target
   * Returns path string and label position coordinates
   */
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  /**
   * Get stroke color based on status
   */
  const getStrokeColor = useCallback((): string => {
    switch (status) {
      case 'active':
        return '#06b6d4'; // cyan-500
      case 'error':
        return '#ef4444'; // red-500
      case 'idle':
      default:
        return 'hsl(var(--primary))';
    }
  }, [status]);

  /**
   * Get stroke width based on selection and hover state
   */
  const getStrokeWidth = useCallback((): number => {
    const baseWidth = (style.strokeWidth as number) || 2;
    if (selected) return baseWidth + 1;
    if (isHovered) return baseWidth + 0.5;
    return baseWidth;
  }, [selected, isHovered, style.strokeWidth]);

  /**
   * Handle edge deletion
   * Removes this edge from the flow
   */
  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setEdges((edges) => edges.filter((edge) => edge.id !== id));
    },
    [id, setEdges]
  );

  /**
   * Handle mouse enter
   * Shows delete button and enhances visual feedback
   */
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  /**
   * Handle mouse leave
   * Hides delete button and returns to normal state
   */
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Compute final stroke color and width
  const strokeColor = style.stroke || getStrokeColor();
  const strokeWidth = getStrokeWidth();

  return (
    <>
      {/* Main edge path with smooth bezier curve */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          opacity: selected || isHovered ? 1 : 0.8,
          transition: 'all 0.2s ease-in-out',
        }}
      />

      {/* Invisible wider path for easier hover interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
      />

      {/* Animated data flow visualization */}
      {isDataTransfer && status === 'active' && (
        <g>
          {/* Three animated dots for data flow effect */}
          {[0, 1, 2].map((index) => (
            <circle
              key={`dot-${index}`}
              r="4"
              fill={strokeColor}
              opacity="0.8"
              style={{
                filter: 'drop-shadow(0 0 4px currentColor)',
              }}
            >
              {/* Animate along path */}
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                path={edgePath}
                begin={`${index * 0.66}s`}
              />
              {/* Pulse opacity */}
              <animate
                attributeName="opacity"
                values="0;0.8;0"
                dur="2s"
                repeatCount="indefinite"
                begin={`${index * 0.66}s`}
              />
              {/* Pulse scale */}
              <animate
                attributeName="r"
                values="2;5;2"
                dur="2s"
                repeatCount="indefinite"
                begin={`${index * 0.66}s`}
              />
            </circle>
          ))}
        </g>
      )}

      {/* Label and delete button rendered in HTML layer */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="flex flex-col items-center gap-1"
        >
          {/* Optional label */}
          {label && (
            <div
              className={`
                px-2 py-1 rounded text-xs font-medium
                bg-background border border-border shadow-sm
                transition-all duration-200
                ${selected || isHovered ? 'opacity-100 scale-100' : 'opacity-80 scale-95'}
              `}
              style={{
                color: strokeColor,
                borderColor: strokeColor,
              }}
            >
              {label}
            </div>
          )}

          {/* Delete button (visible on hover or selection) */}
          {(isHovered || selected) && (
            <button
              onClick={handleDelete}
              className={`
                p-1 rounded-full bg-background border border-border
                shadow-md hover:shadow-lg
                transition-all duration-200
                hover:scale-110 hover:bg-destructive hover:border-destructive
                focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2
                group
              `}
              aria-label="Delete connection"
              title="Delete this connection"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <XIcon
                className="w-3 h-3 text-muted-foreground group-hover:text-destructive-foreground transition-colors"
              />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

/**
 * Display name for React DevTools
 */
CustomEdge.displayName = 'CustomEdge';

export default CustomEdge;
