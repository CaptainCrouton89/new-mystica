# CLAUDE.md

Factory pattern for dynamic test data generation. Factories create realistic, customizable objects for unit and integration tests without requiring database state.

## Pattern

Each factory is a class with static methods that return typed objects:

```typescript
export class ItemFactory {
  static createBase(itemType: string, baseLevel: number = 1): Item {
    // Generate valid item with defaults
  }

  static withStats(item: Item, overrides: Partial<Stats>): Item {
    // Add/override stats
  }

  static randomRarity(): Rarity {
    // Generate random valid enum value
  }
}
```

## Key Conventions

- **Static methods only** - No instance state
- **Immutable by default** - Return new objects, don't modify inputs
- **Sensible defaults** - All required fields have valid defaults
- **Chainable overrides** - Methods accept `Partial<T>` for customization
- **Type-safe** - Use database types from `src/types/database.types.ts`
- **No database calls** - Factories create plain objects; use helpers for seeding

## Usage

```typescript
import { ItemFactory, UserFactory } from '../factories/index.js';

// Basic creation with defaults
const sword = ItemFactory.createBase('sword');

// Customization
const epicSword = ItemFactory.createBase('sword', 10);
const styledSword = ItemFactory.withStats(epicSword, { attack: 50 });

// Random data
const randomRarity = ItemFactory.randomRarity();
```

## File Organization

Each factory covers one domain:
- `user.factory.ts` - User, Profile
- `item.factory.ts` - Item, ItemType
- `material.factory.ts` - Material, MaterialStack
- `location.factory.ts` - Location, LocationType
- `equipment.factory.ts` - Equipment, UserEquipment
- `combat.factory.ts` - Combat, CombatResult
- `chatter.factory.ts` - Chatter, Dialog
- `enemy.factory.ts` - Enemy, EnemyInstance
- `loadout.factory.ts` - Loadout
- `index.ts` - Re-export all factories

## Database Type Alignment

Always import from `src/types/database.types.ts`:

```typescript
import { Database } from '../../types/database.types.js';

type Item = Database['public']['Tables']['PlayerItems']['Row'];
type InsertItem = Database['public']['Tables']['PlayerItems']['Insert'];
```

## Common Methods Per Factory

- `create()` - Basic object with all required fields
- `createMany(count)` - Array of objects
- `with*(value)` - Fluent interface for customization
- `random*()` - Generate random valid enum/union values
