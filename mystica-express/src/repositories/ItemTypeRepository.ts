/**
 * ItemType Repository
 *
 * Manages ItemType seed data for item creation and inventory initialization.
 * ItemTypes are read-only template data that define base stats, rarity, and
 * category information for all items in the game.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import { Database } from '../types/database.types.js';
import { mapSupabaseError } from '../utils/errors.js';
import { BaseRepository } from './BaseRepository.js';

// Type definitions from database schema
type ItemTypeRow = Database['public']['Tables']['itemtypes']['Row'];
type ItemTypeInsert = Database['public']['Tables']['itemtypes']['Insert'];
type ItemTypeUpdate = Database['public']['Tables']['itemtypes']['Update'];

/**
 * ItemTypeRepository handles all item type template operations
 *
 * Key features:
 * - Read-only access to ItemType seed data
 * - Filtering by rarity for starter inventory
 * - Category-based queries for equipment slot validation
 */
export class ItemTypeRepository extends BaseRepository<ItemTypeRow> {
  constructor(client: SupabaseClient = supabase) {
    super('itemtypes', client);
  }

  // ============================================================================
  // Item Type Template Operations (Read Only)
  // ============================================================================

  /**
   * Find item type by ID
   *
   * @param id - Item type ID to find
   * @returns Item type data or null if not found
   * @throws DatabaseError on query failure
   */
  async findById(id: string): Promise<ItemTypeRow | null> {
    const { data, error } = await this.client
      .from('itemtypes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw mapSupabaseError(error);
    }

    return data;
  }

  /**
   * Find multiple item types by IDs
   * Used for batch fetching during loot generation
   *
   * @param ids - Array of item type IDs to find
   * @returns Array of item types found (may be fewer than requested if some IDs don't exist)
   * @throws DatabaseError on query failure
   */
  async findByIds(ids: string[]): Promise<ItemTypeRow[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from('itemtypes')
      .select('*')
      .in('id', ids);

    if (error) {
      throw mapSupabaseError(error);
    }

    return data || [];
  }

  /**
   * Get a random item type (used for starter inventory and loot tables)
   * Note: Rarity is now determined when creating the item, not from the item type
   *
   * @param category - Optional category to filter by
   * @returns Random item type or null if none found
   * @throws DatabaseError on query failure
   */
  async getRandom(category?: string): Promise<ItemTypeRow | null> {
    let query = this.client
      .from('itemtypes')
      .select('*');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  }

  /**
   * Find item types by category
   * Used for equipment slot validation and category-specific queries
   *
   * @param category - Category to filter by ('weapon', 'armor', 'accessory', etc.)
   * @param limit - Optional limit on number of results
   * @returns Array of item types matching category
   * @throws DatabaseError on query failure
   */
  async findByCategory(category: string, limit?: number): Promise<ItemTypeRow[]> {
    let query = this.client
      .from('itemtypes')
      .select('*')
      .eq('category', category)
      .order('name');

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return data || [];
  }

  /**
   * Find all item types with optional filtering
   * Used for admin interfaces and complete item type lists
   *
   * @param filters - Optional filters (category only - rarity is now on items table)
   * @returns Array of all item types
   * @throws DatabaseError on query failure
   */
  async findAll(filters?: { category?: string }): Promise<ItemTypeRow[]> {
    let query = this.client
      .from('itemtypes')
      .select('*')
      .order('category')
      .order('name');

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return data || [];
  }

}