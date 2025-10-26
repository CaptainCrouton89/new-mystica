# CLAUDE.md

Type definitions and schemas for the backend.

## Files Overview

- **database.types.ts** - Auto-generated from Supabase (run `pnpm supabase:types`)
- **api.types.ts** - Domain models, API responses, equipment, materials, combat (zones, rewards, dialogue), economy, progression, chatter (F-11/F-12), and styles
- **repository.types.ts** - Data access layer types (QueryFilter, PaginationParams, ItemWithDetails)
- **schemas.ts** - Zod validation schemas for all request bodies/query params/route params
- **express.d.ts** - Express type extensions (req.user, req.validated, req.context)
- **express-helpers.ts** - Helper utilities for Express extensions
- **index.ts** - Barrel exports for easy imports

## Key Type Categories

**Domain Models:** UserProfile, Item, PlayerItem, ItemType, Material, AppliedMaterial, MaterialStack, MaterialStackDetailed

**Equipment & Stats:** Stats, EquipmentSlot (8 slots), EquipmentSlots, PlayerStats, Rarity, RarityDefinition

**Combat System:** CombatSession, CombatActionResult, CombatRewards, ZoneHitInfo, ZoneDistribution, EnemyRealizedStats, EnemyLoot, CombatStatus

**Combat Dialogue (F-12):** CombatEventType, CombatEventDetails, DialogueResponse, PlayerCombatContext, EnemyType, EnemyChatterEventType

**Pet Chatter (F-11):** PetChatterEventType, PetPersonality, ChatterResponse, PersonalityAssignmentResult, ChatterMetadata

**Economy:** CurrencyOperationResult, CurrencyBalances, AffordabilityResult, TransactionSourceType, TransactionSinkType

**Progression (F-08):** ProgressionStatus, ExperienceAwardResult, LevelReward, RewardClaimResult, XPSourceType, AnalyticsEvent

**Styles (F-04/F-05):** StyleDefinition, StyleResponse

**API Responses:** EquipResult, ApplyMaterialResult, ReplaceMaterialResult, UpgradeResult, InventoryResponse

**Express Types:** Never redeclare `req` properties. Use `req.user` (auth), `req.validated` (validation), `req.context`.

## Development Guidelines

- **NEVER use `any` type** — look up actual types from database.types or api.types
- **ALWAYS validate with Zod** — all external data (body/query/params) must have schemas in schemas.ts
- **Use barrel export** — import from `./index.ts`, not individual files
- **Use database.types in repositories** — avoid `unknown` or generic objects
- **Module resolution** — use `.js` extensions (compiles to CommonJS)
- **Combat system** — use ZoneHitInfo, ZoneDistribution, EnemyRealizedStats for damage calculations and zone mechanics
