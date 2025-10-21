// Simple UUID generator for tests (avoids ESM import issues)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import type { Database } from '../../src/types/database.types.js';

type Material = Database['public']['Tables']['materials']['Row'];
type MaterialInsert = Database['public']['Tables']['materials']['Insert'];
type MaterialStack = Database['public']['Tables']['materialstacks']['Row'];
type MaterialStackInsert = Database['public']['Tables']['materialstacks']['Insert'];
type MaterialInstance = Database['public']['Tables']['materialinstances']['Row'];
type MaterialInstanceInsert = Database['public']['Tables']['materialinstances']['Insert'];

/**
 * Stats interface for material stat modifiers
 */
interface StatModifiers {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

/**
 * Factory for generating Material-related test data with flexible overrides
 */
export class MaterialFactory {
  /**
   * Create material with stat modifiers
   */
  static create(id: string, theme: string, styleId: string, overrides?: Partial<Material>): Material {
    const statModifiers = this.generateStatModifiers(theme);

    const baseMaterial: Material = {
      id: id,
      name: this.generateMaterialName(id, theme),
      description: `A ${theme} material with balanced properties`,
      stat_modifiers: statModifiers as any, // JSON field
      base_drop_weight: this.getBaseDropWeight(theme),
      created_at: new Date().toISOString(),
      ...overrides
    };

    return baseMaterial;
  }

  /**
   * Create material stack for player inventory
   */
  static createStack(
    userId: string,
    materialId: string,
    styleId: string,
    quantity: number,
    overrides?: Partial<MaterialStack>
  ): MaterialStack {
    const baseStack: MaterialStack = {
      user_id: userId,
      material_id: materialId,
      style_id: styleId,
      quantity: quantity,
      updated_at: new Date().toISOString(),
      ...overrides
    };

    return baseStack;
  }

  /**
   * Create styled material (non-normal style)
   */
  static createStyled(styleId: string, overrides?: Partial<Material>): Material {
    const themes = ['metal', 'organic', 'crystal', 'elemental'];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const materialId = `${randomTheme}_${styleId}_${Math.random().toString(36).substring(7)}`;

    return this.create(materialId, randomTheme, styleId, overrides);
  }

  /**
   * Create material instance from stack
   */
  static createInstance(
    userId: string,
    materialId: string,
    styleId: string,
    overrides?: Partial<MaterialInstance>
  ): MaterialInstance {
    const baseInstance: MaterialInstance = {
      id: generateUuid(),
      user_id: userId,
      material_id: materialId,
      style_id: styleId,
      created_at: new Date().toISOString(),
      ...overrides
    };

    return baseInstance;
  }

  /**
   * Create common materials set (iron, wood, leather, etc.)
   */
  static createCommonMaterials(): Material[] {
    const commonMaterials = [
      { id: 'iron', theme: 'metal', description: 'Strong and durable iron ore' },
      { id: 'wood', theme: 'organic', description: 'Sturdy oak wood' },
      { id: 'leather', theme: 'organic', description: 'Flexible leather hide' },
      { id: 'crystal', theme: 'crystal', description: 'Clear quartz crystal' },
      { id: 'bone', theme: 'organic', description: 'Dense creature bone' },
      { id: 'steel', theme: 'metal', description: 'Refined steel alloy' }
    ];

    return commonMaterials.map(({ id, theme, description }) =>
      this.create(id, theme, 'normal', { description })
    );
  }

  /**
   * Create material with specific stat focus
   */
  static createWithStatFocus(
    id: string,
    statFocus: keyof StatModifiers,
    intensity: number = 0.3,
    overrides?: Partial<Material>
  ): Material {
    const statModifiers: StatModifiers = {
      atkPower: 0,
      atkAccuracy: 0,
      defPower: 0,
      defAccuracy: 0
    };

    // Set focused stat
    statModifiers[statFocus] = intensity;

    // Distribute remaining to balance (sum to 0)
    const remaining = -intensity;
    const otherStats = Object.keys(statModifiers).filter(key => key !== statFocus) as (keyof StatModifiers)[];
    const perOtherStat = remaining / otherStats.length;

    otherStats.forEach(stat => {
      statModifiers[stat] = perOtherStat;
    });

    return this.create(id, 'balanced', 'normal', {
      stat_modifiers: statModifiers as any,
      description: `Material focused on ${statFocus} enhancement`,
      ...overrides
    });
  }

  /**
   * Create multiple material stacks for testing inventory
   */
  static createInventoryStacks(userId: string, materialCount: number = 5): MaterialStack[] {
    const materials = this.createCommonMaterials();
    const styles = ['normal', 'shiny', 'rare', 'epic'];

    return materials.slice(0, materialCount).map(material => {
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      const randomQuantity = Math.floor(Math.random() * 10) + 1; // 1-10 quantity

      return this.createStack(userId, material.id, randomStyle, randomQuantity);
    });
  }

  /**
   * Create material for database insertion (Insert type)
   */
  static createForInsert(overrides?: Partial<MaterialInsert>): MaterialInsert {
    const material = this.create('test_material', 'metal', 'normal');
    return {
      id: material.id,
      name: material.name,
      description: material.description,
      stat_modifiers: material.stat_modifiers,
      base_drop_weight: material.base_drop_weight,
      ...overrides
    };
  }

  /**
   * Create material stack for database insertion (Insert type)
   */
  static createStackForInsert(overrides?: Partial<MaterialStackInsert>): MaterialStackInsert {
    const stack = this.createStack(generateUuid(), 'iron', 'normal', 5);
    return {
      user_id: stack.user_id,
      material_id: stack.material_id,
      style_id: stack.style_id,
      quantity: stack.quantity,
      ...overrides
    };
  }

  /**
   * Create material instance for database insertion (Insert type)
   */
  static createInstanceForInsert(overrides?: Partial<MaterialInstanceInsert>): MaterialInstanceInsert {
    const instance = this.createInstance(generateUuid(), 'iron', 'normal');
    return {
      id: instance.id,
      user_id: instance.user_id,
      material_id: instance.material_id,
      style_id: instance.style_id,
      ...overrides
    };
  }

  /**
   * Create multiple materials at once
   */
  static createMany(count: number, factory: () => Material = () => this.create('material', 'metal', 'normal')): Material[] {
    return Array.from({ length: count }, (_, index) => {
      const uniqueId = `material_${index}_${Math.random().toString(36).substring(7)}`;
      return factory().id === 'material' ? this.create(uniqueId, 'metal', 'normal') : factory();
    });
  }

  /**
   * Generate stat modifiers that sum to 0 (balanced)
   */
  private static generateStatModifiers(theme: string): StatModifiers {
    const themeModifiers: Record<string, Partial<StatModifiers>> = {
      metal: { atkPower: 0.2, atkAccuracy: 0.1, defPower: -0.2, defAccuracy: -0.1 },
      organic: { atkPower: -0.1, atkAccuracy: -0.1, defPower: 0.1, defAccuracy: 0.1 },
      crystal: { atkPower: 0.1, atkAccuracy: 0.2, defPower: -0.2, defAccuracy: -0.1 },
      elemental: { atkPower: 0.2, atkAccuracy: -0.1, defPower: 0.0, defAccuracy: -0.1 },
      balanced: { atkPower: 0.0, atkAccuracy: 0.0, defPower: 0.0, defAccuracy: 0.0 }
    };

    const base = themeModifiers[theme] || themeModifiers['balanced'];

    // Ensure all stats are present and sum to 0
    return {
      atkPower: base.atkPower || 0,
      atkAccuracy: base.atkAccuracy || 0,
      defPower: base.defPower || 0,
      defAccuracy: base.defAccuracy || 0
    };
  }

  /**
   * Generate material name based on ID and theme
   */
  private static generateMaterialName(id: string, theme: string): string {
    const themeAdjectives: Record<string, string[]> = {
      metal: ['Forged', 'Tempered', 'Hardened', 'Refined'],
      organic: ['Living', 'Natural', 'Wild', 'Fresh'],
      crystal: ['Crystalline', 'Pure', 'Radiant', 'Prismatic'],
      elemental: ['Infused', 'Charged', 'Awakened', 'Empowered'],
      balanced: ['Balanced', 'Harmonious', 'Stable', 'Perfect']
    };

    const adjectives = themeAdjectives[theme] || themeAdjectives['balanced'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];

    // Capitalize and format the ID
    const baseName = id.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return `${randomAdjective} ${baseName}`;
  }

  /**
   * Get base drop weight for theme
   */
  private static getBaseDropWeight(theme: string): number {
    const themeWeights: Record<string, number> = {
      metal: 100,      // Common
      organic: 120,    // Very common
      crystal: 50,     // Uncommon
      elemental: 25,   // Rare
      balanced: 75     // Somewhat common
    };

    return themeWeights[theme] || 100;
  }
}