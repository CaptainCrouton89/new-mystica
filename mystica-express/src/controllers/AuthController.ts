import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { supabase as supabaseAdmin } from '../config/supabase.js';
import { AuthError } from '@supabase/supabase-js';

/**
 * Supabase client for authentication operations (uses anon key)
 *
 * Note: Auth operations use anon key client, NOT service role.
 * This properly handles email verification, rate limiting, and auth flows.
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
 * Auth Controller
 *
 * Handles authentication operations via Supabase Auth:
 * - User registration (email/password)
 * - Login (email/password)
 * - Logout (revoke refresh token)
 * - Token refresh
 * - Password reset flow
 * - Email verification
 *
 * All operations delegate to Supabase Auth - no manual JWT handling.
 */
export class AuthController {
  /**
   * Register new user with email and password
   *
   * POST /auth/register
   * Body: { email: string, password: string }
   *
   * Response: { user, session } with JWT tokens
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: {
            code: 'missing_credentials',
            message: 'Email and password are required'
          }
        });
        return;
      }

      // Validate password strength
      if (password.length < 8) {
        res.status(422).json({
          error: {
            code: 'weak_password',
            message: 'Password must be at least 8 characters long'
          }
        });
        return;
      }

      const { data, error } = await supabaseAuth.auth.signUp({
        email,
        password
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes('already registered')) {
          res.status(422).json({
            error: {
              code: 'email_exists',
              message: 'Email already registered. Please login or reset your password.'
            }
          });
          return;
        }

        res.status(400).json({
          error: {
            code: error.name || 'registration_failed',
            message: error.message
          }
        });
        return;
      }

      // Create user profile in database (F-07)
      if (data.user) {
        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          });

        if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
          console.error('Failed to create user profile:', profileError);
        }
      }

      res.status(201).json({
        user: data.user,
        session: data.session,
        message: 'Registration successful. Please check your email for verification link.'
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Registration failed due to server error'
        }
      });
    }
  }

  /**
   * Login with email and password
   *
   * POST /auth/login
   * Body: { email: string, password: string }
   *
   * Response: { user, session } with JWT tokens
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: {
            code: 'missing_credentials',
            message: 'Email and password are required'
          }
        });
        return;
      }

      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Treat all login errors as invalid credentials for security
        res.status(401).json({
          error: {
            code: 'invalid_credentials',
            message: 'Invalid email or password'
          }
        });
        return;
      }

      // Update last login timestamp
      if (data.user) {
        await supabaseAdmin
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.user.id);
      }

      res.status(200).json({
        user: data.user,
        session: data.session
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Login failed due to server error'
        }
      });
    }
  }

  /**
   * Logout (revoke refresh token)
   *
   * POST /auth/logout
   * Headers: Authorization: Bearer <access_token>
   *
   * Response: { message: 'Logout successful' }
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: {
            code: 'missing_token',
            message: 'Authorization header required'
          }
        });
        return;
      }

      const token = authHeader.substring(7);

      // Revoke session via Supabase
      const { error } = await supabaseAuth.auth.admin.signOut(token);

      if (error) {
        console.error('Logout error:', error);
        // Don't fail logout if error - token may already be invalid
      }

      res.status(200).json({
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Logout failed due to server error'
        }
      });
    }
  }

  /**
   * Refresh access token using refresh token
   *
   * POST /auth/refresh
   * Body: { refresh_token: string }
   *
   * Response: { session } with new JWT tokens
   */
  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        res.status(400).json({
          error: {
            code: 'missing_refresh_token',
            message: 'Refresh token is required'
          }
        });
        return;
      }

      const { data, error } = await supabaseAuth.auth.refreshSession({
        refresh_token
      });

      if (error) {
        res.status(401).json({
          error: {
            code: 'invalid_refresh_token',
            message: 'Invalid or expired refresh token'
          }
        });
        return;
      }

      res.status(200).json({
        session: data.session
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Token refresh failed due to server error'
        }
      });
    }
  }

  /**
   * Request password reset email
   *
   * POST /auth/reset-password
   * Body: { email: string }
   *
   * Response: { message: 'Password reset email sent' }
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          error: {
            code: 'missing_email',
            message: 'Email is required'
          }
        });
        return;
      }

      const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
        redirectTo: `${env.SUPABASE_URL}/auth/v1/verify`
      });

      if (error) {
        console.error('Password reset error:', error);
        // Don't reveal if email exists or not (security)
      }

      // Always return success to prevent email enumeration
      res.status(200).json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Password reset failed due to server error'
        }
      });
    }
  }

  /**
   * Resend email verification
   *
   * POST /auth/resend-verification
   * Body: { email: string }
   *
   * Response: { message: 'Verification email sent' }
   */
  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          error: {
            code: 'missing_email',
            message: 'Email is required'
          }
        });
        return;
      }

      const { error } = await supabaseAuth.auth.resend({
        type: 'signup',
        email
      });

      if (error) {
        console.error('Resend verification error:', error);
        // Don't reveal if email exists or not (security)
      }

      // Always return success to prevent email enumeration
      res.status(200).json({
        message: 'If an account with that email exists, a verification link has been sent.'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Verification resend failed due to server error'
        }
      });
    }
  }

  /**
   * Get current user info (requires authentication)
   *
   * GET /auth/me
   * Headers: Authorization: Bearer <access_token>
   *
   * Response: { user }
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      // User already validated by auth middleware
      const user = req.user;
      if (!user) {
        res.status(401).json({
          error: {
            code: 'unauthorized',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Fetch full user profile from database
      const { data: profile, error } = await supabaseAdmin
        .from('users')
        .select('id, email, created_at, last_login, vanity_level, avg_item_level')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        res.status(404).json({
          error: {
            code: 'profile_not_found',
            message: 'User profile not found'
          }
        });
        return;
      }

      res.status(200).json({
        user: profile
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to retrieve user profile'
        }
      });
    }
  }
}
