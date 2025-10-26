import { NextFunction, Request, Response } from 'express';
import { chatterService } from '../services/ChatterService.js';
import type {
  EnemyChatterRequest
} from '../types/schemas.js';
import { logger } from '../utils/logger.js';

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