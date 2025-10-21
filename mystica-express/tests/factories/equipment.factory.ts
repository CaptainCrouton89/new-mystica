// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import type { Database } from '../../src/types/database.types.js';
import { ItemFactory, type PlayerItem } from './item.factory.js';

type UserEquipment = Database['public']['Tables']['userequipment']['Row'];
type UserEquipmentInsert = Database['public']['Tables']['userequipment']['Insert'];

/**
 * Stats interface for equipment testing
 */
interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

/**
 * Equipment slot names for the 8-slot system
 */
export const EQUIPMENT_SLOTS = [
  'weapon',
  'offhand',
  'head',
  'armor',
  'feet',
  'accessory_1',
  'accessory_2',
  'pet'
] as const;

export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];

/**
 * Factory for generating Equipment test data with flexible overrides
 */
export class EquipmentFactory {
  /**
   * Create equipped item record
   */
  static createEquippedItem(
    userId: string,
    itemId: string,
    slotName: EquipmentSlot,
    overrides?: Partial<UserEquipment>
  ): UserEquipment {
    const equippedItem: UserEquipment = {
      user_id: userId,
      slot_name: slotName,
      item_id: itemId,
      equipped_at: new Date().toISOString(),
      ...overrides
    };

    return equippedItem;
  }

  /**
   * Create player item suitable for equipping with specific category
   */
  static createPlayerItemForSlot(
    slotName: EquipmentSlot,
    userId: string,
    level: number = 1,
    overrides?: Partial<PlayerItem>
  ): PlayerItem {
    // Map slot to appropriate item type/category
    const category = this.mapSlotToCategory(slotName);

    return ItemFactory.createBase(category, level, {
      user_id: userId,
      ...overrides
    });
  }

  /**
   * Create full equipment set for user (all 8 slots)
   */
  static createFullEquipmentSet(userId: string, level: number = 1): {
    items: PlayerItem[];
    equipment: UserEquipment[];
  } {
    const items: PlayerItem[] = [];
    const equipment: UserEquipment[] = [];

    for (const slot of EQUIPMENT_SLOTS) {
      const item = this.createPlayerItemForSlot(slot, userId, level);
      const equippedRecord = this.createEquippedItem(userId, item.id, slot);

      items.push(item);
      equipment.push(equippedRecord);
    }

    return { items, equipment };
  }

  /**
   * Create partial equipment set (some slots filled)
   */
  static createPartialEquipmentSet(
    userId: string,
    equippedSlots: EquipmentSlot[],
    level: number = 1
  ): {
    items: PlayerItem[];
    equipment: UserEquipment[];
  } {
    const items: PlayerItem[] = [];
    const equipment: UserEquipment[] = [];

    for (const slot of equippedSlots) {
      const item = this.createPlayerItemForSlot(slot, userId, level);
      const equippedRecord = this.createEquippedItem(userId, item.id, slot);

      items.push(item);
      equipment.push(equippedRecord);
    }

    return { items, equipment };
  }

  /**
   * Create equipment for database insertion (Insert type)
   */
  static createForInsert(overrides?: Partial<UserEquipmentInsert>): UserEquipmentInsert {
    const equipment = this.createEquippedItem('test-user', 'test-item', 'weapon');
    return {
      user_id: equipment.user_id,
      slot_name: equipment.slot_name,
      item_id: equipment.item_id,
      ...overrides
    };
  }

  /**
   * Create weapon item for equipping
   */
  static createWeaponItem(userId: string, weaponType: string = 'sword', level: number = 1): PlayerItem {
    return ItemFactory.createWeapon(weaponType, level, { user_id: userId });
  }

  /**
   * Create armor item for equipping
   */
  static createArmorItem(userId: string, armorType: string = 'offhand', level: number = 1): PlayerItem {
    return ItemFactory.createArmor(armorType, level, { user_id: userId });
  }

  /**
   * Create accessory item for equipping
   */
  static createAccessoryItem(userId: string, level: number = 1): PlayerItem {
    return ItemFactory.createBase('accessory', level, { user_id: userId });
  }

  /**
   * Create pet item for equipping
   */
  static createPetItem(userId: string, level: number = 1): PlayerItem {
    return ItemFactory.createBase('pet', level, { user_id: userId });
  }

  /**
   * Create item with stats that would benefit equipment total
   */
  static createHighStatsItem(
    userId: string,
    slotName: EquipmentSlot,
    statType: 'offensive' | 'defensive' | 'balanced' = 'balanced',
    level: number = 5
  ): PlayerItem {
    const category = this.mapSlotToCategory(slotName);

    let stats: Stats;
    switch (statType) {
      case 'offensive':
        stats = { atkPower: 0.5, atkAccuracy: 0.3, defPower: 0.1, defAccuracy: 0.1 };
        break;
      case 'defensive':
        stats = { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 };
        break;
      case 'balanced':
      default:
        stats = { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 };
        break;
    }

    return ItemFactory.withStats(stats, {
      user_id: userId,
      item_type_id: category,
      level: level
    });
  }

  /**
   * Map equipment slot to item category/type
   */
  private static mapSlotToCategory(slotName: EquipmentSlot): string {
    switch (slotName) {
      case 'weapon':
        return 'sword'; // Default weapon type
      case 'offhand':
        return 'offhand';
      case 'head':
        return 'helmet';
      case 'armor':
        return 'chestplate';
      case 'feet':
        return 'boots';
      case 'accessory_1':
      case 'accessory_2':
        return 'accessory';
      case 'pet':
        return 'pet';
      default:
        return 'sword';
    }
  }

  /**
   * Get valid equipment slot names for testing
   */
  static getValidSlots(): EquipmentSlot[] {
    return [...EQUIPMENT_SLOTS];
  }

  /**
   * Get equipment slots by category
   */
  static getSlotsByCategory(category: 'weapon' | 'armor' | 'accessory' | 'other'): EquipmentSlot[] {
    switch (category) {
      case 'weapon':
        return ['weapon', 'offhand'];
      case 'armor':
        return ['head', 'armor', 'feet'];
      case 'accessory':
        return ['accessory_1', 'accessory_2'];
      case 'other':
        return ['pet'];
      default:
        return [];
    }
  }
}