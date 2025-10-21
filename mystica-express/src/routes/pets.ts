import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { chatterController } from '../controllers/ChatterController.js';
import {
  AssignPersonalitySchema,
  PetIdParamsSchema
} from '../types/schemas.js';

const router = Router();

/**
 * Pet Routes
 *
 * GET  /pets/personalities           - Get available pet personality types (F-11)
 * PUT  /pets/:pet_id/personality     - Assign personality to player's pet (F-11)
 */

// Get available pet personality types (no authentication required)
router.get('/personalities', chatterController.getPetPersonalities);

// Assign personality to player's pet
router.put('/:pet_id/personality',
  authenticate,
  validate({
    params: PetIdParamsSchema,
    body: AssignPersonalitySchema
  }),
  chatterController.assignPetPersonality
);

export default router;