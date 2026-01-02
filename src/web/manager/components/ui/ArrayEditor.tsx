/**
 * ArrayEditor Component
 *
 * A dynamic array editor that allows users to add, remove, and edit string values in a list.
 * Provides an intuitive interface for managing collections of strings with individual input
 * fields for each item. Built with accessibility and user experience in mind.
 *
 * ## Features
 * - Add new items to the array (initialized as empty strings)
 * - Remove individual items from the array by index
 * - Edit each array item independently with separate input fields
 * - Visual empty state when no items exist
 * - Optional label for the entire array field
 * - Full disabled state support (hides add/remove controls)
 * - Customizable placeholder text for input fields
 * - Controlled component pattern with onChange callbacks
 * - Smooth hover transitions on remove buttons
 *
 * ## Value Handling
 * The component operates as a fully controlled component:
 * - **value prop**: Array of strings representing the current list items
 * - **onChange callback**: Invoked with the new array whenever items are added, removed, or modified
 * - **Immutability**: All operations create new arrays rather than mutating existing ones
 * - **Empty items**: New items are initialized as empty strings and can be filled by the user
 *
 * When a user adds an item, the component appends an empty string to the array.
 * When removing an item, the component filters out that index position.
 * When editing, the component replaces the value at the specific index.
 *
 * ## Add/Remove Item Functionality
 * **Adding Items:**
 * - Click the "Add Item" button at the bottom of the list
 * - A new empty string is appended to the value array
 * - onChange is called with the updated array
 * - The button is hidden when disabled prop is true
 *
 * **Removing Items:**
 * - Click the trash icon button next to any item
 * - The item at that index is removed from the array
 * - onChange is called with the filtered array
 * - Remove buttons are hidden when disabled prop is true
 * - Hover effect: background changes to destructive/10 with smooth transition
 *
 * ## Callbacks
 * **onChange(value: string[])**
 * - Called whenever the array is modified (add, remove, or edit)
 * - Receives the complete new array as its parameter
 * - Always receives a new array instance (not mutated)
 * - Should be used to update parent component state in controlled pattern
 *
 * The onChange callback is invoked in three scenarios:
 * 1. When adding an item: `onChange([...value, ''])`
 * 2. When removing an item: `onChange(value.filter((_, i) => i !== index))`
 * 3. When editing an item: `onChange([...value.slice(0, index), newValue, ...value.slice(index + 1)])`
 *
 * ## Styling Behavior
 * The component uses Tailwind CSS with:
 * - **Container**: Vertical spacing with space-y-2
 * - **Label**: Block display, small text, medium font weight
 * - **Empty State**: Centered text, dashed border, rounded, padding, muted foreground color
 * - **Item Rows**: Flex layout with gap-2, items centered
 * - **Input Fields**: Flex-1 to fill available space
 * - **Remove Buttons**: Padding, hover background (destructive/10), destructive text color, rounded, smooth transitions
 * - **Add Button**: Full width (w-full), secondary variant, small size, with icon
 *
 * @example
 * // Basic usage with controlled state
 * const [items, setItems] = useState(['Item 1', 'Item 2']);
 * <ArrayEditor value={items} onChange={setItems} />
 *
 * @example
 * // With label and custom placeholder
 * const [tags, setTags] = useState([]);
 * <ArrayEditor
 *   value={tags}
 *   onChange={setTags}
 *   label="Tags"
 *   placeholder="Enter tag name"
 * />
 *
 * @example
 * // With initial values
 * const [skills, setSkills] = useState(['JavaScript', 'TypeScript', 'React']);
 * <ArrayEditor
 *   value={skills}
 *   onChange={setSkills}
 *   label="Skills"
 *   placeholder="Enter skill"
 * />
 *
 * @example
 * // Disabled state (read-only view)
 * const [items, setItems] = useState(['Value 1', 'Value 2']);
 * <ArrayEditor
 *   value={items}
 *   onChange={setItems}
 *   disabled={true}
 *   label="Read-only Items"
 * />
 *
 * @example
 * // Empty state (no items initially)
 * const [items, setItems] = useState([]);
 * <ArrayEditor
 *   value={items}
 *   onChange={setItems}
 *   label="Environment Variables"
 *   placeholder="Enter variable value"
 * />
 *
 * @example
 * // Form integration with validation
 * const [emails, setEmails] = useState(['admin@example.com']);
 * const handleChange = (newEmails: string[]) => {
 *   // Validate email format before updating
 *   const validEmails = newEmails.filter(e => e === '' || /\S+@\S+\.\S+/.test(e));
 *   setEmails(validEmails);
 * };
 * <ArrayEditor
 *   value={emails}
 *   onChange={handleChange}
 *   label="Email Addresses"
 *   placeholder="user@example.com"
 * />
 *
 * @example
 * // Callback with side effects
 * const [urls, setUrls] = useState([]);
 * const handleUrlsChange = (newUrls: string[]) => {
 *   setUrls(newUrls);
 *   console.log('URLs updated:', newUrls.length);
 *   // Trigger validation, save to localStorage, etc.
 * };
 * <ArrayEditor value={urls} onChange={handleUrlsChange} />
 */

import React from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { PlusIcon, TrashIcon } from './Icons';

/**
 * Props for the ArrayEditor component
 */
interface ArrayEditorProps {
  /**
   * The current array of string values to display and edit.
   * This component is fully controlled - the parent must manage state.
   *
   * Each string in the array is rendered as a separate input field.
   * Empty strings are valid and represent blank inputs that users can fill.
   *
   * **Important:** Always maintain a proper array (not null/undefined).
   * Use an empty array `[]` when there are no items.
   *
   * @example
   * value={['Item 1', 'Item 2', '']}
   */
  value: string[];

  /**
   * Callback function invoked when the array is modified.
   * Receives the complete new array as its parameter.
   *
   * This is called when:
   * - Adding a new item (appends empty string)
   * - Removing an item (filters out the item at index)
   * - Editing an item (updates value at specific index)
   *
   * The callback always receives a new array instance (not mutated).
   *
   * @param value - The new array after the modification
   *
   * @example
   * onChange={(newArray) => setItems(newArray)}
   */
  onChange: (value: string[]) => void;

  /**
   * Placeholder text displayed in empty input fields.
   * Applied to all input fields in the array.
   *
   * @default 'Enter value'
   *
   * @example
   * placeholder="Enter email address"
   */
  placeholder?: string;

  /**
   * When true, the component becomes read-only:
   * - Hides the "Add Item" button
   * - Hides all remove (trash) buttons
   * - Disables all input fields
   * - Prevents any modifications to the array
   *
   * Use this for displaying arrays in a non-editable context.
   *
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional label text displayed above the array editor.
   * Rendered as a block element with medium font weight.
   *
   * When not provided, no label is shown.
   *
   * @example
   * label="Environment Variables"
   */
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

ArrayEditor.displayName = 'ArrayEditor';
