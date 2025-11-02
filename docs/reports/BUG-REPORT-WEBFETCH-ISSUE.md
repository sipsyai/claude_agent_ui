# 🐛 BUG REPORT: WebFetch Tool Available Despite Not Being in allowedTools

**Date:** 2025-11-02
**Reporter:** Ali
**Severity:** HIGH - Security/Tool Isolation Issue

---

## 📋 Executive Summary

WebFetch tool is accessible during skill execution even though:
1. ❌ It is NOT in the skill's `toolConfig` in Strapi
2. ❌ It is NOT in the `allowedTools` array passed to Claude SDK
3. ✅ Playwright MCP tools ARE correctly configured and included

**This breaks skill isolation and allows unauthorized tool access.**

---

## 🔍 Reproduction Steps

1. Start Strapi backend: `cd backend && npm run develop`
2. Start application backend and frontend: `npm start`
3. Navigate to Tasks page in UI (http://localhost:3001/manager)
4. Create new task:
   - Type: **Skill**
   - Skill: **website-to-markdown**
   - Prompt: `sipsy.ai`
   - Permission Mode: Bypass
5. Execute the task
6. Observe execution logs

---

## ✅ Expected Behavior

**Task execution should only have access to:**
- Read, Write, Edit, Bash (basic tools from toolConfig)
- mcp__playwright__* tools (from mcpConfig with playwright server)
- mcp__chrome-devtools__* tools (from mcpConfig with chrome-devtools server)

**WebFetch should NOT be available**

---

## ❌ Actual Behavior

Task execution has access to ALL tools including:
- WebFetch ❌ (should NOT be available)
- WebSearch ❌ (should NOT be available)
- Task, TodoWrite, Skill, SlashCommand ❌ (should NOT be available)
- AND all the correctly configured tools ✅

**Proof: The task actually USED WebFetch** (see execution log line 182)

---

## 📊 Evidence with Full Payloads

### 1. **Backend Configuration Logs** ✅ (CORRECT)

```
[90m01:55:27 PM[0m [TaskRoutes] [SkillExecution] Using skill from Strapi with metadata preserved
taskId="f4f3e8a8-cd9f-4e58-864d-3065715d3f86"
skillId="w5a8pxto572zoznb5t0lsi06"
skillName="website-to-markdown"
hasToolConfig=true      ✅
hasMcpConfig=true       ✅
```

### 2. **Claude SDK CLI Command** ✅ (CORRECT)

```bash
node claude-agent-sdk/cli.js \
  --output-format stream-json \
  --verbose \
  --input-format stream-json \
  --model claude-sonnet-4-5 \
  --allowedTools Read,Write,Edit,Bash,mcp__playwright__browser_close,mcp__playwright__browser_resize,mcp__playwright__browser_console_messages,mcp__playwright__browser_handle_dialog,mcp__playwright__browser_evaluate,mcp__playwright__browser_file_upload,mcp__playwright__browser_fill_form,mcp__playwright__browser_install,mcp__playwright__browser_press_key,mcp__playwright__browser_type,mcp__playwright__browser_navigate,mcp__playwright__browser_navigate_back,mcp__playwright__browser_network_requests,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_drag,mcp__playwright__browser_hover,mcp__playwright__browser_select_option,mcp__playwright__browser_tabs,mcp__playwright__browser_wait_for,mcp__chrome-devtools__click \
  --mcp-config {"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"],"env":{}},"chrome-devtools":{"type":"stdio","command":"npx","args":["chrome-devtools-mcp@latest"],"env":{},"disabled":false}}} \
  --permission-mode bypassPermissions
```

**Analysis:**
- ✅ allowedTools parameter is correctly set
- ✅ WebFetch is NOT in the list
- ✅ Playwright MCP tools ARE in the list

### 3. **Actual SDK Execution - Tools Available** ❌ (WRONG!)

From: `logs/f4f3e8a8-cd9f-4e58-864d-3065715d3f86.json` (lines 28-93)

```json
{
  "type": "system",
  "subtype": "init",
  "tools": [
    "Task",                                        ❌ NOT in allowedTools
    "Bash",                                        ✅
    "Glob",                                        ❌ NOT in allowedTools
    "Grep",                                        ❌ NOT in allowedTools
    "ExitPlanMode",                                ❌ NOT in allowedTools
    "Read",                                        ✅
    "Edit",                                        ✅
    "Write",                                       ✅
    "NotebookEdit",                                ❌ NOT in allowedTools
    "WebFetch",                                    ❌ NOT in allowedTools - CRITICAL!
    "TodoWrite",                                   ❌ NOT in allowedTools
    "WebSearch",                                   ❌ NOT in allowedTools
    "BashOutput",                                  ❌ NOT in allowedTools
    "KillShell",                                   ❌ NOT in allowedTools
    "Skill",                                       ❌ NOT in allowedTools
    "SlashCommand",                                ❌ NOT in allowedTools
    "mcp__playwright__browser_close",              ✅
    "mcp__playwright__browser_resize",             ✅
    "mcp__playwright__browser_console_messages",   ✅
    "mcp__playwright__browser_handle_dialog",      ✅
    "mcp__playwright__browser_evaluate",           ✅
    "mcp__playwright__browser_file_upload",        ✅
    "mcp__playwright__browser_fill_form",          ✅
    "mcp__playwright__browser_install",            ✅
    "mcp__playwright__browser_press_key",          ✅
    "mcp__playwright__browser_type",               ✅
    "mcp__playwright__browser_navigate",           ✅
    "mcp__playwright__browser_navigate_back",      ✅
    "mcp__playwright__browser_network_requests",   ✅
    "mcp__playwright__browser_take_screenshot",    ✅
    "mcp__playwright__browser_snapshot",           ✅
    "mcp__playwright__browser_click",              ✅
    "mcp__playwright__browser_drag",               ✅
    "mcp__playwright__browser_hover",              ✅
    "mcp__playwright__browser_select_option",      ✅
    "mcp__playwright__browser_tabs",               ✅
    "mcp__playwright__browser_wait_for",           ✅
    "mcp__chrome-devtools__click",                 ✅
    "mcp__chrome-devtools__close_page",            ✅
    "mcp__chrome-devtools__drag",                  ✅
    "mcp__chrome-devtools__emulate_cpu",           ✅
    "mcp__chrome-devtools__emulate_network",       ✅
    "mcp__chrome-devtools__evaluate_script",       ✅
    "mcp__chrome-devtools__fill",                  ✅
    "mcp__chrome-devtools__fill_form",             ✅
    "mcp__chrome-devtools__get_console_message",   ✅
    "mcp__chrome-devtools__get_network_request",   ✅
    "mcp__chrome-devtools__handle_dialog",         ✅
    "mcp__chrome-devtools__hover",                 ✅
    "mcp__chrome-devtools__list_console_messages", ✅
    "mcp__chrome-devtools__list_network_requests", ✅
    "mcp__chrome-devtools__list_pages",            ✅
    "mcp__chrome-devtools__navigate_page",         ✅
    "mcp__chrome-devtools__navigate_page_history", ✅
    "mcp__chrome-devtools__new_page",              ✅
    "mcp__chrome-devtools__performance_analyze_insight", ✅
    "mcp__chrome-devtools__performance_start_trace",     ✅
    "mcp__chrome-devtools__performance_stop_trace",      ✅
    "mcp__chrome-devtools__resize_page",           ✅
    "mcp__chrome-devtools__select_page",           ✅
    "mcp__chrome-devtools__take_screenshot",       ✅
    "mcp__chrome-devtools__take_snapshot",         ✅
    "mcp__chrome-devtools__upload_file",           ✅
    "mcp__chrome-devtools__wait_for"               ✅
  ],
  "mcp_servers": [
    {"name": "playwright", "status": "connected"},
    {"name": "chrome-devtools", "status": "connected"}
  ]
}
```

**Analysis:**
- ✅ MCP tools are correctly available (all 25 playwright + 26 chrome-devtools tools)
- ❌ **WebFetch is available** (should NOT be!)
- ❌ Many other unauthorized tools are also available

### 4. **Proof: WebFetch Was Actually Used**

From execution log (line 180-186):

```json
{
  "type": "tool_use",
  "id": "toolu_01P4HieKM3C7vJh14rTmGNGA",
  "name": "WebFetch",
  "input": {
    "url": "https://sipsy.ai",
    "prompt": "Convert this webpage to clean, well-formatted markdown..."
  }
}
```

**Claude successfully used WebFetch despite it not being in allowedTools!**

---

## 🔬 Root Cause Analysis

### The Flow:

1. **Frontend → Backend (Task Creation)** ✅
   - User creates task with skill "website-to-markdown"
   - Task stored with skillId: `w5a8pxto572zoznb5t0lsi06`

2. **Backend → Strapi (Skill Fetch)** ✅
   - Fetches skill with full metadata including `toolConfig` and `mcpConfig`
   - Logs show: `hasToolConfig=true, hasMcpConfig=true`

3. **Backend → Filesystem (Skill Sync)** ✅
   - Syncs skill content to `.claude/skills/website-to-markdown/SKILL.md`
   - Preserves Strapi metadata (not lost during sync)

4. **Backend → Claude SDK (Execution)** ✅
   - Constructs correct CLI command with `--allowedTools` parameter
   - Parameter includes: Read, Write, Edit, Bash, MCP tools
   - Parameter does NOT include: WebFetch, WebSearch, Task, etc.

5. **Claude SDK → Actual Execution** ❌ **BUG IS HERE!**
   - SDK **IGNORES** the `--allowedTools` parameter
   - SDK provides ALL available tools to Claude
   - Execution log shows WebFetch and other unauthorized tools available

---

## 🎯 The Bug Location

**The bug is in the Claude Agent SDK**, specifically:

The `--allowedTools` CLI parameter is not being respected. The SDK is providing ALL tools regardless of what's specified in `--allowedTools`.

**Possible causes:**
1. SDK is not parsing the `--allowedTools` parameter correctly
2. SDK is not filtering tools based on `--allowedTools` during initialization
3. There's a priority/override issue where built-in tools always get added
4. The parameter format (comma-separated) is not being recognized

---

## 📁 File References

### Backend Code (Working Correctly)
- **src/routes/task.routes.ts:555** - Executes skill with correct allowedTools array
  ```typescript
  allowedTools=["Read","Write","Edit","Bash","mcp__playwright__browser_close",...]
  ```

### Execution Logs
- **logs/f4f3e8a8-cd9f-4e58-864d-3065715d3f86.json:28-93** - Shows all tools available
- **logs/f4f3e8a8-cd9f-4e58-864d-3065715d3f86.json:182** - Shows WebFetch was used

### Test Payloads
- **test-results-new/scenarios/scenario-1-sdk-payload.json** - Shows expected payload structure

---

## 🔧 Temporary Workarounds

None available. The `--allowedTools` parameter does not work.

---

## ✅ Recommended Fix

### Option 1: Fix Claude Agent SDK
Contact Anthropic to fix the `--allowedTools` parameter handling in the Claude Agent SDK.

### Option 2: Use disallowedTools Instead
If SDK supports `--disallowedTools`, try blocking specific tools instead of allowing specific ones.

### Option 3: SDK Version Check
Check if there's a newer version of `@anthropic-ai/claude-agent-sdk` that fixes this issue.

---

## 📝 Summary

| Aspect | Status | Details |
|--------|--------|---------|
| Strapi Metadata | ✅ Working | toolConfig and mcpConfig correctly populated |
| Backend Processing | ✅ Working | Metadata preserved, correct allowedTools array built |
| SDK CLI Command | ✅ Working | Correct `--allowedTools` parameter passed |
| SDK Execution | ❌ **BROKEN** | SDK ignores allowedTools, provides ALL tools |
| Tool Isolation | ❌ **BROKEN** | Skills can access unauthorized tools |
| Security Impact | 🔴 **HIGH** | Skills are not properly isolated |

---

## 🎬 Next Steps

1. ✅ Document the bug with full evidence (this report)
2. ⏭️ Test with `--disallowedTools` parameter (if available)
3. ⏭️ Check Claude Agent SDK version and release notes
4. ⏭️ Open issue with Anthropic if SDK bug confirmed
5. ⏭️ Consider alternative SDK or direct API usage

---

**Conclusion:** The backend implementation is correct. The bug is in the Claude Agent SDK's handling of the `--allowedTools` parameter. The SDK provides all available tools regardless of what is specified in the parameter.
