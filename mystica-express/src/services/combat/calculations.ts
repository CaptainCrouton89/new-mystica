import { HitBand, EnemyStats, PlayerStats, WeaponConfig } from './types.js';
import { ZONE_MULTIPLIERS, MIN_DAMAGE, HIT_BAND_TO_ZONE } from './constants.js';
import { AdjustedBands } from '../../types/repository.types.js';
import { statsService } from '../StatsService.js';
import { logger } from '../../utils/logger.js';
import { EnemyRepository } from '../../repositories/EnemyRepository.js';
import { WeaponRepository } from '../../repositories/WeaponRepository.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

export function hitBandToZone(hitBand: HitBand): 1 | 2 | 3 | 4 | 5 {
  return HIT_BAND_TO_ZONE[hitBand];
}
export function determineHitZone(tapDegrees: number, adjustedBands: AdjustedBands): HitBand {
  let cumulativeDegrees = 0;

  if (tapDegrees < adjustedBands.deg_crit) {
    logger.debug(`🎯 Hit zone: CRIT (${tapDegrees}°)`);
    return 'crit';
  }
  cumulativeDegrees += adjustedBands.deg_crit;

  if (tapDegrees < cumulativeDegrees + adjustedBands.deg_normal) {
    logger.debug(`🎯 Hit zone: NORMAL (${tapDegrees}°)`);
    return 'normal';
  }
  cumulativeDegrees += adjustedBands.deg_normal;

  if (tapDegrees < cumulativeDegrees + adjustedBands.deg_graze) {
    logger.debug(`🎯 Hit zone: GRAZE (${tapDegrees}°)`);
    return 'graze';
  }
  cumulativeDegrees += adjustedBands.deg_graze;

  if (tapDegrees < cumulativeDegrees + adjustedBands.deg_miss) {
    logger.debug(`🎯 Hit zone: MISS (${tapDegrees}°)`);
    return 'miss';
  }

  logger.debug(`🎯 Hit zone: INJURE (${tapDegrees}°)`);
  return 'injure';
}

export function calculateDamage(attackerAtk: number, defenderDef: number, hitZone: HitBand): {
  damage: number;
  critBonus?: number;
} {
  const attackZone = hitBandToZone(hitZone);

  const critMultiplier = statsService.getCritMultiplier(attackZone);

  if (hitZone === 'injure') {
    const selfDamage = Math.max(MIN_DAMAGE, Math.floor(statsService.applyZoneModifiers(attackerAtk, attackZone, critMultiplier)));
    return {
      damage: selfDamage,
      critBonus: critMultiplier - 1.0 > 0 ? critMultiplier - 1.0 : undefined,
    };
  }

  const baseDamage = Math.max(MIN_DAMAGE, attackerAtk - defenderDef);
  const zoneDamage = Math.floor(statsService.applyZoneModifiers(baseDamage, attackZone, critMultiplier));

  return {
    damage: zoneDamage,
    critBonus: critMultiplier - 1.0 > 0 ? critMultiplier - 1.0 : undefined,
  };
}

export async function calculateEnemyStats(
  enemyRepository: EnemyRepository,
  enemyTypeId: string,
  selectedStyleId: string,
  combatLevel?: number
): Promise<EnemyStats> {
  const level = combatLevel || 1;

  const enemyWithTier = await enemyRepository.getEnemyTypeWithTier(enemyTypeId);
  if (!enemyWithTier?.enemyType || !enemyWithTier.tier) {
    throw new NotFoundError('Enemy type or tier', enemyTypeId);
  }

  const { enemyType, tier } = enemyWithTier;

  const realizedStats = statsService.calculateEnemyRealizedStats(
    enemyType,
    level,
    tier
  );

  if (!enemyType.base_hp) {
    throw new ValidationError('Enemy type must have base_hp');
  }
  const hp = Math.floor(enemyType.base_hp * tier.difficulty_multiplier);

  if (!enemyType.dialogue_tone) {
    throw new Error(`Enemy type ${enemyTypeId} missing required dialogue_tone`);
  }

  return {
    
    atk_power: realizedStats.atk_power,
    atk_accuracy: realizedStats.atk_accuracy,
    def_power: realizedStats.def_power,
    def_accuracy: realizedStats.def_accuracy,
    hp,
    
    atk_power_normalized: enemyType.atk_power_normalized,
    atk_accuracy_normalized: enemyType.atk_accuracy_normalized,
    def_power_normalized: enemyType.def_power_normalized,
    def_accuracy_normalized: enemyType.def_accuracy_normalized,
    
    style_id: selectedStyleId,
    dialogue_tone: enemyType.dialogue_tone,
    personality_traits: enemyType.ai_personality_traits
      ? Object.keys(enemyType.ai_personality_traits)
      : [],
  };
}

export function calculateWinProbability(playerRating: number, enemyRating: number): number {
  const ratingDiff = playerRating - enemyRating;
  return 1.0 / (1.0 + Math.pow(10, -ratingDiff / 400));
}

export function selectRandomStyle(styles: Array<{ style_id: string; weight_multiplier: number }>): string {
  if (styles.length === 0) {
    throw new Error('Cannot select style from empty array');
  }

  if (styles.length === 1) {
    return styles[0].style_id;
  }

  const totalWeight = styles.reduce((sum, style) => sum + style.weight_multiplier, 0);

  if (totalWeight <= 0) {
    throw new Error('Total weight must be positive for style selection');
  }

  const randomValue = Math.random() * totalWeight;

  let cumulativeWeight = 0;
  for (const style of styles) {
    cumulativeWeight += style.weight_multiplier;
    if (randomValue <= cumulativeWeight) {
      return style.style_id;
    }
  }

  throw new Error('Weighted random selection failed: no style selected despite valid weights');
}

export async function getExpectedDamageMultiplier(
  weaponRepository: WeaponRepository,
  weaponId: string | null,
  accuracy: number
): Promise<number> {
  if (!weaponId) {
    throw new ValidationError('Weapon ID is required for damage multiplier calculation');
  }

  return await weaponRepository.getExpectedDamageMultiplier(weaponId, accuracy);
}
