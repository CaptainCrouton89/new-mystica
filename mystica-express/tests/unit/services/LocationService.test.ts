/**
 * Unit Tests: LocationService
 *
 * Tests business logic for location discovery using PostGIS
 */

import { DatabaseError, NotFoundError } from '../../../src/utils/errors';

// Create mock functions BEFORE importing anything that uses them
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

// Mock Supabase client BEFORE importing service
jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  }
}));

// Import after mocking
import { supabase } from '../../../src/config/supabase';
import { LocationService } from '../../../src/services/LocationService';

// Cast to access the mocked methods
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe('LocationService', () => {
  let locationService: LocationService;

  beforeEach(() => {
    locationService = new LocationService();
    jest.clearAllMocks();

    // Setup default mock chain for from()
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({ data: null, error: null });

    mockedSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    } as any);

    (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
      data: [],
      error: null
    });
  });

  describe('nearby()', () => {
    const validLat = 37.7749;
    const validLng = -122.4194;
    const validRadius = 5000;

    const mockLocations = [
      {
        id: 'loc-1',
        name: 'SF Main Library',
        lat: 37.7795,
        lng: -122.4156,
        location_type: 'library',
        state_code: 'CA',
        country_code: 'US',
        distance_meters: 610.3
      },
      {
        id: 'loc-2',
        name: 'Golden Gate Park',
        lat: 37.7694,
        lng: -122.4862,
        location_type: 'park',
        state_code: 'CA',
        country_code: 'US',
        distance_meters: 1200.5
      }
    ];

    it('should call get_nearby_locations RPC with correct parameters', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: mockLocations,
        error: null
      });

      await locationService.nearby(validLat, validLng, validRadius);

      expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: validLat,
        user_lng: validLng,
        search_radius: validRadius,
      });
    });

    it('should return locations sorted by distance', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: mockLocations,
        error: null
      });

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toEqual(mockLocations);
      expect(result).toHaveLength(2);
      expect(result[0].distance_meters).toBeLessThan(result[1].distance_meters);
    });

    it('should return empty array when no locations found', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null
      });

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when data is null', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: null
      });

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on Supabase error', async () => {
      const dbError = { message: 'PostGIS function not found' };
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: dbError
      });

      await expect(
        locationService.nearby(validLat, validLng, validRadius)
      ).rejects.toThrow(DatabaseError);

      await expect(
        locationService.nearby(validLat, validLng, validRadius)
      ).rejects.toThrow('PostGIS function not found');
    });

    it('should handle very small radius (1 meter)', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null
      });

      const result = await locationService.nearby(validLat, validLng, 1);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: validLat,
        user_lng: validLng,
        search_radius: 1,
      });
      expect(result).toEqual([]);
    });

    it('should handle large radius (50km)', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: mockLocations,
        error: null
      });

      const result = await locationService.nearby(validLat, validLng, 50000);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: validLat,
        user_lng: validLng,
        search_radius: 50000,
      });
      expect(result).toEqual(mockLocations);
    });

    it('should handle negative coordinates', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: mockLocations,
        error: null
      });

      // Test southern hemisphere and western hemisphere
      await locationService.nearby(-33.8688, 151.2093, 5000); // Sydney

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: -33.8688,
        user_lng: 151.2093,
        search_radius: 5000,
      });
    });

    it('should handle coordinates at extremes', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null
      });

      // North Pole
      await locationService.nearby(90, 0, 5000);
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 90,
        user_lng: 0,
        search_radius: 5000,
      });

      // South Pole
      await locationService.nearby(-90, 0, 5000);
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: -90,
        user_lng: 0,
        search_radius: 5000,
      });

      // International Date Line
      await locationService.nearby(0, 180, 5000);
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 0,
        user_lng: 180,
        search_radius: 5000,
      });
    });
  });

  describe('getById()', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';
    const mockLocation = {
      id: validId,
      name: 'Golden Gate Bridge',
      lat: 37.8199,
      lng: -122.4783,
      location_type: 'landmark',
      state_code: 'CA',
      country_code: 'US',
      created_at: new Date().toISOString()
    };

    it('should fetch location by ID', async () => {
      mockSingle.mockResolvedValue({
        data: mockLocation,
        error: null
      });

      const result = await locationService.getById(validId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('locations');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id', validId);
      expect(mockSingle).toHaveBeenCalled();
      expect(result).toEqual(mockLocation);
    });

    it('should throw NotFoundError when location does not exist', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(NotFoundError);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(`Location with identifier '${validId}' not found`);
    });

    it('should throw DatabaseError on Supabase error', async () => {
      const dbError = { message: 'Connection timeout' };
      mockSingle.mockResolvedValue({
        data: null,
        error: dbError
      });

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(DatabaseError);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow('Connection timeout');
    });

    it('should handle various UUID formats', async () => {
      const uuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '00000000-0000-0000-0000-000000000000'
      ];

      for (const uuid of uuids) {
        mockSingle.mockResolvedValue({
          data: { ...mockLocation, id: uuid },
          error: null
        });

        const result = await locationService.getById(uuid);
        expect(result.id).toBe(uuid);
      }
    });

    it('should preserve all location fields', async () => {
      const fullLocation = {
        ...mockLocation,
        state_code: 'CA',
        country_code: 'US',
        created_at: '2024-01-01T00:00:00Z'
      };

      mockSingle.mockResolvedValue({
        data: fullLocation,
        error: null
      });

      const result = await locationService.getById(validId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('lat');
      expect(result).toHaveProperty('lng');
      expect(result).toHaveProperty('location_type');
      expect(result).toHaveProperty('state_code');
      expect(result).toHaveProperty('country_code');
      expect(result).toHaveProperty('created_at');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle malformed Supabase responses', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue(undefined as any);

      await expect(
        locationService.nearby(37.7749, -122.4194, 5000)
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockedSupabase.rpc.mockRejectedValue(new Error('Network error'));

      await expect(
        locationService.nearby(37.7749, -122.4194, 5000)
      ).rejects.toThrow('Network error');
    });

    it('should handle unexpected data types in response', async () => {
      (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
        data: 'invalid-data-type' as any,
        error: null
      });

      const result = await locationService.nearby(37.7749, -122.4194, 5000);

      // Service returns data as-is when it's not null/undefined and no error
      // In production, this would be caught by TypeScript validation
      expect(result).toBe('invalid-data-type');
    });
  });
});
