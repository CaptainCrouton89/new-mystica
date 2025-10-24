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
- **ItemRepository** - Player inventory, item CRUD, equipped state queries, image generation metadata, nested queries for materials and stats
- **ItemTypeRepository** - Base item types, stats, rarity definitions
- **EquipmentRepository** - Equipment slots, equipped items per slot
- **MaterialRepository** - Materials, stacks (composite PK), instances, application logic, atomic transactions
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

### N+1 Prevention with Nested Queries
ItemRepository and MaterialRepository use nested Supabase queries to fetch related data in a single request:

```typescript
// ItemRepository - Single query fetches item + type + materials + material templates
async findWithMaterials(itemId: string): Promise<ItemWithDetails> {
  const { data } = await this.client
    .from('items')
    .select(`
      *,
      itemtypes(*),
      itemmaterials(
        *,
        materialinstances:material_instance_id(
          *,
          materials(*)
        )
      )
    `)
    .eq('id', itemId)
    .single();
}
```

### MaterialStack Composite Primary Key (user_id, material_id, style_id)
MaterialRepository handles 3-column composite keys with manual WHERE clauses (no native PK support in Supabase):

```typescript
// Styles stack separately - same material with different style_id = different row
async findStackByUser(userId: string, materialId: string, styleId: string) {
  return await this.client
    .from('materialstacks')
    .select('*')
    .eq('user_id', userId)
    .eq('material_id', materialId)
    .eq('style_id', styleId)
    .single();
}
```

**Key insight:** `incrementStack()` performs upserts by checking if composite key exists, then inserting or updating accordingly.

### Image Generation Metadata
ItemRepository tracks material combo images across three fields:

```typescript
item.material_combo_hash;       // Hash of applied material IDs + style IDs
item.generated_image_url;       // URL to generated image (or base if no materials)
item.image_generation_status;   // 'pending' | 'generating' | 'complete' | 'failed'
```

Methods: `updateImageData(itemId, userId, comboHash, imageUrl, status)`

### RPC Transactions
Atomic multi-table operations use Supabase RPC functions. Examples:

```typescript
// ItemRepository - process_item_upgrade RPC
async processUpgrade(userId, itemId, goldCost, newLevel, newStats) {
  return this.rpc('process_item_upgrade', {
    p_user_id: userId,
    p_item_id: itemId,
    p_gold_cost: goldCost,
    p_new_level: newLevel,
    p_new_stats: newStats
  });
}

// MaterialRepository - apply_material_to_item RPC
async applyMaterialToItemAtomic(userId, itemId, materialId, styleId, slotIndex) {
  return this.rpc('apply_material_to_item', {
    p_user_id: userId,
    p_item_id: itemId,
    p_material_id: materialId,
    p_style_id: styleId,
    p_slot_index: slotIndex
  });
}
```

**MaterialRepository atomic operations:** `applyMaterialToItemAtomic()`, `removeMaterialFromItemAtomic()`, `replaceMaterialOnItemAtomic()`

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

### Batch Operations (for Combat Loot Distribution)
MaterialRepository provides batch increment for distributing loot rewards to players:

```typescript
async batchIncrementStacks(updates: Array<{
  userId: string;
  materialId: string;
  styleId: string;
  quantity: number;
}>): Promise<MaterialStackRow[]>
```

Useful for loot distribution after combat encounters.

### Item History Tracking
ItemRepository maintains audit trail of item events:

```typescript
async addHistoryEvent(itemId, userId, eventType, eventData);
async getItemHistory(itemId, userId): Promise<ItemHistoryEvent[]>
```

Supported event types: `'level_up'`, `'material_applied'`, `'equipped'`, etc.

### Error Handling
Throw custom errors from `src/utils/errors.ts`:
- `NotFoundError` - Entity doesn't exist
- `ValidationError` - Data invalid
- `UnauthorizedError` - User lacks permission
- `DatabaseError` - Supabase query failed
- `BusinessLogicError` - Invalid operation (insufficient materials, occupied slot, etc.)

## Testing
- Unit tests: `tests/unit/repositories/{Entity}Repository.test.ts`
- Integration tests use fixtures and factories from `tests/fixtures/` and `tests/factories/`
- Mock Supabase in test setup (`tests/setup.ts`)
