/**
 * Integration Tests: Auth Endpoints
 *
 * Tests full authentication flow through HTTP endpoints
 */

import request from 'supertest';

// Create mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockRefreshSession = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockResend = jest.fn();
const mockAdminSignOut = jest.fn();
const mockFrom = jest.fn();

// Mock Supabase BEFORE importing app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      refreshSession: mockRefreshSession,
      resetPasswordForEmail: mockResetPasswordForEmail,
      resend: mockResend,
      admin: {
        signOut: mockAdminSignOut,
      }
    },
    from: mockFrom
  }))
}));

// Import app AFTER mocking
import app from '../../src/app';

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Default mock for database queries
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'test@example.com',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          vanity_level: 0,
          avg_item_level: 0
        },
        error: null
      }),
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new user', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'newuser@example.com'
          },
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
            expires_in: 3600
          }
        },
        error: null
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        user: {
          id: 'user-123',
          email: 'newuser@example.com'
        },
        session: expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String)
        }),
        message: expect.stringContaining('Registration successful')
      });
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should reject registration with existing email', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' }
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com'
          },
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
            expires_in: 3600
          }
        },
        error: null
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com'
        }),
        session: expect.objectContaining({
          access_token: expect.any(String)
        })
      });
    });

    it('should reject login with invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should successfully refresh tokens', async () => {
      mockRefreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600
          }
        },
        error: null
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: 'valid-refresh-token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        session: expect.objectContaining({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        })
      });
    });

    it('should reject invalid refresh token', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' }
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: 'invalid-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should always return success to prevent email enumeration', async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('password reset link has been sent');
    });

    it('should return success even for non-existent email', async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        data: {},
        error: { message: 'User not found' }
      });

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('password reset link has been sent');
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('should always return success to prevent email enumeration', async () => {
      mockResend.mockResolvedValue({
        data: {},
        error: null
      });

      const response = await request(app)
        .post('/api/v1/auth/resend-verification')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('verification link has been sent');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile for authenticated user', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: futureTime
          }
        },
        error: null
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com'
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });

    it('should reject request with expired token', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600;
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: expiredTime
          }
        },
        error: null
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('token_expired');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should successfully logout authenticated user', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'user-123',
            email: 'test@example.com',
            exp: futureTime
          }
        },
        error: null
      });
      mockAdminSignOut.mockResolvedValue({
        data: {},
        error: null
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logout successful');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});
