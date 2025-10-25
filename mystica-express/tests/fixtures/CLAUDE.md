# CLAUDE.md

Test fixtures directory providing standardized, reusable test data objects for unit and integration tests.

## Overview

Static fixtures (constants) and factory functions for creating test data. All fixtures maintain consistency with the game's domain model and database schema.

## Files and Exports

| File | Purpose | Key Exports |
|------|---------|-------------|
| `users.fixture.ts` | User test data | `ANONYMOUS_USER`, `EMAIL_USER`, `ADMIN_USER`, `createUser()` |
| `locations.fixture.ts` | Location test data | `SF_LIBRARY`, `SF_PARK`, `SF_MUSEUM`, `createLocation()` |
| `items.fixture.ts` | PlayerItem test data | `BASE_SWORD`, `BASE_SHIELD`, `CRAFTED_SWORD`, `STYLED_ITEM`, `createItem()` |
| `materials.fixture.ts` | Material test data | Iron, Crystal, Wood constants, `createMaterial()` |
| `combat.fixture.ts` | Combat scenario data | Enemy fixtures, battle setup helpers |
| `index.ts` | Central export | Re-exports all fixtures from above files |

## Usage Pattern

Always import from the central index:

```typescript
import {
  ANONYMOUS_USER,
  SF_LIBRARY,
  BASE_SWORD,
  createUser,
  createLocation
} from '../fixtures/index.js';

// Static fixtures for common test scenarios
const { id: userId } = ANONYMOUS_USER;
const { id: locationId } = SF_LIBRARY;

// Factory functions for custom data
const customUser = createUser({ email: 'custom@test.com' });
const customItem = createItem({ level: 10 });
```

## Design Principles

1. **Static Constants for Standard Cases:** Predefined objects (e.g., `ANONYMOUS_USER`, `BASE_SWORD`) cover the most common test scenarios. Use these to keep test setups minimal.

2. **Factories for Customization:** Each fixture file exports a `create*()` function that spreads the default object and merges user overrides:
   ```typescript
   export function createUser(overrides: Partial<User> = {}): User {
     return { ...ANONYMOUS_USER, ...overrides };
   }
   ```

3. **Realistic IDs:** All IDs are valid UUIDs matching the database schema. Location IDs map to actual SF test locations in the remote Supabase instance.

4. **Domain Accuracy:** Fixtures reflect actual game rules (e.g., `ADMIN_USER.vanity_level: 100`, `BASE_SWORD.atkPower: 0.6`). Do not use unrealistic test data.

5. **Minimal but Complete:** Fixtures include only essential fields required by tests. Optional fields default to `null` or empty arrays.

## Adding New Fixtures

1. Create a new fixture file: `{domain}.fixture.ts`
2. Define TypeScript interfaces matching the domain model
3. Export 2-3 common variants as constants
4. Export a `create{Domain}()` factory function
5. Re-export from `index.ts`

Example:
```typescript
// quest.fixture.ts
export interface Quest {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
}

export const MAIN_QUEST: Quest = {
  id: 'uuid-123',
  user_id: ANONYMOUS_USER.id,
  title: 'Defeat the Boss',
  completed: false
};

export function createQuest(overrides: Partial<Quest> = {}): Quest {
  return { ...MAIN_QUEST, ...overrides };
}

// index.ts
export * from './quest.fixture.js';
```

## Test Integration

Use fixtures in test setup:

```typescript
describe('EquipmentService', () => {
  it('should equip item', () => {
    const userId = ANONYMOUS_USER.id;
    const itemId = BASE_SWORD.id;

    const result = equipmentService.equipItem(userId, itemId);
    expect(result.slot).toBe('weapon');
  });

  it('should handle custom items', () => {
    const customItem = createItem({ level: 20, base_type: 'armor' });
    expect(customItem.level).toBe(20);
    expect(customItem.base_type).toBe('armor');
  });
});
```

## Notes

- Fixtures are **read-only** in tests. Do not mutate constants.
- IDs are **stable** across test runs for consistent test data assertions.
- Material IDs (e.g., `'iron'`, `'crystal'`) must match the `Materials` table seed data.
- Timestamps use ISO 8601 format: `'2025-01-20T12:00:00Z'`
