# Browser Automation Method (Fallback Strategy)

Step-by-step UI automation via Playwright MCP for creating workflows on Automate.com.

## Overview

**Speed**: 60-90 seconds (vs 5-10 seconds for JSON import)

**Success Rate**: 100% (always works)

**When to Use**:
- JSON import failed with "invalid format" error
- First time creating a specific workflow type
- Need to verify correct field structure
- User wants to see UI interaction process

**Advantages**:
- 🛡️ **Reliable**: Always works, no JSON structure issues
- 📚 **Educational**: Shows UI steps and field requirements
- 🔄 **Learning**: Exports correct JSON for future imports
- ✅ **Self-Healing**: Creates templates that fix JSON import

**Prerequisites**:
- Playwright MCP connected (browser automation tools)
- Automate.com account credentials
- API specifications (endpoints, methods, bodies)

---

## Complete Workflow Creation Guide

### Part 1: Login and Navigation

#### Step 1: Navigate to Login Page

```typescript
browser_navigate("https://community.autommate.app/login?to=/")
browser_snapshot()
```

**Wait for**: Login form to appear

#### Step 2: Login with Credentials

```typescript
// Fill login form
browser_fill_form([
  {
    name: "Email",
    type: "textbox",
    ref: "...",  // Get from snapshot
    value: "alimehmetoglu90@gmail.com"
  },
  {
    name: "Password",
    type: "textbox",
    ref: "...",  // Get from snapshot
    value: "your-password"
  }
])

browser_snapshot()
```

#### Step 3: Click Sign In Button

**Important**: Button text is "Sign in Using Credentials" (capital U, C, plural)

```typescript
browser_click("Sign in Using Credentials", ref: "...")
browser_wait_for(text: "Dashboard")
browser_snapshot()
```

#### Step 4: Navigate to Automs Page

**Two-step navigation** (direct URL navigation doesn't work):

```typescript
// Step 1: Click "My Environment" to open submenu
browser_click("My Environment", ref: "...")
browser_wait_for(text: "Automs")
browser_snapshot()

// Step 2: Click "Automs" in submenu
browser_click("Automs", ref: "...")
browser_wait_for(text: "Create New Autom")
browser_snapshot()
```

#### Step 5: Create New Autom

```typescript
browser_click("Create New Autom", ref: "...")
browser_wait_for(text: "Dev Mode")
browser_snapshot()
```

#### Step 6: Enable Dev Mode

**Critical**: Preview Mode does NOT save changes permanently

```typescript
// Click checkbox in top-right
browser_click("Dev Mode checkbox", ref: "...")

// Verify text changes to "Dev Mode Enabled"
browser_wait_for(text: "Dev Mode Enabled")
browser_snapshot()
```

**Verification**: Look for text "Dev Mode Enabled" (not "Preview Mode Enabled")

---

### Part 2: Create POST Action

#### Step 7: Add POST Action

```typescript
// Click plus button to add action
browser_wait_for(text: "Plus")  // ⚡ Optimization: Wait for button
browser_snapshot()
browser_click("Plus button", ref: "...")
browser_wait_for(text: "Add Action")
browser_snapshot()

// Search for "RESTful"
browser_type("RESTful", ref: "...", slowly: true)
browser_wait_for(text: "POST")
browser_snapshot()

// Click POST method
browser_click("POST", ref: "...")
browser_wait_for(text: "Request URI")
browser_snapshot()
```

#### Step 8: Configure POST Action

##### Step 8a: Set Request URI

**Critical Pattern**: Click field BEFORE typing

```typescript
// 1. Wait and click the Request URI field to focus
browser_wait_for(text: "Request URI")  // ⚡ Optimization: Wait for field
browser_snapshot()
browser_click("Request URI field", ref: "...")

// 2. Type the URL
browser_type("https://api.restful-api.dev/objects", ref: "...")

// 3. Verify field filled
browser_snapshot()
```

**Why Click First**: Automate.com fields require explicit focus activation

##### Step 8b: Set Request Body (Optimized with Batching)

```typescript
// ⚡ Optimization: Batch tab click + body field click
browser_wait_for(text: "Body")
browser_snapshot()
browser_click("Body tab", ref: "...")
browser_click("Body textbox", ref: "body-ref")  // Batched in same turn

// Type JSON body
browser_type(
  '{"name": "Apple MacBook Pro 16", "data": {"year": 2019, "price": 1849.99}}',
  ref: "body-ref",
  slowly: true
)

browser_snapshot()
```

##### Step 8c: Set Content-Type

```typescript
// Find Content-Type dropdown
browser_click("Content-Type dropdown", ref: "...")
browser_wait_for(text: "application/json")

// Select application/json
browser_select_option("Content-Type", ref: "...", values: ["application/json"])
browser_snapshot()
```

##### Step 8d: Create Response Variable

**Critical**: Click the "+" button, not the dropdown

```typescript
// Click "+" button next to "Assign Response Body" dropdown
browser_click("Create variable plus button", ref: "...")
browser_wait_for(text: "Variable Name")
browser_snapshot()

// Enter variable name (click first!)
browser_click("Variable Name field", ref: "...")
browser_type("createdObject", ref: "...")
browser_snapshot()

// Set variable type to "object"
browser_click("Variable Type dropdown", ref: "...")
browser_select_option("Variable Type", ref: "...", values: ["object"])

// Save variable
browser_click("Save Variable", ref: "...")
browser_wait_for(text: "createdObject")
browser_snapshot()
```

##### Step 8e: Assign Variable to Response

```typescript
// Select the created variable in "Assign Response Body" dropdown
browser_click("Assign Response Body dropdown", ref: "...")
browser_select_option("Assign Response Body", ref: "...", values: ["createdObject"])
browser_snapshot()
```

##### Step 8f: Save POST Action

```typescript
browser_click("Save Action", ref: "...")
browser_wait_for(text: "Action saved")
browser_snapshot()
```

**Verify**: POST action appears in workflow canvas, no error icon

---

### Part 3: Create PUT Action

#### Step 9: Add PUT Action

```typescript
// Click plus button on canvas
browser_click("Plus button", ref: "...")
browser_wait_for(text: "Add Action")

// Search for "RESTful"
browser_type("RESTful", ref: "...", slowly: true)
browser_wait_for(text: "PUT")

// Click PUT method
browser_click("PUT", ref: "...")
browser_wait_for(text: "Request URI")
browser_snapshot()
```

#### Step 10: Configure PUT Action

##### Step 10a: Set Request URI with Variable Interpolation

**Use `##variableName[property]##` syntax**:

```typescript
// Click Request URI field
browser_click("Request URI field", ref: "...")

// Type URL with variable interpolation
browser_type(
  "https://api.restful-api.dev/objects/##createdObject[id]##",
  ref: "..."
)

browser_snapshot()
```

**How it works**:
- POST action stores response in `createdObject` variable
- PUT action reads `##createdObject[id]##` to get the ID
- At runtime, URL becomes: `https://api.restful-api.dev/objects/123`

##### Step 10b: Set Request Body

```typescript
// Click Body tab
browser_click("Body", ref: "...")
browser_snapshot()

// Click body textbox
browser_click("Body textbox", ref: "...")

// Type JSON body with updated data
browser_type(
  '{"name": "Apple MacBook Pro 16 (Updated)", "data": {"year": 2019, "price": 2049.99}}',
  ref: "...",
  slowly: true
)

browser_snapshot()
```

##### Step 10c: Set Content-Type

```typescript
browser_click("Content-Type dropdown", ref: "...")
browser_select_option("Content-Type", ref: "...", values: ["application/json"])
browser_snapshot()
```

##### Step 10d: Create Response Variable

```typescript
// Click "+" button to create new variable
browser_click("Create variable plus button", ref: "...")

// Enter variable name (click first!)
browser_click("Variable Name field", ref: "...")
browser_type("updatedObject", ref: "...")

// Set variable type to "object"
browser_click("Variable Type dropdown", ref: "...")
browser_select_option("Variable Type", ref: "...", values: ["object"])

// Save variable
browser_click("Save Variable", ref: "...")
browser_wait_for(text: "updatedObject")
browser_snapshot()
```

##### Step 10e: Assign Variable to Response

```typescript
browser_click("Assign Response Body dropdown", ref: "...")
browser_select_option("Assign Response Body", ref: "...", values: ["updatedObject"])
browser_snapshot()
```

##### Step 10f: Save PUT Action

```typescript
browser_click("Save Action", ref: "...")
browser_wait_for(text: "Action saved")
browser_snapshot()
```

---

### Part 4: Create Display Message Action

#### Step 11: Add Display Message Action

```typescript
// Click plus button
browser_click("Plus button", ref: "...")
browser_wait_for(text: "Add Action")

// Search for "Display"
browser_type("Display", ref: "...", slowly: true)
browser_wait_for(text: "Display Message")

// Click Display Message
browser_click("Display Message", ref: "...")
browser_wait_for(text: "Title")
browser_snapshot()
```

#### Step 12: Configure Display Message

##### Step 12a: Enter Title

**Critical**: Click field BEFORE typing (common mistake!)

```typescript
// 1. Click Title field to focus
browser_click("Title field", ref: "...")

// 2. Type title
browser_type("API Response", ref: "...")

// 3. Verify field was filled
browser_snapshot()
```

**If title doesn't appear**: Field wasn't focused. Click again and retry.

##### Step 12b: Enter Message with Variables

**Use `\\n` for line breaks** (double backslash + n):

```typescript
// 1. Click Message field to focus
browser_click("Message field", ref: "...")

// 2. Type message with variable interpolation
browser_type(
  "Created Object ID: ##createdObject[id]##\\nCreated Name: ##createdObject[name]##\\n\\nUpdated Price: ##updatedObject[data][price]##\\nUpdated Name: ##updatedObject[name]##",
  ref: "...",
  slowly: true
)

// 3. Verify field was filled
browser_snapshot()
```

**Variable Syntax**:
- ✅ Correct: `##createdObject[id]##`, `##updatedObject[data][price]##`
- ❌ Wrong: `{{createdObject.id}}`, `${updatedObject.data.price}`

##### Step 12c: Save Display Message Action

```typescript
browser_click("Save Action", ref: "...")
browser_wait_for(text: "Action saved")
browser_snapshot()
```

---

### Part 5: Save and Test Workflow

#### Step 13: Save Workflow

```typescript
// Enter workflow name
browser_click("Workflow name field", ref: "...")
browser_type("MacBook API Workflow", ref: "...")

// Save workflow
browser_click("Save Workflow", ref: "...")
browser_wait_for(text: "Saved successfully")
browser_snapshot()
```

#### Step 14: Test Workflow Execution

```typescript
// Click "Run" button
browser_click("Run", ref: "...")
browser_wait_for(text: "Execution completed")
browser_snapshot()

// Check execution logs
browser_click("View Logs", ref: "...")
browser_snapshot()
```

**Verify**:
- ✅ POST action executed successfully
- ✅ PUT action executed with correct ID
- ✅ Display Message shows populated variables (not literal `##varName##`)

---

### Part 6: Export Working Workflow

**Critical for Self-Healing**: Export provides correct JSON structure for future imports

#### Step 15: Export Workflow

```typescript
// Ensure still in Dev Mode
browser_snapshot()  // Verify "Dev Mode Enabled" text

// Click Export button
browser_click("Export Autom", ref: "...")

// Or use evaluate if button not visible:
browser_evaluate(`
  const exportButton = document.querySelector('.short-export-button');
  if (exportButton) exportButton.closest('.short-import-export-container').click();
`)

browser_wait_for(time: 3)  // Wait for download
browser_snapshot()
```

**Result**: JSON file downloads to browser's download folder

#### Step 16: Save Exported JSON

```bash
# Move exported file to skill directory
mv ~/Downloads/workflow-export.json .playwright-mcp/macbook-flow.json
```

#### Step 17: Update Templates (Self-Healing)

Compare exported JSON with templates in [03-json-templates.md](03-json-templates.md):

1. **Identify differences**: Which metadata fields were missing?
2. **Update templates**: Add missing fields to template repository
3. **Test import**: Next time, JSON import should work 100%

**Example Comparison**:
```bash
# Compare exported JSON with template
diff .playwright-mcp/macbook-flow.json docs/03-json-templates.md
```

**Common Missing Fields**:
- `debugStatus`, `isDebugging`, `debugErrorMessage`
- `tabParent`, `parent_id`
- `image_path`, `libraryLabel`

---

## Critical Patterns

### The Click-Before-Type Pattern

**Problem**: Fields appear to accept input but don't save

**Cause**: Automate.com textboxes require explicit click to activate JavaScript handlers

**Solution**:
```
Step 1: browser_click → Click textbox to focus
Step 2: browser_type → Type content
Step 3: browser_snapshot → Verify filled
```

**Affected Fields**:
- Display Message: Title, Message
- All text inputs in Action Control Center
- Variable creation: Variable Name
- Request URI fields

**Example**:
```typescript
❌ WRONG:
browser_type("API Response", ref: "title-field")
// Field shows text visually but doesn't save

✅ CORRECT:
browser_click("Title field", ref: "title-field")  // Focus first
browser_type("API Response", ref: "title-field")  // Then type
browser_snapshot()  // Verify filled
```

### Variable Interpolation Syntax

**Correct Syntax**:
```
##variableName##                    → Entire variable
##variableName[property]##          → Object property
##variableName[nested][property]##  → Nested property
##arrayVar[0]##                     → Array element (0-indexed)
##arrayVar[6][name]##               → Property of array element
```

**Wrong Syntax**:
```
{{variableName}}         → Shows literal text
$variableName            → Shows literal text
${variableName}          → Shows literal text
##variableName.property## → Doesn't work (use [brackets])
```

### Line Breaks in Messages

**Use**: `\\n` (double backslash + n)

**Example**:
```typescript
browser_type(
  "Line 1\\nLine 2\\nLine 3",
  ref: "message-field"
)
```

**Result**:
```
Line 1
Line 2
Line 3
```

---

## Troubleshooting

### Title/Message Fields Not Saving

**Symptom**: Field appears filled but error says "Required fields missing"

**Solution**: Use click-before-type pattern

```typescript
// 1. Click field to focus
browser_click("Title field", ref: "...")

// 2. Type content
browser_type("My Title", ref: "...")

// 3. Take snapshot to verify
browser_snapshot()

// 4. If still empty, click and try again
browser_click("Title field", ref: "...")
browser_type("My Title", ref: "...", slowly: true)
```

### Variable Not Populating in Display

**Symptom**: Display shows `##variableName##` instead of actual value

**Solutions**:

1. **Check syntax**: Use `##varName##` not `{{varName}}`
2. **Check variable name**: Must match exactly (case-sensitive)
3. **Check action order**: POST must run before Display can show its variables
4. **Check variable assignment**: Verify variable is assigned to response body

### Save Button Disabled

**Symptom**: Can't save action, Save button is grayed out

**Solutions**:

1. Check for "E" error icon on action
2. Click action to see error details
3. Common issues:
   - Request URI empty → Fill it
   - Variable not assigned → Select variable in dropdown
   - Required fields not filled → Use click-before-type pattern

### Variables Not Created

**Symptom**: Variable doesn't appear in dropdown after creation

**Solutions**:

1. **Click the "+" button**, not the dropdown itself
2. Ensure Dev Mode is enabled
3. Refresh page and try again
4. Check browser console for JavaScript errors

### Export Button Not Visible

**Solutions**:

1. Verify "Dev Mode Enabled" text (not "Preview Mode")
2. Use evaluate method:
```typescript
browser_evaluate(`
  const exportButton = document.querySelector('.short-export-button');
  if (exportButton) exportButton.click();
`)
```

---

## Performance Tips & Optimization

### 🚀 Critical Performance Optimizations

Based on execution analysis, these optimizations can reduce turns by 42% (from 48 to ~28 turns):

#### 1. Always Wait Before Actions (Prevents Retries)

**Problem**: 61% of wasted turns come from retry patterns

**Solution**: Add `browser_wait_for` before every action

```typescript
✅ OPTIMIZED (no retries):
browser_wait_for(text: "Button Text")
browser_snapshot()
browser_click("Button", ref: "...")

❌ SLOW (causes retries):
browser_snapshot()
browser_click("Button", ref: "...")  // Not ready → retry → retry
```

#### 2. Batch Independent Operations (Saves Turns)

**Problem**: 26% of wasted turns come from individual tool calls

**Solution**: Combine independent operations in single turns

```typescript
✅ OPTIMIZED (1 turn):
browser_wait_for(text: "Message field")
browser_snapshot()
browser_click("Title field", ref: "title-ref")
browser_type("Title field", ref: "title-ref", text: "API Response")
browser_click("Message field", ref: "msg-ref")
browser_type("Message field", ref: "msg-ref", text: "Result: ##createdObject[id]##")
browser_snapshot()

❌ SLOW (2 turns):
browser_snapshot()
browser_click("Title field", ref: "...")
browser_type("Title field", ref: "...", text: "API Response")

browser_snapshot()
browser_click("Message field", ref: "...")
browser_type("Message field", ref: "...", text: "Result: ##createdObject[id]##")
```

**Batch Opportunities in This Workflow**:
- Tab clicks + field clicks (e.g., Body tab + Body textbox)
- Multiple field configurations (Content-Type + variable assignment)
- Title + Message field filling
- Multiple action saves

#### 3. General Tips

1. **Use snapshots strategically**: After batched operations, not after every action
2. **Wait for elements**: Use `browser_wait_for` to ensure page loaded
3. **Use slowly: true**: For complex inputs that trigger JavaScript
4. **Take screenshots**: On errors, screenshot helps debugging

### Expected Performance After Optimization

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| Turns | 48 | ~28 | 42% reduction |
| Duration | 4.7m | ~4.5m | Slight improvement |
| Retries | 7 | 0 | 100% elimination |
| Cost | $0.1168 | ~$0.08 | ~30% reduction |

---

## Next Steps

After successful browser automation:

1. ✅ **Export workflow** (Step 15-16)
2. ✅ **Save to `.playwright-mcp/`** directory
3. ✅ **Compare with templates** (Step 17)
4. ✅ **Update [03-json-templates.md](03-json-templates.md)** with missing fields
5. ✅ **Next time**: Use JSON import (5-10 seconds instead of 60-90)

**See Also**:
- [01-json-import-method.md](01-json-import-method.md) - Use export for fast imports
- [05-troubleshooting.md](05-troubleshooting.md) - Common issues and solutions
- [04-playwright-mcp-usage.md](04-playwright-mcp-usage.md) - MCP tool reference

---

## Common Workflows

### Simple GET Request

1. Login and navigate (Steps 1-6)
2. Add GET action → Set URI → Save
3. Create variable → Assign to response
4. Add Display Message → Show `##variable##`
5. Save and test
6. Export

### POST → GET Workflow

1. Create POST action → Store in `createdObject`
2. Create GET action → URI: `...##createdObject[id]##`
3. Create variable `fetchedObject` → Assign to GET response
4. Display both variables
5. Export

### Complete CRUD Workflow

1. POST (Create) → `createdObject`
2. GET (Read) → `fetchedObject`
3. PUT (Update) → `updatedObject`
4. DELETE → Use `##createdObject[id]##`
5. Display all results
6. Export

**Time**: ~90 seconds for complete workflow
**Export**: Then import in 5-10 seconds for future use
