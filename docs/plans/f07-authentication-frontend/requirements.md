# Requirements: F-07 Authentication Frontend (OUTDATED)

> **⚠️ NOTE:** This requirements document is outdated. The implementation strategy has changed to device-based anonymous authentication.
>
> **See:** `docs/plans/f07-authentication-frontend/implement-plan.md` for current simplified approach.
>
> **Summary of Change:**
> - **Original:** Email/password with registration wall
> - **New:** Device UUID auto-registration, instant play
> - **Rationale:** Zero-friction onboarding for MVP0

[Original requirements below, archived for reference]

---

## Overview
**Purpose:** Implement complete SwiftUI authentication frontend to integrate with existing F-07 backend API endpoints. Enable secure user registration, login, email verification, and persistent session management using Supabase Auth.

**User Benefit:** Players can create accounts, securely log in, and maintain persistent sessions across app launches without repeated authentication. Email verification ensures account security.

**Problem:** Backend authentication is 60% complete (all 7 API endpoints implemented) but frontend is completely blocked. No SwiftUI views, no Supabase SDK integration, no session management, and no secure token storage exist.

**Related Documentation:**
- `docs/feature-specs/F-07-authentication.yaml` - Backend implementation and API contracts
- `docs/product-requirements.yaml` - MVP0 authentication requirements
- `docs/system-design.yaml` - Overall system architecture
- `docs/api-contracts.yaml` - REST API specifications
- `agent-responses/agent_492713.md` - SwiftUI codebase investigation findings

### Edge Cases
- **No network connection:** Show clear "No internet connection" error, don't show "Invalid credentials"
- **Email not verified:** Block app access, show "Please verify your email" message with resend option
- **Session expired during use:** Attempt silent token refresh; if refresh fails, show "Session expired, please login" and redirect to login
- **App killed mid-registration:** User can complete registration on next launch (backend already has account)
- **Token refresh failure on launch:** Clear stored session and redirect to login screen
- **Weak password submission:** Show inline validation before API call (min 8 characters per backend requirement)
- **Email already registered:** Show clear error message from backend 422 response

## Functional Requirements

### User Interactions

#### First Launch (No Session)
1. Show splash screen with loading indicator (placeholder graphic for MVP0)
2. Check for stored session tokens in Keychain
3. If no session found, navigate to login/register screen
4. User chooses "Login" or "Register" tab/toggle

#### Registration Flow
1. User enters email and password in form fields
2. Client validates format:
   - Email: Basic RFC 5322 format check
   - Password: Minimum 8 characters (backend requirement)
3. User taps "Register" button
4. Show loading spinner (blocking for ~20s per backend auth endpoint timing)
5. On success:
   - Store `access_token` and `refresh_token` in Keychain
   - Show "Email verification sent" screen with:
     - Message: "Check your email to verify your account"
     - "Resend verification" button
     - "Back to login" button
6. On error:
   - Show error message below form (400: weak password, 422: email exists)
   - Keep form populated

#### Login Flow
1. User enters email and password
2. Client validates format (same as registration)
3. User taps "Login" button
4. Show loading spinner
5. On success:
   - Store tokens in Keychain
   - Navigate to map view
6. On error:
   - Show "Invalid email or password" (400 error)
   - Clear password field, keep email populated

#### Session Persistence (App Relaunch)
1. Show splash screen with loading indicator
2. Check Keychain for `access_token`
3. If token exists:
   - Call backend `GET /api/v1/auth/me` with token in Authorization header
   - On success (200): Navigate to map view
   - On 401 (expired): Attempt token refresh with `refresh_token`
     - If refresh succeeds: Navigate to map view
     - If refresh fails: Clear Keychain, navigate to login
4. If no token: Navigate to login/register screen

#### Email Verification Handling
1. User opens verification link from email (handled by Supabase)
2. On next app launch, `GET /api/v1/auth/me` will return user data
3. If email not verified, backend returns 401 (Supabase enforces verification)
4. Show "Please verify your email" screen with resend button

#### Logout
1. User navigates to Settings view (via NavigationManager)
2. Taps "Logout" button at bottom of settings screen
3. Show confirmation dialog: "Are you sure you want to logout?"
4. On confirm:
   - Call `POST /api/v1/auth/logout` with current access token
   - Clear all tokens from Keychain
   - Reset any local app state
   - Navigate to login screen

### Data Requirements

#### Stored in Keychain (Secure)
- `access_token` (String, required) - JWT token, expires in 1 hour
- `refresh_token` (String, required) - Used to obtain new access token
- `user_id` (String/UUID, optional) - Cache for offline checks

#### User Model (from backend response)
```swift
struct User: Codable {
    let id: UUID
    let email: String
    let username: String?
    let level: Int
    let totalAtk: Int  // total_atk from backend
    let totalDef: Int  // total_def
    let totalHp: Int   // total_hp
    let createdAt: Date
    let lastLogin: Date?
}
```

#### Validation Rules
- **Email:**
  - Required
  - Must match regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (basic RFC 5322)
  - Show error: "Please enter a valid email address"
- **Password (Registration):**
  - Required
  - Minimum 8 characters (backend enforces this)
  - Show error: "Password must be at least 8 characters"
- **Password (Login):**
  - Required (no client-side rules, backend validates)

### API Requirements

All endpoints already implemented in backend (F-07 spec:98-106). Frontend calls:

#### 1. Registration
- **Endpoint:** `POST /api/v1/auth/register`
- **Request:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response (200):**
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "session": {
      "access_token": "jwt...",
      "refresh_token": "jwt..."
    }
  }
  ```
- **Errors:**
  - 400: Invalid email or weak password → Show: "Invalid email or password too weak"
  - 422: Email already registered → Show: "An account with this email already exists"
- **Headers:** `Content-Type: application/json`

#### 2. Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Request:** Same as registration
- **Response (200):** Same as registration
- **Errors:**
  - 400: Invalid credentials → Show: "Invalid email or password"
- **Headers:** `Content-Type: application/json`

#### 3. Get Current User
- **Endpoint:** `GET /api/v1/auth/me`
- **Request:** None (token in header)
- **Response (200):**
  ```json
  {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "level": 1,
    "total_atk": 10,
    "total_def": 5,
    "total_hp": 100,
    "created_at": "2025-10-21T00:00:00Z",
    "last_login": "2025-10-21T00:00:00Z"
  }
  ```
- **Errors:**
  - 401: Unauthorized (invalid/expired token) → Attempt token refresh
- **Headers:** `Authorization: Bearer {access_token}`

#### 4. Token Refresh
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Request:**
  ```json
  {
    "refresh_token": "jwt..."
  }
  ```
- **Response (200):**
  ```json
  {
    "access_token": "new_jwt...",
    "refresh_token": "new_refresh_jwt..."
  }
  ```
- **Errors:**
  - 401: Invalid refresh token → Clear session, redirect to login
- **Headers:** `Content-Type: application/json`

#### 5. Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- **Request:** None
- **Response (200):**
  ```json
  {
    "success": true
  }
  ```
- **Errors:** None (best effort, even if fails client clears local session)
- **Headers:** `Authorization: Bearer {access_token}`

#### 6. Resend Verification Email
- **Endpoint:** `POST /api/v1/auth/resend-verification`
- **Request:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response (200):**
  ```json
  {
    "message": "Verification email sent"
  }
  ```
- **Errors:** None shown to user (security: don't reveal if email exists)
- **Headers:** `Content-Type: application/json`

### UI Requirements

#### Design System Compliance
- **Colors:** Use existing palette from `UI/Colors/Colors.swift`
  - Background: `mysticaDarkBrown`
  - Forms/cards: `mysticaLightBrown`
  - Primary buttons: `mysticaLightBlue`
  - Error text: `mysticaRed`
  - Success text: `mysticaGreen`
- **Typography:**
  - Buttons: Impact font (per `ButtonComponents.swift:72`)
  - Body text: System font
  - Use existing `TitleText` and `NormalText` components
- **Components:** Use existing UI library
  - `TextButton` for primary actions
  - `PopupView` for error dialogs (or inline errors - implementation choice)
  - `IconButton` if icons needed

#### Screen Layouts

**1. Splash Screen** (existing, needs session check integration)
- Center: Mystica logo placeholder
- Bottom: Loading spinner
- Duration: Until session check completes (~500ms-2s)

**2. Login/Register Screen**
- Top: Title "Mystica" (TitleText component)
- Tabbed or toggle interface: "Login" | "Register"
- Form fields (both tabs):
  - Email text field (email keyboard)
  - Password secure field (show/hide toggle icon)
  - Error message area (red text, hidden when no error)
- Primary button: "Login" or "Register" (TextButton, mysticaLightBlue)
- Loading state: Disable form, show spinner on button
- Footer:
  - Login tab: No footer link needed (register tab available)
  - Register tab: No footer link needed (login tab available)

**3. Email Verification Screen**
- Center card (mysticaLightBrown background):
  - Icon: Envelope SF Symbol
  - Title: "Verify Your Email"
  - Message: "We sent a verification link to [email]. Please check your inbox."
  - Primary button: "Resend Verification Email"
  - Secondary button: "Back to Login"
- Show success toast on resend: "Verification email sent"

**4. Settings Screen** (modify existing or create new)
- Navigation title: "Settings"
- Scrollable list of settings options
- Bottom section:
  - "Logout" button (red text, TextButton)
  - Confirmation dialog on tap: "Are you sure you want to logout?"

#### States
- **Default:** Empty form, no errors, enabled submit button
- **Loading:** Disabled form, spinner on submit button, no user interaction
- **Error:** Red error text below form, submit button enabled (allow retry)
- **Success (registration):** Navigate to email verification screen
- **Success (login):** Navigate to map view

#### Accessibility
- Text fields: Accessibility labels ("Email address", "Password")
- Buttons: Accessibility hints ("Double tap to login", "Double tap to register")
- Error messages: VoiceOver announces errors when shown
- Minimum touch targets: 44x44pt (iOS standard)

#### Responsive Behavior
- **iPhone (portrait):** Single column, full-width form fields
- **iPhone (landscape):** Same layout, keyboard may cover bottom elements (use `.ignoresSafeArea(.keyboard)` or ScrollView)
- **iPad:** Centered form with max width 400pt, padding on sides

## Technical Requirements

### Performance
- **Session check on launch:** < 2 seconds (network dependent)
- **Token refresh:** < 1 second (backend API response time)
- **Login/Register API call:** < 5 seconds (Supabase auth standard timing)
- **Form validation:** Instant (client-side regex)
- **Keychain read/write:** < 100ms (synchronous, fast)

### Security
- **Authentication:** JWT tokens via Supabase Auth
- **Authorization:** Bearer token in `Authorization` header for all authenticated endpoints
- **Data protection:**
  - Tokens stored in Keychain (encrypted by iOS)
  - Never log tokens to console
  - Clear tokens on logout
- **Password handling:**
  - SecureField (masked input)
  - Never stored locally
  - Sent over HTTPS only (enforce https:// in backend URL config)
- **Token expiration:**
  - Access token: 1 hour (backend enforced)
  - Refresh token: Used to obtain new access token (indefinite until logout)
  - Silent refresh on 401 errors

### Integration Points

1. **Supabase Swift SDK:**
   - Add via Swift Package Manager: `https://github.com/supabase/supabase-swift`
   - Use for direct auth calls (bypasses backend for Supabase-specific operations)
   - **Decision:** Use backend REST API instead of SDK for consistency (backend wraps Supabase)

2. **Backend REST API:**
   - Base URL: Environment-configurable (e.g., `https://api.mystica.app` or `http://localhost:3000`)
   - All 7 auth endpoints already implemented (F-07 spec:98-106)
   - Returns Supabase session tokens in response

3. **NavigationManager:**
   - Add new destinations: `.login`, `.register`, `.emailVerification`
   - Update `NavigationDestination.swift:12-21` enum
   - Update `ContentView.swift:28-67` router switch
   - Integration: `navigationManager.navigateTo(.login)` from splash screen

4. **Keychain Services:**
   - Use native `Security` framework or lightweight wrapper
   - Keys: `mystica_access_token`, `mystica_refresh_token`, `mystica_user_id`
   - On logout: Delete all keys with prefix `mystica_`

## Implementation Notes

### Existing Patterns to Follow

**Singleton Service Pattern** (see `AudioManager.swift`):
```swift
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    private init() {
        // Check Keychain for existing session on init
        checkStoredSession()
    }

    func login(email: String, password: String) async throws { }
    func register(email: String, password: String) async throws { }
    func logout() async throws { }
    func refreshToken() async throws { }
}
```

**Environment Injection** (see `New_MysticaApp.swift:31-33`):
```swift
@StateObject private var authService = AuthService.shared

SplashScreenView()
    .environmentObject(navigationManager)
    .environmentObject(audioManager)
    .environmentObject(authService)  // Add this
```

**Navigation Integration** (see `NavigationManager.swift`):
```swift
// 1. Add to NavigationDestination.swift:12-21
enum NavigationDestination: Hashable {
    case mainMenu
    case login
    case register
    case emailVerification(email: String)
    // ... existing cases
}

// 2. Update ContentView.swift:28-67 switch
@ViewBuilder
private func destinationView(for destination: NavigationDestination) -> some View {
    switch destination {
    case .login:
        LoginView()
    case .register:
        RegisterView()
    case .emailVerification(let email):
        EmailVerificationView(email: email)
    // ... existing cases
    }
}
```

**HTTP Service Layer** (new, follow singleton pattern):
```swift
@MainActor
class HTTPService {
    static let shared = HTTPService()
    private let baseURL: String

    private init() {
        // Read from env config or hardcode for MVP
        self.baseURL = "http://localhost:3000/api/v1"
    }

    func request<T: Decodable>(
        method: String,
        path: String,
        body: Encodable? = nil,
        token: String? = nil
    ) async throws -> T {
        // URLSession implementation
        // Add Authorization header if token provided
        // Decode JSON response
        // Throw typed errors (NetworkError enum)
    }
}
```

**Keychain Wrapper** (new, lightweight):
```swift
enum KeychainService {
    private static let service = "com.mystica.app"

    static func save(key: String, value: String) throws {
        // Use Security framework SecItemAdd
    }

    static func get(key: String) -> String? {
        // Use Security framework SecItemCopyMatching
    }

    static func delete(key: String) throws {
        // Use Security framework SecItemDelete
    }

    static func clearAll() {
        // Delete all items with service identifier
    }
}
```

### Technology Choices

1. **No Supabase Swift SDK:** Use backend REST API for consistency
   - **Reasoning:** Backend already wraps all Supabase operations, reduces client dependencies
   - **Trade-off:** No built-in session refresh helper, must implement manually

2. **Native Keychain over UserDefaults:** Security requirement
   - **Reasoning:** Tokens are sensitive credentials, UserDefaults is not encrypted
   - **Trade-off:** Slightly more complex API, but iOS standard for auth tokens

3. **Async/await for network calls:** Modern Swift concurrency
   - **Reasoning:** Cleaner than completion handlers, better error propagation
   - **Trade-off:** iOS 15+ requirement (already met, app targets iOS 17+)

4. **@EnvironmentObject for AuthService:** Follow existing DI pattern
   - **Reasoning:** Consistency with NavigationManager and AudioManager
   - **Trade-off:** Must inject at app level and in all previews

### Error Handling

**Network Errors:**
```swift
enum NetworkError: LocalizedError {
    case noInternetConnection
    case invalidResponse
    case unauthorized
    case serverError(message: String)

    var errorDescription: String? {
        switch self {
        case .noInternetConnection:
            return "No internet connection. Please check your network and try again."
        case .invalidResponse:
            return "Invalid response from server. Please try again."
        case .unauthorized:
            return "Session expired. Please login again."
        case .serverError(let message):
            return message
        }
    }
}
```

**Form Validation:**
- Validate on submit (don't block typing)
- Show errors inline below field
- Clear errors on field edit
- Disable submit button during API call

**Token Refresh on 401:**
```swift
// In HTTPService.request()
if response.statusCode == 401 {
    // Try refresh
    try await AuthService.shared.refreshToken()
    // Retry original request with new token
    return try await request(method: method, path: path, body: body, token: newToken)
}
```

## Out of Scope

Deferred to post-MVP0:
- Password reset flow (backend endpoint exists, frontend not needed for MVP0)
- OAuth providers (Google/Apple Sign In)
- Biometric authentication (Face ID / Touch ID)
- "Remember me" toggle (default behavior is persistent session)
- Account deletion
- Profile editing (username, email change)
- Password change while logged in
- Multi-device session management
- Offline mode / cached credentials
- Rate limiting / brute force protection (backend handles this)

## Success Criteria

- [x] User can register with email/password
- [x] Registration shows "Email verification sent" screen
- [x] User can resend verification email
- [x] User can login with verified credentials
- [x] Invalid credentials show clear error message
- [x] Session persists across app relaunches (auto-login on splash screen)
- [x] Access token refreshes silently when expired (1hr lifetime)
- [x] Expired refresh token redirects to login
- [x] User can logout from Settings screen
- [x] Logout clears all stored tokens
- [x] All API calls include Authorization header with valid JWT
- [x] Network errors show user-friendly messages
- [x] Forms follow existing design system (colors, fonts, components)
- [x] Navigation integrates with existing NavigationManager
- [x] Zero Keychain security warnings or token exposure in logs

## Relevant Files

### Backend (Already Implemented - Reference Only)
- `mystica-express/src/controllers/auth.controller.ts` - All 7 auth endpoints
- `mystica-express/src/middleware/auth.ts` - JWT validation middleware
- `mystica-express/src/types/schemas.ts` - Zod validation schemas
- `mystica-express/src/config/supabase.ts` - Supabase client config
- `mystica-express/tests/integration/auth.test.ts` - 8 test suites for auth

### Frontend (To Create/Modify)
- `New-Mystica/New-Mystica/Services/AuthService.swift` - **NEW** Singleton auth state manager
- `New-Mystica/New-Mystica/Services/HTTPService.swift` - **NEW** REST API client
- `New-Mystica/New-Mystica/Services/KeychainService.swift` - **NEW** Secure storage wrapper
- `New-Mystica/New-Mystica/Models/User.swift` - **NEW** User data model
- `New-Mystica/New-Mystica/Views/Auth/LoginView.swift` - **NEW** Login screen
- `New-Mystica/New-Mystica/Views/Auth/RegisterView.swift` - **NEW** Registration screen
- `New-Mystica/New-Mystica/Views/Auth/EmailVerificationView.swift` - **NEW** Verification screen
- `New-Mystica/New-Mystica/NavigationDestination.swift` - **MODIFY** Add auth destinations (lines 12-21)
- `New-Mystica/New-Mystica/ContentView.swift` - **MODIFY** Add auth routes (lines 28-67)
- `New-Mystica/New-Mystica/New_MysticaApp.swift` - **MODIFY** Inject AuthService (lines 31-33)
- `New-Mystica/New-Mystica/SplashScreenView.swift` - **MODIFY** Add session check logic
- `New-Mystica/New-Mystica/SettingsView.swift` - **CREATE OR MODIFY** Add logout button

### Existing Patterns (Reference)
- `New-Mystica/New-Mystica/NavigationManager.swift` - Singleton + @EnvironmentObject pattern
- `New-Mystica/New-Mystica/AudioManager.swift` - Service singleton example
- `New-Mystica/New-Mystica/UI/Components/ButtonComponents.swift` - Button styling (Impact font)
- `New-Mystica/New-Mystica/UI/Components/TextComponents.swift` - Text styling
- `New-Mystica/New-Mystica/UI/Colors/Colors.swift` - Color palette
- `New-Mystica/New-Mystica/Item.swift` - SwiftData model example

### Documentation
- `docs/feature-specs/F-07-authentication.yaml` - Backend spec and API contracts
- `docs/product-requirements.yaml` - MVP0 authentication goals
- `agent-responses/agent_492713.md` - SwiftUI investigation report
