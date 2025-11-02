# Express.js Basics

**Topic:** Getting Started with Express
**Created:** 2025-10-31

---

## Installation

```bash
npm install express
npm install --save-dev @types/express typescript
```

## Basic Server

```typescript
import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Express!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Routing

```typescript
// Route parameters
app.get('/agent/:id', (req, res) => {
  const { id } = req.params;
  res.json({ agentId: id });
});

// Query strings
app.get('/search', (req, res) => {
  const { query, limit } = req.query;
  res.json({ query, limit });
});

// POST with body
app.post('/agents', (req, res) => {
  const agentData = req.body;
  res.status(201).json({ created: true, data: agentData });
});
```

## Express Router

```typescript
import { Router } from 'express';

const router = Router();

router.get('/agents', (req, res) => {
  // Get all agents
});

router.post('/agents', (req, res) => {
  // Create agent
});

router.get('/agents/:id', (req, res) => {
  // Get single agent
});

export default router;
```

## Using Router in App

```typescript
import agentRoutes from './routes/agents';

app.use('/api', agentRoutes);
```

## Error Handling

```typescript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});
```

## Environment Variables

```typescript
import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: process.env.PORT || 3001,
  strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
  apiKey: process.env.ANTHROPIC_API_KEY
};
```

## Best Practices

1. Use TypeScript for type safety
2. Separate routes into modules
3. Use middleware for common tasks
4. Handle errors properly
5. Validate request data
6. Use environment variables
7. Enable CORS when needed
