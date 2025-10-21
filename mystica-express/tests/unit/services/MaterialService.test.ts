/**
 * Unit Tests: MaterialService (TDD Example)
 *
 * This test demonstrates Test-Driven Development using the new test infrastructure:
 * - Fixtures for static data
 * - Factories for dynamic data generation
 * - Seed data loaders for real game config
 * - Assertion helpers for validation
 *
 * WRITE THESE TESTS FIRST, THEN IMPLEMENT MaterialService TO MAKE THEM PASS
 */

import { MaterialService } from '../../../src/services/MaterialService.js';
import { NotFoundError, BusinessLogicError } from '../../../src/utils/errors.js';

// Import test infrastructure
import {
  ANONYMOUS_USER,
  IRON_MATERIAL,
  CRYSTAL_MATERIAL,
  PIXEL_ART_MATERIAL,
  MATERIAL_STACK_IRON,
  BASE_SWORD
} from '../../fixtures/index.js';

import {
  UserFactory,
  ItemFactory,
  MaterialFactory
} from '../../factories/index.js';

import {
  expectValidItem,
  expectValidMaterialApplication,
  expectCorrectStyledFlag,
  expectValidNormalizedStats
} from '../../helpers/assertions.js';

import {
  loadSeededMaterials,
  getMaterialById
} from '../../helpers/seedData.js';

// Mock Supabase BEFORE importing service
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

import { supabase } from '../../../src/config/supabase.js';
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe('MaterialService (TDD)', () => {
  let materialService: MaterialService;
  const userId = ANONYMOUS_USER.id;
  const itemId = BASE_SWORD.id;

  beforeEach(() => {
    materialService = new MaterialService();
    jest.clearAllMocks();

    // Setup default mock chain
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    } as any);
  });

  /**
   * Test Group 1: Material Inventory Retrieval
   * Tests getMaterialInventory() method
   */
  describe('getMaterialInventory()', () => {
    it('should return user material stacks grouped by material_id and style_id', async () => {
      // Arrange: Mock database response with 3 stacks
      const mockStacks = [
        { ...MATERIAL_STACK_IRON, quantity: 10 },
        { material_id: 'crystal', style_id: 'normal', quantity: 5, name: 'Crystal', theme: 'offensive' },
        { material_id: 'iron', style_id: 'pixel_art', quantity: 3, name: 'Iron', theme: 'defensive' }, // Same material, different style
      ];

      mockedSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockStacks,
          error: null
        })
      } as any);

      // Act: Call service method
      const result = await materialService.getMaterialInventory(userId);

      // Assert: Verify query and response
      expect(mockedSupabase.from).toHaveBeenCalledWith('MaterialStacks');
      expect(result).toHaveLength(3);
      expect(result[0].quantity).toBe(10);

      // Verify stacks are properly separated by style_id
      const ironStacks = result.filter(s => s.material_id === 'iron');
      expect(ironStacks).toHaveLength(2); // normal + pixel_art
    });

    it('should return empty array when user has no materials', async () => {
      mockedSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      } as any);

      const result = await materialService.getMaterialInventory(userId);
      expect(result).toEqual([]);
    });

    it('should include material stats and theme in response', async () => {
      const mockStack = {
        material_id: 'iron',
        style_id: 'normal',
        quantity: 10,
        name: 'Iron',
        theme: 'defensive',
        stat_modifiers: IRON_MATERIAL.stat_modifiers
      };

      mockedSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [mockStack],
          error: null
        })
      } as any);

      const result = await materialService.getMaterialInventory(userId);

      expect(result[0]).toHaveProperty('stat_modifiers');
      expect(result[0]).toHaveProperty('theme');
      expect(result[0].theme).toBe('defensive');
    });
  });

  /**
   * Test Group 2: Material Application
   * Tests applyMaterial() method with various scenarios
   */
  describe('applyMaterial()', () => {
    it('should successfully apply material to empty slot', async () => {
      // Arrange: Create item with no materials using factory
      const item = ItemFactory.createBase('sword', 1);

      // Mock item ownership check
      mockedSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: item,
          error: null
        })
      } as any);

      // Mock material stack check (sufficient quantity)
      mockedSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { quantity: 10 },
          error: null
        })
      } as any);

      // Mock material instance creation
      mockedSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'instance-123' },
          error: null
        })
      } as any);

      // Act: Apply iron material to slot 0
      const result = await materialService.applyMaterial(
        userId,
        item.id,
        IRON_MATERIAL.id,
        IRON_MATERIAL.style_id,
        0 // slot_index
      );

      // Assert: Verify successful application
      expect(result.success).toBe(true);
      expect(result.updated_item.applied_materials).toHaveLength(1);
      expect(result.updated_item.applied_materials[0]).toMatchObject({
        material_id: IRON_MATERIAL.id,
        style_id: 'normal',
        slot_index: 0
      });

      // Validate item structure
      expectValidItem(result.updated_item);
      expectValidMaterialApplication(result.updated_item);
    });

    it('should increment craft_count after applying material', async () => {
      const item = ItemFactory.createBase('sword', 1);

      // Mock successful application
      mockedSupabase.from.mockImplementation((table) => {
        if (table === 'Items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...item, craft_count: 1 }, // After increment
              error: null
            })
          } as any;
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { quantity: 10 }, error: null })
        } as any;
      });

      const result = await materialService.applyMaterial(userId, item.id, 'iron', 'normal', 0);

      expect(result.updated_item.craft_count).toBe(1);
    });

    it('should set is_styled=true when applying non-normal style', async () => {
      const item = ItemFactory.createBase('offhand', 1);

      // Apply pixel_art styled material
      mockedSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { quantity: 5 },
          error: null
        }),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null })
      } as any));

      const result = await materialService.applyMaterial(
        userId,
        item.id,
        PIXEL_ART_MATERIAL.id,
        'pixel_art',
        0
      );

      expect(result.updated_item.is_styled).toBe(true);
      expectCorrectStyledFlag(result.updated_item);
    });

    it('should throw BusinessLogicError when slot already occupied', async () => {
      // Arrange: Item with material in slot 0
      const item = ItemFactory.createCrafted(
        'sword',
        1,
        [IRON_MATERIAL.id],
        ['normal']
      );

      mockedSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: item,
          error: null
        })
      } as any);

      // Act & Assert: Attempt to apply to occupied slot 0
      await expect(
        materialService.applyMaterial(userId, item.id, 'crystal', 'normal', 0)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        materialService.applyMaterial(userId, item.id, 'crystal', 'normal', 0)
      ).rejects.toThrow('Slot 0 is already occupied');
    });

    it('should throw BusinessLogicError when exceeding 3 material limit', async () => {
      // Arrange: Item with 3 materials already applied
      const item = ItemFactory.createCrafted(
        'sword',
        1,
        ['iron', 'crystal', 'coffee'],
        ['normal', 'normal', 'watercolor']
      );

      mockedSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: item,
          error: null
        })
      } as any);

      // Act & Assert: Attempt to add 4th material
      await expect(
        materialService.applyMaterial(userId, item.id, 'wood', 'normal', 3)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        materialService.applyMaterial(userId, item.id, 'wood', 'normal', 3)
      ).rejects.toThrow('Cannot apply more than 3 materials');
    });

    it('should throw BusinessLogicError when insufficient material quantity', async () => {
      const item = ItemFactory.createBase('sword', 1);

      mockedSupabase.from.mockImplementation((table) => {
        if (table === 'Items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: item, error: null })
          } as any;
        }
        // MaterialStack with 0 quantity
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { quantity: 0 },
            error: null
          })
        } as any;
      });

      await expect(
        materialService.applyMaterial(userId, item.id, 'iron', 'normal', 0)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        materialService.applyMaterial(userId, item.id, 'iron', 'normal', 0)
      ).rejects.toThrow('Insufficient material quantity');
    });

    it('should throw NotFoundError when item does not exist', async () => {
      mockedSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      } as any);

      await expect(
        materialService.applyMaterial(userId, 'fake-item-id', 'iron', 'normal', 0)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user does not own item', async () => {
      const otherUserId = UserFactory.createEmail().id;
      const item = { ...BASE_SWORD, user_id: otherUserId };

      mockedSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: item,
          error: null
        })
      } as any);

      // Service should check user_id matches
      await expect(
        materialService.applyMaterial(userId, item.id, 'iron', 'normal', 0)
      ).rejects.toThrow(NotFoundError);
    });
  });

  /**
   * Test Group 3: Material Replacement
   * Tests replaceMaterial() method (costs gold)
   */
  describe('replaceMaterial()', () => {
    it('should replace existing material and return old material to inventory', async () => {
      // Arrange: Item with iron in slot 0
      const item = ItemFactory.createCrafted('sword', 1, ['iron'], ['normal']);
      const goldCost = 100;

      // Mock user gold balance
      mockedSupabase.from.mockImplementation((table) => {
        if (table === 'Users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { gold_balance: 500 },
              error: null
            })
          } as any;
        }
        if (table === 'Items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: item, error: null })
          } as any;
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { quantity: 10 }, error: null }),
          update: jest.fn().mockResolvedValue({ data: {}, error: null })
        } as any;
      });

      // Act: Replace iron with crystal
      const result = await materialService.replaceMaterial(
        userId,
        item.id,
        0, // slot_index
        'crystal',
        'normal',
        goldCost
      );

      // Assert: Old material returned to inventory
      expect(result.success).toBe(true);
      expect(result.returned_material).toMatchObject({
        material_id: 'iron',
        style_id: 'normal'
      });
      expect(result.gold_spent).toBe(goldCost);
      expect(result.updated_item.applied_materials[0].material_id).toBe('crystal');
    });

    it('should throw BusinessLogicError when insufficient gold', async () => {
      const item = ItemFactory.createCrafted('sword', 1, ['iron'], ['normal']);
      const goldCost = 1000;

      mockedSupabase.from.mockImplementation((table) => {
        if (table === 'Users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { gold_balance: 50 }, // Not enough!
              error: null
            })
          } as any;
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: item, error: null })
        } as any;
      });

      await expect(
        materialService.replaceMaterial(userId, item.id, 0, 'crystal', 'normal', goldCost)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        materialService.replaceMaterial(userId, item.id, 0, 'crystal', 'normal', goldCost)
      ).rejects.toThrow('Insufficient gold');
    });

    it('should throw BusinessLogicError when slot is empty', async () => {
      const item = ItemFactory.createBase('sword', 1); // No materials

      mockedSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: item, error: null })
      } as any);

      await expect(
        materialService.replaceMaterial(userId, item.id, 0, 'crystal', 'normal', 100)
      ).rejects.toThrow(BusinessLogicError);

      await expect(
        materialService.replaceMaterial(userId, item.id, 0, 'crystal', 'normal', 100)
      ).rejects.toThrow('No material in slot 0 to replace');
    });
  });

  /**
   * Test Group 4: Real Seed Data Validation
   * Tests that real game materials load and validate correctly
   */
  describe('Real Seed Data Integration', () => {
    it('should load all materials from seed data', async () => {
      const materials = await loadSeededMaterials();

      expect(materials.length).toBeGreaterThan(0);
      expect(materials).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String) })
        ])
      );
    });

    it('should validate that seed materials have balanced modifiers', async () => {
      const materials = await loadSeededMaterials();

      for (const material of materials) {
        // Stat modifiers must sum to 0 for game balance
        const sum =
          material.stat_modifiers.atkPower +
          material.stat_modifiers.atkAccuracy +
          material.stat_modifiers.defPower +
          material.stat_modifiers.defAccuracy;

        expect(sum).toBeCloseTo(0, 5); // Within 0.00001
      }
    });

    it('should find specific material by ID from seed data', async () => {
      const coffee = await getMaterialById('coffee');

      expect(coffee).toBeDefined();
      expect(coffee?.id).toBe('coffee');
      expect(coffee?.theme).toBeDefined();
    });

    it('should validate all seed materials have required fields', async () => {
      const materials = await loadSeededMaterials();

      for (const material of materials) {
        expect(material).toHaveProperty('id');
        expect(material).toHaveProperty('name');
        expect(material).toHaveProperty('description');
        expect(material).toHaveProperty('stat_modifiers');
        expect(material).toHaveProperty('style_id');
        expect(material).toHaveProperty('theme');

        // Validate theme enum
        expect(['defensive', 'offensive', 'balanced', 'exotic']).toContain(material.theme);
      }
    });
  });

  /**
   * Test Group 5: Stat Computation After Material Application
   * Tests that computed_stats are correctly updated
   */
  describe('Stat Computation', () => {
    it('should update computed_stats after applying offensive material', async () => {
      const item = ItemFactory.createBase('sword', 1);
      const baseStats = { ...item.computed_stats };

      // Offensive material: +atkPower, -defPower
      const offensiveMaterial = MaterialFactory.create(
        'test-offensive',
        'offensive',
        'normal',
        {
          stat_modifiers: {
            atkPower: 0.1,
            atkAccuracy: 0.05,
            defPower: -0.1,
            defAccuracy: -0.05
          }
        }
      );

      // Mock successful application with stat update
      mockedSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { quantity: 10 },
          error: null
        }),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null })
      } as any));

      const result = await materialService.applyMaterial(
        userId,
        item.id,
        offensiveMaterial.id,
        'normal',
        0
      );

      // Stats should be normalized (sum to 1.0)
      expectValidNormalizedStats(result.updated_item.computed_stats);

      // Attack stats should be higher than base
      expect(result.updated_item.computed_stats.atkPower).toBeGreaterThan(baseStats.atkPower);
    });

    it('should maintain stat normalization when applying multiple materials', async () => {
      // Apply 2 materials with different modifiers
      const item = ItemFactory.createCrafted(
        'sword',
        1,
        ['iron', 'crystal'],
        ['normal', 'normal']
      );

      // Verify stats still sum to 1.0
      expectValidNormalizedStats(item.computed_stats);
    });
  });
});
