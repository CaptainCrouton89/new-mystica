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

### LocationService
- Geospatial queries using PostGIS
- Nearby location discovery with radius filtering
- Location metadata management

### CombatService
- Combat turn execution and state management
- Hit band calculation based on timing
- Combat result persistence via RPC
- AI dialogue integration (pending)

### EquipmentService
- Equipment slot management (8 hardcoded slots)
- Stat modification from equipped items
- Validation of equipment state

### InventoryService
- Player item inventory queries
- Item discovery and filtering
- Inventory state management

### LoadoutService
- Loadout creation, update, deletion
- Loadout composition validation
- Active loadout tracking

### MaterialService (Not Implemented)
- Material stack management (quantity tracking)
- Material application to items
- Material style system handling
- Composite key operations (user_id + material_id + style_id)

### ItemService (Not Implemented)
- Item creation and stat calculation
- Item template management
- Rarity and base level handling

### StatsService (Not Implemented)
- Stat normalization algorithms
- Modifier calculation from materials
- Combat stat derivation

### ImageGenerationService (Not Implemented)
- Replicate/OpenAI integration
- R2 storage upload
- Image cache management

## Material Application System (MVP0)

**Composite Key:** `(user_id, material_id, style_id)` in MaterialStacks

**Flow:**
1. Check MaterialStacks for availability
2. Decrement stack quantity
3. Create MaterialInstance
4. Insert into ItemMaterials
5. Compute combo_hash (item_type + material_ids + style_ids)
6. Check ItemImageCache for cached image
7. If miss: Generate (BLOCKING 20s), upload to R2, cache result
8. Set item.is_styled=true if any material.style_id != 'normal'

**Constraints:**
- Max 3 materials per item (ItemMaterials.slot_index: 0-2)
- Styles stack separately (same material + different style = separate stack)
- 100% drop rate (MVP0 simplification)

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
