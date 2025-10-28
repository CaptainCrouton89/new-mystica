import { z } from 'zod';

/**
 * Validation schemas for request bodies, query parameters, and route params
 * Used with the validate middleware to ensure type-safe API requests
 */

// Common schemas
export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const EquipmentSlotSchema = z.enum([
  'weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'
]);

// Rarity enum schema
export const RaritySchema = z.enum([
  'common', 'uncommon', 'rare', 'epic', 'legendary'
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
  style_id: z.string().uuid('Style ID must be a valid UUID').default('00000000-0000-0000-0000-000000000000'), // 'normal' style UUID
  slot_index: z.number().int().min(0).max(2, 'Slot index must be between 0 and 2')
});

export const ReplaceMaterialSchema = z.object({
  slot_index: z.number().int().min(0).max(2, 'Slot index must be between 0 and 2'),
  new_material_id: z.string().min(1, 'New material ID is required'),
  new_style_id: z.string().uuid('Style ID must be a valid UUID').default('00000000-0000-0000-0000-000000000000'), // 'normal' style UUID
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

export const ItemIdSlotParamsSchema = z.object({
  item_id: UUIDSchema,
  slot_index: z.coerce.number().int().min(0).max(2, 'Slot index must be between 0 and 2')
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

// Location endpoints
export const NearbyLocationsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().int().min(1).max(50000).default(5000)
});

export const LocationParamsSchema = z.object({
  id: z.string().uuid('Invalid location ID format')
});

// Auto-generate location schema
export const AutoGenerateLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  state_code: z.string().optional(),
  country_code: z.string().optional()
});

// Legacy schema for combat system
export const LocationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().int().min(100).max(50000).default(5000)
});

// Loot endpoints
export const InstantLootSchema = z.object({
  location_id: UUIDSchema
});

// Combat endpoints (for future implementation)
export const StartCombatSchema = z.object({
  location_id: UUIDSchema,
  selected_level: z.number().int().min(1, 'Selected level must be at least 1').max(20, 'Selected level cannot exceed 20')
});

export const AttackSchema = z.object({
  session_id: UUIDSchema,
  tap_position_degrees: z.number().min(0, 'Tap position must be between 0 and 360 degrees').max(360, 'Tap position must be between 0 and 360 degrees')
});

export const DefenseSchema = z.object({
  session_id: UUIDSchema,
  tap_position_degrees: z.number().min(0, 'Tap position must be between 0 and 360 degrees').max(360, 'Tap position must be between 0 and 360 degrees')
});

export const CompleteCombatSchema = z.object({
  session_id: UUIDSchema,
  result: z.enum(['victory', 'defeat'])
});

export const AbandonCombatSchema = z.object({
  session_id: UUIDSchema
});

// Combat result and zone schemas
export const HitZoneSchema = z.enum(['injure', 'miss', 'graze', 'normal', 'crit']);
export const CombatStatusSchema = z.enum(['ongoing', 'victory', 'defeat']);

export const EnemyChatterSchema = z.object({
  session_id: UUIDSchema,
  event_type: z.enum(['combat_start', 'player_attacks', 'enemy_attacks', 'low_player_hp', 'near_victory', 'defeat', 'victory']),
  event_details: z.object({
    damage: z.number().optional(),
    accuracy: z.number().min(0).max(1).optional(),
    is_critical: z.boolean().optional(),
    turn_number: z.number().int().min(1),
    player_hp_pct: z.number().min(0).max(1),
    enemy_hp_pct: z.number().min(0).max(1),
  }),
});

// Pet personality schemas
export const AssignPersonalitySchema = z.object({
  personality_type: z.enum(['sassy', 'encouraging', 'analytical', 'chaotic', 'stoic', 'trash_talker']),
  custom_name: z.string().max(50).optional(),
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
    offhand: UUIDSchema.nullable().optional(),
    head: UUIDSchema.nullable().optional(),
    armor: UUIDSchema.nullable().optional(),
    feet: UUIDSchema.nullable().optional(),
    accessory_1: UUIDSchema.nullable().optional(),
    accessory_2: UUIDSchema.nullable().optional(),
    pet: UUIDSchema.nullable().optional()
  })
});

// Pet personality endpoints (F-11) - using AssignPersonalitySchema defined above

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
export const EnemyChatterRequestSchema = z.object({
  session_id: UUIDSchema,
  event_type: z.enum([
    'combat_start', 'player_attacks', 'enemy_attacks',
    'low_player_hp', 'near_victory', 'defeat', 'victory'
  ]),
  event_details: z.object({
    damage: z.number().int().nonnegative('Damage must be non-negative').optional(),
    accuracy: z.number().min(0.0, 'Accuracy must be between 0.0 and 1.0').max(1.0, 'Accuracy must be between 0.0 and 1.0').optional(),
    is_critical: z.boolean().optional(),
    turn_number: z.number().int().positive('Turn number must be positive'),
    player_hp_pct: z.number().min(0.0, 'Player HP percentage must be between 0.0 and 1.0').max(1.0, 'Player HP percentage must be between 0.0 and 1.0'),
    enemy_hp_pct: z.number().min(0.0, 'Enemy HP percentage must be between 0.0 and 1.0').max(1.0, 'Enemy HP percentage must be between 0.0 and 1.0'),
    player_zone: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    enemy_zone: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    player_action: z.enum(['attack', 'defend']).optional()
  })
});

// Type exports for use in controllers
export type EquipItemRequest = z.infer<typeof EquipItemSchema>;
export type UnequipItemRequest = z.infer<typeof UnequipItemSchema>;
export type ApplyMaterialRequest = z.infer<typeof ApplyMaterialSchema>;
export type ReplaceMaterialRequest = z.infer<typeof ReplaceMaterialSchema>;
export type ItemParams = z.infer<typeof ItemParamsSchema>;
export type ItemIdSlotParams = z.infer<typeof ItemIdSlotParamsSchema>;
export type LocationQuery = z.infer<typeof LocationQuerySchema>;
export type InstantLootRequest = z.infer<typeof InstantLootSchema>;
export type StartCombatRequest = z.infer<typeof StartCombatSchema>;
export type AttackRequest = z.infer<typeof AttackSchema>;
export type DefenseRequest = z.infer<typeof DefenseSchema>;
export type CompleteCombatRequest = z.infer<typeof CompleteCombatSchema>;
export type AbandonCombatRequest = z.infer<typeof AbandonCombatSchema>;
export type CreateLoadoutRequest = z.infer<typeof CreateLoadoutSchema>;
export type UpdateLoadoutRequest = z.infer<typeof UpdateLoadoutSchema>;
export type UpdateLoadoutSlotsRequest = z.infer<typeof UpdateLoadoutSlotsSchema>;
export type AssignPetPersonalityRequest = z.infer<typeof AssignPersonalitySchema>;
export type PetChatterRequest = z.infer<typeof PetChatterSchema>;
export type EnemyChatterRequest = z.infer<typeof EnemyChatterRequestSchema>;
export type NearbyLocationsQuery = z.infer<typeof NearbyLocationsQuerySchema>;
export type LocationParams = z.infer<typeof LocationParamsSchema>;
export type LocationIdParams = z.infer<typeof LocationIdParamsSchema>;
export type AutoGenerateLocationRequest = z.infer<typeof AutoGenerateLocationSchema>;

// Auth endpoints (F-07)
export const RegisterDeviceBodySchema = z.object({
  device_id: z.string().uuid('Device ID must be a valid UUID')
});

// Type exports for auth
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceBodySchema>;

// Economy endpoints
export const AffordabilityCheckSchema = z.object({
  currency: z.enum(['GOLD', 'GEMS']),
  amount: z.number().int().positive('Amount must be a positive integer')
});

export const AddCurrencySchema = z.object({
  currency: z.enum(['GOLD', 'GEMS']),
  amount: z.number().int().positive('Amount must be a positive integer'),
  sourceType: z.string().min(1, 'Source type is required'),
  sourceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const DeductCurrencySchema = z.object({
  currency: z.enum(['GOLD', 'GEMS']),
  amount: z.number().int().positive('Amount must be a positive integer'),
  sourceType: z.string().min(1, 'Source type is required'),
  sourceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// Type exports for economy
export type AffordabilityCheckRequest = z.infer<typeof AffordabilityCheckSchema>;
export type AddCurrencyRequest = z.infer<typeof AddCurrencySchema>;
export type DeductCurrencyRequest = z.infer<typeof DeductCurrencySchema>;

// Item pet endpoints
export const AssignPetPersonalityBodySchema = z.object({
  personality_id: z.string().min(1, 'Personality ID is required'),
  custom_name: z.string().max(50).optional()
});

export const AddPetChatterSchema = z.object({
  text: z.string().min(1, 'Chatter text is required').max(500, 'Chatter text must be under 500 characters'),
  type: z.enum(['user', 'ai', 'system']).optional()
});

// Type exports for item pet endpoints
export type AssignPetPersonalityBody = z.infer<typeof AssignPetPersonalityBodySchema>;
export type AddPetChatterRequest = z.infer<typeof AddPetChatterSchema>;

// Progression endpoints (F-08)
export const ClaimLevelRewardSchema = z.object({
  level: z.number().int().min(1, 'Level must be at least 1')
});

export const AwardExperienceSchema = z.object({
  user_id: UUIDSchema,
  xp_amount: z.number().int().positive('XP amount must be positive'),
  source: z.enum(['combat', 'quest', 'achievement', 'daily_bonus']),
  source_id: UUIDSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// Type exports for progression
export type ClaimLevelRewardRequest = z.infer<typeof ClaimLevelRewardSchema>;
export type AwardExperienceRequest = z.infer<typeof AwardExperienceSchema>;

// Inventory endpoints
export const InventoryQuerySchema = z.object({
  slot_type: z.enum(['all', 'weapon', 'offhand', 'head', 'armor', 'feet', 'accessory', 'pet']).default('all'),
  sort_by: z.enum(['level', 'rarity', 'newest', 'name']).default('level'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

// Type exports for inventory
export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;