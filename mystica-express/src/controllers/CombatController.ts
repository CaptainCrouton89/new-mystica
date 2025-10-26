import { NextFunction, Request, Response } from 'express';
import { combatService } from '../services/CombatService.js';
import { enemyChatterService } from '../services/EnemyChatterService.js';
import type { CombatEventDetails } from '../types/api.types.js';
import type { AbandonCombatRequest, AttackRequest, CompleteCombatRequest, DefenseRequest, EnemyChatterRequest, StartCombatRequest } from '../types/schemas.js';
import { ExternalAPIError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Combat Controller
 * Handles combat-related API endpoints including combat mechanics and enemy dialogue generation
 */
export class CombatController {
  /**
   * POST /combat/start
   * Start a new combat session
   */
  startCombat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { location_id, selected_level } = req.body as StartCombatRequest;
      const userId = req.user!.id; // Auth middleware ensures user exists

      // Validate selected_level parameter
      if (selected_level < 1 || selected_level > 20) {
        throw new ValidationError('Selected level must be between 1 and 20');
      }

      const combatSession = await combatService.startCombat(userId, location_id, selected_level);

      res.status(201).json(combatSession);

    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /combat/attack
   * Execute attack action in combat
   */
  attack = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id, tap_position_degrees } = req.body as AttackRequest;

      const attackResult = await combatService.executeAttack(session_id, tap_position_degrees);

      // Event type is always 'player_attacks' - hit/miss is determined by damage value
      const chatterEventType = 'player_attacks';

      logger.info('⚔️  Attack executed', {
        sessionId: session_id,
        chatterEvent: chatterEventType,
        damageDealt: attackResult.player_damage.final_damage,
        isCritical: attackResult.player_damage.crit_occurred,
        playerHPRemaining: attackResult.player_hp_remaining,
        enemyHPRemaining: attackResult.enemy_hp_remaining,
        combatStatus: attackResult.combat_status
      });

      res.json(attackResult);

    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /combat/complete
   * Complete combat session and award loot
   */
  completeCombat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id, result } = req.body as CompleteCombatRequest;

      const combatRewards = await combatService.completeCombat(session_id, result);

      res.json(combatRewards);

    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /combat/abandon
   * Abandon active combat session
   */
  abandonCombat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id } = req.body as AbandonCombatRequest;

      await combatService.abandonCombat(session_id);

      res.json({ message: 'Combat session abandoned' });

    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /combat/active-session
   * Get user's active combat session for auto-resume
   */
  getActiveSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const session = await combatService.getUserActiveSession(userId);

      // If session exists, fetch full recovery data for client
      if (session) {
        try {
          const recoveryData = await combatService.getCombatSessionForRecovery(session.id, userId);
          logger.info('🎯 [getActiveSession] Returning recovery data', {
            sessionId: recoveryData.session_id,
            playerId: recoveryData.player_id,
            enemyId: recoveryData.enemy_id,
            turnNumber: recoveryData.turn_number
          });
          res.json({ session: recoveryData });
        } catch (error) {
          // Handle expired session (missing enemy style in cache)
          if (error instanceof Error && error.message.includes('Enemy style not found in cache')) {
            logger.warn('⚠️  [getActiveSession] Session expired (missing cache), deleting and returning null', {
              sessionId: session.id,
              userId
            });
            // Delete expired session
            await combatService.abandonCombat(session.id);
            // Return null to trigger new session creation on client
            res.json({ session: null });
          } else {
            throw error;
          }
        }
      } else {
        logger.info('ℹ️  [getActiveSession] No active session, returning null');
        res.json({ session: null });
      }

    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /combat/defend
   * Execute defense action in combat
   */
  defend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id, tap_position_degrees } = req.body as DefenseRequest;

      const defenseResult = await combatService.executeDefense(session_id, tap_position_degrees);

      logger.info('🛡️  Defense executed', {
        sessionId: session_id,
        chatterEvent: 'enemy_attacks', // Enemy's automatic attack while player defends
        damageReceived: defenseResult.enemy_damage.final_damage,
        playerHPRemaining: defenseResult.player_hp_remaining,
        enemyHPRemaining: defenseResult.enemy_hp_remaining,
        combatStatus: defenseResult.combat_status
      });

      res.json(defenseResult);

    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /combat/enemy-chatter
   * Generate AI-powered enemy dialogue for combat events
   */
  generateEnemyChatter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        session_id,
        event_type,
        event_details
      } = req.body as EnemyChatterRequest;

      // Validate combat session exists
      let combatSession;
      try {
        combatSession = await combatService.getCombatSession(session_id);
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new NotFoundError('Combat session', session_id);
        }
        throw error;
      }

      // Validate event_details format and convert to CombatEventDetails
      if (!event_details) {
        throw new ValidationError('event_details is required for dialogue generation');
      }

      const {
        damage,
        accuracy,
        is_critical,
        turn_number,
        player_hp_pct,
        enemy_hp_pct,
        player_zone,
        enemy_zone,
        player_action
      } = event_details;

      // Convert to internal format expected by EnemyChatterService
      const combatEventDetails: CombatEventDetails = {
        damage: damage || 0,
        accuracy: accuracy || 0,
        is_critical: is_critical || false,
        turn_number,
        player_hp_pct: player_hp_pct, // 0.0-1.0 range
        enemy_hp_pct: enemy_hp_pct,   // 0.0-1.0 range
        player_zone,
        enemy_zone,
        player_action
      };

      // Generate dialogue using EnemyChatterService
      let dialogueResponse;
      try {
        dialogueResponse = await enemyChatterService.generateDialogue(
          session_id,
          event_type,
          combatEventDetails
        );

        logger.info('💬 [ENEMY_CHATTER] Generated dialogue', {
          sessionId: session_id,
          eventType: event_type,
          dialogue: dialogueResponse.dialogue,
          tone: dialogueResponse.dialogue_tone,
          wasAI: dialogueResponse.was_ai_generated,
          playerZone: combatEventDetails.player_zone,
          enemyZone: combatEventDetails.enemy_zone,
          playerAction: combatEventDetails.player_action,
          generationTimeMs: dialogueResponse.generation_time_ms
        });
      } catch (error) {
        if (error instanceof ExternalAPIError) {
          // Return 503 Service Unavailable for AI service failures
          res.status(503).json({
            error: {
              code: 'AI_SERVICE_UNAVAILABLE',
              message: 'AI dialogue generation service is temporarily unavailable',
              details: error.message
            }
          });
          return;
        }
        throw error;
      }

      // Return structured response
      res.json({
        success: true,
        dialogue_response: dialogueResponse,
        cached: false, // Combat dialogue is always fresh for now
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /combat/session/{session_id}
   * Get active combat session state for recovery
   */
  getCombatSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id } = req.params;
      const userId = req.user!.id; // Auth middleware ensures user exists

      const sessionData = await combatService.getCombatSessionForRecovery(session_id, userId);

      res.json(sessionData);

    } catch (error) {
      next(error);
    }
  };

}

export const combatController = new CombatController();