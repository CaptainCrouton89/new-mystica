import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/ProfileService.js';

/**
 * Profile Controller
 * Handles user profile initialization and retrieval
 */
export class ProfileController {
  /**
   * POST /profile/init
   * Initialize new player profile with starting resources
   */
  initProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const profile = await profileService.initializeProfile(userId);

      res.status(201).json(profile);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /profile
   * Get player profile with computed stats
   */
  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const profile = await profileService.getProfile(userId);

      res.json(profile);
    } catch (error) {
      next(error);
    }
  };
}