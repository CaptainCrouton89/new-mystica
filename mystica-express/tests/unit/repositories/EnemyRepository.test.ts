/**
 * EnemyRepository Unit Tests
 *
 * Tests enemy type retrieval, stats calculation via v_enemy_realized_stats view,
 * personality data handling, tier/style operations, and pool management.
 */

import { EnemyRepository } from '../../../src/repositories/EnemyRepository.js';
import { supabase } from '../../../src/config/supabase.js';
import { NotFoundError, DatabaseError } from '../../../src/utils/errors.js';

// Mock Supabase client
jest.mock('../../../src/config/supabase.js', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('EnemyRepository', () => {
  let repository: EnemyRepository;
  let mockQuery: any;

  beforeEach(() => {
    repository = new EnemyRepository();
    // Create a comprehensive mock that supports all query chaining
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      // Add missing properties to satisfy TypeScript
      url: '',
      headers: {},
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis()
    };
    mockSupabase.from.mockReturnValue(mockQuery);
    jest.clearAllMocks();
  });

  // ============================================================================
  // Enemy Types
  // ============================================================================

  describe('findEnemyTypeById', () => {
    const mockEnemyType = {
      id: 'enemy-1',
      name: 'Forest Goblin',
      tier_id: 1,
      style_id: 'style-1',
      base_atk: 15,
      base_def: 12,
      base_hp: 80,
      atk_offset: 2,
      def_offset: 1,
      hp_offset: 5,
      ai_personality_traits: { aggression: 'high', cunning: 'medium' },
      dialogue_tone: 'mocking',
      base_dialogue_prompt: 'A sneaky forest dweller',
      example_taunts: ['You smell like human!', 'My territory!'],
      verbosity: 'medium',
      appearance_data: { color: 'green', size: 'small' }
    };

    it('should find enemy type by ID with personality data', async () => {
      mockQuery.single.mockResolvedValue({ data: mockEnemyType, error: null });

      const result = await repository.findEnemyTypeById('enemy-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('enemytypes');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'enemy-1');
      expect(result).toEqual({
        ...mockEnemyType,
        ai_personality_traits: { aggression: 'high', cunning: 'medium' },
        example_taunts: ['You smell like human!', 'My territory!'],
        appearance_data: { color: 'green', size: 'small' }
      });
    });

    it('should return null when enemy type not found', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' }
      });

      const result = await repository.findEnemyTypeById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle JSON string personality data', async () => {
      const enemyWithStringJson = {
        ...mockEnemyType,
        ai_personality_traits: '{"aggression": "high"}',
        example_taunts: '["Growl!", "Hiss!"]',
        appearance_data: '{"wings": true}'
      };
      mockQuery.single.mockResolvedValue({ data: enemyWithStringJson, error: null });

      const result = await repository.findEnemyTypeById('enemy-1');

      expect(result?.ai_personality_traits).toEqual({ aggression: 'high' });
      expect(result?.example_taunts).toEqual(['Growl!', 'Hiss!']);
      expect(result?.appearance_data).toEqual({ wings: true });
    });

    it('should handle invalid JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const enemyWithBadJson = {
        ...mockEnemyType,
        ai_personality_traits: 'invalid json',
        example_taunts: 'not array json',
        appearance_data: '{'
      };
      mockQuery.single.mockResolvedValue({ data: enemyWithBadJson, error: null });

      const result = await repository.findEnemyTypeById('enemy-1');

      expect(result?.ai_personality_traits).toBeNull();
      expect(result?.example_taunts).toBeNull();
      expect(result?.appearance_data).toBeNull();
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('should throw DatabaseError on query failure', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Database error' }
      });

      await expect(repository.findEnemyTypeById('enemy-1'))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('findAllEnemyTypes', () => {
    const mockEnemyTypes = [
      { id: 'enemy-1', name: 'Goblin', tier_id: 1, ai_personality_traits: null },
      { id: 'enemy-2', name: 'Orc', tier_id: 2, ai_personality_traits: null }
    ];

    it('should find all enemy types with default ordering', async () => {
      mockQuery.single = undefined; // Remove single method for array query
      mockSupabase.from.mockReturnValue({
        ...mockQuery,
        select: jest.fn().mockResolvedValue({ data: mockEnemyTypes, error: null })
      });

      const result = await repository.findAllEnemyTypes();

      expect(mockSupabase.from).toHaveBeenCalledWith('enemytypes');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('enemy-1');
    });

    it('should apply ordering when specified', async () => {
      const queryWithOrder = {
        ...mockQuery,
        order: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        then: jest.fn(),
        catch: jest.fn(),
      };
      // Make the final query awaitable
      queryWithOrder.then.mockImplementation((resolve: any) =>
        resolve({ data: mockEnemyTypes, error: null })
      );
      mockSupabase.from.mockReturnValue(queryWithOrder);

      await repository.findAllEnemyTypes({ orderBy: 'name' });

      expect(queryWithOrder.order).toHaveBeenCalledWith('name');
    });

    it('should apply pagination when specified', async () => {
      const queryWithPagination = {
        ...mockQuery,
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        then: jest.fn(),
        catch: jest.fn(),
      };
      // Make the final query awaitable
      queryWithPagination.then.mockImplementation((resolve: any) =>
        resolve({ data: mockEnemyTypes, error: null })
      );
      mockSupabase.from.mockReturnValue(queryWithPagination);

      await repository.findAllEnemyTypes({ limit: 10, offset: 5 });

      expect(queryWithPagination.limit).toHaveBeenCalledWith(10);
      expect(queryWithPagination.range).toHaveBeenCalledWith(5, 14);
    });
  });

  describe('findEnemyTypesByTier', () => {
    it('should find enemy types by tier ID', async () => {
      const mockEnemyTypes = [{ id: 'enemy-1', tier_id: 2 }];
      const customMockQuery = {
        ...mockQuery,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEnemyTypes, error: null })
      };
      mockSupabase.from.mockReturnValue(customMockQuery);

      const result = await repository.findEnemyTypesByTier(2);

      expect(customMockQuery.eq).toHaveBeenCalledWith('tier_id', 2);
      expect(customMockQuery.order).toHaveBeenCalledWith('name');
      expect(result).toHaveLength(1);
    });
  });

  describe('findEnemyTypesByStyle', () => {
    it('should find enemy types by style ID', async () => {
      const mockEnemyTypes = [{ id: 'enemy-1', style_id: 'fire-style' }];
      const customMockQuery = {
        ...mockQuery,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEnemyTypes, error: null })
      };
      mockSupabase.from.mockReturnValue(customMockQuery);

      const result = await repository.findEnemyTypesByStyle('fire-style');

      expect(customMockQuery.eq).toHaveBeenCalledWith('style_id', 'fire-style');
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // Enemy Stats (v_enemy_realized_stats view)
  // ============================================================================

  describe('getEnemyRealizedStats', () => {
    const mockStats = {
      atk: 25,
      def: 18,
      hp: 120,
      combat_rating: 87.5
    };

    it('should get realized stats from view', async () => {
      mockSupabase.from.mockReturnValue({
        ...mockQuery,
        single: jest.fn().mockResolvedValue({ data: mockStats, error: null })
      });

      const result = await repository.getEnemyRealizedStats('enemy-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('v_enemy_realized_stats');
      expect(mockQuery.select).toHaveBeenCalledWith('atk, def, hp, combat_rating');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'enemy-1');
      expect(result).toEqual(mockStats);
    });

    it('should return null when enemy not found in view', async () => {
      mockSupabase.from.mockReturnValue({
        ...mockQuery,
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      });

      const result = await repository.getEnemyRealizedStats('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when stats are incomplete', async () => {
      const incompleteStats = { atk: 25, def: null, hp: 120, combat_rating: 87.5 };
      mockSupabase.from.mockReturnValue({
        ...mockQuery,
        single: jest.fn().mockResolvedValue({ data: incompleteStats, error: null })
      });

      await expect(repository.getEnemyRealizedStats('enemy-1'))
        .rejects.toThrow('Incomplete stats for enemy type enemy-1');
    });
  });

  describe('computeCombatRating', () => {
    it('should compute combat rating from realized stats', async () => {
      const mockStats = { atk: 25, def: 18, hp: 120, combat_rating: 87.5 };
      mockSupabase.from.mockReturnValue({
        ...mockQuery,
        single: jest.fn().mockResolvedValue({ data: mockStats, error: null })
      });

      const result = await repository.computeCombatRating('enemy-1');

      expect(result).toBe(87.5);
    });

    it('should throw NotFoundError when enemy not found', async () => {
      mockSupabase.from.mockReturnValue({
        ...mockQuery,
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      });

      await expect(repository.computeCombatRating('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // Tiers
  // ============================================================================

  describe('findTierById', () => {
    const mockTier = {
      id: 1,
      tier_num: 1,
      enemy_atk_add: 6,
      enemy_def_add: 5,
      enemy_hp_add: 30,
      description: 'Novice tier',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should find tier by ID', async () => {
      mockQuery.single.mockResolvedValue({ data: mockTier, error: null });

      const result = await repository.findTierById(1);

      expect(mockSupabase.from).toHaveBeenCalledWith('tiers');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 1);
      expect(result).toEqual(mockTier);
    });

    it('should return null when tier not found', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await repository.findTierById(999);

      expect(result).toBeNull();
    });
  });

  describe('getAllTiers', () => {
    const mockTiers = [
      { id: 1, tier_num: 1, enemy_atk_add: 6 },
      { id: 2, tier_num: 2, enemy_atk_add: 12 }
    ];

    it('should get all tiers ordered by tier_num', async () => {
      const customMockQuery = {
        ...mockQuery,
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTiers, error: null })
      };
      mockSupabase.from.mockReturnValue(customMockQuery);

      const result = await repository.getAllTiers();

      expect(customMockQuery.order).toHaveBeenCalledWith('tier_num');
      expect(result).toEqual(mockTiers);
    });
  });

  // ============================================================================
  // Styles
  // ============================================================================

  describe('findStyleById', () => {
    const mockStyle = {
      id: 'style-1',
      style_name: 'fire',
      display_name: 'Fire Elemental',
      spawn_rate: 0.15,
      description: 'Burning with elemental fire',
      visual_modifier: 'flames',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should find style by ID', async () => {
      mockQuery.single.mockResolvedValue({ data: mockStyle, error: null });

      const result = await repository.findStyleById('style-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('styledefinitions');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'style-1');
      expect(result).toEqual(mockStyle);
    });
  });

  describe('getAllStyles', () => {
    it('should get all styles ordered by spawn_rate descending', async () => {
      const mockStyles = [
        { id: 'style-1', spawn_rate: 0.8 },
        { id: 'style-2', spawn_rate: 0.2 }
      ];
      const customMockQuery = {
        ...mockQuery,
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockStyles, error: null })
      };
      mockSupabase.from.mockReturnValue(customMockQuery);

      const result = await repository.getAllStyles();

      expect(customMockQuery.order).toHaveBeenCalledWith('spawn_rate', { ascending: false });
      expect(result).toEqual(mockStyles);
    });
  });

  describe('findStyleByName', () => {
    it('should find style by name', async () => {
      const mockStyle = { id: 'style-1', style_name: 'fire' };
      mockQuery.single.mockResolvedValue({ data: mockStyle, error: null });

      const result = await repository.findStyleByName('fire');

      expect(mockQuery.eq).toHaveBeenCalledWith('style_name', 'fire');
      expect(result).toEqual(mockStyle);
    });
  });

  // ============================================================================
  // Pool Management
  // ============================================================================

  describe('createEnemyPool', () => {
    const mockPoolData = {
      name: 'Forest Enemies',
      combat_level: 5,
      filter_type: 'location_type',
      filter_value: 'forest'
    };

    const mockCreatedPool = {
      id: 'pool-1',
      ...mockPoolData,
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should create enemy pool', async () => {
      mockQuery.single.mockResolvedValue({ data: mockCreatedPool, error: null });

      const result = await repository.createEnemyPool(mockPoolData);

      expect(mockSupabase.from).toHaveBeenCalledWith('enemypools');
      expect(mockQuery.insert).toHaveBeenCalledWith({
        name: 'Forest Enemies',
        combat_level: 5,
        filter_type: 'location_type',
        filter_value: 'forest'
      });
      expect(result).toEqual(mockCreatedPool);
    });

    it('should create pool with null filter_value when not provided', async () => {
      const poolWithoutFilter = {
        name: 'Global Pool',
        combat_level: 10,
        filter_type: 'global'
      };
      mockQuery.single.mockResolvedValue({ data: mockCreatedPool, error: null });

      await repository.createEnemyPool(poolWithoutFilter);

      expect(mockQuery.insert).toHaveBeenCalledWith({
        name: 'Global Pool',
        combat_level: 10,
        filter_type: 'global',
        filter_value: null
      });
    });
  });

  describe('addEnemyToPool', () => {
    const mockPoolData = {
      enemy_pool_id: 'pool-1',
      enemy_type_id: 'enemy-1',
      spawn_weight: 150
    };

    it('should add enemy to pool with specified weight', async () => {
      mockQuery.insert = jest.fn().mockResolvedValue({ error: null });

      await repository.addEnemyToPool(mockPoolData);

      expect(mockSupabase.from).toHaveBeenCalledWith('enemypoolmembers');
      expect(mockQuery.insert).toHaveBeenCalledWith({
        enemy_pool_id: 'pool-1',
        enemy_type_id: 'enemy-1',
        spawn_weight: 150
      });
    });

    it('should use default weight when not specified', async () => {
      const poolDataWithoutWeight = {
        enemy_pool_id: 'pool-1',
        enemy_type_id: 'enemy-1'
      };
      mockQuery.insert = jest.fn().mockResolvedValue({ error: null });

      await repository.addEnemyToPool(poolDataWithoutWeight);

      expect(mockQuery.insert).toHaveBeenCalledWith({
        enemy_pool_id: 'pool-1',
        enemy_type_id: 'enemy-1',
        spawn_weight: 100
      });
    });
  });

  describe('removeEnemyFromPool', () => {
    it('should remove enemy from pool and return true', async () => {
      const customMockQuery = {
        ...mockQuery,
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      // Chain the second eq call to return the result
      customMockQuery.eq.mockReturnValueOnce(customMockQuery).mockResolvedValueOnce({ error: null, count: 1 });
      mockSupabase.from.mockReturnValue(customMockQuery);

      const result = await repository.removeEnemyFromPool('pool-1', 'enemy-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('enemypoolmembers');
      expect(customMockQuery.delete).toHaveBeenCalledWith({ count: 'exact' });
      expect(result).toBe(true);
    });

    it('should return false when no enemy removed', async () => {
      const customMockQuery = {
        ...mockQuery,
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn(),
        catch: jest.fn(),
      };
      // Make the final chain awaitable
      customMockQuery.then.mockImplementation((resolve: any) =>
        resolve({ error: null, count: 0 })
      );
      mockSupabase.from.mockReturnValue(customMockQuery);

      const result = await repository.removeEnemyFromPool('pool-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('findEnemyPoolWithMembers', () => {
    const mockPool = {
      id: 'pool-1',
      name: 'Forest Pool',
      combat_level: 5,
      filter_type: 'location_type',
      filter_value: 'forest',
      created_at: '2024-01-01T00:00:00Z'
    };

    const mockMembers = [
      {
        id: 'member-1',
        enemy_pool_id: 'pool-1',
        enemy_type_id: 'enemy-1',
        spawn_weight: 100,
        created_at: '2024-01-01T00:00:00Z',
        enemy_type: {
          id: 'enemy-1',
          name: 'Goblin',
          tier_id: 1,
          style_id: 'style-1'
        }
      }
    ];

    it('should find pool with members', async () => {
      // Mock pool query
      const poolQuery = {
        ...mockQuery,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPool, error: null })
      };

      // Mock members query
      const membersQuery = {
        ...mockQuery,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockMembers, error: null })
      };

      mockSupabase.from
        .mockReturnValueOnce(poolQuery as any)
        .mockReturnValueOnce(membersQuery as any);

      const result = await repository.findEnemyPoolWithMembers('pool-1');

      expect(result).toEqual({
        ...mockPool,
        members: mockMembers
      });
    });

    it('should return null when pool not found', async () => {
      const poolQuery = {
        ...mockQuery,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      };

      mockSupabase.from.mockReturnValue(poolQuery as any);

      const result = await repository.findEnemyPoolWithMembers('nonexistent');

      expect(result).toBeNull();
    });
  });
});