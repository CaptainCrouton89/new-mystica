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
Services receive dependencies via constructor:
- Default repository instantiation for easy testing
- Optional dependencies for services that coordinate with others

```typescript
constructor(
  private itemRepository: ItemRepository = new ItemRepository(),
  private materialService?: MaterialService
) {}
```

### 2. Error Handling
All services use custom error classes from `src/utils/errors.ts`:

- **ValidationError** - Invalid input data
- **NotFoundError** - Entity doesn't exist
- **UnauthorizedError** - User lacks permission
- **ConflictError** - State conflict (e.g., already equipped)
- **NotImplementedError** - Feature not yet implemented

### 3. Repository Pattern Usage
Services delegate data access to repositories. All repositories extend `BaseRepository<T>`:

```typescript
// Query
const items = await this.itemRepository.findMany({ user_id: userId });

// Single entity
const item = await this.itemRepository.findById(itemId);

// Create/update/delete
await this.itemRepository.create({ ...data });
await this.itemRepository.update(itemId, { ...updates });
await this.itemRepository.delete(itemId);
```

## Service Responsibilities

### Core Services

**CombatService** (✅ Fully Implemented)
- Combat session lifecycle: initiation, turn execution, completion
- Enemy selection with pool-based weighted randomization
- Attack/defense mechanics with zone-based accuracy
- Reward application: gold, materials, items, XP, combat history
- Equipment snapshot capture for analytics

**LocationService** (✅ Fully Implemented)
- PostGIS geospatial queries (nearby locations with radius)
- Combat and loot pool selection per location/level
- Weighted random enemy and item drops
- Style inheritance from enemies to material drops

**EquipmentService** (✅ Fully Implemented)
- Equipment slot management (8 hardcoded slots)
- Item equipping/unequipping with validation
- Stat modification from equipped items

**InventoryService** (✅ Fully Implemented)
- Player item inventory queries
- Filtering by type, rarity, or custom attributes

**LoadoutService** (✅ Fully Implemented)
- Loadout CRUD operations
- Composition validation and active loadout tracking

**NameDescriptionService** (✅ Fully Implemented)
- AI-generated creative names for crafted items
- Visual descriptions using OpenAI GPT-4.1-mini
- Structured output validation (Zod)
- Retry logic with exponential backoff

### In-Progress / Partially Implemented

**MaterialService** (⚠️ Needs Completion)
- Material stack management (composite key: user_id + material_id + style_id)
- Apply materials to items (max 3 per item, slots 0-2)
- Material-to-item stat modifier application
- Style inheritance and system

**ItemService** (⚠️ Needs Completion)
- Item creation and initialization
- Stat calculation and derivation
- Item template management

**StatsService** (⚠️ Needs Completion)
- Stat normalization algorithms
- Modifier calculation from materials
- Combat stat derivation

### Supporting Services

**ProfileService** - User profile management
**AuthService** - Authentication and authorization
**EconomyService** - Currency and economy management
**ChatterService** - NPC dialogue and interaction
**EnemyChatterService** - Enemy-specific dialogue
**ImageGenerationService** - AI image generation and R2 storage
**StyleService** - Style system and material styles
**AnalyticsService** - Combat and gameplay analytics
**RarityService** - Rarity calculations and progression
**PetService** - Pet management and summoning
**ProgressionService** - Level progression and XP tracking

## Testing Services

Services are tested in two layers:

**Unit Tests** (`tests/unit/services/MyService.test.ts`):
- Mock dependencies
- Test isolated business logic
- Use ItemFactory/UserFactory for test data

**Integration Tests** (`tests/integration/myfeature.test.ts`):
- Test full service with real repositories
- Test error conditions
- Verify database state changes

## Important Notes

- **No Fallbacks:** Services throw errors early. No default values or silent failures.
- **Type Safety:** All inputs validated before operations (Zod in controllers)
- **Async/Await:** All database operations are async
- **No `any` Types:** Use proper types from database.types.ts
- **Module Resolution:** Import with `.js` extensions even in TypeScript
- **Combat Session TTL:** 15 minutes (PostgreSQL TTL with auto-cleanup)
- **Reward Transactions:** Applied atomically; session deleted only after rewards succeed
- **Equipment Snapshot:** Captured at combat start for analytics and session recovery
