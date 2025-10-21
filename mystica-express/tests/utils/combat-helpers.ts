/**
 * Combat Test Utilities
 *
 * Helper functions for combat system integration tests
 */

import type { CombatSession } from '../../src/types/combat.types.js';

/**
 * Create a test combat session with default values
 */
export function createTestCombatSession(overrides: Partial<CombatSession> = {}): CombatSession {
  const now = new Date().toISOString();

  return {
    session_id: 'test-session-uuid-v4',
    enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314', // Spray Paint Goblin
    player_id: 'a7f99fed-262b-43e2-a88c-a8c5e4720577',
    location_id: 'e6a0d42c-a301-4505-96a7-c71447fbec16', // Golden Gate Park
    turn_number: 1,
    player_hp: 100,
    enemy_hp: 120,
    max_player_hp: 100,
    max_enemy_hp: 120,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

/**
 * Create test player stats for combat calculations
 */
export function createTestPlayerStats(overrides: any = {}) {
  return {
    total_hp: 100,
    total_atk: 50,
    total_def: 20,
    accuracy: 0.75,
    ...overrides
  };
}

/**
 * Create test enemy data for combat sessions
 */
export function createTestEnemyData(overrides: any = {}) {
  return {
    enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
    enemy_name: 'Spray Paint Goblin',
    tier: 1,
    base_hp: 120,
    base_atk: 25,
    base_def: 10,
    style_id: 'normal',
    ...overrides
  };
}

/**
 * Create test weapon bands data
 */
export function createTestWeaponBands(overrides: any = {}) {
  return {
    deg_injure: 5,
    deg_miss: 45,
    deg_graze: 60,
    deg_normal: 200,
    deg_crit: 50,
    ...overrides
  };
}

/**
 * Create test loot data for combat completion
 */
export function createTestLoot(overrides: any = {}) {
  return {
    gold_earned: 25,
    items_found: [
      { item_type_id: 'magic-wand-id', quantity: 1 }
    ],
    materials_found: [
      { material_id: 'wood-id', style_id: 'normal', quantity: 3 }
    ],
    experience_gained: 50,
    ...overrides
  };
}

/**
 * Convert tap position (0.0-1.0) to degrees (0-360)
 */
export function tapPositionToDegrees(tapPosition: number): number {
  return tapPosition * 360;
}

/**
 * Convert degrees to tap position (0.0-1.0)
 */
export function degreesToTapPosition(degrees: number): number {
  return degrees / 360;
}

/**
 * Determine hit zone based on tap position and weapon bands
 */
export function determineHitZone(tapPosition: number, weaponBands: any): string {
  const degrees = tapPositionToDegrees(tapPosition);

  // Convert degrees to match the weapon band system
  // Weapon bands start from 0 degrees and go clockwise
  let adjustedDegrees = degrees;

  // Check zones in order
  if (adjustedDegrees >= 0 && adjustedDegrees < weaponBands.deg_injure) {
    return 'injure';
  } else if (adjustedDegrees < (weaponBands.deg_injure + weaponBands.deg_miss)) {
    return 'miss';
  } else if (adjustedDegrees < (weaponBands.deg_injure + weaponBands.deg_miss + weaponBands.deg_graze)) {
    return 'graze';
  } else if (adjustedDegrees < (360 - weaponBands.deg_crit)) {
    return 'normal';
  } else {
    return 'crit';
  }
}

/**
 * Calculate damage based on hit zone and combat stats
 */
export function calculateDamage(
  hitZone: string,
  playerAtk: number,
  enemyDef: number,
  isCritical: boolean = false
): number {
  let multiplier = 1.0;

  switch (hitZone) {
    case 'injure':
      return 0; // Injure means player takes damage, not enemy
    case 'miss':
      return 0;
    case 'graze':
      multiplier = 0.6;
      break;
    case 'normal':
      multiplier = 1.0;
      break;
    case 'crit':
      multiplier = 1.6;
      if (isCritical) {
        // Add random 0-100% bonus for crits
        const randomBonus = Math.random();
        multiplier += randomBonus;
      }
      break;
  }

  const baseDamage = playerAtk * multiplier;
  const finalDamage = baseDamage - enemyDef;

  // Minimum 1 damage
  return Math.max(1, Math.floor(finalDamage));
}

/**
 * Calculate counterattack damage
 */
export function calculateCounterattack(enemyAtk: number, playerDef: number): number {
  const damage = enemyAtk - playerDef;
  return Math.max(1, damage);
}

/**
 * Create mock Redis session data
 */
export function createMockRedisSession(session: Partial<CombatSession> = {}): string {
  const fullSession = createTestCombatSession(session);
  return JSON.stringify(fullSession);
}

/**
 * Create test location data
 */
export function createTestLocation(overrides: any = {}) {
  return {
    id: 'e6a0d42c-a301-4505-96a7-c71447fbec16',
    name: 'Golden Gate Park',
    location_type: 'park',
    state: 'California',
    country: 'United States',
    ...overrides
  };
}

/**
 * Create test auth claims for valid user
 */
export function createTestAuthClaims(overrides: any = {}) {
  const futureTime = Math.floor(Date.now() / 1000) + 3600;

  return {
    data: {
      claims: {
        sub: 'a7f99fed-262b-43e2-a88c-a8c5e4720577',
        email: 'test@example.com',
        exp: futureTime,
        ...overrides
      }
    },
    error: null
  };
}