import { Request, Response, NextFunction } from 'express';
import { materialService } from '../services/MaterialService';

/**
 * Material Controller
 * Handles material library access and player-specific material inventory operations.
 * Material application operations are owned by ItemController.
 */
export class MaterialController {
  /**
   * GET /materials
   * Get all material templates (no auth required)
   */
  getMaterials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const materials = await materialService.getAllMaterials();

      res.json({
        materials
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /materials/inventory
   * Get player's material stacks with quantities
   */
  getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const materials = await materialService.getMaterialInventory(userId);

      res.json({
        materials
      });
    } catch (error) {
      next(error);
    }
  };
}

export const materialController = new MaterialController();