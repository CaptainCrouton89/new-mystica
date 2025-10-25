# Services Layer CLAUDE.md

This directory contains business logic services for the New Mystica backend. Each service encapsulates domain operations and coordinates between repositories, external APIs, and middleware.

## Service Architecture

All services follow this pattern:

```typescript
export class MyService {
  constructor(
    private repository: MyRepository = new MyRepository(),
    private otherService?: OtherService
  ) {}

  async domainOperation(userId: string, data: ValidatedData): Promise<Result> {
    // 1. Validate inputs early (throw ValidationError)
    // 2. Check permissions (throw UnauthorizedError)
    // 3. Query repositories
    // 4. Execute business logic
    // 5. Coordinate with other services if needed
    // 6. Return result or throw domain error
  }
}
```

## Key Service Patterns

### 1. Constructor Injection
Services receive dependencies via constructor with default instantiation for testability.

### 2. Error Handling
All services use custom error classes from `src/utils/errors.ts`:
- **ValidationError** - Invalid input data
- **NotFoundError** - Entity doesn't exist
- **UnauthorizedError** - User lacks permission
- **ConflictError** - State conflict
- **ExternalAPIError** - AI/external service failures

### 3. Repository Pattern
Services delegate data access to repositories extending `BaseRepository<T>`.

## Core Services

**EnemyService** (✅ Fully Implemented)
- Enemy/monster data retrieval with complete stat computation
- Returns `MonsterData` interface with personality, dialogue, and sprite animations
- Methods: `getMonsterById()`, `getMonstersByIds()`, `listMonsters()`
- R2 sprite URL construction (UUID-based paths: `monsters/{uuid}/sprites/*`)
- Personality trait extraction from `ai_personality_traits` JSON

**CombatService** (✅ Fully Implemented)
- Combat session lifecycle and turn execution using modular subdirectory structure
- Subdirectories: `combat/types.ts`, `combat/constants.ts`, `combat/calculations.ts`, `combat/session.ts`, `combat/loot.ts`, `combat/rewards.ts`, `combat/combat-log.ts`, `combat/turn-execution.ts`
- Enemy selection with weighted randomization
- Attack/defense mechanics with zone-based accuracy
- Reward application (gold, materials, items, XP)

**LocationService** (✅ Fully Implemented)
- PostGIS geospatial queries
- Combat and loot pool selection

**EquipmentService** (✅ Fully Implemented)
- Equipment slot management (8 hardcoded slots)
- Item equipping/unequipping with stat modifications

**InventoryService** (✅ Fully Implemented)
- Player item queries with pagination
- Filtering by slot type, rarity, level
- Sorting (level, rarity, newest, name)

**LoadoutService** (✅ Fully Implemented)
- Loadout CRUD and validation

**NameDescriptionService** (✅ Fully Implemented)
- AI-generated names/descriptions using OpenAI GPT-4.1-mini
- Structured Zod validation with exponential backoff

**StatsService** (✅ Fully Implemented)
- Item stat computation with level & rarity multipliers using quadratic formula: `1 + 0.05 * (level - 1)²`
- Material modifier application and validation (normalized to ±0.01)
- Equipment stat aggregation across 8 slots with per-slot contributions
- Enemy stat realization with level, rarity, and difficulty multipliers (8x base * levelMult * diffMult)
- Zone probability distribution calculation for combat accuracy (5-zone system with smooth interpolation)
- Zone hit simulation and critical damage multipliers by zone (zone 1: 50% crit, zone 5: no crit)
- Comprehensive input validation (all stats must sum to 1.0, materials ≤3, items ≤8)

## AI-Powered Services

**ChatterService** (✅ Fully Implemented - Implements F-11, F-12)
- Pet personality-based dialogue generation using `ai` library (generateText)
- OpenAI GPT-4.1-nano integration with 2-second timeout
- Graceful fallback to pet's example_phrases on timeout (not error throwing)
- Analytics logging for quality monitoring
- Integrates player combat history for context
- Enemy chatter generation with player history integration

**EnemyChatterService** (✅ Fully Implemented)
- Contextual enemy dialogue during combat events
- Uses `ai` library (generateObject) with Zod schema validation
- 2-second timeout with generic fallback taunts on failure
- Combat context-aware prompting (turn number, HP%, event type, critical hits)
- Logs all dialogue attempts for analytics
- Player combat history integration (win rate, streaks, attempts)

**AI Service Patterns:**
- Use `ai` library (generateText for simple strings, generateObject for structured data)
- Always include 2-second timeout via Promise.race() to prevent blocking
- Graceful fallback behavior on timeout (fallback phrases/taunts) rather than error throwing
- Throw ExternalAPIError only on API errors, not timeouts
- Log all attempts for quality monitoring via AnalyticsRepository
- Integrate combat context and player history into prompts

## Supporting Services

**PetService** - Pet management and summoning
**ProfileService** - User profile management
**AuthService** - Authentication and authorization
**ImageGenerationService** - AI image generation and R2 storage
**StyleService** - Style system and material styles
**AnalyticsService** - Combat and gameplay analytics
**RarityService** - Rarity calculations
**ProgressionService** - Level progression and XP tracking

## In-Progress / Partially Implemented

**MaterialService** (⚠️) - Material application and style system
**ItemService** (⚠️) - Item creation and stat calculation (depends on StatsService for calculations)

## Testing Services

**Unit Tests** (`tests/unit/services/MyService.test.ts`):
- Mock dependencies
- Test isolated business logic
- Use factories for test data

**Integration Tests** (`tests/integration/myfeature.test.ts`):
- Test full service with real repositories
- Test error conditions and edge cases

## Important Notes

- **Error Handling:** Services throw errors early. No silent failures or fallback behavior. Throw appropriate custom errors (ValidationError, NotFoundError, ExternalAPIError, etc.).
- **Type Safety:** Use proper types from `database.types.ts` - never use `any`
- **Async/Await:** All database/AI operations are async
- **Module Resolution:** Import with `.js` extensions
- **AI Timeouts:** All external API calls must have reasonable timeouts (2s for dialogue, longer for generation)
- **Analytics Logging:** AI service usage should be logged for monitoring quality
