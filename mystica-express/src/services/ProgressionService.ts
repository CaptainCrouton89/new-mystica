/**
 * ProgressionService - Player XP and Level Management
 *
 * Handles player experience point (XP) progression, level calculations, and level reward
 * claiming for the account-level progression system. Integrates with the economy system
 * for reward distribution and provides analytics tracking.
 */

import { progressionRepository, ProgressionRepository } from '../repositories/ProgressionRepository.js';
import { economyService, EconomyService } from './EconomyService.js';
import {
  ValidationError,
  DatabaseError,
  NotFoundError,
  ConflictError,
  BusinessLogicError
} from '../utils/errors.js';
import {
  ProgressionStatus,
  ExperienceAwardResult,
  LevelReward,
  RewardClaimResult,
  XPSourceType,
  AnalyticsEvent
} from '../types/api.types.js';

/**
 * Progression service for XP awards and level management
 */
export class ProgressionService {
  private progressionRepository: ProgressionRepository;
  private economyService: EconomyService;

  // Valid XP source types
  private readonly validXPSources: XPSourceType[] = [
    'combat',
    'quest',
    'achievement',
    'daily_bonus',
    'admin'
  ];

  constructor() {
    this.progressionRepository = progressionRepository;
    this.economyService = economyService;
  }

  // ============================================================================
  // Core XP and Level Operations
  // ============================================================================

  /**
   * Award experience points to player with level-up detection and analytics
   *
   * @param userId Player UUID
   * @param xpAmount Positive integer XP to award
   * @param source XP source type for tracking
   * @param sourceId Optional reference ID
   * @param metadata Optional context data
   * @returns Experience award result with level change information
   */
  async awardExperience(
    userId: string,
    xpAmount: number,
    source: XPSourceType,
    sourceId?: string,
    metadata?: Record<string, any>
  ): Promise<ExperienceAwardResult> {
    // Validate parameters
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (!Number.isInteger(xpAmount) || xpAmount <= 0) {
      throw new ValidationError('XP amount must be a positive integer');
    }

    if (!this.validXPSources.includes(source)) {
      throw new ValidationError(`Invalid XP source: ${source}. Valid sources: ${this.validXPSources.join(', ')}`);
    }

    try {
      // Award XP with atomic operation
      const result = await this.progressionRepository.awardExperience(
        userId,
        xpAmount,
        source,
        sourceId,
        metadata
      );

      // Get updated progression status
      const progression = await this.getPlayerProgression(userId);

      // Generate analytics events
      const analyticsEvents: AnalyticsEvent[] = [];

      // XP award event
      analyticsEvents.push({
        event_type: 'xp_awarded',
        user_id: userId,
        metadata: {
          xp_amount: xpAmount,
          source,
          source_id: sourceId,
          total_xp: result.progression.xp,
          current_level: result.newLevel,
          ...metadata
        },
        timestamp: new Date().toISOString()
      });

      // Level up event (if applicable)
      if (result.leveledUp) {
        analyticsEvents.push({
          event_type: 'level_up',
          user_id: userId,
          metadata: {
            old_level: result.oldLevel,
            new_level: result.newLevel,
            total_xp: result.progression.xp,
            source_trigger: source
          },
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        xp_awarded: result.xpAwarded,
        old_level: result.oldLevel,
        new_level: result.newLevel,
        leveled_up: result.leveledUp,
        progression,
        analytics_events: analyticsEvents
      };

    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to award XP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get complete progression status including calculated values
   *
   * @param userId Player UUID
   * @returns Progression status with XP, level, progress, and available rewards
   */
  async getPlayerProgression(userId: string): Promise<ProgressionStatus> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      const progression = await this.progressionRepository.getPlayerProgression(userId);

      // Calculate progress values
      const currentLevel = progression.level;
      const totalXP = progression.xp;
      const xpToNext = this.calculateXPToNextLevel(currentLevel);
      const currentLevelXP = this.calculateTotalXPForLevel(currentLevel);
      const xpInCurrentLevel = totalXP - currentLevelXP;
      const progressPercentage = xpInCurrentLevel > 0 ? (xpInCurrentLevel / xpToNext) * 100 : 0;

      // Get available level rewards (placeholder - returns empty array)
      const levelRewards = await this.getAvailableLevelRewards(userId, currentLevel);

      return {
        user_id: userId,
        level: currentLevel,
        xp: totalXP,
        xp_to_next_level: Math.max(0, xpToNext - xpInCurrentLevel),
        xp_progress_percentage: Math.min(100, Math.max(0, progressPercentage)),
        level_rewards_available: levelRewards
      };

    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get progression: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Level Calculation Utilities
  // ============================================================================

  /**
   * Calculate XP required for next level: 100 * current_level
   */
  calculateXPToNextLevel(currentLevel: number): number {
    if (currentLevel < 1) {
      throw new ValidationError('Level must be at least 1');
    }
    return 100 * currentLevel;
  }

  /**
   * Calculate total XP required to reach a specific level
   */
  calculateTotalXPForLevel(targetLevel: number): number {
    if (targetLevel < 1) {
      throw new ValidationError('Level must be at least 1');
    }

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
    if (totalXP < 0) {
      throw new ValidationError('XP cannot be negative');
    }

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

  /**
   * Validate if player has reached specific level
   */
  async validateLevelReached(userId: string, targetLevel: number): Promise<boolean> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (targetLevel < 1) {
      throw new ValidationError('Target level must be at least 1');
    }

    return this.progressionRepository.validateLevelReached(userId, targetLevel);
  }

  // ============================================================================
  // Level Reward System
  // ============================================================================

  /**
   * Get unclaimed level rewards available to player
   *
   * @param userId Player UUID
   * @param currentLevel Player's current level
   * @returns Array of claimable LevelReward objects formatted for API response
   */
  async getAvailableLevelRewards(userId: string, currentLevel: number): Promise<LevelReward[]> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (currentLevel < 1) {
      throw new ValidationError('Current level must be at least 1');
    }

    try {
      const rewards = await this.progressionRepository.getAvailableLevelRewards(userId, currentLevel);

      // Transform database rewards to API format
      return rewards.map(reward => ({
        level: reward.level,
        reward_type: reward.reward_type,
        reward_description: reward.reward_description,
        reward_value: reward.reward_value,
        is_claimable: reward.is_claimable
      }));
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get available rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Claim level reward with validation and economy integration
   *
   * @param userId Player UUID
   * @param level Level reward to claim
   * @returns Reward claim result with reward details and new balances
   */
  async claimLevelReward(userId: string, level: number): Promise<RewardClaimResult> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (level < 1) {
      throw new ValidationError('Level must be at least 1');
    }

    // Check if player has reached the specified level
    const hasReachedLevel = await this.validateLevelReached(userId, level);
    if (!hasReachedLevel) {
      throw new ConflictError(`Player has not reached level ${level}`);
    }

    try {
      // Check if reward exists and is claimable
      const rewardDefinition = await this.progressionRepository.getLevelReward(level);
      if (!rewardDefinition) {
        throw new NotFoundError(`No reward found for level ${level}`);
      }

      if (!rewardDefinition.is_claimable) {
        throw new BusinessLogicError('This level reward is automatically granted and cannot be manually claimed');
      }

      // Check if already claimed
      const alreadyClaimed = await this.progressionRepository.isLevelRewardClaimed(userId, level);
      if (alreadyClaimed) {
        throw new ConflictError('Level reward has already been claimed');
      }

      // Claim the reward
      const claimResult = await this.progressionRepository.claimLevelReward(userId, level);

      let newGoldBalance: number | undefined;

      // Process reward based on type
      if (rewardDefinition.reward_type === 'gold') {
        // Award gold via economy service
        const economyResult = await this.economyService.addCurrency(
          userId,
          'GOLD',
          rewardDefinition.reward_value,
          'level_reward',
          level.toString(),
          {
            level: level,
            reward_type: 'gold',
            description: rewardDefinition.reward_description
          }
        );
        newGoldBalance = economyResult.newBalance;
      }

      // Generate analytics event
      const analyticsEvent = this.createAnalyticsEvent('level_reward_claimed', userId, {
        level: level,
        reward_type: rewardDefinition.reward_type,
        reward_amount: rewardDefinition.reward_value,
        new_gold_balance: newGoldBalance,
        description: rewardDefinition.reward_description
      });

      return {
        level: level,
        reward_type: rewardDefinition.reward_type,
        reward_amount: rewardDefinition.reward_value,
        reward_description: rewardDefinition.reward_description,
        new_gold_balance: newGoldBalance,
        claimed_at: claimResult.claimRecord.claimed_at,
        analytics_event: analyticsEvent
      };

    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError ||
          error instanceof ConflictError || error instanceof BusinessLogicError ||
          error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to claim level reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Analytics and Logging
  // ============================================================================

  /**
   * Generate analytics event for progression tracking
   */
  private createAnalyticsEvent(
    eventType: string,
    userId: string,
    metadata: Record<string, any>
  ): AnalyticsEvent {
    return {
      event_type: eventType,
      user_id: userId,
      metadata,
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================================
  // Utility Methods for Testing and Debugging
  // ============================================================================

  /**
   * Get progression statistics for analytics
   */
  async getProgressionStatistics(): Promise<{
    total_players: number;
    average_level: number;
    max_level: number;
    total_xp_awarded: number;
  }> {
    // TODO: Implement analytics queries when needed
    throw new BusinessLogicError('Progression statistics not yet implemented');
  }

  /**
   * Bulk XP award for administrative purposes
   */
  async bulkAwardExperience(
    awards: Array<{
      userId: string;
      xpAmount: number;
      source: XPSourceType;
      sourceId?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<ExperienceAwardResult[]> {
    const results: ExperienceAwardResult[] = [];

    for (const award of awards) {
      try {
        const result = await this.awardExperience(
          award.userId,
          award.xpAmount,
          award.source,
          award.sourceId,
          award.metadata
        );
        results.push(result);
      } catch (error) {
        // Log error and continue with next award
        console.error(`Failed to award XP to user ${award.userId}:`, error);
        results.push({
          success: false,
          xp_awarded: 0,
          old_level: 0,
          new_level: 0,
          leveled_up: false,
          progression: {} as ProgressionStatus,
          analytics_events: []
        });
      }
    }

    return results;
  }
}

export const progressionService = new ProgressionService();