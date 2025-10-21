# Implementation Plan – Equipment Display Screen

## Overview
- **Item ID:** F-03 / US-302 / equipment-display
- **Spec:** `docs/feature-specs/F-03-base-items-equipment.yaml`, `docs/feature-specs/F-09-inventory-management.yaml`
- **Requirements:** `docs/plans/implement-equipment-display-requirements.md`
- **Investigations:**
  - `agent-responses/agent_967376.md` (iOS SwiftUI patterns)
  - `agent-responses/agent_167264.md` (Backend service patterns)
  - `agent-responses/agent_805028.md` (Data models & API)
  - `agent-responses/agent_520960.md` (UI layout patterns)
  - `agent-responses/agent_639183.md` (Database schema - backend methods implemented!)

## Problem
User cannot view their equipped items in the game. Equipment data loads from backend but no screen exists to display it.

## Solution
- Create view-only equipment screen in iOS app showing 8 equipment slots
- Fix iOS Equipment model to match backend response structure
- Integrate with existing EquipmentService (already complete)
- Character-centered layout with empty state support

## Current System

**Backend (100% Complete):**
- `mystica-express/src/services/EquipmentService.ts:15-117` - getEquippedItems() fully implemented
- `mystica-express/src/controllers/EquipmentController.ts:34-40` - returns {slots, total_stats, equipment_count}
- Database RPC functions fixed and working (investigation agent completed this)

**Frontend (Missing):**
- EquipmentService.swift exists with loadEquipment() method
- Equipment.swift model exists but has wrong structure (expects player_stats, backend sends total_stats)
- No EquipmentView.swift - screen doesn't exist yet
- Navigation not hooked up (.equipment case missing)

## Changes Required

### 1) `New-Mystica/New-Mystica/Models/Equipment.swift`: Equipment struct
- **Current**: Expects `playerStats: PlayerStats` with nested structure
- **Change**: Update to `totalStats: ItemStats` matching backend response
- **Code Delta**:
```swift
struct Equipment: Codable {
    let slots: EquipmentSlots
    let totalStats: ItemStats       // Changed from playerStats: PlayerStats
    let equipmentCount: Int

    enum CodingKeys: String, CodingKey {
        case slots
        case totalStats = "total_stats"
        case equipmentCount = "equipment_count"
    }
}
```

### 2) `New-Mystica/New-Mystica/NavigationManager.swift`: NavigationDestination enum
- **Current**: No .equipment case
- **Change**: Add `.equipment` case to enum at line 12-21

### 3) `New-Mystica/New-Mystica/ContentView.swift`: destinationView() switch
- **Current**: No EquipmentView case in switch statement
- **Change**: Add case `.equipment: EquipmentView()` at line 28-67

### 4) `New-Mystica/New-Mystica/EquipmentView.swift`: NEW FILE
- **Current**: File doesn't exist
- **Change**: Create full equipment display screen with:
  - NavigableView protocol conformance
  - Character-centered 8-slot layout (VStack/HStack arrangement)
  - EquipmentSlotView component for each slot
  - StatsDisplayView panel for total stats
  - Empty state with slot descriptions from F-03 spec
  - Loading/error state handling
  - Item detail popup on tap
  - SwiftUI preview with environment objects

## Task Breakdown

| ID | Description | Agent | Deps | Files | Exit Criteria |
|----|-------------|-------|------|-------|---------------|
| T1 | Fix Equipment model structure | frontend-ui-developer | — | Equipment.swift | Model parses backend response without errors |
| T2 | Add navigation integration | frontend-ui-developer | — | NavigationManager.swift, ContentView.swift | .equipment case exists, compiles |
| T3 | Create EquipmentSlotView component | frontend-ui-developer | T1 | EquipmentView.swift (new) | Shows equipped item or empty state with icon/description |
| T4 | Create StatsDisplayView component | frontend-ui-developer | T1 | EquipmentView.swift | Displays 4 stats (atk/def power/accuracy) + equipment count |
| T5 | Create main EquipmentView screen | frontend-ui-developer | T2, T3, T4 | EquipmentView.swift | Full screen with 8 slots, stats panel, loading/error states |
| T6 | Add item detail popup | frontend-ui-developer | T5 | EquipmentView.swift | Tapping equipped item shows read-only detail popup |

## Parallelization

### Batch 1 (Parallel - No Dependencies)
- **Tasks:** T1 (model fix), T2 (navigation)
- **Notes:** Independent changes, can run simultaneously
- **Agent:** frontend-ui-developer (launch 2 in parallel)

### Batch 2 (Parallel - After Batch 1)
- **Tasks:** T3 (slot component), T4 (stats component)
- **Notes:** Both need T1 (fixed model) but are independent from each other
- **Agent:** frontend-ui-developer (launch 2 in parallel)

### Batch 3 (Sequential - After Batch 2)
- **Tasks:** T5 (main view), T6 (popup)
- **Notes:** T5 needs T2, T3, T4 completed; T6 needs T5 completed
- **Agent:** frontend-ui-developer (run sequentially)

## Data/Schema Changes
**None** - Backend already complete, database already working

## Implementation Details

### Equipment Slot Layout (T3, T5)
Follow character-centered pattern from `agent-responses/agent_520960.md`:

```
        [head]

[weapon]  [Character]  [offhand]
[accessory_1]  Silhouette  [accessory_2]

    [armor]    [feet]

[pet]
```

### Empty Slot Pattern (T3)
- Border: `Color.borderSubtle`
- Icon: SF Symbol from slot type (e.g., "sword.fill" for weapon)
- Text: Slot description from F-03 spec (e.g., "What you fight with")
- Component: SmallText for description

### Stats Display (T4)
Show 4 stats from `equipment.totalStats`:
- ATK Power (atkPower)
- ATK Accuracy (atkAccuracy)
- DEF Power (defPower)
- DEF Accuracy (defAccuracy)

Plus equipment count: "5/8 Equipped"

### Loading/Error States (T5)
- **Loading:** Check `EquipmentService.shared.isLoading`
- **Error:** Check `EquipmentService.shared.errorMessage`, show PopupView with retry
- **Data:** Check `EquipmentService.shared.equipment`

### Component Reuse
Per `agent-responses/agent_967376.md` and `agent-responses/agent_520960.md`:
- TitleText, NormalText, SmallText for typography
- TextButton for actions
- PopupView for item details and errors
- Color.* palette (accent, accentSecondary, borderSubtle, etc.)
- AudioManager.playMenuButtonClick() for interactions

## Expected Result

**Equipment screen accessible from main menu showing:**
1. 8 equipment slots in character-centered layout
2. Empty slots display SF Symbol icon + description
3. Equipped items show image (or fallback icon if load fails)
4. Total stats panel with 4 stats + equipment count
5. Tapping equipped item shows read-only detail popup
6. Loading state while fetching data
7. Error popup with retry button on network failure
8. Navigation back button returns to main menu
9. SwiftUI preview renders without errors
10. Follows design system (neon cyberpunk colors, Bungee font)

**Concrete example:**
- User navigates to Equipment screen
- Sees weapon slot filled with "Enormous Key" level 5
- Sees offhand slot empty with shield icon and "Shield or second weapon"
- Stats panel shows: ATK Power: 45, ATK Accuracy: 23, DEF Power: 12, DEF Accuracy: 8
- Equipment count shows "3/8 Equipped"
- Tapping "Enormous Key" shows popup with item details (level, stats, materials)

## Notes

- **Backend fully functional** - Investigation agent_639183 implemented equipItem()/unequipItem() methods and fixed database RPC bugs
- **View-only MVP** - Equip/unequip actions deferred to inventory screen implementation
- **No breaking changes** - Backend API unchanged, only iOS model fix needed
- **Design system documented** - All UI patterns in agent_520960.md with code examples
- **Navigation pattern established** - Follow BattleView, MapView, CollectionView pattern

## Next
`/manage-project/implement/execute equipment-display`
