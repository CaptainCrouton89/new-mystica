import { Database } from '../../types/database.types.js';
import { Stats } from '../../types/api.types.js';
import { AdjustedBands } from '../../types/repository.types.js';

export type CombatResult = Database['public']['Enums']['combat_result'];
export type HitBand = Database['public']['Enums']['hit_band'];
export type WeaponPattern = Database['public']['Enums']['weapon_pattern'];

export type LootRewards = {
  currencies: { gold: number };
  materials: Array<{
    material_id: string;
    name: string;
    style_id: string;
    style_name: string;
    image_url: string;
  }>;
  items: Array<{
    item_type_id: string;
    name: string;
    category: string;
    rarity: string;
    style_id: string;
    style_name: string;
  }>;
  experience: number;
};

export type EnemyLootEntry = {
  material_id?: string;
  item_type_id?: string;
  lootable_type: 'material' | 'item_type';
  drop_weight: number;
  style_id?: string;
};

export type LootDetails = {
  type: 'material' | 'item_type';
  id: string;
  name: string;
  category?: string;
  rarity?: string;
  style_id: string;
  style_name: string;
  image_url?: string;
};

export interface CombatSession {
  session_id: string;
  player_id: string;
  enemy_id: string;
  status: 'active';
  player_hp: number;
  enemy_hp: number;
  enemy: {
    id: string;
    type: string;
    name: string;
    level: number;
    atk_power: number;
    atk_accuracy: number;
    def_power: number;
    def_accuracy: number;
    hp: number;
    style_id: string;
    dialogue_tone: string;
    personality_traits: string[];
  };
  player_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
    hp: number;
  };
  weapon_config: {
    pattern: WeaponPattern;
    spin_deg_per_s: number;
    adjusted_bands: {
      deg_injure: number;
      deg_miss: number;
      deg_graze: number;
      deg_normal: number;
      deg_crit: number;
    };
  };
}

export interface AttackResult {
  player_damage: {
    zone: 1 | 2 | 3 | 4 | 5;
    zone_multiplier: number;
    crit_occurred: boolean;
    crit_multiplier: number | null;
    final_damage: number;
  };
  enemy_damage: {
    zone: 1 | 2 | 3 | 4 | 5;
    zone_multiplier: number;
    crit_occurred: boolean;
    crit_multiplier: number | null;
    final_damage: number;
  };
  player_hp_remaining: number;
  enemy_hp_remaining: number;
  combat_status: 'ongoing' | 'victory' | 'defeat';
  turn_number: number;
  rewards: CombatRewards | null;
}

export interface DefenseResult {
  player_damage: {
    zone: 1 | 2 | 3 | 4 | 5;
    zone_multiplier: number;
    crit_occurred: boolean;
    crit_multiplier: number | null;
    final_damage: number;
  };
  enemy_damage: {
    zone: 1 | 2 | 3 | 4 | 5;
    zone_multiplier: number;
    crit_occurred: boolean;
    crit_multiplier: number | null;
    final_damage: number;
  };
  player_hp_remaining: number;
  enemy_hp_remaining: number;
  combat_status: 'ongoing' | 'victory' | 'defeat';
  turn_number: number;
  rewards: CombatRewards | null;
}

export interface CombatRewards {
  result: 'victory' | 'defeat';
  currencies?: {
    gold: number;
  };
  materials?: Array<{
    material_id: string;
    name: string;
    style_id: string;
    style_name: string;
  }>;
  items?: Array<{
    id: string;
    item_type_id: string;
    name: string;
    category: string;
    rarity: string;
    style_id: string;
    style_name: string;
    generated_image_url: string | null;
  }>;
  experience?: number;
  combat_history: {
    location_id: string;
    total_attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
    longest_streak: number;
  };
}

export interface PlayerStats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
  hp: number;
}

export interface EnemyStats {
  
  atk_power: number;
  atk_accuracy: number;
  def_power: number;
  def_accuracy: number;
  
  hp: number;
  
  atk_power_normalized: number;
  atk_accuracy_normalized: number;
  def_power_normalized: number;
  def_accuracy_normalized: number;
  
  style_id: string;
  dialogue_tone: string;
  personality_traits: string[];
}

export interface WeaponConfig {
  pattern: WeaponPattern;
  spin_deg_per_s: number;
  adjusted_bands: AdjustedBands;
}

export interface EquipmentSnapshot {
  total_stats: PlayerStats;
  equipped_items: Record<string, {
    item_id: string;
    item_type_id: string;
    level: number;
    current_stats: Stats;
    applied_materials?: Array<{material_id: string, slot_index: number}>;
  }>;
  snapshot_timestamp: string;
}
