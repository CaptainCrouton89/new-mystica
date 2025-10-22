import { Request, Response, NextFunction } from 'express';
import { progressionService } from '../services/ProgressionService.js';
import { economyService } from '../services/EconomyService.js';
import { analyticsService } from '../services/AnalyticsService.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError
} from '../utils/errors.js';
import type {
  ClaimLevelRewardRequest,
  AwardExperienceRequest
} from '../types/schemas.js';

// Import Express type extensions for req.user and req.validated
import '../types/express.d.ts';

/**
 * ProgressionController - Player XP and Level Management
 *
 * Handles player experience point (XP) progression, level calculations, and level reward
 * claiming for the account-level progression system.
 */
export class ProgressionController {
  /**
   * GET /progression
   * Get player progression status including XP, level, progress, and available rewards
   */
  getPlayerProgression = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const progression = await progressionService.getPlayerProgression(userId);

      res.json(progression);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          error: {
            code: 'PROGRESSION_NOT_FOUND',
            message: 'Player progression data not found'
          }
        });
        return;
      }
      next(error);
    }
  };

  /**
   * POST /progression/level-up
   * Claim available level milestone rewards (gold, cosmetics, etc.)
   */
  claimLevelReward = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { level } = req.validated?.body as ClaimLevelRewardRequest;

      // Validate player has reached the specified level
      const hasReachedLevel = await progressionService.validateLevelReached(userId, level);
      if (!hasReachedLevel) {
        res.status(403).json({
          error: {
            code: 'LEVEL_NOT_REACHED',
            message: 'Player has not reached the specified level'
          }
        });
        return;
      }

      // Attempt to claim the reward
      const result = await progressionService.claimLevelReward(userId, level);

      // Track analytics event if provided
      if (result.analytics_event) {
        await analyticsService.trackEvent(userId, result.analytics_event.event_type, result.analytics_event.metadata);
      }

      res.json({
        success: true,
        level: result.level,
        reward_gold: result.reward_amount,
        new_gold_balance: result.new_gold_balance
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: 'INVALID_LEVEL',
            message: error.message
          }
        });
        return;
      }
      if (error instanceof ConflictError) {
        res.status(409).json({
          error: {
            code: 'REWARD_ALREADY_CLAIMED',
            message: 'Level reward has already been claimed'
          }
        });
        return;
      }
      if (error instanceof BusinessLogicError) {
        if (error.message.includes('not yet implemented')) {
          res.status(422).json({
            error: {
              code: 'REWARD_NOT_CLAIMABLE',
              message: 'Level rewards system is not yet implemented'
            }
          });
          return;
        }
        res.status(422).json({
          error: {
            code: 'REWARD_NOT_CLAIMABLE',
            message: error.message
          }
        });
        return;
      }
      next(error);
    }
  };

  /**
   * POST /progression/award-xp (Internal)
   * Award experience points from game activities (combat, quests, etc.)
   */
  awardExperience = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id, xp_amount, source, source_id, metadata } = req.validated?.body as AwardExperienceRequest;

      const result = await progressionService.awardExperience(
        user_id,
        xp_amount,
        source,
        source_id,
        metadata
      );

      // Track analytics events
      for (const event of result.analytics_events) {
        await analyticsService.trackEvent(user_id, event.event_type, event.metadata);
      }

      res.json({
        success: true,
        result: {
          user_id,
          old_level: result.old_level,
          new_level: result.new_level,
          leveled_up: result.leveled_up,
          total_xp: result.progression.xp,
          xp_awarded: result.xp_awarded
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
        return;
      }
      next(error);
    }
  };
}

export const progressionController = new ProgressionController();