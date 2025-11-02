---
name: motadata-problem-management
description: Manage Motadata ITSM Problem Management via browser automation. Create and manage problem records, templates, categories, statuses, custom forms, validation rules, and state transitions. Use when working with Motadata problems, creating problem tickets, managing problem workflows, configuring problem templates, setting up problem categories, customizing problem forms, or defining state transitions. Requires Playwright MCP for web automation and Motadata admin access.
allowed-tools: Read, Edit
mcp_tools:
  playwright:
    - browser_close
    - browser_resize
    - browser_console_messages
    - browser_handle_dialog
    - browser_evaluate
    - browser_file_upload
    - browser_fill_form
    - browser_install
    - browser_press_key
    - browser_type
    - browser_navigate
    - browser_navigate_back
    - browser_network_requests
    - browser_take_screenshot
    - browser_snapshot
    - browser_click
    - browser_drag
    - browser_hover
    - browser_select_option
    - browser_tabs
    - browser_wait_for
---

# Motadata Problem Management Skill

Comprehensive browser automation skill for managing Motadata ITSM Problem Management module through the web UI.

## Overview

This skill enables complete Problem Management operations in Motadata ServiceOps including:

- **Problem Records**: Create, view, edit, and manage problem tickets
- **Problem Templates**: Create reusable templates with predefined fields
- **Categories**: Organize problems with hierarchical categories
- **Status Management**: Configure custom statuses with colors and SLA settings
- **Form Customization**: Add custom fields and modify form layouts
- **Custom Rules**: Define validation rules for state transitions
- **Transition Models**: Create state transition workflows

## Requirements

- **Playwright MCP**: Must be configured and available (check `.mcp.json`)
- **Motadata Access**: Admin credentials with Problem Management permissions
- **Browser**: Chrome (default), Firefox, or Edge
- **Base URL**: `https://distibilisim.motadataserviceops.com`

## Quick Start

### Example 1: Create a Problem Record

```
User: "Open a new problem record for server outage"

You should:
1. Take a snapshot to check if already logged in (look for dashboard)
2. If not logged in:
   - Navigate to login page (https://distibilisim.motadataserviceops.com/login)
   - Prompt user for credentials
   - Login to Motadata:
     - Fill username field
     - Click password field (to activate it)
     - Fill password field
     - Click "Sign In" button
3. Navigate to Problem Creation (two options):
   - Option A: Navigate to /t/problem/ then click blue "+" button → "Create Problem"
   - Option B: Navigate directly to /t/problem/create
4. Fill required fields:
   - Search and select Requester (type to search, then select)
   - Enter Subject
   - Enter Description
   - Select Due By date/time (required! Use date picker and click "Ok")
   - Set Priority, Urgency, Impact (use dropdowns)
   - Select Category from tree (optional)
5. Click "Create" button at top-right
6. Verify success message appears (green toast notification)
7. Capture problem ID (PBM-X format)
8. Take screenshot of created problem with ID
```

### Example 2: Create a Problem Template

```
User: "Create a problem template for hardware failures"

You should:
1. Authenticate if not already
2. Navigate to Admin > Problem Management > Problem Templates
3. Click Create Template
4. Fill template fields (name, description, category, priority, etc.)
5. Save and verify success
```

## Authentication

### Login Process

**Important**: First check if already logged in by taking a snapshot and looking for dashboard elements.

If already authenticated (dashboard visible), skip login steps and proceed directly to the task.

If not authenticated, prompt the user for credentials:

1. **Prompt User**:
   ```
   "I need your Motadata credentials to proceed:
   - Username: [prompt]
   - Password: [prompt - sensitive]"
   ```

2. **Navigate to Login**:
   - Use `mcp__playwright__browser_navigate`
   - URL: `https://distibilisim.motadataserviceops.com/login`

3. **Perform Login**:
   - Use `mcp__playwright__browser_snapshot` to see the login form
   - Use `mcp__playwright__browser_fill_form` or `mcp__playwright__browser_type` for username
   - Use `mcp__playwright__browser_type` for password
   - Use `mcp__playwright__browser_click` on login button
   - Use `mcp__playwright__browser_wait_for` to verify successful login

4. **Handle Errors**:
   - Check for error messages
   - Retry if credentials are incorrect
   - Inform user if login fails

### Session Management

- Maintain browser session throughout operations
- Check for session timeout (look for redirect to login)
- Re-authenticate automatically if session expires

## Core Operations

### Module 1: Problem Records

Create and manage problem tickets in the system.

#### Create Problem Record

**Navigation**: Two methods available:
- **Method 1 (UI)**: Click the blue "+" button in the top-right corner, then select "Create Problem"
- **Method 2 (Direct)**: Navigate directly to `https://distibilisim.motadataserviceops.com/t/problem/create`

**Steps**:

1. **Navigate to Problem Creation**:

   **Option A - Using UI Button** (Recommended):
   ```
   1. Navigate to: https://distibilisim.motadataserviceops.com/t/problem/
   2. Locate the blue "+" button in the top-right corner of the page
   3. Click the button to open the creation menu
   4. Select "Create Problem" from the dropdown menu
   5. Page navigates to: https://distibilisim.motadataserviceops.com/t/problem/create
   ```

   **Option B - Direct URL**:
   ```
   Navigate directly to: https://distibilisim.motadataserviceops.com/t/problem/create
   ```

2. **Take Snapshot**: Use `mcp__playwright__browser_snapshot` to see form

3. **Fill Required Fields**:
   - **Requester** (required): Search and select requester by name or email
     - Click the dropdown
     - Type to search (e.g., "Ali")
     - Select from search results
   - **Subject** (required): Problem title
   - **Description**: Detailed problem description using rich text editor
   - **Due By** (required): Select date and time from date picker
     - Must be filled to create problem successfully
     - Click the field to open date picker
     - Select date from calendar
     - Time is auto-populated (can be adjusted)
     - **IMPORTANT**: Click "Ok" button to confirm selection
     - Format: DD/MM/YYYY HH:mm
   - **Status**: Select from dropdown (default: "Open")
   - **Nature of Problem** (required): Proactive or Reactive (default: "Proactive")
   - **Known Error** (required): Yes/No dropdown (default: "No")
   - **Priority**: High/Medium/Low/Urgent (default: "Low")
   - **Urgency**: High/Medium/Low/Urgent (default: "Low")
   - **Impact**: Low/On Users/On Department/On Business (default: "Low")
   - **Category**: Select from hierarchical tree structure
     - Available categories: General, Hardware, Software, Network, IT Administration
     - Click dropdown to see tree view
     - Click category name to select
   - **Technician Group** (optional): Assign to group
   - **Assignee** (optional): Assign to specific technician
   - **Department** (optional): Select from dropdown
   - **Vendor** (optional): Select from dropdown
   - **Location** (optional): Select from dropdown
   - **Tags** (optional): Add tags using tag button
   - **Attachment** (optional): Attach files using "Attach Files" button

4. **Fill Custom Fields**: If custom fields exist, fill based on form

5. **Submit**:
   - Click "Create" button at top-right
   - If validation errors occur, check error messages:
     - "Due By field is required" - Fill the Due By field
     - "Form fields contain one or more errors" - Review all required fields
   - Wait for page navigation

6. **Verify**:
   - Page navigates to problem details: `/t/problem/[ID]`
   - Success message appears: "Problem has been created successfully."
     - Displays as a green alert notification with checkmark icon at the bottom of the page
   - Problem ID format: PBM-[number] (e.g., PBM-3, PBM-4, PBM-7)
   - Date format in form: DD/MM/YYYY HH:mm (e.g., 30/10/2025 11:29, 30/10/2025 11:55)
   - Problem ID appears in page header (e.g., "PBM-7 Elektrik Kesintisi - Ofis Alanında Güç Kaybı")
   - Take screenshot of created problem for verification
   - Note the problem ID and confirm all fields are correctly saved
   - SLA timer starts automatically (e.g., "Due In 23 hours 56 minutes", "Due In 23 hours 55 minutes")

**Example 1: Firewall Connectivity Issue**:
```
User: "Create a problem for firewall connectivity issue"

Steps:
1. Navigate to /t/problem/
2. Click blue "+" button → Select "Create Problem"
3. Fill form:
   - Requester: Search "Ali" → Select "Ali Mehmetoğlu (ali.mehmetoglu@sipsy.ai)"
   - Subject: "Firewall Connectivity Issue - Port Blocking"
   - Description: "Multiple users reporting intermittent connectivity issues to internal
     application servers. Investigation shows that firewall rules are blocking required
     ports (8080, 8443) for the new application deployment. This is affecting approximately
     50+ users across the organization and causing business disruption."
   - Due By: Select "30/10/2025 11:21" from date picker, click "Ok"
   - Priority: High
   - Urgency: High
   - Impact: On Users
   - Category: Network
   - Nature of Problem: Proactive
4. Click "Create" button
5. Verify: Problem PBM-3 created successfully

Result:
- Problem ID: PBM-3
- Status: Open
- Success message displayed
- SLA due in 23 hours 57 minutes
```

**Example 2: Electrical Power Outage** (Real-world verified):
```
User: "Elektrik ile ilgili bir problem kaydı aç"

Steps:
1. Check authentication status with snapshot (already logged in)
2. Navigate directly to: /t/problem/create
3. Fill form:
   - Requester: Click dropdown → Type "ali" → Select "Ali Mehmetoğlu (ali.mehmetoglu@sipsy.ai)"
   - Subject: "Elektrik Kesintisi - Ofis Alanında Güç Kaybı"
   - Description: Click rich text editor → Type "Ofis binasının 3. katında elektrik
     kesintisi yaşanmaktadır. Yaklaşık 20 çalışanın bulunduğu bu alanda tüm elektronik
     cihazlar ve aydınlatma sistemleri çalışmamaktadır. Problem sabah saat 09:00'da
     başlamış olup, şu anda hala devam etmektedir. Elektrik panosu kontrol edilmiş
     ancak sigorta durumu normal görünmektedir. Bina elektrik altyapısının
     incelenmesi gerekmektedir."
   - Due By: Click field → Select "30" from calendar → **IMPORTANT: Click "Ok" button**
     (Without clicking Ok, validation will fail!)
   - Priority: Click dropdown → Select "High"
   - Urgency: Click dropdown → Select "High"
   - Impact: Click dropdown → Select "On Users"
   - Category: Leave empty (optional field)
   - Status, Nature of Problem, Known Error: Keep defaults
4. Click "Create" button at top-right
5. Page navigates to /t/problem/7
6. Success alert appears: "Problem has been created successfully."

Result:
- Problem ID: PBM-7 ✅
- Status: Open ✅
- Priority: High ✅
- Urgency: High ✅
- Impact: On Users ✅
- SLA timer: "Due In 23 hours 55 minutes" ✅
- URL: https://distibilisim.motadataserviceops.com/t/problem/7
- Screenshot saved for verification ✅
```

#### Edit Problem Record

**Steps**:
1. Navigate to problem list or search for problem by ID
2. Click on problem to open
3. Click "Edit" button
4. Modify fields as needed
5. Save changes
6. Verify update

#### View Problem Details

**Steps**:
1. Navigate to: `https://distibilisim.motadataserviceops.com/t/problem/`
2. Search by problem ID, subject, or filters using the search box
3. Click on problem row to view full details
4. Problem details page URL format: `/t/problem/[ID]` (e.g., `/t/problem/3`)
5. Take screenshot if needed

**Problem Details Page Sections**:
- Header: Problem ID (PBM-X), Subject, Status, Actions
- Status Bar: Status, Priority, Technician Group, Assignee, Urgency, Impact
- Problem Details: Description, Attachments
- Tabs: Analysis (Root Cause, Symptoms, Impact, Work Around), Tasks, Relations, SLA, Work Log, Audit Trail, Notifications
- SLA Status: Shows due date and remaining time
- Other Info: Category, Department, Location, Vendor, etc.

---

### Module 2: Problem Templates

Create reusable templates for common problem types.

#### Create Problem Template

**Navigation**: Admin > Problem Management > Problem Templates > Create Template

**Steps**:

1. **Navigate**:
   ```
   URL: https://distibilisim.motadataserviceops.com/admin/templates/?type=problem
   ```

   **Note**: The URL `/admin/problem-management/templates` will return a 404 error. The correct URL is `/admin/templates/?type=problem`.

2. **Click Create Template**: Look for "Create Template" button (blue button at top-right of the page)

3. **Take Snapshot**: See template form fields

4. **Fill Template Details**:

   The template form has two tabs:
   - **Problem Fields Tab**: Contains all the main template fields
   - **Tasks Tab**: Allows you to configure default tasks for the template

   **Problem Fields Tab**:

   | Field | Description | Required |
   |-------|-------------|----------|
   | Template Name | Unique identifier | Yes (marked with *) |
   | Template Technician Access Level | Who can use this template | Optional |
   | Template Technician Group Access Level | Group access | Optional |
   | Template Description | Brief overview | Optional |
   | Transition Model | State transition workflow | Optional |
   | Subject | Default problem subject | Optional |
   | Description | Default problem description | Optional |
   | Status | Default status | Optional (default: Open) |
   | Nature Of Problem | Proactive/Reactive | Optional (default: Proactive) |
   | Known Error | Yes/No | Optional (default: No) |
   | Priority | Default priority | Optional (default: Low) |
   | Urgency | Default urgency | Optional (default: Low) |
   | Impact | Default impact | Optional (default: Low) |
   | Category | Default category | Optional |
   | Technician Group | Auto-assign group | Optional |
   | Assignee | Auto-assign person | Optional |
   | Department | Department filter | Optional |
   | Vendor | Vendor association | Optional |
   | Location | Location filter | Optional |
   | Tags | Metadata tags | Optional |

   **Note**: Only "Template Name" field is marked as required with "*". All other fields are optional and have default values where applicable.

5. **Save Template**:
   - Click "Create" button at top-right
   - Wait for success message: "Template has been created successfully."
   - Page redirects back to templates list

6. **Verify**:
   - Template appears in template list with green "Enabled" toggle
   - Template description is visible in the list
   - Can be used in problem creation

**Example**:
```
User: "Create a template for hardware failure problems"

Steps:
1. Navigate to /admin/templates/?type=problem
2. Click "Create Template"
3. Fill template fields:
   - Template Name: "Hardware Failure Template"
   - Template Description: "Template for reporting hardware failures"
   - Subject: "Hardware Failure - [Device]"
   - Description (rich text): "Hardware device [Device] has failed with symptom: [Symptom]"
   - Priority: High
   - Urgency: High
   - Impact: On Users
   - Category: Hardware (optional)
   - Nature Of Problem: Reactive
4. Click "Create" button
5. Success message: "Template has been created successfully."
6. Verify template appears in list with Enabled toggle
```

**Example 2 - Email Service Template** (Real-world verified):
```
User: "Create an email service problem template"

Steps:
1. Navigate to /admin/templates/?type=problem
2. Click "Create Template" button
3. Fill template fields:
   - Template Name: "Email Service Problem Template"
   - Template Description: "Template for email service issues and problems. Use this template when users experience email delivery failures, connection issues, or mailbox access problems."
   - Subject: "Email Service Issue - Delivery and Connection Problems"
   - Description (rich text editor):
     "Email service is experiencing issues that prevent users from sending or receiving emails.
     This template should be used for the following scenarios:

     - Email delivery failures or delays
     - Unable to send emails to specific domains
     - Email synchronization issues with mobile devices
     - Mailbox access problems or authentication errors
     - Slow email performance
     - Email attachment issues
     - SMTP/IMAP/POP3 connection problems

     Please provide detailed information about the symptoms and affected users when creating a problem using this template."
   - Priority: High
   - Urgency: High
   - Impact: On Users
   - Status: Open (default)
   - Nature Of Problem: Proactive (default)
   - Known Error: No (default)
4. Click "Create" button at top-right
5. Page redirects to /admin/templates/?type=problem
6. Success message appears: "Template has been created successfully." (green toast notification with checkmark)
7. Template appears in list:
   - Name: "Email Service Problem Template"
   - Description: "Template for email service issues and problems. Use this templ..."
   - Enabled: Green toggle (active)
   - Actions: Duplicate, Edit, Delete buttons available
```

#### Enable/Disable Template

**Steps**:
1. Navigate to template list
2. Find template
3. Use toggle switch or enable/disable button
4. Verify status change

#### Duplicate Template

**Steps**:
1. Find existing template
2. Click "Duplicate" action
3. Modify name and fields as needed
4. Save new template

#### Delete Template

**Steps**:
1. Find template in list
2. Click delete icon/button
3. Confirm deletion in dialog
4. Verify template removed

---

### Module 3: Category Management

Organize problems using hierarchical categories.

#### Create Problem Category

**Navigation**: Admin > Problem Management > Problem Categories > Problem tab

**Steps**:

1. **Navigate**:
   ```
   URL: https://distibilisim.motadataserviceops.com/admin/category/?type=problem
   ```

   **Note**: The URL `/admin/problem-management/categories` will return a 404 error. The correct URL is `/admin/category/?type=problem`.

2. **Click Add Category**: Look for "+ Category" or "Add" button

3. **Enter Category Name**: Type category name (e.g., "Hardware", "Network")

4. **Configure Settings** (if available):
   - Description
   - Icon/Color
   - Parent category (for subcategories)

5. **Save**: Click save button

6. **Verify**: Category appears in list

**Example**:
```
User: "Add a category for network issues"

Steps:
- Click Add Category
- Name: "Network Issues"
- Save
```

#### Add Subcategory

**Steps**:
1. Select parent category
2. Click "Add Subcategory" or expand category
3. Enter subcategory name
4. Save
5. Verify hierarchy

**Example**:
```
Create hierarchy:
- Hardware
  - Server
  - Desktop
  - Laptop
  - Network Equipment
```

#### Reorder Categories

**Steps**:
1. Navigate to category list
2. Use drag-and-drop to reorder
3. Or use up/down arrows
4. Changes save automatically
5. Verify new order

#### Edit Category

**Steps**:
1. Find category in list
2. Click edit icon
3. Modify name or settings
4. Save changes

#### Delete Category

**Steps**:
1. Find category
2. Click delete icon
3. Confirm deletion (warning: affects existing problems)
4. Verify removal

#### Import Categories (Bulk)

**Steps**:
1. Click "Import" button
2. Download template CSV if needed
3. Upload CSV file with categories
4. Review import preview
5. Confirm import
6. Verify categories added

---

### Module 4: Status Management

Configure custom problem statuses with colors and behaviors.

#### Create Custom Status

**Navigation**: Admin > Problem Management > Problem Status > Problem tab

**Steps**:

1. **Navigate**:
   ```
   URL: https://distibilisim.motadataserviceops.com/admin/status/?type=problem
   ```

   **Note**: The URL `/admin/problem-management/status` will return a 404 error. The correct URL is `/admin/status/?type=problem`.

2. **Click Add Status**: Look for "Add Status" link/button

3. **Fill Status Details**:
   - **Status Name** (required): E.g., "Investigating", "Awaiting Vendor"
   - **Color**: Select from palette or enter hex code (e.g., #FF5722)
   - **Enable SLA**: Checkbox to pause/resume SLA
   - **Enable UC (User Conversion)**: Allow status conversion
   - **Set as Default**: Make this the default status for new problems

4. **Save**: Click "Save" button

5. **Verify**: Status appears in status list with chosen color

**Example**:
```
User: "Add a status called 'Pending Approval' in orange color"

Steps:
- Click Add Status
- Name: "Pending Approval"
- Color: #FF9800 (orange)
- Enable SLA: Checked (pause SLA)
- Save
```

#### Edit Status

**Steps**:
1. Find status in list
2. Click edit icon
3. Modify name, color, or settings
4. Save changes

#### Reorder Statuses

**Steps**:
1. Use drag-and-drop in status list
2. Arrange statuses in desired workflow order
3. Changes save automatically

#### Configure SLA Settings

**Steps**:
1. Edit status
2. Toggle "Enable SLA" checkbox
3. Set whether SLA should pause in this status
4. Save

#### Set Default Status

**Steps**:
1. Edit desired status
2. Check "Set as Default" option
3. Save
4. All new problems will use this status

---

### Module 5: Form Customization

Customize the problem form with custom fields and layouts.

#### Add Custom Field

**Navigation**: Admin > Problem Management > Problem Form

**Steps**:

1. **Navigate**:
   ```
   URL: https://distibilisim.motadataserviceops.com/admin/form/problem
   ```

   **Note**: The URL `/admin/problem-management/form` will return a 404 error. The correct URL is `/admin/form/problem`.

2. **Open Field Palette**: Look for "Add Field" or drag palette

3. **Select Field Type**:
   - Text Box (single line)
   - Text Area (multi-line)
   - Number
   - Date/DateTime
   - Dropdown (single select)
   - Multi-select
   - Checkbox
   - Radio Button
   - Email
   - URL
   - Phone

4. **Configure Field**:
   - **Name**: Field label
   - **Hint Text**: Placeholder
   - **Default Value**: Pre-filled value
   - **Required**: Make mandatory
   - **Visible**: Show/hide field
   - **Options** (for dropdown/select): Add option values

5. **Drag to Position**: Place field in desired location on form

6. **Save Form**: Click save to apply changes

**Example - DateTime Field**:
```
User: "Add a 'First Detected' datetime field to track when problem was first noticed"

Configuration:
- Field Type: DateTime
- Name: "First Detected"
- Hint Text: "When was this problem first noticed?"
- Default Value: Current Date
- Allow to Select Time: Yes
- Required: Yes
```

#### Reorder Fields

**Steps**:
1. Navigate to form editor
2. Drag fields to reorder
3. Drop in desired position
4. Save form

#### Expand/Collapse Field Layout

**Steps**:
1. Click expand/collapse icon on field
2. Choose 1 field per row or 2 fields per row
3. Adjust for better form layout

#### Edit Field Properties

**Steps**:
1. Click edit icon on field
2. Modify properties:
   - Name
   - Hint text
   - Default value
   - Required status
   - Visibility
   - Options (for select fields)
3. Save changes

#### Duplicate Custom Field

**Steps**:
1. Click duplicate icon on field
2. New copy is created
3. Modify as needed
4. Position in form

#### Remove Custom Field

**Warning**: Deleting custom fields removes ALL data stored in that field for all problems!

**Steps**:
1. Click remove icon on field
2. Read warning message
3. Confirm deletion
4. Field and data are removed

#### Hide System Fields

Certain system fields (Location, Category, Department) can be hidden:

**Steps**:
1. Find system field in form
2. Click "Hide" option
3. Field no longer appears in problem forms
4. Can be unhidden later

---

### Module 6: Custom Rules

Define validation rules and behaviors for problem state transitions.

#### Configure Resolved Rules

Rules that must be satisfied before marking a problem as Resolved.

**Navigation**: Admin > Problem Management > Problem Custom Rules

**Steps**:

1. **Navigate**:
   ```
   URL: https://distibilisim.motadataserviceops.com/admin/custom-rules/?type=problem
   ```

   **Note**: The URL `/admin/problem-management/custom-rules` will return a 404 error. The correct URL is `/admin/custom-rules/?type=problem`.

2. **Select "Resolved Rules" Section**

3. **User Interaction Rules**:
   - ☐ At least one collaboration entry
   - ☐ At least one note

4. **Mandatory Fields** (select which fields must be filled):
   - ☐ Assignee
   - ☐ Technician Group
   - ☐ Solution
   - ☐ Symptoms
   - ☐ Approval
   - ☐ Category
   - ☐ Investigation-Impact
   - ☐ Root Cause

5. **Require State**:
   - ☐ All Tasks must be closed
   - ☐ At least one worklog
   - ☐ All approvals must be Ignored/Rejected/Approved/Referred back

6. **Save Rules**: Click save to apply

**Example**:
```
User: "Require solution and root cause before resolving problems"

Configure:
- Mandatory Fields:
  ✓ Solution
  ✓ Root Cause
- Save
```

#### Configure Closed Rules

Rules required before closing a problem.

**Steps**:

1. **Select "Closed Rules" Section**

2. **Closure Actions**:
   - ☐ Close all Related Requests
   - ☐ Copy Workaround and Solution to Request Solution

3. **User Interaction**: Same options as Resolved Rules

4. **Mandatory Fields**: Same options as Resolved Rules

5. **Require State**:
   - ☐ All Tasks closed
   - ☐ All approvals resolved
   - ☐ Do not skip Resolved Status
   - ☐ At least one worklog

6. **Save**

#### Configure Required Note Rules

Require technicians to add notes when making specific changes.

**Steps**:

1. **Select "Required Note Rules" Section**

2. **Require Note For**:
   - ☐ Reopen action
   - ☐ Changes to Assignee
   - ☐ Changes to Technician Group
   - ☐ Changes to Urgency
   - ☐ Changes to Category
   - ☐ Changes to Support Level
   - ☐ Changes to Due By
   - ☐ Changes to Location
   - ☐ Changes to Priority
   - ☐ Changes to Impact
   - ☐ Changes to Source
   - ☐ Changes to Department
   - ☐ Changes to Status

3. **Save**

**Example**:
```
User: "Require notes when changing priority or status"

Configure:
- Require note for:
  ✓ Changes to Priority
  ✓ Changes to Status
- Save
```

#### Configure Show Dialog Rules

Show confirmation dialogs when modifying specific fields.

**Steps**:

1. **Select "Show Dialog Rules" Section**

2. **Show Dialog For Changes To**:
   - ☐ Assignee
   - ☐ Technician Group
   - ☐ Urgency
   - ☐ Category
   - ☐ Due By
   - ☐ Status
   - ☐ Location
   - ☐ Priority
   - ☐ Impact
   - ☐ Department
   - ☐ Nature of Problem

3. **Save**

#### Configure Add Worklog Rules

Control who can add worklogs to problems.

**Steps**:

1. **Select "Add Worklog Rules" Section**

2. **Who Can Add Worklog**:
   - ○ Only Assignee
   - ○ Only Technician Group
   - ○ All Technicians
   - ○ Only Assignee or Technician Group

3. **Save**

---

### Module 7: Transition Models

Define state transition workflows for problems.

#### Create Transition Model

**Navigation**: Admin > Problem Management > Problem Model

**Steps**:

1. **Navigate**:
   ```
   URL: https://distibilisim.motadataserviceops.com/admin/change-model/problem
   ```

   **Note**: The URL `/admin/problem-management/models` will return a 404 error. The correct URL is `/admin/change-model/problem`.

2. **Click "Create Model"**: Look for "Create Model" button

3. **Fill Model Details**:
   - **Name** (required): Model identifier (e.g., "Standard Problem Workflow")
   - **Module**: Problem (default)
   - **Description**: Brief overview of workflow

4. **Define State Transitions**:

   For each transition:
   - **From State**: Starting status (e.g., "New")
   - **To State**: Target status (e.g., "Investigating")
   - **Condition Groups** (optional): Rules for allowing transition
     - Field conditions
     - User role requirements
     - Approval requirements

5. **Add Multiple Transitions**: Click "+ Add Transition" to define workflow

6. **Example Workflow**:
   ```
   New → Investigating → Awaiting Vendor → Resolved → Closed
   ```

7. **Save Model**: Click "Create" to save

8. **Enable Model**: Models are enabled by default when creating problems

**Example**:
```
User: "Create a workflow for hardware problems"

Model:
- Name: "Hardware Problem Workflow"
- Description: "Standard workflow for hardware-related problems"

Transitions:
1. New → Assigned (when assignee is set)
2. Assigned → Investigating (when investigation starts)
3. Investigating → Awaiting Parts (when parts are ordered)
4. Awaiting Parts → Fixing (when parts arrive)
5. Fixing → Testing (when fix is applied)
6. Testing → Resolved (when test passes)
7. Resolved → Closed (after customer confirmation)
```

#### Edit Transition Model

**Steps**:
1. Find model in list
2. Click edit icon
3. Modify transitions or conditions
4. Save changes

#### Delete Transition Model

**Steps**:
1. Find model in list
2. Click delete icon
3. Confirm deletion
4. Model is removed

---

## Best Practices

### 1. Always Take Snapshots

Before any action, use `mcp__playwright__browser_snapshot` to:
- Verify you're on the correct page
- See current state of elements
- Identify selectors
- Confirm form fields

### 2. Verify Operations

After creating/editing:
- Take screenshot for user verification
- Check for success messages
- Look for error messages
- Verify data appears in lists

### 3. Handle Errors Gracefully

- Check for validation errors on forms
- Look for error toast messages
- Handle session timeouts
- Retry login if needed

### 4. Use Specific Selectors

Prefer selectors in this order:
1. Data attributes (`[data-testid="..."]`)
2. IDs (`#element-id`)
3. Unique class combinations
4. ARIA labels (`[aria-label="..."]`)
5. Text content (last resort)

### 5. Wait for Elements

After navigation or clicks:
- Use `mcp__playwright__browser_wait_for` with text or time
- Verify page loaded completely
- Check for loading spinners to disappear

### 6. Security

- Never log or store credentials
- Always prompt user for sensitive info
- Clear sensitive data from variables
- Use secure session management

### 7. Provide Context

When prompting user:
- Explain what credentials are needed
- Describe what action will be performed
- Confirm before destructive operations (delete)

### 8. Modular Approach

Break complex operations into steps:
1. Authenticate
2. Navigate
3. Fill form
4. Submit
5. Verify

### 9. Screenshot Documentation

Take screenshots at key points:
- Before submitting forms (for record)
- After successful operations (proof)
- On errors (for debugging)
- When asking user for input

### 10. Test in Stages

For complex operations:
- Test authentication first
- Test navigation next
- Test form filling
- Test submission
- Test verification

### 11. Handle Form Field Activation

Some form fields require activation before typing:
- Click the field first (especially password fields)
- Wait for field to become editable
- Then type the content
- Watch for readonly attributes that may need to be removed by clicking

### 12. Use UI Buttons Over Direct URLs

When possible, use UI navigation instead of direct URL navigation:
- Click buttons and menus to navigate
- This ensures proper page initialization
- Reduces 404 errors
- Example: Use "+" button for creation instead of direct URL to `/admin/problem-management/problems/new`

### 13. Verify Required Fields

Always check which fields are marked as required before submitting:
- Look for asterisk (*) or "required" labels next to field names
- Fill all required fields to avoid validation errors
- Common required fields: Requester, Subject, Due By, Nature of Problem, Known Error
- Use field defaults when appropriate (Status: Open, Priority: Low, etc.)
- Category field is optional (not required) despite being important for organization

### 14. Date Picker Confirmation

Always remember to confirm date picker selections:
- After selecting a date from the calendar, you MUST click the "Ok" button
- Simply selecting the date without clicking "Ok" will not save your selection
- This is a common source of "Due By field is required" validation errors
- The field will appear empty if "Ok" was not clicked

---

## Common Workflows

### Workflow 1: Complete Problem Management Setup

```
Steps:
1. Login to Motadata
2. Create categories: Hardware, Software, Network, Database
3. Add subcategories under each
4. Create custom statuses: Investigating, Awaiting Vendor, Testing
5. Create template: "Hardware Failure"
6. Create template: "Software Bug"
7. Add custom field: "Root Cause Analysis"
8. Configure resolved rules: Require solution and root cause
9. Create transition model: Standard workflow
10. Test by creating a sample problem
```

### Workflow 2: Quick Problem Creation

```
Steps:
1. Check if already logged in (take snapshot)
2. Login only if not authenticated
3. Navigate to Problem Creation (choose one):
   - Option A: Navigate to /t/problem/ → Click blue "+" button → "Create Problem"
   - Option B: Navigate directly to /t/problem/create
4. Fill required fields:
   - Requester (required - click field, type to search, select from results)
   - Subject (required - enter problem title)
   - Description (use rich text editor)
   - Due By (required - click field, select date, click "Ok")
   - Priority, Urgency, Impact (click dropdowns to select)
   - Category (optional - select from tree structure)
5. Optional: Use "Fill From Template" to auto-fill fields
6. Click "Create" button at top-right
7. Wait for page navigation to /t/problem/[ID]
8. Verify success message: "Problem has been created successfully." (green toast notification)
9. Capture problem ID from page header (format: PBM-X)
10. Note SLA status ("Due In X hours...")
11. Take screenshot of created problem details page
```

### Workflow 3: Bulk Category Setup

```
Steps:
1. Prepare category list
2. Login
3. Navigate to categories
4. For each category:
   - Add category
   - Add subcategories
5. Reorder as needed
6. Verify hierarchy
```

---

## Error Handling

### Common Errors

1. **Login Failed**:
   - Verify credentials
   - Check caps lock
   - Verify user has admin access

2. **Element Not Found**:
   - Take snapshot to see current page
   - Check if page loaded completely
   - Verify navigation was successful

3. **Form Validation Error**:
   - Check required fields
   - Verify field formats
   - Look for inline error messages
   - Common errors:
     - "Due By field is required" - Must fill Due By date/time field
     - "Form fields contain one or more errors" - Review all required fields

4. **Session Timeout**:
   - Re-authenticate
   - Resume operation

5. **Duplicate Name Error**:
   - Check if category/status/template already exists
   - Use unique name

6. **Navigation Errors**:
   - If direct URL navigation fails (404 error), use the UI buttons instead
   - Example: Use blue "+" button → "Create Problem" instead of direct URL navigation to `/admin/problem-management/problems/new`
   - Correct creation URL: `/t/problem/create` (accessed via UI)

7. **Password Field Not Editable**:
   - Click the password field first to activate it
   - Then type the password
   - Password fields may have readonly attribute until clicked

### Debugging Steps

1. Take snapshot to see current state
2. Check browser console for errors
3. Verify navigation path
4. Check selector accuracy
5. Review form data
6. Capture screenshot before failing operation

---

## Playwright MCP Tools Reference

### Navigation
- `mcp__playwright__browser_navigate(url)`: Go to URL
- `mcp__playwright__browser_navigate_back()`: Go back

### Inspection
- `mcp__playwright__browser_snapshot()`: Get page structure
- `mcp__playwright__browser_take_screenshot(options)`: Capture image

### Interaction
- `mcp__playwright__browser_click(element, ref)`: Click element
- `mcp__playwright__browser_type(element, ref, text)`: Type text
- `mcp__playwright__browser_fill_form(fields)`: Fill multiple fields
- `mcp__playwright__browser_select_option(element, ref, values)`: Select dropdown

### Waiting
- `mcp__playwright__browser_wait_for(text/textGone/time)`: Wait for condition

### Dialog Handling
- `mcp__playwright__browser_handle_dialog(accept, promptText)`: Handle alerts/confirms

### Screenshots
- `mcp__playwright__browser_take_screenshot(filename, type)`: Save screenshot

---

## Limitations

1. **Browser-Based Only**: This skill uses UI automation, not API
2. **Requires Admin Access**: Most operations need admin privileges
3. **UI Changes**: May break if Motadata UI is updated
4. **Session Duration**: Long operations may timeout
5. **Network Dependent**: Requires stable connection to Motadata instance

---

## Tips for Users

1. **Start Simple**: Begin with category creation before complex workflows
2. **Test Templates**: Create and test templates in dev environment first
3. **Backup Data**: Consider exporting before bulk operations
4. **Document Selectors**: If UI changes, note new selectors
5. **Use Meaningful Names**: Clear names for categories, statuses, templates
6. **Plan Workflows**: Design transition models on paper first
7. **Check Dependencies**: Some operations depend on others (e.g., categories before templates)

---

## Support

For Motadata-specific issues:
- Check Motadata documentation
- Verify admin permissions
- Contact Motadata support

For skill issues:
- Review troubleshooting guide
- Check REFERENCE.md for detailed selectors
- Verify Playwright MCP is working

---

## Version Information

- **Skill Version**: 1.0.0
- **Target Platform**: Motadata ServiceOps ITSM
- **Requires**: Playwright MCP
- **Browser**: Chrome (default), Firefox, Edge supported
- **Authentication**: Interactive user prompt

---

## Additional Resources

- `REFERENCE.md`: Complete UI navigation paths and selectors
- `EXAMPLES.md`: Real-world usage scenarios and examples
- `TROUBLESHOOTING.md`: Common issues and solutions
- Motadata Guides: `motadata_problem/` directory

---

## Quick Reference Card

| Operation | Navigation Path |
|-----------|----------------|
| Create Problem | Click blue "+" button (top-right) → Create Problem |
| View Problems | /t/problem/ |
| Problem Details | /t/problem/[ID] |
| Manage Templates | Admin > Problem Management > Problem Templates |
| Configure Categories | Admin > Problem Management > Problem Categories |
| Manage Status | Admin > Problem Management > Problem Status |
| Customize Form | Admin > Problem Management > Problem Form |
| Configure Rules | Admin > Problem Management > Problem Custom Rules |
| Transition Models | Admin > Problem Management > Problem Model |

---

**Remember**: Always authenticate first, take snapshots to understand current state, verify operations with screenshots, and handle errors gracefully. This skill is your gateway to comprehensive Motadata Problem Management automation!