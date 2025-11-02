# Claude Agent UI - Strapi & PostgreSQL Migration Analizi

**Proje:** Claude Agent UI
**Mevcut Stack:** Express + SQLite + React
**Hedef Stack:** Strapi + PostgreSQL + React (Hybrid Architecture)
**Tarih:** 2025-10-31

---

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Mevcut Mimari](#mevcut-mimari)
3. [Hedef Mimari](#hedef-mimari)
4. [Teknoloji Karşılaştırması](#teknoloji-karşılaştırması)
5. [Risk Analizi](#risk-analizi)
6. [Migration Stratejisi](#migration-stratejisi)
7. [Implementation Plan](#implementation-plan)
8. [Kod Örnekleri](#kod-örnekleri)
9. [Timeline & Effort Estimation](#timeline--effort-estimation)
10. [Rollback Planı](#rollback-planı)

---

## Genel Bakış

### Amaç
Mevcut Express + SQLite tabanlı backend'i Strapi + PostgreSQL'e migrate ederek:
- ✅ Agent/Skill/MCP Server tanımlarını Strapi admin panelinden yönetilebilir hale getirmek
- ✅ Parametrik ve dinamik yapı oluşturmak
- ✅ SSE streaming ve custom logic'i korumak
- ✅ Scalable bir database altyapısına geçmek

### Yaklaşım
**Hybrid Architecture** - SSE streaming ve custom logic Express'te kalır, sadece data management Strapi'ye taşınır.

---

## Mevcut Mimari

```
┌──────────────────────────────────────┐
│      Frontend (React + Vite)         │
│      Port: 5173 (dev) / 3001 (prod)  │
└──────────────────────────────────────┘
                 │
                 │ HTTP/SSE
                 ▼
┌──────────────────────────────────────┐
│      Express Backend                 │
│      Port: 3001                      │
│                                      │
│  ├─ CRUD API Routes                 │
│  ├─ SSE Streaming Routes            │
│  ├─ Claude SDK Integration          │
│  ├─ MCP Service                     │
│  └─ File System Operations          │
└──────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Better SQLite3 │
        │ (Local File)   │
        └────────────────┘
```

### Mevcut Servisler

| Servis | Dosya | Sorumluluk |
|--------|-------|-----------|
| Claude SDK | `claude-sdk-service.ts` | Agent execution, streaming |
| MCP Service | `mcp-service.ts` | MCP server lifecycle |
| Structure Parser | `claude-structure-parser.ts` | .claude folder parsing |
| Skill Service | `skill-service.ts` | Skill CRUD operations |
| Task Storage | `task-storage-service.ts` | Task persistence |
| File System | `file-system-service.ts` | File operations |
| Conversation Cache | `conversation-cache.ts` | Memory management |

### Mevcut Routes

```typescript
// Manager Routes (CRUD)
GET    /api/manager/agents
POST   /api/manager/agents
GET    /api/manager/agents/:id
PUT    /api/manager/agents/:id
POST   /api/manager/agents/:id/execute  // SSE

GET    /api/manager/skills
POST   /api/manager/skills
GET    /api/manager/skills/:id
PUT    /api/manager/skills/:id

GET    /api/manager/mcp-servers
POST   /api/manager/mcp-servers
PUT    /api/manager/mcp-servers/:id
DELETE /api/manager/mcp-servers/:id
POST   /api/manager/mcp-servers/:id/test
POST   /api/manager/mcp-servers/:id/toggle
```

---

## Hedef Mimari

```
┌──────────────────────────────────────────────────┐
│           Frontend (React)                       │
│           Port: 5173 (dev)                       │
└──────────────────────────────────────────────────┘
           │                          │
           │ CRUD                     │ Execution/Streaming
           ▼                          ▼
┌─────────────────────┐    ┌──────────────────────────┐
│  Strapi API         │    │  Express Custom API      │
│  Port: 1337         │◄───│  Port: 3001              │
│                     │    │                          │
│ ✓ Agent CRUD        │    │ ✓ SSE Streaming          │
│ ✓ Skill CRUD        │    │ ✓ Agent Execution        │
│ ✓ MCP Server CRUD   │    │ ✓ Claude SDK Logic       │
│ ✓ Task CRUD         │    │ ✓ MCP Lifecycle          │
│ ✓ Admin Panel       │    │ ✓ Real-time Events       │
│ ✓ Authentication    │    │ ✓ File Operations        │
│ ✓ Role Management   │    │ ✓ Conversation Cache     │
└─────────────────────┘    └──────────────────────────┘
           │
           ▼
   ┌──────────────┐
   │ PostgreSQL   │
   │ Port: 5432   │
   └──────────────┘
```

### Sorumluluk Dağılımı

#### Strapi (Data Layer)
- ✅ Agent CRUD operations
- ✅ Skill CRUD operations
- ✅ MCP Server CRUD operations
- ✅ Task CRUD operations
- ✅ Admin panel UI
- ✅ User authentication
- ✅ Role-based access control
- ✅ Data validation (Zod schemas)
- ✅ API documentation (auto-generated)

#### Express (Business Logic)
- ✅ Agent execution (SSE streaming)
- ✅ Claude SDK integration
- ✅ MCP server lifecycle management
- ✅ Real-time event handling
- ✅ File system operations
- ✅ Conversation caching
- ✅ Custom business logic

---

## Teknoloji Karşılaştırması

### Database

| Özellik | SQLite (Mevcut) | PostgreSQL (Hedef) |
|---------|-----------------|-------------------|
| Type | File-based | Client-Server |
| Concurrency | Limited | Excellent |
| Scalability | Low | High |
| ACID | Yes | Yes |
| Replication | No | Yes |
| Full-text Search | Basic | Advanced |
| JSON Support | Limited | Native |
| Production Ready | Small apps | Enterprise |

### Backend Framework

| Özellik | Express (Mevcut) | Strapi + Express (Hedef) |
|---------|-----------------|-------------------------|
| CRUD API | Manual | Auto-generated |
| Admin Panel | Custom build | Built-in |
| Authentication | Manual | Built-in |
| Validation | Manual (Zod) | Built-in + Zod |
| API Docs | Manual | Auto-generated |
| Plugin System | Manual | Rich ecosystem |
| Content Types | Code-based | UI-based + Code |
| Custom Logic | Full control | Full control (services/controllers) |

---

## Risk Analizi

### Yüksek Riskler ✅ (Çözüldü)

#### 1. Custom Logic Kaybı
**Risk:** Claude SDK streaming, MCP lifecycle, real-time execution logic'inin kaybı
**Çözüm:** Hybrid architecture ile Express'te koruma
**Durum:** ✅ Risk eliminate edildi

#### 2. SSE/Streaming Desteği
**Risk:** Strapi'nin built-in SSE desteği yok
**Çözüm:** Express'te SSE routes'ları koruma
**Durum:** ✅ Risk eliminate edildi

#### 3. Kompleks Servisler
**Risk:** 100+ satır custom logic'in kaybolması
**Çözüm:** Servisler Express'te kalıyor
**Durum:** ✅ Risk eliminate edildi

### Orta Riskler ⚠️

#### 4. Frontend Uyumluluk
**Risk:** Dual API endpoint yönetimi karmaşıklığı
**Etki:** Orta
**Çözüm:**
- Tek bir API client service oluştur
- Endpoint routing logic'i soyutla
- TypeScript types'ı merkezi yönet

#### 5. Data Migration
**Risk:** SQLite → PostgreSQL veri bütünlüğü
**Etki:** Orta
**Çözüm:**
- Migration script ile otomatik taşıma
- Validation checks
- Rollback planı

#### 6. Authentication Flow
**Risk:** Mevcut auth yoksa yeni auth sistemi entegrasyonu
**Etki:** Düşük-Orta
**Çözüm:**
- Strapi JWT authentication kullan
- Frontend'de token management
- Gerekirse authentication'ı opsiyonel tut (dev mode)

### Düşük Riskler ℹ️

#### 7. Deployment Complexity
**Etki:** Düşük
**Çözüm:** Docker Compose ile birlikte deploy

#### 8. Learning Curve
**Etki:** Düşük
**Çözüm:** Strapi dokümantasyonu oldukça iyi

---

## Migration Stratejisi

### Faz 1: Infrastructure Setup (1-2 gün)

#### 1.1 PostgreSQL Setup
```bash
# Docker ile PostgreSQL
docker run --name claude-postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=claude_agent_ui \
  -p 5432:5432 \
  -d postgres:16
```

#### 1.2 Strapi Project Setup
```bash
# Strapi projesi oluştur
npx create-strapi-app@latest backend \
  --quickstart \
  --no-run \
  --typescript

cd backend

# PostgreSQL connector
npm install pg

# Strapi config
# config/database.ts düzenle
```

### Faz 2: Content Type Definition (1 gün)

#### 2.1 Agent Content Type
```typescript
// backend/src/api/agent/content-types/agent/schema.json
{
  "kind": "collectionType",
  "collectionName": "agents",
  "info": {
    "singularName": "agent",
    "pluralName": "agents",
    "displayName": "Agent",
    "description": "Claude agents with tools and skills"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true,
      "minLength": 1,
      "maxLength": 100
    },
    "description": {
      "type": "text"
    },
    "systemPrompt": {
      "type": "text",
      "required": true
    },
    "tools": {
      "type": "json",
      "default": []
    },
    "disallowedTools": {
      "type": "json",
      "default": []
    },
    "model": {
      "type": "enumeration",
      "enum": ["sonnet", "opus", "haiku", "sonnet-4", "opus-4"],
      "default": "sonnet"
    },
    "enabled": {
      "type": "boolean",
      "default": true
    },
    "mcpServers": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::mcp-server.mcp-server",
      "inversedBy": "agents"
    },
    "skills": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::skill.skill",
      "inversedBy": "agents"
    }
  }
}
```

#### 2.2 Skill Content Type
```typescript
// backend/src/api/skill/content-types/skill/schema.json
{
  "kind": "collectionType",
  "collectionName": "skills",
  "info": {
    "singularName": "skill",
    "pluralName": "skills",
    "displayName": "Skill"
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "description": {
      "type": "text"
    },
    "content": {
      "type": "text",
      "required": true
    },
    "allowedTools": {
      "type": "json",
      "default": []
    },
    "experienceScore": {
      "type": "decimal",
      "default": 0
    },
    "agents": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::agent.agent",
      "mappedBy": "skills"
    }
  }
}
```

#### 2.3 MCP Server Content Type
```typescript
// backend/src/api/mcp-server/content-types/mcp-server/schema.json
{
  "kind": "collectionType",
  "collectionName": "mcp_servers",
  "info": {
    "singularName": "mcp-server",
    "pluralName": "mcp-servers",
    "displayName": "MCP Server"
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "command": {
      "type": "string",
      "required": true
    },
    "args": {
      "type": "json",
      "default": []
    },
    "env": {
      "type": "json",
      "default": {}
    },
    "disabled": {
      "type": "boolean",
      "default": false
    },
    "transport": {
      "type": "enumeration",
      "enum": ["stdio", "sse", "http"],
      "default": "stdio"
    },
    "agents": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::agent.agent",
      "mappedBy": "mcpServers"
    }
  }
}
```

### Faz 3: Express Integration (2-3 gün)

#### 3.1 Strapi Client Service
```typescript
// src/services/strapi-client.ts
import axios, { AxiosInstance } from 'axios';
import { Agent, Skill, MCPServer } from '../types';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export class StrapiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${STRAPI_URL}/api`,
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // ============= AGENTS =============
  async getAllAgents(): Promise<Agent[]> {
    const { data } = await this.client.get('/agents?populate=*');
    return data.data.map(this.transformAgent);
  }

  async getAgent(id: string): Promise<Agent> {
    const { data } = await this.client.get(`/agents/${id}?populate=*`);
    return this.transformAgent(data.data);
  }

  async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    const { data } = await this.client.post('/agents', {
      data: this.prepareAgentData(agentData)
    });
    return this.transformAgent(data.data);
  }

  async updateAgent(id: string, agentData: Partial<Agent>): Promise<Agent> {
    const { data } = await this.client.put(`/agents/${id}`, {
      data: this.prepareAgentData(agentData)
    });
    return this.transformAgent(data.data);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.client.delete(`/agents/${id}`);
  }

  // ============= SKILLS =============
  async getAllSkills(): Promise<Skill[]> {
    const { data } = await this.client.get('/skills?populate=*');
    return data.data.map(this.transformSkill);
  }

  async getSkill(id: string): Promise<Skill> {
    const { data } = await this.client.get(`/skills/${id}?populate=*`);
    return this.transformSkill(data.data);
  }

  // ============= MCP SERVERS =============
  async getAllMCPServers(): Promise<MCPServer[]> {
    const { data } = await this.client.get('/mcp-servers?populate=*');
    return data.data.map(this.transformMCPServer);
  }

  async getMCPServer(id: string): Promise<MCPServer> {
    const { data } = await this.client.get(`/mcp-servers/${id}?populate=*`);
    return this.transformMCPServer(data.data);
  }

  // ============= TRANSFORMERS =============
  private transformAgent(strapiData: any): Agent {
    return {
      id: strapiData.id.toString(),
      name: strapiData.attributes.name,
      description: strapiData.attributes.description,
      systemPrompt: strapiData.attributes.systemPrompt,
      tools: strapiData.attributes.tools || [],
      disallowedTools: strapiData.attributes.disallowedTools || [],
      model: strapiData.attributes.model,
      enabled: strapiData.attributes.enabled,
      mcpServers: strapiData.attributes.mcpServers?.data?.map((s: any) => s.id.toString()) || [],
      skills: strapiData.attributes.skills?.data?.map((s: any) => s.id.toString()) || []
    };
  }

  private transformSkill(strapiData: any): Skill {
    return {
      id: strapiData.id.toString(),
      name: strapiData.attributes.name,
      description: strapiData.attributes.description,
      content: strapiData.attributes.content,
      allowedTools: strapiData.attributes.allowedTools || [],
      experienceScore: strapiData.attributes.experienceScore
    };
  }

  private transformMCPServer(strapiData: any): MCPServer {
    return {
      id: strapiData.id.toString(),
      name: strapiData.attributes.name,
      command: strapiData.attributes.command,
      args: strapiData.attributes.args || [],
      env: strapiData.attributes.env || {},
      disabled: strapiData.attributes.disabled,
      transport: strapiData.attributes.transport
    };
  }

  private prepareAgentData(agent: Partial<Agent>) {
    return {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools,
      disallowedTools: agent.disallowedTools,
      model: agent.model,
      enabled: agent.enabled,
      mcpServers: agent.mcpServers?.map(id => parseInt(id)),
      skills: agent.skills?.map(id => parseInt(id))
    };
  }
}

export const strapiClient = new StrapiClient();
```

#### 3.2 Manager Routes Update
```typescript
// src/routes/manager.routes.ts
import express from 'express';
import { strapiClient } from '../services/strapi-client';

const router = express.Router();

// ============= AGENTS (Proxy to Strapi) =============
router.get('/agents', async (req, res) => {
  try {
    const agents = await strapiClient.getAllAgents();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agents/:id', async (req, res) => {
  try {
    const agent = await strapiClient.getAgent(req.params.id);
    res.json(agent);
  } catch (error) {
    res.status(404).json({ error: 'Agent not found' });
  }
});

router.post('/agents', async (req, res) => {
  try {
    const agent = await strapiClient.createAgent(req.body);
    res.json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/agents/:id', async (req, res) => {
  try {
    const agent = await strapiClient.updateAgent(req.params.id, req.body);
    res.json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= SKILLS (Proxy to Strapi) =============
router.get('/skills', async (req, res) => {
  try {
    const skills = await strapiClient.getAllSkills();
    res.json(skills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ... similar patterns for skills and MCP servers

export default router;
```

#### 3.3 Execution Routes (UNCHANGED!)
```typescript
// src/routes/execution.routes.ts
import express from 'express';
import { strapiClient } from '../services/strapi-client';
import { claudeSDKService } from '../services/claude-sdk-service';

const router = express.Router();

// Agent execution with SSE streaming - AYNI KALIYOR!
router.post('/agent/:id/execute', async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    // Strapi'den agent bilgisini al
    const agent = await strapiClient.getAgent(id);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Mevcut streaming logic - DEĞİŞMEZ!
    await claudeSDKService.executeAgent(agent, message, {
      onStreamStart: () => {
        res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
      },
      onToken: (token: string) => {
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      },
      onToolUse: (tool: any) => {
        res.write(`data: ${JSON.stringify({ type: 'tool_use', tool })}\n\n`);
      },
      onComplete: (result: any) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
      },
      onError: (error: Error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Faz 4: Data Migration (1 gün)

#### 4.1 Migration Script
```typescript
// scripts/migrate-sqlite-to-postgres.ts
import Database from 'better-sqlite3';
import { strapiClient } from '../src/services/strapi-client';

async function migrateData() {
  console.log('Starting migration from SQLite to PostgreSQL via Strapi...');

  // Open SQLite database
  const db = new Database('./data/claude_agent_ui.db', { readonly: true });

  try {
    // Migrate Agents
    console.log('Migrating agents...');
    const agents = db.prepare('SELECT * FROM agents').all();
    for (const agent of agents) {
      await strapiClient.createAgent({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.system_prompt,
        tools: JSON.parse(agent.tools || '[]'),
        disallowedTools: JSON.parse(agent.disallowed_tools || '[]'),
        model: agent.model,
        enabled: agent.enabled === 1
      });
      console.log(`✓ Migrated agent: ${agent.name}`);
    }

    // Migrate Skills
    console.log('Migrating skills...');
    const skills = db.prepare('SELECT * FROM skills').all();
    for (const skill of skills) {
      await strapiClient.createSkill({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        allowedTools: JSON.parse(skill.allowed_tools || '[]'),
        experienceScore: skill.experience_score
      });
      console.log(`✓ Migrated skill: ${skill.name}`);
    }

    // Migrate MCP Servers
    console.log('Migrating MCP servers...');
    const mcpServers = db.prepare('SELECT * FROM mcp_servers').all();
    for (const server of mcpServers) {
      await strapiClient.createMCPServer({
        name: server.name,
        command: server.command,
        args: JSON.parse(server.args || '[]'),
        env: JSON.parse(server.env || '{}'),
        disabled: server.disabled === 1,
        transport: server.transport
      });
      console.log(`✓ Migrated MCP server: ${server.name}`);
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

migrateData();
```

### Faz 5: Frontend Update (1-2 gün)

#### 5.1 API Client Update
```typescript
// src/web/manager/services/api.ts
const STRAPI_API = process.env.VITE_STRAPI_URL || 'http://localhost:1337/api';
const EXPRESS_API = process.env.VITE_EXPRESS_URL || 'http://localhost:3001/api';
const STRAPI_TOKEN = process.env.VITE_STRAPI_TOKEN;

// Helper for Strapi requests
const strapiHeaders = {
  'Content-Type': 'application/json',
  ...(STRAPI_TOKEN && { 'Authorization': `Bearer ${STRAPI_TOKEN}` })
};

export const api = {
  // ============= AGENTS (CRUD -> Strapi) =============
  agents: {
    list: async () => {
      const res = await fetch(`${STRAPI_API}/agents?populate=*`, {
        headers: strapiHeaders
      });
      const data = await res.json();
      return data.data.map(transformAgent);
    },

    get: async (id: string) => {
      const res = await fetch(`${STRAPI_API}/agents/${id}?populate=*`, {
        headers: strapiHeaders
      });
      const data = await res.json();
      return transformAgent(data.data);
    },

    create: async (agentData: any) => {
      const res = await fetch(`${STRAPI_API}/agents`, {
        method: 'POST',
        headers: strapiHeaders,
        body: JSON.stringify({ data: agentData })
      });
      const data = await res.json();
      return transformAgent(data.data);
    },

    update: async (id: string, agentData: any) => {
      const res = await fetch(`${STRAPI_API}/agents/${id}`, {
        method: 'PUT',
        headers: strapiHeaders,
        body: JSON.stringify({ data: agentData })
      });
      const data = await res.json();
      return transformAgent(data.data);
    },

    delete: async (id: string) => {
      await fetch(`${STRAPI_API}/agents/${id}`, {
        method: 'DELETE',
        headers: strapiHeaders
      });
    }
  },

  // ============= EXECUTION (SSE -> Express) =============
  execution: {
    executeAgent: (id: string, message: string) => {
      return fetch(`${EXPRESS_API}/execute/agent/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
    },

    // SSE stream helper
    streamAgentExecution: (id: string, message: string) => {
      const url = `${EXPRESS_API}/execute/agent/${id}`;
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
    }
  }
};

// Transform Strapi response to app format
function transformAgent(strapiData: any) {
  return {
    id: strapiData.id.toString(),
    name: strapiData.attributes.name,
    description: strapiData.attributes.description,
    systemPrompt: strapiData.attributes.systemPrompt,
    tools: strapiData.attributes.tools || [],
    disallowedTools: strapiData.attributes.disallowedTools || [],
    model: strapiData.attributes.model,
    enabled: strapiData.attributes.enabled,
    mcpServers: strapiData.attributes.mcpServers?.data || [],
    skills: strapiData.attributes.skills?.data || []
  };
}
```

---

## Implementation Plan

### Phase 1: Setup & Infrastructure (2 gün)

#### Görevler
- [ ] PostgreSQL Docker container setup
- [ ] Strapi project initialization
- [ ] Database connection configuration
- [ ] Environment variables setup
- [ ] Strapi admin user creation

#### Deliverables
- ✅ Running PostgreSQL instance
- ✅ Running Strapi instance
- ✅ Database connection verified
- ✅ .env configuration complete

---

### Phase 2: Content Types & Models (1 gün)

#### Görevler
- [ ] Agent content type definition
- [ ] Skill content type definition
- [ ] MCP Server content type definition
- [ ] Task content type definition
- [ ] Relations configuration
- [ ] Validation rules

#### Deliverables
- ✅ All content types created
- ✅ Relations working
- ✅ Strapi admin panel accessible
- ✅ Manual CRUD testing successful

---

### Phase 3: Express Integration (2 gün)

#### Görevler
- [ ] Strapi client service implementation
- [ ] Manager routes refactoring (CRUD proxy)
- [ ] Execution routes preservation (SSE)
- [ ] Error handling
- [ ] Logging integration

#### Deliverables
- ✅ Express-Strapi communication working
- ✅ CRUD operations functional
- ✅ SSE streaming intact
- ✅ All tests passing

---

### Phase 4: Data Migration (1 gün)

#### Görevler
- [ ] Migration script development
- [ ] SQLite data extraction
- [ ] Data transformation
- [ ] PostgreSQL insertion via Strapi
- [ ] Validation checks

#### Deliverables
- ✅ All agents migrated
- ✅ All skills migrated
- ✅ All MCP servers migrated
- ✅ Data integrity verified

---

### Phase 5: Frontend Updates (2 gün)

#### Görevler
- [ ] API client refactoring (dual endpoints)
- [ ] Environment variables update
- [ ] Components update (if needed)
- [ ] Error handling
- [ ] Testing

#### Deliverables
- ✅ Frontend communicating with both APIs
- ✅ CRUD operations working
- ✅ Agent execution working
- ✅ UI functional

---

### Phase 6: Testing & Validation (1 gün)

#### Görevler
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Security testing
- [ ] Edge cases testing
- [ ] Documentation

#### Deliverables
- ✅ All features tested
- ✅ Performance acceptable
- ✅ Security verified
- ✅ Documentation updated

---

## Kod Örnekleri

### Strapi Admin Panel Customization

```typescript
// backend/src/admin/app.tsx
export default {
  config: {
    locales: ['en', 'tr'],
    theme: {
      colors: {
        primary100: '#f0f0ff',
        primary200: '#d9d9ff',
        primary500: '#7b79ff',
        primary600: '#5e5ce6',
        primary700: '#4c4ad8',
      },
    },
    translations: {
      tr: {
        'app.components.LeftMenu.navbrand.title': 'Claude Agent UI',
        'app.components.LeftMenu.navbrand.workplace': 'Admin Panel',
      },
    },
  },
  bootstrap() {},
};
```

### Custom Strapi Controller

```typescript
// backend/src/api/agent/controllers/agent.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::agent.agent', ({ strapi }) => ({
  // Override default find to add custom logic
  async find(ctx) {
    const { query } = ctx;

    // Add custom filtering
    const agents = await strapi.entityService.findMany('api::agent.agent', {
      ...query,
      populate: ['skills', 'mcpServers'],
      filters: {
        enabled: true, // Only return enabled agents by default
        ...query.filters,
      },
    });

    return agents;
  },

  // Custom action: Test agent configuration
  async test(ctx) {
    const { id } = ctx.params;

    const agent = await strapi.entityService.findOne('api::agent.agent', id, {
      populate: ['skills', 'mcpServers'],
    });

    if (!agent) {
      return ctx.notFound('Agent not found');
    }

    // Custom test logic
    const testResult = {
      valid: true,
      errors: [],
    };

    // Validate system prompt
    if (!agent.systemPrompt || agent.systemPrompt.length < 10) {
      testResult.valid = false;
      testResult.errors.push('System prompt too short');
    }

    // Validate tools
    if (!agent.tools || agent.tools.length === 0) {
      testResult.valid = false;
      testResult.errors.push('No tools configured');
    }

    return testResult;
  },
}));
```

### Custom Strapi Route

```typescript
// backend/src/api/agent/routes/custom-agent.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/agents/:id/test',
      handler: 'agent.test',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
```

### Environment Configuration

```env
# .env.strapi (Backend - Strapi)
NODE_ENV=development
HOST=0.0.0.0
PORT=1337

# Database
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=claude_agent_ui
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_SSL=false

# Secrets
APP_KEYS=key1,key2,key3,key4
API_TOKEN_SALT=random_salt
ADMIN_JWT_SECRET=admin_secret
TRANSFER_TOKEN_SALT=transfer_salt
JWT_SECRET=jwt_secret

# CORS
STRAPI_CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

```env
# .env.express (Backend - Express)
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Strapi connection
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your_strapi_api_token

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key

# Logging
LOG_LEVEL=info
```

```env
# .env (Frontend)
VITE_STRAPI_URL=http://localhost:1337/api
VITE_EXPRESS_URL=http://localhost:3001/api
VITE_STRAPI_TOKEN=your_strapi_token (optional for public access)
```

---

## Timeline & Effort Estimation

### Detaylı Zaman Planı

| Faz | Görev | Süre | Bağımlılık |
|-----|-------|------|-----------|
| **1** | PostgreSQL Setup | 0.5 gün | - |
| **1** | Strapi Setup | 0.5 gün | PostgreSQL |
| **1** | Environment Config | 0.5 gün | Strapi |
| **1** | Admin User Creation | 0.5 gün | Strapi |
| **2** | Content Types Definition | 1 gün | Strapi |
| **3** | Strapi Client Service | 1 gün | Content Types |
| **3** | Manager Routes Refactor | 0.5 gün | Strapi Client |
| **3** | Testing CRUD | 0.5 gün | Manager Routes |
| **4** | Migration Script | 0.5 gün | Strapi Client |
| **4** | Data Migration | 0.25 gün | Migration Script |
| **4** | Validation | 0.25 gün | Data Migration |
| **5** | Frontend API Client | 1 gün | Manager Routes |
| **5** | Component Updates | 0.5 gün | API Client |
| **5** | Testing | 0.5 gün | Components |
| **6** | E2E Testing | 0.5 gün | Frontend |
| **6** | Documentation | 0.5 gün | - |

**Toplam: 8-10 iş günü (1.5-2 hafta)**

### Milestone Tablosu

| Milestone | Tarih | Deliverable |
|-----------|-------|-------------|
| M1: Infrastructure Ready | Gün 2 | PostgreSQL + Strapi running |
| M2: Content Types Complete | Gün 3 | All models defined |
| M3: Backend Integration | Gün 5 | Express-Strapi communication |
| M4: Data Migrated | Gün 6 | All data in PostgreSQL |
| M5: Frontend Updated | Gün 8 | UI fully functional |
| M6: Production Ready | Gün 10 | Tested and documented |

---

## Rollback Planı

### Acil Durum Senaryoları

#### Senaryo 1: Strapi Entegrasyonu Başarısız
**Trigger:** Strapi API'si beklendiği gibi çalışmıyor
**Action:**
1. Express'i eski SQLite versiyonuna geri döndür
2. Frontend'i eski API endpoint'lere yönlendir
3. Git revert kullan

**Recovery Time:** 1-2 saat

#### Senaryo 2: Data Migration Hatası
**Trigger:** Veri kaybı veya bozulması
**Action:**
1. PostgreSQL database drop
2. SQLite backup'tan geri yükle
3. Migration script düzelt
4. Tekrar dene

**Recovery Time:** 2-4 saat

#### Senaryo 3: Performance Problemi
**Trigger:** Yeni sistem yavaş çalışıyor
**Action:**
1. PostgreSQL index'leme
2. Strapi caching etkinleştir
3. Query optimization
4. Gerekirse eski sisteme dön

**Recovery Time:** 4-8 saat

### Backup Stratejisi

```bash
# SQLite backup (migration öncesi)
cp ./data/claude_agent_ui.db ./data/backups/claude_agent_ui_$(date +%Y%m%d_%H%M%S).db

# PostgreSQL backup (migration sonrası)
pg_dump -U postgres claude_agent_ui > backups/postgres_$(date +%Y%m%d_%H%M%S).sql

# Code backup (Git tag)
git tag -a v1.0.0-pre-migration -m "Before Strapi migration"
git push origin v1.0.0-pre-migration
```

---

## Strapi Admin Panel Özellikleri

### Otomatik Oluşacak Özellikler

#### 1. Agent Management UI
```
http://localhost:1337/admin/content-manager/collectionType/api::agent.agent

Features:
- ✅ List view (filterable, sortable, searchable)
- ✅ Create form with validation
- ✅ Edit form
- ✅ Bulk delete
- ✅ Bulk publish/unpublish
- ✅ Relation selector (skills, MCP servers)
- ✅ JSON editor for tools
- ✅ Rich text editor for system prompt
```

#### 2. Skill Management UI
```
http://localhost:1337/admin/content-manager/collectionType/api::skill.skill

Features:
- ✅ Code editor for skill content
- ✅ Experience score tracking
- ✅ Tool allowlist management
- ✅ Agent usage tracking
```

#### 3. MCP Server Management UI
```
http://localhost:1337/admin/content-manager/collectionType/api::mcp-server.mcp-server

Features:
- ✅ Command & args configuration
- ✅ Environment variables editor
- ✅ Enable/disable toggle
- ✅ Transport type selector
```

#### 4. User & Role Management
```
Features:
- ✅ User creation/management
- ✅ Role-based access control
- ✅ API token generation
- ✅ Permission granularity per content type
```

---

## Güvenlik Considerations

### API Security

```typescript
// Strapi API token authentication
// backend/config/plugins.ts
export default {
  'users-permissions': {
    config: {
      jwtSecret: process.env.JWT_SECRET,
    },
  },
};
```

### CORS Configuration

```typescript
// backend/config/middlewares.ts
export default [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://localhost:5173', 'http://localhost:3001'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

---

## Performance Optimization

### PostgreSQL Indexing

```sql
-- backend/database/indexes.sql

-- Agent indexes
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_enabled ON agents(enabled);

-- Skill indexes
CREATE INDEX idx_skills_name ON skills(name);

-- MCP Server indexes
CREATE INDEX idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX idx_mcp_servers_disabled ON mcp_servers(disabled);

-- Relation indexes
CREATE INDEX idx_agents_skills_agent_id ON agents_skills_links(agent_id);
CREATE INDEX idx_agents_skills_skill_id ON agents_skills_links(skill_id);
CREATE INDEX idx_agents_mcps_agent_id ON agents_mcp_servers_links(agent_id);
CREATE INDEX idx_agents_mcps_mcp_id ON agents_mcp_servers_links(mcp_server_id);
```

### Strapi Caching

```typescript
// backend/config/plugins.ts
export default {
  'rest-cache': {
    enabled: true,
    config: {
      provider: {
        name: 'memory',
        options: {
          max: 100,
          maxAge: 3600000, // 1 hour
        },
      },
      strategy: {
        contentTypes: [
          {
            contentType: 'api::agent.agent',
            maxAge: 3600000,
            headers: ['accept', 'content-type'],
          },
          {
            contentType: 'api::skill.skill',
            maxAge: 3600000,
          },
        ],
      },
    },
  },
};
```

---

## Monitoring & Logging

### Strapi Logging

```typescript
// backend/config/logger.ts
import pino from 'pino';

export default {
  transports: {
    console: {
      level: 'info',
      format: 'pretty',
    },
    file: {
      level: 'info',
      path: './logs/strapi.log',
      options: {
        maxSize: '10m',
        maxFiles: 5,
      },
    },
  },
};
```

### PostgreSQL Monitoring

```sql
-- Query performance monitoring
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Connection monitoring
SELECT
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

---

## Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: claude-postgres
    environment:
      POSTGRES_DB: claude_agent_ui
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  strapi:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: claude-strapi
    environment:
      DATABASE_CLIENT: postgres
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: claude_agent_ui
      DATABASE_USERNAME: postgres
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_JWT_SECRET: ${ADMIN_JWT_SECRET}
      APP_KEYS: ${APP_KEYS}
      API_TOKEN_SALT: ${API_TOKEN_SALT}
    ports:
      - "1337:1337"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend/config:/opt/app/config
      - ./backend/src:/opt/app/src
      - ./backend/public:/opt/app/public

  express:
    build:
      context: .
      dockerfile: Dockerfile.express
    container_name: claude-express
    environment:
      NODE_ENV: production
      PORT: 3001
      STRAPI_URL: http://strapi:1337
      STRAPI_API_TOKEN: ${STRAPI_API_TOKEN}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3001:3001"
    depends_on:
      - strapi
    volumes:
      - ./dist:/app/dist

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: claude-frontend
    environment:
      VITE_STRAPI_URL: http://localhost:1337/api
      VITE_EXPRESS_URL: http://localhost:3001/api
    ports:
      - "80:80"
    depends_on:
      - strapi
      - express

volumes:
  postgres_data:
```

---

## Sonuç

### Özet

Bu migration planı, mevcut Express + SQLite sistemini Strapi + PostgreSQL'e **minimum risk** ve **maksimum fayda** ile geçirmeyi hedefliyor.

### Avantajlar
- ✅ **Parametrik yapı:** Agent/skill yönetimi Strapi admin panel'den
- ✅ **Scalability:** PostgreSQL ile enterprise-grade database
- ✅ **Korunan logic:** SSE streaming ve custom logic Express'te kalıyor
- ✅ **Hızlı development:** Auto-generated API, admin panel
- ✅ **Güvenli migration:** Hybrid architecture ile risk minimize

### Tavsiyeler
1. **Phased approach:** Fazlara ayırarak ilerle, her fazı test et
2. **Backup first:** Migration öncesi her şeyi yedekle
3. **Parallel testing:** Eski ve yeni sistemi paralel çalıştır
4. **Gradual rollout:** Production'da kademeli geçiş yap
5. **Monitor closely:** İlk günlerde yakından izle

### Next Steps
1. PostgreSQL + Strapi setup
2. Content types oluştur
3. Strapi client implement et
4. Data migrate et
5. Frontend güncelle
6. Test et
7. Deploy et

---

**Hazırlayan:** Claude Agent
**Versiyon:** 1.0
**Son Güncelleme:** 2025-10-31
