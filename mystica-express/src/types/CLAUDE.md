# CLAUDE.md

Type definitions and schemas for the backend.

## Files Overview

- **database.types.ts** - Auto-generated from Supabase (run `pnpm supabase:types`)
- **api.types.ts** - Domain models, API response types, DTOs, and result interfaces (includes combat types)
- **repository.types.ts** - Repository layer types, data access patterns, transaction types
- **schemas.ts** - Zod validation schemas for all request bodies/query params
- **express.d.ts** - Express type extensions (`req.user`, `req.validated`, `req.context`)
- **express-helpers.ts** - Helper utilities for Express type extensions
- **index.ts** - Barrel exports for easy imports

## Key Patterns

### 1. API Types (api.types.ts)

Comprehensive domain models covering all game entities:

**Core Domain Models:**
- `UserProfile` - User data with stats, progression, currencies
- `Item` - Player-owned item instance with materials and styling
- `ItemType` - Item template from seed data
- `Material` / `AppliedMaterial` - Material templates and instances on items
- `PlayerStats` - Aggregated stats from equipped items

**API Response Types** (use in controller returns):
- `EquipResult` - Equipment operation outcome with updated stats
- `ApplyMaterialResult` - Material application success with image URL
- `InventoryResponse` - Full inventory with items and storage status
- `CombatActionResult` - Combat action outcome with rewards

**Combat Types** (consolidated from former combat.types.ts):
- `CombatSession` - Active or completed combat state
- `CombatAction` - Player or enemy action in combat
- `CombatReward` - Loot and XP from victory

**Enums and Constants:**
- `EquipmentSlot` - 8 slot types (weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet)
- `Rarity` - common, uncommon, rare, epic, legendary
- `CombatStatus` - active, victory, defeat, abandoned

### 2. Repository Types (repository.types.ts)

Data access layer interfaces for consistent patterns:

**Query Helpers:**
- `QueryFilter` - Flexible filter object for WHERE conditions
- `PaginationParams` - limit, offset for result sets
- `SortParams` - orderBy, ascending for ordering

**Item/Material/Equipment:**
- `ItemWithDetails` - Full item with ItemType and materials
- `MaterialInstance` / `MaterialInstanceWithTemplate` - Applied materials
- `EquipmentSlotAssignment` - Single slot assignment
- `BulkEquipmentUpdate` - All 8 slots at once

### 3. Zod Schemas (schemas.ts)

All request bodies and query parameters MUST have Zod schemas. Define reusable base schemas and extend them in route-specific schemas.

### 4. Express Type Extensions (express.d.ts)

Never redeclare `req` properties. Use typed extensions for:
- `req.user` - Set by auth middleware
- `req.validated` - Set by validate middleware
- `req.context` - Available for context info

## Development Guidelines

- **NEVER use `any` type** - Look up actual type from database.types or api.types
- **NEVER import from parent types** - Use barrel export from `./index.ts`
- **ALWAYS validate externally-provided data with Zod** - Routes handle body/query validation
- **ALWAYS use database.types in repositories** - Avoid `unknown` or generic objects
- **Module resolution** - Use `.js` extensions in imports even though code is TypeScript
