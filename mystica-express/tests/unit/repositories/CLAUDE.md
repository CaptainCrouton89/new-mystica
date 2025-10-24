# CLAUDE.md

Repository unit tests for the data access layer.

## Organization

Each `*Repository.test.ts` file tests a corresponding `src/repositories/*.ts` class that extends `BaseRepository<T>`.

## Testing Patterns

### Setup
- Tests use `setupDatabase()` from `../helpers/seedDatabase.js` to populate test data
- Supabase is mocked globally in `tests/setup.ts`
- Database state is reset between test suites

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
- Database constraint violations

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
- `../fixtures/` - Static test data
- `../factories/` - Data generators
- `../../src/repositories/BaseRepository.ts` - Base class patterns
- Parent CLAUDE.md - Full test infrastructure documentation
