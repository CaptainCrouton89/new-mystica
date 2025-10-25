import { HitBand, PlayerStats, EnemyStats, WeaponConfig } from './types.js';
import { ZONE_MULTIPLIERS, MIN_DAMAGE } from './constants.js';
import { hitBandToZone, determineHitZone } from './calculations.js';
import { statsService } from '../StatsService.js';
import { logger } from '../../utils/logger.js';

export interface ZoneHitInfo {
  zone: 1 | 2 | 3 | 4 | 5;
  zone_multiplier: number;
  crit_occurred: boolean;
  crit_multiplier: number | null;
  final_damage: number;
}

export interface AttackTurnResult {
  hitZone: HitBand;
  damageDealt: number;
  enemyDefenseZoneHitInfo: ZoneHitInfo;
  enemyDamageBlocked: number;
  enemyActualDamageTaken: number;
  enemyDamage: number;
  newPlayerHP: number;
  newEnemyHP: number;
  playerZoneHitInfo: ZoneHitInfo;
  enemyZoneHitInfo: ZoneHitInfo;
  combatStatus: 'ongoing' | 'victory' | 'defeat';
}

export interface DefenseTurnResult {
  hitZone: HitBand;
  damageBlocked: number;
  damageActuallyTaken: number;
  newPlayerHP: number;
  currentEnemyHP: number;
  playerDefenseZoneHitInfo: ZoneHitInfo;
  enemyZoneHitInfo: ZoneHitInfo;
  combatStatus: 'ongoing' | 'victory' | 'defeat';
}

export function calculateEnemyAttack(
  enemyStats: EnemyStats,
  playerDefPower: number
): { damage: number; zoneHitInfo: ZoneHitInfo } {
  const enemyZone = statsService.simulateEnemyZoneHit(enemyStats.atk_accuracy_normalized);
  const enemyCritMultiplier = statsService.getCritMultiplier(enemyZone);
  const enemyBaseDamage = Math.max(MIN_DAMAGE, enemyStats.atk_power - playerDefPower);
  const enemyDamage = Math.floor(
    statsService.applyZoneModifiers(enemyBaseDamage, enemyZone, enemyCritMultiplier)
  );

  return {
    damage: enemyDamage,
    zoneHitInfo: {
      zone: enemyZone,
      zone_multiplier: ZONE_MULTIPLIERS[enemyZone],
      crit_occurred: enemyCritMultiplier > 1.0,
      crit_multiplier: enemyCritMultiplier > 1.0 ? enemyCritMultiplier : null,
      final_damage: enemyDamage,
    },
  };
}

export function calculatePlayerAttack(
  hitZone: HitBand,
  playerStats: PlayerStats,
  enemyDefPower: number
): { damage: number; zoneHitInfo: ZoneHitInfo } {
  const playerZone = hitBandToZone(hitZone);
  const playerCritMultiplier = statsService.getCritMultiplier(playerZone);
  const baseDamage = Math.max(MIN_DAMAGE, playerStats.atkPower - enemyDefPower);
  const playerDamage = Math.floor(
    statsService.applyZoneModifiers(baseDamage, playerZone, playerCritMultiplier)
  );

  const playerZoneMultiplier = ZONE_MULTIPLIERS[playerZone];
  const playerCritOccurred = playerCritMultiplier > 1.0;

  return {
    damage: playerDamage,
    zoneHitInfo: {
      zone: playerZone,
      zone_multiplier: playerZoneMultiplier,
      crit_occurred: playerCritOccurred,
      crit_multiplier: playerCritOccurred ? playerCritMultiplier : null,
      final_damage: playerDamage,
    },
  };
}

export function executeAttackTurn(
  tapPositionDegrees: number,
  weaponConfig: WeaponConfig,
  playerStats: PlayerStats,
  enemyStats: EnemyStats,
  currentPlayerHP: number,
  currentEnemyHP: number
): AttackTurnResult {

  const hitZone = determineHitZone(tapPositionDegrees, weaponConfig.adjusted_bands);

  const playerAttack = calculatePlayerAttack(hitZone, playerStats, enemyStats.def_power);
  const damageDealt = playerAttack.damage;

  // Enemy simulates defensive zone using their def_accuracy_normalized
  const enemyDefenseZone = statsService.simulateEnemyZoneHit(enemyStats.def_accuracy_normalized);
  const enemyDefenseZoneMultiplier = ZONE_MULTIPLIERS[enemyDefenseZone];
  const enemyDefense = enemyStats.def_power * enemyDefenseZoneMultiplier;
  const enemyDamageBlocked = enemyDefense;
  const enemyActualDamageTaken = Math.max(MIN_DAMAGE, damageDealt - enemyDefense);

  const enemyDefenseZoneHitInfo: ZoneHitInfo = {
    zone: enemyDefenseZone,
    zone_multiplier: enemyDefenseZoneMultiplier,
    crit_occurred: false,
    crit_multiplier: null,
    final_damage: enemyDamageBlocked,
  };

  const enemyAttack = calculateEnemyAttack(enemyStats, playerStats.defPower);
  const enemyDamage = enemyAttack.damage;

  let newPlayerHP = currentPlayerHP;
  let newEnemyHP = currentEnemyHP;

  if (hitZone === 'injure') {

    newPlayerHP = Math.max(0, currentPlayerHP - damageDealt - enemyDamage);
    newEnemyHP = currentEnemyHP;
  } else {

    newPlayerHP = Math.max(0, currentPlayerHP - enemyDamage);
    newEnemyHP = Math.max(0, currentEnemyHP - enemyActualDamageTaken);
  }

  let combatStatus: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
  if (newEnemyHP <= 0) {
    combatStatus = 'victory';
  } else if (newPlayerHP <= 0) {
    combatStatus = 'defeat';
  }

  return {
    hitZone,
    damageDealt,
    enemyDefenseZoneHitInfo,
    enemyDamageBlocked,
    enemyActualDamageTaken,
    enemyDamage,
    newPlayerHP,
    newEnemyHP,
    playerZoneHitInfo: playerAttack.zoneHitInfo,
    enemyZoneHitInfo: enemyAttack.zoneHitInfo,
    combatStatus,
  };
}

export function executeDefenseTurn(
  tapPositionDegrees: number,
  weaponConfig: WeaponConfig,
  playerStats: PlayerStats,
  enemyStats: EnemyStats,
  currentPlayerHP: number,
  currentEnemyHP: number
): DefenseTurnResult {

  const hitZone = determineHitZone(tapPositionDegrees, weaponConfig.adjusted_bands);

  const enemyAttack = calculateEnemyAttack(enemyStats, playerStats.defPower);
  const enemyDamage = enemyAttack.damage;

  const playerDefenseZone = hitBandToZone(hitZone);
  const playerDefenseZoneMultiplier = ZONE_MULTIPLIERS[playerDefenseZone];
  const playerDefense = playerStats.defPower * playerDefenseZoneMultiplier;
  const damageBlocked = playerDefense;
  const damageActuallyTaken = Math.max(MIN_DAMAGE, enemyDamage - damageBlocked);

  const playerDefenseZoneHitInfo: ZoneHitInfo = {
    zone: playerDefenseZone,
    zone_multiplier: playerDefenseZoneMultiplier,
    crit_occurred: false,
    crit_multiplier: null,
    final_damage: damageBlocked,
  };

  // Enemy simulates defensive zone during defense turn
  // This affects how much counter-damage the enemy would take if player had attacked
  // For consistency, we track it even though player is defending
  const enemyDefenseZone = statsService.simulateEnemyZoneHit(enemyStats.def_accuracy_normalized);
  const enemyDefenseZoneMultiplier = ZONE_MULTIPLIERS[enemyDefenseZone];

  const newPlayerHP = Math.max(0, currentPlayerHP - damageActuallyTaken);

  let combatStatus: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
  if (newPlayerHP <= 0) {
    combatStatus = 'defeat';
  }

  return {
    hitZone,
    damageBlocked,
    damageActuallyTaken,
    newPlayerHP,
    currentEnemyHP,
    playerDefenseZoneHitInfo,
    enemyZoneHitInfo: enemyAttack.zoneHitInfo,
    combatStatus,
  };
}
