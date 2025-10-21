import { Request, Response, NextFunction } from 'express';
// TODO: Import from utils/logger when available
// import { logger } from '../utils/logger';
// TODO: Import custom error classes when available
// import {
//   ValidationError,
//   AuthenticationError,
//   AuthorizationError,
//   NotFoundError,
//   ConflictError,
//   DatabaseError,
//   ExternalAPIError
// } from '../utils/errors';

/**
 * Custom error types for proper error handling
 * TODO: Move these to ../utils/errors.ts when created
 */
class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class ExternalAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ExternalAPIError';
  }
}

/**
 * Error response structure for consistent API responses
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Global Error Handler Middleware
 *
 * Catches all errors thrown by routes, controllers, and services.
 * Formats consistent JSON error responses and logs errors for monitoring.
 *
 * @param error The error object thrown by upstream middleware
 * @param req Express request object
 * @param res Express response object
 * @param next Next middleware function (required by Express error handler signature)
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // TODO: Replace with actual logger when available
  const logger = {
    error: (message: string, meta?: object) => console.error(message, meta),
    warn: (message: string, meta?: object) => console.warn(message, meta),
    info: (message: string, meta?: object) => console.info(message, meta)
  };

  // Log the error for monitoring and debugging
  logger.error('Request error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Determine response based on error type
  let statusCode: number;
  let errorCode: string;
  let message: string;
  let details: unknown = undefined;

  if (error instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = error.message;
    details = error.details;
  } else if (error instanceof AuthenticationError) {
    statusCode = 401;
    errorCode = 'AUTHENTICATION_ERROR';
    message = error.message;
  } else if (error instanceof AuthorizationError) {
    statusCode = 403;
    errorCode = 'AUTHORIZATION_ERROR';
    message = error.message;
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    errorCode = 'NOT_FOUND_ERROR';
    message = error.message;
  } else if (error instanceof ConflictError) {
    statusCode = 409;
    errorCode = 'CONFLICT_ERROR';
    message = error.message;
  } else if (error instanceof DatabaseError) {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    message = 'Database operation failed';
    // Don't expose internal database errors to clients
    details = process.env.NODE_ENV === 'development' ? error.originalError?.message : undefined;
  } else if (error instanceof ExternalAPIError) {
    statusCode = 502;
    errorCode = 'EXTERNAL_API_ERROR';
    message = error.message;
    details = process.env.NODE_ENV === 'development' ? { statusCode: error.statusCode } : undefined;
  } else {
    // Generic/unexpected errors
    statusCode = 500;
    errorCode = 'INTERNAL_ERROR';
    message = 'An unexpected error occurred';

    // Log full error details for investigation
    logger.error('Unexpected error type encountered', {
      errorName: error.constructor.name,
      errorMessage: error.message,
      errorStack: error.stack
    });

    // Only expose error details in development
    details = process.env.NODE_ENV === 'development' ? error.message : undefined;
  }

  // Format consistent error response
  const errorResponse: ErrorResponse = {
    error: {
      code: errorCode,
      message,
      ...(details !== undefined && { details })
    }
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found Handler
 *
 * Catches requests to non-existent routes and returns consistent 404 response.
 * Should be registered after all route handlers but before the main error handler.
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

/**
 * Async Error Wrapper
 *
 * Utility function to wrap async route handlers and automatically catch
 * any thrown errors, passing them to the error handler middleware.
 *
 * @param fn Async route handler function
 * @returns Wrapped route handler that catches async errors
 *
 * @example
 * ```typescript
 * router.get('/users/:id', asyncErrorWrapper(async (req, res) => {
 *   const user = await userService.getById(req.params.id);
 *   res.json(user);
 * }));
 * ```
 */
export const asyncErrorWrapper = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};