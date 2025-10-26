import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { locationController } from '../controllers/LocationController';
import { NearbyLocationsQuerySchema, LocationParamsSchema, AutoGenerateLocationSchema } from '../types/schemas';

const router = Router();

/**
 * Location Routes
 *
 * GET  /locations/nearby        - Find nearby locations using PostGIS geospatial queries
 * POST /locations/auto-generate - Auto-create "Goblin Den" if no locations within 100m
 * GET  /locations/:id           - Get specific location by ID
 */

// Find nearby locations within radius
router.get(
  '/nearby',
  authenticate,
  validate({ query: NearbyLocationsQuerySchema }),
  locationController.getNearby
);

// Auto-generate location at user position
router.post(
  '/auto-generate',
  authenticate,
  validate({ body: AutoGenerateLocationSchema }),
  locationController.autoGenerate
);

// Get specific location
router.get(
  '/:id',
  authenticate,
  validate({ params: LocationParamsSchema }),
  locationController.getById
);

export default router;