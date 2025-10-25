import { progressionRepository, ProgressionRepository } from '../repositories/ProgressionRepository.js';
import {
  AnalyticsEvent,
  ExperienceAwardResult,
  LevelReward,
  ProgressionStatus,
  RewardClaimResult,
  XPSourceType
} from '../types/api.types.js';
import {
  BusinessLogicError,
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError
} from '../utils/errors.js';
import { economyService, EconomyService } from './EconomyService.js';

export class ProgressionService {
  private progressionRepository: ProgressionRepository;
  private economyService: EconomyService;

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

  async awardExperience(
    userId: string,
    xpAmount: number,
    source: XPSourceType,
    sourceId?: string,
    metadata?: { [key: string]: string | number | boolean | null }
  ): Promise<ExperienceAwardResult> {
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
      const result = await this.progressionRepository.awardExperience(
        userId,
        xpAmount,
        source,
        sourceId,
        metadata
      );

      const progression = await this.getPlayerProgression(userId);

      const analyticsEvents: AnalyticsEvent[] = [];

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

  async getPlayerProgression(userId: string): Promise<ProgressionStatus> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    try {
      const progression = await this.progressionRepository.getPlayerProgression(userId);

      const currentLevel = progression.level;
      const totalXP = progression.xp;
      const xpToNext = this.calculateXPToNextLevel(currentLevel);
      const currentLevelXP = this.calculateTotalXPForLevel(currentLevel);
      const xpInCurrentLevel = totalXP - currentLevelXP;
      const progressPercentage = xpInCurrentLevel > 0 ? (xpInCurrentLevel / xpToNext) * 100 : 0;

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

  calculateXPToNextLevel(currentLevel: number): number {
    if (currentLevel < 1) {
      throw new ValidationError('Level must be at least 1');
    }
    return 100 * currentLevel;
  }

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

  async validateLevelReached(userId: string, targetLevel: number): Promise<boolean> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (targetLevel < 1) {
      throw new ValidationError('Target level must be at least 1');
    }

    return this.progressionRepository.validateLevelReached(userId, targetLevel);
  }

  async getAvailableLevelRewards(userId: string, currentLevel: number): Promise<LevelReward[]> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (currentLevel < 1) {
      throw new ValidationError('Current level must be at least 1');
    }

    try {
      const rewards = await this.progressionRepository.getAvailableLevelRewards(userId, currentLevel);

      return rewards.map(reward => ({
        level: reward.level,
        reward_type: reward.reward_type,
        reward_description: reward.reward_description,
        reward_value: reward.reward_value,
        is_claimable: reward.is_claimable
      }));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error during level rewards retrieval';

      console.error(`Error retrieving level rewards: ${errorMessage}`);

      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get available rewards: ${errorMessage}`);
    }
  }

  async claimLevelReward(userId: string, level: number): Promise<RewardClaimResult> {
    if (!userId || userId.trim().length === 0) {
      throw new ValidationError('User ID is required');
    }

    if (level < 1) {
      throw new ValidationError('Level must be at least 1');
    }

    const hasReachedLevel = await this.validateLevelReached(userId, level);
    if (!hasReachedLevel) {
      throw new ConflictError(`Player has not reached level ${level}`);
    }

    try {
      const rewardDefinition = await this.progressionRepository.getLevelReward(level);
      if (!rewardDefinition) {
        throw new NotFoundError(`No reward found for level ${level}`);
      }

      if (!rewardDefinition.is_claimable) {
        throw new BusinessLogicError('This level reward is automatically granted and cannot be manually claimed');
      }

      const alreadyClaimed = await this.progressionRepository.isLevelRewardClaimed(userId, level);
      if (alreadyClaimed) {
        throw new ConflictError('Level reward has already been claimed');
      }

      const claimResult = await this.progressionRepository.claimLevelReward(userId, level);

      let newGoldBalance: number | undefined;

      if (rewardDefinition.reward_type === 'gold') {
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

      const analyticsEvent = this.createAnalyticsEvent('level_reward_claimed', userId, {
        level: level,
        reward_type: rewardDefinition.reward_type,
        reward_amount: rewardDefinition.reward_value,
        new_gold_balance: newGoldBalance!,
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

  private createAnalyticsEvent(
    eventType: string,
    userId: string,
    metadata: { [key: string]: string | number | boolean | null }
  ): AnalyticsEvent {
    return {
      event_type: eventType,
      user_id: userId,
      metadata,
      timestamp: new Date().toISOString()
    };
  }

  async getProgressionStatistics(): Promise<{
    total_players: number;
    average_level: number;
    max_level: number;
    total_xp_awarded: number;
  }> {
    throw new BusinessLogicError('Progression statistics not yet implemented');
  }

  async getCombatAnalytics(userId?: string): Promise<{
    global_stats: {
      total_combat_sessions: number;
      total_victories: number;
      total_defeats: number;
      average_win_rate: number;
      average_combat_rating: number;
    };
    user_stats?: {
      total_attempts: number;
      victories: number;
      defeats: number;
      win_rate: number;
      current_streak: number;
      longest_streak: number;
      favorite_locations: Array<{location_id: string, attempts: number}>;
      rating_progression: Array<{date: string, rating: number}>;
    };
  }> {
    try {
      const { data: globalData, error: globalError } = await this.progressionRepository['client']
        .from('combatsessions')
        .select('outcome, player_rating')
        .not('outcome', 'is', null);

      if (globalError) {
        const errorMessage = `Failed to get global combat stats: ${globalError.message}`;
        console.error(errorMessage);
        throw new DatabaseError(errorMessage);
      }

      const totalSessions = globalData?.length || 0;
      const victories = globalData?.filter(s => s.outcome === 'victory').length || 0;
      const defeats = globalData?.filter(s => s.outcome === 'defeat').length || 0;
      const averageWinRate = totalSessions > 0 ? victories / totalSessions : 0;

      const ratingsData = globalData?.filter(s => s.player_rating !== null) || [];
      const averageRating = ratingsData.length > 0
        ? ratingsData.reduce((sum, s) => sum + (s.player_rating || 0), 0) / ratingsData.length
        : 0;

      const globalStats = {
        total_combat_sessions: totalSessions,
        total_victories: victories,
        total_defeats: defeats,
        average_win_rate: averageWinRate,
        average_combat_rating: averageRating,
      };

      let userStats = undefined;

      if (userId) {
        const { data: historyData, error: historyError } = await this.progressionRepository['client']
          .from('playercombathistory')
          .select('*')
          .eq('user_id', userId);

        if (historyError) {
          const errorMessage = `Failed to get user combat history: ${historyError.message}`;
          console.error(errorMessage);
          throw new DatabaseError(errorMessage);
        }

        const totalAttempts = historyData?.reduce((sum, h) => sum + (h.total_attempts || 0), 0) || 0;
        const userVictories = historyData?.reduce((sum, h) => sum + (h.victories || 0), 0) || 0;
        const userDefeats = historyData?.reduce((sum, h) => sum + (h.defeats || 0), 0) || 0;
        const userWinRate = totalAttempts > 0 ? userVictories / totalAttempts : 0;
        const currentStreak = Math.max(...(historyData?.map(h => h.current_streak || 0) || [0]));
        const longestStreak = Math.max(...(historyData?.map(h => h.longest_streak || 0) || [0]));

        const favoriteLocations = historyData
          ?.sort((a, b) => (b.total_attempts || 0) - (a.total_attempts || 0))
          .slice(0, 5)
          .map(h => ({
            location_id: h.location_id,
            attempts: h.total_attempts || 0,
          })) || [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: ratingData, error: ratingError } = await this.progressionRepository['client']
          .from('combatsessions')
          .select('created_at, player_rating')
          .eq('user_id', userId)
          .not('player_rating', 'is', null)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        if (ratingError) {
          console.error(`Failed to get rating progression: ${ratingError.message}`);
        }

        const ratingByDate = new Map<string, number[]>();
        ratingData?.forEach(session => {
          const date = new Date(session.created_at).toISOString().split('T')[0];
          if (!ratingByDate.has(date)) {
            ratingByDate.set(date, []);
          }
          ratingByDate.get(date)!.push(session.player_rating || 0);
        });

        const ratingProgression = Array.from(ratingByDate.entries())
          .map(([date, ratings]) => ({
            date,
            rating: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
          }))
          .slice(-30);

        userStats = {
          total_attempts: totalAttempts,
          victories: userVictories,
          defeats: userDefeats,
          win_rate: userWinRate,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          favorite_locations: favoriteLocations,
          rating_progression: ratingProgression,
        };
      }

      return {
        global_stats: globalStats,
        user_stats: userStats,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error during combat analytics retrieval';

      console.error(`Error retrieving combat analytics: ${errorMessage}`);

      if (error instanceof DatabaseError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get combat analytics: ${errorMessage}`);
    }
  }

  async bulkAwardExperience(
    awards: Array<{
      userId: string;
      xpAmount: number;
      source: XPSourceType;
      sourceId?: string;
      metadata?: { [key: string]: string | number | boolean | null };
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
          award.metadata ? {
            ...award.metadata
          } : undefined
        );
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error during XP award';

        console.error(`Failed to award XP to user ${award.userId}: ${errorMessage}`);

        results.push({
          success: false,
          xp_awarded: 0,
          old_level: 0,
          new_level: 0,
          leveled_up: false,
          progression: {
            user_id: award.userId,
            level: 0,
            xp: 0,
            xp_to_next_level: 0,
            xp_progress_percentage: 0,
            level_rewards_available: []
          },
          analytics_events: []
        });
      }
    }

    return results;
  }
}

export const progressionService = new ProgressionService();