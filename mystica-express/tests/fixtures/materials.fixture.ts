/**
 * Material Test Fixtures
 *
 * Provides standardized Material and MaterialStack objects for testing
 * material application, inventory management, and style variations.
 */

export interface StatModifiers {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

export interface Material {
  id: string;
  name: string;
  description: string;
  stat_modifiers: StatModifiers;
  style_id: string;
}

export interface MaterialStack {
  material_id: string;
  name: string;
  style_id: string;
  quantity: number;
  description: string;
  stat_modifiers: StatModifiers;
}

/**
 * Common iron material with normal style and balanced stats
 */
export const IRON_MATERIAL: Material = {
  id: 'iron',
  name: 'Iron',
  description: 'A sturdy metallic material that provides reliable defensive properties.',
  stat_modifiers: {
    atkPower: 0.1,
    atkAccuracy: 0.0,
    defPower: 0.15,
    defAccuracy: -0.25
  },
  style_id: 'normal',
};

/**
 * Crystal material with stat modifiers for testing offensive builds
 */
export const CRYSTAL_MATERIAL: Material = {
  id: 'crystal',
  name: 'Crystal',
  description: 'A translucent crystalline material that enhances magical properties and accuracy.',
  stat_modifiers: {
    atkPower: 0.2,
    atkAccuracy: 0.1,
    defPower: -0.1,
    defAccuracy: -0.2
  },
  style_id: 'normal',
};

/**
 * Material with pixel_art style for testing style system
 */
export const PIXEL_ART_MATERIAL: Material = {
  id: 'coffee',
  name: 'Coffee',
  description: 'Caffeinated material that provides energy-based enhancements with retro aesthetics.',
  stat_modifiers: {
    atkPower: 0.05,
    atkAccuracy: 0.15,
    defPower: -0.05,
    defAccuracy: -0.15
  },
  style_id: 'pixel_art',
};

/**
 * MaterialStack with quantity=10 for testing inventory operations
 */
export const MATERIAL_STACK_IRON: MaterialStack = {
  material_id: 'iron',
  name: 'Iron',
  style_id: 'normal',
  quantity: 10,
  description: 'A sturdy metallic material that provides reliable defensive properties.',
  stat_modifiers: {
    atkPower: 0.1,
    atkAccuracy: 0.0,
    defPower: 0.15,
    defAccuracy: -0.25
  },
};

/**
 * Create custom material with property overrides
 *
 * @param overrides - Partial material properties to override defaults
 * @returns Material object with merged properties
 */
export function createMaterial(overrides: Partial<Material> = {}): Material {
  return { ...IRON_MATERIAL, ...overrides };
}

/**
 * Create custom material stack with property overrides
 *
 * @param overrides - Partial material stack properties to override defaults
 * @returns MaterialStack object with merged properties
 */
export function createMaterialStack(overrides: Partial<MaterialStack> = {}): MaterialStack {
  return { ...MATERIAL_STACK_IRON, ...overrides };
}