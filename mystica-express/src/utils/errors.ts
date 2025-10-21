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
 * External service errors
 * Used for Replicate, R2, or other third-party service failures
 * Alias for ExternalAPIError to match service specification naming
 */
export class ExternalServiceError extends ExternalAPIError {
  constructor(
    message: string,
    details?: Record<string, any>
  ) {
    // Extract service name from message if it starts with a service name
    const serviceMatch = message.match(/^(\w+)/);
    const service = serviceMatch ? serviceMatch[1] : 'External Service';
    super(service, message, details);
  }
}

/**
 * Configuration errors
 * Used for missing environment variables or invalid configuration
 */
export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly code = 'CONFIGURATION_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(`Configuration error: ${message}`, details);
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
 * Insufficient funds errors
 * Used when user doesn't have enough currency for an operation
 */
export class InsufficientFundsError extends AppError {
  readonly statusCode = 422;
  readonly code = 'INSUFFICIENT_FUNDS';

  constructor(
    message: string,
    public readonly currentBalance?: number,
    public readonly requiredAmount?: number,
    details?: Record<string, any>
  ) {
    super(message, details);
  }
}

/**
 * Session not found errors (for ChatterService)
 * Used when combat session is not found or expired
 */
export class SessionNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'SESSION_NOT_FOUND';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * No pet equipped errors (for ChatterService)
 * Used when player has no pet equipped for chatter generation
 */
export class NoPetEquippedError extends AppError {
  readonly statusCode = 422;
  readonly code = 'NO_PET_EQUIPPED';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Pet not found errors (for ChatterService)
 * Used when specific pet is not found
 */
export class PetNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'PET_NOT_FOUND';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Personality not found errors (for ChatterService)
 * Used when pet personality template is missing
 */
export class PersonalityNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'PERSONALITY_NOT_FOUND';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Invalid personality errors (for ChatterService)
 * Used when assigning invalid personality type
 */
export class InvalidPersonalityError extends AppError {
  readonly statusCode = 400;
  readonly code = 'INVALID_PERSONALITY';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Enemy type not found errors (for ChatterService)
 * Used when enemy type is not found
 */
export class EnemyTypeNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'ENEMY_TYPE_NOT_FOUND';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Equipment-specific errors
 */
export class ItemNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'ITEM_NOT_FOUND';

  constructor(itemId: string) {
    super(`Item with specified item_id does not exist`);
  }
}

export class ItemNotOwnedError extends AppError {
  readonly statusCode = 400;
  readonly code = 'ITEM_NOT_OWNED';

  constructor() {
    super('Item not owned by user');
  }
}

export class ItemAlreadyEquippedError extends AppError {
  readonly statusCode = 400;
  readonly code = 'ITEM_ALREADY_EQUIPPED';

  constructor() {
    super('Item already equipped in another slot');
  }
}

export class IncompatibleItemTypeError extends AppError {
  readonly statusCode = 400;
  readonly code = 'INCOMPATIBLE_ITEM_TYPE';

  constructor() {
    super('Item type incompatible with any equipment slot');
  }
}

export class SlotEmptyError extends AppError {
  readonly statusCode = 400;
  readonly code = 'SLOT_EMPTY';

  constructor() {
    super('Slot already empty (no item to unequip)');
  }
}

export class InvalidSlotError extends AppError {
  readonly statusCode = 400;
  readonly code = 'INVALID_SLOT';

  constructor() {
    super('Invalid slot name (not in EquipmentSlot enum)');
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