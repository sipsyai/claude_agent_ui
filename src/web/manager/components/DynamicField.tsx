/**
 * @file DynamicField.tsx
 * @description Generic dynamic form field component that renders different input types based on field
 * configuration. Used in AgentConfigModal and SkillCreationModal for dynamic form generation.
 *
 * ## Features
 * - Support for 7 field types (text, textarea, dropdown, checkbox, number, multiselect, filepath)
 * - Automatic default value handling
 * - Required field validation indicators
 * - Optional field descriptions with muted styling
 * - Type-safe value conversion (string to number for number fields)
 * - Consistent styling across all field types
 * - Accessible labels with required field markers
 *
 * ## Field Type Handling
 * The component dynamically renders different input controls based on the `field.type` property:
 *
 * ### 1. text
 * - Single-line text input using Input component
 * - Supports placeholder, required validation
 * - Full-width input with consistent styling
 * - Value stored as string
 *
 * ### 2. textarea
 * - Multi-line text input for longer content
 * - 4 rows default height with scrollable overflow
 * - Supports placeholder, required validation
 * - Native textarea element with custom styling
 * - Value stored as string
 *
 * ### 3. dropdown
 * - Single-selection dropdown using select element
 * - Options provided via `field.options` array
 * - Includes empty "Select an option" placeholder option
 * - Supports required validation
 * - Value stored as string (selected option)
 *
 * ### 4. checkbox
 * - Boolean toggle with label on right
 * - Compact layout with flex items-center
 * - No required field support (optional by nature)
 * - Value stored as boolean (true/false)
 *
 * ### 5. number
 * - Numeric input using Input component with type="number"
 * - Automatically converts string to number on change
 * - Supports placeholder, required validation
 * - Value stored as number
 *
 * ### 6. multiselect
 * - Multiple-selection checkbox list
 * - Options displayed in scrollable container (max-height 10rem)
 * - Each option rendered as checkbox with label
 * - Array manipulation: adds selected, removes deselected
 * - Supports required validation
 * - Value stored as string array
 *
 * ### 7. filepath
 * - File path input with monospace font
 * - Default placeholder: "/path/to/file"
 * - Includes helper text: "Enter a file or directory path"
 * - Supports placeholder, required validation
 * - Value stored as string
 *
 * ## Value Rendering
 * The component handles value rendering with default value fallback:
 *
 * ### Default Value Handling
 * - If `value` prop is undefined, uses `field.default` as fallback
 * - Default value specified in InputField schema
 * - Allows pre-population of form fields with sensible defaults
 * - Formula: `currentValue = value !== undefined ? value : defaultValue`
 *
 * ### Type Conversion
 * Different field types convert values appropriately:
 * - **text, textarea, dropdown, filepath**: String values, empty string fallback
 * - **checkbox**: Boolean value, strict equality check (`=== true`)
 * - **number**: Automatic conversion via `Number(e.target.value)` on change
 * - **multiselect**: Array validation (`Array.isArray()`) with empty array fallback
 *
 * ### Empty State Handling
 * - Text-based fields: `currentValue || ''` ensures empty string (not null/undefined)
 * - Checkbox: Strict boolean check ensures false for undefined/null
 * - Multiselect: Array.isArray check with empty array fallback prevents errors
 *
 * ## Dynamic Form Support
 * The component integrates seamlessly with dynamic form systems:
 *
 * ### Schema-Driven Rendering
 * - Field configuration passed via `field` prop (InputField interface)
 * - All field metadata in single object (name, type, label, description, etc.)
 * - Loop through field array to render complete form
 *
 * ### Form State Management
 * - Controlled component pattern with `value` and `onChange` props
 * - Parent component manages form state (typically object with field names as keys)
 * - onChange callback receives typed value (string, number, boolean, or array)
 * - Parent updates state: `onChange={(val) => setFormState({...formState, [field.name]: val})}`
 *
 * ### Validation Integration
 * - Required field indicator (red asterisk) displayed automatically
 * - Required attribute passed to input elements for HTML5 validation
 * - Parent component can implement additional validation logic
 * - Error states managed by parent (not within DynamicField)
 *
 * ## Styling Behavior
 * The component uses consistent Tailwind CSS styling:
 * - **Container**: mb-4 spacing between fields
 * - **Labels**: text-sm font-medium mb-2, block display
 * - **Required Indicator**: text-red-500 asterisk after label
 * - **Description**: text-xs text-muted-foreground mb-2 (optional)
 * - **Inputs**: w-full, px-3 py-2, border border-border, rounded-md
 * - **Focus State**: focus:outline-none focus:ring-2 focus:ring-primary
 * - **Theme Colors**: bg-background, text-foreground
 * - **Checkbox Layout**: flex items-center gap-2 for horizontal alignment
 * - **Multiselect**: border rounded-md p-2, max-h-40 overflow-y-auto
 * - **Multiselect Options**: hover:bg-muted, cursor-pointer, rounded
 * - **Filepath**: font-mono text-sm for monospace path display
 *
 * @example
 * // Text input field
 * const textField: InputField = {
 *   name: "username",
 *   type: "text",
 *   label: "Username",
 *   description: "Enter your unique username",
 *   placeholder: "john_doe",
 *   required: true
 * };
 *
 * <DynamicField
 *   field={textField}
 *   value={formState.username}
 *   onChange={(val) => setFormState({...formState, username: val})}
 * />
 *
 * @example
 * // Dropdown field with options
 * const dropdownField: InputField = {
 *   name: "role",
 *   type: "dropdown",
 *   label: "User Role",
 *   description: "Select the user's role in the system",
 *   options: ["Admin", "Developer", "Viewer"],
 *   default: "Viewer",
 *   required: true
 * };
 *
 * <DynamicField
 *   field={dropdownField}
 *   value={formState.role}
 *   onChange={(val) => setFormState({...formState, role: val})}
 * />
 *
 * @example
 * // Multiselect field for multiple options
 * const multiselectField: InputField = {
 *   name: "permissions",
 *   type: "multiselect",
 *   label: "Permissions",
 *   description: "Select all applicable permissions",
 *   options: ["Read", "Write", "Delete", "Execute"],
 *   default: ["Read"],
 *   required: false
 * };
 *
 * <DynamicField
 *   field={multiselectField}
 *   value={formState.permissions}
 *   onChange={(val) => setFormState({...formState, permissions: val})}
 * />
 *
 * @example
 * // Number input with type conversion
 * const numberField: InputField = {
 *   name: "port",
 *   type: "number",
 *   label: "Port Number",
 *   placeholder: "8080",
 *   default: 3000,
 *   required: true
 * };
 *
 * <DynamicField
 *   field={numberField}
 *   value={formState.port}
 *   onChange={(val) => setFormState({...formState, port: val})}
 * />
 * // Note: onChange receives number type, not string
 *
 * @example
 * // Checkbox field for boolean values
 * const checkboxField: InputField = {
 *   name: "enabled",
 *   type: "checkbox",
 *   label: "Enable Feature",
 *   default: false
 * };
 *
 * <DynamicField
 *   field={checkboxField}
 *   value={formState.enabled}
 *   onChange={(val) => setFormState({...formState, enabled: val})}
 * />
 *
 * @example
 * // Filepath input with monospace styling
 * const filepathField: InputField = {
 *   name: "configPath",
 *   type: "filepath",
 *   label: "Configuration File",
 *   description: "Path to the configuration file",
 *   placeholder: "/etc/app/config.json",
 *   required: true
 * };
 *
 * <DynamicField
 *   field={filepathField}
 *   value={formState.configPath}
 *   onChange={(val) => setFormState({...formState, configPath: val})}
 * />
 *
 * @example
 * // Dynamic form generation from field array
 * const fields: InputField[] = [
 *   { name: "name", type: "text", label: "Name", required: true },
 *   { name: "description", type: "textarea", label: "Description" },
 *   { name: "priority", type: "dropdown", label: "Priority", options: ["Low", "Medium", "High"], default: "Medium" },
 *   { name: "enabled", type: "checkbox", label: "Enabled", default: true }
 * ];
 *
 * const [formState, setFormState] = useState({});
 *
 * {fields.map((field) => (
 *   <DynamicField
 *     key={field.name}
 *     field={field}
 *     value={formState[field.name]}
 *     onChange={(val) => setFormState({...formState, [field.name]: val})}
 *   />
 * ))}
 */

import React from 'react';
import type { InputField } from '../services/api';
import { Input } from './ui/Input';

/**
 * Props for the DynamicField component
 *
 * @interface DynamicFieldProps
 * @property {InputField} field - Field configuration object defining type, label, validation, etc.
 * @property {any} value - Current value of the field (type varies by field.type)
 * @property {(value: any) => void} onChange - Callback invoked when field value changes, receives typed value
 */
interface DynamicFieldProps {
  field: InputField;
  value: any;
  onChange: (value: any) => void;
}

/**
 * DynamicField Component
 *
 * Generic form field component that renders different input types based on field configuration.
 * Supports text, textarea, dropdown, checkbox, number, multiselect, and filepath inputs.
 *
 * @param {DynamicFieldProps} props - Component props
 * @returns {React.ReactElement | null} Rendered field component or null for unknown types
 */
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

DynamicField.displayName = 'DynamicField';

export default DynamicField;
