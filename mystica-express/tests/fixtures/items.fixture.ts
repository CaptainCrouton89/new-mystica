/**
 * Item Test Fixtures
 *
 * Provides standardized PlayerItem objects for testing equipment,
 * material application, crafting, and stat calculations.
 */

export interface AppliedMaterial {
  material_id: string;
  style_id: string;
  slot_index: number;
}

export interface ComputedStats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

export interface PlayerItem {
  id: string;
  base_type: 'sword' | 'offhand' | 'head' | 'armor' | 'boots' | 'accessory' | 'pet';
  level: number;
  applied_materials: AppliedMaterial[];
  computed_stats: ComputedStats;
  material_combo_hash: string | null;
  generated_image_url: string | null;
  image_generation_status: 'pending' | 'generating' | 'complete' | 'failed' | null;
  craft_count: number;
  is_styled: boolean;
}

/**
 * Base level 1 sword with no materials applied
 */
export const BASE_SWORD: PlayerItem = {
  id: '4637f636-0b6a-4825-b1aa-492cf8d9d1bb',
  base_type: 'sword',
  level: 1,
  applied_materials: [],
  computed_stats: {
    atkPower: 0.6,
    atkAccuracy: 0.4,
    defPower: 0.0,
    defAccuracy: 0.0
  },
  material_combo_hash: null,
  generated_image_url: null,
  image_generation_status: null,
  craft_count: 0,
  is_styled: false
};

/**
 * Base level 1 offhand shield with defensive stats
 */
export const BASE_SHIELD: PlayerItem = {
  id: '63d218fc-5cd9-4404-9090-fb72537da205',
  base_type: 'offhand',
  level: 1,
  applied_materials: [],
  computed_stats: {
    atkPower: 0.0,
    atkAccuracy: 0.0,
    defPower: 0.7,
    defAccuracy: 0.3
  },
  material_combo_hash: null,
  generated_image_url: null,
  image_generation_status: null,
  craft_count: 0,
  is_styled: false
};

/**
 * Crafted sword with 2 materials applied (iron + crystal)
 */
export const CRAFTED_SWORD: PlayerItem = {
  id: '19cd32dc-e874-4836-a3e9-851431262cc8',
  base_type: 'sword',
  level: 5,
  applied_materials: [
    {
      material_id: 'iron',
      style_id: 'normal',
      slot_index: 0
    },
    {
      material_id: 'crystal',
      style_id: 'normal',
      slot_index: 1
    }
  ],
  computed_stats: {
    atkPower: 0.75,
    atkAccuracy: 0.55,
    defPower: 0.15,
    defAccuracy: 0.05
  },
  material_combo_hash: 'abc123def456',
  generated_image_url: 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/crafted_sword.png',
  image_generation_status: 'complete',
  craft_count: 2,
  is_styled: false
};

/**
 * Item with non-normal style_id for testing style system
 */
export const STYLED_ITEM: PlayerItem = {
  id: 'beb6ea68-597a-4052-92f6-ad73d0fd02b3',
  base_type: 'armor',
  level: 3,
  applied_materials: [
    {
      material_id: 'crystal',
      style_id: 'pixel_art',
      slot_index: 0
    }
  ],
  computed_stats: {
    atkPower: 0.1,
    atkAccuracy: 0.1,
    defPower: 0.6,
    defAccuracy: 0.2
  },
  material_combo_hash: 'style789xyz',
  generated_image_url: 'https://pub-1f07f440a8204e199f8ad01009c67cf5.r2.dev/items/pixel_armor.png',
  image_generation_status: 'complete',
  craft_count: 1,
  is_styled: true
};

/**
 * Create custom item with property overrides
 *
 * @param overrides - Partial item properties to override defaults
 * @returns PlayerItem object with merged properties
 */
export function createItem(overrides: Partial<PlayerItem> = {}): PlayerItem {
  return { ...BASE_SWORD, ...overrides };
}