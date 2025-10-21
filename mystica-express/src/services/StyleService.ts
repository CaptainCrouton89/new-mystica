import { styleRepository } from '../repositories/StyleRepository.js';
import { ValidationError } from '../utils/errors.js';
import type { Database } from '../types/database.types.js';

// Type alias from database schema
type StyleDefinition = Database['public']['Tables']['styledefinitions']['Row'];

/**
 * StyleService handles style definition operations and validation
 *
 * Provides read-only access to style definitions used for material and item appearance.
 * Styles affect visual rendering and are inherited from enemies to materials.
 */
export class StyleService {
  // Simple in-memory cache for style definitions (24-hour TTL)
  private styleCache = new Map<string, { data: StyleDefinition[], expiry: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Get all style definitions ordered by spawn rate (desc) then style name (asc)
   *
   * Returns complete style configuration for client applications with caching.
   * Styles are ordered with most common (high spawn rate) styles first.
   */
  async getAllStyles(): Promise<StyleDefinition[]> {
    const cacheKey = 'all_styles';
    const cached = this.styleCache.get(cacheKey);
    const now = Date.now();

    // Return cached data if still valid
    if (cached && now < cached.expiry) {
      return cached.data;
    }

    // Fetch from database and cache result
    const styles = await styleRepository.findAll();
    this.styleCache.set(cacheKey, {
      data: styles,
      expiry: now + this.CACHE_TTL
    });

    return styles;
  }

  /**
   * Get specific style definition by unique style_name
   *
   * @param styleName - Style identifier ('normal', 'pixel_art', etc.)
   * @returns StyleDefinition object or null if not found
   */
  async getStyleByName(styleName: string): Promise<StyleDefinition | null> {
    if (!styleName || styleName.trim().length === 0) {
      throw new ValidationError('Style name is required');
    }

    return styleRepository.findByName(styleName.trim());
  }

  /**
   * Get style definition by ID
   *
   * @param styleId - UUID of the style definition
   * @returns StyleDefinition object or null if not found
   */
  async getStyleById(styleId: string): Promise<StyleDefinition | null> {
    if (!styleId || styleId.trim().length === 0) {
      throw new ValidationError('Style ID is required');
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(styleId.trim())) {
      throw new ValidationError('Style ID must be a valid UUID');
    }

    return styleRepository.findById(styleId.trim());
  }

  /**
   * Validate that a style_id exists in StyleDefinitions table
   *
   * Used by material application and replacement operations to prevent
   * orphaned style references in the database.
   *
   * @param styleId - UUID string to validate
   * @returns Boolean indicating if style exists
   * @throws ValidationError for invalid UUID format
   */
  async validateStyleExists(styleId: string): Promise<boolean> {
    if (!styleId || styleId.trim().length === 0) {
      throw new ValidationError('Style ID is required for validation');
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(styleId.trim())) {
      throw new ValidationError('Style ID must be a valid UUID');
    }

    return styleRepository.exists(styleId.trim());
  }

  /**
   * Get fallback style definition for graceful degradation
   *
   * Returns a default 'normal' style when style data is unavailable.
   * Used as a fallback for missing style data.
   */
  getFallbackStyle(): StyleDefinition {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      style_name: 'normal',
      display_name: 'Normal',
      spawn_rate: 1.0,
      description: 'Standard appearance with no special visual effects',
      visual_modifier: 'none',
      created_at: new Date().toISOString()
    };
  }

  /**
   * Clear the style cache
   *
   * Used for testing or when style definitions are updated.
   * In production, cache invalidation would be handled by external cache layers.
   */
  clearCache(): void {
    this.styleCache.clear();
  }

  /**
   * Batch validate multiple style IDs
   *
   * Efficiently validates multiple style IDs in a single operation.
   * Useful for validating style references in bulk operations.
   *
   * @param styleIds - Array of style IDs to validate
   * @returns Promise resolving to array of booleans indicating validity
   */
  async validateMultipleStyles(styleIds: string[]): Promise<boolean[]> {
    if (!Array.isArray(styleIds)) {
      throw new ValidationError('Style IDs must be provided as an array');
    }

    if (styleIds.length === 0) {
      return [];
    }

    // Validate each style ID format first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const styleId of styleIds) {
      if (!styleId || typeof styleId !== 'string' || !uuidRegex.test(styleId.trim())) {
        throw new ValidationError(`Invalid UUID format: ${styleId}`);
      }
    }

    // Validate existence for each style ID
    const validationPromises = styleIds.map(styleId =>
      this.validateStyleExists(styleId.trim())
    );

    return Promise.all(validationPromises);
  }
}

export const styleService = new StyleService();