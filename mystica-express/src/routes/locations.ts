import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { locationController } from '../controllers/LocationController';
import { NearbyLocationsQuerySchema, LocationParamsSchema } from '../types/schemas';

const router = Router();

/**
 * Location Routes
 *
 * GET /locations/nearby - Find nearby locations using PostGIS geospatial queries
 * GET /locations/:id    - Get specific location by ID
 */

// Find nearby locations within radius
router.get(
  '/nearby',
  authenticate,
  validate({ query: NearbyLocationsQuerySchema }),
  locationController.getNearby
);

// Get specific location
router.get(
  '/:id',
  authenticate,
  validate({ params: LocationParamsSchema }),
  locationController.getById
);

export default router;