---
name: skill-optimizer
description: >-
  Analyzes existing skills by executing them, examining execution logs, and
  optimizing them according to best practices. Use when you need to improve
  skill performance, identify bottlenecks, or refactor skills for better
  efficiency.
version: 4.0.0
category: custom
---

# Skill Optimizer

Automatically optimizes existing Claude skills by running them, analyzing execution logs, and applying best practices to improve performance and reliability.

## Helper Scripts

**Three Python helpers to simplify workflow:**

1. **find_skill.py** - Find skill by name, get ID, path, and skillmd from Strapi
   ```bash
   python .claude/skills/skill-optimizer/find_skill.py rpa-challenge --save-skillmd
   ```
   - Returns skill ID, version, and skillmd length
   - Saves full Strapi skillmd to `temp/skillmd_from_strapi.md`

2. **update_skill_template.py** - Template for Strapi updates
   ```bash
   python .claude/skills/skill-optimizer/update_skill_template.py
   ```

3. **update_skill_{skill-id}.py** - Generated script for each optimization
   ```bash
   python temp/update_skill_ {skill-id}.py {skill-id}
   ```

**All scripts eliminate manual grepping and escaping!**

## Quick Start

```
Progress Checklist:
- [ ] Find skill using find_skill.py --save-skillmd
- [ ] Read skillmd from temp/skillmd_from_strapi.md (NOT local file)
- [ ] Create and execute test task
- [ ] Analyze execution logs
- [ ] Identify bottlenecks and issues
- [ ] Generate optimized skill version
- [ ] Update skill in Strapi using Python script
- [ ] Verify update success
```

## Step 1: Find Target Skill and Get Skillmd from Strapi

**CRITICAL:** Always use `--save-skillmd` flag to retrieve skill content from Strapi (NOT local file).

```bash
python .claude/skills/skill-optimizer/find_skill.py {skill-name} --save-skillmd
```

**Example:**
```bash
python .claude/skills/skill-optimizer/find_skill.py rpa-challenge --save-skillmd
```

**Output:**
```
============================================================
SKILL SEARCH RESULTS: rpa-challenge
============================================================

[OK] Found in Strapi
     Skill ID: hu1gfgvs6dixyfgt7yybu3m3
     Version:  4.0.0

[OK] Skillmd saved to: C:\Users\Ali\Documents\Projects\claude_agent_ui\temp\skillmd_from_strapi.md
     Size: 8293 characters
```

**What to extract:**
- `skill_id` - For Strapi API updates (REQUIRED)
- `current_version` - For version incrementing
- `skillmd_length` - Size of Strapi skillmd

**Skillmd location:** `C:\Users\Ali\Documents\Projects\claude_agent_ui\temp\skillmd_from_strapi.md`

**If skill not found:**
- Check skill name spelling (case-sensitive)
- Verify skill exists in Strapi
- Confirm Strapi is running on port 3001

## Step 2: Read Current Skill from Strapi

**CRITICAL:** Read skillmd from Strapi export file (NOT local SKILL.md).

```bash
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\temp\skillmd_from_strapi.md
```

**This is the authoritative source of truth from Strapi database.**

Parse the skill structure:
- Extract frontmatter (name, description, version, category)
- Extract skillmd content
- Note current version number for incrementing

**NEVER read from local `.claude/skills/{skill-name}/SKILL.md` - always use Strapi version.**

## Step 3: Create Test Task

Use the `skill_id` from Step 1 to create test task via API:

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "{skill-name}-optimization-test",
    "userPrompt": "Execute the skill",
    "agentId": "{skill-id}",
    "taskType": "skill",
    "permissionMode": "bypass"
  }'
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "rpa-challenge-optimization-test",
    "userPrompt": "Execute the skill",
    "agentId": "hu1gfgvs6dixyfgt7yybu3m3",
    "taskType": "skill",
    "permissionMode": "bypass"
  }'
```

**Response:**
```json
{
  "id": "8b8a8852-1aed-4754-b234-16b5f3cb56b4",
  "name": "rpa-challenge-optimization-test",
  "status": "pending",
  ...
}
```

**Important:** Save the returned `id` field - you'll need it for execution and log analysis.

**Note:** When `taskType` is "skill", the `agentId` field should contain the skill ID.

## Step 4: Execute Task

Execute the created task:

```bash
curl -X POST http://localhost:3001/api/tasks/{task-id}/execute \
  -H "Content-Type: application/json" \
  --max-time 600
```

**Wait for completion.** Monitor the response or check task status periodically.

## Step 5: Analyze Execution Logs

Once task completes, read the execution logs from `logs/{task-id}.json` and `logs/{task-id}-sdk-payload.json`:

```bash
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\logs\{task-id}.json
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\logs\{task-id}-sdk-payload.json
```

### 5.1 Identify Performance Bottlenecks

Look for:
- **Tool usage patterns**: Repeated tool calls that could be batched
- **Task tool invocations**: Are sub-agents being used inefficiently?
- **Time-consuming operations**: Which tools/steps take the longest?
- **Trial-and-error patterns**: Multiple failed attempts before success
- **Redundant operations**: Same operation performed multiple times

### 5.2 Extract Key Metrics

From the logs, extract:
- Total execution time (duration field)
- Tool call counts and timings
- Error messages and failed attempts
- Success/failure rates
- Any screenshots or final outputs

### 5.3 Identify Issues

Common issues to look for:
- Vague instructions leading to trial-and-error
- Missing direct code/commands (forcing agent to figure it out)
- Inefficient tool usage (individual calls vs batch operations)
- Lack of error handling guidance
- Missing performance optimization tips
- Over-reliance on Task tool when direct tools would work

## Step 6: Read Best Practices

Read the best practices documentation to guide optimization:

```bash
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\claude_skill_best_practices\01_Core_Principles.md
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\claude_skill_best_practices\03_Workflows_Feedback_Loops.md
Read: C:\Users\Ali\Documents\Projects\claude_agent_ui\claude_skill_best_practices\07_Anti_Patterns.md
```

Key principles to apply:
1. **Concise and actionable** - Direct instructions, not essays
2. **Workflow patterns** - Step-by-step with checkboxes
3. **Progressive disclosure** - Brief intro, detailed sections
4. **Explicit tool guidance** - Show exact tool usage
5. **Error handling** - Common issues and solutions
6. **Performance optimization** - Batch operations, minimize snapshots

## Step 7: Generate Optimized Skill

Based on analysis and best practices, create optimized version:

### 7.1 Optimization Strategies

**If logs show Task tool overhead:**
- Replace with direct tool usage where possible
- Provide exact code/commands in skill instead of delegation
- Example: Instead of "Use Task tool to read Excel", provide HTML parser code

**If logs show repeated tool calls:**
- Add batch operation guidance
- Example: "Fill all 7 fields at once using browser_fill_form"

**If logs show trial-and-error:**
- Add explicit step-by-step instructions
- Provide exact tool names and parameters
- Include code snippets where applicable

**If logs show long execution time:**
- Identify slowest operations
- Add performance tips (e.g., "Single snapshot per form, not multiple")
- Eliminate unnecessary operations

### 7.2 Update Skill Structure

Create new skill with:
- **Incremented version** (e.g., 1.0.0 → 2.0.0 for major changes)
- **Improved description** reflecting new capabilities
- **Performance metrics** if applicable
- **Clearer workflow** with checkboxes
- **Embedded code** where it eliminates trial-and-error
- **Common issues section** based on log errors
- **Critical success factors** highlighting key optimizations

### 7.3 Write Optimized Skill

Write the new optimized skill content to a temporary file or provide to user:

```markdown
---
name: {skill-name}
description: {improved-description}
version: {incremented-version}
category: {category}
---

# {Skill Title} - Optimized

{Brief description highlighting improvements}

## Performance Optimization

{If applicable, describe performance improvements:}
- Previous execution time: X seconds
- Target execution time: Y seconds
- Key optimizations: {list}

## Quick Start

```
Progress Checklist:
- [ ] {Step 1}
- [ ] {Step 2}
...
```

## Step 1: {First Step}

{Clear, actionable instructions}

{If code/commands needed, provide them directly:}

```{language}
{exact code}
```

...

## Common Issues

**{Issue 1}:** {Description from logs}
- **Fix:** {Solution}

## Critical Success Factors

1. {Key optimization 1}
2. {Key optimization 2}
...
```

## Step 8: Update Skill in Strapi

**MANDATORY APPROACH:** Use Write tool to create Python update script. This ensures zero errors.

### 8.1 Create Update Script with Write Tool

**Use Write tool with this EXACT structure:**

```python
#!/usr/bin/env python3
import requests

# Skill information from Step 1
SKILL_ID = "{paste-skill-id-from-step1}"

# Optimized skill content (ENTIRE file content)
SKILLMD_CONTENT = """
{paste-entire-optimized-skill-here}
"""

# Version increment: 1.0.0 -> 2.0.0 (major), 1.1.0 -> 1.2.0 (minor)
NEW_VERSION = "{increment-version-from-step2}"

# Improved description
NEW_DESCRIPTION = "{write-improved-description}"

# Update payload
payload = {
    "skillmd": SKILLMD_CONTENT.strip(),
    "version": NEW_VERSION,
    "description": NEW_DESCRIPTION
}

url = f"http://localhost:3001/api/strapi/skills/{SKILL_ID}"

try:
    print(f"[INFO] Updating skill {SKILL_ID} to version {NEW_VERSION}...")
    response = requests.put(url, json=payload, headers={"Content-Type": "application/json"})

    if response.status_code == 200:
        print(f"[OK] Skill updated successfully to v{NEW_VERSION}")
        print(f"     Skill ID: {SKILL_ID}")
    else:
        print(f"[FAIL] Update failed: {response.status_code}")
        print(f"       Response: {response.text}")
        exit(1)

except Exception as e:
    print(f"[FAIL] Exception: {str(e)}")
    exit(1)
```

**File path:** `C:/Users/Ali/Documents/Projects/claude_agent_ui/temp/update_skill.py`

**Critical: Fill in these placeholders:**
1. `{paste-skill-id-from-step1}` → Skill ID from Step 1 (e.g., `hu1gfgvs6dixyfgt7yybu3m3`)
2. `{paste-entire-optimized-skill-here}` → Your complete optimized skillmd
3. `{increment-version-from-step2}` → Incremented version (1.0.0 → 2.0.0 or 1.1.0 → 1.2.0)
4. `{write-improved-description}` → Brief description of improvements

**Category validation:** Ensure skillmd uses valid category:
- `general-purpose`, `code-analysis`, `data-processing`, `web-scraping`
- `file-manipulation`, `api-integration`, `browser-automation`, `testing`, `custom`

**NEVER use:** `development`, `automation`, or other invalid categories!

### 8.2 Execute Update Script

**Command:**
```bash
python C:/Users/Ali/Documents/Projects/claude_agent_ui/temp/update_skill.py
```

**Expected success output:**
```
[INFO] Updating skill hu1gfgvs6dixyfgt7yybu3m3 to version 2.0.0...
[OK] Skill updated successfully to v2.0.0
     Skill ID: hu1gfgvs6dixyfgt7yybu3m3
```

**If you see `[FAIL]`:**
1. Read the error message carefully
2. Common errors and fixes:

**Error: "Invalid enum value... category"**
- Fix: Change category in skillmd to one of: `custom`, `testing`, `browser-automation`, etc.
- Check frontmatter in optimized skillmd

**Error: "Validation Error... version"**
- Fix: Use semantic versioning format: `1.0.0`, `2.1.3` (not `v1.0` or `1.0`)

**Error: "ModuleNotFoundError: requests"**
- Fix: `pip install requests`

**Error: "Connection refused"**
- Fix: Ensure backend is running on port 3001

### 8.3 Verify Update

**Check version:**
```bash
python .claude/skills/skill-optimizer/find_skill.py {skill-name}
```

**Should show new version:**
```
[OK] Found in Strapi
     Skill ID: hu1gfgvs6dixyfgt7yybu3m3
     Version:  2.0.0  ✓ (updated!)
```

### 8.4 Critical Success Checklist

Before running update script, verify:
- [ ] Skill ID is correct (from Step 1)
- [ ] Optimized skillmd is complete (entire file, not partial)
- [ ] Version is incremented (not same as old version)
- [ ] Category is valid enum value (check frontmatter)
- [ ] Description is concise and accurate
- [ ] Triple quotes `"""` are used for SKILLMD_CONTENT
- [ ] No syntax errors in Python script

**If update fails twice:**
1. Save optimized skillmd to file: `temp/optimized_skill.md`
2. Test it locally first
3. Check backend logs for detailed error
4. Verify Strapi is running and accessible

## Step 9: Report Results

Present optimization summary:

1. **Analysis Summary:**
   - Original execution time vs optimized target
   - Key bottlenecks identified
   - Optimization strategies applied

2. **Update Status:**
   - ✅ Skill updated in Strapi to v{new-version}
   - Skill ID: {skill-id}
   - Changes applied automatically

3. **Test Recommendation:**
   - Suggest testing the optimized version
   - Provide API call to re-run with new skill:

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "{skill-name}-v{new-version}-test",
    "prompt": "test",
    "agentId": "{skill-agent-id}",
    "taskType": "skill"
  }'
```

## Performance Optimization Tips

**For Skills Using Browser Automation:**
- Minimize snapshots (only when needed for next action)
- Batch form fills instead of individual field typing
- Avoid unnecessary waits or delays

**For Skills Using File Operations:**
- Provide exact code for complex operations (Excel parsing, PDF reading)
- Avoid Task tool delegation when direct code works
- Use specialized tools (Read, Write) instead of Bash cat/echo

**For Skills Using External APIs:**
- Batch requests where possible
- Provide exact curl/fetch examples
- Include error handling for common API failures

**General:**
- Embed solutions that work, eliminating trial-and-error
- One snapshot/check before action, not after
- Clear success criteria for each step

## Common Bottlenecks

**Task Tool Overhead (8+ minutes):**
- **Cause:** Delegating to sub-agent when direct solution exists
- **Fix:** Embed the working solution directly in skill

**Multiple Failed Attempts:**
- **Cause:** Vague instructions forcing agent to guess
- **Fix:** Provide exact tool names, parameters, code

**Repeated Snapshots:**
- **Cause:** No guidance on when to snapshot
- **Fix:** "Take single snapshot before filling, not after submitting"

**Long File Operations:**
- **Cause:** Using inefficient tools (Task tool for Excel)
- **Fix:** Provide efficient direct method (HTML parser with XLSX.js)

## Example Workflow

```
User: Optimize my rpa-challenge skill
Assistant:
1. Finding skill... ✓
   - python .claude/skills/skill-optimizer/find_skill.py rpa-challenge
   - Skill ID: hu1gfgvs6dixyfgt7yybu3m3
   - Current version: 3.0.0
   - Path: .claude/skills/rpa-challenge/SKILL.md
2. Reading current skill... ✓
   - Read from .claude/skills/rpa-challenge/SKILL.md
3. Creating test task via API... ✓
   - curl -X POST http://localhost:3001/api/tasks ...
   - Task ID: 8b8a8852-1aed-4754-b234-16b5f3cb56b4
4. Executing task... (waiting)
   - curl -X POST http://localhost:3001/api/tasks/{id}/execute
5. Task completed in 194 seconds
6. Reading logs... ✓
   - logs/8b8a8852-1aed-4754-b234-16b5f3cb56b4.json
   - logs/8b8a8852-1aed-4754-b234-16b5f3cb56b4-sdk-payload.json
7. Analyzing logs...
   - Found: Write tool error (browser_evaluate hack)
   - Found: 94 seconds overhead in Excel parsing
   - Challenge time: 99.79s (excellent!)
8. Applying optimizations...
   - Fix Write tool usage
   - Simplify Excel extraction
   - Update performance targets
9. Updating skill in Strapi...
   - Writing Python script to temp/update_skill.py... ✓
   - Executing: python temp/update_skill.py hu1gfgvs6dixyfgt7yybu3m3
   - Response: ✅ Skill updated successfully to v2.0.0
   - Verified version updated ✓
10. ✅ Optimization complete!
   - Previous: 194 seconds
   - Target: <120 seconds (38% improvement)
   - Skill updated automatically in Strapi

Test the new version:
python temp/update_skill.py hu1gfgvs6dixyfgt7yybu3m3
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"name":"rpa-challenge-v2-test","userPrompt":"test","agentId":"hu1gfgvs6dixyfgt7yybu3m3","taskType":"skill"}'
```

## Concrete Example: Update rpa-challenge

**Step-by-step with actual skill:**

1. **Find skill using helper script:**
```bash
python .claude/skills/skill-optimizer/find_skill.py rpa-challenge
```

**Output:**
```
[OK] Found in Strapi
     Skill ID: hu1gfgvs6dixyfgt7yybu3m3
     Version:  2.0.0

[OK] Found locally
     Path: C:\Users\Ali\Documents\Projects\claude_agent_ui\.claude\skills\rpa-challenge\SKILL.md
```

**Extract:** Skill ID = `hu1gfgvs6dixyfgt7yybu3m3`

2. **Create Python script** (Write tool):
```python
import requests

skill_id = "hu1gfgvs6dixyfgt7yybu3m3"

skillmd = """---
name: rpa-challenge
description: Complete RPA Challenge in under 2 minutes
version: 2.0.0
category: automation
---

# RPA Challenge v2.0

Complete rpachallenge.com in <120 seconds.

## Quick Start

- [ ] Download Excel
- [ ] Extract data
- [ ] Fill 10 forms
"""

payload = {
    "skillmd": skillmd,
    "version": "2.0.0",
    "description": "Complete RPA Challenge in under 2 minutes"
}

url = f"http://localhost:3001/api/strapi/skills/{skill_id}"
response = requests.put(url, json=payload)

print(f"Status: {response.status_code}")
print(f"Result: {response.json()}")
```

3. **Run script:**
```bash
python temp/update_skill.py
# Output: Status: 200
#         Result: {'id': 'hu1gfgvs6dixyfgt7yybu3m3', 'version': '2.0.0', ...}
```

**That's it!** No escaping, no curl issues, just simple Python.

## Best Practices Checklist

Before finalizing optimization, verify:
- [ ] Version number incremented appropriately
- [ ] Description updated to reflect improvements
- [ ] Workflow has progress checkboxes
- [ ] Exact tool usage shown where needed
- [ ] Performance metrics included if applicable
- [ ] Common issues section based on logs
- [ ] Critical success factors highlighted
- [ ] No vague instructions requiring guesswork
- [ ] Error handling guidance provided
- [ ] Code snippets included where they eliminate trial-and-error
- [ ] Skill updated in Strapi via API (not just provided as text)
- [ ] Update verified with API call
- [ ] Test command provided for new version
