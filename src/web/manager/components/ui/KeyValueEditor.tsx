/**
 * KeyValueEditor Component
 *
 * A dynamic key-value pair editor that allows users to manage environment variables,
 * configuration settings, or any key-value data structure. Provides an intuitive table-based
 * interface with inline editing, add/remove capabilities, and full keyboard navigation.
 *
 * ## Features
 * - Interactive table-based UI for key-value pair management
 * - Add new key-value pairs with a single click
 * - Remove individual pairs with confirmation-free delete
 * - Inline editing of both keys and values using Input components
 * - Empty state message when no pairs exist
 * - Customizable placeholders for keys and values
 * - Optional label for the entire editor
 * - Disabled state that prevents all modifications
 * - Monospace font for keys and values for better readability
 * - Full width "Add Variable" button for easy access
 *
 * ## Key-Value Pair Management
 * The component manages a `Record<string, string>` data structure:
 * - **Add**: Creates a new pair with empty key and value ('')
 * - **Remove**: Deletes a pair by key, triggering onChange with updated object
 * - **Change Key**: Renames a key while preserving its value, updates object structure
 * - **Change Value**: Updates the value for a given key, preserves object structure
 * - **Uniqueness**: Keys can be duplicated during editing (no automatic deduplication)
 * - **Empty Keys**: The component allows empty string keys temporarily during editing
 *
 * ## State Management
 * This is a controlled component that requires parent state management:
 * - Parent must provide current `value` (Record<string, string>)
 * - Parent must handle `onChange` callback to update state
 * - All modifications immediately trigger onChange with new complete object
 * - Component does not maintain internal state for the key-value pairs
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with a structured layout:
 * - **Outer container**: Space-y-2 for vertical spacing
 * - **Table**: Bordered, rounded container with semantic header styling
 * - **Header row**: Secondary background (bg-secondary/50) with uppercase labels
 * - **Input cells**: Full width inputs with monospace font
 * - **Delete button**: Hover effect with destructive color on interaction
 * - **Empty state**: Centered text with dashed border indicating actionable area
 * - **Add button**: Full width secondary button with plus icon
 *
 * When disabled, the editor:
 * - Hides all delete buttons
 * - Hides the "Add Variable" button
 * - Disables all Input fields (via Input component's disabled prop)
 * - Does not show empty state message
 *
 * ## Common Usage Patterns
 * The KeyValueEditor is typically used for:
 * - Environment variable configuration in agent/skill settings
 * - HTTP headers management for API integrations
 * - Custom metadata or tag editing
 * - Configuration key-value storage
 * - Form fields that require dynamic key-value inputs
 *
 * @example
 * // Basic usage with controlled state
 * const [envVars, setEnvVars] = useState({ NODE_ENV: 'production' });
 * <KeyValueEditor
 *   value={envVars}
 *   onChange={setEnvVars}
 *   label="Environment Variables"
 * />
 *
 * @example
 * // Custom placeholders for specific use case
 * <KeyValueEditor
 *   value={headers}
 *   onChange={setHeaders}
 *   label="HTTP Headers"
 *   keyPlaceholder="Header-Name"
 *   valuePlaceholder="header value"
 * />
 *
 * @example
 * // Disabled/read-only mode for viewing
 * <KeyValueEditor
 *   value={config}
 *   onChange={() => {}}
 *   disabled
 *   label="Configuration (Read-Only)"
 * />
 *
 * @example
 * // Starting with empty state
 * const [metadata, setMetadata] = useState({});
 * <KeyValueEditor
 *   value={metadata}
 *   onChange={setMetadata}
 *   label="Custom Metadata"
 *   keyPlaceholder="property"
 *   valuePlaceholder="value"
 * />
 *
 * @example
 * // Integration with form handling
 * const [formData, setFormData] = useState({ vars: {} });
 * const handleVarsChange = (newVars: Record<string, string>) => {
 *   setFormData({ ...formData, vars: newVars });
 * };
 * <KeyValueEditor
 *   value={formData.vars}
 *   onChange={handleVarsChange}
 *   label="Variables"
 * />
 */

import React from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { PlusIcon, TrashIcon } from './Icons';

/**
 * Props for the KeyValueEditor component
 *
 * This component is fully controlled - the parent must manage state via value and onChange.
 * All modifications (add, remove, edit) trigger the onChange callback with a new object.
 */
interface KeyValueEditorProps {
  /**
   * Current key-value pairs to display and edit
   *
   * Represents the data structure being managed. Each key is a string that maps to a string value.
   * Parent component is responsible for maintaining this state.
   *
   * @example { NODE_ENV: 'production', API_URL: 'https://api.example.com' }
   */
  value: Record<string, string>;

  /**
   * Callback fired when the key-value pairs change
   *
   * Receives the complete updated Record<string, string> object after any modification:
   * - Adding a new pair (with empty key and value)
   * - Removing an existing pair
   * - Changing a key name (old key deleted, new key added with same value)
   * - Changing a value (key preserved, value updated)
   *
   * Parent should update their state with this new value.
   *
   * @param value - The new complete key-value object after modification
   */
  onChange: (value: Record<string, string>) => void;

  /**
   * Whether the editor is in read-only/disabled mode
   *
   * When true:
   * - All Input fields are disabled
   * - Delete buttons are hidden
   * - "Add Variable" button is hidden
   * - Empty state message is hidden
   *
   * Use this for viewing existing configuration without modification.
   *
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional label displayed above the editor
   *
   * Provides context for what key-value pairs are being edited.
   * Rendered as a medium-weight text with bottom margin.
   *
   * @example "Environment Variables"
   * @example "HTTP Headers"
   * @example "Custom Metadata"
   */
  label?: string;

  /**
   * Placeholder text for key input fields
   *
   * Shown when a key field is empty. Typically uppercase or follows
   * naming convention for the specific use case.
   *
   * @default 'KEY'
   */
  keyPlaceholder?: string;

  /**
   * Placeholder text for value input fields
   *
   * Shown when a value field is empty. Typically lowercase to distinguish
   * from key placeholder.
   *
   * @default 'value'
   */
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

  /**
   * Adds a new key-value pair with empty strings
   *
   * Creates a new entry with both key and value set to empty string ('').
   * User can then edit the key and value inline. Triggers onChange with
   * the updated object including the new empty pair.
   */
  const handleAdd = () => {
    onChange({ ...value, '': '' });
  };

  /**
   * Removes a key-value pair by key
   *
   * Deletes the specified key from the object and triggers onChange with
   * the updated object. Uses object spread and delete to create new object.
   *
   * @param key - The key of the pair to remove
   */
  const handleRemove = (key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  };

  /**
   * Renames a key while preserving its value
   *
   * Removes the old key and adds a new key with the same value. This allows
   * users to edit key names inline. Triggers onChange with updated object.
   * Note: If newKey already exists, its value will be overwritten.
   *
   * @param oldKey - The current key to rename
   * @param newKey - The new key name
   */
  const handleKeyChange = (oldKey: string, newKey: string) => {
    const newValue = { ...value };
    const val = newValue[oldKey];
    delete newValue[oldKey];
    newValue[newKey] = val;
    onChange(newValue);
  };

  /**
   * Updates the value for a given key
   *
   * Modifies the value associated with the specified key and triggers onChange
   * with the updated object. Preserves all other key-value pairs.
   *
   * @param key - The key whose value to update
   * @param newVal - The new value to set
   */
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
