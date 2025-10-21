import { Request, Response, NextFunction } from 'express';
import { locationService } from '../services/LocationService';
import type { NearbyLocationsQuery, LocationParams } from '../types/schemas';

/**
 * Location Controller
 * Handles geolocation-based location discovery and retrieval
 */
export class LocationController {
  /**
   * GET /locations/nearby
   * Find nearby locations within specified radius using PostGIS
   */
  getNearby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { lat, lng, radius } = req.query as unknown as NearbyLocationsQuery;

      const locations = await locationService.nearby(lat, lng, radius);

      res.json({
        locations
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /locations/:id
   * Get specific location by ID
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as LocationParams;

      const location = await locationService.getById(id);

      res.json(location);
    } catch (error) {
      next(error);
    }
  };
}

export const locationController = new LocationController();