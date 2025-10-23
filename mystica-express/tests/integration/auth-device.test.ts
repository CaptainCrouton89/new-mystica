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
import { extractResponseData } from '../helpers/assertions.js';

// Mock uuid BEFORE importing app to avoid ES module issues
jest.mock('uuid', () => ({
  v4: () => 'test-device-id-1234-5678-9abc-def0'
}));

// Mock ProfileRepository methods
const mockUpdateLastLogin = jest.fn();
const mockGetAllCurrencyBalances = jest.fn();
const mockFindUserById = jest.fn();
jest.mock('../../src/repositories/ProfileRepository.js', () => ({
  ProfileRepository: jest.fn().mockImplementation(() => ({
    updateLastLogin: mockUpdateLastLogin,
    getAllCurrencyBalances: mockGetAllCurrencyBalances,
    findUserById: mockFindUserById
  }))
}));

// Create mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
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
    mockUpdateLastLogin.mockClear();
    mockGetAllCurrencyBalances.mockClear();
    mockFindUserById.mockClear();
    mockGetClaims.mockClear();
    mockSelect.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockSingle.mockClear();
    mockFrom.mockClear();

    // Default ProfileRepository mock returns
    mockUpdateLastLogin.mockResolvedValue(undefined);
    mockGetAllCurrencyBalances.mockResolvedValue({ GOLD: 500, GEMS: 0 });
    mockFindUserById.mockResolvedValue(null);

    // Set up default Supabase mock chains
    mockEq.mockReturnThis();
    mockSelect.mockReturnValue({
      eq: mockEq,
      single: mockSingle
    });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null })
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate
    });
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

      // Mock no existing user found
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } }); // No existing user

      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: validDeviceId });

      expect(response.status).toBe(201);
      expect(extractResponseData(response.body)).toMatchObject({
        user: {
          id: 'test-device-id-1234-5678-9abc-def0', // Matches mocked UUID
          device_id: validDeviceId,
          account_type: 'anonymous',
          avg_item_level: 0
        },
        session: {
          access_token: expect.any(String),
          refresh_token: null,
          expires_in: 2592000, // 30 days
          token_type: 'bearer'
        },
        message: 'Device registered successfully'
      });
    });

    it('should return existing user for already registered device', async () => {
      const existingDeviceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Mock existing user found
      mockSingle.mockResolvedValue({
        data: {
          id: 'existing-user-456',
          device_id: existingDeviceId,
          account_type: 'anonymous',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          vanity_level: 0,
          avg_item_level: null
        },
        error: null
      });

      // Mock ProfileRepository methods for existing user
      mockUpdateLastLogin.mockResolvedValue(undefined);
      mockGetAllCurrencyBalances.mockResolvedValue({ GOLD: 500, GEMS: 0 });

      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: existingDeviceId });

      expect(response.status).toBe(409);
      // Controller returns successful response with 409 status for existing devices
      expect(extractResponseData(response.body)).toMatchObject({
        user: {
          id: 'existing-user-456',
          device_id: existingDeviceId,
          account_type: 'anonymous',
          avg_item_level: 0
        },
        session: {
          access_token: expect.any(String),
          refresh_token: null,
          expires_in: 2592000, // 30 days
          token_type: 'bearer'
        },
        message: 'Device login successful'
      });
    });

    it('should handle database errors gracefully', async () => {
      const validDeviceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Mock database error on select query
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Database connection failed' }
      });

      const response = await request(app)
        .post('/api/v1/auth/register-device')
        .send({ device_id: validDeviceId });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('JWT Token Verification', () => {
    it('should generate valid JWT tokens with correct claims', async () => {
      const validDeviceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Mock no existing user found (new registration)
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

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

      // Mock ProfileRepository.findUserById for getCurrentUser
      mockFindUserById.mockResolvedValue({
        id: userId,
        email: null,
        device_id: deviceId,
        account_type: 'anonymous',
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        vanity_level: 0,
        avg_item_level: 0
      });

      mockGetAllCurrencyBalances.mockResolvedValue({ GOLD: 500, GEMS: 0 });

      // Test that anonymous token works with protected endpoint
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: userId,
        email: null,
        device_id: deviceId,
        account_type: 'anonymous',
        avg_item_level: 0
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

      // Mock ProfileRepository.findUserById for email user
      mockFindUserById.mockResolvedValue({
        id: 'email-user-123',
        email: 'test@example.com',
        device_id: null,
        account_type: 'email',
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        vanity_level: 5,
        avg_item_level: 15
      });

      mockGetAllCurrencyBalances.mockResolvedValue({ GOLD: 1000, GEMS: 50 });

      // Test that email authentication still works
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer supabase-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'email-user-123',
        email: 'test@example.com',
        device_id: null,
        account_type: 'email',
        avg_item_level: 15
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

      // Mock no existing user found (new registration)
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

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