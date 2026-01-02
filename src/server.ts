import express, { Express } from 'express';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import { createLogger, type Logger } from './services/logger.js';
import { ConfigService } from './services/config-service.js';
import { chatLogService } from './services/chat-log-service.js';
import { initializeFlowSystem } from './services/flow-init.js';
import { createManagerRoutes } from './routes/manager.routes.js';
import { createStrapiManagerRoutes } from './routes/manager.routes.strapi.js';
import { createExecutionRoutes } from './routes/execution.routes.js';
import { createFlowRoutes } from './routes/flow.routes.js';
import { createWebhookRoutes } from './routes/webhook.routes.js';
import taskRoutes from './routes/task.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';

// Get the directory of this module for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Claude Agent UI Server
 * Minimal Express server for managing Claude agents, skills, and MCP servers
 */
export class AgentUIServer {
  private app: Express;
  private server?: import('http').Server;
  private logger: Logger;
  private port: number;
  private host: string;

  constructor(config?: { port?: number; host?: string }) {
    this.app = express();
    this.logger = createLogger('AgentUIServer');

    // Configuration with defaults
    this.port = config?.port ?? parseInt(process.env.PORT ?? '3001', 10);
    this.host = config?.host ?? process.env.HOST ?? '0.0.0.0';

    this.logger.info('Initializing Claude Agent UI Server', {
      port: this.port,
      host: this.host,
      nodeEnv: process.env.NODE_ENV
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Get the Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get the configured port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the configured host
   */
  getHost(): string {
    return this.host;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    this.logger.info('Starting Claude Agent UI Server...');

    // Initialize ConfigService
    try {
      const configService = ConfigService.getInstance();
      await configService.initialize();
      this.logger.info('ConfigService initialized successfully');
    } catch (error) {
      this.logger.warn('Failed to initialize ConfigService', error);
      // Don't fail server start if config initialization fails
    }

    // Initialize Chat Log Service
    try {
      await chatLogService.init();
      this.logger.info('ChatLogService initialized successfully');
    } catch (error) {
      this.logger.warn('Failed to initialize ChatLogService', error);
      // Don't fail server start if log service initialization fails
    }

    // Initialize Flow Execution System
    try {
      const flowInitialized = await initializeFlowSystem({
        workingDirectory: process.cwd(),
      });
      if (flowInitialized) {
        this.logger.info('Flow execution system initialized successfully');
      } else {
        this.logger.warn('Flow execution system initialization returned false');
      }
    } catch (error) {
      this.logger.warn('Failed to initialize Flow execution system', error);
      // Don't fail server start if flow system initialization fails
    }

    return new Promise<void>((resolve, reject) => {
      this.server = this.app.listen(this.port, this.host, () => {
        this.logger.info(`🚀 Claude Agent UI Server running at http://${this.host}:${this.port}`);
        this.logger.info(`📱 Manager UI: http://localhost:${this.port}/manager`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        this.logger.error('Failed to start HTTP server:', {
          error: error.message,
          code: (error as any).code,
          port: this.port,
          host: this.host
        });
        reject(error);
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Claude Agent UI Server...');

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.logger.info('Server stopped successfully');
          resolve();
        });
      });
    }
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001']
        : true,
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Static file serving for production
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      const staticPath = path.join(__dirname, 'web');
      this.logger.info('Serving static files from:', staticPath);
      this.app.use(express.static(staticPath));
    }

    // Request logging (use new centralized logger middleware)
    this.app.use(requestLogger);
  }

  private setupRoutes(): void {
    // Health check endpoint - validates Express and Strapi connectivity
    this.app.get('/health', async (req, res) => {
      const healthStatus: any = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          express: {
            status: 'healthy',
          },
          strapi: {
            status: 'unknown',
            database: {
              connected: false,
            },
          },
        },
      };

      try {
        // Check Strapi connectivity and database health
        const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (strapiToken) {
          headers['Authorization'] = `Bearer ${strapiToken}`;
        }

        // Query Strapi health endpoint with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
          const response = await fetch(`${strapiUrl}/_health`, {
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.ok) {
            const strapiHealth = await response.json();
            healthStatus.services.strapi = {
              status: strapiHealth.status || 'healthy',
              database: strapiHealth.database || { connected: false },
              pool: strapiHealth.pool,
              responseTime: strapiHealth.responseTime,
            };
          } else {
            healthStatus.services.strapi.status = 'unhealthy';
            healthStatus.status = 'degraded';
          }
        } catch (fetchError) {
          clearTimeout(timeout);
          healthStatus.services.strapi.status = 'unreachable';
          healthStatus.services.strapi.error = fetchError.message;
          healthStatus.status = 'degraded';
        }

        // Return appropriate status code
        const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthStatus);
      } catch (error) {
        this.logger.error('Health check failed:', error);
        healthStatus.status = 'unhealthy';
        healthStatus.error = error.message;
        res.status(503).json(healthStatus);
      }
    });

    // Quick endpoints for getting agents and skills lists
    this.app.get('/api/agents', async (req, res) => {
      try {
        const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (strapiToken) {
          headers['Authorization'] = `Bearer ${strapiToken}`;
        }

        const response = await fetch(`${strapiUrl}/api/agents`, { headers });
        const data = await response.json();

        res.json({ agents: data.data });
      } catch (error) {
        this.logger.error('Failed to get agents', error);
        res.status(500).json({ error: 'Failed to get agents' });
      }
    });

    this.app.get('/api/skills', async (req, res) => {
      try {
        const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (strapiToken) {
          headers['Authorization'] = `Bearer ${strapiToken}`;
        }

        const response = await fetch(`${strapiUrl}/api/skills`, { headers });
        const data = await response.json();

        res.json({ skills: data.data });
      } catch (error) {
        this.logger.error('Failed to get skills', error);
        res.status(500).json({ error: 'Failed to get skills' });
      }
    });

    // Manager API routes (file system based - legacy)
    this.app.use('/api/manager', createManagerRoutes());

    // Strapi Manager API routes (CRUD operations via Strapi)
    this.app.use('/api/strapi', createStrapiManagerRoutes());

    // Execution API routes (SSE streaming for agent execution)
    this.app.use('/api/execute', createExecutionRoutes());

    // Task API routes
    this.app.use('/api/tasks', taskRoutes);

    // Chat API routes
    this.app.use('/api/chat', chatRoutes);

    // Flow API routes (flow management and execution with SSE)
    this.app.use('/api/flows', createFlowRoutes());

    // Webhook API routes (external triggers for flows)
    this.app.use('/api/webhooks', createWebhookRoutes());

    // React Router catch-all - must be after all API routes
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'web', 'index.html'));
      });
    }

    // 404 handler (must be before error handler)
    this.app.use(notFoundHandler);

    // Global error handling middleware (must be last)
    this.app.use(errorHandler);
  }
}

// CLI entry point
// Check if this file is being run directly (works on both Windows and Unix)
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const server = new AgentUIServer();

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}
