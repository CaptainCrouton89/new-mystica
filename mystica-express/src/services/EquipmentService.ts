import { EquipmentRepository, ItemWithBasicDetails } from '../repositories/EquipmentRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { EquipmentSlot, EquipmentSlots, EquipResult, PlayerItem, PlayerStats, Stats } from '../types/api.types';
import { mapSupabaseError } from '../utils/errors';
import { statsService } from './StatsService.js';

export class EquipmentService {
  private equipmentRepository: EquipmentRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.equipmentRepository = new EquipmentRepository();
    this.itemRepository = new ItemRepository();
  }

  async getEquippedItems(userId: string): Promise<{ slots: EquipmentSlots; total_stats: Stats }> {
    try {

      const repositorySlots = await this.equipmentRepository.findEquippedByUser(userId);

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

      // Calculate total stats from individual items (now with proper level and rarity multipliers)
      const total_stats: Stats = {
        atkPower: 0,
        atkAccuracy: 0,
        defPower: 0,
        defAccuracy: 0
      };

      Object.values(slots).forEach(item => {
        if (item) {
          total_stats.atkPower += item.computed_stats.atkPower;
          total_stats.atkAccuracy += item.computed_stats.atkAccuracy;
          total_stats.defPower += item.computed_stats.defPower;
          total_stats.defAccuracy += item.computed_stats.defAccuracy;
        }
      });

      return { slots, total_stats };
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  async equipItem(userId: string, itemId: string): Promise<EquipResult> {
    try {
      
      const item = await this.itemRepository.findWithItemType(itemId, userId);

      if (!item || !item.item_type) {
        throw new Error('Item not found');
      }

      const slotName = await this.mapCategoryToSlot(item.item_type.category, userId);

      const result = await this.equipmentRepository.equipItemAtomic(userId, itemId, slotName);

      const equipResult = result as any;
      if (!equipResult.success) {
        throw new Error(equipResult.message ?? 'Failed to equip item');
      }

      const equipData = equipResult.data;

      const equippedItem = await this.getPlayerItem(itemId, true);

      let unequippedItem = undefined;
      if (equipData.previous_item_id) {
        unequippedItem = await this.getPlayerItem(equipData.previous_item_id, false);
      }

      const totalStats = await this.getPlayerStats(userId);
      const currentEquipment = await this.getEquippedItems(userId);

      const equippedSlots = Object.values(currentEquipment.slots).filter(item => item !== undefined);
      const equippedItemsCount = equippedSlots.length;
      const totalItemLevel = equippedSlots.reduce((sum, item) => sum + (item?.level ?? 0), 0);

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

  async unequipItem(userId: string, slotName: string): Promise<boolean> {
    try {
      
      const result = await this.equipmentRepository.unequipItemAtomic(userId, slotName);

      const unequipResult = result as any;
      if (!unequipResult.success) {
        throw new Error(unequipResult.message ?? 'Failed to unequip item');
      }

      return unequipResult.data.unequipped_item_id !== null;

    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

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
        
        return userId ? await this.selectBestAccessorySlot(userId) : 'accessory_1';
      case 'pet':
        return 'pet';
      default:
        throw new Error(`Unknown item category: ${category}`);
    }
  }

  private async selectBestAccessorySlot(userId: string): Promise<'accessory_1' | 'accessory_2'> {
    try {
      
      const accessory1 = await this.equipmentRepository.findItemInSlot(userId, 'accessory_1');
      const accessory2 = await this.equipmentRepository.findItemInSlot(userId, 'accessory_2');

      if (!accessory1) return 'accessory_1';
      if (!accessory2) return 'accessory_2';

      return 'accessory_1';
    } catch (error) {
      
      console.warn('Failed to select best accessory slot, falling back to accessory_1:', error);
      return 'accessory_1';
    }
  }

  private async getPlayerItem(itemId: string, isEquipped: boolean): Promise<PlayerItem> {
    const item = await this.itemRepository.findWithItemType(itemId);

    if (!item || !item.item_type) {
      throw new Error('Item not found');
    }

    return this.transformRepositoryItemToPlayerItem(item, isEquipped);
  }

  private async getPlayerStats(userId: string): Promise<Stats> {
    return await this.equipmentRepository.getPlayerEquippedStats(userId);
  }

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
        return 'accessory_1'; 
      case 'pet':
        return 'pet';
      default:
        throw new Error(`Unknown item category: ${category}`);
    }
  }

  private transformRepositoryItemToPlayerItem(repositoryItem: ItemWithBasicDetails, isEquipped: boolean): PlayerItem {
    // Use StatsService to properly compute stats with level and rarity multipliers
    const itemWithType = {
      item_type: {
        base_stats_normalized: repositoryItem.item_type.base_stats_normalized,
        rarity: repositoryItem.item_type.rarity
      }
    };

    const computedStats = statsService.computeItemStatsForLevel(itemWithType, repositoryItem.level);

    // Determine the image URL
    const baseUrl = process.env.R2_PUBLIC_URL;
    const generatedImageUrl = repositoryItem.generated_image_url
      ? repositoryItem.generated_image_url
      : `${baseUrl}/items/default_${repositoryItem.item_type.category}.png`;

    return {
      id: repositoryItem.id,
      base_type: repositoryItem.item_type.name,
      description: null,
      name: repositoryItem.item_type.name,
      item_type_id: repositoryItem.item_type.id,
      category: this.mapCategoryToEquipmentSlot(repositoryItem.item_type.category),
      level: repositoryItem.level,
      rarity: repositoryItem.item_type.rarity,
      applied_materials: [],
      computed_stats: computedStats,
      material_combo_hash: null,
      generated_image_url: generatedImageUrl,
      image_generation_status: null,
      craft_count: 0,
      is_styled: repositoryItem.is_styled,
      is_equipped: isEquipped,
      equipped_slot: null
    };
  }
}

export const equipmentService = new EquipmentService();