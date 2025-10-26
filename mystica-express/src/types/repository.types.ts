/**
 * Repository layer type definitions
 *
 * This file contains TypeScript interfaces and types for the repository layer.
 * Repositories are responsible for data access and persistence operations.
 */

import { Stats } from './api.types';
import { Database } from './database.types';

// Re-export API types for repository use
export { Stats };

// Helper types for database table access
type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

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
 * Item data with applied materials
 */
export type ItemWithMaterials = Tables<'items'> & {
  item_type: Tables<'itemtypes'>;
  materials: (Tables<'materialinstances'> & {
    materials: Tables<'materials'>;
    slot_index: number;
  })[];
};

/**
 * Item with full details (alias for ItemWithMaterials)
 */
export type ItemWithDetails = ItemWithMaterials;

/**
 * Item creation data
 */
export type CreateItemData = Pick<TablesInsert<'items'>, 'user_id' | 'item_type_id' | 'level' | 'rarity'>;

/**
 * Item update data
 */
export type UpdateItemData = Partial<Pick<TablesUpdate<'items'>, 'level' | 'name' | 'description' | 'generated_image_url' | 'image_generation_status' | 'material_combo_hash' | 'lat' | 'lng'>>;

/**
 * Material instance with template data
 */
export type MaterialInstanceWithTemplate = Tables<"materialinstances"> & {
  material: Tables<"materials"> & { stat_modifiers: Stats };
};

// ============================================================================
// Equipment Repository Types
// ============================================================================

export type WeaponWithItem = Tables<'weapons'> & Tables<'items'> & Tables<'itemtypes'>;
/**
 * Equipment slot assignment data
 */
export type EquipmentSlotAssignment = Tables<'userequipment'>;

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
export type EconomyTransactionData = Omit<TablesInsert<'economytransactions'>, 'id' | 'created_at'> & {
  transaction_type: 'source' | 'sink';
  currency: 'GOLD' | 'GEMS';
};

/**
 * Player progression update data
 */
export type PlayerProgressionUpdate = Partial<Pick<TablesUpdate<'playerprogression'>, 'xp' | 'level' | 'xp_to_next_level' | 'last_level_up_at'>>;

// ============================================================================
// Location Repository Types
// ============================================================================

/**
 * Location with distance metadata
 * Note: Some fields are non-null in this context (name, location_type, etc.) even though nullable in DB
 */
export type LocationWithDistance = Required<
  Pick<Tables<'locations'>, 'id' | 'name' | 'lat' | 'lng' | 'location_type' | 'state_code' | 'country_code' | 'image_url' | 'background_image_url'>
> & {
  distance_meters: number;
};

/**
 * Enemy pool member with spawn weight
 */
export type EnemyPoolMember = Pick<Tables<'enemypoolmembers'>, 'enemy_pool_id' | 'enemy_type_id' | 'spawn_weight'>;

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
export type LoadoutWithSlots = Tables<'loadouts'> & {
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
};

/**
 * Loadout creation data
 */
export interface CreateLoadoutData extends Omit<Database['public']['Tables']['loadouts']['Insert'], 'id' | 'created_at' | 'updated_at'> {}

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
 * Note: applied_enemy_pools is Json in DB but treated as string[] in application layer
 */
export type CombatSessionData = Omit<Tables<'combatsessions'>, 'applied_enemy_pools' | 'enemy_style_id'> & {
  applied_enemy_pools: string[]; // JSON array of pool IDs
  applied_loot_pools?: string[]; // JSON array of pool IDs (optional extension)
};

/**
 * Combat log event (normalized structure)
 */
export type CombatLogEventData = Omit<Tables<'combatlogevents'>, 'id'>;

/**
 * Player combat history data
 */
export type PlayerCombatHistoryData = Tables<'playercombathistory'>;

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
 * Image cache creation data
 */
export type CreateImageCacheData = Pick<TablesInsert<'itemimagecache'>, 'item_type_id' | 'combo_hash' | 'image_url' | 'provider'>;

// ============================================================================
// Weapon Repository Types
// ============================================================================

/**
 * Weapon degree configuration for hit bands
 */
export type DegreeConfig = Pick<Tables<'weapons'>, 'deg_injure' | 'deg_miss' | 'deg_graze' | 'deg_normal' | 'deg_crit'>;

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
