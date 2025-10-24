# Implementation Requirements – F-02 Combat System Frontend

## Source Specification
- **Item ID:** F-02
- **Spec:** `docs/feature-specs/F-02-combat-system.yaml`
- **Status:** requirements-complete
- **Last Updated:** 2025-10-23

> All functional requirements, user value, and technical specs are defined in the source YAML.
> This doc captures **investigation findings** and **implementation-specific requirements**.

## Specification Summary

**Feature:** Turn-based combat with animated timing dial mechanics
**Backend Status:** ✅ 100% complete
**Frontend Status:** ❌ Not started

### Core Mechanics
- **Level Selection:** Player chooses combat level (1-20) before battle
- **Dial Pattern:** MVP0 uses single_arc only with 5 color-coded zones
- **Zone System:** injure (red), miss (gray), graze (yellow), normal (white), crit (green)
- **Turn Flow:** Player attack → Enemy counterattack → repeat until HP = 0
- **Visual Requirements:** HP bars only (not full stats), dial animation at 60fps, haptic feedback

### API Endpoints (Backend Complete)
- `POST /combat/start` - Initialize session with selected level
- `POST /combat/attack` - Submit tap_position_degrees (0-360)
- `POST /combat/defend` - Submit defense_accuracy (if defense dial implemented)
- `POST /combat/complete` - Claim rewards on victory
- `GET /combat/session/:id` - Resume combat after app backgrounding

### UI Requirements (from spec line 147-152)
```yaml
Dial color coding:
  injure: #FF4444 (red)
  miss: #666666 (gray)
  graze: #FFAA44 (yellow)
  normal: #FFFFFF (white)
  crit: #44FF44 (green)

Haptic feedback:
  - Heavy impact on crit
  - Light impact on normal
  - No haptic on miss

Animation requirements:
  - Screen flash on crit hit
  - Damage number glow effect
  - Moving pointer/needle shows current tap position
  - Zone boundaries clearly delineated
```

## Investigation Findings

### Existing Patterns

**Combat Infrastructure (Already Implemented):**
- `CombatViewModel.swift:12-316` - Complete state management with auto-resume
- `BattleView.swift:34-497` - Basic UI structure with placeholder timing system
- `DefaultCombatRepository.swift` - All API endpoints integrated (start/attack/defend/complete)
- `Combat.swift:19-273` - Complete data models matching backend API

**Animation Patterns:**
- `GoldShowerAnimation.swift:20-70` - Timer-based rotation with `.rotationEffect(.degrees())`
- `LogViewerView.swift:18` - `Timer.publish().autoconnect()` pattern for smooth updates

**UI Components:**
- `HealthBarView.swift` - Animated progress bar component (reusable for HP)
- `ButtonComponents.swift` - Standardized button styles
- `AudioManager.swift` - Haptic feedback handling

### Integration Points Discovered

1. **NavigationManager** - Centralized navigation with typed destinations
2. **AppState** - Global combat session tracking for auto-resume
3. **APIClient.shared** - Bearer token authentication for all requests
4. **Loadable<T>** - Standard loading state wrapper pattern

### Constraints & Dependencies

**Technical Constraints:**
- Backend expects `tap_position_degrees: Float (0-360)` not zone IDs
- Backend calculates damage via `fn_weapon_bands_adjusted()` PostgreSQL function
- `adjustedBands` from API provides exact zone sizes in degrees
- 60fps animation requirement for dial rotation
- 15-minute session TTL with auto-cleanup

**Data Flow:**
- Attack/defend flow: tap → degrees → backend zone detection → damage calc → HP update
- Zone sizing: player stats → backend function → adjusted band degrees → frontend rendering

## Dial Mechanics (User-Confirmed Specifications)

### 5-Zone System

**Visual Zones (arc layout, ordered from center outward):**
1. **Dark Green** (Crit/Perfect) - Smallest zone, 150% damage
2. **Bright Green** (Normal/Good) - Medium zone, 100% damage
3. **Yellow** (Graze/Okay) - Medium zone, 60% damage
4. **Orange** (Miss/Poor) - Larger zone, 0% damage
5. **Red** (Injure/Self-damage) - Player takes damage instead

### Zone Sizing Logic

**Attack Accuracy Scaling:**
- High attack accuracy → **larger green zones**, smaller red/orange/yellow
- Low attack accuracy → **smaller green zones**, larger red/orange/yellow
- Exact sizes from API: `adjustedBands.degCrit`, `degNormal`, `degGraze`, `degMiss`, `degInjure`

**Defense Accuracy Scaling:**
- Same 5-zone visual system, different damage reduction outcomes
- High defense accuracy → larger green zones (better damage blocking)
- Defense multipliers TBD by backend logic

### Turn Flow

**Player Turn (Attack):**
1. Dial spins at constant speed (`spinDegPerS` from API)
2. Player taps screen → calculate tap angle (0-360°)
3. POST /combat/attack `{ session_id, tap_position_degrees }`
4. Backend determines zone hit, calculates damage, returns updated HP
5. Display damage dealt to enemy

**Enemy Turn (Defense):**
1. 1-2 second delay after attack
2. Display "BLOCK!" prompt
3. Same dial with zones sized by player's defense accuracy
4. Player taps → calculate tap angle
5. POST /combat/defend `{ session_id, tap_position_degrees }`
6. Backend calculates damage reduction, returns damage taken
7. Display damage taken by player

### API Contract

**Attack Endpoint:**
```typescript
POST /combat/attack
Request: {
  session_id: UUID,
  tap_position_degrees: number (0-360)
}
Response: {
  damage_dealt: number,
  player_hp_remaining: number,
  enemy_hp_remaining: number,
  combat_status: "ongoing" | "victory" | "defeat"
  // Backend determines zone from degrees using fn_weapon_bands_adjusted()
}
```

**Defense Endpoint:**
```typescript
POST /combat/defend
Request: {
  session_id: UUID,
  tap_position_degrees: number (0-360)
}
Response: {
  damage_taken: number,
  player_hp_remaining: number,
  enemy_hp_remaining: number,
  combat_status: "ongoing" | "victory" | "defeat"
}
```

## Edge Cases & Error Handling

- **Session expiry (15min TTL):** Display error, return to map
- **App backgrounding mid-combat:** Auto-resume via GET /combat/active-session (already implemented)
- **Network timeout during attack:** Show retry button, maintain local state
- **Invalid tap position:** Clamp to 0-360 range before sending
- **Combat already complete:** Detect from combat_status, show results immediately

## Implementation-Specific Decisions

### Dial Rendering Approach
**Decision:** Custom SwiftUI Shape with Path.addArc()
**Reasoning:**
- Native SwiftUI performance (60fps capable)
- Direct control over zone visualization
- No external dependencies

### Animation Strategy
**Decision:** Timer.publish() with rotationEffect
**Reasoning:**
- Proven pattern in GoldShowerAnimation.swift
- Smooth constant rotation
- Simple state management

### Tap Detection Algorithm
**Decision:** atan2() conversion to 0-360° range
```swift
func tapToAngle(location: CGPoint, center: CGPoint) -> Double {
    let dx = location.x - center.x
    let dy = location.y - center.y
    let radians = atan2(dy, dx)
    let degrees = radians * 180 / .pi
    return degrees < 0 ? degrees + 360 : degrees
}
```

### Zone Color Palette
**Decision:** Match user specifications exactly
- Dark Green (crit): `Color(red: 0.2, green: 0.8, blue: 0.3)`
- Bright Green (normal): `Color(red: 0.27, green: 1.0, blue: 0.27)` (#44FF44)
- Yellow (graze): `Color(red: 1.0, green: 0.67, blue: 0.27)` (#FFAA44)
- Orange (miss): `Color.orange`
- Red (injure): `Color(red: 1.0, green: 0.27, blue: 0.27)` (#FF4444)

### No RNG on Frontend
**Decision:** Frontend only detects tap position, backend calculates all damage
**Reasoning:**
- Single source of truth for combat logic
- Prevents client-side manipulation
- Backend already has zone detection via fn_weapon_bands_adjusted()

## Visual Feedback Specifications

### Attack Phase Feedback (Zone Flash + Damage Number)

**When player taps dial:**
1. **Dial zone flash** - Tapped zone flashes white (0.1s pulse)
2. **Damage number** - Floats up from enemy sprite (0.5s float + fade)
   - Dark green text for crit (150%)
   - Bright green for normal (100%)
   - Yellow for graze (60%)
   - Orange text "MISS!" for miss
   - Red for injure (appears on player sprite instead)
3. **Enemy sprite shake** - Horizontal shake (0.2s, ±5px) on successful hits
4. **HP bar animation** - Enemy HP animates down (0.3s easeOut)
5. **Haptic feedback** - Heavy (crit), light (normal/graze), none (miss/injure)
6. **Audio cue** - Play hit/miss/crit sounds via AudioManager

### Defense Transition (Bold Text Prompt)

**After attack completes (1s pause):**
1. **"DEFEND NOW!" text** - Slides in from top (bold, 36pt)
2. **Text pulse** - Scale animation (1.0 → 1.1 → 1.0)
3. **Dial fade in** - Dial re-appears with defense zone sizing (0.3s fade)
4. **Enemy glow** - Enemy sprite gets red glow (indicating incoming attack)
5. **Text fade out** - Prompt fades after 0.5s, dial remains spinning

### Defense Phase Feedback (Shield Visual)

**When player taps defense dial:**
1. **Shield icon** - Appears over player sprite (0.2s scale in)
2. **Shield color** - Based on defense success:
   - Dark green = bright solid shield (best defense)
   - Bright green = solid shield
   - Yellow = semi-transparent shield
   - Orange = cracked shield
   - Red = shattered shield (poor defense)
3. **Blocked number** - Green "+X blocked" floats up (if any damage blocked)
4. **Damage number** - Red "-X" floats up (if any damage taken)
5. **Shield fade** - Shield fades out (0.3s)
6. **HP bar animation** - Player HP animates down (0.3s easeOut)
7. **Haptic + audio** - Based on defense effectiveness

## Implementation Scope

**In this phase:**

### Core Dial Component
- [ ] Replace TimingDialView placeholder with working 5-zone dial component
  - Custom Shape rendering with Path.addArc() for 5 colored zones
  - Zone colors: red → orange → yellow → bright green → dark green
  - Zone sizing from `adjustedBands` API data (degInjure/degMiss/degGraze/degNormal/degCrit)
  - Rotating needle/pointer visual indicator

- [ ] Implement dial animation system
  - Timer-based rotation at constant speed from API (`spinDegPerS`)
  - 60fps smooth animation using `.rotationEffect()`
  - Start/stop controls for turn transitions

- [ ] Implement tap detection and angle calculation
  - Tap gesture recognizer on dial
  - atan2() conversion: tap coordinates → degrees (0-360)
  - Zone flash visual feedback on tap (0.1s white pulse)

### Attack Flow
- [ ] Wire attack flow in BattleView
  - Remove hardcoded `0.8` timing scores
  - Send `tap_position_degrees` to POST /combat/attack
  - Implement zone flash on tap
  - Display floating damage numbers (color-coded by zone)
  - Enemy sprite shake animation (0.2s, ±5px)
  - Update HP bars with animation (0.3s easeOut)
  - Trigger haptic feedback (heavy/light/none)
  - Play audio cues (hit/miss/crit sounds)

### Defense Flow
- [ ] Wire defense flow in BattleView
  - **Transition phase:**
    - 1s pause after attack completes
    - Display "DEFEND NOW!" text (slide in from top, pulse, fade out)
    - Enemy sprite red glow effect
    - Dial fade in with defense accuracy zone sizing (0.3s)

  - **Defense action:**
    - Player taps dial → send `tap_position_degrees` to POST /combat/defend
    - Display shield icon over player sprite (0.2s scale in)
    - Color shield based on defense effectiveness (green/yellow/orange/red)
    - Show "Blocked X" number in green (if any blocked)
    - Show "Damage X" number in red (if any taken)
    - Shield fade out (0.3s)
    - Update player HP bar with animation (0.3s easeOut)
    - Trigger haptic + audio feedback

### Turn Alternation
- [ ] Implement turn state machine
  - Player attack phase → 1s pause → defense transition → defense phase → repeat
  - Disable dial tap during transitions
  - Clear visual state indicators for each phase
  - Proper cleanup between phases

### Polish and Feedback
- [ ] Integrate FloatingTextView for damage numbers
  - Color-coded text (dark green/bright green/yellow/orange/red)
  - Upward float animation with fade (0.5s)
  - Position numbers over sprites (enemy for attack, player for defense)

- [ ] Implement shield visual component
  - Shield icon asset or custom drawing
  - Color variations based on effectiveness
  - Scale in/fade out animations

- [ ] Sprite animations
  - Enemy horizontal shake on hit (0.2s, ±5px)
  - Enemy red glow during defense phase
  - Player shield overlay during defense

- [ ] Audio and haptics integration
  - Wire AudioManager combat sounds (playDealDamage, playTakeDamage)
  - UIImpactFeedbackGenerator for haptics (heavy/light/none)
  - Match haptic intensity to zone hit

- [ ] HP bar integration
  - Use existing HealthBarView component
  - Smooth 0.3s easeOut animations
  - Color transitions (green → orange → red based on HP%)

- [ ] Victory/defeat results screen (verify existing implementation)

**Deferred (Post-MVP0):**
- Additional dial patterns (dual_arcs, pulsing_arc, roulette, sawtooth)
- Enemy chatter integration (F-12)
- Pet chatter integration (F-11)
- Screen flash effects on crit hits
- Particle effects and advanced animations
- Combat analytics logging

## Success Criteria (beyond spec acceptance criteria)

- [ ] Dial animation maintains 60fps on iPhone 15 Pro simulator
- [ ] Tap-to-degrees calculation accurate within ±1 degree
- [ ] API response time < 500ms for attack/defend calls
- [ ] HP bar updates smoothly (no jank)
- [ ] Haptic feedback triggers correctly for each zone type
- [ ] Screen transitions feel polished (no abrupt jumps)

## Investigation Reports

**Comprehensive codebase investigations completed:**
- **@agent-responses/agent_761891.md** - SwiftUI Architecture & Navigation Patterns
  - MVVM with @Observable ViewModels
  - NavigationManager-based routing system
  - AppState global state management
  - APIClient integration patterns
  - AnimationModifiers performance system

- **@agent-responses/agent_627586.md** - Combat API Integration & Data Models
  - Complete Combat.swift data models
  - CombatViewModel implementation analysis
  - Backend API contract verification
  - Repository pattern usage

- **@agent-responses/agent_165314.md** - UI Components & Design System
  - Dark gray + neon pink/blue color scheme
  - ButtonComponents with press animations
  - HealthBarView animated progress bars
  - FloatingTextView damage number system
  - AudioManager combat sounds + haptics

- **@agent-responses/agent_764140.md** - Dial Mechanics Technical Analysis
  - Custom Shape rendering approach
  - Timer-based rotation animation strategy
  - atan2() tap-to-angle conversion
  - 60fps performance considerations

## Relevant Files

### Files to Modify
- `New-Mystica/New-Mystica/Views/Battle/Components/TimingDialView.swift:11-50` - Replace placeholder with working 5-zone dial
- `New-Mystica/New-Mystica/Views/Battle/BattleView.swift:34-497` - Remove hardcoded timing, wire dial integration
- `New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift:79,111` - Update attack/defend methods to use tap_position_degrees

### Files to Reference (Patterns)
- `New-Mystica/New-Mystica/Views/Animations/GoldShowerAnimation.swift:20-70` - Timer-based rotation pattern
- `New-Mystica/New-Mystica/Views/Battle/Components/HealthBarView.swift` - Animated HP bar component (0.3s easeInOut)
- `New-Mystica/New-Mystica/UI/Components/FloatingTextView.swift` - Damage number display system
- `New-Mystica/New-Mystica/UI/Components/AnimationModifiers.swift:1-334` - Performance animation configs
- `New-Mystica/New-Mystica/Managers/AudioManager.swift` - Combat sounds (playDealDamage, playTakeDamage, playVictory)
- `New-Mystica/New-Mystica/Models/Combat.swift:110-137` - WeaponConfig and AdjustedBands data structure
- `New-Mystica/New-Mystica/UI/Colors/Colors.swift` - Color system (use for zone colors)

### Architecture References
- `New-Mystica/New-Mystica/Navigation/NavigationManager.swift:95-153` - Navigation pattern
- `New-Mystica/New-Mystica/State/AppState.swift:13-221` - Global state management
- `New-Mystica/New-Mystica/Networking/APIClient.swift:11-264` - API integration
- `New-Mystica/New-Mystica/UI/Components/BaseView.swift:24-86` - View wrapper pattern

### Backend API (Reference Only)
- `mystica-express/src/controllers/CombatController.ts:18-273` - Combat endpoint implementations
- `mystica-express/src/services/CombatService.ts` - Backend zone detection logic

---

## Summary

**Requirements Status:** ✅ Complete and confirmed with user

**Key Decisions:**
1. ✅ 5-zone dial system (red/orange/yellow/bright green/dark green)
2. ✅ Send tap_position_degrees to backend (not zone IDs)
3. ✅ Backend calculates all damage (no frontend RNG)
4. ✅ Attack AND defense dials in this phase
5. ✅ Remove all hardcoded timing values
6. ✅ Custom Shape rendering with Timer-based animation

**Next Steps:**
1. Create detailed implementation plan with task breakdown
2. Implement TimingDialView component
3. Wire combat flow in BattleView
4. Test and validate dial accuracy
5. Polish animations and feedback

**Ready to proceed to planning phase: `/manage-project:implement:plan F-02`**
