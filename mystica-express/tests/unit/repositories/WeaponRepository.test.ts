/**
 * WeaponRepository Unit Tests
 *
 * Tests weapon timing mechanics, degree validation, and combat calculations
 */

import { WeaponRepository } from '../../../src/repositories/WeaponRepository.js';
import { supabase } from '../../../src/config/supabase.js';
import { DatabaseError, ValidationError, NotFoundError } from '../../../src/utils/errors.js';
import { DegreeConfig, CreateWeaponData } from '../../../src/types/repository.types.js';

// Mock Supabase client
jest.mock('../../../src/config/supabase.js');

describe('WeaponRepository', () => {
  let repository: WeaponRepository;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: jest.fn(() => mockClient),
      select: jest.fn(() => mockClient),
      insert: jest.fn(() => mockClient),
      update: jest.fn(() => mockClient),
      eq: jest.fn(() => mockClient),
      single: jest.fn(() => mockClient),
      rpc: jest.fn()
    };

    (supabase as any) = mockClient;
    repository = new WeaponRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findWeaponByItemId', () => {
    it('should find weapon by item ID', async () => {
      const mockWeapon = {
        item_id: 'weapon-1',
        pattern: 'single_arc',
        spin_deg_per_s: 360,
        deg_injure: 5,
        deg_miss: 45,
        deg_graze: 60,
        deg_normal: 200,
        deg_crit: 50
      };

      mockClient.single.mockResolvedValue({ data: mockWeapon, error: null });

      const result = await repository.findWeaponByItemId('weapon-1');

      expect(result).toEqual(mockWeapon);
      expect(mockClient.from).toHaveBeenCalledWith('weapons');
      expect(mockClient.select).toHaveBeenCalledWith('*');
      expect(mockClient.eq).toHaveBeenCalledWith('item_id', 'weapon-1');
    });

    it('should return null when weapon not found', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      const result = await repository.findWeaponByItemId('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on query failure', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Database error' }
      });

      await expect(repository.findWeaponByItemId('weapon-1'))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('createWeapon', () => {
    const validWeaponData: CreateWeaponData = {
      item_id: 'item-1',
      pattern: 'single_arc',
      spin_deg_per_s: 360,
      deg_injure: 5,
      deg_miss: 45,
      deg_graze: 60,
      deg_normal: 200,
      deg_crit: 50
    };

    it('should create weapon with valid data', async () => {
      const mockCreated = { ...validWeaponData };
      mockClient.single.mockResolvedValue({ data: mockCreated, error: null });

      const result = await repository.createWeapon(validWeaponData);

      expect(result).toEqual(mockCreated);
      expect(mockClient.from).toHaveBeenCalledWith('weapons');
      expect(mockClient.insert).toHaveBeenCalledWith(validWeaponData);
    });

    it('should create weapon with default values', async () => {
      const minimalData: CreateWeaponData = {
        item_id: 'item-1',
        pattern: 'single_arc'
      };

      const expectedInsert = {
        item_id: 'item-1',
        pattern: 'single_arc',
        spin_deg_per_s: 360.0,
        deg_injure: 5.0,
        deg_miss: 45.0,
        deg_graze: 60.0,
        deg_normal: 200.0,
        deg_crit: 50.0
      };

      mockClient.single.mockResolvedValue({ data: expectedInsert, error: null });

      await repository.createWeapon(minimalData);

      expect(mockClient.insert).toHaveBeenCalledWith(expectedInsert);
    });

    it('should reject degrees exceeding 360', async () => {
      const invalidData: CreateWeaponData = {
        item_id: 'item-1',
        pattern: 'single_arc',
        deg_injure: 100,
        deg_miss: 100,
        deg_graze: 100,
        deg_normal: 100,
        deg_crit: 100 // Total = 500 > 360
      };

      await expect(repository.createWeapon(invalidData))
        .rejects.toThrow(ValidationError);

      expect(mockClient.insert).not.toHaveBeenCalled();
    });

    it('should reject invalid spin speed', async () => {
      const invalidData: CreateWeaponData = {
        item_id: 'item-1',
        pattern: 'single_arc',
        spin_deg_per_s: -10 // Invalid: must be > 0
      };

      await expect(repository.createWeapon(invalidData))
        .rejects.toThrow(ValidationError);
    });

    it('should reject non-single_arc patterns in MVP0', async () => {
      const invalidData: CreateWeaponData = {
        item_id: 'item-1',
        pattern: 'dual_arcs' as any // Not allowed in MVP0
      };

      await expect(repository.createWeapon(invalidData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on foreign key constraint violation', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: {
          code: '23503',
          message: 'insert or update on table "weapons" violates foreign key constraint'
        }
      });

      await expect(repository.createWeapon(validWeaponData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw DatabaseError on general creation failure', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Internal server error' }
      });

      await expect(repository.createWeapon(validWeaponData))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('updateWeaponPattern', () => {
    it('should update weapon pattern', async () => {
      mockClient.single.mockResolvedValue({
        data: { item_id: 'weapon-1', pattern: 'single_arc' },
        error: null
      });

      await repository.updateWeaponPattern('weapon-1', 'single_arc');

      expect(mockClient.update).toHaveBeenCalledWith({ pattern: 'single_arc' });
      expect(mockClient.eq).toHaveBeenCalledWith('item_id', 'weapon-1');
    });

    it('should reject non-single_arc patterns', async () => {
      await expect(repository.updateWeaponPattern('weapon-1', 'dual_arcs' as any))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for nonexistent weapon', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await expect(repository.updateWeaponPattern('nonexistent', 'single_arc'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateHitBands', () => {
    const validBands: DegreeConfig = {
      deg_injure: 10,
      deg_miss: 50,
      deg_graze: 70,
      deg_normal: 180,
      deg_crit: 50
    };

    it('should update hit bands with valid degrees', async () => {
      mockClient.single.mockResolvedValue({
        data: { item_id: 'weapon-1', ...validBands },
        error: null
      });

      await repository.updateHitBands('weapon-1', validBands);

      expect(mockClient.update).toHaveBeenCalledWith(validBands);
      expect(mockClient.eq).toHaveBeenCalledWith('item_id', 'weapon-1');
    });

    it('should reject bands exceeding 360 degrees', async () => {
      const invalidBands: DegreeConfig = {
        deg_injure: 100,
        deg_miss: 100,
        deg_graze: 100,
        deg_normal: 100,
        deg_crit: 100 // Total = 500 > 360
      };

      await expect(repository.updateHitBands('weapon-1', invalidBands))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getAdjustedBands', () => {
    it('should return adjusted bands from PostgreSQL function', async () => {
      const mockResult = {
        deg_injure: 2.5,
        deg_miss: 22.5,
        deg_graze: 75.0,
        deg_normal: 210.0,
        deg_crit: 50.0
      };

      mockClient.rpc.mockResolvedValue({ data: mockResult, error: null });

      const result = await repository.getAdjustedBands('weapon-1', 85.0);

      expect(result).toEqual({
        ...mockResult,
        total_degrees: 360.0
      });

      expect(mockClient.rpc).toHaveBeenCalledWith('fn_weapon_bands_adjusted', {
        w_id: 'weapon-1',
        player_acc: 85.0
      });
    });

    it('should throw NotFoundError for nonexistent weapon', async () => {
      const errorMessage = 'Weapon not found: nonexistent';
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: errorMessage, code: 'P0001' }
      });

      await expect(repository.getAdjustedBands('nonexistent', 85.0))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle PostgreSQL function errors', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Function execution failed', code: 'P0002' }
      });

      await expect(repository.getAdjustedBands('weapon-1', 85.0))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('getExpectedDamageMultiplier', () => {
    it('should return damage multiplier from PostgreSQL function', async () => {
      mockClient.rpc.mockResolvedValue({ data: 1.25, error: null });

      const result = await repository.getExpectedDamageMultiplier('weapon-1', 85.0);

      expect(result).toBe(1.25);
      expect(mockClient.rpc).toHaveBeenCalledWith('fn_expected_mul_quick', {
        w_id: 'weapon-1',
        player_acc: 85.0
      });
    });

    it('should handle function call errors', async () => {
      mockClient.rpc.mockRejectedValue(new DatabaseError('Function error'));

      await expect(repository.getExpectedDamageMultiplier('weapon-1', 85.0))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('validateDegreeSum', () => {
    it('should validate degrees within 360 limit', () => {
      const validDegrees: DegreeConfig = {
        deg_injure: 5,
        deg_miss: 45,
        deg_graze: 60,
        deg_normal: 200,
        deg_crit: 50 // Total = 360
      };

      expect(repository.validateDegreeSum(validDegrees)).toBe(true);
    });

    it('should reject degrees exceeding 360', () => {
      const invalidDegrees: DegreeConfig = {
        deg_injure: 100,
        deg_miss: 100,
        deg_graze: 100,
        deg_normal: 100,
        deg_crit: 100 // Total = 500
      };

      expect(repository.validateDegreeSum(invalidDegrees)).toBe(false);
    });

    it('should validate exact 360 degrees', () => {
      const exactDegrees: DegreeConfig = {
        deg_injure: 72,
        deg_miss: 72,
        deg_graze: 72,
        deg_normal: 72,
        deg_crit: 72 // Total = 360
      };

      expect(repository.validateDegreeSum(exactDegrees)).toBe(true);
    });
  });

  describe('validateSpinSpeed', () => {
    it('should validate positive spin speeds', () => {
      expect(repository.validateSpinSpeed(360)).toBe(true);
      expect(repository.validateSpinSpeed(180)).toBe(true);
      expect(repository.validateSpinSpeed(0.1)).toBe(true);
    });

    it('should reject zero or negative spin speeds', () => {
      expect(repository.validateSpinSpeed(0)).toBe(false);
      expect(repository.validateSpinSpeed(-10)).toBe(false);
      expect(repository.validateSpinSpeed(-360)).toBe(false);
    });
  });

  describe('getWeaponCombatStats', () => {
    const mockWeapon = {
      item_id: 'weapon-1',
      pattern: 'single_arc',
      spin_deg_per_s: 360,
      deg_injure: 5,
      deg_miss: 45,
      deg_graze: 60,
      deg_normal: 200,
      deg_crit: 50
    };

    const mockAdjustedBands = {
      deg_injure: 2.5,
      deg_miss: 22.5,
      deg_graze: 75.0,
      deg_normal: 210.0,
      deg_crit: 50.0,
      total_degrees: 360.0
    };

    it('should return comprehensive combat statistics', async () => {
      mockClient.single.mockResolvedValue({ data: mockWeapon, error: null });
      mockClient.rpc
        .mockResolvedValueOnce({ data: mockAdjustedBands, error: null })
        .mockResolvedValueOnce({ data: 1.25, error: null });

      const result = await repository.getWeaponCombatStats('weapon-1', 85.0);

      expect(result).toEqual({
        weapon: mockWeapon,
        adjustedBands: mockAdjustedBands,
        expectedDamageMultiplier: 1.25
      });
    });

    it('should throw NotFoundError for nonexistent weapon', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await expect(repository.getWeaponCombatStats('nonexistent', 85.0))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('findWeaponWithItem', () => {
    it('should find weapon with item details', async () => {
      const mockWeaponWithItem = {
        item_id: 'weapon-1',
        pattern: 'single_arc',
        spin_deg_per_s: 360,
        deg_injure: 5,
        deg_miss: 45,
        deg_graze: 60,
        deg_normal: 200,
        deg_crit: 50,
        item: {
          id: 'weapon-1',
          user_id: 'user-1',
          name: 'Iron Sword',
          category: 'weapon',
          rarity: 'common'
        }
      };

      mockClient.single.mockResolvedValue({ data: mockWeaponWithItem, error: null });

      const result = await repository.findWeaponWithItem('weapon-1');

      expect(result).toEqual(mockWeaponWithItem);
      expect(mockClient.from).toHaveBeenCalledWith('weapons');
      expect(mockClient.select).toHaveBeenCalledWith(`
        *,
        item:items!inner(*)
      `);
      expect(mockClient.eq).toHaveBeenCalledWith('item_id', 'weapon-1');
    });

    it('should return null when weapon with item not found', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      const result = await repository.findWeaponWithItem('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on query failure', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Internal error' }
      });

      await expect(repository.findWeaponWithItem('weapon-1'))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('findUserWeapons', () => {
    it('should find all weapons for a user', async () => {
      const mockUserWeapons = [
        {
          item_id: 'weapon-1',
          pattern: 'single_arc',
          spin_deg_per_s: 360,
          deg_injure: 5,
          deg_miss: 45,
          deg_graze: 60,
          deg_normal: 200,
          deg_crit: 50,
          item: {
            id: 'weapon-1',
            user_id: 'user-1',
            name: 'Iron Sword',
            category: 'weapon'
          }
        },
        {
          item_id: 'weapon-2',
          pattern: 'single_arc',
          spin_deg_per_s: 180,
          deg_injure: 10,
          deg_miss: 40,
          deg_graze: 50,
          deg_normal: 190,
          deg_crit: 70,
          item: {
            id: 'weapon-2',
            user_id: 'user-1',
            name: 'Steel Axe',
            category: 'weapon'
          }
        }
      ];

      mockClient.eq.mockReturnValue({ data: mockUserWeapons, error: null });

      const result = await repository.findUserWeapons('user-1');

      expect(result).toEqual(mockUserWeapons);
      expect(mockClient.from).toHaveBeenCalledWith('weapons');
      expect(mockClient.select).toHaveBeenCalledWith(`
        *,
        item:items!inner(*)
      `);
      expect(mockClient.eq).toHaveBeenCalledWith('item.user_id', 'user-1');
    });

    it('should return empty array when user has no weapons', async () => {
      mockClient.eq.mockReturnValue({ data: [], error: null });

      const result = await repository.findUserWeapons('user-1');

      expect(result).toEqual([]);
    });

    it('should handle null data response', async () => {
      mockClient.eq.mockReturnValue({ data: null, error: null });

      const result = await repository.findUserWeapons('user-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      mockClient.eq.mockReturnValue({
        data: null,
        error: { code: 'PGRST500', message: 'Query failed' }
      });

      await expect(repository.findUserWeapons('user-1'))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('updateWeapon', () => {
    const currentWeapon = {
      item_id: 'weapon-1',
      pattern: 'single_arc',
      spin_deg_per_s: 360,
      deg_injure: 5,
      deg_miss: 45,
      deg_graze: 60,
      deg_normal: 200,
      deg_crit: 50
    };

    it('should update weapon with valid data', async () => {
      const updateData = { spin_deg_per_s: 180 };
      const updatedWeapon = { ...currentWeapon, spin_deg_per_s: 180 };

      mockClient.single.mockResolvedValue({ data: updatedWeapon, error: null });

      const result = await repository.updateWeapon('weapon-1', updateData);

      expect(result).toEqual(updatedWeapon);
      expect(mockClient.update).toHaveBeenCalledWith(updateData);
      expect(mockClient.eq).toHaveBeenCalledWith('item_id', 'weapon-1');
    });

    it('should validate pattern updates', async () => {
      const invalidUpdate = { pattern: 'dual_arcs' as any };

      await expect(repository.updateWeapon('weapon-1', invalidUpdate))
        .rejects.toThrow('MVP0 only supports single_arc pattern');
    });

    it('should validate spin speed updates', async () => {
      const invalidUpdate = { spin_deg_per_s: -10 };

      await expect(repository.updateWeapon('weapon-1', invalidUpdate))
        .rejects.toThrow('Spin speed must be greater than 0');
    });

    it('should validate degree updates with current weapon state', async () => {
      // Mock findWeaponByItemId first, then update
      mockClient.single
        .mockResolvedValueOnce({ data: currentWeapon, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const invalidUpdate = { deg_crit: 150 }; // Would make total > 360

      await expect(repository.updateWeapon('weapon-1', invalidUpdate))
        .rejects.toThrow('Total degree sum cannot exceed 360');
    });

    it('should throw NotFoundError when weapon does not exist', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await expect(repository.updateWeapon('nonexistent', { spin_deg_per_s: 180 }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError during degree validation lookup', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await expect(repository.updateWeapon('weapon-1', { deg_crit: 100 }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle partial degree updates with validation', async () => {
      const currentWeapon = {
        item_id: 'weapon-1',
        pattern: 'single_arc',
        spin_deg_per_s: 360,
        deg_injure: 5,
        deg_miss: 45,
        deg_graze: 60,
        deg_normal: 200,
        deg_crit: 50
      };

      // Mock findWeaponByItemId for current state
      mockClient.single
        .mockResolvedValueOnce({ data: currentWeapon, error: null })
        .mockResolvedValueOnce({ data: { ...currentWeapon, deg_crit: 100 }, error: null });

      const partialUpdate = { deg_crit: 100 }; // Would make total = 410 > 360

      await expect(repository.updateWeapon('weapon-1', partialUpdate))
        .rejects.toThrow(ValidationError);
    });

    it('should handle boundary conditions for degree validation', () => {
      // Test exactly 360 degrees
      const exactLimit: DegreeConfig = {
        deg_injure: 0,
        deg_miss: 0,
        deg_graze: 0,
        deg_normal: 0,
        deg_crit: 360
      };
      expect(repository.validateDegreeSum(exactLimit)).toBe(true);

      // Test 360.1 degrees (should fail)
      const overLimit: DegreeConfig = {
        deg_injure: 0.1,
        deg_miss: 0,
        deg_graze: 0,
        deg_normal: 0,
        deg_crit: 360
      };
      expect(repository.validateDegreeSum(overLimit)).toBe(false);
    });

    it('should validate MVP0 pattern constraints consistently', async () => {
      const invalidPatterns = ['dual_arcs', 'pulsing_arc', 'roulette', 'sawtooth'];

      for (const pattern of invalidPatterns) {
        await expect(repository.updateWeaponPattern('weapon-1', pattern as any))
          .rejects.toThrow('MVP0 only supports single_arc pattern');
      }
    });
  });
});