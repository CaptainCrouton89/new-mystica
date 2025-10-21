/**
 * Equipment Repository - Managing UserEquipment operations
 *
 * Handles all equipment-related database operations including:
 * - Equipment slot state management (8 hardcoded slots)
 * - Equip/unequip operations with validation
 * - Stats aggregation from equipped items
 * - Bulk operations for loadout switching
 */

import { BaseRepository } from './BaseRepository.js';
import { DatabaseError, NotFoundError, ValidationError, mapSupabaseError } from '../utils/errors.js';
import { Stats } from '../types/api.types.js';
import { Database } from '../types/database.types.js';
import {
  EquipmentSlotAssignment,
  BulkEquipmentUpdate
} from '../types/repository.types.js';

// Type definitions
type UserEquipmentRow = Database['public']['Tables']['userequipment']['Row'];
type UserEquipmentInsert = Database['public']['Tables']['userequipment']['Insert'];
type EquipmentSlotRow = Database['public']['Tables']['equipmentslots']['Row'];
type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemTypeRow = Database['public']['Tables']['itemtypes']['Row'];

/**
 * Equipment slot names (8 hardcoded slots matching EquipmentSlots seed data)
 */
export const EQUIPMENT_SLOT_NAMES = [
  'weapon',
  'offhand',
  'head',
  'armor',
  'feet',
  'accessory_1',
  'accessory_2',
  'pet'
] as const;

export type EquipmentSlotName = typeof EQUIPMENT_SLOT_NAMES[number];

/**
 * Equipment slot with item details (for equipped state)
 */
export interface EquipmentSlotWithItem {
  slot_name: string;
  item: ItemWithBasicDetails | null;
  equipped_at: string | null;
}

/**
 * Item with basic details for equipment display
 */
export interface ItemWithBasicDetails {
  id: string;
  level: number;
  is_styled: boolean;
  current_stats: Stats | null;
  generated_image_url: string | null;
  item_type: {
    id: string;
    name: string;
    category: string;
    base_stats_normalized: Stats;
    rarity: Database['public']['Enums']['rarity'];
  };
}

/**
 * Full equipment state (all 8 slots)
 */
export interface EquipmentSlots {
  weapon: ItemWithBasicDetails | null;
  offhand: ItemWithBasicDetails | null;
  head: ItemWithBasicDetails | null;
  armor: ItemWithBasicDetails | null;
  feet: ItemWithBasicDetails | null;
  accessory_1: ItemWithBasicDetails | null;
  accessory_2: ItemWithBasicDetails | null;
  pet: ItemWithBasicDetails | null;
}

/**
 * Equipment Repository class for managing user equipment state
 *
 * Extends BaseRepository for common operations and adds equipment-specific methods.
 */
export class EquipmentRepository extends BaseRepository<UserEquipmentRow> {
  constructor() {
    super('userequipment');
  }

  // ============================================================================
  // Slot State Queries
  // ============================================================================

  /**
   * Get complete equipment state for a user (all 8 slots with items)
   *
   * @param userId - User ID
   * @returns Equipment slots with equipped items or null for empty slots
   * @throws DatabaseError on query failure
   */
  async findEquippedByUser(userId: string): Promise<EquipmentSlots> {
    // Query all equipment slots with LEFT JOIN to get equipped items
    const { data, error } = await this.client
      .from('userequipment')
      .select(`
        slot_name,
        equipped_at,
        items:item_id (
          id,
          level,
          is_styled,
          current_stats,
          generated_image_url,
          itemtypes:item_type_id (
            id,
            name,
            category,
            base_stats_normalized,
            rarity
          )
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw this.mapSupabaseError(error);
    }

    // Convert to EquipmentSlots format with guaranteed 8 slots
    const result: EquipmentSlots = {
      weapon: null,
      offhand: null,
      head: null,
      armor: null,
      feet: null,
      accessory_1: null,
      accessory_2: null,
      pet: null,
    };

    // Fill in equipped items
    for (const row of data || []) {
      const slotName = row.slot_name as EquipmentSlotName;
      if (row.items && EQUIPMENT_SLOT_NAMES.includes(slotName)) {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        if (item?.itemtypes) {
          const itemType = Array.isArray(item.itemtypes) ? item.itemtypes[0] : item.itemtypes;
          result[slotName] = {
            id: item.id,
            level: item.level,
            is_styled: item.is_styled,
            current_stats: item.current_stats as Stats | null,
            generated_image_url: item.generated_image_url,
            item_type: {
              id: itemType.id,
              name: itemType.name,
              category: itemType.category,
              base_stats_normalized: itemType.base_stats_normalized as Stats,
              rarity: itemType.rarity,
            }
          };
        }
      }
    }

    return result;
  }

  /**
   * Find item in specific equipment slot
   *
   * @param userId - User ID
   * @param slotName - Equipment slot name
   * @returns Item details or null if slot is empty
   * @throws ValidationError if slot name is invalid
   * @throws DatabaseError on query failure
   */
  async findItemInSlot(userId: string, slotName: string): Promise<ItemWithBasicDetails | null> {
    if (!EQUIPMENT_SLOT_NAMES.includes(slotName as EquipmentSlotName)) {
      throw new ValidationError(`Invalid slot name: ${slotName}. Must be one of: ${EQUIPMENT_SLOT_NAMES.join(', ')}`);
    }

    const { data, error } = await this.client
      .from('userequipment')
      .select(`
        items:item_id (
          id,
          level,
          is_styled,
          current_stats,
          generated_image_url,
          itemtypes:item_type_id (
            id,
            name,
            category,
            base_stats_normalized,
            rarity
          )
        )
      `)
      .eq('user_id', userId)
      .eq('slot_name', slotName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapSupabaseError(error);
    }

    if (!data.items) {
      return null;
    }

    const item = Array.isArray(data.items) ? data.items[0] : data.items;
    if (!item?.itemtypes) {
      return null;
    }

    const itemType = Array.isArray(item.itemtypes) ? item.itemtypes[0] : item.itemtypes;

    return {
      id: item.id,
      level: item.level,
      is_styled: item.is_styled,
      current_stats: item.current_stats as Stats | null,
      generated_image_url: item.generated_image_url,
      item_type: {
        id: itemType.id,
        name: itemType.name,
        category: itemType.category,
        base_stats_normalized: itemType.base_stats_normalized as Stats,
        rarity: itemType.rarity,
      }
    };
  }

  /**
   * Check if item is currently equipped by any user
   *
   * @param itemId - Item ID
   * @returns true if item is equipped, false otherwise
   * @throws DatabaseError on query failure
   */
  async isItemEquipped(itemId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from('userequipment')
      .select('item_id', { count: 'exact', head: true })
      .eq('item_id', itemId);

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return (count || 0) > 0;
  }

  /**
   * Get equipment slot name where item is equipped
   *
   * @param itemId - Item ID
   * @returns Slot name or null if item is not equipped
   * @throws DatabaseError on query failure
   */
  async getEquippedSlotForItem(itemId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('userequipment')
      .select('slot_name')
      .eq('item_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.mapSupabaseError(error);
    }

    return data.slot_name;
  }

  // ============================================================================
  // Power Level Operations
  // ============================================================================

  /**
   * Get player power level stats from v_player_powerlevel view
   *
   * @param userId - User ID
   * @returns Player power level stats or null if not found
   * @throws DatabaseError on query failure
   */
  async getPlayerPowerLevel(userId: string): Promise<{ atk: number; def: number; hp: number; acc: number } | null> {
    const { data, error } = await this.client
      .from('v_player_powerlevel')
      .select('atk, def, hp, acc')
      .eq('player_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null;
      }
      throw this.mapSupabaseError(error);
    }

    return {
      atk: Number(data.atk) || 0,
      def: Number(data.def) || 0,
      hp: Number(data.hp) || 0,
      acc: Number(data.acc) || 0,
    };
  }

  // ============================================================================
  // Atomic RPC Operations
  // ============================================================================

  /**
   * Equip item using atomic RPC function
   *
   * @param userId - User ID
   * @param itemId - Item ID to equip
   * @param slotName - Equipment slot name
   * @returns RPC response with success status and data
   * @throws DatabaseError on RPC failure
   */
  async equipItemAtomic(userId: string, itemId: string, slotName: string): Promise<any> {
    return await this.rpc('equip_item', {
      p_user_id: userId,
      p_item_id: itemId,
      p_slot_name: slotName
    });
  }

  /**
   * Unequip item using atomic RPC function
   *
   * @param userId - User ID
   * @param slotName - Equipment slot name
   * @returns RPC response with success status and data
   * @throws DatabaseError on RPC failure
   */
  async unequipItemAtomic(userId: string, slotName: string): Promise<any> {
    return await this.rpc('unequip_item', {
      p_user_id: userId,
      p_slot_name: slotName
    });
  }

  // ============================================================================
  // Equip Operations
  // ============================================================================

  /**
   * Equip item to specified slot
   *
   * Validates slot compatibility and performs upsert operation.
   * If slot is occupied, replaces existing item.
   *
   * @param userId - User ID
   * @param itemId - Item ID to equip
   * @param slotName - Equipment slot name
   * @throws ValidationError if slot-item category mismatch
   * @throws NotFoundError if item doesn't exist or not owned by user
   * @throws DatabaseError on operation failure
   */
  async equipItem(userId: string, itemId: string, slotName: string): Promise<void> {
    // Validate slot compatibility
    const isCompatible = await this.validateSlotCompatibility(itemId, slotName);
    if (!isCompatible) {
      throw new ValidationError(`Item category incompatible with slot ${slotName}`);
    }

    // Verify item ownership
    const { data: itemData, error: itemError } = await this.client
      .from('items')
      .select('id, user_id')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !itemData) {
      throw new NotFoundError('Item', itemId);
    }

    // Upsert equipment record (insert or update if slot exists)
    const { error: upsertError } = await this.client
      .from('userequipment')
      .upsert({
        user_id: userId,
        slot_name: slotName,
        item_id: itemId,
        equipped_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,slot_name'
      });

    if (upsertError) {
      throw this.mapSupabaseError(upsertError);
    }

    // Note: User stats (vanity_level, avg_item_level) will be updated by database triggers
  }

  /**
   * Unequip item from specified slot
   *
   * @param userId - User ID
   * @param slotName - Equipment slot name
   * @throws ValidationError if slot name is invalid
   * @throws DatabaseError on operation failure
   */
  async unequipSlot(userId: string, slotName: string): Promise<void> {
    if (!EQUIPMENT_SLOT_NAMES.includes(slotName as EquipmentSlotName)) {
      throw new ValidationError(`Invalid slot name: ${slotName}. Must be one of: ${EQUIPMENT_SLOT_NAMES.join(', ')}`);
    }

    // Update slot to have NULL item_id
    const { error } = await this.client
      .from('userequipment')
      .update({
        item_id: null,
        equipped_at: null,
      })
      .eq('user_id', userId)
      .eq('slot_name', slotName);

    if (error) {
      throw this.mapSupabaseError(error);
    }

    // Note: User stats will be updated by database triggers
  }

  /**
   * Replace item in specified slot (atomic operation)
   *
   * @param userId - User ID
   * @param slotName - Equipment slot name
   * @param newItemId - New item ID to equip
   * @throws ValidationError if slot-item category mismatch or invalid slot
   * @throws NotFoundError if item doesn't exist or not owned by user
   * @throws DatabaseError on operation failure
   */
  async replaceSlot(userId: string, slotName: string, newItemId: string): Promise<void> {
    // This is essentially the same as equipItem (which does upsert)
    await this.equipItem(userId, newItemId, slotName);
  }

  // ============================================================================
  // Stats Aggregation
  // ============================================================================

  /**
   * Get player equipped stats from database view
   *
   * @param userId - User ID
   * @returns Aggregated stats from v_player_equipped_stats view
   * @throws DatabaseError on query failure
   */
  async getPlayerEquippedStats(userId: string): Promise<Stats> {
    try {
      const { data, error } = await this.client
        .from('v_player_equipped_stats' as any)
        .select('*')
        .eq('player_id', userId)
        .single();

      if (error || !data) {
        // Return zero stats if no equipped items or user doesn't exist
        return { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };
      }

      return {
        atkPower: Number((data as any).atk) || 0,
        atkAccuracy: Number((data as any).acc) || 0,
        defPower: Number((data as any).def) || 0,
        defAccuracy: Number((data as any).acc) || 0 // Using acc for both attack and defense accuracy
      };
    } catch (error) {
      throw this.mapSupabaseError(error);
    }
  }

  /**
   * Compute total stats from all equipped items
   *
   * Uses database view for optimized aggregation. Falls back to application
   * code if view is not available.
   *
   * @param userId - User ID
   * @returns Aggregated stats from all equipped items
   * @throws DatabaseError on query failure
   */
  async computeTotalStats(userId: string): Promise<Stats> {
    // First try to use the database view for optimized aggregation
    try {
      const { data, error } = await this.client
        .from('v_player_equipped_stats' as any)
        .select('*')
        .eq('player_id', userId)
        .single();

      if (!error && data) {
        // Handle potential different column names in the view
        return {
          atkPower: (data as any).total_atk_power || (data as any).atk_power || 0,
          atkAccuracy: (data as any).total_atk_accuracy || (data as any).atk_accuracy || 0,
          defPower: (data as any).total_def_power || (data as any).def_power || 0,
          defAccuracy: (data as any).total_def_accuracy || (data as any).def_accuracy || 0,
        };
      }
    } catch (viewError) {
      // Fall back to application code if view doesn't exist or fails
    }

    // Fallback: Compute stats in application code
    const equipmentState = await this.findEquippedByUser(userId);

    let totalStats: Stats = {
      atkPower: 0,
      atkAccuracy: 0,
      defPower: 0,
      defAccuracy: 0,
    };

    // Sum stats from all equipped items
    for (const slot of EQUIPMENT_SLOT_NAMES) {
      const item = equipmentState[slot];
      if (item) {
        // Use current_stats if available (cached), otherwise base stats
        const itemStats = item.current_stats || item.item_type.base_stats_normalized;
        totalStats.atkPower += itemStats.atkPower;
        totalStats.atkAccuracy += itemStats.atkAccuracy;
        totalStats.defPower += itemStats.defPower;
        totalStats.defAccuracy += itemStats.defAccuracy;
      }
    }

    return totalStats;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Equip multiple items at once (for loadout activation)
   *
   * @param userId - User ID
   * @param slotAssignments - Map of slot names to item IDs (null to unequip)
   * @throws ValidationError if any slot-item category mismatch
   * @throws NotFoundError if any item doesn't exist or not owned by user
   * @throws DatabaseError on operation failure
   */
  async equipMultiple(userId: string, slotAssignments: BulkEquipmentUpdate): Promise<void> {
    // Validate all assignments before making any changes
    for (const [slotName, itemId] of Object.entries(slotAssignments)) {
      if (!EQUIPMENT_SLOT_NAMES.includes(slotName as EquipmentSlotName)) {
        throw new ValidationError(`Invalid slot name: ${slotName}`);
      }

      if (itemId !== null) {
        const isCompatible = await this.validateSlotCompatibility(itemId, slotName);
        if (!isCompatible) {
          throw new ValidationError(`Item ${itemId} category incompatible with slot ${slotName}`);
        }
      }
    }

    // Prepare upsert data for all slots
    const upsertData: UserEquipmentInsert[] = [];
    const currentTime = new Date().toISOString();

    for (const [slotName, itemId] of Object.entries(slotAssignments)) {
      upsertData.push({
        user_id: userId,
        slot_name: slotName,
        item_id: itemId,
        equipped_at: itemId ? currentTime : null,
      });
    }

    // Perform bulk upsert
    const { error } = await this.client
      .from('userequipment')
      .upsert(upsertData, {
        onConflict: 'user_id,slot_name'
      });

    if (error) {
      throw this.mapSupabaseError(error);
    }

    // Note: User stats will be updated by database triggers
  }

  /**
   * Clear all equipment slots for user
   *
   * @param userId - User ID
   * @throws DatabaseError on operation failure
   */
  async clearAllSlots(userId: string): Promise<void> {
    const { error } = await this.client
      .from('userequipment')
      .update({
        item_id: null,
        equipped_at: null,
      })
      .eq('user_id', userId);

    if (error) {
      throw this.mapSupabaseError(error);
    }

    // Note: User stats will be updated by database triggers
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate that item category matches equipment slot
   *
   * @param itemId - Item ID
   * @param slotName - Equipment slot name
   * @returns true if item can be equipped in slot, false otherwise
   * @throws NotFoundError if item doesn't exist
   * @throws ValidationError if slot name is invalid
   * @throws DatabaseError on query failure
   */
  async validateSlotCompatibility(itemId: string, slotName: string): Promise<boolean> {
    if (!EQUIPMENT_SLOT_NAMES.includes(slotName as EquipmentSlotName)) {
      throw new ValidationError(`Invalid slot name: ${slotName}. Must be one of: ${EQUIPMENT_SLOT_NAMES.join(', ')}`);
    }

    // Get item category
    const { data: itemData, error: itemError } = await this.client
      .from('items')
      .select(`
        itemtypes:item_type_id (
          category
        )
      `)
      .eq('id', itemId)
      .single();

    if (itemError) {
      if (itemError.code === 'PGRST116') {
        throw new NotFoundError('Item', itemId);
      }
      throw this.mapSupabaseError(itemError);
    }

    if (!itemData.itemtypes) {
      throw new NotFoundError('Item', itemId);
    }

    const itemType = Array.isArray(itemData.itemtypes) ? itemData.itemtypes[0] : itemData.itemtypes;
    const category = itemType.category;

    // Define slot-category mapping
    const slotCategoryMapping: Record<string, string[]> = {
      weapon: ['weapon'],
      offhand: ['weapon', 'shield'], // weapons can go in offhand
      head: ['head', 'helmet'],
      armor: ['armor', 'chestpiece'],
      feet: ['feet', 'boots'],
      accessory_1: ['accessory', 'ring', 'necklace'],
      accessory_2: ['accessory', 'ring', 'necklace'],
      pet: ['pet', 'companion'],
    };

    const allowedCategories = slotCategoryMapping[slotName] || [];
    return allowedCategories.includes(category);
  }

  /**
   * Get all valid equipment slot names
   *
   * @returns Array of slot names from EquipmentSlots table
   * @throws DatabaseError on query failure
   */
  async getAllSlotNames(): Promise<string[]> {
    const { data, error } = await this.client
      .from('equipmentslots')
      .select('slot_name')
      .order('sort_order');

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return (data || []).map(row => row.slot_name);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map Supabase error to domain error
   *
   * @private
   */
  private mapSupabaseError(error: any) {
    return mapSupabaseError(error);
  }

  /**
   * Initialize user equipment slots if they don't exist
   *
   * Creates empty UserEquipment records for all 8 slots for a new user.
   *
   * @param userId - User ID
   * @throws DatabaseError on operation failure
   */
  async initializeUserSlots(userId: string): Promise<void> {
    const slotData: UserEquipmentInsert[] = EQUIPMENT_SLOT_NAMES.map(slotName => ({
      user_id: userId,
      slot_name: slotName,
      item_id: null,
      equipped_at: null,
    }));

    const { error } = await this.client
      .from('userequipment')
      .upsert(slotData, {
        onConflict: 'user_id,slot_name',
        ignoreDuplicates: true
      });

    if (error) {
      throw this.mapSupabaseError(error);
    }
  }
}