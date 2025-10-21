import { z } from 'zod';

/**
 * Validation schemas for request bodies, query parameters, and route params
 * Used with the validate middleware to ensure type-safe API requests
 */

// Common schemas
export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const EquipmentSlotSchema = z.enum([
  'weapon', 'shield', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'
]);

// Equipment endpoints
export const EquipItemSchema = z.object({
  item_id: UUIDSchema
});

export const UnequipItemSchema = z.object({
  slot: EquipmentSlotSchema
});

// Material endpoints
export const ApplyMaterialSchema = z.object({
  material_id: z.string().min(1, 'Material ID is required'),
  is_shiny: z.boolean().default(false),
  slot_index: z.number().int().min(0).max(2, 'Slot index must be between 0 and 2')
});

export const ReplaceMaterialSchema = z.object({
  slot_index: z.number().int().min(0).max(2, 'Slot index must be between 0 and 2'),
  new_material_id: z.string().min(1, 'New material ID is required'),
  new_is_shiny: z.boolean().default(false),
  gold_cost: z.number().int().min(0, 'Gold cost must be non-negative')
});

// Item endpoints
export const ItemParamsSchema = z.object({
  id: UUIDSchema
});

// Route parameter schemas
export const ItemIdParamsSchema = z.object({
  item_id: UUIDSchema
});

export const LocationIdParamsSchema = z.object({
  location_id: UUIDSchema
});

export const LoadoutIdParamsSchema = z.object({
  loadout_id: UUIDSchema
});

export const PetIdParamsSchema = z.object({
  pet_id: UUIDSchema
});

// Location endpoints (for future combat system)
export const LocationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().int().min(100).max(50000).default(5000)
});

// Combat endpoints (for future implementation)
export const StartCombatSchema = z.object({
  location_id: UUIDSchema
});

export const AttackSchema = z.object({
  session_id: UUIDSchema,
  attack_accuracy: z.number().min(0).max(1, 'Attack accuracy must be between 0 and 1')
});

export const DefenseSchema = z.object({
  session_id: UUIDSchema,
  defense_accuracy: z.number().min(0).max(1, 'Defense accuracy must be between 0 and 1')
});

export const CompleteCombatSchema = z.object({
  session_id: UUIDSchema,
  result: z.enum(['victory', 'defeat'])
});

// Loadout endpoints (F-09)
export const CreateLoadoutSchema = z.object({
  name: z.string().min(1).max(50, 'Loadout name must be between 1 and 50 characters')
});

export const UpdateLoadoutSchema = z.object({
  name: z.string().min(1).max(50, 'Loadout name must be between 1 and 50 characters')
});

export const UpdateLoadoutSlotsSchema = z.object({
  slots: z.object({
    weapon: UUIDSchema.nullable().optional(),
    shield: UUIDSchema.nullable().optional(),
    head: UUIDSchema.nullable().optional(),
    armor: UUIDSchema.nullable().optional(),
    feet: UUIDSchema.nullable().optional(),
    accessory_1: UUIDSchema.nullable().optional(),
    accessory_2: UUIDSchema.nullable().optional(),
    pet: UUIDSchema.nullable().optional()
  })
});

// Pet personality endpoints (F-11)
export const AssignPetPersonalitySchema = z.object({
  personality_type: z.enum(['sassy', 'encouraging', 'analytical', 'chaotic', 'stoic', 'trash_talker']),
  custom_name: z.string().optional()
});

export const PetChatterSchema = z.object({
  session_id: UUIDSchema,
  event_type: z.enum([
    'player_attack', 'player_defense', 'enemy_attack', 'enemy_defense',
    'critical_hit', 'miss', 'victory', 'defeat'
  ]),
  event_details: z.object({
    damage: z.number().int().optional(),
    accuracy: z.number().optional(),
    is_critical: z.boolean().optional(),
    turn_number: z.number().int().optional()
  }).optional()
});

// Enemy chatter endpoints (F-12)
export const EnemyChatterSchema = z.object({
  session_id: UUIDSchema,
  event_type: z.enum([
    'combat_start', 'player_hit', 'player_miss', 'enemy_hit',
    'low_player_hp', 'near_victory', 'defeat', 'victory'
  ]),
  event_details: z.object({
    damage: z.number().int().optional(),
    accuracy: z.number().optional(),
    is_critical: z.boolean().optional(),
    turn_number: z.number().int().optional(),
    player_hp_pct: z.number().optional(),
    enemy_hp_pct: z.number().optional()
  }).optional()
});

// Type exports for use in controllers
export type EquipItemRequest = z.infer<typeof EquipItemSchema>;
export type UnequipItemRequest = z.infer<typeof UnequipItemSchema>;
export type ApplyMaterialRequest = z.infer<typeof ApplyMaterialSchema>;
export type ReplaceMaterialRequest = z.infer<typeof ReplaceMaterialSchema>;
export type ItemParams = z.infer<typeof ItemParamsSchema>;
export type LocationQuery = z.infer<typeof LocationQuerySchema>;
export type StartCombatRequest = z.infer<typeof StartCombatSchema>;
export type AttackRequest = z.infer<typeof AttackSchema>;
export type DefenseRequest = z.infer<typeof DefenseSchema>;
export type CompleteCombatRequest = z.infer<typeof CompleteCombatSchema>;
export type CreateLoadoutRequest = z.infer<typeof CreateLoadoutSchema>;
export type UpdateLoadoutRequest = z.infer<typeof UpdateLoadoutSchema>;
export type UpdateLoadoutSlotsRequest = z.infer<typeof UpdateLoadoutSlotsSchema>;
export type AssignPetPersonalityRequest = z.infer<typeof AssignPetPersonalitySchema>;
export type PetChatterRequest = z.infer<typeof PetChatterSchema>;
export type EnemyChatterRequest = z.infer<typeof EnemyChatterSchema>;