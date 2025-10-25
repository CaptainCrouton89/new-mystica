/**
 * Enemy Repository - Combat enemy data access layer
 *
 * Handles enemy types, tiers, enemyloot table, and combat-related queries.
 * Refactored to support normalized stat system and direct enemyloot table queries.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase.js';
import { StatsService } from '../services/StatsService.js';
import type { EnemyLoot, EnemyRealizedStats } from '../types/api.types.js';
import { Database } from '../types/database.types.js';
import { mapSupabaseError, NotFoundError, ValidationError } from '../utils/errors.js';
import { BaseRepository } from './BaseRepository.js';

// Type aliases
type EnemyType = Database['public']['Tables']['enemytypes']['Row'];
type Tier = Database['public']['Tables']['tiers']['Row'];

/**
 * Enemy Repository manages enemy-related database operations
 *
 * Key responsibilities:
 * - Retrieve enemy types with normalized stats
 * - Join enemytypes with tiers
 * - Query enemyloot table with polymorphic foreign keys
 * - Calculate realized stats using normalized system
 * - Style-based enemy variant support
 */
export class EnemyRepository extends BaseRepository<EnemyType> {
  private statsService: StatsService;

  constructor(client: SupabaseClient<Database> = supabase) {
    super('enemytypes', client);
    this.statsService = new StatsService();
  }

  // ============================================================================
  // Enemy Type Queries with Normalized Stats
  // ============================================================================

  /**
   * Find enemy type by ID using normalized stat columns
   *
   * @param enemyTypeId - Enemy type UUID
   * @returns Enemy type with normalized stats or null
   * @throws DatabaseError on query failure
   */
  async findEnemyTypeById(enemyTypeId: string): Promise<EnemyType | null> {
    const { data, error } = await this.client
      .from('enemytypes')
      .select('*')
      .eq('id', enemyTypeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return data as EnemyType;
  }

  /**
   * Find all enemy types with optional filtering
   *
   * @param options - Optional filter and sort parameters
   * @returns Array of enemy types with normalized stats
   * @throws DatabaseError on query failure
   */
  async findAllEnemyTypes(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'tier_id';
  }): Promise<EnemyType[]> {
    let query = this.client.from('enemytypes').select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as EnemyType[];
  }

  /**
   * Find enemy types by tier ID
   *
   * @param tierId - Tier ID (references tiers.id)
   * @returns Array of enemy types in the tier
   * @throws DatabaseError on query failure
   */
  async findEnemyTypesByTier(tierId: number): Promise<EnemyType[]> {
    const { data, error } = await this.client
      .from('enemytypes')
      .select('*')
      .eq('tier_id', tierId)
      .order('name');

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as EnemyType[];
  }

  /**
   * Find enemy types by style ID
   *
   * @param styleId - Style definition UUID
   * @returns Array of enemy types with the style
   * @throws DatabaseError on query failure
   */
  async findEnemyTypesByStyle(styleId: string): Promise<EnemyType[]> {
    const { data, error } = await this.client
      .from('enemytypes')
      .select('*')
      .eq('style_id', styleId)
      .order('name');

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as EnemyType[];
  }

  /**
   * Get styles available for an enemy type
   *
   * @param enemyTypeId - Enemy type UUID
   * @returns Array of style IDs from enemytypestyles table
   * @throws DatabaseError on query failure
   */
  async getStylesForEnemyType(enemyTypeId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('enemytypestyles')
      .select('style_id')
      .eq('enemy_type_id', enemyTypeId);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []).map(row => row.style_id);
  }

  /**
   * Find enemy type with associated tier information
   *
   * @param enemyTypeId - Enemy type UUID
   * @returns Object containing enemy type and tier or null
   * @throws DatabaseError on query failure
   */
  async getEnemyTypeWithTier(enemyTypeId: string): Promise<{ enemyType: EnemyType; tier: Tier } | null> {
    const { data, error } = await this.client
      .from('enemytypes')
      .select('*, tiers(*)')
      .eq('id', enemyTypeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    // Type guard to ensure data contains the expected structure
    const isTieredEnemyData = (data: unknown): data is EnemyType & { tiers: Tier } =>
      typeof data === 'object' && data !== null && 'tiers' in data && (data as EnemyType & { tiers: Tier }).tiers !== null;

    if (!isTieredEnemyData(data)) {
      throw new NotFoundError('EnemyType', enemyTypeId);
    }

    // Destructure with type safety
    const { tiers, ...enemyType } = data;

    return {
      enemyType: enemyType as EnemyType,
      tier: tiers,
    };
  }

  /**
   * Get computed enemy realized stats using normalized stat system
   *
   * @param enemyTypeId - Enemy type UUID
   * @param combatLevel - Player's combat level (avg_item_level)
   * @returns Computed stats (base_atk, base_def, hp) or null if enemy not found
   * @throws DatabaseError on query failure, error if tier not found
   */
  async getEnemyRealizedStats(enemyTypeId: string, combatLevel: number): Promise<EnemyRealizedStats | null> {
    const tiered = await this.getEnemyTypeWithTier(enemyTypeId);
    if (!tiered) {
      return null;
    }

    const { enemyType, tier } = tiered;
    const realizedStats = this.statsService.calculateEnemyRealizedStats(enemyType, combatLevel, tier);

    // Calculate HP: base_hp × tier.difficulty_multiplier (NO level scaling)
    if (!enemyType.base_hp || !tier.difficulty_multiplier) {
      throw new ValidationError('Enemy type must have base_hp and tier must have difficulty_multiplier');
    }

    return {
      ...realizedStats,
      hp: Math.floor(enemyType.base_hp * tier.difficulty_multiplier)
    };
  }

  async getEnemyLootTable(enemyTypeId: string, lootableType?: 'material' | 'item_type'): Promise<Array<EnemyLoot & { material_id?: string; item_type_id?: string }>> {
    let query = this.client.from('enemyloot').select('*').eq('enemy_type_id', enemyTypeId);

    if (lootableType) {
      query = query.eq('lootable_type', lootableType);
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    // Transform lootable_id to material_id or item_type_id based on lootable_type
    return ((data || []) as EnemyLoot[]).map(entry => {
      const transformed = { ...entry } as EnemyLoot & { material_id?: string; item_type_id?: string };

      if (entry.lootable_type === 'material') {
        transformed.material_id = entry.lootable_id;
      } else if (entry.lootable_type === 'item_type') {
        transformed.item_type_id = entry.lootable_id;
      }

      return transformed;
    });
  }
}