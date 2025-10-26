# Combat Stat Calculation Bug - Complete Analysis

**Status**: CRITICAL - Player defense stats are 10x too high, breaking combat damage calculations

**Date**: 2025-10-26

---

## Executive Summary

The combat system has **duplicate stat calculation logic in two places with different formulas**:

1. **Database View** (`v_player_equipped_stats`, `v_item_total_stats`): Uses **LINEAR formula with 10x multiplier**
2. **TypeScript Service** (`StatsService`): Uses **QUADRATIC formula** (correct for game design)

This causes **player defense to be 10x higher than intended**, making enemies deal almost no damage (always MIN_DAMAGE=1).

---

## Current State - The Bug

### Database Views (WRONG FORMULA)

**File**: `supabase/migrations/20251026033824_remote_schema.sql`

**View**: `v_item_total_stats`
```sql
CREATE OR REPLACE VIEW "public"."v_item_total_stats" AS
 SELECT
    ...
    ((((("it"."base_stats_normalized" ->> 'defPower'::"text"))::numeric
      * "rd"."stat_multiplier")
      * ("i"."level")::numeric)
      * (10)::numeric) AS "def_power",  -- ← LINEAR * 10
    ...
   FROM (("public"."items" "i"
     JOIN "public"."itemtypes" "it" ON ...
     JOIN "public"."raritydefinitions" "rd" ON ...
```

**Formula in View**:
```
stat = base_stat * rarity_multiplier * level * 10
```

**Example at level 20, defPower=0.2, rarity=common (multiplier=1.0)**:
```
stat = 0.2 * 1.0 * 20 * 10 = 40
```

**View**: `v_player_equipped_stats`
```sql
CREATE OR REPLACE VIEW "public"."v_player_equipped_stats" AS
 SELECT "u"."id" AS "player_id",
    COALESCE("sum"("vits"."atk_power"), (0)::numeric) AS "atkpower",
    ...
   FROM (("public"."users" "u"
     LEFT JOIN "public"."userequipment" "ue" ON ...)
     LEFT JOIN "public"."v_item_total_stats" "vits" ON ...)
  GROUP BY "u"."id";
```

This just sums the stats from `v_item_total_stats` (all equipped items).

---

### TypeScript Service (CORRECT FORMULA)

**File**: `mystica-express/src/services/StatsService.ts`

**Method**: `computeItemStats()` (line 10)
```typescript
public computeItemStats(baseStats: Stats, level: number, materials: AppliedMaterial[] = []): Stats {
    // ... validation ...

    const levelMultiplier = this.getLevelMultiplier(level);
    return {
      atkPower: baseStats.atkPower * levelMultiplier,
      atkAccuracy: baseStats.atkAccuracy * levelMultiplier,
      defPower: baseStats.defPower * levelMultiplier,
      defAccuracy: baseStats.defAccuracy * levelMultiplier
    };
}
```

**Method**: `getLevelMultiplier()` (line 172)
```typescript
private getLevelMultiplier(level: number): number {
    if (level < 1) {
      throw new ValidationError('Level must be 1 or greater');
    }
    return 1 + 0.05 * Math.pow(level - 1, 2);  // ← QUADRATIC
}
```

**Formula in Service**:
```
stat = base_stat * rarity_multiplier * (1 + 0.05 * (level - 1)²)
```

**Example at level 20, defPower=0.2, rarity=common (multiplier=1.0)**:
```
levelMultiplier = 1 + 0.05 * (20 - 1)² = 1 + 0.05 * 361 = 19.05
stat = 0.2 * 1.0 * 19.05 = 3.81
```

---

## The Mismatch

| Level | View Formula (Wrong) | Service Formula (Correct) | Ratio |
|-------|----------------------|---------------------------|-------|
| 1     | 1 × 10 = 10         | 1 × 1.0 = 1.0             | 10x   |
| 5     | 5 × 10 = 50         | 1 + 0.05×16 = 1.8         | 27.8x |
| 10    | 10 × 10 = 100       | 1 + 0.05×81 = 5.05        | 19.8x |
| 20    | 20 × 10 = 200       | 1 + 0.05×361 = 19.05      | 10.5x |

---

## Real-World Example: User 47b46728

**Combat Session**: Brass Golem (Elite tier) at Level 10

**Equipped Items**:
- Wooden Stick (level 20): base defPower=0.2
- Umbrella (level 5): base defPower=0.4

**Current (Wrong) Calculation via View**:
```
Wooden Stick: 0.2 * 1.0 * 20 * 10 = 40
Umbrella: 0.4 * 1.0 * 5 * 10 = 20
Total defPower = 60 (+ some other slots) = ~70
```

**Correct Calculation via Service**:
```
Wooden Stick: 0.2 * 1.0 * (1 + 0.05*361) = 3.81
Umbrella: 0.4 * 1.0 * (1 + 0.05*16) = 0.72
Total defPower = 4.53
```

**Combat Result**:
- Enemy `atk_power = 12.928`
- Player `defPower = 70` (from view - WRONG)
- Base damage = max(MIN_DAMAGE, 12.928 - 70) = max(1, -57) = **1 HP** ✗

With correct formula:
- Player `defPower = 4.53`
- Base damage = max(MIN_DAMAGE, 12.928 - 4.53) = max(1, 8.4) = **8 HP** ✓

---

## Where Stats Are Used in Combat

### Current Flow (BROKEN)

1. **Combat Starts** (`CombatService.startCombat()`)
   - Calls `calculatePlayerStats()` (line 116 in session.ts)
   - Which calls `equipmentRepository.getPlayerEquippedStats(userId)`
   - **WRONG**: Uses `v_player_equipped_stats` view with linear formula

2. **Attack/Defense Turns**
   - Recalculates stats same way
   - Logs show `defPower=70` (wrong)
   - Enemy deals ~1 damage instead of ~8-12 damage

3. **Enemy Stats** (CORRECT)
   - `StatsService.calculateEnemyRealizedStats()` (line 266)
   - Uses quadratic formula correctly
   - Enemy stats properly scaled

---

## Why This Happened

1. **Database views** were created for optimization (server-side aggregation)
2. **TypeScript service** was created for game logic with quadratic scaling
3. **No synchronization** between the two → duplicate logic with different formulas
4. **Equipment repo** just queries the view, never validates it matches service

---

## What Needs to Change

### Goal
**Single source of truth**: All stat calculations use TypeScript `StatsService` with quadratic formula.

### Step 1: Update `EquipmentRepository.getPlayerEquippedStats()`

**File**: `mystica-express/src/repositories/EquipmentRepository.ts`
**Method**: `getPlayerEquippedStats()` (line 551)

**Current (WRONG)**:
```typescript
async getPlayerEquippedStats(userId: string): Promise<Stats> {
  const { data, error } = await this.client
    .from('v_player_equipped_stats')  // ← Uses wrong view
    .select('*')
    .eq('player_id', userId)
    .single();

  // ... extract stats from view ...
  return { atkPower, atkAccuracy, defPower, defAccuracy };
}
```

**New (CORRECT)**:
```typescript
async getPlayerEquippedStats(userId: string): Promise<Stats> {
  // Query all equipped items with their materials
  const { data: equippedItems, error } = await this.client
    .from('userequipment')
    .select(`
      item_id,
      items (
        id, level, item_type_id,
        itemtypes (base_stats_normalized, rarity),
        itemmaterials (
          material_instance_id,
          materialinstances (
            material_id,
            materials (stat_modifiers)
          )
        )
      )
    `)
    .eq('user_id', userId);

  if (error || !equippedItems) {
    throw new NotFoundError('PlayerStats', userId);
  }

  // Aggregate stats using StatsService
  let totalStats: Stats = {
    atkPower: 0,
    atkAccuracy: 0,
    defPower: 0,
    defAccuracy: 0
  };

  for (const eq of equippedItems) {
    if (!eq.items) continue;

    const item = eq.items;
    const baseStats = item.itemtypes.base_stats_normalized;
    const level = item.level;

    // Get applied materials
    const materials = item.itemmaterials?.map(im => ({
      material_id: im.material_instance_id,
      material: {
        stat_modifiers: im.materialinstances.materials.stat_modifiers
      }
    })) || [];

    // Use StatsService with quadratic formula
    const computedStats = statsService.computeItemStats(baseStats, level, materials);

    // Add to total
    totalStats.atkPower += computedStats.atkPower;
    totalStats.atkAccuracy += computedStats.atkAccuracy;
    totalStats.defPower += computedStats.defPower;
    totalStats.defAccuracy += computedStats.defAccuracy;

    console.log(`[getPlayerEquippedStats] Item: ${item.itemtypes.name}, level=${level}`);
    console.log(`  baseStats: ${JSON.stringify(baseStats)}`);
    console.log(`  materials: ${materials.length}`);
    console.log(`  computed: ${JSON.stringify(computedStats)}`);
  }

  console.log(`[getPlayerEquippedStats] userId=${userId}, TOTAL: ${JSON.stringify(totalStats)}`);

  return totalStats;
}
```

### Step 2: Update `computeTotalStats()` to use same logic

**File**: `mystica-express/src/repositories/EquipmentRepository.ts`
**Method**: `computeTotalStats()` (line 627)

Currently duplicates `getPlayerEquippedStats()`. Either:
- **Option A**: Make it call `getPlayerEquippedStats()` internally
- **Option B**: Implement the same logic

Recommend Option A for DRY principle.

### Step 3: Add Import

Add to top of EquipmentRepository.ts:
```typescript
import { statsService } from '../services/StatsService.js';
```

### Step 4: Fix Type Issues

The query returns nested structures. May need to:
- Define proper TypeScript interfaces for the nested query result
- Use type casting or validation

### Step 5: Testing

After changes:

**Before**:
```
[calculateEnemyAttack] zone=2
  atkPower=12.928 - defPower=70 = baseDamage=1
  finalDamage=1

[CombatService.executeAttack] TURN SUMMARY:
  Player: 100 HP → 99 HP (took 1 damage)  ← WRONG
  Enemy: 240 HP → 239 HP (took 1 damage)
```

**After**:
```
[calculateEnemyAttack] zone=2
  atkPower=12.928 - defPower=4.53 = baseDamage=8
  finalDamage=8

[CombatService.executeAttack] TURN SUMMARY:
  Player: 100 HP → 92 HP (took 8 damage)  ← CORRECT
  Enemy: 240 HP → 232 HP (took 8 damage)
```

### Step 6: Future Cleanup (Optional)

Once confirmed working, drop the database views:
- `v_player_equipped_stats`
- `v_item_total_stats`

These can be deprecated and removed in a future migration since they're no longer used.

---

## Why This Matters

| Aspect | Impact |
|--------|--------|
| **Combat Balance** | Enemies deal 10x less damage, making even hard content trivial |
| **Player Experience** | Combat feels boring (always win with 95+ HP remaining) |
| **Difficulty Progression** | Can't scale enemy difficulty without breaking balance |
| **Material System** | Materials on items don't affect combat stats (not included in view) |
| **Code Maintenance** | Duplicate stat logic in SQL and TypeScript, hard to fix bugs |

---

## Risk Assessment

**Risk Level**: Low to Medium

**Potential Issues**:
- Nested query might be slower than view (database optimization)
- Type casting complexity for nested structures
- Material handling might have edge cases

**Mitigation**:
- Keep logging to verify correct computation
- Run comprehensive combat tests
- Monitor query performance

---

## Acceptance Criteria

- [ ] Player defPower at level 10 with Wooden Stick + Umbrella: **~4.5** (not ~70)
- [ ] Enemy damage: **8-12 per turn** (not 1)
- [ ] Combat logs show StatsService computation path
- [ ] Materials properly included in player stat calculation
- [ ] Tests pass without type errors
- [ ] Combat difficulty properly scaled by level

---

## Related Files

- `mystica-express/src/repositories/EquipmentRepository.ts` - NEEDS CHANGE
- `mystica-express/src/services/StatsService.ts` - Correct formula, use as reference
- `mystica-express/src/services/combat/session.ts` - Calls getPlayerEquippedStats()
- `mystica-express/src/services/CombatService.ts` - Uses player stats in combat
- `supabase/migrations/20251026033824_remote_schema.sql` - Contains broken views (can deprecate later)
