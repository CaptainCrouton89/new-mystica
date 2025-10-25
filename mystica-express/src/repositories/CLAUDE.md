# repositories/ - CLAUDE.md

Repository layer for data access. All repositories extend `BaseRepository<T>` except `StyleRepository` (read-only singleton).

## Core Patterns

### BaseRepository<T>
Base class at `BaseRepository.ts`. Provides:
- `findById(id)` - Find single entity by UUID
- `findMany(filters, options)` - Query with filters, pagination, sorting
- `create(data)` - Insert new record
- `update(id, data)` - Update existing record
- `delete(id)` - Delete record
- `rpc(functionName, params)` - RPC query building

**Constructor Pattern:**
```typescript
export class ItemRepository extends BaseRepository<ItemRow> {
  constructor(client: SupabaseClient = supabase) {
    super('items', client);
  }
}
```

### Type Safety
- Use `Database` types from `src/types/database.types.ts`
- Define `Row` and `Insert` type aliases in each repository
- Never use `any` type

## Domain Repositories

**Core Game:**
- **ItemRepository** - Item CRUD, ownership validation, nested queries for types/materials, history audit trail, image metadata (combo_hash, generated_image_url, image_generation_status)
- **ItemTypeRepository** - Base item types, stats, rarity definitions
- **EquipmentRepository** - Equipment slots, equipped items per slot
- **MaterialRepository** - Materials, stacks (composite PK: user_id/material_id/style_id), instances, atomic transactions
- **WeaponRepository** - Weapon-specific queries and stat calculations

**Combat & Progression:**
- **CombatRepository** - PostgreSQL-only session management with TTL expiry (60min), combat log events, player combat history analytics, chatter logging
- **EnemyRepository** - Enemy types with normalized stats, tiers, polymorphic enemyloot queries
- **ProfileRepository** - User profiles, stats, progression data
- **ProgressionRepository** - Level, experience, unlocks

**World:**
- **LocationRepository** - PostGIS spatial queries, pool-based enemy/loot matching, weighted random selection with style inheritance
- **LoadoutRepository** - Saved equipment configurations
- **PetRepository** - Pet inventory, active pet state

**Supporting:**
- **StyleRepository** - Read-only style lookups (singleton export)
- **RarityRepository** - Rarity tiers and bonuses
- **AnalyticsRepository** - User engagement metrics
- **ImageCacheRepository** - Generated item image cache

## Special Implementations

### StyleRepository (Non-BaseRepository)
Read-only singleton pattern (doesn't extend BaseRepository). Exports `styleRepository` singleton instance.

Methods:
- `findAll()` - All styles ordered by spawn_rate (desc), style_name (asc)
- `findById(styleId)` - Throws DatabaseError if not found
- `findByName(styleName)` - Returns null if not found
- `exists(styleId)` - Boolean check

Uses Supabase client directly (no base class methods).

### CombatRepository (PostgreSQL Session Management)
Manages active combat sessions with TTL-based expiry.

**Session Lifecycle:**
- `createSession()` - Create new session, validates no existing active session
- `getActiveSession(sessionId)` - Get session by ID with expiry check (null if expired/completed)
- `getUserActiveSession(userId)` - Get most recent incomplete session within TTL
- `completeSession(sessionId, result)` - Mark session complete with outcome ('victory', 'defeat', 'escape', 'abandoned')
- `deleteSession(sessionId)` - Emergency cleanup (permanent delete)

**Session Expiry:**
- TTL: 60 minutes from `created_at` timestamp
- `isSessionExpired(createdAt)` - Check if session is older than TTL
- `cleanupExpiredSessions()` - Batch mark expired sessions as 'abandoned'

**Combat Log Events:**
- `addLogEvent(combatId, event)` - Insert turn-by-turn event (seq, ts, actor, eventType, payload)
- `getLogEvents(combatId)` - Get all events ordered by seq
- `getLogEventsByActor(combatId, actor)` - Filter events by player/enemy

**Player Combat History:**
- `getPlayerHistory(userId, locationId)` - Per-location history (attempts, victories, defeats, streaks)
- `updatePlayerHistory(userId, locationId, result)` - Call RPC to update history atomically
- `incrementAttempts(userId, locationId)` - Increment attempt count on session start

**Analytics:**
- `getUserCombatStats(userId)` - Aggregated stats across all locations
- `getTopLocations(userId, limit)` - Top locations by win rate

**Chatter Logging (AI Dialogue):**
- `getPlayerCombatContext(userId, locationId)` - Get combat history for dialogue generation
- `logChatterAttempt(logEntry)` - Log AI dialogue attempts (non-throwing for reliability)

### EnemyRepository (Normalized Stat System)
Manages enemy types with direct stat calculation and polymorphic loot.

**Enemy Type Queries:**
- `findEnemyTypeById(id)` - Get enemy type or null
- `findAllEnemyTypes(options)` - Get all enemies with optional limit/offset/sort
- `findEnemyTypesByTier(tierId)` - Get enemies in tier
- `findEnemyTypesByStyle(styleId)` - Get enemies with style
- `getStylesForEnemyType(enemyTypeId)` - Get available styles for enemy

**Stats Calculation:**
- `getEnemyTypeWithTier(enemyTypeId)` - Join enemy to tier data
- `getEnemyRealizedStats(enemyTypeId, combatLevel)` - Compute stats using `StatsService`
  - Formula: `base_stat × tier.difficulty_multiplier` for ATK/DEF
  - HP: `base_hp × tier.difficulty_multiplier` (no level scaling)
  - Returns typed `EnemyRealizedStats` interface

**Loot System:**
- `getEnemyLootTable(enemyTypeId, lootableType?)` - Get polymorphic enemyloot entries
  - Optional filter for 'material' | 'item_type'
  - Returns `EnemyLoot[]` with lootable_id and lootable_type

### N+1 Prevention with Nested Queries
ItemRepository and MaterialRepository use nested Supabase queries:

```typescript
// Single request fetches item + type + materials + material templates
async findWithMaterials(itemId: string): Promise<ItemWithDetails> {
  const { data } = await this.client
    .from('items')
    .select(`
      *,
      itemtypes(*),
      itemmaterials(
        *,
        materialinstances:material_instance_id(*, materials(*))
      )
    `)
    .eq('id', itemId)
    .single();
}
```

### MaterialStack Composite Primary Key (user_id, material_id, style_id)
Manual WHERE clauses for 3-column composite keys (Supabase has no native multi-column PK support):

```typescript
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

### RPC Transactions
Atomic multi-table operations via Supabase RPC functions:

```typescript
// ItemRepository
async processUpgrade(userId, itemId, goldCost, newLevel, newStats) {
  return this.rpc('process_item_upgrade', {
    p_user_id: userId,
    p_item_id: itemId,
    p_gold_cost: goldCost,
    p_new_level: newLevel,
    p_new_stats: newStats
  });
}

// MaterialRepository - atomic operations
applyMaterialToItemAtomic()
removeMaterialFromItemAtomic()
replaceMaterialOnItemAtomic()
```

### LocationRepository Spatial & Pool Systems
Handles PostGIS geospatial queries and pool-based enemy/loot matching with style inheritance.

**Spatial Queries:**
- `findNearby(lat, lng, radius)` - Calls `get_nearby_locations` RPC with diagnostic logging
- Returns `LocationWithDistance[]` with `distance_meters` from PostGIS `ST_DWithin`
- Includes RPC debugging output showing parameter values and returned field names

**Pool Filtering System:**
- `buildPoolFilter(location)` - Builds composite OR filter for Supabase queries
- Filter types: `universal` | `location_type` | `state` | `country` | `lat_range` | `lng_range`
- Universal pools always match; location-specific pools filter by type/state/country codes
- TODO: Implement lat_range and lng_range matching (requires parsing "min,max" ranges)

**Enemy Pools (Combat Initialization):**
- `getMatchingEnemyPools(location, combatLevel)` - Finds pools by location and combat level
- `getEnemyPoolMembers(poolIds)` - Fetches spawn weights for pool members
- `selectRandomEnemy(poolMembers)` - Weighted random selection returning `enemy_type_id`
- `getAggregatedEnemyPools(locationId, combatLevel)` - Combines pools and aggregates spawn weights by enemy type

**Loot Pools (Combat Rewards):**
- `getMatchingLootPools(location, combatLevel)` - Finds pools by location and combat level
- `getLootPoolEntries(poolIds)` - Fetches polymorphic loot entries (material or item_type) with names via parallel queries
- `getLootPoolTierWeights(poolIds)` - Fetches tier multipliers (affect material drop rates by rarity tier)
- `selectRandomLoot(poolEntries, tierWeights, enemyStyleId, dropCount)` - Weighted multi-drop with:
  - Tier weight multipliers applied to materials (items use base weight)
  - Style inheritance from enemy (`style_id`)
  - Returns `LootDrop[]` array (up to `dropCount` drops per call)
- `getAggregatedLootPools(locationId, combatLevel)` - Combines pools and applies tier weight multipliers to entries

**Helper Methods:**
- `getStyleName(styleId)` - Fetches style name, falls back to 'normal'
- `calculateMaterialDropWeight(entry, tierWeights)` - Applies tier multiplier to base weight (simplified: assumes 'common' tier)

## Error Handling

Use custom errors from `src/utils/errors.ts`:
- `NotFoundError` - Entity doesn't exist
- `ValidationError` - Data invalid
- `UnauthorizedError` - User lacks permission
- `DatabaseError` - Supabase query failed
- `BusinessLogicError` - Invalid operation (insufficient materials, occupied slot, etc.)

## Testing
- Unit tests: `tests/unit/repositories/{Entity}Repository.test.ts`
- Integration tests use fixtures and factories from `tests/fixtures/` and `tests/factories/`
- Mock Supabase in test setup (`tests/setup.ts`)
