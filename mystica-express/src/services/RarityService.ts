import { rarityRepository } from '../repositories/RarityRepository.js';
import type { Database } from '../types/database.types.js';

// Type aliases from database schema
type RarityDefinition = Database['public']['Tables']['raritydefinitions']['Row'];

/**
 * Service for read-only access to rarity definitions and their stat multipliers/drop rates.
 * Provides simple data access for the RarityDefinitions table, supporting item display UI
 * with rarity colors, names, and multiplier values for client-side calculations.
 */
export class RarityService {
  /**
   * Retrieve all rarity definitions ordered by stat multiplier (common first).
   *
   * This method fetches all 5 rarity definitions (common, uncommon, rare, epic, legendary)
   * from the database with their complete configuration including:
   * - stat_multiplier: Item stat scaling (1.000 to 2.000)
   * - base_drop_rate: Loot probability (0.01000 to 0.60000)
   * - display_name: User-friendly names ("Common", "Uncommon", etc.)
   * - color_hex: UI colors ("#FFFFFF", "#1EFF00", etc.)
   *
   * Results are ordered by stat_multiplier ascending, ensuring common rarity appears first.
   *
   * @returns Promise<RarityDefinition[]> Array of all rarity definitions
   * @throws {DatabaseError} When Supabase query fails or connection issues occur
   *
   * @example
   * ```typescript
   * const rarities = await rarityService.getAllRarities();
   * const rarityMap = Object.fromEntries(
   *   rarities.map(r => [r.rarity, r])
   * );
   *
   * // Apply rarity color to item display
   * const itemColor = rarityMap[item.rarity]?.color_hex || '#FFFFFF';
   *
   * // Calculate final item stats
   * const finalAttack = baseAttack * rarityMap[item.rarity]?.stat_multiplier || 1.0;
   * ```
   */
  async getAllRarities(): Promise<RarityDefinition[]> {
    return rarityRepository.getAllRarities();
  }
}

/**
 * Singleton instance of RarityService for use across the application
 */
export const rarityService = new RarityService();