/**
 * Unit Tests: InventoryService
 *
 * Tests inventory retrieval where ALL items are treated as unique individuals
 * and returned with their generated_image_url (or fallback to default)
 */

import { InventoryService } from '../../../src/services/InventoryService.js';
import { ValidationError, DatabaseError } from '../../../src/utils/errors.js';
import type { ItemWithDetails } from '../../../src/types/repository.types.js';
import type { Material } from '../../../src/types/api.types.js';

// Mock dependencies BEFORE importing service
jest.mock('../../../src/repositories/ItemRepository.js', () => ({
  ItemRepository: jest.fn().mockImplementation(() => ({
    findByUser: jest.fn(),
    findManyWithDetails: jest.fn(),
    findEquippedByUser: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/MaterialRepository.js', () => ({
  MaterialRepository: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../../../src/services/StatsService.js', () => ({
  statsService: {
    computeItemStats: jest.fn(),
    computeItemStatsForLevel: jest.fn()
  }
}));

import { statsService } from '../../../src/services/StatsService.js';

const mockedStatsService = statsService as jest.Mocked<typeof statsService>;

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let mockItemRepository: any;

  const testUserId = 'user-123';

  beforeEach(() => {
    inventoryService = new InventoryService();
    jest.clearAllMocks();

    // Get repository mocks
    mockItemRepository = (inventoryService as any).itemRepository;
  });

  describe('getPlayerInventory()', () => {
    describe('Empty Inventory Scenarios', () => {
      it('should return empty items array when user has no items', async () => {
        // Arrange: Mock empty responses
        mockItemRepository.findByUser.mockResolvedValue([]);
        mockItemRepository.findEquippedByUser.mockResolvedValue([]);

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toEqual([]);
        expect(result).not.toHaveProperty('stacks'); // No stacks property in response
        expect(mockItemRepository.findByUser).toHaveBeenCalledWith(testUserId);
        expect(mockItemRepository.findManyWithDetails).not.toHaveBeenCalled();
      });

      it('should handle items without materials as individual items', async () => {
        // Arrange: User has items but no materials - should still appear as individual items
        const userItems = [{
          id: 'item-1',
          user_id: testUserId,
          item_type_id: 'sword',
          level: 5,
          is_styled: false,
          current_stats: { atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 },
          material_combo_hash: null,
          generated_image_url: 'https://example.com/sword.png',
          image_generation_status: 'complete' as const,
          created_at: '2025-01-21T10:00:00Z'
        }];

        const itemWithDetails: ItemWithDetails = {
          ...userItems[0],
          current_stats: { atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 },
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common',
            description: 'A basic sword'
          },
          materials: []
        };

        mockItemRepository.findByUser.mockResolvedValue(userItems);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockItemRepository.findEquippedByUser.mockResolvedValue([]);

        mockedStatsService.computeItemStats.mockReturnValue({
          atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3
        });

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert - ALL items now appear as individual items
        expect(result.items).toHaveLength(1);
        expect(result).not.toHaveProperty('stacks'); // No stacks property in response
        expect(result.items[0]).toMatchObject({
          id: 'item-1',
          item_type_id: 'sword',
          level: 5,
          generated_image_url: 'https://example.com/sword.png',
          applied_materials: [],
          rarity: 'common'
        });
      });
    });

    describe('Items with Materials Applied', () => {
      it('should process unique items with applied materials correctly', async () => {
        // Arrange: Create item with materials applied
        const item = {
          id: 'item-1',
          user_id: testUserId,
          item_type_id: 'sword',
          level: 3,
          is_styled: false,
          current_stats: { atkPower: 1.2, atkAccuracy: 0.9, defPower: 0.6, defAccuracy: 0.3 },
          material_combo_hash: 'abc123',
          generated_image_url: 'https://example.com/sword.png',
          image_generation_status: 'complete' as const,
          created_at: '2025-01-21T10:00:00Z'
        };

        const appliedMaterials = [
          {
            id: 'mat-instance-1',
            material_id: 'iron',
            style_id: 'normal',
            slot_index: 0,
            material: {
              id: 'iron',
              name: 'Iron',
              stat_modifiers: { atkPower: 0.1, atkAccuracy: 0, defPower: -0.1, defAccuracy: 0 },
              base_drop_weight: 1.0,
              description: 'Strong metal'
            }
          },
          {
            id: 'mat-instance-2',
            material_id: 'crystal',
            style_id: 'normal',
            slot_index: 1,
            material: {
              id: 'crystal',
              name: 'Crystal',
              stat_modifiers: { atkPower: 0, atkAccuracy: 0.1, defPower: 0, defAccuracy: -0.1 },
              base_drop_weight: 0.5,
              description: 'Magical crystal'
            }
          }
        ];

        const itemWithDetails: ItemWithDetails = {
          ...item,
          current_stats: { atkPower: 1.2, atkAccuracy: 0.9, defPower: 0.6, defAccuracy: 0.3 },
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common',
            description: 'A basic sword'
          },
          materials: appliedMaterials
        };

        mockItemRepository.findByUser.mockResolvedValue([item]);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockItemRepository.findEquippedByUser.mockResolvedValue([]);

        mockedStatsService.computeItemStats.mockReturnValue({
          atkPower: 1.3, atkAccuracy: 1.0, defPower: 0.5, defAccuracy: 0.2
        });

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(1);
        const resultItem = result.items[0];

        expect(resultItem.id).toBe('item-1');
        expect(resultItem.applied_materials).toHaveLength(2);
        expect(resultItem.materials).toHaveLength(2); // Compatibility field
        expect(resultItem.applied_materials[0]).toMatchObject({
          material_id: 'iron',
          slot_index: 0,
          material: expect.objectContaining({
            name: 'Iron'
          })
        });
        expect(resultItem.applied_materials[1]).toMatchObject({
          material_id: 'crystal',
          slot_index: 1,
          material: expect.objectContaining({
            name: 'Crystal'
          })
        });
      });

      it('should mark equipped items correctly', async () => {
        // Arrange: Item with equipped status
        const item = {
          id: 'item-1',
          user_id: testUserId,
          item_type_id: 'sword',
          level: 5,
          is_styled: false,
          current_stats: { atkPower: 1.5, atkAccuracy: 1.0, defPower: 0.7, defAccuracy: 0.4 },
          material_combo_hash: 'abc123',
          generated_image_url: 'https://example.com/sword.png',
          image_generation_status: 'complete' as const,
          created_at: '2025-01-21T10:00:00Z'
        };

        const itemWithDetails: ItemWithDetails = {
          ...item,
          current_stats: { atkPower: 1.5, atkAccuracy: 1.0, defPower: 0.7, defAccuracy: 0.4 },
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common',
            description: 'A basic sword'
          },
          materials: [{
            id: 'mat-1',
            material_id: 'iron',
            style_id: 'normal',
            slot_index: 0,
            material: {
              id: 'iron',
              name: 'Iron',
              stat_modifiers: { atkPower: 0.1, atkAccuracy: 0, defPower: -0.1, defAccuracy: 0 },
              base_drop_weight: 1.0,
              description: 'Strong metal'
            }
          }]
        };

        const equippedItems = [{
          id: 'item-1',
          user_id: testUserId,
          userequipment: { slot_name: 'weapon' }
        }];

        mockItemRepository.findByUser.mockResolvedValue([item]);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockItemRepository.findEquippedByUser.mockResolvedValue(equippedItems);

        mockedStatsService.computeItemStats.mockReturnValue({
          atkPower: 1.6, atkAccuracy: 1.0, defPower: 0.6, defAccuracy: 0.4
        });

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(1);
        expect(result.items[0].is_equipped).toBe(true);
        expect(result.items[0].equipped_slot).toBe('weapon');
      });
    });


    describe('Multiple Items Handling', () => {
      it('should return all items individually regardless of type and level', async () => {
        // Arrange: Multiple items of same type and level - now treated as individual items
        const userItems = [
          {
            id: 'item-1',
            user_id: testUserId,
            item_type_id: 'sword',
            level: 3,
            is_styled: false,
            current_stats: { atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 },
            material_combo_hash: null,
            generated_image_url: null,
            image_generation_status: null,
            created_at: '2025-01-21T10:00:00Z'
          },
          {
            id: 'item-2',
            user_id: testUserId,
            item_type_id: 'sword',
            level: 3,
            is_styled: false,
            current_stats: { atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 },
            material_combo_hash: null,
            generated_image_url: null,
            image_generation_status: null,
            created_at: '2025-01-21T11:00:00Z'
          },
          {
            id: 'item-3',
            user_id: testUserId,
            item_type_id: 'sword',
            level: 5,
            is_styled: false,
            current_stats: { atkPower: 1.5, atkAccuracy: 1.0, defPower: 0.7, defAccuracy: 0.4 },
            material_combo_hash: null,
            generated_image_url: null,
            image_generation_status: null,
            created_at: '2025-01-21T12:00:00Z'
          }
        ];

        const itemsWithDetails: ItemWithDetails[] = userItems.map(item => ({
          ...item,
          current_stats: item.current_stats,
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common',
            description: 'A basic sword'
          },
          materials: []
        }));

        mockItemRepository.findByUser.mockResolvedValue(userItems);
        mockItemRepository.findManyWithDetails.mockResolvedValue(itemsWithDetails);
        mockItemRepository.findEquippedByUser.mockResolvedValue([]);

        mockedStatsService.computeItemStats
          .mockReturnValueOnce({ atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 })
          .mockReturnValueOnce({ atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 })
          .mockReturnValueOnce({ atkPower: 1.5, atkAccuracy: 1.0, defPower: 0.7, defAccuracy: 0.4 });

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert - All items are now individual items in the items array
        expect(result.items).toHaveLength(3); // All 3 items appear individually
        expect(result).not.toHaveProperty('stacks'); // No stacks property in response

        // Check each item appears with its unique ID and generated image fallback
        const item1 = result.items.find(i => i.id === 'item-1');
        const item2 = result.items.find(i => i.id === 'item-2');
        const item3 = result.items.find(i => i.id === 'item-3');

        expect(item1).toBeDefined();
        expect(item2).toBeDefined();
        expect(item3).toBeDefined();

        // All should have default fallback images since generated_image_url is null
        expect(item1?.generated_image_url).toMatch(/default_weapon\.png$/);
        expect(item2?.generated_image_url).toMatch(/default_weapon\.png$/);
        expect(item3?.generated_image_url).toMatch(/default_weapon\.png$/);
      });
    });

    describe('Error Handling', () => {
      it('should throw ValidationError for invalid userId format', async () => {
        // Act & Assert
        await expect(inventoryService.getPlayerInventory('')).rejects.toThrow(ValidationError);
        await expect(inventoryService.getPlayerInventory('')).rejects.toThrow(/User ID is required/);
      });

      it('should throw ValidationError for null userId', async () => {
        // Act & Assert
        await expect(inventoryService.getPlayerInventory(null as any)).rejects.toThrow(ValidationError);
        await expect(inventoryService.getPlayerInventory(undefined as any)).rejects.toThrow(ValidationError);
      });

      it('should handle ItemRepository database errors', async () => {
        // Arrange: Mock repository throwing database error
        const dbError = new Error('Connection failed');
        mockItemRepository.findByUser.mockRejectedValue(dbError);

        // Act & Assert
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(DatabaseError);
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(/Failed to fetch inventory/);
      });

      it('should handle errors from findManyWithDetails', async () => {
        // Arrange: findByUser succeeds but findManyWithDetails fails
        const userItems = [{
          id: 'item-1',
          user_id: testUserId,
          item_type_id: 'sword',
          level: 1,
          is_styled: false,
          current_stats: { atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 },
          material_combo_hash: null,
          generated_image_url: null,
          image_generation_status: null,
          created_at: '2025-01-21T10:00:00Z'
        }];

        mockItemRepository.findByUser.mockResolvedValue(userItems);
        mockItemRepository.findManyWithDetails.mockRejectedValue(new Error('Database timeout'));

        // Act & Assert
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(DatabaseError);
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(/Failed to fetch inventory/);
      });

      it('should handle errors from findEquippedByUser', async () => {
        // Arrange: findByUser and findManyWithDetails succeed but findEquippedByUser fails
        const userItems = [{
          id: 'item-1',
          user_id: testUserId,
          item_type_id: 'sword',
          level: 1,
          is_styled: false,
          current_stats: { atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 },
          material_combo_hash: null,
          generated_image_url: null,
          image_generation_status: null,
          created_at: '2025-01-21T10:00:00Z'
        }];

        const itemWithDetails = {
          ...userItems[0],
          current_stats: { atkPower: 1.0, atkAccuracy: 0.8, defPower: 0.5, defAccuracy: 0.3 },
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common',
            description: 'A basic sword'
          },
          materials: []
        };

        mockItemRepository.findByUser.mockResolvedValue(userItems);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockItemRepository.findEquippedByUser.mockRejectedValue(new Error('Equipment query failed'));

        // Act & Assert
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(DatabaseError);
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toThrow(/Failed to fetch inventory/);
      });


      it('should propagate existing DatabaseError instances', async () => {
        // Arrange: Repository throws DatabaseError directly
        const existingDbError = new DatabaseError('Table not found', new Error('SQL error'));
        mockItemRepository.findByUser.mockRejectedValue(existingDbError);

        // Act & Assert: Should propagate, not wrap
        await expect(inventoryService.getPlayerInventory(testUserId)).rejects.toBe(existingDbError);
      });
    });

    describe('Mixed and Edge Cases', () => {
      it('should handle mixed item types correctly', async () => {
        // Arrange: Mix of items with and without materials - both treated as individual items now
        const userItems = [
          {
            id: 'item-1',
            user_id: testUserId,
            item_type_id: 'sword',
            level: 3,
            is_styled: false,
            current_stats: { atkPower: 1.2, atkAccuracy: 0.9, defPower: 0.6, defAccuracy: 0.3 },
            material_combo_hash: 'abc123', // Has materials
            generated_image_url: 'https://example.com/sword.png',
            image_generation_status: 'complete' as const,
            created_at: '2025-01-21T10:00:00Z'
          },
          {
            id: 'item-2',
            user_id: testUserId,
            item_type_id: 'dagger',
            level: 2,
            is_styled: false,
            computed_stats: { atkPower: 0.8, atkAccuracy: 1.0, defPower: 0.3, defAccuracy: 0.2 },
            material_combo_hash: null, // No materials
            generated_image_url: null,
            image_generation_status: null,
            created_at: '2025-01-21T11:00:00Z'
          }
        ];

        const itemsWithDetails = [
          {
            ...userItems[0],
            item_type: {
              id: 'sword',
              name: 'Iron Sword',
              category: 'weapon',
              base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
              rarity: 'common',
              description: 'A basic sword'
            },
            materials: [{
              id: 'mat-1',
              material_id: 'iron',
              style_id: 'normal',
              slot_index: 0,
              material: {
                id: 'iron',
                name: 'Iron',
                stat_modifiers: { atkPower: 0.1, atkAccuracy: 0, defPower: -0.1, defAccuracy: 0 },
                base_drop_weight: 1.0,
                description: 'Strong metal'
              }
            }]
          },
          {
            ...userItems[1],
            item_type: {
              id: 'dagger',
              name: 'Steel Dagger',
              category: 'weapon',
              base_stats_normalized: { atkPower: 0.3, atkAccuracy: 0.4, defPower: 0.1, defAccuracy: 0.2 },
              rarity: 'common',
              description: 'A quick blade'
            },
            materials: []
          }
        ];

        mockItemRepository.findByUser.mockResolvedValue(userItems);
        mockItemRepository.findManyWithDetails.mockResolvedValue(itemsWithDetails);
        mockItemRepository.findEquippedByUser.mockResolvedValue([]);

        mockedStatsService.computeItemStats
          .mockReturnValueOnce({
            atkPower: 1.3, atkAccuracy: 0.9, defPower: 0.5, defAccuracy: 0.3
          })
          .mockReturnValueOnce({
            atkPower: 0.8, atkAccuracy: 1.0, defPower: 0.3, defAccuracy: 0.2
          });

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert - Both items appear as individual items now
        expect(result.items).toHaveLength(2); // Both sword and dagger appear individually
        expect(result).not.toHaveProperty('stacks'); // No stacks property in response

        const swordItem = result.items.find(i => i.id === 'item-1');
        const daggerItem = result.items.find(i => i.id === 'item-2');

        expect(swordItem).toBeDefined();
        expect(swordItem?.applied_materials).toHaveLength(1);
        expect(swordItem?.generated_image_url).toBe('https://example.com/sword.png');

        expect(daggerItem).toBeDefined();
        expect(daggerItem?.applied_materials).toHaveLength(0);
        expect(daggerItem?.generated_image_url).toMatch(/default_weapon\.png$/); // Fallback image
      });

      it('should handle items with null generated_image_url correctly', async () => {
        // Arrange: Item with materials but no generated image
        const item = {
          id: 'item-1',
          user_id: testUserId,
          item_type_id: 'sword',
          level: 3,
          is_styled: false,
          current_stats: { atkPower: 1.2, atkAccuracy: 0.9, defPower: 0.6, defAccuracy: 0.3 },
          material_combo_hash: 'abc123',
          generated_image_url: null, // No generated image
          image_generation_status: 'pending' as const,
          created_at: '2025-01-21T10:00:00Z'
        };

        const itemWithDetails = {
          ...item,
          current_stats: item.current_stats, // Already present in item
          item_type: {
            id: 'sword',
            name: 'Iron Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
            rarity: 'common',
            description: 'A basic sword'
          },
          materials: [{
            id: 'mat-1',
            material_id: 'iron',
            style_id: 'normal',
            slot_index: 0,
            material: {
              id: 'iron',
              name: 'Iron',
              stat_modifiers: { atkPower: 0.1, atkAccuracy: 0, defPower: -0.1, defAccuracy: 0 },
              base_drop_weight: 1.0,
              description: 'Strong metal'
            }
          }]
        };

        mockItemRepository.findByUser.mockResolvedValue([item]);
        mockItemRepository.findManyWithDetails.mockResolvedValue([itemWithDetails]);
        mockItemRepository.findEquippedByUser.mockResolvedValue([]);

        mockedStatsService.computeItemStats.mockReturnValue({
          atkPower: 1.3, atkAccuracy: 1.0, defPower: 0.5, defAccuracy: 0.2
        });

        // Act
        const result = await inventoryService.getPlayerInventory(testUserId);

        // Assert
        expect(result.items).toHaveLength(1);
        const resultItem = result.items[0];
        expect(resultItem.generated_image_url).toBe('https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/default_weapon.png'); // Default image
      });
    });
  });
});
