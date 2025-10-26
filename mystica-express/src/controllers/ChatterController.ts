import { Request, Response, NextFunction } from 'express';
import { chatterService } from '../services/ChatterService.js';
import { logger } from '../utils/logger.js';
import type {
  PetChatterRequest,
  EnemyChatterRequest,
  AssignPetPersonalityRequest
} from '../types/schemas.js';

/**
 * ChatterController - AI-powered dialogue generation endpoints
 *
 * Handles F-11 (Pet Personality & Chatter) and F-12 (Enemy Trash Talk) endpoints:
 * - Pet chatter generation during combat events
 * - Enemy trash-talk generation with player context
 * - Pet personality management
 * - Enemy type information
 */
export class ChatterController {
  /**
   * POST /api/v1/combat/pet-chatter
   * Generate AI-powered pet dialogue for combat events (F-11)
   */
  generatePetChatter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id, event_type, event_details } = req.body as PetChatterRequest;

      const result = await chatterService.generatePetChatter(
        session_id,
        event_type,
        {
          turn_number: event_details?.turn_number ?? 1,
          player_hp_pct: 1.0,
          enemy_hp_pct: 1.0,
          damage: event_details?.damage,
          accuracy: event_details?.accuracy,
          is_critical: event_details?.is_critical
        }
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/combat/enemy-chatter
   * Generate AI-powered enemy trash-talk for combat events (F-12)
   */
  generateEnemyChatter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { session_id, event_type, event_details } = req.body as EnemyChatterRequest;

      logger.info('🗣️  [ENEMY_CHATTER] Generating dialogue', {
        sessionId: session_id,
        eventType: event_type,
        playerHpPct: event_details.player_hp_pct,
        enemyHpPct: event_details.enemy_hp_pct,
        damage: event_details.damage,
        isCritical: event_details.is_critical
      });

      const result = await chatterService.generateEnemyChatter(
        session_id,
        event_type,
        {
          turn_number: event_details.turn_number,
          player_hp_pct: event_details.player_hp_pct,
          enemy_hp_pct: event_details.enemy_hp_pct,
          damage: event_details.damage,
          accuracy: event_details.accuracy,
          is_critical: event_details.is_critical
        }
      );

      logger.info('💬 [ENEMY_CHATTER] Response generated', {
        sessionId: session_id,
        dialogue: result.dialogue,
        enemyType: result.enemy_type,
        tone: result.dialogue_tone,
        generationTimeMs: result.generation_time_ms,
        wasAIGenerated: result.was_ai_generated
      });

      res.json(result);
    } catch (error) {
      logger.error('❌ [ENEMY_CHATTER] Error generating dialogue', {
        sessionId: req.body?.session_id,
        eventType: req.body?.event_type,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  };

  /**
   * GET /api/v1/pets/personalities
   * Get available pet personality types (F-11)
   */
  getPetPersonalities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const personalities = await chatterService.getPetPersonalities();

      res.json({
        personalities
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/pets/:pet_id/personality
   * Assign personality to player's pet (F-11)
   */
  assignPetPersonality = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { pet_id } = req.params;
      const { personality_type, custom_name } = req.body as AssignPetPersonalityRequest;

      const result = await chatterService.assignPetPersonality(
        pet_id,
        personality_type,
        custom_name
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/enemies/types
   * Get available enemy types with personality traits (F-12)
   */
  getEnemyTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enemyTypes = await chatterService.getEnemyTypes();

      res.json({
        enemy_types: enemyTypes
      });
    } catch (error) {
      next(error);
    }
  };
}

export const chatterController = new ChatterController();