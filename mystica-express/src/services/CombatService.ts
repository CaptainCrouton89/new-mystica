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
import { ItemRepository } from '../repositories/ItemRepository.js';
import { ItemTypeRepository } from '../repositories/ItemTypeRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
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
import { logger } from '../utils/logger.js';

// Default repository instances (can be overridden for testing)
let combatRepository = new CombatRepository();
let enemyRepository = new EnemyRepository();
let equipmentRepository = new EquipmentRepository();
let itemRepository = new ItemRepository();
let itemTypeRepository = new ItemTypeRepository();
let weaponRepository = new WeaponRepository();
let materialRepository = new MaterialRepository();
let profileRepository = new ProfileRepository();

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
  rewards: CombatRewards | null;
}

/**
 * Combat rewards and player history data returned after combat completion
 *
 * @interface CombatRewards
 * @property {string} result - Combat outcome ('victory' or 'defeat')
 * @property {object} [currencies] - Currency rewards (only present for victory)
 * @property {number} currencies.gold - Gold amount earned
 * @property {Array} [materials] - Material drops with style inheritance (only present for victory)
 * @property {Array} [items] - Item drops from loot pools with full details (only present for victory)
 * @property {number} [experience] - Experience points earned (only present for victory)
 * @property {object} combat_history - Updated combat statistics for location
 */
export interface CombatRewards {
  result: 'victory' | 'defeat';
  /** Currency rewards with extensible structure for future currencies (only present for victory) */
  currencies?: {
    /** Gold amount earned from combat */
    gold: number;
    // Future: gems, premium_currency, event_tokens
  };
  /** Material drops with style inheritance from enemy (only present for victory) */
  materials?: Array<{
    /** Material UUID from Materials table */
    material_id: string;
    /** Display name of the material */
    name: string;
    /** Style UUID inherited from enemy */
    style_id: string;
    /** Display name of the style */
    style_name: string;
  }>;
  /** Item drops from loot pools with full item details (only present for victory) */
  items?: Array<{
    /** Item type UUID from ItemTypes table */
    item_type_id: string;
    /** Display name of the item */
    name: string;
    /** Item category (weapon, armor, accessory, etc.) */
    category: string;
    /** Item rarity (common, uncommon, rare, epic, legendary) */
    rarity: string;
    /** Style UUID inherited from enemy */
    style_id: string;
    /** Display name of the style */
    style_name: string;
  }>;
  /** Experience points earned from combat (only present for victory) */
  experience?: number;
  /** Updated combat statistics for this location */
  combat_history: {
    /** Location UUID where combat occurred */
    location_id: string;
    /** Total combat attempts at this location */
    total_attempts: number;
    /** Total victories at this location */
    victories: number;
    /** Total defeats at this location */
    defeats: number;
    /** Current win/loss streak */
    current_streak: number;
    /** Longest win streak achieved */
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
  private itemRepository: ItemRepository;
  private itemTypeRepository: ItemTypeRepository;
  private weaponRepository: WeaponRepository;
  private materialRepository: MaterialRepository;
  private profileRepository: ProfileRepository;

  constructor(
    combatRepo?: CombatRepository,
    enemyRepo?: EnemyRepository,
    equipmentRepo?: EquipmentRepository,
    itemRepo?: ItemRepository,
    itemTypeRepo?: ItemTypeRepository,
    weaponRepo?: WeaponRepository,
    materialRepo?: MaterialRepository,
    profileRepo?: ProfileRepository
  ) {
    this.combatRepository = combatRepo || combatRepository;
    this.enemyRepository = enemyRepo || enemyRepository;
    this.equipmentRepository = equipmentRepo || equipmentRepository;
    this.itemRepository = itemRepo || itemRepository;
    this.itemTypeRepository = itemTypeRepo || itemTypeRepository;
    this.weaponRepository = weaponRepo || weaponRepository;
    this.materialRepository = materialRepo || materialRepository;
    this.profileRepository = profileRepo || profileRepository;
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
    logger.info('⚔️ Starting new combat session', { userId, locationId, selectedLevel });

    // Validate user doesn't have active session
    const existingSession = await this.combatRepository.getUserActiveSession(userId);
    if (existingSession) {
      logger.warn('❌ Combat start failed: user already has active session', {
        userId,
        existingSessionId: existingSession.id
      });
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

    logger.info('✅ Combat session created successfully', {
      sessionId,
      userId,
      enemyTypeId: enemy.id,
      combatLevel: selectedLevel
    });

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
    logger.info('🎯 Combat attack initiated', { sessionId, tapPositionDegrees });

    // Validate session exists and is active
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      logger.warn('❌ Attack failed: session not found', { sessionId });
      throw new NotFoundError('Combat session', sessionId);
    }

    logger.debug('✅ Session found', {
      sessionId,
      userId: session.userId,
      turnCount: session.combatLog?.length ?? 0
    });

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

    // NO enemy counterattack during attack phase - enemy attacks during defense phase only
    const enemyDamage = 0;

    // Update HP values (stored in session combatLog for now)
    const currentLog = session.combatLog || [];
    const lastLogEntry = currentLog[currentLog.length - 1];
    const currentPlayerHP = lastLogEntry?.playerHP ?? playerStats.hp;
    const currentEnemyHP = lastLogEntry?.enemyHP ?? enemyStats.hp;

    // Handle self-injury vs enemy damage
    let newPlayerHP = currentPlayerHP;
    let newEnemyHP = currentEnemyHP;

    if (hitZone === 'injure') {
      // Self-injury: player takes damage instead of enemy
      newPlayerHP = Math.max(0, currentPlayerHP - damageDealt);
      newEnemyHP = currentEnemyHP; // Enemy HP unchanged
    } else {
      // Normal attack: enemy takes damage
      newPlayerHP = currentPlayerHP; // Player HP unchanged
      newEnemyHP = Math.max(0, currentEnemyHP - damageDealt);
    }

    // Determine combat status
    let combatStatus: 'ongoing' | 'victory' | 'defeat' = 'ongoing';
    if (newEnemyHP <= 0) {
      combatStatus = 'victory';
      logger.info('🎉 Combat victory!', { sessionId, finalDamage: damageDealt, hitZone });
    } else if (newPlayerHP <= 0) {
      combatStatus = 'defeat';
      logger.info('💀 Combat defeat', { sessionId, finalDamage: damageDealt, hitZone });
    } else {
      logger.debug('⚔️ Combat ongoing', {
        sessionId,
        playerHP: newPlayerHP,
        enemyHP: newEnemyHP,
        hitZone,
        damage: damageDealt
      });
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

    // NOTE: Session completion now happens in completeCombatInternal() to avoid duplicate calls

    // Log combat event
    await this.combatRepository.addLogEvent(sessionId, {
      seq: turnNumber,
      ts: new Date(),
      actor: 'player',
      eventType: 'attack',
      payload: { hitZone, damageDealt, tapPositionDegrees },
      valueI: damageDealt,
    });

    // Apply rewards atomically before response for terminal combat states
    let rewards: CombatRewards | null = null;
    if (combatStatus === 'victory' || combatStatus === 'defeat') {
      logger.info('💰 Generating and applying rewards', { sessionId, result: combatStatus });

      // Generate rewards for this combat outcome (pass session to avoid refetch)
      rewards = await this.completeCombatInternal(sessionId, combatStatus, session);

      // Apply rewards and delete session atomically
      await this.applyRewardsTransaction(session.userId, sessionId, rewards);

      logger.info('✅ Session cleanup complete', { sessionId });
    }

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
      rewards,
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
    enemy_hp_remaining: number;
    combat_status: 'ongoing' | 'victory' | 'defeat';
    hit_zone: HitBand;
    turn_number: number;
    rewards: CombatRewards | null;
  }> {
    logger.info('🛡️ Combat defense initiated', { sessionId, tapPositionDegrees });

    // Validate session exists and is active
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      logger.warn('❌ Defense failed: session not found', { sessionId });
      throw new NotFoundError('Combat session', sessionId);
    }

    logger.debug('✅ Session found for defense', {
      sessionId,
      userId: session.userId,
      turnCount: session.combatLog?.length ?? 0
    });

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

    // Defense mechanics: hit zone determines damage reduction/amplification
    // Injure zone amplifies damage (like attack self-injury), good zones reduce damage significantly
    const zoneMultipliers: Record<HitBand, number> = {
      'injure': -0.5,  // Self-injury: take 150% damage (50% penalty)
      'miss': 0.0,     // Failed defense: take full damage, no block
      'graze': 0.3,    // Partial block: reduce damage by 30%
      'normal': 0.7,   // Good block: reduce damage by 70%
      'crit': 0.9      // Perfect block: reduce damage by 90%
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

    // NOTE: Session completion now happens in completeCombatInternal() to avoid duplicate calls

    // Log combat event
    await this.combatRepository.addLogEvent(sessionId, {
      seq: turnNumber,
      ts: new Date(),
      actor: 'player',
      eventType: 'defend',
      payload: { hitZone, damageBlocked, damageActuallyTaken, tapPositionDegrees },
      valueI: damageActuallyTaken,
    });

    // Apply rewards atomically before response for terminal combat states
    let rewards: CombatRewards | null = null;
    if (combatStatus === 'defeat') {
      logger.info('💰 Generating and applying rewards', { sessionId, result: combatStatus });

      // Generate rewards for defeat (pass session to avoid refetch)
      rewards = await this.completeCombatInternal(sessionId, combatStatus, session);

      // Apply rewards and delete session atomically
      await this.applyRewardsTransaction(session.userId, sessionId, rewards);

      logger.info('✅ Session cleanup complete', { sessionId });
    }

    return {
      damage_blocked: damageBlocked,
      damage_taken: damageActuallyTaken,
      player_hp_remaining: newPlayerHP,
      enemy_hp_remaining: currentEnemyHP,
      combat_status: combatStatus,
      hit_zone: hitZone,
      turn_number: turnNumber,
      rewards,
    };
  }

  /**
   * Complete combat and distribute rewards (PUBLIC API for controller)
   * Fetches session from database - prefer completeCombatInternal() when session already loaded
   *
   * @param sessionId - Combat session UUID
   * @param result - Combat outcome ('victory' or 'defeat')
   * @returns Combat rewards and updated player history
   * @throws NotFoundError if session not found
   * @throws ValidationError if invalid result
   */
  async completeCombat(sessionId: string, result: 'victory' | 'defeat'): Promise<CombatRewards> {
    logger.info('📊 Completing combat session (public API)', { sessionId, result });

    // Fetch session from database
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    return this.completeCombatInternal(sessionId, result, session);
  }

  /**
   * Complete combat and distribute rewards (INTERNAL method)
   * IMPORTANT: This is called from executeAttack/executeDefense with session already loaded
   *
   * @param sessionId - Combat session UUID
   * @param result - Combat outcome ('victory' or 'defeat')
   * @param session - Pre-fetched session data (REQUIRED - avoids race condition)
   * @returns Combat rewards and updated player history
   * @throws ValidationError if invalid result
   */
  private async completeCombatInternal(sessionId: string, result: 'victory' | 'defeat', session: any): Promise<CombatRewards> {
    logger.info('📊 Completing combat session (internal)', { sessionId, result });

    // Validate result
    if (result !== 'victory' && result !== 'defeat') {
      throw new ValidationError('Result must be "victory" or "defeat"');
    }

    // Complete session in database
    await this.combatRepository.completeSession(sessionId, result);

    // Get updated player combat history
    const playerHistory = await this.combatRepository.getPlayerHistory(session.userId, session.locationId);

    // Build combat history data
    const combatHistory = {
      location_id: session.locationId,
      total_attempts: playerHistory?.totalAttempts ?? 1,
      victories: playerHistory?.victories ?? (result === 'victory' ? 1 : 0),
      defeats: playerHistory?.defeats ?? (result === 'defeat' ? 1 : 0),
      current_streak: playerHistory?.currentStreak ?? (result === 'victory' ? 1 : 0),
      longest_streak: playerHistory?.longestStreak ?? (result === 'victory' ? 1 : 0),
    };

    // Generate rewards for victory
    if (result === 'victory') {
      const baseRewards = await this.generateLoot(session.locationId, session.combatLevel, session.enemyTypeId);
      return {
        result,
        currencies: baseRewards.currencies,
        materials: baseRewards.materials,
        items: baseRewards.items,
        experience: baseRewards.experience,
        combat_history: combatHistory,
      };
    }

    // Defeat case - no rewards, only combat history
    return {
      result,
      combat_history: combatHistory,
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
  // Reward Application Transaction
  // ============================================================================

  /**
   * Apply rewards atomically before combat response using transaction pattern
   *
   * Applies currencies, items, materials, XP, and combat history in single atomic operation.
   * Deletes session as final step to ensure rewards are applied before session disappears.
   *
   * @param userId - User UUID
   * @param sessionId - Combat session UUID
   * @param rewards - Combat rewards to apply
   * @throws DatabaseError on transaction failure (session remains active)
   */
  private async applyRewardsTransaction(
    userId: string,
    sessionId: string,
    rewards: CombatRewards
  ): Promise<void> {
    try {
      if (rewards.result === 'victory' && rewards.currencies) {
        logger.info('Applying victory rewards atomically', {
          userId,
          sessionId,
          gold: rewards.currencies.gold,
          materials: rewards.materials?.length ?? 0,
          items: rewards.items?.length ?? 0,
          experience: rewards.experience ?? 0
        });

        // 1. Apply gold currency
        if (rewards.currencies.gold > 0) {
          await this.profileRepository.addCurrency(
            userId,
            'GOLD',
            rewards.currencies.gold,
            'combat_victory',
            sessionId,
            { sessionId, combatType: 'victory' }
          );
        }

        // 2. Apply materials (upsert MaterialStacks)
        if (rewards.materials) {
          for (const material of rewards.materials) {
            await this.materialRepository.incrementStack(
              userId,
              material.material_id,
              material.style_id,
              1 // Always 1 unit per material drop
            );
          }
        }

        // 3. Apply items (create PlayerItems + unlock ItemTypes)
        if (rewards.items) {
          for (const item of rewards.items) {
            // Create the player item
            await this.itemRepository.create({
              user_id: userId,
              item_type_id: item.item_type_id,
              level: 1, // Items drop at level 1
            });

            // TODO: Unlock item type if not already unlocked
            // This requires implementing unlockItemType method in ProfileRepository
            // For now, items are created without explicit unlocking
            logger.debug('Item created without unlocking ItemType', {
              userId,
              itemTypeId: item.item_type_id
            });
          }
        }

        // 4. Apply experience points
        if (rewards.experience && rewards.experience > 0) {
          await this.profileRepository.addXP(userId, rewards.experience);
        }

        // 5. Combat history is already updated by completeSession in CombatRepository
        // No additional action needed here

        logger.info('Victory rewards applied successfully', { userId, sessionId });
      } else if (rewards.result === 'defeat') {
        logger.info('Defeat - no rewards to apply', { userId, sessionId });
        // Combat history already updated by completeSession for defeats
      }

      // 6. Delete session as final step (atomic completion)
      logger.info('🗑️ Deleting combat session', { sessionId, userId });
      await this.combatRepository.deleteSession(sessionId);

      logger.info('✅ Combat session deleted successfully', { sessionId });

    } catch (error) {
      logger.error('Reward application transaction failed', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Re-throw to ensure session remains active for retry
      throw error;
    }
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
      logger.warn('Database v_player_powerlevel query failed, using fallback', { error: error instanceof Error ? error.message : String(error) });
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
      logger.warn('Database v_enemy_realized_stats query failed, using fallback', { error: error instanceof Error ? error.message : String(error) });
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
      // Matches new database defaults: crit=10°, normal=20°, rest=110° each
      return {
        pattern: 'single_arc',
        spin_deg_per_s: 180,
        adjusted_bands: {
          deg_crit: 10,
          deg_normal: 20,
          deg_graze: 110,
          deg_miss: 110,
          deg_injure: 110,
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
   * REVERSED ORDER: crit -> normal -> graze -> miss -> injure (starting from 0°)
   */
  private determineHitZone(tapDegrees: number, adjustedBands: AdjustedBands): HitBand {
    let cumulativeDegrees = 0;

    logger.info(`🎯 HIT ZONE CALCULATION - Tap: ${tapDegrees}°, Bands:`, adjustedBands);

    // Check each zone in REVERSED order (bands are cumulative)
    // Zone 1: Crit (dark green)
    if (tapDegrees < adjustedBands.deg_crit) {
      logger.info(`✅ Result: CRIT (0° - ${adjustedBands.deg_crit}°)`);
      return 'crit';
    }
    cumulativeDegrees += adjustedBands.deg_crit;

    // Zone 2: Normal (bright green)
    if (tapDegrees < cumulativeDegrees + adjustedBands.deg_normal) {
      logger.info(`✅ Result: NORMAL (${cumulativeDegrees}° - ${cumulativeDegrees + adjustedBands.deg_normal}°)`);
      return 'normal';
    }
    cumulativeDegrees += adjustedBands.deg_normal;

    // Zone 3: Graze (yellow)
    if (tapDegrees < cumulativeDegrees + adjustedBands.deg_graze) {
      logger.info(`✅ Result: GRAZE (${cumulativeDegrees}° - ${cumulativeDegrees + adjustedBands.deg_graze}°)`);
      return 'graze';
    }
    cumulativeDegrees += adjustedBands.deg_graze;

    // Zone 4: Miss (orange)
    if (tapDegrees < cumulativeDegrees + adjustedBands.deg_miss) {
      logger.info(`✅ Result: MISS (${cumulativeDegrees}° - ${cumulativeDegrees + adjustedBands.deg_miss}°)`);
      return 'miss';
    }

    // Zone 5: Injure (red) - remaining degrees
    logger.info(`✅ Result: INJURE (${cumulativeDegrees + adjustedBands.deg_miss}° - 360°)`);
    return 'injure';
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

    // Special handling for injure zone (self-damage)
    if (hitZone === 'injure') {
      // Self-injury: calculate as percentage of player's own attack power (no defense reduction)
      // Use absolute value of multiplier (0.5) to deal meaningful self-damage
      const selfDamage = Math.max(MIN_DAMAGE, Math.floor(attackerAtk * Math.abs(totalMultiplier)));
      return {
        damage: selfDamage,
        baseMultiplier,
        critBonus,
      };
    }

    // Normal damage: (ATK * multiplier) - DEF, minimum 1
    const damage = Math.max(MIN_DAMAGE, Math.floor(attackerAtk * totalMultiplier) - defenderDef);

    return {
      damage,
      baseMultiplier,
      critBonus,
    };
  }

  /**
   * Generate loot from applied loot pools with style inheritance using database views
   * Returns base reward data without combat_history (added by completeCombat method)
   */
  private async generateLoot(locationId: string, combatLevel: number, enemyTypeId: string): Promise<{
    currencies: { gold: number };
    materials: Array<{
      material_id: string;
      name: string;
      style_id: string;
      style_name: string;
    }>;
    items: Array<{
      item_type_id: string;
      name: string;
      category: string;
      rarity: string;
      style_id: string;
      style_name: string;
    }>;
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
          currencies: {
            gold: Math.floor(Math.random() * 20) + 5, // 5-25 gold
          },
          materials: [],
          items: [], // No items without loot pools
          experience: combatLevel * 10,
        };
      }

      // Use the fallback method which supports both materials and items
      // The database view approach only supports materials, so we'll delegate to the more comprehensive fallback
      return this.generateLootFallback(locationId, combatLevel, enemyStyleId);
    } catch (error) {
      logger.warn('Loot generation failed, using fallback', { error: error instanceof Error ? error.message : String(error) });
      // Get enemy style for fallback
      const enemy = await this.enemyRepository.findEnemyTypeById(enemyTypeId);
      return this.generateLootFallback(locationId, combatLevel, enemy?.style_id ?? 'normal');
    }
  }

  /**
   * Fallback loot generation using existing location service methods
   * Returns base reward data without combat_history (added by completeCombat method)
   */
  private async generateLootFallback(locationId: string, combatLevel: number, enemyStyleId: string): Promise<{
    currencies: { gold: number };
    materials: Array<{
      material_id: string;
      name: string;
      style_id: string;
      style_name: string;
    }>;
    items: Array<{
      item_type_id: string;
      name: string;
      category: string;
      rarity: string;
      style_id: string;
      style_name: string;
    }>;
    experience: number;
  }> {
    try {
      const lootPoolIds = await locationService.getMatchingLootPools(locationId, combatLevel);
      if (!lootPoolIds || lootPoolIds.length === 0) {
        return {
          currencies: {
            gold: Math.floor(Math.random() * 20) + 5,
          },
          materials: [],
          items: [],
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

      // Fetch style name for the enemy style
      const styleName = await locationService.getStyleName(enemyStyleId);

      // Separate materials and items from lootDrops
      const materials = lootDrops
        .filter((drop: any) => drop.type === 'material' && drop.material_id)
        .map((drop: any) => ({
          material_id: drop.material_id,
          name: drop.material_name,
          style_id: drop.style_id,
          style_name: styleName,
        }));

      // Extract item type IDs for batch fetching
      const itemTypeIds = lootDrops
        .filter((drop: any) => drop.type === 'item' && drop.item_type_id)
        .map((drop: any) => drop.item_type_id);

      // Batch fetch ItemType details
      const itemTypes = itemTypeIds.length > 0 ? await this.itemTypeRepository.findByIds(itemTypeIds) : [];
      const itemTypeMap = new Map(itemTypes.map(it => [it.id, it]));

      // Process items with ItemType details
      const items = lootDrops
        .filter((drop: any) => drop.type === 'item' && drop.item_type_id)
        .map((drop: any) => {
          const itemType = itemTypeMap.get(drop.item_type_id);
          if (!itemType) {
            logger.warn(`ItemType ${drop.item_type_id} not found, skipping item drop`);
            return null;
          }
          return {
            item_type_id: drop.item_type_id,
            name: itemType.name,
            category: itemType.category,
            rarity: itemType.rarity,
            style_id: drop.style_id, // Inherit enemy's style
            style_name: styleName,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        currencies: {
          gold: Math.floor(Math.random() * 30) + 10,
        },
        materials,
        items,
        experience: combatLevel * 15,
      };
    } catch (error) {
      logger.warn('Fallback loot generation failed', { error: error instanceof Error ? error.message : String(error) });
      return {
        currencies: {
          gold: Math.floor(Math.random() * 20) + 5,
        },
        materials: [],
        items: [],
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
      logger.warn('Failed to capture equipment snapshot', { error: error instanceof Error ? error.message : String(error) });
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