/**
 * Express Error Handling Middleware
 *
 * Centralized error handling for all Express routes including:
 * - Zod validation errors
 * - Axios/Strapi API errors
 * - Custom application errors
 * - Generic errors
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AxiosError } from 'axios';
import { createLogger } from '../services/logger.js';

const logger = createLogger('ErrorHandler');

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Global error handling middleware
 * Must be registered as the last middleware in the Express app
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    type: error.constructor.name
  });

  // Zod validation error
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
    });
  }

  // Axios/Strapi API error
  if (error instanceof AxiosError) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message;

    return res.status(status).json({
      error: 'Strapi API Error',
      message,
      details: process.env.NODE_ENV === 'development' ? error.response?.data : undefined
    });
  }

  // Custom app error
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      operational: error.isOperational,
      details: error.details
    });
  }

  // Unknown/unexpected error
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass to error middleware
 *
 * Usage:
 * router.get('/route', asyncHandler(async (req, res) => {
 *   // async code here
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 * Should be registered before the error handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    path: req.path,
    method: req.method
  });
};
