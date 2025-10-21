import { Request, Response, NextFunction } from 'express';
import { itemService } from '../services/ItemService';

/**
 * Item Controller
 * Handles individual item operations (get details, upgrade)
 */
export class ItemController {
  /**
   * GET /items/:item_id
   * Get specific item with full details and computed stats
   */
  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;

      const item = await itemService.getItemDetails(userId, item_id);

      res.json(item);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /items/:item_id/upgrade-cost
   * Get cost to upgrade item to next level
   */
  getUpgradeCost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;

      const costInfo = await itemService.getUpgradeCost(userId, item_id);

      res.json(costInfo);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/upgrade
   * Upgrade item to next level (spend gold)
   */
  upgradeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;

      const result = await itemService.upgradeItem(userId, item_id);

      res.json({
        success: result.success,
        item: result.updated_item,
        gold_spent: result.gold_spent,
        new_level: result.new_level,
        stat_increase: result.stat_increase,
        message: `Item upgraded to level ${result.new_level}!`
      });
    } catch (error) {
      next(error);
    }
  };
}