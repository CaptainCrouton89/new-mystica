# Implementation Plan – Combat Auto-Resume

## Overview
- **Feature:** Combat session persistence and auto-resume functionality
- **Requirements:** Check for active combat sessions on app launch and automatically resume if found
- **Current State:** Backend fully implemented, frontend missing auto-resume logic
- **Missing:** Abandon combat API endpoint

## Problem
- Users lose combat progress when app is backgrounded or closed
- No mechanism to resume interrupted combat sessions
- No abandon combat option for players who want to exit without completing

## Solution
- Add active session check to app launch sequence after auth restoration
- Implement auto-navigation to combat screen when active session exists
- Create abandon combat API endpoint and frontend integration
- Handle session expiry gracefully with user feedback

## Current System

### Backend (Fully Implemented)
- **Session Management:** `CombatRepository.ts` with 15-minute TTL
- **Recovery Endpoint:** `GET /combat/session/:session_id` returns full session state
- **User Session Query:** `getUserActiveSession(userId)` method available
- **Cleanup:** `deleteSession(sessionId)` method for abandoning sessions

### Frontend (Investigation Results)
- **App Entry:** `New_MysticaApp.swift` with auth restoration in `onAppear`
- **Navigation:** `NavigationManager.swift` with `.battle` destination
- **Combat State:** `CombatViewModel.swift` manages session state
- **Existing Retreat:** `retreat()` function calls server completion with `won: false`

## Changes Required

### 1) Backend: `src/routes/combat.ts` + `src/controllers/CombatController.ts`
- **Current**: No abandon endpoint, only complete with result
- **Change**: Add `POST /combat/abandon` endpoint
- **Code Delta**:
```ts
// Route
router.post('/abandon', authenticate, validate({ body: AbandonCombatSchema }), combatController.abandonCombat);

// Controller method
async abandonCombat(req: Request, res: Response) {
  await combatService.abandonCombat(req.body.session_id);
  res.json({ message: 'Combat session abandoned' });
}

// Service method
async abandonCombat(sessionId: string): Promise<void> {
  await this.combatRepository.deleteSession(sessionId);
}
```

### 2) Frontend: `New_MysticaApp.swift`
- **Current**: Only restores auth session on launch
- **Change**: Add combat session check after auth restoration
- **Code Delta**:
```swift
.onAppear {
    Task {
        await appState.restoreAuthSession()
        if appState.isAuthenticated {
            await checkAndResumeActiveCombat()
        }
    }
}

private func checkAndResumeActiveCombat() async {
    // Check for active session and navigate to battle if found
}
```

### 3) Frontend: `AppState.swift`
- **Current**: Manages auth, profile, currencies
- **Change**: Add combat session state management
- **Code Delta**:
```swift
// Add combat session state
var activeCombatSession: Loadable<CombatSession?> = .idle

func checkActiveCombatSession() async {
    // Call API to check for user's active session
}
```

### 4) Frontend: `CombatViewModel.swift`
- **Current**: Has retreat() function
- **Change**: Add abandon combat functionality
- **Code Delta**:
```swift
func abandonCombat() async {
    guard case .loaded(let session) = combatState else { return }

    do {
        try await repository.abandonCombat(sessionId: session.sessionId)
        resetCombat()
    } catch {
        // Handle error
    }
}
```

### 5) Frontend: `DefaultCombatRepository.swift`
- **Current**: Has fetchCombatSession method
- **Change**: Add getUserActiveSession and abandonCombat methods

## Task Breakdown

| ID | Description | Agent | Deps | Files | Exit Criteria |
|----|-------------|-------|------|-------|---------------|
| T1 | Add abandon combat API endpoint | backend-developer | — | `routes/combat.ts`, `controllers/CombatController.ts`, `types/schemas.ts` | `POST /combat/abandon` endpoint returns 200 |
| T2 | Add getUserActiveSession to frontend repository | — | — | `DefaultCombatRepository.swift`, `CombatRepository.swift` | Method calls backend and returns session or nil |
| T3 | Add combat session state to AppState | — | — | `AppState.swift` | AppState tracks active combat session |
| T4 | Implement app launch session check | — | T2,T3 | `New_MysticaApp.swift` | App checks for active session after auth |
| T5 | Add navigation logic for auto-resume | — | T4 | `New_MysticaApp.swift`, `NavigationManager.swift` | App navigates to battle when active session found |
| T6 | Add abandon combat to CombatViewModel | — | T1 | `CombatViewModel.swift` | Abandon button calls API and resets state |
| T7 | Add abandon combat to repository | — | T1 | `DefaultCombatRepository.swift` | Repository method calls abandon endpoint |
| T8 | Handle session expiry scenarios | — | T2,T3 | `AppState.swift`, error handling | Expired sessions handled gracefully |

## Parallelization

### Batch 1 (no deps)
- **Tasks:** T1, T2, T3
- **Notes:** Backend API endpoint can be developed while frontend state management is added

### Batch 2 (after Batch 1)
- **Tasks:** T4, T6, T7
- **Notes:** App launch logic depends on state management; abandon functionality depends on API endpoint

### Batch 3 (after Batch 2)
- **Tasks:** T5, T8
- **Notes:** Navigation and error handling integrate all previous components

## Data/Schema Changes
- **API:** New `POST /combat/abandon` endpoint with session_id body parameter
- **Frontend Models:** No schema changes, using existing CombatSession model

## API Contract Addition

### POST /combat/abandon
**Request:**
```json
{
  "session_id": "uuid"
}
```

**Response:**
```json
{
  "message": "Combat session abandoned"
}
```

**Errors:** 404 if session not found, 401 if unauthorized

## Expected Result

### App Launch Scenarios
1. **No Active Session:** Normal app launch → main menu/map
2. **Active Session Found:** Auto-resume combat → navigate to battle screen with restored state
3. **Expired Session:** Graceful handling → notify user session expired, continue normal flow

### Combat Session Management
- **Abandon Button:** Players can exit combat early, session is deleted from backend
- **Session Persistence:** Combat survives app backgrounding/killing within 15-minute TTL
- **State Restoration:** HP, turn count, enemy data all restored correctly

## Validation Criteria

### Backend Testing
- `POST /combat/abandon` with valid session → 200 response, session deleted
- `POST /combat/abandon` with invalid session → 404 error
- `GET /combat/session/:id` after abandon → 404 error

### Frontend Testing
- App launch with no active session → normal flow
- App launch with active session → auto-navigate to battle
- App launch with expired session → graceful fallback
- Abandon button in combat → returns to map, session cleaned up
- Combat state restoration → correct HP, enemy, turn count displayed

## Integration Points

### NavigationManager Integration
- New `resumeCombat()` method to navigate to battle with session context
- Existing `navigateToBattle()` method may need session parameter override

### CombatViewModel Integration
- Session restoration via existing `combatState` property
- Integration with existing `resetCombat()` method for abandon flow

### Error Handling
- Network failures during session check
- Invalid/corrupted session data
- Auth failures during session restoration

## Risk Assessment

### Low Risk
- Backend API endpoint (simple CRUD operation)
- Frontend repository methods (similar to existing patterns)

### Medium Risk
- App launch timing (ensuring auth completes before session check)
- Navigation state management (coordinating multiple navigation triggers)

### High Risk
- Session state corruption (malformed data from server)
- Race conditions during app launch (multiple async operations)

## Notes
- MVP0 scope: Basic auto-resume, no sophisticated session recovery UI
- Session TTL is 15 minutes (900 seconds) - consider user notification before expiry
- Abandon functionality reuses existing `deleteSession` backend method
- Consider analytics tracking for session resume success/failure rates

## Next
Execute implementation in batches, starting with backend API endpoint and frontend state management foundations.