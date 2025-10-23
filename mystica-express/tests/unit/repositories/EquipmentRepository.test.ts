/**
 * EquipmentRepository Unit Tests
 *
 * Tests all equipment-related database operations including:
 * - Slot state queries
 * - Equip/unequip operations
 * - Stats aggregation
 * - Bulk operations
 * - Validation logic
 */

import { EquipmentRepository, EQUIPMENT_SLOT_NAMES, EquipmentSlotName } from '../../../src/repositories/EquipmentRepository.js';
import { ValidationError, NotFoundError, DatabaseError } from '../../../src/utils/errors.js';
import { createMockSupabaseClient } from '../../helpers/mockSupabase.js';

describe('EquipmentRepository', () => {
  let repository: EquipmentRepository;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new EquipmentRepository();
    // Override the client for testing
    (repository as any).client = mockClient;
  });

  describe('Constructor', () => {
    it('should extend BaseRepository with userequipment table', () => {
      expect((repository as any).tableName).toBe('userequipment');
    });

    it('should have correct equipment slot names', () => {
      expect(EQUIPMENT_SLOT_NAMES).toEqual([
        'weapon',
        'offhand',
        'head',
        'armor',
        'feet',
        'accessory_1',
        'accessory_2',
        'pet'
      ]);
    });
  });

  // ============================================================================
  // Slot State Queries
  // ============================================================================

  describe('findEquippedByUser', () => {
    const userId = 'user-123';

    it('should return complete equipment state for user', async () => {
      const mockEquipmentData = [
        {
          slot_name: 'weapon',
          equipped_at: '2025-01-21T10:00:00Z',
          items: {
            id: 'item-1',
            level: 5,
            is_styled: true,
            current_stats: { atkPower: 10, atkAccuracy: 8, defPower: 2, defAccuracy: 3 },
            generated_image_url: 'https://example.com/sword.png',
            itemtypes: {
              id: 'type-1',
              name: 'Iron Sword',
              category: 'weapon',
              base_stats_normalized: { atkPower: 8, atkAccuracy: 6, defPower: 1, defAccuracy: 2 },
              rarity: 'common'
            }
          }
        },
        {
          slot_name: 'armor',
          equipped_at: null,
          items: null
        }
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockEquipmentData,
            error: null
          })
        })
      });

      const result = await repository.findEquippedByUser(userId);

      expect(result).toHaveProperty('weapon');
      expect(result.weapon).toMatchObject({
        id: 'item-1',
        level: 5,
        is_styled: true,
        item_type: {
          name: 'Iron Sword',
          category: 'weapon',
          rarity: 'common'
        }
      });

      expect(result.armor).toBeNull();
      expect(result.offhand).toBeNull();
      expect(result.head).toBeNull();
      expect(result.feet).toBeNull();
      expect(result.accessory_1).toBeNull();
      expect(result.accessory_2).toBeNull();
      expect(result.pet).toBeNull();
    });

    it('should handle database errors', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed', code: 'DB_ERROR' }
          })
        })
      });

      await expect(repository.findEquippedByUser(userId)).rejects.toThrow(DatabaseError);
    });
  });

  describe('findItemInSlot', () => {
    const userId = 'user-123';

    it('should return item in specific slot', async () => {
      const mockItemData = {
        items: {
          id: 'item-1',
          level: 3,
          is_styled: false,
          current_stats: null,
          generated_image_url: null,
          itemtypes: {
            id: 'type-1',
            name: 'Leather Helmet',
            category: 'head',
            base_stats_normalized: { atkPower: 0, atkAccuracy: 0, defPower: 5, defAccuracy: 3 },
            rarity: 'common'
          }
        }
      };

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockItemData,
                error: null
              })
            })
          })
        })
      });

      const result = await repository.findItemInSlot(userId, 'head');

      expect(result).toMatchObject({
        id: 'item-1',
        level: 3,
        is_styled: false,
        item_type: {
          name: 'Leather Helmet',
          category: 'head'
        }
      });
    });

    it('should return null for empty slot', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      const result = await repository.findItemInSlot(userId, 'head');
      expect(result).toBeNull();
    });

    it('should throw ValidationError for invalid slot name', async () => {
      await expect(repository.findItemInSlot(userId, 'invalid_slot')).rejects.toThrow(ValidationError);
      await expect(repository.findItemInSlot(userId, 'invalid_slot')).rejects.toThrow('Invalid slot name');
    });
  });

  describe('isItemEquipped', () => {
    it('should return true if item is equipped', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: 1,
            error: null
          })
        })
      });

      const result = await repository.isItemEquipped('item-123');
      expect(result).toBe(true);
    });

    it('should return false if item is not equipped', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
      });

      const result = await repository.isItemEquipped('item-123');
      expect(result).toBe(false);
    });
  });

  describe('getEquippedSlotForItem', () => {
    it('should return slot name where item is equipped', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { slot_name: 'weapon' },
              error: null
            })
          })
        })
      });

      const result = await repository.getEquippedSlotForItem('item-123');
      expect(result).toBe('weapon');
    });

    it('should return null if item is not equipped', async () => {
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

      const result = await repository.getEquippedSlotForItem('item-123');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // RPC Operations
  // ============================================================================

  describe('equipItemAtomic', () => {
    it('should call RPC with correct parameters', async () => {
      mockClient.rpc.mockResolvedValue({ data: { success: true }, error: null });

      await repository.equipItemAtomic('user-123', 'item-456', 'weapon');

      expect(mockClient.rpc).toHaveBeenCalledWith('equip_item', {
        p_user_id: 'user-123',
        p_item_id: 'item-456',
        p_slot_name: 'weapon'
      });
    });

    it('should handle RPC errors', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed', code: 'RPC_ERROR' }
      });

      await expect(repository.equipItemAtomic('user-123', 'item-456', 'weapon'))
        .rejects.toThrow('RPC failed');
    });
  });

  describe('unequipItemAtomic', () => {
    it('should call RPC with correct parameters', async () => {
      mockClient.rpc.mockResolvedValue({ data: { success: true }, error: null });

      await repository.unequipItemAtomic('user-123', 'weapon');

      expect(mockClient.rpc).toHaveBeenCalledWith('unequip_item', {
        p_user_id: 'user-123',
        p_slot_name: 'weapon'
      });
    });
  });

  describe('getPlayerPowerLevel', () => {
    const userId = 'user-123';

    it('should return power level stats from view', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { atk: 25, def: 18, hp: 150, acc: 12 },
              error: null
            })
          })
        })
      });

      const result = await repository.getPlayerPowerLevel(userId);

      expect(result).toEqual({
        atk: 25,
        def: 18,
        hp: 150,
        acc: 12
      });
      expect(mockClient.from).toHaveBeenCalledWith('v_player_powerlevel');
    });

    it('should return null when player not found', async () => {
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

      const result = await repository.getPlayerPowerLevel(userId);
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection failed', code: 'DB_ERROR' }
            })
          })
        })
      });

      await expect(repository.getPlayerPowerLevel(userId)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getPlayerEquippedStats', () => {
    const userId = 'user-123';

    it('should return equipped stats from view', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { atk: 25, acc: 36, def: 15 },  // 36 / 2 = 18 each
              error: null
            })
          })
        })
      });

      const result = await repository.getPlayerEquippedStats(userId);

      expect(result).toEqual({
        atkPower: 25,
        atkAccuracy: 18,
        defPower: 15,
        defAccuracy: 18 // Uses acc for both attack and defense accuracy
      });
    });

    it('should return zero stats when no data found', async () => {
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

      const result = await repository.getPlayerEquippedStats(userId);

      expect(result).toEqual({
        atkPower: 0,
        atkAccuracy: 0,
        defPower: 0,
        defAccuracy: 0
      });
    });
  });

  // ============================================================================
  // Equip Operations
  // ============================================================================

  describe('equipItem', () => {
    const userId = 'user-123';
    const itemId = 'item-456';
    const slotName = 'weapon';

    beforeEach(() => {
      // Mock validateSlotCompatibility to return true
      jest.spyOn(repository, 'validateSlotCompatibility').mockResolvedValue(true);
    });

    it('should successfully equip item', async () => {
      // Mock item ownership verification
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: itemId, user_id: userId },
                  error: null
                })
              })
            })
          })
        })
        // Mock upsert operation
        .mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({
            error: null
          })
        });

      await repository.equipItem(userId, itemId, slotName);

      expect(repository.validateSlotCompatibility).toHaveBeenCalledWith(itemId, slotName);
    });

    it('should throw ValidationError for incompatible item', async () => {
      jest.spyOn(repository, 'validateSlotCompatibility').mockResolvedValue(false);

      await expect(repository.equipItem(userId, itemId, slotName)).rejects.toThrow(ValidationError);
      await expect(repository.equipItem(userId, itemId, slotName)).rejects.toThrow('category incompatible');
    });


    it('should handle database error during upsert', async () => {
      jest.spyOn(repository, 'validateSlotCompatibility').mockResolvedValue(true);

      // Mock item ownership check to pass
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: itemId, user_id: userId },
                  error: null
                })
              })
            })
          })
        })
        // Mock upsert to fail
        .mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({
            error: { message: 'Database constraint violation', code: 'DB_ERROR' }
          })
        });

      await expect(repository.equipItem(userId, itemId, slotName)).rejects.toThrow(DatabaseError);
    });

    it('should throw NotFoundError for non-owned item', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      await expect(repository.equipItem(userId, itemId, slotName)).rejects.toThrow(NotFoundError);
    });
  });

  describe('unequipSlot', () => {
    const userId = 'user-123';

    it('should successfully unequip slot', async () => {
      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null
            })
          })
        })
      });

      await repository.unequipSlot(userId, 'weapon');

      expect(mockClient.from).toHaveBeenCalledWith('userequipment');
    });

    it('should throw ValidationError for invalid slot name', async () => {
      await expect(repository.unequipSlot(userId, 'invalid_slot')).rejects.toThrow(ValidationError);
    });
  });

  describe('replaceSlot', () => {
    it('should call equipItem (which does upsert)', async () => {
      const spy = jest.spyOn(repository, 'equipItem').mockResolvedValue();

      await repository.replaceSlot('user-123', 'weapon', 'item-456');

      expect(spy).toHaveBeenCalledWith('user-123', 'item-456', 'weapon');
    });
  });

  // ============================================================================
  // Stats Aggregation
  // ============================================================================

  describe('computeTotalStats', () => {
    const userId = 'user-123';

    it('should use database view when available', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                atk: 25,
                def: 15,
                acc: 30  // Combined accuracy (18 + 12)
              },
              error: null
            })
          })
        })
      });

      const result = await repository.computeTotalStats(userId);

      expect(result).toEqual({
        atkPower: 25,
        atkAccuracy: 15,  // 30 / 2 = 15
        defPower: 15,
        defAccuracy: 15   // 30 / 2 = 15
      });
    });

    it('should fallback to application code when view fails', async () => {
      // Mock view query to fail
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'View not found' }
              })
            })
          })
        });

      // Mock findEquippedByUser for fallback
      const mockEquipmentState = {
        weapon: {
          id: 'item-1',
          level: 5,
          is_styled: false,
          current_stats: { atkPower: 10, atkAccuracy: 8, defPower: 2, defAccuracy: 3 },
          generated_image_url: null,
          item_type: {
            id: 'type-1',
            name: 'Sword',
            category: 'weapon',
            base_stats_normalized: { atkPower: 8, atkAccuracy: 6, defPower: 1, defAccuracy: 2 },
            rarity: 'common' as const
          }
        },
        armor: {
          id: 'item-2',
          level: 3,
          is_styled: false,
          current_stats: null,
          generated_image_url: null,
          item_type: {
            id: 'type-2',
            name: 'Leather Armor',
            category: 'armor',
            base_stats_normalized: { atkPower: 0, atkAccuracy: 0, defPower: 8, defAccuracy: 5 },
            rarity: 'common' as const
          }
        },
        offhand: null,
        head: null,
        feet: null,
        accessory_1: null,
        accessory_2: null,
        pet: null
      };

      jest.spyOn(repository, 'findEquippedByUser').mockResolvedValue(mockEquipmentState);

      const result = await repository.computeTotalStats(userId);

      expect(result).toEqual({
        atkPower: 10, // 10 (current_stats for weapon) + 0 (base_stats for armor)
        atkAccuracy: 8, // 8 (current_stats for weapon) + 0 (base_stats for armor)
        defPower: 10, // 2 (current_stats for weapon) + 8 (base_stats for armor)
        defAccuracy: 8 // 3 (current_stats for weapon) + 5 (base_stats for armor)
      });
    });
  });

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  describe('equipMultiple', () => {
    const userId = 'user-123';
    const slotAssignments = {
      weapon: 'item-1',
      armor: 'item-2',
      head: null
    };

    beforeEach(() => {
      jest.spyOn(repository, 'validateSlotCompatibility').mockResolvedValue(true);
    });

    it('should successfully equip multiple items', async () => {
      mockClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          error: null
        })
      });

      await repository.equipMultiple(userId, slotAssignments);

      expect(repository.validateSlotCompatibility).toHaveBeenCalledTimes(2); // Only non-null items
      expect(mockClient.from).toHaveBeenCalledWith('userequipment');
    });

    it('should throw ValidationError for invalid slot name', async () => {
      const invalidAssignments = { invalid_slot: 'item-1' };

      await expect(repository.equipMultiple(userId, invalidAssignments as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for incompatible item', async () => {
      jest.spyOn(repository, 'validateSlotCompatibility').mockResolvedValue(false);

      await expect(repository.equipMultiple(userId, slotAssignments)).rejects.toThrow(ValidationError);
    });
  });

  describe('clearAllSlots', () => {
    it('should clear all equipment slots', async () => {
      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      await repository.clearAllSlots('user-123');

      expect(mockClient.from).toHaveBeenCalledWith('userequipment');
    });
  });

  // ============================================================================
  // Validation
  // ============================================================================

  describe('validateSlotCompatibility', () => {
    const itemId = 'item-123';

    it('should validate weapon in weapon slot', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                itemtypes: { category: 'weapon' }
              },
              error: null
            })
          })
        })
      });

      const result = await repository.validateSlotCompatibility(itemId, 'weapon');
      expect(result).toBe(true);
    });

    it('should validate weapon in offhand slot', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                itemtypes: { category: 'weapon' }
              },
              error: null
            })
          })
        })
      });

      const result = await repository.validateSlotCompatibility(itemId, 'offhand');
      expect(result).toBe(true);
    });

    it('should reject incompatible category', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                itemtypes: { category: 'weapon' }
              },
              error: null
            })
          })
        })
      });

      const result = await repository.validateSlotCompatibility(itemId, 'head');
      expect(result).toBe(false);
    });

    it('should throw ValidationError for invalid slot name', async () => {
      await expect(repository.validateSlotCompatibility(itemId, 'invalid_slot')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent item', async () => {
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

      await expect(repository.validateSlotCompatibility(itemId, 'weapon')).rejects.toThrow(NotFoundError);
    });

    it('should validate shield in offhand slot', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                itemtypes: { category: 'shield' }
              },
              error: null
            })
          })
        })
      });

      const result = await repository.validateSlotCompatibility(itemId, 'offhand');
      expect(result).toBe(true);
    });

    it('should validate accessory in both accessory slots', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                itemtypes: { category: 'ring' }
              },
              error: null
            })
          })
        })
      });

      const result1 = await repository.validateSlotCompatibility(itemId, 'accessory_1');
      const result2 = await repository.validateSlotCompatibility(itemId, 'accessory_2');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should throw NotFoundError when item has no itemtype', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { itemtypes: null },
              error: null
            })
          })
        })
      });

      await expect(repository.validateSlotCompatibility(itemId, 'weapon')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllSlotNames', () => {
    it('should return all slot names ordered by sort_order', async () => {
      const mockSlotData = [
        { slot_name: 'weapon' },
        { slot_name: 'offhand' },
        { slot_name: 'head' },
        { slot_name: 'armor' },
        { slot_name: 'feet' },
        { slot_name: 'accessory_1' },
        { slot_name: 'accessory_2' },
        { slot_name: 'pet' }
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockSlotData,
            error: null
          })
        })
      });

      const result = await repository.getAllSlotNames();

      expect(result).toEqual([
        'weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'
      ]);
    });
  });

  // ============================================================================
  // Helper Methods
  // ============================================================================

  describe('initializeUserSlots', () => {
    it('should create empty slots for new user', async () => {
      mockClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          error: null
        })
      });

      await repository.initializeUserSlots('user-123');

      expect(mockClient.from).toHaveBeenCalledWith('userequipment');
    });

    it('should handle database errors', async () => {
      mockClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          error: { message: 'Database error', code: 'DB_ERROR' }
        })
      });

      await expect(repository.initializeUserSlots('user-123')).rejects.toThrow(DatabaseError);
    });
  });
});

// ============================================================================
// Integration Test Helpers
// ============================================================================

describe('EquipmentRepository Integration Scenarios', () => {
  let repository: EquipmentRepository;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new EquipmentRepository();
    (repository as any).client = mockClient;
  });

  describe('Complete Equip Flow', () => {
    it('should handle full equip -> query -> unequip scenario', async () => {
      const userId = 'user-123';
      const itemId = 'item-456';
      const slotName = 'weapon';

      // Mock validation to pass
      jest.spyOn(repository, 'validateSlotCompatibility').mockResolvedValue(true);

      // Mock item ownership check
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: itemId, user_id: userId },
                  error: null
                })
              })
            })
          })
        })
        // Mock equip upsert
        .mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null })
        })
        // Mock find item in slot
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    items: {
                      id: itemId,
                      level: 5,
                      is_styled: false,
                      current_stats: null,
                      generated_image_url: null,
                      itemtypes: {
                        id: 'type-1',
                        name: 'Test Sword',
                        category: 'weapon',
                        base_stats_normalized: { atkPower: 10, atkAccuracy: 8, defPower: 2, defAccuracy: 3 },
                        rarity: 'common'
                      }
                    }
                  },
                  error: null
                })
              })
            })
          })
        })
        // Mock unequip update
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          })
        });

      // 1. Equip item
      await repository.equipItem(userId, itemId, slotName);

      // 2. Verify item is equipped
      const equippedItem = await repository.findItemInSlot(userId, slotName);
      expect(equippedItem?.id).toBe(itemId);

      // 3. Unequip slot
      await repository.unequipSlot(userId, slotName);

      expect(mockClient.from).toHaveBeenCalledTimes(4);
    });
  });

  describe('Loadout Activation Flow', () => {
    it('should handle complete loadout switching', async () => {
      const userId = 'user-123';
      const loadoutAssignments = {
        weapon: 'item-1',
        armor: 'item-2',
        head: null,
        feet: 'item-3'
      };

      jest.spyOn(repository, 'validateSlotCompatibility').mockResolvedValue(true);

      mockClient.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null })
      });

      await repository.equipMultiple(userId, loadoutAssignments);

      expect(repository.validateSlotCompatibility).toHaveBeenCalledTimes(3); // Only non-null items
    });
  });
});