import { Request, Response, NextFunction } from 'express';
import { equipmentService } from '../services/EquipmentService';
import type { EquipItemRequest, UnequipItemRequest } from '../types/schemas';
import {
  ValidationError,
  ItemNotFoundError,
  ItemNotOwnedError,
  ItemAlreadyEquippedError,
  IncompatibleItemTypeError,
  SlotEmptyError,
  InvalidSlotError,
  AuthenticationError
} from '../utils/errors';

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

      // Count non-null slots
      const equipment_count = Object.values(equipment.slots).filter(item => item !== undefined).length;

      console.log('✅ [EQUIPMENT] Equipment loaded successfully:', {
        userId,
        equippedCount: equipment_count,
        totalStats: equipment.total_stats
      });

      res.status(200).json({
        slots: equipment.slots,
        total_stats: equipment.total_stats,
        equipment_count
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
      console.log('⚔️  [EQUIPMENT] Equip item request:', {
        userId: req.user?.id,
        accountType: req.user?.account_type,
        deviceId: req.user?.device_id
      });

      const userId = req.user!.id;
      const { item_id } = req.body as EquipItemRequest;

      const result = await equipmentService.equipItem(userId, item_id);

      console.log('✅ [EQUIPMENT] Item equipped successfully:', {
        userId,
        equippedItemId: result.equipped_item.id,
        unequippedItemId: result.unequipped_item?.id || null,
        newTotalStats: result.updated_player_stats.total_stats
      });

      res.status(200).json({
        success: result.success,
        slot: result.slot,
        total_stats: result.updated_player_stats.total_stats
      });
    } catch (error) {
      console.log('❌ [EQUIPMENT] Failed to equip item:', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Handle specific equipment errors with custom status codes and messages
      if (error instanceof ItemNotFoundError) {
        res.status(404).json({
          error: {
            code: 'ITEM_NOT_FOUND',
            message: 'Item with specified item_id does not exist'
          }
        });
        return;
      }

      if (error instanceof ItemNotOwnedError) {
        res.status(400).json({
          error: {
            code: 'ITEM_NOT_OWNED',
            message: 'Item not owned by user'
          }
        });
        return;
      }

      if (error instanceof ItemAlreadyEquippedError) {
        res.status(400).json({
          error: {
            code: 'ITEM_ALREADY_EQUIPPED',
            message: 'Item already equipped in another slot'
          }
        });
        return;
      }

      if (error instanceof IncompatibleItemTypeError) {
        res.status(400).json({
          error: {
            code: 'INCOMPATIBLE_ITEM_TYPE',
            message: 'Item type incompatible with any equipment slot'
          }
        });
        return;
      }

      next(error);
    }
  };

  /**
   * POST /equipment/unequip
   * Unequip item from specified slot
   */
  unequipItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log('⚔️  [EQUIPMENT] Unequip item request:', {
        userId: req.user?.id,
        accountType: req.user?.account_type,
        deviceId: req.user?.device_id
      });

      const userId = req.user!.id;
      const { slot } = req.body as UnequipItemRequest;

      const success = await equipmentService.unequipItem(userId, slot);

      const message = success ? 'Item unequipped successfully' : 'No item in slot to unequip';

      console.log('✅ [EQUIPMENT] Unequip completed:', {
        userId,
        slot,
        success,
        message
      });

      res.status(200).json({
        success
      });
    } catch (error) {
      console.log('❌ [EQUIPMENT] Failed to unequip item:', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Handle specific unequip errors
      if (error instanceof SlotEmptyError) {
        res.status(400).json({
          error: {
            code: 'SLOT_EMPTY',
            message: 'Slot already empty (no item to unequip)'
          }
        });
        return;
      }

      if (error instanceof InvalidSlotError) {
        res.status(400).json({
          error: {
            code: 'INVALID_SLOT',
            message: 'Invalid slot name (not in EquipmentSlot enum)'
          }
        });
        return;
      }

      next(error);
    }
  };
}