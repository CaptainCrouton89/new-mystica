# Collections Page Implementation Plan

**Feature**: F-09 Inventory Management - Collections/Inventory Page Enhancement
**Scope**: Frontend UX enhancements for two-section inventory display with action menus
**Status**: Planning Complete
**Est. Total Effort**: 16-20 hours across 3 parallel batches

## Executive Summary

This plan implements the missing 30% of F-09's frontend requirements to complete the Collections page (InventoryView). The backend is 100% complete with full API support. We need to enhance the existing InventoryView with:

1. **All Materials section** with style-based borders and craft actions
2. **Four-action item menus** (Equip, Craft, Upgrade, Sell) with proper navigation
3. **Rarity/style border system** for visual distinction
4. **Bottom drawer selection** component for equipment actions
5. **Enhanced filtering** and **equipped status indicators**

The plan leverages existing Repository + ViewModel + Loadable patterns and maintains backward compatibility.

## Current State Analysis

**Backend Status**: ✅ 100% Complete
- InventoryService supports pagination (50 items/page), filtering by slot_type, sorting
- GET /inventory returns both items and materials with all required metadata
- Equipment endpoints ready for integration

**Frontend Status**: 70% Complete
- ✅ InventoryView basic structure with filter segments
- ✅ InventoryViewModel with Loadable state management
- ✅ Repository pattern with DefaultInventoryRepository
- ✅ ItemRow components for basic item display
- ❌ **Missing**: Materials section, action menus, borders, bottom drawer, equipped badges

**Architecture Foundation**: Repository + ViewModel + View with @Observable and LoadableView patterns established.

## Task Breakdown

### Batch 1: Core UI Components (Parallel - 6-8 hours)

**T1: Rarity/Style Border System**
- **Files**:
  - Create `New-Mystica/New-Mystica/Components/Borders/BorderedCard.swift`
  - Create `New-Mystica/New-Mystica/Models/DisplayBorders.swift`
- **Implementation**:
  - `RarityBorder` enum with color mapping (common=gray, rare=blue, legendary=orange)
  - `StyleBorder` enum for materials (normal=white, pixel_art=pink, holographic=rainbow)
  - `BorderedCard` view modifier that applies appropriate border based on item/material type
- **Success Criteria**:
  - Items show correct rarity-based border colors
  - Materials show correct style-based border colors
  - Reusable across item cards and material cards
- **Estimated Effort**: 2 hours

**T2: Material Card Component**
- **Files**:
  - Create `New-Mystica/New-Mystica/Views/Inventory/MaterialCard.swift`
  - Enhance `New-Mystica/New-Mystica/Models/Inventory.swift` if needed
- **Implementation**:
  - Card layout with material icon, name, quantity badge
  - Style-based border integration from T1
  - Tap gesture for action menu (prepare for T6)
- **Success Criteria**:
  - Materials display with proper styling
  - Quantity badges show stack counts
  - Cards are tappable and responsive
- **Estimated Effort**: 2 hours

**T3: Enhanced Item Card with Equipped Status**
- **Files**:
  - Enhance `New-Mystica/New-Mystica/Views/Inventory/ItemRow.swift`
- **Implementation**:
  - Add equipped status badge with slot name ("Equipped: Weapon")
  - Integrate rarity border from T1
  - Add visual indicator for equipped items (icon overlay)
  - Prepare tap gesture for action menu (T5)
- **Success Criteria**:
  - Items show equipped status when applicable
  - Rarity borders render correctly
  - Equipped items visually distinct from unequipped
- **Estimated Effort**: 2 hours

**T4: Bottom Drawer Selection Component**
- **Files**:
  - Create `New-Mystica/New-Mystica/Components/BottomDrawer/BottomDrawerSheet.swift`
  - Create `New-Mystica/New-Mystica/Components/BottomDrawer/ItemSelectionDrawer.swift`
- **Implementation**:
  - SwiftUI sheet presentation with bottom drawer animation
  - Filter items by target slot type
  - Item selection with confirmation modal
  - Integration point for equipment actions
- **Success Criteria**:
  - Drawer animates from bottom
  - Shows only items matching target slot
  - Selection triggers confirmation flow
- **Estimated Effort**: 2-3 hours

### Batch 2: Action Menus & Integration (Depends on Batch 1 - 4-6 hours)

**T5: Four-Action Item Menu**
- **Files**:
  - Create `New-Mystica/New-Mystica/Components/ActionMenus/ItemActionMenu.swift`
  - Enhance `New-Mystica/New-Mystica/ViewModels/InventoryViewModel.swift`
- **Implementation**:
  - SwiftUI context menu or custom action sheet with four options
  - **Equip**: Trigger bottom drawer (T4) with slot type detection
  - **Craft**: Navigate to crafting screen (placeholder)
  - **Upgrade**: Navigate to upgrade screen (placeholder)
  - **Sell**: Show confirmation modal with gold calculation
- **Success Criteria**:
  - All four actions appear on item tap
  - Equip action opens bottom drawer
  - Navigation actions work (even if destinations are placeholders)
- **Estimated Effort**: 2-3 hours

**T6: Material Action Menu**
- **Files**:
  - Create `New-Mystica/New-Mystica/Components/ActionMenus/MaterialActionMenu.swift`
- **Implementation**:
  - Single "Craft" action on material tap
  - Navigate to crafting screen with material pre-selected
- **Success Criteria**:
  - Material tap shows craft option
  - Navigation to crafting works
- **Estimated Effort**: 1 hour

**T7: All Materials Section Integration**
- **Files**:
  - Enhance `New-Mystica/New-Mystica/Views/Inventory/InventoryView.swift`
  - Enhance `New-Mystica/New-Mystica/ViewModels/InventoryViewModel.swift`
- **Implementation**:
  - Add Materials section below All Items
  - Fetch materials data via existing repository
  - Grid layout with MaterialCard (T2) components
  - Section header with material count
- **Success Criteria**:
  - Materials section appears below items
  - Materials load from API correctly
  - Cards render with proper styling
- **Estimated Effort**: 2 hours

### Batch 3: State Management & Polish (Depends on Batch 2 - 4-6 hours)

**T8: Equipment Action Integration**
- **Files**:
  - Enhance `New-Mystica/New-Mystica/ViewModels/InventoryViewModel.swift`
  - Integration with existing `EquipmentViewModel.swift`
- **Implementation**:
  - Connect bottom drawer selection to equipment API
  - Real-time inventory updates after equipment changes
  - Handle equipment replacement scenarios
  - Update equipped status badges immediately
- **Success Criteria**:
  - Equip action actually equips items
  - Inventory reflects equipment changes
  - No duplicate equipped items
- **Estimated Effort**: 2-3 hours

**T9: Enhanced Filtering & Sorting**
- **Files**:
  - Enhance `New-Mystica/New-Mystica/Views/Inventory/InventoryView.swift`
  - Enhance `New-Mystica/New-Mystica/ViewModels/InventoryViewModel.swift`
- **Implementation**:
  - Expand filter segments beyond All/Styled/Unstyled
  - Add slot type filters (Weapons, Armor, Accessories, Pets)
  - Add sort options (Level, Rarity, Date, Name)
  - Backend API already supports these via query parameters
- **Success Criteria**:
  - Filter by slot type works
  - Sort options change item order
  - Backend pagination maintains filters
- **Estimated Effort**: 2 hours

**T10: Error Handling & Loading States**
- **Files**:
  - Enhance all action menu components
  - Enhance InventoryViewModel error handling
- **Implementation**:
  - Loading spinners during actions (equip, craft navigation)
  - Error alerts for failed operations
  - Success feedback for completed actions
  - Network error recovery
- **Success Criteria**:
  - Users see loading states during actions
  - Errors display helpful messages
  - Success actions provide feedback
- **Estimated Effort**: 1-2 hours

## Integration Points

**Navigation Integration**:
- **Craft Actions** → Navigate to Crafting screen (F-04 integration point)
- **Upgrade Actions** → Navigate to Item Upgrade screen (F-06 integration point)
- **Equip Actions** → Use existing EquipmentViewModel and API

**State Synchronization**:
- **Equipment Changes** → Refresh inventory to update equipped badges
- **Material Usage** → Update material quantities after crafting
- **Item Operations** → Maintain consistent state across views

**API Integration**:
- Use existing `GET /inventory` with pagination/filtering
- Use existing equipment endpoints for equip actions
- All required backend support already implemented

## Technical Architecture

### Component Hierarchy
```
InventoryView (enhanced)
├── Gold Balance Header (existing)
├── Filter Segments (enhanced with slot types)
├── All Items Section
│   ├── LazyVGrid with ItemRow (enhanced)
│   │   ├── BorderedCard (T1) with rarity borders
│   │   ├── Equipped badge overlay (T3)
│   │   └── ItemActionMenu (T5) on tap
│   └── Load More button (existing pagination)
└── All Materials Section (T7)
    ├── Section header with count
    └── LazyVGrid with MaterialCard (T2)
        ├── BorderedCard (T1) with style borders
        └── MaterialActionMenu (T6) on tap
```

### State Management Pattern
```
InventoryViewModel (@Observable)
├── items: Loadable<[EnhancedPlayerItem]> (existing)
├── materials: Loadable<[MaterialStack]> (new)
├── selectedFilter: SlotFilter (enhanced)
├── sortOption: SortOption (new)
└── Action methods:
    ├── equipItem() (integration with EquipmentViewModel)
    ├── navigateToCraft()
    ├── navigateToUpgrade()
    └── sellItem()
```

### Navigation Flow
```
InventoryView
├── Item Tap → ItemActionMenu
│   ├── Equip → BottomDrawerSheet → EquipmentAPI
│   ├── Craft → CraftingView (F-04)
│   ├── Upgrade → UpgradeView (F-06)
│   └── Sell → SellConfirmationModal
└── Material Tap → MaterialActionMenu
    └── Craft → CraftingView with material pre-filled
```

## Risk Mitigation

**Risk: Breaking Existing Inventory Flow**
- **Mitigation**: Maintain existing InventoryView structure, only enhance with new sections
- **Validation**: Existing filter segments and item display must continue working

**Risk: Performance with Large Inventories**
- **Mitigation**: Use existing LazyVGrid and pagination patterns
- **Validation**: Test with 100+ items to ensure smooth scrolling

**Risk: Navigation Stack Complexity**
- **Mitigation**: Use existing NavigationManager patterns from other views
- **Validation**: Ensure proper back navigation from all action destinations

**Risk: State Synchronization Issues**
- **Mitigation**: Use existing @Observable patterns and explicit refresh triggers
- **Validation**: Equipment changes must immediately update inventory state

## Testing Strategy

**Unit Testing**:
- Border color mappings for all rarity/style types
- Action menu state changes
- Filter and sort logic

**Integration Testing**:
- Equipment actions update both equipment and inventory state
- Navigation to craft/upgrade screens works bidirectionally
- Materials section loads correctly from API

**UI Testing**:
- All action menus appear on appropriate taps
- Bottom drawer animates and filters correctly
- Loading states appear during API operations

**Manual Testing**:
- Full user flow: browse inventory → equip item → verify equipment screen
- Material flow: tap material → navigate to crafting
- Error scenarios: network failures, invalid operations

## Rollout Plan

**Phase 1**: Deploy Batch 1 (Core UI Components)
- Border system and enhanced cards
- Visual improvements without functional changes
- Low risk, immediate visual impact

**Phase 2**: Deploy Batch 2 (Action Menus)
- Action menus with navigation placeholders
- Bottom drawer for equipment
- Core functionality without full integration

**Phase 3**: Deploy Batch 3 (Full Integration)
- Complete state synchronization
- Real equipment actions
- Production-ready polish

## Success Criteria

**MVP Complete When**:
- ✅ All Materials section displays with style borders
- ✅ Four-action item menu appears on item tap
- ✅ Equip action uses bottom drawer → confirmation flow
- ✅ Items show equipped badges with slot names
- ✅ Rarity borders distinguish item quality levels
- ✅ Navigation to craft/upgrade screens works

**Post-MVP Enhancements**:
- Advanced filtering by multiple criteria
- Item comparison views during equip actions
- Drag-and-drop equipping
- Optimistic UI updates

## Dependencies

**Required for Completion**:
- F-04 Materials System integration (craft navigation target)
- F-06 Item Upgrade System integration (upgrade navigation target)
- Existing EquipmentViewModel patterns

**API Readiness**: ✅ All backend endpoints implemented and tested

**Architecture Readiness**: ✅ Repository + ViewModel + Loadable patterns established

This plan delivers the missing 30% of F-09's frontend requirements while maintaining architectural consistency and providing a foundation for future enhancements.