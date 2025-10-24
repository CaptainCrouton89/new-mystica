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

```typescript
if (!item) {
  throw new NotFoundError('Item', itemId);
}

if (item.user_id !== userId) {
  throw new UnauthorizedError('You do not own this item');
}

if (materials.length > 3) {
  throw new ValidationError('Maximum 3 materials allowed');
}
```

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

### CombatService
**Status:** ✅ Fully Implemented

Handles complete combat lifecycle: session management, enemy selection, attack/defense mechanics, damage calculation, and reward distribution.

**Public API:**
```typescript
// Initialize combat
const session = await combatService.startCombat(userId, locationId, selectedLevel);

// Execute player actions
const attack = await combatService.executeAttack(sessionId, tapPositionDegrees);
const defense = await combatService.executeDefense(sessionId, tapPositionDegrees);

// Session recovery
const session = await combatService.getCombatSessionForRecovery(sessionId, userId);

// Session management
const session = await combatService.getUserActiveSession(userId);
const details = await combatService.getCombatSession(sessionId);
await combatService.abandonCombat(sessionId);
await combatService.completeCombat(sessionId, result);
```

**Key Features:**
- Session management with PostgreSQL TTL (15 min expiry)
- Pool-based enemy selection with spawn weights
- Weapon timing mechanics (0-360° dial) with accuracy adjustments
- 5 hit zones: crit, normal, graze, miss, injure (self-damage)
- Defense mechanics with zone-based damage reduction
- Atomic reward application: gold, materials, items, XP, combat history
- Equipment snapshot capture for analytics
- Turn-by-turn combat log tracking

**Key Types:**
- `CombatSession` - Active combat state with enemy, player/enemy stats, weapon config
- `AttackResult` - Attack output with damage, HP, turn number, rewards
- `CombatRewards` - Victory/defeat outcome with currencies, drops, history

### LocationService
**Status:** ✅ Fully Implemented

Geospatial queries using PostGIS and pool-based combat/loot selection.

**Public API:**
```typescript
// Location queries
const nearby = await locationService.nearby(lat, lng, radiusMeters);
const location = await locationService.getById(locationId);
const byType = await locationService.getByType(locationType);
const byRegion = await locationService.getByRegion(stateCode, countryCode);
const all = await locationService.getAll(limit, offset);

// Combat pool selection
const enemyPools = await locationService.getMatchingEnemyPools(locationId, combatLevel);
const enemies = await locationService.getEnemyPoolMembers(poolIds);
const selectedEnemy = locationService.selectRandomEnemy(poolMembers);

// Loot pool selection
const lootPools = await locationService.getMatchingLootPools(locationId, combatLevel);
const lootEntries = await locationService.getLootPoolEntries(poolIds);
const tierWeights = await locationService.getLootPoolTierWeights(poolIds);
const drops = locationService.selectRandomLoot(lootEntries, tierWeights, enemyStyleId, dropCount);
const styleName = await locationService.getStyleName(styleId);
```

**Key Features:**
- PostGIS geography queries (ST_DWithin for efficient spatial search)
- Universal + location-specific pool matching
- Weighted random enemy selection by spawn_weight
- Tier weight application to base drop weights
- Style inheritance from enemy to material drops
- Aggregated pool operations (future RPC optimization)

### EquipmentService
**Status:** ✅ Fully Implemented

Equipment slot management (8 hardcoded slots) and stat modification.

### InventoryService
**Status:** ✅ Fully Implemented

Player item inventory queries and filtering by type, rarity, or other attributes.

### LoadoutService
**Status:** ✅ Fully Implemented

Loadout CRUD operations with composition validation and active loadout tracking.

### MaterialService
**Status:** ❌ Not Implemented

Material stack management, application to items, and style system.

**Planned Responsibilities:**
- Material stack CRUD (composite key: user_id + material_id + style_id)
- Apply materials to items (max 3 per item, slot 0-2)
- Material-to-item stat modifier application
- Style inheritance and system management

**MVP0 Material Application Flow:**
1. Check MaterialStacks for availability
2. Decrement stack quantity
3. Create MaterialInstance record
4. Insert into ItemMaterials (validates slot_index 0-2)
5. Compute combo_hash (item_type + material_ids + style_ids)
6. Check ItemImageCache for cached combo
7. If cache miss: Generate image (BLOCKING 20s), upload to R2, cache globally
8. Set item.is_styled=true if any material.style_id != 'normal'

**Constraints:**
- Max 3 materials per item
- Styles stack separately (same material + different style = separate MaterialStack entry)
- 100% drop rate (MVP0 simplification)

### ItemService
**Status:** ❌ Not Implemented

Item creation, stat calculation, and item template management.

### StatsService
**Status:** ❌ Not Implemented

Stat normalization, modifier calculation from materials, combat stat derivation.

### NameDescriptionService
**Status:** ✅ Fully Implemented

Generates creative names and visual descriptions for crafted items using OpenAI's GPT-4.1-mini model.

**Public API:**
```typescript
const result = await nameDescriptionService.generateForItem(
  'sword',
  ['wood', 'crystal'],
  ['normal']
);
// Returns: { name: "Crystal-Bound Timber Blade", description: "..." }
```

**Key Features:**
- OpenAI API integration with structured output (Zod schema validation)
- Retry logic with exponential backoff (2 retries, 1s/2s delays)
- Environment credential validation on instantiation
- Error handling: `ValidationError`, `ExternalServiceError`, `ConfigurationError`
- Prompt engineering for consistent visual descriptions (2 sentences, material-form fusion focus)
- Console logging for generation timing and results

**Constraints:**
- Requires `OPENAI_API_KEY` environment variable
- Validates 1-3 materials (throws ValidationError for 0 or >3)
- Validates non-empty itemType and material strings
- Uses `ai` package (not direct OpenAI client) with `generateObject` for structured generation

### ImageGenerationService
**Status:** ❌ Not Implemented

AI image generation (Replicate/OpenAI), R2 storage, image cache management.

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

Example:
```typescript
describe('EquipmentService', () => {
  it('should equip valid item to player', async () => {
    const service = new EquipmentService();
    const result = await service.equipItem(USER_ID, ITEM_ID);
    expect(result.slot).toBe('weapon');
  });

  it('should throw UnauthorizedError if item not owned', async () => {
    const service = new EquipmentService();
    await expect(service.equipItem(USER_ID, OTHER_USERS_ITEM_ID))
      .rejects.toThrow(UnauthorizedError);
  });
});
```

## Important Notes

- **No Fallbacks:** Services throw errors early. No default values or silent failures.
- **Type Safety:** All inputs validated before operations (Zod in controllers)
- **Async/Await:** All database operations are async
- **No `any` Types:** Use proper types from database.types.ts
- **Module Resolution:** Import with `.js` extensions even in TypeScript
- **Combat Session TTL:** 15 minutes (PostgreSQL TTL with auto-cleanup)
- **Reward Transactions:** Applied atomically; session deleted only after rewards succeed
- **Equipment Snapshot:** Captured at combat start for analytics and session recovery
