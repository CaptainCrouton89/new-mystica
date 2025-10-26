import { locationRepository } from '../repositories/LocationRepository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { Database } from '../types/database.types.js';

type Location = Database['public']['Tables']['locations']['Row'];

export class LocationService {
  async nearby(lat: number, lng: number, radius: number = 5000) {
    
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

  async getById(id: string) {
    const location = await locationRepository.findById(id);

    if (!location) {
      throw new NotFoundError('Location', id);
    }

    return location;
  }

  async getByType(locationType: string) {
    if (!locationType || locationType.trim().length === 0) {
      throw new ValidationError('Location type is required');
    }

    return locationRepository.findByType(locationType.trim());
  }

  async getByRegion(stateCode: string, countryCode: string) {
    if (!stateCode || !countryCode) {
      throw new ValidationError('Both state code and country code are required');
    }

    return locationRepository.findByRegion(stateCode.trim(), countryCode.trim());
  }

  async getAll(limit?: number, offset?: number) {
    if (limit !== undefined && (limit <= 0 || limit > 1000)) {
      throw new ValidationError('Limit must be between 1 and 1000');
    }
    if (offset !== undefined && offset < 0) {
      throw new ValidationError('Offset must be non-negative');
    }

    return locationRepository.findAll(limit, offset);
  }

  async getMatchingEnemyPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    const location = await this.getById(locationId);
    return locationRepository.getMatchingEnemyPools(location, combatLevel);
  }

  async getEnemyPoolMembers(poolIds: string[]) {
    if (!poolIds || poolIds.length === 0) {
      throw new ValidationError('At least one pool ID is required');
    }

    return locationRepository.getEnemyPoolMembers(poolIds);
  }

  selectRandomEnemy(poolMembers: any[]) {
    if (!poolMembers || poolMembers.length === 0) {
      throw new ValidationError('No enemy pool members provided');
    }

    return locationRepository.selectRandomEnemy(poolMembers);
  }

  async getMatchingLootPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    const location = await this.getById(locationId);
    return locationRepository.getMatchingLootPools(location, combatLevel);
  }

  async getLootPoolEntries(poolIds: string[]) {
    if (!poolIds || poolIds.length === 0) {
      throw new ValidationError('At least one pool ID is required');
    }

    return locationRepository.getLootPoolEntries(poolIds);
  }

  async getLootPoolTierWeights(poolIds: string[]) {
    if (!poolIds || poolIds.length === 0) {
      throw new ValidationError('At least one pool ID is required');
    }

    return locationRepository.getLootPoolTierWeights(poolIds);
  }

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

  async getAggregatedEnemyPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    return locationRepository.getAggregatedEnemyPools(locationId, combatLevel);
  }

  async getAggregatedLootPools(locationId: string, combatLevel: number) {
    if (combatLevel <= 0 || combatLevel > 100) {
      throw new ValidationError('Combat level must be between 1 and 100');
    }

    return locationRepository.getAggregatedLootPools(locationId, combatLevel);
  }

  async getStyleName(styleId: string): Promise<string> {
    return locationRepository.getStyleName(styleId);
  }
}

export const locationService = new LocationService();