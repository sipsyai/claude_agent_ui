/**
 * @file NodeConfigPanel.tsx
 * @description Slide-out panel for configuring selected nodes in the React Flow canvas.
 * This component provides a right-side panel that displays the appropriate configuration
 * interface based on the selected node type, reusing existing node config components.
 *
 * ## Features
 * - **Slide-In Animation**: Smooth right-to-left panel animation with 300ms transition
 * - **Type-Specific Config**: Renders InputNodeConfig, AgentNodeConfig, or OutputNodeConfig based on node type
 * - **Real-Time Updates**: Changes update node data immediately via FlowCanvasContext
 * - **Click-Outside-to-Close**: Clicking overlay closes the panel
 * - **Close Button**: X icon in header for explicit closing
 * - **Responsive Width**: 500px on desktop, full width on mobile
 * - **Overlay Backdrop**: Semi-transparent black overlay (20% opacity)
 * - **Auto-Focus**: Panel auto-focuses when opened for accessibility
 *
 * ## Integration
 * The component integrates with:
 * - **FlowCanvasContext**: For getting/updating selected node data
 * - **InputNodeConfig**: For configuring input nodes
 * - **AgentNodeConfig**: For configuring agent nodes with skills selection
 * - **OutputNodeConfig**: For configuring output nodes
 * - **API Services**: Fetches available agents and skills for agent configuration
 *
 * ## Node Type Handling
 * The panel automatically detects the selected node type and renders the appropriate
 * configuration component:
 * - **Input Node**: Shows InputNodeConfig for defining input fields
 * - **Agent Node**: Shows AgentNodeConfig for selecting agent, skills, and execution settings
 * - **Output Node**: Shows OutputNodeConfig for formatting and delivery options
 *
 * ## Data Flow
 * 1. User selects a node on the canvas
 * 2. Panel slides in from right with selected node's configuration
 * 3. User modifies configuration via the appropriate config component
 * 4. onChange handler converts updates and calls updateNode from context
 * 5. React Flow node data updates in real-time
 * 6. Visual node updates automatically via React Flow re-render
 *
 * ## Styling
 * - **Panel Width**: 500px on desktop (`sm:w-[500px]`), full width on mobile
 * - **Z-Index**: Panel at z-50, overlay at z-40
 * - **Background**: Card background with border-left separator
 * - **Header**: Purple gradient background matching other panels
 * - **Content**: Scrollable area with padding for long configurations
 * - **Shadow**: 2xl shadow for depth and separation
 */

import React, { useState, useEffect } from 'react';
import { XCircleIcon, CogIcon } from '../ui/Icons';
import InputNodeConfig from '../flow/InputNodeConfig';
import AgentNodeConfig from '../flow/AgentNodeConfig';
import OutputNodeConfig from '../flow/OutputNodeConfig';
import { useFlowCanvas } from '../../contexts/FlowCanvasContext';
import * as api from '../../services/api';
import type {
  ReactFlowNode,
  InputNodeData,
  AgentNodeData,
  OutputNodeData,
} from '../../types/react-flow.types';
import type { InputNode, AgentNode, OutputNode } from '../../types';

/**
 * Props for the NodeConfigPanel component.
 *
 * @property {boolean} isOpen - Controls panel visibility and slide-in animation.
 *   When true, panel slides in from right; when false, panel slides out.
 *
 * @property {() => void} onClose - Callback invoked when panel should close.
 *   Called when user clicks overlay, close button, or presses Escape key.
 *   Parent should clear selection or set isOpen: false in response.
 *
 * @example
 * // Basic usage with FlowCanvasContext
 * function FlowEditor() {
 *   const { selectedNodeIds } = useFlowCanvas();
 *   const [isPanelOpen, setIsPanelOpen] = useState(false);
 *
 *   useEffect(() => {
 *     setIsPanelOpen(selectedNodeIds.length > 0);
 *   }, [selectedNodeIds]);
 *
 *   return (
 *     <>
 *       <FlowCanvas />
 *       <NodeConfigPanel
 *         isOpen={isPanelOpen}
 *         onClose={() => setIsPanelOpen(false)}
 *       />
 *     </>
 *   );
 * }
 */
interface NodeConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Slide-out panel component for configuring selected nodes in the React Flow canvas.
 *
 * This component displays a right-side panel that shows the appropriate configuration
 * interface based on the selected node type. It reuses existing node config components
 * (InputNodeConfig, AgentNodeConfig, OutputNodeConfig) and handles real-time updates
 * to the node data via FlowCanvasContext.
 *
 * The panel automatically detects which node is selected and renders the corresponding
 * configuration form. Changes are immediately applied to the node data in the canvas.
 *
 * @param {NodeConfigPanelProps} props - Component props
 * @returns {React.ReactElement | null} Rendered panel or null if not open
 *
 * @example
 * // Automatic opening based on selection
 * function FlowEditorPage() {
 *   const { selectedNodeIds, clearSelection } = useFlowCanvas();
 *
 *   return (
 *     <>
 *       <FlowCanvas />
 *       <NodeConfigPanel
 *         isOpen={selectedNodeIds.length > 0}
 *         onClose={clearSelection}
 *       />
 *     </>
 *   );
 * }
 *
 * @example
 * // Manual control with state
 * function FlowEditorPage() {
 *   const [showConfig, setShowConfig] = useState(false);
 *
 *   return (
 *     <>
 *       <Button onClick={() => setShowConfig(true)}>Configure Node</Button>
 *       <NodeConfigPanel
 *         isOpen={showConfig}
 *         onClose={() => setShowConfig(false)}
 *       />
 *     </>
 *   );
 * }
 */
const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ isOpen, onClose }) => {
  const { selectedNodeIds, getNodeById, updateNode } = useFlowCanvas();
  const [availableAgents, setAvailableAgents] = useState<api.Agent[]>([]);
  const [availableSkills, setAvailableSkills] = useState<api.Skill[]>([]);
  const [loading, setLoading] = useState(false);

  // Get the first selected node (we only support single selection for now)
  const selectedNode = selectedNodeIds.length > 0 ? getNodeById(selectedNodeIds[0]) : undefined;

  /**
   * Load available agents and skills for agent node configuration.
   * This data is used by AgentNodeConfig to populate agent and skill selection dropdowns.
   *
   * @internal
   */
  useEffect(() => {
    const loadAgentsAndSkills = async () => {
      setLoading(true);
      try {
        const [agents, skills] = await Promise.all([
          api.getAgents(),
          api.getSkills(),
        ]);
        setAvailableAgents(agents);
        setAvailableSkills(skills);
      } catch (err) {
        console.error('Failed to load agents and skills:', err);
        // Silently fail - not critical for editing
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadAgentsAndSkills();
    }
  }, [isOpen]);

  /**
   * Handle Escape key press to close panel.
   *
   * @internal
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * Convert React Flow node data to InputNode format for InputNodeConfig.
   *
   * @param {ReactFlowNode} node - The React Flow node with InputNodeData
   * @returns {InputNode} Converted node in InputNode format
   *
   * @internal
   */
  const convertToInputNode = (node: ReactFlowNode): InputNode => {
    const data = node.data as InputNodeData;
    return {
      nodeId: data.nodeId,
      type: 'input',
      name: data.name,
      description: data.description,
      position: node.position,
      inputFields: data.inputFields,
      validationRules: data.validationRules,
    };
  };

  /**
   * Convert React Flow node data to AgentNode format for AgentNodeConfig.
   *
   * @param {ReactFlowNode} node - The React Flow node with AgentNodeData
   * @returns {AgentNode} Converted node in AgentNode format
   *
   * @internal
   */
  const convertToAgentNode = (node: ReactFlowNode): AgentNode => {
    const data = node.data as AgentNodeData;
    return {
      nodeId: data.nodeId,
      type: 'agent',
      name: data.name,
      description: data.description,
      position: node.position,
      agentId: data.agentId,
      promptTemplate: data.promptTemplate,
      skills: data.skills,
      modelOverride: data.modelOverride,
      maxTokens: data.maxTokens,
      timeout: data.timeout,
      retryOnError: data.retryOnError,
      maxRetries: data.maxRetries,
    };
  };

  /**
   * Convert React Flow node data to OutputNode format for OutputNodeConfig.
   *
   * @param {ReactFlowNode} node - The React Flow node with OutputNodeData
   * @returns {OutputNode} Converted node in OutputNode format
   *
   * @internal
   */
  const convertToOutputNode = (node: ReactFlowNode): OutputNode => {
    const data = node.data as OutputNodeData;
    return {
      nodeId: data.nodeId,
      type: 'output',
      name: data.name,
      description: data.description,
      position: node.position,
      outputType: data.outputType,
      format: data.format,
      saveToFile: data.saveToFile,
      filePath: data.filePath,
      fileName: data.fileName,
      includeMetadata: data.includeMetadata,
      includeTimestamp: data.includeTimestamp,
      transformTemplate: data.transformTemplate,
      webhookUrl: data.webhookUrl,
      webhookHeaders: data.webhookHeaders,
    };
  };

  /**
   * Handle updates from InputNodeConfig and apply them to React Flow node.
   *
   * @param {Partial<InputNode>} updates - Partial updates to apply to the input node
   *
   * @internal
   */
  const handleInputNodeChange = (updates: Partial<InputNode>) => {
    if (!selectedNode) return;

    // Merge updates into node data
    updateNode(selectedNode.id, {
      data: {
        ...(selectedNode.data as InputNodeData),
        ...updates,
      } as InputNodeData,
    });
  };

  /**
   * Handle updates from AgentNodeConfig and apply them to React Flow node.
   *
   * @param {Partial<AgentNode>} updates - Partial updates to apply to the agent node
   *
   * @internal
   */
  const handleAgentNodeChange = (updates: Partial<AgentNode>) => {
    if (!selectedNode) return;

    // Merge updates into node data
    updateNode(selectedNode.id, {
      data: {
        ...(selectedNode.data as AgentNodeData),
        ...updates,
      } as AgentNodeData,
    });
  };

  /**
   * Handle updates from OutputNodeConfig and apply them to React Flow node.
   *
   * @param {Partial<OutputNode>} updates - Partial updates to apply to the output node
   *
   * @internal
   */
  const handleOutputNodeChange = (updates: Partial<OutputNode>) => {
    if (!selectedNode) return;

    // Merge updates into node data
    updateNode(selectedNode.id, {
      data: {
        ...(selectedNode.data as OutputNodeData),
        ...updates,
      } as OutputNodeData,
    });
  };

  /**
   * Get the display title for the panel header based on node type.
   *
   * @returns {string} Panel title (e.g., "Configure Input Node")
   *
   * @internal
   */
  const getPanelTitle = (): string => {
    if (!selectedNode) return 'Configure Node';

    switch (selectedNode.type) {
      case 'input':
        return 'Configure Input Node';
      case 'agent':
        return 'Configure Agent Node';
      case 'output':
        return 'Configure Output Node';
      default:
        return 'Configure Node';
    }
  };

  /**
   * Render the appropriate configuration component based on node type.
   *
   * @returns {React.ReactNode | null} Config component or null if no node selected
   *
   * @internal
   */
  const renderConfigComponent = (): React.ReactNode | null => {
    if (!selectedNode) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>No node selected. Select a node to configure it.</p>
        </div>
      );
    }

    switch (selectedNode.type) {
      case 'input':
        return (
          <InputNodeConfig
            node={convertToInputNode(selectedNode)}
            onChange={handleInputNodeChange}
          />
        );

      case 'agent':
        return (
          <AgentNodeConfig
            node={convertToAgentNode(selectedNode)}
            index={0}
            onChange={handleAgentNodeChange}
            availableAgents={availableAgents}
            availableSkills={availableSkills}
            canRemove={false}
          />
        );

      case 'output':
        return (
          <OutputNodeConfig
            node={convertToOutputNode(selectedNode)}
            onChange={handleOutputNodeChange}
          />
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Unknown node type. Cannot configure this node.</p>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
        onClick={onClose}
        aria-label="Close configuration panel"
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[500px] bg-background border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
          <div className="flex items-center gap-3">
            <CogIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h2
                id="config-panel-title"
                className="text-lg font-semibold text-foreground"
              >
                {getPanelTitle()}
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure node properties and behavior
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-background/50"
            aria-label="Close configuration panel"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="h-[calc(100%-73px)] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading configuration...</p>
              </div>
            </div>
          ) : (
            renderConfigComponent()
          )}
        </div>

        {/* Footer Help Text */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-muted/30 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            Changes are saved automatically. Press <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">Esc</kbd> or click outside to close.
          </p>
        </div>
      </div>
    </>
  );
};

NodeConfigPanel.displayName = 'NodeConfigPanel';

export default NodeConfigPanel;
