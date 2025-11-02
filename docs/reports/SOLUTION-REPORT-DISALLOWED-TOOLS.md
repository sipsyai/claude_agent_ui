# ✅ SOLUTION CONFIRMED: disallowedTools Parameter Works!

**Date:** 2025-11-02
**Status:** SOLVED
**Solution:** Use `--disallowedTools` parameter instead of `--allowedTools`

---

## 📊 Executive Summary

**Problem:** Claude Agent SDK ignores the `--allowedTools` parameter, making all tools available to skills regardless of configuration.

**Solution:** Use the `--disallowedTools` parameter to explicitly block unwanted tools. This parameter **WORKS** and successfully prevents unauthorized tools from being available during skill execution.

---

## 🔬 Evidence: Side-by-Side Comparison

### Test 1: WITHOUT disallowedTools (FAILED)

**Configuration:**
```bash
--allowedTools Read,Write,Edit,Bash,mcp__playwright__*,...
--disallowedTools   # Empty
```

**Tools Available During Execution:**
```json
"tools": [
  "Task",           ❌ NOT in allowedTools, but available anyway
  "WebFetch",       ❌ NOT in allowedTools, but available anyway - CRITICAL!
  "WebSearch",      ❌ NOT in allowedTools, but available anyway
  "mcp__playwright__browser_navigate",  ✅ Correct
  // ... all other tools ...
]
```

**Tool Usage:**
- Line 182: **WebFetch WAS USED** to fetch sipsy.ai content ❌
```json
{
  "type": "tool_use",
  "name": "WebFetch",
  "input": {"url": "https://sipsy.ai"}
}
```

**Conclusion:** ❌ allowedTools parameter is IGNORED by SDK

---

### Test 2: WITH disallowedTools (SUCCESS!)

**Configuration:**
```bash
--allowedTools Read,Write,Edit,Bash,mcp__playwright__*,...
--disallowedTools WebFetch,WebSearch  # ← NEW!
```

**Tools Available During Execution:**
```json
"tools": [
  "Task",                              // Built-in tools
  "Bash", "Read", "Edit", "Write",     ✅ Allowed
  "Glob", "Grep",                      // Built-in tools
  "mcp__playwright__browser_navigate", ✅ Allowed
  "mcp__chrome-devtools__navigate_page", ✅ Allowed
  // WebFetch is NOT in the list!    ✅ Blocked successfully!
  // WebSearch is NOT in the list!   ✅ Blocked successfully!
]
```

**Tool Usage:**
- Line 180: `mcp__chrome-devtools__navigate_page` - Used to navigate to sipsy.ai ✅
- Line 244: `mcp__chrome-devtools__take_snapshot` - Used to capture page content ✅
- Line 440: `Bash` - Used to save markdown file ✅
- **WebFetch was NOT used!** ✅

**Task Result:** ✅ COMPLETED successfully

**Conclusion:** ✅ disallowedTools parameter WORKS and successfully blocks unauthorized tools

---

## 📁 Evidence Files

### Test 1 (without disallowedTools):
- **Task ID:** f4f3e8a8-cd9f-4e58-864d-3065715d3f86
- **Log File:** logs/f4f3e8a8-cd9f-4e58-864d-3065715d3f86.json
- **Backend Log:** Shows `disallowedTools=[]`
- **Result:** WebFetch available and used (line 182)

### Test 2 (with disallowedTools):
- **Task ID:** d7180b10-5080-4e51-b343-ca48308ba4ae
- **Log File:** logs/d7180b10-5080-4e51-b343-ca48308ba4ae.json
- **Backend Log:** Shows `disallowedTools=["WebFetch","WebSearch"]`
- **Result:** WebFetch blocked, task completed successfully

---

## 🎯 The Solution

### Backend Implementation (Already Correct)

The backend in `src/routes/task.routes.ts` already supports disallowedTools:

```typescript
// Build disallowedTools array from Strapi configuration
const disallowedTools = skill.disallowedTools || [];

// Pass to SDK
await executeSkill({
  allowedTools: [...],
  disallowedTools: disallowedTools,  // ✅ This works!
  // ...
});
```

### Strapi Configuration

Add `disallowedTools` to the skill configuration in Strapi:

**Example for website-to-markdown skill:**
```json
{
  "toolConfig": [...],  // Still define allowed tools for documentation
  "mcpConfig": [...],    // MCP tools configuration
  "disallowedTools": ["WebFetch", "WebSearch"]  // ← Block these!
}
```

### How It Works

1. **Frontend:** User creates/edits skill in Strapi
2. **Strapi:** Store `disallowedTools` array in skill metadata
3. **Backend:** Fetch skill from Strapi with disallowedTools
4. **Backend:** Pass disallowedTools to SDK via `--disallowedTools` CLI parameter
5. **SDK:** ✅ Respects disallowedTools and blocks specified tools
6. **Execution:** Only allowed tools are available to Claude

---

## 🔧 Recommended Implementation Strategy

### Strategy 1: Block Unauthorized Tools (Current Solution)
Use disallowedTools to block tools that skills should never access:

```json
{
  "disallowedTools": [
    "WebFetch",
    "WebSearch",
    "Task",
    "TodoWrite",
    "Skill",
    "SlashCommand"
  ]
}
```

**Pros:**
- ✅ Works immediately with current SDK version
- ✅ Explicit about what's forbidden
- ✅ Doesn't require SDK changes

**Cons:**
- ❌ Need to maintain list of blocked tools
- ❌ New tools are available by default (need to add to block list)

### Strategy 2: Future - Wait for SDK Fix (Not Recommended)
Wait for Anthropic to fix the --allowedTools parameter.

**Pros:**
- ✅ More intuitive (allow-list vs deny-list)
- ✅ New tools blocked by default

**Cons:**
- ❌ Unknown timeline for fix
- ❌ Not under our control
- ❌ Current tool isolation is broken

**Recommendation:** Use Strategy 1 (disallowedTools) immediately.

---

## 📝 Implementation Checklist

For each skill that needs tool isolation:

- [ ] Add `disallowedTools` array to Strapi skill metadata
- [ ] Include at minimum: `["WebFetch", "WebSearch"]`
- [ ] Consider also blocking: `["Task", "TodoWrite", "Skill", "SlashCommand"]`
- [ ] Test skill execution
- [ ] Verify blocked tools are NOT in execution log's tools array
- [ ] Verify blocked tools are NOT used during execution
- [ ] Verify skill completes successfully with allowed tools

---

## 🎬 Test Results Summary

| Aspect | Test 1 (No disallowedTools) | Test 2 (With disallowedTools) |
|--------|------------------------------|-------------------------------|
| **Task ID** | f4f3e8a8-cd9f-4e58-864d-3065715d3f86 | d7180b10-5080-4e51-b343-ca48308ba4ae |
| **disallowedTools Config** | `[]` (empty) | `["WebFetch","WebSearch"]` |
| **WebFetch Available?** | ❌ YES (shouldn't be!) | ✅ NO (blocked!) |
| **WebSearch Available?** | ❌ YES (shouldn't be!) | ✅ NO (blocked!) |
| **WebFetch Used?** | ❌ YES (line 182) | ✅ NO |
| **MCP Tools Available?** | ✅ YES | ✅ YES |
| **MCP Tools Used?** | ❌ NO (WebFetch used instead) | ✅ YES (chrome-devtools) |
| **Task Status** | ✅ Completed | ✅ Completed |
| **Tool Isolation Working?** | ❌ NO | ✅ YES |

---

## 🎉 Conclusion

The `--disallowedTools` parameter successfully solves the tool isolation problem. Skills can now be properly isolated by explicitly blocking unauthorized tools.

**Next Steps:**
1. ✅ Document the solution (this report)
2. ⏭️ Update all skills in Strapi with appropriate disallowedTools
3. ⏭️ Create UI for managing disallowedTools in skill editor
4. ⏭️ Still report the --allowedTools bug to Anthropic for future fix

---

**Verified By:** Ali (via Claude Code testing)
**Date:** 2025-11-02
**SDK Version:** @anthropic-ai/claude-agent-sdk (CLI)
**Model:** claude-sonnet-4-5
