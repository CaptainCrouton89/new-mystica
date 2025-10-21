import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { economyController } from '../controllers/EconomyController.js';
import { AffordabilityCheckSchema, AddCurrencySchema, DeductCurrencySchema, LocationIdParamsSchema } from '../types/schemas.js';

const router = Router();

/**
 * Economy Routes
 *
 * GET  /economy/balances           - Get all currency balances for user
 * GET  /economy/balance/:currency  - Get specific currency balance
 * POST /economy/affordability      - Check if user can afford a purchase
 * POST /economy/add               - Add currency to user balance (admin/debug)
 * POST /economy/deduct            - Deduct currency from user balance
 * GET  /players/combat-history/:location_id - Get player's combat history at location (F-12)
 */

// Get all currency balances
router.get('/balances', authenticate, economyController.getAllBalances);

// Get specific currency balance
router.get('/balance/:currency', authenticate, economyController.getCurrencyBalance);

// Check affordability without modifying balance
router.post('/affordability',
  authenticate,
  validate({ body: AffordabilityCheckSchema }),
  economyController.checkAffordability
);

// Add currency (admin/debug endpoint)
router.post('/add',
  authenticate,
  validate({ body: AddCurrencySchema }),
  economyController.addCurrency
);

// Deduct currency with validation
router.post('/deduct',
  authenticate,
  validate({ body: DeductCurrencySchema }),
  economyController.deductCurrency
);

// Get player's combat history at specific location (F-12 Enemy AI)
router.get('/players/combat-history/:location_id',
  authenticate,
  validate({ params: LocationIdParamsSchema }),
  economyController.getCombatHistory
);

export default router;