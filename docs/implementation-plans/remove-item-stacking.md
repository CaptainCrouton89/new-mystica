# Implementation Plan: Remove Item Stacking Functionality

**Date:** 2025-10-23
**Status:** Planning Phase
**Agent Investigation:** agent_798948

## Overview

This plan details the complete removal of item stacking functionality from the backend, moving to a unified system where ALL items appear individually in API responses with `generated_image_url`. Based on comprehensive code analysis, this affects 16 files across services, controllers, types, tests, and database layers.

## Core Changes Summary

### Before (Current Stacking System)
- Items classified by `material_combo_hash`: null = stackable, non-null = unique
- API responses: `{items: Item[], stacks: ItemStack[], pagination}`
- Stackable items grouped by `${item_type_id}_${level}` with `icon_url`
- Unique items shown individually with `generated_image_url`

### After (No Stacking System)
- ALL items treated as unique individuals
- API responses: `{items: Item[], pagination}` (no stacks array)
- ALL items use `generated_image_url` (fallback to default if null)
- Remove all stack grouping, sorting, and classification logic

## File-by-File Implementation Plan

### 1. Primary Service Layer

#### **src/services/InventoryService.ts** (MAJOR CHANGES)
**Lines to Remove:**
- 33-39: `ItemStack` interface definition
- 126-132: Material combo hash classification logic
- 164-184: Stack grouping and quantity accumulation
- 168: Stack key generation `${item.item_type_id}_${item.level}`
- Stack-related methods: `sortItemStacks()`, `getDefaultIcon()`

**Lines to Modify:**
- 126-371: Complete rewrite of `getPlayerInventory()` method
- Remove Map-based stack grouping
- Remove quantity accumulation logic
- Replace icon fallback with image fallback for ALL items

**New Logic:**
```typescript
// Replace material_combo_hash classification with:
const allItems = items.map(item => ({
  ...item,
  image_url: item.generated_image_url || this.getDefaultImage(item.item_type_id)
}));

// Remove stacks entirely from response:
return {
  items: sortedItems,
  pagination: paginationInfo
  // No stacks array
};
```

#### **src/services/ItemService.ts** (MINOR CHANGES)
**Lines to Remove:**
- 412-430: Legacy `getUserInventory()` with `material_stacks`
- 454, 459: Material stack references

**Action:** Mark legacy methods as deprecated, ensure no active usage

#### **src/services/MaterialService.ts** (MODERATE CHANGES)
**Lines to Modify:**
- 48-87: `getMaterialInventory()` method
- Remove `MaterialStackDetailed[]` return type
- Replace with individual material items

### 2. Repository Layer

#### **src/repositories/MaterialRepository.ts** (MAJOR CHANGES)
**Lines to Remove:**
- 131-146: `findAllStacksByUser()` method
- 201, 220, 299: Stack CRUD operations (increment, decrement, delete)

**Migration Strategy:**
- Keep `materialstacks` table for data integrity
- Replace stack queries with individual item queries
- Remove stack-specific database operations

### 3. API Layer

#### **src/controllers/InventoryController.ts** (MAJOR CHANGES)
**Lines to Modify:**
- 14-34: Complete rewrite of inventory endpoint response
- Remove `stacks` from response object
- Update response interface to match new format

**New Response Format:**
```typescript
// Before:
{ items: Item[], stacks: ItemStack[], pagination: PaginationInfo }

// After:
{ items: Item[], pagination: PaginationInfo }
```

#### **src/routes/inventory.ts** (MINOR CHANGES)
**Lines to Review:**
- 1-19: Ensure route still functions with new controller response

#### **src/controllers/MaterialController.ts** (REQUIRES READING)
**Action:** Read file to identify material stack endpoints that need updating

### 4. Type Definitions

#### **src/types/api.types.ts** (MAJOR CHANGES)
**Lines to Remove:**
- 143-147: `ItemStack` interface (conflicting definition)
- 119-138: `MaterialStackDetailed` interface
- 294-304: `InventoryResponse.material_stacks` property

**Lines to Modify:**
- Update `InventoryResponse` interface to remove stacks array
- Ensure all item response types use `generated_image_url`

#### **src/types/schemas.ts** (MINOR CHANGES)
**Lines to Review:**
- 277-285: `InventoryQuerySchema` validation
- Remove stack-specific query parameters if any

#### **src/types/database.types.ts** (NO CHANGES)
**Lines 1292-1358:** Keep `materialstacks` table definition for data preservation

### 5. Database Layer

#### **migrations/** (NO IMMEDIATE CHANGES)
**Strategy:**
- Keep existing `materialstacks` table structure
- Consider future migration to flatten data if needed
- Update RPC functions to handle individual items instead of stacks

**Files Affected:**
- `001_initial_schema.sql` (Lines 394-399): Keep for compatibility
- `005_material_transaction_rpcs.sql` (Multiple lines): Update RPC logic

### 6. Test Updates

#### **tests/unit/services/InventoryService.test.ts** (MAJOR CHANGES)
**Lines to Remove/Update:**
- 69, 110, 123: Stack classification tests
- 282, 457: Stack grouping tests
- 542-549: Stack quantity accumulation tests

**New Test Scenarios:**
- All items appear in `items` array
- No `stacks` property in response
- All items have `generated_image_url` or fallback
- Verify pagination works with individual items

#### **tests/unit/repositories/MaterialRepository.test.ts** (MODERATE CHANGES)
**Lines to Remove:**
- 179-190: `findAllStacksByUser()` tests
- 217, 260, 994, 996: Stack-specific repository tests

#### **tests/factories/material.factory.ts** (MINOR CHANGES)
**Lines 159+:** Update factory methods to create individual items instead of stacks

### 7. Seeding & Scripts

#### **scripts/seed-user-data.ts** (MODERATE CHANGES)
**Lines to Update:**
- 231-270: Material stack seeding logic
- 413-426: Stack verification queries
- Replace with individual item seeding

## Implementation Order & Dependencies

### Phase 1: Type System Updates (Low Risk)
1. **api.types.ts** - Remove conflicting interfaces
2. **schemas.ts** - Update validation schemas
3. **database.types.ts** - Review, no changes needed

### Phase 2: Service Layer Core Logic (High Risk)
1. **InventoryService.ts** - Rewrite main stacking logic
2. **MaterialService.ts** - Update material inventory methods
3. **ItemService.ts** - Deprecate legacy stack methods

### Phase 3: Repository Layer (Medium Risk)
1. **MaterialRepository.ts** - Replace stack methods with individual queries
2. Update database RPC calls if needed

### Phase 4: API Layer (Medium Risk)
1. **InventoryController.ts** - Update response format
2. **MaterialController.ts** - Review and update stack endpoints
3. **routes/inventory.ts** - Verify route compatibility

### Phase 5: Test Suite Updates (Low Risk)
1. **InventoryService.test.ts** - Rewrite all stack-related tests
2. **MaterialRepository.test.ts** - Update repository tests
3. **material.factory.ts** - Update test factories

### Phase 6: Scripts & Seeding (Low Risk)
1. **seed-user-data.ts** - Update seeding logic
2. Test with fresh database seed

## Breaking Changes & Migration

### API Response Changes
**Before:**
```json
{
  "items": [...],
  "stacks": [
    {
      "item_type_id": "magic_wand",
      "level": 1,
      "quantity": 5,
      "icon_url": "https://..."
    }
  ],
  "pagination": {...}
}
```

**After:**
```json
{
  "items": [
    {
      "id": "item_1",
      "item_type_id": "magic_wand",
      "level": 1,
      "generated_image_url": "https://...",
      ...
    },
    {
      "id": "item_2",
      "item_type_id": "magic_wand",
      "level": 1,
      "generated_image_url": "https://...",
      ...
    }
  ],
  "pagination": {...}
}
```

### Frontend Impact
- **SwiftUI:** Update inventory views to handle items array only
- **Remove:** Stack quantity displays and grouping logic
- **Update:** Use `generated_image_url` for ALL items with fallback

### Database Considerations
- `materialstacks` table preserved for data integrity
- Consider future migration to denormalize if performance issues
- RPC functions may need updates for individual item operations

## Risk Assessment

### High Risk Areas
1. **InventoryService.ts rewrite** - Core business logic changes
2. **API response format** - Breaking change for frontend
3. **Material repository queries** - Database operation changes

### Medium Risk Areas
1. **Controller layer updates** - API endpoint changes
2. **Test suite rewrite** - Extensive test modifications

### Low Risk Areas
1. **Type definition cleanup** - Compile-time safety
2. **Script updates** - Development tooling
3. **Legacy code deprecation** - Gradual cleanup

## Validation Checklist

### Functional Requirements
- [ ] ALL items appear in `items` array (no stacks)
- [ ] ALL items use `generated_image_url` or fallback
- [ ] Pagination works with individual items
- [ ] No stack grouping or quantity accumulation
- [ ] API responses match new format specification

### Technical Requirements
- [ ] All TypeScript compilation errors resolved
- [ ] All existing tests updated and passing
- [ ] No breaking database schema changes
- [ ] Performance acceptable with individual items
- [ ] Error handling preserved for edge cases

### Integration Requirements
- [ ] Frontend can consume new API format
- [ ] Material operations work with individual items
- [ ] Inventory generation preserves all item data
- [ ] Image URL fallback logic functions correctly

## Next Steps

1. **Approval:** Review plan with stakeholders
2. **Branch:** Create feature branch `remove-item-stacking`
3. **Implementation:** Follow phase-based approach above
4. **Testing:** Comprehensive testing at each phase
5. **Documentation:** Update API documentation
6. **Deployment:** Coordinate with frontend team for breaking changes

---

**Implementation Agent:** Assign to `backend-developer` specialist
**Estimated Effort:** 2-3 days (comprehensive refactoring)
**Frontend Coordination:** Required (breaking API changes)