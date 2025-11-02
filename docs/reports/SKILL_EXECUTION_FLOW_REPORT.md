# Website-to-Markdown Skill Execution Flow - Detaylı Rapor

**Tarih:** 2025-11-02
**Test URL:** autommate.com
**Skill:** website-to-markdown (ID: w5a8pxto572zoznb5t0lsi06)
**Execution Time:** 42 saniye

---

## 📋 İçindekiler

1. [Genel Mimari Akış](#1-genel-mimari-akış)
2. [Adım Adım Execution Flow](#2-adım-adım-execution-flow)
3. [Kod Seviyesinde Detaylar](#3-kod-seviyesinde-detaylar)
4. [Veri Akışı ve Transformasyonlar](#4-veri-akışı-ve-transformasyonlar)
5. [Önemli Kod Noktaları](#5-önemli-kod-noktaları)

---

## 1. Genel Mimari Akış

```
┌─────────────┐
│  Frontend   │ Arayüzden "autommate.com" girip skill çalıştırılır
│  (React)    │
└──────┬──────┘
       │ POST /tasks
       ↓
┌─────────────────────┐
│  Express Server     │ Task oluşturulur ve veritabanına kaydedilir
│  (task.routes.ts)   │
└──────┬──────────────┘
       │ POST /tasks/:id/execute
       ↓
┌─────────────────────┐
│  Strapi Backend     │ Skill verisi çekilir
│  (PostgreSQL)       │
└──────┬──────────────┘
       │ Skill Data
       ↓
┌─────────────────────┐
│  Skill Sync Service │ Skill filesystem'e yazılır (.claude/skills/)
│  (skill-sync.ts)    │
└──────┬──────────────┘
       │ Synced SKILL.md
       ↓
┌─────────────────────┐
│  Claude Agent SDK   │ Claude Code CLI çalıştırılır
│  (subprocess)       │
└──────┬──────────────┘
       │ SSE Stream
       ↓
┌─────────────────────┐
│  Frontend           │ Sonuçlar real-time gösterilir
│  (TaskModal)        │
└─────────────────────┘
```

---

## 2. Adım Adım Execution Flow

### **ADIM 1: Task Oluşturma (09:23:19)**

**Log:**
```
09:23:19 AM [TaskRoutes] Skill not found in filesystem, trying Strapi skillId="w5a8pxto572zoznb5t0lsi06"
[Strapi] GET /skills/w5a8pxto572zoznb5t0lsi06
09:23:19 AM [TaskRoutes] Skill found in Strapi skillId="w5a8pxto572zoznb5t0lsi06" skillName="website-to-markdown"
09:23:19 AM [TaskStorageService] Task created taskId="9eba0917-a577-454f-9d9a-f36f5486b801" taskName="autommate" taskType="skill"
```

**Kod Akışı:**

**Dosya:** `src/routes/task.routes.ts:229`

```typescript
// 1. Frontend'den gelen request
POST /tasks
{
  "name": "autommate",
  "agentId": "w5a8pxto572zoznb5t0lsi06",
  "userPrompt": "autommate.com",
  "taskType": "skill",
  "permissionMode": "bypass"
}

// 2. Skill'in filesystem'de var olup olmadığı kontrol edilir
const skills = await parser.parseSkills(projectPath);
let skill = skills.find(s => s.id === request.agentId);

// 3. Filesystem'de yoksa Strapi'den çekilir
if (!skill) {
  strapiSkill = await strapiClient.getSkill(request.agentId);
}

// 4. Task oluşturulur ve .cui/tasks.json dosyasına kaydedilir
const task = await taskStorage.createTask(request, entityName);
```

**Strapi Request:**

**Endpoint:** `GET /api/skills/w5a8pxto572zoznb5t0lsi06`

**Strapi Client Kodu:** `src/services/strapi-client.ts:306`

```typescript
async getSkill(id: string): Promise<Skill> {
  // 1. Cache kontrolü
  const cached = this.cache.get(`skill:${id}`);
  if (cached) return cached;

  // 2. Strapi'ye populate parametreleriyle GET request
  const { data } = await this.client.get(`/skills/${id}`, {
    params: {
      populate: {
        trainingHistory: true,
        additionalFiles: { populate: { file: true } },
        agentSelection: { populate: { agent: true } },
        toolConfig: true,
        modelConfig: true,
        analytics: true,
        mcpConfig: {
          populate: {
            mcpServer: true,
            selectedTools: { populate: { mcpTool: true } }
          }
        }
      }
    }
  });

  // 3. Response transform edilir
  const skill = this.transformSkill(data.data);

  // 4. Cache'e yazılır
  this.cache.set(`skill:${id}`, skill);

  return skill;
}
```

**Task Storage'a Kayıt:**

**Dosya:** `src/services/task-storage-service.ts:75`

```typescript
async createTask(request: CreateTaskRequest, agentName: string): Promise<Task> {
  await this.initialize(); // .cui/tasks.json dosyasını oluştur/yükle

  const task: Task = {
    id: randomUUID(), // "9eba0917-a577-454f-9d9a-f36f5486b801"
    name: "autommate",
    agentId: "w5a8pxto572zoznb5t0lsi06",
    agentName: "website-to-markdown",
    taskType: "skill",
    status: "pending",
    userPrompt: "autommate.com",
    permissionMode: "bypass",
    createdAt: new Date().toISOString(),
    directory: request.directory
  };

  // Task'ı array'in başına ekle
  this.tasks.unshift(task);

  // .cui/tasks.json dosyasına yaz
  await this.saveTasks();

  return task;
}
```

**Kaydedilen Dosya:** `C:\Users\Ali\.cui\tasks.json`

---

### **ADIM 2: Task Execution Başlatma (09:23:22)**

**Log:**
```
09:23:22 AM [TaskStorageService] Task status updated taskId="9eba0917-a577-454f-9d9a-f36f5486b801" status="running"
09:23:22 AM [TaskRoutes] [SkillExecution] Fetching skill from Strapi taskId="9eba0917-a577-454f-9d9a-f36f5486b801" skillId="w5a8pxto572zoznb5t0lsi06"
```

**Kod Akışı:**

**Dosya:** `src/routes/task.routes.ts:299`

```typescript
POST /tasks/:id/execute

async (req: Request, res: Response) => {
  const { id } = req.params;
  const task = await taskStorage.getTask(id);

  // 1. Task status'ü "running" olarak güncelle
  await taskStorage.updateTaskStatus(id, 'running');

  // 2. SSE (Server-Sent Events) headers ayarla - stream için
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 3. Execution log başlat
  const executionLog: any[] = [];

  // 4. İlk status mesajını gönder
  const initialStatus = {
    type: 'status',
    status: 'starting',
    message: `Executing task: ${task.name}`
  };
  executionLog.push(initialStatus);
  res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);
}
```

---

### **ADIM 3: Skill'i Strapi'den Çekme ve Sync Etme (09:23:22)**

**Log:**
```
[SkillSync] ✅ Synced skill: website-to-markdown → C:\Users\Ali\Documents\Projects\claude_agent_ui\.claude\skills\website-to-markdown\SKILL.md
09:23:22 AM [TaskRoutes] [SkillExecution] Synced skill from Strapi to filesystem taskId="9eba0917-a577-454f-9d9a-f36f5486b801" skillId="w5a8pxto572zoznb5t0lsi06" skillName="website-to-markdown" hasInputValues=false
```

**Kod Akışı:**

**Dosya:** `src/routes/task.routes.ts:332-350`

```typescript
if (taskType === 'skill') {
  // 1. STRAPI'DEN SKILL ÇEK (Single Source of Truth)
  const strapiSkill = await strapiClient.getSkill(task.agentId);

  // 2. SKILL SYNC SERVICE - FILESYSTEM'E YAZ
  const { skillSyncService } = await import('../services/skill-sync-service.js');
  const inputValues = task.inputValues || {};

  await skillSyncService.syncSkillToFilesystem(strapiSkill, inputValues);
}
```

**Skill Sync Service Detayları:**

**Dosya:** `src/services/skill-sync-service.ts:22`

```typescript
async syncSkillToFilesystem(
  skill: Skill,
  parameters?: Record<string, any>
): Promise<string> {
  // 1. Skill validasyonu
  this.validateSkill(skill);

  // 2. Skill adını sanitize et (güvenlik - path traversal prevention)
  const sanitizedName = this.sanitizeSkillName(skill.name);
  // "website-to-markdown" → "website-to-markdown"

  // 3. Skill dizini oluştur
  const skillDir = path.join(this.skillsDir, sanitizedName);
  // C:\Users\Ali\Documents\Projects\claude_agent_ui\.claude\skills\website-to-markdown
  await fs.mkdir(skillDir, { recursive: true });

  // 4. Parameter injection ({{param}} değiştirilir)
  let content = skill.skillmd;
  if (parameters && Object.keys(parameters).length > 0) {
    content = this.injectParameters(content, parameters);
  }

  // 5. YAML frontmatter oluştur
  const frontmatter = {
    name: skill.name,
    description: skill.description,
    version: skill.version || '1.0.0',
    category: skill.category || 'custom'
  };

  // 6. Markdown + frontmatter birleştir
  const skillMd = matter.stringify(content, frontmatter);
  const skillPath = path.join(skillDir, 'SKILL.md');

  // 7. Dosyaya yaz
  await fs.writeFile(skillPath, skillMd, 'utf-8');

  console.log(`[SkillSync] ✅ Synced skill: ${skill.name} → ${skillPath}`);
  return skillPath;
}
```

**Yazılan Dosya İçeriği:**

**Path:** `C:\Users\Ali\Documents\Projects\claude_agent_ui\.claude\skills\website-to-markdown\SKILL.md`

```markdown
---
name: website-to-markdown
description: Fetch websites and convert them to markdown format, verify URLs, and save content locally...
version: 1.0.0
category: custom
---

# Website to Markdown Converter

Fetches web content, converts HTML to clean markdown format, and saves it locally.

## Quick Start

**Single URL:**
```
Convert https://example.com to markdown and save it
```

[... skill içeriğinin tamamı ...]
```

---

### **ADIM 4: Filesystem'den Skill'i Yeniden Parse Etme (09:23:22)**

**Log:**
```
09:23:22 AM [ClaudeStructureParser] Parsed skills projectPath="C:/Users/Ali/Documents/Projects/claude_agent_ui" count=14 skills=["hepsiburada-product-research","jmeter-expert",...,"website-to-markdown",...]
09:23:22 AM [TaskRoutes] [SkillExecution] Successfully loaded synced skill from Strapi taskId="9eba0917-a577-454f-9d9a-f36f5486b801" skillId="website-to-markdown" skillName="website-to-markdown"
```

**Kod Akışı:**

```typescript
// Re-parse to get synced skill
const skills = await parser.parseSkills(projectPath);

// Sanitized name ile skill bul
const sanitizedName = strapiSkill.name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
skill = skills.find(s => s.id === sanitizedName || s.id === task.agentId);
```

**Parser Kodu:**

**Dosya:** `src/services/claude-structure-parser.ts:212`

```typescript
async parseSkills(projectPath: string): Promise<Skill[]> {
  const skillsDir = path.join(projectPath, '.claude', 'skills');

  const skills: Skill[] = [];
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = path.join(skillsDir, entry.name);
      const skill = await this.parseSkill(skillPath, entry.name);
      if (skill) skills.push(skill);
    }
  }

  return skills;
}
```

---

### **ADIM 5: Claude SDK ile Execution (09:23:22)**

**Log:**
```
09:23:22 AM [TaskRoutes] Executing skill with SDK skillId="website-to-markdown" prompt="autommate.com" hasSystemPrompt=true allowedTools=["Write","Edit"] hasMcpServers=true permissionMode="bypassPermissions"
09:23:22 AM [TaskRoutes] Skill execution stderr skillId="website-to-markdown" stderr="Spawning Claude Code process: node C:\Users\Ali\Documents\Projects\claude_agent_ui\node_modules\@anthropic-ai\claude-agent-sdk\cli.js ..."
```

**Kod Akışı:**

**Dosya:** `src/routes/task.routes.ts:22-149` (executeSkillTask fonksiyonu)

```typescript
async function executeSkillTask(
  task: Task,
  skill: Skill,
  projectPath: string,
  res: Response,
  executionLog: any[],
  taskStorage: TaskStorageService
): Promise<void> {
  // 1. Claude SDK'yı import et
  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  // 2. System prompt hazırla (skill içeriği)
  let systemPrompt = skill.content;

  // 3. Allowed tools'u parse et
  let allowedTools = skill.metadata?.allowedTools;
  // ["Write", "Edit"]

  // 4. MCP configuration'ı yükle (.mcp.json dosyasından)
  let mcpServers = await loadMcpConfig(projectPath);

  // 5. Permission mode mapping (UI → CLI)
  const cliPermissionMode = task.permissionMode === 'bypass'
    ? 'bypassPermissions'
    : task.permissionMode;

  // 6. CLAUDE SDK QUERY BAŞLATMA
  const queryInstance = query({
    prompt: "autommate.com",  // User prompt
    options: {
      systemPrompt: systemPrompt,  // Skill içeriği
      model: 'claude-sonnet-4-5',
      cwd: projectPath,
      allowedTools: ["Write", "Edit"],
      mcpServers: {
        "chrome-dev": {...},
        "github-repo": {...},
        "playwright": {...}
      },
      permissionMode: "bypassPermissions",
      stderr: (data: string) => {
        // Stderr çıktılarını logla
        logger.error('Skill execution stderr', { skillId: skill.id, stderr: data });
      }
    }
  });

  // 7. STREAM RESPONSES - SSE ile frontend'e gönder
  for await (const message of queryInstance) {
    const eventData = {
      type: 'message',
      messageType: message.type,
      content: message
    };
    executionLog.push(eventData);
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
  }

  // 8. COMPLETED STATUS
  const completedEvent = {
    type: 'status',
    status: 'completed',
    message: 'Skill execution completed'
  };
  res.write(`data: ${JSON.stringify(completedEvent)}\n\n`);

  // 9. Task status güncelle
  await taskStorage.updateTaskStatus(task.id, 'completed', { executionLog });

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}
```

**MCP Config Loading:**

**Dosya:** `src/routes/task.routes.ts:154`

```typescript
async function loadMcpConfig(projectPath: string): Promise<Record<string, any> | undefined> {
  const mcpConfigPath = path.join(projectPath, '.mcp.json');
  const content = await fs.readFile(mcpConfigPath, 'utf-8');
  const config = JSON.parse(content);

  if (config.mcpServers && typeof config.mcpServers === 'object') {
    return config.mcpServers;
  }
}
```

**Yüklenen MCP Servers:**

```json
{
  "chrome-dev": {
    "command": "npx",
    "args": ["-y", "chrome-devtools-mcp@latest"],
    "env": {}
  },
  "github-repo": {
    "command": "npx",
    "args": ["@modelcontextprotocol/server-github", "latest"],
    "env": {}
  },
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest"],
    "env": {}
  }
}
```

---

### **ADIM 6: Claude Code CLI Process Spawn (09:23:22)**

**Spawned Command:**

```bash
node C:\Users\Ali\Documents\Projects\claude_agent_ui\node_modules\@anthropic-ai\claude-agent-sdk\cli.js \
  --output-format stream-json \
  --verbose \
  --input-format stream-json \
  --system-prompt "# Website to Markdown Converter\n\nFetches web content..." \
  --model claude-sonnet-4-5 \
  --allowedTools Write,Edit \
  --mcp-config '{"mcpServers":{...}}' \
  --permission-mode bypassPermissions
```

**Claude SDK İç Akışı:**

1. **Subprocess spawn edilir** - Node.js child_process
2. **Stdin'e user prompt yazılır** - `"autommate.com"`
3. **Claude API'ye request gönderilir** - Anthropic API
4. **Claude'un response'ları stream edilir** - SSE format
5. **WebFetch tool çağrısı yapılır** - `autommate.com` için
6. **Markdown'a convert edilir** - Claude tarafından
7. **Write tool ile dosyaya yazılır** - `markdown-downloads/` dizinine
8. **Completion message döner**

---

### **ADIM 7: Real-time Streaming (09:23:22 - 09:24:04)**

**SSE Stream Events:**

```typescript
// Event 1: Starting
data: {"type":"status","status":"starting","message":"Executing task: autommate"}

// Event 2-N: Claude messages (thinking, tool calls, results)
data: {"type":"message","messageType":"text","content":{"type":"text","text":"I'll help you..."}}
data: {"type":"message","messageType":"tool_use","content":{"type":"tool_use","id":"...","name":"WebFetch",...}}
data: {"type":"message","messageType":"tool_result","content":{"type":"tool_result",...}}

// Event N+1: Completed
data: {"type":"status","status":"completed","message":"Skill execution completed"}

// Event N+2: Done
data: {"type":"done"}
```

**Frontend'de Handling:**

Frontend bu event'leri dinler ve real-time olarak UI'da gösterir.

---

### **ADIM 8: Task Completion (09:24:04)**

**Log:**
```
09:24:04 AM [TaskStorageService] Task status updated taskId="9eba0917-a577-454f-9d9a-f36f5486b801" status="completed"
09:24:04 AM [RequestLogger] [779e52c1-100b-4d50-aade-06c1d8aa5b52] 200 POST /9eba0917-a577-454f-9d9a-f36f5486b801/execute - 42189ms statusCode=200 duration="42189ms"
```

**Task Status Update:**

**Dosya:** `src/services/task-storage-service.ts:134`

```typescript
async updateTaskStatus(taskId: string, status: TaskStatus, data?: Partial<Task>) {
  const task = this.tasks.find(t => t.id === taskId);

  task.status = status; // "completed"

  // Timestamps güncelle
  if (status === 'completed' || status === 'failed') {
    task.completedAt = new Date().toISOString();
    if (task.startedAt) {
      task.duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
      // 42189ms
    }
  }

  // Execution log ekle
  if (data) {
    Object.assign(task, data);
  }

  // .cui/tasks.json dosyasına kaydet
  await this.saveTasks();
}
```

**Final Task Object:**

```json
{
  "id": "9eba0917-a577-454f-9d9a-f36f5486b801",
  "name": "autommate",
  "agentId": "w5a8pxto572zoznb5t0lsi06",
  "agentName": "website-to-markdown",
  "taskType": "skill",
  "status": "completed",
  "userPrompt": "autommate.com",
  "permissionMode": "bypass",
  "createdAt": "2025-11-02T06:23:19.000Z",
  "startedAt": "2025-11-02T06:23:22.000Z",
  "completedAt": "2025-11-02T06:24:04.000Z",
  "duration": 42189,
  "executionLog": [
    { "type": "status", "status": "starting", ... },
    { "type": "message", "content": { ... } },
    ...
    { "type": "status", "status": "completed", ... }
  ]
}
```

---

## 3. Kod Seviyesinde Detaylar

### **Strapi Data Transform**

**Strapi Response (Raw):**

```json
{
  "data": {
    "id": 17,
    "documentId": "w5a8pxto572zoznb5t0lsi06",
    "attributes": {
      "name": "website-to-markdown",
      "displayName": "Website to Markdown",
      "description": "Fetch websites and convert them to markdown format...",
      "skillmd": "# Website to Markdown Converter\n\nFetches web content...",
      "experienceScore": 0,
      "category": "custom",
      "isPublic": true,
      "version": "1.0.0",
      "createdAt": "2025-10-31T11:02:32.895Z",
      "updatedAt": "2025-10-31T11:02:32.895Z",
      "toolConfig": null,
      "modelConfig": null,
      "analytics": null,
      "mcpConfig": [],
      "agentSelection": [],
      "trainingHistory": [],
      "additionalFiles": []
    }
  }
}
```

**Transform Fonksiyonu:**

**Dosya:** `src/services/strapi-client.ts:884`

```typescript
private transformSkill(strapiData: StrapiAttributes<any>): Skill {
  const attrs = this.extractAttributes(strapiData);

  return {
    id: strapiData.documentId,  // "w5a8pxto572zoznb5t0lsi06"
    name: attrs.name,  // "website-to-markdown"
    displayName: attrs.displayName,  // "Website to Markdown"
    description: attrs.description,
    skillmd: attrs.skillmd,  // Markdown content
    experienceScore: attrs.experienceScore || 0,
    category: attrs.category || 'custom',
    isPublic: attrs.isPublic ?? true,
    version: attrs.version || '1.0.0',
    license: attrs.license || undefined,

    // Component fields
    trainingHistory: attrs.trainingHistory || [],
    additionalFiles: attrs.additionalFiles || [],
    agentSelection: attrs.agentSelection || [],
    toolConfig: attrs.toolConfig || undefined,
    modelConfig: attrs.modelConfig || undefined,
    analytics: attrs.analytics || undefined,
    mcpConfig: attrs.mcpConfig || [],
    tasks: attrs.tasks || [],

    trainingAgent: attrs.trainingAgent?.data?.documentId || attrs.trainingAgent,

    createdAt: new Date(attrs.createdAt),
    updatedAt: new Date(attrs.updatedAt)
  };
}
```

---

### **Parameter Injection (Template Replacement)**

Eğer skill içinde `{{param}}` şeklinde template değişkenleri varsa:

**Dosya:** `src/services/skill-sync-service.ts:123`

```typescript
private injectParameters(
  content: string,
  parameters: Record<string, any>
): string {
  let processed = content;

  for (const [key, value] of Object.entries(parameters)) {
    // Support both {{key}} and {{ key }} formats
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    processed = processed.replace(regex, String(value));
  }

  return processed;
}
```

**Örnek:**

```markdown
# Process URL: {{url}}

The target URL is {{url}}.
```

**Parameters:**
```typescript
{ url: "autommate.com" }
```

**Result:**
```markdown
# Process URL: autommate.com

The target URL is autommate.com.
```

---

### **Cache Mekanizması**

**Strapi Client Cache:**

**Dosya:** `src/services/strapi-client.ts:60`

```typescript
constructor() {
  // LRU Cache - 5 dakika TTL, max 100 item
  this.cache = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 5,  // 5 minutes
    updateAgeOnGet: true  // Her erişimde TTL refresh
  });
}

async getSkill(id: string): Promise<Skill> {
  // 1. Cache'de var mı kontrol et
  const cacheKey = `skill:${id}`;
  const cached = this.cache.get(cacheKey);
  if (cached) {
    return cached;  // Cache hit - Strapi'ye request atılmaz
  }

  // 2. Cache miss - Strapi'den çek
  const { data } = await this.client.get(`/skills/${id}`, {...});

  // 3. Transform et
  const skill = this.transformSkill(data.data);

  // 4. Cache'e ekle
  this.cache.set(cacheKey, skill);

  return skill;
}
```

**Cache Invalidation:**

```typescript
// Skill update edildiğinde
async updateSkill(id: string, skillData: UpdateSkillDTO): Promise<Skill> {
  const { data } = await this.client.put(`/skills/${id}`, {...});

  // Cache'i temizle
  this.invalidateCache('skills');  // Tüm skills cache'ini temizle
  this.cache.delete(`skill:${id}`);  // Spesifik skill cache'ini temizle

  return this.transformSkill(data.data);
}
```

---

## 4. Veri Akışı ve Transformasyonlar

### **Veri Akış Diyagramı**

```
┌───────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                     │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ skills table                                         │     │
│  │ - id: 17                                             │     │
│  │ - documentId: "w5a8pxto572zoznb5t0lsi06"             │     │
│  │ - name: "website-to-markdown"                        │     │
│  │ - skillmd: "# Website to Markdown..."                │     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ SQL Query
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                      STRAPI BACKEND                            │
│  GET /api/skills/w5a8pxto572zoznb5t0lsi06?populate=...        │
│                                                                │
│  Response (JSON):                                              │
│  {                                                             │
│    "data": {                                                   │
│      "id": 17,                                                 │
│      "documentId": "w5a8pxto572zoznb5t0lsi06",                 │
│      "attributes": {                                           │
│        "name": "website-to-markdown",                          │
│        "skillmd": "# Website to Markdown...",                  │
│        ...                                                     │
│      }                                                         │
│    }                                                           │
│  }                                                             │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ HTTP Response
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                    STRAPI CLIENT (axios)                       │
│  src/services/strapi-client.ts                                │
│                                                                │
│  transformSkill() →                                            │
│  {                                                             │
│    id: "w5a8pxto572zoznb5t0lsi06",                             │
│    name: "website-to-markdown",                                │
│    skillmd: "# Website to Markdown...",                        │
│    ...                                                         │
│  }                                                             │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ Skill Object
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                   SKILL SYNC SERVICE                           │
│  src/services/skill-sync-service.ts                            │
│                                                                │
│  1. Create directory: .claude/skills/website-to-markdown/     │
│  2. Build frontmatter:                                         │
│     ---                                                        │
│     name: website-to-markdown                                  │
│     description: ...                                           │
│     ---                                                        │
│  3. Write SKILL.md file                                        │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ Filesystem Write
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                      FILESYSTEM                                │
│  .claude/skills/website-to-markdown/SKILL.md                   │
│                                                                │
│  ---                                                           │
│  name: website-to-markdown                                     │
│  description: Fetch websites and convert...                    │
│  ---                                                           │
│                                                                │
│  # Website to Markdown Converter                              │
│  Fetches web content...                                       │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ Filesystem Read
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                 CLAUDE STRUCTURE PARSER                        │
│  src/services/claude-structure-parser.ts                       │
│                                                                │
│  parseSkills() → parseSkill() → parseFrontmatter()            │
│  {                                                             │
│    id: "website-to-markdown",                                  │
│    name: "website-to-markdown",                                │
│    content: "# Website to Markdown...",                        │
│    metadata: { allowedTools: [...], ... }                     │
│  }                                                             │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ Skill Object (Parsed)
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                   CLAUDE AGENT SDK                             │
│  @anthropic-ai/claude-agent-sdk                                │
│                                                                │
│  query({                                                       │
│    prompt: "autommate.com",                                    │
│    options: {                                                  │
│      systemPrompt: skill.content,  // SKILL.md içeriği        │
│      allowedTools: ["Write", "Edit"],                          │
│      ...                                                       │
│    }                                                           │
│  })                                                            │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ Subprocess Spawn
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE CLI                            │
│  node cli.js --system-prompt "..." --model claude-sonnet-4-5  │
│                                                                │
│  → Anthropic API Request                                      │
│  → Tool Execution (WebFetch, Write)                           │
│  → Response Stream                                             │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ SSE Stream
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                    EXPRESS ROUTE HANDLER                       │
│  for await (const message of queryInstance) {                 │
│    res.write(`data: ${JSON.stringify(message)}\n\n`);         │
│  }                                                             │
└─────────────────────────────┬─────────────────────────────────┘
                              │
                              │ Server-Sent Events
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                         FRONTEND                               │
│  React Component - TaskExecutionModal                          │
│                                                                │
│  useEffect(() => {                                             │
│    const eventSource = new EventSource('/tasks/:id/execute')  │
│    eventSource.onmessage = (event) => {                        │
│      // Real-time UI update                                    │
│    }                                                           │
│  })                                                            │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Önemli Kod Noktaları

### **5.1 Security - Path Traversal Prevention**

**Dosya:** `src/services/skill-sync-service.ts:164`

```typescript
private sanitizeSkillName(name: string): string {
  // Remove any path separators and special characters
  // Only allow: alphanumeric, hyphens, underscores
  const sanitized = name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();

  // Use path.basename as additional safety layer
  return path.basename(sanitized);
}
```

**Neden Önemli:**

Kullanıcı `../../../etc/passwd` gibi bir skill name gönderirse, path traversal saldırısı yapabilir. Bu sanitization ile engellenir.

---

### **5.2 Validation - Skill Data**

**Dosya:** `src/services/skill-sync-service.ts:143`

```typescript
private validateSkill(skill: Skill): void {
  if (!skill.name || typeof skill.name !== 'string') {
    throw new Error('Invalid skill: name is required and must be a string');
  }

  if (!skill.skillmd || typeof skill.skillmd !== 'string') {
    throw new Error('Invalid skill: skillmd is required and must be a string');
  }

  // Check content size limit (1MB)
  const MAX_SKILL_SIZE = 1024 * 1024; // 1MB
  if (skill.skillmd.length > MAX_SKILL_SIZE) {
    throw new Error(`Skill content too large: ${skill.name} (max 1MB)`);
  }
}
```

---

### **5.3 Error Handling - Skill Execution**

**Dosya:** `src/routes/task.routes.ts:125`

```typescript
try {
  // Execute skill
  const queryInstance = query({...});

  for await (const message of queryInstance) {
    // Stream to frontend
  }

  // Success
  await taskStorage.updateTaskStatus(task.id, 'completed', { executionLog });

} catch (error) {
  logger.error('Skill task execution error', error);

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorEvent = {
    type: 'error',
    error: errorMessage,
    stderr: stderrOutput ? `\n\nStderr output:\n${stderrOutput}` : ''
  };
  executionLog.push(errorEvent);

  // Update task status to failed
  await taskStorage.updateTaskStatus(task.id, 'failed', {
    error: `${errorMessage}${errorEvent.stderr}`,
    executionLog
  });

  // Send error to frontend
  res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}
```

---

### **5.4 SSE Stream Management**

**Dosya:** `src/routes/task.routes.ts:312-327`

```typescript
// Set SSE headers
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// Send initial status
const initialStatus = {
  type: 'status',
  status: 'starting',
  message: `Executing task: ${task.name}`
};
executionLog.push(initialStatus);
res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

// Stream messages
for await (const message of queryInstance) {
  const eventData = { type: 'message', content: message };
  res.write(`data: ${JSON.stringify(eventData)}\n\n`);
}

// Close stream
res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
res.end();
```

**SSE Format:**

```
data: {"type":"status","status":"starting","message":"Executing task: autommate"}

data: {"type":"message","content":{"type":"text","text":"I'll fetch the website..."}}

data: {"type":"done"}

```

---

### **5.5 Task Storage - JSON File Persistence**

**Dosya:** `src/services/task-storage-service.ts:29`

```typescript
async initialize(): Promise<void> {
  if (this.initialized) return;

  // Ensure .cui directory exists
  const dir = path.dirname(this.tasksFilePath);
  await fs.mkdir(dir, { recursive: true });

  // Try to load existing tasks
  try {
    const data = await fs.readFile(this.tasksFilePath, 'utf-8');
    this.tasks = JSON.parse(data);
    this.logger.info('Loaded tasks from storage', { count: this.tasks.length });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create it
      this.tasks = [];
      await this.saveTasks();
      this.logger.info('Created new tasks storage file', { path: this.tasksFilePath });
    } else {
      throw error;
    }
  }

  this.initialized = true;
}

private async saveTasks(): Promise<void> {
  await fs.writeFile(
    this.tasksFilePath,
    JSON.stringify(this.tasks, null, 2),
    'utf-8'
  );
}
```

**Storage Path:**

```
C:\Users\Ali\.cui\tasks.json
```

**File Format:**

```json
[
  {
    "id": "9eba0917-a577-454f-9d9a-f36f5486b801",
    "name": "autommate",
    "agentId": "w5a8pxto572zoznb5t0lsi06",
    "agentName": "website-to-markdown",
    "taskType": "skill",
    "status": "completed",
    "userPrompt": "autommate.com",
    "permissionMode": "bypass",
    "createdAt": "2025-11-02T06:23:19.819Z",
    "startedAt": "2025-11-02T06:23:22.000Z",
    "completedAt": "2025-11-02T06:24:04.189Z",
    "duration": 42189,
    "executionLog": [...]
  },
  ...
]
```

---

## 📊 Özet Tablo

| Adım | Timestamp | Dosya/Servis | Operasyon | Veri Akışı |
|------|-----------|--------------|-----------|------------|
| 1 | 09:23:19 | `task.routes.ts:229` | Task oluştur | Frontend → Express → TaskStorage |
| 2 | 09:23:19 | `strapi-client.ts:306` | Skill çek | Express → Strapi → PostgreSQL |
| 3 | 09:23:22 | `task.routes.ts:299` | Execution başlat | Express → Task Execute Endpoint |
| 4 | 09:23:22 | `skill-sync-service.ts:22` | Skill sync et | Strapi Data → Filesystem |
| 5 | 09:23:22 | `claude-structure-parser.ts:212` | Skill parse et | Filesystem → Skill Object |
| 6 | 09:23:22 | `task.routes.ts:89` | SDK query | Express → Claude SDK |
| 7 | 09:23:22 | Claude SDK | Subprocess spawn | Node → CLI Process |
| 8 | 09:23:22-09:24:04 | Claude SDK | Stream execution | Claude API → SSE Stream → Frontend |
| 9 | 09:24:04 | `task-storage-service.ts:134` | Task tamamla | TaskStorage → .cui/tasks.json |

---

## 🔍 Kritik Noktalar

### **1. Single Source of Truth: Strapi**

Skill'ler ALWAYS Strapi'den çekilir, filesystem sadece execution için geçici sync noktasıdır.

```typescript
// ALWAYS fetch from Strapi first
const strapiSkill = await strapiClient.getSkill(task.agentId);

// Sync to filesystem before execution
await skillSyncService.syncSkillToFilesystem(strapiSkill, inputValues);

// Re-parse from filesystem for SDK
const skills = await parser.parseSkills(projectPath);
```

---

### **2. Permission Mode Mapping**

UI'daki `bypass` → CLI'daki `bypassPermissions`

```typescript
const cliPermissionMode = task.permissionMode === 'bypass'
  ? 'bypassPermissions'
  : task.permissionMode;
```

---

### **3. Execution Log Persistence**

Tüm execution adımları log'lanır ve task'a kaydedilir:

```typescript
const executionLog: any[] = [];

// Her event log'a eklenir
executionLog.push({ type: 'status', ... });
executionLog.push({ type: 'message', ... });

// Task tamamlandığında log kaydedilir
await taskStorage.updateTaskStatus(task.id, 'completed', { executionLog });
```

---

### **4. SSE Stream için Connection Keep-Alive**

```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// Stream open kalır, her message anında gönderilir
for await (const message of queryInstance) {
  res.write(`data: ${JSON.stringify(message)}\n\n`);
}
```

---

## 🎯 Sonuç

**autommate.com** için **website-to-markdown** skill execution'ı:

1. ✅ Frontend'den task oluşturuldu
2. ✅ Strapi'den skill verisi çekildi
3. ✅ Filesystem'e SKILL.md sync edildi
4. ✅ Claude SDK ile subprocess spawn edildi
5. ✅ Claude API'den response stream alındı
6. ✅ WebFetch ve Write tool'ları kullanıldı
7. ✅ Markdown dosyası oluşturuldu
8. ✅ 42 saniyede başarıyla tamamlandı
9. ✅ Execution log'ları kaydedildi

**Total Duration:** 42.189 saniye
**Status:** ✅ Completed
**Output:** `markdown-downloads/autommate-com.md`

---

**Rapor Hazırlayan:** Claude Code
**Tarih:** 2025-11-02
**Versiyon:** 1.0
