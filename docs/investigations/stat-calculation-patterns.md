# Stat Calculation Logic and Patterns Investigation

**Search Date:** 2025-10-21
**Scope:** Existing stat calculation patterns, upgrade formulas, and mathematical operations
**Focus:** Informing implementation of `calculateUpgradedStats()` and upgrade cost formulas

## Key Findings

### 1. Existing Stat Calculation Functions

**Primary Service:** `StatsService` (/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/StatsService.ts)
- **Status:** Skeleton implementation (throws `NotImplementedError`)
- **Key Functions:**
  - `computeItemStats(baseStats, level, materials)`: Computes final item stats with level scaling and material bonuses
  - `computeTotalStats(equippedItems)`: Aggregates stats from all 8 equipment slots

**Calculation Pattern (from comments):**
```typescript
// 1. Scale base stats by level: base_stats × level
// 2. For each material:
//    - Apply style-specific modifiers based on style_id
//    - Add to running total
// 3. Combine: scaled_base + material_totals
```

### 2. Stat Data Structures

**Core Stats Interface** (/Users/silasrhyneer/Code/new-mystica/mystica-express/src/types/api.types.ts:109-114):
```typescript
export interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}
```

**Item Structure:**
- `base_stats: Stats` - Base item stats
- `current_stats: Stats` - Computed stats (base × level + materials)
- `level: number` - Current item level

### 3. Upgrade Cost Formula

**Source:** F-06 Item Upgrade System spec (/Users/silasrhyneer/Code/new-mystica/docs/feature-specs/F-06-item-upgrade-system.yaml)

**Formula:** `cost = base_cost × level_multiplier^(target_level - 1)`

**Constants:**
- `base_cost = 100` gold (cost to upgrade from level 1 → 2)
- `level_multiplier = 1.5` (exponential scaling factor)

**Examples:**
- Level 1 → 2: 100 × 1.5^0 = 100 gold
- Level 2 → 3: 100 × 1.5^1 = 150 gold
- Level 3 → 4: 100 × 1.5^2 = 225 gold
- Level 5 → 6: 100 × 1.5^4 = 506 gold
- Level 10 → 11: 100 × 1.5^9 = 3,834 gold

**Note:** User request mentions 100 × 1.5^(level-1), which matches the spec exactly.

### 4. Stat Scaling Formula

**From F-06 spec (lines 103-130):**
```
final_stats = base_stats_normalized × rarity_multiplier × level × base_stat_value + material_modifiers
```

**Constants:**
- `base_stat_value = 10` (baseline stat point at level 1)
- Rarity multipliers: common (1.0), uncommon (1.25), rare (1.5), epic (1.75), legendary (2.0)

**Example:** Common Sword at level 5
- `atkPower = 0.5 × 1.00 × 5 × 10 = 25`

### 5. Material Modifiers

**Application Pattern:**
- Normal materials: base effectiveness
- Shiny materials: 1.2x multiplier on modifiers
- Applied as percentage: `final_stat = base_stat × (1 + material_modifier_sum)`

### 6. Mathematical Operation Patterns

**Current Usage:**
- No existing `Math.pow()` implementations found
- Comments reference `level^1.5` formula but not yet implemented
- No utility functions for mathematical calculations

### 7. Response Formatting Patterns

**UpgradeResult Interface** (/Users/silasrhyneer/Code/new-mystica/mystica-express/src/types/api.types.ts:215-222):
```typescript
export interface UpgradeResult {
  success: boolean;
  updated_item: Item;
  gold_spent: number;
  new_level: number;
  stat_increase: Stats;  // ← This needs to be calculated
  message?: string;
}
```

### 8. Cost Calculation Patterns

**ItemService Methods** (/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/ItemService.ts):
- `getUpgradeCost()`: Returns cost info with affordability check
- `upgradeItem()`: Performs upgrade with gold validation and stat calculation

### 9. Existing Validation Patterns

**Gold Cost Validation:**
- User gold balance checking
- Insufficient funds error handling
- Cost calculation before transaction

## Implementation Recommendations

### 1. `calculateUpgradedStats()` Function

**Location:** Add to StatsService or create StatCalculator utility
**Pattern:** Follow existing `computeItemStats()` structure

```typescript
calculateUpgradedStats(baseStats: Stats, currentLevel: number, targetLevel: number): Stats {
  // Formula: base_stats × target_level (linear scaling per F-06 spec)
  return {
    atkPower: baseStats.atkPower * targetLevel,
    atkAccuracy: baseStats.atkAccuracy * targetLevel,
    defPower: baseStats.defPower * targetLevel,
    defAccuracy: baseStats.defAccuracy * targetLevel
  };
}
```

### 2. Upgrade Cost Calculation

**Formula Implementation:**
```typescript
calculateUpgradeCost(currentLevel: number): number {
  const BASE_COST = 100;
  const LEVEL_MULTIPLIER = 1.5;
  return Math.floor(BASE_COST * Math.pow(LEVEL_MULTIPLIER, currentLevel - 1));
}
```

### 3. Stat Increase Calculation

**Pattern:**
```typescript
const currentStats = calculateUpgradedStats(baseStats, currentLevel, currentLevel);
const upgradeStats = calculateUpgradedStats(baseStats, currentLevel, currentLevel + 1);
const statIncrease = {
  atkPower: upgradeStats.atkPower - currentStats.atkPower,
  atkAccuracy: upgradeStats.atkAccuracy - currentStats.atkAccuracy,
  defPower: upgradeStats.defPower - currentStats.defPower,
  defAccuracy: upgradeStats.defAccuracy - currentStats.defAccuracy
};
```

## Next Steps

1. **Implement utility functions** in StatsService or new utility file
2. **Use existing patterns** from ItemService comments for validation
3. **Follow F-06 specification** exactly for formula constants
4. **Test with examples** from spec (level 5→6 = 506 gold)
5. **Integrate with existing** UpgradeResult interface

## Related Files to Modify

- `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/StatsService.ts` - Add calculation functions
- `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/ItemService.ts` - Implement upgrade logic
- Consider creating `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/utils/calculations.ts` for reusable math functions