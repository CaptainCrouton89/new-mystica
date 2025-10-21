import { ItemRepository } from '../repositories/ItemRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { AppliedMaterial, Rarity, Stats } from '../types/api.types.js';
import { ItemWithDetails } from '../types/repository.types.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { statsService } from './StatsService.js';

/**
 * Player-owned unique item with materials applied
 */
export interface PlayerItem {
  id: string;
  name: string;
  item_type_id: string;
  category: 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  level: number;
  rarity: Rarity;
  applied_materials: AppliedMaterial[];
  materials?: AppliedMaterial[]; // For compatibility with tests
  is_styled: boolean;
  current_stats: Stats;
  is_equipped: boolean;
  equipped_slot: string | null;
  generated_image_url: string;
}

/**
 * Stackable item group by type+level
 */
export interface ItemStack {
  item_type_id: string;
  level: number;
  quantity: number;
  base_stats: Stats;
  icon_url: string;
}


/**
 * Handles inventory management and item stacking
 */
export class InventoryService {
  private itemRepository: ItemRepository;
  private materialRepository: MaterialRepository;

  constructor() {
    this.itemRepository = new ItemRepository();
    this.materialRepository = new MaterialRepository();
  }

  /**
   * Get user's complete inventory with stacking logic
   * Separates unique items (with materials) from stackable items (no materials)
   * Returns items with materials as unique items, groups base items by type+level as stacks
   */
  async getPlayerInventory(userId: string): Promise<{ items: PlayerItem[], stacks: ItemStack[] }> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    try {
      // Fetch all user items with complete details (includes item types and materials)
      const userItems = await this.itemRepository.findByUser(userId);
      const itemsWithDetails: ItemWithDetails[] = [];

      // Get full details for each item (batch operation to prevent N+1)
      if (userItems.length > 0) {
        const itemIds = userItems.map(item => item.id);
        const detailedItems = await this.itemRepository.findManyWithDetails(itemIds, userId);
        itemsWithDetails.push(...detailedItems);
      }

      // Get equipped items to mark equipment status
      const equippedItems = await this.itemRepository.findEquippedByUser(userId);
      const equippedItemIds = new Set(equippedItems.map(item => item.id));
      const equippedSlotMap = new Map(
        equippedItems.map(item => [item.id, (item as any).userequipment?.slot_name || null])
      );

      // Classify items by material state
      const uniqueItems: ItemWithDetails[] = [];
      const stackableItems: ItemWithDetails[] = [];

      for (const item of itemsWithDetails) {
        if (item.materials && item.materials.length > 0) {
          uniqueItems.push(item);
        } else {
          stackableItems.push(item);
        }
      }

      // Process unique items (items with materials applied)
      const playerItems: PlayerItem[] = uniqueItems.map(item => {
        try {
          return {
            id: item.id,
            name: item.item_type.name,
            item_type_id: item.item_type_id,
            category: item.item_type.category as any,
            level: item.level,
            rarity: item.item_type.rarity,
            applied_materials: item.materials || [],
            materials: item.materials || [], // For compatibility with tests
            is_styled: item.is_styled,
            current_stats: this.calculateItemStatsWithMaterials(item),
            is_equipped: equippedItemIds.has(item.id),
            equipped_slot: equippedSlotMap.get(item.id) || null,
            generated_image_url: item.generated_image_url || this.getDefaultImage(item)
          };
        } catch (error) {
          throw new DatabaseError(`Failed to process unique item ${item.id}`, error as Record<string, any>);
        }
      });

      // Process stackable items (items without materials, grouped by type+level)
      const stacksMap = new Map<string, ItemStack>();

      stackableItems.forEach(item => {
        try {
          const stackKey = `${item.item_type_id}_${item.level}`;

          if (!stacksMap.has(stackKey)) {
            stacksMap.set(stackKey, {
              item_type_id: item.item_type_id,
              level: item.level,
              quantity: 0,
              base_stats: this.calculateBaseStatsForLevel(item.item_type, item.level),
              icon_url: this.getDefaultIcon(item.item_type.category)
            });
          }

          stacksMap.get(stackKey)!.quantity++;
        } catch (error) {
          throw new DatabaseError(`Failed to process stackable item ${item.id}`, error as Record<string, any>);
        }
      });

      const stacks = Array.from(stacksMap.values());

      return {
        items: playerItems,
        stacks
      };

    } catch (error) {
      if (error instanceof DatabaseError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(`Failed to fetch inventory for user ${userId}`, error as Record<string, any>);
    }
  }

  /**
   * Calculate item stats with materials applied
   */
  private calculateItemStatsWithMaterials(item: ItemWithDetails): Stats {
    try {
      const baseStats = item.item_type.base_stats_normalized;
      const appliedMaterials = item.materials || [];

      return statsService.computeItemStats(baseStats, item.level, appliedMaterials);
    } catch (error) {
      throw new DatabaseError(`Failed to calculate stats for item ${item.id}`, error as Record<string, any>);
    }
  }

  /**
   * Calculate base stats for level (no materials)
   */
  private calculateBaseStatsForLevel(itemType: any, level: number): Stats {
    try {
      const mockItem = {
        item_type: {
          base_stats_normalized: itemType.base_stats_normalized,
          rarity: itemType.rarity
        }
      };
      return statsService.computeItemStatsForLevel(mockItem, level);
    } catch (error) {
      throw new DatabaseError(`Failed to calculate base stats for item type ${itemType.id}`, error as Record<string, any>);
    }
  }

  /**
   * Get default image for items
   */
  private getDefaultImage(item: ItemWithDetails): string {
    return `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/default_${item.item_type.category}.png`;
  }

  /**
   * Get default icon for item category
   */
  private getDefaultIcon(category: string): string {
    return `https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/icons/${category}_icon.png`;
  }
}

export const inventoryService = new InventoryService();