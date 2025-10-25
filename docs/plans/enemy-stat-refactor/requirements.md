# Enemy Stat & Loot System Redesign

**Status:** ✅ Database Migrations Complete, ⏳ Application Code Updates In Progress
**Date:** 2025-01-24
**Author:** Combat System Redesign
**Migrations Applied:** 2025-01-24

## Implementation Status

- ✅ **Database Schema Updated** - Both migration phases complete
- ✅ **New Tables Created** - `enemyloot` table ready for population
- ✅ **Old Tables Removed** - Loot pool system completely removed
- ✅ **TypeScript Types Regenerated** - New schema reflected in `database.types.ts`
  - ✅ `enemytypes`: Has normalized stat columns, missing old absolute columns
  - ✅ `tiers`: Has multiplier columns, missing old additive columns
  - ✅ `enemyloot`: New table with polymorphic FK structure
  - ✅ `combatsessions`: `applied_loot_pools` removed (still shows in types due to cache, will update on next migration)
- ⏳ **Application Code** - Needs updates to use new stat calculations and loot system
- ⏳ **Data Population** - `enemyloot` table needs loot entries for all enemies
- ⏳ **Stat Tuning** - Enemy normalized stats currently at default 0.25 each

## Overview

Redesign enemy stats to scale linearly with player progression and consolidate loot drops to enemy-specific tables, removing the complex pool system.

## Core Principles

1. **Zone-based combat system** - All attacks use 5-zone targeting with zone multipliers and crit mechanics
2. **Enemy combat stats (atk/def) scale with player level** - Fair combat at all progression stages
3. **HP does NOT scale with level** - Combat length stays consistent, difficulty comes from damage/defense scaling
4. **Accuracy affects zone probability** - High accuracy = better zones, low accuracy = poor zones
5. **Tier = difficulty multiplier** - Same enemy can be easy/normal/hard variant
6. **Enemy-specific loot tables** - No separate pool system, cleaner design
7. **Harder enemies drop better loot** - Direct correlation between risk and reward

## Key Design Decisions

### HP Does NOT Scale with Player Level

**Current System:**
- Enemy HP: Fixed absolute values (e.g., 120 HP)
- Player HP: Does NOT scale with level (fixed pool per player)

**New System:**
- Enemy HP: `base_hp × tier.difficulty_multiplier` (no combat_level factor)
- Combat Stats: Scale with `combat_level` to maintain challenge
- **Result:** Enemies at level 5 and level 20 have identical HP, but vastly different attack/defense

**Why?**
- Prevents HP sponge effect at high levels
- Keeps fight duration consistent
- Difficulty comes from enemy damage output and tankiness, not just large HP pools
- Matches player HP design (players don't get more HP as they level either)

## Combat Mechanics Overview

### Zone-Based Combat System

All attacks (player and enemy) use a **5-zone hit system** with zone-based multipliers and crit chances:

| Zone | Quality | Zone Multiplier | Crit Chance | Crit Bonus Range |
|------|---------|----------------|-------------|------------------|
| 1 | Perfect | 1.5x | 100% | 0 - 2.0x |
| 2 | Great | 1.25x | 75% | 0 - 1.5x |
| 3 | Good | 1.0x | 50% | 0 - 1.25x |
| 4 | Poor | 0.75x | 25% | 0 - 1.1x |
| 5 | Miss | 0.5x | 0% | 1.0x (no crit) |

**Key Points:**
- **Crits can happen in ANY zone** (even zone 5)
- Better zones = higher crit chance + bigger maximum crit bonus
- Zone multiplier stacks with crit multiplier
- Final damage = base_stat × zone_multiplier × crit_multiplier

### Accuracy System

**Player Accuracy:** Determined by player input (weapon spin timing in actual gameplay)

**Enemy Accuracy:** Simulated using `atk_accuracy_normalized` (0.0 - 1.0)
- **High accuracy (0.8-1.0):** ~80-100% chance to hit zone 1-2
- **Medium accuracy (0.4-0.7):** Distributed across zones 2-4
- **Low accuracy (0.0-0.3):** ~70% chance to hit zones 4-5

**Zone 1 probability formula:**
```typescript
zone1_chance = 0.05 + (accuracy × 0.95)
// Examples:
// - 0.0 accuracy: 5% zone 1
// - 0.5 accuracy: 52.5% zone 1
// - 1.0 accuracy: 100% zone 1
```

**Zone 2 base probability:** 20% at 0 accuracy (decreases as accuracy increases since zone 1 takes priority)

### Stat Calculation Flow

```
Base Stat → Zone Multiplier → Crit Roll → Final Value
    ↓             ↓               ↓           ↓
  Level ×    Zone 1-5 (×)   Crit chance   Damage dealt
  Rarity     0.5-1.5x       by zone       or blocked
```

## Enemy Stat System

### Core Design Decision: HP Does NOT Scale

**Rationale:**
- Player HP does NOT scale with level (fixed pool)
- Enemy HP should NOT scale with player level
- Combat length stays consistent across progression
- Difficulty comes from enemy attack/defense scaling, not HP inflation

### Stat Distribution

**Current (absolute values that don't scale):**
```
enemytypes: {
  atk_power: 10      // Fixed base stat
  def_power: 10
  base_hp: 120       // Fixed HP value
  // Tier adds fixed bonuses
}
```

**New (hybrid system - attack/defense normalized, HP absolute):**
```
enemytypes: {
  // Combat stats as normalized distribution (sum = 1.0)
  atk_power_normalized: 0.33      // 33% of stat budget
  atk_accuracy_normalized: 0.17   // 17% of stat budget
  def_power_normalized: 0.33      // 33% of stat budget
  def_accuracy_normalized: 0.17   // 17% of stat budget
  // Total: 1.0

  // HP as absolute value (does NOT scale with level)
  base_hp: 1200                   // Fixed HP per enemy type
}
```

### Final Stat Calculation

```typescript
const baseStat = 10; // Baseline stat value per point (matches player system)

// For combat stats (scale with player level)
// Base stat values (before zone/crit modifiers)
enemy_base_atk = normalized_atk_power × 8 × combat_level × tier.difficulty_multiplier × baseStat
enemy_base_def = normalized_def_power × 8 × combat_level × tier.difficulty_multiplier × baseStat

// For HP (absolute value, only scales with tier)
enemy_hp = base_hp × tier.difficulty_multiplier
```

**Explanation:**
- `normalized_stat`: Enemy's stat distribution (0.0 - 1.0)
- `8`: Number of player equipment slots (ensures parity)
- `combat_level`: Player's avg_item_level (from Users table)
- `tier.difficulty_multiplier`: Difficulty scaling (0.7 - 2.0)
- `baseStat`: 10 (matches player base_stat_value)
- `base_hp`: Fixed HP value defined per enemy type
- **HP only multiplied by tier difficulty** - NOT by combat_level

### Combat Damage Calculation

#### Player Attack Calculation

**Base Attack Value:**
```typescript
// Sum all equipped items
player_base_atk = sum(
  item.atk_power × item.level × item.rarity_multiplier
  for each equipped item
)
```

**Final Attack Value (with zone modifiers):**
```typescript
player_attack = player_base_atk × hit_zone_multiplier × crit_multiplier

// Hit zone multiplier: 0.5 - 1.5 based on zone
// Crit multiplier: 1.0 - 2.0 based on zone quality
```

**Zone System:**
- **Zone 1 (Perfect):** 100% crit chance, 1.5-2.0x crit bonus range, 1.5x zone multiplier
- **Zone 2 (Great):** 30% crit chance, 1.2-1.7x crit bonus range, 1.0x zone multiplier
- **Zone 3 (Good):** 20% crit chance, 1.1x-1.5x crit bonus range, .75x zone multiplier
- **Zone 4 (Poor):** 10% crit chance, 1.1-1.2x crit bonus range, 0.5x zone multiplier
- **Zone 5 (Miss):** 0% crit chance. 0x zone multiplier (you take damage instead)

**Critical Hit Mechanics:**
- Crits can occur in ANY zone
- Crit chance decreases linearly from zone 1 → zone 5
- **Crit bonus is RNG-based:** When a crit occurs, the bonus multiplier is randomly rolled between minimum and zone's maximum crit bonus
- Better zones = higher maximum crit bonus potential (zone 1 can roll up to 2.0x, zone 4 only up to 1.2x). 

#### Player Defense Calculation

**Base Defense Value:**
```typescript
player_base_def = sum(
  item.def_power × item.level × item.rarity_multiplier
  for each equipped item
)
```

**Final Defense Value (with zone modifiers):**
```typescript
player_defense = player_base_def × hit_zone_multiplier
```

#### Enemy Attack Calculation

**Base Attack Value:**
```typescript
enemy_base_atk = atk_power_normalized × 8 × combat_level × tier.difficulty_multiplier
```

**Zone Hit Simulation (Based on Accuracy):**
```typescript
// Enemy accuracy determines zone hit probability
const accuracy = atk_accuracy_normalized; // 0.0 - 1.0

// Zone 1 (Perfect) probability
zone1_chance = 0.05 + (accuracy × 0.95)  // 5% at 0 accuracy, 100% at 1.0 accuracy
// Examples:
// - accuracy = 0.0: 5% chance zone 1
// - accuracy = 0.5: 52.5% chance zone 1
// - accuracy = 1.0: 100% chance zone 1

// Zone 2 (Great) probability (at low accuracy)
zone2_base_chance = 0.20  // 20% at 0 accuracy
// Decreases as accuracy increases (zone 1 takes priority)

// Zone distribution scaling:
// High accuracy (0.8-1.0): Heavily weighted to zones 1-2
// Medium accuracy (0.4-0.7): Even distribution across zones 2-4
// Low accuracy (0.0-0.3): Heavily weighted to zones 4-5
```

The bonus received from the crit scales as it would for the player: 

**Zone System:**
- **Zone 1 (Perfect):** 100% crit chance, 1.5-2.0x crit bonus range, 1.5x zone multiplier
- **Zone 2 (Great):** 30% crit chance, 1.2-1.7x crit bonus range, 1.0x zone multiplier
- **Zone 3 (Good):** 20% crit chance, 1.1x-1.5x crit bonus range, .75x zone multiplier
- **Zone 4 (Poor):** 10% crit chance, 1.1-1.2x crit bonus range, 0.5x zone multiplier
- **Zone 5 (Miss):** 0% crit chance. 0x zone multiplier (you take damage instead)

**Final Enemy Attack Value:**
```typescript
enemy_attack = enemy_base_atk × hit_zone_multiplier × crit_multiplier

// Crit calculation same as player (zone-based)
// Zone multipliers same as player
```

**Detailed Zone Probability Distribution:**
```
type ZoneDistribution = {
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
};

/**
 * Smooth, anchor-driven zone distribution.
 *
 * Anchors (can be tweaked):
 *  - p1(a): (0.05→2%), (0.25→20%), (0.50→50%), (1.00→95%)
 *  - p2(a): (0.00→45%), (0.05→50%), (0.25→58%), (0.50→45%), (1.00→5%)
 *
 * The remainder is split to zones 3–5 with small tails so 4/5 stay rare.
 */
export function calculateZoneProbabilities(accuracy: number): ZoneDistribution {
  const a = clamp01(accuracy);

  // --- Smooth anchor curves for Zone 1 and Zone 2 ---
  const p1 = curve(a, [
    { x: 0.05, y: 0.02 }, // at 0.05 → 2%
    { x: 0.25, y: 0.20 }, // at 0.25 → 20%
    { x: 0.50, y: 0.50 }, // at 0.50 → 50%
    { x: 1.00, y: 0.95 }, // saturate high
  ]);

  const p2 = curve(a, [
    { x: 0.00, y: 0.45 }, // slight head-start so zone2 dominates at awful accuracy
    { x: 0.05, y: 0.50 }, // at 0.05 → 50%
    { x: 0.25, y: 0.58 }, // at 0.25 → ~58%
    { x: 0.50, y: 0.45 }, // at 0.50 → 45%
    { x: 1.00, y: 0.05 }, // decays with high accuracy
  ]);

  // Remaining mass goes to 3/4/5 with small, accuracy-shaped tails
  const remaining = Math.max(0, 1 - p1 - p2);

  // Shape weights (tweakable): keep 3 modest, 4 hard, 5 rarer still
  const w3 = (1 - 0.2 * a);            // gently shrinks as accuracy rises
  const w4 = 0.12 * Math.pow(1 - a, 0.7); // small tail, “hardish” even at low a
  const w5 = 0.03 * Math.pow(1 - a, 2.4); // very rare, even at terrible a

  const wSum = w3 + w4 + w5 || 1;
  let p3 = remaining * (w3 / wSum);
  let p4 = remaining * (w4 / wSum);
  let p5 = remaining * (w5 / wSum);

  // Final safety normalization to sum to exactly 1.0
  const sum = p1 + p2 + p3 + p4 + p5;
  const k = sum > 0 ? 1 / sum : 1;
  return {
    zone1: p1 * k,
    zone2: p2 * k,
    zone3: p3 * k,
    zone4: p4 * k,
    zone5: p5 * k,
  };
}

// --- helpers ---

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

/** Cubic smoothstep (C1 continuous) */
function smoothstep01(t: number) {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

/**
 * Piecewise-smooth curve through ordered anchors using eased lerp per segment.
 * Between each pair (x_i,y_i)→(x_{i+1},y_{i+1}) we apply smoothstep easing.
 * Before first and after last anchor we clamp to the endpoint value.
 */
function curve(x: number, anchors: { x: number; y: number }[]): number {
  if (anchors.length === 0) return 0;
  const a = anchors.slice().sort((p, q) => p.x - q.x);

  if (x <= a[0].x) return a[0].y;
  if (x >= a[a.length - 1].x) return a[a.length - 1].y;

  for (let i = 0; i < a.length - 1; i++) {
    const p = a[i], q = a[i + 1];
    if (x >= p.x && x <= q.x) {
      const t = (x - p.x) / (q.x - p.x);
      const e = smoothstep01(t);
      return p.y + (q.y - p.y) * e;
    }
  }
  return a[a.length - 1].y; // fallback (shouldn’t hit)
}
```

#### Enemy Defense Calculation

**Base Defense Value:**
```typescript
enemy_base_def = def_power_normalized × 8 × combat_level × tier.difficulty_multiplier
```

**Final Defense Value:**
```typescript
// Enemy defense affected by player's hit zone
enemy_defense = enemy_base_def × hit_zone_multiplier (based on complex accuracy calculations from above)
```

## Tier System

### Tiers Table (Simplified)

**Question for review:** Do we need a dedicated table, or just store tier as integer 1-5 on enemytypes?

**Option A: Keep Table (recommended for flexibility):**
```
tiers: {
  id: number                      // 1, 2, 3, 4, 5
  difficulty_multiplier: number   // 0.7, 1.0, 1.3, 1.6, 2.0
  display_name: string            // "Easy", "Normal", "Hard", "Elite", "Boss"
  gold_multiplier: number         // 0.8, 1.0, 1.3, 1.6, 2.5
  xp_multiplier: number           // 0.8, 1.0, 1.3, 1.6, 2.5
  description: string | null
}
```

**Option B: Remove Table (simpler):**
- Store tier: 1 | 2 | 3 | 4 | 5 directly on enemytypes
- Hardcode multipliers in application logic
- Pro: Fewer tables, simpler queries
- Con: Less flexible, can't easily adjust multipliers

**Recommendation:** Keep table for easier game design iteration.

### Proposed Tier Values

| Tier | Name   | Difficulty | Gold | XP   | Use Case |
|------|--------|------------|------|------|----------|
| 1    | Easy   | 0.7x       | 0.8x | 0.8x | Beginner-friendly enemies, tutorial areas |
| 2    | Normal | 1.0x       | 1.0x | 1.0x | Standard balanced encounters |
| 3    | Hard   | 1.3x       | 1.3x | 1.3x | Challenging enemies, requires good gear |
| 4    | Elite  | 1.6x       | 1.6x | 1.6x | Mini-boss difficulty |
| 5    | Boss   | 2.0x       | 2.5x | 2.5x | Rare spawns, special encounters |

## Loot System Redesign

### Remove Loot Pools Entirely

**Tables to delete:**
- `lootpools` - No longer needed
- `lootpoolentries` - No longer needed
- `lootpooltierweights` - No longer needed (materials have no rarity)
- `v_loot_pool_material_weights` view - No longer needed

### New Enemy Loot Table

```
enemyloot: {
  Row: {
    id: string              // UUID PK
    enemy_type_id: string   // FK to enemytypes
    lootable_type: 'material' | 'item_type'
    lootable_id: string     // FK to materials.id OR itemtypes.id
    drop_weight: number     // Relative probability (higher = more common)
    guaranteed: boolean     // Always drops (for materials on styled enemies)
  }

  // Indexes
  // - (enemy_type_id) for enemy loot lookup
  // - (lootable_type, lootable_id) for reverse lookups
}
```

### Drop Mechanics

**Material Drops:**
- Always drops exactly 1 material
- Weighted random selection from enemy's material loot table
- Styled enemies ALWAYS drop styled materials (style inherited from enemy's style_id)
- Example loot table for "Spray Paint Goblin" (Tier 1):
  - material: "Gum" (weight: 100)
  - material: "Coffee" (weight: 80)
  - material: "Feather" (weight: 60)

**Item Drops:**
- Potentially drops exactly 1 item (separate roll from material)
- Weighted random selection with failure case (no item)
- Example: 10% chance to drop "Enormous Key", 5% chance "Umbrella"
- Items inherit rarity from ItemTypes table (materials have no rarity)

**Style Inheritance:**
```javascript
// At loot generation time
if (enemy.style_id !== 'normal') {
  // Force styled materials
  materialInstance.style_id = enemy.style_id;
}
```

**Gold Rewards:**
```javascript
const baseGold = 10; // Gold per level
const goldReward = Math.floor(
  baseGold × combat_level × tier.gold_multiplier
);
```

**Examples:**
- Level 10, Tier 1 (Easy): 10 × 10 × 0.8 = 80 gold
- Level 10, Tier 2 (Normal): 10 × 10 × 1.0 = 100 gold
- Level 10, Tier 3 (Hard): 10 × 10 × 1.3 = 130 gold
- Level 10, Tier 5 (Boss): 10 × 10 × 2.5 = 250 gold

**XP Rewards (similar formula):**
```javascript
const baseXP = 20; // XP per level
const xpReward = Math.floor(
  baseXP × combat_level × tier.xp_multiplier
);
```

### Loot Design Philosophy

Harder enemies drop better loot through manual curation:
- **Tier 1 enemies:** Common materials (low stat modifiers)
  - Gum, Coffee, Button, Feather
- **Tier 3 enemies:** Strong materials (higher stat modifiers)
  - Rainbow, Diamond, Lava, A Cloud
- **Tier 5 enemies:** Best materials + rare items
  - Colorful Ribbon, Pizza, Sparkles
  - Higher weight on epic/legendary ItemTypes

No automatic tier-based boosting - designers explicitly assign good loot to hard enemies.

## Enemy Pool Integration

### EnemyPools (No Changes)

Pools still work the same way:
```
EnemyPools:
  - id: uuid
    name: "Level 10 Library Enemies"
    combat_level: 10
    filter_type: "location_type"
    filter_value: "library"

EnemyPoolMembers:
  - enemy_pool_id: library_pool_10
    enemy_type_id: "spray_paint_goblin" (Tier 1)
    spawn_weight: 100

  - enemy_pool_id: library_pool_10
    enemy_type_id: "politician" (Tier 3)
    spawn_weight: 40
```

**Result:** Libraries at Level 10 spawn mix of Tier 1 (common) and Tier 3 (uncommon, harder) enemies.

## Combat Initialization Flow

```javascript
// 1. Match enemy pools by level + location
const matchingPools = await getEnemyPools({
  combat_level: player.avg_item_level,
  location_id: location.id
});

// 2. Weighted random enemy selection
const enemyType = weightedRandom(matchingPools.members);

// 3. Calculate realized stats
const realizedStats = calculateEnemyStats(
  enemyType,
  player.avg_item_level
);

// 4. Create combat session
const session = await createCombatSession({
  enemy_type_id: enemyType.id,
  enemy_realized_stats: realizedStats,
  // No loot pools needed!
});
```

## Loot Generation Flow

```javascript
// On combat victory
async function generateLoot(combatSessionId: string) {
  const session = await getCombatSession(combatSessionId);
  const enemy = await getEnemyType(session.enemy_type_id);

  // 1. Always drop exactly 1 material
  const materialLootTable = await getEnemyLoot(enemy.id, 'material');
  const droppedMaterial = weightedRandom(materialLootTable);

  // Apply style inheritance
  const materialStyleId = enemy.style_id !== 'normal'
    ? enemy.style_id
    : 'normal';

  await createMaterialStack({
    user_id: session.user_id,
    material_id: droppedMaterial.lootable_id,
    style_id: materialStyleId,
    quantity: 1
  });

  // 2. Potentially drop exactly 1 item
  const itemLootTable = await getEnemyLoot(enemy.id, 'item_type');
  const droppedItem = weightedRandomWithFailure(itemLootTable);

  if (droppedItem) {
    await createItem({
      user_id: session.user_id,
      item_type_id: droppedItem.lootable_id,
      level: 1
    });
  }

  // 3. Calculate gold reward
  const tier = await getTier(enemy.tier_id);
  const goldReward = calculateGoldReward(
    session.combat_level,
    tier.gold_multiplier
  );

  // 4. Calculate XP reward
  const xpReward = calculateXPReward(
    session.combat_level,
    tier.xp_multiplier
  );

  return {
    materials: [{ material_id, style_id, quantity: 1 }],
    items: droppedItem ? [{ item_type_id }] : [],
    gold: goldReward,
    xp: xpReward
  };
}
```

## Schema Changes

### ✅ MIGRATIONS APPLIED (2025-01-24)

Both Phase 1 and Phase 2 migrations have been executed. The database now reflects the new normalized stat system.

### EnemyTypes Table (Current Schema)

**Columns:**
```typescript
{
  id: string                           // UUID PK
  name: string                         // Enemy display name
  tier_id: number                      // FK to tiers.id
  style_id: string                     // FK to styledefinitions.id

  // NEW: Normalized combat stats (sum must equal 1.0)
  atk_power_normalized: number         // 0.0 - 1.0
  atk_accuracy_normalized: number      // 0.0 - 1.0
  def_power_normalized: number         // 0.0 - 1.0
  def_accuracy_normalized: number      // 0.0 - 1.0

  // KEPT: Absolute HP value
  base_hp: number                      // Absolute HP, only multiplied by tier.difficulty_multiplier

  // AI/Dialogue fields (unchanged)
  dialogue_tone: string | null
  dialogue_guidelines: string | null
  ai_personality_traits: Json | null
}
```

**Removed columns:**
- ❌ `atk_power` (old absolute value)
- ❌ `atk_accuracy` (old absolute value)
- ❌ `def_power` (old absolute value)
- ❌ `def_accuracy` (old absolute value)

**Constraint:**
```sql
CHECK (
  ABS((atk_power_normalized + atk_accuracy_normalized +
       def_power_normalized + def_accuracy_normalized) - 1.0) < 0.0001
)
```

### Tiers Table (Current Schema)

**Columns:**
```typescript
{
  id: number                           // PK
  tier_num: number                     // 1-5

  // NEW: Multiplier-based system
  display_name: string                 // "Easy", "Normal", "Hard", "Elite", "Boss"
  difficulty_multiplier: number        // 0.7, 1.0, 1.3, 1.6, 2.0
  gold_multiplier: number              // 0.8, 1.0, 1.3, 1.6, 2.5
  xp_multiplier: number                // 0.8, 1.0, 1.3, 1.6, 2.5

  description: string | null
  created_at: string
}
```

**Removed columns:**
- ❌ `enemy_atk_add` (old additive bonus)
- ❌ `enemy_def_add` (old additive bonus)
- ❌ `enemy_hp_add` (old additive bonus)

**Current tier values:**
| tier_num | display_name | difficulty_multiplier | gold_multiplier | xp_multiplier |
|----------|--------------|----------------------|-----------------|---------------|
| 1        | Easy         | 0.7                  | 0.8             | 0.8           |
| 2        | Normal       | 1.0                  | 1.0             | 1.0           |
| 3        | Hard         | 1.3                  | 1.3             | 1.3           |
| 4        | Elite        | 1.6                  | 1.6             | 1.6           |
| 5        | Boss         | 2.0                  | 2.5             | 2.5           |

### CombatSessions Table (Current Schema)

**Removed column:**
- ❌ `applied_loot_pools: Json` (no longer needed with enemyloot table)

**Unchanged columns (still used):**
```typescript
{
  id: string
  user_id: string
  enemy_type_id: string                // FK to enemytypes
  location_id: string
  combat_level: number                 // Player's avg_item_level at combat start
  outcome: 'victory' | 'defeat' | null
  rewards: Json | null                 // Actual loot generated (materials, items, gold, xp)
  player_equipped_items_snapshot: Json | null
  combat_log: Json | null
  // ... other columns
}
```

### EnemyLoot Table (NEW)

**Complete schema:**
```typescript
{
  id: string                           // UUID PK
  enemy_type_id: string                // FK to enemytypes(id) ON DELETE CASCADE
  lootable_type: 'material' | 'item_type'
  lootable_id: string                  // Polymorphic FK to materials.id OR itemtypes.id
  drop_weight: number                  // Relative probability (default 100, min 0)
  guaranteed: boolean                  // Always drops (for styled enemy materials)
  created_at: string
}
```

**Indexes:**
- `idx_enemyloot_enemy` on `enemy_type_id`
- `idx_enemyloot_lootable` on `(lootable_type, lootable_id)`

**Polymorphic FK behavior:**
- When `lootable_type = 'material'`: `lootable_id` references `materials.id`
- When `lootable_type = 'item_type'`: `lootable_id` references `itemtypes.id`
- Validation enforced in application logic (no database-level FK)

### Deleted Tables

The following tables have been permanently removed:

- ❌ `lootpools` - Replaced by direct enemy loot tables
- ❌ `lootpoolentries` - Replaced by enemyloot table
- ❌ `lootpooltierweights` - Replaced by tier multipliers

### Deleted Views

- ❌ `v_loot_pool_material_weights` - No longer needed

### Update Views

**v_enemy_realized_stats (NEW implementation):**
```sql
CREATE OR REPLACE VIEW v_enemy_realized_stats AS
SELECT
  e.id,
  e.name,
  e.tier_id,
  t.tier_num,
  t.difficulty_multiplier,

  -- Normalized combat stats (for reference)
  e.atk_power_normalized,
  e.atk_accuracy_normalized,
  e.def_power_normalized,
  e.def_accuracy_normalized,

  -- Absolute HP (only multiplied by tier)
  e.base_hp,
  (e.base_hp * t.difficulty_multiplier) AS realized_hp

  -- Combat stats will be computed at runtime with combat_level
  -- This view stores base distributions and pre-computed HP

FROM enemytypes e
JOIN tiers t ON e.tier_id = t.id;
```

**Note:**
- Combat stats (atk/def) computed at runtime in application code (require combat_level)
- HP pre-computed in view since it only depends on tier (no combat_level factor)
