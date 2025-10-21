/**
 * Enemy Repository - Combat enemy data access layer
 *
 * Handles enemy types, tiers, styles, pools, and combat statistics.
 * Uses v_enemy_realized_stats view for computed stats instead of manual calculation.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './BaseRepository.js';
import { supabase } from '../config/supabase.js';
import { Database } from '../types/database.types.js';
import { mapSupabaseError, NotFoundError } from '../utils/errors.js';

// Type aliases for cleaner code
type EnemyType = Database['public']['Tables']['enemytypes']['Row'];
type EnemyPool = Database['public']['Tables']['enemypools']['Row'];
type EnemyPoolMember = Database['public']['Tables']['enemypoolmembers']['Row'];
type Tier = Database['public']['Tables']['tiers']['Row'];
type StyleDefinition = Database['public']['Tables']['styledefinitions']['Row'];
type EnemyRealizedStats = Database['public']['Views']['v_enemy_realized_stats']['Row'];

// Enemy-specific interfaces
export interface EnemyTypeWithPersonality extends EnemyType {
  ai_personality_traits: Record<string, any> | null;
  example_taunts: string[] | null;
  appearance_data: Record<string, any> | null;
}

export interface EnemyStats {
  atk: number;
  def: number;
  hp: number;
  combat_rating: number;
}

export interface EnemyPoolWithMembers extends EnemyPool {
  members: Array<EnemyPoolMember & { enemy_type: EnemyType }>;
}

export interface CreateEnemyPoolData {
  name: string;
  combat_level: number;
  filter_type: string;
  filter_value?: string | null;
}

export interface AddEnemyToPoolData {
  enemy_pool_id: string;
  enemy_type_id: string;
  spawn_weight?: number;
}

/**
 * Enemy Repository
 *
 * Responsibilities:
 * - Enemy type retrieval with personality data handling
 * - Enemy pool configuration management
 * - Tier-based stat calculation via v_enemy_realized_stats view
 * - Style-based enemy variants and spawn rates
 * - Enemy selection for combat encounters
 */
export class EnemyRepository extends BaseRepository<EnemyType> {
  constructor(client: any = supabase) {
    super('enemytypes', client);
  }

  // ============================================================================
  // Enemy Types
  // ============================================================================

  /**
   * Find enemy type by ID with personality data type safety
   *
   * @param enemyTypeId - Enemy type UUID
   * @returns Enemy type with typed personality data or null
   * @throws DatabaseError on query failure
   */
  async findEnemyTypeById(enemyTypeId: string): Promise<EnemyTypeWithPersonality | null> {
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

    return this.hydratePersonalityData(data as EnemyType);
  }

  /**
   * Find all enemy types with optional filtering
   *
   * @param options - Optional filter and sort parameters
   * @returns Array of enemy types with personality data
   * @throws DatabaseError on query failure
   */
  async findAllEnemyTypes(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'name' | 'tier_id';
  }): Promise<EnemyTypeWithPersonality[]> {
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

    return (data || []).map(enemy => this.hydratePersonalityData(enemy as EnemyType));
  }

  /**
   * Find enemy types by tier ID
   *
   * @param tierId - Tier ID (references Tiers.id, not tier_num)
   * @returns Array of enemy types in the tier
   * @throws DatabaseError on query failure
   */
  async findEnemyTypesByTier(tierId: number): Promise<EnemyTypeWithPersonality[]> {
    const { data, error } = await this.client
      .from('enemytypes')
      .select('*')
      .eq('tier_id', tierId)
      .order('name');

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []).map(enemy => this.hydratePersonalityData(enemy as EnemyType));
  }

  /**
   * Find enemy types by style ID
   *
   * @param styleId - Style definition UUID
   * @returns Array of enemy types with the style
   * @throws DatabaseError on query failure
   */
  async findEnemyTypesByStyle(styleId: string): Promise<EnemyTypeWithPersonality[]> {
    const { data, error } = await this.client
      .from('enemytypes')
      .select('*')
      .eq('style_id', styleId)
      .order('name');

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []).map(enemy => this.hydratePersonalityData(enemy as EnemyType));
  }

  // ============================================================================
  // Enemy Stats (via v_enemy_realized_stats view)
  // ============================================================================

  /**
   * Get enemy realized stats via v_enemy_realized_stats view
   *
   * Uses view instead of manual additive tier scaling calculation.
   * Formula: base + offset + (tier_adds * (tier_num - 1))
   *
   * @param enemyTypeId - Enemy type UUID
   * @returns Computed stats with combat rating or null
   * @throws DatabaseError on query failure
   */
  async getEnemyRealizedStats(enemyTypeId: string): Promise<EnemyStats | null> {
    const { data, error } = await this.client
      .from('v_enemy_realized_stats')
      .select('atk, def, hp, combat_rating')
      .eq('id', enemyTypeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    // Handle nullable fields from view
    if (!data.atk || !data.def || !data.hp || !data.combat_rating) {
      throw new Error(`Incomplete stats for enemy type ${enemyTypeId}`);
    }

    return {
      atk: data.atk,
      def: data.def,
      hp: data.hp,
      combat_rating: data.combat_rating
    };
  }

  /**
   * Compute combat rating via PostgreSQL function
   *
   * @param enemyTypeId - Enemy type UUID
   * @returns Combat rating for matchmaking
   * @throws DatabaseError on RPC failure
   */
  async computeCombatRating(enemyTypeId: string): Promise<number> {
    const stats = await this.getEnemyRealizedStats(enemyTypeId);

    if (!stats) {
      throw new NotFoundError('enemy_type', enemyTypeId);
    }

    return stats.combat_rating;
  }

  // ============================================================================
  // Tiers
  // ============================================================================

  /**
   * Find tier by ID
   *
   * @param tierId - Tier ID (primary key, not tier_num)
   * @returns Tier data or null
   * @throws DatabaseError on query failure
   */
  async findTierById(tierId: number): Promise<Tier | null> {
    const { data, error } = await this.client
      .from('tiers')
      .select('*')
      .eq('id', tierId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return data as Tier;
  }

  /**
   * Get all tiers ordered by tier_num
   *
   * @returns Array of all tiers
   * @throws DatabaseError on query failure
   */
  async getAllTiers(): Promise<Tier[]> {
    const { data, error } = await this.client
      .from('tiers')
      .select('*')
      .order('tier_num');

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as Tier[];
  }

  // ============================================================================
  // Styles
  // ============================================================================

  /**
   * Find style definition by ID
   *
   * @param styleId - Style definition UUID
   * @returns Style definition or null
   * @throws DatabaseError on query failure
   */
  async findStyleById(styleId: string): Promise<StyleDefinition | null> {
    const { data, error } = await this.client
      .from('styledefinitions')
      .select('*')
      .eq('id', styleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return data as StyleDefinition;
  }

  /**
   * Get all style definitions ordered by spawn_rate (descending)
   *
   * @returns Array of all style definitions
   * @throws DatabaseError on query failure
   */
  async getAllStyles(): Promise<StyleDefinition[]> {
    const { data, error } = await this.client
      .from('styledefinitions')
      .select('*')
      .order('spawn_rate', { ascending: false });

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data || []) as StyleDefinition[];
  }

  /**
   * Find style definition by name
   *
   * @param styleName - Style name (unique)
   * @returns Style definition or null
   * @throws DatabaseError on query failure
   */
  async findStyleByName(styleName: string): Promise<StyleDefinition | null> {
    const { data, error } = await this.client
      .from('styledefinitions')
      .select('*')
      .eq('style_name', styleName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(error);
    }

    return data as StyleDefinition;
  }

  // ============================================================================
  // Pool Management (Admin Operations)
  // ============================================================================

  /**
   * Create new enemy pool
   *
   * @param poolData - Pool configuration data
   * @returns Created enemy pool
   * @throws DatabaseError on insert failure
   */
  async createEnemyPool(poolData: CreateEnemyPoolData): Promise<EnemyPool> {
    const { data, error } = await this.client
      .from('enemypools')
      .insert({
        name: poolData.name,
        combat_level: poolData.combat_level,
        filter_type: poolData.filter_type,
        filter_value: poolData.filter_value || null
      })
      .select()
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return data as EnemyPool;
  }

  /**
   * Add enemy to pool with spawn weight
   *
   * @param poolData - Pool membership data
   * @throws DatabaseError on insert failure
   */
  async addEnemyToPool(poolData: AddEnemyToPoolData): Promise<void> {
    const { error } = await this.client
      .from('enemypoolmembers')
      .insert({
        enemy_pool_id: poolData.enemy_pool_id,
        enemy_type_id: poolData.enemy_type_id,
        spawn_weight: poolData.spawn_weight || 100
      });

    if (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Remove enemy from pool
   *
   * @param poolId - Enemy pool UUID
   * @param enemyTypeId - Enemy type UUID
   * @returns true if removed, false if not found
   * @throws DatabaseError on delete failure
   */
  async removeEnemyFromPool(poolId: string, enemyTypeId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('enemypoolmembers')
      .delete({ count: 'exact' })
      .eq('enemy_pool_id', poolId)
      .eq('enemy_type_id', enemyTypeId);

    if (error) {
      throw mapSupabaseError(error);
    }

    return (count || 0) > 0;
  }

  /**
   * Find enemy pool with members
   *
   * @param poolId - Enemy pool UUID
   * @returns Pool with enemy type members or null
   * @throws DatabaseError on query failure
   */
  async findEnemyPoolWithMembers(poolId: string): Promise<EnemyPoolWithMembers | null> {
    // First get the pool
    const { data: pool, error: poolError } = await this.client
      .from('enemypools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolError) {
      if (poolError.code === 'PGRST116') {
        return null;
      }
      throw mapSupabaseError(poolError);
    }

    // Then get members with enemy types
    const { data: members, error: membersError } = await this.client
      .from('enemypoolmembers')
      .select(`
        *,
        enemy_type:enemytypes(*)
      `)
      .eq('enemy_pool_id', poolId);

    if (membersError) {
      throw mapSupabaseError(membersError);
    }

    return {
      ...(pool as EnemyPool),
      members: (members || []).map(member => ({
        ...member,
        enemy_type: member.enemy_type as EnemyType
      }))
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Hydrate personality JSON fields with type safety
   *
   * Handles JSON/TEXT fields: ai_personality_traits, example_taunts, appearance_data
   *
   * @param enemy - Raw enemy type from database
   * @returns Enemy with typed personality data
   */
  private hydratePersonalityData(enemy: EnemyType): EnemyTypeWithPersonality {
    const result: EnemyTypeWithPersonality = {
      ...enemy,
      ai_personality_traits: null,
      example_taunts: null,
      appearance_data: null
    };

    // Type-safe JSON parsing with fallbacks
    try {
      if (enemy.ai_personality_traits) {
        result.ai_personality_traits = typeof enemy.ai_personality_traits === 'string'
          ? JSON.parse(enemy.ai_personality_traits)
          : enemy.ai_personality_traits as Record<string, any>;
      }
    } catch (e) {
      // Log warning but don't throw - personality data is optional
      console.warn(`Invalid ai_personality_traits JSON for enemy ${enemy.id}:`, e);
    }

    try {
      if (enemy.example_taunts) {
        const parsed = typeof enemy.example_taunts === 'string'
          ? JSON.parse(enemy.example_taunts)
          : enemy.example_taunts;
        result.example_taunts = Array.isArray(parsed) ? parsed : null;
      }
    } catch (e) {
      console.warn(`Invalid example_taunts JSON for enemy ${enemy.id}:`, e);
    }

    try {
      if (enemy.appearance_data) {
        result.appearance_data = typeof enemy.appearance_data === 'string'
          ? JSON.parse(enemy.appearance_data)
          : enemy.appearance_data as Record<string, any>;
      }
    } catch (e) {
      console.warn(`Invalid appearance_data JSON for enemy ${enemy.id}:`, e);
    }

    return result;
  }
}