/**
 * Express Type Helpers and Utilities
 *
 * Provides helper types and functions for working with the augmented
 * Express Request/Response interfaces.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Authenticated user type extracted from Express Request
 */
export type AuthenticatedUser = NonNullable<Request['user']>;

/**
 * Request context type for logging and tracing
 */
export type RequestContext = Request['context'];

/**
 * Type guard to check if a request has an authenticated user
 *
 * @param req Express request object
 * @returns true if user is authenticated, false otherwise
 *
 * @example
 * ```typescript
 * if (isAuthenticated(req)) {
 *   // req.user is guaranteed to be defined
 *   const userId = req.user.id;
 * }
 * ```
 */
export function isAuthenticated(req: Request): req is Request & { user: AuthenticatedUser } {
  return req.user !== undefined;
}

/**
 * Type for Express middleware functions with custom request types
 */
export type AuthenticatedMiddleware = (
  req: Request & { user: AuthenticatedUser },
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Type for Express route handlers with authentication
 */
export type AuthenticatedRouteHandler = (
  req: Request & { user: AuthenticatedUser },
  res: Response
) => void | Promise<void>;
