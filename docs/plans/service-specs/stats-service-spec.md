# Stats Service Specification

## Overview

The StatsService provides centralized stat calculation functionality for item stats with material modifiers and equipment aggregation. This is a pure calculation service with no database dependencies, handling the complex formula for item stat computation that incorporates base stats, rarity multipliers, level scaling, and zero-sum material modifiers.

**Status**: ⚠️ **NOT YET IMPLEMENTED** - Critical dependency for ItemService, InventoryService, and EquipmentService

## Core Architecture

### Service Design
- **Pure calculation service** - No database operations or dependencies
- **Stateless methods** - All data passed as parameters
- **Zero external dependencies** - Only uses TypeScript built-in math operations
- **Singleton pattern** - Exported as `statsService` for consistent access across services

### Location
**File**: `mystica-express/src/services/StatsService.ts`

## Core Method Specifications

### 1. computeItemStats(baseStats: Stats, level: number, materials: AppliedMaterial[]): Stats

**Purpose**: Calculate final item stats with rarity, level scaling, and material modifiers applied.

**Parameters**:
```typescript
interface Stats {
  atkPower: number;
  atkAccuracy: number;
  defPower: number;
  defAccuracy: number;
}

interface AppliedMaterial {
  material_id: string;
  is_shiny: boolean;
  stat_modifiers: Stats; // Zero-sum: must sum to 0
}

baseStats: Stats;     // From ItemType.base_stats_normalized (sums to 1.0)
level: number;        // Item level (1+)
materials: AppliedMaterial[]; // 0-3 applied materials
```

**Implementation Formula** (F-03/F-06 specs):
```typescript
/**
 * Complete stat calculation with material modifiers
 *
 * Formula: base_stats × rarity_multiplier × level × 10 + material_modifiers
 *
 * Note: This method receives pre-multiplied baseStats that already include
 * the rarity multiplier from the calling service layer.
 */
export function computeItemStats(
  baseStats: Stats,
  level: number,
  materials: AppliedMaterial[] = []
): Stats {
  // 1. Scale base stats by level (×10 base scaling factor from schema)
  const levelScaled: Stats = {
    atkPower: baseStats.atkPower * level * 10,
    atkAccuracy: baseStats.atkAccuracy * level * 10,
    defPower: baseStats.defPower * level * 10,
    defAccuracy: baseStats.defAccuracy * level * 10
  };

  // 2. Apply material modifiers (zero-sum adjustments)
  const materialMods = materials.reduce((acc, material) => ({
    atkPower: acc.atkPower + material.stat_modifiers.atkPower,
    atkAccuracy: acc.atkAccuracy + material.stat_modifiers.atkAccuracy,
    defPower: acc.defPower + material.stat_modifiers.defPower,
    defAccuracy: acc.defAccuracy + material.stat_modifiers.defAccuracy
  }), { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 });

  // 3. Combine scaled stats with material modifiers
  return {
    atkPower: Math.round((levelScaled.atkPower + materialMods.atkPower) * 100) / 100,
    atkAccuracy: Math.round((levelScaled.atkAccuracy + materialMods.atkAccuracy) * 100) / 100,
    defPower: Math.round((levelScaled.defPower + materialMods.defPower) * 100) / 100,
    defAccuracy: Math.round((levelScaled.defAccuracy + materialMods.defAccuracy) * 100) / 100
  };
}
```

**Rarity Multiplier Integration**:
The calling service (ItemService, InventoryService) is responsible for applying the rarity multiplier before calling this method:

```typescript
// In calling service:
const rarityMultiplier = await rarityRepository.getStatMultiplier(itemType.rarity);
const rarityAdjustedBaseStats = {
  atkPower: itemType.base_stats_normalized.atkPower * rarityMultiplier,
  atkAccuracy: itemType.base_stats_normalized.atkAccuracy * rarityMultiplier,
  defPower: itemType.base_stats_normalized.defPower * rarityMultiplier,
  defAccuracy: itemType.base_stats_normalized.defAccuracy * rarityMultiplier
};

const finalStats = statsService.computeItemStats(rarityAdjustedBaseStats, item.level, appliedMaterials);
```

**Error Handling**:
- Throws `ValidationError` if level < 1
- Throws `ValidationError` if baseStats values sum significantly != 1.0 (tolerance: ±0.01)
- Throws `ValidationError` if any material stat_modifiers sum significantly != 0 (tolerance: ±0.01)
- Throws `ValidationError` if materials array length > 3

### 2. computeItemStatsForLevel(item: ItemWithType, level: number): Stats

**Purpose**: Calculate base stats for a specific level without materials (used for stackable items).

**Parameters**:
```typescript
interface ItemWithType {
  item_type: {
    base_stats_normalized: Stats;
    rarity: string;
  };
}

item: ItemWithType;  // Item with embedded ItemType data
level: number;       // Target level for calculation
```

**Implementation**:
```typescript
/**
 * Calculate base stats for level without materials
 * Used for stackable items and stat previews
 */
export function computeItemStatsForLevel(item: ItemWithType, level: number): Stats {
  // This method handles rarity multiplier lookup internally
  const rarityMultiplier = getRarityMultiplier(item.item_type.rarity);

  const rarityAdjustedBaseStats = {
    atkPower: item.item_type.base_stats_normalized.atkPower * rarityMultiplier,
    atkAccuracy: item.item_type.base_stats_normalized.atkAccuracy * rarityMultiplier,
    defPower: item.item_type.base_stats_normalized.defPower * rarityMultiplier,
    defAccuracy: item.item_type.base_stats_normalized.defAccuracy * rarityMultiplier
  };

  return computeItemStats(rarityAdjustedBaseStats, level, []); // No materials
}

/**
 * Internal rarity multiplier lookup
 * Hardcoded values to avoid database dependency
 */
function getRarityMultiplier(rarity: string): number {
  const multipliers: Record<string, number> = {
    'common': 1.0,
    'uncommon': 1.25,
    'rare': 1.5,
    'epic': 1.75,
    'legendary': 2.0
  };

  const multiplier = multipliers[rarity];
  if (!multiplier) {
    throw new ValidationError(`Invalid rarity: ${rarity}`);
  }

  return multiplier;
}
```

**Error Handling**:
- Throws `ValidationError` if level < 1
- Throws `ValidationError` if rarity not recognized
- Throws `ValidationError` if base_stats_normalized sum significantly != 1.0

### 3. computeEquipmentStats(equippedItems: ItemWithStats[]): PlayerStats

**Purpose**: Aggregate stats from all 8 equipped items for total player combat stats.

**Parameters**:
```typescript
interface ItemWithStats {
  slot: EquipmentSlot;
  computed_stats: Stats;
  level: number;
  item_id: string;
}

interface PlayerStats {
  total_stats: Stats;
  item_contributions: Record<EquipmentSlot, Stats>;
  equipped_items_count: number;
  total_item_level: number;
}

equippedItems: ItemWithStats[]; // 0-8 equipped items with pre-computed stats
```

**Implementation**:
```typescript
/**
 * Sum stats from all equipped items
 * Returns aggregated player stats for combat
 */
export function computeEquipmentStats(equippedItems: ItemWithStats[]): PlayerStats {
  const itemContributions: Record<EquipmentSlot, Stats> = {};
  let totalStats: Stats = { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };
  let totalItemLevel = 0;

  // Initialize all slots with zero stats
  const slots: EquipmentSlot[] = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'];
  slots.forEach(slot => {
    itemContributions[slot] = { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 };
  });

  // Sum stats from equipped items
  equippedItems.forEach(item => {
    itemContributions[item.slot] = item.computed_stats;

    totalStats.atkPower += item.computed_stats.atkPower;
    totalStats.atkAccuracy += item.computed_stats.atkAccuracy;
    totalStats.defPower += item.computed_stats.defPower;
    totalStats.defAccuracy += item.computed_stats.defAccuracy;

    totalItemLevel += item.level;
  });

  return {
    total_stats: {
      atkPower: Math.round(totalStats.atkPower * 100) / 100,
      atkAccuracy: Math.round(totalStats.atkAccuracy * 100) / 100,
      defPower: Math.round(totalStats.defPower * 100) / 100,
      defAccuracy: Math.round(totalStats.defAccuracy * 100) / 100
    },
    item_contributions: itemContributions,
    equipped_items_count: equippedItems.length,
    total_item_level: totalItemLevel
  };
}
```

**Error Handling**:
- Throws `ValidationError` if equippedItems.length > 8
- Throws `ValidationError` if duplicate slots found in equippedItems
- Silently handles empty equipment (returns zero stats)

### 4. validateMaterialModifiers(materials: AppliedMaterial[]): boolean

**Purpose**: Validate that material stat modifiers follow zero-sum constraint.

**Implementation**:
```typescript
/**
 * Validate material stat modifiers are zero-sum
 * Each individual material must sum to 0, total of all materials must sum to 0
 */
export function validateMaterialModifiers(materials: AppliedMaterial[]): boolean {
  const tolerance = 0.01;

  for (const material of materials) {
    const sum = material.stat_modifiers.atkPower +
                material.stat_modifiers.atkAccuracy +
                material.stat_modifiers.defPower +
                material.stat_modifiers.defAccuracy;

    if (Math.abs(sum) > tolerance) {
      throw new ValidationError(
        `Material ${material.material_id} stat modifiers must sum to 0, got ${sum}`
      );
    }
  }

  // Validate total material impact is also zero-sum
  const totalMods = materials.reduce((acc, mat) => ({
    atkPower: acc.atkPower + mat.stat_modifiers.atkPower,
    atkAccuracy: acc.atkAccuracy + mat.stat_modifiers.atkAccuracy,
    defPower: acc.defPower + mat.stat_modifiers.defPower,
    defAccuracy: acc.defAccuracy + mat.stat_modifiers.defAccuracy
  }), { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 });

  const totalSum = totalMods.atkPower + totalMods.atkAccuracy + totalMods.defPower + totalMods.defAccuracy;

  if (Math.abs(totalSum) > tolerance) {
    throw new ValidationError(
      `Combined material modifiers must sum to 0, got ${totalSum}`
    );
  }

  return true;
}
```

## Integration Points

### Called by InventoryService
```typescript
// In getPlayerInventory()
import { statsService } from '../services/StatsService.js';

// For unique items with materials
const currentStats = statsService.computeItemStats(
  rarityAdjustedBaseStats,
  item.level,
  item.appliedMaterials
);

// For stackable items (no materials)
const baseStats = statsService.computeItemStatsForLevel(mockItem, level);
```

### Called by ItemService
```typescript
// In getItemDetails()
const computedStats = statsService.computeItemStats(
  rarityAdjustedBaseStats,
  item.level,
  item.appliedMaterials || []
);

// In upgrade cost calculation
const newLevelStats = statsService.computeItemStatsForLevel(item, item.level + 1);
```

### Called by EquipmentService
```typescript
// In getEquippedItems()
const playerStats = statsService.computeEquipmentStats(equippedItemsWithStats);
```

## Stat Calculation Examples

### Example 1: Level 5 Common Weapon with No Materials
```typescript
const baseStats = { atkPower: 0.4, atkAccuracy: 0.3, defPower: 0.2, defAccuracy: 0.1 }; // Sums to 1.0
const rarityMultiplier = 1.0; // Common
const level = 5;

// Apply rarity multiplier (done by calling service)
const rarityAdjusted = {
  atkPower: 0.4 * 1.0 = 0.4,
  atkAccuracy: 0.3 * 1.0 = 0.3,
  defPower: 0.2 * 1.0 = 0.2,
  defAccuracy: 0.1 * 1.0 = 0.1
};

// StatsService calculation: level scaling × 10
const finalStats = {
  atkPower: 0.4 * 5 * 10 = 20.0,
  atkAccuracy: 0.3 * 5 * 10 = 15.0,
  defPower: 0.2 * 5 * 10 = 10.0,
  defAccuracy: 0.1 * 5 * 10 = 5.0
};
```

### Example 2: Level 3 Rare Armor with Materials
```typescript
const baseStats = { atkPower: 0.1, atkAccuracy: 0.1, defPower: 0.5, defAccuracy: 0.3 }; // Sums to 1.0
const rarityMultiplier = 1.5; // Rare
const level = 3;

// Apply rarity multiplier (done by calling service)
const rarityAdjusted = {
  atkPower: 0.1 * 1.5 = 0.15,
  atkAccuracy: 0.1 * 1.5 = 0.15,
  defPower: 0.5 * 1.5 = 0.75,
  defAccuracy: 0.3 * 1.5 = 0.45
};

// Level scaling × 10
const levelScaled = {
  atkPower: 0.15 * 3 * 10 = 4.5,
  atkAccuracy: 0.15 * 3 * 10 = 4.5,
  defPower: 0.75 * 3 * 10 = 22.5,
  defAccuracy: 0.45 * 3 * 10 = 13.5
};

// Material modifiers (zero-sum)
const materials = [
  { material_id: 'steel', stat_modifiers: { atkPower: -2, atkAccuracy: 0, defPower: +3, defAccuracy: -1 } }, // Sums to 0
  { material_id: 'ruby', stat_modifiers: { atkPower: +1.5, atkAccuracy: +0.5, defPower: -1, defAccuracy: -1 } }  // Sums to 0
];

const materialMods = {
  atkPower: -2 + 1.5 = -0.5,
  atkAccuracy: 0 + 0.5 = 0.5,
  defPower: 3 + (-1) = 2,
  defAccuracy: -1 + (-1) = -2
}; // Total material impact: -0.5 + 0.5 + 2 + (-2) = 0 ✓

// Final stats
const finalStats = {
  atkPower: 4.5 + (-0.5) = 4.0,
  atkAccuracy: 4.5 + 0.5 = 5.0,
  defPower: 22.5 + 2 = 24.5,
  defAccuracy: 13.5 + (-2) = 11.5
};
```

### Example 3: Full Equipment Aggregation
```typescript
const equippedItems = [
  { slot: 'weapon', computed_stats: { atkPower: 20, atkAccuracy: 15, defPower: 5, defAccuracy: 5 }, level: 5 },
  { slot: 'armor', computed_stats: { atkPower: 4, atkAccuracy: 5, defPower: 24.5, defAccuracy: 11.5 }, level: 3 },
  { slot: 'head', computed_stats: { atkPower: 2, atkAccuracy: 3, defPower: 8, defAccuracy: 7 }, level: 2 }
  // 5 empty slots
];

const playerStats = {
  total_stats: {
    atkPower: 20 + 4 + 2 = 26,
    atkAccuracy: 15 + 5 + 3 = 23,
    defPower: 5 + 24.5 + 8 = 37.5,
    defAccuracy: 5 + 11.5 + 7 = 23.5
  },
  equipped_items_count: 3,
  total_item_level: 5 + 3 + 2 = 10,
  item_contributions: {
    weapon: { atkPower: 20, atkAccuracy: 15, defPower: 5, defAccuracy: 5 },
    armor: { atkPower: 4, atkAccuracy: 5, defPower: 24.5, defAccuracy: 11.5 },
    head: { atkPower: 2, atkAccuracy: 3, defPower: 8, defAccuracy: 7 },
    // ... other slots with zero stats
  }
};
```

## Service Implementation Template

```typescript
// mystica-express/src/services/StatsService.ts

import { Stats, AppliedMaterial, EquipmentSlot, PlayerStats } from '../types/api.types.js';
import { ValidationError } from '../utils/errors.js';

/**
 * StatsService - Pure calculation service for item and equipment stats
 *
 * Handles:
 * - Item stat calculation with rarity, level, and material modifiers
 * - Equipment stat aggregation across 8 slots
 * - Material modifier validation (zero-sum constraint)
 *
 * NO database dependencies - all data passed as parameters
 */
class StatsService {

  computeItemStats(baseStats: Stats, level: number, materials: AppliedMaterial[] = []): Stats {
    // Implementation as specified above
  }

  computeItemStatsForLevel(item: ItemWithType, level: number): Stats {
    // Implementation as specified above
  }

  computeEquipmentStats(equippedItems: ItemWithStats[]): PlayerStats {
    // Implementation as specified above
  }

  validateMaterialModifiers(materials: AppliedMaterial[]): boolean {
    // Implementation as specified above
  }

  private getRarityMultiplier(rarity: string): number {
    // Implementation as specified above
  }
}

// Export singleton instance
export const statsService = new StatsService();
export { StatsService };
```

## Error Handling

### Validation Errors (400)
- Invalid level (< 1)
- Base stats don't sum to ~1.0 (tolerance: ±0.01)
- Material modifiers don't sum to ~0 (tolerance: ±0.01)
- Too many materials (> 3)
- Invalid rarity string
- Too many equipped items (> 8)
- Duplicate equipment slots

### Error Response Format
```typescript
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Material stat modifiers must sum to 0, got 0.15',
    timestamp: '2025-01-27T10:30:00Z'
  }
}
```

## Performance Considerations

### Calculation Complexity
- **O(1) for single item** - Fixed number of stat fields and materials
- **O(n) for equipment** - Linear with number of equipped items (max 8)
- **No database queries** - Pure mathematical operations
- **Response time: < 1ms** - Simple arithmetic operations

### Memory Usage
- **Stateless service** - No data retention between calls
- **Minimal object creation** - Reuses Stats interface structures
- **No caching needed** - Calculations are fast enough to compute on-demand

## Testing Requirements

### Unit Test Coverage

**Formula Validation Tests**:
```typescript
describe('StatsService', () => {
  describe('computeItemStats', () => {
    it('should calculate level 1 common item correctly', () => {
      const baseStats = { atkPower: 0.4, atkAccuracy: 0.3, defPower: 0.2, defAccuracy: 0.1 };
      const result = statsService.computeItemStats(baseStats, 1, []);
      expect(result).toEqual({ atkPower: 4, atkAccuracy: 3, defPower: 2, defAccuracy: 1 });
    });

    it('should apply material modifiers correctly', () => {
      const baseStats = { atkPower: 0.5, atkAccuracy: 0.2, defPower: 0.2, defAccuracy: 0.1 };
      const materials = [{
        material_id: 'steel',
        is_shiny: false,
        stat_modifiers: { atkPower: -1, atkAccuracy: 0, defPower: 2, defAccuracy: -1 }
      }];
      const result = statsService.computeItemStats(baseStats, 2, materials);
      expect(result).toEqual({ atkPower: 9, atkAccuracy: 4, defPower: 6, defAccuracy: 1 });
    });

    it('should throw ValidationError for invalid level', () => {
      const baseStats = { atkPower: 0.25, atkAccuracy: 0.25, defPower: 0.25, defAccuracy: 0.25 };
      expect(() => statsService.computeItemStats(baseStats, 0, [])).toThrow(ValidationError);
    });
  });

  describe('validateMaterialModifiers', () => {
    it('should pass for valid zero-sum materials', () => {
      const materials = [
        { material_id: 'a', stat_modifiers: { atkPower: 1, atkAccuracy: -0.5, defPower: -0.3, defAccuracy: -0.2 } },
        { material_id: 'b', stat_modifiers: { atkPower: -1, atkAccuracy: 0.5, defPower: 0.3, defAccuracy: 0.2 } }
      ];
      expect(() => statsService.validateMaterialModifiers(materials)).not.toThrow();
    });

    it('should throw for non-zero-sum material', () => {
      const materials = [
        { material_id: 'invalid', stat_modifiers: { atkPower: 1, atkAccuracy: 1, defPower: 1, defAccuracy: 1 } }
      ];
      expect(() => statsService.validateMaterialModifiers(materials)).toThrow(ValidationError);
    });
  });
});
```

**Edge Case Tests**:
- Empty materials array
- Maximum materials (3)
- Rounding precision (ensure 2 decimal places)
- Zero-level items (should throw)
- Empty equipment loadout
- Full equipment loadout (8 items)

## Dependencies

### Required Imports
```typescript
import { Stats, AppliedMaterial, EquipmentSlot, PlayerStats } from '../types/api.types.js';
import { ValidationError } from '../utils/errors.js';
```

### No External Dependencies
- **Database**: NONE - Pure calculation service
- **Network**: NONE - No external API calls
- **File System**: NONE - No file operations
- **Third-party**: NONE - Only TypeScript standard library

### Service Dependencies
- **None** - This service is a dependency for other services, not dependent on them

## Implementation Priority

### Phase 1: Core Methods (CRITICAL - Blocking ItemService)
1. `computeItemStats()` - Used by ItemService.getItemDetails()
2. `computeItemStatsForLevel()` - Used by InventoryService stacking logic
3. `validateMaterialModifiers()` - Used by material application workflows

### Phase 2: Equipment Aggregation
4. `computeEquipmentStats()` - Used by EquipmentService.getEquippedItems()

### Phase 3: Testing & Validation
5. Comprehensive unit test suite
6. Edge case validation
7. Performance benchmarking

## Migration Notes

### Backward Compatibility
- **New service** - No breaking changes
- **Pure calculation** - Can be tested independently
- **Isolated implementation** - Won't affect existing code until imported

### Deployment Strategy
1. Implement StatsService first
2. Update dependent services to import and use StatsService
3. Remove duplicate stat calculation logic from other services
4. Add comprehensive test coverage

## Future Enhancements

### Post-MVP Features
- **Stat caps** - Maximum stat values to prevent overflow
- **Percentage-based modifiers** - Alternative to flat material adjustments
- **Combat effectiveness ratings** - Derived stats for UI display
- **Stat comparisons** - Helper methods for equipment optimization

### Advanced Features
- **Stat prediction** - Calculate stats for hypothetical upgrades/materials
- **Optimization algorithms** - Find best material combinations
- **Stat history tracking** - Monitor stat changes over time
- **Export/import** - Save/load stat configurations

---

This specification provides the foundation for implementing a robust, testable, and performant stat calculation system that serves as the cornerstone for item management, inventory display, and equipment optimization throughout the Mystica game system.

## See Also

### Related Service Specifications
- **[InventoryService](./inventory-service-spec.md)** - Uses StatsService for item stat display in inventory listing
- **[ItemService](./item-service-spec.md)** - Uses StatsService for detailed item stat computation and upgrade previews
- **[EquipmentService](./equipment-service-spec.md)** - Uses StatsService for equipment aggregation and player total stats
- **[MaterialService](./material-service-spec.md)** - Provides material data for stat modifier application

### Integration Dependencies
**Services that depend on StatsService**:
- `ItemService.getItemDetails()` - Requires `computeItemStats()`
- `InventoryService.getPlayerInventory()` - Requires `computeItemStatsForLevel()` for stacking
- `EquipmentService.getEquippedItems()` - Requires `computeEquipmentStats()` for aggregation

### Cross-Referenced Features
- **F-03**: Base Items & Equipment (primary feature for stat calculation)
- **F-04**: Materials System (zero-sum material modifier application)
- **F-06**: Item Upgrade System (level-based stat scaling)
- **F-09**: Inventory Management System (stat display for unique vs stackable items)