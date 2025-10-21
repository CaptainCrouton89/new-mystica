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
   * - context: Request context for tracing and logging
   */
  interface Request {
    /**
     * Authenticated user information
     *
     * Set by auth middleware after successful JWT token validation.
     * Will be undefined for unauthenticated requests or when using optional auth.
     * Supports both email-based and device-based (anonymous) users.
     */
    user?: {
      /** Supabase user ID (UUID format) */
      id: string;
      /** User's email address (null for anonymous users) */
      email: string | null;
      /** Device ID for anonymous users (null for email users) */
      device_id?: string | null;
      /** Account type: 'email' or 'anonymous' */
      account_type?: 'email' | 'anonymous';
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
  interface Response {
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
