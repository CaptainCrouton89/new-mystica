/**
 * Custom Error Classes for New Mystica Backend
 *
 * Provides structured error handling with specific error types
 * for different failure scenarios in the application.
 */

/**
 * Base application error class
 * All custom errors extend from this base class
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Database operation errors
 * Used for Supabase query failures, constraint violations, etc.
 */
export class DatabaseError extends AppError {
  readonly statusCode = 500;
  readonly code = 'DATABASE_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(`Database operation failed: ${message}`, details);
  }
}

/**
 * Request validation errors
 * Used for Zod schema validation failures, invalid parameters, etc.
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(`Validation failed: ${message}`, details);
  }

  /**
   * Create ValidationError from Zod error
   */
  static fromZodError(error: any): ValidationError {
    const details = error.issues?.map((issue: any) => ({
      field: issue.path.join('.'),
      message: issue.message,
      received: issue.received,
    }));

    return new ValidationError('Invalid request parameters', details);
  }
}

/**
 * Authentication errors
 * Used for missing, invalid, or expired JWT tokens
 */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';

  constructor(message: string = 'Authentication required', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Authorization errors
 * Used when user lacks permission for a resource or operation
 */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR';

  constructor(message: string = 'Access denied', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Resource not found errors
 * Used when requested resource doesn't exist or user can't access it
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(resource: string, identifier?: string, details?: Record<string, any>) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    super(message, details);
  }
}

/**
 * Conflict errors
 * Used for duplicate resources, constraint violations, race conditions
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(`Conflict: ${message}`, details);
  }
}

/**
 * External API errors
 * Used for Replicate, OpenAI, or other third-party service failures
 */
export class ExternalAPIError extends AppError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_API_ERROR';

  constructor(
    service: string,
    message: string,
    details?: Record<string, any>
  ) {
    super(`${service} API error: ${message}`, details);
  }
}

/**
 * Not implemented errors
 * Used for endpoints or features that are planned but not yet implemented
 */
export class NotImplementedError extends AppError {
  readonly statusCode = 501;
  readonly code = 'NOT_IMPLEMENTED';

  constructor(feature: string, details?: Record<string, any>) {
    super(`Feature not implemented: ${feature}`, details);
  }
}

/**
 * Rate limit errors
 * Used when API rate limits are exceeded
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_ERROR';

  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    details?: Record<string, any>
  ) {
    super(message, details);
  }
}

/**
 * Business logic errors
 * Used for game-specific rule violations (insufficient materials, invalid combinations, etc.)
 */
export class BusinessLogicError extends AppError {
  readonly statusCode = 422;
  readonly code = 'BUSINESS_LOGIC_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Type guard to check if error is an AppError instance
 */
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

/**
 * Error mapping for common Supabase error codes
 */
export const mapSupabaseError = (error: any): AppError => {
  const message = error.message || 'Unknown database error';
  const code = error.code;

  switch (code) {
    case '23505': // unique_violation
      return new ConflictError('Resource already exists', { postgresCode: code });

    case '23503': // foreign_key_violation
      return new ValidationError('Referenced resource does not exist', { postgresCode: code });

    case '23514': // check_violation
      return new ValidationError('Data violates constraint', { postgresCode: code });

    case 'PGRST116': // no rows returned (not necessarily an error)
      return new NotFoundError('Resource', undefined, { postgresCode: code });

    case '42501': // insufficient_privilege
      return new AuthorizationError('Insufficient database privileges', { postgresCode: code });

    default:
      return new DatabaseError(message, { postgresCode: code });
  }
};