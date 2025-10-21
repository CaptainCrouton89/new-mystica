/**
 * API Types for New Mystica Backend
 *
 * TypeScript interfaces for API request/response DTOs and domain models.
 * These types are used across controllers, services, and database layers.
 */

// ============================================================================
// Core Domain Models
// ============================================================================

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  gold: number;
  vanity_level: number;
  avg_item_level: number;
  created_at: string;
  updated_at: string;
}

/**
 * Player-owned item instance
 */
export interface Item {
  id: string;
  user_id: string;
  item_type_id: string;
  level: number;
  base_stats: Stats;
  current_stats: Stats;
  material_combo_hash?: string;
  image_url?: string;
  materials?: AppliedMaterial[];
  item_type?: ItemType;
  created_at: string;
  updated_at: string;
}

/**
 * Item template/blueprint from seed data
 */
export interface ItemType {
  id: string;
  name: string;
  category: 'weapon' | 'shield' | 'head' | 'armor' | 'feet' | 'accessory' | 'pet';
  equipment_slot: EquipmentSlot;
  base_stats: Stats;
  rarity: Rarity;
  image_url?: string;
  description?: string;
}

/**
 * Material template from seed data
 */
export interface Material {
  id: string;
  name: string;
  rarity: Rarity;
  stat_modifiers: Stats;
  image_url?: string;
  description?: string;
}

/**
 * Applied material instance on an item
 */
export interface AppliedMaterial {
  id: string;
  material_id: string;
  is_shiny: boolean;
  slot_index: number;
  material: Material;
}

/**
 * Stackable material inventory entry
 */
export interface MaterialStack {
  id: string;
  user_id: string;
  material_id: string;
  is_shiny: boolean;
  quantity: number;
  material: Material;
}

/**
 * Item stack for inventory management
 */
export interface ItemStack {
  item_id: string;
  quantity: number;
  item?: Item;
}

// ============================================================================
// Stats and Equipment
// ============================================================================

/**
 * Core stat structure for items and calculations
 */
export interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

/**
 * Equipment slot types
 */
export type EquipmentSlot =
  | 'weapon'
  | 'shield'
  | 'head'
  | 'armor'
  | 'feet'
  | 'accessory_1'
  | 'accessory_2'
  | 'pet';

/**
 * Complete equipment loadout (8 slots)
 */
export interface EquipmentSlots {
  weapon?: Item;
  shield?: Item;
  head?: Item;
  armor?: Item;
  feet?: Item;
  accessory_1?: Item;
  accessory_2?: Item;
  pet?: Item;
}

/**
 * Aggregated player stats from all equipped items
 */
export interface PlayerStats {
  total_stats: Stats;
  item_contributions: Record<EquipmentSlot, Stats>;
  equipped_items_count: number;
  total_item_level: number;
}

// ============================================================================
// Common Enums and Types
// ============================================================================

/**
 * Item and material rarity levels
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Combat session status
 */
export type CombatStatus = 'active' | 'victory' | 'defeat' | 'abandoned';

/**
 * Location types for content generation
 */
export type LocationType = 'forest' | 'cave' | 'ruins' | 'tower' | 'dungeon';

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Equipment operation result
 */
export interface EquipResult {
  success: boolean;
  unequipped_item?: Item;
  equipped_item: Item;
  updated_player_stats: PlayerStats;
  message?: string;
}

/**
 * Material application result
 */
export interface ApplyMaterialResult {
  success: boolean;
  updated_item: Item;
  is_first_craft: boolean;
  craft_count: number;
  image_url: string;
  materials_consumed: MaterialStack[];
  message?: string;
}

/**
 * Material replacement result
 */
export interface ReplaceMaterialResult {
  success: boolean;
  updated_item: Item;
  gold_spent: number;
  replaced_material: AppliedMaterial;
  refunded_material?: MaterialStack;
  message?: string;
}

/**
 * Item upgrade result
 */
export interface UpgradeResult {
  success: boolean;
  updated_item: Item;
  gold_spent: number;
  new_level: number;
  stat_increase: Stats;
  message?: string;
}

/**
 * Inventory response
 */
export interface InventoryResponse {
  items: Item[];
  material_stacks: MaterialStack[];
  total_items: number;
  total_materials: number;
  storage_capacity: {
    items_used: number;
    items_max: number;
    materials_used: number;
    materials_max: number;
  };
}

/**
 * Combat session data
 */
export interface CombatSession {
  id: string;
  user_id: string;
  location_id: string;
  monster_id: string;
  status: CombatStatus;
  player_hp: number;
  monster_hp: number;
  turn_count: number;
  started_at: string;
  completed_at?: string;
}

/**
 * Combat action result
 */
export interface CombatActionResult {
  success: boolean;
  session: CombatSession;
  damage_dealt?: number;
  damage_received?: number;
  is_critical?: boolean;
  session_complete?: boolean;
  rewards?: CombatRewards;
  message: string;
}

/**
 * Combat completion rewards
 */
export interface CombatRewards {
  gold_earned: number;
  items_found: Item[];
  materials_found: MaterialStack[];
  experience_gained: number;
}

// ============================================================================
// Request DTOs
// ============================================================================

/**
 * Equipment operation request
 */
export interface EquipmentRequest {
  item_id: string;
  slot: EquipmentSlot;
}

/**
 * Material application request
 */
export interface ApplyMaterialRequest {
  material_id: string;
  is_shiny: boolean;
  slot_index: number; // 0-2 for material slots
}

/**
 * Material replacement request
 */
export interface ReplaceMaterialRequest {
  slot_index: number;
  new_material_id: string;
  is_shiny: boolean;
}

/**
 * Item upgrade request
 */
export interface UpgradeItemRequest {
  target_level: number;
}

/**
 * Combat action request
 */
export interface CombatActionRequest {
  action: 'attack' | 'defend' | 'special';
  target?: string;
}

/**
 * Location search request
 */
export interface LocationSearchRequest {
  latitude: number;
  longitude: number;
  radius_km?: number;
  location_type?: LocationType;
  limit?: number;
}

// ============================================================================
// Image Generation Types
// ============================================================================

/**
 * Image generation request
 */
export interface ImageGenerationRequest {
  item_type_id: string;
  materials: Array<{
    material_id: string;
    is_shiny: boolean;
  }>;
  style_references?: string[];
}

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  success: boolean;
  image_url: string;
  generation_time_ms: number;
  cache_hit: boolean;
  provider: 'replicate' | 'openai';
  prompt_used?: string;
}

// ============================================================================
// Pagination and Filtering
// ============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Filter options for inventory queries
 */
export interface InventoryFilters {
  item_type_category?: string;
  rarity?: Rarity;
  min_level?: number;
  max_level?: number;
  has_materials?: boolean;
  material_count?: number;
  search?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{
    item: any;
    error: string;
  }>;
  total_processed: number;
  success_count: number;
  failure_count: number;
}