/**
 * CombatService - Core combat system implementation
 *
 * Implements turn-based combat with weapon timing dial mechanics, enemy selection,
 * damage calculation, and session management. Handles combat session lifecycle
 * from initialization through completion with proper pool-based enemy/loot selection.
 */

import { CombatRepository, CombatSessionData } from '../repositories/CombatRepository.js';
import { EnemyRepository } from '../repositories/EnemyRepository.js';
import { EquipmentRepository } from '../repositories/EquipmentRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { WeaponRepository } from '../repositories/WeaponRepository.js';
import { Stats } from '../types/api.types.js';
import { Database } from '../types/database.types.js';
import { AdjustedBands } from '../types/repository.types.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError
} from '../utils/errors.js';
import { locationService } from './LocationService.js';

// Default repository instances (can be overridden for testing)
let combatRepository = new CombatRepository();
let enemyRepository = new EnemyRepository();
let equipmentRepository = new EquipmentRepository();
let weaponRepository = new WeaponRepository();
let materialRepository = new MaterialRepository();

// Type aliases
type CombatResult = Database['public']['Enums']['combat_result'];
type HitBand = Database['public']['Enums']['hit_band'];
type WeaponPattern = Database['public']['Enums']['weapon_pattern'];

// Combat configuration constants
const HIT_ZONE_MULTIPLIERS = {
  injure: -0.5,
  miss: 0.0,
  graze: 0.6,
  normal: 1.0,
  crit: 1.6,
} as const;

const MIN_DAMAGE = 1;
const MAX_CRIT_BONUS = 1.0; // 0-100% additional multiplier

// Combat interfaces matching the spec
export interface CombatSession {
  session_id: string;
  player_id: string;
  enemy_id: string;
  status: 'active';
  player_hp: number;
  enemy_hp: number;
  enemy: {
    id: string;
    type: string;
    name: string;
    level: number;
    atk: number;
    def: number;
    hp: number;
    style_id: string;
    dialogue_tone: string;
    personality_traits: string[];
  };
  player_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
    hp: number;
  };
  weapon_config: {
    pattern: WeaponPattern;
    spin_deg_per_s: number;
    adjusted_bands: {
      deg_injure: number;
      deg_miss: number;
      deg_graze: number;
      deg_normal: number;
      deg_crit: number;
    };
  };
}

export interface AttackResult {
  hit_zone: HitBand;
  base_multiplier: number;
  crit_bonus_multiplier?: number;
  damage_dealt: number;
  player_hp_remaining: number;
  enemy_hp_remaining: number;
  enemy_damage: number;
  combat_status: 'ongoing' | 'victory' | 'defeat';
  turn_number: number;
}

export interface CombatRewards {
  result: 'victory' | 'defeat';
  rewards?: {
    materials: Array<{
      material_id: string;
      name: string;
      style_id: string;
      style_name: string;
    }>;
    gold: number;
    experience: number;
  };
  player_combat_history: {
    location_id: string;
    total_attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
    longest_streak: number;
  };
}

export interface PlayerStats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
  hp: number;
}

export interface EnemyStats {
  atk: number;
  def: number;
  hp: number;
  style_id: string;
  dialogue_tone: string;
  personality_traits: string[];
}

/**
 * CombatService implementation
 *
 * Responsibilities:
 * - Combat session management (PostgreSQL with TTL)
 * - Enemy selection via pool system with weighted random
 * - Player/enemy stat calculation via database views
 * - Weapon timing mechanics with accuracy adjustments
 * - Damage calculation with zone multipliers and crit bonuses
 * - Combat completion with loot generation and history updates
 */
export class CombatService {
  private combatRepository: CombatRepository;
  private enemyRepository: EnemyRepository;
  private equipmentRepository: EquipmentRepository;
  private weaponRepository: WeaponRepository;
  private materialRepository: MaterialRepository;

  constructor(
    combatRepo?: CombatRepository,
    enemyRepo?: EnemyRepository,
    equipmentRepo?: EquipmentRepository,
    weaponRepo?: WeaponRepository,
    materialRepo?: MaterialRepository
  ) {
    this.combatRepository = combatRepo || combatRepository;
    this.enemyRepository = enemyRepo || enemyRepository;
    this.equipmentRepository = equipmentRepo || equipmentRepository;
    this.weaponRepository = weaponRepo || weaponRepository;
    this.materialRepository = materialRepo || materialRepository;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Initialize new combat encounter at location
   *
   * @param userId - User UUID
   * @param locationId - Location UUID
   * @param selectedLevel - Player-chosen combat difficulty level (1-20)
   * @returns Combat session data with enemy, player stats, and weapon config
   * @throws ConflictError if user already has active session
   * @throws NotFoundError if location not found or no enemies available
   */
  async startCombat(userId: string, locationId: string, selectedLevel: number): Promise<CombatSession> {
    // Validate user doesn't have active session
    const existingSession = await this.combatRepository.getUserActiveSession(userId);
    if (existingSession) {
      throw new ConflictError('User already has an active combat session');
    }

    // Validate location exists
    const location = await locationService.getById(locationId);

    // Get player stats from equipped items
    const playerStats = await this.calculatePlayerStats(userId);
    // Use player-selected level instead of derived combat level
    const combatLevel = selectedLevel;

    // Get matching enemy and loot pools for analytics
    const enemyPoolIds = await locationService.getMatchingEnemyPools(locationId, combatLevel);
    const lootPoolIds = await locationService.getMatchingLootPools(locationId, combatLevel);

    // Convert to analytics format (pool IDs only for session storage)
    const appliedEnemyPools = enemyPoolIds || [];
    const appliedLootPools = lootPoolIds || [];

    // Select enemy from matching pools
    const enemy = await this.selectEnemy(locationId, combatLevel);

    // Get weapon configuration
    const weaponConfig = await this.getWeaponConfig(userId, playerStats.atkAccuracy);

    // Capture player equipment snapshot
    const playerEquippedItemsSnapshot = await this.captureEquipmentSnapshot(userId);

    // Create session in database
    const sessionData: Omit<CombatSessionData, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      locationId,
      combatLevel: selectedLevel, // Store the player-selected level
      enemyTypeId: enemy.id,
      appliedEnemyPools,
      appliedLootPools,
      playerEquippedItemsSnapshot,
      // Analytics disabled for MVP - optional fields omitted
      combatLog: [],
    };

    const sessionId = await this.combatRepository.createSession(userId, sessionData);

    return {
      session_id: sessionId,
      player_id: userId,
      enemy_id: enemy.id,
      status: 'active',
      player_hp: playerStats.hp,
      enemy_hp: enemy.hp,
      enemy,
      player_stats: playerStats,
      weapon_config: weaponConfig,
    };
  }

  /**
   * Execute player attack with timing dial mechanics
   *
   * @param sessionId - Combat session UUID
   * @param attackAccuracy - Player attack accuracy (0.0-1.0)
   * @returns Attack result with damage, HP updates, and combat status
   * @throws NotFoundError if session not found or expired
   * @throws ValidationError if invalid attack accuracy
   */
  async executeAttack(sessionId: string, tapPositionDegrees: number): Promise<AttackResult> {
    // Validate session exists and is active
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    // Validate tap position degrees
    if (tapPositionDegrees < 0 || tapPositionDegrees > 360) {
      throw new ValidationError('Tap position must be between 0 and 360 degrees');
    }

    // Get current combat state from session
    const playerStats = await this.calculatePlayerStats(session.userId);
    const enemy = await this.enemyRepository.findEnemyTypeById(session.enemyTypeId);
    if (!enemy) {
      throw new NotFoundError('Enemy type', session.enemyTypeId);
    }

    // Get enemy stats via database view
    const enemyStats = await this.calculateEnemyStats(session.enemyTypeId);

    // Get weapon bands for hit zone determination
    const weaponConfig = await this.getWeaponConfig(session.userId, playerStats.atkAccuracy);

    // Determine hit zone based on tap position (0-360 degrees)
    const hitZone = this.determineHitZone(tapPositionDegrees, weaponConfig.adjusted_bands);

    // Calculate damage based on hit zone
    const { damage: damageDealt, baseMultiplier, critBonus } = this.calculateDamage(
      playerStats.atkPower,
      enemyStats.def,
      hitZone
    );

    // Apply enemy counterattack (if player didn't hit injure zone)
    const enemyDamage = hitZone !== 'injure'
      ? Math.max(MIN_DAMAGE, enemyStats.atk - playerStats.defPower)
      : 0;

    // Update HP values (stored in session combatLog for now)
    const currentLog = session.combatLog || [];
    const lastLogEntry = currentLog[currentLog.length - 1];
    const currentPlayerHP = lastLogEntry?.playerHP ?? playerStats.hp;
    const currentEnemyHP = lastLogEntry?.enemyHP ?? enemyStats.hp;

    const newPlayerHP = Math.max(0, currentPlayerHP - enemyDamage);
    const newEnemyHP = Math.max(0, currentEnemyHP - damageDealt);

    // Determine combat status
    let combatStatus: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
    if (newEnemyHP <= 0) {
      combatStatus = 'victory';
    } else if (newPlayerHP <= 0) {
      combatStatus = 'defeat';
    }

    // Update session with new combat log entry
    const turnNumber = currentLog.length + 1;
    const newLogEntry = {
      turn: turnNumber,
      action: 'attack',
      tapPositionDegrees: tapPositionDegrees,
      hitZone,
      damageDealt,
      enemyDamage,
      playerHP: newPlayerHP,
      enemyHP: newEnemyHP,
      timestamp: new Date().toISOString(),
    };

    await this.combatRepository.updateSession(sessionId, {
      combatLog: [...currentLog, newLogEntry],
    });

    // Log combat event
    await this.combatRepository.addLogEvent(sessionId, {
      seq: turnNumber,
      ts: new Date(),
      actor: 'player',
      eventType: 'attack',
      payload: { hitZone, damageDealt, tapPositionDegrees },
      valueI: damageDealt,
    });

    return {
      hit_zone: hitZone,
      base_multiplier: baseMultiplier,
      crit_bonus_multiplier: critBonus,
      damage_dealt: damageDealt,
      player_hp_remaining: newPlayerHP,
      enemy_hp_remaining: newEnemyHP,
      enemy_damage: enemyDamage,
      combat_status: combatStatus,
      turn_number: turnNumber,
    };
  }

  /**
   * Execute player defense with timing mechanics
   *
   * @param sessionId - Combat session UUID
   * @param defenseAccuracy - Defense accuracy (0.0-1.0)
   * @returns Defense result with damage reduction and HP updates
   * @throws NotFoundError if session not found or expired
   * @throws ValidationError if invalid defense accuracy
   */
  async executeDefense(sessionId: string, tapPositionDegrees: number): Promise<{
    damage_blocked: number;
    damage_taken: number;
    player_hp_remaining: number;
    combat_status: 'ongoing' | 'victory' | 'defeat';
    hit_zone: HitBand;
  }> {
    // Validate session exists and is active
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    // Validate tap position degrees
    if (tapPositionDegrees < 0 || tapPositionDegrees > 360) {
      throw new ValidationError('Tap position must be between 0 and 360 degrees');
    }

    // Get current combat state from session
    const playerStats = await this.calculatePlayerStats(session.userId);
    const enemyStats = await this.calculateEnemyStats(session.enemyTypeId);

    // Get current HP values from combat log
    const currentLog = session.combatLog || [];
    const lastLogEntry = currentLog[currentLog.length - 1];
    const currentPlayerHP = lastLogEntry?.playerHP ?? playerStats.hp;
    const currentEnemyHP = lastLogEntry?.enemyHP ?? enemyStats.hp;

    // Get weapon bands for hit zone determination
    const weaponConfig = await this.getWeaponConfig(session.userId, playerStats.atkAccuracy);

    // Determine hit zone based on tap position (0-360 degrees)
    const hitZone = this.determineHitZone(tapPositionDegrees, weaponConfig.adjusted_bands);

    // Calculate base enemy damage
    const baseEnemyDamage = Math.max(MIN_DAMAGE, enemyStats.atk - playerStats.defPower);

    // Defense mechanics: hit zone determines damage reduction
    const zoneMultipliers: Record<HitBand, number> = {
      'injure': 0.0,   // Self-injury, no block
      'miss': 0.2,     // Minimal block
      'graze': 0.4,    // Partial block
      'normal': 0.6,   // Good block
      'crit': 0.8      // Excellent block
    };
    const defenseEffectiveness = zoneMultipliers[hitZone];
    const damageBlocked = Math.floor(baseEnemyDamage * defenseEffectiveness);
    const damageActuallyTaken = Math.max(MIN_DAMAGE, baseEnemyDamage - damageBlocked);

    // Update HP values
    const newPlayerHP = Math.max(0, currentPlayerHP - damageActuallyTaken);

    // Determine combat status (enemy doesn't take damage during defense)
    let combatStatus: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
    if (newPlayerHP <= 0) {
      combatStatus = 'defeat';
    }
    // Victory can only occur on attack actions, not defense

    // Update session with new combat log entry
    const turnNumber = currentLog.length + 1;
    const newLogEntry = {
      turn: turnNumber,
      action: 'defend',
      tapPositionDegrees,
      hitZone,
      damageBlocked,
      damageActuallyTaken,
      playerHP: newPlayerHP,
      enemyHP: currentEnemyHP, // Enemy HP unchanged during defense
      timestamp: new Date().toISOString(),
    };

    await this.combatRepository.updateSession(sessionId, {
      combatLog: [...currentLog, newLogEntry],
    });

    // Log combat event
    await this.combatRepository.addLogEvent(sessionId, {
      seq: turnNumber,
      ts: new Date(),
      actor: 'player',
      eventType: 'defend',
      payload: { hitZone, damageBlocked, damageActuallyTaken, tapPositionDegrees },
      valueI: damageActuallyTaken,
    });

    return {
      damage_blocked: damageBlocked,
      damage_taken: damageActuallyTaken,
      player_hp_remaining: newPlayerHP,
      combat_status: combatStatus,
      hit_zone: hitZone,
    };
  }

  /**
   * Complete combat and distribute rewards
   *
   * @param sessionId - Combat session UUID
   * @param result - Combat outcome ('victory' or 'defeat')
   * @returns Combat rewards and updated player history
   * @throws NotFoundError if session not found
   * @throws ValidationError if invalid result
   */
  async completeCombat(sessionId: string, result: 'victory' | 'defeat'): Promise<CombatRewards> {
    // Validate session exists
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    // Validate result
    if (result !== 'victory' && result !== 'defeat') {
      throw new ValidationError('Result must be "victory" or "defeat"');
    }

    // Generate rewards for victory
    let rewards: CombatRewards['rewards'] | undefined;
    if (result === 'victory') {
      rewards = await this.generateLoot(session.locationId, session.combatLevel, session.enemyTypeId);
    }

    // Complete session in database
    await this.combatRepository.completeSession(sessionId, result);

    // Get updated player combat history
    const playerHistory = await this.combatRepository.getPlayerHistory(session.userId, session.locationId);

    return {
      result,
      rewards,
      player_combat_history: {
        location_id: session.locationId,
        total_attempts: playerHistory?.totalAttempts ?? 1,
        victories: playerHistory?.victories ?? (result === 'victory' ? 1 : 0),
        defeats: playerHistory?.defeats ?? (result === 'defeat' ? 1 : 0),
        current_streak: playerHistory?.currentStreak ?? (result === 'victory' ? 1 : 0),
        longest_streak: playerHistory?.longestStreak ?? (result === 'victory' ? 1 : 0),
      },
    };
  }

  /**
   * Abandon active combat session
   *
   * @param sessionId - Combat session UUID
   * @throws NotFoundError if session not found
   */
  async abandonCombat(sessionId: string): Promise<void> {
    await this.combatRepository.deleteSession(sessionId);
  }

  /**
   * Get user's active combat session for auto-resume
   *
   * @param userId - User UUID
   * @returns Active session or null if none exists
   */
  async getUserActiveSession(userId: string): Promise<CombatSessionData | null> {
    return await this.combatRepository.getUserActiveSession(userId);
  }

  /**
   * Get active combat session data
   * Used by EnemyChatterService and other services that need session info
   *
   * @param sessionId - Combat session UUID
   * @returns Session data with enemy_type_id, player_id, location_id
   * @throws NotFoundError if session not found or expired
   */
  async getCombatSession(sessionId: string): Promise<{
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
  }> {
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    // Calculate current HP from combat log
    const currentLog = session.combatLog || [];
    const lastLogEntry = currentLog[currentLog.length - 1];

    const playerStats = await this.calculatePlayerStats(session.userId);
    const enemyStats = await this.calculateEnemyStats(session.enemyTypeId);

    return {
      session_id: sessionId,
      enemy_type_id: session.enemyTypeId,
      player_id: session.userId,
      location_id: session.locationId,
      turn_number: currentLog.length,
      player_hp: lastLogEntry?.playerHP ?? playerStats.hp,
      enemy_hp: lastLogEntry?.enemyHP ?? enemyStats.hp,
      max_player_hp: playerStats.hp,
      max_enemy_hp: enemyStats.hp,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
    };
  }

  /**
   * Get combat session for recovery (API endpoint)
   * Returns session state in the format specified by the API contract
   *
   * @param sessionId - Combat session UUID
   * @param userId - User UUID for authorization
   * @returns Session recovery data with enemy, HP, and turn state
   * @throws NotFoundError if session not found, expired, or doesn't belong to user
   */
  async getCombatSessionForRecovery(sessionId: string, userId: string): Promise<{
    session_id: string;
    player_id: string;
    enemy_id: string;
    turn_number: number;
    current_turn_owner: 'player' | 'enemy';
    status: 'active';
    player_hp: number;
    enemy_hp: number;
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
      atk: number;
      def: number;
      hp: number;
      style_id: string;
      dialogue_tone: string;
      personality_traits: string[];
    };
    expires_at: string;
  }> {
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    // Verify session belongs to the requesting user
    if (session.userId !== userId) {
      throw new NotFoundError('Combat session', sessionId);
    }

    // Calculate current HP from combat log
    const currentLog = session.combatLog || [];
    const lastLogEntry = currentLog[currentLog.length - 1];

    const playerStats = await this.calculatePlayerStats(session.userId);
    const enemyStats = await this.calculateEnemyStats(session.enemyTypeId);

    // Get weapon configuration for timing dial
    const weaponConfig = await this.getWeaponConfig(session.userId, playerStats.atkAccuracy);

    // Get enemy details
    const enemyType = await this.enemyRepository.findEnemyTypeById(session.enemyTypeId);
    if (!enemyType) {
      throw new NotFoundError('Enemy type', session.enemyTypeId);
    }

    // Calculate current HP values
    const currentPlayerHP = lastLogEntry?.playerHP ?? playerStats.hp;
    const currentEnemyHP = lastLogEntry?.enemyHP ?? enemyStats.hp;

    // Determine whose turn it is based on turn count
    // Turn is always 'player' for this implementation since combat is player-initiated
    const whoseTurn: 'player' | 'enemy' = 'player';

    // Calculate session expiry (15 minutes from creation)
    const expiresAt = new Date(session.createdAt.getTime() + (15 * 60 * 1000));

    return {
      session_id: sessionId,
      player_id: session.userId,
      enemy_id: session.enemyTypeId,
      turn_number: currentLog.length,
      current_turn_owner: whoseTurn,
      status: 'active' as const,
      player_hp: currentPlayerHP,
      enemy_hp: currentEnemyHP,
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
        level: session.combatLevel,
        atk: enemyStats.atk,
        def: enemyStats.def,
        hp: enemyStats.hp,
        style_id: enemyStats.style_id,
        dialogue_tone: enemyStats.dialogue_tone,
        personality_traits: enemyStats.personality_traits,
      },
      expires_at: expiresAt.toISOString(),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate player stats from equipped items via database view
   */
  private async calculatePlayerStats(userId: string): Promise<PlayerStats> {
    try {
      // Get power level stats from v_player_powerlevel view via repository
      const powerStats = await this.equipmentRepository.getPlayerPowerLevel(userId);

      // Fallback to equipment repository if view query fails or no data
      if (!powerStats) {
        const stats = await this.equipmentRepository.computeTotalStats(userId);
        return {
          atkPower: stats?.atkPower ?? 10, // Default base stats
          atkAccuracy: stats?.atkAccuracy ?? 0.5,
          defPower: stats?.defPower ?? 10,
          defAccuracy: stats?.defAccuracy ?? 0.5,
          hp: 100, // Fallback HP
        };
      }

      return {
        atkPower: powerStats.atk ?? 10,
        atkAccuracy: powerStats.acc ?? 0.5,
        defPower: powerStats.def ?? 10,
        defAccuracy: powerStats.acc ?? 0.5, // Using same acc for both atk and def
        hp: powerStats.hp ?? 100,
      };
    } catch (error) {
      console.warn('Database v_player_powerlevel query failed, using fallback:', error);
      // Fallback to equipment repository
      const stats = await this.equipmentRepository.computeTotalStats(userId);
      return {
        atkPower: stats?.atkPower ?? 10,
        atkAccuracy: stats?.atkAccuracy ?? 0.5,
        defPower: stats?.defPower ?? 10,
        defAccuracy: stats?.defAccuracy ?? 0.5,
        hp: 100, // Fallback HP
      };
    }
  }

  /**
   * Calculate enemy stats via database view
   */
  private async calculateEnemyStats(enemyTypeId: string): Promise<EnemyStats> {
    try {
      // Use v_enemy_realized_stats view for stats with tier scaling via repository
      const realizedStats = await this.enemyRepository.getEnemyRealizedStats(enemyTypeId);

      if (!realizedStats) {
        throw new NotFoundError('Enemy stats', enemyTypeId);
      }

      // Get enemy type details for non-stat properties
      const enemyType = await this.enemyRepository.findEnemyTypeById(enemyTypeId);
      if (!enemyType) {
        throw new NotFoundError('Enemy type', enemyTypeId);
      }

      return {
        atk: realizedStats.atk,
        def: realizedStats.def,
        hp: realizedStats.hp,
        style_id: enemyType.style_id ?? 'normal',
        dialogue_tone: enemyType.dialogue_tone ?? 'aggressive',
        personality_traits: enemyType.ai_personality_traits
          ? Object.keys(enemyType.ai_personality_traits)
          : [],
      };
    } catch (error) {
      console.warn('Database v_enemy_realized_stats query failed, using fallback:', error);
      // Fallback to existing repository method
      const realizedStats = await this.enemyRepository.getEnemyRealizedStats(enemyTypeId);
      if (!realizedStats) {
        throw new NotFoundError('Enemy stats', enemyTypeId);
      }

      const enemyType = await this.enemyRepository.findEnemyTypeById(enemyTypeId);
      if (!enemyType) {
        throw new NotFoundError('Enemy type', enemyTypeId);
      }

      return {
        atk: realizedStats.atk,
        def: realizedStats.def,
        hp: realizedStats.hp,
        style_id: enemyType.style_id ?? 'normal',
        dialogue_tone: enemyType.dialogue_tone ?? 'aggressive',
        personality_traits: enemyType.ai_personality_traits
          ? Object.keys(enemyType.ai_personality_traits)
          : [],
      };
    }
  }

  /**
   * Select enemy from matching pools using weighted random
   */
  private async selectEnemy(locationId: string, combatLevel: number): Promise<{
    id: string;
    type: string;
    name: string;
    level: number;
    atk: number;
    def: number;
    hp: number;
    style_id: string;
    dialogue_tone: string;
    personality_traits: string[];
  }> {
    // Get matching enemy pools for location and combat level
    const poolIds = await locationService.getMatchingEnemyPools(locationId, combatLevel);
    if (!poolIds || poolIds.length === 0) {
      throw new NotFoundError('No enemies available for this location and level');
    }

    // Get pool members with spawn weights
    const poolMembers = await locationService.getEnemyPoolMembers(poolIds);
    if (!poolMembers || poolMembers.length === 0) {
      throw new NotFoundError('No enemies found in available pools');
    }

    // Select random enemy using weighted selection
    const selectedEnemyTypeId = locationService.selectRandomEnemy(poolMembers);

    // Get enemy details
    const enemyType = await this.enemyRepository.findEnemyTypeById(selectedEnemyTypeId);
    if (!enemyType) {
      throw new NotFoundError('Enemy type', selectedEnemyTypeId);
    }

    const enemyStats = await this.calculateEnemyStats(selectedEnemyTypeId);

    return {
      id: enemyType.id,
      type: enemyType.name, // Using name as type identifier
      name: enemyType.name,
      level: combatLevel, // Enemy level matches selected combat level
      atk: enemyStats.atk,
      def: enemyStats.def,
      hp: enemyStats.hp,
      style_id: enemyStats.style_id,
      dialogue_tone: enemyStats.dialogue_tone,
      personality_traits: enemyStats.personality_traits,
    };
  }

  /**
   * Get weapon configuration with accuracy-adjusted bands
   */
  private async getWeaponConfig(userId: string, playerAccuracy: number): Promise<{
    pattern: WeaponPattern;
    spin_deg_per_s: number;
    adjusted_bands: AdjustedBands;
  }> {
    // Get equipped weapon from slot
    const equippedWeapon = await this.equipmentRepository.findItemInSlot(userId, 'weapon');

    if (!equippedWeapon) {
      // Default weapon configuration for no equipped weapon
      return {
        pattern: 'single_arc',
        spin_deg_per_s: 180,
        adjusted_bands: {
          deg_injure: 30,
          deg_miss: 60,
          deg_graze: 90,
          deg_normal: 150,
          deg_crit: 30,
          total_degrees: 360,
        },
      };
    }

    // Get weapon timing data
    const weapon = await this.weaponRepository.findWeaponByItemId(equippedWeapon.id);
    if (!weapon) {
      throw new NotFoundError('Weapon data', equippedWeapon.id);
    }

    // Calculate adjusted bands using database function
    const adjustedBands = await this.weaponRepository.getAdjustedBands(weapon.item_id, playerAccuracy);

    return {
      pattern: weapon.pattern,
      spin_deg_per_s: weapon.spin_deg_per_s,
      adjusted_bands: adjustedBands,
    };
  }

  /**
   * Determine hit zone based on tap position and adjusted weapon bands
   */
  private determineHitZone(tapDegrees: number, adjustedBands: AdjustedBands): HitBand {
    let cumulativeDegrees = 0;

    // Check each zone in order (bands are cumulative)
    if (tapDegrees < adjustedBands.deg_injure) {
      return 'injure';
    }
    cumulativeDegrees += adjustedBands.deg_injure;

    if (tapDegrees < cumulativeDegrees + adjustedBands.deg_miss) {
      return 'miss';
    }
    cumulativeDegrees += adjustedBands.deg_miss;

    if (tapDegrees < cumulativeDegrees + adjustedBands.deg_graze) {
      return 'graze';
    }
    cumulativeDegrees += adjustedBands.deg_graze;

    if (tapDegrees < cumulativeDegrees + adjustedBands.deg_normal) {
      return 'normal';
    }

    // Remaining degrees are crit zone
    return 'crit';
  }

  /**
   * Determine hit zone based on attack accuracy (0.0-1.0)
   * Higher accuracy = better hit zones
   */
  private determineHitZoneFromAccuracy(attackAccuracy: number): HitBand {
    // Map accuracy to hit zones with some randomness
    // 0.0-0.1: injure (very poor accuracy hurts player)
    // 0.1-0.3: miss
    // 0.3-0.6: graze
    // 0.6-0.9: normal
    // 0.9-1.0: crit (perfect accuracy gets critical hits)

    if (attackAccuracy < 0.1) {
      return 'injure';
    } else if (attackAccuracy < 0.3) {
      return 'miss';
    } else if (attackAccuracy < 0.6) {
      return 'graze';
    } else if (attackAccuracy < 0.9) {
      return 'normal';
    } else {
      return 'crit';
    }
  }

  /**
   * Get expected damage multiplier for predictions using database function
   */
  private async getExpectedDamageMultiplier(weaponId: string | null, accuracy: number): Promise<number> {
    if (!weaponId) return 1.0;

    try {
      return await this.weaponRepository.getExpectedDamageMultiplier(weaponId, accuracy);
    } catch (error) {
      throw new Error(`Expected damage multiplier calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate damage with zone multipliers and crit bonuses
   */
  private calculateDamage(attackerAtk: number, defenderDef: number, hitZone: HitBand): {
    damage: number;
    baseMultiplier: number;
    critBonus?: number;
  } {
    const baseMultiplier = HIT_ZONE_MULTIPLIERS[hitZone];
    let critBonus: number | undefined;

    // Generate crit bonus for crit hits (0-100% additional)
    if (hitZone === 'crit') {
      critBonus = Math.random() * MAX_CRIT_BONUS;
    }

    // Calculate base damage
    let totalMultiplier = baseMultiplier;
    if (critBonus !== undefined) {
      totalMultiplier += critBonus;
    }

    // Apply damage formula: (ATK * multiplier) - DEF, minimum 1
    const damage = Math.max(MIN_DAMAGE, Math.floor(attackerAtk * totalMultiplier) - defenderDef);

    return {
      damage,
      baseMultiplier,
      critBonus,
    };
  }

  /**
   * Generate loot from applied loot pools with style inheritance using database views
   */
  private async generateLoot(locationId: string, combatLevel: number, enemyTypeId: string): Promise<{
    materials: Array<{
      material_id: string;
      name: string;
      style_id: string;
      style_name: string;
    }>;
    gold: number;
    experience: number;
  }> {
    try {
      // Get enemy style for inheritance
      const enemy = await this.enemyRepository.findEnemyTypeById(enemyTypeId);
      const enemyStyleId = enemy?.style_id ?? 'normal';

      // Get matching loot pools
      const lootPoolIds = await locationService.getMatchingLootPools(locationId, combatLevel);
      if (!lootPoolIds || lootPoolIds.length === 0) {
        // No loot pools, return base rewards
        return {
          materials: [],
          gold: Math.floor(Math.random() * 20) + 5, // 5-25 gold
          experience: combatLevel * 10,
        };
      }

      // Use v_loot_pool_material_weights view for weighted selection via repository
      const weightedMaterials = await this.materialRepository.getLootPoolMaterialWeights(lootPoolIds);

      // Filter for positive weights
      const validMaterials = weightedMaterials.filter(m => Number(m.spawn_weight) > 0);

      if (!validMaterials || validMaterials.length === 0) {
        return this.generateLootFallback(locationId, combatLevel, enemyStyleId);
      }

      // Generate 1-3 materials using weighted random selection
      const numDrops = Math.floor(Math.random() * 3) + 1;
      const materials = [];

      for (let i = 0; i < numDrops; i++) {
        // Calculate total weight
        const totalWeight = validMaterials.reduce((sum, m) => sum + Number(m.spawn_weight), 0);
        if (totalWeight <= 0) break;

        // Weighted random selection
        const randomWeight = Math.random() * totalWeight;
        let currentWeight = 0;
        const selectedMaterial = validMaterials.find(m => {
          currentWeight += Number(m.spawn_weight);
          return randomWeight <= currentWeight;
        });

        if (selectedMaterial) {
          // Get material details via repository
          const materialData = await this.materialRepository.findMaterialById(selectedMaterial.material_id);

          // Apply style inheritance from enemy
          materials.push({
            material_id: selectedMaterial.material_id,
            name: materialData?.name || 'Unknown Material',
            style_id: enemyStyleId, // Inherit enemy's style
            style_name: enemyStyleId === 'normal' ? 'Normal' : enemyStyleId,
          });
        }
      }

      return {
        materials,
        gold: Math.floor(Math.random() * 30) + 10, // 10-40 gold
        experience: combatLevel * 15,
      };
    } catch (error) {
      console.warn('Loot generation failed, using fallback:', error);
      // Get enemy style for fallback
      const enemy = await this.enemyRepository.findEnemyTypeById(enemyTypeId);
      return this.generateLootFallback(locationId, combatLevel, enemy?.style_id ?? 'normal');
    }
  }

  /**
   * Fallback loot generation using existing location service methods
   */
  private async generateLootFallback(locationId: string, combatLevel: number, enemyStyleId: string): Promise<{
    materials: Array<{
      material_id: string;
      name: string;
      style_id: string;
      style_name: string;
    }>;
    gold: number;
    experience: number;
  }> {
    try {
      const lootPoolIds = await locationService.getMatchingLootPools(locationId, combatLevel);
      if (!lootPoolIds || lootPoolIds.length === 0) {
        return {
          materials: [],
          gold: Math.floor(Math.random() * 20) + 5,
          experience: combatLevel * 10,
        };
      }

      // Get loot pool entries and tier weights
      const poolEntries = await locationService.getLootPoolEntries(lootPoolIds);
      const tierWeights = await locationService.getLootPoolTierWeights(lootPoolIds);

      // Select random loot with style inheritance
      const lootDrops = locationService.selectRandomLoot(
        poolEntries,
        tierWeights,
        enemyStyleId,
        Math.floor(Math.random() * 3) + 1 // 1-3 drops
      );

      const materials = lootDrops.map((drop: any) => ({
        material_id: drop.material_id,
        name: drop.material_name,
        style_id: drop.style_id,
        style_name: drop.style_name,
      }));

      return {
        materials,
        gold: Math.floor(Math.random() * 30) + 10,
        experience: combatLevel * 15,
      };
    } catch (error) {
      console.warn('Fallback loot generation failed:', error);
      return {
        materials: [],
        gold: Math.floor(Math.random() * 20) + 5,
        experience: combatLevel * 10,
      };
    }
  }

  /**
   * Calculate combat rating using database power-law formula
   */
  private async calculateCombatRating(atk: number, def: number, hp: number): Promise<number> {
    return await this.combatRepository.calculateCombatRating(atk, def, hp);
  }


  /**
   * Capture player equipment snapshot at combat start
   */
  private async captureEquipmentSnapshot(userId: string): Promise<{
    total_stats: PlayerStats;
    equipped_items: Record<string, {
      item_id: string;
      item_type_id: string;
      level: number;
      current_stats: Stats;
      applied_materials?: Array<{material_id: string, slot_index: number}>;
    }>;
    snapshot_timestamp: string;
  }> {
    try {
      // Get total stats
      const totalStats = await this.equipmentRepository.getPlayerEquippedStats(userId);

      // Get all equipped items
      const equippedItems = await this.equipmentRepository.findEquippedByUser(userId);

      // Convert to snapshot format
      const itemsSnapshot: Record<string, any> = {};

      for (const [slotName, item] of Object.entries(equippedItems)) {
        if (item) {
          itemsSnapshot[slotName] = {
            item_id: item.id,
            item_type_id: item.item_type.id,
            level: item.level,
            current_stats: item.current_stats || { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 },
            // TODO: Add applied_materials query if needed for future analytics
          };
        }
      }

      return {
        total_stats: {
          atkPower: totalStats.atkPower,
          atkAccuracy: totalStats.atkAccuracy,
          defPower: totalStats.defPower,
          defAccuracy: totalStats.defAccuracy,
          hp: 100, // Default HP - EquipmentRepository doesn't include HP in total stats
        },
        equipped_items: itemsSnapshot,
        snapshot_timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Failed to capture equipment snapshot:', error);
      // Return empty snapshot on failure
      return {
        total_stats: { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0, hp: 100 },
        equipped_items: {},
        snapshot_timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate win probability using Elo-style formula
   */
  private calculateWinProbability(playerRating: number, enemyRating: number): number {
    const ratingDiff = playerRating - enemyRating;
    return 1.0 / (1.0 + Math.pow(10, -ratingDiff / 400));
  }
}

export const combatService = new CombatService();