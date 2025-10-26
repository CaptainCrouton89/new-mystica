import { ItemRepository } from '../repositories/ItemRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { AppliedMaterial, Rarity, Stats } from '../types/api.types.js';
import { ItemWithDetails } from '../types/repository.types.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { statsService } from './StatsService.js';

export interface PlayerItem {
  id: string;
  base_type: string;
  description?: string | null;
  name?: string | null;
  item_type_id: string;
  category: 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  level: number;
  rarity: Rarity;
  applied_materials: AppliedMaterial[];
  materials?: AppliedMaterial[]; 
  computed_stats: Stats;
  material_combo_hash: string | null;
  generated_image_url: string;
  image_generation_status: string | null;
  craft_count: number;
  is_styled: boolean;
  is_equipped: boolean;
  equipped_slot: string | null;
}

export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}

export interface InventoryOptions {
  slotType?: 'all' | 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  sortBy?: 'level' | 'rarity' | 'newest' | 'name';
  page?: number;
  limit?: number;
}

export interface PaginatedInventory {
  items: PlayerItem[];
  pagination: PaginationInfo;
}

export class InventoryService {
  private itemRepository: ItemRepository;
  private materialRepository: MaterialRepository;

  constructor() {
    this.itemRepository = new ItemRepository();
    this.materialRepository = new MaterialRepository();
  }

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
      const userItems = await this.itemRepository.findByUser(userId);
      const itemsWithDetails: ItemWithDetails[] = [];

      if (userItems.length > 0) {
        const itemIds = userItems.map(item => item.id);
        const detailedItems = await this.itemRepository.findManyWithDetails(itemIds, userId);
        itemsWithDetails.push(...detailedItems);
      }

      const equippedItems = await this.itemRepository.findEquippedByUser(userId);
      const equippedItemIds = new Set(equippedItems.map(item => item.id));
      const equippedSlotMap = new Map(
        equippedItems.map(item => [item.id, (item as any).userequipment?.slot_name ?? null])
      );

      const filteredItems = this.applySlotFilter(itemsWithDetails, slotType);

      let playerItems: PlayerItem[] = filteredItems.map(item => {
        try {
          return {
            id: item.id,
            base_type: item.name
                ? item.name
                : item.item_type.name
                    ? item.item_type.name
                    : (() => {
                        throw new ValidationError(`Missing name for item ${item.id}`);
                    })(),
            description: item.description
                ? item.description
                : item.item_type.description
                    ? item.item_type.description
                    : null,
            name: item.name ? item.name : null,
            item_type_id: item.item_type_id,
            category: (() => {
                const category = item.item_type.category;
                if (['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory', 'pet'].includes(category)) {
                    return category as 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
                }
                throw new ValidationError(`Invalid category for item ${item.id}: ${category}`);
            })(),
            level: item.level,
            rarity: item.item_type.rarity,
            applied_materials: item.materials ?? [],
            materials: item.materials ?? [], 
            computed_stats: this.calculateItemStatsWithMaterials(item),
            material_combo_hash: item.material_combo_hash ?? null,
            generated_image_url: item.generated_image_url
                ? item.generated_image_url
                : this.getDefaultImage(item),
            image_generation_status: item.image_generation_status ?? null,
            craft_count: 0, 
            is_styled: item.is_styled,
            is_equipped: equippedItemIds.has(item.id),
            equipped_slot: equippedSlotMap.get(item.id) ?? null
          };
        } catch (error) {
          throw new DatabaseError(`Failed to process item ${item.id}`, error as Record<string, any>);
        }
      });

      playerItems = this.sortPlayerItems(playerItems, sortBy);

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

  private calculateItemStatsWithMaterials(item: ItemWithDetails): Stats {
    try {
      const baseStats = item.item_type.base_stats_normalized;
      const appliedMaterials = item.materials ?? [];

      return statsService.computeItemStats(baseStats, item.level, appliedMaterials);
    } catch (error) {
      throw new DatabaseError(`Failed to calculate stats for item ${item.id}`, error as Record<string, any>);
    }
  }

  private getDefaultImage(item: ItemWithDetails): string {
    const baseUrl = process.env.R2_PUBLIC_URL;
    return `${baseUrl}/items/default_${item.item_type.category}.png`;
  }

  private applySlotFilter(items: ItemWithDetails[], slotType: string): ItemWithDetails[] {
    if (slotType === 'all') {
      return items;
    }

    if (slotType === 'accessory') {
      return items.filter(item =>
        item.item_type.category === 'accessory_1' ||
        item.item_type.category === 'accessory_2' ||
        item.item_type.category === 'accessory'
      );
    }

    return items.filter(item => item.item_type.category === slotType);
  }

  private sortPlayerItems(items: PlayerItem[], sortBy: string): PlayerItem[] {
    return items.sort((a, b) => {
      switch (sortBy) {
        case 'level':
          return b.level - a.level; 
        case 'rarity':
          return this.compareRarity(b.rarity, a.rarity); 
        case 'newest':
          
          return b.id.localeCompare(a.id);
        case 'name':
          return a.base_type.localeCompare(b.base_type); 
        default:
          return b.level - a.level;
      }
    });
  }

  private compareRarity(a: string, b: string): number {
    const rarityOrder = {
      'common': 1,
      'uncommon': 2,
      'rare': 3,
      'epic': 4,
      'legendary': 5
    };

    const aValue = rarityOrder[a as keyof typeof rarityOrder] ?? 0;
    const bValue = rarityOrder[b as keyof typeof rarityOrder] ?? 0;

    return aValue - bValue;
  }
}

export const inventoryService = new InventoryService();