import { PlayerStats, EnemyStats, WeaponConfig } from './types.js';
import { CombatLogEntry, getCurrentHP } from './combat-log.js';
import { calculateSessionExpiry } from './session.js';

export interface SessionRecoveryData {
  session_id: string;
  player_id: string;
  enemy_id: string;
  turn_number: number;
  current_turn_owner: 'player' | 'enemy';
  status: 'active';
  player_hp: number;
  enemy_hp: number;
  location?: {
    id: string;
    name: string | null;
    location_type: string | null;
    background_image_url: string | null;
    image_url: string | null;
  };
  player_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
    hp: number;
  };
  weapon_config: {
    pattern: string;
    spin_deg_per_s: number;
    adjusted_bands: {
      deg_injure: number;
      deg_miss: number;
      deg_graze: number;
      deg_normal: number;
      deg_crit: number;
    };
  };
  enemy: {
    id: string;
    type: string;
    name: string;
    level: number;
    atk_power: number;
    atk_accuracy: number;
    def_power: number;
    def_accuracy: number;
    hp: number;
    style_id: string;
    dialogue_tone: string;
    personality_traits: string[];
  };
  expires_at: string;
}

export interface BasicSessionData {
  session_id: string;
  enemy_type_id: string;
  player_id: string;
  location_id: string;
  turn_number: number;
  player_hp: number;
  enemy_hp: number;
  max_player_hp: number;
  max_enemy_hp: number;
  created_at: string;
  updated_at: string;
}

export function buildSessionRecoveryData(
  sessionId: string,
  userId: string,
  enemyTypeId: string,
  combatLevel: number,
  combatLog: CombatLogEntry[],
  playerStats: PlayerStats,
  enemyStats: EnemyStats,
  weaponConfig: WeaponConfig,
  enemyType: {
    id: string;
    name: string;
    dialogue_tone: string;
    ai_personality_traits?: Record<string, unknown>;
  },
  sessionCreatedAt: Date,
  location?: {
    id: string;
    name: string | null;
    location_type: string | null;
    background_image_url: string | null;
    image_url: string | null;
  }
): SessionRecoveryData {
  const { playerHP, enemyHP } = getCurrentHP(combatLog, playerStats.hp, enemyStats.hp);
  const expiresAt = calculateSessionExpiry(sessionCreatedAt);

  return {
    session_id: sessionId,
    player_id: userId,
    enemy_id: enemyTypeId,
    turn_number: combatLog.length,
    current_turn_owner: 'player',
    status: 'active' as const,
    player_hp: playerHP,
    enemy_hp: enemyHP,
    location,
    player_stats: {
      atkPower: playerStats.atkPower,
      atkAccuracy: playerStats.atkAccuracy,
      defPower: playerStats.defPower,
      defAccuracy: playerStats.defAccuracy,
      hp: playerStats.hp,
    },
    weapon_config: weaponConfig,
    enemy: {
      id: enemyType.id,
      type: enemyType.name,
      name: enemyType.name,
      level: combatLevel,
      atk_power: enemyStats.atk_power,
      atk_accuracy: enemyStats.atk_accuracy,
      def_power: enemyStats.def_power,
      def_accuracy: enemyStats.def_accuracy,
      hp: enemyStats.hp,
      style_id: enemyStats.style_id,
      dialogue_tone: enemyType.dialogue_tone,
      personality_traits: enemyType.ai_personality_traits
        ? Object.keys(enemyType.ai_personality_traits)
        : [],
    },
    expires_at: expiresAt.toISOString(),
  };
}

export function buildBasicSessionData(
  sessionId: string,
  userId: string,
  enemyTypeId: string,
  locationId: string,
  combatLog: CombatLogEntry[],
  playerStats: PlayerStats,
  enemyStats: EnemyStats,
  sessionCreatedAt: Date,
  sessionUpdatedAt: Date
): BasicSessionData {
  const { playerHP, enemyHP } = getCurrentHP(combatLog, playerStats.hp, enemyStats.hp);

  return {
    session_id: sessionId,
    enemy_type_id: enemyTypeId,
    player_id: userId,
    location_id: locationId,
    turn_number: combatLog.length,
    player_hp: playerHP,
    enemy_hp: enemyHP,
    max_player_hp: playerStats.hp,
    max_enemy_hp: enemyStats.hp,
    created_at: sessionCreatedAt.toISOString(),
    updated_at: sessionUpdatedAt.toISOString(),
  };
}
