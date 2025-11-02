import React from 'react';
import type { InputField } from '../services/api';
import { Input } from './ui/Input';

interface DynamicFieldProps {
  field: InputField;
  value: any;
  onChange: (value: any) => void;
}

const DynamicField: React.FC<DynamicFieldProps> = ({ field, value, onChange }) => {
  const { name, type, label, placeholder, required, options, default: defaultValue } = field;

  // Use default value if value is undefined
  const currentValue = value !== undefined ? value : defaultValue;

  switch (type) {
    case 'text':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
          )}
          <Input
            type="text"
            value={currentValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full"
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
          )}
          <textarea
            value={currentValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            rows={4}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      );

    case 'dropdown':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
          )}
          <select
            value={currentValue || ''}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select an option</option>
            {options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    case 'checkbox':
      return (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={currentValue === true}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4"
          />
          <label className="text-sm font-medium">{label}</label>
        </div>
      );

    case 'number':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <Input
            type="number"
            value={currentValue || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder}
            required={required}
            className="w-full"
          />
        </div>
      );

    case 'multiselect':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
          )}
          <div className="border border-border rounded-md p-2 max-h-40 overflow-y-auto bg-background">
            {options?.map((option) => (
              <label key={option} className="flex items-center gap-2 p-1 hover:bg-muted cursor-pointer rounded">
                <input
                  type="checkbox"
                  checked={Array.isArray(currentValue) && currentValue.includes(option)}
                  onChange={(e) => {
                    const currentArray = Array.isArray(currentValue) ? currentValue : [];
                    if (e.target.checked) {
                      onChange([...currentArray, option]);
                    } else {
                      onChange(currentArray.filter((v: string) => v !== option));
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case 'filepath':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
          )}
          <Input
            type="text"
            value={currentValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "/path/to/file"}
            required={required}
            className="w-full font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter a file or directory path
          </p>
        </div>
      );

    default:
      return null;
  }
};

export default DynamicField;
