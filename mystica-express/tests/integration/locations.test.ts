/**
 * Integration Tests: Location Endpoints
 *
 * Tests geospatial location discovery endpoints with PostGIS
 */

import request from 'supertest';

// Create mock functions BEFORE importing app
const mockGetClaims = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();

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

describe('Location API Endpoints', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup valid auth by default
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

    // Default mock for database queries
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
    });

    // Default mock for RPC calls
    mockRpc.mockResolvedValue({
      data: [],
      error: null
    });
  });

  describe('GET /api/v1/locations/nearby', () => {
    const validCoords = { lat: 37.7749, lng: -122.4194 }; // SF Downtown
    const mockNearbyLocations = [
      {
        id: 'loc-1',
        name: 'Golden Gate Park',
        location_type: 'park',
        coordinates: { lat: 37.7694, lng: -122.4862 },
        distance: 1200
      },
      {
        id: 'loc-2',
        name: 'Lombard Street',
        location_type: 'landmark',
        coordinates: { lat: 37.8022, lng: -122.4187 },
        distance: 3100
      }
    ];

    it('should return locations within radius sorted by distance', async () => {
      mockRpc.mockResolvedValue({
        data: mockNearbyLocations,
        error: null
      });

      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: validCoords.lng, radius: 5000 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        locations: mockNearbyLocations
      });
      expect(mockRpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: validCoords.lat,
        user_lng: validCoords.lng,
        search_radius: 5000,
      });
    });

    it('should apply default radius of 5000 when not provided', async () => {
      mockRpc.mockResolvedValue({
        data: mockNearbyLocations,
        error: null
      });

      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: validCoords.lng })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: validCoords.lat,
        user_lng: validCoords.lng,
        search_radius: 5000, // Default applied
      });
    });

    it('should return empty array when no locations in radius', async () => {
      mockRpc.mockResolvedValue({
        data: [],
        error: null
      });

      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: validCoords.lng, radius: 100 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        locations: []
      });
    });

    it('should validate latitude bounds (-90 to 90)', async () => {
      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: 91, lng: validCoords.lng, radius: 5000 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Request validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'query.lat',
            message: 'Latitude must be between -90 and 90'
          })
        ])
      );
    });

    it('should validate longitude bounds (-180 to 180)', async () => {
      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: 181, radius: 5000 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Request validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'query.lng',
            message: 'Longitude must be between -180 and 180'
          })
        ])
      );
    });

    it('should validate radius (1 to 50000)', async () => {
      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: validCoords.lng, radius: 50001 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject radius less than 1', async () => {
      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: validCoords.lng, radius: 0 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication (401 without token)', async () => {
      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: validCoords.lng, radius: 5000 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });

    it('should return 400 for missing required coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat }) // Missing lng
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Request validation failed');
    });

    it('should handle database errors gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'PostGIS function not found' }
      });

      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: validCoords.lat, lng: validCoords.lng, radius: 5000 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
      expect(response.body.error.message).toContain('Database operation failed');
    });

    it('should handle coordinate type coercion', async () => {
      mockRpc.mockResolvedValue({
        data: mockNearbyLocations,
        error: null
      });

      const response = await request(app)
        .get('/api/v1/locations/nearby')
        .query({ lat: '37.7749', lng: '-122.4194', radius: '5000' }) // String inputs
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 37.7749, // Coerced to number
        user_lng: -122.4194,
        search_radius: 5000,
      });
    });
  });

  describe('GET /api/v1/locations/:id', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const mockLocation = {
      id: validUuid,
      name: 'Golden Gate Bridge',
      location_type: 'landmark',
      coordinates: { lat: 37.8199, lng: -122.4783 },
      description: 'Iconic suspension bridge',
      state: 'CA',
      country: 'US'
    };

    it('should return location by ID', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockLocation,
          error: null
        }),
      });

      const response = await request(app)
        .get(`/api/v1/locations/${validUuid}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockLocation);
      expect(mockFrom).toHaveBeenCalledWith('locations');
    });

    it('should return 404 for non-existent ID', async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        }),
      });

      const response = await request(app)
        .get(`/api/v1/locations/${validUuid}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/locations/invalid-uuid')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Request validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'params.id',
            message: 'Invalid location ID format'
          })
        ])
      );
    });

    it('should require authentication (401 without token)', async () => {
      const response = await request(app)
        .get(`/api/v1/locations/${validUuid}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_token');
    });

    it('should handle database errors gracefully', async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection timeout' }
        }),
      });

      const response = await request(app)
        .get(`/api/v1/locations/${validUuid}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
      expect(response.body.error.message).toContain('Database operation failed');
    });

    it('should reject requests with expired token', async () => {
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
        .get(`/api/v1/locations/${validUuid}`)
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('token_expired');
    });
  });
});