import { styleRepository } from '../repositories/StyleRepository.js';
import { ValidationError } from '../utils/errors.js';
import type { Database } from '../types/database.types.js';

type StyleDefinition = Database['public']['Tables']['styledefinitions']['Row'];

export class StyleService {
  
  private styleCache = new Map<string, { data: StyleDefinition[], expiry: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; 

  async getAllStyles(): Promise<StyleDefinition[]> {
    const cacheKey = 'all_styles';
    const cached = this.styleCache.get(cacheKey);
    const now = Date.now();

    if (cached && now < cached.expiry) {
      return cached.data;
    }

    const styles = await styleRepository.findAll();
    this.styleCache.set(cacheKey, {
      data: styles,
      expiry: now + this.CACHE_TTL
    });

    return styles;
  }

  async getStyleByName(styleName: string): Promise<StyleDefinition | null> {
    if (!styleName || styleName.trim().length === 0) {
      throw new ValidationError('Style name is required');
    }

    return styleRepository.findByName(styleName.trim());
  }

  async getStyleById(styleId: string): Promise<StyleDefinition | null> {
    if (!styleId || styleId.trim().length === 0) {
      throw new ValidationError('Style ID is required');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(styleId.trim())) {
      throw new ValidationError('Style ID must be a valid UUID');
    }

    return styleRepository.findById(styleId.trim());
  }

  async validateStyleExists(styleId: string): Promise<boolean> {
    if (!styleId || styleId.trim().length === 0) {
      throw new ValidationError('Style ID is required for validation');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(styleId.trim())) {
      throw new ValidationError('Style ID must be a valid UUID');
    }

    return styleRepository.exists(styleId.trim());
  }

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

  clearCache(): void {
    this.styleCache.clear();
  }

  async validateMultipleStyles(styleIds: string[]): Promise<boolean[]> {
    if (!Array.isArray(styleIds)) {
      throw new ValidationError('Style IDs must be provided as an array');
    }

    if (styleIds.length === 0) {
      return [];
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const styleId of styleIds) {
      if (!styleId || typeof styleId !== 'string' || !uuidRegex.test(styleId.trim())) {
        throw new ValidationError(`Invalid UUID format: ${styleId}`);
      }
    }

    const validationPromises = styleIds.map(styleId =>
      this.validateStyleExists(styleId.trim())
    );

    return Promise.all(validationPromises);
  }
}

export const styleService = new StyleService();