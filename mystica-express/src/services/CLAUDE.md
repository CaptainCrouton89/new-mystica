# Services Layer CLAUDE.md

Business logic services for the New Mystica backend. Each service encapsulates domain operations and coordinates between repositories, external APIs, and middleware.

## Patterns

**Constructor Injection** - Services receive dependencies via constructor with default instantiation
**Error Handling** - Use custom error classes from `src/utils/errors.ts`
**Repository Pattern** - Services delegate data access to repositories extending `BaseRepository<T>`

## Core Services

**ItemService** - Item lifecycle (create/upgrade/discard), stats computation, inventory w/ pagination, 8-slot equipment, pet personalities, combat stats, starter inventory

**EnemyService** - Enemy retrieval, stat computation, R2 sprite URLs, personality traits

**CombatService** - Combat lifecycle, turn execution (modular subdirectory), enemy selection, attack/defense with zones, rewards

**LocationService** - PostGIS geospatial queries, combat/loot selection

**EquipmentService** - 8 slots (weapon, offhand, head, armor, feet, accessory_1/2, pet), stat aggregation, atomic ops

**InventoryService** - Player items w/ pagination, filtering (slot/rarity/level), sorting

**StatsService** - Quadratic formula (1 + 0.05 * (level - 1)²), material modifiers, equipment aggregation, zone probability/crits

**MaterialService** - Apply to items (max 3), combo hash, image generation + caching, name/description AI, style tracking

**ImageGenerationService** - Replicate + R2 integration, prompt building, retry logic (2s exponential backoff), reference images, cache checking

**LoadoutService** - CRUD + validation

## AI Services

**ChatterService** - Pet dialogue (OpenAI, 2s timeout, fallback), analytics logging

**EnemyChatterService** - Combat dialogue (generateObject + Zod, 2s timeout, context-aware)

**NameDescriptionService** - AI names/descriptions, exponential backoff

## Notes

Throw early, never silent failures. Import with `.js` extensions. 2s timeout for dialogue, longer for generation. Max 3 materials per item.
