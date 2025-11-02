# Motadata Problem Management - Troubleshooting Guide

Comprehensive troubleshooting guide for resolving common issues with the Motadata Problem Management skill.

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [Navigation Problems](#navigation-problems)
3. [Form Submission Errors](#form-submission-errors)
4. [Element Not Found Errors](#element-not-found-errors)
5. [Session Management Issues](#session-management-issues)
6. [Template Issues](#template-issues)
7. [Category Management Issues](#category-management-issues)
8. [Status Configuration Issues](#status-configuration-issues)
9. [Custom Field Issues](#custom-field-issues)
10. [Custom Rules Issues](#custom-rules-issues)
11. [Transition Model Issues](#transition-model-issues)
12. [Performance Issues](#performance-issues)
13. [Browser-Specific Issues](#browser-specific-issues)
14. [Playwright MCP Issues](#playwright-mcp-issues)
15. [Data Validation Errors](#data-validation-errors)

---

## Authentication Issues

### Issue 1: Login Failed - Invalid Credentials

**Symptoms**:
- Error message: "Invalid username or password"
- Red border around input fields
- Unable to access admin panel

**Causes**:
- Incorrect username or password
- Caps Lock enabled
- Copy-paste including extra spaces
- Account locked due to multiple failed attempts

**Solutions**:

1. **Verify Credentials**:
   ```
   - Double-check username (case-sensitive)
   - Re-type password manually (avoid copy-paste)
   - Check for Caps Lock
   ```

2. **Test Credentials in Browser**:
   ```
   - Manually login at https://distibilisim.motadataserviceops.com/login
   - Verify account is active
   ```

3. **Contact Admin**:
   ```
   - Check if account is locked
   - Verify user has admin privileges
   - Reset password if needed
   ```

**Prevention**:
- Store credentials securely
- Use password manager
- Test credentials before automation

---

### Issue 2: Login Form Not Found

**Symptoms**:
- Error: "Cannot find element: input[name='username']"
- Skill cannot locate login fields

**Causes**:
- Page not fully loaded
- UI structure changed
- Wrong URL
- Network issues

**Solutions**:

1. **Take Snapshot**:
   ```
   Use mcp__playwright__browser_snapshot to see current page structure
   ```

2. **Verify URL**:
   ```
   Ensure navigated to: /login
   Check for redirects
   ```

3. **Wait for Page Load**:
   ```
   Use mcp__playwright__browser_wait_for with time: 3
   Then retry finding elements
   ```

4. **Try Alternative Selectors**:
   ```css
   /* Try these selectors in order */
   input[name="username"]
   input[type="text"][placeholder*="Username"]
   #username
   .username-input
   ```

**Debug Commands**:
```javascript
// Take screenshot to see what's rendered
mcp__playwright__browser_take_screenshot("login-page-debug.png")

// Get page snapshot
mcp__playwright__browser_snapshot()
```

---

### Issue 3: Two-Factor Authentication (2FA) Prompt

**Symptoms**:
- Login accepted but 2FA code requested
- Cannot proceed past 2FA screen

**Causes**:
- Account has 2FA enabled
- Skill doesn't handle 2FA automatically

**Solutions**:

1. **Prompt User for 2FA Code**:
   ```
   Ask user: "Please enter your 2FA code:"
   Type code into 2FA input field
   Submit
   ```

2. **Handle 2FA Field**:
   ```javascript
   // Detect 2FA prompt
   mcp__playwright__browser_snapshot()

   // Look for: input[name="otp"] or similar
   // Prompt user and type code
   mcp__playwright__browser_type("2FA code", "input[name='otp']", user_code)
   ```

3. **Alternative**:
   ```
   - Use app-specific password if Motadata supports it
   - Contact admin to whitelist automation IP
   ```

---

## Navigation Problems

### Issue 4: Page Not Found (404)

**Symptoms**:
- "404 Not Found" error
- Page displays error message

**Causes**:
- Incorrect URL path
- Feature not enabled in Motadata instance
- Insufficient permissions
- Motadata version incompatibility

**Solutions**:

1. **Verify Base URL**:
   ```
   Correct: https://distibilisim.motadataserviceops.com
   Check for typos
   ```

2. **Check Permissions**:
   ```
   - Verify user has admin access
   - Check Problem Management module is enabled
   ```

3. **Try Alternative Paths**:
   ```
   Instead of: /admin/problem-management/problems
   Try: /admin/problems
   Or: /problems
   ```

4. **Check Motadata Version**:
   ```
   - Older versions may have different URL structure
   - Consult Motadata documentation for version
   ```

---

### Issue 5: Redirect Loop

**Symptoms**:
- Page keeps redirecting
- Never reaches intended destination
- Browser history shows multiple redirects

**Causes**:
- Session expired
- Insufficient permissions
- Misconfigured Motadata instance

**Solutions**:

1. **Re-authenticate**:
   ```
   - Logout completely
   - Clear session
   - Login again
   ```

2. **Check Permissions**:
   ```
   - User may not have access to Problem Management
   - Verify admin role assigned
   ```

3. **Use Direct URLs**:
   ```
   Navigate directly to final destination instead of following menu
   Example: /admin/problem-management/categories
   ```

---

## Form Submission Errors

### Issue 6: Required Field Validation Error

**Symptoms**:
- Form won't submit
- Red border around fields
- Error: "This field is required"

**Causes**:
- Required field left empty
- Field value doesn't meet validation criteria
- Hidden required field

**Solutions**:

1. **Take Snapshot Before Submit**:
   ```
   mcp__playwright__browser_snapshot()
   Review all fields to identify missing data
   ```

2. **Check Common Required Fields**:
   ```
   Problem Record:
   - Subject (always required)
   - Description (usually required)
   - Status
   - Priority
   - Category

   Template:
   - Template Name
   - Template Description
   - Subject
   - Description
   ```

3. **Fill All Fields**:
   ```
   Review REFERENCE.md for complete field list
   Ensure all marked as required are filled
   ```

4. **Check Hidden Fields**:
   ```
   Some fields may be required but hidden
   Use snapshot to identify all input fields
   ```

---

### Issue 7: Form Submission Timeout

**Symptoms**:
- Form submit clicked but nothing happens
- Page hangs or loading indefinitely
- No error message displayed

**Causes**:
- Server-side processing delay
- Large data submission
- Network latency
- JavaScript validation blocking

**Solutions**:

1. **Increase Timeout**:
   ```javascript
   // Wait longer for submission
   mcp__playwright__browser_wait_for({ time: 10 })
   ```

2. **Check for Loading Indicators**:
   ```javascript
   // Wait for loading spinner to disappear
   mcp__playwright__browser_wait_for({ textGone: "Loading..." })
   mcp__playwright__browser_wait_for({ textGone: "Processing..." })
   ```

3. **Verify Submission**:
   ```javascript
   // Look for success message
   mcp__playwright__browser_wait_for({ text: "created successfully" })

   // Or check if redirected to list page
   // Take snapshot to verify current page
   ```

4. **Check Browser Console**:
   ```javascript
   // Get console errors
   mcp__playwright__browser_console_messages({ onlyErrors: true })
   ```

---

### Issue 8: Duplicate Name Error

**Symptoms**:
- Error: "Name already exists"
- Cannot create category/status/template with chosen name

**Causes**:
- Name already in use
- Case-insensitive duplicate
- Soft-deleted item with same name

**Solutions**:

1. **Use Unique Name**:
   ```
   Instead of: "Hardware"
   Try: "Hardware Issues" or "Hardware-2025"
   ```

2. **Check Existing Items**:
   ```
   - Navigate to list view
   - Search for existing name
   - Verify not a duplicate
   ```

3. **Delete Existing Item**:
   ```
   If duplicate is obsolete:
   - Find and delete old item
   - Then create new one
   ```

4. **Use Naming Convention**:
   ```
   Examples:
   - Categories: "CAT-Hardware", "CAT-Software"
   - Statuses: "STS-Investigating", "STS-Resolved"
   - Templates: "TPL-Hardware-Failure"
   ```

---

## Element Not Found Errors

### Issue 9: Button/Link Not Found

**Symptoms**:
- Error: "Cannot find element"
- Skill reports button doesn't exist
- Click operation fails

**Causes**:
- Button not yet loaded
- Wrong selector
- Element hidden or disabled
- UI changed by Motadata update

**Solutions**:

1. **Take Snapshot**:
   ```javascript
   mcp__playwright__browser_snapshot()
   // Examine current page structure
   // Find actual element reference
   ```

2. **Wait Before Clicking**:
   ```javascript
   // Wait for element to be available
   mcp__playwright__browser_wait_for({ time: 2 })
   // Then try clicking
   ```

3. **Try Alternative Selectors**:
   ```css
   /* For "Create" button, try: */
   button:has-text("Create")
   button[type="submit"]
   .btn-primary
   button.create-button
   a[href*="/new"]
   ```

4. **Check Element State**:
   ```
   - Element may be disabled
   - Element may be behind modal
   - Element may require scroll into view
   ```

5. **Scroll to Element**:
   ```javascript
   // Element may be off-screen
   // Playwright usually handles this, but try explicit scroll
   ```

---

### Issue 10: Dropdown Options Not Available

**Symptoms**:
- Cannot select dropdown option
- Option doesn't exist in dropdown
- Dropdown appears empty

**Causes**:
- Dropdown not populated yet
- Dependent field not filled first
- No data in system (e.g., no categories created)

**Solutions**:

1. **Take Snapshot**:
   ```javascript
   mcp__playwright__browser_snapshot()
   // Check dropdown options
   ```

2. **Wait for Dropdown to Populate**:
   ```javascript
   mcp__playwright__browser_wait_for({ time: 2 })
   // Then try selecting
   ```

3. **Fill Dependencies First**:
   ```
   Some dropdowns depend on other fields:
   - Subcategory depends on Category
   - Assignee may depend on Technician Group
   ```

4. **Create Missing Data**:
   ```
   If dropdown is empty because no data exists:
   - Create categories first
   - Create statuses first
   - Then use in problem/template
   ```

5. **Use Alternative Selection Method**:
   ```javascript
   // If select_option doesn't work, try typing
   mcp__playwright__browser_click("dropdown")
   mcp__playwright__browser_type("option text", "input")
   mcp__playwright__browser_press_key("Enter")
   ```

---

## Session Management Issues

### Issue 11: Session Expired Mid-Operation

**Symptoms**:
- Redirect to login page unexpectedly
- Modal: "Your session has expired"
- 401 Unauthorized error

**Causes**:
- Idle timeout (typically 30-60 minutes)
- Long-running operation
- Server restart

**Solutions**:

1. **Detect Session Expiry**:
   ```javascript
   // Check current URL
   if (url.includes("/login")) {
     // Session expired, re-authenticate
   }

   // Check for expiry modal
   if (page_contains("Session Expired")) {
     // Handle modal and re-login
   }
   ```

2. **Re-authenticate Automatically**:
   ```
   - Detect session loss
   - Prompt user for credentials again
   - Resume operation after login
   ```

3. **Keep Session Alive**:
   ```
   For long operations:
   - Break into smaller chunks
   - Periodically refresh page
   - Make lightweight request to keep session active
   ```

---

### Issue 12: Multiple Sessions Conflict

**Symptoms**:
- Changes not saving
- Logged out unexpectedly
- "Another session detected" warning

**Causes**:
- User logged in elsewhere
- Multiple browser tabs/windows
- Another automation script running

**Solutions**:

1. **Close Other Sessions**:
   ```
   - Log out from other browsers/tabs
   - Ensure only one active session
   ```

2. **Use Fresh Browser Context**:
   ```
   - Close and restart browser
   - Clear cookies/cache
   - Start new session
   ```

3. **Coordinate Automation**:
   ```
   If running multiple scripts:
   - Use separate accounts
   - Schedule to run sequentially
   ```

---

## Template Issues

### Issue 13: Template Not Available in Problem Creation

**Symptoms**:
- Created template doesn't appear in template dropdown
- Problem creation form doesn't show template option

**Causes**:
- Template disabled
- Template access level restrictions
- Template not saved properly

**Solutions**:

1. **Verify Template is Enabled**:
   ```
   Navigate to: /admin/problem-management/templates
   Check toggle switch is ON
   ```

2. **Check Access Levels**:
   ```
   Template Settings:
   - Template Technician Access Level: Ensure current user included
   - Template Technician Group Access Level: Ensure user's group included
   ```

3. **Verify Template Saved**:
   ```
   - Navigate to template list
   - Confirm template exists
   - Check for error indicators
   ```

4. **Recreate Template**:
   ```
   If template appears corrupted:
   - Delete template
   - Create new one
   - Verify all fields saved
   ```

---

### Issue 14: Template Fields Not Auto-Populating

**Symptoms**:
- Select template but fields remain empty
- Template doesn't fill form as expected

**Causes**:
- JavaScript error preventing auto-fill
- Template misconfigured
- Browser compatibility issue

**Solutions**:

1. **Check Browser Console**:
   ```javascript
   mcp__playwright__browser_console_messages({ onlyErrors: true })
   // Look for JavaScript errors
   ```

2. **Manual Fill**:
   ```
   If auto-populate doesn't work:
   - Manually fill fields based on template
   - Reference EXAMPLES.md for field mappings
   ```

3. **Wait After Template Selection**:
   ```javascript
   mcp__playwright__browser_select_option("template")
   mcp__playwright__browser_wait_for({ time: 2 })
   // Give time for fields to populate
   ```

4. **Verify Template Configuration**:
   ```
   - Edit template
   - Ensure all default values are set
   - Save template again
   ```

---

## Category Management Issues

### Issue 15: Cannot Delete Category

**Symptoms**:
- Delete button disabled
- Error: "Category in use"
- Warning: "Cannot delete category with existing problems"

**Causes**:
- Category assigned to existing problems
- Category has subcategories
- System-defined category

**Solutions**:

1. **Check for Dependencies**:
   ```
   - Search for problems using this category
   - List all subcategories
   ```

2. **Reassign Problems**:
   ```
   Before deleting:
   - Find all problems with this category
   - Change category to different one
   - Then delete
   ```

3. **Delete Subcategories First**:
   ```
   - Delete child categories first
   - Then delete parent category
   ```

4. **Cannot Delete System Categories**:
   ```
   Default categories cannot be deleted:
   - General
   - Software
   - Hardware
   - Network
   - IT Administration
   ```

---

### Issue 16: Category Hierarchy Not Displaying Correctly

**Symptoms**:
- Subcategories appear as root level
- Parent-child relationship broken
- Drag-and-drop reordering not working

**Causes**:
- Parent reference broken
- UI rendering issue
- Browser cache

**Solutions**:

1. **Refresh Page**:
   ```
   Navigate away and back to categories page
   Force browser refresh
   ```

2. **Recreate Hierarchy**:
   ```
   - Note current structure
   - Delete problematic relationships
   - Recreate subcategories properly
   ```

3. **Edit Parent Assignment**:
   ```
   - Edit subcategory
   - Reassign parent category
   - Save
   ```

---

## Status Configuration Issues

### Issue 17: Status Color Not Displaying

**Symptoms**:
- Status created but color not showing
- Color picker not working
- Status appears in default color

**Causes**:
- Invalid hex color code
- Color picker JavaScript error
- Browser rendering issue

**Solutions**:

1. **Use Valid Hex Code**:
   ```
   Valid: #FF5722, #4CAF50, #2196F3
   Invalid: FF5722 (missing #), red (use hex)
   ```

2. **Try Different Color Input Method**:
   ```
   - Use color picker if available
   - Or type hex code directly
   - Ensure format: #RRGGBB
   ```

3. **Edit Existing Status**:
   ```
   - Edit status
   - Re-select color
   - Save again
   ```

---

### Issue 18: Multiple Default Statuses

**Symptoms**:
- More than one status marked as default
- Confusing behavior in problem creation

**Causes**:
- Bug in Motadata
- Failed to unset previous default

**Solutions**:

1. **Edit Each Status**:
   ```
   - Edit all "default" statuses
   - Uncheck "Set as Default"
   - Save
   - Then set only one as default
   ```

2. **Verify Only One Default**:
   ```
   - Review status list
   - Confirm only one marked as default
   ```

---

## Custom Field Issues

### Issue 19: Custom Field Not Appearing on Form

**Symptoms**:
- Created custom field doesn't show in problem form
- Field exists in form editor but not in actual form

**Causes**:
- Field marked as hidden
- Field not saved properly
- Form not published
- Browser cache

**Solutions**:

1. **Check Field Visibility**:
   ```
   In form editor:
   - Click edit on custom field
   - Ensure "Visible" is checked
   - Save
   ```

2. **Refresh Form**:
   ```
   - Save form editor
   - Navigate to problem creation
   - Hard refresh browser (Ctrl+F5)
   ```

3. **Check Field Position**:
   ```
   - Field may be below fold (scroll down)
   - Field may be in hidden section
   ```

4. **Recreate Field**:
   ```
   - Delete field
   - Create new one
   - Verify immediately in problem form
   ```

---

### Issue 20: Cannot Delete Custom Field

**Symptoms**:
- Delete button disabled or not working
- Warning about data loss

**Causes**:
- Confirmation required
- Field referenced in workflows/rules
- JavaScript dialog not handled

**Solutions**:

1. **Handle Confirmation Dialog**:
   ```javascript
   mcp__playwright__browser_click("delete field button")
   mcp__playwright__browser_handle_dialog({ accept: true })
   ```

2. **Remove Dependencies First**:
   ```
   - Check if field used in custom rules
   - Check if field in transition model conditions
   - Remove those references first
   ```

3. **Acknowledge Data Loss**:
   ```
   Deleting custom field removes ALL data in that field
   for ALL problems. Ensure this is acceptable.
   ```

---

## Custom Rules Issues

### Issue 21: Resolved Rule Not Enforcing

**Symptoms**:
- Problem marked as Resolved without meeting rules
- Validation not working
- Users bypassing rules

**Causes**:
- Rules not saved
- Rules disabled
- User has override permission
- Rule configuration error

**Solutions**:

1. **Verify Rules Saved**:
   ```
   Navigate to: /admin/problem-management/custom-rules
   Review Resolved Rules section
   Ensure checkboxes are checked
   Click "Save Rules"
   ```

2. **Test with Different User**:
   ```
   - Some users may have override permissions
   - Test with regular technician account
   ```

3. **Check Field References**:
   ```
   If requiring mandatory fields:
   - Ensure field names match exactly
   - Ensure fields exist and are visible
   ```

4. **Review Logic**:
   ```
   Rules may have OR logic:
   - "At least one worklog" OR "Solution filled"
   - Verify intended logic
   ```

---

### Issue 22: Required Note Rule Not Triggering

**Symptoms**:
- Status/field changed without note prompt
- Note dialog not appearing

**Causes**:
- Rule not configured for specific field
- JavaScript error
- Browser blocking dialogs

**Solutions**:

1. **Verify Rule Configuration**:
   ```
   Custom Rules > Required Note Rules
   Ensure checkbox for specific field is checked
   Example: ☑ Changes to Status
   Save
   ```

2. **Test in Different Browser**:
   ```
   Some browsers may block dialogs
   Try Chrome or Firefox
   ```

3. **Check Browser Console**:
   ```javascript
   mcp__playwright__browser_console_messages({ onlyErrors: true })
   // Look for JavaScript errors
   ```

---

## Transition Model Issues

### Issue 23: Transition Not Available

**Symptoms**:
- Status change option not shown
- Cannot transition from State A to State B
- Dropdown missing expected status

**Causes**:
- Transition not defined in model
- Condition not met
- Model not enabled

**Solutions**:

1. **Review Transition Model**:
   ```
   Navigate to: /admin/problem-management/models
   Open relevant model
   Verify transition exists: From State → To State
   ```

2. **Check Conditions**:
   ```
   Transition may have conditions:
   - Field must be filled
   - User role requirement
   - Approval status

   Ensure conditions are met
   ```

3. **Enable Model**:
   ```
   - Check if model is enabled
   - Toggle to enable if needed
   ```

4. **Create Missing Transition**:
   ```
   - Edit model
   - Add transition: Current Status → Desired Status
   - Save
   ```

---

### Issue 24: Circular Transition Loop

**Symptoms**:
- Problem stuck cycling between statuses
- Unwanted automatic state changes

**Causes**:
- Misconfigured transition conditions
- Conflicting rules
- Auto-transition on condition

**Solutions**:

1. **Review Model Logic**:
   ```
   Check for:
   - A → B (condition: X)
   - B → A (condition: not X)
   This creates a loop
   ```

2. **Remove Conflicting Transitions**:
   ```
   - Identify loop
   - Remove or modify one transition
   - Add manual approval step
   ```

3. **Add Intermediate State**:
   ```
   Instead of: A ↔ B
   Use: A → Pending → B
   ```

---

## Performance Issues

### Issue 25: Slow Page Load

**Symptoms**:
- Pages take long to load
- Timeout errors
- Browser appears frozen

**Causes**:
- Network latency
- Large data sets
- Server performance
- Heavy page rendering

**Solutions**:

1. **Increase Timeouts**:
   ```javascript
   // Use longer wait times
   mcp__playwright__browser_wait_for({ time: 10 })
   ```

2. **Check Network**:
   ```
   - Test internet connection
   - Ping Motadata server
   - Check VPN if applicable
   ```

3. **Optimize Operations**:
   ```
   - Use direct URLs instead of menu navigation
   - Minimize screenshots
   - Batch similar operations
   ```

4. **Contact Motadata Admin**:
   ```
   If persistent:
   - Server may need optimization
   - Database may need indexing
   - Check server resources
   ```

---

### Issue 26: Browser Memory Issues

**Symptoms**:
- Browser crashes
- Tab becomes unresponsive
- "Out of memory" error

**Causes**:
- Long-running session
- Memory leak in browser/Motadata
- Too many open tabs

**Solutions**:

1. **Restart Browser Session**:
   ```javascript
   // Close and restart browser
   mcp__playwright__browser_close()
   // Start new operation
   ```

2. **Limit Screenshots**:
   ```
   - Only capture when necessary
   - Don't take screenshots in loops
   ```

3. **Break Operations**:
   ```
   For bulk operations:
   - Process in batches of 10-20
   - Restart session between batches
   ```

---

## Browser-Specific Issues

### Issue 27: Chrome-Specific Problems

**Symptoms**:
- Works in Firefox but not Chrome
- Chrome extensions interfering

**Solutions**:

1. **Disable Extensions**:
   ```
   Launch Chrome without extensions
   Or use incognito mode
   ```

2. **Clear Cache**:
   ```
   - Clear browser cache
   - Clear cookies for Motadata domain
   ```

3. **Update Chrome**:
   ```
   - Ensure latest Chrome version
   - Update ChromeDriver if using
   ```

---

### Issue 28: Headless Mode Issues

**Symptoms**:
- Works in headed mode but fails in headless
- Different rendering behavior

**Solutions**:

1. **Switch to Headed Mode**:
   ```
   For debugging, use headed browser to see what's happening
   ```

2. **Adjust Viewport**:
   ```
   Headless may have different viewport size
   Set explicit dimensions: 1920x1080
   ```

3. **Check for Visual Captchas**:
   ```
   Some sites block headless browsers
   May need headed mode for authentication
   ```

---

## Playwright MCP Issues

### Issue 29: Playwright MCP Not Available

**Symptoms**:
- Error: "Tool not available"
- Playwright commands not recognized

**Causes**:
- Playwright MCP not configured
- MCP server not running
- Configuration error

**Solutions**:

1. **Check MCP Configuration**:
   ```
   Verify in .mcp.json:
   {
     "playwright": {
       "command": "npx",
       "args": ["@playwright/mcp@latest"],
       "env": {}
     }
   }
   ```

2. **Install Playwright MCP**:
   ```bash
   npx @playwright/mcp@latest
   ```

3. **Restart Claude Code**:
   ```
   - Close Claude Code
   - Restart application
   - Verify MCP tools available
   ```

4. **Check Logs**:
   ```
   Review Claude Code logs for MCP startup errors
   ```

---

### Issue 30: Playwright Browser Not Installed

**Symptoms**:
- Error: "Browser not installed"
- "Executable doesn't exist at ..."

**Solutions**:

1. **Install Browser**:
   ```javascript
   mcp__playwright__browser_install()
   ```

2. **Manual Install**:
   ```bash
   npx playwright install chrome
   # or
   npx playwright install firefox
   ```

3. **Verify Installation**:
   ```bash
   npx playwright --version
   ```

---

## Data Validation Errors

### Issue 31: Invalid Characters in Field

**Symptoms**:
- Error: "Invalid characters"
- Field validation error

**Causes**:
- Special characters not allowed
- Length exceeded
- Pattern mismatch

**Solutions**:

1. **Check Validation Rules**:
   ```
   Refer to REFERENCE.md for:
   - Allowed characters
   - Max lengths
   - Required patterns
   ```

2. **Sanitize Input**:
   ```
   Remove/replace:
   - Leading/trailing spaces
   - Special characters: <, >, &, "
   - Control characters
   ```

3. **Use Allowed Characters**:
   ```
   Most fields allow:
   - Alphanumeric
   - Spaces
   - Hyphens
   - Underscores
   ```

---

### Issue 32: Date/Time Format Error

**Symptoms**:
- Date field shows validation error
- Cannot submit form with date

**Causes**:
- Wrong date format
- Date out of range
- Time zone issues

**Solutions**:

1. **Use Correct Format**:
   ```
   Common formats:
   - ISO 8601: 2025-10-29T10:30:00Z
   - Date only: 2025-10-29
   - US format: 10/29/2025
   - EU format: 29/10/2025
   ```

2. **Check Field Type**:
   ```
   - Date field: No time component
   - DateTime field: Include time
   - Verify expected format in form
   ```

3. **Test with Manual Entry**:
   ```
   - Manually enter date in browser
   - See what format is accepted
   - Match that format in automation
   ```

---

## General Troubleshooting Process

### Step-by-Step Debugging

1. **Reproduce Issue**:
   ```
   - Note exact steps to reproduce
   - Document error messages
   - Capture screenshots
   ```

2. **Take Snapshot**:
   ```javascript
   mcp__playwright__browser_snapshot()
   // See current page state
   ```

3. **Check Console**:
   ```javascript
   mcp__playwright__browser_console_messages({ onlyErrors: true })
   // Look for JavaScript errors
   ```

4. **Simplify Operation**:
   ```
   - Break down into smaller steps
   - Test each step individually
   - Identify where failure occurs
   ```

5. **Check Documentation**:
   ```
   - Review SKILL.md for correct usage
   - Check REFERENCE.md for selectors
   - Review EXAMPLES.md for patterns
   ```

6. **Test Manually**:
   ```
   - Try operation in browser manually
   - Verify operation is possible
   - Note any differences from automation
   ```

7. **Report Issue**:
   ```
   If unable to resolve:
   - Document all steps taken
   - Include error messages
   - Attach screenshots
   - Note Motadata version
   - Contact Motadata support or skill maintainer
   ```

---

## Common Error Messages Reference

| Error Message | Meaning | Solution |
|---------------|---------|----------|
| "Invalid credentials" | Login failed | Verify username/password |
| "Session expired" | Timeout | Re-authenticate |
| "Element not found" | Selector issue | Take snapshot, find element |
| "This field is required" | Missing data | Fill required field |
| "Name already exists" | Duplicate | Use unique name |
| "Cannot delete" | Dependencies exist | Remove dependencies first |
| "Access denied" | Insufficient permissions | Check user role |
| "Invalid format" | Validation failed | Check field format |
| "Timeout" | Operation too slow | Increase timeout, check network |
| "Connection refused" | Server unreachable | Check URL, network, VPN |

---

## Getting Additional Help

### Resources

1. **Skill Documentation**:
   - SKILL.md: Complete skill guide
   - REFERENCE.md: Technical details and selectors
   - EXAMPLES.md: Usage examples

2. **Motadata Documentation**:
   - `motadata_problem/` directory: Official guides
   - Motadata Help Center
   - Motadata Support Portal

3. **Playwright Documentation**:
   - https://playwright.dev
   - Playwright MCP documentation

4. **Claude Code Documentation**:
   - https://docs.claude.com/en/api/agent-sdk/skills

### Support Contacts

**For Motadata Issues**:
- Motadata Support: support@motadata.com
- Admin Portal: https://distibilisim.motadataserviceops.com/admin/support

**For Skill Issues**:
- Review skill documentation
- Check GitHub issues (if skill is open source)
- Contact skill maintainer

**For Playwright MCP Issues**:
- Playwright GitHub: https://github.com/microsoft/playwright
- MCP Documentation

---

## Diagnostic Checklist

When troubleshooting, verify:

- [ ] Credentials are correct and account has admin access
- [ ] Motadata instance is accessible (ping, browser test)
- [ ] Playwright MCP is configured and running
- [ ] Browser is installed and up to date
- [ ] Network connection is stable
- [ ] Session hasn't expired
- [ ] Correct URL paths are used
- [ ] Required fields are filled
- [ ] Selectors match current UI
- [ ] JavaScript is enabled
- [ ] Browser console shows no errors
- [ ] Operation is possible manually in browser
- [ ] No conflicting browser extensions
- [ ] Latest skill version is being used

---

## Version Information

- **Document Version**: 1.0.0
- **Last Updated**: 2025-10-29
- **Skill Version**: 1.0.0
- **Compatible with**: Motadata ServiceOps ITSM 8.x+

---

**Remember**: Always take a snapshot first to see what's actually on the page. Most issues can be diagnosed by comparing expected vs. actual page structure.