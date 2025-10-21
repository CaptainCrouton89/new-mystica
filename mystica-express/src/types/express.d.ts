/**
 * Express.js Type Extensions for New Mystica API
 *
 * This file extends the Express Request interface to include custom properties
 * that are added by middleware throughout the request lifecycle.
 */

declare namespace Express {
  /**
   * Extended Express Request interface
   *
   * Adds custom properties that are attached by middleware:
   * - user: Authenticated user information from JWT middleware
   * - validated: Validated request data from validation middleware
   */
  export interface Request {
    /**
     * Authenticated user information
     *
     * Set by auth middleware after successful JWT token validation.
     * Will be undefined for unauthenticated requests or when using optional auth.
     */
    user?: {
      /** Supabase user ID (UUID format) */
      id: string;
      /** User's email address */
      email: string;
    };

    /**
     * Validated request data (optional extension for future use)
     *
     * Could be used to store validated/transformed data from Zod schemas
     * if we want to separate validated data from raw request data.
     */
    validated?: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };

    /**
     * Request context for tracing and logging (optional extension)
     *
     * Can be used to store request-specific context like correlation IDs,
     * timing information, or other metadata useful for monitoring.
     */
    context?: {
      /** Unique request ID for tracing */
      requestId?: string;
      /** Request start timestamp */
      startTime?: Date;
      /** Client IP address (after proxy handling) */
      clientIp?: string;
    };
  }

  /**
   * Extended Express Response interface (optional for future use)
   *
   * Can be extended to add custom response methods or properties
   * if needed for consistent API responses.
   */
  export interface Response {
    /**
     * Send a standardized success response
     *
     * @example
     * ```typescript
     * res.success({ data: user, message: 'User created successfully' });
     * ```
     */
    success?: (payload: {
      data?: unknown;
      message?: string;
      meta?: unknown;
    }) => Response;

    /**
     * Send a standardized error response
     *
     * @example
     * ```typescript
     * res.error('User not found', 404, 'USER_NOT_FOUND');
     * ```
     */
    error?: (
      message: string,
      statusCode?: number,
      errorCode?: string,
      details?: unknown
    ) => Response;
  }
}

/**
 * Global type exports for use in other modules
 */

/**
 * Authenticated user type extracted from Express Request
 */
export type AuthenticatedUser = NonNullable<Express.Request['user']>;

/**
 * Request context type for logging and tracing
 */
export type RequestContext = Express.Request['context'];

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
export function isAuthenticated(req: Express.Request): req is Express.Request & { user: AuthenticatedUser } {
  return req.user !== undefined;
}

/**
 * Type for Express middleware functions with custom request types
 */
export type AuthenticatedMiddleware = (
  req: Express.Request & { user: AuthenticatedUser },
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

/**
 * Type for Express route handlers with authentication
 */
export type AuthenticatedRouteHandler = (
  req: Express.Request & { user: AuthenticatedUser },
  res: Express.Response
) => void | Promise<void>;