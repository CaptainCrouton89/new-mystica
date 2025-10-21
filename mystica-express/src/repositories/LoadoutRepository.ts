/**
 * LoadoutRepository - Manages loadout and loadout slots operations
 *
 * Handles saved equipment configurations, slot assignments, loadout activation,
 * and active loadout tracking with proper constraint validation.
 */

import { BaseRepository } from './BaseRepository.js';
import { DatabaseError, NotFoundError, ValidationError, mapSupabaseError } from '../utils/errors.js';
import {
  LoadoutWithSlots,
  CreateLoadoutData,
  LoadoutSlotAssignments,
  BulkEquipmentUpdate
} from '../types/repository.types.js';
import { Database } from '../types/database.types.js';
import { supabase } from '../config/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

type Loadout = Database['public']['Tables']['loadouts']['Row'];
type LoadoutSlot = Database['public']['Tables']['loadoutslots']['Row'];

/**
 * Repository for loadout and loadout slots management
 *
 * Key responsibilities:
 * - Loadout CRUD with unique name constraints
 * - LoadoutSlots bulk management (atomic updates)
 * - Active loadout tracking (only one per user)
 * - Loadout activation (copy slots → UserEquipment)
 * - Item ownership validation
 */
export class LoadoutRepository extends BaseRepository<Loadout> {
  constructor(client: SupabaseClient = supabase) {
    super('loadouts', client);
  }

  // ============================================================================
  // Loadout Management
  // ============================================================================

  /**
   * Find all loadouts for a user with their slot assignments
   *
   * @param userId - User ID
   * @returns Array of loadouts with slots
   * @throws DatabaseError on query failure
   */
  async findLoadoutsByUser(userId: string): Promise<LoadoutWithSlots[]> {
    const { data, error } = await this.client
      .from('loadouts')
      .select(`
        *,
        loadoutslots (
          slot_name,
          item_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []).map(this.mapLoadoutWithSlots);
  }

  /**
   * Find loadout by ID with slot assignments
   *
   * @param loadoutId - Loadout ID
   * @returns Loadout with slots or null
   * @throws DatabaseError on query failure
   */
  async findLoadoutById(loadoutId: string): Promise<LoadoutWithSlots | null> {
    const { data, error } = await this.client
      .from('loadouts')
      .select(`
        *,
        loadoutslots (
          slot_name,
          item_id
        )
      `)
      .eq('id', loadoutId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return this.mapLoadoutWithSlots(data);
  }

  /**
   * Create new loadout
   *
   * @param data - Loadout creation data
   * @returns Created loadout
   * @throws ValidationError on duplicate name
   * @throws DatabaseError on creation failure
   */
  async createLoadout(data: CreateLoadoutData): Promise<Loadout> {
    try {
      const { data: created, error } = await this.client
        .from('loadouts')
        .insert({
          user_id: data.user_id,
          name: data.name,
          is_active: data.is_active || false
        })
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error);
      }

      return created as Loadout;
    } catch (error: any) {
      // Handle unique constraint violation for (user_id, name)
      if (error.code === '23505' && error.constraint === 'unique_loadout_name') {
        throw new ValidationError(`Loadout name '${data.name}' already exists for this user`);
      }
      throw error;
    }
  }

  /**
   * Update loadout name
   *
   * @param loadoutId - Loadout ID
   * @param name - New name
   * @returns Updated loadout
   * @throws ValidationError on duplicate name
   * @throws NotFoundError if loadout doesn't exist
   * @throws DatabaseError on update failure
   */
  async updateLoadoutName(loadoutId: string, name: string): Promise<Loadout> {
    try {
      const { data: updated, error } = await this.client
        .from('loadouts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', loadoutId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('loadouts', loadoutId);
        }
        throw mapSupabaseError(error);
      }

      return updated as Loadout;
    } catch (error: any) {
      // Handle unique constraint violation for (user_id, name)
      if (error.code === '23505' && error.constraint === 'unique_loadout_name') {
        throw new ValidationError(`Loadout name '${name}' already exists for this user`);
      }
      throw error;
    }
  }

  /**
   * Delete loadout and all its slots
   *
   * @param loadoutId - Loadout ID
   * @returns true if deleted, false if not found
   * @throws ValidationError if trying to delete active loadout
   * @throws DatabaseError on delete failure
   */
  async deleteLoadout(loadoutId: string): Promise<boolean> {
    // Check if loadout can be deleted (not active)
    const canDelete = await this.canDeleteLoadout(loadoutId);
    if (!canDelete) {
      throw new ValidationError('Cannot delete active loadout');
    }

    const { error, count } = await this.client
      .from('loadouts')
      .delete({ count: 'exact' })
      .eq('id', loadoutId);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (count || 0) > 0;
  }

  // ============================================================================
  // Slot Assignments
  // ============================================================================

  /**
   * Get loadout slot assignments
   *
   * @param loadoutId - Loadout ID
   * @returns Slot assignments object
   * @throws DatabaseError on query failure
   */
  async getLoadoutSlots(loadoutId: string): Promise<LoadoutSlotAssignments> {
    const { data, error } = await this.client
      .from('loadoutslots')
      .select('slot_name, item_id')
      .eq('loadout_id', loadoutId);

    if (error) {
      throw mapSupabaseError(error);
    }

    const slots: LoadoutSlotAssignments = {};
    for (const slot of data || []) {
      slots[slot.slot_name as keyof LoadoutSlotAssignments] = slot.item_id;
    }

    return slots;
  }

  /**
   * Update all loadout slots atomically
   *
   * Replaces all 8 equipment slots with new assignments.
   * Uses upsert to handle existing/new slots efficiently.
   *
   * @param loadoutId - Loadout ID
   * @param slots - New slot assignments
   * @throws ValidationError if item ownership validation fails
   * @throws DatabaseError on update failure
   */
  async updateLoadoutSlots(loadoutId: string, slots: LoadoutSlotAssignments): Promise<void> {
    // Validate loadout exists and get user_id for ownership validation
    const loadout = await this.findById(loadoutId);
    if (!loadout) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    // Validate item ownership for all non-null item IDs
    const itemIds = Object.values(slots).filter((id): id is string => id !== null);
    if (itemIds.length > 0) {
      await this.validateItemOwnership(itemIds, loadout.user_id);
    }

    // Delete existing slots first
    const { error: deleteError } = await this.client
      .from('loadoutslots')
      .delete()
      .eq('loadout_id', loadoutId);

    if (deleteError) {
      throw mapSupabaseError(deleteError);
    }

    // Insert new slots (only non-null assignments)
    const slotInserts: { loadout_id: string; slot_name: string; item_id: string | null }[] = [];
    for (const [slotName, itemId] of Object.entries(slots)) {
      if (itemId !== null) {
        slotInserts.push({
          loadout_id: loadoutId,
          slot_name: slotName,
          item_id: itemId
        });
      }
    }

    if (slotInserts.length > 0) {
      const { error: insertError } = await this.client
        .from('loadoutslots')
        .insert(slotInserts);

      if (insertError) {
        throw mapSupabaseError(insertError);
      }
    }

    // Update loadout timestamp
    await this.client
      .from('loadouts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', loadoutId);
  }

  /**
   * Update single loadout slot
   *
   * @param loadoutId - Loadout ID
   * @param slotName - Equipment slot name
   * @param itemId - Item ID to assign (null to unequip)
   * @throws ValidationError if item ownership validation fails
   * @throws DatabaseError on update failure
   */
  async updateSingleSlot(loadoutId: string, slotName: string, itemId: string | null): Promise<void> {
    // Validate loadout exists and get user_id for ownership validation
    const loadout = await this.findById(loadoutId);
    if (!loadout) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    // Validate item ownership if itemId provided
    if (itemId) {
      await this.validateItemOwnership([itemId], loadout.user_id);
    }

    if (itemId === null) {
      // Remove slot assignment
      const { error } = await this.client
        .from('loadoutslots')
        .delete()
        .eq('loadout_id', loadoutId)
        .eq('slot_name', slotName);

      if (error) {
        throw mapSupabaseError(error);
      }
    } else {
      // Upsert slot assignment
      const { error } = await this.client
        .from('loadoutslots')
        .upsert({
          loadout_id: loadoutId,
          slot_name: slotName,
          item_id: itemId
        });

      if (error) {
        throw mapSupabaseError(error);
      }
    }

    // Update loadout timestamp
    await this.client
      .from('loadouts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', loadoutId);
  }

  // ============================================================================
  // Activation
  // ============================================================================

  /**
   * Set active loadout (deactivates others, activates target)
   *
   * @param userId - User ID
   * @param loadoutId - Loadout ID to activate
   * @throws NotFoundError if loadout doesn't exist or wrong owner
   * @throws DatabaseError on update failure
   */
  async setActiveLoadout(userId: string, loadoutId: string): Promise<void> {
    // Validate loadout ownership
    const isOwner = await this.validateLoadoutOwnership(loadoutId, userId);
    if (!isOwner) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    // Deactivate all user's loadouts first
    const { error: deactivateError } = await this.client
      .from('loadouts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deactivateError) {
      throw mapSupabaseError(deactivateError);
    }

    // Activate target loadout
    const { error: activateError } = await this.client
      .from('loadouts')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', loadoutId);

    if (activateError) {
      throw mapSupabaseError(activateError);
    }
  }

  /**
   * Get user's active loadout
   *
   * @param userId - User ID
   * @returns Active loadout with slots or null
   * @throws DatabaseError on query failure
   */
  async getActiveLoadout(userId: string): Promise<LoadoutWithSlots | null> {
    const { data, error } = await this.client
      .from('loadouts')
      .select(`
        *,
        loadoutslots (
          slot_name,
          item_id
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return this.mapLoadoutWithSlots(data);
  }

  /**
   * Activate loadout (copy slots to UserEquipment)
   *
   * This method copies loadout slots to the user's equipment,
   * effectively "wearing" the saved loadout configuration.
   *
   * @param loadoutId - Loadout ID to activate
   * @throws NotFoundError if loadout doesn't exist
   * @throws DatabaseError on activation failure
   */
  async activateLoadout(loadoutId: string): Promise<void> {
    // Get loadout with slots
    const loadout = await this.findLoadoutById(loadoutId);
    if (!loadout) {
      throw new NotFoundError('loadouts', loadoutId);
    }

    // Set as active loadout
    await this.setActiveLoadout(loadout.user_id, loadoutId);

    // Copy slots to UserEquipment
    const equipmentUpdates: BulkEquipmentUpdate = {
      weapon: loadout.slots.weapon,
      offhand: loadout.slots.offhand,
      head: loadout.slots.head,
      armor: loadout.slots.armor,
      feet: loadout.slots.feet,
      accessory_1: loadout.slots.accessory_1,
      accessory_2: loadout.slots.accessory_2,
      pet: loadout.slots.pet
    };

    // Bulk update UserEquipment - delete all existing, insert new
    const { error: deleteError } = await this.client
      .from('userequipment')
      .delete()
      .eq('user_id', loadout.user_id);

    if (deleteError) {
      throw mapSupabaseError(deleteError);
    }

    // Insert non-null equipment slots
    const equipmentInserts = [];
    for (const [slotName, itemId] of Object.entries(equipmentUpdates)) {
      if (itemId !== null) {
        equipmentInserts.push({
          user_id: loadout.user_id,
          slot_name: slotName,
          item_id: itemId,
          equipped_at: new Date().toISOString()
        });
      }
    }

    if (equipmentInserts.length > 0) {
      const { error: insertError } = await this.client
        .from('userequipment')
        .insert(equipmentInserts);

      if (insertError) {
        throw mapSupabaseError(insertError);
      }
    }

    // TODO: Recalculate user stats (vanity_level, avg_item_level)
    // This should be handled by triggers or a separate RPC function
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Check if loadout name is unique for user
   *
   * @param userId - User ID
   * @param name - Loadout name to check
   * @param excludeLoadoutId - Loadout ID to exclude from check (for updates)
   * @returns true if unique, false if exists
   * @throws DatabaseError on query failure
   */
  async isLoadoutNameUnique(userId: string, name: string, excludeLoadoutId?: string): Promise<boolean> {
    let query = this.client
      .from('loadouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('name', name);

    if (excludeLoadoutId) {
      query = query.neq('id', excludeLoadoutId);
    }

    const { count, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return (count || 0) === 0;
  }

  /**
   * Validate loadout ownership
   *
   * @param loadoutId - Loadout ID
   * @param userId - Expected owner user ID
   * @returns true if owned by user, false otherwise
   * @throws DatabaseError on query failure
   */
  async validateLoadoutOwnership(loadoutId: string, userId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from('loadouts')
      .select('id', { count: 'exact', head: true })
      .eq('id', loadoutId)
      .eq('user_id', userId);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (count || 0) > 0;
  }

  /**
   * Check if loadout can be deleted
   *
   * Cannot delete active loadouts.
   *
   * @param loadoutId - Loadout ID
   * @returns true if can delete, false otherwise
   * @throws DatabaseError on query failure
   */
  async canDeleteLoadout(loadoutId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('loadouts')
      .select('is_active')
      .eq('id', loadoutId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // Loadout doesn't exist
      }
      throw mapSupabaseError(error);
    }

    return !data.is_active;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map database loadout with slots to LoadoutWithSlots interface
   */
  private mapLoadoutWithSlots(data: any): LoadoutWithSlots {
    const slots: LoadoutWithSlots['slots'] = {
      weapon: null,
      offhand: null,
      head: null,
      armor: null,
      feet: null,
      accessory_1: null,
      accessory_2: null,
      pet: null
    };

    // Map loadoutslots array to slots object
    if (data.loadoutslots) {
      for (const slot of data.loadoutslots) {
        slots[slot.slot_name as keyof typeof slots] = slot.item_id;
      }
    }

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      slots
    };
  }

  /**
   * Validate that all item IDs belong to the specified user
   */
  private async validateItemOwnership(itemIds: string[], userId: string): Promise<void> {
    const { count, error } = await this.client
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('id', itemIds);

    if (error) {
      throw mapSupabaseError(error);
    }

    if ((count || 0) !== itemIds.length) {
      throw new ValidationError('One or more items do not belong to the user');
    }
  }

}