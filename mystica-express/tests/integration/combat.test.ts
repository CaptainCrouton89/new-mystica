/**
 * Integration Tests: Combat Endpoints
 *
 * Tests combat API validation, authentication, and request/response handling.
 * Note: Full combat flow logic is tested in unit tests (CombatService, CombatRepository)
 * These integration tests focus on HTTP layer concerns: auth, validation, error handling
 */

import request from 'supertest';

// Create mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

// Mock Supabase BEFORE importing app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
    },
    from: mockFrom,
    rpc: mockRpc
  }))
}));

// Import app AFTER mocking
import app from '../../src/app';

describe('Combat API Endpoints', () => {
  const validUserId = 'user-123';
  const validLocationId = '123e4567-e89b-12d3-a456-426614174000';
  const validSessionId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup valid auth by default
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: validUserId,
          email: 'test@example.com',
          exp: futureTime
        }
      },
      error: null
    });

    // Default mock chain
    const createMockChain = () => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
    });

    mockFrom.mockImplementation(() => createMockChain());
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  describe('POST /api/v1/combat/start', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/combat/start')
        .send({ location_id: validLocationId });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });

    it('should validate location_id format', async () => {
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send({ location_id: 'invalid-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Request validation failed');
    });

    it('should reject request without location_id', async () => {
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject expired JWT token', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600;
      mockGetClaims.mockResolvedValue({
        data: {
          claims: {
            sub: validUserId,
            email: 'test@example.com',
            exp: expiredTime
          }
        },
        error: null
      });

      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer expired-token')
        .send({ location_id: validLocationId });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('token_expired');
    });
  });

  describe('POST /api/v1/combat/attack', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 180
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });

    it('should validate tap_position_degrees range (0-360)', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 361
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.tap_position_degrees',
            message: 'Tap position must be between 0 and 360 degrees'
          })
        ])
      );
    });

    it('should reject negative tap_position_degrees', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate session_id is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: 'not-a-uuid',
          tap_position_degrees: 180
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid tap position at 0 degrees', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 0
        });

      // Will fail due to unmocked services, but validation passed
      expect(response.status).not.toBe(400);
    });

    it('should accept valid tap position at 360 degrees', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 360
        });

      // Will fail due to unmocked services, but validation passed
      expect(response.status).not.toBe(400);
    });
  });

  describe('POST /api/v1/combat/defend', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/combat/defend')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 270
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });

    it('should validate tap_position_degrees range (0-360)', async () => {
      const response = await request(app)
        .post('/api/v1/combat/defend')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 361
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.tap_position_degrees',
            message: 'Tap position must be between 0 and 360 degrees'
          })
        ])
      );
    });

    it('should reject negative tap_position_degrees', async () => {
      const response = await request(app)
        .post('/api/v1/combat/defend')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid tap position at 360 degrees', async () => {
      const response = await request(app)
        .post('/api/v1/combat/defend')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 360
        });

      // Will fail due to unmocked services, but validation passed
      expect(response.status).not.toBe(400);
    });

    it('should accept valid tap position at 0 degrees', async () => {
      const response = await request(app)
        .post('/api/v1/combat/defend')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          tap_position_degrees: 0
        });

      // Will fail due to unmocked services, but validation passed
      expect(response.status).not.toBe(400);
    });
  });

  describe('POST /api/v1/combat/complete', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .send({
          session_id: validSessionId,
          result: 'victory'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });

    it('should validate result enum (victory or defeat only)', async () => {
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          result: 'draw'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept victory result', async () => {
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          result: 'victory'
        });

      // Will fail due to unmocked services, but validation passed
      expect(response.status).not.toBe(400);
    });

    it('should accept defeat result', async () => {
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: validSessionId,
          result: 'defeat'
        });

      // Will fail due to unmocked services, but validation passed
      expect(response.status).not.toBe(400);
    });

    it('should validate session_id format', async () => {
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          session_id: 'invalid-uuid',
          result: 'victory'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Request Body Validation', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should reject empty request body for /start', async () => {
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing required fields for /attack', async () => {
      const response = await request(app)
        .post('/api/v1/combat/attack')
        .set('Authorization', 'Bearer valid-token')
        .send({ session_id: validSessionId });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Content-Type Validation', () => {
    it('should accept application/json content type', async () => {
      const response = await request(app)
        .post('/api/v1/combat/start')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ location_id: validLocationId }));

      // Should pass content-type check (may fail on service layer)
      expect(response.status).not.toBe(415);
    });

    it('should handle missing session_id in complete endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/combat/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({ result: 'victory' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
