import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { combatController } from '../controllers/CombatController.js';
import {
  EnemyChatterRequestSchema,
  StartCombatSchema,
  AttackSchema,
  CompleteCombatSchema
} from '../types/schemas.js';

const router = Router();

/**
 * Combat Routes
 *
 * POST /combat/start - Start a new combat session
 * POST /combat/attack - Execute attack action in combat
 * POST /combat/complete - Complete combat and award loot
 * POST /combat/enemy-chatter - Generate AI-powered enemy dialogue for combat events
 */

// Start combat session
router.post(
  '/start',
  authenticate,
  validate({ body: StartCombatSchema }),
  combatController.startCombat
);

// Execute attack action
router.post(
  '/attack',
  authenticate,
  validate({ body: AttackSchema }),
  combatController.attack
);

// Complete combat session
router.post(
  '/complete',
  authenticate,
  validate({ body: CompleteCombatSchema }),
  combatController.completeCombat
);

// Generate enemy dialogue for combat events
router.post(
  '/enemy-chatter',
  authenticate,
  validate({ body: EnemyChatterRequestSchema }),
  combatController.generateEnemyChatter
);

export default router;