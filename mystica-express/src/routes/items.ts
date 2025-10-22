import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ItemController } from '../controllers/ItemController';
import {
  ItemIdParamsSchema,
  ItemIdSlotParamsSchema,
  ApplyMaterialSchema,
  ReplaceMaterialSchema,
  AssignPetPersonalityBodySchema,
  AddPetChatterSchema
} from '../types/schemas';

const router = Router();
const controller = new ItemController();

/**
 * Item Routes
 *
 * GET    /items/:item_id                      - Get item details with computed stats
 * DELETE /items/:item_id                      - Discard/sell item for gold compensation
 * GET    /items/:item_id/upgrade-cost         - Get upgrade cost for next level
 * POST   /items/:item_id/upgrade              - Upgrade item level (spend gold)
 * POST   /items/:item_id/materials/apply      - Apply material to item
 * POST   /items/:item_id/materials/replace    - Replace material in slot
 * DELETE /items/:item_id/materials/:slot_index - Remove material from slot
 * GET    /items/:item_id/history              - Get item history
 * GET    /items/:item_id/weapon-stats         - Get weapon combat stats
 * POST   /items/:item_id/pet/personality      - Assign pet personality
 * POST   /items/:item_id/pet/chatter          - Add pet chatter
 * GET    /player/stats                        - Get player total stats
 */

// Get specific item with full details
router.get('/:item_id',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.getItem
);

// Discard/sell item for gold compensation
router.delete('/:item_id',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.discardItem
);

// Get upgrade cost for item
router.get('/:item_id/upgrade-cost',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.getUpgradeCost
);

// Upgrade item to next level
router.post('/:item_id/upgrade',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.upgradeItem
);

// Apply material to item
router.post('/:item_id/materials/apply',
  authenticate,
  validate({ params: ItemIdParamsSchema, body: ApplyMaterialSchema }),
  controller.applyMaterial
);

// Replace material in slot
router.post('/:item_id/materials/replace',
  authenticate,
  validate({ params: ItemIdParamsSchema, body: ReplaceMaterialSchema }),
  controller.replaceMaterial
);

// Remove material from slot
router.delete('/:item_id/materials/:slot_index',
  authenticate,
  validate({ params: ItemIdSlotParamsSchema }),
  controller.removeMaterial
);

// Get item history
router.get('/:item_id/history',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.getItemHistory
);

// Get weapon combat stats
router.get('/:item_id/weapon-stats',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.getWeaponStats
);

// Assign pet personality
router.post('/:item_id/pet/personality',
  authenticate,
  validate({ params: ItemIdParamsSchema, body: AssignPetPersonalityBodySchema }),
  controller.assignPetPersonality
);

// Add pet chatter
router.post('/:item_id/pet/chatter',
  authenticate,
  validate({ params: ItemIdParamsSchema, body: AddPetChatterSchema }),
  controller.addPetChatter
);

// Get player total stats (note: this is /player/stats, not /items/:id/stats)
router.get('/player/stats',
  authenticate,
  controller.getPlayerStats
);

export default router;