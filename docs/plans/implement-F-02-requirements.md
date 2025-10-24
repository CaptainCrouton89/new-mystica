# Implementation Requirements – F-02 Combat System Frontend

## Source Specification
- **Item ID:** F-02
- **Spec:** `docs/feature-specs/F-02-combat-system.yaml`
- **Status:** investigation-in-progress
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

## Investigation Status

**Active Investigations (4 agents running in parallel):**

1. **Agent 761891** - SwiftUI View Architecture & Navigation Patterns
   - View structure conventions
   - Navigation approach for combat screen
   - State management patterns
   - API integration patterns
   - Animation examples

2. **Agent 627586** - Combat API Integration & Data Models
   - Combat endpoint signatures
   - Data model definitions (Combat, Enemy, CombatSession)
   - APIClient usage patterns
   - Existing combat code (if any)

3. **Agent 165314** - UI Components & Design System
   - Reusable components (buttons, bars, modals)
   - Color/typography conventions
   - Animation patterns
   - Haptic feedback examples

4. **Agent 764140** - Dial Mechanics Technical Deep Dive
   - Circular/rotation code patterns
   - Tap-to-degrees conversion strategy
   - Animation timing approach
   - Visual rendering recommendations

**Investigation results will be consolidated below once agents complete.**

---

## Investigation Findings

### Existing Patterns
_[To be filled after agent investigations complete]_

### Integration Points Discovered
_[To be filled after agent investigations complete]_

### Constraints & Dependencies
_[To be filled after agent investigations complete]_

## Edge Cases & Error Handling
_[To be filled during investigation]_

- **Session expiry (15min TTL):** [behavior TBD]
- **App backgrounding mid-combat:** Use GET /combat/session/:id to resume
- **Network timeout during attack:** [retry strategy TBD]
- **Invalid tap position:** [validation approach TBD]

## Implementation-Specific Decisions
_[To be determined after investigation]_

## Implementation Scope

**In this phase:**
- [ ] Combat screen UI with dial visualization
- [ ] Turn-based flow (player → enemy alternation)
- [ ] HP bar display and updates
- [ ] Tap detection → degrees conversion
- [ ] API integration (start, attack, complete)
- [ ] Result screen with rewards
- [ ] Haptic feedback on hits
- [ ] 60fps dial animation

**Deferred:**
- Defense dial (if not in MVP0)
- Additional dial patterns (dual_arcs, pulsing_arc, etc. - post-MVP)
- Enemy chatter integration (F-12)
- Pet chatter integration (F-11)
- Combat session auto-resume on launch

## Success Criteria (beyond spec acceptance criteria)

- [ ] Dial animation maintains 60fps on iPhone 15 Pro simulator
- [ ] Tap-to-degrees calculation accurate within ±1 degree
- [ ] API response time < 500ms for attack/defend calls
- [ ] HP bar updates smoothly (no jank)
- [ ] Haptic feedback triggers correctly for each zone type
- [ ] Screen transitions feel polished (no abrupt jumps)

## Relevant Files
_[To be populated after investigation]_

---

## Next Steps

1. **Wait for investigation agents to complete** (4 agents running)
2. **Consolidate findings** into this document
3. **Ask clarifying questions** based on investigation gaps
4. **Create implementation plan** with task breakdown
5. **Execute implementation** with validation

**Investigation started:** 2025-10-23
**Expected completion:** ~5-10 minutes (parallel execution)
