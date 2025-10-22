import { Request, Response, NextFunction } from 'express';
import { inventoryService } from '../services/InventoryService';
import { InventoryQuery } from '../types/schemas';

/**
 * Inventory Controller
 * Handles player inventory retrieval (items + material stacks)
 */
export class InventoryController {
  /**
   * GET /inventory
   * Get player's complete inventory (items + material stacks) with filtering and pagination
   */
  getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const queryParams = req.validated?.query as InventoryQuery;

      const result = await inventoryService.getPlayerInventory(userId, {
        slotType: queryParams.slot_type,
        sortBy: queryParams.sort_by,
        page: queryParams.page,
        limit: queryParams.limit
      });

      res.json({
        items: result.items,
        stacks: result.stacks,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  };
}