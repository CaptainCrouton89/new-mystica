/**
 * ItemRepository - Repository for managing player items
 *
 * Handles CRUD operations for player-owned items with complex joins to
 * ItemTypes for base stats and ItemMaterials → MaterialInstances → Materials
 * for applied material data.
 *
 * Key responsibilities:
 * - Item CRUD operations with ownership validation
 * - Complex joins to ItemTypes for base stats
 * - Item level management and stat computation
 * - Item history audit trail
 * - Image generation metadata (combo_hash, image_url, generation_status)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Stats } from '../types/api.types.js';
import { Database } from '../types/database.types.js';
import {
  CreateItemData,
  ItemWithDetails,
  UpdateItemData
} from '../types/repository.types.js';
import { DatabaseError, ValidationError } from '../utils/errors.js';
import { computeComboHash } from '../utils/hash.js';
import { BaseRepository } from './BaseRepository.js';

// Database row types
type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemTypeRow = Database['public']['Tables']['itemtypes']['Row'];
type ItemHistoryRow = Database['public']['Tables']['itemhistory']['Row'];

// Supabase generated Insert/Update types - use these for strong typing
type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];
type ItemHistoryInsert = Database['public']['Tables']['itemhistory']['Insert'];

/**
 * Item history event entry
 *
 * Represents a historical event log entry for an item.
 * event_data is serialized JSON and should be parsed by callers as needed.
 */
export interface ItemHistoryEvent {
  id: string;
  item_id: string;
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Repository for managing player items with advanced querying capabilities
 */
export class ItemRepository extends BaseRepository<ItemRow> {
  constructor(client?: SupabaseClient) {
    super('items', client);
  }

  // ============================================================================
  // Basic CRUD Operations
  // ============================================================================

  /**
   * Find item by ID with optional ownership validation
   *
   * @param itemId - Item ID to find
   * @param userId - Optional user ID to validate ownership
   * @returns Item data or null if not found
   * @throws NotFoundError if not found or ownership validation fails
   * @throws DatabaseError on query failure
   */
  async findById(itemId: string, userId?: string): Promise<ItemRow | null> {
    if (userId) {
      // Use validateOwnership for security when userId provided
      return await this.validateOwnership(itemId, userId);
    }

    return await super.findById(itemId);
  }

  /**
   * Find all items owned by a user
   *
   * @param userId - User ID to find items for
   * @returns Array of user's items
   * @throws DatabaseError on query failure
   */
  async findByUser(userId: string): Promise<ItemRow[]> {
    return await this.findMany({ user_id: userId });
  }

  /**
   * Create a new item for a user
   *
   * @param itemData - Item creation data (user_id, item_type_id, level optional)
   * @returns Created item with all fields
   * @throws DatabaseError if ItemType not found or insertion fails
   *
   * Auto-populated fields:
   * - level: defaults to 1 if not provided
   * - is_styled: defaults to false
   * - current_stats: null (computed later)
   * - material_combo_hash: hash of empty materials
   * - generated_image_url: base_image_url from ItemType
   * - image_generation_status: null (set to 'pending' when generation starts)
   */
  async create(itemData: CreateItemData): Promise<ItemRow> {
    // First, fetch the base_image_url from ItemTypes
    const itemType = await this.findItemTypeById(itemData.item_type_id);
    if (!itemType) {
      throw new DatabaseError(`ItemType not found: ${itemData.item_type_id}`);
    }

    // Use base_image_url if available and not empty, otherwise null
    const baseImageUrl = itemType.base_image_url && itemType.base_image_url.trim() !== ''
      ? itemType.base_image_url
      : null;

    // Compute initial material_combo_hash for items with no materials
    // This ensures all items have a valid hash, even if they haven't had materials applied yet
    const initialComboHash = computeComboHash([], []);

    // Use strongly-typed ItemInsert from Supabase schema
    const insertData: ItemInsert = {
      user_id: itemData.user_id,
      item_type_id: itemData.item_type_id,
      level: itemData.level || 1,
      is_styled: false,
      current_stats: null,
      material_combo_hash: initialComboHash,
      generated_image_url: baseImageUrl,
      image_generation_status: null
    };

    return await super.create(insertData);
  }

  /**
   * Update item data with ownership validation
   *
   * @param itemId - Item ID to update
   * @param userId - User ID for ownership validation
   * @param data - Fields to update (use UpdateItemData interface for type hints)
   * @returns Updated item with modified fields
   * @throws NotFoundError if item not found or wrong owner
   * @throws DatabaseError on update failure
   *
   * Type-safe updates using Supabase's ItemUpdate type:
   * - Only fields in UpdateItemData can be modified
   * - current_stats accepts Stats object (auto-stringified by Supabase)
   * - All optional fields can be omitted
   */
  async updateItem(itemId: string, userId: string, data: UpdateItemData): Promise<ItemRow> {
    // Validate ownership first
    await this.validateOwnership(itemId, userId);

    // Use strongly-typed ItemUpdate from Supabase schema
    // Note: Supabase client handles JSON stringification for current_stats field
    const updateData: ItemUpdate = {
      ...data,
      // current_stats field accepts Stats object; Supabase auto-serializes it
      current_stats: data.current_stats as any
    };

    return await super.update(itemId, updateData);
  }

  /**
   * Delete item with ownership validation
   *
   * @param itemId - Item ID to delete
   * @param userId - User ID for ownership validation
   * @returns true if deleted, false if not found
   * @throws NotFoundError if item not found or wrong owner
   * @throws DatabaseError on delete failure
   */
  async deleteItem(itemId: string, userId: string): Promise<boolean> {
    // Validate ownership first
    await this.validateOwnership(itemId, userId);

    return await super.delete(itemId);
  }

  // ============================================================================
  // Complex Query Operations (N+1 Prevention with Nested Select)
  // ============================================================================

  /**
   * Find item with complete details including materials and item type
   * Uses single nested query to prevent N+1 performance issues
   *
   * @param itemId - Item ID to find
   * @param userId - Optional user ID for ownership validation
   * @returns Complete item details or null if not found
   * @throws NotFoundError if not found or ownership validation fails
   * @throws DatabaseError on query failure
   */
  async findWithMaterials(itemId: string, userId?: string): Promise<ItemWithDetails | null> {
    let query = this.client
      .from('items')
      .select(`
        id,
        user_id,
        item_type_id,
        level,
        is_styled,
        current_stats,
        material_combo_hash,
        generated_image_url,
        image_generation_status,
        created_at,
        name,
        description,
        itemtypes (
          id,
          name,
          category,
          base_stats_normalized,
          rarity,
          description
        ),
        itemmaterials (
          id,
          slot_index,
          applied_at,
          material_instance_id,
          materialinstances:material_instance_id (
            id,
            material_id,
            style_id,
            created_at,
            materials (
              id,
              name,
              description,
              base_drop_weight,
              stat_modifiers
            ),
            styledefinitions (
              id,
              display_name
            )
          )
        )
      `)
      .eq('id', itemId);

    // Add ownership filter if userId provided
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(`Failed to fetch item with materials: ${itemId}`, error);
    }

    // Transform the nested data structure
    return this.transformToItemWithDetails(data);
  }

  /**
   * Find item with basic item type information (lighter query)
   *
   * @param itemId - Item ID to find
   * @param userId - Optional user ID for ownership validation
   * @returns Item with type details or null if not found
   * @throws DatabaseError on query failure
   */
  async findWithItemType(itemId: string, userId?: string): Promise<ItemWithDetails | null> {
    let query = this.client
      .from('items')
      .select(`
        id,
        user_id,
        item_type_id,
        level,
        is_styled,
        current_stats,
        material_combo_hash,
        generated_image_url,
        image_generation_status,
        created_at,
        name,
        description,
        itemtypes (
          id,
          name,
          category,
          base_stats_normalized,
          rarity,
          description
        )
      `)
      .eq('id', itemId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(`Failed to fetch item with type: ${itemId}`, error);
    }

    // Transform without materials
    return this.transformToItemWithDetails(data, false);
  }

  /**
   * Find all equipped items for a user
   * Joins with UserEquipment table to find currently equipped items
   *
   * @param userId - User ID to find equipped items for
   * @returns Array of equipped items with details
   * @throws DatabaseError on query failure
   */
  async findEquippedByUser(userId: string): Promise<ItemWithDetails[]> {
    const { data, error } = await this.client
      .from('items')
      .select(`
        id,
        user_id,
        item_type_id,
        level,
        is_styled,
        current_stats,
        material_combo_hash,
        generated_image_url,
        image_generation_status,
        created_at,
        name,
        description,
        itemtypes (
          id,
          name,
          category,
          base_stats_normalized,
          rarity,
          description
        ),
        userequipment!inner (
          slot_name,
          equipped_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw new DatabaseError(`Failed to fetch equipped items for user: ${userId}`, error);
    }

    if (!data) {
      throw new DatabaseError(`Failed to fetch equipped items for user: query returned no data`);
    }

    return data.map(item => this.transformToItemWithDetails(item, false));
  }

  /**
   * Find items by item type for a user
   *
   * @param userId - User ID to find items for
   * @param itemTypeId - Item type ID to filter by
   * @returns Array of matching items
   * @throws DatabaseError on query failure
   */
  async findByType(userId: string, itemTypeId: string): Promise<ItemRow[]> {
    return await this.findMany({
      user_id: userId,
      item_type_id: itemTypeId
    });
  }

  // ============================================================================
  // Level & Stats Management
  // ============================================================================

  /**
   * Update item level
   *
   * @param itemId - Item ID to update
   * @param userId - User ID for ownership validation
   * @param newLevel - New level value
   * @throws NotFoundError if item not found or wrong owner
   * @throws ValidationError if level is invalid
   * @throws DatabaseError on update failure
   */
  async updateLevel(itemId: string, userId: string, newLevel: number): Promise<void> {
    if (newLevel < 1) {
      throw new ValidationError('Item level must be at least 1');
    }

    await this.updateItem(itemId, userId, { level: newLevel });
  }

  /**
   * Update item current stats (computed stats including materials)
   *
   * @param itemId - Item ID to update
   * @param userId - User ID for ownership validation
   * @param stats - New stats object
   * @throws NotFoundError if item not found or wrong owner
   * @throws DatabaseError on update failure
   */
  async updateStats(itemId: string, userId: string, stats: Stats): Promise<void> {
    await this.updateItem(itemId, userId, { current_stats: stats },);
  }

  /**
   * Update image generation metadata atomically
   *
   * @param itemId - Item ID to update
   * @param userId - User ID for ownership validation
   * @param comboHash - Material combination hash
   * @param imageUrl - Generated image URL
   * @param status - Generation status
   * @throws NotFoundError if item not found or wrong owner
   * @throws DatabaseError on update failure
   */
  async updateImageData(
    itemId: string,
    userId: string,
    comboHash: string,
    imageUrl: string,
    status: 'pending' | 'generating' | 'complete' | 'failed'
  ): Promise<void> {
    await this.updateItem(itemId, userId, {
      material_combo_hash: comboHash,
      generated_image_url: imageUrl,
      image_generation_status: status
    });
  }

  /**
   * Update item name and description
   *
   * @param itemId - Item ID to update
   * @param userId - User ID for ownership validation
   * @param name - New item name
   * @param description - New item description
   * @returns Updated item with new fields
   * @throws NotFoundError if item not found or wrong owner
   * @throws DatabaseError on update failure
   */
  async updateItemNameDescription(
    itemId: string,
    userId: string,
    name: string,
    description: string
  ): Promise<ItemRow> {
    return await this.updateItem(itemId, userId, {
      name,
      description
    });
  }

  // ============================================================================
  // History Tracking
  // ============================================================================

  /**
   * Add history event for an item
   *
   * @param itemId - Item ID to log event for
   * @param userId - User ID for ownership validation
   * @param eventType - Type of event (e.g., 'level_up', 'material_applied', 'equipped')
   * @param eventData - Additional event metadata (optional, auto-serialized by Supabase)
   * @throws NotFoundError if item not found or wrong owner
   * @throws DatabaseError on insert failure
   *
   * Auto-populated fields:
   * - id: auto-generated UUID
   * - created_at: server timestamp
   */
  async addHistoryEvent(
    itemId: string,
    userId: string,
    eventType: string,
    eventData: any = null
  ): Promise<void> {
    // Validate ownership first
    await this.validateOwnership(itemId, userId);

    // Use strongly-typed ItemHistoryInsert from Supabase schema
    const historyEntry: ItemHistoryInsert = {
      item_id: itemId,
      user_id: userId,
      event_type: eventType,
      event_data: eventData
    };

    const { error } = await this.client
      .from('itemhistory')
      .insert(historyEntry);

    if (error) {
      throw new DatabaseError(`Failed to add item history event: ${itemId}`, error);
    }
  }

  /**
   * Get item history events
   *
   * @param itemId - Item ID to get history for
   * @param userId - User ID for ownership validation
   * @returns Array of history events ordered by created_at DESC
   * @throws NotFoundError if item not found or wrong owner
   * @throws DatabaseError on query failure
   */
  async getItemHistory(itemId: string, userId: string): Promise<ItemHistoryEvent[]> {
    // Validate ownership first
    await this.validateOwnership(itemId, userId);

    const { data, error } = await this.client
      .from('itemhistory')
      .select('*')
      .eq('item_id', itemId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch item history: ${itemId}`, error);
    }

    if (!data) {
      throw new DatabaseError(`Failed to fetch item history: query returned no data`);
    }

    return data as ItemHistoryEvent[];
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Find multiple items with complete details using single query
   *
   * @param itemIds - Array of item IDs to fetch
   * @param userId - Optional user ID for ownership filtering
   * @returns Array of items with complete details
   * @throws DatabaseError on query failure
   */
  async findManyWithDetails(itemIds: string[], userId?: string): Promise<ItemWithDetails[]> {
    if (itemIds.length === 0) {
      return [];
    }

    let query = this.client
      .from('items')
      .select(`
        id,
        user_id,
        item_type_id,
        level,
        is_styled,
        current_stats,
        material_combo_hash,
        generated_image_url,
        image_generation_status,
        created_at,
        name,
        description,
        itemtypes (
          id,
          name,
          category,
          base_stats_normalized,
          rarity,
          description
        ),
        itemmaterials (
          slot_index,
          applied_at,
          material_instance_id,
          materialinstances:material_instance_id (
            id,
            material_id,
            style_id,
            created_at,
            materials (
              id,
              name,
              description,
              stat_modifiers
            ),
            styledefinitions:style_id (
              id,
              display_name
            )
          )
        )
      `)
      .in('id', itemIds);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError('Failed to fetch multiple items with details', error);
    }

    if (!data) {
      throw new DatabaseError('Failed to fetch multiple items with details: query returned no data');
    }

    return data.map(item => this.transformToItemWithDetails(item));
  }

  /**
   * Find user items with pagination support
   *
   * @param userId - User ID to find items for
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @returns Array of user's items (paginated)
   * @throws DatabaseError on query failure
   */
  async findByUserWithPagination(
    userId: string,
    limit: number,
    offset: number
  ): Promise<ItemRow[]> {
    return await this.findMany(
      { user_id: userId },
      {
        pagination: { limit, offset },
        sort: { orderBy: 'created_at', ascending: false }
      }
    );
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Transform Supabase nested query result to ItemWithDetails interface
   *
   * @param data - Raw data from Supabase nested query
   * @param includeMaterials - Whether to include materials data
   * @returns Transformed ItemWithDetails object
   */
  private transformToItemWithDetails(data: any, includeMaterials: boolean = true): ItemWithDetails {
    // Parse current_stats if it's a string, otherwise use as-is (it's already an object from Supabase)
    let parsedStats = data.current_stats;
    if (data.current_stats && typeof data.current_stats === 'string') {
      try {
        parsedStats = JSON.parse(data.current_stats);
      } catch {
        parsedStats = data.current_stats; // If parsing fails, use the value as-is
      }
    }

    const item: ItemWithDetails = {
      id: data.id,
      user_id: data.user_id,
      item_type_id: data.item_type_id,
      level: data.level,
      is_styled: data.is_styled,
      current_stats: parsedStats,
      material_combo_hash: data.material_combo_hash,
      generated_image_url: data.generated_image_url,
      image_generation_status: data.image_generation_status,
      created_at: data.created_at,
      name: data.name,
      description: data.description,
      item_type: {
        id: data.itemtypes.id,
        name: data.itemtypes.name,
        category: data.itemtypes.category,
        base_stats_normalized: data.itemtypes.base_stats_normalized,
        rarity: data.itemtypes.rarity,
        description: data.itemtypes.description
      },
      materials: []
    };

    // Transform materials if included and available
    if (includeMaterials && data.itemmaterials) {
      interface ItemMaterialRow {
        id: string;
        slot_index: number;
        applied_at: string;
        material_instance_id: string;
        materialinstances: {
          id: string;
          material_id: string;
          materials: {
            id: string;
            name: string;
            description: string | null;
            base_drop_weight: number;
            stat_modifiers: Record<string, number>;
          };
          style_id: string;
          styledefinitions: {
            id: string;
            display_name: string;
          } | null;
        };
      }

      item.materials = data.itemmaterials.map((im: ItemMaterialRow) => ({
        id: im.id,
        material_id: im.materialinstances.material_id,
        style_id: im.materialinstances.style_id,
        display_name: im.materialinstances.styledefinitions?.display_name || undefined,
        slot_index: im.slot_index,
        material: {
          id: im.materialinstances.materials.id,
          name: im.materialinstances.materials.name,
          description: im.materialinstances.materials.description,
          base_drop_weight: im.materialinstances.materials.base_drop_weight,
          stat_modifiers: im.materialinstances.materials.stat_modifiers,
          style_id: im.materialinstances.style_id
        }
      }));
    }

    return item;
  }

  // ============================================================================
  // Item Type Operations
  // ============================================================================

  /**
   * Find item type by ID
   *
   * @param itemTypeId - Item type ID to find
   * @returns Item type data or null if not found
   * @throws DatabaseError on query failure
   */
  async findItemTypeById(itemTypeId: string): Promise<ItemTypeRow | null> {
    const { data, error } = await this.client
      .from('itemtypes')
      .select('*')
      .eq('id', itemTypeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(`Failed to fetch item type: ${itemTypeId}`, error);
    }

    return data as ItemTypeRow;
  }

  /**
   * Find item types by rarity
   *
   * @param rarity - Rarity level to filter by (e.g., 'common', 'rare', 'epic')
   * @returns Array of item types matching the rarity
   * @throws DatabaseError on query failure
   */
  async findItemTypesByRarity(rarity: string): Promise<ItemTypeRow[]> {
    const { data, error } = await this.client
      .from('itemtypes')
      .select('*')
      .eq('rarity', rarity);

    if (error) {
      throw new DatabaseError(`Failed to fetch item types by rarity: ${rarity}`, error);
    }

    if (!data) {
      throw new DatabaseError(`Failed to fetch item types by rarity: query returned no data`);
    }

    return data as ItemTypeRow[];
  }

  // ============================================================================
  // Atomic Transaction Operations (via RPC Functions)
  // ============================================================================

  /**
   * Process item upgrade atomically via RPC
   * RPC: process_item_upgrade(p_user_id, p_item_id, p_gold_cost, p_new_level, p_new_stats)
   *
   * This wraps the Supabase RPC call for atomic item upgrades that:
   * - Validates user ownership
   * - Deducts gold from user balance
   * - Updates item level and stats
   * - Records transaction history
   *
   * @param userId - User ID for ownership validation
   * @param itemId - Item ID to upgrade
   * @param goldCost - Gold cost for the upgrade
   * @param newLevel - New level after upgrade
   * @param newStats - New stats after upgrade
   * @returns RPC result or throws error
   * @throws DatabaseError on RPC failure or business logic violation
   */
  async processUpgrade(
    userId: string,
    itemId: string,
    goldCost: number,
    newLevel: number,
    newStats: any
  ): Promise<any> {
    const result = await this.rpc('process_item_upgrade', {
      p_user_id: userId,
      p_item_id: itemId,
      p_gold_cost: goldCost,
      p_new_level: newLevel,
      p_new_stats: newStats
    });

    return result;
  }
}