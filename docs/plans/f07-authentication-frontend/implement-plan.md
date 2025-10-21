# Implementation Plan – F-07 Authentication Frontend (Device-Based Auth)

## Overview
- **Item ID:** F-07
- **Spec:** `docs/feature-specs/F-07-authentication.yaml`
- **Requirements:** `docs/plans/f07-authentication-frontend/requirements.md` (OUTDATED - was email/password)
- **Investigations:** [`agent-responses/agent_492713.md` (SwiftUI arch), `agent-responses/agent_933704.md` (original email/password plan)]
- **Backend Work:** `agent-responses/agent_621481.md` (device auth implementation - running in parallel)

## Problem
- **Original Plan:** Email/password auth with registration wall (creates friction)
- **User Impact:** Users bounce before trying game - registration is a barrier to entry
- **Need:** Instant play experience for MVP0 - no forms, no verification, just play

## Solution
- **SIMPLIFIED:** Device-based anonymous authentication using iOS device UUID
- On first launch: Auto-register device ID → get JWT token → navigate to map → instant play
- **No email/password, no forms, no verification** - zero friction onboarding
- Create minimal auth infrastructure: KeychainService → AuthService (inline HTTP calls)
- Build 1 view: SettingsView with logout button only
- Integrate auto-registration into SplashScreenView

**Key Principles:**
- Zero-friction onboarding: no registration wall
- Device-tied accounts: lose device = lose progress (acceptable for MVP0)
- Store tokens in Keychain for security
- Follow existing @EnvironmentObject pattern (NavigationManager, AudioManager)
- Maintain design system compliance (mystica colors, Impact font)

## Current System

**Navigation:**
- `NavigationManager.swift:12-21` - Enum routing (mainMenu, map, collection, settings, etc.)
- `ContentView.swift:26-67` - Router switch returns views
- `New_MysticaApp.swift:31-33` - App root injects services via @EnvironmentObject

**Existing Patterns:**
- Singleton services: `AudioManager.swift` (@MainActor, @Published properties)
- Design system: `UI/Colors/Colors.swift` (mystica* palette), `ButtonComponents.swift` (Impact font)

**Backend API (In Progress - agent_621481):**
- **NEW:** `POST /api/v1/auth/register-device` - Auto-register device, return 30-day JWT
- **KEPT:** `POST /api/v1/auth/logout` - Clear session (best effort)
- **KEPT:** `GET /api/v1/auth/me` - Get user profile (for future features)

## Changes Required

### 1) `New-Mystica/New-Mystica/Services/KeychainService.swift` (NEW)
- **Purpose**: Secure token + device ID storage
- **API**:
  - `static func save(key: String, value: String) throws`
  - `static func get(key: String) -> String?`
  - `static func delete(key: String) throws`
  - `static func clearAll()`
- **Keys**: `mystica_access_token`, `mystica_device_id`
- **~120 LOC**

### 2) `New-Mystica/New-Mystica/Models/User.swift` (NEW - SIMPLIFIED)
- **Purpose**: Minimal user model for device accounts
- **Properties**:
  - `id: UUID`
  - `deviceId: String` (device_id from backend)
  - `accountType: String` (always "anonymous" for MVP0)
  - `vanityLevel: Int`, `avgItemLevel: Float` (for game stats)
- **Decoding**: ISO8601 dates, snake_case conversion
- **~50 LOC**

### 3) `New-Mystica/New-Mystica/Services/AuthService.swift` (NEW - SIMPLIFIED)
- **Purpose**: Device auth orchestrator (NO email/password methods)
- **API**:
  - `func registerDevice() async throws` - Auto-register with device UUID
  - `func logout() async throws` - Call backend, clear Keychain
  - `func bootstrapSession() async -> Bool` - Check Keychain for token, validate if exists
- **Published State**:
  - `@Published var isAuthenticated: Bool = false`
  - `@Published var currentUser: User? = nil`
- **HTTP calls**: Inline URLSession (no separate HTTPService needed)
- **Singleton Pattern**: `static let shared`, `@MainActor`
- **~200 LOC** (simpler than original 300+ LOC plan)

**Code Pattern:**
```swift
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()
    private let baseURL = "http://localhost:3000/api/v1"

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    func registerDevice() async throws {
        let deviceId = UIDevice.current.identifierForVendor!.uuidString
        // POST /auth/register-device with { device_id }
        // Store token + device_id in Keychain
        // Set isAuthenticated = true
    }

    func bootstrapSession() async -> Bool {
        guard let token = KeychainService.get(key: "mystica_access_token") else {
            return false
        }
        // Optionally: GET /auth/me to validate token
        // For MVP0: Just trust token exists = authenticated
        self.isAuthenticated = true
        return true
    }

    func logout() async throws {
        // POST /auth/logout (best effort, ignore errors)
        KeychainService.clearAll()
        self.isAuthenticated = false
        self.currentUser = nil
    }
}
```

### 4) `New-Mystica/New-Mystica/SplashScreenView.swift` (MODIFY)
- **Current**: 2.5s delay, then shows ContentView
- **Change**: Check Keychain for token, register if missing, navigate to map
```swift
.task {
    let hasToken = KeychainService.get(key: "mystica_access_token") != nil

    if !hasToken {
        try? await AuthService.shared.registerDevice()
    } else {
        _ = await AuthService.shared.bootstrapSession()
    }

    navigationManager.navigateTo(.map)  // Always go to map (authenticated)

    withAnimation(.easeInOut(duration: 0.5)) {
        isActive = true
    }
}
```

### 5) `New-Mystica/New-Mystica/New_MysticaApp.swift` (MODIFY)
- **Current**: Injects NavigationManager + AudioManager
- **Change**: Add AuthService
```swift
SplashScreenView()
    .environmentObject(navigationManager)
    .environmentObject(audioManager)
    .environmentObject(AuthService.shared)  // Add this
```

### 6) `New-Mystica/New-Mystica/Views/SettingsView.swift` (NEW)
- **Purpose**: Settings screen with logout button
- **Features**:
  - Title: "Settings"
  - Placeholder sections (Coming Soon)
  - Bottom: "Logout" button (red mysticaRed text)
  - Confirmation alert: "Logging out will delete your account. Are you sure?"
  - On confirm: `await authService.logout()` → navigate to `.map` → triggers re-registration on next splash
- **~100 LOC**

### 7) `New-Mystica/New-Mystica/ContentView.swift` (MODIFY)
- **Current**: Settings route shows placeholder SimpleNavigableView
- **Change**: Replace with SettingsView
```swift
case .settings:
    SettingsView()  // Replace SimpleNavigableView
```

## Task Breakdown

| ID  | Description | Agent | Deps | Files | Exit Criteria |
|-----|-------------|-------|------|-------|---------------|
| T1  | Create KeychainService wrapper | frontend-ui-developer | — | `Services/KeychainService.swift` | Compiles, save/get/delete/clearAll work, no logging |
| T2  | Create simplified User model | frontend-ui-developer | — | `Models/User.swift` | Compiles, has device auth properties (deviceId, accountType) |
| T3  | Create AuthService with device auth | frontend-ui-developer | T1, T2 | `Services/AuthService.swift` | registerDevice(), logout(), bootstrapSession() implemented, inline HTTP calls work |
| T4  | Inject AuthService in app root | frontend-ui-developer | T3 | `New_MysticaApp.swift` | AuthService.shared injected via .environmentObject() |
| T5  | Update SplashScreenView with auto-register | frontend-ui-developer | T3, T4 | `SplashScreenView.swift` | Calls registerDevice() if no token, navigates to .map, no 2.5s delay |
| T6  | Create SettingsView with logout | frontend-ui-developer | T3 | `Views/SettingsView.swift` | Logout button, confirmation alert, calls authService.logout() |
| T7  | Replace ContentView settings placeholder | frontend-ui-developer | T6 | `ContentView.swift` | Router returns SettingsView instead of SimpleNavigableView |
| T8  | Manual testing | non-dev | T7 | All files | First launch auto-registers, relaunch uses token, logout works, no tokens in logs |

## Parallelization

### Batch 1 (Foundation)
- **Tasks:** T1, T2 (parallel)
- **Agents:** 2 frontend-ui-developer agents

### Batch 2 (Core Service)
- **Tasks:** T3 (depends on T1, T2)
- **Agents:** 1 frontend-ui-developer agent

### Batch 3 (Integration)
- **Tasks:** T4, T5, T6 (parallel, all depend on T3)
- **Agents:** 3 frontend-ui-developer agents

### Batch 4 (Finalization)
- **Tasks:** T7 (depends on T6)
- **Agents:** 1 frontend-ui-developer agent

### Batch 5 (Testing)
- **Tasks:** T8 (depends on T7)
- **Agents:** 1 non-dev agent

**Total Batches:** 5
**Peak Parallelism:** 3 agents (Batch 3)
**Critical Path:** T1 → T3 → T5 → T7 → T8 (5 tasks)
**Total Tasks:** 8 (down from 18 in email/password plan)

## Data/Schema Changes
- **Backend:** device_id column, account_type enum (handled by backend agent)
- **Keychain Keys**: `mystica_access_token`, `mystica_device_id` (new)

## Integration Points

### AuthService ↔ NavigationManager
- Both injected via @EnvironmentObject at app root
- No complex navigation logic - always goes to .map after auth
- SettingsView uses navigationManager after logout (navigate back to .map, triggers re-register)

### SplashScreenView ↔ AuthService
- Splash checks Keychain for existing token
- If no token: calls `registerDevice()`
- If token exists: calls `bootstrapSession()` (just sets isAuthenticated = true)
- Always navigates to .map

### SettingsView ↔ AuthService
- Logout button calls `authService.logout()`
- Clears Keychain (including token + device_id)
- Navigates to .map → Next splash will re-register (new device_id)

## Risk Assessment

### High Risk
1. **Device ID Changes**: iOS may regenerate identifierForVendor if app is reinstalled
   - **Impact**: User loses progress
   - **Mitigation**: Document this limitation, acceptable for MVP0
   - **Future**: Add "Link Email" feature to migrate device account

2. **Token Expiry (30 days)**: User doesn't open app for 30+ days
   - **Impact**: Token expired, backend returns 401
   - **Mitigation**: Treat 401 same as no token → auto-register (new account, progress lost)
   - **Alternative**: Extend token to 90 days (backend decision)

### Medium Risk
1. **Keychain Simulator vs Device**: Different behavior on physical devices
   - **Mitigation**: Handle Keychain errors gracefully (log warning, continue)
   - **Validation**: Test on physical device

2. **Backend Unavailable on First Launch**: Network error during registerDevice()
   - **Mitigation**: Show "No internet connection" error, retry button
   - **Validation**: Test airplane mode on first launch

### Low Risk
1. **Logout Deletes Progress**: User taps logout by accident
   - **Mitigation**: Confirmation alert with clear warning
   - **Validation**: Manual test (T8)

## Expected Result

### Observable Outcomes

**First Launch (New User):**
1. Launch app → Splash screen (1-2s)
2. Auto-register device → Store token in Keychain
3. Navigate to Map view → Start playing immediately
4. No forms, no emails, no verification

**Subsequent Launches (Returning User):**
1. Launch app → Splash screen (1s)
2. Check Keychain → Token exists
3. Navigate to Map view → Continue playing

**Logout Flow:**
1. From Map → Navigate to Settings
2. Scroll to bottom → Tap "Logout"
3. Confirmation alert: "Logging out will delete your account. Are you sure?"
4. Tap "Yes" → Keychain cleared
5. Navigate back to Map → Splash auto-registers (new account)

### Concrete Details
- No tokens ever logged to console
- Keychain entries: `mystica_access_token`, `mystica_device_id`
- All views use mystica color palette
- Logout button uses mysticaRed color
- Settings uses existing SimpleNavigableView pattern (ScrollView + VStack)

## Notes

### Removed from Original Plan
- ❌ LoginView (no email/password forms)
- ❌ RegisterView (no email/password forms)
- ❌ EmailVerificationView (no verification needed)
- ❌ HTTPService (inline URLSession in AuthService instead)
- ❌ NetworkError enum (simple error handling)
- ❌ Token refresh logic (30-day tokens don't need refresh)
- ❌ Form validation (no forms)

### Investigation References
- **SwiftUI Investigation**: `agent-responses/agent_492713.md` - Clean slate, NavigationManager pattern
- **Original Plan**: `agent-responses/agent_933704.md` - Email/password strategy (now simplified)

### Related Documentation
- **Backend Work**: `agent-responses/agent_621481.md` - Device auth implementation (in progress)
- **API Contracts**: Will be updated after backend complete
- **Feature Spec**: Will be updated by documentor agent after implementation

### Testing Checklist (T8)
- [ ] First launch auto-registers device (no user interaction)
- [ ] Token + device_id stored in Keychain
- [ ] Second launch uses existing token (no re-registration)
- [ ] Logout clears Keychain
- [ ] After logout, relaunch creates new account
- [ ] No tokens in Xcode console logs
- [ ] Network error on first launch shows error message
- [ ] Settings view displays correctly
- [ ] Logout confirmation alert shows correct warning

### Future: Email Linking (Post-MVP0)
- Add "Link Email" button in Settings
- New endpoint: `POST /auth/link-email { email, password }`
- Backend migrates device account to email account
- Enable multi-device support + account recovery
- **NOT in scope for current implementation**

## Next
`/manage-project:implement:execute F-07`

**Note:** Wait for backend agent (agent_621481) to complete device auth before executing frontend tasks.
