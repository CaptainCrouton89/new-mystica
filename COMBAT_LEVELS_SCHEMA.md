# Combat Levels Schema Investigation

## Summary

**No dedicated `combat_levels` table exists.** Combat levels (1-20) are embedded as integer columns in both `enemypools` and `lootpools` tables. Locations have **no** direct level association—pools are matched via `location_type` filtering.

---

## Schema Structure

### Tables Involved

#### 1. `locations` (30 rows)
- **Columns**: `id`, `name`, `lat`, `lng`, `location_type`, `state_code`, `country_code`, `created_at`
- **Key Point**: No `combat_level` column. Only has `location_type` (park, gym, library, coffee_shop)
- **Sample Data**: 30 SF locations (Golden Gate Park, Dolores Park, etc.)

#### 2. `enemypools` (51 rows)
- **Columns**: `id`, `name`, `combat_level` (INT), `filter_type` (VARCHAR), `filter_value`, `created_at`
- **Unique**: No direct location_id reference
- **Levels Available**: 1-20 (20 universal pools)
- **Filter Types**:
  - `universal` (matches all locations) — levels 1-20
  - `location_type` (matches by type) — levels 2-9 for park, gym, library, coffee_shop

#### 3. `lootpools` (10 rows)
- **Columns**: `id`, `name`, `combat_level` (INT), `filter_type` (VARCHAR), `filter_value`, `created_at`
- **Levels Available**: 1-10 (no loot pools for 11-20)
- **Filter Types**: Same as enemypools (universal + location_type)

#### 4. `enemypoolmembers` (234 rows)
- **Columns**: `enemy_pool_id`, `enemy_type_id`, `spawn_weight`
- **Purpose**: Maps enemies to pools with spawn weights for weighted selection

#### 5. `lootpoolentries` (410 rows)
- **Columns**: `loot_pool_id`, `lootable_type` (material|item), `lootable_id`, `drop_weight`
- **Purpose**: Maps materials/items to loot pools with drop weights

---

## Combat Level Distribution in Database

### Enemy Pools by Level

| Combat Level | Universal Pools | Location-Type Pools | Total |
|---|---|---|---|
| 1 | 1 | 0 | 1 |
| 2 | 1 | 4 | 5 |
| 3 | 1 | 4 | 5 |
| 4 | 1 | 4 | 5 |
| 5 | 1 | 4 | 5 |
| 6 | 1 | 4 | 5 |
| 7 | 1 | 4 | 5 |
| 8 | 1 | 4 | 5 |
| 9 | 1 | 4 | 5 |
| 10-20 | 1 each | 0 | 1 each |

**Key**: Levels 2-9 have location-specific pools (park, gym, library, coffee_shop). Levels 10-20 only have universal pools.

### Loot Pools by Level

| Combat Level | Universal Pools | Location-Type Pools | Total |
|---|---|---|---|
| 1-5 | 1 each | 4 each | 5 each |
| 6-10 | 1 each | 4 each | 5 each |
| 11-20 | 0 | 0 | 0 |

**Key**: No loot pools exist for combat levels 11-20.

---

## How Combat Levels Are Selected

### In `CombatService.startCombat()` (line 245)

```typescript
// Use player-selected level instead of derived combat level
const combatLevel = selectedLevel;

// Get matching enemy and loot pools for analytics
const enemyPoolIds = await locationService.getMatchingEnemyPools(locationId, combatLevel);
const lootPoolIds = await locationService.getMatchingLootPools(locationId, combatLevel);

// Select enemy from matching pools
const enemy = await this.selectEnemy(locationId, combatLevel);
```

**Process**:
1. Player passes `selectedLevel` (1-20) as parameter
2. Service calls `getMatchingEnemyPools(locationId, combatLevel)`
3. LocationService queries RPC function `get_matching_enemy_pools(location_id, combat_level)`

### RPC Function Logic (`005_location_pool_views.sql`, line 22)

```sql
CREATE OR REPLACE FUNCTION get_matching_enemy_pools(
    p_location_id UUID,
    p_combat_level INT
)
```

**Matching Algorithm**:
```sql
WHERE ep.combat_level = p_combat_level
  AND (
      -- Universal pools always match
      ep.filter_type = 'universal'
      -- Location type matching
      OR (ep.filter_type = 'location_type' AND ep.filter_value = location_rec.location_type)
      -- State matching
      OR (ep.filter_type = 'state' AND ep.filter_value = location_rec.state_code)
      -- Country matching
      OR (ep.filter_type = 'country' AND ep.filter_value = location_rec.country_code)
  )
```

**Result**: Combines universal pools + location-specific pools with aggregated spawn weights.

---

## Multiple Combat Levels Per Location

### YES - Multiple Levels DO Exist in DB

For any given location, the system **automatically** finds multiple combat levels:

**Example: Dolores Park (location_type='park')**

Levels 1-9 have matching pools:
- Level 1: "Level 1 Universal Enemies" (universal)
- Level 2: "Park Level 1-3 Enemies" (location_type=park) + "Level 2 Universal Enemies" (universal)
- Level 3: "Park Level 3 Enemies" (location_type=park) + "Level 3 Universal Enemies" (universal)
- ...continuing to level 9
- Levels 10-20: Only "Level N Universal Enemies" (no location-specific pools)

**Key Insight**: The database design assumes **all 30 locations have the same enemy/loot pools** because pools are matched by `location_type`, not individual location_id. Since all SF locations are mixed types (park, gym, etc.), the same pools apply to all locations of that type.

---

## Constraints & Indexes

### Composite Indexes (Performance)
```sql
CREATE INDEX IF NOT EXISTS idx_enemy_pools_filter_composite
ON enemypools(combat_level, filter_type, filter_value);

CREATE INDEX IF NOT EXISTS idx_loot_pools_filter_composite
ON lootpools(combat_level, filter_type, filter_value);

CREATE INDEX IF NOT EXISTS idx_locations_type_state_country
ON locations(location_type, state_code, country_code);
```

### No Unique Constraints
- No constraint preventing duplicate (combat_level, filter_type) combinations
- Pool members can have duplicate enemy_type_id in same pool (though unlikely)

---

## Implications for Level Selection

### Problem: Loot Pools Missing for Levels 11-20

Current seed data **only has loot pools for levels 1-10**. This means:

```typescript
// In CombatService.generateLoot() (line 1374)
const lootPoolIds = await locationService.getMatchingLootPools(locationId, combatLevel);
if (!lootPoolIds || lootPoolIds.length === 0) {
  // No loot pools found - returns base rewards only
  return {
    currencies: { gold: Math.floor(Math.random() * 20) + 5 },
    materials: [],
    items: [],  // <- No items drop for levels 11-20
    experience: combatLevel * 10,
  };
}
```

**Result**: Players selecting levels 11-20 get no loot drops, only gold.

### Solution Options

1. **Seed loot pools for 11-20** — Add 40 more loot pool entries
2. **Limit UI to level 10** — Only expose levels 1-10 in frontend
3. **Scale existing pools** — Use tier weights to support higher levels without new pools

---

## Example Query

To check all available levels for a location:

```sql
SELECT DISTINCT ep.combat_level
FROM enemypools ep
WHERE ep.filter_type = 'universal'
   OR (ep.filter_type = 'location_type' AND ep.filter_value = 'park')
ORDER BY ep.combat_level;

-- Returns: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
```

---

## Files Reference

- **Database docs**: `/Users/silasrhyneer/Code/new-mystica/docs/ai-docs/database.md`
- **Schema migration**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/migrations/001_initial_schema.sql` (not found in glob, but referenced in docs)
- **Pool matching RPC**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/migrations/005_location_pool_views.sql`
- **Combat service**: `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/CombatService.ts`
- **Location service**: References `getMatchingEnemyPools()` and `getMatchingLootPools()`

---

## Summary Table: Database Reality vs Assumptions

| Aspect | Database Reality | Implication |
|---|---|---|
| Multiple levels per location? | YES (1-20 for enemies, 1-10 for loot) | Players can select any level |
| Levels tied to locations? | NO (only location_type) | All parks have same pools, all gyms have same pools |
| Loot exists for all levels? | NO (only 1-10) | Levels 11-20 have no item/material drops |
| Levels stored in schema? | NO (embedded in pools) | No combat_levels table; levels are implicit |
| Unique constraints on levels? | NO | Duplicate pools could exist (architecture bug risk) |
