# Requirements: Combat Enemy Commentary Display

## Changelog

**v2.0 - Sprite Animation Integration (2025-10-24)**
- Added sprite animation system with 4 states (idle/hit/attack/death)
- Defined parallel execution pattern: animation + API call run simultaneously
- Speech bubble now appears AFTER animation completes (coordinated timing)
- Added `EnemySpriteView` component requirements
- Added animation asset structure (sprite atlases per enemy type)
- Updated all user scenarios to include animation flows
- Added animation-specific test scenarios
- Added 11 new success criteria for animation coordination

**v1.0 - Initial Requirements (Original)**
- Enemy commentary display system
- Backend integration with `EnemyChatterService`
- `EnemyDialogueBubble` UI component
- Speech bubble design and timing

## Summary
**Goal:** Display AI-generated enemy commentary with synchronized sprite animations during combat to enhance player immersion and personality
**Type:** Feature
**Scope:** Medium
**Status:** Ready for implementation

## Problem Statement

The backend has a fully implemented `EnemyChatterService` that generates contextual, personality-driven enemy dialogue using OpenAI GPT-4.1-mini, but this commentary is **never shown to the player**. Additionally, enemies need sprite animations (idle, hit, attack, death) that coordinate with combat events and commentary display.

**Current State:**
- ✅ Backend generates AI commentary for 8 combat events (start, hit, miss, victory, defeat, etc.)
- ✅ Each enemy has personality traits (e.g., "mischievous", "artistic") and combat style
- ✅ Commentary considers combat context (HP levels, critical hits, player history)
- ❌ Commentary is generated but never displayed to the user
- ❌ No UI component exists in BattleView to show dialogue
- ❌ CombatAction API responses don't include commentary data
- ❌ No sprite animation system for enemies (idle/hit/attack/death)
- ❌ No coordination between animations and commentary timing

**Desired State:**
- ✅ Enemy commentary displayed prominently during combat
- ✅ Dialogue reflects enemy personality and combat events
- ✅ Enemy sprites animate based on combat events (idle → attack/hit → idle)
- ✅ Animations and commentary generation run in parallel (non-blocking)
- ✅ Speech bubble appears after animation completes and commentary is ready
- ✅ UI integrates seamlessly with existing combat flow
- ✅ Commentary enhances immersion without disrupting gameplay

## User Experience Goals

### Primary Objectives
1. **Personality:** Enemies feel unique and alive through contextual dialogue
2. **Immersion:** Commentary enhances the fantasy RPG combat experience
3. **Non-Intrusive:** Dialogue doesn't block or slow down combat actions
4. **Readable:** Commentary is clearly visible and easy to read during combat

### User Scenarios

**Scenario 1: Combat Start**
- **Context:** Player enters battle with "Spray Paint Goblin"
- **Animation:** Enemy plays idle animation (looping)
- **Expected:** Enemy taunts appear immediately: *"Time to tag you up, friend!"*
- **Tone:** Confident, personality-appropriate (mischievous, artistic)

**Scenario 2: Player Attacks Enemy**
- **Context:** Player releases attack dial toward enemy
- **Animation Flow:**
  1. Enemy sprite plays **hit** animation (0.5-1s)
  2. AI commentary generation starts in parallel with animation
  3. Hit animation completes → returns to **idle** loop
  4. Speech bubble appears with commentary: *"Whoa! That actually hurt!"*
- **Timing:** Commentary shows after animation, not during
- **Tone:** Surprised, angry, or desperate depending on HP level

**Scenario 3: Enemy Attacks Player**
- **Context:** Enemy's turn to attack
- **Animation Flow:**
  1. Enemy sprite plays **attack** animation (0.5-1s)
  2. AI commentary generation starts in parallel
  3. Attack animation completes → returns to **idle** loop
  4. Speech bubble appears with commentary: *"Take that!"*
- **Timing:** Commentary shows after animation completes

**Scenario 4: Enemy Near Defeat**
- **Context:** Enemy HP drops to 15%
- **Animation:** Enemy continues **idle** but may look damaged
- **Expected:** Enemy shows desperation: *"This can't be happening!"*
- **Tone:** Desperate, defiant

**Scenario 5: Enemy Defeated**
- **Context:** Enemy HP reaches 0
- **Animation Flow:**
  1. Enemy sprite plays **death** animation (1-2s, does not loop)
  2. AI commentary generation starts in parallel
  3. Death animation completes → sprite fades/disappears
  4. Speech bubble shows final words: *"I'll be back..."*
- **Timing:** Final commentary shows during/after death animation

**Scenario 6: Player Defeated**
- **Context:** Player HP reaches 0
- **Animation:** Enemy plays **idle** or triumphant pose
- **Expected:** Enemy gloats: *"Better luck next time, amateur!"*
- **Tone:** Victorious, mocking

## Technical Requirements

### Sprite Animation System

**Requirement 1: Animation States**
Enemy sprites must support 4 animation states:
- **idle** - Default looping animation (breathing, subtle movement)
- **hit** - Plays when enemy takes damage (recoil, flinch) - does NOT loop
- **attack** - Plays when enemy attacks player (swipe, cast) - does NOT loop
- **death** - Plays when enemy HP reaches 0 (collapse, fade) - does NOT loop, one-shot

**Requirement 2: Animation Asset Structure**
- Each enemy type has 4 sprite sheet textures (idle.png, hit.png, attack.png, death.png)
- Sprite sheets follow existing atlas format (generated via Python animation pipeline)
- Metadata includes frame count, duration, FPS
- Assets stored in SwiftUI asset catalog or loaded dynamically

**Requirement 3: Animation Timing**
- **idle**: Loops indefinitely, typical duration 1-2s per cycle
- **hit**: 0.5-1s, plays once, returns to idle
- **attack**: 0.5-1s, plays once, returns to idle
- **death**: 1-2s, plays once, ends with sprite faded/hidden

**Requirement 4: Animation Triggering**
Animations trigger at specific combat events:
- Combat start → **idle** (looping)
- Player attacks enemy → **hit** (one-shot) → **idle**
- Enemy attacks player → **attack** (one-shot) → **idle**
- Enemy HP reaches 0 → **death** (one-shot, no return to idle)

### Backend Integration

**Requirement 1: Integrate EnemyChatterService into Combat Actions**
- **Current:** `CombatService.performAttack/performDefense` returns action results without dialogue
- **Required:** Call `EnemyChatterService.generateDialogue()` during each combat action
- **Event Mapping:**
  - Player attack → `player_hit` or `player_miss` event
  - Player defense → `enemy_hit` event
  - Combat start → `combat_start` event
  - HP threshold checks → `low_player_hp` or `near_victory` events
  - Combat end → `victory` or `defeat` event

**Requirement 2: Extend CombatAction API Response**
- **Current Schema:**
```typescript
{
  type: "attack",
  damageDealt: 45,
  hitZone: "crit",
  playerHpRemaining: 100,
  enemyHpRemaining: 55,
  combatStatus: "ongoing"
}
```

- **Required Schema:**
```typescript
{
  type: "attack",
  damageDealt: 45,
  hitZone: "crit",
  playerHpRemaining: 100,
  enemyHpRemaining: 55,
  combatStatus: "ongoing",
  dialogue: {  // NEW
    text: "You got lucky that time!",
    tone: "angry"
  }
}
```

**Requirement 3: Error Handling**
- If `EnemyChatterService` times out (>2s), throw `ExternalAPIError`
- **DO NOT** include generic fallback taunts in API response
- Frontend will handle missing dialogue gracefully (no display)
- Log all dialogue generation attempts for quality monitoring

**Requirement 4: Performance**
- AI generation must not block combat action response
- If generation exceeds 2s timeout, throw error and return action without dialogue
- Consider pre-generating dialogue at combat start (optional optimization)

### Frontend Integration

**Requirement 5: Update CombatAction Model**
- Add `dialogue` field to Swift `CombatAction` struct:
```swift
struct CombatAction: APIModel {
    // ... existing fields
    let dialogue: DialogueData?  // NEW - optional
}

struct DialogueData: APIModel {
    let text: String
    let tone: String
}
```

**Requirement 6: Create Enemy Sprite Animation Component**
- **Component Name:** `EnemySpriteView`
- **Location:** `New-Mystica/Views/Battle/Components/`
- **Requirements:**
  - Displays current animation frame from sprite sheet
  - Supports 4 animation states (idle, hit, attack, death)
  - Plays animations with configurable FPS (default 12-24 FPS)
  - Loops idle animation, one-shot for hit/attack/death
  - Returns to idle after non-looping animations complete
  - Callback when animation completes: `onAnimationComplete: () -> Void`
  - Uses SwiftUI `TimelineView` or `Timer` for frame updates

**Requirement 7: Create Enemy Dialogue UI Component**
- **Component Name:** `EnemyDialogueBubble`
- **Location:** `New-Mystica/Views/Battle/Components/`
- **Requirements:**
  - Speech bubble design pointing toward enemy avatar
  - Rounded rectangle with 12pt corner radius
  - Semi-transparent background (80% opacity)
  - White text, minimum 16pt font size
  - Automatic sizing based on text length (max 3 lines)
  - Fade-in animation (0.3s ease-in)
  - Auto-dismiss after 2.5 seconds with fade-out (0.5s)
  - Positioned above enemy avatar, below health bar

**Requirement 8: Integrate Animation + Dialogue into BattleView**
- Add state variables:
  - `@State var currentAnimation: AnimationState = .idle`
  - `@State var currentDialogue: DialogueData? = nil`
  - `@State var pendingDialogue: DialogueData? = nil` (for coordination)
- Display `EnemySpriteView` with `currentAnimation` binding
- Display `EnemyDialogueBubble` in enemy section when `currentDialogue != nil`
- Coordinate animation and commentary timing (see Requirement 9)

**Requirement 9: Animation + Commentary Coordination**
**Critical Flow:** Animations and commentary must run in parallel, speech bubble shows AFTER animation completes

**Implementation Pattern:**
```swift
func handlePlayerAttack() {
    // 1. Trigger animation immediately
    currentAnimation = .hit

    // 2. Make API call (includes dialogue generation in parallel)
    Task {
        let action = await combatViewModel.attack()

        // 3. Store dialogue but don't show yet
        if let dialogue = action.dialogue {
            pendingDialogue = dialogue
        }
    }

    // 4. When animation completes (via callback)
    func onHitAnimationComplete() {
        currentAnimation = .idle  // Return to idle

        // 5. Show dialogue now that animation is done
        if let dialogue = pendingDialogue {
            withAnimation {
                currentDialogue = dialogue
            }
            pendingDialogue = nil
        }
    }
}
```

**Timing Requirements:**
- **Parallel Execution:** Animation plays while API call (with AI generation) is in flight
- **Sequential Display:** Speech bubble ONLY shows after animation completes
- **Race Condition Handling:** If animation finishes before API response, wait for dialogue
- **API Timeout:** Backend throws error if AI takes >2s (no dialogue returned, animation still plays)

**Requirement 10: Commentary Timing by Event**
- **Combat Start:** Show immediately when session loads (no animation needed)
- **Player Attack:** Show after **hit** animation completes (~0.5-1s)
- **Enemy Attack:** Show after **attack** animation completes (~0.5-1s)
- **Victory/Defeat:** Show during/after **death** animation (~1-2s)
- **Frequency:** Show commentary for ALL actions (no filtering)
- **Duration:** 2.5 seconds visible + 0.5s fade-out

### UI/UX Design Specifications

**Speech Bubble Design:**
```
┌─────────────────────────────┐
│   [Enemy Health Bar]        │
│                             │
│   ╭───────────────────╮     │
│   │ "Nice try, but   │     │
│   │  I'm faster!"     │     │
│   ╰─────────┬─────────╯     │
│             ▼               │
│      [Enemy Avatar]         │
└─────────────────────────────┘
```

**Visual Specifications:**
- Background: `Color.backgroundCard` with 80% opacity
- Border: 1pt `Color.borderSubtle`
- Text: 16pt, white, bold for emphasis words
- Padding: 12pt horizontal, 8pt vertical
- Max Width: 80% of enemy section width
- Tail: Small triangle pointing to enemy (optional, can be omitted for MVP)

**Animation Specifications:**
- **Fade-In:** 0.3s ease-in-out, opacity 0 → 1, scale 0.8 → 1.0
- **Fade-Out:** 0.5s ease-out, opacity 1 → 0, scale 1.0 → 0.95
- **Transition:** Use `.transition(.asymmetric(insertion: .opacity.combined(with: .scale), removal: .opacity))`

**Tone-Based Styling (Optional Enhancement):**
| Tone       | Background Color Tint | Icon        |
|------------|-----------------------|-------------|
| confident  | Blue (accent)         | 💪          |
| angry      | Red                   | 😠          |
| mocking    | Yellow                | 😏          |
| desperate  | Orange                | 😰          |
| victorious | Green                 | 🎉          |

*Note: Tone styling is optional - can be added after MVP*

## Relevant Files

### Backend
- `mystica-express/src/services/EnemyChatterService.ts` - AI dialogue generation (fully implemented)
- `mystica-express/src/services/CombatService.ts` - Combat action handlers (needs integration)
- `mystica-express/src/types/combat.types.ts` - Type definitions (extend with DialogueResponse)
- `mystica-express/src/controllers/CombatController.ts` - API endpoints

### Frontend - Core Combat
- `New-Mystica/New-Mystica/Views/Battle/BattleView.swift` - Main combat UI (add animation/dialogue state)
- `New-Mystica/New-Mystica/Views/Battle/BattleSubviews.swift` - Enemy/player sections
- `New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift` - Combat state
- `New-Mystica/New-Mystica/Models/Combat.swift` - Combat models (extend CombatAction)

### Frontend - New Components (To Create)
- `New-Mystica/New-Mystica/Views/Battle/Components/EnemySpriteView.swift` - Sprite animation component
- `New-Mystica/New-Mystica/Views/Battle/Components/EnemyDialogueBubble.swift` - Speech bubble UI
- `New-Mystica/New-Mystica/Models/AnimationState.swift` - Animation state enum (idle/hit/attack/death)

### Animation Assets (To Generate)
- `New-Mystica/New-Mystica/Assets.xcassets/Enemies/[EnemyType]/idle.spriteatlas/` - Idle animation frames
- `New-Mystica/New-Mystica/Assets.xcassets/Enemies/[EnemyType]/hit.spriteatlas/` - Hit animation frames
- `New-Mystica/New-Mystica/Assets.xcassets/Enemies/[EnemyType]/attack.spriteatlas/` - Attack animation frames
- `New-Mystica/New-Mystica/Assets.xcassets/Enemies/[EnemyType]/death.spriteatlas/` - Death animation frames
- `scripts/` - Python animation generation pipeline (existing, may need updates for combat sprites)

## Success Criteria

### Functional Requirements - Animation
1. ✅ Enemy sprite plays **idle** animation (looping) by default
2. ✅ Enemy sprite plays **hit** animation when player attacks, returns to idle
3. ✅ Enemy sprite plays **attack** animation when enemy attacks, returns to idle
4. ✅ Enemy sprite plays **death** animation when defeated, does not loop
5. ✅ Animation and API call run in parallel (non-blocking)
6. ✅ Animation callback triggers when non-looping animation completes

### Functional Requirements - Commentary
1. ✅ Enemy commentary displays during combat start
2. ✅ Commentary updates on every player attack action
3. ✅ Commentary updates on every player defense action
4. ✅ Commentary shows on victory/defeat
5. ✅ Dialogue reflects enemy personality traits
6. ✅ Dialogue considers combat context (HP, crits, turn number)
7. ✅ Speech bubble appears AFTER animation completes (coordination)
8. ✅ Bubble auto-dismisses after 2.5 seconds
9. ✅ No commentary shown if AI generation fails/times out

### User Experience Requirements
1. ✅ Enemy sprites feel alive with smooth, contextual animations
2. ✅ Commentary is clearly readable during combat
3. ✅ Dialogue doesn't block or cover critical UI elements (health bars, dial)
4. ✅ Animations are smooth and non-jarring (proper frame timing)
5. ✅ Speech bubble timing feels natural (appears after action animation)
6. ✅ Commentary enhances immersion without feeling spammy
7. ✅ Each enemy type feels unique through dialogue and animations

### Technical Requirements
1. ✅ Enemy sprite animation system supports 4 states (idle/hit/attack/death)
2. ✅ Animation component provides completion callbacks
3. ✅ Animation runs in parallel with API call (non-blocking)
4. ✅ Speech bubble displays only after animation completes
5. ✅ API response includes dialogue in `CombatAction`
6. ✅ EnemyChatterService called during combat actions
7. ✅ No performance degradation (combat actions <2s total)
8. ✅ Error handling for AI timeouts (throw errors, no dialogue returned)
9. ✅ All dialogue attempts logged to `enemychatterlog` table
10. ✅ Swift models updated to include optional dialogue field
11. ✅ Sprite assets organized in sprite atlases per enemy type

## Implementation Notes

### Architectural Decisions

**Decision 1: Include Dialogue in Combat Action Response**
- **Rationale:** Single source of truth, eliminates race conditions, simpler frontend logic
- **Alternative Rejected:** Separate commentary API call (adds latency, complexity, sync issues)

**Decision 2: Throw Errors on AI Timeout (No Fallbacks)**
- **Rationale:** Aligns with project code quality standards (fail fast, no fallbacks)
- **Behavior:** If AI generation fails, return action without dialogue field (frontend shows no bubble)
- **Logging:** All failures logged for quality monitoring and retry analysis

**Decision 3: Show Commentary on All Actions**
- **Rationale:** Maximize personality exposure, leverage AI generation investment
- **Risk Mitigation:** If too frequent in practice, can filter client-side later
- **Future:** Consider filtering by event importance if players report spam

**Decision 4: Speech Bubble Over Enemy**
- **Rationale:** Most natural/intuitive for dialogue, doesn't consume permanent screen space
- **Alternative Rejected:** Dedicated panel (takes space), floating text (too brief)

### Dependencies

**Backend Dependencies:**
- `EnemyChatterService` (✅ already implemented)
- OpenAI API key in environment (✅ already configured)
- `CombatRepository.logChatterAttempt()` (✅ already implemented)

**Frontend Dependencies:**
- Existing `FloatingTextView` pattern for animation reference
- `CombatViewModel` action handling flow
- SwiftUI animation utilities

### Risks & Mitigations

**Risk 1: AI Generation Latency**
- **Impact:** Combat actions feel slow if waiting for AI
- **Mitigation:** 2-second timeout with error throwing, don't block action response
- **Fallback:** No dialogue displayed if generation fails (graceful degradation)

**Risk 2: Commentary Feels Spammy**
- **Impact:** Too many bubbles annoy players
- **Mitigation:** Start with all events, gather user feedback, add client-side filtering if needed
- **Future:** Settings toggle to reduce frequency

**Risk 3: UI Overlap/Occlusion**
- **Impact:** Dialogue bubble covers health bar or dial
- **Mitigation:** Careful positioning above enemy, below health bar, max-width constraint

**Risk 4: OpenAI API Costs**
- **Impact:** High volume of commentary could increase costs
- **Mitigation:** Already has 2s timeout, ~$0.0001-0.0005/comment (acceptable)
- **Monitoring:** Track costs via `enemychatterlog` analytics

## Testing Requirements

### Backend Tests
1. **Unit Tests (`CombatService.test.ts`):**
   - `attack()` includes dialogue in response when AI succeeds
   - `attack()` excludes dialogue when AI times out
   - `defend()` includes dialogue in response
   - Dialogue logged to `enemychatterlog` on success and failure

2. **Integration Tests (`combat.test.ts`):**
   - POST `/combat/:sessionId/attack` returns dialogue field
   - POST `/combat/:sessionId/defend` returns dialogue field
   - Dialogue reflects correct event type (player_hit vs player_miss)

### Frontend Tests
1. **Unit Tests (`CombatViewModelTests.swift`):**
   - `attack()` updates `currentDialogue` when action includes dialogue
   - `defend()` updates `currentDialogue` when action includes dialogue
   - Combat actions without dialogue don't crash (nil safety)

2. **Unit Tests (`EnemySpriteViewTests.swift`):**
   - Sprite plays idle animation on load (loops)
   - Sprite plays hit animation, returns to idle (one-shot)
   - Sprite plays attack animation, returns to idle (one-shot)
   - Sprite plays death animation, does not return to idle (one-shot)
   - Animation completion callback fires correctly
   - Frame timing matches expected FPS

3. **UI Tests (Manual - BattleView):**
   - **Animation Tests:**
     - Enemy sprite plays idle animation by default (looping)
     - Enemy sprite plays hit animation when player attacks
     - Enemy sprite returns to idle after hit animation completes
     - Enemy sprite plays attack animation when enemy attacks
     - Enemy sprite plays death animation on defeat
   - **Commentary Tests:**
     - Speech bubble appears on combat start
     - Speech bubble appears AFTER hit animation completes
     - Speech bubble appears AFTER attack animation completes
     - Speech bubble auto-dismisses after 2.5s
     - No bubble shown when dialogue is nil
     - Bubble doesn't overlap health bars or dial
   - **Coordination Tests:**
     - API call and animation run in parallel (no blocking)
     - Speech bubble waits for animation completion before showing
     - If API is slow (>1s), animation still plays smoothly

### Acceptance Test Scenarios

**Test 1: Full Combat Flow with Animations**
1. Start combat at a location
2. Verify enemy sprite plays **idle** animation (looping)
3. Verify enemy taunt appears immediately (combat_start)
4. Perform attack:
   - Enemy sprite plays **hit** animation
   - API call happens in parallel (non-blocking)
   - Hit animation completes, sprite returns to **idle**
   - Speech bubble appears with dialogue (player_hit/miss)
5. Perform defense:
   - Enemy sprite plays **attack** animation
   - API call happens in parallel
   - Attack animation completes, sprite returns to **idle**
   - Speech bubble appears with dialogue (enemy_hit)
6. Continue until victory → enemy plays **death** animation → verify final taunt (victory)
7. Verify all dialogue matches enemy personality (e.g., "Spray Paint Goblin" mentions art/tagging)

**Test 2: Animation/Commentary Timing**
1. Perform player attack
2. Verify hit animation starts immediately
3. Verify speech bubble does NOT appear during animation
4. Verify speech bubble appears AFTER hit animation completes
5. Verify sprite returns to idle loop
6. Time the flow: animation (~0.5-1s) → speech bubble appears → auto-dismiss (2.5s)

**Test 3: AI Timeout Handling**
1. Simulate slow OpenAI response (>2s)
2. Verify combat action completes without dialogue
3. Verify animation still plays correctly (hit → idle)
4. Verify no error shown to user
5. Verify no speech bubble appears (no dialogue)
6. Verify failure logged to `enemychatterlog`

**Test 4: Critical Hit Commentary**
1. Land critical hit on enemy
2. Verify enemy plays hit animation
3. Verify dialogue references critical/big hit
4. Verify tone is appropriate (angry/surprised)
5. Verify speech bubble appears after animation completes

**Test 5: Death Animation Flow**
1. Reduce enemy HP to near zero
2. Perform final attack
3. Verify enemy plays **death** animation (one-shot, no loop)
4. Verify final dialogue appears during/after death animation
5. Verify sprite does not return to idle (stays in death state or fades)
6. Verify combat ends properly with victory dialogue

## Open Questions & Assumptions

### Resolved
- ✅ **Q:** Should commentary show on every action or filtered?
  **A:** Show on all actions initially, filter later if spammy

- ✅ **Q:** Where to display dialogue in UI?
  **A:** Speech bubble above enemy avatar

- ✅ **Q:** How long should dialogue persist?
  **A:** 2.5 seconds visible + 0.5s fade-out

- ✅ **Q:** What happens if AI generation fails?
  **A:** Throw error, return action without dialogue, frontend shows no bubble

### Assumptions
- Players can read and comprehend commentary during fast-paced combat
- 2.5 second duration is sufficient for average dialogue length
- Speech bubble design is clear and visually distinct from other UI elements
- OpenAI API costs remain acceptable with current usage patterns
- Current enemy personality data (hardcoded 5 types) is sufficient for MVP

## Out of Scope (Future Enhancements)

### Not Included in This Feature
1. **Dialogue History Panel** - Log of all enemy comments during battle
2. **Voice Acting/Text-to-Speech** - Audio playback of commentary
3. **Player Response Options** - Dialogue choices or emotes in response
4. **Tone-Based Color Coding** - Different bubble colors per tone
5. **Enemy Portrait Images** - Visual icon next to dialogue
6. **Dialogue Customization** - User settings to adjust frequency/tone
7. **Pre-Generated Dialogue Cache** - Generate all commentary at combat start
8. **Dynamic Animation Blending** - Smooth transitions between animation states
9. **Damage Reaction Variations** - Different hit animations based on damage severity
10. **Player Sprite Animations** - Animations for player character (attack/defend/victory)

### Future Considerations
- Add settings toggle to reduce commentary frequency
- Implement tone-based visual styling (colors, icons)
- Add combat log that shows dialogue history
- Consider pre-generation optimization if latency becomes issue
- Expand personality traits for more enemy types
- A/B test commentary frequency preferences

## Related Documentation

### Investigations
- `docs/plans/combat-enemy-commentary/investigations/combat-system-investigation.md` - Full system analysis

### Existing Features
- Enemy personality system (partially implemented in `EnemyChatterService`)
- Combat visual feedback (floating damage, shakes, glows)
- Turn-based combat state machine

### Project Documentation
- `docs/ai-docs/backend.md` - Backend architecture patterns
- `docs/ai-docs/frontend.md` - SwiftUI component patterns
- `mystica-express/src/services/CLAUDE.md` - Service layer conventions
