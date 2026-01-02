import React from 'react';
import type { OutputNode, FlowOutputType, FlowOutputFormat } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { KeyValueEditor } from '../ui/KeyValueEditor';

// Output type options
const OUTPUT_TYPE_OPTIONS: { value: FlowOutputType; label: string; description: string }[] = [
  { value: 'response', label: 'Direct Response', description: 'Return result directly' },
  { value: 'file', label: 'Save to File', description: 'Save output to a file' },
  { value: 'database', label: 'Save to Database', description: 'Store in database' },
  { value: 'webhook', label: 'Send to Webhook', description: 'POST to external URL' },
  { value: 'email', label: 'Send Email', description: 'Send via email' },
];

// Output format options
const OUTPUT_FORMAT_OPTIONS: { value: FlowOutputFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'text', label: 'Plain Text' },
  { value: 'html', label: 'HTML' },
  { value: 'csv', label: 'CSV' },
  { value: 'zip', label: 'ZIP Archive' },
];

export interface OutputNodeConfigProps {
  node: OutputNode;
  onChange: (updates: Partial<OutputNode>) => void;
  className?: string;
}

/**
 * Configuration panel for Output nodes in the flow editor.
 * Allows users to configure how flow results are formatted and delivered.
 */
const OutputNodeConfig: React.FC<OutputNodeConfigProps> = ({
  node,
  onChange,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Node Name & Description */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Node Name</label>
          <Input
            value={node.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Output"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input
            value={node.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Output configuration"
          />
        </div>
      </div>

      {/* Output Type and Format */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Output Type</label>
          <Select
            value={node.outputType}
            onChange={(e) =>
              onChange({ outputType: e.target.value as FlowOutputType })
            }
          >
            {OUTPUT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {OUTPUT_TYPE_OPTIONS.find((o) => o.value === node.outputType)?.description}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Format</label>
          <Select
            value={node.format}
            onChange={(e) =>
              onChange({ format: e.target.value as FlowOutputFormat })
            }
          >
            {OUTPUT_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* File Options (if outputType is 'file') */}
      {node.outputType === 'file' && (
        <FileOutputSettings
          filePath={node.filePath}
          fileName={node.fileName}
          saveToFile={node.saveToFile}
          onChange={onChange}
        />
      )}

      {/* Webhook Options (if outputType is 'webhook') */}
      {node.outputType === 'webhook' && (
        <WebhookOutputSettings
          webhookUrl={node.webhookUrl}
          webhookHeaders={node.webhookHeaders}
          onChange={onChange}
        />
      )}

      {/* Additional Options */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={node.includeMetadata}
            onChange={(e) => onChange({ includeMetadata: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          Include Metadata
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={node.includeTimestamp}
            onChange={(e) => onChange({ includeTimestamp: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          Include Timestamp
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={node.saveToFile}
            onChange={(e) => onChange({ saveToFile: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          Save to File
        </label>
      </div>

      {/* Transform Template */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Transform Template (Optional)
          <span className="text-muted-foreground font-normal ml-1">
            - Use &#123;&#123;result&#125;&#125; for agent output
          </span>
        </label>
        <Textarea
          value={node.transformTemplate || ''}
          onChange={(e) => onChange({ transformTemplate: e.target.value })}
          placeholder="Leave empty for raw output, or use template:&#10;&#10;# Results&#10;{{result}}&#10;&#10;## Summary&#10;{{result.summary}}"
          className="min-h-[100px] font-mono text-sm"
        />
      </div>
    </div>
  );
};

/**
 * File output settings sub-component
 */
interface FileOutputSettingsProps {
  filePath?: string;
  fileName?: string;
  saveToFile: boolean;
  onChange: (updates: Partial<OutputNode>) => void;
}

const FileOutputSettings: React.FC<FileOutputSettingsProps> = ({
  filePath,
  fileName,
  saveToFile,
  onChange,
}) => {
  return (
    <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
      <h5 className="font-medium text-sm flex items-center gap-2">
        File Settings
      </h5>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">File Path</label>
          <Input
            value={filePath || ''}
            onChange={(e) => onChange({ filePath: e.target.value })}
            placeholder="/path/to/output"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Directory where the file will be saved
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">File Name</label>
          <Input
            value={fileName || ''}
            onChange={(e) => onChange({ fileName: e.target.value })}
            placeholder="output.md"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use &#123;&#123;timestamp&#125;&#125; for unique names
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Webhook output settings sub-component
 */
interface WebhookOutputSettingsProps {
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  onChange: (updates: Partial<OutputNode>) => void;
}

const WebhookOutputSettings: React.FC<WebhookOutputSettingsProps> = ({
  webhookUrl,
  webhookHeaders,
  onChange,
}) => {
  return (
    <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
      <h5 className="font-medium text-sm flex items-center gap-2">
        Webhook Settings
      </h5>
      <div>
        <label className="block text-xs font-medium mb-1">Webhook URL</label>
        <Input
          value={webhookUrl || ''}
          onChange={(e) => onChange({ webhookUrl: e.target.value })}
          placeholder="https://example.com/webhook"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The URL to POST the flow output to
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">
          Custom Headers (Optional)
        </label>
        <KeyValueEditor
          value={webhookHeaders || {}}
          onChange={(headers) => onChange({ webhookHeaders: headers })}
          keyPlaceholder="Header-Name"
          valuePlaceholder="Header Value"
        />
      </div>
    </div>
  );
};

export default OutputNodeConfig;
