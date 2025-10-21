/**
 * Combat Type Definitions for New Mystica Backend
 *
 * TypeScript interfaces for combat dialogue system and combat session management.
 * These types support the AI-generated combat dialogue feature and combat state tracking.
 */

// ============================================================================
// Combat Session and Events
// ============================================================================

/**
 * Combat session state and metadata
 */
export interface CombatSession {
  session_id: string;
  enemy_type_id: string;
  player_id: string;
  location_id: string;
  turn_number: number;
  player_hp: number;
  enemy_hp: number;
  max_player_hp: number;
  max_enemy_hp: number;
  created_at: string;
  updated_at: string;
}

/**
 * Detailed information about a specific combat event for dialogue generation
 */
export interface CombatEventDetails {
  damage: number;
  accuracy: number;
  is_critical: boolean;
  turn_number: number;
  player_hp_percentage: number;
  enemy_hp_percentage: number;
}

/**
 * Combat event types that trigger dialogue generation
 */
export type CombatEventType =
  | 'combat_start'
  | 'player_hit'
  | 'player_miss'
  | 'enemy_hit'
  | 'low_player_hp'
  | 'near_victory'
  | 'defeat'
  | 'victory';

// ============================================================================
// Player Combat Context
// ============================================================================

/**
 * Player's historical combat performance for contextual dialogue
 */
export interface PlayerCombatContext {
  attempts: number;
  victories: number;
  defeats: number;
  current_streak: number;
}

// ============================================================================
// AI Dialogue Generation
// ============================================================================

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

// ============================================================================
// Combat API Request/Response Types
// ============================================================================

/**
 * Request to generate dialogue for a combat event
 */
export interface GenerateDialogueRequest {
  session_id: string;
  event_type: CombatEventType;
  event_details: CombatEventDetails;
  player_context?: PlayerCombatContext;
}

/**
 * Response containing generated dialogue and metadata
 */
export interface GenerateDialogueResponse {
  success: boolean;
  dialogue_response: DialogueResponse;
  cached: boolean;
  error?: string;
}

/**
 * Combat action request for player actions
 */
export interface CombatActionRequest {
  session_id: string;
  action_type: 'attack' | 'defend' | 'special';
  target?: string;
}

/**
 * Result of a combat action with dialogue
 */
export interface CombatActionResponse {
  success: boolean;
  session: CombatSession;
  event_type: CombatEventType;
  event_details: CombatEventDetails;
  dialogue: DialogueResponse;
  session_complete: boolean;
  rewards?: CombatRewards;
  error?: string;
}

/**
 * Combat completion rewards (re-exported from api.types.ts for convenience)
 */
export interface CombatRewards {
  gold_earned: number;
  items_found: any[]; // TODO: Replace with proper Item type when available
  materials_found: any[]; // TODO: Replace with proper MaterialStack type when available
  experience_gained: number;
}