/**
 * Unit Tests: LocationService
 *
 * Tests business logic for location discovery using PostGIS
 */

import { DatabaseError, NotFoundError, ValidationError } from '../../../src/utils/errors';

// Mock LocationRepository methods
const mockFindNearby = jest.fn();
const mockFindById = jest.fn();
const mockFindByType = jest.fn();
const mockFindByRegion = jest.fn();
const mockFindAll = jest.fn();
const mockGetMatchingEnemyPools = jest.fn();
const mockGetEnemyPoolMembers = jest.fn();
const mockSelectRandomEnemy = jest.fn();
const mockGetMatchingLootPools = jest.fn();
const mockGetLootPoolEntries = jest.fn();
const mockGetLootPoolTierWeights = jest.fn();
const mockSelectRandomLoot = jest.fn();
const mockGetAggregatedEnemyPools = jest.fn();
const mockGetAggregatedLootPools = jest.fn();

// Mock LocationRepository BEFORE importing service
jest.mock('../../../src/repositories/LocationRepository.js', () => ({
  locationRepository: {
    findNearby: mockFindNearby,
    findById: mockFindById,
    findByType: mockFindByType,
    findByRegion: mockFindByRegion,
    findAll: mockFindAll,
    getMatchingEnemyPools: mockGetMatchingEnemyPools,
    getEnemyPoolMembers: mockGetEnemyPoolMembers,
    selectRandomEnemy: mockSelectRandomEnemy,
    getMatchingLootPools: mockGetMatchingLootPools,
    getLootPoolEntries: mockGetLootPoolEntries,
    getLootPoolTierWeights: mockGetLootPoolTierWeights,
    selectRandomLoot: mockSelectRandomLoot,
    getAggregatedEnemyPools: mockGetAggregatedEnemyPools,
    getAggregatedLootPools: mockGetAggregatedLootPools,
  }
}));

// Import after mocking
import { LocationService } from '../../../src/services/LocationService';

// Test data shared across test suites
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

describe('LocationService', () => {
  let locationService: LocationService;

  beforeEach(() => {
    locationService = new LocationService();
    jest.clearAllMocks();

    // Setup default mock returns
    mockFindNearby.mockResolvedValue([]);
    mockFindById.mockResolvedValue(null);
    mockFindByType.mockResolvedValue([]);
    mockFindByRegion.mockResolvedValue([]);
    mockFindAll.mockResolvedValue([]);
    mockGetMatchingEnemyPools.mockResolvedValue([]);
    mockGetEnemyPoolMembers.mockResolvedValue([]);
    mockSelectRandomEnemy.mockReturnValue('enemy-1');
    mockGetMatchingLootPools.mockResolvedValue([]);
    mockGetLootPoolEntries.mockResolvedValue([]);
    mockGetLootPoolTierWeights.mockResolvedValue([]);
    mockSelectRandomLoot.mockReturnValue([]);
    mockGetAggregatedEnemyPools.mockResolvedValue([]);
    mockGetAggregatedLootPools.mockResolvedValue([]);
  });

  describe('nearby()', () => {
    const validLat = 37.7749;
    const validLng = -122.4194;
    const validRadius = 5000;

    it('should call repository findNearby with correct parameters', async () => {
      mockFindNearby.mockResolvedValue(mockLocations);

      await locationService.nearby(validLat, validLng, validRadius);

      expect(mockFindNearby).toHaveBeenCalledTimes(1);
      expect(mockFindNearby).toHaveBeenCalledWith(validLat, validLng, validRadius);
    });

    it('should return locations sorted by distance', async () => {
      mockFindNearby.mockResolvedValue(mockLocations);

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toEqual(mockLocations);
      expect(result).toHaveLength(2);
      expect(result[0].distance_meters).toBeLessThan(result[1].distance_meters);
    });

    it('should return empty array when no locations found', async () => {
      mockFindNearby.mockResolvedValue([]);

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should return null when repository returns null/undefined', async () => {
      mockFindNearby.mockResolvedValue(null as any);

      const result = await locationService.nearby(validLat, validLng, validRadius);

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on repository error', async () => {
      const dbError = new DatabaseError('PostGIS function not found');
      mockFindNearby.mockRejectedValue(dbError);

      await expect(
        locationService.nearby(validLat, validLng, validRadius)
      ).rejects.toThrow(DatabaseError);

      await expect(
        locationService.nearby(validLat, validLng, validRadius)
      ).rejects.toThrow('PostGIS function not found');
    });

    it('should handle very small radius (1 meter)', async () => {
      mockFindNearby.mockResolvedValue([]);

      const result = await locationService.nearby(validLat, validLng, 1);

      expect(mockFindNearby).toHaveBeenCalledWith(validLat, validLng, 1);
      expect(result).toEqual([]);
    });

    it('should handle large radius (50km)', async () => {
      mockFindNearby.mockResolvedValue(mockLocations);

      const result = await locationService.nearby(validLat, validLng, 50000);

      expect(mockFindNearby).toHaveBeenCalledWith(validLat, validLng, 50000);
      expect(result).toEqual(mockLocations);
    });

    it('should handle negative coordinates', async () => {
      mockFindNearby.mockResolvedValue(mockLocations);

      // Test southern hemisphere and western hemisphere
      await locationService.nearby(-33.8688, 151.2093, 5000); // Sydney

      expect(mockFindNearby).toHaveBeenCalledWith(-33.8688, 151.2093, 5000);
    });

    it('should handle coordinates at extremes', async () => {
      mockFindNearby.mockResolvedValue([]);

      // North Pole
      await locationService.nearby(90, 0, 5000);
      expect(mockFindNearby).toHaveBeenCalledWith(90, 0, 5000);

      // South Pole
      await locationService.nearby(-90, 0, 5000);
      expect(mockFindNearby).toHaveBeenCalledWith(-90, 0, 5000);

      // International Date Line
      await locationService.nearby(0, 180, 5000);
      expect(mockFindNearby).toHaveBeenCalledWith(0, 180, 5000);
    });

    // Validation tests
    it('should throw ValidationError for invalid latitude', async () => {
      await expect(
        locationService.nearby(91, validLng, validRadius)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(-91, validLng, validRadius)
      ).rejects.toThrow('Latitude must be between -90 and 90');
    });

    it('should throw ValidationError for invalid longitude', async () => {
      await expect(
        locationService.nearby(validLat, 181, validRadius)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(validLat, -181, validRadius)
      ).rejects.toThrow('Longitude must be between -180 and 180');
    });

    it('should throw ValidationError for invalid radius', async () => {
      await expect(
        locationService.nearby(validLat, validLng, 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.nearby(validLat, validLng, 50001)
      ).rejects.toThrow('Radius must be between 1 and 50000 meters');
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
      mockFindById.mockResolvedValue(mockLocation);

      const result = await locationService.getById(validId);

      expect(mockFindById).toHaveBeenCalledWith(validId);
      expect(result).toEqual(mockLocation);
    });

    it('should throw NotFoundError when location does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(NotFoundError);

      await expect(
        locationService.getById(validId)
      ).rejects.toThrow(`Location with identifier '${validId}' not found`);
    });

    it('should throw DatabaseError on repository error', async () => {
      const dbError = new DatabaseError('Connection timeout');
      mockFindById.mockRejectedValue(dbError);

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
        mockFindById.mockResolvedValue({ ...mockLocation, id: uuid });

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

      mockFindById.mockResolvedValue(fullLocation);

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

  // Add tests for other service methods
  describe('getByType()', () => {
    it('should call repository findByType with correct parameters', async () => {
      const locationType = 'library';
      const mockResults = [mockLocations[0]];
      mockFindByType.mockResolvedValue(mockResults);

      const result = await locationService.getByType(locationType);

      expect(mockFindByType).toHaveBeenCalledWith(locationType);
      expect(result).toEqual(mockResults);
    });

    it('should throw ValidationError for empty location type', async () => {
      await expect(
        locationService.getByType('')
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getByType('   ')
      ).rejects.toThrow('Location type is required');
    });
  });

  describe('getByRegion()', () => {
    it('should call repository findByRegion with correct parameters', async () => {
      const stateCode = 'CA';
      const countryCode = 'US';
      const mockResults = [mockLocations[0]];
      mockFindByRegion.mockResolvedValue(mockResults);

      const result = await locationService.getByRegion(stateCode, countryCode);

      expect(mockFindByRegion).toHaveBeenCalledWith(stateCode, countryCode);
      expect(result).toEqual(mockResults);
    });

    it('should throw ValidationError for missing parameters', async () => {
      await expect(
        locationService.getByRegion('', 'US')
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getByRegion('CA', '')
      ).rejects.toThrow('Both state code and country code are required');
    });
  });

  describe('getAll()', () => {
    it('should call repository findAll with pagination parameters', async () => {
      const limit = 50;
      const offset = 10;
      const mockResults = mockLocations;
      mockFindAll.mockResolvedValue(mockResults);

      const result = await locationService.getAll(limit, offset);

      expect(mockFindAll).toHaveBeenCalledWith(limit, offset);
      expect(result).toEqual(mockResults);
    });

    it('should throw ValidationError for invalid limit', async () => {
      await expect(
        locationService.getAll(0)
      ).rejects.toThrow('Limit must be between 1 and 1000');

      await expect(
        locationService.getAll(1001)
      ).rejects.toThrow('Limit must be between 1 and 1000');
    });

    it('should throw ValidationError for invalid offset', async () => {
      await expect(
        locationService.getAll(10, -1)
      ).rejects.toThrow('Offset must be non-negative');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle malformed repository responses', async () => {
      mockFindNearby.mockResolvedValue(undefined as any);

      const result = await locationService.nearby(37.7749, -122.4194, 5000);
      expect(result).toBeUndefined();
    });

    it('should handle network errors', async () => {
      mockFindNearby.mockRejectedValue(new Error('Network error'));

      await expect(
        locationService.nearby(37.7749, -122.4194, 5000)
      ).rejects.toThrow('Network error');
    });

    it('should handle unexpected data types in response', async () => {
      mockFindNearby.mockResolvedValue('invalid-data-type' as any);

      const result = await locationService.nearby(37.7749, -122.4194, 5000);

      // Service returns data as-is from repository
      // In production, this would be caught by TypeScript validation
      expect(result).toBe('invalid-data-type');
    });
  });

  // ============================================================================
  // Combat Pool Operations Tests
  // ============================================================================

  describe('getMatchingEnemyPools()', () => {
    const validLocationId = '123e4567-e89b-12d3-a456-426614174000';
    const validCombatLevel = 50;
    const mockLocation = {
      id: validLocationId,
      name: 'Test Location',
      lat: 37.7749,
      lng: -122.4194,
      location_type: 'library',
      state_code: 'CA',
      country_code: 'US'
    };
    const mockEnemyPools = ['pool-1', 'pool-2'];

    it('should fetch location and get matching enemy pools', async () => {
      mockFindById.mockResolvedValue(mockLocation);
      mockGetMatchingEnemyPools.mockResolvedValue(mockEnemyPools);

      const result = await locationService.getMatchingEnemyPools(validLocationId, validCombatLevel);

      expect(mockFindById).toHaveBeenCalledWith(validLocationId);
      expect(mockGetMatchingEnemyPools).toHaveBeenCalledWith(mockLocation, validCombatLevel);
      expect(result).toEqual(mockEnemyPools);
    });

    it('should throw ValidationError for invalid combat level', async () => {
      await expect(
        locationService.getMatchingEnemyPools(validLocationId, 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getMatchingEnemyPools(validLocationId, 101)
      ).rejects.toThrow('Combat level must be between 1 and 100');
    });

    it('should throw NotFoundError when location does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        locationService.getMatchingEnemyPools(validLocationId, validCombatLevel)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getEnemyPoolMembers()', () => {
    const mockPoolIds = ['pool-1', 'pool-2'];
    const mockPoolMembers = [
      { enemy_type_id: 'enemy-1', spawn_weight: 70 },
      { enemy_type_id: 'enemy-2', spawn_weight: 30 }
    ];

    it('should call repository getEnemyPoolMembers with correct parameters', async () => {
      mockGetEnemyPoolMembers.mockResolvedValue(mockPoolMembers);

      const result = await locationService.getEnemyPoolMembers(mockPoolIds);

      expect(mockGetEnemyPoolMembers).toHaveBeenCalledWith(mockPoolIds);
      expect(result).toEqual(mockPoolMembers);
    });

    it('should throw ValidationError for empty pool IDs', async () => {
      await expect(
        locationService.getEnemyPoolMembers([])
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getEnemyPoolMembers([])
      ).rejects.toThrow('At least one pool ID is required');
    });

    it('should throw ValidationError for null/undefined pool IDs', async () => {
      await expect(
        locationService.getEnemyPoolMembers(null as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getEnemyPoolMembers(undefined as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('selectRandomEnemy()', () => {
    const mockPoolMembers = [
      { enemy_type_id: 'enemy-1', spawn_weight: 70 },
      { enemy_type_id: 'enemy-2', spawn_weight: 30 }
    ];

    it('should call repository selectRandomEnemy with correct parameters', () => {
      mockSelectRandomEnemy.mockReturnValue('enemy-1');

      const result = locationService.selectRandomEnemy(mockPoolMembers);

      expect(mockSelectRandomEnemy).toHaveBeenCalledWith(mockPoolMembers);
      expect(result).toBe('enemy-1');
    });

    it('should throw ValidationError for empty pool members', () => {
      expect(() => {
        locationService.selectRandomEnemy([]);
      }).toThrow(ValidationError);

      expect(() => {
        locationService.selectRandomEnemy([]);
      }).toThrow('No enemy pool members provided');
    });

    it('should throw ValidationError for null/undefined pool members', () => {
      expect(() => {
        locationService.selectRandomEnemy(null as any);
      }).toThrow(ValidationError);

      expect(() => {
        locationService.selectRandomEnemy(undefined as any);
      }).toThrow(ValidationError);
    });
  });

  describe('getMatchingLootPools()', () => {
    const validLocationId = '123e4567-e89b-12d3-a456-426614174000';
    const validCombatLevel = 50;
    const mockLocation = {
      id: validLocationId,
      name: 'Test Location',
      lat: 37.7749,
      lng: -122.4194,
      location_type: 'library',
      state_code: 'CA',
      country_code: 'US'
    };
    const mockLootPools = ['loot-pool-1', 'loot-pool-2'];

    it('should fetch location and get matching loot pools', async () => {
      mockFindById.mockResolvedValue(mockLocation);
      mockGetMatchingLootPools.mockResolvedValue(mockLootPools);

      const result = await locationService.getMatchingLootPools(validLocationId, validCombatLevel);

      expect(mockFindById).toHaveBeenCalledWith(validLocationId);
      expect(mockGetMatchingLootPools).toHaveBeenCalledWith(mockLocation, validCombatLevel);
      expect(result).toEqual(mockLootPools);
    });

    it('should throw ValidationError for invalid combat level', async () => {
      await expect(
        locationService.getMatchingLootPools(validLocationId, 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getMatchingLootPools(validLocationId, 101)
      ).rejects.toThrow('Combat level must be between 1 and 100');
    });

    it('should throw NotFoundError when location does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        locationService.getMatchingLootPools(validLocationId, validCombatLevel)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getLootPoolEntries()', () => {
    const mockPoolIds = ['loot-pool-1', 'loot-pool-2'];
    const mockLootEntries = [
      { item_type_id: 'item-1', base_drop_weight: 50 },
      { item_type_id: 'item-2', base_drop_weight: 25 }
    ];

    it('should call repository getLootPoolEntries with correct parameters', async () => {
      mockGetLootPoolEntries.mockResolvedValue(mockLootEntries);

      const result = await locationService.getLootPoolEntries(mockPoolIds);

      expect(mockGetLootPoolEntries).toHaveBeenCalledWith(mockPoolIds);
      expect(result).toEqual(mockLootEntries);
    });

    it('should throw ValidationError for empty pool IDs', async () => {
      await expect(
        locationService.getLootPoolEntries([])
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getLootPoolEntries([])
      ).rejects.toThrow('At least one pool ID is required');
    });

    it('should throw ValidationError for null/undefined pool IDs', async () => {
      await expect(
        locationService.getLootPoolEntries(null as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getLootPoolEntries(undefined as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getLootPoolTierWeights()', () => {
    const mockPoolIds = ['loot-pool-1', 'loot-pool-2'];
    const mockTierWeights = [
      { material_tier: 'common', weight_multiplier: 1.0 },
      { material_tier: 'rare', weight_multiplier: 0.3 }
    ];

    it('should call repository getLootPoolTierWeights with correct parameters', async () => {
      mockGetLootPoolTierWeights.mockResolvedValue(mockTierWeights);

      const result = await locationService.getLootPoolTierWeights(mockPoolIds);

      expect(mockGetLootPoolTierWeights).toHaveBeenCalledWith(mockPoolIds);
      expect(result).toEqual(mockTierWeights);
    });

    it('should throw ValidationError for empty pool IDs', async () => {
      await expect(
        locationService.getLootPoolTierWeights([])
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getLootPoolTierWeights([])
      ).rejects.toThrow('At least one pool ID is required');
    });

    it('should throw ValidationError for null/undefined pool IDs', async () => {
      await expect(
        locationService.getLootPoolTierWeights(null as any)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getLootPoolTierWeights(undefined as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('selectRandomLoot()', () => {
    const mockPoolEntries = [
      { item_type_id: 'item-1', base_drop_weight: 50 },
      { item_type_id: 'item-2', base_drop_weight: 25 }
    ];
    const mockTierWeights = [
      { material_tier: 'common', weight_multiplier: 1.0 },
      { material_tier: 'rare', weight_multiplier: 0.3 }
    ];
    const mockLootDrops = [
      { item_type_id: 'item-1', material_id: 'wood', style_id: 'normal' }
    ];

    it('should call repository selectRandomLoot with default parameters', () => {
      mockSelectRandomLoot.mockReturnValue(mockLootDrops);

      const result = locationService.selectRandomLoot(mockPoolEntries, mockTierWeights);

      expect(mockSelectRandomLoot).toHaveBeenCalledWith(
        mockPoolEntries,
        mockTierWeights,
        'normal',
        1
      );
      expect(result).toEqual(mockLootDrops);
    });

    it('should call repository selectRandomLoot with custom parameters', () => {
      mockSelectRandomLoot.mockReturnValue(mockLootDrops);

      const result = locationService.selectRandomLoot(
        mockPoolEntries,
        mockTierWeights,
        'fire',
        3
      );

      expect(mockSelectRandomLoot).toHaveBeenCalledWith(
        mockPoolEntries,
        mockTierWeights,
        'fire',
        3
      );
      expect(result).toEqual(mockLootDrops);
    });

    it('should throw ValidationError for empty pool entries', () => {
      expect(() => {
        locationService.selectRandomLoot([], mockTierWeights);
      }).toThrow(ValidationError);

      expect(() => {
        locationService.selectRandomLoot([], mockTierWeights);
      }).toThrow('No loot pool entries provided');
    });

    it('should throw ValidationError for null/undefined pool entries', () => {
      expect(() => {
        locationService.selectRandomLoot(null as any, mockTierWeights);
      }).toThrow(ValidationError);

      expect(() => {
        locationService.selectRandomLoot(undefined as any, mockTierWeights);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid drop count', () => {
      expect(() => {
        locationService.selectRandomLoot(mockPoolEntries, mockTierWeights, 'normal', 0);
      }).toThrow(ValidationError);

      expect(() => {
        locationService.selectRandomLoot(mockPoolEntries, mockTierWeights, 'normal', 11);
      }).toThrow('Drop count must be between 1 and 10');
    });
  });

  describe('getAggregatedEnemyPools()', () => {
    const validLocationId = '123e4567-e89b-12d3-a456-426614174000';
    const validCombatLevel = 50;
    const mockAggregatedPools = [
      { enemy_type_id: 'enemy-1', total_spawn_weight: 70 },
      { enemy_type_id: 'enemy-2', total_spawn_weight: 30 }
    ];

    it('should call repository getAggregatedEnemyPools with correct parameters', async () => {
      mockGetAggregatedEnemyPools.mockResolvedValue(mockAggregatedPools);

      const result = await locationService.getAggregatedEnemyPools(validLocationId, validCombatLevel);

      expect(mockGetAggregatedEnemyPools).toHaveBeenCalledWith(validLocationId, validCombatLevel);
      expect(result).toEqual(mockAggregatedPools);
    });

    it('should throw ValidationError for invalid combat level', async () => {
      await expect(
        locationService.getAggregatedEnemyPools(validLocationId, 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getAggregatedEnemyPools(validLocationId, 101)
      ).rejects.toThrow('Combat level must be between 1 and 100');
    });
  });

  describe('getAggregatedLootPools()', () => {
    const validLocationId = '123e4567-e89b-12d3-a456-426614174000';
    const validCombatLevel = 50;
    const mockAggregatedLoot = [
      { item_type_id: 'item-1', total_drop_weight: 50 },
      { item_type_id: 'item-2', total_drop_weight: 15 }
    ];

    it('should call repository getAggregatedLootPools with correct parameters', async () => {
      mockGetAggregatedLootPools.mockResolvedValue(mockAggregatedLoot);

      const result = await locationService.getAggregatedLootPools(validLocationId, validCombatLevel);

      expect(mockGetAggregatedLootPools).toHaveBeenCalledWith(validLocationId, validCombatLevel);
      expect(result).toEqual(mockAggregatedLoot);
    });

    it('should throw ValidationError for invalid combat level', async () => {
      await expect(
        locationService.getAggregatedLootPools(validLocationId, 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        locationService.getAggregatedLootPools(validLocationId, 101)
      ).rejects.toThrow('Combat level must be between 1 and 100');
    });
  });
});
