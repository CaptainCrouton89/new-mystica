import { Request, Response, NextFunction } from 'express';
import { equipmentService } from '../services/EquipmentService';
import type { EquipItemRequest, UnequipItemRequest } from '../types/schemas';

/**
 * Equipment Controller
 * Handles 8-slot equipment system operations
 */
export class EquipmentController {
  /**
   * GET /equipment
   * Get currently equipped items and total computed stats
   */
  getEquipment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const equipment = await equipmentService.getEquippedItems(userId);

      res.json({
        slots: equipment.slots,
        total_stats: equipment.total_stats,
        equipment_count: Object.keys(equipment.slots).filter(slot =>
          equipment.slots[slot as keyof typeof equipment.slots] !== null
        ).length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /equipment/equip
   * Equip item to appropriate slot (auto-detects from item type)
   */
  equipItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { item_id } = req.body as EquipItemRequest;

      const result = await equipmentService.equipItem(userId, item_id);

      res.json({
        success: result.success,
        slot: result.equipped_item.base_type, // The slot where item was equipped
        equipped_item: result.equipped_item,
        unequipped_item: result.unequipped_item || null,
        updated_stats: result.updated_stats
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /equipment/unequip
   * Unequip item from specified slot
   */
  unequipItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { slot } = req.body as UnequipItemRequest;

      const success = await equipmentService.unequipItem(userId, slot);

      res.json({
        success,
        slot,
        message: success ? 'Item unequipped successfully' : 'No item in slot to unequip'
      });
    } catch (error) {
      next(error);
    }
  };
}