# Atomic Transaction RPC Functions - Implementation Summary

## Overview

Created `003_atomic_transaction_rpcs.sql` with 10 PostgreSQL RPC functions for atomic database transactions as specified in `docs/repository-implementation-guide.md`.

## Functions Implemented

### Material Operations
1. **`apply_material_to_item(p_user_id, p_item_id, p_material_id, p_style_id, p_slot_index)`**
   - Atomically: decrement stack → create instance → link to item → update is_styled → generate combo_hash
   - Validates: slot index (0-2), item ownership, stack availability, slot occupancy
   - Error codes: INVALID_SLOT_INDEX, ITEM_NOT_FOUND, SLOT_OCCUPIED, INSUFFICIENT_MATERIALS

2. **`remove_material_from_item(p_item_id, p_slot_index)`**
   - Atomically: unlink → delete instance → increment stack → update is_styled → regenerate combo_hash
   - Validates: slot index, slot occupancy
   - Error codes: INVALID_SLOT_INDEX, SLOT_EMPTY

3. **`replace_material_on_item(p_user_id, p_item_id, p_slot_index, p_new_material_id, p_new_style_id)`**
   - Atomically: remove old → apply new
   - Combines both previous functions with error recovery
   - Error codes: All from remove + apply functions

### Profile/Currency Operations
4. **`deduct_currency_with_logging(p_user_id, p_currency_code, p_amount, p_source_type, p_source_id, p_metadata)`**
   - Atomically: check balance → deduct → log transaction
   - Validates: positive amount, sufficient funds
   - Error codes: INVALID_AMOUNT, INSUFFICIENT_FUNDS

5. **`add_currency_with_logging(p_user_id, p_currency_code, p_amount, p_source_type, p_source_id, p_metadata)`**
   - Atomically: add → log transaction (with UPSERT)
   - Validates: positive amount
   - Error codes: INVALID_AMOUNT

6. **`add_xp_and_level_up(p_user_id, p_xp_amount)`**
   - Atomically: add XP → check level up → update level + xp_to_next_level
   - Implements level-up formula: 100 * level XP per level
   - Handles multiple level-ups in single transaction
   - Error codes: INVALID_AMOUNT

### Item Operations
7. **`process_item_upgrade(p_user_id, p_item_id, p_gold_cost, p_new_level, p_new_stats)`**
   - Atomically: validate → deduct gold → update item → log transaction → add history
   - Validates: item ownership, level progression, costs
   - Error codes: INVALID_INPUT, ITEM_NOT_FOUND, INVALID_LEVEL, plus currency errors

### Equipment Operations
8. **`equip_item(p_user_id, p_item_id, p_slot_name)`**
   - Atomically: validate category → update UserEquipment → recalc vanity_level/avg_item_level
   - Validates: item ownership, slot compatibility, not already equipped
   - Error codes: ITEM_NOT_FOUND, INVALID_SLOT, CATEGORY_MISMATCH, ITEM_ALREADY_EQUIPPED

9. **`activate_loadout(p_user_id, p_loadout_id)`**
   - Atomically: deactivate others → activate target → copy slots → recalc stats
   - Bulk equipment update with proper stat recalculation
   - Error codes: LOADOUT_NOT_FOUND

### Combat Operations
10. **`update_combat_history(p_user_id, p_location_id, p_result)`**
    - Atomically: UPSERT history with streak calculation
    - Handles win/loss streaks, longest streak tracking
    - Validates: combat_result enum (victory, defeat only for history)
    - Error codes: INVALID_RESULT, INVALID_RESULT_FOR_HISTORY

## Technical Implementation Details

### Error Handling
- **Structured JSON responses**: All functions return `{success: boolean, error_code?: string, message?: string, data?: object}`
- **Specific error codes**: Each validation failure has a unique error code for frontend handling
- **Exception handling**: All functions wrapped in BEGIN/EXCEPTION blocks
- **Graceful degradation**: Transaction rollback on any failure

### Transaction Isolation
- **Automatic transaction isolation**: PostgreSQL function execution provides ACID guarantees
- **Atomic operations**: Complex multi-step operations are truly atomic
- **Concurrent safety**: Functions handle race conditions properly

### Data Integrity
- **Foreign key validation**: Checks item ownership, material existence, etc.
- **Constraint validation**: Respects UNIQUE constraints, CHECK constraints
- **Combo hash generation**: Deterministic SHA256 hashing for material combinations
- **Stat recalculation**: Proper vanity_level and avg_item_level updates

### Performance Optimizations
- **Efficient queries**: Single queries where possible, minimal table scans
- **Proper indexing**: Functions assume proper indexes exist on referenced columns
- **UPSERT patterns**: ON CONFLICT handling for currency balances, material stacks
- **Bulk operations**: activate_loadout handles all 8 slots efficiently

## Database Dependencies

### Required Tables
- Users, UserCurrencyBalances, EconomyTransactions, PlayerProgression
- Items, ItemTypes, ItemMaterials, MaterialInstances, MaterialStacks, Materials
- UserEquipment, EquipmentSlots, Loadouts, LoadoutSlots
- PlayerCombatHistory, ItemHistory

### Required Enums
- `combat_result` enum with values: victory, defeat, escape, abandoned

### Required Constraints
- MaterialStacks composite PK: (user_id, material_id, style_id)
- ItemMaterials UNIQUE: material_instance_id (prevents reuse)
- UserEquipment UNIQUE: (user_id, slot_name)
- Loadouts partial UNIQUE: (user_id) WHERE is_active = true

## Testing Recommendations

### Unit Testing
```sql
-- Test apply_material_to_item
SELECT apply_material_to_item(
  'user-123'::uuid,
  'item-456'::uuid,
  'material-789'::uuid,
  'normal',
  0
);
```

### Integration Testing
- Test with actual database constraints
- Verify foreign key relationships
- Test concurrent access scenarios
- Validate transaction rollback on failures

### Performance Testing
- Test with large material stacks
- Test bulk loadout activation
- Monitor query execution plans

## Migration Application

This migration can be applied to Supabase using:
```bash
# Via Supabase CLI
supabase db diff --file migrations/003_atomic_transaction_rpcs.sql

# Or via SQL editor in Supabase dashboard
# Copy-paste the entire file contents
```

## Compliance with Requirements

✅ **All 10 functions implemented** with exact signatures from docs/repository-implementation-guide.md
✅ **Proper transaction isolation** using PostgreSQL function execution
✅ **Comprehensive error handling** with specific error codes and messages
✅ **Structured JSON responses** for easy frontend consumption
✅ **Edge case handling** for all documented scenarios
✅ **Performance optimized** with efficient query patterns

The implementation fully satisfies the requirements for atomic database transactions in the Mystica backend architecture.