import { Router } from 'express';
import { authenticate, authenticateInternal } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { progressionController } from '../controllers/ProgressionController.js';
import { ClaimLevelRewardSchema, AwardExperienceSchema } from '../types/schemas.js';

const router = Router();

/**
 * Progression Routes
 *
 * GET  /progression           - Get player progression status
 * POST /progression/rewards/claim  - Claim level milestone reward
 * POST /progression/award-xp  - Award XP (internal API)
 */

// Get player progression status
router.get('/', authenticate, progressionController.getPlayerProgression);

// Claim level milestone reward
router.post('/rewards/claim',
  authenticate,
  validate({ body: ClaimLevelRewardSchema }),
  progressionController.claimLevelReward
);

// Award experience points (internal API)
router.post('/award-xp',
  authenticateInternal,
  validate({ body: AwardExperienceSchema }),
  progressionController.awardExperience
);

export default router;