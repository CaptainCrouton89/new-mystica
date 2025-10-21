/**
 * Integration Tests: Profile Endpoints
 *
 * Tests profile initialization and retrieval through HTTP endpoints
 */

import request from 'supertest';

// Mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSingle = jest.fn();

// Mock Supabase BEFORE importing app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
    },
    rpc: mockRpc,
    from: mockFrom
  }))
}));

// Import app AFTER mocking
import app from '../../src/app';

describe('Profile API Endpoints', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful auth mock
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: mockUserId,
          email: mockEmail,
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        }
      },
      error: null
    });

    // Setup chaining for RPC calls
    mockSingle.mockResolvedValue({
      data: null,
      error: null
    });

    mockRpc.mockReturnValue({
      single: mockSingle
    });
  });

  describe('POST /api/v1/profile/init', () => {
    it('should initialize new profile successfully', async () => {
      // Mock successful profile initialization
      const mockProfileData = {
        id: mockUserId,
        email: mockEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.profile).toMatchObject({
        id: mockUserId,
        user_id: mockUserId,
        email: mockEmail,
        username: '',
        gold: 0,
        vanity_level: 1,
        avg_item_level: 1
      });

      expect(mockRpc).toHaveBeenCalledWith('init_profile', {
        p_user_id: mockUserId,
        p_email: mockEmail
      });
    });

    it('should return 409 for duplicate profile initialization', async () => {
      // Mock conflict error
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'conflict:already_initialized Profile already initialized for user'
        }
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT_ERROR');
      expect(response.body.error.message).toContain('Profile already initialized');
    });

    it('should return 404 when no common weapons available', async () => {
      // Mock not found error
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'not_found:common_weapon_missing No common weapons available'
        }
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('No common weapons available');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/profile/init')
        .expect(401);

      expect(response.body.error.code).toBe('missing_token');
    });

    it('should return 401 with invalid token', async () => {
      mockGetClaims.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid token' }
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer invalid-token`)
        .expect(401);

      expect(response.body.error.code).toBe('invalid_token');
    });

    it('should handle database errors', async () => {
      // Mock generic database error
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Database connection failed',
          code: '08001'
        }
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(500);

      expect(response.body.error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('Validation Requirements', () => {
    it('should ensure starting gold is 0', async () => {
      const mockProfileData = {
        id: mockUserId,
        email: mockEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(response.body.profile.gold).toBe(0);
    });

    it('should call RPC with correct parameters', async () => {
      const mockProfileData = {
        id: mockUserId,
        email: mockEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('init_profile', {
        p_user_id: mockUserId,
        p_email: mockEmail
      });
    });

    it('should return profile with vanity_level set to 1', async () => {
      const mockProfileData = {
        id: mockUserId,
        email: mockEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(response.body.profile.vanity_level).toBe(1);
    });

    it('should return profile with avg_item_level set to 1', async () => {
      const mockProfileData = {
        id: mockUserId,
        email: mockEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(response.body.profile.avg_item_level).toBe(1);
    });

    it('should set username to empty string when null', async () => {
      const mockProfileData = {
        id: mockUserId,
        email: mockEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(response.body.profile.username).toBe('');
    });

    it('should include both id and user_id in response', async () => {
      const mockProfileData = {
        id: mockUserId,
        email: mockEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(response.body.profile.id).toBe(mockUserId);
      expect(response.body.profile.user_id).toBe(mockUserId);
    });

    it('should handle null data response', async () => {
      // Mock successful call but no data returned
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const response = await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(500);

      expect(response.body.error.code).toBe('DATABASE_ERROR');
      expect(response.body.error.message).toContain('Failed to create profile');
    });

    it('should use email from auth context', async () => {
      const customEmail = 'custom@example.com';

      mockGetClaims.mockResolvedValueOnce({
        data: {
          claims: {
            sub: mockUserId,
            email: customEmail,
            exp: Math.floor(Date.now() / 1000) + 3600
          }
        },
        error: null
      });

      const mockProfileData = {
        id: mockUserId,
        email: customEmail,
        username: null,
        vanity_level: 1,
        avg_item_level: 1,
        created_at: '2024-10-21T00:00:00Z',
        updated_at: '2024-10-21T00:00:00Z'
      };

      mockSingle.mockResolvedValueOnce({
        data: mockProfileData,
        error: null
      });

      await request(app)
        .post('/api/v1/profile/init')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(201);

      expect(mockRpc).toHaveBeenCalledWith('init_profile', {
        p_user_id: mockUserId,
        p_email: customEmail
      });
    });
  });
});