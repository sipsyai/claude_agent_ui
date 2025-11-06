# Automate.com Workflow Creation - Examples

This document provides detailed examples and scenarios for using the `automating-autommate-workflows` skill.

## Example 1: Basic Workflow Creation (Current Implementation)

### User Request

```
"Create a new autom on Automate.com that fetches product data from the REST API and displays it"
```

### Execution Flow

**Step 1-6: Authentication**
```
1. Navigate to https://community.autommate.app/login?to=/
2. Snapshot page
3. Click "Sign in using credential"
4. Snapshot login form
5. Fill credentials:
   - Email: alimehmetoglu90@gmail.com
   - Password: a2373040aA!
6. Click submit
7. Wait for redirect to /my-environment/automs
```

**Step 7-12: Autom Creation**
```
8. Snapshot automs page
9. Click "Create New Autom"
10. Snapshot modal
11. Fill form:
    - Autom Name: "claude"
    - Autom Type: "Autom"
12. Click Create
13. Wait for flow editor
```

**Step 13-24: Flow Configuration**
```
14. Snapshot flow editor
15. Click + button between Start and Stop
16. Snapshot action menu
17. Select RESTful Web Service → GET
18. Snapshot Action Control Center
19. Configure GET request:
    - URL: https://api.restful-api.dev/objects
20. Configure response variable:
    - Name: apiResponse
    - Type: Object
21. Save GET action
22. Click + button again
23. Select Display Message action
24. Configure message to show {{apiResponse}}
25. Save Display Message action
26. Take final screenshot
```

### Expected Outcome

- New autom named "claude" created
- Flow: Start → RESTful GET → Display Message → Stop
- When run, displays JSON response from restful-api.dev

---

## Example 2: Different API Endpoint

### User Request

```
"Create an autom that fetches weather data from OpenWeather API"
```

### Modifications

Change Step 19 configuration:

```
URL: https://api.openweathermap.org/data/2.5/weather?q=Istanbul&appid=YOUR_API_KEY
Variable: weatherData
Type: Object
```

Display Message configuration:
```
Message: "Weather in Istanbul: {{weatherData.main.temp}}°C"
```

---

## Example 3: Error Handling Scenario

### Scenario: Login Button Not Found

**Error Message:**
```
Element "Sign in using credential button" not found in snapshot
```

**Diagnostic Steps:**

```
1. Take fresh snapshot
2. Check console messages:
   mcp__playwright__browser_console_messages

3. Take screenshot:
   mcp__playwright__browser_take_screenshot
   filename: "login-error-debug.png"

4. Analyze snapshot for alternative text:
   - "Sign In"
   - "Login with Credentials"
   - "Continue with Email"

5. Report to user:
   "The login button text may have changed. Found these alternatives: [list]"
   "Please verify the current button text or UI structure"
```

---

## Example 4: Modal Doesn't Appear

### Scenario: Create New Autom Modal Not Opening

**Diagnostic Flow:**

```
1. Verify button click succeeded
2. Wait additional time:
   mcp__playwright__browser_wait_for
   text: "Autom Name" or "Create"
   time: 5

3. Check for dialogs:
   mcp__playwright__browser_handle_dialog
   accept: true

4. Take screenshot:
   mcp__playwright__browser_take_screenshot
   filename: "modal-not-appearing.png"

5. Check console for errors:
   mcp__playwright__browser_console_messages
   onlyErrors: true

6. Report findings to user
```

---

## Example 5: Complete Success Flow with Screenshots

### Visual Checkpoints

**Checkpoint 1: Login Page**
```
After Step 1 (Navigate):
- Take screenshot: "01-login-page.png"
- Verify: "Sign in using credential" button visible
```

**Checkpoint 2: Login Form**
```
After Step 3 (Click sign in):
- Take screenshot: "02-credential-form.png"
- Verify: Email and password fields visible
```

**Checkpoint 3: My Environment**
```
After Step 6 (Login submit):
- Take screenshot: "03-my-environment.png"
- Verify: URL is /my-environment/automs
- Verify: "Create New Autom" button visible
```

**Checkpoint 4: Creation Modal**
```
After Step 9 (Click Create New Autom):
- Take screenshot: "04-creation-modal.png"
- Verify: Autom Name and Type fields visible
```

**Checkpoint 5: Flow Editor**
```
After Step 12 (Create autom):
- Take screenshot: "05-flow-editor.png"
- Verify: Start and Stop nodes visible
- Verify: + button between nodes visible
```

**Checkpoint 6: Action Menu**
```
After Step 14 (Click + button):
- Take screenshot: "06-action-menu.png"
- Verify: RESTful Web Service section visible
```

**Checkpoint 7: Action Control Center**
```
After Step 17 (Select GET):
- Take screenshot: "07-action-control-center.png"
- Verify: URL field visible
- Verify: Variable configuration options visible
```

**Checkpoint 8: Complete Flow**
```
After Step 26 (Final):
- Take screenshot: "08-complete-flow.png"
- Verify: GET action and Display Message in flow
```

---

## Example 6: Testing the Created Autom

### After Creation Steps

```
User: "Now test the autom we just created"

Steps:
1. Snapshot current page
2. Locate "Run" or "Test" button
3. Click Run button
4. Wait for execution
5. Capture execution results
6. Verify API response displayed
7. Take screenshot of results
```

---

## Example 7: Creating Multiple Automs

### User Request

```
"Create 3 different automs for different APIs"
```

### Approach

Repeat the complete flow 3 times with different configurations:

**Autom 1: Products API**
```
Name: "products-fetcher"
API: https://api.restful-api.dev/objects
```

**Autom 2: Users API**
```
Name: "users-fetcher"
API: https://jsonplaceholder.typicode.com/users
```

**Autom 3: Posts API**
```
Name: "posts-fetcher"
API: https://jsonplaceholder.typicode.com/posts
```

---

## Example 8: Advanced Variable Handling

### Scenario: Extract Specific Field from Response

**Display Message Configuration:**

Instead of showing entire response:
```
{{apiResponse}}
```

Show specific field:
```
Product Name: {{apiResponse[0].name}}
Product Data: {{apiResponse[0].data}}
```

**Note**: Syntax depends on Automate.com's variable interpolation format. Check documentation.

---

## Example 9: Error Recovery - Network Issues

### Scenario: Page Load Timeout

```
Error: "Navigation timeout after 30 seconds"

Recovery Steps:
1. Check internet connection
2. Verify autommate.app is accessible
3. Retry navigation:
   mcp__playwright__browser_navigate
   url: "https://community.autommate.app/login?to=/"

4. If still fails:
   - Report to user
   - Suggest checking site status
   - Provide manual steps as fallback
```

---

## Example 10: Customizing Autom Names

### User Request

```
"Create an autom called 'weather-dashboard' instead of 'claude'"
```

### Modification

Change Step 11 configuration:

```
Fields:
  - name: "Autom Name field"
    type: "textbox"
    ref: [exact ref from snapshot]
    value: "weather-dashboard"  ← Changed from "claude"

  - name: "Autom Type selector"
    type: "combobox"
    ref: [exact ref from snapshot]
    value: "Autom"
```

---

## Example 11: Future API Import Method

### Once Automate.com Supports API

**Current: 26 steps, 30-60 seconds**

**Future: 1 API call, < 5 seconds**

```javascript
// Hypothetical API call
const response = await fetch('https://api.autommate.app/v1/automs', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "claude",
    type: "Autom",
    actions: [
      {
        type: "restful.get",
        config: {
          url: "https://api.restful-api.dev/objects",
          response_variable: "apiResponse"
        }
      },
      {
        type: "display.message",
        config: {
          message: "{{apiResponse}}"
        }
      }
    ]
  })
});
```

**Advantages:**
- Much faster execution
- More reliable (no UI brittleness)
- Easier to maintain
- Can batch create multiple automs
- Better error handling

---

## Example 12: Debugging with Console Messages

### Scenario: Investigate JavaScript Errors

```
After any step that seems to fail:

1. Check console:
   mcp__playwright__browser_console_messages
   onlyErrors: true

2. Look for patterns:
   - "TypeError: Cannot read property..."
   - "Failed to fetch..."
   - "Network error..."
   - "Authentication failed..."

3. Report specific error to user

4. Suggest fixes based on error type
```

---

## Common Patterns Summary

### Pattern 1: Snapshot → Interact → Wait
```
1. mcp__playwright__browser_snapshot
2. mcp__playwright__browser_click (using ref from snapshot)
3. mcp__playwright__browser_wait_for (wait for next state)
```

### Pattern 2: Form Filling
```
1. mcp__playwright__browser_snapshot
2. mcp__playwright__browser_fill_form (with refs from snapshot)
3. mcp__playwright__browser_click (submit button)
```

### Pattern 3: Error Diagnosis
```
1. mcp__playwright__browser_take_screenshot
2. mcp__playwright__browser_console_messages
3. Report findings
4. Suggest recovery steps
```

### Pattern 4: Verification
```
1. mcp__playwright__browser_wait_for (expected text/element)
2. mcp__playwright__browser_snapshot (confirm state)
3. mcp__playwright__browser_take_screenshot (visual proof)
```

---

## Tips for Success

1. **Always wait between major steps** - Pages need time to load
2. **Fresh snapshots are critical** - Don't reuse old refs
3. **Screenshot liberally** - Helps debugging
4. **Check console on errors** - JavaScript errors are informative
5. **Verify state transitions** - Don't assume success
6. **Report clear errors to user** - Don't silently fail
7. **Keep credentials secure** - Consider env vars for production

---

## Next: API/JSON Import Migration

When ready to migrate from browser automation to API:

1. **Export existing autom as JSON** (if Automate.com supports)
2. **Analyze JSON structure**
3. **Create template generator**
4. **Build API client**
5. **Deprecate browser automation path** (or keep as fallback)

This will be a separate skill: `importing-autommate-workflows-json`
