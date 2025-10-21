# Implementation Requirements – Equipment Display on Equipment Screen

## Source Specification
- **Item ID:** F-03 / US-302 / GET /equipment
- **Spec:** `docs/feature-specs/F-03-base-items-equipment.yaml`, `docs/feature-specs/F-09-inventory-management.yaml`
- **Status:** requirements-complete

> All functional requirements, user value, and technical specs are defined in the source YAML.
> This doc captures **investigation findings** and **implementation-specific requirements**.

## User Request
"Let's work on having the equipment that loads on the player show up on the equipment screen in the game"

## Investigation Findings

### Existing Patterns

**iOS SwiftUI Patterns:**
- NavigableView protocol at `New-Mystica/New-Mystica/NavigationManager.swift:12-21` – all new views must add case to NavigationDestination enum
- BaseView wrapper at `New-Mystica/New-Mystica/BaseView.swift` – provides consistent title/back button styling
- Service integration pattern at `New-Mystica/New-Mystica/Services/EquipmentService.swift:46-82` – uses `@Published` properties for loading/error states
- Empty state pattern at `New-Mystica/New-Mystica/CollectionView.swift:20-28` – shows placeholder when no data
- Component library at `New-Mystica/New-Mystica/UI/Components/` – TextButton, PopupView, TitleText, NormalText, SmallText

**Backend Service Patterns:**
- EquipmentService.getEquippedItems() **ALREADY IMPLEMENTED** at `mystica-express/src/services/EquipmentService.ts:15-117` – complex joins working
- Error handling pattern at `mystica-express/src/utils/errors.ts:47-54` – uses mapSupabaseError() and custom AppError classes
- Stat calculation formula: `base_stats × level × 10` (MVP0 simplified)
- Response transformation at `mystica-express/src/controllers/EquipmentController.ts:34-40` – adds equipment_count field

### Integration Points Discovered
- **EquipmentService (iOS) → GET /equipment (Backend)** at `New-Mystica/New-Mystica/Services/EquipmentService.swift:62` – authenticated request with Bearer token from keychain
- **NavigationManager singleton** at `New-Mystica/New-Mystica/New_MysticaApp.swift:31-32` – injected as environment object
- **UserEquipment table** at `migrations/001_initial_schema.sql:200-220` – composite PK (user_id, slot_name), joins to Items and ItemTypes
- **AudioManager** at `New-Mystica/New-Mystica/AudioManager.swift` – playMenuButtonClick() for interactions

### Constraints & Dependencies
- **SwiftUI requirement:** All previews need `.modelContainer(for: Item.self, inMemory: true).environmentObject(NavigationManager())`
- **Design system constraint:** Must use Color.* palette (neon cyberpunk theme), never raw colors
- **Typography constraint:** Must use TitleText/NormalText/SmallText components, never raw Text()
- **Navigation constraint:** Must add case to NavigationDestination enum AND ContentView switch
- **Authentication:** Backend requires valid JWT token in Authorization header
- **8 equipment slots hardcoded:** weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet (never change count)

## Critical Issues Requiring Resolution

### 1. iOS Equipment Model Mismatch
**Problem:** iOS Equipment.swift expects `playerStats: PlayerStats` but backend sends `total_stats: Stats`

**Evidence:**
- iOS model at `New-Mystica/New-Mystica/Models/Equipment.swift:46` expects `player_stats` wrapper
- Backend response at `mystica-express/src/controllers/EquipmentController.ts:34-40` sends flat `total_stats`
- Investigation finding at `agent-responses/equipment-models-analysis.md:12-38`

**Resolution:** Update iOS Equipment model to match backend response structure:
```swift
struct Equipment: Codable {
    let slots: EquipmentSlots
    let totalStats: ItemStats       // Changed from playerStats
    let equipmentCount: Int

    enum CodingKeys: String, CodingKey {
        case slots
        case totalStats = "total_stats"
        case equipmentCount = "equipment_count"
    }
}
```

### 2. Database RPC Function Bug
**Problem:** `equip_item()` RPC function at `migrations/003_atomic_transaction_rpcs.sql:667` references non-existent `category` column in EquipmentSlots table

**Evidence:**
- Investigation finding at `agent-responses/agent_639183.md:47-55`
- EquipmentSlots table at `migrations/001_initial_schema.sql:193-199` only has slot_name, display_name, sort_order, description
- ItemTypes table has category column, not EquipmentSlots

**Impact:** Equipment equip/unequip operations may fail with SQL errors

**Resolution:** NOT IN SCOPE for this phase (view-only implementation), but documented for future work

### 3. API Contract Documentation Gap
**Problem:** `docs/api-contracts.yaml:1124-1158` missing equipment_count field and shows incorrect response structure

**Resolution:** NOT IN SCOPE for this phase, but documented for future fix

## Edge Cases & Error Handling

### Empty Equipment Slots
- **Behavior:** Show slot placeholder with slot description from F-03 spec
- **Pattern:** Follow CollectionView.swift:20-28 empty state pattern
- **UI:** Use `Color.borderSubtle` for empty slot borders, SF Symbol icon for slot type
- **Descriptions:** Use F-03 spec lines 67-75 (e.g., "What you fight with" for weapon slot)

### Network Errors
- **Approach:** EquipmentService already has `@Published var errorMessage: String?` at line 41
- **Pattern:** Show PopupView with error message and retry button
- **Reference:** PopupComponents.swift popup pattern

### Loading States
- **Pattern:** Check `EquipmentService.isLoading` boolean at line 40
- **UI:** Show loading overlay or skeleton slots during fetch
- **Reference:** AsyncImage loading pattern at UI investigation findings

### No Authentication Token
- **Error:** EquipmentError.noAuthToken thrown at EquipmentService.swift:55
- **Handling:** Should never happen (user must be authenticated to reach equipment screen), but show error popup if occurs

## Implementation-Specific Decisions

### Technology Choice: View-Only Equipment Screen
**Decision:** MVP scope excludes equip/unequip actions from equipment screen
**Reasoning:**
- Backend equipItem()/unequipItem() methods throw NotImplementedError (investigation finding)
- F-09 spec separates equipment viewing (US-302) from inventory management (US-301)
- Reduces scope to single-screen display implementation
- Equip/unequip can be added in future iteration from inventory screen

### Pattern to Follow: Character-Centered Layout
**Decision:** Custom arranged VStack/HStack layout (not LazyVGrid)
**Pattern reference:** UI investigation findings recommend character-centered layout
**Reasoning:**
- 8 equipment slots have logical groupings (left side: weapon/accessory_1, right side: offhand/accessory_2)
- CollectionView's 3-column grid is for large item collections, not fixed 8-slot layout
- F-03 spec describes slot purposes that benefit from spatial arrangement
- Design system supports custom layouts with established spacing/colors

### Stats Display Approach
**Decision:** Show total stats + equipment count, NOT vanity level or per-item contributions
**Reasoning:**
- Backend response includes `total_stats` and `equipment_count` fields
- `vanity_level` and `avg_item_level` are User table properties (from /profile endpoint)
- Equipment endpoint focused on equipment-specific data
- Simplified MVP scope

### Navigation Integration
**Decision:** Add new `.equipment` case to NavigationDestination enum
**Reasoning:**
- CollectionView is for item collection browsing, not equipment display
- Separate concerns: collection = all items, equipment = currently equipped
- Follows established pattern for BattleView, MapView, etc.

## Implementation Scope

**In this phase:**
- Fix iOS Equipment model to match backend response structure (Equipment.swift)
- Create EquipmentView.swift with NavigableView protocol
- Add `.equipment` case to NavigationDestination enum (NavigationManager.swift:12-21)
- Add EquipmentView case to ContentView.destinationView() switch (ContentView.swift:28-67)
- Implement 8-slot equipment display layout with character-centered arrangement
- Show empty state for unequipped slots with slot descriptions from F-03
- Display total stats panel with atkPower, atkAccuracy, defPower, defAccuracy
- Show equipment count (X/8 equipped)
- Handle loading/error states using EquipmentService.isLoading and errorMessage
- Add item detail popup when tapping equipped item (read-only view)
- Implement async data loading on view appear using EquipmentService.loadEquipment()
- Add SwiftUI preview with required environment objects

**Deferred:**
- Equip/unequip actions from equipment screen (requires backend implementation)
- Vanity level / avg item level display (User profile properties, not equipment endpoint)
- Item-by-item stat contributions (backend doesn't provide this data)
- Database RPC function bug fix (not needed for view-only implementation)
- API contract documentation update (separate documentation task)

## Success Criteria (beyond spec acceptance criteria)

- [ ] Equipment screen loads successfully when user has 0-8 equipped items
- [ ] Empty slots show appropriate slot descriptions and icons
- [ ] Equipped items display with correct images (or fallback to SF Symbol if image fails)
- [ ] Total stats calculate correctly by summing all equipped item stats
- [ ] Equipment count shows "X/8 Equipped" accurately
- [ ] Error handling works for network failures (retry button shown)
- [ ] Loading state shows while fetching equipment data
- [ ] Tapping equipped item shows detail popup (read-only)
- [ ] Navigation back button returns to main menu
- [ ] SwiftUI preview renders without errors
- [ ] Follows design system (neon cyberpunk colors, Bungee font, component library)
- [ ] No console errors or warnings during normal operation

## Relevant Files

### Frontend (iOS)
- `New-Mystica/New-Mystica/EquipmentView.swift` – NEW FILE to create
- `New-Mystica/New-Mystica/Models/Equipment.swift:44-54` – NEEDS FIX for model structure
- `New-Mystica/New-Mystica/Services/EquipmentService.swift` – service already complete
- `New-Mystica/New-Mystica/NavigationManager.swift:12-21` – add .equipment case
- `New-Mystica/New-Mystica/ContentView.swift:28-67` – add EquipmentView case
- `New-Mystica/New-Mystica/UI/Components/TextComponents.swift` – TitleText, NormalText, SmallText
- `New-Mystica/New-Mystica/UI/Components/PopupComponents.swift` – ItemDetailPopup pattern
- `New-Mystica/New-Mystica/UI/Colors/Colors.swift` – color palette

### Backend (Reference)
- `mystica-express/src/services/EquipmentService.ts:15-117` – getEquippedItems() implementation (already done)
- `mystica-express/src/controllers/EquipmentController.ts:34-40` – response structure
- `docs/api-contracts.yaml:1111-1158` – GET /equipment API spec (needs documentation fix later)

### Database (Reference)
- `migrations/001_initial_schema.sql:200-220` – UserEquipment table structure
- `migrations/003_atomic_transaction_rpcs.sql:667` – equip_item() RPC function (has bug, not used in this phase)

### Documentation
- `docs/feature-specs/F-03-base-items-equipment.yaml:66-75` – slot descriptions
- `docs/feature-specs/F-09-inventory-management.yaml:80-83` – equipment endpoint response spec
- `agent-responses/agent_967376.md` – iOS SwiftUI patterns investigation
- `agent-responses/agent_520960.md` – UI layout patterns investigation
- `agent-responses/equipment-models-analysis.md` – data model integration analysis
- `agent-responses/backend-service-patterns-analysis.md` – backend implementation patterns

## Investigation Artifacts Referenced
- **iOS Patterns:** agent-responses/agent_967376.md
- **Backend Patterns:** agent-responses/agent_167264.md
- **Data Models:** agent-responses/agent_805028.md
- **UI Layout:** agent-responses/agent_520960.md
- **Database Schema:** agent-responses/agent_639183.md
