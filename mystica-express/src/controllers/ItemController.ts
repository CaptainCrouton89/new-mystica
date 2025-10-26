import { NextFunction, Request, Response } from 'express';
import { itemService } from '../services/ItemService';
import { materialService } from '../services/MaterialService';
import { StatsService } from '../services/StatsService.js';
import type { ItemWithMaterials, MaterialInstanceWithTemplate } from '../types/repository.types.js';
import type { Stats } from '../types/api.types.js';
import type {
  AddPetChatterRequest,
  ApplyMaterialRequest,
  AssignPetPersonalityBody
} from '../types/schemas.js';

const statsService = new StatsService();

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

      // Transform Item to PlayerItem format for frontend compatibility
      const playerItem = {
        id: result.updated_item.id,
        base_type: result.updated_item.item_type?.name || 'Unknown',
        description: result.updated_item.item_type?.description || null,
        name: result.updated_item.item_type?.name || null,
        item_type_id: result.updated_item.item_type_id,
        category: result.updated_item.item_type?.category || 'misc',
        level: result.updated_item.level,
        rarity: result.updated_item.item_type?.rarity || 'common',
        applied_materials: result.updated_item.materials || [],
        materials: result.updated_item.materials || [],
        computed_stats: result.computed_stats,
        material_combo_hash: result.updated_item.material_combo_hash || null,
        generated_image_url: result.updated_item.image_url || null,
        image_generation_status: null,
        craft_count: 0,
        is_styled: (result.updated_item.materials || []).some((m: any) => m.style_id !== 'normal'),
        is_equipped: false, // Equipment status not tracked in upgrade result
        equipped_slot: null
      };

      res.json({
        success: result.success,
        item: playerItem,
        gold_spent: result.gold_spent,
        new_gold_balance: result.new_gold_balance,
        new_vanity_level: result.new_vanity_level
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
      const { material_id, slot_index } = (req.validated?.body || req.body) as ApplyMaterialRequest;

      const result = await materialService.applyMaterial({
        userId,
        itemId: item_id,
        materialId: material_id,
        slotIndex: slot_index
      });

      // Type assertion: result.updated_item is ItemWithMaterials from repository
      const itemWithMaterials = result.updated_item as ItemWithMaterials;

      // Transform materials to include style_id and name at top level for Swift compatibility
      const appliedMaterials = (itemWithMaterials.materials || []).map(m => {
        if (!m.materials?.name) {
          throw new Error(`Material missing name field for material_id: ${m.material_id}`);
        }
        if (!m.materials?.style_id) {
          throw new Error(`Material missing style_id field for material_id: ${m.material_id}`);
        }
        return {
          ...m,
          name: m.materials.name,
          style_id: m.materials.style_id
        };
      });

      // Compute stats
      const baseStats = itemWithMaterials.item_type.base_stats_normalized as Stats;
      const materialsForStats: MaterialInstanceWithTemplate[] = itemWithMaterials.materials.map(m => ({
        ...m,
        material: {
          ...m.materials,
          stat_modifiers: m.materials.stat_modifiers as Stats
        }
      }));
      const computedStats = statsService.computeItemStats(
        baseStats,
        itemWithMaterials.level,
        materialsForStats
      );

      // Add base_type, category, applied_materials, materials, computed_stats, craft_count, and is_styled fields for Swift compatibility
      // These fields are nested in item_type but Swift expects them at the top level
      const updatedItemWithBaseType = {
        ...result.updated_item,
        base_type: itemWithMaterials.item_type.name,
        category: itemWithMaterials.item_type.category,
        applied_materials: appliedMaterials,
        materials: appliedMaterials,
        computed_stats: computedStats,
        craft_count: result.craft_count,
        is_styled: appliedMaterials.some(m => m.style_id !== 'normal')
      };

      res.json({
        success: true,
        updated_item: updatedItemWithBaseType,
        image_url: result.image_url,
        is_first_craft: result.is_first_craft,
        craft_count: result.craft_count,
        materials_consumed: result.materials_consumed
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /items/:item_id/materials/replace
   * Replace material in slot
   * TODO: Implement replaceMaterial in MaterialService
   */
  replaceMaterial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new Error('replaceMaterial not yet implemented');
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /items/:item_id
   * Discard/sell item for gold compensation
   */
  discardItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.params;

      const result = await itemService.discardItem(item_id, userId);

      res.json({
        success: result.success,
        gold_earned: result.gold_earned,
        new_gold_balance: result.new_gold_balance,
        item_name: result.item_name,
        message: `Discarded ${result.item_name} for ${result.gold_earned} gold`
      });
    } catch (error) {
      next(error);
    }
  };
}