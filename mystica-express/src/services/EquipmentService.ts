import { EquipmentSlots, EquipResult, Stats, Item, ItemType, PlayerStats, EquipmentSlot, PlayerItem } from '../types/api.types';
import { NotImplementedError, mapSupabaseError } from '../utils/errors';
import { supabase } from '../config/supabase';
import { EquipmentRepository } from '../repositories/EquipmentRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';

/**
 * Handles equipment management and the 8-slot system
 */
export class EquipmentService {
  private equipmentRepository: EquipmentRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.equipmentRepository = new EquipmentRepository();
    this.itemRepository = new ItemRepository();
  }
  /**
   * Get all currently equipped items for user
   * - Fetches items from all 8 equipment slots
   * - Returns current equipment state
   * - Includes computed stats for each equipped item
   */
  async getEquippedItems(userId: string): Promise<{ slots: EquipmentSlots; total_stats: Stats }> {
    try {
      // Use repository to get equipped items
      const repositorySlots = await this.equipmentRepository.findEquippedByUser(userId);
      const total_stats = await this.equipmentRepository.computeTotalStats(userId);

      // Transform repository format to service API format
      const slots: EquipmentSlots = {
        weapon: repositorySlots.weapon ? this.transformRepositoryItemToPlayerItem(repositorySlots.weapon, true) : undefined,
        offhand: repositorySlots.offhand ? this.transformRepositoryItemToPlayerItem(repositorySlots.offhand, true) : undefined,
        head: repositorySlots.head ? this.transformRepositoryItemToPlayerItem(repositorySlots.head, true) : undefined,
        armor: repositorySlots.armor ? this.transformRepositoryItemToPlayerItem(repositorySlots.armor, true) : undefined,
        feet: repositorySlots.feet ? this.transformRepositoryItemToPlayerItem(repositorySlots.feet, true) : undefined,
        accessory_1: repositorySlots.accessory_1 ? this.transformRepositoryItemToPlayerItem(repositorySlots.accessory_1, true) : undefined,
        accessory_2: repositorySlots.accessory_2 ? this.transformRepositoryItemToPlayerItem(repositorySlots.accessory_2, true) : undefined,
        pet: repositorySlots.pet ? this.transformRepositoryItemToPlayerItem(repositorySlots.pet, true) : undefined
      };

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
    try {
      // First, get the item to determine its category and find appropriate slot
      const item = await this.itemRepository.findWithItemType(itemId, userId);

      if (!item || !item.item_type) {
        throw new Error('Item not found');
      }

      // Determine slot name based on item category
      const slotName = this.mapCategoryToSlot(item.item_type.category);

      // Use the atomic RPC function to handle the complex equip logic
      const { data: result, error: rpcError } = await supabase.rpc('equip_item' as any, {
        p_user_id: userId,
        p_item_id: itemId,
        p_slot_name: slotName
      });

      if (rpcError) {
        throw mapSupabaseError(rpcError);
      }

      // Handle RPC function response
      const equipResult = result as any;
      if (!equipResult.success) {
        throw new Error(equipResult.message || 'Failed to equip item');
      }

      const equipData = equipResult.data;

      // Get the equipped item details
      const equippedItem = await this.getPlayerItem(itemId, true);

      // Get the previously equipped item details if there was one
      let unequippedItem = undefined;
      if (equipData.previous_item_id) {
        unequippedItem = await this.getPlayerItem(equipData.previous_item_id, false);
      }

      // Get updated player stats and equipment details
      const totalStats = await this.getPlayerStats(userId);
      const currentEquipment = await this.getEquippedItems(userId);

      // Count equipped items and sum their levels
      const equippedSlots = Object.values(currentEquipment.slots).filter(item => item !== undefined);
      const equippedItemsCount = equippedSlots.length;
      const totalItemLevel = equippedSlots.reduce((sum, item) => sum + (item?.level || 0), 0);

      // For now, use empty stats for individual item contributions (could be enhanced later)
      const emptyStats: Stats = { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };
      const updatedPlayerStats: PlayerStats = {
        total_stats: totalStats,
        item_contributions: {
          weapon: emptyStats,
          offhand: emptyStats,
          head: emptyStats,
          armor: emptyStats,
          feet: emptyStats,
          accessory_1: emptyStats,
          accessory_2: emptyStats,
          pet: emptyStats
        },
        equipped_items_count: equippedItemsCount,
        total_item_level: totalItemLevel
      };

      return {
        success: true,
        equipped_item: equippedItem,
        unequipped_item: unequippedItem,
        updated_player_stats: updatedPlayerStats
      };

    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Unequip item from specified slot
   * - Removes item from equipment slot
   * - Updates total stats
   * - Returns item to inventory
   */
  async unequipItem(userId: string, slotName: string): Promise<boolean> {
    try {
      // Use the atomic RPC function to handle the unequip logic
      const { data: result, error: rpcError } = await supabase.rpc('unequip_item' as any, {
        p_user_id: userId,
        p_slot_name: slotName
      });

      if (rpcError) {
        throw mapSupabaseError(rpcError);
      }

      // Handle RPC function response
      const unequipResult = result as any;
      if (!unequipResult.success) {
        throw new Error(unequipResult.message || 'Failed to unequip item');
      }

      // Return true if an item was actually unequipped, false if slot was empty
      return unequipResult.data.unequipped_item_id !== null;

    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Map item category to appropriate equipment slot name
   * For accessory items, defaults to accessory_1 (could be enhanced with preference logic)
   */
  private mapCategoryToSlot(category: string): string {
    switch (category) {
      case 'weapon':
        return 'weapon';
      case 'offhand':
        return 'offhand';
      case 'head':
        return 'head';
      case 'armor':
        return 'armor';
      case 'feet':
        return 'feet';
      case 'accessory':
        // For accessories, prefer accessory_1 slot
        // TODO: Could be enhanced to check which accessory slot is available
        return 'accessory_1';
      case 'pet':
        return 'pet';
      default:
        throw new Error(`Unknown item category: ${category}`);
    }
  }

  /**
   * Get full item details formatted as PlayerItem for API responses
   */
  private async getPlayerItem(itemId: string, isEquipped: boolean): Promise<PlayerItem> {
    const item = await this.itemRepository.findWithItemType(itemId);

    if (!item || !item.item_type) {
      throw new Error('Item not found');
    }

    return this.transformRepositoryItemToPlayerItem(item, isEquipped);
  }

  /**
   * Get player stats from equipped items using v_player_equipped_stats view
   */
  private async getPlayerStats(userId: string): Promise<Stats> {
    try {
      const { data, error } = await supabase
        .from('v_player_equipped_stats')
        .select('*')
        .eq('player_id', userId)
        .single();

      if (error || !data) {
        // Return zero stats if no equipped items or user doesn't exist
        return { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };
      }

      return {
        atkPower: Number(data.atk) || 0,
        atkAccuracy: Number(data.acc) || 0,
        defPower: Number(data.def) || 0,
        defAccuracy: Number(data.acc) || 0 // Using acc for both attack and defense accuracy
      };
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Transform repository item format to PlayerItem API format
   */
  private transformRepositoryItemToPlayerItem(repositoryItem: any, isEquipped: boolean): PlayerItem {
    if (!repositoryItem?.item_type) {
      throw new Error('Repository item missing item_type data');
    }

    // Get applied materials if any
    const appliedMaterials = repositoryItem.materials || [];

    return {
      id: repositoryItem.id,
      item_type: {
        id: repositoryItem.item_type.id,
        name: repositoryItem.item_type.name,
        category: repositoryItem.item_type.category,
        equipment_slot: repositoryItem.item_type.category as EquipmentSlot, // Assumes category matches slot
        base_stats: repositoryItem.item_type.base_stats_normalized,
        rarity: repositoryItem.item_type.rarity,
        description: repositoryItem.item_type.description || '',
        image_url: repositoryItem.item_type.image_url
      } as ItemType,
      level: repositoryItem.level,
      rarity: repositoryItem.item_type.rarity,
      applied_materials: appliedMaterials,
      is_styled: repositoryItem.is_styled || false,
      computed_stats: repositoryItem.current_stats || repositoryItem.item_type.base_stats_normalized || { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 },
      is_equipped: isEquipped,
      generated_image_url: repositoryItem.generated_image_url || undefined
    };
  }
}

export const equipmentService = new EquipmentService();