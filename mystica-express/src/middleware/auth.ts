import { Request, Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
// TODO: Import from config/supabase when available
// import { supabase } from '../config/supabase';

/**
 * JWT Authentication Middleware
 *
 * Validates JWT tokens from Authorization header via Supabase Auth.
 * Attaches user information to req.user for downstream middleware/controllers.
 *
 * @param req Express request object
 * @param res Express response object
 * @param next Next middleware function
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Missing or invalid authorization header. Expected format: Bearer <token>'
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token.trim()) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'JWT token is empty'
        }
      });
      return;
    }

    // TODO: Replace with actual supabase client when config is available
    // For now, create a placeholder that will be replaced
    const supabase = null as unknown as SupabaseClient;

    // Validate JWT token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired JWT token',
          details: error?.message
        }
      });
      return;
    }

    // Attach user information to request for downstream use
    req.user = {
      id: user.id,
      email: user.email || ''
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Failed to authenticate request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
};

/**
 * Optional Authentication Middleware
 *
 * Similar to authenticate() but allows requests without tokens to proceed.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // Allow requests without authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = undefined;
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!token.trim()) {
      req.user = undefined;
      next();
      return;
    }

    // TODO: Replace with actual supabase client when config is available
    const supabase = null as unknown as SupabaseClient;

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Don't throw error for optional auth - just proceed without user
      req.user = undefined;
    } else {
      req.user = {
        id: user.id,
        email: user.email || ''
      };
    }

    next();
  } catch (error) {
    // For optional auth, don't fail the request on errors
    req.user = undefined;
    next();
  }
};