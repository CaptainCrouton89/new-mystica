/**
 * CombatRepository - Combat session and history management
 *
 * Handles PostgreSQL-only storage pattern:
 * - Active sessions in PostgreSQL combatsessions table (with expiry logic)
 * - Combat log events (normalized turn-by-turn tracking)
 * - Player combat history per location (analytics and progression)
 *
 * Tables: combatsessions, combatlogevents, playercombathistory
 * Session expiry: 15 minutes from created_at timestamp
 */

import { BaseRepository } from './BaseRepository.js';
import { ValidationError, BusinessLogicError, NotFoundError, mapSupabaseError } from '../utils/errors.js';
import { Database } from '../types/database.types.js';
import type { CombatRewards, PlayerCombatContext } from '../types/api.types.js';
import { v4 as uuidv4 } from 'uuid';

// Database row types
type CombatSession = Database['public']['Tables']['combatsessions']['Row'];
type CombatLogEvent = Database['public']['Tables']['combatlogevents']['Row'];
type PlayerCombatHistory = Database['public']['Tables']['playercombathistory']['Row'];
type EnemyChatterLog = Database['public']['Tables']['enemychatterlog']['Row'];

// Insert types
type CombatSessionInsert = Database['public']['Tables']['combatsessions']['Insert'];
type CombatLogEventInsert = Database['public']['Tables']['combatlogevents']['Insert'];
type PlayerCombatHistoryInsert = Database['public']['Tables']['playercombathistory']['Insert'];
type EnemyChatterLogInsert = Database['public']['Tables']['enemychatterlog']['Insert'];

// Enums
type CombatResult = Database['public']['Enums']['combat_result'];
type Actor = Database['public']['Enums']['actor'];

/**
 * Combat session data structure for PostgreSQL storage
 * Active and completed combat sessions
 */
export interface CombatSessionData {
  id: string;
  userId: string;
  locationId: string;
  combatLevel: number;
  enemyTypeId: string;
  enemyStyleId: string;
  appliedEnemyPools?: any;
  appliedLootPools?: any;
  playerEquippedItemsSnapshot?: any;
  playerRating?: number;
  enemyRating?: number;
  winProbEst?: number;
  combatLog?: any[];
  outcome?: CombatResult;
  rewards?: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Combat log event data structure
 * Turn-by-turn event tracking
 */
export interface CombatLogEventData {
  combatId: string;
  seq: number;
  ts: Date;
  actor: Actor;
  eventType: string;
  payload?: any;
  valueI?: number;
}

/**
 * Player combat history data structure
 * Per-location analytics and progression tracking
 */
export interface PlayerCombatHistoryData {
  userId: string;
  locationId: string;
  totalAttempts: number;
  victories: number;
  defeats: number;
  currentStreak: number;
  longestStreak: number;
  lastAttempt?: Date;
}

/**
 * Enemy chatter log entry data structure
 * For logging AI-generated dialogue attempts
 */
export interface ChatterLogEntry {
  sessionId: string;
  enemyTypeId: string;
  eventType: string;
  generatedDialogue?: string;
  dialogueTone?: string;
  generationTimeMs?: number;
  wasAiGenerated?: boolean;
  playerMetadata?: any;
  combatContext?: any;
}

/**
 * Combat session TTL in seconds (60 minutes)
 * Used for session expiry logic based on created_at timestamp
 * Increased from 15min to 60min to support app backgrounding and debugging
 */
export const COMBAT_SESSION_TTL = 3600; // 60 minutes

/**
 * CombatRepository - PostgreSQL-only combat session management
 *
 * Responsibilities:
 * - Active session management (PostgreSQL with expiry logic)
 * - Combat log event tracking (normalized)
 * - Player combat history analytics (per location)
 * - Combat ratings and win probability tracking
 * - Session expiry handling based on created_at timestamp
 */
export class CombatRepository extends BaseRepository<CombatSession> {
  constructor() {
    super('combatsessions');
  }

  // ========================================
  // SESSION OPERATIONS (PostgreSQL)
  // ========================================

  /**
   * Create new combat session in PostgreSQL
   *
   * @param userId - User UUID
   * @param sessionData - Initial session data
   * @returns Session ID
   * @throws ValidationError on invalid data
   * @throws BusinessLogicError if user already has active session
   */
  async createSession(userId: string, sessionData: Omit<CombatSessionData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Validate user doesn't already have active session (unexpired and incomplete)
    const existingSession = await this.getUserActiveSession(userId);
    if (existingSession) {
      throw new BusinessLogicError('User already has an active combat session');
    }

    const sessionId = uuidv4();
    const now = new Date();

    const sessionInsert: CombatSessionInsert = {
      id: sessionId,
      user_id: sessionData.userId,
      location_id: sessionData.locationId,
      combat_level: sessionData.combatLevel,
      enemy_type_id: sessionData.enemyTypeId,
      enemy_style_id: sessionData.enemyStyleId,
      applied_enemy_pools: sessionData.appliedEnemyPools || null,
      player_equipped_items_snapshot: sessionData.playerEquippedItemsSnapshot || null,
      player_rating: sessionData.playerRating || null,
      enemy_rating: sessionData.enemyRating || null,
      win_prob_est: sessionData.winProbEst || null,
      combat_log: sessionData.combatLog || null,
      outcome: null, // Active session starts without outcome
      rewards: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    await this.create(sessionInsert as Partial<CombatSession>);
    return sessionId;
  }

  /**
   * Get active combat session from PostgreSQL
   *
   * @param sessionId - Session UUID
   * @returns Session data or null if not found/expired/completed
   * @throws ValidationError on invalid session ID
   */
  async getActiveSession(sessionId: string): Promise<CombatSessionData | null> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ValidationError('Session ID must be a non-empty string');
    }

    const { data, error } = await this.client
      .from('combatsessions')
      .select('*')
      .eq('id', sessionId)
      .is('outcome', null) // Only incomplete sessions
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Session not found or completed
      }
      throw new ValidationError(`Failed to get active session: ${error.message}`);
    }

    // Check if session is expired (> 15 minutes old)
    if (this.isSessionExpired(new Date(data.created_at))) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      locationId: data.location_id,
      combatLevel: data.combat_level,
      enemyTypeId: data.enemy_type_id,
      enemyStyleId: data.enemy_style_id,
      appliedEnemyPools: data.applied_enemy_pools,
      appliedLootPools: data.applied_loot_pools,
      playerEquippedItemsSnapshot: data.player_equipped_items_snapshot,
      playerRating: data.player_rating,
      enemyRating: data.enemy_rating,
      winProbEst: data.win_prob_est,
      combatLog: data.combat_log,
      outcome: data.outcome,
      rewards: data.rewards,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get user's active session
   *
   * @param userId - User UUID
   * @returns Active session data or null
   */
  async getUserActiveSession(userId: string): Promise<CombatSessionData | null> {
    const ttlThreshold = new Date(Date.now() - COMBAT_SESSION_TTL * 1000).toISOString();

    console.log('🔍 [getUserActiveSession]', {
      userId,
      ttlThreshold,
      ttlSeconds: COMBAT_SESSION_TTL
    });

    const { data, error } = await this.client
      .from('combatsessions')
      .select('*')
      .eq('user_id', userId)
      .is('outcome', null) // Only incomplete sessions
      .gte('created_at', ttlThreshold) // Within TTL
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('📊 [getUserActiveSession] Query result:', {
      hasData: !!data,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
      sessionId: data?.id,
      createdAt: data?.created_at
    });

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️  [getUserActiveSession] No session found (PGRST116)');
        return null; // No active session found
      }
      throw new ValidationError(`Failed to get user active session: ${error.message}`);
    }

    if (!data) {
      console.log('ℹ️  [getUserActiveSession] No data returned');
      return null; // No active session found
    }

    console.log('✅ [getUserActiveSession] Found active session:', data.id);

    return {
      id: data.id,
      userId: data.user_id,
      locationId: data.location_id,
      combatLevel: data.combat_level,
      enemyTypeId: data.enemy_type_id,
      enemyStyleId: data.enemy_style_id,
      appliedEnemyPools: data.applied_enemy_pools,
      appliedLootPools: data.applied_loot_pools,
      playerEquippedItemsSnapshot: data.player_equipped_items_snapshot,
      playerRating: data.player_rating,
      enemyRating: data.enemy_rating,
      winProbEst: data.win_prob_est,
      combatLog: data.combat_log,
      outcome: data.outcome,
      rewards: data.rewards,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Update active combat session in PostgreSQL
   *
   * @param sessionId - Session UUID
   * @param data - Partial session data to update
   * @throws NotFoundError if session not found/expired
   * @throws ValidationError on invalid data
   */
  async updateSession(sessionId: string, data: Partial<CombatSessionData>): Promise<void> {
    const existingSession = await this.getActiveSession(sessionId);
    if (!existingSession) {
      throw new NotFoundError('combat session', sessionId);
    }

    const updateData: Partial<CombatSession> = {
      combat_log: data.combatLog || existingSession.combatLog,
      player_rating: data.playerRating ?? existingSession.playerRating,
      enemy_rating: data.enemyRating ?? existingSession.enemyRating,
      win_prob_est: data.winProbEst ?? existingSession.winProbEst,
      rewards: data.rewards || existingSession.rewards,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.client
      .from('combatsessions')
      .update(updateData)
      .eq('id', sessionId)
      .is('outcome', null); // Only update active sessions

    if (error) {
      throw new ValidationError(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Complete combat session
   * Updates session with final outcome and completion timestamp
   *
   * @param sessionId - Session UUID
   * @param result - Combat outcome
   * @throws NotFoundError if session not found
   */
  async completeSession(sessionId: string, result: CombatResult): Promise<void> {
    const sessionData = await this.getActiveSession(sessionId);
    if (!sessionData) {
      throw new NotFoundError('combat session', sessionId);
    }

    const now = new Date();
    const { error } = await this.client
      .from('combatsessions')
      .update({
        outcome: result,
        updated_at: now.toISOString(),
      })
      .eq('id', sessionId)
      .is('outcome', null); // Only complete active sessions

    if (error) {
      throw new ValidationError(`Failed to complete session: ${error.message}`);
    }

    // Update player combat history
    await this.updatePlayerHistory(sessionData.userId, sessionData.locationId, result);
  }

  /**
   * Delete combat session from PostgreSQL
   * Emergency cleanup - permanently removes session
   *
   * @param sessionId - Session UUID
   */
  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('combatsessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      throw new ValidationError(`Failed to delete session: ${error.message}`);
    }
  }

  // ========================================
  // SESSION EXPIRY LOGIC
  // ========================================

  /**
   * Check if a session is expired based on created_at timestamp
   *
   * @param createdAt - Session creation timestamp
   * @returns True if session is older than 15 minutes
   */
  isSessionExpired(createdAt: Date): boolean {
    const now = Date.now();
    const sessionAge = now - createdAt.getTime();
    return sessionAge > (COMBAT_SESSION_TTL * 1000);
  }

  /**
   * Clean up expired sessions
   * Marks expired active sessions as abandoned
   *
   * @returns Number of sessions cleaned up
   */
  async cleanupExpiredSessions(): Promise<number> {
    const expiredThreshold = new Date(Date.now() - COMBAT_SESSION_TTL * 1000);

    const { data, error } = await this.client
      .from('combatsessions')
      .update({
        outcome: 'abandoned',
        updated_at: new Date().toISOString(),
      })
      .is('outcome', null) // Only active sessions
      .lt('created_at', expiredThreshold.toISOString())
      .select('id');

    if (error) {
      throw new ValidationError(`Failed to cleanup expired sessions: ${error.message}`);
    }

    if (data === null || data === undefined) {
      throw new ValidationError('Failed to cleanup expired sessions: query returned no data');
    }
    return data.length;
  }

  // ========================================
  // COMBAT LOG EVENTS (PostgreSQL)
  // ========================================

  /**
   * Add combat log event
   *
   * @param combatId - Combat session UUID
   * @param event - Event data
   * @throws ValidationError on invalid event data
   */
  async addLogEvent(combatId: string, event: Omit<CombatLogEventData, 'combatId'>): Promise<void> {
    const eventInsert: CombatLogEventInsert = {
      combat_id: combatId,
      seq: event.seq,
      ts: event.ts.toISOString(),
      actor: event.actor,
      event_type: event.eventType,
      payload: event.payload || null,
      value_i: event.valueI || null,
    };

    const { error } = await this.client
      .from('combatlogevents')
      .insert(eventInsert);

    if (error) {
      throw new ValidationError(`Failed to add combat log event: ${error.message}`);
    }
  }

  /**
   * Get all combat log events for a session
   *
   * @param combatId - Combat session UUID
   * @returns Array of combat log events ordered by sequence
   */
  async getLogEvents(combatId: string): Promise<CombatLogEventData[]> {
    const { data, error } = await this.client
      .from('combatlogevents')
      .select('*')
      .eq('combat_id', combatId)
      .order('seq', { ascending: true });

    if (error) {
      throw new ValidationError(`Failed to get combat log events: ${error.message}`);
    }

    if (!data) {
      throw new ValidationError('Failed to get combat log events: query returned no data');
    }

    return data.map(event => ({
      combatId: event.combat_id,
      seq: event.seq,
      ts: new Date(event.ts),
      actor: event.actor,
      eventType: event.event_type,
      payload: event.payload,
      valueI: event.value_i,
    }));
  }

  /**
   * Get combat log events by actor
   *
   * @param combatId - Combat session UUID
   * @param actor - Actor type filter
   * @returns Array of combat log events for specified actor
   */
  async getLogEventsByActor(combatId: string, actor: Actor): Promise<CombatLogEventData[]> {
    const { data, error } = await this.client
      .from('combatlogevents')
      .select('*')
      .eq('combat_id', combatId)
      .eq('actor', actor)
      .order('seq', { ascending: true });

    if (error) {
      throw new ValidationError(`Failed to get combat log events by actor: ${error.message}`);
    }

    if (!data) {
      throw new ValidationError('Failed to get combat log events by actor: query returned no data');
    }

    return data.map(event => ({
      combatId: event.combat_id,
      seq: event.seq,
      ts: new Date(event.ts),
      actor: event.actor,
      eventType: event.event_type,
      payload: event.payload,
      valueI: event.value_i,
    }));
  }

  // ========================================
  // PLAYER COMBAT HISTORY (PostgreSQL)
  // ========================================

  /**
   * Get player combat history for a location
   *
   * @param userId - User UUID
   * @param locationId - Location UUID
   * @returns Player combat history or null if no history
   */
  async getPlayerHistory(userId: string, locationId: string): Promise<PlayerCombatHistoryData | null> {
    const { data, error } = await this.client
      .from('playercombathistory')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No history found
      }
      throw new ValidationError(`Failed to get player combat history: ${error.message}`);
    }

    return {
      userId: data.user_id,
      locationId: data.location_id,
      totalAttempts: data.total_attempts,
      victories: data.victories,
      defeats: data.defeats,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      lastAttempt: data.last_attempt ? new Date(data.last_attempt) : undefined,
    };
  }

  /**
   * Update player combat history using atomic RPC
   *
   * @param userId - User UUID
   * @param locationId - Location UUID
   * @param result - Combat result ('victory' or 'defeat')
   * @throws BusinessLogicError on invalid result
   */
  async updatePlayerHistory(userId: string, locationId: string, result: CombatResult): Promise<void> {
    // Map combat_result enum to simplified result for RPC
    let simpleResult: 'victory' | 'defeat';
    if (result === 'victory') {
      simpleResult = 'victory';
    } else if (result === 'defeat') {
      simpleResult = 'defeat';
    } else {
      // For 'escape' or 'abandoned', treat as defeat for streak tracking
      simpleResult = 'defeat';
    }

    await this.rpc('update_combat_history', {
      p_user_id: userId,
      p_location_id: locationId,
      p_result: simpleResult,
    });
  }

  /**
   * Increment total attempts for a location
   * Used when starting combat (before completion)
   *
   * @param userId - User UUID
   * @param locationId - Location UUID
   */
  async incrementAttempts(userId: string, locationId: string): Promise<void> {
    const { error } = await this.client
      .from('playercombathistory')
      .upsert({
        user_id: userId,
        location_id: locationId,
        total_attempts: 1,
        victories: 0,
        defeats: 0,
        current_streak: 0,
        longest_streak: 0,
      }, {
        onConflict: 'user_id,location_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      // If row exists, increment attempts
      const { error: updateError } = await this.client
        .rpc('increment_combat_attempts', {
          p_user_id: userId,
          p_location_id: locationId,
        });

      if (updateError) {
        throw new ValidationError(`Failed to increment combat attempts: ${updateError.message}`);
      }
    }
  }

  /**
   * Update combat streak for a location
   * Note: This is handled by updatePlayerHistory RPC, but kept for compatibility
   *
   * @param userId - User UUID
   * @param locationId - Location UUID
   * @param won - Whether the combat was won
   */
  async updateStreak(userId: string, locationId: string, won: boolean): Promise<void> {
    const result = won ? 'victory' : 'defeat';
    await this.updatePlayerHistory(userId, locationId, result);
  }

  // ========================================
  // ANALYTICS AND REPORTING
  // ========================================

  /**
   * Get combat statistics for a user across all locations
   *
   * @param userId - User UUID
   * @returns Aggregated combat statistics
   */
  async getUserCombatStats(userId: string): Promise<{
    totalLocations: number;
    totalAttempts: number;
    totalVictories: number;
    totalDefeats: number;
    winRate: number;
    longestStreak: number;
    currentActiveStreaks: number;
  }> {
    const { data, error } = await this.client
      .from('playercombathistory')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new ValidationError(`Failed to get user combat stats: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalLocations: 0,
        totalAttempts: 0,
        totalVictories: 0,
        totalDefeats: 0,
        winRate: 0,
        longestStreak: 0,
        currentActiveStreaks: 0,
      };
    }

    const totalLocations = data.length;
    const totalAttempts = data.reduce((sum, row) => sum + row.total_attempts, 0);
    const totalVictories = data.reduce((sum, row) => sum + row.victories, 0);
    const totalDefeats = data.reduce((sum, row) => sum + row.defeats, 0);
    const winRate = totalAttempts > 0 ? totalVictories / totalAttempts : 0;
    const longestStreak = Math.max(...data.map(row => row.longest_streak));
    const currentActiveStreaks = data.filter(row => row.current_streak > 0).length;

    return {
      totalLocations,
      totalAttempts,
      totalVictories,
      totalDefeats,
      winRate,
      longestStreak,
      currentActiveStreaks,
    };
  }

  /**
   * Get top performing locations for a user
   *
   * @param userId - User UUID
   * @param limit - Number of locations to return
   * @returns Top locations by win rate
   */
  async getTopLocations(userId: string, limit: number = 10): Promise<Array<{
    locationId: string;
    totalAttempts: number;
    victories: number;
    winRate: number;
    currentStreak: number;
    longestStreak: number;
  }>> {
    const { data, error } = await this.client
      .from('playercombathistory')
      .select('*')
      .eq('user_id', userId)
      .gte('total_attempts', 3) // Only locations with at least 3 attempts
      .order('victories', { ascending: false })
      .limit(limit);

    if (error) {
      throw new ValidationError(`Failed to get top locations: ${error.message}`);
    }

    if (!data) {
      throw new ValidationError('Failed to get top locations: query returned no data');
    }

    return data.map(row => ({
      locationId: row.location_id,
      totalAttempts: row.total_attempts,
      victories: row.victories,
      winRate: row.total_attempts > 0 ? row.victories / row.total_attempts : 0,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
    }));
  }

  /**
   * Check if user has any active combat sessions
   *
   * @param userId - User UUID
   * @returns True if user has active session in PostgreSQL
   */
  async hasActiveSession(userId: string): Promise<boolean> {
    const session = await this.getUserActiveSession(userId);
    return !!session;
  }

  /**
   * Get session expiry time
   *
   * @param sessionId - Session UUID
   * @returns Expiry timestamp or null if session not found
   */
  async getSessionExpiry(sessionId: string): Promise<Date | null> {
    const session = await this.getActiveSession(sessionId);
    if (!session) {
      return null;
    }
    return new Date(session.createdAt.getTime() + (COMBAT_SESSION_TTL * 1000));
  }

  /**
   * Extend session activity
   * Updates the updated_at timestamp to indicate recent activity
   *
   * @param sessionId - Session UUID
   */
  async extendSessionActivity(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('combatsessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('outcome', null); // Only active sessions

    if (error) {
      throw new ValidationError(`Failed to extend session activity: ${error.message}`);
    }
  }

  // ========================================
  // COMBAT RATING CALCULATION
  // ========================================

  /**
   * Calculate combat rating using PostgreSQL RPC function
   *
   * @param atkPower - Attack power stat
   * @param atkAccuracy - Attack accuracy stat
   * @param defPower - Defense power stat
   * @param defAccuracy - Defense accuracy stat
   * @param hp - Health points
   * @returns Combat rating as number
   * @throws DatabaseError on RPC failure
   */
  async calculateCombatRating(
    atkPower: number,
    atkAccuracy: number,
    defPower: number,
    defAccuracy: number,
    hp: number
  ): Promise<number> {
    const { data, error } = await this.client.rpc('combat_rating', {
      atk_power: atkPower,
      atk_accuracy: atkAccuracy,
      def_power: defPower,
      def_accuracy: defAccuracy,
      hp: hp
    });

    if (error) {
      throw mapSupabaseError(error);
    }

    if (data === null || data === undefined) {
      throw mapSupabaseError(new Error('Failed to calculate combat rating: query returned no data'));
    }
    return Number(data);
  }

  // ========================================
  // CHATTER LOGGING AND PLAYER HISTORY
  // ========================================

  /**
   * Get player combat history for EnemyChatterService
   * Returns PlayerCombatContext format for AI dialogue generation
   *
   * @param userId - User UUID
   * @param locationId - Location UUID
   * @returns Player combat context or default values for new players
   */
  async getPlayerCombatContext(userId: string, locationId: string): Promise<PlayerCombatContext> {
    const { data, error } = await this.client
      .from('playercombathistory')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .single();

    if (error || !data) {
      // Return default context for new players
      return {
        attempts: 0,
        victories: 0,
        defeats: 0,
        current_streak: 0,
      };
    }

    return {
      attempts: data.total_attempts || 0,
      victories: data.victories || 0,
      defeats: data.defeats || 0,
      current_streak: data.current_streak || 0,
    };
  }

  /**
   * Log enemy chatter dialogue attempt
   * Records AI generation attempts and results for analytics
   *
   * @param logEntry - Chatter log entry data
   * @throws ValidationError on database error (non-throwing for service reliability)
   */
  async logChatterAttempt(logEntry: ChatterLogEntry): Promise<void> {
    try {
      const chatterLogInsert: EnemyChatterLogInsert = {
        session_id: logEntry.sessionId,
        enemy_type_id: logEntry.enemyTypeId,
        event_type: logEntry.eventType,
        generated_dialogue: logEntry.generatedDialogue || null,
        dialogue_tone: logEntry.dialogueTone || null,
        generation_time_ms: logEntry.generationTimeMs || 0,
        was_ai_generated: logEntry.wasAiGenerated || false,
        player_metadata: logEntry.playerMetadata || null,
        combat_context: logEntry.combatContext || null,
      };

      const { error } = await this.client
        .from('enemychatterlog')
        .insert([chatterLogInsert]);

      if (error) {
        console.error('Failed to log chatter attempt:', error);
        // Don't throw here - logging failure shouldn't break dialogue generation
      }
    } catch (error) {
      console.error('Failed to log chatter attempt:', error);
      // Don't throw here - logging failure shouldn't break dialogue generation
    }
  }
}