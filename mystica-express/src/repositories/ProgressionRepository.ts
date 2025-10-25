/**
 * ProgressionRepository
 *
 * Handles progression-related database operations including:
 * - Player XP and level management
 * - XP award operations with atomic updates
 * - Level reward claim tracking (when tables are available)
 * - Progression status queries
 */

import { BaseRepository } from './BaseRepository.js';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors.js';
import { Database } from '../types/database.types.js';
import { SupabaseClient } from '@supabase/supabase-js';

// Type aliases from database schema
type PlayerProgression = Database['public']['Tables']['playerprogression']['Row'];
type PlayerProgressionInsert = Database['public']['Tables']['playerprogression']['Insert'];
type PlayerProgressionUpdate = Database['public']['Tables']['playerprogression']['Update'];
type LevelReward = Database['public']['Tables']['levelrewards']['Row'];
type UserLevelReward = Database['public']['Tables']['userlevelrewards']['Row'];
type UserLevelRewardInsert = Database['public']['Tables']['userlevelrewards']['Insert'];

/**
 * Progression repository for XP and level management
 */
export class ProgressionRepository extends BaseRepository<PlayerProgression> {
  constructor(client?: SupabaseClient<Database>) {
    super('playerprogression', client);
  }

  // ============================================================================
  // Progression Data Operations
  // ============================================================================

  /**
   * Get player progression by user ID
   * Creates default progression record if it doesn't exist
   */
  /**
   * Get player progression by user ID
   * @param {string} userId - The unique identifier of the user
   * @returns {Promise<PlayerProgression>} The player's progression record
   * @throws {ValidationError} If user ID is invalid
   */
  async getPlayerProgression(userId: string): Promise<PlayerProgression> {
    let progression = await this.findOne({ user_id: userId });

    if (!progression) {
      // Create default progression record
      const defaultProgression: PlayerProgressionInsert = {
        user_id: userId,
        xp: 0,
        level: 1,
        xp_to_next_level: this.calculateXPToNextLevel(1),
        last_level_up_at: null
      };

      progression = await this.create(defaultProgression);
    }

    return progression;
  }

  /**
   * Award XP to player with atomic operation and level-up detection
   * Returns updated progression data with level change information
   */
  async awardExperience(
    userId: string,
    xpAmount: number,
    source: string,
    sourceId?: string,
    metadata?: Record<string, any>
  ): Promise<{
    progression: PlayerProgression;
    leveledUp: boolean;
    oldLevel: number;
    newLevel: number;
    xpAwarded: number;
  }> {
    if (xpAmount <= 0) {
      throw new ValidationError('XP amount must be positive');
    }

    // Get current progression
    const currentProgression = await this.getPlayerProgression(userId);
    const oldLevel = currentProgression.level;
    const newXP = currentProgression.xp + xpAmount;

    // Calculate new level from total XP
    const newLevel = this.calculateLevelFromXP(newXP);
    const leveledUp = newLevel > oldLevel;

    // Calculate XP to next level
    const xpToNext = this.calculateXPToNextLevel(newLevel);
    const currentLevelXP = this.calculateTotalXPForLevel(newLevel);
    const xpInCurrentLevel = newXP - currentLevelXP;
    const xpToNextLevel = xpToNext - xpInCurrentLevel;

    // Update progression with atomic operation
    const updateData: PlayerProgressionUpdate = {
      xp: newXP,
      level: newLevel,
      xp_to_next_level: xpToNextLevel,
      ...(leveledUp && { last_level_up_at: new Date().toISOString() }),
      updated_at: new Date().toISOString()
    };

    const updatedProgression = await this.update(userId, updateData);

    return {
      progression: updatedProgression,
      leveledUp,
      oldLevel,
      newLevel,
      xpAwarded: xpAmount
    };
  }

  /**
   * Check if player has reached specific level
   */
  async validateLevelReached(userId: string, targetLevel: number): Promise<boolean> {
    const progression = await this.getPlayerProgression(userId);
    return progression.level >= targetLevel;
  }

  // ============================================================================
  // Level Calculation Utilities
  // ============================================================================

  /**
   * Calculate XP required for next level: 100 * current_level
   */
  calculateXPToNextLevel(currentLevel: number): number {
    return 100 * currentLevel;
  }

  /**
   * Calculate total XP required to reach a specific level
   */
  calculateTotalXPForLevel(targetLevel: number): number {
    let totalXP = 0;
    for (let level = 1; level < targetLevel; level++) {
      totalXP += this.calculateXPToNextLevel(level);
    }
    return totalXP;
  }

  /**
   * Calculate level from total XP using progression formula
   */
  calculateLevelFromXP(totalXP: number): number {
    let level = 1;
    let requiredXP = 0;

    while (requiredXP <= totalXP) {
      const nextLevelXP = this.calculateXPToNextLevel(level);
      if (requiredXP + nextLevelXP > totalXP) break;
      requiredXP += nextLevelXP;
      level++;
    }

    return level;
  }

  // ============================================================================
  // Level Reward System
  // ============================================================================

  /**
   * Get available level rewards for player
   * Returns unclaimed rewards that the player is eligible for
   */
  async getAvailableLevelRewards(userId: string, currentLevel: number): Promise<LevelReward[]> {
    if (currentLevel < 1) {
      throw new ValidationError('Current level must be at least 1');
    }

    try {
      // Get all rewards for levels the player has reached
      const { data: allRewards, error: rewardsError } = await this.client
        .from('levelrewards')
        .select('*')
        .lte('level', currentLevel)
        .eq('is_claimable', true)
        .order('level', { ascending: true });

      if (rewardsError) {
        throw new DatabaseError(`Failed to fetch level rewards: ${rewardsError.message}`);
      }

      if (!allRewards || allRewards.length === 0) {
        return [];
      }

      // Get already claimed rewards
      const { data: claimedRewards, error: claimedError } = await this.client
        .from('userlevelrewards')
        .select('level')
        .eq('user_id', userId);

      if (claimedError) {
        throw new DatabaseError(`Failed to fetch claimed rewards: ${claimedError.message}`);
      }

      const claimedLevels = new Set(claimedRewards?.map(r => r.level) || []);

      // Return only unclaimed rewards
      return allRewards.filter(reward => !claimedLevels.has(reward.level));

    } catch (error) {
      if (error instanceof DatabaseError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get available rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific level reward definition
   */
  async getLevelReward(level: number): Promise<LevelReward | null> {
    if (level < 1) {
      throw new ValidationError('Level must be at least 1');
    }

    try {
      const { data, error } = await this.client
        .from('levelrewards')
        .select('*')
        .eq('level', level)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No reward found for this level
        }
        throw new DatabaseError(`Failed to fetch level reward: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof DatabaseError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get level reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if level reward has been claimed
   */
  async isLevelRewardClaimed(userId: string, level: number): Promise<boolean> {
    if (level < 1) {
      throw new ValidationError('Level must be at least 1');
    }

    try {
      // Validate input before database query
      if (!userId || !level) {
        throw new ValidationError('User ID and level are required');
      }

      const { data, error } = await this.client
        .from('userlevelrewards')
        .select('user_id')
        .eq('user_id', userId)
        .eq('level', level)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return false; // Not claimed
        }
        throw new DatabaseError(`Failed to check reward claim status: ${error.message}`);
      }

      return data !== null;
    } catch (error) {
      if (error instanceof DatabaseError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(`Failed to check reward claim: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Claim level reward with atomic operation
   * Creates UserLevelReward entry and returns reward info
   */
  /**
   * Claim a level reward for a user
   * @param {string} userId - The unique identifier of the user
   * @param {number} level - The level at which the reward is being claimed
   * @returns {Promise<{reward: LevelReward, claimRecord: UserLevelReward}>} The claimed reward and claim record
   * @throws {ValidationError} If level is invalid
   * @throws {NotFoundError} If no claimable reward exists
   * @throws {DatabaseError} For database-related errors
   */
  async claimLevelReward(userId: string, level: number): Promise<{
    reward: LevelReward;
    claimRecord: UserLevelReward;
  }> {
    if (level < 1) {
      throw new ValidationError('Level must be at least 1');
    }

    try {
      // Start transaction
      const { data: rewardData, error: rewardError } = await this.client
        .from('levelrewards')
        .select('*')
        .eq('level', level)
        .eq('is_claimable', true)
        .single();

      if (rewardError) {
        if (rewardError.code === 'PGRST116') {
          throw new NotFoundError(`No claimable reward found for level ${level}`);
        }
        throw new DatabaseError(`Failed to fetch reward: ${rewardError.message}`);
      }

      // Check if already claimed
      const alreadyClaimed = await this.isLevelRewardClaimed(userId, level);
      if (alreadyClaimed) {
        throw new ValidationError(`Level ${level} reward has already been claimed`);
      }

      // Create claim record
      const claimData: UserLevelRewardInsert = {
        user_id: userId,
        level: level,
        reward_amount: rewardData.reward_value,
        claimed_at: new Date().toISOString()
      };

      const { data: claimRecord, error: claimError } = await this.client
        .from('userlevelrewards')
        .insert(claimData)
        .select()
        .single();

      if (claimError) {
        throw new DatabaseError(`Failed to claim reward: ${claimError.message}`);
      }

      return {
        reward: rewardData,
        claimRecord: claimRecord
      };

    } catch (error) {
      if (error instanceof DatabaseError || error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to claim level reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's claimed rewards history
   */
  async getUserClaimedRewards(userId: string): Promise<UserLevelReward[]> {
    try {
      const { data, error } = await this.client
        .from('userlevelrewards')
        .select('*')
        .eq('user_id', userId)
        .order('level', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to fetch claimed rewards: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get claimed rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const progressionRepository = new ProgressionRepository();