import type { ZoneDistribution } from '../types/api.types.js';
import { EquipmentSlot, PlayerStats, Stats } from '../types/api.types.js';
import { Database } from '../types/database.types.js';
import { MaterialInstanceWithTemplate } from '../types/repository.types.js';
import { ValidationError } from '../utils/errors.js';

type EnemyType = Database['public']['Tables']['enemytypes']['Row'];
type Tier = Database['public']['Tables']['tiers']['Row'];

export class StatsService {
  public computeItemStats(
    baseStats: Stats,
    level: number,
    materials: MaterialInstanceWithTemplate[] = []
  ): Stats {
    if (level < 1) {
      throw new ValidationError("Level must be 1 or greater");
    }

    const baseStatsSum =
      baseStats.atkPower +
      baseStats.atkAccuracy +
      baseStats.defPower +
      baseStats.defAccuracy;
    if (Math.abs(baseStatsSum - 1.0) > 0.01) {
      throw new ValidationError(
        `Base stats must sum to approximately 1.0, got ${baseStatsSum}`
      );
    }

    if (materials.length > 3) {
      throw new ValidationError("Cannot apply more than 3 materials");
    }

    if (materials.length > 0) {
      this.validateMaterialModifiers(materials);
    }

    const levelMultiplier = this.getLevelMultiplier(level);
    const levelScaled: Stats = {
      atkPower: baseStats.atkPower * levelMultiplier,
      atkAccuracy: baseStats.atkAccuracy * levelMultiplier,
      defPower: baseStats.defPower * levelMultiplier,
      defAccuracy: baseStats.defAccuracy * levelMultiplier,
    };

    const materialMods = materials.reduce(
      (acc, material) => ({
        atkPower: acc.atkPower + material.material.stat_modifiers.atkPower,
        atkAccuracy:
          acc.atkAccuracy + material.material.stat_modifiers.atkAccuracy,
        defPower: acc.defPower + material.material.stat_modifiers.defPower,
        defAccuracy:
          acc.defAccuracy + material.material.stat_modifiers.defAccuracy,
      }),
      { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 }
    );

    return {
      atkPower: levelScaled.atkPower + materialMods.atkPower,
      atkAccuracy: levelScaled.atkAccuracy + materialMods.atkAccuracy,
      defPower: levelScaled.defPower + materialMods.defPower,
      defAccuracy: levelScaled.defAccuracy + materialMods.defAccuracy,
    };
  }

  public computeItemStatsForLevel(item: ItemWithType, level: number): Stats {
    if (level < 1) {
      throw new ValidationError("Level must be 1 or greater");
    }

    const baseStats = item.item_type.base_stats_normalized;
    const baseStatsSum =
      baseStats.atkPower +
      baseStats.atkAccuracy +
      baseStats.defPower +
      baseStats.defAccuracy;
    if (Math.abs(baseStatsSum - 1.0) > 0.01) {
      throw new ValidationError(
        `Base stats must sum to approximately 1.0, got ${baseStatsSum}`
      );
    }

    const rarityMultiplier = this.getRarityMultiplier(item.rarity);

    const rarityAdjustedBaseStats = {
      atkPower: baseStats.atkPower * rarityMultiplier,
      atkAccuracy: baseStats.atkAccuracy * rarityMultiplier,
      defPower: baseStats.defPower * rarityMultiplier,
      defAccuracy: baseStats.defAccuracy * rarityMultiplier,
    };

    const levelMultiplier = this.getLevelMultiplier(level);
    const levelScaled: Stats = {
      atkPower: rarityAdjustedBaseStats.atkPower * levelMultiplier,
      atkAccuracy: rarityAdjustedBaseStats.atkAccuracy * levelMultiplier,
      defPower: rarityAdjustedBaseStats.defPower * levelMultiplier,
      defAccuracy: rarityAdjustedBaseStats.defAccuracy * levelMultiplier,
    };

    return levelScaled;
  }

  public computeEquipmentStats(equippedItems: ItemWithStats[]): PlayerStats {
    if (equippedItems.length > 8) {
      throw new ValidationError("Cannot equip more than 8 items");
    }

    const slots = equippedItems.map((item) => item.slot);
    const uniqueSlots = new Set(slots);
    if (slots.length !== uniqueSlots.size) {
      const duplicateSlot = slots.find(
        (slot, index) => slots.indexOf(slot) !== index
      );
      throw new ValidationError(`Duplicate equipment slot: ${duplicateSlot}`);
    }

    const allSlots: EquipmentSlot[] = [
      "weapon",
      "offhand",
      "head",
      "armor",
      "feet",
      "accessory_1",
      "accessory_2",
      "pet",
    ];
    const itemContributions: Record<EquipmentSlot, Stats> = {} as Record<
      EquipmentSlot,
      Stats
    >;

    allSlots.forEach((slot) => {
      itemContributions[slot] = {
        atkPower: 0,
        atkAccuracy: 0,
        defPower: 0,
        defAccuracy: 0,
      };
    });

    let totalStats: Stats = {
      atkPower: 0,
      atkAccuracy: 0,
      defPower: 0,
      defAccuracy: 0,
    };
    let totalItemLevel = 0;

    equippedItems.forEach((item) => {
      itemContributions[item.slot] = item.computed_stats;

      totalStats.atkPower += item.computed_stats.atkPower;
      totalStats.atkAccuracy += item.computed_stats.atkAccuracy;
      totalStats.defPower += item.computed_stats.defPower;
      totalStats.defAccuracy += item.computed_stats.defAccuracy;

      totalItemLevel += item.level;
    });

    return {
      total_stats: totalStats,
      item_contributions: itemContributions,
      equipped_items_count: equippedItems.length,
      total_item_level: totalItemLevel,
    };
  }

  public validateMaterialModifiers(materials: MaterialInstanceWithTemplate[]): boolean {
    const tolerance = 0.01;

    for (const material of materials) {
      const modifiers = material.material.stat_modifiers;
      const sum =
        modifiers.atkPower +
        modifiers.atkAccuracy +
        modifiers.defPower +
        modifiers.defAccuracy;

      if (Math.abs(sum) > tolerance) {
        throw new ValidationError(
          `Material ${material.material_id} stat modifiers must sum to 0, got ${sum}`
        );
      }
    }

    const totalMods = materials.reduce(
      (acc, mat) => ({
        atkPower: acc.atkPower + mat.material.stat_modifiers.atkPower,
        atkAccuracy: acc.atkAccuracy + mat.material.stat_modifiers.atkAccuracy,
        defPower: acc.defPower + mat.material.stat_modifiers.defPower,
        defAccuracy: acc.defAccuracy + mat.material.stat_modifiers.defAccuracy,
      }),
      { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 }
    );

    const totalSum =
      totalMods.atkPower +
      totalMods.atkAccuracy +
      totalMods.defPower +
      totalMods.defAccuracy;

    if (Math.abs(totalSum) > tolerance) {
      throw new ValidationError(
        `Combined material modifiers must sum to 0, got ${totalSum}`
      );
    }

    return true;
  }

  private getRarityMultiplier(rarity: string): number {
    const multipliers: Record<string, number> = {
      common: 1.0,
      uncommon: 1.25,
      rare: 1.5,
      epic: 1.75,
      legendary: 2.0,
    };

    const multiplier = multipliers[rarity];
    if (multiplier === undefined) {
      throw new ValidationError(`Invalid rarity: ${rarity}`);
    }

    return multiplier;
  }

  private getLevelMultiplier(level: number): number {
    if (level < 1) {
      throw new ValidationError("Level must be 1 or greater");
    }
    return 1 + 0.05 * Math.pow(level - 1, 2);
  }

  public calculateZoneProbabilities(accuracy: number): ZoneDistribution {
    if (accuracy < 0 || accuracy > 1) {
      throw new ValidationError("Accuracy must be between 0 and 1");
    }

    const a = this.clamp01(accuracy);

    const p1 = this.curve(a, [
      { x: 0.05, y: 0.02 },
      { x: 0.25, y: 0.2 },
      { x: 0.5, y: 0.5 },
      { x: 1.0, y: 0.95 },
    ]);

    const p2 = this.curve(a, [
      { x: 0.0, y: 0.45 },
      { x: 0.05, y: 0.5 },
      { x: 0.25, y: 0.58 },
      { x: 0.5, y: 0.45 },
      { x: 1.0, y: 0.05 },
    ]);

    const remaining = Math.max(0, 1 - p1 - p2);

    const w3 = 1 - 0.2 * a;
    const w4 = 0.12 * Math.pow(1 - a, 0.7);
    const w5 = 0.03 * Math.pow(1 - a, 2.4);

    const wSum = w3 + w4 + w5 || 1;
    let p3 = remaining * (w3 / wSum);
    let p4 = remaining * (w4 / wSum);
    let p5 = remaining * (w5 / wSum);

    const sum = p1 + p2 + p3 + p4 + p5;
    const k = sum > 0 ? 1 / sum : 1;

    const distribution: ZoneDistribution = {
      zone1: p1 * k,
      zone2: p2 * k,
      zone3: p3 * k,
      zone4: p4 * k,
      zone5: p5 * k,
    };

    const verifySum = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (Math.abs(verifySum - 1.0) > 0.0001) {
      throw new ValidationError(
        `Zone distribution must sum to 1.0, got ${verifySum}`
      );
    }

    return distribution;
  }

  public simulateEnemyZoneHit(accuracy: number): 1 | 2 | 3 | 4 | 5 {
    const distribution = this.calculateZoneProbabilities(accuracy);

    const randomVal = Math.random();
    let cumulativeProb = 0;

    const zoneKeys = ["zone1", "zone2", "zone3", "zone4", "zone5"] as const;
    for (let i = 0; i < zoneKeys.length; i++) {
      cumulativeProb += distribution[zoneKeys[i]];
      if (randomVal <= cumulativeProb) {
        return (i + 1) as 1 | 2 | 3 | 4 | 5;
      }
    }

    throw new ValidationError(
      "Failed to select a zone - distribution does not sum to 1.0"
    );
  }

  public getCritMultiplier(zone: 1 | 2 | 3 | 4 | 5): number {
    const randomFloat = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    switch (zone) {
      case 1:
        return Math.random() < 0.5 ? randomFloat(1.5, 2.0) : 1.0;
      case 2:
        return Math.random() < 0.3 ? randomFloat(1.2, 1.7) : 1.0;
      case 3:
        return Math.random() < 0.2 ? randomFloat(1.1, 1.5) : 1.0;
      case 4:
        return Math.random() < 0.1 ? randomFloat(1.1, 1.2) : 1.0;
      case 5:
        return 1.0;
    }
  }

  public calculateEnemyRealizedStats(
    enemyType: EnemyType,
    combatLevel: number,
    tier: Tier
  ) {
    if (combatLevel < 1) {
      throw new ValidationError("Combat level must be 1 or greater");
    }

    const statsSum =
      enemyType.atk_power_normalized +
      enemyType.atk_accuracy_normalized +
      enemyType.def_power_normalized +
      enemyType.def_accuracy_normalized;

    if (Math.abs(statsSum - 1.0) > 0.01) {
      throw new ValidationError(
        `Normalized enemy stats must sum to 1.0, got ${statsSum}`
      );
    }

    const levelMultiplier = this.getLevelMultiplier(combatLevel);
    return {
      atk_power:
        enemyType.atk_power_normalized *
        8 *
        levelMultiplier *
        tier.difficulty_multiplier,
      atk_accuracy:
        enemyType.atk_accuracy_normalized *
        8 *
        levelMultiplier *
        tier.difficulty_multiplier,
      def_power:
        enemyType.def_power_normalized *
        8 *
        levelMultiplier *
        tier.difficulty_multiplier,
      def_accuracy:
        enemyType.def_accuracy_normalized *
        8 *
        levelMultiplier *
        tier.difficulty_multiplier,
    };
  }

  public applyZoneModifiers(
    baseStat: number,
    zone: 1 | 2 | 3 | 4 | 5,
    critMultiplier: number
  ): number {
    const zoneMultipliers = [1.5, 1.25, 1.0, 0.75, 0.5];
    const zoneMultiplier = zoneMultipliers[zone - 1];
    const result = baseStat * zoneMultiplier * critMultiplier;
    if (baseStat > 10) {
      // Only log significant damage calculations
      console.log(
        `[StatsService.applyZoneModifiers] baseStat=${baseStat}, zone=${zone}, zoneMultiplier=${zoneMultiplier}, critMultiplier=${critMultiplier}, result=${result}`
      );
    }
    return result;
  }

  private clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
  }

  private smoothstep01(t: number): number {
    const u = this.clamp01(t);
    return u * u * (3 - 2 * u);
  }

  private curve(x: number, anchors: { x: number; y: number }[]): number {
    if (anchors.length === 0) {
      throw new ValidationError("Curve anchors array cannot be empty");
    }

    if (anchors.length === 1) {
      return anchors[0].y;
    }

    const a = anchors.slice().sort((p, q) => p.x - q.x);

    if (x <= a[0].x) {
      return a[0].y;
    }
    if (x >= a[a.length - 1].x) {
      return a[a.length - 1].y;
    }

    for (let i = 0; i < a.length - 1; i++) {
      const p = a[i];
      const q = a[i + 1];

      if (x >= p.x && x <= q.x) {
        const t = (x - p.x) / (q.x - p.x);
        const e = this.smoothstep01(t);
        return p.y + (q.y - p.y) * e;
      }
    }

    throw new ValidationError(
      `Failed to find curve segment for x=${x} within anchors range`
    );
  }
}

export const statsService = new StatsService();

interface ItemWithType {
  rarity: string;
  item_type: {
    base_stats_normalized: Stats;
  };
}

interface ItemWithStats {
  slot: EquipmentSlot;
  computed_stats: Stats;
  level: number;
  item_id: string;
}