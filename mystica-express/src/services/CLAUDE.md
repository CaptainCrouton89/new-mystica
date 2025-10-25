# Services Layer CLAUDE.md

Business logic services for the New Mystica backend. Each service encapsulates domain operations and coordinates between repositories, external APIs, and middleware.

## Patterns

**Constructor Injection** - Services receive dependencies via constructor with default instantiation
**Error Handling** - Use custom error classes from `src/utils/errors.ts`: ValidationError, NotFoundError, UnauthorizedError, ConflictError, BusinessLogicError, ExternalAPIError
**Repository Pattern** - Services delegate data access to repositories extending `BaseRepository<T>`

## Core Services (✅ Fully Implemented)

**EnemyService** - Enemy/monster retrieval, stat computation, R2 sprite URLs (UUID-based: `monsters/{uuid}/sprites/*`), personality traits from `ai_personality_traits` JSON

**CombatService** - Combat session lifecycle, turn execution (modular subdirectory: combat/types.ts, constants.ts, calculations.ts, session.ts, loot.ts, rewards.ts, combat-log.ts, turn-execution.ts), enemy selection, attack/defense with zone-based accuracy, reward application

**LocationService** - PostGIS geospatial queries, combat and loot pool selection

**EquipmentService** - 8 hardcoded slots (weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet), getEquippedItems/equipItem/unequipItem, automatic dual-accessory selection, stat aggregation, atomic operations

**InventoryService** - Player item queries with pagination, filtering (slot type, rarity, level), sorting (level, rarity, newest, name)

**LoadoutService** - Loadout CRUD and validation

**StatsService** - Item stats with quadratic formula (1 + 0.05 * (level - 1)²), material modifiers (±0.01), equipment aggregation across 8 slots, enemy realization (8x base * levelMult * diffMult), zone probability (5-zone smooth interpolation), zone crits (zone 1: 50%, zone 5: 0%)

**MaterialService** - Apply to items (max 3 per item), combo hash computation, image generation on first craft, name/description AI generation, style tracking, craft count tracking

## AI-Powered Services

**ChatterService** - Pet personality dialogue via OpenAI GPT-4.1-nano, 2s timeout, fallback to example_phrases, analytics logging, player combat history

**EnemyChatterService** - Enemy dialogue during combat, generateObject with Zod validation, 2s timeout with fallback taunts, context-aware (turn, HP%, events, crits), player history integration

**NameDescriptionService** - AI-generated names/descriptions via OpenAI, Zod validation, exponential backoff

**AI Service Patterns:** Use `ai` library (generateText/generateObject), 2s timeout via Promise.race(), graceful fallback on timeout (not error throwing), ExternalAPIError only on API errors, analytics logging, combat context + player history in prompts

## Supporting Services

AuthService, ImageGenerationService (Replicate + R2 storage), StyleService, PetService, ProfileService, AnalyticsService, RarityService, ProgressionService

## Important Notes

- Error Handling: Throw early, never silent failures. Use appropriate custom errors.
- Type Safety: Never `any` type, use `database.types.ts`
- Module Resolution: Import with `.js` extensions
- AI Timeouts: 2s for dialogue, longer for generation
- Material Slots: Max 3 per item, 2 accessory slots
