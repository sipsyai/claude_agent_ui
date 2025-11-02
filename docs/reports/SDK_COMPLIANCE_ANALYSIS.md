# SDK Compliance Analysis - Skills Implementation

**Date:** 2025-11-02
**Reference:** [Agent Skills in the SDK](https://docs.anthropic.com/en/api/agent-sdk/skills)

---

## 🎯 Executive Summary

**Compliance Status:** ⚠️ **Partially Compliant**

Our implementation is a **hybrid approach** that combines:
- ✅ Filesystem-based Skills (compliant)
- ❌ Forced execution via `systemPrompt` (non-compliant)
- ✅ SKILL.md structure (compliant)
- ❌ Missing `settingSources` and `Skill` tool (non-compliant)

**Key Difference:**
- **SDK Approach:** Claude autonomously chooses which Skill to use
- **Our Approach:** We force a specific Skill by injecting it as system prompt

---

## 📊 Detailed Comparison

### 1️⃣ Skill Location & Structure

| Aspect | SDK Documentation | Our Implementation | Status |
|--------|-------------------|-------------------|---------|
| Skill Directory | `.claude/skills/{skill-name}/SKILL.md` | ✅ `.claude/skills/{skill-name}/SKILL.md` | ✅ Compliant |
| File Format | YAML frontmatter + Markdown | ✅ YAML frontmatter + Markdown | ✅ Compliant |
| Frontmatter Fields | `name`, `description`, `allowed-tools` | ✅ `name`, `description`, `allowed-tools` | ✅ Compliant |

**Example Structure (Compliant):**
```
.claude/skills/website-to-markdown/
└── SKILL.md
```

✅ **Our implementation matches SDK requirements for filesystem structure.**

---

### 2️⃣ Skill Loading

| Aspect | SDK Documentation | Our Implementation | Status |
|--------|-------------------|-------------------|---------|
| Loading Mechanism | `settingSources: ['user', 'project']` | ❌ Not used | ❌ Non-compliant |
| Discovery | Automatic at startup | ✅ Via ClaudeStructureParser | ⚠️ Partial |
| Source Priority | User → Project → Plugin | ❌ Only Project | ❌ Non-compliant |

**SDK Requirement:**
```typescript
const options = {
  settingSources: ["user", "project"],  // Required to load Skills
  allowedTools: ["Skill"]
};
```

**Our Implementation:**
```typescript
// ❌ No settingSources
const queryInstance = query({
  options: {
    systemPrompt: systemPrompt,  // ← Wrong approach
    allowedTools: ["Write", "Edit"]  // ← Missing "Skill"
  }
});
```

❌ **We don't use `settingSources` - Skills are manually synced and loaded.**

---

### 3️⃣ Skill Invocation

| Aspect | SDK Documentation | Our Implementation | Status |
|--------|-------------------|-------------------|---------|
| Invocation Method | Claude decides autonomously | ❌ Forced via systemPrompt | ❌ Non-compliant |
| Skill Tool | `"Skill"` in allowedTools | ❌ Not included | ❌ Non-compliant |
| Selection | Based on description matching | ❌ Pre-selected by user | ❌ Non-compliant |

**SDK Approach (Autonomous):**
```typescript
// User asks a question
prompt: "Help me process this PDF document"

// Claude reads available Skills
// Finds "processing-pdfs" Skill with matching description
// Autonomously invokes: Skill(skill_name="processing-pdfs")
// Loads SKILL.md content
// Executes instructions
```

**Our Approach (Forced):**
```typescript
// User selects "website-to-markdown" Skill from UI
// Backend fetches SKILL.md from Strapi
// Syncs to filesystem
// Parses SKILL.md → skill.content
// Injects as systemPrompt
// Claude executes with forced context

const queryInstance = query({
  prompt: "example.com",
  options: {
    systemPrompt: skill.content,  // ← Forced Skill execution
    allowedTools: ["Write", "Edit"]
  }
});
```

❌ **We bypass the Skill tool and force execution via system prompt.**

---

### 4️⃣ Tool Access Control

| Aspect | SDK Documentation | Our Implementation | Status |
|--------|-------------------|-------------------|---------|
| Tool Restriction | Main `allowedTools` option | ✅ Main `allowedTools` option | ✅ Compliant |
| SKILL.md `allowed-tools` | **Not supported** in SDK | ✅ We ignore it too | ✅ Compliant |

**SDK Note:**
> The `allowed-tools` frontmatter field in SKILL.md is only supported when using Claude Code CLI directly. **It does not apply when using Skills through the SDK**.

**Our Implementation:**
```typescript
// We parse allowed-tools from SKILL.md
let allowedTools = skill.metadata?.allowedTools;

// Then pass to SDK
const queryInstance = query({
  options: {
    allowedTools: allowedTools  // ["Write", "Edit"]
  }
});
```

✅ **This is actually compliant** - we extract tools from SKILL.md and pass to main `allowedTools`.

---

### 5️⃣ Working Directory

| Aspect | SDK Documentation | Our Implementation | Status |
|--------|-------------------|-------------------|---------|
| CWD Configuration | `cwd: "/path/to/project"` | ✅ `cwd: projectPath` | ✅ Compliant |
| Relative Paths | Relative to `cwd` | ✅ Relative to `cwd` | ✅ Compliant |

✅ **Compliant**

---

## 🔍 Code Comparison

### SDK-Compliant Approach (What We Should Do)

```typescript
// Frontend: User types a question
POST /api/tasks
{
  "name": "Convert website",
  "taskType": "general",  // ← No skill pre-selection
  "userPrompt": "Convert example.com to markdown"
}

// Backend: Let Claude choose the Skill
const queryInstance = query({
  prompt: "Convert example.com to markdown",
  options: {
    cwd: projectPath,
    settingSources: ["user", "project"],  // ← Load Skills from filesystem
    allowedTools: ["Skill", "Write", "Edit", "Bash"],  // ← Enable Skill tool
    mcpServers: mcpServers,
    permissionMode: "bypassPermissions"
    // No systemPrompt!
  }
});

// Claude's internal process:
// 1. Reads user prompt: "Convert example.com to markdown"
// 2. Scans available Skills in .claude/skills/
// 3. Finds "website-to-markdown" with description matching the task
// 4. Invokes: Skill(skill_name="website-to-markdown")
// 5. SDK loads SKILL.md content
// 6. Executes Skill instructions
```

### Our Current Approach (Forced Execution)

```typescript
// Frontend: User selects "website-to-markdown" Skill
POST /api/tasks
{
  "name": "Convert website",
  "agentId": "w5a8pxto572zoznb5t0lsi06",  // ← Skill pre-selected
  "taskType": "skill",
  "userPrompt": "example.com"
}

// Backend: Force the selected Skill
const strapiSkill = await strapiClient.getSkill(task.agentId);
await skillSyncService.syncSkillToFilesystem(strapiSkill);

const skills = await parser.parseSkills(projectPath);
const skill = skills.find(s => s.id === "website-to-markdown");

const systemPrompt = skill.content;  // ← Force Skill content

const queryInstance = query({
  prompt: "example.com",
  options: {
    systemPrompt: systemPrompt,  // ← Forced execution
    allowedTools: ["Write", "Edit"],  // ← No "Skill" tool
    mcpServers: mcpServers,
    permissionMode: "bypassPermissions"
  }
});

// Claude's process:
// 1. Receives system prompt with Skill instructions
// 2. Executes directly (no Skill selection needed)
```

---

## 📋 Compliance Checklist

| Requirement | SDK Docs | Our Implementation | Compliant? |
|-------------|----------|-------------------|------------|
| Skills in `.claude/skills/` | Required | ✅ Yes | ✅ |
| `SKILL.md` format | Required | ✅ Yes | ✅ |
| YAML frontmatter | Required | ✅ Yes | ✅ |
| `settingSources` config | Required | ❌ No | ❌ |
| `"Skill"` in allowedTools | Required | ❌ No | ❌ |
| Autonomous invocation | Expected | ❌ No (forced) | ❌ |
| `cwd` configuration | Required | ✅ Yes | ✅ |
| Tool restrictions via allowedTools | Required | ✅ Yes | ✅ |
| Ignore SKILL.md allowed-tools | Required | ✅ Yes | ✅ |

**Compliance Score:** 6/9 (67%)

---

## ⚖️ Trade-offs Analysis

### SDK-Compliant Approach

**Pros:**
- ✅ Claude autonomously selects best Skill
- ✅ Multiple Skills can be available
- ✅ User doesn't need to choose
- ✅ Follows official SDK patterns
- ✅ Better for general-purpose agents

**Cons:**
- ❌ Less control over which Skill runs
- ❌ Requires good Skill descriptions
- ❌ May choose wrong Skill
- ❌ No UI skill selector

### Our Forced Approach

**Pros:**
- ✅ User explicitly chooses Skill
- ✅ Guaranteed execution of selected Skill
- ✅ UI-driven workflow
- ✅ Better for skill marketplace/library
- ✅ Predictable behavior

**Cons:**
- ❌ Not SDK-compliant
- ❌ Bypasses Skill tool mechanism
- ❌ User must know which Skill to use
- ❌ Can't mix multiple Skills in one task

---

## 🎯 Use Cases Comparison

### When SDK Approach is Better

**Scenario 1: General Assistant**
```
User: "Help me analyze this Python codebase"

Claude:
1. Scans available Skills
2. Finds "code-analysis" Skill
3. Finds "python-linter" Skill
4. Chooses "code-analysis" (better match)
5. Executes automatically
```

**Scenario 2: Multi-Skill Task**
```
User: "Fetch this website, convert to markdown, then analyze it"

Claude:
1. Invokes "website-to-markdown" Skill
2. Saves markdown file
3. Invokes "text-analysis" Skill
4. Analyzes content
5. Returns combined results
```

### When Our Approach is Better

**Scenario 1: Skill Marketplace**
```
UI: User browses skill library
UI: User clicks "website-to-markdown"
UI: User enters "example.com"
Backend: Executes exactly that Skill
```

**Scenario 2: Workflow Builder**
```
UI: Drag-and-drop workflow builder
Step 1: Select "website-to-markdown" Skill
Step 2: Select "text-summarizer" Skill
Backend: Executes Skills in order
```

**Scenario 3: Skill Training/Testing**
```
UI: Skill editor
UI: Click "Test Skill"
Backend: Must execute THIS specific Skill
Not any other Skill that might match
```

---

## 🔧 Making Our Implementation Compliant

### Option 1: Full SDK Compliance (Recommended for General Use)

**Changes Required:**

1. **Add settingSources to SDK call:**
   ```typescript
   const queryInstance = query({
     prompt: task.userPrompt,
     options: {
       cwd: projectPath,
       settingSources: ["user", "project"],  // ← Add this
       allowedTools: ["Skill", "Write", "Edit", "Bash"],  // ← Add "Skill"
       mcpServers: mcpServers,
       permissionMode: "bypassPermissions"
       // Remove systemPrompt!
     }
   });
   ```

2. **Remove forced Skill injection:**
   ```typescript
   // Delete these lines:
   // const systemPrompt = skill.content;
   // systemPrompt: systemPrompt,
   ```

3. **Update task type:**
   ```typescript
   // Change from:
   taskType: "skill"  // User pre-selects

   // To:
   taskType: "general"  // Claude chooses
   ```

4. **Update UI:**
   - Remove Skill selector
   - Just ask user what they want to do
   - Let Claude choose the Skill

**Result:**
- ✅ Fully SDK-compliant
- ✅ Autonomous Skill selection
- ❌ Loses UI Skill picker

---

### Option 2: Hybrid Approach (Best of Both Worlds)

Keep both approaches and let user choose:

**Task Type: "general"** → SDK-compliant autonomous selection
```typescript
if (taskType === 'general') {
  const queryInstance = query({
    prompt: task.userPrompt,
    options: {
      settingSources: ["user", "project"],
      allowedTools: ["Skill", "Write", "Edit", "Bash"],
      // No systemPrompt
    }
  });
}
```

**Task Type: "skill"** → Forced execution (our current approach)
```typescript
if (taskType === 'skill') {
  const skill = await getSkillFromStrapi(task.agentId);
  const systemPrompt = skill.content;

  const queryInstance = query({
    prompt: task.userPrompt,
    options: {
      systemPrompt: systemPrompt,
      allowedTools: ["Write", "Edit"],
      // No Skill tool
    }
  });
}
```

**UI Flow:**
```
Option 1: "Let Claude choose the best Skill" → taskType: "general"
Option 2: "I want to use this specific Skill" → taskType: "skill"
```

**Pros:**
- ✅ SDK-compliant mode available
- ✅ Forced mode available
- ✅ User chooses workflow
- ✅ Maximum flexibility

**Cons:**
- ⚠️ More complex codebase
- ⚠️ Two execution paths to maintain

---

### Option 3: Keep Current (Non-Compliant but Functional)

**When to choose this:**
- Building a Skill marketplace
- Need explicit Skill selection
- Workflow/automation builder
- Skill testing/training UI

**Acknowledge:**
- Not SDK-compliant for autonomous Skills
- Works perfectly for forced execution
- Document as intentional design choice

---

## 🚦 Recommendations

### For General-Purpose Agent (Public/Community Use)

**Recommendation:** Implement **Option 1** (Full SDK Compliance)

**Why:**
- Aligns with official SDK patterns
- Better user experience (no Skill knowledge needed)
- Future-proof for SDK updates
- Community expects this behavior

**Implementation:**
```typescript
// Remove Skill selection from UI
// Add settingSources to query
// Enable "Skill" tool
// Let Claude decide
```

---

### For Skill Marketplace/Library (Our Use Case)

**Recommendation:** Implement **Option 2** (Hybrid Approach)

**Why:**
- Supports both workflows
- UI Skill selector valuable for marketplace
- Skill testing requires forced execution
- Flexibility for different use cases

**Implementation:**
```typescript
// Add taskType: "general" support
// Keep taskType: "skill" as-is
// Let user choose in UI
```

---

### For Skill Training/Testing Platform

**Recommendation:** Keep **Current Approach** (Option 3)

**Why:**
- Must execute specific Skill for testing
- Can't rely on autonomous selection
- UI-driven workflow required

**Implementation:**
- Document non-compliance as intentional
- Add note in README
- Consider renaming to avoid confusion

---

## 📊 Summary Table

| Aspect | SDK Compliant | Our Current | Hybrid | Keep Current |
|--------|---------------|-------------|---------|--------------|
| Autonomous Selection | ✅ | ❌ | ✅ | ❌ |
| Forced Execution | ❌ | ✅ | ✅ | ✅ |
| UI Skill Picker | ❌ | ✅ | ✅ | ✅ |
| SDK Compliance | 100% | 67% | 100% | 67% |
| Complexity | Low | Low | Medium | Low |
| Use Case | General | Marketplace | Both | Testing |

---

## 🎯 Final Verdict

**Is our structure compliant with SDK documentation?**

**Answer:** ⚠️ **Partially Compliant**

**What we have:**
- ✅ Correct filesystem structure (`.claude/skills/`)
- ✅ Correct SKILL.md format (frontmatter + markdown)
- ✅ Tool access control working
- ✅ Working directory configuration

**What's missing:**
- ❌ `settingSources` configuration
- ❌ `"Skill"` tool in allowedTools
- ❌ Autonomous Skill invocation

**Our implementation is a valid alternative approach** for:
- Skill marketplaces
- Workflow builders
- Skill testing platforms
- UI-driven Skill selection

**But it's not the standard SDK pattern** for:
- General-purpose agents
- Autonomous assistants
- Community tools
- SDK examples

---

## 📚 Next Steps

### To Become Fully Compliant

1. **Add settingSources support:**
   ```typescript
   settingSources: ["user", "project"]
   ```

2. **Enable Skill tool:**
   ```typescript
   allowedTools: ["Skill", ...]
   ```

3. **Remove forced systemPrompt:**
   ```typescript
   // Delete: systemPrompt: skill.content
   ```

4. **Test autonomous selection:**
   ```bash
   npm run test:sdk-compliance
   ```

### To Keep Current Approach

1. **Document design decision:**
   ```markdown
   # Design: Forced Skill Execution
   We intentionally bypass SDK Skill tool for explicit control.
   ```

2. **Add compliance note:**
   ```typescript
   // Note: This uses forced Skill execution, not SDK Skill tool
   ```

3. **Consider hybrid mode:**
   - Support both modes
   - Let user choose

---

## 📖 References

- [Agent Skills in the SDK](https://docs.anthropic.com/en/api/agent-sdk/skills)
- [Agent Skills Overview](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview)
- [Agent Skills Best Practices](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [TypeScript SDK Reference](https://docs.anthropic.com/en/api/agent-sdk/typescript)

---

**Report Generated:** 2025-11-02
**Compliance Status:** ⚠️ Partially Compliant (67%)
**Recommended Action:** Implement Hybrid Approach (Option 2)
