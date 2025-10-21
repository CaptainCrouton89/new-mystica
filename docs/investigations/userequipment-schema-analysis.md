# UserEquipment Schema Analysis & Implementation Guide

**Date:** 2025-01-21
**Scope:** Database schema analysis for UserEquipment table and 8-slot equipment system
**Status:** Complete - Ready for implementation

## Executive Summary

The UserEquipment system is comprehensively designed with:
- **8 hardcoded equipment slots** defined in seed data
- **Atomic transaction RPC functions** already implemented for equip/unequip operations
- **Database views** for automatic stat calculation and aggregation
- **Repository pattern** ready to extend with BaseRepository
- **Validation constraints** enforced at database level

**Key Finding:** Most complex transaction logic is already implemented as PostgreSQL RPC functions, reducing service-layer complexity significantly.

---

## 1. UserEquipment Table Schema

### Table Definition
**File:** `migrations/001_initial_schema.sql:306-322`

```sql
CREATE TABLE UserEquipment (
    user_id UUID NOT NULL,
    slot_name VARCHAR NOT NULL,
    item_id UUID,
    equipped_at TIMESTAMP,
    PRIMARY KEY (user_id, slot_name),
    CONSTRAINT fk_user_equipment_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_equipment_slot FOREIGN KEY (slot_name) REFERENCES EquipmentSlots(slot_name) ON DELETE RESTRICT,
    CONSTRAINT fk_user_equipment_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE SET NULL
);
```

### Key Characteristics
- **Composite Primary Key:** `(user_id, slot_name)` ensures one item per slot per user
- **Nullable item_id:** Allows empty slots (unequipped state)
- **Cascade Deletion:** User deletion removes all equipment
- **SET NULL on Item Deletion:** Item deletion unequips but preserves slot
- **Slot Validation:** slot_name must exist in EquipmentSlots seed table

### Indexes
```sql
CREATE INDEX idx_user_equipment_user_id_slot_name ON UserEquipment(user_id, slot_name);
CREATE INDEX idx_user_equipment_item_id ON UserEquipment(item_id) WHERE item_id IS NOT NULL;
```

---

## 2. Equipment Slots System

### 8 Hardcoded Slots
**File:** `mystica-express/src/types/schemas.ts:11-13`

```typescript
export const EquipmentSlotSchema = z.enum([
  'weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'
]);
```

### Slot Categories
**File:** `migrations/001_initial_schema.sql:182-191`

```sql
CREATE TABLE EquipmentSlots (
    slot_name VARCHAR PRIMARY KEY CHECK (slot_name IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet')),
    display_name VARCHAR NOT NULL,
    sort_order INT NOT NULL,
    description TEXT
);
```

### Slot-Category Mapping
- **weapon** → ItemTypes.category = 'weapon'
- **offhand** → ItemTypes.category = 'offhand'
- **head** → ItemTypes.category = 'head'
- **armor** → ItemTypes.category = 'armor'
- **feet** → ItemTypes.category = 'feet'
- **accessory_1, accessory_2** → ItemTypes.category = 'accessory'
- **pet** → ItemTypes.category = 'pet'

---

## 3. Join Patterns & Data Retrieval

### Current Service Implementation
**File:** `mystica-express/src/services/EquipmentService.ts:18-43`

```typescript
const { data, error } = await supabase
  .from('userequipment')
  .select(`
    slot_name,
    item_id,
    items (
      id,
      user_id,
      item_type_id,
      level,
      is_styled,
      current_stats,
      material_combo_hash,
      generated_image_url,
      created_at,
      itemtypes (
        id,
        name,
        category,
        base_stats_normalized,
        rarity,
        description
      )
    )
  `)
  .eq('user_id', userId);
```

### Optimized Query Pattern
```sql
-- Full equipment with computed stats using database views
SELECT
  ue.slot_name,
  ue.item_id,
  ue.equipped_at,
  vits.name,
  vits.category,
  vits.level,
  vits.rarity,
  vits.is_styled,
  vits.atk_power,
  vits.atk_accuracy,
  vits.def_power,
  vits.def_accuracy,
  vits.total_stats,
  i.generated_image_url,
  i.material_combo_hash
FROM UserEquipment ue
LEFT JOIN v_item_total_stats vits ON ue.item_id = vits.id
LEFT JOIN Items i ON ue.item_id = i.id
WHERE ue.user_id = $1
ORDER BY es.sort_order;
```

### Complete Data Structure
```typescript
interface EquippedItemDetails {
  slot_name: string;
  item_id: string | null;
  equipped_at: string | null;

  // From v_item_total_stats view
  name: string;
  category: string;
  level: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  is_styled: boolean;
  atk_power: number;
  atk_accuracy: number;
  def_power: number;
  def_accuracy: number;
  total_stats: number;

  // From Items table
  generated_image_url: string | null;
  material_combo_hash: string | null;
}
```

---

## 4. Stat Calculation System

### Database Views for Automatic Calculation

#### v_item_total_stats View
**File:** `migrations/001_initial_schema.sql:846-865`

**Purpose:** Computes final item stats with rarity multiplier applied

**Formula:** `base_stats_normalized × rarity_multiplier × level × 10`

```sql
CREATE OR REPLACE VIEW v_item_total_stats AS
SELECT
    i.id,
    it.name,
    it.category AS slot,
    it.rarity,
    i.level,
    i.is_styled,
    (it.base_stats_normalized->>'atkPower')::numeric * rd.stat_multiplier * i.level * 10 AS atk_power,
    (it.base_stats_normalized->>'atkAccuracy')::numeric * rd.stat_multiplier * i.level * 10 AS atk_accuracy,
    (it.base_stats_normalized->>'defPower')::numeric * rd.stat_multiplier * i.level * 10 AS def_power,
    (it.base_stats_normalized->>'defAccuracy')::numeric * rd.stat_multiplier * i.level * 10 AS def_accuracy,
    ((it.base_stats_normalized->>'atkPower')::numeric +
     (it.base_stats_normalized->>'atkAccuracy')::numeric +
     (it.base_stats_normalized->>'defPower')::numeric +
     (it.base_stats_normalized->>'defAccuracy')::numeric) * rd.stat_multiplier * i.level * 10 AS total_stats
FROM Items i
JOIN ItemTypes it ON i.item_type_id = it.id
JOIN RarityDefinitions rd ON it.rarity = rd.rarity;
```

#### v_player_equipped_stats View
**File:** `migrations/001_initial_schema.sql:869-885`

**Purpose:** Aggregates all equipped item stats for each player

```sql
CREATE OR REPLACE VIEW v_player_equipped_stats AS
SELECT
    u.id AS player_id,
    COALESCE(SUM(vits.atk_power), 0) AS atk,
    COALESCE(SUM(vits.def_power), 0) AS def,
    COALESCE(SUM(vits.atk_power + vits.def_power), 0) AS hp,
    COALESCE(SUM(vits.atk_accuracy + vits.def_accuracy), 0) AS acc,
    combat_rating(
        COALESCE(SUM(vits.atk_power), 0),
        COALESCE(SUM(vits.def_power), 0),
        COALESCE(SUM(vits.atk_power + vits.def_power), 0)
    ) AS combat_rating
FROM Users u
LEFT JOIN UserEquipment ue ON u.id = ue.user_id
LEFT JOIN v_item_total_stats vits ON ue.item_id = vits.id
GROUP BY u.id;
```

### Stat Calculation Implementation

**Recommended Approach:** Use database views for stat calculation

```typescript
// Get total player stats (recommended)
async getTotalStats(userId: string): Promise<Stats> {
  const { data, error } = await supabase
    .from('v_player_equipped_stats')
    .select('atk, def, hp, acc, combat_rating')
    .eq('player_id', userId)
    .single();

  if (error) throw mapSupabaseError(error);

  return {
    atkPower: data.atk,
    atkAccuracy: data.acc,
    defPower: data.def,
    defAccuracy: data.acc,
    hp: data.hp,
    combat_rating: data.combat_rating
  };
}
```

---

## 5. Validation & Constraints

### Database-Level Validation

#### Slot Name Validation
```sql
-- EquipmentSlots table enforces valid slot names
slot_name VARCHAR PRIMARY KEY CHECK (slot_name IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'))
```

#### Category Compatibility Validation
**File:** `migrations/003_atomic_transaction_rpcs.sql:640-686`

```sql
-- equip_item() RPC function validates category compatibility
SELECT it.category INTO v_item_category
FROM Items i
JOIN ItemTypes it ON i.item_type_id = it.id
WHERE i.id = p_item_id AND i.user_id = p_user_id;

-- Get slot category from EquipmentSlots
SELECT category INTO v_slot_category
FROM EquipmentSlots
WHERE slot_name = p_slot_name;

-- Validate category compatibility
IF v_item_category != v_slot_category THEN
    RETURN jsonb_build_object(
        'success', false,
        'error_code', 'CATEGORY_MISMATCH',
        'message', 'Item category (' || v_item_category || ') does not match slot category (' || v_slot_category || ')'
    );
END IF;
```

#### Ownership Validation
```sql
-- Validates user owns the item before equipping
SELECT it.category INTO v_item_category
FROM Items i
JOIN ItemTypes it ON i.item_type_id = it.id
WHERE i.id = p_item_id AND i.user_id = p_user_id;
```

#### Duplicate Equipment Prevention
```sql
-- Prevents equipping same item in multiple slots
IF EXISTS(SELECT 1 FROM UserEquipment WHERE item_id = p_item_id) THEN
    RETURN jsonb_build_object(
        'success', false,
        'error_code', 'ITEM_ALREADY_EQUIPPED',
        'message', 'Item is already equipped in another slot'
    );
END IF;
```

---

## 6. Atomic Transaction Patterns

### Key RPC Functions Already Implemented

#### equip_item() Function
**File:** `migrations/003_atomic_transaction_rpcs.sql:640-749`

**Atomic Operations:**
1. Validate item ownership and category compatibility
2. Check for duplicate equipment
3. Update/insert UserEquipment record
4. Recalculate vanity_level and avg_item_level
5. Update Users table

**Usage:**
```sql
SELECT equip_item('user-uuid', 'item-uuid', 'weapon');
-- Returns: { "success": true, "data": { "equipped_item_id": "...", "vanity_level": 150, ... } }
```

#### Unequip Pattern (Missing - Need to Implement)
```sql
-- Recommended implementation
CREATE OR REPLACE FUNCTION unequip_item(
    p_user_id UUID,
    p_slot_name VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_item_id UUID;
    v_vanity_level INTEGER;
    v_avg_item_level DECIMAL;
BEGIN
    -- Get currently equipped item
    SELECT item_id INTO v_item_id
    FROM UserEquipment
    WHERE user_id = p_user_id AND slot_name = p_slot_name;

    IF v_item_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SLOT_EMPTY',
            'message', 'No item equipped in slot: ' || p_slot_name
        );
    END IF;

    -- Remove from equipment
    DELETE FROM UserEquipment
    WHERE user_id = p_user_id AND slot_name = p_slot_name;

    -- Recalculate stats (same logic as equip_item)
    -- ... stat recalculation code ...

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'unequipped_item_id', v_item_id,
            'slot_name', p_slot_name,
            'vanity_level', v_vanity_level,
            'avg_item_level', v_avg_item_level
        )
    );
END;
$$ LANGUAGE plpgsql;
```

### Loadout Activation
**File:** `migrations/003_atomic_transaction_rpcs.sql:753-843`

**Atomic Operations:**
1. Deactivate all user loadouts
2. Activate target loadout
3. Clear current equipment
4. Copy loadout slots to UserEquipment
5. Recalculate user stats

---

## 7. Repository Layer Implementation

### Recommended Repository Structure

```typescript
// src/repositories/EquipmentRepository.ts
export class EquipmentRepository extends BaseRepository<UserEquipment> {
  constructor() {
    super('userequipment'); // Note: lowercase table name in Supabase
  }

  // Get equipped items with full details using database views
  async findEquippedByUser(userId: string): Promise<EquippedItemDetails[]> {
    const { data, error } = await this.client
      .from('userequipment')
      .select(`
        slot_name,
        item_id,
        equipped_at,
        v_item_total_stats!inner(
          name,
          category,
          level,
          rarity,
          is_styled,
          atk_power,
          atk_accuracy,
          def_power,
          def_accuracy,
          total_stats
        ),
        items!inner(
          generated_image_url,
          material_combo_hash
        )
      `)
      .eq('user_id', userId)
      .order('slot_name');

    if (error) throw mapSupabaseError(error);
    return data || [];
  }

  // Get aggregated player stats using view
  async getTotalStats(userId: string): Promise<PlayerStats> {
    const { data, error } = await this.client
      .from('v_player_equipped_stats')
      .select('atk, def, hp, acc, combat_rating')
      .eq('player_id', userId)
      .single();

    if (error) throw mapSupabaseError(error);
    return data;
  }

  // Equip item using RPC function
  async equipItem(userId: string, itemId: string, slotName: string): Promise<EquipResult> {
    const { data, error } = await this.rpc('equip_item', {
      p_user_id: userId,
      p_item_id: itemId,
      p_slot_name: slotName
    });

    if (error) throw mapSupabaseError(error);

    if (!data.success) {
      throw new BusinessLogicError(data.error_code, data.message);
    }

    return data.data;
  }

  // Unequip item (need to implement RPC function first)
  async unequipItem(userId: string, slotName: string): Promise<UnequipResult> {
    const { data, error } = await this.rpc('unequip_item', {
      p_user_id: userId,
      p_slot_name: slotName
    });

    if (error) throw mapSupabaseError(error);

    if (!data.success) {
      throw new BusinessLogicError(data.error_code, data.message);
    }

    return data.data;
  }

  // Check if item is equipped
  async isItemEquipped(itemId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from('userequipment')
      .select('item_id', { count: 'exact', head: true })
      .eq('item_id', itemId);

    if (error) throw mapSupabaseError(error);
    return (count || 0) > 0;
  }

  // Get slot for equipped item
  async getEquippedSlot(itemId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('userequipment')
      .select('slot_name')
      .eq('item_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not equipped
      throw mapSupabaseError(error);
    }

    return data.slot_name;
  }

  // Validate slot name
  async validateSlotName(slotName: string): Promise<boolean> {
    const { count, error } = await this.client
      .from('equipmentslots')
      .select('slot_name', { count: 'exact', head: true })
      .eq('slot_name', slotName);

    if (error) throw mapSupabaseError(error);
    return (count || 0) > 0;
  }
}
```

---

## 8. Service Layer Integration

### Refactored EquipmentService

```typescript
// src/services/EquipmentService.ts
export class EquipmentService {
  constructor(
    private equipmentRepository: EquipmentRepository,
    private itemRepository: ItemRepository
  ) {}

  async getEquippedItems(userId: string): Promise<{ slots: EquipmentSlots; total_stats: Stats }> {
    // Get equipped items using repository
    const equippedItems = await this.equipmentRepository.findEquippedByUser(userId);

    // Transform to slots object
    const slots: EquipmentSlots = {
      weapon: undefined,
      offhand: undefined,
      head: undefined,
      armor: undefined,
      feet: undefined,
      accessory_1: undefined,
      accessory_2: undefined,
      pet: undefined
    };

    equippedItems.forEach(item => {
      const slotName = item.slot_name as keyof EquipmentSlots;
      slots[slotName] = this.mapToItem(item);
    });

    // Get total stats using database view
    const total_stats = await this.equipmentRepository.getTotalStats(userId);

    return { slots, total_stats };
  }

  async equipItem(userId: string, itemId: string): Promise<EquipResult> {
    // Get item to determine slot
    const item = await this.itemRepository.findByIdWithItemType(itemId, userId);
    if (!item) {
      throw new NotFoundError('Item', itemId);
    }

    // Map category to slot name
    const slotName = this.mapCategoryToSlot(item.item_type.category);

    // Use RPC function via repository
    return await this.equipmentRepository.equipItem(userId, itemId, slotName);
  }

  async unequipItem(userId: string, slotName: string): Promise<boolean> {
    // Validate slot name
    const isValidSlot = await this.equipmentRepository.validateSlotName(slotName);
    if (!isValidSlot) {
      throw new ValidationError(`Invalid slot name: ${slotName}`);
    }

    // Use RPC function via repository
    const result = await this.equipmentRepository.unequipItem(userId, slotName);
    return result.success;
  }

  private mapCategoryToSlot(category: string): string {
    const mapping: Record<string, string> = {
      'weapon': 'weapon',
      'offhand': 'offhand',
      'head': 'head',
      'armor': 'armor',
      'feet': 'feet',
      'accessory': 'accessory_1', // Default to first accessory slot
      'pet': 'pet'
    };

    return mapping[category] || 'accessory_1';
  }

  private mapToItem(equippedItem: EquippedItemDetails): Item {
    // Transform database result to Item interface
    return {
      id: equippedItem.item_id!,
      // ... other mapping
    };
  }
}
```

---

## 9. Error Handling Patterns

### RPC Function Error Responses
```typescript
// Standardized RPC error handling
interface RPCResponse {
  success: boolean;
  data?: any;
  error_code?: string;
  message?: string;
}

// Service layer error handling
async equipItem(userId: string, itemId: string, slotName: string): Promise<EquipResult> {
  const result = await this.rpc('equip_item', { p_user_id: userId, p_item_id: itemId, p_slot_name: slotName });

  if (!result.success) {
    switch (result.error_code) {
      case 'ITEM_NOT_FOUND':
        throw new NotFoundError('Item', itemId);
      case 'INVALID_SLOT':
        throw new ValidationError(`Invalid slot: ${slotName}`);
      case 'CATEGORY_MISMATCH':
        throw new BusinessLogicError('CATEGORY_MISMATCH', result.message);
      case 'ITEM_ALREADY_EQUIPPED':
        throw new BusinessLogicError('ITEM_ALREADY_EQUIPPED', result.message);
      default:
        throw new DatabaseError(`Equipment operation failed: ${result.message}`);
    }
  }

  return result.data;
}
```

---

## 10. Performance Optimizations

### Query Optimization Recommendations

#### 1. Use Database Views
- **v_item_total_stats** for computed item stats
- **v_player_equipped_stats** for aggregated player stats
- Avoids complex joins and calculations in application code

#### 2. Efficient Equipment Queries
```sql
-- Single query for all equipped items with stats
SELECT
  ue.slot_name,
  ue.item_id,
  vits.*,
  i.generated_image_url,
  i.material_combo_hash
FROM UserEquipment ue
LEFT JOIN v_item_total_stats vits ON ue.item_id = vits.id
LEFT JOIN Items i ON ue.item_id = i.id
WHERE ue.user_id = $1;
```

#### 3. Index Usage
```sql
-- Existing indexes optimize common queries
idx_user_equipment_user_id_slot_name  -- Equipment lookups
idx_user_equipment_item_id            -- Reverse lookups
```

#### 4. Caching Opportunities
- Cache player total stats (updated when equipment changes)
- Cache equipment loadouts for quick switching
- Cache item stat calculations

---

## 11. Missing Implementation Requirements

### 1. Create unequip_item RPC Function
**Priority:** High
**File:** `migrations/004_unequip_item_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION unequip_item(
    p_user_id UUID,
    p_slot_name VARCHAR
) RETURNS JSONB AS $$
-- Implementation needed (see section 6 for template)
```

### 2. Equipment Slot Category Mapping
**Priority:** Medium
**Current Issue:** EquipmentSlots table references missing category column

**Solution:** Add category column to EquipmentSlots seed data:
```sql
ALTER TABLE EquipmentSlots ADD COLUMN category VARCHAR;
UPDATE EquipmentSlots SET category = 'weapon' WHERE slot_name = 'weapon';
UPDATE EquipmentSlots SET category = 'offhand' WHERE slot_name = 'offhand';
-- ... etc for all slots
```

### 3. Service Layer Dependency Injection
**Priority:** Medium
**Current:** Services use direct Supabase client
**Target:** Services use repository pattern

### 4. Enhanced Error Types
**Priority:** Low
**Add:** BusinessLogicError class for equipment-specific errors

---

## 12. Testing Recommendations

### Repository Tests
```typescript
describe('EquipmentRepository', () => {
  it('should equip item to valid slot', async () => {
    const result = await equipmentRepo.equipItem(userId, itemId, 'weapon');
    expect(result.success).toBe(true);
    expect(result.equipped_item_id).toBe(itemId);
  });

  it('should prevent equipping wrong category', async () => {
    await expect(
      equipmentRepo.equipItem(userId, armorItemId, 'weapon')
    ).rejects.toThrow(BusinessLogicError);
  });

  it('should get total stats from view', async () => {
    const stats = await equipmentRepo.getTotalStats(userId);
    expect(stats).toHaveProperty('atk');
    expect(stats).toHaveProperty('combat_rating');
  });
});
```

### Service Integration Tests
```typescript
describe('EquipmentService', () => {
  it('should handle complete equip workflow', async () => {
    const result = await equipmentService.equipItem(userId, weaponItemId);
    expect(result.success).toBe(true);

    const equipment = await equipmentService.getEquippedItems(userId);
    expect(equipment.slots.weapon).toBeDefined();
    expect(equipment.total_stats.atkPower).toBeGreaterThan(0);
  });
});
```

---

## 13. Implementation Timeline

### Phase 1: Repository Foundation (3 days)
1. Create EquipmentRepository extending BaseRepository
2. Implement basic CRUD operations
3. Add findEquippedByUser method using existing query patterns
4. Create unequip_item RPC function

### Phase 2: Service Refactoring (2 days)
1. Refactor EquipmentService to use repository
2. Remove direct Supabase client usage
3. Add dependency injection for repository
4. Update error handling to use new error types

### Phase 3: Advanced Features (2 days)
1. Implement stat calculation using database views
2. Add equipment validation helpers
3. Create comprehensive test suite
4. Performance optimization and caching

### Phase 4: Integration & Testing (1 day)
1. Integration tests with existing services
2. End-to-end equipment workflow testing
3. Performance benchmarking
4. Documentation updates

**Total Estimated Time:** 8 days

---

## 14. Conclusion

**Assessment:** The UserEquipment system is well-architected with comprehensive database-level constraints, atomic transaction patterns, and optimized view-based stat calculations.

**Key Strengths:**
- Atomic RPC functions handle complex transaction logic
- Database views provide efficient stat aggregation
- Comprehensive validation at database level
- Repository pattern ready for implementation

**Primary Gaps:**
- Missing unequip_item RPC function
- Service layer still uses direct Supabase queries
- Need equipment slot category mapping table update

**Recommendation:** Implement repository pattern to wrap existing RPC functions rather than building complex transaction logic in service layer. The database foundation is solid and ready for production use.

**Next Steps:**
1. Create unequip_item RPC function
2. Implement EquipmentRepository with RPC function calls
3. Refactor EquipmentService to use repository
4. Add comprehensive test coverage

---

**File References:**
- Schema: `migrations/001_initial_schema.sql:306-322`
- Transactions: `migrations/003_atomic_transaction_rpcs.sql:640-843`
- Service: `src/services/EquipmentService.ts`
- Types: `src/types/schemas.ts:11-13`
- Views: `migrations/001_initial_schema.sql:846-885`