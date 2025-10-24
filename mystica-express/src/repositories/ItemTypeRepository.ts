/**
 * ItemType Repository
 *
 * Manages ItemType seed data for item creation and inventory initialization.
 * ItemTypes are read-only template data that define base stats, rarity, and
 * category information for all items in the game.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import { BaseRepository } from './BaseRepository.js';
import { DatabaseError, NotFoundError, mapSupabaseError } from '../utils/errors.js';
import { Database } from '../types/database.types.js';

// Type definitions from database schema
type ItemTypeRow = Database['public']['Tables']['itemtypes']['Row'];

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

    return data as ItemTypeRow;
  }

  /**
   * Find item types by rarity with optional limit
   * Used for starter inventory generation and loot tables
   *
   * @param rarity - Rarity to filter by ('common', 'uncommon', 'rare', 'epic', 'legendary')
   * @param limit - Optional limit on number of results
   * @returns Array of item types matching rarity
   * @throws DatabaseError on query failure
   */
  async findByRarity(rarity: string, limit?: number): Promise<ItemTypeRow[]> {
    let query = this.client
      .from('itemtypes')
      .select('*')
      .eq('rarity', rarity)
      .order('name');

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as ItemTypeRow[];
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

    return (data || []) as ItemTypeRow[];
  }

  /**
   * Find all item types with optional filtering
   * Used for admin interfaces and complete item type lists
   *
   * @param filters - Optional filters (rarity, category)
   * @returns Array of all item types
   * @throws DatabaseError on query failure
   */
  async findAll(filters?: { rarity?: string; category?: string }): Promise<ItemTypeRow[]> {
    let query = this.client
      .from('itemtypes')
      .select('*')
      .order('rarity')
      .order('category')
      .order('name');

    if (filters?.rarity) {
      query = query.eq('rarity', filters.rarity);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as ItemTypeRow[];
  }

  /**
   * Count item types by rarity
   * Used for loot table validation and statistical analysis
   *
   * @param rarity - Rarity to count
   * @returns Number of item types with given rarity
   * @throws DatabaseError on query failure
   */
  async countByRarity(rarity: string): Promise<number> {
    const { count, error } = await this.client
      .from('itemtypes')
      .select('*', { count: 'exact', head: true })
      .eq('rarity', rarity);

    if (error) {
      throw mapSupabaseError(error);
    }

    if (count === null || count === undefined) {
      throw new DatabaseError('Failed to count item types by rarity: query returned no data');
    }
    return count;
  }

  /**
   * Get random item type by rarity
   * Used for starter inventory and random loot generation
   *
   * @param rarity - Rarity to filter by
   * @returns Random item type of specified rarity or null if none found
   * @throws DatabaseError on query failure
   */
  async getRandomByRarity(rarity: string): Promise<ItemTypeRow | null> {
    const itemTypes = await this.findByRarity(rarity);

    if (itemTypes.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * itemTypes.length);
    return itemTypes[randomIndex];
  }
}