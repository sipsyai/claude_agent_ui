# SkillMD Flow Trace - Complete Journey

**Skill:** website-to-markdown
**Skill ID:** w5a8pxto572zoznb5t0lsi06

---

## 📊 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Strapi Database                                         │
│ Table: skills                                                    │
│ Field: skillmd (TEXT)                                            │
│ Size: 5403 characters                                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ GET /api/skills/:id
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Strapi Client (strapi-client.ts:306)                    │
│ Method: getSkill(id)                                             │
│                                                                  │
│ Response:                                                        │
│ {                                                                │
│   "data": {                                                      │
│     "skillmd": "---\nname: website-to-markdown\n..."            │
│   }                                                              │
│ }                                                                │
│                                                                  │
│ Transformation:                                                  │
│ strapiData.skillmd → skill.skillmd                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ skill.skillmd
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Skill Sync Service (skill-sync-service.ts:22)           │
│ Method: syncSkillToFilesystem(skill, parameters)                │
│                                                                  │
│ Input: skill.skillmd (5403 chars)                               │
│                                                                  │
│ Process:                                                         │
│ 1. Create directory: .claude/skills/website-to-markdown/        │
│ 2. Build frontmatter (from skill metadata)                      │
│ 3. Combine frontmatter + skillmd content                        │
│ 4. Write to file                                                │
│                                                                  │
│ Output File: .claude/skills/website-to-markdown/SKILL.md        │
│ Size: 5450 bytes                                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ File written to disk
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Claude Structure Parser (claude-structure-parser.ts)    │
│ Method: parseSkill(skillPath, skillName)                        │
│                                                                  │
│ Line 258: Read SKILL.md file                                    │
│   const content = await fs.readFile(skillMdPath, 'utf-8');     │
│                                                                  │
│ Line 259: Parse frontmatter                                     │
│   const { metadata, bodyContent } = this.parseFrontmatter(...); │
│                                                                  │
│ Parsing Steps:                                                  │
│ 1. Extract YAML frontmatter (between --- markers)               │
│ 2. Parse YAML to metadata object                                │
│ 3. Extract body content (after frontmatter)                     │
│                                                                  │
│ Line 317: Return skill object                                   │
│   return {                                                       │
│     content: bodyContent, // ← THIS IS THE KEY!                 │
│     metadata: { ... },                                           │
│     ...                                                          │
│   }                                                              │
│                                                                  │
│ bodyContent: "# Website to Markdown Converter\n\n..."           │
│ (Frontmatter removed, pure content)                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ skill.content
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Task Routes (task.routes.ts:22)                         │
│ Function: executeSkillTask()                                    │
│                                                                  │
│ Line 45: Get skill content                                      │
│   let processedContent = skill.content;                         │
│                                                                  │
│ Line 48-53: Parameter injection (if any)                        │
│   if (Object.keys(parameters).length > 0) {                     │
│     Object.entries(parameters).forEach(([key, value]) => {      │
│       const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');  │
│       processedContent = processedContent.replace(regex, ...);   │
│     });                                                          │
│   }                                                              │
│                                                                  │
│ Line 56-62: Build system prompt                                 │
│   let systemPrompt = processedContent;                          │
│   if (Object.keys(parameters).length > 0) {                     │
│     const paramContext = ...;                                   │
│     systemPrompt = `# Skill Parameters\n${paramContext}\n\n...`;│
│   }                                                              │
│                                                                  │
│ systemPrompt: "# Website to Markdown Converter\n\n..."          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ systemPrompt
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Claude Agent SDK (task.routes.ts:89)                    │
│ Method: query(options)                                          │
│                                                                  │
│ Line 89-103:                                                    │
│   const queryInstance = query({                                 │
│     prompt: task.userPrompt,  // "example.com"                  │
│     options: {                                                   │
│       systemPrompt: systemPrompt,  // ← SKILL CONTENT HERE!     │
│       model: 'claude-sonnet-4-5',                               │
│       cwd: projectPath,                                         │
│       allowedTools: ["Write", "Edit"],                          │
│       mcpServers: {...},                                        │
│       permissionMode: "bypassPermissions"                       │
│     }                                                            │
│   });                                                            │
│                                                                  │
│ SDK spawns subprocess:                                          │
│   node cli.js \                                                 │
│     --system-prompt "# Website to Markdown Converter..."        │
│     --model claude-sonnet-4-5 \                                 │
│     --allowedTools Write,Edit \                                 │
│     ...                                                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Subprocess stdin
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Claude Code CLI Process                                 │
│                                                                  │
│ Receives:                                                        │
│ - System Prompt: "# Website to Markdown Converter..."           │
│ - User Prompt: "example.com"                                    │
│ - Available Tools: Write, Edit                                  │
│                                                                  │
│ Sends to Anthropic API:                                         │
│   POST https://api.anthropic.com/v1/messages                    │
│   {                                                              │
│     "model": "claude-sonnet-4-5-20250929",                      │
│     "system": "# Website to Markdown Converter\n\n...",         │
│     "messages": [                                                │
│       { "role": "user", "content": "example.com" }              │
│     ],                                                           │
│     "tools": [                                                   │
│       { "name": "Write", ... },                                 │
│       { "name": "Edit", ... }                                   │
│     ]                                                            │
│   }                                                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ API Response
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: Claude AI Response                                      │
│                                                                  │
│ Claude reads system prompt (skill instructions):                │
│ "# Website to Markdown Converter                                │
│  Fetches web content, converts HTML to clean markdown..."       │
│                                                                  │
│ Claude understands:                                             │
│ - Task: Convert example.com to markdown                         │
│ - Tool to use: WebFetch                                         │
│ - Output: Save to markdown-downloads/                           │
│                                                                  │
│ Claude executes:                                                │
│ 1. WebFetch("example.com", "Convert to markdown...")            │
│ 2. Write("markdown-downloads/example-com.md", content)          │
│ 3. Return success message                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Detailed Breakdown

### 1️⃣ Strapi Database → API

**Location:** PostgreSQL `skills` table

**Query:**
```sql
SELECT skillmd FROM skills WHERE document_id = 'w5a8pxto572zoznb5t0lsi06';
```

**Result:**
```
---
name: website-to-markdown
description: Fetch websites and convert them to markdown format...
allowed-tools: Write, Edit
mcp_tools:
  playwright:
    - browser_close
    - browser_resize
    ...
---

# Website to Markdown Converter

Fetches web content, converts HTML to clean markdown format, and saves it locally.

## Quick Start
...
```

**Character Count:** 5,403

---

### 2️⃣ Strapi Client Transformation

**File:** `src/services/strapi-client.ts:884`

**Code:**
```typescript
private transformSkill(strapiData: StrapiAttributes<any>): Skill {
  const attrs = this.extractAttributes(strapiData);

  return {
    id: strapiData.documentId,
    name: attrs.name,
    skillmd: attrs.skillmd,  // ← Original content preserved
    description: attrs.description,
    ...
  };
}
```

**Output:**
```typescript
{
  id: "w5a8pxto572zoznb5t0lsi06",
  name: "website-to-markdown",
  skillmd: "---\nname: website-to-markdown\n...",
  ...
}
```

---

### 3️⃣ Skill Sync to Filesystem

**File:** `src/services/skill-sync-service.ts:22`

**Code:**
```typescript
async syncSkillToFilesystem(skill: Skill, parameters?: Record<string, any>): Promise<string> {
  // 1. Get content
  let content = skill.skillmd;

  // 2. Parameter injection ({{param}} replacement)
  if (parameters && Object.keys(parameters).length > 0) {
    content = this.injectParameters(content, parameters);
  }

  // 3. Build frontmatter
  const frontmatter = {
    name: skill.name,
    description: skill.description,
    version: skill.version || '1.0.0',
    category: skill.category || 'custom'
  };

  // 4. Create markdown with frontmatter
  const skillMd = matter.stringify(content, frontmatter);

  // 5. Write to file
  const skillPath = path.join(skillDir, 'SKILL.md');
  await fs.writeFile(skillPath, skillMd, 'utf-8');

  return skillPath;
}
```

**Written File:** `.claude/skills/website-to-markdown/SKILL.md`

**File Size:** 5,450 bytes (5,403 + frontmatter overhead)

---

### 4️⃣ Parse SKILL.md

**File:** `src/services/claude-structure-parser.ts:247`

**Code:**
```typescript
private async parseSkill(skillPath: string, skillName: string): Promise<Skill | null> {
  const skillMdPath = path.join(skillPath, 'SKILL.md');

  // Read file
  const content = await fs.readFile(skillMdPath, 'utf-8');

  // Parse frontmatter
  const { metadata, bodyContent } = this.parseFrontmatter(content);

  return {
    id: skillName,
    name: metadata.name as string || skillName,
    description: metadata.description as string || 'No description',
    content: bodyContent,  // ← Body without frontmatter
    metadata: {
      allowedTools: parseToolsField(metadata['allowed-tools']),
      mcpTools: metadata['mcp_tools'] as Record<string, string[]> | undefined,
    },
    ...
  };
}
```

**parseFrontmatter() Function:**

**File:** `src/services/claude-structure-parser.ts:374`

```typescript
private parseFrontmatter(content: string): {
  metadata: Record<string, unknown>;
  bodyContent: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, bodyContent: content };
  }

  const [, frontmatterText, bodyContent] = match;

  try {
    const metadata = yaml.load(frontmatterText) as Record<string, unknown> || {};
    return { metadata, bodyContent: bodyContent.trim() };
  } catch (error) {
    return { metadata: {}, bodyContent: bodyContent.trim() };
  }
}
```

**Input:**
```markdown
---
name: website-to-markdown
allowed-tools: Write, Edit
---

# Website to Markdown Converter
...
```

**Output:**
```typescript
{
  metadata: {
    name: "website-to-markdown",
    "allowed-tools": "Write, Edit"
  },
  bodyContent: "# Website to Markdown Converter\n..."
}
```

**skill.content:** Pure markdown content without frontmatter

---

### 5️⃣ Build System Prompt

**File:** `src/routes/task.routes.ts:45`

**Code:**
```typescript
// Get skill content (body without frontmatter)
let processedContent = skill.content;

// Parameter injection
const parameters = task.inputValues || {};
if (Object.keys(parameters).length > 0) {
  Object.entries(parameters).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    processedContent = processedContent.replace(regex, String(value));
  });
}

// Build system prompt
let systemPrompt = processedContent;
if (Object.keys(parameters).length > 0) {
  const paramContext = Object.entries(parameters)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');
  systemPrompt = `# Skill Parameters\n${paramContext}\n\n${processedContent}`;
}
```

**Example with parameters:**
```
Input values: { url: "example.com", format: "markdown" }

System Prompt:
# Skill Parameters
- url: example.com
- format: markdown

# Website to Markdown Converter

Fetches web content, converts HTML to clean markdown format...
```

**Example without parameters (our case):**
```
System Prompt:
# Website to Markdown Converter

Fetches web content, converts HTML to clean markdown format...
```

---

### 6️⃣ Send to Claude SDK

**File:** `src/routes/task.routes.ts:89`

**Code:**
```typescript
const queryInstance = query({
  prompt: task.userPrompt,  // "example.com"
  options: {
    systemPrompt: systemPrompt,  // ← FULL SKILL CONTENT
    model: 'claude-sonnet-4-5',
    cwd: projectPath,
    allowedTools: ["Write", "Edit"],
    mcpServers: mcpServers,
    permissionMode: "bypassPermissions"
  }
});
```

**SDK spawns subprocess:**
```bash
node node_modules/@anthropic-ai/claude-agent-sdk/cli.js \
  --output-format stream-json \
  --verbose \
  --input-format stream-json \
  --system-prompt "# Website to Markdown Converter\n\nFetches web content, converts HTML to clean markdown format, and saves it locally.\n\n## Quick Start\n\n**Single URL:**\n```\nConvert https://example.com to markdown and save it\n```\n\n**Multiple URLs:**\n```\nDownload these URLs as markdown:\n- https://example.com/page1\n- https://example.com/page2\n```\n\n## Instructions\n\n### 1. Process User Request\n\nIdentify the URLs to process. Accept:\n- Single URL: \"Convert https://example.com to markdown\"\n- Multiple URLs: Provided as a list or comma-separated\n- URLs from a file: Read the file first to get URLs\n\n### 2. Fetch and Convert Each URL\n\nFor each URL:\n\n1. **Fetch content** using WebFetch tool:\n   ```\n   Use WebFetch with prompt: \"Convert this page to clean markdown format. Preserve headings, links, lists, and code blocks. Remove navigation, ads, and footers.\"\n   ```\n\n2. **Generate filename** from URL:\n   - Extract domain and path\n   - Sanitize for filesystem: replace `/`, `?`, `&` with `-`\n   - Add `.md` extension\n   - Example: `https://example.com/docs/api` → `example-com-docs-api.md`\n\n3. **Save markdown content**:\n   - Default directory: `./markdown-downloads/` (create if doesn't exist)\n   - Use Write tool to save content\n   - Include metadata header:\n     ```markdown\n     # [Page Title]\n\n     **Source:** [original URL]\n     **Downloaded:** [date]\n\n     ---\n\n     [converted content]\n     ```\n\n### 3. Verify URLs (Optional)\n\nBefore fetching, optionally check URL validity:\n- Use WebFetch with a simple prompt to test connectivity\n- Report any failed URLs to user\n- Continue with successful URLs\n\n### 4. Provide Summary\n\nAfter processing all URLs, report:\n- ✅ Successfully downloaded: X files\n- ❌ Failed: Y URLs (with reasons)\n- 📁 Saved to: `./markdown-downloads/`\n- List of created files with sizes\n\n..." \
  --model claude-sonnet-4-5 \
  --allowedTools Write,Edit \
  --mcp-config '{"mcpServers":{...}}' \
  --permission-mode bypassPermissions
```

---

### 7️⃣ Claude API Request

**SDK sends to Anthropic:**

```http
POST https://api.anthropic.com/v1/messages
Content-Type: application/json
x-api-key: sk-ant-...

{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 4096,
  "system": "# Website to Markdown Converter\n\nFetches web content...",
  "messages": [
    {
      "role": "user",
      "content": "example.com"
    }
  ],
  "tools": [
    {
      "name": "Write",
      "description": "Write a file to the local filesystem...",
      "input_schema": { ... }
    },
    {
      "name": "Edit",
      "description": "Edit an existing file...",
      "input_schema": { ... }
    }
  ]
}
```

---

### 8️⃣ Claude Processes

**Claude's Internal State:**

```
System Prompt (Instructions):
# Website to Markdown Converter

Fetches web content, converts HTML to clean markdown format...

## Instructions
1. Process User Request
2. Fetch and Convert Each URL
   - Use WebFetch tool
   - Generate filename
   - Save markdown content
...

User Prompt (Task):
example.com

Available Tools:
- Write (create files)
- Edit (modify files)
- WebFetch (fetch web content)

Action Plan:
1. Understand user wants to convert "example.com" to markdown
2. Use WebFetch to fetch example.com
3. Convert HTML to markdown
4. Save to markdown-downloads/example-com.md
5. Report success
```

**Claude's Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "I'll help you convert example.com to markdown..."
    }
  ],
  "stop_reason": "tool_use",
  "usage": { ... }
}
```

Then:
```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_123",
      "name": "WebFetch",
      "input": {
        "url": "https://example.com",
        "prompt": "Convert this page to clean markdown format..."
      }
    }
  ]
}
```

---

## 📝 Backend Logs Trace

### Log 1: Skill Fetch from Strapi
```
[TaskRoutes] [SkillExecution] Fetching skill from Strapi
  taskId="abf080eb-95be-4573-9554-e407f597d401"
  skillId="w5a8pxto572zoznb5t0lsi06"

[StrapiClient] GET /skills/w5a8pxto572zoznb5t0lsi06
  cache=miss

[StrapiClient] Response received
  skillId="w5a8pxto572zoznb5t0lsi06"
  skillName="website-to-markdown"
  skillmdLength=5403
```

### Log 2: Skill Sync
```
[SkillSync] Syncing skill to filesystem
  skillName="website-to-markdown"
  targetPath=".claude/skills/website-to-markdown/SKILL.md"

[SkillSync] ✅ Synced skill: website-to-markdown
  path="C:\Users\Ali\Documents\Projects\claude_agent_ui\.claude\skills\website-to-markdown\SKILL.md"
  fileSize=5450
```

### Log 3: Skill Parse
```
[ClaudeStructureParser] Parsing skills
  projectPath="C:/Users/Ali/Documents/Projects/claude_agent_ui"

[ClaudeStructureParser] Parsing skill directory
  skillPath="C:\Users\Ali\Documents\Projects\claude_agent_ui\.claude\skills\website-to-markdown"

[ClaudeStructureParser] Parsed frontmatter
  metadataKeys=["name", "description", "allowed-tools", "mcp_tools", "version", "category"]
  bodyContentLength=5150
```

### Log 4: System Prompt Built
```
[TaskRoutes] Starting skill task execution
  taskId="abf080eb-95be-4573-9554-e407f597d401"
  skillId="website-to-markdown"
  skillName="website-to-markdown"
  hasInputFields=false
  parameters={}

[TaskRoutes] System prompt built
  hasParameters=false
  systemPromptLength=5150
  startsWidth="# Website to Markdown Converter"
```

### Log 5: Claude SDK Execution
```
[TaskRoutes] Executing skill with SDK
  skillId="website-to-markdown"
  prompt="example.com"
  hasSystemPrompt=true
  systemPromptLength=5150
  allowedTools=["Write", "Edit"]
  hasMcpServers=true
  permissionMode="bypassPermissions"

[TaskRoutes] Skill execution stderr:
  "Spawning Claude Code process: node C:\Users\Ali\Documents\Projects\claude_agent_ui\node_modules\@anthropic-ai\claude-agent-sdk\cli.js --output-format stream-json --verbose --input-format stream-json --system-prompt \"# Website to Markdown Converter\n\nFetches web content...\" --model claude-sonnet-4-5 --allowedTools Write,Edit ..."
```

---

## ✅ Verification

### Check each step:

**1. Strapi has skillmd:**
```bash
curl -s "http://localhost:1337/api/skills/w5a8pxto572zoznb5t0lsi06" | grep -o '"skillmd"' | wc -l
# Output: 1 ✓
```

**2. File synced to filesystem:**
```bash
ls -lh .claude/skills/website-to-markdown/SKILL.md
# Output: 5450 bytes ✓
```

**3. Content matches:**
```bash
# Strapi skillmd length
curl -s "http://localhost:1337/api/skills/w5a8pxto572zoznb5t0lsi06" | python -c "import sys, json; print(len(json.load(sys.stdin)['data']['skillmd']))"
# Output: 5403 ✓

# File size (with frontmatter overhead)
wc -c .claude/skills/website-to-markdown/SKILL.md
# Output: 5450 ✓
```

**4. System prompt used in execution:**
Check task execution log for system message:
```bash
cat logs/abf080eb-95be-4573-9554-e407f597d401.json | grep -A 5 '"type": "system"'
# Output shows system init message ✓
```

---

## 🎯 Summary

**skillmd Journey:**

1. **Strapi DB** → `skillmd` field (5,403 chars)
2. **Strapi API** → JSON response
3. **Strapi Client** → Transform to domain model
4. **Skill Sync** → Write to `.claude/skills/website-to-markdown/SKILL.md` (5,450 bytes)
5. **Structure Parser** → Parse frontmatter, extract `bodyContent`
6. **Task Routes** → Build `systemPrompt` from `skill.content`
7. **Claude SDK** → Pass as `--system-prompt` CLI arg
8. **Claude API** → Receive as `system` field in request
9. **Claude AI** → Use as instructions to execute task

**Key Insight:** The `skillmd` from Strapi becomes the `system` prompt that guides Claude's behavior!
