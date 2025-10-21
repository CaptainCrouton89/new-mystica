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
      console.log('⚔️  [EQUIPMENT] Get equipment request:', {
        userId: req.user?.id,
        accountType: req.user?.account_type,
        deviceId: req.user?.device_id
      });

      const userId = req.user!.id;

      const equipment = await equipmentService.getEquippedItems(userId);

      console.log('✅ [EQUIPMENT] Equipment loaded successfully:', {
        userId,
        equippedCount: Object.keys(equipment.slots).filter(slot =>
          equipment.slots[slot as keyof typeof equipment.slots] !== undefined
        ).length,
        totalStats: equipment.total_stats
      });

      res.json({
        slots: equipment.slots,
        total_stats: equipment.total_stats,
        equipment_count: Object.keys(equipment.slots).filter(slot =>
          equipment.slots[slot as keyof typeof equipment.slots] !== undefined
        ).length
      });
    } catch (error) {
      console.log('❌ [EQUIPMENT] Failed to get equipment:', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
        equipped_item: result.equipped_item,
        unequipped_item: result.unequipped_item || null,
        updated_player_stats: result.updated_player_stats
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