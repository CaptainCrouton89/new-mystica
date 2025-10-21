import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation configuration for request validation middleware
 */
interface ValidationConfig {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validation error detail for response formatting
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

/**
 * Zod Validation Middleware Factory
 *
 * Creates middleware that validates incoming requests against Zod schemas.
 * Validates body, query, and/or params based on provided schemas.
 *
 * @param config Validation configuration with optional body, query, params schemas
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const createUserSchema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email()
 * });
 *
 * router.post('/users',
 *   validate({ body: createUserSchema }),
 *   userController.create
 * );
 * ```
 */
export const validate = (config: ValidationConfig) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors: ValidationErrorDetail[] = [];

      // Validate request body
      if (config.body) {
        try {
          req.body = config.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodErrors(error, 'body'));
          } else {
            errors.push({
              field: 'body',
              message: 'Invalid request body format'
            });
          }
        }
      }

      // Validate query parameters
      if (config.query) {
        try {
          req.query = config.query.parse(req.query) as any;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodErrors(error, 'query'));
          } else {
            errors.push({
              field: 'query',
              message: 'Invalid query parameters format'
            });
          }
        }
      }

      // Validate route parameters
      if (config.params) {
        try {
          req.params = config.params.parse(req.params) as any;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodErrors(error, 'params'));
          } else {
            errors.push({
              field: 'params',
              message: 'Invalid route parameters format'
            });
          }
        }
      }

      // If there are validation errors, return 400 response
      if (errors.length > 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors
          }
        });
        return;
      }

      // All validations passed, proceed to next middleware
      next();
    } catch (error) {
      // Unexpected error during validation
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Validation middleware encountered an unexpected error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  };
};

/**
 * Format Zod validation errors into a consistent structure
 *
 * @param zodError The ZodError containing validation issues
 * @param prefix Field prefix (body, query, params)
 * @returns Array of formatted error details
 */
function formatZodErrors(zodError: ZodError, prefix: string): ValidationErrorDetail[] {
  return zodError.issues.map(issue => {
    const fieldPath = issue.path.length > 0
      ? `${prefix}.${issue.path.join('.')}`
      : prefix;

    return {
      field: fieldPath,
      message: issue.message,
      code: issue.code
    };
  });
}

/**
 * Convenience middleware for body-only validation
 *
 * @param schema Zod schema for request body
 * @returns Express middleware function
 */
export const validateBody = (schema: ZodSchema) => validate({ body: schema });

/**
 * Convenience middleware for query-only validation
 *
 * @param schema Zod schema for query parameters
 * @returns Express middleware function
 */
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });

/**
 * Convenience middleware for params-only validation
 *
 * @param schema Zod schema for route parameters
 * @returns Express middleware function
 */
export const validateParams = (schema: ZodSchema) => validate({ params: schema });