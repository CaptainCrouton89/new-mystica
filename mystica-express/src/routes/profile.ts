import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ProfileController } from '../controllers/ProfileController';

const router = Router();
const controller = new ProfileController();

/**
 * Profile Routes
 *
 * POST /profile/init - Initialize new player profile (after registration)
 * GET  /profile      - Get player profile with stats
 */

// Initialize new player profile
router.post('/init', authenticate, controller.initProfile);

// Get player profile
router.get('/', authenticate, controller.getProfile);

export default router;