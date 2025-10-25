import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { enemyController } from '../controllers/EnemyController.js';
import { chatterController } from '../controllers/ChatterController.js';
import { LocationIdParamsSchema } from '../types/schemas.js';

const router = Router();

/**
 * Enemy Routes
 *
 * GET /enemies - List all monsters with pagination (public)
 * GET /enemies/types - Get all enemy types (public endpoint)
 * GET /enemies/personality-types - Get enemy types with personality traits (F-12)
 * GET /enemies/:id - Get complete monster data by ID (public)
 * GET /players/combat-history/:location_id - Get player combat history for location (authenticated)
 */

// List all monsters with pagination (public endpoint)
router.get(
  '/',
  enemyController.listMonsters
);

// Get all enemy types (public endpoint)
router.get(
  '/types',
  enemyController.getEnemyTypes
);

// Get enemy types with personality traits for chatter (F-12)
router.get(
  '/personality-types',
  chatterController.getEnemyTypes
);

// Get complete monster data by ID (public endpoint) - MUST be after /types and /personality-types
router.get(
  '/:id',
  enemyController.getMonsterById
);

// Get player combat history for specific location
router.get(
  '/players/combat-history/:location_id',
  authenticate,
  validate({ params: LocationIdParamsSchema }),
  enemyController.getPlayerCombatHistory
);

export default router;