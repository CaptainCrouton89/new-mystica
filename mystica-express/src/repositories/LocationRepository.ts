/**
 * LocationRepository
 *
 * Handles location-based operations including:
 * - PostGIS geospatial queries for nearby location searches
 * - Location metadata by type/region
 * - Enemy pool matching for combat initialization
 * - Loot pool matching for combat rewards
 * - Pool-based weighted random selection algorithms
 */

import { BaseRepository } from './BaseRepository.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';
import { Database } from '../types/database.types.js';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  LocationWithDistance,
  EnemyPoolMember,
  LootPoolEntry,
  LootDrop,
  QueryFilter
} from '../types/repository.types.js';

// Location-related type aliases from database schema
type Location = Database['public']['Tables']['locations']['Row'];
type EnemyPool = Database['public']['Tables']['enemypools']['Row'];
type LootPool = Database['public']['Tables']['lootpools']['Row'];
type LootPoolTierWeight = Database['public']['Tables']['lootpooltierweights']['Row'];

/**
 * Pool filter types for matching logic
 */
type PoolFilterType = 'universal' | 'location_type' | 'state' | 'country' | 'lat_range' | 'lng_range';

/**
 * Location repository with PostGIS geospatial queries and pool management
 */
export class LocationRepository extends BaseRepository<Location> {
  constructor(client?: SupabaseClient<Database>) {
    super('locations', client);
  }

  // ============================================================================
  // Spatial Queries (PostGIS)
  // ============================================================================

  /**
   * Find nearby locations within specified radius using PostGIS geography calculations
   * Uses get_nearby_locations RPC function with ST_DWithin for efficient spatial queries
   * Returns results ordered by distance (closest first)
   *
   * Enriches results with API contract fields:
   * - enemy_level: Set to 1 (MVP0 simplification - not stored in DB)
   * - material_drop_pool: Empty array (deprecated per api-contracts.yaml, use LootPools)
   * - distance_meters: Returned from PostGIS RPC
   */
  async findNearby(lat: number, lng: number, radius: number): Promise<LocationWithDistance[]> {
    const data = await this.rpc<LocationWithDistance[]>('get_nearby_locations', {
      user_lat: lat,
      user_lng: lng,
      search_radius: radius,
    });

    return data || [];
  }

  /**
   * Find location by ID
   * Note: Previously added deprecated fields (enemy_level, material_drop_pool).
   * Now returns base Location - use pool-based system (EnemyPools/LootPools) instead.
   */
  async findById(locationId: string): Promise<Location | null> {
    return await super.findById(locationId);
  }

  // ============================================================================
  // Location Metadata
  // ============================================================================

  /**
   * Find locations by type (e.g., 'restaurant', 'park', 'shopping_mall')
   * Enriches results with API contract fields
   */
  async findByType(locationType: string): Promise<any[]> {
    const locations = await this.findMany({ location_type: locationType });
    return this.enrichLocations(locations);
  }

  /**
   * Find locations by region (state and country codes)
   * Enriches results with API contract fields
   */
  async findByRegion(stateCode: string, countryCode: string): Promise<any[]> {
    const locations = await this.findMany({
      state_code: stateCode,
      country_code: countryCode
    });
    return this.enrichLocations(locations);
  }

  /**
   * Get all locations with optional pagination
   * Enriches results with API contract fields
   */
  async findAll(limit?: number, offset?: number): Promise<any[]> {
    const pagination = limit ? { limit, offset: offset || 0 } : undefined;
    const locations = await this.findMany({}, { pagination });
    return this.enrichLocations(locations);
  }

  /**
   * Helper method to enrich locations (no longer adds deprecated fields)
   * Note: enemy_level and material_drop_pool removed - use pool-based system instead
   */
  private enrichLocations(locations: Location[]): Location[] {
    return locations;
  }

  // ============================================================================
  // Enemy Pool Matching (for combat initialization)
  // ============================================================================

  /**
   * Get matching enemy pools for a location and combat level
   * Combines universal pools + location-specific pools with proper weight aggregation
   */
  async getMatchingEnemyPools(location: Location, combatLevel: number): Promise<string[]> {
    // Query for matching pools using complex filter logic
    const { data, error } = await this.client
      .from('enemypools')
      .select('id')
      .eq('combat_level', combatLevel)
      .or(this.buildPoolFilter(location));

    if (error) {
      throw new DatabaseError(`Failed to fetch matching enemy pools: ${error.message}`);
    }

    return (data || []).map(pool => pool.id);
  }

  /**
   * Get enemy pool members with spawn weights for given pool IDs
   */
  async getEnemyPoolMembers(poolIds: string[]): Promise<EnemyPoolMember[]> {
    if (poolIds.length === 0) return [];

    const { data, error } = await this.client
      .from('enemypoolmembers')
      .select('enemy_pool_id, enemy_type_id, spawn_weight')
      .in('enemy_pool_id', poolIds);

    if (error) {
      throw new DatabaseError(`Failed to fetch enemy pool members: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Select random enemy from pool members using weighted random selection
   * Returns enemy_type_id of selected enemy
   */
  selectRandomEnemy(poolMembers: EnemyPoolMember[]): string {
    if (poolMembers.length === 0) {
      throw new Error('No enemy pool members available for selection');
    }

    // Calculate total weight
    const totalWeight = poolMembers.reduce((sum, member) => sum + member.spawn_weight, 0);

    if (totalWeight === 0) {
      throw new Error('All enemy pool members have zero spawn weight');
    }

    // Select random value within total weight
    const randomValue = Math.random() * totalWeight;

    // Find the selected enemy using weighted selection
    let currentWeight = 0;
    for (const member of poolMembers) {
      currentWeight += member.spawn_weight;
      if (randomValue <= currentWeight) {
        return member.enemy_type_id;
      }
    }

    // Fallback (should never happen with proper weights)
    return poolMembers[poolMembers.length - 1].enemy_type_id;
  }

  // ============================================================================
  // Loot Pool Matching (for combat rewards)
  // ============================================================================

  /**
   * Get matching loot pools for a location and combat level
   * Uses same filter logic as enemy pools
   */
  async getMatchingLootPools(location: Location, combatLevel: number): Promise<string[]> {
    const { data, error } = await this.client
      .from('lootpools')
      .select('id')
      .eq('combat_level', combatLevel)
      .or(this.buildPoolFilter(location));

    if (error) {
      throw new DatabaseError(`Failed to fetch matching loot pools: ${error.message}`);
    }

    return (data || []).map(pool => pool.id);
  }

  /**
   * Get loot pool entries for given pool IDs
   */
  async getLootPoolEntries(poolIds: string[]): Promise<LootPoolEntry[]> {
    if (poolIds.length === 0) return [];

    const { data, error } = await this.client
      .from('lootpoolentries')
      .select(`
        loot_pool_id,
        lootable_type,
        lootable_id,
        drop_weight,
        materials:materials!lootpoolentries_lootable_id_fkey(name),
        item_types:itemtypes!lootpoolentries_lootable_id_fkey(name)
      `)
      .in('loot_pool_id', poolIds);

    if (error) {
      throw new DatabaseError(`Failed to fetch loot pool entries: ${error.message}`);
    }

    // Transform the data to include the names directly in the entry
    return (data || []).map((entry: any) => ({
      loot_pool_id: entry.loot_pool_id,
      lootable_type: entry.lootable_type,
      lootable_id: entry.lootable_id,
      drop_weight: entry.drop_weight,
      lootable_name: entry.lootable_type === 'material'
        ? entry.materials?.name
        : entry.item_types?.name
    }));
  }

  /**
   * Get loot pool tier weights for given pool IDs
   * These multipliers affect material drop rates based on MaterialStrengthTiers
   */
  async getLootPoolTierWeights(poolIds: string[]): Promise<LootPoolTierWeight[]> {
    if (poolIds.length === 0) return [];

    const { data, error } = await this.client
      .from('lootpooltierweights')
      .select('*')
      .in('loot_pool_id', poolIds);

    if (error) {
      throw new DatabaseError(`Failed to fetch loot pool tier weights: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Select random loot from pool entries with tier weight multipliers
   * Returns array of loot drops with style inheritance from enemy
   */
  selectRandomLoot(
    poolEntries: any[],
    tierWeights: LootPoolTierWeight[],
    enemyStyleId: string = 'normal',
    dropCount: number = 1
  ): LootDrop[] {
    if (poolEntries.length === 0) return [];

    const drops: LootDrop[] = [];

    // Create tier weight lookup for efficiency
    const tierWeightMap = new Map<string, Map<string, number>>();
    tierWeights.forEach(tw => {
      if (!tierWeightMap.has(tw.loot_pool_id)) {
        tierWeightMap.set(tw.loot_pool_id, new Map());
      }
      tierWeightMap.get(tw.loot_pool_id)!.set(tw.tier_name, tw.weight_multiplier);
    });

    for (let i = 0; i < dropCount; i++) {
      // Apply tier weight multipliers to base drop weights
      const weightedEntries = poolEntries.map(entry => ({
        ...entry,
        // For materials, apply tier weight multiplier
        // For items, use base weight (tier weights typically don't apply to items)
        adjustedWeight: entry.lootable_type === 'material'
          ? this.calculateMaterialDropWeight(entry, tierWeightMap.get(entry.loot_pool_id) || new Map())
          : entry.drop_weight
      }));

      // Calculate total adjusted weight
      const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.adjustedWeight, 0);

      if (totalWeight === 0) continue;

      // Select random entry
      const randomValue = Math.random() * totalWeight;
      let currentWeight = 0;

      for (const entry of weightedEntries) {
        currentWeight += entry.adjustedWeight;
        if (randomValue <= currentWeight) {
          // Create loot drop with style inheritance
          const drop: LootDrop = {
            type: entry.lootable_type === 'material' ? 'material' : 'item',
            style_id: enemyStyleId,
            quantity: 1
          };

          if (entry.lootable_type === 'material') {
            drop.material_id = entry.lootable_id;
            drop.material_name = entry.lootable_name;
          } else {
            drop.item_type_id = entry.lootable_id;
            drop.item_type_name = entry.lootable_name;
          }

          drops.push(drop);
          break;
        }
      }
    }

    return drops;
  }

  /**
   * Get style name by style ID
   */
  async getStyleName(styleId: string): Promise<string> {
    const { data, error } = await this.client
      .from('styles')
      .select('name')
      .eq('id', styleId)
      .single();

    if (error || !data) {
      return 'normal'; // Fallback to 'normal' style if not found
    }

    return data.name;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Build pool filter for location matching
   * Supports: universal | location_type | state | country | lat_range | lng_range
   */
  private buildPoolFilter(location: Location): string {
    const filters: string[] = [];

    // Universal pools always match
    filters.push(`filter_type.eq.universal`);

    // Location type matching
    if (location.location_type) {
      filters.push(`and(filter_type.eq.location_type,filter_value.eq.${location.location_type})`);
    }

    // State matching
    if (location.state_code) {
      filters.push(`and(filter_type.eq.state,filter_value.eq.${location.state_code})`);
    }

    // Country matching
    if (location.country_code) {
      filters.push(`and(filter_type.eq.country,filter_value.eq.${location.country_code})`);
    }

    // TODO: Implement lat_range and lng_range matching
    // These would require parsing filter_value as "min,max" ranges
    // and checking if location coordinates fall within bounds

    return filters.join(',');
  }

  /**
   * Calculate material drop weight with tier multipliers
   * Note: This is a simplified implementation - the actual tier calculation
   * would require looking up material stats and determining the tier
   */
  private calculateMaterialDropWeight(
    entry: LootPoolEntry,
    tierWeights: Map<string, number>
  ): number {
    // For now, use base weight since we don't have material tier lookup
    // In a full implementation, this would:
    // 1. Fetch material stats by entry.lootable_id
    // 2. Calculate material strength tier based on stats
    // 3. Apply corresponding tier weight multiplier

    const baseTier = 'common'; // Default tier assumption
    const multiplier = tierWeights.get(baseTier) || 1.0;

    return entry.drop_weight * multiplier;
  }

  /**
   * Advanced enemy pool query with aggregated spawn weights
   * This method would be used by a future RPC function for optimization
   */
  async getAggregatedEnemyPools(locationId: string, combatLevel: number) {
    // This would call a future RPC: get_matching_enemy_pools(p_location_id, p_combat_level)
    // For now, we implement the logic in application code
    const location = await this.findById(locationId);
    if (!location) {
      throw new NotFoundError('Location', locationId);
    }

    const poolIds = await this.getMatchingEnemyPools(location, combatLevel);
    const poolMembers = await this.getEnemyPoolMembers(poolIds);

    // Aggregate spawn weights by enemy type
    const aggregated = new Map<string, number>();
    poolMembers.forEach(member => {
      const current = aggregated.get(member.enemy_type_id) || 0;
      aggregated.set(member.enemy_type_id, current + member.spawn_weight);
    });

    return Array.from(aggregated.entries()).map(([enemy_type_id, spawn_weight]) => ({
      enemy_type_id,
      spawn_weight
    }));
  }

  /**
   * Advanced loot pool query with applied tier weight multipliers
   * This method would be used by a future RPC function for optimization
   */
  async getAggregatedLootPools(locationId: string, combatLevel: number) {
    // This would call a future RPC: get_matching_loot_pools(p_location_id, p_combat_level)
    // For now, we implement the logic in application code
    const location = await this.findById(locationId);
    if (!location) {
      throw new NotFoundError('Location', locationId);
    }

    const poolIds = await this.getMatchingLootPools(location, combatLevel);
    const poolEntries = await this.getLootPoolEntries(poolIds);
    const tierWeights = await this.getLootPoolTierWeights(poolIds);

    // Apply tier weights to entries
    const tierWeightMap = new Map<string, Map<string, number>>();
    tierWeights.forEach(tw => {
      if (!tierWeightMap.has(tw.loot_pool_id)) {
        tierWeightMap.set(tw.loot_pool_id, new Map());
      }
      tierWeightMap.get(tw.loot_pool_id)!.set(tw.tier_name, tw.weight_multiplier);
    });

    return poolEntries.map(entry => ({
      ...entry,
      adjusted_weight: this.calculateMaterialDropWeight(
        entry,
        tierWeightMap.get(entry.loot_pool_id) || new Map()
      )
    }));
  }
}

export const locationRepository = new LocationRepository();