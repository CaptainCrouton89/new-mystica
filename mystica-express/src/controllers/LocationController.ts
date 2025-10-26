import { Request, Response, NextFunction } from 'express';
import { locationService } from '../services/LocationService';
import type { NearbyLocationsQuery, LocationParams, AutoGenerateLocationRequest } from '../types/schemas';

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

  /**
   * POST /locations/auto-generate
   * Auto-generate "Goblin Den" at user location if no locations exist within 100m
   */
  autoGenerate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { lat, lng, state_code, country_code } = req.body as AutoGenerateLocationRequest;

      const location = await locationService.autoGenerate(lat, lng, state_code, country_code);

      if (location) {
        res.status(201).json({
          success: true,
          location
        });
      } else {
        res.json({
          success: false,
          message: 'Location already exists within 100m'
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

export const locationController = new LocationController();