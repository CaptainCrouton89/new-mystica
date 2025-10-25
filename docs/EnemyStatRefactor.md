# Enemy Stat & Loot System Redesign

**Status:** Draft Specification
**Date:** 2025-01-24
**Author:** Combat System Redesign

## Overview

Redesign enemy stats to scale linearly with player progression and consolidate loot drops to enemy-specific tables, removing the complex pool system.

## Core Principles

1. **Enemy stats scale with player level** - Fair combat at all progression stages
2. **Tier = difficulty multiplier** - Same enemy can be easy/normal/hard variant
3. **Enemy-specific loot tables** - No separate pool system, cleaner design
4. **Harder enemies drop better loot** - Direct correlation between risk and reward

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

```
const baseStat = 10; // Baseline stat value per point (matches player system)

// For combat stats (scale with player level)
final_stat = normalized_stat × 8 × combat_level × tier.difficulty_multiplier × baseStat

// For HP (absolute value, only scales with tier)
final_hp = base_hp × tier.difficulty_multiplier
```

**Explanation:**
- `normalized_stat`: Enemy's stat distribution (0.0 - 1.0)
- `8`: Number of player equipment slots (ensures parity)
- `combat_level`: Player's avg_item_level (from Users table)
- `tier.difficulty_multiplier`: Difficulty scaling (0.7 - 2.0)
- `baseStat`: 10 (matches player base_stat_value)
- `base_hp`: Fixed HP value defined per enemy type
- **HP only multiplied by tier difficulty** - NOT by combat_level

### Example (Level 10, Tier 2 "Normal" enemy with balanced stats)

```
atk_power = 0.33 × 8 × 10 × 1.0 × 10 = 264
atk_accuracy = 0.17 × 8 × 10 × 1.0 × 10 = 136
def_power = 0.33 × 8 × 10 × 1.0 × 10 = 264
def_accuracy = 0.17 × 8 × 10 × 1.0 × 10 = 136
hp = 1200 × 1.0 = 1200  // Does NOT scale with level 10
```

### Same Enemy at Different Levels

**Level 5 (Tier 2):**
```
atk_power = 0.33 × 8 × 5 × 1.0 × 10 = 132
def_power = 0.33 × 8 × 5 × 1.0 × 10 = 132
hp = 1200 × 1.0 = 1200  // Same HP!
```

**Level 20 (Tier 2):**
```
atk_power = 0.33 × 8 × 20 × 1.0 × 10 = 528
def_power = 0.33 × 8 × 20 × 1.0 × 10 = 528
hp = 1200 × 1.0 = 1200  // Still same HP!
```

**Result:** Higher level players face enemies that hit harder and defend better, but have the same HP pool. Fights stay mechanically challenging without becoming tedious HP sponges.

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

### EnemyTypes Table

**Remove columns:**
- `atk_power: number` (absolute value that doesn't scale)
- `atk_accuracy: number` (absolute value that doesn't scale)
- `def_power: number` (absolute value that doesn't scale)
- `def_accuracy: number` (absolute value that doesn't scale)

**Keep column:**
- `base_hp: number` (absolute value, only modified by tier.difficulty_multiplier)

**Add columns:**
```
atk_power_normalized: number      // 0.0 - 1.0
atk_accuracy_normalized: number   // 0.0 - 1.0
def_power_normalized: number      // 0.0 - 1.0
def_accuracy_normalized: number   // 0.0 - 1.0
```

**Add constraint:**
```sql
-- Only combat stats must sum to 1.0 (HP is separate)
CHECK (
  atk_power_normalized +
  atk_accuracy_normalized +
  def_power_normalized +
  def_accuracy_normalized = 1.0
)
```

### Tiers Table

**Remove columns:**
- `enemy_atk_add: number`
- `enemy_def_add: number`
- `enemy_hp_add: number`

**Add columns:**
```
difficulty_multiplier: number  // 0.7, 1.0, 1.3, 1.6, 2.0
gold_multiplier: number        // 0.8, 1.0, 1.3, 1.6, 2.5
xp_multiplier: number          // 0.8, 1.0, 1.3, 1.6, 2.5
display_name: string           // "Easy", "Normal", "Hard", etc.
```

### CombatSessions Table

**Remove column:**
- `applied_loot_pools: Json` (no longer used)

**Keep:**
- `combat_level: number` (player's avg_item_level at combat start)
- `enemy_type_id: string` (FK)
- `rewards: Json` (actual loot generated)

### New Table: EnemyLoot

```sql
CREATE TABLE enemyloot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enemy_type_id UUID NOT NULL,
  lootable_type VARCHAR(20) NOT NULL CHECK (lootable_type IN ('material', 'item_type')),
  lootable_id UUID NOT NULL,
  drop_weight INT NOT NULL DEFAULT 100 CHECK (drop_weight >= 0),
  guaranteed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (enemy_type_id) REFERENCES enemytypes(id) ON DELETE CASCADE,

  -- Polymorphic FK constraint (validated in application logic)
  -- When lootable_type = 'material': lootable_id -> materials.id
  -- When lootable_type = 'item_type': lootable_id -> itemtypes.id
);

CREATE INDEX idx_enemyloot_enemy ON enemyloot(enemy_type_id);
CREATE INDEX idx_enemyloot_lootable ON enemyloot(lootable_type, lootable_id);
```

### Delete Tables

```sql
DROP TABLE IF EXISTS lootpooltierweights CASCADE;
DROP TABLE IF EXISTS lootpoolentries CASCADE;
DROP TABLE IF EXISTS lootpools CASCADE;
DROP VIEW IF EXISTS v_loot_pool_material_weights CASCADE;
```

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

## Migration Path

### Phase 1: Add New Columns (Non-Breaking)

1. Add normalized stat columns to enemytypes
2. Add multiplier columns to tiers
3. Create enemyloot table
4. Backfill normalized stats from existing absolute stats

### Phase 2: Update Application Logic

1. Implement new stat calculation in calculateEnemyStats()
2. Implement new loot generation in generateLoot()
3. Update combat initialization to use new stats
4. Test with parallel old/new systems

### Phase 3: Remove Old System

1. Drop old stat columns from enemytypes
2. Drop old additive columns from tiers
3. Drop loot pool tables
4. Update v_enemy_realized_stats view

## Open Questions

1. **Tier Table:** Keep dedicated table or hardcode as integer 1-5?
   - Recommendation: Keep table for flexibility
2. **Item Drop Rate:** What % chance should items have to drop?
   - Suggestion: Tier-based (Tier 1: 5%, Tier 3: 15%, Tier 5: 40%)
3. **Multiple Material Drops:** Current system allows 1-3, new says "exactly 1"
   - Confirm: Always exactly 1, or sometimes 2-3 for boss enemies?
4. **HP Scaling:** Is × 10 the right multiplier for HP vs other stats?
   - Needs testing to ensure enemies aren't too tanky/squishy
5. **Gold/XP Base Values:** Are 10 gold/20 XP per level reasonable?
   - Needs economy balancing

## Example Enemy Definitions

### Spray Paint Goblin (Easy, artistic theme)

```yaml
name: "Spray Paint Goblin"
tier_id: 1  # Easy (0.7x multiplier)
style_id: "pixel_art"
atk_power_normalized: 0.30      # Aggressive attacker
atk_accuracy_normalized: 0.10   # Poor accuracy
def_power_normalized: 0.20      # Weak defense
def_accuracy_normalized: 0.10   # Poor evasion
hp_normalized: 0.30             # Moderate HP

loot_table:
  materials:
    - "Gum" (weight: 100, guaranteed if styled)
    - "Spray Paint" (weight: 80)
    - "Button" (weight: 60)
  items:
    - "Umbrella" (weight: 10, ~5% chance)
```

### Politician (Hard, verbose)

```yaml
name: "Politician"
tier_id: 3  # Hard (1.3x multiplier)
style_id: "normal"
atk_power_normalized: 0.20      # Moderate attack
atk_accuracy_normalized: 0.20   # High accuracy (silver tongue)
def_power_normalized: 0.15      # Weak defense
def_accuracy_normalized: 0.25   # High evasion (slippery)
hp_normalized: 0.20             # Standard HP

loot_table:
  materials:
    - "Diamond" (weight: 100)
    - "Rainbow" (weight: 80)
    - "Colorful Ribbon" (weight: 50)
  items:
    - "Enormous Key" (weight: 30, ~15% chance)
    - "Halo" (weight: 20, ~10% chance)
```
