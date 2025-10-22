import { Request, Response, NextFunction } from 'express';
import { combatService } from '../services/CombatService.js';
import { enemyChatterService } from '../services/EnemyChatterService.js';
import { chatterService } from '../services/ChatterService.js';
import { ValidationError, NotFoundError, ExternalAPIError, NotImplementedError } from '../utils/errors.js';
import type { EnemyChatterRequest, StartCombatRequest, AttackRequest, CompleteCombatRequest, DefenseRequest, PetChatterRequest } from '../types/schemas.js';
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
      const { session_id, attack_accuracy } = req.body as AttackRequest;

      const attackResult = await combatService.executeAttack(session_id, attack_accuracy);

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
   * POST /combat/defend
   * Execute defense action in combat
   */
  defend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id, defense_accuracy } = req.body as DefenseRequest;

      const defenseResult = await combatService.executeDefense(session_id, defense_accuracy);

      res.json(defenseResult);

    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /combat/pet-chatter
   * Generate AI-powered pet dialogue for combat events
   */
  generatePetChatter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id, event_type, event_details } = req.body as PetChatterRequest;

      // Convert request format to internal CombatEventDetails format
      const combatEventDetails = {
        turn_number: event_details?.turn_number ?? 1,
        player_hp_pct: 1.0, // Default values since pet chatter schema doesn't require these
        enemy_hp_pct: 1.0,
        damage: event_details?.damage,
        accuracy: event_details?.accuracy,
        is_critical: event_details?.is_critical
      };

      const dialogueResponse = await chatterService.generatePetChatter(
        session_id,
        event_type,
        combatEventDetails
      );

      res.json({
        success: true,
        dialogue_response: dialogueResponse,
        cached: false // Always false for real-time generation per spec
      });

    } catch (error) {
      if (error instanceof ExternalAPIError) {
        // Return 503 Service Unavailable for AI service failures
        res.status(503).json({
          error: {
            code: 'AI_SERVICE_UNAVAILABLE',
            message: 'AI service temporarily unavailable (fallback to canned phrases)',
            details: error.message
          }
        });
        return;
      }
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