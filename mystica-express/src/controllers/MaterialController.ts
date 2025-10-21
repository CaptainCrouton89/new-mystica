import { Request, Response, NextFunction } from 'express';
import { materialService } from '../services/MaterialService';
import type { ApplyMaterialRequest, ReplaceMaterialRequest } from '../types/schemas';

/**
 * Material Controller
 * Handles material inventory and application to items
 */
export class MaterialController {
  /**
   * GET /materials/inventory
   * Get player's material stacks with quantities
   */
  getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const materials = await materialService.getMaterialInventory(userId);

      res.json({
        materials,
        total_stacks: materials.length,
        total_quantity: materials.reduce((sum, stack) => sum + stack.quantity, 0)
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/materials/apply
   * Apply material to item (triggers 20s image generation if needed)
   */
  applyMaterial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const { material_id, is_shiny, slot_index } = req.body as ApplyMaterialRequest;

      const result = await materialService.applyMaterial(
        userId,
        item_id,
        material_id,
        is_shiny,
        slot_index
      );

      res.json({
        success: result.success,
        item: result.updated_item,
        image_url: result.image_url,
        is_first_craft: result.is_first_craft,
        craft_count: result.craft_count,
        message: result.is_first_craft
          ? 'Material applied successfully - generating unique image!'
          : 'Material applied successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/materials/replace
   * Replace existing material in slot (costs gold)
   */
  replaceMaterial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const {
        slot_index,
        new_material_id,
        new_is_shiny,
        gold_cost
      } = req.body as ReplaceMaterialRequest;

      const result = await materialService.replaceMaterial(
        userId,
        item_id,
        slot_index,
        new_material_id,
        new_is_shiny,
        gold_cost
      );

      res.json({
        success: result.success,
        item: result.updated_item,
        gold_spent: result.gold_spent,
        replaced_material: result.replaced_material,
        message: 'Material replaced successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}