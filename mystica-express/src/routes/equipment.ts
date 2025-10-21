import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { EquipmentController } from '../controllers/EquipmentController';
import { EquipItemSchema, UnequipItemSchema } from '../types/schemas';

const router = Router();
const controller = new EquipmentController();

/**
 * Equipment Routes (8-slot system)
 *
 * GET  /equipment        - Get equipped items and total stats
 * POST /equipment/equip  - Equip item to appropriate slot
 * POST /equipment/unequip - Unequip item from specified slot
 */

// Get current equipped items and stats
router.get('/', authenticate, controller.getEquipment);

// Equip item to slot (auto-detects slot from item type)
router.post('/equip',
  authenticate,
  validate({ body: EquipItemSchema }),
  controller.equipItem
);

// Unequip item from specific slot
router.post('/unequip',
  authenticate,
  validate({ body: UnequipItemSchema }),
  controller.unequipItem
);

export default router;