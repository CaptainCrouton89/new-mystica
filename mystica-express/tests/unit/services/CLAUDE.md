# CLAUDE.md - Unit Test Services

This directory contains unit tests for all service layer classes in the backend.

## Test Organization

Each service has one or more test files:
- **Primary tests** (`ServiceName.test.ts`) - Comprehensive test coverage
- **Basic tests** (`ServiceName.basic.test.ts`) - Core functionality subset (legacy)
- **Docs** (`ServiceName.test.md`) - Test documentation (legacy reference)

Current services tested:
- `AuthService` - JWT, device, email auth flows
- `ChatterService` - AI dialogue integration
- `CombatService` - Combat mechanics, enemy selection, rewards
- `EconomyService` - NPC trades, pricing
- `EquipmentService` - Equipment slots, stat calculations
- `ImageGenerationService` - AI image generation, caching
- `InventoryService` - Item management, quantity tracking
- `ItemService` - Item creation, composition, stats
- `LoadoutService` - Loadout CRUD and validation
- `LocationService` - Geospatial queries, PostGIS

## Test Patterns

### Setup and Fixtures

All tests use imported fixtures and factories from `../fixtures/` and `../factories/`:

```typescript
import { ANONYMOUS_USER, EMAIL_USER, SF_LIBRARY } from '../../fixtures/index.js';
import { ItemFactory, UserFactory } from '../../factories/index.js';

describe('CombatService', () => {
  it('should apply combat rewards', async () => {
    const user = ANONYMOUS_USER;
    const item = ItemFactory.createBase('sword', 1);
    // ...
  });
});
```

### Supabase Mocking

Global Supabase mock configured in `../setup.ts`:
```typescript
// Tests can override mocks per-test
jest.mocked(supabase.from).mockImplementation(() => ({
  select: jest.fn().mockReturnValue({ data: [...], error: null })
}));
```

### Assertions

Common assertion helpers from `../helpers/assertions.js`:
- `expectValidItem(item)` - Validates item structure
- `expectValidNormalizedStats(stats)` - Validates stat calculations
- `expectValidCombatLog(log)` - Validates combat log structure

## Test File Conventions

**Naming:**
- `.test.ts` - Primary comprehensive test file
- `.basic.test.ts` - Subset coverage (legacy, some still used)
- `.repository.test.ts` - Repository-specific tests (LocationService)

**Import Pattern:**
```typescript
import { ServiceClass } from '../../../src/services/ServiceClass.js';
import { mockSupabase } from '../../helpers/mockSupabase.js';
```

**Note:** All imports use `.js` extensions (module resolution pattern).

## Key Test Infrastructure

- **Fixtures** (`../fixtures/`) - Static pre-defined game data (users, items, locations, materials)
- **Factories** (`../factories/`) - Dynamic test data generators with sensible defaults
- **Helpers** (`../helpers/`) - `seedData`, `assertions`, `mockSupabase` utilities
- **Setup** (`../setup.ts`) - Global Supabase mock, jest configuration

## Coverage

Jest configured to:
- Exclude `*.d.ts`, `src/types/**`, `src/server.ts`
- Report coverage via `pnpm test:coverage`
- Default timeout: 10s (integration tests may need 15s+)

## Running Tests

```bash
pnpm test                           # All tests
pnpm test:watch                     # Watch mode
pnpm test:unit                      # Unit tests only
pnpm test tests/unit/services/*.test.ts  # Specific suite
pnpm test CombatService.test.ts     # Single file (partial match)
```
