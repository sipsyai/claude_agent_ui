import React from 'react';
import type { InputNode, FlowInputField, InputFieldType } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { PlusIcon, TrashIcon } from '../ui/Icons';

// Input field type options
const INPUT_FIELD_TYPES: { value: InputFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'file', label: 'File' },
  { value: 'select', label: 'Select' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
];

export interface InputNodeConfigProps {
  node: InputNode;
  onChange: (updates: Partial<InputNode>) => void;
  className?: string;
}

/**
 * Configuration panel for Input nodes in the flow editor.
 * Allows users to define input fields with name, label, type, validation, etc.
 */
const InputNodeConfig: React.FC<InputNodeConfigProps> = ({
  node,
  onChange,
  className = '',
}) => {
  // Add a new input field
  const addInputField = () => {
    const newField: FlowInputField = {
      name: `field_${node.inputFields.length + 1}`,
      type: 'text',
      label: `Field ${node.inputFields.length + 1}`,
      required: false,
    };
    onChange({
      inputFields: [...node.inputFields, newField],
    });
  };

  // Update an input field
  const updateInputField = (index: number, updates: Partial<FlowInputField>) => {
    onChange({
      inputFields: node.inputFields.map((field, i) =>
        i === index ? { ...field, ...updates } : field
      ),
    });
  };

  // Remove an input field
  const removeInputField = (index: number) => {
    onChange({
      inputFields: node.inputFields.filter((_, i) => i !== index),
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Node Name & Description */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Node Name</label>
          <Input
            value={node.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input
            value={node.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Input configuration"
          />
        </div>
      </div>

      {/* Input Fields Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Input Fields</label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addInputField}
            className="flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            Add Field
          </Button>
        </div>

        {node.inputFields.length === 0 ? (
          <div className="text-center py-8 bg-secondary/30 rounded-lg text-muted-foreground">
            No input fields defined. Click "Add Field" to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {node.inputFields.map((field, index) => (
              <InputFieldEditor
                key={index}
                field={field}
                index={index}
                onChange={(updates) => updateInputField(index, updates)}
                onRemove={() => removeInputField(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Validation Rules (advanced) */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Custom Validation Rules (JSON)
          <span className="text-muted-foreground font-normal ml-1">- Optional</span>
        </label>
        <Textarea
          value={node.validationRules ? JSON.stringify(node.validationRules, null, 2) : ''}
          onChange={(e) => {
            try {
              const rules = e.target.value ? JSON.parse(e.target.value) : {};
              onChange({ validationRules: rules });
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='{"fieldName": {"minLength": 3}}'
          className="min-h-[60px] font-mono text-sm"
        />
      </div>
    </div>
  );
};

/**
 * Individual input field editor component
 */
interface InputFieldEditorProps {
  field: FlowInputField;
  index: number;
  onChange: (updates: Partial<FlowInputField>) => void;
  onRemove: () => void;
}

const InputFieldEditor: React.FC<InputFieldEditorProps> = ({
  field,
  index,
  onChange,
  onRemove,
}) => {
  // Check if field type supports options
  const supportsOptions = field.type === 'select' || field.type === 'multiselect';

  // Check if field type supports min/max
  const supportsMinMax = field.type === 'number' || field.type === 'text' || field.type === 'textarea';

  return (
    <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
      {/* Row 1: Name, Label, Type */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Name (key)</label>
          <Input
            value={field.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="field_name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Label</label>
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Field Label"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Type</label>
          <Select
            value={field.type}
            onChange={(e) => onChange({ type: e.target.value as InputFieldType })}
          >
            {INPUT_FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Row 2: Placeholder, Description */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Placeholder</label>
          <Input
            value={field.placeholder || ''}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Enter placeholder text..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Description</label>
          <Input
            value={field.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Help text for this field"
          />
        </div>
      </div>

      {/* Row 3: Default Value, Pattern (for validation) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Default Value</label>
          <Input
            value={field.defaultValue?.toString() || ''}
            onChange={(e) => onChange({ defaultValue: e.target.value })}
            placeholder="Default value"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Pattern (Regex)</label>
          <Input
            value={field.pattern || ''}
            onChange={(e) => onChange({ pattern: e.target.value })}
            placeholder="^[a-zA-Z]+$"
          />
        </div>
      </div>

      {/* Min/Max for number and text types */}
      {supportsMinMax && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              {field.type === 'number' ? 'Min Value' : 'Min Length'}
            </label>
            <Input
              type="number"
              value={field.min ?? ''}
              onChange={(e) => onChange({ min: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              {field.type === 'number' ? 'Max Value' : 'Max Length'}
            </label>
            <Input
              type="number"
              value={field.max ?? ''}
              onChange={(e) => onChange({ max: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="100"
            />
          </div>
        </div>
      )}

      {/* Options for select/multiselect */}
      {supportsOptions && (
        <div>
          <label className="block text-xs font-medium mb-1">
            Options (one per line)
          </label>
          <Textarea
            value={(field.options || []).join('\n')}
            onChange={(e) => onChange({ options: e.target.value.split('\n').filter(Boolean) })}
            placeholder="Option 1&#10;Option 2&#10;Option 3"
            className="min-h-[60px]"
          />
        </div>
      )}

      {/* Row 4: Required checkbox and Remove button */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          Required field
        </label>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onRemove}
          className="flex items-center gap-1"
        >
          <TrashIcon className="h-4 w-4" />
          Remove
        </Button>
      </div>
    </div>
  );
};

export default InputNodeConfig;
