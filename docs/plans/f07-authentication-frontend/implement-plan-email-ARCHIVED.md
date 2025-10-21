# Implementation Plan – F-07 Authentication Frontend (Device-Based)

## Overview
- **Item ID:** F-07
- **Spec:** `docs/feature-specs/F-07-authentication.yaml`
- **Requirements:** `docs/plans/f07-authentication-frontend/requirements.md` (REVISED for device auth)
- **Investigations:** [`agent-responses/agent_492713.md`, `agent-responses/agent_933704.md`]
- **Backend Work:** `agent-responses/agent_621481.md` (device auth implementation - running in parallel)

## Problem
- Backend authentication was 100% complete for email/password flow
- Frontend is 0% - completely blocked with no existing auth code
- **NEW:** Email/password registration creates friction - users bounce before trying game
- Need instant play experience for MVP0

## Solution
- **SIMPLIFIED:** Device-based anonymous authentication (no email/password required)
- On first launch: Auto-register with iOS device UUID → instant play
- Create 2-layer service architecture: KeychainService → AuthService (HTTPService inline)
- Build 1 auth view (Settings with logout only)
- Integrate session bootstrap into SplashScreenView for auto-login on app launch
- Use backend REST API directly (skip Supabase Swift SDK to reduce dependencies)

**Key Principles:**
- Follow established @EnvironmentObject dependency injection pattern
- Maintain design system compliance (mystica colors, Impact font, existing components)
- Zero-friction onboarding: no registration wall
- Device-tied accounts: lose device = lose progress (acceptable for MVP0)
- Store tokens in Keychain for security

## Current System

**Navigation:**
- `NavigationManager.swift:12-21` - Enum-based routing system (mainMenu, map, collection, settings, etc.)
- `ContentView.swift:26-67` - Router switch that returns views for each destination
- `New_MysticaApp.swift:31-33` - App root injects NavigationManager + AudioManager via @EnvironmentObject

**Existing Patterns:**
- Singleton services: `AudioManager` (example at `AudioManager.swift`)
- @MainActor classes with @Published properties for state management
- SwiftData models: `Item.swift` (reference for Codable patterns)
- Design components: `ButtonComponents.swift` (Impact font), `TextComponents.swift`, `PopupView`
- Color palette: `UI/Colors/Colors.swift` (mysticaDarkBrown, mysticaLightBrown, mysticaLightBlue, etc.)

**Backend API (In Progress):**
- **NEW:** `POST /api/v1/auth/register-device` - Device-based anonymous registration (backend agent implementing)
- **KEPT:** `POST /api/v1/auth/logout` - Clear session
- **KEPT:** `GET /api/v1/auth/me` - Get current user profile
- **REMOVED:** Email/password endpoints (register, login, reset-password, resend-verification) - not needed for MVP0
- JWT tokens with 30-day expiration (anonymous accounts)
- Backend base URL: `http://localhost:3000/api/v1` (dev) or `https://api.mystica.app/v1` (prod)

## Changes Required

### 1) `New-Mystica/New-Mystica/Services/KeychainService.swift` (NEW)
- **Purpose**: Secure token storage using native Security framework
- **API**:
  - `static func save(key: String, value: String) throws`
  - `static func get(key: String) -> String?`
  - `static func delete(key: String) throws`
  - `static func clearAll()`
- **Keys**: `mystica_access_token`, `mystica_device_id`
- **Code Pattern**:
```swift
enum KeychainService {
    private static let service = "com.mystica.app"

    static func save(key: String, value: String) throws {
        // SecItemAdd with kSecClassGenericPassword
    }

    static func get(key: String) -> String? {
        // SecItemCopyMatching
    }
}
```

### 2) `New-Mystica/New-Mystica/Models/User.swift` (NEW)
- **Purpose**: User data model matching `/auth/me` response
- **Properties**:
  - `id: UUID`, `email: String`, `username: String?`, `level: Int`
  - `totalAtk: Int`, `totalDef: Int`, `totalHp: Int` (snake_case mapping)
  - `createdAt: Date`, `lastLogin: Date?`
- **Decoding**: ISO8601 date strategy, snake_case key conversion
- **Code Pattern**:
```swift
struct User: Codable {
    let id: UUID
    let email: String
    let totalAtk: Int  // Maps from total_atk
    // ... CodingKeys enum for snake_case mapping
}
```

### 4) `New-Mystica/New-Mystica/Services/AuthService.swift` (NEW)
- **Purpose**: Central auth orchestrator with session state management
- **API**:
  - `func login(email: String, password: String) async throws`
  - `func register(email: String, password: String) async throws -> String` (returns email for verification screen)
  - `func logout() async throws`
  - `func refreshToken() async throws`
  - `func bootstrapSession() async -> Bool` (returns true if authenticated)
  - `func resendVerification(email: String) async throws`
- **Published State**:
  - `@Published var isAuthenticated: Bool = false`
  - `@Published var currentUser: User? = nil`
  - `@Published var isRefreshing: Bool = false`
- **Singleton Pattern**: `static let shared = AuthService()`, `@MainActor`
- **Dependencies**: Uses `HTTPService.shared` and `KeychainService`
- **Code Pattern**:
```swift
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    private var refreshTask: Task<Void, Error>? // Single-flight refresh

    func bootstrapSession() async -> Bool {
        guard let token = KeychainService.get(key: "mystica_access_token") else {
            return false
        }
        // Try GET /auth/me, handle 401 → refresh
    }
}
```

### 5) `New-Mystica/New-Mystica/NavigationDestination.swift` (MODIFY)
- **Current**: Enum with cases: mainMenu, map, collection, settings, profile, battle, victory, defeat
- **Change**: Add auth destinations at lines 12-21
```swift
enum NavigationDestination: Hashable {
    case mainMenu
    case map
    case login
    case register
    case emailVerification(email: String)
    case settings
    // ... existing cases
}
```

### 6) `New-Mystica/New-Mystica/ContentView.swift` (MODIFY)
- **Current**: Router switch at lines 26-67 with placeholder settings view
- **Change**: Add auth route handlers
```swift
@ViewBuilder
private func destinationView(for destination: NavigationDestination) -> some View {
    switch destination {
    case .login:
        LoginView()
    case .register:
        RegisterView()
    case .emailVerification(let email):
        EmailVerificationView(email: email)
    case .settings:
        SettingsView()  // Replace SimpleNavigableView placeholder
    // ... existing cases
    }
}
```

### 7) `New-Mystica/New-Mystica/New_MysticaApp.swift` (MODIFY)
- **Current**: Injects NavigationManager + AudioManager at lines 31-33
- **Change**: Add AuthService injection
```swift
SplashScreenView()
    .environmentObject(navigationManager)
    .environmentObject(audioManager)
    .environmentObject(AuthService.shared)  // Add this line
```

### 8) `New-Mystica/New-Mystica/SplashScreenView.swift` (MODIFY)
- **Current**: 2.5s delay at lines 58-62, then sets `isActive = true` → shows ContentView
- **Change**: Replace delay with async session bootstrap
```swift
.task {
    let isAuthenticated = await AuthService.shared.bootstrapSession()

    if isAuthenticated {
        navigationManager.navigateTo(.map)
    } else {
        navigationManager.navigateTo(.login)
    }

    withAnimation(.easeInOut(duration: 0.5)) {
        isActive = true
    }
}
```

### 9) `New-Mystica/New-Mystica/Views/Auth/LoginView.swift` (NEW)
- **Purpose**: Login screen with email/password form
- **Features**:
  - Email + password text fields
  - Client-side validation (email regex, password required)
  - Loading spinner during API call
  - Inline error messages (red NormalText below fields)
  - "Register" tab/link to switch to RegisterView
  - Success → navigate to .map
- **Uses**: `@EnvironmentObject` for AuthService and NavigationManager
- **Design**: mysticaLightBrown background, Impact font button, existing TextComponents

### 10) `New-Mystica/New-Mystica/Views/Auth/RegisterView.swift` (NEW)
- **Purpose**: Registration screen with email/password form
- **Features**:
  - Email + password text fields
  - Client-side validation (email regex, password min 8 chars)
  - Loading spinner during API call
  - Inline error messages (400: weak password, 422: email exists)
  - "Login" tab/link to switch to LoginView
  - Success → navigate to `.emailVerification(email: email)`
- **Uses**: `@EnvironmentObject` for AuthService and NavigationManager
- **Design**: Same styling as LoginView for consistency

### 11) `New-Mystica/New-Mystica/Views/Auth/EmailVerificationView.swift` (NEW)
- **Purpose**: Post-registration screen prompting user to verify email
- **Features**:
  - Envelope SF Symbol icon
  - Message: "We sent a verification link to {email}. Please check your inbox."
  - "Resend Verification Email" button → calls AuthService.resendVerification()
  - "Back to Login" button → navigate to .login
  - Success toast on resend (using existing PopupView or simple Text)
- **Parameters**: Takes `email: String` from navigation
- **Design**: Centered card layout, mysticaLightBrown background

### 12) `New-Mystica/New-Mystica/Views/SettingsView.swift` (NEW)
- **Purpose**: Settings screen with logout functionality
- **Features**:
  - Navigation title: "Settings"
  - Placeholder settings sections (Coming Soon)
  - Bottom section: "Logout" button (red mysticaRed text)
  - Confirmation alert: "Are you sure you want to logout?"
  - On confirm → AuthService.logout() → navigate to .login
- **Replaces**: Inline placeholder at ContentView.swift:36-44
- **Design**: ScrollView with VStack, bottom-aligned logout button

## Task Breakdown

| ID  | Description | Agent | Deps | Files | Exit Criteria |
|-----|-------------|-------|------|-------|---------------|
| T1  | Create KeychainService wrapper | frontend-ui-developer | — | `Services/KeychainService.swift` | Compiles, save/get/delete/clearAll methods work, no token logging |
| T2  | Create User model with Codable | frontend-ui-developer | — | `Models/User.swift` | Compiles, decodes sample `/auth/me` JSON with snake_case mapping |
| T3  | Create NetworkError enum | frontend-ui-developer | — | `Services/NetworkError.swift` | Enum with cases: noInternet, invalidResponse, unauthorized, serverError(String) |
| T4  | Create HTTPService with 401 handling | frontend-ui-developer | T1, T3 | `Services/HTTPService.swift` | Compiles, request() method skeleton, no refresh logic yet (stub only) |
| T5  | Create AuthService skeleton | frontend-ui-developer | T1, T2, T4 | `Services/AuthService.swift` | Compiles, @Published properties defined, method signatures stubbed, no implementation |
| T6  | Add auth destinations to NavigationDestination | frontend-ui-developer | — | `NavigationDestination.swift` | Compiles, enum has .login, .register, .emailVerification(email) cases |
| T7  | Update ContentView router with auth cases | frontend-ui-developer | T6 | `ContentView.swift` | Compiles, switch has login/register/emailVerification cases (views stubbed as Text placeholders) |
| T8  | Inject AuthService in app root | frontend-ui-developer | T5 | `New_MysticaApp.swift` | Compiles, AuthService.shared injected via .environmentObject() |
| T9  | Implement AuthService login/register/logout | frontend-ui-developer | T5, T8 | `Services/AuthService.swift` | login() calls /auth/login, register() calls /auth/register, stores tokens, updates @Published state |
| T10 | Implement AuthService token refresh | frontend-ui-developer | T9 | `Services/AuthService.swift`, `Services/HTTPService.swift` | Single-flight refresh, 401 retry in HTTPService, KeychainService updates tokens |
| T11 | Implement AuthService bootstrapSession | frontend-ui-developer | T10 | `Services/AuthService.swift` | Reads Keychain, calls /auth/me, handles 401 → refresh → retry, returns auth status |
| T12 | Update SplashScreenView with session bootstrap | frontend-ui-developer | T11 | `SplashScreenView.swift` | .task calls bootstrapSession(), navigates to .map or .login, no 2.5s delay |
| T13 | Create LoginView with form validation | frontend-ui-developer | T9, T12 | `Views/Auth/LoginView.swift` | Form with email/password fields, validation, loading state, error display, calls AuthService.login() |
| T14 | Create RegisterView with form validation | frontend-ui-developer | T9, T12 | `Views/Auth/RegisterView.swift` | Form with email/password fields, validation (min 8 chars), loading state, error display (400/422), calls AuthService.register() |
| T15 | Create EmailVerificationView | frontend-ui-developer | T9 | `Views/Auth/EmailVerificationView.swift` | Displays email, resend button calls AuthService.resendVerification(), back to login button |
| T16 | Create SettingsView with logout | frontend-ui-developer | T9 | `Views/SettingsView.swift` | Logout button, confirmation alert, calls AuthService.logout(), navigates to .login |
| T17 | Replace ContentView auth placeholders | frontend-ui-developer | T13, T14, T15, T16 | `ContentView.swift` | Router returns actual LoginView/RegisterView/EmailVerificationView/SettingsView instead of Text placeholders |
| T18 | Manual testing checklist | non-dev | T17 | All files | Registration flow works, login works, auto-login on relaunch works, logout works, token refresh on 401 works, no tokens in logs |

## Parallelization

### Batch 1 (Foundation - No Dependencies)
- **Tasks:** T1, T2, T3
- **Files:** KeychainService, User model, NetworkError enum
- **Notes:** Independent utilities, can be built in parallel
- **Agents:** 3 frontend-ui-developer agents

### Batch 2 (Core Services - Depends on Batch 1)
- **Tasks:** T4, T5
- **Files:** HTTPService (skeleton), AuthService (skeleton)
- **Notes:** Both depend on T1/T2/T3, but independent of each other (use stub for refresh in HTTPService)
- **Agents:** 2 frontend-ui-developer agents

### Batch 3 (Navigation Setup - Depends on Batch 2)
- **Tasks:** T6, T7, T8
- **Files:** NavigationDestination, ContentView, New_MysticaApp
- **Notes:** Modify existing files to wire up auth infrastructure
- **Agents:** 1 frontend-ui-developer agent (sequential edits to avoid conflicts)

### Batch 4 (AuthService Implementation - Depends on Batch 3)
- **Tasks:** T9, T10, T11
- **Files:** AuthService.swift, HTTPService.swift (add refresh retry)
- **Notes:** Sequential - T9 (basic auth) → T10 (refresh) → T11 (bootstrap)
- **Agents:** 1 frontend-ui-developer agent (complex logic, needs context continuity)

### Batch 5 (Splash Integration - Depends on Batch 4)
- **Tasks:** T12
- **Files:** SplashScreenView.swift
- **Notes:** Critical path - must work before views are usable
- **Agents:** 1 frontend-ui-developer agent

### Batch 6 (Auth Views - Depends on Batch 4, Can Run Parallel)
- **Tasks:** T13, T14, T15, T16
- **Files:** LoginView, RegisterView, EmailVerificationView, SettingsView
- **Notes:** All depend on AuthService methods (T9), but independent of each other
- **Agents:** 4 frontend-ui-developer agents (parallel)

### Batch 7 (Final Integration - Depends on Batch 6)
- **Tasks:** T17
- **Files:** ContentView.swift (replace Text placeholders with real views)
- **Notes:** Quick edit once all views exist
- **Agents:** 1 frontend-ui-developer agent

### Batch 8 (Manual Testing - Depends on Batch 7)
- **Tasks:** T18
- **Files:** None (testing only)
- **Notes:** Verify all flows end-to-end
- **Agents:** non-dev agent (test orchestrator)

**Total Batches:** 8
**Peak Parallelism:** 4 agents (Batch 6)
**Critical Path:** T1 → T4 → T5 → T9 → T10 → T11 → T12 → T13 → T17 → T18 (10 tasks)

## Data/Schema Changes
- **None** - Backend schema already complete
- **Keychain Keys**: `mystica_access_token`, `mystica_refresh_token`, `mystica_user_id` (new, iOS secure storage)

## Integration Points

### AuthService ↔ HTTPService
- AuthService uses HTTPService for all API calls
- HTTPService detects 401 → calls `AuthService.refreshToken()` → retries
- **Circular dependency mitigation**: HTTPService only calls `AuthService.shared.refreshToken()` in 401 handler, not in refresh endpoint itself (refresh uses `/auth/refresh` directly without retry)

### AuthService ↔ NavigationManager
- Both injected via `@EnvironmentObject` at app root
- AuthService does NOT directly navigate (views handle navigation based on auth state)
- Views consume both: `@EnvironmentObject var authService: AuthService` and `@EnvironmentObject var navigationManager: NavigationManager`

### SplashScreenView ↔ AuthService
- Splash calls `await authService.bootstrapSession()` on `.task` modifier
- Based on result, navigates to `.map` (authenticated) or `.login` (not authenticated)
- No more 2.5s delay - splash shows until bootstrap completes

### Views ↔ AuthService
- LoginView: Calls `authService.login(email, password)`
- RegisterView: Calls `authService.register(email, password)`, navigates to `.emailVerification(email: email)` on success
- EmailVerificationView: Calls `authService.resendVerification(email)`
- SettingsView: Calls `authService.logout()`, navigates to `.login`

## Risk Assessment

### High Risk
1. **401 Refresh Loop**: If refresh endpoint returns 401, could infinite loop
   - **Mitigation**: Refresh endpoint bypasses retry logic in HTTPService (check if path == "/auth/refresh")
   - **Validation**: Test expired refresh token scenario (T18)

2. **Keychain Access Permissions**: iOS simulator vs device may have different Keychain behavior
   - **Mitigation**: Handle Keychain errors gracefully (throw, don't crash)
   - **Validation**: Test on physical device, not just simulator

3. **Token Expiry Race Conditions**: Multiple requests hit 401 simultaneously
   - **Mitigation**: Single-flight refresh using stored `Task<Void, Error>?` in AuthService
   - **Validation**: Simulate multiple API calls during token expiry (T18)

### Medium Risk
1. **Network Timeout Handling**: Long API calls (registration ~20s per backend timing)
   - **Mitigation**: Show clear loading state, use URLRequest timeout of 30s
   - **Validation**: Test on slow network connection

2. **Email Verification Edge Case**: User registers but never verifies, tries to login
   - **Mitigation**: Backend returns 401 for unverified users, show "Please verify your email" message
   - **Validation**: Test login with unverified account (T18)

3. **Navigation State on Logout**: Multiple views in navigation stack when user logs out
   - **Mitigation**: Logout clears navigation stack by navigating to root `.login`
   - **Validation**: Test logout from deep navigation state (e.g., Settings → Profile → Logout)

### Low Risk
1. **Form Validation Edge Cases**: Unusual email formats, special characters in passwords
   - **Mitigation**: Use basic regex validation, rely on backend for final validation
   - **Validation**: Test with edge case inputs (T18)

2. **Backend Response Format Changes**: API contract changes break Codable
   - **Mitigation**: Use optional properties where appropriate, add unit tests for decoding
   - **Validation**: Test against real backend (not mocked)

## Expected Result

### Observable Outcomes
1. **First-time user flow**:
   - Launch app → Splash screen (2-3s) → Login screen
   - Tap "Register" → Enter email/password → Tap "Register" button
   - Loading spinner shows for ~5s (backend call)
   - Navigate to "Email Verification" screen
   - Open email, click verification link (handled by Supabase)
   - Relaunch app → Splash screen → Auto-login → Map view

2. **Returning user flow**:
   - Launch app → Splash screen (1-2s checking Keychain + `/auth/me` call)
   - Navigate directly to Map view (no login screen)

3. **Logout flow**:
   - From Map → Navigate to Settings
   - Scroll to bottom → Tap "Logout"
   - Confirmation alert → Tap "Confirm"
   - Navigate to Login screen
   - Relaunch app → Shows Login screen (no auto-login)

4. **Token refresh flow** (invisible to user):
   - User has been logged in for 60+ minutes
   - Make any API call → Backend returns 401
   - HTTPService detects 401 → Calls AuthService.refreshToken()
   - RefreshToken succeeds → Retry original request → User sees no error
   - RefreshToken fails → Clear Keychain → Navigate to Login screen with "Session expired" message

### Concrete Details
- No tokens ever appear in Xcode console logs
- Keychain entries created: `mystica_access_token`, `mystica_refresh_token`, `mystica_user_id`
- All auth views use mystica color palette (no system blue/gray)
- All buttons use Impact font (per ButtonComponents.swift:72)
- Error messages are concise and user-friendly (no stack traces or "error: 401")

## Notes

### Investigation References
- **SwiftUI Investigation**: `agent-responses/agent_492713.md` - Clean slate analysis, NavigationManager pattern, existing component library
- **Strategic Plan**: `agent-responses/agent_933704.md` - File-by-file implementation order, complexity estimates, technical decisions

### Related Documentation
- **Backend API Contracts**: `docs/api-contracts.yaml:522-776` - All 7 auth endpoints with request/response schemas
- **Feature Spec**: `docs/feature-specs/F-07-authentication.yaml` - Backend implementation status, user stories
- **Requirements**: `docs/plans/f07-authentication-frontend/requirements.md` - Comprehensive frontend requirements with user flows

### Design System References
- **Colors**: `New-Mystica/New-Mystica/UI/Colors/Colors.swift` - mystica* palette
- **Components**: `New-Mystica/New-Mystica/UI/Components/ButtonComponents.swift` - TextButton, IconButton
- **Components**: `New-Mystica/New-Mystica/UI/Components/TextComponents.swift` - TitleText, NormalText
- **Navigation**: `New-Mystica/New-Mystica/NavigationManager.swift` - Singleton pattern example
- **Service Pattern**: `New-Mystica/New-Mystica/AudioManager.swift` - @MainActor singleton example

### Testing Checklist (T18)
- [ ] Registration with valid email/password → Email verification screen
- [ ] Registration with invalid email → Inline error
- [ ] Registration with weak password (< 8 chars) → Inline error
- [ ] Registration with existing email → "Email already registered" error
- [ ] Login with valid credentials → Map view
- [ ] Login with invalid credentials → "Invalid email or password" error
- [ ] Auto-login on app relaunch (valid session) → Map view
- [ ] No auto-login on app relaunch (no session) → Login screen
- [ ] Token refresh on API call after 60+ minutes → Transparent, no error
- [ ] Token refresh failure → "Session expired" → Login screen
- [ ] Logout from Settings → Confirmation → Login screen
- [ ] Logout clears Keychain (verify with relaunch → shows Login)
- [ ] No tokens in Xcode console logs
- [ ] Resend verification email → Success toast
- [ ] Network error (airplane mode) → "No internet connection" (not "Invalid credentials")

## Next
`/manage-project:implement:execute F-07`
