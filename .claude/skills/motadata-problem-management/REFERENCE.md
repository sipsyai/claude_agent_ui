# Motadata Problem Management - Technical Reference

Comprehensive technical reference for Motadata ITSM Problem Management UI automation.

## Table of Contents

1. [Base URLs and Endpoints](#base-urls-and-endpoints)
2. [Authentication Details](#authentication-details)
3. [Navigation Paths](#navigation-paths)
4. [Element Selectors](#element-selectors)
5. [Form Field Mappings](#form-field-mappings)
6. [Data Structures](#data-structures)
7. [Validation Rules](#validation-rules)
8. [API Endpoints (Reference)](#api-endpoints-reference)

---

## Base URLs and Endpoints

### Primary URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://distibilisim.motadataserviceops.com` |
| Login Page | `https://distibilisim.motadataserviceops.com/login` |
| Admin Panel | `https://distibilisim.motadataserviceops.com/admin` |

### Problem Management URLs

| Section | Direct URL |
|---------|-----------|
| Problems List | `/admin/problem-management/problems` |
| New Problem | `/admin/problem-management/problems/new` |
| Problem Templates | `/admin/problem-management/templates` |
| Problem Categories | `/admin/problem-management/categories` |
| Problem Status | `/admin/problem-management/status` |
| Problem Form | `/admin/problem-management/form` |
| Custom Rules | `/admin/problem-management/custom-rules` |
| Transition Models | `/admin/problem-management/models` |

---

## Authentication Details

### Login Form Structure

**URL**: `/login`

**Form Fields**:
```html
<form id="login-form">
  <input type="text" name="username" placeholder="Username" />
  <input type="password" name="password" placeholder="Password" />
  <button type="submit">Login</button>
</form>
```

**Common Selectors**:
```css
/* Username field */
input[name="username"]
input[type="text"][placeholder*="Username"]
#username

/* Password field */
input[name="password"]
input[type="password"]
#password

/* Login button */
button[type="submit"]
button:has-text("Login")
.login-button
```

**Success Indicators**:
- Redirect to `/dashboard` or `/admin`
- Presence of logout button
- User profile menu visible
- Absence of login form

**Error Indicators**:
- Error message div: `.error-message`, `.alert-danger`
- Text content: "Invalid credentials", "Login failed"
- Red border on input fields

### Session Management

**Session Cookie**: `JSESSIONID` or `motadata_session`

**Session Timeout**: Typically 30-60 minutes of inactivity

**Timeout Detection**:
- Redirect to `/login` with `?expired=true`
- Modal: "Session Expired"
- 401 Unauthorized responses

---

## Navigation Paths

### Menu Structure

```
Admin (Top Navigation)
└── Problem Management
    ├── Problems (List & Create)
    ├── Problem Templates
    ├── Problem Categories
    │   └── Problem (Tab)
    ├── Problem Status
    │   └── Problem (Tab)
    ├── Problem Form
    ├── Problem Custom Rules
    └── Problem Model
```

### Navigation Selectors

**Admin Menu**:
```css
/* Admin link in top nav */
a[href="/admin"]
nav a:has-text("Admin")
.nav-item:has-text("Admin")

/* Problem Management submenu */
a[href*="problem-management"]
.submenu a:has-text("Problem Management")
```

**Problem Management Sections**:
```css
/* Problems */
a[href="/admin/problem-management/problems"]

/* Templates */
a[href="/admin/problem-management/templates"]

/* Categories */
a[href="/admin/problem-management/categories"]

/* Status */
a[href="/admin/problem-management/status"]

/* Form */
a[href="/admin/problem-management/form"]

/* Custom Rules */
a[href="/admin/problem-management/custom-rules"]

/* Models */
a[href="/admin/problem-management/models"]
```

---

## Element Selectors

### Common UI Elements

#### Buttons

```css
/* Primary action buttons */
button.btn-primary
button:has-text("Create")
button:has-text("Save")
button:has-text("Submit")

/* Secondary buttons */
button.btn-secondary
button:has-text("Cancel")
button:has-text("Close")

/* Icon buttons */
button.btn-icon
.action-button

/* Specific actions */
button:has-text("Add Category")
button:has-text("Add Status")
button:has-text("Create Template")
button:has-text("Create Model")
```

#### Tables

```css
/* Table container */
.data-table
table.problem-table

/* Table rows */
tr.data-row
tbody tr

/* Action cells */
td.actions
.action-icons

/* Edit icon */
.icon-edit
button[title="Edit"]
a:has-text("Edit")

/* Delete icon */
.icon-delete
button[title="Delete"]
a:has-text("Delete")

/* Enable/Disable toggle */
.toggle-switch
input[type="checkbox"].enable-toggle
```

#### Modals/Dialogs

```css
/* Modal container */
.modal
.dialog
.popup

/* Modal header */
.modal-header
.dialog-title

/* Modal body */
.modal-body
.dialog-content

/* Modal footer buttons */
.modal-footer button
button:has-text("Confirm")
button:has-text("OK")
```

#### Form Controls

```css
/* Text inputs */
input[type="text"]
input.form-control

/* Textarea */
textarea
textarea.form-control

/* Dropdowns */
select
.select-wrapper select

/* Checkboxes */
input[type="checkbox"]
.checkbox-input

/* Radio buttons */
input[type="radio"]
.radio-input

/* Date pickers */
input[type="date"]
.datepicker-input

/* DateTime pickers */
input[type="datetime-local"]
.datetime-picker

/* Color pickers */
input[type="color"]
.color-picker
```

#### Toast/Alert Messages

```css
/* Success messages */
.toast-success
.alert-success
.notification-success

/* Error messages */
.toast-error
.alert-danger
.notification-error

/* Warning messages */
.toast-warning
.alert-warning

/* Info messages */
.toast-info
.alert-info
```

---

## Form Field Mappings

### Problem Record Form

**Required Fields** (marked with *):

| Field Label | Input Type | Name Attribute | Selector Examples |
|-------------|------------|----------------|-------------------|
| Subject * | Text | `subject` | `input[name="subject"]`, `#problem-subject` |
| Description * | Textarea | `description` | `textarea[name="description"]`, `#problem-description` |
| Status | Dropdown | `status` | `select[name="status"]`, `#problem-status` |
| Nature of Problem | Dropdown | `nature` | `select[name="nature"]` |
| Known Error | Checkbox | `known_error` | `input[name="known_error"]` |
| Priority | Dropdown | `priority` | `select[name="priority"]` |
| Urgency | Dropdown | `urgency` | `select[name="urgency"]` |
| Impact | Dropdown | `impact` | `select[name="impact"]` |
| Category | Dropdown | `category` | `select[name="category"]` |
| Technician Group | Dropdown | `technician_group` | `select[name="technician_group"]` |
| Assignee | Dropdown | `assignee` | `select[name="assignee"]` |
| Department | Dropdown | `department` | `select[name="department"]` |
| Vendor | Dropdown | `vendor` | `select[name="vendor"]` |
| Company | Dropdown | `company` | `select[name="company"]` |
| Location | Dropdown | `location` | `select[name="location"]` |
| Tags | Multi-select | `tags` | `.tags-input`, `input[name="tags"]` |

**Field Values**:

```javascript
// Priority options
["Critical", "High", "Medium", "Low"]

// Urgency options
["High", "Medium", "Low"]

// Impact options
["High", "Medium", "Low"]

// Nature of Problem
["Proactive", "Reactive"]

// Known Error
[true, false] // Checkbox

// Status options (default)
["New", "Assigned", "In Progress", "Pending", "Resolved", "Closed"]
```

### Problem Template Form

| Field Label | Input Type | Name Attribute | Required |
|-------------|------------|----------------|----------|
| Template Name | Text | `template_name` | Yes |
| Template Technician Access Level | Multi-select | `tech_access_level` | No |
| Template Technician Group Access Level | Multi-select | `group_access_level` | No |
| Template Description | Textarea | `template_description` | Yes |
| Subject | Text | `subject` | Yes |
| Description | Textarea | `description` | Yes |
| Status | Dropdown | `status` | Yes |
| Nature Of Problem | Dropdown | `nature` | Yes |
| Known Error | Checkbox | `known_error` | No |
| Priority | Dropdown | `priority` | Yes |
| Urgency | Dropdown | `urgency` | Yes |
| Impact | Dropdown | `impact` | Yes |
| Category | Dropdown | `category` | Yes |
| Technician Group | Dropdown | `technician_group` | No |
| Assignee | Dropdown | `assignee` | No |
| Department | Dropdown | `department` | No |
| Vendor | Dropdown | `vendor` | No |
| Company | Dropdown | `company` | No |
| Location | Dropdown | `location` | No |
| Tags | Multi-select | `tags` | No |

### Category Form

| Field Label | Input Type | Selector |
|-------------|------------|----------|
| Category Name | Text | `input[name="category_name"]`, `.category-name-input` |
| Parent Category | Dropdown | `select[name="parent_category"]` |
| Description | Textarea | `textarea[name="category_description"]` |
| Icon | Icon picker | `.icon-picker` |
| Color | Color picker | `input[type="color"]` |

### Status Form

| Field Label | Input Type | Selector |
|-------------|------------|----------|
| Status Name | Text | `input[name="status_name"]` |
| Color | Color picker | `input[type="color"]`, `.color-picker` |
| Enable SLA | Checkbox | `input[name="enable_sla"]` |
| Enable UC | Checkbox | `input[name="enable_uc"]` |
| Set as Default | Checkbox | `input[name="is_default"]` |

### Custom Field Configuration

| Property | Input Type | Description |
|----------|------------|-------------|
| Name | Text | Field label displayed on form |
| Hint Text | Text | Placeholder text |
| Default Value | Various | Pre-filled value |
| Required | Checkbox | Make field mandatory |
| Visible | Checkbox | Show/hide field |
| Field Type | Dropdown | Text, Number, Date, Dropdown, etc. |
| Options | Text area | For dropdown/select fields (comma-separated) |

### Transition Model Form

| Field Label | Input Type | Description |
|-------------|------------|-------------|
| Model Name | Text | Unique identifier |
| Module | Dropdown | Always "Problem" |
| Description | Textarea | Workflow overview |
| From State | Dropdown | Source status |
| To State | Dropdown | Target status |
| Condition Groups | Complex | Rules for transition |

---

## Data Structures

### Problem Record Object

```javascript
{
  id: "PRB-001234",
  subject: "Database Server Unresponsive",
  description: "Production database server db-prod-01 is not responding...",
  status: "Investigating",
  nature: "Reactive",
  known_error: false,
  priority: "High",
  urgency: "High",
  impact: "High",
  category: "Database/Server",
  technician_group: "Database Team",
  assignee: "John Doe",
  department: "IT Operations",
  vendor: null,
  company: null,
  location: "Data Center 1",
  tags: ["production", "database", "critical"],
  created_at: "2025-10-29T10:30:00Z",
  updated_at: "2025-10-29T12:15:00Z",
  created_by: "system",
  custom_fields: {
    root_cause: "",
    first_detected: "2025-10-29T09:00:00Z"
  }
}
```

### Template Object

```javascript
{
  id: "TPL-001",
  template_name: "Hardware Failure Template",
  template_description: "Template for hardware failure problems",
  tech_access_level: ["Level 1", "Level 2"],
  group_access_level: ["Hardware Team", "Support Team"],
  defaults: {
    subject: "Hardware Failure - [Device]",
    description: "Hardware device [Device] has failed...",
    status: "New",
    nature: "Reactive",
    priority: "High",
    urgency: "High",
    impact: "Medium",
    category: "Hardware",
    known_error: false
  },
  enabled: true,
  created_at: "2025-10-15T08:00:00Z"
}
```

### Category Hierarchy

```javascript
{
  categories: [
    {
      id: "CAT-001",
      name: "Hardware",
      parent_id: null,
      description: "Hardware-related problems",
      order: 1,
      subcategories: [
        {
          id: "CAT-002",
          name: "Server",
          parent_id: "CAT-001",
          order: 1
        },
        {
          id: "CAT-003",
          name: "Desktop",
          parent_id: "CAT-001",
          order: 2
        }
      ]
    },
    {
      id: "CAT-010",
      name: "Software",
      parent_id: null,
      order: 2,
      subcategories: [...]
    }
  ]
}
```

### Custom Status

```javascript
{
  id: "STS-001",
  name: "Pending Approval",
  color: "#FF9800",
  order: 5,
  enable_sla: true,
  enable_uc: false,
  is_default: false,
  is_system: false
}
```

### Custom Field Definition

```javascript
{
  id: "FLD-001",
  name: "Root Cause Analysis",
  field_type: "textarea",
  hint_text: "Describe the root cause of the problem",
  default_value: "",
  required: true,
  visible: true,
  order: 10,
  options: null, // For select fields only
  validations: {
    min_length: null,
    max_length: 5000,
    pattern: null
  }
}
```

### Transition Model

```javascript
{
  id: "MDL-001",
  name: "Hardware Problem Workflow",
  module: "Problem",
  description: "Standard workflow for hardware problems",
  enabled: true,
  transitions: [
    {
      from_state: "New",
      to_state: "Assigned",
      conditions: [
        {
          field: "assignee",
          operator: "is_not_empty"
        }
      ]
    },
    {
      from_state: "Assigned",
      to_state: "Investigating",
      conditions: []
    },
    // ... more transitions
  ]
}
```

---

## Validation Rules

### Problem Record Validation

**Subject**:
- Required: Yes
- Min length: 5 characters
- Max length: 255 characters
- Pattern: No special validation

**Description**:
- Required: Yes (for most templates)
- Min length: 10 characters
- Max length: 10,000 characters

**Priority, Urgency, Impact**:
- Required: Yes
- Must be one of predefined values

**Category**:
- Required: Yes
- Must exist in category list

**Assignee**:
- Optional
- Must be valid technician if provided
- Must have appropriate permissions

**Technician Group**:
- Optional
- Must be valid group if provided

**Status**:
- Required: Yes
- Must be valid status
- Must follow transition model rules

**Tags**:
- Optional
- Max: 10 tags
- Each tag max length: 50 characters

### Template Validation

**Template Name**:
- Required: Yes
- Must be unique
- Min length: 3 characters
- Max length: 100 characters
- Pattern: Alphanumeric, spaces, hyphens, underscores

**Template Description**:
- Required: Yes
- Min length: 10 characters
- Max length: 500 characters

**Template Fields**:
- Must follow same validation as problem record fields

### Category Validation

**Category Name**:
- Required: Yes
- Must be unique within same level
- Min length: 2 characters
- Max length: 100 characters
- Pattern: Alphanumeric, spaces, hyphens

**Parent Category**:
- Optional (null for root categories)
- Must exist if provided
- Cannot create circular references

**Max Depth**: Typically 3 levels (Category > Subcategory > Sub-subcategory)

### Status Validation

**Status Name**:
- Required: Yes
- Must be unique
- Min length: 2 characters
- Max length: 50 characters
- Pattern: Alphanumeric, spaces

**Color**:
- Required: Yes
- Must be valid hex color code (#RRGGBB)
- Examples: #FF5722, #4CAF50, #2196F3

**SLA Settings**:
- Boolean (true/false)

**Default Status**:
- Only one status can be default
- Setting new default removes previous default

### Custom Field Validation

**Field Name**:
- Required: Yes
- Must be unique
- Min length: 2 characters
- Max length: 100 characters
- Pattern: Alphanumeric, spaces

**Field Type**:
- Required: Yes
- Must be valid type from list

**Options** (for select fields):
- Required if field type is dropdown/multi-select
- Each option max length: 100 characters
- Max options: 100

### Custom Rules Validation

**Resolved Rules**:
- At least one rule must be defined
- Mandatory field selections must be valid fields
- Cannot require non-existent fields

**Closed Rules**:
- Must include "Do not skip Resolved Status" if using sequential workflow
- All approvals must be resolved before closing

**Required Note Rules**:
- Field selections must be valid editable fields

**Worklog Rules**:
- Only one rule can be active at a time

### Transition Model Validation

**Model Name**:
- Required: Yes
- Must be unique
- Min length: 3 characters
- Max length: 100 characters

**Transitions**:
- From State and To State required
- Cannot transition from same state to same state
- Should define complete workflow (no orphaned states)

**Conditions**:
- Field references must be valid
- Operators must be valid for field type
- Values must match field type

---

## API Endpoints (Reference)

Note: Motadata ITSM uses a RESTful API. These endpoints are for reference but the skill uses UI automation.

### Authentication

```
POST /api/v1/auth/login
Body: { username, password }
Response: { token, user, expires_at }
```

### Problems

```
GET    /api/v1/problems              # List problems
GET    /api/v1/problems/:id          # Get problem details
POST   /api/v1/problems              # Create problem
PUT    /api/v1/problems/:id          # Update problem
DELETE /api/v1/problems/:id          # Delete problem
```

### Templates

```
GET    /api/v1/problems/templates    # List templates
GET    /api/v1/problems/templates/:id
POST   /api/v1/problems/templates    # Create template
PUT    /api/v1/problems/templates/:id
DELETE /api/v1/problems/templates/:id
```

### Categories

```
GET    /api/v1/problems/categories
POST   /api/v1/problems/categories
PUT    /api/v1/problems/categories/:id
DELETE /api/v1/problems/categories/:id
POST   /api/v1/problems/categories/import  # Bulk import
```

### Status

```
GET    /api/v1/problems/statuses
POST   /api/v1/problems/statuses
PUT    /api/v1/problems/statuses/:id
DELETE /api/v1/problems/statuses/:id
POST   /api/v1/problems/statuses/reorder
```

### Custom Fields

```
GET    /api/v1/problems/form/fields
POST   /api/v1/problems/form/fields
PUT    /api/v1/problems/form/fields/:id
DELETE /api/v1/problems/form/fields/:id
POST   /api/v1/problems/form/fields/reorder
```

### Custom Rules

```
GET    /api/v1/problems/rules
PUT    /api/v1/problems/rules         # Update all rules
```

### Transition Models

```
GET    /api/v1/problems/models
GET    /api/v1/problems/models/:id
POST   /api/v1/problems/models
PUT    /api/v1/problems/models/:id
DELETE /api/v1/problems/models/:id
```

---

## Selector Patterns by Module

### Problem Records Module

**Problem List Page**:
```css
/* Search box */
input[placeholder*="Search"]
.search-input

/* Filter dropdown */
select.filter-status
select.filter-priority

/* Problem rows */
tr.problem-row
.problem-item

/* Problem ID link */
a.problem-id
td.problem-id a

/* New Problem button */
button:has-text("New Problem")
a[href*="/problems/new"]
```

**Problem Form**:
```css
/* Form container */
form#problem-form
.problem-create-form

/* Submit button */
button[type="submit"]
button:has-text("Create Problem")
button:has-text("Save")

/* Cancel button */
button:has-text("Cancel")
a:has-text("Cancel")
```

### Templates Module

**Template List**:
```css
/* Create button */
button:has-text("Create Template")
.create-template-btn

/* Template row */
tr.template-row
.template-item

/* Enable/Disable toggle */
.template-toggle
input[type="checkbox"][name*="enabled"]

/* Actions */
.template-actions
button[title="Edit"]
button[title="Delete"]
button[title="Duplicate"]
```

**Template Form**:
```css
/* Template name */
input[name="template_name"]
#template-name

/* Template description */
textarea[name="template_description"]

/* Access level selects */
select[name="tech_access_level"]
select[name="group_access_level"]

/* Template content section */
.template-content
.template-defaults
```

### Categories Module

**Category List**:
```css
/* Add category button */
button:has-text("Add Category")
.add-category-btn

/* Category items */
.category-item
li.category

/* Subcategory items */
.subcategory-item
ul.subcategories li

/* Drag handle */
.drag-handle
.reorder-icon

/* Edit icon */
.edit-category
button[title="Edit"]

/* Delete icon */
.delete-category
button[title="Delete"]
```

**Category Form**:
```css
/* Category name input */
input[name="category_name"]
.category-name-input

/* Parent selector */
select[name="parent_category"]

/* Save button */
button:has-text("Save")
button:has-text("Add")
```

### Status Module

**Status List**:
```css
/* Add status link */
a:has-text("Add Status")
button:has-text("Add Status")

/* Status items */
.status-item
tr.status-row

/* Status color indicator */
.status-color
span.color-badge

/* Drag to reorder */
.status-drag-handle
```

**Status Form**:
```css
/* Status name */
input[name="status_name"]

/* Color picker */
input[type="color"]
.color-picker-input

/* Color hex input */
input[name="color_code"]
input[placeholder*="hex"]

/* SLA checkbox */
input[name="enable_sla"]
.sla-toggle

/* Default checkbox */
input[name="is_default"]
.default-status-checkbox
```

### Form Customization Module

**Form Editor**:
```css
/* Field palette */
.field-palette
.available-fields

/* Form canvas */
.form-builder
.form-canvas

/* Field items */
.form-field
.field-item

/* Field actions */
.field-edit
.field-delete
.field-duplicate

/* Field properties panel */
.field-properties
.field-settings

/* Save form button */
button:has-text("Save Form")
.save-form-btn
```

**Field Type Buttons**:
```css
.field-type-text
.field-type-textarea
.field-type-number
.field-type-date
.field-type-dropdown
.field-type-checkbox
```

### Custom Rules Module

**Rules Configuration**:
```css
/* Rules sections */
.resolved-rules
.closed-rules
.required-note-rules
.dialog-rules
.worklog-rules

/* Checkboxes for rules */
input[type="checkbox"][name*="rule"]
.rule-checkbox

/* Save rules button */
button:has-text("Save Rules")
.save-rules-btn
```

**Resolved Rules**:
```css
/* User interaction */
.user-interaction-rules
input[name="require_collaboration"]
input[name="require_note"]

/* Mandatory fields */
.mandatory-fields-section
input[name="mandatory_assignee"]
input[name="mandatory_solution"]

/* Require state */
.require-state-section
input[name="require_tasks_closed"]
input[name="require_worklog"]
```

### Transition Models Module

**Model List**:
```css
/* Create model button */
button:has-text("Create Model")
.create-model-btn

/* Model items */
.model-item
tr.model-row

/* Edit/Delete actions */
.model-actions
button[title="Edit"]
button[title="Delete"]
```

**Model Form**:
```css
/* Model name */
input[name="model_name"]
#model-name

/* Model description */
textarea[name="model_description"]

/* Transitions section */
.transitions-section
.state-transitions

/* Add transition button */
button:has-text("Add Transition")
.add-transition-btn

/* From state */
select[name="from_state"]
.from-state-select

/* To state */
select[name="to_state"]
.to-state-select

/* Conditions */
.transition-conditions
.condition-group
```

---

## Common Workflows - Selector Sequences

### Workflow: Create Problem

```javascript
// 1. Navigate
mcp__playwright__browser_navigate("/admin/problem-management/problems/new")

// 2. Fill form
mcp__playwright__browser_type("Subject field", "input[name='subject']", "Server Outage")
mcp__playwright__browser_type("Description", "textarea[name='description']", "...")
mcp__playwright__browser_select_option("Priority", "select[name='priority']", ["High"])

// 3. Submit
mcp__playwright__browser_click("Create button", "button[type='submit']")

// 4. Verify
mcp__playwright__browser_wait_for({ text: "Problem created successfully" })
mcp__playwright__browser_take_screenshot("problem-created.png")
```

### Workflow: Create Template

```javascript
// 1. Navigate
mcp__playwright__browser_navigate("/admin/problem-management/templates")

// 2. Click create
mcp__playwright__browser_click("Create Template", "button:has-text('Create Template')")

// 3. Fill template form
mcp__playwright__browser_type("Template name", "input[name='template_name']", "Hardware Failure")
// ... more fields

// 4. Submit
mcp__playwright__browser_click("Save", "button:has-text('Save')")

// 5. Verify
mcp__playwright__browser_wait_for({ text: "Template created" })
```

### Workflow: Add Category

```javascript
// 1. Navigate
mcp__playwright__browser_navigate("/admin/problem-management/categories")

// 2. Click add
mcp__playwright__browser_click("Add Category", "button:has-text('Add Category')")

// 3. Enter name
mcp__playwright__browser_type("Category name", "input[name='category_name']", "Network Issues")

// 4. Save
mcp__playwright__browser_click("Save", "button:has-text('Save')")

// 5. Verify
mcp__playwright__browser_wait_for({ text: "Network Issues" })
```

---

## Troubleshooting Reference

### Element Not Found

**Check these selectors in order**:
1. `[data-testid="element-name"]`
2. `#element-id`
3. `.specific-class`
4. `[name="field-name"]`
5. `button:has-text("Button Text")`
6. XPath as last resort

### Form Submission Issues

**Common causes**:
- Required field not filled
- Invalid field format
- Validation error not visible
- JavaScript validation preventing submit

**Debug steps**:
1. Take snapshot before submit
2. Check console for JS errors
3. Look for validation messages
4. Verify all required fields filled

### Session Expired

**Detection**:
```javascript
// Check for redirect
if (current_url.includes("/login")) {
  // Re-authenticate
}

// Check for modal
if (page_text.includes("Session Expired")) {
  // Handle modal and re-login
}
```

---

## Performance Considerations

### Wait Times

**Recommended timeouts**:
- Page navigation: 30 seconds
- Element click: 5 seconds
- Form submission: 10 seconds
- API response (if applicable): 15 seconds

**Wait strategies**:
```javascript
// Wait for text to appear
mcp__playwright__browser_wait_for({ text: "Success" })

// Wait for text to disappear (loading)
mcp__playwright__browser_wait_for({ textGone: "Loading..." })

// Wait for time
mcp__playwright__browser_wait_for({ time: 2 }) // 2 seconds
```

### Optimization Tips

1. **Batch operations**: Navigate once, perform multiple actions
2. **Use direct URLs**: Skip menu navigation when possible
3. **Minimize screenshots**: Only capture when necessary
4. **Cache snapshots**: Reuse snapshot data within same page
5. **Parallel operations**: Create multiple independent items in sequence

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-29 | Initial reference documentation |

---

## Additional Notes

### UI Variations

Motadata UI may vary based on:
- Version (cloud vs. on-premise)
- Custom branding
- User permissions
- Language settings
- Theme (light/dark mode)

**Adaptation strategy**:
1. Take snapshot first
2. Identify elements dynamically
3. Use multiple selector fallbacks
4. Report if selectors fail

### Custom CSS/JavaScript

Some organizations customize Motadata UI:
- Custom field types
- Modified layouts
- Additional validation
- Custom workflows

**Handling customizations**:
1. Document custom selectors separately
2. Use data attributes when available
3. Fallback to text content matching
4. Request user to provide selectors if needed

---

**Last Updated**: 2025-10-29
**Motadata Version**: Compatible with ServiceOps ITSM 8.x+
**Skill Version**: 1.0.0