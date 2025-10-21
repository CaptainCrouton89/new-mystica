# Implementation Plan – US-701: Load Player Data on App Startup

## Overview
- **Item ID:** US-701
- **Feature:** F-09 (Inventory Management)
- **Spec:** `docs/user-stories/US-701-load-player-data-on-startup.yaml`
- **Requirements:** `docs/plans/implement-US-701-requirements.md`
- **Investigations:**
  - `agent-responses/agent_046202.md` (Auth & Service Patterns)
  - `agent-responses/agent_214181.md` (SplashScreenView Flow)
  - `agent-responses/agent_920357.md` (Backend Equipment API)
  - `agent-responses/agent_773364.md` (SwiftUI State Management)
  - `agent-responses/agent_871691.md` (Loadout Activation)

## Problem
**Current State:** App authenticates on startup but doesn't load player equipment data. When users navigate to equipment screens, they see empty states or loading spinners while data fetches. This creates poor UX and violates the "character state immediately visible" requirement.

**Root Causes:**
1. No EquipmentService exists to fetch equipment data
2. SplashScreenView only handles auth, doesn't load game data
3. Backend EquipmentService.getEquippedItems() throws NotImplementedError
4. No error handling UI for data loading failures
5. Schema inconsistency ("offhand" vs "shield") blocks integration
6. Navigation bug (jumps to .map instead of main menu)

## Solution
**Core Approach:**
1. Implement backend GET /equipment service layer with Supabase query
2. Create SwiftUI EquipmentService singleton following AuthService pattern
3. Extend SplashScreenView to load equipment after auth, before navigation
4. Add error UI with retry button for data load failures
5. Fix schema inconsistency and navigation bug

**Key Principles:**
- **Fail-fast with retry:** Block navigation on errors, provide explicit retry mechanism
- **Single source of truth:** Backend UserEquipment table drives all state
- **Sub-2-second performance:** Parallel data loading, efficient queries
- **Graceful degradation:** New users see empty slots without crashes

## Current System

### Backend Files
- `mystica-express/src/routes/equipment.ts:19` - Route exists, calls controller
- `mystica-express/src/controllers/EquipmentController.ts:14-30` - Controller works, calls service
- `mystica-express/src/services/EquipmentService.ts:14-22` - **Service throws NotImplementedError**
- `mystica-express/src/middleware/auth.ts:44` - JWT middleware populates req.user.id
- `mystica-express/src/types/schemas.ts:11-13` - Equipment slots schema (**uses "shield" instead of "offhand"**)

### Frontend Files
- `New-Mystica/New-Mystica/Services/AuthService.swift:33-157` - Singleton service pattern to replicate
- `New-Mystica/New-Mystica/SplashScreenView.swift:58-77` - Auth flow, **no equipment loading**
- `New-Mystica/New-Mystica/New_MysticaApp.swift:34` - Environment injection point
- **Missing:** EquipmentService.swift, Equipment model, error UI

### Database
- `UserEquipment` table exists (8 slots per user)
- `v_player_equipped_stats` view available for stat aggregation
- LEFT JOIN to Items and ItemTypes needed for full equipment details

## Changes Required

### Backend

#### 1) `mystica-express/src/types/schemas.ts`: Equipment slot schema
- **Current**: Uses "shield" for offhand slot
- **Change**: Rename "shield" → "offhand" to match API contract
- **Lines**: 11-13 (EquipmentSlot type definition)
- **Impact**: Breaks existing code using "shield" (search codebase first)

#### 2) `mystica-express/src/services/EquipmentService.ts`: `getEquippedItems()`
- **Current**: Throws NotImplementedError
- **Change**: Implement Supabase query with LEFT JOIN, transform to 8-slot response
- **Pattern**: Follow ProfileService.ts:94-126
- **Code Delta**:
```typescript
async getEquippedItems(userId: string): Promise<{ slots: EquipmentSlots; total_stats: Stats }> {
  const { data, error } = await supabase
    .from('UserEquipment')
    .select(`
      slot_name,
      item_id,
      Items (
        id, level, current_stats,
        ItemTypes (name, category, equipment_slot)
      )
    `)
    .eq('user_id', userId);

  if (error) throw mapSupabaseError(error);

  // Transform to 8-slot object with null handling
  // Aggregate current_stats → total_stats
  // Return default structure if data is empty
}
```

### Frontend

#### 3) `New-Mystica/New-Mystica/Models/Equipment.swift`: Create Equipment model
- **Current**: Doesn't exist
- **Change**: Create Codable model matching backend response
- **Code Delta**:
```swift
struct Equipment: Codable {
    let slots: EquipmentSlots
    let totalStats: PlayerStats
    let equipmentCount: Int

    enum CodingKeys: String, CodingKey {
        case slots
        case totalStats = "total_stats"
        case equipmentCount = "equipment_count"
    }
}

struct EquipmentSlots: Codable {
    let weapon: PlayerItem?
    let offhand: PlayerItem?
    let head: PlayerItem?
    let armor: PlayerItem?
    let feet: PlayerItem?
    let accessory1: PlayerItem?
    let accessory2: PlayerItem?
    let pet: PlayerItem?

    enum CodingKeys: String, CodingKey {
        case weapon, offhand, head, armor, feet, pet
        case accessory1 = "accessory_1"
        case accessory2 = "accessory_2"
    }
}

struct PlayerStats: Codable {
    let atkPower: Double
    let atkAccuracy: Double
    let defPower: Double
    let defAccuracy: Double

    enum CodingKeys: String, CodingKey {
        case atkPower, atkAccuracy, defPower, defAccuracy
    }
}
```

#### 4) `New-Mystica/New-Mystica/Services/EquipmentService.swift`: Create singleton service
- **Current**: Doesn't exist
- **Change**: Create @MainActor ObservableObject following AuthService pattern
- **Code Delta**:
```swift
@MainActor
class EquipmentService: ObservableObject {
    static let shared = EquipmentService()

    @Published var equipment: Equipment?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private init() {}

    func loadEquipment() async throws {
        isLoading = true
        errorMessage = nil

        do {
            let token = KeychainService.get(key: "mystica_access_token")
            // makeRequest logic following AuthService pattern
            let response: Equipment = try await makeRequest(
                method: "GET",
                path: "/equipment",
                token: token
            )

            self.equipment = response
            self.isLoading = false
        } catch {
            self.errorMessage = "Unable to load player data. Please check your connection."
            self.isLoading = false
            throw error
        }
    }

    private func makeRequest<T: Codable>(
        method: String,
        path: String,
        token: String?
    ) async throws -> T {
        // Copy pattern from AuthService.swift:116-157
    }
}
```

#### 5) `New-Mystica/New-Mystica/SplashScreenView.swift`: Add equipment loading
- **Current**: Only handles auth, navigates to .map
- **Change**: Load equipment after auth, fix navigation, add error UI
- **Lines to modify**: 58-77 (.task block and navigation)
- **Code Delta**:
```swift
// Add state properties (line ~17)
@State private var loadingText: String = "Authenticating..."
@State private var errorMessage: String?
@EnvironmentObject var equipmentService: EquipmentService

// Modify .task block (lines 58-77)
.task {
    do {
        let hasToken = KeychainService.get(key: "mystica_access_token") != nil

        // Auth phase
        if !hasToken {
            try await authService.registerDevice()
        } else {
            try await authService.bootstrapSession()
        }

        // Data loading phase
        loadingText = "Loading player data..."
        try await equipmentService.loadEquipment()

        // Navigation (FIXED - no .map navigation)
        withAnimation(.easeInOut(duration: 0.5)) {
            isActive = true
        }
    } catch {
        errorMessage = "Unable to load player data. Please check your connection."
    }
}

// Add error UI below ProgressView (line ~49)
if let error = errorMessage {
    VStack(spacing: 16) {
        Text(error)
            .foregroundColor(.red)
            .multilineTextAlignment(.center)
            .padding()

        Button("Retry") {
            errorMessage = nil
            Task {
                // Re-run loading logic
            }
        }
        .buttonStyle(.borderedProminent)
    }
}

// Add loading text (line ~48)
if loadingText.isEmpty == false {
    Text(loadingText)
        .foregroundColor(.white)
        .padding(.top, 8)
}
```

#### 6) `New-Mystica/New-Mystica/New_MysticaApp.swift`: Inject EquipmentService
- **Current**: Only injects AuthService and NavigationManager
- **Change**: Add EquipmentService.shared to environment
- **Line**: ~34 (after .environmentObject(AuthService.shared))
- **Code Delta**:
```swift
.environmentObject(AuthService.shared)
.environmentObject(EquipmentService.shared)  // NEW
```

## Task Breakdown

| ID | Description | Agent | Deps | Files | Exit Criteria |
|----|-------------|-------|------|-------|---------------|
| **T1** | Fix schema inconsistency: "shield" → "offhand" | `backend-developer` | — | `mystica-express/src/types/schemas.ts` | • EquipmentSlot type uses "offhand"<br>• All usages updated<br>• TypeScript compiles |
| **T2** | Implement EquipmentService.getEquippedItems() | `backend-developer` | T1 | `mystica-express/src/services/EquipmentService.ts` | • Supabase query returns 8 slots<br>• Handles empty UserEquipment (new users)<br>• Aggregates total_stats correctly<br>• Returns 200 with nulls for new users |
| **T3** | Create Equipment models (Equipment, EquipmentSlots, PlayerStats) | `frontend-ui-developer` | — | `New-Mystica/New-Mystica/Models/Equipment.swift` (new file) | • All models Codable<br>• CodingKeys match backend snake_case<br>• Compiles without errors |
| **T4** | Create EquipmentService singleton | `frontend-ui-developer` | T3 | `New-Mystica/New-Mystica/Services/EquipmentService.swift` (new file) | • @MainActor singleton pattern<br>• loadEquipment() fetches from backend<br>• @Published properties for state<br>• Error handling with errorMessage |
| **T5** | Update SplashScreenView with equipment loading | `frontend-ui-developer` | T4 | `New-Mystica/New-Mystica/SplashScreenView.swift` | • Loads equipment after auth<br>• Shows loading text after 2s<br>• Error UI with retry button<br>• No navigation to .map (bug fix) |
| **T6** | Inject EquipmentService into app environment | `frontend-ui-developer` | T4 | `New-Mystica/New-Mystica/New_MysticaApp.swift` | • EquipmentService.shared in environment<br>• Available to all child views |
| **T7** | Backend integration test | `backend-developer` | T2 | `mystica-express/tests/integration/equipment.test.ts` (new) | • GET /equipment returns 200<br>• New user returns empty slots<br>• Existing user returns equipment<br>• Unauthorized returns 401 |
| **T8** | End-to-end startup test | Manual | T5, T6 | All | • App launches in <2s<br>• New user sees empty equipment<br>• Error shows retry button<br>• Retry successfully loads data |

## Parallelization

### Batch 1 (No Dependencies - Start Immediately)
**Tasks:** T1 (schema fix), T3 (frontend models)

**Execution:**
```bash
# Launch backend agent for schema fix
@agent-backend-developer T1

# Launch frontend agent for models (parallel)
@agent-frontend-ui-developer T3
```

**Notes:**
- T1 and T3 are completely independent
- Can run simultaneously to maximize speed
- T1 is critical path for backend work
- T3 is critical path for frontend work

**Estimated Time:** 15-20 minutes (parallel)

---

### Batch 2 (After Batch 1 - Backend Complete)
**Tasks:** T2 (backend service implementation)

**Dependencies:**
- **T2 depends on T1** (schema must be fixed before service can use correct types)

**Execution:**
```bash
# Wait for T1 completion
./agent-responses/await <T1_agent_id>

# Launch backend service implementation
@agent-backend-developer T2
```

**Notes:**
- T2 is solo task (no parallelization in this batch)
- Must verify T1 changes before starting
- Service implementation follows ProfileService pattern from investigation
- Must handle NULL item_id gracefully

**Estimated Time:** 30-40 minutes

---

### Batch 3 (After Batch 1 - Frontend Services)
**Tasks:** T4 (EquipmentService singleton)

**Dependencies:**
- **T4 depends on T3** (models must exist before service can use them)

**Execution:**
```bash
# Wait for T3 completion
./agent-responses/await <T3_agent_id>

# Launch frontend service implementation
@agent-frontend-ui-developer T4
```

**Notes:**
- T4 runs in parallel with T2 (backend Batch 2)
- No dependency between backend and frontend at this stage
- Service must replicate AuthService.makeRequest() pattern
- Include comprehensive error handling

**Estimated Time:** 30-40 minutes (parallel with T2)

---

### Batch 4 (After Batches 2 & 3 - Integration)
**Tasks:** T5 (SplashScreenView updates), T6 (environment injection)

**Dependencies:**
- **T5 depends on T4** (EquipmentService must exist)
- **T6 depends on T4** (EquipmentService must exist)
- **Both can wait for T2** (optional - frontend can test with mock/error responses)

**Execution:**
```bash
# Wait for frontend service (T4) to complete
./agent-responses/await <T4_agent_id>

# Launch integration tasks in parallel
@agent-frontend-ui-developer T5
@agent-frontend-ui-developer T6  # Very quick, could do manually
```

**Notes:**
- T5 and T6 can run in parallel (different files)
- T6 is trivial (single line change), may not need agent
- T5 is critical for UX (error handling, loading states)
- Navigation bug fix included in T5

**Estimated Time:** 20-30 minutes

---

### Batch 5 (After All Implementation - Testing)
**Tasks:** T7 (backend integration test), T8 (E2E manual test)

**Dependencies:**
- **T7 depends on T2** (backend service must work)
- **T8 depends on T5, T6** (full integration must be complete)

**Execution:**
```bash
# Backend test (can run while frontend Batch 4 is in progress)
@agent-backend-developer T7

# E2E manual test (after all agents complete)
# Manual execution in Xcode + backend running
```

**Notes:**
- T7 can start as soon as T2 completes (doesn't need frontend)
- T8 is manual verification (cannot automate easily)
- Both validate integration points from requirements doc

**Estimated Time:** 30-40 minutes

---

## Parallelization Summary

**Critical Path:** T1 → T2 → T7 (backend) + T3 → T4 → T5/T6 → T8 (frontend)

**Maximum Parallelism:**
- Batch 1: T1 + T3 (2 parallel agents)
- Batch 2/3: T2 + T4 (2 parallel agents)
- Batch 4: T5 + T6 (2 parallel agents, or T5 + manual T6)

**Total Estimated Time:**
- Sequential: ~3-4 hours
- With parallelization: ~1.5-2 hours

**Agent Sessions Required:** 6-7 total (some batches can merge tasks)

## Data/Schema Changes

### Database
**No migrations required** - UserEquipment table already exists from `migrations/001_initial_schema.sql`

**View Available:** `v_player_equipped_stats` - can be used for stat aggregation (optional optimization)

### API Contract
**Endpoint:** GET /equipment (api-contracts.yaml:1111-1159)

**Response Format:**
```json
{
  "slots": {
    "weapon": null | PlayerItem,
    "offhand": null | PlayerItem,
    "head": null | PlayerItem,
    "armor": null | PlayerItem,
    "feet": null | PlayerItem,
    "accessory_1": null | PlayerItem,
    "accessory_2": null | PlayerItem,
    "pet": null | PlayerItem
  },
  "total_stats": {
    "atkPower": 0,
    "atkAccuracy": 0,
    "defPower": 0,
    "defAccuracy": 0
  },
  "equipment_count": 0
}
```

**Status Codes:**
- 200: Success (even for new users with empty slots)
- 401: Unauthorized (invalid/missing JWT)
- 500: Internal server error (database failures)

### Schema Fix Impact
**File:** `mystica-express/src/types/schemas.ts:11-13`

**Before:**
```typescript
export const EQUIPMENT_SLOTS = ['weapon', 'shield', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
```

**After:**
```typescript
export const EQUIPMENT_SLOTS = ['weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet'] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
```

**Search Required:** Grep for `'shield'` usage in backend codebase before change

## Expected Result

### Observable Outcomes

1. **App Startup Flow (New User):**
   ```
   Launch app → Splash screen → "Loading player data..." (after 2s if slow)
   → Main menu visible with navigation drawer accessible
   → Navigate to equipment screen → Empty 8 slots displayed
   ```

2. **App Startup Flow (Returning User with Equipment):**
   ```
   Launch app → Splash screen → "Loading player data..." (after 2s if slow)
   → Main menu visible with character stats shown
   → Navigate to equipment screen → All equipped items displayed instantly (no loading)
   ```

3. **Error Flow:**
   ```
   Launch app → Splash screen → Network error occurs
   → Error message: "Unable to load player data. Please check your connection."
   → Retry button visible → Tap retry → Data loads successfully
   → Main menu visible
   ```

4. **Performance:**
   - **Total startup time:** <2 seconds (auth ~500ms + data load ~500-1000ms)
   - **Loading indicator:** Shown immediately
   - **Loading text:** Appears after 2 seconds (per AC)
   - **No loading states:** Equipment screen shows data instantly after splash

### Concrete Examples

**Before (Current State):**
- User opens app → sees splash → main menu appears instantly
- User navigates to equipment screen → sees loading spinner
- Equipment data loads → spinner disappears → items appear
- **Problem:** Empty state, delayed feedback

**After (US-701 Complete):**
- User opens app → sees splash with "Loading player data..." (if >2s)
- Main menu appears with equipment already loaded
- User navigates to equipment screen → items appear instantly (no spinner)
- **Improvement:** Immediate character state visibility, no empty states

**Error Handling Before:**
- Auth fails → silently caught with `try?` → app may crash or show broken state

**Error Handling After:**
- Auth fails → "Unable to load player data" error → Retry button
- Data load fails → Same error UI → Retry reloads data
- **Improvement:** Explicit failure feedback, user can recover

## Integration Points

### Backend ↔ Frontend
**Integration Point:** GET /equipment API contract

**Backend Contract (T2):**
- Endpoint: `GET /api/v1/equipment`
- Auth: Bearer token from KeychainService
- Response: Equipment JSON matching Equipment.swift model
- Status: 200 (success), 401 (unauthorized), 500 (error)

**Frontend Consumer (T4):**
- EquipmentService.loadEquipment() calls endpoint
- Decodes response into Equipment model
- Updates @Published equipment property
- Sets errorMessage on failure

**Validation (T7, T8):**
- T7: Backend integration test verifies response format
- T8: E2E test verifies frontend can decode and display

### SplashScreenView ↔ EquipmentService
**Integration Point:** Startup data loading sequence

**SplashScreenView (T5):**
- Observes `@EnvironmentObject var equipmentService`
- Calls `try await equipmentService.loadEquipment()` after auth
- Reacts to `equipmentService.errorMessage` for UI
- Blocks navigation until load succeeds

**EquipmentService (T4):**
- Exposes `@Published var equipment: Equipment?`
- Exposes `@Published var errorMessage: String?`
- Provides `loadEquipment() async throws` method
- Updates properties on main actor

**Validation (T8):**
- Manual test verifies loading sequence
- Verify error UI appears on network failure
- Verify retry button successfully reloads data

### Environment Injection
**Integration Point:** App-wide EquipmentService availability

**New_MysticaApp (T6):**
- Creates singleton: `@StateObject private var equipmentService = EquipmentService.shared`
- Injects: `.environmentObject(equipmentService)`
- Available to all child views

**Consumers:**
- SplashScreenView (T5)
- Future equipment screens (post-MVP)

## Risk Assessment

### Critical Risks

1. **Schema Mismatch Breaks Existing Code (T1)**
   - **Risk:** Changing "shield" → "offhand" may break existing references
   - **Mitigation:** Search codebase for `'shield'` usage before change
   - **Likelihood:** Medium (schema is new, likely few usages)
   - **Impact:** High (TypeScript compile errors)

2. **Backend Query Performance (T2)**
   - **Risk:** LEFT JOIN with Items + ItemTypes may be slow for large inventories
   - **Mitigation:** Use v_player_equipped_stats view if available, add indexes
   - **Likelihood:** Low (8 slots max, limited query size)
   - **Impact:** Medium (violates sub-2s performance target)

3. **Network Timeout on Slow Connections (T5, T8)**
   - **Risk:** Data load may take >10 seconds on poor network
   - **Mitigation:** Show loading text immediately, allow retry
   - **Likelihood:** Medium (mobile networks vary)
   - **Impact:** Low (error UI handles gracefully)

### Medium Risks

4. **Token Expiry During Startup (T5, T8)**
   - **Risk:** JWT in keychain may expire between launches
   - **Mitigation:** AuthService.bootstrapSession() already handles this
   - **Likelihood:** Low (30-day token expiry)
   - **Impact:** Low (re-authentication flow works)

5. **New User Returns 404 Instead of 200 (T2)**
   - **Risk:** Backend may return 404 if UserEquipment table is empty
   - **Mitigation:** Explicitly handle empty result, return default structure
   - **Likelihood:** Medium (easy to overlook)
   - **Impact:** High (violates AC "no crashes for new users")

6. **Loading Text Appears Too Late (T5)**
   - **Risk:** 2-second threshold may show text after data loads
   - **Mitigation:** Show text immediately if loading state is true
   - **Likelihood:** Medium (fast networks may load <2s)
   - **Impact:** Low (minor UX inconsistency)

### Low Risks

7. **Frontend Model Decoding Fails (T3, T4)**
   - **Risk:** Backend JSON doesn't match Swift Codable expectations
   - **Mitigation:** Use CodingKeys for snake_case mapping, test with mock data
   - **Likelihood:** Low (investigation confirmed backend format)
   - **Impact:** High (app crashes on decode failure)

8. **Navigation Bug Not Fully Fixed (T5)**
   - **Risk:** Removing .navigateTo(.map) may break other navigation
   - **Mitigation:** Test ContentView starts at MainMenuView correctly
   - **Likelihood:** Low (investigation confirmed this is a bug)
   - **Impact:** Medium (user sees wrong screen)

## Edge Cases

### 1. **New User with No Equipment (T2, T8)**
**Scenario:** User just registered via device auth, UserEquipment table has no rows

**Backend Handling (T2):**
```typescript
if (!data || data.length === 0) {
  return {
    slots: {
      weapon: null, offhand: null, head: null, armor: null,
      feet: null, accessory_1: null, accessory_2: null, pet: null
    },
    total_stats: { atkPower: 0, atkAccuracy: 0, defPower: 0, defAccuracy: 0 },
    equipment_count: 0
  };
}
```

**Frontend Handling (T5):**
- EquipmentService receives empty slots → stores in @Published equipment
- SplashScreenView navigates to main menu normally
- Equipment screen shows empty slots (no crash)

**Validation (T7, T8):**
- Integration test: Create new user, verify GET /equipment returns 200 with nulls
- E2E test: Fresh app install, verify no crash on equipment screen

### 2. **Network Timeout (T5, T8)**
**Scenario:** Slow network causes loadEquipment() to take >10 seconds

**Frontend Handling (T5):**
```swift
do {
    try await equipmentService.loadEquipment()
} catch {
    errorMessage = "Unable to load player data. Please check your connection."
    // Loading indicator remains visible
    // Retry button appears
}
```

**User Experience:**
- Loading text appears at 2 seconds ("Loading player data...")
- Timeout at 10 seconds → error message appears
- User taps Retry → clears error, retries load

**Validation (T8):**
- Simulate slow network (throttle to 3G)
- Verify loading text appears
- Verify error UI after timeout
- Verify retry works

### 3. **Token Expired Mid-Startup (T5, T8)**
**Scenario:** JWT in keychain expired between app launches

**Auth Flow Handling:**
```swift
// AuthService.bootstrapSession() returns false if token expired
if !hasToken || !(await authService.bootstrapSession()) {
    try await authService.registerDevice()  // Re-authenticate
}
```

**Expected Behavior:**
- bootstrapSession() fails → registerDevice() called
- New token obtained → equipment load succeeds
- User sees brief auth delay but no error

**Validation (T8):**
- Manually expire token in keychain
- Launch app → verify re-authentication works
- Verify equipment loads after new token

### 4. **Partial Data Load Failure (T5)**
**Scenario:** Equipment loads successfully, but future profile load fails

**Current Scope:** US-701 only loads equipment (profile is mentioned but not in AC)

**Future Handling:**
- If profile load added: Use Task.group for parallel loads
- If any load fails → show error, don't navigate
- Retry reloads ALL data, not just failed call

**Validation (T8):**
- Not applicable for current scope (equipment only)
- Document for future profile integration

### 5. **Backend Returns Malformed JSON (T4, T7)**
**Scenario:** Backend returns JSON that doesn't match Equipment model

**Frontend Handling (T4):**
```swift
do {
    let response: Equipment = try await makeRequest(...)
} catch DecodingError {
    errorMessage = "Unexpected data format. Please try again."
    throw error
}
```

**Backend Prevention (T2, T7):**
- Integration test verifies exact response format
- TypeScript types enforce correct structure
- JSON schema validation in controller (optional)

**Validation (T7):**
- Test backend response matches Equipment.swift CodingKeys
- Test new user response has correct null values

### 6. **Concurrent Equipment Updates (Post-MVP)**
**Scenario:** User equips item in another app instance while this instance is loading

**Current Scope:** Not addressed in US-701 (single-device auth)

**Future Handling:**
- WebSocket or polling for real-time updates
- Refresh equipment data on app foreground
- Optimistic UI updates with rollback on conflict

**Validation:**
- Not applicable for current scope

### 7. **Database View Unavailable (T2)**
**Scenario:** `v_player_equipped_stats` view doesn't exist or is broken

**Backend Handling (T2):**
```typescript
// Fallback: Calculate stats in service layer instead of view
const totalStats = {
  atkPower: data.reduce((sum, slot) => sum + (slot.Items?.current_stats?.atkPower || 0), 0),
  // ... other stats
};
```

**Validation (T7):**
- Test with view available (preferred)
- Test fallback logic if view missing

## Notes

### Investigation References
All implementation decisions based on:
- **agent_046202:** AuthService singleton pattern, makeRequest() implementation
- **agent_214181:** SplashScreenView extension points, navigation bug
- **agent_920357:** Backend service patterns, schema inconsistency, ProfileService example
- **agent_773364:** SwiftUI error handling patterns, @Published property recommendations
- **agent_871691:** Loadout architecture (confirms only GET /equipment needed)

### Related Tickets
- **F-09:** Inventory Management (parent feature)
- **US-302:** View equipment and stats in real-time (depends on US-701 equipment loading)
- **F-03:** Base Items & Equipment System (defines Equipment model structure)
- **F-07:** User Authentication (provides JWT token for API calls)

### Performance Targets
- **Total startup:** <2 seconds (auth + data load)
- **Auth:** ~500ms (device registration or session bootstrap)
- **Equipment load:** ~500-1000ms (GET /equipment network call)
- **Animation:** 500ms (splash → main menu transition)

### Breaking Changes
- **Schema change (T1):** "shield" → "offhand" may break existing code
  - **Action:** Search for `'shield'` usage before implementing
  - **Files to check:** Controllers, services, tests using EquipmentSlot type

### Post-MVP Enhancements
- **Profile loading:** Add profileService.loadProfile() in parallel with equipment
- **Loadout activation:** Add GET /loadouts to check active loadout (currently post-MVP per investigation)
- **Offline caching:** Store equipment in UserDefaults/SwiftData for offline viewing (if requirements change)
- **Progressive loading:** Show main menu immediately, load equipment in background with loading indicator

## Next Steps

### Ready for Execution
This plan is ready for implementation. Execute with:
```bash
/manage-project/implement/execute US-701
```

### Execution Strategy
1. **Review this plan** with user for sign-off
2. **Start Batch 1** (T1 + T3 in parallel)
3. **Wait for Batch 1** completion
4. **Start Batch 2/3** (T2 + T4 in parallel)
5. **Wait for Batch 2/3** completion
6. **Start Batch 4** (T5 + T6 in parallel or manual T6)
7. **Wait for Batch 4** completion
8. **Start Batch 5** (T7 + manual T8)
9. **Validate** all acceptance criteria met
10. **Update US-701 status** to complete in `docs/user-stories/US-701-load-player-data-on-startup.yaml`

### Success Criteria Checklist
- [ ] Backend GET /equipment returns 200 with equipment data
- [ ] Backend GET /equipment returns 200 with empty slots for new users
- [ ] Frontend EquipmentService loads equipment after auth
- [ ] SplashScreenView shows loading text after 2 seconds
- [ ] Error message + Retry button appears on failure
- [ ] Navigation goes to main menu (not map)
- [ ] Equipment screen shows data without additional loading
- [ ] Total startup time <2 seconds
- [ ] No crashes for new users with empty equipment
- [ ] Schema inconsistency resolved ("offhand" not "shield")

### Validation Gate
After all tasks complete, run validation checklist:
1. **Backend:** `pnpm test` passes (T7 integration test)
2. **Frontend:** Xcode build succeeds with no errors
3. **E2E:** Manual test (T8) passes all scenarios:
   - New user sees empty equipment
   - Returning user sees loaded equipment
   - Network error shows retry button
   - Retry successfully loads data
   - Startup time <2 seconds
4. **Acceptance Criteria:** All checkboxes in US-701 marked complete
