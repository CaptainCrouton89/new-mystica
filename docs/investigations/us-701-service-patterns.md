# US-701 Service Patterns Investigation

**Investigation Date:** 2025-01-27
**Target:** Authentication and service patterns for EquipmentService implementation
**User Story:** US-701 - Load Player Data on App Startup

## Executive Summary

Found comprehensive service patterns in AuthService.swift that provide the exact blueprint for implementing EquipmentService. The AuthService demonstrates:
- @MainActor singleton pattern with @Published state management
- Async throws methods with state updates
- Generic HTTP client with JSON encoding/decoding
- Environment injection via @StateObject and .environmentObject()
- Integration with .task modifier for startup flows

## Section 1: Service Class Declaration Patterns

### Primary Pattern: AuthService.swift:33-42
```swift
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    private let baseURL = "http://localhost:3000/api/v1"

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User? = nil

    private init() {}
}
```

### Alternative Pattern: AudioManager.swift:13-23
```swift
class AudioManager: ObservableObject {
    static let shared = AudioManager()

    @Published var isEnabled: Bool = true
    private var audioPlayers: [String: AVAudioPlayer] = [:]

    private init() {
        setupAudioSession()
        preloadAudioFiles()
    }
}
```

**Key Differences:**
- AuthService uses @MainActor for UI thread safety (required for authentication state)
- AudioManager has initialization logic in private init()
- Both use static shared singleton pattern with private init()

## Section 2: Published Properties Implementation

### AuthService Published Properties (AuthService.swift:39-40)
```swift
@Published var isAuthenticated: Bool = false
@Published var currentUser: User? = nil
```

### State Management Pattern in Async Methods (AuthService.swift:76-77, 87, 109-110)
```swift
// In registerDevice():
self.currentUser = response.user
self.isAuthenticated = true

// In bootstrapSession():
self.isAuthenticated = true

// In logout():
self.isAuthenticated = false
self.currentUser = nil
```

**For EquipmentService, equivalent would be:**
```swift
@Published var equipment: Equipment? = nil
@Published var totalStats: PlayerStats? = nil
@Published var isLoading: Bool = false
@Published var loadError: Error? = nil
```

## Section 3: Async Method Patterns

### Async Throws Method Signature (AuthService.swift:45)
```swift
func registerDevice() async throws {
    guard let deviceId = UIDevice.current.identifierForVendor?.uuidString else {
        throw AuthError.noDeviceId
    }
    // ... implementation
}
```

### Bootstrap Pattern (AuthService.swift:81-89)
```swift
func bootstrapSession() async -> Bool {
    guard KeychainService.get(key: "mystica_access_token") != nil else {
        return false
    }

    // For MVP0: Trust token existence = authenticated (no validation call)
    self.isAuthenticated = true
    return true
}
```

### State Updates in Async Context (AuthService.swift:76-77)
```swift
// Store tokens in keychain
try KeychainService.save(key: "mystica_access_token", value: response.session.access_token)
try KeychainService.save(key: "mystica_device_id", value: deviceId)

self.currentUser = response.user
self.isAuthenticated = true
```

## Section 4: Environment Injection Setup

### App-Level Service Registration (New_MysticaApp.swift:13-14, 32-34)
```swift
@main
struct New_MysticaApp: App {
    @StateObject private var navigationManager = NavigationManager()
    @StateObject private var audioManager = AudioManager.shared

    var body: some Scene {
        WindowGroup {
            SplashScreenView()
                .environmentObject(navigationManager)
                .environmentObject(audioManager)
                .environmentObject(AuthService.shared)
        }
    }
}
```

**For EquipmentService integration:**
```swift
// Add to New_MysticaApp.swift after line 14:
@StateObject private var equipmentService = EquipmentService.shared

// Add to environment injection after line 34:
.environmentObject(equipmentService)
```

## Section 5: Service Consumption Patterns

### View-Level Service Access (SplashScreenView.swift:16, SettingsView.swift:13)
```swift
// In SplashScreenView:
@EnvironmentObject private var authService: AuthService

// In SettingsView:
@EnvironmentObject var authService: AuthService
```

### Task Modifier Integration (SplashScreenView.swift:58-77)
```swift
.task {
    // Check if device has authentication token
    let hasToken = KeychainService.get(key: "mystica_access_token") != nil

    if !hasToken {
        // Register device if no token exists
        try? await authService.registerDevice()
    } else {
        // Bootstrap session if token exists
        _ = await authService.bootstrapSession()
    }

    // Navigate to map (user is now authenticated)
    navigationManager.navigateTo(.map)

    // Transition to main app
    withAnimation(.easeInOut(duration: 0.5)) {
        isActive = true
    }
}
```

### Async Error Handling in Views (SettingsView.swift:57-67)
```swift
Button("Logout", role: .destructive) {
    Task {
        do {
            try await authService.logout()
            navigationManager.navigateTo(.map)
        } catch {
            // Handle errors silently for MVP0
            // Still navigate to map even if logout fails
            navigationManager.navigateTo(.map)
        }
    }
}
```

## Section 6: Error Handling Strategies

### Custom Error Enum (AuthService.swift:13-31)
```swift
enum AuthError: LocalizedError {
    case invalidResponse
    case serverError(Int)
    case networkError(Error)
    case noDeviceId

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .serverError(let code):
            return "Server error: \(code)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .noDeviceId:
            return "Could not get device ID"
        }
    }
}
```

### Error Handling in Async Methods (AuthService.swift:152-156)
```swift
} catch let error as AuthError {
    throw error
} catch {
    throw AuthError.networkError(error)
}
```

**For EquipmentService:**
```swift
enum EquipmentError: LocalizedError {
    case invalidResponse
    case serverError(Int)
    case networkError(Error)
    case dataNotFound

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid equipment data response"
        case .serverError(let code):
            return "Server error: \(code)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .dataNotFound:
            return "Equipment data not found"
        }
    }
}
```

## Section 7: HTTP Client Implementation

### Generic Request Method (AuthService.swift:116-157)
```swift
private func makeRequest<T: Decodable>(
    method: String,
    path: String,
    body: Encodable? = nil,
    requiresAuth: Bool = false
) async throws -> T {
    let url = URL(string: "\(baseURL)\(path)")!
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    if requiresAuth, let token = KeychainService.get(key: "mystica_access_token") {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    if let body = body {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(body)
    }

    do {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw AuthError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    } catch let error as AuthError {
        throw error
    } catch {
        throw AuthError.networkError(error)
    }
}
```

### Request Usage Pattern (AuthService.swift:66-70)
```swift
let response: DeviceRegistrationResponse = try await makeRequest(
    method: "POST",
    path: "/auth/register-device",
    body: requestBody
)
```

## Section 8: Implementation Roadmap for EquipmentService

### Step 1: Create EquipmentService.swift
Based on AuthService.swift:33-42, implement:

```swift
@MainActor
class EquipmentService: ObservableObject {
    static let shared = EquipmentService()

    private let baseURL = "http://localhost:3000/api/v1"

    @Published var equipment: Equipment? = nil
    @Published var totalStats: PlayerStats? = nil
    @Published var isLoading: Bool = false
    @Published var loadError: EquipmentError? = nil

    private init() {}

    func loadEquipment() async throws {
        isLoading = true
        loadError = nil

        do {
            let response: EquipmentResponse = try await makeRequest(
                method: "GET",
                path: "/equipment",
                requiresAuth: true
            )

            self.equipment = response.equipment
            self.totalStats = response.totalStats
        } catch {
            self.loadError = error as? EquipmentError ?? EquipmentError.networkError(error)
            throw error
        } finally {
            isLoading = false
        }
    }

    // Copy makeRequest<T> method from AuthService.swift:116-157
    // Adapt error types to EquipmentError
}
```

### Step 2: Update New_MysticaApp.swift
Add after line 14:
```swift
@StateObject private var equipmentService = EquipmentService.shared
```

Add after line 34:
```swift
.environmentObject(equipmentService)
```

### Step 3: Update SplashScreenView.swift
Add after line 16:
```swift
@EnvironmentObject private var equipmentService: EquipmentService
```

Modify .task block after line 67:
```swift
.task {
    // Existing auth flow...

    // NEW: Load equipment after auth succeeds
    if authService.isAuthenticated {
        do {
            try await equipmentService.loadEquipment()
        } catch {
            // Handle equipment loading errors
            print("Failed to load equipment: \(error)")
        }
    }

    // Navigate to map...
}
```

### Step 4: Add Data Models
Create Equipment and PlayerStats models matching backend API response format from F-09 spec.

### Step 5: Error Handling UI
Add error display logic to SplashScreenView based on equipmentService.loadError state, with retry functionality.

## Key Integration Points

1. **Authentication Dependency:** Equipment loading must occur after successful authentication (SplashScreenView.swift:67)
2. **Error State Management:** Use @Published loadError property to surface network errors to UI
3. **Loading States:** Use @Published isLoading to show/hide loading indicators
4. **Retry Logic:** Implement retryLoad() method that wraps loadEquipment() for user-triggered retries
5. **Offline Caching:** Consider UserDefaults or SwiftData caching for offline access (mentioned in US-701:56)

## Dependencies Required

- Backend GET /equipment endpoint implementation (currently stubbed per US-701:44)
- Equipment and PlayerStats Swift models
- Network reachability check (recommended per US-701:24)

This investigation provides all necessary patterns to implement EquipmentService following established architectural conventions in the codebase.