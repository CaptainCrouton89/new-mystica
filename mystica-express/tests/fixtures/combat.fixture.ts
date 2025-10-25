/**
 * Combat Test Fixtures
 *
 * Provides standardized combat session and enemy objects for testing
 * combat mechanics, enemy AI, and battle outcomes.
 */

export interface EnemyType {
  id: string;
  name: string;
  ai_personality_traits: string[];
  dialogue_tone: string;
  dialogue_guidelines: string;
}

export interface CombatSession {
  id: string;
  player_id: string;
  location_id: string;
  enemy_type_id: string;
  enemy_level: number;
  player_hp: number;
  enemy_hp: number;
  max_player_hp: number;
  max_enemy_hp: number;
  turn_number: number;
  phase: 'attack' | 'defense' | 'complete';
  result: 'victory' | 'defeat' | null;
  started_at: string;
  completed_at: string | null;
  last_action_at: string;
}

/**
 * Active combat session for testing ongoing battles
 */
export const COMBAT_SESSION_ACTIVE: CombatSession = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  player_id: 'a7f99fed-262b-43e2-a88c-a8c5e4720577',
  location_id: 'e6a0d42c-a301-4505-96a7-c71447fbec16',
  enemy_type_id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
  enemy_level: 5,
  player_hp: 75,
  enemy_hp: 60,
  max_player_hp: 100,
  max_enemy_hp: 80,
  turn_number: 3,
  phase: 'attack',
  result: null,
  started_at: '2025-01-20T12:00:00Z',
  completed_at: null,
  last_action_at: '2025-01-20T12:05:30Z'
};

/**
 * Completed combat session with victory result
 */
export const COMBAT_SESSION_VICTORY: CombatSession = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  player_id: 'a7f99fed-262b-43e2-a88c-a8c5e4720577',
  location_id: 'e6a0d42c-a301-4505-96a7-c71447fbec16',
  enemy_type_id: '4637f636-0b6a-4825-b1aa-492cf8d9d1bb',
  enemy_level: 3,
  player_hp: 45,
  enemy_hp: 0,
  max_player_hp: 100,
  max_enemy_hp: 60,
  turn_number: 8,
  phase: 'complete',
  result: 'victory',
  started_at: '2025-01-20T10:00:00Z',
  completed_at: '2025-01-20T10:12:45Z',
  last_action_at: '2025-01-20T10:12:45Z'
};

/**
 * Spray Paint Goblin enemy type for testing mischievous AI personality
 */
export const ENEMY_GOBLIN: EnemyType = {
  id: 'd9e715fb-5de0-4639-96f8-3b4f03476314',
  name: 'Spray Paint Goblin',
  ai_personality_traits: ['mischievous', 'artistic', 'territorial'],
  dialogue_tone: 'taunting',
  dialogue_guidelines: 'You are a mischievous spray paint goblin who is territorial about art spaces.'
};

/**
 * Goopy Floating Eye enemy type for testing cryptic AI personality
 */
export const ENEMY_EYE: EnemyType = {
  id: '4637f636-0b6a-4825-b1aa-492cf8d9d1bb',
  name: 'Goopy Floating Eye',
  ai_personality_traits: ['surreal', 'omniscient', 'cryptic'],
  dialogue_tone: 'mysterious',
  dialogue_guidelines: 'You are a cryptic floating eye that speaks in riddles and sees everything.'
};

/**
 * Create custom combat session with property overrides
 *
 * @param overrides - Partial combat session properties to override defaults
 * @returns CombatSession object with merged properties
 */
export function createCombatSession(overrides: Partial<CombatSession> = {}): CombatSession {
  return { ...COMBAT_SESSION_ACTIVE, ...overrides };
}

/**
 * Create custom enemy type with property overrides
 *
 * @param overrides - Partial enemy type properties to override defaults
 * @returns EnemyType object with merged properties
 */
export function createEnemyType(overrides: Partial<EnemyType> = {}): EnemyType {
  return { ...ENEMY_GOBLIN, ...overrides };
}