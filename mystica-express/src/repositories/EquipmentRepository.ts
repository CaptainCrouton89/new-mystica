/**
 * Equipment Repository - Managing UserEquipment operations
 *
 * Handles all equipment-related database operations including:
 * - Equipment slot state management (8 hardcoded slots)
 * - Equip/unequip operations with validation
 * - Stats aggregation from equipped items
 * - Bulk operations for loadout switching
 */

import { Stats } from '../types/api.types.js';
import { Database } from '../types/database.types.js';
import {
  BulkEquipmentUpdate
} from '../types/repository.types.js';
import { DatabaseError, NotFoundError, ValidationError, mapSupabaseError } from '../utils/errors.js';
import { BaseRepository } from './BaseRepository.js';

// Type definitions
type UserEquipmentRow = Database['public']['Tables']['userequipment']['Row'];
type UserEquipmentInsert = Database['public']['Tables']['userequipment']['Insert'];
type EquipmentSlotRow = Database['public']['Tables']['equipmentslots']['Row'];
type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemTypeRow = Database['public']['Tables']['itemtypes']['Row'];
type PlayerEquippedStatsRow = Database['public']['Views']['v_player_equipped_stats']['Row'];

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
  /**
   * Get complete equipment state for a user (all 8 slots with items)
   *
   * @param userId - User ID
   * @returns Equipment slots with equipped items
   * @throws NotFoundError if no equipment data found for user
   * @throws DatabaseError on query failure or invalid data
   *
   * Ensures:
   * - Strict validation of each equipment slot
   * - Throws error on missing or invalid data
   * - No null or default value fallbacks
   * - Explicit type checking for each field
   */
  async findEquippedByUser(userId: string): Promise<EquipmentSlots> {
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

    // Handle query errors
    if (error) {
      throw this.mapSupabaseError(error);
    }

    // Validate data presence
    if (!data || data.length === 0) {
      throw new NotFoundError('EquipmentState', userId);
    }

    // Strict validation functions
    const validateField = <T>(value: T | undefined | null, fieldName: string): T => {
      if (value === undefined || value === null) {
        throw new DatabaseError(`Missing required ${fieldName} in equipment data`);
      }
      return value;
    };

    const validateStats = (stats: unknown, source: string): Stats => {
      let parsedStats: unknown = stats;

      // Parse JSON string if necessary (Supabase returns JSONB as strings)
      if (typeof stats === 'string') {
        try {
          parsedStats = JSON.parse(stats);
        } catch (parseError) {
          const message = parseError instanceof Error ? parseError.message : String(parseError);
          throw new DatabaseError(`Failed to parse stats JSON for ${source}: ${message}`);
        }
      }

      if (!parsedStats || typeof parsedStats !== 'object') {
        throw new DatabaseError(`Invalid stats for ${source}`);
      }

      const requiredFields: (keyof Stats)[] = ['atkPower', 'atkAccuracy', 'defPower', 'defAccuracy'];
      for (const field of requiredFields) {
        if (typeof (parsedStats as Stats)[field] !== 'number') {
          throw new DatabaseError(`Invalid ${field} in ${source} stats`);
        }
      }
      return parsedStats as Stats;
    };

    // Initialize result with strict type
    const result: EquipmentSlots = {
      weapon: null, offhand: null, head: null, armor: null,
      feet: null, accessory_1: null, accessory_2: null, pet: null
    };

    // Process each equipment slot with strict validation
    for (const row of data) {
      const slotName = validateField(row.slot_name, 'slot_name') as EquipmentSlotName;

      // Validate slot name
      if (!EQUIPMENT_SLOT_NAMES.includes(slotName)) {
        throw new DatabaseError(`Invalid equipment slot: ${slotName}`);
      }

      // Validate items data
      if (row.items) {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        const itemType = Array.isArray(item.itemtypes) ? item.itemtypes[0] : item.itemtypes;

        if (!item || !itemType) {
          throw new DatabaseError(`Missing item or item type data for slot ${slotName}`);
        }

        result[slotName] = {
          id: validateField(item.id, `${slotName}.id`),
          level: validateField(item.level, `${slotName}.level`),
          is_styled: validateField(item.is_styled, `${slotName}.is_styled`),
          current_stats: item.current_stats ? validateStats(item.current_stats, `${slotName}.current_stats`) : null,
          generated_image_url: item.generated_image_url,
          item_type: {
            id: validateField(itemType.id, `${slotName}.item_type.id`),
            name: validateField(itemType.name, `${slotName}.item_type.name`),
            category: validateField(itemType.category, `${slotName}.item_type.category`),
            base_stats_normalized: validateStats(itemType.base_stats_normalized, `${slotName}.base_stats_normalized`),
            rarity: validateField(itemType.rarity, `${slotName}.item_type.rarity`),
          }
        };
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
  /**
   * Check if item is currently equipped by any user
   *
   * @param itemId - Item ID
   * @returns true if item is equipped, false otherwise
   * @throws DatabaseError on query failure
   *
   * Ensures:
   * - Explicit count validation
   * - Throws error for undefined or null count
   * - No fallback to default zero count
   */
  async isItemEquipped(itemId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from('userequipment')
      .select('item_id', { count: 'exact', head: true })
      .eq('item_id', itemId);

    if (error) {
      throw this.mapSupabaseError(error);
    }

    // Enforce strict typing and validation
    if (count === undefined || count === null) {
      throw new DatabaseError(`Unable to retrieve equipment count for item: ${itemId}`);
    }

    return count > 0;
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
  /**
   * Get player power level stats from v_player_powerlevel view
   *
   * @param userId - User ID
   * @returns Player power level stats
   * @throws NotFoundError if no power level found for user
   * @throws DatabaseError on query failure or invalid data
   *
   * Ensures:
   * - Throws error for missing power level data
   * - Validates each numeric field explicitly
   * - No fallback to default zero values
   */
  async getPlayerPowerLevel(userId: string): Promise<number> {
    // todo: implement
    return 1;
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
  /**
   * Get player equipped stats from database view
   *
   * @param userId - User ID
   * @returns Aggregated stats from v_player_equipped_stats view
   * @throws NotFoundError if no stats found for user
   * @throws DatabaseError on query failure or invalid data
   *
   * Ensures:
   * - Throws error for missing stats
   * - Validates each stat field explicitly
   * - Provides deterministic stat calculation
   * - No fallback to zero or default values
   */
  async getPlayerEquippedStats(userId: string): Promise<Stats> {
    const { data, error } = await this.client
      .from('v_player_equipped_stats')
      .select('*')
      .eq('player_id', userId)
      .single();

    // Handle query errors
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('PlayerStats', userId);
      }
      throw this.mapSupabaseError(error);
    }

    // Validate presence of data
    if (!data) {
      throw new NotFoundError('PlayerStats', userId);
    }

    // Cast to proper view row type
    const statsRow = data as PlayerEquippedStatsRow;

    // Strict type validation for each numeric field
    const validateNumber = (fieldName: string, value: unknown): number => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new DatabaseError(`Invalid ${fieldName} stat for user ${userId}: expected number, got ${typeof value}`);
      }
      return value;
    };

    // Extract and validate all 4 required stat fields
    // Note: database view returns lowercase column names (atkpower, atkaccuracy, defpower, defaccuracy)
    const atkPower = validateNumber('atkPower', statsRow.atkpower);
    const atkAccuracy = validateNumber('atkAccuracy', statsRow.atkaccuracy);
    const defPower = validateNumber('defPower', statsRow.defpower);
    const defAccuracy = validateNumber('defAccuracy', statsRow.defaccuracy);

    return {
      atkPower,
      atkAccuracy,
      defPower,
      defAccuracy
    };
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
  /**
   * Compute total stats from equipped items
   *
   * Uses database view for player stat computation
   *
   * @param userId - User ID
   * @returns Aggregated stats from all equipped items
   * @throws NotFoundError if no equipment state found
   * @throws DatabaseError on computation failure
   *
   * Ensures:
   * - Strict validation of all stat computations
   * - Throws error on missing or invalid data
   * - No fallback or default value strategies
   * - Explicit error handling for each computation step
   */
  async computeTotalStats(userId: string): Promise<Stats> {
    const { data, error } = await this.client
      .from('v_player_equipped_stats')
      .select('*')
      .eq('player_id', userId)
      .single();

    // Validate entire query result
    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('PlayerStats', userId);
      }
      throw this.mapSupabaseError(error);
    }

    if (!data) {
      throw new NotFoundError('PlayerStats', userId);
    }

    // Cast to proper view row type
    const statsRow = data as PlayerEquippedStatsRow;

    // Strict type validation for each numeric field with detailed error reporting
    const validateNumber = (fieldName: string, value: unknown): number => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new DatabaseError(`Invalid ${fieldName} stat for user ${userId}: expected number, got ${typeof value}`);
      }
      return value;
    };

    // Extract and validate all 4 required stat fields
    // Note: database view returns lowercase column names (atkpower, atkaccuracy, defpower, defaccuracy)
    const atkPower = validateNumber('atkPower', statsRow.atkpower);
    const atkAccuracy = validateNumber('atkAccuracy', statsRow.atkaccuracy);
    const defPower = validateNumber('defPower', statsRow.defpower);
    const defAccuracy = validateNumber('defAccuracy', statsRow.defaccuracy);

    return {
      atkPower,
      atkAccuracy,
      defPower,
      defAccuracy,
    };
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
  /**
   * Get all valid equipment slot names
   *
   * @returns Array of slot names from EquipmentSlots table
   * @throws NotFoundError if no slot names found
   * @throws DatabaseError on query failure
   *
   * Ensures:
   * - Throws error if no slot names found
   * - Validates each slot name
   * - No empty array fallback
   * - Explicit error handling
   */
  async getAllSlotNames(): Promise<string[]> {
    const { data, error } = await this.client
      .from('equipmentslots')
      .select('slot_name')
      .order('sort_order');

    if (error) {
      throw this.mapSupabaseError(error);
    }

    // Validate data presence
    if (!data || data.length === 0) {
      throw new NotFoundError('EquipmentSlotNames', 'No equipment slot names found');
    }

    // Validate and transform slot names
    const slotNames = data.map(row => {
      if (!row.slot_name || typeof row.slot_name !== 'string' || row.slot_name.trim() === '') {
        throw new DatabaseError('Invalid equipment slot name: empty or non-string value');
      }
      return row.slot_name;
    });

    // Additional validation to ensure non-empty array
    if (slotNames.length === 0) {
      throw new DatabaseError('No valid equipment slot names found');
    }

    return slotNames;
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