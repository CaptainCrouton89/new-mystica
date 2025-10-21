import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ItemController } from '../controllers/ItemController';
import { ItemIdParamsSchema } from '../types/schemas';

const router = Router();
const controller = new ItemController();

/**
 * Item Routes
 *
 * GET  /items/:item_id              - Get item details with computed stats
 * GET  /items/:item_id/upgrade-cost - Get upgrade cost for next level
 * POST /items/:item_id/upgrade      - Upgrade item level (spend gold)
 */

// Get specific item with full details
router.get('/:item_id',
  authenticate,
  validate({ params: ItemIdParamsSchema }),
  controller.getItem
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

export default router;