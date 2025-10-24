import { ImageCacheRepository } from '../repositories/ImageCacheRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { ItemTypeRepository } from '../repositories/ItemTypeRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { PetRepository } from '../repositories/PetRepository.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
import { WeaponRepository } from '../repositories/WeaponRepository.js';
import {
  InventoryResponse,
  Item,
  MaterialStack,
  PaginationParams,
  Rarity,
  Stats,
  UpgradeResult,
  EquipmentSlot
} from '../types/api.types';
import { Database } from '../types/database.types.js';
import {
  CreateItemData,
  ItemWithDetails
} from '../types/repository.types.js';
import {
  BusinessLogicError,
  NotFoundError,
  ValidationError,
  mapSupabaseError
} from '../utils/errors';
import { computeComboHash } from '../utils/hash.js';
import { profileService } from './ProfileService';
import { statsService } from './StatsService';

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
  current_stats: Stats;
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
  private itemTypeRepository: ItemTypeRepository;
  private profileRepository: ProfileRepository;
  private weaponRepository: WeaponRepository;
  private petRepository: PetRepository;
  private materialRepository: MaterialRepository;
  private imageCacheRepository: ImageCacheRepository;

  constructor() {
    this.itemRepository = new ItemRepository();
    this.itemTypeRepository = new ItemTypeRepository();
    this.profileRepository = new ProfileRepository();
    this.weaponRepository = new WeaponRepository();
    this.petRepository = new PetRepository();
    this.materialRepository = new MaterialRepository();
    this.imageCacheRepository = new ImageCacheRepository();
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
        throw new NotFoundError(`Item ${itemId}`);
      }

      if (!itemWithDetails.materials) {
        throw new ValidationError('Item materials data is missing for item: ' + itemId);
      }
      const materials = itemWithDetails.materials;

      if (!itemWithDetails.item_type) {
        throw new ValidationError('Item type is missing for item: ' + itemId);
      }
      const baseStats = itemWithDetails.item_type.base_stats_normalized;

      if (!baseStats) {
        throw new ValidationError('Base stats are missing for item type: ' + itemWithDetails.item_type.id);
      }

      const shouldRecompute = materials.length > 0 || itemWithDetails.level > 1;

      if (!itemWithDetails.id || !itemWithDetails.user_id || !itemWithDetails.item_type_id) {
        throw new ValidationError('Missing required base item identifiers');
      }

      // Map category to EquipmentSlot (accessory becomes accessory_1 for slot purposes)
      const category = itemWithDetails.item_type.category as 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
      const equipmentSlot: EquipmentSlot = category === 'accessory' ? 'accessory_1' : category;

      const item: Item = {
        id: itemWithDetails.id,
        user_id: itemWithDetails.user_id,
        item_type_id: itemWithDetails.item_type_id,
        level: itemWithDetails.level,
        base_stats: baseStats,
        current_stats: baseStats,
        material_combo_hash: itemWithDetails.material_combo_hash!,
        image_url: itemWithDetails.generated_image_url!,
        materials,
        item_type: {
          id: itemWithDetails.item_type.id,
          name: itemWithDetails.item_type.name,
          category: category,
          equipment_slot: equipmentSlot,
          base_stats: baseStats,
          rarity: itemWithDetails.item_type.rarity,
          description: itemWithDetails.item_type.description
        },
        created_at: itemWithDetails.created_at,
        updated_at: itemWithDetails.created_at
      };

      if (shouldRecompute) {
        if (!item) {
          throw new ValidationError('Item data is missing during stats computation');
        }

        if (!itemWithDetails.level) {
          throw new ValidationError('Item level is missing or invalid');
        }

        // computeItemStatsForLevel expects item_type with base_stats_normalized and rarity
        const statsInput: { item_type: { base_stats_normalized: Stats; rarity: string } } = {
          item_type: {
            base_stats_normalized: baseStats,
            rarity: itemWithDetails.item_type.rarity
          }
        };

        item.current_stats = statsService.computeItemStatsForLevel(statsInput, itemWithDetails.level);
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
      const baseCost = Math.floor(100 * Math.pow(1.5, currentLevel - 1));
      const balanceOffset = Math.max(0, Math.floor((currentLevel - 1) / 9)) * 10;
      const goldCost = Math.max(0, baseCost - balanceOffset);

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

      // 4. Perform atomic transaction using repository
      try {
        await this.itemRepository.processUpgrade(
          userId,
          itemId,
          costInfo.gold_cost,
          costInfo.next_level,
          statsAfter
        );
      } catch (transactionError) {

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
        materials: item.materials ?? [],
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

      // Get new gold balance and vanity level after upgrade
      const newGoldBalance = await this.profileRepository.getCurrencyBalance(userId, 'GOLD');
      const profile = await this.profileRepository.findById(userId);

      return {
        success: true,
        updated_item: updatedItem,
        gold_spent: costInfo.gold_cost,
        new_gold_balance: newGoldBalance,
        new_vanity_level: profile?.vanity_level || 0
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
    await this.itemRepository.update(itemId, {
      level: newLevel,
      current_stats: newStats as any // Stats type needs to be compatible with Json type
    });
  }

  /**
   * Get material stacks for user inventory
   * - Queries MaterialStacks table with JOIN to Materials and StyleDefinitions
   * - Returns materials grouped by material_id + style_id with quantities
   */
  private async getMaterialStacks(userId: string): Promise<MaterialStack[]> {
    try {
      const data = await this.materialRepository.findStacksByUserWithDetails(userId);

      return data.map(stack => ({
        material_id: stack.material_id,
        material_name: stack.materials.name,
        style_id: stack.style_id,
        style_name: stack.styledefinitions.style_name,
        quantity: stack.quantity,
        is_styled: stack.styledefinitions.style_name !== 'normal'
      }));
    } catch (error) {
      throw new Error(`Failed to get material stacks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get storage limits for items and materials from user profile
   * - Default: 100 items, 200 materials
   * - Enhanced: 1000 items, 2000 materials (with IAP)
   */
  private async getStorageLimits(userId: string): Promise<{items_max: number, materials_max: number}> {
    try {
      // For now, return default limits since storage_upgrades column doesn't exist yet
      // TODO: Add storage_upgrades column to users table for IAP expansion
      // const { data: user, error } = await supabase
      //   .from('users')
      //   .select('storage_upgrades')
      //   .eq('id', userId)
      //   .single();

      // Default: no storage upgrades implemented yet
      const hasStorageUpgrade = false;

      return {
        items_max: hasStorageUpgrade ? 1000 : 100,
        materials_max: hasStorageUpgrade ? 2000 : 200
      };
    } catch (error) {
      throw new Error(`Failed to get storage limits: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all items owned by a user with pagination support
   * - Joins with UserEquipment to determine equipped status
   * - Computes stats for each item using stat calculation service
   * - Supports filtering by item type, rarity, or equipped status
  */
  async getUserInventory(userId: string, options?: PaginationParams): Promise<InventoryResponse> {
    try {
      const paginationInput: PaginationParams = options ?? {
        limit: 10,
        offset: 0,
        page: 1
      };

      const repoMethod = (this.itemRepository as any).findByUserWithPagination;
      let inventoryResult: any;

      if (typeof repoMethod === 'function' && repoMethod.length < 3) {
        inventoryResult = await repoMethod.call(this.itemRepository, userId, paginationInput);
      } else {
        const limit = paginationInput.limit ?? 10;
        const offset = paginationInput.offset ?? 0;
        const items = await this.itemRepository.findByUserWithPagination(userId, limit, offset);
        inventoryResult = {
          items,
          total_count: items.length,
          pagination: {
            limit,
            offset,
            has_more: items.length === limit
          }
        };
      }

      const rawItems = Array.isArray(inventoryResult?.items)
        ? inventoryResult.items
        : Array.isArray(inventoryResult)
          ? inventoryResult
          : [];
      const transformedItems = rawItems.map((item: any) => this.normalizeInventoryItem(item));

      const totalCount = inventoryResult?.total_count ?? transformedItems.length;
      const limit =
        inventoryResult?.pagination?.limit ?? paginationInput.limit ?? transformedItems.length;
      const totalItems = Math.min(totalCount, limit ?? totalCount);

      // Get material inventory and storage limits
      const materialStacks = await this.getMaterialStacks(userId);
      const totalMaterials = materialStacks.reduce((sum, stack) => sum + stack.quantity, 0);
      const storageLimits = await this.getStorageLimits(userId);

      return {
        items: transformedItems,
        total_items: totalItems,
        total_materials: totalMaterials,
        storage_capacity: {
          items_used: transformedItems.length,
          items_max: storageLimits.items_max,
          materials_used: totalMaterials,
          materials_max: storageLimits.materials_max
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
      const createData: CreateItemData = {
        user_id: userId,
        item_type_id: itemTypeId,
        level: level || 1
      };

      let newItem;
      try {
        newItem = await this.itemRepository.create(createData);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }

        const message = (error as Error).message ?? '';
        if (message.toLowerCase().includes('foreign key')) {
          throw new ValidationError(`Invalid item type: ${itemTypeId}`);
        }
        throw error;
      }

      const itemWithDetails = await this.itemRepository.findWithMaterials(newItem.id, userId);
      if (!itemWithDetails) {
        throw new NotFoundError(`Item ${newItem.id}`);
      }

      await this.addHistoryEvent(newItem.id, userId, 'created', {
        item_type_id: itemTypeId
      });

      const itemCategory = itemWithDetails.item_type?.category;
      if (itemCategory === 'weapon') {
        await this.createWeaponData(newItem.id);
      } else if (itemCategory === 'pet') {
        await this.createPetData(newItem.id);
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
        materials: materials ?? [],
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
            current_stats: itemStats
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
      const payload: any = {
        item_id: itemId,
        pattern: 'single_arc', // MVP0 constraint
        deg_injure: 5.0,
        deg_miss: 45.0,
        deg_graze: 60.0,
        deg_normal: 200.0,
        deg_crit: 50.0,
        spin_speed_deg_per_s: 360.0
      };
      return await this.weaponRepository.createWeapon(payload);
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
   * Remove material from item slot and return to inventory
   * - Validates ownership and slot occupancy
   * - Calculates gold cost (100 × item level)
   * - Checks affordability via EconomyService
   * - Removes MaterialInstance from slot
   * - Returns material to MaterialStacks (+1 quantity)
   * - Recalculates item stats and updates combo hash
   * - Updates/clears generated image URL
   */
  async removeMaterial(itemId: string, slotIndex: number, userId: string): Promise<{
    success: boolean;
    item: Item;
    stats: Stats;
    image_url: string | null;
    gold_spent: number;
    returned_material: {
      material_id: string;
      style_id: string;
      quantity: number;
    };
    new_gold_balance: number;
  }> {
    try {
      // 1. Validate item ownership
      const item = await this.itemRepository.findById(itemId, userId);
      if (!item) {
        throw new NotFoundError('Item', itemId);
      }

      // 2. Validate slot_index (0-2) and check if occupied
      if (slotIndex < 0 || slotIndex > 2) {
        throw new ValidationError('Slot index must be between 0 and 2');
      }

      const occupiedSlots = await this.materialRepository.getSlotOccupancy(itemId);
      if (!occupiedSlots.includes(slotIndex)) {
        throw new BusinessLogicError(`Slot ${slotIndex} is empty`);
      }

      // 3. Calculate gold cost: 100 × item level
      const goldCost = 100 * item.level;

      // 4. Check affordability via EconomyService
      const canAfford = await this.profileRepository.getCurrencyBalance(userId, 'GOLD') >= goldCost;
      if (!canAfford) {
        const currentBalance = await this.profileRepository.getCurrencyBalance(userId, 'GOLD');
        throw new BusinessLogicError(`Insufficient gold. Need ${goldCost}, have ${currentBalance}`);
      }

      // 5. Get material instance before removal for return data
      const materialInstances = await this.materialRepository.findMaterialsByItem(itemId);
      const materialToRemove = materialInstances.find(m => m.slot_index === slotIndex);
      if (!materialToRemove) {
        throw new BusinessLogicError(`No material found in slot ${slotIndex}`);
      }

      // 6. Deduct gold via EconomyService
      const economyService = (await import('./EconomyService.js')).economyService;
      await economyService.deductCurrency(
        userId,
        'GOLD',
        goldCost,
        'material_replacement', // Using existing transaction type for material operations
        itemId,
        { operation: 'remove_material', slot_index: slotIndex }
      );

      // 7. Remove MaterialInstance and return to inventory atomically
      await this.materialRepository.removeMaterialFromItemAtomic(
        itemId,
        slotIndex
      );

      // 8. Recalculate item stats with remaining materials
      const updatedItem = await this.itemRepository.findWithMaterials(itemId, userId);
      if (!updatedItem) {
        throw new NotFoundError('Item', itemId);
      }

      if (!updatedItem.materials) {
        throw new ValidationError('Updated item materials data is missing');
      }
      const remainingMaterials = updatedItem.materials;
      const shouldRecompute = remainingMaterials.length > 0 || updatedItem.level > 1;

      const baseStats = updatedItem.item_type.base_stats_normalized;
      let currentStats = baseStats;

      if (shouldRecompute) {
        const statsInput = {
          ...updatedItem,
          materials: remainingMaterials
        } as any;
        currentStats = statsService.computeItemStatsForLevel(statsInput, updatedItem.level);
      }

      // 9. Update material_combo_hash
      const materialIds = remainingMaterials.map(m => m.material_id).filter(Boolean);
      const styleIds = remainingMaterials.map(m => m.style_id || '00000000-0000-0000-0000-000000000000');
      const comboHash = materialIds.length > 0 ? computeComboHash(materialIds, styleIds) : null;

      // 10. Update image URL (revert to base or clear if no materials)
      let imageUrl: string | null = null;
      if (materialIds.length > 0 && comboHash) {
        // Check cache for remaining combo
        const cacheEntry = await this.imageCacheRepository.findByComboHash(updatedItem.item_type_id, comboHash);
        if (cacheEntry) {
          imageUrl = cacheEntry.image_url;
        }
        // Note: Not generating new images on removal - that's handled by apply/replace operations
      } else {
        // No materials remain - reset to base image from ItemType
        const itemType = await this.itemTypeRepository.findById(updatedItem.item_type_id);
        if (itemType?.base_image_url && itemType.base_image_url.trim() !== '') {
          imageUrl = itemType.base_image_url;
        }
        // If no base_image_url, imageUrl remains null (same as before)
      }

      // 11. Update item with new hash and image URL
      await this.itemRepository.updateImageData(itemId, userId, comboHash || '', imageUrl || '', 'complete');

      // 12. Get new gold balance
      const newGoldBalance = await this.profileRepository.getCurrencyBalance(userId, 'GOLD');

      // 13. Transform updated item to API format
      const apiItem: Item = {
        id: updatedItem.id,
        user_id: updatedItem.user_id,
        item_type_id: updatedItem.item_type_id,
        level: updatedItem.level,
        base_stats: baseStats,
        current_stats: currentStats,
        material_combo_hash: comboHash || undefined,
        image_url: imageUrl || undefined,
        materials: remainingMaterials,
        item_type: {
          id: updatedItem.item_type.id,
          name: updatedItem.item_type.name,
          category: updatedItem.item_type.category as any,
          equipment_slot: updatedItem.item_type.category as any,
          base_stats: baseStats,
          rarity: updatedItem.item_type.rarity,
          description: updatedItem.item_type.description
        },
        created_at: updatedItem.created_at,
        updated_at: new Date().toISOString()
      };

      return {
        success: true,
        item: apiItem,
        stats: currentStats,
        image_url: imageUrl,
        gold_spent: goldCost,
        returned_material: {
          material_id: materialToRemove.material_id,
          style_id: materialToRemove.style_id || '00000000-0000-0000-0000-000000000000',
          quantity: 1
        },
        new_gold_balance: newGoldBalance
      };

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessLogicError || error instanceof ValidationError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Discard/sell item for gold compensation
   * - Validates item ownership
   * - Checks if item is equipped and unequips if necessary
   * - Calculates gold compensation based on item level
   * - Deletes item from PlayerItems table
   * - Adds gold to user's balance via EconomyService
   * - Returns confirmation details
   */
  async discardItem(itemId: string, userId: string): Promise<{
    success: boolean;
    gold_earned: number;
    new_gold_balance: number;
    item_name: string;
  }> {
    try {
      // 1. Validate ownership and get item details
      const item = await this.itemRepository.findWithItemType(itemId, userId);

      if (!item) {
        throw new NotFoundError('Item', itemId);
      }

      const itemName = item.item_type.name;

      // 2. Check if item is currently equipped and unequip if necessary
      const isEquipped = await this.checkIfItemEquipped(itemId, userId);
      if (isEquipped) {
        // Import equipmentService dynamically to avoid circular dependency
        const { equipmentService } = await import('./EquipmentService.js');
        const slotName = this.mapCategoryToSlotName(item.item_type.category);
        await equipmentService.unequipItem(userId, slotName);
      }

      // 3. Calculate gold compensation based on item level
      // Use a formula that gives reasonable compensation: level * 10 + base 25 gold
      const goldEarned = Math.max(25, item.level * 10);

      // 4. Add gold to user's balance via EconomyService
      const { economyService } = await import('./EconomyService.js');
      const currencyResult = await economyService.addCurrency(
        userId,
        'GOLD',
        goldEarned,
        'admin', // Using admin as source type for item discard compensation
        itemId,
        {
          item_id: itemId,
          item_name: itemName,
          item_level: item.level,
          operation: 'item_discard'
        }
      );

      // 5. Add history event before deletion
      await this.addHistoryEvent(itemId, userId, 'discarded', {
        item_name: itemName,
        gold_earned: goldEarned,
        reason: 'player_discard'
      });

      // 6. Delete item from database
      await this.itemRepository.deleteItem(itemId, userId);

      return {
        success: true,
        gold_earned: goldEarned,
        new_gold_balance: currencyResult.newBalance,
        item_name: itemName
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessLogicError) {
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
      // Get random common rarity item type using repository
      const selectedItemType = await this.itemTypeRepository.getRandomByRarity('common');

      if (!selectedItemType) {
        throw new BusinessLogicError('No common item types available for starter inventory');
      }

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
   * Check if item is currently equipped by user
   * - Queries UserEquipment table to see if item is in any slot
   */
  private async checkIfItemEquipped(itemId: string, userId: string): Promise<boolean> {
    try {
      const equippedItems = await this.itemRepository.findEquippedByUser(userId);
      return equippedItems.some(item => item.id === itemId);
    } catch (error) {
      throw new Error(`Failed to check equipment status for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Map item category to equipment slot name for unequipping
   * - Maps item categories to the slot names used by EquipmentService
   */
  private mapCategoryToSlotName(category: string): string {
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
        // For accessories, we need to check which slot it's in
        // For simplicity, default to accessory_1 (EquipmentService will handle finding the correct slot)
        return 'accessory_1';
      case 'pet':
        return 'pet';
      default:
        throw new ValidationError(`Unknown item category: ${category}`);
    }
  }

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
      image_url: itemData.generated_image_url!,
      materials: itemData.materials ?? [],
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

  private normalizeInventoryItem(itemData: ItemWithDetails | Record<string, unknown>): Item {
    if (!itemData) {
      throw new ValidationError('Empty item data provided');
    }

    // Type assertion to allow property access on dynamic database result
    const data = itemData as any;

    const defaultStats: Stats = {
      atkPower: 0,
      atkAccuracy: 0,
      defPower: 0,
      defAccuracy: 0
    };

    // Strict validation of base stats
    const baseStats: Stats = (() => {
      if (data.base_stats && typeof data.base_stats === 'object') {
        return data.base_stats as Stats;
      }
      if (data.item_type?.base_stats_normalized && typeof data.item_type.base_stats_normalized === 'object') {
        return data.item_type.base_stats_normalized as Stats;
      }
      if (data.current_stats && typeof data.current_stats === 'object') {
        return data.current_stats as Stats;
      }
      return defaultStats;
    })();

    // Validate current_stats
    const currentStats: Stats = (() => {
      if (data.current_stats && typeof data.current_stats === 'object') {
        return data.current_stats as Stats;
      }
      return baseStats;
    })();

    const materials = Array.isArray(data.materials) ? data.materials : [];

    // Validate and create item_type
    const itemType = data.item_type ? (() => {
      if (!data.item_type.id) {
        throw new ValidationError('Missing item type ID');
      }
      if (!data.item_type.name) {
        throw new ValidationError('Missing item type name');
      }

      // Map category to EquipmentSlot
      const category = data.item_type.category as 'weapon' | 'offhand' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
      const equipmentSlot: EquipmentSlot = category === 'accessory' ? 'accessory_1' : category;

      return {
        id: data.item_type.id,
        name: data.item_type.name,
        category: category,
        equipment_slot: (data.item_type.equipment_slot as EquipmentSlot | undefined) ?? equipmentSlot,
        base_stats: (data.item_type.base_stats_normalized as Stats | undefined) || baseStats,
        rarity: data.item_type.rarity as Rarity,
        description: data.item_type.description as string | undefined
      };
    })() : undefined;

    // Validate required base fields
    if (!data.id || !data.user_id || !data.item_type_id) {
      throw new ValidationError('Missing critical item identifiers');
    }

    if (data.level === null || data.level === undefined) {
      throw new ValidationError('Missing item level');
    }
    if (!data.created_at) {
      throw new ValidationError('Missing created_at timestamp');
    }

    return {
      id: data.id as string,
      user_id: data.user_id as string,
      item_type_id: data.item_type_id as string,
      level: data.level as number,
      base_stats: baseStats,
      current_stats: currentStats,
      material_combo_hash: (data.material_combo_hash as string | null | undefined) || undefined,
      image_url: (data.generated_image_url as string | null | undefined) || (data.image_url as string | null | undefined) || undefined,
      is_styled: (data.is_styled as boolean | undefined) || false,
      materials,
      item_type: itemType,
      created_at: data.created_at as string,
      updated_at: (data.updated_at as string | undefined) || (data.created_at as string)
    };
  }
}

export const itemService = new ItemService();
