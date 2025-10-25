# CLAUDE.md

Integration test suite for the Mystica Express backend. These tests validate full API endpoint behavior, middleware interactions, and service integration.

## Directory Structure

```
integration/
├── auth.test.ts              # Email/password authentication
├── auth-device.test.ts       # Device-based anonymous authentication
├── combat.test.ts            # Combat flow and damage calculations
├── combat-dialogue.test.ts    # Combat with AI-generated dialogue
├── enemies.test.ts           # Enemy spawning and stats
├── equipment.test.ts         # Equipment equip/unequip operations
├── locations.test.ts         # Geospatial location queries
├── openai-dialogue.test.ts   # OpenAI dialogue generation
├── profile.test.ts           # User profile management
└── agent-responses/          # Auto-generated agent investigation files
```

## Test Patterns

### Setup Pattern
Every test file follows this structure:
```typescript
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { supabase } from '../../src/config/supabase.js';
import { ANONYMOUS_USER, EMAIL_USER } from '../fixtures/index.js';

describe('Feature Name', () => {
  beforeAll(async () => {
    // Create test data if needed
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should handle happy path', async () => {
    // Test implementation
  });
});
```

### Making API Calls
```typescript
const response = await fetch('http://localhost:3000/api/v1/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(payload)
});

const data = await response.json();
expect(response.status).toBe(201);
```

### Using Fixtures and Factories
```typescript
import { ANONYMOUS_USER, BASE_SWORD } from '../fixtures/index.js';
import { ItemFactory, LocationFactory } from '../factories/index.js';

// Static fixture data
const userId = ANONYMOUS_USER.id;

// Dynamic factory data
const customItem = ItemFactory.createBase('shield', 5);
const testLocation = LocationFactory.create();
```

### Assertions
```typescript
import { expectValidItem, expectValidNormalizedStats } from '../helpers/assertions.js';

expect(result).toHaveProperty('id');
expect(result.status).toBe('success');
expectValidItem(result.item);
```

## Running Tests

```bash
# All integration tests
pnpm test:integration

# Specific test file
pnpm test tests/integration/combat.test.ts

# Watch mode
pnpm test:watch

# With coverage
pnpm test:coverage
```

## Key Helpers

**seedData.js** - Load game data from seed files:
```typescript
import { loadSeededItems, getMaterialById, getRandomMaterials } from '../helpers/seedData.js';

const items = await loadSeededItems();
const iron = getMaterialById('iron');
const materials = getRandomMaterials(3);
```

**mockSupabase.js** - Mock Supabase client for tests:
```typescript
import { mockSupabase } from '../helpers/mockSupabase.js';

mockSupabase().insert('table').returns({ data: [...] });
```

## Common Test Scenarios

### Authentication Tests
- Device-based flow (generate token, authenticate)
- Email/password flow (sign up, sign in, refresh)
- Invalid credentials
- Expired tokens

### Equipment Tests
- Equip/unequip operations
- Slot validation (weapon, offhand, armor, etc.)
- Stat calculations after equip
- Material application

### Combat Tests
- Enemy spawning with correct stats
- Damage calculation and hit results
- Combat log generation
- AI dialogue integration

### Location Tests
- Nearby location queries with PostGIS
- Pagination and filtering
- Distance calculations
- Region-specific spawning

## Timeout and Performance

- Default timeout: 10 seconds
- Location queries: ~50-200ms
- Combat calculations: ~100-500ms
- Image generation: ~20s (blocking in MVP0)
- If test times out, check for unresolved promises or missing `await`

## Debugging

```bash
# Run single test with detailed output
NODE_DEBUG=* pnpm test tests/integration/equipment.test.ts

# Check if server is running
curl http://localhost:3000/api/v1/

# Check database connection
pnpm supabase:types
```

## Notes

- Tests use remote Supabase instance (kofvwxutsmxdszycvluc)
- `.bak` files are backup copies - ignore them
- All new tests should follow existing patterns in this directory
- Use factories for dynamic data, fixtures for static reference data
