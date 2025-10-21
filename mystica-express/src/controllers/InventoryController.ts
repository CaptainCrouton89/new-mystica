import { Request, Response, NextFunction } from 'express';
import { inventoryService } from '../services/InventoryService';

/**
 * Inventory Controller
 * Handles player inventory retrieval (items + material stacks)
 */
export class InventoryController {
  /**
   * GET /inventory
   * Get player's complete inventory (items + material stacks)
   */
  getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const inventory = await inventoryService.getPlayerInventory(userId);

      res.json({
        data: {
          items: inventory.items,
          stacks: inventory.stacks
        }
      });
    } catch (error) {
      next(error);
    }
  };
}