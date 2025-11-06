# JSON Import Method (Primary Strategy)

Fast workflow creation via JSON file import to Automate.com Dev Mode.

## Overview

**Speed**: 5-10 seconds (vs 60-90 seconds for browser automation)

**Success Rate**: 100% when using correct JSON structure

**When to Use**:
- User provides API specifications
- Creating complex multi-step flows (POST → PUT → Display)
- Need to create multiple similar workflows quickly
- JSON structure is known/tested

**Prerequisites**:
- Complete JSON templates from [03-json-templates.md](03-json-templates.md)
- Playwright MCP connected
- Automate.com account credentials

---

## JSON Flow Structure

### Complete Flow Template

A workflow consists of:
1. **Flow metadata** - Name, description, settings
2. **Actions array** - TRIGGER, START, actions (POST/PUT/GET/Display), STOP
3. **Variables array** - Variable definitions with metadata

**Minimal Structure**:
```json
{
  "name": "My Workflow",
  "description": "Workflow description",
  "actions": [
    { /* TRIGGER action */ },
    { /* START action */ },
    { /* Your actions (POST, PUT, Display, etc.) */ },
    { /* STOP action */ }
  ],
  "variables": [
    { /* Variable definitions */ }
  ]
}
```

### Action Structure

Every action requires **60+ metadata fields**. See [03-json-templates.md](03-json-templates.md) for complete examples.

**Critical Fields**:
```json
{
  "id": "unique-action-id",
  "name": "ACTION-NAME",
  "type": "standard",
  "order": 1,
  "fields": {
    /* Action-specific configuration */
  },
  "hidden": false,
  "status": true,
  "visible": true,
  "actionId": "...",
  "versionId": "...",
  "library_name": "LIBRARY-NAME",
  "action_name": "ACTION_NAME",
  /* ... 50+ more metadata fields */
}
```

**Library Names** (must be exact):
- `RESTFUL-WEB-SERVICE` - For POST, PUT, GET, DELETE
- `DISPLAY-MESSAGE` - For Display Message
- `TRIGGER-STATIC` - For TRIGGER action

---

## Step-by-Step Import Process

### Step 1: Prepare JSON File

Use templates from [03-json-templates.md](03-json-templates.md):

1. Copy complete POST → PUT → Display template
2. Modify only these fields:
   - URLs in `uriAddress`
   - Request bodies in `body` and `bodyParams`
   - Variable names in `set` fields
   - Display message content
3. Keep all metadata fields unchanged
4. Save to `.playwright-mcp/workflow-name.json`

**Example Customization**:
```json
// Original template
"uriAddress": {"value": "https://api.restful-api.dev/objects"}

// Customized for your API
"uriAddress": {"value": "https://myapi.com/products"}

// Original body
"body": {"value": "{\"name\": \"Apple MacBook Pro 16\", \"data\": {\"year\": 2019, \"price\": 1849.99}}"}

// Customized body
"body": {"value": "{\"name\": \"Dell XPS 15\", \"data\": {\"year\": 2024, \"price\": 2199.99}}"}
```

### Step 2: Login to Automate.com

```typescript
// Using Playwright MCP tools
browser_navigate("https://community.autommate.app/login?to=/")
browser_snapshot()

// Fill login form
browser_fill_form([
  {name: "Email", type: "textbox", ref: "...", value: "your@email.com"},
  {name: "Password", type: "textbox", ref: "...", value: "password"}
])

browser_click("Sign in Using Credentials", ref: "...")
browser_wait_for(text: "Dashboard")
```

### Step 3: Navigate to Automs Page

**Two-step navigation** (direct URL doesn't work):

```typescript
// Step 1: Open submenu
browser_click("My Environment", ref: "...")
browser_wait_for(text: "Automs")

// Step 2: Click Automs in submenu
browser_click("Automs", ref: "...")
browser_wait_for(text: "Create New Autom")
```

### Step 4: Create New Autom

```typescript
browser_click("Create New Autom", ref: "...")
browser_wait_for(text: "Dev Mode")
browser_snapshot()
```

### Step 5: Enable Dev Mode

**Critical**: Preview Mode does NOT save changes permanently

```typescript
// Click checkbox in top-right
browser_click("Dev Mode checkbox", ref: "...")

// Verify text changes to "Dev Mode Enabled"
browser_wait_for(text: "Dev Mode Enabled")
browser_snapshot()
```

### Step 6: Open Import Dialog

```typescript
// Click plus button
browser_click("Plus button", ref: "...")
browser_wait_for(text: "Import")

// Click Import button
browser_click("Import", ref: "...")
browser_wait_for(text: "Choose file")
browser_snapshot()
```

### Step 7: Upload JSON File

**Use absolute path**:

```typescript
browser_file_upload({
  paths: ["C:/Users/.../project/.playwright-mcp/workflow-name.json"]
})

browser_wait_for(text: "Confirm")
browser_snapshot()
```

### Step 8: Confirm Import

```typescript
browser_click("Confirm", ref: "...")
browser_wait_for(text: "Checking for libraries")

// Wait for import to complete (5-10 seconds)
browser_wait_for(time: 10)
browser_snapshot()
```

**Expected Result**: Actions appear in workflow canvas

### Step 9: Verify Import Success

Check for:
- ✅ All actions visible in canvas
- ✅ No error icons ("E" badge) on actions
- ✅ Actions connected in correct order
- ✅ Variables listed in Variables panel

```typescript
browser_snapshot()  // Visual verification
```

### Step 10: Save Workflow

```typescript
// Enter workflow name
browser_click("Workflow name field", ref: "...")
browser_type("My API Workflow", ref: "...")

// Save
browser_click("Save", ref: "...")
browser_wait_for(text: "Saved successfully")
```

---

## Variable Interpolation

### Syntax

Automate.com uses `##variableName##` syntax (NOT `{{varName}}` or `$varName`)

**Basic Examples**:
```
##createdObject##           → Entire object
##createdObject[id]##       → Object property
##apiResponse[data]##       → Nested object
```

### Nested Properties

Use **bracket notation** for each level:

```
✅ Correct:
##result[data][price]##
##result[data][CPU model]##   → Works with spaces

❌ Wrong:
##result.data.price##         → Dot notation doesn't work
##result[data.price]##        → Can't combine syntaxes
```

### Array Indexing

Arrays are **0-indexed**:

```
##arrayVar[0]##              → First element
##arrayVar[1]##              → Second element
##arrayVar[6]##              → Seventh element

##allObjects[0][id]##        → ID of first object
##allObjects[6][name]##      → Name of seventh object
```

### In Request URLs

**PUT Example** - Using ID from previous POST:
```json
{
  "uriAddress": {
    "value": "https://api.restful-api.dev/objects/##createdObject[id]##"
  }
}
```

**Flow**:
1. POST action creates object → stores in `createdObject` variable
2. PUT action reads `##createdObject[id]##` → gets ID value
3. URL becomes: `https://api.restful-api.dev/objects/123`

### In Request Bodies

**Example** - Referencing previous response:
```json
{
  "body": {
    "value": "{\"name\": \"Updated Name\", \"price\": ##createdObject[data][price]##}"
  }
}
```

### In Display Messages

**Example** - Showing multiple variables:
```
Title: "API Response"
Message: "Created ID: ##createdObject[id]##\\nUpdated Price: ##updatedObject[data][price]##"
```

**Line Breaks**: Use `\\n` (double backslash + n)

---

## Variable Definitions

Variables must be defined in the `variables` array with metadata:

```json
{
  "variables": [
    {
      "type": "object",
      "value": "",
      "varName": "createdObject",
      "isLocal": false,
      "variableId": "unique-id",
      "defaultValue": "",
      "variableType": "object"
    },
    {
      "type": "object",
      "value": "",
      "varName": "updatedObject",
      "isLocal": false,
      "variableId": "unique-id-2",
      "defaultValue": "",
      "variableType": "object"
    }
  ]
}
```

**Variable Types**:
- `object` - For API responses (JSON objects)
- `string` - For text values
- `number` - For numeric values
- `array` - For arrays

---

## Common Customizations

### Change API Endpoints

Modify `uriAddress` in POST/PUT/GET actions:

```json
// Template
"uriAddress": {"value": "https://api.restful-api.dev/objects"}

// Your API
"uriAddress": {"value": "https://myapi.com/v1/products"}
```

### Change Request Body

Modify both `body` and `bodyParams` fields:

```json
{
  "body": {
    "value": "{\"name\": \"Your Product\", \"price\": 99.99}"
  },
  "bodyParams": {
    "type": "TABLE",
    "value": [
      ["name", "Your Product"],
      ["price", "99.99"]
    ]
  }
}
```

**Important**: Both fields must match

### Change Variable Names

Update in three places:

1. **Action's `set` field**:
```json
"set": {
  "value": "myVariable",
  "variableType": "object"
}
```

2. **Variable definition**:
```json
{
  "varName": "myVariable",
  "variableType": "object"
}
```

3. **References in other actions**:
```
##myVariable[id]##
```

### Add Authentication Headers

Add to `headerParams` array:

```json
{
  "headerParams": {
    "type": "TABLE",
    "value": [
      ["Authorization", "Bearer your-token-here"],
      ["Content-Type", "application/json"]
    ]
  }
}
```

---

## Error Handling

### "The file format to be imported is invalid"

**Cause**: Missing metadata fields

**Solution**:
1. Use complete template from [03-json-templates.md](03-json-templates.md)
2. Don't remove any metadata fields
3. Only modify URLs, bodies, variable names

**Quick Fix**:
```bash
# Use working template directly
cp docs/03-json-templates.md .playwright-mcp/working-template.json
# Modify only URLs, bodies, variable names
```

### "Invalid header field name"

**Cause**: Empty header in `headerParams`

**Solution**:
Use empty array if no headers needed:
```json
"headerParams": {
  "type": "TABLE",
  "value": [],
  "isRequired": false
}
```

After import, if error persists:
1. Click the POST/PUT action
2. Find header section
3. Delete any empty header rows
4. Save

### Import Button Not Visible

**Cause**: Dev Mode not enabled

**Solution**:
1. Look for checkbox in top-right
2. Click until text says "Dev Mode Enabled" (not "Preview Mode")
3. Plus button → Import button should appear

### "Checking for libraries" Hangs

**Solution**:
1. Wait 30 seconds
2. If still loading, refresh page
3. Ensure library names match exactly:
   - `RESTFUL-WEB-SERVICE` (not `RESTFUL_WEB_SERVICE`)
   - `DISPLAY-MESSAGE` (not `DISPLAY_MESSAGE`)

---

## When JSON Import Fails

**Fallback Strategy**: Switch to [Browser Automation Method](02-browser-automation-method.md)

**Self-Healing Workflow**:
1. JSON import fails → Note the error
2. Use browser automation to create workflow manually
3. Export the working workflow (Dev Mode → Export button)
4. Compare exported JSON with original template
5. Identify missing/incorrect fields
6. Update templates in [03-json-templates.md](03-json-templates.md)
7. Next time: Import works 100%

**See**: [05-troubleshooting.md](05-troubleshooting.md) for detailed error solutions

---

## Performance Tips

1. **Reuse Templates**: Once you have a working export, reuse it for similar workflows
2. **Batch Similar Workflows**: Create one via browser automation, export, then import variations
3. **Validate JSON**: Use a JSON validator before import to catch syntax errors
4. **Keep Metadata**: Never remove metadata fields, even if they seem unused

---

## Next Steps

- **If import succeeds**: Test workflow execution
- **If import fails**: See [02-browser-automation-method.md](02-browser-automation-method.md)
- **For issues**: See [05-troubleshooting.md](05-troubleshooting.md)
- **For templates**: See [03-json-templates.md](03-json-templates.md)
