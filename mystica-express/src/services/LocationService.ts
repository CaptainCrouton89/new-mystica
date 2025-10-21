import { locationRepository } from '../repositories/LocationRepository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { Database } from '../types/database.types.js';

// Type aliases from database schema
type Location = Database['public']['Tables']['locations']['Row'];

/**
 * Handles location-based operations including geospatial queries and combat pool management
 */
export class LocationService {
  /**
   * Find nearby locations within specified radius using PostGIS geography calculations
   * - Uses get_nearby_locations RPC function with ST_DWithin for efficient spatial queries
   * - Returns results ordered by distance (closest first)
   */
  async nearby(lat: number, lng: number, radius: number = 5000) {
    // Validate coordinates
    if (lat < -90 || lat > 90) {
      throw new ValidationError('Latitude must be between -90 and 90');
    }
    if (lng < -180 || lng > 180) {
      throw new ValidationError('Longitude must be between -180 and 180');
    }
    if (radius <= 0 || radius > 50000) {
      throw new ValidationError('Radius must be between 1 and 50000 meters');
    }

    return locationRepository.findNearby(lat, lng, radius);
  }

  /**
   * Get specific location by ID
   * - Fetches complete location data
   * - Throws NotFoundError if location doesn't exist
   */
  async getById(id: string) {
    const location = await locationRepository.findById(id);

    if (!location) {
      throw new NotFoundError('Location', id);
    }

    return location;
  }

  /**
   * Find locations by type (e.g., 'library', 'park', 'restaurant')
   * - Filters locations by location_type field
   */
  async getByType(locationType: string) {
    if (!locationType || locationType.trim().length === 0) {
      throw new ValidationError('Location type is required');
    }

    return locationRepository.findByType(locationType.trim());
  }

  /**
   * Find locations by region (state and country codes)
   * - Filters locations by state_code and country_code
   */
  async getByRegion(stateCode: string, countryCode: string) {
    if (!stateCode || !countryCode) {
      throw new ValidationError('Both state code and country code are required');
    }

    return locationRepository.findByRegion(stateCode.trim(), countryCode.trim());
  }

  /**
   * Get all locations with optional pagination
   * - Returns paginated list of all locations
   */
  async getAll(limit?: number, offset?: number) {
    if (limit !== undefined && (limit <= 0 || limit > 1000)) {
      throw new ValidationError('Limit must be between 1 and 1000');
    }
    if (offset !== undefined && offset < 0) {
      throw new ValidationError('Offset must be non-negative');
    }

    return locationRepository.findAll(limit, offset);
  }

  // ============================================================================
  // Combat Pool Operations
  // ============================================================================

  /**
   * Get matching enemy pools for combat initialization
   * - Combines universal + location-specific pools for given combat level
   * - Returns pool IDs that can be used for enemy selection
   */
  async getMatchingEnemyPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    const location = await this.getById(locationId);
    return locationRepository.getMatchingEnemyPools(location, combatLevel);
  }

  /**
   * Get enemy pool members with spawn weights
   * - Fetches all enemies in given pools with their spawn weights
   * - Used for weighted random enemy selection
   */
  async getEnemyPoolMembers(poolIds: string[]) {
    if (!poolIds || poolIds.length === 0) {
      throw new ValidationError('At least one pool ID is required');
    }

    return locationRepository.getEnemyPoolMembers(poolIds);
  }

  /**
   * Select random enemy from pool members using weighted selection
   * - Implements weighted random algorithm based on spawn_weight
   * - Returns enemy_type_id of selected enemy
   */
  selectRandomEnemy(poolMembers: any[]) {
    if (!poolMembers || poolMembers.length === 0) {
      throw new ValidationError('No enemy pool members provided');
    }

    return locationRepository.selectRandomEnemy(poolMembers);
  }

  /**
   * Get matching loot pools for combat rewards
   * - Uses same filter logic as enemy pools
   * - Returns pool IDs for loot generation
   */
  async getMatchingLootPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    const location = await this.getById(locationId);
    return locationRepository.getMatchingLootPools(location, combatLevel);
  }

  /**
   * Get loot pool entries with base drop weights
   * - Fetches all loot items in given pools
   * - Used for weighted random loot selection
   */
  async getLootPoolEntries(poolIds: string[]) {
    if (!poolIds || poolIds.length === 0) {
      throw new ValidationError('At least one pool ID is required');
    }

    return locationRepository.getLootPoolEntries(poolIds);
  }

  /**
   * Get loot pool tier weights for drop rate calculations
   * - Fetches tier multipliers for material rarity balancing
   * - Applied to base drop weights during loot selection
   */
  async getLootPoolTierWeights(poolIds: string[]) {
    if (!poolIds || poolIds.length === 0) {
      throw new ValidationError('At least one pool ID is required');
    }

    return locationRepository.getLootPoolTierWeights(poolIds);
  }

  /**
   * Select random loot with tier weights and style inheritance
   * - Applies tier multipliers to base drop weights
   * - Implements style inheritance from enemy to materials
   * - Returns array of loot drops
   */
  selectRandomLoot(
    poolEntries: any[],
    tierWeights: any[],
    enemyStyleId: string = 'normal',
    dropCount: number = 1
  ) {
    if (!poolEntries || poolEntries.length === 0) {
      throw new ValidationError('No loot pool entries provided');
    }
    if (dropCount <= 0 || dropCount > 10) {
      throw new ValidationError('Drop count must be between 1 and 10');
    }

    return locationRepository.selectRandomLoot(poolEntries, tierWeights, enemyStyleId, dropCount);
  }

  // ============================================================================
  // Aggregated Pool Operations (Future RPC Optimization)
  // ============================================================================

  /**
   * Get aggregated enemy pools with pre-computed spawn weights
   * - Server-side pool aggregation for performance
   * - Reduces N+1 queries to single operation
   */
  async getAggregatedEnemyPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    return locationRepository.getAggregatedEnemyPools(locationId, combatLevel);
  }

  /**
   * Get aggregated loot pools with applied tier weights
   * - Server-side loot weight calculation for performance
   * - Reduces complex client-side tier weight logic
   */
  async getAggregatedLootPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    return locationRepository.getAggregatedLootPools(locationId, combatLevel);
  }
}

export const locationService = new LocationService();