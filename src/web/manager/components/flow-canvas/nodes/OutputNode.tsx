/**
 * Output Node Component for React Flow
 *
 * A custom React Flow node component that displays output configuration
 * including format and delivery type. Shows a visual representation of how
 * the flow results will be delivered and in what format.
 *
 * ## Features
 * - Displays output type (response, file, webhook, database, email)
 * - Shows format type (JSON, markdown, text, HTML, CSV, ZIP)
 * - File path preview if saveToFile is enabled
 * - Webhook URL indicator if outputType is webhook
 * - Green color theme for output nodes
 * - Click to open configuration panel (handled by parent)
 * - Visual indicators for metadata and timestamp inclusion
 *
 * ## Component Structure
 * ```
 * OutputNode
 *   └── BaseNode (with green theme)
 *       ├── Output Type & Format
 *       ├── File Configuration (if saveToFile)
 *       ├── Webhook Configuration (if webhook)
 *       ├── Additional Options (metadata, timestamp)
 *       └── Transform Template Preview (if configured)
 * ```
 *
 * ## Output Types
 * - **response**: Direct response to the user
 * - **file**: Save output to file system
 * - **database**: Store in database
 * - **webhook**: Send to external webhook URL
 * - **email**: Send via email
 *
 * ## Output Formats
 * - **json**: JSON formatted output
 * - **markdown**: Markdown formatted text
 * - **text**: Plain text output
 * - **html**: HTML formatted output
 * - **csv**: CSV (comma-separated values)
 * - **zip**: Compressed ZIP file
 *
 * ## Validation Status
 * - **Valid**: Green check if output type and format are configured
 * - **Warning**: Yellow warning if configuration is incomplete
 * - Shows configuration status
 *
 * @example
 * // Basic usage in React Flow
 * const nodeTypes = {
 *   output: OutputNode,
 *   // ... other node types
 * };
 *
 * <ReactFlow nodeTypes={nodeTypes} nodes={nodes} edges={edges} />
 *
 * @example
 * // With configured output
 * const outputNodeData: OutputNodeData = {
 *   nodeId: 'output-1',
 *   type: 'output',
 *   name: 'JSON Response',
 *   outputType: 'response',
 *   format: 'json',
 *   saveToFile: false,
 *   includeMetadata: true,
 *   includeTimestamp: true,
 * };
 */

import React from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ReactFlowOutputNode, OutputNodeData } from '../../../types/react-flow.types';
import type { FlowOutputType, FlowOutputFormat } from '../../../types';
import { BaseNode } from './BaseNode';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  GlobeIcon,
  FolderIcon,
  ClockIcon,
  ArchiveIcon,
  ServerIcon,
} from '../../ui/Icons';

/**
 * Icon mapping for different output types
 * Each output type gets a distinct icon for visual recognition
 */
const OUTPUT_TYPE_ICONS: Record<FlowOutputType, React.ReactNode> = {
  response: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  database: <ServerIcon width={16} height={16} />,
  webhook: <GlobeIcon width={16} height={16} />,
  email: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
};

/**
 * Icon mapping for different output formats
 * Each format type gets a distinct icon for visual recognition
 */
const FORMAT_TYPE_ICONS: Record<FlowOutputFormat, React.ReactNode> = {
  json: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h3v18h-3" />
      <path d="M8 21H5V3h3" />
    </svg>
  ),
  markdown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9h1v6H6V9z" />
      <path d="M10 9h1v6h-1V9z" />
      <path d="M14 9h1l2 3-2 3h-1V9z" />
    </svg>
  ),
  text: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 6H3" />
      <path d="M21 12H3" />
      <path d="M21 18H3" />
    </svg>
  ),
  html: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </svg>
  ),
  csv: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
    </svg>
  ),
  zip: <ArchiveIcon width={16} height={16} />,
};

/**
 * Display names for output types
 */
const OUTPUT_TYPE_LABELS: Record<FlowOutputType, string> = {
  response: 'Response',
  file: 'File',
  database: 'Database',
  webhook: 'Webhook',
  email: 'Email',
};

/**
 * Display names for output formats
 */
const FORMAT_TYPE_LABELS: Record<FlowOutputFormat, string> = {
  json: 'JSON',
  markdown: 'Markdown',
  text: 'Plain Text',
  html: 'HTML',
  csv: 'CSV',
  zip: 'ZIP Archive',
};

/**
 * Props for the OutputNode component
 * Extends React Flow's NodeProps with OutputNodeData
 */
export type OutputNodeProps = NodeProps<ReactFlowOutputNode>;

/**
 * Output type badge component
 * Shows the output delivery type with icon
 */
interface OutputTypeBadgeProps {
  outputType: FlowOutputType;
}

const OutputTypeBadge: React.FC<OutputTypeBadgeProps> = ({ outputType }) => {
  const icon = OUTPUT_TYPE_ICONS[outputType];
  const label = OUTPUT_TYPE_LABELS[outputType];

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded bg-green-500/20 border border-green-500/30"
      title={`Output Type: ${label}`}
    >
      <div className="flex-shrink-0 text-green-400">
        {icon}
      </div>
      <span className="text-sm font-medium text-green-300">
        {label}
      </span>
    </div>
  );
};

/**
 * Format type badge component
 * Shows the output format with icon
 */
interface FormatTypeBadgeProps {
  format: FlowOutputFormat;
}

const FormatTypeBadge: React.FC<FormatTypeBadgeProps> = ({ format }) => {
  const icon = FORMAT_TYPE_ICONS[format];
  const label = FORMAT_TYPE_LABELS[format];

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded bg-secondary/30 border border-border/30"
      title={`Format: ${label}`}
    >
      <div className="flex-shrink-0 text-muted-foreground">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground">
        {label}
      </span>
    </div>
  );
};

/**
 * File configuration component
 * Shows file path and name when saveToFile is enabled
 */
interface FileConfigProps {
  filePath?: string;
  fileName?: string;
}

const FileConfig: React.FC<FileConfigProps> = ({ filePath, fileName }) => {
  const displayPath = filePath || '/output';
  const displayName = fileName || 'output.txt';
  const fullPath = `${displayPath}/${displayName}`;

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        File Location
      </div>
      <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-secondary/30 border border-border/30">
        <FolderIcon width={14} height={14} className="flex-shrink-0 mt-0.5 text-blue-400" />
        <span className="text-xs font-mono text-muted-foreground break-all">
          {fullPath}
        </span>
      </div>
    </div>
  );
};

/**
 * Webhook configuration component
 * Shows webhook URL when outputType is webhook
 */
interface WebhookConfigProps {
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
}

const WebhookConfig: React.FC<WebhookConfigProps> = ({ webhookUrl, webhookHeaders }) => {
  const headerCount = webhookHeaders ? Object.keys(webhookHeaders).length : 0;

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Webhook Configuration
      </div>
      <div className="space-y-1.5">
        {webhookUrl ? (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-secondary/30 border border-border/30">
            <GlobeIcon width={14} height={14} className="flex-shrink-0 mt-0.5 text-blue-400" />
            <span className="text-xs font-mono text-muted-foreground break-all">
              {webhookUrl}
            </span>
          </div>
        ) : (
          <div className="px-2 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-[10px] text-yellow-300">
              No webhook URL configured
            </p>
          </div>
        )}
        {headerCount > 0 && (
          <div className="text-[10px] text-muted-foreground">
            {headerCount} custom {headerCount === 1 ? 'header' : 'headers'}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Additional options component
 * Shows metadata and timestamp inclusion status
 */
interface AdditionalOptionsProps {
  includeMetadata: boolean;
  includeTimestamp: boolean;
}

const AdditionalOptions: React.FC<AdditionalOptionsProps> = ({
  includeMetadata,
  includeTimestamp,
}) => {
  if (!includeMetadata && !includeTimestamp) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {includeMetadata && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300"
          title="Includes metadata in output"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <span className="text-[10px] font-medium">
            Metadata
          </span>
        </div>
      )}
      {includeTimestamp && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300"
          title="Includes timestamp in output"
        >
          <ClockIcon width={12} height={12} />
          <span className="text-[10px] font-medium">
            Timestamp
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * OutputNode Component
 *
 * Renders an output node in the React Flow canvas, displaying the output
 * configuration including type, format, and delivery settings.
 */
export const OutputNode: React.FC<OutputNodeProps> = ({ data, selected, id }) => {
  const hasOutputType = !!data.outputType;
  const hasFormat = !!data.format;
  const hasFileConfig = data.saveToFile && (data.filePath || data.fileName);
  const hasWebhookConfig = data.outputType === 'webhook';
  const hasTransform = !!data.transformTemplate && data.transformTemplate.trim().length > 0;

  // Determine validation status
  const isValid = hasOutputType && hasFormat;
  const validationIcon = isValid ? (
    <CheckCircleIcon width={16} height={16} className="text-green-500" />
  ) : (
    <ExclamationCircleIcon width={16} height={16} className="text-yellow-500" />
  );

  // Generate node title
  const nodeTitle = data.name || 'Output';

  // Output icon for the header
  const outputIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
    </svg>
  );

  // Truncate transform template for preview
  const truncateTransform = (template: string, maxLength: number = 100): string => {
    if (template.length <= maxLength) return template;
    return template.substring(0, maxLength) + '...';
  };

  return (
    <BaseNode
      icon={outputIcon}
      title={nodeTitle}
      selected={selected}
      nodeType="output"
      status={data.metadata?.status as any}
      showDeleteButton={true}
      className="cursor-pointer"
    >
      <div className="space-y-3">
        {/* Validation Status */}
        <div className="flex items-center justify-end pb-2 border-b border-border/30">
          <div title={isValid ? 'Valid configuration' : 'Configuration incomplete'}>
            {validationIcon}
          </div>
        </div>

        {/* Output Type */}
        {hasOutputType ? (
          <OutputTypeBadge outputType={data.outputType} />
        ) : (
          <div className="px-2 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-[10px] text-yellow-300">
              No output type selected
            </p>
          </div>
        )}

        {/* Format Type */}
        {hasFormat ? (
          <FormatTypeBadge format={data.format} />
        ) : (
          <div className="px-2 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-[10px] text-yellow-300">
              No format selected
            </p>
          </div>
        )}

        {/* File Configuration */}
        {data.saveToFile && (
          <FileConfig filePath={data.filePath} fileName={data.fileName} />
        )}

        {/* Webhook Configuration */}
        {hasWebhookConfig && (
          <WebhookConfig
            webhookUrl={data.webhookUrl}
            webhookHeaders={data.webhookHeaders}
          />
        )}

        {/* Transform Template Preview */}
        {hasTransform && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Transform Template
            </div>
            <div className="px-2 py-1.5 rounded bg-secondary/30 border border-border/30">
              <p className="text-[11px] font-mono text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                {truncateTransform(data.transformTemplate!)}
              </p>
            </div>
          </div>
        )}

        {/* Additional Options */}
        <AdditionalOptions
          includeMetadata={data.includeMetadata}
          includeTimestamp={data.includeTimestamp}
        />

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
OutputNode.displayName = 'OutputNode';

export default OutputNode;
