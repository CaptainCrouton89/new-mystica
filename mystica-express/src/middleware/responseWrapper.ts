import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/api.types.js';

/**
 * Response Wrapper Middleware
 *
 * Intercepts successful responses and wraps them in standardized format:
 * { success: true, data: <original_response>, timestamp: string }
 *
 * Error responses continue through existing errorHandler.ts unchanged.
 */
export const responseWrapper = (req: Request, res: Response, next: NextFunction): void => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override res.json to wrap successful responses
  res.json = function(data: any) {
    // Don't wrap if already an error response (has error property)
    if (res.statusCode >= 400 || (data && data.error)) {
      return originalJson(data);
    }

    // Wrap successful responses in ApiResponse format
    const wrappedResponse: ApiResponse<typeof data> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    return originalJson(wrappedResponse);
  };

  next();
};