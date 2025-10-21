# US-701: Load Player Data on App Startup - Requirements Document

**Story ID:** US-701
**Feature:** F-09 (Inventory Management)
**Investigation Date:** 2025-10-21
**Status:** Requirements Complete - Ready for Planning

## Original Specification Summary

### User Story
**As a** returning player
**I want** my equipment, loadout, and inventory data to load automatically when I open the app
**So that** I can see my character's current state immediately without manual refreshes or waiting for screens to load

### Acceptance Criteria
- [x] Equipment (8 slots) fetched from GET /equipment and cached locally after auth
- [ ] Active loadout loaded and applied (post-MVP)
- [x] Clear error message with Retry button on failure
- [x] Empty equipment slots for new users without crashes
- [x] Loading indicator with status text after 2 seconds ("Loading player data...")
- [x] Equipment screen displays all items without additional loading states after transition

---

## User Decisions & Clarifications

### 1. **Data Loading Strategy**
**Decision:** All data (equipment + profile) required before navigation to main menu
**Rationale:** Ensures complete hydration before user interaction, prevents empty states
**Performance Target:** Sub-2-second total startup time (auth + data load)

### 2. **Error Handling Approach**
**Decision:** Block navigation, show error message with retry button on splash screen
**Rationale:** Explicit failure feedback better than partial state or silent errors
**Pattern:** Error text + "Retry" button below loading indicator

### 3. **Caching Strategy**
**Decision:** NO offline caching - local state (@Published properties) only
**Rationale:** Backend is source of truth, no persistence to UserDefaults/SwiftData
**Implication:** Network call required on every app startup

### 4. **Loading Text Updates**
**Decision:** Single message "Loading player data..." (not granular per-phase)
**Rationale:** Simplifies UX, startup should be fast enough to not need phase breakdown
**Display Trigger:** Show after 2 seconds of loading (per AC)

### 5. **New User Handling**
**Decision:** Backend GET /equipment checks if user is new, returns empty slots with 200 (not 404)
**Response:** `{ slots: { weapon: null, ... }, total_stats: { atkPower: 0, ... } }`
**No Auto-Init:** Do NOT call POST /profile/init automatically during startup

### 6. **Loadout Activation** (Answer from Investigation)
**Decision:** Only call GET /equipment during startup
**Rationale:** PUT /loadouts/{id}/activate copies LoadoutSlots → UserEquipment, so GET /equipment already reflects active loadout
**Post-MVP:** Loadouts are post-MVP feature, not required for MVP0 startup flow

### 7. **Performance Expectations**
**Target:** Sub-2-second total (auth + data load)
**Breakdown:** Auth ~500ms, equipment/profile parallel load ~500-1000ms
**Loading Indicator:** Shown immediately, text appears at 2s threshold

---

## Investigation Findings

### Frontend (SwiftUI)

#### AuthService Pattern (agent_046202)
**Location:** `New-Mystica/New-Mystica/Services/AuthService.swift:33-157`

**Singleton Implementation:**
```swift
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    private init() {}
}
```

**Environment Injection:**
```swift
// New_MysticaApp.swift:34
.environmentObject(AuthService.shared)
```

**Async Method Pattern:**
```swift
func registerDevice() async throws {
    let response: DeviceRegistrationResponse = try await makeRequest(
        method: "POST",
        path: "/auth/register-device",
        body: requestBody
    )

    // Update state on main actor
    self.currentUser = response.user
    self.isAuthenticated = true
}
```

**Key Findings:**
- **No @Published isLoading or error properties** - errors thrown via `async throws`
- **MainActor synchronization** - allows direct assignment to @Published properties
- **Token storage:** KeychainService for secure JWT storage
- **Best effort patterns:** logout() catches/ignores network errors

#### SplashScreenView Flow (agent_214181)
**Location:** `New-Mystica/New-Mystica/SplashScreenView.swift:58-77`

**Current Flow:**
```swift
.task {
    // Step 1: Check for token
    let hasToken = KeychainService.get(key: "mystica_access_token") != nil

    // Step 2: Auth flow
    if !hasToken {
        try? await authService.registerDevice()  // ~500ms
    } else {
        _ = await authService.bootstrapSession()  // instant
    }

    // Step 3: Navigation (BUGGY - navigates to .map, not main menu)
    navigationManager.navigateTo(.map)

    // Step 4: UI transition
    withAnimation(.easeInOut(duration: 0.5)) {
        isActive = true
    }
}
```

**Extension Points for US-701:**
- **Line 68-70:** Perfect insertion point for equipment/profile loading (between auth and navigation)
- **Add @State var loadingText:** For dynamic loading message
- **Add @State var errorMessage:** For error display
- **Remove .navigateTo(.map):** Let ContentView start at MainMenuView normally

**Current Limitations:**
- Auth errors silently caught with `try?` - no user-facing error UI
- No loading text feedback
- Navigation bug: jumps to map instead of showing main menu

#### SwiftUI State Management (agent_773364)
**Patterns Found:**

**@Published Property Updates:**
- Services marked `@MainActor` allow direct assignment without `MainActor.run`
- State updates happen atomically after successful network operations

**Error Handling:**
- Current: Services throw errors, views handle in catch blocks
- **Recommendation:** Hybrid approach - @Published error for UI + throwing for programmatic handling

**Loading States:**
- No dynamic loading messages in current codebase
- **Recommendation:** `@Published var loadingMessage: String` updated throughout async operations

**Retry Pattern:**
- No retry implementations found
- **Recommendation:** Clear error state before retry, use Task blocks in button actions

### Backend (Express + TypeScript)

#### Equipment API Status (agent_920357)
**Location:** `mystica-express/src/routes/equipment.ts:19`, `src/controllers/EquipmentController.ts:14-30`

**Implementation Status:** ✅ Route and Controller exist, ❌ Service throws NotImplementedError

**Controller Pattern:**
```typescript
getEquipment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;  // From JWT middleware

    const equipment = await equipmentService.getEquippedItems(userId);

    res.json({
      slots: equipment.slots,
      total_stats: equipment.total_stats,
      equipment_count: Object.keys(equipment.slots).filter(slot =>
        equipment.slots[slot as keyof typeof equipment.slots] !== null
      ).length
    });
  } catch (error) {
    next(error);
  }
};
```

**Service Implementation Needed:**
```typescript
// Pattern from ProfileService.ts:94-126
async getEquippedItems(userId: string): Promise<{ slots: EquipmentSlots; total_stats: Stats }> {
  const { data, error } = await supabase
    .from('UserEquipment')
    .select(`
      slot_name,
      item_id,
      Items!inner(...)
    `)
    .eq('user_id', userId);

  if (error) throw mapSupabaseError(error);

  // Transform to 8-slot equipment object + calculate total_stats
}
```

**Auth Middleware:**
- JWT validation via `supabase.auth.getClaims()` (RS256/ECC)
- Fallback to `verifyAnonymousToken()` for device-based auth
- `req.user.id` populated by `middleware/auth.ts:44`

**Error Response Format:**
```typescript
{
  error: {
    code: 'missing_token',
    message: 'Missing or invalid authorization header',
    details?: error?.message  // Optional in non-production
  }
}
```

**Empty State Handling:**
- Return 200 with all slots as `null` for new users
- UserEquipment table may have no rows → initialize default response
- Database view `v_player_equipped_stats` available for stat aggregation

**Critical Issue Found:**
- **Schema inconsistency:** API contract uses "offhand", schemas.ts uses "shield"
- **Must resolve before implementation**

#### Loadout Activation Behavior (agent_871691)
**Answer to Question 6:** Option B is correct

**API Specification (api-contracts.yaml:1337-1367):**
```yaml
/loadouts/{loadout_id}/activate:
  put:
    summary: Activate loadout (F-09)
    description: Copies LoadoutSlots to UserEquipment, sets is_active=true.
                 Deactivates other loadouts.
```

**Architecture Comment (api-contracts.yaml:23-27):**
> Equipment System Architecture:
> - UserEquipment table tracks current equipped items per slot (single source of truth)
> - Loadouts table stores saved equipment configurations
> - LoadoutSlots table stores item assignments for each loadout

**Implication for US-701:**
- **Only GET /equipment needed** - UserEquipment already reflects active loadout
- **No GET /loadouts required** during startup (post-MVP feature)
- **Activation process:** PUT /loadouts/{id}/activate → syncs to UserEquipment → GET /equipment shows result

---

## Technical Constraints from Codebase

### Frontend (SwiftUI)

1. **Singleton Pattern Required:**
   - EquipmentService MUST use `@MainActor class EquipmentService: ObservableObject`
   - Static shared instance: `static let shared = EquipmentService()`
   - Private initializer to enforce singleton

2. **Environment Injection:**
   - Add `@StateObject private var equipmentService = EquipmentService.shared` to New_MysticaApp.swift
   - Inject via `.environmentObject(equipmentService)` at ContentView level
   - Consume with `@EnvironmentObject var equipmentService: EquipmentService` in views

3. **Published Properties:**
   - `@Published var equipment: Equipment?` (Equipment model with 8 slots)
   - `@Published var totalStats: PlayerStats?`
   - `@Published var loadingMessage: String = ""` (for dynamic updates)
   - `@Published var errorMessage: String?` (for error display)

4. **Error Handling:**
   - Hybrid approach: throw errors from async methods + set @Published errorMessage
   - Allow programmatic error handling + UI state reactivity

5. **Navigation Flow Fix:**
   - Remove `navigationManager.navigateTo(.map)` from SplashScreenView:71
   - Let ContentView start at MainMenuView naturally
   - User manually navigates to map after seeing main menu

### Backend (Express + TypeScript)

1. **Service Layer Implementation:**
   - Implement `EquipmentService.getEquippedItems(userId: string)`
   - Follow ProfileService pattern (mystica-express/src/services/ProfileService.ts:94-126)
   - Use Supabase query builder with LEFT JOIN for NULL handling

2. **Database Query:**
   - Query UserEquipment table with JOIN to Items and ItemTypes
   - Handle empty result (new user) → return default 8-slot structure with nulls
   - Use `v_player_equipped_stats` view for stat aggregation

3. **Error Response Format:**
   - Use AppError classes (AuthenticationError, NotFoundError, DatabaseError)
   - Call `mapSupabaseError(error)` for database errors
   - Return standard Error schema from api-contracts.yaml:497-509

4. **New User Response:**
   ```json
   {
     "slots": {
       "weapon": null,
       "offhand": null,
       "head": null,
       "armor": null,
       "feet": null,
       "accessory_1": null,
       "accessory_2": null,
       "pet": null
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

5. **Schema Inconsistency Resolution:**
   - **CRITICAL:** Resolve "offhand" (API contract) vs "shield" (schemas.ts) mismatch
   - **Recommendation:** Use "offhand" per API contract, update schemas.ts

---

## Data Flow

### Startup Sequence (Happy Path)
```
App Launch
  ↓
SplashScreenView visible
  ↓
.task {} executes
  ↓
[1] Check KeychainService for token (~5ms)
  ↓
[2] Auth flow (~500ms)
    - New user: authService.registerDevice()
    - Returning: authService.bootstrapSession()
  ↓
[3] Parallel data load (~500-1000ms)
    - equipmentService.loadEquipment() → GET /equipment
    - profileService.loadProfile() → GET /profile (if needed)
  ↓
[4] Navigation transition (~500ms animation)
    - isActive = true
    - ContentView appears at MainMenuView
  ↓
User sees main menu with fully loaded equipment state
```

### Error Flow
```
Auth or Data Load Fails
  ↓
Catch block in .task {}
  ↓
Set @State var errorMessage = "Unable to load player data"
  ↓
Display error text below ProgressView
  ↓
Show "Retry" button
  ↓
User taps Retry
  ↓
Clear errorMessage
  ↓
Re-run data loading in Task { ... }
```

### Backend Flow (GET /equipment)
```
Request arrives with Bearer token
  ↓
Auth middleware validates JWT (auth.ts:44)
  ↓
req.user.id populated
  ↓
EquipmentController.getEquipment() called
  ↓
equipmentService.getEquippedItems(userId)
  ↓
Supabase query: UserEquipment LEFT JOIN Items LEFT JOIN ItemTypes
  ↓
Transform result:
  - Map slot_name → equipment slots
  - Aggregate current_stats → total_stats
  - Handle NULL item_id → null in response
  ↓
Controller adds equipment_count
  ↓
Return JSON response
```

---

## Integration Points

### 1. **SplashScreenView ↔ EquipmentService**
- **File:** `New-Mystica/New-Mystica/SplashScreenView.swift:68-70`
- **Integration:** Call `await equipmentService.loadEquipment()` after auth, before navigation
- **State:** Observe `@EnvironmentObject var equipmentService: EquipmentService`
- **Error Handling:** Catch errors, set errorMessage, show retry button

### 2. **New_MysticaApp ↔ EquipmentService**
- **File:** `New-Mystica/New-Mystica/New_MysticaApp.swift:34`
- **Integration:** Add `.environmentObject(EquipmentService.shared)` after AuthService
- **Lifecycle:** Singleton lives for app lifetime

### 3. **EquipmentService ↔ Backend API**
- **Endpoint:** `GET /equipment` (api-contracts.yaml:1111-1159)
- **Request:** `Authorization: Bearer <token>` from KeychainService
- **Response:** Equipment slots + total_stats
- **Network Layer:** Use AuthService.makeRequest() pattern (AuthService.swift:116-157)

### 4. **Backend Controller ↔ Service ↔ Database**
- **Controller:** `mystica-express/src/controllers/EquipmentController.ts:14-30`
- **Service:** `mystica-express/src/services/EquipmentService.ts` (needs implementation)
- **Database:** UserEquipment table + v_player_equipped_stats view
- **Error Mapping:** `mapSupabaseError()` utility

---

## Success Criteria (from US-701 Acceptance Criteria)

### Must Have (MVP0)
- [ ] GET /equipment implemented in backend service layer
- [ ] EquipmentService.swift created following AuthService pattern
- [ ] Equipment data loaded during splash screen (after auth, before navigation)
- [ ] Loading indicator shows "Loading player data..." after 2 seconds
- [ ] Error message + Retry button on failure
- [ ] New users see empty equipment slots without crashes
- [ ] Equipment screen shows data without additional loading states
- [ ] Sub-2-second total startup time (auth + data load)

### Post-MVP
- [ ] Active loadout loading (GET /loadouts, filter is_active: true)
- [ ] Profile data loading (GET /profile) integrated into startup
- [ ] Offline caching strategy (if requirements change)

---

## Edge Cases & Gotchas

### 1. **New User with No Equipment**
- **Scenario:** User just registered, never equipped anything
- **Backend Response:** 200 with all slots null, total_stats zeros
- **Frontend Handling:** Display empty equipment UI, no crash
- **Don't Do:** Call POST /profile/init automatically

### 2. **Network Timeout**
- **Scenario:** Slow network, data load takes >10 seconds
- **Handling:** Show error after timeout, allow retry
- **UX:** Loading indicator visible entire time, text appears at 2s

### 3. **Token Expired During Startup**
- **Scenario:** JWT in keychain expired, auth fails
- **Handling:** AuthService.bootstrapSession() fails, registerDevice() called
- **Flow:** Auth error → register new device → retry data load

### 4. **Partial Data Load Failure**
- **Scenario:** Equipment loads, but profile fails (or vice versa)
- **Handling:** Show generic "Unable to load player data" error
- **Retry:** Re-attempts both calls, not just failed one

### 5. **Schema Mismatch (offhand vs shield)**
- **Critical:** API contract says "offhand", schemas.ts says "shield"
- **Resolution:** Update schemas.ts to match API contract before implementation
- **Impact:** Backend response won't match frontend model without fix

### 6. **Navigation Bug**
- **Current:** SplashScreenView navigates to .map instead of main menu
- **Fix:** Remove navigationManager.navigateTo(.map) call
- **Verify:** ContentView starts at MainMenuView after splash

### 7. **Auth Errors Silently Ignored**
- **Current:** `try? await authService.registerDevice()` swallows errors
- **Fix:** Use proper do-catch, surface auth errors to user
- **UX:** Show specific error messages for auth vs data load failures

---

## File References from Investigation

### Frontend Files
- `New-Mystica/New-Mystica/Services/AuthService.swift:33-157` - Service pattern to replicate
- `New-Mystica/New-Mystica/SplashScreenView.swift:58-77` - Extension point for data loading
- `New-Mystica/New-Mystica/New_MysticaApp.swift:34` - Environment injection point
- `New-Mystica/New-Mystica/Models/User.swift:10-30` - User model structure
- `New-Mystica/New-Mystica/Services/KeychainService.swift` - Token storage pattern

### Backend Files
- `mystica-express/src/routes/equipment.ts:19` - Route definition (exists)
- `mystica-express/src/controllers/EquipmentController.ts:14-30` - Controller (exists, working)
- `mystica-express/src/services/EquipmentService.ts:14-22` - Service (NotImplementedError)
- `mystica-express/src/services/ProfileService.ts:94-126` - Pattern to follow
- `mystica-express/src/middleware/auth.ts:44` - JWT validation middleware
- `mystica-express/src/types/schemas.ts:11-13` - Equipment slots schema (needs "offhand" fix)
- `mystica-express/src/utils/errors.ts` - AppError classes

### Database
- `mystica-express/migrations/001_initial_schema.sql` - UserEquipment table definition
- View: `v_player_equipped_stats` - Stat aggregation helper

### API Documentation
- `docs/api-contracts.yaml:1111-1159` - GET /equipment spec
- `docs/api-contracts.yaml:23-27` - Equipment architecture comment
- `docs/api-contracts.yaml:1337-1367` - Loadout activation spec

---

## Open Questions (Resolved)

✅ **Q1:** Should equipment + profile load in parallel or sequentially?
**A:** Parallel (fastest approach, no dependency between them)

✅ **Q2:** Error recovery strategy?
**A:** Block navigation, show retry button on splash screen

✅ **Q3:** Caching scope?
**A:** No offline caching, local state only

✅ **Q4:** Loading state granularity?
**A:** Single "Loading player data..." message

✅ **Q5:** New user profile creation?
**A:** Do NOT auto-call POST /profile/init, backend returns empty state

✅ **Q6:** Loadout activation meaning?
**A:** Only GET /equipment needed (UserEquipment already synced by activation endpoint)

✅ **Q7:** Performance expectations?
**A:** Sub-2-second target (fast network calls acceptable)

---

## Next Steps

### Investigation Phase Complete ✅
- [x] 5 parallel agents investigated patterns, integrations, constraints
- [x] All findings consolidated into this requirements document
- [x] User decisions clarified and documented
- [x] Technical constraints identified

### Ready for Planning Phase
This requirements document provides complete context for:
1. Creating detailed implementation plan
2. Breaking down tasks by component (frontend/backend)
3. Identifying dependencies and parallel work opportunities
4. Estimating effort and complexity

**Handoff Command:**
```bash
/manage-project:implement:plan US-701
```

The planning agent will use this requirements document plus all investigation artifacts in `agent-responses/` to create a step-by-step implementation plan.
