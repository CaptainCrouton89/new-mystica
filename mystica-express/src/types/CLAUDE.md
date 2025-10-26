# CLAUDE.md

Type definitions and schemas for the backend.

## Files Overview

- **database.types.ts** - Auto-generated from Supabase (run `pnpm supabase:types`)
- **api.types.ts** - Domain models, API responses (Item, UserProfile, Material, Combat types)
- **repository.types.ts** - Data access layer types (QueryFilter, PaginationParams, ItemWithDetails)
- **schemas.ts** - Zod validation schemas for all request bodies/query params/route params
- **express.d.ts** - Express type extensions (req.user, req.validated, req.context)
- **express-helpers.ts** - Helper utilities for Express extensions
- **index.ts** - Barrel exports for easy imports

## Key Patterns

**API Types:** Domain models (UserProfile, Item, Material, PlayerStats), API responses (EquipResult, ApplyMaterialResult, InventoryResponse, CombatActionResult), Combat types (CombatSession, CombatAction, CombatReward), Enums (EquipmentSlot: 8 slots, Rarity, CombatStatus).

**Schemas:** Comprehensive Zod validation for equipment, materials, items, locations, combat, loadouts, pets, enemies, auth, economy, progression, and inventory endpoints. Always define reusable base schemas and extend them.

**Express Types:** Never redeclare `req` properties. Use `req.user` (auth), `req.validated` (validation), `req.context`.

## Development Guidelines

- **NEVER use `any` type** — look up actual types from database.types or api.types
- **ALWAYS validate with Zod** — all external data (body/query/params) must have schemas
- **Use barrel export** — import from `./index.ts`, not individual files
- **Use database.types in repositories** — avoid `unknown` or generic objects
- **Module resolution** — use `.js` extensions (compiles to CommonJS)
