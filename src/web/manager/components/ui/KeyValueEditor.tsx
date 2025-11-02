import React from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { PlusIcon, TrashIcon } from './Icons';

interface KeyValueEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  label?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  value,
  onChange,
  disabled = false,
  label,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
}) => {
  const entries = Object.entries(value);

  const handleAdd = () => {
    onChange({ ...value, '': '' });
  };

  const handleRemove = (key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    const newValue = { ...value };
    const val = newValue[oldKey];
    delete newValue[oldKey];
    newValue[newKey] = val;
    onChange(newValue);
  };

  const handleValueChange = (key: string, newVal: string) => {
    onChange({ ...value, [key]: newVal });
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}

      {entries.length === 0 && !disabled && (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          No variables. Click "Add Variable" to add one.
        </div>
      )}

      {entries.length > 0 && (
        <div className="border rounded-md">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-2 text-xs font-medium">Key</th>
                <th className="text-left p-2 text-xs font-medium">Value</th>
                {!disabled && <th className="w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, val], index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">
                    <Input
                      value={key}
                      onChange={(e) => handleKeyChange(key, e.target.value)}
                      placeholder={keyPlaceholder}
                      disabled={disabled}
                      className="font-mono text-sm"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={val}
                      onChange={(e) => handleValueChange(key, e.target.value)}
                      placeholder={valuePlaceholder}
                      disabled={disabled}
                      className="font-mono text-sm"
                    />
                  </td>
                  {!disabled && (
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => handleRemove(key)}
                        className="p-2 hover:bg-destructive/10 text-destructive rounded transition-colors"
                        title="Remove"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!disabled && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      )}
    </div>
  );
};
