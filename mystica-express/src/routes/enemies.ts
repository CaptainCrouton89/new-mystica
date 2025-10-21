import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { enemyController } from '../controllers/EnemyController.js';
import { LocationIdParamsSchema } from '../types/schemas.js';

const router = Router();

/**
 * Enemy Routes
 *
 * GET /enemies/types - Get all enemy types (public endpoint)
 * GET /players/combat-history/:location_id - Get player combat history for location (authenticated)
 */

// Get all enemy types (public endpoint)
router.get(
  '/types',
  enemyController.getEnemyTypes
);

// Get player combat history for specific location
router.get(
  '/players/combat-history/:location_id',
  authenticate,
  validate({ params: LocationIdParamsSchema }),
  enemyController.getPlayerCombatHistory
);

export default router;