/**
 * EnemyRepository Unit Tests
 *
 * Tests enemy type retrieval, stats calculation via v_enemy_realized_stats view,
 * personality data handling, tier/style operations, and pool management.
 */

import { EnemyRepository } from '../../../src/repositories/EnemyRepository.js';
import { NotFoundError, DatabaseError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('EnemyRepository', () => {
  let repository: EnemyRepository;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new EnemyRepository(mockClient);
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
      atk_power: 15,
      atk_accuracy: 85,
      def_power: 12,
      def_accuracy: 80,
      base_hp: 80,
      ai_personality_traits: { aggression: 'high', cunning: 'medium' },
      dialogue_tone: 'mocking',
      dialogue_guidelines: 'A sneaky forest dweller'
    };

    it('should find enemy type by ID with personality data', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockEnemyType,
              error: null
            })
          })
        })
      });

      const result = await repository.findEnemyTypeById('enemy-1');

      expect(mockClient.from).toHaveBeenCalledWith('enemytypes');
      expect(result).toEqual({
        ...mockEnemyType,
        ai_personality_traits: { aggression: 'high', cunning: 'medium' }
      });
    });

    it('should return null when enemy type not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows returned' }
            })
          })
        })
      });

      const result = await repository.findEnemyTypeById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle JSON string personality data', async () => {
      const enemyWithStringJson = {
        ...mockEnemyType,
        ai_personality_traits: '{"aggression": "high"}'
      };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: enemyWithStringJson,
              error: null
            })
          })
        })
      });

      const result = await repository.findEnemyTypeById('enemy-1');

      expect(result?.ai_personality_traits).toEqual({ aggression: 'high' });
    });

    it('should handle invalid JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const enemyWithBadJson = {
        ...mockEnemyType,
        ai_personality_traits: 'invalid json'
      };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: enemyWithBadJson,
              error: null
            })
          })
        })
      });

      const result = await repository.findEnemyTypeById('enemy-1');

      expect(result?.ai_personality_traits).toBeNull();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should throw DatabaseError on query failure', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST301', message: 'Database error' }
            })
          })
        })
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
      mockClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: mockEnemyTypes,
          error: null
        })
      });

      const result = await repository.findAllEnemyTypes();

      expect(mockClient.from).toHaveBeenCalledWith('enemytypes');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('enemy-1');
    });

    it('should apply ordering when specified', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockEnemyTypes,
            error: null
          })
        })
      });

      await repository.findAllEnemyTypes({ orderBy: 'name' });

      expect(mockClient.from).toHaveBeenCalledWith('enemytypes');
    });

    it('should apply pagination when specified', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({
              data: mockEnemyTypes,
              error: null
            })
          })
        })
      });

      await repository.findAllEnemyTypes({ limit: 10, offset: 5 });

      expect(mockClient.from).toHaveBeenCalledWith('enemytypes');
    });
  });

  describe('findEnemyTypesByTier', () => {
    it('should find enemy types by tier ID', async () => {
      const mockEnemyTypes = [{ id: 'enemy-1', tier_id: 2 }];
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEnemyTypes,
              error: null
            })
          })
        })
      });

      const result = await repository.findEnemyTypesByTier(2);

      expect(mockClient.from).toHaveBeenCalledWith('enemytypes');
      expect(result).toHaveLength(1);
    });
  });

  describe('findEnemyTypesByStyle', () => {
    it('should find enemy types by style ID', async () => {
      const mockEnemyTypes = [{ id: 'enemy-1', style_id: 'fire-style' }];
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEnemyTypes,
              error: null
            })
          })
        })
      });

      const result = await repository.findEnemyTypesByStyle('fire-style');

      expect(mockClient.from).toHaveBeenCalledWith('enemytypes');
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
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStats,
              error: null
            })
          })
        })
      });

      const result = await repository.getEnemyRealizedStats('enemy-1');

      expect(mockClient.from).toHaveBeenCalledWith('v_enemy_realized_stats');
      expect(result).toEqual(mockStats);
    });

    it('should return null when enemy not found in view', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      });

      const result = await repository.getEnemyRealizedStats('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when stats are incomplete', async () => {
      const incompleteStats = { atk: 25, def: null, hp: 120, combat_rating: 87.5 };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: incompleteStats,
              error: null
            })
          })
        })
      });

      await expect(repository.getEnemyRealizedStats('enemy-1'))
        .rejects.toThrow('Incomplete stats for enemy type enemy-1');
    });
  });

  describe('computeCombatRating', () => {
    it('should compute combat rating from realized stats', async () => {
      const mockStats = { atk: 25, def: 18, hp: 120, combat_rating: 87.5 };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStats,
              error: null
            })
          })
        })
      });

      const result = await repository.computeCombatRating('enemy-1');

      expect(result).toBe(87.5);
    });

    it('should throw NotFoundError when enemy not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
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
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTier,
              error: null
            })
          })
        })
      });

      const result = await repository.findTierById(1);

      expect(mockClient.from).toHaveBeenCalledWith('tiers');
      expect(result).toEqual(mockTier);
    });

    it('should return null when tier not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
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
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockTiers,
            error: null
          })
        })
      });

      const result = await repository.getAllTiers();

      expect(mockClient.from).toHaveBeenCalledWith('tiers');
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
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStyle,
              error: null
            })
          })
        })
      });

      const result = await repository.findStyleById('style-1');

      expect(mockClient.from).toHaveBeenCalledWith('styledefinitions');
      expect(result).toEqual(mockStyle);
    });
  });

  describe('getAllStyles', () => {
    it('should get all styles ordered by spawn_rate descending', async () => {
      const mockStyles = [
        { id: 'style-1', spawn_rate: 0.8 },
        { id: 'style-2', spawn_rate: 0.2 }
      ];
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockStyles,
            error: null
          })
        })
      });

      const result = await repository.getAllStyles();

      expect(mockClient.from).toHaveBeenCalledWith('styledefinitions');
      expect(result).toEqual(mockStyles);
    });
  });

  describe('findStyleByName', () => {
    it('should find style by name', async () => {
      const mockStyle = { id: 'style-1', style_name: 'fire' };
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStyle,
              error: null
            })
          })
        })
      });

      const result = await repository.findStyleByName('fire');

      expect(mockClient.from).toHaveBeenCalledWith('styledefinitions');
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
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedPool,
              error: null
            })
          })
        })
      });

      const result = await repository.createEnemyPool(mockPoolData);

      expect(mockClient.from).toHaveBeenCalledWith('enemypools');
      expect(result).toEqual(mockCreatedPool);
    });

    it('should create pool with null filter_value when not provided', async () => {
      const poolWithoutFilter = {
        name: 'Global Pool',
        combat_level: 10,
        filter_type: 'global'
      };
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedPool,
              error: null
            })
          })
        })
      });

      await repository.createEnemyPool(poolWithoutFilter);

      expect(mockClient.from).toHaveBeenCalledWith('enemypools');
    });
  });

  describe('addEnemyToPool', () => {
    const mockPoolData = {
      enemy_pool_id: 'pool-1',
      enemy_type_id: 'enemy-1',
      spawn_weight: 150
    };

    it('should add enemy to pool with specified weight', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      await repository.addEnemyToPool(mockPoolData);

      expect(mockClient.from).toHaveBeenCalledWith('enemypoolmembers');
    });

    it('should use default weight when not specified', async () => {
      const poolDataWithoutWeight = {
        enemy_pool_id: 'pool-1',
        enemy_type_id: 'enemy-1'
      };
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      await repository.addEnemyToPool(poolDataWithoutWeight);

      expect(mockClient.from).toHaveBeenCalledWith('enemypoolmembers');
    });
  });

  describe('removeEnemyFromPool', () => {
    it('should remove enemy from pool and return true', async () => {
      mockClient.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
              count: 1
            })
          })
        })
      });

      const result = await repository.removeEnemyFromPool('pool-1', 'enemy-1');

      expect(mockClient.from).toHaveBeenCalledWith('enemypoolmembers');
      expect(result).toBe(true);
    });

    it('should return false when no enemy removed', async () => {
      mockClient.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
              count: 0
            })
          })
        })
      });

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
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPool,
                error: null
              })
            })
          })
        })
        // Mock members query
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMembers,
              error: null
            })
          })
        });

      const result = await repository.findEnemyPoolWithMembers('pool-1');

      expect(result).toEqual({
        ...mockPool,
        members: mockMembers
      });
    });

    it('should return null when pool not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      });

      const result = await repository.findEnemyPoolWithMembers('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getStylesForEnemyType', () => {
    const mockStyles = [
      {
        id: 'style-entry-1',
        enemy_type_id: 'enemy-1',
        style_id: 'red-goblin',
        weight_multiplier: 1.5,
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'style-entry-2',
        enemy_type_id: 'enemy-1',
        style_id: 'blue-goblin',
        weight_multiplier: 1.0,
        created_at: '2024-01-01T00:00:00Z'
      }
    ];

    it('should fetch all style options for enemy type with weight multipliers', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockStyles,
              error: null
            })
          })
        })
      });

      const result = await repository.getStylesForEnemyType('enemy-1');

      expect(mockClient.from).toHaveBeenCalledWith('enemytypestyles');
      expect(result).toEqual(mockStyles);
      expect(result).toHaveLength(2);
      expect(result[0].weight_multiplier).toBe(1.5);
      expect(result[1].weight_multiplier).toBe(1.0);
    });

    it('should throw NotFoundError when enemy type has no styles', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      await expect(repository.getStylesForEnemyType('enemy-no-styles')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on query failure', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection failed' }
            })
          })
        })
      });

      await expect(repository.getStylesForEnemyType('enemy-1')).rejects.toThrow();
    });

    it('should handle single style entry correctly', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockStyles[0]],
              error: null
            })
          })
        })
      });

      const result = await repository.getStylesForEnemyType('enemy-1');

      expect(result).toHaveLength(1);
      expect(result[0].style_id).toBe('red-goblin');
    });
  });
});