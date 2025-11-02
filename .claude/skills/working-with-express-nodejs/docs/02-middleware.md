# Express Middleware

**Topic:** Middleware Patterns and Best Practices
**Created:** 2025-10-31

---

## What is Middleware?

Middleware functions have access to request, response, and next function in the application's request-response cycle.

```typescript
function middleware(req: Request, res: Response, next: NextFunction) {
  // Do something
  next(); // Pass to next middleware
}
```

## Built-in Middleware

```typescript
import express from 'express';

const app = express();

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));
```

## CORS Middleware

```typescript
import cors from 'cors';

// Basic CORS
app.use(cors());

// Configured CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Custom Logging Middleware

```typescript
const logger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
};

app.use(logger);
```

## Authentication Middleware

```typescript
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Use on specific routes
app.get('/api/protected', authenticate, (req, res) => {
  res.json({ user: req.user });
});
```

## Validation Middleware

```typescript
const validateAgent = (req: Request, res: Response, next: NextFunction) => {
  const { name, systemPrompt } = req.body;

  if (!name || !systemPrompt) {
    return res.status(400).json({
      error: 'name and systemPrompt are required'
    });
  }

  next();
};

app.post('/api/agents', validateAgent, (req, res) => {
  // Create agent
});
```

## Error Handling Middleware

```typescript
// Must be defined LAST, after all routes
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);

  res.status(err.statusCode || 500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});
```

## Middleware Order

```typescript
import express from 'express';
import cors from 'cors';

const app = express();

// 1. CORS (before routes)
app.use(cors());

// 2. Body parsing
app.use(express.json());

// 3. Logging
app.use(logger);

// 4. Authentication (optional)
app.use('/api/protected', authenticate);

// 5. Routes
app.use('/api', routes);

// 6. Error handling (LAST)
app.use(errorHandler);
```

## Async Middleware

```typescript
const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

app.get('/api/agents/:id', asyncHandler(async (req, res) => {
  const agent = await getAgent(req.params.id);
  res.json(agent);
}));
```

## Best Practices

1. **Order matters** - middleware executes in order
2. **Always call next()** unless sending response
3. **Error handling middleware last** - must have 4 parameters
4. **Use async handlers** for async operations
5. **Validate input early** - before processing
6. **Log requests** for debugging
7. **Handle CORS properly** - especially for SSE
