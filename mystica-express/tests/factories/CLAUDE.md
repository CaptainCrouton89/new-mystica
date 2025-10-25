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
import { ItemFactory, UserFactory, LocationFactory } from '../factories/index.js';

// Basic creation with defaults
const sword = ItemFactory.createBase('sword');

// Customization
const epicSword = ItemFactory.createBase('sword', 10);
const styledSword = ItemFactory.withStats(epicSword, { attack: 50 });

// Random data
const randomRarity = ItemFactory.randomRarity();

// Locations with spatial test support
const sfPark = LocationFactory.createSF('park');
const nearLocation = LocationFactory.createNear(37.7749, -122.4194, 500); // 500m radius
const cluster = LocationFactory.createCluster(37.7749, -122.4194, 5, 1000); // 5 locations
const exact = LocationFactory.createAtCoordinates(37.7749, -122.4194, 'landmark');
```

## File Organization

Each factory covers one domain:
- `user.factory.ts` - User, Profile
- `item.factory.ts` - Item, ItemType
- `material.factory.ts` - Material, MaterialStack
- `location.factory.ts` - Location with spatial test methods
- `equipment.factory.ts` - Equipment, UserEquipment
- `combat.factory.ts` - Combat, CombatResult
- `chatter.factory.ts` - Chatter, Dialog
- `enemy.factory.ts` - Enemy, EnemyInstance
- `loadout.factory.ts` - Loadout
- `index.ts` - Re-export all factories

## LocationFactory Patterns

`LocationFactory` provides specialized methods for geospatial testing:

- **`createRandom(type, overrides?)`** - Random US location
- **`createSF(type, overrides?)`** - San Francisco location (37.7-37.8 lat, -122.5 to -122.4 lng)
- **`createAtCoordinates(lat, lng, type?, overrides?)`** - Exact coordinates
- **`createNear(lat, lng, distanceMeters, overrides?)`** - Random location within distance radius (proximity tests)
- **`createCluster(centerLat, centerLng, count, radiusMeters?)`** - Multiple nearby locations
- **`createForInsert(overrides?)`** - LocationInsert type for database operations
- **`createMany(count, factory?)`** - Batch creation with custom factory

All methods support `overrides` parameter for customization (e.g., `{ image_url: 'custom.jpg' }`).

## Database Type Alignment

Always import from `src/types/database.types.ts`:

```typescript
import { Database } from '../../types/database.types.js';

type Item = Database['public']['Tables']['PlayerItems']['Row'];
type InsertItem = Database['public']['Tables']['PlayerItems']['Insert'];
type Location = Database['public']['Tables']['locations']['Row'];
```

## Common Methods Per Factory

- `create()` or `createBase()` - Basic object with all required fields
- `createMany(count)` - Array of objects
- `with*(value)` - Fluent interface for customization
- `random*()` - Generate random valid enum/union values
- `createFor*()` - Specialized insert types for database operations
