import { Router } from 'express';
import { styleController } from '../controllers/StyleController.js';

const router = Router();

/**
 * Style Routes
 *
 * GET /styles - Get all style definitions (no authentication required - public reference data)
 */

// Get all style definitions (no authentication required)
router.get('/', styleController.getStyles);

export default router;