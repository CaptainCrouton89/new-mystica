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
import { createMockSupabaseClient, setupMockChain } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

type Location = Database['public']['Tables']['locations']['Row'];
type LootPoolTierWeight = Database['public']['Tables']['lootpooltierweights']['Row'];

describe('LocationRepository', () => {
  let repository: LocationRepository;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new LocationRepository(mockClient);
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

      (mockClient.rpc as jest.Mock).mockResolvedValue({ data: mockLocations, error: null });

      const result = await repository.findNearby(37.7749, -122.4194, 500);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 37.7749,
        user_lng: -122.4194,
        search_radius: 500
      });
      expect(result).toEqual(mockLocations);
    });

    it('should return empty array when no locations found', async () => {
      (mockClient.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

      const result = await repository.findNearby(37.7749, -122.4194, 100);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on RPC failure', async () => {
      (mockClient.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'RPC function failed' }
      });

      await expect(repository.findNearby(37.7749, -122.4194, 500))
        .rejects.toThrow(DatabaseError);
    });

    it('should handle extreme geographic coordinates', async () => {
      (mockClient.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await repository.findNearby(89.99, 179.99, 1000);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 89.99,
        user_lng: 179.99,
        search_radius: 1000
      });
      expect(result).toEqual([]);
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
        image_url: null,
        created_at: '2024-01-01T00:00:00Z'
      };

      setupMockChain(mockClient, ['from', 'select', 'eq', 'single'], {
        data: mockLocation,
        error: null
      });

      const result = await repository.findById('loc1');

      expect(result).toEqual(mockLocation);
      expect(mockClient.from).toHaveBeenCalledWith('locations');
    });

    it('should return null when location not found', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'single'], {
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on query failure', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'single'], {
        data: null,
        error: { message: 'Connection timeout' }
      });

      await expect(repository.findById('loc1'))
        .rejects.toThrow(DatabaseError);
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
          image_url: null,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      setupMockChain(mockClient, ['from', 'select', 'eq'], {
        data: mockLocations,
        error: null
      });

      const result = await repository.findByType('restaurant');

      expect(mockClient.from).toHaveBeenCalledWith('locations');
      expect(result).toEqual(mockLocations);
    });

    it('should throw DatabaseError on query failure', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq'], {
        data: null,
        error: { message: 'Database connection failed' }
      });

      await expect(repository.findByType('restaurant'))
        .rejects.toThrow(DatabaseError);
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
          image_url: null,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      setupMockChain(mockClient, ['from', 'select', 'eq', 'eq'], {
        data: mockLocations,
        error: null
      });

      const result = await repository.findByRegion('CA', 'US');

      expect(mockClient.from).toHaveBeenCalledWith('locations');
      expect(result).toEqual(mockLocations);
    });

    it('should throw DatabaseError on query failure', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'eq'], {
        data: null,
        error: { message: 'Invalid region query' }
      });

      await expect(repository.findByRegion('CA', 'US'))
        .rejects.toThrow(DatabaseError);
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
      created_at: '2024-01-01T00:00:00Z',
      image_url: null
    };

    it('should get matching enemy pools for location and combat level', async () => {
      const mockPools = [
        { id: 'pool1' },
        { id: 'pool2' }
      ];

      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: mockPools,
        error: null
      });

      const result = await repository.getMatchingEnemyPools(mockLocation, 1);

      expect(mockClient.from).toHaveBeenCalledWith('enemypools');
      expect(result).toEqual(['pool1', 'pool2']);
    });

    it('should handle empty pool results', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: null,
        error: null
      });

      const result = await repository.getMatchingEnemyPools(mockLocation, 1);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: null,
        error: { message: 'Database error' }
      });

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

      setupMockChain(mockClient, ['from', 'select', 'in'], {
        data: mockMembers,
        error: null
      });

      const result = await repository.getEnemyPoolMembers(['pool1', 'pool2']);

      expect(mockClient.from).toHaveBeenCalledWith('enemypoolmembers');
      expect(result).toEqual(mockMembers);
    });

    it('should return empty array for empty pool IDs', async () => {
      const result = await repository.getEnemyPoolMembers([]);

      expect(result).toEqual([]);
      expect(mockClient.from).not.toHaveBeenCalled();
    });
  });

  describe('selectRandomEnemy', () => {
    let mockRandom: jest.SpyInstance;

    afterEach(() => {
      mockRandom?.mockRestore();
    });

    it('should select enemy using weighted random selection', () => {
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

      // Random value 0.4 * 150 = 60, should select enemy1 (weight 100)
      mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.4);

      const result = repository.selectRandomEnemy(poolMembers);

      expect(result).toBe('enemy1');
    });

    it('should select second enemy when random value exceeds first weight', () => {
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

      // Random value 0.8 * 150 = 120, should select enemy2
      mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.8);

      const result = repository.selectRandomEnemy(poolMembers);

      expect(result).toBe('enemy2');
    });

    it('should always select first enemy when random is 0', () => {
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

      mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = repository.selectRandomEnemy(poolMembers);

      expect(result).toBe('enemy1');
    });

    it('should throw error for empty pool members', () => {
      expect(() => repository.selectRandomEnemy([]))
        .toThrow('No enemy pool members available for selection');
    });

    it('should throw error for zero total weight', () => {
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
      created_at: '2024-01-01T00:00:00Z',
      image_url: null
    };

    it('should get matching loot pools for location and combat level', async () => {
      const mockPools = [
        { id: 'lootpool1' },
        { id: 'lootpool2' }
      ];

      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: mockPools,
        error: null
      });

      const result = await repository.getMatchingLootPools(mockLocation, 1);

      expect(mockClient.from).toHaveBeenCalledWith('lootpools');
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

      setupMockChain(mockClient, ['from', 'select', 'in'], {
        data: mockEntries,
        error: null
      });

      const result = await repository.getLootPoolEntries(['pool1']);

      expect(mockClient.from).toHaveBeenCalledWith('lootpoolentries');
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

      setupMockChain(mockClient, ['from', 'select', 'in'], {
        data: mockWeights,
        error: null
      });

      const result = await repository.getLootPoolTierWeights(['pool1']);

      expect(mockClient.from).toHaveBeenCalledWith('lootpooltierweights');
      expect(result).toEqual(mockWeights);
    });
  });

  describe('selectRandomLoot', () => {
    let mockRandom: jest.SpyInstance;

    afterEach(() => {
      mockRandom?.mockRestore();
    });

    it('should select loot using weighted random selection with style inheritance', () => {
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
      mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

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
    });

    it('should return empty array for empty pool entries', () => {
      const result = repository.selectRandomLoot([], [], 'normal');

      expect(result).toEqual([]);
    });

    it('should handle zero total weight gracefully', () => {
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

    it('should apply tier weight multipliers to materials only', () => {
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
      mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = repository.selectRandomLoot(poolEntries, tierWeights, 'normal', 1);

      expect(result[0]).toMatchObject({
        type: 'item',
        item_type_id: 'item1'
      });
    });

    it('should generate multiple drops correctly', () => {
      const poolEntries: LootPoolEntry[] = [
        {
          loot_pool_id: 'pool1',
          lootable_type: 'material',
          lootable_id: 'material1',
          drop_weight: 100
        }
      ];

      // Always select the same entry
      mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = repository.selectRandomLoot(poolEntries, [], 'ice_style', 3);

      expect(result).toHaveLength(3);
      result.forEach(drop => {
        expect(drop).toMatchObject({
          type: 'material',
          material_id: 'material1',
          style_id: 'ice_style',
          quantity: 1
        });
      });
    });
  });

  // ============================================================================
  // Pool Filter Logic Tests
  // ============================================================================

  describe('pool filter logic', () => {
    const mockLocation: Location = {
      id: 'loc1',
      name: 'Test Location',
      lat: 37.7749,
      lng: -122.4194,
      location_type: 'restaurant',
      state_code: 'CA',
      country_code: 'US',
      created_at: '2024-01-01T00:00:00Z',
      image_url: null
    };

    it('should include universal pools in enemy pool filters', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: [{ id: 'universal-pool' }],
        error: null
      });

      await repository.getMatchingEnemyPools(mockLocation, 1);

      const orFilter = (mockClient.from().select().eq().or as jest.Mock).mock.calls[0][0];
      expect(orFilter).toContain('filter_type.eq.universal');
    });

    it('should include location type in pool filters', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: [{ id: 'restaurant-pool' }],
        error: null
      });

      await repository.getMatchingEnemyPools(mockLocation, 1);

      const orFilter = (mockClient.from().select().eq().or as jest.Mock).mock.calls[0][0];
      expect(orFilter).toContain('and(filter_type.eq.location_type,filter_value.eq.restaurant)');
    });

    it('should include state and country in pool filters', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: [{ id: 'ca-pool' }],
        error: null
      });

      await repository.getMatchingEnemyPools(mockLocation, 1);

      const orFilter = (mockClient.from().select().eq().or as jest.Mock).mock.calls[0][0];
      expect(orFilter).toContain('and(filter_type.eq.state,filter_value.eq.CA)');
      expect(orFilter).toContain('and(filter_type.eq.country,filter_value.eq.US)');
    });

    it('should handle location with missing optional fields', async () => {
      const incompleteLocation: Location = {
        id: 'loc2',
        name: 'Incomplete Location',
        lat: 0,
        lng: 0,
        location_type: '',
        state_code: '',
        country_code: '',
        image_url: null,
        created_at: '2024-01-01T00:00:00Z'
      };

      setupMockChain(mockClient, ['from', 'select', 'eq', 'or'], {
        data: [{ id: 'universal-pool' }],
        error: null
      });

      await repository.getMatchingEnemyPools(incompleteLocation, 1);

      const orFilter = (mockClient.from().select().eq().or as jest.Mock).mock.calls[0][0];
      // Should only include universal filter when other fields are empty
      expect(orFilter).toBe('filter_type.eq.universal');
    });
  });

  // ============================================================================
  // Geographic Edge Cases
  // ============================================================================

  describe('geographic edge cases', () => {
    it('should handle search at north pole', async () => {
      (mockClient.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await repository.findNearby(90, 0, 1000);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 90,
        user_lng: 0,
        search_radius: 1000
      });
      expect(result).toEqual([]);
    });

    it('should handle search at international date line', async () => {
      (mockClient.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await repository.findNearby(0, 180, 500);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 0,
        user_lng: 180,
        search_radius: 500
      });
      expect(result).toEqual([]);
    });

    it('should handle very small search radius', async () => {
      (mockClient.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await repository.findNearby(37.7749, -122.4194, 1);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 37.7749,
        user_lng: -122.4194,
        search_radius: 1
      });
      expect(result).toEqual([]);
    });

    it('should handle very large search radius', async () => {
      (mockClient.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await repository.findNearby(37.7749, -122.4194, 40075000); // Earth's circumference

      expect(mockClient.rpc).toHaveBeenCalledWith('get_nearby_locations', {
        user_lat: 37.7749,
        user_lng: -122.4194,
        search_radius: 40075000
      });
      expect(result).toEqual([]);
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
        image_url: null,
        created_at: '2024-01-01T00:00:00Z'
      };

      // Mock each method call sequence manually
      (mockClient.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockLocation, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              or: jest.fn().mockResolvedValue({ data: [{ id: 'pool1' }], error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { enemy_type_id: 'enemy1', spawn_weight: 100 },
                { enemy_type_id: 'enemy1', spawn_weight: 50 }, // Same enemy from different pools
                { enemy_type_id: 'enemy2', spawn_weight: 75 }
              ],
              error: null
            })
          })
        });

      const result = await repository.getAggregatedEnemyPools('loc1', 1);

      expect(result).toEqual([
        { enemy_type_id: 'enemy1', spawn_weight: 150 }, // Aggregated weight
        { enemy_type_id: 'enemy2', spawn_weight: 75 }
      ]);
    });

    it('should throw NotFoundError for invalid location ID', async () => {
      setupMockChain(mockClient, ['from', 'select', 'eq', 'single'], {
        data: null,
        error: { code: 'PGRST116' }
      });

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
        image_url: null,
        created_at: '2024-01-01T00:00:00Z'
      };

      // Mock each method call sequence manually
      (mockClient.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockLocation, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              or: jest.fn().mockResolvedValue({ data: [{ id: 'pool1' }], error: null })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
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
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
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
          })
        });

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