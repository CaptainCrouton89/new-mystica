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
   * Get user's complete inventory - all items treated as unique individuals
   * Returns all items with their generated_image_url (or fallback to default if not set)
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

      // Process ALL items as unique items (no stacking)
      let playerItems: PlayerItem[] = filteredItems.map(item => {
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
          throw new DatabaseError(`Failed to process item ${item.id}`, error as Record<string, any>);
        }
      });

      // Apply sorting to all items
      playerItems = this.sortPlayerItems(playerItems, sortBy);

      // Apply pagination to items only
      const totalItems = playerItems.length;
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(totalItems / limit);

      const paginatedItems = playerItems.slice(offset, offset + limit);

      const pagination: PaginationInfo = {
        current_page: page,
        total_pages: totalPages,
        total_items: totalItems,
        items_per_page: limit
      };

      return {
        items: paginatedItems,
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