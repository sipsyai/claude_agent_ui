/**
 * FlowEditorVisual Component
 *
 * A visual flow editor that replaces the linear FlowEditorPage with a React Flow-based
 * drag-and-drop canvas. Provides an intuitive node-based interface for creating and
 * editing workflows similar to n8n and Langchain.
 *
 * ## Features
 * - **Visual Canvas**: React Flow-based drag-and-drop interface
 * - **Floating Node Palette**: Compact overlay with draggable node types
 * - **Configuration Panel**: Slide-out panel for editing selected nodes
 * - **Canvas Toolbar**: Undo/redo, zoom controls, and layout options
 * - **Metadata Form**: Flow name, description, category, and settings
 * - **Auto-Save**: Changes save automatically with debouncing
 * - **Backward Compatible**: Converts between Flow and React Flow formats
 *
 * ## Component Architecture
 * ```
 * FlowEditorVisual
 *   ├── Header (Minimal top bar: Back + Save/Cancel)
 *   ├── FlowCanvasProvider (State management for nodes/edges)
 *   │   └── Main Layout (flex container)
 *   │       ├── ConfigSidebar (left sidebar - metadata & triggers)
 *   │       ├── FlowCanvas (center area)
 *   │       │   ├── FloatingNodePalette (overlay - top-left)
 *   │       │   └── CanvasToolbar (floating toolbar)
 *   │       └── NodeConfigPanel (right slide-in panel)
 * ```
 *
 * ## Data Flow
 * 1. **Load existing flow**: Flow → flowToReactFlow → ReactFlow nodes/edges
 * 2. **User edits in canvas**: Updates via FlowCanvasContext
 * 3. **Save flow**: ReactFlow nodes/edges → reactFlowToFlow → Flow
 * 4. **API call**: Flow → Backend API (create or update)
 *
 * ## Integration Points
 * - **FlowCanvasContext**: Centralized state for nodes, edges, undo/redo
 * - **flow-converter**: Bidirectional conversion between formats
 * - **FloatingNodePalette**: Floating overlay to drag nodes onto canvas
 * - **FlowCanvas**: Main visual canvas with React Flow
 * - **NodeConfigPanel**: Edit selected node properties
 * - **CanvasToolbar**: Canvas manipulation controls
 *
 * @example
 * ```tsx
 * // Creating a new flow
 * <FlowEditorVisual
 *   onClose={() => navigate('/flows')}
 *   onSave={(flow) => console.log('Flow saved:', flow)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Editing an existing flow
 * <FlowEditorVisual
 *   flowId="flow-123"
 *   onClose={() => navigate('/flows')}
 *   onSave={(flow) => console.log('Flow updated:', flow)}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type {
  Flow,
  FlowStatus,
  FlowCategory,
  FlowSchedule,
} from '../types';
import * as flowApi from '../services/flow-api';
import { FlowCanvasProvider } from '../contexts/FlowCanvasContext';
import { FlowCanvas } from './flow-canvas/FlowCanvas';
import ConfigSidebar from './flow-canvas/ConfigSidebar';
import FloatingNodePalette from './flow-canvas/FloatingNodePalette';
import NodeConfigPanel from './flow-canvas/NodeConfigPanel';
import CanvasToolbar from './flow-canvas/CanvasToolbar';
import FlowPreview from './flow-canvas/FlowPreview';
import FlowScheduleConfig, { createDefaultSchedule } from './flow/FlowScheduleConfig';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import {
  ArrowLeftIcon,
  SpinnerIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
} from './ui/Icons';
import { flowToReactFlow, reactFlowToFlow } from '../utils/flow-converter';
import {
  validateFlow,
  formatValidationErrors,
  type ExtendedFlowValidationResult,
} from '../utils/flow-validator';
import type { ReactFlowNode, ReactFlowEdge } from '../types/react-flow.types';
import { useFlowKeyboardShortcuts } from '../hooks/useFlowKeyboardShortcuts';
import { useToast } from '../contexts/ToastContext';

// =============================================================================
// TYPES AND CONSTANTS
// =============================================================================

/**
 * Props for the FlowEditorVisual component
 */
interface FlowEditorVisualProps {
  /**
   * Flow ID for editing existing flow. If not provided, creates new flow.
   */
  flowId?: string;
  /**
   * Callback fired when user closes the editor (via Cancel or after Save)
   */
  onClose: () => void;
  /**
   * Callback fired when flow is successfully saved
   * @param flow - The saved flow object from the API
   */
  onSave?: (flow: Flow) => void;
}

/**
 * Category options for flow categorization
 */
const CATEGORY_OPTIONS: { value: FlowCategory; label: string; emoji: string }[] = [
  { value: 'web-scraping', label: 'Web Scraping', emoji: '🌐' },
  { value: 'data-processing', label: 'Data Processing', emoji: '📊' },
  { value: 'api-integration', label: 'API Integration', emoji: '🔌' },
  { value: 'file-manipulation', label: 'File Manipulation', emoji: '📁' },
  { value: 'automation', label: 'Automation', emoji: '🤖' },
  { value: 'custom', label: 'Custom', emoji: '⚙️' },
];

/**
 * Status options for flow lifecycle
 */
const STATUS_OPTIONS: { value: FlowStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Generate URL-friendly slug from flow name
 */
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Visual flow editor component with React Flow-based canvas interface
 */
const FlowEditorVisual: React.FC<FlowEditorVisualProps> = ({ flowId, onClose, onSave }) => {
  // =========================================================================
  // STATE - Flow Metadata
  // =========================================================================
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FlowCategory>('custom');
  const [status, setStatus] = useState<FlowStatus>('draft');
  const [isActive, setIsActive] = useState(false);
  const [version, setVersion] = useState('1.0.0');

  // =========================================================================
  // STATE - Canvas State
  // =========================================================================
  const [initialNodes, setInitialNodes] = useState<ReactFlowNode[]>([]);
  const [initialEdges, setInitialEdges] = useState<ReactFlowEdge[]>([]);
  const [currentNodes, setCurrentNodes] = useState<ReactFlowNode[]>([]);
  const [currentEdges, setCurrentEdges] = useState<ReactFlowEdge[]>([]);

  // =========================================================================
  // STATE - Schedule and Webhook
  // =========================================================================
  const [schedule, setSchedule] = useState<FlowSchedule | undefined>(undefined);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');

  // =========================================================================
  // STATE - UI State
  // =========================================================================
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================
  const { addToast } = useToast();

  // =========================================================================
  // STATE - Validation
  // =========================================================================
  const [validationResult, setValidationResult] = useState<ExtendedFlowValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    hasErrors: false,
    hasWarnings: false,
  });

  // =========================================================================
  // EFFECTS
  // =========================================================================

  /**
   * Auto-generate slug from name when creating new flow
   */
  useEffect(() => {
    if (!flowId && name) {
      setSlug(generateSlug(name));
    }
  }, [name, flowId]);

  /**
   * Load existing flow if editing
   */
  useEffect(() => {
    if (flowId) {
      loadFlow();
    }
  }, [flowId]);

  // =========================================================================
  // HANDLERS - Data Loading
  // =========================================================================

  /**
   * Load flow from API and convert to React Flow format
   */
  const loadFlow = async () => {
    if (!flowId) return;

    setLoading(true);

    try {
      const flow = await flowApi.getFlow(flowId);

      // Set metadata
      setName(flow.name);
      setSlug(flow.slug);
      setDescription(flow.description || '');
      setCategory(flow.category);
      setStatus(flow.status);
      setIsActive(flow.isActive);
      setVersion(flow.version);

      // Convert Flow nodes to React Flow format
      const { nodes, edges } = flowToReactFlow(flow);
      setInitialNodes(nodes);
      setInitialEdges(edges);
      setCurrentNodes(nodes);
      setCurrentEdges(edges);

      // Load schedule and webhook settings
      if (flow.schedule) {
        setSchedule(flow.schedule);
      }
      setWebhookEnabled(flow.webhookEnabled || false);
      setWebhookSecret(flow.webhookSecret || '');
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Failed to load flow',
        variant: 'error',
        duration: 7000,
      });
      console.error('Failed to load flow:', err);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // HANDLERS - Canvas Changes
  // =========================================================================

  /**
   * Handle canvas changes (nodes/edges updates)
   * This is called by FlowCanvasContext when the canvas state changes
   */
  const handleCanvasChange = useCallback((nodes: ReactFlowNode[], edges: ReactFlowEdge[]) => {
    setCurrentNodes(nodes);
    setCurrentEdges(edges);

    // Run validation on canvas changes
    const result = validateFlow(nodes, edges);
    setValidationResult(result);
  }, []);

  /**
   * Handle node click - open config panel
   */
  const handleNodeClick = useCallback(() => {
    setConfigPanelOpen(true);
  }, []);

  /**
   * Handle canvas click - close config panel
   */
  const handleCanvasClick = useCallback(() => {
    setConfigPanelOpen(false);
  }, []);

  /**
   * Handle config panel close
   */
  const handleConfigPanelClose = useCallback(() => {
    setConfigPanelOpen(false);
  }, []);

  // =========================================================================
  // HANDLERS - Save Flow
  // =========================================================================

  /**
   * Save flow to API
   * Converts React Flow format back to Flow format and saves
   */
  const handleSave = async () => {
    if (!name.trim()) {
      addToast({
        message: 'Flow name is required',
        variant: 'error',
        duration: 5000,
      });
      return;
    }

    if (currentNodes.length === 0) {
      addToast({
        message: 'Flow must have at least one node',
        variant: 'error',
        duration: 5000,
      });
      return;
    }

    // Validate flow structure before saving
    const validation = validateFlow(currentNodes, currentEdges);
    if (!validation.isValid) {
      // Show each validation error as a separate stacked toast
      validation.errors.forEach((error) => {
        addToast({
          message: error.message,
          variant: 'error',
          duration: 7000,
        });
      });
      return;
    }

    setSaving(true);

    try {
      // Convert React Flow format back to Flow format
      const flowNodes = reactFlowToFlow(currentNodes, currentEdges);

      // Find input node to build input schema
      const inputNode = flowNodes.find((n) => n.type === 'input');
      const inputFields = inputNode && inputNode.type === 'input' ? inputNode.inputFields : [];

      // Build input schema from input node fields
      const inputSchema = {
        properties: inputFields.reduce((acc, field) => {
          acc[field.name] = {
            type: field.type === 'number' ? 'number' : 'string',
            description: field.description,
          };
          return acc;
        }, {} as Record<string, { type: string; description?: string }>),
        required: inputFields.filter((f) => f.required).map((f) => f.name),
      };

      // Build output schema (simple for now)
      const outputSchema = {
        properties: {
          result: { type: 'string', description: 'Flow execution result' },
        },
      };

      // Prepare flow data for API
      const flowData = {
        name: name.trim(),
        slug: slug.trim() || generateSlug(name),
        description: description.trim(),
        category,
        status,
        isActive,
        version,
        nodes: flowNodes,
        inputSchema,
        outputSchema,
        schedule,
        webhookEnabled,
        webhookSecret: webhookSecret || undefined,
      };

      let savedFlow: Flow;

      if (flowId) {
        // Update existing flow
        const response = await flowApi.updateFlow(flowId, flowData);
        savedFlow = response.flow;
      } else {
        // Create new flow
        const response = await flowApi.createFlow(flowData as any);
        savedFlow = response.flow;
      }

      // Show success toast
      addToast({
        message: `Flow "${savedFlow.name}" saved successfully!`,
        variant: 'success',
        duration: 5000,
      });

      // Call success callbacks
      onSave?.(savedFlow);
      onClose();
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Failed to save flow',
        variant: 'error',
        duration: 7000,
      });
      console.error('Failed to save flow:', err);
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // HANDLERS - UI Controls
  // =========================================================================

  // =========================================================================
  // KEYBOARD SHORTCUTS
  // =========================================================================

  /**
   * Enable keyboard shortcuts for common operations
   * - Delete/Backspace: Remove selected nodes/edges
   * - Ctrl+Z/Cmd+Z: Undo
   * - Ctrl+Y/Cmd+Shift+Z: Redo
   * - Ctrl+S/Cmd+S: Save flow
   * - Ctrl+C/Cmd+C: Copy selected nodes
   * - Ctrl+V/Cmd+V: Paste copied nodes
   * - Ctrl+D/Cmd+D: Duplicate selected nodes
   * - Escape: Clear selection
   */
  useFlowKeyboardShortcuts({
    onSave: handleSave,
    enabled: !loading && !saving,
  });

  // =========================================================================
  // METADATA CONTENT FOR SIDEBAR
  // =========================================================================

  /**
   * Metadata form content for ConfigSidebar
   */
  const metadataContent = (
    <div className="space-y-4">
      {/* Flow Name */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Flow Name <span className="text-red-500">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter flow name..."
          className="w-full"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Slug <span className="text-muted-foreground text-xs">(auto-generated)</span>
        </label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="flow-slug"
          className="w-full font-mono text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this flow does..."
          rows={3}
          className="w-full resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Category</label>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as FlowCategory)}
          className="w-full"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.emoji} {option.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Status</label>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as FlowStatus)}
          className="w-full"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Version */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Version</label>
        <Input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.0.0"
          className="w-full font-mono text-sm"
        />
      </div>

      {/* Active Toggle */}
      <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
        <div>
          <label className="block font-medium text-sm">Active</label>
          <p className="text-xs text-muted-foreground">
            Enable flow for execution
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>
  );

  // =========================================================================
  // TRIGGERS CONTENT FOR SIDEBAR
  // =========================================================================

  /**
   * Triggers configuration content for ConfigSidebar
   */
  const triggersContent = (
    <div className="space-y-6">
      {/* Schedule Configuration */}
      <div>
        <FlowScheduleConfig schedule={schedule} onChange={setSchedule} />
      </div>

      {/* Webhook Configuration */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg mb-4">
          <div>
            <label className="block font-medium text-sm flex items-center gap-2">
              <GlobeIcon className="h-4 w-4" />
              Webhook Trigger
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trigger via HTTP POST
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={webhookEnabled}
              onChange={(e) => setWebhookEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {webhookEnabled && (
          <div className="space-y-4 pl-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Webhook Secret
                <span className="text-muted-foreground font-normal ml-1 text-xs">
                  (Optional)
                </span>
              </label>
              <Input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Enter secret token..."
                className="w-full"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Include in X-Webhook-Secret header
              </p>
            </div>

            {flowId && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h5 className="font-medium text-xs text-blue-800 dark:text-blue-400 mb-2">
                  Webhook URL
                </h5>
                <code className="block text-[10px] bg-white dark:bg-gray-900 p-2 rounded border border-blue-100 dark:border-blue-900 break-all">
                  POST /api/webhooks/flows/{slug || flowId}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // RENDER - Loading State
  // =========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SpinnerIcon className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading flow...</span>
      </div>
    );
  }

  // =========================================================================
  // RENDER - Main UI
  // =========================================================================

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ===================================================================
          HEADER - Minimal Top Bar (Back + Save/Cancel)
          =================================================================== */}
      <div className="flex-shrink-0 border-b border-border bg-card" style={{ height: '50px' }}>
        <div className="h-full flex items-center justify-between px-4 gap-4">
          {/* Left: Back Button */}
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex items-center gap-2 flex-shrink-0"
            size="sm"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Button>

          {/* Center: Flow Name Display */}
          <div className="flex-1 text-center min-w-0 px-4">
            <h1
              className="text-base font-semibold text-foreground truncate max-w-full"
              title={name || 'Untitled Flow'}
            >
              {name || 'Untitled Flow'}
            </h1>
          </div>

          {/* Right: Save/Cancel Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || validationResult.hasErrors}
              className="flex items-center gap-2"
              title={validationResult.hasErrors ? 'Fix validation errors before saving' : undefined}
              size="sm"
            >
              {saving ? (
                <>
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ===================================================================
          MAIN CANVAS - Visual Flow Editor
          =================================================================== */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 50px)' }}>
        <FlowCanvasProvider
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onCanvasChange={handleCanvasChange}
        >
          {/* Left Sidebar - Configuration (collapsible: 320px expanded, 50px collapsed) */}
          <ConfigSidebar
            metadataContent={metadataContent}
            triggersContent={triggersContent}
          />

          {/* Center Area - Flow Canvas (fills remaining space ~80-90% width) */}
          <div className="flex-1 relative overflow-hidden h-full">
            <ReactFlowProvider>
              <FlowCanvas
                onNodeClick={handleNodeClick}
                onCanvasClick={handleCanvasClick}
                showBackground={showGrid}
                showMinimap={showMinimap}
              />

              {/* Floating Node Palette - Overlay positioned top-left */}
              <FloatingNodePalette position="top-left" />

              {/* Floating Toolbar - Overlay positioned top-center */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                <CanvasToolbar
                  showGrid={showGrid}
                  onToggleGrid={() => setShowGrid((prev) => !prev)}
                  showMinimap={showMinimap}
                  onToggleMinimap={() => setShowMinimap((prev) => !prev)}
                  onPreview={() => setShowPreview(true)}
                />
              </div>

              {/* Flow Preview Modal */}
              <FlowPreview
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
              />
            </ReactFlowProvider>
          </div>

          {/* Right Panel - Node Configuration (slide-in overlay, doesn't affect layout) */}
          <NodeConfigPanel isOpen={configPanelOpen} onClose={handleConfigPanelClose} />
        </FlowCanvasProvider>
      </div>
    </div>
  );
};

/**
 * Display name for React DevTools
 */
FlowEditorVisual.displayName = 'FlowEditorVisual';

export default FlowEditorVisual;
