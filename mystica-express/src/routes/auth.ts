import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * Authentication Routes
 *
 * All authentication operations delegate to Supabase Auth.
 * No custom JWT handling - Supabase manages tokens, expiration, and security.
 *
 * Public routes (no auth required):
 * - POST /auth/register - Create new account
 * - POST /auth/login - Sign in with credentials
 * - POST /auth/refresh - Get new access token
 * - POST /auth/reset-password - Request password reset email
 * - POST /auth/resend-verification - Resend email verification
 *
 * Protected routes (auth required):
 * - GET /auth/me - Get current user profile
 * - POST /auth/logout - Sign out and revoke tokens
 */

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/reset-password', AuthController.resetPassword);
router.post('/resend-verification', AuthController.resendVerification);

// Protected routes (require authentication)
router.get('/me', authenticate, AuthController.getCurrentUser);
router.post('/logout', authenticate, AuthController.logout);

export default router;
