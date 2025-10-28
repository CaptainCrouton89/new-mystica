import { Router } from 'express';
import { lootController } from '../controllers/LootController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { InstantLootSchema } from '../types/schemas.js';

const router = Router();

/**
 * Loot Routes
 *
 * POST /loot/instant - Collect instant loot from a location without combat
 */

// Collect instant loot from location
router.post(
  '/instant',
  authenticate,
  validate({ body: InstantLootSchema }),
  lootController.instantLoot
);

export default router;

