import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

interface JWTClaims {
  sub: string;
  email?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Supabase client for JWT validation (uses anon key, not service role)
 *
 * Per Supabase docs: Use anon key client with getClaims() for auth validation.
 * This respects RLS policies and validates tokens via asymmetric keys (RS256).
 */
const supabaseAuth = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

/**
 * JWT Authentication Middleware (Modern getClaims approach)
 *
 * Validates JWT tokens using Supabase's getClaims() method:
 * - Fast local verification with cached JWKS (5-15ms vs 100-500ms with getUser)
 * - Works with asymmetric keys (RS256/ECC) for zero-network validation
 * - Falls back to getUser() for legacy HS256 projects
 *
 * Attaches user information to req.user for downstream use.
 *
 * @see https://supabase.com/docs/guides/auth/server-side
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'missing_token',
          message: 'Missing or invalid authorization header. Expected format: Bearer <token>'
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token.trim()) {
      res.status(401).json({
        error: {
          code: 'empty_token',
          message: 'JWT token is empty'
        }
      });
      return;
    }

    // Validate JWT using getClaims (fast with asymmetric keys)
    const { data, error } = await supabaseAuth.auth.getClaims(token);

    if (error || !data) {
      res.status(401).json({
        error: {
          code: 'invalid_token',
          message: 'Invalid or expired JWT token',
          details: error?.message
        }
      });
      return;
    }

    // Check token expiration
    const claims = data.claims as JWTClaims;
    if (claims.exp && claims.exp < Date.now() / 1000) {
      res.status(401).json({
        error: {
          code: 'token_expired',
          message: 'Token has expired. Please refresh your session.'
        }
      });
      return;
    }

    // Attach user information to request
    req.user = {
      id: claims.sub,
      email: claims.email || ''
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'auth_error',
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

    const { data, error } = await supabaseAuth.auth.getClaims(token);

    if (error || !data) {
      // Don't throw error for optional auth - just proceed without user
      req.user = undefined;
    } else {
      const claims = data.claims as JWTClaims;
      if (claims.exp && claims.exp < Date.now() / 1000) {
        req.user = undefined;
      } else {
        req.user = {
          id: claims.sub,
          email: claims.email || ''
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, don't fail the request on errors
    req.user = undefined;
    next();
  }
};