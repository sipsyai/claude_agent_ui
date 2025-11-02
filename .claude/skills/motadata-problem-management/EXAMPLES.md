# Motadata Problem Management - Usage Examples

Real-world scenarios and examples for using the Motadata Problem Management skill.

## Table of Contents

1. [Quick Start Examples](#quick-start-examples)
2. [Problem Record Examples](#problem-record-examples)
3. [Template Examples](#template-examples)
4. [Category Management Examples](#category-management-examples)
5. [Status Configuration Examples](#status-configuration-examples)
6. [Form Customization Examples](#form-customization-examples)
7. [Custom Rules Examples](#custom-rules-examples)
8. [Transition Model Examples](#transition-model-examples)
9. [Complete Workflow Examples](#complete-workflow-examples)
10. [Advanced Scenarios](#advanced-scenarios)

---

## Quick Start Examples

### Example 1: First Time Setup

**User Request**: "Set up basic Problem Management for our IT team"

**Assistant Actions**:
1. Prompt for credentials
2. Login to Motadata
3. Create basic categories (Hardware, Software, Network, Database)
4. Create common statuses (Investigating, Awaiting Vendor)
5. Create starter template
6. Take screenshots showing setup

**Expected Output**:
```
I've set up your Problem Management with:
✓ 4 main categories: Hardware, Software, Network, Database
✓ 2 custom statuses: Investigating, Awaiting Vendor
✓ 1 template: General IT Problem

Your team can now start creating problem records!
[Screenshot: categories.png]
[Screenshot: statuses.png]
```

---

### Example 2: Simple Problem Creation

**User Request**: "Create a problem for server outage"

**Assistant Actions**:
1. Authenticate if needed
2. Navigate to new problem page
3. Fill required fields with sensible defaults
4. Submit and verify
5. Display problem ID

**Expected Output**:
```
Problem created successfully!

Problem ID: PRB-001234
Subject: Server Outage
Status: New
Priority: High
Category: Hardware/Server

[Screenshot: problem-created.png]
```

---

### Example 3: Quick Status Check

**User Request**: "Show me all high priority problems"

**Assistant Actions**:
1. Navigate to problems list
2. Apply priority filter
3. Take screenshot of filtered results
4. Summarize findings

**Expected Output**:
```
Found 7 high-priority problems:

1. PRB-000891: Database Replication Lag (Critical)
2. PRB-000889: Email Server Down (High)
3. PRB-000885: Network Switch Failure (High)
4. PRB-000882: Storage Array Error (High)
5. PRB-000878: SSL Certificate Expiring (High)
6. PRB-000876: Memory Leak in App Server (High)
7. PRB-000874: Backup Job Failed (High)

[Screenshot: high-priority-problems.png]
```

---

## Problem Record Examples

### Example 4: Create Hardware Problem

**User Request**: "Open a problem ticket for a failed hard drive in server DB-PROD-01"

**Problem Details**:
- **Subject**: Hard Drive Failure - DB-PROD-01
- **Description**: Production database server DB-PROD-01 has a failed hard drive in RAID array. Drive showing SMART errors and performance degradation. Immediate attention required.
- **Category**: Hardware > Server
- **Priority**: High
- **Urgency**: High
- **Impact**: Medium (RAID redundancy still intact)
- **Nature**: Reactive
- **Tags**: production, hardware, database, critical

**Assistant Conversation**:
```
Assistant: I'll create a problem record for the hard drive failure. Let me authenticate first.

[Navigates to login page]
[User provides credentials]
[Successfully authenticated]

Now creating the problem record with the hardware failure details...

[Navigates to: /admin/problem-management/problems/new]
[Takes snapshot to see form]
[Fills form fields]:
- Subject: "Hard Drive Failure - DB-PROD-01"
- Description: "Production database server DB-PROD-01 has a failed hard drive in RAID array. Drive showing SMART errors and performance degradation. Immediate attention required."
- Priority: High
- Urgency: High
- Impact: Medium
- Category: Hardware > Server
- Nature: Reactive
- Tags: production, hardware, database, critical

[Clicks Create button]
[Waits for success message]
[Takes screenshot of created problem]

Success! Your problem has been created:
- Problem ID: PRB-002145
- Subject: Hard Drive Failure - DB-PROD-01
- Status: New
- Assigned to: Unassigned (ready for assignment)

[Screenshot: hardware-problem-created.png]
```

**Key Fields Used**:
- Subject: Descriptive, includes server name
- Description: Detailed explanation with technical context
- Priority/Urgency/Impact: All set appropriately for production issue
- Nature: Reactive (responding to detected issue)
- Tags: Help with searching and filtering related problems

---

### Example 5: Create Software Bug Problem

**User Request**: "Create a problem ticket for the authentication service throwing errors"

**Problem Details**:
- **Subject**: Authentication Service - Token Validation Errors
- **Description**: The authentication service is throwing 500 errors when validating tokens. Logs show "JWT validation failed" errors starting at 2025-10-29 14:30:00. Affects approximately 200 users. Error log attached.
- **Category**: Software > Application Error
- **Priority**: Critical
- **Urgency**: High
- **Impact**: High
- **Nature**: Reactive
- **Tags**: authentication, critical, production-outage

**Assistant Conversation**:
```
Assistant: I'll create a critical problem record for the authentication service errors. Let me set this up immediately.

[Authenticates if needed]
[Navigates to: /admin/problem-management/problems/new]
[Fills form]:
- Subject: "Authentication Service - Token Validation Errors"
- Description: "The authentication service is throwing 500 errors when validating tokens. Logs show 'JWT validation failed' errors starting at 2025-10-29 14:30:00. Affects approximately 200 users."
- Priority: Critical
- Urgency: High
- Impact: High
- Category: Software > Application Error
- Nature: Reactive
- Status: New
- Tags: authentication, critical, production-outage, urgent

[Submits problem]

Problem created successfully:
- Problem ID: PRB-002146
- Priority: Critical (flagged for immediate attention)
- Impact: 200+ users affected
- Status: New (awaiting assignment)

[Screenshot: auth-problem-created.png]
```

---

### Example 6: Create Network Problem

**User Request**: "Log a problem for the network switch in building B that's failing"

**Problem Details**:
- **Subject**: Network Switch Failure - Building B
- **Description**: Primary network switch (Cisco Catalyst 9300) in Building B is experiencing periodic failures. Intermittent connectivity loss reported by 45 workstations. Device logs show port instability.
- **Category**: Network > Switch
- **Priority**: High
- **Urgency**: High
- **Impact**: High
- **Nature**: Reactive
- **Assignee**: Network Team
- **Tags**: network, switch, building-b, outage

**Expected Output**:
```
Problem created successfully!

Problem ID: PRB-002147
Subject: Network Switch Failure - Building B
Status: New
Category: Network > Switch
Priority: High
Affected Users: 45
Assigned To: Network Team

[Screenshot: network-problem.png]
```

---

### Example 7: Edit Problem and Update Status

**User Request**: "Update PRB-002145 with investigation findings - change status to Investigating and add notes"

**Assistant Actions**:
1. Navigate to problem PRB-002145
2. Click Edit
3. Change Status to "Investigating"
4. Add comment/note with findings
5. Save changes
6. Verify update

**Expected Output**:
```
Problem updated successfully!

Problem: PRB-002145 - Hard Drive Failure - DB-PROD-01
Status Changed: New → Investigating
Investigation Notes Added: [Date] Investigation started. RAID array still operational. Ordered replacement drive.

[Screenshot: problem-updated.png]
```

---

## Template Examples

### Example 8: Create Hardware Failure Template

**User Request**: "Create a template for hardware problems so my team doesn't have to fill out the form from scratch each time"

**Template Configuration**:
- **Template Name**: Hardware Failure - Standard
- **Description**: Template for reporting hardware device failures
- **Predefined Fields**:
  - Subject: "Hardware Failure - [Device Type]"
  - Priority: High
  - Urgency: High
  - Impact: Medium
  - Category: Hardware
  - Nature: Reactive
  - Status: New

**Assistant Conversation**:
```
Assistant: I'll create a hardware failure template for your team. This will save time on future hardware problems.

[Navigates to: /admin/problem-management/templates]
[Clicks: Create Template]
[Takes snapshot of template form]
[Fills template fields]:
- Template Name: "Hardware Failure - Standard"
- Description: "Template for reporting hardware device failures with predefined priority and categorization"
- Subject: "Hardware Failure - [Device Type]"
- Status: New
- Priority: High
- Urgency: High
- Impact: Medium
- Category: Hardware
- Nature: Reactive

[Clicks: Save Template]
[Waits for success]
[Takes screenshot]

Template created successfully!

Template: Hardware Failure - Standard
Access: All technicians
Can be used in: Problem creation wizard
Benefits: Consistent field values, faster ticket creation

[Screenshot: template-created.png]
```

---

### Example 9: Create Multiple Specialized Templates

**User Request**: "Set up templates for our main problem categories: hardware, software, network, and database issues"

**Templates to Create**:
1. Hardware Failure
2. Software Bug
3. Network Connectivity
4. Database Performance

**Assistant Conversation**:
```
Assistant: I'll create four specialized templates for your team. This will standardize problem reporting across all categories.

Creating templates...

[Template 1 - Hardware Failure]
- Name: "Hardware Failure - Reactive"
- Category: Hardware
- Priority: High, Urgency: High, Impact: Medium

[Template 2 - Software Bug]
- Name: "Software Bug Report"
- Category: Software
- Priority: Medium, Urgency: Medium, Impact: Medium

[Template 3 - Network Connectivity]
- Name: "Network Connectivity Issue"
- Category: Network
- Priority: High, Urgency: High, Impact: High

[Template 4 - Database Performance]
- Name: "Database Performance Issue"
- Category: Database
- Priority: High, Urgency: Medium, Impact: High

All templates created successfully!

Summary:
✓ 4 templates created
✓ All teams can access
✓ Ready for immediate use
✓ Speeds up problem creation by 50%

[Screenshot: all-templates.png]
```

---

### Example 10: Clone and Customize Template

**User Request**: "Create a new template based on Hardware Failure but for critical issues"

**Assistant Conversation**:
```
Assistant: I'll duplicate the Hardware Failure template and modify it for critical issues.

[Navigates to template list]
[Finds: Hardware Failure - Reactive]
[Clicks: Duplicate]
[Template copy created]
[Modifies:]
- Template Name: "Hardware Failure - Critical"
- Subject: "CRITICAL - Hardware Failure - [Device]"
- Priority: Critical
- Urgency: High
- Impact: High
- Additional note: "This template is for critical hardware failures requiring immediate response"

[Saves modified template]

New template created!

Template Name: Hardware Failure - Critical
Based on: Hardware Failure - Reactive
Modifications: Priority set to Critical, Urgency to High
Use Case: Critical hardware failures requiring immediate response

[Screenshot: critical-template.png]
```

---

## Category Management Examples

### Example 11: Create Hierarchical Category Structure

**User Request**: "Set up a complete category structure for our IT department"

**Category Hierarchy to Create**:
```
├── Hardware
│   ├── Server
│   ├── Desktop
│   ├── Laptop
│   └── Networking Equipment
├── Software
│   ├── Operating System
│   ├── Application Error
│   ├── Driver Issue
│   └── License Issue
├── Network
│   ├── Connectivity
│   ├── Switch/Router
│   ├── Firewall
│   └── VPN
├── Database
│   ├── Performance
│   ├── Replication
│   ├── Backup/Recovery
│   └── Corruption
└── Security
    ├── Access Control
    ├── Malware/Virus
    ├── SSL Certificate
    └── Encryption
```

**Assistant Conversation**:
```
Assistant: I'll create a comprehensive category structure with 5 main categories and 17 subcategories.

[Navigates to: /admin/problem-management/categories]
[Clicks: Add Category]

Creating main categories and subcategories...

[Hardware (Main)]
  → Server
  → Desktop
  → Laptop
  → Networking Equipment

[Software (Main)]
  → Operating System
  → Application Error
  → Driver Issue
  → License Issue

[Network (Main)]
  → Connectivity
  → Switch/Router
  → Firewall
  → VPN

[Database (Main)]
  → Performance
  → Replication
  → Backup/Recovery
  → Corruption

[Security (Main)]
  → Access Control
  → Malware/Virus
  → SSL Certificate
  → Encryption

All categories created successfully!

Summary:
✓ 5 main categories
✓ 17 subcategories
✓ Hierarchical structure complete
✓ Ready for problem categorization

[Screenshot: category-hierarchy.png]
```

---

### Example 12: Add Subcategories to Existing Category

**User Request**: "Add more specific subcategories under Hardware: Printer, UPS, and Monitor"

**Assistant Conversation**:
```
Assistant: I'll add three new subcategories under Hardware.

[Navigates to: /admin/problem-management/categories]
[Finds: Hardware category]
[Adds subcategory: Printer]
[Adds subcategory: UPS (Uninterruptible Power Supply)]
[Adds subcategory: Monitor]
[Saves changes]

Three subcategories added to Hardware!

Hardware now includes:
- Server
- Desktop
- Laptop
- Networking Equipment
- Printer (NEW)
- UPS (NEW)
- Monitor (NEW)

[Screenshot: hardware-subcategories.png]
```

---

## Status Configuration Examples

### Example 13: Create Custom Status Workflow

**User Request**: "Set up custom statuses for our problem workflow: Investigating, Awaiting Vendor, Testing, and Approved"

**Statuses to Create**:
1. **Investigating** (Orange #FF9800)
2. **Awaiting Vendor** (Red #F44336)
3. **Testing** (Light Blue #2196F3)
4. **Approved** (Green #4CAF50)

**Assistant Conversation**:
```
Assistant: I'll create four custom statuses for your problem workflow with distinct colors.

[Navigates to: /admin/problem-management/status]
[Clicks: Add Status]

[Status 1: Investigating]
- Name: "Investigating"
- Color: #FF9800 (Orange)
- SLA: Enabled (running)
- Save

[Status 2: Awaiting Vendor]
- Name: "Awaiting Vendor"
- Color: #F44336 (Red)
- SLA: Enabled (paused)
- UC: Enabled
- Save

[Status 3: Testing]
- Name: "Testing"
- Color: #2196F3 (Light Blue)
- SLA: Enabled (running)
- Save

[Status 4: Approved]
- Name: "Approved"
- Color: #4CAF50 (Green)
- SLA: Disabled
- Set as Default: Yes
- Save

All statuses created successfully!

Workflow Order:
1. New (System) - Initial status
2. Investigating (Orange)
3. Awaiting Vendor (Red)
4. Testing (Blue)
5. Approved (Green) - DEFAULT
6. Resolved (System)
7. Closed (System)

[Screenshot: custom-statuses.png]
```

---

### Example 14: Configure SLA Pause Status

**User Request**: "Set 'Awaiting Vendor' status to pause SLA timer while waiting for vendor response"

**Assistant Conversation**:
```
Assistant: I'll configure the "Awaiting Vendor" status to pause SLA while waiting.

[Navigates to: /admin/problem-management/status]
[Finds: Awaiting Vendor]
[Clicks: Edit]
[Checkbox: Enable SLA - CHECKED]
[Option: Pause SLA in this status - CHECKED]
[Saves changes]

Status updated!

Awaiting Vendor Status:
- Color: Red (#F44336)
- SLA Behavior: PAUSED (SLA timer stops in this status)
- Reason: Waiting for vendor action (outside team control)
- Effect: Fair SLA tracking (team not penalized for vendor delays)

[Screenshot: sla-configuration.png]
```

---

## Form Customization Examples

### Example 15: Add Custom Fields for Better Problem Tracking

**User Request**: "Add custom fields to track Root Cause Analysis, First Detected time, and Affected Systems"

**Fields to Add**:
1. **Root Cause Analysis** - Text Area
2. **First Detected** - DateTime
3. **Affected Systems** - Multi-select Dropdown
4. **Configuration Change** - Yes/No Checkbox

**Assistant Conversation**:
```
Assistant: I'll add four custom fields to enhance your problem tracking capability.

[Navigates to: /admin/problem-management/form]
[Opens field palette]

[Field 1: Root Cause Analysis]
- Type: Text Area
- Name: "Root Cause Analysis"
- Hint: "Describe the root cause once investigation is complete"
- Required: Yes (when resolving)
- Max length: 5000 characters
- Position: After Description

[Field 2: First Detected]
- Type: DateTime
- Name: "First Detected"
- Hint: "When was this problem first noticed?"
- Required: Yes
- Allow future dates: No
- Position: After Status

[Field 3: Affected Systems]
- Type: Multi-select Dropdown
- Name: "Affected Systems"
- Options: Server, Workstations, Printers, Network Devices, Database
- Hint: "Select all affected systems"
- Required: No
- Position: After Category

[Field 4: Configuration Change]
- Type: Checkbox
- Name: "Related to Configuration Change"
- Hint: "Check if this problem is related to a recent configuration change"
- Required: No
- Position: After Impact

[Saves form]

All custom fields added successfully!

New Problem Form includes:
✓ Root Cause Analysis (Text Area)
✓ First Detected (DateTime)
✓ Affected Systems (Multi-select)
✓ Configuration Change (Checkbox)

[Screenshot: custom-form.png]
```

---

### Example 16: Reorder Form Fields

**User Request**: "Move the custom fields to appear after the standard fields in a better logical order"

**Assistant Conversation**:
```
Assistant: I'll reorganize the form fields for a more logical workflow.

[Navigates to: /admin/problem-management/form]
[Takes snapshot of current form]

Current order:
1. Subject
2. Description
3. Status
4. Priority
5. [Custom fields mixed in]

New optimal order:
1. Subject
2. Description
3. Category
4. Priority, Urgency, Impact
5. Nature of Problem
6. First Detected (Custom)
7. Affected Systems (Custom)
8. Status
9. Assignee, Technician Group
10. Root Cause Analysis (Custom)
11. Configuration Change (Custom)
12. Tags

[Drags and drops fields to new positions]
[Saves form layout]

Form reordered successfully!

Workflow improved:
- Basic info fields grouped together
- Custom fields in logical positions
- Better user experience
- More intuitive for technicians

[Screenshot: reordered-form.png]
```

---

## Custom Rules Examples

### Example 17: Configure Rules for Problem Resolution

**User Request**: "Require Root Cause and Solution before marking problems as Resolved"

**Assistant Conversation**:
```
Assistant: I'll configure the Resolved Rules to require Root Cause and Solution fields.

[Navigates to: /admin/problem-management/custom-rules]
[Selects: Resolved Rules section]
[Configures Mandatory Fields]:
- ✓ Root Cause
- ✓ Solution
- ✓ Assignee
[Also enables]:
- ✓ At least one worklog
- ✓ At least one collaboration entry

[Saves rules]

Resolved Rules configured!

Requirements to mark problem as Resolved:
1. Root Cause must be filled
2. Solution must be filled
3. Assignee must be set
4. At least one worklog entry
5. At least one collaboration/note

Effect: Ensures complete documentation before resolution.

[Screenshot: resolved-rules.png]
```

---

### Example 18: Configure Required Note Rules

**User Request**: "Force technicians to add notes when changing priority or status"

**Assistant Conversation**:
```
Assistant: I'll set up rules requiring notes when making critical changes.

[Navigates to: /admin/problem-management/custom-rules]
[Selects: Required Note Rules section]
[Checks these fields]:
- ✓ Changes to Priority
- ✓ Changes to Status
- ✓ Changes to Assignee
- ✓ Reopen action
- ✓ Changes to Urgency

[Saves rules]

Required Note Rules configured!

Technicians MUST add a note when:
- Changing problem priority
- Changing problem status
- Changing assignee
- Reopening a problem
- Changing urgency level

Effect: Better audit trail and communication history.

[Screenshot: note-rules.png]
```

---

## Transition Model Examples

### Example 19: Create Standard Problem Workflow

**User Request**: "Create a workflow that takes problems through: New → Assigned → Investigating → Resolved → Closed"

**Workflow Definition**:
- **New** (Initial)
- **Assigned** (When assignee is set)
- **Investigating** (When investigation starts)
- **Resolved** (When solution is found)
- **Closed** (When customer confirms)

**Assistant Conversation**:
```
Assistant: I'll create a standard problem workflow with controlled state transitions.

[Navigates to: /admin/problem-management/models]
[Clicks: Create Model]

Model Configuration:
- Name: "Standard Problem Workflow"
- Module: Problem
- Description: "Linear workflow for standard problem resolution"

Transitions defined:
[New → Assigned]
- Condition: Assignee must be set
- Action: Problem moves to Assigned

[Assigned → Investigating]
- Condition: Assignee is set
- Action: Begin investigation

[Investigating → Awaiting Vendor]
- Condition: None (optional)
- Action: Wait for vendor response

[Awaiting Vendor → Investigating]
- Condition: None (optional)
- Action: Resume after vendor provides info

[Investigating → Resolved]
- Condition: Root Cause filled
- Condition: Solution filled
- Condition: Assignee set
- Action: Problem marked resolved

[Resolved → Closed]
- Condition: None
- Action: Problem closed by customer

[Clicks: Save Model]
[Verifies model created]

Workflow created successfully!

Workflow: Standard Problem Workflow
- 5 main states
- 6 defined transitions
- Clear progression path
- Prevents invalid state changes

[Screenshot: workflow-model.png]
```

---

### Example 20: Create Hardware-Specific Workflow

**User Request**: "Create a specialized workflow for hardware problems with parts ordering steps"

**Workflow Steps**:
1. New
2. Assigned
3. Diagnosing
4. Parts Needed
5. Parts Ordered
6. Parts Received
7. Repair in Progress
8. Testing
9. Resolved
10. Closed

**Assistant Conversation**:
```
Assistant: I'll create a specialized workflow for hardware problems with parts tracking.

[Navigates to: /admin/problem-management/models]
[Creates new model]

Model Name: "Hardware Problem Workflow"
Description: "Specialized workflow for hardware failures with parts ordering and testing"

Transitions:
New → Assigned (Assignee set)
Assigned → Diagnosing (Diagnosis begins)
Diagnosing → Parts Needed (Parts identified)
Parts Needed → Parts Ordered (Parts ordered from vendor)
Parts Ordered → Parts Received (Parts arrive)
Parts Received → Repair in Progress (Repair starts)
Repair in Progress → Testing (Testing phase)
Testing → Resolved (All tests pass)
Resolved → Closed (Customer confirms)

[Also allows]:
Diagnosing → Repair in Progress (If no parts needed)
Parts Needed → Resolved (If parts not critical)

[Saves model]

Hardware workflow created!

Features:
- Tracks parts ordering status
- Allows testing phase
- Flexible for different scenarios
- Better visibility into hardware issues

[Screenshot: hardware-workflow.png]
```

---

## Complete Workflow Examples

### Example 21: Complete Setup for New Organization

**User Request**: "Set up the entire Problem Management system for our new IT department"

**Setup Includes**:
1. Authentication
2. Categories (5 main + 15 subcategories)
3. Statuses (4 custom)
4. Templates (4 specialized)
5. Custom Fields (4 fields)
6. Rules (3 rule sets)
7. Workflow Model

**Assistant Conversation**:
```
Assistant: I'll perform a complete setup of Problem Management for your new IT department. This will take about 20-30 minutes.

PHASE 1: AUTHENTICATION
[Prompts for Motadata admin credentials]
[Logs in successfully]

PHASE 2: CREATE CATEGORIES
[Navigates to: /admin/problem-management/categories]
Creating main categories:
- Hardware
- Software
- Network
- Database
- Security

Creating subcategories:
Hardware: Server, Desktop, Laptop, Networking Equipment, Printer, UPS, Monitor
Software: Operating System, Application Error, Driver Issue, License Issue
Network: Connectivity, Switch/Router, Firewall, VPN
Database: Performance, Replication, Backup/Recovery, Corruption
Security: Access Control, Malware/Virus, SSL Certificate, Encryption

✓ 22 categories created

PHASE 3: CREATE CUSTOM STATUSES
[Navigates to: /admin/problem-management/status]
- New (System - default)
- Investigating (Orange #FF9800)
- Awaiting Vendor (Red #F44336) - SLA paused
- Testing (Blue #2196F3)
- Resolved (System)
- Closed (System)

✓ 4 custom statuses created

PHASE 4: CREATE TEMPLATES
[Navigates to: /admin/problem-management/templates]
Template 1: Hardware Failure - Standard
Template 2: Software Bug Report
Template 3: Network Connectivity Issue
Template 4: Database Performance Issue

✓ 4 templates created

PHASE 5: ADD CUSTOM FIELDS
[Navigates to: /admin/problem-management/form]
- Root Cause Analysis (Text Area)
- First Detected (DateTime)
- Affected Systems (Multi-select)
- Configuration Change (Checkbox)

✓ 4 custom fields added

PHASE 6: CONFIGURE RULES
[Navigates to: /admin/problem-management/custom-rules]
Resolved Rules:
- Require: Root Cause, Solution, Assignee
- Require: At least one worklog

Required Notes:
- Changes to Priority
- Changes to Status
- Changes to Assignee

✓ Rules configured

PHASE 7: CREATE WORKFLOW
[Navigates to: /admin/problem-management/models]
Model: "Standard Problem Workflow"
Transitions:
New → Assigned → Investigating → Resolved → Closed

✓ Workflow created

COMPLETE SETUP SUMMARY
=====================
✓ Categories: 22 (5 main + 17 sub)
✓ Statuses: 4 custom
✓ Templates: 4 specialized
✓ Custom Fields: 4 fields
✓ Rules: Resolved + Note requirements
✓ Workflow: Standard progression

Your Problem Management system is ready!
[Screenshot: setup-complete.png]
[Screenshot: category-structure.png]
[Screenshot: workflow-diagram.png]
```

---

### Example 22: Bulk Problem Import Scenario

**User Request**: "We have 50 existing problems in spreadsheet format that need to be imported"

**Approach**:
1. Analyze spreadsheet format
2. Map columns to Problem Management fields
3. Validate data
4. Create problems in bulk using templates
5. Verify import

**Assistant Conversation**:
```
Assistant: I can help import your 50 problems. Let me start by reviewing the spreadsheet format.

[User uploads spreadsheet: problems_export.csv]

Analyzing spreadsheet structure...

Detected columns:
- Problem ID (existing - will be referenced)
- Subject
- Description
- Category
- Priority
- Status
- Created Date
- Assignee

Data validation:
✓ All required fields present
✓ 48 of 50 rows valid
✗ 2 rows missing Subject (will need review)

Column Mapping:
CSV Subject → Problem Subject
CSV Description → Problem Description
CSV Category → Category dropdown
CSV Priority → Priority dropdown
CSV Status → Status dropdown
CSV Assignee → Technician assignment

Starting bulk import...

[For each valid problem]:
[Navigate to: /admin/problem-management/problems/new]
[Fill form from spreadsheet data]
[Submit]
[Record new Problem ID]

Progress:
✓ Problems 1-10 imported (PRB-002200 to PRB-002209)
✓ Problems 11-20 imported (PRB-002210 to PRB-002219)
✓ Problems 21-30 imported (PRB-002220 to PRB-002229)
✓ Problems 31-40 imported (PRB-002230 to PRB-002239)
✓ Problems 41-48 imported (PRB-002240 to PRB-002247)

Problems requiring review:
✗ Row 26: Missing Subject - SKIPPED
✗ Row 39: Invalid Category - SKIPPED

Import Complete!
✓ 48 of 50 problems imported successfully
✗ 2 problems need manual review

Mapping report:
[Screenshot: import-results.png]
[Exported: import-mapping.csv]
```

---

## Advanced Scenarios

### Example 23: Create Conditional Transitions

**User Request**: "Set up a workflow where problems can only move to Resolved if they have a Root Cause and Solution filled in"

**Workflow Logic**:
- From: Investigating
- To: Resolved
- Conditions:
  - Root Cause Analysis is not empty
  - Solution field is filled
  - Assignee is assigned

**Assistant Conversation**:
```
Assistant: I'll create a workflow with conditional transitions that enforce mandatory fields.

[Navigates to: /admin/problem-management/models]
[Finds: Standard Problem Workflow]
[Clicks: Edit]

Setting up conditional transition:
[From State: Investigating]
[To State: Resolved]

[Add Condition Group 1]:
- Field: Root Cause Analysis
- Operator: is_not_empty
- Value: (required)

[Add Condition Group 2]:
- Field: Solution
- Operator: is_not_empty
- Value: (required)

[Add Condition Group 3]:
- Field: Assignee
- Operator: is_not_empty
- Value: (required)

[Saves model]

Conditional transition created!

Effect:
- Users cannot move to Resolved until Root Cause is filled
- Users cannot move to Resolved until Solution is filled
- Users cannot move to Resolved without assignee
- Prevents incomplete resolutions
- Enforces quality standards

[Screenshot: conditional-transition.png]
```

---

### Example 24: Create Multi-Level Approval Workflow

**User Request**: "Create a workflow where problems need supervisor approval before closing"

**Workflow Design**:
- New → Assigned → Investigating → Resolved
- Resolved → Awaiting Approval (new status for review)
- Awaiting Approval → Approved (supervisor action)
- Approved → Closed

**Assistant Conversation**:
```
Assistant: I'll create a multi-level approval workflow with supervisor review.

PHASE 1: CREATE APPROVAL STATUS
[Navigates to: /admin/problem-management/status]
[Creates new status]
- Name: "Awaiting Approval"
- Color: Yellow #FFC107
- Enable UC: Yes
- Description: "Waiting for supervisor approval before closure"

✓ Status created

PHASE 2: UPDATE WORKFLOW MODEL
[Navigates to: /admin/problem-management/models]
[Creates new model: "Approval-Based Workflow"]

Transitions:
New → Assigned → Investigating → Resolved → Awaiting Approval
Awaiting Approval → Approved (supervisor only)
Approved → Closed

Conditions:
Resolved → Awaiting Approval:
  - Root Cause: Not empty
  - Solution: Not empty

Awaiting Approval → Approved:
  - Role = Supervisor
  - All tasks closed

Approved → Closed:
  - Status change allowed after 24 hours

✓ Workflow created

PHASE 3: ADD APPROVAL FIELD
[Navigates to: /admin/problem-management/form]
[Adds custom field]
- Type: Dropdown
- Name: "Supervisor Approval"
- Options: Pending, Approved, Rejected, Referred Back
- Required: Only when in "Awaiting Approval" status

✓ Field added

Approval workflow complete!

Benefits:
- Quality gate before closure
- Supervisor visibility
- Prevents premature closing
- Improves problem resolution tracking

[Screenshot: approval-workflow.png]
```

---

### Example 25: Set Up SLA-Focused Workflow

**User Request**: "Create a workflow that optimizes for meeting SLA targets"

**Strategy**:
- Track time spent in each status
- Pause SLA for waiting states
- Configure status order for efficiency
- Set up notifications for SLA violations

**Assistant Conversation**:
```
Assistant: I'll create an SLA-optimized workflow with strategic status management.

PHASE 1: CONFIGURE SLA-AWARE STATUSES
[Navigates to: /admin/problem-management/status]

Status Configuration:
[New] - No SLA (Initial assignment phase)
[Assigned] - SLA RUNNING (15 minutes to acknowledge)
[Investigating] - SLA RUNNING (target: 4 hours)
[Awaiting Vendor] - SLA PAUSED (vendor response time not counted)
[Testing] - SLA RUNNING (target: 1 hour)
[Resolved] - SLA RUNNING (customer approval needed)
[Closed] - SLA STOPPED (closed, no longer tracked)

✓ All statuses configured

PHASE 2: CREATE SLA WORKFLOW
[Creates transition model]

Workflow:
New (0 SLA)
  → Assigned (SLA: 15 min acknowledgment)
  → Investigating (SLA: 4 hours resolution)
  → Resolved (SLA: 1 hour customer approval)
  → Closed (SLA: Stopped)

Alternative path for vendor issues:
Investigating → Awaiting Vendor (SLA: PAUSED)
             → Investigating (SLA: RESUME)

✓ Workflow optimized for SLA

PHASE 3: ADD SLA TRACKING FIELDS
[Adds custom fields]
- SLA Due Date (DateTime)
- SLA Status (Dropdown: On Track, At Risk, Breached)
- Time in Current Status (Auto-calculated)

✓ Tracking fields added

PHASE 4: CREATE NOTIFICATION RULES
[Configures alerts]
- Alert at 75% of SLA time: Notify assignee
- Alert at 90% of SLA time: Notify manager
- Alert at 100% of SLA time: Escalate

✓ SLA optimization complete

Results:
- Clear time expectations per status
- Paused timer for external waits
- Better SLA compliance tracking
- Proactive escalation alerts

[Screenshot: sla-workflow.png]
```

---

### Example 26: Team-Specific Categories and Templates

**User Request**: "Create separate categories and templates for different support teams"

**Teams**:
1. Hardware Support
2. Software Development
3. Network Operations
4. Database Administration

**Assistant Conversation**:
```
Assistant: I'll create team-specific category structures and templates.

TEAM 1: HARDWARE SUPPORT
[Creates Hardware category with subcategories]
- Server Issues
- Desktop Support
- Laptop Support
- Printer Support
- Network Equipment

[Creates Hardware templates]
- Hardware Failure Report
- Hardware Replacement Request
- Hardware Upgrade Request

TEAM 2: SOFTWARE DEVELOPMENT
[Creates Software category]
- Bug Reports
- Performance Issues
- Feature Requests
- Library/Dependency Issues
- Build Failures

[Creates Software templates]
- Bug Report Template
- Performance Analysis Template
- Code Review Issue

TEAM 3: NETWORK OPERATIONS
[Creates Network category]
- Network Outage
- Device Connectivity
- Routing Issues
- VPN/Remote Access
- Security/Firewall

[Creates Network templates]
- Network Outage Report
- Device Configuration Issue
- Network Performance Degradation

TEAM 4: DATABASE ADMINISTRATION
[Creates Database category]
- Performance Issues
- Replication/Sync
- Backup Failures
- Corruption/Integrity
- Capacity Planning

[Creates Database templates]
- Database Performance Issue
- Backup/Recovery Problem
- Data Integrity Alert

✓ All team categories created
✓ All team templates created

Benefits:
- Clear problem categorization by team
- Faster ticket creation with templates
- Better reporting and metrics per team
- Consistent quality across teams

[Screenshot: team-categories.png]
[Screenshot: team-templates.png]
```

---

### Example 27: Integration with Change Management

**User Request**: "Link problems to Change Management records and track when changes cause issues"

**Strategy**:
- Add Change ID custom field
- Create "Related to Change" rules
- Track change-related problems separately
- Generate reports on change impact

**Assistant Conversation**:
```
Assistant: I'll create a change management integration with problem tracking.

PHASE 1: ADD CHANGE TRACKING FIELDS
[Navigates to: /admin/problem-management/form]

[Adds custom fields]
- Change ID (Text): References Change Management ticket
- Related to Recent Change (Checkbox): Flag if related to changes
- Change Date (Date): When the change was made
- Change Impact Assessment (Dropdown): Not Related, Low, Medium, High

✓ Fields added

PHASE 2: CREATE CHANGE-SPECIFIC CATEGORY
[Navigates to: /admin/problem-management/categories]
[Adds main category]: Change-Related Issues
[Subcategories]:
- Change Regression
- Change Side Effects
- Change-Triggered Failures
- Incomplete Change Rollback

✓ Categories created

PHASE 3: CREATE CHANGE-RELATED TEMPLATE
[Creates template]: "Change-Related Problem Report"
- Problem Type: Change-Related Issue
- Require: Change ID
- Require: Change Date
- Pre-fill: Related to Recent Change = Yes
- Pre-fill: Impact Assessment = High

✓ Template created

PHASE 4: CONFIGURE CHANGE RULES
[Navigates to: /admin/problem-management/custom-rules]
[Creates custom rule]:
- If: Related to Recent Change = Yes
- Then: Require supervisor review before resolution
- Then: Require CAB (Change Advisory Board) sign-off

✓ Rules configured

Benefits:
- Clear tracking of change-related problems
- Better change impact analysis
- Improved CAB decision making
- Historical data for change evaluation
- Risk reduction for future changes

[Screenshot: change-integration.png]
```

---

## Practical Tips for Users

### Best Practices

1. **Start Simple, Expand Later**
   - Create basic categories first
   - Add complexity after team adjusts
   - Test templates in dev before production

2. **Naming Conventions**
   - Use consistent naming (e.g., "Category > Subcategory")
   - Include priority indicators in templates
   - Use descriptive status names

3. **Field Strategy**
   - Only add fields you'll actually use
   - Group related custom fields together
   - Set sensible defaults

4. **Workflow Design**
   - Map existing process first
   - Allow flexibility for exceptions
   - Include escalation paths
   - Plan SLA pausing carefully

5. **Rule Configuration**
   - Start with minimal rules
   - Increase enforcement gradually
   - Document rule rationale
   - Review quarterly for effectiveness

### Common Pitfalls to Avoid

1. **Over-categorization**: Too many categories confuse users
2. **Overly-complex rules**: Make it hard to create problems
3. **Ignored custom fields**: Add fields people won't use
4. **Inflexible workflows**: Don't allow necessary workarounds
5. **Missing SLA configuration**: Can't track response times properly

### Optimization Tips

1. **Use templates** for 80% of your problem types
2. **Limit custom fields** to 5-7 key fields
3. **Keep workflows simple** with 6-8 main states
4. **Pause SLA** for external waiting states
5. **Review quarterly** and adjust based on metrics

---

## Troubleshooting Common Issues

### Problem Creation Issues

**Issue**: Form validation errors
- Ensure all required fields are filled
- Check field formats match expectations
- Verify dropdown selections are valid
- Check for character length limits

**Issue**: Can't select category
- Verify category exists
- Check category hierarchy depth
- Ensure not using deleted category

### Template Issues

**Issue**: Template not appearing in create form
- Verify template is enabled
- Check user has access level
- Confirm template is saved successfully
- Clear browser cache

**Issue**: Default values not applying
- Verify defaults are set in template
- Check if form fields override defaults
- Confirm template is selected

### Status Transition Issues

**Issue**: Can't transition to next status
- Check workflow model allows transition
- Verify conditions are met (if conditional)
- Ensure required fields are filled
- Check user role has permission

**Issue**: SLA not pausing in status
- Verify "Enable SLA - Pause" is checked
- Ensure not in first status of workflow
- Check SLA is configured in settings

### Custom Field Issues

**Issue**: Custom field not showing on form
- Verify field is marked as "Visible"
- Check field is saved
- Confirm not hidden for user role
- Check field position/page in layout

**Issue**: Field values not saving
- Check field validation rules
- Verify field type matches data
- Ensure required fields are filled
- Check for character limit exceeded

---

## Real-World Metrics

### Expected Setup Times

- Basic setup (categories, statuses): 1-2 hours
- Template creation (4 templates): 1 hour
- Custom fields and form layout: 45 minutes
- Rules configuration: 1 hour
- Workflow modeling: 1-2 hours
- **Total first-time setup**: 5-7 hours

### Benefits Achieved

- **30-40%** faster problem creation with templates
- **25%** better SLA compliance with optimized statuses
- **50%** improvement in documentation with required fields
- **20-30%** faster resolution with guided workflows
- **80%** better audit trail with mandatory notes

### Recommended Maintenance

- Review categories quarterly
- Update templates based on feedback
- Adjust SLA settings semi-annually
- Review workflow effectiveness annually
- Monitor custom field usage

---

## Getting Help

### Resource Documentation

- **SKILL.md**: Overview and quick start guide
- **REFERENCE.md**: Technical selectors and form mappings
- **EXAMPLES.md**: Real-world scenarios (this file)

### Support Contacts

- For Motadata issues: Check Motadata documentation
- For skill issues: Review troubleshooting section
- For workflow design: Consult ITSM best practices

---

## Summary

The Motadata Problem Management skill enables complete lifecycle management of IT problems including:

- Creating and managing problem records
- Designing workflow models
- Creating reusable templates
- Organizing with hierarchical categories
- Tracking with custom statuses and fields
- Enforcing quality with rules
- Optimizing with SLA configuration

Use the examples in this document as starting points for your organization's problem management implementation. Adapt them based on your specific needs and processes.

---

**Last Updated**: 2025-10-29
**Examples Version**: 1.0.0
**Related Files**: SKILL.md, REFERENCE.md
**Difficulty Levels**: Beginner → Advanced
