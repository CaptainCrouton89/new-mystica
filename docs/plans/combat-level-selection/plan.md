# Implementation Plan: Combat Level Selection

**Feature:** Combat level selection (1-10) before battle start
**Requirements:** [requirements.md](requirements.md)
**Complexity:** Moderate (6 tasks, 2 batches)
**Estimated Effort:** 4-6 hours

## Investigation Summary

Based on investigation findings (agent_017840, agent_406346, agent_994317, agent_896449):

- **Backend fully implemented**: `POST /combat/start` accepts `selected_level` (1-20), validated in schema (mystica-express/src/types/schemas.ts)
- **Frontend hardcoded to level 1**: All calls to `initializeOrResumeCombat()` default to level 1 (New-Mystica/New-Mystica/Views/Battle/BattleView.swift:192)
- **Pool system operational**: LocationRepository filters enemypools/lootpools by exact `combat_level` match (mystica-express/src/repositories/LocationRepository.ts:127-140)
- **Critical constraint**: Loot pools only exist for levels 1-10 (agent_896449:26-27), making levels 11-20 unusable
- **UI pattern**: MapView shows location popup → "Start Battle" button (MapView.swift:152-245)

## Task Breakdown

### Batch 1: Core UI Components (Parallel - No Dependencies)

#### T1: Create CombatLevelSelectionView
**File:** `New-Mystica/New-Mystica/Views/Combat/CombatLevelSelectionView.swift`

**Goal:** New SwiftUI modal for level selection with grid layout

**Requirements:**
- Semi-transparent dark overlay (blur background, dismissible by tap-outside)
- Modal card matching existing location popup style (dark background, neon accents)
- Title: "Select Combat Level" (TitleText component)
- Placeholder flavor text subtitle (NormalText, secondary color)
- Recommended level indicator: "Recommended for your gear: {vanityLevel}" (small text, neon pink)
- Grid of level buttons: 2 rows × 5 columns (levels 1-10)
  - Each button: 60×60pt rounded square, shows level number
  - Recommended level: neon pink border + subtle glow
  - Other levels: dark background (#2F2F2F), subtle gray border
- X close button (top-right, 40×40pt IconButton)

**Interaction:**
- Tapping any level button IMMEDIATELY starts combat (no confirmation)
- Tapping X or outside modal → close and return to map
- Haptic feedback on level tap (via HapticManager)
- Audio feedback: `AudioManager.playMenuButtonClick()`

**States:**
- Default: Recommended level pre-highlighted (not selected)
- Hover/Press: Level button scales to 0.95, brightens
- Loading: Brief activity indicator after level tap, then transition to battle
- Error: Alert modal if backend rejects level (rare edge case)

**Accessibility:**
- VoiceOver labels: "Level {N}, {recommended/not recommended}"
- Dynamic Type support for level numbers
- Tap targets: 60×60pt exceeds 44pt minimum

**Implementation Pattern:**
```swift
struct CombatLevelSelectionView: View {
    @EnvironmentObject var navigationManager: NavigationManager
    @EnvironmentObject var audioManager: AudioManager
    @EnvironmentObject var hapticManager: HapticManager
    @State private var isLoading = false

    let locationId: UUID
    let recommendedLevel: Int // From vanity level calculation
    let onDismiss: () -> Void

    var body: some View {
        // Overlay → Modal Card → Grid Layout
    }
}
```

**Success Criteria:**
- [ ] Modal renders with blur overlay and dark card style
- [ ] Grid shows 10 level buttons (2×5 layout)
- [ ] Recommended level highlighted with neon pink border
- [ ] Tapping level button starts combat immediately
- [ ] X button and tap-outside both dismiss modal
- [ ] VoiceOver announces level labels correctly
- [ ] Haptic/audio feedback works on tap

**References:**
- agent_017840:18-24 (MapView location popup pattern)
- Requirements:84-113 (UI specification)

---

#### T2: Add VanityLevelCalculator utility
**File:** `New-Mystica/New-Mystica/Utilities/VanityLevelCalculator.swift`

**Goal:** Pure function to calculate recommended combat level from equipped items

**Requirements:**
- Input: Array of equipped PlayerItems (8 slots)
- Output: Int (1-10 range, clamped)
- Logic: Sum all equipped item levels → divide by 8 → round to nearest integer → clamp to 1-10

**Implementation Pattern:**
```swift
struct VanityLevelCalculator {
    static func calculateRecommendedLevel(equippedItems: [PlayerItem]) -> Int {
        let totalLevels = equippedItems.reduce(0) { $0 + $1.level }
        let averageLevel = Double(totalLevels) / 8.0
        let rounded = Int(round(averageLevel))
        return max(1, min(10, rounded)) // Clamp to 1-10
    }
}
```

**Success Criteria:**
- [ ] Calculates average item level correctly
- [ ] Rounds to nearest integer
- [ ] Clamps to 1-10 range

**References:**
- Requirements:40-44 (recommended level calculation)

---

### Batch 2: Integration (Sequential - Depends on Batch 1)

#### T3: Update MapView to show CombatLevelSelectionView
**File:** `New-Mystica/New-Mystica/MapView.swift`

**Goal:** Replace direct "Start Battle" navigation with level selection modal

**Changes:**
1. Import `VanityLevelCalculator`
2. Add state variable: `@State private var showLevelSelection = false`
3. Add state variable: `@State private var selectedLocationForCombat: UUID?`
4. Modify "Start Battle" button handler (line ~238):
   - Set `selectedLocationForCombat = selectedLocation.id`
   - Set `showLevelSelection = true`
   - Do NOT navigate to BattleView directly
5. Add `.sheet(isPresented: $showLevelSelection)` modifier presenting `CombatLevelSelectionView`
6. Pass recommended level calculated from equipped items:
   ```swift
   let recommendedLevel = VanityLevelCalculator.calculateRecommendedLevel(
       equippedItems: itemViewModel.equippedItems.compactMap { $0 }
   )
   ```

**Implementation Pattern:**
```swift
// Inside MapView body
.sheet(isPresented: $showLevelSelection) {
    if let locationId = selectedLocationForCombat {
        let recommendedLevel = VanityLevelCalculator.calculateRecommendedLevel(
            equippedItems: itemViewModel.equippedItems.compactMap { $0 }
        )

        CombatLevelSelectionView(
            locationId: locationId,
            recommendedLevel: recommendedLevel,
            onDismiss: {
                showLevelSelection = false
                selectedLocationForCombat = nil
            },
            onLevelSelected: { level in
                showLevelSelection = false
                navigationManager.navigateToBattle(locationId: locationId, selectedLevel: level)
            }
        )
        .environmentObject(navigationManager)
        .environmentObject(audioManager)
        .environmentObject(hapticManager)
    }
}
```

**Success Criteria:**
- [ ] "Start Battle" button shows level selection modal instead of starting combat
- [ ] Modal receives correct locationId and recommendedLevel
- [ ] Dismissing modal returns to map view
- [ ] Selecting level starts combat with chosen level

**References:**
- agent_017840:18-24 (existing MapView flow)
- Requirements:48-58 (user interaction flow)

---

#### T4: Update BattleView to accept selectedLevel parameter
**File:** `New-Mystica/New-Mystica/Views/Battle/BattleView.swift`

**Goal:** Pass selectedLevel through to CombatViewModel

**Changes:**
1. Update `onAppear` handler (line ~192):
   ```swift
   .onAppear {
       if let locationId = locationId {
           viewModel.initializeOrResumeCombat(locationId: locationId, selectedLevel: selectedLevel)
       } else {
           viewModel.resumeCombat()
       }
   }
   ```
2. Add required parameter to BattleView init:
   ```swift
   init(locationId: UUID, selectedLevel: Int) {
       self.locationId = locationId
       self.selectedLevel = selectedLevel
   }
   ```
3. Add state variable: `let selectedLevel: Int`

**Success Criteria:**
- [ ] BattleView requires selectedLevel parameter (no optional, no default)
- [ ] initializeOrResumeCombat receives selectedLevel
- [ ] resumeCombat flow handled separately (different nav path)

**References:**
- agent_017840:35-37 (CombatViewModel.initializeOrResumeCombat signature)

---

#### T5: Update NavigationManager to support selectedLevel
**File:** `New-Mystica/New-Mystica/Managers/NavigationManager.swift`

**Goal:** Add selectedLevel parameter to navigateToBattle method

**Changes:**
1. Update `navigateToBattle` method signature:
   ```swift
   func navigateToBattle(locationId: UUID, selectedLevel: Int) {
       self.selectedCombatLevel = selectedLevel
       self.currentView = .battle(locationId: locationId)
   }
   ```
2. Add state variable: `@Published var selectedCombatLevel: Int`
3. Update BattleView instantiation to use `navigationManager.selectedCombatLevel`

**Success Criteria:**
- [ ] navigateToBattle requires selectedLevel parameter (no default)
- [ ] selectedCombatLevel is published and accessible to BattleView

**References:**
- agent_017840:22 (existing NavigationManager pattern)

---

#### T6: Update CombatLevelSelectionView with navigation callback
**File:** `New-Mystica/New-Mystica/Views/Combat/CombatLevelSelectionView.swift`

**Goal:** Wire level button taps to navigation

**Changes:**
1. Add callback closure: `let onLevelSelected: (Int) -> Void`
2. Implement level button tap handler:
   ```swift
   Button(action: {
       hapticManager.playSelectionHaptic()
       audioManager.playMenuButtonClick()
       isLoading = true
       onLevelSelected(level)
   }) {
       LevelButtonView(level: level, isRecommended: level == recommendedLevel)
   }
   ```
3. Extract LevelButtonView as separate component for cleaner code

**Success Criteria:**
- [ ] Level button tap triggers haptic feedback
- [ ] Level button tap triggers audio feedback
- [ ] Level button tap calls onLevelSelected with chosen level
- [ ] Loading indicator shows briefly before navigation
- [ ] Modal dismisses after level selection

**References:**
- Requirements:96-100 (interaction flow)

---

## Parallelization Strategy

**Batch 1 (Parallel - No Dependencies):**
- T1 and T2 can be implemented independently
- T1 creates the view scaffold
- T2 creates the calculation utility

**Batch 2 (Sequential - Integration):**
- T3 integrates T1 + T2 into MapView (requires completed T1, T2)
- T4 updates BattleView (can run parallel with T3)
- T5 updates NavigationManager (can run parallel with T3, T4)
- T6 completes T1 with navigation callback (requires T3, T5)

**Execution Flow:**
```
T1 (View) ──┐
            ├──> T3 (MapView) ──┐
T2 (Calc) ──┘                   ├──> T6 (Finalize)
                                 │
T4 (BattleView) ────────────────┤
                                 │
T5 (NavigationManager) ─────────┘
```

## Integration Points

### MapView → CombatLevelSelectionView
- **Interface:** `showLevelSelection: Bool`, `selectedLocationForCombat: UUID?`
- **Data Flow:** MapView calculates recommendedLevel from equipped items → passes to modal
- **Event:** "Start Battle" button sets state → `.sheet()` presents modal

### CombatLevelSelectionView → NavigationManager
- **Interface:** `onLevelSelected: (Int) -> Void` callback
- **Data Flow:** Level button tap → callback with selectedLevel → NavigationManager.navigateToBattle
- **Event:** Level selection → navigation state change → BattleView appears

### NavigationManager → BattleView
- **Interface:** `selectedCombatLevel: Int` published property
- **Data Flow:** NavigationManager stores selectedLevel → BattleView reads on appear
- **Event:** BattleView init → reads navigationManager.selectedCombatLevel

### BattleView → CombatViewModel
- **Interface:** `initializeOrResumeCombat(locationId:selectedLevel:)`
- **Data Flow:** BattleView passes selectedLevel to ViewModel
- **Event:** onAppear → ViewModel starts combat with correct level

### CombatViewModel → DefaultCombatRepository → Backend
- **Interface:** `initiateCombat(locationId:selectedLevel:)` → `POST /combat/start`
- **Data Flow:** Repository passes selectedLevel to backend (already implemented)
- **Event:** Backend queries pools by exact `combat_level` match (agent_994317:26-40)

## Risk Assessment

### Critical Risks
1. **Loot pool limitation (levels 11-20)**: No loot pools exist for levels 11-20 (agent_896449:26-27)
   - **Mitigation:** UI limits selection to levels 1-10 only
   - **Validation:** T1 grid shows only 10 buttons (2×5 layout)

2. **Backend validation mismatch**: Schema allows 1-20, UI limits 1-10
   - **Mitigation:** Backend gracefully handles empty pools (returns error), frontend shows alert
   - **Validation:** T1 error state handles 404 responses

### Performance Concerns
- **Vanity level calculation**: O(8) for 8 equipment slots, trivial cost
- **Modal rendering**: SwiftUI animation overhead minimal (<100ms per requirements:122)

### Edge Cases
- **Empty enemy pools**: Backend returns 404, frontend shows error alert (T1 error state)
- **Network timeout**: DefaultCombatRepository already handles timeouts, BattleView shows error

### Breaking Changes
- **BattleView init**: Now requires `selectedLevel: Int` parameter (no default, no optional)
- **NavigationManager.navigateToBattle**: Now requires `selectedLevel: Int` parameter (no default)

## Validation Criteria

### Unit Testing (Optional - Not Required for MVP0)
- VanityLevelCalculator.calculateRecommendedLevel with various equipment configurations
- CombatLevelSelectionView state transitions

### Manual Testing Checklist
- [ ] Location popup → Start Battle → level selection modal appears
- [ ] Recommended level (= vanity level) pre-highlighted with neon pink border
- [ ] Tapping any level 1-10 starts combat immediately
- [ ] Backend receives correct selectedLevel in POST /combat/start
- [ ] Enemy and loot pools queried by exact combat_level match
- [ ] X button closes modal and returns to map
- [ ] Tap outside modal closes and returns to map
- [ ] Haptic feedback on level tap
- [ ] Audio feedback on level tap
- [ ] VoiceOver announces level labels
- [ ] Dynamic Type scales level numbers correctly
- [ ] Loading indicator shows briefly after level tap
- [ ] Error alert shown if backend rejects level (404 response)

### Integration Testing
- [ ] End-to-end flow: Map → Location Popup → Level Selection → Battle Start
- [ ] Verify backend logs show correct selectedLevel parameter
- [ ] Verify CombatSession stores correct combatLevel
- [ ] Verify enemy pool query returns level-appropriate enemies

## Handoff Notes

**Prerequisites:**
- Investigation phase complete (agent_017840, agent_406346, agent_994317, agent_896449)
- Requirements documented ([requirements.md](requirements.md))

**Ready to Execute:**
- Spawn 2 junior-engineer agents for Batch 1 (T1, T2 in parallel)
- Await Batch 1 completion
- Spawn 1 programmer agent for Batch 2 (T3-T6 sequentially)

**Next Phase:**
- Run `/manage-project/implement/execute combat-level-selection` to begin implementation

**Build Validation:**
- iOS Simulator build: `./build.sh` (New-Mystica/)
- Run tests: `xcodebuild test -scheme New-Mystica -configuration Debug -destination "platform=iOS Simulator,name=iPhone 17 Pro"`
