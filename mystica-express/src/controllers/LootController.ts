import { NextFunction, Request, Response } from 'express';
import { lootService } from '../services/LootService.js';
import type { InstantLootRequest } from '../types/schemas.js';
import { logger } from '../utils/logger.js';

/**
 * Loot Controller
 * Handles instant loot collection from locations
 */
export class LootController {
  /**
   * POST /loot/instant
   * Collect instant loot from a location without combat
   */
  instantLoot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { location_id } = req.body as InstantLootRequest;
      const userId = req.user!.id; // Auth middleware ensures user exists

      logger.info('📍 Instant loot request', { userId, location_id });

      const rewards = await lootService.collectInstantLoot(userId, location_id);

      res.status(200).json(rewards);

    } catch (error) {
      next(error);
    }
  };
}

export const lootController = new LootController();

