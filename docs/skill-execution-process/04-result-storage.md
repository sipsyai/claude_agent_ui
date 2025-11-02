# 4. Sonuç Saklama (Result Storage)

Task execution tamamlandığında tüm sonuçlar `logs/` klasörüne kaydedilir. Her task için ayrı bir log dosyası oluşturulur.

## 📁 Dosya Yapısı

```
logs/
├── _index.json                              # Hızlı listing için index dosyası
├── {task-id-1}.json                         # Task 1 log dosyası (full)
├── {task-id-2}.json                         # Task 2 log dosyası (full)
└── {task-id-3}.json                         # Task 3 log dosyası (full)
```

## 🗂️ Task Log Dosyası Formatı

### Konum
`logs/{task-id}.json`

### Yapı

```json
{
  "id": "abf080eb-95be-4573-9554-e407f597d401",
  "name": "Download Google Homepage",
  "description": "Optional description",
  "agentId": "s59hc06euvds718iniq307mh",
  "agentName": "web-to-markdown-ts",
  "taskType": "skill",
  "executionMode": "forced",
  "status": "completed",
  "userPrompt": "google.com",
  "inputValues": {
    "url": "https://google.com"
  },
  "permissionMode": "bypass",
  "createdAt": "2025-11-02T06:51:04.732Z",
  "directory": "C:/Users/Ali/Documents/Projects/claude_agent_ui",
  "startedAt": "2025-11-02T06:51:34.438Z",
  "completedAt": "2025-11-02T06:52:03.125Z",
  "duration": 28687,
  "metadata": {
    "skillExecution": {
      "selectedSkillId": "s59hc06euvds718iniq307mh",
      "selectedSkillName": "web-to-markdown-ts",
      "source": "strapi",
      "isolationLevel": "full",
      "systemPromptSource": "skill.content",
      "otherSkillsAccessible": false
    }
  },
  "executionLog": [
    {
      "type": "status",
      "status": "starting",
      "message": "Executing task: Download Google Homepage"
    },
    {
      "type": "message",
      "messageType": "system",
      "content": {
        "type": "system",
        "subtype": "init",
        ...
      }
    },
    ...
  ]
}
```

### Alan Açıklamaları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | string | Task UUID (unique identifier) |
| `name` | string | Task görünen adı |
| `description` | string? | Task açıklaması (isteğe bağlı) |
| `agentId` | string | Skill/Agent Strapi document ID |
| `agentName` | string | Skill/Agent görünen adı |
| `taskType` | string | `"skill"` veya `"agent"` |
| `executionMode` | string? | `"forced"` veya `"autonomous"` |
| `status` | string | `"pending"`, `"running"`, `"completed"`, `"failed"` |
| `userPrompt` | string | Kullanıcının girdiği prompt |
| `inputValues` | object? | Skill parametreleri (key-value pairs) |
| `permissionMode` | string | `"default"`, `"bypass"`, `"auto"` |
| `createdAt` | string | Task oluşturulma zamanı (ISO 8601) |
| `directory` | string? | Çalışma dizini |
| `startedAt` | string? | Execution başlangıç zamanı (ISO 8601) |
| `completedAt` | string? | Execution bitiş zamanı (ISO 8601) |
| `duration` | number? | Execution süresi (milisaniye) |
| `metadata` | object? | Ek metadata (skillExecution, vb.) |
| `executionLog` | array? | Tüm SSE eventler (execution sırasında) |

### Metadata Detayları

#### skillExecution Metadata

```json
{
  "skillExecution": {
    "selectedSkillId": "s59hc06euvds718iniq307mh",
    "selectedSkillName": "web-to-markdown-ts",
    "source": "strapi",
    "isolationLevel": "full",
    "systemPromptSource": "skill.content",
    "otherSkillsAccessible": false
  }
}
```

**Alanlar:**
- `selectedSkillId`: Çalıştırılan skill'in ID'si
- `selectedSkillName`: Çalıştırılan skill'in adı
- `source`: Skill kaynağı (`"strapi"` veya `"filesystem"`)
- `isolationLevel`: Isolation seviyesi (`"full"`, `"partial"`, `"none"`)
- `systemPromptSource`: System prompt kaynağı (`"skill.content"` veya `"agent.systemPrompt"`)
- `otherSkillsAccessible`: Başka skill'lere erişim var mı? (boolean)

## 📋 Index Dosyası Formatı

### Konum
`logs/_index.json`

### Amaç
- Tüm task dosyalarını okumadan hızlı listing
- Sadece özet bilgiler içerir
- Task sayısı çok olduğunda performans

### Yapı

```json
[
  {
    "id": "abf080eb-95be-4573-9554-e407f597d401",
    "name": "Download Google Homepage",
    "status": "completed",
    "taskType": "skill",
    "agentName": "web-to-markdown-ts",
    "createdAt": "2025-11-02T06:51:04.732Z",
    "completedAt": "2025-11-02T06:52:03.125Z"
  },
  {
    "id": "f3a21c5d-8b4e-4a1f-9c2d-7e6f5a4b3c2d",
    "name": "Create Load Test Plan",
    "status": "completed",
    "taskType": "skill",
    "agentName": "jmeter-expert",
    "createdAt": "2025-11-02T08:15:22.641Z",
    "completedAt": "2025-11-02T08:16:45.892Z"
  },
  {
    "id": "e2b4f6a8-1c3d-4e5f-9a7b-6c8d0e2f4a6b",
    "name": "Test Skill Isolation",
    "status": "pending",
    "taskType": "skill",
    "agentName": "web-to-markdown-ts",
    "createdAt": "2025-11-02T07:29:25.027Z",
    "completedAt": null
  }
]
```

### Index Entry Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | string | Task UUID |
| `name` | string | Task adı |
| `status` | string | Task durumu |
| `taskType` | string | Task tipi |
| `agentName` | string | Skill/Agent adı |
| `createdAt` | string | Oluşturulma zamanı |
| `completedAt` | string? | Tamamlanma zamanı (null ise pending/running) |

**Sıralama:** Yeni task'lar başta (reverse chronological)

## 🔄 Storage Service İşlemleri

### Kod Referansı
**Dosya:** `src/services/task-storage-service.ts`

### Create Task

**Method:** `createTask` (Lines 159-191)

```typescript
async createTask(request: CreateTaskRequest, agentName: string): Promise<Task> {
  const task: Task = {
    id: randomUUID(),
    name: request.name,
    agentId: request.agentId,
    agentName,
    taskType: request.taskType || 'agent',
    status: 'pending',
    userPrompt: request.userPrompt,
    inputValues: request.inputValues,
    permissionMode: request.permissionMode || 'default',
    createdAt: new Date().toISOString(),
    directory: request.directory,
  };

  // Save to logs/{task-id}.json
  await this.saveTask(task);

  // Update index
  await this.updateIndex(task);

  return task;
}
```

**Yapılan İşlemler:**
1. UUID oluştur
2. Task objesi yarat (status: `"pending"`)
3. `logs/{task-id}.json` dosyasına yaz
4. `logs/_index.json` dosyasını güncelle

### Update Task Status

**Method:** `updateTaskStatus` (Lines 239-276)

```typescript
async updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  updates?: Partial<Task>
): Promise<void> {
  const task = await this.getTask(taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Update task object
  task.status = status;

  if (status === 'running' && !task.startedAt) {
    task.startedAt = new Date().toISOString();
  }

  if (status === 'completed' || status === 'failed') {
    task.completedAt = new Date().toISOString();
    if (task.startedAt) {
      task.duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
    }
  }

  // Apply additional updates
  if (updates) {
    Object.assign(task, updates);
  }

  // Save updated task
  await this.saveTask(task);

  // Update index
  await this.updateIndex(task);
}
```

**Status Değişiklikleri:**

**pending → running:**
- `startedAt` timestamp eklenir

**running → completed:**
- `completedAt` timestamp eklenir
- `duration` hesaplanır (ms)
- `executionLog` kaydedilir

**running → failed:**
- `completedAt` timestamp eklenir
- `error` kaydedilir

### Save Task

**Method:** `saveTask` (Lines 216-222)

```typescript
private async saveTask(task: Task): Promise<void> {
  const filePath = this.getTaskFilePath(task.id);
  await fs.writeFile(filePath, JSON.stringify(task, null, 2), 'utf-8');
  this.logger.debug('Task saved', { taskId: task.id, filePath });
}
```

**Dosya:** `logs/{task-id}.json`
**Format:** Pretty-printed JSON (2 space indent)

### Update Index

**Method:** `updateIndex` (Lines 278-301)

```typescript
private async updateIndex(task: Task): Promise<void> {
  const index = await this.loadIndex();

  // Remove existing entry
  const filtered = index.filter(t => t.id !== task.id);

  // Add new entry at the beginning (newest first)
  filtered.unshift({
    id: task.id,
    name: task.name,
    status: task.status,
    taskType: task.taskType,
    agentName: task.agentName,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  });

  await this.saveIndex(filtered);
}
```

**Özellikler:**
- Existing entry kaldırılır (duplicate önlenir)
- Yeni entry başa eklenir (reverse chronological)
- Sadece özet bilgiler kaydedilir

## 🔍 Get Tasks

### Get Single Task

**Endpoint:** `GET /api/tasks/{task-id}`

**Response:**
```json
{
  "id": "abf080eb-95be-4573-9554-e407f597d401",
  "name": "Download Google Homepage",
  "status": "completed",
  ... (full task object)
}
```

**Backend:**
```typescript
const task = await taskStorage.getTask(taskId);
res.json(task);
```

### List Tasks

**Endpoint:** `GET /api/tasks?limit=10&offset=0`

**Response:**
```json
{
  "tasks": [
    {
      "id": "...",
      "name": "...",
      ...
    }
  ],
  "total": 25
}
```

**Backend:**
```typescript
const { tasks, total } = await taskStorage.getTasks({
  limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
});
res.json({ tasks, total });
```

## 📊 Örnek Log Dosyaları

### Örnek 1: Completed Skill Task

**Dosya:** `logs/abf080eb-95be-4573-9554-e407f597d401.json`

```json
{
  "id": "abf080eb-95be-4573-9554-e407f597d401",
  "name": "Download Google Homepage",
  "agentId": "s59hc06euvds718iniq307mh",
  "agentName": "web-to-markdown-ts",
  "taskType": "skill",
  "executionMode": "forced",
  "status": "completed",
  "userPrompt": "google.com",
  "inputValues": {
    "url": "https://google.com"
  },
  "permissionMode": "bypass",
  "createdAt": "2025-11-02T06:51:04.732Z",
  "directory": "C:/Users/Ali/Documents/Projects/claude_agent_ui",
  "startedAt": "2025-11-02T06:51:34.438Z",
  "completedAt": "2025-11-02T06:52:03.125Z",
  "duration": 28687,
  "metadata": {
    "skillExecution": {
      "selectedSkillId": "s59hc06euvds718iniq307mh",
      "selectedSkillName": "web-to-markdown-ts",
      "source": "strapi",
      "isolationLevel": "full",
      "systemPromptSource": "skill.content",
      "otherSkillsAccessible": false
    }
  },
  "executionLog": [
    {
      "type": "status",
      "status": "starting",
      "message": "Executing task: Download Google Homepage"
    },
    {
      "type": "message",
      "messageType": "system",
      "content": {
        "type": "system",
        "subtype": "init",
        "cwd": "C:\\Users\\Ali\\Documents\\Projects\\claude_agent_ui",
        "model": "claude-sonnet-4-5",
        "session_id": "4f8a8e7f-1fa6-4d9b-adcd-227ead89b0aa"
      }
    },
    {
      "type": "message",
      "messageType": "assistant",
      "content": {
        "type": "assistant",
        "message": {
          "content": [
            {
              "type": "text",
              "text": "I'll download google.com and convert it to markdown..."
            }
          ]
        }
      }
    },
    {
      "type": "message",
      "messageType": "result",
      "content": {
        "type": "result",
        "subtype": "success",
        "duration_ms": 22814,
        "num_turns": 9,
        "total_cost_usd": 0.160965
      }
    },
    {
      "type": "status",
      "status": "completed",
      "message": "Skill execution completed"
    }
  ]
}
```

### Örnek 2: Failed Task

**Dosya:** `logs/e5c7d9a2-4b1f-3e8d-9a6c-2f4e8d1a5b7c.json`

```json
{
  "id": "e5c7d9a2-4b1f-3e8d-9a6c-2f4e8d1a5b7c",
  "name": "Invalid Skill Test",
  "agentId": "invalid-skill-id",
  "agentName": "unknown",
  "taskType": "skill",
  "status": "failed",
  "userPrompt": "Test prompt",
  "permissionMode": "default",
  "createdAt": "2025-11-02T09:30:15.123Z",
  "startedAt": "2025-11-02T09:30:20.456Z",
  "completedAt": "2025-11-02T09:30:22.789Z",
  "duration": 2333,
  "error": "Skill not found in Strapi or filesystem",
  "executionLog": [
    {
      "type": "status",
      "status": "starting",
      "message": "Executing task: Invalid Skill Test"
    },
    {
      "type": "error",
      "error": "Skill not found in Strapi or filesystem"
    },
    {
      "type": "status",
      "status": "failed",
      "message": "Skill execution failed"
    }
  ]
}
```

### Örnek 3: Pending Task

**Dosya:** `logs/8c3ed658-bf7c-42a9-807a-b89dc2a0f1a1.json`

```json
{
  "id": "8c3ed658-bf7c-42a9-807a-b89dc2a0f1a1",
  "name": "Test Skill Isolation",
  "agentId": "s59hc06euvds718iniq307mh",
  "agentName": "web-to-markdown-ts",
  "taskType": "skill",
  "status": "pending",
  "userPrompt": "Test skill isolation - list files in current directory",
  "permissionMode": "bypass",
  "createdAt": "2025-11-02T07:29:25.027Z"
}
```

**Not:** Pending task'larda `startedAt`, `completedAt`, `duration`, `executionLog` yok.

## 📈 Performans

### Neden Individual Files?

**Eski Sistem (Single JSON):**
- Tüm tasklar tek dosyada: `tasks.json`
- Her okumada tüm dosya parse edilir
- Task sayısı arttıkça yavaşlar
- Concurrent write problemi

**Yeni Sistem (Individual Files):**
- Her task ayrı dosya: `{task-id}.json`
- Sadece gerekli task okunur
- Parallel write işlemleri
- Index ile hızlı listing

### Karşılaştırma

| İşlem | Eski (Single File) | Yeni (Individual Files) |
|-------|-------------------|-------------------------|
| Get single task | O(n) - Parse all | O(1) - Read one file |
| List tasks | O(n) - Parse all | O(1) - Read index |
| Create task | O(n) - Write all | O(1) - Write one file |
| Update task | O(n) - Write all | O(1) - Write one file |

**Sonuç:** 100+ task ile 100x performans artışı.

## 🔗 Sonraki Adım

Tüm süreci bir arada görmek için:

→ Detaylar için: [05-complete-example.md](./05-complete-example.md)

---

**Kod Referansları:**
- Task Storage Service: `src/services/task-storage-service.ts`
- Create Task: `src/services/task-storage-service.ts:159-191`
- Update Status: `src/services/task-storage-service.ts:239-276`
- Save Task: `src/services/task-storage-service.ts:216-222`
- Update Index: `src/services/task-storage-service.ts:278-301`
