import { Stats, AppliedMaterial, EquipmentSlot, PlayerStats } from '../types/api.types.js';
import { ValidationError } from '../utils/errors.js';

/**
 * StatsService - Pure calculation service for item and equipment stats
 *
 * Handles:
 * - Item stat calculation with rarity, level, and material modifiers
 * - Equipment stat aggregation across 8 slots
 * - Material modifier validation (zero-sum constraint)
 *
 * NO database dependencies - all data passed as parameters
 */
export class StatsService {

  /**
   * Calculate final item stats with rarity, level scaling, and material modifiers applied
   *
   * Formula: base_stats × rarity_multiplier × level × 10 + material_modifiers
   *
   * Note: This method receives pre-multiplied baseStats that already include
   * the rarity multiplier from the calling service layer.
   */
  computeItemStats(baseStats: Stats, level: number, materials: AppliedMaterial[] = []): Stats {
    // Validate level
    if (level < 1) {
      throw new ValidationError('Level must be 1 or greater');
    }

    // Validate base stats sum to approximately 1.0 (tolerance: ±0.01)
    const baseStatsSum = baseStats.atkPower + baseStats.atkAccuracy + baseStats.defPower + baseStats.defAccuracy;
    if (Math.abs(baseStatsSum - 1.0) > 0.01) {
      throw new ValidationError(`Base stats must sum to approximately 1.0, got ${baseStatsSum}`);
    }

    // Validate materials array length
    if (materials.length > 3) {
      throw new ValidationError('Cannot apply more than 3 materials');
    }

    // Validate material modifiers if any materials are provided
    if (materials.length > 0) {
      this.validateMaterialModifiers(materials);
    }

    // 1. Scale base stats by level (×10 base scaling factor from schema)
    const levelScaled: Stats = {
      atkPower: baseStats.atkPower * level * 10,
      atkAccuracy: baseStats.atkAccuracy * level * 10,
      defPower: baseStats.defPower * level * 10,
      defAccuracy: baseStats.defAccuracy * level * 10
    };

    // 2. Apply material modifiers (zero-sum adjustments)
    const materialMods = materials.reduce((acc, material) => ({
      atkPower: acc.atkPower + material.material.stat_modifiers.atkPower,
      atkAccuracy: acc.atkAccuracy + material.material.stat_modifiers.atkAccuracy,
      defPower: acc.defPower + material.material.stat_modifiers.defPower,
      defAccuracy: acc.defAccuracy + material.material.stat_modifiers.defAccuracy
    }), { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 });

    // 3. Combine scaled stats with material modifiers and round to 2 decimal places
    return {
      atkPower: Math.round((levelScaled.atkPower + materialMods.atkPower) * 100) / 100,
      atkAccuracy: Math.round((levelScaled.atkAccuracy + materialMods.atkAccuracy) * 100) / 100,
      defPower: Math.round((levelScaled.defPower + materialMods.defPower) * 100) / 100,
      defAccuracy: Math.round((levelScaled.defAccuracy + materialMods.defAccuracy) * 100) / 100
    };
  }

  /**
   * Calculate base stats for a specific level without materials
   * Used for stackable items and stat previews
   */
  computeItemStatsForLevel(item: ItemWithType, level: number): Stats {
    // Validate level
    if (level < 1) {
      throw new ValidationError('Level must be 1 or greater');
    }

    // Validate base stats
    const baseStats = item.item_type.base_stats_normalized;
    const baseStatsSum = baseStats.atkPower + baseStats.atkAccuracy + baseStats.defPower + baseStats.defAccuracy;
    if (Math.abs(baseStatsSum - 1.0) > 0.01) {
      throw new ValidationError(`Base stats must sum to approximately 1.0, got ${baseStatsSum}`);
    }

    // Get rarity multiplier
    const rarityMultiplier = this.getRarityMultiplier(item.item_type.rarity);

    // Apply rarity multiplier to base stats
    const rarityAdjustedBaseStats = {
      atkPower: baseStats.atkPower * rarityMultiplier,
      atkAccuracy: baseStats.atkAccuracy * rarityMultiplier,
      defPower: baseStats.defPower * rarityMultiplier,
      defAccuracy: baseStats.defAccuracy * rarityMultiplier
    };

    // Calculate directly without calling computeItemStats to avoid validation
    // 1. Scale base stats by level (×10 base scaling factor from schema)
    const levelScaled: Stats = {
      atkPower: rarityAdjustedBaseStats.atkPower * level * 10,
      atkAccuracy: rarityAdjustedBaseStats.atkAccuracy * level * 10,
      defPower: rarityAdjustedBaseStats.defPower * level * 10,
      defAccuracy: rarityAdjustedBaseStats.defAccuracy * level * 10
    };

    // 2. Round to 2 decimal places and return (no materials)
    return {
      atkPower: Math.round(levelScaled.atkPower * 100) / 100,
      atkAccuracy: Math.round(levelScaled.atkAccuracy * 100) / 100,
      defPower: Math.round(levelScaled.defPower * 100) / 100,
      defAccuracy: Math.round(levelScaled.defAccuracy * 100) / 100
    };
  }

  /**
   * Sum stats from all equipped items
   * Returns aggregated player stats for combat
   */
  computeEquipmentStats(equippedItems: ItemWithStats[]): PlayerStats {
    // Validate equipped items count
    if (equippedItems.length > 8) {
      throw new ValidationError('Cannot equip more than 8 items');
    }

    // Check for duplicate slots
    const slots = equippedItems.map(item => item.slot);
    const uniqueSlots = new Set(slots);
    if (slots.length !== uniqueSlots.size) {
      const duplicateSlot = slots.find((slot, index) => slots.indexOf(slot) !== index);
      throw new ValidationError(`Duplicate equipment slot: ${duplicateSlot}`);
    }

    // Initialize all slots with zero stats
    const allSlots: EquipmentSlot[] = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
    const itemContributions: Record<EquipmentSlot, Stats> = {} as Record<EquipmentSlot, Stats>;

    allSlots.forEach(slot => {
      itemContributions[slot] = { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };
    });

    // Initialize totals
    let totalStats: Stats = { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };
    let totalItemLevel = 0;

    // Sum stats from equipped items
    equippedItems.forEach(item => {
      itemContributions[item.slot] = item.computed_stats;

      totalStats.atkPower += item.computed_stats.atkPower;
      totalStats.atkAccuracy += item.computed_stats.atkAccuracy;
      totalStats.defPower += item.computed_stats.defPower;
      totalStats.defAccuracy += item.computed_stats.defAccuracy;

      totalItemLevel += item.level;
    });

    return {
      total_stats: {
        atkPower: Math.round(totalStats.atkPower * 100) / 100,
        atkAccuracy: Math.round(totalStats.atkAccuracy * 100) / 100,
        defPower: Math.round(totalStats.defPower * 100) / 100,
        defAccuracy: Math.round(totalStats.defAccuracy * 100) / 100
      },
      item_contributions: itemContributions,
      equipped_items_count: equippedItems.length,
      total_item_level: totalItemLevel
    };
  }

  /**
   * Validate material stat modifiers are zero-sum
   * Each individual material must sum to 0, total of all materials must sum to 0
   */
  validateMaterialModifiers(materials: AppliedMaterial[]): boolean {
    const tolerance = 0.01;

    // Validate each individual material sums to 0
    for (const material of materials) {
      const modifiers = material.material.stat_modifiers;
      const sum = modifiers.atkPower + modifiers.atkAccuracy + modifiers.defPower + modifiers.defAccuracy;

      if (Math.abs(sum) > tolerance) {
        throw new ValidationError(
          `Material ${material.material_id} stat modifiers must sum to 0, got ${sum}`
        );
      }
    }

    // Validate total material impact is also zero-sum
    const totalMods = materials.reduce((acc, mat) => ({
      atkPower: acc.atkPower + mat.material.stat_modifiers.atkPower,
      atkAccuracy: acc.atkAccuracy + mat.material.stat_modifiers.atkAccuracy,
      defPower: acc.defPower + mat.material.stat_modifiers.defPower,
      defAccuracy: acc.defAccuracy + mat.material.stat_modifiers.defAccuracy
    }), { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 });

    const totalSum = totalMods.atkPower + totalMods.atkAccuracy + totalMods.defPower + totalMods.defAccuracy;

    if (Math.abs(totalSum) > tolerance) {
      throw new ValidationError(
        `Combined material modifiers must sum to 0, got ${totalSum}`
      );
    }

    return true;
  }

  /**
   * Internal rarity multiplier lookup
   * Hardcoded values to avoid database dependency
   */
  private getRarityMultiplier(rarity: string): number {
    const multipliers: Record<string, number> = {
      'common': 1.0,
      'uncommon': 1.25,
      'rare': 1.5,
      'epic': 1.75,
      'legendary': 2.0
    };

    const multiplier = multipliers[rarity];
    if (multiplier === undefined) {
      throw new ValidationError(`Invalid rarity: ${rarity}`);
    }

    return multiplier;
  }
}

// Helper interfaces for type safety
interface ItemWithType {
  item_type: {
    base_stats_normalized: Stats;
    rarity: string;
  };
}

interface ItemWithStats {
  slot: EquipmentSlot;
  computed_stats: Stats;
  level: number;
  item_id: string;
}

// Export singleton instance
export const statsService = new StatsService();