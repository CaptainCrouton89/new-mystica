import { Request, Response, NextFunction } from 'express';
import { rarityService } from '../services/RarityService.js';
import type { GetRaritiesResponse } from '../types/api.types.js';

/**
 * Rarity Controller
 *
 * Provides read-only access to rarity definitions and their stat multipliers/drop rates
 * for client applications. Supports item display UI with rarity colors and names,
 * and provides multiplier values for client-side stat calculations.
 */
export class RarityController {
  /**
   * GET /rarities
   * Get all rarity definitions with stat multipliers and display metadata
   *
   * @param req - Express request object (no parameters required)
   * @param res - Express response object
   * @param next - Express next function for error handling
   */
  getRarities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rarities = await rarityService.getAllRarities();

      const response: GetRaritiesResponse = {
        success: true,
        rarities
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}

export const rarityController = new RarityController();