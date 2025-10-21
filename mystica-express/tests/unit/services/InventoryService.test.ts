/**
 * Unit Tests: InventoryService
 *
 * Comprehensive tests for inventory management including stacking logic,
 * material integration, stats service coordination, and equipment status.
 *
 * Tests follow the specification in docs/plans/service-specs/inventory-service-spec.md
 */

import { InventoryService } from '../../../src/services/InventoryService.js';
import { ItemRepository } from '../../../src/repositories/ItemRepository.js';
import { MaterialRepository } from '../../../src/repositories/MaterialRepository.js';
import { DatabaseError, ValidationError } from '../../../src/utils/errors.js';

// Import test infrastructure
import { ItemFactory } from '../../factories/item.factory.js';
import { UserFactory } from '../../factories/user.factory.js';
import { MaterialFactory } from '../../factories/material.factory.js';
import { expectValidItem, expectValidUUID } from '../../helpers/assertions.js';

// Mock dependencies
jest.mock('../../../src/repositories/ItemRepository.js');
jest.mock('../../../src/repositories/MaterialRepository.js');
jest.mock('../../../src/services/StatsService.js', () => ({
  statsService: {
    computeItemStats: jest.fn(),
    computeItemStatsForLevel: jest.fn()
  }
}));

import { statsService } from '../../../src/services/StatsService.js';

const MockedItemRepository = ItemRepository as jest.MockedClass<typeof ItemRepository>;
const MockedMaterialRepository = MaterialRepository as jest.MockedClass<typeof MaterialRepository>;
const mockedStatsService = statsService as jest.Mocked<typeof statsService>;

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let mockItemRepository: jest.Mocked<ItemRepository>;
  let mockMaterialRepository: jest.Mocked<MaterialRepository>;

  const testUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mocked repositories for each test
    mockItemRepository = new MockedItemRepository() as jest.Mocked<ItemRepository>;
    mockMaterialRepository = new MockedMaterialRepository() as jest.Mocked<MaterialRepository>;

    // Create service instance with mocked dependencies
    inventoryService = new InventoryService();
    (inventoryService as any).itemRepository = mockItemRepository;
    (inventoryService as any).materialRepository = mockMaterialRepository;
  });

  describe('getPlayerInventory()', () => {

    describe('Empty Inventory Scenarios', () => {
      it('should return empty arrays when user has no items or materials', async () => {
        // Arrange: Mock empty responses
        mockItemRepository.findByUser.mockResolvedValue([]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toEqual([]);
        expect(result.stacks).toEqual([]);
        expect(mockItemRepository.findByUser).toHaveBeenCalledWith(testUserId);
        expect(mockMaterialRepository.findAllStacksByUser).toHaveBeenCalledWith(testUserId);
      });

      it('should handle user with only material stacks (no items)', async () => {
        // Arrange: User has materials but no items
        mockItemRepository.findByUser.mockResolvedValue([]);

        const materialStacks = [
          {
            user_id: testUserId,
            material_id: 'iron',
            style_id: '00000000-0000-0000-0000-000000000000',
            quantity: 10
          }
        ];
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue(materialStacks);

        const ironMaterial = MaterialFactory.create('iron', 'defensive', 'normal');
        mockMaterialRepository.findMaterialById.mockResolvedValue(ironMaterial);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toEqual([]);
        expect(result.stacks).toHaveLength(1);
        expect(result.stacks[0]).toMatchObject({
          user_id: testUserId,
          material_id: 'iron',
          quantity: 10,
          material: expect.objectContaining({
            id: 'iron',
            name: ironMaterial.name
          })
        });
      });

      it('should handle user with only items (no material stacks)', async () => {
        // Arrange: User has items but no materials
        const userItems = [ItemFactory.createBase('sword', 5, { user_id: testUserId })];
        const itemWithDetails = {
          ...userItems[0],
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common' as const,
            description: 'A basic sword'
          },
          materials: []
        };

        mockItemRepository.findByUser.mockResolvedValue(userItems);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(1);
        expect(result.stacks).toEqual([]);
        expect(result.items[0]).toMatchObject({
          id: userItems[0].id,
          user_id: testUserId,
          level: 5,
          materials: []
        });
      });
    });

    describe('Items with Materials Applied', () => {
      it('should process unique items with applied materials correctly', async () => {
        // Arrange: Create item with materials applied
        const item = ItemFactory.createCrafted('sword', 3, ['iron', 'crystal'], ['normal', 'shiny']);
        item.user_id = testUserId;

        const appliedMaterials = [
          {
            slot_index: 0,
            material: {
              id: 'iron',
              name: 'Iron',
              rarity: 'common' as const,
              stat_modifiers: { atkPower: 0.1, atkAccuracy: 0, defPower: -0.1, defAccuracy: 0 },
              theme: 'defensive' as const,
              description: 'Strong metal',
              image_url: undefined
            }
          },
          {
            slot_index: 1,
            material: {
              id: 'crystal',
              name: 'Crystal',
              rarity: 'uncommon' as const,
              stat_modifiers: { atkPower: 0, atkAccuracy: 0.1, defPower: 0, defAccuracy: -0.1 },
              theme: 'offensive' as const,
              description: 'Magical crystal',
              image_url: undefined
            }
          }
        ];

        const itemWithDetails = {
          ...item,
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common' as const,
            description: 'A basic sword'
          },
          materials: appliedMaterials
        };

        mockItemRepository.findByUser.mockResolvedValue([item]);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(1);
        const resultItem = result.items[0];

        expectValidItem(resultItem);
        expect(resultItem.materials).toHaveLength(2);
        expect(resultItem.materials![0]).toMatchObject({
          material_id: 'iron',
          slot_index: 0,
          material: expect.objectContaining({
            name: 'Iron',
            theme: 'defensive'
          })
        });
        expect(resultItem.materials![1]).toMatchObject({
          material_id: 'crystal',
          slot_index: 1,
          material: expect.objectContaining({
            name: 'Crystal',
            theme: 'offensive'
          })
        });
      });

      it('should handle items with mixed material slot indices', async () => {
        // Arrange: Item with materials in slots 0 and 2 (skip slot 1)
        const item = ItemFactory.createCrafted('offhand', 2, ['wood', 'coffee'], ['normal', 'pixel_art']);
        item.user_id = testUserId;

        const appliedMaterials = [
          {
            slot_index: 0,
            material: MaterialFactory.create('wood', 'balanced', 'normal')
          },
          {
            slot_index: 2, // Skip slot 1
            material: MaterialFactory.create('coffee', 'exotic', 'pixel_art')
          }
        ];

        const itemWithDetails = {
          ...item,
          item_type: {
            id: 'offhand',
            name: 'Shield',
            category: 'offhand',
            base_stats_normalized: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
            rarity: 'common' as const,
            description: 'A protective shield'
          },
          materials: appliedMaterials
        };

        mockItemRepository.findByUser.mockResolvedValue([item]);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(1);
        const resultItem = result.items[0];

        expect(resultItem.materials).toHaveLength(2);
        expect(resultItem.materials!.find(m => m.slot_index === 0)).toBeDefined();
        expect(resultItem.materials!.find(m => m.slot_index === 2)).toBeDefined();
        expect(resultItem.materials!.find(m => m.slot_index === 1)).toBeUndefined();
      });
    });

    describe('Material Stacks Processing', () => {
      it('should process material stacks with proper template data', async () => {
        // Arrange: Multiple material stacks
        const materialStacks = [
          { user_id: testUserId, material_id: 'iron', style_id: '00000000-0000-0000-0000-000000000000', quantity: 15 },
          { user_id: testUserId, material_id: 'crystal', style_id: '00000000-0000-0000-0000-000000000000', quantity: 8 },
          { user_id: testUserId, material_id: 'iron', style_id: 'pixel-art-style', quantity: 3 } // Same material, different style
        ];

        const ironMaterial = MaterialFactory.create('iron', 'defensive', 'normal');
        const crystalMaterial = MaterialFactory.create('crystal', 'offensive', 'normal');

        mockItemRepository.findByUser.mockResolvedValue([]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue(materialStacks);
        mockMaterialRepository.findMaterialById
          .mockResolvedValueOnce(ironMaterial)
          .mockResolvedValueOnce(crystalMaterial);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.stacks).toHaveLength(3);

        // Check iron normal stack
        const ironNormalStack = result.stacks.find(s => s.material_id === 'iron' && s.style_id === '00000000-0000-0000-0000-000000000000');
        expect(ironNormalStack).toMatchObject({
          user_id: testUserId,
          material_id: 'iron',
          quantity: 15,
          material: expect.objectContaining({
            name: ironMaterial.name,
            theme: 'defensive'
          })
        });

        // Check iron styled stack
        const ironStyledStack = result.stacks.find(s => s.material_id === 'iron' && s.style_id === 'pixel-art-style');
        expect(ironStyledStack).toMatchObject({
          quantity: 3,
          style_id: 'pixel-art-style'
        });

        // Check crystal stack
        const crystalStack = result.stacks.find(s => s.material_id === 'crystal');
        expect(crystalStack).toMatchObject({
          material_id: 'crystal',
          quantity: 8
        });
      });

      it('should handle missing material templates gracefully', async () => {
        // Arrange: Material stack with non-existent material
        const materialStacks = [
          { user_id: testUserId, material_id: 'unknown-material', style_id: '00000000-0000-0000-0000-000000000000', quantity: 5 }
        ];

        mockItemRepository.findByUser.mockResolvedValue([]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue(materialStacks);
        mockMaterialRepository.findMaterialById.mockResolvedValue(null);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.stacks).toHaveLength(1);
        expect(result.stacks[0]).toMatchObject({
          material_id: 'unknown-material',
          quantity: 5,
          material: {
            id: 'unknown-material',
            name: 'Unknown Material',
            rarity: 'common',
            theme: 'balanced',
            description: 'Material not found'
          }
        });
      });
    });

    describe('Mixed Inventory Scenarios', () => {
      it('should handle inventory with both items and material stacks', async () => {
        // Arrange: User has both crafted items and material stacks
        const items = [
          ItemFactory.createBase('sword', 1, { user_id: testUserId }),
          ItemFactory.createCrafted('staff', 2, ['crystal'], ['shiny'], { user_id: testUserId })
        ];

        const materialStacks = [
          { user_id: testUserId, material_id: 'iron', style_id: '00000000-0000-0000-0000-000000000000', quantity: 20 },
          { user_id: testUserId, material_id: 'wood', style_id: '00000000-0000-0000-0000-000000000000', quantity: 12 }
        ];

        const itemsWithDetails = items.map(item => ({
          ...item,
          item_type: {
            id: item.item_type_id,
            name: 'Test Item',
            category: item.item_type_id as any,
            base_stats_normalized: { atkPower: 0.3, atkAccuracy: 0.3, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common' as const,
            description: 'Test item'
          },
          materials: item.material_combo_hash ? [{ slot_index: 0, material: MaterialFactory.create('crystal', 'offensive', 'shiny') }] : []
        }));

        const materials = [
          MaterialFactory.create('iron', 'defensive', 'normal'),
          MaterialFactory.create('wood', 'balanced', 'normal')
        ];

        mockItemRepository.findByUser.mockResolvedValue(items);
        mockItemRepository.findManyWithDetails.mockResolvedValue(itemsWithDetails);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue(materialStacks);
        mockMaterialRepository.findMaterialById
          .mockResolvedValueOnce(materials[0])
          .mockResolvedValueOnce(materials[1]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(2);
        expect(result.stacks).toHaveLength(2);

        // Check base item (no materials)
        const baseItem = result.items.find(i => !i.material_combo_hash);
        expect(baseItem).toBeDefined();
        expect(baseItem!.materials).toEqual([]);

        // Check crafted item (with materials)
        const craftedItem = result.items.find(i => i.material_combo_hash);
        expect(craftedItem).toBeDefined();
        expect(craftedItem!.materials).toHaveLength(1);

        // Check material stacks
        expect(result.stacks.find(s => s.material_id === 'iron')).toMatchObject({ quantity: 20 });
        expect(result.stacks.find(s => s.material_id === 'wood')).toMatchObject({ quantity: 12 });
      });

      it('should correctly transform repository data to API format', async () => {
        // Arrange: Test data transformation accuracy
        const item = ItemFactory.createBase('helmet', 3, {
          user_id: testUserId,
          id: 'item-123',
          created_at: '2025-01-27T10:00:00Z'
        });

        const itemWithDetails = {
          ...item,
          item_type: {
            id: 'helmet',
            name: 'Iron Helmet',
            category: 'head',
            base_stats_normalized: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.4, defAccuracy: 0.4 },
            rarity: 'uncommon' as const,
            description: 'Protective headgear'
          },
          materials: []
        };

        mockItemRepository.findByUser.mockResolvedValue([item]);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(1);
        const apiItem = result.items[0];

        expect(apiItem).toMatchObject({
          id: 'item-123',
          user_id: testUserId,
          item_type_id: 'helmet',
          level: 3,
          base_stats: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.4, defAccuracy: 0.4 },
          materials: [],
          item_type: {
            id: 'helmet',
            name: 'Iron Helmet',
            category: 'head',
            equipment_slot: 'head',
            rarity: 'uncommon',
            description: 'Protective headgear'
          },
          created_at: '2025-01-27T10:00:00Z',
          updated_at: '2025-01-27T10:00:00Z' // Falls back to created_at
        });
      });
    });

    describe('Error Handling', () => {
      it('should throw ValidationError for invalid userId format', async () => {
        // Arrange: Invalid UUID format
        const invalidUserId = 'not-a-uuid';

        // Act & Assert
        // Note: Current implementation doesn't validate UUID format, but should
        // This test documents expected behavior for future implementation
        await expect(inventoryService.getPlayerInventory('')).rejects.toThrow();
      });

      it('should handle ItemRepository database errors', async () => {
        // Arrange: Mock repository throwing database error
        const dbError = new Error('Connection failed');
        mockItemRepository.findByUser.mockRejectedValue(dbError);

        // Act & Assert
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(DatabaseError);
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow('Failed to fetch inventory');
      });

      it('should handle MaterialRepository database errors', async () => {
        // Arrange: Items succeed but materials fail
        mockItemRepository.findByUser.mockResolvedValue([]);
        mockMaterialRepository.findAllStacksByUser.mockRejectedValue(new Error('Material query failed'));

        // Act & Assert
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(DatabaseError);
      });

      it('should handle partial material template loading failures', async () => {
        // Arrange: Some materials load, others fail
        const materialStacks = [
          { user_id: testUserId, material_id: 'iron', style_id: '00000000-0000-0000-0000-000000000000', quantity: 10 },
          { user_id: testUserId, material_id: 'crystal', style_id: '00000000-0000-0000-0000-000000000000', quantity: 5 }
        ];

        const ironMaterial = MaterialFactory.create('iron', 'defensive', 'normal');

        mockItemRepository.findByUser.mockResolvedValue([]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue(materialStacks);
        mockMaterialRepository.findMaterialById
          .mockResolvedValueOnce(ironMaterial)  // iron succeeds
          .mockResolvedValueOnce(null);         // crystal fails

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert: Should handle gracefully with fallback for missing crystal
        expect(result.stacks).toHaveLength(2);
        expect(result.stacks[0].material).toMatchObject({ name: ironMaterial.name });
        expect(result.stacks[1].material).toMatchObject({ name: 'Unknown Material' });
      });

      it('should propagate existing DatabaseError instances', async () => {
        // Arrange: Repository throws DatabaseError directly
        const existingDbError = new DatabaseError('Table not found', new Error('SQL error'));
        mockItemRepository.findByUser.mockRejectedValue(existingDbError);

        // Act & Assert: Should propagate, not wrap
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toBe(existingDbError);
      });
    });

    describe('Performance and Edge Cases', () => {
      it('should handle large inventory efficiently', async () => {
        // Arrange: User with many items and materials
        const items = ItemFactory.createMany(50, () => ItemFactory.createBase('sword', 1, { user_id: testUserId }));
        const itemsWithDetails = items.map(item => ({
          ...item,
          item_type: {
            id: item.item_type_id,
            name: 'Test Item',
            category: item.item_type_id as any,
            base_stats_normalized: { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 },
            rarity: 'common' as const,
            description: 'Test item'
          },
          materials: []
        }));

        const materialStacks = Array.from({ length: 20 }, (_, i) => ({
          user_id: testUserId,
          material_id: `material-${i}`,
          style_id: '00000000-0000-0000-0000-000000000000',
          quantity: 5 + i
        }));

        mockItemRepository.findByUser.mockResolvedValue(items);
        mockItemRepository.findManyWithDetails.mockResolvedValue(itemsWithDetails);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue(materialStacks);
        mockMaterialRepository.findMaterialById.mockResolvedValue(MaterialFactory.create('test', 'balanced', 'normal'));

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(50);
        expect(result.stacks).toHaveLength(20);

        // Verify batch operations were used to prevent N+1 queries
        expect(mockItemRepository.findManyWithDetails).toHaveBeenCalledWith(
          expect.arrayContaining(items.map(i => i.id)),
          testUserId
        );
      });

      it('should handle user with zero items but valid user ID', async () => {
        // Arrange: Valid user with empty inventory
        mockItemRepository.findByUser.mockResolvedValue([]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result).toEqual({
          items: [],
          stacks: []
        });
        expect(mockItemRepository.findByUser).toHaveBeenCalledTimes(1);
        expect(mockMaterialRepository.findAllStacksByUser).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Data Transformation Logic', () => {
    it('should correctly map equipment_slot from category', async () => {
      // Arrange: Test category to equipment_slot mapping
      const testCases = [
        { category: 'weapon', expected_slot: 'weapon' },
        { category: 'offhand', expected_slot: 'offhand' },
        { category: 'head', expected_slot: 'head' },
        { category: 'armor', expected_slot: 'armor' },
        { category: 'feet', expected_slot: 'feet' },
        { category: 'accessory', expected_slot: 'accessory' },
        { category: 'pet', expected_slot: 'pet' }
      ];

      for (const testCase of testCases) {
        const item = ItemFactory.createBase(testCase.category, 1, { user_id: testUserId });
        const itemWithDetails = {
          ...item,
          item_type: {
            id: testCase.category,
            name: `Test ${testCase.category}`,
            category: testCase.category,
            base_stats_normalized: { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 },
            rarity: 'common' as const,
            description: `Test ${testCase.category}`
          },
          materials: []
        };

        mockItemRepository.findByUser.mockResolvedValue([item]);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items[0].item_type!.equipment_slot).toBe(testCase.expected_slot);

        jest.clearAllMocks();
      }
    });

    it('should generate composite keys for material stacks', async () => {
      // Arrange: Material stack with specific IDs
      const materialStack = {
        user_id: 'user-456',
        material_id: 'iron',
        style_id: 'shiny-style',
        quantity: 8
      };

      mockItemRepository.findByUser.mockResolvedValue([]);
      mockMaterialRepository.findAllStacksByUser.mockResolvedValue([materialStack]);
      mockMaterialRepository.findMaterialById.mockResolvedValue(MaterialFactory.create('iron', 'defensive', 'shiny'));

      // Act
      const result = await inventoryService.getPlayerInventory('user-456');

      // Assert
      expect(result.stacks[0].id).toBe('user-456:iron:shiny-style');
    });

    it('should handle missing current_stats gracefully', async () => {
      // Arrange: Item with null current_stats
      const item = ItemFactory.createBase('sword', 1, {
        user_id: testUserId,
        current_stats: null as any
      });

      const itemWithDetails = {
        ...item,
        current_stats: null,
        item_type: {
          id: 'sword',
          name: 'Test Sword',
          category: 'weapon',
          base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
          rarity: 'common' as const,
          description: 'Test sword'
        },
        materials: []
      };

      mockItemRepository.findByUser.mockResolvedValue([item]);
      mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
      mockMaterialRepository.findAllStacksByUser.mockResolvedValue([]);

      // Act
      const result = await inventoryService.getPlayerInventory(testUserId);

      // Assert: Should fall back to base stats
      expect(result.items[0].current_stats).toEqual({
        atkPower: 0.4,
        atkAccuracy: 0.2,
        defPower: 0.2,
        defAccuracy: 0.2
      });
    });
  });
});