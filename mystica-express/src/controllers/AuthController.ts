import { Request, Response } from 'express';
import { authService } from '../services/AuthService.js';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  BusinessLogicError
} from '../utils/errors.js';

/**
 * Auth Controller
 *
 * Handles authentication operations by delegating to AuthService:
 * - Device registration (anonymous authentication)
 * - User registration (email/password)
 * - Login (email/password)
 * - Logout (revoke refresh token)
 * - Token refresh
 * - Password reset flow
 * - Email verification
 * - Get current user profile
 *
 * All business logic is handled in the AuthService layer.
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

      const result = await authService.register({ email, password });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.message.includes('8 characters')) {
          res.status(422).json({
            error: {
              code: 'WEAK_PASSWORD',
              message: error.message
            }
          });
        } else {
          res.status(400).json({
            error: {
              code: 'MISSING_CREDENTIALS',
              message: error.message
            }
          });
        }
        return;
      }

      if (error instanceof ConflictError) {
        res.status(422).json({
          error: {
            code: 'EMAIL_EXISTS',
            message: error.message
          }
        });
        return;
      }

      console.error('Registration error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error during registration'
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

      const result = await authService.login({ email, password });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.message.includes('Invalid email or password')) {
          res.status(401).json({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: error.message
            }
          });
        } else {
          res.status(400).json({
            error: {
              code: 'MISSING_CREDENTIALS',
              message: error.message
            }
          });
        }
        return;
      }

      console.error('Login error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error during login'
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
            code: 'MISSING_TOKEN',
            message: 'Authorization header missing or malformed'
          }
        });
        return;
      }

      const token = authHeader.substring(7);

      await authService.logout(token);

      res.status(200).json({
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error (non-critical, logout still succeeds)'
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

      const result = await authService.refresh({ refresh_token });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        if (error.message.includes('Refresh token is required')) {
          res.status(400).json({
            error: {
              code: 'MISSING_REFRESH_TOKEN',
              message: error.message
            }
          });
        } else {
          res.status(401).json({
            error: {
              code: 'INVALID_REFRESH_TOKEN',
              message: error.message
            }
          });
        }
        return;
      }

      console.error('Refresh token error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error during refresh'
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

      const result = await authService.resetPassword({ email });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: 'MISSING_EMAIL',
            message: error.message
          }
        });
        return;
      }

      console.error('Password reset error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error (returns success message for security)'
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

      const result = await authService.resendVerification({ email });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: 'MISSING_EMAIL',
            message: error.message
          }
        });
        return;
      }

      console.error('Resend verification error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error (returns success message for security)'
        }
      });
    }
  }

  /**
   * Register device for anonymous authentication
   *
   * POST /auth/register-device
   * Body: { device_id: string }
   *
   * Response: { user, session } with custom JWT tokens (30-day expiry)
   */
  static async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const { device_id } = req.body;

      const result = await authService.registerDevice({ device_id });

      const statusCode = result.message.includes('registered') ? 201 : 200;
      res.status(statusCode).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: 'MISSING_DEVICE_ID',
            message: 'Device ID missing or invalid format'
          }
        });
        return;
      }

      if (error instanceof BusinessLogicError) {
        if (error.message.includes('concurrent')) {
          res.status(500).json({
            error: {
              code: 'RACE_CONDITION_FAILED',
              message: 'Concurrent registration race condition'
            }
          });
        } else {
          res.status(500).json({
            error: {
              code: 'USER_CREATION_FAILED',
              message: 'User creation failed'
            }
          });
        }
        return;
      }

      console.error('Device registration error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'General server error'
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
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid token, user not found in req.user'
          }
        });
        return;
      }

      const result = await authService.getCurrentUser(user.id);

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'User ID not found in database'
          }
        });
        return;
      }

      if (error instanceof ValidationError) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid token, user not found in req.user'
          }
        });
        return;
      }

      console.error('Get current user error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error retrieving profile'
        }
      });
    }
  }
}
