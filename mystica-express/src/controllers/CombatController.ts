import { Request, Response, NextFunction } from 'express';
import { combatStubService } from '../services/CombatStubService.js';
import { enemyChatterService } from '../services/EnemyChatterService.js';
import { ValidationError, NotFoundError, ExternalAPIError, NotImplementedError } from '../utils/errors.js';
import type { EnemyChatterRequest, StartCombatRequest, AttackRequest, CompleteCombatRequest } from '../types/schemas.js';
import type { CombatEventDetails } from '../types/combat.types.js';

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
      const { location_id } = req.body as StartCombatRequest;

      // TODO: Implement in CombatService
      throw new NotImplementedError('Combat session creation not yet implemented');

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
      const { session_id, tap_position } = req.body as AttackRequest;

      // TODO: Implement in CombatService
      throw new NotImplementedError('Combat attack mechanics not yet implemented');

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

      // TODO: Implement in CombatService
      throw new NotImplementedError('Combat completion and loot generation not yet implemented');

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
        combatSession = await combatStubService.getCombatSession(session_id);
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
        enemy_hp_pct
      } = event_details;

      // Convert to internal format expected by EnemyChatterService
      const combatEventDetails: CombatEventDetails = {
        damage: damage || 0,
        accuracy: accuracy || 0,
        is_critical: is_critical || false,
        turn_number,
        player_hp_percentage: player_hp_pct * 100, // Convert 0.0-1.0 to 0-100
        enemy_hp_percentage: enemy_hp_pct * 100,   // Convert 0.0-1.0 to 0-100
      };

      // Generate dialogue using EnemyChatterService
      let dialogueResponse;
      try {
        dialogueResponse = await enemyChatterService.generateDialogue(
          session_id,
          event_type,
          combatEventDetails
        );
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

}

export const combatController = new CombatController();