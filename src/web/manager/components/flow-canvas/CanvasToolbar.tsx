/**
 * Canvas Toolbar Component for React Flow
 *
 * A toolbar component for the flow canvas that provides common actions and controls
 * for manipulating the canvas and nodes. Includes undo/redo, zoom controls, fit view,
 * auto-layout, and visibility toggles for grid and minimap.
 *
 * ## Features
 * - **Undo/Redo**: Navigate through canvas history with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * - **Zoom Controls**: Zoom in, out, and reset to default (100%)
 * - **Fit View**: Automatically fit all nodes into the visible canvas area
 * - **Auto Layout**: Organize nodes with automatic hierarchical layout using dagre
 * - **Grid Toggle**: Show/hide background grid for alignment
 * - **Minimap Toggle**: Show/hide minimap navigation panel
 *
 * ## Toolbar Layout
 * The toolbar is organized into logical groups separated by visual dividers:
 * ```
 * [Undo] [Redo] | [Zoom-] [Zoom+] [Zoom Reset] | [Fit View] [Auto Layout] | [Grid] [Minimap]
 * ```
 *
 * ## Keyboard Shortcuts
 * - **Ctrl+Z / Cmd+Z**: Undo last action
 * - **Ctrl+Y / Cmd+Shift+Z**: Redo last undone action
 * - **Ctrl+Shift+L / Cmd+Shift+L**: Auto-layout nodes
 * - Note: Most keyboard shortcuts are handled by the useFlowKeyboardShortcuts hook
 *
 * ## Integration with React Flow
 * The toolbar uses React Flow hooks to interact with the canvas:
 * - `useReactFlow`: Access to zoomIn, zoomOut, zoomTo, fitView methods
 * - `useFlowCanvas`: Access to undo/redo functionality from FlowCanvasContext
 *
 * ## Props
 * - `showGrid`: Current grid visibility state
 * - `onToggleGrid`: Callback to toggle grid visibility
 * - `showMinimap`: Current minimap visibility state
 * - `onToggleMinimap`: Callback to toggle minimap visibility
 * - `className`: Optional CSS class name for custom styling
 * - `position`: Toolbar position ('top' | 'bottom', default: 'top')
 *
 * ## Styling
 * - Compact horizontal layout with icon buttons
 * - Theme-aware with dark mode support
 * - Hover states for better UX
 * - Disabled states for unavailable actions (e.g., undo when history is empty)
 * - Tooltip-like title attributes for accessibility
 *
 * ## Example Usage
 * ```tsx
 * import CanvasToolbar from './CanvasToolbar';
 *
 * function FlowEditor() {
 *   const [showGrid, setShowGrid] = useState(true);
 *   const [showMinimap, setShowMinimap] = useState(true);
 *
 *   return (
 *     <div className="relative h-screen">
 *       <CanvasToolbar
 *         showGrid={showGrid}
 *         onToggleGrid={() => setShowGrid(!showGrid)}
 *         showMinimap={showMinimap}
 *         onToggleMinimap={() => setShowMinimap(!showMinimap)}
 *         position="top"
 *       />
 *       <FlowCanvas
 *         showGrid={showGrid}
 *         showMinimap={showMinimap}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

import React, { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFlowCanvas } from '../../contexts/FlowCanvasContext';

/**
 * Props for the CanvasToolbar component
 */
export interface CanvasToolbarProps {
  /**
   * Whether the grid background is currently visible
   */
  showGrid?: boolean;
  /**
   * Callback fired when grid visibility should be toggled
   */
  onToggleGrid?: () => void;
  /**
   * Whether the minimap is currently visible
   */
  showMinimap?: boolean;
  /**
   * Callback fired when minimap visibility should be toggled
   */
  onToggleMinimap?: () => void;
  /**
   * Callback fired when preview mode is requested
   */
  onPreview?: () => void;
  /**
   * Optional CSS class name for the toolbar container
   */
  className?: string;
  /**
   * Toolbar position on the canvas (default: 'top')
   */
  position?: 'top' | 'bottom';
}

/**
 * Undo Icon Component
 * Custom icon for undo action (rotate-left arrow)
 */
const UndoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

/**
 * Redo Icon Component
 * Custom icon for redo action (rotate-right arrow)
 */
const RedoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
  </svg>
);

/**
 * Zoom In Icon Component
 * Custom icon for zoom in action (magnifying glass with plus)
 */
const ZoomInIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
);

/**
 * Zoom Out Icon Component
 * Custom icon for zoom out action (magnifying glass with minus)
 */
const ZoomOutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
    <path d="M8 11h6" />
  </svg>
);

/**
 * Zoom Reset Icon Component
 * Custom icon for zoom reset action (magnifying glass with 1:1)
 */
const ZoomResetIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
    <path d="M9 8v6" />
    <path d="M13 8v6" />
  </svg>
);

/**
 * Fit View Icon Component
 * Custom icon for fit view action (expand arrows)
 */
const FitViewIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 3h6v6" />
    <path d="M9 21H3v-6" />
    <path d="M21 3l-7 7" />
    <path d="M3 21l7-7" />
  </svg>
);

/**
 * Auto Layout Icon Component
 * Custom icon for auto layout action (organizational diagram)
 */
const AutoLayoutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="6" height="6" x="9" y="3" rx="1" />
    <rect width="6" height="6" x="3" y="15" rx="1" />
    <rect width="6" height="6" x="15" y="15" rx="1" />
    <path d="M12 9v3" />
    <path d="M12 12h0" />
    <path d="M12 12 6 15" />
    <path d="M12 12l6 3" />
  </svg>
);

/**
 * Grid Icon Component
 * Custom icon for grid visibility toggle
 */
const GridIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
);

/**
 * Minimap Icon Component
 * Custom icon for minimap visibility toggle
 */
const MinimapIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <rect width="8" height="8" x="12" y="12" rx="1" fill="currentColor" opacity="0.3" />
    <path d="M7 7h4" />
    <path d="M7 11h2" />
  </svg>
);

/**
 * Preview Icon Component
 * Custom icon for flow preview mode (eye icon)
 */
const PreviewIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Toolbar Button Component
 * Reusable button component for toolbar actions
 */
interface ToolbarButtonProps {
  /**
   * Button click handler
   */
  onClick: () => void;
  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
  /**
   * Whether the button is in active/pressed state
   */
  active?: boolean;
  /**
   * Button title for accessibility (tooltip)
   */
  title: string;
  /**
   * Icon element to display
   */
  icon: React.ReactNode;
  /**
   * Optional keyboard shortcut to display in title
   */
  shortcut?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  disabled = false,
  active = false,
  title,
  icon,
  shortcut,
}) => {
  const fullTitle = shortcut ? `${title} (${shortcut})` : title;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={fullTitle}
      className={`
        p-2 rounded-md transition-all duration-200
        ${
          active
            ? 'bg-primary/20 text-primary hover:bg-primary/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-primary/50
      `}
      aria-label={fullTitle}
    >
      {icon}
    </button>
  );
};

/**
 * Toolbar Divider Component
 * Visual separator between toolbar button groups
 */
const ToolbarDivider: React.FC = () => (
  <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />
);

/**
 * Canvas Toolbar Component
 *
 * Main toolbar component that provides canvas controls and actions.
 * Must be used inside a ReactFlowProvider to access React Flow hooks.
 */
export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  showGrid = true,
  onToggleGrid,
  showMinimap = true,
  onToggleMinimap,
  onPreview,
  className = '',
  position = 'top',
}) => {
  // Get React Flow instance methods
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();

  // Get FlowCanvasContext methods for undo/redo and auto-layout
  const { undo, redo, canUndo, canRedo, applyAutoLayout } = useFlowCanvas();

  /**
   * Handle zoom in action
   * Increases zoom by default increment (typically ~20%)
   */
  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);

  /**
   * Handle zoom out action
   * Decreases zoom by default increment (typically ~20%)
   */
  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);

  /**
   * Handle zoom reset action
   * Resets zoom to 100% (1x)
   */
  const handleZoomReset = useCallback(() => {
    zoomTo(1, { duration: 300 });
  }, [zoomTo]);

  /**
   * Handle fit view action
   * Automatically zooms and pans to fit all nodes in view
   */
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  /**
   * Handle auto layout action
   * Applies dagre-based hierarchical layout to organize nodes
   */
  const handleAutoLayout = useCallback(() => {
    applyAutoLayout();
  }, [applyAutoLayout]);

  /**
   * Handle grid toggle
   * Calls parent callback to toggle grid visibility
   */
  const handleToggleGrid = useCallback(() => {
    onToggleGrid?.();
  }, [onToggleGrid]);

  /**
   * Handle minimap toggle
   * Calls parent callback to toggle minimap visibility
   */
  const handleToggleMinimap = useCallback(() => {
    onToggleMinimap?.();
  }, [onToggleMinimap]);

  /**
   * Handle preview mode
   * Calls parent callback to open preview modal
   */
  const handlePreview = useCallback(() => {
    onPreview?.();
  }, [onPreview]);

  /**
   * Determine toolbar position classes
   */
  const positionClasses =
    position === 'top'
      ? 'top-4 left-1/2 -translate-x-1/2'
      : 'bottom-4 left-1/2 -translate-x-1/2';

  return (
    <div
      className={`
        absolute z-10 flex items-center gap-1
        px-3 py-2 rounded-lg
        bg-background/95 backdrop-blur-sm
        border border-border shadow-lg
        ${positionClasses}
        ${className}
      `}
      role="toolbar"
      aria-label="Canvas Controls"
    >
      {/* History Controls Group */}
      <ToolbarButton
        onClick={undo}
        disabled={!canUndo}
        title="Undo"
        shortcut="Ctrl+Z"
        icon={<UndoIcon width={18} height={18} />}
      />
      <ToolbarButton
        onClick={redo}
        disabled={!canRedo}
        title="Redo"
        shortcut="Ctrl+Y"
        icon={<RedoIcon width={18} height={18} />}
      />

      <ToolbarDivider />

      {/* Zoom Controls Group */}
      <ToolbarButton
        onClick={handleZoomOut}
        title="Zoom Out"
        icon={<ZoomOutIcon width={18} height={18} />}
      />
      <ToolbarButton
        onClick={handleZoomReset}
        title="Reset Zoom"
        icon={<ZoomResetIcon width={18} height={18} />}
      />
      <ToolbarButton
        onClick={handleZoomIn}
        title="Zoom In"
        icon={<ZoomInIcon width={18} height={18} />}
      />

      <ToolbarDivider />

      {/* View Controls Group */}
      <ToolbarButton
        onClick={handleFitView}
        title="Fit View"
        icon={<FitViewIcon width={18} height={18} />}
      />
      <ToolbarButton
        onClick={handleAutoLayout}
        title="Auto Layout"
        shortcut="Ctrl+Shift+L"
        icon={<AutoLayoutIcon width={18} height={18} />}
      />

      <ToolbarDivider />

      {/* Visibility Toggles Group */}
      <ToolbarButton
        onClick={handleToggleGrid}
        active={showGrid}
        title="Toggle Grid"
        icon={<GridIcon width={18} height={18} />}
      />
      <ToolbarButton
        onClick={handleToggleMinimap}
        active={showMinimap}
        title="Toggle Minimap"
        icon={<MinimapIcon width={18} height={18} />}
      />

      {onPreview && (
        <>
          <ToolbarDivider />

          {/* Preview Mode */}
          <ToolbarButton
            onClick={handlePreview}
            title="Preview Flow"
            icon={<PreviewIcon width={18} height={18} />}
          />
        </>
      )}
    </div>
  );
};

/**
 * Display name for React DevTools
 */
CanvasToolbar.displayName = 'CanvasToolbar';

export default CanvasToolbar;
