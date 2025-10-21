import { Stats, NotImplementedError } from '../types/api.types';

interface AppliedMaterial {
  material_id: string;
  is_shiny: boolean;
  stat_modifiers: Stats;
}

/**
 * Handles stat calculations and combat formulas
 */
export class StatsService {
  /**
   * Compute item stats with level scaling and material bonuses
   * - Scales base stats by item level (linear multiplication)
   * - Applies material modifiers with shiny bonus (1.2x multiplier)
   * - Returns final computed stats for the item
   */
  computeItemStats(
    baseStats: Stats,
    level: number,
    materials: AppliedMaterial[]
  ): Stats {
    // TODO: Implement stat computation formula
    // 1. Scale base stats by level: base_stats × level
    // 2. For each material:
    //    - Apply shiny multiplier if is_shiny: modifiers × 1.2
    //    - Add to running total
    // 3. Combine: scaled_base + material_totals
    // 4. Return final Stats object
    throw new NotImplementedError('StatsService.computeItemStats not implemented');
  }

  /**
   * Compute total player stats from all equipped items
   * - Sums stats from all 8 equipment slots
   * - Each item contributes its computed stats
   * - Returns aggregate player stats for combat
   */
  computeTotalStats(equippedItems: (Item | undefined)[]): Stats {
    // TODO: Implement total stats computation
    // 1. Initialize stats to zero
    // 2. For each equipped item (filter undefined):
    //    - Get item's computed stats
    //    - Add to running total
    // 3. Return aggregate Stats object
    throw new NotImplementedError('StatsService.computeTotalStats not implemented');
  }
}

export const statsService = new StatsService();