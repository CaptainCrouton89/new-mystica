import { statsService } from '../StatsService.js';
import { determineHitZone, hitBandToZone } from './calculations.js';
import { MIN_DAMAGE, ZONE_MULTIPLIERS } from './constants.js';
import { EnemyStats, HitBand, PlayerStats, WeaponConfig } from './types.js';

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
  enemyStats: EnemyStats
): { modifiedAtkPower: number; zoneHitInfo: ZoneHitInfo } {
  const enemyZone = statsService.simulateEnemyZoneHit(enemyStats.atk_accuracy_normalized);
  const enemyCritMultiplier = statsService.getCritMultiplier(enemyZone);
  const zoneMultiplier = ZONE_MULTIPLIERS[enemyZone];
  const modifiedAtkPower = enemyStats.atk_power * zoneMultiplier * enemyCritMultiplier;

  console.log(`[calculateEnemyAttack] zone=${enemyZone}
    atkPower=${enemyStats.atk_power} × zoneMultiplier=${zoneMultiplier} × critMultiplier=${enemyCritMultiplier}
    modifiedAtkPower=${modifiedAtkPower}`);

  return {
    modifiedAtkPower,
    zoneHitInfo: {
      zone: enemyZone,
      zone_multiplier: zoneMultiplier,
      crit_occurred: enemyCritMultiplier > 1.0,
      crit_multiplier: enemyCritMultiplier > 1.0 ? enemyCritMultiplier : null,
      final_damage: modifiedAtkPower,
    },
  };
}

export function calculatePlayerAttack(
  hitZone: HitBand,
  playerStats: PlayerStats
): { modifiedAtkPower: number; zoneHitInfo: ZoneHitInfo } {
  const playerZone = hitBandToZone(hitZone);
  const playerCritMultiplier = statsService.getCritMultiplier(playerZone);
  const playerZoneMultiplier = ZONE_MULTIPLIERS[playerZone];
  const modifiedAtkPower = playerStats.atkPower * playerZoneMultiplier * playerCritMultiplier;
  const playerCritOccurred = playerCritMultiplier > 1.0;

  console.log(`[calculatePlayerAttack] hitZone=${hitZone}, zone=${playerZone}
    atkPower=${playerStats.atkPower} × zoneMultiplier=${playerZoneMultiplier} × critMultiplier=${playerCritMultiplier}
    modifiedAtkPower=${modifiedAtkPower}`);

  return {
    modifiedAtkPower,
    zoneHitInfo: {
      zone: playerZone,
      zone_multiplier: playerZoneMultiplier,
      crit_occurred: playerCritOccurred,
      crit_multiplier: playerCritOccurred ? playerCritMultiplier : null,
      final_damage: modifiedAtkPower,
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

  const playerAttack = calculatePlayerAttack(hitZone, playerStats);
  const modifiedAtkPower = playerAttack.modifiedAtkPower;

  // Enemy simulates defensive zone using their def_accuracy_normalized
  const enemyDefenseZone = statsService.simulateEnemyZoneHit(enemyStats.def_accuracy_normalized);
  const enemyDefenseZoneMultiplier = ZONE_MULTIPLIERS[enemyDefenseZone];
  const effectiveDefense = enemyStats.def_power * enemyDefenseZoneMultiplier;

  const damageRatio = modifiedAtkPower * 5 * (modifiedAtkPower /  (effectiveDefense + modifiedAtkPower));
  const enemyActualDamageTaken = Math.max(MIN_DAMAGE, Math.floor(damageRatio));

  console.log(`[executeAttackTurn] PLAYER ATTACK:
    hitZone=${hitZone}, modifiedAtkPower=${modifiedAtkPower}
    playerStats.atkPower=${playerStats.atkPower}, enemyStats.def_power=${enemyStats.def_power}
    ENEMY DEFENSE: zone=${enemyDefenseZone}, multiplier=${enemyDefenseZoneMultiplier}
    effectiveDefense=${effectiveDefense}, ratio=${damageRatio.toFixed(2)}, actualDamageTaken=${enemyActualDamageTaken}`);

  const enemyDefenseZoneHitInfo: ZoneHitInfo = {
    zone: enemyDefenseZone,
    zone_multiplier: enemyDefenseZoneMultiplier,
    crit_occurred: false,
    crit_multiplier: null,
    final_damage: enemyActualDamageTaken,
  };

  // During attack phase, enemy does NOT counter-attack or take damage from defense
  // Player may only injure themselves on miss
  const enemyDamage = 0; // No enemy damage during attack phase

  let newPlayerHP = currentPlayerHP;
  let newEnemyHP = currentEnemyHP;

  if (hitZone === 'injure') {
    // On 'injure', player hurts themselves instead of the enemy
    newPlayerHP = Math.max(0, currentPlayerHP - enemyActualDamageTaken);
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
    damageDealt: enemyActualDamageTaken,
    enemyDefenseZoneHitInfo,
    enemyDamageBlocked: effectiveDefense,
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

  const enemyAttack = calculateEnemyAttack(enemyStats);
  const modifiedAtkPower = enemyAttack.modifiedAtkPower;

  const playerDefenseZone = hitBandToZone(hitZone);
  const playerDefenseZoneMultiplier = ZONE_MULTIPLIERS[playerDefenseZone];
  const effectiveDefense = playerStats.defPower * playerDefenseZoneMultiplier;

  const damageRatio = modifiedAtkPower * 5 * (modifiedAtkPower /  (effectiveDefense + modifiedAtkPower));
  const damageActuallyTaken = Math.max(MIN_DAMAGE, Math.floor(damageRatio));

  console.log(`[executeDefenseTurn] ENEMY ATTACK:
    modifiedAtkPower=${modifiedAtkPower}, enemyStats.atk_power=${enemyStats.atk_power}, playerStats.defPower=${playerStats.defPower}
    PLAYER DEFENSE: tapZone=${hitZone}, zone=${playerDefenseZone}, multiplier=${playerDefenseZoneMultiplier}
    effectiveDefense=${effectiveDefense}, ratio=${damageRatio.toFixed(2)}
    damageActuallyTaken=${damageActuallyTaken} (MIN_DAMAGE forced if lower)`);

  const playerDefenseZoneHitInfo: ZoneHitInfo = {
    zone: playerDefenseZone,
    zone_multiplier: playerDefenseZoneMultiplier,
    crit_occurred: false,
    crit_multiplier: null,
    final_damage: damageActuallyTaken,
  };

  const newPlayerHP = Math.max(0, currentPlayerHP - damageActuallyTaken);

  let combatStatus: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
  if (newPlayerHP <= 0) {
    combatStatus = 'defeat';
  }

  return {
    hitZone,
    damageBlocked: effectiveDefense,
    damageActuallyTaken,
    newPlayerHP,
    currentEnemyHP,
    playerDefenseZoneHitInfo,
    enemyZoneHitInfo: enemyAttack.zoneHitInfo,
    combatStatus,
  };
}
