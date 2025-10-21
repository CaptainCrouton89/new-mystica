import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { rarityController } from '../controllers/RarityController.js';

const router = Router();

/**
 * Rarity Routes
 *
 * GET /rarities - Get all rarity definitions with stat multipliers and display metadata
 */

// Get all rarity definitions
router.get('/',
  authenticate,
  rarityController.getRarities
);

export default router;