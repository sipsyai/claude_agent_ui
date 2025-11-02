# Content Manager

**Source:** https://docs.strapi.io/cms/features/content-manager
**Downloaded:** 2025-10-31

---

# Content Manager | Strapi 5 Documentation

## Overview

The Content Manager serves as Strapi's interface for browsing and editing entries. It's accessible through the admin panel's main navigation and enables users to create and manage content.

**Minimum Requirements:** "Configure view" permissions in Roles > Plugins - Content Manager
**Availability:** Both Development and Production environments

The Content Manager displays collection and single content-types created via the Content-type Builder, organized into two categories:

- **Collection Types:** Manage multiple entries with two interfaces:
  - List view: Displays all entries in a table format
  - Edit view: Allows management of individual entries

- **Single Types:** Contain only one entry with no list view

*Tip: Use search icons to find content-types quickly. For collections, the Filters button applies condition-based filters.*

## Configuration

### Configuring the List View

#### Temporary Configuration

Temporary settings reset upon page refresh or navigation away from Content Manager. To configure:

1. Click the settings button
2. Toggle checkboxes to show/hide fields in the table display

#### Permanent & Advanced Configuration

Access additional options by clicking settings then **Configure the view**:

**Settings Area:**

| Setting | Description |
|---------|-------------|
| Enable search | Toggle search functionality |
| Enable filters | Toggle filter availability |
| Enable bulk actions | Toggle multiple selection checkboxes |
| Entries per page | Choose entries displayed per page |
| Default sort attribute | Select default sorting field |
| Default sort order | Choose sorting type |

**View Area:**

- Add/remove fields from the table
- Reorder fields via drag-and-drop
- Configure field-specific settings (label, sort capability)

*Note: Relational fields display only one field per relation and can display value counters if multiple values exist.*

### Configuring the Edit View

**Settings Area:**
- Define the entry title field from available options

**View Area:**
- Add/remove fields
- Reorder fields
- Configure individual field settings:
  - Label
  - Description
  - Placeholder
  - Editable status
  - Display size
  - Entry title (relational fields only)

*Caution: Component field settings are managed through the component's own configuration page.*

## Usage

### Creating & Writing Content

To create or edit content:

1. Click **Create new entry** or access an existing entry's edit view
2. Fill fields according to the defined schema

**Field Types & Instructions:**

| Field Type | Instructions |
|-----------|--------------|
| Text | Enter content in the textbox |
| Rich text (Markdown) | Write in Markdown with formatting options and preview/edit toggle |
| Rich text (Blocks) | Use block-based editing with live rendering and formatting toolbar |
| Number | Enter numbers with increment/decrement arrows |
| Date | Click to use calendar picker or type date/time |
| Media | Select from Media Library or upload new files |
| Relation | Choose entry from dropdown list |
| Boolean | Select TRUE or FALSE |
| JSON | Enter valid JSON format |
| Email | Enter complete email address |
| Password | Enter password; toggle visibility icon to display |
| Enumeration | Select from predefined dropdown options |
| UID | Write unique identifier or auto-generate using button |

*New entries are only created after content is written and saved.*

#### Components

**Non-repeatable Components:**
- Single use combination of fields
- Click add button to display fields
- Click delete button to remove entirely

**Repeatable Components:**
- Allow multiple entries following the same field combination
- Click add button and fill fields
- Click **Add an entry** for additional entries
- Use drag & drop button to reorder
- Use delete button to remove individual entries

*Component entry order matters for how end users view content.*

#### Dynamic Zones

Dynamic zones combine multiple components:

1. Click **Add a component to [zone name]**
2. Select a component from available options
3. Fill component fields

Reorder or delete components using buttons in the top right corner. Keyboard support available: Tab to focus, Space on drag button, arrow keys to reorder, Space to drop.

#### Relational Fields

Relational fields establish connections between content-types.

**One-choice Relations** (many-to-one, one-to-one, one-way):
- Click dropdown and select one entry
- Click delete button to remove selection

**Multiple-choice Relations** (many-to-many, one-to-many, many-ways):
- Click dropdown and select entries (repeat as needed)
- Click cross button to remove entries
- Use drag button to reorder selected entries
- Click **Load more** to display additional entries
- Type to search for specific entries within dropdown

*Features: Click entry names to edit inline. Blue/green dots indicate draft/published status when Draft & Publish is enabled.*

### Deleting Content

To delete entries:

1. In edit view, click the menu button (top right)
2. Click **Delete document** button
3. Confirm deletion in popup window

*If Internationalization is enabled, choose between deleting all locales or current locale only.*

From list view: Click the menu button on the entry's row and select **Delete document**.

---

**Tags:** admin-panel, content-manager, list-view, edit-view, component, dynamic-zone, relational-field
