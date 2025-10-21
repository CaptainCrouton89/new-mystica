import { Stats, Item } from '../types/api.types';
import { NotImplementedError } from '../utils/errors';

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
  /**
   * Simplified compute item stats for upgrade system
   * - Uses simplified formula for MVP0: base_stats × target_level × 10
   * - No material or rarity modifiers in MVP0
   */
  computeItemStatsForLevel(item: any, targetLevel: number): Stats {
    const baseStats = item.base_stats || item.item_type?.base_stats;
    if (!baseStats) {
      throw new Error('Item missing base stats');
    }

    // MVP0 simplified formula: final_stats = base_stats × target_level × 10
    return {
      atkPower: Math.floor(baseStats.atkPower * targetLevel * 10),
      atkAccuracy: Math.floor(baseStats.atkAccuracy * targetLevel * 10),
      defPower: Math.floor(baseStats.defPower * targetLevel * 10),
      defAccuracy: Math.floor(baseStats.defAccuracy * targetLevel * 10)
    };
  }

  computeItemStats(
    baseStats: Stats,
    level: number,
    materials: AppliedMaterial[] = []
  ): Stats {
    // 1. Scale base stats by level and apply MVP0 simplified formula: base_stats × level × 10
    const scaledBase: Stats = {
      atkPower: Math.floor(baseStats.atkPower * level * 10),
      atkAccuracy: Math.floor(baseStats.atkAccuracy * level * 10),
      defPower: Math.floor(baseStats.defPower * level * 10),
      defAccuracy: Math.floor(baseStats.defAccuracy * level * 10)
    };

    // 2. Apply material modifiers (if any)
    let materialBonus: Stats = {
      atkPower: 0,
      atkAccuracy: 0,
      defPower: 0,
      defAccuracy: 0
    };

    for (const material of materials) {
      const modifiers = material.stat_modifiers;
      const shinyMultiplier = material.is_shiny ? 1.2 : 1.0;

      materialBonus.atkPower += Math.floor(modifiers.atkPower * shinyMultiplier);
      materialBonus.atkAccuracy += Math.floor(modifiers.atkAccuracy * shinyMultiplier);
      materialBonus.defPower += Math.floor(modifiers.defPower * shinyMultiplier);
      materialBonus.defAccuracy += Math.floor(modifiers.defAccuracy * shinyMultiplier);
    }

    // 3. Combine scaled base stats with material bonuses
    return {
      atkPower: scaledBase.atkPower + materialBonus.atkPower,
      atkAccuracy: scaledBase.atkAccuracy + materialBonus.atkAccuracy,
      defPower: scaledBase.defPower + materialBonus.defPower,
      defAccuracy: scaledBase.defAccuracy + materialBonus.defAccuracy
    };
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