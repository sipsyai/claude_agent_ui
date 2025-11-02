# Integration Patterns: Express + Strapi

**Topic:** Hybrid Architecture Patterns
**Created:** 2025-10-31

---

## Architecture Overview

**Hybrid Approach:** Express handles SSE streaming while Strapi handles CRUD operations.

```
Frontend
  ↓
Express (SSE streaming, Claude SDK)
  ↓
Strapi (CRUD, admin, auth)
  ↓
PostgreSQL
```

## Strapi API Client

```typescript
import axios, { AxiosInstance } from 'axios';

class StrapiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.STRAPI_URL || 'http://localhost:1337/api',
      headers: {
        'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get all agents
  async getAgents() {
    const { data } = await this.client.get('/agents', {
      params: { populate: '*' }
    });
    return data.data.map(this.transformStrapiResponse);
  }

  // Get single agent
  async getAgent(id: string) {
    const { data } = await this.client.get(`/agents/${id}`, {
      params: { populate: '*' }
    });
    return this.transformStrapiResponse(data.data);
  }

  // Create agent
  async createAgent(agentData: any) {
    const { data } = await this.client.post('/agents', {
      data: agentData
    });
    return this.transformStrapiResponse(data.data);
  }

  // Update agent
  async updateAgent(id: string, agentData: any) {
    const { data } = await this.client.put(`/agents/${id}`, {
      data: agentData
    });
    return this.transformStrapiResponse(data.data);
  }

  // Transform Strapi response format
  private transformStrapiResponse(item: any) {
    return {
      id: item.id,
      ...item.attributes
    };
  }
}

export const strapiClient = new StrapiClient();
```

## Express Routes with Strapi

```typescript
import express from 'express';
import { strapiClient } from '../services/strapi-client';

const router = express.Router();

// CRUD operations proxy to Strapi
router.get('/agents', async (req, res, next) => {
  try {
    const agents = await strapiClient.getAgents();
    res.json(agents);
  } catch (error) {
    next(error);
  }
});

router.post('/agents', async (req, res, next) => {
  try {
    const agent = await strapiClient.createAgent(req.body);
    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
});

// Agent execution with SSE (Express only)
router.post('/agent/:id/execute', async (req, res, next) => {
  try {
    const agent = await strapiClient.getAgent(req.params.id);
    const { message } = req.body;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Execute agent with streaming
    await executeAgent(agent, message, {
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      },
      onComplete: (result) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

## TypeScript Types for Strapi

```typescript
// Strapi response format
interface StrapiData<T> {
  id: number;
  attributes: T;
}

interface StrapiResponse<T> {
  data: StrapiData<T> | StrapiData<T>[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

// Agent interface
interface Agent {
  id: number;
  name: string;
  systemPrompt: string;
  tools: string[];
  enabled: boolean;
  mcpServers?: McpServer[];
}

// Transform helper
function transformStrapi<T>(response: StrapiData<T>): T & { id: number } {
  return {
    id: response.id,
    ...response.attributes
  };
}
```

## Responsibility Split

### Express Handles:
- ✅ SSE streaming for agent execution
- ✅ Claude SDK integration
- ✅ MCP server lifecycle management
- ✅ Real-time event streaming
- ✅ File operations (if needed)

### Strapi Handles:
- ✅ CRUD operations (agents, skills, MCP servers)
- ✅ Admin panel UI
- ✅ Authentication & authorization
- ✅ Data validation & relationships
- ✅ API documentation

## Environment Configuration

```env
# Strapi connection
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your_api_token_here

# Claude SDK
ANTHROPIC_API_KEY=your_anthropic_key

# Express
PORT=3001
NODE_ENV=production
```

## Error Handling

```typescript
// Custom error for Strapi failures
class StrapiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'StrapiError';
  }
}

// Error middleware
app.use((err, req, res, next) => {
  if (err.name === 'StrapiError') {
    return res.status(err.statusCode).json({
      error: 'Strapi API Error',
      message: err.message
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});
```

## Best Practices

1. **Use API tokens** for Strapi authentication
2. **Transform Strapi responses** for clean API
3. **Cache frequently accessed data** from Strapi
4. **Handle Strapi downtime** gracefully
5. **Keep SSE logic in Express** - don't route through Strapi
6. **Use TypeScript** for type safety between systems
7. **Implement retry logic** for Strapi calls
