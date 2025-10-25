/**
 * Unit Tests: LocationService with Repository Pattern
 *
 * Tests business logic for location discovery and combat pool operations using mocked LocationRepository.
 * These tests focus on service layer behavior without direct Supabase dependencies.
 */

import { DatabaseError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';
import { LocationService } from '../../../src/services/LocationService.js';
import { LocationFactory } from '../../factories/location.factory.js';
import type { LocationWithDistance, EnemyPoolMember, LootPoolEntry, LootDrop } from '../../../src/types/repository.types.js';
import type { Database } from '../../../src/types/database.types.js';

type Location = Database['public']['Tables']['locations']['Row'];

// Mock LocationRepository
jest.mock('../../../src/repositories/LocationRepository.js', () => ({
  locationRepository: {
    findNearby: jest.fn(),
    findById: jest.fn(),
    findByType: jest.fn(),
    findByRegion: jest.fn(),
    findAll: jest.fn(),
    getMatchingEnemyPools: jest.fn(),
    getEnemyPoolMembers: jest.fn(),
    selectRandomEnemy: jest.fn(),
    getMatchingLootPools: jest.fn(),
    getLootPoolEntries: jest.fn(),
    getLootPoolTierWeights: jest.fn(),
    selectRandomLoot: jest.fn(),
    getAggregatedEnemyPools: jest.fn(),
    getAggregatedLootPools: jest.fn(),
  }
}));

describe('LocationService (Repository Pattern)', () => {
  let locationService: LocationService;
  let mockFindNearby: jest.MockedFunction<any>;
  let mockFindById: jest.MockedFunction<any>;
  let mockFindByType: jest.MockedFunction<any>;
  let mockFindByRegion: jest.MockedFunction<any>;
  let mockFindAll: jest.MockedFunction<any>;
  let mockGetMatchingEnemyPools: jest.MockedFunction<any>;
  let mockGetEnemyPoolMembers: jest.MockedFunction<any>;
  let mockSelectRandomEnemy: jest.MockedFunction<any>;
  let mockGetMatchingLootPools: jest.MockedFunction<any>;
  let mockGetLootPoolEntries: jest.MockedFunction<any>;
  let mockGetLootPoolTierWeights: jest.MockedFunction<any>;
  let mockSelectRandomLoot: jest.MockedFunction<any>;
  let mockGetAggregatedEnemyPools: jest.MockedFunction<any>;
  let mockGetAggregatedLootPools: jest.MockedFunction<any>;

  beforeEach(() => {
    locationService = new LocationService();

    // Get the mocked repository
    const { locationRepository } = require('../../../src/repositories/LocationRepository.js');
    mockFindNearby = locationRepository.findNearby as jest.MockedFunction<any>;
    mockFindById = locationRepository.findById as jest.MockedFunction<any>;
    mockFindByType = locationRepository.findByType as jest.MockedFunction<any>;
    mockFindByRegion = locationRepository.findByRegion as jest.MockedFunction<any>;
    mockFindAll = locationRepository.findAll as jest.MockedFunction<any>;
    mockGetMatchingEnemyPools = locationRepository.getMatchingEnemyPools as jest.MockedFunction<any>;
    mockGetEnemyPoolMembers = locationRepository.getEnemyPoolMembers as jest.MockedFunction<any>;
    mockSelectRandomEnemy = locationRepository.selectRandomEnemy as jest.MockedFunction<any>;
    mockGetMatchingLootPools = locationRepository.getMatchingLootPools as jest.MockedFunction<any>;
    mockGetLootPoolEntries = locationRepository.getLootPoolEntries as jest.MockedFunction<any>;
    mockGetLootPoolTierWeights = locationRepository.getLootPoolTierWeights as jest.MockedFunction<any>;
    mockSelectRandomLoot = locationRepository.selectRandomLoot as jest.MockedFunction<any>;
    mockGetAggregatedEnemyPools = locationRepository.getAggregatedEnemyPools as jest.MockedFunction<any>;
    mockGetAggregatedLootPools = locationRepository.getAggregatedLootPools as jest.MockedFunction<any>;

    jest.clearAllMocks();
  });

  describe('nearby()', () => {
    const validLat = 37.7749;
    const validLng = -122.4194;
    const validRadius = 5000;

    const mockLocationsWithDistance: LocationWithDistance[] = [
      {
        id: 'location-1',
        name: 'SF Main Library',
        lat: 37.7795,
        lng: -122.4156,
        location_type: 'library',
        state_code: 'CA',
        country_code: 'US',
        distance_meters: 610.3
      },
      {
        id: 'location-2',
        name: 'Golden Gate Park',
        lat: 37.7694,
        lng: -122.4862,
        location_type: 'park',
        state_code: 'CA',
        country_code: 'US',
        distance_meters: 1200.5
      }
    ];

    it('should delegate to locationRepository.findNearby with correct parameters', async () => {
      mockFindNearby.mockResolvedValue(mockLocationsWithDistance);

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(mockFindNearby).toHaveBeenCalledTimes(1);
      expect(mockFindNearby).toHaveBeenCalledWith(validLat, validLng, validRadius);
      expect(result).toEqual(mockLocationsWithDistance);
    });

    it('should return locations with distance data ordered by proximity', async () => {
      mockFindNearby.mockResolvedValue(mockLocationsWithDistance);

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toHaveLength(2);
      expect(result[0].distance_meters).toBeLessThan(result[1].distance_meters);
      expect(result[0]).toHaveProperty('distance_meters');
      expect(result[1]).toHaveProperty('distance_meters');
    });

    it('should return empty array when no locations found', async () => {
      mockFindNearby.mockResolvedValue([]);

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should propagate repository DatabaseError', async () => {
      const repositoryError = new DatabaseError('PostGIS function not available');
      mockFindNearby.mockRejectedValue(repositoryError);

      await expect(
        locationService.nearby(validLat, validLng, validRadius)
      ).rejects.toThrow(DatabaseError);

      await expect(
        locationService.nearby(validLat, validLng, validRadius)
      ).rejects.toThrow('PostGIS function not available');
    });

    it('should handle various coordinate ranges correctly', async () => {
      mockFindNearby.mockResolvedValue([]);

      // Test various coordinate combinations
      const testCases = [
        { lat: 90, lng: 0, desc: 'North Pole' },
        { lat: -90, lng: 0, desc: 'South Pole' },
        { lat: 0, lng: 180, desc: 'International Date Line East' },
        { lat: 0, lng: -180, desc: 'International Date Line West' },
        { lat: -33.8688, lng: 151.2093, desc: 'Sydney, Australia' },
        { lat: 55.7558, lng: 37.6173, desc: 'Moscow, Russia' },
      ];

      for (const testCase of testCases) {
        await locationService.nearby(testCase.lat, testCase.lng, validRadius);
        expect(mockFindNearby).toHaveBeenCalledWith(testCase.lat, testCase.lng, validRadius);
      }

      expect(mockFindNearby).toHaveBeenCalledTimes(testCases.length);
    });

    it('should handle various radius values correctly', async () => {
      mockFindNearby.mockResolvedValue([]);

      const radiusTestCases = [
        { radius: 1, desc: 'minimum radius' },
        { radius: 50, desc: 'spawn radius' },
        { radius: 1000, desc: '1km radius' },
        { radius: 5000, desc: 'default radius' },
        { radius: 50000, desc: 'maximum radius' },
      ];

      for (const testCase of radiusTestCases) {
        await locationService.nearby(validLat, validLng, testCase.radius);
        expect(mockFindNearby).toHaveBeenCalledWith(validLat, validLng, testCase.radius);
      }

      expect(mockFindNearby).toHaveBeenCalledTimes(radiusTestCases.length);
    });

    it('should preserve location metadata in results', async () => {
      const detailedLocation: LocationWithDistance = {
        id: 'location-detailed',
        name: 'Test Restaurant',
        lat: 37.7749,
        lng: -122.4194,
        location_type: 'restaurant',
        state_code: 'CA',
        country_code: 'US',
        distance_meters: 0
      };

      mockFindNearby.mockResolvedValue([detailedLocation]);

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result[0]).toMatchObject({
        id: expect.any(String),
        name: 'Test Restaurant',
        lat: 37.7749,
        lng: -122.4194,
        location_type: 'restaurant',
        state_code: 'CA',
        country_code: 'US',
        distance_meters: 0
      });
    });

    it('should handle repository exceptions gracefully', async () => {
      const unexpectedError = new Error('Unexpected repository failure');
      mockFindNearby.mockRejectedValue(unexpectedError);

      await expect(
        locationService.nearby(validLat, validLng, validRadius)
      ).rejects.toThrow('Unexpected repository failure');
    });

    it('should use default radius when not provided', async () => {
      mockFindNearby.mockResolvedValue([]);

      await locationService.nearby(validLat, validLng);

      expect(mockFindNearby).toHaveBeenCalledWith(validLat, validLng, 5000);
    });

    it('should validate latitude bounds', async () => {
      await expect(
        locationService.nearby(-91, validLng, validRadius)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(91, validLng, validRadius)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(-91, validLng, validRadius)
      ).rejects.toThrow('Latitude must be between -90 and 90');
    });

    it('should validate longitude bounds', async () => {
      await expect(
        locationService.nearby(validLat, -181, validRadius)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(validLat, 181, validRadius)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(validLat, 181, validRadius)
      ).rejects.toThrow('Longitude must be between -180 and 180');
    });

    it('should validate radius bounds', async () => {
      await expect(
        locationService.nearby(validLat, validLng, 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(validLat, validLng, -100)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(validLat, validLng, 50001)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(validLat, validLng, 50001)
      ).rejects.toThrow('Radius must be between 1 and 50000 meters');
    });

    it('should accept valid coordinate and radius bounds', async () => {
      mockFindNearby.mockResolvedValue([]);

      // Test boundary values that should be valid
      await expect(locationService.nearby(-90, -180, 1)).resolves.toEqual([]);
      await expect(locationService.nearby(90, 180, 50000)).resolves.toEqual([]);
      await expect(locationService.nearby(0, 0, 25000)).resolves.toEqual([]);
    });
  });

  describe('getById()', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';
    const mockLocation: Location = LocationFactory.createAtCoordinates(37.8199, -122.4783, 'landmark', {
      id: validId,
      name: 'Golden Gate Bridge',
      state_code: 'CA',
      country_code: 'US'
    });

    it('should delegate to locationRepository.findById with correct ID', async () => {
      mockFindById.mockResolvedValue(mockLocation);

      const result = await locationService.getById(validId);

      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledWith(validId);
      expect(result).toEqual(mockLocation);
    });

    it('should return complete location data when found', async () => {
      mockFindById.mockResolvedValue(mockLocation);

      const result = await locationService.getById(validId);

      expect(result).toMatchObject({
        id: validId,
        name: 'Golden Gate Bridge',
        lat: 37.8199,
        lng: -122.4783,
        location_type: 'landmark',
        state_code: 'CA',
        country_code: 'US',
        created_at: expect.any(String)
      });
    });

    it('should throw NotFoundError when repository returns null', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(NotFoundError);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(`Location with identifier '${validId}' not found`);
    });

    it('should throw NotFoundError when repository returns undefined', async () => {
      mockFindById.mockResolvedValue(undefined);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should propagate repository DatabaseError', async () => {
      const repositoryError = new DatabaseError('Connection timeout');
      mockFindById.mockRejectedValue(repositoryError);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(DatabaseError);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow('Connection timeout');
    });

    it('should handle various UUID formats correctly', async () => {
      const uuidTestCases = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff'
      ];

      for (const uuid of uuidTestCases) {
        const location = LocationFactory.createAtCoordinates(37.7749, -122.4194, 'test', { id: uuid });
        mockFindById.mockResolvedValue(location);

        const result = await locationService.getById(uuid);

        expect(mockFindById).toHaveBeenCalledWith(uuid);
        expect(result.id).toBe(uuid);
      }

      expect(mockFindById).toHaveBeenCalledTimes(uuidTestCases.length);
    });

    it('should preserve all location fields from repository', async () => {
      const fullLocation: Location = {
        id: validId,
        name: 'Complete Location',
        lat: 37.7749,
        lng: -122.4194,
        location_type: 'park',
        state_code: 'NY',
        country_code: 'US',
        image_url: null,
        created_at: '2024-01-01T00:00:00Z'
      };

      mockFindById.mockResolvedValue(fullLocation);

      const result = await locationService.getById(validId);

      // Verify all fields are preserved exactly
      expect(result).toEqual(fullLocation);
      expect(result).toHaveProperty('id', validId);
      expect(result).toHaveProperty('name', 'Complete Location');
      expect(result).toHaveProperty('lat', 37.7749);
      expect(result).toHaveProperty('lng', -122.4194);
      expect(result).toHaveProperty('location_type', 'park');
      expect(result).toHaveProperty('state_code', 'NY');
      expect(result).toHaveProperty('country_code', 'US');
      expect(result).toHaveProperty('created_at', '2024-01-01T00:00:00Z');
    });

    it('should handle repository exceptions gracefully', async () => {
      const unexpectedError = new Error('Repository connection failed');
      mockFindById.mockRejectedValue(unexpectedError);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow('Repository connection failed');

      expect(mockFindById).toHaveBeenCalledWith(validId);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle concurrent calls to nearby() correctly', async () => {
      const locations1 = [LocationFactory.createSF('park', { image_url: null })];
      const locations2 = [LocationFactory.createSF('library', { image_url: null })];

      mockFindNearby
        .mockResolvedValueOnce(locations1.map(loc => ({ ...loc, distance_meters: 100 })))
        .mockResolvedValueOnce(locations2.map(loc => ({ ...loc, distance_meters: 200 })));

      const [result1, result2] = await Promise.all([
        locationService.nearby(37.7749, -122.4194, 1000),
        locationService.nearby(37.7849, -122.4094, 2000)
      ]);

      expect(result1).toEqual(locations1.map(loc => ({ ...loc, distance_meters: 100 })));
      expect(result2).toEqual(locations2.map(loc => ({ ...loc, distance_meters: 200 })));
      expect(mockFindNearby).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent calls to getById() correctly', async () => {
      const location1 = LocationFactory.createSF('park', { id: 'id-1' });
      const location2 = LocationFactory.createSF('library', { id: 'id-2' });

      mockFindById
        .mockResolvedValueOnce(location1)
        .mockResolvedValueOnce(location2);

      const [result1, result2] = await Promise.all([
        locationService.getById('id-1'),
        locationService.getById('id-2')
      ]);

      expect(result1).toEqual(location1);
      expect(result2).toEqual(location2);
      expect(mockFindById).toHaveBeenCalledTimes(2);
      expect(mockFindById).toHaveBeenCalledWith('id-1');
      expect(mockFindById).toHaveBeenCalledWith('id-2');
    });

    it('should maintain repository method isolation', async () => {
      // Test that failure in one method doesn't affect the other
      mockFindNearby.mockRejectedValue(new DatabaseError('PostGIS error'));
      mockFindById.mockResolvedValue(LocationFactory.createSF('park', { image_url: null }));

      // nearby() should fail
      await expect(
        locationService.nearby(37.7749, -122.4194, 5000)
      ).rejects.toThrow(DatabaseError);

      // But getById() should still work
      const result = await locationService.getById('test-id');
      expect(result).toBeDefined();
      expect(result.location_type).toBe('park');
    });

    it('should handle very large result sets from repository', async () => {
      // Create a large number of mock locations
      const largeLocationSet: LocationWithDistance[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `location-${i}`,
        name: `SF Landmark ${i}`,
        lat: 37.7749 + (i * 0.001),
        lng: -122.4194 + (i * 0.001),
        location_type: 'landmark',
        state_code: 'CA',
        country_code: 'US',
        distance_meters: i * 10
      }));

      mockFindNearby.mockResolvedValue(largeLocationSet);

      const result = await locationService.nearby(37.7749, -122.4194, 50000);

      expect(result).toHaveLength(1000);
      expect(result).toEqual(largeLocationSet);
      expect(mockFindNearby).toHaveBeenCalledWith(37.7749, -122.4194, 50000);
    });

    it('should handle falsy values from repository gracefully', async () => {
      // Test null
      mockFindById.mockResolvedValue(null);
      await expect(locationService.getById('test-id')).rejects.toThrow(NotFoundError);

      // Test undefined
      mockFindById.mockResolvedValue(undefined);
      await expect(locationService.getById('test-id')).rejects.toThrow(NotFoundError);

      // Test empty array for nearby
      mockFindNearby.mockResolvedValue([]);
      const result = await locationService.nearby(37.7749, -122.4194, 5000);
      expect(result).toEqual([]);
    });
  });

  describe('Performance and validation edge cases', () => {
    it('should pass through extreme coordinate values to repository', async () => {
      mockFindNearby.mockResolvedValue([]);

      // Test boundary values
      await locationService.nearby(90, 180, 1);
      expect(mockFindNearby).toHaveBeenCalledWith(90, 180, 1);

      await locationService.nearby(-90, -180, 50000);
      expect(mockFindNearby).toHaveBeenCalledWith(-90, -180, 50000);

      await locationService.nearby(0, 0, 25000);
      expect(mockFindNearby).toHaveBeenCalledWith(0, 0, 25000);
    });

    it('should pass through precision coordinates to repository', async () => {
      mockFindNearby.mockResolvedValue([]);

      // Test high precision coordinates
      const precisionLat = 37.77492134567890;
      const precisionLng = -122.41944234567890;

      await locationService.nearby(precisionLat, precisionLng, 5000);
      expect(mockFindNearby).toHaveBeenCalledWith(precisionLat, precisionLng, 5000);
    });

    it('should handle repository timeouts gracefully', async () => {
      jest.setTimeout(15000); // Extend timeout for this test

      const timeoutError = new DatabaseError('Query timeout');
      mockFindNearby.mockRejectedValue(timeoutError);

      await expect(
        locationService.nearby(37.7749, -122.4194, 5000)
      ).rejects.toThrow('Query timeout');
    });

    it('should preserve location type variations from repository', async () => {
      const locationTypes = [
        'library', 'park', 'restaurant', 'shop', 'school',
        'landmark', 'gym', 'hospital', 'bank', 'gas_station'
      ];

      for (const locationType of locationTypes) {
        const location = LocationFactory.createSF(locationType);
        mockFindById.mockResolvedValue(location);

        const result = await locationService.getById(`id-${locationType}`);
        expect(result.location_type).toBe(locationType);
      }

      expect(mockFindById).toHaveBeenCalledTimes(locationTypes.length);
    });
  });

  describe('getByType()', () => {
    it('should delegate to locationRepository.findByType with trimmed type', async () => {
      const locationType = 'library';
      const mockLocations = [
        LocationFactory.createSF(locationType),
        LocationFactory.createSF(locationType)
      ];

      mockFindByType.mockResolvedValue(mockLocations);

      const result = await locationService.getByType(locationType);

      expect(mockFindByType).toHaveBeenCalledWith(locationType);
      expect(result).toEqual(mockLocations);
    });

    it('should trim whitespace from location type', async () => {
      mockFindByType.mockResolvedValue([]);

      await locationService.getByType('  restaurant  ');

      expect(mockFindByType).toHaveBeenCalledWith('restaurant');
    });

    it('should throw ValidationError for empty location type', async () => {
      await expect(locationService.getByType('')).rejects.toThrow(ValidationError);
      await expect(locationService.getByType('   ')).rejects.toThrow(ValidationError);
      await expect(locationService.getByType('   ')).rejects.toThrow('Location type is required');
    });

    it('should handle various location types', async () => {
      const locationTypes = ['library', 'park', 'restaurant', 'gym', 'hospital'];

      for (const type of locationTypes) {
        mockFindByType.mockResolvedValue([LocationFactory.createSF(type)]);
        const result = await locationService.getByType(type);
        expect(result[0].location_type).toBe(type);
      }
    });
  });

  describe('getByRegion()', () => {
    it('should delegate to locationRepository.findByRegion with trimmed codes', async () => {
      const stateCode = 'CA';
      const countryCode = 'US';
      const mockLocations = [LocationFactory.createSF('park', { state_code: stateCode, country_code: countryCode })];

      mockFindByRegion.mockResolvedValue(mockLocations);

      const result = await locationService.getByRegion(stateCode, countryCode);

      expect(mockFindByRegion).toHaveBeenCalledWith(stateCode, countryCode);
      expect(result).toEqual(mockLocations);
    });

    it('should trim whitespace from codes', async () => {
      mockFindByRegion.mockResolvedValue([]);

      await locationService.getByRegion('  NY  ', '  US  ');

      expect(mockFindByRegion).toHaveBeenCalledWith('NY', 'US');
    });

    it('should throw ValidationError for missing state code', async () => {
      await expect(locationService.getByRegion('', 'US')).rejects.toThrow(ValidationError);
      await expect(locationService.getByRegion('', 'US')).rejects.toThrow('Both state code and country code are required');
    });

    it('should throw ValidationError for missing country code', async () => {
      await expect(locationService.getByRegion('CA', '')).rejects.toThrow(ValidationError);
      await expect(locationService.getByRegion('CA', '')).rejects.toThrow('Both state code and country code are required');
    });
  });

  describe('getAll()', () => {
    it('should delegate to locationRepository.findAll with pagination', async () => {
      const mockLocations = [LocationFactory.createSF('park', { image_url: null }), LocationFactory.createSF('library', { image_url: null })];
      mockFindAll.mockResolvedValue(mockLocations);

      const result = await locationService.getAll(10, 20);

      expect(mockFindAll).toHaveBeenCalledWith(10, 20);
      expect(result).toEqual(mockLocations);
    });

    it('should allow undefined limit and offset', async () => {
      mockFindAll.mockResolvedValue([]);

      await locationService.getAll();

      expect(mockFindAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should validate limit bounds', async () => {
      await expect(locationService.getAll(0)).rejects.toThrow(ValidationError);
      await expect(locationService.getAll(-5)).rejects.toThrow(ValidationError);
      await expect(locationService.getAll(1001)).rejects.toThrow(ValidationError);
      await expect(locationService.getAll(1001)).rejects.toThrow('Limit must be between 1 and 1000');
    });

    it('should validate offset bounds', async () => {
      await expect(locationService.getAll(10, -1)).rejects.toThrow(ValidationError);
      await expect(locationService.getAll(10, -1)).rejects.toThrow('Offset must be non-negative');
    });

    it('should accept valid pagination values', async () => {
      mockFindAll.mockResolvedValue([]);

      await expect(locationService.getAll(1, 0)).resolves.toEqual([]);
      await expect(locationService.getAll(1000, 999)).resolves.toEqual([]);
    });
  });

  describe('Combat Pool Operations', () => {
    const locationId = 'location-123';
    const combatLevel = 5;
    const mockLocation = LocationFactory.createSF('library', { id: locationId });

    beforeEach(() => {
      mockFindById.mockResolvedValue(mockLocation);
    });

    describe('getMatchingEnemyPools()', () => {
      it('should validate combat level bounds', async () => {
        await expect(locationService.getMatchingEnemyPools(locationId, 0)).rejects.toThrow(ValidationError);
        await expect(locationService.getMatchingEnemyPools(locationId, -1)).rejects.toThrow(ValidationError);
        await expect(locationService.getMatchingEnemyPools(locationId, 101)).rejects.toThrow(ValidationError);
        await expect(locationService.getMatchingEnemyPools(locationId, 101)).rejects.toThrow('Combat level must be between 1 and 100');
      });

      it('should fetch location and delegate to repository', async () => {
        const mockPoolIds = ['pool-1', 'pool-2'];
        mockGetMatchingEnemyPools.mockResolvedValue(mockPoolIds);

        const result = await locationService.getMatchingEnemyPools(locationId, combatLevel);

        expect(mockFindById).toHaveBeenCalledWith(locationId);
        expect(mockGetMatchingEnemyPools).toHaveBeenCalledWith(mockLocation, combatLevel);
        expect(result).toEqual(mockPoolIds);
      });

      it('should throw NotFoundError if location does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await expect(
          locationService.getMatchingEnemyPools('invalid-id', combatLevel)
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe('getEnemyPoolMembers()', () => {
      it('should validate pool IDs array', async () => {
        await expect(locationService.getEnemyPoolMembers([])).rejects.toThrow(ValidationError);
        await expect(locationService.getEnemyPoolMembers([])).rejects.toThrow('At least one pool ID is required');
      });

      it('should delegate to repository with pool IDs', async () => {
        const poolIds = ['pool-1', 'pool-2'];
        const mockMembers: EnemyPoolMember[] = [
          { enemy_type_id: 'goblin', spawn_weight: 100, enemy_pool_id: 'pool-1' },
          { enemy_type_id: 'orc', spawn_weight: 80, enemy_pool_id: 'pool-2' }
        ];

        mockGetEnemyPoolMembers.mockResolvedValue(mockMembers);

        const result = await locationService.getEnemyPoolMembers(poolIds);

        expect(mockGetEnemyPoolMembers).toHaveBeenCalledWith(poolIds);
        expect(result).toEqual(mockMembers);
      });
    });

    describe('selectRandomEnemy()', () => {
      it('should validate pool members array', async () => {
        expect(() => locationService.selectRandomEnemy([])).toThrow(ValidationError);
        expect(() => locationService.selectRandomEnemy([])).toThrow('No enemy pool members provided');
      });

      it('should delegate to repository selection algorithm', () => {
        const poolMembers = [
          { enemy_type_id: 'goblin', spawn_weight: 100 },
          { enemy_type_id: 'orc', spawn_weight: 80 }
        ];
        const selectedEnemy = 'goblin';

        mockSelectRandomEnemy.mockReturnValue(selectedEnemy);

        const result = locationService.selectRandomEnemy(poolMembers);

        expect(mockSelectRandomEnemy).toHaveBeenCalledWith(poolMembers);
        expect(result).toBe(selectedEnemy);
      });
    });

    describe('getMatchingLootPools()', () => {
      it('should validate combat level bounds', async () => {
        await expect(locationService.getMatchingLootPools(locationId, 0)).rejects.toThrow(ValidationError);
        await expect(locationService.getMatchingLootPools(locationId, 101)).rejects.toThrow(ValidationError);
      });

      it('should fetch location and delegate to repository', async () => {
        const mockPoolIds = ['loot-pool-1', 'loot-pool-2'];
        mockGetMatchingLootPools.mockResolvedValue(mockPoolIds);

        const result = await locationService.getMatchingLootPools(locationId, combatLevel);

        expect(mockFindById).toHaveBeenCalledWith(locationId);
        expect(mockGetMatchingLootPools).toHaveBeenCalledWith(mockLocation, combatLevel);
        expect(result).toEqual(mockPoolIds);
      });
    });

    describe('getLootPoolEntries()', () => {
      it('should validate pool IDs array', async () => {
        await expect(locationService.getLootPoolEntries([])).rejects.toThrow(ValidationError);
        await expect(locationService.getLootPoolEntries([])).rejects.toThrow('At least one pool ID is required');
      });

      it('should delegate to repository', async () => {
        const poolIds = ['pool-1'];
        const mockEntries: LootPoolEntry[] = [
          { lootable_type: 'material', lootable_id: 'iron', drop_weight: 100, loot_pool_id: 'pool-1' }
        ];

        mockGetLootPoolEntries.mockResolvedValue(mockEntries);

        const result = await locationService.getLootPoolEntries(poolIds);

        expect(mockGetLootPoolEntries).toHaveBeenCalledWith(poolIds);
        expect(result).toEqual(mockEntries);
      });
    });

    describe('getLootPoolTierWeights()', () => {
      it('should validate pool IDs array', async () => {
        await expect(locationService.getLootPoolTierWeights([])).rejects.toThrow(ValidationError);
      });

      it('should delegate to repository', async () => {
        const poolIds = ['pool-1'];
        const mockWeights = [{ tier_name: 'common', weight_multiplier: 1.0 }];

        mockGetLootPoolTierWeights.mockResolvedValue(mockWeights);

        const result = await locationService.getLootPoolTierWeights(poolIds);

        expect(mockGetLootPoolTierWeights).toHaveBeenCalledWith(poolIds);
        expect(result).toEqual(mockWeights);
      });
    });

    describe('selectRandomLoot()', () => {
      it('should validate pool entries array', () => {
        expect(() => locationService.selectRandomLoot([], [], 'normal', 1)).toThrow(ValidationError);
        expect(() => locationService.selectRandomLoot([], [], 'normal', 1)).toThrow('No loot pool entries provided');
      });

      it('should validate drop count bounds', () => {
        const entries = [{ lootable_type: 'material', lootable_id: 'iron', drop_weight: 100, loot_pool_id: 'pool-1' }];

        expect(() => locationService.selectRandomLoot(entries, [], 'normal', 0)).toThrow(ValidationError);
        expect(() => locationService.selectRandomLoot(entries, [], 'normal', 11)).toThrow(ValidationError);
        expect(() => locationService.selectRandomLoot(entries, [], 'normal', 11)).toThrow('Drop count must be between 1 and 10');
      });

      it('should delegate to repository with style inheritance', () => {
        const poolEntries = [{ lootable_type: 'material', lootable_id: 'iron', drop_weight: 100, loot_pool_id: 'pool-1' }];
        const tierWeights = [{ tier_name: 'common', weight_multiplier: 1.0 }];
        const mockDrops: LootDrop[] = [{ type: 'material', material_id: 'iron', style_id: 'pixel_art' }];

        mockSelectRandomLoot.mockReturnValue(mockDrops);

        const result = locationService.selectRandomLoot(poolEntries, tierWeights, 'pixel_art', 2);

        expect(mockSelectRandomLoot).toHaveBeenCalledWith(poolEntries, tierWeights, 'pixel_art', 2);
        expect(result).toEqual(mockDrops);
      });

      it('should use default values for optional parameters', () => {
        const poolEntries = [{ lootable_type: 'material', lootable_id: 'iron', drop_weight: 100, loot_pool_id: 'pool-1' }];
        mockSelectRandomLoot.mockReturnValue([]);

        locationService.selectRandomLoot(poolEntries, []);

        expect(mockSelectRandomLoot).toHaveBeenCalledWith(poolEntries, [], 'normal', 1);
      });
    });
  });

  describe('Aggregated Pool Operations (Future RPC)', () => {
    const locationId = 'location-123';
    const combatLevel = 5;

    describe('getAggregatedEnemyPools()', () => {
      it('should validate combat level bounds', async () => {
        await expect(locationService.getAggregatedEnemyPools(locationId, 0)).rejects.toThrow(ValidationError);
        await expect(locationService.getAggregatedEnemyPools(locationId, 101)).rejects.toThrow(ValidationError);
      });

      it('should delegate to repository', async () => {
        const mockAggregated = { enemies: [{ enemy_type_id: 'goblin', total_weight: 200 }] };
        mockGetAggregatedEnemyPools.mockResolvedValue(mockAggregated);

        const result = await locationService.getAggregatedEnemyPools(locationId, combatLevel);

        expect(mockGetAggregatedEnemyPools).toHaveBeenCalledWith(locationId, combatLevel);
        expect(result).toEqual(mockAggregated);
      });
    });

    describe('getAggregatedLootPools()', () => {
      it('should validate combat level bounds', async () => {
        await expect(locationService.getAggregatedLootPools(locationId, 0)).rejects.toThrow(ValidationError);
        await expect(locationService.getAggregatedLootPools(locationId, 101)).rejects.toThrow(ValidationError);
      });

      it('should delegate to repository', async () => {
        const mockAggregated = { loot: [{ loot_id: 'iron', adjusted_weight: 150 }] };
        mockGetAggregatedLootPools.mockResolvedValue(mockAggregated);

        const result = await locationService.getAggregatedLootPools(locationId, combatLevel);

        expect(mockGetAggregatedLootPools).toHaveBeenCalledWith(locationId, combatLevel);
        expect(result).toEqual(mockAggregated);
      });
    });
  });
});