# 3. Task Execution (POST /api/tasks/:id/execute)

Task execution, skill'in Claude SDK ile çalıştırılması ve sonuçların SSE (Server-Sent Events) üzerinden stream edilmesi sürecidir.

## 📍 Endpoint

```
POST /api/tasks/{task-id}/execute
Accept: text/event-stream
```

## 🔄 Execution Flow Özeti

```
1. Task status → "running"
2. SSE headers set edilir
3. Initial status event gönderilir
4. Skill Strapi'den fetch edilir
5. Filesystem'e sync edilir
6. Skill parse edilir
7. System prompt oluşturulur (skill lock warning + content)
8. Execution metadata set edilir
9. Claude SDK ile execute edilir
10. Her event SSE üzerinden stream edilir
11. Task status → "completed/failed"
12. Log kaydedilir
13. SSE connection kapatılır
```

## 📡 SSE Stream Format

### Headers

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Event Format

```
data: {JSON_PAYLOAD}\n\n
```

Her event bir JSON objesi olarak gönderilir. Format:

```json
{
  "type": "status" | "message" | "done",
  ... (event-specific fields)
}
```

## 📋 Event Tipleri

### 1. Status Events

#### Starting Event

```json
{
  "type": "status",
  "status": "starting",
  "message": "Executing task: Task Name"
}
```

**Ne zaman:** Execution başladığında (ilk event)

#### Completed Event

```json
{
  "type": "status",
  "status": "completed",
  "message": "Skill execution completed"
}
```

**Ne zaman:** Execution başarıyla tamamlandığında (son event'ten önce)

#### Failed Event

```json
{
  "type": "status",
  "status": "failed",
  "message": "Skill execution failed",
  "error": "Error details..."
}
```

**Ne zaman:** Execution hata aldığında

### 2. System Event (Initialization)

```json
{
  "type": "message",
  "messageType": "system",
  "content": {
    "type": "system",
    "subtype": "init",
    "cwd": "C:\\Users\\Ali\\Documents\\Projects\\claude_agent_ui",
    "session_id": "4f8a8e7f-1fa6-4d9b-adcd-227ead89b0aa",
    "tools": [
      "Task",
      "Bash",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep",
      "WebSearch",
      "WebFetch",
      "NotebookEdit",
      "TodoWrite",
      "BashOutput",
      "KillShell",
      "AskUserQuestion"
    ],
    "mcp_servers": [
      {
        "name": "github-repo",
        "status": "connected"
      },
      {
        "name": "filesystem",
        "status": "connected"
      }
    ],
    "model": "claude-sonnet-4-5",
    "permissionMode": "bypassPermissions",
    "slash_commands": [
      "compact",
      "context",
      "help"
    ],
    "skills": [],
    "uuid": "8ca7e6b4-3411-45f1-a309-90af0bbb6000"
  }
}
```

**Ne zaman:** Claude SDK session başlatıldığında (execution başlangıcında)

**İçerik:**
- `cwd`: Working directory
- `session_id`: Claude session UUID
- `tools`: Kullanılabilir toollar
- `mcp_servers`: Bağlı MCP serverlar
- `model`: Kullanılan Claude model
- `permissionMode`: Permission modu
- `slash_commands`: Kullanılabilir slash komutlar
- `skills`: Erişilebilir skilliler (forced mode'da boş array)

### 3. Assistant Message Events

#### 3A. Text Message

```json
{
  "type": "message",
  "messageType": "assistant",
  "content": {
    "type": "assistant",
    "message": {
      "model": "claude-sonnet-4-5-20250929",
      "id": "msg_01ArQ1eyoCnQVWKHPodCfwwp",
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "I'll fetch google.com and convert it to markdown format. Let me start by creating the output directory."
        }
      ],
      "usage": {
        "input_tokens": 3,
        "cache_creation_input_tokens": 33008,
        "cache_read_input_tokens": 0,
        "output_tokens": 28
      }
    },
    "session_id": "4f8a8e7f-1fa6-4d9b-adcd-227ead89b0aa",
    "uuid": "d507e9ef-e05d-4e97-a92e-13c1ddeaf838"
  }
}
```

**Ne zaman:** Claude text yanıtı ürettiğinde

**Önemli Alanlar:**
- `message.id`: Mesaj ID'si
- `message.content[].text`: Claude'un text yanıtı
- `message.usage`: Token kullanımı
  - `input_tokens`: Input tokens
  - `cache_creation_input_tokens`: Cache oluşturma tokens
  - `cache_read_input_tokens`: Cache okuma tokens
  - `output_tokens`: Output tokens

#### 3B. Tool Use Message

```json
{
  "type": "message",
  "messageType": "assistant",
  "content": {
    "type": "assistant",
    "message": {
      "id": "msg_01X8Zj9k2L3m4N5o6P7q8R9s",
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_019ESMo4G81xJpZiSactir3z",
          "name": "Bash",
          "input": {
            "command": "mkdir -p ./markdown-downloads",
            "description": "Create markdown-downloads directory"
          }
        }
      ],
      "usage": {
        "input_tokens": 5,
        "cache_read_input_tokens": 33008,
        "output_tokens": 45
      }
    },
    "session_id": "4f8a8e7f-1fa6-4d9b-adcd-227ead89b0aa",
    "uuid": "41157b4e-f9f4-4a5a-a7d4-137b364a17a7"
  }
}
```

**Ne zaman:** Claude bir tool kullanmak istediğinde

**Önemli Alanlar:**
- `content[].type`: `"tool_use"`
- `content[].id`: Tool use ID (tool result için gerekli)
- `content[].name`: Tool adı (`Bash`, `Write`, `Read`, vb.)
- `content[].input`: Tool'a gönderilen parametreler

**Tool Örnekleri:**

**Bash Tool:**
```json
{
  "type": "tool_use",
  "id": "toolu_01ABC",
  "name": "Bash",
  "input": {
    "command": "ls -la",
    "description": "List files"
  }
}
```

**Write Tool:**
```json
{
  "type": "tool_use",
  "id": "toolu_01XYZ",
  "name": "Write",
  "input": {
    "file_path": "./output.md",
    "content": "# Content here"
  }
}
```

**WebFetch Tool:**
```json
{
  "type": "tool_use",
  "id": "toolu_01QRS",
  "name": "WebFetch",
  "input": {
    "url": "https://google.com",
    "prompt": "Convert this page to markdown"
  }
}
```

### 4. User Message Events (Tool Results)

```json
{
  "type": "message",
  "messageType": "user",
  "content": {
    "type": "user",
    "message": {
      "role": "user",
      "content": [
        {
          "tool_use_id": "toolu_019ESMo4G81xJpZiSactir3z",
          "type": "tool_result",
          "content": "",
          "is_error": false
        }
      ]
    },
    "session_id": "4f8a8e7f-1fa6-4d9b-adcd-227ead89b0aa",
    "uuid": "8b9c0d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e"
  }
}
```

**Ne zaman:** Tool çalıştırıldıktan sonra, sonuç Claude'a dönüldüğünde

**Önemli Alanlar:**
- `content[].tool_use_id`: Hangi tool use'a ait
- `content[].content`: Tool'un döndürdüğü sonuç (string)
- `content[].is_error`: Hata olup olmadığı (boolean)

**Başarılı Tool Result:**
```json
{
  "tool_use_id": "toolu_01ABC",
  "type": "tool_result",
  "content": "Directory created successfully",
  "is_error": false
}
```

**Hatalı Tool Result:**
```json
{
  "tool_use_id": "toolu_01XYZ",
  "type": "tool_result",
  "content": "Error: Permission denied",
  "is_error": true
}
```

### 5. Result Event (Final Summary)

```json
{
  "type": "message",
  "messageType": "result",
  "content": {
    "type": "result",
    "subtype": "success",
    "is_error": false,
    "duration_ms": 22814,
    "duration_api_ms": 21116,
    "num_turns": 9,
    "result": "✅ **Successfully downloaded!**\n\n- **File saved:** `markdown-downloads/google-com.md`\n- **Size:** 2.1 KB\n- **Format:** Clean markdown without HTML tags",
    "session_id": "4f8a8e7f-1fa6-4d9b-adcd-227ead89b0aa",
    "total_cost_usd": 0.16096540000000004,
    "usage": {
      "input_tokens": 16,
      "cache_creation_input_tokens": 33868,
      "cache_read_input_tokens": 66498,
      "output_tokens": 624
    },
    "modelUsage": {
      "claude-sonnet-4-5": {
        "inputTokens": 16,
        "outputTokens": 624,
        "costUSD": 0.156362
      }
    }
  }
}
```

**Ne zaman:** Execution tamamlandığında (en son Assistant message'ından sonra)

**Önemli Alanlar:**
- `subtype`: `"success"` veya `"error"`
- `is_error`: Hata olup olmadığı
- `duration_ms`: Toplam süre (milisaniye)
- `num_turns`: Conversation turn sayısı
- `result`: Final sonuç metni
- `total_cost_usd`: Toplam maliyet (USD)
- `usage`: Token kullanım detayları
- `modelUsage`: Model bazında kullanım ve maliyet

### 6. Done Event

```json
{
  "type": "done"
}
```

**Ne zaman:** SSE stream'i kapatmadan önce (en son event)

**Amaç:** Client'a stream'in bittiğini bildirmek

## 🔧 Execution Implementation

### Kod Referansı
**Dosya:** `src/routes/task.routes.ts`
**Function:** `executeSkillTask` (Lines 22-184)

### Step-by-Step Implementation

#### STEP 1: Set Execution Metadata

**Kod:** Lines 37-52

```typescript
const skillExecutionMetadata: SkillExecutionMetadata = {
  selectedSkillId: skill.id,
  selectedSkillName: skill.name,
  source: 'strapi',
  isolationLevel: 'full' as const,
  systemPromptSource: 'skill.content' as const,
  otherSkillsAccessible: false,
};

// Add to task metadata
if (!task.metadata) {
  task.metadata = {};
}
task.metadata.skillExecution = skillExecutionMetadata;
task.executionMode = 'forced';
task.taskType = 'skill';
```

**Amaç:**
- Skill execution metadata'sını kaydet
- Isolation level: **full** (sadece bu skill erişilebilir)
- Execution mode: **forced** (autonomous değil)

#### STEP 2: Inject Parameters

**Kod:** Lines 66-76

```typescript
let processedContent = skill.content;
const parameters = task.inputValues || {};

if (Object.keys(parameters).length > 0) {
  Object.entries(parameters).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    processedContent = processedContent.replace(regex, String(value));
  });
}
```

**Amaç:** Skill content'ine parameter değerlerini inject et

**Örnek:**
- Skill content: `"Download {{url}} to {{outputDir}}"`
- Parameters: `{ url: "google.com", outputDir: "./downloads" }`
- Result: `"Download google.com to ./downloads"`

#### STEP 3: Build System Prompt with Skill Lock Warning

**Kod:** Lines 78-97

```typescript
const skillLockWarning = `# ⚠️ FORCED SKILL EXECUTION MODE

You are executing ONLY the "${skill.name}" skill.
- Do NOT attempt to use any other skills or commands.
- Do NOT look for other skills in the filesystem.
- Follow ONLY the instructions defined in this skill.
- Use ONLY the tools specified in this skill's configuration.

---

`;

let systemPrompt = skillLockWarning + processedContent;

if (Object.keys(parameters).length > 0) {
  const paramContext = Object.entries(parameters)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');
  systemPrompt = skillLockWarning + `# Skill Parameters\n${paramContext}\n\n${processedContent}`;
}
```

**Final System Prompt (Parametresiz):**
```markdown
# ⚠️ FORCED SKILL EXECUTION MODE

You are executing ONLY the "web-to-markdown-ts" skill.
- Do NOT attempt to use any other skills or commands.
- Do NOT look for other skills in the filesystem.
- Follow ONLY the instructions defined in this skill.
- Use ONLY the tools specified in this skill's configuration.

---

# Web to Markdown Converter

This skill downloads web pages...
```

**Final System Prompt (Parametreli):**
```markdown
# ⚠️ FORCED SKILL EXECUTION MODE

You are executing ONLY the "web-to-markdown-ts" skill.
- Do NOT attempt to use any other skills or commands.
- Do NOT look for other skills in the filesystem.
- Follow ONLY the instructions defined in this skill.
- Use ONLY the tools specified in this skill's configuration.

---

# Skill Parameters
- url: https://google.com
- outputDir: ./downloads

# Web to Markdown Converter

This skill downloads web pages...
```

#### STEP 4: Parse Allowed Tools

**Kod:** Lines 100-108

```typescript
let allowedTools = skill.metadata?.allowedTools;

// Fallback to MCP tools if allowedTools not set
if (!allowedTools && skill.metadata?.mcpTools) {
  allowedTools = Object.values(skill.metadata.mcpTools).flat();
}

// Handle string format (comma-separated)
if (allowedTools && typeof allowedTools === 'string') {
  allowedTools = (allowedTools as any).split(',').map((t: string) => t.trim());
}
```

**Amaç:** Skill'in kullanabileceği toolları belirle

**Örnek:**
- `allowedTools: ["Read", "Write", "WebFetch", "Bash"]`

#### STEP 5: Load MCP Configuration

**Kod:** Lines 110-111

```typescript
let mcpServers = await loadMcpConfig(projectPath);
```

**Function:** `loadMcpConfig` (Lines 189-205)

```typescript
async function loadMcpConfig(projectPath: string) {
  const mcpConfigPath = path.join(projectPath, '.mcp.json');

  try {
    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const config = JSON.parse(content);
    return config.mcpServers || undefined;
  } catch (error) {
    logger.warn('Failed to load MCP config', { error: (error as Error).message });
    return undefined;
  }
}
```

**Amaç:** Projedeki `.mcp.json` dosyasından MCP server konfigürasyonlarını yükle

#### STEP 6: Execute with Claude SDK

**Kod:** Lines 124-149

```typescript
const { query } = await import('@anthropic-ai/claude-agent-sdk');

const queryInstance = query({
  prompt: task.userPrompt,
  options: {
    systemPrompt: systemPrompt,
    model: 'claude-sonnet-4-5',
    cwd: projectPath,
    allowedTools: allowedTools && Array.isArray(allowedTools) ? allowedTools : undefined,
    mcpServers: mcpServers,
    permissionMode: (cliPermissionMode || 'default') as any,
    stderr: (data: string) => {
      stderrOutput += data;
      logger.error('Skill execution stderr', { skillId: skill.id, stderr: data });
    },
  },
});

// Stream responses via SSE
for await (const message of queryInstance) {
  const eventData = {
    type: 'message',
    messageType: message.type,
    content: message
  };
  executionLog.push(eventData);
  res.write(`data: ${JSON.stringify(eventData)}\n\n`);
}
```

**Parametreler:**
- `prompt`: User'ın prompt'u (task.userPrompt)
- `systemPrompt`: Skill lock warning + skill content
- `model`: `'claude-sonnet-4-5'`
- `cwd`: Working directory
- `allowedTools`: İzin verilen toollar
- `mcpServers`: MCP server configs
- `permissionMode`: `'default'`, `'bypass'`, `'auto'`

**Stream:**
- Her message event SSE üzerinden gönderilir
- Event `executionLog` array'ine eklenir (log için)

#### STEP 7: Send Completion Status

**Kod:** Lines 152-159

```typescript
const completedEvent = {
  type: 'status',
  status: 'completed',
  message: 'Skill execution completed'
};
executionLog.push(completedEvent);
res.write(`data: ${JSON.stringify(completedEvent)}\n\n`);

await taskStorage.updateTaskStatus(task.id, 'completed', { executionLog });
```

**Amaç:**
- Completion status eventi gönder
- Task status'ü `"completed"` yap
- Execution log'u kaydet

#### STEP 8: Close SSE Connection

**Kod:** Lines 161-162

```typescript
res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
res.end();
```

## 📊 Complete Event Sequence

```
1. data: {"type":"status","status":"starting",...}\n\n

2. data: {"type":"message","messageType":"system","content":{...init...}}\n\n

3. data: {"type":"message","messageType":"assistant","content":{...text...}}\n\n

4. data: {"type":"message","messageType":"assistant","content":{...tool_use:Bash...}}\n\n

5. data: {"type":"message","messageType":"user","content":{...tool_result...}}\n\n

6. data: {"type":"message","messageType":"assistant","content":{...tool_use:WebFetch...}}\n\n

7. data: {"type":"message","messageType":"user","content":{...tool_result...}}\n\n

8. data: {"type":"message","messageType":"assistant","content":{...tool_use:Write...}}\n\n

9. data: {"type":"message","messageType":"user","content":{...tool_result...}}\n\n

10. data: {"type":"message","messageType":"assistant","content":{...final_text...}}\n\n

11. data: {"type":"message","messageType":"result","content":{...success...}}\n\n

12. data: {"type":"status","status":"completed",...}\n\n

13. data: {"type":"done"}\n\n

[Connection closed]
```

## 🧪 Test Script

Python script ile test:

```python
import requests

task_id = "your-task-id"
url = f"http://localhost:3001/api/tasks/{task_id}/execute"

response = requests.post(url, stream=True)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]  # Remove "data: " prefix
            print(data)
```

## 🔗 Sonraki Adım

Execution tamamlandıktan sonra log kaydedilir:

→ Detaylar için: [04-result-storage.md](./04-result-storage.md)

---

**Kod Referansları:**
- Task Execution: `src/routes/task.routes.ts:334-630`
- Execute Skill Task: `src/routes/task.routes.ts:22-184`
- MCP Config Loader: `src/routes/task.routes.ts:189-205`
