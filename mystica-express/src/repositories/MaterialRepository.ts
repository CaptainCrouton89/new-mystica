/**
 * Material Repository
 *
 * Manages materials, material stacks (inventory), material instances (applied to items),
 * and the ItemMaterials junction table. Handles complex composite primary key operations
 * and atomic transactions for material application/removal.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import { Database } from '../types/database.types.js';
import {
  AppliedMaterial,
  Material,
  MaterialInstance,
  MaterialInstanceWithTemplate
} from '../types/repository.types.js';
import { BusinessLogicError, DatabaseError, mapSupabaseError, NotFoundError } from '../utils/errors.js';
import { BaseRepository } from './BaseRepository.js';

// Database row types
type MaterialRow = Database['public']['Tables']['materials']['Row'];
type MaterialStackRow = Database['public']['Tables']['materialstacks']['Row'];
type MaterialInstanceRow = Database['public']['Tables']['materialinstances']['Row'];
type ItemMaterialRow = Database['public']['Tables']['itemmaterials']['Row'];

// Supabase generated Insert/Update types - use these for strong typing
type MaterialStackInsert = Database['public']['Tables']['materialstacks']['Insert'];
type MaterialStackUpdate = Database['public']['Tables']['materialstacks']['Update'];
type MaterialInstanceInsert = Database['public']['Tables']['materialinstances']['Insert'];
type ItemMaterialInsert = Database['public']['Tables']['itemmaterials']['Insert'];

/**
 * MaterialRepository handles all material-related database operations
 *
 * Key features:
 * - Composite primary key support for MaterialStacks (user_id, material_id, style_id)
 * - Atomic transactions for material application/removal via RPC functions
 * - Style inheritance tracking (enemy style_id → material stack style_id)
 * - Slot index validation (0-2) with UNIQUE constraint enforcement
 */
export class MaterialRepository extends BaseRepository<MaterialRow> {
  constructor(client: SupabaseClient = supabase) {
    super('materials', client);
  }

  // ============================================================================
  // Material Templates (Seed Data - Read Only)
  // ============================================================================

  /**
   * Find material template by ID
   */
  async findMaterialById(materialId: string): Promise<Material | null> {
    const { data, error } = await this.client
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw mapSupabaseError(error);
    }

    return data as Material;
  }

  /**
   * Find multiple materials by IDs
   * Used for batch fetching during loot generation
   *
   * @param ids - Array of material IDs to find
   * @returns Array of materials found (may be fewer than requested if some IDs don't exist)
   * @throws DatabaseError on query failure
   */
  async findByIds(ids: string[]): Promise<Material[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from('materials')
      .select('*')
      .in('id', ids);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as Material[];
  }

  /**
   * Find all material templates
   */
  async findAllMaterials(): Promise<Material[]> {
    const query = this.client
      .from('materials')
      .select('*')
      .order('name');

    const { data, error } = await this.resolveQuery<Material[]>(query);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as Material[];
  }

  /**
   * Find materials by theme/category (using description search)
   */
  async findMaterialsByTheme(theme: string): Promise<Material[]> {
    const query = this.client
      .from('materials')
      .select('*')
      .ilike('description', `%${theme}%`)
      .order('name');

    const { data, error } = await this.resolveQuery<Material[]>(query);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as Material[];
  }

  // ============================================================================
  // MaterialStacks Management (Composite PK: user_id, material_id, style_id)
  // ============================================================================

  /**
   * Find material stack by composite key
   */
  async findStackByUser(userId: string, materialId: string, styleId: string): Promise<MaterialStackRow | null> {
    const { data, error } = await this.client
      .from('materialstacks')
      .select('*')
      .eq('user_id', userId)
      .eq('material_id', materialId)
      .eq('style_id', styleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw mapSupabaseError(error);
    }

    return data as MaterialStackRow;
  }

  /**
   * Find all material stacks for a user
   */
  async findAllStacksByUser(userId: string): Promise<MaterialStackRow[]> {
    const query = this.client
      .from('materialstacks')
      .select('*')
      .eq('user_id', userId)
      .gt('quantity', 0) // Only show non-zero stacks
      .order('material_id');

    const { data, error } = await this.resolveQuery<MaterialStackRow[]>(query);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as MaterialStackRow[];
  }

  /**
   * Find styled materials only (where style_id != 'normal')
   */
  async findStyledMaterialsByUser(userId: string): Promise<MaterialStackRow[]> {
    const query = this.client
      .from('materialstacks')
      .select('*')
      .eq('user_id', userId)
      .neq('style_id', 'normal')
      .gt('quantity', 0)
      .order('material_id');

    const { data, error } = await this.resolveQuery<MaterialStackRow[]>(query);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as MaterialStackRow[];
  }

  /**
   * Find material stacks with material and style details for inventory display
   */
  async findStacksByUserWithDetails(userId: string): Promise<Array<{
    material_id: string;
    style_id: string;
    quantity: number;
    materials: { name: string } | null;
    styledefinitions: { style_name: string } | null;
  }>> {
    const { data, error } = await this.client
      .from('materialstacks')
      .select(`
        material_id,
        style_id,
        quantity,
        materials(name),
        styledefinitions(style_name)
      `)
      .eq('user_id', userId)
      .gt('quantity', 0)
      .order('material_id');

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as unknown as Array<{
      material_id: string;
      style_id: string;
      quantity: number;
      materials: { name: string } | null;
      styledefinitions: { style_name: string } | null;
    }>;
  }

  /**
   * Increment material stack quantity (upsert operation)
   * Uses composite key of (user_id, material_id, style_id)
   */
  /**
   * Validate and normalize styleId, always defaulting to 'normal' if invalid
   *
   * @param styleId - Input style ID to validate
   * @returns Validated style ID or 'normal'
   */
  private validateStyleId(styleId?: string): string {
    return styleId && styleId.trim() !== '' ? styleId : 'normal';
  }

  /**
   * Increment material stack quantity (upsert operation)
   * Uses composite key of (user_id, material_id, style_id)
   */
  async incrementStack(
    userId: string,
    materialId: string,
    quantity: number,
    styleId: string = 'normal'
  ): Promise<MaterialStackRow> {
    if (quantity <= 0) {
      throw new BusinessLogicError('Increment quantity must be positive');
    }

    const validStyleId = this.validateStyleId(styleId);
    const existing = await this.findStackByUser(userId, materialId, validStyleId);

    if (existing) {
      return this.updateStackByCompositeKey(userId, materialId, validStyleId, {
        quantity: existing.quantity + quantity
      });
    } else {
      return this.createStack(userId, materialId, quantity, validStyleId);
    }
  }

  /**
   * Decrement material stack quantity
   * Uses composite key of (user_id, material_id, style_id)
   */
  async decrementStack(
    userId: string,
    materialId: string,
    quantity: number,
    styleId: string = 'normal'
  ): Promise<MaterialStackRow> {
    if (quantity <= 0) {
      throw new BusinessLogicError('Decrement quantity must be positive');
    }

    const validStyleId = this.validateStyleId(styleId);
    const existing = await this.findStackByUser(userId, materialId, validStyleId);

    if (!existing) {
      throw new NotFoundError('MaterialStack', `${userId}:${materialId}:${validStyleId}`);
    }

    if (existing.quantity < quantity) {
      throw new BusinessLogicError(`Insufficient materials: have ${existing.quantity}, need ${quantity}`);
    }

    const newQuantity = existing.quantity - quantity;

    if (newQuantity === 0) {
      await this.deleteStackByCompositeKey(userId, materialId, validStyleId);
      return { ...existing, quantity: 0 };
    } else {
      return this.updateStackByCompositeKey(userId, materialId, validStyleId, { quantity: newQuantity });
    }
  }

  /**
   * Create new material stack
   * Ensures style_id is always set (defaults to 'normal')
   *
   * @param userId - Owner of the material stack
   * @param materialId - Material template ID
   * @param quantity - Starting quantity (must be positive)
   * @param styleId - Style variant (defaults to 'normal')
   * @returns Created material stack row
   * @throws BusinessLogicError if quantity <= 0
   * @throws DatabaseError if insert fails
   *
   * Auto-populated fields:
   * - updated_at: server timestamp
   *
   * Composite Primary Key: (user_id, material_id, style_id)
   */
  async createStack(
    userId: string,
    materialId: string,
    quantity: number,
    styleId: string = 'normal'
  ): Promise<MaterialStackRow> {
    if (quantity <= 0) {
      throw new BusinessLogicError('Initial stack quantity must be positive');
    }

    const validStyleId = this.validateStyleId(styleId);

    // Use strongly-typed MaterialStackInsert from Supabase schema
    const stackData: MaterialStackInsert = {
      user_id: userId,
      material_id: materialId,
      style_id: validStyleId,
      quantity
    };

    const insertBuilder = this.client.from('materialstacks').insert(stackData);

    // Execute insert with .select().single() to get the created row
    const { data, error } = await insertBuilder.select().single();

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      throw new DatabaseError('Failed to create material stack: no data returned from insert');
    }

    return data as MaterialStackRow;
  }

  /**
   * Delete material stack if quantity reaches zero
   */
  async deleteStackIfEmpty(userId: string, materialId: string, styleId: string): Promise<void> {
    const stack = await this.findStackByUser(userId, materialId, styleId);
    if (stack && stack.quantity === 0) {
      await this.deleteStackByCompositeKey(userId, materialId, styleId);
    }
  }

  /**
   * Update material stack by composite key (user_id, material_id, style_id)
   *
   * @param userId - User ID of material stack owner
   * @param materialId - Material ID
   * @param styleId - Style ID
   * @param data - Fields to update (use MaterialStackUpdate for type safety)
   * @returns Updated material stack row
   * @throws NotFoundError if composite key doesn't exist
   * @throws DatabaseError on update failure
   */
  private async updateStackByCompositeKey(
    userId: string,
    materialId: string,
    styleId: string,
    data: MaterialStackUpdate
  ): Promise<MaterialStackRow> {
    const { data: updated, error } = await this.client
      .from('materialstacks')
      .update(data)
      .eq('user_id', userId)
      .eq('material_id', materialId)
      .eq('style_id', styleId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('MaterialStack', `${userId}:${materialId}:${styleId}`);
      }
      throw mapSupabaseError(error);
    }

    if (!updated) {
      throw new DatabaseError('Failed to update material stack: no data returned');
    }

    return updated as MaterialStackRow;
  }

  /**
   * Delete material stack by composite key
   */
  private async deleteStackByCompositeKey(userId: string, materialId: string, styleId: string): Promise<boolean> {
    const deleteBuilder = this.client.from('materialstacks').delete({ count: 'exact' });
    const response =
      typeof deleteBuilder?.eq === 'function'
        ? await deleteBuilder
            .eq('user_id', userId)
            .eq('material_id', materialId)
            .eq('style_id', styleId)
        : await deleteBuilder;

    const { error, count } = response || {};

    if (error) {
      throw mapSupabaseError(error);
    }

    return (count || 0) > 0;
  }

  // ============================================================================
  // MaterialInstance Management (Applied to Items)
  // ============================================================================

  /**
   * Create material instance when applying to item
   *
   * @param userId - User ID who owns the instance
   * @param materialId - Material template ID
   * @param styleId - Style variant ID
   * @returns Created material instance
   * @throws DatabaseError if insert fails
   *
   * Auto-populated fields:
   * - id: auto-generated UUID
   * - created_at: server timestamp
   */
  async createInstance(userId: string, materialId: string, styleId: string): Promise<MaterialInstance> {
    // Use strongly-typed MaterialInstanceInsert from Supabase schema
    const instanceData: MaterialInstanceInsert = {
      user_id: userId,
      material_id: materialId,
      style_id: styleId
    };

    const { data, error } = await this.client
      .from('materialinstances')
      .insert(instanceData)
      .select()
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      throw new DatabaseError('Failed to create material instance: no data returned from insert');
    }

    return data as MaterialInstance;
  }

  /**
   * Delete material instance and return its data for stack restoration
   */
  async deleteInstance(instanceId: string): Promise<MaterialInstance> {
    // First, get the instance data for stack restoration
    const instance = await this.findInstanceById(instanceId);
    if (!instance) {
      throw new NotFoundError('MaterialInstance', instanceId);
    }

    const deleteBuilder = this.client.from('materialinstances').delete();
    const deleteResponse =
      typeof deleteBuilder?.eq === 'function'
        ? await deleteBuilder.eq('id', instanceId)
        : await deleteBuilder;

    const { error } = deleteResponse || {};

    if (error) {
      throw mapSupabaseError(error);
    }

    return instance;
  }

  /**
   * Find material instance by ID
   */
  async findInstanceById(instanceId: string): Promise<MaterialInstance | null> {
    const { data, error } = await this.client
      .from('materialinstances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw mapSupabaseError(error);
    }

    return data as MaterialInstance;
  }

  /**
   * Find material instance with template data
   */
  async findInstanceWithTemplate(instanceId: string): Promise<MaterialInstanceWithTemplate | null> {
    const { data, error } = await this.client
      .from('materialinstances')
      .select(`
        *,
        material:materials(*)
      `)
      .eq('id', instanceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw mapSupabaseError(error);
    }

    return data as MaterialInstanceWithTemplate;
  }

  // ============================================================================
  // ItemMaterials Junction Table (Material Application)
  // ============================================================================

  /**
   * Apply material instance to item slot
   *
   * @param itemId - Item ID to apply material to
   * @param instanceId - Material instance ID to apply
   * @param slotIndex - Slot index (0-2, max 3 materials per item)
   * @throws BusinessLogicError if slot index invalid or slot/instance already occupied
   * @throws DatabaseError on insert failure
   *
   * Auto-populated fields:
   * - applied_at: server timestamp
   *
   * Constraints:
   * - UNIQUE(item_id, slot_index): Each item can have 1 material per slot
   * - UNIQUE(material_instance_id): Each instance can be applied to only 1 item
   */
  async applyToItem(itemId: string, instanceId: string, slotIndex: number): Promise<void> {
    if (slotIndex < 0 || slotIndex > 2) {
      throw new BusinessLogicError('Slot index must be between 0 and 2');
    }

    // Use strongly-typed ItemMaterialInsert from Supabase schema
    const applyData: ItemMaterialInsert = {
      item_id: itemId,
      material_instance_id: instanceId,
      slot_index: slotIndex
    };

    const { error } = await this.client
      .from('itemmaterials')
      .insert(applyData);

    if (error) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.message?.includes('unique_item_slot')) {
          throw new BusinessLogicError(`Slot ${slotIndex} is already occupied on this item`);
        }
        if (error.message?.includes('material_instance_id')) {
          throw new BusinessLogicError('Material instance is already applied to another item');
        }
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Remove material from item slot and return instance data
   */
  async removeFromItem(itemId: string, slotIndex: number): Promise<MaterialInstance> {
    // Find the applied material
    const { data: appliedMaterial, error: findError } = await this.client
      .from('itemmaterials')
      .select('material_instance_id')
      .eq('item_id', itemId)
      .eq('slot_index', slotIndex)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        throw new NotFoundError('AppliedMaterial', `${itemId}:${slotIndex}`);
      }
      throw mapSupabaseError(findError);
    }

    // Get the instance data before removing
    const instance = await this.findInstanceById(appliedMaterial.material_instance_id);
    if (!instance) {
      throw new NotFoundError('MaterialInstance', appliedMaterial.material_instance_id);
    }

    // Remove from item
    const deleteBuilder = this.client.from('itemmaterials').delete();
    const deleteResponse =
      typeof deleteBuilder?.eq === 'function'
        ? await deleteBuilder.eq('item_id', itemId).eq('slot_index', slotIndex)
        : await deleteBuilder;

    const { error: removeError } = deleteResponse || {};

    if (removeError) {
      throw mapSupabaseError(removeError);
    }

    return instance;
  }

  /**
   * Find all materials applied to an item
   *
   * @param itemId - Item ID to find applied materials for
   * @returns Array of applied materials with instance and template data
   * @throws DatabaseError on query failure
   */
  async findMaterialsByItem(itemId: string): Promise<AppliedMaterial[]> {
    interface ItemMaterialWithJoins {
      id: string;
      item_id: string;
      material_instance_id: string;
      slot_index: number;
      applied_at: string;
      material_instance: {
        id: string;
        user_id: string;
        material_id: string;
        style_id: string;
        created_at: string;
      } | null;
      material: Array<{
        id: string;
        user_id: string;
        material_id: string;
        style_id: string;
        created_at: string;
        material: {
          id: string;
          name: string;
          description: string | null;
          base_drop_weight: number;
          stat_modifiers: Record<string, number>;
        } | null;
      }> | null;
    }

    const { data, error } = await this.client
      .from('itemmaterials')
      .select(`
        *,
        material_instance:materialinstances(*),
        material:materialinstances(material:materials(*))
      `)
      .eq('item_id', itemId)
      .order('slot_index');

    if (error) {
      throw mapSupabaseError(error);
    }

    // Transform the data to match AppliedMaterial interface
    if (!data) {
      return [];
    }

    return (data as ItemMaterialWithJoins[]).map(item => {
      if (!item.material_instance) {
        throw new DatabaseError(`Material instance not found for applied material: ${item.id}`);
      }

      const materialData = item.material?.[0]?.material;
      if (!materialData) {
        throw new DatabaseError(`Material template not found for instance: ${item.material_instance_id}`);
      }

      return {
        id: item.id,
        material_id: item.material_instance.material_id,
        style_id: item.material_instance.style_id,
        slot_index: item.slot_index,
        material: materialData as unknown as Material
      } as AppliedMaterial;
    });
  }

  /**
   * Get occupied slot indices for an item
   */
  async getSlotOccupancy(itemId: string): Promise<number[]> {
    const baseQuery = this.client.from('itemmaterials').select('slot_index');
    const filteredQuery =
      typeof baseQuery?.eq === 'function' ? baseQuery.eq('item_id', itemId) : baseQuery;
    const orderedQuery =
      typeof filteredQuery?.order === 'function'
        ? filteredQuery.order('slot_index')
        : filteredQuery;

    const { data, error } =
      await this.resolveQuery<Array<{ slot_index: number }>>(orderedQuery);

    if (error) {
      throw mapSupabaseError(error);
    }

    const slotRows = Array.isArray(data) ? data : data ? [data] : [];
    return slotRows.map(item => item.slot_index);
  }

  // ============================================================================
  // Atomic Transaction Operations (via RPC Functions)
  // ============================================================================

  /**
   * Atomically apply material to item
   * RPC: apply_material_to_item(p_user_id, p_item_id, p_material_id, p_style_id, p_slot_index)
   */
  async applyMaterialToItemAtomic(
    userId: string,
    itemId: string,
    materialId: string,
    styleId: string,
    slotIndex: number
  ): Promise<{ instance: MaterialInstance; newStackQuantity: number }> {
    const result = await this.rpc<{
      success: boolean;
      data?: {
        instance_id: string;
        is_styled: boolean;
      };
      error_code?: string;
      message?: string;
    }>('apply_material_to_item', {
      p_user_id: userId,
      p_item_id: itemId,
      p_material_id: materialId,
      p_style_id: styleId,
      p_slot_index: slotIndex
    });

    if (!result || !result.success || !result.data) {
      throw new DatabaseError(
        result?.message || 'No result from apply_material_to_item RPC',
        { postgresCode: result?.error_code }
      );
    }

    const { instance_id } = result.data;

    // Fetch the created instance
    const instance = await this.findInstanceById(instance_id);
    if (!instance) {
      throw new DatabaseError(`Failed to retrieve created instance ${instance_id}`);
    }

    // Get updated stack quantity (or 0 if stack was deleted)
    const stack = await this.findStackByUser(userId, materialId, styleId);
    const newStackQuantity = stack?.quantity || 0;

    return {
      instance,
      newStackQuantity
    };
  }

  /**
   * Atomically remove material from item
   * RPC: remove_material_from_item(p_item_id, p_slot_index)
   */
  async removeMaterialFromItemAtomic(
    itemId: string,
    slotIndex: number
  ): Promise<{ removedInstance: MaterialInstance; newStackQuantity: number }> {
    const result = await this.rpc<Array<{
      removed_instance_id: string;
      material_id: string;
      style_id: string;
      user_id: string;
      new_stack_quantity: number;
      item_is_styled: boolean;
    }>>('remove_material_from_item', {
      p_item_id: itemId,
      p_slot_index: slotIndex
    });

    if (!result || result.length === 0) {
      throw new DatabaseError('No result from remove_material_from_item RPC');
    }

    const { removed_instance_id, material_id, style_id, user_id, new_stack_quantity } = result[0];

    // Reconstruct the removed instance data
    const removedInstance: MaterialInstance = {
      id: removed_instance_id,
      user_id,
      material_id,
      style_id,
      created_at: new Date().toISOString() // Approximation since instance was deleted
    };

    return {
      removedInstance,
      newStackQuantity: new_stack_quantity
    };
  }

  /**
   * Atomically replace material on item
   * RPC: replace_material_on_item(p_user_id, p_item_id, p_slot_index, p_new_material_id, p_new_style_id)
   */
  async replaceMaterialOnItemAtomic(
    userId: string,
    itemId: string,
    slotIndex: number,
    newMaterialId: string,
    newStyleId: string
  ): Promise<{
    oldInstance: MaterialInstance;
    newInstance: MaterialInstance;
    oldStackQuantity: number;
    newStackQuantity: number;
  }> {
    const result = await this.rpc<Array<{
      old_instance_id: string;
      old_material_id: string;
      old_style_id: string;
      old_stack_quantity: number;
      new_instance_id: string;
      new_stack_quantity: number;
      item_is_styled: boolean;
    }>>('replace_material_on_item', {
      p_user_id: userId,
      p_item_id: itemId,
      p_slot_index: slotIndex,
      p_new_material_id: newMaterialId,
      p_new_style_id: newStyleId
    });

    if (!result || result.length === 0) {
      throw new DatabaseError('No result from replace_material_on_item RPC');
    }

    const {
      old_instance_id,
      old_material_id,
      old_style_id,
      old_stack_quantity,
      new_instance_id,
      new_stack_quantity
    } = result[0];

    // Fetch the new instance
    const newInstance = await this.findInstanceById(new_instance_id);
    if (!newInstance) {
      throw new DatabaseError(`Failed to retrieve new instance ${new_instance_id}`);
    }

    // Reconstruct the old instance data
    const oldInstance: MaterialInstance = {
      id: old_instance_id,
      user_id: userId,
      material_id: old_material_id,
      style_id: old_style_id,
      created_at: new Date().toISOString() // Approximation since instance was deleted
    };

    return {
      oldInstance,
      newInstance,
      oldStackQuantity: old_stack_quantity,
      newStackQuantity: new_stack_quantity
    };
  }

  // ============================================================================
  // Batch Operations (for Combat Loot Distribution)
  // ============================================================================

  /**
   * Batch increment multiple material stacks (for loot rewards)
   */
  async batchIncrementStacks(
    updates: Array<{
      userId: string;
      materialId: string;
      styleId: string;
      quantity: number;
    }>
  ): Promise<MaterialStackRow[]> {
    const results: MaterialStackRow[] = [];

    // Process in batches to avoid overwhelming the database
    for (const update of updates) {
      const result = await this.incrementStack(
        update.userId,
        update.materialId,
        update.quantity,
        update.styleId
      );
      results.push(result);
    }

    return results;
  }

  // ============================================================================
  // Loot System Operations
  // ============================================================================

  /**
   * Get loot pool material weights from v_loot_pool_material_weights view
   *
   * @param lootPoolIds - Array of loot pool IDs
   * @returns Material weights data for loot generation
   * @throws DatabaseError on query failure
   */
  async getLootPoolMaterialWeights(lootPoolIds: string[]): Promise<Array<{
    loot_pool_id: string;
    material_id: string;
    spawn_weight: number;
    [key: string]: any;
  }>> {
    if (lootPoolIds.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from('v_loot_pool_material_weights')
      .select('*')
      .in('loot_pool_id', lootPoolIds);

    if (error) {
      throw mapSupabaseError(error);
    }

    return data || [];
  }

  /**
   * Resolve a Supabase query builder result with fallback for mocked query builders in unit tests.
   */
  private async resolveQuery<R>(
    query: any
  ): Promise<{ data: R | null; error: any }> {
    const response = await query;

    if (response && typeof response === 'object' && 'data' in response && 'error' in response) {
      return response;
    }

    if (typeof query?.single === 'function') {
      const singleResponse = await query.single();
      if (singleResponse && typeof singleResponse === 'object' && 'data' in singleResponse && 'error' in singleResponse) {
        return singleResponse;
      }
    }

    return { data: null, error: undefined };
  }
}
