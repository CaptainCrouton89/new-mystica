import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { verifyAnonymousToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

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

    logger.info('🔒 [AUTH] Authenticating request', {
      method: req.method,
      path: req.path,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20) + '...'
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('❌ [AUTH] Missing or invalid auth header');
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
      logger.warn('❌ [AUTH] Empty token');
      res.status(401).json({
        error: {
          code: 'empty_token',
          message: 'JWT token is empty'
        }
      });
      return;
    }

    logger.info('🔑 [AUTH] Token received (first 30 chars)', { tokenPrefix: token.substring(0, 30) + '...' });

    // Try to verify as anonymous token first (custom JWT)
    logger.info('🔍 [AUTH] Attempting anonymous token verification...');
    const anonymousPayload = verifyAnonymousToken(token);
    if (anonymousPayload) {
      // Valid anonymous token
      logger.info('✅ [AUTH] Valid anonymous token', {
        userId: anonymousPayload.sub,
        deviceId: anonymousPayload.device_id
      });
      req.user = {
        id: anonymousPayload.sub,
        email: null,
        device_id: anonymousPayload.device_id,
        account_type: 'anonymous'
      };
      next();
      return;
    }

    logger.info('⚠️  [AUTH] Not an anonymous token, trying Supabase validation...');

    // Not an anonymous token, try Supabase JWT validation
    const { data, error } = await supabaseAuth.auth.getClaims(token);

    if (error || !data) {
      logger.warn('❌ [AUTH] Supabase token validation failed', {
        error: error?.message,
        hasData: !!data
      });
      res.status(401).json({
        error: {
          code: 'invalid_token',
          message: 'Invalid or expired JWT token',
          details: error?.message
        }
      });
      return;
    }

    // Check token expiration for Supabase tokens
    const claims = data.claims as JWTClaims;
    if (claims.exp && claims.exp < Date.now() / 1000) {
      logger.warn('❌ [AUTH] Token expired', {
        exp: claims.exp,
        now: Date.now() / 1000
      });
      res.status(401).json({
        error: {
          code: 'token_expired',
          message: 'Token has expired. Please refresh your session.'
        }
      });
      return;
    }

    logger.info('✅ [AUTH] Valid Supabase token', {
      userId: claims.sub,
      email: claims.email
    });

    // Attach email user information to request
    req.user = {
      id: claims.sub,
      email: claims.email || null,
      device_id: null,
      account_type: 'email'
    };

    next();
  } catch (error) {
    logger.error('❌ [AUTH] Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error); // Let global error handler manage the response
  }
};

/**
 * Internal Service Authentication Middleware
 *
 * Validates internal service requests using X-Internal-Service header.
 * Used for service-to-service communication endpoints.
 */
export const authenticateInternal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const serviceHeader = req.headers['x-internal-service'] as string;

    if (!serviceHeader) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing X-Internal-Service header for internal endpoint'
        }
      });
      return;
    }

    // For now, accept any internal service header
    // TODO: Implement proper internal service authentication if needed
    logger.info('🔧 [AUTH] Internal service request from', { serviceHeader });

    next();
  } catch (error) {
    logger.error('❌ [AUTH] Internal service authentication error', { error });
    next(error); // Let global error handler manage the response
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

    // Try to verify as anonymous token first
    const anonymousPayload = verifyAnonymousToken(token);
    if (anonymousPayload) {
      req.user = {
        id: anonymousPayload.sub,
        email: null,
        device_id: anonymousPayload.device_id,
        account_type: 'anonymous'
      };
      next();
      return;
    }

    // Try Supabase JWT validation
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
          email: claims.email || null,
          device_id: null,
          account_type: 'email'
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