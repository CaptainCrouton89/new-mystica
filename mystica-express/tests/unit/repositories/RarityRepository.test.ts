/**
 * RarityRepository Unit Tests
 *
 * Tests for the RarityRepository including:
 * - Rarity definition queries (items only)
 * - Material strength tier operations (v_material_tiers view)
 * - Stat multiplier and drop rate validation
 * - Abs_sum calculation and tier classification
 * - Tier distribution analytics
 * - Error handling and edge cases
 */

import { RarityRepository } from '../../../src/repositories/RarityRepository.js';
import { DatabaseError, ValidationError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('RarityRepository', () => {
  let repository: RarityRepository;
  let mockClient: any;
  let mockQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
    repository = new RarityRepository(mockClient as SupabaseClient);

    // Create mock query builder that supports chaining
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis()
    };

    mockClient.from.mockReturnValue(mockQuery);
  });

  // ============================================================================
  // Rarity Definitions (Items Only)
  // ============================================================================

  describe('Rarity Definitions', () => {
    const mockRarityDef = {
      rarity: 'rare' as const,
      stat_multiplier: 1.5,
      base_drop_rate: 0.15,
      display_name: 'Rare',
      color_hex: '#3498db',
      created_at: '2024-01-01T00:00:00Z'
    };

    describe('findRarityByName', () => {
      it('should find rarity definition by name', async () => {
        mockQuery.single.mockResolvedValue({ data: mockRarityDef, error: null });

        const result = await repository.findRarityByName('rare');

        expect(mockClient.from).toHaveBeenCalledWith('raritydefinitions');
        expect(mockQuery.select).toHaveBeenCalledWith('*');
        expect(mockQuery.eq).toHaveBeenCalledWith('rarity', 'rare');
        expect(mockQuery.single).toHaveBeenCalled();
        expect(result).toEqual(mockRarityDef);
      });

      it('should return null when rarity not found', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findRarityByName('mythical' as any);

        expect(result).toBeNull();
      });

      it('should throw DatabaseError on query failure', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST301', message: 'Query failed' }
        });

        await expect(repository.findRarityByName('rare')).rejects.toThrow(DatabaseError);
      });
    });

    describe('getAllRarities', () => {
      it('should return all rarities ordered by stat multiplier', async () => {
        const mockRarities = [
          { ...mockRarityDef, rarity: 'common', stat_multiplier: 1.0 },
          { ...mockRarityDef, rarity: 'uncommon', stat_multiplier: 1.25 },
          { ...mockRarityDef, rarity: 'rare', stat_multiplier: 1.5 }
        ];

        mockQuery.single.mockImplementation(() => {
          throw new Error('Should not call single');
        });

        // Override findMany method behavior
        jest.spyOn(repository as any, 'findMany').mockResolvedValue(mockRarities);

        const result = await repository.getAllRarities();

        expect(repository['findMany']).toHaveBeenCalledWith({}, {
          sort: { orderBy: 'stat_multiplier', ascending: true }
        });
        expect(result).toEqual(mockRarities);
      });
    });

    describe('getStatMultiplier', () => {
      it('should return stat multiplier for valid rarity', async () => {
        jest.spyOn(repository, 'findRarityByName').mockResolvedValue(mockRarityDef);

        const result = await repository.getStatMultiplier('rare');

        expect(repository.findRarityByName).toHaveBeenCalledWith('rare');
        expect(result).toBe(1.5);
      });

      it('should throw ValidationError when rarity not found', async () => {
        jest.spyOn(repository, 'findRarityByName').mockResolvedValue(null);

        await expect(repository.getStatMultiplier('mythical')).rejects.toThrow(
          new ValidationError("Rarity 'mythical' not found")
        );
      });

      it('should validate stat multiplier range', async () => {
        const invalidRarity = { ...mockRarityDef, stat_multiplier: 3.0 };
        jest.spyOn(repository, 'findRarityByName').mockResolvedValue(invalidRarity);

        await expect(repository.getStatMultiplier('rare')).rejects.toThrow(
          new ValidationError("Invalid stat multiplier 3 for rarity 'rare'. Expected range: 1.00-2.00")
        );
      });
    });

    describe('getBaseDropRate', () => {
      it('should return base drop rate for valid rarity', async () => {
        jest.spyOn(repository, 'findRarityByName').mockResolvedValue(mockRarityDef);

        const result = await repository.getBaseDropRate('rare');

        expect(repository.findRarityByName).toHaveBeenCalledWith('rare');
        expect(result).toBe(0.15);
      });

      it('should throw ValidationError when rarity not found', async () => {
        jest.spyOn(repository, 'findRarityByName').mockResolvedValue(null);

        await expect(repository.getBaseDropRate('mythical')).rejects.toThrow(
          new ValidationError("Rarity 'mythical' not found")
        );
      });

      it('should validate drop rate range', async () => {
        const invalidRarity = { ...mockRarityDef, base_drop_rate: 1.5 };
        jest.spyOn(repository, 'findRarityByName').mockResolvedValue(invalidRarity);

        await expect(repository.getBaseDropRate('rare')).rejects.toThrow(
          new ValidationError("Invalid drop rate 1.5 for rarity 'rare'. Expected range: 0.0-1.0")
        );
      });
    });
  });

  // ============================================================================
  // Material Strength Tiers (Derived)
  // ============================================================================

  describe('Material Strength Tiers', () => {
    const mockMaterialTier = {
      material_id: 'mat-123',
      abs_sum: 15.5,
      tier_name: 'medium'
    };

    const mockTierDef = {
      tier_name: 'medium',
      min_abs_sum: 10.0,
      max_abs_sum: 20.0,
      display_name: 'Medium',
      created_at: '2024-01-01T00:00:00Z'
    };

    describe('findMaterialTier', () => {
      it('should find material tier using v_material_tiers view', async () => {
        mockQuery.single.mockResolvedValue({ data: mockMaterialTier, error: null });

        const result = await repository.findMaterialTier('mat-123');

        expect(mockClient.from).toHaveBeenCalledWith('v_material_tiers');
        expect(mockQuery.select).toHaveBeenCalledWith('material_id, abs_sum, tier_name');
        expect(mockQuery.eq).toHaveBeenCalledWith('material_id', 'mat-123');
        expect(mockQuery.single).toHaveBeenCalled();
        expect(result).toEqual(mockMaterialTier);
      });

      it('should return null when material tier not found', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findMaterialTier('nonexistent');

        expect(result).toBeNull();
      });

      it('should throw DatabaseError on query failure', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST301', message: 'Query failed' }
        });

        await expect(repository.findMaterialTier('mat-123')).rejects.toThrow(DatabaseError);
      });
    });

    describe('getAllMaterialTiers', () => {
      it('should return all tier definitions ordered by min_abs_sum', async () => {
        const mockTiers = [
          { ...mockTierDef, tier_name: 'low', min_abs_sum: 0 },
          { ...mockTierDef, tier_name: 'medium', min_abs_sum: 10 },
          { ...mockTierDef, tier_name: 'high', min_abs_sum: 20 }
        ];

        mockQuery.single.mockImplementation(() => {
          throw new Error('Should not call single');
        });
        mockClient.from.mockReturnValue({
          ...mockQuery,
          single: undefined
        });
        mockQuery.order.mockResolvedValue({ data: mockTiers, error: null });

        const result = await repository.getAllMaterialTiers();

        expect(mockClient.from).toHaveBeenCalledWith('materialstrengthtiers');
        expect(mockQuery.select).toHaveBeenCalledWith('*');
        expect(mockQuery.order).toHaveBeenCalledWith('min_abs_sum', { ascending: true });
        expect(result).toEqual(mockTiers);
      });

      it('should throw DatabaseError on query failure', async () => {
        mockQuery.order.mockResolvedValue({
          data: null,
          error: { code: 'PGRST301', message: 'Query failed' }
        });

        await expect(repository.getAllMaterialTiers()).rejects.toThrow(DatabaseError);
      });
    });

    describe('computeMaterialAbsSum', () => {
      it('should compute absolute sum correctly', () => {
        const stats = {
          atkPower: 5.0,
          atkAccuracy: -3.0,
          defPower: 2.5,
          defAccuracy: -1.5
        };

        const result = repository.computeMaterialAbsSum(stats);

        expect(result).toBe(12.0); // |5| + |-3| + |2.5| + |-1.5| = 5 + 3 + 2.5 + 1.5
      });

      it('should handle zero values', () => {
        const stats = {
          atkPower: 0,
          atkAccuracy: 0,
          defPower: 0,
          defAccuracy: 0
        };

        const result = repository.computeMaterialAbsSum(stats);

        expect(result).toBe(0);
      });

      it('should handle all positive values', () => {
        const stats = {
          atkPower: 1.0,
          atkAccuracy: 2.0,
          defPower: 3.0,
          defAccuracy: 4.0
        };

        const result = repository.computeMaterialAbsSum(stats);

        expect(result).toBe(10.0);
      });
    });

    describe('findTierForAbsSum', () => {
      it('should find tier for given abs_sum', async () => {
        mockQuery.single.mockResolvedValue({
          data: { tier_name: 'medium' },
          error: null
        });

        const result = await repository.findTierForAbsSum(15.0);

        expect(mockClient.from).toHaveBeenCalledWith('materialstrengthtiers');
        expect(mockQuery.select).toHaveBeenCalledWith('tier_name');
        expect(mockQuery.gte).toHaveBeenCalledWith('max_abs_sum', 15.0);
        expect(mockQuery.lte).toHaveBeenCalledWith('min_abs_sum', 15.0);
        expect(result).toBe('medium');
      });

      it('should return null when no tier matches', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        });

        const result = await repository.findTierForAbsSum(999.0);

        expect(result).toBeNull();
      });
    });

    describe('validateMaterialTierAssignment', () => {
      it('should validate correct tier assignment', async () => {
        jest.spyOn(repository, 'findMaterialTier').mockResolvedValue(mockMaterialTier);

        const result = await repository.validateMaterialTierAssignment('mat-123', 'medium');

        expect(repository.findMaterialTier).toHaveBeenCalledWith('mat-123');
        expect(result).toBe(true);
      });

      it('should throw ValidationError when material not found', async () => {
        jest.spyOn(repository, 'findMaterialTier').mockResolvedValue(null);

        await expect(repository.validateMaterialTierAssignment('nonexistent', 'medium'))
          .rejects.toThrow(new ValidationError("Material 'nonexistent' not found in tier view"));
      });

      it('should throw ValidationError on tier mismatch', async () => {
        jest.spyOn(repository, 'findMaterialTier').mockResolvedValue(mockMaterialTier);

        await expect(repository.validateMaterialTierAssignment('mat-123', 'high'))
          .rejects.toThrow(
            new ValidationError("Material 'mat-123' tier mismatch. Expected: 'high', Found: 'medium' (abs_sum: 15.5)")
          );
      });
    });
  });

  // ============================================================================
  // Batch Operations
  // ============================================================================

  describe('Batch Operations', () => {
    const mockMaterialTiers = [
      { material_id: 'mat-1', abs_sum: 18.0, tier_name: 'medium' },
      { material_id: 'mat-2', abs_sum: 15.5, tier_name: 'medium' },
      { material_id: 'mat-3', abs_sum: 12.0, tier_name: 'medium' }
    ];

    describe('getMaterialsByTier', () => {
      it('should get materials by tier name ordered by abs_sum desc', async () => {
        mockQuery.order.mockResolvedValue({ data: mockMaterialTiers, error: null });

        const result = await repository.getMaterialsByTier('medium');

        expect(mockClient.from).toHaveBeenCalledWith('v_material_tiers');
        expect(mockQuery.select).toHaveBeenCalledWith('material_id, abs_sum, tier_name');
        expect(mockQuery.eq).toHaveBeenCalledWith('tier_name', 'medium');
        expect(mockQuery.order).toHaveBeenCalledWith('abs_sum', { ascending: false });
        expect(result).toEqual(mockMaterialTiers);
      });

      it('should throw DatabaseError on query failure', async () => {
        mockQuery.order.mockResolvedValue({
          data: null,
          error: { code: 'PGRST301', message: 'Query failed' }
        });

        await expect(repository.getMaterialsByTier('medium')).rejects.toThrow(DatabaseError);
      });
    });

    describe('getTierDistribution', () => {
      it('should compute tier distribution correctly', async () => {
        const mockData = [
          { tier_name: 'low' },
          { tier_name: 'low' },
          { tier_name: 'medium' },
          { tier_name: 'medium' },
          { tier_name: 'medium' },
          { tier_name: 'high' }
        ];

        mockQuery.order.mockResolvedValue({ data: mockData, error: null });

        const result = await repository.getTierDistribution();

        expect(mockClient.from).toHaveBeenCalledWith('v_material_tiers');
        expect(mockQuery.select).toHaveBeenCalledWith('tier_name');
        expect(mockQuery.order).toHaveBeenCalledWith('tier_name');
        expect(result).toEqual({
          low: 2,
          medium: 3,
          high: 1
        });
      });

      it('should handle empty results', async () => {
        mockQuery.order.mockResolvedValue({ data: [], error: null });

        const result = await repository.getTierDistribution();

        expect(result).toEqual({});
      });

      it('should throw DatabaseError on query failure', async () => {
        mockQuery.order.mockResolvedValue({
          data: null,
          error: { code: 'PGRST301', message: 'Query failed' }
        });

        await expect(repository.getTierDistribution()).rejects.toThrow(DatabaseError);
      });
    });
  });

  // ============================================================================
  // Integration with BaseRepository
  // ============================================================================

  describe('BaseRepository Integration', () => {
    it('should extend BaseRepository with correct table name', () => {
      expect((repository as any).tableName).toBe('raritydefinitions');
    });

    it('should inherit BaseRepository methods', () => {
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findMany).toBe('function');
      expect(typeof repository.findOne).toBe('function');
      expect(typeof repository.create).toBe('function');
      expect(typeof repository.update).toBe('function');
      expect(typeof repository.delete).toBe('function');
    });
  });
});