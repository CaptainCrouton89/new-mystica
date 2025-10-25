import { HitBand } from './types.js';

export interface CombatLogEntry {
  turn: number;
  action: 'attack' | 'defend';
  tapPositionDegrees: number;
  hitZone: HitBand;
  damageDealt?: number;
  enemyDamage?: number;
  damageBlocked?: number;
  damageActuallyTaken?: number;
  playerHP: number;
  enemyHP: number;
  timestamp: string;
}

export function getLastLogEntry(combatLog: CombatLogEntry[]): CombatLogEntry | undefined {
  return combatLog[combatLog.length - 1];
}
export function getCurrentHP(
  combatLog: CombatLogEntry[],
  initialPlayerHP: number,
  initialEnemyHP: number
): { playerHP: number; enemyHP: number } {
  const lastEntry = getLastLogEntry(combatLog);
  return {
    playerHP: lastEntry?.playerHP ?? initialPlayerHP,
    enemyHP: lastEntry?.enemyHP ?? initialEnemyHP,
  };
}

export function createAttackLogEntry(
  turnNumber: number,
  tapPositionDegrees: number,
  hitZone: HitBand,
  damageDealt: number,
  enemyDamage: number,
  newPlayerHP: number,
  newEnemyHP: number
): CombatLogEntry {
  return {
    turn: turnNumber,
    action: 'attack',
    tapPositionDegrees,
    hitZone,
    damageDealt,
    enemyDamage,
    playerHP: newPlayerHP,
    enemyHP: newEnemyHP,
    timestamp: new Date().toISOString(),
  };
}

export function createDefenseLogEntry(
  turnNumber: number,
  tapPositionDegrees: number,
  hitZone: HitBand,
  damageBlocked: number,
  damageActuallyTaken: number,
  newPlayerHP: number,
  currentEnemyHP: number
): CombatLogEntry {
  return {
    turn: turnNumber,
    action: 'defend',
    tapPositionDegrees,
    hitZone,
    damageBlocked,
    damageActuallyTaken,
    playerHP: newPlayerHP,
    enemyHP: currentEnemyHP,
    timestamp: new Date().toISOString(),
  };
}

export function getNextTurnNumber(combatLog: CombatLogEntry[]): number {
  return combatLog.length + 1;
}
