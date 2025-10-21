import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { MaterialController } from '../controllers/MaterialController';
import {
  ApplyMaterialSchema,
  ReplaceMaterialSchema,
  ItemIdParamsSchema
} from '../types/schemas';

const router = Router();
const controller = new MaterialController();

/**
 * Material Routes
 *
 * GET  /materials/inventory         - Get player's material stacks
 * POST /items/:item_id/materials/apply   - Apply material to item (20s sync)
 * POST /items/:item_id/materials/replace - Replace material in slot (costs gold)
 */

// Get player's material inventory with stacking
router.get('/inventory', authenticate, controller.getInventory);

// Apply material to item (triggers image generation if needed)
router.post('/items/:item_id/materials/apply',
  authenticate,
  validate({
    params: ItemIdParamsSchema,
    body: ApplyMaterialSchema
  }),
  controller.applyMaterial
);

// Replace existing material in slot
router.post('/items/:item_id/materials/replace',
  authenticate,
  validate({
    params: ItemIdParamsSchema,
    body: ReplaceMaterialSchema
  }),
  controller.replaceMaterial
);

export default router;