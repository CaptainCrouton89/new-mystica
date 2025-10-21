import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { MaterialController } from '../controllers/MaterialController';

const router = Router();
const controller = new MaterialController();

/**
 * Material Routes
 *
 * GET  /materials                   - Get all material templates (no auth)
 * GET  /materials/inventory         - Get player's material stacks
 *
 * Note: Material application operations (apply/replace) are owned by ItemController
 * and located at POST /items/:item_id/materials/apply and POST /items/:item_id/materials/replace
 */

// Get all material templates (no authentication required)
router.get('/', controller.getMaterials);

// Get player's material inventory with stacking
router.get('/inventory', authenticate, controller.getInventory);

export default router;