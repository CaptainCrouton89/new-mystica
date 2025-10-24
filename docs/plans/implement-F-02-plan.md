# Implementation Plan – F-02 Combat System

## Overview
- **Item ID:** F-02
- **Spec:** `docs/feature-specs/F-02-combat-system.yaml`
- **Requirements:** `docs/plans/implement-F-02-requirements.md`
- **Investigations:** [`agent-responses/agent_761891.md`, `agent-responses/agent_627586.md`, `agent-responses/agent_165314.md`, `agent-responses/agent_764140.md`]

## Discovery Summary

**Critical Finding:** Backend is **100% complete** with all combat endpoints functional. Frontend needs complete dial mechanics implementation to replace placeholder timing system.

### Backend Status (Complete)
- ✅ **CombatController.ts**: POST /combat/start, /attack, /defend, /complete endpoints
- ✅ **CombatService.ts**: Zone detection via fn_weapon_bands_adjusted() PostgreSQL function
- ✅ **Data Models**: Combat.swift with complete API contract matching
- ✅ **Repository Layer**: DefaultCombatRepository.swift with all endpoints integrated

### Frontend Status (Needs Implementation)
- ❌ **TimingDialView.swift:11-50**: Placeholder component, needs 5-zone dial with Path.addArc()
- ❌ **BattleView.swift:34-497**: Uses hardcoded timing scores (0.8), needs dial integration
- ❌ **CombatViewModel.swift:79,111**: attack/defend methods need tap_position_degrees parameter
- ❌ **Visual Feedback**: Missing damage numbers, sprite animations, haptic feedback
- ❌ **Turn State Machine**: No attack→defense transition flow

### Key Implementation Requirements
- **5-Zone Dial System**: red→orange→yellow→bright green→dark green (center to edge)
- **Backend Integration**: Send tap_position_degrees (0-360°), not zone IDs
- **Zone Sizing**: From API adjustedBands (degCrit, degNormal, degGraze, degMiss, degInjure)
- **60fps Animation**: Timer.publish() with constant rotation at spinDegPerS from API
- **Attack + Defense**: Both phases use same dial with different zone sizing
- **Visual Polish**: Damage numbers, sprite shake, HP bars, haptic feedback, audio cues

## Architecture Overview

```
Combat Flow:
BattleView → CombatViewModel → DefaultCombatRepository → Backend API
     ↓              ↓                    ↓                    ↓
TimingDialView → tap detection → POST /combat/attack → damage calculation
     ↓              ↓                    ↓                    ↓
FloatingTextView ← damage result ← API response ← zone hit detection
```

**Component Integration:**
- **TimingDialView**: Custom Shape + Timer animation + tap gesture → degrees
- **HealthBarView**: Animated HP updates from API responses
- **FloatingTextView**: Color-coded damage numbers floating from sprites
- **AudioManager**: Combat sounds + haptic feedback based on zone hit
- **Turn Machine**: Player attack → 1s pause → defense prompt → defense action → repeat

## Task Breakdown

| ID | Description | Files | Type | Exit Criteria |
|----|-------------|-------|------|---------------|
| **T1** | Core 5-zone dial Shape component | TimingDialView.swift | UI Component | Dial renders 5 zones with correct colors, sizes from adjustedBands |
| **T2** | Tap-to-angle calculation utility | TimingDialView.swift | Math Logic | atan2() converts tap coordinates to 0-360° within ±1° accuracy |
| **T3** | Timer-based rotation animation | TimingDialView.swift | Animation | 60fps smooth rotation at spinDegPerS, start/stop controls |
| **T4** | Attack flow integration | BattleView.swift, CombatViewModel.swift | Combat Logic | Sends tap_position_degrees to API, handles damage response |
| **T5** | Defense flow integration | BattleView.swift, CombatViewModel.swift | Combat Logic | Same dial with defense zone sizing, damage blocking logic |
| **T6** | Turn state machine | BattleView.swift | State Management | Attack→1s pause→defense prompt→defense→repeat cycle |
| **T7** | Visual feedback system | BattleView.swift, FloatingTextView.swift | UI Polish | Damage numbers, zone flash, sprite shake, HP animations |
| **T8** | Audio and haptic integration | BattleView.swift, AudioManager.swift | Feedback | Heavy/light/none haptics, hit/miss/crit sounds per zone |

## Parallelization Strategy

### Batch 1: Foundation Components (Parallel - No Dependencies)
**Duration: 2-3 hours**
- **T1**: Core dial Shape component
- **T2**: Tap-to-angle calculation utility
- **T3**: Timer animation system

**Rationale:** These are independent UI/math components that don't depend on each other or backend integration.

### Batch 2: Combat Integration (Parallel - Depends on Batch 1)
**Duration: 2-3 hours**
- **T4**: Attack flow integration (depends T1, T2, T3)
- **T5**: Defense flow integration (depends T1, T2, T3)
- **T6**: Turn state machine (depends T1, T2, T3)

**Rationale:** Each combat phase can be implemented independently once dial component works.

### Batch 3: Polish and Feedback (Parallel - Depends on Batch 2)
**Duration: 1-2 hours**
- **T7**: Visual feedback system (depends T4, T5, T6)
- **T8**: Audio/haptic integration (depends T4, T5, T6)

**Rationale:** Feedback systems need working combat flow to trigger correctly.

## Implementation Details

### T1: Core 5-Zone Dial Shape Component
**File:** `New-Mystica/New-Mystica/Views/Battle/Components/TimingDialView.swift:11-50`

**Scope:**
- Replace placeholder TimingDialView with custom Shape using Path.addArc()
- 5 concentric zones: red (outer) → orange → yellow → bright green → dark green (inner)
- Zone sizes from `adjustedBands` API data (degInjure, degMiss, degGraze, degNormal, degCrit)
- Colors per spec: red #FF4444, orange, yellow #FFAA44, bright green #44FF44, dark green

**Pattern Reference:** Similar to circle drawing but with arc segments
**Success Criteria:**
- Dial renders 5 distinct colored zones
- Zone boundaries match `adjustedBands` degrees from API
- Visual zones clearly delineated with proper colors
- Component accepts `adjustedBands` parameter

### T2: Tap-to-Angle Calculation Utility
**File:** `New-Mystica/New-Mystica/Views/Battle/Components/TimingDialView.swift`

**Scope:**
- Implement tap gesture recognizer on dial
- Convert tap coordinates to 0-360° using atan2()
- Handle coordinate system conversion (SwiftUI vs. API degrees)
- Return degrees value for backend submission

**Algorithm (from requirements doc:192-199):**
```swift
func tapToAngle(location: CGPoint, center: CGPoint) -> Double {
    let dx = location.x - center.x
    let dy = location.y - center.y
    let radians = atan2(dy, dx)
    let degrees = radians * 180 / .pi
    return degrees < 0 ? degrees + 360 : degrees
}
```

**Success Criteria:**
- Tap anywhere on dial returns degrees 0-360
- Accuracy within ±1 degree of expected value
- Handles edge cases (negative angles, boundary conditions)

### T3: Timer-Based Rotation Animation
**File:** `New-Mystica/New-Mystica/Views/Battle/Components/TimingDialView.swift`

**Scope:**
- Timer.publish() animation at constant speed from API `spinDegPerS`
- Smooth 60fps rotation using `.rotationEffect(.degrees())`
- Start/stop controls for turn transitions
- Rotating needle/pointer visual indicator

**Pattern Reference:** `GoldShowerAnimation.swift:20-70` - Timer-based rotation
**Success Criteria:**
- Dial rotates smoothly at constant speed (no jank)
- Animation maintains 60fps on iPhone 15 Pro simulator
- Start/stop controls work correctly
- Speed matches API `spinDegPerS` parameter

### T4: Attack Flow Integration
**Files:**
- `New-Mystica/New-Mystica/Views/Battle/BattleView.swift:34-497`
- `New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift:79,111`

**Scope:**
- Remove hardcoded timing scores (line references from requirements doc)
- Wire dial tap → tap_position_degrees → POST /combat/attack
- Handle API response: damage_dealt, hp_remaining, combat_status
- Update UI state based on attack result

**Key Changes:**
- Replace `0.8` hardcoded values with actual tap degrees
- Update CombatViewModel.attack() to accept tap_position_degrees parameter
- Handle zone flash visual feedback on tap
- Update enemy HP bar with animation

**Success Criteria:**
- Attack API call sends real tap_position_degrees (0-360)
- Enemy HP decreases based on API damage_dealt
- Zone flash triggers on tap
- Combat progresses to enemy turn after attack

### T5: Defense Flow Integration
**Files:**
- `New-Mystica/New-Mystica/Views/Battle/BattleView.swift:34-497`
- `New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift:111`

**Scope:**
- Implement defense phase with same dial, different zone sizing
- Send tap_position_degrees to POST /combat/defend
- Handle defense results: damage_blocked, damage_taken
- Update player HP bar based on defense effectiveness

**Zone Sizing Logic:**
- Attack dial: Player's attack accuracy determines zone sizes
- Defense dial: Player's defense accuracy determines zone sizes
- Same 5-zone visual system, different damage outcomes

**Success Criteria:**
- Defense dial shows different zone sizes than attack dial
- API call sends tap_position_degrees to /combat/defend
- Player HP decreases by damage_taken amount
- "Blocked X damage" feedback shows if damage blocked

### T6: Turn State Machine
**File:** `New-Mystica/New-Mystica/Views/Battle/BattleView.swift`

**Scope:**
- Implement turn alternation: Player attack → 1s pause → defense transition → defense action → repeat
- "DEFEND NOW!" text prompt with animations (slide in, pulse, fade out)
- Enemy sprite red glow during defense phase
- Dial visibility/sizing transitions between phases

**State Flow (from requirements:115-132):**
1. **Player Attack**: Dial visible with attack accuracy zones
2. **Transition (1s)**: Dial hidden, "DEFEND NOW!" prompt slides in
3. **Defense Setup**: Prompt fades, dial re-appears with defense zones, enemy glows red
4. **Player Defense**: Tap dial, process defense, update HP
5. **Repeat**: Back to step 1 until HP = 0

**Success Criteria:**
- Turn phases advance automatically with correct timing
- Visual prompts appear/disappear at right moments
- Dial disabled during transitions (no accidental taps)
- State persists correctly between turns

### T7: Visual Feedback System
**Files:**
- `New-Mystica/New-Mystica/Views/Battle/BattleView.swift`
- `New-Mystica/New-Mystica/UI/Components/FloatingTextView.swift`

**Scope:**
- Floating damage numbers with color coding per zone hit
- Zone flash animation (0.1s white pulse) on tap
- Enemy sprite shake (±5px horizontal, 0.2s) on successful hits
- Shield visual component for defense phase
- HP bar smooth animations (0.3s easeOut)

**Visual Feedback Specs (from requirements:217-257):**
- **Attack Phase**: Zone flash → floating damage number → sprite shake → HP animation
- **Defense Phase**: Shield icon → "Blocked X" or "Damage X" text → HP animation
- **Color Coding**: Dark green (crit), bright green (normal), yellow (graze), orange (miss), red (injure)

**Success Criteria:**
- Damage numbers float up from correct sprites with right colors
- Zone flash triggers immediately on tap
- Enemy shakes only on successful hits (not miss/injure)
- Shield visual matches defense effectiveness
- All animations smooth with proper timing

### T8: Audio and Haptic Integration
**Files:**
- `New-Mystica/New-Mystica/Views/Battle/BattleView.swift`
- `New-Mystica/New-Mystica/Managers/AudioManager.swift`

**Scope:**
- Haptic feedback per zone: Heavy (crit), Light (normal/graze), None (miss/injure)
- Audio cues: playDealDamage, playTakeDamage, playVictory from AudioManager
- Match haptic intensity to damage effectiveness
- Audio feedback for hit/miss/crit scenarios

**Haptic Mapping (from requirements:41-44):**
- **Dark Green (Crit)**: Heavy impact haptic
- **Bright Green (Normal)**: Light impact haptic
- **Yellow (Graze)**: Light impact haptic
- **Orange (Miss)**: No haptic
- **Red (Injure)**: No haptic (or different pattern)

**Success Criteria:**
- Haptic feedback triggers correctly per zone hit
- Audio plays for appropriate combat events
- Haptic intensity matches damage effectiveness
- No audio/haptic conflicts or overlapping

## Data Flow Architecture

```
User Tap → TimingDialView.tapToAngle() → degrees (0-360)
    ↓
CombatViewModel.attack(tap_position_degrees: degrees)
    ↓
DefaultCombatRepository.attack(sessionId, degrees)
    ↓
POST /combat/attack { session_id, tap_position_degrees }
    ↓
Backend: fn_weapon_bands_adjusted() → zone detection → damage calculation
    ↓
Response: { damage_dealt, player_hp_remaining, enemy_hp_remaining, combat_status }
    ↓
BattleView updates: HP bars, damage numbers, visual feedback, turn state
```

## Integration Points

### Component Dependencies
- **TimingDialView** ↔ **BattleView**: tap_position_degrees data flow
- **CombatViewModel** ↔ **DefaultCombatRepository**: API parameter changes
- **FloatingTextView** ↔ **BattleView**: damage number display coordination
- **HealthBarView** ↔ **BattleView**: HP animation triggers
- **AudioManager** ↔ **BattleView**: Sound/haptic event triggers

### State Synchronization
- **Turn Phase**: Attack/defense mode affects dial zone sizing
- **Combat Status**: ongoing/victory/defeat determines UI state
- **HP Values**: Synchronized between ViewModel and UI components
- **Animation Timing**: Coordinated across multiple visual elements

### API Contract Changes
- **CombatViewModel.attack()**: Add `tap_position_degrees: Float` parameter
- **CombatViewModel.defend()**: Add `tap_position_degrees: Float` parameter
- Remove all hardcoded timing values from BattleView combat flow

## Validation Strategy

### Batch 1 Validation: Foundation Components
**Criteria:**
- [ ] Dial renders with 5 distinct colored zones
- [ ] Zone sizes match mock `adjustedBands` data
- [ ] Tap detection returns degrees 0-360 with ±1° accuracy
- [ ] Rotation animation maintains 60fps smooth motion
- [ ] Start/stop controls work correctly

**Test Method:** Manual testing with SwiftUI previews, simulator tap testing

### Batch 2 Validation: Combat Integration
**Criteria:**
- [ ] Attack flow sends real tap_position_degrees to API
- [ ] Defense flow uses same dial with different zone sizes
- [ ] Turn state advances automatically: attack → pause → defense → repeat
- [ ] API responses update HP bars correctly
- [ ] Combat status (victory/defeat) handled properly

**Test Method:** End-to-end combat session with real backend

### Batch 3 Validation: Polish and Feedback
**Criteria:**
- [ ] Damage numbers appear with correct colors and positioning
- [ ] Zone flash animation triggers on every tap
- [ ] Enemy sprite shakes on hits (not miss/injure)
- [ ] Haptic feedback matches zone effectiveness
- [ ] Audio cues play for appropriate events
- [ ] All animations smooth with no performance drops

**Test Method:** Complete combat sessions testing all zone types

## Performance Requirements

- **60fps Animation**: Timer-based dial rotation must not drop frames
- **Tap Responsiveness**: < 16ms from tap to visual feedback
- **Network Latency**: Handle 500ms+ API response times gracefully
- **Memory Usage**: No memory leaks from timer/animation management
- **Battery Impact**: Minimize power consumption during combat sessions

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| **60fps Performance Target** | High - Core requirement | Use Timer.publish() pattern from GoldShowerAnimation, profile on device |
| **Tap Accuracy Validation** | Medium - Affects gameplay | ±1° tolerance, comprehensive testing across dial |
| **Turn State Synchronization** | Medium - Could break flow | Clear state machine with validation, error recovery |
| **Network Latency Handling** | Medium - Real network issues | Loading states, retry mechanisms, offline handling |
| **Animation Coordination** | Low - Polish issue | Stagger animations with delays, avoid conflicts |

## File References

### Files to Modify
- `New-Mystica/New-Mystica/Views/Battle/Components/TimingDialView.swift:11-50` - Replace placeholder
- `New-Mystica/New-Mystica/Views/Battle/BattleView.swift:34-497` - Remove hardcoded timing, wire dial
- `New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift:79,111` - Add tap_position_degrees parameter

### Patterns to Follow
- `New-Mystica/New-Mystica/Views/Animations/GoldShowerAnimation.swift:20-70` - Timer rotation pattern
- `New-Mystica/New-Mystica/Views/Battle/Components/HealthBarView.swift` - Animated progress bars
- `New-Mystica/New-Mystica/UI/Components/FloatingTextView.swift` - Damage number system
- `New-Mystica/New-Mystica/Managers/AudioManager.swift` - Combat sounds + haptics

### Backend API (Reference Only)
- `mystica-express/src/controllers/CombatController.ts:18-273` - Combat endpoints
- `mystica-express/src/services/CombatService.ts` - Zone detection logic
- `New-Mystica/New-Mystica/Models/Combat.swift:110-137` - Data models

## Expected Timeline

**Total Duration: 5-8 hours (1 development day)**
- **Batch 1**: 2-3 hours (Foundation components)
- **Batch 2**: 2-3 hours (Combat integration)
- **Batch 3**: 1-2 hours (Polish and feedback)

**Critical Path:** T1→T2→T3 must complete before T4→T5→T6 can begin
**Parallelization:** 3 tasks in Batch 1, 3 tasks in Batch 2, 2 tasks in Batch 3

## Success Criteria

### Minimum Viable (MVP0)
- [ ] 5-zone dial renders correctly with API zone sizing
- [ ] Attack/defense flow sends tap_position_degrees to backend
- [ ] HP bars update from API damage responses
- [ ] Turn state machine advances automatically
- [ ] Basic visual feedback (damage numbers, zone flash)

### Complete Implementation
- [ ] All MVP0 criteria plus:
- [ ] Haptic feedback matches zone effectiveness
- [ ] Audio cues for all combat events
- [ ] Smooth animations (sprite shake, HP bars, transitions)
- [ ] 60fps performance maintained throughout
- [ ] Error handling and recovery states

### Quality Gates
- [ ] **Performance**: 60fps animation in iPhone 15 Pro simulator
- [ ] **Accuracy**: Tap-to-degrees calculation within ±1° tolerance
- [ ] **Integration**: Combat sessions complete successfully end-to-end
- [ ] **Polish**: All visual/audio feedback triggers correctly
- [ ] **Reliability**: No crashes or state corruption during extended play

---

**Ready for execution via:**
```bash
/manage-project/implement/execute F-02
```

**Or parallel agent delegation:**
- Batch 1: Launch 3 agents for foundation components
- Batch 2: Launch 3 agents for combat integration (after Batch 1)
- Batch 3: Launch 2 agents for polish (after Batch 2)