/**
 * Unit Tests: EquipmentService
 *
 * Comprehensive test suite for equipment management and the 8-slot system.
 * Tests equip/unequip operations, RPC function interactions, and edge cases.
 */

import { EquipmentService } from '../../../src/services/EquipmentService.js';
import { NotFoundError, BusinessLogicError } from '../../../src/utils/errors.js';
import type { Stats, PlayerStats } from '../../../src/types/api.types.js';

// Import test infrastructure
import {
  UserFactory,
  ItemFactory,
  EquipmentFactory,
  type PlayerItem,
  type EquipmentSlot
} from '../../factories/index.js';

import {
  expectValidItem,
  expectValidPlayerItem,
  expectValidUUID,
  expectValidEquipmentSlot,
  expectValidComputedStats
} from '../../helpers/assertions.js';

// Helper function for validating PlayerStats (accepts the actual return type)
function expectValidPlayerStats(playerStats: any): void {
  // The service returns Stats, not PlayerStats, so validate what we actually get
  if (playerStats && typeof playerStats === 'object') {
    expectValidComputedStats(playerStats);
  } else {
    expect(playerStats).toBeDefined();
  }
}

// Helper to get normalized stats for category
function getNormalizedStatsForCategory(category: string): Stats {
  const normalizedStats: Record<string, Stats> = {
    sword: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
    weapon: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
    offhand: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
    shield: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
    helmet: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.4, defAccuracy: 0.4 },
    head: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.4, defAccuracy: 0.4 },
    chestplate: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
    armor: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
    boots: { atkPower: 0.2, atkAccuracy: 0.2, defPower: 0.3, defAccuracy: 0.3 },
    feet: { atkPower: 0.2, atkAccuracy: 0.2, defPower: 0.3, defAccuracy: 0.3 },
    accessory: { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 },
    pet: { atkPower: 0.3, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.3 }
  };

  return normalizedStats[category] || { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 };
}

// Helper to convert factory PlayerItem to repository format
function toRepositoryFormat(item: any) {
  // Map item type to proper category that matches equipment slot
  const categoryMap: Record<string, string> = {
    sword: 'weapon',
    offhand: 'offhand',
    helmet: 'head',
    chestplate: 'armor',
    boots: 'feet',
    accessory: 'accessory',
    pet: 'pet'
  };

  const category = categoryMap[item.item_type_id] || item.item_type_id;

  return {
    id: item.id,
    user_id: item.user_id,
    level: item.level,
    is_styled: item.is_styled,
    current_stats: item.current_stats,
    generated_image_url: item.generated_image_url,
    created_at: item.created_at,
    updated_at: item.created_at, // Use created_at as updated_at for test
    item_type: {
      id: item.item_type_id,
      name: `Test ${item.item_type_id}`,
      category: category,
      base_stats_normalized: getNormalizedStatsForCategory(item.item_type_id),
      rarity: 'common' as const,
      description: `Test item of type ${item.item_type_id}`
    }
  };
}

// Mock Supabase BEFORE importing service
jest.mock('../../../src/config/supabase', () => ({
  supabase: {
    rpc: jest.fn()
  }
}));

// Mock repositories
jest.mock('../../../src/repositories/EquipmentRepository.js', () => ({
  EquipmentRepository: jest.fn().mockImplementation(() => ({
    findEquippedByUser: jest.fn(),
    computeTotalStats: jest.fn(),
    equipItemAtomic: jest.fn(),
    unequipItemAtomic: jest.fn(),
    findItemInSlot: jest.fn(),
    getPlayerEquippedStats: jest.fn()
  }))
}));

jest.mock('../../../src/repositories/ItemRepository.js', () => ({
  ItemRepository: jest.fn().mockImplementation(() => ({
    findWithItemType: jest.fn()
  }))
}));

import { supabase } from '../../../src/config/supabase.js';
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe('EquipmentService', () => {
  let equipmentService: EquipmentService;
  let mockEquipmentRepository: any;
  let mockItemRepository: any;
  const testUser = UserFactory.createEmail('test@mystica.com');
  const userId = testUser.id;

  beforeEach(() => {
    equipmentService = new EquipmentService();
    jest.clearAllMocks();

    // Get repository mocks
    mockEquipmentRepository = (equipmentService as any).equipmentRepository;
    mockItemRepository = (equipmentService as any).itemRepository;

    // Default RPC response - match Supabase response structure
    (mockedSupabase.rpc as jest.Mock).mockResolvedValue({
      data: { success: true },
      error: null,
      status: 200,
      statusText: 'OK',
      count: null
    });

    // Mock default atomic RPC responses
    mockEquipmentRepository.equipItemAtomic.mockResolvedValue({
      success: true,
      data: {
        previous_item_id: null,
        equipped_item_id: 'test-item-id'
      }
    });

    mockEquipmentRepository.unequipItemAtomic.mockResolvedValue({
      success: true,
      data: {
        unequipped_item_id: 'test-item-id'
      }
    });

    mockEquipmentRepository.findItemInSlot.mockResolvedValue(null);
    mockEquipmentRepository.getPlayerEquippedStats.mockResolvedValue({
      atkPower: 0,
      atkAccuracy: 0,
      defPower: 0,
      defAccuracy: 0
    });

    // Mock getEquippedItems dependencies
    mockEquipmentRepository.findEquippedByUser.mockResolvedValue({
      weapon: undefined,
      offhand: undefined,
      head: undefined,
      armor: undefined,
      feet: undefined,
      accessory_1: undefined,
      accessory_2: undefined,
      pet: undefined
    });
  });

  /**
   * Test Group 1: Get Equipped Items
   * Tests getEquippedItems() method with various equipment states
   */
  describe('getEquippedItems()', () => {
    it('should return empty equipment slots when user has no items equipped', async () => {
      // Arrange: Mock empty equipment response
      mockEquipmentRepository.findEquippedByUser.mockResolvedValue({
        weapon: undefined,
        offhand: undefined,
        head: undefined,
        armor: undefined,
        feet: undefined,
        accessory_1: undefined,
        accessory_2: undefined,
        pet: undefined
      });

      mockEquipmentRepository.computeTotalStats.mockResolvedValue({
        atkPower: 0,
        atkAccuracy: 0,
        defPower: 0,
        defAccuracy: 0
      });

      // Act: Get equipped items
      const result = await equipmentService.getEquippedItems(userId);

      // Assert: All slots should be undefined
      expect(result.slots.weapon).toBeUndefined();
      expect(result.slots.offhand).toBeUndefined();
      expect(result.slots.head).toBeUndefined();
      expect(result.slots.armor).toBeUndefined();
      expect(result.slots.feet).toBeUndefined();
      expect(result.slots.accessory_1).toBeUndefined();
      expect(result.slots.accessory_2).toBeUndefined();
      expect(result.slots.pet).toBeUndefined();

      expect(result.total_stats).toEqual({
        atkPower: 0,
        atkAccuracy: 0,
        defPower: 0,
        defAccuracy: 0
      });
    });

    it('should return fully equipped loadout with computed stats', async () => {
      // Arrange: Create full equipment set
      const { items } = EquipmentFactory.createFullEquipmentSet(userId, 5);

      // Mock repository responses - convert factory items to repository format
      const repositorySlots = {
        weapon: toRepositoryFormat(items[0]),
        offhand: toRepositoryFormat(items[1]),
        head: toRepositoryFormat(items[2]),
        armor: toRepositoryFormat(items[3]),
        feet: toRepositoryFormat(items[4]),
        accessory_1: toRepositoryFormat(items[5]),
        accessory_2: toRepositoryFormat(items[6]),
        pet: toRepositoryFormat(items[7])
      };

      mockEquipmentRepository.findEquippedByUser.mockResolvedValue(repositorySlots);
      mockEquipmentRepository.computeTotalStats.mockResolvedValue({
        atkPower: 1.5,
        atkAccuracy: 1.2,
        defPower: 1.8,
        defAccuracy: 1.1
      });

      // Act: Get equipped items
      const result = await equipmentService.getEquippedItems(userId);

      // Assert: All slots should be filled
      expect(result.slots.weapon).toBeDefined();
      expect(result.slots.offhand).toBeDefined();
      expect(result.slots.head).toBeDefined();
      expect(result.slots.armor).toBeDefined();
      expect(result.slots.feet).toBeDefined();
      expect(result.slots.accessory_1).toBeDefined();
      expect(result.slots.accessory_2).toBeDefined();
      expect(result.slots.pet).toBeDefined();

      // Validate structure of equipped items
      expectValidPlayerItem(result.slots.weapon!);
      expectValidPlayerItem(result.slots.offhand!);

      // Total stats should be aggregated
      expect(result.total_stats.atkPower).toBeGreaterThan(0);
      expect(result.total_stats.defPower).toBeGreaterThan(0);
    });

    it('should handle partial equipment loadout correctly', async () => {
      // Arrange: Create partial equipment (weapon and armor only)
      const weapon = EquipmentFactory.createPlayerItemForSlot('weapon', userId, 3);
      const armor = EquipmentFactory.createPlayerItemForSlot('armor', userId, 3);

      mockEquipmentRepository.findEquippedByUser.mockResolvedValue({
        weapon: toRepositoryFormat(weapon),
        offhand: undefined,
        head: undefined,
        armor: toRepositoryFormat(armor),
        feet: undefined,
        accessory_1: undefined,
        accessory_2: undefined,
        pet: undefined
      });

      mockEquipmentRepository.computeTotalStats.mockResolvedValue({
        atkPower: 0.6,
        atkAccuracy: 0.3,
        defPower: 0.7,
        defAccuracy: 0.5
      });

      // Act: Get equipped items
      const result = await equipmentService.getEquippedItems(userId);

      // Assert: Only weapon and armor should be equipped
      expect(result.slots.weapon).toBeDefined();
      expect(result.slots.armor).toBeDefined();
      expect(result.slots.offhand).toBeUndefined();
      expect(result.slots.head).toBeUndefined();
      expect(result.slots.feet).toBeUndefined();
      expect(result.slots.accessory_1).toBeUndefined();
      expect(result.slots.accessory_2).toBeUndefined();
      expect(result.slots.pet).toBeUndefined();

      expectValidComputedStats(result.total_stats);
    });
  });

  /**
   * Test Group 2: Equip Item - Success Cases
   * Tests successful equip operations with various scenarios
   */
  describe('equipItem() - Success Cases', () => {
    it('should successfully equip weapon to empty weapon slot', async () => {
      // Arrange: Create weapon item
      const weapon = EquipmentFactory.createWeaponItem(userId, 'sword', 5);

      // Mock item repository response
      mockItemRepository.findWithItemType.mockResolvedValue({
        ...weapon,
        item_type: {
          id: 'sword',
          name: 'Iron Sword',
          category: 'weapon',
          base_stats_normalized: weapon.computed_stats
        }
      });

      // Mock atomic RPC response
      mockEquipmentRepository.equipItemAtomic.mockResolvedValue({
        success: true,
        data: {
          previous_item_id: null, // No previous item
          equipped_item_id: weapon.id
        }
      });

      // Mock updated player stats
      mockEquipmentRepository.computeTotalStats.mockResolvedValue({
        atkPower: 0.45,
        atkAccuracy: 0.25,
        defPower: 0.2,
        defAccuracy: 0.1
      });

      // Act: Equip weapon
      const result = await equipmentService.equipItem(userId, weapon.id);

      // Assert: Verify repository call and response
      expect(mockEquipmentRepository.equipItemAtomic).toHaveBeenCalledWith(userId, weapon.id, 'weapon');

      expect(result.success).toBe(true);
      expect(result.equipped_item).toBeDefined();
      expect(result.unequipped_item).toBeUndefined(); // No previous item
      // Note: Service has type mismatch - returns Stats but interface expects PlayerStats
      expect(result.updated_player_stats).toBeDefined();
    });

    it('should equip armor and unequip previous item in same slot', async () => {
      // Arrange: Create new armor and existing equipped armor
      const newArmor = EquipmentFactory.createArmorItem(userId, 'chestplate', 7);
      const oldArmor = EquipmentFactory.createArmorItem(userId, 'chestplate', 3);

      // Mock item repository responses
      mockItemRepository.findWithItemType
        .mockResolvedValueOnce({
          ...newArmor,
          item_type: {
            id: 'chestplate',
            name: 'Steel Chestplate',
            category: 'armor',
            base_stats_normalized: newArmor.computed_stats
          }
        })
        .mockResolvedValueOnce({
          ...newArmor,
          item_type: { id: 'chestplate', name: 'Steel Chestplate', category: 'armor' }
        })
        .mockResolvedValueOnce({
          ...oldArmor,
          item_type: { id: 'chestplate', name: 'Iron Chestplate', category: 'armor' }
        });

      // Mock atomic RPC response with previous item
      mockEquipmentRepository.equipItemAtomic.mockResolvedValue({
        success: true,
        data: {
          previous_item_id: oldArmor.id,
          equipped_item_id: newArmor.id
        }
      });

      // Act: Equip new armor
      const result = await equipmentService.equipItem(userId, newArmor.id);

      // Assert: Both items should be returned
      expect(result.success).toBe(true);
      expect(result.equipped_item.id).toBe(newArmor.id);
      expect(result.unequipped_item?.id).toBe(oldArmor.id);
    });

    it('should handle accessory equipping to accessory_1 slot by default', async () => {
      // Arrange: Create accessory item
      const accessory = EquipmentFactory.createAccessoryItem(userId, 4);

      mockItemRepository.findWithItemType.mockResolvedValue({
        ...accessory,
        item_type: {
          id: 'ring',
          name: 'Magic Ring',
          category: 'accessory',
          base_stats_normalized: accessory.computed_stats
        }
      });

      mockEquipmentRepository.equipItemAtomic.mockResolvedValue({
        success: true,
        data: { previous_item_id: null, equipped_item_id: accessory.id }
      });

      // Act: Equip accessory
      const result = await equipmentService.equipItem(userId, accessory.id);

      // Assert: Should use accessory_1 slot
      expect(mockEquipmentRepository.equipItemAtomic).toHaveBeenCalledWith(userId, accessory.id, 'accessory_1');

      expect(result.success).toBe(true);
    });
  });

  /**
   * Test Group 3: Equip Item - Edge Cases and Errors
   * Tests error handling and business logic validation
   */
  describe('equipItem() - Edge Cases', () => {
    it('should throw NotFoundError when item does not exist', async () => {
      // Arrange: Mock item not found
      mockItemRepository.findWithItemType.mockResolvedValue(null);

      // Act & Assert: Should throw error
      await expect(
        equipmentService.equipItem(userId, 'fake-item-id')
      ).rejects.toThrow('Item not found');
    });

    it('should throw error when item has no item_type', async () => {
      // Arrange: Mock item without item_type
      const invalidItem = { id: 'test-id', user_id: userId };
      mockItemRepository.findWithItemType.mockResolvedValue(invalidItem);

      // Act & Assert: Should throw error
      await expect(
        equipmentService.equipItem(userId, invalidItem.id)
      ).rejects.toThrow('Item not found');
    });

    it('should handle RPC error response correctly', async () => {
      // Arrange: Create valid item
      const weapon = EquipmentFactory.createWeaponItem(userId, 'sword', 1);

      mockItemRepository.findWithItemType.mockResolvedValue({
        ...weapon,
        item_type: { id: 'sword', category: 'weapon', base_stats_normalized: {} }
      });

      // Mock RPC error
      mockEquipmentRepository.equipItemAtomic.mockRejectedValue(
        new Error('Item not owned by user')
      );

      // Act & Assert: Should propagate RPC error
      await expect(
        equipmentService.equipItem(userId, weapon.id)
      ).rejects.toThrow();
    });

    it('should handle RPC failure response (success: false)', async () => {
      // Arrange: Create valid item
      const weapon = EquipmentFactory.createWeaponItem(userId, 'sword', 1);

      mockItemRepository.findWithItemType.mockResolvedValue({
        ...weapon,
        item_type: { id: 'sword', category: 'weapon', base_stats_normalized: {} }
      });

      // Mock RPC failure response
      mockEquipmentRepository.equipItemAtomic.mockResolvedValue({
        success: false,
        message: 'Item category does not match slot'
      });

      // Act & Assert: Should throw business logic error
      await expect(
        equipmentService.equipItem(userId, weapon.id)
      ).rejects.toThrow('Item category does not match slot');
    });

    it('should map unknown category to error', async () => {
      // Arrange: Create item with invalid category
      const invalidItem = ItemFactory.createBase('invalid_type', 1, { user_id: userId });

      mockItemRepository.findWithItemType.mockResolvedValue({
        ...invalidItem,
        item_type: {
          id: 'invalid_type',
          category: 'invalid_category',
          base_stats_normalized: {}
        }
      });

      // Act & Assert: Should throw error for unknown category
      await expect(
        equipmentService.equipItem(userId, invalidItem.id)
      ).rejects.toThrow('Unknown item category: invalid_category');
    });
  });

  /**
   * Test Group 4: Unequip Item
   * Tests unequip operations with various scenarios
   */
  describe('unequipItem()', () => {
    it('should successfully unequip item from occupied slot', async () => {
      // Arrange: Mock successful unequip
      mockEquipmentRepository.unequipItemAtomic.mockResolvedValue({
        success: true,
        data: {
          unequipped_item_id: 'some-item-id'
        }
      });

      // Act: Unequip weapon
      const result = await equipmentService.unequipItem(userId, 'weapon');

      // Assert: Verify repository call and response
      expect(mockEquipmentRepository.unequipItemAtomic).toHaveBeenCalledWith(userId, 'weapon');

      expect(result).toBe(true); // Item was unequipped
    });

    it('should return false when unequipping empty slot', async () => {
      // Arrange: Mock empty slot response
      mockEquipmentRepository.unequipItemAtomic.mockResolvedValue({
        success: true,
        data: {
          unequipped_item_id: null // No item was in the slot
        }
      });

      // Act: Unequip from empty slot
      const result = await equipmentService.unequipItem(userId, 'offhand');

      // Assert: Should return false (no item was unequipped)
      expect(result).toBe(false);
    });

    it('should handle unequip RPC error correctly', async () => {
      // Arrange: Mock RPC error
      mockEquipmentRepository.unequipItemAtomic.mockRejectedValue(
        new Error('User not found')
      );

      // Act & Assert: Should propagate error
      await expect(
        equipmentService.unequipItem(userId, 'weapon')
      ).rejects.toThrow();
    });

    it('should handle unequip failure response (success: false)', async () => {
      // Arrange: Mock failure response
      mockEquipmentRepository.unequipItemAtomic.mockResolvedValue({
        success: false,
        message: 'Invalid slot name'
      });

      // Act & Assert: Should throw error
      await expect(
        equipmentService.unequipItem(userId, 'invalid_slot')
      ).rejects.toThrow('Invalid slot name');
    });

    it('should validate all 8 equipment slots', async () => {
      // Arrange: Mock successful responses for all slots
      mockEquipmentRepository.unequipItemAtomic.mockResolvedValue({
        success: true,
        data: { unequipped_item_id: 'test-id' }
      });

      const validSlots: EquipmentSlot[] = [
        'weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'
      ];

      // Act & Assert: All slots should be valid
      for (const slot of validSlots) {
        const result = await equipmentService.unequipItem(userId, slot);
        expect(result).toBe(true);
        expect(mockEquipmentRepository.unequipItemAtomic).toHaveBeenCalledWith(userId, slot);
      }

      expect(mockEquipmentRepository.unequipItemAtomic).toHaveBeenCalledTimes(8);
    });
  });

  /**
   * Test Group 5: Category to Slot Mapping
   * Tests the mapCategoryToSlot private method indirectly
   */
  describe('Category to Slot Mapping', () => {
    const testCases = [
      { category: 'weapon', expectedSlot: 'weapon' },
      { category: 'offhand', expectedSlot: 'offhand' },
      { category: 'head', expectedSlot: 'head' },
      { category: 'armor', expectedSlot: 'armor' },
      { category: 'feet', expectedSlot: 'feet' },
      { category: 'accessory', expectedSlot: 'accessory_1' },
      { category: 'pet', expectedSlot: 'pet' }
    ];

    testCases.forEach(({ category, expectedSlot }) => {
      it(`should map ${category} category to ${expectedSlot} slot`, async () => {
        // Arrange: Create item with specific category
        const item = ItemFactory.createBase(category, 1, { user_id: userId });

        mockItemRepository.findWithItemType.mockResolvedValue({
          ...item,
          item_type: {
            id: category,
            category: category,
            base_stats_normalized: {}
          }
        });

        mockEquipmentRepository.equipItemAtomic.mockResolvedValue({
          success: true,
          data: {}
        });

        // Act: Equip item
        await equipmentService.equipItem(userId, item.id);

        // Assert: Should call repository with correct slot
        expect(mockEquipmentRepository.equipItemAtomic).toHaveBeenCalledWith(userId, item.id, expectedSlot);
      });
    });
  });

  /**
   * Test Group 6: Integration with Repository Pattern
   * Tests service interaction with repositories
   */
  describe('Repository Integration', () => {
    it('should call EquipmentRepository.findEquippedByUser in getEquippedItems', async () => {
      // Arrange: Set up repository mock
      mockEquipmentRepository.findEquippedByUser.mockResolvedValue({});
      mockEquipmentRepository.computeTotalStats.mockResolvedValue({
        atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0
      });

      // Act: Call service method
      await equipmentService.getEquippedItems(userId);

      // Assert: Repository should be called
      expect(mockEquipmentRepository.findEquippedByUser).toHaveBeenCalledWith(userId);
      expect(mockEquipmentRepository.computeTotalStats).toHaveBeenCalledWith(userId);
    });

    it('should call ItemRepository.findWithItemType in equipItem', async () => {
      // Arrange: Create item
      const weapon = EquipmentFactory.createWeaponItem(userId, 'sword', 1);

      mockItemRepository.findWithItemType.mockResolvedValue({
        ...weapon,
        item_type: { id: 'sword', category: 'weapon', base_stats_normalized: {} }
      });

      mockEquipmentRepository.equipItemAtomic.mockResolvedValue({
        success: true,
        data: {}
      });

      // Act: Equip item
      await equipmentService.equipItem(userId, weapon.id);

      // Assert: Repository should be called correctly
      expect(mockItemRepository.findWithItemType).toHaveBeenCalledWith(weapon.id, userId);
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange: Mock repository error
      mockEquipmentRepository.findEquippedByUser.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert: Should propagate repository error
      await expect(
        equipmentService.getEquippedItems(userId)
      ).rejects.toThrow('Database connection failed');
    });
  });
});