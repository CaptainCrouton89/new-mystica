/**
 * Repository layer type definitions
 *
 * This file contains TypeScript interfaces and types for the repository layer.
 * Repositories are responsible for data access and persistence operations.
 */

import { AppliedMaterial, Material, MaterialStack, Stats } from './api.types';
import { Database } from './database.types';

// Re-export API types for repository use
export { AppliedMaterial, Material, MaterialStack, Stats };

// ============================================================================
// Base Repository Types
// ============================================================================

/**
 * Query filter type for common repository operations
 */
export type QueryFilter = Record<string, any>;

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Sort parameters for ordered queries
 */
export interface SortParams {
  orderBy: string;
  ascending?: boolean;
}

// ============================================================================
// Item Repository Types
// ============================================================================

/**
 * Complete item data with all related entities
 */
export interface ItemWithDetails {
  id: string;
  user_id: string;
  item_type_id: string;
  level: number;
  is_styled: boolean;
  current_stats: Stats;
  material_combo_hash: string | null;
  generated_image_url: string | null;
  image_generation_status: 'pending' | 'generating' | 'complete' | 'failed' | null;
  name: string;           // Custom instance name
  description: string;    // Custom instance description
  created_at: string;

  // Related entities
  item_type: {
    id: string;
    name: string;
    category: string;
    base_stats_normalized: Stats;
    rarity: Database['public']['Enums']['rarity'];
    description: string;
  };

  materials: AppliedMaterial[];
}

/**
 * Item data with applied materials
 */
export interface ItemWithMaterials {
  id: string;
  user_id: string;
  item_type_id: string;
  level: number;
  materials: AppliedMaterial[];
}

/**
 * Item creation data
 */
export interface CreateItemData {
  user_id: string;
  item_type_id: string;
  level?: number;
}

/**
 * Item update data
 */
export interface UpdateItemData {
  level?: number;
  is_styled?: boolean;
  current_stats?: Stats;
  material_combo_hash?: string | null;
  generated_image_url?: string | null;
  image_generation_status?: 'pending' | 'generating' | 'complete' | 'failed';
  name?: string;           // Custom instance name
  description?: string;    // Custom instance description
}

// ============================================================================
// Material Repository Types
// ============================================================================

/**
 * Material instance (applied to items)
 */
export interface MaterialInstance {
  id: string;
  user_id: string;
  material_id: string;
  style_id: string;
  created_at: string;
}

/**
 * Material instance with template data
 */
export interface MaterialInstanceWithTemplate {
  id: string;
  user_id: string;
  material_id: string;
  style_id: string;
  created_at: string;

  // Template data
  material: Material;
}

/**
 * Material stack creation data
 */
export interface CreateMaterialStackData {
  user_id: string;
  material_id: string;
  style_id: string;
  quantity: number;
}

/**
 * Material instance creation data
 */
export interface CreateMaterialInstanceData {
  user_id: string;
  material_id: string;
  style_id: string;
}

/**
 * Applied material data for ItemMaterials junction
 */
export interface ApplyMaterialData {
  item_id: string;
  material_instance_id: string;
  slot_index: number;
}

// ============================================================================
// Equipment Repository Types
// ============================================================================

/**
 * Equipment slot assignment data
 */
export interface EquipmentSlotAssignment {
  user_id: string;
  slot_name: string;
  item_id: string | null;
  equipped_at?: string;
}

/**
 * Bulk equipment update for loadout activation
 */
export interface BulkEquipmentUpdate {
  weapon?: string | null;
  offhand?: string | null;
  head?: string | null;
  armor?: string | null;
  feet?: string | null;
  accessory_1?: string | null;
  accessory_2?: string | null;
  pet?: string | null;
}

// ============================================================================
// Profile Repository Types
// ============================================================================

/**
 * Currency balance update data
 */
export interface CurrencyBalanceUpdate {
  user_id: string;
  currency_code: 'GOLD' | 'GEMS';
  amount: number; // positive for add, negative for deduct
}

/**
 * Economy transaction data for logging
 */
export interface EconomyTransactionData {
  user_id: string;
  transaction_type: 'source' | 'sink';
  currency: 'GOLD' | 'GEMS';
  amount: number; // positive for source, negative for sink
  balance_after: number;
  source_type: string; // 'combat_victory', 'item_upgrade', 'material_replacement', etc.
  source_id?: string | null; // UUID of related entity
  metadata?: Record<string, any>; // flexible JSONB payload
}

/**
 * Player progression update data
 */
export interface PlayerProgressionUpdate {
  xp?: number;
  level?: number;
  xp_to_next_level?: number;
  last_level_up_at?: string;
}

// ============================================================================
// Location Repository Types
// ============================================================================

/**
 * Location with distance metadata
 */
export interface LocationWithDistance {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location_type: string;
  state_code: string;
  country_code: string;
  image_url: string;
  distance_meters: number;
}

/**
 * Enemy pool member with spawn weight
 */
export interface EnemyPoolMember {
  enemy_pool_id: string;
  enemy_type_id: string;
  spawn_weight: number;
}

/**
 * Loot pool entry with drop weight
 */
export interface LootPoolEntry {
  loot_pool_id: string;
  lootable_type: 'material' | 'item_type';
  lootable_id: string;
  drop_weight: number;
}

// ============================================================================
// Loadout Repository Types
// ============================================================================

/**
 * Loadout with slot assignments
 */
export interface LoadoutWithSlots {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  slots: {
    weapon: string | null;
    offhand: string | null;
    head: string | null;
    armor: string | null;
    feet: string | null;
    accessory_1: string | null;
    accessory_2: string | null;
    pet: string | null;
  };
}

/**
 * Loadout creation data
 */
export interface CreateLoadoutData {
  user_id: string;
  name: string;
  is_active?: boolean;
}

/**
 * Loadout slot assignments (for bulk update)
 */
export interface LoadoutSlotAssignments {
  weapon?: string | null;
  offhand?: string | null;
  head?: string | null;
  armor?: string | null;
  feet?: string | null;
  accessory_1?: string | null;
  accessory_2?: string | null;
  pet?: string | null;
}

// ============================================================================
// Combat Repository Types
// ============================================================================

/**
 * Combat session data (Redis + PostgreSQL)
 */
export interface CombatSessionData {
  id: string;
  user_id: string;
  location_id: string;
  combat_level: number;
  enemy_type_id: string;
  applied_enemy_pools: string[]; // JSON array of pool IDs
  applied_loot_pools: string[]; // JSON array of pool IDs
  player_equipped_items_snapshot: Record<string, any>; // JSON snapshot
  player_rating: number | null;
  enemy_rating: number | null;
  win_prob_est: number | null;
  combat_log: any[]; // JSON array of combat events (legacy)
  outcome: Database['public']['Enums']['combat_result'] | null;
  rewards: any[] | null; // JSON array of rewards
  created_at: string;
  updated_at: string;
}

/**
 * Combat log event (normalized structure)
 */
export interface CombatLogEventData {
  combat_id: string;
  seq: number; // turn sequence number
  ts: string; // timestamp
  actor: Database['public']['Enums']['actor']; // 'player', 'enemy', 'system'
  event_type: string; // 'attack', 'defend', 'critical_hit', 'miss', etc.
  value_i: number | null; // integer value (damage, etc.)
  payload: Record<string, any> | null; // flexible JSONB
}

/**
 * Player combat history data
 */
export interface PlayerCombatHistoryData {
  user_id: string;
  location_id: string;
  total_attempts: number;
  victories: number;
  defeats: number;
  current_streak: number;
  longest_streak: number;
  last_attempt: string;
}

/**
 * Loot drop result
 */
export interface LootDrop {
  type: 'material' | 'item' | 'gold';
  material_id?: string;
  material_name?: string;
  item_type_id?: string;
  item_type_name?: string;
  gold_amount?: number;
  style_id?: string; // inherited from enemy
  quantity?: number;
}

// ============================================================================
// Image Cache Repository Types
// ============================================================================

/**
 * Item image cache entry
 */
export interface ItemImageCacheEntry {
  id: string;
  item_type_id: string;
  combo_hash: string;
  image_url: string;
  craft_count: number;
  provider: string | null; // 'gemini', 'seedream', etc.
  created_at: string;
}

/**
 * Image cache creation data
 */
export interface CreateImageCacheData {
  item_type_id: string;
  combo_hash: string;
  image_url: string;
  provider: string;
}

// ============================================================================
// Weapon Repository Types
// ============================================================================

/**
 * Weapon degree configuration for hit bands
 */
export interface DegreeConfig {
  deg_injure: number;
  deg_miss: number;
  deg_graze: number;
  deg_normal: number;
  deg_crit: number;
}

/**
 * Adjusted weapon bands after accuracy calculation
 */
export interface AdjustedBands {
  deg_injure: number;
  deg_miss: number;
  deg_graze: number;
  deg_normal: number;
  deg_crit: number;
  total_degrees: number;
}

/**
 * Weapon creation data
 */
export interface CreateWeaponData {
  item_id: string;
  pattern: Database['public']['Enums']['weapon_pattern'];
  spin_deg_per_s?: number;
  deg_injure?: number;
  deg_miss?: number;
  deg_graze?: number;
  deg_normal?: number;
  deg_crit?: number;
}

/**
 * Weapon update data
 */
export interface UpdateWeaponData {
  pattern?: Database['public']['Enums']['weapon_pattern'];
  spin_deg_per_s?: number;
  deg_injure?: number;
  deg_miss?: number;
  deg_graze?: number;
  deg_normal?: number;
  deg_crit?: number;
}

/**
 * Weapon with item details
 */
export interface WeaponWithItem {
  item_id: string;
  pattern: Database['public']['Enums']['weapon_pattern'];
  spin_deg_per_s: number;
  deg_injure: number;
  deg_miss: number;
  deg_graze: number;
  deg_normal: number;
  deg_crit: number;

  // Item details
  item: {
    id: string;
    user_id: string;
    item_type_id: string;
    level: number;
    is_styled: boolean;
    name?: string;           // Custom instance name
    description?: string;    // Custom instance description
    created_at: string;
  };
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Repository transaction context for multi-step operations
 */
export interface RepositoryTransaction {
  execute<T>(operations: () => Promise<T>): Promise<T>;
  rollback(): Promise<void>;
  commit(): Promise<void>;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolationLevel?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  timeout?: number; // milliseconds
}
