# Equipment System Investigation

**Date:** 2025-01-27
**Context:** User reports equipment displays but cannot equip/unequip items
**Status:** Analysis Complete

## Current Implementation Status

### Frontend (New-Mystica/New-Mystica/)

#### ✅ What Exists and Works
- **EquipmentView.swift:218-531** - Complete equipment display UI
  - 8-slot layout: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet
  - Visual equipment slots with item images, rarity colors, stats display
  - Item detail popup (lines 402-521) showing item stats, name, description
  - Loading/error states with retry functionality
  - Character-centered equipment layout with proper slot positioning

- **EquipmentService.swift:34-147** - iOS service for API communication
  - `loadEquipment()` method calls `GET /equipment` endpoint
  - Full HTTP client with bearer token authentication
  - Error handling with specific error types
  - Uses `@MainActor` for UI thread safety

- **Equipment.swift:10-54** - Complete Swift models
  - `Equipment` struct with slots, totalStats, equipmentCount
  - `EquipmentSlots` struct mapping all 8 slots to PlayerItem?
  - Proper Codable implementation with snake_case mapping

- **PlayerItem.swift:10-70** - Item model with equipment compatibility
  - Complete item data including stats, level, materials
  - `ItemType` includes `equipmentSlot` property for slot determination

#### ❌ What's Missing - Frontend Gaps
1. **No equip/unequip actions in EquipmentView** - Only shows item details popup, no "Equip" or "Unequip" buttons
2. **No inventory integration** - Cannot browse unequipped items for equipping
3. **No equip/unequip API calls** in EquipmentService - only has `loadEquipment()`
4. **CollectionView.swift uses dummy data** - no real inventory service integration
5. **No item selection flow** - missing UI to select items from inventory for equipping

### Backend (mystica-express/src/)

#### ✅ What Exists and Works - FULLY IMPLEMENTED
- **EquipmentService.ts:8-342** - Complete business logic implementation
  - `getEquippedItems()` - Returns all 8 slots with items and total stats
  - `equipItem()` - Validates ownership, uses RPC `equip_item()` for atomic operations
  - `unequipItem()` - Uses RPC `unequip_item()` for slot clearing
  - `mapCategoryToSlot()` - Maps item categories to appropriate slots
  - Full error handling with Supabase error mapping

- **EquipmentController.ts:9-92** - Complete request handlers
  - `GET /equipment` - Returns equipped items and stats (lines 14-48)
  - `POST /equipment/equip` - Equips item with validation (lines 54-70)
  - `POST /equipment/unequip` - Unequips from slot (lines 76-91)

- **routes/equipment.ts:7-35** - Complete route definitions
  - All endpoints with proper auth middleware and Zod validation
  - Schemas: `EquipItemSchema` (item_id), `UnequipItemSchema` (slot)

### Database Layer

#### ✅ What Exists and Works - FULLY IMPLEMENTED
- **UserEquipment table** (migrations/001_initial_schema.sql)
  - Primary key: (user_id, slot_name) - exactly one item per slot
  - Foreign keys: user → Users, slot_name → EquipmentSlots, item_id → Items
  - Proper indexes and constraints, marked as "SINGLE SOURCE OF TRUTH"

- **RPC Functions** (migrations/003_atomic_transaction_rpcs.sql, 004_equipment_rpcs.sql)
  - `equip_item(p_user_id, p_item_id, p_slot_name)` - Atomic equip with validation
  - `unequip_item(p_user_id, p_slot_name)` - Atomic unequip
  - Built-in validation: ownership, category compatibility, slot conflicts
  - Automatic stat recalculation after equipment changes

- **Views for Stats**
  - `v_player_equipped_stats` - Aggregated stats from equipped items
  - `v_item_total_stats` - Individual item stat calculations

## Data Flow Analysis

### Current Working Flow (Display Only)
1. **EquipmentView loads** → `EquipmentService.loadEquipment()`
2. **iOS makes API call** → `GET /equipment` with Bearer token
3. **Backend queries** → `EquipmentService.getEquippedItems()`
4. **Database query** → UserEquipment JOIN Items JOIN ItemTypes
5. **Response formatted** → Equipment model with 8 slots + stats
6. **UI updates** → Shows equipped items in slot layout

### Missing Flow (Equipping Items)
**What SHOULD happen for equipping:**
1. User browses inventory (needs InventoryService integration)
2. User taps "Equip" on unequipped item
3. iOS calls `POST /equipment/equip` with item_id
4. Backend calls `equip_item()` RPC function
5. Database atomically updates UserEquipment table
6. Response includes updated equipment state
7. UI refreshes to show newly equipped item

**What SHOULD happen for unequipping:**
1. User taps equipped item → item detail popup
2. User taps "Unequip" button (needs to be added)
3. iOS calls `POST /equipment/unequip` with slot name
4. Backend calls `unequip_item()` RPC function
5. Database clears item_id for that slot
6. UI refreshes to show empty slot

## API Contract Compliance

### ✅ Implemented Endpoints
- `GET /equipment` - Returns 8-slot equipment state ✅
- `POST /equipment/equip` - Equips item by item_id ✅
- `POST /equipment/unequip` - Unequips by slot name ✅

### 📋 User Story Status (US-302-equip-items.yaml)
- "[ ] Given inventory open, when player taps item, then show 'Equip' button" - **MISSING**
- "[ ] Given equip button tapped, when action confirmed, then equip item" - **MISSING**
- "[ ] Given item equipped, when equipped, then update player stats" - **READY** (backend implemented)
- "[✓] Given equipment screen, when displayed, then show all equipped slots" - **COMPLETE**
- "[ ] Given pet selected, when activated, then set as active pet" - **MISSING** (different from equipment)

## Root Cause Analysis

The equipment system has a **complete backend** (service, controller, routes, database, RPC functions) but **incomplete frontend integration**. The gap is specifically:

1. **Missing inventory browsing** - No way to see unequipped items
2. **Missing equip actions** - No "Equip" buttons in UI
3. **Missing unequip actions** - No "Unequip" buttons in item details
4. **No API calls for equip/unequip** - EquipmentService only loads, doesn't modify

## Next Steps (Prioritized)

### 1. **Implement Inventory Integration** (High Priority)
- **Backend:** Complete `InventoryService.getPlayerInventory()` (currently throws NotImplementedError)
- **Frontend:** Replace CollectionView dummy data with real inventory API calls
- **Add item actions:** Show "Equip" button for unequipped items in inventory

### 2. **Add Equip/Unequip Actions to Frontend** (High Priority)
- **EquipmentService.swift:** Add `equipItem(itemId:)` and `unequipItem(slot:)` methods
- **EquipmentView.swift:** Add "Unequip" button to item detail popup (line 503)
- **CollectionView.swift:** Add "Equip" button to item detail popup

### 3. **Navigation Flow Between Views** (Medium Priority)
- Add navigation from EquipmentView to inventory for equipping
- Add navigation from inventory to EquipmentView after equipping
- Handle state refresh after equipment changes

### 4. **Enhanced UX Features** (Low Priority)
- Loading states during equip/unequip operations
- Success/error toasts for equipment actions
- Optimistic UI updates for immediate feedback

## Dependencies

- **Backend InventoryService** must be implemented before frontend inventory integration
- **Authentication flow** must work properly for API calls (currently functional)
- **Item data seeding** may be needed for testing equipment actions

## Risk Assessment

**Low Risk:** Backend equipment system is fully functional and tested
**Medium Risk:** Frontend integration requires careful state management between views
**Critical Path:** InventoryService implementation blocks user testing of equipment functionality