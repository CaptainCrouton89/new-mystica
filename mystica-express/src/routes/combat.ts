import { Router } from 'express';
import { combatController } from '../controllers/CombatController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  AbandonCombatSchema,
  AttackSchema,
  CompleteCombatSchema,
  DefenseSchema,
  EnemyChatterRequestSchema,
  StartCombatSchema
} from '../types/schemas.js';

const router = Router();

/**
 * Combat Routes
 *
 * POST /combat/start - Start a new combat session
 * POST /combat/attack - Execute attack action in combat
 * POST /combat/defend - Execute defense action in combat
 * POST /combat/complete - Complete combat and award loot
 * POST /combat/abandon - Abandon active combat session
 * GET /combat/active-session - Get user's active combat session for auto-resume
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

// Abandon combat session
router.post(
  '/abandon',
  authenticate,
  validate({ body: AbandonCombatSchema }),
  combatController.abandonCombat
);

// Get user's active combat session
router.get(
  '/active-session',
  authenticate,
  combatController.getActiveSession
);

// Get combat session for recovery
router.get(
  '/session/:session_id',
  authenticate,
  combatController.getCombatSession
);

// Generate enemy dialogue for combat events
router.post(
  '/enemy-chatter',
  authenticate,
  validate({ body: EnemyChatterRequestSchema }),
  combatController.generateEnemyChatter
);

export default router;