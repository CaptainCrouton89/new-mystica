# Requirements: Combat Level Selection

## Overview
**Purpose:** Enable players to choose combat difficulty (levels 1-10) before engaging enemies at locations

**User Benefit:** Players can control challenge level and access appropriate rewards for their skill/equipment level

**Problem:** Frontend currently hardcodes all battles to level 1, despite backend supporting levels 1-20. Players cannot access higher-difficulty combat or corresponding rewards. Database has loot pools for levels 1-10 only, making levels 11-20 unusable until loot pools are created.

**Related Documentation:**
- `docs/product-requirements.yaml` - Combat system goals
- `docs/user-flows/combat-mechanics.yaml:76-96` - Location Selection & Pre-Combat Flow
- `docs/feature-specs/F-02-combat-system.yaml` - Combat system technical spec (lines 92-95 document level selection flow)
- `docs/api-contracts.yaml` - POST /combat/start endpoint
- `docs/data-plan.yaml:669-684` - EnemyPools structure
- Investigation results: `agent-responses/agent_017840.md`, `agent-responses/agent_406346.md`, `agent-responses/agent_994317.md`, `agent-responses/agent_896449.md`

### Edge Cases
- **Empty state:** No pools for level 11-20 (block these levels with UI message)
- **Error state:** If backend rejects selected level, show error and reset to level 1
- **Loading state:** Show loading indicator while fetching enemy pool for selected level
- **Level validation:** Constrain selection to levels 1-10 (loot pool limitation)

## Design Notes

**Visual Style:**
- Matches existing modal pattern (MapView location popup: dark card, neon accents, blur overlay)
- Grid layout: 2 rows x 5 columns (levels 1-5 top row, 6-10 bottom row)
- Recommended level: neon pink border + subtle glow effect
- Non-recommended levels: dark background (#2F2F2F), subtle gray border
- Fast interaction: tap level → instant battle start (no extra confirmation)

**Flavor Text Examples (Placeholder):**
- "Time to prove yourself!"
- "Choose your challenge wisely..."
- "How brave are you feeling?"
- "Pick your poison!"
- (Final text TBD, just needs personality)

**Recommended Level Calculation:**
- Use player's vanity level (sum of equipped item levels / 8 slots)
- Clamp to 1-10 range (max available level)
- Round to nearest integer
- Fallback to level 1 if no equipped items

## Functional Requirements

### User Interactions
1. Player taps location marker on map
2. If close enough: location modal shows with "Start Battle" button
3. Player taps "Start Battle" button
4. **NEW:** Level selection modal appears (overlay with grid of level buttons 1-10)
5. Player sees recommended level pre-highlighted (= vanity level, clamped to 1-10)
6. Player taps desired level button → IMMEDIATELY starts combat (no confirm step)
7. Backend randomly selects enemy from level-appropriate pool
8. Battle screen launches with selected enemy

**Alternative:** Player taps X or outside modal → closes and returns to map

### Data Requirements
- **Fields:**
  - `selectedLevel: Int` (1-10, required, passed to backend)
  - `locationId: UUID` (from map selection, required)
- **Validation:**
  - Level must be integer 1-10 (enforce with UI constraints)
  - Location must exist and be within proximity
- **Relationships:**
  - Selected level determines which EnemyPool is queried
  - Location type affects which pools are available (universal + location-specific)

### API Requirements
**Existing endpoint (no changes needed):**
- **Endpoint:** `POST /combat/start`
- **Request:** `{ location_id: UUID, selected_level: Int }`
- **Response:** `{ session_id, enemy: {...}, player_stats: {...} }`
- **Errors:**
  - 404: Location not found or no enemy pools at selected level
  - 400: Invalid selected_level (out of 1-10 range)
  - 401: Unauthorized

**Backend already implemented** (mystica-express/src/services/CombatService.ts:245-316)

### UI Requirements
**New Screen: CombatLevelSelectionView (Modal Overlay)**
- **Layout:**
  - Semi-transparent dark overlay (blur background, dismissible by tapping outside)
  - Centered modal card (similar to location popup style)
  - Title: "Select Combat Level" (TitleText component)
  - Flavor text subtitle: "[Placeholder fun text]" (NormalText, secondary color)
  - Recommended level indicator: "Recommended for your gear: {vanityLevel}" (small text, neon pink)
  - Grid of level buttons (2 rows x 5 columns for levels 1-10)
    - Each button: 60x60pt, rounded square, shows level number
    - Recommended level: highlighted with neon pink border/glow
    - Other levels: standard dark background with subtle border
  - X close button (top-right corner of modal, 40x40pt IconButton)
- **Interaction:**
  - Tapping any level button IMMEDIATELY starts combat (no confirm step)
  - Tapping X or outside modal closes and returns to map
  - Haptic feedback on level tap
  - Audio feedback via AudioManager.playMenuButtonClick()
- **States:**
  - Default: Recommended level pre-highlighted (not selected)
  - Hover/Press: Level button scales to 0.95, brightens
  - Loading: Brief spinner after level tap, then transition to battle
  - Error: Alert modal if backend rejects level (rare)
- **Accessibility:**
  - VoiceOver: "Level {N}, {recommended/not recommended}"
  - Dynamic Type support for level numbers
  - Tap targets: 60x60pt buttons exceed 44pt minimum
- **Responsive:**
  - Portrait mode (matches rest of app)
  - Modal adapts to safe area insets
  - Grid layout: 2 rows x 5 columns fits all screen sizes

**Modified Flow:**
- MapView.swift:152-245 location popup "Start Battle" button shows CombatLevelSelectionView modal
- CombatLevelSelectionView level tap navigates to BattleView with selectedLevel parameter

## Technical Requirements

### Performance
- Level selection UI render: < 100ms
- Backend enemy pool query: < 500ms (already performant)
- Screen transition animations: 300ms standard SwiftUI

### Security
- Authentication: Existing JWT validation on POST /combat/start
- Authorization: User can only start combat for their own account
- Data protection: selectedLevel validated on backend (schema enforces 1-20, but UI limits 1-10)
- Rate limiting: Existing combat endpoint throttle applies

### Integration Points
1. **MapView → CombatLevelSelectionView**: Pass locationId, navigate on "Start" tap
2. **CombatLevelSelectionView → BattleView**: Pass locationId + selectedLevel, navigate on "Confirm"
3. **BattleView → CombatViewModel**: Pass selectedLevel to initializeOrResumeCombat()
4. **CombatViewModel → DefaultCombatRepository**: Pass selectedLevel to initiateCombat()
5. **DefaultCombatRepository → Backend**: POST /combat/start with selectedLevel

## Implementation Notes

**Existing patterns:**
- Navigation: Use NavigationManager.swift environmentObject (same pattern as MapView:238)
- SwiftUI lists: Follow pattern in inventory views (New-Mystica/New-Mystica/Views/Inventory/)
- Loading states: Use LoadingManager.swift pattern (New-Mystica/New-Mystica/Managers/LoadingManager.swift)

**Technology choices:**
- SwiftUI List with ForEach for level selection
- @State for selectedLevel tracking
- NavigationLink for screen transitions (or NavigationManager programmatic navigation)

**Error handling:**
- Backend 404 (no pools): Show alert "No enemies available at this level. Try a different level." → return to level selection modal
- Backend 400 (invalid level): Should never occur (UI constrains to 1-10), but show generic error alert → return to map
- Network timeout: Show retry dialog with "Try Again" (re-attempt with same level) and "Cancel" (return to map) options

**Key code locations:**
- New-Mystica/New-Mystica/MapView.swift:152-245 - Location popup "Start" button handler
- New-Mystica/New-Mystica/Views/Battle/BattleView.swift:95 - Constructor accepts selectedLevel
- New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift:45 - initializeOrResumeCombat parameter
- New-Mystica/New-Mystica/Repositories/Implementations/DefaultCombatRepository.swift:20 - initiateCombat already passes level
- mystica-express/src/services/CombatService.ts:245-316 - startCombat backend logic
- mystica-express/src/repositories/LocationRepository.ts:127-140 - getMatchingEnemyPools filters by combat_level

## Out of Scope
- Level unlocking/progression system (all levels 1-10 available immediately)
- Enemy preview before selection (random selection per docs/user-flows/combat-mechanics.yaml:95)
- Level persistence (always reset to default level 1)
- Creating loot pools for levels 11-20 (separate ticket required before expanding to level 20)
- Difficulty labels (Easy/Medium/Hard) - just show numeric levels
- Recommended level based on player stats
- Location-specific level restrictions

## Success Criteria
- [ ] Player can select levels 1-10 via grid button interface
- [ ] Tapping level button immediately starts combat (no extra confirmation)
- [ ] Recommended level (= vanity level) is pre-highlighted with neon pink border
- [ ] Level selection modal appears as overlay after "Start Battle" tap
- [ ] X button and tap-outside-modal both close and return to map
- [ ] Selected level is passed to backend and determines enemy pool
- [ ] Levels 11-20 are not shown (loot pool limitation)
- [ ] UI matches existing modal style (blur overlay, dark card, neon accents)
- [ ] Fast interaction flow: location tap → Start Battle → pick level → instant combat start
- [ ] Accessibility: VoiceOver labels, 60x60pt tap targets, haptic/audio feedback

## Relevant Files

**Frontend (SwiftUI):**
- New-Mystica/New-Mystica/MapView.swift (location popup, navigation to level selection)
- New-Mystica/New-Mystica/Views/Battle/BattleView.swift (accept selectedLevel parameter)
- New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift (pass selectedLevel through)
- New-Mystica/New-Mystica/Repositories/Implementations/DefaultCombatRepository.swift (already supports selectedLevel)
- New-Mystica/New-Mystica/Managers/NavigationManager.swift (navigation state management)
- New-Mystica/New-Mystica/Managers/LoadingManager.swift (loading state patterns)

**Backend (Express/TypeScript):**
- mystica-express/src/routes/combat.ts (POST /combat/start route)
- mystica-express/src/controllers/CombatController.ts (request validation)
- mystica-express/src/services/CombatService.ts (startCombat with selectedLevel)
- mystica-express/src/services/LocationService.ts (getMatchingEnemyPools)
- mystica-express/src/repositories/LocationRepository.ts (pool queries)
- mystica-express/src/types/schemas.ts (StartCombatSchema validation)

**Documentation:**
- docs/feature-specs/F-02-combat-system.yaml (combat system spec)
- docs/user-flows/combat-mechanics.yaml (user flow documentation)
- docs/data-plan.yaml (EnemyPools and LootPools schema)

**Database:**
- Supabase tables: enemypools, lootpools (queried by combat_level column)

**New Files to Create:**
- New-Mystica/New-Mystica/Views/Combat/CombatLevelSelectionView.swift (new screen)
