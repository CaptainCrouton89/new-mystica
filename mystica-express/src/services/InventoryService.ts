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
  base_type: string;
  item_type_id: string;
  category: 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  level: number;
  rarity: Rarity;
  applied_materials: AppliedMaterial[];
  materials?: AppliedMaterial[]; // For compatibility with tests
  computed_stats: Stats;
  material_combo_hash: string | null;
  generated_image_url: string;
  image_generation_status: string | null;
  craft_count: number;
  is_styled: boolean;
  is_equipped: boolean;
  equipped_slot: string | null;
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
 * Pagination metadata
 */
export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}

/**
 * Inventory query options
 */
export interface InventoryOptions {
  slotType?: 'all' | 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  sortBy?: 'level' | 'rarity' | 'newest' | 'name';
  page?: number;
  limit?: number;
}

/**
 * Paginated inventory result
 */
export interface PaginatedInventory {
  items: PlayerItem[];
  stacks: ItemStack[];
  pagination: PaginationInfo;
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
   * Get user's complete inventory with stacking logic, filtering, sorting, and pagination
   * Separates unique items (with materials) from stackable items (no materials)
   * Returns items with materials as unique items, groups base items by type+level as stacks
   */
  async getPlayerInventory(userId: string, options: InventoryOptions = {}): Promise<PaginatedInventory> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    const {
      slotType = 'all',
      sortBy = 'level',
      page = 1,
      limit = 50
    } = options;

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

      // Apply slot type filtering
      const filteredItems = this.applySlotFilter(itemsWithDetails, slotType);

      // Classify items by material state
      const uniqueItems: ItemWithDetails[] = [];
      const stackableItems: ItemWithDetails[] = [];

      for (const item of filteredItems) {
        if (item.materials && item.materials.length > 0) {
          uniqueItems.push(item);
        } else {
          stackableItems.push(item);
        }
      }

      // Process unique items (items with materials applied)
      let playerItems: PlayerItem[] = uniqueItems.map(item => {
        try {
          return {
            id: item.id,
            base_type: item.item_type.name,
            item_type_id: item.item_type_id,
            category: item.item_type.category as any,
            level: item.level,
            rarity: item.item_type.rarity,
            applied_materials: item.materials || [],
            materials: item.materials || [], // For compatibility with tests
            computed_stats: this.calculateItemStatsWithMaterials(item),
            material_combo_hash: item.material_combo_hash || null,
            generated_image_url: item.generated_image_url || this.getDefaultImage(item),
            image_generation_status: item.image_generation_status || null,
            craft_count: 0, // TODO: Implement craft count tracking when image cache is queried
            is_styled: item.is_styled,
            is_equipped: equippedItemIds.has(item.id),
            equipped_slot: equippedSlotMap.get(item.id) || null
          };
        } catch (error) {
          throw new DatabaseError(`Failed to process unique item ${item.id}`, error as Record<string, any>);
        }
      });

      // Apply sorting to unique items
      playerItems = this.sortPlayerItems(playerItems, sortBy);

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

      let stacks = Array.from(stacksMap.values());

      // Apply sorting to stacks
      stacks = this.sortItemStacks(stacks, sortBy);

      // Apply pagination to both items and stacks
      const totalItems = playerItems.length;
      const totalStacks = stacks.length;
      const totalCombined = totalItems + totalStacks;

      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(totalCombined / limit);

      // Determine which items to include based on pagination
      let paginatedItems: PlayerItem[] = [];
      let paginatedStacks: ItemStack[] = [];

      if (offset < totalItems) {
        // Start with items
        const itemsToTake = Math.min(limit, totalItems - offset);
        paginatedItems = playerItems.slice(offset, offset + itemsToTake);

        const remainingLimit = limit - itemsToTake;
        if (remainingLimit > 0) {
          // Take some stacks too
          paginatedStacks = stacks.slice(0, remainingLimit);
        }
      } else {
        // Only stacks
        const stackOffset = offset - totalItems;
        paginatedStacks = stacks.slice(stackOffset, stackOffset + limit);
      }

      const pagination: PaginationInfo = {
        current_page: page,
        total_pages: totalPages,
        total_items: totalCombined,
        items_per_page: limit
      };

      return {
        items: paginatedItems,
        stacks: paginatedStacks,
        pagination
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

  /**
   * Apply slot type filter to items
   */
  private applySlotFilter(items: ItemWithDetails[], slotType: string): ItemWithDetails[] {
    if (slotType === 'all') {
      return items;
    }

    // Map accessory to both accessory_1 and accessory_2 slots
    if (slotType === 'accessory') {
      return items.filter(item =>
        item.item_type.category === 'accessory_1' ||
        item.item_type.category === 'accessory_2' ||
        item.item_type.category === 'accessory'
      );
    }

    return items.filter(item => item.item_type.category === slotType);
  }

  /**
   * Sort player items by specified criteria
   */
  private sortPlayerItems(items: PlayerItem[], sortBy: string): PlayerItem[] {
    return items.sort((a, b) => {
      switch (sortBy) {
        case 'level':
          return b.level - a.level; // Descending (highest level first)
        case 'rarity':
          return this.compareRarity(b.rarity, a.rarity); // Descending (highest rarity first)
        case 'newest':
          // Use item ID as proxy for creation time (newer UUIDs are lexicographically greater)
          return b.id.localeCompare(a.id);
        case 'name':
          return a.base_type.localeCompare(b.base_type); // Ascending alphabetical
        default:
          return b.level - a.level;
      }
    });
  }

  /**
   * Sort item stacks by specified criteria
   */
  private sortItemStacks(stacks: ItemStack[], sortBy: string): ItemStack[] {
    return stacks.sort((a, b) => {
      switch (sortBy) {
        case 'level':
          return b.level - a.level; // Descending (highest level first)
        case 'rarity':
          // For stacks, we can't easily get rarity without additional queries
          // Fall back to level sorting
          return b.level - a.level;
        case 'newest':
          // For stacks, we can't determine creation time
          // Fall back to level sorting
          return b.level - a.level;
        case 'name':
          // For stacks, we don't have name in the stack object
          // Fall back to item_type_id sorting
          return a.item_type_id.localeCompare(b.item_type_id);
        default:
          return b.level - a.level;
      }
    });
  }

  /**
   * Compare rarity values for sorting (returns positive if a > b)
   */
  private compareRarity(a: string, b: string): number {
    const rarityOrder = {
      'common': 1,
      'uncommon': 2,
      'rare': 3,
      'epic': 4,
      'legendary': 5
    };

    const aValue = rarityOrder[a as keyof typeof rarityOrder] || 0;
    const bValue = rarityOrder[b as keyof typeof rarityOrder] || 0;

    return aValue - bValue;
  }
}

export const inventoryService = new InventoryService();