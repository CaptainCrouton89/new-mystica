/**
 * LocationRepository Unit Tests
 *
 * Tests for location-based operations including:
 * - PostGIS geospatial queries
 * - Location metadata queries
 * - Enemy pool matching and weighted selection
 * - Loot pool matching with tier weights
 * - Pool filter logic validation
 */

import { LocationRepository } from '../../../src/repositories/LocationRepository.js';
import { DatabaseError, NotFoundError } from '../../../src/utils/errors.js';
import { Database } from '../../../src/types/database.types.js';
import {
  LocationWithDistance,
  EnemyPoolMember,
  LootPoolEntry,
  LootDrop
} from '../../../src/types/repository.types.js';

type Location = Database['public']['Tables']['locations']['Row'];
type LootPoolTierWeight = Database['public']['Tables']['lootpooltierweights']['Row'];

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

// Mock BaseRepository methods
jest.mock('../../../src/repositories/BaseRepository.js', () => ({
  BaseRepository: class MockBaseRepository {
    protected client = mockSupabaseClient;
    protected tableName: string;

    constructor(tableName: string) {
      this.tableName = tableName;
    }

    async findById(id: string) {
      return mockSupabaseClient.from(this.tableName).select('*').eq('id', id).single();
    }

    async findMany(filters: any, options?: any) {
      let query = mockSupabaseClient.from(this.tableName).select('*');
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      return query;
    }

    protected async rpc(functionName: string, params?: any) {
      return mockSupabaseClient.rpc(functionName, params);
    }
  }
}));

describe('LocationRepository', () => {
  let repository: LocationRepository;

  beforeEach(() => {
    repository = new LocationRepository();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Spatial Queries (PostGIS)
  // ============================================================================

  describe('findNearby', () => {
    it('should find nearby locations using PostGIS RPC', async () => {
      const mockLocations: LocationWithDistance[] = [
        {
          id: 'loc1',
          name: 'Coffee Shop',
          lat: 37.7749,
          lng: -122.4194,
          location_type: 'restaurant',
          state_code: 'CA',
          country_code: 'US',
          distance_meters: 150
        },
        {
          id: 'loc2',
          name: 'Park',
          lat: 37.7750,
          lng: -122.4195,
          location_type: 'park',
          state_code: 'CA',
          country_code: 'US',
          distance_meters: 250
        }
      ];

      mockSupabaseClient.rpc.mockResolvedValue({ data: mockLocations, error: null });

      const result = await repository.findNearby(37.7749, -122.4194, 500);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 37.7749,
        user_lng: -122.4194,
        search_radius: 500
      });
      expect(result).toEqual(mockLocations);
    });

    it('should return empty array when no locations found', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const result = await repository.findNearby(37.7749, -122.4194, 100);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on RPC failure', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function failed' }
      });

      await expect(repository.findNearby(37.7749, -122.4194, 500))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('findById', () => {
    it('should find location by ID', async () => {
      const mockLocation: Location = {
        id: 'loc1',
        name: 'Test Location',
        lat: 37.7749,
        lng: -122.4194,
        location_type: 'restaurant',
        state_code: 'CA',
        country_code: 'US',
        created_at: '2024-01-01T00:00:00Z'
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockLocation, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.findById('loc1');

      expect(result).toEqual(mockLocation);
    });

    it('should return null when location not found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Location Metadata
  // ============================================================================

  describe('findByType', () => {
    it('should find locations by type', async () => {
      const mockLocations: Location[] = [
        {
          id: 'loc1',
          name: 'Coffee Shop 1',
          lat: 37.7749,
          lng: -122.4194,
          location_type: 'restaurant',
          state_code: 'CA',
          country_code: 'US',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockLocations, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.findByType('restaurant');

      expect(mockQuery.eq).toHaveBeenCalledWith('location_type', 'restaurant');
      expect(result).toEqual(mockLocations);
    });
  });

  describe('findByRegion', () => {
    it('should find locations by state and country', async () => {
      const mockLocations: Location[] = [
        {
          id: 'loc1',
          name: 'CA Location',
          lat: 37.7749,
          lng: -122.4194,
          location_type: 'park',
          state_code: 'CA',
          country_code: 'US',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis().mockResolvedValue({ data: mockLocations, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.findByRegion('CA', 'US');

      expect(mockQuery.eq).toHaveBeenCalledWith('state_code', 'CA');
      expect(mockQuery.eq).toHaveBeenCalledWith('country_code', 'US');
      expect(result).toEqual(mockLocations);
    });
  });

  // ============================================================================
  // Enemy Pool Matching
  // ============================================================================

  describe('getMatchingEnemyPools', () => {
    const mockLocation: Location = {
      id: 'loc1',
      name: 'Test Location',
      lat: 37.7749,
      lng: -122.4194,
      location_type: 'restaurant',
      state_code: 'CA',
      country_code: 'US',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should get matching enemy pools for location and combat level', async () => {
      const mockPools = [
        { id: 'pool1' },
        { id: 'pool2' }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: mockPools, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.getMatchingEnemyPools(mockLocation, 1);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('enemypools');
      expect(mockQuery.eq).toHaveBeenCalledWith('combat_level', 1);
      expect(result).toEqual(['pool1', 'pool2']);
    });

    it('should handle empty pool results', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.getMatchingEnemyPools(mockLocation, 1);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await expect(repository.getMatchingEnemyPools(mockLocation, 1))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('getEnemyPoolMembers', () => {
    it('should get enemy pool members for given pool IDs', async () => {
      const mockMembers: EnemyPoolMember[] = [
        {
          enemy_pool_id: 'pool1',
          enemy_type_id: 'enemy1',
          spawn_weight: 100
        },
        {
          enemy_pool_id: 'pool1',
          enemy_type_id: 'enemy2',
          spawn_weight: 50
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockMembers, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.getEnemyPoolMembers(['pool1', 'pool2']);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('enemypoolmembers');
      expect(mockQuery.in).toHaveBeenCalledWith('enemy_pool_id', ['pool1', 'pool2']);
      expect(result).toEqual(mockMembers);
    });

    it('should return empty array for empty pool IDs', async () => {
      const result = await repository.getEnemyPoolMembers([]);

      expect(result).toEqual([]);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('selectRandomEnemy', () => {
    it('should select enemy using weighted random selection', async () => {
      const poolMembers: EnemyPoolMember[] = [
        {
          enemy_pool_id: 'pool1',
          enemy_type_id: 'enemy1',
          spawn_weight: 100
        },
        {
          enemy_pool_id: 'pool1',
          enemy_type_id: 'enemy2',
          spawn_weight: 50
        }
      ];

      // Mock Math.random to return 0.4 (should select enemy1)
      jest.spyOn(Math, 'random').mockReturnValue(0.4);

      const result = repository.selectRandomEnemy(poolMembers);

      expect(result).toBe('enemy1');

      Math.random = jest.fn().mockRestore();
    });

    it('should select last enemy when random value equals total weight', async () => {
      const poolMembers: EnemyPoolMember[] = [
        {
          enemy_pool_id: 'pool1',
          enemy_type_id: 'enemy1',
          spawn_weight: 100
        },
        {
          enemy_pool_id: 'pool1',
          enemy_type_id: 'enemy2',
          spawn_weight: 50
        }
      ];

      // Mock Math.random to return 0.99 (should select enemy2)
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const result = repository.selectRandomEnemy(poolMembers);

      expect(result).toBe('enemy2');

      Math.random = jest.fn().mockRestore();
    });

    it('should throw error for empty pool members', async () => {
      expect(() => repository.selectRandomEnemy([]))
        .toThrow('No enemy pool members available for selection');
    });

    it('should throw error for zero total weight', async () => {
      const poolMembers: EnemyPoolMember[] = [
        {
          enemy_pool_id: 'pool1',
          enemy_type_id: 'enemy1',
          spawn_weight: 0
        }
      ];

      expect(() => repository.selectRandomEnemy(poolMembers))
        .toThrow('All enemy pool members have zero spawn weight');
    });
  });

  // ============================================================================
  // Loot Pool Matching
  // ============================================================================

  describe('getMatchingLootPools', () => {
    const mockLocation: Location = {
      id: 'loc1',
      name: 'Test Location',
      lat: 37.7749,
      lng: -122.4194,
      location_type: 'restaurant',
      state_code: 'CA',
      country_code: 'US',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should get matching loot pools for location and combat level', async () => {
      const mockPools = [
        { id: 'lootpool1' },
        { id: 'lootpool2' }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: mockPools, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.getMatchingLootPools(mockLocation, 1);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('lootpools');
      expect(result).toEqual(['lootpool1', 'lootpool2']);
    });
  });

  describe('getLootPoolEntries', () => {
    it('should get loot pool entries for given pool IDs', async () => {
      const mockEntries: LootPoolEntry[] = [
        {
          loot_pool_id: 'pool1',
          lootable_type: 'material',
          lootable_id: 'material1',
          drop_weight: 100
        },
        {
          loot_pool_id: 'pool1',
          lootable_type: 'item_type',
          lootable_id: 'item1',
          drop_weight: 50
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockEntries, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.getLootPoolEntries(['pool1']);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('lootpoolentries');
      expect(result).toEqual(mockEntries);
    });

    it('should return empty array for empty pool IDs', async () => {
      const result = await repository.getLootPoolEntries([]);

      expect(result).toEqual([]);
    });
  });

  describe('getLootPoolTierWeights', () => {
    it('should get loot pool tier weights for given pool IDs', async () => {
      const mockWeights: LootPoolTierWeight[] = [
        {
          loot_pool_id: 'pool1',
          tier_name: 'common',
          weight_multiplier: 1.0,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          loot_pool_id: 'pool1',
          tier_name: 'rare',
          weight_multiplier: 0.5,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockWeights, error: null })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await repository.getLootPoolTierWeights(['pool1']);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('lootpooltierweights');
      expect(result).toEqual(mockWeights);
    });
  });

  describe('selectRandomLoot', () => {
    it('should select loot using weighted random selection with style inheritance', async () => {
      const poolEntries: LootPoolEntry[] = [
        {
          loot_pool_id: 'pool1',
          lootable_type: 'material',
          lootable_id: 'material1',
          drop_weight: 100
        },
        {
          loot_pool_id: 'pool1',
          lootable_type: 'item_type',
          lootable_id: 'item1',
          drop_weight: 50
        }
      ];

      const tierWeights: LootPoolTierWeight[] = [
        {
          loot_pool_id: 'pool1',
          tier_name: 'common',
          weight_multiplier: 1.5,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock Math.random to select first entry
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = repository.selectRandomLoot(
        poolEntries,
        tierWeights,
        'fire_style',
        2
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: 'material',
        material_id: 'material1',
        style_id: 'fire_style',
        quantity: 1
      });

      Math.random = jest.fn().mockRestore();
    });

    it('should return empty array for empty pool entries', async () => {
      const result = repository.selectRandomLoot([], [], 'normal');

      expect(result).toEqual([]);
    });

    it('should handle zero total weight gracefully', async () => {
      const poolEntries: LootPoolEntry[] = [
        {
          loot_pool_id: 'pool1',
          lootable_type: 'material',
          lootable_id: 'material1',
          drop_weight: 0
        }
      ];

      const result = repository.selectRandomLoot(poolEntries, [], 'normal', 1);

      expect(result).toEqual([]);
    });

    it('should apply tier weight multipliers to materials only', async () => {
      const poolEntries: LootPoolEntry[] = [
        {
          loot_pool_id: 'pool1',
          lootable_type: 'material',
          lootable_id: 'material1',
          drop_weight: 100
        },
        {
          loot_pool_id: 'pool1',
          lootable_type: 'item_type',
          lootable_id: 'item1',
          drop_weight: 100
        }
      ];

      const tierWeights: LootPoolTierWeight[] = [
        {
          loot_pool_id: 'pool1',
          tier_name: 'common',
          weight_multiplier: 0.1, // Very low multiplier for materials
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock Math.random to select around 50% of total weight
      // Material weight: 100 * 0.1 = 10
      // Item weight: 100 (no multiplier)
      // Total: 110, 50% = 55, should select item
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = repository.selectRandomLoot(poolEntries, tierWeights, 'normal', 1);

      expect(result[0]).toMatchObject({
        type: 'item',
        item_type_id: 'item1'
      });

      Math.random = jest.fn().mockRestore();
    });
  });

  // ============================================================================
  // Advanced Queries
  // ============================================================================

  describe('getAggregatedEnemyPools', () => {
    it('should get aggregated enemy pools with spawn weights', async () => {
      const mockLocation: Location = {
        id: 'loc1',
        name: 'Test Location',
        lat: 37.7749,
        lng: -122.4194,
        location_type: 'restaurant',
        state_code: 'CA',
        country_code: 'US',
        created_at: '2024-01-01T00:00:00Z'
      };

      // Mock findById
      const mockFindByIdQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockLocation, error: null })
      };

      // Mock pool query
      const mockPoolQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: [{ id: 'pool1' }], error: null })
      };

      // Mock members query
      const mockMembersQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            { enemy_type_id: 'enemy1', spawn_weight: 100 },
            { enemy_type_id: 'enemy1', spawn_weight: 50 }, // Same enemy from different pools
            { enemy_type_id: 'enemy2', spawn_weight: 75 }
          ],
          error: null
        })
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockFindByIdQuery) // findById call
        .mockReturnValueOnce(mockPoolQuery) // getMatchingEnemyPools call
        .mockReturnValueOnce(mockMembersQuery); // getEnemyPoolMembers call

      const result = await repository.getAggregatedEnemyPools('loc1', 1);

      expect(result).toEqual([
        { enemy_type_id: 'enemy1', spawn_weight: 150 }, // Aggregated weight
        { enemy_type_id: 'enemy2', spawn_weight: 75 }
      ]);
    });

    it('should throw NotFoundError for invalid location ID', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await expect(repository.getAggregatedEnemyPools('invalid', 1))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getAggregatedLootPools', () => {
    it('should get aggregated loot pools with adjusted weights', async () => {
      const mockLocation: Location = {
        id: 'loc1',
        name: 'Test Location',
        lat: 37.7749,
        lng: -122.4194,
        location_type: 'restaurant',
        state_code: 'CA',
        country_code: 'US',
        created_at: '2024-01-01T00:00:00Z'
      };

      // Mock findById
      const mockFindByIdQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockLocation, error: null })
      };

      // Mock other queries
      const mockPoolQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: [{ id: 'pool1' }], error: null })
      };

      const mockEntriesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            {
              loot_pool_id: 'pool1',
              lootable_type: 'material',
              lootable_id: 'material1',
              drop_weight: 100
            }
          ],
          error: null
        })
      };

      const mockWeightsQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            {
              loot_pool_id: 'pool1',
              tier_name: 'common',
              weight_multiplier: 1.5,
              created_at: '2024-01-01T00:00:00Z'
            }
          ],
          error: null
        })
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockFindByIdQuery)
        .mockReturnValueOnce(mockPoolQuery)
        .mockReturnValueOnce(mockEntriesQuery)
        .mockReturnValueOnce(mockWeightsQuery);

      const result = await repository.getAggregatedLootPools('loc1', 1);

      expect(result).toEqual([
        {
          loot_pool_id: 'pool1',
          lootable_type: 'material',
          lootable_id: 'material1',
          drop_weight: 100,
          adjusted_weight: 150 // 100 * 1.5 multiplier
        }
      ]);
    });
  });
});