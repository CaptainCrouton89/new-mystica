# Plan: Fix Combat Session Decoding Errors Between Backend API and Swift Frontend

## Summary
**Goal:** Eliminate the 100% failure rate of combat session decoding errors in Swift by fixing data structure mismatches between backend API and frontend models.

**Executive Summary:** The Swift frontend is experiencing constant "The data couldn't be read because it is missing" errors when decoding combat sessions due to three primary issues: (1) PostgreSQL TABLE function returning array format causes `adjusted_bands` to be nested under "0" index, (2) backend returns `number` types while Swift expects `Int` for degree values, and (3) field name mismatches between API response and Swift model properties. This plan addresses all mismatches to achieve 100% successful combat session decoding.

## Relevant Context
- Investigation findings: `@agent-responses/agent_886816.md` – Root cause analysis of API response transformation
- Feature Spec: Combat system degree-based measurement requirements
- Database Schema: Weapons table with NUMERIC degree columns (flat structure)

## Investigation Artifacts
- `@agent-responses/agent_886816.md` – Complete investigation of response transformation path, identified PostgreSQL TABLE function array return as root cause of "0" key nesting

## Current System Overview
Current combat flow hits decoding errors at every API call:
- `CombatService.startCombat()` (mystica-express/src/services/CombatService.ts:237-242) returns weapon_config with adjusted_bands
- `WeaponRepository.getAdjustedBands()` (mystica-express/src/repositories/WeaponRepository.ts:262-281) calls PostgreSQL function `fn_weapon_bands_adjusted`
- Supabase returns PostgreSQL TABLE function results as array format: `[{deg_injure: 3.98, ...}]`
- Backend accesses first array element with `data[0]` but returns the array to Swift
- Swift `AdjustedBands` model (New-Mystica/New-Mystica/Models/Combat.swift:115-131) expects flat structure, not array
- `CombatViewModel` (New-Mystica/New-Mystica/ViewModels/CombatViewModel.swift:69,101) calls `fetchCombatSession()` after every combat action, failing 100% of the time

## Implementation Plan

### Tasks

#### Task 1: Fix Backend adjusted_bands Array Structure
- **What and Why:** Modify WeaponRepository.getAdjustedBands() to return the first array element as a flat object instead of the array, fixing the "0" key nesting issue
- **Files:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/repositories/WeaponRepository.ts` (lines 270-281)
- **Depends on:** none
- **Risks/Gotchas:** PostgreSQL TABLE functions always return arrays from Supabase; must handle empty results properly
- **Agent:** junior-engineer

#### Task 2: Fix Backend Number to Int Type Conversion
- **What and Why:** Add type conversion in CombatService to ensure degree values are integers and total_degrees is never null, matching Swift Int expectations
- **Files:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/CombatService.ts` (lines 237-242), `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/repositories/WeaponRepository.ts` (lines 275-276)
- **Depends on:** Task 1
- **Risks/Gotchas:** Must ensure total_degrees calculation never results in null; verify NUMERIC database values convert to integers correctly
- **Agent:** junior-engineer

#### Task 3: Fix Backend CombatSession Field Mapping
- **What and Why:** Update CombatService response to include missing fields (player_id, enemy_id, status, player_stats) and map field names to match Swift expectations (turn_count → turnNumber, whose_turn → currentTurnOwner)
- **Files:** `/Users/silasrhyneer/Code/new-mystica/mystica-express/src/services/CombatService.ts` (lines 237-242)
- **Depends on:** Task 2
- **Risks/Gotchas:** May require adding new service methods to fetch player/enemy stats; ensure status field has valid enum values
- **Agent:** programmer

#### Task 4: Update Swift CombatSession Model for Compatibility
- **What and Why:** Verify Swift CombatSession model handles the corrected API response structure and add any missing property mappings
- **Files:** `/Users/silasrhyneer/Code/new-mystica/New-Mystica/Models/Combat.swift` (lines 22-48, 115-131)
- **Depends on:** Task 3
- **Risks/Gotchas:** SwiftData may require migration if model structure changes significantly; ensure CodingKeys mapping is correct
- **Agent:** junior-engineer

#### Task 5: Add Integration Tests for Combat Session Decoding
- **What and Why:** Create backend API tests and Swift unit tests to verify end-to-end combat session decoding works correctly and prevent regression
- **Files:** Create new test files in `mystica-express/src/tests/` and `New-Mystica/New-MysticaTests/`
- **Depends on:** Task 4
- **Risks/Gotchas:** Must test actual API response format, not just TypeScript types; Swift tests need proper test data setup
- **Agent:** programmer

#### Task 6: Validate Combat Flow End-to-End
- **What and Why:** Test complete combat session flow from startCombat → fetchCombatSession → attack/defense actions to ensure no decoding errors occur
- **Files:** Manual testing using existing combat UI and API endpoints
- **Depends on:** Task 5
- **Risks/Gotchas:** Must test on actual device/simulator with real API calls; verify no errors in console logs
- **Agent:** junior-engineer

### Data/Schema Impacts
- **Database:** No migration required - PostgreSQL function `fn_weapon_bands_adjusted` already returns correct flat structure
- **API Contract:**
  - **Breaking change:** `adjusted_bands` changes from `{"0": {deg_injure: number, ...}}` to `{deg_injure: number, ...}` (flat structure)
  - **Field additions:** CombatSession adds `player_id`, `enemy_id`, `status`, `player_stats` fields
  - **Field renames:** `turn_count` → `turnNumber`, `whose_turn` → `currentTurnOwner`
  - **Type changes:** All degree values convert from `number` to `number` (rounded to integers), `total_degrees` never null