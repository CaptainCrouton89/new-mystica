import { EquipmentSlots, EquipResult, Stats, Item, ItemType } from '../types/api.types';
import { NotImplementedError, mapSupabaseError } from '../utils/errors';
import { supabase } from '../config/supabase';

/**
 * Handles equipment management and the 8-slot system
 */
export class EquipmentService {
  /**
   * Get all currently equipped items for user
   * - Fetches items from all 8 equipment slots
   * - Returns current equipment state
   * - Includes computed stats for each equipped item
   */
  async getEquippedItems(userId: string): Promise<{ slots: EquipmentSlots; total_stats: Stats }> {
    try {
      // Query userequipment with LEFT JOIN to items and itemtypes (lowercase table names)
      const { data, error } = await supabase
        .from('userequipment')
        .select(`
          slot_name,
          item_id,
          items (
            id,
            user_id,
            item_type_id,
            level,
            is_styled,
            current_stats,
            material_combo_hash,
            generated_image_url,
            created_at,
            itemtypes (
              id,
              name,
              category,
              base_stats_normalized,
              rarity,
              description
            )
          )
        `)
        .eq('user_id', userId);

      if (error) {
        throw mapSupabaseError(error);
      }

      // Initialize empty equipment slots
      const slots: EquipmentSlots = {
        weapon: undefined,
        offhand: undefined,
        head: undefined,
        armor: undefined,
        feet: undefined,
        accessory_1: undefined,
        accessory_2: undefined,
        pet: undefined
      };

      // Initialize total stats
      const total_stats: Stats = {
        atkPower: 0,
        atkAccuracy: 0,
        defPower: 0,
        defAccuracy: 0
      };

      // Process query results
      data?.forEach(row => {
        // Only process if item_id exists and items data is present
        if (row.item_id && row.items) {
          const itemData = row.items as any;

          // Transform database result to Item interface
          const item: Item = {
            id: itemData.id,
            user_id: itemData.user_id,
            item_type_id: itemData.item_type_id,
            level: itemData.level,
            base_stats: itemData.itemtypes?.base_stats_normalized || { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 },
            current_stats: itemData.current_stats || { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 },
            material_combo_hash: itemData.material_combo_hash,
            image_url: itemData.generated_image_url,
            materials: undefined, // Not queried in this context
            item_type: itemData.itemtypes ? {
              id: itemData.itemtypes.id,
              name: itemData.itemtypes.name,
              category: itemData.itemtypes.category,
              base_stats: itemData.itemtypes.base_stats_normalized,
              rarity: itemData.itemtypes.rarity,
              description: itemData.itemtypes.description
            } as ItemType : undefined,
            created_at: itemData.created_at,
            updated_at: itemData.created_at // Not available in current schema
          };

          // Assign to appropriate slot
          const slotName = row.slot_name as keyof EquipmentSlots;
          if (slotName in slots) {
            slots[slotName] = item;

            // Add to total stats
            const stats = item.current_stats;
            total_stats.atkPower += stats.atkPower || 0;
            total_stats.atkAccuracy += stats.atkAccuracy || 0;
            total_stats.defPower += stats.defPower || 0;
            total_stats.defAccuracy += stats.defAccuracy || 0;
          }
        }
      });

      return { slots, total_stats };
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Equip an item to appropriate slot
   * - Validates item ownership and type compatibility
   * - Handles slot conflicts (unequips existing if needed)
   * - Updates equipment state and total stats
   */
  async equipItem(userId: string, itemId: string): Promise<EquipResult> {
    // TODO: Implement item equipping workflow
    // 1. Validate user owns the item
    // 2. Get item type to determine compatible slots
    // 3. Check if slot is occupied
    // 4. If occupied, unequip existing item
    // 5. Create/update UserEquipment record
    // 6. Recompute total stats
    // 7. Return result with unequipped item (if any)
    throw new NotImplementedError('EquipmentService.equipItem not implemented');
  }

  /**
   * Unequip item from specified slot
   * - Removes item from equipment slot
   * - Updates total stats
   * - Returns item to inventory
   */
  async unequipItem(userId: string, slotName: string): Promise<boolean> {
    // TODO: Implement item unequipping workflow
    // 1. Validate slot name is valid (one of 8 slots)
    // 2. Check if slot is occupied
    // 3. Delete UserEquipment record for slot
    // 4. Recompute total stats
    // 5. Item automatically returns to inventory
    throw new NotImplementedError('EquipmentService.unequipItem not implemented');
  }
}

export const equipmentService = new EquipmentService();