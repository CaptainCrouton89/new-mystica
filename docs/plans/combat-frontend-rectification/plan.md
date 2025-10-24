# Plan: Combat Frontend Rectification

## Summary
**Goal:** Fix critical gaps between combat screen specifications and current implementation to make it "correctly incomplete" rather than "actively wrong"

**Executive Summary:** The combat screen has solid MVVM architecture but contains fundamental implementation flaws: the timing system is completely non-functional (core feature), API models don't match backend contracts, and hardcoded values conflict with dynamic specs. This plan prioritizes fixing actively broken functionality while preserving working auto-resume and UI structure.

## Relevant Context
- Link investigations:
  - `docs/investigations/combat-frontend-specifications-analysis.md` – What combat SHOULD do according to specs
  - `docs/combat-frontend-analysis.md` – What combat ACTUALLY does in current implementation

## Investigation Artifacts
- `agent-responses/agent_376244.md` – Comprehensive combat specs analysis showing backend 100% complete, frontend 0% implemented per spec
- `agent-responses/agent_140859.md` – Current implementation analysis revealing timing system non-functional and model mismatches

## Current System Overview
The combat system has clean MVVM separation with working auto-resume functionality in `AppState.swift`, but critical implementation gaps exist:
- `BattleView.swift` renders static timing dial that doesn't respond to user interaction
- `CombatViewModel.swift` uses hardcoded timing scores (0.8) instead of dynamic dial-based scoring
- `Combat.swift` models don't match backend API response format, causing manual conversion overhead
- `TimingDialView.swift` displays zones but has no rotation, tap detection, or scoring logic

## Implementation Plan

### Tasks

- **Task 1: Fix API Model Alignment (P0 - Actively Broken)**
  - Files: `/New-Mystica/Models/Combat.swift`, `/New-Mystica/Repositories/DefaultCombatRepository.swift`
  - Depends on: none
  - Risks/Gotchas: Breaking changes to existing view model integration
  - Agent: junior-engineer
  - **Issue:** CombatStartResponse manually converted to CombatSession with missing fields filled by defaults, causing state inconsistencies
  - **Fix:** Align Swift models with actual backend API contracts from specs analysis
  - **Success Criteria:** No manual model conversion needed, all API fields properly mapped

- **Task 2: Remove Non-Functional Timing System (P0 - Actively Broken)**
  - Files: `/New-Mystica/Views/Combat/TimingDialView.swift`, `/New-Mystica/ViewModels/CombatViewModel.swift`
  - Depends on: none
  - Risks/Gotchas: UI will look incomplete but shouldn't claim to work when it doesn't
  - Agent: junior-engineer
  - **Issue:** TimingDialView renders as if functional but doesn't spin, respond to taps, or calculate scores
  - **Fix:** Replace with placeholder state that clearly indicates "timing feature not implemented"
  - **Success Criteria:** No misleading UI elements that appear interactive but aren't

- **Task 3: Replace Hardcoded Values with Clear Placeholders (P1 - Architectural Mismatch)**
  - Files: `/New-Mystica/ViewModels/CombatViewModel.swift`
  - Depends on: 2
  - Risks/Gotchas: Combat balance may change but should be clearly documented as placeholder
  - Agent: junior-engineer
  - **Issue:** All actions use hardcoded timing score 0.8, HP calculated with `defPower * 10` formula
  - **Fix:** Replace with documented placeholder values and TODO comments explaining what should happen
  - **Success Criteria:** No magic numbers, clear comments about intended dynamic behavior

- **Task 4: Fix Session State Management (P1 - Architectural Mismatch)**
  - Files: `/New-Mystica/ViewModels/CombatViewModel.swift`, `/New-Mystica/AppState.swift`
  - Depends on: 1
  - Risks/Gotchas: Auto-resume functionality currently works and should be preserved
  - Agent: junior-engineer
  - **Issue:** Frontend creates sessions vs backend auto-resume flow, status enum mismatches
  - **Fix:** Align session lifecycle with backend approach while preserving working auto-resume
  - **Success Criteria:** Session state consistent between frontend and backend expectations

- **Task 5: Clean Up Misleading UI Components (P2 - Cleanup)**
  - Files: `/New-Mystica/Views/Combat/CombatActionButton.swift`, `/New-Mystica/Views/Combat/BattleView.swift`
  - Depends on: 2, 3
  - Risks/Gotchas: May reduce visual polish but improves honesty about current capabilities
  - Agent: junior-engineer
  - **Issue:** UI suggests timing-based gameplay that doesn't exist, static animations with no purpose
  - **Fix:** Simplify to basic attack/defend buttons, remove timing-related UI elements until functional
  - **Success Criteria:** UI honestly reflects current limited functionality

- **Task 6: Document Implementation Boundaries (P2 - Cleanup)**
  - Files: `/New-Mystica/Views/Combat/BattleView.swift`, `/docs/plans/combat-frontend-rectification/implementation-status.md`
  - Depends on: 1, 2, 3, 4, 5
  - Risks/Gotchas: None - documentation only
  - Agent: junior-engineer
  - **Issue:** No clear indication what works vs what's incomplete vs what's broken
  - **Fix:** Add comments and create status document clearly categorizing all combat functionality
  - **Success Criteria:** Developers can immediately understand current implementation status and limitations

### Data/Schema Impacts
- **API Model Changes:** Swift models will be updated to match backend response format exactly
- **No Database Changes:** All fixes are frontend-only alignment with existing backend
- **State Management:** Session lifecycle alignment may affect how AppState tracks combat sessions

## Priority Levels
- **P0 (Critical):** Fix actively broken functionality that conflicts with specs
- **P1 (Important):** Resolve architectural mismatches that create confusion
- **P2 (Nice to Have):** Clean up misleading elements and improve documentation

## Success Criteria
- No hardcoded values masquerading as dynamic behavior
- No UI elements that appear functional but aren't
- API models align with backend contracts without manual conversion
- Clear documentation of what works, what's incomplete, and what's intentionally simplified
- Combat screen is "correctly incomplete" - limited functionality honestly represented