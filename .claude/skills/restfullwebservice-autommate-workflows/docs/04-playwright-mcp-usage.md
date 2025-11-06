# Playwright MCP Tool Usage Guide

Reference guide for using Playwright MCP tools to automate Automate.com workflows.

## Overview

Playwright MCP provides browser automation capabilities through a set of tools that allow you to interact with web pages programmatically.

**Available Tools**:
- `browser_navigate` - Navigate to URLs
- `browser_snapshot` - Capture page state and element references
- `browser_click` - Click elements
- `browser_type` - Type text into fields
- `browser_fill_form` - Fill multiple form fields
- `browser_wait_for` - Wait for conditions
- `browser_evaluate` - Execute JavaScript
- `browser_take_screenshot` - Capture screenshots
- `browser_file_upload` - Upload files
- `browser_press_key` - Press keyboard keys
- `browser_tabs` - Manage browser tabs

---

## Core Tool Patterns

### browser_navigate

Navigate to a URL.

**Usage**:
```typescript
browser_navigate("https://community.autommate.app/login?to=/")
```

**Parameters**:
- `url` (required) - Full URL to navigate to

**When to Use**:
- Initial page load
- Navigating to different sections (though clicking is often better)

**Best Practice**:
Always follow with `browser_snapshot()` to verify page loaded:
```typescript
browser_navigate("https://example.com")
browser_snapshot()  // Verify page loaded
```

**Common Issues**:
- Don't navigate directly to deep URLs on Automate.com (use clicks instead)
- Wait for page to load before interacting

---

### browser_snapshot

Capture accessibility snapshot of the current page. **This is the most important tool.**

**Usage**:
```typescript
browser_snapshot()
```

**Returns**:
- Structured representation of page elements
- Element references (IDs) for use with other tools
- Text content, buttons, inputs, links, etc.

**When to Use**:
- **Before every interaction** - Get fresh element references
- **After actions** - Verify changes occurred
- **During debugging** - See current page state
- **Frequently** - Snapshots are cheap, use liberally

**Best Practice - Always Fresh Refs**:
```typescript
✅ CORRECT:
browser_snapshot()          // Get current page state
browser_click("Button", ref: "abc123")  // Use fresh ref

❌ WRONG:
// Using ref from old snapshot
browser_click("Button", ref: "old-ref-123")  // May be stale
```

**Pattern - Snapshot → Interact → Verify**:
```typescript
// 1. Get current state
browser_snapshot()

// 2. Perform action
browser_click("Save", ref: "...")

// 3. Verify result
browser_wait_for(text: "Saved successfully")
browser_snapshot()  // See new state
```

---

### browser_click

Perform click on a web page element.

**Usage**:
```typescript
browser_click("Save button", ref: "element-ref-from-snapshot")
```

**Parameters**:
- `element` (required) - Human-readable description
- `ref` (required) - Exact element reference from snapshot
- `button` (optional) - "left" (default), "right", "middle"
- `doubleClick` (optional) - Set to true for double-click
- `modifiers` (optional) - ["Shift", "Control", "Alt", etc.]

**Best Practice - Always Describe**:
```typescript
✅ CORRECT:
browser_click("Sign in Using Credentials button", ref: "...")

✅ ALSO GOOD:
browser_click("Save Action button in top right", ref: "...")

❌ VAGUE:
browser_click("Button", ref: "...")
```

**Pattern - Snapshot First**:
```typescript
browser_snapshot()  // Get fresh refs
browser_click("Submit", ref: "ref-from-snapshot")
browser_wait_for(text: "Success")
```

**Common Issues**:
- Using stale refs from old snapshots
- Not waiting for element to be visible
- Clicking too fast (page not loaded)

**Solutions**:
```typescript
// Wait for element to appear
browser_wait_for(text: "Button Text")
browser_snapshot()
browser_click("Button Text", ref: "...")

// Or scroll into view first
browser_evaluate(`
  document.querySelector('.element').scrollIntoView();
`)
browser_snapshot()
browser_click("Element", ref: "...")
```

---

### browser_type

Type text into an editable element.

**Usage**:
```typescript
browser_type("Title field", ref: "...", text: "My Workflow")
```

**Parameters**:
- `element` (required) - Human-readable description
- `ref` (required) - Element reference from snapshot
- `text` (required) - Text to type
- `slowly` (optional) - Type one character at a time (triggers key handlers)
- `submit` (optional) - Press Enter after typing

**Critical for Automate.com - Click Before Type**:
```typescript
✅ CORRECT:
browser_click("Title field", ref: "abc123")  // Focus first
browser_type("Title field", ref: "abc123", text: "My Title")  // Then type
browser_snapshot()  // Verify filled

❌ WRONG:
browser_type("Title field", ref: "abc123", text: "My Title")
// Field shows text but doesn't save (Automate.com specific issue)
```

**When to Use `slowly: true`**:
- Complex inputs that trigger JavaScript on keypress
- Search fields with autocomplete
- Fields that validate as you type

**Example**:
```typescript
// Search with autocomplete
browser_type("Search", ref: "...", text: "RESTful", slowly: true)
browser_wait_for(text: "POST")
```

**With Submit**:
```typescript
browser_type("Search field", ref: "...", text: "query", submit: true)
// Equivalent to typing then pressing Enter
```

---

### browser_fill_form

Fill multiple form fields at once.

**Usage**:
```typescript
browser_fill_form([
  {
    name: "Email",
    type: "textbox",
    ref: "email-ref",
    value: "user@example.com"
  },
  {
    name: "Password",
    type: "textbox",
    ref: "password-ref",
    value: "password123"
  },
  {
    name: "Remember me",
    type: "checkbox",
    ref: "checkbox-ref",
    value: "true"
  }
])
```

**Parameters**:
- `fields` (required) - Array of field objects

**Field Object**:
- `name` (required) - Human-readable field name
- `type` (required) - "textbox", "checkbox", "radio", "combobox", "slider"
- `ref` (required) - Element reference from snapshot
- `value` (required) - Value to fill (string "true"/"false" for checkbox)

**When to Use**:
- Login forms
- Multi-field forms where all fields are visible
- Simple forms without complex JavaScript

**When NOT to Use**:
- Automate.com forms (use click-before-type pattern instead)
- Forms with dynamic fields (use individual clicks/types)

**Best Practice**:
```typescript
// Get fresh snapshot first
browser_snapshot()

// Fill form
browser_fill_form([...])

// Verify filled
browser_snapshot()
```

---

### browser_wait_for

Wait for text to appear/disappear or specified time.

**Usage**:
```typescript
// Wait for text to appear
browser_wait_for(text: "Saved successfully")

// Wait for text to disappear
browser_wait_for(textGone: "Loading...")

// Wait for time (seconds)
browser_wait_for(time: 5)
```

**Parameters**:
- `text` (optional) - Text to wait for to appear
- `textGone` (optional) - Text to wait for to disappear
- `time` (optional) - Seconds to wait

**When to Use**:
- After navigation - Wait for page elements
- After actions - Wait for success messages
- Before interactions - Ensure element loaded
- Delays - Give page time to process

**Best Practices**:
```typescript
// After navigation
browser_navigate("...")
browser_wait_for(text: "Expected Page Title")
browser_snapshot()

// After clicking
browser_click("Save", ref: "...")
browser_wait_for(text: "Saved successfully")
browser_snapshot()

// For async operations
browser_click("Import", ref: "...")
browser_wait_for(text: "Checking for libraries")
browser_wait_for(time: 10)  // Give import time to complete
browser_snapshot()
```

**Avoid Long Waits**:
```typescript
❌ WRONG:
browser_wait_for(time: 30)  // Too long

✅ BETTER:
browser_wait_for(text: "Expected Element")  // Wait for condition
```

---

### browser_evaluate

Execute JavaScript in the browser context.

**Usage**:
```typescript
// Execute JavaScript on page
browser_evaluate(`
  console.log('Hello from browser');
  return document.title;
`)

// Execute on specific element
browser_evaluate(
  `(element) => { element.scrollIntoView(); }`,
  ref: "element-ref"
)
```

**Parameters**:
- `function` (required) - JavaScript code as string
- `element` (optional) - Element description (requires ref)
- `ref` (optional) - Element reference (requires element)

**When to Use**:
- Click hidden elements
- Scroll elements into view
- Get computed values
- Trigger JavaScript events
- Debug page state

**Examples**:

**Click Hidden Element**:
```typescript
browser_evaluate(`
  const exportButton = document.querySelector('.short-export-button');
  if (exportButton) exportButton.click();
`)
```

**Scroll Into View**:
```typescript
browser_evaluate(`
  document.querySelector('.element-class').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
`)
```

**Get Page Data**:
```typescript
browser_evaluate(`
  return {
    title: document.title,
    url: window.location.href,
    cookies: document.cookie
  };
`)
```

**Trigger Event**:
```typescript
browser_evaluate(`
  const event = new Event('change', { bubbles: true });
  document.querySelector('input').dispatchEvent(event);
`)
```

**Best Practice - Use as Last Resort**:
Prefer using proper MCP tools (click, type, etc.) over evaluate when possible. Use evaluate for:
- Elements that tools can't interact with
- Complex page manipulation
- Debugging

---

### browser_file_upload

Upload files through file input.

**Usage**:
```typescript
browser_file_upload({
  paths: ["C:/Users/.../project/.playwright-mcp/workflow.json"]
})
```

**Parameters**:
- `paths` (required) - Array of absolute file paths

**Critical - Use Absolute Paths**:
```typescript
✅ CORRECT:
browser_file_upload({
  paths: ["C:/Users/Ali/Documents/Projects/claude_agent_ui/.playwright-mcp/flow.json"]
})

❌ WRONG:
browser_file_upload({
  paths: [".playwright-mcp/flow.json"]  // Relative path may fail
})
```

**Pattern - Wait for File Chooser**:
```typescript
// Click import button
browser_click("Import", ref: "...")
browser_wait_for(text: "Choose file")

// Upload file
browser_file_upload({
  paths: ["C:/absolute/path/to/file.json"]
})

// Wait for upload
browser_wait_for(text: "File uploaded")
browser_snapshot()
```

**Multiple Files**:
```typescript
browser_file_upload({
  paths: [
    "C:/path/to/file1.json",
    "C:/path/to/file2.json"
  ]
})
```

**Cancel Upload**:
```typescript
// Omit paths to cancel
browser_file_upload({paths: []})
```

---

### browser_take_screenshot

Capture screenshot of page or element.

**Usage**:
```typescript
// Full viewport screenshot
browser_take_screenshot()

// Full page screenshot
browser_take_screenshot({fullPage: true})

// Element screenshot
browser_take_screenshot({
  element: "Error message",
  ref: "element-ref"
})

// Save to specific file
browser_take_screenshot({
  filename: "error-state.png",
  type: "png"
})
```

**Parameters**:
- `element` (optional) - Element to screenshot (requires ref)
- `ref` (optional) - Element reference (requires element)
- `filename` (optional) - Save filename (defaults to `page-{timestamp}.png`)
- `fullPage` (optional) - Screenshot full scrollable page (can't use with element)
- `type` (optional) - "png" (default) or "jpeg"

**When to Use**:
- Debugging - Capture error states
- Verification - Visual proof of completion
- Documentation - Generate guides
- Errors - Understand what went wrong

**Best Practice - Screenshot on Errors**:
```typescript
try {
  browser_click("Save", ref: "...")
  browser_wait_for(text: "Saved")
} catch {
  browser_take_screenshot({
    filename: "save-error.png",
    fullPage: true
  })
  // Now can see full page state
}
```

**Note**: Use `browser_snapshot()` for interactions, `browser_take_screenshot()` for visual verification.

---

### browser_press_key

Press keyboard keys.

**Usage**:
```typescript
// Press single key
browser_press_key("Enter")
browser_press_key("Escape")
browser_press_key("Tab")

// Type character
browser_press_key("a")
```

**Parameters**:
- `key` (required) - Key name or character

**Common Keys**:
- `Enter`, `Escape`, `Tab`, `Backspace`, `Delete`
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- `PageUp`, `PageDown`, `Home`, `End`
- `Control`, `Shift`, `Alt`, `Meta`

**When to Use**:
- Submit forms (Enter)
- Close modals (Escape)
- Navigate UI (Tab, arrows)
- Keyboard shortcuts

**Example**:
```typescript
// Submit search
browser_click("Search field", ref: "...")
browser_type("Search field", ref: "...", text: "query")
browser_press_key("Enter")

// Close modal
browser_press_key("Escape")
```

---

### browser_tabs

Manage browser tabs.

**Usage**:
```typescript
// List all tabs
browser_tabs({action: "list"})

// Create new tab
browser_tabs({action: "new"})

// Select tab by index
browser_tabs({action: "select", index: 1})

// Close tab by index (or current if omitted)
browser_tabs({action: "close", index: 2})
browser_tabs({action: "close"})  // Close current
```

**Parameters**:
- `action` (required) - "list", "new", "close", "select"
- `index` (optional) - Tab index (0-based) for close/select

**When to Use**:
- Multi-page workflows
- Opening external links
- Managing multiple sessions

**Example**:
```typescript
// Open link in new tab
browser_tabs({action: "new"})
browser_navigate("https://example.com")

// Switch back to original tab
browser_tabs({action: "select", index: 0})
```

---

## Performance Optimization Patterns

### Batching Operations (CRITICAL FOR PERFORMANCE)

**Problem**: Making individual tool calls wastes turns (26% of baseline execution time)

**Solution**: Batch independent operations into single turns

#### Pattern 1: Batch Independent Clicks

```typescript
✅ OPTIMIZED (1 turn, saves 2 turns):
browser_wait_for(text: "Field 3")  // Ensure page ready
browser_snapshot()  // Get all refs at once
browser_click("Field 1", ref: "ref1")
browser_click("Field 2", ref: "ref2")
browser_click("Field 3", ref: "ref3")
browser_snapshot()  // Verify all completed

❌ SLOW (3 turns):
browser_snapshot()
browser_click("Field 1", ref: "ref1")

browser_snapshot()
browser_click("Field 2", ref: "ref2")

browser_snapshot()
browser_click("Field 3", ref: "ref3")
```

#### Pattern 2: Batch Form Field Interactions

```typescript
✅ OPTIMIZED (1 turn after initial snapshot):
browser_snapshot()  // Get all refs
browser_click("Title field", ref: "title-ref")
browser_type("Title field", ref: "title-ref", text: "My Title")
browser_click("Message field", ref: "msg-ref")
browser_type("Message field", ref: "msg-ref", text: "My Message")
browser_snapshot()  // Verify all filled

❌ SLOW (2 turns):
browser_snapshot()
browser_click("Title field", ref: "...")
browser_type("Title field", ref: "...", text: "My Title")

browser_snapshot()
browser_click("Message field", ref: "...")
browser_type("Message field", ref: "...", text: "My Message")
```

#### Pattern 3: Batch Configuration Steps

```typescript
✅ OPTIMIZED (1 turn):
browser_wait_for(text: "Content-Type")
browser_snapshot()
browser_click("Body tab", ref: "body-tab-ref")
browser_click("Content-Type dropdown", ref: "ct-ref")
browser_select_option("Content-Type", ref: "ct-ref", values: ["application/json"])
browser_snapshot()

❌ SLOW (2-3 turns):
browser_click("Body tab", ref: "...")
browser_snapshot()

browser_click("Content-Type dropdown", ref: "...")
browser_select_option("Content-Type", ref: "...", values: ["application/json"])
```

#### When to Batch

**Batch These**:
- ✅ Multiple clicks on same page (tabs, buttons, dropdowns)
- ✅ Sequential form filling (click → type → click → type)
- ✅ Multiple selects/dropdowns
- ✅ Configuration steps without dependencies
- ✅ Multiple verifications

**Don't Batch These**:
- ❌ Actions requiring page navigation between them
- ❌ Operations with dependencies (one must complete before next)
- ❌ Actions that trigger page reloads
- ❌ File uploads (need separate turns)
- ❌ Actions requiring wait_for between them

#### Batching Decision Tree

```
Is action independent of previous action?
├─ Yes: Can batch
│  └─ Does it need fresh page state?
│     ├─ No: Batch it ✅
│     └─ Yes: Separate turn ❌
└─ No: Separate turn (dependency) ❌
```

### Wait Strategy Patterns (CRITICAL FOR REDUCING RETRIES)

**Problem**: Clicking/typing before elements ready causes retries (61% of baseline execution time)

**Solution**: Always use browser_wait_for before actions

#### Pattern 1: Wait Before Every Action

```typescript
✅ OPTIMIZED (no retries):
browser_wait_for(text: "Button Text")  // Wait for element
browser_snapshot()
browser_click("Button", ref: "...")

❌ SLOW (causes 2-3 retries):
browser_snapshot()
browser_click("Button", ref: "...")  // Not ready → retry → retry → success
```

#### Pattern 2: Wait After Navigation

```typescript
✅ OPTIMIZED:
browser_navigate("https://example.com")
browser_wait_for(text: "Expected Page Element")  // Wait for load
browser_snapshot()
browser_click("Element", ref: "...")

❌ SLOW:
browser_navigate("https://example.com")
browser_snapshot()  // Too fast, page not loaded
browser_click("Element", ref: "...")  // Element not found → retry
```

#### Pattern 3: Wait After Actions

```typescript
✅ OPTIMIZED:
browser_click("Save", ref: "...")
browser_wait_for(text: "Saved successfully")  // Wait for confirmation
browser_snapshot()

❌ SLOW:
browser_click("Save", ref: "...")
browser_snapshot()  // Too fast, message not shown yet
// Retry to verify → wasted turns
```

#### Pattern 4: Combined Wait + Batch

```typescript
✅ OPTIMIZED (best performance):
// Wait for page state
browser_wait_for(text: "Last Element")

// Get all refs and batch operations
browser_snapshot()
browser_click("Field 1", ref: "ref1")
browser_click("Field 2", ref: "ref2")
browser_click("Field 3", ref: "ref3")

// Wait for result
browser_wait_for(text: "Success")
browser_snapshot()

❌ SLOW (no waits, no batching):
browser_snapshot()
browser_click("Field 1", ref: "...")

browser_snapshot()
browser_click("Field 2", ref: "...")

browser_snapshot()
browser_click("Field 3", ref: "...")
// Multiple retries on each click
```

---

## Common Patterns

### Login Pattern (Optimized)

```typescript
browser_navigate("https://community.autommate.app/login?to=/")
browser_wait_for(text: "Sign in Using Credentials")  // Wait for page
browser_snapshot()

browser_fill_form([
  {name: "Email", type: "textbox", ref: "...", value: "user@example.com"},
  {name: "Password", type: "textbox", ref: "...", value: "password"}
])

browser_snapshot()
browser_click("Sign in Using Credentials", ref: "...")
browser_wait_for(text: "Dashboard")  // Wait for login
browser_snapshot()
```

### Form Filling Pattern (Automate.com Specific)

```typescript
// For each field:
browser_snapshot()  // Get ref
browser_click("Field name", ref: "...")  // Focus field
browser_type("Field name", ref: "...", text: "Value")  // Type value
browser_snapshot()  // Verify filled
```

### Navigation Pattern (Automate.com)

```typescript
// Don't navigate directly, use clicks
browser_click("My Environment", ref: "...")
browser_wait_for(text: "Automs")
browser_snapshot()

browser_click("Automs", ref: "...")
browser_wait_for(text: "Create New Autom")
browser_snapshot()
```

### File Import Pattern

```typescript
browser_click("Import", ref: "...")
browser_wait_for(text: "Choose file")
browser_snapshot()

browser_file_upload({
  paths: ["C:/absolute/path/to/file.json"]
})

browser_wait_for(text: "Confirm")
browser_snapshot()

browser_click("Confirm", ref: "...")
browser_wait_for(text: "Import complete")
browser_snapshot()
```

### Error Handling Pattern

```typescript
// Try action
browser_click("Save", ref: "...")

// Wait for result
browser_wait_for(time: 2)
browser_snapshot()

// Check for error
// If error visible in snapshot:
browser_take_screenshot({filename: "error.png"})
// Take corrective action
```

### Verification Pattern

```typescript
// Perform action
browser_click("Save", ref: "...")

// Wait for confirmation
browser_wait_for(text: "Saved successfully")

// Verify visually
browser_snapshot()

// Optional: Screenshot proof
browser_take_screenshot({filename: "success.png"})
```

---

## Best Practices

### 1. Always Use Fresh Snapshots

```typescript
✅ CORRECT:
browser_snapshot()  // Fresh snapshot
browser_click("Button", ref: "current-ref")

❌ WRONG:
// Using ref from 10 steps ago
browser_click("Button", ref: "old-ref")
```

### 2. Wait for Page State

```typescript
✅ CORRECT:
browser_click("Submit", ref: "...")
browser_wait_for(text: "Success")  // Wait for confirmation
browser_snapshot()

❌ WRONG:
browser_click("Submit", ref: "...")
browser_snapshot()  // Too fast, page still loading
```

### 3. Descriptive Element Names

```typescript
✅ CORRECT:
browser_click("Save Workflow button in top toolbar", ref: "...")

❌ VAGUE:
browser_click("Button", ref: "...")
```

### 4. Verify Actions

```typescript
✅ CORRECT:
browser_type("Title", ref: "...", text: "My Title")
browser_snapshot()  // Verify field filled

❌ RISKY:
browser_type("Title", ref: "...", text: "My Title")
// No verification, may have failed silently
```

### 5. Use Evaluate Sparingly

```typescript
✅ PREFER MCP TOOLS:
browser_click("Button", ref: "...")

❌ OVERUSING EVALUATE:
browser_evaluate(`document.querySelector('.btn').click()`)
```

Only use evaluate when MCP tools can't accomplish the task.

---

## Debugging Techniques

### 1. Frequent Snapshots

```typescript
browser_snapshot()  // Before action
browser_click("Button", ref: "...")
browser_snapshot()  // After action - see what changed
```

### 2. Screenshots on Errors

```typescript
browser_click("Save", ref: "...")
browser_wait_for(time: 2)
browser_take_screenshot({filename: "after-save.png", fullPage: true})
```

### 3. Console Logging

```typescript
browser_evaluate(`
  console.log('Current state:', {
    title: document.title,
    url: location.href,
    forms: document.forms.length
  });
`)
```

### 4. Slow Down

```typescript
// Add waits to see what's happening
browser_click("Button", ref: "...")
browser_wait_for(time: 2)  // Give time to observe
browser_snapshot()
```

### 5. Check Element Visibility

```typescript
browser_evaluate(`
  const el = document.querySelector('.element');
  return {
    exists: !!el,
    visible: el ? el.offsetParent !== null : false,
    display: el ? getComputedStyle(el).display : 'N/A'
  };
`)
```

---

## Common Issues

### Stale Element References

**Problem**: Click fails with "element not found"

**Cause**: Using ref from old snapshot

**Solution**: Always take fresh snapshot before interaction

### Element Not Visible

**Problem**: Element exists but can't click

**Solution**: Scroll into view
```typescript
browser_evaluate(`document.querySelector('.el').scrollIntoView()`)
browser_snapshot()
browser_click("Element", ref: "...")
```

### Page Not Loaded

**Problem**: Elements missing in snapshot

**Solution**: Wait for key elements
```typescript
browser_navigate("...")
browser_wait_for(text: "Expected Page Element")
browser_snapshot()
```

### Form Fields Not Saving

**Problem**: Type succeeds but field doesn't save (Automate.com specific)

**Solution**: Use click-before-type pattern
```typescript
browser_click("Field", ref: "...")  // Focus first
browser_type("Field", ref: "...", text: "Value")  // Then type
```

---

## Performance Tips

1. **Batch Snapshots**: Don't snapshot after every tiny action
2. **Use Waits Wisely**: Wait for conditions, not arbitrary times
3. **Minimize Evaluates**: Use MCP tools when possible
4. **Parallel Actions**: When possible, perform independent actions together

---

## Summary

**Most Important Tools**:
1. `browser_snapshot()` - Use before every interaction
2. `browser_click()` - Primary interaction method
3. `browser_type()` - Text input (with click-before-type on Automate.com)
4. `browser_wait_for()` - Ensure page ready

**Golden Rules**:
- ✅ Fresh snapshot before every interaction
- ✅ Wait for page state changes
- ✅ Verify actions completed
- ✅ Click before type (Automate.com)
- ✅ Use descriptive element names

**See Also**:
- [01-json-import-method.md](01-json-import-method.md) - JSON import workflow
- [02-browser-automation-method.md](02-browser-automation-method.md) - Complete automation guide
- [05-troubleshooting.md](05-troubleshooting.md) - Common issues
