---
name: working-with-express-nodejs
description: Comprehensive Express.js and Node.js documentation covering routing, middleware, SSE (Server-Sent Events), error handling, TypeScript integration, API design, and integration with Strapi. Use when building Express APIs, implementing SSE streaming for Claude agents, creating custom middleware, handling CORS, or integrating Express with Strapi in a hybrid architecture.
---

# Express.js & Node.js Expert

Express.js reference for building APIs with SSE streaming and Strapi integration.

## What This Skill Covers

- **Routing**: Express routing, route parameters, query strings
- **Middleware**: Built-in middleware, custom middleware, error handling
- **SSE Streaming**: Server-Sent Events for real-time Claude agent responses
- **Integration**: Express + Strapi hybrid architecture
- **TypeScript**: Type-safe Express with TypeScript
- **Production**: Error handling, logging, security

## Quick Reference

### Common Tasks

**Express Basics & Routing**
→ See [docs/01-express-basics.md](docs/01-express-basics.md)

**Middleware Patterns**
→ See [docs/02-middleware.md](docs/02-middleware.md)

**SSE Streaming (for Claude Agents)**
→ See [docs/03-sse-streaming.md](docs/03-sse-streaming.md)

**Strapi Integration Patterns**
→ See [docs/04-integration-patterns.md](docs/04-integration-patterns.md)

---

## For Migration Project

### Hybrid Architecture Pattern

**Express Responsibilities:**
- ✅ SSE streaming for agent execution
- ✅ Claude SDK integration
- ✅ MCP server lifecycle
- ✅ Real-time events
- ✅ File operations

**Strapi Responsibilities:**
- ✅ CRUD operations (agents, skills, MCP servers)
- ✅ Admin panel
- ✅ Authentication
- ✅ Data validation

### SSE Implementation

From [docs/03-sse-streaming.md](docs/03-sse-streaming.md):

```typescript
router.post('/agent/:id/execute', async (req, res) => {
  const agent = await strapiClient.getAgent(req.params.id);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  await claudeSDKService.executeAgent(agent, message, {
    onToken: (token) => {
      res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
    },
    onComplete: (result) => {
      res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
      res.end();
    }
  });
});
```

---

## Key Concepts

### Middleware Chain

```typescript
app.use(cors());           // CORS handling
app.use(express.json());   // Body parsing
app.use(logger);           // Logging
app.use('/api', routes);   // Routes
app.use(errorHandler);     // Error handling
```

### Error Handling

```typescript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});
```

### TypeScript Integration

```typescript
import express, { Request, Response, NextFunction } from 'express';

interface TypedRequest<T> extends Request {
  body: T;
}

router.post('/agents', async (
  req: TypedRequest<CreateAgentDTO>,
  res: Response
) => {
  // Type-safe!
});
```

---

## Best Practices

1. **Use middleware for cross-cutting concerns**
2. **Implement proper error handling**
3. **Enable CORS correctly**
4. **Use TypeScript for type safety**
5. **Handle SSE client disconnects**
6. **Set appropriate timeouts**
7. **Use async/await over callbacks**
8. **Validate request data**
9. **Implement rate limiting**
10. **Use environment variables**

---

## Resources

- **Express.js**: https://expressjs.com/
- **Node.js**: https://nodejs.org/docs/

---

## Tips

- **SSE is simpler than WebSockets** for unidirectional streaming
- **Always flush headers** before sending SSE data
- **Handle client disconnect** to clean up resources
- **Use compression** but not for SSE endpoints
- **Test SSE with long-running operations**
