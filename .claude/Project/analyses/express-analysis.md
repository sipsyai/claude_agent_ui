# Express.js Architecture Analysis - Claude Agent UI Migration

**Project:** Claude Agent UI - Express Integration Layer Analysis
**Focus:** SSE Streaming, Middleware Patterns, Hybrid Architecture
**Date:** 2025-10-31
**Version:** 1.0

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Express Architecture Overview](#express-architecture-overview)
3. [SSE Streaming Implementation](#sse-streaming-implementation)
4. [Strapi Client Service Architecture](#strapi-client-service-architecture)
5. [Middleware Patterns](#middleware-patterns)
6. [Route Organization & Integration](#route-organization--integration)
7. [Hybrid Architecture Deep Dive](#hybrid-architecture-deep-dive)
8. [Error Handling Strategy](#error-handling-strategy)
9. [Production Deployment](#production-deployment)
10. [Performance Optimization](#performance-optimization)
11. [Security Considerations](#security-considerations)
12. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### The Hybrid Architecture Approach

This migration employs a **hybrid architecture** where Express.js maintains its strength in real-time streaming and custom business logic, while Strapi handles CRUD operations and data persistence. This separation of concerns provides:

- ✅ **Preserved Real-time Capabilities**: SSE streaming remains in Express where it belongs
- ✅ **Simplified Data Management**: Strapi auto-generates CRUD APIs
- ✅ **Flexible Business Logic**: Custom Claude SDK integration stays in Express
- ✅ **Scalable Infrastructure**: PostgreSQL for data, Express for streaming

### Key Express Responsibilities

```
┌─────────────────────────────────────┐
│       Express Backend (3001)        │
│                                     │
│  ✓ SSE Streaming Endpoints          │
│  ✓ Agent Execution Logic            │
│  ✓ Claude SDK Integration           │
│  ✓ MCP Server Lifecycle             │
│  ✓ Real-time Event Broadcasting     │
│  ✓ File System Operations           │
│  ✓ Conversation Caching             │
│  ✓ Custom Business Logic            │
│                                     │
│  ✗ Data Persistence (→ Strapi)      │
│  ✗ User Management (→ Strapi)       │
│  ✗ Admin UI (→ Strapi)              │
└─────────────────────────────────────┘
```

---

## Express Architecture Overview

### Current vs. Hybrid Architecture

#### Current Architecture (Express Monolith)

```typescript
// Current: Express handles everything
┌────────────────────────────────┐
│        Express Server          │
│                                │
│  ├─ CRUD Routes                │
│  ├─ SSE Routes                 │
│  ├─ SQLite Integration         │
│  ├─ Claude SDK Service         │
│  ├─ MCP Service                │
│  └─ File System Service        │
└────────────────────────────────┘
         │
         ▼
   ┌──────────┐
   │  SQLite  │
   └──────────┘
```

#### Target Architecture (Hybrid)

```typescript
// Target: Separation of concerns
Frontend (React 5173)
         │
         ├─────────────────┬────────────────────┐
         │                 │                    │
         ▼                 ▼                    ▼
    CRUD API         SSE/Execute          Admin Panel
         │                 │                    │
         ▼                 ▼                    ▼
   ┌──────────┐    ┌──────────────┐    ┌──────────┐
   │  Strapi  │◄───│   Express    │    │  Strapi  │
   │  (1337)  │    │   (3001)     │    │  Admin   │
   └──────────┘    └──────────────┘    └──────────┘
         │
         ▼
   ┌──────────┐
   │PostgreSQL│
   └──────────┘
```

### Express Server Structure

```typescript
// src/server.ts
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

// Import routes
import managerRoutes from './routes/manager.routes';
import executionRoutes from './routes/execution.routes';
import mcpRoutes from './routes/mcp.routes';

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/logger';
import { authMiddleware } from './middleware/auth';

// Import services
import { strapiClient } from './services/strapi-client';
import { claudeSDKService } from './services/claude-sdk-service';
import { mcpService } from './services/mcp-service';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// ============= MIDDLEWARE STACK =============

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow SSE
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for dual-origin support
app.use(cors({
  origin: [
    'http://localhost:5173', // Frontend dev
    'http://localhost:1337', // Strapi admin
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression for responses (but not SSE streams)
app.use(compression({
  filter: (req, res) => {
    // Don't compress SSE streams
    if (req.path.includes('/execute')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Request logging
app.use(morgan('combined'));
app.use(requestLogger);

// ============= HEALTH CHECK =============

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check Strapi connectivity
    await strapiClient.healthCheck();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        express: 'up',
        strapi: 'up',
        mcp: mcpService.getStatus()
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ============= API ROUTES =============

// Manager routes (CRUD operations - proxy to Strapi)
app.use('/api/manager', managerRoutes);

// Execution routes (SSE streaming - native Express)
app.use('/api/execute', executionRoutes);

// MCP routes (lifecycle management)
app.use('/api/mcp', mcpRoutes);

// ============= ERROR HANDLING =============

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use(errorHandler);

// ============= SERVER STARTUP =============

const server = app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
  console.log(`📡 Strapi connection: ${process.env.STRAPI_URL}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);

  // Initialize services
  initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('🛑 Graceful shutdown initiated...');

  // Close MCP servers
  await mcpService.closeAll();

  // Close server
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

async function initializeServices() {
  try {
    // Verify Strapi connection
    await strapiClient.healthCheck();
    console.log('✅ Strapi connection established');

    // Initialize MCP servers
    await mcpService.initializeFromStrapi();
    console.log('✅ MCP servers initialized');

    // Warm up Claude SDK
    await claudeSDKService.initialize();
    console.log('✅ Claude SDK ready');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    process.exit(1);
  }
}

export default app;
```

---

## SSE Streaming Implementation

### Complete SSE Architecture

Server-Sent Events (SSE) is critical for real-time agent execution feedback. Express.js provides the perfect platform for SSE streaming.

#### SSE Execution Route

```typescript
// src/routes/execution.routes.ts
import express, { Request, Response } from 'express';
import { strapiClient } from '../services/strapi-client';
import { claudeSDKService } from '../services/claude-sdk-service';
import { mcpService } from '../services/mcp-service';
import { conversationCache } from '../services/conversation-cache';
import { z } from 'zod';

const router = express.Router();

// ============= REQUEST VALIDATION =============

const executeAgentSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  conversationId: z.string().optional(),
  context: z.record(z.any()).optional(),
  maxTokens: z.number().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(1).optional()
});

// ============= SSE HELPER FUNCTIONS =============

class SSEStream {
  constructor(private res: Response) {
    // Set SSE headers
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection comment
    this.res.write(': SSE stream initialized\n\n');
    this.res.flushHeaders();
  }

  send(event: string, data: any) {
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  sendData(data: any) {
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  sendComment(comment: string) {
    this.res.write(`: ${comment}\n\n`);
  }

  close() {
    this.res.end();
  }

  // Keep-alive ping every 30 seconds
  startKeepAlive(): NodeJS.Timeout {
    return setInterval(() => {
      this.sendComment('keep-alive');
    }, 30000);
  }
}

// ============= AGENT EXECUTION ENDPOINT =============

router.post('/agent/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const keepAliveInterval = null;

  try {
    // 1. Validate request body
    const body = executeAgentSchema.parse(req.body);

    // 2. Fetch agent configuration from Strapi
    const agent = await strapiClient.getAgent(id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!agent.enabled) {
      return res.status(403).json({ error: 'Agent is disabled' });
    }

    // 3. Initialize SSE stream
    const stream = new SSEStream(res);
    const keepAliveInterval = stream.startKeepAlive();

    // 4. Handle client disconnect
    req.on('close', () => {
      console.log(`Client disconnected from agent ${id}`);
      clearInterval(keepAliveInterval);
      claudeSDKService.cancelExecution(id);
    });

    // 5. Fetch related data (skills, MCP servers)
    const [skills, mcpServers] = await Promise.all([
      agent.skills ? strapiClient.getSkillsByIds(agent.skills) : [],
      agent.mcpServers ? strapiClient.getMCPServersByIds(agent.mcpServers) : []
    ]);

    // 6. Load conversation context
    const conversationId = body.conversationId || generateConversationId();
    const conversationContext = await conversationCache.get(conversationId);

    // 7. Initialize MCP servers if needed
    const activeMcpServers = mcpServers.filter(s => !s.disabled);
    for (const mcpServer of activeMcpServers) {
      if (!mcpService.isRunning(mcpServer.id)) {
        stream.send('mcp_init', {
          serverId: mcpServer.id,
          name: mcpServer.name
        });
        await mcpService.start(mcpServer);
      }
    }

    // 8. Build agent configuration
    const agentConfig = {
      name: agent.name,
      systemPrompt: buildSystemPrompt(agent, skills),
      model: agent.model,
      tools: buildToolList(agent, mcpServers),
      maxTokens: body.maxTokens || 4096,
      temperature: body.temperature || 0.7
    };

    // 9. Send execution start event
    stream.send('start', {
      agentId: id,
      agentName: agent.name,
      conversationId,
      timestamp: new Date().toISOString()
    });

    // 10. Execute agent with streaming callbacks
    await claudeSDKService.executeAgent(agentConfig, body.message, {
      conversationContext,

      onStreamStart: () => {
        stream.send('stream_start', {
          message: 'Agent is thinking...'
        });
      },

      onToken: (token: string) => {
        stream.send('token', {
          content: token
        });
      },

      onThinking: (thinking: string) => {
        stream.send('thinking', {
          content: thinking
        });
      },

      onToolUse: (tool: any) => {
        stream.send('tool_use', {
          tool: tool.name,
          input: tool.input,
          timestamp: new Date().toISOString()
        });
      },

      onToolResult: (tool: string, result: any) => {
        stream.send('tool_result', {
          tool,
          result,
          timestamp: new Date().toISOString()
        });
      },

      onError: (error: Error) => {
        stream.send('error', {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      },

      onComplete: async (result: any) => {
        // Save conversation context
        await conversationCache.set(conversationId, result.context);

        // Send completion event
        stream.send('complete', {
          result: result.output,
          tokensUsed: result.tokensUsed,
          executionTime: result.executionTime,
          conversationId,
          timestamp: new Date().toISOString()
        });

        // Close stream
        clearInterval(keepAliveInterval);
        stream.close();
      }
    });

  } catch (error) {
    console.error('Agent execution error:', error);

    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }

    // If headers already sent, send error via SSE
    if (res.headersSent) {
      const stream = new SSEStream(res);
      stream.send('error', {
        message: error.message,
        type: error.name
      });
      stream.close();
    } else {
      // Otherwise send JSON error
      res.status(500).json({
        error: error.message,
        type: error.name
      });
    }
  }
});

// ============= SSE HELPER FUNCTIONS =============

function buildSystemPrompt(agent: any, skills: any[]): string {
  let prompt = agent.systemPrompt;

  if (skills && skills.length > 0) {
    prompt += '\n\n## Available Skills\n\n';
    for (const skill of skills) {
      prompt += `### ${skill.name}\n`;
      prompt += `${skill.description}\n\n`;
      prompt += `${skill.content}\n\n`;
    }
  }

  return prompt;
}

function buildToolList(agent: any, mcpServers: any[]): string[] {
  const tools = [...(agent.tools || [])];
  const disallowed = agent.disallowedTools || [];

  // Add MCP server tools
  for (const mcpServer of mcpServers) {
    if (!mcpServer.disabled) {
      const mcpTools = mcpService.getTools(mcpServer.id);
      tools.push(...mcpTools);
    }
  }

  // Filter out disallowed tools
  return tools.filter(tool => !disallowed.includes(tool));
}

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============= ADDITIONAL ENDPOINTS =============

// Get conversation history
router.get('/conversation/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = await conversationCache.get(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear conversation
router.delete('/conversation/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await conversationCache.delete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

#### SSE Client Implementation (Frontend)

```typescript
// src/web/manager/services/sse-client.ts
export interface SSECallbacks {
  onStart?: (data: any) => void;
  onToken?: (token: string) => void;
  onThinking?: (thinking: string) => void;
  onToolUse?: (tool: any) => void;
  onToolResult?: (tool: string, result: any) => void;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

export class AgentSSEClient {
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;

  async executeAgent(
    agentId: string,
    message: string,
    callbacks: SSECallbacks,
    options?: {
      conversationId?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<void> {
    const EXPRESS_API = import.meta.env.VITE_EXPRESS_URL || 'http://localhost:3001/api';

    // Cancel any existing execution
    this.cancel();

    this.abortController = new AbortController();

    try {
      // Make POST request to start execution
      const response = await fetch(`${EXPRESS_API}/execute/agent/${agentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          ...options
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse SSE message
          const message = this.parseSSEMessage(line);
          if (message) {
            this.handleSSEMessage(message, callbacks);
          }
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Execution cancelled');
      } else {
        console.error('SSE error:', error);
        callbacks.onError?.(error);
      }
    }
  }

  private parseSSEMessage(raw: string): { event?: string; data: any } | null {
    const lines = raw.split('\n');
    let event: string | undefined;
    let data: string | undefined;

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.substring(5).trim();
      } else if (line.startsWith(':')) {
        // Comment, ignore
        continue;
      }
    }

    if (!data) return null;

    try {
      return {
        event,
        data: JSON.parse(data)
      };
    } catch {
      return null;
    }
  }

  private handleSSEMessage(message: { event?: string; data: any }, callbacks: SSECallbacks) {
    const { event, data } = message;

    switch (event) {
      case 'start':
        callbacks.onStart?.(data);
        break;
      case 'token':
        callbacks.onToken?.(data.content);
        break;
      case 'thinking':
        callbacks.onThinking?.(data.content);
        break;
      case 'tool_use':
        callbacks.onToolUse?.(data);
        break;
      case 'tool_result':
        callbacks.onToolResult?.(data.tool, data.result);
        break;
      case 'complete':
        callbacks.onComplete?.(data);
        break;
      case 'error':
        callbacks.onError?.(data);
        break;
      default:
        // Fallback for messages without event type
        if (data.type === 'token') {
          callbacks.onToken?.(data.content);
        }
    }
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

// Usage example
const sseClient = new AgentSSEClient();

await sseClient.executeAgent('agent-123', 'Hello, agent!', {
  onStart: (data) => {
    console.log('Execution started:', data);
  },
  onToken: (token) => {
    // Append token to output
    appendToken(token);
  },
  onToolUse: (tool) => {
    console.log('Tool used:', tool);
  },
  onComplete: (result) => {
    console.log('Execution complete:', result);
  },
  onError: (error) => {
    console.error('Error:', error);
  }
});
```

---

## Strapi Client Service Architecture

### Comprehensive Strapi Integration

The Strapi client service acts as a data access layer, abstracting all Strapi API calls and providing a clean interface for Express routes.

```typescript
// src/services/strapi-client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { Agent, Skill, MCPServer, Task } from '../types';
import { LRUCache } from 'lru-cache';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiEntity {
  id: number;
  attributes: any;
}

export class StrapiClient {
  private client: AxiosInstance;
  private cache: LRUCache<string, any>;

  constructor() {
    // Initialize axios client
    this.client = axios.create({
      baseURL: `${STRAPI_URL}/api`,
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Initialize cache (5 minutes TTL)
    this.cache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Strapi] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Strapi] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  // ============= HEALTH CHECK =============

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/');
      return true;
    } catch {
      return false;
    }
  }

  // ============= AGENTS =============

  async getAllAgents(options?: {
    populate?: string[];
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Promise<Agent[]> {
    const cacheKey = `agents:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const params = this.buildQueryParams(options);
    const { data } = await this.client.get<StrapiResponse<StrapiEntity[]>>('/agents', { params });

    const agents = data.data.map(this.transformAgent);
    this.cache.set(cacheKey, agents);

    return agents;
  }

  async getAgent(id: string): Promise<Agent> {
    const cacheKey = `agent:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data } = await this.client.get<StrapiResponse<StrapiEntity>>(
      `/agents/${id}?populate=*`
    );

    const agent = this.transformAgent(data.data);
    this.cache.set(cacheKey, agent);

    return agent;
  }

  async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    const { data } = await this.client.post<StrapiResponse<StrapiEntity>>('/agents', {
      data: this.prepareAgentData(agentData)
    });

    // Invalidate cache
    this.invalidateCache('agents');

    return this.transformAgent(data.data);
  }

  async updateAgent(id: string, agentData: Partial<Agent>): Promise<Agent> {
    const { data } = await this.client.put<StrapiResponse<StrapiEntity>>(`/agents/${id}`, {
      data: this.prepareAgentData(agentData)
    });

    // Invalidate cache
    this.invalidateCache('agents');
    this.cache.delete(`agent:${id}`);

    return this.transformAgent(data.data);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.client.delete(`/agents/${id}`);

    // Invalidate cache
    this.invalidateCache('agents');
    this.cache.delete(`agent:${id}`);
  }

  // ============= SKILLS =============

  async getAllSkills(options?: {
    populate?: string[];
    filters?: Record<string, any>;
  }): Promise<Skill[]> {
    const cacheKey = `skills:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const params = this.buildQueryParams(options);
    const { data } = await this.client.get<StrapiResponse<StrapiEntity[]>>('/skills', { params });

    const skills = data.data.map(this.transformSkill);
    this.cache.set(cacheKey, skills);

    return skills;
  }

  async getSkill(id: string): Promise<Skill> {
    const cacheKey = `skill:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data } = await this.client.get<StrapiResponse<StrapiEntity>>(
      `/skills/${id}?populate=*`
    );

    const skill = this.transformSkill(data.data);
    this.cache.set(cacheKey, skill);

    return skill;
  }

  async getSkillsByIds(ids: string[]): Promise<Skill[]> {
    const filters = {
      id: { $in: ids.map(id => parseInt(id)) }
    };

    return this.getAllSkills({ filters });
  }

  async createSkill(skillData: Partial<Skill>): Promise<Skill> {
    const { data } = await this.client.post<StrapiResponse<StrapiEntity>>('/skills', {
      data: this.prepareSkillData(skillData)
    });

    this.invalidateCache('skills');
    return this.transformSkill(data.data);
  }

  async updateSkill(id: string, skillData: Partial<Skill>): Promise<Skill> {
    const { data } = await this.client.put<StrapiResponse<StrapiEntity>>(`/skills/${id}`, {
      data: this.prepareSkillData(skillData)
    });

    this.invalidateCache('skills');
    this.cache.delete(`skill:${id}`);

    return this.transformSkill(data.data);
  }

  async deleteSkill(id: string): Promise<void> {
    await this.client.delete(`/skills/${id}`);
    this.invalidateCache('skills');
    this.cache.delete(`skill:${id}`);
  }

  // ============= MCP SERVERS =============

  async getAllMCPServers(options?: {
    filters?: Record<string, any>;
  }): Promise<MCPServer[]> {
    const cacheKey = `mcp-servers:all:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const params = this.buildQueryParams(options);
    const { data } = await this.client.get<StrapiResponse<StrapiEntity[]>>('/mcp-servers', { params });

    const mcpServers = data.data.map(this.transformMCPServer);
    this.cache.set(cacheKey, mcpServers);

    return mcpServers;
  }

  async getMCPServer(id: string): Promise<MCPServer> {
    const cacheKey = `mcp-server:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data } = await this.client.get<StrapiResponse<StrapiEntity>>(
      `/mcp-servers/${id}?populate=*`
    );

    const mcpServer = this.transformMCPServer(data.data);
    this.cache.set(cacheKey, mcpServer);

    return mcpServer;
  }

  async getMCPServersByIds(ids: string[]): Promise<MCPServer[]> {
    const filters = {
      id: { $in: ids.map(id => parseInt(id)) }
    };

    return this.getAllMCPServers({ filters });
  }

  async createMCPServer(mcpData: Partial<MCPServer>): Promise<MCPServer> {
    const { data } = await this.client.post<StrapiResponse<StrapiEntity>>('/mcp-servers', {
      data: this.prepareMCPServerData(mcpData)
    });

    this.invalidateCache('mcp-servers');
    return this.transformMCPServer(data.data);
  }

  async updateMCPServer(id: string, mcpData: Partial<MCPServer>): Promise<MCPServer> {
    const { data } = await this.client.put<StrapiResponse<StrapiEntity>>(`/mcp-servers/${id}`, {
      data: this.prepareMCPServerData(mcpData)
    });

    this.invalidateCache('mcp-servers');
    this.cache.delete(`mcp-server:${id}`);

    return this.transformMCPServer(data.data);
  }

  async deleteMCPServer(id: string): Promise<void> {
    await this.client.delete(`/mcp-servers/${id}`);
    this.invalidateCache('mcp-servers');
    this.cache.delete(`mcp-server:${id}`);
  }

  // ============= TRANSFORMERS =============

  private transformAgent(strapiData: StrapiEntity): Agent {
    const attrs = strapiData.attributes;

    return {
      id: strapiData.id.toString(),
      name: attrs.name,
      description: attrs.description,
      systemPrompt: attrs.systemPrompt,
      tools: attrs.tools || [],
      disallowedTools: attrs.disallowedTools || [],
      model: attrs.model,
      enabled: attrs.enabled,
      mcpServers: attrs.mcpServers?.data?.map((s: StrapiEntity) => s.id.toString()) || [],
      skills: attrs.skills?.data?.map((s: StrapiEntity) => s.id.toString()) || [],
      createdAt: attrs.createdAt,
      updatedAt: attrs.updatedAt
    };
  }

  private transformSkill(strapiData: StrapiEntity): Skill {
    const attrs = strapiData.attributes;

    return {
      id: strapiData.id.toString(),
      name: attrs.name,
      description: attrs.description,
      content: attrs.content,
      allowedTools: attrs.allowedTools || [],
      experienceScore: attrs.experienceScore || 0,
      createdAt: attrs.createdAt,
      updatedAt: attrs.updatedAt
    };
  }

  private transformMCPServer(strapiData: StrapiEntity): MCPServer {
    const attrs = strapiData.attributes;

    return {
      id: strapiData.id.toString(),
      name: attrs.name,
      command: attrs.command,
      args: attrs.args || [],
      env: attrs.env || {},
      disabled: attrs.disabled || false,
      transport: attrs.transport || 'stdio',
      createdAt: attrs.createdAt,
      updatedAt: attrs.updatedAt
    };
  }

  // ============= DATA PREPARERS =============

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

  private prepareSkillData(skill: Partial<Skill>) {
    return {
      name: skill.name,
      description: skill.description,
      content: skill.content,
      allowedTools: skill.allowedTools,
      experienceScore: skill.experienceScore
    };
  }

  private prepareMCPServerData(mcp: Partial<MCPServer>) {
    return {
      name: mcp.name,
      command: mcp.command,
      args: mcp.args,
      env: mcp.env,
      disabled: mcp.disabled,
      transport: mcp.transport
    };
  }

  // ============= QUERY BUILDERS =============

  private buildQueryParams(options?: {
    populate?: string[];
    filters?: Record<string, any>;
    sort?: string[];
    pagination?: { page: number; pageSize: number };
  }): Record<string, any> {
    const params: Record<string, any> = {};

    if (options?.populate) {
      params.populate = options.populate.join(',');
    }

    if (options?.filters) {
      params.filters = options.filters;
    }

    if (options?.sort) {
      params.sort = options.sort;
    }

    if (options?.pagination) {
      params.pagination = options.pagination;
    }

    return params;
  }

  // ============= CACHE MANAGEMENT =============

  private invalidateCache(prefix: string) {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clearCache() {
    this.cache.clear();
  }

  // ============= ERROR HANDLING =============

  private handleError(error: AxiosError) {
    if (error.response) {
      // Server responded with error status
      console.error('[Strapi] Response error:', {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      // Request made but no response
      console.error('[Strapi] No response received:', error.message);
    } else {
      // Error in request setup
      console.error('[Strapi] Request setup error:', error.message);
    }
  }
}

// Singleton instance
export const strapiClient = new StrapiClient();
```

---

## Middleware Patterns

### CORS Middleware Configuration

```typescript
// src/middleware/cors.ts
import cors from 'cors';
import { Request } from 'express';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',  // Frontend dev
  'http://localhost:3000',  // Frontend prod
  'http://localhost:1337',  // Strapi admin
  process.env.FRONTEND_URL,
  process.env.STRAPI_URL
].filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID'
  ],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
});
```

### Authentication Middleware

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
};

// Optional auth middleware (allows both authenticated and public access)
export const optionalAuthMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
  } catch {
    // Invalid token, but continue anyway
  }

  next();
};
```

### Error Handling Middleware

```typescript
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AxiosError } from 'axios';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  // Zod validation error
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Axios/Strapi error
  if (error instanceof AxiosError) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message;

    return res.status(status).json({
      error: 'Strapi API Error',
      message,
      details: error.response?.data
    });
  }

  // Custom app error
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      operational: error.isOperational
    });
  }

  // Unknown error
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Request Logging Middleware

```typescript
// src/middleware/logger.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface LogRequest extends Request {
  id?: string;
  startTime?: number;
}

export const requestLogger = (
  req: LogRequest,
  res: Response,
  next: NextFunction
) => {
  // Generate request ID
  req.id = uuidv4();
  req.startTime = Date.now();

  // Log request
  console.log(`[${req.id}] ${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    console.log(`[${req.id}] ${res.statusCode} ${req.method} ${req.path} - ${duration}ms`);
  });

  // Add request ID to response header
  res.setHeader('X-Request-ID', req.id);

  next();
};
```

### Rate Limiting Middleware

```typescript
// src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Redis client for distributed rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect().catch(console.error);

// General API rate limiter
export const apiRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Execution endpoint rate limiter (more strict)
export const executionRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:execute:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 executions per minute
  message: {
    error: 'Too many agent executions',
    message: 'Please wait before executing again'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});
```

---

## Route Organization & Integration

### Manager Routes (CRUD Proxy to Strapi)

```typescript
// src/routes/manager.routes.ts
import express from 'express';
import { strapiClient } from '../services/strapi-client';
import { asyncHandler } from '../middleware/error-handler';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();

// ============= VALIDATION SCHEMAS =============

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  systemPrompt: z.string().min(10),
  tools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  model: z.enum(['sonnet', 'opus', 'haiku', 'sonnet-4', 'opus-4']),
  enabled: z.boolean().optional(),
  mcpServers: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional()
});

const updateAgentSchema = createAgentSchema.partial();

// ============= AGENTS =============

// List all agents
router.get('/agents', optionalAuthMiddleware, asyncHandler(async (req, res) => {
  const { enabled, search, sort, page = 1, pageSize = 20 } = req.query;

  const filters: any = {};

  if (enabled !== undefined) {
    filters.enabled = enabled === 'true';
  }

  if (search) {
    filters.$or = [
      { name: { $containsi: search } },
      { description: { $containsi: search } }
    ];
  }

  const agents = await strapiClient.getAllAgents({
    filters,
    sort: sort ? [sort as string] : ['createdAt:desc'],
    pagination: {
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string)
    },
    populate: ['skills', 'mcpServers']
  });

  res.json({
    data: agents,
    meta: {
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string)
    }
  });
}));

// Get single agent
router.get('/agents/:id', optionalAuthMiddleware, asyncHandler(async (req, res) => {
  const agent = await strapiClient.getAgent(req.params.id);
  res.json(agent);
}));

// Create agent
router.post('/agents', authMiddleware, asyncHandler(async (req, res) => {
  const validated = createAgentSchema.parse(req.body);
  const agent = await strapiClient.createAgent(validated);
  res.status(201).json(agent);
}));

// Update agent
router.put('/agents/:id', authMiddleware, asyncHandler(async (req, res) => {
  const validated = updateAgentSchema.parse(req.body);
  const agent = await strapiClient.updateAgent(req.params.id, validated);
  res.json(agent);
}));

// Delete agent
router.delete('/agents/:id', authMiddleware, asyncHandler(async (req, res) => {
  await strapiClient.deleteAgent(req.params.id);
  res.status(204).send();
}));

// ============= SKILLS =============

router.get('/skills', optionalAuthMiddleware, asyncHandler(async (req, res) => {
  const skills = await strapiClient.getAllSkills();
  res.json(skills);
}));

router.get('/skills/:id', optionalAuthMiddleware, asyncHandler(async (req, res) => {
  const skill = await strapiClient.getSkill(req.params.id);
  res.json(skill);
}));

router.post('/skills', authMiddleware, asyncHandler(async (req, res) => {
  const skill = await strapiClient.createSkill(req.body);
  res.status(201).json(skill);
}));

router.put('/skills/:id', authMiddleware, asyncHandler(async (req, res) => {
  const skill = await strapiClient.updateSkill(req.params.id, req.body);
  res.json(skill);
}));

router.delete('/skills/:id', authMiddleware, asyncHandler(async (req, res) => {
  await strapiClient.deleteSkill(req.params.id);
  res.status(204).send();
}));

// ============= MCP SERVERS =============

router.get('/mcp-servers', optionalAuthMiddleware, asyncHandler(async (req, res) => {
  const mcpServers = await strapiClient.getAllMCPServers();
  res.json(mcpServers);
}));

router.get('/mcp-servers/:id', optionalAuthMiddleware, asyncHandler(async (req, res) => {
  const mcpServer = await strapiClient.getMCPServer(req.params.id);
  res.json(mcpServer);
}));

router.post('/mcp-servers', authMiddleware, asyncHandler(async (req, res) => {
  const mcpServer = await strapiClient.createMCPServer(req.body);
  res.status(201).json(mcpServer);
}));

router.put('/mcp-servers/:id', authMiddleware, asyncHandler(async (req, res) => {
  const mcpServer = await strapiClient.updateMCPServer(req.params.id, req.body);
  res.json(mcpServer);
}));

router.delete('/mcp-servers/:id', authMiddleware, asyncHandler(async (req, res) => {
  await strapiClient.deleteMCPServer(req.params.id);
  res.status(204).send();
}));

export default router;
```

---

## Hybrid Architecture Deep Dive

### Architecture Benefits

The hybrid architecture provides clear separation of concerns:

| Aspect | Express | Strapi |
|--------|---------|--------|
| **Real-time** | ✅ SSE streaming | ❌ Not supported |
| **CRUD API** | ⚠️ Manual | ✅ Auto-generated |
| **Admin UI** | ❌ Custom build | ✅ Built-in |
| **Business Logic** | ✅ Full control | ⚠️ Limited |
| **Custom Services** | ✅ Flexible | ⚠️ Plugin-based |
| **Streaming** | ✅ Native | ❌ Not available |
| **Data Management** | ⚠️ Manual | ✅ Automated |

### Communication Flow

```
Frontend Request Flow:
======================

1. CRUD Operations (Agent Management):
   Frontend → Strapi API (1337) → PostgreSQL
   ✓ Direct communication
   ✓ No Express involvement
   ✓ Fast and simple

2. Agent Execution (SSE):
   Frontend → Express API (3001) → Strapi API → PostgreSQL
                    ↓
              Claude SDK
                    ↓
              SSE Stream → Frontend
   ✓ Express fetches agent config from Strapi
   ✓ Express executes with Claude SDK
   ✓ Express streams results via SSE

3. MCP Lifecycle:
   Frontend → Express API (3001) → MCP Service
                    ↓
              MCP Servers (stdio/sse)
   ✓ Express manages MCP server processes
   ✓ Express provides MCP status
```

### Data Synchronization

```typescript
// src/services/sync-service.ts
import { strapiClient } from './strapi-client';
import { mcpService } from './mcp-service';
import { EventEmitter } from 'events';

export class SyncService extends EventEmitter {
  private syncInterval: NodeJS.Timeout | null = null;

  // Start periodic sync with Strapi
  start(intervalMs: number = 60000) {
    console.log(`Starting sync service (interval: ${intervalMs}ms)`);

    this.syncInterval = setInterval(() => {
      this.syncMCPServers();
    }, intervalMs);

    // Initial sync
    this.syncMCPServers();
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sync MCP servers from Strapi
  private async syncMCPServers() {
    try {
      const mcpServers = await strapiClient.getAllMCPServers();

      // Start enabled servers
      for (const server of mcpServers) {
        if (!server.disabled && !mcpService.isRunning(server.id)) {
          console.log(`Starting MCP server: ${server.name}`);
          await mcpService.start(server);
        }
      }

      // Stop disabled servers
      const runningServers = mcpService.getRunningServers();
      for (const serverId of runningServers) {
        const server = mcpServers.find(s => s.id === serverId);
        if (!server || server.disabled) {
          console.log(`Stopping MCP server: ${serverId}`);
          await mcpService.stop(serverId);
        }
      }

      this.emit('sync:complete', { mcpServers });
    } catch (error) {
      console.error('Sync error:', error);
      this.emit('sync:error', error);
    }
  }
}

export const syncService = new SyncService();
```

---

## Production Deployment

### Environment Configuration

```env
# .env.production (Express)
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Strapi connection
STRAPI_URL=http://strapi:1337
STRAPI_API_TOKEN=<production-token>

# Anthropic
ANTHROPIC_API_KEY=<api-key>

# Redis (for caching & rate limiting)
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=<strong-secret>
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/express/app.log

# Performance
MAX_CONNECTIONS=100
KEEP_ALIVE_TIMEOUT=65000
```

### Docker Configuration

```dockerfile
# Dockerfile.express
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy dependencies and built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/server.js"]
```

### Docker Compose (Complete Stack)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: claude-postgres
    environment:
      POSTGRES_DB: claude_agent_ui
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  redis:
    image: redis:7-alpine
    container_name: claude-redis
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

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
      NODE_ENV: production
    ports:
      - "1337:1337"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend/public/uploads:/opt/app/public/uploads
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:1337/_health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - backend

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
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3001:3001"
    depends_on:
      strapi:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/var/log/express
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - backend
      - frontend

  nginx:
    image: nginx:alpine
    container_name: claude-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - express
      - strapi
    networks:
      - frontend

volumes:
  postgres_data:
  redis_data:

networks:
  backend:
  frontend:
```

### Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream express_backend {
        server express:3001;
    }

    upstream strapi_backend {
        server strapi:1337;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=execute_limit:10m rate=1r/s;

    server {
        listen 80;
        server_name yourdomain.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Express API (SSE streaming)
        location /api/execute {
            proxy_pass http://express_backend;
            proxy_http_version 1.1;

            # SSE-specific settings
            proxy_set_header Connection '';
            proxy_set_header Cache-Control 'no-cache';
            proxy_set_header X-Accel-Buffering 'no';
            proxy_buffering off;

            # Timeouts
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;

            # Headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Rate limiting
            limit_req zone=execute_limit burst=5;
        }

        # Express API (other endpoints)
        location /api/ {
            proxy_pass http://express_backend;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Rate limiting
            limit_req zone=api_limit burst=20;
        }

        # Strapi Admin
        location /admin {
            proxy_pass http://strapi_backend;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Strapi API (direct access)
        location /strapi/ {
            proxy_pass http://strapi_backend/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            limit_req zone=api_limit burst=20;
        }

        # Frontend (if serving from nginx)
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

---

## Performance Optimization

### Caching Strategy

```typescript
// src/services/cache-service.ts
import { LRUCache } from 'lru-cache';
import { createClient } from 'redis';

export class CacheService {
  private memoryCache: LRUCache<string, any>;
  private redisClient: ReturnType<typeof createClient>;

  constructor() {
    // Memory cache (fast, per-instance)
    this.memoryCache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Redis cache (distributed, shared across instances)
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.redisClient.connect();
  }

  // Get from cache (tries memory first, then Redis)
  async get(key: string): Promise<any | null> {
    // Try memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached !== undefined) {
      return memCached;
    }

    // Try Redis
    try {
      const redisCached = await this.redisClient.get(key);
      if (redisCached) {
        const parsed = JSON.parse(redisCached);
        // Store in memory cache for faster subsequent access
        this.memoryCache.set(key, parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Redis get error:', error);
    }

    return null;
  }

  // Set in cache (both memory and Redis)
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    // Set in memory cache
    this.memoryCache.set(key, value, { ttl: ttlSeconds * 1000 });

    // Set in Redis
    try {
      await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  // Delete from cache
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  // Clear all caches
  async clear(): Promise<void> {
    this.memoryCache.clear();

    try {
      await this.redisClient.flushAll();
    } catch (error) {
      console.error('Redis flush error:', error);
    }
  }
}

export const cacheService = new CacheService();
```

---

## Security Considerations

### API Token Security

```typescript
// src/middleware/security.ts
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// Helmet configuration
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.STRAPI_URL || 'http://localhost:1337']
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Input sanitization
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};
```

---

## Testing Strategy

### Integration Tests

```typescript
// tests/integration/agent-execution.test.ts
import request from 'supertest';
import app from '../../src/server';
import { strapiClient } from '../../src/services/strapi-client';

describe('Agent Execution', () => {
  let agentId: string;

  beforeAll(async () => {
    // Create test agent
    const agent = await strapiClient.createAgent({
      name: 'Test Agent',
      systemPrompt: 'You are a test agent',
      model: 'sonnet',
      enabled: true
    });
    agentId = agent.id;
  });

  afterAll(async () => {
    // Cleanup
    await strapiClient.deleteAgent(agentId);
  });

  it('should execute agent with SSE streaming', (done) => {
    const events: any[] = [];

    request(app)
      .post(`/api/execute/agent/${agentId}`)
      .send({ message: 'Hello, test!' })
      .set('Accept', 'text/event-stream')
      .buffer(false)
      .parse((res, callback) => {
        res.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.startsWith('data:')) {
            events.push(JSON.parse(data.substring(5)));
          }
        });
        res.on('end', () => callback(null, events));
      })
      .end((err, res) => {
        expect(err).toBeNull();
        expect(events).toContainEqual(
          expect.objectContaining({ type: 'start' })
        );
        expect(events).toContainEqual(
          expect.objectContaining({ type: 'complete' })
        );
        done();
      });
  }, 30000); // 30 second timeout
});
```

---

## Summary

This Express.js architecture analysis demonstrates a **production-ready hybrid approach** that:

✅ **Preserves Express strengths**: SSE streaming, custom logic, real-time capabilities
✅ **Leverages Strapi strengths**: Auto-generated CRUD, admin panel, data management
✅ **Maintains separation of concerns**: Clear boundaries between layers
✅ **Ensures scalability**: PostgreSQL, Redis, distributed architecture
✅ **Provides security**: Authentication, rate limiting, input validation
✅ **Enables monitoring**: Logging, health checks, error tracking

### Key Takeaways

1. **SSE Streaming**: Express is the perfect platform for SSE, keeping execution logic isolated
2. **Strapi Client**: Clean abstraction layer with caching for optimal performance
3. **Middleware Stack**: Comprehensive security, logging, and error handling
4. **Hybrid Benefits**: Best of both worlds - Express for real-time, Strapi for data
5. **Production Ready**: Docker, Nginx, monitoring, and graceful shutdown

---

**Author:** Claude Code Assistant
**Version:** 1.0
**Last Updated:** 2025-10-31
