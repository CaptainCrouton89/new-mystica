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

**CombatService** (✅ Fully Implemented)
- Combat session lifecycle and turn execution
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

## AI-Powered Services

**ChatterService** (✅ Fully Implemented - Implements F-11, F-12)
- Pet personality-based dialogue generation
- OpenAI GPT-4.1-mini integration with 2-second timeout
- Throws ExternalAPIError on timeout/failure
- Analytics logging for quality monitoring
- Integrates player combat history for context

**EnemyChatterService** (✅ Fully Implemented)
- Contextual enemy dialogue during combat events
- AI timeout handling (2s) with error throwing
- Combat context-aware prompting (turn number, HP%, critical hits)
- Logs all dialogue attempts for analytics

**AI Service Patterns:**
- Always include 2-second timeout to prevent blocking
- Throw ExternalAPIError on timeout or API failure
- Log attempts for quality monitoring
- Integrate combat context into prompts for personality

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
**ItemService** (⚠️) - Item creation and stat calculation
**StatsService** (⚠️) - Stat normalization algorithms

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
