# Claude Agent UI - Strapi 5 Implementation Analysis

**Project:** Claude Agent UI
**Target:** Strapi 5 + PostgreSQL + TypeScript
**Architecture:** Hybrid (Strapi for data, Express for execution)
**Date:** 2025-10-31
**Based on:** Strapi 5 (Latest - Document-based Architecture)

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Strapi 5 Key Features](#strapi-5-key-features)
3. [Enhanced Content Type Schemas](#enhanced-content-type-schemas)
4. [Document Service API Implementation](#document-service-api-implementation)
5. [Custom Controllers & Services](#custom-controllers--services)
6. [Lifecycle Hooks Strategy](#lifecycle-hooks-strategy)
7. [Validation & Business Rules](#validation--business-rules)
8. [PostgreSQL Configuration](#postgresql-configuration)
9. [TypeScript Integration](#typescript-integration)
10. [Security Configuration](#security-configuration)
11. [Performance Optimizations](#performance-optimizations)
12. [Testing Strategy](#testing-strategy)
13. [Admin Panel Customization](#admin-panel-customization)
14. [Migration Script Details](#migration-script-details)
15. [Deployment Configuration](#deployment-configuration)

---

## Executive Summary

### Why Strapi 5?

Strapi 5 brings significant improvements over traditional Express+SQLite setups:

#### Key Benefits

| Feature | Traditional Express | Strapi 5 | Impact |
|---------|-------------------|----------|--------|
| **Admin Panel** | Manual build required | Auto-generated, customizable | Save 40+ hours |
| **API Generation** | Manual routes/controllers | Auto-generated REST/GraphQL | Save 20+ hours |
| **Content Management** | Code-based | UI-based + Code | 10x faster updates |
| **Type Safety** | Manual TypeScript | Auto-generated types | Fewer bugs |
| **Documentation** | Manual | Auto-generated | Always up-to-date |
| **Authentication** | Custom implementation | Built-in JWT + RBAC | Production-ready |
| **Database Migrations** | Manual scripts | Auto-generated | Error-free |
| **Validation** | Manual (Zod) | Built-in + Custom | Centralized |

#### Preserved Strengths (Hybrid Architecture)

✅ **SSE Streaming** - Remains in Express
✅ **Claude SDK Integration** - Remains in Express
✅ **MCP Lifecycle Management** - Remains in Express
✅ **Custom Business Logic** - Remains in Express
✅ **File System Operations** - Remains in Express

---

## Strapi 5 Key Features

### 1. Document-Based Architecture

Strapi 5 introduces a **document-centric** model where each content entry has a unique `documentId`.

#### Traditional vs Strapi 5

```typescript
// Traditional: Entry ID changes with locales/versions
GET /api/agents/1  // English version
GET /api/agents/2  // Turkish version (different ID!)

// Strapi 5: Single documentId across all versions
GET /api/agents/abc123xyz?locale=en
GET /api/agents/abc123xyz?locale=tr
GET /api/agents/abc123xyz?status=draft
GET /api/agents/abc123xyz?status=published
```

#### Benefits

- ✅ Persistent identifiers across locales and versions
- ✅ Simplified frontend logic
- ✅ Better caching strategies
- ✅ Cleaner API contracts

### 2. Auto-Generated REST API

Strapi automatically generates CRUD endpoints for all content types:

```typescript
// Agent content type automatically provides:
GET     /api/agents                  // List all
GET     /api/agents/:documentId      // Get one
POST    /api/agents                  // Create
PUT     /api/agents/:documentId      // Update
DELETE  /api/agents/:documentId      // Delete

// With powerful query options:
GET /api/agents?filters[name][$eq]=MyAgent
GET /api/agents?populate=skills,mcpServers
GET /api/agents?sort=createdAt:desc
GET /api/agents?pagination[page]=1&pagination[pageSize]=25
```

### 3. Document Service API

Backend code uses the Document Service for database operations:

```typescript
// Old way (manual SQL/ORM)
const agent = await db.query('SELECT * FROM agents WHERE id = ?', [id]);

// Strapi 5 way (Document Service)
const agent = await strapi.documents('api::agent.agent').findOne({
  documentId: 'abc123xyz',
  populate: ['skills', 'mcpServers']
});
```

### 4. Built-in TypeScript Support

Strapi 5 generates TypeScript types automatically:

```typescript
// Auto-generated from content types
import type { Agent, Skill, MCPServer } from './types/generated';

const agent: Agent = await strapi.documents('api::agent.agent').findOne({
  documentId: 'abc123xyz'
});

// Type-safe access
agent.name;          // ✅ string
agent.systemPrompt;  // ✅ string
agent.tools;         // ✅ string[]
agent.invalid;       // ❌ TypeScript error
```

### 5. Draft & Publish Workflow

Optional feature for content approval workflow:

```typescript
// Create draft
const agent = await strapi.documents('api::agent.agent').create({
  data: { name: 'Test Agent', systemPrompt: '...' }
}); // Created as draft

// Publish when ready
await strapi.documents('api::agent.agent').publish({
  documentId: agent.documentId
});

// Query only published content
const publishedAgents = await strapi.documents('api::agent.agent').findMany({
  status: 'published'
});
```

**For Claude Agent UI:** We'll **disable** Draft & Publish since agents should be immediately available.

---

## Enhanced Content Type Schemas

The migration_analysis.md schemas are good, but we can improve them with Strapi 5 best practices.

### 1. Agent Content Type (Enhanced)

**Location:** `backend/src/api/agent/content-types/agent/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "agents",
  "info": {
    "singularName": "agent",
    "pluralName": "agents",
    "displayName": "Agent",
    "description": "Claude AI agents with tools, skills, and MCP servers"
  },
  "options": {
    "draftAndPublish": false,
    "comment": "Agents are immediately active"
  },
  "pluginOptions": {
    "i18n": {
      "localized": false
    }
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true,
      "minLength": 1,
      "maxLength": 100,
      "regex": "^[a-zA-Z0-9-_\\s]+$"
    },
    "description": {
      "type": "text",
      "maxLength": 500
    },
    "systemPrompt": {
      "type": "text",
      "required": true,
      "minLength": 10,
      "maxLength": 50000
    },
    "tools": {
      "type": "json",
      "default": [],
      "required": true
    },
    "disallowedTools": {
      "type": "json",
      "default": []
    },
    "model": {
      "type": "enumeration",
      "enum": ["haiku", "sonnet", "sonnet-4", "opus", "opus-4"],
      "default": "sonnet",
      "required": true
    },
    "enabled": {
      "type": "boolean",
      "default": true,
      "required": true
    },
    "metadata": {
      "type": "json",
      "default": {}
    },
    "executionCount": {
      "type": "integer",
      "default": 0,
      "min": 0
    },
    "lastExecutedAt": {
      "type": "datetime"
    },
    "averageExecutionTime": {
      "type": "decimal",
      "default": 0
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
    },
    "tasks": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::task.task",
      "mappedBy": "agent"
    }
  }
}
```

#### Improvements Over Original

1. **Validation Rules**: Added regex, minLength, maxLength
2. **Metadata Field**: Generic JSON for future extensibility
3. **Analytics Fields**: executionCount, lastExecutedAt, averageExecutionTime
4. **Tasks Relation**: Link to execution history
5. **Plugin Options**: Explicit i18n disable

### 2. Skill Content Type (Enhanced)

**Location:** `backend/src/api/skill/content-types/skill/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "skills",
  "info": {
    "singularName": "skill",
    "pluralName": "skills",
    "displayName": "Skill",
    "description": "Reusable agent capabilities"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true,
      "minLength": 1,
      "maxLength": 100,
      "regex": "^[a-z0-9-]+$"
    },
    "displayName": {
      "type": "string",
      "required": true,
      "maxLength": 200
    },
    "description": {
      "type": "text",
      "required": true,
      "minLength": 10,
      "maxLength": 1024
    },
    "content": {
      "type": "text",
      "required": true,
      "minLength": 50
    },
    "allowedTools": {
      "type": "json",
      "default": []
    },
    "experienceScore": {
      "type": "decimal",
      "default": 0,
      "min": 0,
      "max": 100
    },
    "category": {
      "type": "enumeration",
      "enum": [
        "general-purpose",
        "code-analysis",
        "data-processing",
        "web-scraping",
        "file-manipulation",
        "api-integration",
        "custom"
      ],
      "default": "custom"
    },
    "isPublic": {
      "type": "boolean",
      "default": true
    },
    "version": {
      "type": "string",
      "default": "1.0.0",
      "regex": "^\\d+\\.\\d+\\.\\d+$"
    },
    "usageCount": {
      "type": "integer",
      "default": 0,
      "min": 0
    },
    "lastUsedAt": {
      "type": "datetime"
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

#### Improvements

1. **Display Name**: Separate from technical name
2. **Category Enum**: Organized skill taxonomy
3. **Version Field**: Semantic versioning support
4. **Public/Private**: Control skill visibility
5. **Usage Analytics**: Track skill popularity

### 3. MCP Server Content Type (Enhanced)

**Location:** `backend/src/api/mcp-server/content-types/mcp-server/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "mcp_servers",
  "info": {
    "singularName": "mcp-server",
    "pluralName": "mcp-servers",
    "displayName": "MCP Server",
    "description": "Model Context Protocol servers"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true,
      "minLength": 1,
      "maxLength": 100
    },
    "description": {
      "type": "text",
      "maxLength": 500
    },
    "command": {
      "type": "string",
      "required": true,
      "minLength": 1
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
      "default": "stdio",
      "required": true
    },
    "healthCheckUrl": {
      "type": "string",
      "regex": "^https?://"
    },
    "isHealthy": {
      "type": "boolean",
      "default": true
    },
    "lastHealthCheck": {
      "type": "datetime"
    },
    "startupTimeout": {
      "type": "integer",
      "default": 30000,
      "min": 1000,
      "max": 300000
    },
    "restartPolicy": {
      "type": "enumeration",
      "enum": ["always", "on-failure", "never"],
      "default": "on-failure"
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

#### Improvements

1. **Health Monitoring**: healthCheckUrl, isHealthy, lastHealthCheck
2. **Lifecycle Control**: startupTimeout, restartPolicy
3. **Description Field**: Better documentation
4. **Validation**: Regex for URLs, min/max constraints

### 4. Task Content Type (NEW)

**Location:** `backend/src/api/task/content-types/task/schema.json`

```json
{
  "kind": "collectionType",
  "collectionName": "tasks",
  "info": {
    "singularName": "task",
    "pluralName": "tasks",
    "displayName": "Task",
    "description": "Agent execution tasks and history"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "agent": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::agent.agent",
      "inversedBy": "tasks"
    },
    "message": {
      "type": "text",
      "required": true
    },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "running", "completed", "failed", "cancelled"],
      "default": "pending",
      "required": true
    },
    "result": {
      "type": "json"
    },
    "error": {
      "type": "text"
    },
    "startedAt": {
      "type": "datetime"
    },
    "completedAt": {
      "type": "datetime"
    },
    "executionTime": {
      "type": "integer",
      "min": 0
    },
    "tokensUsed": {
      "type": "integer",
      "default": 0,
      "min": 0
    },
    "cost": {
      "type": "decimal",
      "default": 0,
      "min": 0
    },
    "metadata": {
      "type": "json",
      "default": {}
    }
  }
}
```

#### Purpose

- Track all agent executions
- Performance analytics
- Cost tracking
- Debugging history

---

## Document Service API Implementation

### Core CRUD Operations

**Location:** `backend/src/api/agent/services/agent.ts`

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::agent.agent', ({ strapi }) => ({
  /**
   * Find agent by documentId with relations
   */
  async findOneWithRelations(documentId: string) {
    return await strapi.documents('api::agent.agent').findOne({
      documentId,
      populate: {
        skills: {
          fields: ['name', 'description', 'category']
        },
        mcpServers: {
          fields: ['name', 'transport', 'disabled']
        },
        tasks: {
          sort: 'createdAt:desc',
          limit: 10,
          fields: ['status', 'executionTime', 'createdAt']
        }
      }
    });
  },

  /**
   * Find enabled agents only
   */
  async findEnabled() {
    return await strapi.documents('api::agent.agent').findMany({
      filters: {
        enabled: true
      },
      populate: ['skills', 'mcpServers']
    });
  },

  /**
   * Update execution statistics
   */
  async updateExecutionStats(documentId: string, executionTime: number) {
    const agent = await this.findOneWithRelations(documentId);

    const newExecutionCount = (agent.executionCount || 0) + 1;
    const newAverageTime =
      ((agent.averageExecutionTime || 0) * (agent.executionCount || 0) + executionTime) /
      newExecutionCount;

    return await strapi.documents('api::agent.agent').update({
      documentId,
      data: {
        executionCount: newExecutionCount,
        lastExecutedAt: new Date(),
        averageExecutionTime: newAverageTime
      }
    });
  },

  /**
   * Validate agent configuration
   */
  async validateConfiguration(documentId: string): Promise<{valid: boolean, errors: string[]}> {
    const agent = await this.findOneWithRelations(documentId);
    const errors: string[] = [];

    if (!agent.systemPrompt || agent.systemPrompt.length < 10) {
      errors.push('System prompt must be at least 10 characters');
    }

    if (!agent.tools || agent.tools.length === 0) {
      errors.push('At least one tool must be configured');
    }

    if (agent.mcpServers && agent.mcpServers.length > 0) {
      const disabledServers = agent.mcpServers.filter((s: any) => s.disabled);
      if (disabledServers.length > 0) {
        errors.push(`Warning: ${disabledServers.length} MCP server(s) are disabled`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}));
```

### Advanced Queries

```typescript
// Complex filtering
const agents = await strapi.documents('api::agent.agent').findMany({
  filters: {
    $and: [
      { enabled: true },
      { model: { $in: ['sonnet', 'sonnet-4'] } },
      { executionCount: { $gte: 10 } }
    ]
  },
  sort: 'averageExecutionTime:asc',
  pagination: {
    page: 1,
    pageSize: 25
  },
  populate: ['skills', 'mcpServers']
});

// Aggregation (count)
const enabledCount = await strapi.documents('api::agent.agent').count({
  filters: { enabled: true }
});

// Bulk operations
const bulkResults = await Promise.all(
  documentIds.map(id =>
    strapi.documents('api::agent.agent').update({
      documentId: id,
      data: { enabled: false }
    })
  )
);
```

---

## Custom Controllers & Services

### Agent Controller (Enhanced)

**Location:** `backend/src/api/agent/controllers/agent.ts`

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::agent.agent', ({ strapi }) => ({
  /**
   * Override default find to add custom logic
   */
  async find(ctx) {
    // Add custom authorization logic here
    const { query } = ctx;

    const agents = await strapi.service('api::agent.agent').find({
      ...query,
      filters: {
        ...query.filters,
        // Only show enabled agents by default unless explicitly requested
        enabled: query.filters?.enabled !== undefined ? query.filters.enabled : true
      },
      populate: {
        skills: true,
        mcpServers: {
          filters: { disabled: false } // Only non-disabled MCP servers
        }
      }
    });

    return agents;
  },

  /**
   * Custom action: Test agent configuration
   */
  async test(ctx) {
    const { documentId } = ctx.params;

    try {
      const validation = await strapi
        .service('api::agent.agent')
        .validateConfiguration(documentId);

      return {
        valid: validation.valid,
        errors: validation.errors,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      ctx.throw(400, error.message);
    }
  },

  /**
   * Custom action: Clone agent
   */
  async clone(ctx) {
    const { documentId } = ctx.params;

    try {
      const original = await strapi
        .service('api::agent.agent')
        .findOneWithRelations(documentId);

      if (!original) {
        return ctx.notFound('Agent not found');
      }

      const cloned = await strapi.documents('api::agent.agent').create({
        data: {
          name: `${original.name} (Copy)`,
          description: original.description,
          systemPrompt: original.systemPrompt,
          tools: original.tools,
          disallowedTools: original.disallowedTools,
          model: original.model,
          enabled: false, // Clones start disabled
          skills: original.skills.map((s: any) => s.documentId),
          mcpServers: original.mcpServers.map((m: any) => m.documentId)
        }
      });

      return { data: cloned };
    } catch (error) {
      ctx.throw(500, `Failed to clone agent: ${error.message}`);
    }
  },

  /**
   * Custom action: Get execution statistics
   */
  async stats(ctx) {
    const { documentId } = ctx.params;

    try {
      const agent = await strapi
        .service('api::agent.agent')
        .findOneWithRelations(documentId);

      if (!agent) {
        return ctx.notFound('Agent not found');
      }

      const tasks = await strapi.documents('api::task.task').findMany({
        filters: {
          agent: { documentId }
        },
        sort: 'createdAt:desc',
        pagination: { limit: 100 }
      });

      const stats = {
        totalExecutions: agent.executionCount || 0,
        lastExecuted: agent.lastExecutedAt,
        averageExecutionTime: agent.averageExecutionTime || 0,
        recentTasks: {
          completed: tasks.filter((t: any) => t.status === 'completed').length,
          failed: tasks.filter((t: any) => t.status === 'failed').length,
          running: tasks.filter((t: any) => t.status === 'running').length
        },
        totalTokensUsed: tasks.reduce((sum: number, t: any) => sum + (t.tokensUsed || 0), 0),
        totalCost: tasks.reduce((sum: number, t: any) => sum + (parseFloat(t.cost) || 0), 0)
      };

      return { data: stats };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  }
}));
```

### Custom Routes

**Location:** `backend/src/api/agent/routes/custom-agent.ts`

```typescript
export default {
  routes: [
    {
      method: 'POST',
      path: '/agents/:documentId/test',
      handler: 'agent.test',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/agents/:documentId/clone',
      handler: 'agent.clone',
      config: {
        policies: []
      }
    },
    {
      method: 'GET',
      path: '/agents/:documentId/stats',
      handler: 'agent.stats',
      config: {
        policies: []
      }
    }
  ]
};
```

---

## Lifecycle Hooks Strategy

**Location:** `backend/src/index.ts`

```typescript
export default {
  /**
   * Called before Strapi initialization
   * Use for: Loading env vars, extending plugins
   */
  register({ strapi }) {
    // Register custom field types if needed
    strapi.customFields.register({
      name: 'agent-model-selector',
      plugin: 'claude-agent-ui',
      type: 'string'
    });
  },

  /**
   * Called after Strapi fully loaded
   * Use for: Data seeding, RBAC setup, external service initialization
   */
  async bootstrap({ strapi }) {
    console.log('🚀 Strapi bootstrap started');

    // 1. Create default admin user if doesn't exist
    const admins = await strapi.documents('admin::user').findMany({});
    if (admins.length === 0) {
      console.log('Creating default admin user...');
      // Admin creation logic here
    }

    // 2. Seed default skills if database is empty
    const skillCount = await strapi.documents('api::skill.skill').count();
    if (skillCount === 0) {
      console.log('Seeding default skills...');
      await seedDefaultSkills(strapi);
    }

    // 3. Initialize MCP server health checks
    const mcpService = strapi.service('api::mcp-server.mcp-server');
    if (mcpService && typeof mcpService.startHealthMonitoring === 'function') {
      await mcpService.startHealthMonitoring();
      console.log('MCP health monitoring started');
    }

    // 4. Clean up old tasks (older than 30 days)
    await cleanupOldTasks(strapi);

    console.log('✅ Strapi bootstrap completed');
  },

  /**
   * Called before Strapi shutdown
   * Use for: Cleanup, closing connections
   */
  async destroy({ strapi }) {
    console.log('🛑 Strapi shutdown started');

    // Stop MCP server health checks
    const mcpService = strapi.service('api::mcp-server.mcp-server');
    if (mcpService && typeof mcpService.stopHealthMonitoring === 'function') {
      await mcpService.stopHealthMonitoring();
    }

    console.log('✅ Strapi shutdown completed');
  }
};

/**
 * Seed default skills
 */
async function seedDefaultSkills(strapi: any) {
  const defaultSkills = [
    {
      name: 'code-analysis',
      displayName: 'Code Analysis',
      description: 'Analyze code structure, identify patterns, and suggest improvements',
      content: '# Code Analysis Skill\n\nAnalyze code for patterns, bugs, and improvements...',
      category: 'code-analysis',
      allowedTools: ['Read', 'Glob', 'Grep'],
      isPublic: true
    },
    {
      name: 'data-processing',
      displayName: 'Data Processing',
      description: 'Process and transform data files',
      content: '# Data Processing Skill\n\nHandle CSV, JSON, XML data processing...',
      category: 'data-processing',
      allowedTools: ['Read', 'Write', 'Bash'],
      isPublic: true
    }
  ];

  for (const skill of defaultSkills) {
    await strapi.documents('api::skill.skill').create({ data: skill });
    console.log(`  ✓ Created skill: ${skill.name}`);
  }
}

/**
 * Clean up old tasks
 */
async function cleanupOldTasks(strapi: any) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldTasks = await strapi.documents('api::task.task').findMany({
    filters: {
      createdAt: { $lt: thirtyDaysAgo.toISOString() },
      status: { $in: ['completed', 'failed', 'cancelled'] }
    }
  });

  for (const task of oldTasks) {
    await strapi.documents('api::task.task').delete({
      documentId: task.documentId
    });
  }

  console.log(`🗑️  Cleaned up ${oldTasks.length} old tasks`);
}
```

---

## Validation & Business Rules

### Content Type Lifecycle Hooks

**Location:** `backend/src/api/agent/content-types/agent/lifecycles.ts`

```typescript
export default {
  /**
   * Before creating agent
   */
  async beforeCreate(event) {
    const { data } = event.params;

    // Validate system prompt length
    if (data.systemPrompt && data.systemPrompt.length < 10) {
      throw new Error('System prompt must be at least 10 characters');
    }

    // Ensure tools array is not empty
    if (!data.tools || data.tools.length === 0) {
      throw new Error('At least one tool must be specified');
    }

    // Set default metadata
    data.metadata = data.metadata || { created: new Date().toISOString() };
  },

  /**
   * After creating agent
   */
  async afterCreate(event) {
    const { result } = event;
    console.log(`✅ Agent created: ${result.name} (${result.documentId})`);

    // Trigger webhook or notification
    // await notifyAgentCreated(result);
  },

  /**
   * Before updating agent
   */
  async beforeUpdate(event) {
    const { data, where } = event.params;

    // If disabling agent, check if it has running tasks
    if (data.enabled === false) {
      const runningTasks = await strapi.documents('api::task.task').count({
        filters: {
          agent: { documentId: where.documentId },
          status: 'running'
        }
      });

      if (runningTasks > 0) {
        throw new Error(`Cannot disable agent with ${runningTasks} running task(s)`);
      }
    }

    // Update metadata
    if (data.metadata) {
      data.metadata.lastModified = new Date().toISOString();
    }
  },

  /**
   * Before deleting agent
   */
  async beforeDelete(event) {
    const { where } = event.params;

    // Check for running tasks
    const runningTasks = await strapi.documents('api::task.task').count({
      filters: {
        agent: { documentId: where.documentId },
        status: 'running'
      }
    });

    if (runningTasks > 0) {
      throw new Error(`Cannot delete agent with ${runningTasks} running task(s)`);
    }

    // Archive tasks instead of deleting
    const tasks = await strapi.documents('api::task.task').findMany({
      filters: {
        agent: { documentId: where.documentId }
      }
    });

    for (const task of tasks) {
      await strapi.documents('api::task.task').update({
        documentId: task.documentId,
        data: { status: 'cancelled' }
      });
    }
  }
};
```

### Custom Validation Service

**Location:** `backend/src/api/agent/services/validator.ts`

```typescript
import { z } from 'zod';

// Zod schemas for validation
const AgentToolSchema = z.array(z.string().min(1));
const AgentModelSchema = z.enum(['haiku', 'sonnet', 'sonnet-4', 'opus', 'opus-4']);

export default () => ({
  /**
   * Validate agent data before save
   */
  validateAgentData(data: any) {
    const errors: string[] = [];

    // Tools validation
    try {
      AgentToolSchema.parse(data.tools);
    } catch (e) {
      errors.push('Tools must be a non-empty array of strings');
    }

    // Model validation
    try {
      AgentModelSchema.parse(data.model);
    } catch (e) {
      errors.push('Invalid model specified');
    }

    // System prompt validation
    if (!data.systemPrompt || data.systemPrompt.trim().length < 10) {
      errors.push('System prompt must be at least 10 characters');
    }

    // Name validation (no special characters except dash and underscore)
    if (!/^[a-zA-Z0-9-_\s]+$/.test(data.name)) {
      errors.push('Name can only contain letters, numbers, dashes, underscores, and spaces');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate MCP server configuration
   */
  validateMCPServer(data: any) {
    const errors: string[] = [];

    // Command must be executable
    if (!data.command || data.command.trim().length === 0) {
      errors.push('Command is required');
    }

    // Transport validation
    if (!['stdio', 'sse', 'http'].includes(data.transport)) {
      errors.push('Invalid transport type');
    }

    // HTTP-specific validation
    if (data.transport === 'http' && !data.healthCheckUrl) {
      errors.push('Health check URL required for HTTP transport');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
});
```

---

## PostgreSQL Configuration

**Location:** `backend/config/database.ts`

```typescript
export default ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', '127.0.0.1'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'claude_agent_ui'),
      user: env('DATABASE_USERNAME', 'postgres'),
      password: env('DATABASE_PASSWORD', 'postgres'),
      schema: env('DATABASE_SCHEMA', 'public'),
      ssl: env.bool('DATABASE_SSL', false) && {
        rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false)
      }
    },
    pool: {
      min: env.int('DATABASE_POOL_MIN', 2),
      max: env.int('DATABASE_POOL_MAX', 10),
      acquireTimeoutMillis: env.int('DATABASE_ACQUIRE_TIMEOUT', 60000),
      createTimeoutMillis: env.int('DATABASE_CREATE_TIMEOUT', 30000),
      destroyTimeoutMillis: env.int('DATABASE_DESTROY_TIMEOUT', 5000),
      idleTimeoutMillis: env.int('DATABASE_IDLE_TIMEOUT', 30000),
      reapIntervalMillis: env.int('DATABASE_REAP_INTERVAL', 1000),
      createRetryIntervalMillis: env.int('DATABASE_RETRY_INTERVAL', 200)
    },
    debug: env.bool('DATABASE_DEBUG', false)
  }
});
```

### Production Optimization

```typescript
// backend/config/env/production/database.ts
export default ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME'),
      user: env('DATABASE_USERNAME'),
      password: env('DATABASE_PASSWORD'),
      ssl: {
        rejectUnauthorized: true,
        ca: env('DATABASE_CA_CERT') // For managed PostgreSQL (AWS RDS, etc.)
      }
    },
    pool: {
      min: 5,
      max: 20, // Higher for production
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 30000
    },
    debug: false
  }
});
```

### Database Indexes

Create indexes for performance (run after first migration):

```sql
-- backend/database/indexes.sql

-- Agent indexes
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_enabled ON agents(enabled);
CREATE INDEX idx_agents_model ON agents(model);
CREATE INDEX idx_agents_execution_count ON agents(execution_count);

-- Skill indexes
CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_public ON skills(is_public);

-- MCP Server indexes
CREATE INDEX idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX idx_mcp_servers_disabled ON mcp_servers(disabled);
CREATE INDEX idx_mcp_servers_transport ON mcp_servers(transport);
CREATE INDEX idx_mcp_servers_healthy ON mcp_servers(is_healthy);

-- Task indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);

-- Relation indexes (auto-created by Strapi, but verify)
CREATE INDEX idx_agents_skills_agent ON agents_skills_links(agent_id);
CREATE INDEX idx_agents_skills_skill ON agents_skills_links(skill_id);
CREATE INDEX idx_agents_mcps_agent ON agents_mcp_servers_links(agent_id);
CREATE INDEX idx_agents_mcps_mcp ON agents_mcp_servers_links(mcp_server_id);

-- Full-text search indexes (optional, for advanced search)
CREATE INDEX idx_agents_search ON agents USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_skills_search ON skills USING GIN (to_tsvector('english', display_name || ' ' || description));
```

---

## TypeScript Integration

### Generated Types

Strapi 5 automatically generates TypeScript types. Access them in your code:

```typescript
// backend/types/generated/contentTypes.d.ts (auto-generated)
import type { Attribute, Schema } from '@strapi/strapi';

export interface ApiAgentAgent extends Schema.CollectionType {
  collectionName: 'agents';
  info: {
    singularName: 'agent';
    pluralName: 'agents';
    displayName: 'Agent';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String & Attribute.Required & Attribute.Unique;
    description: Attribute.Text;
    systemPrompt: Attribute.Text & Attribute.Required;
    tools: Attribute.JSON & Attribute.Required;
    disallowedTools: Attribute.JSON;
    model: Attribute.Enumeration<['haiku', 'sonnet', 'sonnet-4', 'opus', 'opus-4']> & Attribute.Required;
    enabled: Attribute.Boolean & Attribute.DefaultTo<true>;
    metadata: Attribute.JSON;
    executionCount: Attribute.Integer & Attribute.DefaultTo<0>;
    lastExecutedAt: Attribute.DateTime;
    averageExecutionTime: Attribute.Decimal & Attribute.DefaultTo<0>;
    mcpServers: Attribute.Relation<'api::agent.agent', 'manyToMany', 'api::mcp-server.mcp-server'>;
    skills: Attribute.Relation<'api::agent.agent', 'manyToMany', 'api::skill.skill'>;
    tasks: Attribute.Relation<'api::agent.agent', 'oneToMany', 'api::task.task'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    documentId: Attribute.UID;
  };
}
```

### Using Types in Services

```typescript
// backend/src/api/agent/services/agent.ts
import type { ApiAgentAgent } from '../../../types/generated/contentTypes';

type Agent = ApiAgentAgent['attributes'];

export default factories.createCoreService('api::agent.agent', ({ strapi }) => ({
  async findOneTyped(documentId: string): Promise<Agent> {
    return await strapi.documents('api::agent.agent').findOne({
      documentId
    });
  }
}));
```

### tsconfig.json

**Location:** `backend/tsconfig.json`

```json
{
  "extends": "@strapi/typescript-utils/tsconfigs/server",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "baseUrl": "./",
    "paths": {
      "~/*": ["./*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"]
  },
  "include": [
    "./",
    "./**/*.ts",
    "./**/*.js",
    "src/**/*.json"
  ],
  "exclude": [
    "node_modules",
    "build",
    "dist",
    ".cache",
    ".tmp",
    "src/admin"
  ]
}
```

---

## Security Configuration

### API Tokens

**Location:** `backend/config/plugins.ts`

```typescript
export default () => ({
  'users-permissions': {
    enabled: true,
    config: {
      jwtSecret: process.env.JWT_SECRET || 'changeme',
      jwt: {
        expiresIn: '7d'
      }
    }
  }
});
```

### CORS & Middlewares

**Location:** `backend/config/middlewares.ts`

```typescript
export default [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', 'http://localhost:3001'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: null
        }
      }
    }
  },
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: [
        'http://localhost:5173',  // Frontend dev
        'http://localhost:3001',  // Express backend
        process.env.FRONTEND_URL  // Production frontend
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true
    }
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '256mb', // Increase if handling large agent configs
      jsonLimit: '256mb',
      textLimit: '256mb',
      formidable: {
        maxFileSize: 250 * 1024 * 1024 // 250mb
      }
    }
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public'
];
```

### API Permissions

Configure in admin panel or programmatically:

```typescript
// backend/src/extensions/users-permissions/strapi-server.ts
module.exports = (plugin) => {
  // Make Agent endpoints public read, authenticated write
  plugin.routes['content-api'].routes.push({
    method: 'GET',
    path: '/agents',
    handler: 'agent.find',
    config: {
      policies: [],
      auth: false // Public read
    }
  });

  plugin.routes['content-api'].routes.push({
    method: 'POST',
    path: '/agents',
    handler: 'agent.create',
    config: {
      policies: [],
      auth: true // Authenticated write
    }
  });

  return plugin;
};
```

---

## Performance Optimizations

### 1. Response Caching

**Install plugin:**
```bash
npm install @strapi/plugin-rest-cache
```

**Configure:**

**Location:** `backend/config/plugins.ts`

```typescript
export default () => ({
  'rest-cache': {
    enabled: true,
    config: {
      provider: {
        name: 'memory',
        options: {
          max: 100,
          maxAge: 3600000 // 1 hour
        }
      },
      strategy: {
        contentTypes: [
          {
            contentType: 'api::agent.agent',
            maxAge: 3600000,
            headers: ['accept', 'content-type']
          },
          {
            contentType: 'api::skill.skill',
            maxAge: 3600000
          },
          {
            contentType: 'api::mcp-server.mcp-server',
            maxAge: 1800000 // 30 minutes
          }
        ]
      }
    }
  }
});
```

### 2. Database Query Optimization

```typescript
// Bad: N+1 query problem
const agents = await strapi.documents('api::agent.agent').findMany();
for (const agent of agents) {
  agent.skills = await strapi.documents('api::skill.skill').findMany({
    filters: { agents: { documentId: agent.documentId } }
  });
}

// Good: Single query with population
const agents = await strapi.documents('api::agent.agent').findMany({
  populate: {
    skills: true,
    mcpServers: true
  }
});
```

### 3. Pagination Best Practices

```typescript
// Always use pagination for large datasets
const agents = await strapi.documents('api::agent.agent').findMany({
  pagination: {
    page: 1,
    pageSize: 25,
    withCount: true // Include total count
  }
});

// Response format:
{
  data: [...],
  meta: {
    pagination: {
      page: 1,
      pageSize: 25,
      pageCount: 4,
      total: 100
    }
  }
}
```

### 4. Lazy Loading Relations

```typescript
// Don't always populate all relations
// Instead, fetch on-demand

// Initial load: Just agent data
const agent = await strapi.documents('api::agent.agent').findOne({
  documentId
});

// Load skills only when needed
if (needSkills) {
  agent.skills = await strapi.documents('api::skill.skill').findMany({
    filters: {
      agents: { documentId: agent.documentId }
    }
  });
}
```

---

## Testing Strategy

### Unit Tests (Services)

**Location:** `backend/tests/agent-service.test.ts`

```typescript
import { setupStrapi, cleanupStrapi } from './helpers/strapi';

describe('Agent Service', () => {
  let strapi;

  beforeAll(async () => {
    strapi = await setupStrapi();
  });

  afterAll(async () => {
    await cleanupStrapi(strapi);
  });

  it('should create agent successfully', async () => {
    const agent = await strapi.documents('api::agent.agent').create({
      data: {
        name: 'Test Agent',
        systemPrompt: 'You are a test agent',
        tools: ['Read', 'Write'],
        model: 'sonnet',
        enabled: true
      }
    });

    expect(agent).toBeDefined();
    expect(agent.name).toBe('Test Agent');
    expect(agent.documentId).toBeDefined();
  });

  it('should validate agent configuration', async () => {
    const agent = await strapi.documents('api::agent.agent').create({
      data: {
        name: 'Invalid Agent',
        systemPrompt: 'Short',
        tools: [],
        model: 'sonnet'
      }
    });

    const validation = await strapi
      .service('api::agent.agent')
      .validateConfiguration(agent.documentId);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should update execution stats', async () => {
    const agent = await strapi.documents('api::agent.agent').create({
      data: {
        name: 'Stats Agent',
        systemPrompt: 'Test agent for stats',
        tools: ['Read'],
        model: 'sonnet'
      }
    });

    await strapi
      .service('api::agent.agent')
      .updateExecutionStats(agent.documentId, 1500);

    const updated = await strapi.documents('api::agent.agent').findOne({
      documentId: agent.documentId
    });

    expect(updated.executionCount).toBe(1);
    expect(updated.averageExecutionTime).toBe(1500);
    expect(updated.lastExecutedAt).toBeDefined();
  });
});
```

### Integration Tests (API)

**Location:** `backend/tests/agent-api.test.ts`

```typescript
import request from 'supertest';

describe('Agent API', () => {
  let strapi;

  beforeAll(async () => {
    strapi = await setupStrapi();
  });

  afterAll(async () => {
    await cleanupStrapi(strapi);
  });

  it('GET /api/agents returns list', async () => {
    const response = await request(strapi.server.httpServer)
      .get('/api/agents')
      .expect(200);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('POST /api/agents creates new agent', async () => {
    const agentData = {
      name: 'API Test Agent',
      systemPrompt: 'Test from API',
      tools: ['Read', 'Write'],
      model: 'sonnet',
      enabled: true
    };

    const response = await request(strapi.server.httpServer)
      .post('/api/agents')
      .send({ data: agentData })
      .expect(201);

    expect(response.body.data.name).toBe(agentData.name);
    expect(response.body.data.documentId).toBeDefined();
  });

  it('POST /api/agents/:id/test validates agent', async () => {
    // Create agent first
    const agent = await strapi.documents('api::agent.agent').create({
      data: {
        name: 'Validation Test',
        systemPrompt: 'Valid prompt',
        tools: ['Read'],
        model: 'sonnet'
      }
    });

    const response = await request(strapi.server.httpServer)
      .post(`/api/agents/${agent.documentId}/test`)
      .expect(200);

    expect(response.body.valid).toBeDefined();
  });
});
```

---

## Admin Panel Customization

### Custom Field Components

**Location:** `backend/src/admin/app.tsx`

```typescript
export default {
  config: {
    locales: ['en', 'tr'],
    theme: {
      light: {
        colors: {
          primary100: '#f0f0ff',
          primary200: '#d9d9ff',
          primary500: '#7b79ff',
          primary600: '#5e5ce6',
          primary700: '#4c4ad8'
        }
      },
      dark: {
        colors: {
          primary100: '#2a2a4a',
          primary200: '#3a3a6a',
          primary500: '#7b79ff',
          primary600: '#9997ff',
          primary700: '#b3b1ff'
        }
      }
    },
    translations: {
      en: {
        'app.components.LeftMenu.navbrand.title': 'Claude Agent UI',
        'app.components.LeftMenu.navbrand.workplace': 'Admin Panel'
      },
      tr: {
        'app.components.LeftMenu.navbrand.title': 'Claude Agent UI',
        'app.components.LeftMenu.navbrand.workplace': 'Yönetim Paneli'
      }
    },
    tutorials: false,
    notifications: {
      releases: false
    }
  },

  bootstrap(app) {
    console.log('Admin panel bootstrapped');
  }
};
```

### Custom Views

**Location:** `backend/src/admin/extensions/config/agents-dashboard.tsx`

```typescript
import React from 'react';
import { Box, Typography, Grid } from '@strapi/design-system';

const AgentsDashboard = () => {
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    // Fetch stats from API
    fetch('/api/agents/stats')
      .then(res => res.json())
      .then(data => setStats(data));
  }, []);

  return (
    <Box padding={8}>
      <Typography variant="alpha">Agents Dashboard</Typography>

      <Grid gap={4} marginTop={4}>
        <Box background="neutral0" padding={4} borderRadius="4px">
          <Typography variant="omega">Total Agents</Typography>
          <Typography variant="alpha">{stats?.totalAgents || 0}</Typography>
        </Box>

        <Box background="neutral0" padding={4} borderRadius="4px">
          <Typography variant="omega">Active Agents</Typography>
          <Typography variant="alpha">{stats?.activeAgents || 0}</Typography>
        </Box>

        <Box background="neutral0" padding={4} borderRadius="4px">
          <Typography variant="omega">Total Executions</Typography>
          <Typography variant="alpha">{stats?.totalExecutions || 0}</Typography>
        </Box>
      </Grid>
    </Box>
  );
};

export default AgentsDashboard;
```

---

## Migration Script Details

### Enhanced Migration Script

**Location:** `scripts/migrate-to-strapi.ts`

```typescript
import Database from 'better-sqlite3';
import axios from 'axios';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

const strapiApi = axios.create({
  baseURL: `${STRAPI_URL}/api`,
  headers: {
    'Authorization': `Bearer ${STRAPI_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

interface MigrationStats {
  agents: { success: number; failed: number };
  skills: { success: number; failed: number };
  mcpServers: { success: number; failed: number };
  tasks: { success: number; failed: number };
}

async function migrate() {
  console.log('🚀 Starting migration from SQLite to Strapi + PostgreSQL...\n');

  const stats: MigrationStats = {
    agents: { success: 0, failed: 0 },
    skills: { success: 0, failed: 0 },
    mcpServers: { success: 0, failed: 0 },
    tasks: { success: 0, failed: 0 }
  };

  // Open SQLite database (read-only)
  const db = new Database('./data/claude_agent_ui.db', { readonly: true });

  try {
    // Step 1: Migrate Skills (no dependencies)
    console.log('📚 Migrating skills...');
    await migrateSkills(db, stats);

    // Step 2: Migrate MCP Servers (no dependencies)
    console.log('\n🔌 Migrating MCP servers...');
    await migrateMCPServers(db, stats);

    // Step 3: Migrate Agents (depends on skills + MCP servers)
    console.log('\n🤖 Migrating agents...');
    await migrateAgents(db, stats);

    // Step 4: Migrate Tasks (depends on agents)
    console.log('\n📋 Migrating tasks...');
    await migrateTasks(db, stats);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed!\n');
    printStats(stats);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

async function migrateSkills(db: Database.Database, stats: MigrationStats) {
  const skills = db.prepare('SELECT * FROM skills').all();
  const skillMap = new Map(); // SQLite ID → Strapi documentId

  for (const skill of skills) {
    try {
      const { data } = await strapiApi.post('/skills', {
        data: {
          name: skill.name,
          displayName: skill.display_name || skill.name,
          description: skill.description,
          content: skill.content,
          allowedTools: JSON.parse(skill.allowed_tools || '[]'),
          experienceScore: skill.experience_score || 0,
          category: skill.category || 'custom',
          isPublic: true,
          version: '1.0.0'
        }
      });

      skillMap.set(skill.id, data.data.documentId);
      stats.skills.success++;
      console.log(`  ✓ ${skill.name}`);
    } catch (error) {
      stats.skills.failed++;
      console.error(`  ✗ ${skill.name}: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  return skillMap;
}

async function migrateMCPServers(db: Database.Database, stats: MigrationStats) {
  const servers = db.prepare('SELECT * FROM mcp_servers').all();
  const serverMap = new Map(); // SQLite ID → Strapi documentId

  for (const server of servers) {
    try {
      const { data } = await strapiApi.post('/mcp-servers', {
        data: {
          name: server.name,
          description: server.description || '',
          command: server.command,
          args: JSON.parse(server.args || '[]'),
          env: JSON.parse(server.env || '{}'),
          disabled: Boolean(server.disabled),
          transport: server.transport || 'stdio',
          startupTimeout: 30000,
          restartPolicy: 'on-failure'
        }
      });

      serverMap.set(server.id, data.data.documentId);
      stats.mcpServers.success++;
      console.log(`  ✓ ${server.name}`);
    } catch (error) {
      stats.mcpServers.failed++;
      console.error(`  ✗ ${server.name}: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  return serverMap;
}

async function migrateAgents(db: Database.Database, stats: MigrationStats) {
  const agents = db.prepare('SELECT * FROM agents').all();
  const agentMap = new Map(); // SQLite ID → Strapi documentId

  // Get skill and MCP server maps
  const skillMap = await getExistingSkills();
  const serverMap = await getExistingMCPServers();

  for (const agent of agents) {
    try {
      // Get agent relations
      const agentSkills = db.prepare(`
        SELECT skill_id FROM agent_skills WHERE agent_id = ?
      `).all(agent.id);

      const agentServers = db.prepare(`
        SELECT mcp_server_id FROM agent_mcp_servers WHERE agent_id = ?
      `).all(agent.id);

      const { data } = await strapiApi.post('/agents', {
        data: {
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.system_prompt,
          tools: JSON.parse(agent.tools || '[]'),
          disallowedTools: JSON.parse(agent.disallowed_tools || '[]'),
          model: agent.model || 'sonnet',
          enabled: Boolean(agent.enabled),
          executionCount: agent.execution_count || 0,
          lastExecutedAt: agent.last_executed_at,
          averageExecutionTime: agent.average_execution_time || 0,
          skills: agentSkills.map(s => skillMap.get(s.skill_id)).filter(Boolean),
          mcpServers: agentServers.map(s => serverMap.get(s.mcp_server_id)).filter(Boolean)
        }
      });

      agentMap.set(agent.id, data.data.documentId);
      stats.agents.success++;
      console.log(`  ✓ ${agent.name}`);
    } catch (error) {
      stats.agents.failed++;
      console.error(`  ✗ ${agent.name}: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  return agentMap;
}

async function migrateTasks(db: Database.Database, stats: MigrationStats) {
  const tasks = db.prepare('SELECT * FROM tasks LIMIT 1000').all(); // Limit to recent tasks
  const agentMap = await getExistingAgents();

  for (const task of tasks) {
    try {
      const agentDocumentId = agentMap.get(task.agent_id);
      if (!agentDocumentId) {
        console.warn(`  ⚠ Skipping task ${task.id}: Agent not found`);
        continue;
      }

      await strapiApi.post('/tasks', {
        data: {
          agent: agentDocumentId,
          message: task.message,
          status: task.status || 'completed',
          result: task.result ? JSON.parse(task.result) : null,
          error: task.error,
          startedAt: task.started_at,
          completedAt: task.completed_at,
          executionTime: task.execution_time,
          tokensUsed: task.tokens_used || 0,
          cost: task.cost || 0
        }
      });

      stats.tasks.success++;
      if (stats.tasks.success % 100 === 0) {
        console.log(`  ✓ ${stats.tasks.success} tasks migrated...`);
      }
    } catch (error) {
      stats.tasks.failed++;
    }
  }
}

async function getExistingSkills() {
  const { data } = await strapiApi.get('/skills?pagination[limit]=1000');
  const map = new Map();

  // Map by name (assuming name is stable)
  for (const skill of data.data) {
    map.set(skill.attributes.name, skill.documentId);
  }

  return map;
}

async function getExistingMCPServers() {
  const { data } = await strapiApi.get('/mcp-servers?pagination[limit]=1000');
  const map = new Map();

  for (const server of data.data) {
    map.set(server.attributes.name, server.documentId);
  }

  return map;
}

async function getExistingAgents() {
  const { data } = await strapiApi.get('/agents?pagination[limit]=1000');
  const map = new Map();

  for (const agent of data.data) {
    map.set(agent.attributes.name, agent.documentId);
  }

  return map;
}

function printStats(stats: MigrationStats) {
  console.log('Skills:');
  console.log(`  ✅ Success: ${stats.skills.success}`);
  console.log(`  ❌ Failed: ${stats.skills.failed}`);

  console.log('\nMCP Servers:');
  console.log(`  ✅ Success: ${stats.mcpServers.success}`);
  console.log(`  ❌ Failed: ${stats.mcpServers.failed}`);

  console.log('\nAgents:');
  console.log(`  ✅ Success: ${stats.agents.success}`);
  console.log(`  ❌ Failed: ${stats.agents.failed}`);

  console.log('\nTasks:');
  console.log(`  ✅ Success: ${stats.tasks.success}`);
  console.log(`  ❌ Failed: ${stats.tasks.failed}`);

  const totalSuccess = Object.values(stats).reduce((sum, s) => sum + s.success, 0);
  const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);

  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${totalSuccess} success, ${totalFailed} failed`);
}

// Run migration
migrate().catch(console.error);
```

### Run Migration

```bash
# Set environment variables
export STRAPI_URL=http://localhost:1337
export STRAPI_API_TOKEN=your_api_token_here

# Run migration
npx ts-node scripts/migrate-to-strapi.ts
```

---

## Deployment Configuration

### Environment Variables

**Location:** `backend/.env.production`

```env
# Server
NODE_ENV=production
HOST=0.0.0.0
PORT=1337

# Database
DATABASE_CLIENT=postgres
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_NAME=claude_agent_ui
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=true

# Secrets (generate with: openssl rand -base64 32)
APP_KEYS=key1,key2,key3,key4
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt
JWT_SECRET=your-jwt-secret

# Admin
ADMIN_PATH=/admin

# CORS
CLIENT_URL=https://your-frontend-domain.com
EXPRESS_URL=https://your-express-domain.com

# Logging
LOG_LEVEL=info

# Performance
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

### Docker Compose (Production)

**Location:** `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: claude-postgres
    environment:
      POSTGRES_DB: ${DATABASE_NAME}
      POSTGRES_USER: ${DATABASE_USERNAME}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/indexes.sql:/docker-entrypoint-initdb.d/indexes.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USERNAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  strapi:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: claude-strapi
    env_file: ./backend/.env.production
    ports:
      - "1337:1337"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend/public:/opt/app/public
      - ./backend/uploads:/opt/app/public/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:1337/_health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

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
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: claude-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - strapi
      - express
    restart: unless-stopped

volumes:
  postgres_data:
```

### Dockerfile (Strapi)

**Location:** `backend/Dockerfile`

```dockerfile
FROM node:20-alpine AS build

WORKDIR /opt/app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /opt/app

# Copy from build stage
COPY --from=build /opt/app/node_modules ./node_modules
COPY --from=build /opt/app/dist ./dist
COPY --from=build /opt/app/public ./public
COPY --from=build /opt/app/package.json ./

ENV NODE_ENV=production

EXPOSE 1337

CMD ["npm", "run", "start"]
```

### Health Check Endpoint

**Location:** `backend/src/api/health/routes/health.ts`

```typescript
export default {
  routes: [
    {
      method: 'GET',
      path: '/_health',
      handler: async (ctx) => {
        try {
          // Check database connection
          await strapi.db.connection.raw('SELECT 1');

          ctx.body = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected'
          };
        } catch (error) {
          ctx.status = 503;
          ctx.body = {
            status: 'unhealthy',
            error: error.message
          };
        }
      },
      config: {
        auth: false
      }
    }
  ]
};
```

---

## Conclusion

### Strapi 5 Advantages Summary

| Feature | Benefit | Time Saved |
|---------|---------|-----------|
| Auto-generated Admin Panel | No custom UI development | 40+ hours |
| Auto-generated REST API | No manual routes/controllers | 20+ hours |
| Type Generation | Fewer bugs, better DX | 10+ hours |
| Built-in Validation | Centralized rules | 5+ hours |
| Database Migrations | Automatic schema changes | 10+ hours |
| Authentication & RBAC | Production-ready security | 15+ hours |
| API Documentation | Always up-to-date | 5+ hours |

**Total Estimated Time Saved: 100+ hours**

### Key Takeaways

1. **Document-based Architecture**: Strapi 5's documentId system simplifies versioning and localization
2. **TypeScript First**: Auto-generated types improve development experience
3. **Custom Logic Preserved**: Hybrid architecture keeps Express for SSE and Claude SDK
4. **Production-Ready**: Built-in security, caching, and performance features
5. **Flexible**: Can customize everything via controllers, services, and lifecycles
6. **Scalable**: PostgreSQL + connection pooling + caching = enterprise-grade

### Next Steps

1. ✅ Review this analysis
2. ⏭️ Start with Phase 1: PostgreSQL + Strapi setup
3. ⏭️ Create content types using enhanced schemas
4. ⏭️ Implement Express-Strapi integration
5. ⏭️ Run migration script
6. ⏭️ Test hybrid architecture
7. ⏭️ Deploy to production

---

**Prepared by:** Claude Agent with Strapi 5 Expert Skill
**Version:** 1.0
**Last Updated:** 2025-10-31
**Based on:** Strapi 5 Official Documentation
