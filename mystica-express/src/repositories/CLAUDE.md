# repositories/ - CLAUDE.md

This directory contains the repository layer for data access, following the repository pattern with a `BaseRepository<T>` base class.

## Core Patterns

### BaseRepository<T>
All repositories extend `BaseRepository<T>` (BaseRepository.ts). Provides:
- `findById(id)` - Find single entity by UUID
- `findMany(filters, options)` - Query with filters, pagination, sorting
- `create(data)` - Insert new record
- `update(id, data)` - Update existing record
- `delete(id)` - Delete record
- RPC query building via `this.rpc(functionName, params)`

### Repository Naming
- Class: `{Entity}Repository` (e.g., `ItemRepository`, `CombatRepository`)
- Table name: Passed to `super(tableName, client)` in constructor
- File: `{Entity}Repository.ts`

### Type Safety
- Use `Database` types from `src/types/database.types.ts`
- Define `Row` and `Insert` type aliases in each repository
- Never use `any` type - look up proper types from database.types.ts

### Constructor Pattern
```typescript
export class ItemRepository extends BaseRepository<Item> {
  constructor(client: SupabaseClient = supabase) {
    super('PlayerItems', client);
  }
}
```

## Domain-Specific Repositories

### Core Game Entities
- **ItemRepository** - Player inventory, item CRUD, equipped state queries
- **ItemTypeRepository** - Base item types, stats, rarity definitions
- **EquipmentRepository** - Equipment slots, equipped items per slot
- **MaterialRepository** - Materials, stacks, instances, application logic
- **WeaponRepository** - Weapon-specific queries and stat calculations

### Combat & Progression
- **CombatRepository** - Combat logs, turn history, battle transactions
- **EnemyRepository** - Enemy types, spawning, difficulty scaling
- **ProfileRepository** - User profiles, stats, progression data
- **ProgressionRepository** - Level, experience, unlocks

### World & Items
- **LocationRepository** - Geospatial queries, enemy/loot pool matching, weighted random selection
- **LoadoutRepository** - Saved equipment configurations
- **PetRepository** - Pet inventory, active pet state

### Supporting Data
- **StyleRepository** - Material styles, visual effects
- **RarityRepository** - Rarity tiers and bonuses
- **AnalyticsRepository** - User engagement metrics
- **ImageCacheRepository** - Generated item image cache

## Common Patterns

### RPC Queries
Complex transactional operations use Supabase RPC functions:
```typescript
async equipItem(userId: string, itemId: string, slot: EquipmentSlot) {
  const { data, error } = await this.rpc('equip_item_transaction', {
    p_user_id: userId,
    p_item_id: itemId,
    p_slot: slot
  });
}
```

### LocationRepository Pool Systems
Two complementary systems for combat enemy selection and loot drops:

**Enemy Pools:** Determine which enemies spawn at a location
- Query `enemypools` via `combat_level` + location filters
- Get members via `enemypoolmembers` table (enemy_type_id + spawn_weight pairs)
- Use `selectRandomEnemy(poolMembers)` for weighted random selection
- Pool filters built via `buildPoolFilter()`: `universal` | `location_type` | `state` | `country`

**Loot Pools:** Determine drops from defeated enemies
- Query `lootpools` via same `combat_level` + location filters
- Get entries via `lootpoolentries` (polymorphic: material or item_type + drop_weight)
- Get tier weights via `lootpooltierweights` (common/uncommon/rare/epic/legendary multipliers)
- Use `selectRandomLoot(entries, tierWeights, enemyStyleId, dropCount)` for multi-drop selection
- Loot drops inherit `style_id` from defeated enemy for material styling

**Weighted Random Selection Pattern:**
```typescript
// Used by selectRandomEnemy() and selectRandomLoot()
const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
const randomValue = Math.random() * totalWeight;
let currentWeight = 0;
for (const entry of entries) {
  currentWeight += entry.weight;
  if (randomValue <= currentWeight) return entry; // Selected
}
```

### Filters & Options
`findMany()` supports:
```typescript
findMany(
  { user_id: userId, rarity: 'epic' },  // filters
  {
    limit: 10,
    offset: 0,
    orderBy: 'created_at',
    ascending: false
  }
)
```

### Error Handling
Throw custom errors from `src/utils/errors.ts`:
- `NotFoundError` - Entity doesn't exist
- `ValidationError` - Data invalid
- `UnauthorizedError` - User lacks permission
- `DatabaseError` - Supabase query failed

## Testing
- Unit tests: `tests/unit/repositories/{Entity}Repository.test.ts`
- Integration tests use fixtures and factories from `tests/fixtures/` and `tests/factories/`
- Mock Supabase in test setup (`tests/setup.ts`)
