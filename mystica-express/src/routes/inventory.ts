import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { InventoryController } from '../controllers/InventoryController';
import { InventoryQuerySchema } from '../types/schemas';

const router = Router();
const controller = new InventoryController();

/**
 * Inventory Routes
 *
 * GET /inventory - Get all player items and material stacks with filtering and pagination
 */

// Get player inventory (items + material stacks)
router.get('/', authenticate, validate({ query: InventoryQuerySchema }), controller.getInventory);

export default router;