import { Request, Response, NextFunction } from 'express';
import { itemService } from '../services/ItemService';
import { materialService } from '../services/MaterialService';
import type {
  AssignPetPersonalityBody,
  AddPetChatterRequest,
  ApplyMaterialRequest,
  ReplaceMaterialRequest
} from '../types/schemas.js';

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

  /**
   * GET /items/:item_id/history
   * Get item history events for audit trail
   */
  getItemHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;

      const history = await itemService.getItemHistory(item_id, userId);

      res.json({
        success: true,
        history
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /items/:item_id/weapon-stats
   * Get weapon combat statistics (only for weapons)
   */
  getWeaponStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const { player_accuracy = 50 } = req.query; // Default accuracy

      const weaponStats = await itemService.getWeaponCombatStats(
        item_id,
        Number(player_accuracy)
      );

      res.json({
        success: true,
        ...weaponStats
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/pet/personality
   * Assign personality to pet item
   */
  assignPetPersonality = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const { personality_id, custom_name } = req.validated?.body as AssignPetPersonalityBody;

      await itemService.assignPetPersonality(item_id, userId, personality_id, custom_name);

      res.json({
        success: true,
        message: 'Pet personality assigned successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/pet/chatter
   * Add chatter message to pet
   */
  addPetChatter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const { text, type } = req.validated?.body as AddPetChatterRequest;

      const message = {
        text,
        timestamp: new Date().toISOString(),
        type: type || 'user'
      };

      await itemService.updatePetChatter(item_id, userId, message);

      res.json({
        success: true,
        message: 'Chatter message added successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /player/stats
   * Get aggregated player stats from all equipped items
   */
  getPlayerStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const playerStats = await itemService.getPlayerTotalStats(userId);

      res.json({
        success: true,
        ...playerStats
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/materials/apply
   * Apply material to item
   */
  applyMaterial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const { material_id, style_id, slot_index } = req.validated?.body as ApplyMaterialRequest;

      const result = await materialService.applyMaterial({
        userId,
        itemId: item_id,
        materialId: material_id,
        styleId: style_id,
        slotIndex: slot_index
      });

      res.json({
        success: result.success,
        item: result.updated_item,
        stats: result.updated_item.current_stats,
        image_url: result.image_url,
        is_first_craft: result.is_first_craft,
        total_crafts: result.craft_count
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/materials/replace
   * Replace material in slot
   */
  replaceMaterial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;
      const { slot_index, new_material_id, new_style_id, gold_cost } = req.validated?.body as ReplaceMaterialRequest;

      const result = await materialService.replaceMaterial({
        userId,
        itemId: item_id,
        slotIndex: slot_index,
        newMaterialId: new_material_id,
        newStyleId: new_style_id,
        goldCost: gold_cost
      });

      res.json({
        success: result.success,
        item: result.updated_item,
        stats: result.updated_item.current_stats,
        image_url: result.updated_item.image_url,
        gold_spent: result.gold_spent,
        returned_material: result.refunded_material ? {
          material_id: result.refunded_material.material_id,
          style_id: result.refunded_material.style_id
        } : undefined
      });
    } catch (error) {
      next(error);
    }
  };
}