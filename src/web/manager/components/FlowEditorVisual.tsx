/**
 * FlowEditorVisual Component
 *
 * A visual flow editor that replaces the linear FlowEditorPage with a React Flow-based
 * drag-and-drop canvas. Provides an intuitive node-based interface for creating and
 * editing workflows similar to n8n and Langchain.
 *
 * ## Features
 * - **Visual Canvas**: React Flow-based drag-and-drop interface
 * - **Node Palette**: Draggable sidebar with available node types
 * - **Configuration Panel**: Slide-out panel for editing selected nodes
 * - **Canvas Toolbar**: Undo/redo, zoom controls, and layout options
 * - **Metadata Form**: Flow name, description, category, and settings
 * - **Auto-Save**: Changes save automatically with debouncing
 * - **Backward Compatible**: Converts between Flow and React Flow formats
 *
 * ## Component Architecture
 * ```
 * FlowEditorVisual
 *   ├── Header (Flow metadata form + Save/Cancel buttons)
 *   ├── FlowCanvasProvider (State management for nodes/edges)
 *   │   └── Main Layout (flex container)
 *   │       ├── NodePalette (left sidebar)
 *   │       ├── FlowCanvas (center area)
 *   │       │   └── CanvasToolbar (floating toolbar)
 *   │       └── NodeConfigPanel (right slide-in panel)
 *   └── Footer (Schedule & webhook configuration)
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
 * - **NodePalette**: Drag nodes onto canvas
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
import NodePalette from './flow-canvas/NodePalette';
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
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['metadata', 'triggers'])
  );
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

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
    setError(null);

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
      setError(err instanceof Error ? err.message : 'Failed to load flow');
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
      setError('Flow name is required');
      return;
    }

    if (currentNodes.length === 0) {
      setError('Flow must have at least one node');
      return;
    }

    // Validate flow structure before saving
    const validation = validateFlow(currentNodes, currentEdges);
    if (!validation.isValid) {
      const errorMessage = formatValidationErrors(validation);
      setError(`Flow validation failed:\n\n${errorMessage}`);
      return;
    }

    setSaving(true);
    setError(null);

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

      // Call success callbacks
      onSave?.(savedFlow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save flow');
      console.error('Failed to save flow:', err);
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // HANDLERS - UI Controls
  // =========================================================================

  /**
   * Toggle section expansion in metadata/triggers sections
   */
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

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
  // SUBCOMPONENTS
  // =========================================================================

  /**
   * Section header component for collapsible sections
   */
  const SectionHeader: React.FC<{
    id: string;
    title: string;
    description?: string;
    icon?: React.ReactNode;
  }> = ({ id, title, description, icon }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors rounded-lg"
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-primary">{icon}</span>}
        <div className="text-left">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {expandedSections.has(id) ? (
        <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
      ) : (
        <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
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
    <div className="flex flex-col h-screen bg-background">
      {/* ===================================================================
          HEADER - Flow Metadata and Actions
          =================================================================== */}
      <div className="flex-shrink-0 border-b border-border bg-card">
        <div className="max-w-full mx-auto px-6 py-4">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button variant="secondary" onClick={onClose} className="flex items-center gap-2">
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {flowId ? 'Edit Flow' : 'Create New Flow'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Design your workflow visually with drag-and-drop nodes
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || validationResult.hasErrors}
                className="flex items-center gap-2"
                title={validationResult.hasErrors ? 'Fix validation errors before saving' : undefined}
              >
                {saving ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    {flowId ? 'Update Flow' : 'Create Flow'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
              <pre className="whitespace-pre-wrap font-sans">{error}</pre>
            </div>
          )}

          {/* Validation Status Display */}
          {validationResult.hasErrors && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                    Flow Validation Errors
                  </h3>
                  <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                    {validationResult.errors.map((error, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>{error.message}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                    Please fix these errors before saving the flow.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation Warnings Display */}
          {validationResult.hasWarnings && !validationResult.hasErrors && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 text-lg">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                    Flow Warnings
                  </h3>
                  <ul className="space-y-1 text-sm text-yellow-600 dark:text-yellow-400">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>{warning.message}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-yellow-500 dark:text-yellow-500 mt-2">
                    These warnings won't prevent saving, but may affect flow execution.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success Status Display */}
          {!validationResult.hasErrors && !validationResult.hasWarnings && currentNodes.length > 0 && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircleIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Flow structure is valid ({currentNodes.length} nodes, {currentEdges.length} connections)
                </span>
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <Card className="mb-0">
            <SectionHeader
              id="metadata"
              title="Flow Metadata"
              description="Basic information about your flow"
              icon="📋"
            />
            {expandedSections.has('metadata') && (
              <CardContent className="space-y-4 border-t">
                {/* Name and Slug */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Workflow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Slug</label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="my-workflow"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this flow does..."
                    className="min-h-[80px]"
                  />
                </div>

                {/* Category, Status, Version */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <Select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as FlowCategory)}
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.emoji} {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as FlowStatus)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Version</label>
                    <Input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">
                    Flow is active and can be executed
                  </label>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* ===================================================================
          MAIN CANVAS - Visual Flow Editor
          =================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        <FlowCanvasProvider
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onCanvasChange={handleCanvasChange}
        >
          <ReactFlowProvider>
            {/* Left Sidebar - Node Palette */}
            <NodePalette />

            {/* Center Area - Flow Canvas */}
            <div className="flex-1 relative">
              <FlowCanvas
                onNodeClick={handleNodeClick}
                onCanvasClick={handleCanvasClick}
                showBackground={showGrid}
                showMinimap={showMinimap}
              />

              {/* Floating Toolbar */}
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
            </div>

            {/* Right Panel - Node Configuration */}
            <NodeConfigPanel isOpen={configPanelOpen} onClose={handleConfigPanelClose} />
          </ReactFlowProvider>
        </FlowCanvasProvider>
      </div>

      {/* ===================================================================
          FOOTER - Schedule & Triggers
          =================================================================== */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        <div className="max-w-full mx-auto px-6 py-4">
          <Card className="mb-0">
            <SectionHeader
              id="triggers"
              title="Schedule & Triggers"
              description="Configure automated execution and webhook triggers"
              icon={<ClockIcon className="h-5 w-5" />}
            />
            {expandedSections.has('triggers') && (
              <CardContent className="space-y-6 border-t">
                {/* Schedule Configuration */}
                <FlowScheduleConfig schedule={schedule} onChange={setSchedule} />

                {/* Webhook Configuration */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg mb-4">
                    <div>
                      <label className="block font-medium flex items-center gap-2">
                        <GlobeIcon className="h-4 w-4" />
                        Enable Webhook Trigger
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Allow this flow to be triggered via HTTP POST request
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
                    <div className="space-y-4 pl-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Webhook Secret
                          <span className="text-muted-foreground font-normal ml-1">
                            - Optional but recommended
                          </span>
                        </label>
                        <Input
                          type="password"
                          value={webhookSecret}
                          onChange={(e) => setWebhookSecret(e.target.value)}
                          placeholder="Enter a secret token for authentication"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Include this secret in the X-Webhook-Secret header when calling the
                          webhook
                        </p>
                      </div>

                      {flowId && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <h5 className="font-medium text-sm text-blue-800 dark:text-blue-400 mb-2">
                            Webhook URL
                          </h5>
                          <code className="block text-sm bg-white dark:bg-gray-900 p-2 rounded border border-blue-100 dark:border-blue-900 break-all">
                            POST /api/webhooks/flows/{slug || flowId}
                          </code>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            Send a POST request with JSON body containing your input data
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

/**
 * Display name for React DevTools
 */
FlowEditorVisual.displayName = 'FlowEditorVisual';

export default FlowEditorVisual;
