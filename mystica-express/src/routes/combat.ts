import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { combatController } from '../controllers/CombatController.js';
import {
  EnemyChatterRequestSchema,
  PetChatterSchema,
  StartCombatSchema,
  AttackSchema,
  DefenseSchema,
  CompleteCombatSchema
} from '../types/schemas.js';

const router = Router();

/**
 * Combat Routes
 *
 * POST /combat/start - Start a new combat session
 * POST /combat/attack - Execute attack action in combat
 * POST /combat/defend - Execute defense action in combat
 * POST /combat/complete - Complete combat and award loot
 * GET /combat/session/:session_id - Get active combat session state for recovery
 * POST /combat/pet-chatter - Generate AI-powered pet dialogue for combat events
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

// Execute defense action
router.post(
  '/defend',
  authenticate,
  validate({ body: DefenseSchema }),
  combatController.defend
);

// Complete combat session
router.post(
  '/complete',
  authenticate,
  validate({ body: CompleteCombatSchema }),
  combatController.completeCombat
);

// Get combat session for recovery
router.get(
  '/session/:session_id',
  authenticate,
  combatController.getCombatSession
);

// Generate pet dialogue for combat events
router.post(
  '/pet-chatter',
  authenticate,
  validate({ body: PetChatterSchema }),
  combatController.generatePetChatter
);

// Generate enemy dialogue for combat events
router.post(
  '/enemy-chatter',
  authenticate,
  validate({ body: EnemyChatterRequestSchema }),
  combatController.generateEnemyChatter
);

export default router;