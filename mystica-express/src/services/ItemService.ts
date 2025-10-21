import {
  Item,
  UpgradeResult,
  Stats,
  InventoryResponse,
  PaginationParams,
  ItemType,
  Rarity
} from '../types/api.types';
import {
  NotImplementedError,
  NotFoundError,
  BusinessLogicError,
  ValidationError,
  mapSupabaseError
} from '../utils/errors';
import { supabase } from '../config/supabase';
import { statsService } from './StatsService';
import { profileService } from './ProfileService';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
import { WeaponRepository } from '../repositories/WeaponRepository.js';
import { PetRepository } from '../repositories/PetRepository.js';
import {
  ItemWithDetails,
  CreateItemData
} from '../types/repository.types.js';
import { Database } from '../types/database.types.js';

// Repository return types
type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemTypeRow = Database['public']['Tables']['itemtypes']['Row'];
type ItemHistoryEvent = {
  id: string;
  item_id: string;
  user_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
};

// Service response types
export interface WeaponCombatStats {
  weapon: any;
  adjusted_bands: {
    deg_injure: number;
    deg_miss: number;
    deg_graze: number;
    deg_normal: number;
    deg_crit: number;
    total_degrees: number;
  };
  expected_damage_multiplier: number;
}

export interface PlayerTotalStats {
  equipped_stats: Stats;
  total_items_equipped: number;
  combat_rating: number;
  slots: {
    weapon?: ItemWithStats;
    offhand?: ItemWithStats;
    head?: ItemWithStats;
    armor?: ItemWithStats;
    feet?: ItemWithStats;
    accessory_1?: ItemWithStats;
    accessory_2?: ItemWithStats;
    pet?: ItemWithStats;
  };
}

export interface ItemWithStats extends Item {
  computed_stats: Stats;
}

export interface ChatterMessage {
  text: string;
  timestamp: string;
  type?: string;
}

/**
 * Handles individual item operations and upgrades
 */
export class ItemService {
  private itemRepository: ItemRepository;
  private profileRepository: ProfileRepository;
  private weaponRepository: WeaponRepository;
  private petRepository: PetRepository;

  constructor() {
    this.itemRepository = new ItemRepository();
    this.profileRepository = new ProfileRepository();
    this.weaponRepository = new WeaponRepository();
    this.petRepository = new PetRepository();
  }
  /**
   * Get detailed item information by ID
   * - Fetches item with all associated data
   * - Includes applied materials and computed stats
   * - Validates user ownership
   */
  async getItemDetails(userId: string, itemId: string): Promise<Item> {
    try {
      // Fetch item with all related data using repository
      const itemWithDetails = await this.itemRepository.findWithMaterials(itemId, userId);

      if (!itemWithDetails) {
        throw new NotFoundError('Item', itemId);
      }

      // Transform repository result to API Item type
      const item: Item = {
        id: itemWithDetails.id,
        user_id: itemWithDetails.user_id,
        item_type_id: itemWithDetails.item_type_id,
        level: itemWithDetails.level,
        base_stats: itemWithDetails.item_type.base_stats_normalized,
        current_stats: itemWithDetails.current_stats || itemWithDetails.item_type.base_stats_normalized,
        material_combo_hash: itemWithDetails.material_combo_hash || undefined,
        image_url: itemWithDetails.generated_image_url || undefined,
        materials: itemWithDetails.materials,
        item_type: {
          id: itemWithDetails.item_type.id,
          name: itemWithDetails.item_type.name,
          category: itemWithDetails.item_type.category as 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet',
          equipment_slot: itemWithDetails.item_type.category as any, // Same as category for equipment slots
          base_stats: itemWithDetails.item_type.base_stats_normalized,
          rarity: itemWithDetails.item_type.rarity,
          description: itemWithDetails.item_type.description
        },
        created_at: itemWithDetails.created_at,
        updated_at: itemWithDetails.created_at // Repository doesn't track updated_at separately
      };

      // Compute current stats if materials are applied or level > 1
      if (itemWithDetails.materials.length > 0 || itemWithDetails.level > 1) {
        item.current_stats = statsService.computeItemStatsForLevel(item as any, itemWithDetails.level);
      }

      return item;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Get upgrade cost for item
   * - Calculates gold cost for next level
   * - Returns current level and cost information
   */
  async getUpgradeCost(userId: string, itemId: string): Promise<{
    current_level: number;
    next_level: number;
    gold_cost: number;
    player_gold: number;
    can_afford: boolean;
  }> {
    try {
      // 1. Validate user owns item and get current level using repository
      const item = await this.itemRepository.findById(itemId, userId);

      if (!item) {
        throw new NotFoundError('Item', itemId);
      }

      const currentLevel = item.level;
      const nextLevel = currentLevel + 1;

      // 2. Calculate upgrade cost using formula: cost = 100 * Math.pow(1.5, level - 1)
      const goldCost = Math.floor(100 * Math.pow(1.5, currentLevel - 1));

      // 3. Get user's current gold using repository
      const playerGold = await this.profileRepository.getCurrencyBalance(userId, 'GOLD');
      const canAfford = playerGold >= goldCost;

      return {
        current_level: currentLevel,
        next_level: nextLevel,
        gold_cost: goldCost,
        player_gold: playerGold,
        can_afford: canAfford
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Upgrade item level using gold
   * - Costs gold based on current level (exponential scaling)
   * - Increases base stats linearly with level
   * - Updates average item level trigger
   */
  async upgradeItem(userId: string, itemId: string): Promise<UpgradeResult> {
    try {
      // 1. Get upgrade cost info (validates ownership)
      const costInfo = await this.getUpgradeCost(userId, itemId);

      if (!costInfo.can_afford) {
        throw new BusinessLogicError(`Insufficient gold. Need ${costInfo.gold_cost}, have ${costInfo.player_gold}`);
      }

      // 2. Get item details for stats calculation using repository
      const itemWithDetails = await this.itemRepository.findWithItemType(itemId, userId);

      if (!itemWithDetails) {
        throw new NotFoundError('Item', itemId);
      }

      // Transform to format expected by statsService
      const item = {
        ...itemWithDetails,
        item_type: itemWithDetails.item_type
      };

      // 3. Calculate stats before and after upgrade
      const statsBefore = statsService.computeItemStatsForLevel(item, costInfo.current_level);
      const statsAfter = statsService.computeItemStatsForLevel(item, costInfo.next_level);
      const statIncrease: Stats = {
        atkPower: statsAfter.atkPower - statsBefore.atkPower,
        atkAccuracy: statsAfter.atkAccuracy - statsBefore.atkAccuracy,
        defPower: statsAfter.defPower - statsBefore.defPower,
        defAccuracy: statsAfter.defAccuracy - statsBefore.defAccuracy
      };

      // 4. Perform atomic transaction
      const { error: transactionError } = await supabase.rpc('process_item_upgrade', {
        p_user_id: userId,
        p_item_id: itemId,
        p_gold_cost: costInfo.gold_cost,
        p_new_level: costInfo.next_level,
        p_new_stats: statsAfter as any
      });

      if (transactionError) {
        // If the RPC function doesn't exist, perform manual transaction
        await this.performManualUpgradeTransaction(
          userId,
          itemId,
          costInfo.gold_cost,
          costInfo.next_level,
          statsAfter
        );
      }

      // 5. Update vanity level
      await profileService.updateVanityLevel(userId);

      // 6. Return upgrade result
      // Create updated item for response
      const updatedItem: Item = {
        id: item.id,
        user_id: item.user_id,
        item_type_id: item.item_type_id,
        level: costInfo.next_level,
        base_stats: item.item_type.base_stats_normalized,
        current_stats: statsAfter,
        material_combo_hash: item.material_combo_hash || undefined,
        image_url: item.generated_image_url || undefined,
        materials: item.materials || [],
        item_type: {
          id: item.item_type.id,
          name: item.item_type.name,
          category: item.item_type.category as any,
          equipment_slot: item.item_type.category as any,
          base_stats: item.item_type.base_stats_normalized,
          rarity: item.item_type.rarity,
          description: item.item_type.description
        },
        created_at: item.created_at,
        updated_at: new Date().toISOString()
      };

      return {
        success: true,
        updated_item: updatedItem,
        gold_spent: costInfo.gold_cost,
        new_level: costInfo.next_level,
        stat_increase: statIncrease,
        message: `Item upgraded to level ${costInfo.next_level}!`
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Manual transaction for item upgrade when RPC is not available
   */
  private async performManualUpgradeTransaction(
    userId: string,
    itemId: string,
    goldCost: number,
    newLevel: number,
    newStats: Stats
  ): Promise<void> {
    // Start a manual transaction using multiple operations
    // Note: Supabase doesn't support true transactions via client, so this is best effort

    // 1. Deduct gold using repository (includes balance check and transaction logging)
    try {
      await this.profileRepository.deductCurrency(
        userId,
        'GOLD',
        goldCost,
        'ITEM_UPGRADE',
        itemId,
        { item_id: itemId, new_level: newLevel }
      );
    } catch (error) {
      throw new BusinessLogicError('Insufficient gold for upgrade');
    }

    // 2. Update item level and stats using repository
    await this.itemRepository.updateItem(itemId, userId, {
      level: newLevel,
      current_stats: newStats
    });
  }

  /**
   * Get all items owned by a user with pagination support
   * - Joins with UserEquipment to determine equipped status
   * - Computes stats for each item using stat calculation service
   * - Supports filtering by item type, rarity, or equipped status
   */
  async getUserInventory(userId: string, options?: PaginationParams): Promise<InventoryResponse> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      // Get paginated items with type information
      const items = await this.itemRepository.findByUserWithPagination(userId, limit, offset);

      // Get equipped items to mark equipped status
      const equippedItems = await this.itemRepository.findEquippedByUser(userId);
      const equippedItemIds = new Set(equippedItems.map(item => item.id));

      // Transform items to API format and compute stats
      const transformedItems: Item[] = [];
      for (const itemRow of items) {
        const itemWithType = await this.itemRepository.findWithItemType(itemRow.id, userId);
        if (!itemWithType) continue;

        const item = this.transformToApiItem(itemWithType);

        // Compute current stats if materials applied or level > 1
        if (itemWithType.materials?.length > 0 || itemWithType.level > 1) {
          item.current_stats = statsService.computeItemStatsForLevel(item as any, itemWithType.level);
        }

        // Mark as equipped if in equipped set
        (item as any).is_equipped = equippedItemIds.has(item.id);

        transformedItems.push(item);
      }

      // Get total count for pagination
      const allUserItems = await this.itemRepository.findByUser(userId);
      const totalCount = allUserItems.length;

      return {
        items: transformedItems,
        material_stacks: [], // TODO: Add material stacks when MaterialService is implemented
        total_items: transformedItems.length,
        total_materials: 0, // TODO: Get from MaterialService
        storage_capacity: {
          items_used: transformedItems.length,
          items_max: 100, // TODO: Get from user profile or config
          materials_used: 0, // TODO: Get from MaterialService
          materials_max: 200 // TODO: Get from user profile or config
        }
      };
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Create new item for user (used in ProfileService.initializeProfile() and loot drops)
   * - Validates itemTypeId exists in ItemTypes table
   * - Creates item record with default level 1
   * - Adds creation history event
   * - Creates weapon/pet data if applicable based on item category
   * - Returns complete item details
   */
  async createItem(userId: string, itemTypeId: string, level?: number): Promise<ItemWithDetails> {
    try {
      // 1. Validate item type exists
      const { data: itemType, error: itemTypeError } = await supabase
        .from('itemtypes')
        .select('*')
        .eq('id', itemTypeId)
        .single();

      if (itemTypeError || !itemType) {
        throw new NotFoundError('ItemType', itemTypeId);
      }

      // 2. Create item record with default values
      const createData: CreateItemData = {
        user_id: userId,
        item_type_id: itemTypeId,
        level: level || 1
      };

      const newItem = await this.itemRepository.create(createData);

      // 3. Add creation history event
      await this.addHistoryEvent(newItem.id, userId, 'created', {
        initial_level: newItem.level,
        item_type: itemType.name
      });

      // 4. Create specialized data if needed
      if (itemType.category === 'weapon') {
        await this.createWeaponData(newItem.id);
      } else if (itemType.category === 'pet') {
        await this.createPetData(newItem.id);
      }

      // 5. Return complete item details
      const itemWithDetails = await this.itemRepository.findWithMaterials(newItem.id, userId);
      if (!itemWithDetails) {
        throw new NotFoundError('Item', newItem.id);
      }

      return itemWithDetails;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Calculate final item stats with rarity, level, and material modifiers
   * - Uses stat computation formula from F-03/F-06 specs
   * - Applies rarity multiplier and level scaling
   * - Applies zero-sum material modifiers
   */
  async computeItemStats(item: ItemRow, itemType: ItemTypeRow, materials?: any[]): Promise<Stats> {
    try {
      // Transform to format expected by statsService
      const apiItem = {
        id: item.id,
        user_id: item.user_id,
        item_type_id: item.item_type_id,
        level: item.level,
        base_stats: itemType.base_stats_normalized,
        current_stats: itemType.base_stats_normalized,
        materials: materials || [],
        item_type: {
          id: itemType.id,
          name: itemType.name,
          category: itemType.category as any,
          equipment_slot: itemType.category as any,
          base_stats: itemType.base_stats_normalized,
          base_stats_normalized: itemType.base_stats_normalized,
          rarity: itemType.rarity,
          description: itemType.description
        } as any,
        created_at: item.created_at,
        updated_at: item.created_at
      };

      return statsService.computeItemStatsForLevel(apiItem, item.level);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Sum stats from all 8 equipped items for combat calculations
   * - Queries UserEquipment for all 8 slots
   * - Computes stats for each equipped item
   * - Sums all stats together
   * - Includes combat rating calculation
   */
  async getPlayerTotalStats(userId: string): Promise<PlayerTotalStats> {
    try {
      // Get all equipped items
      const equippedItems = await this.itemRepository.findEquippedByUser(userId);

      let totalStats: Stats = {
        atkPower: 0,
        atkAccuracy: 0,
        defPower: 0,
        defAccuracy: 0
      };

      const slots: PlayerTotalStats['slots'] = {};
      let totalLevel = 0;

      // Process each equipped item
      for (const itemData of equippedItems) {
        const item = this.transformToApiItem(itemData);

        // Compute stats for this item
        const itemStats = await this.computeItemStats(
          { ...itemData, created_at: itemData.created_at } as any,
          itemData.item_type as any,
          itemData.materials
        );

        // Add to total stats
        totalStats.atkPower += itemStats.atkPower;
        totalStats.atkAccuracy += itemStats.atkAccuracy;
        totalStats.defPower += itemStats.defPower;
        totalStats.defAccuracy += itemStats.defAccuracy;

        totalLevel += itemData.level;

        // Add to slots (need to determine slot from equipment table)
        const slotName = itemData.item_type.category as keyof PlayerTotalStats['slots'];
        if (slotName) {
          slots[slotName] = {
            ...item,
            computed_stats: itemStats
          };
        }
      }

      // Calculate combat rating (simple sum of all stats)
      const combatRating = totalStats.atkPower + totalStats.atkAccuracy +
                          totalStats.defPower + totalStats.defAccuracy;

      return {
        equipped_stats: totalStats,
        total_items_equipped: equippedItems.length,
        combat_rating: combatRating,
        slots
      };
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Record item lifecycle events for audit trail
   * - Validates ownership first
   * - Inserts into itemhistory table
   */
  async addHistoryEvent(
    itemId: string,
    userId: string,
    eventType: string,
    eventData?: any
  ): Promise<void> {
    try {
      await this.itemRepository.addHistoryEvent(itemId, userId, eventType, eventData);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Retrieve complete history for an item
   * - Validates ownership first
   * - Returns events ordered by created_at DESC
   */
  async getItemHistory(itemId: string, userId: string): Promise<ItemHistoryEvent[]> {
    try {
      return await this.itemRepository.getItemHistory(itemId, userId);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Calculate weapon timing effectiveness for combat
   * - Uses WeaponRepository for combat calculations
   * - Calls PostgreSQL RPC functions for accuracy-adjusted bands
   */
  async getWeaponCombatStats(weaponItemId: string, playerAccuracy: number): Promise<WeaponCombatStats> {
    try {
      const stats = await this.weaponRepository.getWeaponCombatStats(weaponItemId, playerAccuracy);

      return {
        weapon: stats.weapon,
        adjusted_bands: {
          deg_injure: stats.adjustedBands.deg_injure,
          deg_miss: stats.adjustedBands.deg_miss,
          deg_graze: stats.adjustedBands.deg_graze,
          deg_normal: stats.adjustedBands.deg_normal,
          deg_crit: stats.adjustedBands.deg_crit,
          total_degrees: stats.adjustedBands.total_degrees
        },
        expected_damage_multiplier: stats.expectedDamageMultiplier
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Create weapon timing data when weapon item is created
   * - Uses WeaponRepository with MVP0 constraints
   * - Only single_arc pattern allowed
   * - Default hit bands and spin speed
   */
  async createWeaponData(itemId: string): Promise<any> {
    try {
      return await this.weaponRepository.createWeapon({
        item_id: itemId,
        pattern: 'single_arc', // MVP0 constraint
        spin_deg_per_s: 360.0, // Default spin speed
        deg_injure: 5.0,
        deg_miss: 45.0,
        deg_graze: 60.0,
        deg_normal: 200.0,
        deg_crit: 50.0
      });
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Create pet record when pet item is created
   * - Uses PetRepository for pet creation
   * - Validates item category is 'pet'
   */
  async createPetData(itemId: string): Promise<any> {
    try {
      return await this.petRepository.createPet(itemId);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Set pet personality and optional custom name
   * - Uses PetRepository with validation
   * - Validates custom name if provided
   */
  async assignPetPersonality(
    itemId: string,
    userId: string,
    personalityId: string,
    customName?: string
  ): Promise<void> {
    try {
      // Validate ownership first by trying to find the item
      const existingItem = await this.itemRepository.findById(itemId, userId);
      if (!existingItem) {
        throw new NotFoundError('Item', itemId);
      }

      await this.petRepository.updatePetPersonality(itemId, personalityId, customName);

      // Add history event
      await this.addHistoryEvent(itemId, userId, 'personality_assigned', {
        personality_id: personalityId,
        custom_name: customName
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Add dialogue to pet chatter history with size limits
   * - Uses PetRepository with automatic truncation
   * - Validates ownership
   */
  async updatePetChatter(
    itemId: string,
    userId: string,
    message: ChatterMessage
  ): Promise<void> {
    try {
      // Validate ownership first by trying to find the item
      const existingItem = await this.itemRepository.findById(itemId, userId);
      if (!existingItem) {
        throw new NotFoundError('Item', itemId);
      }

      await this.petRepository.addChatterMessage(itemId, message, 50); // Max 50 messages

      // Add history event
      await this.addHistoryEvent(itemId, userId, 'chatter_updated', {
        message_preview: message.text.substring(0, 50) + (message.text.length > 50 ? '...' : '')
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Create starter item for new user registration
   * - Selects random common rarity item type
   * - Creates item at level 1 with no materials
   * - Adds creation history event
   * - Creates weapon/pet data if applicable
   */
  async initializeStarterInventory(userId: string): Promise<ItemWithDetails> {
    try {
      // Get random common rarity item type
      const { data: itemTypes, error } = await supabase
        .from('itemtypes')
        .select('*')
        .eq('rarity', 'common')
        .limit(10);

      if (error || !itemTypes || itemTypes.length === 0) {
        throw new BusinessLogicError('No common item types available for starter inventory');
      }

      // Select random item type
      const randomIndex = Math.floor(Math.random() * itemTypes.length);
      const selectedItemType = itemTypes[randomIndex];

      return await this.createItem(userId, selectedItemType.id, 1);
    } catch (error) {
      if (error instanceof BusinessLogicError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Transform repository ItemWithDetails to API Item type
   */
  private transformToApiItem(itemData: ItemWithDetails): Item {
    return {
      id: itemData.id,
      user_id: itemData.user_id,
      item_type_id: itemData.item_type_id,
      level: itemData.level,
      base_stats: itemData.item_type.base_stats_normalized,
      current_stats: itemData.current_stats || itemData.item_type.base_stats_normalized,
      material_combo_hash: itemData.material_combo_hash || undefined,
      image_url: itemData.generated_image_url || undefined,
      materials: itemData.materials || [],
      item_type: {
        id: itemData.item_type.id,
        name: itemData.item_type.name,
        category: itemData.item_type.category as any,
        equipment_slot: itemData.item_type.category as any,
        base_stats: itemData.item_type.base_stats_normalized,
        rarity: itemData.item_type.rarity as Rarity,
        description: itemData.item_type.description
      },
      created_at: itemData.created_at,
      updated_at: itemData.created_at // Repository doesn't track updated_at separately
    };
  }
}

export const itemService = new ItemService();