# Server-Sent Events (SSE) in Express

**Topic:** Real-time Streaming
**Created:** 2025-10-31

---

## What is SSE?

Server-Sent Events (SSE) is a server push technology enabling servers to push data to clients over HTTP.

**Use Case:** Streaming Claude Agent responses in real-time.

## Basic SSE Implementation

```typescript
import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/stream', (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Send headers immediately

  // Send data
  res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

  // Simulate streaming
  let count = 0;
  const interval = setInterval(() => {
    count++;
    res.write(`data: ${JSON.stringify({ type: 'token', content: `Token ${count}` })}\n\n`);

    if (count >= 10) {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }
  }, 100);

  // Client disconnect handling
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});
```

## SSE Format

```
data: {"type": "start"}\n\n
data: {"type": "token", "content": "Hello"}\n\n
data: {"type": "token", "content": " World"}\n\n
data: {"type": "done"}\n\n
```

- Each message starts with `data:`
- Messages end with `\n\n` (two newlines)
- JSON is common for structured data

## Claude Agent SSE Integration

```typescript
import { strapiClient } from '../services/strapi-client';
import { claudeSDKService } from '../services/claude-sdk-service';

router.post('/agent/:id/execute', async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    // Get agent from Strapi
    const agent = await strapiClient.getAgent(id);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Execute with streaming
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
```

## Client-Side Consumption

```typescript
// Frontend: React/TypeScript
const eventSource = new EventSource('/api/agent/123/execute', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello' })
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'start':
      console.log('Stream started');
      break;
    case 'token':
      appendToken(data.content);
      break;
    case 'tool_use':
      console.log('Tool used:', data.tool);
      break;
    case 'complete':
      console.log('Complete:', data.result);
      eventSource.close();
      break;
    case 'error':
      console.error('Error:', data.error);
      eventSource.close();
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

## Best Practices

1. **Always set headers before any data**
2. **Handle client disconnect** (`req.on('close')`)
3. **End response properly** (`res.end()`)
4. **Use JSON for structured data**
5. **Implement error handling**
6. **Set reasonable timeouts**
7. **Test with long-running operations**

## CORS for SSE

```typescript
import cors from 'cors';

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Why SSE for Claude Agent UI?

- ✅ Real-time token streaming
- ✅ Unidirectional (server → client)
- ✅ Automatic reconnection
- ✅ Simpler than WebSockets
- ✅ Works over HTTP
- ✅ No additional protocols needed
