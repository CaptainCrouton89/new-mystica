/**
 * COMBAT SYSTEM OVERVIEW
 *
 * Combat in New Mystica operates on a two-phase turn-based system:
 *
 * PHASE 1: PLAYER ATTACKS, ENEMY DEFENDS
 * - Player taps a position (0-360 degrees) to attack
 * - System determines player's hit zone (1-5) based on tap position and weapon accuracy
 *   → Zone 1 = Critical hit (best)
 *   → Zone 2 = Strong hit
 *   → Zone 3 = Normal hit
 *   → Zone 4 = Weak hit
 *   → Zone 5 = Miss/graze (worst—results in self injury)
 * - System simulates enemy's defense zone (1-5) based on enemy defense accuracy
 *   → Zone 1 = Perfect defense (best)
 *   → Zone 5 = Failed defense (worst)
 * - Damage is calculated from:
 *   → Player attack power × player hit zone multiplier × crit multiplier
 *   → Minus enemy defense power × enemy defense zone multiplier
 * - Enemy takes damage; player takes NO counter damage
 * - Player may only injure themselves on critical misses (zone 5)
 *
 * PHASE 2: ENEMY ATTACKS, PLAYER DEFENDS
 * - Player taps a position (0-360 degrees) to defend
 * - System simulates enemy's attack zone (1-5) based on enemy attack accuracy
 *   → Zone 1 = Critical attack (worst for player)
 *   → Zone 5 = Missed attack (best for player)
 * - System determines player's defense zone (1-5) based on tap position and defense accuracy
 *   → Zone 1 = Perfect block (best)
 *   → Zone 5 = Failed block (worst)
 * - Damage is calculated from:
 *   → Enemy attack power × enemy attack zone multiplier × crit multiplier
 *   → Minus player defense power × player defense zone multiplier
 * - Player takes damage (or blocks it with good defense)
 * - Enemy does NOT take damage during defense phase
 *
 * IMPORTANT: Each phase is completely distinct with no cross-phase damage:
 * - Attack phase: Player damages enemy only (based on enemy defense zone)
 * - Defense phase: Enemy damages player only (based on player defense zone)
 *
 * Victory occurs when enemy HP reaches 0.
 * Defeat occurs when player HP reaches 0.
 */

import { CombatRepository, CombatSessionData } from '../repositories/CombatRepository.js';
import { EnemyRepository } from '../repositories/EnemyRepository.js';
import { EquipmentRepository } from '../repositories/EquipmentRepository.js';
import { ItemRepository } from '../repositories/ItemRepository.js';
import { ItemTypeRepository } from '../repositories/ItemTypeRepository.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { ProfileRepository } from '../repositories/ProfileRepository.js';
import { RarityRepository } from '../repositories/RarityRepository.js';
import { StyleRepository } from '../repositories/StyleRepository.js';
import { WeaponRepository } from '../repositories/WeaponRepository.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { locationService } from './LocationService.js';
import { statsService } from './StatsService.js';

import {
  calculateEnemyStats
} from './combat/calculations.js';
import {
  CombatLogEntry,
  createAttackLogEntry,
  createDefenseLogEntry,
  getCurrentHP,
  getNextTurnNumber,
} from './combat/combat-log.js';
import { generateLoot } from './combat/loot.js';
import { applyRewards } from './combat/rewards.js';
import {
  buildBasicSessionData,
  buildSessionRecoveryData,
} from './combat/session-recovery.js';
import {
  calculatePlayerStats,
  captureEquipmentSnapshot,
  getWeaponConfig,
  selectEnemy
} from './combat/session.js';
import {
  executeAttackTurn,
  executeDefenseTurn,
} from './combat/turn-execution.js';
import {
  AttackResult,
  CombatRewards,
  CombatSession,
  DefenseResult,
  LootRewards
} from './combat/types.js';

let combatRepository = new CombatRepository();
let enemyRepository = new EnemyRepository();
let equipmentRepository = new EquipmentRepository();
let itemRepository = new ItemRepository();
let itemTypeRepository = new ItemTypeRepository();
let weaponRepository = new WeaponRepository();
let materialRepository = new MaterialRepository();
let profileRepository = new ProfileRepository();
let rarityRepository = new RarityRepository();
let styleRepository = new StyleRepository();
export class CombatService {

  private combatRepository: CombatRepository;
  private enemyRepository: EnemyRepository;
  private equipmentRepository: EquipmentRepository;
  private itemRepository: ItemRepository;
  private itemTypeRepository: ItemTypeRepository;
  private weaponRepository: WeaponRepository;
  private materialRepository: MaterialRepository;
  private profileRepository: ProfileRepository;
  private rarityRepository: RarityRepository;
  private styleRepository: StyleRepository;

  constructor(
    combatRepo?: CombatRepository,
    enemyRepo?: EnemyRepository,
    equipmentRepo?: EquipmentRepository,
    itemRepo?: ItemRepository,
    itemTypeRepo?: ItemTypeRepository,
    weaponRepo?: WeaponRepository,
    materialRepo?: MaterialRepository,
    profileRepo?: ProfileRepository,
    rarityRepo?: RarityRepository,
    styleRepo?: StyleRepository
  ) {
    this.combatRepository = combatRepo || combatRepository;
    this.enemyRepository = enemyRepo || enemyRepository;
    this.equipmentRepository = equipmentRepo || equipmentRepository;
    this.itemRepository = itemRepo || itemRepository;
    this.itemTypeRepository = itemTypeRepo || itemTypeRepository;
    this.weaponRepository = weaponRepo || weaponRepository;
    this.materialRepository = materialRepo || materialRepository;
    this.profileRepository = profileRepo || profileRepository;
    this.rarityRepository = rarityRepo || rarityRepository;
    this.styleRepository = styleRepo || styleRepository;
  }

  async startCombat(userId: string, locationId: string, selectedLevel: number): Promise<CombatSession> {
    logger.info('⚔️ Starting new combat session', { userId, locationId, selectedLevel });

    if (selectedLevel < 1) {
      throw new ValidationError('Combat level must be 1 or greater');
    }

    const existingSession = await this.combatRepository.getUserActiveSession(userId);
    if (existingSession) {
      logger.warn('❌ Combat start failed: user already has active session', {
        userId,
        existingSessionId: existingSession.id
      });
      throw new ConflictError('User already has an active combat session');
    }

    const location = await locationService.getById(locationId);
    if (!location) {
      throw new NotFoundError('Location', locationId);
    }

    const playerStats = await calculatePlayerStats(this.equipmentRepository, userId);

    const enemy = await selectEnemy(this.enemyRepository, locationId, selectedLevel);

    const weaponConfig = await getWeaponConfig(
      this.equipmentRepository,
      this.weaponRepository,
      userId,
      playerStats.atkAccuracy
    );

    const enemyWithTier = await this.enemyRepository.getEnemyTypeWithTier(enemy.id);
    if (!enemyWithTier || !enemyWithTier.enemyType || !enemyWithTier.tier) {
      throw new NotFoundError('Enemy type or tier', enemy.id);
    }

    const realizedEnemyStats = statsService.calculateEnemyRealizedStats(
      enemyWithTier.enemyType,
      selectedLevel,
      enemyWithTier.tier
    );

    if (!enemyWithTier.enemyType.base_hp || !enemyWithTier.tier.difficulty_multiplier) {
      throw new ValidationError('Unable to calculate enemy stats');
    }

    const enemyHP = Math.floor(enemyWithTier.enemyType.base_hp * enemyWithTier.tier.difficulty_multiplier);

    console.log(`[CombatService.startCombat] ENEMY STATS CALCULATION:
      enemyType.id=${enemy.id}, enemyType.name=${enemyWithTier.enemyType.name}
      combatLevel=${selectedLevel}, tier.difficulty_multiplier=${enemyWithTier.tier.difficulty_multiplier}
      REALIZED STATS: atk_power=${realizedEnemyStats.atk_power}, def_power=${realizedEnemyStats.def_power}
      BASE HP=${enemyWithTier.enemyType.base_hp}, calculated enemyHP=${enemyHP}`);

    const sessionData: Omit<CombatSessionData, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      locationId,
      combatLevel: selectedLevel,
      enemyTypeId: enemy.id,
      enemyStyleId: enemy.style_id,
      playerEquippedItemsSnapshot: await captureEquipmentSnapshot(this.equipmentRepository, userId),
      combatLog: [],
    };

    const sessionId = await this.combatRepository.createSession(userId, sessionData);

    logger.info('✅ Combat session created successfully', {
      sessionId,
      userId,
      enemyTypeId: enemy.id,
      combatLevel: selectedLevel,
      enemyHP,
      enemyAtkPower: realizedEnemyStats.atk_power,
      enemyDefPower: realizedEnemyStats.def_power
    });

    return {
      session_id: sessionId,
      player_id: userId,
      enemy_id: enemy.id,
      status: 'active',
      player_hp: playerStats.hp,
      enemy_hp: enemyHP,
      location: {
        id: location.id,
        name: location.name,
        location_type: location.location_type,
        background_image_url: location.background_image_url,
        image_url: location.image_url,
      },
      enemy: {
        ...enemy,
        atk_power: realizedEnemyStats.atk_power,
        atk_accuracy: realizedEnemyStats.atk_accuracy,
        def_power: realizedEnemyStats.def_power,
        def_accuracy: realizedEnemyStats.def_accuracy,
        hp: enemyHP,
      },
      player_stats: playerStats,
      weapon_config: weaponConfig,
    };
  }

  async executeAttack(sessionId: string, tapPositionDegrees: number): Promise<AttackResult> {
    logger.info('🎯 Combat attack initiated', { sessionId, tapPositionDegrees });

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

    if (tapPositionDegrees < 0 || tapPositionDegrees > 360) {
      throw new ValidationError('Tap position must be between 0 and 360 degrees');
    }

    const playerStats = await calculatePlayerStats(this.equipmentRepository, session.userId);
    const enemyStats = await calculateEnemyStats(
      this.enemyRepository,
      session.enemyTypeId,
      session.enemyStyleId,
      session.combatLevel
    );

    const weaponConfig = await getWeaponConfig(
      this.equipmentRepository,
      this.weaponRepository,
      session.userId,
      playerStats.atkAccuracy
    );

    const currentLog = (session.combatLog || []) as CombatLogEntry[];
    const { playerHP: currentPlayerHP, enemyHP: currentEnemyHP } = getCurrentHP(
      currentLog,
      playerStats.hp,
      enemyStats.hp
    );

    const turnResult = executeAttackTurn(
      tapPositionDegrees,
      weaponConfig,
      playerStats,
      enemyStats,
      currentPlayerHP,
      currentEnemyHP
    );

    console.log(`[CombatService.executeAttack] TURN SUMMARY:
      Player: ${currentPlayerHP} HP → ${turnResult.newPlayerHP} HP (took ${currentPlayerHP - turnResult.newPlayerHP} damage)
      Enemy: ${currentEnemyHP} HP → ${turnResult.newEnemyHP} HP (took ${currentEnemyHP - turnResult.newEnemyHP} damage)
      Status: ${turnResult.combatStatus}`);

    if (turnResult.combatStatus === 'victory') {
      logger.info('🎉 Combat victory!', { sessionId, finalDamage: turnResult.damageDealt, hitZone: turnResult.hitZone });
    } else if (turnResult.combatStatus === 'defeat') {
      logger.info('💀 Combat defeat', { sessionId, finalDamage: turnResult.damageDealt, hitZone: turnResult.hitZone });
    } else {
      logger.debug('⚔️ Combat ongoing', {
        sessionId,
        playerHP: turnResult.newPlayerHP,
        enemyHP: turnResult.newEnemyHP,
        hitZone: turnResult.hitZone,
        damage: turnResult.damageDealt
      });
    }

    const turnNumber = getNextTurnNumber(currentLog);
    const newLogEntry = createAttackLogEntry(
      turnNumber,
      tapPositionDegrees,
      turnResult.hitZone,
      turnResult.damageDealt,
      turnResult.enemyDamage,
      turnResult.newPlayerHP,
      turnResult.newEnemyHP
    );

    await this.combatRepository.updateSession(sessionId, {
      combatLog: [...currentLog, newLogEntry],
    });

    await this.combatRepository.addLogEvent(sessionId, {
      seq: turnNumber,
      ts: new Date(),
      actor: 'player',
      eventType: 'attack',
      payload: { hitZone: turnResult.hitZone, damageDealt: turnResult.damageDealt, tapPositionDegrees },
      valueI: Math.round(turnResult.damageDealt),
    });

    let rewards: CombatRewards | null = null;
    if (turnResult.combatStatus === 'victory' || turnResult.combatStatus === 'defeat') {
      logger.info('💰 Generating and applying rewards', { sessionId, result: turnResult.combatStatus });

      const completionResult = await this.completeCombatInternal(sessionId, turnResult.combatStatus, session);

      rewards = await this.applyRewardsTransaction(session.userId, sessionId, completionResult.rewards, session.combatLevel, completionResult.baseRewards);

      logger.info('✅ Session cleanup complete', { sessionId });
    }

    return {
      player_damage: turnResult.playerZoneHitInfo,
      enemy_damage: turnResult.enemyZoneHitInfo,
      player_hp_remaining: turnResult.newPlayerHP,
      enemy_hp_remaining: turnResult.newEnemyHP,
      combat_status: turnResult.combatStatus,
      turn_number: turnNumber,
      rewards,
    };
  }

  async executeDefense(sessionId: string, tapPositionDegrees: number): Promise<DefenseResult> {
    logger.info('🛡️ Combat defense initiated', { sessionId, tapPositionDegrees });

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

    if (tapPositionDegrees < 0 || tapPositionDegrees > 360) {
      throw new ValidationError('Tap position must be between 0 and 360 degrees');
    }

    const playerStats = await calculatePlayerStats(this.equipmentRepository, session.userId);
    const enemyStats = await calculateEnemyStats(
      this.enemyRepository,
      session.enemyTypeId,
      session.enemyStyleId,
      session.combatLevel
    );

    const weaponConfig = await getWeaponConfig(
      this.equipmentRepository,
      this.weaponRepository,
      session.userId,
      playerStats.atkAccuracy
    );

    const currentLog = (session.combatLog || []) as CombatLogEntry[];
    const { playerHP: currentPlayerHP, enemyHP: currentEnemyHP } = getCurrentHP(
      currentLog,
      playerStats.hp,
      enemyStats.hp
    );

    const turnResult = executeDefenseTurn(
      tapPositionDegrees,
      weaponConfig,
      playerStats,
      enemyStats,
      currentPlayerHP,
      currentEnemyHP
    );

    console.log(`[CombatService.executeDefense] TURN SUMMARY:
      Player: ${currentPlayerHP} HP → ${turnResult.newPlayerHP} HP (took ${currentPlayerHP - turnResult.newPlayerHP} damage)
      Enemy: ${currentEnemyHP} HP → ${turnResult.currentEnemyHP} HP (no change - defending doesn't damage)
      Status: ${turnResult.combatStatus}`);

    const turnNumber = getNextTurnNumber(currentLog);
    const newLogEntry = createDefenseLogEntry(
      turnNumber,
      tapPositionDegrees,
      turnResult.hitZone,
      turnResult.damageBlocked,
      turnResult.damageActuallyTaken,
      turnResult.newPlayerHP,
      turnResult.currentEnemyHP
    );

    await this.combatRepository.updateSession(sessionId, {
      combatLog: [...currentLog, newLogEntry],
    });

    await this.combatRepository.addLogEvent(sessionId, {
      seq: turnNumber,
      ts: new Date(),
      actor: 'player',
      eventType: 'defend',
      payload: { hitZone: turnResult.hitZone, damageBlocked: turnResult.damageBlocked, damageActuallyTaken: turnResult.damageActuallyTaken, tapPositionDegrees },
      valueI: Math.round(turnResult.damageActuallyTaken),
    });

    let rewards: CombatRewards | null = null;
    if (turnResult.combatStatus === 'defeat') {
      logger.info('💰 Generating and applying rewards', { sessionId, result: turnResult.combatStatus });

      const completionResult = await this.completeCombatInternal(sessionId, turnResult.combatStatus, session);

      rewards = await this.applyRewardsTransaction(session.userId, sessionId, completionResult.rewards, session.combatLevel, completionResult.baseRewards);

      logger.info('✅ Session cleanup complete', { sessionId });
    }

    return {
      player_damage: turnResult.playerDefenseZoneHitInfo,
      enemy_damage: turnResult.enemyZoneHitInfo,
      player_hp_remaining: turnResult.newPlayerHP,
      enemy_hp_remaining: turnResult.currentEnemyHP,
      combat_status: turnResult.combatStatus,
      turn_number: turnNumber,
      rewards,
    };
  }

  async completeCombat(sessionId: string, result: 'victory' | 'defeat'): Promise<CombatRewards> {
    logger.info('📊 Completing combat session (public API)', { sessionId, result });

    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    const completionResult = await this.completeCombatInternal(sessionId, result, session);

    // Apply rewards only if victory (defeat doesn't apply any rewards)
    if (result === 'victory') {
      return await this.applyRewardsTransaction(session.userId, sessionId, completionResult.rewards, session.combatLevel, completionResult.baseRewards);
    }

    return completionResult.rewards;
  }

  private async completeCombatInternal(sessionId: string, result: 'victory' | 'defeat', session: CombatSessionData): Promise<{ rewards: CombatRewards; baseRewards?: LootRewards }> {
    logger.info('📊 Completing combat session (internal)', { sessionId, result });

    if (result !== 'victory' && result !== 'defeat') {
      throw new ValidationError('Result must be "victory" or "defeat"');
    }

    await this.combatRepository.completeSession(sessionId, result);

    const playerHistory = await this.combatRepository.getPlayerHistory(session.userId, session.locationId);

    const combatHistory = {
      location_id: session.locationId,
      total_attempts: playerHistory?.totalAttempts ?? 1,
      victories: playerHistory?.victories ?? (result === 'victory' ? 1 : 0),
      defeats: playerHistory?.defeats ?? (result === 'defeat' ? 1 : 0),
      current_streak: playerHistory?.currentStreak ?? (result === 'victory' ? 1 : 0),
      longest_streak: playerHistory?.longestStreak ?? (result === 'victory' ? 1 : 0),
    };

    if (result === 'victory') {

      const baseRewards = await generateLoot(
        this.enemyRepository,
        this.itemTypeRepository,
        this.materialRepository,
        this.rarityRepository,
        this.styleRepository,
        session.locationId,
        session.combatLevel,
        session.enemyTypeId,
        session.enemyStyleId
      );

      logger.info('🎉 Victory rewards generated (DB writes deferred to applyRewards)', {
        sessionId,
        result,
        goldAmount: baseRewards.currencies.gold,
        materialsCount: baseRewards.materials.length,
        itemsCount: baseRewards.items.length,
        experience: baseRewards.experience,
      });

      // Return rewards with items as empty - they will be created in applyRewards() and merged by applyRewardsTransaction()
      const victoryRewards: CombatRewards = {
        result,
        currencies: baseRewards.currencies,
        materials: baseRewards.materials,
        items: [], // Will be populated by applyRewardsTransaction
        experience: baseRewards.experience,
        combat_history: combatHistory,
      };
      return { rewards: victoryRewards, baseRewards };
    }

    const defeatRewards: CombatRewards = {
      result,
      currencies: {
        gold: 0,
      },
      combat_history: combatHistory,
    };
    logger.info('💀 Defeat - no rewards', {
      sessionId,
      combatHistoryStats: { victories: combatHistory.victories, defeats: combatHistory.defeats }
    });
    return { rewards: defeatRewards };
  }

  async abandonCombat(sessionId: string): Promise<void> {
    await this.combatRepository.deleteSession(sessionId);
  }

  async getUserActiveSession(userId: string): Promise<CombatSessionData | null> {
    return await this.combatRepository.getUserActiveSession(userId);
  }

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

    const playerStats = await calculatePlayerStats(this.equipmentRepository, session.userId);
    const enemyStats = await calculateEnemyStats(
      this.enemyRepository,
      session.enemyTypeId,
      session.enemyStyleId,
      session.combatLevel
    );

    const currentLog = (session.combatLog || []) as CombatLogEntry[];
    return buildBasicSessionData(
      sessionId,
      session.userId,
      session.enemyTypeId,
      session.locationId,
      currentLog,
      playerStats,
      enemyStats,
      session.createdAt,
      session.updatedAt
    );
  }

  async getCombatSessionForRecovery(sessionId: string, userId: string): Promise<{
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
  }> {
    const session = await this.combatRepository.getActiveSession(sessionId);
    if (!session) {
      throw new NotFoundError('Combat session', sessionId);
    }

    if (session.userId !== userId) {
      throw new NotFoundError('Combat session', sessionId);
    }

    const playerStats = await calculatePlayerStats(this.equipmentRepository, session.userId);
    const enemyStats = await calculateEnemyStats(
      this.enemyRepository,
      session.enemyTypeId,
      session.enemyStyleId,
      session.combatLevel
    );

    const weaponConfig = await getWeaponConfig(
      this.equipmentRepository,
      this.weaponRepository,
      session.userId,
      playerStats.atkAccuracy
    );

    const enemyType = await this.enemyRepository.findEnemyTypeById(session.enemyTypeId);
    if (!enemyType) {
      throw new NotFoundError('Enemy type', session.enemyTypeId);
    }

    if (!enemyType.dialogue_tone) {
      throw new Error(`Enemy type ${session.enemyTypeId} missing required dialogue_tone`);
    }

    // Fetch location for background image support
    const location = await locationService.getById(session.locationId);
    const locationData = location ? {
      id: location.id,
      name: location.name,
      location_type: location.location_type,
      background_image_url: location.background_image_url,
      image_url: location.image_url,
    } : undefined;

    const currentLog = (session.combatLog || []) as CombatLogEntry[];
    return buildSessionRecoveryData(
      sessionId,
      session.userId,
      session.enemyTypeId,
      session.combatLevel,
      currentLog,
      playerStats,
      enemyStats,
      weaponConfig,
      {
        id: enemyType.id,
        name: enemyType.name,
        dialogue_tone: enemyType.dialogue_tone,
        ai_personality_traits: enemyType.ai_personality_traits as Record<string, unknown> | undefined,
      },
      session.createdAt,
      locationData
    );
  }

  private async applyRewardsTransaction(
    userId: string,
    sessionId: string,
    rewards: CombatRewards,
    combatLevel: number,
    baseRewards?: LootRewards
  ): Promise<CombatRewards> {

    // Use baseRewards items if provided - they will be created by applyRewards
    const rewardsForApplication = baseRewards ? {
      ...rewards,
      items: baseRewards.items as CombatRewards['items'],
    } : rewards;

    const appliedResult = await applyRewards(
      this.itemRepository,
      this.materialRepository,
      this.profileRepository,
      userId,
      sessionId,
      rewardsForApplication,
      combatLevel
    );

    // Merge created items back into rewards for response
    const finalRewards: CombatRewards = {
      ...rewards,
      items: appliedResult.createdItems,
    };

    logger.info('🗑️ Deleting combat session', { sessionId, userId });
    await this.combatRepository.deleteSession(sessionId);
    logger.info('✅ Combat session deleted successfully', { sessionId });

    return finalRewards;
  }
}

export const combatService = new CombatService();
