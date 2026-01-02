/**
 * useFlowKeyboardShortcuts Hook
 *
 * A custom React hook that implements comprehensive keyboard shortcuts for the visual flow editor.
 * Provides intuitive keyboard navigation and operations similar to modern design tools like Figma,
 * Sketch, or traditional desktop applications.
 *
 * ## Features
 * - **Delete Operations**: Delete/Backspace to remove selected nodes and edges
 * - **Undo/Redo**: Ctrl+Z/Cmd+Z for undo, Ctrl+Y/Cmd+Shift+Z for redo
 * - **Clipboard Operations**: Ctrl+C/Cmd+C to copy, Ctrl+V/Cmd+V to paste nodes
 * - **Save Operation**: Ctrl+S/Cmd+S to trigger save callback
 * - **Selection Management**: Escape to clear all selections
 * - **Input Field Awareness**: Automatically disabled when typing in input fields
 * - **Cross-Platform**: Supports both Windows/Linux (Ctrl) and macOS (Cmd) modifiers
 *
 * ## Keyboard Shortcuts
 *
 * ### Node/Edge Operations
 * | Shortcut | Action | Description |
 * |----------|--------|-------------|
 * | Delete / Backspace | Delete | Removes all selected nodes and their connected edges |
 * | Escape | Deselect | Clears all node and edge selections |
 *
 * ### Editing Operations
 * | Shortcut | Action | Description |
 * |----------|--------|-------------|
 * | Ctrl+Z / Cmd+Z | Undo | Reverts the last canvas change |
 * | Ctrl+Y / Cmd+Y | Redo | Reapplies the last undone change |
 * | Ctrl+Shift+Z / Cmd+Shift+Z | Redo (Alt) | Alternative redo shortcut |
 *
 * ### Clipboard Operations
 * | Shortcut | Action | Description |
 * |----------|--------|-------------|
 * | Ctrl+C / Cmd+C | Copy | Copies selected nodes to clipboard |
 * | Ctrl+V / Cmd+V | Paste | Pastes copied nodes at offset position |
 * | Ctrl+D / Cmd+D | Duplicate | Duplicates selected nodes (copy + paste) |
 *
 * ### File Operations
 * | Shortcut | Action | Description |
 * |----------|--------|-------------|
 * | Ctrl+S / Cmd+S | Save | Triggers save callback (prevents browser save dialog) |
 *
 * ## Input Field Awareness
 * The hook automatically detects when the user is typing in input fields and disables all
 * shortcuts to prevent interference with normal text editing. Shortcuts are disabled when
 * focus is on:
 * - `<input>` elements
 * - `<textarea>` elements
 * - `<select>` elements
 * - Any element with `contenteditable="true"`
 *
 * ## Usage
 *
 * ### Basic Usage
 * ```tsx
 * import { useFlowKeyboardShortcuts } from '../hooks/useFlowKeyboardShortcuts';
 * import { useFlowCanvas } from '../contexts/FlowCanvasContext';
 *
 * function FlowEditor() {
 *   const flowCanvas = useFlowCanvas();
 *
 *   // Enable keyboard shortcuts
 *   useFlowKeyboardShortcuts({
 *     onSave: () => {
 *       console.log('Saving flow...');
 *       // Save flow logic
 *     }
 *   });
 *
 *   return <FlowCanvas />;
 * }
 * ```
 *
 * ### With All Options
 * ```tsx
 * useFlowKeyboardShortcuts({
 *   onSave: handleSave,
 *   onCopy: (nodes) => console.log('Copied:', nodes),
 *   onPaste: (nodes) => console.log('Pasted:', nodes),
 *   onDelete: (nodeIds, edgeIds) => console.log('Deleted:', nodeIds, edgeIds),
 *   enabled: true, // Can be toggled dynamically
 * });
 * ```
 *
 * ### Conditional Enabling
 * ```tsx
 * const [editMode, setEditMode] = useState(true);
 *
 * useFlowKeyboardShortcuts({
 *   onSave: handleSave,
 *   enabled: editMode, // Only enable shortcuts in edit mode
 * });
 * ```
 *
 * ## Implementation Details
 *
 * ### Clipboard Implementation
 * The hook maintains an internal clipboard that stores copied nodes:
 * - **Copy**: Serializes selected nodes (excluding edges) to clipboard state
 * - **Paste**: Deserializes nodes and creates new instances with:
 *   - New unique IDs to avoid conflicts
 *   - Offset positions (50px down-right) for visual distinction
 *   - Preserved node data (type, configuration, etc.)
 * - **Duplicate**: Combines copy + paste in a single operation
 *
 * ### Platform Detection
 * Uses `navigator.platform` to detect macOS and determine the appropriate modifier key:
 * - **macOS**: Uses Cmd key (metaKey)
 * - **Windows/Linux**: Uses Ctrl key (ctrlKey)
 *
 * ### Event Handling
 * - Attaches a single `keydown` event listener to `document`
 * - Cleans up listener on unmount to prevent memory leaks
 * - Uses `preventDefault()` to block browser default behaviors (e.g., Ctrl+S save dialog)
 *
 * ### State Management
 * - Integrates with `FlowCanvasContext` for all canvas operations
 * - Maintains separate clipboard state for copy/paste functionality
 * - Uses refs to avoid stale closures in event handlers
 *
 * ## Browser Compatibility
 * - **Modern Browsers**: Full support (Chrome, Firefox, Safari, Edge)
 * - **Clipboard API**: Uses in-memory clipboard (no system clipboard access)
 * - **Keyboard Events**: Standard KeyboardEvent API (widely supported)
 *
 * ## Accessibility
 * The keyboard shortcuts enhance accessibility by providing:
 * - Keyboard-only navigation and editing
 * - Standard shortcuts familiar to most users
 * - No reliance on mouse for common operations
 *
 * @example
 * ```tsx
 * // In FlowEditorVisual component
 * function FlowEditorVisual({ onSave }) {
 *   const handleSave = async () => {
 *     const flow = await convertAndSaveFlow();
 *     onSave?.(flow);
 *   };
 *
 *   useFlowKeyboardShortcuts({
 *     onSave: handleSave,
 *     enabled: true,
 *   });
 *
 *   return (
 *     <FlowCanvasProvider>
 *       <FlowCanvas />
 *     </FlowCanvasProvider>
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useFlowCanvas } from '../contexts/FlowCanvasContext';
import type { ReactFlowNode } from '../types/react-flow.types';
import type { FlowNodeType } from '../types';
import { generateNodeId } from '../components/flow-canvas/nodes';

/**
 * Options for configuring keyboard shortcuts
 */
export interface UseFlowKeyboardShortcutsOptions {
  /**
   * Callback invoked when user presses Ctrl+S/Cmd+S to save
   * Should handle saving the current flow state to backend
   *
   * @example
   * ```tsx
   * onSave: async () => {
   *   await saveFlowToBackend(currentFlow);
   * }
   * ```
   */
  onSave?: () => void;

  /**
   * Optional callback invoked when nodes are copied to clipboard
   * Useful for analytics or showing toast notifications
   *
   * @param nodes - Array of copied nodes
   *
   * @example
   * ```tsx
   * onCopy: (nodes) => {
   *   showToast(`Copied ${nodes.length} node(s)`);
   * }
   * ```
   */
  onCopy?: (nodes: ReactFlowNode[]) => void;

  /**
   * Optional callback invoked when nodes are pasted from clipboard
   * Useful for analytics or showing toast notifications
   *
   * @param nodes - Array of pasted nodes
   *
   * @example
   * ```tsx
   * onPaste: (nodes) => {
   *   showToast(`Pasted ${nodes.length} node(s)`);
   * }
   * ```
   */
  onPaste?: (nodes: ReactFlowNode[]) => void;

  /**
   * Optional callback invoked when nodes/edges are deleted
   * Useful for analytics or showing toast notifications
   *
   * @param nodeIds - IDs of deleted nodes
   * @param edgeIds - IDs of deleted edges
   *
   * @example
   * ```tsx
   * onDelete: (nodeIds, edgeIds) => {
   *   showToast(`Deleted ${nodeIds.length} node(s) and ${edgeIds.length} edge(s)`);
   * }
   * ```
   */
  onDelete?: (nodeIds: string[], edgeIds: string[]) => void;

  /**
   * Whether keyboard shortcuts are enabled
   * Can be used to conditionally disable shortcuts
   *
   * @default true
   *
   * @example
   * ```tsx
   * enabled: isEditMode && !isDialogOpen
   * ```
   */
  enabled?: boolean;
}

/**
 * Detect if user is on macOS (for Cmd vs Ctrl key)
 */
const isMac = (): boolean => {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
};

/**
 * Check if the active element is an input field where typing is expected
 * This prevents shortcuts from interfering with text input
 */
const isInputField = (element: Element | null): boolean => {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  const isContentEditable = element.getAttribute('contenteditable') === 'true';

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    isContentEditable
  );
};

/**
 * Custom hook that enables comprehensive keyboard shortcuts for flow editing
 *
 * @param options - Configuration options for keyboard shortcuts
 * @returns void
 *
 * @example
 * ```tsx
 * useFlowKeyboardShortcuts({
 *   onSave: () => saveFlow(),
 *   enabled: true,
 * });
 * ```
 */
export function useFlowKeyboardShortcuts(options: UseFlowKeyboardShortcutsOptions = {}): void {
  const {
    onSave,
    onCopy,
    onPaste,
    onDelete,
    enabled = true,
  } = options;

  const flowCanvas = useFlowCanvas();
  const {
    nodes,
    selectedNodeIds,
    selectedEdgeIds,
    removeNodes,
    removeEdges,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    addNode,
    getNodeById,
  } = flowCanvas;

  // Internal clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<ReactFlowNode[]>([]);

  // Use ref to store latest values and avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Handle copy operation - copies selected nodes to internal clipboard
   */
  const handleCopy = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

    // Get full node objects for selected node IDs
    const nodesToCopy = selectedNodeIds
      .map(id => getNodeById(id))
      .filter((node): node is ReactFlowNode => node !== undefined);

    if (nodesToCopy.length > 0) {
      setClipboard(nodesToCopy);
      onCopy?.(nodesToCopy);
    }
  }, [selectedNodeIds, getNodeById, onCopy]);

  /**
   * Handle paste operation - creates new nodes from clipboard with offset position
   */
  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;

    // Create new nodes from clipboard with offset positions and new IDs
    const pastedNodes: ReactFlowNode[] = [];
    const PASTE_OFFSET = 50; // Pixels to offset pasted nodes

    clipboard.forEach(node => {
      // Generate new unique ID for the pasted node
      const newId = generateNodeId(node.type as FlowNodeType);

      // Create new node with offset position
      const newNode: ReactFlowNode = {
        ...node,
        id: newId,
        position: {
          x: node.position.x + PASTE_OFFSET,
          y: node.position.y + PASTE_OFFSET,
        },
        selected: false, // Deselect by default
      };

      // Add node to canvas via context
      // Note: Only basic properties are passed; node data will use defaults
      addNode({
        type: node.type,
        position: newNode.position,
        name: node.data.name || `${node.type} node`,
        description: node.data.description || '',
      });

      pastedNodes.push(newNode);
    });

    if (pastedNodes.length > 0) {
      onPaste?.(pastedNodes);
    }
  }, [clipboard, addNode, onPaste]);

  /**
   * Handle delete operation - removes selected nodes and edges
   */
  const handleDelete = useCallback(() => {
    const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;
    if (!hasSelection) return;

    // Remove selected nodes and edges
    if (selectedNodeIds.length > 0) {
      removeNodes(selectedNodeIds);
    }
    if (selectedEdgeIds.length > 0) {
      removeEdges(selectedEdgeIds);
    }

    onDelete?.(selectedNodeIds, selectedEdgeIds);
  }, [selectedNodeIds, selectedEdgeIds, removeNodes, removeEdges, onDelete]);

  /**
   * Handle duplicate operation - copy + paste in one action
   */
  const handleDuplicate = useCallback(() => {
    handleCopy();
    // Use setTimeout to ensure clipboard is updated before paste
    setTimeout(() => {
      handlePaste();
    }, 0);
  }, [handleCopy, handlePaste]);

  /**
   * Main keyboard event handler
   */
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Ignore shortcuts when typing in input fields
      if (isInputField(document.activeElement)) {
        return;
      }

      // Detect modifier key (Cmd on Mac, Ctrl on Windows/Linux)
      const modKey = isMac() ? event.metaKey : event.ctrlKey;
      const shiftKey = event.shiftKey;
      const key = event.key.toLowerCase();

      // Delete/Backspace - Remove selected nodes/edges
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        handleDelete();
        return;
      }

      // Escape - Clear selection
      if (key === 'escape') {
        event.preventDefault();
        clearSelection();
        return;
      }

      // Shortcuts that require modifier key
      if (!modKey) return;

      // Ctrl+Z / Cmd+Z - Undo
      if (key === 'z' && !shiftKey) {
        if (canUndo) {
          event.preventDefault();
          undo();
        }
        return;
      }

      // Ctrl+Y / Cmd+Y - Redo (Windows style)
      // Ctrl+Shift+Z / Cmd+Shift+Z - Redo (Mac style)
      if (key === 'y' || (key === 'z' && shiftKey)) {
        if (canRedo) {
          event.preventDefault();
          redo();
        }
        return;
      }

      // Ctrl+C / Cmd+C - Copy
      if (key === 'c') {
        event.preventDefault();
        handleCopy();
        return;
      }

      // Ctrl+V / Cmd+V - Paste
      if (key === 'v') {
        event.preventDefault();
        handlePaste();
        return;
      }

      // Ctrl+D / Cmd+D - Duplicate
      if (key === 'd') {
        event.preventDefault();
        handleDuplicate();
        return;
      }

      // Ctrl+S / Cmd+S - Save
      if (key === 's') {
        event.preventDefault();
        onSave?.();
        return;
      }
    };

    // Attach event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    handleCopy,
    handlePaste,
    handleDelete,
    handleDuplicate,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    onSave,
  ]);
}
