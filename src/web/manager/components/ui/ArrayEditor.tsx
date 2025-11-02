import React from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { PlusIcon, TrashIcon } from './Icons';

interface ArrayEditorProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

export const ArrayEditor: React.FC<ArrayEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter value',
  disabled = false,
  label,
}) => {
  const handleAdd = () => {
    onChange([...value, '']);
  };

  const handleRemove = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const handleChange = (index: number, newVal: string) => {
    const newValue = [...value];
    newValue[index] = newVal;
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium">{label}</label>}

      {value.length === 0 && !disabled && (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          No items. Click "Add Item" to add one.
        </div>
      )}

      {value.map((item, index) => (
        <div key={index} className="flex gap-2 items-center">
          <div className="flex-1">
            <Input
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="p-2 hover:bg-destructive/10 text-destructive rounded transition-colors"
              title="Remove"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {!disabled && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      )}
    </div>
  );
};
