import { Request, Response, NextFunction } from 'express';
import { loadoutService } from '../services/LoadoutService.js';
import {
  CreateLoadoutRequest,
  UpdateLoadoutRequest,
  UpdateLoadoutSlotsRequest
} from '../types/schemas.js';

/**
 * LoadoutController - HTTP handlers for saved equipment configurations
 *
 * Implements F-09 Inventory Management System's loadout endpoints.
 * Handles loadout CRUD, slot management, and activation operations.
 */
export class LoadoutController {

  /**
   * GET /api/v1/loadouts
   * Get all loadouts for authenticated user
   */
  getLoadouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const loadouts = await loadoutService.getLoadoutsByUser(userId);

      res.json({
        loadouts
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/loadouts
   * Create new loadout
   */
  createLoadout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { name } = req.body as CreateLoadoutRequest;

      const loadout = await loadoutService.createLoadout(userId, name);

      res.status(201).json(loadout);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/loadouts/:loadout_id
   * Get specific loadout with slot assignments
   */
  getLoadoutById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { loadout_id } = req.params;

      const loadout = await loadoutService.getLoadoutById(loadout_id, userId);

      res.json(loadout);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/loadouts/:loadout_id
   * Update loadout name
   */
  updateLoadoutName = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { loadout_id } = req.params;
      const { name } = req.body as UpdateLoadoutRequest;

      const loadout = await loadoutService.updateLoadoutName(loadout_id, userId, name);

      res.json(loadout);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/loadouts/:loadout_id
   * Delete loadout (cannot delete active loadout)
   */
  deleteLoadout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { loadout_id } = req.params;

      await loadoutService.deleteLoadout(loadout_id, userId);

      res.json({
        success: true
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/loadouts/:loadout_id/activate
   * Activate loadout (copy LoadoutSlots → UserEquipment)
   */
  activateLoadout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { loadout_id } = req.params;

      const updatedEquipment = await loadoutService.activateLoadout(loadout_id, userId);

      res.json({
        success: true,
        active_loadout_id: loadout_id,
        updated_equipment: updatedEquipment
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/loadouts/:loadout_id/slots
   * Update all slot assignments
   */
  updateLoadoutSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { loadout_id } = req.params;
      const { slots } = req.body as UpdateLoadoutSlotsRequest;

      const loadout = await loadoutService.updateLoadoutSlots(loadout_id, userId, slots);

      res.json(loadout);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/loadouts/active
   * Get user's currently active loadout
   */
  getActiveLoadout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const activeLoadout = await loadoutService.getActiveLoadout(userId);

      if (!activeLoadout) {
        res.json({
          active_loadout: null
        });
        return;
      }

      res.json({
        active_loadout: activeLoadout
      });
    } catch (error) {
      next(error);
    }
  };

}

export const loadoutController = new LoadoutController();