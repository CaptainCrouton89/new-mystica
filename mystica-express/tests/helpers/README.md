# Test Helpers

This directory contains utilities for loading real game seed data and validating game logic in tests.

## Files

### `seedData.ts` - Seed Data Loaders

Utilities to load actual game configuration from `docs/` JSON files.

**Core Loaders:**
```typescript
import { loadSeededItems, loadSeededMaterials, loadSeededMonsters } from './seedData.js';

// Load all items, materials, monsters from seed data
const items = await loadSeededItems();
const materials = await loadSeededMaterials();
const monsters = await loadSeededMonsters();
```

**Lookup Functions:**
```typescript
// Find specific items/materials by ID
const sword = await getItemByType('sword');
const coffee = await getMaterialById('coffee');
const goblin = await getEnemyById('spray_paint_goblin');
```

**Random Generation:**
```typescript
// Get random materials for testing
const material = await getRandomMaterial();
const materials = await getRandomMaterials(3); // No duplicates
```

**Validation:**
```typescript
// Validate game balance rules
const itemCheck = await validateItemStatNormalization(); // Stats sum to 1.0
const materialCheck = await validateMaterialModifierBalance(); // Modifiers sum to 0.0
```

### `assertions.ts` - Test Assertions

Reusable validation functions for game data structures and business rules.

**Stats Validation:**
```typescript
import { expectValidNormalizedStats, expectValidMaterialModifiers } from './assertions.js';

// Item base stats must sum to 1.0
expectValidNormalizedStats(item.base_stats);

// Material modifiers must sum to 0.0 for balance
expectValidMaterialModifiers(material.stat_modifiers);
```

**Structure Validation:**
```typescript
// Validate complete item structure
expectValidItem(playerItem);
expectValidItemType(seedItem);
expectValidMaterial(material);

// Validate business rules
expectValidMaterialApplication(craftedItem); // 1-3 materials max
expectCorrectStyledFlag(styledItem); // is_styled flag consistency
```

**Utility Assertions:**
```typescript
// Common validations
expectValidUUID(item.id);
expectValidTimestamp(item.created_at);
expectValidGoldAmount(reward.gold);
expectValidRarity(item.rarity);
expectValidEquipmentSlot(item.slot);
```

## Usage Examples

### Item System Testing
```typescript
describe('Item System', () => {
  it('should validate crafted sword stats', async () => {
    const sword = await getItemByType('sword');
    const materials = await getRandomMaterials(2);

    // Apply materials and validate result
    const craftedItem = applyCraftingLogic(sword, materials);
    expectValidItem(craftedItem);
    expectValidMaterialApplication(craftedItem);
  });
});
```

### Material System Testing
```typescript
describe('Material System', () => {
  it('should validate material balance', async () => {
    const materials = await loadSeededMaterials();

    for (const material of materials) {
      expectValidMaterial(material);
      expectValidMaterialModifiers(material.stat_modifiers);
    }
  });
});
```

### Combat System Testing
```typescript
describe('Combat System', () => {
  it('should validate enemy stats', async () => {
    const goblin = await getEnemyById('spray_paint_goblin');

    expect(goblin).toBeDefined();
    expect(goblin.min_combat_level).toBe(1);
    expect(goblin.dialogue_tone).toBe('aggressive');
  });
});
```

## Data Transformation

The seed data loaders automatically transform between seed data format and API format:

- **Items:** `"slot": "accessory"` → `"equipment_slot": "accessory_1"`
- **Items:** `"slot": "offhand"` → `"equipment_slot": "shield"`
- **Categories:** Auto-mapped from equipment slots

This ensures tests work with the actual seed data structure while validating against the API type system.

## Integration with Real Data

These utilities load the actual game configuration files:
- `docs/seed-data-items.json` - 25+ item types across all equipment slots
- `docs/seed-data-materials.json` - 15+ materials with balanced stat modifiers
- `docs/seed-data-monsters.json` - 5 enemy types with personalities
- `docs/seed-data-equipment-slots.json` - 8 equipment slot definitions

This ensures tests validate against real game balance and catch configuration issues early.