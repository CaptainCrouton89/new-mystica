/**
 * Loadout Factory for Test Data Generation
 *
 * Generates loadout test data including loadouts with slot assignments,
 * following the LoadoutService specification.
 */

import type { Database } from '../../src/types/database.types.js';
import type { LoadoutWithSlots, CreateLoadoutData, LoadoutSlotAssignments } from '../../src/types/repository.types.js';

// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

type LoadoutRow = Database['public']['Tables']['loadouts']['Row'];
type LoadoutSlotRow = Database['public']['Tables']['loadoutslots']['Row'];

/**
 * Factory for generating Loadout test data
 */
export class LoadoutFactory {
  /**
   * Create basic loadout record
   */
  static createLoadout(
    userId: string,
    name: string = 'Test Loadout',
    overrides?: Partial<LoadoutRow>
  ): LoadoutRow {
    const now = new Date().toISOString();

    return {
      id: generateUuid(),
      user_id: userId,
      name,
      is_active: false,
      created_at: now,
      updated_at: now,
      ...overrides
    };
  }

  /**
   * Create loadout with slot assignments
   */
  static createLoadoutWithSlots(
    userId: string,
    name: string = 'Test Loadout',
    slots?: Partial<LoadoutSlotAssignments>,
    loadoutOverrides?: Partial<LoadoutRow>
  ): LoadoutWithSlots {
    const loadout = this.createLoadout(userId, name, loadoutOverrides);

    return {
      ...loadout,
      slots: {
        weapon: slots?.weapon || null,
        offhand: slots?.offhand || null,
        head: slots?.head || null,
        armor: slots?.armor || null,
        feet: slots?.feet || null,
        accessory_1: slots?.accessory_1 || null,
        accessory_2: slots?.accessory_2 || null,
        pet: slots?.pet || null
      }
    };
  }

  /**
   * Create active loadout with all slots filled
   */
  static createActiveLoadoutWithFullSlots(userId: string, name: string = 'Active Loadout'): LoadoutWithSlots {
    const itemIds = {
      weapon: generateUuid(),
      offhand: generateUuid(),
      head: generateUuid(),
      armor: generateUuid(),
      feet: generateUuid(),
      accessory_1: generateUuid(),
      accessory_2: generateUuid(),
      pet: generateUuid()
    };

    return this.createLoadoutWithSlots(
      userId,
      name,
      itemIds,
      { is_active: true }
    );
  }

  /**
   * Create loadout with partial slots (some equipment)
   */
  static createPartialLoadout(
    userId: string,
    equippedSlots: Array<keyof LoadoutSlotAssignments>,
    name: string = 'Partial Loadout'
  ): LoadoutWithSlots {
    const slots: Partial<LoadoutSlotAssignments> = {};

    equippedSlots.forEach(slot => {
      slots[slot] = generateUuid();
    });

    return this.createLoadoutWithSlots(userId, name, slots);
  }

  /**
   * Create multiple loadouts for user
   */
  static createMultipleLoadouts(
    userId: string,
    count: number = 3,
    activeIndex?: number
  ): LoadoutWithSlots[] {
    const loadouts: LoadoutWithSlots[] = [];

    for (let i = 0; i < count; i++) {
      const isActive = activeIndex !== undefined && i === activeIndex;
      const loadout = this.createLoadoutWithSlots(
        userId,
        `Loadout ${i + 1}`,
        undefined,
        { is_active: isActive }
      );
      loadouts.push(loadout);
    }

    return loadouts;
  }

  /**
   * Create loadout data for creation requests
   */
  static createLoadoutData(
    userId: string,
    name: string = 'New Loadout',
    isActive: boolean = false
  ): CreateLoadoutData {
    return {
      user_id: userId,
      name,
      is_active: isActive
    };
  }

  /**
   * Create slot assignments object for testing
   */
  static createSlotAssignments(overrides?: Partial<LoadoutSlotAssignments>): LoadoutSlotAssignments {
    return {
      weapon: generateUuid(),
      offhand: generateUuid(),
      head: generateUuid(),
      armor: generateUuid(),
      feet: generateUuid(),
      accessory_1: generateUuid(),
      accessory_2: generateUuid(),
      pet: generateUuid(),
      ...overrides
    };
  }

  /**
   * Create empty slot assignments (all null)
   */
  static createEmptySlots(): LoadoutSlotAssignments {
    return {
      weapon: null,
      offhand: null,
      head: null,
      armor: null,
      feet: null,
      accessory_1: null,
      accessory_2: null,
      pet: null
    };
  }

  /**
   * Create loadout slot record for database
   */
  static createLoadoutSlot(
    loadoutId: string,
    slotName: string,
    itemId: string | null = null
  ): LoadoutSlotRow {
    return {
      loadout_id: loadoutId,
      slot_name: slotName,
      item_id: itemId
    };
  }

  /**
   * Create multiple loadout slots for a loadout
   */
  static createAllLoadoutSlots(
    loadoutId: string,
    slots: LoadoutSlotAssignments
  ): LoadoutSlotRow[] {
    const slotRows: LoadoutSlotRow[] = [];

    Object.entries(slots).forEach(([slotName, itemId]) => {
      slotRows.push(this.createLoadoutSlot(loadoutId, slotName, itemId));
    });

    return slotRows;
  }

  /**
   * Generate realistic loadout names for testing
   */
  static generateLoadoutNames(count: number = 5): string[] {
    const names = [
      'Combat Loadout',
      'PvP Build',
      'Tank Setup',
      'DPS Configuration',
      'Hybrid Build',
      'Boss Fight Gear',
      'Speed Run Setup',
      'Defensive Loadout',
      'Crit Build',
      'Balanced Setup'
    ];

    return names.slice(0, count);
  }

  /**
   * Create bulk equipment update response (for activation)
   */
  static createBulkEquipmentUpdate(slots?: Partial<LoadoutSlotAssignments>): LoadoutSlotAssignments {
    return {
      weapon: null,
      offhand: null,
      head: null,
      armor: null,
      feet: null,
      accessory_1: null,
      accessory_2: null,
      pet: null,
      ...slots
    };
  }
}