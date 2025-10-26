/**
 * Repository layer exports
 *
 * Central export point for all repository classes.
 * Repositories handle data access and persistence operations.
 */

export { BaseRepository } from './BaseRepository.js';
export { EquipmentRepository } from './EquipmentRepository.js';
export { ItemRepository } from './ItemRepository.js';
export { ItemTypeRepository } from './ItemTypeRepository.js';
export { LocationRepository, locationRepository } from './LocationRepository.js';
export { MaterialRepository } from './MaterialRepository.js';
export { ProfileRepository } from './ProfileRepository.js';
export { RarityRepository, rarityRepository } from './RarityRepository.js';
export { StyleRepository, styleRepository } from './StyleRepository.js';

// Type exports for repository layer
export type {
  CurrencyBalanceUpdate, EconomyTransactionData, PaginationParams, PlayerProgressionUpdate, QueryFilter, SortParams
} from '../types/repository.types.js';
