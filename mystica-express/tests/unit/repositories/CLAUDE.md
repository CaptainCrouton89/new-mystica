# CLAUDE.md

Repository unit tests for the data access layer.

## Organization

Each `*Repository.test.ts` file tests a corresponding `src/repositories/*.ts` class that extends `BaseRepository<T>`.

## Testing Patterns

### Setup
- Tests use `setupDatabase()` from `../helpers/seedDatabase.js` to populate test data
- Supabase is mocked globally in `tests/setup.ts`
- Database state is reset between test suites
- Use `setupMockChain()` helper to mock Supabase method chains (`.from().select().eq()` etc)

### Fixtures and Factories
- **Fixtures** (`../fixtures/`): Static test data (e.g., `ANONYMOUS_USER`, `BASE_SWORD`)
- **Factories** (`../factories/`): Dynamic data generators (e.g., `ItemFactory.createBase()`)
- **seedData** (`../helpers/seedData.js`): Query real game data (materials, item types)

### Common Test Cases

**CRUD Operations:**
- `findById()` - Single entity lookup
- `findMany()` - Query with filters, pagination, sorting
- `create()` - Insert validation, returned ID
- `update()` - Partial updates, returned record
- `delete()` - Soft/hard delete behavior

**Repository-Specific Methods:**
- Custom finders (e.g., `findByUserId()`, `findByLocation()`)
- Complex filters and joins
- Aggregation queries

### Assertions
Use helpers from `../helpers/assertions.js`:
- `expectValidItem()` - Validates all required fields
- `expectValidNormalizedStats()` - Checks stat calculations
- Generic `expect()` for simple cases

### Error Handling
Test for:
- `NotFoundError` when record doesn't exist
- `ValidationError` for invalid input
- `UnauthorizedError` for permission violations
- `DatabaseError` for connection/RPC failures
- Database constraint violations

## EnemyRepository Pattern

EnemyRepository demonstrates specialized patterns for enemy type, stats, and pool management:

**JSON Personality Data Handling:**
- `findEnemyTypeById()` returns enemies with `ai_personality_traits` (AI dialogue context)
- May be stored as JSON string or object—test both with `.mockResolvedValue()`
- Include test for invalid JSON parsing (graceful fallback to null)
- Tests verify console warning on parse failure

**Realized Stats View Queries:**
- `getEnemyRealizedStats()` and `computeCombatRating()` query `v_enemy_realized_stats` view
- Test against view table name, not `enemytypes`
- Stats must be complete (all fields non-null)—throw on missing fields
- Include test for missing enemy (null data with `PGRST116` error code)

**Pool Management CRUD:**
- `createEnemyPool()` / `addEnemyToPool()` / `removeEnemyFromPool()` for dynamic pool operations
- Test optional fields (e.g., `spawn_weight` defaults, `filter_value` may be null)
- `removeEnemyFromPool()` returns boolean (count-based success check)

**Multi-Entity Queries with Sequential Mocks:**
- `findEnemyPoolWithMembers()` queries pool first, then members in sequence
- Use `.mockReturnValueOnce()` for first call, `.mockReturnValueOnce()` for second
- Return combined object with `members` array
- Test null pool case (return null, not error)

**Tier and Style Lookups:**
- `findTierById()`, `getAllTiers()` - Tier level definitions with stat bonuses
- `findStyleById()`, `getAllStyles()`, `findStyleByName()` - Style definitions with spawn rates
- `getStylesForEnemyType()` - Fetch available styles for specific enemy with weight multipliers
- Throw `NotFoundError` if no styles exist (empty array case)

## LocationRepository Pattern

LocationRepository demonstrates advanced patterns for complex game queries:

**PostGIS Geospatial Queries:**
- `findNearby(lat, lng, radius)` - Uses PostGIS RPC function `get_nearby_locations()`
- Test RPC calls with `mockClient.rpc.mockResolvedValue()`
- Include edge cases: poles, date line, extreme radii

**Pool Matching with Filters:**
- `getMatchingEnemyPools()` and `getMatchingLootPools()` - Complex OR filters
- Filter logic includes: universal, location_type, state, country
- Test that filters are properly constructed using `setupMockChain()`

**Weighted Random Selection:**
- `selectRandomEnemy()` and `selectRandomLoot()` - Use cumulative weights
- Mock `Math.random()` with `jest.spyOn()` to test specific selection paths
- Test edge cases: empty arrays, zero weights
- Verify weight aggregation and multiplier application

**Advanced Aggregation:**
- `getAggregatedEnemyPools()` - Combines weights across multiple pools
- `getAggregatedLootPools()` - Applies tier weight multipliers to materials only
- Use sequential `.mockReturnValueOnce()` for multi-step queries

## Example Test Structure

```typescript
import { ItemRepository } from '../../../src/repositories/ItemRepository.js';
import { ANONYMOUS_USER, BASE_SWORD } from '../../fixtures/index.js';
import { setupDatabase } from '../../helpers/seedDatabase.js';

describe('ItemRepository', () => {
  let repository: ItemRepository;

  beforeAll(async () => {
    await setupDatabase();
  });

  describe('findById', () => {
    it('should return item by ID', async () => {
      const item = await repository.findById(BASE_SWORD.id);
      expect(item.name).toBe('Iron Sword');
    });

    it('should throw NotFoundError for missing item', async () => {
      await expect(repository.findById('nonexistent')).rejects.toThrow('Item not found');
    });
  });
});
```

## See Also

- `../helpers/seedDatabase.js` - Database setup
- `../helpers/mockSupabase.js` - Mock Supabase client and chain setup
- `../fixtures/` - Static test data
- `../factories/` - Data generators
- `../../src/repositories/BaseRepository.ts` - Base class patterns
- `../../src/repositories/LocationRepository.ts` - PostGIS + pool matching patterns
- Parent CLAUDE.md - Full test infrastructure documentation
