import { Router } from 'express';
import { loadoutController } from '../controllers/LoadoutController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  CreateLoadoutSchema,
  UpdateLoadoutSchema,
  UpdateLoadoutSlotsSchema,
  LoadoutIdParamsSchema
} from '../types/schemas.js';

const router = Router();

/**
 * Loadout management routes (F-09)
 * Handles saved equipment configurations
 */

// GET /api/v1/loadouts - Get all user's loadouts
router.get('/', authenticate, loadoutController.getLoadouts);

// POST /api/v1/loadouts - Create new loadout
router.post('/', authenticate, validate({ body: CreateLoadoutSchema }), loadoutController.createLoadout);

// GET /api/v1/loadouts/active - Get active loadout
router.get('/active', authenticate, loadoutController.getActiveLoadout);

// GET /api/v1/loadouts/:loadout_id - Get specific loadout
router.get('/:loadout_id', authenticate, validate({ params: LoadoutIdParamsSchema }), loadoutController.getLoadoutById);

// PUT /api/v1/loadouts/:loadout_id - Update loadout name
router.put('/:loadout_id', authenticate, validate({ params: LoadoutIdParamsSchema, body: UpdateLoadoutSchema }), loadoutController.updateLoadoutName);

// DELETE /api/v1/loadouts/:loadout_id - Delete loadout
router.delete('/:loadout_id', authenticate, validate({ params: LoadoutIdParamsSchema }), loadoutController.deleteLoadout);

// PUT /api/v1/loadouts/:loadout_id/activate - Activate loadout
router.put('/:loadout_id/activate', authenticate, validate({ params: LoadoutIdParamsSchema }), loadoutController.activateLoadout);

// PUT /api/v1/loadouts/:loadout_id/slots - Update all slot assignments
router.put('/:loadout_id/slots', authenticate, validate({ params: LoadoutIdParamsSchema, body: UpdateLoadoutSlotsSchema }), loadoutController.updateLoadoutSlots);

export default router;