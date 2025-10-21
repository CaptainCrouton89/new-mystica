// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import type { Database } from '../../src/types/database.types.js';

type Item = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];

/**
 * Stats interface for computed item stats
 */
interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

/**
 * Player item with computed stats (extends base Item)
 */
export interface PlayerItem extends Item {
  computed_stats: Stats;
}

/**
 * Factory for generating Item test data with flexible overrides
 */
export class ItemFactory {
  /**
   * Create base item (no materials applied)
   */
  static createBase(type: string, level: number, overrides?: Partial<PlayerItem>): PlayerItem {
    // Base stats scale with level and type
    const baseStats = this.getBaseStatsForType(type, level);

    const baseItem: PlayerItem = {
      id: generateUuid(),
      user_id: generateUuid(), // Should be overridden with real user ID
      item_type_id: type,
      level: level,
      is_styled: false,
      material_combo_hash: null,
      generated_image_url: null,
      image_generation_status: null,
      current_stats: baseStats as any, // JSON field
      computed_stats: baseStats,
      created_at: new Date().toISOString(),
      ...overrides
    };

    return baseItem;
  }

  /**
   * Create crafted item with materials applied
   */
  static createCrafted(
    baseType: string,
    level: number,
    materialIds: string[],
    styleIds: string[],
    overrides?: Partial<PlayerItem>
  ): PlayerItem {
    // Validate inputs
    if (materialIds.length !== styleIds.length) {
      throw new Error('Material IDs and style IDs arrays must have same length');
    }
    if (materialIds.length > 3) {
      throw new Error('Maximum 3 materials can be applied');
    }

    const baseStats = this.getBaseStatsForType(baseType, level);

    // Apply material modifiers (simplified for testing)
    const modifiedStats = { ...baseStats };
    materialIds.forEach((_, index) => {
      // Add small random modifiers per material
      const modifier = (Math.random() - 0.5) * 0.1; // ±5% modifier
      modifiedStats.atkPower += modifier;
      modifiedStats.defPower += modifier;
    });

    // Determine if styled (any non-normal style)
    const isStyled = styleIds.some(styleId => styleId !== 'normal');

    // Generate combo hash from material and style IDs
    const comboHash = this.generateComboHash(baseType, materialIds, styleIds);

    const craftedItem: PlayerItem = {
      id: generateUuid(),
      user_id: generateUuid(),
      item_type_id: baseType,
      level: level,
      is_styled: isStyled,
      material_combo_hash: comboHash,
      generated_image_url: `https://example.com/items/${comboHash}.png`,
      image_generation_status: 'completed',
      current_stats: modifiedStats as any,
      computed_stats: modifiedStats,
      created_at: new Date().toISOString(),
      ...overrides
    };

    return craftedItem;
  }

  /**
   * Create item with specific stat distribution
   */
  static withStats(stats: Stats, overrides?: Partial<PlayerItem>): PlayerItem {
    const baseItem = this.createBase('sword', 5);

    return {
      ...baseItem,
      current_stats: stats as any,
      computed_stats: stats,
      ...overrides
    };
  }

  /**
   * Create weapon item (sword, staff, bow, etc.)
   */
  static createWeapon(weaponType: string = 'sword', level: number = 1, overrides?: Partial<PlayerItem>): PlayerItem {
    return this.createBase(weaponType, level, overrides);
  }

  /**
   * Create armor item (shield, helmet, chestplate, etc.)
   */
  static createArmor(armorType: string = 'shield', level: number = 1, overrides?: Partial<PlayerItem>): PlayerItem {
    return this.createBase(armorType, level, overrides);
  }

  /**
   * Create item for database insertion (Insert type)
   */
  static createForInsert(overrides?: Partial<ItemInsert>): ItemInsert {
    const item = this.createBase('sword', 1);
    return {
      id: item.id,
      user_id: item.user_id,
      item_type_id: item.item_type_id,
      level: item.level,
      is_styled: item.is_styled,
      material_combo_hash: item.material_combo_hash,
      generated_image_url: item.generated_image_url,
      image_generation_status: item.image_generation_status,
      current_stats: item.current_stats,
      ...overrides
    };
  }

  /**
   * Create multiple items at once
   */
  static createMany(count: number, factory: () => PlayerItem = () => this.createBase('sword', 1)): PlayerItem[] {
    return Array.from({ length: count }, () => factory());
  }

  /**
   * Get base stats for item type and level
   */
  private static getBaseStatsForType(type: string, level: number): Stats {
    const baseStats: Record<string, Stats> = {
      sword: { atkPower: 0.4, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.2 },
      shield: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
      bow: { atkPower: 0.5, atkAccuracy: 0.3, defPower: 0.1, defAccuracy: 0.1 },
      staff: { atkPower: 0.3, atkAccuracy: 0.3, defPower: 0.2, defAccuracy: 0.2 },
      helmet: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.4, defAccuracy: 0.4 },
      chestplate: { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 },
      boots: { atkPower: 0.2, atkAccuracy: 0.2, defPower: 0.3, defAccuracy: 0.3 }
    };

    const base = baseStats[type] || baseStats['sword'];

    // Scale with level (level 1 = base stats, higher levels get proportional boost)
    const levelMultiplier = 1 + (level - 1) * 0.1;

    return {
      atkPower: base.atkPower * levelMultiplier,
      atkAccuracy: base.atkAccuracy * levelMultiplier,
      defPower: base.defPower * levelMultiplier,
      defAccuracy: base.defAccuracy * levelMultiplier
    };
  }

  /**
   * Generate deterministic combo hash from materials and styles
   */
  private static generateComboHash(itemType: string, materialIds: string[], styleIds: string[]): string {
    const sortedMaterials = [...materialIds].sort();
    const sortedStyles = [...styleIds].sort();
    const hashInput = `${itemType}_${sortedMaterials.join('_')}_${sortedStyles.join('_')}`;

    // Simple hash for testing (not cryptographic)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }
}