import { Request, Response, NextFunction } from 'express';
import { styleService } from '../services/StyleService.js';
import type { StyleResponse } from '../types/api.types.js';

/**
 * StyleController
 *
 * Manages the retrieval and validation of visual style definitions for the materials and enemies style system.
 * Provides read-only access to the StyleDefinitions table containing pre-defined art style variants.
 *
 * Feature References:
 * - F-04: Materials System - Uses style_id for visual material variants
 * - F-05: Drop System - Enemies inherit style_id that determines dropped material styles
 */
export class StyleController {
  /**
   * GET /styles
   * Get all available style definitions (no auth required)
   *
   * Returns all style definitions with their visual properties and spawn rates.
   * This is public reference data that doesn't require authentication.
   * Response is cached for 24 hours as styles are seed data that rarely change.
   */
  getStyles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const styles = await styleService.getAllStyles();

      const response: StyleResponse = {
        styles,
        total_count: styles.length
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}

export const styleController = new StyleController();