/**
 * Health check controller
 * Validates database connectivity and connection pool health
 */

import type { Core } from '@strapi/strapi';

export default {
  /**
   * Health check endpoint that validates database connectivity
   * Returns detailed health information including:
   * - Database connection status
   * - Connection pool statistics
   * - System uptime
   */
  async index(ctx: Core.Context) {
    const startTime = Date.now();
    const healthStatus: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: false,
        responseTime: 0,
      },
      pool: {
        numUsed: 0,
        numFree: 0,
        numPendingAcquires: 0,
        numPendingCreates: 0,
      },
    };

    try {
      // Get database connection
      const db = strapi.db.connection;

      // Test database connectivity with a simple query
      const queryStartTime = Date.now();
      await db.raw('SELECT 1 as health_check');
      const queryEndTime = Date.now();

      healthStatus.database.connected = true;
      healthStatus.database.responseTime = queryEndTime - queryStartTime;

      // Get connection pool statistics if available
      if (db.pool) {
        healthStatus.pool = {
          numUsed: db.pool.numUsed?.() || 0,
          numFree: db.pool.numFree?.() || 0,
          numPendingAcquires: db.pool.numPendingAcquires?.() || 0,
          numPendingCreates: db.pool.numPendingCreates?.() || 0,
        };
      }

      // Calculate total health check time
      const totalTime = Date.now() - startTime;
      healthStatus.responseTime = totalTime;

      // Return 200 OK with health status
      ctx.status = 200;
      ctx.body = healthStatus;
    } catch (error) {
      // Database connection failed
      healthStatus.status = 'unhealthy';
      healthStatus.database.error = error.message;
      healthStatus.responseTime = Date.now() - startTime;

      // Return 503 Service Unavailable
      ctx.status = 503;
      ctx.body = healthStatus;

      // Log the error
      strapi.log.error('Health check failed:', error);
    }
  },

  /**
   * Readiness check endpoint
   * Returns 200 if the service is ready to accept requests
   */
  async ready(ctx: Core.Context) {
    try {
      // Check if database is accessible
      const db = strapi.db.connection;
      await db.raw('SELECT 1 as readiness_check');

      ctx.status = 200;
      ctx.body = {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      ctx.status = 503;
      ctx.body = {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
      strapi.log.error('Readiness check failed:', error);
    }
  },

  /**
   * Liveness check endpoint
   * Returns 200 if the service is alive (process is running)
   */
  async live(ctx: Core.Context) {
    ctx.status = 200;
    ctx.body = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  },
};
