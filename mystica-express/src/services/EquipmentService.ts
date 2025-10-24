import { EquipmentSlots, EquipResult, Stats, Item, ItemType, PlayerStats, EquipmentSlot, PlayerItem } from '../types/api.types';
import { NotImplementedError, mapSupabaseError } from '../utils/errors';
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
      const slotName = await this.mapCategoryToSlot(item.item_type.category, userId);

      // Use the atomic RPC function to handle the complex equip logic
      const result = await this.equipmentRepository.equipItemAtomic(userId, itemId, slotName);

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
        slot: slotName as EquipmentSlot,
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
      const result = await this.equipmentRepository.unequipItemAtomic(userId, slotName);

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
   * For accessory items, intelligently selects best available slot
   */
  private async mapCategoryToSlot(category: string, userId?: string): Promise<string> {
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
        // For accessories, intelligently select best available slot
        return userId ? await this.selectBestAccessorySlot(userId) : 'accessory_1';
      case 'pet':
        return 'pet';
      default:
        throw new Error(`Unknown item category: ${category}`);
    }
  }

  /**
   * Select the best accessory slot for new item
   * Strategy: Fill empty slots first, default to accessory_1 if both occupied
   */
  private async selectBestAccessorySlot(userId: string): Promise<'accessory_1' | 'accessory_2'> {
    try {
      // Query UserEquipment to check which accessory slots are available
      const accessory1 = await this.equipmentRepository.findItemInSlot(userId, 'accessory_1');
      const accessory2 = await this.equipmentRepository.findItemInSlot(userId, 'accessory_2');

      // Strategy 1: Fill empty slots first
      if (!accessory1) return 'accessory_1';
      if (!accessory2) return 'accessory_2';

      // Strategy 2: Default to accessory_1 if both occupied (will replace)
      return 'accessory_1';
    } catch (error) {
      // Fallback to accessory_1 on any error
      console.warn('Failed to select best accessory slot, falling back to accessory_1:', error);
      return 'accessory_1';
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
    return await this.equipmentRepository.getPlayerEquippedStats(userId);
  }

  /**
   * Get normalized base stats for category (fallback when not in repository)
   */
  private getNormalizedStatsForCategory(category: string): Stats {
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

    const stats = normalizedStats[category];
    if (!stats) {
      throw new Error(`Unknown item category for stats calculation: ${category}`);
    }
    return stats;
  }

  /**
   * Map item category to valid equipment slot
   */
  private mapCategoryToEquipmentSlot(category: string): EquipmentSlot {
    switch (category) {
      case 'weapon':
      case 'sword':
      case 'axe':
      case 'staff':
      case 'bow':
        return 'weapon';
      case 'offhand':
      case 'shield':
        return 'offhand';
      case 'head':
      case 'helmet':
        return 'head';
      case 'armor':
      case 'chestplate':
        return 'armor';
      case 'feet':
      case 'boots':
        return 'feet';
      case 'accessory':
      case 'ring':
      case 'necklace':
        return 'accessory_1'; // Default to first accessory slot
      case 'pet':
        return 'pet';
      default:
        throw new Error(`Unknown item category: ${category}`);
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

    // Get the base normalized stats
    const baseStats = repositoryItem.item_type.base_stats_normalized || this.getNormalizedStatsForCategory(repositoryItem.item_type.category);

    // Use current_stats only if it appears to be normalized (values between 0-1)
    // Otherwise fall back to base_stats_normalized
    let computedStats = baseStats;
    if (repositoryItem.current_stats) {
      const stats = repositoryItem.current_stats;
      const isNormalized = stats.atkPower <= 1 && stats.atkAccuracy <= 1 &&
                          stats.defPower <= 1 && stats.defAccuracy <= 1;
      if (isNormalized) {
        computedStats = stats;
      }
    }

    return {
      id: repositoryItem.id,
      base_type: repositoryItem.item_type.name,
      item_type_id: repositoryItem.item_type.id,
      category: repositoryItem.item_type.category,
      level: repositoryItem.level,
      rarity: repositoryItem.item_type.rarity,
      applied_materials: appliedMaterials,
      computed_stats: computedStats,
      material_combo_hash: repositoryItem.material_combo_hash ?? null,
      generated_image_url: repositoryItem.generated_image_url ?? `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/default_${repositoryItem.item_type.category}.png`,
      image_generation_status: repositoryItem.image_generation_status ?? null,
      craft_count: 0, // TODO: Query from ItemImageCache
      is_styled: repositoryItem.is_styled || false,
      is_equipped: isEquipped,
      equipped_slot: null // TODO: Get from current equipment state
    };
  }
}

export const equipmentService = new EquipmentService();