/**
 * Express Request Logging Middleware
 *
 * Logs incoming requests and outgoing responses with:
 * - Request ID generation
 * - Request timing
 * - Request/response details
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { createLogger } from '../services/logger.js';

const logger = createLogger('RequestLogger');

/**
 * Extended Request interface with logging properties
 */
export interface LogRequest extends Request {
  id?: string;
  startTime?: number;
}

/**
 * Request logging middleware
 * Generates a unique ID for each request and logs request/response details
 */
export const requestLogger = (
  req: LogRequest,
  res: Response,
  next: NextFunction
) => {
  // Generate unique request ID
  req.id = randomUUID();
  req.startTime = Date.now();

  // Skip logging for health checks (too noisy)
  const skipPaths = ['/health', '/favicon.ico'];
  if (skipPaths.includes(req.path)) {
    return next();
  }

  // Log incoming request
  logger.debug(`[${req.id}] ${req.method} ${req.path}`, {
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.method !== 'GET' && Object.keys(req.body || {}).length > 0 ? '(body present)' : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    const logLevel = res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'info';

    logger[logLevel](`[${req.id}] ${res.statusCode} ${req.method} ${req.path} - ${duration}ms`, {
      statusCode: res.statusCode,
      contentLength: res.get('content-length'),
      duration: `${duration}ms`
    });
  });

  // Add request ID to response header
  res.setHeader('X-Request-ID', req.id);

  next();
};

/**
 * Minimal request logger for production
 * Only logs errors and slow requests
 */
export const minimalRequestLogger = (
  req: LogRequest,
  res: Response,
  next: NextFunction
) => {
  req.id = randomUUID();
  req.startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);

    // Only log errors or slow requests (> 1 second)
    if (res.statusCode >= 400 || duration > 1000) {
      logger.warn(`[${req.id}] ${res.statusCode} ${req.method} ${req.path} - ${duration}ms`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        slow: duration > 1000
      });
    }
  });

  res.setHeader('X-Request-ID', req.id);
  next();
};
