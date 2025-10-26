/**
 * API Types for New Mystica Backend
 *
 * TypeScript interfaces for API request/response DTOs and domain models.
 * These types are used across controllers, services, and database layers.
 */

import { Database } from './database.types';

// Helper types for database table access
type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

// ============================================================================
// Core Domain Models
// ============================================================================

/**
 * User profile information
 */
export interface UserProfile {
  id: string;           // UUID
  email: string | null; // null for anonymous accounts
  device_id: string | null;
  account_type: 'anonymous' | 'email';
  username: string | null;
  vanity_level: number; // Sum of equipped item levels
  avg_item_level: number; // Average level of equipped items
  gold: number;         // From UserCurrencyBalances
  gems: number;         // From UserCurrencyBalances
  total_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  level: number;        // From PlayerProgression
  xp: number;          // From PlayerProgression
  created_at: string;
  last_login: string;
}


/**
 * Detailed material stack with full material data (used internally by MaterialService)
 */
export interface MaterialStackDetailed {
  id: string;
  user_id: string;
  material_id: string;
  style_id: string;
  display_name?: string; // Human-readable style display name
  quantity: number;
  material: Tables<'materials'>;
}

/**
 * Material stack for inventory display (simplified)
 */
export interface MaterialStack {
  material_id: string;
  material_name: string;
  style_id: string;
  display_name: string;
  quantity: number;
  is_styled: boolean;
}

/**
 * Applied material on an item (simplified view)
 */
export interface AppliedMaterial {
  id: string;
  material_id: string;
  name: string;
  slot_index?: number;
  stat_modifiers?: Stats;
  style_id: string | null;
}

/**
 * Item with details for API responses
 */
export interface Item {
  id: string;
  user_id: string;
  item_type_id: string;
  level: number;
  base_stats: Stats;
  material_combo_hash?: string;
  image_url?: string;
  is_styled?: boolean;
  materials?: AppliedMaterial[];
  item_type?: {
    id: string;
    name: string;
    category: string;
    equipment_slot: EquipmentSlot;
    base_stats: Stats;
    rarity: Rarity;
    description?: string;
  };
  created_at: string;
  updated_at: string;
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
  [key: string]: number;
}

/**
 * Equipment slot types
 */
export type EquipmentSlot =
  | 'weapon'
  | 'offhand'
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
  weapon?: Tables<'items'>;
  offhand?: Tables<'items'>;
  head?: Tables<'items'>;
  armor?: Tables<'items'>;
  feet?: Tables<'items'>;
  accessory_1?: Tables<'items'>;
  accessory_2?: Tables<'items'>;
  pet?: Tables<'items'>;
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
 * Rarity definition from database
 */
export type RarityDefinition = Tables<'raritydefinitions'>;

/**
 * API response for GET /rarities
 */
export interface GetRaritiesResponse {
  success: true;
  rarities: RarityDefinition[];
}

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
  unequipped_item?: Tables<'items'>;
  equipped_item: Tables<'items'>;
  slot: EquipmentSlot;
  updated_player_stats: PlayerStats;
  message?: string;
}

/**
 * Material application result
 */
export interface ApplyMaterialResult {
  success: boolean;
  updated_item: Tables<'items'>;
  is_first_craft: boolean;
  craft_count: number;
  image_url: string;
  materials_consumed: MaterialStackDetailed[];
  message?: string;
}

/**
 * Material replacement result
 */
export interface ReplaceMaterialResult {
  success: boolean;
  updated_item: Tables<'items'>;
  gold_spent: number;
  replaced_material: Tables<'itemmaterials'>;
  refunded_material?: MaterialStackDetailed;
  message?: string;
}

/**
 * Item upgrade result
 */
export interface UpgradeResult {
  success: boolean;
  updated_item: Item;
  computed_stats: Stats;
  gold_spent: number;
  new_gold_balance: number;
  new_vanity_level: number;
}

/**
 * Inventory response
 */
export interface InventoryResponse {
  items: Tables<'items'>[];
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
  location?: {
    id: string;
    name: string | null;
    location_type: string | null;
    background_image_url: string | null;
    image_url: string | null;
  };
}

/**
 * Combat initialization response from startCombat
 * Includes full session, player, enemy, and location details
 */
export interface CombatStartResponse {
  session_id: string;
  player_id: string;
  enemy_id: string;
  status: 'active';
  player_hp: number;
  enemy_hp: number;
  location: {
    id: string;
    name: string | null;
    location_type: string | null;
    background_image_url: string | null;
    image_url: string | null;
  };
  enemy: {
    id: string;
    name: string;
    image_url: string | null;
    style_id: string;
    atk_power: number;
    atk_accuracy: number;
    def_power: number;
    def_accuracy: number;
    hp: number;
  };
  player_stats: {
    hp: number;
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  weapon_config: {
    pattern: string;
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
 * Combat completion rewards with style inheritance
 */
export interface CombatRewards {
  result: 'victory' | 'defeat';
  /** Currency rewards (only present for victory) */
  currencies?: {
    gold: number;
  };
  /** Material drops with style inheritance from enemy (only present for victory) */
  materials?: Array<{
    material_id: string;
    name: string;
    style_id: string;
    display_name: string;
  }>;
  /** Item drops from loot pools with full details (only present for victory) */
  items?: Array<{
    id: string;
    item_type_id: string;
    name: string;
    category: string;
    rarity: string;
    style_id: string;
    display_name: string;
    generated_image_url: string | null;
  }>;
  /** Experience points earned from combat (only present for victory) */
  experience?: number;
  /** Updated combat statistics for this location */
  combat_history: {
    location_id: string;
    total_attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
    longest_streak: number;
  };
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
  style_id: string;
  slot_index: number; // 0-2 for material slots
}

/**
 * Material replacement request
 */
export interface ReplaceMaterialRequest {
  slot_index: number;
  new_material_id: string;
  new_style_id: string;
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
    style_id: string;
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

// ============================================================================
// Chatter Types (F-11, F-12)
// ============================================================================

/**
 * Pet chatter event types (F-11)
 */
export type PetChatterEventType =
  | 'player_attack'
  | 'player_defense'
  | 'enemy_attack'
  | 'enemy_defense'
  | 'critical_hit'
  | 'miss'
  | 'victory'
  | 'defeat';

/**
 * Enemy chatter event types (F-12)
 */
export type EnemyChatterEventType =
  | 'combat_start'
  | 'player_attacks'
  | 'enemy_attacks'
  | 'low_player_hp'
  | 'near_victory'
  | 'defeat'
  | 'victory';

/**
 * Combat event details for chatter generation
 */
/**
 * Pet personality template
 */
export interface PetPersonality {
  personality_type: string;
  display_name: string;
  description: string;
  traits: string[];
  example_phrases: string[];
  verbosity: 'terse' | 'moderate' | 'verbose';
}

/**
 * Enemy type with personality traits
 */
export interface EnemyType {
  type: string;
  display_name: string;
  personality_traits: string[];
  dialogue_tone: 'aggressive' | 'sarcastic' | 'condescending' | 'chaotic' | 'political';
  tier_id: number;
  // Note: style_id not on enemytypes table - use enemytypestyles join table for style variants
}

/**
 * Player combat history for context
 */
export interface PlayerCombatHistory {
  attempts: number;
  victories: number;
  defeats: number;
  current_streak: number;
}

/**
 * Pet chatter response (F-11)
 */
export interface ChatterResponse {
  dialogue: string;
  personality_type: string;
  generation_time_ms: number;
  was_ai_generated: boolean;
}

/**
 * Enemy chatter response (F-12)
 */
export interface EnemyChatterResponse extends ChatterResponse {
  enemy_type: string;
  dialogue_tone: string;
  player_context_used: PlayerCombatHistory;
}

/**
 * Personality assignment result
 */
export interface PersonalityAssignmentResult {
  success: boolean;
  pet_id: string;
  personality_type: string;
  custom_name?: string;
}

/**
 * Chatter metadata for analytics
 */
export interface ChatterMetadata {
  eventType: string;
  personalityType?: string;
  enemyType?: string;
  dialogueTone?: string;
  wasAIGenerated: boolean;
  generationTime: number;
  playerContextUsed?: PlayerCombatHistory;
  fallbackReason?: string;
}

// ============================================================================
// Economy Types
// ============================================================================

/**
 * Currency operation result
 */
export interface CurrencyOperationResult {
  success: boolean;
  previousBalance: number;
  newBalance: number;
  transactionId: string;
  currency: 'GOLD' | 'GEMS';
  amount: number;
}

/**
 * All currency balances for a user
 */
export interface CurrencyBalances {
  GOLD: number;
  GEMS: number;
}

/**
 * Affordability check result
 */
export interface AffordabilityResult {
  canAfford: boolean;
  currentBalance: number;
  requiredAmount: number;
  shortfall: number; // 0 if can afford
}

/**
 * Transaction source types (currency addition)
 */
export type TransactionSourceType =
  | 'combat_victory'
  | 'daily_quest'
  | 'achievement'
  | 'iap'
  | 'admin'
  | 'profile_init'
  | 'level_reward';

/**
 * Transaction sink types (currency deduction)
 */
export type TransactionSinkType =
  | 'item_upgrade'
  | 'material_replacement'
  | 'shop_purchase'
  | 'loadout_slot_unlock';

// ============================================================================
// Style Types (F-04, F-05)
// ============================================================================

/**
 * Style definition from StyleDefinitions table
 */
export interface StyleDefinition {
  id: string;
  display_name: string;
  description: string | null;
  created_at: string;
}

/**
 * Style response for GET /styles endpoint
 */
export interface StyleResponse {
  styles: StyleDefinition[];
  total_count: number;
}

// ============================================================================
// Progression Types (F-08)
// ============================================================================

/**
 * Player progression status with calculated values
 */
export interface ProgressionStatus {
  user_id: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  xp_progress_percentage: number;
  level_rewards_available: LevelReward[];
}

/**
 * Result of XP award operation
 */
export interface ExperienceAwardResult {
  success: boolean;
  xp_awarded: number;
  old_level: number;
  new_level: number;
  leveled_up: boolean;
  progression: ProgressionStatus;
  analytics_events: AnalyticsEvent[];
}

/**
 * Level reward definition from LevelRewards table
 */
export type LevelReward = Omit<Tables<'levelrewards'>, 'created_at'>;

/**
 * Reward claim result
 */
export interface RewardClaimResult {
  level: number;
  reward_type: 'gold' | 'feature_unlock' | 'cosmetic';
  reward_amount: number;
  reward_description: string;
  new_gold_balance?: number;
  claimed_at: string;
  analytics_event?: AnalyticsEvent;
}

/**
 * Valid XP source types
 */
export type XPSourceType =
  | 'combat'
  | 'quest'
  | 'achievement'
  | 'daily_bonus'
  | 'admin';

/**
 * Analytics event for progression tracking
 */
export interface AnalyticsEvent {
  event_type: string;
  user_id: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// Zone-Based Combat System
// ============================================================================

/**
 * Detailed information about a zone hit, used in combat responses
 * Frontend uses these fields to display zone information and critical hit effects
 */
export interface ZoneHitInfo {
  /** The zone hit (1-5, from highest to lowest damage) */
  zone: 1 | 2 | 3 | 4 | 5;

  /** Multiplier applied to base damage for this zone (1.5x, 1.25x, 1.0x, 0.75x, 0.5x) */
  zone_multiplier: number;

  /** Whether a critical hit occurred (frontend uses this to trigger CRIT! animations) */
  crit_occurred: boolean;

  /** Critical hit multiplier (null if no crit, actual multiplier 1.0-2.0x if crit occurred) */
  crit_multiplier: number | null;

  /** Final calculated damage after zone and crit modifiers */
  final_damage: number;
}

/**
 * Distribution of zone probabilities based on enemy accuracy
 * Sum of all zones = 1.0 for probability calculations
 */
export type ZoneDistribution = {
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
};

/**
 * Realized (computed) enemy stats for a specific combat session at a given combat level
 * Formula: stat = normalized_stat × 8 × combat_level × tier.difficulty_multiplier
 * HP only: base_hp × tier.difficulty_multiplier (NO combat_level factor)
 */
export interface EnemyRealizedStats {
  /** Realized attack power stat (normalized × 8 × combat_level × tier × 10) */
  atk_power: number;

  /** Realized attack accuracy stat (normalized × 8 × combat_level × tier × 10) */
  atk_accuracy: number;

  /** Realized defense power stat (normalized × 8 × combat_level × tier × 10) */
  def_power: number;

  /** Realized defense accuracy stat (normalized × 8 × combat_level × tier × 10) */
  def_accuracy: number;

  /** HP (base_hp × tier.difficulty_multiplier, NO combat_level scaling) */
  hp: number;
}

/**
 * Polymorphic enemy loot table entry
 * lootable_type discriminates between material and item_type drops
 */
export type EnemyLoot = Omit<Tables<'enemyloot'>, 'created_at'>;

// ============================================================================
// Combat Dialogue System (F-12)
// ============================================================================

/**
 * Combat event types that trigger dialogue generation
 */
export type CombatEventType =
  | 'combat_start'
  | 'player_attacks'
  | 'enemy_attacks'
  | 'low_player_hp'
  | 'near_victory'
  | 'defeat'
  | 'victory';

/**
 * Detailed information about a combat event for dialogue generation
 */
export interface CombatEventDetails {
  damage?: number;
  accuracy?: number;
  is_critical?: boolean;
  turn_number: number;
  player_hp_pct: number;
  enemy_hp_pct: number;
  /** Zone hit by player (1=best, 5=worst/self-injury) */
  player_zone?: 1 | 2 | 3 | 4 | 5;
  /** Zone hit by enemy */
  enemy_zone?: 1 | 2 | 3 | 4 | 5;
  /** Player's action this turn */
  player_action?: 'attack' | 'defend';
}

/**
 * Player's historical combat performance for contextual dialogue
 */
export interface PlayerCombatContext {
  attempts: number;
  victories: number;
  defeats: number;
  current_streak: number;
}

/**
 * AI-generated dialogue response for combat events
 */
export interface DialogueResponse {
  dialogue: string;
  enemy_type: string;
  dialogue_tone: string;
  generation_time_ms: number;
  was_ai_generated: boolean;
  player_context_used: PlayerCombatContext;
}