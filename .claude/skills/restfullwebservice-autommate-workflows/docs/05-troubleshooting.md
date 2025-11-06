# Troubleshooting Guide

Common issues and their solutions when creating workflows on Automate.com.

## JSON Import Issues

### "The file format to be imported is invalid"

**Cause:** Missing metadata fields in JSON structure

**Solution:**
1. Use complete templates from `03-json-templates.md`
2. Verify ALL metadata fields are present (60+ fields per action)
3. Check for:
   - `hidden`, `inputs`, `status`, `item_id`, `version`, `visible`
   - `actionId`, `parent_id`, `tabParent`, `versionId`
   - `image_path`, `action_name`, `debugStatus`, `isDebugging`
   - `action_label`, `libraryLabel`, `library_name`, `flow_behavior`
   - `application_id`, `debugErrorMessage`

**Quick Fix:**
```bash
# Use the working export template directly
cp docs/03-json-templates.md working-template.json
# Modify only URLs, bodies, variable names
```

### "Invalid header field name" Error

**Cause:** Empty or invalid header in `headerParams`

**Solution:**
1. After import, click the POST/PUT action
2. Find header section in Action Control Center
3. Delete any empty header rows
4. Save autom
5. Run again

**Prevention:**
Use empty array in template:
```json
"headerParams": {"type": "TABLE", "value": [], "isRequired": false}
```

### Import Button Not Visible

**Cause:** Dev Mode not enabled

**Solution:**
1. Open autom editor
2. Find checkbox in top-right (usually says "Preview Mode Enabled")
3. Click checkbox → Text changes to "Dev Mode Enabled"
4. Now click plus button → Import button appears

### "Checking for libraries" Hangs

**Cause:** Missing library reference or network issue

**Solution:**
1. Wait 30 seconds
2. If still loading, refresh page
3. Ensure `libraryName` fields match exactly:
   - `RESTFUL-WEB-SERVICE` (not `RESTFUL_WEB_SERVICE`)
   - `DISPLAY-MESSAGE` (not `DISPLAY_MESSAGE`)
   - `TRIGGER-STATIC` (not `TRIGGER_STATIC`)

---

## Browser Automation Issues

### "Required fields are missing: 'Title'"

**Cause:** Field not properly focused before typing

**Root Cause:** Automate.com textboxes require explicit click before accepting input

**Solution - The Click-Before-Type Pattern:**
```
Step 1: browser_click → Click textbox to focus
Step 2: browser_type → Type content
Step 3: browser_snapshot → Verify filled
```

**Example:**
```
❌ WRONG:
1. browser_type(title_field, "API Response")
   → Field appears to accept but doesn't save

✅ CORRECT:
1. browser_click(title_field)      → Focus first
2. browser_type(title_field, "API Response")  → Then type
3. browser_snapshot()                → Verify filled
```

**Why This Happens:**
- Some Automate.com form fields have JavaScript event handlers
- These handlers only activate on explicit `click` event
- Typing without clicking bypasses the handlers
- Field shows text visually but doesn't save to form state

**Affected Fields:**
- Display Message: Title, Message
- All text inputs in Action Control Center
- Variable creation: Variable Name
- Request URI fields

### Login Button Not Found

**Cause:** Incorrect button text

**Solution:**
Button text is "Sign in Using Credentials" (capital U, C, plural)

Not: "Sign in using credential" or "Sign In Using Credential"

### Can't Navigate to Automs Page

**Cause:** Direct navigation doesn't work

**Solution:**
Use two-step navigation:
1. Click "My Environment" → Opens submenu
2. Click "Automs" in submenu

Don't navigate directly to URL

### Variable Creation Modal Doesn't Open

**Cause:** Clicking dropdown instead of "+" button

**Solution:**
Click the "+" button (plus icon) next to the "Assign Response Body" dropdown, not the dropdown itself

### Save Button Disabled

**Cause:** Validation errors on action

**Solution:**
1. Check for "E" icon on action node (indicates error)
2. Click action to see error details
3. Common issues:
   - Request URI empty
   - Variable not assigned to response
   - Required fields not filled
4. Correct errors
5. Save button will enable

### Display Message Shows Literal Text

**Problem:**
```
Shows: {{apiResponse}}
Instead of: {"id": 123, "name": "test"}
```

**Cause:** Wrong variable syntax

**Solution:**
Automate.com uses `##variableName##` syntax:
- ✅ Correct: `##apiResponse##`
- ❌ Wrong: `{{apiResponse}}`
- ❌ Wrong: `$apiResponse`
- ❌ Wrong: `${apiResponse}`

**Fix:**
1. Click Display Message action
2. Edit Message field
3. Replace `{{` with `##` and `}}` with `##`
4. Save

---

## Variable Interpolation Issues

### Variables Not Populating

**Cause 1:** GET/POST action didn't run before PUT

**Solution:**
Ensure action order is correct:
1. POST creates object → stores in variable
2. PUT uses variable → reads from stored value
3. Display shows variables → reads from both

**Cause 2:** Variable name mismatch

**Solution:**
Verify exact names match:
```json
// In POST action:
"set": {"value": "createdObject"}

// In PUT URL:
"uriAddress": "...//##createdObject[id]##"
             ↑ Names must match exactly
```

**Cause 3:** Syntax error

**Solution:**
Check interpolation syntax:
```
✅ Correct:
##result[id]##
##data[nested][property]##
##arrayVar[0]##

❌ Wrong:
##result.id##          → Use [brackets] not .dot
##data/nested##        → Use [brackets] not /slash
##arrayVar.0##         → Use [0] not .0
```

### Nested Properties Not Working

**Problem:**
```
##result[data.price]## → Shows nothing
```

**Solution:**
Use separate brackets for each level:
```
##result[data][price]## → Works correctly
```

**With Spaces:**
```
##result[data][CPU model]## → Use exact property name
```

### Array Indexing Issues

**Remember:** Arrays are 0-indexed

```
##arrayVar[0]##  → First element
##arrayVar[1]##  → Second element
##arrayVar[6]##  → Seventh element (not sixth!)
```

**Common Mistake:**
```
❌ Wrong: ##allObjects[7][id]##  → Gets 8th element
✅ Correct: ##allObjects[6][id]## → Gets 7th element
```

---

## Playwright MCP Issues

### Snapshot Not Showing Elements

**Cause:** Page not fully loaded

**Solution:**
Add wait before snapshot:
```
browser_wait_for(text="Expected Text")
browser_snapshot()
```

### Click Not Working

**Cause 1:** Wrong ref from snapshot

**Solution:**
Always take fresh snapshot before clicking:
```
browser_snapshot()  → Get current refs
browser_click(element, ref)  → Use fresh ref
```

**Cause 2:** Element not visible

**Solution:**
Scroll element into view:
```
browser_evaluate("document.querySelector('.element').scrollIntoView()")
browser_click(element, ref)
```

### File Upload Not Working

**Cause:** Wrong file path

**Solution:**
Use absolute path:
```
❌ Wrong: .playwright-mcp/flow.json
✅ Correct: C:/Users/.../project/.playwright-mcp/flow.json
```

---

## Platform-Specific Issues

### Dev Mode Changes Not Saving

**Cause:** Still in Preview Mode

**Verification:**
Look for text "Dev Mode Enabled" (not "Preview Mode Enabled")

**Solution:**
1. Click checkbox again if it says "Preview Mode"
2. Verify text changes to "Dev Mode Enabled"
3. Proceed with changes

### Export Button Missing

**Cause:** Not in Dev Mode or button not visible

**Solution:**
```
# Via evaluate:
browser_evaluate(`
  const exportButton = document.querySelector('.short-export-button');
  if (exportButton) exportButton.closest('.short-import-export-container').click();
`)

# Or via text:
browser_click("Export Autom")
```

### Autom Runs But No Output

**Cause:** Display Message not configured

**Solution:**
1. Add Display Message action
2. Configure Title (required)
3. Configure Message with variable references
4. Remember: Click field before typing!

---

## Performance Issues

### 🚀 Execution Taking Too Many Turns

**Baseline:** 48 turns (unoptimized)
**Target:** 25 turns
**Optimized:** ~28 turns

#### Problem 1: Too Many Retries (61% of wasted turns)

**Symptom:** Clicking/typing same element multiple times

**Root Cause:** Not waiting for elements to be ready

**Solution - Always Wait Before Actions:**
```typescript
✅ OPTIMIZED (no retries):
browser_wait_for(text: "Button Text")  // Wait for element
browser_snapshot()
browser_click("Button", ref: "...")

❌ SLOW (causes 2-3 retries):
browser_snapshot()
browser_click("Button", ref: "...")  // Not ready → retry → retry
```

**Apply to:**
- After navigation (wait for page elements)
- Before clicking buttons (wait for button text)
- After actions (wait for success messages)
- Before typing (wait for field interactivity)

#### Problem 2: Not Batching Operations (26% of wasted turns)

**Symptom:** One tool call per turn when multiple are possible

**Root Cause:** Not combining independent operations

**Solution - Batch Independent Operations:**
```typescript
✅ OPTIMIZED (1 turn, saves 2 turns):
browser_wait_for(text: "Message field")
browser_snapshot()
browser_click("Title field", ref: "title-ref")
browser_type("Title field", ref: "title-ref", text: "API Response")
browser_click("Message field", ref: "msg-ref")
browser_type("Message field", ref: "msg-ref", text: "Message text")
browser_snapshot()

❌ SLOW (3 turns):
browser_snapshot()
browser_click("Title field", ref: "...")
browser_type("Title field", ref: "...", text: "API Response")

browser_snapshot()
browser_click("Message field", ref: "...")
browser_type("Message field", ref: "...", text: "Message text")

browser_snapshot()  // Separate verification
```

**Batch Opportunities:**
- Tab clicks + field clicks (Body tab + Body textbox)
- Multiple field fills (Title + Message)
- Sequential dropdowns/selects
- Multiple configuration steps
- Related save operations

**Don't Batch:**
- Actions requiring page navigation between them
- Operations with dependencies
- File uploads
- Actions that trigger page reloads

#### Problem 3: Excessive Snapshots

**Symptom:** Taking snapshot after every tiny action

**Solution - Strategic Snapshots:**
```typescript
✅ OPTIMIZED:
// One snapshot before batched operations
browser_snapshot()
browser_click("Field 1", ref: "ref1")
browser_click("Field 2", ref: "ref2")
browser_click("Field 3", ref: "ref3")
// One snapshot to verify batch
browser_snapshot()

❌ SLOW:
browser_snapshot()
browser_click("Field 1", ref: "ref1")
browser_snapshot()  // Unnecessary
browser_click("Field 2", ref: "ref2")
browser_snapshot()  // Unnecessary
browser_click("Field 3", ref: "ref3")
browser_snapshot()
```

### Import Takes Too Long

**Expected:** 5-10 seconds

**If longer:**
1. Check network connection
2. Verify JSON file size (should be < 100KB)
3. Try browser automation instead

### Browser Automation Too Slow

**Expected:** 60-90 seconds (baseline 4.7 minutes with retries)
**Optimized:** ~2.5 minutes with wait strategies

**If longer:**
1. Check network latency to autommate.app
2. Add browser_wait_for before all actions (reduces retries)
3. Batch independent operations (reduces turns)
4. Use JSON import for future runs (export first)

**Performance Optimization Checklist:**
- [ ] Add browser_wait_for before every click/type
- [ ] Batch independent operations in single turns
- [ ] Minimize snapshots (only before batches and after)
- [ ] Use wait conditions instead of arbitrary time delays
- [ ] Take screenshots only on errors or completion

**Expected Results After Optimization:**
- Turns: ~28 (vs 48 baseline) - 42% reduction
- Retries: 0 (vs 7 baseline) - 100% elimination
- Cost: ~$0.08 (vs $0.12 baseline) - 30% reduction

---

## Error Messages Reference

### "405 Method Not Allowed"

**Meaning:** API doesn't support the HTTP method

**Solution:** This is an API limitation, not configuration error
- Verify API documentation
- Check if endpoint supports POST/PUT/GET/DELETE
- Try different endpoint

### "401 Unauthorized"

**Meaning:** Authentication required

**Solution:**
1. Click action
2. Find "Authentication" dropdown
3. Select authentication type
4. Configure credentials

### "Content-Type Issues"

**Symptom:** Body not sent correctly

**Solution:**
Verify `contentType` field:
```json
"contentType": {
  "value": "application/json",
  "isRequired": true
}
```

Both `body` and `bodyParams` must be present

---

## Debugging Strategies

### Strategy 1: Run Actions Individually

Use "Run Once" button on each action to test:
1. Click action
2. Click "Run Once" (play icon on action)
3. Check execution log
4. Verify variable populated
5. Fix issues before running full workflow

### Strategy 2: Check Execution Logs

Navigate to: Monitoring → History → Log Detail → View All Logs

**Look for:**
- Action execution times
- Variable values at each step
- Error messages
- API request/response details

### Strategy 3: Use Debug Mode Icon

Click debug icon in autom editor toolbar (looks like bug icon)

**Shows:**
- Real-time execution logs
- Variable values
- Action status
- Error details

### Strategy 4: Export and Compare

If JSON import failed:
1. Create workflow via browser automation
2. Export working workflow
3. Compare with original JSON
4. Identify missing fields
5. Update template

---

## Prevention Checklist

Before importing JSON:
- [ ] Used template from `03-json-templates.md`
- [ ] All metadata fields present
- [ ] Variable names match between actions
- [ ] URLs are correct
- [ ] JSON bodies properly escaped
- [ ] `contentType` set to `application/json`
- [ ] `headerParams` is empty array (not missing)
- [ ] Action order numbers are sequential
- [ ] Variable definitions included

Before browser automation:
- [ ] Dev Mode enabled
- [ ] Login successful
- [ ] On correct page (My Environment → Automs)
- [ ] Taking snapshots before each interaction
- [ ] Clicking fields before typing
- [ ] Verifying fields filled after typing

After successful execution:
- [ ] Export workflow
- [ ] Save to `.playwright-mcp/`
- [ ] Update templates if needed
- [ ] Test import with exported JSON

---

## Still Having Issues?

### Diagnostic Steps

1. **Verify Environment**
   - Browser: Chrome/Chromium
   - Playwright MCP: Connected
   - Network: Stable connection
   - Login: Credentials valid

2. **Check Templates**
   - Using latest from `docs/03-json-templates.md`
   - No manual modifications beyond URLs/bodies
   - JSON is valid (use JSON validator)

3. **Test Simple Workflow**
   - Start with single GET action
   - Add Display Message
   - Verify works before adding complexity

4. **Enable Verbose Logging**
   - Use `browser_snapshot()` frequently
   - Take screenshots at each step
   - Check console messages

5. **Fallback to Known Good**
   - Use exact working template without modifications
   - Import → Should work 100%
   - Then modify one field at a time

### Last Resort

If all else fails:
1. Use browser automation method completely
2. Export working workflow
3. Use exported JSON as new template
4. Future imports will work

**Remember:** Browser automation always works (100% success rate)
