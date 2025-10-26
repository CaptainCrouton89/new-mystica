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

  console.log(`[calculateEnemyAttack] zone=${enemyZone}
    atkPower=${enemyStats.atk_power} - defPower=${playerDefPower} = baseDamage=${enemyBaseDamage}
    zoneMultiplier=${ZONE_MULTIPLIERS[enemyZone]}, critMultiplier=${enemyCritMultiplier}
    finalDamage=${enemyDamage}`);

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

  console.log(`[calculatePlayerAttack] hitZone=${hitZone}, zone=${playerZone}
    atkPower=${playerStats.atkPower} - defPower=${enemyDefPower} = baseDamage=${baseDamage}
    zoneMultiplier=${playerZoneMultiplier}, critMultiplier=${playerCritMultiplier}
    finalDamage=${playerDamage}`);

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

  console.log(`[executeAttackTurn] PLAYER ATTACK:
    hitZone=${hitZone}, playerZone=${hitZone}, baseDamage=${playerAttack.zoneHitInfo.final_damage}
    playerStats.atkPower=${playerStats.atkPower}, enemyStats.def_power=${enemyStats.def_power}
    ENEMY DEFENSE: zone=${enemyDefenseZone}, multiplier=${enemyDefenseZoneMultiplier}
    enemyDefense=${enemyDefense}, actualDamageTaken=${enemyActualDamageTaken}`);

  const enemyDefenseZoneHitInfo: ZoneHitInfo = {
    zone: enemyDefenseZone,
    zone_multiplier: enemyDefenseZoneMultiplier,
    crit_occurred: false,
    crit_multiplier: null,
    final_damage: enemyDamageBlocked,
  };

  // During attack phase, enemy does NOT counter-attack or take damage from defense
  // Player may only injure themselves on miss
  const enemyDamage = 0; // No enemy damage during attack phase

  let newPlayerHP = currentPlayerHP;
  let newEnemyHP = currentEnemyHP;

  if (hitZone === 'injure') {
    // On 'injure', player hurts themselves instead of the enemy
    newPlayerHP = Math.max(0, currentPlayerHP - damageDealt);
    newEnemyHP = currentEnemyHP; // Enemy takes no damage
  } else {
    // On successful attack, player damages enemy and takes NO damage
    newPlayerHP = currentPlayerHP; // Player takes no damage on attack turns
    newEnemyHP = Math.max(0, currentEnemyHP - enemyActualDamageTaken);
  }

  let combatStatus: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
  if (newEnemyHP <= 0) {
    combatStatus = 'victory';
  } else if (newPlayerHP <= 0) {
    combatStatus = 'defeat';
  }

  // Neutral enemy zone info (no enemy action during attack phase)
  const neutralEnemyZoneHitInfo: ZoneHitInfo = {
    zone: 3, // Neutral zone
    zone_multiplier: ZONE_MULTIPLIERS[3],
    crit_occurred: false,
    crit_multiplier: null,
    final_damage: 0,
  };

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
    enemyZoneHitInfo: neutralEnemyZoneHitInfo,
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

  console.log(`[executeDefenseTurn] ENEMY ATTACK:
    enemyDamage=${enemyDamage}, enemyStats.atk_power=${enemyStats.atk_power}, playerStats.defPower=${playerStats.defPower}
    PLAYER DEFENSE: tapZone=${hitZone}, zone=${playerDefenseZone}, multiplier=${playerDefenseZoneMultiplier}
    playerDefense=${playerDefense}, damageBlocked=${damageBlocked}
    damageActuallyTaken=${damageActuallyTaken} (MIN_DAMAGE forced if lower)`);

  const playerDefenseZoneHitInfo: ZoneHitInfo = {
    zone: playerDefenseZone,
    zone_multiplier: playerDefenseZoneMultiplier,
    crit_occurred: false,
    crit_multiplier: null,
    final_damage: damageBlocked,
  };


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
