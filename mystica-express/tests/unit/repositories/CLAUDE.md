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
