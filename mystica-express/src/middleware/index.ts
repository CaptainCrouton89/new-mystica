/**
 * Middleware Module Index
 *
 * Centralizes all middleware exports for convenient importing throughout the application.
 * Provides a single import point for all middleware functions.
 *
 * @example
 * ```typescript
 * import { authenticate, validate, corsMiddleware, errorHandler } from '../middleware';
 * ```
 */

// Authentication middleware
export {
  authenticate,
  optionalAuthenticate
} from './auth';

// Validation middleware
export {
  validate,
  validateBody,
  validateQuery,
  validateParams
} from './validate';

// Error handling middleware
export {
  errorHandler,
  notFoundHandler,
  asyncErrorWrapper
} from './errorHandler';

// CORS middleware
export {
  corsMiddleware,
  strictCorsMiddleware,
  devCorsMiddleware,
  createCustomCors
} from './cors';

// Type exports are now available globally via @types/express/index.d.ts
// No need to re-export them here