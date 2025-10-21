import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { InventoryController } from '../controllers/InventoryController';

const router = Router();
const controller = new InventoryController();

/**
 * Inventory Routes
 *
 * GET /inventory - Get all player items and material stacks
 */

// Get player inventory (items + material stacks)
router.get('/', authenticate, controller.getInventory);

export default router;