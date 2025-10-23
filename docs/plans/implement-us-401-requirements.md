# Implementation Requirements: US-401 Crafting Materials onto Items

**Document**: `docs/plans/implement-us-401-requirements.md`
**Feature**: F-04 (Materials System)
**Story**: US-401 (Craft Materials onto Items)
**Investigation Completed**: 2025-10-23
**Status**: Ready for Planning & Execution

---

## Executive Summary

US-401 requires implementing a complete **SwiftUI Crafting Screen UI** that allows players to combine materials with items. The backend (95% complete) provides all necessary APIs and image generation. This implementation focuses on the iOS frontend component system.

**Key Facts:**
- ✅ Backend APIs fully implemented and tested
- ✅ Image generation working (20s synchronous MVP0 constraint)
- ✅ Design system tokens available
- ✅ Existing patterns available to reuse (ItemRow, BottomDrawer, navigation)
- 🎯 Scope: ~7 new SwiftUI components + 1 ViewModel + navigation integration

---

## Original Specification

**User Story**: Craft Materials onto Items
**As a**: Mobile RPG Player
**I want**: to craft materials onto my items via a dedicated crafting screen
**So that**: I can customize my equipment stats and appearance

### Acceptance Criteria

1. ✅ Given main menu, when player taps 'Crafting', then open crafting screen with empty item and material slots
2. ✅ Given inventory, when player taps 'Craft' on item, then open crafting screen with item pre-filled in left slot
3. ✅ Given inventory, when player taps 'Craft' on material, then open crafting screen with material pre-filled in right slot
4. ✅ Given crafting screen, when player taps item slot, then show drawer with ALL items (rarity borders, equipped badges)
5. ✅ Given crafting screen, when player taps material slot, then show drawer with materials (style borders, quantities)
6. ✅ Given both slots filled, when displayed, then show stat preview (green=increase, red=decrease) with '?' for final image
7. ✅ Given stat preview, when player taps 'Craft', then consume material (quantity -1), apply to item, generate image (~20s)
8. ✅ Given craft complete, when showing results, then display craft count 'X players have crafted this combo'
9. ✅ Given item has 3 materials, when viewing material drawer, then grey out all materials with warning message
10. ✅ Given craft success, when complete, then show options: 'View Item', 'Return to Crafting', 'Return to Inventory'

---

## Investigation Findings

### 1. Existing SwiftUI Patterns (agent_816254)

**Key Components to Reuse:**

| Component | Location | Purpose | Adaptation Needed |
|-----------|----------|---------|------------------|
| ItemRow | `InventoryView.swift` | Item display with rarity borders | Add to ItemSelectionDrawer |
| MaterialCard | Design system | Material display with style borders | Extend for crafting |
| BottomDrawer | `ItemSelectionDrawer.swift` | Bottom sheet pattern | Replicate for materials |
| ActionMenu | Inventory components | Confirmation dialogs | Reuse for removal cost |
| NavigationManager | App architecture | Screen navigation | Use for crafting entry |

**State Management Pattern:**
- Use `@Observable` class for CraftingViewModel (iOS 17+ pattern)
- Adopt `Loadable<T>` enum for async states (idle, loading, loaded, failed)
- Implement optimistic updates with error recovery

**Navigation Pattern:**
- Use `NavigableView` wrapper
- Implement `NavigationDestination` enum case for crafting
- Pass optional preselected item/material through parameters

---

### 2. Design System Mapping (agent_292442)

**Rarity Colors** (for item slot borders):
```swift
enum RarityColor {
    case common     // Color.borderSubtle (#B0B0B0)
    case uncommon   // Color.blue
    case rare       // Color.orange
    case epic       // Color.accent (#FF1493)
    case legendary  // Color.accentSecondary (#00BFFF)
}
```

**Style Colors** (for material slot borders):
```swift
enum StyleBorderColor {
    case normal       // Color.borderSubtle (#B0B0B0)
    case pixel_art    // Color(hex: "FF69B4") - Pink
    case watercolor   // Color.accentSecondary (#00BFFF") - Blue
    case neon         // Color.accent (#FF1493) - Neon Pink
    case holographic  // Color.accent (Rainbow effect)
}
```

**Typography:**
- Titles: FontManager.title (30pt Bungee-Regular)
- Subtitles: FontManager.subtitle (22pt Bungee-Regular)
- Body: FontManager.body (17pt Bungee-Regular)
- Captions: FontManager.caption (13pt Bungee-Regular)

**Spacing Grid:**
- xs: 4pt, sm: 8pt, md: 16pt, lg: 24pt, xl: 32pt, xxl: 40pt

---

### 3. Backend API Verification (agent_355877)

**Status:** ✅ **Production-Ready**

**Endpoints Implemented:**
- ✅ `GET /materials` - Retrieve all material templates (no auth)
- ✅ `GET /materials/inventory` - Get player's material stacks (Bearer auth)
- ✅ `POST /items/{item_id}/materials/apply` - Apply material to item (Bearer auth)

**Response Contracts:**

```typescript
// GET /materials
{ materials: Material[] }

// GET /materials/inventory
{ materials: MaterialStackDetailed[] }

// POST /items/{item_id}/materials/apply
{
  success: boolean,
  item: PlayerItem,           // Full item with new stats
  stats: Stats,               // computed_stats
  image_url: string,          // R2 URL
  is_first_craft: boolean,    // First time this combo crafted
  total_crafts: number,       // Craft count globally
  materials_consumed: MaterialStack[]
}
```

**Critical Requirements:**
- Image generation: **20s synchronous blocking** (MVP0 constraint)
- Material max per item: **3 slots** (hard limit)
- Material removal cost: **100 gold × item level**
- No rate limiting implemented (consider adding in future)

---

## Component Architecture

### Component Hierarchy

```
CraftingView (Main)
├── NavigableView (wrapper)
├── CraftingContentView
│   ├── ItemSlotSelector
│   ├── MaterialSlotSelector
│   ├── StatPreview
│   └── CraftButton
├── ItemSelectionDrawer (bottom sheet)
├── MaterialSelectionDrawer (bottom sheet)
├── CraftingProgressOverlay (20s generation)
└── CraftResultsView (success screen)
```

### ViewModel Architecture

**CraftingViewModel** - Single source of truth:
```swift
@Observable
class CraftingViewModel {
    // Selection State
    var selectedItem: EnhancedPlayerItem?
    var selectedMaterial: MaterialInventoryStack?
    var craftingState: CraftingState = .selecting

    // Data Loading
    var availableItems: Loadable<[EnhancedPlayerItem]>
    var availableMaterials: Loadable<[MaterialInventoryStack]>

    // Preview Calculations
    var baseStats: ItemStats?
    var previewStats: ItemStats?

    // Crafting Progress (20s generation)
    var craftingProgress: Double = 0.0
    var isProcessing: Bool = false
    var progressMessage: String = ""

    // Results
    var craftedItem: EnhancedPlayerItem?
    var craftCount: Int = 0
    var isFirstCraft: Bool = false
}

enum CraftingState {
    case selecting           // Empty or partial slots
    case previewing          // Both filled, showing preview
    case crafting            // 20s generation in progress
    case results             // Success screen
    case error(AppError)     // Error with retry
}
```

### Repository Dependencies

**Reuse existing repositories:**
- `InventoryRepository` - Load items, apply material
- `MaterialsRepository` - Load material inventory
- Do NOT create new repositories

---

## Navigation Integration

### Entry Points

**From MainMenuView** (new button):
```swift
MenuOptionView(
    title: "Crafting",
    icon: "hammer.fill",
    gradientColors: [.accent, .accentInteractive]
) {
    navigationManager.navigateTo(.crafting)
}
```

**From InventoryView** (existing "Craft" action):
- Craft on item → CraftingView with item pre-selected
- Craft on material → CraftingView with material pre-selected

### Navigation Destination

Add case to `NavigationDestination` enum:
```swift
case crafting(
    preselectedItem: EnhancedPlayerItem? = nil,
    preselectedMaterial: MaterialInventoryStack? = nil
)
```

### Exit Paths
- Back button → Previous view
- "View Item" → Item detail / Inventory
- "Return to Crafting" → Reset state
- "Return to Inventory" → InventoryView

---

## Technical Constraints & Decisions

### MVP0 Constraints (Hard Limits)
- ❌ No preview images during selection (only "?" placeholder)
- ❌ 20s synchronous image generation (blocks UI completely)
- ❌ Max 3 materials per item (enforced by backend)
- ❌ Style selection deferred (normal style only)

### Performance Considerations
- **Item Loading**: Use pagination from InventoryViewModel (may have 1000+ items)
- **Material Loading**: Load all stacks at once (typically <100 items)
- **Image Display**: AsyncImage with SF Symbol placeholders
- **20s Generation**: Show progress overlay with countdown

### Error Handling
```swift
enum CraftingError: AppError {
    case maxMaterialsReached      // 400
    case materialNotOwned         // 400
    case generationInProgress     // 423
    case itemNotFound            // 404
    case networkTimeout          // Connection
}
```

### Validation Before API Call
- Item selected ✓
- Material selected ✓
- Item has < 3 materials ✓
- Material quantity > 0 ✓
- Material not already applied ✓

---

## Success Criteria

### Definition of Done
1. ✅ All 10 acceptance criteria passing
2. ✅ CraftingView displays correctly with both entry points
3. ✅ Item/material selection drawers functional with filtering
4. ✅ Stat preview shows accurate calculations (green/red coding)
5. ✅ 20s progress overlay shows during generation
6. ✅ Results screen displays craft count and "is_first_craft" badge
7. ✅ Error states handled gracefully with retry options
8. ✅ Navigation back/forward works correctly
9. ✅ Memory/performance acceptable (no memory leaks)
10. ✅ Code follows existing patterns and style guide

### Testing Scope
- Unit tests for CraftingViewModel logic
- Integration tests for API calls
- UI tests for navigation and state transitions
- Manual testing on iOS 17+ simulator

---

## File Locations & References

### Files to Create
```
New-Mystica/New-Mystica/Views/Crafting/
├── CraftingView.swift                    (main container)
├── CraftingContentView.swift             (layout)
├── ItemSlotSelector.swift                (left slot)
├── MaterialSlotSelector.swift            (right slot)
├── StatPreview.swift                     (comparison display)
├── CraftButton.swift                     (action button)
├── ItemSelectionDrawer.swift             (bottom sheet)
├── MaterialSelectionDrawer.swift         (bottom sheet)
├── CraftingProgressOverlay.swift         (20s progress)
└── CraftResultsView.swift                (success screen)

New-Mystica/New-Mystica/ViewModels/
└── CraftingViewModel.swift               (state management)
```

### Files to Modify
```
New-Mystica/New-Mystica/
├── Navigation/NavigationDestination.swift (add crafting case)
├── Views/MainMenuView.swift              (add Crafting button)
└── Views/Inventory/InventoryView.swift   (add Craft actions)
```

### Reference Files (Do NOT modify)
- `New-Mystica/New-Mystica/Views/Inventory/InventoryView.swift` - ItemRow patterns
- `New-Mystica/New-Mystica/Components/BottomDrawer/` - Drawer patterns
- `New-Mystica/New-Mystica/Managers/NavigationManager.swift` - Navigation patterns
- `docs/design-spec.yaml` - Design tokens
- `docs/api-contracts.yaml` - API contracts

---

## Known Dependencies & Gotchas

### Backend Dependencies
- All endpoints fully implemented ✓
- Image generation service ready ✓
- Database schema complete ✓

### Frontend Dependencies
- ItemRow component pattern from InventoryView ✓
- BottomDrawer implementation available ✓
- NavigationManager for routing ✓
- Design tokens in Colors.swift & FontManager.swift ✓

### Potential Pitfalls
1. **20s Timeout**: Must show progress overlay. Use `Task.sleep()` to simulate if generation takes longer
2. **Memory Leaks**: Clean up Loadable state bindings in onDisappear
3. **Navigation**: Ensure preselected item/material passes through correctly
4. **Stats Calculation**: Verify stat modifiers sum to zero (zero-sum constraint)
5. **Max Materials**: Grey out materials and show message when item.appliedMaterials.count >= 3

---

## Investigation Summary

| Investigation Area | Status | Key Findings |
|--------------------|--------|--------------|
| SwiftUI Patterns | ✅ Complete | ItemRow, BottomDrawer, @Observable patterns available |
| Design System | ✅ Complete | Colors, typography, spacing tokens defined |
| Backend APIs | ✅ Complete | All endpoints implemented, production-ready |
| Navigation | ✅ Complete | NavigationManager pattern established |
| Repositories | ✅ Complete | InventoryRepository + MaterialsRepository ready |
| Error Handling | ✅ Complete | AppError pattern defined in codebase |
| State Management | ✅ Complete | @Observable + Loadable patterns established |

---

## Next Steps

### Phase 2: Planning
- Create detailed task breakdown with dependencies
- Define UI mockups/wireframes for each component
- Document ViewModel methods and state transitions
- Identify reusable component extractions

### Phase 3: Execution
- Implement CraftingViewModel with Loadable states
- Implement slot selector components
- Implement stat preview with color coding
- Implement selection drawers with filtering
- Implement progress overlay and results screen
- Integrate navigation entry points
- Add error handling and edge cases

### Phase 4: Validation
- Test all 10 acceptance criteria
- Verify navigation flows
- Test error scenarios
- Performance profiling
- Manual QA on device

---

## Investigation Artifacts

All investigation findings documented in:
- `agent-responses/agent_816254.md` - SwiftUI patterns analysis
- `agent-responses/agent_292442.md` - Design system & architecture
- `agent-responses/agent_355877.md` - Backend API verification
