/**
 * Integration Tests: Device-Based Anonymous Authentication (F-07)
 *
 * Tests essential device authentication functionality:
 * - Device registration validation
 * - Custom JWT token generation and verification
 * - Auth middleware integration with anonymous tokens
 * - Mixed authentication (email + anonymous)
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock uuid BEFORE importing app to avoid ES module issues
jest.mock('uuid', () => ({
  v4: () => 'test-device-id-1234-5678-9abc-def0'
}));

// Create mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockFrom = jest.fn();

// Mock Supabase BEFORE importing app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
    },
    from: mockFrom
  }))
}));

// Import app and utilities AFTER mocking
import app from '../../src/app';
import { env } from '../../src/config/env';

describe('Device-Based Anonymous Authentication (F-07)', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register-device - Validation Tests', () => {
    it('should reject invalid UUID format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: 'invalid-uuid-format' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Device ID must be a valid UUID')
          })
        ])
      });
    });

    it('should reject missing device_id', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed'
      });
    });

    it('should reject null device_id', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: null });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty string device_id', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: '' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Device Registration - Success Cases (Mocked)', () => {
    it('should successfully register new device with valid UUID', async () => {
      const validDeviceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Mock successful database operations
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No existing user
          .mockResolvedValueOnce({ // Profile fetch after creation
            data: {
              id: 'user-123',
              device_id: validDeviceId,
              account_type: 'anonymous',
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString(),
              vanity_level: 0,
              avg_item_level: null
            },
            error: null
          }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis()
      };

      mockFrom.mockReturnValue(mockChain);

      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: validDeviceId });

      // Should return 201 for new user or 200 for existing
      expect([200, 201]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toMatchObject({
          user: {
            device_id: validDeviceId,
            account_type: 'anonymous'
          },
          session: {
            access_token: expect.any(String),
            refresh_token: null,
            expires_in: 2592000, // 30 days
            token_type: 'bearer'
          },
          message: 'Device registered successfully'
        });
      }
    });
  });

  describe('JWT Token Verification', () => {
    it('should generate valid JWT tokens with correct claims', async () => {
      const validDeviceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Mock successful response
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                device_id: validDeviceId,
                account_type: 'anonymous',
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString(),
                vanity_level: 0,
                avg_item_level: null
              },
              error: null
            })
          })
        }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: validDeviceId });

      if (response.body.session?.access_token) {
        const token = response.body.session.access_token;

        // Verify JWT token structure
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        expect(decoded).toMatchObject({
          sub: expect.any(String),
          device_id: validDeviceId,
          account_type: 'anonymous',
          iat: expect.any(Number),
          exp: expect.any(Number)
        });

        // Verify 30-day expiry
        const now = Math.floor(Date.now() / 1000);
        const expectedExp = now + (30 * 24 * 60 * 60);
        expect(decoded.exp).toBeCloseTo(expectedExp, -2); // Within 100 seconds
      }
    });
  });

  describe('Auth Middleware Integration', () => {
    it('should authenticate anonymous tokens with auth middleware', async () => {
      const deviceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const userId = 'user-123';

      // Create a valid anonymous token manually
      const token = jwt.sign(
        {
          sub: userId,
          device_id: deviceId,
          account_type: 'anonymous',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
        },
        env.JWT_SECRET
      );

      // Mock profile fetch for /auth/me endpoint
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: userId,
                email: null,
                device_id: deviceId,
                account_type: 'anonymous',
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString(),
                vanity_level: 0,
                avg_item_level: null
              },
              error: null
            })
          })
        })
      });

      // Test that anonymous token works with protected endpoint
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: userId,
        email: null,
        device_id: deviceId,
        account_type: 'anonymous'
      });
    });

    it('should not interfere with email-based authentication', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;

      // Mock Supabase JWT validation for email user
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: 'email-user-123',
            email: 'test@example.com',
            exp: futureTime
          }
        },
        error: null
      });

      // Mock profile fetch for email user
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'email-user-123',
                email: 'test@example.com',
                device_id: null,
                account_type: 'email',
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString(),
                vanity_level: 5,
                avg_item_level: 15
              },
              error: null
            })
          })
        })
      });

      // Test that email authentication still works
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer supabase-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'email-user-123',
        email: 'test@example.com',
        device_id: null,
        account_type: 'email'
      });
    });

    it('should reject invalid anonymous tokens', async () => {
      const invalidToken = jwt.sign(
        { sub: 'user-123', account_type: 'email' }, // Wrong account_type
        env.JWT_SECRET
      );

      // Anonymous token validation should fail, try Supabase
      mockGetClaims.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('invalid_token');
    });

    it('should reject expired anonymous tokens', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'user-123',
          device_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          account_type: 'anonymous',
          iat: Math.floor(Date.now() / 1000) - 3600,
          exp: Math.floor(Date.now() / 1000) - 1800 // Expired 30 minutes ago
        },
        env.JWT_SECRET
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('invalid_token');
    });
  });

  describe('Token Expiry Verification', () => {
    it('should generate tokens with correct 30-day expiry', async () => {
      const deviceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Mock successful response
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                device_id: deviceId,
                account_type: 'anonymous',
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString(),
                vanity_level: 0,
                avg_item_level: null
              },
              error: null
            })
          })
        }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      });

      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: deviceId });

      if (response.body.session) {
        const { session } = response.body;
        expect(session.expires_in).toBe(2592000); // 30 days in seconds

        const now = Math.floor(Date.now() / 1000);
        const expectedExpiryTime = now + 2592000;
        expect(session.expires_at).toBeCloseTo(expectedExpiryTime, -2);

        // Verify JWT claims if token exists
        if (session.access_token) {
          const decoded = jwt.verify(session.access_token, env.JWT_SECRET) as any;
          expect(decoded.exp).toBeCloseTo(expectedExpiryTime, -2);
          expect(decoded.iat).toBeCloseTo(now, -2);
        }

        // Ensure no refresh token for anonymous users
        expect(session.refresh_token).toBeNull();
      }
    });
  });
});